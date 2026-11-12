/* 共享命名空间、常量、随机数与有序初始化。 */
"use strict";
window.SN = {};
(function (SN) {
  SN.$ = id => document.getElementById(id);
  SN.error = SN.$("error");
  SN.initializers = [];
  SN.validationProblems = [];
  SN.reportContentProblem = function reportContentProblem(id, x, z, message, action = "保留并继续", details = {}) {
    const problem = { id, x, z, message, action, ...details };
    SN.validationProblems.push(problem);
    console.warn("[城市内容] " + id + " (" + x + ", " + z + "): " + message + "；" + action, problem);
    return problem;
  };

  SN.validateContent = function validateContent(id, location, check) {
    try {
      return check();
    }
    catch (e) {
      SN.reportContentProblem(id, location.x, location.z, e.message || String(e), "跳过此项检查，继续启动");
    }
  };
  // Register every function before running the original startup sequence.

  SN.registerInit = function registerInit(order, run) {
    SN.initializers.push({ order, run });
  };

  SN.initialize = function initialize(synchronous = false) {
    if (!window.THREE) {
      SN.error.style.display = "block";
      SN.error.textContent = "三维引擎未能载入。请检查网络连接，然后刷新页面。";
      SN.$("start").textContent = "引擎尚未就绪";
      return;
    }
    SN.initializers.sort((a, b) => a.order - b.order);
    let index = 0, iterator = null;
    const count = SN.initializers.length;
    const next = () => {
      try {
        const phase = SN.initializers[index], begin = performance.now();
        if (!iterator) {
          const result = phase.run();
          if (result && typeof result.next === "function") iterator = result;
        }
        if (iterator) {
          let chunk;
          do { chunk = iterator.next(); } while (!chunk.done && (synchronous || performance.now() - begin < 8));
          if (!chunk.done) {
            if (SN.perf) SN.perf.initMax = Math.max(SN.perf.initMax, performance.now() - begin);
            SN.$("loadingStatus").textContent = "铺设街区 · " + (typeof chunk.value === "string" ? chunk.value : "细化道路与立面");
            if (!synchronous) requestAnimationFrame(next);
            return;
          }
          iterator = null;
        }
        const elapsed = performance.now() - begin;
        if (SN.perf) SN.perf.initMax = Math.max(SN.perf.initMax, elapsed);
        index++;
        SN.$("loadingProgress").value = Math.round(index / count * 100);
        if (index < count) SN.$("startLabel").textContent = "正在构筑首尔 · " + Math.round(index / count * 100) + "%";
        SN.$("loadingStatus").textContent = index === count ? "街区已就绪" : (phase.order < 5 ? "铺设道路" : phase.order < 18 ? "构筑街景" : phase.order < 43 ? "准备车辆与市民" : "连接任务与操作") + " · " + Math.round(index / count * 100) + "%";
        // A first WebGL frame can appear before the city data is constructed.
        if (!synchronous && phase.order === 2) SN.renderer.render(SN.scene, SN.camera);
        if (index === count) SN.initializers.length = 0;
        else if (!synchronous) requestAnimationFrame(next);
      } catch (e) {
        index = count;
        console.error(e);
        SN.error.style.display = "block";
        SN.error.textContent = "启动失败：" + (e.message || String(e));
        SN.$("start").disabled = true;
        SN.$("start").textContent = "暂时无法启程";
      }
    };
    if (synchronous) { while (index < count) next(); }
    else requestAnimationFrame(next);
  };
})(window.SN);
(function (SN) {
  SN.rnd = function rnd() {
    SN.seed = (Math.imul(SN.seed, 1664525) + 1013904223) >>> 0;
    return SN.seed / 4294967296;
  };

  SN.rand = function rand(a, b) {
    return a + (b - a) * SN.rnd();
  };

  SN.angleDelta = function angleDelta(a, b) {
    let d = (b - a) % SN.TAU;
    if (d > SN.PI)
      d -= SN.TAU;
    if (d < -SN.PI)
      d += SN.TAU;
    return d;
  };

  SN.approachAngle = function approachAngle(a, b, t) {
    return a + SN.angleDelta(a, b) * Math.min(t, 1);
  };

  SN.qualityLevel = function qualityLevel() {
    return SN.quality.mode === "auto" ? SN.quality.level : (SN.quality.mode === "低" ? 0 : SN.quality.mode === "中" ? 1 : 2);
  };
  // Startup phase 1: keep this order relative to the other systems.

  SN.registerInit(1, function initializeCore1() {
    SN.T = window.THREE;
    SN.devMode = /(?:^|[?&])autostart=1(?:&|$)/.test(window.location ? window.location.search : "");
    const shotMatch = /(?:^|[?&])shot=([a-z]+)(?:&|$)/.exec(window.location ? window.location.search : "");
    SN.showcaseNames = ["street", "drive", "night", "river", "chase", "mission", "map", "slope", "closeup", "carclose", "rain"];
    SN.shotName = SN.devMode && shotMatch && SN.showcaseNames.includes(shotMatch[1]) ? shotMatch[1] : null;
    SN.showcase = null;
    SN.perfEnabled = /(?:^|[?&])perf=1(?:&|$)/.test(window.location ? window.location.search : "");
    SN.resolutionScale = 1;
    SN.contextLost = false; SN.contextRestorePending = false;
    SN.perf = { initMax: 0, frameMax: 0, cpuMs: 0, calls: 0, triangles: 0, textures: 0, geometries: 0, activeCars: 0, activeNPCs: 0,
      streamMs: 0, pendingTiles: 0, samples: 0, cursor: 0, history: new Float32Array(600 * 4) };
    // Materials are shared between instanced batches, and this engine version compiles one
    // program per material: every batch therefore needs a colour attribute (white by default).
    const BaseInstancedMesh = SN.T.InstancedMesh;
    SN.T.InstancedMesh = class TintableInstancedMesh extends BaseInstancedMesh {
      constructor(geometry, material, count) {
        super(geometry, material, count);
        this.instanceColor = new SN.T.InstancedBufferAttribute(new Float32Array(Math.max(count, 1) * 3).fill(1), 3);
      }
    };
    SN.PI = Math.PI;
    SN.TAU = SN.PI * 2;
    SN.WORLD = 3600;
    SN.EXTENT = 3700;
    SN.BIN_SIZE = 100;
    SN.BIN_COUNT = 74;
    SN.coarse = matchMedia("(any-pointer:coarse)").matches;
    SN.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    SN.lerp = (a, b, t) => a + (b - a) * t;
    SN.seed = 31107;
    SN.canvas = SN.$("world");
    SN.quality = { mode: "auto", level: SN.coarse ? 0 : 1 };
    SN.Q = [
      { ratio: 1, shadows: 0, map: 1024, far: 2200, fogNear: 850, fogFar: 2100 },
      { ratio: 1.25, shadows: 1, map: 1024, far: 2800, fogNear: 1000, fogFar: 2700 },
      { ratio: 1.5, shadows: 1, map: 1536, far: 3500, fogNear: 1100, fogFar: 3300 }
    ];
  });
})(window.SN);
