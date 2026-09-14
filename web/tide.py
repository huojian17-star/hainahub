# -*- coding: utf-8 -*-
"""海纳 · 潮汐数据（星图地球数据云，动态签名认证）
从环境变量读 GEOVIS_SECRET_ID / GEOVIS_SECRET_KEY（脱敏，不写进代码/前端）
接口：/api/tide?portId=CHN01024 或 /api/tide?lat=117&lon=39
缓存：文件缓存（6 小时过期，过期自动重新调星图，保证更新不断）
"""
import os, time, uuid, hashlib, hmac, json, requests

GEOVIS_BASE = "https://api.geovisearth.com/meteorology/v1/weather/tide/cn/detail"
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "crawler", "data", "tide_cache")
CACHE_TTL = 6 * 60 * 60  # 6 小时过期（过期重新调星图，保证每天更新）

def _cache_path(key):
    return os.path.join(CACHE_DIR, key + ".json")

def _cache_get(key):
    """读缓存，未过期返回数据，过期返回 None"""
    try:
        p = _cache_path(key)
        if not os.path.exists(p):
            return None
        with open(p, encoding="utf-8") as f:
            obj = json.load(f)
        if time.time() - obj.get("time", 0) < CACHE_TTL:
            return obj.get("data")
        return None  # 过期
    except Exception:
        return None

def _cache_set(key, data):
    """写缓存"""
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(_cache_path(key), "w", encoding="utf-8") as f:
            json.dump({"time": time.time(), "data": data}, f, ensure_ascii=False)
    except Exception:
        pass

def _auth_params():
    """生成动态签名参数（HMAC-SHA256）"""
    secret_id = os.environ.get("GEOVIS_SECRET_ID", "")
    secret_key = os.environ.get("GEOVIS_SECRET_KEY", "")
    # 兜底：从 /etc/environment 读（gunicorn/systemd 可能不自动加载）
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

def _fetch_star(port_id=None, lat=None, lon=None):
    """实际调星图接口"""
    params = _auth_params()
    if not params:
        return {"ok": False, "error": "星图 token 未配置"}
    if port_id:
        url = f"{GEOVIS_BASE}/id"
        params["portId"] = port_id
    elif lat is not None and lon is not None:
        url = f"{GEOVIS_BASE}/local"
        params["location"] = f"{lon},{lat}"
    else:
        return {"ok": False, "error": "需提供 portId 或 lat/lon"}
    r = requests.get(url, params=params, timeout=15)
    if r.status_code != 200:
        return {"ok": False, "error": f"星图接口 HTTP {r.status_code}"}
    return r.json()

def get_tide(port_id=None, lat=None, lon=None):
    """调星图潮汐接口（带 6 小时缓存，过期自动重新调，保证更新不断）"""
    key = port_id if port_id else f"{lat}_{lon}"
    # 先查缓存
    cached = _cache_get(key)
    if cached:
        return cached
    # 缓存未命中/过期 → 调星图
    data = _fetch_star(port_id=port_id, lat=lat, lon=lon)
    if data.get("result"):  # 成功才缓存
        _cache_set(key, data)
    return data

if __name__ == "__main__":
    # 测试：塘沽 CHN01024
    data = get_tide(port_id="CHN01024")
    print(json.dumps(data, ensure_ascii=False, indent=2)[:1500])
