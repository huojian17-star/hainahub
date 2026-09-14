/* 2026-08-23：下潜过渡——点击「下潜」后 hero 区向上滑出（顶上去），显示「正在下潜」加载动画，然后跳转 /content（内容页）。
   独立首页专用（仅 hero，天然不可下滑）。下潜是进入内容页的唯一入口，加载动画给用户明确的加载反馈。 */
(function () {
  "use strict";

  var diveBtn = document.getElementById("heroDive");
  var hero = document.getElementById("hero");
  if (!diveBtn || !hero) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var diving = false;   // 2026-08-24：防重复下潜（点击/滚轮只触发一次）

  // 创建加载遮罩（气泡上升 + 正在下潜文字）
  function showDiveLoading() {
    var overlay = document.createElement("div");
    overlay.className = "dive-loading";
    overlay.innerHTML =
      '<div class="dive-loading-bubbles"></div>' +
      '<div class="dive-loading-text">正在下潜…</div>';
    document.body.appendChild(overlay);
    // 生成气泡
    var bubbles = overlay.querySelector(".dive-loading-bubbles");
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 24; i++) {
      var b = document.createElement("span");
      b.className = "dive-loading-bubble";
      var size = 6 + Math.random() * 18;
      b.style.width = size + "px";
      b.style.height = size + "px";
      b.style.left = (Math.random() * 100) + "%";
      b.style.bottom = (-10 - Math.random() * 10) + "%";
      b.style.animationDelay = (Math.random() * 1.5) + "s";
      b.style.animationDuration = (1.8 + Math.random() * 1.6) + "s";
      frag.appendChild(b);
    }
    bubbles.appendChild(frag);
  }

  // 2026-08-24：下潜逻辑抽成函数（点击/滚轮共用）
  function doDive() {
    if (diving) return;
    diving = true;
    if (reduced) { window.location.href = "/content?dive=1"; return; }
    hero.style.transition = "transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)";
    hero.style.transform = "translateY(-100%)";
    setTimeout(function () {
      showDiveLoading();
    }, 600);
    setTimeout(function () {
      window.location.href = "/content?dive=1";
    }, 2200);
  }

  diveBtn.addEventListener("click", function (e) {
    e.preventDefault();
    doDive();
  });

  // 2026-08-24：滚轮向下也触发下潜（用户不知道点击按钮，滚轮下滑也能进 content 页）
  window.addEventListener("wheel", function (e) {
    if (diving) return;
    if (e.deltaY > 0) {   // 向下滚
      e.preventDefault();
      doDive();
    }
  }, { passive: false });
})();
