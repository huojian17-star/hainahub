/* 海纳 · 物种分布预测（SDM）—— 独立页，支持多物种对比（竞争释放分析） */
(function () {
  "use strict";
  var sdmMap = null;
  var pred = null;
  var response = null;
  var matrix = null;
  var currentSpecies = 'cod';
  var FEAT_NAMES = { depth: '水深', sst: '海温', chl: '叶绿素' };

  // 物种配置：数据文件 + 名称 + 热力图（动态清单，加物种只需加数据文件）
  // GCJ-02（高德火星坐标）转换：WGS-84 经纬度转 GCJ-02（高德底图用）
  function wgs2gcj(lat, lng) {
    var a = 6378245.0, ee = 0.00669342162296594323;
    function outOfChina(lat, lng) { return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271; }
    function transformLat(x, y) {
      var r = -100.0 + 2.0*x + 3.0*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
      r += (20.0*Math.sin(6.0*x*Math.PI) + 20.0*Math.sin(2.0*x*Math.PI)) * 2.0/3.0;
      r += (20.0*Math.sin(y*Math.PI) + 40.0*Math.sin(y/3.0*Math.PI)) * 2.0/3.0;
      r += (160.0*Math.sin(y/12.0*Math.PI) + 320*Math.sin(y*Math.PI/30.0)) * 2.0/3.0;
      return r;
    }
    function transformLng(x, y) {
      var r = 300.0 + x + 2.0*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
      r += (20.0*Math.sin(6.0*x*Math.PI) + 20.0*Math.sin(2.0*x*Math.PI)) * 2.0/3.0;
      r += (20.0*Math.sin(x*Math.PI) + 40.0*Math.sin(x/3.0*Math.PI)) * 2.0/3.0;
      r += (150.0*Math.sin(x/12.0*Math.PI) + 300.0*Math.sin(x/30.0*Math.PI)) * 2.0/3.0;
      return r;
    }
    if (outOfChina(lat, lng)) return [lat, lng];
    var dLat = transformLat(lng - 105.0, lat - 35.0);
    var dLng = transformLng(lng - 105.0, lat - 35.0);
    var radLat = lat / 180.0 * Math.PI;
    var magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    var sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
    return [lat + dLat, lng + dLng];
  }

  var SPECIES = {
    cod: {
      name: '大西洋鳕 · Gadus morhua',
      predUrl: '/static/data/sdm/sdm_prediction_cod_global_hi.json',
      respUrl: '/static/data/sdm/sdm_response5.json',
      heatUrl: '/static/data/sdm/sdm_heatmap_cod_global_hi_v6.png'
    },
    haddock: {
      name: '黑线鳕 · Melanogrammus aeglefinus',
      predUrl: '/static/data/sdm/sdm_prediction_haddock_global_hi.json',
      respUrl: '/static/data/sdm/sdm_response_haddock.json',
      heatUrl: '/static/data/sdm/sdm_heatmap_haddock_global_hi_v6.png'
    },
    herring: {
      name: '鲱鱼 · Clupea harengus',
      predUrl: '/static/data/sdm/sdm_prediction_herring_global_hi.json',
      respUrl: '/static/data/sdm/sdm_response_herring.json',
      heatUrl: '/static/data/sdm/sdm_heatmap_herring_global_hi_v6.png'
    },
    mackerel: {
      name: '鲭鱼 · Scomber scombrus',
      predUrl: '/static/data/sdm/sdm_prediction_mackerel_global_hi.json',
      respUrl: '/static/data/sdm/sdm_response_mackerel.json',
      heatUrl: '/static/data/sdm/sdm_heatmap_mackerel_global_hi_v6.png'
    },
    halibut: {
      name: '比目鱼 · Hippoglossus hippoglossus',
      predUrl: '/static/data/sdm/sdm_prediction_halibut.json',
      respUrl: '/static/data/sdm/sdm_response_halibut.json',
      heatUrl: '/static/data/sdm/sdm_heatmap_halibut.png'
    }
  };

  function init() {
    var mapEl = document.getElementById('sdmMap');
    if (!mapEl) return;
    sdmMap = L.map('sdmMap', {
      zoomControl: true, attributionControl: false,
      minZoom: 2, maxZoom: 10,
      maxBounds: L.latLngBounds([-90, -180], [90, 180])
    }).setView([30, -30], 3);
    window.sdmMap = sdmMap;
    L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&scl=1&ltype=3&x={x}&y={y}&z={z}", {
      subdomains: ['1', '2', '3', '4'], maxZoom: 10, referrerPolicy: "no-referrer"
    }).addTo(sdmMap);

    loadSpecies('cod');

    // 物种选择器
    var sel = document.getElementById('sdmSpecies');
    if (sel) {
      sel.addEventListener('change', function () {
        loadSpecies(sel.value);
      });
    }

    // 对比物种选择器（动态两两对比）
    var compareSel = document.getElementById('sdmCompareSpecies');
    if (compareSel) {
      compareSel.addEventListener('change', function () {
        renderCompare(sel.value, compareSel.value);
      });
    }

    // 查看对比详情按钮（弹窗）
    var compareBtn = document.getElementById('sdmCompareBtn');
    if (compareBtn) {
      compareBtn.addEventListener('click', function () {
        renderCompare(sel.value, compareSel.value);
        var m = document.getElementById('sdmCompareModal');
        if (m) m.style.display = 'flex';
      });
    }

    // AI 生态解读按钮（带上当前滑块值，解读概率变化）
    var explainBtn = document.getElementById('sdmExplainBtn');
    if (explainBtn) {
      explainBtn.addEventListener('click', function () {
        explainBtn.textContent = '生成中…';
        explainBtn.disabled = true;
        var loading = document.getElementById('sdmExplainLoading');
        if (loading) loading.style.display = 'block';
        // 带当前滑块值 + 点击点经纬度（区位分析）
        var q = '?species=' + sel.value;
        ['sst', 'depth', 'chl'].forEach(function (f) {
          var el = document.getElementById(f + 'Slider');
          if (el) q += '&' + f + '=' + el.value;
        });
        if (window.lastClickLat != null && window.lastClickLng != null) {
          q += '&lat=' + window.lastClickLat + '&lon=' + window.lastClickLng;
        }
        fetch('/api/sdm/explain' + q)
          .then(function (r) {
            if (!r.ok) throw new Error('api error');
            var reader = r.body.getReader();
            var decoder = new TextDecoder();
            var result = document.getElementById('sdmExplainResultModal');
            result.textContent = '';
            document.getElementById('sdmExplainModal').style.display = 'flex';
            var buffer = '';
            var sourcesData = null;
            function pump() {
              return reader.read().then(function (res) {
                if (res.done) {
                  // 渲染资料来源（溯源 URL）
                  var srcBox = document.getElementById('sdmExplainSources');
                  if (srcBox) {
                    if (sourcesData && sourcesData.length) {
                      var html = '资料来源：';
                      sourcesData.forEach(function (u, i) {
                        if (i > 0) html += ' · ';
                        html += '<a href="' + u + '" target="_blank" rel="noopener" style="color:#4299E0;text-decoration:none;word-break:break-all;">' + u + '</a>';
                      });
                      srcBox.innerHTML = html;
                      srcBox.style.display = 'block';
                    } else {
                      srcBox.style.display = 'none';
                    }
                  }
                  return;
                }
                buffer += decoder.decode(res.value, { stream: true });
                var lines = buffer.split('\n');
                buffer = lines.pop();
                lines.forEach(function (line) {
                  if (line.indexOf('data: ') === 0) {
                    var dataStr = line.slice(6);
                    try {
                      var d = JSON.parse(dataStr);
                      if (d.explain) result.textContent += d.explain;
                      if (d.sources) sourcesData = d.sources;
                    } catch (e) {}
                  }
                });
                return pump();
              });
            }
            return pump();
          })
          .then(function () {
            var loading = document.getElementById('sdmExplainLoading');
            if (loading) loading.style.display = 'none';
            explainBtn.textContent = '重新生成解读';
            explainBtn.disabled = false;
          })
          .catch(function () {
            var result = document.getElementById('sdmExplainResult');
            result.style.display = 'block';
            result.textContent = '生成失败，请重试';
            var loading = document.getElementById('sdmExplainLoading');
            if (loading) loading.style.display = 'none';
            explainBtn.textContent = '重新生成解读';
            explainBtn.disabled = false;
          });
      });
    }

    // 点击地图 -> 预测该点概率
    sdmMap.on('click', function (e) {
      var lat = e.latlng.lat, lng = e.latlng.lng;
      window.lastClickLat = lat; window.lastClickLng = lng;  // 存点击点经纬度，供 AI 解读区位
      if (!pred) return;
      window.sdmClicking = true;  // 点击中：滑块更新不触发 updateResponse（避免覆盖点击概率）
      var bestI = 0, bestJ = 0, bestD = 1e9;
      for (var i = 0; i < pred.lat.length; i++) {
        for (var j = 0; j < pred.lon.length; j++) {
          var d = Math.abs(pred.lat[i] - lat) + Math.abs(pred.lon[j] - lng);
          if (d < bestD) { bestD = d; bestI = i; bestJ = j; }
        }
      }
      var p = pred.proba[bestI][bestJ];
      document.getElementById('sdmProbNum').textContent = (p * 100).toFixed(1) + '%';
      var basis = document.getElementById('sdmProbBasis');
      if (basis) basis.textContent = '概率依据：点击位置 (' + lat.toFixed(1) + '°N, ' + lng.toFixed(1) + '°) 的实际环境因子（SDM 模型预测）';
      var tag = p > 0.6 ? '<span class="sdm-tag sdm-high">高适宜</span>'
        : p > 0.3 ? '<span class="sdm-tag sdm-mid">中适宜</span>'
        : '<span class="sdm-tag sdm-low">低适宜</span>';
      document.getElementById('sdmTagBox').innerHTML = tag;
      // 从 env_matrix 找最近采样点，更新滑块 + 响应曲线
      if (matrix) {
        var envPts = matrix.occ.concat(matrix.bg);
        var bestE = null, bestEd = 1e9;
        for (var k = 0; k < envPts.length; k++) {
          var ep = envPts[k];
          var ed = Math.abs(ep.lat - lat) + Math.abs(ep.lon - lng);
          if (ed < bestEd) { bestEd = ed; bestE = ep; }
        }
        if (bestE) {
          if (bestE.sst != null && isFinite(bestE.sst)) {
            document.getElementById('sstSlider').value = bestE.sst;
            document.getElementById('sstSliderVal').textContent = bestE.sst.toFixed(1);
          }
          if (bestE.depth != null && isFinite(bestE.depth)) {
            document.getElementById('depthSlider').value = bestE.depth;
            document.getElementById('depthSliderVal').textContent = bestE.depth.toFixed(0);
          }
          if (bestE.chl != null && isFinite(bestE.chl)) {
            document.getElementById('chlSlider').value = bestE.chl;
            document.getElementById('chlSliderVal').textContent = bestE.chl.toFixed(2);
          }
          if (!window.sdmClicking) updateResponse();  // 点击中跳过，概率框保持 pred.proba
        }
      }
      window.sdmClicking = false;  // 点击结束
    });

    // 因子选择 -> 滑块联动 + 样本提示
    document.querySelectorAll('.sdm-feat-opt input').forEach(function (input) {
      input.addEventListener('change', updateFeatNote);
    });

    // 响应曲线滑块
    ['sstSlider', 'depthSlider', 'chlSlider'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () {
        if (!window.sdmClicking) updateResponse();  // 点击中跳过（避免覆盖点击概率）
      });
    });
  }

  function loadSpecies(species) {
    currentSpecies = species;
    var cfg = SPECIES[species];
    document.getElementById('sdmSpeciesName').textContent = cfg.name;
    Promise.all([
      fetch(cfg.predUrl).then(function (r) { return r.json(); }),
      fetch(cfg.respUrl).then(function (r) { return r.json(); }),
      fetch('/static/data/sdm/env_matrix.json').then(function (r) { return r.json(); })
    ]).then(function (res) {
      pred = res[0];
      response = res[1];
      matrix = res[2];
      // 移除旧热力图 + 陆地遮罩
      if (sdmMap._sdmOverlay) { sdmMap.removeLayer(sdmMap._sdmOverlay); sdmMap._sdmOverlay = null; }
      renderHeat();
      updateFeatNote();
      updateResponse();
      // 更新对比区（主物种 vs 当前对比物种）
      var compareSel = document.getElementById('sdmCompareSpecies');
      if (compareSel) renderCompare(species, compareSel.value);
    });
  }

  function getSelectedFeats() {
    var feats = [];
    for (var key in FEAT_NAMES) {
      var el = document.getElementById('f-' + key);
      if (el && el.checked) feats.push(key);
    }
    return feats;
  }

  function renderHeat() {
    var cfg = SPECIES[currentSpecies];
    // bounds 直接用原始 lat/lon（全球版不偏移，无需 GCJ-02 转换）
    var bounds = [[pred.lat[0], pred.lon[0]], [pred.lat[pred.lat.length - 1], pred.lon[pred.lon.length - 1]]];
    var overlay = L.imageOverlay(cfg.heatUrl, bounds, { opacity: 0.85, interactive: false }).addTo(sdmMap);
    sdmMap._sdmOverlay = overlay;
    // 地图 view 精确对齐热力图 bounds，缩放时同步（避免漂移）
    sdmMap.fitBounds(bounds);
    if (!sdmMap.getPane('landPane')) {
      sdmMap.createPane('landPane');
      sdmMap.getPane('landPane').style.zIndex = 500;
    }
    fetch('/static/data/sdm/ne_10m_land.geojson').then(function (r) { return r.json(); }).then(function (geo) {
      // 标准 Leaflet 写法：pane 选项让陆地 path 加到 landPane（z-index 500 盖住热力图）
      var landLayer = L.geoJSON(geo, {
        pane: 'landPane',
        style: { color: 'none', fillColor: '#ffffff', fillOpacity: 1 }
      }).addTo(sdmMap);
      sdmMap._sdmLandLayer = landLayer;
    });
  }

  function updateFeatNote() {
    if (!matrix) return;
    var feats = getSelectedFeats();
    document.querySelectorAll('.sdm-slider-row').forEach(function (row) {
      var feat = row.getAttribute('data-feat');
      row.style.display = feats.indexOf(feat) >= 0 ? '' : 'none';
    });
    if (feats.length < 2) {
      document.getElementById('sdmSampleNote').textContent = '请至少选择 2 个环境因子';
      return;
    }
    // 样本数：从预测 JSON 读该物种的真实样本数（n_occ/n_bg），不再用共用的 env_matrix
    var occN = 0, bgN = 0;
    if (pred) {
      occN = pred.n_occ || 0;
      bgN = pred.n_bg || 0;
    }
    var total = occN + bgN;
    document.getElementById('sdmSampleNote').textContent = '选中 ' + feats.length + ' 个因子（' + feats.map(function (f) { return FEAT_NAMES[f]; }).join('、') + '），建模样本 ' + occN + ' 出现点 + ' + bgN + ' 背景点';
  }

  function interpCurve(curve, value) {
    if (value <= curve[0].value) return curve[0].prob;
    if (value >= curve[curve.length - 1].value) return curve[curve.length - 1].prob;
    for (var i = 0; i < curve.length - 1; i++) {
      if (value >= curve[i].value && value <= curve[i + 1].value) {
        var t = (value - curve[i].value) / (curve[i + 1].value - curve[i].value);
        return curve[i].prob + t * (curve[i + 1].prob - curve[i].prob);
      }
    }
    return curve[curve.length - 1].prob;
  }

  function updateResponse() {
    if (!response) return;
    var feats = getSelectedFeats();
    var imp = response.feature_importance;
    var prob = 0, impSum = 0;
    var sliderMap = {
      sst: parseFloat(document.getElementById('sstSlider').value),
      depth: parseFloat(document.getElementById('depthSlider').value),
      chl: parseFloat(document.getElementById('chlSlider').value)
    };
    feats.forEach(function (f) {
      if (imp[f] != null && response.curves && response.curves[f]) {
        prob += interpCurve(response.curves[f], sliderMap[f]) * imp[f];
        impSum += imp[f];
      }
    });
    prob = impSum > 0 ? prob / impSum : 0;
    document.getElementById('sdmProbNum').textContent = (prob * 100).toFixed(1) + '%';
    var basis = document.getElementById('sdmProbBasis');
    if (basis) basis.textContent = '概率依据：当前滑块环境值（海温' + sliderMap.sst + '°C、水深' + sliderMap.depth + 'm 等）的响应曲线加权';
    var tag = prob > 0.6 ? '<span class="sdm-tag sdm-high">高适宜</span>'
      : prob > 0.3 ? '<span class="sdm-tag sdm-mid">中适宜</span>'
      : '<span class="sdm-tag sdm-low">低适宜</span>';
    document.getElementById('sdmTagBox').innerHTML = tag + '<span class="sdm-tag sdm-realtime">响应曲线</span>';
  }

  // 渲染多物种对比（竞争释放分析）——动态加载两个物种响应数据，画对比曲线（弹窗版）
  function renderCompare(speciesA, speciesB) {
    var canvasSst = document.getElementById('sdmCompareSstModal');
    var canvasDepth = document.getElementById('sdmCompareDepthModal');
    var canvasChl = document.getElementById('sdmCompareChlModal');
    var insight = document.getElementById('sdmCompareInsight');
    var insightModal = document.getElementById('sdmCompareInsightModal');
    var title = document.getElementById('sdmCompareTitle');
    var titleModal = document.getElementById('sdmCompareModalTitle');
    if (!canvasSst || !canvasDepth || !canvasChl) return;
    if (speciesA === speciesB) {
      if (insight) insight.innerHTML = '请选择两个不同的物种进行对比';
      return;
    }
    var cfgA = SPECIES[speciesA], cfgB = SPECIES[speciesB];
    Promise.all([
      fetch(cfgA.respUrl).then(function (r) { return r.json(); }),
      fetch(cfgB.respUrl).then(function (r) { return r.json(); })
    ]).then(function (res) {
      var respA = res[0], respB = res[1];
      var nameA = SPECIES[speciesA].name.split(' · ')[0];
      var nameB = SPECIES[speciesB].name.split(' · ')[0];
      if (title) title.textContent = nameA + ' vs ' + nameB + ' —— 同一环境变化下，谁升谁降（生态位差异）';
      if (titleModal) titleModal.textContent = nameA + ' vs ' + nameB + ' · 竞争释放分析';

      function drawChart(canvas, feat, featName) {
        var curveA = respA.curves && respA.curves[feat];
        var curveB = respB.curves && respB.curves[feat];
        if (!curveA || !curveB) return;
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#fafcff';
        ctx.fillRect(0, 0, w, h);
        var xMin = Math.min(curveA[0].value, curveB[0].value);
        var xMax = Math.max(curveA[curveA.length - 1].value, curveB[curveB.length - 1].value);
        var yMin = 0, yMax = 1, pad = 40;
        ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 1;
        for (var gy = 0; gy <= 4; gy++) {
          var y = h - pad - (gy / 4) * (h - pad * 2);
          ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - 20, y); ctx.stroke();
        }
        function drawLine(color, curve) {
          ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
          for (var i = 0; i < curve.length; i++) {
            var x = pad + ((curve[i].value - xMin) / (xMax - xMin)) * (w - pad - 20);
            var y = h - pad - ((curve[i].prob - yMin) / (yMax - yMin)) * (h - pad * 2);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        drawLine('#D82036', curveA);
        drawLine('#4299E0', curveB);
        ctx.fillStyle = '#555'; ctx.font = '13px sans-serif'; ctx.fillText(featName, pad, 20);
        // 图例（放右上角，避免和标题重叠）
        ctx.fillStyle = '#D82036'; ctx.fillRect(w - 200, 14, 12, 3);
        ctx.fillStyle = '#555'; ctx.font = '12px sans-serif'; ctx.fillText(nameA, w - 184, 19);
        ctx.fillStyle = '#4299E0'; ctx.fillRect(w - 120, 14, 12, 3);
        ctx.fillStyle = '#555'; ctx.fillText(nameB, w - 104, 19);
      }
      drawChart(canvasSst, 'sst', '海温 (°C)');
      drawChart(canvasDepth, 'depth', '水深 (m)');
      drawChart(canvasChl, 'chl', '叶绿素 (mg/m³)');

      // 生态位洞察（SST 峰值对比）
      var sstA = respA.curves && respA.curves.sst;
      var sstB = respB.curves && respB.curves.sst;
      if (sstA && sstB) {
        var maxA = sstA.reduce(function (a, b) { return b.prob > a.prob ? b : a; });
        var maxB = sstB.reduce(function (a, b) { return b.prob > a.prob ? b : a; });
        var text = nameA + ' SST 峰值 ' + maxA.value.toFixed(0) + '°C（概率 ' + (maxA.prob * 100).toFixed(0) + '%），' + nameB + ' 峰值 ' + maxB.value.toFixed(0) + '°C（概率 ' + (maxB.prob * 100).toFixed(0) + '%）。两物种对海温响应趋势相似，但峰值位置/幅度不同，体现生态位差异（竞争释放）。';
        if (insight) insight.innerHTML = text;
        if (insightModal) insightModal.innerHTML = text;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ===== 智渔牧海（全局，供 HTML onclick 调用）=====
var farmLoaded = false;

function switchSdmTab(tab) {
  var sdmPanel = document.getElementById('sdmPanel');
  var farmPanel = document.getElementById('sdmFarmPanel');
  var tabSdm = document.getElementById('sdmTabSdm');
  var tabFarm = document.getElementById('sdmTabFarm');
  if (tab === 'farm') {
    sdmPanel.style.display = 'none';
    farmPanel.style.display = 'block';
    tabSdm.classList.remove('active');
    tabFarm.classList.add('active');
    // 隐藏 SDM 热力图 + 陆地遮罩（避免大西洋鳕热力图干扰牧场点位）
    var map = window.sdmMap;
    if (map) {
      if (map._sdmOverlay) { map.removeLayer(map._sdmOverlay); }
      if (map._sdmLandLayer) { map.removeLayer(map._sdmLandLayer); }
    }
    ensureFarmLand(map);
    if (!farmLoaded) { farmLoaded = true; loadFarmPoints(); }
    // 初始化中国鱼种分季节分布展示
    if (typeof initFarmSeason === 'function') { initFarmSeason(); }
  } else {
    sdmPanel.style.display = 'block';
    farmPanel.style.display = 'none';
    tabFarm.classList.remove('active');
    tabSdm.classList.add('active');
    // 切回物种分布：刷新页面恢复热力图（简单可靠）
    location.reload();
  }
}

function loadFarmPoints() {
  var box = document.getElementById('farmPoints');
  fetch('/api/ocean-water')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok || !d.points) { box.innerHTML = '<span style="color:#999;">加载失败</span>'; return; }
      var html = '';
      d.points.forEach(function (p) {
        html += '<div class="farm-point" data-lat="' + p.lat + '" data-lon="' + p.lon + '" data-name="' + p.name + '" onclick="loadFarmDetail(this)">'
          + '<span class="fp-name">' + p.name + '</span>'
          + '<span class="fp-prov">' + p.province + '</span>'
          + '</div>';
      });
      box.innerHTML = html;
      // 地图上画牧场点位标记（circleMarker）
      var map = window.sdmMap;
      if (map) {
        // 清除旧的牧场标记
        if (map._farmMarkers) {
          map._farmMarkers.forEach(function (m) { map.removeLayer(m); });
        }
        map._farmMarkers = [];
        d.points.forEach(function (p) {
          var marker = L.circleMarker([p.lat, p.lon], {
            radius: 8, color: '#4299E0', fillColor: '#4299E0', fillOpacity: 0.8, weight: 2
          }).addTo(map);
          marker.bindTooltip(p.name, { direction: 'top', offset: [0, -8] });
          marker._farmName = p.name;
          marker.on('click', function () {
            // 点击地图标记，联动左侧点位列表
            var pts = document.querySelectorAll('.farm-point');
            for (var i = 0; i < pts.length; i++) {
              if (pts[i].getAttribute('data-name') === p.name) { loadFarmDetail(pts[i]); break; }
            }
          });
          map._farmMarkers.push(marker);
        });
        // 适配视野到中国海域
        map.fitBounds(L.latLngBounds([3, 100], [42, 145]));
      }
    })
    .catch(function () { box.innerHTML = '<span style="color:#999;">加载失败</span>'; });
}

// 智渔牧海：加载牧场点位实时水质预警（全局，供 onclick 调用）
function loadFarmDetail(el) {
  var lat = el.getAttribute('data-lat');
  var lon = el.getAttribute('data-lon');
  var name = el.getAttribute('data-name');
  var detail = document.getElementById('farmDetail');
  detail.innerHTML = '<div style="font-size:12px;color:#888;">加载 ' + name + ' 实时水质…</div>';
  // 高亮选中
  var pts = document.querySelectorAll('.farm-point');
  for (var i = 0; i < pts.length; i++) pts[i].classList.remove('selected');
  el.classList.add('selected');
  window._farmEcoWorst = 'xiaohuangyu';
  window.loadFarmExplain = function () {
    var btn = document.getElementById('farmExplainBtn');
    var box = document.getElementById('farmExplainResult');
    if (!btn || !box || btn.disabled) return;
    var sp = window._farmEcoWorst || 'xiaohuangyu';
    btn.disabled = true;
    btn.textContent = '生成中…';
    box.innerHTML = '<span style="color:#888;">AI 解读生成中（DeepSeek，约 10 秒）…</span>';
    fetch('/api/ocean/ecowarn/explain?lat=' + lat + '&lon=' + lon + '&species=' + sp)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) {
          box.innerHTML = '<span style="color:#999;">AI 解读失败：' + (d.error || '未知原因') + '</span>';
        } else {
          box.innerHTML = '<div style="font-weight:600;margin-bottom:4px;">AI 解读 · ' + d.species + '（' + (d.season_cn || '') + '）'
            + '<span class="sdm-ai-badge">AI 生成</span></div>'
            + '<div style="white-space:pre-wrap;">' + d.explain + '</div>'
            + '<div style="margin-top:6px;font-size:11px;color:rgba(143,180,204,0.95);">模型基底：DeepSeek（第三方大模型 API）· 解读内容由 AI 生成，仅供参考，不构成养殖决策依据</div>';
        }
        btn.disabled = false;
        btn.textContent = '重新生成解读';
      })
      .catch(function () {
        box.innerHTML = '<span style="color:#999;">AI 解读加载失败，请重试</span>';
        btn.disabled = false;
        btn.textContent = 'AI 解读预警（DeepSeek）';
      });
  };
  fetch('/api/ocean-water/alert?lat=' + lat + '&lon=' + lon)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok || !d.data) { detail.innerHTML = '<div style="font-size:12px;color:#999;">暂无数据</div>'; return; }
      var data = d.data;
      var sst = data.sst ? data.sst.value.toFixed(1) + '°C' : '—';
      var chl = data.chl ? data.chl.value.toFixed(2) + ' mg/m³' : '—';
      var score = data.health_score != null ? data.health_score : '—';
      var alerts = data.alerts && data.alerts.length ? data.alerts : [];
      var alertHtml = '';
      if (alerts.length) {
        alertHtml = alerts.map(function (a) {
          return '<div class="farm-alert ' + a.level + '">' + a.msg + '</div>';
        }).join('');
      } else {
        alertHtml = '<div class="farm-alert ok">水质正常</div>';
      }
      var html =
        '<div class="farm-detail-head"><b>' + name + '</b><span class="farm-score">健康度 ' + score + '</span></div>'
        + '<div class="farm-metrics">'
        + '<div class="fm"><span class="fm-k">实时海温</span><span class="fm-v">' + sst + '</span></div>'
        + '<div class="fm"><span class="fm-k">叶绿素</span><span class="fm-v">' + chl + '</span></div>'
        + '</div>'
        + '<div class="farm-alerts">' + alertHtml + '</div>'
        + '<div id="farmEcoWarn" style="margin-top:10px;font-size:12px;color:#888;">加载鱼种适宜性分析…</div>'
        + '<p style="font-size:11px;color:#999;margin-top:8px;">数据源：NOAA ERDDAP 实时遥感 · SDM 生态位 · 预警仅供参考</p>';
      detail.innerHTML = html;
      // 加载 SDM 生态位预警（三鱼种对比，当季模型+同季气候态基准，预警自动上链存证）
      var SP3 = [
        { key: 'xiaohuangyu', cn: '小黄鱼' },
        { key: 'landianmajiao', cn: '蓝点马鲛' },
        { key: 'dahuangyu', cn: '大黄鱼' }
      ];
      var ecoBox = document.getElementById('farmEcoWarn');
      var ecoHead = '<div style="font-weight:600;margin-bottom:4px;">鱼种适宜性对比（SDM 生态位 · 当季基准）</div>';
      var rowShell = function (id, cn, inner) {
        return '<div class="fm" id="' + id + '" style="display:flex;gap:8px;align-items:center;padding:3px 0;border-bottom:1px dashed rgba(255,255,255,0.08);"><span class="fm-k" style="min-width:70px;">' + cn + '</span>' + inner + '</div>';
      };
      if (ecoBox) ecoBox.innerHTML = ecoHead + SP3.map(function (s) {
        return rowShell('ecoRow_' + s.key, s.cn, '<span class="fm-v" style="font-size:12px;color:#999;">评估中…</span>');
      }).join('');
      var ecoDone = {};
      var chainInfo = null;
      var renderEco = function () {
        var box = document.getElementById('farmEcoWarn');
        if (!box) return;
        var got = SP3.map(function (s) { return ecoDone[s.key]; }).filter(function (e) { return e && !e.err; });
        got.sort(function (a, b) { return (b.drop != null ? b.drop : -9) - (a.drop != null ? a.drop : -9); });
        var worst = got.length && got[0].alert ? got[0].species : null;
        var worstKey = got.length && got[0].alert ? got[0]._key : null;
        var html = ecoHead;
        SP3.forEach(function (s) {
          var e = ecoDone[s.key];
          if (!e) return;
          if (e.err) {
            html += rowShell('ecoRow_' + s.key, s.cn, '<span class="fm-v" style="font-size:12px;color:#999;">暂无模型/评估失败</span>');
            return;
          }
          var suit = (e.suitability * 100).toFixed(0);
          var base = e.baseline != null ? (e.baseline * 100).toFixed(0) : '—';
          var delta = e.drop != null ? (e.drop >= 0 ? '-' + (e.drop * 100).toFixed(0) : '+' + (-e.drop * 100).toFixed(0)) : '—';
          var chip = e.alert
            ? '<span class="farm-alert ' + e.alert.level + '" style="padding:1px 8px;">' + (e.alert.level === 'red' ? '明显下降' : '有所下降') + '</span>'
            : '<span class="farm-alert ok" style="padding:1px 8px;">正常</span>';
          var mark = e.species === worst ? '<span style="color:#E8A33D;">←最先受影响</span>' : '';
          var fb = e.season_fallback && e.season_cn ? '（' + e.season_cn + '模型代评估）' : '';
          html += rowShell('ecoRow_' + s.key, e.species, '<span class="fm-v" style="font-size:12px;">当前 ' + suit + '% · 同期 ' + base + '%（' + delta + 'pp）' + fb + '</span>' + chip + mark);
        });
        if (chainInfo) {
          html += '<div style="margin-top:6px;font-size:11px;color:#5FD0C8;">预警摘要已写入海洋数据链存证：区块 #' + chainInfo.index + '（' + String(chainInfo.hash).slice(0, 10) + '…）· <a href="/ocean-data" target="_blank" style="color:#5FD0C8;text-decoration:underline;">去验证</a></div>';
        }
        if (SP3.every(function (s) { return ecoDone[s.key]; })) {
          window._farmEcoWorst = worstKey || 'xiaohuangyu';
          html += '<button id="farmExplainBtn" onclick="loadFarmExplain()" style="margin-top:8px;padding:5px 12px;font-size:12px;background:rgba(95,208,200,0.12);color:#5FD0C8;border:1px solid rgba(95,208,200,0.5);border-radius:6px;cursor:pointer;">AI 解读预警（DeepSeek）</button>'
            + '<div id="farmExplainResult" style="margin-top:8px;font-size:12px;line-height:1.7;"></div>';
        }
        box.innerHTML = html;
      };
      SP3.forEach(function (s) {
        fetch('/api/ocean/ecowarn?lat=' + lat + '&lon=' + lon + '&species=' + s.key)
          .then(function (r) { return r.json(); })
          .then(function (e) {
            if (!e.ok) { ecoDone[s.key] = { err: true }; renderEco(); return; }
            e._key = s.key;
            ecoDone[s.key] = e;
            if (e.chain && !chainInfo) chainInfo = e.chain;
            renderEco();
          })
          .catch(function () { ecoDone[s.key] = { err: true }; renderEco(); });
      });
    })
    .catch(function () { detail.innerHTML = '<div style="font-size:12px;color:#999;">加载失败</div>'; });
}

