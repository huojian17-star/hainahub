/* 海纳 · 期刊分级列表页（卡片网格 + 分类筛选） */
(function () {
  "use strict";
  var grid = document.getElementById("journalGrid");
  var filter = document.getElementById("journalFilter");
  if (!grid) return;

  var allJournals = [];
  // 研究方向 → 分类映射（根据 field 关键词归类）
  function catOf(field) {
    if (/物理|环流|遥感|数值|模拟/.test(field)) return "物理海洋";
    if (/生态|生物|渔业|浮游/.test(field)) return "海洋生态";
    if (/化学|地球化学|碳/.test(field)) return "海洋化学";
    if (/工程|船舶|结构/.test(field)) return "海洋工程";
    if (/管理|海岸|政策/.test(field)) return "海洋管理";
    return "综合海洋";
  }

  fetch("/static/data/journals.json")
    .then(function (r) { return r.json(); })
    .then(function (journals) {
      allJournals = journals.map(function (j) { j._cat = catOf(j.field); return j; });
      render("全部");
    })
    .catch(function () { grid.innerHTML = '<p class="journal-empty">期刊数据加载失败。</p>'; });

  function render(cat) {
    var list = cat === "全部" ? allJournals : allJournals.filter(function (j) { return j._cat === cat; });
    if (!list.length) { grid.innerHTML = '<p class="journal-empty">该分类暂无期刊。</p>'; return; }
    grid.innerHTML = list.map(function (j) {
      var cover = j.cover ? '/static/img/journal/' + j.cover : '/static/img/journal/' + j.id + '.png';
      return '<a class="jg-card" href="/journal/' + j.id + '">' +
        '<div class="jg-cover-box"><img class="jg-cover" src="' + cover + '" alt="' + j.name + '" onerror="this.parentNode.classList.add(\'noimg\');this.remove();"><span class="jg-cover-fallback">' + j.name[0] + '</span></div>' +
        '<div class="jg-info">' +
          '<div class="jg-name">' + j.name + '</div>' +
          '<div class="jg-meta"><span class="journal-badge zone-' + (j.cas_zone.indexOf("1") === 0 ? "q1" : "q2") + '">' + j.cas_zone + '</span><span class="jg-if">IF ' + j.if + '</span></div>' +
        '</div>' +
      '</a>';
    }).join("");
  }

  if (filter) {
    filter.addEventListener("click", function (e) {
      if (e.target.classList.contains("jf-btn")) {
        filter.querySelectorAll(".jf-btn").forEach(function (b) { b.classList.remove("active"); });
        e.target.classList.add("active");
        render(e.target.getAttribute("data-cat"));
      }
    });
  }
})();
