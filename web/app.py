# -*- coding: utf-8 -*-
"""海纳 · 首页 + 资讯 API + 详情页 + 论坛联通（Flask 一体服务）
首页 :5050/，详情页 :5050/article/<id>，API :5050/api/*
论坛 :8000（Flarum 容器）
"""
import os, sys, re, time, requests, json, uuid, smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "crawler"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # 确保能 import 同目录的 tide.py

from flask import Flask, render_template, request, jsonify, abort, send_from_directory, Response
from store import query_articles, get_conn, get_article, set_discussion, init_db, count_articles, query_jobs, count_jobs, get_related_articles, job_filters, get_job, set_job_discussion, expire_jobs, insert_ocean_post, query_ocean_posts, get_ocean_post, insert_ocean_comment, query_ocean_comments, register_user, get_user_by_username, set_user_token, get_user_by_token, query_pending_posts, query_pending_comments, set_post_status, set_comment_status, update_user_avatar, update_user_bio, get_user_profile, delete_user_token
from werkzeug.security import generate_password_hash, check_password_hash

init_db()  # 建表/迁移（discussion_url 列）

WEB_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__,
            static_folder=os.path.join(WEB_DIR, "static"),
            template_folder=os.path.join(WEB_DIR, "templates"))
app.config["TEMPLATES_AUTO_RELOAD"] = True  # 开发期模板改动即时生效

FORUM_BASE = os.environ.get("FORUM_BASE", "http://localhost:8000")
AMAP_KEY = os.environ.get("AMAP_KEY", "")
FORUM_ADMIN = {
    "identification": os.environ.get("FORUM_USER", ""),
    "password": os.environ.get("FORUM_PASS", ""),
}
DISCUSS_TAG_ID = "2"  # 资讯热议 分类
JOB_DISCUSS_TAG_ID = "3"  # 就业实习 分类（岗位讨论帖放这里）

SRC_LOGO = {
    "大连海事大学": "/static/img/source-logo-dlmu.png",
    "中科院海洋所": "/static/img/source-logo-qdio.png",
    "自然资源部": "/static/img/source-logo-mnr.png",
    "浙江海洋大学": "/static/img/source-logo-zjou.png",
    "上海海洋大学": "/static/img/source-logo-shou.png",
    "广东海洋大学": "/static/img/source-logo-gdou.png",
    "中国海洋大学": "/static/img/source-logo-ouc.svg",
    "国家海洋信息中心": "/static/img/source-logo-nmdis.png",
    "海洋二所(杭州)": "/static/img/source-logo-sio.png",
    "中国极地研究中心": "/static/img/source-logo-pric.png",
    "海纳解读": "/static/img/logo-white.svg",
    "海纳科普": "/static/img/favicon.svg",
}

_token_cache = {"token": None, "at": 0}


def _forum_token():
    """取 Flarum admin token（缓存 50 分钟）"""
    if _token_cache["token"] and time.time() - _token_cache["at"] < 3000:
        return _token_cache["token"]
    r = requests.post(FORUM_BASE + "/api/token", json=FORUM_ADMIN, timeout=10)
    r.raise_for_status()
    _token_cache["token"] = r.json()["token"]
    _token_cache["at"] = time.time()
    return _token_cache["token"]


def _hostname(url):
    try:
        return re.sub(r"^www\.", "", requests.utils.urlparse(url).hostname or "")
    except Exception:
        return ""


def _ensure_discussion(article_id):
    """懒创建：查 articles.discussion_url，无则调 Flarum API 建帖，回存"""
    art = get_article(article_id)
    if not art:
        return None
    if art["discussion_url"]:
        return art["discussion_url"]
    token = _forum_token()
    title = art["title"][:70]
    content = (
        f"**原文链接：** {art['url']}\n\n"
        f"**来源：** {art['source']}（{art.get('date', '')}）\n\n"
        f"> 本讨论帖由海纳自动为资讯创建，点击上方原文链接可查看完整内容。"
    )
    payload = {
        "data": {
            "type": "discussions",
            "attributes": {"title": title, "content": content},
            "relationships": {"tags": {"data": [{"type": "tags", "id": DISCUSS_TAG_ID}]}},
        }
    }
    r = requests.post(FORUM_BASE + "/api/discussions", json=payload,
                      headers={"Authorization": "Token " + token}, timeout=15)
    if r.status_code not in (200, 201):
        return None
    slug = (r.json().get("data", {}).get("attributes", {}) or {}).get("slug", "")
    if not slug:
        return None
    url = f"{FORUM_BASE}/d/{slug}"
    set_discussion(article_id, url)
    return url


def _ensure_job_discussion(job_id):
    """懒创建岗位讨论帖：查 jobs.discussion_url，无则调 Flarum API 建帖（就业实习分类），回存"""
    job = get_job(job_id)
    if not job:
        return None
    if job["discussion_url"]:
        return job["discussion_url"]
    token = _forum_token()
    title = (job["title"] or f"岗位 {job_id}")[:70]
    lines = []
    if job.get("unit"): lines.append(f"**单位：** {job['unit']}")
    if job.get("unit_type"): lines.append(f"**类型：** {job['unit_type']}")
    if job.get("major"): lines.append(f"**专业：** {job['major']}")
    if job.get("education"): lines.append(f"**学历：** {job['education']}")
    if job.get("region"): lines.append(f"**地点：** {job['region']}")
    if job.get("headcount"): lines.append(f"**人数：** {job['headcount']}")
    if job.get("salary"): lines.append(f"**待遇：** {job['salary']}")
    if job.get("deadline"): lines.append(f"**截止：** {job['deadline']}")
    if job.get("description"): lines.append(job["description"])
    lines.append(f"**原文链接：** {job['url']}")
    lines.append("> 想匿名聊聊这岗的待遇/工作情况？直接回复即可，游客也能匿名发。")
    content = "\n\n".join(lines)
    payload = {
        "data": {
            "type": "discussions",
            "attributes": {"title": title, "content": content},
            "relationships": {"tags": {"data": [{"type": "tags", "id": JOB_DISCUSS_TAG_ID}]}},
        }
    }
    r = requests.post(FORUM_BASE + "/api/discussions", json=payload,
                      headers={"Authorization": "Token " + token}, timeout=15)
    if r.status_code not in (200, 201):
        return None
    slug = (r.json().get("data", {}).get("attributes", {}) or {}).get("slug", "")
    if not slug:
        return None
    url = f"{FORUM_BASE}/d/{slug}"
    set_job_discussion(job_id, url)
    return url


@app.after_request
def no_cache(resp):
    """开发期禁用浏览器缓存，避免旧 CSS/JS 残留。
    但 /api/ocean-flow 是公开洋流数据（RTOFS 6 小时更新），允许缓存减少流量
    """
    if resp.headers.get("Cache-Control", "").find("max-age") == -1:
        resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/news")
def news_page():
    return render_template("news.html")

@app.route("/search")
def search_page():
    return render_template("search.html")

@app.route("/roadmap")
def roadmap_page():
    return render_template("roadmap.html")

@app.route("/quiz")
def quiz_page():
    return render_template("quiz.html")

@app.route("/quiz/result")
def quiz_result_page():
    return render_template("quiz_result.html")
@app.route("/ocean")
def ocean_page():
    return render_template("ocean.html")

@app.route("/ocean-data")
def ocean_data_page():
    """Ocean data hub: resource pool dashboard"""
    return render_template("ocean_data.html")


@app.route("/ocean-sdm")
def ocean_sdm_page():
    return render_template("sdm.html")


