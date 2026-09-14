# -*- coding: utf-8 -*-
"""SQLite 存储 + 去重"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "haina.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    category TEXT DEFAULT '',
    date TEXT DEFAULT '',
    image TEXT DEFAULT '',
    discussion_url TEXT DEFAULT '',
    content TEXT DEFAULT '',
    content_type TEXT DEFAULT 'news',
    typhoon_name TEXT DEFAULT '',
    fetched_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_source ON articles(source);
CREATE INDEX IF NOT EXISTS idx_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_date ON articles(date);
CREATE INDEX IF NOT EXISTS idx_typhoon ON articles(typhoon_name);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    unit TEXT DEFAULT '',
    unit_type TEXT DEFAULT '',
    major TEXT DEFAULT '',
    education TEXT DEFAULT '',
    region TEXT DEFAULT '',
    headcount TEXT DEFAULT '',
    salary TEXT DEFAULT '',
    deadline TEXT DEFAULT '',
    deadline_note TEXT DEFAULT '',
    publish_date TEXT DEFAULT '',
    url TEXT NOT NULL,
    source TEXT DEFAULT '',
    description TEXT DEFAULT '',
    discussion_url TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    is_longterm INTEGER DEFAULT 0,
    fetched_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(url, title)
);
CREATE INDEX IF NOT EXISTS idx_jobs_major ON jobs(major);
CREATE INDEX IF NOT EXISTS idx_jobs_unit_type ON jobs(unit_type);
"""

