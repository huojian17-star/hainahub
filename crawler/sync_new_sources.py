# -*- coding: utf-8 -*-
"""扩信源后的一次性同步：抓取 + 入库 + 附件解析 + LLM 岗位解析"""
import traceback
from store import init_db, insert_articles
from sources import crawl_all

init_db()
result = crawl_all()
total_added = 0
for key, items in result.items():
    if isinstance(items, dict) and "error" in items:
        print(f"[{key}] 失败: {items['error'][:60]}")
        continue
    added = insert_articles(items)
    total_added += added
    print(f"[{key}] 抓到 {len(items)} 新增 {added}")
print(f"\n抓取完成，本轮新增资讯 {total_added} 条")

# 附件解析（免费）
print("\n=== 岗位表附件解析 ===")
try:
    from job_table_crawler import run as job_table_run
    job_table_run()
except Exception:
    print("附件解析失败:\n" + traceback.format_exc()[:500])

# LLM 正文解析岗位
print("\n=== LLM 岗位解析 ===")
try:
    from job_crawler import run as job_llm_run
    job_llm_run()
except Exception:
    print("LLM 解析失败:\n" + traceback.format_exc()[:500])

# 统计
from store import get_conn
c = get_conn()
total = c.execute("SELECT COUNT(*) FROM jobs WHERE status='active'").fetchone()[0]
rows = c.execute("SELECT source, COUNT(*) FROM jobs WHERE status='active' GROUP BY source ORDER BY COUNT(*) DESC").fetchall()
c.close()
print(f"\n===== active 岗位总数: {total} =====")
for s, n in rows:
    print(f"  {s}: {n}")
