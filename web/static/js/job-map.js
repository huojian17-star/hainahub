/* 海纳 · 岗位对应表（job-map.js） */
(function () {
  "use strict";
  var svg = document.getElementById("treeSvg");
  var detailEl = document.getElementById("detail");
  var select = document.getElementById("majorSelect");
  var treeTitle = document.getElementById("treeTitle");
  var closeBtn = document.getElementById("detailClose");
  var NS = "http://www.w3.org/2000/svg";
  var X0 = 80, Y0 = 60, COL_W = 340, ROW_H = 50, NODE_W = 170, NODE_H = 36;
  var data = null;
  var nodeEls = {};

  var FILES = [
    "physical_ocean.json",
    "marine_science.json",
    "marine_technology.json",
    "naval_architecture.json"
  ];
  var BASE = "/static/data/job_tree/";

  function loadAll() {
    var ps = FILES.map(function (f) {
      return fetch(BASE + f).then(function (r) { return r.json(); });
    });
    Promise.all(ps).then(function (arr) {
      select.innerHTML = "";
      arr.forEach(function (d) {
        var opt = document.createElement("option");
        opt.value = d.major.id;
        opt.textContent = d.major.name;
        select.appendChild(opt);
      });
      if (arr.length) { data = arr[0]; render(); }
    }).catch(function () {
      select.innerHTML = '<option value="">加载失败</option>';
    });
  }

  function render() {
    if (!data) return;
    svg.innerHTML = "";
    nodeEls = {};
    treeTitle.textContent = "岗位对应表 · " + data.major.name;
    detailEl.classList.remove("open");
    if (closeBtn) closeBtn.classList.remove("show");
    detailEl.innerHTML = '<div class="index">SKILL</div><div class="placeholder">点击左侧技能节点，查看学习路径与履历要求</div>';

    var layout = {};
    layout.major = { x: X0, y: Y0, level: 0 };
    var jobY = Y0, jobPos = [];
    data.jobs.forEach(function (job) {
      jobPos.push({ job: job, y: jobY });
      jobY += job.skills.length * ROW_H + 40;
    });
    var skillY = Y0;
    data.jobs.forEach(function (job) {
      job.skills.forEach(function (skill) {
        layout[skill.name] = { x: X0 + COL_W * 2, y: skillY, level: 2 };
        skillY += ROW_H;
      });
      skillY += 40;
    });
    var treeArea = document.querySelector(".job-map-tree-area");
    var availH = treeArea ? Math.max(600, treeArea.clientHeight - 80) : 720;
    var contentH = skillY + 80;
    var svgW = X0 + COL_W * 2 + 320;
    svg.setAttribute("height", availH);
    svg.setAttribute("viewBox", "0 0 " + svgW + " " + contentH);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    function measureText(t) {
      var c = document.createElement("canvas");
      var ctx = c.getContext("2d");
      ctx.font = "14px 'PingFang SC', 'Microsoft YaHei', sans-serif";
      return ctx.measureText(t).width;
    }
    function addNode(name, level, label, type, x, y) {
      var g = document.createElementNS(NS, "g");
      g.setAttribute("class", "job-map-node " + type);
      g.setAttribute("transform", "translate(" + x + "," + y + ")");
      var textW = measureText(label);
      var rectW = Math.max(NODE_W, textW + 24);
      var rect = document.createElementNS(NS, "rect");
      rect.setAttribute("width", rectW); rect.setAttribute("height", NODE_H); rect.setAttribute("rx", 6);
      g.appendChild(rect);
      var text = document.createElementNS(NS, "text");
      text.setAttribute("x", rectW / 2); text.setAttribute("y", NODE_H / 2 + 4);
      text.setAttribute("text-anchor", "middle");
      text.textContent = label;
      g.appendChild(text);
      svg.appendChild(g);
      nodeEls[name] = { g: g, rect: rect, type: type, name: name, w: rectW };
    }
    function addLink(px, pw, py, cx, cy, direct) {
      var x1 = px + pw, y1 = py + NODE_H / 2, x2 = cx, y2 = cy + NODE_H / 2;
      var path = document.createElementNS(NS, "path");
      if (direct) {
        path.setAttribute("class", "job-map-link level1");
        path.setAttribute("d", "M" + x1 + "," + y1 + " L" + x2 + "," + y1 + " L" + x2 + "," + y2);
      } else {
        path.setAttribute("class", "job-map-link");
        var mx = (x1 + x2) / 2;
        path.setAttribute("d", "M" + x1 + "," + y1 + " L" + mx + "," + y1 + " L" + mx + "," + y2 + " L" + x2 + "," + y2);
      }
      svg.appendChild(path);
    }

    addNode("major", 0, data.major.name, "root", layout.major.x, layout.major.y);
    jobPos.forEach(function (item) {
      var job = item.job, y = item.y;
      addNode(job.name, 1, job.name, "job", X0 + COL_W, y);
      addLink(layout.major.x, nodeEls["major"].w, layout.major.y, X0 + COL_W, y, true);
      job.skills.forEach(function (skill) {
        var sk = layout[skill.name];
        addNode(skill.name, 2, skill.name, "skill", sk.x, sk.y);
        addLink(X0 + COL_W, nodeEls[job.name].w, y, sk.x, sk.y);
      });
    });

    Object.keys(nodeEls).forEach(function (name) {
      var el = nodeEls[name];
      if (el.type !== "skill") return;
      el.g.addEventListener("click", function () {
        var job = data.jobs.find(function (j) { return j.skills.some(function (s) { return s.name === name; }); });
        var skill = job.skills.find(function (s) { return s.name === name; });
        showDetail(job, skill);
        detailEl.classList.add("open");
        if (closeBtn) closeBtn.classList.add("show");
        Object.keys(nodeEls).forEach(function (n) {
          nodeEls[n].g.classList.remove("active");
          nodeEls[n].g.classList.remove("dimmed");
        });
        el.g.classList.add("active");
        Object.keys(nodeEls).forEach(function (n) {
          if (n !== name) nodeEls[n].g.classList.add("dimmed");
        });
      });
    });
  }

  function showDetail(job, skill) {
    var steps = skill.path.map(function (p, i) {
      return '<div class="path-step"><span class="path-num">' + (i + 1) + '</span><span>' + p + '</span></div>';
    }).join("");
    var resumeHtml = "";
    if (skill.resume) {
      var r = skill.resume;
      var items = [["学历", r.edu], ["证书/资质", r.cert], ["项目/经验", r.exp], ["论文/成果", r.paper]]
        .filter(function (it) { return it[1]; });
      resumeHtml = '<div class="path-title">履历要求</div>' +
        items.map(function (it) {
          return '<div class="resume-item"><span class="resume-label">' + it[0] + '</span><span class="resume-val">' + it[1] + '</span></div>';
        }).join("") +
        '<div class="src">履历来源：' + r.src + '</div>';
    }
    detailEl.innerHTML = '<div class="index">SKILL</div>' +
      '<h2>' + skill.name + '</h2>' +
      '<div class="sub">' + job.name + ' · 所需技能</div>' +
      '<div class="desc">' + skill.desc + '</div>' +
      '<div class="path-title">学习路径</div>' + steps + resumeHtml +
      '<div class="src">学习路径来源：' + skill.src + '</div>';
  }

  select.addEventListener("change", function () {
    var idx = select.selectedIndex;
    if (idx < 0 || idx >= FILES.length) return;
    fetch(BASE + FILES[idx]).then(function (r) { return r.json(); }).then(function (d) {
      data = d; render();
    });
  });

  // 鼠标视差
  var treeArea = document.querySelector(".job-map-tree-area");
  treeArea.addEventListener("mousemove", function (e) {
    var rect = treeArea.getBoundingClientRect();
    var dx = (e.clientX - rect.left) / rect.width - 0.5;
    var dy = (e.clientY - rect.top) / rect.height - 0.5;
    svg.style.transform = "translate(" + (dx * -8) + "px," + (dy * -8) + "px)";
  });
  treeArea.addEventListener("mouseleave", function () {
    svg.style.transform = "translate(0,0)";
  });

  // 点击空白收起
  treeArea.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".job-map-node")) return;
    detailEl.classList.remove("open");
    if (closeBtn) closeBtn.classList.remove("show");
    Object.keys(nodeEls).forEach(function (n) {
      nodeEls[n].g.classList.remove("active");
      nodeEls[n].g.classList.remove("dimmed");
    });
  });

  // 关闭按钮收起详情
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      detailEl.classList.remove("open");
      closeBtn.classList.remove("show");
      Object.keys(nodeEls).forEach(function (n) {
        nodeEls[n].g.classList.remove("active");
        nodeEls[n].g.classList.remove("dimmed");
      });
    });
  }

  loadAll();
})();
