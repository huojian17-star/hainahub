# -*- coding: utf-8 -*-
"""海纳 · 海底地形（Bathymetry）图层代理（NOAA NCEI ETOPO 2022 ERDDAP WMS）
接口：/api/ocean-bathy?bbox=...&width=...&height=...
NOAA ERDDAP 未开 CORS，浏览器前端直接请求会被拦截，故走后端代理（服务器请求无 CORS 限制）
数据源：ETOPO_2022_v1_60s（NOAA NCEI ETOPO 2022，60 arc-second 全球海陆地形，CC0-1.0 公共领域）

投影处理：前端 Leaflet 用 EPSG3857（Web Mercator）计算瓦片 bbox（米坐标），但 ERDDAP WMS
只支持 EPSG4326（经纬度投影）。若直接把 EPSG4326 图返回给 Leaflet，两种投影不一致会拼接错位。
故后端请求 ERDDAP 返回 EPSG4326 图后，用 numpy 向量化重投影成 EPSG3857 瓦片，前端才能正确拼接。
"""
import requests
from flask import Response
import time as _time
import threading
import math
import io
import os
import numpy as np
from PIL import Image

ERDDAP_WMS = "https://oceanwatch.pifsc.noaa.gov/erddap/wms/ETOPO_2022_v1_60s/request"
LAYER = "ETOPO_2022_v1_60s:z"

# 内存缓存：相同 bbox+width 的结果缓存 6 小时（海底地形静态，避免重复调 ERDDAP 慢）
_cache = {}
_cache_lock = threading.Lock()

# 磁盘缓存：瓦片 PNG 存本地文件（跨 worker 共享，首次调 ERDDAP 慢，之后读文件秒开）
# 目录：web/data/bathy_cache/（文件名 = bbox+width+height 的 md5）
import hashlib as _hashlib
_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "bathy_cache")
os.makedirs(_CACHE_DIR, exist_ok=True)


def _cache_path(bbox, width, height):
    """磁盘缓存文件路径：bbox+width+height 的 md5"""
    key = "%s|%s|%s" % (bbox, width, height)
    return os.path.join(_CACHE_DIR, _hashlib.md5(key.encode("utf-8")).hexdigest() + ".png")

# Web Mercator 常数
MERC = 20037508.34


def _merc_to_lonlat(x, y):
    lon = x / MERC * 180.0
    lat = math.degrees(math.atan(math.sinh(y / MERC * math.pi)))
    return lon, lat


def _reproject_3857(src_arr, lon1, lat1, lon2, lat2, W, H, src_lon_min=None, src_lon_max=None):
    """把 EPSG4326 源图（src_arr, shape=(src_h,src_w,4)）重投影成 EPSG3857 的 WxH 瓦片。
    lon1/lat1 是 bbox 左下角，lon2/lat2 是右上角（经纬度，输出瓦片的经纬度范围）。
    src_lon_min/src_lon_max 是源图（ERDDAP 返回）的经度范围，默认等于输出瓦片经度范围。
    西半球时 ERDDAP 用 0-360 经度返回，源图经度范围与输出瓦片经度范围不同，需单独传入。
    对输出每个像素中心，反算米坐标 -> 经纬度 -> 源图像素坐标，采样颜色。numpy 向量化。
    """
    src_h, src_w = src_arr.shape[:2]
    lon_min, lon_max = min(lon1, lon2), max(lon1, lon2)
    lat_min, lat_max = min(lat1, lat2), max(lat1, lat2)
    # 源图经度范围（西半球用 0-360，需单独传入；默认同输出瓦片）
    if src_lon_min is None:
        src_lon_min = lon_min
    if src_lon_max is None:
        src_lon_max = lon_max
    # 输出瓦片对应的米坐标范围
    x1_m = lon_min / 180.0 * MERC
    x2_m = lon_max / 180.0 * MERC
    y1_m = _lat_to_merc(lat_min)
    y2_m = _lat_to_merc(lat_max)
    xs = x1_m + (np.arange(W) + 0.5) / W * (x2_m - x1_m)  # (W,)
    ys = y2_m - (np.arange(H) + 0.5) / H * (y2_m - y1_m)  # (H,)
    # 米 -> 经纬度（向量化）
    lons = xs / MERC * 180.0  # (W,)
    lats = np.degrees(np.arctan(np.sinh(ys / MERC * np.pi)))  # (H,)
    # 经纬度 -> 源图像素坐标
    # 源图（ERDDAP WMS EPSG4326）第 0 行 = 北（顶部），第 src_h-1 行 = 南（底部）
    # 输出瓦片第 0 行 = 北（顶部），第 H-1 行 = 南（底部）
    # 故：输出顶部（北）-> 源图顶部（第 0 行），输出底部（南）-> 源图底部（src_h-1）
    # 西半球：源图经度为 0-360（src_lon_min 大），输出瓦片经度为负，需把输出经度加 360 对齐源图经度
    sx_lons = lons
    if src_lon_min > lon_max + 180:  # 源图 0-360 经度，输出负经度（西半球）
        sx_lons = lons + 360.0
    sx = (sx_lons[None, :] - src_lon_min) / (src_lon_max - src_lon_min) * (src_w - 1)  # (1, W)
    sy = (lat_max - lats[:, None]) / (lat_max - lat_min) * (src_h - 1)  # (H, 1)
    sx = np.clip(sx, 0, src_w - 1).astype(int)
    sy = np.clip(sy, 0, src_h - 1).astype(int)
    return src_arr[sy, sx]  # (H, W, 4)


