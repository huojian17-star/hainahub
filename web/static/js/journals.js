/* 海纳 · 期刊分级卡片轮换（scroll-snap 平滑横向滚动） */
(function () {
  "use strict";
  var track = document.getElementById("journalTrack");
  if (!track) return;

  fetch("/static/data/journals.json")
    .then(function (r) { return r.json(); })
    .then(function (journals) {
      if (!journals || !journals.length) { track.innerHTML = '<p class="journal-empty">期刊数据整理中。</p>'; return; }
      // 卡片：封面 + 期刊名，点击进详情页
      var html = journals.map(function (j) {
        var cover = j.cover ? '/static/img/journal/' + j.cover : '/static/img/journal/' + j.id + '.png';
        return '<a class="jc-card" href="/journal/' + j.id + '">' +
          '<div class="jc-cover-box"><img class="jc-cover" src="' + cover + '" alt="' + j.name + '" onerror="this.parentNode.classList.add(\'noimg\');this.remove();"><span class="jc-cover-fallback">' + j.name[0] + '</span></div>' +
          '<div class="jc-name">' + j.name + '</div>' +
          '<div class="jc-meta"><span class="journal-badge zone-' + (j.cas_zone.indexOf("1") === 0 ? "q1" : "q2") + '">' + j.cas_zone + '</span></div>' +
        '</a>';
      }).join("");
      track.innerHTML = html;

      // 预加载所有封面图（浏览器缓存，切换时立即显示）
      journals.forEach(function (j) {
        var cover = j.cover ? '/static/img/journal/' + j.cover : '/static/img/journal/' + j.id + '.png';
        var im = new Image();
        im.src = cover;
      });

      var cards = track.querySelectorAll(".jc-card");
      // 每步平移 = 卡片实际宽 + gap
      function step() {
        return cards[0].getBoundingClientRect().width + 16;
      }
      var idx = 0;
      function go(i) {
        idx = Math.max(0, Math.min(cards.length - 4, i));
        track.scrollTo({ left: idx * step(), behavior: "smooth" });
      }
      var prev = document.getElementById("jcPrev");
      var next = document.getElementById("jcNext");
      if (prev) prev.addEventListener("click", function () { go(idx - 1); });
      if (next) next.addEventListener("click", function () { go(idx + 1); });
      // 自动轮换（每 4 秒）
      var timer = setInterval(function () {
        go(idx + 1 > cards.length - 4 ? 0 : idx + 1);
      }, 4000);
      // 鼠标悬停暂停
      var carousel = document.getElementById("journalCarousel");
      if (carousel) {
        carousel.addEventListener("mouseenter", function () { clearInterval(timer); });
        carousel.addEventListener("mouseleave", function () {
          timer = setInterval(function () {
            go(idx + 1 > cards.length - 4 ? 0 : idx + 1);
          }, 4000);
        });
      }
      // 窗口缩放时重新对齐
      window.addEventListener("resize", function () { go(idx); });
    })
    .catch(function () { track.innerHTML = '<p class="journal-empty">期刊数据加载失败。</p>'; });
})();