// 关闭 AI 生态解读弹窗（全局，供 onclick 调用）
function closeSdmExplain() {
  var m = document.getElementById('sdmExplainModal');
  if (m) m.style.display = 'none';
}

// 关闭多物种对比弹窗（全局，供 onclick 调用）
function closeSdmCompare() {
  var m = document.getElementById('sdmCompareModal');
  if (m) m.style.display = 'none';
}

// ===== 智渔牧海：中国鱼种分季节分布 =====
var FARM_SPECIES = {
  xiaohuangyu: { cn: "小黄鱼", sci: "Larimichthys polyactis" },
  landianmajiao: { cn: "蓝点马鲛", sci: "Scomberomorus niphonius" },
  dahuangyu: { cn: "大黄鱼", sci: "Larimichthys crocea" }
};
var FARM_SEASON = { spring: "春季", summer: "夏季", autumn: "秋季", winter: "冬季" };
var FARM_SEASONS = {
  xiaohuangyu: ["spring", "summer", "autumn"],
  landianmajiao: ["spring", "summer", "autumn", "winter"],
  dahuangyu: ["spring", "summer", "autumn"]
};

// 陆地遮罩（10m GeoJSON）：地图级常驻层，只加载一次；下载中不重复发起；失败允许下次重试
function ensureFarmLand(map) {
  if (!map || map._farmLandLoaded || map._farmLandLoading) return;
  map._farmLandLoading = true;
  fetch('/static/data/sdm/ne_10m_land.geojson').then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (geo) {
    if (!map.getPane('landPane')) {
      map.createPane('landPane');
      map.getPane('landPane').style.zIndex = 500;
    }
    L.geoJSON(geo, { pane: 'landPane', interactive: false, style: { color: 'none', fillColor: '#ffffff', fillOpacity: 1 } }).addTo(map);
    map._farmLandLoaded = true;
    map._farmLandLoading = false;
  }).catch(function () { map._farmLandLoading = false; });
}

