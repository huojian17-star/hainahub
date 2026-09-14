# -*- coding: utf-8 -*-
"""海纳 · 物种图鉴扩容：按缺失门类批量枚举候选物种并入库
数据源：OBIS 枚举候选（按记录数排序=最常被观测到的物种优先）→ WoRMS 分类 → Wikimedia CC 图片 → OBIS 分布
用法：python species_expand.py <db_path> [每门类上限]
中文名/描述留空，由后续维基补全脚本（本地+代理）填充。
"""
import json
import os
import sqlite3
import sys
import time
import urllib.request
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from marine_species import fetch_worms, fetch_commons_image, fetch_obis_distribution, init_db

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# 扩容门类（WoRMS 学名, 每门类候选上限）：优先当前图鉴几乎空白的类群
TAXA = [
    ("Decapoda", 1200),        # 十足目（虾蟹）
    ("Bivalvia", 600),         # 双壳纲（贝类）
    ("Gastropoda", 600),       # 腹足纲（螺类）
    ("Echinodermata", 400),    # 棘皮动物（海星/海胆/海参）
    ("Anthozoa", 350),         # 珊瑚虫纲
    ("Cephalopoda", 200),      # 头足纲（补量）
    ("Scyphozoa", 100),        # 钵水母
    ("Rhodophyta", 250),       # 红藻
    ("Phaeophyceae", 150),     # 褐藻
    ("Ulvophyceae", 100),      # 绿藻
]

LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "expand.log")

def log(msg):
    line = "[%s] %s" % (time.strftime("%m-%d %H:%M:%S"), msg)
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def _get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def worms_aphia(taxon_name):
    """WoRMS 解析门类名的 AphiaID"""
    url = ("https://www.marinespecies.org/rest/AphiaRecordsByMatchNames?scientificnames[]="
           + urllib.parse.quote(taxon_name) + "&marine_only=true")
    data = _get(url)
    rec = data[0][0]
    if rec.get("rank", "").lower() not in ("superorder", "order", "subclass", "class", "phylum", "infraorder", "division", "phylum"):
        log("  警告: %s rank=%s" % (taxon_name, rec.get("rank")))
    return rec["AphiaID"]

def obis_species_list(taxon_name, cap):
    """OBIS checklist：枚举某分类下有观测记录的物种（自带分类树+记录数），按记录数降序"""
    url = ("https://api.obis.org/v3/checklist?scientificname=" + urllib.parse.quote(taxon_name)
           + "&size=%d" % min(cap * 3, 4000))
    data = _get(url, timeout=60)
    out = []
    for r in data.get("results", []):
        sci = r.get("scientificName")
        if not sci or " " not in sci:
            continue
        if r.get("taxonRank") != "Species":  # 只要种级
            continue
        if not r.get("is_marine"):
            continue
        out.append((sci, r.get("records", 0)))
    out.sort(key=lambda x: -x[1])
    return out[:cap]

def existing_names(db_path):
    conn = sqlite3.connect(db_path)
    names = {row[0].lower() for row in conn.execute("SELECT scientificname FROM species")}
    conn.close()
    return names

def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else "data/species.db"
    per_taxon_cap = int(sys.argv[2]) if len(sys.argv) > 2 else 99999
    have = existing_names(db_path)
    log("扩容启动：现有 %d 物种，每门类上限 %s" % (len(have), per_taxon_cap if per_taxon_cap < 9999 else "无"))
    conn = init_db(db_path)
    added = skipped_img = skipped_have = 0

    for taxon, cap in TAXA:
        log("== %s ==" % taxon)
        try:
            candidates = obis_species_list(taxon, min(cap, per_taxon_cap))
        except Exception as e:
            log("跳过 %s：OBIS 枚举失败 %s" % (taxon, repr(e)[:60]))
            continue
        log("候选 %d 个" % len(candidates))

        for sci, obis_count in candidates:
            if sci.lower() in have:
                skipped_have += 1
                continue
            worms = fetch_worms(sci)
            if not worms or worms.get("rank_flag"):
                continue
            if worms["scientificname"].lower() in have:
                skipped_have += 1
                continue
            img = fetch_commons_image(worms["scientificname"])
            if not img:
                skipped_img += 1
                time.sleep(0.3)
                continue
            obis = fetch_obis_distribution(worms["scientificname"])
            conn.execute("""INSERT OR REPLACE INTO species
                (scientificname, cn_name, aphia_id, kingdom, phylum, class, ordr, family, genus, authority,
                 image_url, license, artist, obis_total, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (worms["scientificname"], "", worms["aphia_id"], worms["kingdom"], worms["phylum"],
                 worms["class"], worms["order"], worms["family"], worms["genus"], worms["authority"],
                 img["image_url"], img["license"], img["artist"],
                 (obis or {}).get("total", obis_count), time.time()))
            conn.commit()
            have.add(worms["scientificname"].lower())
            added += 1
            log("  +%s [%s/%s] %s (OBIS %s)" % (worms["scientificname"], worms["phylum"], worms["class"], img["license"] or "无授权字段", (obis or {}).get("total", obis_count)))
            time.sleep(1)

        conn.commit()
        log("== %s 完成，当前新增累计 %d（无图跳过 %d，已存在跳过 %d）==" % (taxon, added, skipped_img, skipped_have))

    conn.close()
    log("全部完成：新增 %d 物种，总库 %d" % (added, len(have) + added))

if __name__ == "__main__":
    main()
