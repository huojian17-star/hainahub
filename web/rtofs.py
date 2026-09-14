# -*- coding: utf-8 -*-
"""海纳 · 全球洋流（NOAA RTOFS，权威实时预报）
从 NOAA NOMADS 下载 RTOFS 洋流数据（1/12° 不规则网格），插值到规则 0.5° 网格，缓存
接口：/api/ocean-flow 优先用 RTOFS 缓存（无则星图兜底）
数据源：NOAA Global RTOFS（1/12° HYCOM，逐 3 小时预报，每天更新，权威）
"""
import os, time, json, glob, datetime

NOMADS_BASE = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/rtofs/prod"
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "crawler", "data", "rtofs_cache")
CACHE_FILE = os.path.join(CACHE_DIR, "rtofs_uv.json")
CACHE_TTL = 6 * 60 * 60  # 6 小时过期（RTOFS 每天更新，6 小时够）
# 0.5° 海陆掩膜（720x360，匹配 RTOFS 0.5° 数据网格，把陆地格点流速设 None，避免流线覆盖陆地）
MASK_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "data", "land_mask.json")
_land_mask = None

def _load_land_mask():
    global _land_mask
    if _land_mask is not None:
        return _land_mask
    try:
        with open(MASK_PATH, encoding="utf-8") as f:
            _land_mask = json.load(f)
    except Exception:
        _land_mask = {"mask": []}
    return _land_mask

def _apply_land_mask(cache):
    """把陆地格点流速设 0（粒子在陆地不动不画流线，同时保证粒子全球均匀生成无空洞）"""
    mask_obj = _load_land_mask()
    mask = mask_obj.get("mask", [])
    if not mask:
        return cache
    nx = cache["nx"]
    u = cache["u"]; v = cache["v"]
    for idx in range(len(u)):
        row = idx // nx; col = idx % nx
        if row < len(mask) and col < len(mask[row]) and mask[row][col] == 1:
            u[idx] = 0.0; v[idx] = 0.0
    return cache
# 规则网格参数（0.5° 网格，跟星图一致，保留洋流细节；RTOFS 1/12° 高分辨率插值到 0.5°）
NX, NY = 720, 360
LON0, LAT0, DX, DY = -180.0, -90.0, 0.5, 0.5

def _fetch_to_file(path, dest, timeout=300):
    """流式下载 RTOFS 文件到磁盘（不占内存）"""
    import urllib.request
    url = NOMADS_BASE + path
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        with open(dest, "wb") as f:
            while True:
                chunk = r.read(1024*1024)
                if not chunk:
                    break
                f.write(chunk)
    return dest

