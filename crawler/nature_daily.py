# -*- coding: utf-8 -*-
"""Nature 论文每日解读：抓 RSS → 海洋筛选 → DeepSeek 中文科普 → 入库海纳科普（含配图）"""
import json, os, requests
from bs4 import BeautifulSoup
from nature_papers import fetch_ocean_papers
from llm_parse import get_deepseek_key, BASE_URL, MODEL
from store import init_db, get_conn

IMG_DIR = os.path.join(os.path.dirname(__file__), "..", "web", "static", "img")
UA_IMG = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36'}

def fetch_og_image(url):
    """抓 Nature 论文页 og:image（主图）"""
    try:
        r = requests.get(url, headers=UA_IMG, timeout=30)
        if r.status_code != 200:
            return ""
        soup = BeautifulSoup(r.text, "html.parser")
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            src = og["content"]
            if src.startswith("//"):
                src = "https:" + src
            return src
    except Exception:
        pass
    return ""

def download_image(img_url, dest):
    try:
        r = requests.get(img_url, headers=UA_IMG, timeout=40)
        if r.status_code == 200 and len(r.content) > 1000:
            with open(dest, "wb") as f:
                f.write(r.content)
            return True
    except Exception:
        pass
    return False

INTERPRET_PROMPT = """把下面这篇英文论文改写成中文科普，输出 JSON：{{"title": "中文标题", "content": "中文科普正文"}}。

科普正文 300-500 字，讲清楚三件事：
1. 发现了什么（核心结论，开头一句话先说）
2. 怎么发现的（方法一句话带过）
3. 为什么重要（对海洋、对普通人意味着什么）

写作要求：
- 大白话，不堆术语，不翻译腔
- 禁止用破折号"——"
- 禁止用"不是……而是……""不仅……而且……""没有……只有……"这类关联词句式，换成直接陈述
- 禁止用"这项研究""研究表明""值得注意的是""总而言之"这类论文腔
- 客观口吻，直接讲事情

论文标题：{title}
期刊：{journal}
摘要：{abstract}"""

def interpret(title, journal, abstract):
    """DeepSeek 解读单篇论文，返回 (中文标题, 中文正文) 或 None"""
    key = get_deepseek_key()
    if not key:
        return None
    prompt = INTERPRET_PROMPT.format(title=title, journal=journal, abstract=abstract[:1500])
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "temperature": 0.4,
        "max_tokens": 2000,
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        r = requests.post(BASE_URL + "/chat/completions", json=payload, headers=headers, timeout=90)
        if r.status_code != 200:
            return None
        data = r.json()
        obj = json.loads(data["choices"][0]["message"]["content"])
        return obj.get("title", "").strip(), obj.get("content", "").strip()
    except Exception:
        return None

def run(limit=3):
    """抓 + 解读 + 入库。返回 (新增数, 抓取数)"""
    init_db()
    papers = fetch_ocean_papers()
    conn = get_conn()
    done_urls = {r[0] for r in conn.execute(
        "SELECT url FROM articles WHERE content_type='interpretation' AND category='海纳科普'"
    ).fetchall()}
    conn.close()

    added = 0
    for p in papers:
        if p["url"] in done_urls:
            continue
        if added >= limit:
            break
        result = interpret(p["title"], p["journal"], p["abstract"])
        if not result or not result[1]:
            continue
        zh_title, content = result
        # 抓论文配图（og:image），下载到本地，插入 content 开头 + 存 image 字段当封面
        img_url = fetch_og_image(p["url"])
        cover = ""
        if img_url:
            ext = ".jpg" if ".jpg" in img_url.lower() else ".png"
            fname = f"nature_{p['url'].split('/')[-1]}{ext}"
            dest = os.path.join(IMG_DIR, fname)
            if download_image(img_url, dest):
                cover = "/static/img/" + fname
                content = '<p><img src="' + cover + '" alt="图源：Nature，' + p["journal"] + '" style="max-width:100%;border-radius:8px;"></p>' + content
        conn = get_conn()
        # 查重：同 url 的解读已存在则跳过
        exists = conn.execute(
            "SELECT id FROM articles WHERE url = ? AND content_type = 'interpretation'", (p["url"],)
        ).fetchone()
        if exists:
            conn.close()
            continue
        conn.execute(
            "INSERT INTO articles (title, url, source, category, date, content, content_type, image) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (zh_title, p["url"], "海纳科普", "海纳科普", p["date"], content, "interpretation", cover),
        )
        conn.commit()
        conn.close()
        added += 1
        print(f"入库: {zh_title}")
    return added, len(papers)

if __name__ == "__main__":
    n, total = run(limit=3)
    print(f"\n完成：抓取 {total} 条海洋论文，解读入库 {n} 条")