@app.route("/api/sdm/explain")
def sdm_explain():
    """大模型分析：读 SDM 预测结果 + 当前环境因子滑块值，调 DeepSeek 生成生态机制解读
    解读「为什么当前环境值下概率上升/下降」"""
    species = request.args.get("species", "cod")
    # 当前环境因子滑块值（前端传入）
    cur_env = {
        "sst": request.args.get("sst", ""),
        "depth": request.args.get("depth", ""),
        "chl": request.args.get("chl", ""),
        "sal": request.args.get("sal", ""),
        "sla": request.args.get("sla", ""),
    }
    # 点击点经纬度（区位分析）
    click_lat = request.args.get("lat", "")
    click_lon = request.args.get("lon", "")
    sdm_dir = os.path.join(WEB_DIR, "static", "data", "sdm")
    # 物种数据文件映射
    files = {
        "cod": {"pred": "sdm_prediction3.json", "resp": "sdm_response5.json"},
        "haddock": {"pred": "sdm_prediction_haddock.json", "resp": "sdm_response_haddock.json"},
        "herring": {"pred": "sdm_prediction_herring.json", "resp": "sdm_response_herring.json"},
        "mackerel": {"pred": "sdm_prediction_mackerel.json", "resp": "sdm_response_mackerel.json"},
        "halibut": {"pred": "sdm_prediction_halibut.json", "resp": "sdm_response_halibut.json"},
    }
    if species not in files:
        return jsonify({"error": "unknown species"}), 400
    try:
        def load(name):
            with open(os.path.join(sdm_dir, name), encoding="utf-8") as f:
                return json.load(f)
        pred = load(files[species]["pred"])
        resp = load(files[species]["resp"])
        comp = None
        try:
            comp = load("sdm_comparison.json")
        except Exception:
            comp = None
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    key = os.environ.get("DEEPSEEK_API_KEY") or ""
    if not key:
        return jsonify({"error": "no key"}), 500
    species_name = {"cod": "大西洋鳕", "haddock": "黑线鳕", "herring": "鲱鱼", "mackerel": "鲭鱼", "halibut": "比目鱼"}.get(species, species)

    # 构建 prompt（海洋生态解读）
    imp = pred.get("feature_importance", {})
    imp_str = ", ".join(f"{k}: {v:.2f}" for k, v in imp.items()) if imp else "无"
    curve_summary = ""
    if resp and resp.get("curves"):
        parts = []
        for f, curve in resp["curves"].items():
            probs = [p["prob"] for p in curve]
            parts.append(f"{f}: {min(probs):.2f}~{max(probs):.2f}")
        curve_summary = "; ".join(parts)
    comp_str = ""
    if comp and comp.get("comparison"):
        sst = comp["comparison"].get("sst", [])
        if sst:
            cod_max = max(sst, key=lambda x: x["cod"])
            had_max = max(sst, key=lambda x: x["haddock"])
            comp_str = f"大西洋鳕 SST 峰值 {cod_max['value']:.0f}°C(概率{cod_max['cod']*100:.0f}%), 黑线鳕峰值 {had_max['value']:.0f}°C(概率{had_max['haddock']*100:.0f}%)"

    # 当前环境值 + 各因子响应曲线在该值的位置（上升/下降/峰值）
    def interp(curve, value):
        try:
            v = float(value)
        except (TypeError, ValueError):
            return None
        if not curve:
            return None
        if v <= curve[0]["value"]:
            return curve[0]["prob"]
        if v >= curve[-1]["value"]:
            return curve[-1]["prob"]
        for i in range(len(curve) - 1):
            if curve[i]["value"] <= v <= curve[i + 1]["value"]:
                t = (v - curve[i]["value"]) / (curve[i + 1]["value"] - curve[i]["value"])
                return curve[i]["prob"] + t * (curve[i + 1]["prob"] - curve[i]["prob"])
        return None
    cur_str = ""
    if resp and resp.get("curves"):
        for f in ["sst", "depth", "chl", "sal", "sla"]:
            if cur_env.get(f) and f in resp["curves"]:
                p = interp(resp["curves"][f], cur_env[f])
                if p is not None:
                    # 判断在曲线的位置（找峰值）
                    curve = resp["curves"][f]
                    peak = max(curve, key=lambda x: x["prob"])
                    pos = "峰值附近" if abs(float(cur_env[f]) - peak["value"]) < abs(curve[-1]["value"] - curve[0]["value"]) * 0.1 else ("上升段" if float(cur_env[f]) < peak["value"] else "下降段")
                    cur_str += f"{f}={cur_env[f]}(概率{p*100:.0f}%, {pos}); "

    # 海域判断（根据点击点经纬度）
    def sea_region(lat, lon):
        try:
            lat_f = float(lat); lon_f = float(lon)
        except (TypeError, ValueError):
            return ""
        # 优先判断更具体的海域（地中海/美国东海岸）
        if 30 <= lat_f <= 45 and -6 <= lon_f <= 36:
            return "地中海"
        if 30 <= lat_f <= 45 and -80 <= lon_f <= -60:
            return "美国东海岸外海"
        # 北大西洋海域判断
        if 35 <= lat_f <= 82 and -70 <= lon_f <= 40:
            if 35 <= lat_f <= 45 and -10 <= lon_f <= 6:
                return "比斯开湾/伊比利亚半岛以西海域"
            if 50 <= lat_f <= 62 and -10 <= lon_f <= 10:
                return "北海/英吉利海峡"
            if 60 <= lat_f <= 75 and -30 <= lon_f <= 20:
                return "挪威海/巴伦支海"
            if 55 <= lat_f <= 75 and -50 <= lon_f <= -20:
                return "格陵兰-冰岛海域"
            if 40 <= lat_f <= 55 and -70 <= lon_f <= -40:
                return "北美东海岸/纽芬兰海域"
            return "北大西洋"
        return ""
    sea = sea_region(click_lat, click_lon)

    # RAG 检索：通用海洋学知识（关键词命中）+ 物种维基百科生态数据（带来源）
    query = species_name + " " + sea + " " + " ".join([f for f in cur_env if cur_env.get(f)]) + " " + " ".join([k for k, v in imp.items() if v > 0.1])
    kb_block = ""
    exa_block = ""
    exa_urls = []
    rag_sources = ""
    try:
        import sdm_rag
        kb_block = "\n".join(sdm_rag.retrieve(query, top_k=3))
        # 物种具体生态数据（Exa 权威信源检索，带来源 URL）
        exa_text, exa_urls = sdm_rag.fetch_exa(species)
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

    prompt = f"""你是海洋生态学专家。基于以下 SDM（物种分布模型）预测结果、当前环境因子值和海洋学知识库，用通俗但准确的中文解读「{species_name}」的生态分布机制，重点解读「为什么当前环境值下概率上升/下降」。

【预测数据】
- 环境因子重要性: {imp_str}
- 响应曲线(各因子概率范围): {curve_summary}
- 多物种对比(竞争释放): {comp_str if comp_str else '无'}
- 当前环境值(概率, 曲线位置): {cur_str if cur_str else '无'}
- 点击位置: {sea if sea else '未知'} (经纬度 {click_lat}, {click_lon})

【海洋学知识库（已核实，附文献来源）】
{kb_block if kb_block else '无'}

【联网检索资料（权威信源，仍属二手材料，仅作补充）】
{exa_block if exa_block else '无'}
{('【资料来源】' + rag_sources) if rag_sources else ''}

【解读要求】
1. 结合海洋学知识库，用准确的海洋生态术语：冷水性/暖水性鱼类、适温范围、产卵场、索饵洄游等（不要用「较暖/较冷」这种模糊措辞误导）
2. 说明主导因子（如海温/水深）及原因
3. 重点解读：当前环境值下概率是上升还是下降？为什么？（如海温 16°C 超出适温峰值 11°C → 概率下降，因为冷水性鱼类高温抑制代谢/产卵）
4. 结合点击位置的海域特征（如地中海是半封闭暖水海域、北海是冷水陆架区）分析该海域是否适合该物种（可判断地中海暖水不适合冷水性鳕鱼）
5. 如有对比，说明两物种生态位差异（谁更耐冷/耐深）
6. 用海洋生态学原理解释，不编造数据，详细解释，控制在 500 字内，用准确的生态学术语，不要硬凑字数。分 2-3 个自然段，段与段之间用换行分隔
7. 温度、盐度等关键数值以知识库为准（已对照文献核实）；联网检索资料仅用于补充背景。若两者冲突，明确指出冲突并采用知识库数值，不要折中或自造数值

{style_sec}
【安全前置检查】输出前先自查：内容必须安全合规——不涉及政治/敏感话题、不编造数据、不传播虚假/误导信息、不含违法内容。若当前输出可能涉及上述风险，改为输出客观、中性的生态科普表述，不输出任何违规内容。

【输出】直接给解读文字，纯文本，不要用 ** 加粗、不要用 md 格式、不要标题、不要列表符号，用自然段落。"""
    payload = {
        "model": "deepseek-flash",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 800,
        "temperature": 0.7,
        "stream": True,
    }
    try:
        r = requests.post("https://api.deepseek.com/chat/completions", json=payload, stream=True,
                          headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"}, timeout=60)
        if r.status_code == 200:
            # SSE 流式返回：透传 DeepSeek 的 SSE 流，前端逐 chunk 显示（打字机效果）
            def gen():
                # send source urls first for frontend provenance display
                if rag_sources:
                    yield "data: " + json.dumps({"sources": exa_urls[:2]}, ensure_ascii=False) + "\n\n"
                for chunk in r.iter_lines(decode_unicode=True):
                    if chunk and chunk.startswith("data: "):
                        data_str = chunk[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            d = json.loads(data_str)
                            delta = d["choices"][0].get("delta", {}).get("content", "")
                            if delta:
                                yield "data: " + json.dumps({"explain": delta}, ensure_ascii=False) + "\n\n"
                        except Exception:
                            pass
            return Response(gen(), mimetype="text/event-stream")
        return jsonify({"error": "api " + str(r.status_code)}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/transfer")
def transfer_page():
    return render_template("transfer.html")

@app.route("/job-map")
def job_map_page():
    return render_template("job_map.html")

@app.route("/salary")
def salary_page():
    return render_template("salary.html")

@app.route("/guide")
def guide_page():
    import json
    import os
    p = os.path.join(os.path.dirname(__file__), "data", "guide.json")
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    return render_template("guide.html", majors=data["majors"])

@app.route("/guide/<mid>")
def guide_detail(mid):
    import json
    import os
    p = os.path.join(os.path.dirname(__file__), "data", "guide.json")
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    major = next((m for m in data["majors"] if m["id"] == mid), None)
    if not major:
        return "未找到该专业", 404
    return render_template("guide_detail.html", m=major)

@app.route("/api/salary")
def api_salary():
    path = os.path.join(os.path.dirname(__file__), "..", "crawler", "data", "salary_majors.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


@app.route("/api/tide")
def api_tide():
    """潮汐数据（星图地球数据云，动态签名）。参数：portId 或 lat+lon"""
    from tide import get_tide
    port_id = request.args.get("portId", "")
    lat = request.args.get("lat", "")
    lon = request.args.get("lon", "")
    if port_id:
        data = get_tide(port_id=port_id)
    elif lat and lon:
        try:
            data = get_tide(lat=float(lat), lon=float(lon))
        except ValueError:
            return jsonify({"ok": False, "error": "经纬度格式不对"}), 400
    else:
        return jsonify({"ok": False, "error": "需提供 portId 或 lat/lon"}), 400
    return jsonify(data)


@app.route("/api/ocean-flow")
def api_ocean_flow():
    """全球海流流场（NOAA RTOFS，权威）。参数：start/end（yyyyMMddHH，可空）
    gzip 压缩 + 6 小时缓存（RTOFS 6 小时更新，减少服务器流量）
    """
    import gzip
    from flow import get_flow
    start = request.args.get("start", "")
    end = request.args.get("end", "")
    data = get_flow(start=start or None, end=end or None)
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    # gzip 压缩（数据 7.8MB → ~2.4MB，大幅减少流量）
    if len(body) > 1024:
        body = gzip.compress(body, 6)
        resp = Response(body, mimetype="application/json")
        resp.headers["Content-Encoding"] = "gzip"
    else:
        resp = Response(body, mimetype="application/json")
    # RTOFS 数据 6 小时不变，浏览器缓存 6 小时（重复访问不重新下载）    resp.headers["Cache-Control"] = "public, max-age=21600"
    return resp


@app.route("/api/ocean-gfs")
def api_ocean_gfs():
    """全球风场（NOAA GFS，10 米风，权威预报）。返回 0.5° 网格 U/V 风场（供 leaflet-wind 画流场）
    gzip 压缩 + 6 小时缓存（GFS 每 6 小时更新）
    """
    import gzip
    from gfs import get_gfs
    data = get_gfs()
    if not data:
        return jsonify({"ok": False, "error": "GFS 获取失败"})
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    if len(body) > 1024:
        body = gzip.compress(body, 6)
        resp = Response(body, mimetype="application/json")
        resp.headers["Content-Encoding"] = "gzip"
    else:
        resp = Response(body, mimetype="application/json")
    return resp


@app.route("/api/ocean-sst")
def api_ocean_sst():
    """全球海表温度（SST）图层（星图）。参数：start/end（yyyyMMddHH，可空）
    返回星图已配色的 webp 图层图 URL + 边界（供前端 L.imageOverlay 叠加）
    """
    from sst import get_sst
    start = request.args.get("start", "")
    end = request.args.get("end", "")
    data = get_sst(start=start or None, end=end or None)
    return jsonify(data)


@app.route("/api/ocean-sss")
def api_ocean_sss():
    """全球海表盐度（SSS）图层（星图）。参数：start/end（yyyyMMddHH，可空）"""
    from ocean_layer import get_sss
    start = request.args.get("start", "")
    end = request.args.get("end", "")
    data = get_sss(start=start or None, end=end or None)
    return jsonify(data)


@app.route("/api/ocean-current")
def api_ocean_current():
    """全球海流流速图层（星图 current_speed）。参数：start/end（yyyyMMddHH，可空）"""
    from ocean_layer import get_current
    start = request.args.get("start", "")
    end = request.args.get("end", "")
    data = get_current(start=start or None, end=end or None)
    return jsonify(data)


@app.route("/api/ocean-expert/agg")
def api_ocean_expert_agg():
    """OceanExpert 聚合数据（地图国家圆点）。institutes + experts 各返回
    [{country,latitude,longitude,count}]。海纳后端代理，用户不碰官网。"""
    from ocean_expert import get_agg
    return jsonify(get_agg())


@app.route("/api/ocean-expert/country")
def api_ocean_expert_country():
    """OceanExpert 国家详情（代理搜索）。参数：country（国家名）、type（experts/institutions）、page。"""
    from ocean_expert import get_country_detail
    country = request.args.get("country", "")
    typ = request.args.get("type", "experts")
    page = request.args.get("page", "1")
    if not country:
        return jsonify({"ok": False, "error": "缺少 country 参数"})
    return jsonify(get_country_detail(country, typ, page))


@app.route("/api/ocean-expert/detail")
def api_ocean_expert_detail():
    """OceanExpert 单条详情（代理）。参数：type（expert/institute）、id。"""
    from ocean_expert import get_expert_detail, get_institute_detail
    typ = request.args.get("type", "expert")
    oid = request.args.get("id", "")
    if not oid:
        return jsonify({"ok": False, "error": "缺少 id 参数"})
    if typ == "institute":
        return jsonify(get_institute_detail(oid))
    return jsonify(get_expert_detail(oid))


@app.route("/api/typhoon/list")
def api_typhoon_list():
    """台风列表（星图）。参数：year（可空，默认当前年份）"""
    from typhoon import get_typhoon_list
    year = request.args.get("year", "")
    return jsonify(get_typhoon_list(year=year or None))


@app.route("/api/typhoon/detail")
def api_typhoon_detail():
    """台风详情（实况+预报路径，星图）。参数：tpId"""
    from typhoon import get_typhoon_detail
    tp_id = request.args.get("tpId", "")
    return jsonify(get_typhoon_detail(tp_id))


@app.route("/api/typhoon/news")
def api_typhoon_news():
    """台风实时动态资讯（按台风名查 articles 表 typhoon_name）。参数：name"""
    from store import get_conn
    name = request.args.get("name", "").strip()
    if not name:
        return jsonify({"ok": False, "error": "缺少 name 参数"})
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, title, url, source, date FROM articles WHERE typhoon_name = ? ORDER BY date DESC, id DESC LIMIT 20",
        (name,),
    ).fetchall()
    conn.close()
    articles = [{"id": r[0], "title": r[1], "url": r[2], "source": r[3], "date": r[4]} for r in rows]
    return jsonify({"ok": True, "name": name, "articles": articles})


@app.route("/api/nsmc-cloud-time")
def api_nsmc_cloud_time():
    """NSMC GEOS_IRX 云图可用时间列表"""
    from nsmc_cloud import get_cloud_times
    return jsonify(get_cloud_times())


@app.route("/api/nsmc-cloud")
def api_nsmc_cloud():
    """NSMC GEOS_IRX 云图图片（GetMap 代理，返回 PNG）。参数：datetime"""
    from nsmc_cloud import get_cloud_image
    datetime = request.args.get("datetime", "")
    img = get_cloud_image(datetime)
    if not img:
        return jsonify({"ok": False, "error": "云图获取失败"}), 404
    return Response(img, mimetype="image/png")


@app.route("/api/chl-wms")
def api_chl_wms():
    """叶绿素 WMS 代理（NOAA ERDDAP 未开 CORS，浏览器直接请求被拦截，走后端代理）
    转发 WMS GetMap 参数到 NOAA ERDDAP，返回 PNG
    """
    from chl import proxy_chl_wms
    content, err, status = proxy_chl_wms(request.args)
    if err:
        return jsonify({"ok": False, "error": err}), status
    resp = Response(content, mimetype="image/png")
    resp.headers["Cache-Control"] = "no-store"  # time 参数变化，不能缓存（nginx 缓存会导致 time 不生效）
    return resp


@app.route("/api/ocean-water")
def api_ocean_water():
    """智渔牧海 · 实时水质感知（ERDDAP 实时 sst/chl，聚焦中国牧场区）"""
    from water_quality import get_water_quality, get_farm_points
    try:
        lat = request.args.get("lat", "")
        lon = request.args.get("lon", "")
        if lat and lon:
            return jsonify({"ok": True, "data": get_water_quality(lat, lon)})
        # 无 lat/lon 时返回牧场点位列表
        return jsonify({"ok": True, "points": get_farm_points()})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/ocean-water/alert")
def api_ocean_water_alert():
    """智渔牧海 · 水质预警（阈值 + 缺氧反演，自研）"""
    from water_quality import get_water_quality
    from water_alert import assess_all
    try:
        lat = request.args.get("lat", "")
        lon = request.args.get("lon", "")
        if not lat or not lon:
            return jsonify({"ok": False, "error": "missing lat/lon"}), 400
        wq = get_water_quality(lat, lon)
        if not wq:
            return jsonify({"ok": False, "error": "no data"}), 404
        result = assess_all(wq.get("sst"), wq.get("chl"))
        result["lat"] = float(lat); result["lon"] = float(lon)
        result["sst"] = wq.get("sst"); result["chl"] = wq.get("chl")
        return jsonify({"ok": True, "data": result})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500



@app.route("/api/ocean/ecowarn")
def api_ocean_ecowarn():
    """智渔牧海 · SDM 生态位预警（实时水质喂 SDM 模型，预测鱼种适宜性变化）"""
    from sdm_ecowarn import ecowarn
    try:
        lat = request.args.get("lat", "")
        lon = request.args.get("lon", "")
        species = request.args.get("species", "xiaohuangyu")
        if not lat or not lon:
            return jsonify({"ok": False, "error": "missing lat/lon"}), 400
        return jsonify(ecowarn(float(lat), float(lon), species, request.args.get("season")))
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/ocean/ecowarn/explain")
def api_ocean_ecowarn_explain():
    """智渔牧海 · SDM 生态位预警的 AI 解读（DeepSeek 解读水质异常原因+鱼种影响+应对）"""
    from sdm_ecowarn import explain_ecowarn
    try:
        lat = request.args.get("lat", "")
        lon = request.args.get("lon", "")
        species = request.args.get("species", "xiaohuangyu")
        if not lat or not lon:
            return jsonify({"ok": False, "error": "missing lat/lon"}), 400
        return jsonify(explain_ecowarn(float(lat), float(lon), species, request.args.get("season")))
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/ocean-bathy")
def api_ocean_bathy():
    """海底地形 WMS 代理（NOAA NCEI ETOPO 2022 ERDDAP 未开 CORS，走后端代理）
    转发 WMS GetMap 参数到 NOAA ERDDAP，返回 PNG
    """
    from bathymetry import proxy_bathy_wms
    content, err, status = proxy_bathy_wms(request.args)
    if err:
        return jsonify({"ok": False, "error": err}), status
    resp = Response(content, mimetype="image/png")
    # 不用 public max-age：动态瓦片接口若被 CDN 缓存，会返回旧版（重投影修复后 CDN 仍返回旧版导致错位）
    # 用 no-store 确保每次返回最新版（海底地形静态，后端有内存缓存，不慢）
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/api/ocean-depth")
def api_ocean_depth():
    """海底地形水深点查询（ETOPO griddap）。参数：lat、lon
    返回该点水深（米，负值=海底深度，正值=陆地海拔）
    """
    from depth import get_depth
    lat = request.args.get("lat", "")
    lon = request.args.get("lon", "")
    if not lat or not lon:
        return jsonify({"ok": False, "error": "需提供 lat/lon"}), 400
    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except ValueError:
        return jsonify({"ok": False, "error": "经纬度格式不对"}), 400
    if lat_f < -90 or lat_f > 90 or lon_f < -180 or lon_f > 180:
        return jsonify({"ok": False, "error": "经纬度超出范围"}), 400
    result = get_depth(lat_f, lon_f)
    if not result:
        return jsonify({"ok": False, "error": "该点无水深数据"}), 404
    return jsonify({"ok": True, "depth": result["depth"], "lat": result["lat"], "lon": result["lon"]})


# ============ 海洋生物图鉴（WoRMS 分类 + Wikimedia CC 图片 + OBIS 分布） ============
import sqlite3 as _sqlite3

_SPECIES_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "species.db")


def _get_species_db():
    """取物种数据库连接（每次新建，避免多线程共享问题）"""
    conn = _sqlite3.connect(_SPECIES_DB)
    conn.row_factory = _sqlite3.Row
    return conn


@app.route("/api/species/list")
def api_species_list():
    """海洋生物图鉴物种列表（id/学名/中文名/分类/中文分类/图片/OBIS 总数）"""
    try:
        from species_cn import cn_name
        conn = _get_species_db()
        rows = conn.execute(
            "SELECT id, scientificname, cn_name, phylum, class, ordr, family, image_url, license, obis_total FROM species ORDER BY phylum, class, scientificname"
        ).fetchall()
        conn.close()
        species = []
        for r in rows:
            d = dict(r)
            # 加中文分类名（分类树节点显示中文，不会英文的游客能看懂）
            d["phylum_cn"] = cn_name("phylum", d.get("phylum"))
            d["class_cn"] = cn_name("class", d.get("class"))
            d["ordr_cn"] = cn_name("ordr", d.get("ordr"))
            d["family_cn"] = cn_name("family", d.get("family"))
            species.append(d)
        return jsonify({"ok": True, "species": species})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/species/<int:sid>")
def api_species_detail(sid):
    """海洋生物图鉴物种详情（含图片/授权/作者/分类）"""
    try:
        conn = _get_species_db()
        row = conn.execute("SELECT * FROM species WHERE id=?", (sid,)).fetchone()
        conn.close()
        if not row:
            return jsonify({"ok": False, "error": "未找到该物种"}), 404
        return jsonify({"ok": True, "species": dict(row)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/species/<int:sid>/distribution")
def api_species_distribution(sid):
    """海洋生物图鉴物种分布（OBIS 拉取，返回经纬度点）
    加磁盘缓存：分布点 JSON 存 data/species_dist_cache/<sid>.json，二次请求直接读，不重复调 OBIS（慢）
    """
    import json as _json
    try:
        conn = _get_species_db()
        row = conn.execute("SELECT scientificname FROM species WHERE id=?", (sid,)).fetchone()
        conn.close()
        if not row:
            return jsonify({"ok": False, "error": "未找到该物种"}), 404
        sci = row["scientificname"]
        # 查磁盘缓存（分布点静态，避免每次调 OBIS 慢）
        dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "species_dist_cache")
        os.makedirs(dist_dir, exist_ok=True)
        cache_path = os.path.join(dist_dir, "%d.json" % sid)
        if os.path.exists(cache_path):
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = _json.load(f)
            return jsonify({"ok": True, "total": cached.get("total", 0), "points": cached.get("points", [])})
        from marine_species import fetch_obis_distribution
        obis = fetch_obis_distribution(sci, limit=200)
        if not obis:
            return jsonify({"ok": True, "total": 0, "points": []})
        # 写磁盘缓存
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                _json.dump({"total": obis["total"], "points": obis["points"]}, f)
        except Exception:
            pass
        return jsonify({"ok": True, "total": obis["total"], "points": obis["points"]})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/admin")
def admin_page():
    return render_template("admin.html")


@app.route("/baidu_verify_<name>.html")
def baidu_verify(name):
    """百度搜索资源平台验证文件（根目录直出，send_from_directory 防路径穿越）"""
    return send_from_directory(os.path.join(WEB_DIR, "static"), f"baidu_verify_{name}.html")


@app.route("/sitemap.xml")
def sitemap_xml():
    """动态 sitemap：静态页 + 资讯 + 岗位（实时生成，永远最新）"""
    from xml.sax.saxutils import escape
    base = request.url_root.rstrip("/")
    urls = [
        "/", "/jobs", "/news", "/ocean", "/transfer", "/salary",
        "/guide", "/roadmap", "/quiz", "/search",
    ]
    items = []
    for u in urls:
        items.append(f"<url><loc>{base}{u}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>")
    conn = get_conn()
    arts = conn.execute("SELECT id, date FROM articles ORDER BY id DESC LIMIT 500").fetchall()
    jobs = conn.execute("SELECT id, COALESCE(publish_date, '') FROM jobs ORDER BY id DESC LIMIT 500").fetchall()
    conn.close()
    for aid, adate in arts:
        lastmod = f"<lastmod>{escape(adate or '')}</lastmod>" if adate else ""
        items.append(f"<url><loc>{base}/article/{aid}</loc>{lastmod}<changefreq>weekly</changefreq><priority>0.7</priority></url>")
    for jid, jdate in jobs:
        lastmod = f"<lastmod>{escape(jdate or '')}</lastmod>" if jdate else ""
        items.append(f"<url><loc>{base}/job/{jid}</loc>{lastmod}<changefreq>weekly</changefreq><priority>0.7</priority></url>")
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(items) + "\n</urlset>"
    return Response(xml, mimetype="application/xml")


@app.route("/robots.txt")
def robots_txt():
    body = "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: " + request.url_root.rstrip("/") + "/sitemap.xml\n"
    return Response(body, mimetype="text/plain")


def _require_admin():
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    user = get_user_by_token(token)
    if not user or not user.get("is_admin"):
        return None
    return user


@app.route("/api/admin/pending")
def api_admin_pending():
    if not _require_admin():
        return jsonify({"ok": False, "error": "无权限"}), 403
    posts = query_pending_posts()
    comments = query_pending_comments()
    return jsonify({"ok": True, "posts": posts, "comments": comments})


@app.route("/api/admin/review", methods=["POST"])
def api_admin_review():
    if not _require_admin():
        return jsonify({"ok": False, "error": "无权限"}), 403
    data = request.get_json(silent=True) or {}
    kind = data.get("kind")  # post / comment
    rid = data.get("id")
    action = data.get("action")  # approve / reject
    if kind not in ("post", "comment") or action not in ("approve", "reject"):
        return jsonify({"ok": False, "error": "参数错误"}), 400
    status = "approved" if action == "approve" else "rejected"
    if kind == "post":
        set_post_status(int(rid), status)
    else:
        set_comment_status(int(rid), status)
    return jsonify({"ok": True})


@app.route("/jobs")
def jobs_page():
    return render_template("jobs.html")


def _csv_arg(name):
    """逗号分隔参数 → 列表（去空去重）"""
    raw = request.args.get(name, "")
    return [x.strip() for x in raw.split(",") if x.strip()] or None


@app.route("/api/jobs")
def api_jobs():
    try:
        limit = min(int(request.args.get("limit", 100)), 300)
    except ValueError:
        limit = 100
    try:
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        offset = 0
    status = request.args.get("status", "active")
    if status not in ("active", "expired", "all"):
        status = "active"
    sort = request.args.get("sort", "latest")
    if sort not in ("latest", "deadline", "unit"):
        sort = "latest"
    items = query_jobs(
        majors=_csv_arg("majors"),
        unit_types=_csv_arg("unit_types"),
        educations=_csv_arg("educations"),
        regions=_csv_arg("regions"),
        deadline_filter=request.args.get("deadline_filter", "all"),
        status=status,
        sort=sort,
        limit=limit, offset=offset,
        q=(request.args.get("q") or "").strip(),
        salary_filter=request.args.get("salary_filter", "all"),
    )
    total = count_jobs(
        majors=_csv_arg("majors"),
        unit_types=_csv_arg("unit_types"),
        educations=_csv_arg("educations"),
        regions=_csv_arg("regions"),
        deadline_filter=request.args.get("deadline_filter", "all"),
        status=status,
        q=(request.args.get("q") or "").strip(),
        salary_filter=request.args.get("salary_filter", "all"),
    )
    return jsonify({"ok": True, "total": total, "count": len(items), "items": items})


@app.route("/api/job_filters")
def api_job_filters():
    return jsonify({"ok": True, **job_filters()})


@app.route("/preview")
def preview_page():
    """Logo 预览页（开发期用，上线前移除）"""
    return render_template("preview.html")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/content")
def content():
    return render_template("content.html")


@app.route("/article/<int:article_id>")
def article(article_id):
    import re as _re
    art = get_article(article_id)
    if not art:
        abort(404)
    related = get_related_articles(article_id, art["category"])
    # 给正文 content 里的 <img> 加 referrerpolicy="no-referrer"，绕过图片来源站防盗链
    # （如中国青年网 cycnet 只允许不带 Referer 或来源站域名访问）
    content = art.get("content") or ""
    if content:
        content = _re.sub(
            r'(<img\b(?![^>]*\breferrerpolicy=)[^>]*?)>',
            r'\1 referrerpolicy="no-referrer">',
            content,
            flags=_re.IGNORECASE,
        )
    return render_template("article.html", article={**art, "id": article_id, "content": content},
                           related=related,
                           logo=SRC_LOGO.get(art["source"], ""), domain=_hostname(art["url"]))


@app.route("/journal/<int:journal_id>")
def journal_detail(journal_id):
    """期刊分级详情页：读 journals.json 找对应 id"""
    import json as _json
    path = os.path.join(WEB_DIR, "static", "data", "journals.json")
    try:
        with open(path, encoding="utf-8") as f:
            journals = _json.load(f)
    except Exception:
        abort(404)
    j = next((x for x in journals if x.get("id") == journal_id), None)
    if not j:
        abort(404)
    return render_template("journal.html", j=j)


@app.route("/journals")
def journals_page():
    """期刊分级列表页（完整目录 + 分类筛选）"""
    return render_template("journals.html")


@app.route("/job/<int:job_id>")
def job_detail(job_id):
    job = get_job(job_id)
    if not job:
        abort(404)
    return render_template("job.html", job=job, domain=_hostname(job["url"]))


@app.route("/api/job_discussion_status")
def job_discussion_status():
    job = get_job(request.args.get("job_id", 0, type=int))
    if not job:
        return jsonify({"ok": False})
    return jsonify({"ok": True, "url": job["discussion_url"] or None})


@app.route("/api/ensure_job_discussion")
def ensure_job_discussion():
    job_id = request.args.get("job_id", 0, type=int)
    url = _ensure_job_discussion(job_id)
    return jsonify({"ok": bool(url), "url": url})


@app.route("/api/discussion_status")
def discussion_status():
    art = get_article(request.args.get("article_id", 0, type=int))
    if not art:
        return jsonify({"ok": False})
    return jsonify({"ok": True, "url": art["discussion_url"] or None})


@app.route("/api/ensure_discussion")
def ensure_discussion():
    article_id = request.args.get("article_id", 0, type=int)
    url = _ensure_discussion(article_id)
    return jsonify({"ok": bool(url), "url": url})


@app.route("/api/news")
def api_news():
    source = request.args.get("source", "")
    category = request.args.get("category", "")
    # "海纳解读"是 source 字段（不是 category），分类 tab 点它时按 source 筛
    if category == "海纳解读":
        source = "海纳解读"
        category = ""
    try:
        limit = min(int(request.args.get("limit", 60)), 200)
    except ValueError:
        limit = 60
    try:
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        offset = 0
    items = query_articles(source=source or None, category=category or None, limit=limit, offset=offset)
    total = count_articles(source=source or None, category=category or None)
    return jsonify({"ok": True, "count": len(items), "total": total, "items": items})


@app.route("/api/filters")
def api_filters():
    conn = get_conn()
    rows = conn.execute("SELECT source, category, COUNT(*) FROM articles GROUP BY source, category").fetchall()
    conn.close()
    sources, categories = {}, {}
    for s, c, cnt in rows:
        sources.setdefault(s, 0)
        sources[s] += cnt
        categories.setdefault(c, 0)
        categories[c] += cnt
    return jsonify({"ok": True, "sources": sources, "categories": categories})


@app.route("/api/search")
def api_search():
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"ok": True, "query": "", "articles": [], "jobs": [], "guide": []})
    # 模糊搜索：拆单字子序列匹配，简称/漏字也能命中
    pattern = "%" + "%".join(c for c in q if c.strip()) + "%"
    conn = get_conn()
    arts = conn.execute(
        "SELECT id, title, source, category, date FROM articles "
        "WHERE title LIKE ? OR content LIKE ? ORDER BY date DESC LIMIT 12",
        (pattern, pattern)).fetchall()
    jobs = conn.execute(
        "SELECT id, title, unit, major, region, education FROM jobs "
        "WHERE status='active' AND (title LIKE ? OR unit LIKE ? OR description LIKE ? OR major LIKE ?) "
        "ORDER BY id DESC LIMIT 12",
        (pattern, pattern, pattern, pattern)).fetchall()
    conn.close()

    guide = []
    import os as _os
    _p = _os.path.join(_os.path.dirname(__file__), "data", "guide.json")
    with open(_p, encoding="utf-8") as _f:
        _data = json.load(_f)
    for m in _data["majors"]:
        hit = q in m["name"] or q in m.get("intro", "")
        for c in m["certs"]:
            if q in c["name"] or q in c.get("what", "") or q in c.get("use", ""):
                hit = True
        for it in m["internships"]:
            if q in it["name"] or q in it["detail"]:
                hit = True
        for t in m["transfers"]:
            if q in t["name"] or q in t["detail"]:
                hit = True
        if hit:
            guide.append({"id": m["id"], "name": m["name"]})

    return jsonify({
        "ok": True,
        "query": q,
        "articles": [{"id": r[0], "title": r[1], "source": r[2], "category": r[3], "date": r[4]} for r in arts],
        "jobs": [{"id": r[0], "title": r[1], "unit": r[2], "major": r[3], "region": r[4], "education": r[5]} for r in jobs],
        "guide": guide,
    })


@app.route("/api/stats")
def api_stats():
    conn = get_conn()
    total = conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
    today = conn.execute("SELECT COUNT(*) FROM articles WHERE date(fetched_at) = date('now','localtime')").fetchone()[0]
    jobs_total = conn.execute("SELECT COUNT(*) FROM jobs WHERE status = 'active'").fetchone()[0]
    jobs_today = conn.execute("SELECT COUNT(*) FROM jobs WHERE status = 'active' AND date(fetched_at) = date('now','localtime')").fetchone()[0]
    conn.close()
    return jsonify({"ok": True, "total": total, "today": today,
                    "jobs_total": jobs_total, "jobs_today": jobs_today})


@app.route("/api/oceans")
def api_oceans():
    path = os.path.join(WEB_DIR, "static", "data", "oceans.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


@app.route("/api/ocean_feed")
def api_ocean_feed():
    region = request.args.get("region", "")
    units = request.args.get("units", "")
    unit_list = [u.strip() for u in units.split(",") if u.strip()]

    news = []
    for u in unit_list[:3]:
        try:
            rows = query_articles(source=u, limit=2)
        except TypeError:
            rows = query_articles(source=u, limit=2)
        news.extend(rows)

    jobs = []
    if region and region != "极地":
        try:
            jobs = query_jobs(regions=[region], limit=4)
        except Exception:
            jobs = []

    return jsonify({"ok": True, "news": news, "jobs": jobs})


def geocode(address):
    """地址 → 坐标（高德地理编码，location 为 "lng,lat"）。失败返回 None。"""
    try:
        r = requests.get(
            "https://restapi.amap.com/v3/geocode/geo",
            params={"address": address, "key": AMAP_KEY, "output": "json"},
            timeout=10,
        )
        data = r.json()
        if data.get("status") == "1" and data.get("geocodes"):
            loc = data["geocodes"][0]["location"]
            lng, lat = loc.split(",")
            return float(lat), float(lng)
    except Exception:
        pass
    return None


@app.route("/api/ocean/posts")
def api_ocean_posts():
    return jsonify({"ok": True, "posts": query_ocean_posts()})


@app.route("/api/ocean/post", methods=["POST"])
def api_ocean_post():
    text = request.form.get("text", "")
    address = request.form.get("address", "")
    file = request.files.get("image")
    if not file:
        return jsonify({"ok": False, "error": "缺少图片"}), 400
    # 登录鉴权：发帖必须登录
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    user = get_user_by_token(token)
    if not user:
        return jsonify({"ok": False, "error": "请先登录"}), 401
    nickname = user["username"]

    # 坐标：优先用手动点选的 lat/lng，否则地址地理编码
    lat = request.form.get("lat", "")
    lng = request.form.get("lng", "")
    if lat and lng:
        try:
            lat, lng = float(lat), float(lng)
        except ValueError:
            return jsonify({"ok": False, "error": "坐标无效"}), 400
    elif address:
        geo = geocode(address)
        if not geo:
            return jsonify({"ok": False, "error": "地址定位失败，请在地图上手动点选位置"}), 400
        lat, lng = geo
    else:
        return jsonify({"ok": False, "error": "请填写地址或在地图上点选位置"}), 400

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        return jsonify({"ok": False, "error": "仅支持 jpg / png / webp"}), 400

    udir = os.path.join(WEB_DIR, "static", "uploads", "ocean")
    os.makedirs(udir, exist_ok=True)
    fname = f"{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}"
    dest = os.path.join(udir, fname)
    file.save(dest)
    if os.path.getsize(dest) > 5 * 1024 * 1024:
        os.remove(dest)
        return jsonify({"ok": False, "error": "图片超过 5MB"}), 400

    url = f"/static/uploads/ocean/{fname}"
    pid = insert_ocean_post(text, url, address, lat, lng, nickname, user["id"])
    return jsonify({"ok": True, "id": pid, "url": url, "lat": lat, "lng": lng})


@app.route("/api/ocean/post/<int:post_id>")
def api_ocean_post_detail(post_id):
    post = get_ocean_post(post_id)
    if not post:
        return jsonify({"ok": False, "error": "作品不存在"}), 404
    comments = query_ocean_comments(post_id)
    return jsonify({"ok": True, "post": post, "comments": comments})


@app.route("/api/ocean/post/<int:post_id>/comment", methods=["POST"])
def api_ocean_comment(post_id):
    if not get_ocean_post(post_id):
        return jsonify({"ok": False, "error": "作品不存在"}), 404
    # 登录鉴权：评论必须登录
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    user = get_user_by_token(token)
    if not user:
        return jsonify({"ok": False, "error": "请先登录"}), 401
    nickname = user["username"]
    text = request.form.get("text", "")
    image_url = ""
    file = request.files.get("image")
    if file:
        ext = (file.filename or "").rsplit(".", 1)[-1].lower()
        if ext in ("jpg", "jpeg", "png", "webp"):
            udir = os.path.join(WEB_DIR, "static", "uploads", "ocean")
            os.makedirs(udir, exist_ok=True)
            fname = f"{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}"
            file.save(os.path.join(udir, fname))
            image_url = f"/static/uploads/ocean/{fname}"
    if not text.strip() and not image_url:
        return jsonify({"ok": False, "error": "评论不能为空"}), 400
    cid = insert_ocean_comment(post_id, text, image_url, nickname, user["id"])
    return jsonify({"ok": True, "id": cid})


@app.route("/api/auth/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not (2 <= len(username) <= 20):
        return jsonify({"ok": False, "error": "用户名需 2-20 个字符"}), 400
    if len(password) < 6:
        return jsonify({"ok": False, "error": "密码至少 6 位"}), 400
    uid = register_user(username, generate_password_hash(password))
    if uid is None:
        return jsonify({"ok": False, "error": "用户名已被占用"}), 400
    token = uuid.uuid4().hex
    set_user_token(uid, token)
    return jsonify({"ok": True, "token": token, "username": username})


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    user = get_user_by_username(username)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"ok": False, "error": "用户名或密码错误"}), 401
    token = uuid.uuid4().hex
    set_user_token(user["id"], token)
    return jsonify({"ok": True, "token": token, "username": username})


@app.route("/api/auth/me")
def api_me():
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    user = get_user_by_token(token)
    if not user:
        return jsonify({"ok": False, "error": "未登录"}), 401
    return jsonify({"ok": True, "user": user})


@app.route("/api/auth/avatar", methods=["POST"])
def api_avatar():
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    user = get_user_by_token(token)
    if not user:
        return jsonify({"ok": False, "error": "请先登录"}), 401
    file = request.files.get("avatar")
    if not file:
        return jsonify({"ok": False, "error": "缺少图片"}), 400
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        return jsonify({"ok": False, "error": "仅支持 jpg/png/webp"}), 400
    udir = os.path.join(WEB_DIR, "static", "uploads", "avatar")
    os.makedirs(udir, exist_ok=True)
    fname = f"{user['id']}_{int(time.time())}.{ext}"
    file.save(os.path.join(udir, fname))
    url = f"/static/uploads/avatar/{fname}"
    update_user_avatar(user["id"], url)
    return jsonify({"ok": True, "avatar": url})


@app.route("/profile")
def profile_page():
    return render_template("profile.html")


@app.route("/api/profile")
def api_profile():
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    user = get_user_by_token(token)
    if not user:
        return jsonify({"ok": False, "error": "请先登录"}), 401
    prof = get_user_profile(user["id"])
    return jsonify({"ok": True, "profile": prof})


@app.route("/api/profile/bio", methods=["POST"])
def api_profile_bio():
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    user = get_user_by_token(token)
    if not user:
        return jsonify({"ok": False, "error": "请先登录"}), 401
    data = request.get_json(silent=True) or {}
    bio = (data.get("bio") or "").strip()
    update_user_bio(user["id"], bio)
    return jsonify({"ok": True, "bio": bio})


@app.route("/api/auth/logout", methods=["POST"])
def api_logout():
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    if token:
        delete_user_token(token)
    return jsonify({"ok": True})


# ============ 投稿（PGC 投稿制，合规：用户内容私发邮箱，站长审核后刊登） ============
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.163.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
TOUGAO_EMAIL = os.environ.get("TOUGAO_EMAIL", "hainatougao@163.com")
FEEDBACK_EMAIL = os.environ.get("FEEDBACK_EMAIL", "hainafeedback@163.com")  # 意见反馈收件箱（2026-08-20 用户新建）

_feedback_lock = threading.Lock()
_feedback_log = []  # (ip, timestamp)，内存级速率限制


@app.route("/api/feedback", methods=["POST"])
def api_feedback():
    """意见反馈：web 表单 → 后端 SMTP 代发邮件到站长反馈邮箱（站外通道，合规隔离）。"""
    # 蜜罐：爬虫会填这个隐藏字段，填了直接假成功骗过
    if request.form.get("website"):
        return jsonify({"ok": True, "message": "反馈已收到，谢谢"})
    text = (request.form.get("text") or "").strip()
    submitter_email = (request.form.get("email") or "").strip()
    if not text:
        return jsonify({"ok": False, "error": "请先写下你的反馈"}), 400
    if len(text) > 2000:
        return jsonify({"ok": False, "error": "反馈内容太长了"}), 400
    if submitter_email and "@" not in submitter_email:
        return jsonify({"ok": False, "error": "邮箱格式不对"}), 400

    # 速率限制：同一 IP 1 分钟内最多 3 次
    ip = request.remote_addr or "?"
    now = time.time()
    with _feedback_lock:
        _feedback_log[:] = [t for t in _feedback_log if now - t[1] < 60]
        if sum(1 for t in _feedback_log if t[0] == ip) >= 3:
            return jsonify({"ok": False, "error": "提交太频繁，请稍后再试"}), 429
        _feedback_log.append((ip, now))

    # 发邮件到反馈邮箱
    try:
        msg = MIMEMultipart()
        msg["Subject"] = f"[海纳反馈] {time.strftime('%m-%d %H:%M')}"
        msg["From"] = SMTP_USER
        msg["To"] = FEEDBACK_EMAIL
        if submitter_email:
            msg["Reply-To"] = submitter_email
        body = f"反馈内容：\n{text}\n\n——\n访客邮箱：{submitter_email or '未填'}\nIP：{ip}\n时间：{time.strftime('%Y-%m-%d %H:%M:%S')}"
        msg.attach(MIMEText(body, "plain", "utf-8"))
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=25) as s:
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_USER, [FEEDBACK_EMAIL], msg.as_string())
    except Exception:
        return jsonify({"ok": False, "error": "发送失败，请稍后再试"}), 500
    return jsonify({"ok": True, "message": "反馈已收到，谢谢"})