def _latest_run_dir():
    """找最新 RTOFS 运行目录（rtofs.YYYYMMDD）"""
    import urllib.request, re
    req = urllib.request.Request(NOMADS_BASE + "/", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8", "ignore")
    dirs = re.findall(r'rtofs\.(\d{8})/', body)
    if not dirs:
        return None
    return "rtofs." + max(dirs)

def _interp_to_grid(u, v, lat, lon):
    """RTOFS 不规则网格插值到规则 0.5° 网格（分块 + 局部点，控制内存）
    每块只用块内+缓冲的插值点，避免全局 Delaunay 大内存；NaN 用 nearest 兜底
    """
    import numpy as np
    from scipy.interpolate import griddata
    fill = 1e20
    u = u.astype(float); v = v.astype(float)
    u[u > fill] = np.nan; v[v > fill] = np.nan
    # 抽稀（每 8 点取 1，保留细节同时控制点数）
    u_s = u[::8, ::8]; v_s = v[::8, ::8]
    lat_s = lat[::8, ::8]; lon_s = lon[::8, ::8]
    pl = lat_s.ravel(); pn = lon_s.ravel(); pu = u_s.ravel(); pv = v_s.ravel()
    valid = ~np.isnan(pu) & ~np.isnan(pv)
    pl = pl[valid]; pn = pn[valid]; pu = pu[valid]; pv = pv[valid]
    # lon 折叠（74~1019 转回 -180~180）
    pn = ((pn + 180) % 360) - 180
    lon_grid = np.linspace(LON0, LON0 + (NX-1)*DX, NX)
    lat_grid = np.linspace(LAT0, LAT0 + (NY-1)*DY, NY)
    lon_mesh, lat_mesh = np.meshgrid(lon_grid, lat_grid)
    u_reg = np.full((NY, NX), np.nan)
    v_reg = np.full((NY, NX), np.nan)
    # 分块插值（每块 40x40，每块只用块内+缓冲点，省内存）
    block = 40
    buf = 2
    for j0 in range(0, NY, block):
        for i0 in range(0, NX, block):
            j1 = min(j0 + block, NY); i1 = min(i0 + block, NX)
            blon = lon_mesh[j0:j1, i0:i1]; blat = lat_mesh[j0:j1, i0:i1]
            # 块内 + 缓冲的插值点（限制点数，省内存）
            m = (pn >= lon_mesh[0, max(i0-buf, 0)] - 1) & \
                (pn <= lon_mesh[0, min(i1-1, NX-1)] + 1) & \
                (pl >= lat_mesh[max(j0-buf, 0), 0] - 1) & \
                (pl <= lat_mesh[min(j1-1, NY-1), 0] + 1)
            if m.sum() < 4:
                continue
            bu = griddata((pn[m], pl[m]), pu[m], (blon, blat), method="linear")
            bv = griddata((pn[m], pl[m]), pv[m], (blon, blat), method="linear")
            u_reg[j0:j1, i0:i1] = bu
            v_reg[j0:j1, i0:i1] = bv
    # NaN 用 nearest 兜底（减少空白）
    if np.isnan(u_reg).any():
        u_reg = griddata((pn, pl), pu, (lon_mesh, lat_mesh), method="nearest")
    if np.isnan(v_reg).any():
        v_reg = griddata((pn, pl), pv, (lon_mesh, lat_mesh), method="nearest")
    return u_reg, v_reg
    u_reg = np.nan_to_num(u_reg, nan=0.0)
    v_reg = np.nan_to_num(v_reg, nan=0.0)
    return u_reg, v_reg

def update_cache():
    """下载 RTOFS + 插值 + 缓存。返回 (ok, msg)"""
    try:
        import numpy as np
        import h5py
        run_dir = _latest_run_dir()
        if not run_dir:
            return False, "找不到 RTOFS 运行目录"
        # 下载 2D 表层预报（含 u/v 洋流），流式到临时文件（不占内存）
        prog_path = f"/{run_dir}/rtofs_glo_2ds_f000_prog.nc"
        tmp = os.path.join(CACHE_DIR, "_tmp_rtofs.nc")
        os.makedirs(CACHE_DIR, exist_ok=True)
        _fetch_to_file(prog_path, tmp, timeout=300)
        f = h5py.File(tmp, "r")
        u = f["u_velocity"][0, 0]; v = f["v_velocity"][0, 0]
        lat = f["Latitude"][:]; lon = f["Longitude"][:]
        f.close()
        os.unlink(tmp)
        u_reg, v_reg = _interp_to_grid(u, v, lat, lon)
        # 存缓存（u/v 展平为行优先数组，跟星图一致）
        os.makedirs(CACHE_DIR, exist_ok=True)
        cache = {
            "nx": NX, "ny": NY, "lo1": LON0, "la1": LAT0, "dx": DX, "dy": DY,
            "time": time.time(),
            "source": "noaa_rtofs",
            "refTime": run_dir,
            "u": u_reg.ravel().tolist(),
            "v": v_reg.ravel().tolist(),
        }
        with open(CACHE_FILE, "w", encoding="utf-8") as fp:
            json.dump(cache, fp)
        return True, f"RTOFS 缓存更新成功（{run_dir}）"
    except Exception as e:
        return False, f"RTOFS 更新失败: {e}"

def get_flow():
    """读 RTOFS 缓存，返回 U/V 分量数组（跟星图格式一致，供前端 leaflet-wind）"""
    try:
        if not os.path.exists(CACHE_FILE):
            return None
        if time.time() - os.path.getmtime(CACHE_FILE) > CACHE_TTL:
            return None  # 过期
        with open(CACHE_FILE, encoding="utf-8") as f:
            cache = json.load(f)
        # 应用海陆掩膜（把陆地格点设 None，避免流线覆盖陆地）
        cache = _apply_land_mask(cache)
        # 反转纬度（RTOFS 纬度从南到北，leaflet-wind 默认 flipY=true 假设从北到南）
        nx = cache["nx"]; ny = cache["ny"]
        u = cache["u"]; v = cache["v"]
        u_rev = [None] * len(u); v_rev = [None] * len(v)
        for j in range(ny):
            src = (ny - 1 - j) * nx
            dst = j * nx
            u_rev[dst:dst+nx] = u[src:src+nx]
            v_rev[dst:dst+nx] = v[src:src+nx]
        la1 = cache["la1"] + (ny - 1) * cache["dy"]  # 反转后 la1=北
        la2 = cache["la1"]  # 反转后 la2=南
        # 加 parameterCategory/parameterNumber（leaflet-wind 识别 U/V 分量需要）
        return [
            {"header": {"nx": nx, "ny": ny, "lo1": cache["lo1"], "la1": la1,
                        "lo2": cache["lo1"] + (nx-1)*cache["dx"], "la2": la2,
                        "dx": cache["dx"], "dy": cache["dy"], "parameterCategory": 2, "parameterNumber": 2},
             "data": u_rev},
            {"header": {"nx": nx, "ny": ny, "lo1": cache["lo1"], "la1": la1,
                        "lo2": cache["lo1"] + (nx-1)*cache["dx"], "la2": la2,
                        "dx": cache["dx"], "dy": cache["dy"], "parameterCategory": 2, "parameterNumber": 3},
             "data": v_rev},
        ]
    except Exception:
        return None

if __name__ == "__main__":
    import sys
    ok, msg = update_cache()
    print(msg)
    flow = get_flow()
    if flow:
        print("缓存有数据，u 长度:", len(flow[0]["data"]))