def _lat_to_merc(lat):
    return math.log(math.tan((90 + lat) * math.pi / 360.0)) / (math.pi / 180.0) * MERC / 180.0


def _warm_tiles():
    """预热：拉取中国海常见缩放范围的瓦片存缓存（学生首次进入命中，不用串行调 ERDDAP）
    覆盖 zoom 5（默认视图）+ zoom 6（放大一级）的中国海区域，用户常见操作命中缓存
    用 Web Mercator 瓦片坐标公式计算（lat/lon -> tile x/y）
    """
    warmed = 0

    def lon_to_tilex(lon, zoom):
        return int((lon / 360.0 + 0.5) * (2 ** zoom))

    def lat_to_tiley(lat, zoom):
        import math as _m
        n = 2 ** zoom
        lat_r = _m.radians(lat)
        return int((1.0 - _m.log(_m.tan(lat_r) + 1 / _m.cos(lat_r)) / _m.pi) / 2.0 * n)

    def warm_bbox(x, y, zoom):
        n = 2 ** zoom
        x1 = (x / n - 0.5) * 2 * MERC
        x2 = ((x + 1) / n - 0.5) * 2 * MERC
        y1 = (0.5 - (y + 1) / n) * 2 * MERC
        y2 = (0.5 - y / n) * 2 * MERC
        return "%s,%s,%s,%s" % (x1, y1, x2, y2)

    # zoom 5：中国海（lon 100-135, lat 0-40）
    z5 = 5
    for x in range(lon_to_tilex(100, z5), lon_to_tilex(135, z5) + 1):
        for y in range(lat_to_tiley(40, z5), lat_to_tiley(0, z5) + 1):
            args = {"bbox": warm_bbox(x, y, z5), "width": "256", "height": "256"}
            try:
                content, err, status = proxy_bathy_wms(args)
                if content:
                    warmed += 1
            except Exception:
                pass
    # zoom 6：中国海核心（lon 100-135, lat 0-40）
    z6 = 6
    for x in range(lon_to_tilex(100, z6), lon_to_tilex(135, z6) + 1):
        for y in range(lat_to_tiley(40, z6), lat_to_tiley(0, z6) + 1):
            args = {"bbox": warm_bbox(x, y, z6), "width": "256", "height": "256"}
            try:
                content, err, status = proxy_bathy_wms(args)
                if content:
                    warmed += 1
            except Exception:
                pass
    return warmed


def _warm_loop():
    """后台线程：延迟 30 秒后预热（避免拖慢 gunicorn 启动），然后每小时预热一次"""
    _time.sleep(30)
    while True:
        try:
            _warm_tiles()
        except Exception:
            pass
        _time.sleep(3600)


