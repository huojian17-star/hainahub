# -*- coding: utf-8 -*-
"""信源抓取：3 个深度定制源 + 通用列表提取器（配置驱动，2026-08-13 扩展）

通用源：首页列表页抓 a 标签 + 附近日期，分类按标题/URL 关键词规则。
结构依据 dev/crawler/probe_sources.py 探查（2026-08-13）。
"""
import re, datetime
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
MAX_PER_SOURCE = 12

# ---------------- 通用源配置（2026-08-13 探查通过） ----------------
GENERIC_SOURCES = [
    {"key": "shou", "name": "上海海洋大学", "url": "https://www.shou.edu.cn", "type": "school"},
    {"key": "zjou", "name": "浙江海洋大学", "url": "https://www.zjou.edu.cn", "type": "school"},
    {"key": "gdou", "name": "广东海洋大学", "url": "https://www.gdou.edu.cn", "type": "school"},
    {"key": "ouc",  "name": "中国海洋大学", "url": "https://www.ouc.edu.cn", "type": "school"},
    {"key": "jmu",  "name": "集美大学", "url": "https://www.jmu.edu.cn", "type": "school"},
    {"key": "nmdis", "name": "国家海洋信息中心", "url": "https://www.nmdis.org.cn", "type": "inst"},
    {"key": "sio",  "name": "海洋二所(杭州)", "url": "https://www.sio.org.cn", "type": "inst"},
    {"key": "pric", "name": "中国极地研究中心", "url": "https://www.pric.org.cn", "type": "inst"},
]

# ---------------- 招聘栏源（2026-08-14：直接抓科研院所招聘列表页，分类固定招聘公告） ----------------
RECRUIT_SOURCES = [
    {"key": "scsio", "name": "南海海洋所", "url": "https://scsio.cas.cn/job/", "type": "inst"},
    {"key": "idsse", "name": "深海所", "url": "https://idsse.cas.cn/rcdw/rczp/", "type": "inst"},
    {"key": "qdio_recruit", "name": "中科院海洋所", "url": "https://qdio.cas.cn/2019Ver/Teams/recruit/", "type": "inst"},
    {"key": "pric_recruit", "name": "中国极地研究中心", "url": "https://www.pric.org.cn/index.php?c=category&id=60", "type": "inst"},
    {"key": "ouc_recruit", "name": "中国海洋大学", "url": "https://rsc.ouc.edu.cn/923/list.htm", "type": "school"},
    {"key": "shmtu_recruit", "name": "上海海事大学", "url": "https://www.shmtu.edu.cn/12207/list.htm", "type": "school"},
    {"key": "gdou_recruit", "name": "广东海洋大学", "url": "https://rsc.gdou.edu.cn/", "type": "school"},
    {"key": "dlou_recruit", "name": "大连海洋大学", "url": "https://rsc.dlou.edu.cn/8821/list.htm", "type": "school"},
    {"key": "sdmg_recruit", "name": "山东海洋集团", "url": "https://www.sdmg.cn/list/zhaopin.html", "type": "corp"},
    {"key": "tongji_recruit", "name": "同济大学海洋学院", "url": "https://mgg.tongji.edu.cn/10075/list.htm", "type": "school"},
    {"key": "zju_recruit", "name": "浙江大学海洋学院", "url": "http://oc.zju.edu.cn/hhyc/listm.htm", "type": "school"},
    {"key": "sysu_recruit", "name": "中山大学海洋科学学院", "url": "https://marine.sysu.edu.cn/taxonomy/term/180", "type": "school"},
    {"key": "highlander_recruit", "name": "海兰信", "url": "https://www.highlander.com.cn/join.html", "type": "corp"},
]

# 招聘启事标题特征（用于过滤导航/面包屑噪音）
RECRUIT_HINTS = ["招聘", "启事", "岗位", "人才", "博士后", "助理", "工程师", "研究员",
                 "正高级", "副高级", "特别研究", "优青", "引才", "课题", "教授", "科研"]


