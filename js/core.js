/* 共享命名空间、常量、随机数与有序初始化。 */
"use strict";
window.SN = {};
(function (SN) {
  SN.$ = id => document.getElementById(id);
  SN.error = SN.$("error");
  SN.initializers = [];
  // Register every function before running the original startup sequence.

  SN.registerInit = function registerInit(order, run) {
    SN.initializers.push({ order, run });
  };

  SN.initialize = function initialize() {
    if (!window.THREE) {
      SN.error.style.display = "block";
      SN.error.textContent = "三维引擎未能载入。请检查网络连接，然后刷新页面。";
      SN.$("start").textContent = "引擎尚未就绪";
      return;
    }
    try {
      SN.initializers.sort((a, b) => a.order - b.order);
      for (const phase of SN.initializers)
        phase.run();
      SN.initializers.length = 0;
    }
    catch (e) {
      console.error(e);
      SN.error.style.display = "block";
      SN.error.textContent = "三维场景初始化失败：" + e.message + "。请使用支持 WebGL 的浏览器。";
      SN.$("start").disabled = true;
      SN.$("start").textContent = "暂时无法启程";
    }
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
    SN.PI = Math.PI;
    SN.TAU = SN.PI * 2;
    SN.WORLD = 3600;
    SN.EXTENT = 3700;
    SN.BIN_SIZE = 100;
    SN.BIN_COUNT = 74;
    SN.coarse = matchMedia("(pointer:coarse)").matches;
    SN.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    SN.lerp = (a, b, t) => a + (b - a) * t;
    SN.seed = 31107;
    SN.canvas = SN.$("world");
    SN.quality = { mode: "auto", level: 2 };
    SN.Q = [
      { ratio: 1, shadows: 0, map: 1024, far: 2200, fogNear: 650, fogFar: 1900 },
      { ratio: 1.25, shadows: 1, map: 1536, far: 2800, fogNear: 780, fogFar: 2400 },
      { ratio: 1.5, shadows: 1, map: 2048, far: 3500, fogNear: 900, fogFar: 3000 }
    ];
  });
})(window.SN);
