// 海域图鉴：种子海域点 + 用户作品点（任意地点发帖）+ 评论
(function () {
  var TYPE_EN = { "近海": "jinshai", "远海": "yuanhai", "深海": "shenhai", "极地": "jidi" };

  var map = L.map("map", {
    center: [26, 120],
    zoom: 5,
    minZoom: 3,
    maxZoom: 14,
    zoomControl: true,
    attributionControl: false,
    // 全局锁死经度 -180~180（西东半球）：SST/叶绿素/经纬线都按 -180~180 做，锁死对齐不跨半球错位
    maxBounds: L.latLngBounds([-90, -180], [90, 180]),
  });
  window._map = map;  // 调试：暴露 map（地图初始化后立即暴露）

  // 经纬线图层（每 10° 画经纬线，用户可开关）
  var graticuleLayer = L.layerGroup();
  function buildGraticule() {
    graticuleLayer.clearLayers();
    var style = { color: "#0A5A7A", weight: 0.7, opacity: 0.5, interactive: false };
    // 经线（每 10°，-180 到 180）
    for (var lon = -180; lon <= 180; lon += 10) {
      var latPts = [];
      for (var lat = -90; lat <= 90; lat += 2) latPts.push([lat, lon]);
      graticuleLayer.addLayer(L.polyline(latPts, style));
    }
    // 纬线（每 10°，-80 到 80，避开极点）
    for (var lat2 = -80; lat2 <= 80; lat2 += 10) {
      var lonPts = [];
      for (var lon2 = -180; lon2 <= 180; lon2 += 2) lonPts.push([lat2, lon2]);
      graticuleLayer.addLayer(L.polyline(lonPts, style));
    }
  }
  buildGraticule();
  // 四边经纬度刻度（数字跟随屏幕上下左右四边，随视口更新）
  var edgeScale = null;
  function updateEdgeScale() {
    if (!edgeScale) return;
    var bounds = map.getBounds();
    var w = map.getSize().x, h = map.getSize().y;
    var pad = 4;
    function fmtDeg(val, isLon) {
      var v = Math.abs(val);
      var dir = isLon ? (val >= 0 ? "E" : "W") : (val >= 0 ? "N" : "S");
      return v + "°" + dir;
    }
    // 经度刻度（上下边）
    var topHtml = "", bottomHtml = "";
    for (var lon = Math.floor(bounds.getWest() / 10) * 10; lon <= bounds.getEast(); lon += 10) {
      var px = map.latLngToContainerPoint([bounds.getNorth(), lon]).x;
      if (px >= 0 && px <= w) {
        var label = fmtDeg(lon, true);
        topHtml += '<span class="edge-label" style="left:' + px + 'px">' + label + '</span>';
        bottomHtml += '<span class="edge-label" style="left:' + px + 'px">' + label + '</span>';
      }
    }
    // 纬度刻度（左右边）
    var leftHtml = "", rightHtml = "";
    for (var lat = Math.floor(bounds.getSouth() / 10) * 10; lat <= bounds.getNorth(); lat += 10) {
      var py = map.latLngToContainerPoint([lat, bounds.getWest()]).y;
      if (py >= 0 && py <= h) {
        var label2 = fmtDeg(lat, false);
        leftHtml += '<span class="edge-label" style="top:' + py + 'px">' + label2 + '</span>';
        rightHtml += '<span class="edge-label" style="top:' + py + 'px">' + label2 + '</span>';
      }
    }
    edgeScale.querySelector(".edge-top").innerHTML = topHtml;
    edgeScale.querySelector(".edge-bottom").innerHTML = bottomHtml;
    edgeScale.querySelector(".edge-left").innerHTML = leftHtml;
    edgeScale.querySelector(".edge-right").innerHTML = rightHtml;
  }
  var graticuleOn = false;
  var graticuleBtn = document.getElementById("graticuleBtn");
  if (graticuleBtn) {
    graticuleBtn.addEventListener("click", function () {
      graticuleOn = !graticuleOn;
      if (graticuleOn) {
        graticuleLayer.addTo(map);
        // 创建四边刻度层
        if (!edgeScale) {
          edgeScale = document.createElement("div");
          edgeScale.className = "edge-scale hidden";
          edgeScale.innerHTML = '<div class="edge-top"></div><div class="edge-bottom"></div><div class="edge-left"></div><div class="edge-right"></div>';
          document.querySelector(".ocean-layout").appendChild(edgeScale);
        }
        edgeScale.classList.remove("hidden");
        updateEdgeScale();
        map.on("moveend zoomend", updateEdgeScale);
        graticuleBtn.classList.add("active");
      } else {
        map.removeLayer(graticuleLayer);
        if (edgeScale) { edgeScale.classList.add("hidden"); map.off("moveend zoomend", updateEdgeScale); }
        graticuleBtn.classList.remove("active");
      }
    });
  }

  // 高德干净底图（ltype=3 无城市红圈/无城市名，保留海岸线国界），海域名由本喵加标签
  var baseLayer = L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&scl=1&ltype=3&x={x}&y={y}&z={z}", {
    subdomains: "1234",
    maxZoom: 18,
    referrerPolicy: "no-referrer",
  }).addTo(map);

  // 底图切换（高德，国内源合规）：标准带地名 / 卫星图 / 干净无地名，循环切换
  var basemapBtn = document.getElementById("basemapBtn");
  var basemapMenu = document.getElementById("basemapMenu");
  var basemaps = [
    { name: "标准", url: "https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}", sub: "1234" },
    { name: "卫星", url: "https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}", sub: "1234" },
    { name: "干净", url: "https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&scl=1&ltype=3&x={x}&y={y}&z={z}", sub: "1234" },
  ];
  var basemapIdx = 2;  // 默认干净（当前用的）
  function setBasemap(idx) {
    basemapIdx = idx;
    var bm = basemaps[basemapIdx];
    // 移除旧底图，换新底图
    map.removeLayer(baseLayer);
    baseLayer = L.tileLayer(bm.url, { subdomains: bm.sub, maxZoom: 18, referrerPolicy: "no-referrer" }).addTo(map);
    baseLayer.bringToBack();
    basemapBtn.textContent = "底图·" + bm.name;
    // 高亮当前选项
    basemapMenu.querySelectorAll(".basemap-option").forEach(function (opt) {
      opt.classList.toggle("active", parseInt(opt.getAttribute("data-idx"), 10) === idx);
    });
  }
  if (basemapBtn && basemapMenu) {
    basemapBtn.textContent = "底图·" + basemaps[basemapIdx].name;
    // 点按钮切换菜单显示/隐藏
    basemapBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      basemapMenu.classList.toggle("hidden");
    });
    // 点选项切换底图
    basemapMenu.querySelectorAll(".basemap-option").forEach(function (opt) {
      opt.addEventListener("click", function (e) {
        e.stopPropagation();
        setBasemap(parseInt(opt.getAttribute("data-idx"), 10));
        basemapMenu.classList.add("hidden");
      });
    });
    // 点其他地方关闭菜单
    document.addEventListener("click", function () { basemapMenu.classList.add("hidden"); });
  }

  // 海域名标签（自绘，海域图鉴的核心标注）
  var seaLabels = [
    { name: "渤海", lat: 38.7, lng: 120.0 },
    { name: "黄海", lat: 35.5, lng: 123.5 },
    { name: "东海", lat: 28.5, lng: 125.0 },
    { name: "南海", lat: 15.5, lng: 113.0 },
  ];
  seaLabels.forEach(function (s) {
    L.marker([s.lat, s.lng], {
      icon: L.divIcon({ className: "", html: '<span class="sea-label">' + s.name + '</span>', iconSize: [60, 20], iconAnchor: [30, 10] }),
      interactive: false,
    }).addTo(map);
  });

  var detail = document.getElementById("detail");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function seedIcon(type) {
    var color = { "近海": "#2FD4DA", "远海": "#5AA0E8", "深海": "#123A5F", "极地": "#7FA8D0" }[type] || "#2FD4DA";
    return L.divIcon({ className: "", html: '<span class="pin-wrap"><span class="pin-dot" style="background:' + color + '"></span></span>', iconSize: [16, 16], iconAnchor: [8, 8] });
  }

  function postIcon() {
    return L.divIcon({ className: "", html: '<span class="pin-wrap"><span class="pin-dot post-dot"></span></span>', iconSize: [16, 16], iconAnchor: [8, 8] });
  }

  // ===== 种子海域详情 =====
  function showSeed(spot) {
    var te = TYPE_EN[spot.type] || "jinshai";
    var imgs = (spot.images && spot.images.length) ? spot.images : [{ url: spot.image, credit: spot.image_credit }];
    var photo;
    if (imgs.length && imgs[0].url) {
      if (imgs.length === 1) {
        photo = '<div class="ocean-photo" style="background-image:url(\'' + esc(imgs[0].url) + '\')" onclick="window.openLightbox(\'' + esc(imgs[0].url) + '\')"></div>';
      } else {
        var slides = imgs.map(function (im, i) {
          var url = im.url || "";
          return '<div class="ocean-slide' + (i === 0 ? ' active' : '') + '" style="background-image:url(\'' + esc(url) + '\')" onclick="window.openLightbox(\'' + esc(url) + '\')"></div>';
        }).join("");
        var dots = imgs.map(function (_, i) {
          return '<span class="photo-dot' + (i === 0 ? ' active' : '') + '" data-i="' + i + '"></span>';
        }).join("");
        photo = '<div class="ocean-photos">' + slides + '<div class="photo-dots">' + dots + '</div></div>';
      }
      var firstCredit = imgs[0].credit || "";
      photo += firstCredit
        ? '<div class="photo-credit">图：Wikimedia Commons（' + esc(firstCredit.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")) + '）</div>'
        : "";
    } else {
      photo = '<div class="ocean-photo ph-' + te + '">' + esc(spot.name) + " · " + esc(spot.type) + '</div>';
    }
    var units = (spot.units || []).join(" / ");
    detail.classList.remove("hidden");
    detail.innerHTML =
      '<button class="detail-close" onclick="window.closeDetailCard()">×</button>' +
      '<div class="ocean-card">' +
      '<h2>' + esc(spot.name) + '</h2>' +
      '<span class="ocean-type ' + te + '">' + esc(spot.type) + '</span>' +
      photo +
      '<p class="ocean-desc">' + esc(spot.desc) + '</p>' +
      '<h3>这片海的单位</h3><p class="feed-item" style="font-size:13px">' + esc(units) + '</p>' +
      '<h3>关联动态</h3><div id="feedArea" class="feed-none">打捞中……</div>' +
      '</div>';

    var q = "region=" + encodeURIComponent(spot.region || "") + "&units=" + encodeURIComponent((spot.units || []).join(","));
    fetch("/api/ocean_feed?" + q)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var html = "";
        var news = data.news || [], jobs = data.jobs || [];
        if (news.length) {
          html += '<h3 style="margin-top:4px">动态</h3>';
          news.forEach(function (n) {
            html += '<div class="feed-item"><a href="/article/' + n.id + '">' + esc(n.title) + '</a>' +
              '<div class="feed-meta">' + esc(n.source) + (n.date ? " · " + esc(n.date) : "") + '</div></div>';
          });
        }
        if (jobs.length) {
          html += '<h3>在招岗位</h3>';
          jobs.forEach(function (j) {
            html += '<div class="feed-item"><a href="/job/' + j.id + '">' + esc(j.title) + '</a>' +
              '<div class="feed-meta">' + esc(j.unit || "") + (j.salary ? " · " + esc(j.salary) : "") + '</div></div>';
          });
        }
        if (!news.length && !jobs.length) html = '<div class="feed-none">这片海暂时没有关联内容。</div>';
        document.getElementById("feedArea").innerHTML = html;
      })
      .catch(function () {
        document.getElementById("feedArea").innerHTML = '<div class="feed-none">关联动态加载失败</div>';
      });
  }

  // ===== 用户作品详情 + 评论 =====
  function showPost(post) {
    detail.classList.remove("hidden");
    detail.innerHTML =
      '<button class="detail-close" onclick="window.closeDetailCard()">×</button>' +
      '<div class="ocean-card">' +
      '<h2>' + (post.nickname ? esc(post.nickname) + ' 的分享' : '网友分享') + '</h2>' +
      '<span class="ocean-type yuanhai">作品</span>' +
      '<div class="ocean-photo" style="background-image:url(\'' + esc(post.image_url) + '\')" onclick="window.openLightbox(\'' + esc(post.image_url) + '\')"></div>' +
      (post.text ? '<p class="ocean-desc">' + esc(post.text) + '</p>' : "") +
      (post.address ? '<p class="post-addr">📍 ' + esc(post.address) + '</p>' : "") +
      '<h3>评论</h3><div class="feed-none">评论功能暂未开放</div>' +
      '</div>';

    // 评论已关（PGC 投稿制，暂不开放 UGC 评论）
  }

  function loadComments(postId) {
    var area = document.getElementById("commentArea");
    fetch("/api/ocean/post/" + postId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var cs = data.comments || [];
        if (!cs.length) {
          area.innerHTML = '<div class="feed-none">还没有评论，来抢沙发。</div>';
          return;
        }
        var html = "";
        cs.forEach(function (c) {
          html += '<div class="comment-item">' +
            (c.nickname ? '<div class="comment-nick">' + esc(c.nickname) + '</div>' : "") +
            (c.text ? '<div class="comment-text">' + esc(c.text) + '</div>' : "") +
            (c.image_url ? '<div class="comment-img" style="background-image:url(\'' + esc(c.image_url) + '\')" onclick="window.openLightbox(\'' + esc(c.image_url) + '\')"></div>' : "") +
            '</div>';
        });
        area.innerHTML = html;
      })
      .catch(function () { area.innerHTML = '<div class="feed-none">评论加载失败</div>'; });
  }

  function bindComment(postId) {
    var submit = document.getElementById("cSubmit");
    var imgBtn = document.getElementById("cImageBtn");
    var imgInput = document.getElementById("cImage");
    if (!submit) return;
    if (imgBtn) imgBtn.onclick = function () { imgInput.click(); };
    submit.onclick = function () {
      if (!getToken()) {
        alert("请先登录再评论");
        authModal.classList.add("open");
        return;
      }
      var text = document.getElementById("cText").value;
      var fd = new FormData();
      fd.append("post_id", postId);
      fd.append("text", text);
      var f = imgInput.files[0];
      if (f) fd.append("image", f);
      if (!text.trim() && !f) { alert("评论不能为空"); return; }
      submit.textContent = "发表中……"; submit.disabled = true;
      fetch("/api/ocean/post/" + postId + "/comment", { method: "POST", body: fd, headers: { "Authorization": "Bearer " + getToken() } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            document.getElementById("cText").value = "";
            document.getElementById("cNick").value = "";
            imgInput.value = "";
            submit.textContent = "发表评论"; submit.disabled = false;
            loadComments(postId);
          } else { alert(d.error || "发表失败"); submit.textContent = "发表评论"; submit.disabled = false; }
        })
        .catch(function () { alert("发表失败"); submit.textContent = "发表评论"; submit.disabled = false; });
    };
  }

  // ===== 加载种子点 + 作品点 =====
  fetch("/api/oceans").then(function (r) { return r.json(); }).then(function (spots) {
    (spots || []).forEach(function (spot) {
      var m = L.marker([spot.lat, spot.lng], { icon: seedIcon(spot.type) }).addTo(map);
      m.on("click", function () { showSeed(spot); });
    });
    // 初始纯地图，点标记才呼出悬浮卡片
  });

  function loadPosts() {
    fetch("/api/ocean/posts").then(function (r) { return r.json(); }).then(function (data) {
      (data.posts || []).forEach(function (post) {
        var m = L.marker([post.lat, post.lng], { icon: postIcon() }).addTo(map);
        m.on("click", function () { showPost(post); });
      });
    });
  }
  // 站长审核刊登的投稿展示（PGC 制，2026-08-20 晚恢复：admin 审核通过 → 地图展示）
  loadPosts();
  loadRegions();
  bindRegions();

  // ===== 潮汐站点（星图地球数据云，2026-08-25 新增）=====
  // 分类切换：图鉴模式显示海域点，潮汐表模式显示潮汐站点（分级：省份聚合 → 港口）
  var tideMarkers = [];
  var currentMode = "atlas";
  function tideIcon() {
    return L.divIcon({
      className: "",
      html: '<span class="tide-dot"></span>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  }
  function loadTideSites() {
    fetch("/static/data/ports.json").then(function (r) { return r.json(); }).then(function (data) {
      var ports = data.ports || [];
      // 按省份聚合（大比例尺显示地区数量）
      var byProv = {};
      ports.forEach(function (p) {
        if (!byProv[p.province]) byProv[p.province] = { ports: [], latSum: 0, lonSum: 0 };
        byProv[p.province].ports.push(p);
        byProv[p.province].latSum += p.lat;
        byProv[p.province].lonSum += p.lon;
      });
      window.__tideByProv = byProv;
      // 潮汐表模式才显示潮汐标记
      if (currentMode === "tide") showTideRegions();
    });
  }
  function showTideRegions() {
    var byProv = window.__tideByProv || {};
    tideRegionMarkers = [];
    Object.keys(byProv).forEach(function (prov) {
      var g = byProv[prov];
      var centerLat = g.latSum / g.ports.length;
      var centerLon = g.lonSum / g.ports.length;
      var m = L.marker([centerLat, centerLon], {
        icon: L.divIcon({
          className: "",
          html: '<span class="tide-region" data-prov="' + prov + '">' + prov + ' ' + g.ports.length + '个</span>',
          iconSize: [100, 24],
          iconAnchor: [50, 12],
        }),
      });
      m._tideRegion = true;
      tideRegionMarkers.push(m);
      m.on("click", function () {
        // 点击省份 → 定位到该省
        map.setView([centerLat, centerLon], 8);
      });
    });
  }
  // 比例尺控制：zoom<7 显示省份标签隐藏红点，zoom>=7 隐藏省份标签显示红点（自动）
  var tideRegionMarkers = [];
  var tideDotMarkers = [];
  function updateTideRegionsByZoom() {
    if (currentMode !== "tide") return;
    var zoom = map.getZoom();
    // 省份标签
    tideRegionMarkers.forEach(function (m) {
      if (map.hasLayer(m)) {
        if (zoom >= 7) map.removeLayer(m);
      } else {
        if (zoom < 7) m.addTo(map);
      }
    });
    // 红点：zoom>=7 显示，zoom<7 隐藏（跟省份标签联动）
    if (zoom >= 7) {
      showTideDots();
    } else {
      clearTideDots();
    }
  }
  function showTideDots() {
    clearTideDots();
    var byProv = window.__tideByProv || {};
    Object.keys(byProv).forEach(function (prov) {
      byProv[prov].ports.forEach(function (p) {
        var m = L.marker([p.lat, p.lon], { icon: tideIcon() }).addTo(map);
        m.bindTooltip(p.name, { direction: "top", offset: [0, -8] });
        m.on("click", function () { showTide(p); });
        tideDotMarkers.push(m);
      });
    });
  }
  function clearTideDots() {
    tideDotMarkers.forEach(function (m) { map.removeLayer(m); });
    tideDotMarkers = [];
  }
  map.on("zoomend", updateTideRegionsByZoom);
  // 模式切换：图鉴 / 潮汐表
  function switchMode(mode) {
    currentMode = mode;
    document.getElementById("modeAtlas").classList.toggle("active", mode === "atlas");
    document.getElementById("modeTide").classList.toggle("active", mode === "tide");
    document.getElementById("modeFlow").classList.toggle("active", mode === "flow");
    document.getElementById("modeGfs").classList.toggle("active", mode === "gfs");
    document.getElementById("modeSst").classList.toggle("active", mode === "sst");
    document.getElementById("modeSss").classList.toggle("active", mode === "sss");
    document.getElementById("modeCurrent").classList.toggle("active", mode === "current");
    document.getElementById("modeChl").classList.toggle("active", mode === "chl");
    document.getElementById("modeTyphoon").classList.toggle("active", mode === "typhoon");
    document.getElementById("modeCloud").classList.toggle("active", mode === "cloud");
    document.getElementById("modeExpert").classList.toggle("active", mode === "expert");
    document.getElementById("modeBathy").classList.toggle("active", mode === "bathy");
    document.getElementById("modeSpecies").classList.toggle("active", mode === "species");
    document.getElementById("tideSearch").style.display = mode === "tide" ? "block" : "none";
    // 台风年份下拉 + 侧边栏 + 时间轴：只在台风模式显示
    document.getElementById("typhoonYear").style.display = mode === "typhoon" ? "block" : "none";
    document.getElementById("typhoonPanel").classList.toggle("hidden", mode !== "typhoon");
    document.getElementById("typhoonTimeline").classList.toggle("hidden", mode !== "typhoon");
    document.getElementById("cloudTimeline").classList.toggle("hidden", mode !== "cloud");
    // OceanExpert 机构名录侧边面板：只在机构模式显示
    document.getElementById("expertPanel").classList.toggle("hidden", mode !== "expert");
    // SST/盐度/流速都是逐小时图层，共用 sstTimeWrap 时间滑块；台风无时间滑块
    document.getElementById("sstTimeWrap").style.display = (mode === "sst" || mode === "sss" || mode === "current") ? "flex" : "none";
    document.getElementById("chlTimeWrap").style.display = mode === "chl" ? "block" : "none";
    // 图例：只在对应模式显示
    document.getElementById("sstLegend").classList.toggle("hidden", mode !== "sst");
    document.getElementById("chlLegend").classList.toggle("hidden", mode !== "chl");
    document.getElementById("sssLegend").classList.toggle("hidden", mode !== "sss");
    document.getElementById("currentLegend").classList.toggle("hidden", mode !== "current");
    document.getElementById("bathyLegend").classList.toggle("hidden", mode !== "bathy");
    // 清掉地图上所有标记，重新按模式加载
    map.eachLayer(function (layer) {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
    tideDotMarkers = [];
    // 移除所有覆盖图层（流场/SST/叶绿素/盐度/流速/风场）
    if (flowLayer && flowLayer._map) map.removeLayer(flowLayer);
    if (gfsLayer && gfsLayer._map) map.removeLayer(gfsLayer);
    if (sstLayer && sstLayer._map) map.removeLayer(sstLayer);
    if (chlLayer && chlLayer._map) map.removeLayer(chlLayer);
    if (sssLayer && sssLayer._map) map.removeLayer(sssLayer);
    if (currentLayer && currentLayer._map) map.removeLayer(currentLayer);
    if (bathyLayer && bathyLayer._map) map.removeLayer(bathyLayer);
    clearTyphoon();
    clearCloud();
    clearExpert();
    if (mode === "tide") {
      showTideRegions();
      updateTideRegionsByZoom();  // 按当前 zoom 决定显示省份还是红点
      document.getElementById("mapTip").style.display = "none";  // 潮汐表模式不显示提示条（用户反馈碍事）
    } else if (mode === "flow") {
      loadFlowLayer();
      document.getElementById("mapTip").style.display = "none";
      // 恢复洋流数据来源文字
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = '洋流数据：<a href="https://polar.ncep.noaa.gov/global/" target="_blank" rel="noopener">NOAA Global RTOFS</a>（全球实时洋流预报）· 仅供参考';
    } else if (mode === "gfs") {
      loadGfsLayer();
      document.getElementById("mapTip").style.display = "none";
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = '风场数据：<a href="https://www.nco.ncep.noaa.gov/pmb/products/gfs/" target="_blank" rel="noopener">NOAA GFS</a>（全球 10 米风场预报）· 仅供参考';
    } else if (mode === "sst") {
      loadSstLayer();
      document.getElementById("mapTip").style.display = "none";
      document.getElementById("sstLegend").classList.remove("hidden");
      document.getElementById("chlLegend").classList.add("hidden");
      document.getElementById("sssLegend").classList.add("hidden");
      document.getElementById("currentLegend").classList.add("hidden");
      // 显示 SST 数据来源
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = 'SST 数据：<a href="https://datacloud.geovisearth.com/" target="_blank" rel="noopener">星图地球数据云</a>（全球海表温度）· 仅供参考';
    } else if (mode === "sss") {
      loadSssLayer();
      document.getElementById("mapTip").style.display = "none";
      document.getElementById("sssLegend").classList.remove("hidden");
      document.getElementById("sstLegend").classList.add("hidden");
      document.getElementById("chlLegend").classList.add("hidden");
      document.getElementById("currentLegend").classList.add("hidden");
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = '盐度数据：<a href="https://datacloud.geovisearth.com/" target="_blank" rel="noopener">星图地球数据云</a>（全球海表盐度）· 仅供参考';
    } else if (mode === "current") {
      loadCurrentLayer();
      document.getElementById("mapTip").style.display = "none";
      document.getElementById("currentLegend").classList.remove("hidden");
      document.getElementById("sstLegend").classList.add("hidden");
      document.getElementById("chlLegend").classList.add("hidden");
      document.getElementById("sssLegend").classList.add("hidden");
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = '流速数据：<a href="https://datacloud.geovisearth.com/" target="_blank" rel="noopener">星图地球数据云</a>（全球洋流流速）· 仅供参考';
    } else if (mode === "chl") {
      loadChlLayer();
      document.getElementById("mapTip").style.display = "none";
      document.getElementById("chlLegend").classList.remove("hidden");
      document.getElementById("sstLegend").classList.add("hidden");
      // 显示叶绿素数据来源
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = '叶绿素数据：<a href="https://coastwatch.pfeg.noaa.gov/erddap/" target="_blank" rel="noopener">NOAA CoastWatch ERDDAP</a>（Aqua MODIS 4km 日合成）· 仅供参考';
    } else if (mode === "typhoon") {
      document.getElementById("typhoonYear").style.display = "block";
      document.getElementById("typhoonPanel").classList.remove("hidden");
      document.getElementById("typhoonToggle").classList.add("hidden");  // 展开面板时隐藏小按钮
      loadTyphoonList();
      document.getElementById("mapTip").style.display = "none";
      document.getElementById("sstLegend").classList.add("hidden");
      document.getElementById("chlLegend").classList.add("hidden");
      document.getElementById("sssLegend").classList.add("hidden");
      document.getElementById("currentLegend").classList.add("hidden");
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = '台风数据：<a href="https://datacloud.geovisearth.com/" target="_blank" rel="noopener">星图地球数据云</a>（全球台风实况与预报）· 仅供参考';
    } else if (mode === "cloud") {
      document.getElementById("typhoonPanel").classList.add("hidden");
      loadCloud();
      document.getElementById("mapTip").style.display = "none";
      document.getElementById("sstLegend").classList.add("hidden");
      document.getElementById("chlLegend").classList.add("hidden");
      document.getElementById("sssLegend").classList.add("hidden");
      document.getElementById("currentLegend").classList.add("hidden");
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = '云图数据：<a href="https://www.nsmc.org.cn/" target="_blank" rel="noopener">国家卫星气象中心</a>（GEOS-IRX 全球红外云图）· 仅供参考';
    } else if (mode === "expert") {
      // OceanExpert 机构/专家名录：地图上画国家聚合标记
      document.getElementById("mapTip").style.display = "none";
      document.getElementById("sstLegend").classList.add("hidden");
      document.getElementById("chlLegend").classList.add("hidden");
      document.getElementById("sssLegend").classList.add("hidden");
      document.getElementById("currentLegend").classList.add("hidden");
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = '名录数据：<a href="https://oceanexpert.org/" target="_blank" rel="noopener">UNESCO/IOC OceanExpert</a>（全球海洋机构与专家名录）· 仅供参考';
      loadExpertMarkers();
    } else if (mode === "bathy") {
      loadBathyLayer();
      document.getElementById("mapTip").style.display = "none";
      document.getElementById("sstLegend").classList.add("hidden");
      document.getElementById("chlLegend").classList.add("hidden");
      document.getElementById("sssLegend").classList.add("hidden");
      document.getElementById("currentLegend").classList.add("hidden");
      document.getElementById("bathyLegend").classList.remove("hidden");
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = '地形数据：<a href="https://www.ncei.noaa.gov/products/etopo-global-relief-model" target="_blank" rel="noopener">NOAA NCEI ETOPO 2022</a>（全球海陆地形）· 仅供参考';
    } else if (mode === "species") {
      document.getElementById("speciesPanel").classList.remove("hidden");
      document.getElementById("mapTip").style.display = "none";
      document.getElementById("sstLegend").classList.add("hidden");
      document.getElementById("chlLegend").classList.add("hidden");
      document.getElementById("sssLegend").classList.add("hidden");
      document.getElementById("currentLegend").classList.add("hidden");
      document.getElementById("bathyLegend").classList.add("hidden");
      var fs = document.getElementById("flowSource");
      fs.classList.remove("hidden");
      fs.innerHTML = '图鉴数据：<a href="https://www.marinespecies.org/" target="_blank" rel="noopener">WoRMS</a>（物种名录）· <a href="https://obis.org/" target="_blank" rel="noopener">OBIS</a>（分布）· <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener">Wikimedia Commons</a>（图片，CC 授权）· 仅供参考';
      loadSpeciesMode();
    } else {
      document.getElementById("flowSource").classList.add("hidden");  // 隐藏数据来源
      loadPosts();
      loadRegions();
      document.getElementById("mapTip").style.display = "";
      document.getElementById("mapTip").textContent = "看到有意思的海？点右上角「投稿上地图」，上传照片和位置，审核通过后刊登";
    }
  }
  document.getElementById("modeAtlas").addEventListener("click", function () { switchMode("atlas"); });
  document.getElementById("modeTide").addEventListener("click", function () { switchMode("tide"); });
  document.getElementById("modeFlow").addEventListener("click", function () { switchMode("flow"); });
  document.getElementById("modeGfs").addEventListener("click", function () { switchMode("gfs"); });
  document.getElementById("modeSst").addEventListener("click", function () { switchMode("sst"); });
  document.getElementById("modeSss").addEventListener("click", function () { switchMode("sss"); });
  document.getElementById("modeCurrent").addEventListener("click", function () { switchMode("current"); });
  document.getElementById("modeChl").addEventListener("click", function () { switchMode("chl"); });
  document.getElementById("modeTyphoon").addEventListener("click", function () { switchMode("typhoon"); });
  document.getElementById("modeCloud").addEventListener("click", function () { switchMode("cloud"); });
  document.getElementById("modeExpert").addEventListener("click", function () { switchMode("expert"); });
  document.getElementById("modeBathy").addEventListener("click", function () { switchMode("bathy"); });
  document.getElementById("modeSpecies").addEventListener("click", function () { switchMode("species"); });
  // 台风侧边栏收起/展开
  document.getElementById("tpCollapseBtn").addEventListener("click", function () {
    document.getElementById("typhoonPanel").classList.add("hidden");
    document.getElementById("typhoonToggle").classList.remove("hidden");
  });
  document.getElementById("typhoonToggle").addEventListener("click", function () {
    document.getElementById("typhoonPanel").classList.remove("hidden");
    document.getElementById("typhoonToggle").classList.add("hidden");
  });
  // 台风列表重置：回到默认状态（只显示当前活动台风）
  document.getElementById("tpResetBtn").addEventListener("click", function () {
    loadTyphoonList();
  });
  // 全球洋流流场（星图，leaflet-wind 画流线）
  var flowLayer = null;
  function loadFlowLayer(ts) {
    // 若已加载且没换时间，直接显示
    if (flowLayer && !ts) { map.addLayer(flowLayer); return; }
    window._map = map;  // 调试：暴露 map
    var perf = window.PerfMode ? window.PerfMode.getMode() : "quality";
    if (perf === "lite") { return; }  // 极简模式不加载流场
    var url = "/api/ocean-flow";
    if (ts) url += "?start=" + ts + "&end=" + ts;  // 指定时次
    // 显示加载提示（洋流数据 7-10s，避免用户以为坏了）
    var loadingEl = document.getElementById("flowLoading");
    if (loadingEl) loadingEl.classList.remove("hidden");
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (loadingEl) loadingEl.classList.add("hidden");
      if (!data || data.status !== 0 || !data.result) {
        console.warn("洋流流场加载失败", data);
        return;
      }
      var flowData = data.result;  // 后端已应用海陆掩膜，返回 U/V 分量数组
      if (!Array.isArray(flowData) || flowData.length < 2) {
        console.warn("洋流流场数据格式不对", flowData);
        return;
      }
      if (!window.leafletWind || !window.leafletWind.WindLayer) { console.warn("leaflet-wind 未加载"); return; }
      // 性能模式：质量全量，性能降级粒子数
      var paths = 6000;
      if (perf === "performance") paths = 3000;
      // 移除旧流场
      if (flowLayer && flowLayer._map) map.removeLayer(flowLayer);
      flowLayer = new window.leafletWind.WindLayer("current", flowData, {
        windOptions: {
          colorScale: ["rgb(0,60,140)","rgb(0,80,160)","rgb(0,100,180)","rgb(0,120,190)","rgb(0,140,200)","rgb(40,60,180)","rgb(80,40,180)","rgb(120,30,170)","rgb(160,20,150)","rgb(190,10,120)","rgb(210,5,90)","rgb(220,0,60)","rgb(200,0,30)","rgb(170,0,10)","rgb(140,0,0)"],
          velocityScale: function () { return 1 / 25; },
          frameRate: 80,
          maxAge: 80,
          globalAlpha: 0.95,
          lineWidth: 2.5,
          paths: function () { return paths; }
        }
      });
      // 调试：暴露 zoom + paths（临时）
      window._flowDbg = { zoom: map.getZoom(), paths: paths * Math.pow(1.15, map.getZoom()) };
      map.addLayer(flowLayer);
    }).catch(function (e) { console.warn("洋流流场接口失败", e); if (loadingEl) loadingEl.classList.add("hidden"); });
  }

  // ========== 全球风场（NOAA GFS，10 米风，leaflet-wind 画流场）==========
  var gfsLayer = null;
  function loadGfsLayer(ts) {
    if (gfsLayer && !ts) { map.addLayer(gfsLayer); return; }
    var perf = window.PerfMode ? window.PerfMode.getMode() : "quality";
    if (perf === "lite") { return; }
    var url = "/api/ocean-gfs";
    var loadingEl = document.getElementById("flowLoading");
    if (loadingEl) {
      var lt = document.getElementById("flowLoadingText");
      if (lt) lt.textContent = "风场加载中…";
      loadingEl.classList.remove("hidden");
    }
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (loadingEl) loadingEl.classList.add("hidden");
      if (!data || data.status !== 0 || !data.result) { console.warn("GFS 风场加载失败", data); return; }
      // 标注风场时间（GFS 数据可能延迟，标注实际数据时间）
      var fs = document.getElementById("flowSource");
      if (fs && data.time) {
        var t = data.time;  // yyyyMMddHHmm
        var tstr = t.slice(0,4) + "-" + t.slice(4,6) + "-" + t.slice(6,8) + " " + t.slice(8,10) + ":" + t.slice(10,12);
        fs.innerHTML = '风场数据：<a href="https://www.nco.ncep.noaa.gov/pmb/products/gfs/" target="_blank" rel="noopener">NOAA GFS</a>（全球 10 米风场预报）· 数据时间 ' + tstr + ' UTC · 仅供参考';
      }
      var flowData = data.result;  // 星图流场 json 格式 [{header,data},{header,data}]
      if (!Array.isArray(flowData) || flowData.length < 2) { console.warn("GFS 数据格式不对", flowData); return; }
      if (!window.leafletWind || !window.leafletWind.WindLayer) { console.warn("leaflet-wind 未加载"); return; }
      var paths = 6000;
      if (perf === "performance") paths = 3000;
      if (gfsLayer && gfsLayer._map) map.removeLayer(gfsLayer);
      gfsLayer = new window.leafletWind.WindLayer("current", flowData, {
        windOptions: {
          colorScale: ["rgb(0,60,140)","rgb(0,80,160)","rgb(0,100,180)","rgb(0,120,190)","rgb(0,140,200)","rgb(40,60,180)","rgb(80,40,180)","rgb(120,30,170)","rgb(160,20,150)","rgb(190,10,120)","rgb(210,5,90)","rgb(220,0,60)","rgb(200,0,30)","rgb(170,0,10)","rgb(140,0,0)"],
          velocityScale: function () { return 1 / 25; },
          frameRate: 80,
          maxAge: 80,
          globalAlpha: 0.95,
          lineWidth: 2.5,
          paths: function () { return paths; }
        }
      });
      map.addLayer(gfsLayer);
    }).catch(function (e) { console.warn("GFS 接口失败", e); if (loadingEl) loadingEl.classList.add("hidden"); });
  }

  // ========== SST（海表温度）图层（星图，webp 图叠加）==========
  var sstLayer = null;
  var sstTimeRange = document.getElementById("sstTimeRange");
  var sstTimeLabel = document.getElementById("sstTimeLabel");
  // 生成 SST 时次字符串（当前小时 + 偏移小时）
  function sstTimeStr(offsetH) {
    var d = new Date();
    d.setHours(d.getHours() + offsetH);
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours());
  }
  function loadSstLayer(ts) {
    // 若已加载且没换时间，直接显示
    if (sstLayer && !ts) { map.addLayer(sstLayer); return; }
    var perf = window.PerfMode ? window.PerfMode.getMode() : "quality";
    if (perf === "lite") { return; }
    var offsetH = sstTimeRange ? parseInt(sstTimeRange.value, 10) : 0;
    var tsStr = ts || sstTimeStr(offsetH);
    if (sstTimeLabel) {
      if (offsetH === 0) sstTimeLabel.textContent = "当前";
      else if (offsetH < 0) sstTimeLabel.textContent = offsetH + "h";
      else sstTimeLabel.textContent = "+" + offsetH + "h";
    }
    fetch("/api/ocean-sst?start=" + tsStr + "&end=" + tsStr)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok || !data.webp_url) { console.warn("SST 加载失败", data); return; }
        var bounds = data.bounds;
        if (!bounds) { console.warn("SST 无边界", data); return; }
        var latLngBounds = L.latLngBounds(
          [bounds.latmin, bounds.lonmin],
          [bounds.latmax, bounds.lonmax]
        );
        if (sstLayer && sstLayer._map) map.removeLayer(sstLayer);
        sstLayer = L.imageOverlay(data.webp_url, latLngBounds, { opacity: 0.85, interactive: false }).addTo(map);
      })
      .catch(function (e) { console.warn("SST 接口失败", e); });
  }
  // SST 时间滑块事件
  if (sstTimeRange) {
    sstTimeRange.addEventListener("input", function () {
      if (currentMode === "sst") {
        loadSstLayer(sstTimeStr(parseInt(sstTimeRange.value, 10)));
      }
    });
  }

  // ========== 盐度（SSS）/ 流速（current_speed）图层（星图，复用 SST 逻辑）==========
  var sssLayer = null;
  var currentLayer = null;
  var bathyLayer = null;
  // 盐度图层加载（跟 loadSstLayer 同构）
  function loadSssLayer(ts) {
    if (sssLayer && !ts) { map.addLayer(sssLayer); return; }
    var perf = window.PerfMode ? window.PerfMode.getMode() : "quality";
    if (perf === "lite") { return; }
    var offsetH = sstTimeRange ? parseInt(sstTimeRange.value, 10) : 0;
    var tsStr = ts || sstTimeStr(offsetH);
    if (sstTimeLabel) {
      if (offsetH === 0) sstTimeLabel.textContent = "当前";
      else if (offsetH < 0) sstTimeLabel.textContent = offsetH + "h";
      else sstTimeLabel.textContent = "+" + offsetH + "h";
    }
    fetch("/api/ocean-sss?start=" + tsStr + "&end=" + tsStr)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok || !data.webp_url) { console.warn("SSS 加载失败", data); return; }
        var bounds = data.bounds;
        if (!bounds) { console.warn("SSS 无边界", data); return; }
        var latLngBounds = L.latLngBounds(
          [bounds.latmin, bounds.lonmin],
          [bounds.latmax, bounds.lonmax]
        );
        if (sssLayer && sssLayer._map) map.removeLayer(sssLayer);
        sssLayer = L.imageOverlay(data.webp_url, latLngBounds, { opacity: 0.85, interactive: false }).addTo(map);
      })
      .catch(function (e) { console.warn("SSS 接口失败", e); });
  }
  // 流速图层加载（跟 loadSstLayer 同构）
  function loadCurrentLayer(ts) {
    if (currentLayer && !ts) { map.addLayer(currentLayer); return; }
    var perf = window.PerfMode ? window.PerfMode.getMode() : "quality";
    if (perf === "lite") { return; }
    var offsetH = sstTimeRange ? parseInt(sstTimeRange.value, 10) : 0;
    var tsStr = ts || sstTimeStr(offsetH);
    if (sstTimeLabel) {
      if (offsetH === 0) sstTimeLabel.textContent = "当前";
      else if (offsetH < 0) sstTimeLabel.textContent = offsetH + "h";
      else sstTimeLabel.textContent = "+" + offsetH + "h";
    }
    fetch("/api/ocean-current?start=" + tsStr + "&end=" + tsStr)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok || !data.webp_url) { console.warn("流速 加载失败", data); return; }
        var bounds = data.bounds;
        if (!bounds) { console.warn("流速 无边界", data); return; }
        var latLngBounds = L.latLngBounds(
          [bounds.latmin, bounds.lonmin],
          [bounds.latmax, bounds.lonmax]
        );
        if (currentLayer && currentLayer._map) map.removeLayer(currentLayer);
        currentLayer = L.imageOverlay(data.webp_url, latLngBounds, { opacity: 0.85, interactive: false }).addTo(map);
      })
      .catch(function (e) { console.warn("流速 接口失败", e); });
  }

  // ========== 台风（星图，年份下拉 + 列表勾选 + 多路径显示）==========
  var typhoonMarkers = [];
  var typhoonPaths = [];  // 已显示的台风路径图层（多个）
  var typhoonFcMarkers = [];  // 预报点标记（独立于 polyline）
  var typhoonYearSelect = document.getElementById("typhoonYear");
  var typhoonListEl = document.getElementById("typhoonList");
  var typhoonPanelEl = document.getElementById("typhoonPanel");
  var typhoonSelected = {};  // tpId -> {name, color}
  var typhoonColors = ["#ff3366", "#ff6600", "#0066ff", "#00cc66", "#cc00cc", "#ffcc00", "#00cccc", "#6633ff"];
  function clearTyphoon() {
    typhoonMarkers.forEach(function (m) { if (m._map) map.removeLayer(m); });
    typhoonMarkers = [];
    typhoonPaths.forEach(function (l) { if (l._map) map.removeLayer(l); });
    typhoonPaths = [];
    typhoonFcMarkers.forEach(function (m) { if (m._map) map.removeLayer(m); });
    typhoonFcMarkers = [];
    typhoonSelected = {};
    // 清时间轴高亮标记
    if (typeof ttMarker !== "undefined" && ttMarker && ttMarker._map) map.removeLayer(ttMarker);
    ttMarker = null;
    // 隐藏实时动态资讯侧边栏
    var newsEl = document.getElementById("typhoonNews");
    if (newsEl) newsEl.classList.add("hidden");
  }
  // 填充年份下拉（近 10 年，默认当前年）
  function initTyphoonYears() {
    if (!typhoonYearSelect || typhoonYearSelect._inited) return;
    typhoonYearSelect._inited = true;
    var now = new Date().getFullYear();
    for (var y = now; y >= now - 10; y--) {
      var opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y + " 年";
      typhoonYearSelect.appendChild(opt);
    }
    typhoonYearSelect.value = String(now);
  }
  // 加载指定年份台风列表（侧边栏）
  function loadTyphoonList() {
    initTyphoonYears();
    clearTyphoon();
    clearCloud();
    if (!typhoonListEl) return;
    var year = typhoonYearSelect ? typhoonYearSelect.value : new Date().getFullYear();
    typhoonListEl.innerHTML = '<p class="typhoon-loading">加载中…</p>';
    fetch("/api/typhoon/list?year=" + year)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok || !data.typhoons || !data.typhoons.length) {
          typhoonListEl.innerHTML = '<p class="typhoon-loading">该年暂无台风数据</p>';
          return;
        }
        // 当前活跃台风（active=1）自动勾选显示
        var active = data.typhoons.filter(function (t) { return t.active === 1; });
        typhoonListEl.innerHTML = data.typhoons.map(function (t) {
          var checked = t.active === 1 ? "checked" : "";
          return '<label class="typhoon-item">' +
            '<input type="checkbox" class="typhoon-cb" data-tpid="' + t.tpId + '" data-name="' + (t.name || t.enName || t.tpId) + '" ' + checked + '>' +
            '<span class="typhoon-item-name">' + (t.name || "") + ' <small>' + (t.enName || "") + '</small></span>' +
            (t.active === 1 ? '<span class="typhoon-active-tag">活跃</span>' : '') +
          '</label>';
        }).join("");
        // 自动显示活跃台风路径
        active.forEach(function (t) { showTyphoonPath(t.tpId, t.name || t.enName); });
      })
      .catch(function () { typhoonListEl.innerHTML = '<p class="typhoon-loading">加载失败</p>'; });
  }
  // 显示台风路径（实况实线 + 预报虚线），多选多路径
  function showTyphoonPath(tpId, name) {
    if (typhoonSelected[tpId]) { return; }  // 已显示
    var color = typhoonColors[Object.keys(typhoonSelected).length % typhoonColors.length];
    typhoonSelected[tpId] = { name: name, color: color };
    fetch("/api/typhoon/detail?tpId=" + tpId)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok || !d.typhoon) return;
        var typhoon = d.typhoon;
        var rt = typhoon.rtPoints || [];
        var rtLatLngs = rt.map(function (p) { return [p.centerLat, p.centerLon]; });
        // 预报路径在「最后一个实况点的 fcPoints」（不是顶层 fcPoints）
        var fc = (rt.length ? (rt[rt.length - 1].fcPoints || {}) : {}) || {};
        var fcLatLngs = [];
        var fcKeys = Object.keys(fc);
        if (fcKeys.length) {
          // 取第一个有预报点的机构（BABJ 等）
          var fcArr = fc[fcKeys[0]] || [];
          fcLatLngs = fcArr.map(function (p) { return [p.centerLat, p.centerLon]; });
        }
        // 实况路径（实线，该台风颜色）
        if (rtLatLngs.length) {
          typhoonPaths.push(L.polyline(rtLatLngs, { color: color, weight: 3, opacity: 0.9 }).addTo(map));
        }
        // 预报路径（虚线，同色）
        if (fcLatLngs.length) {
          typhoonPaths.push(L.polyline(fcLatLngs, { color: color, weight: 2, opacity: 0.7, dashArray: "6 6" }).addTo(map));
        }
        // 预报点标注（tooltip 显示到达时间/位置）
        if (fcArr && fcArr.length) {
          fcArr.forEach(function (p, idx) {
            if (p.centerLat == null || p.centerLon == null) return;
            // 预报点统一用青色小点（起点跟台风标记重叠，不用单独红点）
            var fcIcon = L.divIcon({
              className: "typhoon-icon",
              html: '<span class="typhoon-fc-dot"></span>',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            });
            var m = L.marker([p.centerLat, p.centerLon], { icon: fcIcon }).addTo(map);
            // 预报点时间 hover 显示（靠近才展示，不一次性全挤）——只 bindTooltip 一次，避免冲突
            if (p.fc_time && p.fc_time.length >= 16) {
              var tstr = p.fc_time.slice(8, 10) + "日" + p.fc_time.slice(11, 13) + "时";
              m.bindTooltip(tstr + " 到达", { direction: "top", offset: [0, -10], className: "typhoon-fc-label" });
            }
            typhoonFcMarkers.push(m);  // 加入预报点标记数组（独立于 polyline）
          });
        }
        // 最新点标记
        if (rtLatLngs.length) {
          var last = rtLatLngs[rtLatLngs.length - 1];
          var icon = L.divIcon({
            className: "typhoon-icon",
            html: '<span class="typhoon-dot" style="background:' + color + '"></span>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });
          var marker = L.marker(last, { icon: icon }).addTo(map);
          marker.bindPopup(typhoonPopupHtml(typhoon, tpId));
          // 点红点切换时间轴到该台风
          marker._typhoonRt = rt;
          marker._typhoonTpId = tpId;
          marker._typhoonName = name;
          marker.on("click", function () {
            initTyphoonTimeline(this._typhoonTpId, this._typhoonName, this._typhoonRt);
            loadTyphoonNews(this._typhoonName);
          });
          typhoonMarkers.push(marker);
        }
        // 初始化时间轴（该台风的时间范围，默认最新时次）
        initTyphoonTimeline(tpId, name, rt);
        // 加载该台风的实时动态资讯
        loadTyphoonNews(name);
        // 适配视野到所有路径（只处理 polyline，跳过 marker）
        if (typhoonPaths.length) {
          var allLatLngs = [];
          typhoonPaths.forEach(function (l) {
            if (l && typeof l.getLatLngs === "function") {
              allLatLngs = allLatLngs.concat(l.getLatLngs());
            }
          });
          if (allLatLngs.length) {
            map.fitBounds(L.latLngBounds(allLatLngs), { padding: [50, 50] });
          }
        }
      })
      .catch(function (e) { console.warn("台风路径失败", e); });
  }
  // 时间轴：显示选中台风的时间滑块，拖动高亮该时次位置+信息
  var ttTimeline = document.getElementById("typhoonTimeline");
  var ttRange = document.getElementById("ttRange");
  var ttName = document.getElementById("ttName");
  var ttInfo = document.getElementById("ttInfo");
  var ttData = [];  // 当前时间轴的台风实况点
  var ttMarker = null;  // 时间轴高亮标记
  function initTyphoonTimeline(tpId, name, rt) {
    if (!ttTimeline || !rt || !rt.length) return;
    ttData = rt;
    ttTimeline.classList.remove("hidden");
    if (ttName) ttName.textContent = name + " 时间轴";
    if (ttRange) {
      ttRange.min = 0;
      ttRange.max = rt.length - 1;
      ttRange.value = rt.length - 1;  // 默认最新时次
    }
    updateTimeline(rt.length - 1);
  }
  // 加载台风实时动态资讯（按台风名查 /api/typhoon/news）
  function loadTyphoonNews(name) {
    var newsEl = document.getElementById("typhoonNews");
    var listEl = document.getElementById("typhoonNewsList");
    if (!newsEl || !listEl) return;
    newsEl.classList.remove("hidden");
    listEl.innerHTML = '<p class="typhoon-news-empty">加载中…</p>';
    if (!name) { listEl.innerHTML = '<p class="typhoon-news-empty">暂无相关资讯</p>'; return; }
    fetch("/api/typhoon/news?name=" + encodeURIComponent(name))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok || !d.articles || !d.articles.length) {
          listEl.innerHTML = '<p class="typhoon-news-empty">暂无相关资讯</p>';
          return;
        }
        listEl.innerHTML = d.articles.map(function (a) {
          var src = a.source || "";
          var date = a.date || "";
          return '<a class="typhoon-news-item" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
            '<div class="typhoon-news-title">' + esc(a.title) + '</div>' +
            '<div class="typhoon-news-meta">' + esc(src) + (date ? ' · ' + esc(date) : '') + '</div>' +
          '</a>';
        }).join("");
      })
      .catch(function () { listEl.innerHTML = '<p class="typhoon-news-empty">加载失败</p>'; });
  }
  function updateTimeline(idx) {
    if (!ttData.length) return;
    var p = ttData[idx];
    if (!p) return;
    // 高亮该时次位置
    if (ttMarker && ttMarker._map) map.removeLayer(ttMarker);
    ttMarker = L.circleMarker([p.centerLat, p.centerLon], {
      radius: 9, color: "#ff3366", fillColor: "#ff3366", fillOpacity: 0.7, weight: 2
    }).addTo(map);
    // 显示信息
    var gradeMap = { TD: "热带低压", TS: "热带风暴", STS: "强热带风暴", TY: "台风", STY: "强台风", SuperTY: "超强台风" };
    var grade = gradeMap[p.grade] || p.grade || "";
    if (ttInfo) {
      ttInfo.innerHTML =
        '<div class="tt-time">' + (p.data_time || "") + '</div>' +
        '<div class="tt-row">等级：' + grade + '</div>' +
        '<div class="tt-row">风速：' + p.windSpeed + ' m/s（' + p.windLevel + '级）</div>' +
        '<div class="tt-row">气压：' + p.centerPrs + ' hPa</div>' +
        '<div class="tt-row">位置：' + p.centerLat.toFixed(1) + '°N, ' + p.centerLon.toFixed(1) + '°E</div>' +
        '<div class="tt-row">7级风圈：' + (p.radius_7 || '-') + ' km</div>' +
        '<div class="tt-row">10级风圈：' + (p.radius_10 || '-') + ' km</div>' +
        '<div class="tt-row">12级风圈：' + (p.radius_12 || '-') + ' km</div>';
    }
  }
  // 时间轴滑块事件
  if (ttRange) {
    ttRange.addEventListener("input", function () {
      updateTimeline(parseInt(ttRange.value, 10));
    });
  }

  // ========== 云图（NSMC GEOS-IRX 全球红外，time轴逐帧播放）==========
  var cloudLayer = null;
  var cloudTimes = [];
  var cloudRange = document.getElementById("cloudRange");
  var cloudInfo = document.getElementById("cloudInfo");
  var cloudTimeline = document.getElementById("cloudTimeline");
  var cloudTimer = null;
  function clearCloud() {
    if (cloudLayer && cloudLayer._map) map.removeLayer(cloudLayer);
    cloudLayer = null;
    if (cloudTimer) { clearInterval(cloudTimer); cloudTimer = null; }
  }
  // ===== OceanExpert 机构/专家名录（海纳后端代理） =====
  var expertMarkers = [];
  var expertData = null;          // 聚合数据 {institutes:[],experts:[]}
  var expertCurrentCountry = null;
  var expertCurrentType = "institutions";  // 默认显示机构
  var expertPage = 1;
  var expertPageCount = 1;
  var expertPanelEl = document.getElementById("expertPanel");
  var expertPanelTitle = document.getElementById("expertPanelTitle");
  var expertPanelSub = document.getElementById("expertPanelSub");
  var expertPanelList = document.getElementById("expertPanelList");
  var expertPanelPager = document.getElementById("expertPanelPager");

  function clearExpert() {
    expertMarkers.forEach(function (m) { if (m._map) map.removeLayer(m); });
    expertMarkers = [];
    if (expertPanelEl) expertPanelEl.classList.add("hidden");
    expertCurrentCountry = null;
    expertPage = 1;
  }
  // 加载聚合数据，画国家圆点（机构=绿、专家=橙，模仿官网）
  function loadExpertMarkers() {
    clearExpert();
    if (expertPanelEl) expertPanelEl.classList.remove("hidden");
    fetch("/api/ocean-expert/agg")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        expertData = data;
        if (!data || (!data.institutes && !data.experts)) {
          if (expertPanelList) expertPanelList.innerHTML = '<p class="expert-panel-empty">数据加载失败，请稍后重试</p>';
          return;
        }
        // 按当前选中的类型画标记（默认机构，用户可在面板切换）
        renderExpertMarkers(expertCurrentType === "experts" ? data.experts : data.institutes, expertCurrentType);
        if (expertPanelTitle) expertPanelTitle.textContent = "OceanExpert 名录";
        if (expertPanelSub) expertPanelSub.textContent = "点击地图上的国家圆点，查看该国海洋机构/专家";
      })
      .catch(function (e) {
        console.warn("OceanExpert 聚合数据失败", e);
        if (expertPanelList) expertPanelList.innerHTML = '<p class="expert-panel-empty">数据加载失败，请稍后重试</p>';
      });
  }
  // 在地图上画一批国家聚合标记
  function renderExpertMarkers(items, type) {
    if (!items || !items.length) return;
    items.forEach(function (it) {
      if (!it.count || !it.latitude || !it.longitude) return;
      var color = type === "experts" ? "#ff7043" : "#66bb6a";
      var label = it.count >= 1000 ? (it.count / 1000).toFixed(1) + "k"
                 : it.count >= 100 ? Math.round(it.count / 10) * 10
                 : it.count;
      var marker = L.circleMarker([it.latitude, it.longitude], {
        radius: 8 + Math.min(10, Math.log10(it.count + 1) * 3),
        color: color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 1,
        opacity: 0.9,
      });
      marker.bindTooltip(it.count + " " + it.country, { direction: "top", offset: [0, -6] });
      marker.on("click", function () {
        expertCurrentCountry = it.country;
        expertCurrentType = type;
        expertPage = 1;
        showCountryDetail(it.country, type, 1);
      });
      marker.addTo(map);
      expertMarkers.push(marker);
    });
  }
  // 拉取某国详情并渲染到侧边面板
  function showCountryDetail(country, type, page) {
    if (!expertPanelList) return;
    expertPanelList.innerHTML = '<p class="expert-panel-empty">加载中…</p>';
    if (expertPanelTitle) expertPanelTitle.textContent = country;
    if (expertPanelSub) expertPanelSub.textContent = type === "experts" ? "专家名录" : "机构名录";
    fetch("/api/ocean-expert/country?country=" + encodeURIComponent(country) + "&type=" + type + "&page=" + page)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          expertPanelList.innerHTML = '<p class="expert-panel-empty">' + (data.error || "加载失败") + '</p>';
          return;
        }
        expertPage = data.page || 1;
        expertPageCount = data.pageCount || 1;
        renderExpertList(data.items, type);
        renderExpertPager();
      })
      .catch(function (e) {
        console.warn("国家详情失败", e);
        expertPanelList.innerHTML = '<p class="expert-panel-empty">加载失败，请稍后重试</p>';
      });
  }
  function renderExpertList(items, type) {
    if (!expertPanelList) return;
    if (!items || !items.length) {
      expertPanelList.innerHTML = '<p class="expert-panel-empty">暂无数据</p>';
      return;
    }
    var html = "";
    items.forEach(function (it) {
      if (type === "experts") {
        var name = it.name || "";
        var job = it.jobtitle || "";
        var inst = it.inst_name || "";
        var city = it.city || "";
        var eid = it.id_ind || "";
        html += '<div class="expert-item expert-item-clickable" data-type="expert" data-id="' + escapeHtml(eid) + '">'
          + '<div class="expert-item-name">' + escapeHtml(name) + '</div>'
          + (job ? '<div class="expert-item-job">' + escapeHtml(job) + '</div>' : '')
          + (inst ? '<div class="expert-item-inst">' + escapeHtml(inst) + '</div>' : '')
          + (city ? '<div class="expert-item-city">' + escapeHtml(city) + '</div>' : '')
          + '<div class="expert-item-more">查看详情 ›</div>'
          + '</div>';
      } else {
        var iname = it.inst_name || "";
        var ieng = it.inst_name_eng || "";
        var icity = it.instCity || "";
        var itype = it.instType || "";
        var iid = it.id_inst || "";
        html += '<div class="expert-item expert-item-clickable" data-type="institute" data-id="' + escapeHtml(iid) + '">'
          + '<div class="expert-item-name">' + escapeHtml(iname) + '</div>'
          + (ieng && ieng !== iname ? '<div class="expert-item-inst">' + escapeHtml(ieng) + '</div>' : '')
          + '<div class="expert-item-city">' + escapeHtml([itype, icity].filter(Boolean).join(" · ")) + '</div>'
          + '<div class="expert-item-more">查看详情 ›</div>'
          + '</div>';
      }
    });
    expertPanelList.innerHTML = html;
  }
  // 列表项点击 → 拉详情 → 面板内展开
  function showExpertDetail(type, id) {
    if (!expertPanelList) return;
    expertPanelList.innerHTML = '<p class="expert-panel-empty">加载中…</p>';
    fetch("/api/ocean-expert/detail?type=" + type + "&id=" + encodeURIComponent(id))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) {
          expertPanelList.innerHTML = '<p class="expert-panel-empty">' + (d.error || "加载失败") + '</p>';
          return;
        }
        renderExpertDetail(d, type);
      })
      .catch(function (e) {
        console.warn("详情失败", e);
        expertPanelList.innerHTML = '<p class="expert-panel-empty">加载失败，请稍后重试</p>';
      });
  }
  function renderExpertDetail(d, type) {
    if (!expertPanelList) return;
    var html = '<div class="expert-detail">'
      + '<div class="expert-detail-back" id="expertDetailBack">‹ 返回列表</div>';
    if (type === "expert") {
      html += '<div class="expert-detail-name">' + escapeHtml(d.name || "") + '</div>'
        + (d.jobtitle ? '<div class="expert-detail-row"><span class="ed-label">职称</span>' + escapeHtml(d.jobtitle) + '</div>' : '')
        + (d.degree ? '<div class="expert-detail-row"><span class="ed-label">学位</span>' + escapeHtml(d.degree) + '</div>' : '')
        + (d.institution ? '<div class="expert-detail-row"><span class="ed-label">机构</span>' + escapeHtml(d.institution) + '</div>' : '')
        + (d.dept ? '<div class="expert-detail-row"><span class="ed-label">部门</span>' + escapeHtml(d.dept) + '</div>' : '')
        + (d.researcharea ? '<div class="expert-detail-row"><span class="ed-label">研究领域</span>' + escapeHtml(d.researcharea) + '</div>' : '')
        + (d.studyregion ? '<div class="expert-detail-row"><span class="ed-label">研究海区</span>' + escapeHtml(d.studyregion) + '</div>' : '')
        + (d.skills ? '<div class="expert-detail-row"><span class="ed-label">技能</span>' + escapeHtml(d.skills) + '</div>' : '')
        + (d.languages ? '<div class="expert-detail-row"><span class="ed-label">语言</span>' + escapeHtml(d.languages) + '</div>' : '')
        + (d.city ? '<div class="expert-detail-row"><span class="ed-label">城市</span>' + escapeHtml(d.city) + '</div>' : '')
        + (d.country ? '<div class="expert-detail-row"><span class="ed-label">国家</span>' + escapeHtml(d.country) + '</div>' : '')
        + (d.nationality ? '<div class="expert-detail-row"><span class="ed-label">国籍</span>' + escapeHtml(d.nationality) + '</div>' : '')
        + (d.orcid ? '<div class="expert-detail-row"><span class="ed-label">ORCID</span><a href="https://orcid.org/' + escapeHtml(d.orcid) + '" target="_blank" rel="noopener">' + escapeHtml(d.orcid) + '</a></div>' : '')
        + (d.researchgate ? '<div class="expert-detail-row"><span class="ed-label">ResearchGate</span><a href="' + escapeHtml(d.researchgate) + '" target="_blank" rel="noopener">' + escapeHtml(d.researchgate) + '</a></div>' : '')
        + (d.google_scholar ? '<div class="expert-detail-row"><span class="ed-label">Google Scholar</span><a href="' + escapeHtml(d.google_scholar) + '" target="_blank" rel="noopener">' + escapeHtml(d.google_scholar) + '</a></div>' : '');
    } else {
      html += '<div class="expert-detail-name">' + escapeHtml(d.inst_name || "") + '</div>'
        + (d.inst_name_eng && d.inst_name_eng !== d.inst_name ? '<div class="expert-detail-row"><span class="ed-label">英文名</span>' + escapeHtml(d.inst_name_eng) + '</div>' : '')
        + (d.inst_type ? '<div class="expert-detail-row"><span class="ed-label">类型</span>' + escapeHtml(d.inst_type) + '</div>' : '')
        + (d.country ? '<div class="expert-detail-row"><span class="ed-label">国家</span>' + escapeHtml(d.country) + '</div>' : '')
        + (d.city ? '<div class="expert-detail-row"><span class="ed-label">城市</span>' + escapeHtml(d.city) + '</div>' : '')
        + (d.inst_address ? '<div class="expert-detail-row"><span class="ed-label">地址</span>' + escapeHtml(d.inst_address) + '</div>' : '')
        + (d.activities ? '<div class="expert-detail-row"><span class="ed-label">简介</span>' + escapeHtml(d.activities) + '</div>' : '')
        + (d.members && d.members.length ? '<div class="expert-detail-members"><span class="ed-label">成员（' + d.members.length + '）</span>' + d.members.map(function (m) { return '<div class="expert-detail-member">' + escapeHtml(m.name) + '</div>'; }).join("") + '</div>' : '');
    }
    html += '<div class="expert-detail-src">数据来源：<a href="https://oceanexpert.org/" target="_blank" rel="noopener">UNESCO/IOC OceanExpert</a> · 仅供参考</div>';
    html += '</div>';
    expertPanelList.innerHTML = html;
    var back = document.getElementById("expertDetailBack");
    if (back) back.addEventListener("click", function () {
      if (expertCurrentCountry) showCountryDetail(expertCurrentCountry, expertCurrentType, expertPage);
    });
  }
  function renderExpertPager() {
    if (!expertPanelPager) return;
    if (expertPageCount <= 1) { expertPanelPager.innerHTML = ""; return; }
    var html = '<button class="expert-pager-btn" data-page="' + (expertPage - 1) + '"' + (expertPage <= 1 ? ' disabled' : '') + '>上一页</button>'
      + '<span class="expert-pager-info">' + expertPage + ' / ' + expertPageCount + '</span>'
      + '<button class="expert-pager-btn" data-page="' + (expertPage + 1) + '"' + (expertPage >= expertPageCount ? ' disabled' : '') + '>下一页</button>';
    expertPanelPager.innerHTML = html;
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // 机构面板关闭 + 分页事件
  if (document.getElementById("expertPanelClose")) {
    document.getElementById("expertPanelClose").addEventListener("click", function () {
      if (expertPanelEl) expertPanelEl.classList.add("hidden");
    });
  }
  if (expertPanelPager) {
    expertPanelPager.addEventListener("click", function (e) {
      var btn = e.target.closest(".expert-pager-btn");
      if (!btn || btn.disabled) return;
      var page = parseInt(btn.getAttribute("data-page"), 10);
      if (expertCurrentCountry && page >= 1) {
        showCountryDetail(expertCurrentCountry, expertCurrentType, page);
      }
    });
  }
  // 列表项点击 → 展开详情（事件委托）
  if (expertPanelList) {
    expertPanelList.addEventListener("click", function (e) {
      var item = e.target.closest(".expert-item-clickable");
      if (!item) return;
      var type = item.getAttribute("data-type");
      var id = item.getAttribute("data-id");
      if (type && id) showExpertDetail(type, id);
    });
  }
  // 面板 tab 切换（机构/专家）：重画标记 + 清列表
  document.querySelectorAll(".expert-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var etype = tab.getAttribute("data-etype");
      if (etype === expertCurrentType) return;
      expertCurrentType = etype;
      document.querySelectorAll(".expert-tab").forEach(function (t) {
        t.classList.toggle("active", t.getAttribute("data-etype") === etype);
      });
      // 重画标记
      expertMarkers.forEach(function (m) { if (m._map) map.removeLayer(m); });
      expertMarkers = [];
      if (expertData) {
        renderExpertMarkers(etype === "experts" ? expertData.experts : expertData.institutes, etype);
      }
      // 清列表，提示重新点击
      if (expertPanelList) expertPanelList.innerHTML = '<p class="expert-panel-empty">点击地图上的国家圆点查看</p>';
      if (expertPanelPager) expertPanelPager.innerHTML = "";
      if (expertPanelTitle) expertPanelTitle.textContent = "OceanExpert 名录";
      if (expertPanelSub) expertPanelSub.textContent = etype === "experts" ? "专家名录" : "机构名录";
      expertCurrentCountry = null;
    });
  });
  // 机构模式搜索国家（联想 + 定位）
  var expertSearch = document.getElementById("expertSearch");
  var expertSuggest = document.getElementById("expertSuggest");
  // 从聚合数据拿所有国家（含经纬度）
  function allExpertCountries() {
    var list = [];
    var src = expertCurrentType === "experts" ? (expertData && expertData.experts) : (expertData && expertData.institutes);
    if (src) {
      src.forEach(function (c) {
        if (c && c.country) list.push(c);
      });
    }
    return list;
  }
  function showExpertSuggest(q) {
    if (!expertSuggest) return;
    if (!q) { expertSuggest.style.display = "none"; return; }
    var lower = q.toLowerCase();
    var matched = allExpertCountries().filter(function (c) { return c.country.toLowerCase().indexOf(lower) >= 0; }).slice(0, 8);
    if (!matched.length) { expertSuggest.style.display = "none"; return; }
    var html = matched.map(function (c) {
      return '<div class="expert-suggest-item" data-country="' + esc(c.country) + '">' + esc(c.country) + ' <span class="expert-suggest-sub">' + c.count + ' 条</span></div>';
    }).join("");
    expertSuggest.innerHTML = html;
    expertSuggest.style.display = "block";
    expertSuggest.querySelectorAll(".expert-suggest-item").forEach(function (item) {
      item.addEventListener("click", function () {
        var country = item.getAttribute("data-country");
        expertSuggest.style.display = "none";
        if (expertSearch) expertSearch.value = country;
        // 定位到该国标记 + 显示详情
        locateExpertCountry(country);
      });
    });
  }
  // 定位到某国标记 + 显示详情
  function locateExpertCountry(country) {
    var found = allExpertCountries().find(function (c) { return c.country === country; });
    if (!found) return;
    map.setView([found.latitude, found.longitude], 5);
    // 触发该标记的点击（显示详情）
    expertMarkers.forEach(function (m) {
      var ll = m.getLatLng();
      if (Math.abs(ll.lat - found.latitude) < 0.5 && Math.abs(ll.lng - found.longitude) < 0.5) {
        m.fire("click");
      }
    });
  }
  if (expertSearch) {
    expertSearch.addEventListener("input", function () { showExpertSuggest(expertSearch.value.trim()); });
    expertSearch.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var q = expertSearch.value.trim();
        if (!q) return;
        var matched = allExpertCountries().filter(function (c) { return c.country.toLowerCase().indexOf(q.toLowerCase()) >= 0; });
        if (matched.length) {
          expertSuggest.style.display = "none";
          locateExpertCountry(matched[0].country);
        } else {
          alert("未找到国家「" + q + "」，试试 China、Japan、USA 等");
        }
      }
      if (e.key === "Escape") expertSuggest.style.display = "none";
    });
    expertSearch.addEventListener("blur", function () {
      setTimeout(function () { expertSuggest.style.display = "none"; }, 200);
    });
  }
  function loadCloud() {
    clearCloud();
    if (cloudTimeline) cloudTimeline.classList.remove("hidden");
    fetch("/api/nsmc-cloud-time")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok || !data.times || !data.times.length) { console.warn("云图时间获取失败", data); return; }
        cloudTimes = data.times;
        if (cloudRange) {
          cloudRange.min = 0;
          cloudRange.max = cloudTimes.length - 1;
          cloudRange.value = cloudTimes.length - 1;
        }
        showCloudFrame(cloudTimes.length - 1);
      })
      .catch(function (e) { console.warn("云图时间失败", e); });
  }
  function showCloudFrame(idx) {
    if (!cloudTimes.length) return;
    var dt = cloudTimes[idx];
    if (!dt) return;
    if (cloudLayer && cloudLayer._map) map.removeLayer(cloudLayer);
    // GetMap 返回全球图（bbox 参数未生效），imageOverlay 用全球 bounds
    var bounds = L.latLngBounds([-90, -180], [90, 180]);
    cloudLayer = L.imageOverlay("/api/nsmc-cloud?datetime=" + dt, bounds, { opacity: 0.8, interactive: false }).addTo(map);
    if (cloudInfo) {
      var ds = dt.slice(0, 8), ts = dt.slice(8, 12);
      cloudInfo.innerHTML = '<div class="tt-time">' + ds + ' ' + ts.slice(0, 2) + ':' + ts.slice(2, 4) + ' (北京时)</div>';
    }
  }
  if (cloudRange) {
    cloudRange.addEventListener("input", function () {
      showCloudFrame(parseInt(cloudRange.value, 10));
    });
  }
  function typhoonPopupHtml(typhoon, tpId) {
    var rt = typhoon.rtPoints || [];
    var last = rt.length ? rt[rt.length - 1] : null;
    var gradeMap = { TD: "热带低压", TS: "热带风暴", STS: "强热带风暴", TY: "台风", STY: "强台风", SuperTY: "超强台风" };
    var grade = last ? (gradeMap[last.grade] || last.grade) : "";
    return '<div class="typhoon-popup">' +
      '<div class="tp-name">' + (typhoon.name || "") + ' <span class="tp-en">' + (typhoon.enName || "") + '</span></div>' +
      (grade ? '<div class="tp-row">等级：' + grade + '</div>' : '') +
      (last ? '<div class="tp-row">风速：' + last.windSpeed + ' m/s（' + last.windLevel + '级）</div>' : '') +
      (last ? '<div class="tp-row">气压：' + last.centerPrs + ' hPa</div>' : '') +
      (last ? '<div class="tp-row">移动：' + last.moveDir + ' ' + last.moveSpeed + ' km/h</div>' : '') +
      (last ? '<div class="tp-row">时间：' + last.data_time + '</div>' : '') +
      (last ? '<div class="tp-row">7级风圈：' + last.radius_7 + ' km</div>' : '') +
      (last ? '<div class="tp-row">10级风圈：' + last.radius_10 + ' km</div>' : '') +
      (last ? '<div class="tp-row">12级风圈：' + last.radius_12 + ' km</div>' : '') +
    '</div>';
  }
  // 年份下拉事件：选年份加载该年台风
  if (typhoonYearSelect) {
    typhoonYearSelect.addEventListener("change", function () {
      loadTyphoonList();
    });
  }
  // 台风列表勾选事件（事件委托）：勾选显示路径，取消隐藏
  if (typhoonListEl) {
    typhoonListEl.addEventListener("change", function (e) {
      var cb = e.target;
      if (!cb.classList.contains("typhoon-cb")) return;
      var tpId = cb.getAttribute("data-tpid");
      var name = cb.getAttribute("data-name");
      if (cb.checked) {
        showTyphoonPath(tpId, name);
      } else {
        // 取消：移除该台风路径 + 标记
        var color = typhoonSelected[tpId] ? typhoonSelected[tpId].color : null;
        typhoonPaths.forEach(function (l) { if (l._map) map.removeLayer(l); });
        typhoonMarkers.forEach(function (m) { if (m._map) map.removeLayer(m); });
        typhoonPaths = [];
        typhoonMarkers = [];
        delete typhoonSelected[tpId];
        // 重新显示其他勾选的台风
        Object.keys(typhoonSelected).forEach(function (id) {
          showTyphoonPath(id, typhoonSelected[id].name);
        });
      }
    });
  }
  // 盐度/流速时间滑块事件（复用 sstTimeRange）
  if (sstTimeRange && !sstTimeRange._starBound) {
    sstTimeRange._starBound = true;
    sstTimeRange.addEventListener("input", function () {
      var ts = sstTimeStr(parseInt(sstTimeRange.value, 10));
      if (currentMode === "sss") loadSssLayer(ts);
      else if (currentMode === "current") loadCurrentLayer(ts);
    });
  }

  // ========== 叶绿素（Chlorophyll-a）图层（NOAA ERDDAP，全球 4km 日合成无缝）==========
  var chlLayer = null;
  var chlTimeSelect = document.getElementById("chlTimeSelect");
  // 填充叶绿素日期选项（NOAA 日合成约 1-2 天延迟 + 云遮挡，默认往前 4 天确保中国海有数据，往前 20 天）
  function initChlDates() {
    if (!chlTimeSelect) return;
    var today = new Date();
    for (var i = 4; i <= 20; i++) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      var ds = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      var opt = document.createElement("option");
      opt.value = ds;
      opt.textContent = ds;
      chlTimeSelect.appendChild(opt);
    }
    chlTimeSelect.value = chlTimeSelect.options[0].value;  // 默认往前 4 天（中国海大概率有数据）
  }
  function loadChlLayer(date) {
    if (chlLayer && chlLayer._map) map.removeLayer(chlLayer);
    var perf = window.PerfMode ? window.PerfMode.getMode() : "quality";
    if (perf === "lite") { return; }
    var ds = date || (chlTimeSelect ? chlTimeSelect.value : null);
    if (!ds) return;
    // 显示加载提示（瓦片加载完隐藏，避免用户以为出 bug）
    var chlLoading = document.getElementById("chlLoading");
    if (chlLoading) { chlLoading.classList.remove("hidden"); }
    // 超时兜底：15 秒后强制隐藏（避免瓦片加载失败时一直转圈）
    if (chlLoading) {
      clearTimeout(chlLoading._timer);
      chlLoading._timer = setTimeout(function () { chlLoading.classList.add("hidden"); }, 15000);
    }
    // 走后端代理（NOAA ERDDAP 未开 CORS，浏览器直接请求被拦截）
    // 用默认 EPSG3857（Web Mercator），Leaflet 正常计算瓦片发请求；后端 chl.py 把 bbox 转成 EPSG4326
    // 不加 _t 随机参数：让瓦片 URL 稳定，CDN/浏览器能缓存，刷新快（每次重新拉 ERDDAP 很慢）
    chlLayer = L.tileLayer.wms("/api/chl-wms", {
      layers: "erdMH1chla1day_R2022NRT:chlorophyll",
      format: "image/png",
      transparent: true,
      time: ds + "T12:00:00Z",
      maxZoom: 10,
      opacity: 0.8,
      attribution: "NOAA CoastWatch",
    });
    // 瓦片加载完隐藏 loading（load 事件 = 当前瓦片全部加载完）
    chlLayer.on("load", function () {
      if (chlLoading) {
        clearTimeout(chlLoading._timer);
        chlLoading.classList.add("hidden");
      }
    });
    chlLayer.addTo(map);
  }
  var bathyLoadingTimer = null;
  function loadBathyLayer() {
    if (bathyLayer && bathyLayer._map) map.removeLayer(bathyLayer);
    var perf = window.PerfMode ? window.PerfMode.getMode() : "quality";
    if (perf === "lite") { return; }
    // 显示加载提示（瓦片加载完隐藏，避免用户以为出 bug）
    var bathyLoading = document.getElementById("bathyLoading");
    if (bathyLoading) { bathyLoading.classList.remove("hidden"); }
    if (bathyLoading) {
      clearTimeout(bathyLoadingTimer);
      bathyLoadingTimer = setTimeout(function () { bathyLoading.classList.add("hidden"); }, 6000);
    }
    // 走后端代理（NOAA ERDDAP 未开 CORS，浏览器直接请求被拦截）
    // 用默认 EPSG3857（Web Mercator），Leaflet 正常计算瓦片发请求；后端 bathymetry.py 把 bbox 转成 EPSG4326
    // 不加 _t 随机参数：让瓦片 URL 稳定，CDN/浏览器能缓存，刷新快（每次重新拉 ERDDAP 很慢）
    bathyLayer = L.tileLayer.wms("/api/ocean-bathy", {
      layers: "ETOPO_2022_v1_60s:z",
      format: "image/png",
      transparent: true,
      maxZoom: 10,
      opacity: 0.85,
      attribution: "NOAA NCEI ETOPO 2022",
    });
    bathyLayer.on("load", function () {
      if (bathyLoading) {
        clearTimeout(bathyLoadingTimer);
        bathyLoading.classList.add("hidden");
      }
    });
    bathyLayer.addTo(map);
  }
  // ============ 海洋生物图鉴（WoRMS + Wikimedia + OBIS） ============
  var speciesData = null;  // 物种列表缓存
  var speciesLoaded = false;
  var speciesCurDetail = null;  // 当前查看详情的物种
  function loadSpeciesMode() {
    if (speciesLoaded && speciesData) {
      renderSpeciesList(speciesData);
      return;
    }
    var listEl = document.getElementById("speciesList");
    if (listEl) { listEl.innerHTML = '<p class="species-loading">加载中…</p>'; }
    fetch("/api/species/list").then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) { if (listEl) listEl.innerHTML = '<p class="species-loading">加载失败</p>'; return; }
      speciesData = d.species;
      speciesLoaded = true;
      renderSpeciesList(speciesData);
    }).catch(function () {
      if (listEl) listEl.innerHTML = '<p class="species-loading">加载失败，请重试</p>';
    });
  }
  function renderSpeciesList(list) {
    var listEl = document.getElementById("speciesList");
    if (!listEl) return;
    var q = (document.getElementById("speciesSearch") ? document.getElementById("speciesSearch").value : "").trim().toLowerCase();
    var filtered = list;
    if (q) {
      filtered = list.filter(function (s) {
        return (s.scientificname || "").toLowerCase().indexOf(q) >= 0 ||
               (s.cn_name || "").indexOf(q) >= 0 ||
               (s.phylum || "").toLowerCase().indexOf(q) >= 0 ||
               (s.class || "").toLowerCase().indexOf(q) >= 0 ||
               (s.family || "").toLowerCase().indexOf(q) >= 0;
      });
    }
    if (!filtered.length) { listEl.innerHTML = '<p class="species-loading">未找到匹配物种</p>'; return; }
    // 按门类分组渲染（简化：直接列表）
    var html = filtered.map(function (s) {
      var img = s.image_url ? '<img class="species-card-img" loading="lazy" src="' + esc(s.image_url) + '" alt="' + esc(s.scientificname) + '">' : '<div class="species-card-img species-card-img-empty">无图</div>';
      var nameHtml = s.cn_name ? '<div class="species-card-name">' + esc(s.cn_name) + '<span class="species-card-sci">' + esc(s.scientificname) + '</span></div>' : '<div class="species-card-name">' + esc(s.scientificname) + '</div>';
      return '<div class="species-card" data-id="' + s.id + '">' +
        img +
        '<div class="species-card-body">' +
        nameHtml +
        '<div class="species-card-tax">' + esc(s.phylum || "") + (s.class ? ' / ' + esc(s.class) : '') + '</div>' +
        '<div class="species-card-obis">OBIS 记录：' + (s.obis_total || 0) + '</div>' +
        '</div></div>';
    }).join("");
    listEl.innerHTML = html;
  }
  // 物种详情（点击卡片 → 弹窗显示）
  function showSpeciesDetail(id) {
    var detailEl = document.getElementById("speciesDetail");
    var bodyEl = document.getElementById("speciesDetailBody");
    if (!detailEl || !bodyEl) return;
    fetch("/api/species/" + id).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) return;
      var s = d.species;
      speciesCurDetail = s;
      var img = s.image_url ? '<img class="species-detail-img" src="' + esc(s.image_url) + '" alt="' + esc(s.scientificname) + '">' : '';
      var tax = [];
      if (s.kingdom) tax.push(['界', s.kingdom]);
      if (s.phylum) tax.push(['门', s.phylum]);
      if (s.class) tax.push(['纲', s.class]);
      if (s.ordr) tax.push(['目', s.ordr]);
      if (s.family) tax.push(['科', s.family]);
      if (s.genus) tax.push(['属', s.genus]);
      var taxHtml = tax.map(function (t) { return '<div class="species-tax-row"><span class="species-tax-label">' + t[0] + '</span><span>' + esc(t[1]) + '</span></div>'; }).join("");
      bodyEl.innerHTML =
        '<div class="species-detail-head">' +
        '<div class="species-detail-name">' + esc(s.cn_name || s.scientificname) + '</div>' +
        '<div class="species-detail-authority">' + esc(s.scientificname) + (s.authority ? ' · ' + esc(s.authority) : '') + '</div>' +
        '</div>' +
        img +
        '<div class="species-detail-tax">' + taxHtml + '</div>' +
        (s.license ? '<div class="species-detail-license">图片授权：' + esc(s.license) + (s.artist ? ' · 作者：' + esc(s.artist) : '') + '</div>' : '') +
        '<div class="species-detail-obis">OBIS 分布记录：' + (s.obis_total || 0) + ' 条</div>' +
        '<button class="species-detail-dist" id="speciesDistBtn">在地图上查看分布</button>';
      detailEl.classList.remove("hidden");
      var distBtn = document.getElementById("speciesDistBtn");
      if (distBtn) distBtn.addEventListener("click", function () { showSpeciesDistribution(s.id); });
    });
  }
  // 关闭物种详情弹窗
  var speciesDetailClose = document.getElementById("speciesDetailClose");
  if (speciesDetailClose) speciesDetailClose.addEventListener("click", function () {
    document.getElementById("speciesDetail").classList.add("hidden");
    speciesCurDetail = null;
  });
  // 物种分布（在地图上画点）
  function showSpeciesDistribution(id) {
    var s = speciesCurDetail;
    if (!s) return;
    // 显示加载提示（OBIS 查询约 5s，避免用户以为卡死）
    var fs = document.getElementById("flowSource");
    fs.classList.remove("hidden");
    fs.innerHTML = '正在加载 <span class="species-loading-text">' + esc(s.cn_name || s.scientificname) + '</span> 的分布…';
    fetch("/api/species/" + id + "/distribution").then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) {
        fs.innerHTML = '分布数据加载失败，请稍后重试';
        return;
      }
      // 清掉地图上的标记
      map.eachLayer(function (layer) {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });
      var points = d.points || [];
      if (!points.length) { fs.innerHTML = '分布数据：该物种暂无分布记录'; return; }
      var latlngs = points.map(function (p) { return [p[0], p[1]]; });
      // 用 circleMarker 画分布点（性能好）
      var layer = L.layerGroup();
      latlngs.forEach(function (ll) {
        L.circleMarker(ll, { radius: 3, color: "#0A5A7A", fillColor: "#2FD4DA", fillOpacity: 0.6, weight: 1 }).addTo(layer);
      });
      layer.addTo(map);
      // 缩放到分布范围
      map.fitBounds(L.latLngBounds(latlngs).pad(0.1));
      // 显示物种名提示
      fs.innerHTML = '分布数据：<a href="https://obis.org/" target="_blank" rel="noopener">OBIS</a>（' + esc(s.cn_name || s.scientificname) + '，' + (d.total || 0) + ' 条记录）· 仅供参考';
    }).catch(function () {
      fs.innerHTML = '分布数据加载失败，请稍后重试';
    });
  }
  // 物种图鉴面板事件绑定（关闭/搜索/卡片点击事件委托）
  var speciesClose = document.getElementById("speciesPanelClose");
  if (speciesClose) speciesClose.addEventListener("click", function () {
    document.getElementById("speciesPanel").classList.add("hidden");
  });
  var speciesSearch = document.getElementById("speciesSearch");
  if (speciesSearch) speciesSearch.addEventListener("input", function () {
    if (speciesData) renderSpeciesList(speciesData);
  });
  var speciesList = document.getElementById("speciesList");
  if (speciesList) speciesList.addEventListener("click", function (e) {
    var card = e.target.closest ? e.target.closest(".species-card") : null;
    if (card) showSpeciesDetail(parseInt(card.getAttribute("data-id"), 10));
  });
  if (chlTimeSelect) {
    initChlDates();
    chlTimeSelect.addEventListener("change", function () {
      loadChlLayer(chlTimeSelect.value);
    });
  }
  var tideSearch = document.getElementById("tideSearch");
  var tideSuggest = document.getElementById("tideSuggest");
  function allPorts() {
    var byProv = window.__tideByProv || {};
    var list = [];
    Object.keys(byProv).forEach(function (prov) {
      byProv[prov].ports.forEach(function (p) { list.push(p); });
    });
    return list;
  }
  function showSuggest(q) {
    if (!tideSuggest) return;
    if (!q) { tideSuggest.style.display = "none"; return; }
    var ports = allPorts().filter(function (p) { return p.name.indexOf(q) >= 0; }).slice(0, 8);
    if (!ports.length) { tideSuggest.style.display = "none"; return; }
    var html = ports.map(function (p) {
      return '<div class="tide-suggest-item" data-id="' + p.id + '">' + esc(p.name) + ' <span class="tide-suggest-sub">' + esc(p.province) + '</span></div>';
    }).join("");
    tideSuggest.innerHTML = html;
    tideSuggest.style.display = "block";
    tideSuggest.querySelectorAll(".tide-suggest-item").forEach(function (item) {
      item.addEventListener("click", function () {
        var id = item.getAttribute("data-id");
        var port = allPorts().find(function (p) { return p.id === id; });
        if (port) {
          tideSuggest.style.display = "none";
          tideSearch.value = port.name;
          map.setView([port.lat, port.lon], 9);
          showTide(port);
        }
      });
    });
  }
  if (tideSearch) {
    tideSearch.addEventListener("input", function () { showSuggest(tideSearch.value.trim()); });
    tideSearch.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var q = tideSearch.value.trim();
        if (!q) return;
        var ports = allPorts().filter(function (p) { return p.name.indexOf(q) >= 0; });
        if (ports.length) {
          var port = ports[0];
          tideSuggest.style.display = "none";
          map.setView([port.lat, port.lon], 9);
          showTide(port);
        } else {
          alert("未找到港口「" + q + "」，试试塘沽、青岛、大连等");
        }
      }
      if (e.key === "Escape") tideSuggest.style.display = "none";
    });
    tideSearch.addEventListener("blur", function () {
      setTimeout(function () { tideSuggest.style.display = "none"; }, 200);
    });
  }
  function showTidePorts(prov) {
    var byProv = window.__tideByProv || {};
    var ports = byProv[prov] ? byProv[prov].ports : [];
    ports.forEach(function (p) {
      var m = L.marker([p.lat, p.lon], { icon: tideIcon() }).addTo(map);
      m.bindTooltip(p.name, { direction: "top", offset: [0, -8] });  // 悬停显示港口名
      m.on("click", function () { showTide(p); });
    });
  }
  function showTide(port) {
    var detail = document.getElementById("detail");
    if (!detail) return;
    detail.classList.remove("hidden");
    detail.innerHTML =
      '<button class="detail-close" onclick="window.closeDetailCard()">×</button>' +
      '<div class="tide-loading">正在打捞 ' + esc(port.name) + ' 的潮汐……</div>';
    fetch("/api/tide?portId=" + encodeURIComponent(port.id))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        renderTide(detail, port, data);
      })
      .catch(function () {
        detail.innerHTML = '<button class="detail-close" onclick="window.closeDetailCard()">×</button><div class="tide-error">潮汐数据加载失败</div>';
      });
  }
  function renderTide(detail, port, data) {
    if (!data || !data.result) {
      detail.innerHTML = '<button class="detail-close" onclick="window.closeDetailCard()">×</button><div class="tide-error">潮汐数据加载失败</div>';
      return;
    }
    var r = data.result;
    var datas = r.datas || [];
    if (!datas.length) {
      detail.innerHTML = '<button class="detail-close" onclick="window.closeDetailCard()">×</button><div class="tide-error">暂无潮汐数据</div>';
      return;
    }
    // 生成某天的涨退潮表 HTML
    function dayHtml(day) {
      var tides = day.tides || {};
      var times = tides.times || [], types = tides.tideTypes || [], heights = tides.heights || [];
      var ranges = tides.ranges || [];
      var det = day.details || {};
      var detTimes = det.times || [], detHeights = det.heights || [], detRates = det.tideRate || [];
      // 根据时间找几分潮（details 里对应时刻的 tideRate）
      function rateAt(t) {
        var hhmm = (t || "").slice(11, 16);  // "2026-08-24 03:08:00" -> "03:08"
        for (var i = 0; i < detTimes.length; i++) {
          if (detTimes[i] === hhmm) return detRates[i];
        }
        return "";
      }
      // 涨退潮表（时间/潮型/潮高/落差/几分潮）
      var rows = times.map(function (t, i) {
        var drop = "";
        if (ranges[i]) drop = Math.round(ranges[i].tideDrop || 0) + " cm";
        var rate = rateAt(t);
        var rateStr = rate !== "" ? rate + " 分" : "";
        return '<tr><td>' + esc(t) + '</td><td>' + esc(types[i] || "") + '</td><td>' + esc(heights[i] || "") + ' cm</td><td>' + drop + '</td><td>' + rateStr + '</td></tr>';
      }).join("");
      // 逐时潮高曲线（details：每10分钟，144条）
      var canvasId = "tideCurve_" + day.date.replace(/-/g, "");
      var curve = detTimes.length ? '<canvas class="tide-curve" id="' + canvasId + '" width="440" height="110"></canvas>' : "";
      return '<div class="tide-day">' +
        '<p class="tide-day-date">' + esc(day.date || "") + ' · ' + esc(day.lunarTide || "") + '</p>' +
        '<p class="tide-day-sun">日出 ' + esc(day.sunrise || "") + ' · 日落 ' + esc(day.sunset || "") + '</p>' +
        curve +
        '<table class="tide-table"><thead><tr><th>时间</th><th>潮型</th><th>潮高</th><th>落差</th><th>几分潮</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '</div>';
    }
    // 默认显示前 3 天
    var shownDays = datas.slice(0, 3).map(dayHtml).join("");
    var moreDays = datas.slice(3).map(dayHtml).join("");
    detail.innerHTML =
      '<button class="detail-close" onclick="window.closeDetailCard()">×</button>' +
      '<div class="tide-card">' +
      '<h3 class="tide-title">' + esc(port.name) + ' 潮汐</h3>' +
      '<p class="tide-sub">潮高基准面 ' + esc(r.datum || "") + 'cm</p>' +
      shownDays +
      (moreDays ? '<button class="tide-more" id="tideMore">查看全部 ' + datas.length + ' 天 ▼</button><div class="tide-more-days" id="tideMoreDays" style="display:none">' + moreDays + '</div>' : '') +
      '<p class="tide-note">数据来源：星图地球数据云（中科星图）</p>' +
      '</div>';
    var moreBtn = document.getElementById("tideMore");
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        var box = document.getElementById("tideMoreDays");
        var expanded = box.style.display !== "none";
        box.style.display = expanded ? "none" : "block";
        moreBtn.textContent = expanded ? "查看全部 " + datas.length + " 天 ▼" : "收起 ▲";
      });
    }
    // 画逐时潮高曲线
    datas.forEach(function (day) {
      var det = day.details || {};
      var times = det.times || [], heights = det.heights || [];
      if (!times.length || !heights.length) return;
      var canvasId = "tideCurve_" + day.date.replace(/-/g, "");
      var canvas = document.getElementById(canvasId);
      if (!canvas) return;
      drawTideCurve(canvas, heights, day.details.times, day.details.tideRate);
    });
  }
  function drawTideCurve(canvas, heights, times, rates) {
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    var min = Math.min.apply(null, heights);
    var max = Math.max.apply(null, heights);
    var range = (max - min) || 1;
    // 留出左边 Y 轴刻度 + 底部 X 轴时间
    var padL = 34, padR = 8, padT = 8, padB = 18;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    // 背景
    ctx.fillStyle = "rgba(10,37,64,0.06)";
    ctx.fillRect(padL, padT, plotW, plotH);
    // Y 轴刻度（潮高，3 档）
    ctx.fillStyle = "#3A5A7A";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    for (var g = 0; g <= 2; g++) {
      var val = max - range * (g / 2);
      var y = padT + plotH * (g / 2);
      ctx.fillText(Math.round(val) + "cm", padL - 4, y + 3);
      ctx.strokeStyle = "rgba(10,37,64,0.15)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
    }
    // 曲线
    ctx.beginPath();
    for (var i = 0; i < heights.length; i++) {
      var x = padL + plotW * (i / (heights.length - 1));
      var y2 = padT + plotH - plotH * ((heights[i] - min) / range);
      if (i === 0) ctx.moveTo(x, y2); else ctx.lineTo(x, y2);
    }
    ctx.strokeStyle = "#0A5A7A";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 填色
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.lineTo(padL, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = "rgba(10, 90, 122, 0.2)";
    ctx.fill();
    // X 轴时间刻度（0/6/12/18/24 点）
    ctx.fillStyle = "#3A5A7A";
    ctx.textAlign = "center";
    var timeLabels = ["00:00", "06:00", "12:00", "18:00", "24:00"];
    timeLabels.forEach(function (tl, idx) {
      var x = padL + plotW * (idx / (timeLabels.length - 1));
      ctx.fillText(tl, x, h - 4);
    });
    // 悬停交互：鼠标移到曲线位置，显示该时刻潮高/几分潮
    var tooltip = document.createElement("div");
    tooltip.className = "tide-tooltip";
    tooltip.style.display = "none";
    canvas.parentNode.appendChild(tooltip);
    canvas.addEventListener("mousemove", function (e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      // 找最近数据点
      var idx = Math.round((mx - padL) / plotW * (heights.length - 1));
      idx = Math.max(0, Math.min(heights.length - 1, idx));
      // 找到该点的像素位置
      var px = padL + plotW * (idx / (heights.length - 1));
      var py = padT + plotH - plotH * ((heights[idx] - min) / range);
      // 画悬停点
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#FF4D4F";
      ctx.fill();
      // tooltip
      var t = times && times[idx] ? times[idx] : "";
      var rate = rates && rates[idx] ? rates[idx] : "";
      tooltip.innerHTML = "<b>" + esc(t) + "</b> 潮高 <b>" + Math.round(heights[idx]) + " cm</b>" +
        (rate !== "" ? " · " + rate + " 分" : "");
      tooltip.style.display = "block";
      // tooltip 位置：默认在悬停点上方，但最高潮时（py-30 < 0）会超出顶部，改显示在下方
      var tipTop = (py - 30 < 0) ? (py + 8) : (py - 30);
      var tipLeft = px + 8;
      // 超出右侧则显示在左侧
      if (tipLeft > plotW - 20) { tipLeft = px - 8 - tooltip.offsetWidth; }
      tooltip.style.left = tipLeft + "px";
      tooltip.style.top = tipTop + "px";
    });
    canvas.addEventListener("mouseleave", function () {
      tooltip.style.display = "none";
      // 重画（去掉悬停点）
      drawTideCurve(canvas, heights, times, rates);
    });
  }
  loadTideSites();

  // ===== 登录态（公共模块 auth.js 提供） =====
  var getToken = function () { return window.HainaAuth ? window.HainaAuth.getToken() : ""; };
  var authModal = document.getElementById("authModal");
  if (window.HainaAuth) window.HainaAuth.initAuth();

  // ===== 头像上传 =====
  var avatarBtn = document.getElementById("avatarBtn");
  var avatarFileInput = document.createElement("input");
  avatarFileInput.type = "file";
  avatarFileInput.accept = "image/*";
  avatarFileInput.style.display = "none";
  document.body.appendChild(avatarFileInput);

  function updateAvatarBtn() {
    if (!avatarBtn) return;
    var name = HainaAuth ? HainaAuth.getUsername() : "";
    if (!name) { avatarBtn.style.display = "none"; return; }
    avatarBtn.style.display = "block";
    fetch("/api/auth/me", { headers: { "Authorization": "Bearer " + getToken() } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok && d.user && d.user.avatar) {
          avatarBtn.innerHTML = '<img src="' + d.user.avatar + '" class="avatar-img" alt="">';
        } else {
          avatarBtn.textContent = name.charAt(0);
        }
      })
      .catch(function () { avatarBtn.textContent = name.charAt(0); });
  }
  if (avatarBtn) {
    avatarBtn.onclick = function () { avatarFileInput.click(); };
    avatarFileInput.onchange = function () {
      var f = avatarFileInput.files[0];
      if (!f) return;
      var fd = new FormData();
      fd.append("avatar", f);
      fetch("/api/auth/avatar", { method: "POST", body: fd, headers: { "Authorization": "Bearer " + getToken() } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) { updateAvatarBtn(); }
          else { alert(d.error || "上传失败"); }
        })
        .catch(function () { alert("上传失败"); });
    };
  }
  updateAvatarBtn();
  // 登录态变化时刷新头像
  var authBtnEl = document.getElementById("authBtn");
  if (authBtnEl) {
    authBtnEl.addEventListener("click", function () { setTimeout(updateAvatarBtn, 1500); });
  }

  // ===== 省市区三级联动 =====
  var regionsData = [];
  function loadRegions() {
    fetch("/static/data/china_regions.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        regionsData = data || [];
        var prov = document.getElementById("postProv");
        if (!prov) return;
        regionsData.forEach(function (p) {
          var opt = document.createElement("option");
          opt.value = p.n; opt.textContent = p.n;
          prov.appendChild(opt);
        });
      });
  }
  function bindRegions() {
    var prov = document.getElementById("postProv");
    var city = document.getElementById("postCity");
    var dist = document.getElementById("postDistrict");
    if (!prov) return;
    prov.onchange = function () {
      var p = regionsData.find(function (x) { return x.n === prov.value; });
      city.innerHTML = '<option value="">城市</option>';
      dist.innerHTML = '<option value="">区县</option>';
      (p ? p.c : []).forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.n; opt.textContent = c.n;
        city.appendChild(opt);
      });
    };
    city.onchange = function () {
      var p = regionsData.find(function (x) { return x.n === prov.value; });
      var c = p ? p.c.find(function (x) { return x.n === city.value; }) : null;
      dist.innerHTML = '<option value="">区县</option>';
      (c ? c.c : []).forEach(function (d) {
        var opt = document.createElement("option");
        opt.value = d.n; opt.textContent = d.n;
        dist.appendChild(opt);
      });
    };
  }
  function buildAddress() {
    var parts = [
      document.getElementById("postProv").value,
      document.getElementById("postCity").value,
      document.getElementById("postDistrict").value,
      document.getElementById("postDetail").value,
    ].filter(Boolean);
    return parts.join("");
  }

  // ===== 上传弹窗 =====
  var uploadModal = document.getElementById("uploadModal");
  var postMap = null;
  var pickMarker = null;
  var pickedLat = null, pickedLng = null;

  document.getElementById("uploadOpen").onclick = function () {
    uploadModal.classList.add("open");
    if (!postMap) {
      postMap = L.map("postMap", { center: [26, 120], zoom: 5, zoomControl: true });
      // 上传定位用「带地名标注」的高德底图（无 ltype=3，显示城市名/地名，方便用户找位置）
      L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&scl=1&x={x}&y={y}&z={z}", { subdomains: "1234", maxZoom: 18, referrerPolicy: "no-referrer" }).addTo(postMap);
      postMap.on("click", function (e) {
        pickedLat = e.latlng.lat; pickedLng = e.latlng.lng;
        if (pickMarker) { pickMarker.setLatLng(e.latlng); }
        else { pickMarker = L.marker(e.latlng, { draggable: true }).addTo(postMap); }
        pickMarker.on("dragend", function () {
          var p = pickMarker.getLatLng(); pickedLat = p.lat; pickedLng = p.lng;
        });
      });
      setTimeout(function () { postMap.invalidateSize(); }, 200);
    }
  };
  document.getElementById("uploadClose").onclick = function () { uploadModal.classList.remove("open"); };

  document.getElementById("postSubmit").onclick = function () {
    var file = document.getElementById("postImage").files[0];
    if (!file) { alert("请先选择照片"); return; }
    var text = document.getElementById("postText").value;
    var address = buildAddress();
    var email = document.getElementById("postEmail").value.trim();
    var fd = new FormData();
    fd.append("image", file);
    fd.append("text", text);
    fd.append("address", address);
    if (email) fd.append("email", email);
    if (pickedLat != null && pickedLng != null) {
      fd.append("lat", pickedLat); fd.append("lng", pickedLng);
    }
    var btn = document.getElementById("postSubmit");
    btn.textContent = "投稿中……"; btn.disabled = true;
    fetch("/api/ocean/submit", { method: "POST", body: fd })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          btn.textContent = "投稿"; btn.disabled = false;
          uploadModal.classList.remove("open");
          document.getElementById("postImage").value = "";
          document.getElementById("postText").value = "";
          document.getElementById("postDetail").value = "";
          document.getElementById("postEmail").value = "";
          document.getElementById("postProv").value = "";
          document.getElementById("postCity").innerHTML = '<option value="">城市</option>';
          document.getElementById("postDistrict").innerHTML = '<option value="">区县</option>';
          if (pickMarker) { postMap.removeLayer(pickMarker); pickMarker = null; }
          pickedLat = pickedLng = null;
          alert(d.message || "投稿成功，审核通过后会刊登。");
        } else {
          alert(d.error || "投稿失败");
          btn.textContent = "投稿"; btn.disabled = false;
        }
      })
      .catch(function () { alert("投稿失败"); btn.textContent = "投稿"; btn.disabled = false; });
  };
})();

