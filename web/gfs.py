# -*- coding: utf-8 -*-
"""海纳 · 全球风场（NOAA GFS，10 米风，权威预报）
从 NOAA NOMADS 下载 GFS GRIB2（0.25°）→ cfgrib 解析 10 米风 U/V → 0.5° 网格 → 缓存
接口：/api/ocean-gfs（返回 0.5° 网格 U/V 风场，供前端 leaflet-wind 画流场）
数据源：NOAA GFS（0.25°，逐小时预报，每天 4 次，权威）
"""
import os, time, json, re, urllib.request

NOMADS_BASE = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "crawler", "data", "gfs_cache")
CACHE_FILE = os.path.join(CACHE_DIR, "gfs_uv.json")
CACHE_TTL = 6 * 60 * 60  # 6 小时过期（GFS 每 6 小时更新）

# 0.5° 网格（跟 RTOFS/星图一致）
NX, NY = 720, 360
LON0, LAT0, DX, DY = -180.0, -90.0, 0.5, 0.5

def _fetch_to_file(path, dest, timeout=300):
    """流式下载 GFS 文件到磁盘（不占内存）"""
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
    """找最新 GFS 运行目录 + 数据时次（gfs.YYYYMMDD, HH）。
    遍历所有时次（00/06/12/18）找最新可用的 f000，不只 00 时次。
    返回 (run_dir, hour)，hour 是 '00'/'06'/'12'/'18'。"""
    req = urllib.request.Request(NOMADS_BASE + "/", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8", "ignore")
    dirs = re.findall(r"gfs\.(\d{8})/", body)
    if not dirs:
        return None
    hours = ["00", "06", "12", "18"]
    # 从最新往前找，找有 pgrb2 f000 数据的目录（GFS 数据可能延迟，最新目录可能没数据）
    for d in sorted(set(dirs), reverse=True):
        run = "gfs." + d
        # 从最新时次往前，找有 f000 数据的时次（不只 00）
        for h in hours:
            try:
                check_url = NOMADS_BASE + "/" + run + "/" + h + "/atmos/gfs.t" + h + "z.pgrb2.0p25.f000"
                req2 = urllib.request.Request(check_url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req2, timeout=20) as r2:
                    if r2.status == 200:
                        return (run, h)
            except Exception:
                continue
    return ("gfs." + max(dirs), "00")  # 都失败，回退最新目录的 00 时次

def _parse_gfs_to_grid(grib_path):
    """xarray + cfgrib 引擎解析 GFS GRIB2 的 10 米风 U/V → 0.5° 网格"""
    import numpy as np
    import xarray as xr
    # 打开 GRIB（engine='cfgrib'），取 10 米 U/V 风分量
    ds = xr.open_dataset(grib_path, engine="cfgrib", filter_by_keys={"typeOfLevel": "heightAboveGround", "level": 10})
    u = ds["u10"].values  # 10 米 U 风（m/s）
    v = ds["v10"].values  # 10 米 V 风（m/s）
    lat = ds["latitude"].values
    lon = ds["longitude"].values
    # lon 转 -180~180（GFS 0.25° 是 0~359.75）
    lon = ((lon + 180) % 360) - 180
    # 0.25° 网格 → 0.5° 网格（抽稀，每 2 点取 1）
    u_half = u[::2, ::2]
    v_half = v[::2, ::2]
    lat_half = lat[::2]
    lon_half = lon[::2]
    # 转成规则 0.5° 网格（720x360，-180~180）
    lon_grid = np.linspace(LON0, LON0 + (NX-1)*DX, NX)
    lat_grid = np.linspace(LAT0, LAT0 + (NY-1)*DY, NY)
    # 用 griddata 插值到 0.5° 网格
    from scipy.interpolate import griddata
    pl, pn = np.meshgrid(lat_half, lon_half, indexing="ij")
    pu = u_half.ravel(); pv = v_half.ravel()
    pn_r = pn.ravel(); pl_r = pl.ravel()
    valid = np.isfinite(pu) & np.isfinite(pv)
    lon_mesh, lat_mesh = np.meshgrid(lon_grid, lat_grid)
    u_reg = griddata((pn_r[valid], pl_r[valid]), pu[valid], (lon_mesh, lat_mesh), method="linear")
    v_reg = griddata((pn_r[valid], pl_r[valid]), pv[valid], (lon_mesh, lat_mesh), method="linear")
    u_reg = np.nan_to_num(u_reg, nan=0.0)
    v_reg = np.nan_to_num(v_reg, nan=0.0)
    # 转成星图流场 json 格式：[{header, data}, {header, data}]，data 一维拉平（纬度北→南）
    # 星图 header: nx=720, ny=360, lo1=-180, la1=89.5, lo2=179.5, la2=-90, dx=0.5, dy=0.5, parameterCategory=2, parameterNumber=2
    # lat_grid 是 -90~90（南→北），星图 la1=89.5（北→南）——翻转纬度
    u_flip = np.flipud(u_reg)  # 纬度翻转（北→南）
    v_flip = np.flipud(v_reg)
    header = {"nx": NX, "ny": NY, "lo1": LON0, "la1": LAT0 + (NY-1)*DY, "lo2": LON0 + (NX-1)*DX, "la2": LAT0, "dx": DX, "dy": DY, "parameterCategory": 2, "parameterNumber": 2}
    u_data = u_flip.ravel().tolist()  # 一维拉平
    v_data = v_flip.ravel().tolist()
    return [{"header": dict(header, parameterNumber=2), "data": u_data}, {"header": dict(header, parameterNumber=3), "data": v_data}]

def update_cache():
    """下载最新 GFS GRIB → 解析 → 写缓存"""
    os.makedirs(CACHE_DIR, exist_ok=True)
    found = _latest_run_dir()
    if not found:
        return None
    run_dir, hour = found
    # 用 f000（当前时次，0.25°），hour 是数据实际时次（00/06/12/18）
    grib_path = f"/{run_dir}/{hour}/atmos/gfs.t{hour}z.pgrb2.0p25.f000"
    tmp = os.path.join(CACHE_DIR, "gfs_tmp.grib2")
    tmp_json = os.path.join(CACHE_DIR, "gfs_uv.json.tmp")
    try:
        _fetch_to_file(grib_path, tmp, timeout=300)
        flow_data = _parse_gfs_to_grid(tmp)  # 返回 [{header,data},{header,data}]（星图流场格式）
        os.remove(tmp)
        data = {"status": 0, "result": flow_data, "time": time.strftime("%Y%m%d%H%M"), "source": "noaa_gfs"}
        # 原子写：先写临时文件，再 os.replace 原子替换，避免接口读到写一半的坏文件
        with open(tmp_json, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp_json, CACHE_FILE)
        return data
    except Exception as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        if os.path.exists(tmp_json):
            os.remove(tmp_json)
        return None

def get_gfs():
    """返回 GFS 风场（缓存优先，无则更新）
    缓存过期时也返回旧缓存（避免接口同步触发下载+解析导致超时），
    由 cron 的 update_gfs.py 在后台更新缓存。
    """
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return update_cache()

if __name__ == "__main__":
    import json as _j
    d = get_gfs()
    if d:
        print("GFS 风场 OK, 网格:", len(d["u"]), "x", len(d["u"][0]), "| time:", d["time"])
    else:
        print("GFS 获取失败")
