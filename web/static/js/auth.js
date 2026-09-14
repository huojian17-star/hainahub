// 海纳公共登录态（首页 + 海域图鉴等全站共用）
(function () {
  function getToken() { return localStorage.getItem("haina_token") || ""; }
  function getUsername() { return localStorage.getItem("haina_username") || ""; }
  // 2026-08-24：HTML 转义（防 XSS，avatar/username 注入）
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function setLogin(token, username) {
    localStorage.setItem("haina_token", token);
    localStorage.setItem("haina_username", username);
    updateAuthBtn();
  }
  function logout() {
    localStorage.removeItem("haina_token");
    localStorage.removeItem("haina_username");
    updateAuthBtn();
  }
  function updateAuthBtn() {
    var btn = document.getElementById("authBtn");
    if (!btn) return;
    var name = getUsername();
    var token = getToken();
    if (name && token) {
      btn.classList.add("logged");
      btn.textContent = name;
      fetch("/api/auth/me", { headers: { "Authorization": "Bearer " + token } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok && d.user && d.user.avatar) {
            btn.innerHTML = '<img class="topbar-avatar" src="' + escapeHtml(d.user.avatar) + '" alt=""> <span>' + escapeHtml(name) + '</span>';
          }
        })
        .catch(function () {});
    } else {
      btn.classList.remove("logged");
      btn.textContent = "登录";
    }
  }
  function initAuth() {
    var authModal = document.getElementById("authModal");
    var authBtn = document.getElementById("authBtn");
    if (!authModal || !authBtn) return;
    var authMode = "login";

    // 动态给弹窗加"圆形头像选择器"（仅注册模式显示）
    var box = authModal.querySelector(".auth-box");
    var avatarWrap = null;
    var avatarInput = null;
    var avatarPreview = null;
    var avatarPlaceholder = null;
    if (box) {
      avatarWrap = document.createElement("div");
      avatarWrap.className = "avatar-picker";
      avatarWrap.style.display = "none";
      avatarWrap.innerHTML =
        '<label class="avatar-circle">' +
        '<img class="avatar-preview" alt="" style="display:none">' +
        '<span class="avatar-placeholder">＋</span>' +
        '<input type="file" accept="image/*" style="display:none">' +
        '</label>' +
        '<div class="avatar-picker-tip">点击上传头像</div>';
      box.insertBefore(avatarWrap, box.querySelector("#authUsername"));
      avatarInput = avatarWrap.querySelector("input");
      avatarPreview = avatarWrap.querySelector(".avatar-preview");
      avatarPlaceholder = avatarWrap.querySelector(".avatar-placeholder");
      avatarInput.addEventListener("change", function () {
        var f = avatarInput.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          avatarPreview.src = e.target.result;
          avatarPreview.style.display = "block";
          avatarPlaceholder.style.display = "none";
        };
        reader.readAsDataURL(f);
      });
    }

    function setMode(mode) {
      authMode = mode;
      document.getElementById("authTitle").textContent = mode === "login" ? "登录" : "注册";
      document.getElementById("authSubmit").textContent = mode === "login" ? "登录" : "注册";
      document.getElementById("authToggle").textContent = mode === "login" ? "去注册" : "去登录";
      if (avatarWrap) avatarWrap.style.display = mode === "register" ? "flex" : "none";
      var p2 = document.getElementById("authPassword2");
      var fg = document.getElementById("authForgot");
      if (p2) p2.style.display = mode === "register" ? "block" : "none";
      if (fg) fg.style.display = mode === "login" ? "block" : "none";
    }

    authBtn.onclick = function () {
      if (getToken()) { location.href = "/profile"; return; }
      setMode("login");
      authModal.classList.add("open");
    };

    document.getElementById("authToggle").onclick = function () {
      setMode(authMode === "login" ? "register" : "login");
    };

    var forgotBtn = document.getElementById("authForgot");
    if (forgotBtn) forgotBtn.onclick = function () {
      alert("MVP 阶段暂未开放自助找回，请联系管理员重置密码");
    };

    document.getElementById("authSubmit").onclick = function () {
      var u = document.getElementById("authUsername").value.trim();
      var p = document.getElementById("authPassword").value;
      var p2el = document.getElementById("authPassword2");
      if (authMode === "register" && p2el && p2el.value !== p) {
        alert("两次输入的密码不一致");
        return;
      }
      var url = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      var btn = document.getElementById("authSubmit");
      var avatarFile = avatarInput ? avatarInput.files[0] : null;
      btn.textContent = "处理中……"; btn.disabled = true;
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            setLogin(d.token, d.username);
            authModal.classList.remove("open");
            document.getElementById("authUsername").value = "";
            document.getElementById("authPassword").value = "";
            // 注册时选了头像，上传
            if (authMode === "register" && avatarFile) {
              var fd = new FormData();
              fd.append("avatar", avatarFile);
              fetch("/api/auth/avatar", {
                method: "POST",
                body: fd,
                headers: { "Authorization": "Bearer " + d.token },
              }).catch(function () {});
              if (avatarInput) avatarInput.value = "";
              if (avatarPreview) { avatarPreview.style.display = "none"; avatarPreview.src = ""; }
              if (avatarPlaceholder) avatarPlaceholder.style.display = "block";
            }
          } else {
            alert(d.error || "操作失败");
          }
          btn.textContent = authMode === "login" ? "登录" : "注册";
          btn.disabled = false;
        })
        .catch(function () {
          alert("网络错误");
          btn.textContent = authMode === "login" ? "登录" : "注册";
          btn.disabled = false;
        });
    };

    authModal.addEventListener("click", function (e) {
      if (e.target === authModal) authModal.classList.remove("open");
    });

    updateAuthBtn();
  }

  window.HainaAuth = {
    getToken: getToken,
    getUsername: getUsername,
    setLogin: setLogin,
    logout: logout,
    initAuth: initAuth,
  };
})();
