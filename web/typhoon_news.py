# -*- coding: utf-8 -*-
"""台风新闻抓取：playwright 抓新京报/新华网，按活跃台风名匹配，存 articles 表 typhoon_name。
服务器 cron 定时跑。"""
import sys, os, time, json, re, urllib.request

# 确保能 import 海纳的 store（用 crawler/store.py，DB 指向 crawler/data/haina.db）
sys.path.insert(0, "/opt/haina/crawler")

def get_all_typhoons():
    """从中央气象台拿所有台风（含历史），返回 [{cn, en, number}]"""
    t = int(round(time.time() * 1000))
    url = f"http://typhoon.nmc.cn/weatherservice/typhoon/jsons/list_default?t={t}&callback=typhoon_jsons_list_default"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        body = r.read().decode("utf-8", "ignore")
    m = re.match(r".*?({.*}).*", body, re.S)
    if not m:
        return []
    data = json.loads(m.group(1))
    out = []
    for tph in data.get("typhoonList", []):
        # [0]tpId [1]英文名 [2]中文名 [3]编号 [7]状态
        if len(tph) > 2 and tph[2]:
            out.append({"cn": tph[2], "en": tph[1], "number": tph[3] if len(tph) > 3 else ""})
    return out

def crawl_news():
    """playwright 抓新京报/新华网，找台风新闻"""
    from playwright.sync_api import sync_playwright
    all_tp = get_all_typhoons()
    if not all_tp:
        print("无台风数据")
        return []
    names = [t["cn"] for t in all_tp if t["cn"]]
    print("台风名(含历史):", names[:10], "...共", len(names))

    UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    sources = [
        ("新京报", "https://www.bjnews.com.cn/"),
        ("新华网", "http://www.news.cn/"),
    ]
    items = []
    seen = set()
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=UA, locale="zh-CN")
        pg = ctx.new_page()
        for src_name, url in sources:
            try:
                pg.goto(url, timeout=40000, wait_until="domcontentloaded")
                time.sleep(3)
                links = pg.evaluate("""() => {
                    const out = [];
                    document.querySelectorAll('a').forEach(a => {
                        const t = (a.textContent||'').trim();
                        const h = a.href||'';
                        if (t && t.length>5 && t.length<80 && /台风|沙德尔|预警/.test(t)) out.push({t, h});
                    });
                    return out;
                }""")
                for l in links:
                    title = l["t"].strip()
                    href = l["h"]
                    if not title or not href or title in seen:
                        continue
                    matched = [n for n in names if n and n in title]
                    if not matched:
                        continue
                    seen.add(title)
                    items.append({"title": title, "url": href, "source": src_name, "typhoon": matched[0]})
            except Exception as e:
                print(f"{src_name} 失败: {repr(e)[:60]}")
        b.close()
    return items

def save_items(items):
    """存库（用 store.py 的 insert_articles + 回填 typhoon_name）"""
    if not items:
        return 0
    import store
    store.init_db()  # 确保 articles 表 + typhoon_name 列存在
    added = 0
    for it in items:
        # 先插入（不含 typhoon_name，用 store 的 insert_articles）
        n = store.insert_articles([{
            "title": it["title"], "url": it["url"], "source": it["source"],
            "category": "台风", "date": time.strftime("%Y-%m-%d"),
        }])
        if n:
            # 回填 typhoon_name
            store.update_typhoon_name(it["url"], it["typhoon"])
            added += 1
    return added

if __name__ == "__main__":
    items = crawl_news()
    print(f"抓到 {len(items)} 条台风新闻")
    for it in items:
        print(f"  [{it['typhoon']}] {it['title'][:40]}")
    added = save_items(items)
    print(f"新增入库 {added} 条")
