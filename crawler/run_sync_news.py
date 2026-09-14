# -*- coding: utf-8 -*-
"""海纳 · 资讯同步入口（Windows 计划任务 HainaNewsSync 调用，每 2 小时）：
抓取全部资讯信源 → 去重入库 → 增量补图 → 写日志
"""
import os, sys, datetime, traceback

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

LOG_DIR = os.path.join(BASE, "log")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_PATH = os.path.join(LOG_DIR, "sync_news.log")


def log(msg):
    line = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def main():
    from store import init_db, insert_articles
    from sources import crawl_all
    from update_images import main as update_images_main

    t0 = datetime.datetime.now()
    log("===== 资讯同步开始 =====")
    init_db()
    result = crawl_all()
    total_added = 0
    for key, items in result.items():
        if isinstance(items, dict) and "error" in items:
            log(f"[{key}] 失败: {items['error']}")
            continue
        added = insert_articles(items)
        total_added += added
        log(f"[{key}] 抓到 {len(items)} 新增 {added}")
    log(f"资讯抓取完成，本轮新增 {total_added} 条")
    try:
        update_images_main(limit=80, sleep=0.8)
    except Exception:
        log("补图失败:\n" + traceback.format_exc())
    cost = (datetime.datetime.now() - t0).total_seconds()
    log(f"===== 资讯同步完成，耗时 {cost:.0f}s =====")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now()}] 致命错误:\n{traceback.format_exc()}\n")
        raise