# 启动预热线程（Flask 首次 import 时启动）
_warm_thread = threading.Thread(target=_warm_loop, daemon=True)
_warm_thread.start()


def proxy_bathy_wms(args):
    """转发 WMS GetMap 请求到 NOAA ERDDAP，返回重投影后的 EPSG3857 PNG bytes（或 None）
    args: 前端传来的 WMS 参数（bbox/width/height）
    """
    bbox = args.get("bbox", "")
    width = int(args.get("width", "256") or 256)
    height = int(args.get("height", "256") or 256)
    if not bbox or "," not in bbox:
        return None, "缺少 bbox 参数", 400
    parts = bbox.split(",")
    if len(parts) != 4:
        return None, "bbox 格式不对", 400
    try:
        x1_m, y1_m, x2_m, y2_m = [float(p) for p in parts]
    except ValueError:
        return None, "bbox 数值无效", 400
    # 前端 L.tileLayer.wms 用 EPSG3857（Web Mercator），bbox 是米坐标
    # 转成经纬度（EPSG4326），得到该瓦片的经纬度范围
    lon1, lat1 = _merc_to_lonlat(x1_m, y1_m)
    lon2, lat2 = _merc_to_lonlat(x2_m, y2_m)
    lon_min, lon_max = min(lon1, lon2), max(lon1, lon2)
    lat_min, lat_max = min(lat1, lat2), max(lat1, lat2)
    # 查缓存（key = bbox+width+height，海底地形静态）
    cache_key = "%s|%s|%s" % (bbox, width, height)
    with _cache_lock:
        cached = _cache.get(cache_key)
        if cached and _time.time() - cached[0] < 6 * 3600:
            return cached[1], None, 200
    # 查磁盘缓存（跨 worker 共享，首次调 ERDDAP 慢，之后读文件秒开）
    disk_path = _cache_path(bbox, width, height)
    if os.path.exists(disk_path):
        try:
            with open(disk_path, "rb") as f:
                disk_content = f.read()
            with _cache_lock:
                _cache[cache_key] = (_time.time(), disk_content)
            return disk_content, None, 200
        except Exception:
            pass  # 磁盘读失败则重新调 ERDDAP
    # ERDDAP ETOPO WMS 不支持负经度（西半球），必须用 0-360 经度表示
    # 若 lon_min < 0（西半球），把经度统一加 360 转成 0-360 范围请求
    req_lon_min, req_lon_max = lon_min, lon_max
    if lon_min < 0:
        req_lon_min = lon_min + 360
        req_lon_max = lon_max + 360
    # 请求 ERDDAP 返回该经纬度范围的 EPSG4326 图
    params = {
        "service": "WMS",
        "version": "1.1.1",
        "request": "GetMap",
        "layers": LAYER,
        "styles": "",
        "format": "image/png",
        "transparent": "true",
        "srs": "EPSG:4326",
        "bbox": "%s,%s,%s,%s" % (req_lon_min, lat_min, req_lon_max, lat_max),
        "width": str(width),
        "height": str(height),
    }
    try:
        r = requests.get(ERDDAP_WMS, params=params, timeout=30)
        if r.status_code != 200:
            return None, f"ERDDAP HTTP {r.status_code}", 502
        if not r.headers.get("Content-Type", "").startswith("image/"):
            return None, "ERDDAP 返回非图片", 502
        # 重投影成 EPSG3857 瓦片
        src = Image.open(io.BytesIO(r.content)).convert("RGBA")
        src_arr = np.array(src)
        out_arr = _reproject_3857(src_arr, lon_min, lat_min, lon_max, lat_max, width, height, req_lon_min, req_lon_max)
        out_img = Image.fromarray(out_arr)
        buf = io.BytesIO()
        out_img.save(buf, format="PNG")
        content = buf.getvalue()
        with _cache_lock:
            _cache[cache_key] = (_time.time(), content)
        # 写磁盘缓存（跨 worker 共享，下次直接读文件不用调 ERDDAP）
        try:
            with open(disk_path, "wb") as f:
                f.write(content)
        except Exception:
            pass
        return content, None, 200
    except Exception as e:
        return None, str(e), 502
