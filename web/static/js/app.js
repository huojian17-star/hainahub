/* 海纳 · 滚动下潜 + 资讯流 */
(function () {
  "use strict";

  /* ========== 滚动下潜：背景色插值 ========== */
  // 深度 0（海面）→ 1（深渊全黑）的颜色 stop
  // 2026-08-20 方案 B（用户确认）：hero 换深海视频后，开局即深海蓝（与视频底色 #0A2846 一致），
  // 整条色带单调变暗，消除 hero → 浅蓝硬切断层（jobs 区 d=0.13~0.30 保持深蓝系）
  var STOPS = [
    [0.00, [10, 40, 70]],   // 深海开场（= hero 视频兜底色 #0A2846）
    [0.15, [9, 34, 62]],    // jobs 区（d 0.13~0.30）：深蓝缓慢过渡
    [0.32, [10, 34, 60]],   // 资讯区（带蓝调，不纯黑）
    [0.55, [11, 32, 56]],   // 深海（带蓝调，更透气）
    [0.80, [10, 28, 50]],   // 深渊入口（深海蓝，不纯黑）
    [1.00, [9, 24, 44]]     // 深渊（深海蓝，保留海洋感，不纯黑）
  ];

  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

  function depthColor(d) {
    for (var i = 0; i < STOPS.length - 1; i++) {
      var s1 = STOPS[i], s2 = STOPS[i + 1];
      if (d <= s2[0]) {
        var t = (d - s1[0]) / (s2[0] - s1[0]);
        return "rgb(" + lerp(s1[1][0], s2[1][0], t) + "," +
          lerp(s1[1][1], s2[1][1], t) + "," +
          lerp(s1[1][2], s2[1][2], t) + ")";
      }
    }
    return "rgb(9,24,44)";
  }

  var oceanBg = document.getElementById("oceanBg");
  var ticking = false;

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var d = max > 0 ? window.scrollY / max : 0;
    oceanBg.style.background = depthColor(d);
    ticking = false;
  }

  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  });
  onScroll();

  /* ========== 资讯流 ========== */
  var cat = sessionStorage.getItem("haina_cat") || "", src = sessionStorage.getItem("haina_src") || "";
  var grid = document.getElementById("newsGrid");

  function host(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }

  var SRC_COLORS = {
    "大连海事大学": "#3E7CB1",
    "中科院海洋所": "#0FB5BA",
    "自然资源部": "#334E68"
  };

  function cardHtml(it, isHead) {
    var featured = isHead ? " featured" : "";
    var h = host(it.url);
    return (
      '<article class="news-card' + featured + '">' +
      '<div class="news-thumb" style="display:none"><a href="/article/' + it.id + '"><img src="' + esc(it.image) + '" alt="" referrerpolicy="no-referrer"></a></div>' +
      '<div class="news-text">' +
      '<div class="news-meta">' +
      '<span class="news-src">' + esc(it.source) + '</span>' +
      (h ? '<span class="news-domain">' + esc(h) + '</span>' : "") +
      (it.date ? '<span class="news-date">' + esc(it.date) + '</span>' : "") +
      '</div>' +
      '<a class="news-title" href="/article/' + it.id + '">' + esc(it.title) + '</a>' +
      '</div>' +
      '</article>'
    );
  }

  var SRC_LOGO = {
    "大连海事大学": "/static/img/source-logo-dlmu.png",
    "中科院海洋所": "/static/img/source-logo-qdio.png",
    "自然资源部": "/static/img/source-logo-mnr.png",
    "浙江海洋大学": "/static/img/source-logo-zjou.png",
    "上海海洋大学": "/static/img/source-logo-shou.png",
    "广东海洋大学": "/static/img/source-logo-gdou.png",
    "中国海洋大学": "/static/img/source-logo-ouc.svg",
    "国家海洋信息中心": "/static/img/source-logo-nmdis.png",
    "海洋二所(杭州)": "/static/img/source-logo-sio.png",
    "中国极地研究中心": "/static/img/source-logo-pric.png",
    "海纳解读": "/static/img/logo-white.svg",
    "海纳科普": "/static/img/favicon.svg"
  };

  function textItemHtml(it) {
    var logo = SRC_LOGO[it.source];
    return (
      '<div class="text-item">' +
      '<span class="src-logo' + (logo ? "" : " fallback") + '">' +
      (logo ? '<img src="' + logo + '" alt="' + esc(it.source) + '">' : esc(it.source.charAt(0))) +
      '</span>' +
      '<div class="text-body">' +
      '<div class="text-meta">' + esc(it.source) +
      (it.date ? '<span class="news-date">' + esc(it.date) + '</span>' : "") +
      '</div>' +
      '<a class="news-title" href="/article/' + it.id + '">' + esc(it.title) + '</a>' +
      '</div>' +
      '</div>'
    );
  }

  function render(items) {
    if (!items.length) {
      grid.innerHTML = '<div class="news-card empty">这一层暂时没捞到东西，换个深度看看</div>';
      return;
    }
    var withImg = [], noImg = [];
    items.forEach(function (it) { (it.image ? withImg : noImg).push(it); });

    var html = '<div class="news-main">';
    if (withImg.length) {
      html += '<div class="news-col news-col-img">' +
        withImg.map(function (it, i) { return cardHtml(it, i === 0); }).join("") + '</div>';
    }
    if (noImg.length) {
      // 2026-08-23：文字简报限制 5 篇——多了会覆盖右侧水母，想看更多点「查看全部动态」
      html += '<div class="news-col news-col-text"><div class="col-title">文字简报</div>' +
        noImg.slice(0, 5).map(textItemHtml).join("") + '</div>';
    }
    html += '</div>';
    grid.innerHTML = html;

    bindImgLoaded(grid);
    if (window.HainaAnimations) window.HainaAnimations.observeCards(".news-card");
  }

  /* 资讯卡图片：loaded 后加 .is-loaded，配合 CSS 渐显 */
  function moveToTextBrief(img) {
    var card = img.closest(".news-card");
    if (!card) return;
    card.classList.add("noimg");
    var titleEl = card.querySelector(".news-title");
    var srcEl = card.querySelector(".news-src");
    var dateEl = card.querySelector(".news-date");
    // 去重：如果这条标题已在文字简报区，不重复添加
    if (titleEl) {
      var existing = grid.querySelectorAll(".news-col-text .news-title");
      var dup = false;
      existing.forEach(function (a) { if (a.textContent === titleEl.textContent) dup = true; });
      if (dup) { card.remove(); return; }
    }
    var txtCol = grid.querySelector(".news-col-text");
    if (!txtCol) {
      txtCol = document.createElement("div");
      txtCol.className = "news-col news-col-text";
      txtCol.innerHTML = '<div class="col-title">文字简报</div>';
      var main = grid.querySelector(".news-main");
      if (main) main.appendChild(txtCol);
    }
    if (txtCol && titleEl) {
      var ti = document.createElement("div");
      ti.innerHTML = textItemHtml({
        id: (titleEl.getAttribute("href") || "").replace("/article/", ""),
        title: titleEl.textContent,
        source: srcEl ? srcEl.textContent : "",
        date: dateEl ? dateEl.textContent : ""
      });
      txtCol.appendChild(ti.firstChild);
      card.remove();
    }
  }
  window.moveToTextBrief = moveToTextBrief;

  function bindImgLoaded(scope) {
    if (!scope) return;
    var imgs = scope.querySelectorAll(".news-thumb img");
    imgs.forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add("is-loaded");
        var th = img.closest(".news-thumb");
        if (th) th.style.display = "block";
        return;
      }
      // 图片已失败（complete 但 naturalWidth=0）：立即移到文字简报区
      if (img.complete && img.naturalWidth === 0) {
        moveToTextBrief(img);
        return;
      }
      img.addEventListener("load", function () {
        img.classList.add("is-loaded");
        var th = img.closest(".news-thumb");
        if (th) th.style.display = "block";
      }, { once: true });
      img.addEventListener("error", function () {
        img.classList.add("is-loaded");
        moveToTextBrief(img);
      }, { once: true });
      // 图片超时兜底：3 秒后还没加载成功，也移到文字简报区
      setTimeout(function () {
        if (img.complete && img.naturalWidth > 0) return;
        if (!img.closest(".news-card")) return;
        img.dispatchEvent(new Event("error"));
      }, 8000);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function loadNews() {
    grid.innerHTML = '<div class="loading">打捞中……</div>';
    var q = new URLSearchParams({ limit: "20" });
    if (cat) q.set("category", cat);
    if (src) q.set("source", src);
    fetch("/api/news?" + q)
      .then(function (r) { return r.json(); })
      .then(function (data) { render(data.items || []); })
      .catch(function () {
        grid.innerHTML = '<div class="news-card empty">打捞失败……请确认动态服务在跑</div>';
      });
  }

  function bindTabs(groupId, key) {
    var group = document.getElementById(groupId);
    group.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      group.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      if (key === "cat") { cat = btn.dataset.cat || ""; sessionStorage.setItem("haina_cat", cat); }
      else { src = btn.dataset.src || ""; sessionStorage.setItem("haina_src", src); }
      loadNews();
    });
  }

  var TRANSFER_PAGE_SIZE = 8;
  var transferItems = [];
  var transferPage = 0;

  function loadTransfer() {
    var box = document.getElementById("transferList");
    if (!box) return;
    fetch("/api/news?category=" + encodeURIComponent("转行出路") + "&limit=50")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        transferItems = data.items || [];
        transferPage = 0;
        renderTransferPage();
      })
      .catch(function () {
        box.innerHTML = '<div class="news-card empty">打捞失败……</div>';
      });
  }

  function renderTransferPage() {
    var box = document.getElementById("transferList");
    var pager = document.getElementById("transferPager");
    if (!box) return;
    var total = transferItems.length;
    var pages = Math.ceil(total / TRANSFER_PAGE_SIZE);
    if (pages === 0) {
      box.innerHTML = '<div class="news-card empty">文章正在路上……</div>';
      if (pager) pager.style.display = "none";
      return;
    }
    if (transferPage >= pages) transferPage = pages - 1;
    if (transferPage < 0) transferPage = 0;
    var start = transferPage * TRANSFER_PAGE_SIZE;
    var pageItems = transferItems.slice(start, start + TRANSFER_PAGE_SIZE);

    box.innerHTML = pageItems.map(function (it) {
      return '<article class="news-card">' +
        '<div class="news-text">' +
        '<div class="news-meta"><span class="news-src">海纳解读</span>' +
        (it.date ? '<span class="news-date">' + esc(it.date) + '</span>' : "") +
        '</div>' +
        '<a class="news-title" href="/article/' + it.id + '">' + esc(it.title) + '</a>' +
        '</div>' +
        '</article>';
    }).join("");
    if (window.HainaAnimations) window.HainaAnimations.observeCards(".transfer-list .news-card");

    if (pager) {
      if (pages > 1) {
        pager.style.display = "flex";
        pager.innerHTML =
          '<button class="page-btn"' + (transferPage === 0 ? ' disabled' : '') + ' data-p="' + (transferPage - 1) + '">‹ 上一页</button>' +
          '<span class="page-info">第 ' + (transferPage + 1) + ' 页 / 共 ' + pages + ' 页</span>' +
          '<button class="page-btn"' + (transferPage >= pages - 1 ? ' disabled' : '') + ' data-p="' + (transferPage + 1) + '">下一页 ›</button>';
      } else {
        pager.style.display = "none";
      }
    }
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".transfer-pager .page-btn") : null;
    if (btn && !btn.disabled) {
      transferPage = parseInt(btn.getAttribute("data-p"), 10);
      renderTransferPage();
    }
  });

  bindTabs("catTabs", "cat");
  bindTabs("srcTabs", "src");

  // 来源标签动态生成：从 /api/filters 拉真实来源列表（加源自动出现）
  fetch("/api/filters")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var group = document.getElementById("srcTabs");
      if (!d.sources) return;
      Object.keys(d.sources).sort().forEach(function (s) {
        var b = document.createElement("button");
        b.className = "filter-btn";
        b.dataset.src = s;
        b.textContent = s;
        group.appendChild(b);
      });
      // 恢复来源 tab 的 active 状态（返回上一页时保留筛选）
      group.querySelectorAll(".filter-btn").forEach(function (b) {
        b.classList.toggle("active", (b.dataset.src || "") === src);
      });
    })
    .catch(function () {});

  // 恢复分类 tab 的 active 状态（返回上一页时保留筛选）
  document.querySelectorAll("#catTabs .filter-btn").forEach(function (b) {
    b.classList.toggle("active", (b.dataset.cat || "") === cat);
  });

  loadNews();
  loadTransfer();

  // 转行数据看板：展开完整行业分布图
  window.toggleIndustry = function () {
    var box = document.getElementById("fullIndustry");
    if (!box) return;
    var hidden = box.style.display === "none";
    box.style.display = hidden ? "block" : "none";
  };

  // ============ 首页岗位板块 ============
  function homeJobCard(j) {
    var majors = (j.major || "").split(",").filter(Boolean).map(function (m) {
      return '<span class="jtag">' + esc(m) + "</span>";
    }).join("");
    var meta = [];
    if (j.education) meta.push(esc(j.education));
    if (j.region) meta.push(esc(j.region));
    if (j.salary) meta.push(esc(j.salary));
    if (j.deadline) meta.push("截止 " + esc(j.deadline));
    return (
      '<a class="home-job-card" href="/job/' + j.id + '">' +
      '<div class="hjc-top">' +
      '<span class="hjc-title">' + esc(j.title) + "</span>" +
      (j.unit_type ? '<span class="badge">' + esc(j.unit_type) + "</span>" : "") +
      "</div>" +
      '<div class="hjc-unit">' + esc(j.unit) + "</div>" +
      (majors ? '<div class="hjc-majors">' + majors + "</div>" : "") +
      '<div class="hjc-meta">' + meta.join('<span class="dot">·</span>') + "</div>" +
      "</a>"
    );
  }

  function loadHomeJobs() {
    var box = document.getElementById("homeJobs");
    if (!box) return;
    fetch("/api/jobs?limit=6")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var items = d.items || [];
        if (!items.length) {
          box.innerHTML = '<div class="job-empty">岗位库还在积累，等米下锅……</div>';
          return;
        }
        box.innerHTML = items.map(homeJobCard).join("");
        if (window.HainaAnimations) window.HainaAnimations.observeCards(".home-job-card");
        // 2026-08-23：标记岗位数据加载完成，content 页 loading 遮罩据此隐藏
        window.__jobsDataReady = true;
      })
      .catch(function () {
        box.innerHTML = '<div class="job-empty">岗位加载失败</div>';
      });
  }

  loadHomeJobs();

  // hero 区动态统计
  function loadStats() {
    fetch("/api/stats")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) return;
        document.getElementById("statJobs").textContent = d.jobs_total || 0;
        document.getElementById("statNews").textContent = d.total || 0;
      })
      .catch(function () {});
  }
  loadStats();

  // 论坛链接动态化：把写死的 localhost:8000 换成当前主机名（手机局域网也能进论坛）
  function fixForumLinks() {
    var host = window.location.hostname;
    var base = "http://" + host + ":8000";
    document.querySelectorAll('a[href*="localhost:8000"]').forEach(function (a) {
      a.setAttribute("href", a.getAttribute("href").replace("http://localhost:8000", base));
    });
  }
  fixForumLinks();

  // 汉堡菜单切换
  var burger = document.getElementById("navBurger");
  var navLinksEl = document.getElementById("navLinks");
  if (burger && navLinksEl) {
    burger.addEventListener("click", function () {
      var open = navLinksEl.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinksEl.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        navLinksEl.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ============ 投稿弹窗（PGC 邮件审核制） ============ */
  // 加载省级下拉（PCAS）
  (function loadProv() {
    var prov = document.getElementById("postProv");
    if (!prov) return;
    fetch("/static/data/pcas.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        Object.keys(data).forEach(function (k) {
          var o = document.createElement("option");
          o.value = k; o.textContent = k;
          prov.appendChild(o);
        });
      })
      .catch(function () {});
  })();
  // 省级变化 → 市级
  var postProv = document.getElementById("postProv");
  var postCity = document.getElementById("postCity");
  var postDistrict = document.getElementById("postDistrict");
  if (postProv && postCity) {
    postProv.addEventListener("change", function () {
      postCity.innerHTML = '<option value="">城市</option>';
      postDistrict.innerHTML = '<option value="">区县</option>';
      var provs = window.__pcas || {};
      var cities = provs[postProv.value] || {};
      Object.keys(cities).forEach(function (k) {
        var o = document.createElement("option");
        o.value = k; o.textContent = k;
        postCity.appendChild(o);
      });
    });
  }
  if (postCity && postDistrict) {
    postCity.addEventListener("change", function () {
      postDistrict.innerHTML = '<option value="">区县</option>';
      var provs = window.__pcas || {};
      var city = (provs[postProv.value] || {})[postCity.value] || [];
      city.forEach(function (d) {
        var o = document.createElement("option");
        o.value = d; o.textContent = d;
        postDistrict.appendChild(o);
      });
    });
  }
  // 加载 PCAS 数据到全局
  fetch("/static/data/pcas.json")
    .then(function (r) { return r.json(); })
    .then(function (data) { window.__pcas = data; })
    .catch(function () {});

  // 弹窗显示/隐藏
  var uploadOpen = document.getElementById("uploadOpen");
  var uploadModal = document.getElementById("uploadModal");
  var uploadClose = document.getElementById("uploadClose");
  if (uploadOpen && uploadModal) {
    uploadOpen.addEventListener("click", function () {
      uploadModal.style.display = "flex";
    });
  }
  if (uploadClose && uploadModal) {
    uploadClose.addEventListener("click", function () {
      uploadModal.style.display = "none";
    });
  }
  // 点击遮罩关闭
  if (uploadModal) {
    uploadModal.addEventListener("click", function (e) {
      if (e.target === uploadModal) uploadModal.style.display = "none";
    });
  }

  // 提交
  var postSubmit = document.getElementById("postSubmit");
  var postImage = document.getElementById("postImage");
  var postText = document.getElementById("postText");
  var postDetail = document.getElementById("postDetail");
  var postEmail = document.getElementById("postEmail");

  if (postSubmit) {
    postSubmit.addEventListener("click", function () {
      var file = postImage && postImage.files && postImage.files[0];
      if (!file) { alert("请选择一张照片"); return; }
      var prov = postProv ? postProv.value : "";
      var city = postCity ? postCity.value : "";
      var dist = postDistrict ? postDistrict.value : "";
      var detail = postDetail ? postDetail.value.trim() : "";
      var address = [prov, city, dist, detail].filter(Boolean).join(" ");
      if (!address) { alert("请填写地址（至少选省市）"); return; }

      var fd = new FormData();
      fd.append("image", file);
      fd.append("address", address);
      if (postText && postText.value.trim()) fd.append("text", postText.value.trim());
      if (postEmail && postEmail.value.trim()) fd.append("email", postEmail.value.trim());
      // 蜜罐字段：已存在 hidden input，FormData 不会自动包含
      // 但如果用户没填（正常情况），就 OK
      // 注意：HTML 里蜜罐 name="website"，但 display:none，浏览器不会填

      postSubmit.disabled = true;
      postSubmit.textContent = "投稿中…";

      fetch("/api/ocean/submit", { method: "POST", body: fd })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.d.ok) {
            alert(res.d.message || "投稿成功！审核通过后会刊登");
            uploadModal.style.display = "none";
            if (postImage) postImage.value = "";
            if (postText) postText.value = "";
            if (postDetail) postDetail.value = "";
            if (postEmail) postEmail.value = "";
          } else {
            alert(res.d.error || "投稿失败，请稍后再试");
          }
          postSubmit.disabled = false;
          postSubmit.textContent = "投稿";
        })
        .catch(function () {
          alert("网络错误，请稍后再试");
          postSubmit.disabled = false;
          postSubmit.textContent = "投稿";
        });
    });
  }

  // 初始化登录态（auth.js 提供）
  if (window.HainaAuth) window.HainaAuth.initAuth();
})();
