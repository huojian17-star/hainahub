/* 海纳 · 沙发鱼群（岗位区/前海背景）：加载 the_fish_particle.glb，播放其自带动画（白色鱼群旋涡游动） */
(function () {
  var canvas = document.getElementById("fishCanvas");
  if (!canvas) return;
  // 2026-08-24：极简模式——不加载 3D 模型，网慢/校园网用户快速看内容
  if (window.HainaPerf && window.HainaPerf.getMode() === "lite") return;
  // 2026-08-24：WebGL 不可用（如 Via 浏览器/老旧 WebView）→ 跳过，避免报错白屏
  try {
    var testC = document.createElement("canvas");
    if (!(testC.getContext("webgl") || testC.getContext("experimental-webgl"))) return;
  } catch (e) { return; }
  // 2026-08-23：等待 THREE + GLTFLoader 挂载后再初始化（three-loader.js 是异步 module，
  // 强制刷新/时序不对时 fishschool 可能先执行，提前 return 导致鱼群永不显示）
  var THREE = window.THREE;
  if (!THREE || !window.GLTFLoader) {
    var waitTimer = setInterval(function () {
      if (window.THREE && window.GLTFLoader) {
        clearInterval(waitTimer);
        initFish(window.THREE);
      }
    }, 100);
    return;
  }
  initFish(THREE);

  function initFish(THREE) {
  var width = 0, height = 0;
  function size() {
    var r = canvas.getBoundingClientRect();
    width = r.width; height = r.height;
  }
  size();

  var isPerf = window.HainaPerf && window.HainaPerf.getMode() === "performance";
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isPerf, alpha: true });
  renderer.setPixelRatio(isPerf ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);   // 透明，露出岗位区深蓝背景

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);  // 2026-08-23：fov 50→65 增大视野，避免放大后的鱼群被截断
  // 鱼群整体居中，相机前方带一点角度看旋涡群
  // 2026-08-23：相机拉近（z 20），让放大后的鱼群清晰可见
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);

  // 2026-08-23：加灯光——但热带鱼模型自带颜色纹理，灯光太强会发白，调暗
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 8);
  scene.add(dirLight);

  var mixer = null;
  new window.GLTFLoader().load("https://haina-models-1453246341.cos.ap-guangzhou.myqcloud.com/static/models/tropical-fish-school-pbr.glb", function (gltf) {
    var model = gltf.scene;
    // 让鱼群居中、缩放到合适尺寸
    model.updateMatrixWorld(true);   // 2026-08-23：先更新世界矩阵，否则 setFromObject 算不出尺寸（返回 0）导致缩放错乱
    var box = new THREE.Box3().setFromObject(model);
    var c = new THREE.Vector3(); box.getCenter(c);
    var s = new THREE.Vector3(); box.getSize(s);
    var maxDim = Math.max(s.x, s.y, s.z, 0.001);
    var scale = 13 / maxDim;      // 2026-08-23：缩小到 13 单位——content 页 canvas 下 18 太大，鱼群占满视口
    // 2026-08-23：用 group 包裹——先缩放 group，再把模型居中到 group 原点，避免缩放后中心偏移导致鱼群跑出视野
    var group = new THREE.Group();
    group.scale.setScalar(scale);
    model.position.set(-c.x, -c.y, -c.z);   // 模型中心移到 group 原点
    group.add(model);
    group.position.set(0, -2, 0);   // 2026-08-23：鱼群中心到岗位区中部（y≈450）
    fishGroup = group;  // 2026-08-23：赋给 fishGroup 供鼠标视差使用
    scene.add(group);
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      var act = mixer.clipAction(gltf.animations[0]);
      act.play();
    }
    // 2026-08-23：模型加载完成后 resize——此时岗位区内容已加载，canvas 尺寸正确
    resize();
    // 2026-08-23：标记鱼群模型加载完成，content 页 loading 遮罩据此隐藏
    window.__fishModelReady = true;
    // 2026-08-23：强制渲染一帧（确保鱼群显示，防止 loop 未启动）
    renderer.render(scene, camera);
    // 2026-08-23：调试——输出 scene 对象数和模型尺寸，确认渲染
    if (window.console) console.log("[fishschool] scene children=" + scene.children.length + " scale=" + scale.toFixed(2) + " groupY=" + group.position.y);
  }, undefined, function () { });

  function resize() {
    // 用 clientWidth/clientHeight（CSS 布局后的值），比 getBoundingClientRect 更可靠
    var w = canvas.clientWidth || canvas.parentElement.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || canvas.parentElement.clientHeight || window.innerHeight;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  // 2026-08-23：rAF + 延时双重 resize——岗位区内容异步加载，canvas 高度依赖内容，需等布局稳定
  requestAnimationFrame(function () { resize(); });
  setTimeout(function () { resize(); }, 800);   // 内容加载后再 resize
  setTimeout(function () { resize(); }, 3000);  // 兜底（岗位卡片加载完）
  window.addEventListener("resize", resize);

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clock = new THREE.Clock();

  // 2026-08-23：鼠标视差——鱼群整体随鼠标轻微偏移（和 hero 区同思路），幅度小避免游到岗位区
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("mousemove", function (e) {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;   // -1..1
    mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 2; // -1..1
  });
  var fishGroup = null;  // 模型 group 引用（在 load 回调里赋值）
  var FISH_BASE = { x: 0, y: -2 };   // 2026-08-23：鱼群中心到岗位区中部（y≈450，48px/单位）

  // 2026-08-23：点击岗位区左侧（鱼群区域）冒出气泡——互动趣味，不破坏鱼群动画
  var jobsZone = document.getElementById("jobs");
  if (jobsZone) {
    jobsZone.addEventListener("click", function (e) {
      // 只响应左侧鱼群区域（约 38% 宽度），不干扰右侧岗位卡片点击
      var rect = jobsZone.getBoundingClientRect();
      if (e.clientX - rect.left > rect.width * 0.38) return;
      var bubble = document.createElement("div");
      bubble.className = "fish-bubble";
      bubble.style.left = (e.clientX - 7) + "px";
      bubble.style.top = (e.clientY - 7) + "px";
      document.body.appendChild(bubble);
      setTimeout(function () { bubble.remove(); }, 1300);
    });
  }

  function loop() {
    requestAnimationFrame(loop);
    if (reduced) return;
    // 2026-08-23：性能模式——canvas 不在视口时暂停渲染（省 GPU，普通电脑不卡）
    if (window.HainaPerf && window.HainaPerf.getMode() === "performance") {
      var r = canvas.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
    }
    if (mixer) {
      var dt = clock.getDelta();
      mixer.update(dt);
    }
    // 鼠标视差：平滑插值 + 轻微偏移（±3 单位），基于基础位置，reduced-motion 时不动
    if (fishGroup) {
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      fishGroup.position.x = FISH_BASE.x + mouse.x * 3;
      fishGroup.position.y = FISH_BASE.y + mouse.y * 2;
    }
    renderer.render(scene, camera);
  }
  if (reduced) { renderer.render(scene, camera); }
  else { loop(); }
  }
})();
