# -*- coding: utf-8 -*-
"""海纳 · 全球海表温度（SST）图层（星图地球数据云，动态签名认证）
接口：/api/ocean-sst?start=2026082610&end=2026082610
返回星图已配色的 SST 图层 webp 图 URL + 边界 json（供前端 L.imageOverlay 叠加）
数据源：全球海洋网格预报图层（星图 mfv），海表温度 meteCode=sst，8km 分辨率
时间范围：过去 24 小时至未来 7 天，逐 1 小时，1 次/天更新
"""
import os, time, uuid, hashlib, hmac, json, requests

SST_BASE = "https://api.geovisearth.com/meteorology/v1/view/ocean/mfv/current/sst/range"
# 缓存（SST 逐小时，缓存 30 分钟够；同一时次重复访问不重复调星图）
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

def get_sst(start=None, end=None):
    """调星图 SST 接口，返回 {webp_url, bounds, time}
    start/end: yyyyMMddHH，缺省用当前小时
    """
    params = _auth_params()
    if not params:
        return {"ok": False, "error": "星图 token 未配置"}
    now = time.strftime("%Y%m%d%H")
    start = start or now
    end = end or now
    # 缓存 key：时次
    cache_key = f"{start}-{end}"
    if cache_key in _cache and time.time() - _cache[cache_key]["t"] < 1800:
        return _cache[cache_key]["data"]
    params["start"] = start
    params["end"] = end
    try:
        r = requests.get(SST_BASE, params=params, timeout=30)
        if r.status_code != 200:
            return {"ok": False, "error": f"星图接口 HTTP {r.status_code}"}
        d = r.json()
        if d.get("status") != 0:
            return {"ok": False, "error": f"星图接口 status {d.get('status')}"}
        urls = d.get("result", {}).get("urls", {})
        if not urls:
            return {"ok": False, "error": "星图接口无 SST 数据"}
        # urls 值是 [webp, json] 列表
        first = list(urls.values())[0]
        if isinstance(first, list):
            webp_url = first[0]
            meta_url = first[1] if len(first) > 1 else None
        else:
            webp_url = first
            meta_url = None
        # 下载边界 json（含 lonmin/latmin/lonmax/latmax）
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
        result = {"ok": True, "webp_url": webp_url, "bounds": bounds, "time": start}
        _cache[cache_key] = {"t": time.time(), "data": result}
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    import json as _j
    print(_j.dumps(get_sst(), ensure_ascii=False)[:500])