_submit_lock = threading.Lock()
_submit_log = []  # (ip, timestamp)，内存级速率限制


@app.route("/api/ocean/submit", methods=["POST"])
def api_ocean_submit():
    # 蜜罐：爬虫会填这个隐藏字段，填了直接假成功骗过
    if request.form.get("website"):
        return jsonify({"ok": True, "message": "投稿成功，审核通过后会刊登"})
    file = request.files.get("image")
    address = (request.form.get("address") or "").strip()
    text = (request.form.get("text") or "").strip()
    submitter_email = (request.form.get("email") or "").strip()
    if not file:
        return jsonify({"ok": False, "error": "请选择照片"}), 400

    # 速率限制：同一 IP 1 分钟内最多 3 次
    ip = request.remote_addr or "?"
    now = time.time()
    with _submit_lock:
        _submit_log[:] = [t for t in _submit_log if now - t[1] < 60]
        if sum(1 for t in _submit_log if t[0] == ip) >= 3:
            return jsonify({"ok": False, "error": "提交太频繁，请稍后再试"}), 429
        _submit_log.append((ip, now))

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        return jsonify({"ok": False, "error": "仅支持 jpg/png/webp"}), 400
    img_data = file.read()
    if len(img_data) > 10 * 1024 * 1024:
        return jsonify({"ok": False, "error": "照片超过 10MB"}), 400

    # 发邮件（带照片附件，用户内容走邮箱，不直接进网站，合规隔离）
    try:
        msg = MIMEMultipart()
        msg["Subject"] = f"[海纳投稿] {address or '未填地址'}"
        msg["From"] = SMTP_USER
        msg["To"] = TOUGAO_EMAIL
        if submitter_email:
            msg["Reply-To"] = submitter_email
        body = f"地址：{address}\n说明：{text or '（无）'}\n投稿人邮箱：{submitter_email or '未填'}\n时间：{time.strftime('%Y-%m-%d %H:%M:%S')}"
        msg.attach(MIMEText(body, "plain", "utf-8"))
        img = MIMEImage(img_data)
        img.add_header("Content-Disposition", "attachment", filename=f"tougao.{ext}")
        msg.attach(img)
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=25) as s:
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_USER, [TOUGAO_EMAIL], msg.as_string())
    except Exception:
        return jsonify({"ok": False, "error": "发送失败，请稍后再试"}), 500
    return jsonify({"ok": True, "message": "投稿成功，审核通过后会刊登"})


