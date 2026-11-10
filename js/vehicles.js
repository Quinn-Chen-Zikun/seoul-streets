/* 车辆模型、驾驶物理、交通路线与车辆交互。 */
"use strict";
(function (SN) {
  // Metres throughout: 4.0–4.8 m vehicles; a 1.75 m humanoid at scale 1.

  SN.roundedBox = function roundedBox(w, h, d, r = 0.12) {
    const g = new SN.T.BoxGeometry(w, h, d, 4, 4, 6),
      p = g.attributes.position,
      n = g.attributes.normal,
      v = new SN.T.Vector3(),
      q = new SN.T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      q.set(SN.clamp(v.x, -w / 2 + r, w / 2 - r), SN.clamp(v.y, -h / 2 + r, h / 2 - r), SN.clamp(v.z, -d / 2 + r, d / 2 - r));
      v.sub(q).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
      q.addScaledVector(v, r);
      p.setXYZ(i, q.x, q.y, q.z);
    }
    return g;
  };

  SN.fitVehicle = function fitVehicle(c, type) {
    c.type = type;
    c.spec = SN.vehicleSpecs[type];
    const spec = c.spec, geo = SN.vehicleGeometry[type], body = c.body;
    // Refit only recycled, off-screen traffic. All geometries and trim materials are shared.
    for (const light of c.lights || [])
      light.material.dispose();
    c.lights = null;
    body.clear();
    for (const wheel of c.wheels)
      c.root.remove(wheel.pivot);
    c.wheels.length = 0;
    const color = type === 3 ? (c.serial % 2 ? 0xe99738 : 0xc7cdd1) : type === 6 ? 0x397d9d : type === 9 ? 0xd3e3e7 : type === 10 ? 0x225d5b : type === 11 ? 0x753e36 : SN.carColors[c.serial % SN.carColors.length];
    c.paint.color.setHex(color).convertSRGBToLinear();
    SN.meshAt(geo.body, c.paint, 0, 0, 0, 1, 1, 1, 0, body);
    const glass = SN.meshAt(geo.glass, SN.glassMat, 0, 0, 0, 1, 1, 1, 0, body);
    glass.castShadow = false;
    SN.meshAt(geo.trim, SN.tireMat, 0, 0, 0, 1, 1, 1, 0, body);
    SN.meshAt(geo.head, SN.headMat, 0, 0, 0, 1, 1, 1, 0, body);
    SN.meshAt(geo.tail, SN.tailMat, 0, 0, 0, 1, 1, 1, 0, body);
    if (geo.accent)
      SN.meshAt(geo.accent, SN.vehicleAccentMats[type === 9 ? 3 : type === 10 ? 1 : type === 11 ? 2 : 0], 0, 0, 0, 1, 1, 1, 0, body);
    if (type === 9)
      c.lights = [
        SN.glow(body, -0.36, spec.height + 0.23, -0.1, 1.15, 0x4a8fff),
        SN.glow(body, 0.36, spec.height + 0.23, -0.1, 1.15, 0xff5252)
      ];
    const radius = spec.bike ? 0.27 : spec.shape === "bus" ? 0.46 : spec.shape === "suv" || spec.shape === "pickup" || spec.shape === "redCrew" ? 0.4 : 0.33;
    c.wheelRadius = radius;
    for (const side of spec.bike ? [0] : [-1, 1])
      for (const end of [-1, 1]) {
        const pivot = new SN.T.Group(), wheel = new SN.T.Group();
        pivot.position.set(side * spec.width * 0.48, radius, end * spec.length * (spec.bike ? 0.36 : 0.32));
        wheel.scale.set(spec.bike ? 0.55 : 1, radius / 0.33, radius / 0.33);
        pivot.add(wheel);
        c.root.add(pivot);
        c.wheels.push({ pivot, wheel, front: end > 0, x: pivot.position.x, z: pivot.position.z });
      }
    c.cruise = spec.cruise * (0.86 + (c.serial % 5) * 0.06);
  };

  SN.makeCar = function makeCar(x, z, yaw, parked, route, index = 0, type = SN.cars.length % 4, role = "traffic") {
    const root = new SN.T.Group(), body = new SN.T.Group();
    root.add(body);
    SN.scene.add(root);
    const paint = new SN.T.MeshPhysicalMaterial({
      color: 0xffffff,
      map: SN.carPaintSurface.map,
      normalMap: SN.carPaintSurface.normalMap,
      roughnessMap: SN.carPaintSurface.roughnessMap,
      roughness: 1,
      metalness: 0.38,
      clearcoat: 0.8,
      clearcoatRoughness: 0.16 + (SN.cars.length % 5) * 0.035,
      envMapIntensity: 1.15
    });
    paint.normalScale.set(0.22, 0.22);
    SN.applyLocalUV(paint, 1.15, 1.15);
    SN.envMats.push({ material: paint, base: 1.15 });
    const car = {
      root,
      body,
      wheels: [],
      serial: SN.cars.length,
      role,
      x,
      z,
      yaw,
      speed: 0,
      vx: 0,
      vz: 0,
      parked,
      route,
      index,
      steer: 0,
      paint,
      health: 100,
      collisionTimer: 0,
      driver: !parked,
      active: true,
      spin: 0,
      roll: 0,
      pitch: 0,
      pitchV: 0,
      terrainRoll: 0,
      rollV: 0,
      y: SN.surfaceHeight(x, z),
      vy: 0,
      airborne: false,
      suspension: 0,
      suspensionV: 0,
      groundY: SN.surfaceHeight(x, z),
      freeRolling: false,
      occupant: null,
      stuck: 0
    };
    SN.fitVehicle(car, role === "police" ? 9 : type);
    if (route) {
      const lane = SN.roadSample(x, z);
      if (lane) {
        const offset = lane.profile.laneOffset;
        car.x += Math.cos(yaw) * offset;
        car.z -= Math.sin(yaw) * offset;
      }
    }
    root.position.set(car.x, SN.surfaceHeight(car.x, car.z), car.z);
    root.rotation.y = yaw;
    SN.cars.push(car);
    return car;
  };

  SN.trafficTypeAt = function trafficTypeAt(x, z, mainRoad = true) {
    const district = SN.cityDistrictAt(x, z).id;
    const mix = district === "gangnam" || district === "samseong" ? [7, 7, 7, 0, 2, 3, 1, 5] : district === "myeong" ? [8, 8, 8, 1, 3, 3, 5, 0] : district === "seongsu" || district === "gimpo" ? [4, 4, 5, 5, 2, 0, 1, 8] : [0, 0, 1, 1, 2, 3, 5, 8];
    return mainRoad && SN.rnd() < 0.15 ? 6 : mix[Math.floor(SN.rnd() * mix.length)];
  };

  SN.updateVehicleWheels = function updateVehicleWheels() {
    let count = 0;
    for (const c of SN.cars) {
      if (!c.active || !c.root.visible || Math.hypot(c.root.position.x - SN.playerRender.x, c.root.position.z - SN.playerRender.z) > 150)
        continue;
      c.root.updateMatrixWorld(true);
      for (const w of c.wheels) {
        for (const mesh of SN.wheelInstances)
          mesh.setMatrixAt(count, w.wheel.matrixWorld);
        count++;
      }
    }
    for (const mesh of SN.wheelInstances) {
      mesh.count = count;
      if (count) {
        mesh.instanceMatrix.updateRange.offset = 0;
        mesh.instanceMatrix.updateRange.count = count * 16;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  };

  SN.exitPosition = function exitPosition(c) {
    for (let ring = 0; ring < 4; ring++)
      for (let i = 0; i < 8; i++) {
        const a = c.yaw + SN.PI / 2 + i * SN.PI / 4, x = c.x + Math.sin(a) * (2.8 + ring), z = c.z + Math.cos(a) * (2.8 + ring);
        if (SN.blocked(x, z, 0.3))
          continue;
        let occupied = false;
        for (const other of SN.cars)
          if (other !== c && other.active && Math.hypot(x - other.x, z - other.z) < 2.7) {
            occupied = true;
            break;
          }
        if (!occupied)
          return { x, z };
      }
    return null;
  };

  SN.dismount = function dismount(c) {
    const a = c.occupant;
    if (!a)
      return;
    const p = SN.exitPosition(c);
    if (!p)
      return;
    Object.assign(a, p);
    a.inCar = null;
    a.hostile = a.kind !== "civilian";
    SN.beginBailout(a, c, p);
    c.occupant = null;
    c.driver = false;
    c.parked = false;
    c.freeRolling = true;
  };

  SN.bailoutDamage = function bailoutDamage(speed) {
    return 165 * Math.pow(Math.max(0, (Math.abs(speed) * 3.6 - 15) / 105), 1.65);
  };

  SN.beginBailout = function beginBailout(actor, c, point, isPlayer = false) {
    const speed = Math.hypot(c.vx, c.vz), fast = speed * 3.6 > 15 || c.airborne;
    actor.x = point.x;
    actor.z = point.z;
    actor.y = SN.surfaceHeight(point.x, point.z);
    actor.yaw = speed > 0.1 ? Math.atan2(c.vx, c.vz) : c.yaw;
    actor.bail = fast ? {
      vx: c.vx * 0.78,
      vz: c.vz * 0.78,
      vy: 1.7 + (c.airborne ? c.vy : 0),
      y: Math.max(actor.y + 0.25, c.y + 0.4),
      time: 0,
      duration: SN.clamp(1.3 + speed * 0.045, 1.3, 3.4),
      angle: 0
    } : null;
    if (isPlayer) {
      SN.player.motionSpeed = SN.player.speed = 0;
      SN.player.vy = 0;
      SN.player.grounded = !fast;
      SN.firing = SN.aiming = false;
      SN.hurtPlayer(SN.bailoutDamage(speed));
    }
    else {
      const damage = SN.bailoutDamage(speed), absorbed = Math.min(actor.armor || 0, damage * 0.45);
      actor.armor = Math.max(0, (actor.armor || 0) - absorbed);
      actor.health = Math.max(0, actor.health - damage + absorbed);
      actor.down = 0;
      actor.fall = 0;
      actor.panic = 15;
      actor.poseDirty = true;
    }
  };

  SN.updateBailout = function updateBailout(actor, rig, dt, isPlayer = false) {
    const b = actor.bail;
    if (!b)
      return false;
    b.time += dt;
    const substeps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vz) * dt / 0.25)), h = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      const nx = actor.x + b.vx * h, nz = actor.z + b.vz * h;
      if (SN.isWater(nx, nz, 0.3)) {
        b.vx *= 0.3;
        b.vz *= 0.3;
        break;
      }
      const hit = SN.resolveCircle(nx, nz, 0.3);
      actor.x = hit.x;
      actor.z = hit.z;
      if (hit.hit) {
        const vn = b.vx * hit.nx + b.vz * hit.nz;
        if (vn < 0) {
          b.vx -= hit.nx * vn * 1.1;
          b.vz -= hit.nz * vn * 1.1;
        }
      }
    }
    b.vy -= 14 * dt;
    b.y += b.vy * dt;
    const floor = SN.surfaceHeight(actor.x, actor.z);
    if (b.y < floor) {
      b.y = floor;
      b.vy = Math.abs(b.vy) > 0.8 ? -b.vy * 0.18 : 0;
    }
    const drag = Math.exp(-dt * (b.y <= floor + 0.03 ? 2.1 : 0.45));
    b.vx *= drag;
    b.vz *= drag;
    b.angle += Math.hypot(b.vx, b.vz) * dt * 1.8;
    const gettingUp = SN.smoothRange(b.duration - 0.6, b.duration, b.time);
    actor.y = b.y;
    if (isPlayer) {
      SN.player.grounded = b.y <= floor + 0.03;
      SN.player.speed = Math.hypot(b.vx, b.vz);
    }
    else
      actor.poseDirty = true;
    SN.advanceGait(rig, 0, dt, 0);
    SN.poseRig(rig, 0, 0, SN.simTime, false, false, 0, -1, (1 - gettingUp) * 0.9);
    rig.root.rotation.order = "YXZ";
    rig.root.rotation.set((1 - gettingUp) * b.angle, actor.yaw, (1 - gettingUp) * 0.5);
    rig.root.position.set(actor.x, b.y + (1 - gettingUp) * 0.45, actor.z);
    rig.weapon.visible = false;
    if (b.time >= b.duration) {
      actor.bail = null;
      rig.root.rotation.set(0, actor.yaw, 0);
      if (isPlayer) {
        SN.player.grounded = true;
        SN.player.y = floor;
        SN.player.vy = 0;
        SN.player.fallPeak = floor;
      }
      else {
        actor.homeX = actor.x;
        actor.homeZ = actor.z;
        if (actor.health <= 0) {
          actor.down = 12;
          actor.fall = 1;
        }
      }
    }
    return true;
  };

  SN.enterExit = function enterExit() {
    if (!SN.canControl() || SN.player.bail)
      return;
    if (!SN.player.car && SN.useDoor()) {
      SN.refreshHUD();
      return;
    }
    if (SN.player.car) {
      const c = SN.player.car,
        exit = SN.exitPosition(c) || SN.safePosition(c.x + Math.cos(c.yaw) * (c.spec.width / 2 + 0.8), c.z - Math.sin(c.yaw) * (c.spec.width / 2 + 0.8), 0.3);
      c.parked = false;
      c.freeRolling = true;
      c.driver = false;
      SN.player.car = null;
      SN.playerRoot.visible = true;
      for (const leg of SN.playerRig.legs)
        leg.planted = false;
      SN.beginBailout(SN.player, c, exit, true);
      SN.toast(SN.player.bail ? "跳车 · 翻滚后起身" : "已下车", 2);
    }
    else {
      SN.findNearestCar(true);
      if (!SN.nearestCar || SN.nearDistance > 5.5) {
        SN.toast("靠近任意车辆后按 F，包括正在行驶的车辆。", 3);
        return;
      }
      const c = SN.nearestCar;
      if (c === SN.missionCar && SN.campaign.active) {
        SN.toast("这是任务目标车 · 追停或保持跟踪距离", 3);
        return;
      }
      if (c.occupant) {
        const driver = c.occupant,
          p = SN.exitPosition(c) || SN.safePosition(c.x + Math.cos(c.yaw) * 3, c.z - Math.sin(c.yaw) * 3, 0.3);
        driver.inCar = null;
        driver.active = true;
        driver.x = driver.homeX = p.x;
        driver.z = driver.homeZ = p.z;
        driver.down = 0;
        driver.fall = 0;
        driver.panic = 15;
        driver.yaw = Math.atan2(driver.x - SN.player.x, driver.z - SN.player.z);
        for (const leg of driver.rig.legs)
          leg.planted = false;
        c.occupant = null;
        c.driver = false;
        SN.beginBailout(driver, c, p);
        if (c.role === "police")
          SN.commitCrime(3, "抢夺警车 ★3", "policeCarjack", 55);
        else
          SN.commitCrime(2, "劫车 ★2", "carjack", 45);
        if (c.role === "gang")
          SN.crews[c.team].anger = 40;
        SN.toast("已拉出驾驶员并接管车辆 · 目击者可能报警", 3);
      }
      else if (c !== SN.loanCar && c !== SN.missionCar && c.role !== "mission")
        SN.commitCrime(1, "盗窃车辆 ★1", "cartheft", 38);
      SN.player.car = c;
      c.freeRolling = false;
      c.parked = true;
      c.driver = false;
      c.vx = Math.sin(c.yaw) * c.speed;
      c.vz = Math.cos(c.yaw) * c.speed;
      SN.player.x = c.x;
      SN.player.z = c.z;
      SN.player.y = c.root.position.y;
      SN.playerRoot.visible = !!c.spec.bike;
      SN.camYaw = c.yaw;
      SN.lookDelay = 0;
      SN.firing = SN.aiming = false;
      SN.reloadTime = 0;
    }
    SN.refreshHUD();
  };

  SN.findNearestCar = function findNearestCar(force = false) {
    if (!force && SN.simTime - SN.nearestCarAt < 0.18)
      return;
    SN.nearestCarAt = SN.simTime;
    SN.nearestCar = null;
    SN.nearDistance = Infinity;
    for (const c of SN.cars) {
      if (!c.active)
        continue;
      const d = Math.hypot(c.x - SN.player.x, c.z - SN.player.z);
      if (d < SN.nearDistance) {
        SN.nearDistance = d;
        SN.nearestCar = c;
      }
    }
  };

  SN.carHullTest = function carHullTest(x, z, yaw, c, water = false) {
    const radius = c.spec.width * 0.51,
      span = Math.max(0, c.spec.length * 0.5 - radius),
      segments = Math.max(1, Math.ceil(span / radius)),
      sn = Math.sin(yaw),
      co = Math.cos(yaw);
    for (let i = 0; i <= segments; i++) {
      const along = span * (i / segments * 2 - 1), px = x + sn * along, pz = z + co * along;
      if (water ? SN.isWater(px, pz, radius) : SN.blocked(px, pz, radius))
        return true;
    }
    return false;
  };

  SN.carBlocked = function carBlocked(x, z, yaw, c) {
    return SN.carHullTest(x, z, yaw, c);
  };

  SN.carWater = function carWater(x, z, yaw, c) {
    return SN.carHullTest(x, z, yaw, c, true);
  };

  SN.vehicleContact = function vehicleContact(c, o) {
    const dx = c.x - o.x,
      dz = c.z - o.z,
      cs = Math.sin(c.yaw),
      cc = Math.cos(c.yaw),
      os = Math.sin(o.yaw),
      oc = Math.cos(o.yaw);
    let depth = Infinity, nx = 0, nz = 0;
    for (let axis = 0; axis < 4; axis++) {
      const ax = axis === 0 ? cc : axis === 1 ? cs : axis === 2 ? oc : os,
        az = axis === 0 ? -cs : axis === 1 ? cc : axis === 2 ? -os : oc;
      const cr = Math.abs(ax * cc - az * cs) * c.spec.width * 0.5 + Math.abs(ax * cs + az * cc) * c.spec.length * 0.5,
        other = Math.abs(ax * oc - az * os) * o.spec.width * 0.5 + Math.abs(ax * os + az * oc) * o.spec.length * 0.5;
      const signed = dx * ax + dz * az, overlap = cr + other - Math.abs(signed);
      if (overlap <= 0)
        return null;
      if (overlap < depth) {
        depth = overlap;
        const sign = signed < 0 ? -1 : 1;
        nx = ax * sign;
        nz = az * sign;
      }
    }
    Object.assign(SN.vehicleContactResult, { nx, nz, depth });
    return SN.vehicleContactResult;
  };

  SN.carDamage = function carDamage(c, impact) {
    if (c.collisionTimer > 0)
      return;
    c.collisionTimer = 0.45;
    c.health = Math.max(0, c.health - Math.max(0, impact - 1) * 1.6 * c.spec.damage);
    if (c === SN.player.car && impact > 8)
      SN.hurtPlayer((impact - 7) * 0.7);
  };

  SN.carStaticResolve = function carStaticResolve(c, x, z, yaw) {
    let nx = 0, nz = 0, hit = false;
    const sn = Math.sin(yaw),
      co = Math.cos(yaw),
      radius = c.spec.width * 0.51,
      span = Math.max(0, c.spec.length * 0.5 - radius),
      segments = Math.max(1, Math.ceil(span / radius));
    for (let iter = 0; iter < 2; iter++) {
      let moved = false;
      for (let k = 0; k <= segments; k++) {
        const along = span * (k / segments * 2 - 1);
        let sx = x + sn * along, sz = z + co * along;
        const ix = SN.clamp(Math.floor((sx + SN.EXTENT) / SN.BIN_SIZE), 1, SN.BIN_COUNT - 2),
          iz = SN.clamp(Math.floor((sz + SN.EXTENT) / SN.BIN_SIZE), 1, SN.BIN_COUNT - 2);
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const cell = SN.bins[(iz + dz) * SN.BIN_COUNT + ix + dx];
            for (let i = 0; i < cell.length; i++) {
              const b = cell[i];
              if (SN.aabbPush(sx, sz, radius, b)) {
                const d = SN.circlePush.depth + 0.004;
                x += SN.circlePush.nx * d;
                z += SN.circlePush.nz * d;
                sx += SN.circlePush.nx * d;
                sz += SN.circlePush.nz * d;
                nx += SN.circlePush.nx;
                nz += SN.circlePush.nz;
                hit = true;
                moved = true;
              }
            }
            const oc = SN.obbBins[(iz + dz) * SN.BIN_COUNT + ix + dx];
            for (let i = 0; i < oc.length; i++) {
              const b = oc[i];
              if (SN.obbPush(sx, sz, radius, b)) {
                const d = SN.circlePush.depth + 0.004;
                x += SN.circlePush.nx * d;
                z += SN.circlePush.nz * d;
                sx += SN.circlePush.nx * d;
                sz += SN.circlePush.nz * d;
                nx += SN.circlePush.nx;
                nz += SN.circlePush.nz;
                hit = true;
                moved = true;
              }
            }
          }
      }
      if (!moved)
        break;
    }
    const len = Math.hypot(nx, nz);
    SN.carResolve.x = x;
    SN.carResolve.z = z;
    SN.carResolve.hit = hit;
    SN.carResolve.nx = hit && len > 0.0001 ? nx / len : 0;
    SN.carResolve.nz = hit && len > 0.0001 ? nz / len : 0;
    return SN.carResolve;
  };

  SN.vehicleGround = function vehicleGround(c) {
    const halfL = c.spec.length * (c.spec.bike ? 0.36 : 0.32),
      halfW = Math.max(0.3, c.spec.width * 0.48),
      sn = Math.sin(c.yaw),
      co = Math.cos(c.yaw);
    const sample = (u, v) => SN.surfaceHeight(c.x + co * u + sn * v, c.z - sn * u + co * v);
    const fl = sample(-halfW, halfL), fr = sample(halfW, halfL), rl = sample(-halfW, -halfL), rr = sample(halfW, -halfL);
    return {
      y: (fl + fr + rl + rr) / 4,
      pitch: -Math.atan2((fl + fr - rl - rr) / 2, halfL * 2),
      roll: Math.atan2((fr + rr - fl - rl) / 2, halfW * 2)
    };
  };

  SN.resetVehicleGround = function resetVehicleGround(c) {
    const ground = SN.vehicleGround(c);
    Object.assign(c, {
      y: ground.y,
      groundY: ground.y,
      vy: 0,
      pitch: ground.pitch,
      pitchV: 0,
      terrainRoll: ground.roll,
      rollV: 0,
      suspension: 0,
      suspensionV: 0,
      airborne: false,
      groundX: c.x,
      groundZ: c.z
    });
    c.py = c.y;
    c.ppitch = c.pitch;
    c.pterrainRoll = c.terrainRoll;
    c.psuspension = 0;
  };

  SN.updateVehicleGround = function updateVehicleGround(c, dt) {
    if (!Number.isFinite(c.groundX) || Math.hypot(c.x - c.groundX, c.z - c.groundZ) > 8)
      SN.resetVehicleGround(c);
    const ground = SN.vehicleGround(c), groundV = SN.clamp((ground.y - c.groundY) / Math.max(dt, 0.0001), -22, 22);
    if (!c.airborne && Math.abs(c.speed) > 11 && c.vy - groundV > 9.81 * dt && c.y + c.vy * dt - 4.905 * dt * dt > ground.y + 0.035)
      c.airborne = true;
    if (c.airborne) {
      c.vy -= 9.81 * dt;
      c.y += c.vy * dt;
      if (c.y <= ground.y) {
        const landing = Math.max(0, groundV - c.vy);
        c.y = ground.y;
        c.vy = groundV;
        c.airborne = false;
        c.suspensionV = -Math.min(3, landing * 0.32);
        if (landing > 7)
          SN.carDamage(c, landing);
        if (c === SN.player.car && landing > 2) {
          SN.camShake = Math.min(0.45, landing * 0.035);
          SN.camShakeTime = 0.32;
        }
      }
    }
    else {
      c.suspensionV += SN.clamp(c.vy - groundV, -5, 5) * 0.08;
      c.y = ground.y;
      c.vy = groundV;
    }
    c.suspensionV += (-100 * c.suspension - 12 * c.suspensionV) * dt;
    c.suspension = SN.clamp(c.suspension + c.suspensionV * dt, -0.18, 0.2);
    c.pitchV += ((ground.pitch - c.pitch) * 85 - 15 * c.pitchV) * dt;
    c.pitch += c.pitchV * dt;
    c.rollV += ((ground.roll - c.terrainRoll) * 85 - 15 * c.rollV) * dt;
    c.terrainRoll += c.rollV * dt;
    c.groundY = ground.y;
    c.groundX = c.x;
    c.groundZ = c.z;
    c.root.position.set(c.x, c.y, c.z);
    c.root.rotation.y = c.yaw;
    c.body.rotation.set(c.pitch, 0, c.terrainRoll + c.roll);
    c.body.position.y = c.suspension;
    SN.placeVehicleWheels(c);
  };

  SN.placeVehicleWheels = function placeVehicleWheels(c) {
    const sn = Math.sin(c.root.rotation.y), co = Math.cos(c.root.rotation.y);
    for (const w of c.wheels) {
      const h = SN.surfaceHeight(c.root.position.x + co * w.x + sn * w.z, c.root.position.z - sn * w.x + co * w.z);
      w.pivot.position.y = c.wheelRadius + (c.airborne ? -0.2 : h - c.root.position.y);
    }
  };

  SN.moveCar = function moveCar(c, dt, throttle, steer, handbrake = false) {
    c.collisionTimer = Math.max(0, c.collisionTimer - dt);
    const oldSpeed = c.speed;
    // Steering reaches full lock in roughly a tenth of a second; throttle is much sharper than before.
    c.steer = SN.lerp(c.steer, steer, 1 - Math.exp(-dt * 17));
    const spec = c.spec,
      speedAbs = Math.abs(c.speed),
      braking = 24 / Math.sqrt(spec.mass),
      acceleration = throttle > 0 ? (c.speed < -0.5 ? braking : spec.accel * (1 - speedAbs / (spec.topSpeed * 1.35))) : (c.speed > 0.5 ? braking : spec.accel * 0.55);
    c.speed += (throttle * acceleration + (c.airborne ? 0 : 9.81 * Math.sin(SN.vehicleGround(c).pitch))) * dt;
    if (!throttle)
      c.speed *= Math.exp(-dt * 0.32);
    c.speed = SN.clamp(c.speed, -(spec.bike ? 4 : 8), spec.topSpeed);
    if (handbrake)
      c.speed *= Math.exp(-dt * 0.85);
    if (c.health <= 0)
      c.speed *= Math.exp(-dt * 2);
    // Speed-sensitive lock: easy parking control, calmer at top speed.
    const steerAngle = c.steer * (spec.bike ? 0.42 : 0.62) / (1 + speedAbs * 0.034);
    c.yaw -= Math.tan(steerAngle) * c.speed / (spec.length * 0.64) * dt * (handbrake ? 1.45 : 1);
    const sn = Math.sin(c.yaw),
      co = Math.cos(c.yaw),
      gripRate = handbrake ? spec.grip * 0.2 : (speedAbs < 7 ? spec.grip * 1.6 : spec.grip),
      grip = 1 - Math.exp(-dt * gripRate);
    // Preserve engine acceleration along the chassis; grip damps lateral slip only.
    const lateral = (c.vx * co - c.vz * sn) * (1 - grip);
    c.vx = sn * c.speed + co * lateral;
    c.vz = co * c.speed - sn * lateral;
    // Cap every integration step at 0.45 m so thin walls and rails cannot be tunnelled.
    const travel = Math.hypot(c.vx, c.vz) * dt,
      substeps = Math.min(6, Math.max(1, Math.ceil(travel / 0.45))),
      h = dt / substeps;
    const detailed = c === SN.player.car || Math.hypot(c.x - SN.player.x, c.z - SN.player.z) < 150;
    for (let s = 0; s < substeps; s++) {
      const nx = c.x + c.vx * h, nz = c.z + c.vz * h;
      if (Math.abs(nx) > SN.WORLD - 1.5 || Math.abs(nz) > SN.WORLD - 1.5) {
        c.vx *= -0.3;
        c.vz *= -0.3;
        c.speed *= 0.45;
        c.stuck += dt / substeps;
        continue;
      }
      if (SN.carWater(nx, nz, c.yaw, c)) {
        c.vx *= -0.22;
        c.vz *= -0.22;
        c.speed *= 0.4;
        c.stuck += dt / substeps;
        continue;
      }
      if (detailed) {
        const res = SN.carStaticResolve(c, nx, nz, c.yaw);
        if (res.hit) {
          const vn = c.vx * res.nx + c.vz * res.nz;
          if (vn < 0) {
            const impact = -vn;
            c.vx -= res.nx * vn * 1.22;
            c.vz -= res.nz * vn * 1.22;
            c.vx *= 0.86;
            c.vz *= 0.86;
            SN.carDamage(c, impact);
            if (c === SN.player.car && impact > 3) {
              SN.camShake = SN.clamp(impact * 0.03, 0.08, 0.6);
              SN.camShakeTime = 0.32;
            }
            if (impact > 5)
              SN.soundImpact(impact);
          }
          c.x = res.x;
          c.z = res.z;
          c.stuck += dt / substeps;
        }
        else {
          c.x = nx;
          c.z = nz;
          c.stuck = Math.max(0, c.stuck - dt / substeps * 0.6);
        }
      }
      else if (SN.carBlocked(nx, nz, c.yaw, c)) {
        c.vx *= 0.35;
        c.vz *= 0.35;
        c.stuck += dt / substeps;
      }
      else {
        c.x = nx;
        c.z = nz;
      }
      c.speed = c.vx * sn + c.vz * co;
    }
    for (const o of SN.cars) {
      if (o === c || !o.active || Math.hypot(c.x - o.x, c.z - o.z) > (c.spec.length + o.spec.length) * 0.55)
        continue;
      const contact = SN.vehicleContact(c, o);
      if (!contact)
        continue;
      const { nx, nz, depth } = contact, relative = (c.vx - o.vx) * nx + (c.vz - o.vz) * nz;
      if (relative < 0) {
        const impulse = -relative * 1.12 / (1 / c.spec.mass + 1 / o.spec.mass);
        c.vx += nx * impulse / c.spec.mass;
        c.vz += nz * impulse / c.spec.mass;
        o.vx -= nx * impulse / o.spec.mass;
        o.vz -= nz * impulse / o.spec.mass;
        c.speed = c.vx * Math.sin(c.yaw) + c.vz * Math.cos(c.yaw);
        o.speed = o.vx * Math.sin(o.yaw) + o.vz * Math.cos(o.yaw);
        const copBefore = o.health;
        SN.carDamage(c, -relative);
        SN.carDamage(o, -relative);
        if (c === SN.player.car && o.role === "police" && o.health <= 0 && copBefore > 0)
          SN.commitCrime(5, "毁坏警车 ★5", "policeCar", 60);
        else if (c === SN.player.car && o.role === "police" && -relative > 5)
          SN.commitCrime(2, "撞击警车 ★2", "policeCar", 50);
        if (c === SN.player.car && -relative > 4) {
          SN.camShake = SN.clamp(-relative * 0.025, 0.06, 0.5);
          SN.camShakeTime = 0.28;
          SN.soundImpact(-relative);
        }
      }
      const push = depth * o.spec.mass / (c.spec.mass + o.spec.mass) + 0.003, px = c.x + nx * push, pz = c.z + nz * push;
      if (!SN.carBlocked(px, pz, c.yaw, c)) {
        c.x = px;
        c.z = pz;
      }
    }
    if (c === SN.player.car && Math.abs(c.speed) > 1.2)
      for (const a of SN.actors) {
        if (!a.active || a.down || a.inCar || a.missionEnemy || a.interior)
          continue;
        if (SN.simTime < (a.carHitCool || 0))
          continue;
        if (SN.segmentDistance(a.x, a.z, c.x - sn * c.spec.length * 0.4, c.z - co * c.spec.length * 0.4, c.x + sn * c.spec.length * 0.4, c.z + co * c.spec.length * 0.4) > c.spec.width * 0.55)
          continue;
        const impactSpeed = Math.abs(c.speed);
        a.carHitCool = SN.simTime + 1.5;
        if (impactSpeed < 7) {
          const nx = a.x - c.x, nz = a.z - c.z, l = Math.hypot(nx, nz) || 1;
          a.x += nx / l * 0.5;
          a.z += nz / l * 0.5;
          SN.bumpActor(a, impactSpeed, false);
          SN.soundImpact(3);
        }
        else {
          SN.hitActor(a, impactSpeed > 17 ? 100 : 22 + impactSpeed * 2.2, sn, co, false, "car");
          a.carHitCool = SN.simTime + 2.1;
          if (!a.down && a.health > 0) {
            a.down = 4.5;
            a.fall = 0;
            a.stagger = true;
            a.hostile = false;
          }
          if (c === SN.player.car) {
            SN.camShake = Math.max(SN.camShake, 0.14);
            SN.camShakeTime = 0.25;
          }
        }
      }
    c.roll = SN.lerp(c.roll, c.steer * SN.clamp(c.speed / 20, -1, 1) * (spec.bike ? 0.42 : -0.085), 1 - Math.exp(-dt * 9));
    c.suspensionV += SN.clamp(c.speed - oldSpeed, -1, 1) * -0.08;
    c.spin = (c.spin + c.speed * dt / c.wheelRadius) % SN.TAU;
    for (const w of c.wheels) {
      w.pivot.rotation.y = w.front ? -steerAngle : 0;
      w.wheel.rotation.x = c.spin;
      w.pivot.rotation.z = spec.bike ? c.roll : 0;
    }
    SN.updateVehicleGround(c, dt);
    c.root.visible = c.active && Math.hypot(c.x - SN.player.x, c.z - SN.player.z) < 650;
    if (c.lights)
      for (let i = 0; i < c.lights.length; i++)
        c.lights[i].material.opacity = (Math.floor(SN.simTime * 7) + i) % 2 ? 0.9 : 0.08;
  };

  SN.poseRider = function poseRider(r, c, time, seed = 0) {
    r.weapon.visible = false;
    r.motion.weight = 0;
    r.root.rotation.order = "YXZ";
    r.root.rotation.set(c.pitch, c.root.rotation.y, c.terrainRoll + c.roll);
    r.root.position.copy(c.root.position);
    r.root.position.y += 0.32;
    r.torso.position.set(0, 0.53, -0.08);
    r.torso.rotation.set(0.18, c.steer * 0.08, 0);
    r.head.rotation.set(-0.09, Math.sin(time * 0.6 + seed) * 0.03, 0);
    for (let i = 0; i < 2; i++) {
      const leg = r.legs[i], arm = r.arms[i];
      leg.planted = false;
      leg.upper.position.y = 0.5;
      leg.upper.rotation.set(-1.05, 0, i ? -0.2 : 0.2);
      leg.lower.rotation.set(1.5, 0, 0);
      leg.foot.rotation.x = -0.2;
      arm.upper.rotation.set(-1.15, 0, i ? -0.18 : 0.18);
      arm.lower.rotation.set(-0.48, 0, 0);
    }
  };

  SN.carMotion = function carMotion(dt) {
    SN.player.motionSpeed = 0;
    const c = SN.player.car,
      throttle = SN.clamp((SN.keys.KeyW || SN.keys.ArrowUp ? 1 : 0) - (SN.keys.KeyS || SN.keys.ArrowDown ? 1 : 0) + SN.touch.y, -1, 1),
      steer = SN.clamp((SN.keys.KeyD || SN.keys.ArrowRight ? 1 : 0) - (SN.keys.KeyA || SN.keys.ArrowLeft ? 1 : 0) + SN.touch.x, -1, 1);
    SN.moveCar(c, dt, throttle, steer, SN.keys.Space || SN.touch.brake);
    SN.player.x = c.x;
    SN.player.z = c.z;
    SN.player.y = c.root.position.y;
    SN.player.yaw = c.yaw;
    if (SN.lookDelay <= 0 && Math.abs(c.speed) > 1.5)
      SN.camYaw = SN.approachAngle(SN.camYaw, c.yaw, dt * 2.4);
    if (c.health <= 0 && SN.impactCooldown <= 0) {
      SN.toast("车辆损坏 · F 下车寻找另一辆车", 3);
      SN.impactCooldown = 5;
    }
  };

  SN.roadNode = function roadNode(x, z) {
    let index = SN.roadNodes.findIndex(p => Math.hypot(p.x - x, p.z - z) < 0.5);
    if (index < 0) {
      index = SN.roadNodes.length;
      SN.roadNodes.push({ x, z, links: [] });
    }
    return index;
  };

  SN.navigationTree = function navigationTree(goal) {
    if (SN.navCache.has(goal))
      return SN.navCache.get(goal);
    const distances = new Float64Array(SN.navCount),
      next = new Int32Array(SN.navCount),
      visited = new Uint8Array(SN.navCount);
    distances.fill(Infinity);
    next.fill(-1);
    distances[goal] = 0;
    next[goal] = goal;
    for (let k = 0; k < SN.navCount; k++) {
      let best = -1;
      for (let i = 0; i < SN.navCount; i++)
        if (!visited[i] && (best < 0 || distances[i] < distances[best]))
          best = i;
      if (best < 0 || !Number.isFinite(distances[best]))
        break;
      visited[best] = 1;
      for (const edge of SN.roadNodes[best].links) {
        const d = distances[best] + edge.distance;
        if (d < distances[edge.index]) {
          distances[edge.index] = d;
          next[edge.index] = best;
        }
      }
    }
    if (SN.navCache.size >= 12)
      SN.navCache.delete(SN.navCache.keys().next().value);
    SN.navCache.set(goal, next);
    return next;
  };

  SN.nearestRoadNode = function nearestRoadNode(x, z) {
    let nearest = -1, best = Infinity;
    for (let i = 0; i < SN.navCount; i++) {
      const p = SN.roadNodes[i], d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    return nearest;
  };

  SN.pursuitRoute = function pursuitRoute(c) {
    const goal = SN.nearestRoadNode(SN.player.x, SN.player.z);
    if (c.navGoal !== goal || c.navNode < 0 || c.navNode === undefined) {
      c.navGoal = goal;
      c.navNode = SN.nearestRoadNode(c.x, c.z);
    }
    c.navTime = 2;
  };

  SN.trafficMotion = function trafficMotion(dt) {
    for (const c of SN.cars) {
      if (!c.active || c === SN.player.car)
        continue;
      if (c.freeRolling) {
        SN.moveCar(c, dt, 0, c.steer * 0.96);
        if (Math.abs(c.speed) < 0.12 && !c.airborne) {
          c.freeRolling = false;
          c.parked = true;
          c.speed = c.vx = c.vz = 0;
        }
        continue;
      }
      if (c.parked) {
        SN.updateVehicleGround(c, dt);
        c.root.visible = Math.hypot(c.x - SN.player.x, c.z - SN.player.z) < 650;
        continue;
      }
      if (Math.hypot(c.x - SN.player.x, c.z - SN.player.z) > 700) {
        c.root.visible = false;
        continue;
      }
      let tx, tz, wanted = c.cruise;
      if (c.role === "police" || c.role === "gang") {
        const distance = Math.hypot(c.x - SN.player.x, c.z - SN.player.z);
        if (c.role === "police" && distance < 125 && SN.visibleBetween(c.x, c.root.position.y + 1.4, c.z, SN.player.x, SN.player.y + 1, SN.player.z)) {
          SN.lastSeen = SN.simTime;
          SN.heatDecay = 0;
        }
        if ((distance < 21 && !SN.player.car) || c.stuck > 4 || c.health < 10) {
          SN.dismount(c);
          continue;
        }
        c.navTime = (c.navTime || 0) - dt;
        if (c.navTime <= 0)
          SN.pursuitRoute(c);
        let node = SN.roadNodes[c.navNode];
        if (node && c.navNode !== c.navGoal && Math.hypot(node.x - c.x, node.z - c.z) < 13) {
          const next = SN.navigationTree(c.navGoal)[c.navNode];
          if (next >= 0)
            c.navNode = next;
          node = SN.roadNodes[c.navNode];
        }
        tx = node ? node.x : SN.player.x;
        tz = node ? node.z : SN.player.z;
        if (distance < 45 && SN.visibleBetween(c.x, c.root.position.y + 1, c.z, SN.player.x, SN.player.y + 1, SN.player.z)) {
          tx = SN.player.x;
          tz = SN.player.z;
        }
        wanted = distance < 15 ? 7 : 22;
      }
      else if (c.cityTraffic) {
        let node = SN.roadNodes[c.navNode];
        if (!node) {
          c.navNode = SN.nearestRoadNode(c.x, c.z);
          node = SN.roadNodes[c.navNode];
        }
        if (Math.hypot(node.x - c.x, node.z - c.z) < Math.max(9, c.spec.length * 1.6)) {
          const suitable = node.links.filter(link => c.type !== 6 || link.lanes >= 4),
            forward = suitable.filter(link => link.index !== c.previousNode),
            options = forward.length ? forward : suitable;
          const edge = options[Math.floor(SN.rnd() * options.length)];
          if (edge) {
            c.previousNode = c.navNode;
            c.laneOffset = edge.laneOffset;
            c.navNode = edge.index;
            node = SN.roadNodes[c.navNode];
          }
          else
            wanted = 0;
        }
        const dx = node.x - c.x, dz = node.z - c.z, len = Math.hypot(dx, dz) || 1;
        const lane = c.laneOffset === undefined ? 1.6 : c.laneOffset;
        tx = node.x + dz / len * lane;
        tz = node.z - dx / len * lane;
      }
      else {
        if (!c.route || c.route.length === 0)
          continue;
        c.index %= c.route.length;
        let p = c.route[c.index];
        if (Math.hypot(p[0] - c.x, p[1] - c.z) < 8) {
          c.index = (c.index + 1) % c.route.length;
          p = c.route[c.index];
        }
        const previous = c.route[(c.index + c.route.length - 1) % c.route.length],
          dx = p[0] - previous[0],
          dz = p[1] - previous[1],
          len = Math.hypot(dx, dz) || 1,
          sample = SN.roadSample((p[0] + previous[0]) / 2, (p[1] + previous[1]) / 2),
          lane = sample ? sample.profile.laneOffset : 1.6;
        tx = p[0] + dz / len * lane;
        tz = p[1] - dx / len * lane;
      }
      const turn = SN.angleDelta(c.yaw, Math.atan2(tx - c.x, tz - c.z));
      wanted *= SN.clamp(1 - Math.abs(turn) * 0.65, 0.18, 1);
      if (c.role === "traffic")
        for (const o of SN.cars) {
          if (o === c || !o.active)
            continue;
          const dx = o.x - c.x,
            dz = o.z - c.z,
            along = dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw),
            across = dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw);
          if (along > 0 && along < (c.spec.length + o.spec.length) * 0.5 + 4 + Math.abs(c.speed) * 0.5 && Math.abs(across) < (c.spec.width + o.spec.width) * 0.5)
            wanted = 0;
        }
      if (c.role === "traffic")
        for (const a of SN.actors) {
          if (!a.active || a.inCar || a.down || a.interior)
            continue;
          const dx = a.x - c.x,
            dz = a.z - c.z,
            along = dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw),
            across = dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw);
          if (along > 0 && along < c.spec.length * 0.5 + 3 + Math.abs(c.speed) * 0.55 && Math.abs(across) < c.spec.width * 0.5 + 0.65) {
            wanted = 0;
            break;
          }
        }
      wanted = Math.min(wanted, c.spec.topSpeed * 0.85);
      SN.moveCar(c, dt, SN.clamp((wanted - c.speed) * 0.5, -1, 1), SN.clamp(-turn * 1.9, -1, 1));
      if (c.occupant) {
        c.occupant.x = c.x;
        c.occupant.z = c.z;
      }
    }
  };
  // Startup phase 14: keep this order relative to the other systems.

  SN.registerInit(14, function initializeVehicles14() {
    SN.tireMat = SN.mat(0x1b2124, { roughness: 0.98, metalness: 0.02 });
    SN.glassMat = SN.pbrMat("glass", 0xa8c0c4, { uvScale: 1.6, metalness: 0.82, roughness: 1, envMapIntensity: 1.3, normalStrength: 0.3 });
    SN.headMat = SN.mat(0xffefc6, { emissive: 0xffd595, emissiveIntensity: 0.8, roughness: 0.18 });
    SN.tailMat = SN.mat(0xb44b45, { emissive: 0xff4033, emissiveIntensity: 1.1, roughness: 0.24 });
    SN.chromeMat = SN.pbrMat("metal", 0xd2dadc, { uvScale: 1.1, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2 });
  });
  // Startup phase 18: keep this order relative to the other systems.

  SN.registerInit(18, function initializeVehicles18() {
    // Ten original vehicle families; the crews commission two distinct body variants.
    // Units: metres, m/s, m/s², tonnes. Health remains a readable 0–100 percentage.
    SN.buildInstances(SN.box, SN.stoneMat, SN.foundationBatch, true);
    SN.buildInstances(SN.box, SN.stoneMat, SN.retainingBatch, true);
    SN.buildInstances(SN.box, SN.stoneMat, SN.medianBatch, true);
    for (const median of SN.medianSolids)
      SN.addOBB(median.x, median.z, median.w, median.d, 0.45, median.yaw, SN.roadHeight(median.x, median.z));
    SN.vehicleSpecs = [
      {
        name: "栖灯 · 轿车",
        shape: "sedan",
        length: 4.5,
        width: 1.8,
        height: 1.43,
        topSpeed: 36,
        accel: 12.5,
        mass: 1.45,
        grip: 10.5,
        damage: 0.95,
        pitch: 49,
        cruise: 12
      },
      {
        name: "豆弧 · 掀背车",
        shape: "hatch",
        length: 3.65,
        width: 1.67,
        height: 1.52,
        topSpeed: 30,
        accel: 13.8,
        mass: 1.02,
        grip: 13,
        damage: 1.2,
        pitch: 65,
        cruise: 11
      },
      {
        name: "岩径 · SUV",
        shape: "suv",
        length: 4.85,
        width: 2,
        height: 1.88,
        topSpeed: 32,
        accel: 10,
        mass: 2.15,
        grip: 9.4,
        damage: 0.72,
        pitch: 38,
        cruise: 11
      },
      {
        name: "汉江出租车",
        shape: "taxi",
        length: 4.6,
        width: 1.82,
        height: 1.5,
        topSpeed: 34,
        accel: 11.7,
        mass: 1.53,
        grip: 11,
        damage: 0.92,
        pitch: 53,
        cruise: 12
      },
      {
        name: "榫木 · 皮卡",
        shape: "pickup",
        length: 5.25,
        width: 1.98,
        height: 1.8,
        topSpeed: 31,
        accel: 9.8,
        mass: 2.25,
        grip: 8.6,
        damage: 0.68,
        pitch: 34,
        cruise: 10
      },
      {
        name: "方邮 · 厢式货车",
        shape: "van",
        length: 5.45,
        width: 2.04,
        height: 2.56,
        topSpeed: 27,
        accel: 8,
        mass: 2.8,
        grip: 8.2,
        damage: 0.63,
        pitch: 31,
        cruise: 9
      },
      {
        name: "蓝廊 · 城市巴士",
        shape: "bus",
        length: 9.4,
        width: 2.45,
        height: 3.05,
        topSpeed: 22,
        accel: 4.7,
        mass: 8.4,
        grip: 7.6,
        damage: 0.32,
        pitch: 23,
        cruise: 9
      },
      {
        name: "折光 · 双门跑车",
        shape: "coupe",
        length: 4.3,
        width: 1.94,
        height: 1.15,
        topSpeed: 49,
        accel: 19,
        mass: 1.23,
        grip: 5.6,
        damage: 1.28,
        pitch: 76,
        cruise: 16
      },
      {
        name: "风笺 · 配送踏板车",
        shape: "scooter",
        length: 2.06,
        width: 0.72,
        height: 1.18,
        topSpeed: 29,
        accel: 16,
        mass: 0.24,
        grip: 12.2,
        damage: 1.8,
        pitch: 104,
        cruise: 10,
        bike: true
      },
      {
        name: "巡弧 · 警用车",
        shape: "police",
        length: 4.75,
        width: 1.9,
        height: 1.49,
        topSpeed: 41,
        accel: 15.3,
        mass: 1.85,
        grip: 12.8,
        damage: 0.57,
        pitch: 58,
        cruise: 14
      },
      {
        name: "银光团 · 潮棱",
        shape: "silverCrew",
        length: 4.6,
        width: 1.91,
        height: 1.34,
        topSpeed: 43,
        accel: 16.6,
        mass: 1.58,
        grip: 8.4,
        damage: 0.78,
        pitch: 68,
        cruise: 13
      },
      {
        name: "赤鹰帮 · 铆脊",
        shape: "redCrew",
        length: 5.05,
        width: 2.04,
        height: 1.82,
        topSpeed: 35,
        accel: 12.6,
        mass: 2.5,
        grip: 8.8,
        damage: 0.51,
        pitch: 41,
        cruise: 12
      }
    ];
    SN.wheelGeo = new SN.T.CylinderGeometry(0.33, 0.33, 0.22, 12);
    SN.wheelGeo.rotateZ(SN.PI / 2);
    SN.rimGeo = SN.merged([
      { g: new SN.T.CylinderGeometry(0.18, 0.18, 0.235, 8), x: 0, y: 0, z: 0, rz: SN.PI / 2 },
      { g: SN.box, x: 0, y: 0, z: 0, sx: 0.25, sy: 0.055, sz: 0.53 },
      { g: SN.box, x: 0, y: 0, z: 0, sx: 0.25, sy: 0.53, sz: 0.055 }
    ]);
    SN.vehicleGeometry = SN.vehicleSpecs.map(spec => {
      const l = spec.length,
        w = spec.width,
        h = spec.height,
        shape = spec.shape,
        body = [],
        glass = [],
        trim = [],
        accent = [],
        head = [],
        tail = [];
      const block = (parts, x, y, z, sx, sy, sz, rx = 0) => parts.push({ g: SN.box, x, y, z, sx, sy, sz, rx });
      if (spec.bike) {
        block(body, 0, 0.35, 0, 0.45, 0.18, 1.52);
        block(body, 0, 0.72, 0.57, 0.48, 0.85, 0.28, -0.18);
        block(body, 0, 0.56, -0.48, 0.52, 0.38, 0.62);
        block(trim, 0, 0.8, -0.2, 0.48, 0.13, 0.72);
        block(trim, 0, 1.17, 0.62, 0.76, 0.055, 0.07);
        block(trim, 0, 0.62, 0.72, 0.07, 0.65, 0.07, -0.18);
        block(body, 0, 1.03, -0.67, 0.68, 0.56, 0.58);
        block(accent, 0, 1.04, -0.973, 0.52, 0.15, 0.012);
        block(glass, 0, 1.27, 0.58, 0.47, 0.3, 0.04, -0.18);
        block(head, 0, 1.02, 0.74, 0.3, 0.16, 0.06);
        block(tail, 0, 0.56, -0.91, 0.3, 0.09, 0.04);
      }
      else {
        block(body, 0, 0.65, 0, w, 0.53, l);
        const tall = shape === "bus" || shape === "van", pickup = shape === "pickup" || shape === "redCrew";
        const cabZ = tall ? 0 : pickup ? 0.66 : shape === "hatch" ? -0.27 : -0.15,
          cabL = tall ? l * 0.91 : pickup ? l * 0.4 : shape === "hatch" ? l * 0.62 : l * 0.48;
        if (tall) {
          block(body, 0, (h + 1) / 2, 0, w * 0.97, h - 1, l * 0.95);
          block(glass, 0, h - 0.66, l * 0.478, w * 0.86, 0.82, 0.035);
          if (shape === "bus") {
            for (const side of [-1, 1])
              for (let i = 0; i < 6; i++)
                block(glass, side * w * 0.491, h - 0.7, -l * 0.34 + i * l * 0.135, 0.025, 0.91, l * 0.105);
            for (const side of [-1, 1]) {
              block(accent, side * w * 0.502, 1.05, 0, 0.025, 0.25, l * 0.9);
              for (const z of [-2.6, 2.6])
                block(trim, side * w * 0.506, 1.14, z, 0.035, 1.62, 0.06);
            }
            block(trim, 0, h + 0.1, -1, w * 0.6, 0.2, 2.2);
            block(accent, 0, h - 0.17, l * 0.48, w * 0.6, 0.16, 0.03);
          }
          else {
            for (const side of [-1, 1]) {
              block(glass, side * w * 0.49, h - 0.64, l * 0.31, 0.025, 0.7, 1.1);
              block(trim, side * w * 0.495, 1.48, -0.5, 0.025, 0.035, l * 0.5);
              block(accent, side * w * 0.502, 1.65, -0.5, 0.018, 0.24, 1.2);
            }
            block(trim, 0, 1.6, -l * 0.48, 0.045, 1.7, 0.025);
          }
        }
        else {
          block(glass, 0, (h + 0.92) / 2, cabZ, w * 0.84, h - 0.92, cabL);
          block(body, 0, h, cabZ, w * 0.88, 0.13, cabL * 0.94);
          block(body, 0, 0.98, l * 0.34, w * 0.94, 0.17, l * 0.25, shape === "coupe" ? -0.1 : 0);
          for (const side of [-1, 1]) {
            block(trim, side * w * 0.425, (h + 0.93) / 2, cabZ, 0.055, h - 0.9, 0.065);
            block(trim, side * w * 0.54, 1.06, cabZ + cabL * 0.32, 0.17, 0.1, 0.2);
          }
          if (pickup) {
            block(trim, 0, 0.95, -l * 0.3, w * 0.81, 0.06, l * 0.32);
            for (const side of [-1, 1])
              block(body, side * w * 0.46, 1.17, -l * 0.31, 0.15, 0.48, l * 0.34);
            block(body, 0, 1.16, -l * 0.47, w, 0.48, 0.13);
          }
          if (shape === "suv") {
            for (const side of [-1, 1])
              block(trim, side * w * 0.35, h + 0.13, -0.2, 0.065, 0.09, l * 0.48);
            block(trim, 0, 1, -l * 0.51, 0.65, 0.65, 0.22);
          }
          if (shape === "coupe" || shape === "silverCrew") {
            block(accent, 0, h + 0.13, -l * 0.38, w * 0.93, 0.09, 0.28);
            for (const side of [-1, 1])
              block(trim, side * w * 0.3, h - 0.05, -l * 0.38, 0.06, 0.27, 0.08);
          }
          if (shape === "redCrew") {
            block(trim, 0, 1.04, l * 0.515, w * 0.84, 0.18, 0.15);
            for (const side of [-1, 1])
              block(trim, side * w * 0.32, h - 0.05, -0.18, 0.09, 0.8, 0.09);
            block(accent, 0, h + 0.3, -0.18, w * 0.75, 0.12, 0.12);
          }
          if (shape === "taxi") {
            block(accent, 0, h + 0.2, -0.2, 0.62, 0.23, 0.35);
            for (const side of [-1, 1])
              block(accent, side * w * 0.503, 0.85, 0, 0.022, 0.14, l * 0.78);
          }
          if (shape === "police") {
            block(trim, 0, h + 0.13, -0.1, 1.15, 0.1, 0.29);
            for (const side of [-1, 1])
              block(accent, side * w * 0.505, 0.76, 0, 0.025, 0.28, l * 0.82);
          }
        }
        for (const side of [-1, 1]) {
          block(head, side * w * 0.33, shape === "bus" ? 0.74 : 0.82, l * 0.503, w * 0.23, 0.14, 0.045);
          block(tail, side * w * 0.34, 0.78, -l * 0.503, w * 0.2, shape === "hatch" ? 0.3 : 0.13, 0.045);
          block(trim, side * w * 0.51, 0.32, 0, 0.055, 0.11, l * 0.65);
        }
        block(trim, 0, 0.43, l * 0.507, w * 0.85, 0.14, 0.06);
        block(trim, 0, 0.43, -l * 0.507, w * 0.85, 0.14, 0.06);
        block(trim, 0, 0.76, l * 0.509, w * 0.26, 0.11, 0.02);
      }
      return {
        body: SN.merged(body),
        glass: SN.merged(glass),
        trim: SN.merged(trim),
        accent: accent.length ? SN.merged(accent) : null,
        head: SN.merged(head),
        tail: SN.merged(tail)
      };
    });
    SN.carColors = [0xb8a98e, 0x7f968c, 0x395d70, 0x8c4c40, 0xaeb4b8, 0x3c465e, 0x4a706a, 0x6b5a48];
    SN.cars = [];
    SN.carPaintSurface = SN.getSurface("carPaint");
    SN.vehicleAccentMats = [
      SN.mat(0xd8c49a, { roughness: 0.5, envMapIntensity: 0.9 }),
      SN.mat(0x8fc4bd, { roughness: 0.5 }),
      SN.mat(0xd8ae72, { roughness: 0.5 }),
      SN.mat(0x3a6f96, { roughness: 0.45, metalness: 0.2 })
    ];
    // Seoul traffic circuits: two downtown blocks, a Gangnam block, a cross-river loop
    // over the two central bridges, and a western loop serving Yeouido.
    SN.trafficRoutes = [
      [[-700, -800], [360, -800], [360, -640], [-700, -640]],
      [[360, -640], [760, -640], [760, -430], [360, -430]],
      [[-130, 1060], [560, 1060], [560, 900], [-130, 900]],
      [[-130, -40], [560, -40], [560, 900], [-130, 900]],
      [[-780, -40], [-130, -40], [-130, 900], [-780, 900]]
    ];
    for (let i = 0; i < 28; i++) {
      const route = SN.trafficRoutes[i % SN.trafficRoutes.length],
        seg = Math.floor(i / SN.trafficRoutes.length) % route.length,
        t = 0.18 + ((i * 0.19) % 0.58);
      const a = route[seg], b = route[(seg + 1) % route.length];
      SN.makeCar(SN.lerp(a[0], b[0], t), SN.lerp(a[1], b[1], t), Math.atan2(b[0] - a[0], b[1] - a[1]), false, route, (seg + 1) % route.length, i % 7 === 1 ? 8 : SN.trafficTypeAt(a[0], a[1], i % 3 === 0));
    }
    SN.makeCar(500, -452, SN.PI / 2, true, null);
    SN.makeCar(330, -452, SN.PI / 2, true, null);
    SN.makeCar(-900, 400, 0, true, null);
    SN.makeCar(-160, 1104, 0, true, null);
    SN.makeCar(600, 874, SN.PI / 2, true, null);
    SN.makeCar(880, -718, SN.PI / 2, true, null);
    SN.makeCar(-812, -300, 0, true, null, 0, 4);
    SN.makeCar(-700, -665, SN.PI / 2, true, null, 0, 5);
    SN.makeCar(-58, -766, SN.PI / 2, true, null, 0, 8);
    SN.makeCar(400, -452, SN.PI / 2, true, null, 0, 8);
    SN.makeCar(-146, 1090, 0, true, null, 0, 7);
    SN.makeCar(430, -406, SN.PI / 2, true, null, 0, 10);
    SN.makeCar(-190, 984, SN.PI / 2, true, null, 0, 11);
  });
  // Startup phase 39: keep this order relative to the other systems.

  SN.registerInit(39, function initializeVehicles39() {
    // All vehicle wheels use two shared draws, including steering and rolling transforms.
    SN.wheelInstances = [SN.wheelGeo, SN.rimGeo].map((geometry, i) => {
      const g = geometry.clone();
      g.boundingSphere = new SN.T.Sphere(new SN.T.Vector3(), SN.WORLD * 1.5);
      const mesh = new SN.T.InstancedMesh(g, i === 0 ? SN.tireMat : SN.chromeMat, 256);
      mesh.instanceMatrix.setUsage(SN.T.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.frustumCulled = true;
      SN.scene.add(mesh);
      return mesh;
    });
  });
  // Startup phase 47: keep this order relative to the other systems.

  SN.registerInit(47, function initializeVehicles47() {
    // Four-axis oriented hull contact preserves lane clearance for long buses.
    SN.vehicleContactResult = { nx: 0, nz: 0, depth: 0 };
    // Overlapping hull circles cover each wheelbase, including bus noses and rear overhangs.
    SN.carResolve = { x: 0, z: 0, nx: 0, nz: 0, hit: false };
    // A small road graph makes pursuit cars navigate intersections instead of walls.
    SN.roadNodes = [];
    SN.roadSegments = [];
    for (const r of SN.roads.filter(road => !road.pedestrian && road.width >= 6))
      for (let i = 0; i < r.points.length - 1; i++) {
        const a = r.points[i], b = r.points[i + 1];
        SN.roadSegments.push({ a, b, width: r.width, laneOffset: r.laneOffset, lanes: r.lanes, cuts: [0, 1] });
      }
    for (let i = 0; i < SN.roadSegments.length; i++)
      for (let j = i + 1; j < SN.roadSegments.length; j++) {
        const a = SN.roadSegments[i],
          b = SN.roadSegments[j],
          dx = a.b[0] - a.a[0],
          dz = a.b[1] - a.a[1],
          ex = b.b[0] - b.a[0],
          ez = b.b[1] - b.a[1],
          den = dx * ez - dz * ex;
        if (Math.abs(den) < 0.001)
          continue;
        const qx = b.a[0] - a.a[0], qz = b.a[1] - a.a[1], t = (qx * ez - qz * ex) / den, u = (qx * dz - qz * dx) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
          a.cuts.push(t);
          b.cuts.push(u);
        }
      }
    for (let i = 0; i < SN.roadSegments.length; i++)
      for (let j = i + 1; j < SN.roadSegments.length; j++) {
        const a = SN.roadSegments[i], b = SN.roadSegments[j];
        for (const [first, second] of [[a, b], [b, a]]) {
          const dx = first.b[0] - first.a[0], dz = first.b[1] - first.a[1], den = dx * dx + dz * dz;
          if (den < 0.01)
            continue;
          for (const point of [second.a, second.b]) {
            const t = ((point[0] - first.a[0]) * dx + (point[1] - first.a[1]) * dz) / den;
            if (t > 0 && t < 1 && SN.segmentDistance(...point, ...first.a, ...first.b) < 0.05)
              first.cuts.push(t);
          }
        }
      }
    for (const segment of SN.roadSegments) {
      segment.cuts.sort((a, b) => a - b);
      let previous = -1;
      for (const t of segment.cuts) {
        const index = SN.roadNode(SN.lerp(segment.a[0], segment.b[0], t), SN.lerp(segment.a[1], segment.b[1], t));
        if (previous >= 0 && previous !== index) {
          const distance = Math.hypot(SN.roadNodes[index].x - SN.roadNodes[previous].x, SN.roadNodes[index].z - SN.roadNodes[previous].z);
          SN.roadNodes[previous].links.push({ index, distance, width: segment.width, laneOffset: segment.laneOffset, lanes: segment.lanes });
          SN.roadNodes[index].links.push({
            index: previous,
            distance,
            width: segment.width,
            laneOffset: segment.laneOffset,
            lanes: segment.lanes
          });
        }
        previous = index;
      }
    }
    // Reverse Dijkstra is cached per destination; no cubic work as the map grows.
    SN.navCount = SN.roadNodes.length;
    SN.navCache = new Map();
  });
})(window.SN);
