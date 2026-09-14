# -*- coding: utf-8 -*-
"""补齐资讯配图：抓详情页提取 og:image / 正文首图，含二维码/黑白小图标过滤"""
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from PIL import Image
from io import BytesIO
from store import init_db, get_missing_image_urls, update_image

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
BAD_HINTS = ["logo", "icon", "banner", "btn", "avatar", "qrcode", "ewm", "qr_", "weixin", "arrow", "ico",
             "spacer", "line", "bg_", "back", "icp", "beian", "sx-xs", "-xs", "small", "thumb",
             "49.png", "wq/", "/images/", "share", "fenxiang", "iphone", "phone", "app", "xb.png",
             "zxcode", "code_", "qrcode", "ewm", "erweima", "ma.jpg", "ma.png",
             "zjou.edu.cn/img/", "nfnews", "epaper", ".jpg.2"]  # zjou 的 /img/ 目录全是栏目图标；nfnews=南方日报电子报二维码

def _url_ok(url):
    low = url.lower()
    return not any(h in low for h in BAD_HINTS)

def _is_qrcode_like(img):
    """二维码/黑白小图标判定：小尺寸 + 彩色像素占比极低"""
    w, h = img.size
    if w < 120 or h < 120:
        return True
    if w < 400 and h < 300:
        # 小图进一步检查彩色占比
        rgb = img.convert("RGB")
        small = rgb.resize((min(w, 120), min(h, 120)))
        px = list(small.getdata())
        colored = 0
        total = len(px)
        for r, g, b in px:
            mx, mn = max(r, g, b), min(r, g, b)
            if mx - mn > 40 or mx > 200:  # 有彩色或很亮的像素
                colored += 1
        if colored / total < 0.08:
            return True  # 几乎纯黑白 → 疑似二维码/线条图标
    return False

def extract_candidates(html, base_url):
    """返回候选图 URL 列表（按优先级）"""
    soup = BeautifulSoup(html, "lxml")
    cands = []
    # 1) og:image
    for meta in soup.find_all("meta"):
        prop = (meta.get("property") or meta.get("name") or "").lower()
        if prop in ("og:image", "twitter:image") and (meta.get("content") or "").strip():
            cands.append(urljoin(base_url, meta["content"].strip()))
    # 2) 正文容器里的图
    containers = soup.find_all(["article", "main"]) + \
                 soup.select("div[class*=content], div[id*=content], div[class*=article], div[class*=xw], div[class*=list]")
    for box in containers:
        for img in box.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-original") or ""
            if src and not src.startswith("data:") and _url_ok(src):
                cands.append(urljoin(base_url, src))
    # 3) 兜底全页
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-original") or ""
        if src and not src.startswith("data:") and _url_ok(src):
            cands.append(urljoin(base_url, src))
    # 去重保序
    seen, out = set(), []
    for c in cands:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out

def pick_image(cands):
    """逐张下载验证，返回第一张合格图（排除二维码/黑白小图标/坏图）"""
    for c in cands[:4]:
        try:
            r = requests.get(c, headers=UA, timeout=12)
            if r.status_code != 200:
                continue
            img = Image.open(BytesIO(r.content))
            img.load()
            if _is_qrcode_like(img):
                continue
            return c
        except Exception:
            continue
    return ""

def main(limit=80, sleep=0.8):
    init_db()
    urls = get_missing_image_urls(limit=limit)
    print(f"待补图 {len(urls)} 条")
    got, skipped = 0, 0
    for u in urls:
        try:
            r = requests.get(u, headers=UA, timeout=15)
            r.encoding = r.apparent_encoding or "utf-8"
            cands = extract_candidates(r.text, u)
            img = pick_image(cands)
            if img and update_image(u, img):
                got += 1
                print(f"  + {img[:80]}")
            else:
                skipped += 1
                print(f"  - 无合格图 {u[:55]}")
        except Exception as e:
            print(f"  ! {type(e).__name__}: {u[:55]}")
        time.sleep(sleep)
    print(f"\n完成：补到 {got} 张，跳过 {skipped} 条")

if __name__ == "__main__":
    main()