@app.route("/api/admin/publish", methods=["POST"])
def api_admin_publish():
    """站长刊登投稿：管理员鉴权 → 照片+地址存 approved 直接上地图。"""
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    user = get_user_by_token(token)
    if not user or not user.get("is_admin"):
        return jsonify({"ok": False, "error": "无权限"}), 403
    file = request.files.get("image")
    address = (request.form.get("address") or "").strip()
    text = (request.form.get("text") or "").strip()
    if not file:
        return jsonify({"ok": False, "error": "请选择照片"}), 400
    if not address:
        return jsonify({"ok": False, "error": "请填地址"}), 400
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        return jsonify({"ok": False, "error": "仅支持 jpg/png/webp"}), 400
    # 坐标：优先手动 lat/lng，否则地理编码
    lat = request.form.get("lat", "")
    lng = request.form.get("lng", "")
    if lat and lng:
        try:
            lat, lng = float(lat), float(lng)
        except ValueError:
            return jsonify({"ok": False, "error": "坐标无效"}), 400
    else:
        geo = geocode(address)
        if not geo:
            return jsonify({"ok": False, "error": "地址定位失败，请手动填坐标"}), 400
        lat, lng = geo
    udir = os.path.join(WEB_DIR, "static", "uploads", "ocean")
    os.makedirs(udir, exist_ok=True)
    fname = f"pub_{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}"
    file.save(os.path.join(udir, fname))
    url = f"/static/uploads/ocean/{fname}"
    pid = insert_ocean_post(text, url, address, lat, lng, nickname="海纳", user_id=user["id"])
    set_post_status(pid, "approved")
    return jsonify({"ok": True, "id": pid, "url": url})


