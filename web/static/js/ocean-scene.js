/* 海纳 · 3D 海洋背景（方案 A：替换 hero 背景）
   —— 程序化 Gerstner 波海面 + 太阳高光 + 指数雾 + 远处渔船随波起伏。
   所有资源本地化（不用 CDN）。对无 WebGL / reduced-motion / 加载失败静默回退到 CSS 渐变，
   绝不阻塞页面，绝不抛错。
   通过 window.OceanScene 给 animations.js 调用 setDive(t)（0..1，下潜进度）。 */
(function () {
  "use strict";

  var THREE = null;

  /* ---- 配置 ---- */
  var CFG = {
    sea: 140,            // 海面覆盖半径
    segs: 260,           // 海面细分（越高波纹越细腻）
    amplitude: 0.16,     // 主波高（降低，避免"减速带"大坡）
    wavelength: 5.0,     // 主波长（变短，波纹更碎）
    speed: 0.9,          // 波速
    deepColorTop: [0.10, 0.48, 0.78],    // 浅海（下潜 t=0）【明亮天蓝】
    deepColorBottom: [0.02, 0.14, 0.30], // 深海（下潜 t=1）
    fogNear: 26,
    fogFar: 320,
    environment: {
      url: "https://haina-models-1453246341.cos.ap-guangzhou.myqcloud.com/static/models/umhlanga_sunrise_4k.exr",
      intensity: 0.7
    },
    sunDir: [-0.7, 0.32, 0.42],   // 夕阳方向（偏低），波光从左上打出金色
    boat: {
      url: "/static/models/fishing-boat.glb",
      scale: 16.0,       // 目标船长（世界单位），画面中景更醒目
      x: 16,             // 往左移一些，接近画面中左侧
      z: -24,            // 再近一步
      y: -1.5,           // 下沉吃水，让船底穿过波面（避免悬空）
      turn: 0.9,         // 绕 Y 轴旋转，船头斜朝右前，展示 45° 侧面朝右
      bobAmp: 0.35,
      bobSpeed: 0.62,
      /* 名牌屏幕偏移：相机右向 × shiftX，正值向右；shiftY 正值上移 */
      boatShiftX: 2.0,
      boatShiftY: 3.4,
    },
    lighthouse: {
      url: "/static/models/lighthouse-real.glb",
      scale: 20.0,       // 目标最大尺度，靠近屏幕的大
      x: -15,            // 往右拉，让岛完整进画面、不被左边裁切
      z: -17,            // 中近距离，贴近但完整可见
      y: -0.4,           // 岛基座轻微坐进水面，房子和灯塔露出水面
      turn: 0.5,         // 绕 Y 轴向右转，接近正面微侧（参考图角度）
    }
  };

  function supportsWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }

  function prefersReduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---- 读取顶点位移的波高函数（CPU 端，与顶点 shader 三波叠加一致，让船随波起伏） ---- */
  function waveHeight(x, z, t) {
    var amp = CFG.amplitude, wl = CFG.wavelength, sp = CFG.speed;
    var k1 = Math.PI * 2 / wl;
    var k2 = Math.PI * 2 / (wl * 0.45);
    var k3 = Math.PI * 2 / (wl * 0.22);
    var d1 = x * 0.442 + z * 0.898;
    var d2 = x * 0.89 + z * 0.45;
    var d3 = x * -0.6 + z * 0.8;
    var h = Math.sin(k1 * (d1 - t * sp)) * amp;
    h += Math.sin(k2 * (d2 - t * sp * 1.3)) * amp * 0.5;
    h += Math.sin(k3 * (d3 - t * sp * 1.7)) * amp * 0.3;
    return h;
  }

  function init(canvas) {
    if (!canvas) return false;
    if (typeof window.__hainaThreeReady !== "undefined") return false; // 已初始化
    if (!supportsWebGL()) return false;

    try {
      THREE = window.THREE;
      if (!THREE) return false;

      var isPerf = window.HainaPerf && window.HainaPerf.getMode() === "performance";
      var renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: !isPerf,   // 性能模式关抗锯齿（省 GPU）
        alpha: true           // 透明清屏：海面上方(海平线之上)露出 CSS 渐变天空
        // 不设 powerPreference：low-power 在某些 GPU 会导致渲染失败，性能模式省 GPU 靠降分辨率/关阴影/关景深
      });
      // 性能模式降分辨率（省 GPU）；质量模式保持 2x
      renderer.setPixelRatio(isPerf ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.85;
      renderer.shadowMap.enabled = !isPerf;   // 性能模式关阴影
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x000000, 0); // 全透明，天空完全交给 CSS 渐变层

      var scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xbfe0ee, CFG.fogNear, CFG.fogFar);
      scene.background = new THREE.Color(0x9fd7ec);

      /* ===== HDRI 环境光：加载日出海届 .exr 设 scene.environment（IBL 环境反射），
              让船、灯塔的材质反射真实客堂孳。加载失败则忽略，保留现有灯光。 */
      if (window.EXRLoader) {
        new window.EXRLoader().load(CFG.environment.url, function (tex) {
          try {
            tex.mapping = THREE.EquirectangularReflectionMapping;
            scene.environment = tex;
            scene.environmentIntensity = 1.2;
            if (window.console) console.log("[海纳海洋] HDRI 环境光加载成功 size=" + ((tex.image && tex.image.width) || "?"));
          } catch (e) { if (window.console) console.warn("[海纳海洋] HDRI 设置环境光失败", e); }
        }, undefined, function (err) {
          if (window.console) console.warn("[海纳海洋] HDRI 环境光加载失败", err && (err.message || err));
        });
      }

      /* 灯光：夕阳暖调——暗蓝紫环境光 + 金色夕阳方向光 */
      var sunLight = new THREE.DirectionalLight(0xeaf4fa, 1.0);
      sunLight.position.set(-38, 34, 28);   // 左上偏低，晨光位置
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(2048, 2048);
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 200;
      sunLight.shadow.camera.left = -60;
      sunLight.shadow.camera.right = 60;
      sunLight.shadow.camera.top = 60;
      sunLight.shadow.camera.bottom = -60;
      sunLight.shadow.bias = -0.0004;
      scene.add(sunLight);

      /* 相机：贴近水面的低视角（参考图），海面占下半屏，天际线在上方 */
      var camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, CFG.fogFar);
      camera.position.set(0, 3.2, 20);
      camera.lookAt(0, 0.4, -46);

      /* ===== 重构：Beach Bay 写实海边场景作为背景。加载成功后作为主视觉；失败则保留现有海面/船/灯塔作为降级。 */
                  var beachBay = null;
      var bbCenter = null;
      var bbSize = null;
      if (window.GLTFLoader) {
        new window.GLTFLoader().load("https://haina-models-1453246341.cos.ap-guangzhou.myqcloud.com/static/models/beach-bay.glb", function (gltf) {
          try {
            var bb = gltf.scene;
            /* 保留作者原始朝向，不手摆；只把场景根剑到中心前方停在作者原点。 */
            /* 旋转 Beach Bay，把海边街景正面转到相机边（先试 Y 转 180°）*/
            bb.rotation.y = Math.PI;
            scene.add(bb);
            beachBay = bb;
            /* 出于对作者先视角的遵循，把相机放到场景正侧看中心；*/
            var box = new THREE.Box3().setFromObject(bb);
            var center = new THREE.Vector3(); box.getCenter(center);
            var size = new THREE.Vector3(); box.getSize(size);
            bbCenter = center; bbSize = size;
            if (window.console) console.log("[海纳海洋] Beach Bay bbox="+size.x.toFixed(1)+" x "+size.y.toFixed(1)+" x "+size.z.toFixed(1)+" center=("+center.x.toFixed(1)+","+center.y.toFixed(1)+","+center.z.toFixed(1)+")");
          } catch (e) { if (window.console) console.warn("[海纳海洋] Beach Bay 场景加载失败", e); }
        }, undefined, function (err) { if (window.console) console.warn("[海纳海洋] Beach Bay 场景加载失败", err && (err.message || err)); });
      }