def crawl_recruit(cfg):
    """抓招聘栏列表页，只留招聘启事（标题含招聘特征词），分类固定招聘公告。"""
    soup = _fetch(cfg["url"])
    items, seen = [], set()
    for a in soup.find_all("a", href=True):
        t = a.get_text(strip=True)
        h = a["href"]
        if not t or len(t) < 8 or not h.startswith(("http", "/", "./")):
            continue
        if any(b in t for b in BAD_TITLE):
            continue
        if not any(k in t for k in RECRUIT_HINTS):
            continue  # 过滤导航/面包屑（"人才招聘""首页"等纯导航词）
        full = urljoin(cfg["url"], h)
        if full in seen:
            continue
        seen.add(full)
        items.append({
            "title": t, "url": full, "source": cfg["name"],
            "category": "招聘公告", "date": _date_near(a),
        })
        if len(items) >= MAX_PER_SOURCE:
            break
    return items


BAD_TITLE = ["版权所有", "备案", "设为首页", "加入收藏", "登录", "注册", "邮箱", "English",
             "无障碍", "中国政府网", "隐私声明", "网站地图", "联系我们", "友情链接", "更多",
             "返回顶部", "首页", "学校简介", "学校概况", "机构设置"]

def _fetch(url, **kw):
    r = requests.get(url, headers=UA, timeout=20, **kw)
    r.encoding = r.apparent_encoding or "utf-8"
    return BeautifulSoup(r.text, "lxml")

