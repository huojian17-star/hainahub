# -*- coding: utf-8 -*-
"""海纳 · OceanExpert（UNESCO/IOC IODE 全球海洋专家/机构名录）数据模块。

方案 B：海纳后端代理 OceanExpert，用户全程不碰官网（解决国内直连困难）。
- 聚合数据（地图国家圆点）：抓 /js/institutes.json + /js/experts.json，解析为
  [{country, latitude, longitude, count}]，24h 缓存。
- 国家详情（点国家看列表）：代理 OceanExpert 搜索接口，30min 缓存。
  - 专家：action=browse&type=experts&countryName=<国家名>
  - 机构：action=advSearch&type[]=institutions&filter[]=Country+is&keywords[]=<国家id>
  - 国家名->id 映射：getCountryList（机构筛要用数字 id，专家筛用国家名）
接口：/api/ocean-expert/agg   聚合数据
      /api/ocean-expert/country?country=X&type=experts|institutions&page=N
"""
import os, time, json, requests, re

BASE = "https://oceanexpert.org"

# 缓存目录（与 gfs_cache/rtofs_cache 同级，放 crawler/data 下）
_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "..", "crawler", "data", "ocean_expert_cache")
# 主动创建，避免目录未建导致回退到 web/data
try:
    os.makedirs(_CACHE_DIR, exist_ok=True)
except Exception:
    # 本地开发兜底
    _CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    try:
        os.makedirs(_CACHE_DIR, exist_ok=True)
    except Exception:
        pass

_AGG_TTL = 24 * 3600      # 聚合数据 24h
_COUNTRY_TTL = 30 * 60    # 国家详情 30min
_LIST_TTL = 24 * 3600     # 国家列表 24h

_HEADERS = {"User-Agent": "Mozilla/5.0 (HainaOceanPlatform)"}


def _cache_path(name):
    return os.path.join(_CACHE_DIR, name)


def _read_cache(name, ttl):
    """读缓存，过期返回 None。"""
    p = _cache_path(name)
    try:
        if os.path.isfile(p) and (time.time() - os.path.getmtime(p)) < ttl:
            with open(p, encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return None


def _write_cache(name, data):
    try:
        os.makedirs(_CACHE_DIR, exist_ok=True)
        # 原子写：先写 tmp 再 os.replace
        p = _cache_path(name)
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, p)
    except Exception:
        pass


def _parse_jsvar(raw, varname):
    """解析 'var xxx = [...]' 形式的 JS 变量。"""
    text = raw.decode("utf-8", "replace")
    m = re.search(r"var\s+" + varname + r"\s*=\s*(.*?);?\s*$", text, re.S)
    if not m:
        raise ValueError(f"未找到变量 {varname}")
    return json.loads(m.group(1))


def _fetch(url, timeout=30, retries=3):
    """带重试的 GET。OceanExpert 服务器 DNS 偶发解析失败，重试兜底。"""
    last_err = None
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=_HEADERS, timeout=timeout)
            r.raise_for_status()
            return r
        except Exception as e:
            last_err = e
            time.sleep(0.5 * (attempt + 1))
    raise last_err


def get_agg():
    """聚合数据：institutes + experts，各返回 [{country,latitude,longitude,count}]。"""
    cached = _read_cache("agg.json", _AGG_TTL)
    if cached:
        return cached

    result = {"institutes": [], "experts": [], "updated": time.strftime("%Y-%m-%d %H:%M")}
    try:
        raw = _fetch(f"{BASE}/js/institutes.json").content
        data = _parse_jsvar(raw, "institutes")
        result["institutes"] = _flatten_agg(data)
    except Exception as e:
        result["institutes_error"] = str(e)
    try:
        raw = _fetch(f"{BASE}/js/experts.json").content
        data = _parse_jsvar(raw, "experts")
        result["experts"] = _flatten_agg(data)
    except Exception as e:
        result["experts_error"] = str(e)

    if result["institutes"] or result["experts"]:
        _write_cache("agg.json", result)
    return result


