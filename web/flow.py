# -*- coding: utf-8 -*-
"""海纳 · 全球海流流场（星图地球数据云，动态签名认证）
接口：/api/ocean-flow?start=2026082517&end=2026082517
返回 U/V 分量 json（供前端 leaflet-wind 画流场）
数据源：全球海洋网格预报图层（星图），1 次/天更新，0.5° 网格
海陆掩膜：把陆地格点流速设 None（流线只在海洋显示，避免跑到陆地）
"""
import os, time, uuid, hashlib, hmac, json, requests

FLOW_BASE = "https://api.geovisearth.com/meteorology/v1/view/ocean/flow/current/current_speed/range"
# 海陆掩膜（720x360，0=海 1=陆），跟星图流场同分辨率
MASK_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "data", "land_mask.json")
_land_mask = None

def _load_land_mask():
    """加载海陆掩膜（0=海 1=陆），缓存"""
    global _land_mask
    if _land_mask is not None:
        return _land_mask
    try:
        with open(MASK_PATH, encoding="utf-8") as f:
            _land_mask = json.load(f)
    except Exception:
        _land_mask = {"mask": []}
    return _land_mask

def _apply_land_mask(flow_data):
    """把陆地格点流速设 None（flow_data 是数组 [U分量, V分量]）"""
    mask_obj = _load_land_mask()
    mask = mask_obj.get("mask", [])
    if not mask:
        return flow_data
    for comp in flow_data:
        data = comp.get("data", [])
        for idx, val in enumerate(data):
            if val is None:
                continue
            # 掩膜是行优先，跟流场数据一致（iy*nx+ix）
            row = idx // mask_obj.get("nx", 720)
            col = idx % mask_obj.get("nx", 720)
            if row < len(mask) and col < len(mask[row]) and mask[row][col] == 1:
                data[idx] = None  # 陆地格点，无流
    return flow_data

def _auth_params():
    """生成动态签名参数（HMAC-SHA256）"""
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

def get_flow(start=None, end=None):
    """调洋流接口，返回 U/V 分量 json（数组 2 元素）
    优先用 NOAA RTOFS 缓存（权威 + 完整），无则星图兜底
    start/end: yyyyMMddHH，缺省用当前小时
    """
    # 优先 RTOFS（权威 + 数据完整）
    try:
        from rtofs import get_flow as rtofs_get
        rtofs_data = rtofs_get()
        if rtofs_data:
            return {"status": 0, "result": rtofs_data, "source": "noaa_rtofs"}
    except Exception as e:
        pass  # RTOFS 失败，走星图兜底
    params = _auth_params()
    if not params:
        return {"ok": False, "error": "星图 token 未配置"}
    now = time.strftime("%Y%m%d%H")
    start = start or now
    end = end or now
    params["start"] = start
    params["end"] = end
    try:
        r = requests.get(FLOW_BASE, params=params, timeout=30)
        if r.status_code != 200:
            return {"ok": False, "error": f"星图接口 HTTP {r.status_code}"}
        d = r.json()
        if d.get("status") != 0:
            return {"ok": False, "error": f"星图接口 status {d.get('status')}"}
        # 下载流场 json（U/V 分量），应用海陆掩膜，返回处理好的数据
        urls = d.get("result", {}).get("urls", {})
        if not urls:
            return {"ok": False, "error": "星图接口无流场数据"}
        json_url = list(urls.values())[0]
        jr = requests.get(json_url, timeout=60)
        if jr.status_code != 200:
            return {"ok": False, "error": f"流场 json HTTP {jr.status_code}"}
        flow_data = jr.json()
        if isinstance(flow_data, list) and len(flow_data) >= 2:
            flow_data = _apply_land_mask(flow_data)
        return {"status": 0, "result": flow_data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    import json
    print(json.dumps(get_flow(), ensure_ascii=False)[:800])
