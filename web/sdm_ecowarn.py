# -*- coding: utf-8 -*-
"""海纳 · 智渔牧海 —— SDM 生态位预警（自研点1，v2 当季版）
用实时水质（sst/chl）+ 静态 depth 喂中国鱼种 SDM 模型，预测鱼种适宜性变化。
v2 关键修正：按当前月份路由到当季模型，基准取同季节气候态——
此前硬编码春季模型+春季基准，9 月演示会把正常季节洄游误判成水质恶化（假警报）。
预警触发时将摘要哈希写入本地区块链存证（自研点3），同点同鱼种同日只写一次。
接口：/api/ocean/ecowarn?lat=..&lon=..&species=..&season=..
数据源：ERDDAP 实时 sst/chl + ETOPO depth + SDM 模型（joblib）
"""
import os, json, math, time, datetime, threading, urllib.request
import numpy as np

# 模型目录（服务器 /opt/haina/web/data/sdm_models；本地 Temp 调试）
BASE = os.environ.get("SDM_MODEL_DIR", r"/tmp/haina_models")
# 若目录不存在则回退到服务器路径
if not os.path.isdir(BASE):
    BASE = "/opt/haina/web/data/sdm_models"
ERDDAP = "https://oceanwatch.pifsc.noaa.gov/erddap/griddap"
WEB_DIR = os.path.dirname(os.path.abspath(__file__))

SEASONS = ["spring", "summer", "autumn", "winter"]
SEASON_CN = {"spring": "春", "summer": "夏", "autumn": "秋", "winter": "冬"}
SEASON_FULL = {"spring": "春季", "summer": "夏季", "autumn": "秋季", "winter": "冬季"}

# 各鱼种已建成的季节模型（文件名规则 sdm_model_<sp>_<season>_cn.joblib）
SPECIES_SEASONS = {
    "xiaohuangyu": ["spring", "summer", "autumn", "winter"],
    "landianmajiao": ["spring", "summer", "autumn", "winter"],
    "dahuangyu": ["spring", "summer", "autumn", "winter"],
}
SPECIES_INFO = {
    "xiaohuangyu": {"cn": "小黄鱼", "sci": "Larimichthys polyactis"},
    "landianmajiao": {"cn": "蓝点马鲛", "sci": "Scomberomorus niphonius"},
    "dahuangyu": {"cn": "大黄鱼", "sci": "Larimichthys crocea"},
}

# 实时环境值缓存（同点 30 分钟内复用，三个鱼种并行调用只拉一次 ERDDAP）
_env_cache = {}
_env_lock = threading.Lock()
_ENV_TTL = 1800


def _model_file(sp, season):
    return "sdm_model_{}_{}_cn.joblib".format(sp, season)


def _pred_file(sp, season):
    return "sdm_prediction_{}_{}_cn.json".format(sp, season)


def current_season(d=None):
    m = (d or datetime.date.today()).month
    if 3 <= m <= 5:
        return "spring"
    if 6 <= m <= 8:
        return "summer"
    if 9 <= m <= 11:
        return "autumn"
    return "winter"


def _season_dist(a, b):
    ia, ib = SEASONS.index(a) * 3 + 1, SEASONS.index(b) * 3 + 1
    d0 = abs(ia - ib)
    return min(d0, 12 - d0)


def pick_season(sp, season=None):
    """返回 (实际使用的季节, 是否回退)。请求季节未建模时回退到月份距离最近的已建季节。"""
    avail = SPECIES_SEASONS.get(sp) or []
    if not avail:
        return None, True
    want = season if season in SEASONS else current_season()
    if want in avail:
        return want, False
    return min(avail, key=lambda s: _season_dist(s, want)), True


def _fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "HainaOceanPlatform/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace").strip().split("\n")


def get_realtime_env(lat, lon):
    """拉实时水质（sst/chl）+ depth，带 30 分钟进程内缓存（键=0.05° 网格）"""
    key = (round(lat * 20) / 20, round(lon * 20) / 20)
    with _env_lock:
        hit = _env_cache.get(key)
        if hit and time.time() - hit[0] < _ENV_TTL:
            return hit[1]
    env = {}
    lon360 = lon % 360
    # 实时 SST
    try:
        lines = _fetch(f"{ERDDAP}/CRW_sst_v3_1.csv?analysed_sst[last][({lat}):1:({lat})][({lon360}):1:({lon360})]")
        if len(lines) >= 3:
            v = float(lines[-1].split(",")[-1])
            if math.isfinite(v):
                env["sst"] = v
    except Exception:
        pass
    # 实时叶绿素（分层：SNPP → MODIS → 近8日双星合成，带溯源）
    try:
        import water_quality as _wq
        c = _wq._get_chl_layered(lat, lon)
        if c and c.get("value") is not None and math.isfinite(c["value"]):
            env["chl"] = c["value"]
            env["chl_src"] = c.get("source", "")
            env["chl_time"] = (c.get("time") or "")[:10]
    except Exception:
        pass
    # depth（静态）
    try:
        lines = _fetch(f"{ERDDAP}/ETOPO_2022_v1_60s.csv?z[({lat}):1:({lat})][({lon360}):1:({lon360})]")
        if len(lines) >= 3:
            v = float(lines[-1].split(",")[-1])
            if math.isfinite(v):
                env["depth"] = v
    except Exception:
        pass
    with _env_lock:
        _env_cache[key] = (time.time(), env)
    return env


