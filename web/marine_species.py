# -*- coding: utf-8 -*-
"""海纳 · 海洋生物图鉴 — 精选物种数据采集
数据源（全部无 key，权威）：
  - WoRMS（marinespecies.org REST）：物种分类/学名/AphiaID
  - Wikimedia Commons（CC 授权）：物种图片（需署名）
  - OBIS（api.obis.org）：物种分布记录（经纬度）
本脚本采集精选物种数据到 SQLite（species 表），供 /api/species/* 接口读取。
"""
import json
import os
import sqlite3
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

# 浏览器 UA（Wikimedia 等对机器人 UA 限流更严，用浏览器 UA 避免 429）
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# 精选物种清单（学名，优先选有 Wikimedia CC 图片、OBIS 分布的代表性海洋生物）
# 覆盖：鲸豚类、鲨鱼/鳐鱼、海龟、无脊椎（水母/章鱼/珊瑚）、鱼类、甲壳类、海兽
SPECIES_LIST = [
    # (学名, 中文名)
    # 鲸豚类
    ("Balaenoptera musculus", "蓝鲸"),
    ("Megaptera novaeangliae", "座头鲸"),
    ("Orcinus orca", "虎鲸"),
    ("Physeter macrocephalus", "抹香鲸"),
    ("Tursiops truncatus", "宽吻海豚"),
    ("Sousa chinensis", "中华白海豚"),
    ("Balaenoptera physalus", "长须鲸"),
    # 鲨鱼/鳐鱼
    ("Carcharodon carcharias", "大白鲨"),
    ("Rhincodon typus", "鲸鲨"),
    ("Galeocerdo cuvier", "虎鲨"),
    ("Sphyrna lewini", "路氏双髻鲨"),
    ("Mobula birostris", "巨型蝠鲼"),
    ("Prionace glauca", "蓝鲨"),
    ("Isurus oxyrinchus", "尖吻鲭鲨"),
    # 海龟
    ("Chelonia mydas", "绿海龟"),
    ("Dermochelys coriacea", "棱皮龟"),
    ("Eretmochelys imbricata", "玳瑁"),
    # 无脊椎
    ("Aurelia aurita", "海月水母"),
    ("Physalia physalis", "僧帽水母"),
    ("Octopus vulgaris", "普通章鱼"),
    ("Sepia officinalis", "墨鱼"),
    ("Nautilus pompilius", "鹦鹉螺"),
    ("Acropora cervicornis", "鹿角珊瑚"),
    ("Panulirus homarus", "龙虾"),
    ("Paralithodes camtschaticus", "帝王蟹"),
    # 鱼类
    ("Amphiprion ocellaris", "小丑鱼"),
    ("Thunnus thynnus", "蓝鳍金枪鱼"),
    ("Istiophorus platypterus", "平鳍旗鱼"),
    ("Exocoetus volitans", "飞鱼"),
    ("Hippocampus kuda", "海马"),
    ("Anguilla anguilla", "欧洲鳗鲡"),
    ("Mola mola", "翻车鱼"),
    ("Lutjanus argentimaculatus", "紫红笛鲷"),
    ("Epinephelus coioides", "点带石斑鱼"),
    # 海兽
    ("Aptenodytes forsteri", "帝企鹅"),
    ("Phoca vitulina", "斑海豹"),
    ("Zalophus californianus", "加州海狮"),
    # 其他
    ("Dugong dugon", "儒艮"),
    ("Hydrophis platurus", "黄腹海蛇"),
]


def _get(url):
    """GET 请求返回 JSON（带浏览器 UA 避免限流，429 重试，超时 15s）"""
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": _UA})
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:
                time.sleep(5)  # 429 限流，等 5s 重试
                continue
            raise
    return None


def fetch_worms(sci_name):
    """WoRMS 查物种分类。返回 dict（学名/AphiaID/分类），找不到返回 None"""
    try:
        url = "https://www.marinespecies.org/rest/AphiaRecordsByMatchNames?scientificnames[]=" + urllib.parse.quote(sci_name) + "&marine_only=true"
        data = _get(url)
        if not data or not data[0]:
            return None
        d = data[0][0]
        return {
            "scientificname": d.get("scientificname") or sci_name,
            "aphia_id": d.get("AphiaID"),
            "kingdom": d.get("kingdom") or "",
            "phylum": d.get("phylum") or "",
            "class": d.get("class") or "",
            "order": d.get("order") or "",
            "family": d.get("family") or "",
            "genus": d.get("genus") or "",
            "authority": d.get("authority") or "",
            "valid_name": d.get("valid_name") or "",
        }
    except Exception:
        return None


