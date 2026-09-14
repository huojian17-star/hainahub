/* 2026-08-23：content 页加载遮罩——等鱼群模型 + 岗位数据都加载完成后隐藏。
   下潜进入 content 页时，遮罩持续到内容真正加载好，用户不会看到「动画结束但内容没出来」。 */
(function () {
  "use strict";

  var loading = document.getElementById("contentLoading");
  if (!loading) return;

  // 2026-08-24：回退进入（浏览器回退）不播动画；只有正常导航 + ?dive=1（首页下潜）才播
  // 用 performance.navigation.type（旧 API，手机端兼容）判断回退
  var navType = (window.performance && performance.getEntriesByType && performance.getEntriesByType("navigation")[0] && performance.getEntriesByType("navigation")[0].type) || "";
  if (window.performance && window.performance.navigation && window.performance.navigation.type === 2) {
    navType = "back_forward";
  }
  var isBack = navType === "back_forward";
  var isDive = window.location.search.indexOf("dive=1") !== -1;
  if (!isDive || isBack) {
    loading.remove();
    return;
  }

  function maybeHide() {
    if (window.__fishModelReady && window.__jobsDataReady) {
      loading.classList.add("hidden");
      // 动画结束后移除遮罩
      setTimeout(function () { loading.remove(); }, 500);
    }
  }

  // 轮询检查两个加载标志（模型 + 数据），都完成后隐藏
  var timer = setInterval(function () {
    if (window.__fishModelReady && window.__jobsDataReady) {
      clearInterval(timer);
      maybeHide();
    }
  }, 200);

  // 兜底：10 秒后强制隐藏（防止某个加载卡住导致遮罩永久显示）
  setTimeout(function () {
    if (loading.parentNode) {
      clearInterval(timer);
      loading.classList.add("hidden");
      setTimeout(function () { loading.remove(); }, 500);
    }
  }, 10000);
})();
