# -*- coding: utf-8 -*-
"""岗位抓取：从 articles 里筛出"招聘启事"（非公示），抓正文，LLM 解析出结构化岗位入库。

用法：python job_crawler.py [--limit N] [--dry-run]
"""
import sys
import os
import re
import argparse
import requests
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from store import get_conn, insert_jobs
from llm_parse import parse_jobs, normalize_jobs

# 排除词：这些是"结果公示"不是"招募启事"
EXCLUDE = ["公示", "拟录用", "拟聘用", "考察", "面试", "名单", "递补", "录用人员",
           "体检", "成绩", "拟聘", "聘用人员", "考察人选", "资格复审", "准考证"]

CONTENT_SELECTORS = [
    ".TRS_Editor", ".v_news_content", ".content", ".article-content", "#zoom",
    ".article", ".news_content", ".wp_articlecontent", ".Custom_UnionStyle",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
}


def is_job_notice(title):
    """判断是否"招聘启事"（含招聘，且非公示类）。"""
    if "招聘" not in title:
        return False
    return not any(k in title for k in EXCLUDE)


def fetch_body(url):
    """抓详情页正文纯文本。失败返回 None。"""
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code != 200:
            return None
        r.encoding = r.apparent_encoding or "utf-8"
        soup = BeautifulSoup(r.text, "html.parser")
        node = None
        for sel in CONTENT_SELECTORS:
            node = soup.select_one(sel)
            if node and len(node.get_text(strip=True)) > 80:
                break
        if node is None or len(node.get_text(strip=True)) <= 80:
            node = soup.body
        text = re.sub(r"\s+", " ", node.get_text(strip=True))
        return text if len(text) > 40 else None
    except Exception as e:
        print(f"  [fetch] {type(e).__name__}: {str(e)[:100]}")
        return None


def run(limit=None, dry_run=False):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, title, url, source, date FROM articles ORDER BY date DESC, id DESC"
    ).fetchall()
    # 已解析出岗位的 url（附件或正文解析过，均已入库 jobs）——跳过，避免重复 LLM 调用
    done = set(r[0] for r in conn.execute("SELECT DISTINCT url FROM jobs").fetchall())
    conn.close()

    candidates = [r for r in rows if is_job_notice(r[1]) and r[2] not in done]
    print(f"候选招聘启事(未解析): {len(candidates)} / 总资讯 {len(rows)} (跳过已解析 {len(done)})")
    if limit:
        candidates = candidates[:limit]

    total_jobs = 0
    parsed = 0
    empty = 0
    failed = 0

    for idx, (aid, title, url, source, date) in enumerate(candidates, 1):
        print(f"\n[{idx}/{len(candidates)}] {title[:50]}")
        print(f"  {url[:100]}")
        body = fetch_body(url)
        if body is None:
            print("  正文抓取失败")
            failed += 1
            continue
        jobs = parse_jobs(title, body)
        if not jobs:
            print("  未解析出岗位（可能岗位在附件）")
            empty += 1
            continue
        norm = normalize_jobs(jobs, fallback_title=title, fallback_url=url)
        for n in norm:
            n["source"] = source
            n["publish_date"] = date
        if dry_run:
            print(f"  [dry-run] 解析出 {len(norm)} 个岗位：")
            for n in norm:
                print(f"    - {n['title']} | {n['unit_type']} | {n['major'] or '无专业'} | {n['education']} | {n['region']}")
        else:
            added = insert_jobs(norm)
            print(f"  解析出 {len(norm)} 个岗位，入库 {added}")
            total_jobs += added
        parsed += 1

    print("\n" + "=" * 50)
    print(f"完成：解析成功 {parsed}，无岗位(附件) {empty}，失败 {failed}，累计入库岗位 {total_jobs}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="只处理前 N 条")
    ap.add_argument("--dry-run", action="store_true", help="只解析不入库")
    args = ap.parse_args()
    run(limit=args.limit, dry_run=args.dry_run)
