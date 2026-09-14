# -*- coding: utf-8 -*-
"""SDM RAG 检索模块：海洋学知识库 + 关键词匹配检索（简单可靠，不用 TF-IDF 分词）
关键词命中即返回对应知识段落，喂给大模型做生态解读。"""
import re

# 关键词 → 知识段落 映射（query 含关键词就返回对应段落）
# 每条知识标注来源（权威文献/数据库），确保不是臆测
KB_RULES = [
    (["冷水", "耐冷", "高温", "海温", "温度", "适温", "sst", "水温"], 
     "鱼类适温性分三档：①冷水性鱼类适温约 0-12°C，最适偏低，如鳕鱼、鲑鱼、鲱鱼、黑线鳕、比目鱼，代谢率低，对高温敏感，水温超 14-16°C 抑制生长繁殖摄食，分布向高纬度/冷水区偏移；大西洋鳕最适约 4-11°C，黑线鳕约 2-9°C。②温带暖水性鱼类适温约 10-18°C，如鲭鱼、带鱼、黄鱼，季节性南北洄游，春季向高纬度索饵、秋季返回低纬度越冬。③暖水性鱼类适温约 18-30°C，如金枪鱼、鲷鱼、石斑鱼。\n来源：FAO 渔业分类手册、FishBase 生态类型表（fishbase.org）"),
    (["中上层", "上层", "集群", "浮游", "表"],
     "中上层鱼类栖息于水体中上层（0-200m），如鲱鱼、鲭鱼、沙丁鱼，常集群生活，以浮游动物为食，依赖叶绿素/初级生产力（浮游植物→浮游动物→鱼类食物链），追随高初级生产力区。中上层鱼类对海温、洋流敏感，随水团移动。\n来源：FishBase 生态类型表、海洋生态学教材"),
    (["底栖", "近底层", "深", "陆架", "陆坡", "depth", "水深"],
     "底栖鱼类栖息于海底或近底层，如鳕鱼、比目鱼，适深范围广（几十米到几百米），多分布于陆架-陆坡过渡带（50-1000m）。水深通过影响底栖饵料可得性、光照、压力调控鱼类分布。陆架区（<200m）初级生产力高、饵料丰富，是多数经济鱼类重要栖息地。深海底栖鱼类（如比目鱼）适温低（约 2-8°C），生长缓慢寿命长。\n来源：FishBase 生态类型表、FAO 渔业手册"),
    (["洄游", "产卵", "索饵", "繁殖", "产卵场", "越冬"],
     "鱼类洄游类型：①产卵洄游——为繁殖从索饵场向产卵场洄游，受水温/盐度/流场调控，冷水性鱼类产卵场多在冷水区；②索饵洄游——为摄食向饵料丰富区（叶绿素→初级生产力）洄游；③越冬洄游——为避寒向深水/低纬度洄游。温带暖水性鱼类（如鲭鱼）做季节性南北洄游：春季向高纬度索饵、秋季返回低纬度越冬。海温变动是洄游路线偏移首要驱动。\n来源：FAO 渔业手册、FishBase 洄游资料"),
    (["生态位", "竞争", "释放", "耐冷", "耐暖", "分化"],
     "生态位是物种在生态系统中的功能位置。竞争释放：当两个生态位相近的物种共存时，它们会通过生态位分化（如一个更耐冷、一个更耐暖）降低竞争。大西洋鳕和黑线鳕共享北大西洋生态位，但大西洋鳕更耐暖（峰值 11°C），黑线鳕更耐冷（峰值 9°C），生态位分化显著。环境变化（如升温）会改变竞争平衡——升温有利于耐暖物种，降温有利于耐冷物种。\n来源：海洋生态学教材、FishBase 生态类型表"),
    (["叶绿素", "chl", "初级生产力", "饵料", "食物", "食物链", "浮游植物", "浮游动物"],
     "食物链是理解海洋生态的关键。海洋食物网的基础是浮游植物（含叶绿素），它们通过光合作用固定能量，是海洋初级生产力的来源。叶绿素浓度是初级生产力的代理指标，也是「食物」的底层指标。食物链层级：浮游植物（叶绿素）→ 浮游动物 → 小型鱼类 → 大型肉食性鱼类。因此：①叶绿素高的区域（上升流区、陆架区）初级生产力高，浮游植物多，浮游动物随之增多，饵料丰富，鱼类聚集；②不同鱼类对「食物」的依赖不同：中上层鱼类（鲱鱼/鲭鱼）直接以浮游动物为食，依赖叶绿素/初级生产力；底栖鱼类（鳕鱼/比目鱼）以底栖饵料为食，间接依赖初级生产力沉降。用户调整叶绿素（chl）滑块时，应解读为「食物链底端生产力变化」——chl 高代表饵料基础好，浮游动物和鱼类更易聚集；chl 低代表饵料不足，鱼类可能迁离。\n来源：海洋生态学教材、FAO 渔业手册"),
    (["盐度", "sal", "渗透"],
     "盐度影响渗透压调节。多数海洋鱼类适盐范围较宽（30-38 PSU），但河口/半咸水鱼类对盐度敏感。盐度通过影响水团稳定性、饵料分布间接影响鱼类。\n来源：FishBase 生态类型表"),
    (["洋流", "sla", "海面高度", "流场", "水团"],
     "洋流（海面高度异常 sla）反映洋流强度、水团稳定性，影响幼体扩散、饵料输送。洋流通过输送饵料、扩散幼体影响鱼类分布。中上层鱼类随暖流/冷水团扩展或收缩分布范围。\n来源：海洋生态学教材、FishBase 生态类型表"),
    # === 智渔牧海：中国鱼种知识 ===
    (["小黄鱼", "larimichthys", "polyactis", "黄鱼"],
     '小黄鱼（Larimichthys polyactis）是暖温性近底层集群鱼类，分布于渤海、黄海、东海软泥/泥沙底质海区，水深一般不超过 100m。底层水温偏好分季节：春季（产卵期）最适约 12-17°C（产卵场实测 9.65-16.64°C，黄海南部 9.65-12.17°C、东海 10.13-16.64°C），夏季最适 15-22°C，秋季（索饵期）最适约 12-17°C，冬季越冬场 7-12°C（越冬渔场热点 11-16°C）；全年模型偏好温度 9.4-24.2°C（FishBase）。注意：上述为底层水温口径，卫星海表温（SST）对这种底层鱼是间接代理（夏季跃层期表层远热于底层）。春季向近岸浅水产卵洄游，秋冬季向深水/外海越冬，水温过高（表层持续 >26°C 且无深水避暑空间）才构成真实热胁迫。是中国重要经济鱼种。\\n来源：林龙山等，生态学报 2008（产卵场）；Frontiers in Marine Science 2022/2026（季节最适底层水温）；FishBase（偏好温度）；应用生态学报 2021 舟山 GAM（12-16°C 资源量随底温上升，>16°C 下降）'),
    (["大黄鱼", "crocea", "大黄鱼"],
     '大黄鱼（Larimichthys crocea）是暖温性近海集群洄游鱼类，栖息于 60-80m 以浅的近海中下层，分布于黄海南部至南海雷州半岛以东。广温广盐，耐受水温 8-32°C；不同生活阶段水温选择：越冬场（12月-翌年3月）9-11°C，产卵期 15-22°C（春汛 15-17°C 开始集群产卵），养殖最佳生长 22-26°C。产卵期 4-6 月（春宗）和 9-10 月（秋宗），产卵后在产卵场外侧索饵，秋末冬初向深水越冬场洄游。是中国特有经济鱼类，东海四大海产之一。\\n来源：岱衢族大黄鱼栖息地与资源重建研究（中国水产科学：越冬 9-11°C、产卵 15-22°C）；大黄鱼养殖技术文献（最佳生长 22-26°C、耐受 8-32°C）'),
    (["蓝点马鲛", "scomberomorus", "niphonius", "马鲛"],
     '蓝点马鲛（Scomberomorus niphonius，俗称鲅鱼）是暖温性中上层长距离洄游鱼类，分布于渤海、黄海、东海及日本、朝鲜半岛近海。理想水温范围 10-24°C；北上生殖洄游期 4 月适温 9-11°C（最适约 10°C）、5 月适温 11-14°C（最适 12-13°C）；产卵期（5-7 月，由南向北推迟）适温 13-20°C（最适 14-16°C）；越冬场在东海外海和济州岛西南部，水深 80-100m，1-2 月越冬、3 月起生殖洄游、9-11 月索饵洄游返回越冬场。繁殖成功率与海表温呈负相关，过高水温不利当年产卵。游速快，以鳀鱼等小型鱼类为食，追随高生产力（叶绿素高）海域，是黄渤海重要经济鱼种。\\n来源：蓝点马鲛野生捕捞物种评估报告（2024）；蓝点马鲛渔业生物学研究进展；蓝点马鲛生物学特性文献（分阶段适温）'),
    # === 智渔牧海：海洋牧场水质监测预警知识 ===
    (["赤潮", "藻华", "叶绿素高", "富营养化", "red_tide"],
     "赤潮（有害藻华）是海水富营养化导致浮游藻类异常增殖的现象。卫星遥感叶绿素浓度异常升高（通常 >10 mg/m³ 预警、>50 mg/m³ 高风险）是赤潮的重要指示。赤潮危害：①藻类大量繁殖消耗溶氧，导致缺氧；②部分藻类分泌毒素，毒害鱼类；③藻类死亡分解进一步耗氧。对海洋牧场，赤潮可导致养殖鱼类大规模死亡。应对：加强监测、及时增氧、必要时提前收捕、减少投喂。\n来源：NOAA 赤潮监测、海洋生态学教材"),
    (["缺氧", "溶氧", "hypoxia", "溶解氧", "低氧"],
     "缺氧是水体溶解氧过低（<2 mg/L 缺氧、<4 mg/L 低氧）导致鱼类窒息死亡的现象。近岸缺氧常由富营养化（叶绿素高）+ 水温升高 + 水体分层共同引发：藻类爆发→夜间/死亡分解耗氧；水温高→溶氧溶解度下降。溶氧是**非光学活性**参数，无法直接卫星遥感，需用 SST（主驱动，水温高→溶氧低）+ 叶绿素 + 时间滞后（约14天）等代理指标反演。对海洋牧场，缺氧是夏季鱼类死亡主因，应对：增氧机、换水、减少养殖密度。\n来源：黄海/渤海缺氧遥感研究、海洋生态学教材"),
    (["养殖", "牧场", "牧场区", "水产", "渔业", "应对"],
     "海洋牧场水质监测核心是保障养殖鱼类健康。养殖设施（浮标/网箱）会干扰卫星遥感信号，导致牧场区水质反演不准，需做养殖设施光谱干扰校正。养殖户关注：①水温是否超出鱼种适温范围；②叶绿素是否异常升高（赤潮风险）；③溶氧是否过低（缺氧风险）。应对措施：水温过高→减少投喂/换水；叶绿素高→关注赤潮/增氧；溶氧低→开增氧机。SDM 生态位模型可预测水质变化对具体鱼种适宜性的影响，辅助养殖决策。\n来源：海洋牧场水质监测研究、渔业养殖技术手册"),
]

