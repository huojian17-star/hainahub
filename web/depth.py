# -*- coding: utf-8 -*-
"""海纳 · 海底地形水深点查询（NOAA NCEI ETOPO 2022 griddap）
接口：get_depth(lat, lon) -> 水深（米，负值=海底深度，正值=陆地海拔）
ETOPO griddap 按经纬度返回 z 值（meters），负值为水深、正值为陆地海拔。
加内存缓存（同一坐标重复查询不重新调 ERDDAP）。
"""
import requests
import time as _time
import threading

ERDDAP_GRIDDAP = "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s.json"

_cache = {}
_cache_lock = threading.Lock()


def get_depth(lat, lon):
    """查经纬度水深。返回 {depth: 米, lat, lon}，失败返回 None。
    depth 负值=海底深度（如 -97.25 表示水深 97.25 米），正值=陆地海拔。
    """
    try:
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        return None
    # 查缓存（key = lat|lon）
    cache_key = "%.2f|%.2f" % (lat, lon)
    with _cache_lock:
        cached = _cache.get(cache_key)
        if cached and _time.time() - cached[0] < 6 * 3600:
            return cached[1]
    # 调 ETOPO griddap 点查询
    url = ERDDAP_GRIDDAP + "?z%5B(" + str(lat) + ")%5D%5B(" + str(lon) + ")%5D"
    try:
        r = requests.get(url, timeout=20)
        if r.status_code != 200:
            return None
        data = r.json()
        rows = (data.get("table") or {}).get("rows") or []
        if not rows:
            return None
        row = rows[0]
        # row = [lat, lon, z]
        z = row[2]
        result = {"depth": z, "lat": row[0], "lon": row[1]}
        with _cache_lock:
            _cache[cache_key] = (_time.time(), result)
        return result
    except Exception:
        return None
