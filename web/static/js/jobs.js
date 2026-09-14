// 岗位库：多重标签筛选（专业 × 类型 × 学历 × 地区，像 Excel 列筛选）
(function () {
  var state = { majors: [], unit_types: [], educations: [], regions: [], deadline_filter: "all", salary_filter: "all", sort: "latest", q: "", page: 1 };
  var PAGE_SIZE = 15;
  var totalJobs = 0;
  var DIMS = [
    { key: "majors", el: "tags-majors" },
    { key: "unit_types", el: "tags-unit_types" },
    { key: "educations", el: "tags-educations" },
    { key: "regions", el: "tags-regions" },
  ];
  var LABELS = { majors: "专业方向", unit_types: "单位类型", educations: "学历", regions: "地区" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function loadFilters() {
    fetch("/api/job_filters")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) return;
        DIMS.forEach(function (dim) {
          if (dim.key === "regions" || dim.key === "majors") return; // 地区走 cascader，专业走分组下拉
          var opts = d[dim.key] || [];
          var box = document.getElementById(dim.el);
          box.innerHTML = opts.map(function (opt) {
            return '<span class="tag" data-dim="' + dim.key + '" data-val="' + esc(opt) + '">' + esc(opt) + "</span>";
          }).join("");
        });
      });
    initCascader();
    initMajorGrouped();
  }

  // ===== 专业方向分组下拉 =====
  var MAJOR_GROUPS = [
    { name: "海洋科学", tags: ["物理海洋学", "海洋化学", "海洋生物学", "海洋地质", "海洋气象学", "海洋生态学", "海洋探测技术"] },
    { name: "船舶与海工", tags: ["船舶与海洋结构物设计制造", "轮机工程", "水声工程", "船舶与海洋工程"] },
    { name: "港航与航海", tags: ["港口、海岸及近海工程", "港口航道与海岸工程", "航海技术", "海洋测绘", "海洋技术", "海洋资源与环境", "海洋渔业科学与技术"] },
    { name: "职能类", tags: ["财务与经管", "人力资源", "市场营销", "计算机与软件", "法学", "物流与航运", "外语", "机械与电气", "材料与化工", "生物与食品", "土木与建筑"] },
  ];

  function initMajorGrouped() {
    var box = document.getElementById("majorGroups");
    box.innerHTML = MAJOR_GROUPS.map(function (g) {
      return '<div class="major-group">' +
        '<div class="major-group-name">' + esc(g.name) + "</div>" +
        '<div class="major-group-tags">' +
        g.tags.map(function (t) {
          return '<span class="major-tag" data-val="' + esc(t) + '">' + esc(t) + "</span>";
        }).join("") +
        "</div></div>";
    }).join("");

    var panel = document.getElementById("majorPanel");
    document.getElementById("majorInput").addEventListener("click", function (e) {
      e.stopPropagation();
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#majorCascader")) panel.style.display = "none";
    });
    box.addEventListener("click", function (e) {
      var t = e.target.closest(".major-tag");
      if (!t) return;
      toggleMajor(t.dataset.val);
    });
  }

  function toggleMajor(val) {
    var arr = state.majors;
    var i = arr.indexOf(val);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(val);
    document.querySelectorAll('.major-tag[data-val="' + val + '"]').forEach(function (t) {
      t.classList.toggle("active", arr.indexOf(val) >= 0);
    });
    renderMajorTags();
    updateSummary();
    resetPage();
    loadJobs();
  }

  function renderMajorTags() {
    document.getElementById("tags-majors").innerHTML = state.majors.map(function (m) {
      return '<span class="tag active" data-dim="majors" data-val="' + esc(m) + '">' + esc(m) + "</span>";
    }).join("");
  }

  // ===== 地区省市区三级级联选择器 =====
  var PCAS = null; // pcas.json 数据
  var cascaderSel = { province: "", city: "", district: "" };

  function shortName(full) {
    return String(full)
      .replace(/维吾尔自治区$/, "").replace(/壮族自治区$/, "").replace(/回族自治区$/, "")
      .replace(/自治区$/, "").replace(/特别行政区$/, "").replace(/省$/, "").replace(/市$/, "");
  }

  function initCascader() {
    fetch("/static/data/pcas.json")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        PCAS = d;
        renderProvince();
        bindCascader();
      })
      .catch(function () {
        // 数据加载失败，退化成后端动态枚举
        fetch("/api/job_filters").then(function (r) { return r.json(); }).then(function (d) {
          if (d.ok && d.regions) {
            document.getElementById("tags-regions").innerHTML = d.regions.map(function (opt) {
              return '<span class="tag" data-dim="regions" data-val="' + esc(opt) + '">' + esc(opt) + "</span>";
            }).join("");
          }
        });
      });
  }

  function renderProvince() {
    var box = document.getElementById("cascader-province");
    box.innerHTML = Object.keys(PCAS).map(function (p) {
      return '<div class="cascader-item" data-level="province" data-val="' + esc(p) + '">' + esc(p) + "</div>";
    }).join("");
    document.getElementById("cascader-city").innerHTML = "";
    document.getElementById("cascader-district").innerHTML = "";
  }

  function renderCity(province) {
    var box = document.getElementById("cascader-city");
    var cities = PCAS[province] || {};
    box.innerHTML = Object.keys(cities).map(function (c) {
      return '<div class="cascader-item" data-level="city" data-val="' + esc(c) + '">' + esc(c) + "</div>";
    }).join("");
    document.getElementById("cascader-district").innerHTML = "";
  }

  function renderDistrict(province, city) {
    var box = document.getElementById("cascader-district");
    var districts = (PCAS[province] || {})[city] || {};
    var names = typeof districts === "object" ? Object.keys(districts) : [];
    box.innerHTML = names.map(function (ds) {
      return '<div class="cascader-item" data-level="district" data-val="' + esc(ds) + '">' + esc(ds) + "</div>";
    }).join("");
  }

  var ZHIXIA = { "北京": 1, "上海": 1, "天津": 1, "重庆": 1 };

  function applyRegion() {
    var prov = shortName(cascaderSel.province);
    var region = prov;
    // 直辖市：region 就是简称，忽略"市辖区"这类虚拟层级
    if (!ZHIXIA[prov]) {
      if (cascaderSel.city) region += "-" + shortName(cascaderSel.city);
      // 区级只做展示反馈，不参与筛选（岗位数据暂无区级）
    }
    if (region) {
      var provShort = prov;
      state.regions = state.regions.filter(function (r) {
        return r !== provShort && r.indexOf(provShort + "-") !== 0;
      });
      state.regions.push(region);
      renderRegionTags();
      updateSummary();
      resetPage();
      loadJobs();
    }
    // 输入框显示完整选中路径（含区，作为点区反馈）
    var display = cascaderSel.province;
    if (cascaderSel.city && !(ZHIXIA[prov] && cascaderSel.city === "市辖区")) display += " / " + cascaderSel.city;
    if (cascaderSel.district) display += " / " + cascaderSel.district;
    document.getElementById("regionInput").innerHTML =
      display + ' <span class="cascader-arrow">▾</span>';
  }

  function renderRegionTags() {
    document.getElementById("tags-regions").innerHTML = state.regions.map(function (r) {
      return '<span class="tag active" data-dim="regions" data-val="' + esc(r) + '">' + esc(r) + "</span>";
    }).join("");
  }

  function bindCascader() {
    var panel = document.getElementById("regionPanel");
    var input = document.getElementById("regionInput");
    input.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.style.display = panel.style.display === "none" ? "flex" : "none";
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".cascader")) panel.style.display = "none";
    });
    document.getElementById("cascader-province").addEventListener("click", function (e) {
      var it = e.target.closest(".cascader-item");
      if (!it) return;
      cascaderSel = { province: it.dataset.val, city: "", district: "" };
      renderCity(it.dataset.val);
      applyRegion();
    });
    document.getElementById("cascader-city").addEventListener("click", function (e) {
      var it = e.target.closest(".cascader-item");
      if (!it) return;
      cascaderSel.city = it.dataset.val;
      cascaderSel.district = "";
      renderDistrict(cascaderSel.province, it.dataset.val);
      applyRegion();
    });
    document.getElementById("cascader-district").addEventListener("click", function (e) {
      var it = e.target.closest(".cascader-item");
      if (!it) return;
      cascaderSel.district = it.dataset.val;
      applyRegion();
    });
  }

  function currentQuery() {
    var q = new URLSearchParams();
    if (state.majors.length) q.set("majors", state.majors.join(","));
    if (state.unit_types.length) q.set("unit_types", state.unit_types.join(","));
    if (state.educations.length) q.set("educations", state.educations.join(","));
    if (state.regions.length) q.set("regions", state.regions.join(","));
    if (state.deadline_filter !== "all") q.set("deadline_filter", state.deadline_filter);
  if (state.salary_filter !== "all") q.set("salary_filter", state.salary_filter);
    if (state.sort !== "latest") q.set("sort", state.sort);
    if (state.q) q.set("q", state.q);
    q.set("limit", PAGE_SIZE);
    q.set("offset", (state.page - 1) * PAGE_SIZE);
    return q.toString();
  }

  function loadJobs() {
    fetch("/api/jobs?" + currentQuery())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var list = document.getElementById("jobList");
        var count = document.getElementById("resultCount");
        var empty = document.getElementById("empty");
        totalJobs = d.total || 0;
        if (!d.items || !d.items.length) {
          list.innerHTML = "";
          count.textContent = "";
          empty.style.display = "block";
          renderPager();
          return;
        }
        empty.style.display = "none";
        count.textContent = "共 " + totalJobs + " 个岗位";
        list.innerHTML = d.items.map(cardHtml).join("");
        renderPager();
        // 回到顶部
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
  }

  function renderPager() {
    var pager = document.getElementById("pager");
    if (!pager) return;
    var totalPages = Math.max(1, Math.ceil(totalJobs / PAGE_SIZE));
    pager.innerHTML =
      '<button class="page-btn" id="prevPage"' + (state.page <= 1 ? " disabled" : "") + ">上一页</button>" +
      '<span class="page-info">第 <b>' + state.page + "</b> / " + totalPages + " 页</span>" +
      '<button class="page-btn" id="nextPage"' + (state.page >= totalPages ? " disabled" : "") + ">下一页</button>";
  }

  function resetPage() {
    state.page = 1;
  }

  function cardHtml(j) {
    var majors = (j.major || "").split(",").filter(Boolean).map(function (m) {
      return '<span class="badge major">' + esc(m) + "</span>";
    }).join(" ");
    var meta = [];
    if (j.education) meta.push("学历 " + esc(j.education));
    if (j.region) meta.push(esc(j.region));
    if (j.headcount) meta.push("招 " + esc(j.headcount));
    return (
      '<article class="job-card">' +
      '<div class="job-top">' +
      '<span class="job-title"><a href="/job/' + j.id + '">' + esc(j.title) + "</a></span>" +
      (j.unit_type ? '<span class="badge">' + esc(j.unit_type) + "</span>" : "") +
      "</div>" +
      '<div class="job-unit">' + esc(j.unit) + "</div>" +
      '<div class="job-top">' + majors + "</div>" +
      '<div class="job-meta">' +
      (j.salary ? '<span class="salary">' + esc(j.salary) + "</span>" : "") +
      (j.deadline ? '<span class="deadline">截止 ' + esc(j.deadline) + "</span>" :
        (j.deadline_note ? '<span class="deadline-note">截止 ' + esc(j.deadline_note) + "</span>" :
          '<span class="deadline-unknown">截止日期未注明</span>')) +
      meta.map(function (m) { return "<span>" + m + "</span>"; }).join("") +
      "</div>" +
      (j.description ? '<div class="job-desc">' + esc(j.description) + "</div>" : "") +
      "</article>"
    );
  }

  function updateSummary() {
    var parts = [];
    DIMS.forEach(function (dim) {
      if (state[dim.key].length) {
        parts.push(LABELS[dim.key] + "：" + state[dim.key].join(" / "));
      }
    });
    document.getElementById("activeSummary").textContent =
      parts.length ? "已选：" + parts.join("　") : "已选：无";
  }

  function toggle(dim, val) {
    var arr = state[dim];
    var i = arr.indexOf(val);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(val);
    // 更新标签高亮
    document.querySelectorAll('.tag[data-dim="' + dim + '"]').forEach(function (t) {
      t.classList.toggle("active", arr.indexOf(t.dataset.val) >= 0);
    });
    updateSummary();
    resetPage();
    loadJobs();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest(".tag");
    if (t && t.dataset.dim) toggle(t.dataset.dim, t.dataset.val);
  });

  document.getElementById("clearAll").addEventListener("click", function () {
    DIMS.forEach(function (dim) { state[dim.key] = []; });
    state.deadline_filter = "all";
    state.salary_filter = "all";
    document.querySelectorAll(".tag").forEach(function (t) { t.classList.remove("active"); });
    document.querySelectorAll("#tags-deadlines .tag, #tags-salary .tag").forEach(function (t) {
      t.classList.add("active");
    });
    updateSummary();
    resetPage();
    loadJobs();
  });

  document.getElementById("sortOptions").addEventListener("click", function (e) {
    var btn = e.target.closest(".sort-btn");
    if (!btn) return;
    state.sort = btn.dataset.sort;
    document.querySelectorAll(".sort-btn").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    resetPage();
    loadJobs();
  });

  // 岗位搜索（防抖 300ms）
  var searchInput = document.getElementById("jobSearch");
  var searchTimer = null;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.q = searchInput.value.trim();
      resetPage();
      loadJobs();
    }, 300);
  });

  // 分页
  document.addEventListener("click", function (e) {
    if (e.target.id === "prevPage") { state.page--; loadJobs(); }
    if (e.target.id === "nextPage") { state.page++; loadJobs(); }
  });

  // ===== 截止日期单选筛选 =====
  var dlBox = document.getElementById("tags-deadlines");
  if (dlBox) {
    dlBox.addEventListener("click", function (e) {
      var t = e.target.closest(".tag");
      if (!t || !t.dataset.dl) return;
      state.deadline_filter = t.dataset.dl;
      dlBox.querySelectorAll(".tag").forEach(function (x) {
        x.classList.toggle("active", x.dataset.dl === state.deadline_filter);
      });
      updateSummary();
      resetPage();
      loadJobs();
    });
  }

  // ===== 薪资筛选（全部 / 有薪资） =====
  var salaryBox = document.getElementById("tags-salary");
  if (salaryBox) {
    salaryBox.addEventListener("click", function (e) {
      var t = e.target.closest(".tag");
      if (!t || !t.dataset.salary) return;
      state.salary_filter = t.dataset.salary;
      salaryBox.querySelectorAll(".tag").forEach(function (x) {
        x.classList.toggle("active", x.dataset.salary === state.salary_filter);
      });
      updateSummary();
      resetPage();
      loadJobs();
    });
  }

  loadFilters();
  loadJobs();

  // 筛选折叠（移动端默认收起）
  var filterToggle = document.getElementById("filterToggle");
  var filtersBox = document.getElementById("filtersBox");
  if (filterToggle && filtersBox) {
    if (window.innerWidth <= 720) {
      filtersBox.classList.add("collapsed");
    }
    filterToggle.addEventListener("click", function () {
      filtersBox.classList.toggle("collapsed");
      filterToggle.classList.toggle("open");
    });
  }
})();
