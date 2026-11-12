/* 街头活动、任务标记、收藏、房产、统计与本机进度。 */
"use strict";
(function (SN) {
  const ESCORT_TURNS = [0, 0.7, -0.7, 1.35, -1.35];
  SN.freshProgression = function freshProgression() {
    return { hair: 0, cityOutfit: 0, respect: 0, cats: [], jumps: [], properties: {}, tutorial: [], home: null,
      stats: { missionsPassed: 0, activitiesPassed: 0, driven: 0, walked: 0, carsStolen: 0, starsSurvived: 0, playSeconds: 0 } };
  };

  SN.restoreProgression = function restoreProgression(data) {
    const p = SN.freshProgression();
    if (data && typeof data === "object") {
      const number = (v, max) => Number.isFinite(v) ? SN.clamp(v, 0, max) : 0;
      p.respect = number(data.respect, 9999999);
      p.hair = Number.isInteger(data.hair) ? SN.clamp(data.hair, 0, 2) : 0;
      p.cityOutfit = Number.isInteger(data.cityOutfit) ? SN.clamp(data.cityOutfit, 0, 2) : 0;
      p.cats = Array.isArray(data.cats) ? [...new Set(data.cats.filter(i => Number.isInteger(i) && i >= 0 && i < 100))] : [];
      p.jumps = Array.isArray(data.jumps) ? [...new Set(data.jumps.filter(i => Number.isInteger(i) && i >= 0 && i < SN.stuntJumps.length))] : [];
      p.tutorial = Array.isArray(data.tutorial) ? data.tutorial.filter(i => Number.isInteger(i) && i >= 0 && i < 6) : [];
      for (const key of Object.keys(p.stats)) p.stats[key] = number(data.stats && data.stats[key], 1e9);
      for (const home of SN.properties) {
        const value = data.properties && data.properties[home.id];
        if (!value || typeof value !== "object") continue;
        const car = value.car;
        p.properties[home.id] = { bank: number(value.bank, home.income * 12), clock: number(value.clock, 120), car: null };
        if (car && Number.isInteger(car.type) && SN.vehicleSpecs[car.type])
          p.properties[home.id].car = { type: car.type, health: SN.clamp(number(car.health, 100), 1, 100), paint: number(car.paint, 0xffffff) };
      }
      p.home = SN.properties.some(home => home.id === data.home && p.properties[home.id]) ? data.home : null;
    }
    SN.progression = p;
    if (p.home) SN.moveToHome(SN.properties.find(h => h.id === p.home));
  };

  SN.moveToHome = function moveToHome(home) {
    if (!home) return;
    const p = SN.safePosition(home.x, home.z, 0.5);
    Object.assign(SN.player, p, { y: SN.surfaceHeight(p.x, p.z), grounded: true, vy: 0 });
    SN.player.fallPeak = SN.player.y; SN.player.bail = SN.player.vault = null;
    SN.player.speed = SN.player.motionSpeed = 0;
    SN.playerRoot.position.set(p.x, SN.player.y, p.z);
    SN.populationClock = -1;
  };

  SN.newCampaign = function newCampaign() {
    if (SN.started) return;
    if (SN.menuPreview) SN.menuPreview.minutes = 630;
    SN.minutes = 630;
    SN.campaign.progress = 0; SN.campaign.jobIndex = 0;
    SN.campaign.jobWins = SN.sideJobs.map(() => 0);
    SN.campaign.active = SN.campaign.checkpoint = null;
    SN.campaign.tracked = "story"; SN.campaign.costume = "street";
    SN.campaign.unlocks = ["street", "night"]; SN.campaign.loadoutLost = false;
    SN.progression = SN.freshProgression(); SN.money = 2400; SN.completed = 0;
    SN.phoneCredit = 0; SN.phoneMapped = false;
    for (const [i, w] of SN.weapons.entries()) { w.owned = i < 2; w.mag = i === 1 ? w.capacity : 0; w.reserve = i === 1 ? 24 : 0; }
    SN.holstered = true; SN.selectedWeapon = 0;
    Object.assign(SN.player, { health: 100, armor: 60, dead: 0, car: null, walkMode: false, yaw: SN.PI });
    SN.tutorialUntil = 0; SN.onboarding = null;
    SN.moveToHome({ x: -40, z: -770 }); SN.applyCostume();
    SN.updateCatInstances(); SN.updateStreetMarkers(); SN.snapPlayer();
    SN.saveCampaign(); SN.startGame();
  };

  SN.validateStoryData = function validateStoryData() {
    const types = ["go", "collect", "delivery", "tail", "chase", "ambush", "escape", "taxiPickup", "taxiDrop", "race", "fight", "defend", "vehicle", "drive", "escort"];
    for (const list of [SN.storyMissions, SN.sideJobs]) for (let index = 0; index < list.length; index++) {
      if (!list[index] || typeof list[index] !== "object") {
        SN.reportContentProblem("mission-" + index, -30, -765, "无效委托数据", "替换为返回联系人目标");
        list[index] = { id: "recovery-" + index, title: "返回联系人", giver: "mentor", reward: 0 };
      }
      const m = list[index];
      const warn = message => SN.reportContentProblem("mission-" + m.id, -30, -765, message, "修正后继续");
      if (!SN.contacts.some(c => c.id === m.giver)) { warn("联系人不存在"); m.giver = "mentor"; }
      if (!Number.isFinite(m.limit) || m.limit <= 0) { warn("无效时限"); m.limit = 360; }
      if (!Number.isFinite(m.totalLimit) || m.totalLimit <= 0) m.totalLimit = m.limit;
      if (!Number.isFinite(m.reward) || m.reward < 0) { warn("无效报酬"); m.reward = 0; }
      for (const key of ["unlock", "requiredVehicle"]) if (m[key] !== undefined && (!Number.isInteger(m[key]) || !(key === "unlock" ? SN.weapons : SN.vehicleSpecs)[m[key]])) { warn("无效解锁或车型"); delete m[key]; }
      if (!Array.isArray(m.objectives) || !m.objectives.length) { warn("空目标列表"); m.objectives = [{ type: "go", text: "回钟路确认委托", x: -30, z: -765, r: 5 }]; }
      for (let i = 0; i < m.objectives.length; i++) {
        if (!m.objectives[i] || typeof m.objectives[i] !== "object") { warn("无效目标"); m.objectives[i] = { type: "go", text: "回钟路确认委托", x: -30, z: -765 }; }
        const o = m.objectives[i];
        if (!types.includes(o.type)) { warn("未知目标类型"); o.type = "go"; }
        if (o.contact && !SN.contacts.some(c => c.id === o.contact)) { warn("目标联系人不存在"); o.contact = "mentor"; }
        if (o.type !== "escape" && !o.contact && ![o.x, o.z].every(Number.isFinite)) { warn("无效目标坐标"); o.x = -30; o.z = -765; }
        if (!Number.isFinite(o.r) || o.r <= 0) o.r = ["drive", "race", "taxiPickup", "taxiDrop"].includes(o.type) ? 12 : 5;
        if (o.seconds !== undefined && (!Number.isFinite(o.seconds) || o.seconds <= 0)) { warn("无效目标时限"); o.seconds = m.limit; }
        if (o.type === "fight") o.count = Number.isFinite(o.count) ? SN.clamp(Math.floor(o.count), 1, 8) : 3;
        if (["tail", "defend"].includes(o.type) && (!Number.isFinite(o.duration) || o.duration <= 0)) { warn("无效持续时长"); o.duration = 30; }
        if (o.type === "escape" || o.heat !== undefined) o.heat = Number.isFinite(o.heat) ? SN.clamp(Math.ceil(o.heat), 0, 5) : 1;
        if (o.supply !== undefined && (!Number.isInteger(o.supply) || !SN.weapons[o.supply])) { warn("无效补给武器"); o.supply = 1; }
        if ((o.type === "vehicle" || o.vehicleType !== undefined) && (!Number.isInteger(o.vehicleType) || !SN.vehicleSpecs[o.vehicleType])) { warn("无效任务车辆"); o.vehicleType = 3; }
        if (o.type === "escort" && (!Array.isArray(o.from) || o.from.length !== 2 || !o.from.every(Number.isFinite))) { warn("无效护送起点"); o.from = [o.x, o.z]; }
        if (o.route && (!Array.isArray(o.route) || o.route.length < 2 || o.route.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)))) { warn("无效车队路线"); delete o.route; }
      }
    }
  };

  SN.missionStart = function missionStart(m) {
    return m.start || SN.contacts.find(c => c.id === m.giver) || SN.contacts[0];
  };

  SN.canStartActivity = function canStartActivity(m) {
    const c = SN.player.car;
    if (SN.heat > 0) { SN.toast("先摆脱通缉，再与联系人确认委托", 3); return false; }
    if (m.requiredVehicle !== undefined && (!c || c.type !== m.requiredVehicle)) {
      SN.toast("请驾驶" + SN.vehicleSpecs[m.requiredVehicle].name + "接取这项工作", 3); return false;
    }
    if (m.requiredPolice && (!c || c.role !== "police" && ![9, 12, 13].includes(c.type))) {
      SN.toast("请驾驶警车接取街区巡查", 3); return false;
    }
    if (m.requiresCar && !c) { SN.toast("先上车，再接取桥赛", 3); return false; }
    return true;
  };

  SN.placeMissionVehicle = function placeMissionVehicle(car, x, z, type, destination = null) {
    // Leave an occupied commission car at its old location before staging it again.
    if (SN.player.car === car) {
      SN.enterExit();
      if (SN.player.car === car) {
        const exit = SN.safePosition(car.x + car.spec.width + 2, car.z, 0.35, car);
        SN.player.car = null;
        Object.assign(SN.player, exit, { y: SN.surfaceHeight(exit.x, exit.z), vy: 0, speed: 0, motionSpeed: 0, grounded: true });
        SN.playerRoot.visible = true;
        SN.snapPlayer();
      }
    }
    if (car.occupant) SN.dismount(car);
    if (type !== undefined && car.type !== type) SN.fitVehicle(car, type);
    SN.repairVehicle(car);
    // Select a real lane point, then check the whole vehicle hull before placing it.
    const route = destination ? SN.roadRoute({ x, z }, destination) : [], ahead = route.find(p => Math.hypot(p.x - x, p.z - z) > 15);
    const score = p => Math.hypot(p.x - x, p.z - z) + (ahead && (ahead.x - p.x) * Math.sin(p.yaw) + (ahead.z - p.z) * Math.cos(p.yaw) < 0 ? 45 : 0);
    const candidates = SN.roadSpawnPoints.slice().sort((a, b) => score(a) - score(b));
    const p = candidates.find(p => !SN.carBlocked(p.x, p.z, p.yaw, car) && !SN.carWater(p.x, p.z, p.yaw, car) &&
      !SN.cars.some(c => c !== car && c.active && Math.hypot(c.x - p.x, c.z - p.z) < 6)) || SN.safePosition(x, z, 2, car);
    const yaw = Number.isFinite(p.yaw) ? p.yaw : car.yaw;
    Object.assign(car, { x: p.x, z: p.z, y: SN.surfaceHeight(p.x, p.z), yaw,
      active: true, parked: true, freeRolling: false, driver: false, speed: 0, vx: 0, vz: 0, vy: 0, airborne: false });
    SN.resetVehicleGround(car);
    car.root.position.set(car.x, car.y, car.z); car.root.visible = true;
    SN.snapCars();
    return car;
  };

  SN.prepareStreetObjective = function prepareStreetObjective(a, m, o) {
    if (o.supply !== undefined) {
      const w = SN.weapons[o.supply]; w.owned = true; w.mag = w.capacity; w.reserve = Math.max(w.reserve, w.capacity * 5);
    }
    if (o.heat && o.type !== "escape") SN.forceWanted(o.heat, "任务目标 · 警方通缉");
    if (o.type === "vehicle") {
      a.contractCar = SN.placeMissionVehicle(SN.contractCar, o.x, o.z, o.vehicleType, m.objectives[a.step + 1]);
      if (o.contract) { a.contractCar.paintColor = 0xf7f4e8; SN.repairVehicle(a.contractCar); }
    }
    if (o.type === "drive" && o.contract && !a.contractCar)
      a.contractCar = SN.placeMissionVehicle(SN.contractCar, a.spawn.x, a.spawn.z, 7);
    if ((o.escortCar || m.id === "ferry" && a.step >= 3) && !a.taxi) {
      a.taxi = SN.placeMissionVehicle(SN.contractCar, a.spawn.x, a.spawn.z, 3);
      SN.toast("证人正在出租车旁等待 · 上车后继续护送", 4);
    }
    if (o.type === "drive" && !SN.player.car && !o.contract && !o.escortCar) SN.stageLoanCar(o.vehicleType);
    if (o.type === "escort") {
      const from = SN.safePosition(o.from[0], o.from[1], 0.4);
      Object.assign(SN.escortActor, from, { health: 100, stuck: 0, breadcrumbs: [] });
      SN.escortActor.rig.root.visible = true;
      SN.spawnEncounter({ x: o.x, z: o.z, melee: true }, 2, 0);
    }
    if (m.id === "arrival" && o.hint && !SN.progression.tutorial.includes(a.step)) {
      SN.progression.tutorial.push(a.step);
      SN.tutorialUntil = SN.simTime + 9;
      SN.setText("tutorialHint", o.hint);
    }
  };

  SN.stageConvoy = function stageConvoy(o) {
    for (const [i, c] of SN.convoyCars.entries()) {
      SN.placeMissionVehicle(c, o.x, o.z - (i + 1) * 18, 4);
      Object.assign(c, { route: SN.missionRoadCircuit(o.route || SN.missionCar.route), index: 0, cruise: 13, parked: false, driver: true });
    }
  };

  SN.updateStreetObjective = function updateStreetObjective(a, o, dt, distance) {
    if (o.type === "vehicle") return SN.player.car === a.contractCar;
    if (o.type === "drive") {
      const required = o.escortCar ? a.taxi : o.contract ? a.contractCar : null, car = required || SN.player.car;
      a.outside = required && SN.player.car !== required ? a.outside + dt : 0;
      if (required && (required.health < (o.minHealth || 1) || required.exploded || a.outside > 20)) {
        SN.failMission(o.escortCar ? "证人护送中断" : "委托车辆受损或被遗弃"); return false;
      }
      return !!car && SN.player.car === car && (o.vehicleType === undefined || car.type === o.vehicleType) &&
        distance < (o.r || 12) && Math.abs(car.speed) < 6;
    }
    if (o.type === "escort") {
      const e = SN.escortActor, d = Math.hypot(e.x - SN.player.x, e.z - SN.player.z);
      a.lost = d > 35 ? a.lost + dt : 0;
      let threats = 0;
      for (const enemy of SN.encounterActors)
        if (enemy.health > 0 && (enemy.x - e.x) ** 2 + (enemy.z - e.z) ** 2 < 9) threats++;
      e.health = Math.max(0, e.health - threats * dt * 9);
      if (e.health <= 0 || a.lost > 12) { SN.failMission(e.health <= 0 ? "护送对象倒下" : "护送对象跟丢了你"); return false; }
      let moved = 0;
      if (!SN.player.car && d > 2 && d < 35) {
        const trail = e.breadcrumbs, last = trail[trail.length - 1];
        if (!last || Math.hypot(last.x - SN.player.x, last.z - SN.player.z) > 1.4) {
          trail.push({ x: SN.player.x, z: SN.player.z }); if (trail.length > 32) trail.shift();
        }
        while (trail.length > 1 && Math.hypot(trail[0].x - e.x, trail[0].z - e.z) < 1.5) trail.shift();
        const target = trail[0] || SN.player, direction = Math.atan2(target.x - e.x, target.z - e.z), step = Math.min(d - 2, dt * 4.2);
        let best = null, score = Infinity;
        for (const turn of ESCORT_TURNS) {
          const p = SN.resolveCircle(e.x + Math.sin(direction + turn) * step, e.z + Math.cos(direction + turn) * step, 0.35);
          const progress = Math.hypot(p.x - e.x, p.z - e.z);
          if (progress < step * 0.2 || SN.isWater(p.x, p.z, 0.35)) continue;
          const value = Math.hypot(p.x - target.x, p.z - target.z);
          if (value < score) { best = { x: p.x, z: p.z }; score = value; }
        }
        if (best) { moved = Math.hypot(best.x - e.x, best.z - e.z); e.x = best.x; e.z = best.z; }
        e.stuck = moved < dt * 0.4 ? (e.stuck || 0) + dt : 0;
        if (e.stuck > 3 && d < 25) {
          const safe = SN.safePosition(SN.player.x - Math.sin(SN.player.yaw) * 3, SN.player.z - Math.cos(SN.player.yaw) * 3, 0.4);
          e.x = safe.x; e.z = safe.z; e.stuck = 0; trail.length = 0;
          SN.toast("护送对象已跟上", 2);
        }
      }
      SN.advanceGait(e.rig, moved, dt, 1);
      e.rig.root.position.set(e.x, SN.surfaceHeight(e.x, e.z), e.z);
      e.rig.root.rotation.y = Math.atan2(SN.player.x - e.x, SN.player.z - e.z);
      SN.poseRig(e.rig, moved / Math.max(dt, 0.001), 0, SN.simTime, false, false, 0, -1);
      return Math.hypot(e.x - o.x, e.z - o.z) < o.r;
    }
    return false;
  };

  SN.showMissionResult = function showMissionResult(pass, m, reason) {
    SN.resultUntil = pass ? SN.simTime + 3.5 : Infinity;
    SN.soundStinger(pass);
    if (pass) SN.slowMotion = 1.15;
    SN.$("missionResult").classList.add("visible");
    SN.$("missionResult").classList.toggle("failed", !pass);
    SN.setText("resultTitle", pass ? "任务完成" : "任务失败");
    SN.setText("resultDetail", m.title + " · " + (pass ? SN.rewardLabel(m) : reason));
    SN.setText("resultStory", pass ? reason : "此前目标已保存，可立即从检查点重试。");
    SN.$("resultRetry").hidden = pass; SN.$("resultLeave").hidden = pass;
    if (!pass) {
      SN.clearInput();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  };
  SN.hideMissionResult = function hideMissionResult() {
    SN.resultUntil = 0;
    if (!SN.resultElement) SN.resultElement = SN.$("missionResult");
    SN.resultElement.classList.remove("visible");
  };

  SN.nearestStreetPoint = function nearestStreetPoint() {
    let best = null, distance = 6;
    for (const p of SN.streetPoints) {
      if (p.kind === "story" && (p.index !== SN.campaign.progress || SN.campaign.active)) continue;
      if (p.kind === "side" && SN.campaign.active) continue;
      const d = Math.hypot(SN.player.x - p.x, SN.player.z - p.z);
      if (d < distance) { best = p; distance = d; }
    }
    return best;
  };

  SN.interactStreet = function interactStreet() {
    const p = SN.nearestStreetPoint();
    if (!p) return false;
    if (p.kind === "property") { SN.openProperty(p.index); return true; }
    if (p.kind === "jump") { SN.toast("沿黄色箭头加速上坡 · 腾空 10 米并安全落地", 4); return true; }
    const m = (p.kind === "story" ? SN.storyMissions : SN.sideJobs)[p.index];
    if (!SN.canStartActivity(m)) return true;
    SN.openMissionBrief(p.kind, p.index);
    return true;
  };

  SN.openMissionBrief = function openMissionBrief(kind, index) {
    const m = (kind === "story" ? SN.storyMissions : SN.sideJobs)[index], c = SN.contacts.find(c => c.id === m.giver);
    if (SN.devMode) { SN.startMission(kind, index); return; }
    SN.openDialogue(Object.assign({}, c, { lines: m.dialogue || [m.brief], role: m.district || c.role }));
    SN.storyDialogue.offer = { kind, index }; SN.renderDialogue();
  };

  SN.beginOnboarding = function beginOnboarding() {
    SN.onboarding = null;
    if (SN.campaign.progress || SN.campaign.active || SN.progression.tutorial.length || SN.progression.stats.playSeconds >= 60) return;
    SN.onboarding = { stage: 0, began: SN.simTime, since: SN.simTime, x: SN.player.x, z: SN.player.z };
    SN.updateOnboarding();
  };

  SN.updateOnboarding = function updateOnboarding() {
    const guide = SN.onboarding;
    if (!guide) return false;
    if (SN.campaign.active || SN.campaign.progress || SN.simTime - guide.began >= 60) {
      SN.onboarding = null;
      return false;
    }
    if (!SN.canControl()) return false;
    const elapsed = SN.simTime - guide.since, moved = Math.hypot(SN.player.x - guide.x, SN.player.z - guide.z);
    const done = guide.stage === 0 ? moved > 2 : guide.stage === 1 ? !!SN.player.car : guide.stage === 2 && moved > 8;
    if (guide.stage < 3 && (elapsed >= 12 || elapsed >= 2 && done)) {
      guide.stage++; guide.since = SN.simTime; guide.x = SN.player.x; guide.z = SN.player.z;
    }
    const desktop = ["WASD 移动 · 鼠标环顾", "到西侧出租车旁 · F 上车", "沿小地图金线前进 · W 加速、S 刹车", "下车到金圈 · E 交谈并接受任务"];
    const touch = ["推左摇杆移动", "到西侧出租车，点上车", "踩油门，沿金线前进", "下车，点金圈交互条"];
    let text = (SN.coarse ? touch : desktop)[guide.stage];
    if (guide.stage === 2 && !SN.player.car) text = SN.coarse ? "沿小地图金线前进" : "沿小地图金线前进 · 步行也可抵达";
    if (guide.stage === 3 && SN.heat > 0) text = "先躲开巡警，驶出红圈";
    SN.setText("tutorialHint", text);
    return true;
  };

  SN.refreshStreetHUD = function refreshStreetHUD() {
    const p = SN.nearestStreetPoint(), car = SN.player.car, a = SN.campaign.active;
    if (p && !(a && a.status === "running" && SN.activeObjective().type === "collect")) {
      SN.$("storyInteract").classList.add("available");
      SN.setText("storyInteract", "E " + p.label);
      SN.setText("interaction", "E / 交互 · " + p.label);
      SN.$("interaction").classList.add("visible");
    }
    SN.setText("touchEnter", car ? "下车" : SN.doorTarget ? (SN.doorTarget.dir > 0 ? "进门" : "出门") : "上车");
    SN.setText("touchHolster", SN.holstered ? "拔枪" : "收枪");
    SN.$("touchAim").classList.toggle("held", SN.aiming);
    SN.setText("streetCounter", "声望 " + Math.floor(SN.progression.respect) + " · 招财猫 " + SN.progression.cats.length + "/100");
    const guidance = SN.updateOnboarding();
    SN.$("tutorialHint").classList.toggle("onboarding", guidance);
    SN.$("tutorialHint").classList.toggle("visible", guidance || SN.canControl() && SN.simTime < SN.tutorialUntil);
    if (a && a.status === "running") {
      const o = SN.activeObjective();
      if (o.type === "tail") SN.setText("objectiveDistance", "暴露 " + Math.round(a.exposure) + "% · 跟踪 " + Math.floor(a.hold) + "/" + o.duration + "秒");
      if (o.type === "defend") SN.setText("objectiveDistance", "完整 " + Math.ceil(a.integrity) + "% · " + Math.floor(a.hold) + "/" + o.duration + "秒");
      if (o.type === "escort") SN.setText("objectiveDistance", "护送对象 " + Math.ceil(SN.escortActor.health) + "%");
      if (o.type === "fight") SN.setText("objectiveDistance", "击退 " + a.defeated + "/" + o.count);
    }
    SN.$("vehicleJob").hidden = !car || !!a || !(car.type === 3 || car.type === 8 || car.role === "police" || [9, 12, 13].includes(car.type));
    SN.setText("vehicleJob", car && car.type === 3 ? "接出租车单" : car && car.type === 8 ? "接配送单" : "接巡查任务");
  };

  SN.startVehicleJob = function startVehicleJob() {
    if (!SN.canControl() || SN.campaign.active || !SN.player.car) return;
    const car = SN.player.car, id = car.type === 3 ? "taxi" : car.type === 8 ? "scooter" : "vigilante";
    const index = SN.sideJobs.findIndex(m => m.id === id);
    if (index >= 0) { SN.startMission("side", index); if (SN.campaign.active) SN.toast("已接单 · 沿导航到工作地点", 3); }
  };

  SN.openStreetPanel = function openStreetPanel(title, body) {
    SN.togglePause(false); SN.toggleJournal(false); SN.toggleCityMap(false);
    SN.streetPanelOpen = true; SN.syncSuspension(); SN.clearInput();
    if (document.pointerLockElement) document.exitPointerLock();
    SN.setText("streetPanelTitle", title); SN.$("streetPanelBody").innerHTML = body;
    SN.$("streetPanel").classList.add("open"); SN.$("streetPanelClose").focus();
  };
  SN.closeStreetPanel = function closeStreetPanel() {
    SN.streetPanelOpen = false; SN.propertyIndex = -1;
    SN.syncSuspension();
    SN.$("streetPanel").classList.remove("open"); SN.canvas.focus();
  };
  SN.openStats = function openStats() {
    const s = SN.progression.stats;
    const rows = [["主线完成", SN.campaign.progress + " / " + SN.storyMissions.length], ["街头工作", SN.campaign.jobWins.reduce((a, b) => a + b, 0)],
      ["声望", Math.floor(SN.progression.respect)], ["驾驶里程", (s.driven / 1000).toFixed(2) + " km"], ["步行里程", (s.walked / 1000).toFixed(2) + " km"],
      ["盗取车辆", s.carsStolen], ["摆脱星数", s.starsSurvived], ["招财猫", SN.progression.cats.length + " / 100"],
      ["特技跳跃", SN.progression.jumps.length + " / " + SN.stuntJumps.length], ["拥有房产", Object.keys(SN.progression.properties).length + " / " + SN.properties.length],
      ["街头时间", Math.floor(s.playSeconds / 60) + " 分钟"]];
    SN.openStreetPanel("街头档案", "<dl class=\"street-stats\">" + rows.map(r => "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>").join("") + "</dl>");
  };

  SN.openProperty = function openProperty(index) {
    const home = SN.properties[index], own = SN.progression.properties[home.id];
    let body = "<p>" + home.name + " · 收入 ¥" + home.income + " / 每 2 分钟街头时间</p>";
    if (!own) body += "<p>购买后可存档、换装、存取一辆车并领取收入。</p><button data-home=\"buy\">购买 · ¥" + home.price + "</button>";
    else body += "<p>待领收入 ¥" + Math.floor(own.bank) + " · 车库：" + (own.car ? SN.vehicleSpecs[own.car.type].name : "空") + "</p>" +
      "<div class=\"property-actions\"><button data-home=\"save\">休息并存档</button><button data-home=\"clothes\">更换衣服</button><button data-home=\"store\">停入当前车辆</button><button data-home=\"retrieve\">取出存车</button><button data-home=\"income\">领取收入</button></div>";
    body += "<p class=\"muted\">通缉或任务期间不能休息与存取车辆。</p>";
    SN.openStreetPanel("安全屋 · " + home.name, body); SN.propertyIndex = index;
  };

  SN.propertyAction = function propertyAction(action) {
    const index = SN.propertyIndex, home = SN.properties[index];
    if (!home || Math.hypot(SN.player.x - home.x, SN.player.z - home.z) > 9) return;
    let own = SN.progression.properties[home.id];
    if (action === "buy" && !own) {
      if (SN.money < home.price) { SN.toast("现金不足", 2); return; }
      SN.money -= home.price; own = SN.progression.properties[home.id] = { bank: 0, clock: 0, car: null };
    }
    if (!own) return;
    if (["save", "store", "retrieve"].includes(action) && (SN.heat > 0 || SN.campaign.active)) { SN.toast("先完成任务并解除通缉", 3); return; }
    if (action === "save") {
      SN.progression.home = home.id; SN.player.health = 100;
      SN.toast("安全屋休息完毕", 3);
    }
    if (action === "clothes") {
      const i = SN.campaign.unlocks.indexOf(SN.campaign.costume);
      SN.campaign.costume = SN.campaign.unlocks[(i + 1) % SN.campaign.unlocks.length]; SN.applyCostume();
    }
    if (action === "store") {
      const c = SN.player.car;
      if (!c || c.exploded) { SN.toast("先驾驶一辆完好的车到门口", 3); return; }
      if (own.car) { SN.toast("车位已满，先取出存车", 3); return; }
      own.car = { type: c.type, health: c.health, paint: c.paintColor };
      SN.player.car = null; c.active = false; c.root.visible = false; c.speed = c.vx = c.vz = 0;
      SN.playerRoot.visible = true; SN.moveToHome(home);
    }
    if (action === "retrieve") {
      if (!own.car || SN.player.car) { SN.toast("车库为空，或你正在驾驶", 3); return; }
      const slot = SN.garageCars[index];
      if (slot.active && Math.hypot(slot.x - home.x, slot.z - home.z) < 30) { SN.toast("先把上次取出的车开离门口", 3); return; }
      SN.placeMissionVehicle(slot, home.x, home.z, own.car.type);
      slot.paintColor = own.car.paint; SN.repairVehicle(slot); slot.health = own.car.health;
      own.car = null; SN.toast("车辆已停在附近路边", 3);
    }
    if (action === "income") { SN.money += Math.floor(own.bank); own.bank = 0; }
    SN.saveCampaign();
    if (!SN.campaign.storageOK) SN.toast("本机存储不可用，进度暂留本次游戏", 4);
    else if (action === "save") SN.toast("已保存 · 下次从此安全屋继续", 3);
    SN.openProperty(index);
  };

  SN.collectCat = function collectCat(index) {
    if (SN.progression.cats.includes(index)) return;
    SN.progression.cats.push(index); SN.money += 60; SN.progression.respect += 2;
    if (SN.progression.cats.length === 100) { SN.money += 10000; SN.progression.respect += 500; }
    SN.updateCatInstances(); SN.saveCampaign();
    SN.toast("招财猫 " + SN.progression.cats.length + " / 100 · +¥60" + (SN.progression.cats.length === 100 ? " · 全收集奖励 ¥10000" : ""), 3);
  };

  SN.updateCatInstances = function updateCatInstances() {
    for (const part of SN.catMeshes) {
      let count = 0;
      for (const [i, cat] of SN.luckyCats.entries()) {
        if (SN.progression.cats.includes(i)) continue;
        SN.dummy.position.set(cat.x + part.dx, cat.y + part.dy, cat.z);
        SN.dummy.rotation.set(0, 0, 0); SN.dummy.scale.set(...part.scale); SN.dummy.updateMatrix();
        part.mesh.setMatrixAt(count++, SN.dummy.matrix);
      }
      part.mesh.count = count; part.mesh.instanceMatrix.needsUpdate = true;
    }
  };

  SN.updateStreetLife = function updateStreetLife(dt) {
    const p = SN.progression, s = p.stats;
    s.playSeconds += dt;
    const moved = Math.hypot(SN.player.x - SN.streetLast.x, SN.player.z - SN.streetLast.z);
    if (moved < 15 && !SN.player.dead) s[SN.player.car ? "driven" : "walked"] += moved;
    SN.streetLast.x = SN.player.x; SN.streetLast.z = SN.player.z;
    const stars = Math.ceil(SN.heat);
    if (stars > 0 && !SN.player.dead && !SN.arrestState) SN.survivedPeak = Math.max(SN.survivedPeak, stars);
    if (SN.survivedPeak && !stars) { if (!SN.player.dead && !SN.arrestState) s.starsSurvived += SN.survivedPeak; SN.survivedPeak = 0; }
    if (SN.resultUntil > 0 && SN.simTime > SN.resultUntil) SN.hideMissionResult();
    for (const home of SN.properties) {
      const own = p.properties[home.id]; if (!own) continue;
      own.clock += dt;
      if (own.clock >= 120) { own.clock -= 120; own.bank = Math.min(home.income * 12, own.bank + home.income); SN.saveCampaign(); }
    }
    SN.streetTick -= dt;
    if (SN.streetTick <= 0) {
      SN.streetTick = 0.2;
      if (!SN.player.car && !SN.player.dead) for (const [i, cat] of SN.luckyCats.entries())
        if (!p.cats.includes(i) && Math.hypot(SN.player.x - cat.x, SN.player.z - cat.z) < 1.8 && Math.abs(SN.player.y - cat.y) < 1.6) SN.collectCat(i);
      SN.updateStreetMarkers();
    }
    const car = SN.player.car;
    if (car && !SN.stuntAttempt && car.airborne) {
      const index = SN.stuntJumps.findIndex(j => Math.hypot(car.x - j.x, car.z - (j.z + 7)) < 16);
      if (index >= 0) SN.stuntAttempt = { index, car, x: car.x, z: car.z };
    }
    if (SN.stuntAttempt) {
      const attempt = SN.stuntAttempt;
      if (car !== attempt.car || car.exploded) SN.stuntAttempt = null;
      else if (!car.airborne) {
        const distance = Math.hypot(car.x - attempt.x, car.z - attempt.z);
        if (distance >= 10 && car.health > 0 && !p.jumps.includes(attempt.index)) {
          p.jumps.push(attempt.index); SN.money += 800; p.respect += 35; SN.saveCampaign();
          SN.toast("特技跳跃完成 · " + Math.round(distance) + " 米 · +¥800", 4);
        } else SN.toast("特技跳跃 · 需要腾空 10 米并安全落地", 3);
        SN.stuntAttempt = null;
      }
    }
    if (SN.waypoint && Math.hypot(SN.player.x - SN.waypoint.x, SN.player.z - SN.waypoint.z) < 12) { SN.waypoint = null; SN.toast("已抵达导航点", 2); }
  };

  SN.updateStreetMarkers = function updateStreetMarkers() {
    if (SN.clubVenue) SN.clubVenue.floor.visible = SN.clubVenue.name.visible = Math.hypot(SN.player.x - SN.clubVenue.x, SN.player.z - SN.clubVenue.z) < 180;
    for (const p of SN.streetPoints) {
      const eligible = p.kind !== "story" || p.index === SN.campaign.progress;
      p.mesh.visible = eligible && Math.hypot(SN.player.x - p.x, SN.player.z - p.z) < 180;
      if (p.kind === "story" || p.kind === "side") p.mesh.visible = p.mesh.visible && !SN.campaign.active;
      if (p.mesh.visible) p.icon.position.y = 2.8 + Math.sin(SN.simTime * 2) * 0.15;
    }
  };

  SN.buildStreetWorld = function buildStreetWorld() {
    const ringGeo = new SN.T.TorusGeometry(2.2, 0.1, 6, 24), materials = {}, icons = {};
    const add = (kind, index, point, icon, label, color) => {
      const p = SN.safePosition(point.x, point.z, 0.5, null, "street-" + kind + "-" + index), group = new SN.T.Group();
      if (!materials[color]) materials[color] = new SN.T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false });
      const ring = new SN.T.Mesh(ringGeo, materials[color]); ring.rotation.x = SN.PI / 2; ring.position.y = 0.12; group.add(ring);
      if (!icons[icon]) {
        const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
        g.fillStyle = color; g.beginPath(); g.arc(32, 32, 30, 0, SN.TAU); g.fill();
        g.fillStyle = "#112b35"; g.font = "bold 38px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(icon, 32, 34);
        icons[icon] = new SN.T.SpriteMaterial({ map: SN.canvasTexture(c), transparent: true, depthWrite: false });
      }
      const sprite = new SN.T.Sprite(icons[icon]); sprite.scale.set(1.7, 1.7, 1); sprite.position.y = 2.8; group.add(sprite);
      group.position.set(p.x, SN.surfaceHeight(p.x, p.z), p.z); SN.scene.add(group);
      SN.streetPoints.push({ kind, index, x: p.x, z: p.z, label, glyph: icon, color, mesh: group, icon: sprite });
      return p;
    };
    SN.storyMissions.forEach((m, i) => { m.start = add("story", i, SN.missionStart(m), { mentor: "H", detective: "Y", informant: "C" }[m.giver] || "H", m.title, "#ffd34d"); });
    const sideIcons = { taxi: "租", scooter: "配", vigilante: "警", rampage: "战", race: "赛", bridge_circuit: "赛" };
    SN.sideJobs.forEach((m, i) => {
      const start = m.start || SN.missionStart(m), angle = i * 2.4;
      m.start = add("side", i, { x: start.x + Math.cos(angle) * 10, z: start.z + Math.sin(angle) * 10 }, sideIcons[m.id] || "工", m.title, "#58e4d3");
    });
    SN.properties.forEach((home, i) => Object.assign(home, add("property", i, home, "房", home.name, "#8bbfff")));
    // The open nightclub terrace shares the street combat and low-cover systems.
    const meeting = SN.storyMissions.find(m => m.id === "meeting");
    const club = meeting && meeting.objectives.find(o => o.type === "fight");
    if (!club) SN.reportContentProblem("club-venue", 0, 0, "夜店场景缺少战斗目标", "跳过装饰，继续启动");
    if (club) {
    const floorY = SN.surfaceHeight(club.x, club.z), floorParts = [];
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      const px = club.x + x * 1.6, pz = club.z + z * 1.6;
      if (!SN.blocked(px, pz, 0.5)) floorParts.push({ g: SN.box, x: px, y: SN.surfaceHeight(px, pz) + 0.02, z: pz, sx: 1.48, sy: 0.03, sz: 1.48 });
    }
    const danceFloor = new SN.T.Mesh(SN.merged(floorParts), SN.mat(0x9e4ac9, { emissive: 0x572968, emissiveIntensity: 0.35, roughness: 0.45 }));
    SN.scene.add(danceFloor);
    const clubName = SN.nameSprite("마지막 잔 · 最后一杯", "#ed9bff");
    clubName.position.set(club.x, floorY + 3.7, club.z - 8); SN.scene.add(clubName);
    for (const side of [-1, 1]) {
      const x = club.x + side * 8, z = club.z - 8;
      if (SN.blocked(x, z, 1.5) || SN.inDrivingLane(x, z, 1.5)) continue;
      const y = SN.surfaceHeight(x, z);
      SN.meshAt(SN.box, SN.mat(0x4c4076), x, y + 0.45, z, 3, 0.9, 1.2);
      SN.addOBB(x, z, 3, 1.2, 0.9, 0, y); SN.encounterCover.push({ x, z, w: 3, d: 1.2 });
    }
    SN.clubVenue = { x: club.x, z: club.z, floor: danceFloor, name: clubName };
    }
    // Four compact ramps use the same sampled ground as the vehicle suspension.
    for (const [i, jump] of SN.stuntJumps.entries()) {
      const p = SN.safePosition(jump.x, jump.z, 8, null, "stunt-" + i); Object.assign(jump, p);
      const floor = SN.surfaceHeight(p.x, p.z), parts = [];
      for (let n = 0; n < 16; n++) {
        const h = (n + 1) * 0.19;
        parts.push({ g: SN.box, x: p.x, y: floor + h / 2, z: p.z - 8 + n, sx: 5, sy: h, sz: 1.03 });
      }
      const ramp = new SN.T.Mesh(SN.merged(parts), SN.mat(0xe1b84e, { roughness: 0.8 })); ramp.receiveShadow = true; SN.scene.add(ramp);
      SN.rasterSurface(p.x - 2.5, p.x + 2.5, p.z - 8, p.z + 8, () => true, (x, z) => floor + (z - p.z + 8) * 0.19, 2);
      add("jump", i, { x: p.x + 6, z: p.z - 12 }, "跃", "特技跳跃 · 向南加速", "#e7a2ff");
    }
    const spots = SN.roadSpawnPoints;
    for (let i = 0; i < 100; i++) {
      let p;
      for (let attempt = 0; attempt < 30; attempt++) {
        const seed = spots[(i * 97 + 31 + attempt * 17) % Math.max(1, spots.length)] || SN.player;
        p = SN.safePosition(seed.x + Math.cos(seed.yaw || 0) * 14, seed.z - Math.sin(seed.yaw || 0) * 14, 0.4, null, "cat-" + i);
        if (SN.luckyCats.every(cat => Math.hypot(cat.x - p.x, cat.z - p.z) > 4)) break;
      }
      SN.luckyCats.push({ x: p.x, z: p.z, y: SN.surfaceHeight(p.x, p.z) });
    }
    const bodyGeo = new SN.T.SphereGeometry(1, 8, 6), earGeo = new SN.T.ConeGeometry(1, 1, 4), white = new SN.T.MeshStandardMaterial({ color: 0xffebc3, roughness: 0.7 }), gold = new SN.T.MeshStandardMaterial({ color: 0xffb51c, emissive: 0x6a3500, emissiveIntensity: 0.25 });
    for (const part of [
      { geo: bodyGeo, mat: white, dx: 0, dy: 0.35, scale: [0.25, 0.32, 0.22] },
      { geo: bodyGeo, mat: white, dx: 0, dy: 0.72, scale: [0.25, 0.22, 0.22] },
      { geo: earGeo, mat: white, dx: -0.16, dy: 0.94, scale: [0.11, 0.22, 0.1] },
      { geo: earGeo, mat: white, dx: 0.16, dy: 0.94, scale: [0.11, 0.22, 0.1] },
      { geo: bodyGeo, mat: gold, dx: 0.27, dy: 0.6, scale: [0.09, 0.21, 0.1] }
    ]) {
      part.mesh = new SN.T.InstancedMesh(part.geo, part.mat, 100); part.mesh.frustumCulled = false;
      SN.scene.add(part.mesh); SN.catMeshes.push(part);
    }
    SN.updateCatInstances(); SN.updateStreetMarkers();
    SN.bindStreetUI();
  };

  SN.bindStreetUI = function bindStreetUI() {
    SN.$("newGame").addEventListener("click", SN.newCampaign);
    SN.$("statsBtn").addEventListener("click", SN.openStats);
    SN.$("streetPanelClose").addEventListener("click", SN.closeStreetPanel);
    SN.$("streetPanelBody").addEventListener("click", e => { const b = e.target.closest("[data-home]"); if (b) SN.propertyAction(b.dataset.home); });
    SN.$("resultRetry").addEventListener("click", () => { SN.togglePause(false); SN.retryCheckpoint(); });
    SN.$("resultLeave").addEventListener("click", () => { SN.suspendMission(); SN.hideMissionResult(); });
    SN.$("vehicleJob").addEventListener("click", SN.startVehicleJob);
  };

  // Teleport supplies travel and combat outcomes; the real objective state machine decides success.
  SN.smokeMainMission = function smokeMainMission(index, kind = "story") {
    if (!SN.devMode) return;
    const assert = (ok, message) => { if (!ok) throw new Error(message); }, m = (kind === "story" ? SN.storyMissions : SN.sideJobs)[index];
    const stat = kind === "story" ? "missionsPassed" : "activitiesPassed";
    const saved = { x: SN.player.x, z: SN.player.z, money: SN.money, progress: SN.campaign.progress,
      completed: SN.completed, respect: SN.progression.respect, passed: SN.progression.stats[stat], wins: SN.campaign.jobWins[index] };
    const move = (x, z, car = null) => {
      SN.player.car = car;
      Object.assign(SN.player, { x, z, y: SN.surfaceHeight(x, z), health: 100, armor: 100,
        dead: 0, bail: null, vault: null, vy: 0, grounded: true, speed: 0, motionSpeed: 0 });
      if (car) { Object.assign(car, { x, z, speed: 0, vx: 0, vz: 0, active: true }); SN.resetVehicleGround(car); }
    };
    const reset = () => {
      SN.cleanupEncounter(); SN.campaign.active = SN.campaign.checkpoint = null;
      SN.clearWantedResponse(); SN.heat = 0; SN.carjack = null; SN.clearInput(); SN.hideMissionResult();
      SN.player.car = null; SN.playerRoot.visible = true;
    };
    reset();
    try {
      if (kind === "story") SN.campaign.progress = index;
      const start = SN.missionStart(m); move(start.x, start.z);
      if (m.requiredVehicle !== undefined || m.requiredPolice || m.requiresCar) {
        SN.stageLoanCar(m.requiredVehicle === undefined ? m.requiredPolice ? 9 : 7 : m.requiredVehicle);
        move(SN.loanCar.x, SN.loanCar.z, SN.loanCar);
      }
      SN.startMission(kind, index);
      assert(SN.campaign.active, "无法接取任务");
      for (let step = 0; step < m.objectives.length; step++) {
        const a = SN.campaign.active, o = SN.activeObjective();
        assert(a && a.step === step, "目标顺序错误 " + step);
        // Every objective must survive both pause and an actual fail/retry transition.
        const time = a.time, clock = SN.simTime;
        SN.togglePause(true); SN.fixedStep(1 / 60); SN.togglePause(false);
        assert(a.time === time && SN.simTime === clock, "暂停推进了任务");
        SN.failMission("检查点恢复检查"); SN.retryCheckpoint();
        assert(a.status === "running" && a.step === step && SN.canControl(), "检查点重试未恢复当前目标");
        assert(!SN.blocked(SN.player.x, SN.player.z, 0.3) && !SN.isWater(SN.player.x, SN.player.z), "检查点出生在障碍物或水中");
        if (["tail", "chase", "ambush"].includes(o.type))
          assert(!SN.carBlocked(SN.missionCar.x, SN.missionCar.z, SN.missionCar.yaw, SN.missionCar) && !SN.carWater(SN.missionCar.x, SN.missionCar.z, SN.missionCar.yaw, SN.missionCar), "移动目标车出生在障碍物或水中");
        const tick = dt => {
          SN.updateMission(dt); SN.updateStoryCharacters(SN.simTime);
          assert([SN.taxiPassenger.rig.root.position.x, SN.taxiPassenger.rig.root.position.y, SN.taxiPassenger.rig.root.position.z].every(Number.isFinite), "乘客位置无效");
          assert(a.status !== "failed", o.type + ": " + a.reason);
        };
        if (o.type === "vehicle") {
          assert(a.contractCar && a.contractCar.active && !SN.carBlocked(a.contractCar.x, a.contractCar.z, a.contractCar.yaw, a.contractCar), "任务车无法驾驶");
          move(a.contractCar.x, a.contractCar.z, a.contractCar); tick(0.1);
        } else if (["drive", "race", "taxiPickup", "taxiDrop"].includes(o.type)) {
          const car = o.escortCar ? a.taxi : o.contract ? a.contractCar : SN.player.car || SN.loanCar;
          assert(car && !SN.isWater(o.x, o.z), "缺少可达的驾驶终点");
          let parking = null;
          for (let radius = 0; radius < (o.r || 12) - 1 && !parking; radius += 2) {
            for (let i = 0; i < 16 && !parking; i++) {
              const x = o.x + Math.sin(i * SN.TAU / 16) * radius, z = o.z + Math.cos(i * SN.TAU / 16) * radius;
              for (const yaw of [0, SN.PI / 2]) if (!SN.carBlocked(x, z, yaw, car) && !SN.carWater(x, z, yaw, car)) {
                parking = { x, z, yaw }; break;
              }
            }
          }
          assert(parking, "驾驶终点内没有容纳整辆车的空间");
          car.yaw = parking.yaw; move(parking.x, parking.z, car); tick(0.1);
        } else if (["go", "collect", "delivery"].includes(o.type)) {
          const p = SN.safePosition(o.x, o.z, 0.35);
          assert(Math.hypot(p.x - o.x, p.z - o.z) < (o.r || 5), "步行目标无法抵达");
          move(p.x, p.z); SN.interactPulse = true; tick(0.1);
        } else if (o.type === "fight" || o.type === "defend") {
          move(o.x, o.z);
          for (let n = 0; n < 1000 && a.step === step; n++) {
            for (const e of SN.encounterActors) if (e.health > 0) SN.hitActor(e, 1000, 0, 0, false, "environment");
            tick(0.1);
          }
        } else if (o.type === "escape") {
          const escape = SN.safePosition(SN.searchX + SN.searchRadius + 240, SN.searchZ, 0.4);
          move(escape.x, escape.z); SN.clearWantedResponse();
          SN.searchX = SN.player.x - 450; SN.searchZ = SN.player.z; SN.searchRadius = 60;
          for (let n = 0; n < 600 && a.step === step; n++) { SN.updateWanted(0.2); tick(0.2); }
        } else if (o.type === "tail") {
          const target = SN.missionCar;
          let follow = null;
          for (const gap of [32, 42, 55, 65]) {
            const x = target.x - Math.sin(target.yaw) * gap, z = target.z - Math.cos(target.yaw) * gap;
            if (!SN.blocked(x, z, 0.4) && SN.visibleBetween(target.x, target.y + 1.5, target.z, x, SN.surfaceHeight(x, z) + 1, z)) { follow = { x, z }; break; }
          }
          assert(follow, "跟踪车后方无可视道路");
          move(follow.x, follow.z, SN.loanCar);
          for (let n = 0; n < 500 && a.step === step; n++) tick(0.1);
        } else if (o.type === "chase" || o.type === "ambush") {
          const target = SN.missionCar;
          move(target.x + 6, target.z, SN.loanCar);
          SN.carDamage(target, 12); target.collisionTimer = 0;
          target.health = 34;
          for (let n = 0; n < 30 && a.step === step; n++) tick(0.1);
        } else if (o.type === "escort") {
          move(SN.escortActor.x, SN.escortActor.z);
          for (let n = 0; n < 1500 && a.step === step; n++) {
            for (const e of SN.encounterActors) if (e.health > 0) SN.hitActor(e, 1000, 0, 0, false, "environment");
            const e = SN.escortActor, d = Math.hypot(o.x - e.x, o.z - e.z), ahead = Math.min(6, d);
            const point = SN.safePosition(e.x + (o.x - e.x) / Math.max(0.01, d) * ahead, e.z + (o.z - e.z) / Math.max(0.01, d) * ahead, 0.4);
            move(point.x, point.z); tick(0.1);
          }
        } else throw new Error("未覆盖目标 " + o.type);
        assert(!SN.campaign.active || a.step === step + 1, "目标未完成 " + step + " " + o.type);
      }
      assert(!SN.campaign.active && (kind === "story" ? SN.campaign.progress === index + 1 : SN.campaign.jobWins[index] === saved.wins + 1), "任务未通关");
      assert(SN.money === saved.money + m.reward && SN.progression.stats[stat] === saved.passed + 1, "通关奖励重复或丢失");
    } finally {
      reset(); SN.campaign.progress = saved.progress; SN.money = saved.money; SN.completed = saved.completed;
      SN.progression.respect = saved.respect; SN.progression.stats[stat] = saved.passed;
      if (kind === "side") SN.campaign.jobWins[index] = saved.wins;
      SN.slowMotion = 0; move(saved.x, saved.z); SN.snapPlayer(); SN.snapCars();
    }
  };

  SN.extendMissionSmoke = function extendMissionSmoke() {
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    const move = (x, z) => {
      Object.assign(SN.player, { x, z, y: SN.surfaceHeight(x, z), dead: 0, bail: null, health: 100, armor: 100 });
      if (SN.player.car) Object.assign(SN.player.car, { x, z, speed: 0, vx: 0, vz: 0 });
      SN.snapPlayer(); SN.snapCars();
    };
    const reset = () => {
      SN.cleanupEncounter(); SN.campaign.active = SN.campaign.checkpoint = null;
      SN.player.car = null; SN.playerRoot.visible = true; SN.carjack = null;
      SN.heat = 0; SN.clearWantedResponse(); SN.closeStreetPanel(); SN.closeDialogue(); SN.hideMissionResult();
    };
    const stage = (id, step) => {
      reset(); const index = SN.storyMissions.findIndex(m => m.id === id);
      SN.campaign.progress = index; SN.startMission("story", index);
      SN.campaign.active.step = step; const o = SN.activeObjective();
      move(o.x || -40, o.z || -770); SN.campaign.active.spawn = { x: SN.player.x, z: SN.player.z };
      SN.prepareObjective(); return SN.campaign.active;
    };
    SN.smoke.stages.push(
      [11.2, "tutorial-checkpoints-pass", () => {
        reset(); SN.campaign.progress = 0; move(-30, -765); SN.startMission("story", 0);
        SN.holstered = false; SN.failMission("检查点测试"); SN.retryCheckpoint();
        assert(SN.holstered && SN.campaign.active.status === "running", "重试未恢复徒手");
        SN.hurtPlayer(120, true); assert(SN.player.dead > 0, "任务中倒下未触发"); SN.retryCheckpoint();
        assert(!SN.player.dead && !SN.$("downscreen").classList.contains("visible") && SN.canControl(), "倒下后无法立即重试");
        SN.beginArrest(SN.actors.find(actor => actor.kind === "police")); SN.updateArrest(1); SN.retryCheckpoint();
        assert(!SN.arrestState && !SN.$("arrestScreen").classList.contains("visible") && SN.canControl(), "被捕后无法立即重试");
        const cash = SN.money, respect = SN.progression.respect;
        for (let i = 0; i < 6; i++) {
          const a = SN.campaign.active, o = SN.activeObjective(); assert(a && a.step === i, "教学目标顺序错误");
          if (o.type === "vehicle") SN.player.car = a.contractCar;
          else if (o.type === "fight") { SN.player.car = null; move(o.x, o.z); SN.encounterActors.forEach(e => { e.health = 0; }); }
          else if (o.type === "escape") { SN.heat = 0; SN.clearWantedResponse(); }
          else move(o.x, o.z);
          SN.updateMission(0.1);
        }
        assert(!SN.campaign.active && SN.campaign.progress === 1 && SN.money === cash + 650 && SN.progression.respect > respect, "教学结算或后续解锁失败");
        reset(); SN.campaign.progress = 0;
      }],
      [11.4, "contract-vehicle-retry", () => {
        let a = stage("valet", 1);
        SN.player.car = a.contractCar; SN.updateMission(0.1);
        assert(a.step === 2 && a.contractCar, "指定跑车未带到交付目标");
        a.contractCar.health = 40; SN.updateMission(0.1); assert(a.status === "failed", "受损委托车未触发失败");
        SN.retryCheckpoint(); a = SN.campaign.active;
        assert(a.contractCar && a.contractCar.health === 100, "检查点未恢复委托车"); reset();
      }],
      [11.6, "tail-chase-escort", () => {
        let a = stage("taillight", 1); a.departed = true; a.exposure = 100;
        move(SN.missionCar.x, SN.missionCar.z); SN.updateMission(0.01); assert(a.status === "failed", "跟踪暴露未失败");
        a = stage("fakeplate", 1); SN.missionCar.health = 34; move(SN.missionCar.x + 3, SN.missionCar.z);
        SN.updateMission(2.1); assert(a.step === 2 && a.targetPosition && Math.hypot(SN.activeObjective().x - a.targetPosition.x, SN.activeObjective().z - a.targetPosition.z) < 1, "追停后证据位置丢失");
        a = stage("awning", 2); SN.escortActor.health = 0; SN.updateMission(0.1); assert(a.status === "failed", "护送对象失败条件失效");
        a = stage("meeting", 1); assert(SN.convoyCars.every(c => c.active), "车队未生成");
        reset(); SN.campaign.progress = 0;
      }],
      [12.2, "city-gps-map", () => {
        const path = SN.roadRoute({ x: -130, z: -800 }, { x: 1900, z: 1080 });
        assert(path.length > 4, "跨江路网没有路线");
        for (let i = 1; i < path.length; i++) {
          const a = path[i - 1], b = path[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 30);
          for (let k = 0; k <= n; k++) assert(!SN.isWater(SN.lerp(a.x, b.x, k / Math.max(n, 1)), SN.lerp(a.z, b.z, k / Math.max(n, 1)), 1), "GPS 穿过水面");
        }
        SN.toggleCityMap(true); SN.atlasView.zoom = 2; SN.setWaypoint(1900, 1080); SN.drawCityAtlas();
        assert(SN.getGPSRoute().length > 1, "手动导航无路线");
        SN.atlasView.zoom = 1; SN.waypoint = null; SN.toggleCityMap(false);
        SN.openStats(); assert(SN.streetPanelOpen, "档案未打开"); SN.closeStreetPanel();
      }],
      [12.4, "repeatable-activities", () => {
        reset(); const index = SN.sideJobs.findIndex(m => m.id === "rampage"), before = SN.campaign.jobWins[index];
        for (let i = 0; i < 2; i++) {
          const o = SN.sideJobs[index].objectives[0]; move(o.x, o.z); SN.startMission("side", index);
          SN.encounterActors.forEach(e => { e.health = 0; }); SN.updateMission(0.1);
        }
        assert(SN.campaign.jobWins[index] === before + 2, "活动无法重复结算");
        reset(); SN.player.car = SN.contractCar; SN.fitVehicle(SN.contractCar, 8); SN.contractCar.active = true;
        SN.startVehicleJob(); assert(SN.missionDefinition().id === "scooter", "踏板车配送接单失败");
        reset(); SN.campaign.tracked = "story";
      }],
      [18.2, "property-collectibles-save", () => {
        reset(); SN.campaign.progress = 0; const h = SN.properties[0]; move(h.x, h.z); SN.money = 30000;
        SN.openProperty(0); SN.propertyAction("buy"); assert(SN.progression.properties[h.id], "房产未购入");
        SN.player.car = SN.contractCar; SN.repairVehicle(SN.contractCar); SN.propertyAction("store");
        assert(SN.progression.properties[h.id].car && !SN.player.car, "存车失败");
        SN.propertyAction("retrieve"); assert(!SN.progression.properties[h.id].car && SN.garageCars[0].active, "取车失败");
        SN.propertyAction("save"); SN.propertyAction("clothes");
        SN.progression.properties[h.id].bank = 120; const cash = SN.money;
        SN.propertyAction("income"); assert(SN.money === cash + 120, "房产收入未结算");
        SN.closeStreetPanel(); const cat = SN.luckyCats[0]; move(cat.x, cat.z); SN.streetTick = 0; SN.updateStreetLife(0.2);
        assert(SN.progression.cats.includes(0), "招财猫无法收集");
        const before = SN.money; SN.collectCat(0); assert(SN.money === before, "收藏重复发钱");
        const data = JSON.parse(JSON.stringify(SN.progression)); SN.restoreProgression(data);
        assert(SN.progression.cats.includes(0) && SN.progression.home === h.id, "进度恢复失败");
        const j = SN.stuntJumps[0], c = SN.contractCar; SN.player.car = c; SN.repairVehicle(c);
        Object.assign(c, { x: j.x, z: j.z + 7, airborne: true }); SN.updateStreetLife(0.01);
        Object.assign(c, { z: j.z + 24, airborne: false }); SN.updateStreetLife(0.01);
        assert(SN.progression.jumps.includes(0), "跳跃落地未结算");
        reset(); SN.progression = SN.freshProgression(); SN.campaign.jobWins = SN.sideJobs.map(() => 0); SN.updateCatInstances();
      }]
    );
    SN.storyMissions.forEach((m, index) => SN.smoke.stages.push(
      [19.05 + index * 0.025, "main-mission-" + m.id, () => SN.smokeMainMission(index)]));
    SN.sideJobs.forEach((m, index) => SN.smoke.stages.push(
      [18.85 + index * 0.025, "side-mission-" + m.id, () => SN.smokeMainMission(index, "side")]));
    SN.smoke.stages.sort((a, b) => a[0] - b[0]);
  };

  SN.registerInit(25.6, function initializeStreetState() {
    SN.progression = SN.freshProgression(); SN.hasSave = false;
    SN.streetPanelOpen = false; SN.propertyIndex = -1; SN.resultUntil = 0; SN.tutorialUntil = 0; SN.onboarding = null;
    SN.clubVenue = null; SN.streetPoints = []; SN.luckyCats = []; SN.catMeshes = []; SN.streetTick = 0;
    SN.streetLast = { x: -40, z: -770 }; SN.survivedPeak = 0; SN.stuntAttempt = null;
    SN.properties = [
      { id: "jongno", name: "乙支路工房", x: -90, z: -765, price: 1800, income: 120 },
      { id: "hongdae", name: "弘大练歌房", x: -1880, z: -550, price: 6500, income: 300 },
      { id: "yeouido", name: "汝矣岛公寓", x: -1390, z: 520, price: 12000, income: 550 },
      { id: "gangnam", name: "江南车行", x: -170, z: 1090, price: 18000, income: 850 }
    ];
    SN.stuntJumps = [{ x: -250, z: -790 }, { x: 810, z: 1070 }, { x: -1800, z: -810 }, { x: 2400, z: 1060 }];
  });
  SN.registerInit(27.5, function initializeActivityVehicles() {
    const car = type => {
      const c = SN.makeCar(-66, -786, 0, true, null, 0, type, "mission");
      c.active = false; c.root.visible = false; return c;
    };
    SN.contractCar = car(3); SN.convoyCars = [car(4), car(4)];
    SN.garageCars = SN.properties.map(() => car(1));
    SN.escortActor = { x: 0, z: 0, health: 100, rig: SN.makeRig(0x42a7bc, 0xe8b58a, 1, SN.makeProfile(100, "civilian", -1)) };
    SN.escortActor.rig.root.visible = false; SN.scene.add(SN.escortActor.rig.root);
  });

  SN.finishStreetEvent = function finishStreetEvent(success = false, silent = false) {
    const e = SN.streetEvent;
    if (!e) return;
    for (const saved of e.actors) {
      saved.actor.cityEventTag = null;
      if (e.type === "ambush") {
        saved.actor.hostile = false; saved.actor.hostileTimer = 0;
        saved.actor.armedWeapon = saved.armedWeapon;
        saved.actor.meleeOnly = saved.meleeOnly;
      }
      else { saved.actor.mode = "walk"; saved.actor.modeTimer = 0; saved.actor.panic = 0; }
    }
    for (const c of SN.eventCars) {
      if (SN.player.car === c) {
        // The player may have taken an event vehicle. Hand it back to ordinary
        // traffic instead of leaving a stale mission route on it.
        c.missionTag = null; c.role = "traffic"; c.route = null; c.driver = false; c.cityTraffic = false;
        continue;
      }
      c.active = false; c.root.visible = false; c.missionTag = null; c.route = null; c.driver = false;
      SN.repairVehicle(c);
    }
    if (SN.player.car && SN.eventCars.indexOf(SN.player.car) >= 0)
      SN.eventCars.push(SN.eventCars.splice(SN.eventCars.indexOf(SN.player.car), 1)[0]);
    SN.eventBeacon.visible = SN.eventBag.visible = SN.eventBarrier.visible = false; SN.$("cityEvent").classList.remove("visible");
    SN.streetEvent = null; SN.nextStreetEvent = SN.simTime + 150 + SN.rnd() * 180;
    if (success) { SN.money += e.reward; SN.progression.respect += 5; SN.saveCampaign(); }
    if (!silent) SN.toast(success ? "街头偶遇完成 · +¥" + e.reward + " · 声望 +5" : "街头偶遇结束", 3);
  };

  SN.startStreetEvent = function startStreetEvent(type) {
    if (SN.campaign.active || SN.streetEvent || SN.heat > 0 || SN.player.dead || SN.arrestState || SN.interiorAt(SN.player.x, SN.player.z, SN.player.y)) return false;
    // A player-owned event car stays usable; keep it at the end of the pool so
    // the free event slots remain contiguous.
    if (SN.player.car) {
      const owned = SN.eventCars.indexOf(SN.player.car);
      if (owned >= 0) SN.eventCars.push(SN.eventCars.splice(owned, 1)[0]);
    }
    if (!SN.streetEventTypes.includes(type)) return false;
    const roads = SN.roadSpawnPoints.filter(p => { const d = Math.hypot(p.x - SN.player.x, p.z - SN.player.z); return d > 18 && d < 85; });
    const start = roads.find(p => !SN.carBlocked(p.x, p.z, p.yaw, SN.eventCars[0]) && !SN.cars.some(c => c.active && Math.hypot(c.x - p.x, c.z - p.z) < 10));
    if (!start && type !== "snatch" && type !== "ambush") return false;
    const origin = start || SN.player;
    const e = { type, x: origin.x, z: origin.z, actors: [], elapsed: 0, progress: 0, phase: "invite", reward: { snatch: 180, race: 250, ambush: 220, checkpoint: 80, motorcade: 60 }[type] };
    if (type === "snatch") {
      const a = SN.actors.find(a => a.active && a.index < SN.pedCount && !a.inCar && !a.interior && !a.down && !a.hostile && Math.hypot(a.x - SN.player.x, a.z - SN.player.z) > 8 && Math.hypot(a.x - SN.player.x, a.z - SN.player.z) < 55);
      if (!a) return false;
      a.cityEventTag = "snatch"; a.sitting = a.phone = a.chat = false; e.actors.push({ actor: a }); e.x = a.x; e.z = a.z;
    } else if (type === "ambush") {
      const crew = SN.crews.findIndex(c => Math.hypot(c.x - SN.player.x, c.z - SN.player.z) < c.radius);
      const actors = SN.actors.filter(a => a.active && a.kind === "gang" && a.crew === crew && !a.missionEnemy && !a.inCar && !a.down && Math.hypot(a.x - SN.player.x, a.z - SN.player.z) < 80).slice(0, 2);
      if (crew < 0 || actors.length < 2) return false;
      for (const a of actors) {
        a.cityEventTag = "ambush";
        e.actors.push({ actor: a, armedWeapon: a.armedWeapon, meleeOnly: !!a.meleeOnly });
      }
      e.x = actors[0].x; e.z = actors[0].z;
    } else {
      for (const c of SN.eventCars) if (c !== SN.player.car) SN.repairVehicle(c);
      const requested = type === "motorcade" ? (SN.qualityLevel() === 0 ? 2 : 3) : 1;
      const count = Math.min(requested, SN.player.car && SN.eventCars.indexOf(SN.player.car) >= 0 ? 2 : 3);
      for (let i = 0; i < count; i++) {
        const c = SN.eventCars[i]; SN.placeMissionVehicle(c, start.x - Math.sin(start.yaw) * i * 12, start.z - Math.cos(start.yaw) * i * 12, type === "race" ? 7 : type === "checkpoint" ? 9 : 2);
        c.yaw = start.yaw; c.cityTraffic = false; c.missionTag = "city-event"; c.role = "event";
        if (type === "motorcade") { c.paintColor = 0x202b3f; SN.repairVehicle(c); }
        e.x = SN.eventCars[0].x; e.z = SN.eventCars[0].z;
      }
    }
    SN.streetEvent = e; SN.eventBeacon.visible = true;
    SN.eventBag.visible = type === "snatch"; SN.eventBarrier.visible = type === "checkpoint";
    if (SN.eventBarrier.visible) { const c = SN.eventCars[0]; SN.eventBarrier.position.set(c.x, c.y, c.z); SN.eventBarrier.rotation.y = c.yaw; }
    SN.$("cityEvent").classList.add("visible");
    SN.setText("cityEvent", SN.streetEventNames[SN.streetEventTypes.indexOf(type)] + " · Y / 点此参与");
    return true;
  };

  SN.acceptStreetEvent = function acceptStreetEvent() {
    const e = SN.streetEvent;
    if (!e || e.phase !== "invite" || !SN.canControl() || SN.campaign.active) return false;
    if (e.type === "race" && !SN.player.car) { SN.toast("开一辆车到街口再接受邀赛", 3); return false; }
    if (e.type === "race" || e.type === "motorcade") {
      const target = SN.roadNodes.filter(n => Math.hypot(n.x - e.x, n.z - e.z) > 280 && Math.hypot(n.x - e.x, n.z - e.z) < 500)
        .sort((a, b) => Math.hypot(a.x - SN.player.x, a.z - SN.player.z) - Math.hypot(b.x - SN.player.x, b.z - SN.player.z))[0];
      if (!target) { SN.finishStreetEvent(false); return false; }
      const route = SN.roadRoute(e, target);
      if (route.length < 2) { SN.finishStreetEvent(false); return false; }
      e.target = { x: target.x, z: target.z }; e.raceCar = SN.player.car;
      let rivals = SN.eventCars.filter(c => c.active && c !== SN.player.car);
      if (!rivals.length) {
        // The player may already sit in the single staged car; give the event a
        // real opponent/convy reference instead of comparing the player to itself.
        const spare = SN.eventCars.find(c => c !== SN.player.car);
        if (spare) {
          SN.placeMissionVehicle(spare, e.x - Math.sin(SN.player.yaw) * 11, e.z - Math.cos(SN.player.yaw) * 11, e.type === "race" ? 7 : 2);
          spare.yaw = SN.player.yaw; spare.cityTraffic = false; spare.missionTag = "city-event"; spare.role = "event";
          spare.driver = true; spare.parked = false;
          rivals = [spare];
        }
      }
      for (const c of rivals) { c.route = route.map(p => [p.x, p.z]); c.index = 1; c.parked = false; c.driver = true; c.cruise = e.type === "race" ? 14 : 7; }
    }
    if (e.type === "ambush") for (const { actor } of e.actors) { actor.hostile = true; actor.hostileTimer = 70; actor.meleeOnly = true; actor.armedWeapon = -1; }
    e.phase = "running"; e.elapsed = 0; return true;
  };

  SN.updateStreetEvent = function updateStreetEvent(dt) {
    if (!SN.streetEvent) {
      if (!SN.devMode && SN.simTime >= SN.nextStreetEvent && !SN.campaign.active && SN.heat === 0) {
        SN.nextStreetEvent = SN.simTime + 40;
        SN.startStreetEvent(SN.streetEventTypes[Math.floor(SN.rnd() * SN.streetEventTypes.length)]);
      }
      return;
    }
    const e = SN.streetEvent;
    if (SN.campaign.active || SN.player.dead || SN.arrestState) { SN.finishStreetEvent(false, true); return; }
    e.elapsed += dt;
    if (e.elapsed > (e.phase === "invite" ? 25 : e.type === "race" ? 65 : 60) || Math.hypot(SN.player.x - e.x, SN.player.z - e.z) > (e.type === "race" ? 1200 : 220)) { SN.finishStreetEvent(false); return; }
    SN.eventBeacon.position.set(e.x, SN.surfaceHeight(e.x, e.z) + 0.12, e.z);
    if (e.type === "snatch") { const a = e.actors[0].actor; SN.eventBag.position.set(a.x + Math.cos(a.yaw) * 0.3, SN.surfaceHeight(a.x, a.z) + 0.95, a.z - Math.sin(a.yaw) * 0.3); SN.eventBag.rotation.y = a.yaw; }
    if (e.phase !== "running") return;
    let label = "", done = false;
    if (e.type === "snatch") {
      const a = e.actors[0].actor;
      if (a.down || a.health <= 0) { SN.finishStreetEvent(false); return; }
      const d = Math.hypot(a.x - SN.player.x, a.z - SN.player.z);
      a.yaw = Math.atan2(a.x - SN.player.x, a.z - SN.player.z);
      const next = SN.resolveCircle(a.x + Math.sin(a.yaw) * dt * 3, a.z + Math.cos(a.yaw) * dt * 3, 0.28);
      if (!SN.isWater(next.x, next.z)) { a.x = next.x; a.z = next.z; }
      a.rig.root.position.set(a.x, SN.surfaceHeight(a.x, a.z), a.z); a.rig.root.rotation.y = a.yaw; a.poseDirty = true;
      a.phase += dt * 7; SN.poseRig(a.rig, 3, a.phase, SN.simTime, false, false, 0, -1);
      e.x = a.x; e.z = a.z; e.target = a;
      done = d < 2.5 && !SN.player.car; label = "追上抢包者 · 靠近夺回提包";
    } else if (e.type === "race") {
      if (SN.player.car !== e.raceCar || e.raceCar.exploded) { SN.finishStreetEvent(false); return; }
      done = Math.hypot(SN.player.x - e.target.x, SN.player.z - e.target.z) < 13;
      const rival = SN.eventCars.find(c => c.active && c !== SN.player.car);
      if (!done && rival && Math.hypot(rival.x - e.target.x, rival.z - e.target.z) < 13) { SN.finishStreetEvent(false); return; }
      e.x = e.target.x; e.z = e.target.z; label = "街头竞速 · 抢先抵达光圈 · " + Math.ceil(65 - e.elapsed) + "秒";
    } else if (e.type === "ambush") {
      done = e.actors.every(p => p.actor.down > 0 || p.actor.health <= 0); label = "敌对街区 · 击退两名拦路成员";
    } else if (e.type === "checkpoint") {
      const d = Math.hypot(SN.player.x - e.x, SN.player.z - e.z), car = SN.player.car;
      if (d < 12 && car && Math.abs(car.speed) > 12) { SN.forceWanted(1, "冲过临检点"); SN.finishStreetEvent(false); return; }
      e.progress = d < 12 && (!car || Math.abs(car.speed) < 0.6) && SN.holstered && SN.heat === 0 ? e.progress + dt : 0;
      done = e.progress > 3; label = "警方临检 · 光圈旁停车，收起武器等待 3 秒";
    } else {
      const rival = SN.eventCars.find(c => c.active && c !== SN.player.car);
      if (SN.heat > 0 || SN.firing || SN.eventCars.some(c => c.active && c !== SN.player.car && c.damageByPlayer)) { SN.finishStreetEvent(false); return; }
      if (rival) {
        e.x = rival.x; e.z = rival.z;
        if (Math.hypot(rival.x - SN.player.x, rival.z - SN.player.z) < 90) e.progress += dt;
      }
      done = e.progress > 12; label = "明星车队 · 保持距离观看车队 12 秒";
    }
    SN.setText("cityEvent", label + " · ¥" + e.reward);
    if (done) SN.finishStreetEvent(true);
  };

  SN.registerInit(27.6, function initializeStreetEvents() {
    SN.streetEvent = null; SN.nextStreetEvent = 100;
    SN.streetEventTypes = ["snatch", "race", "ambush", "checkpoint", "motorcade"];
    SN.streetEventNames = ["抢包者", "非法街头邀赛", "帮派拦路", "警方临检", "明星车队"];
    SN.eventCars = [7, 2, 2].map(type => { const c = SN.makeCar(-80, -800, 0, true, null, 0, type, "event"); c.active = c.root.visible = false; return c; });
    SN.eventBeacon = new SN.T.Mesh(new SN.T.TorusGeometry(2.5, 0.12, 4, 24), new SN.T.MeshBasicMaterial({ color: 0x7df1bb, depthWrite: false }));
    SN.eventBeacon.rotation.x = -SN.PI / 2; SN.eventBeacon.visible = false; SN.scene.add(SN.eventBeacon);
    SN.eventBag = new SN.T.Group();
    SN.meshAt(SN.box, SN.mat(0xad6048), 0, 0, 0, 0.26, 0.29, 0.13, 0, SN.eventBag);
    SN.meshAt(new SN.T.TorusGeometry(0.09, 0.013, 4, 8), SN.mat(0xe4b478), 0, 0.19, 0, 1, 1, 1, 0, SN.eventBag);
    SN.eventBarrier = new SN.T.Group();
    const bars = [], legs = [];
    for (const side of [-1, 1]) {
      bars.push({ g: SN.box, x: side * 3, y: 0.85, z: 0, sx: 1.35, sy: 0.25, sz: 0.12 });
      for (const offset of [-0.5, 0.5]) legs.push({ g: SN.box, x: side * 3 + offset, y: 0.4, z: 0, sx: 0.1, sy: 0.8, sz: 0.5 });
    }
    SN.meshAt(SN.merged(bars), SN.mat(0xffce52, { emissive: 0x665100, emissiveIntensity: 0.4 }), 0, 0, 0, 1, 1, 1, 0, SN.eventBarrier);
    SN.meshAt(SN.merged(legs), SN.mat(0x245d80), 0, 0, 0, 1, 1, 1, 0, SN.eventBarrier);
    for (const group of [SN.eventBag, SN.eventBarrier]) { group.visible = false; group.traverse(m => { m.castShadow = false; }); SN.scene.add(group); }
    SN.$("cityEvent").addEventListener("click", SN.acceptStreetEvent);
  });

})(window.SN);