def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA)
    # 海域照片表（用户上传）——已废弃，改为独立作品 ocean_posts + 评论 ocean_comments
    conn.execute(
        """CREATE TABLE IF NOT EXISTS ocean_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT DEFAULT '',
            image_url TEXT NOT NULL,
            address TEXT DEFAULT '',
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            nickname TEXT DEFAULT '',
            status TEXT DEFAULT 'approved',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS ocean_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            text TEXT DEFAULT '',
            image_url TEXT DEFAULT '',
            nickname TEXT DEFAULT '',
            status TEXT DEFAULT 'approved',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )"""
    )
    # 用户表（海域图鉴账号体系）
    conn.execute(
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            token TEXT DEFAULT '',
            is_admin INTEGER DEFAULT 0,
            avatar TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )"""
    )
    # 迁移：老库补列
    ucols = [r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
    if "is_admin" not in ucols:
        conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
    if "avatar" not in ucols:
        conn.execute("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''")
    if "bio" not in ucols:
        conn.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
    # 多 token 表（每个设备一个 token，互不覆盖）
    conn.execute(
        """CREATE TABLE IF NOT EXISTS user_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )"""
    )
    # 迁移：老 users.token 迁移到 user_tokens（一次性）
    old_tokens = conn.execute("SELECT id, token FROM users WHERE token != ''").fetchall()
    for uid, tok in old_tokens:
        conn.execute("INSERT OR IGNORE INTO user_tokens (user_id, token) VALUES (?, ?)", (uid, tok))
    # 迁移：ocean 表补 user_id
    pcols = [r[1] for r in conn.execute("PRAGMA table_info(ocean_posts)").fetchall()]
    if "user_id" not in pcols:
        conn.execute("ALTER TABLE ocean_posts ADD COLUMN user_id INTEGER DEFAULT 0")
    ccols = [r[1] for r in conn.execute("PRAGMA table_info(ocean_comments)").fetchall()]
    if "user_id" not in ccols:
        conn.execute("ALTER TABLE ocean_comments ADD COLUMN user_id INTEGER DEFAULT 0")
    # 迁移：老库补列
    cols = [r[1] for r in conn.execute("PRAGMA table_info(articles)").fetchall()]
    if "image" not in cols:
        conn.execute("ALTER TABLE articles ADD COLUMN image TEXT DEFAULT ''")
    if "discussion_url" not in cols:
        conn.execute("ALTER TABLE articles ADD COLUMN discussion_url TEXT DEFAULT ''")
    if "content" not in cols:
        conn.execute("ALTER TABLE articles ADD COLUMN content TEXT DEFAULT ''")
    if "content_type" not in cols:
        conn.execute("ALTER TABLE articles ADD COLUMN content_type TEXT DEFAULT 'news'")
    if "typhoon_name" not in cols:
        conn.execute("ALTER TABLE articles ADD COLUMN typhoon_name TEXT DEFAULT ''")
    # jobs 表补 discussion_url 列
    jcols = [r[1] for r in conn.execute("PRAGMA table_info(jobs)").fetchall()]
    if "discussion_url" not in jcols:
        conn.execute("ALTER TABLE jobs ADD COLUMN discussion_url TEXT DEFAULT ''")
    if "status" not in jcols:
        conn.execute("ALTER TABLE jobs ADD COLUMN status TEXT DEFAULT 'active'")
    if "is_longterm" not in jcols:
        conn.execute("ALTER TABLE jobs ADD COLUMN is_longterm INTEGER DEFAULT 0")
    if "deadline_note" not in jcols:
        conn.execute("ALTER TABLE jobs ADD COLUMN deadline_note TEXT DEFAULT ''")
    conn.commit()
    conn.close()

def insert_ocean_post(text, image_url, address, lat, lng, nickname="", user_id=0):
    """用户发作品：照片+文字+地址+坐标，返回新 id。默认进待审（pending）。"""
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO ocean_posts (text, image_url, address, lat, lng, nickname, user_id, status) VALUES (?,?,?,?,?,?,?, 'pending')",
        (text.strip()[:500], image_url, address.strip()[:100], lat, lng, nickname.strip()[:30], user_id),
    )
    conn.commit()
    pid = cur.lastrowid
    conn.close()
    return pid

def query_ocean_posts(limit=200):
    """地图上所有作品点。"""
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, text, image_url, address, lat, lng, nickname, created_at FROM ocean_posts "
        "WHERE status = 'approved' ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [
        {"id": r[0], "text": r[1], "image_url": r[2], "address": r[3], "lat": r[4],
         "lng": r[5], "nickname": r[6], "created_at": r[7]}
        for r in rows
    ]

def get_ocean_post(post_id):
    conn = get_conn()
    r = conn.execute(
        "SELECT id, text, image_url, address, lat, lng, nickname, created_at FROM ocean_posts WHERE id = ?", (post_id,)
    ).fetchone()
    conn.close()
    if not r:
        return None
    return {"id": r[0], "text": r[1], "image_url": r[2], "address": r[3], "lat": r[4],
            "lng": r[5], "nickname": r[6], "created_at": r[7]}

def insert_ocean_comment(post_id, text, image_url="", nickname="", user_id=0):
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO ocean_comments (post_id, text, image_url, nickname, user_id, status) VALUES (?,?,?,?,?, 'pending')",
        (post_id, text.strip()[:500], image_url, nickname.strip()[:30], user_id),
    )
    conn.commit()
    cid = cur.lastrowid
    conn.close()
    return cid

def query_ocean_comments(post_id, limit=100):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, text, image_url, nickname, created_at FROM ocean_comments "
        "WHERE post_id = ? AND status = 'approved' ORDER BY id ASC LIMIT ?", (post_id, limit)
    ).fetchall()
    conn.close()
    return [
        {"id": r[0], "text": r[1], "image_url": r[2], "nickname": r[3], "created_at": r[4]}
        for r in rows
    ]

def register_user(username, password_hash):
    """注册，重名返回 None，成功返回用户 id。"""
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username.strip(), password_hash),
        )
        conn.commit()
        uid = cur.lastrowid
    except sqlite3.IntegrityError:
        uid = None
    conn.close()
    return uid

def get_user_by_username(username):
    conn = get_conn()
    r = conn.execute("SELECT id, username, password_hash, token FROM users WHERE username = ?", (username.strip(),)).fetchone()
    conn.close()
    if not r:
        return None
    return {"id": r[0], "username": r[1], "password_hash": r[2], "token": r[3]}

def set_user_token(user_id, token):
    """登录/注册生成新 token，追加到 user_tokens（多设备互不覆盖）。"""
    conn = get_conn()
    conn.execute("INSERT INTO user_tokens (user_id, token) VALUES (?, ?)", (user_id, token))
    conn.commit()
    conn.close()

def delete_user_token(token):
    """退出登录/失效时删除单个 token。"""
    conn = get_conn()
    conn.execute("DELETE FROM user_tokens WHERE token = ?", (token,))
    conn.commit()
    conn.close()

def get_user_by_token(token):
    if not token:
        return None
    conn = get_conn()
    r = conn.execute(
        "SELECT u.id, u.username, u.is_admin, u.avatar, u.bio FROM users u "
        "JOIN user_tokens t ON t.user_id = u.id WHERE t.token = ?", (token,)
    ).fetchone()
    conn.close()
    if not r:
        return None
    return {"id": r[0], "username": r[1], "is_admin": r[2], "avatar": r[3], "bio": r[4]}

def update_user_avatar(user_id, avatar_url):
    conn = get_conn()
    conn.execute("UPDATE users SET avatar=? WHERE id=?", (avatar_url, user_id))
    conn.commit()
    conn.close()

def update_user_bio(user_id, bio):
    conn = get_conn()
    conn.execute("UPDATE users SET bio=? WHERE id=?", (bio.strip()[:200], user_id))
    conn.commit()
    conn.close()

def get_user_profile(user_id):
    """个人主页：用户信息 + 发帖/评论历史。"""
    conn = get_conn()
    u = conn.execute("SELECT id, username, avatar, bio, created_at FROM users WHERE id=?", (user_id,)).fetchone()
    if not u:
        conn.close()
        return None
    posts = conn.execute(
        "SELECT id, image_url, address, created_at FROM ocean_posts WHERE user_id=? AND status='approved' ORDER BY id DESC LIMIT 50",
        (user_id,)
    ).fetchall()
    comments = conn.execute(
        "SELECT id, post_id, text, created_at FROM ocean_comments WHERE user_id=? AND status='approved' ORDER BY id DESC LIMIT 50",
        (user_id,)
    ).fetchall()
    conn.close()
    return {
        "id": u[0], "username": u[1], "avatar": u[2], "bio": u[3], "created_at": u[4],
        "posts": [{"id": r[0], "image_url": r[1], "address": r[2], "created_at": r[3]} for r in posts],
        "comments": [{"id": r[0], "post_id": r[1], "text": r[2], "created_at": r[3]} for r in comments],
    }

def query_pending_posts():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, nickname, text, image_url, address, created_at FROM ocean_posts WHERE status='pending' ORDER BY id"
    ).fetchall()
    conn.close()
    return [{"id": r[0], "nickname": r[1], "text": r[2], "image_url": r[3], "address": r[4], "created_at": r[5]} for r in rows]

def query_pending_comments():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, post_id, nickname, text, image_url, created_at FROM ocean_comments WHERE status='pending' ORDER BY id"
    ).fetchall()
    conn.close()
    return [{"id": r[0], "post_id": r[1], "nickname": r[2], "text": r[3], "image_url": r[4], "created_at": r[5]} for r in rows]

def set_post_status(pid, status):
    conn = get_conn()
    conn.execute("UPDATE ocean_posts SET status=? WHERE id=?", (status, pid))
    conn.commit()
    conn.close()

def set_comment_status(cid, status):
    conn = get_conn()
    conn.execute("UPDATE ocean_comments SET status=? WHERE id=?", (status, cid))
    conn.commit()
    conn.close()

def insert_articles(items):
    """去重入库，返回新增条数。items: [{title,url,source,category,date,image}]"""
    conn = get_conn()
    added = 0
    for it in items:
        if not it.get("title") or not it.get("url"):
            continue
        try:
            conn.execute(
                "INSERT OR IGNORE INTO articles (title, url, source, category, date, image) VALUES (?,?,?,?,?,?)",
                (it["title"].strip(), it["url"].strip(), it.get("source", ""), it.get("category", ""), it.get("date", ""), it.get("image", "")),
            )
            if conn.total_changes > 0:
                added += 1
        except sqlite3.IntegrityError:
            pass
    conn.commit()
    conn.close()
    return added

def update_typhoon_name(url, typhoon_name):
    """回填某条资讯的台风名（按 url 定位，覆盖旧值）"""
    if not url or not typhoon_name:
        return False
    conn = get_conn()
    cur = conn.execute("UPDATE articles SET typhoon_name = ? WHERE url = ?", (typhoon_name, url))
    conn.commit()
    changed = cur.rowcount > 0
    conn.close()
    return changed

def update_image(url, image):
    """回填某条资讯的图片（按 url 定位，覆盖旧值）"""
    if not image:
        return False
    conn = get_conn()
    cur = conn.execute("UPDATE articles SET image = ? WHERE url = ?", (image, url))
    conn.commit()
    changed = cur.rowcount > 0
    conn.close()
    return changed

def get_missing_image_urls(limit=50):
    conn = get_conn()
    rows = conn.execute(
        "SELECT url FROM articles WHERE image = '' OR image IS NULL ORDER BY date DESC, id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [r[0] for r in rows]

def insert_interpretation(title, content, policy_url, source="海纳解读", category="政策解读", date=None):
    """发布一篇政策解读文章（content_type=interpretation）
    返回 (article_id, 是否新增) 或 None
    url 策略：原文 URL 若已被 news 占用，则加 #interp 锚点变体（跳转无副作用）
    """
    import datetime
    d = date or datetime.date.today().strftime("%Y-%m-%d")
    conn = get_conn()
    # 查重：同原文 URL 的解读已存在
    exists = conn.execute(
        "SELECT id FROM articles WHERE url = ? AND content_type = 'interpretation'", (policy_url.strip(),)
    ).fetchone()
    if exists:
        conn.close()
        return (exists[0], False)
    # 插入；url 冲突（被 news 占用）时用锚点变体
    url = policy_url.strip()
    try:
        conn.execute(
            "INSERT INTO articles (title, url, source, category, date, content, content_type) VALUES (?,?,?,?,?,?,?)",
            (title.strip(), url, source, category, d, content, "interpretation"),
        )
    except sqlite3.IntegrityError:
        url = policy_url.strip() + "#interp"
        conn.execute(
            "INSERT INTO articles (title, url, source, category, date, content, content_type) VALUES (?,?,?,?,?,?,?)",
            (title.strip(), url, source, category, d, content, "interpretation"),
        )
    conn.commit()
    row = conn.execute("SELECT id FROM articles WHERE url = ?", (url,)).fetchone()
    conn.close()
    if not row:
        return None
    return (row[0], True)

def get_article(article_id):
    """按 id 取单条资讯"""
    conn = get_conn()
    row = conn.execute(
        "SELECT title, url, source, category, date, image, discussion_url, content, content_type FROM articles WHERE id = ?",
        (article_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {"title": row[0], "url": row[1], "source": row[2], "category": row[3],
            "date": row[4], "image": row[5], "discussion_url": row[6], "content": row[7], "content_type": row[8]}

def get_related_articles(article_id, category, limit=5):
    """同分类的其他文章（排除自己），按日期降序。返回 [{id, title}]。同分类仅 1 篇时返回空。"""
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, title FROM articles WHERE category = ? AND id != ? "
        "ORDER BY date DESC, id DESC LIMIT ?",
        (category, article_id, limit),
    ).fetchall()
    conn.close()
    return [{"id": r[0], "title": r[1]} for r in rows]

def set_discussion(article_id, discussion_url):
    """记录资讯对应的论坛帖子 URL"""
    conn = get_conn()
    conn.execute("UPDATE articles SET discussion_url = ? WHERE id = ?", (discussion_url, article_id))
    conn.commit()
    conn.close()

def count_articles(source=None, category=None):
    conn = get_conn()
    sql = "SELECT COUNT(*) FROM articles WHERE 1=1"
    args = []
    if source:
        sql += " AND source = ?"
        args.append(source)
    if category:
        sql += " AND category = ?"
        args.append(category)
    n = conn.execute(sql, args).fetchone()[0]
    conn.close()
    return n

def query_articles(source=None, category=None, limit=50, offset=0):
    conn = get_conn()
    sql = "SELECT id, title, url, source, category, date, image, content_type, fetched_at FROM articles WHERE 1=1"
    args = []
    if source:
        sql += " AND source = ?"
        args.append(source)
    if category:
        sql += " AND category = ?"
        args.append(category)
    else:
        # 没指定分类时，默认排除台风新闻（台风新闻只走 /api/typhoon/news 单独接口，不混入首页资讯流）
        sql += " AND category != '台风'"
    sql += " ORDER BY date DESC, id DESC LIMIT ? OFFSET ?"
    args += [limit, offset]
    rows = conn.execute(sql, args).fetchall()
    conn.close()
    return [
        {"id": r[0], "title": r[1], "url": r[2], "source": r[3], "category": r[4], "date": r[5], "image": r[6], "content_type": r[7], "fetched_at": r[8]}
        for r in rows
    ]


# ============ 岗位库（jobs） ============

def insert_jobs(items):
    """去重入库岗位，返回新增条数。
    items: [{title, unit, unit_type, major, education, region, headcount,
             salary, deadline, publish_date, url, source, description}]
    """
    conn = get_conn()
    added = 0
    for it in items:
        if not it.get("title") or not it.get("url"):
            continue
        try:
            conn.execute(
                "INSERT OR IGNORE INTO jobs (title, unit, unit_type, major, education, region, "
                "headcount, salary, deadline, is_longterm, publish_date, url, source, description) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    it["title"].strip(),
                    it.get("unit", "").strip(),
                    it.get("unit_type", "").strip(),
                    it.get("major", "").strip(),
                    it.get("education", "").strip(),
                    it.get("region", "").strip(),
                    it.get("headcount", "").strip(),
                    it.get("salary", "").strip(),
                    it.get("deadline", "").strip(),
                    1 if it.get("is_longterm") else 0,
                    it.get("publish_date", "").strip(),
                    it["url"].strip(),
                    it.get("source", "").strip(),
                    it.get("description", "").strip(),
                ),
            )
            if conn.total_changes > 0:
                added += 1
        except sqlite3.IntegrityError:
            pass
    conn.commit()
    conn.close()
    return added


def _tag_match(col, tags):
    """major 是逗号分隔多标签，用边界 LIKE 精确匹配任一标签。"""
    conds = []
    for t in tags:
        conds.append("(',' || " + col + " || ',') LIKE ?")
    return "(" + " OR ".join(conds) + ")"


def upsert_job(it):
    """存在则更新（补薪资/描述/刷新状态），不存在则插入。返回 'updated'/'inserted'/None。
    2026-08-21 新增：解决 INSERT OR IGNORE 导致已存在岗位永不刷新薪资/状态的问题。"""
    if not it.get("title") or not it.get("url"):
        return None
    conn = get_conn()
    row = conn.execute("SELECT id FROM jobs WHERE url = ? AND title = ?", (it["url"].strip(), it["title"].strip())).fetchone()
    if row:
        conn.execute(
            "UPDATE jobs SET unit=?, unit_type=?, major=?, education=?, region=?, headcount=?, "
            "salary=?, deadline=?, publish_date=?, source=?, description=?, status='active', "
            "fetched_at=datetime('now','localtime') WHERE id=?",
            (
                it.get("unit", "").strip(), it.get("unit_type", "").strip(),
                it.get("major", "").strip(), it.get("education", "").strip(),
                it.get("region", "").strip(), it.get("headcount", "").strip(),
                it.get("salary", "").strip(), it.get("deadline", "").strip(),
                it.get("publish_date", "").strip(), it.get("source", "").strip(),
                it.get("description", "").strip(), row[0],
            ),
        )
        conn.commit()
        conn.close()
        return "updated"
    try:
        conn.execute(
            "INSERT INTO jobs (title, unit, unit_type, major, education, region, "
            "headcount, salary, deadline, is_longterm, publish_date, url, source, description) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                it["title"].strip(), it.get("unit", "").strip(), it.get("unit_type", "").strip(),
                it.get("major", "").strip(), it.get("education", "").strip(),
                it.get("region", "").strip(), it.get("headcount", "").strip(),
                it.get("salary", "").strip(), it.get("deadline", "").strip(),
                1 if it.get("is_longterm") else 0,
                it.get("publish_date", "").strip(), it["url"].strip(),
                it.get("source", "").strip(), it.get("description", "").strip(),
            ),
        )
        conn.commit()
        conn.close()
        return "inserted"
    except sqlite3.IntegrityError:
        conn.close()
        return None


def count_jobs(majors=None, unit_types=None, educations=None, regions=None,
               deadline_filter="all", status="active", q="", salary_filter="all"):
    """统计符合筛选条件的岗位总数（分页用）。筛选条件与 query_jobs 一致。"""
    conn = get_conn()
    if status == "all":
        sql = "SELECT COUNT(*) FROM jobs WHERE 1=1"
        args = []
    else:
        sql = "SELECT COUNT(*) FROM jobs WHERE status = ?"
        args = [status]
    if q:
        pattern = "%" + "%".join(c for c in q if c.strip()) + "%"
        sql += " AND (title LIKE ? OR unit LIKE ? OR description LIKE ?)"
        args += [pattern, pattern, pattern]
    if majors:
        sql += " AND " + _tag_match("major", majors)
        args += ["%," + m + ",%" for m in majors]
    if unit_types:
        sql += " AND unit_type IN (%s)" % ",".join("?" * len(unit_types))
        args += list(unit_types)
    if educations:
        sql += " AND education IN (%s)" % ",".join("?" * len(educations))
        args += list(educations)
    if regions:
        ors = []
        for rg in regions:
            ors.append("region LIKE ?")
            args.append("%" + rg + "%")
        sql += " AND (" + " OR ".join(ors) + ")"
    if deadline_filter == "has":
        sql += " AND deadline != '' AND deadline IS NOT NULL"
    elif deadline_filter == "none":
        sql += " AND (deadline = '' OR deadline IS NULL)"
    if salary_filter == "has":
        sql += " AND salary != '' AND salary IS NOT NULL AND salary GLOB '*[0-9]*'"
    total = conn.execute(sql, args).fetchone()[0]
    conn.close()
    return total


def query_jobs(majors=None, unit_types=None, educations=None, regions=None,
               deadline_filter="all", status="active", sort="latest", limit=100, offset=0, q="",
               salary_filter="all"):
    """多重筛选岗位。各维度传列表，维度内 OR、维度间 AND（正是博士要的 Excel 列筛选）。
    status: active=在招 / expired=已过期 / all=全部。
    sort: latest=最新发布 / deadline=截止临近 / unit=单位名称。
    q: 关键词，匹配岗位名 / 单位 / 描述。
    deadline_filter: all=不过滤 / has=有截止日期 / none=未注明截止日期。
    """
    conn = get_conn()
    if status == "all":
        sql = "SELECT id, title, unit, unit_type, major, education, region, headcount, salary, deadline, deadline_note, publish_date, url, source, description FROM jobs WHERE 1=1"
        args = []
    else:
        sql = "SELECT id, title, unit, unit_type, major, education, region, headcount, salary, deadline, deadline_note, publish_date, url, source, description FROM jobs WHERE status = ?"
        args = [status]
    if q:
        # 模糊搜索：查询词拆单字做子序列匹配，简称/漏字也能命中
        # 例："海洋所" → %海%洋%所%，可匹配"中国科学院海洋研究所"
        pattern = "%" + "%".join(c for c in q if c.strip()) + "%"
        sql += " AND (title LIKE ? OR unit LIKE ? OR description LIKE ?)"
        args += [pattern, pattern, pattern]
    if majors:
        sql += " AND " + _tag_match("major", majors)
        args += ["%," + m + ",%" for m in majors]
    if unit_types:
        sql += " AND unit_type IN (%s)" % ",".join("?" * len(unit_types))
        args += list(unit_types)
    if educations:
        sql += " AND education IN (%s)" % ",".join("?" * len(educations))
        args += list(educations)
    if regions:
        ors = []
        for rg in regions:
            ors.append("region LIKE ?")
            args.append("%" + rg + "%")
        sql += " AND (" + " OR ".join(ors) + ")"
    if deadline_filter == "has":
        sql += " AND deadline != '' AND deadline IS NOT NULL"
    elif deadline_filter == "none":
        sql += " AND (deadline = '' OR deadline IS NULL)"
    if salary_filter == "has":
        sql += " AND salary != '' AND salary IS NOT NULL AND salary GLOB '*[0-9]*'"
    if sort == "deadline":
        sql += " ORDER BY (deadline = '' OR deadline IS NULL), deadline ASC, id DESC"
    elif sort == "unit":
        sql += " ORDER BY unit ASC, id DESC"
    else:
        sql += " ORDER BY publish_date DESC, id DESC"
    sql += " LIMIT ? OFFSET ?"
    args += [limit, offset]
    rows = conn.execute(sql, args).fetchall()
    conn.close()
    return [
        {"id": r[0], "title": r[1], "unit": r[2], "unit_type": r[3], "major": r[4],
         "education": r[5], "region": r[6], "headcount": r[7], "salary": r[8],
         "deadline": r[9], "deadline_note": r[10], "publish_date": r[11], "url": r[12], "source": r[13], "description": r[14]}
        for r in rows
    ]


def job_filters():
    """返回前端筛选项：专业/单位类型/学历用固定全量枚举（分类体系，用户要看到全部选项），地区动态。"""
    from major_tags import MAJOR_TAGS, UNIT_TYPES, EDUCATION_LEVELS
    conn = get_conn()
    regions = [r[0] for r in conn.execute(
        "SELECT DISTINCT region FROM jobs WHERE region != '' ORDER BY region"
    ).fetchall()]
    conn.close()
    return {
        "majors": MAJOR_TAGS,
        "unit_types": UNIT_TYPES,
        "educations": EDUCATION_LEVELS,
        "regions": regions,
    }


def get_job(job_id):
    """按 id 取单条岗位"""
    conn = get_conn()
    row = conn.execute(
        "SELECT id, title, unit, unit_type, major, education, region, headcount, salary, "
        "deadline, deadline_note, publish_date, url, source, description, discussion_url FROM jobs WHERE id = ?",
        (job_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row[0], "title": row[1], "unit": row[2], "unit_type": row[3], "major": row[4],
            "education": row[5], "region": row[6], "headcount": row[7], "salary": row[8],
            "deadline": row[9], "deadline_note": row[10], "publish_date": row[11], "url": row[12], "source": row[13],
            "description": row[14], "discussion_url": row[15]}


def set_job_discussion(job_id, discussion_url):
    """记录岗位对应的论坛讨论帖 URL"""
    conn = get_conn()
    conn.execute("UPDATE jobs SET discussion_url = ? WHERE id = ?", (discussion_url, job_id))
    conn.commit()
    conn.close()


def expire_jobs(expire_days=90):
    """过期自动下架，返回下架数量。
    - 有 deadline（标准日期 YYYY-MM-DD）且 < 今天 → expired
    - 无 deadline 但 publish_date 超过 expire_days 天（默认 150 天 ≈ 5 个月）→ expired
      （含长期招聘：挂超 5 个月大概率已失效，单位还在招会重新发公告）
    """
    import datetime
    today = datetime.date.today().strftime("%Y-%m-%d")
    cutoff = (datetime.date.today() - datetime.timedelta(days=expire_days)).strftime("%Y-%m-%d")
    conn = get_conn()
    n1 = conn.execute(
        "UPDATE jobs SET status = 'expired' WHERE status = 'active' AND deadline != '' "
        "AND deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND deadline < ?",
        (today,),
    ).rowcount
    n2 = conn.execute(
        "UPDATE jobs SET status='expired' WHERE status='active' AND (deadline = '' OR deadline IS NULL) "
        "AND publish_date != '' AND publish_date < ?",
        (cutoff,),
    ).rowcount
    conn.commit()
    conn.close()
    return n1 + n2

