// 个人主页逻辑
(function () {
  function getToken() { return localStorage.getItem("haina_token") || ""; }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var token = getToken();
  if (!token) { location.href = "/"; return; }

  function loadProfile() {
    fetch("/api/profile", { headers: { "Authorization": "Bearer " + token } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok || !d.profile) {
          alert("登录已过期，请重新登录");
          localStorage.removeItem("haina_token");
          localStorage.removeItem("haina_username");
          location.href = "/";
          return;
        }
        var p = d.profile;
        document.getElementById("profileName").textContent = p.username;
        document.getElementById("profileMeta").textContent =
          "加入于 " + (p.created_at || "").slice(0, 10);
        if (p.avatar) {
          document.getElementById("avatarImg").src = p.avatar;
          document.getElementById("avatarImg").style.display = "block";
          document.getElementById("avatarFallback").style.display = "none";
        }
        if (p.bio) {
          document.getElementById("profileBio").textContent = p.bio;
        }
        renderPosts(p.posts || []);
        renderComments(p.comments || []);
      })
      .catch(function () { location.href = "/"; });
  }

  function renderPosts(posts) {
    var box = document.getElementById("postList");
    if (!posts.length) { box.innerHTML = '<div class="empty">还没分享过海域</div>'; return; }
    box.innerHTML = posts.map(function (p) {
      return '<div class="post-item"><img src="' + esc(p.image_url) + '" alt="" loading="lazy">' +
        '<div class="post-addr">' + esc(p.address || "") + '</div></div>';
    }).join("");
  }

  function renderComments(comments) {
    var box = document.getElementById("commentList");
    if (!comments.length) { box.innerHTML = '<div class="empty">还没评论过</div>'; return; }
    box.innerHTML = comments.map(function (c) {
      return '<div class="comment-item"><div class="c-text">' + esc(c.text) + '</div>' +
        '<div class="c-time">' + esc((c.created_at || "").slice(0, 16)) + '</div></div>';
    }).join("");
  }

  // 换头像
  document.getElementById("changeAvatar").onclick = function () {
    document.getElementById("avatarFile").click();
  };
  document.getElementById("avatarFile").onchange = function () {
    var f = this.files[0];
    if (!f) return;
    var fd = new FormData();
    fd.append("avatar", f);
    fetch("/api/auth/avatar", { method: "POST", body: fd, headers: { "Authorization": "Bearer " + token } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) { location.reload(); }
        else { alert(d.error || "上传失败"); }
      });
  };

  // 编辑简介
  var bioEditor = document.getElementById("bioEditor");
  document.getElementById("editBio").onclick = function () {
    document.getElementById("bioInput").value =
      document.getElementById("profileBio").textContent === "这个人还没写简介"
        ? "" : document.getElementById("profileBio").textContent;
    bioEditor.style.display = "block";
  };
  document.getElementById("bioCancel").onclick = function () {
    bioEditor.style.display = "none";
  };
  document.getElementById("bioSave").onclick = function () {
    var bio = document.getElementById("bioInput").value.trim();
    fetch("/api/profile/bio", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ bio: bio }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          document.getElementById("profileBio").textContent = bio || "这个人还没写简介";
          bioEditor.style.display = "none";
        } else { alert(d.error || "保存失败"); }
      });
  };

  // 退出登录
  document.getElementById("logoutBtn").onclick = function () {
    fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token },
    }).catch(function () {});
    localStorage.removeItem("haina_token");
    localStorage.removeItem("haina_username");
    location.href = "/";
  };

  loadProfile();
})();
