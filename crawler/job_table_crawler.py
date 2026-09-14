# -*- coding: utf-8 -*-
"""岗位表附件抓取流水线：从招聘公告详情页找岗位表(xlsx) → 下载 → 解析 → 入库 jobs。

用法：python job_table_crawler.py [--limit N] [--dry-run]
"""
import os
import re
import sys
import argparse
import tempfile
import requests
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from store import get_conn, insert_jobs
from job_table_parser import parse_xlsx
from job_crawler import is_job_notice
from llm_parse import parse_jobs, normalize_jobs
from attachment_extract import extract_attachment_text

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
}

ATTACH_RE = re.compile(r"\.(xlsx?|pdf|docx?)$", re.I)
# 跳过报名表/登记表/承诺书等非岗位信息附件，只留岗位信息表/招聘启事
SKIP_NAME_HINTS = ["报名", "登记", "申请表", "简历", "承诺书", "回避", "声明", "证明",
                   "成绩单", "推荐信", "附件2", "附件3", "附件4"]


def get_page_text(url):
    """抓公告详情页正文文本。"""
    r = requests.get(url, headers=HEADERS, timeout=30)
    if r.status_code != 200:
        return ""
    r.encoding = r.apparent_encoding or "utf-8"
    soup = BeautifulSoup(r.text, "html.parser")
    return soup.get_text(" ", strip=True)


def extract_deadline(text):
    """从正文提取报名截止日期（YYYY-MM-DD）。支持两种写法：
    "报名时间截止至 2026 年 8 月 7 日"、"截止日期：2026-08-07"
    """
    m = re.search(r'截止[至到]?\s*(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日', text)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    m = re.search(r'截止[日期时间]*[：:]\s*(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})', text)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    return ""


def find_attachments(url):
    """抓公告详情页，返回 [(文件名, 绝对URL)] 附件列表。"""
    r = requests.get(url, headers=HEADERS, timeout=30)
    if r.status_code != 200:
        return []
    r.encoding = r.apparent_encoding or "utf-8"
    soup = BeautifulSoup(r.text, "html.parser")
    base = requests.utils.urlparse(url)
    out = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not ATTACH_RE.search(href):
            continue
        if href.startswith("/"):
            href = f"{base.scheme}://{base.netloc}{href}"
        elif href.startswith("./"):
            href = url.rsplit("/", 1)[0] + "/" + href[1:]
        elif not href.startswith("http"):
            href = url.rsplit("/", 1)[0] + "/" + href
        name = a.get_text(strip=True) or href.rsplit("/", 1)[-1]
        out.append((name, href))
    return out


def download(url, dest):
    r = requests.get(url, headers=HEADERS, timeout=60)
    if r.status_code == 200 and len(r.content) > 1000:
        with open(dest, "wb") as f:
            f.write(r.content)
        return True
    return False


def run(limit=None, dry_run=False):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, title, url, source, date FROM articles ORDER BY date DESC, id DESC"
    ).fetchall()
    conn.close()

    candidates = [r for r in rows if is_job_notice(r[1])]
    print(f"候选招聘公告: {len(candidates)} / 总资讯 {len(rows)}")
    if limit:
        candidates = candidates[:limit]

    tmpdir = tempfile.mkdtemp(prefix="haina_jobtable_")
    total = 0
    for idx, (aid, title, url, source, date) in enumerate(candidates, 1):
        print(f"\n[{idx}/{len(candidates)}] {title[:50]}")
        print(f"  {url[:100]}")
        atts = find_attachments(url)
        if not atts:
            print("  无附件，跳过")
            continue

        # 从公告正文提取报名截止时间（xlsx 岗位表里通常没有）
        page_text = get_page_text(url)
        deadline = extract_deadline(page_text) if page_text else ""
        if deadline:
            print(f"  提取截止日期: {deadline}")

        # 1) xlsx 岗位表：规则解析
        xls = [a for a in atts if a[1].lower().split("?")[0].endswith((".xlsx", ".xls"))]
        for name, aurl in xls:
            if any(k in name for k in SKIP_NAME_HINTS):
                continue
            fp = os.path.join(tmpdir, f"{aid}_{len(os.listdir(tmpdir))}.xlsx")
            if not download(aurl, fp):
                print(f"  下载失败(xlsx): {name}")
                continue
            jobs = parse_xlsx(fp, fallback_url=url, fallback_source=source,
                              fallback_date=date, unit_name=source)
            if deadline:
                for j in jobs:
                    j["deadline"] = deadline
            if dry_run:
                print(f"  [xlsx] {name} → {len(jobs)} 岗位")
                for j in jobs[:3]:
                    print(f"    - {j['title']} | {j['unit']} | 专业[{j['major'] or '无'}]")
            else:
                n = insert_jobs(jobs)
                print(f"  [xlsx] {name} → {len(jobs)} 岗位，入库 {n}")
                total += n

        # 2) pdf/doc 附件：提取文本 → LLM 解析
        text_atts = [a for a in atts if a[1].lower().split("?")[0].endswith((".pdf", ".doc", ".docx"))]
        for name, aurl in text_atts:
            if any(k in name for k in SKIP_NAME_HINTS):
                continue
            ext = aurl.split("?")[0].rsplit(".", 1)[-1]
            fp = os.path.join(tmpdir, f"{aid}_{len(os.listdir(tmpdir))}.{ext}")
            if not download(aurl, fp):
                print(f"  下载失败({ext}): {name}")
                continue
            text = extract_attachment_text(fp)
            if not text or len(text) < 30:
                print(f"  [{ext}] {name} 文本提取失败或过短")
                continue
            jobs = parse_jobs(title, text)
            norm = normalize_jobs(jobs, fallback_title=title, fallback_url=url)
            for n in norm:
                n["source"] = source
                n["publish_date"] = date
            if dry_run:
                print(f"  [{ext}] {name} → {len(norm)} 岗位")
                for j in norm[:3]:
                    print(f"    - {j['title']} | 专业[{j['major'] or '无'}] | {j['education']}")
            else:
                n = insert_jobs(norm)
                print(f"  [{ext}] {name} → {len(norm)} 岗位，入库 {n}")
                total += n

    print("\n" + "=" * 50)
    print(f"完成：累计解析岗位 {total}")
    print(f"临时文件目录: {tmpdir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    run(limit=args.limit, dry_run=args.dry_run)