// 加载中国鱼种分季节热力图到地图
function showFarmSeason() {
  var sp = document.getElementById('farmSpecies').value;
  var season = document.getElementById('farmSeason').value;
  var map = window.sdmMap;
  if (!map) return;
  // 移除旧的鱼种热力图（陆地遮罩为常驻层，只加载一次，不随季节/鱼种切换移除）
  if (map._farmSeasonOverlay) { map.removeLayer(map._farmSeasonOverlay); map._farmSeasonOverlay = null; }
  ensureFarmLand(map);
  var avail = FARM_SEASONS[sp] || [];
  if (avail.length && avail.indexOf(season) === -1) {
    var hint0 = document.getElementById('farmSeasonHint');
    if (hint0) hint0.innerHTML = FARM_SPECIES[sp].cn + '暂未建成' + FARM_SEASON[season] + '分布模型（已建成：' + avail.map(function (x) { return FARM_SEASON[x]; }).join('、') + '），请选择其他季节';
    return;
  }
  var url = '/static/data/sdm/sdm_heatmap_' + sp + '_' + season + '_cn.png';
  var hint = document.getElementById('farmSeasonHint');
  if (hint) hint.innerHTML = '加载 ' + FARM_SPECIES[sp].cn + ' ' + FARM_SEASON[season] + ' 分布…';
  // 加载预测 JSON 拿 bounds
  fetch('/static/data/sdm/sdm_prediction_' + sp + '_' + season + '_cn.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var bounds = [[d.lat[0], d.lon[0]], [d.lat[d.lat.length - 1], d.lon[d.lon.length - 1]]];
      var overlay = L.imageOverlay(url, bounds, { opacity: 0.85, interactive: false }).addTo(map);
      map._farmSeasonOverlay = overlay;
      map.fitBounds(bounds);
      var imp = d.feature_importance || {};
      var impStr = Object.keys(imp).map(function (k) {
        var nm = { depth: '水深', sst: '海温', chl: '叶绿素' }[k] || k;
        return nm + ' ' + (imp[k] * 100).toFixed(0) + '%';
      }).join('、');
      if (hint) hint.innerHTML = '<b>' + FARM_SPECIES[sp].cn + '</b>（' + FARM_SEASON[season] + '）适宜分布 · 样本 ' + (d.n_occ || '—') + ' 出现点 · 主导因子：' + impStr;
    })
    .catch(function () { if (hint) hint.innerHTML = '加载失败（该鱼种该季节模型可能未完成）'; });
}

// 绑定鱼种/季节选择器（切到智渔牧海时初始化）
function initFarmSeason() {
  var sp = document.getElementById('farmSpecies');
  var season = document.getElementById('farmSeason');
  if (sp) sp.addEventListener('change', showFarmSeason);
  if (season) season.addEventListener('change', showFarmSeason);
  showFarmSeason();
}
