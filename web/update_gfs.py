# -*- coding: utf-8 -*-
# 更新 GFS 缓存（cron 定时调用）
import sys, os
sys.path.insert(0, "/opt/haina/web")
import gfs

d = gfs.update_cache()  # 强制重新下载 + 解析 + 写缓存（cron 定时更新，不依赖 get_gfs 的缓存）
if d:
    print("GFS 缓存更新 OK, time:", d.get("time"))
else:
    print("GFS 更新失败")
