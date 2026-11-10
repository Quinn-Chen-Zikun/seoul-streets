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
    return SN.tuneTexture(new SN.T.CanvasTexture(canvasEl));
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
      SN.postBloomPass = new SN.T.UnrealBloomPass(new SN.T.Vector2(width, height), 0.22, 0.4, 0.84);
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
      SN.postSsaoPass.enabled = SN.postActive;
      SN.postSsaoPass.compositeMaterial.uniforms.uStrength.value = level >= 2 ? 0.55 : 0.38;
    }
    if (SN.postBloomPass) {
      SN.postBloomPass.enabled = SN.postActive;
      SN.postBloomPass.strength = level >= 2 ? 0.22 : 0.13;
      SN.postBloomPass.threshold = level >= 2 ? 0.86 : 0.92;
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

  SN.applyQuality = function applyQuality() {
    const cfg = SN.Q[SN.qualityLevel()];
    SN.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cfg.ratio));
    SN.renderer.setSize(innerWidth, innerHeight);
    SN.camera.aspect = innerWidth / innerHeight;
    SN.renderer.shadowMap.enabled = cfg.shadows > 0;
    SN.renderer.shadowMap.type = SN.qualityLevel() >= 1 ? SN.T.PCFSoftShadowMap : SN.T.PCFShadowMap;
    if (SN.sun.shadow.mapSize.x !== cfg.map) {
      SN.sun.shadow.mapSize.set(cfg.map, cfg.map);
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
    const t = SN.$("qualityToggle");
    if (t)
      t.textContent = "画质：" + (SN.quality.mode === "auto" ? "自动 · " + ["低", "中", "高"][SN.quality.level] : SN.quality.mode);
  };

  SN.refreshEnvironment = function refreshEnvironment() {
    if (SN.environmentTarget)
      SN.environmentTarget.dispose();
    SN.environmentTarget = SN.pmrem.fromScene(SN.environmentScene, 0.06, 0.1, 220);
    SN.scene.environment = SN.environmentTarget.texture;
    SN.envMinute = SN.minutes;
  };

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
    return SN.smoothRange(354, 366, time) * (1 - SN.smoothRange(1134, 1146, time));
  };

  SN.cycleTimePreset = function cycleTimePreset() {
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
    const sunset = Math.max(1 - SN.smoothRange(0, 14, Math.abs(SN.minutes - 360)), 1 - SN.smoothRange(0, 14, Math.abs(SN.minutes - 1140)));
    SN.night = 1 - day;
    SN.skyUniforms.top.value.copy(SN.dayTop).lerp(SN.sunsetTop, sunset * 0.55).lerp(SN.nightTop, SN.night * 0.94);
    SN.skyUniforms.horizon.value.copy(SN.dayHorizon).lerp(SN.nightHorizon, SN.night).lerp(SN.sunsetHorizon, sunset * 0.88);
    SN.skyUniforms.night.value = SN.night;
    SN.skyUniforms.sunDir.value.set(Math.cos(solarAngle), elevation, 0.22 * elevation).normalize();
    // Blue-grey aerial perspective, warmed only at the horizon near sunset.
    SN.scene.fog.color.copy(SN.skyUniforms.horizon.value).lerp(SN.skyUniforms.top.value, 0.4).convertSRGBToLinear();
    SN.scene.fog.color.lerp(SN.hazeLinear, 0.1 * (1 - SN.night * 0.8));
    // Ambient sky fill stays well under the key light; otherwise shadows flatten
    // and every surface reads as the same pale grey.
    SN.hemi.intensity = 0.08 + day * 0.3 + sunset * 0.05;
    SN.hemi.color.setRGB(SN.lerp(0.26, 0.58, day), SN.lerp(0.34, 0.71, day), SN.lerp(0.46, 0.85, day));
    SN.hemi.color.lerp(SN.warmSun, sunset * 0.3);
    SN.hemi.groundColor.setRGB(SN.lerp(0.055, 0.27, day) + sunset * 0.045, SN.lerp(0.06, 0.245, day) + sunset * 0.025, SN.lerp(0.07, 0.205, day));
    SN.sun.color.copy(SN.daySun).lerp(SN.warmSun, sunset);
    SN.sun.intensity = day * (0.24 + 2.35 * Math.sqrt(Math.max(0, elevation))) + sunset * 0.55;
    SN.renderer.toneMappingExposure = 0.9 + day * 0.13 + sunset * 0.05;
    const px = SN.started ? SN.playerRender.x : 0,
      pz = SN.started ? SN.playerRender.z : 0,
      py = SN.started ? SN.playerRender.y : 0;
    // Keep the cool rim light behind the subject from the camera's point of view,
    // so hair, collars and shoulders get a legible edge in the neon hours.
    SN.rimLight.position.set(px + Math.sin(SN.camYaw) * 13, py + 5.2, pz + Math.cos(SN.camYaw) * 13);
    SN.rimLight.target.position.set(px, py + 1.15, pz);
    SN.rimLight.intensity = 0.18 + SN.night * 0.5;
    const texel = 130 / SN.sun.shadow.mapSize.x;
    if (SN.sunAnchorX === null || Math.hypot(px - SN.sunAnchorX, pz - SN.sunAnchorZ) > 4) {
      SN.sunAnchorX = Math.round(px / texel) * texel;
      SN.sunAnchorZ = Math.round(pz / texel) * texel;
    }
    SN.sun.position.set(SN.sunAnchorX + SN.skyUniforms.sunDir.value.x * 380, py + SN.skyUniforms.sunDir.value.y * 380, SN.sunAnchorZ + SN.skyUniforms.sunDir.value.z * 380);
    SN.sun.target.position.set(SN.sunAnchorX, py, SN.sunAnchorZ);
    const envScale = 0.16 + day * 0.84;
    for (let i = 0; i < SN.envMats.length; i++)
      SN.envMats[i].material.envMapIntensity = SN.envMats[i].base * envScale;
    for (let i = 0; i < SN.buildingMats.length; i++)
      SN.buildingMats[i].emissiveIntensity = 0.05 + SN.night * 1.55;
    SN.lampGlow.emissiveIntensity = SN.night * 3;
    SN.poolMat.opacity = SN.night * 0.42;
    SN.detailDisplayMat.emissiveIntensity = 0.25 + SN.night * 1.2;
    SN.detailVendingFront.emissiveIntensity = 0.3 + SN.night * 1.1;
    SN.detailNeonGlowMat.opacity = 0.05 + SN.night * 0.42;
    SN.headMat.emissiveIntensity = SN.night * 2.4;
    SN.tailMat.emissiveIntensity = 0.12 + SN.night * 1.6;
    for (let i = 0; i < SN.neonMats.length; i++)
      SN.neonMats[i].emissiveIntensity = 0.5 + SN.night * 1.4;
    SN.waterNight.value = SN.night;
    SN.waterMat.color.setRGB(SN.lerp(0.06, 0.025, SN.night), SN.lerp(0.22, 0.11, SN.night), SN.lerp(0.23, 0.13, SN.night));
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
      const picked = [b1, b2, b3], dists = [d1, d2, d3];
      for (let i = 0; i < 3; i++) {
        const l = SN.streetLights[i], p = picked[i];
        if (i < lampCount && p && Math.sqrt(dists[i]) < 58) {
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
    // Re-bake the IBL only every couple of in-game hours; the sky changes too
    // gradually to justify a PMREM rebuild (and its hitch) more often.
    if (Math.abs(SN.minutes - SN.envMinute) > 120)
      SN.refreshEnvironment();
  };

  SN.placePuddles = function placePuddles() {
    SN.puddleAnchorX = SN.playerRender.x;
    SN.puddleAnchorZ = SN.playerRender.z;
    for (let i = 0; i < 26; i++) {
      let x = SN.playerRender.x, z = SN.playerRender.z, y = 0;
      for (let tries = 0; tries < 6; tries++) {
        const a = SN.surfaceRandom() * SN.TAU, r = 7 + SN.surfaceRandom() * 40;
        x = SN.playerRender.x + Math.sin(a) * r;
        z = SN.playerRender.z + Math.cos(a) * r;
        y = SN.surfaceHeight(x, z);
        if (!SN.isWater(x, z, 2.5) && SN.hillHeight(x, z) < 8)
          break;
        if (tries === 5)
          y = SN.surfaceHeight(SN.playerRender.x, SN.playerRender.z);
      }
      SN.dummy.position.set(x, y + 0.025, z);
      SN.dummy.rotation.set(0, SN.surfaceRandom() * SN.TAU, 0);
      SN.dummy.scale.set(2.4 + SN.surfaceRandom() * 4.2, 1, 1.5 + SN.surfaceRandom() * 3.2);
      SN.dummy.updateMatrix();
      SN.puddleMesh.setMatrixAt(i, SN.dummy.matrix);
    }
    SN.puddleMesh.instanceMatrix.needsUpdate = true;
  };

  SN.toggleWet = function toggleWet() {
    SN.wetTarget = SN.wetTarget > 0.5 ? 0 : 1;
    SN.wetMode = SN.wetTarget > 0.5;
    if (SN.wetMode && Math.hypot(SN.playerRender.x - SN.puddleAnchorX, SN.playerRender.z - SN.puddleAnchorZ) > 1)
      SN.placePuddles();
    SN.toast(SN.wetMode ? "街道 · 湿滑反光开启" : "街道 · 干燥路面", 2.4);
  };

  SN.updateWetness = function updateWetness(dt) {
    SN.wetness += (SN.wetTarget - SN.wetness) * Math.min(1, dt * 2.6);
    const w = SN.wetness;
    SN.asphalt.color.copy(SN.asphaltBaseColor).lerp(SN.asphaltWetColor, w * 0.82);
    SN.asphalt.roughnessMap = w > 0.06 ? SN.asphaltWetRough : SN.asphaltDryRough;
    if (SN.asphaltEnvEntry)
      SN.asphaltEnvEntry.base = 0.35 + 2.1 * w;
    if (w > 0.03) {
      SN.puddleMesh.visible = true;
      SN.puddleMaterial.opacity = w * 0.88;
      if (Math.hypot(SN.playerRender.x - SN.puddleAnchorX, SN.playerRender.z - SN.puddleAnchorZ) > 18)
        SN.placePuddles();
    }
    else
      SN.puddleMesh.visible = false;
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
    SN.texAniso = Math.min(8, SN.renderer.capabilities.getMaxAnisotropy());
    SN.renderer.outputEncoding = SN.T.sRGBEncoding;
    SN.renderer.toneMapping = SN.T.ACESFilmicToneMapping;
    SN.renderer.toneMappingExposure = 1.02;
    SN.renderer.shadowMap.enabled = true;
    SN.renderer.shadowMap.type = SN.T.PCFShadowMap;
    SN.scene = new SN.T.Scene();
    SN.headlight = new SN.T.SpotLight(0xffe6be, 0, 90, Math.PI / 5, 0.65, 1.2);
    SN.scene.add(SN.headlight, SN.headlight.target);
    SN.scene.fog = new SN.T.Fog(0xbfd8ea, 900, 3000);
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
        uGrain: { value: 0.012 },
        uVignette: { value: 0.24 },
        uBlur: { value: 0 },
        uContrast: { value: 0.1 },
        uSaturation: { value: 1.05 }
      },
      vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uGrain,uVignette,uBlur,uContrast,uSaturation;uniform vec2 uResolution;varying vec2 vUv;
float filmHash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract(p.x*p.y);}
vec3 motionSample(vec2 uv,float amount){vec3 sum=vec3(0.);float total=0.;for(int i=0;i<6;i++){float t=float(i)/5.;float w=1.-t*.62;sum+=texture2D(tDiffuse,uv-(uv-.5)*amount*.05*t).rgb*w;total+=w;}return sum/total;}
// The scene pass is already ACES tone mapped by the renderer and written to the
// composer target in linear space (render targets skip outputEncoding in r128).
// Encode exactly once here with the same sRGB curve the renderer uses when post
// is off, so 低画质 and 中/高画质 agree.
vec3 linearToSRGB(vec3 c){c=max(c,vec3(0.));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){
 vec3 c=uBlur>.001?motionSample(vUv,uBlur):texture2D(tDiffuse,vUv).rgb;
 c=linearToSRGB(c);
 // Contrast and saturation belong in display space, not in linear radiance.
 float lum=dot(c,vec3(.2126,.7152,.0722));
 c=mix(c,c*c*(3.-2.*c),uContrast);
 c=mix(vec3(lum),c,uSaturation);
 c*=vec3(1.018,1.,.982);
 float vig=1.-smoothstep(.42,1.02,length(vUv-.5)*1.35);
 c*=mix(1.,vig,uVignette);
 float grain=filmHash(vUv*uResolution+fract(uTime)*97.3)*2.-1.;
 c+=grain*uGrain*(.6+.4*(1.-lum));
 gl_FragColor=vec4(clamp(c,0.,1.),1.);
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
 float rot=hash12(gl_FragCoord.xy+uTime)*6.2831853;
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
      top: { value: new SN.T.Color(0x3a7cbf) },
      horizon: { value: new SN.T.Color(0xbfd8ea) },
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
 c=mix(c,horizon*1.01+vec3(.01,.02,.035),pow(1.-h,7.)*.22);
 vec3 sd=normalize(sunDir);float s=dot(d,sd),sunAmt=max(s,0.);
 // Mie forward scatter and a physically small solar disc.
 c+=vec3(1.,.6,.28)*pow(sunAmt,10.)*.38*(1.-night);
 c+=vec3(1.,.46,.16)*pow(sunAmt,3.)*.11*(1.-night);
 c+=vec3(.34,.2,.09)*pow(sunAmt,1.2)*.05*(1.-night);
 c+=vec3(1.,.86,.62)*smoothstep(.99986,.99996,s)*(1.-night)*3.4;
 // Stratified cloud deck: thin, wind-driven, warm only toward the sun.
 vec2 cuv=d.xz/(d.y+.18)*1.05+vec2(time*.0045,time*.0018);
 float n=fbm(cuv*1.35)+fbm(cuv*3.2+vec2(4.,9.))*.22;
 float cloud=smoothstep(.6,.86,n)*smoothstep(.012,.14,d.y);
 vec3 cloudDay=mix(vec3(.84,.82,.76),vec3(.54,.62,.7),smoothstep(0.,.62,d.y));
 cloudDay=mix(cloudDay,vec3(.98,.65,.4),pow(sunAmt,2.)*.55*(1.-night));
 vec3 cloudCol=mix(cloudDay,vec3(.05,.075,.11),night);
 c=mix(c,cloudCol,cloud*.55*(1.-night*.4));
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
    SN.environmentTarget = SN.pmrem.fromScene(SN.environmentScene, 0.06, 0.1, 220);
    SN.envMinute = -1000000000;
    SN.scene.environment = SN.environmentTarget.texture;
    SN.waterCompile = SN.waterMat.onBeforeCompile;
    SN.waterMat.onBeforeCompile = shader => {
      SN.waterCompile(shader);
      shader.fragmentShader = shader.fragmentShader.replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );", "float lakeFresnel=pow(1.-max(dot(normal,normalize(vViewPosition)),0.),4.); outgoingLight=mix(outgoingLight,vec3(.43,.61,.66)*(1.-uNight*.65),lakeFresnel*.35);\ngl_FragColor = vec4( outgoingLight, diffuseColor.a );");
    };
    // Layered distant scenery: two mountain ranges west/south, a skyline ring east.
    SN.distantMats = [];
    // Seoul is ringed by mountains: three overlapping ranges close the horizon in every direction.
    SN.mountainLayer(4400, 150, 110, 330, 62, 0x93a7a3, 0, SN.TAU, 0x203544, 0.85);
    SN.mountainLayer(4120, 110, 70, 230, 66, 0x6b8480, 0, SN.TAU, 0x172a37, 0.9);
    SN.mountainLayer(3880, 80, 35, 125, 58, 0x55706c, 0, SN.TAU, 0x142632, 0.95);
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
    SN.dayTop = new SN.T.Color(0x3a7cbf);
    SN.sunsetTop = new SN.T.Color(0x4a5f7a);
    SN.nightTop = new SN.T.Color(0x061426);
    SN.dayHorizon = new SN.T.Color(0xbfd8ea);
    SN.sunsetHorizon = new SN.T.Color(0xe0a071);
    SN.nightHorizon = new SN.T.Color(0x152c40);
    SN.warmSun = new SN.T.Color(0xffb066);
    SN.daySun = new SN.T.Color(0xfff2d8);
    SN.hazeLinear = new SN.T.Color(0x8fa8bb).convertSRGBToLinear();
    SN.fogTmp = new SN.T.Color();
    // T retains time preview controls; the shared solar clock continues from each.
    SN.timePresets = [
      { m: 510, label: "清晨 · 08:30" },
      { m: 750, label: "正午 · 12:30" },
      { m: 1138, label: "黄昏 · 18:58" },
      { m: 1320, label: "夜晚 · 22:00" }
    ];
    SN.presetIndex = -1;
    // ---------------- Wet street system ----------------
    SN.wetTarget = 0;
    SN.wetness = 0;
    SN.wetMode = false;
    SN.puddleAnchorX = 1000000000;
    SN.puddleAnchorZ = 1000000000;
    SN.asphaltEnvEntry = SN.envMats.find(entry => entry.material === SN.asphalt) || null;
    SN.puddleSurface = SN.getSurface("puddle");
    SN.puddleMaterial = new SN.T.MeshPhysicalMaterial({
      map: SN.puddleSurface.map,
      normalMap: SN.puddleSurface.normalMap,
      roughnessMap: SN.puddleSurface.roughnessMap,
      color: 0xffffff,
      roughness: 1,
      metalness: 0.18,
      envMapIntensity: 1.8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: SN.T.DoubleSide
    });
    SN.puddleMaterial.normalScale.set(0.3, 0.3);
    SN.puddleGeo = new SN.T.PlaneGeometry(1, 1);
    SN.puddleGeo.rotateX(-SN.PI / 2);
    SN.puddleMesh = new SN.T.InstancedMesh(SN.puddleGeo, SN.puddleMaterial, 26);
    SN.puddleMesh.instanceMatrix.setUsage(SN.T.DynamicDrawUsage);
    SN.puddleMesh.frustumCulled = false;
    SN.puddleMesh.castShadow = false;
    SN.puddleMesh.receiveShadow = false;
    SN.puddleMesh.visible = false;
    SN.scene.add(SN.puddleMesh);
  });
})(window.SN);
