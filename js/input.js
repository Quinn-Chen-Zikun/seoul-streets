/* 键鼠、触屏、设置与开始游戏的事件绑定。 */
"use strict";
(function (SN) {
  SN.clearInput = function clearInput() {
    SN.firing = SN.aiming = false;
    SN.triggerPressed = false;
    SN.jumpBuffer = 0;
    if (SN.audio) {
      SN.audio.gain.gain.setTargetAtTime(0, SN.audio.context.currentTime, 0.05);
      SN.audio.world.gain.setTargetAtTime(0, SN.audio.context.currentTime, 0.04);
    }
    for (const k in SN.keys)
      SN.keys[k] = false;
    for (const el of SN.touchButtons) if (el.releaseControl) el.releaseControl();
    SN.endJoy({ pointerId: SN.joy.id });
    SN.look.id = -1;
    SN.touch.x = SN.touch.y = 0;
    SN.touch.aim = SN.touch.attack = SN.touch.sprint = SN.touch.brake = SN.touch.rear = SN.touch.accel = SN.touch.reverse = false;
  };

  SN.capturePointer = function capturePointer(el, e) {
    // Scripted pointer events have no browser-owned capture slot.
    if (e.isTrusted && el.setPointerCapture) {
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    }
  };

  SN.action = function action(code) {
    if (!SN.canControl()) return;
    switch (code) {
      case "Space": SN.jump(); break;
      case "KeyF": SN.enterExit(); break;
      case "KeyG": SN.honk(); break;
      case "KeyR": if (!SN.recoverVehicle()) SN.reload(); break;
      case "KeyH": SN.toggleHolster(); break;
      case "KeyQ": SN.cycleWeapon(-1); break;
      case "KeyE": SN.interactStory(); break;
      case "BracketLeft": SN.cycleRadio(-1); break;
      case "BracketRight": SN.cycleRadio(1); break;
      case "KeyY": SN.acceptStreetEvent(); break;
    }
  };

  SN.dragAim = function dragAim(dx, dy) {
    const sens = SN.lookSens * (SN.aiming ? SN.aimSens : 1);
    SN.camYaw = (SN.camYaw - dx * 0.0038 * sens) % SN.TAU;
    SN.camPitch = SN.clamp(SN.camPitch + dy * 0.0029 * sens * SN.invertPitch, -0.62, 1.05);
    SN.lookDelay = 3;
  };

  SN.beginJoy = function beginJoy(e) {
    e.preventDefault();
    if (!SN.canControl() || SN.joy.id !== -1) return;
    SN.joy.id = e.pointerId;
    const zone = SN.joyZone.getBoundingClientRect();
    SN.joy.cx = SN.clamp(e.clientX, zone.left + 64, Math.max(zone.left + 64, zone.left + zone.width - 64));
    SN.joy.cy = SN.clamp(e.clientY, zone.top + 64, Math.max(zone.top + 64, zone.top + zone.height - 64));
    SN.joystick.style.left = (SN.joy.cx - 63) + "px";
    SN.joystick.style.top = (SN.joy.cy - 63) + "px";
    SN.joystick.style.bottom = "auto";
    SN.joystick.classList.add("active");
    SN.capturePointer(SN.joyZone, e);
    SN.moveJoy(e);
  };

  SN.syncSuspension = function syncSuspension() {
    SN.paused = !!(SN.pauseOpen || SN.streetPanelOpen || SN.contextLost || SN.contextRestorePending || (!SN.devMode && (SN.windowBlurred || document.hidden)));
    SN.lastTime = performance.now(); SN.accumulator = 0;
    if (SN.paused && SN.touch) SN.clearInput();
    document.documentElement.classList.toggle("paused", SN.paused && !SN.pauseOpen);
  };

  SN.toggleFullscreen = function toggleFullscreen() {
    const root = document.documentElement;
    try {
      const pending = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen ? root.requestFullscreen() : null;
      if (pending && pending.catch) pending.catch(() => SN.toast("可从浏览器菜单添加到主屏幕，再横屏打开", 4));
      else if (!pending && !root.requestFullscreen) SN.toast("在浏览器分享菜单中添加到主屏幕，可获得更大视野", 4);
    } catch (_) { SN.toast("当前浏览器未能进入全屏", 3); }
  };

  SN.toggleHolster = function toggleHolster() {
    if (!SN.canControl()) return;
    if (SN.selectedWeapon < 0) SN.selectedWeapon = 0;
    SN.holstered = !SN.holstered;
    SN.aiming = SN.firing = false; SN.reloadTime = 0;
    SN.updateWeaponVisuals();
  };

  SN.jump = function jump() {
    if (SN.canControl() && !SN.player.car)
      SN.jumpBuffer = 0.14;
  };

  SN.canControl = function canControl() {
    return SN.started && !SN.contextLost && !SN.contextRestorePending && !SN.paused && !SN.pauseOpen && !SN.player.dead && !SN.arrestState && !SN.carjack && !SN.cableRide && !SN.player.vault && !SN.cityMapOpen && !SN.journalOpen && !SN.storyDialogue && !SN.cinematic && !SN.shopMenuOpen && !SN.streetPanelOpen && !(SN.campaign.active && SN.campaign.active.status === "failed");
  };

  SN.toggleGait = function toggleGait() {
    if (!SN.canControl() && !(SN.pauseOpen && !SN.player.dead && !SN.arrestState))
      return;
    SN.player.walkMode = !SN.player.walkMode;
    SN.$("touchGait").textContent = SN.player.walkMode ? "行走 ✓" : "奔跑 ✓";
    SN.$("touchGait").setAttribute("aria-pressed", SN.player.walkMode);
    SN.toast(SN.player.walkMode ? "行走模式 · Shift / 疾跑按钮可临时加速" : "奔跑模式 · 摇杆小推仍可步行", 2);
  };

  SN.toggleBob = function toggleBob() {
    if (!SN.started)
      return;
    SN.bobEnabled = !SN.bobEnabled;
    SN.$("bobToggle").textContent = "镜头起伏：" + (SN.bobEnabled ? "开" : "关") + " · B";
    SN.$("bobToggle").setAttribute("aria-pressed", SN.bobEnabled);
    SN.saveSettings();
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
    if (e.pointerType !== "touch" && e.button === 0) {
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
      const pointer = SN.joy.id;
      SN.joy.id = -1;
      if (pointer !== -1 && SN.joyZone.hasPointerCapture(pointer)) SN.joyZone.releasePointerCapture(pointer);
      SN.joystick.classList.remove("active");
      SN.joystick.style.left = SN.joystick.style.top = SN.joystick.style.bottom = "";
      SN.touch.x = SN.touch.y = 0;
      SN.$("stick").style.transform = "translate(0px,0px)";
    }
  };

  SN.touchHold = function touchHold(id, key) {
    const el = SN.$(id);
    let pointer = -1, lastX = 0, lastY = 0;
    SN.touchButtons.push(el);
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (!SN.canControl() || pointer !== -1)
        return;
      pointer = e.pointerId;
      SN.capturePointer(el, e);
      lastX = e.clientX; lastY = e.clientY;
      SN.startAudio();
      SN.touch[key] = true;
      if (key === "aim") SN.aiming = true;
      if (key === "sprint" && SN.player.car) SN.action("KeyG");
      if (key === "attack")
        SN.firing = SN.triggerPressed = true;
      el.classList.add("held");
    });
    el.addEventListener("pointermove", e => {
      if (key !== "attack" || e.pointerId !== pointer || !SN.canControl()) return;
      SN.dragAim(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
    });
    el.releaseControl = () => {
      const old = pointer; pointer = -1;
      if (old !== -1 && el.hasPointerCapture(old)) el.releasePointerCapture(old);
      SN.touch[key] = false;
      if (key === "aim") SN.aiming = false;
      if (key === "attack")
        SN.firing = SN.triggerPressed = false;
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

  SN.togglePause = function togglePause(force) {
    if (!SN.started)
      return;
    SN.pauseOpen = typeof force === "boolean" ? force : !SN.pauseOpen;
    SN.syncSuspension();
    SN.clearInput();
    SN.$("pauseMenu").classList.toggle("open", SN.pauseOpen);
    if (!SN.pauseOpen) { SN.settingsPanel.classList.remove("open"); SN.$("settingsBtn").setAttribute("aria-expanded", false); }
    document.documentElement.classList.toggle("menu-paused", SN.pauseOpen);
    if (SN.pauseOpen) {
      for (const id of ["cityHour", "cityWeather", "weatherAuto"]) SN.$(id).disabled = !!SN.campaign.active;
      SN.$("cityWeatherHint").textContent = SN.campaign.active ? "委托进行中，时刻与天气锁定" : "自由漫游可调整时刻与天气";
      SN.$("weatherAuto").textContent = "自然天气：" + (SN.weather.auto ? "开" : "关");
      if (document.pointerLockElement)
        document.exitPointerLock();
      SN.$("resumeBtn").focus();
    }
    else {
      SN.lastTime = performance.now();
      SN.accumulator = 0;
      SN.canvas.focus();
    }
  };

  SN.toggleSettings = function toggleSettings() {
    if (!SN.pauseOpen)
      SN.togglePause(true);
    const open = SN.settingsPanel.classList.toggle("open");
    SN.$("settingsBtn").setAttribute("aria-expanded", open);
  };

  SN.saveSettings = function saveSettings() {
    if (SN.devMode) return;
    try { localStorage.setItem("seoul-settings-v1", JSON.stringify({ sensitivity: SN.lookSens,
      aim: SN.aimSens, invert: SN.invertPitch, quality: SN.quality.mode, cycle: SN.cycleMinutes,
      bob: SN.bobEnabled, damageNumbers: SN.damageNumbers })); } catch (_) { SN.storageUnavailable = true; }
  };

  SN.loadSettings = function loadSettings(data) {
    if (data === undefined) {
      if (SN.devMode) return;
      try { const raw = localStorage.getItem("seoul-settings-v1"); if (raw && raw.length < 8192) data = JSON.parse(raw); } catch (_) { SN.storageUnavailable = true; return; }
    }
    if (!data || typeof data !== "object") return;
    if (Number.isFinite(data.sensitivity)) SN.lookSens = SN.clamp(data.sensitivity, 0.3, 2.4);
    if (Number.isFinite(data.aim)) SN.aimSens = SN.clamp(data.aim, 0.25, 1.5);
    SN.invertPitch = data.invert === -1 ? -1 : 1;
    SN.bobEnabled = data.bob === true; SN.damageNumbers = data.damageNumbers === true;
    if ([24, 48, 96].includes(data.cycle)) SN.cycleMinutes = data.cycle;
    if (["auto", "高", "中", "低"].includes(data.quality)) SN.quality.mode = data.quality;
    SN.applyQuality();
    SN.$("sensRange").value = SN.lookSens; SN.$("sensValue").textContent = SN.lookSens.toFixed(2) + "×";
    SN.$("aimSensRange").value = SN.aimSens; SN.$("aimSensValue").textContent = SN.aimSens.toFixed(2) + "×";
    SN.$("pitchRange").value = SN.invertPitch === -1 ? 1 : 0;
    SN.$("invertValue").textContent = SN.invertPitch === -1 ? "反转" : "标准";
    SN.$("cycleSpeed").value = SN.cycleMinutes; SN.$("damageNumbers").checked = SN.damageNumbers;
    SN.$("bobToggle").textContent = "镜头起伏：" + (SN.bobEnabled ? "开" : "关") + " · B";
    SN.$("bobToggle").setAttribute("aria-pressed", SN.bobEnabled);
  };

  SN.startGame = function startGame() {
    if (SN.$("start").disabled)
      return;
    if (!SN.devMode) SN.startAudio();
    if (SN.started)
      return;
    if (SN.menuPreview) { SN.minutes = SN.menuPreview.minutes; SN.menuPreview = null; }
    SN.started = true;
    SN.syncSuspension();
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
    SN.lastDistrict = "";
    if (!SN.devMode) SN.beginOnboarding();
    if (!SN.onboarding) SN.toast(SN.coarse ? "跟随金色标记，靠近联系人接取任务" : "跟随金色标记 · 靠近按 E 接取任务", 3.5);
    SN.refreshHUD();
    if (SN.campaign.active && SN.campaign.active.status === "suspended") SN.retryCheckpoint();
  };
  // Startup phase 44: keep this order relative to the other systems.

  SN.registerInit(44, function initializeInput44() {
    SN.keys = Object.create(null);
    SN.touch = { x: 0, y: 0, sprint: false, brake: false, attack: false, accel: false, reverse: false, aim: false, rear: false };
    SN.touchButtons = [];
    SN.touchVehicleMode = false;
    SN.driveInput = { throttle: 0, steer: 0, brake: false };
    SN.windowBlurred = false;
    SN.pauseOpen = false;
    SN.joy = { id: -1, cx: 0, cy: 0 };
    SN.look = { id: -1, x: 0, y: 0 };
    SN.nearestCar = null;
    SN.nearDistance = 999;
    SN.nearestCarAt = -Infinity;
    SN.uiTick = 0;
    SN.impactCooldown = 0;
    SN.bobEnabled = false;
    SN.shoulderBlend = 0;
    SN.fpsVisible = SN.perfEnabled;
    SN.$("fps").classList.toggle("show", SN.fpsVisible);
    SN.fpsAccum = 0;
    SN.fpsCount = 0;
    SN.camState = { yaw: 0, pitch: 0.12, dist: 5.5, velYaw: 0, velPitch: 0, velDist: 0 };
    SN.lookSens = 1;
    SN.aimSens = 0.65;
    SN.invertPitch = 1;
    SN.damageNumbers = false;
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
      if (SN.pauseOpen) {
        if ((e.code === "Escape" || e.key === "?") && !e.repeat) {
          e.preventDefault();
          if (SN.settingsPanel.classList.contains("open")) SN.toggleSettings();
          else SN.togglePause(false);
        }
        if (e.code === "Tab") {
          const items = Array.from(SN.$("pauseMenu").querySelectorAll("button,input,select")).filter(el => el.getClientRects().length && !el.disabled);
          const index = items.indexOf(document.activeElement);
          if (items.length) {
            e.preventDefault();
            items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
          }
        }
        return;
      }
      if (SN.streetPanelOpen) { if (e.code === "Escape") SN.closeStreetPanel(); return; }
      if ((e.code === "KeyN" || e.code === "Tab") && !e.repeat) {
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
      if (SN.journalOpen)
        return;
      if ((e.code === "Escape" || e.key === "?") && !e.repeat) {
        e.preventDefault();
        SN.togglePause(true);
        return;
      }
      if (!SN.canControl())
        return;
      if (e.target && typeof e.target.matches === "function" && e.target.matches("input,textarea,select"))
        return;
      if (e.code === "Space" || e.code.startsWith("Arrow") || e.code === "CapsLock")
        e.preventDefault();
      SN.keys[e.code] = true;
      SN.action(e.code);
      if (e.code === "KeyU") SN.startVehicleJob();
      if (e.code === "KeyC" || e.code === "CapsLock")
        SN.toggleGait();
      if (e.code === "KeyB")
        SN.toggleBob();
      if (e.code === "KeyK")
        SN.cycleCostume();
      if (e.code === "KeyT")
        SN.cycleTimePreset();
      if (e.code === "KeyV")
        SN.toggleWet();
      if (/^Digit[1-7]$/.test(e.code))
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
        if (e.clientX < innerWidth * 0.44 || SN.look.id !== -1) return;
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
      SN.capturePointer(SN.canvas, e);
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
      SN.dragAim(dx, dy);
    });
    SN.canvas.addEventListener("pointerup", SN.endLook);
    SN.canvas.addEventListener("pointercancel", SN.endLook);
    SN.canvas.addEventListener("lostpointercapture", SN.endLook);
    window.addEventListener("pointerup", SN.endLook);
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === SN.canvas;
      document.documentElement.classList.toggle("locked", locked);
      if (!locked) {
        const mayPause = SN.canControl();
        SN.clearInput();
        if (mayPause)
          SN.togglePause(true);
      }
      else
        SN.look.id = -1;
    });
    SN.canvas.addEventListener("wheel", e => {
      e.preventDefault();
      if (SN.canControl())
        SN.zoom = SN.clamp(SN.zoom + e.deltaY * 0.008, 3, 15);
    }, { passive: false });
    SN.joystick = SN.$("joystick");
    SN.joyZone = SN.$("joyZone");
    for (const el of [SN.joyZone, SN.joystick]) {
      el.addEventListener("pointerdown", SN.beginJoy);
      el.addEventListener("pointermove", SN.moveJoy);
      el.addEventListener("pointerup", SN.endJoy);
      el.addEventListener("pointercancel", SN.endJoy);
      el.addEventListener("lostpointercapture", SN.endJoy);
    }
    SN.touchHold("touchSprint", "sprint");
    SN.touchHold("touchJump", "brake");
    SN.touchHold("touchAttack", "attack");
    SN.touchHold("touchAim", "aim");
    SN.touchHold("touchRear", "rear");
    SN.touchHold("touchAccel", "accel");
    SN.touchHold("touchBrake", "reverse");
    for (const pair of [["touchHolster", "KeyH"], ["touchEnter", "KeyF"], ["touchJump", "Space"], ["touchWeapon", "KeyQ"]]) {
      SN.$(pair[0]).addEventListener("pointerdown", e => { e.preventDefault(); SN.action(pair[1]); });
    }
    SN.$("fullscreenBtn").addEventListener("click", SN.toggleFullscreen);
    document.addEventListener("fullscreenchange", () => { SN.queueResize(); SN.$("fullscreenBtn").textContent = document.fullscreenElement ? "退出全屏" : "全屏"; });
    for (const type of ["gesturestart", "gesturechange", "gestureend"])
      document.addEventListener(type, e => e.preventDefault(), { passive: false });
    SN.$("touchGait").addEventListener("click", SN.toggleGait);
    SN.$("bobToggle").addEventListener("click", SN.toggleBob);
    SN.$("qualityToggle").addEventListener("click", () => {
      const order = ["auto", "高", "中", "低"];
      const i = order.indexOf(SN.quality.mode);
      SN.quality.mode = order[(i + 1) % order.length];
      if (SN.quality.mode === "auto")
        SN.quality.level = SN.coarse ? 0 : 1;
      SN.applyQuality();
      SN.saveSettings();
    });
    SN.settingsPanel = SN.$("settingsPanel");
    SN.$("settingsBtn").addEventListener("click", SN.toggleSettings);
    SN.$("pauseBtn").addEventListener("click", () => SN.togglePause(true));
    SN.$("resumeBtn").addEventListener("click", () => SN.togglePause(false));
    SN.$("hailTaxi").addEventListener("click", () => { SN.togglePause(false); SN.hailTaxi(); });
    SN.$("pauseMap").addEventListener("click", () => { SN.togglePause(false); SN.toggleCityMap(true); });
    SN.$("weaponSlots").addEventListener("click", () => { if (SN.canControl()) SN.cycleWeapon(1); });
    SN.$("ammo").addEventListener("click", () => SN.action("KeyR"));
    SN.$("controlsBtn").addEventListener("click", () => SN.$("controlsGuide").scrollIntoView({ block: "start", behavior: "smooth" }));
    SN.$("damageNumbers").addEventListener("change", e => { SN.damageNumbers = e.target.checked; SN.saveSettings(); });
    SN.$("cycleSpeed").addEventListener("change", event => {
      const value = Number(event.target.value);
      if ([24, 48, 96].includes(value)) {
        SN.cycleMinutes = value;
        SN.saveSettings();
        SN.toast("昼夜循环 · " + SN.cycleMinutes + " 分钟 / 天", 2);
      }
    });
    SN.$("sensRange").addEventListener("input", e => {
      SN.lookSens = Number(e.target.value);
      SN.$("sensValue").textContent = SN.lookSens.toFixed(2) + "×";
      SN.saveSettings();
    });
    SN.$("aimSensRange").addEventListener("input", e => {
      SN.aimSens = Number(e.target.value);
      SN.$("aimSensValue").textContent = SN.aimSens.toFixed(2) + "×";
      SN.saveSettings();
    });
    SN.$("volumeRange").value = SN.masterVolume;
    SN.setMasterVolume(SN.masterVolume);
    SN.$("volumeRange").addEventListener("input", e => SN.setMasterVolume(e.target.value));
    SN.$("muteAudio").addEventListener("click", () => SN.setMasterVolume(SN.masterVolume, !SN.audioMuted));
    SN.$("pitchRange").addEventListener("input", e => {
      SN.invertPitch = Number(e.target.value) ? -1 : 1;
      SN.$("invertValue").textContent = SN.invertPitch === 1 ? "标准" : "反转";
      SN.saveSettings();
    });
    window.addEventListener("blur", () => { SN.windowBlurred = true; SN.syncSuspension(); });
    window.addEventListener("focus", () => { SN.windowBlurred = false; SN.syncSuspension(); });
    document.addEventListener("visibilitychange", SN.syncSuspension);
    SN.$("start").addEventListener("click", SN.startGame);
    SN.loadSettings();
  });
})(window.SN);