def _norm_date(s):
    if not s:
        return ""
    s = s.strip()
    m = re.search(r"(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.search(r"(\d{1,2})[-/.月](\d{1,2})", s)
    if m:
        y = datetime.date.today().year
        return f"{y}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    return ""

def _date_near(a):
    p = a
    for _ in range(4):
        p = p.parent
        if p is None:
            break
        for d in p.find_all(string=lambda s: s and re.search(r"\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}", s.strip())):
            return _norm_date(d.strip())
    return ""

def classify(title, url, src_type):
    """标题/URL 关键词 → 分类"""
    t = title + " " + url
    if re.search(r"招聘|拟聘|录用|公示|人事|岗位|人才|招录", t):
        return "招聘公告"
    if re.search(r"通知|公告|通告", t):
        return "通知公告"
    if re.search(r"科研|学术|论文|进展|成果|获奖|专利|发现|研究", t):
        return "科研动态"
    if re.search(r"讲座|报告|论坛|会议|研讨", t):
        return "学术活动"
    return "学校动态" if src_type == "school" else "综合动态"

def crawl_generic(cfg):
    soup = _fetch(cfg["url"])
    items, seen = [], set()
    for a in soup.find_all("a", href=True):
        t = a.get_text(strip=True)
        h = a["href"]
        if not t or len(t) < 10 or not h.startswith(("http", "/")):
            continue
        if any(b in t for b in BAD_TITLE):
            continue
        full = urljoin(cfg["url"], h)
        if full in seen:
            continue
        seen.add(full)
        items.append({
            "title": t, "url": full, "source": cfg["name"],
            "category": classify(t, full, cfg["type"]), "date": _date_near(a),
        })
        if len(items) >= MAX_PER_SOURCE:
            break
    return items

# ---------------- 日报/媒体源（海洋关键词筛选） ----------------

OCEAN_HINTS = ["海洋", "深海", "极地", "南极", "北极", "船舶", "航运", "珊瑚", "鲸",
               "海啸", "风暴潮", "海洋经济", "蓝碳", "海上风电", "海水淡化", "渔业",
               "水产", "海工", "舰船", "港口", "航道", "海岸带", "海洋牧场", "潜艇",
               "载人深潜", "大洋", "赤潮", "海冰", "海草", "红树林", "科考船", "海水"]

MEDIA_SOURCES = [
    {"key": "stdaily", "name": "科技日报", "url": "https://www.stdaily.com/", "type": "media"},
    {"key": "people", "name": "人民日报", "url": "http://www.people.com.cn/", "type": "media"},
]

def crawl_news_filtered(cfg):
    """日报/媒体源：抓列表页，只留标题含海洋关键词的新闻。"""
    soup = _fetch(cfg["url"])
    items, seen = [], set()
    for a in soup.find_all("a", href=True):
        t = a.get_text(strip=True)
        h = a["href"]
        if not t or len(t) < 8 or not h.startswith(("http", "/")):
            continue
        if any(b in t for b in BAD_TITLE):
            continue
        if not any(k in t for k in OCEAN_HINTS):
            continue  # 只留海洋相关
        full = urljoin(cfg["url"], h)
        if full in seen:
            continue
        seen.add(full)
        items.append({
            "title": t, "url": full, "source": cfg["name"],
            "category": classify(t, full, "media"), "date": _date_near(a),
        })
        if len(items) >= MAX_PER_SOURCE:
            break
    return items

# ---------------- 深度定制源（原 3 家，保留） ----------------

def _extract_date_near(a):
    return _date_near(a)

def crawl_dlmu():
    soup = _fetch("https://www.dlmu.edu.cn")
    items, seen = [], set()
    for a in soup.find_all("a", href=True):
        t = a.get_text(strip=True)
        h = a["href"]
        if not t or len(t) < 10:
            continue
        if not h.startswith("info/") and not h.startswith("http"):
            continue
        if "beian" in h or "版权所有" in t:
            continue
        full = urljoin("https://www.dlmu.edu.cn", h)
        if "info/1915/" in full:
            cat = "招聘公告"
        elif "info/2075/" in full or "info/1885/" in full or "news.dlmu.edu.cn" in full:
            cat = "学校动态"
        elif "info/2265/" in full or "info/2425/" in full:
            cat = "学术活动"
        else:
            continue
        if full in seen:
            continue
        seen.add(full)
        items.append({"title": t, "url": full, "source": "大连海事大学", "category": cat, "date": _extract_date_near(a)})
        if len(items) >= MAX_PER_SOURCE:
            break
    return items

def crawl_qdio():
    soup = _fetch("http://www.qdio.cas.cn")
    items, seen = [], set()
    for a in soup.find_all("a", href=True):
        t = a.get_text(strip=True)
        h = a["href"]
        if not t or len(t) < 10:
            continue
        full = urljoin("http://www.qdio.cas.cn", h)
        m = re.search(r"/News/(\w+)/", full)
        if not m or "2019Ver" not in full:
            continue
        cat_map = {"kyjz": "科研动态", "notice": "通知公告", "zhdt": "综合动态", "PicNews": "图片动态", "wzxw": "媒体转载", "tzgg": "通知公告"}
        cat = cat_map.get(m.group(1), "综合动态")
        if full in seen:
            continue
        seen.add(full)
        items.append({"title": t, "url": full, "source": "中科院海洋所", "category": cat, "date": _extract_date_near(a)})
        if len(items) >= MAX_PER_SOURCE:
            break
    return items

def crawl_mnr():
    soup = _fetch("https://www.mnr.gov.cn")
    items, seen = [], set()
    for a in soup.find_all("a", href=True):
        t = a.get_text(strip=True)
        h = a["href"]
        if not t or len(t) < 10:
            continue
        full = urljoin("https://www.mnr.gov.cn", h)
        if "gi.mnr.gov.cn" in full:
            cat = "招聘公告"
        elif "gk.mnr.gov.cn" in full and "/zc/" in full:
            cat = "政策文件"
        else:
            continue
        if full in seen:
            continue
        seen.add(full)
        items.append({"title": t, "url": full, "source": "自然资源部", "category": cat, "date": _extract_date_near(a)})
        if len(items) >= MAX_PER_SOURCE:
            break
    return items

# ---------------- 汇总 ----------------
SOURCES = {
    "dlmu": ("大连海事大学", crawl_dlmu),
    "qdio": ("中科院海洋所", crawl_qdio),
    "mnr": ("自然资源部", crawl_mnr),
}
for cfg in GENERIC_SOURCES:
    SOURCES[cfg["key"]] = (cfg["name"], lambda c=cfg: crawl_generic(c))

for cfg in RECRUIT_SOURCES:
    SOURCES[cfg["key"]] = (cfg["name"], lambda c=cfg: crawl_recruit(c))

for cfg in MEDIA_SOURCES:
    SOURCES[cfg["key"]] = (cfg["name"], lambda c=cfg: crawl_news_filtered(c))

def crawl_all():
    result = {}
    for key, (name, fn) in SOURCES.items():
        try:
            result[key] = fn()
        except Exception as e:
            result[key] = {"error": str(e)}
    return result
