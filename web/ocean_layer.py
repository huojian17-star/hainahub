# -*- coding: utf-8 -*-
"""海纳 · 全球海洋图层（星图地球数据云，动态签名认证）· 通用模块
支持：sst（海表温度）/ sss（海表盐度）/ current_speed（海流流速）
接口：/api/ocean-sss?start=...&end=...  /api/ocean-current?start=...&end=...
返回星图已配色的图层 webp 图 URL + 边界 json（供前端 L.imageOverlay 叠加）
数据源：全球海洋网格预报图层（星图 mfv），8km 分辨率
时间范围：过去 24 小时至未来 7 天，逐 1 小时，1 次/天更新
"""
import os, time, uuid, hashlib, hmac, json, requests

BASE = "https://api.geovisearth.com/meteorology/v1/view/ocean/mfv/current"
# 缓存（逐小时，缓存 30 分钟够；同一时次重复访问不重复调星图）
_cache = {}

def _auth_params():
    """生成动态签名参数（HMAC-SHA256），跟 flow.py/tide.py 一致"""
    secret_id = os.environ.get("GEOVIS_SECRET_ID", "")
    secret_key = os.environ.get("GEOVIS_SECRET_KEY", "")
    if not secret_id or not secret_key:
        try:
            with open("/etc/environment", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        k, v = line.split("=", 1)
                        v = v.strip().strip('"')
                        if k == "GEOVIS_SECRET_ID":
                            secret_id = v
                        elif k == "GEOVIS_SECRET_KEY":
                            secret_key = v
        except Exception:
            pass
    if not secret_id or not secret_key:
        return None
    client_id = str(uuid.uuid4())
    expire_time = int(time.time()) + 60 * 60 * 24  # 1 天有效
    str_to_sign = f"{secret_id}\n{client_id}\n{expire_time}"
    sign = hmac.new(secret_key.encode(), str_to_sign.encode(), hashlib.sha256).hexdigest()
    return {"secretId": secret_id, "clientId": client_id, "expireTime": expire_time, "sign": sign}

def get_layer(mete_code, start=None, end=None):
    """调星图图层接口，返回 {webp_url, bounds, time}
    mete_code: sst / sss / current_speed
    start/end: yyyyMMddHH，缺省用当前小时
    """
    params = _auth_params()
    if not params:
        return {"ok": False, "error": "星图 token 未配置"}
    now = time.strftime("%Y%m%d%H")
    start = start or now
    end = end or now
    cache_key = f"{mete_code}-{start}-{end}"
    if cache_key in _cache and time.time() - _cache[cache_key]["t"] < 1800:
        return _cache[cache_key]["data"]
    url = f"{BASE}/{mete_code}/range"
    params["start"] = start
    params["end"] = end
    try:
        r = requests.get(url, params=params, timeout=30)
        if r.status_code != 200:
            return {"ok": False, "error": f"星图接口 HTTP {r.status_code}"}
        d = r.json()
        if d.get("status") != 0:
            return {"ok": False, "error": f"星图接口 status {d.get('status')}"}
        urls = d.get("result", {}).get("urls", {})
        if not urls:
            return {"ok": False, "error": f"星图接口无 {mete_code} 数据"}
        first = list(urls.values())[0]
        if isinstance(first, list):
            webp_url = first[0]
            meta_url = first[1] if len(first) > 1 else None
        else:
            webp_url = first
            meta_url = None
        bounds = None
        if meta_url:
            try:
                mr = requests.get(meta_url, timeout=20)
                if mr.status_code == 200:
                    meta = mr.json()
                    bounds = {
                        "lonmin": meta.get("lonmin"),
                        "latmin": meta.get("latmin"),
                        "lonmax": meta.get("lonmax"),
                        "latmax": meta.get("latmax"),
                    }
            except Exception:
                pass
        result = {"ok": True, "webp_url": webp_url, "bounds": bounds, "time": start, "mete_code": mete_code}
        _cache[cache_key] = {"t": time.time(), "data": result}
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}

def get_sss(start=None, end=None):
    return get_layer("sss", start, end)

def get_current(start=None, end=None):
    return get_layer("current_speed", start, end)

if __name__ == "__main__":
    import json as _j
    print(_j.dumps(get_sss(), ensure_ascii=False)[:500])
    print(_j.dumps(get_current(), ensure_ascii=False)[:500])