UGC_WRITE_PATHS = {
    "/api/ocean/post",
    "/api/auth/register", "/api/auth/avatar",
}


@app.before_request
def ugc_disabled():
    """UGC 已隐藏（2026-08-20 用户决定）：直接入库的写接口 403，读接口正常。
    /api/ocean/submit 已放开——web 表单投稿 = 后端 SMTP 代发邮件到站长邮箱（PGC 合规隔离，不直接进网站）。
    /api/auth/login 已放开——站长登录 /admin 后台审核需要（仅管理员可用，接口有 _require_admin 鉴权）。"""
    if request.method == "POST":
        p = request.path
        if p in UGC_WRITE_PATHS or p.startswith("/api/ocean/post/"):
            return jsonify({"ok": False, "error": "该功能暂未开放"}), 403
    return None


@app.route("/api/ocean/collections")
def api_ocean_collections():
    """Ocean data hub: list all datasets (agent discovery)"""
    from ocean_catalog import list_datasets
    try:
        return jsonify({"ok": True, "collections": list_datasets()})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/ocean/search")
def api_ocean_search():
    """Ocean data hub: search datasets by bbox/species/season/factors"""
    from ocean_catalog import search_datasets
    bbox_str = request.args.get("bbox", "")
    species = request.args.get("species", "")
    season = request.args.get("season", "")
    factors = request.args.get("factors", "")
    bbox = None
    if bbox_str:
        try:
            bbox = [float(x) for x in bbox_str.split(",")]
            if len(bbox) != 4:
                bbox = None
        except ValueError:
            bbox = None
    try:
        results = search_datasets(bbox=bbox, species=species, season=season, factors=factors)
        return jsonify({"ok": True, "count": len(results), "results": results})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/chain")
