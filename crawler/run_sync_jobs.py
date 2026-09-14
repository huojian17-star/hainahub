# -*- coding: utf-8 -*-
"""海纳 · 招聘同步入口（Windows 计划任务 HainaJobSync 调用，每天 1 次）：
过期岗位下架 → 岗位表附件解析（免费）→ zhiye(北森) 岗位同步 → LLM 正文解析（增量，DeepSeek）→ 写日志
"""
import os, sys, datetime, traceback

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

LOG_DIR = os.path.join(BASE, "log")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_PATH = os.path.join(LOG_DIR, "sync_jobs.log")


def log(msg):
    line = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def main():
    from store import init_db, expire_jobs

    t0 = datetime.datetime.now()
    log("===== 招聘同步开始 =====")
    init_db()
    try:
        n = expire_jobs()
        if n:
            log(f"过期下架 {n} 个岗位")
    except Exception:
        log("下架失败:\n" + traceback.format_exc())
    try:
        from job_table_crawler import run as job_table_run
        job_table_run()
    except Exception:
        log("岗位表解析失败:\n" + traceback.format_exc())
    try:
        from zhiye_crawler import run as zhiye_run
        zhiye_run()
    except Exception:
        log("zhiye(北森)岗位同步失败:\n" + traceback.format_exc())
    try:
        from job_crawler import run as job_llm_run
        job_llm_run()
    except Exception:
        log("岗位正文解析失败:\n" + traceback.format_exc())
    cost = (datetime.datetime.now() - t0).total_seconds()
    log(f"===== 招聘同步完成，耗时 {cost:.0f}s =====")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now()}] 致命错误:\n{traceback.format_exc()}\n")
        raise
