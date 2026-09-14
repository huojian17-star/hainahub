/* 海纳 · 发光鲸鱼背景（海域图鉴板块/暮光带）：加载 glow-whale-pbr.glb，静止（发光鲸鱼）。
   参考 jellyfish.js：等 THREE 挂载，等 canvas 布局好再创建 renderer。 */
(function () {
  "use strict";
  var canvas = document.getElementById("whaleCanvas");
  if (!canvas) return;
  // 2026-08-24：极简模式——不加载 3D 模型（鲸鱼 24MB 大模型，网慢最该砍）
  if (window.HainaPerf && window.HainaPerf.getMode() === "lite") return;
  // 2026-08-24：WebGL 不可用（如 Via 浏览器/老旧 WebView）→ 跳过，避免报错白屏
  try {
    var testC = document.createElement("canvas");
    if (!(testC.getContext("webgl") || testC.getContext("experimental-webgl"))) return;
  } catch (e) { return; }

  if (!window.THREE || !window.GLTFLoader) {
    var waitTimer = setInterval(function () {
      if (window.THREE && window.GLTFLoader) {
        clearInterval(waitTimer);
        initWhale(window.THREE);
      }
    }, 100);
    return;
  }
  // 2026-08-23：性能模式懒加载——鲸鱼（24MB 大模型）滚动到视口才加载（省内存/加载）
  if (window.HainaPerf && window.HainaPerf.getMode() === "performance") {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          observer.disconnect();
          initWhale(window.THREE);
        }
      });
    }, { rootMargin: "200px" });   // 提前 200px 加载（滚动接近时预载）
    observer.observe(canvas);
    return;
  }
  initWhale(window.THREE);

  function initWhale(THREE) {
    var renderer = null, scene = null, camera = null, mixer = null, whaleGroup = null;   // mixer/whaleGroup 提到外层

    var renderTimer = setInterval(function () {
      if (canvas.clientHeight > 100) {
        clearInterval(renderTimer);
        initRenderer();
      }
    }, 100);

    function initRenderer() {
      var isPerf = window.HainaPerf && window.HainaPerf.getMode() === "performance";
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isPerf, alpha: true });
      renderer.setPixelRatio(isPerf ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);   // 透明，露出深蓝背景
      setupScene();
    }

    function setupScene() {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
      camera.position.set(0, 0, 200);
      camera.lookAt(0, 0, 0);

      // 灯光（发光鲸鱼是 MeshStandardMaterial，需要光照；emissive 发光白）
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      var dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(30, 50, 60);
      scene.add(dirLight);

      function resize() {
        var w = canvas.clientWidth || canvas.parentElement.clientWidth || window.innerWidth;
        var h = canvas.clientHeight || canvas.parentElement.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      requestAnimationFrame(function () { resize(); });
      setTimeout(function () { resize(); }, 800);
      setTimeout(function () { resize(); }, 3000);
      window.addEventListener("resize", resize);

      new window.GLTFLoader().load("https://haina-models-1453246341.cos.ap-guangzhou.myqcloud.com/static/models/glow-whale-pbr.glb", function (gltf) {
        var model = gltf.scene;
        model.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(model);
        var c = new THREE.Vector3(); box.getCenter(c);
        var s = new THREE.Vector3(); box.getSize(s);
        var maxDim = Math.max(s.x, s.y, s.z, 0.001);
        var vw = canvas.clientWidth || window.innerWidth;
        var target = vw < 480 ? 200 : (vw < 720 ? 260 : 300);   // 鲸鱼目标尺寸随视口自适应（手机缩小，避免占满屏）
        var scale = target / maxDim;   // 鲸鱼缩放到 target 单位
        var group = new THREE.Group();
        group.scale.setScalar(scale);
        model.position.set(-c.x, -c.y, -c.z);   // 模型中心移到 group 原点
        group.add(model);
        group.rotation.y = Math.PI / 2 - Math.PI / 3 + Math.PI / 6;   // 2026-08-23：以当前(30°)为基准左转 30°（=60°）
        group.position.set(0, -20, 0);   // 鲸鱼往下拉（300 单位超出高度，下移避免超顶部）
        scene.add(group);
        whaleGroup = group;   // 保存 group 引用（拖拽旋转用）
        window.__whaleGroup = group;   // 挂 window（验证用）
        // 2026-08-23：鼠标拖拽旋转鲸鱼（默认当前角度，用户可拖拽看细节）——监听板块，排除按钮/链接
        bindDragRotate(group, canvas);
        // 2026-08-23：播游动动画（动作幅度大）——优先 move/breach（原版游动幅度大），不用 surface（幅度小）
        if (gltf.animations && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          // 优先选幅度大的游动动画（move/breach），fallback 到第一个
          var anim = gltf.animations.find(function (a) { return /^move|breach/.test(a.name); }) || gltf.animations[0];
          var action = mixer.clipAction(anim);
          action.setLoop(THREE.LoopRepeat, Infinity);   // 循环播放
          action.play();
        }
        window.__whaleReady = true;
        renderer.render(scene, camera);
      }, undefined, function () { });

      var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var clock = new THREE.Clock();
      function loop() {
        requestAnimationFrame(loop);
        if (reduced) return;
        // 2026-08-23：性能模式——canvas 不在视口时暂停渲染
        if (window.HainaPerf && window.HainaPerf.getMode() === "performance") {
          var r = canvas.getBoundingClientRect();
          if (r.bottom < 0 || r.top > window.innerHeight) return;
        }
        if (mixer) mixer.update(clock.getDelta());
        renderer.render(scene, camera);
      }
      if (reduced) { renderer.render(scene, camera); }
      else { loop(); }
    }
  }

  // 2026-08-23：鼠标拖拽旋转鲸鱼（默认当前角度，用户可拖拽看细节）——监听板块，排除按钮/链接
  function bindDragRotate(group, canvas) {
    var dragging = false, startX = 0, startY = 0, startRotY = 0, startRotX = 0;
    var zone = canvas.closest(".zone-community") || canvas;
    zone.addEventListener("mousedown", function (e) {
      // 排除按钮/链接（点按钮不拖拽，只点击）
      if (e.target.closest("a, button, .load-more")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startRotY = group.rotation.y;
      startRotX = group.rotation.x;
      e.preventDefault();
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      group.rotation.y = startRotY + dx * 0.01;   // 水平移动 → 绕 Y 轴（左右转）
      group.rotation.x = startRotX + dy * 0.01;   // 垂直移动 → 绕 X 轴（上下转）
    });
    window.addEventListener("mouseup", function () {
      dragging = false;
    });
    // 2026-08-24：手机端触屏拖拽旋转鲸鱼（touch 事件）
    zone.addEventListener("touchstart", function (e) {
      if (e.target.closest("a, button, .load-more")) return;
      dragging = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startRotY = group.rotation.y;
      startRotX = group.rotation.x;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener("touchmove", function (e) {
      if (!dragging) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      group.rotation.y = startRotY + dx * 0.01;
      group.rotation.x = startRotX + dy * 0.01;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener("touchend", function () {
      dragging = false;
    });
  }
})();
