# -*- coding: utf-8 -*-
"""海纳 · 全球静止卫星云图（NSMC WMS，官方公开，AccessConstraints: none）
接口：/api/nsmc-cloud-time（可用时间列表）/api/nsmc-cloud?datetime=xxx（返回云图图片）
数据源：NSMC 风云卫星 WMS（GEOS_IRX 全球 10.8μm 红外，每小时），官方公开无限制
"""
import requests

WMS_URL = "https://data.nsmc.org.cn/NSMCAPI/v1/nsmc/image/wms/compose"
DATATIME_URL = "https://data.nsmc.org.cn/nsmcapi/v1/nsmc/image/animation/datatime/mongodb"
DATACODE = "GEO_MULT_GBAL_L2_GGM_IRX_GLL_YYYYMMDD_HHmm_4000M.PNG"
# 缓存（时间列表缓存 10 分钟，图片缓存 30 分钟）
_time_cache = {"t": 0, "data": None}
_img_cache = {}

def get_cloud_times():
    """GEOS_IRX 可用时间列表（24 小时逐时次）"""
    global _time_cache
    import time
    now = time.time()
    if _time_cache["data"] and now - _time_cache["t"] < 600:
        return _time_cache["data"]
    try:
        r = requests.get(DATATIME_URL, params={"dataCode": DATACODE, "hourRange": "24"}, timeout=30)
        d = r.json()
        if d.get("returnCode") != 0:
            return {"ok": False, "error": f"NSMC datatime returnCode {d.get('returnCode')}"}
        ds = d.get("ds", [])
        times = [x["dataDate"] + x["dataTime"] for x in ds if x.get("dataDate") and x.get("dataTime")]
        result = {"ok": True, "times": times}
        _time_cache = {"t": now, "data": result}
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}

def get_cloud_image(datetime):
    """GetMap 返回云图图片（PNG bytes）。datetime 是北京时（datatime 返回），转 UTC 传 GetMap"""
    if not datetime:
        return None
    cache_key = datetime
    if cache_key in _img_cache:
        return _img_cache[cache_key]
    # datatime 返回北京时（YYYYMMDDhhmmss），GetMap 要 UTC（-8 小时）
    try:
        from datetime import datetime as dt, timedelta
        bj = dt.strptime(datetime, "%Y%m%d%H%M%S")
        utc = bj - timedelta(hours=8)
        utc_str = utc.strftime("%Y%m%d%H%M")
    except Exception:
        # 转换失败，用原值（可能已是 UTC）
        utc_str = datetime[:12]
    try:
        params = {
            "layers": "GEOS_IRX",
            "datetime": utc_str,
            "request": "GetMap",
            "bbox": "90,0,135,45",  # 中国附近（经纬度）
            "width": "512",
            "height": "512",
            "version": "1.1.0",
            "format": "png",
        }
        r = requests.get(WMS_URL, params=params, timeout=30)
        if r.status_code == 200 and r.content[:4] == b"\x89PNG":
            _img_cache[cache_key] = r.content
            return r.content
        return None
    except Exception:
        return None

if __name__ == "__main__":
    import json
    print(json.dumps(get_cloud_times(), ensure_ascii=False)[:300])
