# -*- coding: utf-8 -*-
"""海纳 · 智渔牧海 —— 实时水质感知模块（自研点1输入层）
从 NOAA ERDDAP 拉实时 sst/chl，聚焦中国牧场区点位，30 分钟缓存。
接口：/api/ocean-water?lat=..&lon=..  （单点实时水质）或 /api/ocean-water?bbox=..  （区域多点）
数据源：
  - 实时 SST：CRW_sst_v3_1 变量 analysed_sst，[last] 取最新
  - 叶绿素（分层，v2）：
      ① VIIRS SNPP 单日（noaa_snpp_chla_daily，近岸常缺）
      ② MODIS Aqua 单日（erdMH1chla1day_R2022NRT @ pfeg 节点，过境时间不同，云隙互补）
      ③ CMEMS L4 无缝重构（gap-free DINEOF，凭据在服务器 ~/.copernicusmarine/）
      ④ 近10日双星滚动合成（中位数，标注有效天数）
      全部缺失返回 None（UI 显示无晴观测，不编数）。
      每个值带 source（溯源标签）与 time（观测日期）——近岸叶绿素不是实时值，如实标注。
NOAA ERDDAP 未开 CORS，走后端代理（服务器请求无 CORS 限制）。
"""
import urllib.request, urllib.parse, json, time as _time, math

ERDDAP = "https://oceanwatch.pifsc.noaa.gov/erddap/griddap"
ERDDAP_MODIS = "https://coastwatch.pfeg.noaa.gov/erddap/griddap"
MODIS_DS = "erdMH1chla1day_R2022NRT"

# 内存缓存：相同 lat/lon 的结果缓存 30 分钟（ERDDAP 有延迟，不必每请求拉）
_cache = {}
CACHE_TTL = 30 * 60  # 30 分钟

# 中国牧场区典型点位（聚焦监测，后续可扩到 189 示范区）
# 格式: [lat, lon, 名称, 省份]
FARM_POINTS = [
    [30.80, 122.70, "嵊泗马鞍列岛国家级海洋牧场示范区", "浙江"],
    [29.90, 122.30, "舟山普陀桃花岛国家级海洋牧场示范区", "浙江"],
    [37.90, 120.70, "烟台砣矶岛国家级海洋牧场示范区", "山东"],
    [37.50, 122.50, "威海双岛湾国家级海洋牧场示范区", "山东"],
    [21.60, 111.80, "阳江南鹏岛国家级海洋牧场示范区", "广东"],
    [21.80, 108.80, "钦州三娘湾国家级海洋牧场示范区", "广西"],
    [20.10, 110.50, "海口东海岸国家级海洋牧场示范区", "海南"],
]


