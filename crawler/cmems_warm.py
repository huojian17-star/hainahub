# -*- coding: utf-8 -*-
"""CMEMS 叶绿素预热脚本（cron 每 30 分钟）：拉 7 个牧场点 CHL 写缓存文件。
凭据从 /root/.copernicusmarine/ 配置文件读取（copernicusmarine login 已落盘）。
gunicorn 请求路径只读缓存文件，不 import 工具包（省内存、毫秒响应）。
"""
import sys, json, datetime
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CACHE_FILE = "/opt/haina/web/data/cmems_chl_cache.json"

import sys
sys.path.insert(0, "/opt/haina/web")

import copernicusmarine

from water_quality import FARM_POINTS

out = {}
for name_lat_lon in FARM_POINTS:
    lat, lon, name = name_lat_lon[0], name_lat_lon[1], name_lat_lon[2]
    try:
        end = datetime.date.today()
        start = end - datetime.timedelta(days=9)
        ds = copernicusmarine.open_dataset(
            dataset_id="cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D",
            variables=["CHL"],
            minimum_longitude=lon - 0.35, maximum_longitude=lon + 0.35,
            minimum_latitude=lat - 0.35, maximum_latitude=lat + 0.35,
            start_datetime=start.isoformat(), end_datetime=end.isoformat(),
        )
        s = ds["CHL"]
        if "latitude" in s.dims:
            # 最近有效海像元（湾内最近格点可能是陆地掩膜 NaN）
            import math, numpy as np
            last = s.isel(time=-1)
            arr = last.values
            lats, lons = s.latitude.values, s.longitude.values
            best = None
            for i2, la2 in enumerate(lats):
                for j2, lo2 in enumerate(lons):
                    v2 = float(arr[i2, j2]) if arr.ndim == 2 else float(np.asarray(arr[i2, j2]).ravel()[0])
                    if math.isfinite(v2):
                        d2 = (la2 - lat) ** 2 + (lo2 - lon) ** 2
                        if best is None or d2 < best[0]:
                            best = (d2, i2, j2)
            if best is None:
                print(name, "-> 盒子内无有效像元")
                continue
            s = s.isel(latitude=best[1], longitude=best[2])
        vals = s.values
        if vals.ndim > 1:
            vals = vals.reshape(vals.shape[0], -1)[:, 0]
        ok = []
        for t, v in zip(s.time.values, vals):
            try:
                fv = float(v)
                if fv == fv and abs(fv) != float("inf"):
                    ok.append((str(t)[:10], fv))
            except Exception:
                pass
        if not ok:
            print(name, "-> 窗口内无有效值")
            continue
        latest_t, latest_v = ok[-1]
        out[f"{lat},{lon}"] = {"value": latest_v, "time": latest_t, "unit": "mg m^-3",
                               "source": "CMEMS L4 无缝重构", "n": len(ok)}
        print(name, f"-> {latest_v:.2f} mg/m³ ({latest_t}, n={len(ok)})")
    except Exception as e:
        print(name, "-> FAIL:", type(e).__name__, str(e)[:100])

with open(CACHE_FILE, "w", encoding="utf-8") as f:
    json.dump({"fetched_at": datetime.datetime.now().isoformat(timespec="seconds"), "points": out}, f, ensure_ascii=False)
print("缓存已写:", CACHE_FILE, "| 点数:", len(out))
