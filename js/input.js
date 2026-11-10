/* 键鼠、触屏、设置与开始游戏的事件绑定。 */
"use strict";
(function (SN) {
  SN.clearInput = function clearInput() {
    SN.firing = SN.aiming = false;
    SN.triggerPressed = false;
    SN.jumpBuffer = 0;
    if (SN.audio)
      SN.audio.gain.gain.setTargetAtTime(0, SN.audio.context.currentTime, 0.05);
    for (const k in SN.keys)
      SN.keys[k] = false;
    SN.touch.x = 0;
    SN.touch.y = 0;
    SN.touch.sprint = false;
    SN.touch.brake = false;
    if (SN.joy.id !== -1 && SN.joystick.hasPointerCapture(SN.joy.id))
      SN.joystick.releasePointerCapture(SN.joy.id);
    SN.joy.id = -1;
    SN.look.id = -1;
    SN.$("stick").style.transform = "translate(0px,0px)";
    if (SN.$("touchSprint").releaseControl)
      SN.$("touchSprint").releaseControl();
    if (SN.$("touchBrake").releaseControl)
      SN.$("touchBrake").releaseControl();
  };

  SN.jump = function jump() {
    if (SN.started && !SN.paused && !SN.player.car && !SN.player.dead)
      SN.jumpBuffer = 0.14;
  };

  SN.canControl = function canControl() {
    return SN.started && !SN.paused && !SN.player.dead && !SN.arrestState && !SN.cityMapOpen && !SN.journalOpen && !SN.storyDialogue && !SN.cinematic && !SN.shopMenuOpen;
  };

  SN.toggleGait = function toggleGait() {
    if (!SN.canControl())
      return;
    SN.player.walkMode = !SN.player.walkMode;
    SN.$("touchGait").textContent = SN.player.walkMode ? "行走 ✓" : "奔跑 ✓";
    SN.$("touchGait").setAttribute("aria-pressed", SN.player.walkMode);
    SN.toast(SN.player.walkMode ? "行走模式 · Shift / 疾跑按钮可临时加速" : "奔跑模式 · 摇杆小推仍可步行", 2);
  };

  SN.toggleBob = function toggleBob() {
    if (!SN.canControl())
      return;
    SN.bobEnabled = !SN.bobEnabled;
    SN.$("bobToggle").textContent = "镜头起伏：" + (SN.bobEnabled ? "开" : "关") + " · B";
    SN.$("bobToggle").setAttribute("aria-pressed", SN.bobEnabled);
  };

  SN.requestGamePointerLock = function requestGamePointerLock() {
    if (!SN.canvas.requestPointerLock)
      return;
    try {
      const result = SN.canvas.requestPointerLock();
      if (result && result.catch)
        result.catch(() => SN.toast("视角锁定未获浏览器许可 · 可按住拖动环顾", 3));
    }
    catch (_) {
      SN.toast("可按住鼠标拖动环顾", 2);
    }
  };

  SN.endLook = function endLook(e) {
    if (SN.look.id === e.pointerId)
      SN.look.id = -1;
    if (e.button === 0) {
      SN.firing = false;
      SN.triggerPressed = false;
    }
    if (e.button === 2)
      SN.aiming = false;
  };

  SN.moveJoy = function moveJoy(e) {
    if (e.pointerId !== SN.joy.id || !SN.canControl())
      return;
    let x = e.clientX - SN.joy.cx, y = e.clientY - SN.joy.cy;
    const d = Math.hypot(x, y), max = 40;
    if (d > max) {
      x *= max / d;
      y *= max / d;
    }
    SN.touch.x = x / max;
    SN.touch.y = -y / max;
    SN.$("stick").style.transform = "translate(" + x + "px," + y + "px)";
  };

  SN.endJoy = function endJoy(e) {
    if (e.pointerId === SN.joy.id) {
      SN.joy.id = -1;
      SN.touch.x = SN.touch.y = 0;
      SN.$("stick").style.transform = "translate(0px,0px)";
    }
  };

  SN.touchHold = function touchHold(id, key) {
    const el = SN.$(id);
    let pointer = -1;
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (!SN.canControl() || pointer !== -1)
        return;
      pointer = e.pointerId;
      el.setPointerCapture(pointer);
      SN.touch[key] = true;
      el.classList.add("held");
    });
    el.releaseControl = () => {
      if (pointer !== -1 && el.hasPointerCapture(pointer))
        el.releasePointerCapture(pointer);
      pointer = -1;
      SN.touch[key] = false;
      el.classList.remove("held");
    };
    const release = e => {
      if (pointer !== e.pointerId)
        return;
      el.releaseControl();
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("lostpointercapture", release);
  };

  SN.toggleSettings = function toggleSettings() {
    const open = SN.settingsPanel.classList.toggle("open");
    SN.$("settingsBtn").setAttribute("aria-expanded", open);
  };

  SN.startGame = function startGame() {
    SN.startAudio();
    if (SN.started)
      return;
    SN.started = true;
    SN.paused = false;
    document.documentElement.classList.add("playing");
    SN.$("intro").classList.add("hidden");
    SN.canvas.focus();
    SN.clearInput();
    SN.camYaw = SN.PI;
    SN.camPitch = 0.12;
    SN.camState.yaw = SN.PI;
    SN.camState.pitch = 0.12;
    SN.camState.dist = SN.zoom;
    SN.camState.velYaw = SN.camState.velPitch = SN.camState.velDist = 0;
    SN.camTarget.set(SN.player.x, SN.player.y + 1.3, SN.player.z);
    SN.lookTarget.copy(SN.camTarget);
    SN.camera.position.set(SN.player.x, SN.player.y + 2.8, SN.player.z + 5.5);
    SN.toast("欢迎来到首尔 · 金色标记指向联系人，靠近按 E。J 日志 · M 支线 · K 街行者换装。", 7);
    SN.refreshHUD();
  };
  // Startup phase 44: keep this order relative to the other systems.

  SN.registerInit(44, function initializeInput44() {
    SN.keys = Object.create(null);
    SN.touch = { x: 0, y: 0, sprint: false, brake: false };
    SN.joy = { id: -1, cx: 0, cy: 0 };
    SN.look = { id: -1, x: 0, y: 0 };
    SN.nearestCar = null;
    SN.nearDistance = 999;
    SN.nearestCarAt = -Infinity;
    SN.uiTick = 0;
    SN.impactCooldown = 0;
    SN.bobEnabled = false;
    SN.shoulderBlend = 0;
    SN.fpsVisible = false;
    SN.fpsAccum = 0;
    SN.fpsCount = 0;
    SN.camState = { yaw: 0, pitch: 0.12, dist: 5.5, velYaw: 0, velPitch: 0, velDist: 0 };
    SN.lookSens = 1;
    SN.aimSens = 0.65;
    SN.invertPitch = 1;
  });
  // Startup phase 46: keep this order relative to the other systems.

  SN.registerInit(46, function initializeInput46() {
    SN.triggerPressed = false;
    window.addEventListener("keydown", e => {
      if (e.code === "Backquote" && !e.repeat) {
        SN.fpsVisible = !SN.fpsVisible;
        SN.$("fps").classList.toggle("show", SN.fpsVisible);
        return;
      }
      if (!SN.started) {
        if (e.code === "Enter" && !e.repeat)
          SN.startGame();
        return;
      }
      if (e.code === "KeyN" && !e.repeat) {
        e.preventDefault();
        SN.toggleCityMap();
        return;
      }
      if (SN.cityMapOpen) {
        if (e.code === "Escape") {
          e.preventDefault();
          SN.toggleCityMap(false);
        }
        return;
      }
      if (["Space", "KeyJ", "KeyE", "Escape"].includes(e.code))
        e.preventDefault();
      if (e.repeat)
        return;
      if (SN.cinematic) {
        if (e.code === "Space" || e.code === "Escape")
          SN.endCinematic();
        return;
      }
      if (SN.storyDialogue) {
        if (e.code === "KeyE" || e.code === "Enter")
          SN.advanceDialogue();
        if (e.code === "Escape")
          SN.closeDialogue();
        return;
      }
      if (SN.shopMenuOpen) {
        if (e.code === "KeyE" || e.code === "Escape")
          SN.closeShopMenu();
        return;
      }
      if (e.code === "KeyJ" || SN.journalOpen && e.code === "Escape") {
        SN.toggleJournal();
        return;
      }
      if (!SN.canControl())
        return;
      if (e.target && typeof e.target.matches === "function" && e.target.matches("input,textarea,select"))
        return;
      if (e.code === "Space" || e.code.startsWith("Arrow") || e.code === "CapsLock")
        e.preventDefault();
      SN.keys[e.code] = true;
      if (e.code === "Space")
        SN.jump();
      if (e.code === "KeyF")
        SN.enterExit();
      if (e.code === "KeyR")
        SN.reload();
      if (e.code === "KeyH") {
        SN.holstered = !SN.holstered;
        SN.aiming = SN.firing = false;
        SN.reloadTime = 0;
      }
      if (e.code === "KeyC" || e.code === "CapsLock")
        SN.toggleGait();
      if (e.code === "KeyB")
        SN.toggleBob();
      if (e.code === "KeyQ")
        SN.cycleWeapon(-1);
      if (e.code === "KeyE")
        SN.interactStory();
      if (e.code === "KeyK")
        SN.cycleCostume();
      if (e.code === "KeyT")
        SN.cycleTimePreset();
      if (e.code === "KeyV")
        SN.toggleWet();
      if (/^Digit[1-3]$/.test(e.code))
        SN.selectWeapon(Number(e.code.slice(-1)) - 1);
      if (e.code === "KeyM")
        SN.nextMission();
      if (e.code === "KeyO")
        SN.toggleSettings();
    });
    window.addEventListener("keyup", e => {
      SN.keys[e.code] = false;
    });
    SN.canvas.addEventListener("contextmenu", e => e.preventDefault());
    SN.canvas.addEventListener("pointerdown", e => {
      if (!SN.canControl())
        return;
      SN.startAudio();
      if (e.pointerType !== "touch" && !SN.coarse && document.pointerLockElement !== SN.canvas) {
        SN.requestGamePointerLock();
        SN.look.id = e.pointerId;
        SN.look.x = e.clientX;
        SN.look.y = e.clientY;
        return;
      }
      if (e.pointerType === "touch") {
        if (e.clientX < innerWidth * 0.4)
          return;
        SN.firing = true;
        SN.triggerPressed = true;
      }
      else {
        if (e.button === 0) {
          SN.firing = true;
          SN.triggerPressed = true;
        }
        if (e.button === 2)
          SN.aiming = true;
      }
      if (document.pointerLockElement === SN.canvas)
        return;
      SN.look.id = e.pointerId;
      SN.look.x = e.clientX;
      SN.look.y = e.clientY;
      SN.canvas.setPointerCapture(e.pointerId);
    });
    SN.canvas.addEventListener("pointermove", e => {
      if (!SN.canControl())
        return;
      let dx = 0, dy = 0;
      if (document.pointerLockElement === SN.canvas) {
        dx = e.movementX;
        dy = e.movementY;
      }
      else if (SN.look.id === e.pointerId) {
        dx = e.clientX - SN.look.x;
        dy = e.clientY - SN.look.y;
        SN.look.x = e.clientX;
        SN.look.y = e.clientY;
      }
      else
        return;
      const sens = SN.lookSens * (SN.aiming ? SN.aimSens : 1);
      SN.camYaw = (SN.camYaw - dx * 0.0038 * sens) % SN.TAU;
      SN.camPitch = SN.clamp(SN.camPitch + dy * 0.0029 * sens * SN.invertPitch, -0.62, 1.05);
      SN.lookDelay = 3;
    });
    SN.canvas.addEventListener("pointerup", SN.endLook);
    SN.canvas.addEventListener("pointercancel", SN.endLook);
    SN.canvas.addEventListener("lostpointercapture", SN.endLook);
    window.addEventListener("pointerup", SN.endLook);
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === SN.canvas;
      document.documentElement.classList.toggle("locked", locked);
      if (!locked)
        SN.clearInput();
      else
        SN.look.id = -1;
    });
    SN.canvas.addEventListener("wheel", e => {
      e.preventDefault();
      if (SN.canControl())
        SN.zoom = SN.clamp(SN.zoom + e.deltaY * 0.008, 3, 15);
    }, { passive: false });
    SN.joystick = SN.$("joystick");
    SN.joystick.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (!SN.canControl() || SN.joy.id !== -1)
        return;
      const r = SN.joystick.getBoundingClientRect();
      SN.joy.id = e.pointerId;
      SN.joy.cx = r.left + r.width / 2;
      SN.joy.cy = r.top + r.height / 2;
      SN.joystick.setPointerCapture(e.pointerId);
      SN.moveJoy(e);
    });
    SN.joystick.addEventListener("pointermove", SN.moveJoy);
    SN.joystick.addEventListener("pointerup", SN.endJoy);
    SN.joystick.addEventListener("pointercancel", SN.endJoy);
    SN.joystick.addEventListener("lostpointercapture", SN.endJoy);
    SN.touchHold("touchSprint", "sprint");
    SN.touchHold("touchBrake", "brake");
    SN.$("touchEnter").addEventListener("pointerdown", e => {
      e.preventDefault();
      SN.enterExit();
    });
    SN.$("touchJump").addEventListener("pointerdown", e => {
      e.preventDefault();
      SN.jump();
    });
    SN.$("touchGait").addEventListener("click", SN.toggleGait);
    SN.$("bobToggle").addEventListener("click", SN.toggleBob);
    SN.$("qualityToggle").addEventListener("click", () => {
      const order = ["auto", "高", "中", "低"];
      const i = order.indexOf(SN.quality.mode);
      SN.quality.mode = order[(i + 1) % order.length];
      if (SN.quality.mode === "auto")
        SN.quality.level = 2;
      SN.applyQuality();
    });
    SN.settingsPanel = SN.$("settingsPanel");
    SN.$("settingsBtn").addEventListener("click", SN.toggleSettings);
    SN.$("cycleSpeed").addEventListener("change", event => {
      const value = Number(event.target.value);
      if ([24, 48, 96].includes(value)) {
        SN.cycleMinutes = value;
        SN.toast("昼夜循环 · " + SN.cycleMinutes + " 分钟 / 天", 2);
      }
    });
    SN.$("sensRange").addEventListener("input", e => {
      SN.lookSens = Number(e.target.value);
      SN.$("sensValue").textContent = SN.lookSens.toFixed(2) + "×";
    });
    SN.$("aimSensRange").addEventListener("input", e => {
      SN.aimSens = Number(e.target.value);
      SN.$("aimSensValue").textContent = SN.aimSens.toFixed(2) + "×";
    });
    SN.$("pitchRange").addEventListener("input", e => {
      SN.invertPitch = Number(e.target.value) ? -1 : 1;
      SN.$("invertValue").textContent = SN.invertPitch === 1 ? "标准" : "反转";
    });
    window.addEventListener("blur", () => {
      SN.clearInput();
      SN.paused = true;
      document.documentElement.classList.add("paused");
    });
    window.addEventListener("focus", () => {
      SN.paused = false;
      document.documentElement.classList.remove("paused");
    });
    document.addEventListener("visibilitychange", () => {
      SN.paused = document.hidden;
      if (SN.paused)
        SN.clearInput();
      document.documentElement.classList.toggle("paused", SN.paused);
    });
    SN.$("start").addEventListener("click", SN.startGame);
  });
})(window.SN);