/* ===== 海面：Gerstner-ish 顶点位移 + 太阳高光 + 菲涅尔 + 深度雾着色器 ===== */
      var seaSegs = isPerf ? 140 : CFG.segs;   // 性能模式降海面细分（省 GPU）
      var seaGeo = new THREE.PlaneGeometry(CFG.sea, CFG.sea, seaSegs, seaSegs);
      seaGeo.rotateX(-Math.PI / 2);

      var uniforms = {
        uTime: { value: 0 },
        uAmp: { value: CFG.amplitude },
        uWaveLen: { value: CFG.wavelength },
        uSpeed: { value: CFG.speed },
        uSunDir: { value: new THREE.Vector3(CFG.sunDir[0], CFG.sunDir[1], CFG.sunDir[2]).normalize() },
        uSunColor: { value: new THREE.Color(0xeaf6fc) },
        uDeep: { value: 0.0 }, // 下潜进度 0..1
        uFogNear: { value: CFG.fogNear },
        uFogFar: { value: CFG.fogFar }
      };

      var seaMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: [
          "#include <common>",
          "uniform float uTime;",
          "uniform float uAmp;",
          "uniform float uWaveLen;",
          "uniform float uSpeed;",
          "varying float vWave;",
          "varying vec3 vWorldPos;",
          "float waveH(vec2 p, float t, float amp, float len){",
          "  // 多波叠加：主波 + 两个不同方向的次波，波纹细碎自然，避免大坎",
          "  float k1 = 6.28318 / len;",
          "  float k2 = 6.28318 / (len * 0.45);",
          "  float k3 = 6.28318 / (len * 0.22);",
          "  float d1 = dot(p, vec2(0.442, 0.898));",
          "  float d2 = dot(p, vec2(0.89, 0.45));",
          "  float d3 = dot(p, vec2(-0.6, 0.8));",
          "  float h = sin(k1*(d1 - t*uSpeed)) * amp;",
          "  h += sin(k2*(d2 - t*uSpeed*1.3)) * amp * 0.5;",
          "  h += sin(k3*(d3 - t*uSpeed*1.7)) * amp * 0.3;",
          "  return h;",
          "}",
          "void main(){",
          "  vec3 transformed = position;",
          "  float h = waveH(transformed.xz, uTime, uAmp, uWaveLen);",
          "  transformed.y += h;",
          "  vWave = h;",
          "  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);",
          "  vWorldPos = mvPosition.xyz;",
          "  gl_Position = projectionMatrix * mvPosition;",
          "}"
        ].join("\n"),
        fragmentShader: [
          "uniform vec3 uSunDir;",
          "uniform vec3 uSunColor;",
          "uniform float uDeep;",
          "uniform float uFogNear;",
          "uniform float uFogFar;",
          "varying float vWave;",
          "varying vec3 vWorldPos;",
          "void main(){",
          "  vec3 deep = mix(vec3(0.14,0.20,0.30), vec3(0.02,0.03,0.07), uDeep);",
          "  float hL = vWave;",
          "  vec3 n = normalize(vec3(-0.9 * hL * 0.9, 1.0, -0.7 * hL * 0.9));",
          "  vec3 V = normalize(cameraPosition - vWorldPos);",
          "  vec3 H = normalize(uSunDir + V);",
          "  // 黄昏波光：两道高光，主锐利(夕阳金) + 次柔光，带暖橙反射",
          "  float spec = pow(max(dot(n, H), 0.0), 300.0);",
          "  float spec2 = pow(max(dot(n, H), 0.0), 40.0);",
          "  vec3 col = deep + uSunColor * (spec * 2.6 + spec2 * 0.6);",
          "  // 浪尖微光（夕照暖白）",
          "  float foam = clamp(hL - 0.18, 0.0, 1.0) * 1.6;",
          "  col += vec3(0.95,0.99,1.0) * foam * 0.22;",
          "  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);",
          "  col += vec3(0.78,0.9,0.97) * fres * 0.24;",
          "  // 黄昏雾：近处接天空暖金紫，远处偏深（下潜）",
          "  float dist = length(cameraPosition - vWorldPos);",
          "  float fog = clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);",
          "  vec3 fogCol = mix(vec3(0.82,0.92,0.96), vec3(0.03,0.05,0.09), uDeep);",
          "  col = mix(col, fogCol, fog);",
          "  gl_FragColor = vec4(col, 1.0);",
          "}"
        ].join("\n")
      });

      var sea = new THREE.Mesh(seaGeo, seaMat);
      sea.visible = false;   // Beach Bay 场景自带海面，隐藏原海面避免叠加
      scene.add(sea);

      /* ===== 船：GLTF 加载，随波起伏 ===== */
      var boat = null;
      var boatHolder = null;
      var boatNameMesh = null;
      var boatNameAnchor = null;
      var loader = null;
      try { if (window.GLTFLoader) loader = new window.GLTFLoader(); } catch (e) { loader = null; }
      if (false && loader) {   // 转码——不加载旧船，Beach Bay 背景主导
        loader.load(CFG.boat.url, function (gltf) {
          var model = gltf.scene;
          try {
            /* 关键：清理材质。这艘船带多套 UV（uv1）+ normalMap，在 three 0.160 WebGL2 下
               USE_NORMALMAP 会引用未声明的 uv1 导致顶点着色器编译失败（Shader Error 0）。
               这里只保留 baseColor（Albedo 贴图/颜色），关闭会触发复杂 chunk 的贴图。 */
            model.traverse(function (obj) {
              if (obj.isMesh) {
                var src = Array.isArray(obj.material) ? obj.material[0] : obj.material;
                if (!src) return;
                var keep = new THREE.MeshStandardMaterial({
                  map: src.map || null,
                  normalMap: src.normalMap || null,
                  metalnessMap: src.metalnessMap || null,
                  roughnessMap: src.roughnessMap || null,
                  aoMap: src.aoMap || null,
                  color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
                  roughness: 0.6,
                  metalness: 0.25,
                  envMapIntensity: 1.25,
                  side: THREE.FrontSide,
                  transparent: !!src.transparent
                });
                if (keep.normalMap && keep.normalMap.channel !== 0) { keep.normalMap.channel = 0; }
                if (keep.aoMap && keep.aoMap.channel !== 0) { keep.aoMap.channel = 0; }obj.material = Array.isArray(obj.material)
                  ? new Array(obj.material.length).fill(keep)
                  : keep;
              }
            });
            // 计算包围盒并归一化：X/Z 居中，Y 让包围盒最低点贴到 holder 的 y=0（即船底沾水面）
            var box = new THREE.Box3().setFromObject(model);
            var size = new THREE.Vector3(); box.getSize(size);
            var center = new THREE.Vector3(); box.getCenter(center);
            model.position.x -= center.x;
            model.position.z -= center.z;
            model.position.y -= box.min.y;      // 最低点贴 0，避免悬空或下沉
            var targetLen = CFG.boat.scale;
            var largest = Math.max(size.x, size.y, size.z, 0.001);
            var s = targetLen / largest;
            boatHolder = new THREE.Group();
            boatHolder.add(model);
            boatHolder.scale.setScalar(s);


            // 45° 侧向展示（船头斜朝右前），避免正腔对镜头
            boatHolder.rotation.y = CFG.boat.turn || -0.9;
            // holder 落位：y = 水面高度（略微吃水），让船底贴海面
            boatHolder.position.set(CFG.boat.x, CFG.boat.y, CFG.boat.z);
            boatHolder.traverse(function(o){ if(o.isMesh) o.castShadow = true; });
            scene.add(boatHolder);

            /* 「海纳号」船名牌：独立 Sprite 始终面向相机，倾 ( 不依赖船壳坐标，不飘不消失） */
            try {
              var nc = document.createElement("canvas");
              nc.width = 512; nc.height = 128;
              var ncx = nc.getContext("2d");
              ncx.clearRect(0, 0, 512, 128);
              ncx.fillStyle = "rgba(18,24,36,0.92)";
              ncx.font = "700 84px 'KaiTi','STKaiti','SimKai','Kaiti SC','PingFang SC',sans-serif";
              ncx.textAlign = "center"; ncx.textBaseline = "middle";
              ncx.fillText("海纳号", 256, 54);
              ncx.font = "500 24px 'SF Mono','Consolas','ui-monospace',monospace";
              ncx.fillStyle = "rgba(255,255,255,0.72)";
              ncx.fillText("HAINA · HAINAHUB", 256, 100);
              var nameTex = new THREE.CanvasTexture(nc);
              nameTex.colorSpace = THREE.SRGBColorSpace;
              /* 改用 Mesh 平面，作为 boatHolder 子节点，随船体同一变换一起浮动（上下浮动+倾斜摇摆+随波起伏），不再始终面向相机 */
              /* 改回 Sprite：字始终面向相机可读（这是之前得到认可的样式），挂在 boatHolder 下随船上下浮动。之前“不同步”的根因是 Sprite 不跟随 rotation.z 摆摆，但位置是随船的；保留辙接近的位置与尺寸。 */
              /* Sprite 名牌：字始终面向相机可读（唯一确定能显示字的方案），挂船下随船上下浮动。为了减少“飘浮不同步”，已把船的倾斜摆摆降到极小。 */
              var pw = Math.max(2.6, size.z * 0.42), ph = pw * 0.28;
              var nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
              nameSprite.renderOrder = 20;
              nameSprite.position.set(-0.4, 1.4, 0.3);
              nameSprite.scale.set(pw, ph, 1);
              boatNameMesh = nameSprite;
              boatHolder.add(nameSprite);   // under boat, follows position; always faces camera
            } catch (e) { /* 名牌失败不影响船 */ }
            // 记录基准 y（船底），每帧在基准上叠加波动，避免被覆盖
            boat = { group: boatHolder, baseY: boatHolder.position.y, size: size };
            if (window.console) console.log("[海纳海洋] 船加载成功 size=" + size.x.toFixed(2) + "x" + size.y.toFixed(2) + "x" + size.z.toFixed(2) + " scale=" + s.toFixed(3));
          } catch (e) {
            boat = null;
            if (window.console) console.warn("[海纳海洋] 船归一化失败", e);
          }
        }, undefined, function (err) {
          boat = null;
          if (window.console) console.warn("[海纳海洋] 船加载失败", err && (err.message || err));
        });
      }

      /* ===== 灯塔岛：GLTF 加载（左侧海平线远景，带发光灯塔），保留 baseColor + emissive ===== */
      var lighthouse = null;
      if (false && loader) {   // 转码——不加载旧灯塔
        loader.load(CFG.lighthouse.url, function (gltf) {
          var model = gltf.scene;
          try {
            // 尽量保留原贴图（无 normalMap，不会触发 uv1 编译错误），仅兜底 meshstandard
            model.traverse(function (obj) {
              if (obj.isMesh && obj.material && !obj.material.isMeshStandardMaterial) {
                var src = obj.material;
                var keep = new THREE.MeshStandardMaterial({
                  map: src.map || null,
                  color: (src.color || new THREE.Color(0xffffff)),
                  roughness: 0.55,
                  metalness: 0.12,
                  envMapIntensity: 1.35,
                  emissive: src.emissive || new THREE.Color(0x000000),
                  emissiveIntensity: src.emissiveIntensity || 1.0,
                  side: THREE.FrontSide,
                  transparent: !!src.transparent
                });
                obj.material = keep;
              }
            });
            var box = new THREE.Box3().setFromObject(model);
            var size = new THREE.Vector3(); box.getSize(size);
            var center = new THREE.Vector3(); box.getCenter(center);
            model.position.x -= center.x;
            model.position.z -= center.z;
            model.position.y -= box.min.y;
            var largest = Math.max(size.x, size.y, size.z, 0.001);
            var s = CFG.lighthouse.scale / largest;
            var holder = new THREE.Group();
            holder.add(model);
            holder.scale.setScalar(s);
            holder.rotation.y = CFG.lighthouse.turn || 0;   // 向右转以接近正面微侧
            holder.position.set(CFG.lighthouse.x, CFG.lighthouse.y - size.y * s * 0.06, CFG.lighthouse.z);
            holder.traverse(function(o){ if(o.isMesh) o.castShadow = true; });
            scene.add(holder);
            lighthouse = holder;
          } catch (e) { lighthouse = null; }
        }, undefined, function () { lighthouse = null; });
      }

      /* ===== 3D 云：远处的 Sprite，放在天空高处且 z 很深（比灯塔远），
                Three 深度缓冲保证灯塔在前遮住云，云从灯塔后面飘过 ===== */
            var clouds = [];
      if (false) try {   // 转码——不生成云
        /* 每朵云用不同的 blob 组合，生成多样的云形。用正方形 canvas，云透明背景完整居中，避免 y 方向被截断。 */
        function makeCloudTex() {
          var cc = document.createElement("canvas");
          cc.width = 256; cc.height = 128;
          var c = cc.getContext("2d");
          /* 柔和圆形积云：多个圆形径向渐变堆叠，无方边，淡犛白主体 */
          function pblob(x, y, r, a) {
            var gg = c.createRadialGradient(x, y, 0, x, y, r);
            gg.addColorStop(0, "rgba(255,255,255," + a + ")");
            gg.addColorStop(1, "rgba(255,255,255,0)");
            c.fillStyle = gg;
            c.beginPath(); c.arc(x, y, r, 0, 6.28318); c.fill();
          }
          /* 平展积云：对称圆堆叠，中间高两侧低 */
          pblob(64, 66, 30, 0.85);
          pblob(128, 56, 34, 0.92);
          pblob(192, 66, 30, 0.85);
          pblob(96, 76, 26, 0.75);
          pblob(160, 76, 26, 0.75);
          pblob(128, 82, 32, 0.65);
          var t = new THREE.CanvasTexture(cc);
          t.colorSpace = THREE.SRGBColorSpace;
          return t;
        }


        var cloudDefs = [
          { x: -40, y: 26, z: -95, s: 30 },
          { x: 30,  y: 30, z: -112, s: 44 },
          { x: 75,  y: 27, z: -100, s: 34 },
          { x: -85, y: 24, z: -100, s: 28 },
          { x: 55,  y: 20, z: -120, s: 40 },
          { x: -5,   y: 28, z: -125, s: 36 }
        ];
        cloudDefs.forEach(function (d) {
          var tex = makeCloudTex();
          var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.82, depthTest: true, depthWrite: false, fog: false });
          var spr = new THREE.Sprite(mat);
          spr.position.set(d.x, d.y, d.z);
          spr.scale.set(d.s, d.s * 0.5, 1);   // 层云为横宽形，不压扁
          scene.add(spr);
});
      } catch (e) { /* 云失败不影响场景 */ }

      /* ===== 渲染循环 ===== */
      var clock = new THREE.Clock();
      var state = { paused: false, dispose: false };
      var raf;

      function resize() {
        var w = canvas.clientWidth || canvas.parentElement.clientWidth || window.innerWidth;
        var h = canvas.clientHeight || canvas.parentElement.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resize();
      window.addEventListener("resize", resize);

      /* 鼠标视差：鼠标位置驱动相机微移，打破贴图感（幅度极小，reduced-motion 时不动） */
      state.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      function onMouseMove(e) {
        state.mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;   // -1..1
        state.mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 2; // -1..1
      }
      window.addEventListener("mousemove", onMouseMove);
      var reducedMove = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      /* ===== 景深：EffectComposer + BokehPass（远处海天空虚化，近处街景清晰） ===== */
      var composer = null;
      // 性能模式跳过景深后处理（BokehPass 最吃 GPU，性能优先保流畅）
      if (!isPerf && window.EffectComposer && window.RenderPass && window.BokehPass) {
        try {
          composer = new window.EffectComposer(renderer);
          composer.addPass(new window.RenderPass(scene, camera));
          var bokeh = new window.BokehPass(scene, camera, { focus: 0.2, aperture: 0.0004, maxblur: 0.012 });
          composer.addPass(bokeh);
          if (window.OutputPass) composer.addPass(new window.OutputPass());
        } catch (e) { if (window.console) console.warn("[海纳海洋] 景深初始化失败", e); composer = null; }
      }

      function frame() {
        if (state.dispose) return;
        raf = requestAnimationFrame(frame);
        if (state.paused) return;
        var t = clock.getElapsedTime();
        uniforms.uTime.value = t;
        if (boat && boat.group) {
          var h = waveHeight(CFG.boat.x, CFG.boat.z, t);
          boat.group.position.y = boat.baseY + h * 0.55 + Math.sin(t * CFG.boat.bobSpeed) * CFG.boat.bobAmp * 0.3;
          boat.group.rotation.z = Math.sin(t * CFG.boat.bobSpeed * 0.8) * 0.008;
        }
        // camera = dive base + mouse parallax (smoothed)
        var dt = state.diveT || 0;
        var m = state.mouse;
        m.x += (m.tx - m.x) * 0.06;
        m.y += (m.ty - m.y) * 0.06;
        var px, py, pz;
        if (reducedMove) {
          px = 0; py = 3.2 - dt * 2.6; pz = 20 - dt * 8;
        } else {
          px = m.x * 1.4;
          py = 3.2 - dt * 2.6 + m.y * 0.9;
          pz = 20 - dt * 8;
        }
        if (bbCenter && bbSize) {
          /* Beach Bay 正视角：低角度在模型一侧，看向海平线(模型另一侧)。不俶视。 */
          var span = Math.max(bbSize.x, bbSize.y, bbSize.z, 1);
          /* 相机在模型的 +z 侧、中等低高度，看向模型中心低处（微低于平视，但不俶视） */
          var mx = state.mouse.x * span * 0.05;   // 鼠标左右视差（微小）
          var my = state.mouse.y * span * 0.04;   // 鼠标上下视差
          camera.position.set(bbCenter.x - span * 0.04 + mx, bbCenter.y - span * 0.30 + my, bbCenter.z + span * 0.30);
          camera.lookAt(bbCenter.x - span * 0.04 + mx * 1.6, bbCenter.y - span * 0.48 + my * 1.6, bbCenter.z - span * 0.5);
        } else {
          camera.position.set(px, py, pz);
          camera.lookAt(px * 0.5, 0.4 - dt * 0.4 + m.y * 0.4, -46);
        }
        // clouds drift
        if (clouds.length) {
          for (var ci = 0; ci < clouds.length; ci++) {
            var cl = clouds[ci];
            cl.position.x += Math.sin(t * 0.05 + ci) * 0.01 + 0.012;
            if (cl.position.x > 120) cl.position.x = -120;
          }
        }
        if (composer) { composer.render(); } else { renderer.render(scene, camera); }
      }
      raf = requestAnimationFrame(frame);

      /* public API */
      window.__hainaThreeReady = true;
      window.OceanScene = {
        setDive: function (t) {
          state.diveT = Math.max(0, Math.min(1, t));
          uniforms.uDeep.value = state.diveT;
          uniforms.uFogFar.value = CFG.fogFar - state.diveT * 140;
        },
        setPaused: function (p) { state.paused = !!p; },
        dispose: function () {
          state.dispose = true;
          if (raf) cancelAnimationFrame(raf);
          if (resize) window.removeEventListener("resize", resize);
          if (onMouseMove) window.removeEventListener("mousemove", onMouseMove);
        }
      };
      return true;
    } catch (e) {
      window.__hainaThreeFailed = true;
      try { window.OceanScene && window.OceanScene.dispose && window.OceanScene.dispose(); } catch (e2) {}
      return false;
    }
  }

  window.Ocean3D = { init: init, supportsWebGL: supportsWebGL, prefersReduced: prefersReduced };

  /* 2026-08-24：极简模式——不初始化 3D 海洋场景（网慢/校园网用户） */
  if (window.HainaPerf && window.HainaPerf.getMode() === "lite") {
    window.Ocean3D.init = function () { return false; };
  }

  /* three 加载桥就绪后，由 three-loader.js 调用（仅首次） */
  window.__dispatchOceanInit = function () {
    if (window.__hainaThreeReady || window.__hainaThreeFailed) return;
    var canvas = document.getElementById("oceanCanvas");
    if (canvas && typeof window.Ocean3D === "object") {
      window.Ocean3D.init(canvas);
    }
  };
  if (window.THREE && document.getElementById("oceanCanvas")) {
    window.__dispatchOceanInit();
  }
})();
