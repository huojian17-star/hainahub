# -*- coding: utf-8 -*-
"""LLM 岗位解析：招聘公告正文 → 结构化岗位字段。

调用 DeepSeek（用户主模型 deepseek-v4-flash，便宜），按 major_tags 的标签体系打标。
输出：岗位数组，每个对象对应 jobs 表一行。
"""
import os
import json
import requests
from major_tags import MAJOR_TAGS, UNIT_TYPES, EDUCATION_LEVELS, tag_majors

# provider 配置：优先火山引擎（HAINA_LLM_* 环境变量或 .env），默认 DeepSeek 兜底
def _env_config():
    """读 reasonix/.env 的 LLM 配置（HAINA_LLM_* / DEEPSEEK_API_KEY）"""
    cfg = {}
    env_path = os.path.join(os.environ.get("APPDATA", ""), "reasonix", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    cfg[k.strip()] = v.strip().strip('"').strip("'")
    return cfg


_CFG = _env_config()
BASE_URL = os.environ.get("HAINA_LLM_BASE_URL") or _CFG.get("HAINA_LLM_BASE_URL") or "https://api.deepseek.com"
MODEL = os.environ.get("HAINA_LLM_MODEL") or _CFG.get("HAINA_LLM_MODEL") or "deepseek-v4-flash"
TIMEOUT = 90

# 单位名 → 城市 兜底（region 不规范时，用单位所在地补）
UNIT_CITY = {
    "海洋二所": "浙江-杭州",
    "第二海洋研究所": "浙江-杭州",
    "南海海洋所": "广东-广州",
    "南海所": "广东-广州",
    "深海所": "海南-三亚",
    "深海科学与工程": "海南-三亚",
    "海洋研究所": "山东-青岛",
    "海洋所": "山东-青岛",
    "大连海事": "辽宁-大连",
    "极地": "上海",
    "集美大学": "福建-厦门",
    "上海海洋": "上海",
    "浙江海洋": "浙江-舟山",
    "广东海洋": "广东-湛江",
    "中国海洋大学": "山东-青岛",
}


def region_clean(region, unit=""):
    """规范化 region 到"省-市"城市级。船名/区名/具体地址 → 单位所在地兜底。"""
    if not region:
        return ""
    region = region.strip().strip("“”\"'")
    # 已是"省-市"或"市"级（含省/含-且短）→ 保留
    if "省" in region or ("-" in region and len(region) <= 12):
        return region
    # 用单位兜底城市
    for k, city in UNIT_CITY.items():
        if k in unit:
            return city
    return region  # 无法判断，保留原文（后续人工/规则再清）


def get_deepseek_key():
    # 火山引擎 key 优先（HAINA_LLM_KEY，环境变量或 .env）
    ark = os.environ.get("HAINA_LLM_KEY") or _CFG.get("HAINA_LLM_KEY")
    if ark:
        return ark
    # DeepSeek key 兜底（环境变量或 .env）
    return os.environ.get("DEEPSEEK_API_KEY") or _CFG.get("DEEPSEEK_API_KEY") or ""


def _build_prompt(title, text):
    return f"""你是海洋领域招聘信息结构化助手。从下面的招聘公告中提取所有招聘岗位，输出 JSON。

每个岗位对象字段：
- title: 岗位名称（如"物理海洋学博士后""海洋化学科研助理"）；博士后岗不要只写"博士后"，写"博士后研究人员"或带方向（如"深海科学博士后"）
- unit: 招聘单位全称
- unit_type: 单位类型，只能从这些里选：{UNIT_TYPES}
- major: 专业方向，只能从这些里选（可多选，逗号分隔）：{MAJOR_TAGS}；若公告写"专业不限"则填"专业不限"，若没提专业则留空
- education: 学历要求，只能从这些里选：{EDUCATION_LEVELS}
- region: 工作地点（"省-市"格式，如"浙江-杭州""山东-青岛"；**只写城市，不要写区/县/船名/具体地址**；科考船岗位写其母港/所属单位所在城市；无法判断城市则留空）
- headcount: 招聘人数（如"2人""若干"）
- salary: 待遇（原文写法，无则"面议"）
- deadline: 报名/截止日期（YYYY-MM-DD 格式，无则空字符串）
- is_longterm: 是否长期招聘，只能填 0 或 1。公告写"长期招聘""常年有效""常年招聘""招满为止""长期有效"等字样填 1，否则填 0
- description: 完整提取两部分岗位信息，用"\n\n"分隔：①"岗位职责"（逐条）②"任职要求/条件"（专业要求、学历学位、年龄、工作地点、经验等关键限制）。尽量保留原文细节，不要省略成一句话

输出格式：{{"jobs": [ ... ]}}

公告标题：{title}

公告正文：
{text[:4000]}

规则：
1. 如果正文里有明确的岗位表/岗位清单，逐个提取。
2. 如果正文只说"招聘X个岗位，详见附件/附表"而没有岗位明细，jobs 输出 []。
3. 只输出 JSON，不要任何解释文字。"""


def parse_jobs(title, text):
    """解析公告 → 岗位数组。失败/无岗位返回 []。"""
    key = get_deepseek_key()
    if not key:
        return []
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": _build_prompt(title, text)}],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 8000,
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        r = requests.post(BASE_URL + "/chat/completions", json=payload, headers=headers, timeout=TIMEOUT)
        if r.status_code != 200:
            return []
        data = r.json()
        content = data["choices"][0]["message"]["content"]
        obj = json.loads(content)
        jobs = obj.get("jobs", [])
        return jobs if isinstance(jobs, list) else []
    except Exception as e:
        print(f"[llm_parse] error: {type(e).__name__}: {str(e)[:120]}")
        return []


def normalize_jobs(jobs, fallback_title="", fallback_url=""):
    """把 LLM 输出的岗位对象规整成 insert_jobs 能吃的格式。
    major 若 LLM 没给，用关键词规则兜底（title+description 打标）。
    """
    out = []
    for j in jobs:
        if not isinstance(j, dict) or not j.get("title"):
            continue
        major = j.get("major", "").strip()
        if not major:
            # 关键词兜底
            hits = tag_majors((j.get("title", "") + " " + j.get("description", "")))
            major = ",".join(hits)
        out.append({
            "title": j.get("title", ""),
            "unit": j.get("unit", ""),
            "unit_type": j.get("unit_type", ""),
            "major": major,
            "education": j.get("education", ""),
            "region": region_clean(j.get("region", ""), j.get("unit", "")),
            "headcount": j.get("headcount", ""),
            "salary": j.get("salary", ""),
            "deadline": j.get("deadline", ""),
            "is_longterm": 1 if str(j.get("is_longterm", "")).strip() in ("1", "true", "True") else 0,
            "publish_date": "",
            "url": fallback_url,
            "source": "",
            "description": j.get("description", ""),
        })
    return out
