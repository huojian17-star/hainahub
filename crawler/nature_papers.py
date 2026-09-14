# -*- coding: utf-8 -*-
"""Nature 论文抓取：RSS 抓取 + 海洋关键词筛选，返回海洋论文列表（供 LLM 解读）"""
import re, html, requests

UA = {'User-Agent': 'Mozilla/5.0 (research; contact: hainatougao@163.com)'}

OCEAN = re.compile(
    r'ocean|marine|sea\b|deep[- ]?sea|coral|reef|whale|dolphin|fishery|fisheries|'
    r'Arctic|Antarctic|coastal|estuar|mangrove|seagrass|krill|plankton|algal|'
    r'seaweed|kelp|aquaculture|submarine|seabed|benthic|tsunami|sea[- ]?level|'
    r'ice sheet|glacier|sea surface|shelf|currents|gyre|upwelling|storm surge|'
    r'thermohaline|el niño|la niña', re.I
)

FEEDS = [
    ("Nature", "https://www.nature.com/nature.rss"),
    ("Nature Geoscience", "https://www.nature.com/ngeo.rss"),
    ("Nature Climate Change", "https://www.nature.com/nclimate.rss"),
    ("Nature Communications", "https://www.nature.com/ncomms.rss"),
    ("Communications Earth & Environment", "https://www.nature.com/commsenv.rss"),
]

def _strip_cdata(s):
    if s is None:
        return ""
    s = s.strip()
    if s.startswith("<![CDATA["):
        s = s[9:-3]
    return html.unescape(s).strip()

def fetch_ocean_papers():
    """抓 5 个 Nature feed，筛海洋相关论文。返回 [{title, url, journal, date, abstract}]"""
    papers = []
    seen = set()
    for journal, url in FEEDS:
        try:
            r = requests.get(url, headers=UA, timeout=30)
            text = r.content.decode('utf-8', errors='replace')
        except Exception:
            continue
        items = re.findall(r'<item[^>]*>(.*?)</item>', text, re.S)
        for it in items:
            title = _strip_cdata(re.search(r'<title>(.*?)</title>', it, re.S).group(1) if re.search(r'<title>(.*?)</title>', it, re.S) else "")
            link = (re.search(r'<link>(.*?)</link>', it, re.S).group(1).strip() if re.search(r'<link>(.*?)</link>', it, re.S) else "")
            desc = re.search(r'<content:encoded>(.*?)</content:encoded>', it, re.S)
            abstract = re.sub(r'<[^>]+>', ' ', desc.group(1)).strip() if desc else ""
            abstract = re.sub(r'\s+', ' ', abstract)
            if not title or not OCEAN.search(title):
                continue
            if link in seen:
                continue
            seen.add(link)
            date = (re.search(r'<dc:date>(.*?)</dc:date>', it, re.S).group(1).strip() if re.search(r'<dc:date>(.*?)</dc:date>', it, re.S) else "")
            papers.append({
                "title": title, "url": link, "journal": journal,
                "date": date[:10] if date else "", "abstract": abstract,
            })
    return papers

if __name__ == "__main__":
    ps = fetch_ocean_papers()
    print(f"抓取海洋论文 {len(ps)} 条\n")
    for p in ps:
        print(f"[{p['journal']}] {p['title'][:60]}")
        print(f"  摘要: {p['abstract'][:80]}")
        print()