def get_climate_baseline(pred_file, lat, lon):
    """从预测 JSON 取该点同季气候态基准概率（numpy 最近邻）"""
    try:
        d = json.load(open(os.path.join(BASE, pred_file), encoding="utf-8"))
        lats, lons = np.asarray(d["lat"], dtype=float), np.asarray(d["lon"], dtype=float)
        proba = np.asarray(d["proba"], dtype=float)
        i = int(np.argmin(np.abs(lats - lat)))
        j = int(np.argmin(np.abs(lons - lon)))
        return float(proba[i][j])
    except Exception:
        return None


# 链上存证去重：同点同鱼种同日只写一次
_chain_dedupe = {}
_chain_lock = threading.Lock()


def _write_chain_block(ctx):
    """预警摘要哈希写入本地区块链（自研点3），返回 {index, hash} 或 None"""
    try:
        from blockchain import Blockchain
        bc = Blockchain(os.path.join(WEB_DIR, "ocean_chain.db"))
        info = bc.add_block(ctx)
        bc.close()
        return info
    except Exception:
        return None


def _chain_stamp(cn, sci, lat, lon, season, proba, baseline, alert):
    today = datetime.date.today().isoformat()
    key = (cn, round(lat, 1), round(lon, 1))
    with _chain_lock:
        prev = _chain_dedupe.get(key)
        if prev and prev[0] == today:
            info = dict(prev[1])
            info["new"] = False
            return info
        ctx = {
            "type": "ecowarn_alert",
            "time": datetime.datetime.now().isoformat(timespec="seconds"),
            "species": cn, "sci": sci,
            "lat": round(lat, 3), "lon": round(lon, 3),
            "season": season,
            "suitability": round(proba, 4),
            "baseline": round(baseline, 4) if baseline is not None else None,
            "alert_level": alert["level"] if alert else "normal",
        }
        info = _write_chain_block(ctx)
        if info:
            _chain_dedupe[key] = (today, info)
            out = dict(info)
            out["new"] = True
            return out
    return None


def ecowarn(lat, lon, species="xiaohuangyu", season=None):
    """SDM 生态位预警（当季）：实时水质喂当季模型，对比同季气候态基准"""
    info = SPECIES_INFO.get(species)
    if not info:
        return {"ok": False, "error": "未知物种"}
    season_used, fallback = pick_season(species, season)
    if not season_used:
        return {"ok": False, "error": "该物种模型未就绪"}
    model_path = os.path.join(BASE, _model_file(species, season_used))
    if not os.path.exists(model_path):
        return {"ok": False, "error": "模型文件不存在"}
    import joblib
    clf = joblib.load(model_path)
    env = get_realtime_env(lat, lon)
    if "sst" not in env or "depth" not in env:
        return {"ok": False, "error": "实时环境值不足（缺 sst/depth）"}
    # 喂当季模型预测（chl 缺失时用近海典型值近似，但显式标注，不静默编数）
    chl_estimated = "chl" not in env
    chl = env.get("chl", 1.0)
    X = np.array([[env["depth"], env["sst"], chl]])
    proba = float(clf.predict_proba(X)[0][1])
    # 同季气候态基准
    baseline = get_climate_baseline(_pred_file(species, season_used), lat, lon)
    drop = (baseline - proba) if baseline is not None else None
    alert = None
    if drop is not None and drop > 0.3:
        alert = {"type": "habitat_decline", "level": "red",
                 "msg": "{} 适宜性 {}%，较{}同期气候态 {}% 明显下降，水质异常".format(
                     info["cn"], round(proba * 100), SEASON_CN[season_used], round(baseline * 100))}
    elif drop is not None and drop > 0.15:
        alert = {"type": "habitat_decline", "level": "yellow",
                 "msg": "{} 适宜性 {}%，较{}同期气候态 {}% 有所下降，建议关注".format(
                     info["cn"], round(proba * 100), SEASON_CN[season_used], round(baseline * 100))}
    chain = _chain_stamp(info["cn"], info["sci"], lat, lon, season_used, proba, baseline, alert) if alert else None
    return {
        "ok": True,
        "species": info["cn"], "sci": info["sci"], "lat": lat, "lon": lon,
        "season": season_used, "season_cn": SEASON_FULL[season_used], "season_fallback": fallback,
        "realtime": {"sst": env.get("sst"), "chl": env.get("chl"), "depth": env.get("depth"),
                     "chl_src": env.get("chl_src", ""), "chl_time": env.get("chl_time", ""),
                     "chl_estimated": chl_estimated},
        "suitability": proba, "baseline": baseline,
        "drop": drop, "alert": alert, "chain": chain,
    }


