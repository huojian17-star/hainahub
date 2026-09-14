/* 海纳 · 性能模式选择（首次进入自动弹窗 + 导航栏「性能」按钮随时可改，localStorage 记住） */
(function () {
  "use strict";
  var STORAGE_KEY = "haina_perf_mode";
  var REMEMBER_KEY = "haina_perf_remember";

  // 读取已存的模式（性能/质量/极简），供 content 页用
  function getMode() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "lite") return "lite";
    return saved === "quality" ? "quality" : "performance";   // 默认 performance
  }

  // 弹窗 HTML（动态创建，任何页面都能打开）
  var MODAL_HTML =
    '<div class="perf-modal perf-modal-show" id="perfModal" role="dialog" aria-modal="true" aria-label="选择显示模式">' +
    '<div class="perf-modal-box">' +
    '<h3 class="perf-modal-title">这台电脑跑得动吗？</h3>' +
    '<p class="perf-modal-sub">往下潜会看到游动的鱼群、发光的水母和鲸鱼，这些 3D 场景有点吃配置，选个合适的。</p>' +
    '<div class="perf-options">' +
    '<button class="perf-option perf-option-active" data-mode="performance" id="perfOptionPerf"><span class="perf-opt-name">性能优先</span><span class="perf-opt-desc">做了最大程度优化，普通电脑也能流畅看。</span></button>' +
    '<button class="perf-option" data-mode="quality" id="perfOptionQuality"><span class="perf-opt-name">画质优先</span><span class="perf-opt-desc">3D 细节全开，适合配置好的电脑。</span></button>' +
    '<button class="perf-option" data-mode="lite" id="perfOptionLite"><span class="perf-opt-name">极简优先</span><span class="perf-opt-desc">不加载 3D 和动画，网慢也能快速看内容。</span></button>' +
    '</div>' +
    '<label class="perf-remember"><input type="checkbox" id="perfRemember"> 下次别问了</label>' +
    '<button class="perf-confirm" id="perfConfirm">就用这个</button>' +
    '</div></div>';

  // 打开弹窗（动态创建，绑定事件）
  function openModal() {
    // 已存在则直接显示
    var existing = document.getElementById("perfModal");
    if (existing) { existing.classList.add("perf-modal-show"); return; }
    var div = document.createElement("div");
    div.innerHTML = MODAL_HTML;
    var modal = div.firstChild;
    document.body.appendChild(modal);
    bindModal(modal);
  }

  // 绑定弹窗事件（选项切换 + 确认）
  function bindModal(modal) {
    var currentMode = getMode();
    var perfOpt = modal.querySelector("#perfOptionPerf");
    var qualityOpt = modal.querySelector("#perfOptionQuality");
    var liteOpt = modal.querySelector("#perfOptionLite");
    var remember = modal.querySelector("#perfRemember");
    var confirmBtn = modal.querySelector("#perfConfirm");

    function setActive(mode) {
      currentMode = mode;
      perfOpt.classList.toggle("perf-option-active", mode === "performance");
      qualityOpt.classList.toggle("perf-option-active", mode === "quality");
      if (liteOpt) liteOpt.classList.toggle("perf-option-active", mode === "lite");
    }
    // 初始高亮当前模式
    setActive(currentMode);

    perfOpt.addEventListener("click", function () { setActive("performance"); });
    qualityOpt.addEventListener("click", function () { setActive("quality"); });
    if (liteOpt) liteOpt.addEventListener("click", function () { setActive("lite"); });

    confirmBtn.addEventListener("click", function () {
      localStorage.setItem(STORAGE_KEY, currentMode);
      if (remember.checked) {
        localStorage.setItem(REMEMBER_KEY, "1");
      }
      // 设标记，刷新后不再次弹窗（避免弹窗循环）
      localStorage.setItem("haina_perf_reloading", String(Date.now()));
      // 强制刷新一次——3D 模型 JS 在页面加载时按旧模式初始化，必须刷新才能按新模式重载
      setTimeout(function () { location.reload(); }, 150);
    });
  }

  // 暴露给导航栏「性能」按钮
  window.HainaPerf = {
    getMode: getMode,
    openSettings: openModal
  };

  // 导航栏「性能」按钮：随时打开设置
  var navPerf = document.getElementById("navPerf");
  if (navPerf) navPerf.addEventListener("click", openModal);

  // 首次进入：如果没勾「下次别问了」且不是弹窗触发的刷新 → 自动弹窗
  var staticModal = document.getElementById("perfModal");
  if (!staticModal) return;   // 页面没有静态弹窗（content 页有 _perf_modal.html）

  // 弹窗触发的刷新不再次弹窗（localStorage + 时间戳，手机端/微信浏览器 sessionStorage 不可靠）
  var reloadMark = localStorage.getItem("haina_perf_reloading");
  if (reloadMark && (Date.now() - parseInt(reloadMark, 10)) < 5000) {
    localStorage.removeItem("haina_perf_reloading");
    staticModal.remove();
    return;
  }
  // 已勾选「下次不再弹出」→ 保持隐藏
  if (localStorage.getItem(REMEMBER_KEY) === "1") {
    staticModal.remove();
    return;
  }
  // 未勾选 → 显示弹窗 + 绑定事件
  staticModal.classList.add("perf-modal-show");
  bindModal(staticModal);
})();
