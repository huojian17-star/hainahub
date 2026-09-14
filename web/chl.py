# -*- coding: utf-8 -*-
"""海纳 · 叶绿素（Chlorophyll-a）图层代理（NOAA CoastWatch ERDDAP WMS）
接口：/api/chl-wms?bbox=...&width=...&height=...&time=...
NOAA ERDDAP 未开 CORS，浏览器前端直接请求会被拦截，故走后端代理（服务器请求无 CORS 限制）
数据源：erdMH1chla1day_R2022NRT（Aqua MODIS L3SMI 4km 日合成，全球无缝）
"""
import requests
from flask import Response
import time as _time
import threading
import math

ERDDAP_WMS = "https://coastwatch.pfeg.noaa.gov/erddap/wms/erdMH1chla1day_R2022NRT/request"

# 内存缓存：相同 time+bbox 的结果缓存 6 小时（叶绿素日合成，避免重复调 ERDDAP 慢）
_cache = {}

def _merc_to_lonlat(x, y):
    lon = x / 20037508.34 * 180.0
    lat = math.degrees(math.atan(math.sinh(y / 20037508.34 * math.pi)))
    return lon, lat

def _warm_tiles():
    """预热：拉取中国海 zoom 5 的瓦片存缓存（学生首次进入命中，不用串行调 ERDDAP）
    模拟前端 zoom 5 中国海（经度 100-135，纬度 0-40）的瓦片 bbox（EPSG3857 米坐标）
    """
    # zoom 5 = 32x32 瓦片。中国海经度 100-135 → x 瓦片 13~17，纬度 0-40 → y 瓦片 12~16
    import datetime
    # 用最近有数据的日期（今天-2，跟前端默认一致）
    today = datetime.date.today()
    ds = (today - datetime.timedelta(days=2)).strftime("%Y-%m-%d")
    time_str = ds + "T12:00:00Z"
    warmed = 0
    for x in range(13, 18):
        for y in range(12, 17):
            # 瓦片 bbox（米坐标）：x 范围 = (x/32-0.5)*2*20037508 ~ ((x+1)/32-0.5)*2*20037508
            x1 = (x / 32.0 - 0.5) * 2 * 20037508.34
            x2 = ((x + 1) / 32.0 - 0.5) * 2 * 20037508.34
            y1 = (0.5 - (y + 1) / 32.0) * 2 * 20037508.34
            y2 = (0.5 - y / 32.0) * 2 * 20037508.34
            bbox = "%s,%s,%s,%s" % (x1, y1, x2, y2)
            args = {"service": "WMS", "request": "GetMap",
                    "layers": "erdMH1chla1day_R2022NRT:chlorophyll",
                    "styles": "", "format": "image/png", "transparent": "true",
                    "version": "1.1.1", "time": time_str,
                    "width": "256", "height": "256", "srs": "EPSG:3857", "bbox": bbox}
            try:
                content, err, status = proxy_chl_wms(args)
                if content:
                    warmed += 1
            except Exception:
                pass
    return warmed

def _warm_loop():
    """后台线程：延迟 30 秒后预热（避免拖慢 gunicorn 启动），然后每小时预热一次"""
    _time.sleep(30)  # 等 gunicorn 起来后再预热
    while True:
        try:
            _warm_tiles()
        except Exception:
            pass
        _time.sleep(3600)

# 启动预热线程（Flask 首次 import 时启动）
_warm_thread = threading.Thread(target=_warm_loop, daemon=True)
_warm_thread.start()

def proxy_chl_wms(args):
    """转发 WMS GetMap 请求到 NOAA ERDDAP，返回 PNG bytes（或 None）
    args: 前端传来的 WMS 参数（bbox/width/height/time 等）
    """
    params = {
        "service": "WMS",
        "version": "1.3.0",
        "request": "GetMap",
        "layers": "erdMH1chla1day_R2022NRT:chlorophyll",
        "styles": "",
        "format": "image/png",
        "transparent": "true",
        "crs": "EPSG:4326",
    }
    # 从前端参数里取 bbox/width/height/time
    for k in ("bbox", "width", "height", "time"):
        v = args.get(k)
        if v:
            params[k] = v
    # 前端 L.tileLayer.wms 用默认 EPSG3857（Web Mercator），bbox 是米坐标（x1,y1,x2,y2）
    # 需转成经纬度（EPSG4326），再转成 ERDDAP WMS 1.3.0 需要的纬度在前格式（minlat,minlon,maxlat,maxlon）
    import math
    def merc_to_lonlat(x, y):
        lon = x / 20037508.34 * 180.0
        lat = math.degrees(math.atan(math.sinh(y / 20037508.34 * math.pi)))
        return lon, lat
    if "bbox" in params and "," in params["bbox"]:
        parts = params["bbox"].split(",")
        if len(parts) == 4:
            x1, y1, x2, y2 = parts
            try:
                lon1, lat1 = merc_to_lonlat(float(x1), float(y1))
                lon2, lat2 = merc_to_lonlat(float(x2), float(y2))
                # ERDDAP WMS 1.3.0 需要纬度在前：minlat,minlon,maxlat,maxlon
                params["bbox"] = "%s,%s,%s,%s" % (min(lat1, lat2), min(lon1, lon2), max(lat1, lat2), max(lon1, lon2))
            except (ValueError, TypeError):
                # 如果 bbox 不是 Web Mercator（已是经纬度），按经度在前→纬度在前转换
                lon1, lat1, lon2, lat2 = parts
                params["bbox"] = "%s,%s,%s,%s" % (lat1, lon1, lat2, lon2)
    if "bbox" not in params or "width" not in params or "height" not in params:
        return None, "缺少 bbox/width/height 参数", 400
    # 查缓存（key = time+bbox，相同请求不重新调 ERDDAP）
    cache_key = "%s|%s|%s" % (params.get("time", ""), params.get("bbox", ""), params.get("width", ""))
    cached = _cache.get(cache_key)
    if cached and _time.time() - cached[0] < 6 * 3600:
        return cached[1], None, 200
    try:
        r = requests.get(ERDDAP_WMS, params=params, timeout=30)
        if r.status_code != 200:
            return None, f"ERDDAP HTTP {r.status_code}", 502
        if r.headers.get("Content-Type", "").startswith("image/"):
            # 存缓存
            _cache[cache_key] = (_time.time(), r.content)
            return r.content, None, 200
        return None, "ERDDAP 返回非图片", 502
    except Exception as e:
        return None, str(e), 502