def explain_ecowarn(lat, lon, species="xiaohuangyu", season=None):
    """SDM 生态位预警的 AI 解读：用 DeepSeek 解读水质异常原因 + 鱼种影响 + 应对建议"""
    result = ecowarn(lat, lon, species, season)
    if not result.get("ok"):
        return result
    import requests
    key = os.environ.get("DEEPSEEK_API_KEY") or ""
    if not key:
        return {"ok": False, "error": "no DeepSeek key"}
    cn = result["species"]
    rt = result.get("realtime", {})
    suit = result.get("suitability")
    base = result.get("baseline")
    alert = result.get("alert")
    season_cn = result.get("season_cn", "")
    # RAG 检索：中国鱼种 + 海洋牧场水质预警知识
    kb_block = ""
    exa_block = ""
    exa_urls = []
    rag_sources = ""
    try:
        import sdm_rag
        query = "{} 水温 叶绿素 赤潮 缺氧 养殖 牧场".format(cn)
        kb_block = "\n".join(sdm_rag.retrieve(query, top_k=3))
        # 联网搜索物种生态数据（权威信源白名单，带来源 URL）
        sci = result.get("sci", "")
        if sci:
            exa_text, exa_urls = sdm_rag.fetch_exa(sci)
            if exa_text:
                exa_block = exa_text
                rag_sources = " | ".join(exa_urls[:2])
    except Exception:
        pass
    try:
        import sdm_rag as _sr
        style_sec = "\n【文风禁令（输出前逐条自查，命中即改）】\n" + _sr.STYLE_RULES + "\n"
    except Exception:
        style_sec = ""

    suit_txt = "{:.0f}%".format(suit * 100) if suit is not None else "无"
    base_txt = "{:.0f}%".format(base * 100) if base is not None else "无"
    prompt = """你是海洋牧场水质与渔业生态专家。基于以下海洋牧场水质监测和 SDM 生态位预警结果，用通俗但准确的中文解读「{cn}」的适宜性变化，重点解读「水质为什么异常、对鱼种有什么影响、养殖户该怎么应对」。

【实时水质】
- 海温: {sst}°C
- 叶绿素: {chl_txt}
- 水深: {depth} m

【SDM 生态位预警（{season}模型，对比同季气候态）】
- {cn} 当前适宜性: {suit}（{season}同期气候态基准 {base}）
- 预警: {alert}

【海洋学知识库（已核实，附文献来源）】
{kb}

【联网检索资料（权威信源检索，仍属二手材料，仅作补充）】
{exa}
{src}

【解读要求】
1. 用准确的海洋生态/养殖术语（冷水性/暖水性、适温范围、赤潮、缺氧等），不要模糊措辞
2. 结合知识库中「{cn}」的适温范围、洄游习性，解读当前水质下适宜性为什么变化；当前是{season}，注意区分季节规律与真实异常
3. 若涉及赤潮/缺氧（叶绿素高/水温高），说明成因（富营养化/溶氧下降）和危害
4. 给出养殖户可操作的应对建议（如增氧、调整投喂、关注赤潮、提前收捕）
5. 温度、盐度等关键数值以知识库为准（已对照文献核实）；联网检索资料仅用于补充背景细节。若两者冲突，明确指出冲突并采用知识库数值，不要折中或自造数值
6. 控制在 300 字内，分 2-3 段，用自然段落，不要 md 格式

{style}
【安全前置】内容安全合规，不涉及政治/敏感，不编造数据。若可能涉及风险，改为客观中性表述。

【输出】直接给解读文字，纯文本，不要 ** 加粗、不要标题、不要列表符号。""".format(
        cn=cn, sst=rt.get("sst", "无"), chl=rt.get("chl", "无"), depth=rt.get("depth", "无"),
        season=season_cn, suit=suit_txt, base=base_txt,
        chl_txt=(str(rt.get("chl")) + " mg/m³（" + str(rt.get("chl_time", "")) + " " + str(rt.get("chl_src", "")) + "）") if rt.get("chl") is not None else "缺失（近10日双星均无晴观测，按近海典型值 1.0 mg/m³ 近似参与建模，解读时请说明该不确定性）",
        alert=alert["msg"] if alert else "无异常",
        style=style_sec,
        kb=kb_block if kb_block else "无",
        exa=exa_block if exa_block else "无",
        src=("【资料来源】" + rag_sources) if rag_sources else "")
    payload = {
        "model": "deepseek-flash",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 500,
        "temperature": 0.7,
        "stream": False,
    }
    try:
        r = requests.post("https://api.deepseek.com/chat/completions", json=payload,
                          headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"}, timeout=60)
        if r.status_code != 200:
            return {"ok": False, "error": "DeepSeek " + str(r.status_code)}
        text = r.json()["choices"][0]["message"]["content"]
        return {"ok": True, "species": cn, "explain": text, "suitability": suit, "baseline": base,
                "alert": alert, "season": result.get("season"), "season_cn": season_cn}
    except Exception as e:
        return {"ok": False, "error": str(e)}
