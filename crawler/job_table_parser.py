# -*- coding: utf-8 -*-
"""通用 Excel 岗位表解析器：事业单位统招岗位表（xlsx）→ jobs 结构化字段。

思路：定位表头行（含"岗位/招聘/专业/学历/人数"等关键词的行）→ 按表头名模糊映射字段 → 逐行解析。
不同单位的岗位表表头略有差异，靠关键词模糊匹配兼容。
"""
import openpyxl
from major_tags import tag_majors

# 表头 → 字段 的映射（按优先级，先匹配到先得）
FIELD_RULES = [
    ("title", ["招聘岗位", "岗位名称", "岗位"]),
    ("unit", ["招聘部门", "用人单位", "所属部门", "部门", "单位"]),
    ("headcount", ["招聘人数", "拟招人数", "人数"]),
    ("education", ["学历", "学位"]),
    ("major", ["专业"]),
    ("region", ["工作地点", "工作地", "地点", "城市"]),
    ("description", ["岗位职责", "职责"]),
    ("requirement", ["岗位要求", "任职要求", "要求"]),
]

# 表头定位：至少命中 3 个关键词才算表头行
HEADER_HINTS = ["岗位", "招聘", "专业", "学历", "人数", "部门", "职责"]


def guess_unit_type(unit):
    """按单位名猜类型：大学/学院→高校，集团/公司→企业，局/中心/所/院→事业单位"""
    u = unit or ""
    if any(k in u for k in ["大学", "学院", "学校"]):
        return "高校"
    if any(k in u for k in ["集团", "公司", "股份", "有限公司"]):
        return "企业"
    return "事业单位"


def parse_xlsx(path, fallback_url="", fallback_source="", fallback_date="", unit_name=""):
    """解析岗位表，返回 jobs 列表（字段对齐 store.insert_jobs）。
    unit_name: 公告的顶层单位全称（如"自然资源部第二海洋研究所"），用于和部门组合。
    """
    wb = openpyxl.load_workbook(path, data_only=True)
    jobs = []
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue

        # 定位表头行
        header_idx = None
        header = []
        for i, row in enumerate(rows):
            cells = [str(c).strip() if c is not None else "" for c in row]
            hits = sum(1 for c in cells if any(k in c for k in HEADER_HINTS))
            if hits >= 3:
                header_idx, header = i, cells
                break
        if header_idx is None:
            continue

        # 字段映射：字段 -> 列索引
        col_map = {}
        for field, kws in FIELD_RULES:
            for ci, h in enumerate(header):
                if not h:
                    continue
                if any(k in h for k in kws):
                    if field == "title" and ("职责" in h or "要求" in h):
                        continue  # "岗位职责/岗位要求" 不是岗位名
                    col_map.setdefault(field, ci)
                    break
        if "title" not in col_map:
            continue

        # 解析数据行
        for row in rows[header_idx + 1:]:
            def cell(field):
                ci = col_map.get(field)
                if ci is None or ci >= len(row):
                    return ""
                v = row[ci]
                return str(v).strip() if v is not None else ""

            title = cell("title")
            if not title or title in ("序号", "合计", "总计", "备注") or title.startswith("注"):
                continue

            raw_major = cell("major")
            majors = tag_majors(raw_major) if raw_major and "不限" not in raw_major else []
            dept = cell("unit")
            unit = unit_name if unit_name else dept
            if unit_name and dept and dept not in unit_name:
                unit = f"{unit_name}·{dept}"
            desc_parts = [p for p in (cell("description"), cell("requirement")) if p]

            jobs.append({
                "title": title,
                "unit": unit,
                "unit_type": guess_unit_type(unit),
                "major": ",".join(majors),
                "education": cell("education"),
                "region": cell("region"),
                "headcount": cell("headcount"),
                "salary": "",
                "deadline": "",
                "publish_date": fallback_date,
                "url": fallback_url,
                "source": fallback_source,
                "description": "；".join(desc_parts)[:500],
            })
    return jobs


if __name__ == "__main__":
    # 自测：解析探活样本
    import sys
    p = sys.argv[1] if len(sys.argv) > 1 else "data/probe_jobtable.xlsx"
    result = parse_xlsx(p, fallback_url="https://www.sio.org.cn/a/tzgg/23191.html",
                        fallback_source="海洋二所(杭州)", fallback_date="2026-04-13")
    print(f"解析出 {len(result)} 个岗位\n")
    for j in result[:5]:
        print(f"- {j['title']} | {j['unit']} | {j['unit_type']} | 专业[{j['major'] or '无'}] | {j['education']} | {j['region']} | {j['headcount']}")