def retrieve(query, top_k=3):
    """检索与 query 最相关的知识段落（关键词命中）"""
    q = query.lower()
    hits = []
    for keywords, text in KB_RULES:
        # 统计 query 命中几个关键词
        score = sum(1 for kw in keywords if kw in q)
        if score > 0:
            hits.append((score, text))
    # 按命中数排序，取 top_k
    hits.sort(key=lambda x: x[0], reverse=True)
    return [text for _, text in hits[:top_k]]


import urllib.request, urllib.parse, ssl, json, time, os

# 学名 → 英文维基俗名 映射（维基百科主要用英文俗名，学名词条常空/重定向）
WIKI_COMMON_NAME = {
    "Gadus morhua": "Atlantic cod",
    "Melanogrammus aeglefinus": "Haddock",
    "Clupea harengus": "Atlantic herring",
    "Scomber scombrus": "Atlantic mackerel",
    "Hippoglossus hippoglossus": "Atlantic halibut",
    "Larimichthys polyactis": "Small yellow croaker",
    "Larimichthys crocea": "Large yellow croaker",
    "Scomberomorus niphonius": "Japanese Spanish mackerel",
}

def _http_get(url, timeout=20, retries=3):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    last_err = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "HainaOceanPlatform/1.0"})
            with urllib.request.urlopen(req, context=ctx, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            last_err = e
            time.sleep(1.5)
    raise last_err

# 权威信源白名单（Exa 检索优先限定，域内无结果时放开兜底）
# 中文去 AI 味文风禁令（AI 解读输出用）。来源：haina-writing 7 条速查 + humanizer-zh-next 33 类模式精选
# （虚假引用/导览腔/客服腔是解读输出高发区；数值与事实规则见各 prompt 解读要求）
STYLE_RULES = """
1. 禁用破折号“——”做补充解释（英文习惯，中文读感是翻译腔）：拆成两句，或用冒号、括号
2. 禁用否定转折句式：“不是……而是……”“不再只是……”“并非X，而是Y”
3. 禁用空洞大词：赋能、深耕、打造、闭环、抓手、底层逻辑、显著提升、深远影响、里程碑
4. 禁用虚假引用：“专家指出”“业内人士认为”等无来源背书（海纳要求数据可溯源）
5. 禁用导览腔与客服腔：“让我们深入探讨”“下面我们来拆解”“希望以上信息对您有所帮助”
6. 禁用鸡汤收尾：“未来可期”“让我们拭目以待”“这只是开始”；结尾给具体判断或建议
7. 禁用意义拔高：“标志着……新阶段”“具有里程碑式意义”
8. 句子长短交错，别每句等长；指代同一物种直接重复名字，别用“该物种/该鱼种/这一鱼类”轮换
9. 一句里连续三个以上“的”的修饰链要拆；能用短句不用长句
10. 全文纯文本：不用 markdown 加粗/标题/列表符号，段落之间空行
"""


AUTHORITATIVE_DOMAINS = [
    "fishbase.org", "fishbase.se", "fishbase.us",
    "fao.org", "noaa.gov",
    "frontiersin.org", "nature.com", "sciencedirect.com", "link.springer.com",
    "onlinelibrary.wiley.com", "mdpi.com", "plos.org", "pubmed.ncbi.nlm.nih.gov",
    "ecologica.cn", "fishscichina.com", "china-fishery.org.cn", "cjae.net", "aquaticjournal.com",
]


def _exa_search(payload):
    req = urllib.request.Request("https://api.exa.ai/search",
        data=json.dumps(payload).encode(),
        headers={"x-api-key": os.environ.get("EXA_API_KEY", ""), "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode()).get("results", [])


def fetch_exa(species, lang="en"):
    """用 Exa 搜索物种生态数据（适温/水层/洄游），返回带来源 URL 的摘要。
    优先限定权威信源（FishBase/FAO/NOAA/同行评审期刊/国内核心水产期刊），
    权威域内无结果时放开域名限制兜底（保证冷门物种有材料可用）。
    返回 (生态文本, 来源url列表)。失败返回 ("", [])。"""
    if not os.environ.get("EXA_API_KEY", ""):
        return "", []
    query = f"{species} temperature depth habitat migration"
    base_payload = {
        "query": query,
        "numResults": 3,
        "contents": {"highlights": {"numSentences": 3, "query": "temperature depth habitat"}},
    }
    results = []
    try:
        results = _exa_search(dict(base_payload, includeDomains=AUTHORITATIVE_DOMAINS))
        if not results:
            results = _exa_search(base_payload)
    except Exception:
        return "", []
    texts, urls = [], []
    for res in results[:3]:
        hl = res.get("highlights", [])
        if hl:
            texts.append(hl[0])
            urls.append(res.get("url", ""))
    return "\n".join(texts)[:1000], urls

def fetch_wikipedia(species, lang="en"):
    """按物种拉维基百科生态段落（备用，服务器可能超时）。返回 (文本, 来源url)。"""
    try:
        name = WIKI_COMMON_NAME.get(species, species)
        for l in [lang, "en"] if lang != "en" else ["en"]:
            title = name if l == "en" else species
            url = (f"https://{l}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1"
                   f"&format=json&titles=" + urllib.parse.quote(title))
            data = json.loads(_http_get(url, timeout=6, retries=1))
            pages = data.get("query", {}).get("pages", {})
            for pid, page in pages.items():
                ext = page.get("extract", "")
                if ext and len(ext) > 200:
                    import re
                    sentences = re.split(r"(?<=[。.!?])\s*", ext)
                    eco = [s for s in sentences if re.search(r"temperat|depth|habitat|migrat|spawn|水温|水深|栖息|洄游|上层|底栖", s, re.I)]
                    eco_text = " ".join(eco)[:1200] if eco else ext[:600]
                    src = f"https://{l}.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))
                    return eco_text, src
        return "", ""
    except Exception:
        return "", ""

if __name__ == "__main__":
    test_queries = [
        "大西洋鳕海温升高概率下降的原因",
        "黑线鳕和大西洋鳕生态位差异",
        "叶绿素对鱼类分布的影响",
        "水深对底栖鱼类的影响",
    ]
    for q in test_queries:
        print(f"=== 查询: {q} ===")
        for t in retrieve(q, top_k=2):
            print("  -", t[:60], "...")
        print()
