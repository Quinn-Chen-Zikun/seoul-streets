/* 镜头、固定步长模拟、画面更新与启动入口。 */
"use strict";
(function (SN) {
  // Solids and decorative roofs share a swept, padded camera test.
  SN.cameraPropDistance = function cameraPropDistance(origin, direction, distance, padding = 0.38) {
    const ex = origin.x + direction.x * distance, ez = origin.z + direction.z * distance;
    let hit = distance;
    const stamp = ++SN.cameraPropStamp;
    for (let iz = Math.floor((Math.min(origin.z, ez) - padding) / 48); iz <= Math.floor((Math.max(origin.z, ez) + padding) / 48); iz++)
      for (let ix = Math.floor((Math.min(origin.x, ex) - padding) / 48); ix <= Math.floor((Math.max(origin.x, ex) + padding) / 48); ix++) {
        const bin = SN.cameraPropBins.get(ix + "," + iz);
        if (!bin) continue;
        for (const b of bin) {
          if (b.stamp === stamp) continue;
          b.stamp = stamp;
          let low = 0, high = hit;
          for (let axis = 0; axis < 3; axis++) {
            const o = axis === 0 ? origin.x : axis === 1 ? origin.y : origin.z;
            const d = axis === 0 ? direction.x : axis === 1 ? direction.y : direction.z;
            const min = (axis === 0 ? b.minX : axis === 1 ? b.minY : b.minZ) - padding;
            const max = (axis === 0 ? b.maxX : axis === 1 ? b.maxY : b.maxZ) + padding;
            if (Math.abs(d) < 0.00001) { if (o < min || o > max) { low = Infinity; break; } }
            else {
              const a = (min - o) / d, c = (max - o) / d;
              low = Math.max(low, Math.min(a, c)); high = Math.min(high, Math.max(a, c));
              if (low > high) break;
            }
          }
          if (low <= high) hit = Math.min(hit, Math.max(0, low));
        }
      }
    return hit;
  };

  SN.cameraFraction = function cameraFraction(tx, ty, tz, cx, cy, cz) {
    SN.tempV.set(tx, ty, tz);
    SN.skyDirection.set(cx - tx, cy - ty, cz - tz);
    const distance = SN.skyDirection.length();
    if (distance < 0.01)
      return 1;
    SN.skyDirection.multiplyScalar(1 / distance);
    let hit = SN.solidRayDistance(SN.tempV, SN.skyDirection, distance, 0.24);
    hit = Math.min(hit, SN.cameraPropDistance(SN.tempV, SN.skyDirection, distance));
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
    if (SN.showcase) { SN.showcaseCamera(); return; }
    if (SN.cinematicCamera(dt))
      return;
    if (!SN.started) {
      SN.menuCamera(SN.renderTime);
      return;
    }
    const c = SN.player.car || SN.player.aircraft;
    const rear = !!(c && (SN.keys.KeyX || SN.touch.rear));
    if (!c && !SN.aiming && !SN.firing && SN.lookDelay <= 0 && SN.player.speed > 0.8 &&
        (SN.keys.KeyW || SN.touch.y > 0.25) && !SN.keys.KeyA && !SN.keys.KeyD && Math.abs(SN.touch.x) < 0.2)
      SN.camYaw = SN.approachAngle(SN.camYaw, SN.player.yaw, dt * 1.8);
    if (SN.lookDelay <= 0 && !SN.aiming && (c ? Math.abs(c.speed) > 2 : SN.player.speed > 1))
      SN.camPitch = SN.lerp(SN.camPitch, 0.12, 1 - Math.exp(-dt * 1.3));
    const targetFov = c ? 58 + SN.clamp(Math.abs(c.speed) / c.spec.topSpeed, 0, 1) * 15 : SN.aiming ? 51 : 58;
    const fov = SN.lerp(SN.camera.fov, targetFov, 1 - Math.exp(-dt * 5));
    if (Math.abs(fov - SN.camera.fov) > 0.01) { SN.camera.fov = fov; SN.camera.updateProjectionMatrix(); }
    const aim = SN.aiming && !SN.holstered && !c && !SN.player.dead;
    SN.shoulderBlend = SN.lerp(SN.shoulderBlend, aim ? 1 : 0, 1 - Math.exp(-dt * 10));
    const px = SN.playerRender.x, py = SN.playerRender.y, pz = SN.playerRender.z;
    const room = SN.interiorAt(px, pz, py);
    const baseDist = c ? SN.clamp(SN.zoom + Math.abs(c.speed) * 0.09, 3, 15) : SN.lerp(SN.zoom, SN.clamp(SN.zoom * 0.55, 1.8, 8), SN.shoulderBlend);
    // Interiors are tight: keep the boom short enough to stay inside the room,
    // then let cameraFraction do the final wall clip.
    const targetDist = room ? Math.min(baseDist, room.id === "garage" ? 4.4 : 2.9) : baseDist;
    // Look input is applied 1:1; only the boom length uses a stiff, well-damped spring.
    SN.camState.yaw = SN.camYaw + (rear ? SN.PI : 0);
    SN.camState.pitch = SN.camPitch + (c ? c.pitch * 0.32 : 0);
    const h = Math.min(dt, 0.05), wn = 17, k = wn * wn, dmp = 1.9 * wn;
    SN.camState.velDist += (k * (targetDist - SN.camState.dist) - dmp * SN.camState.velDist) * h;
    SN.camState.dist += SN.camState.velDist * h;
    const y = py + (c ? 1.4 : 1.32),
      side = c ? 0 : SN.lerp(0.38, 0.65, SN.shoulderBlend),
      vertical = (c ? 1.9 : 0.8) + Math.sin(SN.camState.pitch) * SN.camState.dist;
    SN.cameraAnchor.set(px, y, pz);
    SN.camWant.set(px - Math.sin(SN.camState.yaw) * SN.camState.dist * Math.cos(SN.camState.pitch) + Math.cos(SN.camState.yaw) * side, y + vertical, pz - Math.cos(SN.camState.yaw) * SN.camState.dist * Math.cos(SN.camState.pitch) - Math.sin(SN.camState.yaw) * side);
    let fraction = SN.cameraFraction(px, y, pz, SN.camWant.x, SN.camWant.y, SN.camWant.z);
    SN.camWant.lerpVectors(SN.cameraAnchor, SN.camWant, fraction);
    // Lag only in vehicles; collision retraction is immediate and recovery is damped.
    const teleported = SN.camera.position.distanceTo(SN.camWant) > 35;
    if (c && !teleported && rear === SN.cameraRear)
      SN.camera.position.lerp(SN.camWant, 1 - Math.exp(-dt * 9));
    else SN.camera.position.copy(SN.camWant);
    SN.cameraRear = rear;
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
    SN.cameraLookAhead = SN.lerp(SN.cameraLookAhead, ahead, 1 - Math.exp(-dt * 6));
    SN.lookTarget.set(px + Math.sin(heading) * SN.cameraLookAhead, py + (c ? 1.6 - Math.sin(c.pitch) * SN.cameraLookAhead * 0.35 : 1.8), pz + Math.cos(heading) * SN.cameraLookAhead);
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
    // Shake and chase lag must also pass the wall test, including the near plane.
    fraction = SN.cameraFraction(px, y, pz, SN.camera.position.x, SN.camera.position.y, SN.camera.position.z);
    SN.camera.position.lerpVectors(SN.cameraAnchor, SN.camera.position, fraction);
    SN.sky.position.copy(SN.camera.position);
  };

  SN.menuCamera = function menuCamera(time) {
    const t = time * 0.012;
    SN.camera.position.set(80 + Math.sin(t) * 145, 38 + Math.sin(t * 0.7) * 4, 430 + Math.cos(t) * 110);
    SN.lookTarget.set(-130, 38, -180);
    SN.camera.lookAt(SN.lookTarget); SN.sky.position.copy(SN.camera.position);
  };

  SN.queueResize = function queueResize() {
    if (SN.resizeQueued) return;
    SN.resizeQueued = true;
    requestAnimationFrame(() => {
      SN.resizeQueued = false;
      SN.clearInput();
      if (!SN.contextLost) SN.resize();
    });
  };

  SN.samplePerformance = function samplePerformance(frameMs) {
    const p = SN.perf, info = SN.renderer.info;
    p.calls = info.render.calls; p.triangles = info.render.triangles;
    p.textures = info.memory.textures; p.geometries = info.memory.geometries;
    p.frameMax = Math.max(p.frameMax, frameMs);
    SN.fpsAccum += frameMs / 1000; SN.fpsCount++;
    if (SN.fpsAccum < 1) return;
    const average = SN.fpsAccum / SN.fpsCount * 1000;
    p.activeCars = p.activeNPCs = 0;
    for (const car of SN.cars) if (car.active) p.activeCars++;
    for (const actor of SN.actors) if (actor.active) p.activeNPCs++;
    const offset = p.cursor * 4;
    p.history[offset] = average; p.history[offset + 1] = p.textures;
    p.history[offset + 2] = p.geometries;
    p.history[offset + 3] = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0;
    p.cursor = (p.cursor + 1) % 600; p.samples++;
    if (SN.fpsVisible) SN.$("fps").textContent = Math.round(1000 / average) + " FPS · " + average.toFixed(1) + " ms · CPU " + p.cpuMs.toFixed(1) + " ms" +
      "\n绘制 " + p.calls + "/350 · 三角面 " + Math.round(p.triangles / 1000) + "/600 千" +
      "\n纹理 " + p.textures + " · 几何 " + p.geometries + " · 市民 " + p.activeNPCs + " · 车辆 " + p.activeCars +
      "\n分辨率 " + Math.round(SN.resolutionScale * 100) + "% · 分块 " + p.pendingTiles + " · 创建 " + p.streamMs.toFixed(1) + " ms" +
      "\n最长帧 " + p.frameMax.toFixed(0) + " ms · 样本 " + Math.min(p.samples, 600) + (performance.memory ? " · 堆 " + p.history[offset + 3].toFixed(0) + " MiB" : "");
    SN.fpsAccum = 0; SN.fpsCount = 0;
    // Hysteresis avoids repeated render-target allocation near the frame budget.
    SN.resolutionStable = average < 17.2 ? SN.resolutionStable + 1 : 0;
    if (!SN.showcase && SN.renderTime - SN.resolutionChangedAt > 3) {
      const scale = average > 18.5 ? Math.max(0.65, SN.resolutionScale - 0.08) : SN.resolutionStable >= 8 && SN.resolutionScale < 1 ? Math.min(1, SN.resolutionScale + 0.04) : SN.resolutionScale;
      if (scale !== SN.resolutionScale) { SN.resolutionScale = scale; SN.resolutionChangedAt = SN.renderTime; SN.resize(); }
    }
  };

  SN.resize = function resize() {
    SN.renderer.setPixelRatio(SN.renderPixelRatio());
    SN.renderer.setSize(innerWidth, innerHeight);
    SN.camera.aspect = Math.max(1, innerWidth) / Math.max(1, innerHeight);
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
    if (SN.paused || SN.contextLost || SN.contextRestorePending || !Number.isFinite(dt) || dt <= 0) return;
    if (SN.showcase) { SN.updateShowcase(dt); return; }
    if (SN.started && (SN.journalOpen || SN.storyDialogue || SN.cinematic || SN.cityMapOpen || SN.shopMenuOpen || SN.streetPanelOpen ||
        SN.campaign.active && SN.campaign.active.status === "failed" && !SN.player.dead && !SN.arrestState))
      return;
    if (SN.devMode) SN.updateSmoke();
    SN.stepCount++;
    SN.simTime += dt;
    SN.updateCityTransit(SN.simTime);
    if (SN.started) {
      SN.minutes = (SN.minutes + dt * 1440 / (SN.cycleMinutes * 60)) % 1440;
      SN.lookDelay = Math.max(0, SN.lookDelay - dt);
      SN.impactCooldown = Math.max(0, SN.impactCooldown - dt);
      if (!SN.cableRide && !SN.arrestState) SN.updateCable();
      if (SN.cableRide)
        SN.updateCableRide(dt);
      else if (SN.arrestState)
        SN.updateArrest(dt);
      else if (!SN.player.dead) {
        if (SN.player.aircraft)
          SN.updateAircraft(dt);
        else if (SN.player.car)
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
      if (SN.player.car || SN.player.aircraft)
        SN.doorTarget = null;
      else
        SN.updateDoorTarget();
      if (SN.updateMilitary) SN.updateMilitary(dt);
      SN.updateShops(dt);
      SN.updateCityPopulation();
      SN.trafficMotion(dt);
      SN.updateCombat(dt);
      SN.updateStreetLife(dt);
      SN.updateWeather(dt);
      SN.updateLivingCity(dt);
      SN.updateNightBar(dt, SN.simTime);
      SN.updateRadio(dt);
      SN.updateStreetEvent(dt);
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
    if (SN.renderAircraft) SN.renderAircraft(alpha);
    if (SN.carjack) {
      const j = SN.carjack, k = 1 - j.time / 0.6;
      SN.playerRoot.visible = true;
      SN.playerRoot.position.set(SN.lerp(j.x, j.car.x, k), j.car.y, SN.lerp(j.z, j.car.z, k));
      SN.poseRig(SN.playerRig, 0, 0, SN.renderTime, false, false, 0, -1);
      SN.playerRig.arms[1].upper.rotation.x = -1.4;
      SN.playerRig.torso.rotation.z = -0.18;
    }
    SN.updateCamera(dt);
    if (SN.foliageFocus) SN.foliageFocus.value.set(SN.playerRender.x, SN.playerRender.y + 1.5, SN.playerRender.z);
    SN.camera.updateMatrixWorld();
    SN.tileProjection.multiplyMatrices(SN.camera.projectionMatrix, SN.camera.matrixWorldInverse);
    SN.tileFrustum.setFromProjectionMatrix(SN.tileProjection);
    SN.updateCarLOD();
    if (SN.models) SN.models.update(dt);
    SN.flushActors();
    if (SN.player.car && !SN.carjack) {
      // Only a bike rider stays visible. A closed car already has a cabin, and
      // showing the full rig there let it poke through the roof once the shell
      // dented in a crash.
      SN.playerRoot.visible = !!SN.player.car.spec.bike;
      SN.poseDriver(SN.playerDriver, SN.player.car);
      SN.updateWeaponVisuals();
      SN.playerRig.weapon.visible = false;
    }
    SN.updateVehicleWheels();
    SN.updateContactShadows();
    SN.updateWetness(dt);
    SN.updateLighting();
    SN.renderWeather();
    SN.renderLivingCity();
    SN.renderRiverCyclists();
    SN.updateCityArt();
    SN.updateFeedback(dt);
    SN.horizonBackdrop.position.set(SN.camera.position.x, 0, SN.camera.position.z);
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
    const frameBegin = performance.now(), frameMs = Math.max(0, now - SN.lastTime);
    const rawDt = Math.min(frameMs / 1000, 0.25);
    SN.lastTime = now;
    if (SN.contextRestorePending) SN.recoverRenderer();
    if (SN.contextLost || SN.paused || (!SN.devMode && document.hidden)) { SN.updateAudioMix(); return; }
    SN.renderTime += rawDt;
    SN.waterTime.value = SN.renderTime;
    SN.slowMotion = Math.max(0, SN.slowMotion - rawDt);
    const timeScale = SN.slowMotion > 0 && !SN.showcase ? 0.38 + 0.62 * (1 - Math.min(1, SN.slowMotion / 0.8)) : 1;
    SN.accumulator += rawDt * timeScale;
    let steps = 0;
    while (SN.accumulator >= SN.FIXED_DT && steps < 4) {
      SN.snapPlayer();
      SN.snapCars();
      SN.fixedStep(SN.FIXED_DT);
      SN.accumulator = Math.max(0, SN.accumulator - SN.FIXED_DT);
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
    // required to drop a tier; every tier targets the same 60 Hz frame budget.
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
      else if (avg < 17.1 && SN.perf.cpuMs < 9 && SN.resolutionScale >= 0.96) {
        SN.qualityFast++;
        SN.qualitySlow = 0;
      }
      else {
        SN.qualitySlow = 0;
        SN.qualityFast = 0;
      }
      if (SN.quality.mode === "auto" && SN.qualityClock - SN.qualityLastSwitch >= 1) {
        if (SN.qualitySlow >= 3 && SN.quality.level > 0) {
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
    if (SN.gradeUniforms) {
      SN.gradeUniforms.uTime.value = SN.renderTime;
      const drivingSpeed = SN.player.car ? Math.abs(SN.player.car.speed) : 0;
      const targetBlur = SN.postActive && SN.qualityLevel() >= 2 ? SN.clamp((drivingSpeed - 15) / 34, 0, 0.55) : 0;
      SN.gradeUniforms.uBlur.value += (targetBlur - SN.gradeUniforms.uBlur.value) * 0.09;
    }
    if (SN.postSsaoPass)
      SN.postSsaoPass.time = SN.renderTime;
    SN.renderer.info.reset();
    if (SN.postActive && SN.composer)
      SN.composer.render();
    else
      SN.renderer.render(SN.scene, SN.camera);
    SN.perf.cpuMs = performance.now() - frameBegin;
    SN.samplePerformance(frameMs);
  };
  SN.closeupFraming = { fov: 44, distance: 3.4 };

  SN.showcasePedestrianSpot = function showcasePedestrianSpot(name, x, z, yaw, n, crowd) {
    const walkView = name === "drive" || name === "mission" || name === "chase" ||
      name === "night" || name === "rain" || name === "carclose";
    const row = Math.floor(n / 3), side = n % 3 - 1;
    const ahead = 8 + row * 4.8 + (side === 0 ? 1.9 : 0);
    const lateral = side * (crowd === 24 ? 1.9 : 0.8);
    const px = x + Math.sin(yaw) * ahead + Math.cos(yaw) * lateral;
    const pz = z + Math.cos(yaw) * ahead - Math.sin(yaw) * lateral;
    if (!walkView && (!SN.pedOnCarriageway(px, pz) || SN.pedOnCrosswalk(px, pz))) return { x: px, z: pz, pavement: false };
    const spawns = SN.pavementSpawns || [], candidates = [];
    const far = walkView ? 54 : 90;
    for (let i = 0; i < spawns.length; i++) {
      const q = spawns[i];
      const dx = q.x - x, dz = q.z - z;
      const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      if (forward < 7 || forward > far) continue;
      const across = dx * Math.cos(yaw) - dz * Math.sin(yaw);
      if (Math.abs(across) > 45) continue;
      if (SN.blocked(q.x, q.z, 0.4) || SN.isWater(q.x, q.z) || SN.pedOnCarriageway(q.x, q.z)) continue;
      candidates.push(q);
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const q = candidates[(n * 7 + 3) % Math.min(candidates.length, 48)];
    const jitter = ((n % 5) - 2) * 1.1;
    let sx = q.x + Math.sin(q.yaw || 0) * jitter, sz = q.z + Math.cos(q.yaw || 0) * jitter;
    if (SN.pedOnCarriageway(sx, sz) || SN.blocked(sx, sz, 0.35)) { sx = q.x; sz = q.z; }
    return { x: sx, z: sz, yaw: q.yaw || 0, node: q.node, pavement: true };
  };

  SN.showcaseCamera = function showcaseCamera() {
    const shot = SN.showcase, p = SN.player, y = p.y;
    SN.camera.fov = shot.name === "river" ? 62 : shot.name === "chase" ? 64 : shot.name === "slope" ? 52 : 59;
    if (shot.name === "closeup") {
      SN.camera.fov = SN.closeupFraming.fov;
      SN.camera.position.set(p.x + SN.closeupFraming.distance, y + 1.0, p.z + 0.04);
      SN.lookTarget.set(p.x + 0.12, y + 0.94, p.z);
    } else if (shot.name === "carclose") {
      SN.camera.fov = 54;
      const cy = SN.surfaceHeight(214.6, 1054.2);
      SN.camera.position.set(214.6, cy + 1.75, 1054.2);
      SN.lookTarget.set(210, cy + 0.72, 1061.4);
    } else if (shot.name === "rain") {
      SN.camera.fov = 63;
      const ry = SN.surfaceHeight(p.x + 24, p.z - 5.5);
      SN.camera.position.set(p.x - 3.6, y + 1.3, p.z + 0.9);
      SN.lookTarget.set(p.x + 26, ry + 0.28, p.z - 5.5);
    } else if (shot.name === "river") {
      SN.camera.position.set(p.x + 12, y + 6.5, p.z + 19);
      SN.lookTarget.set(-20, 55, -340);
    } else if (shot.name === "chase") {
      SN.camera.position.set(p.x + 14, y + 7, p.z - 13);
      SN.lookTarget.set(p.x - 10, y + 1.2, p.z);
    } else if (shot.name === "slope" && SN.slopeShot) {
      const grade = SN.slopeShot, target = SN.roadPointAt(grade.road, Math.min(grade.road.length, grade.s + 26));
      SN.camera.position.set(p.x + Math.cos(grade.yaw) * grade.side * 3.4, y + 4.6, p.z - Math.sin(grade.yaw) * grade.side * 3.4);
      SN.lookTarget.set(target.x, SN.roadProfileHeight(grade.road.profile, Math.min(grade.road.length, grade.s + 26)) + 0.6, target.z);
    } else if (shot.name === "mall") {
      SN.camera.fov = 58;
      SN.camera.position.set(p.x + 48, y + 9.5, p.z + 14);
      SN.lookTarget.set(1756, y + 8.2, 1421);
    } else if (shot.name === "bar") {
      SN.camera.fov = 66;
      SN.camera.position.set(p.x - 2.6, y + 2.7, p.z + 1.2);
      SN.lookTarget.set(-1861.8, y + 1.55, -552.6);
    } else if (shot.name === "base" && SN.military) {
      SN.camera.fov = 60;
      SN.camera.position.set(SN.military.cx - 94, SN.military.y + 12, SN.military.cz + 42);
      SN.lookTarget.set(SN.military.cx + 16, SN.military.y + 3, SN.military.cz - 18);
    } else {
      const distance = p.car ? 10.5 : 6.7, yaw = shot.yaw;
      SN.camera.position.set(p.x - Math.sin(yaw) * distance, y + (p.car ? 4.4 : 3.1), p.z - Math.cos(yaw) * distance);
      SN.lookTarget.set(p.x + Math.sin(yaw) * 12, y + 2.2, p.z + Math.cos(yaw) * 12);
    }
    const fraction = SN.cameraFraction(p.x, y + 1.4, p.z, SN.camera.position.x, SN.camera.position.y, SN.camera.position.z);
    SN.cameraAnchor.set(p.x, y + 1.4, p.z);
    SN.camera.position.lerpVectors(SN.cameraAnchor, SN.camera.position, fraction);
    if (SN.foliageFocus) SN.foliageFocus.value.copy(SN.cameraAnchor);
    SN.camera.lookAt(SN.lookTarget); SN.camera.updateProjectionMatrix();
    SN.sky.position.copy(SN.camera.position);
  };

  SN.startShowcase = function startShowcase(name) {
    if (!SN.devMode || !SN.showcaseNames.includes(name)) return false;
    SN.smoke = null; SN.clearInput(); SN.cleanupEncounter(); SN.hideMissionResult();
    SN.finishStreetEvent(false, true);
    SN.setCityWeather(name === "rain" ? "rain" : "clear", true);
    SN.weather.intensity = name === "rain" ? 1 : 0;
    SN.wetTarget = name === "rain" ? 1 : name === "night" ? 0.65 : 0;
    SN.wetness = SN.wetTarget; SN.wetMode = SN.wetTarget > 0.5;
    if (SN.wetUniforms) SN.wetUniforms.wet.value = SN.wetness;
    if (name === "rain") SN.wetness = 1;
    SN.campaign.active = SN.campaign.checkpoint = null; SN.campaign.progress = 0;
    SN.clearWantedResponse(); SN.heat = 0; SN.holstered = true; SN.selectedWeapon = 0;
    SN.player.car = null; SN.player.bail = null; SN.carjack = null;
    SN.closeDialogue(); SN.toggleJournal(false); SN.toggleCityMap(false); SN.closeShopMenu();
    SN.player.health = 100; SN.player.armor = 70;
    let x = 410, z = -430, yaw = SN.PI / 2, minutes = 630;
    if (name === "drive" || name === "chase") { x = 210; z = 1066; }
    if (name === "night") { x = 310; z = 1074; minutes = 1320; }
    if (name === "river") { x = -112; z = 420; yaw = SN.PI; minutes = 1125; }
    if (name === "mission") { x = -150; z = -634; }
    if (name === "slope" && SN.slopeShot) { x = SN.slopeShot.px; z = SN.slopeShot.pz; yaw = SN.slopeShot.yaw; minutes = 855; }
    if (name === "closeup") { x = 410; z = -430; yaw = SN.PI / 2; minutes = 630; }
    if (name === "carclose") { x = 210; z = 1056; yaw = -SN.PI / 2; minutes = 705; }
    if (name === "rain") { x = 210; z = 1072; yaw = SN.PI / 2; minutes = 1125; }
    if (name === "mall") { x = 1760; z = 1478; yaw = SN.PI; minutes = 950; }
    if (name === "bar") { x = -1869; z = -561; yaw = 0; minutes = 1290; }
    if (name === "base" && SN.military) { x = SN.military.cx + 4; z = SN.military.cz; yaw = -SN.PI / 2; minutes = 705; }
    const drive = ["drive", "chase", "mission"].includes(name);
    // Authored camera marks stay on the actual shopping terrace / avenue sidewalk.
    // Nearest-shop selection could silently move the view onto the Namsan hillside.
    const p = drive || name === "rain" || name === "carclose" || name === "bar" ? { x, z } : SN.safePosition(x, z, 0.35);
    Object.assign(SN.player, p, { y: SN.surfaceHeight(p.x, p.z), yaw, vy: 0, speed: 0, motionSpeed: 0, dead: 0, grounded: true });
    const stageCar = (car, px, pz, heading, type, speed) => {
      if (car.occupant) { car.occupant.inCar = null; car.occupant.active = false; car.occupant = null; }
      if (type !== undefined && car.type !== type) SN.fitVehicle(car, type);
      SN.repairVehicle(car);
      Object.assign(car, { x: px, z: pz, yaw: heading, active: true, driver: true, parked: false, freeRolling: false, speed, vx: Math.sin(heading) * speed, vz: Math.cos(heading) * speed });
      SN.resetVehicleGround(car); car.root.visible = true; car.root.position.set(car.x, car.y, car.z); car.root.rotation.y = heading;
      return car;
    };
    for (const car of SN.cars) { car.active = false; car.root.visible = false; }
    for (const actor of SN.actors) { actor.active = false; actor.rig.root.visible = false; }
    if (name === "base" && SN.military) {
      for (const tank of SN.military.tanks) { tank.active = true; tank.root.visible = true; }
      for (const a of SN.military.aircraft) a.root.visible = true;
      for (const guard of SN.military.guards) {
        guard.active = true;
        guard.rig.root.visible = !guard.modelAgent;
        guard.rig.root.position.set(guard.x, SN.surfaceHeight(guard.x, guard.z), guard.z);
        guard.rig.root.rotation.y = guard.yaw;
        guard.poseDirty = true;
      }
    }
    if (drive) {
      SN.player.car = stageCar(SN.contractCar, x, z, yaw, name === "mission" ? 3 : 7, 18);
      SN.player.car.paintColor = name === "chase" ? 0xd52c35 : 0x126bd5; SN.repairVehicle(SN.player.car);
      SN.player.y = SN.player.car.y;
    }
    SN.playerRoot.visible = !drive && name !== "carclose" && name !== "rain";
    SN.showcaseTraffic = [];
    const stageTraffic = (car, px, pz, heading, type) => {
      if (SN.carBlocked(px, pz, heading, car) || SN.isWater(px, pz)) return;
      stageCar(car, px, pz, heading, type, 9);
      if (type !== 3 && type !== 6) { car.paintColor = SN.carColors[[0, 2, 3, 1, 4, 5][SN.showcaseTraffic.length % 6]]; SN.repairVehicle(car); }
      SN.showcaseTraffic.push(car);
    };
    if (name === "carclose") {
      // Three showroom cars in a row, patrol car and scooter behind them.
      const rows = [[0, 210, 1058.4], [3, 210, 1061.6], [7, 210, 1064.8], [9, 202.5, 1059.2], [8, 202.5, 1062.8]];
      rows.forEach((row, i) => {
        const car = SN.cars[i];
        stageCar(car, row[1], row[2], SN.PI / 2, row[0], 0);
        car.driver = false; car.parked = true;
        SN.showcaseTraffic.push(car);
      });
    }
    else if (name === "drive" || name === "chase" || name === "night" || name === "rain") {
      const slots = [[23, 1066, 0], [38, 1054, 3], [53, 1069.2, 2], [73, 1050.8, 6], [94, 1066, 7], [115, 1054, 1]];
      for (let n = 0; n < slots.length; n++) {
        const slot = slots[n];
        stageTraffic(SN.cars[n], x + slot[0], slot[1], slot[1] < 1060 ? -SN.PI / 2 : SN.PI / 2, slot[2]);
      }
    } else {
      const traffic = SN.roadSpawnPoints.filter(p => Math.hypot(p.x - x, p.z - z) > 22 && Math.hypot(p.x - x, p.z - z) < 180 &&
        (p.x - x) * Math.sin(yaw) + (p.z - z) * Math.cos(yaw) > 8);
      traffic.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
      for (const point of traffic) {
        if (SN.showcaseTraffic.length >= 6) break;
        if (SN.cars.some(c => c.active && Math.hypot(c.x - point.x, c.z - point.z) < 10)) continue;
        stageTraffic(SN.cars[SN.showcaseTraffic.length], point.x, point.z, point.yaw, [3, 6, 0, 4, 1, 7][SN.showcaseTraffic.length]);
      }
    }
    SN.showcaseActors = [];
    const identities = ["office", "student", "tourist", "elder", "delivery", "vendor", "nightlife", "couple", "jogger", "worker"];
    const crowd = name === "street" || name === "map" ? 24 : 12;
    for (let n = 0; n < crowd; n++) {
      const eligible = a => a.kind === "civilian" && !SN.showcaseActors.includes(a) && a.index < SN.pedCount;
      const actor = SN.actors.find(a => eligible(a) && a.archetype === identities[n % identities.length]) || SN.actors.find(eligible);
      if (!actor) continue;
      const spot = SN.showcasePedestrianSpot(name, x, z, yaw, n, crowd);
      if (!spot) continue;
      const px = spot.x, pz = spot.z;
      if (SN.blocked(px, pz, 0.3) || SN.isWater(px, pz)) continue;
      if (SN.pedOnCarriageway(px, pz) && !SN.pedOnCrosswalk(px, pz)) continue;
      SN.showcaseActors.push(actor);
      actor.mode = actor.archetype === "tourist" ? "photo" : actor.archetype === "office" ? "phone" : "walk"; actor.panic = 0;
      const dir = n % 2 ? -1 : 1;
      const facing = spot.pavement ? (spot.yaw || 0) : yaw + (n % 2 ? SN.PI : 0);
      Object.assign(actor, { x: px, z: pz, active: true, inCar: null, down: 0, fall: 0, bail: null, health: 100, hostile: false, yaw: facing, phase: n * 1.7, poseDirty: true,
        showcaseHomeX: px, showcaseDir: dir, showcaseSpeed: 0.85 + (n % 4) * 0.16 });
      if (spot.node) { actor.pedNode = spot.node; actor.pedPrev = null; actor.pedTarget = null; actor.pedLink = null; actor.pedWait = 0; }
      actor.rig.root.position.set(px, SN.surfaceHeight(px, pz), pz); actor.rig.root.rotation.y = actor.yaw;
    }
    if (name === "closeup") {
      const first = SN.showcaseActors.find(a => a.archetype === "delivery") || SN.showcaseActors[0];
      const second = SN.showcaseActors.find(a => a !== first && a.archetype === "jogger") ||
        SN.showcaseActors.find(a => a !== first && a.archetype !== (first && first.archetype)) || SN.showcaseActors[1];
      const picks = [first, second].filter(Boolean), spots = [[0.3, -0.95], [0.3, 0.95]];
      picks.forEach((actor, i) => {
        const sx = p.x + spots[i][0], sz = p.z + spots[i][1], sy = SN.surfaceHeight(sx, sz);
        Object.assign(actor, { x: sx, z: sz, yaw: SN.PI / 2, mode: "idle", walk: false, chat: false, phone: false, phase: i * 1.9, poseDirty: true, panic: 0 });
        if (actor.rig.motion) { actor.rig.motion.speed = 0; actor.rig.motion.gait = 0; }
        actor.rig.root.visible = !actor.modelAgent;
        actor.rig.root.position.set(sx, sy, sz);
        actor.rig.root.rotation.y = actor.yaw;
      });
    }
    if (name === "chase") {
      SN.forceWanted(3, "警方追逐");
      SN.pursuitCars.filter(c => c.role === "police").slice(0, 2).forEach((c, i) => stageCar(c, x - 9 - i * 9, z + (i ? 3.2 : -1.5), yaw, 9, 20));
    }
    if (name === "mission") {
      SN.startMission("story", 0); SN.campaign.active.step = 2; SN.prepareObjective();
      SN.campaign.active.time = 206; SN.campaign.active.remaining = 270;
    }
    SN.minutes = minutes; SN.camYaw = yaw; SN.camPitch = 0.08;
    SN.showcase = { name, yaw, minutes };
    SN.radio.toastUntil = 0; SN.radio.line = ""; SN.radio.lineUntil = 0;
    for (const a of SN.cityAnimals) a.active = false; SN.lifeClock = 0; SN.updateLivingCity(0);
    SN.updateRadio(0);
    SN.snapPlayer(); SN.snapCars(); Object.assign(SN.playerRender, SN.playerPrev);
    if (SN.models && SN.models.refreshAssignments) {
      SN.models.refreshAssignments(true);
      SN.models.update(1 / 60);
    }
    SN.updateShowcase(0); SN.showcaseCamera(); SN.updateLighting(); SN.streamCity(true);
    SN.refreshHUD();
    if (name === "map") { SN.atlasView = { x: 0, z: 0, zoom: 1 }; SN.toggleCityMap(true); }
    SN.$("toast").classList.remove("show"); SN.toastTime = 0;
    console.log("SHOWCASE " + name + " ready");
    return true;
  };

  SN.updateShowcase = function updateShowcase(dt) {
    SN.simTime += dt; SN.stepCount++; SN.minutes = SN.showcase.minutes;
    SN.updateWeather(dt);
    SN.updateNightBar(dt, SN.simTime);
    SN.updateRadio(dt);
    SN.clearInput();
    SN.poseRig(SN.playerRig, 0, 0, SN.simTime, false, false, 0, -1);
    for (let n = 0; n < SN.showcaseActors.length; n++) {
      const a = SN.showcaseActors[n];
      if (!a.active) continue;
      a.poseDirty = true; a.rig.root.visible = !a.modelAgent;
      if (SN.showcase.name === "street" && a.mode === "walk") {
        if (!a.showcaseHomeX || a.showcaseHomeX === undefined) a.showcaseHomeX = a.x;
        if (Math.abs(a.x - a.showcaseHomeX) > 13 || !a.showcaseDir) a.showcaseDir = a.x > a.showcaseHomeX ? -1 : 1;
        const targetYaw = a.showcaseDir > 0 ? SN.PI / 2 : -SN.PI / 2;
        const delta = SN.angleDelta(a.yaw, targetYaw);
        a.yaw += SN.clamp(delta, -3.2 * dt, 3.2 * dt);
        const step = Math.abs(delta) < 0.9 ? a.showcaseSpeed * dt : 0;
        if (step) a.x += a.showcaseDir * step;
        a.rig.root.position.set(a.x, SN.surfaceHeight(a.x, a.z), a.z);
        a.rig.root.rotation.y = a.yaw;
        SN.advanceGait(a.rig, step, dt, 0);
        a.phase = a.rig.motion.phase;
        SN.poseRig(a.rig, step > 0 ? a.showcaseSpeed : 0, a.phase, SN.simTime, false, false, 0, -1);
      }
      else
        SN.poseRig(a.rig, 0, a.phase + SN.simTime * 1.4, SN.simTime, false, false, 0, -1);
      SN.posePedestrianIdentity(a, SN.simTime);
      if (a.mode === "phone") SN.posePhone(a.rig, SN.simTime);
    }
    for (const c of SN.cars) if (c.active) {
      c.spin += c.speed * dt / c.wheelRadius;
      for (const [i, light] of (c.lights || []).entries()) light.material.opacity = (Math.floor(SN.simTime * 7) + i) % 2 ? 0.9 : 0.08;
    }
    if (SN.showcase.name === "chase") { SN.heat = 3; SN.lastCrime = SN.simTime; }
  };

  SN.extendFeelSmoke = function extendFeelSmoke() {
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    SN.smoke.stages.push(
      [12.6, "feel-vault-water", () => {
        const saved = { x: SN.player.x, z: SN.player.z, y: SN.player.y, yaw: SN.player.yaw };
        SN.player.car = null; SN.clearInput();
        let vaulted = false;
        try {
          for (const b of SN.obbColliders) {
            if (b.height - b.minY < 0.4 || b.height - b.minY > 1.05 || b.hd > 0.7) continue;
            const d = b.hd + 0.65, x = b.x - b.sin * d, z = b.z - b.cos * d;
            if (SN.blocked(x, z, 0.3)) continue;
            Object.assign(SN.player, { x, z, y: SN.surfaceHeight(x, z), yaw: b.yaw, grounded: true });
            if (SN.tryVault()) { vaulted = true; break; }
          }
          assert(vaulted, "没有可翻越的低障碍");
          for (let i = 0; i < 36; i++) SN.updateVault(1 / 60);
          assert(!SN.player.vault && SN.player.grounded && !SN.blocked(SN.player.x, SN.player.z, 0.28), "翻越落点不安全");
          SN.player.safeLand = { x: saved.x, z: saved.z };
          SN.player.x = 100; SN.player.z = (SN.riverNorth(100) + SN.riverSouth(100)) / 2;
          assert(SN.recoverFromWater() && !SN.isWater(SN.player.x, SN.player.z), "落水未返回安全岸边");
        } finally { Object.assign(SN.player, saved, { vault: null, grounded: true, vy: 0 }); SN.snapPlayer(); }
      }],
      [12.65, "feel-camera", () => {
        const saved = { x: SN.player.x, y: SN.player.y, z: SN.player.z, car: SN.player.car, yaw: SN.camYaw };
        const c = SN.contractCar;
        try {
          SN.placeMissionVehicle(c, -66, -786, 7); SN.player.car = c;
          Object.assign(SN.player, { x: c.x, y: c.y, z: c.z }); Object.assign(SN.playerRender, SN.player);
          SN.camYaw = c.yaw; SN.camShake = 0.4; SN.camShakeTime = 0.3;
          SN.updateCamera(1 / 60); const front = SN.camera.position.clone();
          SN.keys.KeyX = true; SN.updateCamera(1 / 60);
          assert(SN.camera.position.distanceTo(front) > 3, "后视镜头未翻转");
          assert([SN.camera.position.x, SN.camera.position.y, SN.camera.position.z].every(Number.isFinite), "镜头坐标无效");
          const b = SN.colliders.find(v => v.height - v.minY > 5);
          assert(b, "缺少建筑碰撞体");
          const z = (b.minZ + b.maxZ) / 2, y = b.minY + 2;
          assert(SN.cameraFraction(b.minX - 2, y, z, b.maxX + 2, y, z) < 0.5, "镜头射线穿墙");
        } finally { SN.clearInput(); Object.assign(SN.player, saved); SN.camYaw = saved.yaw; SN.snapPlayer(); Object.assign(SN.playerRender, SN.player); }
      }],
      [12.7, "feel-settings-feedback", () => {
        assert(!SN.damageNumbers, "伤害数字默认开启");
        SN.hurtPlayer(2, false, { x: SN.player.x + 10, z: SN.player.z });
        SN.updateFeedback(1 / 60); assert(SN.hurtSource && SN.$("hurtDirection").style.opacity > 0, "缺少受击方向");
        SN.toast("路线已更新", 2); SN.toast("检查点已保存", 2);
        assert(SN.$("toast").textContent === "检查点已保存", "提示重复叠加");
        SN.togglePause(true); SN.toggleSettings(); assert(SN.settingsPanel.classList.contains("open"), "设置未打开");
        SN.togglePause(false); assert(!SN.settingsPanel.classList.contains("open") && SN.canControl(), "暂停退出后未清理子页");
        const service = SN.streetServices[0];
        const best = { name: "近处柜台" };
        assert(SN.updateStreetServices(0, best) === best, "街边服务覆盖了更近柜台");
        assert(SN.audioFalloff(SN.player.x + 80, SN.player.z) < SN.audioFalloff(SN.player.x + 5, SN.player.z), "声音未按距离衰减");
      }],
      [12.75, "feel-vehicle-effects", () => {
        const c = SN.contractCar; SN.repairVehicle(c); SN.player.car = c;
        Object.assign(SN.player, { x: c.x, y: c.y, z: c.z });
        SN.shatterCarGlass(c); assert(c.glassBroken && !c.glass.visible, "车窗未破碎");
        SN.spawnDebris(c.x, c.y + 1, c.z, false);
        c.speed = 16; c.vx = Math.sin(c.yaw) * 16; c.vz = Math.cos(c.yaw) * 16;
        c.airborne = false; SN.keys.Space = true; SN.skidClock = 0; SN.updateVehicleEffects(0.1);
        assert(SN.skidMesh.count > 0 && SN.debrisMesh.count > 0, "胎痕或碎片未生成");
        assert(SN.skidMesh.instanceColor && SN.debrisMesh.instanceColor, "实例颜色缺失");
        SN.clearInput(); SN.player.car = null; c.speed = c.vx = c.vz = 0; SN.repairVehicle(c);
      }],
      [12.8, "feel-military-base", () => {
        const M = SN.military;
        assert(M && M.tanks.length === 2 && M.aircraft.length === 2 && M.guards.length === 4, "军营内容缺失");
        const heights = [[-100, -60], [90, -50], [-10, 38], [40, 60], [0, 0]]
          .map(([lx, lz]) => SN.surfaceHeight(M.cx + lx, M.cz + lz));
        const spread = Math.max(...heights) - Math.min(...heights);
        assert(spread < 1.2, "军营地面不平 " + spread.toFixed(2));
        assert(!SN.blocked(M.x1 - 1.5, M.cz, 0.4) && !SN.blocked(M.x1 + 1.5, M.cz, 0.4), "营门被挡");
        assert(SN.blocked(M.x1, M.z0 + 18, 0.4), "营墙不实");
        assert(SN.blocked(M.cx - 72, M.cz - 48, 0.4), "营房不实");
        const p = SN.player;
        const tank = M.tanks[0], heli = M.aircraft.find(a => a.kind === "heli"), plane = M.aircraft.find(a => a.kind === "plane");
        const saved = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, car: p.car, camYaw: SN.camYaw, camPitch: SN.camPitch, heat: SN.heat };
        const airSaved = M.aircraft.map(a => ({ a, x: a.x, z: a.z, y: a.y, yaw: a.yaw, speed: a.speed, vy: a.vy,
          airborne: a.airborne, pitch: a.pitch, roll: a.roll, health: a.health, occupied: a.occupied }));
        const tankSaved = { x: tank.x, z: tank.z, yaw: tank.yaw };
        try {
          SN.clearInput(); p.car = null;
          Object.assign(p, { x: M.cx, z: M.cz, y: SN.surfaceHeight(M.cx, M.cz), grounded: true });
          M.inside = false;
          SN.updateMilitary(0.05);
          assert(SN.heat === 5, "进入军营未触发五星通缉");
          assert(M.inside, "军营进入状态未记录");
          assert(M.guards.every(g => g.active && g.guard), "武警未上岗");
          // Tank: tracked, no floating car wheels, drives under the shared car physics.
          assert(tank.spec.tank && tank.wheels.length === 0, "坦克仍装配车轮");
          tank.speed = 0; tank.vx = tank.vz = 0;
          for (let i = 0; i < 150; i++) SN.moveCar(tank, 1 / 60, 1, 0);
          const travelled = Math.hypot(tank.x - tankSaved.x, tank.z - tankSaved.z);
          assert(travelled > 4, "坦克无法行驶 " + travelled.toFixed(2));
          // Helicopter: lifts on its own, flies forward, then lands and lets the player out.
          heli.x = M.cx - 8; heli.z = M.cz + 38; heli.yaw = -Math.PI / 2;
          heli.y = SN.surfaceHeight(heli.x, heli.z) + heli.rest;
          Object.assign(heli, { speed: 0, vy: 0, airborne: false, health: 140 });
          assert(SN.boardAircraft(heli), "无法驾驶直升机");
          SN.clearInput();
          for (let i = 0; i < 150; i++) SN.updateAircraft(1 / 60);
          const lift = heli.y - SN.surfaceHeight(heli.x, heli.z);
          assert(lift > 6, "直升机未升空 " + lift.toFixed(1));
          const hx = heli.x;
          SN.keys.KeyW = true;
          for (let i = 0; i < 90; i++) SN.updateAircraft(1 / 60);
          SN.clearInput();
          assert(heli.x < hx - 4, "直升机无法前飞");
          heli.y = SN.surfaceHeight(heli.x, heli.z) + heli.rest; heli.airborne = false; heli.vy = 0;
          assert(SN.exitAircraft() && !SN.player.aircraft, "直升机无法下机");
          // Plane: rolls, gets airborne above its takeoff speed, climbs, then lands.
          plane.x = M.cx + 40; plane.z = M.cz + 38; plane.yaw = -Math.PI / 2;
          plane.y = SN.surfaceHeight(plane.x, plane.z) + plane.rest;
          Object.assign(plane, { speed: 24, vy: 0, airborne: false, health: 140 });
          assert(SN.boardAircraft(plane), "无法驾驶飞机");
          SN.clearInput(); SN.updateAircraft(1 / 60);
          assert(plane.airborne, "飞机达到速度仍未离地");
          for (let i = 0; i < 90; i++) SN.updateAircraft(1 / 60);
          const alt = plane.y - SN.surfaceHeight(plane.x, plane.z);
          assert(alt > 5, "飞机未爬升 " + alt.toFixed(1));
          plane.y = SN.surfaceHeight(plane.x, plane.z) + plane.rest; plane.airborne = false; plane.vy = 0; plane.speed = 0;
          assert(SN.exitAircraft() && !SN.player.aircraft, "飞机无法下机");
          assert(M.aircraft.every(a => a.y >= SN.surfaceHeight(a.x, a.z) - 0.2), "飞行器陷进地面");
        } finally {
          SN.clearInput();
          if (SN.player.aircraft) SN.exitAircraft();
          for (const s of airSaved) {
            Object.assign(s.a, { x: s.x, z: s.z, y: s.y, yaw: s.yaw, speed: s.speed, vy: s.vy,
              airborne: s.airborne, pitch: s.pitch, roll: s.roll, health: s.health, occupied: s.occupied });
            if (s.a === SN.player.aircraft) SN.player.aircraft = null;
            s.a.root.position.set(s.x, s.y, s.z);
            s.a.root.rotation.set(s.pitch, s.yaw, s.roll);
          }
          Object.assign(tank, { x: tankSaved.x, z: tankSaved.z, yaw: tankSaved.yaw, speed: 0, vx: 0, vz: 0 });
          Object.assign(p, { x: saved.x, y: saved.y, z: saved.z, yaw: saved.yaw, car: saved.car, aircraft: null, grounded: true, vy: 0 });
          SN.playerRoot.visible = true;
          SN.camYaw = saved.camYaw; SN.camPitch = saved.camPitch;
          SN.heat = saved.heat;
          if (saved.heat === 0) SN.clearWantedResponse();
          M.inside = false; M.alarm = 0;
          SN.snapPlayer();
        }
      }]
    );
  };

  SN.extendMobileSmoke = function extendMobileSmoke() {
    const assert = (value, message) => { if (!value) throw new Error(message); };
    const pointer = (id, type, pointerId, x = 80, y = innerHeight - 90) => SN.$(id).dispatchEvent(new window.PointerEvent(type, { bubbles: true, cancelable: true, pointerType: "touch", pointerId, clientX: x, clientY: y, button: 0 }));
    const key = (code, down = true) => window.dispatchEvent(new window.KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true, cancelable: true }));
    SN.smoke.stages.push(
      [12.8, "mobile-action-parity", () => {
        SN.clearInput();
        assert(SN.canControl(), "触屏测试前控制被阻断");
        // Check both actual event bindings call the identical gameplay action.
        for (const entry of [["touchEnter", "KeyF", "enterExit"], ["touchHolster", "KeyH", "toggleHolster"], ["touchWeapon", "KeyQ", "cycleWeapon"], ["touchJump", "Space", "jump"]]) {
          const original = SN[entry[2]]; let calls = 0;
          try {
            SN[entry[2]] = () => { calls++; };
            key(entry[1]); key(entry[1], false);
            pointer(entry[0], "pointerdown", 801); pointer(entry[0], "pointerup", 801);
            assert(calls === 2, entry[0] + " 与键盘动作不同");
          } finally { SN[entry[2]] = original; SN.clearInput(); }
        }
        pointer("touchJump", "pointerdown", 802); assert(SN.jumpBuffer > 0, "触屏跳跃未缓冲");
        pointer("touchJump", "pointerup", 802); SN.clearInput();
        const selected = SN.selectedWeapon;
        SN.weapons[1].owned = true; SN.selectWeapon(0);
        key("KeyQ"); key("KeyQ", false); const keyboardWeapon = SN.selectedWeapon;
        SN.selectWeapon(0); pointer("touchWeapon", "pointerdown", 803); pointer("touchWeapon", "pointerup", 803);
        assert(SN.selectedWeapon === keyboardWeapon, "换武器方向不一致");
        SN.selectWeapon(selected < 0 ? 0 : selected); SN.clearInput();
      }],
      [12.85, "mobile-multitouch-aim", () => {
        const yaw = SN.camYaw, pitch = SN.camPitch;
        try {
          pointer("joyZone", "pointerdown", 811);
          pointer("joyZone", "pointermove", 811, SN.joy.cx, SN.joy.cy - 40);
          pointer("touchSprint", "pointerdown", 812);
          pointer("touchAttack", "pointerdown", 813, innerWidth - 60, innerHeight - 70);
          assert(SN.touch.y === 1 && SN.touch.sprint && SN.firing && SN.triggerPressed, "同时移动、疾跑、攻击失效");
          pointer("touchAttack", "pointermove", 813, innerWidth - 30, innerHeight - 80);
          assert(SN.camYaw !== yaw, "攻击键拖动未瞄准");
          pointer("touchAttack", "pointerup", 899);
          assert(SN.firing, "另一根手指释放了攻击");
          pointer("joyZone", "pointercancel", 811);
          assert(SN.touch.y === 0 && SN.firing && SN.touch.sprint, "摇杆取消影响了其他指针");
          pointer("touchAttack", "lostpointercapture", 813);
          assert(!SN.firing && SN.touch.sprint, "攻击取消后仍在射击");
          pointer("touchAim", "pointerdown", 814); assert(SN.aiming, "瞄准无响应");
          pointer("touchAim", "pointercancel", 814); assert(!SN.aiming, "瞄准未释放");
        } finally { SN.clearInput(); SN.camYaw = yaw; SN.camPitch = pitch; }
        assert(!SN.touch.sprint && SN.joy.id === -1, "清理后仍有按键按下");
      }],
      [18.7, "mobile-pedals-steer-horn", () => {
        const c = SN.contractCar, player = { x: SN.player.x, y: SN.player.y, z: SN.player.z, car: SN.player.car };
        try {
          SN.placeMissionVehicle(c, -66, -786, 7); SN.repairVehicle(c);
          const point = SN.exitPosition(c); assert(point, "上车测试没有安全落点");
          Object.assign(SN.player, point, { y: SN.surfaceHeight(point.x, point.z), car: null });
          SN.doorTarget = null; SN.nearestCarAt = -Infinity;
          pointer("touchEnter", "pointerdown", 821); pointer("touchEnter", "pointerup", 821);
          assert(SN.player.car === c, "触屏不能上车"); SN.carjack = null;
          for (const entry of [["touchAccel", "KeyW", "throttle", 1], ["touchBrake", "KeyS", "throttle", -1], ["touchJump", "Space", "brake", true], ["touchRear", "KeyX", "rear", true]]) {
            key(entry[1]);
            const fromKey = entry[2] === "rear" ? !!SN.keys.KeyX : SN.driveControls()[entry[2]];
            key(entry[1], false); pointer(entry[0], "pointerdown", 822);
            const fromTouch = entry[2] === "rear" ? SN.touch.rear : SN.driveControls()[entry[2]];
            assert(fromKey === fromTouch && fromTouch === entry[3], entry[0] + " 与驾驶键不一致");
            pointer(entry[0], "pointercancel", 822);
          }
          pointer("joyZone", "pointerdown", 823);
          pointer("joyZone", "pointermove", 823, SN.joy.cx + 40, SN.joy.cy - 30);
          assert(SN.driveControls().steer > 0.5 && SN.driveControls().throttle === 0, "方向杆混入油门");
          pointer("touchAccel", "pointerdown", 824);
          for (let n = 0; n < 12; n++) SN.carMotion(1 / 60);
          assert(c.speed > 0.1 && Number.isFinite(c.x), "油门没有驱动车辆");
          const originalHonk = SN.honk; let horns = 0;
          try { SN.honk = () => { horns++; }; key("KeyG"); key("KeyG", false); pointer("touchSprint", "pointerdown", 825); assert(horns === 2, "鸣笛与 G 不一致"); }
          finally { SN.honk = originalHonk; }
          SN.clearInput(); c.speed = c.vx = c.vz = 0;
          pointer("touchEnter", "pointerdown", 826); pointer("touchEnter", "pointerup", 826);
          assert(!SN.player.car, "触屏不能下车");
        } finally { SN.clearInput(); SN.carjack = null; Object.assign(SN.player, player); SN.snapPlayer(); }
      }],
      [18.8, "mobile-overlays-recovery", () => {
        pointer("openCityMap", "pointerdown", 831); pointer("openCityMap", "pointerup", 831); SN.$("openCityMap").click();
        assert(SN.cityMapOpen, "触屏地图未打开"); key("KeyN"); key("KeyN", false);
        assert(!SN.cityMapOpen, "地图键与触屏状态不一致");
        pointer("pauseBtn", "pointerdown", 832); pointer("pauseBtn", "pointerup", 832); SN.$("pauseBtn").click();
        assert(SN.pauseOpen && !SN.firing, "触屏暂停未清理输入"); key("Escape"); key("Escape", false);
        assert(!SN.pauseOpen, "暂停未返回");
        SN.touch.accel = true;
        const lost = new window.Event("webglcontextlost", { cancelable: true });
        SN.contextLoss(lost);
        assert(lost.defaultPrevented && SN.contextLost && !SN.touch.accel && !SN.canControl(), "上下文丢失未暂停");
        SN.contextRestore();
        assert(!SN.contextLost && SN.contextRestorePending, "上下文恢复未排队");
        // Synthetic loss leaves the actual GL context intact; test the state handoff.
        SN.contextRestorePending = false; SN.$("contextStatus").hidden = true; SN.syncSuspension();
        assert(SN.canControl(), "恢复后无法控制");
        const devMode = SN.devMode;
        try {
          SN.devMode = false; SN.windowBlurred = true; SN.touch.accel = true; SN.syncSuspension();
          assert(SN.paused && !SN.touch.accel, "切出页面未暂停或释放输入");
        } finally { SN.devMode = devMode; SN.windowBlurred = false; SN.syncSuspension(); }
        assert(SN.carLOD.length === 2 && SN.carLOD.every(m => m.instanceColor), "远车实例缺少颜色");
        assert(SN.perf.history.length === 2400 && SN.renderPixelRatio() <= (SN.coarse ? 1.25 : 1.5), "性能池或分辨率不受限");
      }]
    );
  };

  SN.startSmoke = function startSmoke() {
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    const movePlayer = (x, z) => {
      const p = SN.safePosition(x, z, 0.35);
      Object.assign(SN.player, p, { y: SN.surfaceHeight(p.x, p.z), vy: 0, speed: 0, motionSpeed: 0, dead: 0, grounded: true, bail: null });
      SN.snapPlayer();
    };
    const saved = { money: SN.money, x: SN.player.x, z: SN.player.z, minutes: SN.minutes };
    let car, walking;
    SN.seed = 31107;
    SN.quality.mode = "中";
    if (SN.renderer) SN.applyQuality();
    SN.smoke = { start: SN.simTime, index: 0, passed: 0, failed: 0, stages: [
      [0.1, "boot", () => {
        assert(SN.started && SN.scene && SN.playerRoot && !SN.cinematic && !SN.storyDialogue, "启动状态错误");
        assert(SN.weapons.length === 6 && SN.vehicleSpecs.length >= 14, "内容缺失");
        walking = { x: SN.player.x, z: SN.player.z }; SN.keys.KeyW = true;
      }],
      [1, "walk", () => {
        SN.clearInput(); assert(Math.hypot(SN.player.x - walking.x, SN.player.z - walking.z) > 0.05, "步行未移动");
        SN.findNearestCar(true); car = SN.nearestCar;
        assert(car, "附近无车辆");
        const exit = SN.exitPosition(car); assert(exit, "上车位置不可达");
        movePlayer(exit.x, exit.z); SN.doorTarget = null; SN.enterExit();
        assert(SN.player.car === car, "上车失败");
      }],
      [1.8, "drive-start", () => { SN.keys.KeyW = true; }],
      [3.4, "drive-drift", () => {
        assert(Number.isFinite(car.x) && Number.isFinite(car.speed) && Math.abs(car.speed) > 1, "车辆没有加速");
        SN.keys.KeyD = SN.keys.Space = true;
      }],
      [4.0, "bike-steering", () => {
        const spec = SN.vehicleSpecs.find(s => s.bike);
        assert(spec, "缺少摩托车型");
        const blocked = SN.carBlocked, water = SN.carWater;
        SN.carBlocked = () => false;
        SN.carWater = () => false;
        try {
          const makeBike = () => {
            const root = new SN.T.Group(), body = new SN.T.Group();
            root.add(body);
            root.visible = false;
            return {
              spec, x: 500, z: 500, yaw: 0, speed: 18, vx: 0, vz: 0, steer: 0, yawRate: 0,
              health: 100, maxHealth: 100, exploded: false, airborne: false, active: false,
              collisionTimer: 0, collisionCooldown: 0, stuck: 0, suspension: 0, suspensionV: 0,
              pitch: 0, pitchV: 0, roll: 0, rollV: 0, terrainRoll: 0, vy: 0, groundY: 0,
              wheelRadius: 0.32, wheels: [], occupants: [], root, body, lights: null, spin: 0,
              driver: null, parked: true
            };
          };
          const sample = dir => {
            const c = makeBike();
            const rates = [];
            for (let f = 0; f < 60; f++) {
              const before = c.yaw;
              c.speed = 18;
              SN.moveCar(c, 1 / 60, 0, f < 6 ? 0 : dir);
              rates.push(Math.abs(c.yaw - before) * 60);
            }
            return { c, rates };
          };
          const left = sample(1), right = sample(-1);
          const steadyLeft = left.rates[45], steadyRight = right.rates[45];
          assert([left.c.yaw, right.c.yaw, steadyLeft, steadyRight].every(Number.isFinite), "摩托转向出现无效角度");
          assert(steadyLeft > 0.25 && steadyRight > 0.25, "摩托无法转向 " + steadyLeft.toFixed(2) + "/" + steadyRight.toFixed(2));
          assert(Math.abs(steadyLeft - steadyRight) / Math.max(steadyLeft, steadyRight) < 0.08, "左右转向不对称");
          // A steering wheel builds its arc: the first tenth of a second must not
          // already carry the full yaw rate.
          assert(left.rates[8] < steadyLeft * 0.45, "转向瞬间到位，没有弧度 " + (left.rates[8] / steadyLeft).toFixed(2));
          assert(left.rates[2] <= left.rates[8] + 1e-6, "转向响应不是逐渐增大");
          const c = left.c;
          for (let f = 0; f < 40; f++) { c.speed = 18; SN.moveCar(c, 1 / 60, 0, 0); }
          const settle = Math.abs(c.yawRate);
          assert(settle < steadyLeft * 0.15, "松开转向后车身回正太慢 " + settle.toFixed(3));
        } finally {
          SN.carBlocked = blocked;
          SN.carWater = water;
        }
      }],
      [4.2, "reverse", () => {
        SN.clearInput(); car.speed = car.vx = car.vz = 0; SN.keys.KeyS = true;
      }],
      [4.8, "driveby", () => {
        SN.clearInput(); assert(car.speed < 0, "倒车失败");
        SN.selectWeapon(1); SN.weapons[1].mag = 8; SN.shotClock = 0; SN.triggerPressed = true;
        SN.fireWeapon(); assert(SN.weapons[1].mag === 7, "车内射击失败");
        car.speed = car.vx = car.vz = 0; SN.enterExit(); assert(!SN.player.car, "下车失败");
      }],
      [5.5, "weapons", () => {
        SN.player.health = 100; SN.player.armor = 100;
        for (let i = 0; i < SN.weapons.length; i++) {
          const w = SN.weapons[i]; w.owned = true; w.mag = w.capacity; w.reserve = w.capacity * 3;
          SN.selectWeapon(i); SN.shotClock = 0; SN.triggerPressed = true; SN.fireWeapon();
          assert(w.capacity ? w.mag === w.capacity - 1 : SN.attackTime > 0, "武器 " + i + " 无响应");
        }
        SN.selectWeapon(1); SN.reload(); assert(SN.reloadTime > 0, "换弹失败");
      }],
      [6.2, "traffic-signals", () => {
        assert(SN.trafficSignals.length > 0, "没有交通信号");
        const north = SN.roadSpawnPoints.find(p => Math.cos(p.yaw) < -0.99 && p.laneOffset > 0);
        const south = SN.roadSpawnPoints.find(p => Math.cos(p.yaw) > 0.99 && p.laneOffset > 0);
        assert(north && south && north.x > north.centerX && south.x < south.centerX, "交通没有靠右行驶");
        const a = SN.trafficSignals[0];
        assert(SN.trafficGreen({ ...a, axis: 0, offset: 0 }, 3) && !SN.trafficGreen({ ...a, axis: 1, offset: 0 }, 3), "交叉方向同时放行");
        assert(!SN.trafficGreen({ ...a, axis: 0, offset: 0 }, 10) && !SN.trafficGreen({ ...a, axis: 1, offset: 0 }, 10), "缺少清空路口时间");
        for (const c of SN.cars) assert([c.x, c.z, c.yaw, c.speed].every(Number.isFinite), "车辆出现无效坐标");
      }],
      [6.8, "witness-carjack", () => {
        SN.clearInput(); SN.player.health = 100; SN.player.armor = 100;
        const target = SN.cars.find(c => c.active && c.occupant && c.role === "traffic" && c.health > 45);
        assert(target, "无可劫持车辆"); car = target;
        car.speed = car.vx = car.vz = 0;
        const p = SN.exitPosition(car); assert(p, "司机无法下车"); movePlayer(p.x, p.z);
        SN.doorTarget = null; SN.enterExit();
        assert(SN.carjack && !car.occupant && SN.player.car === car, "劫车动画未启动");
      }],
      [7.6, "wanted-escalation", () => {
        car.speed = car.vx = car.vz = 0; SN.enterExit();
        SN.clearWantedResponse(); SN.heat = 0;
        for (let level = 1; level <= 5; level++) {
          SN.forceWanted(level, "街头警戒"); SN.spawnClock = 0; SN.updateWanted(0.05);
          assert(SN.heat === level, "通缉等级错误");
        }
        assert(SN.helicopter.active && SN.helicopter.rotor && SN.helicopter.spot, "空中支援未就绪");
        SN.updateHelicopter(0.1);
        assert(SN.pursuitCars.some(c => c.active && c.type >= 12), "特警车辆未部署");
      }],
      [8.6, "escape", () => {
        SN.clearWantedResponse();
        for (const a of SN.actors) if (a.kind === "police" && !a.guard) a.active = false;
        SN.heat = 1; SN.searchX = SN.player.x + 250; SN.searchZ = SN.player.z; SN.searchRadius = 60;
        SN.updateWanted(8); assert(SN.heat === 0, "脱离搜索圈未消除通缉");
        SN.player.health = 100; SN.player.armor = 100;
      }],
      [9.2, "damage-fire", () => {
        SN.repairVehicle(car); car.health = 70; SN.updateVehicleDamage(0.2);
        assert(car.body.scale.y > 0.96, "轻微碰撞压扁了车身");
        if (car.hood) assert(Math.abs(car.hood.rotation.x) < 0.02, "轻微碰撞错误掀起车盖");
        car.health = 25; SN.updateVehicleDamage(0.2);
        assert(car.body.scale.y > 0.9, "重伤压扁了车身");
        if (car.hood) assert(car.hood.rotation.x < -0.2, "重伤没有掀起车盖");
        SN.repairVehicle(car); car.health = 18; SN.updateVehicleDamage(0.2);
        assert(car.burnTime > 0 && !car.exploded, "起火状态错误");
        movePlayer(car.x + 25, car.z + 25);
        car.burnTime = 7; SN.updateVehicleDamage(0.1); assert(car.exploded, "车辆没有爆炸");
        SN.repairVehicle(car);
      }],
      [10, "shops-respray", () => {
        const service = SN.streetServices.find(s => s.kind === "repair"); assert(service, "缺少维修点");
        SN.player.car = car; Object.assign(car, { x: service.x, z: service.z, speed: 0, vx: 0, vz: 0, health: 40 });
        SN.player.x = car.x; SN.player.z = car.z; SN.money = 10000;
        SN.counterTarget = { shop: service }; SN.openShopMenu(); SN.buyShopGood("respray");
        assert(car.health === 100 && SN.money === 9650 && SN.heat === 0, "维修结算错误"); SN.closeShopMenu();
        SN.enterExit(); SN.carjack = null;
        const shop = SN.streetServices.find(s => s.kind === "weapons");
        SN.counterTarget = { shop }; SN.openShopMenu(); SN.weapons[4].owned = false; SN.buyShopGood("weapon4");
        assert(SN.weapons[4].owned && SN.weapons[4].mag > 0, "武器购买失败"); SN.closeShopMenu();
      }],
      [11, "mission", () => {
        SN.campaign.active = null; SN.campaign.checkpoint = null; SN.campaign.progress = 0;
        SN.startMission("story", 0); assert(SN.campaign.active && !SN.cinematic, "任务启动失败");
        const target = SN.currentTarget(); assert(target, "任务没有目标"); movePlayer(target.x, target.z);
        SN.interactPulse = true; SN.updateMission(0.1);
        assert(SN.campaign.active.step > 0, "首个任务目标没有推进");
        SN.failMission("路线中断"); assert(SN.campaign.active.status === "failed", "任务失败状态错误");
        SN.campaign.active = null; SN.campaign.checkpoint = null;
      }],
      [12, "overlays", () => {
        SN.toggleCityMap(true); assert(SN.cityMapOpen, "地图未打开"); SN.toggleCityMap(false);
        SN.toggleJournal(true); assert(SN.journalOpen, "日志未打开"); SN.toggleJournal(false);
        SN.openDialogue(SN.contacts[0]); assert(SN.storyDialogue, "对话未打开"); SN.closeDialogue();
        SN.togglePause(true); SN.toggleSettings(); assert(SN.pauseOpen, "暂停未打开"); SN.toggleSettings(); SN.togglePause(false);
        assert(SN.canControl(), "关闭界面后不能控制");
      }],
      [13, "wasted", () => {
        SN.heat = 0; SN.clearWantedResponse(); SN.player.health = 100; SN.player.armor = 0;
        SN.hurtPlayer(120, true); assert(SN.player.dead > 0, "倒下状态未启动");
      }],
      [17.5, "respawn-busted", () => {
        assert(!SN.player.dead && SN.player.health > 0, "医院复活失败");
        const officer = SN.actors.find(a => a.kind === "police");
        SN.forceWanted(1, "街头警戒"); SN.beginArrest(officer); SN.updateArrest(2.6); SN.updateArrest(2);
        assert(!SN.arrestState && SN.heat === 0 && !SN.weapons[1].owned, "拘留结算错误");
      }],
      [20.6, "complete", () => {
        SN.clearInput(); SN.carjack = null; SN.player.car = null; SN.playerRoot.visible = true;
        SN.campaign.active = null; SN.campaign.checkpoint = null; SN.heat = 0; SN.clearWantedResponse();
        SN.money = saved.money; SN.minutes = saved.minutes; SN.player.health = 100; SN.player.armor = 60;
        SN.weapons[1].owned = true; SN.weapons[1].mag = 8; SN.weapons[1].reserve = 16;
        SN.campaign.progress = 0; SN.campaign.jobIndex = 0; SN.campaign.costume = "street"; SN.applyCostume();
        SN.selectedWeapon = 0; SN.holstered = true;
        movePlayer(saved.x, saved.z); SN.camYaw = SN.PI; SN.camPitch = 0.12;
        SN.refreshHUD(); assert(SN.canControl(), "结束后未恢复控制");
      }]
    ] };
    SN.extendMissionSmoke();
    SN.extendFeelSmoke();
    SN.extendMobileSmoke();
    SN.extendLivingSmoke();
    SN.extendReleaseSmoke();
    SN.extendPlayabilitySmoke();
    SN.extendLookSmoke();
    SN.extendModelsSmoke();
    SN.smoke.stages.push(
      [0.72, "m9-storefronts-terrace", () => {
        assert(SN.storefrontTypes.length >= 10 && SN.cityArtStats.storefronts.every(n => n > 0), "十类店面未覆盖城市");
        assert(SN.inMyeong(410, -430) && SN.terrainSlope(410, -430) < 0.02, "明洞步行台地不平整");
        for (const batch of SN.buildingBatches) for (const b of batch) assert(!b.pitch && !b.rx && !b.rz, "建筑发生地形倾斜");
        assert(SN.carColors.includes(0x242d3c) && SN.carColors.includes(0x9daebe), "缺少黑色与银色车漆");
      }],
      [12.38, "m9-camera-overhang-foliage", () => {
        const bins = SN.cameraPropBins;
        try {
          SN.cameraPropBins = new Map();
          SN.registerCameraPart({ x: 0, y: 3.1, z: -4, sx: 8, sy: 0.2, sz: 2 });
          const origin = new SN.T.Vector3(0, 1.4, 0), direction = new SN.T.Vector3(0, 2, -6);
          const distance = direction.length(); direction.normalize();
          assert(SN.cameraPropDistance(origin, direction, distance) < distance - 1, "镜头穿过装饰雨棚");
          origin.x = 8;
          assert(SN.cameraPropDistance(origin, direction, distance) === distance, "雨棚误挡空旷镜头");
          const shader = { uniforms: {}, vertexShader: "#include <uv_vertex>", fragmentShader: "#include <alphatest_fragment>" };
          SN.leafMat.onBeforeCompile(shader);
          assert(shader.uniforms.uFoliageFocus === SN.foliageFocus && shader.fragmentShader.includes("discard"), "树冠未连接局部淡出");
        } finally { SN.cameraPropBins = bins; }
      }],
      [20.18, "m9-radio-toast-ticker", () => {
        const car = SN.player.car, radio = { ...SN.radio }, time = SN.simTime;
        try {
          SN.player.car = SN.loanCar; SN.cycleRadio();
          assert(SN.$("cityRadio").classList.contains("show-station"), "切台提示未显示");
          SN.simTime += 3.1; SN.updateRadio(0);
          assert(!SN.$("cityRadio").classList.contains("show-station"), "切台提示没有在三秒后收起");
          SN.radio.station = 0; SN.radio.newsAt = SN.simTime + 60;
          SN.radio.line = SN.radioLines[0]; SN.radio.lineUntil = SN.simTime + 1; SN.updateRadio(0);
          assert(SN.$("cityRadio").classList.contains("show-news"), "新闻没有显示");
          SN.simTime += 2; SN.updateRadio(0);
          assert(!SN.$("cityRadio").classList.contains("show-news"), "新闻没有淡出");
        } finally { SN.player.car = car; SN.simTime = time; Object.assign(SN.radio, radio); SN.updateRadio(0); }
      }],
      [0.6, "city-art-facades", () => {
        assert(SN.cityArtStats.frontages === SN.placedBuildings.length * 4, "建筑缺少四面店面");
        assert(SN.artAtlasGeos.length === 32 && SN.cityArtStats.signs > 100, "招牌图集或街景缺失");
        assert(SN.cityArtStats.streamSections > 0, "清溪川缺少水道");
        const positions = SN.banpoFountain.geometry.attributes.position.array;
        assert(positions.length > 0 && positions.every(Number.isFinite), "喷泉坐标无效");
        assert(SN.showcaseNames.length >= 8 && ["closeup", "carclose", "slope", "rain"].every(name => SN.showcaseNames.includes(name)), "展示场景缺失");
      }],
      [18.6, "city-art-lighting", () => {
        const minute = SN.minutes;
        for (const value of [630, 1125, 1320]) {
          SN.minutes = value; SN.updateLighting();
          assert(Number.isFinite(SN.night), "昼夜参数无效");
          SN.updateCityArt();
        }
        SN.minutes = minute; SN.updateLighting();
      }],
      [19, "occupied-commission", () => {
        const c = SN.contractCar; SN.placeMissionVehicle(c, -66, -786, 3);
        SN.player.car = c; movePlayer(c.x, c.z);
        const x = SN.player.x, z = SN.player.z;
        SN.placeMissionVehicle(c, 560, 945, 7);
        assert(!SN.player.car && Math.hypot(SN.player.x - x, SN.player.z - z) < 25, "委托车挪动了车内玩家");
      }]
    );
    SN.smoke.stages.push([20.1, "road-continuity", () => {
      const result = SN.auditRoadContinuity();
      assert(result.stepIssues === 0, "道路高差超限：" + result.issues.slice(0, 3).join(" | "));
      assert(result.gradeIssues === 0, "道路坡度超限：" + result.issues.slice(0, 3).join(" | "));
      assert(result.curvatureIssues === 0, "道路坡度变化过大：" + result.issues.slice(0, 3).join(" | "));
      assert(result.jointIssues === 0, "路口或桥头高差：" + result.issues.slice(0, 3).join(" | "));
      assert(SN.slopeShot && Math.abs(SN.slopeShot.grade) > 0.005, "缺少坡度展示路段");
    }]);
    SN.smoke.stages.push([20.2, "road-surface-steps", () => {
      // Walking the centre line of every street and sampling the ground with the
      // height the wheels expect must never find a ledge: a roof, a stair or an
      // overpass deck used to hijack the surface and throw cars into the air.
      let worstUp = 0, worstAt = "", checked = 0;
      for (const road of SN.roads) {
        if (!road.profile || road.length < 8)
          continue;
        let s = 0, prev = null;
        for (let j = 1; j < road.points.length; j++) {
          const a = road.points[j - 1], b = road.points[j];
          const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
          const n = Math.max(1, Math.ceil(len));
          for (let k = 0; k < n; k++) {
            const t = k / n, x = a[0] + dx * t, z = a[1] + dz * t, along = s + len * t;
            if (along > road.length - 0.5) { prev = null; continue; }
            const expected = SN.roadProfileHeight(road.profile, along) + 0.17;
            const h = SN.surfaceHeight(x, z, expected);
            checked++;
            if (prev !== null && h - prev > worstUp) {
              worstUp = h - prev;
              worstAt = road.name + " " + x.toFixed(1) + "," + z.toFixed(1) + " " + prev.toFixed(2) + "→" + h.toFixed(2);
            }
            prev = h;
          }
          s += len;
        }
      }
      assert(checked > 60000, "路面采样不足：" + checked);
      assert(worstUp < 0.45, "路面突然凸起，车会被弹飞：" + worstAt);
      const underBridge = SN.surfaceHeight(-165.2, -199.4, 1.2);
      const underStair = SN.surfaceHeight(-41.7, -278.3, 79.8);
      assert(underBridge < 2.5, "高架桥下的路面被桥面顶起：" + underBridge.toFixed(2));
      assert(underStair < 81, "南山步道盖住了下方车道：" + underStair.toFixed(2));
      console.log("SMOKE road-surface: samples=" + checked + " worstUp=" + worstUp.toFixed(3) + "m at " + worstAt);
    }]);
    SN.smoke.stages.push([20.3, "lawns-dressed", () => {
      const spots = SN.lawnSpots || [];
      assert(spots.length >= 500, "草坪几乎没有设施：" + spots.length);
      let bad = 0;
      for (const s of spots)
        if (SN.onRoadway(s.x, s.z, 3) || SN.isWater(s.x, s.z, 1))
          bad++;
      assert(bad === 0, "草坪设施压在水面或道路上：" + bad);
      assert(SN.benchSpots.length >= 200, "草坪没有可坐的长椅：" + SN.benchSpots.length);
      const mall = SN.cityLandmarks.find(g => Math.hypot(g.position.x - 1760, g.position.z - 1330) < 6);
      assert(mall, "大商场不见了");
      assert(!SN.isWater(1760, 1440) && !SN.onRoadway(1760, 1440), "大商场门前是水或者车道");
      assert(SN.showcaseNames.includes("mall"), "缺少大商场展示镜头");
      console.log("SMOKE lawns: spots=" + spots.length + " benches=" + SN.benchSpots.length);
    }]);
    SN.smoke.stages.push([22.5, "pedestrians-walk", () => {
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      SN.populationClock = 0;
      for (let i = 0; i < 3; i++) SN.updateCityPopulation();
      const civilian = a => a.active && a.kind === "civilian" && !a.inCar && !a.down && !a.interior && !a.missionEnemy && !a.cityEventTag;
      // Earlier fixtures drive actors to mission points and can leave one in the road.
      // Put those back on the pavement before measuring navigation, so the result
      // reflects how the crowd walks rather than where the last test parked it.
      let restored = 0;
      for (const a of SN.actors) {
        if (!civilian(a) || !SN.pedOnCarriageway(a.x, a.z) || SN.pedOnCrosswalk(a.x, a.z, 2.6))
          continue;
        const node = SN.pedNodeNearest(a.x, a.z, 60);
        if (node) {
          Object.assign(a, { x: node.x, z: node.z, mode: "walk", sitting: false, phone: false, chat: false,
            pedNode: node, pedPrev: null, pedTarget: null, pedLink: null, pedWait: 0, pedCrossClear: false, pedCornerStreak: 0 });
        }
        else a.active = false;
        restored++;
      }
      const walkers = SN.actors.filter(a => civilian(a) && a.mode === "walk" && !a.sitting && Math.hypot(a.x - SN.player.x, a.z - SN.player.z) < 95);
      check(walkers.length >= 8, "步行自测样本不足：" + walkers.length);
      const fields = ["active", "x", "z", "yaw", "mode", "modeTimer", "sitting", "sitX", "sitZ", "sitYaw", "phone", "chat",
        "sideYaw", "dirSign", "speed", "walkRange", "phase", "poseDirty", "partner", "lodElapsed", "homeX", "homeZ",
        "hostile", "hostileTimer", "armedWeapon", "meleeOnly", "panic", "flinch", "stumble", "bumpCool", "bumpCount",
        "lastBumpTime", "queueStop", "queueX", "queueZ", "pedNode", "pedPrev", "pedTarget", "pedLink", "pedWait",
        "pedWaitTime", "pedCrossClear", "pedNoCrossUntil", "pedStuckClock", "pedTurnClock", "pedTurnAccum",
        "pedWindowX", "pedWindowZ", "pedFail", "pedDespawn", "inCar", "down", "fall", "health"];
      const savedActors = SN.actors.map(a => {
        const values = {};
        for (const key of fields) values[key] = a[key];
        return { values, x: a.rig.root.position.x, y: a.rig.root.position.y, z: a.rig.root.position.z, visible: a.rig.root.visible,
          motion: { phase: a.rig.motion.phase, gait: a.rig.motion.gait, weight: a.rig.motion.weight, lean: a.rig.motion.lean, speed: a.rig.motion.speed, grounded: a.rig.motion.grounded } };
      });
      const savedWorld = { time: SN.simTime, step: SN.stepCount, clock: SN.populationClock, target: SN.crowdTarget, visible: SN.crowdVisible, boot: SN.crowdBootstrapped };
      const start = walkers.map(a => ({ x: a.x, z: a.z }));
      const turns = walkers.map(() => []), turnSums = walkers.map(() => 0);
      let maxWindow = 0, roadFrames = 0, lastYaw = walkers.map(a => a.yaw), time = SN.simTime;
      try {
        for (let i = 0; i < 600; i++) {
          time += 1 / 30; SN.simTime = time; SN.stepCount++;
          SN.updateActors(1 / 30, time);
          for (let k = 0; k < walkers.length; k++) {
            const a = walkers[k];
            if (!a.active) continue;
            const delta = Math.abs(SN.angleDelta(lastYaw[k], a.yaw));
            lastYaw[k] = a.yaw;
            const window = turns[k];
            window.push(delta);
            turnSums[k] += delta;
            if (window.length > 120) turnSums[k] -= window.shift();
            if (turnSums[k] > maxWindow) maxWindow = turnSums[k];
            if (SN.pedOnCarriageway(a.x, a.z) && !SN.pedOnCrosswalk(a.x, a.z, 2.6)) roadFrames++;
          }
        }
        const alive = walkers.filter(a => a.active && a.kind === "civilian" && !a.inCar);
        check(alive.length >= 8, "步行自测存活样本不足：" + alive.length);
        let moved = 0, netSum = 0, minNet = Infinity;
        for (const a of alive) {
          const index = walkers.indexOf(a), net = Math.hypot(a.x - start[index].x, a.z - start[index].z);
          netSum += net;
          minNet = Math.min(minNet, net);
          if (net > 6) moved++;
        }
        const percent = moved / alive.length * 100;
        const maxDegrees = maxWindow * 180 / Math.PI, meanNet = netSum / alive.length;
        console.log("SMOKE pedestrians: restored=" + restored + " walkers=" + alive.length + " moved6=" + moved + "/" + alive.length + " (" + percent.toFixed(1) + "%) meanNet=" + meanNet.toFixed(1) + "m minNet=" + minNet.toFixed(1) + "m maxTurn4s=" + maxDegrees.toFixed(1) + "° roadFrames=" + roadFrames);
        check(percent >= 80, "行人净位移不足：" + moved + "/" + alive.length + " 超过 6 米");
        check(maxDegrees <= 540, "行人原地打转：" + maxDegrees.toFixed(1) + "° / 4 秒");
        check(roadFrames === 0, "行人走出人行道进入车道：" + roadFrames + " 帧");
      } finally {
        SN.actors.forEach((a, i) => {
          Object.assign(a, savedActors[i].values);
          a.rig.root.position.set(savedActors[i].x, savedActors[i].y, savedActors[i].z);
          a.rig.root.visible = savedActors[i].visible;
          Object.assign(a.rig.motion, savedActors[i].motion);
        });
        SN.simTime = savedWorld.time; SN.stepCount = savedWorld.step; SN.populationClock = savedWorld.clock;
        SN.crowdTarget = savedWorld.target; SN.crowdVisible = savedWorld.visible; SN.crowdBootstrapped = savedWorld.boot;
        SN.indexCrowd();
      }
    }]);
    SN.smoke.stages.push([22.62, "rain-stability", () => {
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      check(SN.wetUniforms && SN.wetUniforms.puddle.value && SN.wetUniforms.ripple.value, "湿路面遮罩未建立");
      check(SN.rainMaterial && SN.rainSplashMesh && SN.wheelSprayMesh, "雨幕或水花系统缺失");
      const renderer = SN.renderer, camera = SN.camera;
      if (!renderer || !camera) return;
      const savedCamera = {
        x: camera.position.x, y: camera.position.y, z: camera.position.z,
        qx: camera.quaternion.x, qy: camera.quaternion.y, qz: camera.quaternion.z, qw: camera.quaternion.w,
        fov: camera.fov, aspect: camera.aspect
      };
      const savedWeather = {
        kind: SN.weather.kind, intensity: SN.weather.intensity,
        wetTarget: SN.wetTarget, wetness: SN.wetness, wetMode: SN.wetMode,
        wetTime: SN.wetUniforms.time.value
      };
      const savedPlayer = { x: SN.player.x, y: SN.player.y, z: SN.player.z };
      const hidden = [];
      const hide = object => { if (object && object.visible) { hidden.push(object); object.visible = false; } };
      const target = new SN.T.WebGLRenderTarget(96, 64, {
        minFilter: SN.T.LinearFilter, magFilter: SN.T.LinearFilter,
        format: SN.T.RGBAFormat, depthBuffer: true, stencilBuffer: false
      });
      target.texture.encoding = SN.T.sRGBEncoding;
      const pixels = new Uint8Array(24 * 12 * 4), means = [];
      const previousTarget = renderer.getRenderTarget();
      try {
        SN.weather.kind = "rain"; SN.weather.intensity = 1;
        SN.wetTarget = 1; SN.wetness = 1; SN.wetMode = true;
        SN.wetUniforms.wet.value = 1;
        hide(SN.rainMesh); hide(SN.snowMesh); hide(SN.rainSplashMesh); hide(SN.wheelSprayMesh);
        hide(SN.playerRoot); hide(SN.contactShadows); hide(SN.skidMesh); hide(SN.debrisMesh); hide(SN.cornerSmoke);
        for (const mesh of SN.umbrellaMeshes || []) hide(mesh);
        for (const mesh of SN.animalMeshes || []) hide(mesh);
        for (const car of SN.cars) hide(car.root);
        for (const actor of SN.actors) hide(actor.rig.root);
        const x = 210, z = 1066, y = SN.surfaceHeight(x, z);
        Object.assign(SN.player, { x, z, y });
        camera.position.set(x - 4, y + 1.25, z);
        camera.lookAt(x + 22, y + 0.12, z);
        camera.updateMatrixWorld(true);
        // The targeted avenue may be outside the last streamed block during the walk test.
        for (let pass = 0; pass < 18; pass++) SN.streamCity(true);
        renderer.setRenderTarget(target);
        renderer.render(SN.scene, camera);
        renderer.render(SN.scene, camera);
        for (let frame = 0; frame < 120; frame++) {
          SN.wetUniforms.time.value = frame * 0.12;
          renderer.setRenderTarget(target);
          renderer.render(SN.scene, camera);
          renderer.readRenderTargetPixels(target, 36, 8, 24, 12, pixels);
          let sum = 0;
          for (let i = 0; i < pixels.length; i += 4)
            sum += (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
          means.push(sum / (pixels.length / 4));
        }
        renderer.setRenderTarget(previousTarget);
        const mean = means.reduce((a, b) => a + b, 0) / means.length;
        let variance = 0, maxDelta = 0, sumDelta = 0;
        for (let i = 0; i < means.length; i++) {
          variance += (means[i] - mean) ** 2;
          if (i > 0) {
            const delta = Math.abs(means[i] - means[i - 1]);
            sumDelta += delta;
            maxDelta = Math.max(maxDelta, delta);
          }
        }
        variance /= means.length;
        const meanDelta = sumDelta / (means.length - 1);
        console.log("SMOKE rain: frames=" + means.length + " mean=" + mean.toFixed(4) + " variance=" + variance.toExponential(2) +
          " meanDelta=" + (meanDelta * 255).toFixed(3) + "/255 maxDelta=" + (maxDelta * 255).toFixed(3) + "/255");
        check(mean > 0.008 && mean < 0.85, "取样区域没有湿路面");
        check(variance < 1e-5, "湿路面亮度方差过大");
        check(maxDelta * 255 < 3, "湿路面帧间闪烁超限");
      } finally {
        for (const object of hidden) object.visible = true;
        renderer.setRenderTarget(previousTarget);
        target.dispose();
        camera.position.set(savedCamera.x, savedCamera.y, savedCamera.z);
        camera.quaternion.set(savedCamera.qx, savedCamera.qy, savedCamera.qz, savedCamera.qw);
        camera.fov = savedCamera.fov; camera.aspect = savedCamera.aspect;
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        Object.assign(SN.weather, { kind: savedWeather.kind, intensity: savedWeather.intensity });
        SN.wetTarget = savedWeather.wetTarget; SN.wetness = savedWeather.wetness; SN.wetMode = savedWeather.wetMode;
        SN.wetUniforms.wet.value = savedWeather.wetness;
        SN.wetUniforms.time.value = savedWeather.wetTime;
        Object.assign(SN.player, savedPlayer);
        SN.snapPlayer();
      }
    }]);
    SN.smoke.stages.sort((a, b) => a[0] - b[0]);
  };

  SN.updateSmoke = function updateSmoke() {
    const s = SN.smoke;
    if (!s || s.index >= s.stages.length) return;
    const stage = s.stages[s.index];
    if (SN.simTime - s.start < stage[0]) return;
    s.index++;
    try { stage[2](); s.passed++; console.log("SMOKE stage " + stage[1] + " ok"); }
    catch (error) { s.failed++; console.error("SMOKE stage " + stage[1] + " failed: " + (error.message || String(error))); SN.clearInput(); }
    if (s.index === s.stages.length) console.log("SMOKE summary: " + s.passed + " stages ok, " + s.failed + " failed");
  };

  SN.extendModelsSmoke = function extendModelsSmoke() {
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const readyToTest = () => !!(SN.models && SN.T && SN.T.GLTFLoader &&
      window.location && /^https?:$/.test(window.location.protocol));
    const skip = name => console.log("SMOKE stage " + name + " skipped: model assets need http(s)");
    const garmentSkin = (() => {
      const component = (attribute, index, slot) => slot === 0 ? attribute.getX(index) :
        slot === 1 ? attribute.getY(index) : slot === 2 ? attribute.getZ(index) : attribute.getW(index);
      const matrix = new SN.T.Matrix4(), bind = new SN.T.Vector3(), part = new SN.T.Vector3(), out = new SN.T.Vector3();
      const skinned = (mesh, geometry, index) => {
        const skeleton = mesh.skeleton;
        bind.fromBufferAttribute(geometry.attributes.position, index).applyMatrix4(mesh.bindMatrix);
        out.set(0, 0, 0);
        for (let slot = 0; slot < 4; slot++) {
          const weight = component(geometry.attributes.skinWeight, index, slot);
          if (!(weight > 0)) continue;
          const boneIndex = component(geometry.attributes.skinIndex, index, slot);
          if (!skeleton.bones[boneIndex]) continue;
          matrix.multiplyMatrices(skeleton.bones[boneIndex].matrixWorld, skeleton.boneInverses[boneIndex]);
          part.copy(bind).applyMatrix4(matrix).multiplyScalar(weight);
          out.add(part);
        }
        out.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);
        return out.clone();
      };
      const weightsOk = mesh => {
        const skinIndex = mesh.geometry.attributes.skinIndex, skinWeight = mesh.geometry.attributes.skinWeight;
        if (!skinIndex || !skinWeight) return 1;
        let bad = 0;
        for (let i = 0; i < skinWeight.count; i++) {
          let total = 0;
          for (let slot = 0; slot < 4; slot++) {
            const index = component(skinIndex, i, slot), weight = component(skinWeight, i, slot);
            if (!Number.isFinite(weight) || weight < 0 || index >= mesh.skeleton.bones.length) { total = -1; break; }
            total += weight;
          }
          if (!(total > 0.999 && total < 1.001)) bad++;
        }
        return bad;
      };
      const poseIdle = agent => {
        const clip = SN.models.clips.Idle_Loop;
        if (!clip || !agent.mixer) return false;
        const action = agent.actions.Idle_Loop || agent.mixer.clipAction(clip);
        for (const name of Object.keys(agent.actions)) if (agent.actions[name] !== action) agent.actions[name].stop();
        if (agent.action && agent.action !== action) agent.action.stop();
        action.reset();
        action.setLoop(SN.T.LoopRepeat, Infinity);
        action.setEffectiveWeight(1);
        action.enabled = true;
        action.play();
        agent.actions.Idle_Loop = action;
        agent.action = action;
        agent.actionName = "Idle_Loop";
        agent.mixer.update(1);
        agent.root.updateMatrixWorld(true);
        return true;
      };
      const boneAt = (agent, name) => {
        const bone = agent.body && agent.body.skeleton && agent.body.skeleton.bones.find(item => item.name === name);
        if (!bone) return null;
        const world = new SN.T.Vector3();
        bone.getWorldPosition(world);
        return world;
      };
      const segmentDistance = (point, a, b) => {
        const ab = new SN.T.Vector3().subVectors(b, a);
        const t = SN.clamp(new SN.T.Vector3().subVectors(point, a).dot(ab) / Math.max(1e-8, ab.lengthSq()), 0, 1);
        return point.distanceTo(new SN.T.Vector3().copy(a).addScaledVector(ab, t));
      };
      return { skinned, weightsOk, poseIdle, boneAt, segmentDistance };
    })();
    SN.smoke.stages.push(
      [22.7, "m17-model-assets", () => {
        if (!readyToTest()) { skip("m17-model-assets"); return; }
        const M = SN.models;
        check(M.ready && M.peopleReady && M.animReady && M.carReady, "人物、动画或车辆模型未全部就绪");
        check(M.errors === 0, "有模型文件加载失败：" + M.errors);
        check(Object.keys(M.outfits).length >= 12, "服装预设少于 12 套");
        check(Object.keys(M.hair).length >= 5, "发型资源不足");
        for (const sex of ["male", "female"]) check(M.skinMaps[sex] && M.skinMaps[sex].dark && M.skinMaps[sex].light, sex + " 肤色贴图缺失");
        for (const clip of ["Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Driving_Loop", "Death01", "Pistol_Shoot"]) check(M.clips[clip], "缺少动画 " + clip);
        for (const key of ["taxi", "police", "pickup", "suv", "sports1"]) check(M.carPrototypes[key], "缺少车辆模型 " + key);
        const player = M.playerAgent;
        check(player && player.body && player.body.isSkinnedMesh, "玩家未使用骨骼模型");
        check(player.mixer && player.actions, "玩家动画混合器缺失");
        check(M.outfits[M.playerOutfitId], "玩家服装编号无效 " + M.playerOutfitId);
        check(player.body.material && player.body.material.userData.clothUniforms, "玩家身体没有服装遮罩");
        check(M.agents.length >= 12, "行人模型池不足");
        console.log("SMOKE m17 assets: outfits=" + Object.keys(M.outfits).length + " hair=" + Object.keys(M.hair).length + " clips=" + Object.keys(M.clips).length + " cars=" + Object.keys(M.carPrototypes).length);
      }],
      [22.74, "m17-model-pedestrians", () => {
        if (!readyToTest()) { skip("m17-model-pedestrians"); return; }
        const M = SN.models, staged = [];
        const savedQuality = SN.quality.mode;
        const savedPlayer = {
          car: SN.player.car, motionSpeed: SN.player.motionSpeed, gait: SN.player.gait,
          dead: SN.player.dead, hitReact: SN.player.hitReact, swimming: SN.player.swimming,
          bail: SN.player.bail, vault: SN.player.vault, grounded: SN.player.grounded,
          reloadTime: SN.reloadTime, attackTime: SN.attackTime, firing: SN.firing, aiming: SN.aiming
        };
        try {
          const choices = SN.actors.filter(a => a.rig && a.rig.profile && !a.inCar && !a.interior && a.health > 0).slice(0, 6);
          check(choices.length >= 6, "可用行人不足");
          const archetypes = ["office", "student", "tourist", "elder", "delivery", "vendor"];
          for (let i = 0; i < choices.length; i++) {
            const a = choices[i], profile = a.rig.profile;
            staged.push({ actor: a, active: a.active, x: a.x, z: a.z, yaw: a.yaw, archetype: a.archetype, men: profile.men, health: a.health, down: a.down, fall: a.fall });
            a.active = true; a.inCar = false; a.interior = false; a.down = 0; a.health = 100;
            a.x = SN.player.x + 1.3 + i * 0.55; a.z = SN.player.z + 1.6; a.yaw = SN.PI;
            a.archetype = archetypes[i]; profile.men = i >= 3;
          }
          SN.quality.mode = "高";
          M.refreshAssignments(true);
          const agents = M.agents.filter(agent => agent.source && staged.some(item => item.actor === agent.source));
          check(agents.length >= 5, "近处行人的骨骼模型少于 5 个");
          check(new Set(agents.map(agent => agent.outfitId)).size >= 3, "行人服装过于单一");
          for (const agent of agents) {
            check(agent.body && agent.body.isSkinnedMesh, "行人未使用骨骼网格");
            check(agent.mixer && agent.action, "行人动画未启动");
            check(M.outfits[agent.outfitId], "行人服装编号无效");
            check(agent.body.material && agent.body.material.userData.clothUniforms, "行人身体没有服装遮罩");
          }
          SN.player.car = null; SN.player.dead = 0; SN.player.hitReact = 0;
          SN.player.swimming = false; SN.player.bail = false; SN.player.vault = false; SN.player.grounded = true;
          SN.reloadTime = 0; SN.attackTime = 0; SN.firing = false; SN.aiming = false;
          SN.player.motionSpeed = 1.2; SN.player.gait = 1; M.update(0.016);
          check(M.playerAgent.actionName === "Jog_Fwd_Loop" && M.playerAgent.action.isRunning(), "慢跑动画未播放");
          SN.player.motionSpeed = 0.7; SN.player.gait = 0; M.update(0.016);
          check(M.playerAgent.actionName === "Walk_Loop" && M.playerAgent.action.isRunning(), "行走动画未播放");
          SN.player.motionSpeed = 0; SN.player.car = SN.eventCars[0]; M.update(0.016);
          check(M.playerAgent.actionName === "Driving_Loop" && M.playerAgent.action.isRunning(), "驾驶动画未播放");
          console.log("SMOKE m17 pedestrians: agents=" + agents.length + " outfits=" + new Set(agents.map(agent => agent.outfitId)).size);
        } finally {
          SN.player.car = savedPlayer.car; SN.player.motionSpeed = savedPlayer.motionSpeed; SN.player.gait = savedPlayer.gait;
          SN.player.dead = savedPlayer.dead; SN.player.hitReact = savedPlayer.hitReact; SN.player.swimming = savedPlayer.swimming;
          SN.player.bail = savedPlayer.bail; SN.player.vault = savedPlayer.vault; SN.player.grounded = savedPlayer.grounded;
          SN.reloadTime = savedPlayer.reloadTime; SN.attackTime = savedPlayer.attackTime; SN.firing = savedPlayer.firing; SN.aiming = savedPlayer.aiming;
          for (const item of staged) {
            item.actor.active = item.active; item.actor.x = item.x; item.actor.z = item.z; item.actor.yaw = item.yaw;
            item.actor.archetype = item.archetype; item.actor.rig.profile.men = item.men;
            item.actor.health = item.health; item.actor.down = item.down; item.actor.fall = item.fall;
          }
          SN.quality.mode = savedQuality;
          M.refreshAssignments(true);
        }
      }],
      [22.78, "m17-model-vehicles", () => {
        if (!readyToTest()) { skip("m17-model-vehicles"); return; }
        const M = SN.models;
        const modeled = SN.cars.filter(car => car.modelKey);
        const active = modeled.filter(car => car.active);
        const keys = new Set(modeled.map(car => car.modelKey));
        check(modeled.length >= 5 && keys.size >= 3, "街上的车辆模型少于 3 种");
        check(active.length >= 3, "行驶中的模型车辆不足");
        for (const car of modeled) {
          const proto = M.carPrototypes[car.modelKey];
          const glassNeeded = proto && proto.glass ? 1 : 0;
          check(car.modelRoot && car.modelRoot.parent === car.body,
            "车辆模型未挂接：" + car.type + "/" + car.modelKey + "/" + (car.modelRoot && car.modelRoot.parent ? car.modelRoot.parent.name || car.modelRoot.parent.type : "null") + "/" + (car.body ? car.body.name || car.body.type : "nobody"));
          check(car.modelPaint && car.modelGlass.length >= glassNeeded && car.modelWheels.length >= 3, "车辆材质、玻璃或车轮缺失");
        }
        const taxi = SN.cars.find(car => car.type === 3 && car.modelKey === "taxi");
        check(taxi && taxi.modelPaint.color.getHex() === SN.srgb(0xff7a16).getHex(), "出租车不是橙色");
        check(M.carPrototypes.pickup && M.carPrototypes.police && M.carPrototypes.taxi, "缺少出租车、警车或皮卡原型");
        check(modeled.every(car => car.modelWheels.every(wheel => wheel.spin && wheel.pivot)), "车轮转向节点不完整");
        console.log("SMOKE m17 vehicles: modeled=" + modeled.length + " active=" + active.length + " types=" + Array.from(keys).join(","));
      }],
      [22.82, "m17-model-perf-budget", () => {
        if (!SN.renderer || !SN.renderer.info) { console.log("SMOKE m17 perf: offline drawing substitute"); return; }
        const draws = SN.perf.calls, tris = SN.perf.triangles, stats = SN.models && SN.models.stats;
        console.log("SMOKE m17 perf: draws=" + draws + " tris=" + tris + " agents=" + (stats ? stats.agents : "?") + " cars=" + (stats ? stats.cars : "?"));
        check(Number.isFinite(draws) && Number.isFinite(tris) && draws > 0 && tris > 0, "性能计数器无有效帧");
        check(draws <= 520 && tris <= 900000, "模型版超过 520 次绘制 / 90 万三角面预算：draws=" + draws + " tris=" + tris);
        if (stats) {
          check(stats.agents <= SN.models.maxAgents, "同屏骨骼行人超过上限");
          check(stats.cars >= 3, "模型车辆统计不足");
        }
      }],
      [22.86, "m18-clothing-shells", () => {
        if (!readyToTest()) { skip("m18-clothing-shells"); return; }
        const M = SN.models;
        check(M.runtimeReady && M.playerAgent, "骨骼人物尚未就绪");
        const dressCode = (agent, label) => {
          check(agent.body && agent.body.isSkinnedMesh, label + "身体不是骨骼网格");
          check(agent.body.material && agent.body.material.userData.skinCover, label + "身体未使用遮挡材质");
          const uniforms = agent.body.material.userData.clothUniforms;
          check(uniforms && uniforms.uTopColor && uniforms.uBottomColor, label + "缺少服装颜色参数");
          check(agent.garmentsEnabled && agent.garmentKeys, label + "没有启用服装外壳");
          check(agent.garments && agent.garments.top && agent.garments.bottom && agent.garments.shoes,
            label + "缺少上衣、下装或鞋");
          for (const part of ["top", "bottom", "shoes"]) {
            const mesh = agent.garments[part];
            check(mesh && mesh.geometry, label + "服装网格缺失 " + part);
            const attributes = mesh.geometry.attributes;
            check(attributes.position && attributes.position.count > 60, label + "服装网格过小 " + part);
            check(attributes.uv && attributes.skinIndex && attributes.skinWeight, label + "服装缺少贴图坐标或骨骼权重 " + part);
            check(mesh.isSkinnedMesh && mesh.skeleton === agent.body.skeleton, label + "服装未绑定同一骨架 " + part);
            check(mesh.geometry.boundingSphere && Number.isFinite(mesh.geometry.boundingSphere.radius), label + "服装包围球无效 " + part);
          }
          check(agent.garmentTris && agent.garmentTris.top > 0 && agent.garmentTris.bottom > 0 && agent.garmentTris.shoes > 0,
            label + "服装三角面统计缺失");
        };
        dressCode(M.playerAgent, "玩家");
        const staged = [];
        const savedQuality = SN.quality.mode;
        try {
          const choices = SN.actors.filter(a => a.kind === "civilian" && a.rig && a.rig.profile &&
            !a.inCar && !a.interior && !a.missionEnemy && a.health > 0).slice(0, 3);
          check(choices.length >= 3, "可用行人样本不足");
          const archetypes = ["office", "delivery", "student"];
          for (let i = 0; i < choices.length; i++) {
            const a = choices[i], profile = a.rig.profile;
            staged.push({ actor: a, active: a.active, x: a.x, z: a.z, yaw: a.yaw, archetype: a.archetype,
              men: profile.men, health: a.health, down: a.down, fall: a.fall });
            a.active = true; a.inCar = false; a.interior = false; a.down = 0; a.health = 100;
            a.x = SN.player.x + 1.2 + i * 0.6; a.z = SN.player.z + 1.7; a.yaw = SN.PI;
            a.archetype = archetypes[i]; profile.men = i !== 1;
          }
          M.refreshAssignments(true);
          const agents = M.agents.filter(agent => agent.source && choices.indexOf(agent.source) >= 0);
          check(agents.length >= 3, "行人服装外壳未分配：" + agents.length);
          for (const agent of agents) dressCode(agent, "行人");
          const outfits = new Set(agents.map(agent => agent.outfitId));
          outfits.add(M.playerAgent.outfitId);
          check(outfits.size >= 3, "近处人物服装过于单一");
          const body = M.playerAgent.body.geometry, maskA = body.attributes.aClothA, maskB = body.attributes.aClothB;
          check(maskA && maskB, "身体缺少服装分类属性");
          let torso = 0, legs = 0;
          for (let i = 0; i < maskA.count; i++) {
            if (maskA.getX(i) > 0.9) torso += 1;
            if (maskB.getX(i) + maskB.getY(i) > 0.9) legs += 1;
          }
          check(torso > 100 && legs > 100, "服装覆盖分类为空：" + torso + "/" + legs);
          const shader = { uniforms: {}, vertexShader: "#include <begin_vertex>", fragmentShader: "#include <clipping_planes_fragment>" };
          M.playerAgent.body.material.onBeforeCompile(shader);
          check(/vClothA/.test(shader.vertexShader) && /vClothB/.test(shader.vertexShader), "服装遮罩顶点数据未注入");
          check(/vClothA/.test(shader.fragmentShader) && /discard/.test(shader.fragmentShader), "被服装覆盖的皮肤没有丢弃");
          for (const sex of ["male", "female"]) {
            const stats = M.garmentStats[sex];
            check(stats && stats.high, sex + " 服装三角面统计缺失");
            check(stats.high.topLong > 120 && stats.high.pants > 120 && stats.high.shoes > 60, sex + " 高模服装三角面不足");
          }
          console.log("SMOKE m18 shells: agents=" + agents.length + " outfits=" + outfits.size +
            " playerTris=" + JSON.stringify(M.playerAgent.garmentTris) +
            " male=" + JSON.stringify(M.garmentStats.male.high) + " female=" + JSON.stringify(M.garmentStats.female.high));
        } finally {
          for (const item of staged) {
            item.actor.active = item.active; item.actor.x = item.x; item.actor.z = item.z; item.actor.yaw = item.yaw;
            item.actor.archetype = item.archetype; item.actor.rig.profile.men = item.men;
            item.actor.health = item.health; item.actor.down = item.down; item.actor.fall = item.fall;
          }
          SN.quality.mode = savedQuality;
          M.refreshAssignments(true);
        }
      }],
      [22.9, "m18-clothing-outfits", () => {
        if (!readyToTest()) { skip("m18-clothing-outfits"); return; }
        const M = SN.models;
        check(Object.keys(M.outfits).length >= 16, "服装预设少于 16 套：" + Object.keys(M.outfits).length);
        for (const id of ["delivery", "jogger", "player-street"]) check(M.outfits[id], "缺少展示服装 " + id);
        check(new Set(["delivery", "jogger", "player-street"]).size === 3, "特写人物服装编号重复");
        check(M.clips.Idle_Loop, "缺少待机动画 Idle_Loop");
        check(M.playerAgent.fingerCurl.length >= 18, "手指放松骨骼不足：" + M.playerAgent.fingerCurl.length);
        const saved = {
          car: SN.player.car, motionSpeed: SN.player.motionSpeed, gait: SN.player.gait,
          dead: SN.player.dead, hitReact: SN.player.hitReact, swimming: SN.player.swimming,
          bail: SN.player.bail, vault: SN.player.vault, grounded: SN.player.grounded
        };
        try {
          SN.player.car = null; SN.player.dead = 0; SN.player.hitReact = 0; SN.player.swimming = false;
          SN.player.bail = false; SN.player.vault = false; SN.player.grounded = true;
          SN.player.motionSpeed = 0; SN.player.gait = 0;
          M.update(0.016);
          check(M.playerAgent.actionName === "Idle_Loop" && M.playerAgent.action.isRunning(), "待机没有播放 Idle_Loop");
        } finally {
          Object.assign(SN.player, saved);
        }
        const framing = SN.closeupFraming, visibleHeight = 2 * framing.distance * Math.tan(framing.fov * Math.PI / 360);
        check(framing.fov === 44 && framing.distance >= 3, "特写镜头过近");
        check(visibleHeight >= 2.5, "特写镜头容纳不下全身：" + visibleHeight.toFixed(2));
        console.log("SMOKE m18 outfits: presets=" + Object.keys(M.outfits).length + " closeupHeight=" + visibleHeight.toFixed(2) +
          " fingerBones=" + M.playerAgent.fingerCurl.length);
      }],
      [22.94, "m18-pedestrian-pavements", () => {
        if (!readyToTest()) { skip("m18-pedestrian-pavements"); return; }
        const scenes = [["drive", 210, 1066], ["mission", -150, -634]];
        for (const [name, x, z] of scenes) {
          let found = 0, pavement = 0;
          for (let n = 0; n < 12; n++) {
            const spot = SN.showcasePedestrianSpot(name, x, z, SN.PI / 2, n, 12);
            if (!spot) continue;
            found += 1;
            check(Number.isFinite(spot.x) && Number.isFinite(spot.z), name + " 行人落点无效");
            check(!SN.pedOnCarriageway(spot.x, spot.z), name + " 行人站在车道 " + n);
            if (spot.pavement) pavement += 1;
          }
          check(found >= 8, name + " 可用行人落点不足：" + found);
          check(pavement >= 6, name + " 行人没有站上人行道：" + pavement);
        }
        console.log("SMOKE m18 pavements: drive/mission staged only on sidewalks");
      }],
      [23.0, "m19-sleeve-skinning", () => {
        if (!readyToTest()) { skip("m19-sleeve-skinning"); return; }
        const M = SN.models, agent = M.playerAgent, probe = garmentSkin;
        check(M.runtimeReady && agent && agent.body && agent.body.isSkinnedMesh, "玩家骨骼模型尚未就绪");
        check(M.clips.Idle_Loop, "缺少待机动画 Idle_Loop");
        const top = agent.garments && agent.garments.top;
        check(top && top.isSkinnedMesh && top.skeleton === agent.body.skeleton, "上衣未绑定玩家骨架");
        check(agent.garmentsEnabled && agent.garmentKeys, "玩家没有启用服装外壳");
        for (const part of ["top", "bottom", "shoes"])
          check(agent.garments[part] && agent.garments[part].material && agent.garments[part].material.skinning === true,
            "服装材质没有开启蒙皮 " + part);
        check(agent.farGarment && agent.farGarment.material, "远距离服装网格缺失");
        const farMaterials = Array.isArray(agent.farGarment.material) ? agent.farGarment.material : [agent.farGarment.material];
        for (const material of farMaterials) check(material && material.skinning === true, "远距离服装材质没有开启蒙皮");
        const badWeights = probe.weightsOk(top);
        check(badWeights === 0, "上衣有 " + badWeights + " 个顶点的蒙皮权重无效");
        const meta = top.geometry.userData;
        check(meta && meta.cuffs && meta.cuffs.length === 2, "袖子袖口标记缺失");
        const position = top.geometry.attributes.position;
        for (const cuff of meta.cuffs) {
          let inner = 0;
          for (let i = 0; i < position.count; i++) {
            const dx = (position.getX(i) - cuff.x) * cuff.side;
            if (dx < -0.024 || dx > -0.004) continue;
            const dy = position.getY(i) - cuff.y, dz = position.getZ(i) - cuff.z;
            if (Math.sqrt(dy * dy + dz * dz) < cuff.radius * 0.85) inner++;
          }
          check(inner >= 6, "袖口没有封口：" + inner);
        }
        const proto = M.prototypes[agent.sex];
        if (agent.garmentKeys.top === "topLong" && proto && proto.bones && proto.bones.hand_l) {
          const wristX = Math.abs(proto.bones.hand_l.x);
          for (const cuff of meta.cuffs)
            check(Math.abs(Math.abs(cuff.x) - wristX) < 0.05, "长袖没有在手腕收口：" + Math.abs(cuff.x).toFixed(3));
          // "手没接在身子上"：袖口必须贴着手腕，不能是一只套在手腕外面的喇叭。
          // 独立量一遍手腕处皮肤的真实半径（绑定空间，不受动画影响），
          // 再看袖口半径比它大多少；2.2 cm 以内算接上，小于 3 mm 算勒进肉里。
          const bodyGeo = agent.body.geometry, bodyPos = bodyGeo.attributes.position;
          const lower = proto.bones.lowerarm_l, hand = proto.bones.hand_l;
          const ax = hand.x - lower.x, ay = hand.y - lower.y, az = hand.z - lower.z;
          const axLen2 = Math.max(1e-6, ax * ax + ay * ay + az * az);
          const armRadii = [];
          let bodyY = 0, bodyZ = 0;
          for (let i = 0; i < bodyPos.count; i++) {
            const px = Math.abs(bodyPos.getX(i)), py = bodyPos.getY(i), pz = bodyPos.getZ(i);
            const t = ((px - lower.x) * ax + (py - lower.y) * ay + (pz - lower.z) * az) / axLen2;
            if (t < 0.9 || t > 0.99) continue;
            const cx = lower.x + ax * t, cy = lower.y + ay * t, cz = lower.z + az * t;
            armRadii.push(Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy) + (pz - cz) * (pz - cz)));
            bodyY += py; bodyZ += pz;
          }
          check(armRadii.length >= 20, "手腕皮肤采样不足：" + armRadii.length);
          armRadii.sort((a, b) => a - b);
          const armRadius = armRadii[Math.floor((armRadii.length - 1) * 0.5)];
          bodyY /= armRadii.length; bodyZ /= armRadii.length;
          let worstEase = 0, worstCenter = 0;
          for (const cuff of meta.cuffs) {
            const ease = cuff.radius - armRadius;
            worstEase = Math.max(worstEase, ease);
            // The cuff has to sit on the arm as well as be narrow: a small ring
            // hanging beside the wrist still reads as a detached hand.
            let n = 0, cy = 0, cz = 0;
            for (let i = 0; i < position.count; i++) {
              const dx = (position.getX(i) - cuff.x) * cuff.side;
              if (dx < 0.012 || dx > 0.03) continue;
              cy += position.getY(i); cz += position.getZ(i); n++;
            }
            check(n >= 6, "袖口外沿采样不足：" + n);
            const centerOffset = n ? Math.hypot(cy / n - bodyY, cz / n - bodyZ) : 0;
            worstCenter = Math.max(worstCenter, centerOffset);
            check(ease <= 0.012, "袖口离手腕太远（手像断开了）：" + ease.toFixed(3) + " m");
            check(ease >= 0.002, "袖口勒进手腕：" + ease.toFixed(3) + " m");
            check(centerOffset <= 0.006, "袖口没有对准手腕：" + centerOffset.toFixed(3) + " m");
            // 手腕处皮肤必须整个待在袖口里面。之前内折圈比手臂最粗处小 7 mm，
            // 皮肤在袖口边缘穿出一圈锯齿，看上去就像手是贴上去的。
            let skinMax = 0;
            for (let i = 0; i < bodyPos.count; i++) {
              const dx = Math.abs(bodyPos.getX(i)) - Math.abs(cuff.x);
              if (dx < -0.008 || dx > 0.006) continue;
              const dy = bodyPos.getY(i) - cuff.y, dz = bodyPos.getZ(i) - cuff.z;
              skinMax = Math.max(skinMax, Math.hypot(dy, dz));
            }
            check(skinMax <= cuff.radius + 0.001, "手腕皮肤穿出袖口：" + skinMax.toFixed(3) +
              " / 袖口 " + cuff.radius.toFixed(3) + " m");
          }
          const uniforms = agent.body.material && agent.body.material.userData &&
            agent.body.material.userData.clothUniforms;
          if (uniforms && uniforms.uSleeveLowerX) {
            for (const cuff of meta.cuffs)
              check(Math.abs(Math.abs(cuff.x) - uniforms.uSleeveLowerX.value) <= 0.012,
                "皮肤遮罩边界与袖口不一致：" + uniforms.uSleeveLowerX.value.toFixed(3) +
                " 对 " + Math.abs(cuff.x).toFixed(3));
          }
          console.log("SMOKE m19 wrist: cuffEase=" + worstEase.toFixed(4) + "m center=" +
            worstCenter.toFixed(4) + "m armRadius=" + armRadius.toFixed(4) + "m samples=" + armRadii.length);
        }
        const savedPlayer = {
          car: SN.player.car, motionSpeed: SN.player.motionSpeed, gait: SN.player.gait,
          dead: SN.player.dead, hitReact: SN.player.hitReact, swimming: SN.player.swimming,
          bail: SN.player.bail, vault: SN.player.vault, grounded: SN.player.grounded, health: SN.player.health
        };
        const savedCombat = { reloadTime: SN.reloadTime, attackTime: SN.attackTime, firing: SN.firing, aiming: SN.aiming };
        try {
          SN.player.car = null; SN.player.dead = 0; SN.player.hitReact = 0; SN.player.swimming = false;
          SN.player.bail = false; SN.player.vault = false; SN.player.grounded = true; SN.player.health = 100;
          SN.reloadTime = 0; SN.attackTime = 0; SN.firing = false; SN.aiming = false;
          SN.player.motionSpeed = 0; SN.player.gait = 0;
          M.update(0.016);
          check(agent.actionName === "Idle_Loop", "玩家没有进入待机动画");
          check(probe.poseIdle(agent), "无法播放待机动画");
          let maxArm = 0, lifted = 0, moved = 0, samples = 0;
          for (const cuff of meta.cuffs) {
            const suffix = cuff.side > 0 ? "_l" : "_r";
            const shoulder = probe.boneAt(agent, "upperarm" + suffix);
            const elbow = probe.boneAt(agent, "lowerarm" + suffix);
            const wrist = probe.boneAt(agent, "hand" + suffix);
            check(shoulder && elbow && wrist, "手臂骨骼缺失 " + suffix);
            for (const index of cuff.indices) {
              const point = probe.skinned(top, top.geometry, index);
              maxArm = Math.max(maxArm, Math.min(probe.segmentDistance(point, shoulder, elbow), probe.segmentDistance(point, elbow, wrist)));
              if (point.y > shoulder.y + 0.03) lifted++;
              const rest = new SN.T.Vector3().fromBufferAttribute(position, index).applyMatrix4(top.matrixWorld);
              moved = Math.max(moved, rest.distanceTo(point));
              samples++;
            }
          }
          check(samples >= 6, "袖口顶点采样不足");
          check(maxArm <= 0.25, "袖口偏离手臂 " + maxArm.toFixed(3) + " m");
          check(lifted === 0, "袖口高于肩关节：" + lifted + " 个样本");
          check(moved > 0.06, "袖口没有随待机动画变形：" + moved.toFixed(3) + " m");
          console.log("SMOKE m19 sleeves: samples=" + samples + " cuffMax=" + maxArm.toFixed(3) +
            "m movement=" + moved.toFixed(3) + "m");
        } finally {
          Object.assign(SN.player, savedPlayer);
          SN.reloadTime = savedCombat.reloadTime; SN.attackTime = savedCombat.attackTime;
          SN.firing = savedCombat.firing; SN.aiming = savedCombat.aiming;
        }
      }],
      [23.04, "m19-hem-hat-skinning", () => {
        if (!readyToTest()) { skip("m19-hem-hat-skinning"); return; }
        const M = SN.models, probe = garmentSkin;
        check(M.runtimeReady && M.clips.Idle_Loop, "骨骼人物或待机动画尚未就绪");
        const staged = [];
        const savedQuality = SN.quality.mode;
        try {
          const actor = SN.actors.find(a => a.kind === "civilian" && a.rig && a.rig.profile &&
            !a.inCar && !a.interior && !a.missionEnemy && a.health > 0);
          check(actor, "没有可用的行人样本");
          const profile = actor.rig.profile;
          staged.push({ actor, active: actor.active, x: actor.x, z: actor.z, yaw: actor.yaw,
            archetype: actor.archetype, men: profile.men, health: actor.health, down: actor.down, fall: actor.fall });
          actor.active = true; actor.inCar = false; actor.interior = false; actor.down = 0; actor.health = 100;
          actor.x = SN.player.x + 1.5; actor.z = SN.player.z + 1.9; actor.yaw = SN.PI;
          actor.archetype = "vendor"; profile.men = true;
          SN.quality.mode = "高";
          M.refreshAssignments(true);
          const agent = M.agents.find(item => item.source === actor);
          check(agent && agent.garmentsEnabled, "摊主没有启用服装外壳");
          check(agent.garmentKeys.top === "topShort", "短袖样本缺失：" + (agent.garmentKeys && agent.garmentKeys.top));
          const top = agent.garments.top, bottom = agent.garments.bottom;
          check(top.material.skinning === true && bottom.material.skinning === true, "行人服装材质没有开启蒙皮");
          check(probe.weightsOk(bottom) === 0, "下装有顶点的蒙皮权重无效");
          check(probe.poseIdle(agent), "无法给行人播放待机动画");
          const cuffMeta = top.geometry.userData && top.geometry.userData.cuffs;
          check(cuffMeta && cuffMeta.length === 2, "短袖袖口标记缺失");
          const vendorProto = M.prototypes[agent.sex];
          check(vendorProto && vendorProto.bones && vendorProto.bones.upperarm_l && vendorProto.bones.lowerarm_l,
            "短袖样本缺少手臂骨骼");
          const shoulderX = Math.abs(vendorProto.bones.upperarm_l.x);
          const elbowX = Math.abs(vendorProto.bones.lowerarm_l.x);
          const shortPosition = top.geometry.attributes.position;
          for (const cuff of cuffMeta) {
            const cuffX = Math.abs(cuff.x);
            check(cuffX > shoulderX + 0.06 && cuffX < elbowX - 0.03, "短袖没有止于上臂中段：" + cuffX.toFixed(3));
            let inner = 0;
            for (let i = 0; i < shortPosition.count; i++) {
              const dx = (shortPosition.getX(i) - cuff.x) * cuff.side;
              if (dx < -0.024 || dx > -0.004) continue;
              const dy = shortPosition.getY(i) - cuff.y, dz = shortPosition.getZ(i) - cuff.z;
              if (Math.sqrt(dy * dy + dz * dz) < cuff.radius * 0.85) inner++;
            }
            check(inner >= 6, "短袖袖口没有封口：" + inner);
          }
          // Short sleeves had an 8 cm flared mouth around a 5 cm bicep; measure
          // the same ease the long cuff test uses so the arm cannot float inside
          // a bell.
          if (vendorProto.armGauge)
            for (const cuff of cuffMeta) {
              const ease = cuff.radius - vendorProto.armGauge.bicep;
              check(ease <= 0.02 && ease >= 0.002, "短袖口没有贴住上臂：" + ease.toFixed(3) + " m");
            }
          let cuffMax = 0, cuffSamples = 0;
          for (const cuff of cuffMeta) {
            const suffix = cuff.side > 0 ? "_l" : "_r";
            const shoulder = probe.boneAt(agent, "upperarm" + suffix);
            const elbow = probe.boneAt(agent, "lowerarm" + suffix);
            const wrist = probe.boneAt(agent, "hand" + suffix);
            check(shoulder && elbow && wrist, "行人手臂骨骼缺失 " + suffix);
            for (const index of cuff.indices) {
              const point = probe.skinned(top, top.geometry, index);
              cuffMax = Math.max(cuffMax, Math.min(probe.segmentDistance(point, shoulder, elbow), probe.segmentDistance(point, elbow, wrist)));
              cuffSamples++;
            }
          }
          check(cuffSamples >= 6 && cuffMax <= 0.25, "短袖袖口偏离手臂 " + cuffMax.toFixed(3) + " m");
          const hemMeta = bottom.geometry.userData && bottom.geometry.userData.hems;
          check(hemMeta && hemMeta.length === 2, "裤脚标记缺失");
          let hemMax = 0, hemSamples = 0;
          for (const hem of hemMeta) {
            const suffix = hem.side > 0 ? "_l" : "_r";
            const thigh = probe.boneAt(agent, "thigh" + suffix);
            const knee = probe.boneAt(agent, "calf" + suffix);
            const ankle = probe.boneAt(agent, "foot" + suffix);
            check(thigh && knee && ankle, "行人腿部骨骼缺失 " + suffix);
            for (const index of hem.indices) {
              const point = probe.skinned(bottom, bottom.geometry, index);
              hemMax = Math.max(hemMax, Math.min(probe.segmentDistance(point, thigh, knee), probe.segmentDistance(point, knee, ankle)));
              hemSamples++;
            }
          }
          check(hemSamples >= 6 && hemMax <= 0.25, "裤脚偏离小腿 " + hemMax.toFixed(3) + " m");
          const head = probe.boneAt(agent, "Head");
          check(head, "头部骨骼缺失");
          check(agent.capMesh && agent.capMesh.visible && agent.capMesh.parent === agent.headBone, "行人帽子没有挂在头部骨骼");
          const cap = new SN.T.Vector3();
          agent.capMesh.getWorldPosition(cap);
          const hatDistance = cap.distanceTo(head);
          check(hatDistance <= 0.25, "帽子偏离头部骨骼 " + hatDistance.toFixed(3) + " m");
          console.log("SMOKE m19 hems: shortCuff=" + cuffMax.toFixed(3) + "m hemMax=" + hemMax.toFixed(3) +
            "m hat=" + hatDistance.toFixed(3) + "m");
        } finally {
          for (const item of staged) {
            item.actor.active = item.active; item.actor.x = item.x; item.actor.z = item.z; item.actor.yaw = item.yaw;
            item.actor.archetype = item.archetype; item.actor.rig.profile.men = item.men;
            item.actor.health = item.health; item.actor.down = item.down; item.actor.fall = item.fall;
          }
          SN.quality.mode = savedQuality;
          M.refreshAssignments(true);
        }
      }],
      [23.08, "m20-foot-plant", () => {
        const M = SN.models, agent = M.playerAgent;
        check(M && agent && agent.garments && agent.garments.shoes, "玩家鞋子网格缺失");
        const shoe = agent.garments.shoes, root = agent.root;
        check(shoe.isSkinnedMesh && shoe.geometry, "鞋子不是蒙皮网格");
        const saved = {
          car: SN.player.car, grounded: SN.player.grounded, swimming: SN.player.swimming,
          bail: SN.player.bail, vault: SN.player.vault, motionSpeed: SN.player.motionSpeed,
          gait: SN.player.gait, dead: SN.player.dead, hitReact: SN.player.hitReact,
          health: SN.player.health, aiming: SN.aiming, holstered: SN.holstered
        };
        const tmp = new SN.T.Vector3();
        const count = shoe.geometry.attributes.position.count;
        // 鞋底最低点相对路面的高度：正是玩家肉眼看到的“脚陷进路里”。
        const soleAboveGround = () => {
          root.updateMatrixWorld(true);
          let low = Infinity;
          for (let i = 0; i < count; i++) {
            shoe.boneTransform(i, tmp);
            tmp.applyMatrix4(shoe.matrixWorld);
            if (tmp.y < low) low = tmp.y;
          }
          return low - SN.player.y;
        };
        try {
          SN.player.car = null; SN.player.grounded = true; SN.player.swimming = false;
          SN.player.bail = null; SN.player.vault = null; SN.player.dead = 0; SN.player.hitReact = 0;
          SN.player.health = 100; SN.aiming = false; SN.holstered = true;
          const results = {};
          for (const [name, speed, gait] of [["walk", 1.2, 0], ["jog", 3.5, 1]]) {
            SN.player.motionSpeed = speed; SN.player.gait = gait;
            let lowest = Infinity, lowestUnlifted = Infinity, maxLift = 0;
            for (let f = 0; f < 150; f++) {
              M.updatePlayer(1 / 60);
              const above = soleAboveGround();
              const lift = root.position.y;
              lowest = Math.min(lowest, above);
              lowestUnlifted = Math.min(lowestUnlifted, above - lift);
              maxLift = Math.max(maxLift, lift);
            }
            check(Number.isFinite(lowest), name + " 鞋底高度测量失败");
            check(lowest >= -0.008, name + " 鞋底陷进路面 " + (lowest * 1000).toFixed(1) + " mm");
            check(maxLift >= 0.002, name + " 没有抬脚修正");
            check(maxLift <= 0.12, name + " 抬脚修正过大 " + maxLift.toFixed(3) + " m");
            results[name] = { lowest: +lowest.toFixed(4), unlifted: +lowestUnlifted.toFixed(4), maxLift: +maxLift.toFixed(4) };
          }
          SN.player.grounded = false;
          M.updatePlayer(1 / 60);
          check(root.position.y < 0.001, "腾空时脚部修正没有归零");
          console.log("SMOKE m20 foot: walk=" + JSON.stringify(results.walk) + " jog=" + JSON.stringify(results.jog));
        } finally {
          Object.assign(SN.player, saved);
          SN.models.update(0.016);
        }
      }]
    );
  };

  SN.extendLookSmoke = function extendLookSmoke() {
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    SN.smoke.stages.push(
      [0.18, "m11-occupied-lots", () => {
        for (const kind of ["parking", "park", "playground", "construction", "gas", "school", "camp"])
          check(SN.lookLots.some(lot => lot.kind === kind), "缺少空地类型 " + kind);
        check(SN.lookLots.length <= 140 && SN.cityArtStats.neonTubes > 100, "地块预算或霓虹缺失");
        for (const lot of SN.lookLots) check([lot.x, lot.z, lot.base, lot.yaw].every(Number.isFinite) && !SN.isWater(lot.x, lot.z), "设施落点无效");
        check(SN.cycleRoutes.length > 0 && SN.cyclists.length === 8, "骑行路线或固定池缺失");
        check(SN.lookParking.some(p => SN.cars.some(c => c.parked && Math.hypot(p.x - c.x, p.z - c.z) < 2)), "停车场没有可驾驶车辆");
      }],
      [0.2, "m11-static-batching", () => {
        const materials = new Set(SN.staticInstanceMaterials.values());
        const batches = SN.cityTiles.filter(tile => materials.has(tile.material));
        check(batches.some(tile => tile.entries.length > 192), "重复零件未合并为实例批次");
        for (const tile of batches) {
          check(!tile.merged && tile.entries.length <= 1024, "实例批次布局或容量错误");
          check(Number.isFinite(tile.sphere.radius) && tile.sphere.radius > 0, "分块包围球无效");
          if (tile.mesh) check(tile.mesh.instanceColor && tile.mesh.instanceColor.count >= tile.entries.length, "实例颜色缓冲缺失");
        }
        for (const [source, material] of SN.staticInstanceMaterials)
          check(material !== source && material !== SN.mergedCityMaterials.get(source), "不同着色器布局共用材质");
        const inLane = SN.inDrivingLane;
        const strip = { x: 0, y: 0.2, z: 0, sx: 3, sy: 0.3, sz: 32, yaw: 0, pitch: 0 };
        try {
          const whole = [], split = [], slope = [];
          SN.inDrivingLane = () => false; SN.clipStreetStrip(strip, whole);
          check(whole.length === 1 && Math.abs(whole[0].sz - 32.012) < 0.00001, "平直铺装没有合并");
          SN.inDrivingLane = (x, z) => Math.abs(z) < 4; SN.clipStreetStrip(strip, split);
          check(split.length === 2 && split[0].z + split[0].sz / 2 < -3.1 && split[1].z - split[1].sz / 2 > 3.1, "合并封住了路口");
          SN.inDrivingLane = () => false; SN.clipStreetStrip({ ...strip, pitch: 0.2 }, slope);
          check(slope.length === 20 && slope[0].y > slope[19].y, "坡道分段或高度改变");
        } finally { SN.inDrivingLane = inLane; }
      }],
      [12.39, "m11-retired-camera-pool", () => {
        const bins = SN.cameraPropBins;
        try {
          SN.cameraPropBins = new Map();
          for (let n = 0; n < 12; n++) {
            const boxes = [];
            for (const x of [47, 49]) boxes.push(SN.registerCameraPart({ x, y: 3, z: 47, sx: 8, sy: 0.2, sz: 2 }));
            check(SN.cameraPropBins.size > 1, "跨格碰撞盒未登记");
            SN.releaseCameraParts(boxes); check(SN.cameraPropBins.size === 0, "卸载后碰撞盒泄漏");
          }
        } finally { SN.cameraPropBins = bins; }
        const states = SN.phoneIcons.map(icon => ({ active: icon.active, visible: icon.sprite.visible }));
        try {
          for (const icon of SN.phoneIcons) icon.active = true;
          check(SN.acquirePhoneIcon() === null, "报警图标池重复分配");
        } finally { SN.phoneIcons.forEach((icon, i) => { icon.active = states[i].active; icon.sprite.visible = states[i].visible; }); }
      }],
      [18.61, "m11-wardrobe-silhouettes", () => {
        const costume = SN.campaign.costume, outfit = SN.progression.cityOutfit;
        const modelWardrobe = !!(SN.models && SN.models.runtimeReady && SN.models.playerAgent);
        try {
          const silhouettes = new Set(), colors = new Set();
          for (const id of Object.keys(SN.costumeStyles)) {
            SN.campaign.costume = id; SN.applyCostume();
            const style = SN.costumeStyles[id]; colors.add(style.outer);
            if (modelWardrobe) {
              const agent = SN.models.playerAgent;
              const uniforms = agent.body && agent.body.material && agent.body.material.userData.clothUniforms;
              check(uniforms && SN.models.playerOutfitId === "player-" + id && agent.root.visible, "换装人物消失");
              check(uniforms.uTopColor.value.getHex() === SN.srgb(style.outer).getHex(), "上衣颜色未应用");
              check(uniforms.uBottomColor.value.getHex() === SN.srgb(style.pants).getHex(), "裤子颜色未应用");
              check(agent.action && agent.mixer, "换装后人物动画丢失");
            } else {
              silhouettes.add(SN.wardrobe.extras.filter(m => m.visible).map(m => m.userData.lookRole).sort().join(","));
              check(SN.wardrobe.base.some(s => s.part.mesh.visible && s.part.matType === "cloth"), "换装人物消失");
            }
          }
          check(colors.size === 6, "服装轮廓或颜色重复");
          if (!modelWardrobe) check(silhouettes.size === 6, "服装轮廓或颜色重复");
          SN.campaign.costume = "street";
          for (let n = 0; n < 3; n++) { SN.progression.cityOutfit = n; SN.applyCostume(); }
        } finally { SN.campaign.costume = costume; SN.progression.cityOutfit = outfit; SN.applyCostume(); }
      }],
      [18.62, "m11-river-cyclists-orbit", () => {
        const player = { x: SN.player.x, z: SN.player.z }, time = SN.renderTime, yaw = SN.camYaw;
        const position = SN.camera.position.clone(), target = SN.lookTarget.clone(), route = SN.cycleRoutes[0];
        try {
          SN.player.x = route.x; SN.player.z = route.z + 12;
          SN.cycleRefresh = -1; SN.renderRiverCyclists();
          check(SN.cycleBodies.count > 0 && SN.cycleBodies.count <= 4, "中画质骑行人数异常");
          const rider = SN.cyclists.find(a => a.active), x = rider.x, z = rider.z;
          SN.renderTime += 1; SN.renderRiverCyclists();
          check(Math.hypot(rider.x - x, rider.z - z) > 1, "骑行者未移动");
          for (const a of SN.cyclists) if (a.active) check([a.x, a.y, a.z].every(Number.isFinite) && !SN.isWater(a.x, a.z), "骑行者离开岸边");
          SN.menuCamera(0); const initial = SN.camera.position.clone(); SN.menuCamera(20);
          check(SN.camera.position.distanceTo(initial) > 10 && SN.isWater(SN.camera.position.x, SN.camera.position.z), "开场镜头未绕江移动");
        } finally {
          Object.assign(SN.player, player); SN.renderTime = time; SN.camYaw = yaw;
          SN.camera.position.copy(position); SN.lookTarget.copy(target); SN.camera.lookAt(target);
          SN.cycleRefresh = -1; SN.renderRiverCyclists();
        }
      }],
      [21.4, "m11-render-submission", () => {
        const triangles = geo => (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
        for (const key of ["capsule", "head", "shoe", "boot", "sole", "handOpen", "handGrip"]) {
          check(SN.crowdGeo[key] !== SN.rigGeo[key], "人群仍共用主角的高密度几何 " + key);
          if (triangles(SN.rigGeo[key]) > 0)
            check(triangles(SN.crowdGeo[key]) < triangles(SN.rigGeo[key]) * 0.45, "人群几何未精简 " + key);
        }
        const carKeys = ["body", "glass", "trim", "chrome", "accent", "red", "blue", "head", "tail", "plate"];
        let maxCarTris = 0;
        for (const geo of SN.vehicleGeometry) {
          let total = 0;
          for (const key of carKeys) {
            if (!geo[key]) continue;
            total += triangles(geo[key]);
            const position = geo[key].attributes.position.array;
            for (let i = 0; i < position.length; i++)
              if (!Number.isFinite(position[i])) { check(false, "车辆几何包含非法坐标 " + key); break; }
          }
          maxCarTris = Math.max(maxCarTris, total);
          check(total > 250 && total <= 3000, "车辆模型三角面超出预算 " + total);
        }
        console.log("SMOKE vehicles: maxTris=" + maxCarTris);
        check(SN.terrainDraw && SN.terrainDraw.geometry === SN.groundGeo, "地形没有复用高度网格");
        check(SN.terrainPages.every(page => page.patterns.length === 3 && !SN.scene.children.includes(page.mesh)), "地形仍重复逐块绘制");
        check(SN.cityTransit.every(item => item.root.children.length > 0), "动态交通景物被固化");
        if (!SN.renderer || !SN.renderer.info) return;
        let draws = 0, instances = 0;
        for (const materials of SN.cityInstanceGroups.values()) for (const group of materials.values())
          for (const pool of group.pools) for (const mesh of pool.meshes) {
            check(mesh.count <= 2048 && mesh.instanceColor.count === 2048, "静态实例缓冲溢出");
            check(!SN.scene.children.some(object => object !== mesh && object.geometry === mesh.geometry), "实例几何重复提交");
            if (mesh.visible) { draws++; instances += mesh.count; }
          }
        check(draws > 0 && instances > 0 && SN.terrainDraw.geometry.drawRange.count > 0, "街景或地形提交为空");
        console.log("SMOKE render: cityDraws=" + draws + " instances=" + instances + " terrainTris=" + SN.terrainDraw.geometry.drawRange.count / 3);
      }],
      [22, "m11-perf-budget", () => {
        // Read a rendered street frame after the gameplay stages have returned home.
        if (!SN.renderer || !SN.renderer.info) { console.log("SMOKE perf: offline drawing substitute, GPU counters unavailable"); return; }
        const draws = SN.perf.calls, tris = SN.perf.triangles;
        console.log("SMOKE perf: draws=" + draws + " tris=" + tris);
        check(Number.isFinite(draws) && Number.isFinite(tris) && draws > 0 && tris > 0, "性能计数器无有效帧");
        check(draws <= 520 && tris <= 900000, "中画质超过 520 次绘制 / 90 万三角面预算：draws=" + draws + " tris=" + tris);
      }]
    );
  };

  SN.playabilityFixture = function playabilityFixture(run) {
    if (!SN.devMode) return;
    const record = JSON.parse(JSON.stringify(SN.campaignRecord())), clock = SN.simTime, seed = SN.seed;
    SN.seed = 31107;
    const player = { ...SN.player }, cars = SN.cars.map(c => ({ c, state: { ...c }, visible: c.root.visible }));
    const actors = SN.actors.map(a => ({ a, state: { ...a } })), offences = SN.lastOffence;
    SN.closeStreetPanel(); SN.closeShopMenu(); SN.togglePause(false); SN.toggleJournal(false); SN.toggleCityMap(false);
    SN.closeDialogue(); SN.cleanupEncounter(); SN.hideMissionResult(); SN.clearInput(); SN.clearWantedResponse();
    SN.campaign.active = SN.campaign.checkpoint = null; SN.heat = 0; SN.carjack = null; SN.arrestState = null;
    SN.lastOffence = Object.create(null); SN.spawnClock = 0;
    Object.assign(SN.player, { car: null, dead: 0, bail: null, vault: null, health: 100, armor: 0, vy: 0, speed: 0, motionSpeed: 0, grounded: true });
    for (const { c } of cars) { c.active = false; c.root.visible = false; }
    for (const { a } of actors) { a.active = false; if (a.kind === "police") a.inCar = null; }
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    try { run(check); }
    finally {
      SN.closeStreetPanel(); SN.closeShopMenu(); SN.togglePause(false); SN.toggleJournal(false); SN.toggleCityMap(false); SN.closeDialogue();
      SN.cleanupEncounter(); SN.campaign.active = null; SN.heat = 0; SN.clearWantedResponse(); SN.clearInput(); SN.hideMissionResult();
      SN.simTime = clock; SN.loadCampaign(record); Object.assign(SN.player, player);
      for (const { c, state, visible } of cars) {
        if (c.type !== state.type) SN.fitVehicle(c, state.type);
        for (const key of Object.keys(state))
          if (!["glass", "lights", "wheels", "modelRoot", "modelKey", "modeled", "modelPaint", "modelGlass", "modelWheels", "modelWheelRadius", "modelSpin"].includes(key)) c[key] = state[key];
        c.paint.color.copy(SN.srgb(c.paintColor)); if (c.glass) c.glass.visible = !c.glassBroken;
        c.root.visible = visible; c.root.position.set(c.x, c.y, c.z); c.root.rotation.y = c.yaw;
      }
      for (const { a, state } of actors) Object.assign(a, state);
      SN.lastOffence = offences;
      SN.seed = seed;
      SN.carjack = null; SN.arrestState = null; SN.slowMotion = 0; SN.playerRoot.visible = !SN.player.car;
      SN.$("downscreen").classList.remove("visible"); SN.$("arrestScreen").classList.remove("visible");
      SN.snapPlayer(); SN.snapCars(); SN.refreshHUD();
    }
  };

  // Only the initial fixture is placed. Travel below uses the normal movement and collision functions.
  SN.smokeWalkTo = function smokeWalkTo(target, tick, radius = 1, retries = 0) {
    const p = SN.player;
    const active = SN.campaign.active, step = active && active.step;
    const free = (x, z) => !SN.isWater(x, z, 0.28) && !SN.blocked(x, z, 0.28, SN.surfaceHeight(x, z)) &&
      !SN.cars.some(c => c.active && Math.hypot(c.x - x, c.z - z) < c.spec.length + 1 && SN.carCirclePush(x, z, 0.34, c));
    const line = (a, b) => {
      const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5);
      for (let i = 1; i <= n; i++) if (!free(SN.lerp(a.x, b.x, i / n), SN.lerp(a.z, b.z, i / n))) return false;
      return true;
    };
    const path = [];
    const coarse = Math.hypot(p.x - target.x, p.z - target.z) > 100 ? SN.roadRoute(p, target).concat([target]) : [target];
    let from = { x: p.x, z: p.z };
    for (let goal of coarse) {
      if (goal !== target && !free(goal.x, goal.z)) {
        let replacement = null;
        for (let r = 1; r <= 10 && !replacement; r++) {
          let best = Infinity;
          for (let n = 0; n < 16; n++) {
            const x = goal.x + Math.sin(n * SN.TAU / 16) * r, z = goal.z + Math.cos(n * SN.TAU / 16) * r;
            const distance = Math.hypot(x - from.x, z - from.z);
            if (distance < best && free(x, z)) { replacement = { x, z }; best = distance; }
          }
        }
        if (replacement) goal = replacement;
      }
      if (line(from, goal)) { path.push(goal); from = goal; continue; }
      const queue = [{ x: from.x, z: from.z, cost: 0, score: 0, parent: null }], seen = new Map();
      let found = null;
      for (let count = 0; queue.length && count < 24000; count++) {
        let best = 0; for (let i = 1; i < queue.length; i++) if (queue[i].score < queue[best].score) best = i;
        const node = queue.splice(best, 1)[0];
        if (Math.hypot(node.x - goal.x, node.z - goal.z) < (goal === target ? radius * 0.75 : 3.5)) { found = node; break; }
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const x = node.x + dx, z = node.z + dz, cost = node.cost + Math.hypot(dx, dz), key = Math.round(x - from.x) + "," + Math.round(z - from.z);
          if (cost >= (seen.get(key) || Infinity) || !free(x, z) || !line(node, { x, z })) continue;
          seen.set(key, cost); queue.push({ x, z, cost, score: cost + Math.hypot(x - goal.x, z - goal.z), parent: node });
        }
      }
      if (!found) throw new Error("步行路线不可达 " + goal.x.toFixed(1) + "," + goal.z.toFixed(1) + " 目标 " + target.x.toFixed(1) + "," + target.z.toFixed(1) + " 起点 " + from.x.toFixed(1) + "," + from.z.toFixed(1));
      const segment = []; for (let n = found; n.parent; n = n.parent) segment.unshift(n);
      path.push(...segment); from = found;
    }
    let index = 0, idle = 0;
    for (let n = 0; n < 30000 && Math.hypot(p.x - target.x, p.z - target.z) > radius; n++) {
      while (index < path.length - 1 && Math.hypot(p.x - path[index].x, p.z - path[index].z) < 0.3) index++;
      const goal = path[index], before = { x: p.x, z: p.z };
      SN.camYaw = Math.atan2(goal.x - p.x, goal.z - p.z); SN.keys.KeyW = true; SN.keys.ShiftLeft = true;
      SN.playerMotion(1 / 30); tick(1 / 30);
      if (active && (SN.campaign.active !== active || active.step !== step)) { SN.clearInput(); return; }
      idle = Math.hypot(p.x - before.x, p.z - before.z) < 0.005 ? idle + 1 / 30 : 0;
      if (idle > 1 && retries < 3) { SN.clearInput(); return SN.smokeWalkTo(target, tick, radius, retries + 1); }
      if (idle > 3) throw new Error("步行受阻 " + p.x.toFixed(1) + "," + p.z.toFixed(1) + " 目标 " + target.x.toFixed(1) + "," + target.z.toFixed(1) + " 路点 " + index + "/" + path.length + " 坡 " + (SN.groundUnder(p.x + Math.sin(SN.camYaw), p.z + Math.cos(SN.camYaw), 0.22, p.y) - p.y).toFixed(2) + " 障碍 " + SN.blocked(p.x + Math.sin(SN.camYaw), p.z + Math.cos(SN.camYaw), 0.28, p.y) + " 高度 " + p.y.toFixed(2));
    }
    SN.clearInput();
    if (Math.hypot(p.x - target.x, p.z - target.z) > radius) throw new Error("步行超时");
  };

  SN.smokeDriveTo = function smokeDriveTo(target, tick, radius = 6) {
    const c = SN.player.car;
    const active = SN.campaign.active, step = active && active.step;
    if (!c) throw new Error("缺少驾驶车辆");
    let center = SN.roadRoute(c, target);
    const next = center.find(p => Math.hypot(p.x - c.x, p.z - c.z) > 15);
    if (next && Math.abs(SN.angleDelta(c.yaw, Math.atan2(next.x - c.x, next.z - c.z))) > SN.PI * 0.6) {
      const projected = SN.projectToRoad(c.x, c.z);
      const forward = projected && [SN.roadNodes[projected.a], SN.roadNodes[projected.b]].find(p =>
        (p.x - c.x) * Math.sin(c.yaw) + (p.z - c.z) * Math.cos(c.yaw) > 15);
      if (forward) {
        // Go around the next block instead of attempting a U-turn across the median.
        const choices = forward.links.map(l => SN.roadNodes[l.index]).filter(p =>
          Math.abs(SN.angleDelta(c.yaw, Math.atan2(p.x - forward.x, p.z - forward.z))) < SN.PI * 0.75);
        const turn = choices.find(p => Math.abs(SN.angleDelta(c.yaw, Math.atan2(p.x - forward.x, p.z - forward.z))) > 0.4) || choices[0];
        if (turn) center = [projected, forward, turn].concat(SN.roadRoute(turn, target).slice(1));
      }
    }
    const route = center.map((point, i) => {
      const from = center[Math.max(0, i - 1)], next = center[Math.min(center.length - 1, i + 1)];
      const dx = i ? point.x - from.x : next.x - point.x, dz = i ? point.z - from.z : next.z - point.z, len = Math.hypot(dx, dz) || 1;
      const road = SN.roadSample((point.x + from.x) / 2, (point.z + from.z) / 2), lane = road ? road.profile.laneOffset : 2;
      return { x: point.x - dz / len * lane, z: point.z + dx / len * lane };
    }).concat([target]); let index = 0;
    for (let n = 0; n < 18000; n++) {
      const d = Math.hypot(c.x - target.x, c.z - target.z);
      if (d < radius && Math.abs(c.speed) < 0.8) { SN.clearInput(); return; }
      while (index < route.length - 1 && Math.hypot(c.x - route[index].x, c.z - route[index].z) < 10) index++;
      const point = route[index], turn = SN.angleDelta(c.yaw, Math.atan2(point.x - c.x, point.z - c.z));
      const desired = d < radius ? 0 : Math.min(17, Math.max(3, d * 0.8)) * SN.clamp(1 - Math.abs(turn) * 0.5, 0.2, 1);
      SN.touch.x = SN.clamp(-turn * 1.9, -1, 1);
      SN.touch.accel = c.speed < desired - 0.2; SN.touch.reverse = c.speed > desired + 0.2;
      SN.carMotion(1 / 30); tick(1 / 30);
      if (active && (SN.campaign.active !== active || active.step !== step)) { SN.clearInput(); return; }
      if (c.recoveryReady) throw new Error("驾驶受阻 " + c.x.toFixed(1) + "," + c.z.toFixed(1) + " → " + point.x.toFixed(1) + "," + point.z.toFixed(1) + " 朝向 " + c.yaw.toFixed(2));
    }
    throw new Error("驾驶路线未抵达 " + target.x + "," + target.z);
  };

  SN.extendPlayabilitySmoke = function extendPlayabilitySmoke() {
    const stage = (time, name, run) => SN.smoke.stages.push([time, "m10-" + name, () => SN.playabilityFixture(run)]);
    stage(19.65, "modal-respawn", check => {
      SN.togglePause(true); SN.openStats(); const clock = SN.simTime;
      SN.fixedStep(1); check(SN.paused && SN.simTime === clock, "档案没有暂停时间");
      SN.closeStreetPanel(); check(!SN.paused && SN.canControl(), "档案关闭后未恢复控制");
      SN.hurtPlayer(120, true); check(SN.player.dead > 0 && SN.$("downscreen").classList.contains("visible"), "倒下画面缺失");
      for (let i = 0; i < 250; i++) { SN.simTime += 1 / 60; SN.updateCombat(1 / 60); }
      const sane = () => SN.canControl() && SN.player.health === 100 && !SN.blocked(SN.player.x, SN.player.z, 0.3) && !SN.isWater(SN.player.x, SN.player.z);
      check(sane() && !SN.$("downscreen").classList.contains("visible"), "医院复活不完整");
      SN.forceWanted(2, "警戒"); SN.beginArrest(SN.actors.find(a => a.kind === "police"));
      for (let i = 0; i < 280; i++) SN.updateArrest(1 / 60);
      SN.refreshHUD(); check(sane() && SN.heat === 0 && !SN.$("arrestScreen").classList.contains("visible"), "治安站复活不完整");
    });
    stage(19.7, "difficulty-recovery", check => {
      const officer = SN.actors.find(a => a.kind === "police"); SN.heat = 2;
      SN.player.policeHitBudget = 4; SN.player.policeHitAt = SN.simTime;
      for (let i = 0; i < 1200; i++) { SN.simTime += 1 / 60; SN.hurtPlayer(12, false, officer); }
      check(!SN.player.dead && SN.player.health >= 19 && SN.player.health < 30, "二星连续火力未保留二十秒生存时间");
      const car = SN.placeMissionVehicle(SN.loanCar, -30, -800, 7), hp = car.health;
      SN.player.car = car; SN.carDamage(car, 60, SN.pursuitCars[0]); check(car.health >= hp - 6, "警车单次撞击过强");
      for (let i = 0; i < 181; i++) SN.updateVehicleRecovery(car, 1 / 60, 0, 1);
      check(car.recoveryReady, "受困三秒没有复位提示"); SN.refreshHUD();
      check(SN.$("weaponHint").textContent.includes("按 R 复位"), "复位提示不可见");
      const health = car.health; SN.action("KeyR");
      check(!car.recoveryReady && car.health === health && SN.heat === 2 && !SN.carBlocked(car.x, car.z, car.yaw, car), "复位破坏车况、通缉或落在障碍中");
      car.terrainRoll = 2;
      for (let i = 0; i < 181; i++) SN.updateVehicleRecovery(car, 1 / 60, 0, 0);
      SN.$("ammo").click(); check(!car.recoveryReady && Math.abs(car.terrainRoll) < 1, "触屏复位失败");
    });
    stage(19.75, "steal-drive-escape", check => {
      const c = SN.placeMissionVehicle(SN.loanCar, -30, -800, 3);
      const driver = SN.actors.find(a => a.kind === "civilian" && !a.missionEnemy);
      Object.assign(driver, { active: true, down: 0, health: 100, inCar: c, x: c.x, z: c.z }); c.occupant = driver; c.driver = true;
      const entry = SN.exitPosition(c); check(entry, "无法接近司机车门");
      Object.assign(SN.player, { x: entry.x + 2, z: entry.z, y: SN.surfaceHeight(entry.x + 2, entry.z) });
      const tick = dt => { SN.simTime += dt; SN.updatePendingReports(dt); };
      SN.smokeWalkTo(entry, tick, 0.8); SN.doorTarget = null; SN.action("KeyF");
      check(SN.carjack && SN.player.car === c && !driver.inCar && !c.occupant, "F 没有拉出驾驶员");
      for (let i = 0; i < 42; i++) { SN.carMotion(1 / 60); tick(1 / 60); }
      const start = { x: c.x, z: c.z }; SN.keys.KeyW = true;
      for (let i = 0; i < 100; i++) { SN.carMotion(1 / 60); tick(1 / 60); }
      SN.clearInput(); check(Math.hypot(c.x - start.x, c.z - start.z) > 5 && c.speed > 7, "劫车后没有实际驾驶");
      const victim = SN.actors.find(a => a.kind === "civilian" && a !== driver && !a.missionEnemy);
      Object.assign(victim, { active: true, down: 0, health: 100, inCar: null, interior: null, x: c.x + Math.sin(c.yaw) * 2, z: c.z + Math.cos(c.yaw) * 2, carHitCool: 0 });
      SN.carMotion(1 / 60); check(victim.health < 100, "车辆没有撞到行人");
      for (let i = 0; i < 300; i++) tick(1 / 60);
      check(SN.heat === 1, "首次劫车与撞人应保持一星");
      const officer = SN.actors.find(a => a.kind === "police");
      Object.assign(officer, { active: true, down: 0, health: 100, inCar: null, x: c.x + 8, z: c.z, footPolice: true });
      officer.rig.root.position.set(officer.x, SN.surfaceHeight(officer.x, officer.z), officer.z);
      SN.weapons[1].owned = true; SN.selectWeapon(1); SN.weapons[1].mag = 8;
      SN.camera.position.set(c.x, c.y + 1.2, c.z); SN.camera.lookAt(new SN.T.Vector3(officer.x, officer.rig.root.position.y + 1.1, officer.z));
      SN.shotClock = 0; SN.triggerPressed = true; SN.fireWeapon();
      check(SN.weapons[1].mag === 7 && officer.health < 100, "武器没有实际命中警员");
      for (let i = 0; i < 60; i++) tick(1 / 60);
      check(SN.heat === 3, "射击警员没有升至三星");
      SN.updateWanted(1 / 60);
      const police = SN.pursuitCars.filter(v => v.role === "police" && v.active && Math.hypot(v.x - c.x, v.z - c.z) < 120);
      check(police.length >= 2, "三星附近不足两辆警车");
      const sides = police.map(v => (v.x - c.x) * Math.sin(c.yaw) + (v.z - c.z) * Math.cos(c.yaw));
      check(sides.some(d => d > 0) && sides.some(d => d < 0), "警车没有前后包夹");
      for (const v of police) check(v.root.visible && !SN.carBlocked(v.x, v.z, v.yaw, v) && !SN.carWater(v.x, v.z, v.yaw, v), "警车出生位置无效");
      const before = police.map(v => ({ x: v.x, z: v.z }));
      for (let i = 0; i < 120; i++) { SN.simTime += 1 / 60; SN.trafficMotion(1 / 60); }
      check(police.every((v, i) => Math.hypot(v.x - before[i].x, v.z - before[i].z) > 2), "警车未追击");
      c.speed = c.vx = c.vz = 0; SN.enterExit();
      const shelter = SN.safePosition(SN.player.x + 450, SN.player.z - 120, 0.4);
      let flashed = false; const levels = [SN.heat];
      const evasion = dt => {
        SN.simTime += dt; SN.updateWanted(dt); SN.refreshHUD();
        flashed = flashed || SN.$("heat").classList.contains("searching");
        if (levels[levels.length - 1] !== SN.heat) levels.push(SN.heat);
      };
      SN.smokeWalkTo(shelter, evasion, 1);
      for (let i = 0; i < 2400 && SN.heat; i++) {
        evasion(1 / 60);
      }
      check(flashed && levels.join(",") === "3,2,1,0" && !SN.pursuitCars.some(v => v.active && v.role === "police"), "脱逃后星级或追车未清理 " + levels.join(","));
    });
    for (let index = 0; index < 3; index++) stage(19.8 + index * 0.05, "journey-" + index, check => SN.smokeStoryJourney(index, check));
    stage(20, "free-roam-save", check => {
      const shop = SN.allShopSpecs.find(s => s.kind === "weapons"); check(shop, "缺少武器店");
      const start = SN.safePosition(shop.outside.x + 8, shop.outside.z, 0.35);
      Object.assign(SN.player, { x: start.x, z: start.z, y: SN.surfaceHeight(start.x, start.z) });
      SN.campaign.progress = 0; SN.startMission("story", 0); SN.suspendMission();
      check(!SN.campaign.active && SN.campaign.checkpoint && SN.canControl(), "暂存主线后不能自由行动");
      const tick = dt => { SN.simTime += dt; SN.updateShops(dt); SN.updateMission(dt); check(!SN.campaign.active || SN.campaign.active.status === "running", "出租车任务失败"); };
      SN.smokeWalkTo(shop.outside, tick); SN.smokeWalkTo(shop.innerPoint, tick, 0.8);
      check(SN.enterableAt(SN.player.x, SN.player.z) || SN.interiorAt(SN.player.x, SN.player.z), "无法走进武器店");
      SN.smokeWalkTo(shop.counterSpot, tick, 1.5); SN.updateShops(0.1);
      check(SN.counterTarget && SN.counterTarget.shop === shop, "柜台无法交互");
      SN.money = 6000; SN.weapons[1].owned = false; SN.openShopMenu(); SN.buyShopGood("weapon1"); SN.closeShopMenu();
      check(SN.money === 5620 && SN.weapons[1].owned && SN.weapons[1].mag > 0, "买枪扣款或装备错误");
      SN.smokeWalkTo(shop.innerPoint, tick, 0.8); SN.smokeWalkTo(shop.outside, tick, 0.8);
      const c = SN.placeMissionVehicle(SN.cars.find(v => v.role === "traffic"), shop.outside.x, shop.outside.z, 3);
      c.occupant = null; c.hailedUntil = 0; c.stolenOnce = false;
      const exit = SN.exitPosition(c); check(exit, "出租车车门不可达"); SN.smokeWalkTo(exit, tick, 1);
      SN.doorTarget = null; const stolen = SN.progression.stats.carsStolen; SN.enterExit();
      check(SN.player.car === c && SN.progression.stats.carsStolen === stolen + 1, "未盗取出租车");
      for (let i = 0; i < 22; i++) { SN.carMotion(1 / 30); tick(1 / 30); }
      const taxiIndex = SN.sideJobs.findIndex(m => m.id === "taxi"), wins = SN.campaign.jobWins[taxiIndex];
      SN.startVehicleJob(); check(SN.campaign.active && SN.campaign.active.index === taxiIndex, "车内无法接出租单");
      SN.smokeDriveTo(SN.activeObjective(), tick, 7); tick(0.1);
      check(SN.campaign.active && SN.campaign.active.step === 1 && SN.campaign.active.taxi === c, "乘客未上车");
      SN.smokeDriveTo(SN.activeObjective(), tick, 7); tick(0.1);
      check(!SN.campaign.active && SN.campaign.jobWins[taxiIndex] === wins + 1, "出租单未完成");
      const home = SN.properties[0]; SN.smokeDriveTo(home, tick, 6);
      SN.openProperty(0); SN.propertyAction("buy"); SN.propertyAction("store"); SN.propertyAction("save"); SN.closeStreetPanel();
      const expected = JSON.parse(JSON.stringify(SN.campaignRecord())), memory = new Map();
      const storage = { setItem: (key, value) => memory.set(key, value), getItem: key => memory.get(key) };
      SN.saveCampaign(storage); check(memory.size === 1, "存档没有写出");
      SN.money = 0; SN.progression = SN.freshProgression(); SN.campaign.jobWins.fill(0); SN.weapons[1].owned = false;
      SN.loadCampaign(undefined, storage);
      check(SN.campaign.storageOK && SN.money === expected.money && SN.weapons[1].owned && SN.weapons[1].mag === expected.ammunition[1].mag, "重新读取后现金或枪械丢失");
      check(SN.progression.home === home.id && SN.progression.properties[home.id].car.type === 3 && SN.campaign.jobWins[taxiIndex] === wins + 1, "安全屋、出租车或活动进度丢失");
      check(Math.hypot(SN.player.x - home.x, SN.player.z - home.z) < 6 && !SN.campaign.active && SN.campaign.checkpoint, "读档未从安全屋继续自由活动");
    });
    stage(20.05, "bridges-at-speed", check => {
      const c = SN.loanCar; SN.fitVehicle(c, 7); c.active = true; SN.player.car = c;
      for (const bridge of SN.bridges) {
        const road = SN.roads.find(r => r.bridge && r.points[0][0] === bridge.x);
        Object.assign(c, { x: bridge.x - road.laneOffset, z: bridge.z0 - 20, yaw: 0, speed: 30, vx: 0, vz: 30, health: 100, exploded: false });
        SN.resetVehicleGround(c);
        for (let i = 0; i < 1200 && c.z < bridge.z1 + 20; i++) {
          SN.simTime += 1 / 30; SN.moveCar(c, 1 / 30, 1, 0);
          Object.assign(SN.player, { x: c.x, z: c.z, y: c.y });
          const floor = SN.vehicleGround(c).y;
          check(Number.isFinite(c.y) && c.y >= floor - 0.05 && c.y - floor < 3, "桥面掉落或异常弹飞 " + bridge.name);
        }
        check(c.z >= bridge.z1 + 20 && c.health > 70, "高速未能通过桥梁 " + bridge.name);
      }
    });
  };

  SN.smokeStoryJourney = function smokeStoryJourney(index, check) {
    const m = SN.storyMissions[index], start = SN.missionStart(m), money = SN.money;
    SN.campaign.progress = index;
    Object.assign(SN.player, { x: start.x, z: start.z, y: SN.surfaceHeight(start.x, start.z) });
    SN.player.fallPeak = SN.player.y;
    SN.startMission("story", index); check(SN.campaign.active, "起点无法接任务");
    const tick = dt => {
      SN.simTime += dt; SN.updateMission(dt);
      const a = SN.campaign.active;
      check(!a || a.status === "running", "行程失败 " + (a && a.reason));
    };
    const enter = car => {
      const approaches = [];
      for (let n = 0; n < 16; n++) {
        const x = car.x + Math.sin(n * SN.TAU / 16) * 3.8, z = car.z + Math.cos(n * SN.TAU / 16) * 3.8;
        if (!SN.blocked(x, z, 0.45) && !SN.carCirclePush(x, z, 0.45, car)) approaches.push({ x, z });
      }
      approaches.sort((a, b) => Math.hypot(a.x - SN.player.x, a.z - SN.player.z) - Math.hypot(b.x - SN.player.x, b.z - SN.player.z));
      check(approaches.length, "任务车辆无上车位置");
      SN.smokeWalkTo(approaches[0], tick, 1); SN.doorTarget = null; SN.enterExit();
      check(SN.player.car === car, "未能进入准备车");
      for (let i = 0; i < 22; i++) { SN.carMotion(1 / 30); tick(1 / 30); }
    };
    const leave = () => {
      if (!SN.player.car) return;
      SN.player.car.speed = SN.player.car.vx = SN.player.car.vz = 0; SN.enterExit();
    };
    const elapsedAt = SN.simTime; let travelled = 0;
    while (SN.campaign.active) {
      const a = SN.campaign.active, step = a.step, o = SN.activeObjective(), before = { x: SN.player.x, z: SN.player.z };
      if (!step) {
        SN.failMission("路线重试"); SN.retryCheckpoint();
        check(a.status === "running" && a.step === step && SN.heat === 0 && !SN.carjack && !SN.encounterActors.length, "失败重试未清理状态");
      }
      if (o.type === "go") { leave(); SN.smokeWalkTo(o, tick, Math.min(1.5, o.r * 0.6)); }
      else if (o.type === "vehicle") enter(a.contractCar);
      else if (o.type === "drive") {
        if (!SN.player.car) enter(SN.loanCar);
        SN.smokeDriveTo(o, tick, o.r * 0.65);
      } else if (o.type === "fight") {
        leave(); SN.smokeWalkTo(o, tick, 2);
        const enemies = SN.encounterActors.slice();
        for (const e of enemies) {
          SN.smokeWalkTo(e, tick, 1.8);
          while (e.health > 0) { SN.hitActor(e, SN.weapons[0].damage, 0, 0, false, "melee"); tick(0.4); }
        }
      } else if (o.type === "escape") {
        leave(); const goal = SN.safePosition(SN.searchX + SN.searchRadius + 330, SN.searchZ - 80, 0.4);
        const escapeTick = dt => { SN.updateWanted(dt); tick(dt); };
        SN.smokeWalkTo(goal, escapeTick, 1);
        for (let i = 0; i < 1500 && SN.campaign.active && a.step === step; i++) escapeTick(1 / 30);
      } else if (o.type === "tail" || o.type === "chase") {
        const target = SN.missionCar, began = { x: target.x, z: target.z };
        const trail = [{ x: target.x, z: target.z }];
        enter(SN.loanCar);
        for (let i = 0; i < 6000 && SN.campaign.active && a.step === step; i++) {
          SN.trafficMotion(1 / 30);
          const c = SN.player.car, d = Math.hypot(c.x - target.x, c.z - target.z), gap = o.type === "tail" ? 35 : 7;
          const last = trail[trail.length - 1];
          if (Math.hypot(target.x - last.x, target.z - last.z) > 0.7) trail.push({ x: target.x, z: target.z });
          if (trail.length > 240) trail.shift();
          // Follow the recorded path, not the straight bearing, so corners stay on the road.
          let x = target.x - Math.sin(target.yaw) * gap, z = target.z - Math.cos(target.yaw) * gap, need = gap;
          for (let k = trail.length - 1; k > 0; k--) {
            const a0 = trail[k], b0 = trail[k - 1], span = Math.hypot(a0.x - b0.x, a0.z - b0.z);
            if (need <= span) {
              const t = span > 0 ? need / span : 0;
              x = a0.x + (b0.x - a0.x) * t; z = a0.z + (b0.z - a0.z) * t;
              break;
            }
            need -= span;
          }
          const turn = SN.angleDelta(c.yaw, Math.atan2(x - c.x, z - c.z));
          const desired = SN.clamp(Math.abs(target.speed) + (d - gap) * 0.7, 0, 20) * SN.clamp(1 - Math.abs(turn) * 0.5, 0.2, 1);
          SN.touch.x = SN.clamp(-turn * 1.9, -1, 1); SN.touch.accel = c.speed < desired - 0.2; SN.touch.reverse = c.speed > desired + 0.2;
          SN.carMotion(1 / 30);
          if (o.type === "chase" && target.health > 35 && d < 35 && i % 20 === 0) {
            SN.weapons[1].owned = true; SN.selectWeapon(1); SN.weapons[1].mag = Math.max(1, SN.weapons[1].mag);
            SN.camera.position.set(c.x, c.y + 1.2, c.z); SN.camera.lookAt(new SN.T.Vector3(target.x, target.y + 0.9, target.z));
            SN.shotClock = 0; SN.triggerPressed = true; SN.fireWeapon();
          }
          tick(1 / 30);
        }
        check(Math.hypot(target.x - began.x, target.z - began.z) > 8, "目标车没有真实行驶");
      }
      travelled += Math.hypot(SN.player.x - before.x, SN.player.z - before.z);
      check(!SN.campaign.active || a.step > step, "目标没有推进 " + o.type);
    }
    check(SN.campaign.progress === index + 1 && SN.money === money + m.reward && SN.$("missionResult").classList.contains("visible"), "通过奖励或结算横幅缺失");
    check(travelled > 100 && SN.simTime - elapsedAt > 25, "行程没有按正常速度运行");
    SN.updateStreetMarkers(); const next = SN.currentTarget();
    check(next && SN.streetPoints.some(p => p.kind === "story" && p.index === index + 1), "下一章地图标记缺失");
    SN.toggleCityMap(true); SN.drawCityAtlas(); SN.toggleCityMap(false); SN.drawMap();
  };


  SN.extendReleaseSmoke = function extendReleaseSmoke() {
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    SN.smoke.stages.push(
      [20.51, "m12-first-minute-new-game", () => SN.playabilityFixture(check => {
        const coarse = SN.coarse, guide = SN.onboarding, until = SN.tutorialUntil;
        try {
          SN.started = false; SN.player.health = 1; SN.player.armor = 0; SN.player.walkMode = true;
          SN.newCampaign();
          check(SN.started && SN.player.health === 100 && SN.player.armor === 60 && !SN.player.walkMode, "新游戏继承旧生存状态");
          for (const mobile of [false, true]) {
            SN.coarse = mobile; SN.progression = SN.freshProgression();
            SN.campaign.progress = 0; SN.campaign.active = SN.campaign.checkpoint = null; SN.player.car = null;
            SN.beginOnboarding();
            check(SN.onboarding.stage === 0 && SN.$("tutorialHint").textContent.includes(mobile ? "摇杆" : "WASD"), "缺少移动指引");
            SN.simTime += 2.1; SN.player.x += 3; SN.updateOnboarding();
            check(SN.onboarding.stage === 1 && SN.$("tutorialHint").textContent.includes(mobile ? "点上车" : "F 上车"), "上车指引顺序错误");
            SN.simTime += 2.1; SN.player.car = SN.loanCar; SN.updateOnboarding();
            check(SN.onboarding.stage === 2 && SN.$("tutorialHint").textContent.includes("金线") && SN.getGPSRoute().length > 1, "GPS 指引或路线缺失");
            SN.simTime += 2.1; SN.player.x += 10; SN.updateOnboarding();
            check(SN.onboarding.stage === 3 && SN.$("tutorialHint").textContent.includes(mobile ? "交互条" : "接受任务"), "缺少接受任务指引");
            if (mobile) check(!/WASD|按 E|按 F/.test(SN.$("tutorialHint").textContent), "触屏指引仍依赖键盘");
            SN.heat = 1; SN.updateOnboarding(); check(SN.$("tutorialHint").textContent.includes("红圈"), "通缉期间误导接任务");
            SN.heat = 0; SN.player.car = null; SN.startMission("story", 0); SN.updateOnboarding();
            check(!SN.onboarding, "接受任务后仍占用教学提示");
            SN.cleanupEncounter(); SN.campaign.active = SN.campaign.checkpoint = null;
          }
          SN.progression = SN.freshProgression(); SN.beginOnboarding();
          for (let i = 1; i <= 3; i++) { SN.simTime += 12.1; SN.updateOnboarding(); check(SN.onboarding.stage === i, "等待时指引未按顺序出现"); }
          SN.simTime += 24; SN.updateOnboarding(); check(!SN.onboarding, "首分钟之后仍重复提示");
        } finally { SN.coarse = coarse; SN.onboarding = guide; SN.tutorialUntil = until; }
      })],
      [20.54, "m12-mission-panel-pause", () => SN.playabilityFixture(check => {
        SN.campaign.progress = 0; SN.startMission("story", 0); SN.failMission("委托中断");
        const time = SN.simTime, health = SN.player.health;
        SN.fixedStep(1);
        check(SN.simTime === time && SN.player.health === health, "失败面板仍推进世界");
        SN.retryCheckpoint();
        check(SN.campaign.active.status === "running" && SN.canControl(), "失败后无法重试");
        SN.failMission("返回街头"); SN.suspendMission();
        check(!SN.campaign.active && SN.canControl(), "失败后无法返回街头");
      })],
      [21.6, "m12-stream-buffer-stability", () => {
        const x = SN.player.x, z = SN.player.z, q = SN.qualityLevel();
        SN.packCityInstances(x, z, q); SN.streamTerrain(x, z, q);
        const buffers = [SN.groundGeo.index];
        for (const materials of SN.cityInstanceGroups.values()) for (const group of materials.values())
          for (let pass = 0; pass < group.pools.length; pass++) for (const mesh of group.pools[pass].meshes) {
            buffers.push(mesh.instanceMatrix, mesh.instanceColor);
            if (pass === 1) {
              const count = mesh.geometry.drawRange.count;
              mesh.onBeforeRender(); assert(mesh.geometry.drawRange.count === 0, "阴影实例仍绘制颜色");
              mesh.onAfterRender(); assert(mesh.geometry.drawRange.count === count && mesh.castShadow, "阴影实例没有恢复");
            } else assert(!mesh.castShadow, "静态物体重复投射阴影");
          }
        const versions = buffers.map(attribute => attribute.version);
        SN.packCityInstances(x, z, q); SN.streamTerrain(x, z, q);
        assert(buffers.every((attribute, i) => attribute.version === versions[i]), "静止视角重复上传缓冲");
        assert(SN.terrainPages.every(page => !page.mesh && page.sphere && Number.isFinite(page.sphere.radius)), "废弃地形副本未释放");
      }],
      [22.1, "m12-runtime-state", () => {
        const finite = p => p && [p.x, p.y, p.z].every(Number.isFinite);
        assert(SN.started && SN.canControl() && !SN.onboarding, "自测结束后操作未恢复");
        assert(finite(SN.player) && finite(SN.camera.position) && finite(SN.taxiPassenger.rig.root.position), "主角或镜头坐标无效");
        for (const c of SN.cars) assert(finite(c) && finite(c.root.position), "车辆坐标无效");
        for (const a of SN.actors) assert(finite(a.rig.root.position), "人物骨架坐标无效");
      }],
      [18.32, "release-save-roundtrip", () => {
        const copy = value => JSON.parse(JSON.stringify(value));
        const saved = copy(SN.campaignRecord()), hasSave = SN.hasSave;
        const player = { x: SN.player.x, y: SN.player.y, z: SN.player.z };
        try {
          SN.campaign.progress = 7; SN.campaign.jobIndex = 2;
          SN.campaign.jobWins = SN.sideJobs.map((m, i) => i + 1);
          SN.campaign.unlocks = ["street", "night", "rain", "ash", "route", "dawn"]; SN.campaign.costume = "dawn";
          SN.campaign.loadoutLost = false;
          const checkpoint = { kind: "story", index: 7, step: 2, spawn: { x: -40, z: -770 }, targetPosition: { x: 560, z: 900 } };
          SN.campaign.active = copy(checkpoint); SN.campaign.checkpoint = copy(checkpoint);
          SN.money = 43123; SN.completed = 29; SN.phoneCredit = 125; SN.phoneMapped = true;
          for (const [i, w] of SN.weapons.entries()) { w.owned = true; w.mag = Math.max(0, w.capacity - 1); w.reserve = w.capacity ? 17 + i : 0; }
          const p = SN.freshProgression(); p.hair = 2; p.cityOutfit = 1; p.respect = 1234;
          p.cats = [0, 12, 99]; p.jumps = [0, 3]; p.tutorial = [0, 1, 2, 3, 4, 5];
          Object.keys(p.stats).forEach((key, i) => { p.stats[key] = 31 + i; });
          for (const [i, home] of SN.properties.entries()) p.properties[home.id] = { bank: home.income * 2, clock: 33, car: { type: i + 1, health: 73, paint: 0x42a7bc } };
          p.home = SN.properties[1].id; SN.progression = p;
          const expected = copy(SN.campaignRecord());
          SN.loadCampaign(copy(expected));
          assert(JSON.stringify(SN.campaignRecord()) === JSON.stringify(expected), "存档字段往返不一致");
          assert(SN.campaign.active.status === "suspended", "检查点未暂存");
          SN.retryCheckpoint(); assert(SN.activeObjective().type === "drive" && SN.campaign.active.contractCar, "载入委托车检查点无法继续");
          SN.failMission("暂存恢复检查"); SN.suspendMission();
          assert(!SN.campaign.active && SN.campaign.checkpoint.step === 2 && !SN.resultUntil && SN.canControl(), "失败后暂存仍锁住游戏");
          SN.cleanupEncounter(); SN.campaign.active = null; SN.heat = 0; SN.clearWantedResponse();
          const legacy = copy(expected); delete legacy.schema; delete legacy.ammunition;
          legacy.progress = 0; legacy.active = legacy.checkpoint = { ...checkpoint, index: 0, step: 2 };
          SN.loadCampaign(copy(legacy)); assert(SN.campaign.active.step === 0 && SN.weapons[1].mag > 0, "旧教学或旧弹药迁移失败");
          legacy.progress = 3; legacy.active = legacy.checkpoint = { ...checkpoint, index: 3, step: 3 };
          SN.loadCampaign(copy(legacy)); assert(SN.campaign.active.step === 5 && SN.campaign.checkpoint.step === 5, "旧取证检查点迁移失败");
          legacy.active.step = SN.storyMissions[3].objectives.length - 1;
          SN.loadCampaign(copy(legacy)); assert(!SN.campaign.active && !SN.campaign.checkpoint, "迁移后越界检查点未清理");
          expected.active = expected.checkpoint = null; expected.loadoutLost = true;
          expected.weapons = SN.weapons.map((w, i) => i === 0); expected.progression.home = "__proto__";
          SN.loadCampaign(expected);
          assert(!SN.campaign.active && !SN.progression.home && SN.weapons.slice(1).every(w => !w.owned && w.mag === 0 && w.reserve === 0), "空任务或没收装备恢复失败");
        } finally {
          SN.cleanupEncounter(); SN.campaign.active = null; SN.loadCampaign(saved); SN.hasSave = hasSave;
          SN.hideMissionResult(); SN.carjack = null; SN.player.car = null; SN.clearInput();
          Object.assign(SN.player, player); SN.snapPlayer(); SN.applyCostume(); SN.updateCatInstances();
        }
      }],
      [18.42, "release-pause-states", () => {
        const frozen = () => {
          const before = [SN.simTime, SN.minutes, SN.player.x, SN.player.z, SN.player.health, SN.loanCar.x, SN.reloadTime];
          SN.fixedStep(1 / 60);
          assert(JSON.stringify(before) === JSON.stringify([SN.simTime, SN.minutes, SN.player.x, SN.player.z, SN.player.health, SN.loanCar.x, SN.reloadTime]), "暂停后世界仍推进");
        };
        const player = { car: SN.player.car, dead: SN.player.dead, vault: SN.player.vault };
        try {
          for (const state of ["foot", "drive", "dead", "arrest", "carjack", "vault"]) {
            SN.player.car = state === "drive" ? SN.loanCar : null; SN.player.dead = state === "dead" ? 3 : 0;
            SN.arrestState = state === "arrest" ? { time: 1 } : null;
            SN.carjack = state === "carjack" ? { car: SN.loanCar, time: .5 } : null;
            SN.player.vault = state === "vault" ? { time: .1 } : null;
            SN.togglePause(true); frozen(); SN.togglePause(false);
          }
        } finally { Object.assign(SN.player, player); SN.arrestState = SN.carjack = null; SN.togglePause(false); }
        SN.toggleCityMap(true); SN.toggleJournal(true);
        SN.player.dead = 1; SN.storyDialogue = { line: 0 }; SN.cinematic = { time: 0 };
        try {
          SN.toggleCityMap(false); SN.toggleJournal(false);
          assert(!SN.cityMapOpen && !SN.journalOpen, "恢复时无法强制关闭界面");
        } finally { SN.player.dead = 0; SN.closeDialogue(); SN.cinematic = null; }
        const overlays = [
          [() => SN.toggleCityMap(true), () => SN.toggleCityMap(false)],
          [() => SN.toggleJournal(true), () => SN.toggleJournal(false)],
          [() => SN.openDialogue(SN.contacts[0]), () => SN.closeDialogue()],
          [() => { SN.counterTarget = { shop: SN.streetServices[0] }; SN.openShopMenu(); }, () => SN.closeShopMenu()],
          [() => SN.openStats(), () => SN.closeStreetPanel()],
          [() => { SN.cinematic = { time: 0 }; }, () => { SN.cinematic = null; }]
        ];
        for (const [open, close] of overlays) {
          try { open(); assert(!SN.canControl(), "界面未锁定操作"); frozen(); SN.togglePause(true); frozen(); SN.togglePause(false); frozen(); }
          finally { close(); SN.togglePause(false); }
          assert(SN.canControl(), "关闭界面后无法返回游戏");
        }
      }],
      [18.52, "release-map-pointers", () => {
        const pointer = (type, id, x, y) => SN.atlas.dispatchEvent(new window.PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true, cancelable: true }));
        SN.toggleCityMap(true);
        try {
          pointer("pointerdown", 901, 100, 100); pointer("pointerdown", 902, 200, 100);
          const zoom = SN.atlasView.zoom;
          pointer("pointermove", 902, 260, 100); assert(SN.atlasView.zoom > zoom, "双指地图缩放无效");
          pointer("pointercancel", 901, 100, 100); pointer("lostpointercapture", 902, 260, 100);
          assert(!SN.waypoint, "取消手势意外设置导航点");
        } finally { SN.atlasView.zoom = 1; SN.toggleCityMap(false); }
      }]
    );
  };

  SN.extendLivingSmoke = function extendLivingSmoke() {
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    const move = (x, z) => {
      Object.assign(SN.player, { x, z, y: SN.surfaceHeight(x, z), health: 100, armor: 100, dead: 0, bail: null, vy: 0, speed: 0, motionSpeed: 0 });
      SN.snapPlayer();
    };
    const reset = () => {
      SN.finishStreetEvent(false, true); SN.cleanupEncounter(); SN.campaign.active = SN.campaign.checkpoint = null;
      SN.heat = 0; SN.clearWantedResponse(); SN.closeShopMenu(); SN.closeStreetPanel(); SN.closeDialogue(); SN.toggleJournal(false); SN.toggleCityMap(false); SN.togglePause(false);
      SN.hideMissionResult(); SN.player.car = null; SN.player.vault = null; SN.carjack = null; SN.arrestState = null;
      SN.holstered = true; SN.clearInput(); SN.playerRoot.visible = true; move(-30, -765);
    };
    SN.smoke.stages.push(
      [19.6, "living-scooter-taxi-retry", () => {
        reset(); SN.stageLoanCar(8); SN.player.car = SN.loanCar;
        const index = SN.sideJobs.findIndex(m => m.id === "scooter"); SN.startMission("side", index);
        assert(SN.campaign.active, "踏板车工作未接取"); SN.failMission("配送重试检查"); SN.retryCheckpoint();
        assert(SN.loanCar.type === 8, "配送重试错误补发出租车");
        const o = SN.activeObjective(); SN.player.car = SN.loanCar; move(o.x, o.z);
        Object.assign(SN.loanCar, { x: o.x, z: o.z, speed: 0 }); SN.updateMission(0.1);
        assert(SN.campaign.active.step === 1, "配送重试后不能推进");
        reset(); const taxi = SN.sideJobs.findIndex(m => m.objectives.some(o => o.type === "taxiPickup"));
        SN.startMission("side", taxi); SN.failMission("出租车重试检查"); SN.retryCheckpoint();
        assert(SN.loanCar.type === 3, "出租车重试未恢复车型"); reset();
      }],
      [19.68, "living-nightshift", () => {
        reset();
        const index = SN.sideJobs.findIndex(m => m.id === "nightshift");
        assert(index >= 0, "夜班代驾支线缺失");
        SN.startMission("side", index);
        const a = SN.campaign.active;
        assert(a && a.status === "running", "夜班代驾未接取");
        let o = SN.activeObjective();
        assert(o && o.type === "go", "夜班代驾首目标不是接人");
        move(o.x, o.z); SN.updateMission(0.1);
        assert(a.step === 1, "夜班代驾未推进到接车");
        o = SN.activeObjective();
        assert(a.contractCar && a.contractCar.type === 7, "客人跑车未就位");
        assert(Math.hypot(a.contractCar.x - o.x, a.contractCar.z - o.z) < 70, "客人跑车离标记过远");
        SN.player.car = a.contractCar;
        move(a.contractCar.x, a.contractCar.z); SN.updateMission(0.1);
        assert(a.step === 2, "夜班代驾未推进到送客");
        o = SN.activeObjective();
        const car = a.contractCar;
        Object.assign(car, { x: o.x, z: o.z, y: SN.surfaceHeight(o.x, o.z), speed: 0 });
        move(o.x, o.z); SN.updateMission(0.1);
        assert(!SN.campaign.active, "夜班代驾送达后未结算");
        if (car) { car.active = false; car.root.visible = false; }
        reset();
      }],
      [19.75, "living-road-cut", () => {
        for (const [x, z] of [[-130, -348], [1150, 1322], [-1162, -134]]) {
          const road = SN.roadSample(x, z, 30);
          assert(road, "道路采样缺失 " + x + "," + z);
          assert(SN.terrainHeight(x, z) < road.height + 1.2, "山体仍埋住道路 " + x + "," + z);
        }
      }],
      [19.70, "living-cable-ride", () => {
        reset();
        const lower = SN.cableStations[0], p = SN.safePosition(lower.x, lower.z, 0.4);
        move(p.x, p.z); SN.updateCable();
        assert(SN.cableTarget === lower, "缆车站未识别");
        assert(SN.startCableRide(), "缆车未启动");
        assert(SN.cableRide && !SN.playerRoot.visible, "缆车状态错误");
        SN.updateCableRide(5); SN.updateCableRide(5);
        assert(!SN.cableRide, "缆车未抵达");
        const upper = SN.cableStations[1];
        assert(Math.hypot(SN.player.x - upper.x, SN.player.z - upper.z) < 30, "缆车落点错误");
        assert(SN.playerRoot.visible, "下车后人物未恢复");
        reset();
      }],
      [19.72, "living-weather-clock", () => {
        reset();
        for (const kind of SN.weatherKinds) {
          assert(SN.setCityWeather(kind), "天气切换失败"); SN.updateWeather(2);
          assert(Number.isFinite(SN.weather.intensity) && SN.wetTarget === (kind === "rain" ? 1 : 0), "天气或湿度异常");
        }
        for (const hour of [0, 6, 12, 18.5, 22]) { assert(SN.setCityHour(hour), "时刻切换失败"); SN.updateWeather(0); assert(SN.windowHour.value === hour, "窗光未同步时间"); }
        for (const mat of SN.buildingMats) {
          const shader = { uniforms: {}, vertexShader: "#include <uv_vertex>\n#include <project_vertex>", fragmentShader: "#include <emissivemap_fragment>" };
          mat.onBeforeCompile(shader); assert(shader.uniforms.uCityHour === SN.windowHour && shader.vertexShader.includes("vCityRoom"), "夜窗材质钩子缺失");
        }
        SN.campaign.active = { status: "running" }; const minutes = SN.minutes;
        assert(!SN.setCityHour(12) && SN.minutes === minutes, "任务时刻未锁定"); SN.campaign.active = null;
        SN.togglePause(true); assert(SN.$("pauseMenu").classList.contains("open"), "天气菜单未打开"); SN.togglePause(false);
        SN.setCityWeather("clear", true); SN.weather.intensity = 0; SN.setCityHour(10.5);
      }],
      [19.84, "living-crowd-animals", () => {
        reset();
        for (const id of ["office", "student", "tourist", "delivery", "vendor", "elder"]) assert(SN.actors.some(a => a.archetype === id), "缺少行人 " + id);
        const a = SN.actors[0]; Object.assign(a, { active: true, x: SN.player.x + 1, z: SN.player.z, inCar: null, down: 0, interior: false, citySpeechAt: -1 });
        assert(SN.cityBark(a, "rain") && !SN.cityBark(a, "rain"), "气泡冷却失效");
        SN.setCityWeather("rain"); SN.updateLivingCity(0.2); SN.renderLivingCity();
        assert(SN.umbrellaMeshes[0].count > 0 && SN.umbrellaMeshes[0].count <= 20, "雨伞池异常");
        assert(SN.cityAnimals.length === 24 && SN.cityAnimals.some(a => a.active) && SN.cityAnimals.every(a => [a.x, a.y, a.z].every(Number.isFinite)), "猫鸽池或坐标异常");
        SN.setCityWeather("clear", true); SN.renderLivingCity(); assert(SN.umbrellaMeshes[0].count === 0, "雨停未收伞");
      }],
      [19.96, "living-bus-traffic", () => {
        reset(); SN.minutes = 510; const rush = SN.cityTrafficBudget(); SN.minutes = 120; assert(SN.cityTrafficBudget() < rush, "深夜没有减流");
        assert(SN.vehicleSpecs[14].emergency && SN.vehicleSpecs[15].emergency, "紧急车辆缺失");
        const c = SN.eventCars[0], stop = SN.busStops[0]; SN.fitVehicle(c, 6);
        const yaw = Math.atan2(stop.tx * -stop.side, stop.tz * -stop.side);
        Object.assign(c, { role: "traffic", missionTag: null, x: stop.roadX - Math.sin(yaw) * 2, z: stop.roadZ - Math.cos(yaw) * 2, yaw, speed: 0, panic: 0, busDwell: 0, lastBusStop: null });
        SN.cityTrafficSpeed(c, 9, 0.1); assert(c.busDwell === 5, "公交未停站");
        SN.cityTrafficSpeed(c, 9, 5); assert(c.busDwell === 0, "公交无法离站");
        c.role = "event"; c.active = false; SN.minutes = 630;
      }],
      [20.08, "living-radio-news", () => {
        reset(); SN.player.car = SN.loanCar; SN.radio.used = []; SN.radio.newsAt = 0;
        for (let i = 0; i < 5; i++) { SN.radio.station = i; SN.updateRadio(0.2); assert(SN.$("radioStation").textContent.includes(SN.radioStations[i]), "电台 HUD 不一致"); }
        SN.heat = 3; SN.radio.used = []; const line = SN.selectRadioNews(); assert(line === SN.radioLines[4], "三星新闻优先级错误");
        assert(SN.selectRadioNews() !== line, "新闻未执行 90 秒去重");
        SN.heat = 0; SN.campaign.progress = SN.storyMissions.length; SN.radio.used = [];
        assert(SN.selectRadioNews() === SN.radioLines[14], "主线结局新闻未解锁");
        SN.player.car = null; SN.updateRadio(0); assert(!SN.$("cityRadio").classList.contains("visible"), "下车未关闭电台"); SN.radio.station = 0;
      }],
      [20.2, "living-interiors-services", () => {
        reset(); SN.money = 50000;
        for (const [kind, good] of [["pc", "pc-hour"], ["chicken", "chicken"], ["clothing", "outfit"], ["barber", "hair"], ["karaoke", "sing"], ["weapons", "ammo"], ["home", "home"]]) {
          const spec = SN.allShopSpecs.find(s => s.kind === kind); assert(spec && spec.clerk, "店面或店员缺失 " + kind);
          SN.buildShopInterior(spec); move(spec.counterSpot.x, spec.counterSpot.z); SN.player.health = 40;
          SN.weapons[1].owned = true; SN.weapons[1].reserve = 0; SN.selectedWeapon = 1;
          SN.updateShops(0.1); assert(SN.counterTarget && SN.counterTarget.shop === spec, "柜台不可达 " + kind);
          assert(SN.interiorAt(SN.player.x, SN.player.z, SN.player.y), "房间未登记 " + kind);
          const before = SN.money; SN.openShopMenu(); SN.buyShopGood(good);
          assert(good === "home" ? SN.streetPanelOpen : SN.money < before, "交易无效 " + good);
          SN.closeShopMenu(); SN.closeStreetPanel();
        }
        const data = JSON.parse(JSON.stringify(SN.progression)); SN.restoreProgression(data);
        assert(SN.progression.hair === data.hair && SN.progression.cityOutfit === data.cityOutfit, "外观未随存档恢复"); reset();
      }],
      [20.21, "shop-floor-and-clerk", () => {
        reset();
        const spec = SN.allShopSpecs.find(s => s.clerk);
        assert(spec, "缺少店员");
        SN.buildShopInterior(spec);
        const tile = spec.shellGroup.children.find(c => c.geometry && c.geometry.parameters && Math.abs(c.geometry.parameters.height - 0.035) < 1e-6);
        assert(tile, "店内没有地板");
        const top = tile.position.y + 0.0175;
        assert(Math.abs(top - spec.base) < 0.006, "地板和行走面差了 " + (top - spec.base).toFixed(3) + " m");
        const clerk = spec.clerk;
        move(clerk.x + 2.4, clerk.z + 0.6);
        clerk.shopState = "greet"; clerk.shopTimer = 30;
        for (let i = 0; i < 30; i++) SN.shopPoseClerk(clerk, 1 / 30, i / 30);
        const want = Math.atan2(SN.player.x - clerk.x, SN.player.z - clerk.z);
        const off = Math.abs(SN.angleDelta(clerk.yaw, want));
        assert(off < 0.35, "店员没有转身面向顾客：" + off.toFixed(2));
        clerk.shopState = "idle"; clerk.shopTimer = 3;
      }],
      [20.26, "nightlife-bar", () => {
        reset();
        const bar = SN.nightBar;
        assert(bar, "酒吧没有建成");
        assert(bar.patrons.length >= 9 && bar.dancers.length >= 2, "酒吧人物不足");
        assert(SN.surfaceHeight(bar.x, bar.z, bar.floorTop) - bar.floorTop < 0.02, "酒吧地板没有登记行走面");
        assert(SN.surfaceHeight(bar.pole.x, bar.pole.z, bar.floorTop) > bar.floorTop + 0.2, "舞台高度异常");
        assert(!SN.blocked(bar.x, bar.z - 7.2, 0.25, bar.floorTop), "酒吧门口被挡住");
        assert(SN.blocked(bar.x, bar.z + 6.7, 0.25, bar.floorTop), "酒吧后墙没有碰撞");
        assert(SN.blocked(bar.x - 9.7, bar.z, 0.25, bar.floorTop), "酒吧侧墙没有碰撞");
        move(bar.x, bar.z - 5);
        SN.updateNightBar(0, 10);
        assert(bar.shown.length === bar.people.length, "酒吧人物未显示");
        const angle = d => Math.atan2(d.rig.root.position.x - bar.pole.x, d.rig.root.position.z - bar.pole.z);
        const before = bar.dancers.map(angle);
        SN.updateNightBar(0, 11);
        bar.dancers.forEach((d, i) => {
          assert(Math.abs(SN.angleDelta(before[i], angle(d))) > 0.25, "舞者没有绕杆");
          assert(Math.abs(Math.hypot(d.rig.root.position.x - bar.pole.x, d.rig.root.position.z - bar.pole.z) - 0.62) < 0.03, "舞者离杆距离异常");
          assert(Math.abs(d.rig.root.position.y - bar.stageTop) < 0.02, "舞者没有站在舞台上");
        });
        for (const p of bar.patrons) assert(Math.abs(p.rig.root.position.y - bar.floorTop) < 0.02, "顾客没有站在地板上");
        let missing = 0, glasses = 0;
        const hand = new SN.T.Vector3();
        for (const p of bar.patrons) {
          assert(p.drink && p.drink.visible, "顾客没有酒杯");
          p.rig.arms[0].hand.getWorldPosition(hand);
          assert(p.drink.position.distanceTo(hand) < 0.12, "酒杯没有拿在手上");
          glasses++;
        }
        for (const r of bar.shown) for (const part of r.parts) if (!SN.npcBatchMap.has(part.batchKey)) missing++;
        assert(missing === 0, "酒吧人物有部件无法批量绘制：" + missing);
        SN.flushActors();
        assert(bar.dropped === 0, "酒吧人物批量容量不足：" + bar.dropped);
        assert(glasses >= 9, "酒杯数量不足");
      }],
      [20.32, "living-street-events", () => {        reset();
        for (const type of SN.streetEventTypes) {
          reset();
          if (type === "snatch") { const p = SN.safePosition(-15, -765, 0.3); const a = SN.actors[0]; Object.assign(a, p, { active: true, inCar: null, down: 0, hostile: false, interior: false, health: 100 }); }
          if (type === "ambush") { const crew = SN.crews[0]; move(crew.x, crew.z); for (const a of SN.actors.filter(a => a.kind === "gang" && a.crew === 0 && !a.missionEnemy)) { const p = SN.safePosition(crew.x + (a.index % 5) * 2, crew.z + 5, 0.3); Object.assign(a, p, { active: true, inCar: null, health: 100, down: 0, hostile: false }); } }
          if (type === "race") { SN.placeMissionVehicle(SN.loanCar, SN.player.x, SN.player.z, 7); SN.player.car = SN.loanCar; }
          assert(SN.startStreetEvent(type), "偶遇未生成 " + type); assert(SN.acceptStreetEvent(), "偶遇未接受 " + type);
          const e = SN.streetEvent, cash = SN.money;
          if (type === "snatch") move(e.x, e.z);
          if (type === "race") { move(e.target.x, e.target.z); SN.loanCar.x = e.target.x; SN.loanCar.z = e.target.z; }
          if (type === "ambush") for (const { actor } of e.actors) { actor.health = 0; actor.down = 10; }
          if (type === "checkpoint") move(e.x + 7, e.z);
          if (type === "motorcade") move(e.x + 12, e.z);
          SN.updateStreetEvent(type === "checkpoint" ? 3.2 : type === "motorcade" ? 12.2 : 0.1);
          assert(!SN.streetEvent && SN.money === cash + e.reward, "偶遇结算失败 " + type);
          if (type === "ambush") for (const saved of e.actors)
            assert(saved.actor.armedWeapon === saved.armedWeapon && saved.actor.armedWeapon >= 0 && saved.actor.meleeOnly === false, "埋伏结束后武器状态泄漏");
          SN.updateStreetEvent(0.1); assert(SN.money === cash + e.reward, "偶遇重复发奖");
        }
        reset(); SN.campaign.active = { status: "running" }; assert(!SN.startStreetEvent("checkpoint"), "任务中生成偶遇"); SN.campaign.active = null;
        SN.setCityHour(10.5); SN.setCityWeather("clear", true); SN.weather.intensity = 0;
      }],
      [20.46, "living-taxi-fare", () => {
        reset(); const c = SN.cars[0]; SN.placeMissionVehicle(c, -30, -800, 3);
        c.role = "traffic"; c.driver = true; c.parked = false; c.speed = 0; c.missionTag = null;
        move(c.x + 3, c.z); SN.action("KeyG");
        assert(c.hailedUntil > SN.simTime, "出租车未响应扬招");
        const destination = SN.safePosition(-150, -634, 0.5);
        SN.waypoint = { x: destination.x, z: destination.z };
        const fare = Math.max(30, Math.round(Math.hypot(destination.x - SN.player.x, destination.z - SN.player.z) * 0.08)), cash = SN.money;
        SN.rideHailedTaxi(c);
        assert(SN.money === cash - fare && Math.hypot(SN.player.x - destination.x, SN.player.z - destination.z) < 1, "出租车抵达或收费异常");
        assert(!SN.player.car && !SN.waypoint && SN.heat === 0, "出租车抵达状态异常"); reset();
      }]
    );
  };

  // Startup phase 43: keep this order relative to the other systems.

  SN.registerInit(43, function initializeMain43() {
    SN.camYaw = 0;
    SN.cameraLookAhead = 3.5;
    SN.camPitch = 0.12;
    SN.zoom = 5.5;
    SN.lookDelay = 0;
    SN.cameraRear = false;
    SN.slowMotion = 0;
    SN.started = false;
    SN.paused = false;
    SN.simTime = 0;
    SN.minutes = 10 * 60 + 30;
    SN.cycleMinutes = 48;
    SN.night = 0;
    SN.sunAnchorX = null;
    SN.sunAnchorZ = null;
    SN.menuPreview = null;
  });
  // Startup phase 51: keep this order relative to the other systems.

  SN.registerInit(51, function initializeMain51() {
    SN.cameraAnchor = new SN.T.Vector3();
    SN.playerDriver = { rig: SN.playerRig, index: 0 };
    SN.resizeQueued = false; SN.resolutionChangedAt = 0; SN.resolutionStable = 0;
    window.addEventListener("resize", SN.queueResize);
    window.addEventListener("orientationchange", SN.queueResize);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", SN.queueResize);
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
    SN.buildStreetServices();
    SN.validateContent("spawns", SN.player, SN.validateSpawns);
    SN.validateContent("city", SN.player, SN.validateCity);
    SN.buildStreetWorld();
    SN.bindNavigation();
    SN.loadCampaign();
    SN.updateCatInstances();
    SN.buildWardrobe();
    SN.bindCampaignUI();
    SN.updateCityPopulation();
    SN.snapPlayer();
    SN.snapCars();
    SN.updateActors(0, 0);
    if (!SN.devMode) { SN.menuPreview = { minutes: SN.minutes }; SN.minutes = 1125; SN.menuCamera(0); }
    SN.updateLighting();
    SN.updateVehicleWheels();
    SN.streamCity(true);
    SN.refreshHUD();
    SN.$("start").disabled = false;
    SN.$("startLabel").textContent = SN.hasSave ? "继续游戏" : "走进首尔";
    SN.$("start").classList.add("ready");
    SN.$("newGame").disabled = false;
    if (SN.devMode) { SN.startGame(); if (SN.shotName) SN.startShowcase(SN.shotName); else SN.startSmoke(); }
    requestAnimationFrame(SN.frame);
  });
})(window.SN);
window.SN.initialize();
