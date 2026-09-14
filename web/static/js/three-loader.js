/* 海纳 · Three.js 加载桥（importmap 映射到本地 vendor）
   用 <script type="module"> + importmap 加载本地 three，把 THREE 挂到 window。
   GLTFLoader 延迟加载（可选，不阻塞 THREE 挂载和海面初始化）：
   GLTFLoader.js 作为 module 有时加载失败（版本/import 兼容），不应阻塞主海面渲染。 */
import * as THREE from "three";

window.THREE = THREE;

// 先加载 EXRLoader 再加载 GLTFLoader，确保 HDRI 环境光在海面初始化前就轾
Promise.all([
  import("EXRLoader").then(function (m) { window.EXRLoader = m.EXRLoader || m.default; }).catch(function () { window.EXRLoader = null; }),
  import("GLTFLoader").then(function (m) { window.GLTFLoader = m.GLTFLoader || m.default; }).catch(function () { window.GLTFLoader = null; }),
  import("EffectComposer").then(function (m) { window.EffectComposer = m.EffectComposer || m.default; }).catch(function () { window.EffectComposer = null; }),
  import("RenderPass").then(function (m) { window.RenderPass = m.RenderPass || m.default; }).catch(function () { window.RenderPass = null; }),
  import("ShaderPass").then(function (m) { window.ShaderPass = m.ShaderPass || m.default; }).catch(function () { window.ShaderPass = null; }),
  import("BokehPass").then(function (m) { window.BokehPass = m.BokehPass || m.default; }).catch(function () { window.BokehPass = null; }),
  import("UnrealBloomPass").then(function (m) { window.UnrealBloomPass = m.UnrealBloomPass || m.default; }).catch(function () { window.UnrealBloomPass = null; }),
  import("OutputPass").then(function (m) { window.OutputPass = m.OutputPass || m.default; }).catch(function () { window.OutputPass = null; })
]).then(function () {
  // 2026-08-23：content 页（无 hero 海面）通过 window.__skipOcean 跳过 ocean-scene 初始化，只保留 THREE + GLTFLoader
  if (window.__skipOcean) { return; }
  // 两个 loader 都尝试加载完成后再初始化海面场景
  return import("./ocean-scene.js").then(function () {
    window.__dispatchOceanInit && window.__dispatchOceanInit();
  });
});
