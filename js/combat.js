/* 武器、命中检测、伤害、音效与战斗特效。 */
"use strict";
(function (SN) {
  SN.wpart = function wpart(parent, geo, material, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new SN.T.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  SN.buildBatonModel = function buildBatonModel() {
    const g = new SN.T.Group();
    SN.wpart(g, SN.cyl(0.03, 0.034, 0.18, 8), SN.batonGrip, 0, -0.06, 0.01);
    SN.wpart(g, SN.cyl(0.021, 0.026, 0.5, 8), SN.batonBody, 0, -0.4, 0.01);
    SN.wpart(g, SN.cyl(0.03, 0.03, 0.035, 8), SN.gunAccent, 0, -0.66, 0.01);
    SN.wpart(g, SN.box, SN.gunAccent, 0, -0.16, 0.02, 0, 0, 0, 0.055, 0.03, 0.055);
    g.userData.muzzle = new SN.T.Object3D();
    g.userData.muzzle.position.set(0, -0.6, 0.01);
    g.add(g.userData.muzzle);
    return g;
  };

  SN.buildPistolModel = function buildPistolModel() {
    const g = new SN.T.Group();
    SN.wpart(g, SN.roundedBox(0.058, 0.17, 0.075, 0.02), SN.gunPoly, 0, -0.045, 0.03, 0.22);
    SN.wpart(g, SN.roundedBox(0.062, 0.08, 0.235, 0.018), SN.gunSteel, 0, -0.17, -0.015);
    SN.wpart(g, SN.cyl(0.012, 0.012, 0.17, 8), SN.gunSteel, 0, -0.3, -0.015, 0.06);
    SN.wpart(g, SN.box, SN.gunAccent, 0, -0.115, -0.13, 0, 0, 0, 0.045, 0.018, 0.09);
    SN.wpart(g, SN.box, SN.gunSteel, 0, -0.105, 0.085, 0, 0, 0, 0.022, 0.02, 0.03);
    g.userData.muzzle = new SN.T.Object3D();
    g.userData.muzzle.position.set(0, -0.39, -0.015);
    g.add(g.userData.muzzle);
    return g;
  };

  SN.buildRifleModel = function buildRifleModel() {
    const g = new SN.T.Group();
    SN.wpart(g, SN.roundedBox(0.07, 0.3, 0.085, 0.02), SN.gunSteel, 0, -0.16, -0.01);
    SN.wpart(g, SN.box, SN.gunPoly, 0, -0.4, -0.01, 0, 0, 0, 0.06, 0.34, 0.075);
    SN.wpart(g, SN.cyl(0.014, 0.014, 0.4, 8), SN.gunSteel, 0, -0.64, -0.015);
    SN.wpart(g, SN.cyl(0.026, 0.026, 0.16, 8), SN.gunPoly, 0, -0.55, -0.015);
    SN.wpart(g, SN.box, SN.gunPoly, 0, -0.58, 0.02, 0, 0, 0, 0.032, 0.13, 0.04);
    SN.wpart(g, SN.box, SN.gunAccent, 0, -0.2, 0.05, 0, 0, 0, 0.085, 0.045, 0.14);
    SN.wpart(g, SN.box, SN.gunSteel, 0, -0.25, -0.1, 0, 0, 0, 0.04, 0.14, 0.07);
    SN.wpart(g, SN.box, SN.gunPoly, 0, 0, -0.07, 0, 0, 0, 0.05, 0.24, 0.06);
    SN.wpart(g, SN.cyl(0.026, 0.026, 0.12, 8), SN.gunSteel, 0, -0.23, 0.055);
    SN.wpart(g, SN.box, SN.gunAccent, 0, -0.23, 0.075, 0, 0, 0, 0.012, 0.03, 0.012);
    g.userData.muzzle = new SN.T.Object3D();
    g.userData.muzzle.position.set(0, -0.85, -0.015);
    g.add(g.userData.muzzle);
    return g;
  };

  SN.updateWeaponVisuals = function updateWeaponVisuals() {
    const drawn = !SN.holstered && SN.selectedWeapon >= 0 && !SN.player.car && !SN.player.dead && SN.playerRoot.visible;
    for (let i = 0; i < 3; i++) {
      const owned = SN.weapons[i].owned,
        fists = !!SN.weapons[i].fists,
        hol = owned && !fists && (!drawn || i !== SN.selectedWeapon);
      SN.holsterModels[i].visible = hol;
      SN.heldWeapons[i].visible = drawn && i === SN.selectedWeapon && !fists;
      if (SN.heldWeapons[i].visible)
        SN.playerRig.weapon.visible = true;
      if (fists)
        SN.playerRig.weapon.visible = false;
    }
  };

  SN.addPickup = function addPickup(x, z, kind) {
    const root = new SN.T.Group();
    root.position.set(x, SN.groundHeight(x, z) + 0.25, z);
    SN.scene.add(root);
    SN.meshAt(new SN.T.TorusGeometry(0.5, 0.045, 5, 16), SN.pickupMaterial, 0, 0.05, 0, 1, 1, 1, 0, root).rotation.x = SN.PI / 2;
    const item = SN.meshAt(kind === "armor" ? new SN.T.OctahedronGeometry(0.27) : SN.roundedBox(0.13, 0.13, kind === 2 ? 0.8 : 0.43, 0.05), SN.pickupMaterial, 0, 0.7, 0, 1, 1, 1, 0, root);
    SN.glow(root, 0, 0.6, 0, 1.6, 0xffcd80);
    SN.pickups.push({ x, z, kind, root, item, cooldown: 0 });
  };

  SN.spawnTracer = function spawnTracer(from, to, enemy = false) {
    const b = SN.bullets[SN.bulletCursor++ % SN.bullets.length];
    b.from.copy(from);
    b.dir.subVectors(to, from);
    b.dist = b.dir.length();
    if (b.dist < 0.02)
      return;
    b.dir.multiplyScalar(1 / b.dist);
    b.len = Math.min(1.5, Math.max(0.28, b.dist));
    b.travel = b.len * 0.5;
    b.total = 0.068;
    b.life = b.total;
    b.speed = SN.clamp(b.dist / 0.048, 160, 1800);
    b.enemy = enemy;
    b.mesh.material.color.setHex(enemy ? 0xff8a62 : 0xffe6b8);
    b.mesh.material.opacity = 0.92;
    b.mesh.visible = true;
  };

  SN.updateTracers = function updateTracers(dt) {
    for (const b of SN.bullets) {
      if (b.life <= 0)
        continue;
      b.life -= dt;
      b.travel += b.speed * dt;
      if (b.life <= 0 || b.travel - b.len * 0.5 >= b.dist) {
        b.life = 0;
        b.mesh.visible = false;
        continue;
      }
      const head = Math.min(b.travel, b.dist), half = b.len * 0.5;
      SN.bulletPos.copy(b.from).addScaledVector(b.dir, Math.max(0, head - half));
      b.mesh.position.copy(SN.bulletPos);
      SN.bulletView.copy(SN.camera.position).sub(SN.bulletPos);
      if (SN.bulletView.lengthSq() < 0.00001)
        SN.bulletView.set(0, 1, 0);
      SN.bulletRight.crossVectors(b.dir, SN.bulletView);
      if (SN.bulletRight.lengthSq() < 0.00001)
        SN.bulletRight.set(Math.abs(b.dir.x) > 0.9 ? 0 : 1, Math.abs(b.dir.x) > 0.9 ? 1 : 0, 0);
      else
        SN.bulletRight.normalize();
      SN.bulletNormal.crossVectors(SN.bulletRight, b.dir).normalize();
      SN.bulletMatrix.makeBasis(SN.bulletRight, b.dir, SN.bulletNormal);
      b.mesh.quaternion.setFromRotationMatrix(SN.bulletMatrix);
      const fade = SN.clamp(b.life / b.total, 0, 1);
      b.mesh.scale.set(0.032, b.len * (0.72 + 0.28 * fade), 1);
      b.mesh.material.opacity = 0.92 * fade;
    }
  };

  SN.spawnMuzzleFlash = function spawnMuzzleFlash(pos, enemy = false) {
    if (!enemy)
      return;
    const f = SN.muzzleFlashes[SN.muzzleFlashCursor++ % SN.muzzleFlashes.length];
    f.sprite.position.copy(pos);
    f.sprite.material.color.setHex(0xffa96e);
    f.sprite.material.opacity = 0.85;
    f.sprite.scale.setScalar(SN.rand(0.7, 1.1));
    f.sprite.visible = true;
    f.life = 0.06;
    SN.enemyMuzzleLight.position.copy(pos);
    SN.enemyMuzzleLight.intensity = 2.4;
    SN.enemyMuzzleTime = 0.06;
  };

  SN.updateMuzzleFlashes = function updateMuzzleFlashes(dt) {
    for (const f of SN.muzzleFlashes)
      if (f.life > 0) {
        f.life -= dt;
        f.sprite.material.opacity = Math.max(0, f.life / 0.06) * 0.85;
        f.sprite.visible = f.life > 0;
        f.sprite.scale.multiplyScalar(1 + dt * 8);
      }
    SN.enemyMuzzleTime = Math.max(0, SN.enemyMuzzleTime - dt);
    if (SN.enemyMuzzleTime <= 0)
      SN.enemyMuzzleLight.intensity = 0;
  };

  SN.spawnDust = function spawnDust(x, y, z, color = 0xb9ad98, scale = 1) {
    const d = SN.dustPuffs[SN.dustCursor++ % SN.dustPuffs.length];
    d.sprite.position.set(x, y, z);
    d.sprite.material.color.setHex(color);
    d.sprite.material.opacity = 0.7;
    d.sprite.scale.setScalar(0.24 * scale);
    d.sprite.visible = true;
    d.life = d.total;
    d.scale = scale;
  };

  SN.updateDust = function updateDust(dt) {
    for (const d of SN.dustPuffs)
      if (d.life > 0) {
        d.life -= dt;
        const k = 1 - d.life / d.total;
        d.sprite.material.opacity = 0.7 * (1 - k);
        d.sprite.scale.setScalar(0.24 * d.scale + k * 0.9 * d.scale);
        d.sprite.visible = d.life > 0;
      }
  };

  SN.buildCashStack = function buildCashStack() {
    const g = new SN.T.Group();
    for (let i = 0; i < 3; i++)
      SN.meshAt(SN.box, i % 2 ? SN.cashMatB : SN.cashMatA, 0, 0.045 + i * 0.032, 0, 0.34, 0.03, 0.18, 0, g);
    SN.meshAt(SN.box, SN.cashBand, 0, 0.075, 0, 0.35, 0.07, 0.045, 0, g);
    SN.meshAt(SN.box, SN.cashBand, 0, 0.075, 0.07, 0.35, 0.07, 0.02, 0, g);
    return g;
  };

  SN.spawnDrop = function spawnDrop(a, cashOverride, x, z, baseY) {
    const cash = typeof cashOverride === "number" ? cashOverride : a.kind === "civilian" ? Math.round(SN.rand(20, 120)) : a.kind === "gang" || a.missionEnemy ? Math.round(SN.rand(80, 300)) : 0;
    const armed = a.kind === "gang" || a.missionEnemy || (a.armedWeapon !== undefined && a.armedWeapon >= 0 && a.kind !== "police");
    const weapon = armed ? (SN.rnd() < 0.55 ? 1 : 2) : -1;
    const ammo = weapon === 2 ? Math.round(SN.rand(12, 24)) : weapon === 1 ? Math.round(SN.rand(6, 12)) : 0;
    if (cash <= 0 && weapon < 0)
      return;
    const dropX = Number.isFinite(x) ? x : a.x, dropZ = Number.isFinite(z) ? z : a.z;
    let d = null;
    for (const slot of SN.dropPool)
      if (!slot.active) {
        d = slot;
        break;
      }
    if (!d)
      return;
    d.active = true;
    d.root.visible = true;
    d.x = dropX;
    d.z = dropZ;
    d.baseY = Number.isFinite(baseY) ? baseY : SN.groundHeight(dropX, dropZ) + 0.05;
    d.root.position.set(dropX, d.baseY, dropZ);
    d.cashAmount = cash;
    d.weapon = weapon;
    d.ammo = ammo;
    d.cashLife = cash > 0 ? 45 : 0;
    d.weaponLife = weapon >= 0 ? 30 : 0;
    d.cash.visible = cash > 0;
    d.pistol.visible = weapon === 1;
    d.rifle.visible = weapon === 2;
    d.halo.visible = cash > 0 || weapon >= 0;
    d.halo.material.color.setHex(weapon >= 0 ? 0xffb875 : 0xffe0a0);
  };

  SN.updateDrops = function updateDrops(dt) {
    SN.dropClock += dt;
    for (const d of SN.dropPool) {
      if (!d.active)
        continue;
      if (d.cashLife > 0) {
        d.cashLife -= dt;
        if (d.cashLife <= 0) {
          d.cashLife = 0;
          d.cash.visible = false;
        }
      }
      if (d.weaponLife > 0) {
        d.weaponLife -= dt;
        if (d.weaponLife <= 0) {
          d.weaponLife = 0;
          d.pistol.visible = false;
          d.rifle.visible = false;
        }
      }
      if (d.cashLife <= 0 && d.weaponLife <= 0) {
        d.active = false;
        d.root.visible = false;
        continue;
      }
      d.cash.rotation.y = SN.simTime * 1.7;
      d.cash.position.y = 0.22 + Math.sin(SN.simTime * 2.4) * 0.045;
      d.pistol.rotation.z = SN.simTime * 0.8;
      d.rifle.rotation.z = SN.simTime * 0.55;
      d.root.position.y = d.baseY + Math.sin(SN.simTime * 1.7) * 0.025;
      if (d.weaponLife > 0)
        d.halo.material.opacity = SN.clamp(0.5 + Math.sin(SN.simTime * 4) * 0.18, 0.15, 0.85);
      if (!SN.player.car && !SN.player.dead && Math.hypot(d.x - SN.player.x, d.z - SN.player.z) < 1.6) {
        let y = SN.groundUnder(d.x, d.z, 0.2) + 1.1;
        if (d.cashLife > 0) {
          SN.money += d.cashAmount;
          SN.showPopup("+ ¥ " + d.cashAmount, "#ffe0a0", d.x, y, d.z);
          d.cashLife = 0;
          d.cash.visible = false;
        }
        if (d.weaponLife > 0) {
          const w = SN.weapons[d.weapon], first = !w.owned;
          const rounds = d.ammo;
          w.owned = true;
          if (first) {
            w.mag = Math.min(w.capacity, rounds);
            w.reserve = Math.max(0, rounds - w.mag);
            SN.showPopup("获得 " + w.name, "#b8ffd0", d.x, y + 0.25, d.z, 1.6);
          }
          else
            w.reserve = Math.min(240, w.reserve + rounds);
          SN.showPopup("+ 弹药 ×" + rounds, "#ffd39a", d.x, y, d.z);
          if (d.weapon === 1)
            SN.campaign.loadoutLost = false;
          d.weaponLife = 0;
          d.pistol.visible = false;
          d.rifle.visible = false;
          SN.refreshWeaponSlots();
        }
        d.active = false;
        d.root.visible = false;
        d.halo.visible = false;
      }
    }
  };

  SN.ejectShell = function ejectShell(pos, rightX, rightZ) {
    const s = SN.shells[SN.shellCursor++ % SN.shells.length];
    s.x = pos.x + rightX * 0.08;
    s.y = pos.y + 0.02;
    s.z = pos.z + rightZ * 0.08;
    s.vx = rightX * SN.rand(1.4, 2.6);
    s.vz = rightZ * SN.rand(1.4, 2.6);
    s.vy = SN.rand(1.2, 2.2);
    s.rx = SN.rand(0, SN.TAU);
    s.ry = SN.rand(0, SN.TAU);
    s.rz = SN.rand(0, SN.TAU);
    s.life = s.total = SN.rand(0.9, 1.4);
  };

  SN.updateShells = function updateShells(dt) {
    let count = 0;
    for (const s of SN.shells) {
      if (s.life <= 0)
        continue;
      s.life -= dt;
      s.vy -= 17 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const floor = SN.surfaceHeight(s.x, s.z) + 0.035;
      if (s.y < floor) {
        s.y = floor;
        s.vy *= -0.32;
        s.vx *= 0.62;
        s.vz *= 0.62;
      }
      s.rx += dt * 7;
      s.rz += dt * 9;
      if (s.life > 0) {
        SN.dummy.position.set(s.x, s.y, s.z);
        SN.dummy.rotation.set(s.rx, s.ry, s.rz);
        SN.dummy.scale.setScalar(SN.clamp(s.life * 3, 0, 1));
        SN.dummy.updateMatrix();
        SN.shellMesh.setMatrixAt(count++, SN.dummy.matrix);
      }
    }
    SN.shellMesh.count = count;
    if (count)
      SN.shellMesh.instanceMatrix.needsUpdate = true;
  };

  SN.emitSparks = function emitSparks(x, y, z, count, hot = true) {
    for (let i = 0; i < count; i++) {
      const idx = SN.sparkCursor++ % SN.sparkCount, s = SN.sparkStates[idx], ang = SN.rand(0, SN.TAU), up = SN.rand(0.2, 1.9);
      s.x = x;
      s.y = y;
      s.z = z;
      s.vx = Math.sin(ang) * SN.rand(0.6, 3);
      s.vz = Math.cos(ang) * SN.rand(0.6, 3);
      s.vy = up;
      s.life = s.total = SN.rand(0.18, 0.52);
      const c = hot ? [1, SN.rand(0.55, 0.85), 0.25] : [0.55, 0.5, 0.42];
      SN.sparkColors[idx * 3] = c[0];
      SN.sparkColors[idx * 3 + 1] = c[1];
      SN.sparkColors[idx * 3 + 2] = c[2];
      SN.sparkPositions[idx * 3] = x;
      SN.sparkPositions[idx * 3 + 1] = y;
      SN.sparkPositions[idx * 3 + 2] = z;
    }
  };

  SN.updateSparks = function updateSparks(dt) {
    let dirty = false;
    for (let i = 0; i < SN.sparkCount; i++) {
      const s = SN.sparkStates[i];
      if (s.life <= 0) {
        if (SN.sparkPositions[i * 3 + 1] > -900) {
          SN.sparkPositions[i * 3 + 1] = -999;
          dirty = true;
        }
        continue;
      }
      s.life -= dt;
      s.vy -= 11 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vx *= 0.96;
      s.vz *= 0.96;
      if (s.y < SN.surfaceHeight(s.x, s.z) + 0.02) {
        s.y = SN.surfaceHeight(s.x, s.z) + 0.02;
        s.vy *= -0.25;
        s.vx *= 0.6;
        s.vz *= 0.6;
      }
      SN.sparkPositions[i * 3] = s.x;
      SN.sparkPositions[i * 3 + 1] = s.y;
      SN.sparkPositions[i * 3 + 2] = s.z;
      const fade = s.life / s.total;
      SN.sparkColors[i * 3] *= 0.985;
      SN.sparkColors[i * 3 + 1] *= 0.985;
      SN.sparkColors[i * 3 + 2] *= 0.985;
      if (fade <= 0.01)
        s.life = 0;
      dirty = true;
    }
    if (dirty) {
      SN.sparkGeo.attributes.position.needsUpdate = true;
      SN.sparkGeo.attributes.color.needsUpdate = true;
    }
  };

  SN.spawnDecal = function spawnDecal(x, y, z, normalX, normalY, normalZ, tint = 0x8a7b68) {
    const d = SN.decals[SN.decalCursor++ % SN.decals.length], m = d.mesh;
    m.position.set(x + normalX * 0.025, y + normalY * 0.025, z + normalZ * 0.025);
    m.lookAt(m.position.x + normalX, m.position.y + normalY, m.position.z + normalZ);
    m.rotateZ(SN.rand(0, SN.TAU));
    const sc = SN.rand(0.65, 1.25);
    m.scale.set(sc, sc, sc);
    m.material.color.setHex(tint);
    m.material.opacity = 0.62;
    m.visible = true;
    d.life = 7;
  };

  SN.updateDecals = function updateDecals(dt) {
    for (const d of SN.decals) {
      if (d.life <= 0)
        continue;
      d.life -= dt;
      d.mesh.material.opacity = SN.clamp(d.life / 2.2, 0, 0.62);
      if (d.life <= 0)
        d.mesh.visible = false;
    }
  };

  SN.showHitMarker = function showHitMarker() {
    SN.hitMarkerTime = 0.18;
    SN.$("hitmark").classList.add("show");
  };

  SN.startAudio = function startAudio() {
    try {
      if (!SN.audio) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context)
          return;
        const context = new Context(),
          osc = context.createOscillator(),
          gain = context.createGain(),
          filter = context.createBiquadFilter();
        osc.type = "sawtooth";
        filter.type = "lowpass";
        filter.frequency.value = 180;
        gain.gain.value = 0;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);
        osc.start();
        SN.audio = { context, osc, gain, filter };
      }
      SN.audio.context.resume().catch(() => {
      });
    }
    catch (_) {
    }
  };

  SN.ensureNoise = function ensureNoise() {
    if (!SN.audio)
      return null;
    if (SN.noiseBuffer)
      return SN.noiseBuffer;
    const c = SN.audio.context;
    SN.noiseBuffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.6), c.sampleRate);
    const data = SN.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = Math.random() * 2 - 1;
    return SN.noiseBuffer;
  };

  SN.noiseHit = function noiseHit(duration, gain, filterType, frequency, q = 1, delay = 0) {
    if (!SN.audio)
      return;
    const c = SN.audio.context, t = c.currentTime + delay, buffer = SN.ensureNoise();
    if (!buffer)
      return;
    const src = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, t);
    filter.Q.value = q;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0006, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start(t);
    src.stop(t + duration + 0.03);
  };

  SN.tone = function tone(type, from, to, duration, gain, delay = 0) {
    if (!SN.audio)
      return;
    const c = SN.audio.context, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0006, t + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + duration + 0.03);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  };

  SN.soundShot = function soundShot() {
    SN.tone("triangle", 170, 45, 0.08, 0.04);
    SN.noiseHit(0.07, 0.05, "lowpass", 900, 1);
  };

  SN.soundWeapon = function soundWeapon(index) {
    if (!SN.audio)
      return;
    if (index === 0) {
      SN.noiseHit(0.22, 0.055, "bandpass", 620, 1.4);
      SN.tone("sine", 180, 90, 0.18, 0.02);
    }
    else if (index === 1) {
      SN.noiseHit(0.11, 0.16, "bandpass", 1250, 1.1);
      SN.noiseHit(0.05, 0.1, "highpass", 2600, 1);
      SN.tone("sine", 150, 52, 0.13, 0.09);
    }
    else {
      SN.noiseHit(0.07, 0.12, "bandpass", 1900, 1.2);
      SN.noiseHit(0.035, 0.07, "highpass", 3400, 1);
      SN.tone("sine", 120, 48, 0.07, 0.07);
    }
  };

  SN.soundReload = function soundReload() {
    SN.noiseHit(0.035, 0.07, "bandpass", 2200, 2, 0);
    SN.noiseHit(0.045, 0.09, "bandpass", 1200, 1.5, 0.22);
    SN.noiseHit(0.03, 0.06, "bandpass", 3000, 2, 0.42);
    SN.tone("square", 140, 90, 0.03, 0.02, 0.22);
  };

  SN.soundImpact = function soundImpact(impact) {
    if (!SN.audio)
      return;
    const g = SN.clamp(impact / 18, 0.15, 1);
    SN.noiseHit(0.12, 0.06 * g, "lowpass", 420, 1);
    SN.tone("triangle", 260, 70, 0.1, 0.05 * g);
  };

  SN.selectWeapon = function selectWeapon(index) {
    if (!SN.canControl())
      return;
    if (!SN.weapons[index] || !SN.weapons[index].owned) {
      SN.toast("该武器尚未获得 · 从敌人掉落或任务奖励中获取", 3);
      return;
    }
    SN.selectedWeapon = index;
    SN.holstered = false;
    SN.reloadTime = 0;
    SN.refreshHUD();
  };

  SN.cycleWeapon = function cycleWeapon(direction) {
    if (!SN.canControl())
      return;
    let index = SN.selectedWeapon;
    for (let n = 0; n < SN.weapons.length; n++) {
      index = (index + direction + SN.weapons.length) % SN.weapons.length;
      if (SN.weapons[index].owned) {
        SN.selectWeapon(index);
        return;
      }
    }
  };

  SN.reload = function reload() {
    if (!SN.canControl())
      return;
    const w = SN.weapons[SN.selectedWeapon];
    if (w && w.capacity && w.mag < w.capacity && w.reserve > 0 && !SN.reloadTime && !SN.holstered && !SN.player.car) {
      SN.reloadTime = SN.selectedWeapon === 2 ? 1.9 : 1.3;
      SN.soundReload();
    }
  };

  SN.hurtPlayer = function hurtPlayer(amount, bypassArmor = false) {
    if (SN.player.dead || !Number.isFinite(amount) || amount <= 0)
      return;
    SN.player.hitReact = 0.45;
    const absorbed = bypassArmor ? 0 : Math.min(SN.player.armor, amount * 0.7);
    SN.player.armor -= absorbed;
    SN.player.health = Math.max(0, SN.player.health - (amount - absorbed));
    SN.player.lastHurt = SN.simTime;
    SN.$("damage").style.opacity = 0.35;
    if (SN.player.health <= 0) {
      SN.failMission("你已倒下，医疗站将接应你");
      SN.player.dead = 4;
      SN.firing = SN.aiming = false;
      SN.reloadTime = 0;
      SN.clearInput();
      const penalty = Math.min(SN.money, Math.max(150, Math.round(SN.money * 0.08)));
      SN.money -= penalty;
      SN.saveCampaign();
      SN.$("downscreen").classList.add("visible");
      SN.$("respawnText").textContent = "医疗转运中 · 费用 ¥ " + penalty;
      if (document.pointerLockElement)
        document.exitPointerLock();
    }
  };

  SN.respawn = function respawn() {
    let hospital = SN.hospitals[0];
    for (const h of SN.hospitals)
      if (Math.hypot(h.x - SN.player.x, h.z - SN.player.z) < Math.hypot(hospital.x - SN.player.x, hospital.z - SN.player.z))
        hospital = h;
    if (SN.player.car) {
      SN.player.car.speed = SN.player.car.vx = SN.player.car.vz = 0;
      SN.player.car.parked = true;
      SN.player.car = null;
    }
    SN.player.x = hospital.x;
    SN.player.z = hospital.z;
    SN.player.y = SN.surfaceHeight(SN.player.x, SN.player.z);
    SN.player.health = 100;
    SN.player.armor = 30;
    SN.player.hitReact = 0;
    SN.player.motionSpeed = 0;
    SN.player.fallPeak = SN.player.y;
    SN.player.vy = 0;
    SN.player.grounded = true;
    SN.player.speed = 0;
    SN.player.dead = 0;
    SN.player.bail = null;
    SN.playerRoot.rotation.x = 0;
    SN.holstered = true;
    SN.heat = 0;
    SN.wantedSearch = 0;
    SN.wantedResisted = false;
    SN.arrestState = null;
    SN.$("arrestPrompt").classList.remove("visible");
    SN.clearWantedResponse();
    SN.playerRoot.visible = true;
    for (const crew of SN.crews)
      crew.anger = 0;
    for (const a of SN.actors) {
      a.hostile = false;
      a.linger = 0;
      if (a.inCar && a.inCar.role !== "traffic") {
        a.inCar.occupant = null;
        a.inCar = null;
        a.x = a.homeX;
        a.z = a.homeZ;
      }
      if (a.kind === "police")
        a.active = false;
    }
    for (const c of SN.pursuitCars) {
      c.occupant = null;
      c.active = false;
      c.root.visible = false;
      c.speed = c.vx = c.vz = 0;
    }
    SN.playerRoot.rotation.z = 0;
    Object.assign(SN.playerRig.motion, { speed: 0, weight: 0, lean: 0, phase: 0 });
    for (const leg of SN.playerRig.legs)
      leg.planted = false;
    SN.camTarget.set(SN.player.x, SN.player.y + 1.3, SN.player.z);
    SN.lookTarget.copy(SN.camTarget);
    SN.camera.position.set(SN.player.x + 5, SN.player.y + 3, SN.player.z);
    SN.$("downscreen").classList.remove("visible");
    SN.toast("已在最近的医疗站恢复 · 收起武器可避免挑衅街区", 4);
  };

  SN.solidRayDistance = function solidRayDistance(origin, direction, maxDistance, padding = 0) {
    let nearest = maxDistance;
    const stamp = ++SN.rayQueryId,
      ex = origin.x + direction.x * maxDistance,
      ez = origin.z + direction.z * maxDistance,
      x0 = SN.clamp(Math.floor((Math.min(origin.x, ex) - padding + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1),
      x1 = SN.clamp(Math.floor((Math.max(origin.x, ex) + padding + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1),
      z0 = SN.clamp(Math.floor((Math.min(origin.z, ez) - padding + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1),
      z1 = SN.clamp(Math.floor((Math.max(origin.z, ez) + padding + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1);
    for (let iz = z0; iz <= z1; iz++)
      for (let ix = x0; ix <= x1; ix++) {
        for (const b of SN.bins[iz * SN.BIN_COUNT + ix]) {
          if (b.rayStamp === stamp)
            continue;
          b.rayStamp = stamp;
          let low = 0, high = nearest;
          for (let axis = 0; axis < 3; axis++) {
            const o = axis === 0 ? origin.x : axis === 1 ? origin.y : origin.z,
              d = axis === 0 ? direction.x : axis === 1 ? direction.y : direction.z,
              min = (axis === 0 ? b.minX : axis === 1 ? b.minY : b.minZ) - padding,
              max = (axis === 0 ? b.maxX : axis === 1 ? b.height : b.maxZ) + padding;
            if (Math.abs(d) < 0.00001) {
              if (o < min || o > max) {
                low = Infinity;
                break;
              }
            }
            else {
              let a = (min - o) / d, c = (max - o) / d;
              if (a > c) {
                const tmp = a;
                a = c;
                c = tmp;
              }
              low = Math.max(low, a);
              high = Math.min(high, c);
              if (low > high)
                break;
            }
          }
          if (low <= high)
            nearest = Math.min(nearest, Math.max(0, low));
        }
        const oc = SN.obbBins[iz * SN.BIN_COUNT + ix];
        for (let oi = 0; oi < oc.length; oi++) {
          const b = oc[oi];
          if (b.rayStamp === stamp)
            continue;
          b.rayStamp = stamp;
          const ox = origin.x - b.x,
            oz = origin.z - b.z,
            lo = [ox * b.cos - oz * b.sin, origin.y, ox * b.sin + oz * b.cos],
            ld = [direction.x * b.cos - direction.z * b.sin, direction.y, direction.x * b.sin + direction.z * b.cos];
          let low = 0, high = nearest;
          for (let axis = 0; axis < 3; axis++) {
            const min = (axis === 0 ? -b.hw : axis === 1 ? b.minY : -b.hd) - padding,
              max = (axis === 0 ? b.hw : axis === 1 ? b.height : b.hd) + padding;
            if (Math.abs(ld[axis]) < 0.00001) {
              if (lo[axis] < min || lo[axis] > max) {
                low = Infinity;
                break;
              }
            }
            else {
              let a = (min - lo[axis]) / ld[axis], c = (max - lo[axis]) / ld[axis];
              if (a > c) {
                const tmp = a;
                a = c;
                c = tmp;
              }
              low = Math.max(low, a);
              high = Math.min(high, c);
              if (low > high)
                break;
            }
          }
          if (low <= high)
            nearest = Math.min(nearest, Math.max(0, low));
        }
      }
    return nearest;
  };

  SN.visibleBetween = function visibleBetween(ax, ay, az, bx, by, bz) {
    SN.shotOrigin.set(ax, ay, az);
    SN.shotVector.set(bx - ax, by - ay, bz - az);
    const distance = SN.shotVector.length();
    if (distance < 0.01)
      return true;
    SN.shotVector.multiplyScalar(1 / distance);
    return SN.solidRayDistance(SN.shotOrigin, SN.shotVector, distance) >= distance - 0.3;
  };

  SN.hitActor = function hitActor(a, damage, dirX = 0, dirZ = 0, headshot = false, source = "bullet") {
    if (!a.active || a.down)
      return;
    if (a.missionEnemy && a.enemyRole === 3 && !headshot)
      damage *= 0.65;
    const lethal = a.health - damage <= 0;
    a.health -= damage;
    a.panic = 12;
    a.flinch = 0.42;
    a.lastHit = SN.simTime;
    if (a.kind === "gang") {
      SN.crews[a.crew].anger = 40;
      for (const other of SN.actors)
        if (other.crew === a.crew && other.kind === "gang")
          other.hostile = true;
    }
    if (a.kind === "police") {
      SN.wantedResisted = true;
      a.resisted = true;
      a.hostile = true;
      SN.commitCrime(lethal ? 4 : 3, lethal ? "击倒警员 ★4" : "袭击警员 ★3", "police", 55);
    }
    else if (a.kind === "civilian") {
      if (source === "bullet")
        SN.commitCrime(3, "射击路人 ★3", "gun", 45);
      else if (source === "car")
        SN.commitCrime(2, "驾车撞人 ★2", "vehicle", 50);
      else
        SN.commitCrime(lethal ? 2 : 1, lethal ? "击倒路人 ★2" : "袭击路人 ★1", "assault", 38);
    }
    else if (a.kind === "gang" && source !== "melee")
      SN.commitCrime(source === "car" ? 2 : 2, "街头冲突 ★2", "gun", 40);
    // Bullets shove on foot; no gore, just a clear physical flinch.
    const dl = Math.hypot(dirX, dirZ);
    if (dl > 0.0001 && !a.inCar) {
      const kb = headshot ? 0.24 : 0.42, nx = a.x + dirX / dl * kb, nz = a.z + dirZ / dl * kb;
      if (!SN.blocked(nx, nz, 0.3)) {
        a.x = nx;
        a.z = nz;
      }
    }
    if (!a.inCar && a.kind !== "civilian") {
      let cover = null, best = 18;
      for (const c of SN.cars) {
        if (!c.active)
          continue;
        const d = Math.hypot(c.x - a.x, c.z - a.z);
        if (d < best) {
          best = d;
          cover = c;
        }
      }
      if (cover) {
        const nx = cover.x - SN.player.x,
          nz = cover.z - SN.player.z,
          l = Math.hypot(nx, nz) || 1,
          off = cover.spec.length * 0.52 + 1.1,
          cx = cover.x + nx / l * off,
          cz = cover.z + nz / l * off;
        if (!SN.blocked(cx, cz, 0.32) && !SN.isWater(cx, cz, 0.2)) {
          a.coverX = cx;
          a.coverZ = cz;
          a.coverTimer = SN.rand(1.8, 3.4);
          a.coverSet = true;
        }
      }
    }
    if (a.health <= 0) {
      a.down = 22;
      a.fall = 0;
      a.hostile = false;
      a.coverTimer = 0;
      a.stagger = false;
      if (a.kind === "gang")
        SN.missionDefeated.add(a.index);
      if (!a.dropGiven) {
        a.dropGiven = true;
        SN.spawnDrop(a);
      }
    }
    else if (!a.missionEnemy && a.health <= 22 && damage >= 10 && a.down <= 0) {
      a.down = 5.5;
      a.fall = 0;
      a.hostile = false;
      a.stagger = true;
      if (a.kind === "gang")
        SN.missionDefeated.add(a.index);
    }
    SN.hitTime = 0.18;
    SN.showHitMarker();
  };

  SN.actorRayDistance = function actorRayDistance(a, origin, direction, limit) {
    const scale = a.rig.height, base = a.rig.root.position.y;
    // A crouched NPC's visual torso is lowered by the cover pose; carry that into
    // the hit test so shots at the visible body still connect.
    const crouch = (a.rig.torso.position.y - SN.TORSO_Y) * scale;
    let distance = limit, head = false;
    for (let zi = 0; zi < SN.hitZones.length; zi++) {
      const zone = SN.hitZones[zi], zoneY = base + zone[0] * scale + (zone[0] > 0.9 ? crouch : 0);
      SN.hitCenter.set(a.x, zoneY, a.z);
      SN.hitOffset.subVectors(SN.hitCenter, origin);
      const along = SN.hitOffset.dot(direction),
        radius = zone[1] * scale,
        across = SN.hitOffset.dot(SN.hitOffset) - along * along;
      if (along > 0 && across < radius * radius) {
        const hit = Math.max(0, along - Math.sqrt(radius * radius - across));
        if (hit < distance) {
          distance = hit;
          head = zi === 0;
        }
      }
    }
    SN.actorRayInfo.distance = distance;
    SN.actorRayInfo.head = head;
    return distance;
  };

  SN.vehicleRayDistance = function vehicleRayDistance(c, origin, direction, limit) {
    const sn = Math.sin(c.yaw), co = Math.cos(c.yaw), dx = origin.x - c.x, dz = origin.z - c.z;
    const o = [dx * co - dz * sn, origin.y - c.root.position.y, dx * sn + dz * co],
      d = [direction.x * co - direction.z * sn, direction.y, direction.x * sn + direction.z * co],
      min = [-c.spec.width / 2, 0.2, -c.spec.length / 2],
      max = [c.spec.width / 2, c.spec.height + 0.05, c.spec.length / 2];
    let low = 0, high = limit;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 0.00001) {
        if (o[i] < min[i] || o[i] > max[i])
          return limit;
      }
      else {
        let a = (min[i] - o[i]) / d[i], b = (max[i] - o[i]) / d[i];
        if (a > b) {
          const v = a;
          a = b;
          b = v;
        }
        low = Math.max(low, a);
        high = Math.min(high, b);
        if (low > high)
          return limit;
      }
    }
    return low <= high ? low : limit;
  };

  SN.fireWeapon = function fireWeapon() {
    if (!SN.canControl())
      return;
    const w = SN.weapons[SN.selectedWeapon];
    if (!w || SN.holstered || SN.player.car || SN.player.dead || SN.shotClock > 0 || SN.reloadTime)
      return;
    // Pistol and baton are semi-automatic: one press, one shot. Rifle holds full-auto.
    if (SN.selectedWeapon !== 2) {
      if (!SN.triggerPressed)
        return;
      SN.triggerPressed = false;
    }
    if (w.capacity && w.mag === 0) {
      SN.reload();
      return;
    }
    SN.shotClock = w.rate;
    SN.attackTime = w.rate;
    if (SN.selectedWeapon === 0) {
      SN.meleeHitDone = false;
      SN.addShotSpread(0.08);
      SN.soundWeapon(0);
      return;
    }
    w.mag--;
    // Spread grows with movement, firing and hip-fire; aiming tightens the cone.
    const moving = SN.clamp(SN.player.motionSpeed / 6.5, 0, 1),
      spread = (SN.aiming ? 0.0018 : 0.0075) + moving * (SN.aiming ? 0.0045 : 0.013) + SN.shotSpread * (SN.aiming ? 0.014 : 0.026);
    SN.camera.getWorldDirection(SN.cameraDirection);
    SN.cameraDirection.x += (Math.random() * 2 - 1) * spread;
    SN.cameraDirection.y += (Math.random() * 2 - 1) * spread * 0.75;
    SN.cameraDirection.z += (Math.random() * 2 - 1) * spread;
    SN.cameraDirection.normalize();
    const origin = SN.camera.position;
    let distance = SN.solidRayDistance(origin, SN.cameraDirection, w.range),
      target = null,
      carTarget = null,
      targetHead = false;
    SN.shotRay.set(origin, SN.cameraDirection);
    for (const a of SN.actors) {
      if (!a.active || a.down || a.inCar)
        continue;
      const hit = SN.actorRayDistance(a, origin, SN.cameraDirection, distance);
      if (hit < distance) {
        distance = hit;
        target = a;
        carTarget = null;
        targetHead = SN.actorRayInfo.head;
      }
    }
    for (const c of SN.cars) {
      if (!c.active || c === SN.player.car)
        continue;
      const hit = SN.vehicleRayDistance(c, origin, SN.cameraDirection, distance);
      if (hit < distance) {
        distance = hit;
        target = null;
        carTarget = c;
        targetHead = false;
      }
    }
    const endpoint = SN.hitEndpoint.copy(origin).addScaledVector(SN.cameraDirection, distance);
    const anchor = SN.heldWeapons[SN.selectedWeapon].userData.muzzle;
    anchor.getWorldPosition(SN.shotOrigin);
    SN.shotVector.subVectors(endpoint, SN.shotOrigin);
    const length = SN.shotVector.length();
    if (length < 0.00001)
      return;
    SN.shotVector.multiplyScalar(1 / length);
    const clear = SN.solidRayDistance(SN.shotOrigin, SN.shotVector, length);
    SN.shotEnd.copy(SN.shotOrigin).addScaledVector(SN.shotVector, clear);
    SN.spawnTracer(SN.shotOrigin, SN.shotEnd, false);
    // Muzzle light, flash sprite, brass and recoil: all at the held weapon's muzzle.
    SN.muzzleLight.position.copy(SN.shotOrigin);
    SN.muzzleLight.intensity = SN.selectedWeapon === 2 ? 2.4 : 3;
    SN.muzzleSprite.position.copy(SN.shotOrigin);
    SN.muzzleSprite.material.opacity = 0.96;
    SN.muzzleSprite.material.color.setHex(0xffca7a);
    SN.muzzleSprite.scale.setScalar(SN.rand(1, 1.9));
    SN.muzzleSprite.visible = true;
    SN.muzzleFlashTime = 0.065;
    const rightX = Math.cos(SN.camYaw), rightZ = -Math.sin(SN.camYaw);
    SN.ejectShell(SN.shotOrigin, rightX, rightZ);
    SN.recoilPitch = SN.clamp(SN.recoilPitch + (SN.selectedWeapon === 2 ? 0.0065 : 0.013), 0, 0.075);
    SN.recoilYaw += (Math.random() - 0.5) * 0.006;
    SN.armRecoil = SN.selectedWeapon === 2 ? 0.5 : 0.72;
    SN.camShake = Math.max(SN.camShake, SN.selectedWeapon === 2 ? 0.028 : 0.04);
    SN.camShakeTime = 0.14;
    SN.addShotSpread(SN.selectedWeapon === 2 ? 0.06 : 0.16);
    SN.soundWeapon(SN.selectedWeapon);
    if (clear >= length - 0.4) {
      if (target) {
        const falloff = SN.clamp(1 - Math.max(0, distance - 9) / w.range * 0.55, 0.35, 1),
          damage = w.damage * falloff * (targetHead ? 1.8 : 1);
        SN.hitActor(target, damage, SN.shotVector.x, SN.shotVector.z, targetHead, "bullet");
        SN.emitSparks(SN.shotEnd.x, SN.shotEnd.y, SN.shotEnd.z, 4, false);
        SN.spawnDust(SN.shotEnd.x, SN.shotEnd.y, SN.shotEnd.z, 0x9c8f7c, 0.6);
        SN.soundImpact(8);
      }
      else if (carTarget) {
        const before = carTarget.health;
        carTarget.health = Math.max(0, carTarget.health - w.damage * 0.4 * carTarget.spec.damage);
        carTarget.speed *= 0.92;
        SN.hitTime = 0.1;
        SN.showHitMarker();
        SN.emitSparks(SN.shotEnd.x, SN.shotEnd.y, SN.shotEnd.z, 8, true);
        SN.soundImpact(10);
        if (carTarget.role === "police") {
          if (carTarget.health <= 0 && before > 0)
            SN.commitCrime(5, "毁坏警车 ★5", "policeCar", 60);
          else
            SN.commitCrime(2, "袭击警车 ★2", "policeCar", 50);
        }
      }
    }
    else {
      // Surface hit: sparks, a short dust puff, and a small decal on the plane we struck.
      const ground = Math.abs(SN.shotEnd.y - SN.surfaceHeight(SN.shotEnd.x, SN.shotEnd.z)) < 0.22;
      const nx = ground ? 0 : -SN.shotVector.x, nz = ground ? 0 : -SN.shotVector.z, ny = ground ? 1 : 0;
      SN.emitSparks(SN.shotEnd.x, SN.shotEnd.y, SN.shotEnd.z, ground ? 5 : 9, !ground);
      SN.spawnDust(SN.shotEnd.x, SN.shotEnd.y, SN.shotEnd.z, ground ? 0xa79b88 : 0x8c8174, ground ? 1 : 0.7);
      SN.spawnDecal(SN.shotEnd.x, SN.shotEnd.y, SN.shotEnd.z, nx, ny, nz, ground ? 0x6e6656 : 0x7d7468);
    }
    // A shot at a person already files its own crime; only open-ground or vehicle
    // shots add the public-discharge charge. Scaring bystanders always happens.
    if (SN.simTime - SN.lastGunCrime > 1.6) {
      SN.lastGunCrime = SN.simTime;
      if (!target)
        SN.commitCrime(2, "公共场所开枪 ★2", "gun", 58);
      SN.scareCivilians(SN.player.x, SN.player.z, 30);
    }
  };

  SN.addShotSpread = function addShotSpread(amount) {
    SN.shotSpread = SN.clamp(SN.shotSpread + amount, 0, 1.2);
  };

  SN.updateCombat = function updateCombat(dt) {
    SN.shotClock = Math.max(0, SN.shotClock - dt);
    SN.attackTime = Math.max(0, SN.attackTime - dt);
    SN.hitTime = Math.max(0, SN.hitTime - dt);
    SN.camShakeTime = Math.max(0, SN.camShakeTime - dt);
    SN.camShake *= Math.exp(-dt * 7);
    SN.recoilPitch = SN.lerp(SN.recoilPitch, 0, 1 - Math.exp(-dt * (SN.aiming ? 8 : 12)));
    SN.recoilYaw *= Math.exp(-dt * 10);
    SN.armRecoil = SN.lerp(SN.armRecoil, 0, 1 - Math.exp(-dt * 13));
    SN.shotSpread = Math.max(0, SN.shotSpread - dt * (SN.aiming ? 2.1 : 1.6));
    SN.muzzleFlashTime -= dt;
    if (SN.muzzleFlashTime <= 0) {
      SN.muzzleLight.intensity = 0;
      SN.muzzleSprite.visible = false;
    }
    if (SN.hitMarkerTime > 0) {
      SN.hitMarkerTime -= dt;
      if (SN.hitMarkerTime <= 0)
        SN.$("hitmark").classList.remove("show");
    }
    SN.updateShells(dt);
    SN.updateSparks(dt);
    SN.updateDecals(dt);
    // Baton damage lands inside the visible swing window, with knockback.
    if (SN.selectedWeapon === 0 && SN.attackTime > 0 && !SN.meleeHitDone && SN.attackTime < 0.36 && SN.attackTime > 0.14 && !SN.holstered && !SN.player.car && !SN.player.dead) {
      const reach = SN.weapons[0].range;
      let best = null, bestDistance = reach;
      for (const a of SN.actors) {
        if (!a.active || a.down || a.inCar)
          continue;
        const dx = a.x - SN.player.x, dz = a.z - SN.player.z, d = Math.hypot(dx, dz);
        if (d < bestDistance && Math.cos(Math.atan2(dx, dz) - SN.player.yaw) > 0.2 && SN.visibleBetween(SN.player.x, SN.player.y + 1, SN.player.z, a.x, a.rig.root.position.y + 1, a.z)) {
          bestDistance = d;
          best = a;
        }
      }
      if (best) {
        SN.hitActor(best, SN.weapons[0].damage, Math.sin(SN.player.yaw), Math.cos(SN.player.yaw), false, "melee");
        SN.emitSparks(best.x, best.rig.root.position.y + 1.1, best.z, 3, false);
        SN.soundImpact(10);
      }
      SN.meleeHitDone = true;
    }
    if (SN.player.dead) {
      SN.player.dead -= dt;
      if (SN.player.dead <= 0)
        SN.respawn();
    }
    else {
      if (SN.firing)
        SN.fireWeapon();
      if (SN.reloadTime > 0) {
        SN.reloadTime -= dt;
        if (SN.reloadTime <= 0) {
          const w = SN.weapons[SN.selectedWeapon];
          if (w) {
            const count = Math.min(w.capacity - w.mag, w.reserve);
            w.mag += count;
            w.reserve -= count;
            SN.soundReload();
          }
        }
      }
      if (SN.simTime - SN.player.lastHurt > 12 && SN.simTime - SN.lastCrime > 10)
        SN.player.health = Math.min(100, SN.player.health + dt * 3);
    }
    SN.updateTracers(dt);
    SN.updateMuzzleFlashes(dt);
    SN.updateDust(dt);
    SN.updateDrops(dt);
    SN.updateWanted(dt);
    for (const p of SN.pickups) {
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.root.visible = p.cooldown === 0;
      p.item.rotation.y = SN.simTime * 1.4;
      p.item.position.y = 0.75 + Math.sin(SN.simTime * 2) * 0.15;
      if (p.cooldown === 0 && !SN.player.car && !SN.player.dead && Math.hypot(p.x - SN.player.x, p.z - SN.player.z) < 1.5) {
        p.cooldown = 45;
        if (p.kind === "armor") {
          SN.player.armor = 100;
          SN.toast("护甲补充至 100", 2);
        }
        else {
          const w = SN.weapons[p.kind], first = !w.owned;
          w.owned = true;
          w.reserve = Math.min(240, w.reserve + (first ? 0 : w.capacity * 3));
          if (first)
            SN.selectWeapon(p.kind);
          SN.toast("已拾取 " + w.name + " · H 收起 / 1–3 切换", 3);
        }
      }
    }
    for (let team = 0; team < SN.crews.length; team++)
      if (SN.crews[team].anger > 0 && SN.player.car)
        SN.spawnPursuit("gang", team);
    for (const c of SN.pursuitCars)
      if (c.active && c !== SN.player.car) {
        if ((c.role === "police" ? SN.heat === 0 : SN.crews[c.team].anger <= 0) && Math.hypot(c.x - SN.player.x, c.z - SN.player.z) > 80) {
          if (c.occupant) {
            c.occupant.inCar = null;
            c.occupant.active = c.role !== "police";
            c.occupant.x = c.occupant.homeX;
            c.occupant.z = c.occupant.homeZ;
            c.occupant = null;
          }
          c.active = false;
          c.root.visible = false;
        }
      }
    SN.$("damage").style.opacity = SN.simTime - SN.player.lastHurt < 0.3 ? 0.35 : 0;
    document.documentElement.classList.toggle("aiming", SN.aiming && !SN.holstered && !SN.player.car);
    document.documentElement.classList.toggle("armed", !SN.holstered && SN.selectedWeapon >= 0 && !SN.player.car && !SN.player.dead);
    document.documentElement.classList.toggle("hit", SN.hitTime > 0);
    if (SN.audio) {
      const c = SN.player.car, t = SN.audio.context.currentTime;
      SN.audio.osc.frequency.setTargetAtTime(c ? c.spec.pitch * (1 + Math.abs(c.speed) / c.spec.topSpeed * 3.2) : 35, t, 0.1);
      SN.audio.filter.frequency.setTargetAtTime(c ? c.spec.pitch * 4 + Math.abs(c.speed) * 14 : 180, t, 0.1);
      SN.audio.gain.gain.setTargetAtTime(c && !SN.paused && c.health > 0 ? (c.spec.bike ? 0.013 : 0.018) : 0, t, 0.12);
    }
  };
  // Startup phase 20: keep this order relative to the other systems.

  SN.registerInit(20, function initializeCombat20() {
    // Original low-poly weapon designs. Held models follow the right-hand joint; holstered ones sit on the body.
    SN.gunSteel = SN.mat(0x2d3c44, { metalness: 0.72, roughness: 0.3 });
    SN.gunPoly = SN.mat(0x40545a, { metalness: 0.35, roughness: 0.55 });
    SN.gunAccent = SN.mat(0xc79a58, { metalness: 0.65, roughness: 0.32 });
    SN.batonBody = SN.mat(0x394b52, { metalness: 0.4, roughness: 0.45 });
    SN.batonGrip = SN.mat(0x7d5946, { roughness: 0.9 });
    SN.cyl = (r1, r2, h, seg = 8) => new SN.T.CylinderGeometry(r1, r2, h, seg);
    SN.heldWeapons = [SN.buildBatonModel(), SN.buildPistolModel(), SN.buildRifleModel()];
    if (SN.playerRig.weapon.children.length) {
      SN.playerRig.weapon.children[0].visible = false;
      SN.playerRig.weapon.children[1].visible = false;
    }
    for (const model of SN.heldWeapons) {
      model.visible = false;
      SN.playerRig.weapon.add(model);
    }
    SN.holsterBaton = new SN.T.Group();
    SN.holsterPistol = new SN.T.Group();
    SN.holsterRifle = new SN.T.Group();
    SN.holsterBaton.position.set(-0.2, 0.92, -0.02);
    SN.holsterBaton.rotation.z = 0.22;
    SN.wpart(SN.holsterBaton, SN.cyl(0.021, 0.026, 0.5, 8), SN.batonBody, 0, -0.24, 0);
    SN.wpart(SN.holsterBaton, SN.cyl(0.03, 0.034, 0.15, 8), SN.batonGrip, 0, 0, 0);
    SN.playerRoot.add(SN.holsterBaton);
    SN.holsterPistol.position.set(0.205, 0.95, 0.03);
    SN.holsterPistol.rotation.set(0.1, 0, -0.3);
    SN.wpart(SN.holsterPistol, SN.roundedBox(0.055, 0.15, 0.07, 0.02), SN.gunSteel, 0, -0.09, 0);
    SN.wpart(SN.holsterPistol, SN.box, SN.gunPoly, 0, -0.01, 0.04, 0, 0, 0, 0.05, 0.08, 0.03);
    SN.playerRoot.add(SN.holsterPistol);
    SN.holsterRifle.position.set(0.02, 1.2, -0.16);
    SN.holsterRifle.rotation.set(0, 0, 0.5);
    SN.wpart(SN.holsterRifle, SN.roundedBox(0.07, 0.32, 0.08, 0.02), SN.gunSteel, 0, 0.05, 0);
    SN.wpart(SN.holsterRifle, SN.cyl(0.014, 0.014, 0.42, 8), SN.gunSteel, 0, 0.42, 0);
    SN.wpart(SN.holsterRifle, SN.box, SN.gunPoly, 0, -0.2, 0, 0, 0, 0, 0.06, 0.25, 0.07);
    SN.playerRoot.add(SN.holsterRifle);
    SN.holsterModels = [SN.holsterBaton, SN.holsterPistol, SN.holsterRifle];
    // Muzzle flash: one shared point light and additive sprite keep it cheap.
    SN.muzzleLight = new SN.T.PointLight(0xffb968, 0, 16, 2);
    SN.scene.add(SN.muzzleLight);
    SN.muzzleSprite = SN.glow(SN.scene, 0, 0, 0, 1.2, 0xffcf82);
    SN.muzzleSprite.visible = false;
    SN.muzzleFlashTime = 0;
    SN.muzzleWorld = new SN.T.Vector3();
  });
  // Startup phase 29: keep this order relative to the other systems.

  SN.registerInit(29, function initializeCombat29() {
    // Original weapons and deterministic pools; projectiles never allocate per shot.
    SN.weapons = [
      {
        name: "徒手 · 拳",
        damage: 24,
        rate: 0.4,
        range: 2.1,
        mag: 0,
        reserve: 0,
        capacity: 0,
        owned: true,
        fists: true
      },
      { name: "微隼 · 手枪", damage: 32, rate: 0.26, range: 130, mag: 8, reserve: 16, capacity: 8, owned: true },
      { name: "折光 · 步枪", damage: 24, rate: 0.105, range: 210, mag: 0, reserve: 0, capacity: 24, owned: false }
    ];
  });
  // Startup phase 31: keep this order relative to the other systems.

  SN.registerInit(31, function initializeCombat31() {
    SN.selectedWeapon = -1;
    SN.holstered = true;
    SN.aiming = false;
    SN.firing = false;
    SN.shotClock = 0;
    SN.reloadTime = 0;
    SN.attackTime = 0;
    SN.hitTime = 0;
    SN.heat = 0;
    SN.lastCrime = -100;
    SN.lastSeen = -100;
    SN.heatDecay = 0;
    SN.spawnClock = 0;
    SN.jumpBuffer = 0;
    SN.coyoteTime = 0;
    SN.triggerLatch = false;
    SN.camShake = 0;
    SN.camShakeTime = 0;
    SN.recoilPitch = 0;
    SN.recoilYaw = 0;
    SN.armRecoil = 0;
    SN.meleeHitDone = false;
    SN.shotSpread = 0;
    SN.hitMarkerTime = 0;
  });
  // Startup phase 33: keep this order relative to the other systems.

  SN.registerInit(33, function initializeCombat33() {
    SN.pickups = [];
    SN.shotVector = new SN.T.Vector3();
    SN.shotOrigin = new SN.T.Vector3();
    SN.shotEnd = new SN.T.Vector3();
    SN.shotRay = new SN.T.Ray();
    SN.cameraDirection = new SN.T.Vector3();
    SN.hitOffset = new SN.T.Vector3();
    SN.hitCenter = new SN.T.Vector3();
    SN.hitEndpoint = new SN.T.Vector3();
    SN.pickupMaterial = SN.mat(0xf3c776, { emissive: 0xe9a24c, emissiveIntensity: 1.5, metalness: 0.4, roughness: 0.3 });
    SN.addPickup(430, -390, "armor");
    SN.addPickup(880, -660, "armor");
    // Short additive tracer streaks. One quad per live round, oriented to the camera
    // so it reads from every angle without a full-length line hanging in the air.
    SN.tracerGeometry = new SN.T.PlaneGeometry(1, 1);
    SN.bullets = [];
    for (let i = 0; i < 72; i++) {
      const material = new SN.T.MeshBasicMaterial({
        color: 0xffe3b0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: SN.T.AdditiveBlending,
        side: SN.T.DoubleSide
      });
      const mesh = new SN.T.Mesh(SN.tracerGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      SN.scene.add(mesh);
      SN.bullets.push({
        mesh,
        from: new SN.T.Vector3(),
        dir: new SN.T.Vector3(),
        len: 1.5,
        dist: 0,
        travel: 0,
        speed: 400,
        life: 0,
        total: 0.07,
        enemy: false
      });
    }
    SN.bulletCursor = 0;
    SN.bulletView = new SN.T.Vector3();
    SN.bulletRight = new SN.T.Vector3();
    SN.bulletNormal = new SN.T.Vector3();
    SN.bulletMatrix = new SN.T.Matrix4();
    SN.bulletPos = new SN.T.Vector3();
    // Enemy muzzle flashes share a small sprite pool and one short-lived light.
    SN.enemyMuzzleLight = new SN.T.PointLight(0xffb06a, 0, 14, 2);
    SN.scene.add(SN.enemyMuzzleLight);
    SN.enemyMuzzleTime = 0;
    SN.muzzleFlashes = [];
    for (let i = 0; i < 8; i++) {
      const sprite = SN.glow(SN.scene, 0, 0, 0, 0.6, 0xffc27a);
      sprite.visible = false;
      SN.muzzleFlashes.push({ sprite, life: 0 });
    }
    SN.muzzleFlashCursor = 0;
    // Impact dust: a soft expanding card on top of the spark and decal passes.
    SN.dustCanvas = document.createElement("canvas");
    SN.dustCanvas.width = SN.dustCanvas.height = 64;
    SN.dustCtx = SN.dustCanvas.getContext("2d");
    SN.dustGrad = SN.dustCtx.createRadialGradient(32, 32, 2, 32, 32, 31);
    SN.dustGrad.addColorStop(0, "rgba(214,203,184,.8)");
    SN.dustGrad.addColorStop(0.55, "rgba(184,172,152,.35)");
    SN.dustGrad.addColorStop(1, "rgba(160,148,128,0)");
    SN.dustCtx.fillStyle = SN.dustGrad;
    SN.dustCtx.fillRect(0, 0, 64, 64);
    SN.dustTexture = SN.canvasTexture(SN.dustCanvas);
    SN.dustPuffs = [];
    for (let i = 0; i < 16; i++) {
      const sprite = new SN.T.Sprite(new SN.T.SpriteMaterial({ map: SN.dustTexture, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.visible = false;
      SN.scene.add(sprite);
      SN.dustPuffs.push({ sprite, life: 0, total: 0.32 });
    }
    SN.dustCursor = 0;
  });
  // Startup phase 35: keep this order relative to the other systems.

  SN.registerInit(35, function initializeCombat35() {
    // Knocked-out actors leave a spinning bill stack and, for armed crews, a weapon
    // with loose rounds. Drop slots are reused so the street never allocates.
    SN.cashMatA = SN.mat(0x86a86f, { roughness: 0.85, emissive: 0x1d2b16, emissiveIntensity: 0.3 });
    SN.cashMatB = SN.mat(0xc8b98c, { roughness: 0.9 });
    SN.cashBand = SN.mat(0xd3b06a, { roughness: 0.55, metalness: 0.2 });
    SN.dropPool = [];
    for (let i = 0; i < 18; i++) {
      const root = new SN.T.Group();
      root.visible = false;
      SN.scene.add(root);
      const cash = SN.buildCashStack();
      cash.visible = false;
      root.add(cash);
      const pistol = SN.buildPistolModel();
      pistol.rotation.x = SN.PI / 2;
      pistol.position.y = 0.95;
      pistol.visible = false;
      root.add(pistol);
      const rifle = SN.buildRifleModel();
      rifle.rotation.x = SN.PI / 2;
      rifle.position.y = 1.05;
      rifle.visible = false;
      root.add(rifle);
      const halo = SN.glow(root, 0, 0.7, 0, 1.5, 0xffc677);
      halo.visible = false;
      SN.dropPool.push({
        root,
        cash,
        pistol,
        rifle,
        halo,
        active: false,
        cashAmount: 0,
        weapon: -1,
        ammo: 0,
        cashLife: 0,
        weaponLife: 0,
        x: 0,
        z: 0,
        baseY: 0
      });
    }
    SN.dropCursor = 0;
    SN.dropClock = 0;
    // Pooled shell casings: one instanced draw, fixed step physics.
    SN.shellMesh = new SN.T.InstancedMesh(SN.box, SN.mat(0xd6a24d, { metalness: 0.72, roughness: 0.3 }), 36);
    SN.shellMesh.instanceMatrix.setUsage(SN.T.DynamicDrawUsage);
    SN.shellMesh.frustumCulled = false;
    SN.shellMesh.count = 0;
    SN.scene.add(SN.shellMesh);
    SN.shells = Array.from({ length: 36 }, () => ({ x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, life: 0, total: 1 }));
    SN.shellCursor = 0;
    // Pooled impact sparks and fading surface decals.
    SN.sparkCount = 150;
    SN.sparkPositions = new Float32Array(SN.sparkCount * 3);
    SN.sparkColors = new Float32Array(SN.sparkCount * 3);
    SN.sparkStates = Array.from({ length: SN.sparkCount }, () => ({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, total: 1 }));
    SN.sparkCursor = 0;
    for (let i = 0; i < SN.sparkCount; i++) {
      SN.sparkPositions[i * 3 + 1] = -999;
    }
    SN.sparkGeo = new SN.T.BufferGeometry();
    SN.sparkGeo.setAttribute("position", new SN.T.BufferAttribute(SN.sparkPositions, 3));
    SN.sparkGeo.setAttribute("color", new SN.T.BufferAttribute(SN.sparkColors, 3));
    SN.sparkPoints = new SN.T.Points(SN.sparkGeo, new SN.T.PointsMaterial({
      size: 0.085,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: SN.T.AdditiveBlending
    }));
    SN.sparkPoints.frustumCulled = false;
    SN.scene.add(SN.sparkPoints);
    SN.decalCanvas = document.createElement("canvas");
    SN.decalCanvas.width = SN.decalCanvas.height = 64;
    SN.decalCtx = SN.decalCanvas.getContext("2d");
    SN.decalGrad = SN.decalCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    SN.decalGrad.addColorStop(0, "rgba(28,24,20,.85)");
    SN.decalGrad.addColorStop(0.35, "rgba(48,42,34,.55)");
    SN.decalGrad.addColorStop(1, "rgba(40,36,30,0)");
    SN.decalCtx.fillStyle = SN.decalGrad;
    SN.decalCtx.fillRect(0, 0, 64, 64);
    SN.decalTexture = SN.canvasTexture(SN.decalCanvas);
    SN.decalGeo = new SN.T.PlaneGeometry(0.3, 0.3);
    SN.decals = [];
    for (let i = 0; i < 18; i++) {
      const m = new SN.T.Mesh(SN.decalGeo, new SN.T.MeshBasicMaterial({
        map: SN.decalTexture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        opacity: 0
      }));
      m.visible = false;
      SN.scene.add(m);
      SN.decals.push({ mesh: m, life: 0 });
    }
    SN.decalCursor = 0;
    SN.audio = null;
    SN.noiseBuffer = null;
  });
  // Startup phase 37: keep this order relative to the other systems.

  SN.registerInit(37, function initializeCombat37() {
    SN.hospitals = [{ x: -690, z: -330 }, { x: 300, z: 990 }, ...SN.cityServices.map(h => ({ x: h.x, z: h.z, label: h.label }))];
    SN.policeStations = SN.cityServices.map(h => ({ x: h.policeX, z: h.policeZ, label: h.label }));
    for (const h of SN.policeStations) {
      const g = SN.cityGroup(h.x, h.z + 12, 1300);
      SN.cityPart(g, "cream", 0, 4, 0, 18, 8, 14);
      SN.cityPart(g, "teal", 0, 7, 7.2, 18, 1.5, 0.25);
      SN.cityPart(g, "glass", 0, 3, 7.2, 15, 3, 0.25);
      SN.citySolid(g, 0, 0, 18, 14, 9);
      SN.cityLabel(g, "파출소 · 治安站", 7.4, 16);
      SN.finishCityGroup(g);
    }
    SN.clinicMaterial = SN.mat(0xb8c8bf, { roughness: 0.72 });
    for (const h of SN.hospitals) {
      const base = SN.surfaceHeight(h.x, h.z);
      SN.meshAt(SN.box, SN.clinicMaterial, h.x, base + 7.5, h.z + 15, 14, 15, 12);
      SN.addCollider(h.x, h.z + 15, 14, 12, 15);
      const windows = [];
      for (let row = 0; row < 3; row++)
        for (let col = -2; col <= 2; col++)
          windows.push({ g: SN.box, x: col * 2.4, y: 6 + row * 3.1, z: 8.95, sx: 1.5, sy: 1.8, sz: 0.12 });
      SN.meshAt(SN.merged(windows), SN.glassMat, h.x, base, h.z);
      SN.sign("여울빛 진료소", h.x, base + 4, h.z + 8.85, 9, 1.3, SN.PI, true);
      SN.meshAt(SN.box, SN.mat(0xc5eee0, { emissive: 0x8adfce, emissiveIntensity: 0.5 }), h.x, base + 2.4, h.z + 8.8, 0.32, 1.3, 0.15);
      SN.meshAt(SN.box, SN.mat(0xc5eee0), h.x, base + 2.4, h.z + 8.8, 1.3, 0.32, 0.15);
    }
    // Ray / box slab intersection includes height, so upper floors do not block sky shots.
    SN.rayQueryId = 0;
    // Head / chest / leg capsule bands, matched to the 1.78 m rig's joint heights.
    SN.missionDefeated = new Set();
    // Five overlapping capsules from ankles to crown: no gaps at the waist or neck,
    // and only the top band counts as a headshot.
    SN.hitZones = [[1.655, 0.165], [1.43, 0.235], [1.2, 0.245], [0.96, 0.235], [0.66, 0.22]];
    SN.actorRayInfo = { distance: 0, head: false };
  });
})(window.SN);
