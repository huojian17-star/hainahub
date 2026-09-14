/* 海纳 · GSAP 动画系统（克制版）
   —— 按官方最佳实践：只动 transform/opacity、短时长、减动效回退 */
(function () {
  "use strict";

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var hasGSAP = typeof gsap !== "undefined";

  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ============ 动态卡片入场（app.js 渲染后调用） ============ */
  function observeCards(selector) {
    if (!selector) return;
    var els = document.querySelectorAll(selector);
    if (!els.length) return;

    if (prefersReduced() || !hasGSAP || !ScrollTrigger) {
      els.forEach(function (el) { el.style.opacity = 1; el.style.transform = "none"; });
      return;
    }

    gsap.set(els, { autoAlpha: 0, y: 14 });
    ScrollTrigger.batch(els, {
      start: "top 92%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out",
          stagger: 0.05, overwrite: true
        });
      }
    });
  }

  /* ============ 数字滚动（loadStats 填好后自动播放） ============ */
  function setupNumbers() {
    if (prefersReduced()) return;
    var ids = ["#statJobs", "#statNews"];
    ids.forEach(function (id) {
      var el = document.querySelector(id);
      if (!el || el.dataset.hainaBound === "1") return;
      el.dataset.hainaBound = "1";

      function play(target) {
        if (!hasGSAP) { el.textContent = target; return; }
        var obj = { v: 0 };
        gsap.to(obj, {
          v: target, duration: 1, ease: "power1.out",
          onUpdate: function () { el.textContent = Math.round(obj.v); },
          onComplete: function () { el.textContent = target; }
        });
      }

      var mo = new MutationObserver(function () {
        var v = parseInt(el.textContent, 10);
        if (!isNaN(v) && v > 0) { mo.disconnect(); el.textContent = "0"; play(v); }
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });

      var initial = parseInt(el.textContent, 10);
      if (!isNaN(initial) && initial > 0) { mo.disconnect(); play(initial); }
    });
  }

  /* ============ 初始静态区块入场 + hero 视差 ============ */
  function init() {
    // 2026-08-24：极简模式——不加载 GSAP 动画，内容静态直接显示
    if (window.HainaPerf && window.HainaPerf.getMode() === "lite") return;
    if (!hasGSAP || !ScrollTrigger) {
      // 无 GSAP 降级：CSS class + IntersectionObserver
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              e.target.classList.add("scroll-reveal", "active");
              io.unobserve(e.target);
            }
          });
        }, { rootMargin: "-40px", threshold: 0.05 });
        document.querySelectorAll(".zone-head, .dash-card, .transfer-map-wrap, .zone-abyss")
          .forEach(function (el) { io.observe(el); });
      }
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    var statics = gsap.utils.toArray(".zone-head, .dash-card, .transfer-map-wrap, .zone-abyss");
    statics.forEach(function (el) {
      gsap.fromTo(el, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });

    // hero 3D 海洋「下潜」联动（transform-only，仅非减动效）
    if (!prefersReduced()) {
      var heroEl = document.querySelector(".hero");
      var ocean = window.OceanScene;
      if (heroEl && ocean && typeof ocean.setDive === "function") {
        gsap.to(heroEl, {
          scrollTrigger: {
            trigger: ".hero", start: "top top", end: "bottom top", scrub: true,
            onUpdate: function (self) {
              ocean.setDive(self.progress);
            }
          }
        });
      }
      // 视口滚出 hero 后暂停渲染，省 GPU（可见即渲染）
      ScrollTrigger.create({
        trigger: ".hero", start: "top top", end: "bottom top",
        onEnter: function () { ocean && ocean.setPaused && ocean.setPaused(false); },
        onLeaveBack: function () { ocean && ocean.setPaused && ocean.setPaused(false); },
        onEnterBack: function () { ocean && ocean.setPaused && ocean.setPaused(false); }
      });
    }
  }

  /* ============ 对外 API ============ */
  window.HainaAnimations = {
    observeCards: observeCards,
    refresh: function () { if (ScrollTrigger) ScrollTrigger.refresh(); }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