def _flatten_agg(data):
    """把嵌套结构展平成 [{country,latitude,longitude,count}]，按 count 降序。"""
    items = []
    if isinstance(data, list):
        for grp in data:
            if isinstance(grp, list):
                items.extend(grp)
            elif isinstance(grp, dict):
                items.extend(grp.values())
    elif isinstance(data, dict):
        for grp in data.values():
            if isinstance(grp, dict):
                items.extend(grp.values())
    out = []
    for it in items:
        if isinstance(it, dict):
            try:
                out.append({
                    "country": it.get("country"),
                    "latitude": float(it.get("latitude", 0)),
                    "longitude": float(it.get("longitude", 0)),
                    "count": int(it.get("count", 0)),
                })
            except (TypeError, ValueError):
                pass
    out.sort(key=lambda x: -x["count"])
    return out


def get_country_list():
    """国家名->id 映射（238 国）。机构筛要用数字 id。"""
    cached = _read_cache("country_list.json", _LIST_TTL)
    if cached:
        return cached
    try:
        r = _fetch(f"{BASE}/api/v1/getCountryList/list.json")
        cl = r.json()
        mapping = {str(c.get("country")): int(c.get("idCountry")) for c in cl if c.get("country")}
        _write_cache("country_list.json", mapping)
        return mapping
    except Exception:
        return {}


def get_country_detail(country, typ="experts", page=1, limit=20):
    """国家详情：代理 OceanExpert 搜索，返回该国专家/机构列表。
    专家用 browse+countryName（国家名）；机构用 advSearch+Country is（国家 id）。
    """
    typ = typ if typ in ("experts", "institutions") else "experts"
    page = max(1, int(page))
    limit = min(50, max(1, int(limit)))

    cache_key = f"country_{typ}_{country}_{page}.json"
    cached = _read_cache(cache_key, _COUNTRY_TTL)
    if cached:
        return cached

    result = {"ok": True, "type": typ, "country": country, "page": page, "items": []}
    try:
        if typ == "experts":
            url = (f"{BASE}/api/v1/advancedSearch/search.json"
                   f"?action=browse&type=experts&countryName={country}&limit={limit}&page={page}")
            r = _fetch(url)
            j = r.json()
            data = j.get("results", {}).get("data", [])
            meta = j.get("results", {}).get("meta", {})
            items = []
            for x in data:
                items.append({
                    "name": x.get("name", ""),
                    "id_ind": x.get("id_ind", ""),
                    "jobtitle": x.get("jobtitle", ""),
                    "inst_name": x.get("inst_name", ""),
                    "city": x.get("city", ""),
                    "state": x.get("state", ""),
                    "country": x.get("country", ""),
                })
            result["items"] = items
            result["total"] = meta.get("totalCount", len(items))
            result["pageCount"] = meta.get("pageCount", 1)
        else:
            # 机构：需要国家数字 id
            country_map = get_country_list()
            cid = country_map.get(country)
            if not cid:
                result["ok"] = False
                result["error"] = f"未找到国家 {country} 的 id"
                _write_cache(cache_key, result)
                return result
            url = (f"{BASE}/api/v1/advancedSearch/search.json"
                   f"?action=advSearch&type[]=institutions&filter[]=Country+is"
                   f"&keywords[]={cid}&limit={limit}&page={page}")
            r = _fetch(url)
            j = r.json()
            data = j.get("results", {}).get("data", [])
            meta = j.get("results", {}).get("meta", {})
            items = []
            for x in data:
                items.append({
                    "inst_name": x.get("inst_name", ""),
                    "id_inst": x.get("id_inst", ""),
                    "inst_name_eng": x.get("inst_name_eng", ""),
                    "instCity": x.get("instCity", ""),
                    "instType": x.get("instType", ""),
                    "country": x.get("country", ""),
                })
            result["items"] = items
            result["total"] = meta.get("totalCount", len(items))
            result["pageCount"] = meta.get("pageCount", 1)
    except Exception as e:
        result["ok"] = False
        result["error"] = str(e)

    _write_cache(cache_key, result)
    return result


