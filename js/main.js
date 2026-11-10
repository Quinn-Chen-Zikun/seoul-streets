/* 镜头、固定步长模拟、画面更新与启动入口。 */
"use strict";
(function (SN) {
  // Clip the camera against nearby solid AABBs; no per-frame raycaster arrays.

  SN.cameraFraction = function cameraFraction(tx, ty, tz, cx, cy, cz) {
    SN.tempV.set(tx, ty, tz);
    SN.skyDirection.set(cx - tx, cy - ty, cz - tz);
    const distance = SN.skyDirection.length();
    if (distance < 0.01)
      return 1;
    SN.skyDirection.multiplyScalar(1 / distance);
    let hit = SN.solidRayDistance(SN.tempV, SN.skyDirection, distance, 0.32);
    const steps = Math.ceil(distance / 0.45);
    for (let i = 1; i <= steps; i++) {
      const d = distance * i / steps;
      if (d >= hit)
        break;
      const x = tx + SN.skyDirection.x * d, y = ty + SN.skyDirection.y * d, z = tz + SN.skyDirection.z * d;
      if (y < Math.max(SN.terrainHeight(x, z), SN.surfaceHeight(x, z)) + 0.28) {
        hit = Math.max(0, d - 0.45);
        break;
      }
    }
    return hit < distance ? SN.clamp((hit - 0.08) / distance, 0, 1) : 1;
  };

  SN.updateCamera = function updateCamera(dt) {
    if (SN.cinematicCamera(dt))
      return;
    if (!SN.started) {
      const t = SN.renderTime * 0.02;
      SN.camera.position.set(150 + Math.sin(t) * 35, 42 + Math.sin(t * 0.7) * 6, 230 + Math.cos(t) * 35);
      SN.lookTarget.set(-60, 14, -280);
      SN.camera.lookAt(SN.lookTarget);
      SN.sky.position.copy(SN.camera.position);
      return;
    }
    const c = SN.player.car, aim = SN.aiming && !SN.holstered && !c && !SN.player.dead;
    SN.shoulderBlend = SN.lerp(SN.shoulderBlend, aim ? 1 : 0, 1 - Math.exp(-dt * 10));
    const px = SN.playerRender.x, py = SN.playerRender.y, pz = SN.playerRender.z;
    const room = SN.interiorAt(px, pz, py);
    const baseDist = c ? SN.clamp(SN.zoom + Math.abs(c.speed) * 0.09, 3, 15) : SN.lerp(SN.zoom, SN.clamp(SN.zoom * 0.55, 1.8, 8), SN.shoulderBlend);
    // Interiors are tight: keep the boom short enough to stay inside the room,
    // then let cameraFraction do the final wall clip.
    const targetDist = room ? Math.min(baseDist, room.id === "garage" ? 4.4 : 2.9) : baseDist;
    // Look input is applied 1:1; only the boom length uses a stiff, well-damped spring.
    SN.camState.yaw = SN.camYaw;
    SN.camState.pitch = SN.camPitch + (c ? c.pitch * 0.32 : 0);
    const h = Math.min(dt, 0.05), wn = 17, k = wn * wn, dmp = 1.9 * wn;
    SN.camState.velDist += (k * (targetDist - SN.camState.dist) - dmp * SN.camState.velDist) * h;
    SN.camState.dist += SN.camState.velDist * h;
    const y = py + (c ? 1.4 : 1.32),
      side = SN.shoulderBlend * 0.65,
      vertical = (c ? 1.9 : 0.8) + Math.sin(SN.camState.pitch) * SN.camState.dist;
    SN.cameraAnchor.set(px, y, pz);
    SN.camWant.set(px - Math.sin(SN.camState.yaw) * SN.camState.dist * Math.cos(SN.camState.pitch) + Math.cos(SN.camState.yaw) * side, y + vertical, pz - Math.cos(SN.camState.yaw) * SN.camState.dist * Math.cos(SN.camState.pitch) - Math.sin(SN.camState.yaw) * side);
    let fraction = SN.cameraFraction(px, y, pz, SN.camWant.x, SN.camWant.y, SN.camWant.z);
    SN.camWant.lerpVectors(SN.cameraAnchor, SN.camWant, fraction);
    SN.camera.position.copy(SN.camWant);
    const floor = Math.max(SN.terrainHeight(SN.camera.position.x, SN.camera.position.z), SN.surfaceHeight(SN.camera.position.x, SN.camera.position.z)) + 0.3;
    SN.camera.position.y = Math.max(SN.camera.position.y, floor);
    if (room) {
      const ceilingY = room.ceil - 0.3;
      if (SN.camera.position.y > ceilingY)
        SN.camera.position.y = ceilingY;
    }
    fraction = SN.cameraFraction(px, y, pz, SN.camera.position.x, SN.camera.position.y, SN.camera.position.z);
    SN.camera.position.lerpVectors(SN.cameraAnchor, SN.camera.position, fraction);
    const turn = c ? -c.steer * SN.clamp(Math.abs(c.speed) / 24, 0, 1) * 0.55 : 0,
      heading = SN.camState.yaw + turn,
      ahead = c ? 4 + Math.abs(c.speed) * 0.32 : 3.5;
    SN.lookTarget.set(px + Math.sin(heading) * ahead, py + (c ? 1.6 - Math.sin(c.pitch) * ahead * 0.35 : 1.8), pz + Math.cos(heading) * ahead);
    SN.tempV.set(px + Math.sin(SN.camState.yaw) * 35, py + 1.4 - Math.sin(SN.camState.pitch) * 35, pz + Math.cos(SN.camState.yaw) * 35);
    SN.lookTarget.lerp(SN.tempV, SN.shoulderBlend);
    const bob = SN.bobEnabled && !c && SN.player.grounded && !SN.player.dead ? (Math.cos(SN.player.phase * 2) * 0.012 + Math.sin(SN.player.phase) * 0.005) * SN.playerRig.motion.weight * (1 + SN.playerRig.motion.gait * 0.2) * (1 - SN.shoulderBlend * 0.85) : 0;
    SN.lookTarget.y += bob;
    SN.camera.lookAt(SN.lookTarget);
    if (SN.recoilPitch || SN.recoilYaw)
      SN.camera.rotateX(SN.recoilPitch), SN.camera.rotateY(SN.recoilYaw);
    if (SN.camShakeTime > 0) {
      const shake = SN.camShake * (SN.camShakeTime / 0.32);
      SN.camera.position.x += Math.sin(SN.renderTime * 71.3) * shake;
      SN.camera.position.y += Math.sin(SN.renderTime * 93.7) * shake * 0.7;
      SN.camera.rotation.z += Math.sin(SN.renderTime * 57.1) * shake * 0.035;
    }
    SN.sky.position.copy(SN.camera.position);
  };

  SN.resize = function resize() {
    SN.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, SN.Q[SN.qualityLevel()].ratio));
    SN.renderer.setSize(innerWidth, innerHeight);
    SN.camera.aspect = innerWidth / innerHeight;
    SN.camera.updateProjectionMatrix();
    SN.configurePost();
  };

  SN.snapPlayer = function snapPlayer() {
    SN.playerPrev.x = SN.player.x;
    SN.playerPrev.z = SN.player.z;
    SN.playerPrev.y = SN.player.y;
    SN.playerPrev.yaw = SN.player.yaw;
  };

  SN.snapCars = function snapCars() {
    for (const c of SN.cars) {
      c.px = c.x;
      c.pz = c.z;
      c.py = Number.isFinite(c.y) ? c.y : SN.surfaceHeight(c.x, c.z);
      c.pyaw = c.yaw;
      c.proll = c.roll;
      c.ppitch = c.pitch || 0;
      c.pterrainRoll = c.terrainRoll || 0;
      c.psuspension = c.suspension || 0;
    }
  };

  SN.fixedStep = function fixedStep(dt) {
    if (SN.started && (SN.journalOpen || SN.storyDialogue || SN.cinematic || SN.cityMapOpen || SN.shopMenuOpen))
      return;
    SN.stepCount++;
    SN.simTime += dt;
    SN.updateCityTransit(SN.simTime);
    if (SN.started) {
      SN.minutes = (SN.minutes + dt * 1440 / (SN.cycleMinutes * 60)) % 1440;
      SN.lookDelay = Math.max(0, SN.lookDelay - dt);
      SN.impactCooldown = Math.max(0, SN.impactCooldown - dt);
      if (SN.arrestState)
        SN.updateArrest(dt);
      else if (!SN.player.dead) {
        if (SN.player.car)
          SN.carMotion(dt);
        else
          SN.playerMotion(dt);
        SN.updateMission(dt);
      }
      else if (SN.player.bail) {
        SN.updateBailout(SN.player, SN.playerRig, dt, true);
      }
      else {
        SN.poseRig(SN.playerRig, 0, 0, SN.simTime, false, false, 0, -1, Math.min(1, (4 - SN.player.dead) * 2));
      }
      if (SN.player.car)
        SN.doorTarget = null;
      else
        SN.updateDoorTarget();
      SN.updateShops(dt);
      SN.updateCityPopulation();
      SN.trafficMotion(dt);
      SN.updateCombat(dt);
      if (SN.toastTime > 0) {
        SN.toastTime -= dt;
        if (SN.toastTime <= 0)
          SN.$("toast").classList.remove("show");
      }
    }
    else
      SN.trafficMotion(dt);
    SN.updateActors(dt, SN.simTime);
  };

  SN.renderFrame = function renderFrame(alpha, dt) {
    SN.playerRender.x = SN.lerp(SN.playerPrev.x, SN.player.x, alpha);
    SN.playerRender.z = SN.lerp(SN.playerPrev.z, SN.player.z, alpha);
    SN.playerRender.y = SN.player.y;
    SN.playerRender.yaw = SN.playerPrev.yaw + SN.angleDelta(SN.playerPrev.yaw, SN.player.yaw) * alpha;
    // Vertical position is not interpolated: the pose was solved against the
    // exact step height, and blending it would push soles through kerbs and stairs.
    if (!SN.player.car && SN.playerRoot.visible && !SN.player.bail) {
      SN.playerRoot.position.set(SN.playerRender.x, SN.player.y, SN.playerRender.z);
      SN.playerRoot.rotation.y = SN.playerRender.yaw;
    }
    for (const c of SN.cars) {
      if (!c.active)
        continue;
      c.root.position.set(SN.lerp(c.px, c.x, alpha), SN.lerp(c.py, c.y, alpha), SN.lerp(c.pz, c.z, alpha));
      c.root.rotation.y = c.pyaw + SN.angleDelta(c.pyaw, c.yaw) * alpha;
      c.body.rotation.set(SN.lerp(c.ppitch, c.pitch, alpha), 0, SN.lerp(c.pterrainRoll, c.terrainRoll, alpha) + SN.lerp(c.proll, c.roll, alpha));
      c.body.position.y = SN.lerp(c.psuspension, c.suspension, alpha);
      SN.placeVehicleWheels(c);
    }
    SN.flushActors();
    if (SN.player.car && SN.player.car.spec.bike) {
      SN.playerRoot.visible = true;
      SN.poseRider(SN.playerRig, SN.player.car, SN.renderTime);
      SN.updateWeaponVisuals();
    }
    SN.updateVehicleWheels();
    SN.updateContactShadows();
    SN.updateWetness(dt);
    SN.updateLighting();
    SN.updateCamera(dt);
    SN.camera.updateMatrixWorld();
    SN.updateGroundDetails();
    SN.updateDetailCulling();
    SN.updateStoryCharacters(SN.renderTime);
    SN.updateCampaignMarkers(SN.renderTime);
    SN.updateWorldUI(dt);
    const reticleGap = 6 + SN.shotSpread * 26 + SN.clamp(SN.player.motionSpeed / 6.5, 0, 1) * 5 + (SN.firing ? 2 : 0);
    SN.$("crosshair").style.setProperty("--spread", reticleGap.toFixed(1) + "px");
  };

  SN.frame = function frame(now) {
    requestAnimationFrame(SN.frame);
    const rawDt = Math.min((now - SN.lastTime) / 1000, 0.25);
    SN.lastTime = now;
    if (SN.paused)
      return;
    SN.renderTime += rawDt;
    SN.waterTime.value = SN.renderTime;
    SN.accumulator += rawDt;
    let steps = 0;
    while (SN.accumulator >= SN.FIXED_DT && steps < 4) {
      SN.snapPlayer();
      SN.snapCars();
      SN.fixedStep(SN.FIXED_DT);
      SN.accumulator -= SN.FIXED_DT;
      steps++;
    }
    if (steps >= 4)
      SN.accumulator = 0;
    SN.renderFrame(SN.accumulator / SN.FIXED_DT, rawDt);
    SN.gem.rotation.y = SN.renderTime * 0.9;
    SN.gem.position.y = 3 + Math.sin(SN.renderTime * 2) * 0.25;
    SN.ring.scale.setScalar(1 + Math.sin(SN.renderTime * 2) * 0.07);
    SN.beamMat.opacity = 0.13 + Math.sin(SN.renderTime * 1.5) * 0.035;
    // Auto quality is deliberately conservative: three consecutive slow seconds are
    // required to drop a tier, and the 中 tier is only abandoned on a real stall (>33 ms).
    SN.qualityAccum += rawDt;
    SN.qualityFrames++;
    if (SN.qualityAccum >= 1) {
      const avg = SN.qualityAccum / SN.qualityFrames * 1000;
      SN.qualityAccum = 0;
      SN.qualityFrames = 0;
      SN.qualityClock += 1;
      if (avg > 19) {
        SN.qualitySlow++;
        SN.qualityFast = 0;
      }
      else if (avg < 13) {
        SN.qualityFast++;
        SN.qualitySlow = 0;
      }
      else {
        SN.qualitySlow = 0;
        SN.qualityFast = 0;
      }
      if (SN.quality.mode === "auto" && SN.qualityClock - SN.qualityLastSwitch >= 1) {
        if (SN.qualitySlow >= 3 && (SN.quality.level > 1 || (SN.quality.level === 1 && avg > 33))) {
          SN.quality.level--;
          SN.applyQuality();
          SN.qualityLastSwitch = SN.qualityClock;
          SN.qualitySlow = 0;
        }
        else if (SN.qualityFast >= 5 && SN.quality.level < 2) {
          SN.quality.level++;
          SN.applyQuality();
          SN.qualityLastSwitch = SN.qualityClock;
          SN.qualityFast = 0;
        }
      }
    }
    SN.uiTick += rawDt;
    if (SN.uiTick > 0.1) {
      SN.uiTick = 0;
      if (SN.started) {
        if (!SN.player.car)
          SN.findNearestCar();
        SN.refreshHUD();
      }
    }
    if (SN.fpsVisible) {
      SN.fpsAccum += rawDt;
      SN.fpsCount++;
      if (SN.fpsAccum >= 0.25) {
        SN.$("fps").textContent = Math.round(SN.fpsCount / SN.fpsAccum) + " FPS · " + (SN.fpsAccum / SN.fpsCount * 1000).toFixed(1) + " ms · 行人 " + SN.crowdVisible + "/" + SN.crowdTarget;
        SN.fpsAccum = 0;
        SN.fpsCount = 0;
      }
    }
    if (SN.gradeUniforms) {
      SN.gradeUniforms.uTime.value = SN.renderTime;
      const drivingSpeed = SN.player.car ? Math.abs(SN.player.car.speed) : 0;
      const targetBlur = SN.postActive && SN.qualityLevel() >= 2 ? SN.clamp((drivingSpeed - 15) / 34, 0, 0.55) : 0;
      SN.gradeUniforms.uBlur.value += (targetBlur - SN.gradeUniforms.uBlur.value) * 0.09;
    }
    if (SN.postSsaoPass)
      SN.postSsaoPass.time = SN.renderTime;
    if (SN.postActive && SN.composer)
      SN.composer.render();
    else
      SN.renderer.render(SN.scene, SN.camera);
  };
  // Startup phase 43: keep this order relative to the other systems.

  SN.registerInit(43, function initializeMain43() {
    SN.camYaw = 0;
    SN.camPitch = 0.12;
    SN.zoom = 5.5;
    SN.lookDelay = 0;
    SN.started = false;
    SN.paused = false;
    SN.simTime = 0;
    SN.minutes = 8 * 60 + 30;
    SN.cycleMinutes = 48;
    SN.night = 0;
    SN.sunAnchorX = null;
    SN.sunAnchorZ = null;
  });
  // Startup phase 51: keep this order relative to the other systems.

  SN.registerInit(51, function initializeMain51() {
    SN.cameraAnchor = new SN.T.Vector3();
    window.addEventListener("resize", SN.resize);
    SN.FIXED_DT = 1 / 60;
    SN.playerPrev = { x: -40, z: -770, y: 0, yaw: SN.PI };
    SN.playerRender = { x: -40, z: -770, y: 0, yaw: SN.PI };
    SN.accumulator = 0;
    SN.renderTime = 0;
    SN.stepCount = 0;
    SN.lastTime = performance.now();
    SN.qualityAccum = 0;
    SN.qualityFrames = 0;
    SN.qualityClock = 0;
    SN.qualityLastSwitch = -10;
    SN.qualitySlow = 0;
    SN.qualityFast = 0;
  });
  // Startup phase 53: keep this order relative to the other systems.

  SN.registerInit(53, function initializeMain53() {
    SN.buildStoryCharacters();
    SN.validateSpawns();
    SN.validateCity();
    SN.loadCampaign();
    SN.buildWardrobe();
    SN.bindCampaignUI();
    SN.updateCityPopulation();
    SN.snapPlayer();
    SN.snapCars();
    SN.updateActors(0, 0);
    SN.updateLighting();
    SN.updateVehicleWheels();
    SN.streamCity(true);
    SN.refreshHUD();
    SN.$("start").disabled = false;
    SN.$("start").innerHTML = "走进首尔 <span>↗</span>";
    requestAnimationFrame(SN.frame);
  });
})(window.SN);
window.SN.initialize();
