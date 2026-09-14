// 站长后台：登录态 + 权限检查 + 待审投稿审核
(function () {
  var gate = document.getElementById("gate");
  var panel = document.getElementById("panel");

  function token() { return window.HainaAuth ? window.HainaAuth.getToken() : ""; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 检查登录 + 是否管理员
  function checkAdmin() {
    var t = token();
    if (!t) {
      gate.style.display = "block";
      panel.style.display = "none";
      return;
    }
    fetch("/api/auth/me", { headers: { "Authorization": "Bearer " + t } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok && d.user && d.user.is_admin) {
          gate.style.display = "none";
          panel.style.display = "block";
          loadPending();
        } else {
          gate.style.display = "block";
          panel.style.display = "none";
        }
      })
      .catch(function () {
        gate.style.display = "block";
        panel.style.display = "none";
      });
  }

  function postCard(p) {
    return '<div class="pending-card" id="pcard-' + p.id + '">' +
      (p.image_url ? '<div class="pending-img" style="background-image:url(\'' + esc(p.image_url) + '\')"></div>' : "") +
      '<div class="pending-body">' +
      '<div class="pending-meta">投稿 #' + p.id + ' · ' + esc(p.nickname || "匿名") + ' · ' + esc(p.created_at || "") + '</div>' +
      (p.address ? '<div class="pending-addr">📍 ' + esc(p.address) + '</div>' : "") +
      (p.text ? '<div class="pending-text">' + esc(p.text) + '</div>' : "") +
      '<div class="pending-actions">' +
      '<button class="btn-approve" onclick="review(' + p.id + ',1)">通过（上地图）</button>' +
      '<button class="btn-reject" onclick="review(' + p.id + ',0)">拒绝</button>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function loadPending() {
    fetch("/api/admin/pending", { headers: { "Authorization": "Bearer " + token() } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var posts = d.posts || [];
        document.getElementById("pendingList").innerHTML = posts.length
          ? posts.map(postCard).join("")
          : '<div class="empty">没有待审投稿，邮箱有新投稿会由 agent 自动收录</div>';
      })
      .catch(function () {
        document.getElementById("pendingList").innerHTML = '<div class="empty">加载失败</div>';
      });
  }

  window.review = function (id, approve) {
    fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token() },
      body: JSON.stringify({ kind: "post", id: id, action: approve ? "approve" : "reject" }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          var el = document.getElementById("pcard-" + id);
          if (el) el.remove();
          if (!document.querySelector(".pending-card")) loadPending();
        } else {
          alert(d.error || "操作失败");
        }
      });
  };

  // 登录态变化后重新检查权限
  var authBtn = document.getElementById("authBtn");
  if (authBtn) {
    authBtn.addEventListener("click", function () {
      setTimeout(checkAdmin, 1500);
    });
  }

  if (window.HainaAuth) window.HainaAuth.initAuth();
  checkAdmin();
})();
