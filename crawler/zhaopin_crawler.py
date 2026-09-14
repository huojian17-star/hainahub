# -*- coding: utf-8 -*-
"""智联招聘爬虫：有头 Playwright 渲染搜索页，提取 .job-card 岗位入库。
智联反爬硬（headless 检测 + sign），必须 headless=False 有头模式。
"""
from playwright.sync_api import sync_playwright
from store import insert_jobs

# 海洋相关搜索关键词
KEYWORDS = ["海洋", "海洋工程", "水产养殖", "船舶", "航运", "航海", "海洋装备", "海洋生物", "轮机"]

def scrape_kw(pg, kw, pages=2):
    jobs = []
    for page in range(1, pages + 1):
        url = f"https://sou.zhaopin.com/?jl=653&kw={kw}&p={page}"
        try:
            pg.goto(url, wait_until="domcontentloaded", timeout=40000)
            pg.wait_for_timeout(5000)
        except Exception as e:
            print(f"  [{kw}] p{page} goto 失败: {str(e)[:50]}")
            continue
        cards = pg.evaluate("""(() => {
          return Array.from(document.querySelectorAll('.job-card')).map(c => {
            const title = c.querySelector('.job-card__title')?.innerText?.trim() || '';
            const salary = c.querySelector('.job-card__salary')?.innerText?.trim() || '';
            const company = c.querySelector('.job-card__company')?.innerText?.trim() || '';
            const tags = Array.from(c.querySelectorAll('.job-card__skill-tag')).map(t => t.innerText.trim());
            const href = c.querySelector('a')?.href || '';
            return { title, salary, company, tags, href };
          });
        })()""")
        for c in cards:
            if not c["title"]:
                continue
            # 学历/经验从 tags 里猜：本科/硕士/大专 = 学历；X年/X-X年 = 经验
            edu = ""
            exp = ""
            region = ""
            for t in c["tags"]:
                if any(k in t for k in ["本科", "硕士", "博士", "大专", "学历"]):
                    edu = t
                elif "年" in t and ("经验" in t or any(ch.isdigit() for ch in t)):
                    exp = t
            # 城市：title 之后 company 里可能有，或从卡片其他字段
            jobs.append({
                "title": c["title"].split("(")[0].strip(),
                "unit": c["company"],
                "unit_type": "企业",
                "major": "",
                "education": edu,
                "region": region,
                "headcount": "",
                "salary": c["salary"] if c["salary"] not in ("**-**元", "面议") else "",
                "deadline": "",
                "is_longterm": 0,
                "publish_date": "",
                "url": c["href"] or f"https://sou.zhaopin.com/?kw={kw}",
                "source": "智联招聘",
                "description": "",
            })
        print(f"  [{kw}] p{page} 抓到 {len(cards)} 卡片")
    return jobs

def run():
    all_jobs = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=False)
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        for kw in KEYWORDS:
            all_jobs += scrape_kw(pg, kw, pages=1)
        b.close()
    # 去重（按 url）
    seen, uniq = set(), []
    for j in all_jobs:
        if j["url"] in seen:
            continue
        seen.add(j["url"])
        uniq.append(j)
    added = insert_jobs(uniq)
    print(f"\n共抓 {len(uniq)} 个智联岗位，新增 {added}")
    return added

if __name__ == "__main__":
    run()
