# -*- coding: utf-8 -*-
"""海纳投稿 agent：定时检查投稿邮箱（IMAP），自动提取照片/地址/说明存进待审列表。
合规：用户内容走邮箱（站外），本脚本是站长自己的自动化工具代为录入，仍属 PGC。
"""
import os, sys, re, time, uuid, imaplib, email, requests, json
from email.header import decode_header

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, "..", "web"))

from store import get_conn, insert_ocean_post

# 敏感配置从独立文件读（不硬编码，脚本可安全进 git，配置单独保密）
with open(os.path.join(BASE, "tougao_config.json"), "r", encoding="utf-8") as _f:
    _cfg = json.load(_f)

IMAP_HOST = _cfg["imap_host"]
IMAP_PORT = 993
EMAIL_USER = _cfg["imap_user"]
EMAIL_PASS = _cfg["imap_pass"]
AMAP_KEY = _cfg["amap_key"]
UPLOAD_DIR = os.path.join(BASE, "..", "web", "static", "uploads", "ocean")
MAX_ATTACH = 15 * 1024 * 1024  # 附件大小上限 15MB


def geocode(address):
    """地址 → (lat, lng)，失败返回 None。"""
    try:
        r = requests.get("https://restapi.amap.com/v3/geocode/geo",
                         params={"address": address, "key": AMAP_KEY, "output": "json"}, timeout=10)
        d = r.json()
        if d.get("status") == "1" and d.get("geocodes"):
            lng, lat = d["geocodes"][0]["location"].split(",")
            return float(lat), float(lng)
    except Exception:
        pass
    return None


def decode(s):
    if not s:
        return ""
    parts = decode_header(s)
    out = []
    for text, enc in parts:
        if isinstance(text, bytes):
            out.append(text.decode(enc or "utf-8", errors="ignore"))
        else:
            out.append(text)
    return "".join(out)


def parse_body(text):
    """解析投稿正文：地址 / 说明 / 投稿人邮箱。"""
    address = ""
    desc = ""
    submitter = ""
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("地址："):
            address = line[3:].strip()
        elif line.startswith("说明："):
            desc = line[3:].strip()
            if desc == "（无）":
                desc = ""
        elif line.startswith("投稿人邮箱："):
            submitter = line[6:].strip()
            if submitter == "未填":
                submitter = ""
    return address, desc, submitter


def main():
    conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    conn.login(EMAIL_USER, EMAIL_PASS)
    # 163 邮箱要求 SELECT 前发 IMAP ID 命令（RFC 2971）声明身份，否则报 "Unsafe Login"
    imaplib.Commands["ID"] = ("AUTH",)
    client_id = ("name", "HainaBot", "version", "1.0", "vendor", "HainaBot")
    try:
        conn._simple_command("ID", '("' + '" "'.join(client_id) + '")')
    except Exception:
        pass
    status, _ = conn.select("INBOX")
    print("select INBOX:", status)

    # 搜未读（SUBJECT 带中文在 IMAP search 里易出错，改成代码里过滤）
    status, data = conn.search(None, "UNSEEN")
    if status != "OK":
        print("搜索失败")
        conn.logout()
        return
    ids = data[0].split()
    print(f"发现 {len(ids)} 封未读邮件")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    db = get_conn()
    processed = 0
    for mid in ids:
        try:
            st, msg_data = conn.fetch(mid, "(RFC822)")
            if st != "OK":
                continue
            msg = email.message_from_bytes(msg_data[0][1])
            # 主题过滤：只处理投稿邮件
            subject = decode(msg.get("Subject", ""))
            if "海纳投稿" not in subject:
                continue
            # 正文（text/plain 或 text/html）
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    ctype = part.get_content_type()
                    if ctype == "text/plain":
                        body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                        break
                    if ctype == "text/html" and not body:
                        body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
            address, desc, submitter = parse_body(body)
            # 照片附件
            image_url = ""
            for part in msg.walk():
                fn = part.get_filename()
                if not fn:
                    continue
                fn = decode(fn)
                ctype = part.get_content_type()
                if ctype.startswith("image/"):
                    ext = (fn.rsplit(".", 1)[-1] if "." in fn else "jpg").lower()
                    if ext not in ("jpg", "jpeg", "png", "webp"):
                        ext = "jpg"
                    data = part.get_payload(decode=True)
                    if not data:
                        continue
                    # 防护：附件大小上限，防恶意超大附件撑爆磁盘
                    if len(data) > MAX_ATTACH:
                        print(f"  [跳过] 邮件附件超过 15MB")
                        conn.store(mid, "+FLAGS", "\\Seen")
                        image_url = "__oversize__"
                        break
                    fname = f"tg_{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}"
                    with open(os.path.join(UPLOAD_DIR, fname), "wb") as f:
                        f.write(data)
                    image_url = f"/static/uploads/ocean/{fname}"
                    break
            if image_url == "__oversize__":
                continue
            if not image_url:
                print(f"  [跳过] 邮件 {mid} 无照片附件")
                conn.store(mid, "+FLAGS", "\\Seen")
                continue
            # 地理编码
            lat, lng = 0.0, 0.0
            if address:
                g = geocode(address)
                if g:
                    lat, lng = g
            # 存待审
            nickname = submitter or "投稿"
            insert_ocean_post(desc, image_url, address, lat, lng, nickname=nickname, user_id=0)
            processed += 1
            # 标记已读，避免重复处理
            conn.store(mid, "+FLAGS", "\\Seen")
            print(f"  [已收录] {address or '未填地址'} → pending")
        except Exception as e:
            print(f"  [出错] 邮件 {mid}: {e}")
    db.close()
    conn.logout()
    print(f"完成：收录 {processed} 封投稿进待审")


if __name__ == "__main__":
    main()