def get_expert_detail(expert_id):
    """专家详情：代理 expert/{id}.json。字段有就返回，没有则空（填充率低）。"""
    expert_id = str(expert_id)
    cache_key = f"detail_expert_{expert_id}.json"
    cached = _read_cache(cache_key, _COUNTRY_TTL)
    if cached:
        return cached

    result = {"ok": True, "type": "expert", "id": expert_id}
    try:
        r = _fetch(f"{BASE}/api/v1/expert/{expert_id}.json")
        d = r.json()
        result["name"] = (d.get("fname", "") + " " + d.get("sname", "")).strip()
        result["jobtitle"] = d.get("jobtitle", "") or ""
        result["degree"] = d.get("degree", "") or ""
        result["researcharea"] = d.get("researcharea", "") or ""
        result["studyregion"] = d.get("studyregion", "") or ""
        result["orcid"] = d.get("orcid", "") or ""
        result["researcherid"] = d.get("researcherid", "") or ""
        result["researchgate"] = d.get("researchgate", "") or ""
        result["google_scholar"] = d.get("google-scholar", "") or ""
        result["languages"] = d.get("languages", "") or ""
        result["skills"] = d.get("skills", "") or ""
        result["city"] = d.get("city", "") or ""
        result["state"] = d.get("state", "") or ""
        result["country"] = d.get("country", "") or ""
        result["nationality"] = d.get("nationality", "") or ""
        result["dept"] = d.get("dept", "") or ""
        result["profile_image"] = d.get("profileImage", "") or ""
        inst = d.get("institution")
        if isinstance(inst, dict):
            result["institution"] = inst.get("instName", "")
            result["inst_id"] = inst.get("idInst", "")
        else:
            result["institution"] = ""
            result["inst_id"] = ""
    except Exception as e:
        result["ok"] = False
        result["error"] = str(e)

    _write_cache(cache_key, result)
    return result


def get_institute_detail(inst_id):
    """机构详情：代理 institute/{id}.json（含成员列表）。"""
    inst_id = str(inst_id)
    cache_key = f"detail_institute_{inst_id}.json"
    cached = _read_cache(cache_key, _COUNTRY_TTL)
    if cached:
        return cached

    result = {"ok": True, "type": "institute", "id": inst_id}
    try:
        r = _fetch(f"{BASE}/api/v1/institute/{inst_id}.json")
        d = r.json()
        inst = d.get("institute", {})
        result["inst_name"] = inst.get("instName", "") or ""
        result["inst_name_eng"] = inst.get("instNameEng", "") or ""
        result["inst_address"] = inst.get("instAddress", "") or ""
        result["city"] = inst.get("city", "") or ""
        result["state"] = inst.get("state", "") or ""
        result["postcode"] = inst.get("postCode", "") or ""
        result["country"] = inst.get("country", "") or ""
        result["inst_type"] = inst.get("insttypeName", "") or ""
        result["activities"] = inst.get("activities", "") or ""
        # 成员列表（机构下的专家）
        members = d.get("members", {}).get("members", [])
        result["members"] = []
        for m in members:
            if isinstance(m, dict):
                result["members"].append({
                    "id": m.get("idInd", ""),
                    "name": (m.get("fname", "") + " " + m.get("sname", "")).strip(),
                    "deceased": m.get("deceased", "0"),
                    "retired": m.get("retired", "0"),
                })
    except Exception as e:
        result["ok"] = False
        result["error"] = str(e)

    _write_cache(cache_key, result)
    return result


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "agg":
        print(json.dumps(get_agg(), ensure_ascii=False)[:800])
    elif len(sys.argv) > 1 and sys.argv[1] == "country":
        c = sys.argv[2] if len(sys.argv) > 2 else "China"
        t = sys.argv[3] if len(sys.argv) > 3 else "experts"
        print(json.dumps(get_country_detail(c, t), ensure_ascii=False)[:800])
    else:
        print("用法: ocean_expert.py [agg|country <国家> <experts|institutions>]")
