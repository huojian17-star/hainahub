/* 海纳 · 水母背景（海洋动态板块/中层）：加载 simple-jellyfish.glb，播漂浮动画，发光浅蓝。
   参考 fishschool.js：等 THREE 挂载，等 canvas 布局好再创建 renderer。 */
(function () {
  "use strict";
  var canvas = document.getElementById("jellyfishCanvas");
  if (!canvas) return;
  // 2026-08-24：极简模式——不加载 3D 模型
  if (window.HainaPerf && window.HainaPerf.getMode() === "lite") return;
  // 2026-08-24：WebGL 不可用（如 Via 浏览器/老旧 WebView）→ 跳过，避免报错白屏
  try {
    var testC = document.createElement("canvas");
    if (!(testC.getContext("webgl") || testC.getContext("experimental-webgl"))) return;
  } catch (e) { return; }

  // 2026-08-23：等 THREE + GLTFLoader 挂载后再初始化
  if (!window.THREE || !window.GLTFLoader) {
    var waitTimer = setInterval(function () {
      if (window.THREE && window.GLTFLoader) {
        clearInterval(waitTimer);
        initJellyfish(window.THREE);
      }
    }, 100);
    return;
  }
  initJellyfish(window.THREE);

  function initJellyfish(THREE) {
    var width = 0, height = 0;
    var renderer = null, scene = null, camera = null, mixer = null, jellyGroup = null;

    // 2026-08-23：等 canvas 布局好（有尺寸）再创建 renderer
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

      // 灯光（水母是 MeshStandardMaterial，需要光照；emissive 发光浅蓝）
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      var dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(30, 50, 60);
      scene.add(dirLight);

      function resize() {
        var w = canvas.clientWidth || canvas.parentElement.clientWidth || window.innerWidth;
        var h = canvas.clientHeight || canvas.parentElement.clientHeight || window.innerHeight;
        width = w; height = h;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      requestAnimationFrame(function () { resize(); });
      setTimeout(function () { resize(); }, 800);
      setTimeout(function () { resize(); }, 3000);
      window.addEventListener("resize", resize);

      new window.GLTFLoader().load("https://haina-models-1453246341.cos.ap-guangzhou.myqcloud.com/static/models/simple-jellyfish-pbr.glb", function (gltf) {
        var model = gltf.scene;
        model.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(model);
        var c = new THREE.Vector3(); box.getCenter(c);
        var s = new THREE.Vector3(); box.getSize(s);
        var maxDim = Math.max(s.x, s.y, s.z, 0.001);
        var scale = 30 / maxDim;   // 水母缩放到 30 单位（缩小，不占满右侧不截断）
        var group = new THREE.Group();
        group.scale.setScalar(scale);
        model.position.set(-c.x, -c.y, -c.z);   // 模型中心移到 group 原点
        group.add(model);
        group.position.set(35, -60, 0);   // 水母移到右下空白区（不挡右侧简报），x 45→35 左移 10 单位避免超出横向视野被裁剪，y -40→-60 下移
        jellyGroup = group;
        scene.add(group);
        if (gltf.animations && gltf.animations.length) {
          // 播漂浮动画（StandardMoving）——水母摆尾巴（不位移）
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
        }
        window.__jellyfishReady = true;
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
})();
