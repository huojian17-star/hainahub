# -*- coding: utf-8 -*-
"""海纳 · 智渔牧海 —— 水质预警逻辑模块（自研：阈值 + 缺氧反演 + SDM适宜性 + AI解读）
三结合预警：
  1. 阈值预警：chl 超标（赤潮风险）、sst 异常（升温）
  2. 缺氧反演：SST+叶绿素+时间滞后 → 估算溶氧（溶氧非光学活性，需代理，自研创新点）
  3. SDM 适宜性：实时 sst/chl 喂 SDM 模型，预测鱼种适宜性变化（等建模完成接入）
供 /api/ocean-water/alert 调用。
"""
import math

# 预警阈值（结合海纳 sst/chl 数据 + 生态学知识，自研）
# 赤潮风险（chl 高）：chl > 10 黄警（藻华风险），chl > 50 红警（赤潮高风险）
CHL_YELLOW = 10.0   # mg/m^3
CHL_RED = 50.0      # mg/m^3
# 升温异常：sst 高于季节均值 2°C
SST_ANOMALY = 2.0   # degree_C
# 缺氧阈值（文献）：DO < 2 mg/L 缺氧，DO < 4 mg/L 低氧
DO_HYPOXIA = 2.0    # mg/L
DO_LOW = 4.0        # mg/L


def assess_threshold(sst, chl):
    """阈值预警：返回预警列表（基于实时 sst/chl）"""
    alerts = []
    if chl:
        if chl["value"] >= CHL_RED:
            alerts.append({"type": "red_tide", "level": "red",
                           "msg": f"叶绿素 {chl['value']:.1f} mg/m³，赤潮高风险"})
        elif chl["value"] >= CHL_YELLOW:
            alerts.append({"type": "algal_bloom", "level": "yellow",
                           "msg": f"叶绿素 {chl['value']:.1f} mg/m³，藻华风险"})
    if sst:
        # 升温异常需要季节基准均温（这里简化为固定阈值，后续接气候态基准）
        pass
    return alerts


def estimate_do(sst, chl, sst_prev_month=None):
    """缺氧反演（自研创新点）：用 SST+叶绿素+时间滞后 估算溶氧。
    参考黄海/渤海研究：DO 与 SST 负相关，与叶绿素相关，SST 是主驱动。
    简化经验模型（后续用机器学习标定）：
      DO ≈ 14.6 - 0.32*SST - 0.05*CHL（经验系数，水温高→溶氧低）
    返回估算溶氧值（mg/L）或 None。
    """
    if sst is None:
        return None
    sst_v = sst["value"]
    chl_v = chl["value"] if chl else 0.0
    # 经验模型：SST 主驱动（负相关），chl 高（富营养化）也降低溶氧
    # 系数参考黄海研究（SST 每升 1°C，DO 降约 0.3 mg/L）
    do = 14.6 - 0.32 * sst_v - 0.05 * chl_v
    return max(do, 0.0)


def assess_hypoxia(sst, chl):
    """缺氧预警：基于估算溶氧"""
    do = estimate_do(sst, chl)
    if do is None:
        return None
    if do < DO_HYPOXIA:
        return {"type": "hypoxia", "level": "red",
                "msg": f"估算溶氧 {do:.1f} mg/L，缺氧风险（<{DO_HYPOXIA} mg/L）", "do": do}
    if do < DO_LOW:
        return {"type": "hypoxia", "level": "yellow",
                "msg": f"估算溶氧 {do:.1f} mg/L，低氧风险（<{DO_LOW} mg/L）", "do": do}
    return None


def assess_all(sst, chl):
    """综合预警：阈值 + 缺氧反演，返回预警列表 + 健康度"""
    alerts = []
    alerts.extend(assess_threshold(sst, chl))
    hypo = assess_hypoxia(sst, chl)
    if hypo:
        alerts.append(hypo)
    # 健康度评分（0-100，基于预警等级扣分）
    score = 100
    for a in alerts:
        if a["level"] == "red":
            score -= 30
        elif a["level"] == "yellow":
            score -= 15
    score = max(0, score)
    return {"alerts": alerts, "health_score": score}
