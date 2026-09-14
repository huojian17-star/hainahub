# -*- coding: utf-8 -*-
"""海纳区块链数据存证模块（本地哈希链，不用公链）
每个数据区块 = 索引 + 时间戳 + 数据 + 前块哈希 + 本块哈希（SHA-256 哈希链接，不可篡改）
区块粒度：0.05°（约5km）网格，跟环境数据（ERDDAP）分辨率匹配。
SQLite 存区块（跟海纳现有 SQLite 一致）。
用法：
  from blockchain import Blockchain
  bc = Blockchain("ocean_chain.db")
  bc.add_block({"species":"cod","lat":55,"lon":-20,"prob":0.9})  # 加数据块
  bc.verify_chain()  # 验证是否被篡改
"""
import hashlib
import json
import sqlite3
import time


def sha256(data_str):
    return hashlib.sha256(data_str.encode("utf-8")).hexdigest()


class Blockchain:
    def __init__(self, db_path="ocean_chain.db"):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS blocks (
                idx INTEGER PRIMARY KEY,
                timestamp REAL,
                data TEXT,
                prev_hash TEXT,
                hash TEXT
            )
        """)
        self.conn.commit()
        # 创世块（链为空时）
        if self.conn.execute("SELECT COUNT(*) FROM blocks").fetchone()[0] == 0:
            genesis = {
                "index": 0,
                "timestamp": time.time(),
                "data": json.dumps({"genesis": "海纳海洋数据链"}, ensure_ascii=False),
                "prev_hash": "0" * 64,
            }
            genesis["hash"] = self._compute_hash(
                genesis["index"], genesis["timestamp"], genesis["data"], genesis["prev_hash"]
            )
            self.conn.execute(
                "INSERT INTO blocks (idx, timestamp, data, prev_hash, hash) VALUES (?,?,?,?,?)",
                (genesis["index"], genesis["timestamp"], genesis["data"],
                 genesis["prev_hash"], genesis["hash"]),
            )
            self.conn.commit()

    @staticmethod
    def _compute_hash(index, timestamp, data, prev_hash):
        # 前块哈希 + 数据，SHA-256，哈希链接
        block_str = f"{index}{timestamp}{data}{prev_hash}"
        return sha256(block_str)

    def add_block(self, data_dict):
        """加一个数据区块（data_dict 是海洋数据，如物种分布/环境值）"""
        last = self.conn.execute("SELECT idx, hash FROM blocks ORDER BY idx DESC LIMIT 1").fetchone()
        if last:
            idx = last[0] + 1
            prev_hash = last[1]
        else:
            idx = 0
            prev_hash = "0" * 64
        data_str = json.dumps(data_dict, ensure_ascii=False, sort_keys=True)
        timestamp = time.time()
        block_hash = self._compute_hash(idx, timestamp, data_str, prev_hash)
        self.conn.execute(
            "INSERT INTO blocks (idx, timestamp, data, prev_hash, hash) VALUES (?,?,?,?,?)",
            (idx, timestamp, data_str, prev_hash, block_hash),
        )
        self.conn.commit()
        return {"index": idx, "hash": block_hash, "prev_hash": prev_hash}

    def verify_chain(self):
        """验证整条链是否被篡改（哈希链接是否一致）"""
        rows = self.conn.execute(
            "SELECT idx, timestamp, data, prev_hash, hash FROM blocks ORDER BY idx"
        ).fetchall()
        for i in range(1, len(rows)):
            idx, timestamp, data, prev_hash, hash_db = rows[i]
            # 上一块的 hash（当前块的 prev_hash 应该 = 上一块的 hash）
            prev_block_hash = rows[i - 1][4]
            # 前块哈希必须匹配
            if prev_hash != prev_block_hash:
                return False, f"区块{idx} 前块哈希不匹配（被篡改）"
            # 本块哈希必须匹配
            calc = self._compute_hash(idx, timestamp, data, prev_hash)
            if calc != hash_db:
                return False, f"区块{idx} 哈希不匹配（被篡改）"
        return True, "链完整，未被篡改"

    def get_chain(self, limit=20):
        rows = self.conn.execute(
            "SELECT idx, timestamp, data, prev_hash, hash FROM blocks ORDER BY idx DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [
            {"index": r[0], "timestamp": r[1], "data": r[2], "prev_hash": r[3], "hash": r[4]}
            for r in rows
        ]

    def close(self):
        self.conn.close()
