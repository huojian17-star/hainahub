# -*- coding: utf-8 -*-
"""海纳 · 台风实况与预报（星图地球数据云，动态签名认证）
接口：/api/typhoon/list（当前活跃台风）/api/typhoon/detail?tpId=xxx（台风详情路径）
数据源：星图全球台风实况与预报（api.geovisearth.com/meteorology/v1/weather/typhoon），同 SST/盐度/流速域名
"""
import os, time, uuid, hashlib, hmac, json, requests

BASE = "https://api.geovisearth.com/meteorology/v1/weather/typhoon"
# 缓存（台风列表/详情，缓存 30 分钟）
_cache = {}

def _auth_params():
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
    expire_time = int(time.time()) + 60 * 60 * 24
    str_to_sign = f"{secret_id}\n{client_id}\n{expire_time}"
    sign = hmac.new(secret_key.encode(), str_to_sign.encode(), hashlib.sha256).hexdigest()
    return {"secretId": secret_id, "clientId": client_id, "expireTime": expire_time, "sign": sign}

def get_typhoon_list(year=None):
    """台风列表（指定年份，默认当前年份）。返回当年全部台风（含 active 字段）"""
    cache_key = f"list-{year or 'current'}"
    if cache_key in _cache and time.time() - _cache[cache_key]["t"] < 1800:
        return _cache[cache_key]["data"]
    params = _auth_params()
    if not params:
        return {"ok": False, "error": "星图 token 未配置"}
    params["year"] = year or time.strftime("%Y")
    try:
        r = requests.get(BASE + "/year/list", params=params, timeout=30)
        if r.status_code != 200:
            return {"ok": False, "error": f"星图接口 HTTP {r.status_code}"}
        d = r.json()
        if d.get("status") != 0:
            return {"ok": False, "error": f"星图接口 status {d.get('status')}: {d.get('message','')}"}
        datas = d.get("result", {}).get("datas", [])
        result = {"ok": True, "typhoons": datas, "year": params["year"]}
        _cache[cache_key] = {"t": time.time(), "data": result}
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}

def get_typhoon_detail(tp_id):
    """台风详情（实况路径 rtPoints + 预报路径 fcPoints）"""
    if not tp_id:
        return {"ok": False, "error": "缺少 tpId"}
    cache_key = f"detail-{tp_id}"
    if cache_key in _cache and time.time() - _cache[cache_key]["t"] < 1800:
        return _cache[cache_key]["data"]
    params = _auth_params()
    if not params:
        return {"ok": False, "error": "星图 token 未配置"}
    params["tpId"] = tp_id
    try:
        r = requests.get(BASE + "/info/detail", params=params, timeout=30)
        if r.status_code != 200:
            return {"ok": False, "error": f"星图接口 HTTP {r.status_code}"}
        d = r.json()
        if d.get("status") != 0:
            return {"ok": False, "error": f"星图接口 status {d.get('status')}: {d.get('message','')}"}
        result = {"ok": True, "typhoon": d.get("result", {})}
        _cache[cache_key] = {"t": time.time(), "data": result}
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    import json as _j
    print(_j.dumps(get_typhoon_list(), ensure_ascii=False)[:400])
    lst = get_typhoon_list()
    if lst.get("typhoons"):
        print(_j.dumps(get_typhoon_detail(lst["typhoons"][0]["tpId"]), ensure_ascii=False)[:400])