// Lightbox
window.openLightbox = function (url) {
  var lb = document.getElementById("lightbox");
  var img = document.getElementById("lightboxImg");
  if (!lb || !img) return;
  img.src = url;
  lb.classList.add("open");
};
window.closeLightbox = function () {
  var lb = document.getElementById("lightbox");
  if (lb) lb.classList.remove("open");
};
window.closeDetailCard = function () {
  var d = document.getElementById("detail");
  if (d) d.classList.add("hidden");
};
document.addEventListener("DOMContentLoaded", function () {
  var lb = document.getElementById("lightbox");
  if (!lb) return;
  lb.addEventListener("click", function (e) {
    if (e.target === lb || e.target.classList.contains("lightbox-close")) window.closeLightbox();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") window.closeLightbox(); });
});

// 多图切换：点圆点切换当前图
document.addEventListener("click", function (e) {
  var dot = e.target.closest(".photo-dot");
  if (!dot) return;
  var box = dot.closest(".ocean-photos");
  if (!box) return;
  var i = parseInt(dot.dataset.i, 10);
  box.querySelectorAll(".ocean-slide").forEach(function (s, idx) {
    s.classList.toggle("active", idx === i);
  });
  box.querySelectorAll(".photo-dot").forEach(function (d, idx) {
    d.classList.toggle("active", idx === i);
  });
});
