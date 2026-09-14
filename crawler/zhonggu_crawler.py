# -*- coding: utf-8 -*-
"""中谷物流招聘 API 爬虫：自研 JSON 接口（校招+社招），直接入库 jobs。"""
import requests
import re
from store import insert_jobs

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Referer": "https://zhaopin.zhonggu56.com/index.jsp",
      "Content-Type": "application/json;charset=UTF-8"}
BASE = "https://zhaopin.zhonggu56.com/frontend/schoolposition/"

def extract_edu(text):
    """从岗位要求里提学历"""
    m = re.search(r"(大专|本科|硕士|博士|研究生)(?:及以上|以上|或以上)?", text or "")
    if m:
        return m.group(1)
    return ""

def run():
    jobs = []
    # 校招
    try:
        r = requests.post(BASE + "getSchoolPositionList.json", headers=UA,
                          json={"page": 1, "pageSize": 100, "sort": [{"field": "displayOrder", "dir": "asc"}, {"field": "creationTime", "dir": "desc"}], "filter": {"logic": "and", "filters": []}},
                          timeout=15)
        d = r.json()
        items = d.get("content") or []
        print(f"中谷物流 校招 {len(items)} 个岗位")
    except Exception as e:
        print(f"校招失败: {str(e)[:60]}")
        items = []
    # 社招
    try:
        r2 = requests.post(BASE + "getPositionList.json", headers=UA, json={"type": "10"}, timeout=15)
        items2 = r2.json()
        print(f"中谷物流 社招 {len(items2)} 个岗位")
        items += items2
    except Exception as e:
        print(f"社招失败: {str(e)[:60]}")

    for j in items:
        title = (j.get("position") or "").strip()
        if not title:
            continue
        req = j.get("requirement") or ""
        jobs.append({
            "title": title,
            "unit": "中谷物流",
            "unit_type": "企业",
            "major": "",
            "education": extract_edu(req),
            "region": (j.get("workPlace") or "").strip(),
            "headcount": str(j.get("requiredNum") or ""),
            "salary": "",
            "deadline": "",
            "is_longterm": 0,
            "publish_date": "",
            "url": "https://zhaopin.zhonggu56.com/index.jsp",
            "source": "中谷物流",
            "description": (req + "\n" + (j.get("specialRequirement") or "") + "\n" + (j.get("responsibility") or ""))[:2000],
        })
    added = insert_jobs(jobs)
    print(f"共 {len(jobs)} 个中谷岗位，新增 {added}")
    return added

if __name__ == "__main__":
    run()