def fetch_commons_image(sci_name, save_dir="static/img/species"):
    """Wikimedia Commons 搜物种图片（CC 授权）。返回 dict（本地图片URL/授权/作者），找不到返回 None
    下载图片到本地静态目录（Wikimedia 服务器国内访问超时，前端不能直接外链，需存本地）
    """
    try:
        url = ("https://commons.wikimedia.org/w/api.php?action=query&generator=search"
               "&gsrsearch=" + urllib.parse.quote(sci_name) + "&gsrlimit=3&gsrnamespace=6"
               "&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=400&format=json")
        data = _get(url)
        pages = data.get("query", {}).get("pages", {})
        for pid in sorted(pages, key=lambda k: int(k)):  # 按 pageid 排序（稳定）
            p = pages[pid]
            title = p.get("title", "")
            # 跳过分布图/地图（标题含 distmap / distribution map / range map），优先真实照片
            tl = title.lower()
            if any(k in tl for k in ("distmap", "distribution map", "range map", "dist map", "map.png", "map.jpg", "aphid", "worms", ".pdf", "specimen label")):
                continue
            info = p.get("imageinfo", [{}])[0]
            # 只收位图：PDF/论文渲染页混进搜索会得到文档假图（杜氏剑尾海蛇事故根因）
            if info.get("mime") not in ("image/jpeg", "image/png", None):
                continue
            if not info.get("thumburl"):
                continue
            ext = info.get("extmetadata", {})
            lic = ext.get("LicenseShortName", {}).get("value", "")
            # 只要 CC 授权（BY/BY-SA/CC0），非自由授权跳过
            if lic and not any(x in lic for x in ("CC", "Public domain", "CC0")):
                continue
            # 下载图片到本地
            os.makedirs(save_dir, exist_ok=True)
            ext_name = _guess_ext(info.get("thumburl", ""))
            fname = _slug(sci_name) + ext_name
            local_path = os.path.join(save_dir, fname)
            try:
                for attempt in range(3):
                    try:
                        req = urllib.request.Request(info["thumburl"], headers={"User-Agent": _UA})
                        with urllib.request.urlopen(req, timeout=25) as resp:
                            img_data = resp.read()
                        break
                    except urllib.error.HTTPError as e:
                        if e.code == 429 and attempt < 2:
                            time.sleep(5)  # 429 限流，等 5s 重试
                            continue
                        raise
                with open(local_path, "wb") as f:
                    f.write(img_data)
            except Exception:
                continue  # 下载失败跳过
            return {
                "image_url": "/static/img/species/" + fname,
                "license": lic,
                "artist": _strip_html(ext.get("Artist", {}).get("value", ""))[:200],
                "attribution_required": ext.get("AttributionRequired", {}).get("value", "true") == "true",
            }
        return None
    except Exception:
        return None


def _guess_ext(url):
    """从 URL 猜图片扩展名"""
    import re
    m = re.search(r"\.(jpg|jpeg|png|gif|webp)", url, re.I)
    return "." + (m.group(1).lower() if m else "jpg")


def _slug(s):
    """学名转文件名安全字符"""
    import re
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def _strip_html(s):
    """去掉 HTML 标签（作者字段可能含 <a> 标签）"""
    import re
    return re.sub(r"<[^>]+>", "", s).strip()


def fetch_obis_distribution(sci_name, limit=200):
    """OBIS 查物种分布。返回 {total, points: [(lat,lon),...]}，找不到返回 None
    加 fields 参数只取经纬度（否则返回所有字段，数据大查询慢 31s → 2.4s）
    """
    try:
        url = ("https://api.obis.org/v3/occurrence?scientificname=" + urllib.parse.quote(sci_name)
               + "&size=" + str(limit) + "&fields=decimalLatitude,decimalLongitude")
        data = _get(url)
        total = data.get("total", 0)
        points = []
        for rec in data.get("results", []):
            lat = rec.get("decimalLatitude")
            lon = rec.get("decimalLongitude")
            if lat is not None and lon is not None:
                points.append((lat, lon))
        return {"total": total, "points": points}
    except Exception:
        return None


def init_db(db_path):
    conn = sqlite3.connect(db_path)
    conn.execute("""CREATE TABLE IF NOT EXISTS species (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scientificname TEXT UNIQUE,
        cn_name TEXT,
        aphia_id INTEGER,
        kingdom TEXT, phylum TEXT, class TEXT, ordr TEXT, family TEXT, genus TEXT,
        authority TEXT,
        image_url TEXT, license TEXT, artist TEXT,
        obis_total INTEGER,
        updated_at REAL
    )""")
    conn.commit()
    return conn


def collect(db_path):
    conn = init_db(db_path)
    for item in SPECIES_LIST:
        # 支持 (学名, 中文名) 元组或纯学名字符串
        if isinstance(item, tuple):
            sci_name, cn_name = item[0], item[1]
        else:
            sci_name, cn_name = item, ""
        print("采集:", sci_name, cn_name)
        worms = fetch_worms(sci_name)
        if not worms:
            print("  WoRMS 未找到，跳过")
            continue
        img = fetch_commons_image(sci_name)
        obis = fetch_obis_distribution(sci_name)
        conn.execute("""INSERT OR REPLACE INTO species
            (scientificname, cn_name, aphia_id, kingdom, phylum, class, ordr, family, genus, authority,
             image_url, license, artist, obis_total, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (worms["scientificname"], cn_name, worms["aphia_id"], worms["kingdom"], worms["phylum"],
             worms["class"], worms["order"], worms["family"], worms["genus"], worms["authority"],
             (img or {}).get("image_url"), (img or {}).get("license"), (img or {}).get("artist"),
             (obis or {}).get("total", 0), time.time()))
        print("  分类:", worms["phylum"], "/", worms["class"])
        print("  图片:", (img or {}).get("license", "无"), "| OBIS:", (obis or {}).get("total", 0), "条")
        time.sleep(0.5)  # 礼貌延时
    conn.commit()
    conn.close()
    print("采集完成")


if __name__ == "__main__":
    db = sys.argv[1] if len(sys.argv) > 1 else "species.db"
    collect(db)
