/* 海纳 · 独立资讯页逻辑：全量分类 + 传统分页 */
(function () {
  "use strict";
  var PAGE = 20;
  var cat = "", src = "", page = 1, totalPages = 1;

  var list = document.getElementById("list");
  var pager = document.getElementById("pager");
  var prevBtn = document.getElementById("prevBtn");
  var nextBtn = document.getElementById("nextBtn");
  var pageInfo = document.getElementById("pageInfo");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function itemHtml(it) {
    var thumb = it.image
      ? '<div class="thumb"><img src="' + esc(it.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest(\'.item\').classList.add(\'no-thumb\');this.closest(\'.thumb\').remove()"></div>'
      : "";
    return (
      '<a class="item' + (it.image ? "" : " no-thumb") + '" href="/article/' + it.id + '">' +
      thumb +
      '<div class="body">' +
      '<div class="meta"><span class="src">' + esc(it.source) + '</span>' +
      '<span class="date">' + esc(it.date || "") + '</span></div>' +
      '<div class="title">' + esc(it.title) + '</div>' +
      '</div>' +
      '</a>'
    );
  }

  function load() {
    list.innerHTML = '<div class="loading">打捞中……</div>';
    var q = new URLSearchParams({ limit: String(PAGE), offset: String((page - 1) * PAGE) });
    if (cat) q.set("category", cat);
    if (src) q.set("source", src);
    fetch("/api/news?" + q)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var items = d.items || [];
        totalPages = Math.max(1, Math.ceil((d.total || 0) / PAGE));
        if (page > totalPages) { page = totalPages; return load(); }
        if (!items.length) {
          list.innerHTML = '<div class="empty">这一层暂时没捞到东西</div>';
        } else {
          list.innerHTML = items.map(itemHtml).join("");
        }
        pageInfo.textContent = "第 " + page + "/" + totalPages + " 页";
        prevBtn.disabled = page <= 1;
        nextBtn.disabled = page >= totalPages;
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch(function () {
        list.innerHTML = '<div class="empty">打捞失败，请确认动态服务在跑</div>';
      });
  }

  function bindTabs(groupId, key) {
    document.getElementById(groupId).addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      this.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      if (key === "cat") { cat = btn.dataset.cat || ""; } else { src = btn.dataset.src || ""; }
      page = 1;
      load();
    }.bind(document.getElementById(groupId)));
  }

  // 动态生成分类 tab（全量）与来源 tab
  fetch("/api/filters").then(function (r) { return r.json(); }).then(function (d) {
    var catGroup = document.getElementById("catTabs");
    if (d.categories) {
      Object.keys(d.categories).sort().forEach(function (c) {
        var b = document.createElement("button");
        b.className = "filter-btn";
        b.dataset.cat = c;
        b.textContent = c;
        catGroup.appendChild(b);
      });
    }
    var srcGroup = document.getElementById("srcTabs");
    if (d.sources) {
      Object.keys(d.sources).sort().forEach(function (s) {
        var b = document.createElement("button");
        b.className = "filter-btn";
        b.dataset.src = s;
        b.textContent = s;
        srcGroup.appendChild(b);
      });
    }
    bindTabs("catTabs", "cat");
    bindTabs("srcTabs", "src");
    load();
  }).catch(function () { load(); });

  prevBtn.addEventListener("click", function () { if (page > 1) { page--; load(); } });
  nextBtn.addEventListener("click", function () { if (page < totalPages) { page++; load(); } });
})();
