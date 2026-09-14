# -*- coding: utf-8 -*-
"""海洋大数据资源池：数据集目录（ocean_catalog.db）访问层
提供 /api/ocean/collections（发现）和 /api/ocean/search（查询）的底层逻辑
"""
import os, json, sqlite3

CATALOG_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ocean_catalog.db")

def get_conn():
    conn = sqlite3.connect(CATALOG_DB)
    conn.row_factory = sqlite3.Row
    return conn

def list_datasets():
    """列出所有数据集（Agent 发现数据的第一步）"""
    conn = get_conn()
    rows = conn.execute("SELECT * FROM datasets ORDER BY type, id").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_dataset(dataset_id):
    """看单个数据集的完整元数据"""
    conn = get_conn()
    row = conn.execute("SELECT * FROM datasets WHERE id=?", (dataset_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def search_datasets(bbox=None, species=None, season=None, factors=None):
    """按条件查询数据集（Agent 消费数据）"""
    conn = get_conn()
    rows = conn.execute("SELECT * FROM datasets ORDER BY type, id").fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        # 物种过滤：dataset id 含物种 id 或 title 含中文名
        if species:
            if species.lower() not in d["id"] and species not in d["title"]:
                continue
        # bbox 过滤：数据集的 lat/lon 范围与 bbox 相交（简化：检查范围重叠）
        if bbox:
            lat_min, lon_min, lat_max, lon_max = bbox
            if not _bbox_overlap(d, lat_min, lon_min, lat_max, lon_max):
                continue
        results.append(d)
    return results

def _bbox_overlap(d, lat_min, lon_min, lat_max, lon_max):
    """检查数据集 lat/lon 范围是否与 bbox 相交"""
    try:
        if d["lat_range"] == "?" or not d["lat_range"]:
            return True  # 无范围信息，默认通过
        lat_s, lat_e = [float(x) for x in d["lat_range"].split("~")]
        lon_s, lon_e = [float(x) for x in d["lon_range"].split("~")]
        # 范围重叠判断
        return not (lat_e < lat_min or lat_s > lat_max or lon_e < lon_min or lon_s > lon_max)
    except Exception:
        return True  # 解析失败，默认通过
