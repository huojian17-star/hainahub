// 海纳 · 海洋计算工具箱（侧边栏小工具，纯前端，零外部依赖）
// 功能：经纬度 DMS↔DD、航速换算（节/m/s/km/h）、深度↔水压（dbar↔m）、盐度 PSU↔‰
(function () {
  "use strict";

  var fab = document.getElementById("toolsFab");
  var panel = document.getElementById("toolsPanel");
  var closeBtn = document.getElementById("toolsClose");
  if (!fab || !panel) return;

  // ---------- 面板折叠/展开 ----------
  function openPanel() {
    panel.classList.remove("hidden");
    fab.classList.add("hidden");
  }
  function closePanel() {
    panel.classList.add("hidden");
    fab.classList.remove("hidden");
  }
  fab.addEventListener("click", openPanel);
  closeBtn.addEventListener("click", closePanel);

  // ---------- tab 切换 ----------
  var tabs = panel.querySelectorAll(".tools-tab");
  var panes = panel.querySelectorAll(".tools-body");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var name = tab.getAttribute("data-tab");
      tabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
      panes.forEach(function (p) {
        p.classList.toggle("hidden", p.getAttribute("data-pane") !== name);
      });
    });
  });

  // ---------- 工具函数 ----------
  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }
  function fmt(n) {
    if (n == null || !isFinite(n)) return "—";
    // 去掉多余小数（最多 4 位），避免浮点误差
    return String(parseFloat(n.toFixed(4)));
  }
  function setResult(el, text) {
    if (el) el.textContent = text;
  }

  // ========== 经纬度 DMS ↔ DD ==========
  var coordDD = document.getElementById("coordDD");
  var coordLatDir = document.getElementById("coordLatDir");
  var coordLonDir = document.getElementById("coordLonDir");
  var coordDMSResult = document.getElementById("coordDMSResult");
  var dmsDeg = document.getElementById("dmsDeg");
  var dmsMin = document.getElementById("dmsMin");
  var dmsSec = document.getElementById("dmsSec");
  var coordDDResult = document.getElementById("coordDDResult");

  // DD → DMS（单个数值 + 方向）
  function ddToDMS(dd, dir) {
    var abs = Math.abs(dd);
    var deg = Math.floor(abs);
    var minF = (abs - deg) * 60;
    var min = Math.floor(minF);
    var sec = (minF - min) * 60;
    // 处理秒进位（如 59.9996 → 60）
    if (sec >= 59.9995) { sec = 0; min += 1; }
    if (min >= 60) { min = 0; deg += 1; }
    return deg + "°" + min + "'" + sec.toFixed(1) + "\"" + dir;
  }

  document.getElementById("coordDDtoDMS").addEventListener("click", function () {
    var dd = num(coordDD.value);
    if (dd == null) { setResult(coordDMSResult, "请输入有效数值"); return; }
    var lat = ddToDMS(dd, coordLatDir.value);
    var lon = ddToDMS(dd, coordLonDir.value);
    setResult(coordDMSResult, "纬度 " + lat + "　经度 " + lon);
  });

  // DMS → DD
  document.getElementById("coordDMStoDD").addEventListener("click", function () {
    var deg = num(dmsDeg.value);
    var min = num(dmsMin.value) || 0;
    var sec = num(dmsSec.value) || 0;
    if (deg == null) { setResult(coordDDResult, "请输入度"); return; }
    var dd = deg + min / 60 + sec / 3600;
    setResult(coordDDResult, fmt(dd) + "°");
  });

  // ========== 航速换算：节 / m/s / km/h ==========
  var speedVal = document.getElementById("speedVal");
  var speedUnit = document.getElementById("speedUnit");
  var speedResult = document.getElementById("speedResult");

  // 统一换算到 m/s
  function toMs(v, unit) {
    if (unit === "knot") return v * 0.514444; // 1 节 = 1852/3600 m/s
    if (unit === "kmh") return v / 3.6;
    return v; // m/s
  }
  document.getElementById("speedConv").addEventListener("click", function () {
    var v = num(speedVal.value);
    if (v == null) { setResult(speedResult, "请输入有效数值"); return; }
    var ms = toMs(v, speedUnit.value);
    var knot = ms / 0.514444;
    var kmh = ms * 3.6;
    setResult(speedResult,
      "节 (Knots): " + fmt(knot) +
      "　|　m/s: " + fmt(ms) +
      "　|　km/h: " + fmt(kmh));
  });

  // ========== 深度 ↔ 水压（dbar ↔ m）==========
  var depthVal = document.getElementById("depthVal");
  var depthUnit = document.getElementById("depthUnit");
  var depthResult = document.getElementById("depthResult");
  var RHO = 1025;      // 海水平均密度 kg/m³
  var G = 9.80665;     // 重力加速度 m/s²
  var DBAR_PA = 10000; // 1 dbar = 10000 Pa

  document.getElementById("depthConv").addEventListener("click", function () {
    var v = num(depthVal.value);
    if (v == null) { setResult(depthResult, "请输入有效数值"); return; }
    if (depthUnit.value === "m") {
      // 深度 m → dbar
      var dbar = v * RHO * G / DBAR_PA;
      setResult(depthResult, "水压: " + fmt(dbar) + " dbar　(深度 " + fmt(v) + " m)");
    } else {
      // dbar → 深度 m
      var m = v * DBAR_PA / (RHO * G);
      setResult(depthResult, "深度: " + fmt(m) + " m　(水压 " + fmt(v) + " dbar)");
    }
  });

  // ========== 盐度 PSU ↔ ‰ ==========
  var salVal = document.getElementById("salVal");
  var salResult = document.getElementById("salResult");
  document.getElementById("salConv").addEventListener("click", function () {
    var v = num(salVal.value);
    if (v == null) { setResult(salResult, "请输入有效数值"); return; }
    setResult(salResult, "PSU: " + fmt(v) + "　|　‰: " + fmt(v) + "‰");
  });

  // 回车触发对应换算
  function onEnter(input, handler) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") handler();
    });
  }
  onEnter(coordDD, function () { document.getElementById("coordDDtoDMS").click(); });
  onEnter(speedVal, function () { document.getElementById("speedConv").click(); });
  onEnter(depthVal, function () { document.getElementById("depthConv").click(); });
  onEnter(salVal, function () { document.getElementById("salConv").click(); });
})();