def api_chain():
    """区块链数据存证：查区块列表 + 验证链（AI+大数据+区块链架构）"""
    try:
        from blockchain import Blockchain
        bc = Blockchain(os.path.join(WEB_DIR, "ocean_chain.db"))
        blocks = []
        for row in bc.conn.execute("SELECT idx, timestamp, data, prev_hash, hash FROM blocks ORDER BY idx"):
            blocks.append({
                "index": row[0], "timestamp": row[1], "data": json.loads(row[2]),
                "prev_hash": row[3], "hash": row[4],
            })
        ok = bc.verify_chain()
        bc.conn.close()
        return jsonify({"ok": True, "valid": ok, "count": len(blocks), "blocks": blocks})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/chain/add")
def api_chain_add():
    """往区块链加一个数据区块（海洋数据哈希上链存证）"""
    try:
        from blockchain import Blockchain
        data = request.args.get("data", "")
        if not data:
            return jsonify({"ok": False, "error": "no data"}), 400
        import json as _json
        try:
            data_dict = _json.loads(data)
        except Exception:
            data_dict = {"raw": data}
        bc = Blockchain(os.path.join(WEB_DIR, "ocean_chain.db"))
        block = bc.add_block(data_dict)
        bc.conn.close()
        return jsonify({"ok": True, "block": block})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=False)
