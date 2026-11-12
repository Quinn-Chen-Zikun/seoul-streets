/* 渲染器、后期效果、天空、光照与天气。 */
"use strict";
(function (SN) {
  SN.tuneTexture = function tuneTexture(tex) {
    tex.anisotropy = SN.texAniso;
    tex.generateMipmaps = true;
    tex.minFilter = SN.T.LinearMipmapLinearFilter;
    tex.magFilter = SN.T.LinearFilter;
    return tex;
  };

  SN.canvasTexture = function canvasTexture(canvasEl) {
    const texture = SN.tuneTexture(new SN.T.CanvasTexture(canvasEl));
    texture.encoding = SN.T.sRGBEncoding;
    return texture;
  };

  SN.setupComposer = function setupComposer() {
    if (!SN.postAvailable)
      return;
    const width = Math.max(2, Math.floor(innerWidth * SN.renderer.getPixelRatio())),
      height = Math.max(2, Math.floor(innerHeight * SN.renderer.getPixelRatio()));
    const targetType = SN.postHdrOK ? SN.T.HalfFloatType : SN.T.UnsignedByteType;
    if (SN.postDepthOK) {
      const makeTarget = () => {
        const texture = new SN.T.DepthTexture(width, height);
        texture.minFilter = SN.T.NearestFilter;
        texture.magFilter = SN.T.NearestFilter;
        return new SN.T.WebGLRenderTarget(width, height, {
          minFilter: SN.T.LinearFilter,
          magFilter: SN.T.LinearFilter,
          format: SN.T.RGBAFormat,
          type: targetType,
          depthBuffer: true,
          stencilBuffer: false,
          depthTexture: texture
        });
      };
      const first = makeTarget(), second = makeTarget();
      SN.composer = new SN.T.EffectComposer(SN.renderer);
      SN.composer.renderTarget1.dispose();
      SN.composer.renderTarget2.dispose();
      SN.composer.renderTarget1 = first;
      SN.composer.renderTarget2 = second;
      SN.composer.writeBuffer = first;
      SN.composer.readBuffer = second;
    }
    else
      SN.composer = new SN.T.EffectComposer(SN.renderer);
    SN.postRenderPass = new SN.T.RenderPass(SN.scene, SN.camera);
    SN.postRenderPass.clear = true;
    SN.composer.addPass(SN.postRenderPass);
    if (SN.postDepthOK) {
      SN.postSsaoPass = new SN.DepthSsaoPass(SN.camera, width, height);
      SN.composer.addPass(SN.postSsaoPass);
    }
    if (SN.T.UnrealBloomPass) {
      SN.postBloomPass = new SN.T.UnrealBloomPass(new SN.T.Vector2(width, height), 0.34, 0.55, 0.8);
      SN.composer.addPass(SN.postBloomPass);
    }
    SN.postGradePass = new SN.T.ShaderPass(SN.GradeShader);
    SN.postGradePass.renderToScreen = false;
    SN.composer.addPass(SN.postGradePass);
    SN.gradeUniforms = SN.postGradePass.material.uniforms;
    if (SN.T.FXAAShader) {
      SN.postFxaaPass = new SN.T.ShaderPass(SN.T.FXAAShader);
      SN.postFxaaPass.renderToScreen = true;
      SN.composer.addPass(SN.postFxaaPass);
    }
    else
      SN.postGradePass.renderToScreen = true;
  };

  SN.configurePost = function configurePost() {
    if (!SN.composer)
      return;
    const level = SN.qualityLevel();
    SN.postActive = level >= 1;
    if (SN.composer.setPixelRatio)
      SN.composer.setPixelRatio(SN.renderer.getPixelRatio());
    SN.composer.setSize(innerWidth, innerHeight);
    const width = Math.max(1, Math.floor(innerWidth * SN.renderer.getPixelRatio())),
      height = Math.max(1, Math.floor(innerHeight * SN.renderer.getPixelRatio()));
    if (SN.postSsaoPass) {
      SN.postSsaoPass.enabled = SN.postActive && level >= 2;
      SN.postSsaoPass.compositeMaterial.uniforms.uStrength.value = level >= 2 ? 0.55 : 0.38;
    }
    if (SN.postBloomPass) {
      SN.postBloomPass.enabled = SN.postActive;
      SN.postBloomPass.strength = level >= 2 ? 0.2 : 0.12;
      SN.postBloomPass.threshold = level >= 2 ? 0.88 : 0.93;
    }
    if (SN.postGradePass)
      SN.postGradePass.enabled = SN.postActive;
    if (SN.postFxaaPass) {
      SN.postFxaaPass.enabled = SN.postActive;
      SN.postFxaaPass.material.uniforms.resolution.value.set(1 / Math.max(1, width), 1 / Math.max(1, height));
    }
    if (SN.gradeUniforms)
      SN.gradeUniforms.uResolution.value.set(width, height);
  };

  SN.renderPixelRatio = function renderPixelRatio() {
    return Math.min(devicePixelRatio || 1, SN.coarse ? 1.25 : 1.5, SN.Q[SN.qualityLevel()].ratio) * SN.resolutionScale;
  };

  SN.contextLoss = function contextLoss(event) {
    event.preventDefault();
    SN.contextLost = true;
    if (SN.touch) SN.syncSuspension();
    SN.$("contextStatus").hidden = false;
  };

  SN.contextRestore = function contextRestore() {
    SN.contextLost = false; SN.contextRestorePending = true;
  };

  SN.recoverRenderer = function recoverRenderer() {
    try {
      // r128 restores buffers and textures itself. Recreate generated environment
      // contents and refresh post-processing sizes after its restoration handler.
      SN.renderer.info.autoReset = false;
      SN.scene.traverse(SN.restoreMaterial);
      for (const target of SN.environmentTargets) if (target) target.dispose();
      SN.environmentTargets.length = 0;
      const minute = SN.minutes;
      for (const time of [630, 1125, 1320]) { SN.minutes = time; SN.envMinute = -10000; SN.updateLighting(); }
      SN.minutes = minute; SN.envMinute = -10000; SN.updateLighting();
      SN.applyQuality();
      SN.streamClock = 0;
      SN.contextRestorePending = false;
      SN.$("contextStatus").hidden = true;
      SN.syncSuspension();
    } catch (e) {
      SN.contextRestorePending = false; SN.contextLost = true;
      SN.$("contextStatus").textContent = "画面未能恢复，请刷新页面 · 已保存的进度仍可继续";
      console.warn("画面恢复暂未完成：" + e.message);
    }
  };

  SN.restoreMaterial = function restoreMaterial(object) {
    const materials = object.material;
    if (!materials) return;
    if (Array.isArray(materials)) { for (const material of materials) material.needsUpdate = true; }
    else materials.needsUpdate = true;
  };

  SN.applyQuality = function applyQuality() {
    const cfg = SN.Q[SN.qualityLevel()];
    SN.renderer.setPixelRatio(SN.renderPixelRatio());
    SN.renderer.setSize(innerWidth, innerHeight);
    SN.camera.aspect = innerWidth / innerHeight;
    SN.renderer.shadowMap.enabled = cfg.shadows > 0;
    SN.renderer.shadowMap.type = SN.qualityLevel() >= 1 ? SN.T.PCFSoftShadowMap : SN.T.PCFShadowMap;
    const shadowSize = Math.min(cfg.map, SN.coarse ? 1024 : 1536);
    if (SN.sun.shadow.mapSize.x !== shadowSize) {
      SN.sun.shadow.mapSize.set(shadowSize, shadowSize);
      if (SN.sun.shadow.map) {
        SN.sun.shadow.map.dispose();
        SN.sun.shadow.map = null;
      }
    }
    SN.camera.far = cfg.far;
    SN.camera.updateProjectionMatrix();
    SN.scene.fog.near = cfg.fogNear;
    SN.scene.fog.far = cfg.fogFar;
    SN.configurePost();
    for (const batch of SN.npcBatches || []) {
      const matType = batch.key.slice(batch.key.indexOf("|") + 1);
      batch.mesh.castShadow = SN.qualityLevel() >= 2 && matType !== "eye" && matType !== "print" && matType !== "glass";
    }
    const t = SN.$("qualityToggle");
    if (t)
      t.textContent = "画质：" + (SN.quality.mode === "auto" ? "自动 · " + ["低", "中", "高"][SN.quality.level] : SN.quality.mode);
  };

  SN.refreshEnvironment = function refreshEnvironment() {
    const slot = SN.minutes < 360 || SN.minutes > 1200 ? 2 : SN.minutes > 1020 || SN.minutes < 440 ? 1 : 0;
    if (!SN.environmentTargets[slot]) SN.environmentTargets[slot] = SN.pmrem.fromScene(SN.environmentScene, 0.06, 0.1, 220);
    SN.environmentTarget = SN.environmentTargets[slot];
    SN.scene.environment = SN.environmentTarget.texture;
    SN.envMinute = SN.minutes;
  };

  SN.registerInit(51.5, function initializeEnvironmentCache() {
    const minute = SN.minutes;
    for (const time of [630, 1125, 1320]) { SN.minutes = time; SN.envMinute = -10000; SN.updateLighting(); }
    SN.minutes = minute; SN.envMinute = -10000; SN.updateLighting();
  });

  SN.addDistantMaterial = function addDistantMaterial(color, nightColor, nightMix) {
    const base = new SN.T.Color(color).convertSRGBToLinear(),
      nightTone = new SN.T.Color(nightColor).convertSRGBToLinear(),
      m = new SN.T.MeshBasicMaterial({ color: base, fog: true });
    SN.distantMats.push({ mat: m, base, night: nightTone, mix: nightMix });
    return m;
  };

  SN.mountainLayer = function mountainLayer(radius, spread, minH, maxH, count, color, startAngle, endAngle, nightColor, nightMix) {
    const positions = [], indices = [], segments = count * 8;
    for (let i = 0; i <= segments; i++) {
      const angle = SN.lerp(startAngle, endAngle, i / segments),
        nx = Math.sin(angle),
        nz = Math.cos(angle),
        noise = SN.terrainNoise(nx * 4.5 + radius * 0.003, nz * 4.5),
        ridge = SN.lerp(minH, maxH, SN.clamp(noise * 1.3, 0, 1)),
        r = radius + spread * (noise - 0.5);
      for (let row = 0; row < 3; row++)
        positions.push(nx * (r + (row - 1) * 180), row === 1 ? ridge : row === 0 ? -25 : ridge * 0.35, nz * (r + (row - 1) * 180));
      if (i < segments)
        for (let row = 0; row < 2; row++) {
          const v = i * 3 + row;
          indices.push(v, v + 1, v + 3, v + 1, v + 4, v + 3);
        }
    }
    const geometry = new SN.T.BufferGeometry();
    geometry.setAttribute("position", new SN.T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = SN.addDistantMaterial(color, nightColor, nightMix);
    material.side = SN.T.DoubleSide;
    const mesh = new SN.T.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    SN.scene.add(mesh);
    return mesh;
  };

  SN.glow = function glow(parent, x, y, z, size, color = 0xffdda0) {
    const m = SN.glowMaterial.clone();
    m.color.setHex(color);
    const sprite = new SN.T.Sprite(m);
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size, 1);
    parent.add(sprite);
    return sprite;
  };

  SN.addContactShadow = function addContactShadow(count, x, z, w, d, yaw, air) {
    const floor = SN.surfaceHeight(x, z);
    SN.dummy.position.set(x, floor + 0.035, z);
    SN.dummy.rotation.set(0, yaw, 0);
    SN.dummy.scale.set(w / (1 + air * 0.12), 1, d / (1 + air * 0.12));
    SN.dummy.updateMatrix();
    SN.contactShadows.setMatrixAt(count, SN.dummy.matrix);
    return count + 1;
  };

  SN.updateContactShadows = function updateContactShadows() {
    let count = 0;
    if (!SN.player.car && SN.playerRoot.visible)
      count = SN.addContactShadow(count, SN.playerRender.x, SN.playerRender.z, 0.9, 0.85, SN.playerRender.yaw, Math.max(0, SN.playerRender.y - SN.surfaceHeight(SN.playerRender.x, SN.playerRender.z)));
    for (const a of SN.actors)
      if (a.active && !a.inCar && Math.hypot(a.x - SN.player.x, a.z - SN.player.z) < 120)
        count = SN.addContactShadow(count, a.x, a.z, a.down ? 1.8 : 0.85, 0.8, a.yaw, 0);
    for (const c of SN.cars)
      if (c.active && c.root.visible && Math.hypot(c.root.position.x - SN.playerRender.x, c.root.position.z - SN.playerRender.z) < 150)
        count = SN.addContactShadow(count, c.root.position.x, c.root.position.z, c.spec.width * 1.3, c.spec.length * 1.12, c.yaw, 0);
    SN.contactShadows.count = count;
    SN.contactShadows.instanceMatrix.needsUpdate = true;
  };

  SN.smoothRange = function smoothRange(a, b, value) {
    const t = SN.clamp((value - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  SN.daylightAt = function daylightAt(time) {
    return SN.smoothRange(330, 405, time) * (1 - SN.smoothRange(1095, 1180, time));
  };

  SN.cycleTimePreset = function cycleTimePreset() {
    if (SN.campaign.active) { SN.toast("委托进行中，暂不能调整时刻", 2); return; }
    SN.presetIndex = (SN.presetIndex + 1) % SN.timePresets.length;
    SN.minutes = SN.timePresets[SN.presetIndex].m;
    SN.envMinute = -1000000000;
    SN.updateLighting();
    if (SN.$("toast"))
      SN.toast("时刻 · " + SN.timePresets[SN.presetIndex].label, 2.4);
  };

  SN.updateLighting = function updateLighting() {
    // One solar clock drives the entire scene. Sunrise 06:00, sunset 19:00.
    const solarAngle = SN.minutes >= 360 && SN.minutes <= 1140 ? (SN.minutes - 360) / 780 * SN.PI : SN.PI + ((SN.minutes < 360 ? SN.minutes + 1440 : SN.minutes) - 1140) / 660 * SN.PI;
    const elevation = Math.sin(solarAngle), day = SN.daylightAt(SN.minutes);
    const sunset = Math.max(1 - SN.smoothRange(0, 75, Math.abs(SN.minutes - 370)), 1 - SN.smoothRange(0, 75, Math.abs(SN.minutes - 1125)));
    SN.night = 1 - day;
    if (SN.wetUniforms) SN.wetUniforms.night.value = SN.night;
    SN.skyUniforms.top.value.copy(SN.dayTop).lerp(SN.sunsetTop, sunset * 0.76).lerp(SN.nightTop, SN.night * (1 - sunset * 0.32));
    SN.skyUniforms.horizon.value.copy(SN.dayHorizon).lerp(SN.nightHorizon, SN.night).lerp(SN.sunsetHorizon, sunset * 0.88);
    SN.skyUniforms.night.value = SN.night;
    SN.skyUniforms.sunDir.value.set(Math.cos(solarAngle), elevation, 0.22 * elevation).normalize();
    // Distance haze uses the same horizon colour as the sky.
    SN.scene.fog.color.copy(SN.skyUniforms.horizon.value).convertSRGBToLinear();
    SN.hemi.intensity = 0.44 + day * 0.24 + sunset * 0.065;
    SN.hemi.color.setRGB(SN.lerp(0.32, 0.48, day), SN.lerp(0.44, 0.7, day), SN.lerp(0.72, 1, day));
    SN.hemi.groundColor.setRGB(SN.lerp(0.055, 0.28, day) + sunset * 0.045, SN.lerp(0.06, 0.255, day) + sunset * 0.025, SN.lerp(0.07, 0.215, day));
    SN.sun.color.copy(SN.daySun).lerp(SN.warmSun, sunset);
    SN.sun.intensity = day * (0.25 + 1.55 * Math.sqrt(Math.max(0, elevation))) + sunset * 0.22;
    SN.renderer.toneMappingExposure = 1.13 - day * 0.13 + sunset * 0.045;
    const px = SN.started ? SN.playerRender.x : SN.camera.position.x,
      pz = SN.started ? SN.playerRender.z : SN.camera.position.z,
      py = SN.started ? SN.playerRender.y : 0;
    // Keep the cool rim light behind the subject from the camera's point of view,
    // so hair, collars and shoulders get a legible edge in the neon hours.
    SN.rimLight.position.set(px + Math.sin(SN.camYaw) * 13, py + 5.2, pz + Math.cos(SN.camYaw) * 13);
    SN.rimLight.target.position.set(px, py + 1.15, pz);
    SN.rimLight.intensity = 0.18 + SN.night * 0.5;
    const texel = 130 / SN.sun.shadow.mapSize.x;
    // Snap in light space; world X/Z snapping drifts diagonally across shadow texels.
    const shadowAngle = Math.round(solarAngle / 0.003) * 0.003;
    SN.shadowDirection.set(Math.cos(shadowAngle), Math.sin(shadowAngle), 0.22 * Math.sin(shadowAngle)).normalize();
    SN.shadowRight.set(SN.shadowDirection.z, 0, -SN.shadowDirection.x).normalize();
    SN.shadowUp.crossVectors(SN.shadowDirection, SN.shadowRight).normalize();
    SN.shadowAnchor.set(px, py, pz);
    const rx = SN.shadowAnchor.dot(SN.shadowRight), uy = SN.shadowAnchor.dot(SN.shadowUp);
    SN.shadowAnchor.addScaledVector(SN.shadowRight, Math.round(rx / texel) * texel - rx);
    SN.shadowAnchor.addScaledVector(SN.shadowUp, Math.round(uy / texel) * texel - uy);
    SN.sun.target.position.copy(SN.shadowAnchor);
    SN.sun.position.copy(SN.shadowAnchor).addScaledVector(SN.shadowDirection, 380);
    const envScale = 0.28 + day * 0.72;
    for (let i = 0; i < SN.envMats.length; i++)
      SN.envMats[i].material.envMapIntensity = SN.envMats[i].base * envScale;
    for (let i = 0; i < SN.buildingMats.length; i++)
      SN.buildingMats[i].emissiveIntensity = 0.015 + SN.night * 1.65;
    SN.detailWindowLight.emissiveIntensity = 0.015 + SN.night * 1.8;
    SN.lampGlow.emissiveIntensity = 0.08 + SN.night * 3;
    SN.poolMat.opacity = SN.night * 0.42;
    SN.detailDisplayMat.emissiveIntensity = 0.25 + SN.night * 1.2;
    SN.detailVendingFront.emissiveIntensity = 0.3 + SN.night * 1.1;
    SN.detailNeonGlowMat.opacity = 0.05 + SN.night * 0.42;
    SN.headMat.emissiveIntensity = 0.35 + SN.night * 2.4;
    SN.tailMat.emissiveIntensity = 0.12 + SN.night * 1.6;
    for (let i = 0; i < SN.neonMats.length; i++)
      SN.neonMats[i].emissiveIntensity = 0.22 + SN.night * 1.6;
    if (SN.neonTubeMat) SN.neonTubeMat.emissiveIntensity = 0.45 + SN.night * 2.5;
    SN.waterNight.value = SN.night;
    SN.waterMat.color.setRGB(SN.lerp(0.018, 0.018, SN.night), SN.lerp(0.21, 0.065, SN.night), SN.lerp(0.42, 0.16, SN.night));
    SN.skyUniforms.time.value = SN.renderTime;
    SN.skyUniforms.moonDir.value.copy(SN.skyUniforms.sunDir.value).multiplyScalar(-1);
    SN.waterSun.value.copy(SN.skyUniforms.sunDir.value);
    SN.waterSunColor.value.copy(SN.sun.color).multiplyScalar(1 - SN.night * 0.82);
    SN.waterSkyHorizon.value.copy(SN.skyUniforms.horizon.value).convertSRGBToLinear();
    SN.waterSkyTop.value.copy(SN.skyUniforms.top.value).convertSRGBToLinear();
    for (const d of SN.distantMats)
      d.mat.color.copy(d.base).lerp(SN.scene.fog.color, 0.2).lerp(d.night, SN.night * d.mix);
    SN.foamMat.opacity = 0.1 + Math.sin(SN.renderTime * 1.35) * 0.035 + SN.night * 0.02;
    // Real point lights only near the player: 3 on 高, 2 on 中, none on 低.
    const lampCount = SN.qualityLevel() >= 2 ? 3 : SN.qualityLevel() === 1 ? 2 : 0;
    if (SN.night > 0.001 && lampCount > 0) {
      let b1 = null, b2 = null, b3 = null, d1 = 1000000000, d2 = 1000000000, d3 = 1000000000;
      for (const p of SN.lampPoints) {
        const dx = p.x - SN.playerRender.x, dz = p.z - SN.playerRender.z, dist = dx * dx + dz * dz;
        if (dist < d1) {
          d3 = d2;
          b3 = b2;
          d2 = d1;
          b2 = b1;
          d1 = dist;
          b1 = p;
        }
        else if (dist < d2) {
          d3 = d2;
          b3 = b2;
          d2 = dist;
          b2 = p;
        }
        else if (dist < d3) {
          d3 = dist;
          b3 = p;
        }
      }
      for (let i = 0; i < 3; i++) {
        const l = SN.streetLights[i], p = i === 0 ? b1 : i === 1 ? b2 : b3;
        if (i < lampCount && p && (i === 0 ? d1 : i === 1 ? d2 : d3) < 3364) {
          l.position.set(p.x, p.y, p.z);
          l.intensity = SN.night * (i === 2 ? 5.5 : 8.5);
        }
        else
          l.intensity = 0;
      }
    }
    else
      for (const l of SN.streetLights)
        l.intensity = 0;
    if (SN.player.car) {
      const c = SN.player.car, s = Math.sin(c.yaw), co = Math.cos(c.yaw);
      SN.headlight.intensity = SN.night * 10;
      SN.headlight.position.set(c.root.position.x + s * 2, c.root.position.y + 1.3, c.root.position.z + co * 2);
      SN.headlight.target.position.set(c.root.position.x + s * 35, c.root.position.y + 1.1 - Math.sin(c.pitch || 0) * 35, c.root.position.z + co * 35);
    }
    else
      SN.headlight.intensity = 0;
    // Switch between startup-baked environments without allocating GPU targets in play.
    if (Math.abs(SN.minutes - SN.envMinute) > 120)
      SN.refreshEnvironment();
  };

  SN.toggleWet = function toggleWet() {
    if (SN.campaign.active) { SN.toast("委托进行中，暂不能调整天气", 2); return; }
    SN.wetTarget = SN.wetTarget > 0.5 ? 0 : 1;
    SN.wetMode = SN.wetTarget > 0.5;
    SN.toast(SN.wetMode ? "街道 · 湿滑反光开启" : "街道 · 干燥路面", 2.4);
  };

  SN.updateWetness = function updateWetness(dt) {
    // Twenty-second soak/dry curve: the reflection builds with the weather instead
    // of switching on, and the world-space mask never moves when the player does.
    SN.wetness += (SN.wetTarget - SN.wetness) * (1 - Math.exp(-Math.max(0, dt) / 20));
    const w = SN.wetness;
    if (SN.wetUniforms) {
      SN.wetUniforms.wet.value = w;
      SN.wetUniforms.time.value = SN.renderTime;
    }
    SN.asphalt.color.copy(SN.asphaltBaseColor).lerp(SN.asphaltWetColor, w * 0.58);
    if (SN.asphaltEnvEntry)
      SN.asphaltEnvEntry.base = 0.35 + 2.3 * w;
    if (SN.cars) {
      const coatRough = SN.lerp(0.3, 0.08, w);
      for (const c of SN.cars)
        if (c.active && c.paint) {
          const damage = SN.clamp((100 - (c.health === undefined ? 100 : c.health)) / 100, 0, 1);
          c.paint.roughness = SN.lerp(0.58 + damage * 0.32, 0.13, w);
          c.paint.clearcoatRoughness = SN.lerp(0.3 + damage * 0.12, coatRough, w);
        }
    }
  };
  // Startup phase 2: keep this order relative to the other systems.

  SN.registerInit(2, function initializeRenderer2() {
    // One quick GPU sanity check before context creation: MSAA is a context-creation
    // choice in r128, so it must be decided here and never toggled later.
    SN.gpuCores = navigator.hardwareConcurrency || 4;
    SN.gpuRenderer = (() => {
      try {
        const probe = document.createElement("canvas").getContext("webgl");
        if (!probe)
          return "";
        const info = probe.getExtension("WEBGL_debug_renderer_info");
        const name = info ? probe.getParameter(info.UNMASKED_RENDERER_WEBGL) : "";
        const lose = probe.getExtension("WEBGL_lose_context");
        if (lose)
          lose.loseContext();
        return String(name || "");
      }
      catch (_) {
        return "";
      }
    })();
    SN.softwareGPU = /swiftshader|software|llvmpipe|basic render/i.test(SN.gpuRenderer);
    SN.gpuAntialias = !SN.coarse && !SN.softwareGPU && SN.gpuCores >= 2;
    SN.renderer = new SN.T.WebGLRenderer({ canvas: SN.canvas, antialias: SN.gpuAntialias, powerPreference: "high-performance" });
    SN.renderer.info.autoReset = false;
    SN.canvas.addEventListener("webglcontextlost", SN.contextLoss, false);
    SN.canvas.addEventListener("webglcontextrestored", SN.contextRestore, false);
    SN.texAniso = Math.min(SN.coarse ? 2 : 4, SN.renderer.capabilities.getMaxAnisotropy());
    SN.renderer.outputEncoding = SN.T.sRGBEncoding;
    SN.renderer.toneMapping = SN.T.ACESFilmicToneMapping;
    SN.renderer.toneMappingExposure = 1.02;
    SN.renderer.shadowMap.enabled = true;
    SN.renderer.shadowMap.type = SN.T.PCFShadowMap;
    SN.scene = new SN.T.Scene();
    SN.headlight = new SN.T.SpotLight(0xffe6be, 0, 90, Math.PI / 5, 0.65, 1.2);
    SN.scene.add(SN.headlight, SN.headlight.target);
    SN.scene.fog = new SN.T.Fog(0x8ac9ef, 1100, 3300);
    SN.camera = new SN.T.PerspectiveCamera(65, innerWidth / innerHeight, 0.08, 3500);
    SN.hemi = new SN.T.HemisphereLight(0xc5dfef, 0x5f6854, 0.9);
    SN.scene.add(SN.hemi);
    SN.sun = new SN.T.DirectionalLight(0xffdab0, 1.8);
    SN.sun.castShadow = true;
    SN.sun.shadow.mapSize.set(2048, 2048);
    SN.sun.shadow.camera.left = -65;
    SN.sun.shadow.camera.right = 65;
    SN.sun.shadow.camera.top = 65;
    SN.sun.shadow.camera.bottom = -65;
    SN.sun.shadow.camera.near = 10;
    SN.sun.shadow.camera.far = 800;
    SN.sun.shadow.bias = -0.00025;
    SN.sun.shadow.normalBias = 0.022;
    SN.sun.shadow.radius = 2.4;
    SN.shadowDirection = new SN.T.Vector3(); SN.shadowRight = new SN.T.Vector3();
    SN.shadowUp = new SN.T.Vector3(); SN.shadowAnchor = new SN.T.Vector3();
    SN.scene.add(SN.sun, SN.sun.target);
    // ---------------- Post-processing: depth SSAO, bloom, filmic grade and FXAA ----------------
    // The chain is entirely optional: low quality bypasses the composer and renders
    // straight to the canvas, medium adds bloom/grade/FXAA, high adds half-resolution AO.
    SN.postDepthOK = !!(SN.renderer.capabilities && (SN.renderer.capabilities.isWebGL2 || SN.renderer.extensions.has("WEBGL_depth_texture")));
    SN.postHdrOK = !!(SN.renderer.capabilities && (SN.renderer.capabilities.isWebGL2 || SN.renderer.extensions.has("EXT_color_buffer_half_float")));
    SN.postAvailable = !!(SN.T.EffectComposer && SN.T.RenderPass && SN.T.ShaderPass && SN.T.Pass);
    SN.composer = null;
    SN.postRenderPass = null;
    SN.postSsaoPass = null;
    SN.postBloomPass = null;
    SN.postGradePass = null;
    SN.postFxaaPass = null;
    SN.postActive = false;
    SN.gradeUniforms = null;
    SN.quadVertexShader = "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
    SN.GradeShader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new SN.T.Vector2(1, 1) },
        uGrain: { value: 0.002 },
        uVignette: { value: 0.12 },
        uBlur: { value: 0 },
        uContrast: { value: 0.08 },
        uSaturation: { value: 1.12 }
      },
      vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uGrain,uVignette,uBlur,uContrast,uSaturation;uniform vec2 uResolution;varying vec2 vUv;
float filmHash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract(p.x*p.y);}
vec3 motionSample(vec2 uv,float amount){vec3 sum=vec3(0.);float total=0.;for(int i=0;i<6;i++){float t=float(i)/5.;float w=1.-t*.62;sum+=texture2D(tDiffuse,uv-(uv-.5)*amount*.05*t).rgb*w;total+=w;}return sum/total;}
void main(){
 vec3 c=uBlur>.001?motionSample(vUv,uBlur):texture2D(tDiffuse,vUv).rgb;
 // Render targets stay linear in r128; encode once here, after the colour grade.
 c=max(c,vec3(0.));
 c=mix(c,smoothstep(vec3(0.),vec3(1.),c),uContrast);
 float lum=dot(c,vec3(.2126,.7152,.0722));
 c=max(mix(vec3(lum),c,uSaturation),vec3(0.));
 c=mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
 float vig=(1.-smoothstep(.32,1.18,length(vUv-.5)*1.42));
 c*=mix(1.,vig,uVignette);
 float grain=filmHash(vUv*uResolution+37.7)*2.-1.;
 c+=grain*uGrain*(.55+.45*(1.-lum));
 gl_FragColor=vec4(c,1.);
}`
    };
    // Depth-only AO keeps the frame cost low: the scene is rendered once, then twelve
    // rotated hemisphere taps read the same depth buffer at half resolution.
    SN.DepthSsaoPass = class DepthSsaoPass extends SN.T.Pass {
      constructor(camera, width, height) {
        super();
        this.needsSwap = true;
        this.clear = false;
        this.camera = camera;
        this.time = 0;
        const hw = Math.max(1, Math.floor(width * 0.5)), hh = Math.max(1, Math.floor(height * 0.5));
        const targetOptions = {
          minFilter: SN.T.LinearFilter,
          magFilter: SN.T.LinearFilter,
          format: SN.T.RGBAFormat,
          depthBuffer: false,
          stencilBuffer: false,
          type: SN.T.UnsignedByteType
        };
        this.aoTarget = new SN.T.WebGLRenderTarget(hw, hh, targetOptions);
        this.blurTarget = new SN.T.WebGLRenderTarget(hw, hh, targetOptions);
        this.copyMaterial = new SN.T.ShaderMaterial({
          uniforms: { tDiffuse: { value: null } },
          vertexShader: SN.quadVertexShader,
          fragmentShader: "uniform sampler2D tDiffuse;varying vec2 vUv;void main(){gl_FragColor=texture2D(tDiffuse,vUv);}",
          depthTest: false,
          depthWrite: false
        });
        this.aoMaterial = new SN.T.ShaderMaterial({
          uniforms: {
            tDepth: { value: null },
            uProj: { value: new SN.T.Matrix4() },
            uProjInv: { value: new SN.T.Matrix4() },
            uTexel: { value: new SN.T.Vector2(1 / 512, 1 / 512) },
            uRadius: { value: 1.35 },
            uStrength: { value: 0.95 },
            uTime: { value: 0 }
          },
          vertexShader: SN.quadVertexShader,
          fragmentShader: `uniform sampler2D tDepth;uniform mat4 uProj,uProjInv;uniform vec2 uTexel;uniform float uRadius,uStrength,uTime;varying vec2 vUv;
vec3 viewPos(vec2 uv){float d=texture2D(tDepth,uv).x;vec4 v=uProjInv*vec4(uv*2.-1.,d*2.-1.,1.);return v.xyz/v.w;}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
void main(){
 float raw=texture2D(tDepth,vUv).x;
 if(raw>.9998){gl_FragColor=vec4(1.);return;}
 vec3 p=viewPos(vUv);if(p.z>-0.15){gl_FragColor=vec4(1.);return;}
 vec3 px=viewPos(vUv+vec2(uTexel.x,0.));vec3 py=viewPos(vUv+vec2(0.,uTexel.y));
 vec3 n=normalize(cross(px-p,py-p));if(n.z<0.)n=-n;
 vec3 tangent=normalize(abs(n.z)<.92?cross(vec3(0.,0.,1.),n):cross(vec3(0.,1.,0.),n));
 vec3 bitangent=cross(n,tangent);
 float rot=hash12(gl_FragCoord.xy)*6.2831853;
 float ao=0.;
 for(int i=0;i<12;i++){
  float fi=float(i);
  float ang=rot+fi*2.3999632;
  float r=sqrt((fi+.5)/12.);
  vec2 dir=vec2(cos(ang),sin(ang))*r;
  vec3 sp=p+(tangent*dir.x+bitangent*dir.y+n*(.28+r*.72))*uRadius;
  vec4 clip=uProj*vec4(sp,1.);
  vec2 suv=clip.xy/max(clip.w,.0001)*.5+.5;
  if(suv.x<0.||suv.x>1.||suv.y<0.||suv.y>1.)continue;
  float sceneZ=viewPos(suv).z;
  float near=abs(p.z-sceneZ);
  ao+=step(sp.z+.022,sceneZ)*(1.-smoothstep(.25,1.5,near/uRadius));
 }
 ao=1.-clamp(ao/12.,0.,1.)*uStrength;
 gl_FragColor=vec4(vec3(ao),1.);
}`,
          depthTest: false,
          depthWrite: false
        });
        this.blurMaterial = new SN.T.ShaderMaterial({
          uniforms: { tAO: { value: null }, uTexel: { value: new SN.T.Vector2(1 / 256, 1 / 256) } },
          vertexShader: SN.quadVertexShader,
          fragmentShader: `uniform sampler2D tAO;uniform vec2 uTexel;varying vec2 vUv;void main(){float s=0.;s+=texture2D(tAO,vUv+vec2(-1.,-1.)*uTexel).r*.0625;s+=texture2D(tAO,vUv+vec2(0.,-1.)*uTexel).r*.125;s+=texture2D(tAO,vUv+vec2(1.,-1.)*uTexel).r*.0625;s+=texture2D(tAO,vUv+vec2(-1.,0.)*uTexel).r*.125;s+=texture2D(tAO,vUv).r*.25;s+=texture2D(tAO,vUv+vec2(1.,0.)*uTexel).r*.125;s+=texture2D(tAO,vUv+vec2(-1.,1.)*uTexel).r*.0625;s+=texture2D(tAO,vUv+vec2(0.,1.)*uTexel).r*.125;s+=texture2D(tAO,vUv+vec2(1.,1.)*uTexel).r*.0625;gl_FragColor=vec4(vec3(s),1.);}`,
          depthTest: false,
          depthWrite: false
        });
        this.compositeMaterial = new SN.T.ShaderMaterial({
          uniforms: { tColor: { value: null }, tAO: { value: null }, uStrength: { value: 0.55 } },
          vertexShader: SN.quadVertexShader,
          fragmentShader: "uniform sampler2D tColor,tAO;uniform float uStrength;varying vec2 vUv;void main(){vec3 c=texture2D(tColor,vUv).rgb;float ao=texture2D(tAO,vUv).r;c*=mix(1.,ao,uStrength);gl_FragColor=vec4(c,1.);}",
          depthTest: false,
          depthWrite: false
        });
        this.quadScene = new SN.T.Scene();
        this.quadCamera = new SN.T.Camera();
        this.quadMesh = new SN.T.Mesh(new SN.T.PlaneBufferGeometry(2, 2), this.aoMaterial);
        this.quadMesh.frustumCulled = false;
        this.quadScene.add(this.quadMesh);
      }
      setSize(width, height) {
        const hw = Math.max(1, Math.floor(width * 0.5)), hh = Math.max(1, Math.floor(height * 0.5));
        this.aoTarget.setSize(hw, hh);
        this.blurTarget.setSize(hw, hh);
        this.blurMaterial.uniforms.uTexel.value.set(1 / hw, 1 / hh);
      }
      render(renderer, writeBuffer, readBuffer) {
        if (!readBuffer.depthTexture) {
          const previousTarget = renderer.getRenderTarget(), previousAuto = renderer.autoClear;
          renderer.autoClear = false;
          this.quadMesh.material = this.copyMaterial;
          this.copyMaterial.uniforms.tDiffuse.value = readBuffer.texture;
          renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
          renderer.render(this.quadScene, this.quadCamera);
          renderer.setRenderTarget(previousTarget);
          renderer.autoClear = previousAuto;
          return;
        }
        const width = readBuffer.width, height = readBuffer.height;
        this.aoMaterial.uniforms.tDepth.value = readBuffer.depthTexture;
        this.aoMaterial.uniforms.uProj.value.copy(this.camera.projectionMatrix);
        this.aoMaterial.uniforms.uProjInv.value.copy(this.camera.projectionMatrixInverse);
        this.aoMaterial.uniforms.uTexel.value.set(1 / Math.max(1, width), 1 / Math.max(1, height));
        this.aoMaterial.uniforms.uTime.value = this.time;
        const previousTarget = renderer.getRenderTarget(), previousAuto = renderer.autoClear;
        renderer.autoClear = false;
        this.quadMesh.material = this.aoMaterial;
        renderer.setRenderTarget(this.aoTarget);
        renderer.render(this.quadScene, this.quadCamera);
        this.quadMesh.material = this.blurMaterial;
        this.blurMaterial.uniforms.tAO.value = this.aoTarget.texture;
        renderer.setRenderTarget(this.blurTarget);
        renderer.render(this.quadScene, this.quadCamera);
        this.quadMesh.material = this.compositeMaterial;
        this.compositeMaterial.uniforms.tColor.value = readBuffer.texture;
        this.compositeMaterial.uniforms.tAO.value = this.blurTarget.texture;
        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        renderer.render(this.quadScene, this.quadCamera);
        renderer.setRenderTarget(previousTarget);
        renderer.autoClear = previousAuto;
      }
    };
    SN.setupComposer();
    SN.applyQuality();
  });
  // Startup phase 13: keep this order relative to the other systems.

  SN.registerInit(13, function initializeRenderer13() {
    // Procedure sky follows; the extra Myeongdong billboard glows are added after
    // the shared glow sprite material is created.
    // Procedural sky and a generated reflection environment; no image assets.
    SN.skyUniforms = {
      top: { value: new SN.T.Color(0x1673d1) },
      horizon: { value: new SN.T.Color(0x8ac9ef) },
      night: { value: 0 },
      sunDir: { value: new SN.T.Vector3(-0.85, 0.2, -0.35) },
      moonDir: { value: new SN.T.Vector3(0.55, 0.42, 0.72) },
      time: { value: 0 }
    };
    SN.sky = new SN.T.Mesh(new SN.T.SphereGeometry(2000, 32, 20), new SN.T.ShaderMaterial({
      uniforms: SN.skyUniforms,
      side: SN.T.BackSide,
      depthWrite: false,
      vertexShader: `varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 moonDir; uniform float night; uniform float time; varying vec3 vDir;
float h21(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+34.7);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.55;for(int i=0;i<4;i++){v+=a*vnoise(p);p=p*2.07+vec2(11.3,7.7);a*=.5;}return v;}
void main(){
 vec3 d=normalize(vDir);float h=max(d.y,0.);
 // Rayleigh-ish gradient: warm, bright horizon fading to a deeper ozone-blue zenith.
 vec3 c=mix(horizon,top,pow(h,.58));
 c+=vec3(.018,.04,.075)*pow(h,1.7)*(1.-night*.55);
 c=mix(c,horizon*1.015+vec3(.012,.016,.018),pow(1.-h,7.)*.4);
 vec3 sd=normalize(sunDir);float s=dot(d,sd),sunAmt=max(s,0.);
 // Mie forward scatter and a physically small solar disc.
 c+=vec3(1.,.6,.28)*pow(sunAmt,24.)*.16*(1.-night);
 c+=vec3(1.,.46,.16)*pow(sunAmt,8.)*.04*(1.-night);
 c+=vec3(.34,.2,.09)*pow(sunAmt,1.2)*.05*(1.-night);
 c+=vec3(1.,.86,.62)*smoothstep(.99986,.99996,s)*(1.-night)*3.4;
 // Stratified cloud deck: thin, wind-driven, warm only toward the sun.
 vec2 cuv=d.xz/(d.y+.18)*1.05+vec2(time*.0045,time*.0018);
 float n=fbm(cuv*1.35)+fbm(cuv*3.2+vec2(4.,9.))*.22;
 float cloud=smoothstep(.72,.91,n)*smoothstep(.012,.14,d.y);
 vec3 cloudDay=mix(vec3(1.,.98,.92),vec3(.76,.87,.98),smoothstep(0.,.62,d.y));
 cloudDay=mix(cloudDay,vec3(.98,.65,.4),pow(sunAmt,8.)*.16*(1.-night));
 vec3 cloudCol=mix(cloudDay,vec3(.05,.075,.11),night);
 c=mix(c,cloudCol,cloud*.85*(1.-night*.4));
 // A quiet moon, then stars that only appear in the darker half of twilight.
 float m=dot(d,normalize(moonDir));
 c+=vec3(.9,.94,1.)*smoothstep(.99968,.9999,m)*night*1.5;
 c+=vec3(.3,.42,.66)*pow(max(m,0.),90.)*night*.32;
 vec3 cell=floor(d*640.);float hash=h21(cell.xy+cell.z*17.3);
 float star=step(.9985,hash)*smoothstep(.04,.3,d.y)*night*(.6+.4*sin(time*2.1+hash*47.));
 c+=vec3(.6,.76,1.)*star;
 gl_FragColor=vec4(pow(max(c,vec3(0.)),vec3(2.2)),1.);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`
    }));
    SN.sky.frustumCulled = false;
    SN.sky.renderOrder = -100;
    SN.scene.add(SN.sky);
    SN.environmentScene = new SN.T.Scene();
    SN.environmentSky = new SN.T.Mesh(new SN.T.SphereGeometry(100, 24, 16), SN.sky.material);
    SN.environmentScene.add(SN.environmentSky);
    SN.pmrem = new SN.T.PMREMGenerator(SN.renderer);
    SN.pmrem.compileCubemapShader();
    SN.environmentTargets = [];
    SN.environmentTarget = SN.pmrem.fromScene(SN.environmentScene, 0.06, 0.1, 220);
    SN.environmentTargets[0] = SN.environmentTarget;
    SN.envMinute = -1000000000;
    SN.scene.environment = SN.environmentTarget.texture;
    SN.waterCompile = SN.waterMat.onBeforeCompile;
    SN.waterMat.onBeforeCompile = shader => {
      SN.waterCompile(shader);
      shader.fragmentShader = shader.fragmentShader.replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );", "float lakeFresnel=pow(1.-max(dot(normal,normalize(vViewPosition)),0.),4.); outgoingLight=mix(outgoingLight,vec3(.43,.61,.66)*(1.-uNight*.65),lakeFresnel*.35);\ngl_FragColor = vec4( outgoingLight, diffuseColor.a );");
    };
    // Layered distant scenery: two mountain ranges west/south, a skyline ring east.
    SN.distantMats = [];
    // Camera-centred backdrop remains inside even the low-quality far plane.
    SN.horizonBackdrop = new SN.T.Group(); SN.scene.add(SN.horizonBackdrop);
    for (const spec of [[1920, 75, 75, 190, 0xa3c6d5], [1740, 60, 48, 135, 0x8eafc2], [1510, 45, 30, 92, 0x779eac]]) {
      const ridge = SN.mountainLayer(spec[0], spec[1], spec[2], spec[3], 48, spec[4], 0, SN.TAU, 0x203447, 0.85);
      ridge.material.fog = false; SN.horizonBackdrop.add(ridge);
    }
    const distant = [], random = SN.lotRng(46021);
    for (let i = 0; i < 100; i++) {
      const angle = i * SN.TAU / 100, radius = 1370 + random() * 140, height = 25 + random() * 100;
      distant.push({ g: SN.box, x: Math.sin(angle) * radius, y: height / 2 - 8, z: Math.cos(angle) * radius, sx: 12 + random() * 23, sy: height, sz: 18 + random() * 21 });
    }
    const skylineMat = SN.addDistantMaterial(0x86afc2, 0x20344b, 0.8); skylineMat.fog = false;
    SN.horizonBackdrop.add(new SN.T.Mesh(SN.merged(distant), skylineMat));

  });
  // Startup phase 15: keep this order relative to the other systems.

  SN.registerInit(15, function initializeRenderer15() {
    SN.glowTexture = SN.canvasTexture(SN.glowCanvas);
    SN.glowMaterial = new SN.T.SpriteMaterial({
      map: SN.glowTexture,
      color: 0xffe2ad,
      transparent: true,
      blending: SN.T.AdditiveBlending,
      depthWrite: false,
      opacity: 0.55
    });
    // Neon haze over Myeongdong's shopping street.
    for (const pos of [[450, 10, -430], [455, 24, -410], [560, 15, 1080]])
      SN.glow(SN.scene, ...pos, 6, 0x99ffd0);
    // Billboards along the canyon read as soft coloured light rather than flat planes.
    for (let i = 0; i < 10; i++)
      SN.glow(SN.scene, 318 + i * 48, 8.6, -430 + (i % 2 ? 18 : -18), 8, i % 3 === 0 ? 0xffb4d2 : 0x9fffd8);
  });
  // Startup phase 40: keep this order relative to the other systems.

  SN.registerInit(40, function initializeRenderer40() {
    // One shared draw for soft contact shadows; no individual shadow textures/materials.
    SN.contactCanvas = document.createElement("canvas");
    SN.contactCanvas.width = SN.contactCanvas.height = 32;
    SN.contactCtx = SN.contactCanvas.getContext("2d");
    SN.contactGradient = SN.contactCtx.createRadialGradient(16, 16, 2, 16, 16, 16);
    SN.contactGradient.addColorStop(0, "rgba(5,17,22,.43)");
    SN.contactGradient.addColorStop(0.5, "rgba(5,17,22,.22)");
    SN.contactGradient.addColorStop(1, "rgba(5,17,22,0)");
    SN.contactCtx.fillStyle = SN.contactGradient;
    SN.contactCtx.fillRect(0, 0, 32, 32);
    SN.contactGeometry = new SN.T.PlaneGeometry(1, 1);
    SN.contactGeometry.rotateX(-SN.PI / 2);
    SN.contactShadows = new SN.T.InstancedMesh(SN.contactGeometry, new SN.T.MeshBasicMaterial({
      map: SN.canvasTexture(SN.contactCanvas),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1
    }), SN.npcCapacity + SN.cars.length + 1);
    SN.contactShadows.instanceMatrix.setUsage(SN.T.DynamicDrawUsage);
    SN.contactShadows.frustumCulled = false;
    SN.scene.add(SN.contactShadows);
  });
  // Startup phase 49: keep this order relative to the other systems.

  SN.registerInit(49, function initializeRenderer49() {
    SN.dayTop = new SN.T.Color(0x1673d1);
    SN.sunsetTop = new SN.T.Color(0x677aaf);
    SN.nightTop = new SN.T.Color(0x10264d);
    SN.dayHorizon = new SN.T.Color(0x8ac9ef);
    SN.sunsetHorizon = new SN.T.Color(0xffbd86);
    SN.nightHorizon = new SN.T.Color(0x355681);
    SN.warmSun = new SN.T.Color(0xffae68);
    SN.daySun = new SN.T.Color(0xfff1d6);
    SN.hazeLinear = new SN.T.Color(0x93a6ad).convertSRGBToLinear();
    SN.fogTmp = new SN.T.Color();
    // T retains time preview controls; the shared solar clock continues from each.
    SN.timePresets = [
      { m: 510, label: "清晨 · 08:30" },
      { m: 750, label: "正午 · 12:30" },
      { m: 1125, label: "黄昏 · 18:45" },
      { m: 1320, label: "夜晚 · 22:00" }
    ];
    SN.presetIndex = -1;
    // ---------------- Wet street system ----------------
    // Wetness lives inside the asphalt and sidewalk shaders; there is no decal mesh,
    // so no coplanar surface can z-fight the road, kerbs or markings.
    SN.wetTarget = 0;
    SN.wetness = 0;
    SN.wetMode = false;
    SN.asphaltEnvEntry = SN.envMats.find(entry => entry.material === SN.asphalt) || null;
  });

  SN.setCityWeather = function setCityWeather(kind, automatic = false) {
    if (!SN.weatherKinds.includes(kind)) {
      SN.reportContentProblem("weather", 0, 0, "未知天气", "恢复晴天"); kind = "clear";
    }
    if (!automatic && SN.campaign.active) { SN.toast("委托进行中，暂不能调整天气", 2); return false; }
    SN.weather.kind = kind; SN.weather.auto = automatic;
    SN.weather.next = SN.simTime + 180 + SN.rnd() * 150;
    SN.wetTarget = kind === "rain" ? 1 : 0; SN.wetMode = kind === "rain";
    SN.envMinute = -1e9;
    SN.$("cityWeather").value = kind;
    return true;
  };

  SN.setCityHour = function setCityHour(hour) {
    if (SN.campaign.active || !Number.isFinite(hour)) return false;
    SN.minutes = SN.clamp(hour, 0, 23.99) * 60; SN.envMinute = -1e9;
    SN.updateLighting(); return true;
  };

  SN.updateWeather = function updateWeather(dt) {
    const w = SN.weather;
    if (w.auto && !SN.devMode && SN.simTime >= w.next && !SN.campaign.active) {
      const roll = SN.rnd();
      SN.setCityWeather(roll < 0.6 ? "clear" : roll < 0.89 ? "rain" : "dust", true);
      SN.toast("天气 · " + SN.weatherLabels[SN.weatherKinds.indexOf(w.kind)], 3);
    }
    w.intensity += ((w.kind === "clear" ? 0 : 1) - w.intensity) * (1 - Math.exp(-Math.max(0, dt) / 6));
    SN.windowHour.value = SN.minutes / 60;
  };

  SN.renderWeather = function renderWeather() {
    const w = SN.weather, rain = w.kind === "rain", snow = w.kind === "snow", dust = w.kind === "dust";
    const intensity = w.intensity, q = SN.Q[SN.qualityLevel()];
    const tint = dust ? SN.dustTone : snow ? SN.snowTone : SN.rainTone;
    SN.skyUniforms.horizon.value.lerp(tint, intensity * (dust ? 0.65 : rain ? 0.46 : 0.36));
    SN.skyUniforms.top.value.lerp(tint, intensity * (dust ? 0.4 : rain ? 0.4 : 0.3));
    SN.scene.fog.color.copy(SN.skyUniforms.horizon.value).convertSRGBToLinear();
    SN.scene.fog.near = SN.lerp(q.fogNear, dust ? 80 : 280, intensity);
    SN.scene.fog.far = SN.lerp(q.fogFar, dust ? 650 : 1350, intensity);
    SN.sun.intensity *= 1 - intensity * (rain ? 0.62 : 0.35);
    if (SN.sun.shadow) SN.sun.shadow.radius = 1 + intensity * (rain ? 2.6 : 1);
    if (snow) SN.asphalt.color.lerp(SN.snowRoadTone, intensity * 0.55);
    const indoors = !!SN.interiorAt(SN.player.x, SN.player.z, SN.player.y);
    SN.rainMesh.visible = rain && !indoors; SN.snowMesh.visible = snow && !indoors;
    SN.updateRainSplashes(rain && !indoors ? intensity : 0);
    SN.updateWipers(rain && !indoors ? intensity : 0);
    if ((!rain && !snow) || indoors) return;
    const count = [180, 360, 620][SN.qualityLevel()], a = SN.weatherPositions.array, t = SN.simTime,
      cam = SN.camera.position, baseY = (SN.player.car ? SN.player.car.y : SN.playerRender.y) + 0.35;
    for (let i = 0; i < count; i++) {
      const dx = ((i * 17.71 + t * (snow ? 0.7 : 2.4)) % 52) - 26;
      const dz = ((i * 29.31 + t * 0.31) % 52) - 26;
      const y = baseY + ((i * 11.47 - t * (snow ? 1.2 : 17)) % 23 + 23) % 23;
      const j = i * 6, x = cam.x + dx, z = cam.z + dz;
      a[j] = x; a[j + 1] = y; a[j + 2] = z;
      a[j + 3] = x + (snow ? 0 : 0.17); a[j + 4] = y + (snow ? 0 : 0.95); a[j + 5] = z + (snow ? 0 : 0.05);
    }
    SN.weatherPositions.needsUpdate = true;
    SN.weatherGeometry.setDrawRange(0, count * 2);
    if (SN.rainMaterial) SN.rainMaterial.uniforms.uOpacity.value = 0.52 * intensity;
    SN.snowMesh.material.opacity = 0.85 * intensity;
  };

  SN.updateWipers = function updateWipers(intensity) {
    if (!SN.wiperCanvas || !SN.wiperCtx) return;
    const active = !!(SN.player.car && intensity > 0.12 && !SN.paused && !SN.cityMapOpen);
    if (!active) {
      if (SN.wiperVisible) {
        SN.wiperCtx.clearRect(0, 0, SN.wiperCanvas.width, SN.wiperCanvas.height);
        SN.wiperVisible = false;
      }
      return;
    }
    const dpr = Math.min(1.5, window.devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    if (SN.wiperCanvas.width !== Math.floor(w * dpr) || SN.wiperCanvas.height !== Math.floor(h * dpr)) {
      SN.wiperCanvas.width = Math.floor(w * dpr);
      SN.wiperCanvas.height = Math.floor(h * dpr);
      SN.wiperCanvas.style.width = w + "px";
      SN.wiperCanvas.style.height = h + "px";
    }
    const ctx = SN.wiperCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    SN.wiperVisible = true;
    const sweep = Math.sin(SN.renderTime * 2.4) * 0.62, alpha = 0.28 * Math.min(1, intensity);
    const pivots = [[w * 0.46, h * 1.08, 0.78], [w * 0.53, h * 1.06, 0.66]];
    ctx.lineCap = "round";
    for (let i = 0; i < pivots.length; i++) {
      const p = pivots[i], angle = -1.62 + sweep * (i ? 0.86 : 0.94), len = h * p[2];
      const ex = p[0] + Math.cos(angle) * len, ey = p[1] + Math.sin(angle) * len;
      ctx.strokeStyle = "rgba(5,15,22," + (alpha * (i ? 0.8 : 1)).toFixed(3) + ")";
      ctx.lineWidth = i ? 5 : 7;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = "rgba(190,222,235," + (alpha * 0.22).toFixed(3) + ")";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(p[0] + 2, p[1] - 2);
      ctx.lineTo(ex + 2, ey - 2);
      ctx.stroke();
    }
  };

  SN.updateRainSplashes = function updateRainSplashes(intensity) {
    if (!SN.rainSplashMesh) return;
    if (intensity <= 0.02) {
      if (SN.rainSplashMesh.visible) {
        SN.rainSplashMesh.visible = false;
        SN.rainSplashMesh.count = 0;
      }
      for (const s of SN.rainSplashPool) s.life = 0;
      return;
    }
    SN.splashClock = (SN.splashClock || 0) + 1;
    const spawnEvery = SN.qualityLevel() === 0 ? 3 : 2;
    if (SN.splashClock >= spawnEvery) {
      SN.splashClock = 0;
      const bursts = 1 + (SN.qualityLevel() > 0 ? 1 : 0);
      for (let n = 0; n < bursts; n++) {
        const a = SN.surfaceRandom() * SN.TAU, r = 2.4 + SN.surfaceRandom() * 15;
        const x = SN.player.x + Math.sin(a) * r, z = SN.player.z + Math.cos(a) * r;
        if (SN.isWater(x, z, 1.2)) continue;
        const s = SN.rainSplashPool[SN.splashCursor++ % SN.rainSplashPool.length];
        Object.assign(s, { x, z, y: SN.surfaceHeight(x, z) + 0.035, life: 0.52 + SN.surfaceRandom() * 0.22, max: 0.74, size: 0.12 + SN.surfaceRandom() * 0.18 });
      }
    }
    let count = 0;
    for (const s of SN.rainSplashPool) {
      if (s.life <= 0) continue;
      s.life -= 1 / 60;
      if (s.life <= 0) continue;
      const k = 1 - s.life / s.max;
      SN.dummy.position.set(s.x, s.y, s.z);
      SN.dummy.rotation.set(0, (s.x + s.z) * 0.7, 0);
      SN.dummy.scale.set(s.size * (0.5 + k * 2.6), 1, s.size * (0.5 + k * 2.6));
      SN.dummy.updateMatrix();
      SN.rainSplashMesh.setMatrixAt(count, SN.dummy.matrix);
      SN.splashTint.setRGB(0.42, 0.58, 0.66).multiplyScalar(Math.max(0, 1 - k) * intensity);
      SN.rainSplashMesh.setColorAt(count++, SN.splashTint);
    }
    SN.rainSplashMesh.count = count;
    SN.rainSplashMesh.visible = count > 0;
    if (count) {
      SN.rainSplashMesh.instanceMatrix.needsUpdate = true;
      SN.rainSplashMesh.instanceColor.needsUpdate = true;
    }
  };

  SN.registerInit(51.6, function initializeCityWeather() {
    SN.weatherKinds = ["clear", "rain", "dust", "snow"];
    SN.weatherLabels = ["晴朗", "阵雨", "黄沙薄霾", "冬日飘雪"];
    SN.weather = { kind: "clear", intensity: 0, auto: true, next: 210 };
    SN.rainTone = new SN.T.Color(0x65869e); SN.snowTone = new SN.T.Color(0xb4cedd);
    SN.dustTone = new SN.T.Color(0xc2a66f); SN.snowRoadTone = SN.srgb(0xc1cbd2);
    SN.weatherPositions = new SN.T.BufferAttribute(new Float32Array(620 * 6), 3);
    SN.weatherPositions.setUsage(SN.T.DynamicDrawUsage);
    SN.weatherGeometry = new SN.T.BufferGeometry(); SN.weatherGeometry.setAttribute("position", SN.weatherPositions);
    const rainFade = new Float32Array(620 * 2), rainAlpha = new SN.T.BufferAttribute(rainFade, 1);
    for (let i = 0; i < 620; i++) { rainFade[i * 2] = 0.25; rainFade[i * 2 + 1] = 1; }
    SN.weatherGeometry.setAttribute("aFade", rainAlpha);
    SN.rainMaterial = new SN.T.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uColor: { value: new SN.T.Color(0xb5d8ee) }
      },
      vertexShader: `attribute float aFade; varying float vFade;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); float d=length(mv.xyz);
          vFade=aFade*(1.0-smoothstep(30.0,52.0,d))*smoothstep(0.8,2.6,-mv.z);
          gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying float vFade;
        void main(){ if(vFade<=0.002) discard; gl_FragColor=vec4(uColor,uOpacity*vFade); }`,
      transparent: true, depthWrite: false, depthTest: true
    });
    SN.rainMesh = new SN.T.LineSegments(SN.weatherGeometry, SN.rainMaterial);
    SN.snowMesh = new SN.T.Points(SN.weatherGeometry, new SN.T.PointsMaterial({ color: 0xf2faff, size: 0.11, transparent: true, opacity: 0.8, depthWrite: false }));
    for (const mesh of [SN.rainMesh, SN.snowMesh]) { mesh.frustumCulled = false; mesh.visible = false; SN.scene.add(mesh); }
    // Road splash rings: camera-local world-anchored pool, faded through instance colour.
    SN.rainSplashPool = Array.from({ length: 40 }, () => ({ life: 0, max: 1, x: 0, z: 0, y: 0, size: 0.1 }));
    SN.splashCursor = 0; SN.splashClock = 0; SN.splashTint = new SN.T.Color();
    const splashGeo = new SN.T.RingGeometry(0.62, 1, 10);
    splashGeo.rotateX(-SN.PI / 2);
    SN.rainSplashMesh = new SN.T.InstancedMesh(splashGeo, new SN.T.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false,
      blending: SN.T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }), 40);
    SN.rainSplashMesh.count = 0; SN.rainSplashMesh.visible = false; SN.rainSplashMesh.frustumCulled = false;
    SN.rainSplashMesh.castShadow = false; SN.scene.add(SN.rainSplashMesh);
    // Wipers are a cheap 2D overlay above the 3D view and below the HUD.
    SN.wiperCanvas = document.createElement("canvas");
    SN.wiperCanvas.id = "rainWipers";
    SN.wiperCanvas.setAttribute("aria-hidden", "true");
    Object.assign(SN.wiperCanvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
    SN.wiperCtx = SN.wiperCanvas.getContext("2d");
    SN.wiperVisible = false;
    const hud = SN.$("hud");
    if (hud && hud.parentNode) hud.parentNode.insertBefore(SN.wiperCanvas, hud);
    else if (document.body) document.body.appendChild(SN.wiperCanvas);
    SN.windowHour = { value: 10.5 };
    for (const material of SN.buildingMats.concat([SN.detailWindowLight]).flatMap(m => [m, SN.mergedCityMaterials.get(m)]).filter(Boolean)) {
      const previous = material.onBeforeCompile;
      material.onBeforeCompile = shader => {
        if (previous) previous.call(material, shader);
        shader.uniforms.uCityHour = SN.windowHour;
        shader.vertexShader = "varying vec3 vCityRoom;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
          vec4 cityRoom = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            cityRoom = instanceMatrix * cityRoom;
          #endif
          vCityRoom = (modelMatrix * cityRoom).xyz;`);
        shader.fragmentShader = "uniform float uCityHour; varying vec3 vCityRoom;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          vec3 roomCell = floor(vCityRoom / vec3(3.2, 3.3, 3.2));
          float roomSeed = fract(sin(dot(roomCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float roomBedtime = 21.0 + roomSeed * 5.5;
          float roomOn = uCityHour < 6.0 ? step(0.86, roomSeed) : 1.0 - smoothstep(roomBedtime - 0.12, roomBedtime + 0.12, uCityHour);
          totalEmissiveRadiance *= mix(0.05, 1.0, roomOn);`);
      };
      const priorKey = material.customProgramCacheKey.bind(material);
      const key = priorKey(); material.customProgramCacheKey = () => key + "-city-evening";
      material.needsUpdate = true;
    }
    SN.$("cityWeather").addEventListener("change", event => { SN.setCityWeather(event.target.value); SN.updateLighting(); });
    SN.$("cityHour").addEventListener("change", event => SN.setCityHour(Number(event.target.value)));
    SN.$("weatherAuto").addEventListener("click", () => { SN.weather.auto = !SN.weather.auto; SN.weather.next = SN.simTime + 180; SN.$("weatherAuto").textContent = "自然天气：" + (SN.weather.auto ? "开" : "关"); });
  });

})(window.SN);