def _fetch_erddap(url, timeout=25):
    """拉 ERDDAP csv，返回行列表（含表头）"""
    req = urllib.request.Request(url, headers={"User-Agent": "HainaOceanPlatform/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace").strip().split("\n")


def _date_str(days_ago):
    return _time.strftime("%Y-%m-%d", _time.gmtime(_time.time() - days_ago * 86400))


def _get_sst(lat, lon):
    """实时 SST（CRW_sst_v3_1，analysed_sst，[last] 取最新）"""
    lon360 = lon % 360
    try:
        url = f"{ERDDAP}/CRW_sst_v3_1.csv?analysed_sst[last][({lat}):1:({lat})][({lon360}):1:({lon360})]"
        lines = _fetch_erddap(url)
        if len(lines) >= 3:
            parts = lines[-1].split(",")
            v = float(parts[-1])
            if math.isfinite(v):
                return {"value": v, "time": parts[0], "unit": "degree_C"}
    except Exception:
        pass
    return None


def _valid(vals):
    out = []
    for t, v in vals:
        try:
            fv = float(v)
            if math.isfinite(fv):
                out.append((t, fv))
        except Exception:
            pass
    return out


def _get_chl_cmems(lat, lon):
    """Layer④：CMEMS L4 gap-free（DINEOF 无缝重构）。数据由 cmems_warm.py（cron 每 30 分钟）
    预热写缓存文件，本函数只读文件——工具包不在 gunicorn 进程内（1.8G 内存服务器扛不起）。
    缓存超过 6 小时视为过期（让位给上游实测源）。"""
    try:
        cf = "/opt/haina/web/data/cmems_chl_cache.json"
        import json as _json, os as _os, datetime as _dt
        if not _os.path.exists(cf):
            return None
        d = _json.load(open(cf, encoding="utf-8"))
        fa = _dt.datetime.fromisoformat(d.get("fetched_at", "2000-01-01T00:00:00"))
        if (_dt.datetime.now() - fa).total_seconds() > 6 * 3600:
            return None
        best = None
        for k, v in d.get("points", {}).items():
            kla, klo = [float(x) for x in k.split(",")]
            dist = ((kla - lat) ** 2 + (klo - lon) ** 2) ** 0.5
            if dist <= 0.05 and (best is None or dist < best[0]):
                best = (dist, v)
        if best:
            v = best[1]
            return {"value": v["value"], "time": v["time"], "unit": "mg m^-3",
                    "source": v["source"], "n": v["n"]}
    except Exception:
        pass
    return None


def _get_chl_layered(lat, lon):
    """分层叶绿素：SNPP 单日 → MODIS 单日 → 近10日双星合成。返回 dict 或 None。
    返回值带 source（溯源标签）/ n（合成有效天数）。"""
    lon360 = lon % 360
    # ① SNPP 单日
    try:
        url = f"{ERDDAP}/noaa_snpp_chla_daily.csv?chlor_a[last][last][({lat}):1:({lat})][({lon360}):1:({lon360})]"
        lines = _fetch_erddap(url)
        if len(lines) >= 3:
            parts = lines[-1].split(",")
            v = float(parts[-1])
            if math.isfinite(v):
                return {"value": v, "time": parts[0], "unit": "mg m^-3",
                        "source": "VIIRS SNPP 实测", "n": 1}
    except Exception:
        pass
    # ② MODIS Aqua 单日（pfeg 节点）
    try:
        url = f"{ERDDAP_MODIS}/{MODIS_DS}.csv?chlorophyll[last][({lat}):1:({lat})][({lon360}):1:({lon360})]"
        lines = _fetch_erddap(url)
        if len(lines) >= 3:
            parts = lines[-1].split(",")
            v = float(parts[-1])
            if math.isfinite(v):
                return {"value": v, "time": parts[0], "unit": "mg m^-3",
                        "source": "MODIS Aqua 实测", "n": 1}
    except Exception:
        pass
    # ③ CMEMS L4 无缝重构（gap-free，近岸缺失的正规军解法）
    cm = _get_chl_cmems(lat, lon)
    if cm:
        return cm

    # ④ 近10日双星滚动合成（窗口锚定各数据集真实最后日期：NRT 源常有滞后，锚今天会 404）
    vals = []
    for host, ds, var, extra in [(ERDDAP, "noaa_snpp_chla_daily", "chlor_a", "[last]"),
                                 (ERDDAP_MODIS, MODIS_DS, "chlorophyll", "")]:
        try:
            u0 = f"{host}/{ds}.csv?{var}[last]{extra}[({lat}):1:({lat})][({lon360}):1:({lon360})]"
            lines0 = _fetch_erddap(u0)
            if len(lines0) < 3:
                continue
            last_t = lines0[-1].split(",")[0][:10]
            t_end = _time.strftime("%Y-%m-%d", _time.strptime(last_t, "%Y-%m-%d"))
            t_start = _time.strftime("%Y-%m-%d", _time.gmtime(_time.mktime(_time.strptime(last_t, "%Y-%m-%d")) - 9 * 86400))
            url = f"{host}/{ds}.csv?{var}[({t_start}):1:({t_end})]{extra}[({lat}):1:({lat})][({lon360}):1:({lon360})]"
            for l in _fetch_erddap(url)[2:]:
                p = l.split(",")
                if len(p) >= 4:
                    vals.append((p[0], p[-1]))
        except Exception:
            pass
    ok = _valid(vals)
    if ok:
        vs = sorted(v for _, v in ok)
        median = vs[len(vs) // 2]
        latest = max(t for t, _ in ok)
        return {"value": median, "time": latest, "unit": "mg m^-3",
                "source": "近10日双星合成", "n": len(ok)}
    return None


def get_water_quality(lat, lon):
    """单点实时水质（sst + 分层叶绿素），30 分钟缓存。返回 dict 或 None"""
    lat = round(float(lat), 4)
    lon = round(float(lon), 4)
    cache_key = f"{lat},{lon}"
    cached = _cache.get(cache_key)
    if cached and _time.time() - cached[0] < CACHE_TTL:
        return cached[1]
    sst = _get_sst(lat, lon)
    chl = _get_chl_layered(lat, lon)
    result = {
        "lat": lat, "lon": lon,
        "sst": sst, "chl": chl,
        "fetched_at": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
    }
    if sst or chl:
        _cache[cache_key] = (_time.time(), result)
    return result


def get_farm_points():
    """获取中国牧场区典型点位列表（供前端展示）"""
    return [{"lat": p[0], "lon": p[1], "name": p[2], "province": p[3]} for p in FARM_POINTS]
