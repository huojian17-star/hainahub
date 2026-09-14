# -*- coding: utf-8 -*-
"""北森 zhiye.com 招聘站爬虫：静态 HTML 表格，抓中船集团等校招/社招岗位入库。
2026-08-21 修复：详情页解析薪资范围（列表页无薪资列，薪资在详情页「薪资范围：X」）。"""
import requests
import re
from bs4 import BeautifulSoup
from store import upsert_job

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}

# 北森 zhiye 站：企业名 -> (域名, 类型)
ZHIYE = [
    ("中国船舶集团", "https://cssc.zhiye.com", "国企"),
]


def fetch_detail(url):
    """抓详情页：返回 (salary, description)。
    薪资格式：「薪资范围： 10000-15000 元/月」或「薪资范围： 面议」。
    """
    try:
        r = requests.get(url, headers=UA, timeout=15)
        r.encoding = r.apparent_encoding or "utf-8"
        soup = BeautifulSoup(r.text, "lxml")
        text = soup.get_text(" ", strip=True)
        salary = ""
        m = re.search(r"薪资范围[:：]\s*(.{1,60}?)\s*(?=招聘人数|工作地点|$)", text)
        if m:
            salary = m.group(1).strip()
        desc = ""
        m2 = re.search(r"工作职责[:：]\s*(.+?)(?=任职资格|联系方式|$)", text, re.S)
        if m2:
            desc = re.sub(r"\s+", " ", m2.group(1)).strip()[:500]
        return salary, desc
    except Exception:
        return "", ""


def fetch_site(name, base, unit_type):
    jobs = []
    for path in ("/campus", "/Social"):
        url = base + path
        try:
            r = requests.get(url, headers=UA, timeout=15)
            r.encoding = r.apparent_encoding or "utf-8"
        except Exception as e:
            print(f"  [{name}] {path} 失败: {str(e)[:50]}")
            continue
        soup = BeautifulSoup(r.text, "lxml")
        # 找职位表格（表头含"职位名称"）
        for tr in soup.find_all("tr"):
            tds = [td.get_text(strip=True) for td in tr.find_all("td")]
            if len(tds) < 3:
                continue
            title_raw, unit, region, pubdate = tds[0], tds[1], tds[2], (tds[3] if len(tds) > 3 else "")
            if not title_raw or "职位名称" in title_raw:
                continue
            # 职位名去编号 "(J12033)"
            title = re.sub(r"\(J\d+\)$", "", title_raw).strip()
            if not title:
                continue
            # 详情链接
            href = ""
            a = tr.find("a", href=True)
            if a:
                href = base + a["href"] if a["href"].startswith("/") else a["href"]
            salary, desc = ("", "")
            if href:
                salary, desc = fetch_detail(href)
            jobs.append({
                "title": title,
                "unit": unit,
                "unit_type": unit_type,
                "major": "",
                "education": "",
                "region": region,
                "headcount": "",
                "salary": salary,
                "deadline": "",
                "is_longterm": 0,
                "publish_date": pubdate,
                "url": href,
                "source": name,
                "description": desc,
            })
        print(f"  [{name}] {path} 抓到 {len(jobs)} 个（累计）")
    return jobs

def run():
    all_jobs = []
    for name, base, unit_type in ZHIYE:
        all_jobs += fetch_site(name, base, unit_type)
    seen, uniq = set(), []
    for j in all_jobs:
        key = j["title"] + j["unit"]
        if key in seen:
            continue
        seen.add(key)
        uniq.append(j)
    # upsert：已存在补薪资/描述/刷新 active，不存在则插入
    updated = inserted = 0
    for j in uniq:
        r = upsert_job(j)
        if r == "updated":
            updated += 1
        elif r == "inserted":
            inserted += 1
    print(f"\n共 {len(uniq)} 个 zhiye 岗位：新增 {inserted}，更新 {updated}")
    return inserted + updated

if __name__ == "__main__":
    run()
