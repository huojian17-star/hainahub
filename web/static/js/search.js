// 海纳搜索
(function () {
  var input = document.getElementById("q");
  var results = document.getElementById("results");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function render(data) {
    if (!data.query) {
      results.innerHTML = '<div class="search-hint">输入关键词，搜资讯、岗位、专业指南</div>';
      return;
    }
    var a = data.articles || [], j = data.jobs || [], g = data.guide || [];
    var html = "";
    if (!a.length && !j.length && !g.length) {
      results.innerHTML = '<div class="search-empty">没搜到「' + esc(data.query) + '」，换个词试试</div>';
      return;
    }
    if (g.length) {
      html += '<div class="result-group"><div class="result-group-title">专业指南</div>';
      g.forEach(function (m) {
        html += '<div class="result-item"><a class="result-title" href="/guide/' + esc(m.id) + '">' + esc(m.name) + '</a></div>';
      });
      html += '</div>';
    }
    if (j.length) {
      html += '<div class="result-group"><div class="result-group-title">岗位</div>';
      j.forEach(function (it) {
        var meta = [it.unit, it.major, it.region, it.education].filter(Boolean).join(" · ");
        html += '<div class="result-item"><a class="result-title" href="/job/' + it.id + '">' + esc(it.title) + '</a>' +
          '<div class="result-meta">' + esc(meta) + '</div></div>';
      });
      html += '</div>';
    }
    if (a.length) {
      html += '<div class="result-group"><div class="result-group-title">资讯 · 文章</div>';
      a.forEach(function (it) {
        var meta = [it.source, it.category, it.date].filter(Boolean).join(" · ");
        html += '<div class="result-item"><a class="result-title" href="/article/' + it.id + '">' + esc(it.title) + '</a>' +
          '<div class="result-meta">' + esc(meta) + '</div></div>';
      });
      html += '</div>';
    }
    results.innerHTML = html;
  }

  function doSearch() {
    var q = input.value.trim();
    if (!q) {
      render({ query: "" });
      return;
    }
    fetch("/api/search?q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(render)
      .catch(function () {
        results.innerHTML = '<div class="search-empty">搜索出了点问题，稍后再试</div>';
      });
  }

  var timer = null;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(doSearch, 300);
  });

  // 支持从导航带 q 进来
  var params = new URLSearchParams(location.search);
  if (params.get("q")) {
    input.value = params.get("q");
    doSearch();
  }
})();
