# -*- coding: utf-8 -*-
"""Moka 招聘官网 API 爬虫：调公开 API 抓民企岗位，直接入库 jobs。
API: GET https://api.mokahr.com/api-platform/v1/jobs/{orgId}?mode=campus|social
"""
import requests
from store import insert_jobs, get_conn

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}
API = "https://api.mokahr.com/api-platform/v1/jobs/{org}"

# 涉海民企 orgId -> 企业名（先海大集团，后续扩充）
ORG = {
    "haid": "海大集团",
}

def fmt_salary(mn, mx):
    """Moka 薪资单位不统一：>=1000 是元，<1000 是千。统一转成 'x-yK'。"""
    def k(v):
        if v is None or v == "":
            return None
        v = float(v)
        return round(v / 1000, 1) if v >= 1000 else v
    a, b = k(mn), k(mx)
    if a is None and b is None:
        return ""
    if a is None:
        return f"最高{b}K"
    if b is None:
        return f"{a}K起"
    return f"{a}-{b}K"

def fmt_region(locations):
    if not locations:
        return ""
    loc = locations[0]
    parts = [loc.get("province") or "", loc.get("city") or ""]
    # 去重（直辖市省市同名）
    if parts[0] == parts[1]:
        return parts[0]
    return "-".join([p for p in parts if p])

def fmt_date(s):
    return (s or "")[:10]

def fetch_org(org, name):
    jobs = []
    for mode in ("campus", "social"):
        offset = 0
        while True:
            url = API.format(org=org) + f"?mode={mode}&limit=100&offset={offset}"
            try:
                r = requests.get(url, headers=UA, timeout=20)
                if r.status_code != 200:
                    print(f"  [{name}] {mode} offset={offset} HTTP {r.status_code}: {r.text[:60]}")
                    break
                d = r.json()
                jl = d.get("jobs") or []
                for j in jl:
                    jobs.append({
                        "title": (j.get("title") or "").strip(),
                        "unit": name,
                        "unit_type": "企业",
                        "major": "",
                        "education": j.get("education") or "",
                        "region": fmt_region(j.get("locations")),
                        "headcount": str(j.get("number") or "") if j.get("number") else "",
                        "salary": fmt_salary(j.get("minSalary"), j.get("maxSalary")),
                        "deadline": "",
                        "is_longterm": 0,
                        "publish_date": fmt_date(j.get("updatedAt")) or fmt_date(j.get("openedAt")),
                        "url": f"https://app.mokahr.com/campus-recruitment/{org}/job/{j.get('id')}" if j.get("id") else f"https://app.mokahr.com/campus-recruitment/{org}",
                        "source": name,
                        "description": (j.get("description") or "")[:2000],
                    })
                if len(jl) < 100:
                    break
                offset += 100
            except Exception as e:
                print(f"  [{name}] {mode} offset={offset} 失败: {str(e)[:60]}")
                break
        print(f"  [{name}] {mode} 累计 {len(jobs)} 个")
    return jobs

def run():
    all_jobs = []
    for org, name in ORG.items():
        all_jobs += fetch_org(org, name)
    added = insert_jobs(all_jobs)
    print(f"\n共抓到 {len(all_jobs)} 个民企岗位，新增 {added} 个")
    return added

if __name__ == "__main__":
    run()
