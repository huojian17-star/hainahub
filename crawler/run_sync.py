# -*- coding: utf-8 -*-
"""海纳 · 定时同步入口（Windows 计划任务调用）：
抓取全部信源 → 去重入库 → 增量补图 → 写日志
"""
import os, sys, datetime, traceback

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

LOG_DIR = os.path.join(BASE, "log")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_PATH = os.path.join(LOG_DIR, "sync.log")

def log(msg):
    line = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def main():
    from store import init_db, insert_articles, expire_jobs
    from sources import crawl_all
    from update_images import main as update_images_main

    t0 = datetime.datetime.now()
    log("===== 同步开始 =====")
    init_db()
    # 过期岗位自动下架
    try:
        n = expire_jobs()
        if n:
            log(f"过期下架 {n} 个岗位")
    except Exception:
        log("下架失败:\n" + traceback.format_exc())
    result = crawl_all()
    total_added = 0
    for key, items in result.items():
        if isinstance(items, dict) and "error" in items:
            log(f"[{key}] 失败: {items['error']}")
            continue
        added = insert_articles(items)
        total_added += added
        log(f"[{key}] 抓到 {len(items)} 新增 {added}")
    log(f"抓取完成，本轮新增 {total_added} 条")
    # 补图（只补缺失）
    try:
        update_images_main(limit=80, sleep=0.8)
    except Exception:
        log("补图失败:\n" + traceback.format_exc())
    # 岗位表附件解析（免费 openpyxl，每轮跑）
    try:
        from job_table_crawler import run as job_table_run
        job_table_run()
    except Exception:
        log("岗位表解析失败:\n" + traceback.format_exc())
    # LLM 正文解析（增量：只解析未解析过的新招聘启事，DeepSeek 成本可控）
    try:
        from job_crawler import run as job_llm_run
        job_llm_run()
    except Exception:
        log("岗位正文解析失败:\n" + traceback.format_exc())
    # Nature 论文每日解读（抓 RSS → 海洋筛选 → 中文科普，每日 3 篇）
    try:
        from nature_daily import run as nature_run
        n, total = nature_run(limit=3)
        log(f"Nature 解读：抓 {total} 篇，入库 {n} 篇")
    except Exception:
        log("Nature 解读失败:\n" + traceback.format_exc())
    # Moka 民企岗位（公开 API，直接入库 jobs）
    try:
        from mokahr_crawler import run as mokahr_run
        n = mokahr_run()
        log(f"Moka 民企岗位：新增 {n} 个")
    except Exception:
        log("Moka 爬取失败:\n" + traceback.format_exc())
    # 北森 zhiye 国企/央企岗位（静态 HTML 表格）
    try:
        from zhiye_crawler import run as zhiye_run
        n = zhiye_run()
        log(f"zhiye 岗位：新增 {n} 个")
    except Exception:
        log("zhiye 爬取失败:\n" + traceback.format_exc())
    # 中谷物流（自研 JSON API）
    try:
        from zhonggu_crawler import run as zhonggu_run
        n = zhonggu_run()
        log(f"中谷物流岗位：新增 {n} 个")
    except Exception:
        log("中谷物流爬取失败:\n" + traceback.format_exc())
    cost = (datetime.datetime.now() - t0).total_seconds()
    log(f"===== 同步完成，耗时 {cost:.0f}s =====")

if __name__ == "__main__":
    try:
        main()
    except Exception:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now()}] 致命错误:\n{traceback.format_exc()}\n")
        raise
