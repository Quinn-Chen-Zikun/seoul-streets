/* 行人行为、人群调度、目击举报与通缉响应。 */
"use strict";
(function (SN) {
  SN.actorAt = function actorAt(index, x, z, kind = "civilian", crew = -1, archetype = null) {
    const profile = SN.makeProfile(index, kind, crew, archetype), height = profile.height || 1;
    const a = SN.actors[index] || { rig: SN.makeRig(0x517b84, profile.skin, height, profile), index };
    Object.assign(a, {
      x,
      z,
      homeX: x,
      homeZ: z,
      yaw: SN.rand(0, SN.TAU),
      phase: SN.rand(0, SN.TAU),
      speed: SN.rand(0.9, 1.4),
      kind,
      crew,
      health: 100,
      down: 0,
      fall: 0,
      cool: SN.rand(0.5, 2),
      hostile: false,
      active: true,
      inCar: null,
      linger: 0,
      panic: 0,
      flinch: 0,
      coverTimer: 0,
      coverX: 0,
      coverZ: 0,
      coverSet: false,
      strafeDir: index % 2 ? 1 : -1,
      strafeClock: SN.rand(0, 2),
      interior: false,
      wanderX: 3,
      wanderZ: 12,
      pedNode: null,
      pedPrev: null,
      pedTarget: null,
      pedLink: null,
      pedWait: 0,
      pedWaitTime: 0,
      pedCrossClear: false,
      pedNoCrossUntil: 0,
      pedLaneBias: 0.3,
      pedStuckClock: 0,
      pedTurnClock: 0,
      pedTurnAccum: 0,
      pedWindowX: x,
      pedWindowZ: z,
      pedFail: 0,
      pedDespawn: false,
      pedCornerStreak: 0,
      pedWalking: false,
      knockout: false,
      temper: kind === "gang" ? SN.rand(0.55, 0.95) : kind === "police" ? 0.72 : SN.rand(0.05, 1),
      tough: kind === "gang" || kind === "police" || index % 5 === 0,
      armedWeapon: kind === "police" ? 1 : kind === "gang" ? 1 : -1,
      meleeOnly: false,
      footPolice: false,
      armored: false,
      resisted: false,
      arrestTimer: 0,
      attackTimer: 0,
      stumble: 0,
      bumpCool: 0,
      bumpClock: 0,
      bumpCount: 0,
      mode: "walk",
      modeTimer: SN.rand(2, 8),
      sideYaw: SN.rand(0, SN.TAU),
      dirSign: index % 2 ? 1 : -1,
      walkRange: SN.rand(5, 14),
      sitting: false,
      sitX: 0,
      sitZ: 0,
      sitYaw: 0,
      phone: false,
      chat: false,
      crossWait: 0,
      crossX: x,
      crossZ: z,
      dropGiven: false,
      carHitCool: 0,
      lastBumpTime: -100,
      hostileTimer: 0,
      speechCool: 0
    });
    SN.actors[index] = a;
    const def = SN.pedestrianArchetypes[profile.archetype], trait = SN.rnd();
    a.archetype = profile.archetype;
    a.personality = kind === "gang" ? "angry" : kind === "police" ? "brave" : trait < def.traits[0] ? "brave" : trait < def.traits[0] + def.traits[1] ? "angry" : "timid";
    a.speed = def ? SN.rand(...def.speed) : 1.3;
    a.temper = a.personality === "angry" ? 0.85 : a.personality === "brave" ? 0.5 : 0.12;
    a.tough = a.personality !== "timid";
    a.partner = null;
    a.lodElapsed = 0;
    return a;
  };

  SN.showCrimeLabel = function showCrimeLabel(label) {
    const el = SN.$("crimeLabel");
    el.textContent = label;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  };

  SN.setSearchCenter = function setSearchCenter(x, z, radius) {
    SN.searchX = x;
    SN.searchZ = z;
    if (radius)
      SN.searchRadius = radius;
    SN.wantedSearch = 0;
    SN.wantedCooldown = 0;
  };

  SN.acquirePhoneIcon = function acquirePhoneIcon() {
    for (const icon of SN.phoneIcons)
      if (!icon.active) {
        icon.active = true;
        icon.sprite.visible = true;
        return icon;
      }
    return null;
  };

  SN.applyCrime = function applyCrime(severity, label, key) {
    const base = SN.clamp(Math.round(severity), 1, 5);
    let level = base;
    if (key && SN.simTime - (SN.lastOffence[key] || -999) < 14)
      level = SN.clamp(level + 1, 1, 5);
    if (key)
      SN.lastOffence[key] = SN.simTime;
    SN.lastCrime = SN.simTime;
    SN.heatDecay = 0;
    const raised = level > SN.heat;
    if (raised) {
      SN.heat = level;
      SN.wantedResisted = false;
      SN.wantedFlash = 1.35;
    }
    SN.evasionCar = SN.player.car;
    SN.setSearchCenter(SN.player.x, SN.player.z, 46 + SN.heat * 11);
    SN.showCrimeLabel(label + (raised ? "" : " · 已记录"));
    SN.toast(label + (raised ? " · 通缉升至 " + SN.heat + " 星" : " · 最高通缉已记录"), 3.4);
    SN.spawnClock = 0;
    SN.roadblockClock = 0;
    SN.spikeClock = 0;
  };

  SN.forceWanted = function forceWanted(level, label) {
    const next = SN.clamp(Math.round(level), 0, 5);
    if (next <= 0)
      return;
    SN.heat = Math.max(SN.heat, next);
    SN.lastCrime = SN.simTime;
    SN.evasionCar = SN.player.car;
    SN.setSearchCenter(SN.player.x, SN.player.z, 46 + SN.heat * 11);
    SN.wantedFlash = 1.35;
    SN.showCrimeLabel(label);
    SN.spawnClock = 0;
  };

  SN.commitCrime = function commitCrime(severity, label, key = "general", radius = 42) {
    if (severity <= 0)
      return false;
    if (!SN.started || SN.arrestState)
      return false;
    const queued = SN.pendingReports.find(r => r.key === key);
    if (queued) {
      queued.severity = Math.max(queued.severity, severity);
      if (severity >= queued.severity) queued.label = label;
      return true;
    }
    const policeSeen = [], civilSeen = [];
    for (const a of SN.actors) {
      if (!a.active || a.down || a.inCar && !a.inCar.active)
        continue;
      if (a.kind !== "police" && a.kind !== "civilian")
        continue;
      if (Math.hypot(a.x - SN.player.x, a.z - SN.player.z) > radius)
        continue;
      if (!SN.visibleBetween(a.x, SN.groundUnder(a.x, a.z, 0.2) + 1.45, a.z, SN.player.x, SN.player.y + 1.2, SN.player.z))
        continue;
      if (a.kind === "police")
        policeSeen.push(a);
      else
        civilSeen.push(a);
    }
    if (!policeSeen.length && !civilSeen.length)
      return false;
    if (policeSeen.length) {
      SN.pendingReports.push({ timer: SN.rand(0.45, 0.9), severity, label, key, caller: policeSeen[0], icon: null, police: true });
    }
    else if (civilSeen.length) {
      const caller = civilSeen[0], icon = SN.acquirePhoneIcon();
      SN.pendingReports.push({ timer: SN.rand(2.1, 4.1), severity, label, key, caller, icon, police: false });
    }
    return true;
  };

  SN.updatePendingReports = function updatePendingReports(dt) {
    for (let i = SN.pendingReports.length - 1; i >= 0; i--) {
      const r = SN.pendingReports[i];
      r.timer -= dt;
      if (r.icon) {
        const a = r.caller;
        if (a && a.active && !a.down) {
          r.icon.sprite.position.set(a.x, SN.groundUnder(a.x, a.z, 0.2) + 2.35 + Math.sin(SN.simTime * 5) * 0.08, a.z);
          r.icon.sprite.scale.setScalar(0.78 + Math.sin(SN.simTime * 7) * 0.08);
        }
        else
          r.icon.sprite.visible = false;
      }
      if (r.timer <= 0) {
        if (r.icon) {
          r.icon.sprite.visible = false;
          r.icon.active = false;
        }
        SN.applyCrime(r.severity, r.label, r.key);
        SN.pendingReports.splice(i, 1);
      }
    }
  };

  SN.nearestWantedOfficer = function nearestWantedOfficer() {
    let best = null, d = Infinity;
    for (const a of SN.actors) {
      if (!a.active || a.down || a.inCar || a.kind !== "police")
        continue;
      const dist = Math.hypot(a.x - SN.player.x, a.z - SN.player.z);
      if (dist < d) {
        d = dist;
        best = a;
      }
    }
    return { officer: best, distance: d };
  };

  SN.clearWantedResponse = function clearWantedResponse() {
    for (const a of SN.actors) {
      if (a.kind !== "police")
        continue;
      if (a.footPolice) {
        a.footPolice = false;
        a.hostile = false;
        a.resisted = false;
        a.arrestTimer = 0;
        if (!a.inCar) {
          a.active = Math.hypot(a.x - SN.player.x, a.z - SN.player.z) < 60;
        }
      }
    }
    for (const c of SN.pursuitCars) {
      if (c.role !== "police" || c === SN.player.car)
        continue;
      if (!c.active)
        continue;
      if (c.occupant) {
        c.occupant.inCar = null;
        c.occupant.active = false;
        c.occupant.footPolice = false;
        c.occupant.hostile = false;
        c.occupant = null;
      }
      c.active = false;
      c.root.visible = false;
      c.speed = c.vx = c.vz = 0;
    }
    for (const rb of SN.roadblocks) {
      if (!rb.active)
        continue;
      rb.active = false;
      rb.car.active = false;
      rb.car.root.visible = false;
      rb.cones.visible = false;
    }
    for (const s of SN.spikeStrips) {
      if (!s.active)
        continue;
      s.active = false;
      s.group.visible = false;
    }
    SN.deactivateHelicopter();
    for (const r of SN.pendingReports)
      if (r.icon) {
        r.icon.sprite.visible = false;
        r.icon.active = false;
      }
    SN.pendingReports.length = 0;
    SN.wantedResponseActive = false;
    SN.wantedSearch = 0;
    SN.wantedCooldown = 0;
    SN.evasionCar = null;
  };

  SN.updateWanted = function updateWanted(dt) {
    if (SN.arrestState)
      return;
    SN.updatePendingReports(dt);
    SN.wantedFlash = Math.max(0, SN.wantedFlash - dt);
    if (SN.heat <= 0) {
      SN.wantedSearch = 0;
      if (SN.wantedResponseActive)
        SN.clearWantedResponse();
      return;
    }
    SN.wantedResponseActive = true;
    let spotted = false;
    for (const a of SN.actors) {
      if (!a.active || a.down || a.kind !== "police")
        continue;
      if (Math.hypot(a.x - SN.player.x, a.z - SN.player.z) > 115)
        continue;
      if (SN.visibleBetween(a.x, SN.groundUnder(a.x, a.z, 0.2) + 1.45, a.z, SN.player.x, SN.player.y + 1.2, SN.player.z)) {
        spotted = true;
        break;
      }
    }
    if (SN.helicopter.active && Math.hypot(SN.helicopter.root.position.x - SN.player.x, SN.helicopter.root.position.z - SN.player.z) < 65 && SN.visibleBetween(SN.helicopter.root.position.x, SN.helicopter.root.position.y, SN.helicopter.root.position.z, SN.player.x, SN.player.y + 1, SN.player.z))
      spotted = true;
    SN.wantedSearch = spotted ? 2 : 1;
    if (spotted) {
      SN.lastSeen = SN.simTime;
      SN.searchX = SN.player.x;
      SN.searchZ = SN.player.z;
      SN.wantedCooldown = Math.max(0, SN.wantedCooldown - dt * 2);
    }
    let conceal = 1;
    if (SN.enterableAt(SN.player.x, SN.player.z))
      conceal = 2.5;
    else if (SN.player.car && SN.player.car !== SN.evasionCar)
      conceal = 1.5;
    if (SN.concealBoost > 0) {
      conceal *= 1.7;
      SN.concealBoost = Math.max(0, SN.concealBoost - dt);
    }
    const outside = Math.hypot(SN.player.x - SN.searchX, SN.player.z - SN.searchZ) > SN.searchRadius;
    if (!spotted && outside)
      SN.wantedCooldown += dt * conceal;
    else
      SN.wantedCooldown = Math.max(0, SN.wantedCooldown - dt * 0.75);
    if (SN.wantedCooldown >= 6.4 + SN.heat * 1.05) {
      SN.wantedCooldown = 0;
      SN.heat = Math.max(0, SN.heat - 1);
      SN.wantedFlash = 1.5;
      SN.wantedResisted = false;
      if (SN.heat > 0) {
        SN.searchRadius = Math.max(40, SN.searchRadius - 9);
        SN.toast("警戒下降 · 剩余 " + SN.heat + " 星 · 继续离开搜索圈", 3.5);
      }
      else {
        SN.toast("已摆脱追捕 · 城市暂时恢复平静", 4);
        SN.lastSeen = SN.simTime;
        SN.clearWantedResponse();
        return;
      }
    }
    SN.spawnClock -= dt;
    if (SN.spawnClock <= 0 && (spotted || !outside)) {
      const tuning = SN.policeTuning[SN.heat];
      const footDesired = tuning.foot;
      let footCount = 0;
      for (const a of SN.actors)
        if (a.active && a.footPolice && !a.down && !a.inCar)
          footCount++;
      if (footCount < footDesired)
        SN.spawnFootOfficer(SN.heat >= 4);
      const carDesired = tuning.cars;
      let carCount = 0;
      for (const c of SN.pursuitCars)
        if (c.active && c.role === "police")
          carCount++;
      // Three stars bring a visible pair immediately; later reinforcements stay capped.
      const arrivals = SN.heat >= 3 && carCount < 2 ? Math.min(2 - carCount, carDesired - carCount) : Math.min(1, carDesired - carCount);
      for (let i = 0; i < arrivals; i++) SN.spawnPursuit("police");
      SN.spawnClock = tuning.interval;
    }
    if (SN.heat >= 4) {
      SN.roadblockClock -= dt;
      if (SN.roadblockClock <= 0 && (spotted || !outside)) {
        SN.deployRoadblock();
        SN.roadblockClock = 13;
      }
    }
    else {
      SN.roadblockClock = 0;
      for (const rb of SN.roadblocks)
        if (rb.active) {
          rb.active = false;
          rb.car.active = false;
          rb.car.root.visible = false;
          rb.cones.visible = false;
        }
    }
    if (SN.heat >= 4) {
      SN.spikeClock -= dt;
      if (SN.spikeClock <= 0 && (spotted || !outside)) {
        SN.deploySpikes();
        SN.spikeClock = 16;
      }
    }
    else {
      SN.spikeClock = 0;
      for (const s of SN.spikeStrips)
        if (s.active) {
          s.active = false;
          s.group.visible = false;
        }
    }
    if (SN.heat >= 5)
      SN.activateHelicopter();
    else
      SN.deactivateHelicopter();
    SN.updateHelicopter(dt);
    SN.updateSpikeStrips();
  };

  SN.beginArrest = function beginArrest(officer) {
    if (SN.arrestState || SN.player.dead)
      return;
    SN.failMission("被警方拘留");
    SN.lastArrestStars = Math.max(1, SN.heat);
    SN.survivedPeak = 0;
    SN.arrestState = { time: 0, fade: false, done: false, officer };
    SN.clearInput();
    SN.firing = SN.aiming = false;
    SN.holstered = true;
    SN.selectedWeapon = -1;
    SN.reloadTime = 0;
    for (const r of SN.pendingReports)
      if (r.icon) {
        r.icon.sprite.visible = false;
        r.icon.active = false;
      }
    SN.pendingReports.length = 0;
    if (SN.player.car) {
      SN.player.car.speed = SN.player.car.vx = SN.player.car.vz = 0;
      SN.player.car.parked = true;
      SN.player.car = null;
      SN.playerRoot.visible = true;
      SN.player.y = SN.surfaceHeight(SN.player.x, SN.player.z);
    }
    SN.$("arrestPrompt").classList.remove("visible");
    SN.speakBubble(officer, "举起手，别动。", "angry");
  };

  SN.finishArrest = function finishArrest() {
    let station = SN.policeStations[0];
    for (const s of SN.policeStations)
      if (Math.hypot(s.x - SN.player.x, s.z - SN.player.z) < Math.hypot(station.x - SN.player.x, station.z - SN.player.z))
        station = s;
    const fine = Math.min(SN.money, 120 + SN.lastArrestStars * 170);
    SN.money = Math.max(0, SN.money - fine);
    for (let i = 1; i < SN.weapons.length; i++) {
      SN.weapons[i].owned = false;
      SN.weapons[i].mag = 0;
      SN.weapons[i].reserve = 0;
    }
    SN.weapons[0].owned = true;
    SN.campaign.loadoutLost = true;
    SN.minutes = (SN.minutes + 240) % 1440;
    SN.carjack = null;
    SN.selectedWeapon = -1;
    SN.holstered = true;
    const p = SN.safePosition(station.x + 3, station.z + 4, 0.45);
    SN.player.x = p.x;
    SN.player.z = p.z;
    SN.player.y = SN.surfaceHeight(p.x, p.z);
    SN.player.vy = 0;
    SN.player.grounded = true;
    SN.player.health = 100;
    SN.player.armor = 40;
    SN.player.motionSpeed = 0;
    SN.player.speed = 0;
    SN.player.fallPeak = SN.player.y;
    SN.player.dead = 0;
    SN.player.bail = null;
    SN.player.vault = null; SN.player.policeHitBudget = 4; SN.player.policeHitAt = SN.simTime;
    SN.closeShopMenu(); SN.closeStreetPanel(); SN.toggleCityMap(false); SN.toggleJournal(false); SN.closeDialogue();
    SN.$("downscreen").classList.remove("visible");
    SN.playerRoot.rotation.x = 0;
    SN.playerRoot.visible = true;
    SN.playerRoot.rotation.z = 0;
    Object.assign(SN.playerRig.motion, { speed: 0, weight: 0, lean: 0, phase: 0 });
    for (const leg of SN.playerRig.legs)
      leg.planted = false;
    SN.heat = 0;
    SN.wantedResisted = false;
    SN.searchRadius = 55;
    SN.wantedCooldown = 0;
    SN.lastCrime = SN.simTime;
    SN.lastSeen = SN.simTime;
    SN.concealBoost = 0;
    for (const key in SN.lastOffence)
      delete SN.lastOffence[key];
    SN.clearWantedResponse();
    for (const a of SN.actors)
      if (a.hostile && !a.missionEnemy) {
        a.hostile = false;
        a.anger = 0;
      }
    SN.camTarget.set(SN.player.x, SN.player.y + 1.3, SN.player.z);
    SN.lookTarget.copy(SN.camTarget);
    SN.camera.position.set(SN.player.x + 5, SN.player.y + 3, SN.player.z + 4);
    SN.snapPlayer();
    SN.snapCars();
    SN.refreshWeaponSlots();
    SN.saveCampaign();
    SN.$("arrestText").textContent = "罚款 ¥ " + fine + " · 武器已被没收 · 已带往最近的治安站";
    SN.$("arrestFine").textContent = station.label + " · " + (fine > 0 ? "现金不足部分以社区服务抵扣" : "钱包已空");
  };

  SN.updateArrest = function updateArrest(dt) {
    const s = SN.arrestState;
    if (!s)
      return;
    s.time += dt;
    SN.player.motionSpeed = 0;
    SN.player.speed = 0;
    SN.poseRig(SN.playerRig, 0, 0, SN.simTime, false, false, 0, -1);
    SN.playerRig.arms[0].upper.rotation.set(-2.72, 0, -0.5);
    SN.playerRig.arms[0].lower.rotation.x = -0.22;
    SN.playerRig.arms[1].upper.rotation.set(-2.72, 0, 0.5);
    SN.playerRig.arms[1].lower.rotation.x = -0.22;
    SN.playerRig.head.rotation.x = 0.12;
    if (!s.fade && s.time > 0.95) {
      s.fade = true;
      SN.$("arrestText").textContent = "警察正在核对你的身份";
      SN.$("arrestFine").textContent = "";
      SN.$("arrestScreen").classList.add("visible");
    }
    if (!s.done && s.time > 2.55) {
      s.done = true;
      SN.finishArrest();
    }
    if (s.time > 4.55) {
      SN.$("arrestScreen").classList.remove("visible");
      SN.arrestState = null;
    }
  };

  SN.raiseHeat = function raiseHeat(amount) {
    const level = SN.clamp(Math.ceil(amount), 1, 5);
    SN.forceWanted(level, "警戒提升 ★" + level);
  };

  SN.deployRoadblock = function deployRoadblock() {
    const slot = SN.roadblocks.find(rb => !rb.active);
    if (!slot)
      return;
    const p = SN.roadSpawn(SN.rand(100, 150));
    if (!p)
      return;
    const car = slot.car;
    car.active = true;
    car.root.visible = true;
    car.x = p.x;
    car.z = p.z;
    car.yaw = p.yaw + SN.PI / 2;
    car.root.position.set(p.x, SN.surfaceHeight(p.x, p.z), p.z);
    car.root.rotation.y = car.yaw;
    SN.repairVehicle(car);
    car.paint.color.copy(SN.srgb(0xd3e3e7));
    car.speed = car.vx = car.vz = 0;
    car.parked = true;
    car.driver = false;
    car.occupant = null;
    slot.cones.position.set(p.x, SN.surfaceHeight(p.x, p.z), p.z);
    slot.cones.rotation.y = car.yaw;
    slot.cones.visible = true;
    slot.active = true;
  };

  SN.deploySpikes = function deploySpikes() {
    const s = SN.spikeStrips.find(item => !item.active);
    if (!s)
      return;
    const p = SN.roadSpawn(SN.rand(65, 105));
    if (!p)
      return;
    s.group.position.set(p.x, SN.surfaceHeight(p.x, p.z) + 0.02, p.z);
    s.group.rotation.y = p.yaw + SN.PI / 2;
    s.group.visible = true;
    s.active = true;
    s.lastHit = -100;
  };

  SN.updateSpikeStrips = function updateSpikeStrips() {
    const c = SN.player.car;
    if (!c)
      return;
    for (const s of SN.spikeStrips) {
      if (!s.active)
        continue;
      if (Math.abs(c.speed) < 2.4)
        continue;
      if (Math.hypot(c.x - s.group.position.x, c.z - s.group.position.z) > 2.4)
        continue;
      if (SN.simTime - s.lastHit < 2.4)
        continue;
      s.lastHit = SN.simTime;
      c.health = Math.max(0, c.health - 16);
      c.speed *= 0.52;
      SN.camShake = Math.max(SN.camShake, 0.3);
      SN.camShakeTime = 0.4;
      SN.toast("轮胎撞上阻车钉 · 车况下降", 2.4);
      SN.emitSparks(c.x, SN.surfaceHeight(c.x, c.z) + 0.2, c.z, 10, true);
    }
  };

  SN.spawnFootOfficer = function spawnFootOfficer(armored = false) {
    const p = SN.roadSpawn(SN.rand(24, 42));
    if (!p)
      return false;
    let a = SN.actors.find(item => item.kind === "police" && !item.active && !item.inCar && !item.guard);
    if (!a)
      a = SN.actors.find(item => item.kind === "police" && !item.inCar && !item.down && !item.guard && Math.hypot(item.x - SN.player.x, item.z - SN.player.z) > 170);
    if (!a)
      return false;
    Object.assign(a, {
      x: p.x,
      z: p.z,
      homeX: p.x,
      homeZ: p.z,
      active: true,
      footPolice: true,
      inCar: null,
      down: 0,
      fall: 0,
      stagger: false,
      hostile: SN.heat >= 3 || SN.wantedResisted,
      resisted: SN.wantedResisted,
      armedWeapon: armored ? 2 : 1,
      meleeOnly: false,
      armored,
      arrestTimer: 0,
      cool: SN.rand(0.7, 1.6),
      attackTimer: 0,
      dropGiven: false,
      health: armored ? 170 : 95,
      yaw: Math.atan2(SN.player.x - p.x, SN.player.z - p.z)
    });
    a.rig.root.scale.setScalar(armored ? 1.07 : 1);
    a.rig.height = armored ? 1.07 : 1;
    for (const part of a.rig.parts)
      if (part.matType === "cloth" && (part.geoName === "torso" || part.geoName === "box"))
        part.colorObject.setHex(armored ? 0x2e353d : part.geoName === "torso" ? 0x2c3f63 : 0x26313f);
    return true;
  };

  SN.activateHelicopter = function activateHelicopter() {
    if (SN.helicopter.active)
      return;
    SN.helicopter.active = true;
    SN.helicopter.root.visible = true;
    SN.helicopter.angle = Math.atan2(SN.player.x - SN.helicopter.root.position.x, SN.player.z - SN.helicopter.root.position.z);
    if (!Number.isFinite(SN.helicopter.angle))
      SN.helicopter.angle = 0;
    SN.helicopter.root.position.set(SN.searchX + 70, SN.surfaceHeight(SN.searchX + 70, SN.searchZ + 70) + 30, SN.searchZ + 70);
    SN.toast("重案支援：警用直升机已升空", 3.5);
  };

  SN.deactivateHelicopter = function deactivateHelicopter() {
    if (!SN.helicopter.active)
      return;
    SN.helicopter.active = false;
    SN.helicopter.root.visible = false;
    SN.helicopter.spot.intensity = 0;
    SN.helicopter.beam.visible = false;
  };

  SN.updateHelicopter = function updateHelicopter(dt) {
    const h = SN.helicopter;
    if (!h.active)
      return;
    h.angle += dt * 0.24;
    const r = 22 + Math.sin(SN.simTime * 0.3) * 4;
    const tx = SN.searchX + Math.sin(h.angle) * r, tz = SN.searchZ + Math.cos(h.angle) * r;
    const dx = tx - h.root.position.x, dz = tz - h.root.position.z, distance = Math.hypot(dx, dz) || 1;
    const step = Math.min(1, dt * 16 / distance);
    h.root.position.x += dx * step;
    h.root.position.z += dz * step;
    h.root.position.y = SN.lerp(h.root.position.y, SN.surfaceHeight(h.root.position.x, h.root.position.z) + 30, Math.min(1, dt));
    h.root.rotation.y = Math.atan2(SN.player.x - h.root.position.x, SN.player.z - h.root.position.z);
    h.rotor.rotation.y += dt * 26;
    h.tailRotor.rotation.x += dt * 38;
    const aimX = SN.searchX, aimZ = SN.searchZ;
    h.target.position.set(aimX, SN.surfaceHeight(aimX, aimZ), aimZ);
    h.spot.intensity = SN.qualityLevel() > 0 ? 2.2 : 0;
    h.beam.visible = true;
    h.beam.position.set(0, -16, 1.6);
  };

  SN.roadSpawn = function roadSpawn(distance = 100) {
    let best = null, error = Infinity;
    for (const p of SN.roadSpawnPoints) {
      const e = Math.abs(Math.hypot(p.x - SN.player.x, p.z - SN.player.z) - distance);
      if (e >= error)
        continue;
      let occupied = false;
      for (const c of SN.cars)
        if (c.active && Math.hypot(c.x - p.x, c.z - p.z) < 5) {
          occupied = true;
          break;
        }
      if (!occupied) {
        best = p;
        error = e;
      }
    }
    return best;
  };

  SN.spawnPursuit = function spawnPursuit(role, team = -1) {
    const car = SN.pursuitCars.find(c => !c.active && c.role === role && (role !== "gang" || c.team === team));
    if (!car)
      return;
    const type = SN.heat >= 5 ? 13 : SN.heat >= 4 ? 12 : 9;
    if (role === "police" && car.type !== type) SN.fitVehicle(car, type);
    const count = SN.pursuitCars.filter(c => c.active && c.role === role).length;
    const heading = SN.player.car ? SN.player.car.yaw : SN.player.yaw, direction = count % 2 ? -1 : 1;
    let p = null, best = Infinity;
    for (const point of SN.roadSpawnPoints) {
      const dx = point.x - SN.player.x, dz = point.z - SN.player.z, d = Math.hypot(dx, dz);
      if (d < 48 || d > (count < 2 ? 115 : 220) || SN.carBlocked(point.x, point.z, point.yaw, car) || SN.carWater(point.x, point.z, point.yaw, car)) continue;
      if (SN.cars.some(c => c !== car && c.active && Math.hypot(c.x - point.x, c.z - point.z) < 8)) continue;
      const along = dx * Math.sin(heading) + dz * Math.cos(heading);
      const facingAway = dx * Math.sin(point.yaw) + dz * Math.cos(point.yaw) > 0;
      const score = Math.abs(d - 78) + (along * direction < 20 ? 150 : 0) + (facingAway ? 20 : 0) + Math.abs(dx * Math.cos(heading) - dz * Math.sin(heading)) * 0.4;
      if (score < best) { best = score; p = point; }
    }
    if (!p)
      return;
    let driver;
    if (role === "police")
      driver = SN.actors.find(a => a.kind === "police" && !a.active && !a.inCar && !a.guard);
    else
      driver = SN.actors.find(a => a.kind === "gang" && !a.missionEnemy && a.crew === team && a.active && !a.down && !a.inCar);
    if (!driver)
      return;
    SN.repairVehicle(car);
    if (role === "police") car.paint.color.copy(SN.srgb(SN.heat >= 4 ? 0x243a53 : 0xd3e3e7));
    Object.assign(car, p, {
      freeRolling: false,
      active: true,
      health: 100,
      speed: 5,
      vx: Math.sin(p.yaw) * 5,
      vz: Math.cos(p.yaw) * 5,
      driver: true,
      parked: false,
      stuck: 0,
      navTime: 0,
      navNode: -1,
      navGoal: -1
    });
    car.pursuitSlot = count;
    SN.resetVehicleGround(car);
    car.root.position.set(car.x, car.y, car.z);
    car.root.rotation.y = car.yaw;
    car.root.visible = true;
    driver.active = true;
    driver.health = role === "police" && SN.heat >= 4 ? 170 : 100;
    driver.armored = role === "police" && SN.heat >= 4;
    driver.armedWeapon = driver.armored ? 2 : 1;
    driver.footPolice = role === "police";
    driver.down = 0;
    driver.bail = null; driver.panic = 0; driver.resisted = false; driver.flinch = 0;
    driver.dropGiven = false; driver.meleeOnly = false; driver.poseDirty = true; driver.lodElapsed = 0;
    driver.hostile = true;
    driver.inCar = car;
    car.occupant = driver;
    driver.x = p.x;
    driver.z = p.z;
  };

  SN.scareCivilians = function scareCivilians(x, z, radius) {
    for (const c of SN.cars) if (c.active && c.driver && c.role === "traffic" && Math.hypot(c.x - x, c.z - z) < radius) c.panic = 6;
    for (const a of SN.actors) {
      if (!a.active || a.down || a.inCar || a.kind !== "civilian" || a.interior)
        continue;
      if (Math.hypot(a.x - x, a.z - z) > radius)
        continue;
      a.panic = Math.max(a.panic, SN.rand(4, 9));
      a.sitting = false;
      a.phone = false;
      a.chat = false;
      a.mode = "flee";
      if (SN.rnd() < 0.18)
        SN.cityBark(a, "gun", "scared");
    }
  };

  SN.benchFree = function benchFree(b, a) {
    for (const other of SN.actors) {
      if (other === a || !other.active || !other.sitting)
        continue;
      if (Math.hypot(other.x - b.x, other.z - b.z) < 1.1)
        return false;
    }
    return true;
  };

  // Sidewalk graph: two pavement lanes per road, crosswalk links and junction corner links.
  SN.pedLaneOffset = function pedLaneOffset(road) {
    return road.pedestrian ? Math.max(0.9, road.width * 0.18) : road.width / 2 + 0.3 + (road.sidewalkW || 2) / 2;
  };

  SN.pedOnCarriageway = function pedOnCarriageway(x, z) {
    const sample = SN.roadSample(x, z, 0.5);
    if (!sample || sample.profile.pedestrian)
      return false;
    return Math.abs(sample.across || 0) < sample.profile.width / 2 + 0.1;
  };

  SN.pedOnCrosswalk = function pedOnCrosswalk(x, z, margin = 2.2) {
    for (const crossing of SN.pedCrossings || [])
      if (SN.segmentDistance(x, z, crossing.ax, crossing.az, crossing.bx, crossing.bz) < margin)
        return crossing;
    return null;
  };

  SN.pedLinkClear = function pedLinkClear(ax, az, bx, bz, allowRoad = false) {
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    if (length < 0.01)
      return false;
    const steps = Math.max(2, Math.ceil(length / 1.2));
    for (let i = 0; i <= steps; i++) {
      const x = SN.lerp(ax, bx, i / steps), z = SN.lerp(az, bz, i / steps);
      if (SN.blocked(x, z, 0.28) || SN.isWater(x, z, 0.3))
        return false;
      if (!allowRoad && SN.pedOnCarriageway(x, z))
        return false;
    }
    return true;
  };

  SN.buildPedestrianGraph = function buildPedestrianGraph() {
    const CELL = 16, grid = new Map(), lanes = [];
    let nodes = [];
    const keyOf = (x, z) => Math.floor(x / CELL) + "," + Math.floor(z / CELL);
    const addNode = node => {
      node.id = nodes.length;
      node.links = [];
      nodes.push(node);
      const key = keyOf(node.x, node.z);
      if (!grid.has(key))
        grid.set(key, []);
      grid.get(key).push(node);
      return node;
    };
    const addLink = (a, b, data = {}) => {
      if (!a || !b || a === b || a.links.some(link => link.node === b))
        return null;
      a.links.push({ node: b, ...data });
      b.links.push({ node: a, ...data });
      return data;
    };
    SN.pavementSpawns = [];
    for (const road of SN.roads) {
      if (road.bridge || /江边北路|奥林匹克|匝道/.test(road.name) || !road.segments || !road.segments.length)
        continue;
      const offset = SN.pedLaneOffset(road);
      for (const side of [-1, 1]) {
        const laneNodes = [];
        for (const seg of road.segments)
          for (let t = 0; t < seg.len - 0.4; t += 8) {
            const x = seg.a[0] + seg.dx * t / seg.len + seg.dz / seg.len * offset * side,
              z = seg.a[1] + seg.dz * t / seg.len - seg.dx / seg.len * offset * side;
            if (SN.blocked(x, z, 0.5) || SN.isWater(x, z, 0.4) || SN.hillHeight(x, z) >= 70 || SN.pedOnCarriageway(x, z))
              continue;
            laneNodes.push(addNode({ x, z, yaw: seg.yaw, s: seg.s0 + t, road, side, lane: null, index: laneNodes.length }));
          }
        if (laneNodes.length < 2)
          continue;
        const lane = { road, side, nodes: laneNodes, pedestrian: !!road.pedestrian };
        for (const node of laneNodes)
          node.lane = lane;
        for (let i = 1; i < laneNodes.length; i++) {
          const a = laneNodes[i - 1], b = laneNodes[i];
          if (Math.hypot(b.x - a.x, b.z - a.z) <= 13 && SN.pedLinkClear(a.x, a.z, b.x, b.z))
            addLink(a, b, { lane: true });
        }
        lanes.push(lane);
      }
    }
    for (const path of SN.paths) {
      const dx = path.b[0] - path.a[0], dz = path.b[1] - path.a[1], length = Math.hypot(dx, dz);
      if (length < 4)
        continue;
      const tx = dx / length, tz = dz / length;
      for (const side of [-1, 1]) {
        const laneNodes = [];
        for (let t = 4; t < length; t += 7) {
          const x = path.a[0] + tx * t + tz * 1.35 * side, z = path.a[1] + tz * t - tx * 1.35 * side;
          if (SN.blocked(x, z, 0.4) || SN.isWater(x, z, 0.4))
            continue;
          laneNodes.push(addNode({ x, z, yaw: Math.atan2(dx, dz), s: t, road: null, side, lane: null, index: laneNodes.length }));
          SN.pavementSpawns.push({ x, z, yaw: Math.atan2(dx, dz), river: true, node: laneNodes[laneNodes.length - 1] });
        }
        if (laneNodes.length < 2)
          continue;
        const lane = { road: null, side, nodes: laneNodes, pedestrian: true };
        for (const node of laneNodes)
          node.lane = lane;
        for (let i = 1; i < laneNodes.length; i++) {
          const a = laneNodes[i - 1], b = laneNodes[i];
          if (Math.hypot(b.x - a.x, b.z - a.z) <= 12 && SN.pedLinkClear(a.x, a.z, b.x, b.z))
            addLink(a, b, { lane: true });
        }
        lanes.push(lane);
      }
    }
    // Pavement spawn points now point at their graph node so a recycled pedestrian starts on a lane.
    for (const lane of lanes)
      if (lane.road)
        for (const node of lane.nodes)
          SN.pavementSpawns.push({ x: node.x, z: node.z, yaw: node.yaw, river: false, node });
    const query = (x, z, radius) => {
      const found = [], cells = Math.ceil(radius / CELL);
      for (let dz = -cells; dz <= cells; dz++)
        for (let dx = -cells; dx <= cells; dx++) {
          const bucket = grid.get(keyOf(x + dx * CELL, z + dz * CELL));
          if (bucket)
            for (const node of bucket)
              if (Math.hypot(node.x - x, node.z - z) <= radius)
                found.push(node);
        }
      return found;
    };
    SN.pedNodeNearest = function pedNodeNearest(x, z, radius = 8) {
      let best = null, bestDistance = radius;
      for (const node of query(x, z, radius)) {
        const d = Math.hypot(node.x - x, node.z - z);
        if (d < bestDistance) { bestDistance = d; best = node; }
      }
      return best;
    };
    for (const crossing of SN.pedCrossings || []) {
      const a = SN.pedNodeNearest(crossing.ax, crossing.az, 9), b = SN.pedNodeNearest(crossing.bx, crossing.bz, 9);
      if (!a || !b || a === b)
        continue;
      const dx = crossing.bx - crossing.ax, dz = crossing.bz - crossing.az, length = Math.hypot(dx, dz) || 1;
      if ((b.x - a.x) * dx / length + (b.z - a.z) * dz / length < length * 0.55)
        continue;
      addLink(a, b, { cross: crossing });
    }
    // Corner paving links pair the nearest pavement node of each road once per
    // corner, so sidewalk lanes join at junctions without forming tight rings.
    for (const corner of SN.crossingCorners || []) {
      const near = query(corner.x, corner.z, 9);
      const bestByRoad = new Map();
      for (const node of near) {
        if (!node.lane || !node.lane.road || node.links.length >= 4)
          continue;
        const d = Math.hypot(node.x - corner.x, node.z - corner.z);
        const current = bestByRoad.get(node.lane.road);
        if (!current || d < current.d)
          bestByRoad.set(node.lane.road, { node, d });
      }
      const candidates = [...bestByRoad.values()].sort((a, b) => a.d - b.d).map(entry => entry.node);
      const used = new Set();
      for (let i = 0; i < candidates.length; i++)
        for (let j = i + 1; j < candidates.length; j++) {
          const a = candidates[i], b = candidates[j];
          if (used.has(a) || used.has(b) || a.lane === b.lane || a.links.length >= 4 || b.links.length >= 4)
            continue;
          if (SN.pedLinkClear(a.x, a.z, b.x, b.z)) {
            addLink(a, b, { corner: true });
            used.add(a);
            used.add(b);
          }
        }
    }
    // Riverside and park paths join the nearest pavement node.
    for (const node of nodes) {
      if (node.road || node.links.length >= 3)
        continue;
      const near = query(node.x, node.z, 9);
      for (const other of near) {
        if (!other.road || other.links.length >= 4)
          continue;
        if (SN.pedLinkClear(node.x, node.z, other.x, other.z)) {
          addLink(node, other, { plaza: true });
          break;
        }
      }
    }
    // Tiny disconnected fragments would leave pedestrians pacing between two
    // nodes, so drop them; crossings always keep their pavement endpoints.
    const keep = new Set(), visited = new Set();
    for (const start of nodes) {
      if (visited.has(start))
        continue;
      const component = [], queue = [start];
      visited.add(start);
      let hasCross = false;
      while (queue.length) {
        const node = queue.pop();
        component.push(node);
        for (const link of node.links) {
          if (link.cross)
            hasCross = true;
          if (!visited.has(link.node)) {
            visited.add(link.node);
            queue.push(link.node);
          }
        }
      }
      if (component.length >= 8 || hasCross)
        for (const node of component)
          keep.add(node);
    }
    for (const node of nodes)
      node.links = node.links.filter(link => keep.has(link.node));
    const kept = nodes.filter(node => keep.has(node) && node.links.length > 0);
    kept.forEach((node, index) => { node.id = index; });
    grid.clear();
    for (const node of kept) {
      const key = keyOf(node.x, node.z);
      if (!grid.has(key))
        grid.set(key, []);
      grid.get(key).push(node);
    }
    nodes = kept;
    SN.pavementSpawns = SN.pavementSpawns.filter(point => !point.node || keep.has(point.node));
    SN.pedLanes = lanes;
    SN.pedestrianNodes = nodes;
    SN.pedNodeGrid = grid;
    return { nodes: nodes.length, lanes: lanes.length };
  };

  SN.pedChooseTarget = function pedChooseTarget(a) {
    const node = a.pedNode;
    if (!node) {
      a.pedTarget = null;
      return false;
    }
    const options = [];
    for (const link of node.links) {
      if (link.node === a.pedPrev || (link.cross && SN.simTime < a.pedNoCrossUntil))
        continue;
      const dx = link.node.x - node.x, dz = link.node.z - node.z, length = Math.hypot(dx, dz);
      if (length < 0.4)
        continue;
      const alignment = (Math.sin(a.yaw) * dx + Math.cos(a.yaw) * dz) / length;
      let preference = link.lane ? 0.7 : link.cross ? 0.25 : link.plaza ? 0.2 : -0.1;
      if (!link.lane && !link.cross && a.pedCornerStreak > 1)
        preference -= 0.8;
      options.push({ link, score: alignment * (link.lane ? 1.2 : 0.9) + preference + SN.rnd() * 0.3 });
    }
    if (!options.length)
      for (const link of node.links)
        if (link.node !== node && !link.cross)
          options.push({ link, score: 0.1 });
    if (!options.length) {
      a.pedTarget = null;
      a.pedLink = null;
      return false;
    }
    options.sort((x, y) => y.score - x.score);
    const chosen = options[0].link;
    a.pedCornerStreak = chosen.lane || chosen.cross ? 0 : (a.pedCornerStreak || 0) + 1;
    if (a.pedCornerStreak > 4) {
      a.pedCornerStreak = 0;
      SN.pedestrianRepath(a);
      return false;
    }
    a.pedLink = chosen;
    a.pedTarget = chosen.node;
    return true;
  };

  SN.pedCrossSafe = function pedCrossSafe(crossing, a) {
    if (!crossing)
      return true;
    const waiting = a.pedWaitTime > 8;
    if (!waiting && SN.trafficGreen(crossing.signal))
      return false;
    const mx = (crossing.ax + crossing.bx) / 2, mz = (crossing.az + crossing.bz) / 2;
    for (const car of SN.cars) {
      if (!car.active || car.parked || Math.abs(car.speed) < 1.2)
        continue;
      if (Math.hypot(car.x - mx, car.z - mz) < 9)
        return false;
    }
    return true;
  };

  SN.pedestrianWalkTarget = function pedestrianWalkTarget(a, dt) {
    if (!SN.pedestrianNodes || !SN.pedestrianNodes.length)
      return null;
    if (!a.pedNode || Math.hypot(a.pedNode.x - a.x, a.pedNode.z - a.z) > 6.5) {
      // A pedestrian shoved deep into a wide road can be further than one lane
      // from any pavement node; widen the lookup so they can still find a way out.
      a.pedNode = SN.pedNodeNearest(a.x, a.z, 9) || (SN.pedOnCarriageway(a.x, a.z) ? SN.pedNodeNearest(a.x, a.z, 48) : null);
      a.pedPrev = null;
      a.pedTarget = null;
      a.pedLink = null;
      a.pedCrossClear = false;
    }
    if (!a.pedNode)
      return null;
    if (!a.pedTarget && !SN.pedChooseTarget(a))
      return null;
    let target = a.pedTarget;
    if (!target)
      return null;
    if (a.pedLink && a.pedLink.cross) {
      if (!a.pedCrossClear) {
        a.pedWaitTime += dt;
        if (!SN.pedCrossSafe(a.pedLink.cross, a)) {
          a.pedWait = 0.25;
          a.yaw = SN.approachAngle(a.yaw, Math.atan2(target.x - a.x, target.z - a.z), dt * 3);
          a.pedStuckClock = 0;
          a.pedTurnClock = 0;
          a.pedTurnAccum = 0;
          a.pedWindowX = a.x;
          a.pedWindowZ = a.z;
          return { x: target.x, z: target.z, speed: 0, wait: true };
        }
        a.pedCrossClear = true;
        a.pedWait = 0;
      }
    } else {
      a.pedWait = Math.max(0, a.pedWait - dt);
    }
    const dx = target.x - a.x, dz = target.z - a.z, distance = Math.hypot(dx, dz);
    if (distance < 0.75) {
      const arrivedLink = a.pedLink;
      a.pedPrev = a.pedNode;
      a.pedNode = target;
      a.pedTarget = null;
      a.pedLink = null;
      a.pedCrossClear = false;
      a.pedWaitTime = 0;
      if (arrivedLink && arrivedLink.cross)
        a.pedNoCrossUntil = SN.simTime + 7;
      a.pedFail = 0;
      if (!SN.pedChooseTarget(a) || !a.pedTarget)
        return { x: a.x, z: a.z, speed: 0, wait: true };
      target = a.pedTarget;
    }
    let ox = 0, oz = 0;
    if (!(a.pedLink && a.pedLink.cross)) {
      const yaw = Math.atan2(target.x - a.pedNode.x, target.z - a.pedNode.z);
      const bias = a.pedLaneBias + (a.pedNode.lane && a.pedNode.lane.pedestrian ? 0.35 : 0);
      ox = Math.cos(yaw) * bias;
      oz = -Math.sin(yaw) * bias;
    }
    if (a.pedLink && a.pedLink.lane && a.pedNode.lane)
      a.sideYaw = Math.atan2(target.x - a.pedNode.x, target.z - a.pedNode.z);
    return { x: target.x + ox, z: target.z + oz, speed: a.speed, wait: false };
  };

  SN.pedestrianAvoidance = function pedestrianAvoidance(a) {
    let ax = 0, az = 0;
    const bx = Math.floor(a.x / 2), bz = Math.floor(a.z / 2);
    for (let iz = -1; iz <= 1; iz++)
      for (let ix = -1; ix <= 1; ix++) {
        const cell = SN.crowdCells.get((bz + iz + 2048) * 8192 + bx + ix + 2048);
        if (!cell)
          continue;
        for (const other of cell) {
          if (other === a || other.sitting)
            continue;
          const dx = a.x - other.x, dz = a.z - other.z, d2 = dx * dx + dz * dz;
          if (d2 > 1.1 || d2 < 0.0001)
            continue;
          const d = Math.sqrt(d2), weight = (1.1 - d) / 1.1;
          ax += dx / d * weight;
          az += dz / d * weight;
        }
      }
    const pdx = a.x - SN.player.x, pdz = a.z - SN.player.z, pd = Math.hypot(pdx, pdz);
    if (pd < 1.15 && pd > 0.001) {
      ax += pdx / pd * (1.15 - pd) * 1.2;
      az += pdz / pd * (1.15 - pd) * 1.2;
    }
    const length = Math.hypot(ax, az);
    if (length > 0.75) { ax = ax / length * 0.75; az = az / length * 0.75; }
    return { x: ax, z: az };
  };

  SN.pedestrianStuck = function pedestrianStuck(a, dt, turned) {
    if (a.pedWait > 0 || (a.pedLink && a.pedLink.cross && !a.pedCrossClear))
      return;
    a.pedStuckClock += dt;
    a.pedTurnClock += dt;
    a.pedTurnAccum += turned;
    if (a.pedStuckClock >= 3) {
      const moved = Math.hypot(a.x - a.pedWindowX, a.z - a.pedWindowZ);
      a.pedStuckClock = 0;
      a.pedWindowX = a.x;
      a.pedWindowZ = a.z;
      if (moved < 0.3)
        SN.pedestrianRepath(a);
    }
    if (a.pedTurnClock >= 4) {
      a.pedTurnClock = 0;
      if (a.pedTurnAccum > 9.42)
        SN.pedestrianRepath(a);
      a.pedTurnAccum = 0;
    }
  };

  SN.pedestrianRepath = function pedestrianRepath(a) {
    a.pedFail = (a.pedFail || 0) + 1;
    a.pedTarget = null;
    a.pedLink = null;
    a.pedPrev = null;
    a.pedWait = 0;
    a.pedCrossClear = false;
    a.pedNoCrossUntil = 0;
    a.pedCornerStreak = 0;
    a.pedNode = SN.pedNodeNearest(a.x, a.z, 10) || a.pedNode;
    a.pedWindowX = a.x;
    a.pedWindowZ = a.z;
    if (a.pedFail < 2)
      return;
    a.pedFail = 0;
    if (SN.crowdOffscreen(a.x, a.z) || Math.hypot(a.x - SN.player.x, a.z - SN.player.z) > 70) {
      a.active = false;
      a.pedDespawn = false;
      if (a.partner) {
        a.partner.partner = null;
        a.partner = null;
      }
    } else
      a.pedDespawn = true;
  };

  SN.pedestrianArrived = function pedestrianArrived(a) {
    if (!a.pedLink || !a.pedLink.cross)
      return;
    a.pedNoCrossUntil = SN.simTime + 9;
    a.pedCrossClear = false;
    a.pedWaitTime = 0;
  };

  SN.assignPedMode = function assignPedMode(a, force = false) {
    if (a.sitting && !force) {
      a.mode = "sit";
      a.modeTimer = SN.rand(18, 45);
      return;
    }
    // Finish an in-progress road crossing before considering a stay-put activity:
    // stopping in the middle of the carriageway strands the actor between traffic.
    if (a.kind === "civilian" && a.pedLink && a.pedLink.cross) {
      a.mode = "walk";
      a.modeTimer = SN.rand(3, 6);
      return;
    }
    // Benches, bus stops and phones are only sensible on the pavement.
    if (!a.interior && a.kind === "civilian" && SN.pedOnCarriageway(a.x, a.z) && !SN.pedOnCrosswalk(a.x, a.z, 2.6)) {
      a.sitting = false;
      a.phone = false;
      a.chat = false;
      a.mode = "walk";
      a.modeTimer = SN.rand(4, 8);
      a.pedTarget = null;
      a.pedLink = null;
      a.pedPrev = null;
      a.pedWait = 0;
      a.pedCrossClear = false;
      a.pedCornerStreak = 0;
      a.pedNode = SN.pedNodeNearest(a.x, a.z, 12);
      return;
    }
    a.sitting = false;
    a.phone = false;
    a.chat = false;
    a.pedTarget = null;
    a.pedLink = null;
    a.pedPrev = null;
    a.pedWait = 0;
    a.pedCrossClear = false;
    a.pedCornerStreak = 0;
    a.modeTimer = SN.rand(7, 17);
    if (!a.interior && SN.busStops && a.index % 4 === 0) {
      const stop = SN.busStops.find(b => Math.hypot(b.x - a.x, b.z - a.z) < 14);
      if (stop) {
        const x = stop.x + Math.sin(stop.yaw) * 1.8 + Math.cos(stop.yaw) * (a.index % 3 - 1) * 1.1;
        const z = stop.z + Math.cos(stop.yaw) * 1.8 - Math.sin(stop.yaw) * (a.index % 3 - 1) * 1.1;
        if (!SN.blocked(x, z, 0.3) && !SN.isWater(x, z) && !SN.actors.some(b => b !== a && b.active && Math.hypot(b.x - x, b.z - z) < 0.8)) { a.queueStop = stop; a.queueX = x; a.queueZ = z; a.mode = "queue"; a.modeTimer = 24; return; }
      }
    }
    if (!a.interior && a.archetype === "office" && a.index % 3 === 0) { a.mode = "smoke"; a.modeTimer = 12; return; }
    if (a.archetype === "vendor") {
      a.mode = "idle";
      a.chat = true;
      a.modeTimer = SN.rand(16, 35);
      return;
    }
    if (a.archetype === "jogger" || a.archetype === "delivery" || a.archetype === "couple") {
      a.mode = "walk";
      a.modeTimer = SN.rand(14, 28);
      return;
    }
    if (a.archetype === "tourist" && SN.rnd() < 0.45) {
      a.mode = "photo";
      a.modeTimer = SN.rand(4, 8);
      return;
    }
    if (a.interior) {
      a.mode = "idle";
      return;
    }
    const roll = SN.rnd();
    if (roll < 0.16) {
      let best = null, bestDistance = 34;
      for (const b of SN.benchSpots) {
        if (!SN.benchFree(b, a))
          continue;
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        if (d < bestDistance) {
          bestDistance = d;
          best = b;
        }
      }
      if (best) {
        a.sitting = true;
        a.mode = "sit";
        a.sitX = best.x;
        a.sitZ = best.z;
        a.sitYaw = best.yaw - SN.PI / 2;
        a.yaw = a.sitYaw;
        a.x = best.x;
        a.z = best.z;
        a.modeTimer = SN.rand(22, 50);
        return;
      }
    }
    if (roll < 0.3) {
      a.mode = "phone";
      a.phone = true;
      a.modeTimer = SN.rand(5, 11);
      return;
    }
    if (roll < 0.44) {
      let partner = null, best = 13;
      for (const other of SN.actors) {
        if (other === a || !other.active || other.down || other.inCar || other.kind !== "civilian" || other.interior)
          continue;
        const d = Math.hypot(other.x - a.x, other.z - a.z);
        if (d < best) {
          best = d;
          partner = other;
        }
      }
      if (partner) {
        a.mode = "chat";
        a.chat = true;
        a.chatYaw = Math.atan2(partner.x - a.x, partner.z - a.z);
        a.yaw = a.chatYaw;
        a.modeTimer = SN.rand(6, 12);
      }
      else {
        a.mode = "idle";
        a.modeTimer = SN.rand(4, 8);
      }
      return;
    }
    a.mode = "walk";
    a.modeTimer = SN.rand(8, 18);
    a.pedTarget = null;
    a.pedLink = null;
    a.pedPrev = null;
    a.pedCrossClear = false;
    a.pedWait = 0;
    a.pedWaitTime = 0;
    a.pedFail = 0;
    if (!a.pedNode || Math.hypot(a.pedNode.x - a.x, a.pedNode.z - a.z) > 10)
      a.pedNode = SN.pedNodeNearest(a.x, a.z, 10);
    SN.pedChooseTarget(a);
    if (SN.rnd() < 0.34)
      a.dirSign *= -1;
  };

  SN.initPedModes = function initPedModes() {
    for (const a of SN.actors) {
      if (!a || a.kind !== "civilian" || a.interior || a.missionEnemy || a.inCar)
        continue;
      let best = null, bestDistance = 70;
      for (const p of SN.pavementSpawns) {
        const d = Math.hypot(p.x - a.x, p.z - a.z);
        if (d < bestDistance) {
          bestDistance = d;
          best = p;
        }
      }
      if (best)
        a.sideYaw = best.yaw;
      SN.assignPedMode(a, true);
    }
  };

  SN.bumpActor = function bumpActor(a, force = 1, hard = false) {
    if (!a || !a.active || a.down || a.inCar || a.missionEnemy || a.kind === "police" || a.bumpCool > 0)
      return;
    a.bumpCool = hard ? 1.4 : 0.75;
    if (SN.simTime - (a.lastBumpTime ?? -100) < 7)
      a.bumpCount++;
    else
      a.bumpCount = 1;
    a.lastBumpTime = SN.simTime;
    a.stumble = Math.max(a.stumble || 0, hard ? 1.05 : 0.66);
    a.panic = Math.max(a.panic, hard ? 6 : 2.4);
    a.yaw = Math.atan2(SN.player.x - a.x, SN.player.z - a.z);
    a.sitting = false;
    a.phone = false;
    a.chat = false;
    const angry = a.kind === "gang" || (a.personality === "angry" && (a.bumpCount >= 2 || force > 3.8)) || (a.personality === "brave" && a.bumpCount >= 3);
    if (a.personality === "brave" && !angry && !hard) {
      a.panic = 0;
      a.mode = "idle";
      a.modeTimer = 2.5;
      SN.speakBubble(a, "慢一点，大家都在走路。");
      return;
    }
    if (!angry) {
      SN.speakBubble(a, SN.bumpLinesScared[Math.floor(SN.rnd() * SN.bumpLinesScared.length)], "scared");
      a.mode = "flee";
      a.modeTimer = 0;
      a.panic = Math.max(a.panic, 4);
    }
    else {
      a.hostile = true;
      a.hostileTimer = SN.rand(12, 20);
      a.mode = "fight";
      a.panic = Math.max(a.panic, 3);
      if (a.kind === "civilian") {
        a.armedWeapon = 0;
        a.meleeOnly = true;
      }
      else if (a.kind === "gang") {
        a.armedWeapon = a.bumpCount >= 2 && SN.rnd() < 0.5 ? 1 : 0;
        a.meleeOnly = a.armedWeapon === 0;
      }
      SN.speakBubble(a, SN.bumpLinesAngry[Math.floor(SN.rnd() * SN.bumpLinesAngry.length)], "angry");
      SN.commitCrime(1, "街头斗殴 ★1", "brawl", 32);
    }
    for (const other of SN.actors) {
      if (other === a || !other.active || other.down || other.inCar || other.kind !== "civilian" || other.interior)
        continue;
      if (Math.hypot(other.x - a.x, other.z - a.z) > 6)
        continue;
      other.panic = Math.max(other.panic, SN.rand(2, 5));
      other.sitting = false;
      other.phone = false;
      other.chat = false;
      if (other.tough && SN.rnd() < 0.22 && !other.hostile) {
        other.hostile = true;
        other.hostileTimer = SN.rand(8, 15);
        other.mode = "fight";
        other.armedWeapon = 0;
        other.meleeOnly = true;
      }
      if (SN.rnd() < 0.15)
        SN.speakBubble(other, SN.bumpLinesScared[Math.floor(SN.rnd() * SN.bumpLinesScared.length)], "scared");
    }
  };

  SN.poseSitting = function poseSitting(r, time) {
    r.torso.position.y -= 0.34;
    r.head.rotation.x = 0.05;
    r.head.rotation.y = Math.sin(time * 0.5) * 0.12;
    for (let i = 0; i < 2; i++) {
      const leg = r.legs[i], arm = r.arms[i];
      leg.planted = false;
      leg.upper.position.y = 0.45;
      leg.upper.rotation.set(-1.4, 0, i ? -0.06 : 0.06);
      leg.lower.rotation.x = 1.36;
      leg.foot.rotation.x = -0.15;
      arm.upper.rotation.set(-0.42, 0, i ? -0.17 : 0.17);
      arm.lower.rotation.x = -0.72;
    }
  };

  SN.posePhone = function posePhone(r, time) {
    r.arms[1].upper.rotation.set(-2.08, 0, -1.02);
    r.arms[1].lower.rotation.x = -1.5;
    r.head.rotation.x = -0.08;
    r.head.rotation.z = Math.sin(time * 1.1) * 0.05;
  };

  SN.poseChat = function poseChat(r, time) {
    r.arms[1].upper.rotation.x = -0.75 + Math.sin(time * 2.3) * 0.16;
    r.arms[1].upper.rotation.z = -0.24;
    r.arms[1].lower.rotation.x = -0.85;
    r.head.rotation.y = Math.sin(time * 1.7) * 0.18;
  };

  SN.posePedestrianIdentity = function posePedestrianIdentity(a, time) {
    const r = a.rig;
    if (r.accessories.cameraBody) {
      const y = a.mode === "photo" && !a.hostile && a.panic <= 0 ? 0.6 : 0.19;
      r.accessories.cameraBody.position.y = y;
      r.accessories.cameraLens.position.y = y;
    }
    if (a.hostile || a.panic > 0 || a.down || a.inCar)
      return;
    if (a.archetype === "elder") {
      r.torso.rotation.x += 0.13;
      r.arms[0].upper.rotation.x = -0.12;
      r.arms[0].lower.rotation.x = -0.12;
    }
    if (a.archetype === "office") {
      r.arms[0].upper.rotation.x *= 0.2;
      r.arms[0].lower.rotation.x = -0.08;
    }
    if (a.mode === "smoke") {
      r.arms[1].upper.rotation.x = -0.75; r.arms[1].lower.rotation.x = -1.8 + Math.sin(time * 0.7) * 0.45;
    }
    if (SN.weather && SN.weather.kind === "rain" && !a.interior && !a.sitting) {
      r.arms[0].upper.rotation.x = -0.65; r.arms[0].lower.rotation.x = -1.45;
    }
    if (a.mode === "photo") {
      r.head.rotation.y = 0;
      for (const arm of r.arms) {
        arm.upper.rotation.x = -1.08;
        arm.lower.rotation.x = -1.6;
      }
      r.torso.rotation.y = Math.sin(time * 0.4 + a.index) * 0.2;
    }
    if (a.archetype === "vendor") {
      r.arms[1].upper.rotation.x = -0.6 + Math.sin(time * 1.5) * 0.16;
      r.arms[1].lower.rotation.x = -0.7;
    }
  };

  SN.indexCrowd = function indexCrowd() {
    SN.crowdCells.clear();
    let used = 0;
    for (const a of SN.actors) {
      if (!a.active || a.inCar || a.down || a.interior)
        continue;
      const key = (Math.floor(a.z / 2) + 2048) * 8192 + Math.floor(a.x / 2) + 2048;
      let cell = SN.crowdCells.get(key);
      if (!cell) {
        cell = SN.crowdCellPool[used++]; cell.length = 0;
        SN.crowdCells.set(key, cell);
      }
      cell.push(a);
    }
  };

  SN.separatePedestrian = function separatePedestrian(a) {
    if (a.sitting || a.interior)
      return;
    const bx = Math.floor(a.x / 2), bz = Math.floor(a.z / 2);
    for (let iz = -1; iz <= 1; iz++)
      for (let ix = -1; ix <= 1; ix++) {
        const cell = SN.crowdCells.get((bz + iz + 2048) * 8192 + bx + ix + 2048);
        if (!cell)
          continue;
        for (const other of cell) {
          if (other === a)
            continue;
          const dx = a.x - other.x, dz = a.z - other.z, d = Math.hypot(dx, dz);
          if (d < 0.64 && d > 0.001) {
            const push = Math.min(0.08, (0.64 - d) * 0.5), x = a.x + dx / d * push, z = a.z + dz / d * push;
            if (!SN.blocked(x, z, 0.28)) {
              a.x = x;
              a.z = z;
            }
          }
        }
      }
  };

  SN.updateActors = function updateActors(dt, time) {
    const armed = !SN.holstered && SN.selectedWeapon >= 0 && !SN.player.car;
    for (const c of SN.crews)
      c.anger = Math.max(0, c.anger - dt);
    SN.indexCrowd();
    let arrestPromptShown = false;
    for (const a of SN.actors) {
      if (!a.active)
        continue;
      if (SN.arrestState) {
        if (!a.inCar) {
          a.poseDirty = true;
          SN.advanceGait(a.rig, 0, dt, 0);
          SN.poseRig(a.rig, 0, a.phase, time, false, false, 0, -1);
        }
        continue;
      }
      if (a.bail) {
        SN.updateBailout(a, a.rig, dt);
        continue;
      }
      if (a.cityEventTag === "snatch") continue;
      if (a.missionEnemy) {
        a.poseDirty = true;
        SN.updateEncounterActor(a, dt, time);
        continue;
      }
      if (a.inCar) {
        a.x = a.inCar.x;
        a.z = a.inCar.z;
        continue;
      }
      const distance = Math.hypot(a.x - SN.player.x, a.z - SN.player.z);
      if (distance > 150) {
        if (a.kind === "police" && SN.heat === 0 && !a.footPolice && !a.guard)
          a.active = false;
        continue;
      }
      a.lodElapsed += dt;
      const interval = distance > 95 ? 6 : distance > 55 ? 3 : 1;
      if (!a.hostile && !a.down && a.kind === "civilian" && (SN.stepCount + a.index) % interval !== 0)
        continue;
      const actorDt = Math.min(a.lodElapsed, 0.12);
      a.lodElapsed = 0;
      a.poseDirty = true;
      a.bumpCool = Math.max(0, (a.bumpCool || 0) - actorDt);
      a.attackTimer = Math.max(0, (a.attackTimer || 0) - actorDt);
      a.stumble = Math.max(0, (a.stumble || 0) - actorDt);
      if (a.down > 0) {
        SN.advanceGait(a.rig, 0, actorDt, 0);
        a.down -= actorDt;
        a.fall = Math.max(0, Math.min(1, a.fall + actorDt * 2.7, a.down / 1.4));
        SN.poseRig(a.rig, 0, a.phase, time, false, false, 0, -1, a.fall);
        if (a.down <= 0) {
          a.health = a.stagger ? Math.max(42, a.health) : 100;
          a.stagger = false;
          a.fall = 0;
          a.panic = 4;
          a.hostile = false;
          a.dropGiven = false;
          a.sitting = false;
          a.phone = false;
          a.chat = false;
          a.mode = "walk";
          a.modeTimer = 0;
          a.armedWeapon = a.kind === "police" || a.kind === "gang" ? 1 : -1;
          a.meleeOnly = false;
          if (a.shopId) {
            a.shopState = "idle";
            a.shopTimer = SN.rand(1, 3);
          }
        }
        continue;
      }
      if (a.shopId) {
        SN.updateShopActor(a, actorDt, time);
        continue;
      }
      if (a.kind === "civilian" && armed && SN.aiming && distance < 2.5 && Math.cos(Math.atan2(a.x - SN.player.x, a.z - SN.player.z) - SN.camYaw) > 0.6) {
        SN.cityBark(a, "gun", "scared"); a.panic = Math.max(a.panic, 3);
      }
      a.cool -= actorDt;
      a.panic = Math.max(0, a.panic - actorDt);
      a.flinch = Math.max(0, a.flinch - actorDt);
      a.coverTimer = Math.max(0, a.coverTimer - actorDt);
      if (a.coverTimer <= 0)
        a.coverSet = false;
      a.strafeClock -= actorDt;
      if (a.strafeClock <= 0) {
        a.strafeDir *= -1;
        a.strafeClock = SN.rand(1.1, 2.7);
      }
      let oldX = a.x, oldZ = a.z, oldYaw = a.yaw, speed = 0, gait = 0, tx = a.x, tz = a.z, poseWeapon = -1, aimPose = false;
      if (a.kind === "gang") {
        const c = SN.crews[a.crew];
        if (armed && distance < 24 && Math.hypot(SN.player.x - c.x, SN.player.z - c.z) < c.radius)
          a.linger += actorDt;
        else
          a.linger = Math.max(0, a.linger - actorDt * 2);
        if (a.linger > 4)
          c.anger = 30;
        if (c.anger > 0)
          a.hostile = true;
        if (a.linger > 2 && a.linger < 2 + actorDt)
          SN.toast(c.name + "：收起武器，离开我们的街口。", 3);
      }
      if (a.hostileTimer > 0) {
        a.hostileTimer -= actorDt;
        if (a.hostileTimer <= 0 && a.kind === "civilian" && distance > 12) {
          a.hostile = false;
          a.armedWeapon = -1;
          a.meleeOnly = false;
          a.mode = "walk";
          a.modeTimer = 0;
        }
      }
      let arrestApproach = false;
      if (a.kind === "police") {
        if (a.footPolice && SN.heat > 0 && !SN.arrestState && SN.heat <= 2 && !SN.wantedResisted) {
          arrestApproach = true;
          a.hostile = false;
        }
        else if (a.footPolice)
          a.hostile = SN.heat > 0;
        else
          a.hostile = SN.heat >= 3 || SN.wantedResisted;
      }
      const visible = (a.hostile || a.kind === "police") && distance < 110 && SN.visibleBetween(a.x, SN.groundHeight(a.x, a.z) + 1.5, a.z, SN.player.x, SN.player.y + 1.15, SN.player.z);
      if (a.kind === "police" && visible && a.hostile) {
        SN.lastSeen = time;
        SN.heatDecay = 0;
      }
      if (arrestApproach && !SN.player.dead) {
        gait = 2;
        tx = visible ? SN.player.x : SN.searchX;
        tz = visible ? SN.player.z : SN.searchZ;
        speed = Math.hypot(tx - a.x, tz - a.z) > 2.3 ? SN.GAITS[2].speed * 0.94 : 0;
        a.yaw = SN.approachAngle(a.yaw, Math.atan2(tx - a.x, tz - a.z), actorDt * 7);
        const resisting = !SN.player.car && ((!SN.holstered && SN.selectedWeapon > 0) || SN.firing || SN.aiming || SN.player.speed > 2.8);
        if (SN.player.car) {
          a.arrestTimer = 0;
        }
        else if (resisting && visible) {
          SN.wantedResisted = true;
          a.resisted = true;
          a.hostile = true;
          a.armedWeapon = 1;
          a.meleeOnly = false;
          a.cool = 0.45;
          SN.toast("拒捕 · 警员已拔出武器", 2.4);
        }
        else if (visible && distance < 2.7) {
          a.arrestTimer = (a.arrestTimer || 0) + actorDt;
          const pct = SN.clamp(a.arrestTimer / 1.5, 0, 1);
          SN.$("arrestPrompt").classList.add("visible");
          SN.$("arrestPrompt").style.setProperty("--arrest", (pct * 100).toFixed(0) + "%");
          arrestPromptShown = true;
          if (a.arrestTimer >= 1.5)
            SN.beginArrest(a);
        }
        else
          a.arrestTimer = Math.max(0, (a.arrestTimer || 0) - actorDt);
      }
      else if (arrestApproach) {
        a.arrestTimer = Math.max(0, (a.arrestTimer || 0) - actorDt);
      }
      if (a.hostile && !SN.player.dead && !arrestApproach) {
        const weapon = a.armedWeapon === undefined || a.armedWeapon < 0 ? 0 : a.armedWeapon, melee = a.meleeOnly || weapon < 1;
        poseWeapon = weapon;
        gait = melee ? 2 : 1;
        if (a.coverSet && a.coverTimer > 0 && !melee) {
          tx = a.coverX;
          tz = a.coverZ;
          speed = Math.hypot(tx - a.x, tz - a.z) > 1.4 ? SN.GAITS[2].speed * 0.85 : 0;
        }
        else {
          tx = a.kind === "police" && !visible ? SN.searchX : SN.player.x;
          tz = a.kind === "police" && !visible ? SN.searchZ : SN.player.z;
          speed = melee ? (distance > 1.5 ? SN.GAITS[2].speed : 0) : (visible ? (distance > 21 ? SN.GAITS[1].speed : 0) : SN.GAITS[1].speed);
          if (!melee && visible && distance < 35) {
            const ang = Math.atan2(SN.player.x - a.x, SN.player.z - a.z), strafe = a.strafeDir * 4;
            tx += Math.cos(ang) * strafe;
            tz -= Math.sin(ang) * strafe;
          }
        }
        if (a.flinch > 0)
          speed *= 0.25;
        a.yaw = SN.approachAngle(a.yaw, Math.atan2(tx - a.x, tz - a.z), actorDt * (a.flinch > 0 ? 4 : 8));
        if (melee) {
          if (visible && distance < 2.05 && a.cool <= 0 && a.flinch <= 0) {
            a.cool = 1.08;
            a.attackTimer = 0.42;
            SN.hurtPlayer(a.kind === "police" ? 7 : a.kind === "gang" ? 8 : 6, false, a);
            SN.emitSparks(SN.player.x, SN.player.y + 1, SN.player.z, 2, false);
            SN.soundImpact(7);
          }
        }
        else if (visible && distance < 72 && a.cool <= 0 && a.flinch <= 0) {
          a.cool = a.kind === "police" ? (weapon === 2 ? (a.burst++ % 3 < 2 ? 0.24 : 1.25) : 1.05) : SN.rand(0.9, 1.5);
          const scatter = a.kind === "police" ? 0.35 : 0.55;
          SN.shotOrigin.set(a.x + Math.sin(a.yaw) * 0.32, SN.groundHeight(a.x, a.z) + 1.36, a.z + Math.cos(a.yaw) * 0.32);
          SN.shotEnd.set(SN.player.x + SN.rand(-scatter, scatter), SN.player.y + 1.1, SN.player.z + SN.rand(-scatter, scatter));
          SN.spawnMuzzleFlash(SN.shotOrigin, true);
          SN.spawnTracer(SN.shotOrigin, SN.shotEnd, true);
          SN.soundEnemyShot(a);
          const accuracy = a.kind === "police" ? SN.policeTuning[Math.max(1, SN.heat)].accuracy : 0.53;
          const movingPenalty = SN.player.car ? Math.min(0.2, Math.abs(SN.player.car.speed) * 0.008) : SN.player.speed > 4 ? 0.12 : 0;
          if (SN.rnd() < SN.clamp(accuracy - distance * 0.005 - movingPenalty, 0.07, accuracy)) {
            if (SN.player.car)
              SN.player.car.health = Math.max(0, SN.player.car.health - (a.kind === "police" ? 1.5 : 3) * SN.player.car.spec.damage);
            SN.hurtPlayer(a.kind === "police" ? (weapon === 2 ? 7 : 6) : a.kind === "gang" ? 5 : 4, false, a);
          }
          if (SN.rnd() < 0.045)
            SN.scareCivilians(a.x, a.z, 20);
        }
        aimPose = !melee && visible && speed < 0.1;
      }
      else if (a.kind === "civilian") {
        if (a.sitting && a.panic <= 0 && !(SN.heat > 0 && distance < 30)) {
          a.x = a.sitX;
          a.z = a.sitZ;
          a.yaw = a.sitYaw;
          tx = a.x;
          tz = a.z;
        }
        else if (a.panic > 0 || (SN.heat > 0 && distance < 30)) {
          a.sitting = false;
          a.phone = false;
          a.chat = false;
          a.mode = "flee";
          gait = 2;
          tx = a.x + (a.x - SN.player.x) * 2;
          tz = a.z + (a.z - SN.player.z) * 2;
          if (Math.hypot(tx - a.x, tz - a.z) < 0.5) {
            tx = a.x + Math.sin(a.yaw) * 8;
            tz = a.z + Math.cos(a.yaw) * 8;
          }
          speed = a.archetype === "elder" ? 1.45 : a.personality === "timid" ? SN.GAITS[2].speed : SN.GAITS[1].speed * 1.3;
        }
        else {
          // A shove from a car or the player can leave a stationary pedestrian in
          // the road; send them walking back to the pavement instead of idling there.
          if (!a.interior && a.mode !== "walk" && SN.pedOnCarriageway(a.x, a.z) && !SN.pedOnCrosswalk(a.x, a.z, 2.6)) {
            a.sitting = false;
            a.phone = false;
            a.chat = false;
            a.mode = "walk";
            a.modeTimer = SN.rand(4, 8);
            a.pedTarget = null;
            a.pedLink = null;
            a.pedPrev = null;
            a.pedWait = 0;
            a.pedCrossClear = false;
            a.pedCornerStreak = 0;
            a.pedNode = SN.pedNodeNearest(a.x, a.z, 12);
          }
          a.modeTimer -= actorDt;
          if (a.modeTimer <= 0 || !["walk", "idle", "phone", "chat", "sit", "photo", "queue", "smoke"].includes(a.mode))
            SN.assignPedMode(a);
          if (a.sitting) {
            a.x = a.sitX;
            a.z = a.sitZ;
            a.yaw = a.sitYaw;
            tx = a.x;
            tz = a.z;
            oldX = a.x;
            oldZ = a.z;
          }
          else if (a.mode === "queue") {
            tx = a.queueX; tz = a.queueZ; speed = Math.hypot(tx - a.x, tz - a.z) > 0.25 ? a.speed : 0;
            if (!speed && a.queueStop) a.yaw = a.queueStop.yaw;
          }
          else if (a.mode === "walk") {
            const goal = SN.pedestrianWalkTarget(a, actorDt);
            gait = a.archetype === "jogger" ? 1 : 0;
            if (goal) {
              tx = goal.x;
              tz = goal.z;
              if (goal.wait)
                speed = 0;
              else {
                const remaining = Math.hypot(tx - a.x, tz - a.z);
                speed = Math.min(a.speed, 0.5 + remaining * 0.85);
                if (a.pedLink && a.pedLink.cross)
                  speed = Math.min(1.75, Math.max(speed, 1.2));
              }
            }
            else
              speed = 0;
            if (a.partner && a.partner.active && !a.partner.down && !a.partner.hostile && a.partner.panic <= 0) {
              const mate = a.partner;
              if (a.index > mate.index && !(mate.pedLink && mate.pedLink.cross) && Math.hypot(mate.x - a.x, mate.z - a.z) < 3.5) {
                tx = mate.x + Math.cos(mate.sideYaw) * 0.85;
                tz = mate.z - Math.sin(mate.sideYaw) * 0.85;
                speed = Math.hypot(tx - a.x, tz - a.z) > 0.45 ? mate.speed * 1.15 : 0;
              }
              else if (Math.hypot(a.x - mate.x, a.z - mate.z) > 3.5)
                speed *= 0.6;
            }
          }
          else {
            tx = a.x;
            tz = a.z;
            speed = 0;
            gait = 0;
            if (a.chat && a.chatYaw !== undefined)
              a.yaw = SN.approachAngle(a.yaw, a.chatYaw, actorDt * 2);
          }
        }
      }
      else if (a.kind === "gang") {
        tx = a.homeX + Math.sin(time * 0.25 + a.index) * 2;
        tz = a.homeZ + Math.cos(time * 0.2 + a.index) * 2;
        speed = Math.hypot(tx - a.x, tz - a.z) > 0.8 ? SN.GAITS[0].speed : 0;
      }
      const dx = tx - a.x, dz = tz - a.z, len = Math.hypot(dx, dz);
      if (speed && len > 0.2) {
        const desired = Math.atan2(dx, dz);
        if (a.kind === "civilian" && a.mode === "walk" && !a.sitting) {
          const delta = SN.angleDelta(a.yaw, desired), cap = 3.4 * actorDt;
          a.yaw += SN.clamp(delta, -cap, cap);
        }
        else
          a.yaw = SN.approachAngle(a.yaw, desired, actorDt * 6);
        const step = Math.min(len, speed * actorDt), substeps = Math.max(1, Math.ceil(step / 0.4));
        for (let k = 0; k < substeps; k++) {
          const nx = a.x + dx / len * step / substeps, nz = a.z + dz / len * step / substeps;
          if (SN.isWater(nx, nz, 0.25))
            break;
          if (a.kind === "civilian" && a.mode === "walk" && SN.pedOnCarriageway(nx, nz) && !SN.pedOnCrosswalk(nx, nz, 2.8)) {
            // Refuse to step into the road. An actor already pushed into it may
            // only move outward, toward the kerb, never along the traffic lanes.
            const from = SN.pedOnCarriageway(a.x, a.z) ? SN.roadSample(a.x, a.z, 0.5) : null;
            const to = from ? SN.roadSample(nx, nz, 0.5) : null;
            if (!from || !to || Math.abs(to.across) < Math.abs(from.across) - 0.01) {
              a.pedTarget = null;
              a.pedLink = null;
              a.pedCornerStreak = 0;
              break;
            }
          }
          const r = SN.resolveCircle(nx, nz, 0.28);
          a.x = r.x;
          a.z = r.z;
          if (r.hit)
            break;
        }
      }
      if (a.kind === "civilian" && !a.sitting && !a.down && a.active) {
        const avoid = SN.pedestrianAvoidance(a);
        if (avoid.x || avoid.z) {
          const nx = a.x + avoid.x * actorDt * 2.1, nz = a.z + avoid.z * actorDt * 2.1;
          if (!SN.isWater(nx, nz, 0.2)) {
            const r = SN.resolveCircle(nx, nz, 0.28);
            a.x = r.x;
            a.z = r.z;
          }
        }
      }
      for (const c of SN.cars) {
        if (!c.active)
          continue;
        if (SN.carCirclePush(a.x, a.z, 0.3, c)) {
          a.x += SN.circlePush.nx * (SN.circlePush.depth + 0.01);
          a.z += SN.circlePush.nz * (SN.circlePush.depth + 0.01);
        }
      }
      SN.separatePedestrian(a);
      if (a.kind === "civilian" && !a.sitting && a.active && a.mode === "walk")
        SN.pedestrianStuck(a, actorDt, Math.abs(SN.angleDelta(oldYaw, a.yaw)));
      a.rig.root.position.set(a.x, SN.groundUnder(a.x, a.z, 0.2, a.rig.root.position.y), a.z);
      a.rig.root.rotation.y = a.yaw;
      const moved = Math.hypot(a.x - oldX, a.z - oldZ);
      SN.advanceGait(a.rig, moved, actorDt, gait);
      a.phase = a.rig.motion.phase;
      SN.poseRig(a.rig, actorDt > 0 ? moved / actorDt : 0, a.phase, time, false, aimPose, a.attackTimer > 0 ? 0.72 : 0, poseWeapon);
      SN.posePedestrianIdentity(a, time);
      if (a.sitting)
        SN.poseSitting(a.rig, time);
      else if (a.phone && !a.hostile)
        SN.posePhone(a.rig, time);
      else if (a.chat && !a.hostile)
        SN.poseChat(a.rig, time);
      if (a.coverSet && a.coverTimer > 0 && Math.hypot(a.x - a.coverX, a.z - a.coverZ) < 2.2) {
        a.rig.torso.position.y -= 0.36;
        a.rig.head.position.y -= 0.05;
      }
      if (a.stumble > 0) {
        const f = SN.clamp(a.stumble / 0.8, 0, 1);
        a.rig.torso.rotation.x -= f * 0.34;
        a.rig.torso.rotation.z += Math.sin(SN.simTime * 31 + a.index) * f * 0.18;
        a.rig.arms[0].upper.rotation.z += f * 0.5;
        a.rig.arms[1].upper.rotation.z -= f * 0.5;
      }
      if (a.flinch > 0) {
        const f = a.flinch / 0.42;
        a.rig.torso.rotation.x -= f * 0.85;
        a.rig.torso.rotation.z += Math.sin(SN.simTime * 37 + a.index) * f * 0.22;
        a.rig.head.rotation.x -= f * 0.4;
      }
    }
    if (!arrestPromptShown && !SN.arrestState)
      SN.$("arrestPrompt").classList.remove("visible");
  };

  SN.pedestrianWeights = function pedestrianWeights(district, hour, river) {
    const evening = hour >= 17 || hour < 2, day = hour >= 7 && hour < 19;
    const weights = {
      office: day ? 3 : 1,
      student: day ? 2 : 0.6,
      tourist: 2,
      elder: day ? 1.7 : 0.65,
      jogger: 1,
      delivery: 2,
      vendor: 1.4,
      couple: 1.4,
      worker: day ? 1.4 : 0.4,
      nightlife: evening ? 2 : 0.5
    };
    if (district === "myeong") {
      weights.tourist = 4;
      weights.delivery = 4;
      weights.vendor = 3;
      weights.nightlife = evening ? 6 : 1;
      weights.couple = evening ? 3 : 1.5;
    }
    if (district === "gangnam" || district === "samseong") {
      weights.office = day ? 6 : 2;
      weights.nightlife = evening ? 7 : 1;
      weights.couple = evening ? 3 : 1;
    }
    if (district === "hongdae") {
      weights.student = 5;
      weights.nightlife = evening ? 5 : 1;
    }
    if (district === "seongsu" || district === "gimpo") {
      weights.worker = 5;
      weights.delivery = 4;
    }
    if (district === "bukchon") {
      weights.elder = 4;
      weights.tourist = 5;
    }
    if (river) {
      weights.jogger = 12;
      weights.elder = 3;
      weights.couple = 4;
      weights.nightlife = 0.3;
      weights.office = 0.5;
      weights.worker = 0.2;
    }
    return weights;
  };

  SN.crowdOffscreen = function crowdOffscreen(x, z) {
    const dx = x - SN.camera.position.x, dz = z - SN.camera.position.z, d = Math.hypot(dx, dz) || 1;
    return (dx * SN.populationView.x + dz * SN.populationView.z) / d < 0.15;
  };

  SN.updateCityPopulation = function updateCityPopulation() {
    if (SN.simTime < SN.populationClock)
      return;
    SN.populationClock = SN.simTime + 0.5;
    SN.camera.getWorldDirection(SN.populationView);
    const district = SN.cityDistrictAt(SN.player.x, SN.player.z).id,
      hour = SN.minutes / 60,
      evening = hour >= 17 || hour < 2,
      river = Math.min(Math.abs(SN.player.z - SN.riverNorth(SN.player.x)), Math.abs(SN.player.z - SN.riverSouth(SN.player.x))) < 65 || district === "yeouido";
    const daytime = SN.daylightAt(SN.minutes),
      commute = Math.exp(-(((hour - 8.5) / 1.6) ** 2)) + Math.exp(-(((hour - 18) / 1.8) ** 2)),
      late = SN.smoothRange(16, 19, hour) * (1 - SN.smoothRange(22, 24, hour));
    SN.crowdTarget = Math.round(16 + daytime * (river ? 44 : 42) + commute * 12 + (["myeong", "gangnam", "hongdae"].includes(district) ? late * 42 : late * 9));
    if (SN.qualityLevel() === 0)
      SN.crowdTarget = Math.min(38, Math.max(12, SN.crowdTarget - 12));
    else SN.crowdTarget = Math.min(SN.qualityLevel() === 1 ? 64 : 88, SN.crowdTarget);
    const nearby = [], bx = Math.floor(SN.player.x / 100), bz = Math.floor(SN.player.z / 100);
    for (let iz = -2; iz <= 2; iz++)
      for (let ix = -2; ix <= 2; ix++)
        for (const p of SN.pavementCells.get((bx + ix) + "," + (bz + iz)) || []) {
          const d = Math.hypot(p.x - SN.player.x, p.z - SN.player.z);
          if (d > 12 && d < 115)
            nearby.push(p);
        }
    const counts = {}, available = [];
    let nearbyCount = 0;
    for (let i = 0; i < SN.pedCount; i++) {
      const a = SN.actors[i], distance = Math.hypot(a.x - SN.player.x, a.z - SN.player.z);
      if (a.cityEventTag || a.inCar || a.down || a.bail || a.hostile || a.panic > 0) {
        if (a.active && distance < 150)
          nearbyCount++;
        continue;
      }
      const retire = a.active && (distance > 150 || (a.pedDespawn && distance > 45 && SN.crowdOffscreen(a.x, a.z)) || ((nearbyCount >= SN.crowdTarget || SN.simTime > (a.residentUntil || 0)) && SN.crowdOffscreen(a.x, a.z) && distance > 50));
      if (retire) {
        a.active = false;
        if (a.partner) {
          a.partner.partner = null;
          a.partner = null;
        }
      }
      if (a.active) {
        nearbyCount++;
        counts[a.archetype] = (counts[a.archetype] || 0) + 1;
      }
      else
        available.push(a);
    }
    const weights = SN.pedestrianWeights(district, hour, river), budget = SN.crowdBootstrapped ? 14 : SN.crowdTarget;
    let spawned = 0;
    for (let attempt = 0; attempt < budget * 12 && nearbyCount < SN.crowdTarget && nearby.length && available.length; attempt++) {
      const p = nearby[Math.floor(SN.rnd() * nearby.length)],
        offset = SN.rand(-2.4, 2.4),
        x = p.x + Math.sin(p.yaw) * offset,
        z = p.z + Math.cos(p.yaw) * offset;
      // New pedestrians arrive behind the camera; the initial seed occurs before the first frame.
      if (SN.crowdBootstrapped && !SN.crowdOffscreen(x, z))
        continue;
      if (SN.blocked(x, z, 0.35) || SN.isWater(x, z, 0.35) || SN.pedOnCarriageway(x, z) || SN.actors.some(a => a.active && !a.inCar && Math.hypot(a.x - x, a.z - z) < 1.25) || SN.cars.some(c => c.active && SN.carCirclePush(x, z, 0.45, c)))
        continue;
      let best = null, bestScore = -1;
      for (const candidate of available) {
        const score = (weights[candidate.archetype] || 1) / (1 + (counts[candidate.archetype] || 0)) * (0.6 + SN.rnd() * 0.8);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
      if (!best)
        break;
      const a = best;
      available.splice(available.indexOf(a), 1);
      Object.assign(a, {
        x,
        z,
        homeX: x,
        homeZ: z,
        yaw: p.yaw,
        sideYaw: p.yaw,
        health: 100,
        active: true,
        down: 0,
        fall: 0,
        hostile: false,
        panic: 0,
        flinch: 0,
        sitting: false,
        phone: false,
        chat: false,
        mode: "walk",
        modeTimer: SN.rand(3, 12),
        crossWait: 0,
        bumpCool: 0,
        carHitCool: 0,
        bumpCount: 0,
        lastBumpTime: -100,
        hostileTimer: 0,
        dropGiven: false,
        armedWeapon: -1,
        meleeOnly: false,
        residentUntil: SN.simTime + SN.rand(40, 85),
        lodElapsed: 0,
        poseDirty: true,
        walkRange: a.archetype === "jogger" ? 28 : SN.rand(8, 19),
        pedNode: p.node || SN.pedNodeNearest(x, z, 9),
        pedPrev: null,
        pedTarget: null,
        pedLink: null,
        pedWait: 0,
        pedWaitTime: 0,
        pedCrossClear: false,
        pedNoCrossUntil: 0,
        pedStuckClock: 0,
        pedTurnClock: 0,
        pedTurnAccum: 0,
        pedWindowX: x,
        pedWindowZ: z,
        pedFail: 0,
        pedDespawn: false,
        pedCornerStreak: 0
      });
      a.rig.root.rotation.z = 0;
      for (const leg of a.rig.legs)
        leg.planted = false;
      if (a.archetype === "couple") {
        const mate = SN.actors.find(other => other !== a && other.active && other.archetype === "couple" && !other.partner && !other.down && Math.hypot(other.x - x, other.z - z) < 35);
        if (mate) {
          const cx = mate.x + Math.cos(mate.sideYaw) * 0.95, cz = mate.z - Math.sin(mate.sideYaw) * 0.95;
          if (!SN.blocked(cx, cz, 0.3) && !SN.isWater(cx, cz, 0.3) && (!SN.crowdBootstrapped || SN.crowdOffscreen(cx, cz))) {
            a.x = a.homeX = cx;
            a.z = a.homeZ = cz;
            a.pedNode = mate.pedNode || SN.pedNodeNearest(cx, cz, 9);
            a.pedWindowX = cx;
            a.pedWindowZ = cz;
            a.sideYaw = mate.sideYaw;
            a.dirSign = mate.dirSign;
            a.speed = mate.speed;
            a.partner = mate;
            mate.partner = a;
          }
        }
      }
      SN.assignPedMode(a, true);
      counts[a.archetype] = (counts[a.archetype] || 0) + 1;
      nearbyCount++;
      spawned++;
      if (spawned >= budget)
        break;
    }
    SN.crowdVisible = nearbyCount;
    SN.crowdBootstrapped = true;
    const candidates = SN.roadSpawnPoints.filter(p => {
      const d = Math.hypot(p.x - SN.player.x, p.z - SN.player.z);
      return d > 95 && d < 260;
    });
    const trafficBudget = SN.cityTrafficBudget();
    for (let i = 0; i < SN.trafficDriverCount; i++) {
      const c = SN.cars[i];
      if (c === SN.player.car) continue;
      if (c.exploded && SN.simTime - c.explodedAt > 20 && SN.crowdOffscreen(c.x, c.z)) {
        c.active = false; c.root.visible = false;
        const driver = SN.actors[SN.baseActorCount + i];
        if (driver && !driver.inCar && (driver.down || SN.crowdOffscreen(driver.x, driver.z))) {
          Object.assign(driver, { inCar: c, active: true, health: 100, down: 0, fall: 0, bail: null, hostile: false });
          c.occupant = driver;
        }
      }
      if (!c.occupant) continue;
      const far = Math.hypot(c.x - SN.player.x, c.z - SN.player.z) > 85 && SN.crowdOffscreen(c.x, c.z);
      if (i >= trafficBudget && far) { c.active = false; c.root.visible = false; }
    }
    let carsSpawned = 0;
    for (let i = 0; i < trafficBudget && carsSpawned < 4; i++) {
      const c = SN.cars[i];
      if (c === SN.player.car || c.role !== "traffic" || !c.occupant || c.active && Math.hypot(c.x - SN.player.x, c.z - SN.player.z) < 330 || !candidates.length)
        continue;
      const p = candidates[Math.floor(SN.rnd() * candidates.length)];
      if (!SN.crowdOffscreen(p.x, p.z) || SN.cars.some(other => other !== c && other.active && Math.hypot(other.x - p.x, other.z - p.z) < 15))
        continue;
      // Delivery riders retain their helmet and insulated box throughout recycling.
      const type = c.occupant.archetype === "delivery" ? 8 : SN.trafficTypeAt(p.x, p.z, p.mainRoad);
      if (type === 8 && c.occupant.archetype !== "delivery")
        continue;
      if (c.type !== type)
        SN.fitVehicle(c, type);
      if (SN.carBlocked(p.x, p.z, p.yaw, c) || SN.carWater(p.x, p.z, p.yaw, c))
        continue;
      SN.repairVehicle(c); c.stolenOnce = false;
      Object.assign(c, p, {
        px: p.x,
        pz: p.z,
        py: SN.surfaceHeight(p.x, p.z),
        pyaw: p.yaw,
        proll: 0,
        roll: 0,
        health: 100,
        speed: 7,
        vx: Math.sin(p.yaw) * 7,
        vz: Math.cos(p.yaw) * 7,
        active: true,
        parked: false,
        cityTraffic: true,
        driver: true,
        navNode: SN.nearestRoadNode(p.x, p.z),
        previousNode: -1
      });
      const start = SN.roadNodes[c.navNode];
      if (start) {
        const edges = start.links.filter(e => {
          const n = SN.roadNodes[e.index];
          return (n.x - c.x) * Math.sin(c.yaw) + (n.z - c.z) * Math.cos(c.yaw) > 0;
        });
        if (edges.length) { c.previousNode = c.navNode; c.navNode = edges[0].index; c.laneOffset = edges[0].laneOffset; }
      }
      c.root.position.set(c.x, c.py, c.z);
      c.root.rotation.y = c.yaw;
      c.root.visible = true;
      c.occupant.x = c.x;
      c.occupant.z = c.z;
      carsSpawned++;
    }
  };
  // Startup phase 22: keep this order relative to the other systems.

  SN.registerInit(22, function initializePopulation22() {
    SN.crews = [
      { name: "은빛단 · 银光团", color: 0x27b5a3, css: "#27b5a3", x: 450, z: -330, radius: 100, anger: 0 },
      { name: "붉은매 · 赤鹰帮", color: 0xd55649, css: "#d55649", x: -180, z: 1010, radius: 105, anger: 0 }
    ];
    SN.actors = [];
    SN.pedCount = SN.pedestrianSlots.length;
    SN.combatCount = 28;
    SN.baseActorCount = SN.pedCount + SN.combatCount;
    SN.trafficDriverCount = 28;
    SN.encounterStart = SN.baseActorCount + SN.trafficDriverCount;
    SN.missionDriverIndex = SN.encounterStart + 8;
    SN.interiorActorStart = SN.missionDriverIndex + 1;
    SN.shopActorStart = SN.interiorActorStart + SN.interiorPosts.length;
    SN.shopActorCount = SN.shopSpecs.reduce((sum, s) => sum + 1 + s.shopperSpots.length, 0) + SN.smallShopSpecs.length;
    SN.npcCapacity = SN.shopActorStart + SN.shopActorCount;
    SN.clothing = [0xb6a185, 0x688d92, 0xb77564, 0x64789d, 0x91a174, 0xc1b9a7];
    SN.skins = [0xd8ac88, 0xba8564, 0xe4bf9d, 0x966c52];
    for (let i = 0; i < SN.pedCount; i++) {
      const near = i < 20;
      const spot = near ? { x: -360 + i * 15, z: -774 + i % 2 * 5 } : [
        { x: -700, z: -776 },
        { x: 360, z: -616 },
        { x: 760, z: -616 },
        { x: -130, z: -18 },
        { x: 560, z: 1078 },
        { x: -130, z: 1078 },
        { x: 450, z: -406 }
      ][i % 7];
      SN.actorAt(i, spot.x + (i % 3 - 1) * 9, spot.z + (i % 2 ? 4 : -4)).active = false;
    }
    for (let i = 0; i < 10; i++) {
      const crew = i < 5 ? 0 : 1, c = SN.crews[crew];
      SN.actorAt(SN.pedCount + i, c.x + (i % 5) * 1.8, c.z + (i % 2) * 3, "gang", crew);
    }
    for (let i = SN.pedCount + 10; i < SN.baseActorCount; i++) {
      const a = SN.actorAt(i, 0, 0, "police");
      a.active = false;
    }
    for (let i = 0; i < SN.trafficDriverCount; i++) {
      const c = SN.cars[i],
        a = SN.actorAt(SN.baseActorCount + i, c.x, c.z, "civilian", -1, c.spec.bike ? "delivery" : "office");
      a.inCar = c;
      c.occupant = a;
    }
    // Pooled clerks, patrons and desk officers populate the enterable interiors. They
    // are the same instanced actors as the street crowd, just anchored to an indoor
    // home and with a small wander radius that keeps them off the furniture.
    for (let i = 0; i < SN.interiorPosts.length; i++) {
      const post = SN.interiorPosts[i],
        a = SN.actorAt(SN.interiorActorStart + i, post.x, post.z, post.kind, -1, post.kind === "civilian" ? "vendor" : null);
      Object.assign(a, {
        x: post.x,
        z: post.z,
        homeX: post.x,
        homeZ: post.z,
        yaw: post.yaw,
        kind: post.kind,
        crew: -1,
        active: true,
        down: 0,
        fall: 0,
        inCar: null,
        health: 100,
        hostile: false,
        panic: 0,
        flinch: 0,
        interior: true,
        wanderX: post.w,
        wanderZ: post.d,
        cool: SN.rand(0.5, 2),
        linger: 0
      });
      a.rig.root.position.set(a.x, SN.surfaceHeight(a.x, a.z), a.z);
      a.rig.root.rotation.y = a.yaw;
    }
  });
  // Startup phase 24: keep this order relative to the other systems.

  SN.registerInit(24, function initializePopulation24() {
    // Mission encounters reuse the actor pool and its instanced rig renderer.
    for (let i = SN.encounterStart; i < SN.missionDriverIndex; i++) {
      const a = SN.actorAt(i, 0, 0, "gang", i % 2);
      a.active = false;
      a.missionEnemy = true;
      a.missionArmorParts = [];
      for (const spec of [
        { parent: a.rig.torso, x: 0, y: 0.24, z: 0.15, sx: 0.4, sy: 0.32, sz: 0.09 },
        { parent: a.rig.head, x: 0, y: 0.17, z: -0.02, sx: 0.28, sy: 0.15, sz: 0.28 },
        { parent: a.rig.arms[0].upper, x: 0, y: 0.01, z: 0, sx: 0.23, sy: 0.14, sz: 0.24 },
        { parent: a.rig.arms[1].upper, x: 0, y: 0.01, z: 0, sx: 0.23, sy: 0.14, sz: 0.24 }
      ]) {
        const mesh = SN.meshAt(SN.box, SN.actorMaterial(0x454c53, 0.85), spec.x, spec.y, spec.z, spec.sx, spec.sy, spec.sz, 0, spec.parent);
        mesh.visible = false;
        a.missionArmorParts.push(mesh);
        a.rig.parts.push({
          mesh,
          geoName: "box",
          matType: "metal",
          color: 0x454c53,
          colorObject: new SN.T.Color(0x454c53),
          detail: false,
          batchKey: "box|metal"
        });
      }
    }
    SN.missionDriver = SN.actorAt(SN.missionDriverIndex, 0, 0, "civilian", -1, "office");
    SN.missionDriver.active = false;
    // Batch by geometry + material family, sized by the largest per-actor count.
    SN.npcBatchMap = new Map();
    SN.npcBatches = [];
    SN.npcMaxCounts = new Map();
    for (const a of SN.actors) {
      if (!a)
        continue;
      const counts = new Map();
      for (const p of a.rig.parts)
        counts.set(p.batchKey, (counts.get(p.batchKey) || 0) + 1);
      for (const [key, n] of counts) {
        if ((SN.npcMaxCounts.get(key) || 0) < n)
          SN.npcMaxCounts.set(key, n);
      }
    }
    for (const [key, maxPer] of SN.npcMaxCounts) {
      const sep = key.indexOf("|"), geoName = key.slice(0, sep), matType = key.slice(sep + 1);
      const geometry = SN.crowdGeo[geoName].clone();
      geometry.boundingSphere = new SN.T.Sphere(new SN.T.Vector3(), SN.WORLD * 1.5);
      const mesh = new SN.T.InstancedMesh(geometry, SN.rigBatchMaterials[matType], maxPer * SN.npcCapacity);
      mesh.instanceMatrix.setUsage(SN.T.DynamicDrawUsage);
      mesh.castShadow = SN.qualityLevel() >= 2 && matType !== "eye" && matType !== "print" && matType !== "glass" && matType !== "face";
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      SN.scene.add(mesh);
      SN.npcBatches.push({ mesh, count: 0, key, capacity: maxPer * SN.npcCapacity });
      SN.npcBatchMap.set(key, SN.npcBatches[SN.npcBatches.length - 1]);
    }
  });
  // Startup phase 32: keep this order relative to the other systems.

  SN.registerInit(32, function initializePopulation32() {
    SN.wantedSearch = 0;
    SN.searchX = -40;
    SN.searchZ = -770;
    SN.searchRadius = 55;
    SN.wantedCooldown = 0;
    SN.wantedFlash = 0;
    SN.policeTuning = [null,
      { foot: 1, cars: 0, interval: 7, accuracy: 0.32 },
      { foot: 2, cars: 2, interval: 6, accuracy: 0.38 },
      { foot: 3, cars: 3, interval: 5, accuracy: 0.45 },
      { foot: 4, cars: 4, interval: 4.2, accuracy: 0.52 },
      { foot: 4, cars: 5, interval: 3.6, accuracy: 0.58 }
    ];
    SN.lastGunCrime = -100;
    SN.wantedResisted = false;
    SN.concealBoost = 0;
    SN.evasionCar = null;
    SN.roadblockClock = 0;
    SN.spikeClock = 0;
    SN.arrestState = null;
    SN.lastArrestStars = 0;
    SN.lastOffence = Object.create(null);
    SN.pendingReports = [];
    SN.phoneIcons = [];
  });
  // Startup phase 36: keep this order relative to the other systems.

  SN.registerInit(36, function initializePopulation36() {
    // ========================== Wanted / witnesses / arrest ==========================
    // A crime only becomes a star when a police officer sees it or a civilian calls
    // it in. Calls are delayed, show a phone icon over the caller, and are ignored
    // when nobody was in a position to witness them.
    SN.phoneCanvas = document.createElement("canvas");
    SN.phoneCanvas.width = SN.phoneCanvas.height = 64;
    SN.phoneCtx = SN.phoneCanvas.getContext("2d");
    SN.phoneCtx.fillStyle = "rgba(9,26,34,.86)";
    SN.phoneCtx.beginPath();
    SN.phoneCtx.arc(32, 32, 28, 0, SN.TAU);
    SN.phoneCtx.fill();
    SN.phoneCtx.strokeStyle = "#9ff0c8";
    SN.phoneCtx.lineWidth = 3;
    SN.phoneCtx.stroke();
    SN.phoneCtx.fillStyle = "#c9ffe3";
    SN.phoneCtx.save();
    SN.phoneCtx.translate(32, 32);
    SN.phoneCtx.rotate(-0.55);
    SN.phoneCtx.fillRect(-3, -17, 6, 21);
    SN.phoneCtx.fillRect(-3, 9, 6, 8);
    SN.phoneCtx.fillRect(-10, -19, 7, 7);
    SN.phoneCtx.fillRect(3, 12, 7, 7);
    SN.phoneCtx.restore();
    SN.phoneTexture = SN.canvasTexture(SN.phoneCanvas);
    for (let i = 0; i < 10; i++) {
      const sprite = new SN.T.Sprite(new SN.T.SpriteMaterial({ map: SN.phoneTexture, transparent: true, depthWrite: false, depthTest: false }));
      sprite.scale.set(0.9, 0.9, 1);
      sprite.visible = false;
      sprite.renderOrder = 6;
      SN.scene.add(sprite);
      SN.phoneIcons.push({ sprite, active: false });
    }
    SN.wantedResponseActive = false;
  });
  // Startup phase 38: keep this order relative to the other systems.

  SN.registerInit(38, function initializePopulation38() {
    SN.pursuitCars = [];
    for (let i = 0; i < 10; i++) {
      const police = i < 6, c = SN.makeCar(0, 0, 0, true, null, 0, police ? 9 : 10 + (i % 2), police ? "police" : "gang");
      c.active = false;
      c.root.visible = false;
      c.team = police ? -1 : (i - 6) % SN.crews.length;
      c.paint.color.setHex(police ? 0xd3e3e7 : SN.crews[c.team].color);
      SN.pursuitCars.push(c);
    }
    SN.roadblocks = [];
    SN.coneMaterial = SN.mat(0xe2683f, { roughness: 0.62 });
    SN.coneBand = SN.mat(0xf1e7cc, { roughness: 0.5 });
    for (let i = 0; i < 2; i++) {
      const car = SN.makeCar(0, 0, 0, true, null, 0, 0, "police");
      car.active = false;
      car.root.visible = false;
      car.roadblockCar = true;
      car.paint.color.setHex(0xd3e3e7);
      const cones = new SN.T.Group();
      cones.visible = false;
      SN.scene.add(cones);
      for (let n = 0; n < 5; n++) {
        const cone = SN.meshAt(new SN.T.ConeGeometry(0.2, 0.56, 8), SN.coneMaterial, -4.8 + n * 2.3, 0.28, 1.6, 1, 1, 1, 0, cones);
        SN.meshAt(SN.box, SN.coneBand, 0, 0.02, 0, 0.24, 0.08, 0.24, 0, cone);
      }
      SN.roadblocks.push({ active: false, car, cones });
    }
    SN.spikeMat = SN.mat(0x3b4248, { metalness: 0.55, roughness: 0.4 });
    SN.spikeTip = SN.mat(0xb4b9b8, { metalness: 0.8, roughness: 0.25 });
    SN.spikeStrips = [];
    for (let i = 0; i < 3; i++) {
      const group = new SN.T.Group();
      group.visible = false;
      SN.scene.add(group);
      SN.meshAt(SN.box, SN.spikeMat, 0, 0.06, 0, 4.6, 0.1, 0.45, 0, group);
      for (let n = -6; n <= 6; n++) {
        SN.meshAt(new SN.T.ConeGeometry(0.045, 0.16, 5), SN.spikeTip, n * 0.35, 0.17, 0, 1, 1, 1, 0, group);
        SN.meshAt(new SN.T.ConeGeometry(0.045, 0.16, 5), SN.spikeTip, n * 0.35, 0.17, 0.17, 1, 1, 1, 0, group);
      }
      SN.spikeStrips.push({ active: false, group, lastHit: -100 });
    }
    // An original police helicopter: navy fuselage, teal stripe, skids, main and tail
    // rotors, and a real downward searchlight. No insignia or external marks.
    SN.helicopter = {
      active: false,
      angle: 0,
      root: new SN.T.Group(),
      rotor: null,
      tailRotor: null,
      spot: null,
      target: null,
      beam: null
    };
    (function buildHelicopter() {
      const h = SN.helicopter, r = h.root;
      r.visible = false;
      SN.scene.add(r);
      const navy = SN.mat(0x243b4e, { metalness: 0.5, roughness: 0.38 }),
        teal = SN.mat(0x2f8e91, { metalness: 0.4, roughness: 0.42 }),
        glass = SN.mat(0x8fd8e2, { metalness: 0.2, roughness: 0.12, transparent: true, opacity: 0.7 }),
        dark = SN.mat(0x161d22, { metalness: 0.7, roughness: 0.32 });
      const body = new SN.T.Mesh(new SN.T.SphereGeometry(1, 16, 12), navy);
      body.scale.set(1.15, 0.95, 2.3);
      body.castShadow = true;
      r.add(body);
      const belly = new SN.T.Mesh(SN.box, navy);
      belly.scale.set(1.9, 0.5, 2.9);
      belly.position.y = -0.25;
      belly.castShadow = true;
      r.add(belly);
      const nose = new SN.T.Mesh(new SN.T.SphereGeometry(0.82, 14, 10), glass);
      nose.scale.set(0.9, 0.75, 1);
      nose.position.set(0, 0.05, 1.9);
      r.add(nose);
      const tail = new SN.T.Mesh(new SN.T.CylinderGeometry(0.12, 0.28, 3.2, 8), navy);
      tail.rotation.x = SN.PI / 2;
      tail.position.set(0, 0.25, -2.7);
      tail.castShadow = true;
      r.add(tail);
      const fin = new SN.T.Mesh(SN.box, teal);
      fin.scale.set(0.09, 1.1, 0.8);
      fin.position.set(0, 0.9, -4.15);
      fin.rotation.z = 0.18;
      r.add(fin);
      const skidL = new SN.T.Mesh(new SN.T.CylinderGeometry(0.055, 0.055, 2.9, 6), dark);
      skidL.rotation.x = SN.PI / 2;
      skidL.position.set(-0.95, -0.95, 0.1);
      r.add(skidL);
      const skidR = skidL.clone();
      skidR.position.x = 0.95;
      r.add(skidR);
      for (const side of [-1, 1]) {
        const leg = new SN.T.Mesh(new SN.T.CylinderGeometry(0.045, 0.045, 1, 6), dark);
        leg.position.set(side * 0.72, -0.55, 0.2);
        leg.rotation.z = side * 0.45;
        r.add(leg);
      }
      const mast = new SN.T.Mesh(new SN.T.CylinderGeometry(0.09, 0.12, 0.5, 8), dark);
      mast.position.y = 1.05;
      r.add(mast);
      h.rotor = new SN.T.Group();
      h.rotor.position.y = 1.28;
      r.add(h.rotor);
      for (let i = 0; i < 4; i++) {
        const blade = new SN.T.Mesh(SN.box, dark);
        blade.scale.set(0.14, 0.035, 4.6);
        blade.rotation.y = i * SN.PI / 2;
        blade.castShadow = true;
        h.rotor.add(blade);
      }
      h.tailRotor = new SN.T.Group();
      h.tailRotor.position.set(0.18, 0.7, -4.25);
      r.add(h.tailRotor);
      for (let i = 0; i < 3; i++) {
        const blade = new SN.T.Mesh(SN.box, dark);
        blade.scale.set(0.03, 0.9, 0.09);
        blade.rotation.z = i * SN.PI / 3;
        h.tailRotor.add(blade);
      }
      const lamp = new SN.T.Mesh(new SN.T.SphereGeometry(0.16, 8, 6), new SN.T.MeshBasicMaterial({ color: 0xe6f6ff }));
      lamp.position.set(0, -0.65, 1.7);
      r.add(lamp);
      SN.glow(r, 0, -0.7, 1.75, 1.5, 0xd9f4ff);
      h.spot = new SN.T.SpotLight(0xe7f4ff, 0, 95, 0.22, 0.45, 1.4);
      h.spot.position.set(0, -0.7, 1.6);
      h.target = new SN.T.Object3D();
      SN.scene.add(h.target);
      r.add(h.spot);
      h.spot.target = h.target;
      const cone = new SN.T.Mesh(new SN.T.ConeGeometry(9, 30, 16, 1, true), new SN.T.MeshBasicMaterial({
        color: 0xbde8ff,
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
        blending: SN.T.AdditiveBlending,
        side: SN.T.DoubleSide
      }));
      cone.position.set(0, -16, 1.6);
      r.add(cone);
      h.beam = cone;
    })();
  });
  // Startup phase 41: keep this order relative to the other systems.

  SN.registerInit(41, function initializePopulation41() {
    // Candidate positions are built once; occupied positions are checked only on spawn.
    SN.roadSpawnPoints = [];
    for (const r of SN.roads.filter(road => !road.pedestrian && road.width >= 7))
      for (let j = 0; j < r.points.length - 1; j++) {
        const a = r.points[j], b = r.points[j + 1], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
        if (length < 0.01)
          continue;
        for (let t = 12; t < length; t += 30) {
          const centerX = a[0] + dx * t / length, centerZ = a[1] + dz * t / length;
          for (const direction of [-1, 1]) {
            const yaw = Math.atan2(dx * direction, dz * direction),
              x = centerX - Math.cos(yaw) * r.laneOffset, z = centerZ + Math.sin(yaw) * r.laneOffset;
            if (!SN.carBlocked(x, z, yaw, SN.pursuitCars[0]) && !SN.carWater(x, z, yaw, SN.pursuitCars[0]))
              SN.roadSpawnPoints.push({ x, z, yaw, centerX, centerZ, mainRoad: r.lanes >= 4 && !r.bridge, laneOffset: r.laneOffset });
          }
        }
      }
    SN.cityBarks = {"bump": ["呀！看着点——我手机差点替你去汉江。", "我这西装是租的，你赔得起干洗费吗？", "推什么推，地铁就在前面。", "你知道我刚退伍吗？……算了，我也怕你。", "对不起对不起——等等，应该你说对不起。", "撞我干嘛，我又不是旋转门。", "再推一下，我就把刚才的试吃吐给你。", "我不是路障，我是排队的人。", "小心点，我手里是给老板的咖啡。", "你赶时间？全首尔都赶时间。", "别碰我，我刚从相亲现场逃出来。", "撞得好，我正想换个方向走。"], "carjack": ["喂！那是我老婆的车——她会先杀你，再杀我。", "钥匙在杯架里！别动我的歌单！", "车可以开走，后备箱的泡菜留下！", "这是我租的，你至少把押金留下。", "你开走吧，反正贷款是我的。", "小心点，刹车要踩两下才灵。", "呀！我还没熄火！", "后座有只猫，麻烦送到兽医那儿。", "GPS 会带你回首尔站，别信它。", "抢车可以，别抢我的停车票。"], "gun": ["是鞭炮！首尔哪来的枪——快跑！", "我什么都没看见，我近视。", "趴下！我瑜伽课刚学的。", "这是电影拍摄吧？摄像机在哪儿？", "别往我这边打，我只是送外卖的！", "我早说这条街该装隔音板。", "警察呢？哦，堵在江南了。", "我听见了，但我决定失忆。", "谁在放烟花？现在才十月。", "我的炸鸡掉了。你赔我炸鸡。"], "rain": ["天气预报说百分之二十，我的鞋说百分之百。", "雨伞又忘在地铁上了。第三次。", "这雨下得像有人在楼上倒洗脚水。", "汉江水位涨了，我的心情也是。", "下雨天，炸鸡店排队比银行还长。", "我新买的鞋，现在是一双船。", "别跑，跑起来水花更大。", "首尔的雨从不迟到，只有我带伞。"]};
    SN.bumpLinesAngry = SN.cityBarks.bump;
    SN.bumpLinesScared = SN.cityBarks.bump;
    SN.crowdCells = new Map();
    SN.crowdCellPool = Array.from({ length: SN.actors.length }, () => []);
  });
  // Startup phase 48: keep this order relative to the other systems.

  SN.registerInit(48, function initializePopulation48() {
    SN.pedGraph = SN.buildPedestrianGraph();
    // Spatial cells avoid scanning every pavement point in the city on each refill.
    SN.pavementCells = new Map();
    for (const p of SN.pavementSpawns) {
      const key = Math.floor(p.x / 100) + "," + Math.floor(p.z / 100);
      if (!SN.pavementCells.has(key))
        SN.pavementCells.set(key, []);
      SN.pavementCells.get(key).push(p);
    }
    SN.populationView = new SN.T.Vector3();
    SN.populationClock = -1;
    SN.crowdBootstrapped = false;
    SN.crowdTarget = 68;
    SN.crowdVisible = 0;
  });

  SN.cityBark = function cityBark(actor, kind, mood = "neutral") {
    if (!actor || !SN.cityBarks || SN.simTime < (actor.citySpeechAt || 0) || Math.hypot(actor.x - SN.player.x, actor.z - SN.player.z) > 2.5) return false;
    const lines = SN.cityBarks[kind]; if (!lines || !lines.length) return false;
    SN.speakBubble(actor, lines[(actor.index + Math.floor(SN.simTime / 8)) % lines.length], mood);
    actor.citySpeechAt = SN.simTime + 8; return true;
  };

  SN.updateLivingCity = function updateLivingCity(dt) {
    SN.lifeClock -= dt;
    if (SN.lifeClock <= 0) {
      SN.lifeClock = 2;
      if (SN.weather.kind === "rain") {
        const a = SN.actors.find(a => a.active && !a.down && !a.interior && !a.inCar && a.kind === "civilian" && Math.hypot(a.x - SN.player.x, a.z - SN.player.z) < 2.5);
        if (a) SN.cityBark(a, "rain");
      }
      const bx = Math.floor(SN.player.x / 100), bz = Math.floor(SN.player.z / 100), points = [];
      for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++)
        for (const spot of SN.pavementCells.get((bx + x) + "," + (bz + z)) || [])
          if (Math.hypot(spot.x - SN.player.x, spot.z - SN.player.z) < 65 && !SN.blocked(spot.x, spot.z, 0.5)) points.push(spot);
      for (const animal of SN.cityAnimals) if ((!animal.active || Math.hypot(animal.x - SN.player.x, animal.z - SN.player.z) > 85) && points.length) {
        const spot = points[(animal.id * 7 + Math.floor(SN.simTime / 15)) % points.length];
        Object.assign(animal, { x: spot.x, z: spot.z, homeX: spot.x, homeZ: spot.z, y: SN.surfaceHeight(spot.x, spot.z), active: true, flee: 0 });
      }
    }
    for (const animal of SN.cityAnimals) {
      if (!animal.active) continue;
      const d = Math.hypot(animal.x - SN.player.x, animal.z - SN.player.z);
      if (d < (SN.player.car ? 8 : 3) || SN.firing && d < 28) { animal.flee = 3; animal.yaw = Math.atan2(animal.x - SN.player.x, animal.z - SN.player.z); }
      animal.flee = Math.max(0, animal.flee - dt);
      if (!animal.flee) animal.yaw = Math.atan2(animal.homeX - animal.x + Math.sin(SN.simTime * 0.2 + animal.id), animal.homeZ - animal.z + Math.cos(SN.simTime * 0.2 + animal.id));
      const speed = animal.flee ? (animal.cat ? 3.2 : 4.5) : animal.cat ? 0.38 : 0.18;
      const x = animal.x + Math.sin(animal.yaw) * speed * dt, z = animal.z + Math.cos(animal.yaw) * speed * dt;
      if (!SN.blocked(x, z, 0.2) && !SN.isWater(x, z)) { animal.x = x; animal.z = z; }
      animal.y = SN.surfaceHeight(animal.x, animal.z) + (!animal.cat && animal.flee ? Math.sin(Math.min(1, animal.flee / 3) * SN.PI) * 3 : 0);
    }
  };

  SN.renderLivingCity = function renderLivingCity() {
    let count = 0;
    if (SN.weather.kind === "rain") for (const a of SN.actors) {
      if (count >= [8, 14, 20][SN.qualityLevel()]) break;
      if (!a.active || a.kind !== "civilian" || a.interior || a.inCar || a.down || a.sitting || Math.hypot(a.x - SN.player.x, a.z - SN.player.z) > 48 || SN.interiorAt(a.x, a.z, SN.surfaceHeight(a.x, a.z))) continue;
      SN.dummy.position.set(a.x, SN.surfaceHeight(a.x, a.z) + 2.05, a.z); SN.dummy.rotation.set(0.05, a.yaw, 0.08); SN.dummy.scale.set(1, 1, 1); SN.dummy.updateMatrix();
      for (const mesh of SN.umbrellaMeshes) mesh.setMatrixAt(count, SN.dummy.matrix);
      count++;
    }
    for (const mesh of SN.umbrellaMeshes) { mesh.count = count; mesh.visible = count > 0; mesh.instanceMatrix.needsUpdate = true; }
    let smokeCount = 0;
    for (const a of SN.actors) {
      if (smokeCount >= 6) break;
      if (!a.active || a.mode !== "smoke" || a.down || a.panic > 0 || a.hostile || Math.hypot(a.x - SN.player.x, a.z - SN.player.z) > 30) continue;
      const drift = (SN.simTime * 0.5 + a.index * 0.31) % 1;
      SN.dummy.position.set(a.x + Math.sin(a.yaw) * 0.23 + drift * 0.12, SN.surfaceHeight(a.x, a.z) + 1.5 + drift * 0.4, a.z + Math.cos(a.yaw) * 0.23);
      SN.dummy.rotation.set(0, a.yaw, 0); SN.dummy.scale.set(0.03 + drift * 0.08, 0.06 + drift * 0.13, 0.03 + drift * 0.08); SN.dummy.updateMatrix();
      SN.cornerSmoke.setMatrixAt(smokeCount++, SN.dummy.matrix);
    }
    SN.cornerSmoke.count = smokeCount; SN.cornerSmoke.visible = smokeCount > 0; SN.cornerSmoke.instanceMatrix.needsUpdate = true;
    let cats = 0, birds = 0;
    for (const a of SN.cityAnimals) {
      if (!a.active || a.id >= [12, 18, 24][SN.qualityLevel()]) continue;
      SN.dummy.position.set(a.x, a.y, a.z); SN.dummy.rotation.set(0, a.yaw, 0); SN.dummy.scale.set(1, 1, 1); SN.dummy.updateMatrix();
      if (a.cat) SN.animalMeshes[0].setMatrixAt(cats++, SN.dummy.matrix);
      else {
        SN.animalMeshes[1].setMatrixAt(birds, SN.dummy.matrix);
        SN.dummy.scale.y = a.flee ? 0.55 + Math.sin(SN.simTime * 23 + a.id) * 0.45 : 0.12;
        SN.dummy.updateMatrix(); SN.animalMeshes[2].setMatrixAt(birds++, SN.dummy.matrix);
      }
    }
    SN.animalMeshes.forEach((mesh, i) => { mesh.count = i ? birds : cats; mesh.visible = mesh.count > 0; mesh.instanceMatrix.needsUpdate = true; });
  };

  SN.registerInit(51.7, function initializeLivingCity() {
    SN.lifeClock = 0;
    const batch = (geometry, material, count) => {
      const mesh = new SN.T.InstancedMesh(geometry, material, count); mesh.instanceMatrix.setUsage(SN.T.DynamicDrawUsage);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.count = 0; SN.scene.add(mesh); return mesh;
    };
    SN.cornerSmoke = batch(new SN.T.SphereGeometry(1, 5, 4), new SN.T.MeshBasicMaterial({ color: 0xd2dce1, transparent: true, opacity: 0.3, depthWrite: false }), 6);
    SN.umbrellaMeshes = [
      batch(new SN.T.ConeGeometry(0.78, 0.32, 8), SN.mat(0x369cd0, { side: SN.T.DoubleSide, roughness: 0.55 }), 20),
      batch(SN.merged([{ g: SN.box, x: 0, y: -0.45, z: 0, sx: 0.025, sy: 0.9, sz: 0.025 }]), SN.mat(0xc1cbd3), 20)
    ];
    [0xf7ba3e, 0x2b91cf, 0xdf547c, 0x67bda2].forEach((color, i) => {
      for (let n = i; n < 20; n += 4) SN.umbrellaMeshes[0].setColorAt(n, SN.srgb(color));
    });
    SN.umbrellaMeshes[0].material.color.setHex(0xffffff); SN.umbrellaMeshes[0].instanceColor.needsUpdate = true;
    const cat = [{ g: SN.box, x: 0, y: 0.27, z: 0, sx: 0.24, sy: 0.25, sz: 0.6 },
      { g: SN.box, x: 0, y: 0.45, z: 0.28, sx: 0.26, sy: 0.25, sz: 0.25 },
      { g: SN.box, x: 0, y: 0.41, z: -0.42, sx: 0.065, sy: 0.48, sz: 0.065, rx: -0.5 }];
    for (const side of [-1, 1]) {
      cat.push({ g: SN.box, x: side * 0.09, y: 0.61, z: 0.28, sx: 0.075, sy: 0.13, sz: 0.1 });
      for (const end of [-1, 1]) cat.push({ g: SN.box, x: side * 0.09, y: 0.12, z: end * 0.21, sx: 0.07, sy: 0.25, sz: 0.08 });
    }
    const bird = [{ g: SN.box, x: 0, y: 0.14, z: 0, sx: 0.14, sy: 0.15, sz: 0.27 }, { g: SN.box, x: 0, y: 0.28, z: 0.12, sx: 0.11, sy: 0.17, sz: 0.12 }, { g: SN.box, x: 0, y: 0.28, z: 0.2, sx: 0.045, sy: 0.04, sz: 0.1 }];
    SN.animalMeshes = [batch(SN.merged(cat), SN.mat(0xcf9b61), 8), batch(SN.merged(bird), SN.mat(0x8d9bb1), 16),
      batch(SN.merged([-1, 1].map(side => ({ g: SN.box, x: side * 0.17, y: 0.2, z: -0.03, sx: 0.29, sy: 0.055, sz: 0.19, rz: side * 0.65 }))), SN.mat(0x53627c), 16)];
    SN.cityAnimals = Array.from({ length: 24 }, (_, id) => ({ id, cat: id % 3 === 0, active: false, x: 0, z: 0, y: 0, yaw: 0, flee: 0 }));
    SN.updateLivingCity(0);
  });

})(window.SN);
