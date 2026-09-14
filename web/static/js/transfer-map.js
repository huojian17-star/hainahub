/* 海纳 · 转行出路交互图谱（呼吸感版） */
(function () {
  "use strict";

  var svg = document.getElementById("transferMapSvg");
  var detailBox = document.getElementById("transferMapDetail");
  if (!svg || !detailBox) return;

  var ns = "http://www.w3.org/2000/svg";
  var nodeMap = {};

  // ---------- 数据（更舒展的布局） ----------
  var nodes = [
    { id: "root", label: "海洋专业", sub: "Marine", x: 0.50, y: 0.48, shape: "hex", size: 18, type: "root",
      title: "海洋专业",
      subTitle: "Ocean-related Majors",
      desc: "海洋科学、海洋技术、船舶与海洋工程、航海技术、轮机工程、水声工程等专业的出路图谱。",
      items: [
        { k: "覆盖专业", v: "19 个" },
        { k: "数据来源", v: "就业报告 / 职友集" }
      ],
      link: "/salary"
    },

    { id: "industry", label: "行业去向", x: 0.22, y: 0.28, shape: "triangle", size: 11, type: "branch",
      title: "行业去向 Top 5",
      subTitle: "上海海洋大学 2024 届",
      desc: "本科毕业生就业人数最多的五个行业。",
      items: [
        { k: "制造业", v: "21.45%" },
        { k: "信息传输/软件", v: "11.06%" },
        { k: "科研/技术服务", v: "10.75%" },
        { k: "租赁/商务服务", v: "7.96%" },
        { k: "批发/零售", v: "6.62%" }
      ],
      link: "https://xxgk.shou.edu.cn/2025/0219/c8041a337932/page.htm"
    },

    { id: "further", label: "深造方向", x: 0.20, y: 0.70, shape: "circle", size: 11, type: "branch",
      title: "本科深造率对照",
      subTitle: "各校海洋相关学院",
      desc: "深造率越高，往往本科直接就业越难。",
      items: [
        { k: "中山大学海洋科学", v: "80%+" },
        { k: "海洋科学与技术学院", v: "49.25%" },
        { k: "船舶与海运学院", v: "34.82%" },
        { k: "海洋工程装备学院", v: "29.02%" },
        { k: "信息工程学院", v: "19.89%" }
      ],
      link: "https://marine.sysu.edu.cn/article/7887"
    },

    { id: "salary", label: "薪资对比", x: 0.78, y: 0.26, shape: "square", size: 10, type: "branch",
      title: "各专业薪资对比",
      subTitle: "应届毕业生起薪",
      desc: "海洋专业 vs 常见转行方向，起薪差距明显。",
      items: [
        { k: "电子信息工程", v: "15.6K" },
        { k: "海洋技术", v: "12.5K" },
        { k: "海洋科学", v: "9.7K" },
        { k: "行政管理", v: "5.3K" }
      ],
      link: "/salary"
    },

    { id: "path", label: "转行路径", x: 0.80, y: 0.72, shape: "hex", size: 11, type: "branch",
      title: "转行路径",
      subTitle: "真实去向参考",
      desc: "海洋工科除了进船舶系统，还能转电子、半导体、法律、行政等方向。",
      items: [
        { k: "水声工程", v: "电子 / 半导体" },
        { k: "海洋技术", v: "计算机 / 数据" },
        { k: "船舶工程", v: "机械 / 制造" },
        { k: "海洋科学", v: "科研 / 教育" }
      ],
      link: "/transfer"
    },

    // 行业子节点（更分散）
    { id: "manu", label: "制造业", x: 0.08, y: 0.16, shape: "triangle", size: 7, type: "leaf",
      title: "制造业", subTitle: "21.45%",
      desc: "船舶制造、海洋装备、机械制造是海洋专业最对口的去向。",
      items: [ { k: "代表单位", v: "中国船舶集团" } ]
    },
    { id: "it", label: "信息/软件", x: 0.06, y: 0.38, shape: "triangle", size: 7, type: "leaf",
      title: "信息传输、软件", subTitle: "11.06%",
      desc: "海洋技术、水声工程背景转码有优势，尤其信号处理方向。",
      items: [ { k: "常见岗位", v: "算法 / 开发 / 测试" } ]
    },
    { id: "sci", label: "科研/技术", x: 0.12, y: 0.52, shape: "triangle", size: 7, type: "leaf",
      title: "科学研究、技术服务", subTitle: "10.75%",
      desc: "科研院所、检测机构、环保评估等技术服务岗位。",
      items: [ { k: "代表单位", v: "海洋所 / 监测中心" } ]
    },

    // 深造子节点
    { id: "sysu", label: "中山大学", x: 0.08, y: 0.84, shape: "circle", size: 7, type: "leaf",
      title: "中山大学海洋科学", subTitle: "深造率 80%+",
      desc: "本科直接就业难度极高，绝大多数选择读研。",
      items: [ { k: "信号", v: "慎选本科就业" } ]
    },
    { id: "zju", label: "浙海大", x: 0.18, y: 0.90, shape: "circle", size: 7, type: "leaf",
      title: "浙江海洋大学", subTitle: "各学院 19%–49%",
      desc: "不同学院深造率差异大，信息工程学院最低。",
      items: [ { k: "对照", v: "信息工程 19.89%" } ]
    },

    // 薪资子节点
    { id: "elec", label: "电子信息", x: 0.92, y: 0.14, shape: "square", size: 7, type: "leaf",
      title: "电子信息工程", subTitle: "应届 15.6K",
      desc: "转行方向中薪资最高，但竞争也最激烈。",
      items: [ { k: "差距", v: "比海洋技术高 24%" } ]
    },
    { id: "ocean-tech", label: "海洋技术", x: 0.94, y: 0.38, shape: "square", size: 7, type: "leaf",
      title: "海洋技术", subTitle: "应届 12.5K",
      desc: "海洋专业中薪资最高，但岗位量有限。",
      items: [ { k: "2026 岗位量", v: "156,968 个" } ]
    },
    { id: "admin", label: "行政管理", x: 0.90, y: 0.56, shape: "square", size: 7, type: "leaf",
      title: "行政管理", subTitle: "应届 5.3K",
      desc: "常见转行兜底方向，门槛低但起薪也低。",
      items: [ { k: "特点", v: "稳定 / 门槛低" } ]
    },

    // 路径子节点
    { id: "ic", label: "IC / 半导体", x: 0.92, y: 0.86, shape: "hex", size: 7, type: "leaf",
      title: "IC / 半导体", subTitle: "水声工程对口",
      desc: "水声工程信号处理背景与芯片设计、音频算法高度匹配。",
      items: [ { k: "代表企业", v: "华为 / 小米 / 紫光展锐" } ]
    },
    { id: "law", label: "法学", x: 0.76, y: 0.92, shape: "hex", size: 7, type: "leaf",
      title: "法学", subTitle: "海洋政策 / 海商法",
      desc: "海洋政策、海商法、海事仲裁是小众但高壁垒方向。",
      items: [ { k: "优势", v: "复合背景稀缺" } ]
    }
  ];

  var links = [
    ["root", "industry"], ["root", "further"], ["root", "salary"], ["root", "path"],
    ["industry", "manu"], ["industry", "it"], ["industry", "sci"],
    ["further", "sysu"], ["further", "zju"],
    ["salary", "elec"], ["salary", "ocean-tech"], ["salary", "admin"],
    ["path", "ic"], ["path", "law"]
  ];

  nodes.forEach(function (n) { nodeMap[n.id] = n; });

  function getBox() {
    return svg.getBoundingClientRect();
  }

  function x(n) {
    var b = getBox();
    return n.x * b.width;
  }

  function y(n) {
    var b = getBox();
    return n.y * b.height;
  }

  function createShape(n) {
    var size = n.size;
    var s;
    // 2026-08-23：四大节点用 2D 鱼图替换几何形状（Wikimedia CC 图，已抠背景）
    var fishMap = {
      "root": "/static/img/whale.png",        // 海洋专业（中心）：鲸鱼（华丽）
      "further": "/static/img/lionfish.png",    // 深造方向：狮子鱼（深海）
      "industry": "/static/img/salmon.png",      // 行业去向：大马哈鱼（导航）
      "salary": "/static/img/tuna.png",          // 薪资对比：金枪鱼（财源）
      "path": "/static/img/sunfish.png"          // 转行路径：翻车鱼（长寿）
    };
    if (fishMap[n.id]) {
      s = document.createElementNS(ns, "image");
      s.setAttribute("href", fishMap[n.id]);
      // root 更大（size*4.5），其他 size*3.5
      var fishScale = (n.type === "root") ? 4.5 : 3.5;
      s.setAttribute("x", -size * (fishScale / 2));
      s.setAttribute("y", -size * (fishScale / 2));
      s.setAttribute("width", size * fishScale);
      s.setAttribute("height", size * fishScale);
      s.setAttribute("preserveAspectRatio", "xMidYMid meet");
      s.setAttribute("class", "tm-fish");
      return s;
    }
    // 2026-08-23：副节点用 Lucide 图标（有设计感，贴合语义）——内联 SVG path
    var lucideMap = {
      "root": "sailboat",      // 海洋专业（中心）：帆船（最华丽）
      "manu": "cog",           // 制造业：齿轮
      "it": "code-xml",        // 信息/软件：代码
      "sci": "flask-conical",  // 科研/技术：烧瓶
      "sysu": "graduation-cap",// 中山大学：学士帽
      "zju": "graduation-cap", // 浙海大：学士帽
      "elec": "cpu",           // 电子信息：芯片
      "ocean-tech": "waves",   // 海洋技术：波浪
      "admin": "landmark",     // 行政管理：建筑
      "ic": "circuit-board",   // IC/半导体：电路板
      "law": "scale"           // 法学：天平
    };
    if (lucideMap[n.id]) {
      // Lucide 图标 SVG 元素（path/circle/rect），24x24 viewBox
      var lucideSvg = {
        "sailboat": '<path d="M10 2v15"/><path d="M7 22a4 4 0 0 1-4-4 1 1 0 0 1 1-1h16a1 1 0 0 1 1 1 4 4 0 0 1-4 4z"/><path d="M9.159 2.46a1 1 0 0 1 1.521-.193l9.977 8.98A1 1 0 0 1 20 13H4a1 1 0 0 1-.824-1.567z"/>',
        "cog": '<path d="M11 10.27 7 3.34"/><path d="m11 13.73-4 6.93"/><path d="M12 22v-2"/><path d="M12 2v2"/><path d="M14 12h8"/><path d="m17 20.66-1-1.73"/><path d="m17 3.34-1 1.73"/><path d="M2 12h2"/><path d="m20.66 17-1.73-1"/><path d="m20.66 7-1.73 1"/><path d="m3.34 17 1.73-1"/><path d="m3.34 7 1.73 1"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="8"/>',
        "code-xml": '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
        "flask-conical": '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
        "graduation-cap": '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
        "cpu": '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/><path d="M12 20v2"/><path d="M12 2v2"/><path d="M17 20v2"/><path d="M17 2v2"/><path d="M2 12h2"/><path d="M2 17h2"/><path d="M2 7h2"/><path d="M20 12h2"/><path d="M20 17h2"/><path d="M20 7h2"/><path d="M7 20v2"/><path d="M7 2v2"/>',
        "waves": '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
        "landmark": '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
        "circuit-board": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M11 9h4a2 2 0 0 0 2-2V3"/><circle cx="9" cy="9" r="2"/><path d="M7 21v-4a2 2 0 0 1 2-2h4"/><circle cx="15" cy="15" r="2"/>',
        "scale": '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>'
      };
      var iconSvg = lucideSvg[lucideMap[n.id]];
      if (iconSvg) {
        // 用 <g> 包裹 Lucide 图标元素（24x24 viewBox，缩放到节点大小）
        var g = document.createElementNS(ns, "g");
        g.setAttribute("class", "tm-lucide");
        // 解析内联 SVG 元素（path/circle/rect）加到 g
        var parser = new DOMParser();
        var doc = parser.parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + iconSvg + '</svg>', "image/svg+xml");
        var children = doc.documentElement.childNodes;
        for (var ci = 0; ci < children.length; ci++) {
          var el = children[ci];
          if (el.nodeType === 1) {
            g.appendChild(document.importNode(el, true));
          }
        }
        // 缩放到节点大小（24x24 viewBox → size*3，放大图标）+ 平移中心到原点（居中）
        var sc = (size * 3) / 24;
        g.setAttribute("transform", "translate(" + (-12 * sc) + "," + (-12 * sc) + ") scale(" + sc + ")");
        return g;
      }
    }
    if (n.shape === "circle") {
      s = document.createElementNS(ns, "circle");
      s.setAttribute("r", size);
    } else if (n.shape === "square") {
      s = document.createElementNS(ns, "rect");
      s.setAttribute("x", -size);
      s.setAttribute("y", -size);
      s.setAttribute("width", size * 2);
      s.setAttribute("height", size * 2);
      s.setAttribute("rx", 1.5);
    } else if (n.shape === "triangle") {
      s = document.createElementNS(ns, "polygon");
      var h = size * 1.2;
      s.setAttribute("points", "0," + (-h) + " " + size + "," + (h * 0.6) + " " + (-size) + "," + (h * 0.6));
    } else if (n.shape === "hex") {
      s = document.createElementNS(ns, "polygon");
      var pts = [];
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push((size * Math.cos(a)).toFixed(1) + "," + (size * Math.sin(a)).toFixed(1));
      }
      s.setAttribute("points", pts.join(" "));
    } else {
      s = document.createElementNS(ns, "circle");
      s.setAttribute("r", size);
    }
    s.setAttribute("class", "tm-shape");
    return s;
  }

  function render() {
    var b = getBox();
    svg.setAttribute("viewBox", "0 0 " + b.width + " " + b.height);
    svg.innerHTML = "";

    // 连线（先画线，节点在上层）
    links.forEach(function (pair, idx) {
      var a = nodeMap[pair[0]], c = nodeMap[pair[1]];
      if (!a || !c) return;
      var line = document.createElementNS(ns, "line");
      line.setAttribute("x1", x(a));
      line.setAttribute("y1", y(a));
      line.setAttribute("x2", x(c));
      line.setAttribute("y2", y(c));
      line.setAttribute("class", "tm-link");
      line.setAttribute("data-from", pair[0]);
      line.setAttribute("data-to", pair[1]);
      line.style.animationDelay = (idx * 40) + "ms";
      svg.appendChild(line);
    });

    // 节点（带延迟入场）
    nodes.forEach(function (n, idx) {
      var g = document.createElementNS(ns, "g");
      g.setAttribute("class", "tm-node");
      g.setAttribute("data-id", n.id);
      g.setAttribute("data-type", n.type);
      g.setAttribute("data-state", "idle");
      g.setAttribute("transform", "translate(" + x(n) + "," + y(n) + ")");
      g.setAttribute("data-base-x", x(n));   // 2026-08-23：保存基础位置（视差用）
      g.setAttribute("data-base-y", y(n));
      g.setAttribute("data-depth", n.type === "root" ? 0.3 : (n.type === "branch" ? 0.6 : 1));   // 视差深度：root 动得少，leaf 动得多
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", n.label);
      g.style.animationDelay = (idx * 60) + "ms";

      // 2026-08-23：透明点击区（扩大点击区域，副节点图标小，点击区大才好点中）
      var hit = document.createElementNS(ns, "circle");
      hit.setAttribute("r", Math.max(n.size * 3, 16));
      hit.setAttribute("fill", "transparent");
      hit.setAttribute("stroke", "none");
      hit.setAttribute("class", "tm-hit");
      g.appendChild(hit);

      g.appendChild(createShape(n));

      var label = document.createElementNS(ns, "text");
      label.setAttribute("class", "tm-label");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dy", n.size + 20);   // 2026-08-23：字下移（图标放大后不叠）
      label.textContent = n.label;
      g.appendChild(label);

      if (n.sub) {
        var sub = document.createElementNS(ns, "text");
        sub.setAttribute("class", "tm-label");
        sub.setAttribute("text-anchor", "middle");
        sub.setAttribute("dy", n.size + 33);   // 2026-08-23：副标题下移
        sub.setAttribute("opacity", "0.45");
        sub.textContent = n.sub;
        g.appendChild(sub);
      }

      svg.appendChild(g);
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderDetail(n) {
    if (!n) {
      detailBox.innerHTML =
        '<div class="tm-detail-empty">' +
        '<div class="tm-empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9c2.2 0 2.2-3 4.4-3s2.2 3 4.4 3 2.2-3 4.4-3 2.2 3 4.4 3"/><path d="M2 15c2.2 0 2.2-3 4.4-3s2.2 3 4.4 3 2.2-3 4.4-3 2.2 3 4.4 3"/></svg></div>' +
        '<p>点击节点，查看这条出路的具体数据。</p>' +
        '</div>';
      return;
    }

    var itemsHtml = "";
    if (n.items && n.items.length) {
      itemsHtml = '<div class="tm-detail-list">' + n.items.map(function (it) {
        return '<div class="tm-detail-item"><span class="k">' + esc(it.k) + '</span><span class="v">' + esc(it.v) + '</span></div>';
      }).join("") + '</div>';
    }

    var linkHtml = "";
    if (n.link) {
      var isExternal = /^https?:\/\//.test(n.link);
      linkHtml = '<a class="tm-detail-link" href="' + esc(n.link) + '"' +
        (isExternal ? ' target="_blank" rel="noopener"' : '') + '>查看详情 →</a>';
    }

    detailBox.innerHTML =
      '<div class="tm-detail-title">' + esc(n.title || n.label) + '</div>' +
      (n.subTitle ? '<div class="tm-detail-sub">' + esc(n.subTitle) + '</div>' : '') +
      (n.desc ? '<div class="tm-detail-desc">' + esc(n.desc) + '</div>' : '') +
      itemsHtml + linkHtml;
  }

  function activate(id) {
    var n = nodeMap[id];
    if (!n) return;

    document.querySelectorAll(".tm-node").forEach(function (g) {
      var nid = g.getAttribute("data-id");
      if (nid === id) g.setAttribute("data-state", "active");
      else if (nid === "root") g.setAttribute("data-state", "idle");
      else g.setAttribute("data-state", "muted");
    });

    document.querySelectorAll(".tm-link").forEach(function (l) {
      var from = l.getAttribute("data-from");
      var to = l.getAttribute("data-to");
      if (from === id || to === id) l.removeAttribute("data-state");
      else l.setAttribute("data-state", "muted");
    });

    renderDetail(n);
  }

  // ---------- 事件 ----------
  document.addEventListener("click", function (e) {
    var g = e.target.closest(".tm-node");
    if (g) activate(g.getAttribute("data-id"));
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var g = e.target.closest(".tm-node");
    if (g) {
      e.preventDefault();
      activate(g.getAttribute("data-id"));
    }
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 120);
  });

  // ---------- 初始化 ----------
  render();
  renderDetail(null);
  activate("root");

  // 2026-08-23：鼠标视差——鼠标在 SVG 上移动时，节点按深度轻微偏移（有层次动感，不破坏点击）
  var svgBox = document.querySelector(".transfer-map-svg-box");
  if (svgBox && window.matchMedia && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var nodesList = document.querySelectorAll(".tm-node");
    var linksList = document.querySelectorAll(".tm-link");
    // 计算某节点的视差偏移（返回 [px, py]）
    function nodeOffset(g, nx, ny) {
      var depth = parseFloat(g.getAttribute("data-depth") || "1");
      return [-nx * 28 * depth, -ny * 28 * depth];
    }
    svgBox.addEventListener("mousemove", function (e) {
      var rect = svgBox.getBoundingClientRect();
      // 鼠标相对 SVG 中心的归一化位置（-0.5 到 0.5）
      var nx = (e.clientX - rect.left) / rect.width - 0.5;
      var ny = (e.clientY - rect.top) / rect.height - 0.5;
      var nodeById = {};
      nodesList.forEach(function (g) {
        var depth = parseFloat(g.getAttribute("data-depth") || "1");
        var bx = parseFloat(g.getAttribute("data-base-x"));
        var by = parseFloat(g.getAttribute("data-base-y"));
        var px = -nx * 28 * depth;
        var py = -ny * 28 * depth;
        g.setAttribute("transform", "translate(" + (bx + px) + "," + (by + py) + ")");
        nodeById[g.getAttribute("data-id")] = { bx: bx, by: by, px: px, py: py };
      });
      // 2026-08-23：连线也跟随节点（端点 = 节点基础位置 + 视差偏移），避免节点和线断连
      linksList.forEach(function (l) {
        var from = l.getAttribute("data-from");
        var to = l.getAttribute("data-to");
        var fa = nodeById[from], ta = nodeById[to];
        if (!fa || !ta) return;
        l.setAttribute("x1", fa.bx + fa.px);
        l.setAttribute("y1", fa.by + fa.py);
        l.setAttribute("x2", ta.bx + ta.px);
        l.setAttribute("y2", ta.by + ta.py);
      });
    });
    svgBox.addEventListener("mouseleave", function () {
      nodesList.forEach(function (g) {
        var bx = parseFloat(g.getAttribute("data-base-x"));
        var by = parseFloat(g.getAttribute("data-base-y"));
        g.setAttribute("transform", "translate(" + bx + "," + by + ")");
      });
      // 连线恢复初始位置（用节点基础位置）
      linksList.forEach(function (l) {
        var from = l.getAttribute("data-from");
        var to = l.getAttribute("data-to");
        var fa = nodeMap[from], ta = nodeMap[to];
        if (!fa || !ta) return;
        l.setAttribute("x1", x(fa));
        l.setAttribute("y1", y(fa));
        l.setAttribute("x2", x(ta));
        l.setAttribute("y2", y(ta));
      });
    });
  }
})();
