/* 海纳 · 鲨鱼背景（海洋动态板块/中层）：加载 realistic_shark.glb，静止固定角落，作为背景点缀。
   参考 fishschool.js：等 THREE 挂载，等 canvas 布局好再创建 renderer（避免 WebGL context 失败）。 */
(function () {
  "use strict";
  var canvas = document.getElementById("sharkCanvas");
  if (!canvas) return;

  // 2026-08-23：等 THREE + GLTFLoader 挂载后再初始化
  if (!window.THREE || !window.GLTFLoader) {
    var waitTimer = setInterval(function () {
      if (window.THREE && window.GLTFLoader) {
        clearInterval(waitTimer);
        initShark(window.THREE);
      }
    }, 100);
    return;
  }
  initShark(window.THREE);

  function initShark(THREE) {
    var width = 0, height = 0;
    var renderer = null, scene = null, camera = null, mixer = null, sharkGroup = null;

    // 2026-08-23：等 canvas 布局好（有尺寸）再创建 renderer——海洋动态板块内容异步加载，
    // 初始 canvas 尺寸为 0，此时创建 WebGL context 会失败
    var renderTimer = setInterval(function () {
      if (canvas.clientHeight > 100) {
        clearInterval(renderTimer);
        initRenderer();
      }
    }, 100);

    function initRenderer() {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);   // 透明，露出深蓝背景
      setupScene();
    }

    function setupScene() {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
      camera.position.set(0, 0, 200);   // 拉远相机（z 120→200），增大视野让鲨鱼整个在视野内
      camera.lookAt(0, 0, 0);

      // 灯光（鲨鱼是 PBR 材质，需要光照）
      scene.add(new THREE.AmbientLight(0xffffff, 1.2));
      var dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
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

      new window.GLTFLoader().load("/static/models/shark.glb", function (gltf) {
        var model = gltf.scene;
        model.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(model);
        var c = new THREE.Vector3(); box.getCenter(c);
        var s = new THREE.Vector3(); box.getSize(s);
        var maxDim = Math.max(s.x, s.y, s.z, 0.001);
        var scale = 40 / maxDim;   // 鲨鱼缩放到 40 单位（放大到能看清）
        var group = new THREE.Group();
        group.scale.setScalar(scale);
        model.position.set(-c.x, -c.y, -c.z);   // 模型中心移到 group 原点
        // 2026-08-23：隐藏黑色部件（Object_19/24 等黑色 mesh）——渲染成黑色坨坨很丑，只显示白色身体
        model.traverse(function (o) {
          if (o.isMesh && o.material && o.material.color) {
            var hex = o.material.color.getHexString();
            if (hex === "000000") o.visible = false;
          }
        });
        group.add(model);
        group.position.set(-8, 15, 0);   // 鲨鱼移到视野内左侧（x=-35 超出相机视野，NDC x=-2.86 看不到）
        sharkGroup = group;
        scene.add(group);
        if (gltf.animations && gltf.animations.length) {
          // 2026-08-23：鲨鱼静止固定角落（不用动画）——swimming/circling 都含位移会到处游挡内容
          mixer = new THREE.AnimationMixer(model);
        }
        window.__sharkReady = true;
        renderer.render(scene, camera);
        // 2026-08-23：调试——输出鲨鱼 group 世界位置和尺寸
        if (window.console) {
          var wb = new THREE.Box3().setFromObject(group);
          var ws = new THREE.Vector3(); wb.getSize(ws);
          console.log("[shark] worldPos=" + group.position.x + "," + group.position.y + "," + group.position.z + " worldSize=" + ws.x.toFixed(1) + "x" + ws.y.toFixed(1) + "x" + ws.z.toFixed(1));
        }
      }, undefined, function () { });

      var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var clock = new THREE.Clock();
      var frameCount = 0;
      function loop() {
        requestAnimationFrame(loop);
        if (reduced) return;
        if (mixer) mixer.update(clock.getDelta());
        renderer.render(scene, camera);
        frameCount++;
        if (frameCount === 1 || frameCount === 60) console.log("[shark] loop frame=" + frameCount + " sceneChildren=" + scene.children.length + " sharkGroupInScene=" + (sharkGroup && scene.children.indexOf(sharkGroup) >= 0));
      }
      if (reduced) { renderer.render(scene, camera); }
      else { loop(); }
    }
  }
})();
