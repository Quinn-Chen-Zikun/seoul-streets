/* 车辆模型、驾驶物理、交通路线与车辆交互。 */
"use strict";
(function (SN) {
  // Metres throughout: 4.0–4.8 m vehicles; a 1.75 m humanoid at scale 1.
  // The Han river surface sits at this height; boats ride on it instead of the road.
  SN.WATER_Y = -0.65;

  SN.roundedBox = function roundedBox(w, h, d, r = 0.12, segments = 4) {
    const g = new SN.T.BoxGeometry(w, h, d, segments, segments, segments === 4 ? 6 : segments),
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
    c.hailedUntil = 0; c.busDwell = 0; c.lastBusStop = null; c.busNext = 0;
    c.spec = SN.vehicleSpecs[type];
    c.body.scale.set(1, 1, 1);
    c.exploded = false; c.burnTime = 0; c.damageByPlayer = false;
    const spec = c.spec, geo = SN.vehicleGeometry[type], body = c.body;
    // Refit only recycled, off-screen traffic. All geometries and trim materials are shared.
    for (const light of c.lights || [])
      light.material.dispose();
    c.lights = null;
    body.clear();
    for (const wheel of c.wheels)
      c.root.remove(wheel.pivot);
    c.wheels.length = 0;
    const color = type === 3 ? 0xff7a16 : type === 6 ? (c.serial % 2 ? 0x1485ed : 0x46b83f) : type === 14 ? 0xf3f1db : type === 15 ? 0xd5392d : type === 16 ? (c.serial % 2 ? 0xeef2f0 : 0x2f5f7d) : type >= 12 ? 0x243a53 : type === 9 ? 0xd3e3e7 : type === 10 ? 0x225d5b : type === 11 ? 0x753e36 : SN.carColors[c.serial % SN.carColors.length];
    c.paintColor = color;
    c.paint.color.copy(SN.srgb(color));
    SN.meshAt(geo.body, c.paint, 0, 0, 0, 1, 1, 1, 0, body);
    const glass = SN.meshAt(geo.glass, SN.glassMat, 0, 0, 0, 1, 1, 1, 0, body);
    glass.castShadow = false;
    c.glass = glass; c.glassBroken = false;
    SN.meshAt(geo.trim, SN.tireMat, 0, 0, 0, 1, 1, 1, 0, body);
    SN.meshAt(geo.chrome, SN.chromeMat, 0, 0, 0, 1, 1, 1, 0, body).castShadow = false;
    if (geo.red)
      SN.meshAt(geo.red, SN.redLensMat, 0, 0, 0, 1, 1, 1, 0, body).castShadow = false;
    if (geo.blue)
      SN.meshAt(geo.blue, SN.blueLensMat, 0, 0, 0, 1, 1, 1, 0, body).castShadow = false;
    if (geo.plate)
      SN.meshAt(geo.plate, SN.plateMat, 0, 0, 0, 1, 1, 1, 0, body).castShadow = false;
    SN.meshAt(geo.head, SN.headMat, 0, 0, 0, 1, 1, 1, 0, body).castShadow = false;
    SN.meshAt(geo.tail, SN.tailMat, 0, 0, 0, 1, 1, 1, 0, body).castShadow = false;
    if (geo.accent)
      SN.meshAt(geo.accent, SN.vehicleAccentMats[type === 9 ? 3 : type === 10 ? 1 : type === 11 ? 2 : 0], 0, 0, 0, 1, 1, 1, 0, body);
    // A painted bonnet gives crash damage a readable stage: it lifts off its
    // rear hinge long before the engine catches fire.
    c.hood = null;
    if (["sedan", "hatch", "suv", "taxi", "pickup", "coupe", "silverCrew", "redCrew", "police"].includes(spec.shape)) {
      const depth = spec.length * 0.26, hinge = new SN.T.Group(),
        hood = SN.meshAt(SN.roundedBox(spec.width * 0.62, 0.035, depth, 0.02, 2), c.paint,
          0, 0, depth * 0.5, 1, 1, 1, 0, hinge);
      hood.castShadow = false;
      hinge.position.set(0, spec.height * 0.57, spec.length * 0.16);
      c.hood = hinge;
      c.hoodBaseZ = hinge.position.z;
      body.add(hinge);
    }
    if (spec.emergency || type === 9) {
      const barZ = type === 9 ? -0.12 : 0.5;
      c.lights = [
        SN.glow(body, -0.28, spec.height + 0.12, barZ, 0.9, 0xff4a4a),
        SN.glow(body, 0.28, spec.height + 0.12, barZ, 0.9, 0x4a8fff)
      ];
    }
    const radius = SN.vehicleWheelRadius(spec);
    c.wheelRadius = radius;
    // Tanks ride on their modelled tracks; extra car wheels would float outside them.
    for (const side of spec.bike ? [0] : spec.tank || spec.boat ? [] : [-1, 1])
      for (const end of [-1, 1]) {
        const pivot = new SN.T.Group(), wheel = new SN.T.Group();
        pivot.position.set(side * (spec.width * 0.48 - 0.135), radius, end * spec.length * (spec.bike ? 0.36 : 0.32));
        wheel.scale.set(spec.bike ? 0.55 : 1, radius / 0.33, radius / 0.33);
        pivot.add(wheel);
        c.root.add(pivot);
        c.wheels.push({ pivot, wheel, front: end > 0, x: pivot.position.x, z: pivot.position.z });
      }
    c.cruise = spec.cruise * (0.86 + (c.serial % 5) * 0.06);
    if (SN.models && SN.models.attachCar) SN.models.attachCar(c);
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
      roughness: 0.58,
      metalness: 0.3,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2 + (SN.cars.length % 5) * 0.03,
      envMapIntensity: 0.75
    });
    paint.normalScale.set(0.22, 0.22);
    SN.applyLocalUV(paint, 1.15, 1.15);
    SN.envMats.push({ material: paint, base: 0.75 });
    const car = {
      burnTime: 0, exploded: false, damageByPlayer: false,
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
      yawRate: 0,
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
        car.x -= Math.cos(yaw) * offset;
        car.z += Math.sin(yaw) * offset;
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
    if (mainRoad && SN.rnd() < 0.025) return SN.rnd() < 0.6 ? 14 : 15;
    return mainRoad && SN.rnd() < 0.15 ? 6 : mix[Math.floor(SN.rnd() * mix.length)];
  };

  SN.updateCarLOD = function updateCarLOD() {
    let count = 0;
    const level = SN.qualityLevel(), near = level === 0 ? 48 : level === 1 ? 72 : 110;
    for (const c of SN.cars) {
      const distance = Math.hypot(c.x - SN.player.x, c.z - SN.player.z);
      SN.carCullSphere.center.copy(c.root.position); SN.carCullSphere.radius = c.spec.length + 3;
      if (c !== SN.player.car && distance > 25 && !SN.tileFrustum.intersectsSphere(SN.carCullSphere)) { c.root.visible = false; continue; }
      const detailed = c === SN.player.car || distance < near || (c.role === "police" && distance < 140);
      c.root.visible = c.active && (detailed || c.exploded && distance < 160);
      if (!c.active || c.root.visible || distance > (level === 0 ? 360 : 560) || count >= SN.carLOD[0].instanceMatrix.count) continue;
      SN.dummy.position.copy(c.root.position);
      SN.dummy.rotation.set(c.pitch, c.root.rotation.y, c.roll);
      SN.dummy.scale.set(c.spec.width, c.spec.height, c.spec.length);
      SN.dummy.updateMatrix();
      for (const mesh of SN.carLOD) mesh.setMatrixAt(count, SN.dummy.matrix);
      SN.carLOD[0].setColorAt(count, c.paint.color);
      count++;
    }
    for (const mesh of SN.carLOD) {
      mesh.count = count; mesh.visible = count > 0;
      if (!count) continue;
      mesh.instanceMatrix.updateRange.offset = 0; mesh.instanceMatrix.updateRange.count = count * 16;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.updateRange.offset = 0; mesh.instanceColor.updateRange.count = count * 3;
      mesh.instanceColor.needsUpdate = true;
    }
  };

  SN.updateVehicleWheels = function updateVehicleWheels() {
    let count = 0;
    for (const c of SN.cars) {
      if (c.modeled || !c.active || !c.root.visible || Math.hypot(c.root.position.x - SN.playerRender.x, c.root.position.z - SN.playerRender.z) > 150)
        continue;
      c.root.updateMatrixWorld(true);
      for (const w of c.wheels) {
        if (count >= SN.wheelInstances[0].instanceMatrix.count) break;
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
    if (c.spec.boat)
      return SN.boatLanding(c);
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
    if (!SN.canControl() || SN.player.bail || SN.carjack)
      return;
    if (SN.player.aircraft) {
      SN.exitAircraft();
      SN.refreshHUD();
      return;
    }
    if (!SN.player.car && SN.cableTarget && SN.startCableRide()) {
      SN.refreshHUD();
      return;
    }
    if (!SN.player.car && SN.useDoor()) {
      SN.refreshHUD();
      return;
    }
    if (SN.player.car) {
      const c = SN.player.car, landing = SN.exitPosition(c);
      if (c.spec.boat && !landing) {
        SN.toast("靠近岸边后再下船", 2);
        return;
      }
      const exit = landing || SN.safePosition(c.x + Math.cos(c.yaw) * (c.spec.width / 2 + 0.8), c.z - Math.sin(c.yaw) * (c.spec.width / 2 + 0.8), 0.3);
      c.parked = false;
      c.freeRolling = !c.spec.boat;
      if (c.spec.boat) {
        c.parked = true;
        c.speed = c.vx = c.vz = 0;
      }
      c.driver = false;
      SN.player.car = null;
      SN.playerRoot.rotation.set(0, SN.player.yaw, 0);
      SN.playerRoot.visible = true;
      for (const leg of SN.playerRig.legs)
        leg.planted = false;
      SN.beginBailout(SN.player, c, exit, true);
      SN.toast(c.spec.boat ? "已下船" : SN.player.bail ? "跳车 · 翻滚后起身" : "已下车", 2);
    }
    else {
      if (SN.military && SN.military.nearest && SN.military.nearestDistance < 5.5 && SN.boardAircraft(SN.military.nearest)) {
        SN.refreshHUD();
        return;
      }
      SN.findNearestCar(true);
      if (!SN.nearestCar || SN.nearDistance > 5.5) {
        SN.toast("靠近任意车辆后按 F，包括正在行驶的车辆。", 3);
        return;
      }
      const c = SN.nearestCar;
      if (c.exploded) { SN.toast("车辆已报废 · 寻找另一辆车", 2); return; }
      if (c === SN.missionCar && SN.campaign.active) {
        SN.toast("这是任务目标车 · 追停或保持跟踪距离", 3);
        return;
      }
      if (c.type === 3 && c.hailedUntil > SN.simTime && Math.abs(c.speed) < 1.5 && SN.heat === 0 && !SN.campaign.active) { SN.rideHailedTaxi(c); return; }
      if (c.occupant) {
        SN.cityBark(c.occupant, "carjack", "angry");
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
        if (!driver.bail) driver.bail = { vx: Math.cos(c.yaw) * 1.8, vz: -Math.sin(c.yaw) * 1.8, vy: 1.4, y: driver.y + 0.2, time: 0, duration: 1.05, angle: 0 };
        driver.hostile = driver.personality === "angry" || driver.kind !== "civilian";
        driver.hostileTimer = driver.hostile ? 12 : 0;
        driver.meleeOnly = driver.kind === "civilian";
        SN.carjack = { car: c, time: 0.6, x: SN.player.x, z: SN.player.z };
        if (c.role === "police")
          SN.commitCrime(3, "抢夺警车 ★3", "policeCarjack", 55);
        else
          SN.commitCrime(1, "劫车 ★1", "carjack", 45);
        if (c.role === "gang")
          SN.crews[c.team].anger = 40;
        SN.toast("已拉出驾驶员并接管车辆 · 目击者可能报警", 3);
      }
      else if (c !== SN.loanCar && c !== SN.missionCar && c.role !== "mission" && c.role !== "boat")
        SN.commitCrime(1, "盗窃车辆 ★1", "cartheft", 38);
      if (c !== SN.loanCar && c.role !== "mission" && c.role !== "boat" && !c.stolenOnce) { SN.progression.stats.carsStolen++; c.stolenOnce = true; }
      if (!SN.carjack) SN.carjack = { car: c, time: 0.6, x: SN.player.x, z: SN.player.z };
      SN.player.vault = null;
      SN.player.car = c;
      c.freeRolling = false;
      c.parked = true;
      c.driver = false;
      c.vx = Math.sin(c.yaw) * c.speed;
      c.vz = Math.cos(c.yaw) * c.speed;
      SN.player.x = c.x;
      SN.player.z = c.z;
      SN.player.y = c.root.position.y;
      SN.playerRoot.visible = !!c.spec.bike || !!c.spec.boat || !!SN.carjack;
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
      if (!c.active || c.exploded)
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

  // A boat is blocked by shore, piers and solid props, never by open water.
  SN.boatBlocked = function boatBlocked(x, z, yaw, c) {
    const radius = c.spec.width * 0.52,
      span = Math.max(0, c.spec.length * 0.5 - radius),
      segments = Math.max(2, Math.ceil(span / 0.9)),
      sn = Math.sin(yaw), co = Math.cos(yaw);
    for (let i = 0; i <= segments; i++) {
      const along = span * (i / segments * 2 - 1), px = x + sn * along, pz = z + co * along;
      // The road layer treats the bridge footprint as dry. On the river layer
      // only the piers and low bridge sections block the hull.
      if (!SN.inLake(px, pz) && (!SN.pointInRiver(px, pz) || SN.onIsland(px, pz)))
        return true;
      const bridge = SN.causewayAt(px, pz, -radius);
      if (bridge && (SN.bridgeProfile(bridge, pz) - 2.15 < SN.WATER_Y + 0.18 + c.spec.height + 0.25 ||
          bridge.boatPiers.some(pier => Math.abs(px - pier.x) < pier.halfWidth + radius &&
            Math.abs(pz - pier.z) < pier.halfDepth + radius)))
        return true;
    }
    return false;
  };

  // Nearest dry landing point around a moored boat, used for exits and map pins.
  SN.boatLanding = function boatLanding(c) {
    for (let ring = 0; ring < 5; ring++)
      for (let i = 0; i < 16; i++) {
        const a = i * SN.TAU / 16, d = 3.2 + ring * 1.4,
          x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d;
        if ((!SN.pointInRiver(x, z) || SN.onIsland(x, z)) && !SN.isWater(x, z, 0.45) && !SN.blocked(x, z, 0.32))
          return { x, z };
      }
    return null;
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
    SN.vehicleContactResult.nx = nx; SN.vehicleContactResult.nz = nz; SN.vehicleContactResult.depth = depth;
    return SN.vehicleContactResult;
  };

  SN.carDamage = function carDamage(c, impact, other = null) {
    if (c.collisionTimer > 0)
      return;
    const policeRam = c === SN.player.car && other && other.role === "police";
    c.collisionTimer = policeRam ? 1 : 0.45;
    c.health = Math.max(0, c.health - Math.min(policeRam ? 6 : 100, Math.max(0, impact - 2.2) * 0.95 * c.spec.damage));
    if (impact > 7) SN.shatterCarGlass(c);
    if (c === SN.player.car && impact > 8 && !policeRam)
      SN.hurtPlayer((impact - 7) * 0.7);
  };

  SN.repairVehicle = function repairVehicle(c, repaint = false) {
    c.health = 100; c.burnTime = 0; c.explodedAt = -1; c.exploded = false; c.damageByPlayer = false;
    c.recoveryTime = 0; c.recoveryReady = false;
    c.body.scale.set(1, 1, 1);
    c.glassBroken = false;
    if (c.glass) c.glass.visible = !c.modeled;
    if (c.modeled) for (const mesh of c.modelGlass || []) mesh.visible = true;
    if (c.hood) { c.hood.rotation.x = 0; c.hood.position.z = c.hoodBaseZ; }
    c.paint.roughness = 0.58;
    if (repaint) c.paintColor = SN.carColors[(c.serial + Math.floor(SN.simTime)) % SN.carColors.length];
    c.paint.color.copy(SN.srgb(c.paintColor));
  };

  SN.applyCarDents = function applyCarDents(c) {
    const damage = 1 - SN.clamp(c.health / 100, 0, 1),
      lift = SN.clamp((damage - 0.3) / 0.7, 0, 1);
    // Dents stay shallow. A deep vertical squash shrank the cabin around the
    // seated driver and let the rig poke through the roof in a hard crash.
    c.body.scale.set(1 + damage * 0.012, 1 - damage * 0.035, 1 - damage * 0.02);
    c.paint.roughness = 0.58 + damage * 0.32;
    if (c.hood) {
      c.hood.rotation.x = -lift * 0.6;
      c.hood.position.z = c.hoodBaseZ - lift * 0.04;
    }
  };

  SN.updateVehicleDamage = function updateVehicleDamage(dt) {
    let effects = 0;
    for (const c of SN.cars) {
      if (!c.active) continue;
      if (c.health < 65) SN.shatterCarGlass(c);
      if (c.health > 45 && !c.exploded) {
        c.burnTime = 0;
        SN.applyCarDents(c);
        continue;
      }
      if (c.health <= 20 && !c.exploded) {
        c.burnTime = (c.burnTime || 0) + dt;
        c.health = Math.max(0, c.health - dt * 2.5);
        if (c.occupant) SN.dismount(c);
        if (c === SN.player.car && c.burnTime < dt * 1.5) SN.toast("引擎起火！按 F 或下车按钮离开", 4);
        if (c.burnTime >= (c.health <= 0 ? 3 : 7)) {
          c.exploded = true; c.explodedAt = SN.simTime;
          c.health = 0; c.driver = false; c.parked = true; c.freeRolling = false;
          c.speed = c.vx = c.vz = 0;
          c.paint.color.copy(SN.srgb(0x343d43));
          SN.blast(c.x, c.y + 0.9, c.z, 9, 120, c, !!c.damageByPlayer);
        }
      }
      if (c.exploded && SN.simTime - c.explodedAt > 18) continue;
      SN.applyCarDents(c);
      if (Math.hypot(c.x - SN.player.x, c.z - SN.player.z) > 120 || effects >= (SN.qualityLevel() === 0 ? 2 : 5)) continue;
      effects++;
      c.effectClock = (c.effectClock || 0) - dt;
      if (c.effectClock <= 0) {
        c.effectClock = 0.22;
        const x = c.x + Math.sin(c.yaw) * c.spec.length * 0.3, z = c.z + Math.cos(c.yaw) * c.spec.length * 0.3;
        SN.spawnDust(x, c.y + c.spec.height + 0.6, z, c.health <= 20 && !c.exploded ? 0xff7826 : 0x626b75, c.exploded ? 2 : 3);
        if (c.health <= 20 && !c.exploded) SN.emitSparks(x, c.y + 0.8, z, 2, true);
      }
    }
  };

  SN.shatterCarGlass = function shatterCarGlass(c) {
    if (c.glassBroken || c.spec.bike) return;
    c.glassBroken = true;
    if (c.glass) c.glass.visible = false;
    for (const mesh of c.modelGlass || []) mesh.visible = false;
    if (Math.hypot(c.x - SN.player.x, c.z - SN.player.z) > 90) return;
    SN.spawnDebris(c.x, c.y + c.spec.height * 0.75, c.z, true);
    SN.noiseHit(0.18, 0.055, "highpass", 3500, 1, 0, c);
  };

  SN.spawnDebris = function spawnDebris(x, y, z, glass) {
    if (!SN.debrisPool) return;
    const count = SN.qualityLevel() === 0 ? 6 : glass ? 10 : 18;
    for (let i = 0; i < count; i++) {
      const d = SN.debrisPool[SN.debrisCursor++ % SN.debrisPool.length];
      Object.assign(d, { x, y, z, vx: SN.rand(-5, 5), vz: SN.rand(-5, 5), vy: SN.rand(2, 7),
        life: glass ? 1.2 : 2.4, size: glass ? 0.13 : SN.rand(0.14, 0.34), glass, spin: SN.rand(-6, 6) });
    }
  };

  SN.updateVehicleEffects = function updateVehicleEffects(dt) {
    const c = SN.player.car;
    SN.skidClock -= dt;
    if (c && !c.airborne && Math.abs(c.speed) > 7 && SN.skidClock <= 0 &&
        (SN.keys.Space || SN.touch.brake || Math.abs(c.vx * Math.cos(c.yaw) - c.vz * Math.sin(c.yaw)) > 3)) {
      SN.skidClock = SN.qualityLevel() === 0 ? 0.1 : 0.055;
      for (const side of c.spec.bike ? [0] : [-1, 1]) {
        const x = c.x + Math.cos(c.yaw) * side * c.spec.width * 0.4 - Math.sin(c.yaw) * c.spec.length * 0.3,
          z = c.z - Math.sin(c.yaw) * side * c.spec.width * 0.4 - Math.cos(c.yaw) * c.spec.length * 0.3;
        if (SN.isWater(x, z)) continue;
        const d = SN.skidPool[SN.skidCursor++ % SN.skidPool.length];
        Object.assign(d, { x, z, y: SN.surfaceHeight(x, z) + 0.025, yaw: Math.atan2(c.vx, c.vz),
          length: Math.min(2.4, Math.abs(c.speed) * SN.skidClock * 1.3), life: 12 });
        SN.spawnDust(x, c.y + 0.25, z, 0xc9d3d5, 1.4);
      }
    }
    // A speedboat leaves a short foam wake behind the transom.
    if (c && c.spec.boat && Math.abs(c.speed) > 3.5 && SN.simTime > (SN.boatWakeAt || 0)) {
      SN.boatWakeAt = SN.simTime + 0.1;
      SN.spawnDust(
        c.x - Math.sin(c.yaw) * c.spec.length * 0.42,
        SN.WATER_Y + 0.05,
        c.z - Math.cos(c.yaw) * c.spec.length * 0.42,
        0xd8f2f7, 1.1);
    }
    // Wet-road wheel spray: a small world-space particle pool behind the rear tyres.
    const wet = SN.weather && SN.weather.kind === "rain" ? SN.weather.intensity * (SN.wetness || 0) : 0;
    if (c && wet > 0.08 && !c.airborne && Math.abs(c.speed) > 4.5 && !SN.isWater(c.x, c.z)) {
      SN.sprayClock -= dt;
      if (SN.sprayClock <= 0) {
        SN.sprayClock = SN.qualityLevel() === 0 ? 0.16 : 0.09;
        for (const side of c.spec.bike ? [0] : [-1, 1]) {
          const p = SN.wheelSprayPool[SN.sprayCursor++ % SN.wheelSprayPool.length];
          const sx = Math.cos(c.yaw) * side * c.spec.width * 0.42 - Math.sin(c.yaw) * c.spec.length * 0.34,
            sz = -Math.sin(c.yaw) * side * c.spec.width * 0.42 - Math.cos(c.yaw) * c.spec.length * 0.34;
          Object.assign(p, {
            x: c.x + sx, y: c.y + 0.16, z: c.z + sz,
            vx: c.vx * 0.28 - Math.sin(c.yaw) * SN.rand(1.4, 3.2) + SN.rand(-0.8, 0.8),
            vy: SN.rand(1.2, 2.8),
            vz: c.vz * 0.28 - Math.cos(c.yaw) * SN.rand(1.4, 3.2) + SN.rand(-0.8, 0.8),
            life: 0.42 + SN.rand(0, 0.28), max: 0.7, size: 0.055 + SN.rand(0, 0.07)
          });
        }
      }
    }
    let sprayCount = 0;
    for (const p of SN.wheelSprayPool) {
      if (p.life <= 0) continue;
      p.life -= dt; p.vy -= 7 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.life <= 0) continue;
      const k = 1 - p.life / p.max;
      SN.dummy.position.set(p.x, p.y, p.z);
      SN.dummy.rotation.set(0, (p.x + p.z) * 0.9, 0);
      const size = p.size * (1 + k * 4.2);
      SN.dummy.scale.set(size, size * 0.7, size); SN.dummy.updateMatrix();
      SN.wheelSprayMesh.setMatrixAt(sprayCount, SN.dummy.matrix);
      SN.sprayTint.setRGB(0.62, 0.76, 0.82).multiplyScalar(Math.max(0, 1 - k) * wet * 0.9);
      SN.wheelSprayMesh.setColorAt(sprayCount++, SN.sprayTint);
    }
    SN.wheelSprayMesh.count = Math.min(sprayCount, SN.wheelSprayMesh.instanceMatrix.count);
    SN.wheelSprayMesh.visible = SN.wheelSprayMesh.count > 0;
    if (sprayCount) {
      SN.wheelSprayMesh.instanceMatrix.needsUpdate = true;
      SN.wheelSprayMesh.instanceColor.needsUpdate = true;
    }
    let skidCount = 0, debrisCount = 0;
    for (const d of SN.skidPool) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0 || Math.hypot(d.x - SN.player.x, d.z - SN.player.z) > 170) { d.life = 0; continue; }
      SN.dummy.position.set(d.x, d.y, d.z); SN.dummy.rotation.set(0, d.yaw, 0);
      SN.dummy.scale.set(0.19 * Math.min(1, d.life / 2), 0.012, d.length); SN.dummy.updateMatrix();
      SN.skidMesh.setMatrixAt(skidCount++, SN.dummy.matrix);
    }
    for (const d of SN.debrisPool) {
      if (d.life <= 0) continue;
      d.life -= dt; d.vy -= 13 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const floor = SN.surfaceHeight(d.x, d.z) + 0.08;
      if (d.y < floor) { d.y = floor; d.vy = Math.abs(d.vy) * 0.3; d.vx *= 0.6; d.vz *= 0.6; }
      SN.dummy.position.set(d.x, d.y, d.z); SN.dummy.rotation.set(d.life * d.spin, d.life * 4, 0);
      const size = d.size * Math.min(1, Math.max(0, d.life) * 3);
      SN.dummy.scale.set(size, size * (d.glass ? 0.12 : 0.5), size); SN.dummy.updateMatrix();
      SN.debrisMesh.setMatrixAt(debrisCount, SN.dummy.matrix);
      SN.effectColor.setHex(d.glass ? 0x9ddff7 : 0x5b5149); SN.debrisMesh.setColorAt(debrisCount++, SN.effectColor);
    }
    SN.skidMesh.count = skidCount; SN.skidMesh.visible = skidCount > 0; SN.skidMesh.instanceMatrix.needsUpdate = true;
    SN.debrisMesh.count = debrisCount; SN.debrisMesh.visible = debrisCount > 0; SN.debrisMesh.instanceMatrix.needsUpdate = true;
    if (debrisCount) SN.debrisMesh.instanceColor.needsUpdate = true;
  };

  SN.registerInit(32.5, function initializeVehicleEffects() {
    SN.skidPool = Array.from({ length: 144 }, () => ({ life: 0 }));
    SN.debrisPool = Array.from({ length: 48 }, () => ({ life: 0 }));
    SN.wheelSprayPool = Array.from({ length: 56 }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.06 }));
    SN.skidCursor = 0; SN.debrisCursor = 0; SN.skidClock = 0;
    SN.sprayCursor = 0; SN.sprayClock = 0; SN.sprayTint = new SN.T.Color();
    SN.skidMesh = new SN.T.InstancedMesh(SN.box, new SN.T.MeshBasicMaterial({ color: 0x29323b, transparent: true, opacity: 0.4, depthWrite: false }), 144);
    SN.debrisMesh = new SN.T.InstancedMesh(SN.box, new SN.T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), 48);
    SN.wheelSprayMesh = new SN.T.InstancedMesh(new SN.T.SphereGeometry(1, 5, 4),
      new SN.T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, blending: SN.T.AdditiveBlending }), 56);
    SN.effectColor = new SN.T.Color();
    for (const mesh of [SN.skidMesh, SN.debrisMesh, SN.wheelSprayMesh]) {
      mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = false; SN.scene.add(mesh);
    }
  });

  SN.trafficGreen = function trafficGreen(signal, time = SN.simTime) {
    const phase = (time + signal.offset) % 24;
    return signal.axis === 0 ? phase < 9 : phase >= 11 && phase < 20;
  };

  SN.updateSignals = function updateSignals() {
    const phase = Math.floor(SN.simTime * 4);
    if (phase === SN.signalTick) return;
    SN.signalTick = phase;
    for (let i = 0; i < SN.trafficSignals.length; i++) {
      const signal = SN.trafficSignals[i], green = SN.trafficGreen(signal);
      signal.green = green;
      SN.signalLamps.setColorAt(i * 2, SN.signalColors[green ? 0 : 1]);
      SN.signalLamps.setColorAt(i * 2 + 1, SN.signalColors[green ? 2 : 3]);
    }
    SN.signalLamps.instanceColor.needsUpdate = true;
  };

  SN.trafficStopDistance = function trafficStopDistance(c) {
    let stop = Infinity;
    const sn = Math.sin(c.yaw), co = Math.cos(c.yaw);
    for (const signal of SN.trafficSignals) {
      const dx = signal.x - c.x, dz = signal.z - c.z;
      if (Math.abs(dx) > 90 || Math.abs(dz) > 90) continue;
      if (sn * signal.sn + co * signal.co < 0.7 || signal.green) continue;
      const along = dx * sn + dz * co, across = dx * co - dz * sn;
      // Once over the stop line, clear the crossing instead of braking inside it.
      const gap = along - c.spec.length / 2;
      if (gap > -0.5 && Math.abs(across) < signal.width / 2) stop = Math.min(stop, Math.max(0, gap));
    }
    return stop;
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
    const hint = Number.isFinite(c.groundY) ? c.groundY : Number.isFinite(c.y) ? c.y : null;
    const fl = SN.surfaceHeight(c.x - co * halfW + sn * halfL, c.z + sn * halfW + co * halfL, hint),
      fr = SN.surfaceHeight(c.x + co * halfW + sn * halfL, c.z - sn * halfW + co * halfL, hint),
      rl = SN.surfaceHeight(c.x - co * halfW - sn * halfL, c.z + sn * halfW - co * halfL, hint),
      rr = SN.surfaceHeight(c.x + co * halfW - sn * halfL, c.z - sn * halfW - co * halfL, hint), result = SN.vehicleGroundResult;
    result.y = (fl + fr + rl + rr) / 4;
    result.pitch = -Math.atan2((fl + fr - rl - rr) / 2, halfL * 2);
    result.roll = Math.atan2((fr + rr - fl - rl) / 2, halfW * 2);
    return result;
  };

  SN.resetVehicleGround = function resetVehicleGround(c) {
    if (c.spec.boat) {
      c.y = SN.WATER_Y + 0.18;
      c.groundY = c.y; c.groundX = c.x; c.groundZ = c.z;
      c.vy = 0; c.pitch = 0.03; c.pitchV = 0; c.terrainRoll = 0; c.rollV = 0;
      c.suspension = 0; c.suspensionV = 0; c.airborne = false;
      c.py = c.y; c.ppitch = c.pitch; c.pterrainRoll = c.terrainRoll; c.psuspension = 0;
      return;
    }
    const hintY = c.groundY, previousY = c.y;
    c.groundY = null; c.y = null;
    const ground = SN.vehicleGround(c);
    c.groundY = hintY; c.y = previousY;
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
    if (c.spec.boat) {
      // Boats ride the water plane: a slow swell, a little bow lift under power
      // and a lean into turns. There is no terrain contact, wheel or suspension.
      const t = SN.simTime * 1.5 + c.serial * 1.9,
        ratio = SN.clamp(Math.abs(c.speed) / Math.max(1, c.spec.topSpeed), 0, 1),
        targetY = SN.WATER_Y + 0.18 + Math.sin(t) * 0.02 + Math.sin(t * 0.63 + 1.7) * 0.014;
      c.y = SN.lerp(Number.isFinite(c.y) ? c.y : targetY, targetY, 1 - Math.exp(-dt * 5));
      c.vy = 0; c.airborne = false; c.suspension = 0; c.suspensionV = 0;
      c.groundY = c.y; c.groundX = c.x; c.groundZ = c.z;
      c.pitch = SN.lerp(c.pitch, 0.03 + ratio * 0.1, 1 - Math.exp(-dt * 3));
      c.terrainRoll = SN.lerp(c.terrainRoll, c.steer * ratio * 0.2, 1 - Math.exp(-dt * 4));
      c.root.position.set(c.x, c.y, c.z);
      c.root.rotation.y = c.yaw;
      c.body.rotation.set(c.pitch, 0, c.terrainRoll + c.roll * 0.6);
      c.body.position.y = 0;
      for (const w of c.wheels) w.pivot.visible = false;
      return;
    }
    if (!Number.isFinite(c.groundX) || Math.hypot(c.x - c.groundX, c.z - c.groundZ) > 8)
      SN.resetVehicleGround(c);
    const ground = SN.vehicleGround(c), slopeV = Math.abs(c.speed * Math.sin(ground.pitch));
    // A kerb is a suspension step, not a launch ramp. Smooth terrain slopes retain their lift.
    const groundV = SN.clamp((ground.y - c.groundY) / Math.max(dt, 0.0001), -Math.max(2, slopeV + 1), Math.max(2, slopeV + 1));
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
      const h = SN.surfaceHeight(c.root.position.x + co * w.x + sn * w.z, c.root.position.z - sn * w.x + co * w.z, c.y);
      w.pivot.position.y = c.wheelRadius + (c.airborne ? -0.2 : h - c.root.position.y);
    }
  };

  SN.moveCar = function moveCar(c, dt, throttle, steer, handbrake = false) {
    c.collisionTimer = Math.max(0, c.collisionTimer - dt);
    if (c.exploded || c.health <= 0) throttle = 0;
    const oldSpeed = c.speed;
    // Steering reaches full lock in roughly a tenth of a second; throttle is much sharper than before.
    // A motorcycle leans into a curve instead of snapping to a heading, so its
    // lock builds slower and tightens less at speed than a car's.
    c.steer = SN.lerp(c.steer, steer, 1 - Math.exp(-dt * (c.spec.bike ? 6 : 17)));
    const spec = c.spec,
      speedAbs = Math.abs(c.speed),
      braking = 24 / Math.sqrt(spec.mass),
      acceleration = throttle > 0 ? (c.speed < -0.5 ? braking : spec.accel * (1 - speedAbs / (spec.topSpeed * 1.35))) : (c.speed > 0.5 ? braking : spec.accel * 0.55);
    c.speed += (throttle * acceleration + (c.airborne || spec.boat ? 0 : 9.81 * Math.sin(SN.vehicleGround(c).pitch))) * dt;
    if (!throttle)
      c.speed *= Math.exp(-dt * (spec.boat ? 0.5 : 0.32));
    c.speed = SN.clamp(c.speed, -(spec.boat ? 5 : spec.bike ? 4 : 8), spec.topSpeed);
    if (handbrake)
      c.speed *= Math.exp(-dt * 0.85);
    if (c.health <= 0)
      c.speed *= Math.exp(-dt * 2);
    // Speed-sensitive lock: easy parking control, calmer at top speed. Two
    // wheels need a much smaller lock than a car or the bike whips sideways.
    const steerAngle = c.steer * (spec.boat ? 0.5 : spec.bike ? 0.24 : 0.62) / (1 + speedAbs * (spec.boat ? 0.055 : spec.bike ? 0.16 : 0.034));
    const previousYaw = c.yaw;
    const hullBlocked = (x, z, yaw) => spec.boat ? SN.boatBlocked(x, z, yaw, c) : SN.carBlocked(x, z, yaw, c);
    if (spec.bike) {
      // A steering wheel arcs into a turn instead of snapping the nose to a new
      // heading. Smoothing the bars alone still let the bike pivot on the spot,
      // so the heading itself follows the target yaw rate with a short lag; the
      // lean, the handlebar and the arc now arrive together.
      const targetYawRate = -Math.tan(steerAngle) * c.speed / (spec.length * 0.64) * (handbrake ? 1.45 : 1);
      c.yawRate = SN.lerp(c.yawRate || 0, targetYawRate, 1 - Math.exp(-dt * 9));
      c.yaw += c.yawRate * dt;
    } else {
      c.yawRate = 0;
      c.yaw -= Math.tan(steerAngle) * c.speed / (spec.length * 0.64) * dt * (handbrake ? 1.45 : 1);
    }
    if (hullBlocked(c.x, c.z, c.yaw)) c.yaw = previousYaw;
    const sn = Math.sin(c.yaw),
      co = Math.cos(c.yaw),
      gripRate = handbrake ? spec.grip * 0.2 : (speedAbs < 7 ? spec.grip * 1.6 : spec.grip),
      grip = 1 - Math.exp(-dt * gripRate);
    // Preserve engine acceleration along the chassis; grip damps lateral slip only.
    const lateral = (c.vx * co - c.vz * sn) * (1 - grip);
    c.vx = sn * c.speed + co * lateral;
    c.vz = co * c.speed - sn * lateral;
    // Bound impulses and integration work, including during pile-ups.
    SN.limitCarVelocity(c);
    const travel = Math.hypot(c.vx, c.vz) * dt,
      substeps = Math.min(6, Math.max(1, Math.ceil(travel / 0.4))),
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
      if (spec.boat ? SN.boatBlocked(nx, nz, c.yaw, c) : SN.carWater(nx, nz, c.yaw, c)) {
        c.vx *= -0.22;
        c.vz *= -0.22;
        c.speed *= 0.4;
        c.stuck += dt / substeps;
        continue;
      }
      if (detailed && !spec.boat) {
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
            if (Math.abs(c.speed) > 3 && SN.simTime > (c.scrapeAt || 0)) {
              c.scrapeAt = SN.simTime + 0.12;
              SN.emitSparks(c.x - res.nx * c.spec.width * 0.5, c.y + 0.5, c.z - res.nz * c.spec.width * 0.5, 5, true);
            }
            if (c === SN.player.car) c.damageByPlayer = true;
            if (c === SN.player.car && impact > 3) {
              SN.camShake = SN.clamp(impact * 0.03, 0.08, 0.6);
              SN.camShakeTime = 0.32;
            }
            if (impact > 5)
              SN.soundImpact(impact * SN.audioFalloff(c.x, c.z));
          }
          if (!SN.carBlocked(res.x, res.z, c.yaw, c)) { c.x = res.x; c.z = res.z; }
          else { c.vx *= -0.2; c.vz *= -0.2; }
          c.stuck += dt / substeps;
        }
        else {
          c.x = nx;
          c.z = nz;
          c.stuck = Math.max(0, c.stuck - dt / substeps * 0.6);
        }
      }
      else if (hullBlocked(nx, nz, c.yaw)) {
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
    const pushFree = (car, x, z) => car.spec.boat ? !SN.boatBlocked(x, z, car.yaw, car) : !SN.carBlocked(x, z, car.yaw, car) && !SN.carWater(x, z, car.yaw, car);
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
        SN.limitCarVelocity(o);
        if (o.parked && !o.driver && !o.exploded && o !== SN.player.car) { o.parked = false; o.freeRolling = true; }
        const copBefore = o.health;
        SN.carDamage(c, -relative, o);
        SN.carDamage(o, -relative, c);
        if (c === SN.player.car) o.damageByPlayer = true;
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
      if (pushFree(c, px, pz)) {
        c.x = px;
        c.z = pz;
      }
      const otherPush = depth * c.spec.mass / (c.spec.mass + o.spec.mass) + 0.003;
      const ox = o.x - nx * otherPush, oz = o.z - nz * otherPush;
      if (pushFree(o, ox, oz)) { o.x = ox; o.z = oz; }
    }
    SN.limitCarVelocity(c);
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
          a.bail = { vx: c.vx * 0.24, vz: c.vz * 0.24, vy: Math.min(4.5, impactSpeed * 0.18), y: SN.surfaceHeight(a.x, a.z) + 0.2, time: 0, duration: 1.6, angle: 0 };
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
    r.root.position.y += 0.32 + (c.body ? c.body.position.y : 0);
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

  SN.limitCarVelocity = function limitCarVelocity(c) {
    const speed = Math.hypot(c.vx, c.vz), limit = c.spec.topSpeed;
    if (speed > limit) { c.vx *= limit / speed; c.vz *= limit / speed; }
    c.speed = SN.clamp(c.vx * Math.sin(c.yaw) + c.vz * Math.cos(c.yaw), -limit, limit);
  };

  SN.driveControls = function driveControls() {
    const input = SN.driveInput;
    input.throttle = SN.clamp((SN.keys.KeyW || SN.keys.ArrowUp ? 1 : 0) - (SN.keys.KeyS || SN.keys.ArrowDown ? 1 : 0) + (SN.touch.accel ? 1 : 0) - (SN.touch.reverse ? 1 : 0), -1, 1);
    input.steer = SN.clamp((SN.keys.KeyD || SN.keys.ArrowRight ? 1 : 0) - (SN.keys.KeyA || SN.keys.ArrowLeft ? 1 : 0) + SN.touch.x, -1, 1);
    input.brake = !!(SN.keys.Space || SN.touch.brake);
    return input;
  };

  SN.carMotion = function carMotion(dt) {
    SN.player.motionSpeed = 0;
    const c = SN.player.car, input = SN.driveControls();
    if (SN.carjack) {
      SN.carjack.time -= dt;
      c.speed = c.vx = c.vz = 0;
      if (SN.carjack.time <= 0) { SN.carjack = null; SN.playerRoot.visible = !!c.spec.bike; }
      return;
    }
    const oldX = c.x, oldZ = c.z;
    SN.moveCar(c, dt, input.throttle, input.steer, input.brake);
    SN.updateVehicleRecovery(c, dt, Math.hypot(c.x - oldX, c.z - oldZ), input.throttle);
    SN.player.x = c.x;
    SN.player.z = c.z;
    SN.player.y = c.y;
    SN.player.yaw = c.yaw;
    if (SN.lookDelay <= 0 && !SN.keys.KeyX && !SN.touch.rear && Math.abs(c.speed) > 1.5)
      SN.camYaw = SN.approachAngle(SN.camYaw, c.yaw, dt * 2.4);
    if (c.health <= 0 && SN.impactCooldown <= 0) {
      SN.toast("车辆损坏 · F 下车寻找另一辆车", 3);
      SN.impactCooldown = 5;
    }
  };

  SN.updateVehicleRecovery = function updateVehicleRecovery(c, dt, moved, throttle) {
    const tilted = Math.abs(c.terrainRoll + c.roll) > 1.1 || Math.abs(c.pitch) > 1.1;
    const trapped = Math.abs(throttle) > 0.2 && moved < dt * 0.55 && !c.airborne;
    c.recoveryTime = tilted || trapped ? (c.recoveryTime || 0) + dt : 0;
    c.recoveryReady = c.recoveryTime >= 3;
  };

  SN.recoverVehicle = function recoverVehicle() {
    const c = SN.player.car;
    if (!SN.canControl() || !c || !c.recoveryReady || c.exploded) return false;
    if (c.spec.boat) {
      const home = c.riverHome;
      if (!home) { SN.toast("快艇附近没有可用泊位", 3); return true; }
      Object.assign(c, { x: home.x, z: home.z, yaw: home.yaw, speed: 0, vx: 0, vz: 0,
        steer: 0, roll: 0, stuck: 0, recoveryTime: 0, recoveryReady: false });
      c.y = SN.WATER_Y + 0.18;
      c.root.position.set(c.x, c.y, c.z);
      c.root.rotation.set(0, c.yaw, 0);
      Object.assign(SN.player, { x: c.x, z: c.z, y: c.y, yaw: c.yaw });
      SN.snapPlayer(); SN.snapCars(); SN.camYaw = c.yaw;
      SN.toast("已返回快艇泊位", 3);
      return true;
    }
    let best = null, distance = 90;
    for (const p of SN.roadSpawnPoints) {
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d >= distance || SN.carBlocked(p.x, p.z, p.yaw, c) || SN.carWater(p.x, p.z, p.yaw, c)) continue;
      if (SN.cars.some(o => o !== c && o.active && Math.hypot(o.x - p.x, o.z - p.z) < (o.spec.length + c.spec.length) / 2 + 2)) continue;
      best = p; distance = d;
    }
    if (!best) { SN.toast("附近车道被占用 · 请稍后复位", 3); return true; }
    Object.assign(c, { x: best.x, z: best.z, yaw: best.yaw, speed: 0, vx: 0, vz: 0, steer: 0, roll: 0,
      stuck: 0, recoveryTime: 0, recoveryReady: false });
    SN.resetVehicleGround(c); c.root.position.set(c.x, c.y, c.z); c.root.rotation.set(0, c.yaw, 0);
    Object.assign(SN.player, { x: c.x, z: c.z, y: c.y, yaw: c.yaw });
    SN.snapPlayer(); SN.snapCars(); SN.camYaw = c.yaw;
    SN.toast("已返回附近车道 · 车况与通缉保留", 3);
    return true;
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
    const goal = SN.nearestRoadNode(c.role === "police" && SN.wantedSearch === 1 ? SN.searchX : SN.player.x, c.role === "police" && SN.wantedSearch === 1 ? SN.searchZ : SN.player.z);
    if (c.navGoal !== goal || c.navNode < 0 || c.navNode === undefined) {
      c.navGoal = goal;
      c.navNode = SN.nearestRoadNode(c.x, c.z);
    }
    c.navTime = 2;
  };

  SN.trafficMotion = function trafficMotion(dt) {
    SN.updateSignals();
    for (const c of SN.cars) {
      if (!c.active || c === SN.player.car)
        continue;
      if (c.exploded) { c.speed = c.vx = c.vz = 0; continue; }
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
      c.panic = Math.max(0, (c.panic || 0) - dt);
      const aiDistance = Math.hypot(c.x - SN.player.x, c.z - SN.player.z);
      if (c.role === "traffic" && !c.missionTag && c.panic <= 0 && aiDistance > 80 && SN.simTime < (c.aiNext || 0)) {
        SN.moveCar(c, dt, c.aiThrottle || 0, c.aiSteer || 0);
        continue;
      }
      c.aiNext = SN.simTime + (aiDistance > 160 ? 0.1 : aiDistance > 80 ? 0.05 : 0);
      let tx, tz, wanted = c.cruise * (c.panic > 0 ? 1.45 : 1);
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
        if (node) {
          const dx = node.x - c.x, dz = node.z - c.z, length = Math.hypot(dx, dz) || 1;
          const road = SN.roadSample(c.x, c.z), lane = road ? road.profile.laneOffset : 1.6;
          tx -= dz / length * lane; tz += dx / length * lane;
        }
        if (distance < 65 && SN.visibleBetween(c.x, c.root.position.y + 1, c.z, SN.player.x, SN.player.y + 1, SN.player.z)) {
          const target = SN.player.car, slot = c.pursuitSlot || 0;
          const lead = target ? (slot % 2 ? -2 : SN.clamp(Math.abs(target.speed) * 0.8, 4, 18)) : 0;
          const side = target && distance < 25 ? (slot % 2 ? -1 : 1) * 2.5 : 0;
          const yaw = target ? target.yaw : SN.player.yaw;
          const x = SN.player.x + Math.sin(yaw) * lead + Math.cos(yaw) * side;
          const z = SN.player.z + Math.cos(yaw) * lead - Math.sin(yaw) * side;
          if (!SN.carBlocked(x, z, yaw, c) && !SN.carWater(x, z, yaw, c)) { tx = x; tz = z; }
        }
        wanted = SN.player.car ? SN.clamp(Math.abs(SN.player.car.speed) + (distance < 12 ? 2 : 6), 8, 30) : distance < 15 ? 7 : 22;
      }
      else if (c.cityTraffic) {
        let node = SN.roadNodes[c.navNode];
        if (!node) {
          c.navNode = SN.nearestRoadNode(c.x, c.z);
          node = SN.roadNodes[c.navNode];
        }
        if (!node) { c.parked = true; continue; }
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
        const from = SN.roadNodes[c.previousNode] || c;
        const dx = node.x - from.x, dz = node.z - from.z, len = Math.hypot(dx, dz) || 1;
        const lane = c.laneOffset === undefined ? 1.6 : c.laneOffset;
        tx = node.x - dz / len * lane;
        tz = node.z + dx / len * lane;
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
        tx = p[0] - dz / len * lane;
        tz = p[1] + dx / len * lane;
      }
      if (c.type === 8 && c.panic <= 0) {
        const weave = Math.sin(SN.simTime * 0.65 + c.serial) * 0.7;
        tx += Math.cos(c.yaw) * weave; tz -= Math.sin(c.yaw) * weave;
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
      if (c.role === "traffic") {
        const stop = SN.trafficStopDistance(c);
        if (c.panic <= 0) wanted = Math.min(wanted, Math.sqrt(Math.max(0, stop - 0.7) * 12));
        c.waitTime = wanted < 0.2 && stop === Infinity ? (c.waitTime || 0) + dt : 0;
        if (c.waitTime > 2.5) { SN.honk(c); c.waitTime = 0; }
        if (c.stuck > 1.2 && c.stuck < 3.5 && stop === Infinity) wanted = -3;
        if (c.stuck > 3.5) { c.stuck = 0; c.index = c.route ? (c.index + 1) % c.route.length : c.index; }
      }
      wanted = SN.cityTrafficSpeed(c, wanted, dt);
      wanted = Math.min(wanted, c.spec.topSpeed * 0.85);
      c.aiThrottle = SN.clamp((wanted - c.speed) * 0.5, -1, 1);
      c.aiSteer = SN.clamp(-turn * 1.9 + (c.panic > 0 ? Math.sin(SN.simTime * 3 + c.serial) * 0.18 : 0), -1, 1);
      SN.moveCar(c, dt, c.aiThrottle, c.aiSteer);
      if (c.occupant) {
        c.occupant.x = c.x;
        c.occupant.z = c.z;
      }
    }
  };
  // Startup phase 14: keep this order relative to the other systems.

  SN.registerInit(14, function initializeVehicles14() {
    SN.vehicleGroundResult = { y: 0, pitch: 0, roll: 0 };
    SN.tireMat = SN.mat(0x1b2124, { roughness: 0.98, metalness: 0.02 });
    SN.glassMat = SN.pbrMat("glass", 0x1b2831, { uvScale: 1.4, metalness: 0.55, roughness: 0.2, envMapIntensity: 1.05, normalStrength: 0.12 });
    SN.headMat = SN.mat(0xffefc6, { emissive: 0xffd595, emissiveIntensity: 0.8, roughness: 0.18 });
    SN.tailMat = SN.mat(0xb44b45, { emissive: 0xff4033, emissiveIntensity: 1.1, roughness: 0.24 });
    SN.chromeMat = SN.pbrMat("metal", 0xd2dadc, { uvScale: 1.1, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2 });
  });
  // ---------------------------------------------------------------------------
  // Procedural car shells. A real side silhouette is extruded across the width,
  // bevelled, welded and deformed with tumblehome and nose/tail taper. Wheel
  // arches are cut out of the silhouette instead of being painted on.
  // ---------------------------------------------------------------------------
  SN.vehicleWheelRadius = function vehicleWheelRadius(spec) {
    return spec.boat ? 0.2 : spec.bike ? 0.27 : spec.shape === "bus" ? 0.46 : spec.shape === "suv" || spec.shape === "pickup" || spec.shape === "redCrew" ? 0.4 : 0.33;
  };
  SN.vehicleSideProfile = function vehicleSideProfile(spec) {
    const L = spec.length, f = L / 2, H = spec.height, shape = spec.shape, points = [],
      add = (z, y) => points.push([z, y]);
    if (shape === "bus") {
      add(f, 0.42); add(f, 0.9); add(f * 0.998, 1.72); add(f * 0.975, H * 0.92); add(f * 0.9, H);
      add(-f * 0.94, H); add(-f * 0.985, H * 0.94); add(-f, 0.92); add(-f, 0.46);
    } else if (shape === "van") {
      add(f, 0.4); add(f, 0.82); add(f * 0.985, 1.35); add(f * 0.9, 1.9); add(f * 0.56, H * 0.94);
      add(f * 0.4, H); add(-f * 0.92, H); add(-f * 0.985, H * 0.9); add(-f, 0.84); add(-f, 0.44);
    } else if (shape === "pickup" || shape === "redCrew") {
      add(f, 0.36); add(f, 0.64); add(f * 0.98, 0.84); add(f * 0.66, 0.98); add(f * 0.38, 1.04);
      add(f * 0.3, H); add(-f * 0.12, H); add(-f * 0.24, 1.02); add(-f * 0.95, 0.99);
      add(-f, 0.9); add(-f, 0.4);
    } else if (shape === "suv") {
      add(f, 0.4); add(f, 0.68); add(f * 0.98, 0.9); add(f * 0.64, 1.06); add(f * 0.32, 1.12);
      add(f * 0.12, H); add(-f * 0.64, H); add(-f * 0.9, 1.12); add(-f, 1.02); add(-f, 0.44);
    } else if (shape === "hatch") {
      add(f, 0.36); add(f, 0.6); add(f * 0.97, 0.76); add(f * 0.5, 0.9); add(f * 0.24, 0.94);
      add(f * 0.04, H); add(-f * 0.52, H); add(-f * 0.86, 0.92); add(-f, 0.78); add(-f, 0.4);
    } else if (shape === "coupe" || shape === "silverCrew") {
      add(f, 0.32); add(f, 0.54); add(f * 0.97, 0.66); add(f * 0.6, 0.75); add(f * 0.34, 0.8);
      add(f * 0.06, H); add(-f * 0.3, H); add(-f * 0.52, 0.84); add(-f * 0.8, 0.7); add(-f, 0.6); add(-f, 0.34);
    } else {
      add(f, 0.34); add(f, 0.58); add(f * 0.985, 0.72); add(f * 0.62, 0.83); add(f * 0.32, 0.88);
      add(f * 0.1, H); add(-f * 0.24, H); add(-f * 0.46, 0.92); add(-f * 0.78, 0.8); add(-f, 0.7); add(-f, 0.36);
    }
    return points;
  };
  SN.vehicleWindowLayout = function vehicleWindowLayout(spec) {
    const L = spec.length, f = L / 2, H = spec.height, shape = spec.shape,
      tall = shape === "bus" || shape === "van", pickup = shape === "pickup" || shape === "redCrew",
      out = { front: 0, back: 0, bottom: H * 0.6, top: H - 0.06, screenBottom: [f * 0.32, 0.88], screenTop: [f * 0.1, H], rearBottom: [-f * 0.46, 0.92], rearTop: [-f * 0.24, H] };
    if (shape === "bus") Object.assign(out, { front: f * 0.92, back: -f * 0.9, bottom: H * 0.57, top: H - 0.26, screenBottom: [f * 0.99, 1.35], screenTop: [f * 0.94, H * 0.9], rearBottom: [-f * 0.95, 1.4], rearTop: [-f * 0.94, H * 0.84] });
    else if (shape === "van") Object.assign(out, { front: f * 0.62, back: f * 0.16, bottom: H * 0.6, top: H - 0.22, screenBottom: [f * 0.98, 1.4], screenTop: [f * 0.52, H * 0.94], rearBottom: [-f * 0.99, H * 0.58], rearTop: [-f * 0.99, H * 0.82] });
    else if (pickup) Object.assign(out, { front: f * 0.34, back: -f * 0.13, bottom: H * 0.58, top: H - 0.06, screenBottom: [f * 0.38, 1.04], screenTop: [f * 0.3, H], rearBottom: null });
    else if (shape === "suv") Object.assign(out, { front: f * 0.3, back: -f * 0.86, bottom: H * 0.6, top: H - 0.06, screenBottom: [f * 0.32, 1.12], screenTop: [f * 0.12, H], rearBottom: [-f * 0.9, 1.12], rearTop: [-f * 0.64, H] });
    else if (shape === "hatch") Object.assign(out, { front: f * 0.22, back: -f * 0.84, bottom: H * 0.6, top: H - 0.06, screenBottom: [f * 0.24, 0.94], screenTop: [f * 0.04, H], rearBottom: [-f * 0.86, 0.92], rearTop: [-f * 0.52, H] });
    else if (shape === "coupe" || shape === "silverCrew") Object.assign(out, { front: f * 0.26, back: -f * 0.44, bottom: H * 0.58, top: H - 0.05, screenBottom: [f * 0.34, 0.8], screenTop: [f * 0.06, H], rearBottom: [-f * 0.52, 0.84], rearTop: [-f * 0.3, H] });
    else Object.assign(out, { front: f * 0.28, back: -f * 0.44, bottom: H * 0.6, top: H - 0.06, screenBottom: [f * 0.3, 0.88], screenTop: [f * 0.1, H], rearBottom: [-f * 0.46, 0.92], rearTop: [-f * 0.24, H] });
    return out;
  };
  SN.sidePane = function sidePane(points, x, thickness = 0.016, warp = null) {
    const geometry = SN.extrudeOutline(points, thickness, 0, 3, 1);
    geometry.rotateY(-SN.PI / 2);
    geometry.translate(x, 0, 0);
    if (warp) {
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * warp(p.getY(i), p.getZ(i)));
    }
    return geometry;
  };
  // A curved pane that follows several stations of the side silhouette, so a
  // windscreen on a rounded nose stays outside the paint across its full height.
  SN.profilePane = function profilePane(stations, widthBottom, widthTop, offset = 0.04, thickness = 0.016) {
    const n = stations.length, front = [], inner = [], widths = [];
    for (let i = 0; i < n; i++) {
      const prev = stations[Math.max(0, i - 1)], next = stations[Math.min(n - 1, i + 1)];
      let dz = next[0] - prev[0], dy = next[1] - prev[1];
      if (!dz && !dy) dz = -1;
      const len = Math.hypot(dz, dy) || 1, ny = dy / len, nz = -dz / len;
      front.push([stations[i][0] + nz * offset, stations[i][1] + ny * offset]);
      inner.push([stations[i][0] + nz * (offset - thickness), stations[i][1] + ny * (offset - thickness)]);
      widths.push(widthBottom + (widthTop - widthBottom) * (i / (n - 1)));
    }
    // A rear screen rises toward the front, which mirrors its surface winding;
    // flip every quad so the outer face still points away from the body.
    const pos = [], flip = stations[n - 1][0] > stations[0][0],
      quad = (a, b, c, d) => {
        if (flip) pos.push(...d, ...c, ...b, ...d, ...b, ...a);
        else pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      },
      vertex = (x, layer, i) => [x, layer[i][1], layer[i][0]];
    for (let i = 0; i < n - 1; i++) {
      const w0 = widths[i] / 2, w1 = widths[i + 1] / 2;
      const f0L = vertex(-w0, front, i), f0R = vertex(w0, front, i), f1L = vertex(-w1, front, i + 1), f1R = vertex(w1, front, i + 1),
        b0L = vertex(-w0, inner, i), b0R = vertex(w0, inner, i), b1L = vertex(-w1, inner, i + 1), b1R = vertex(w1, inner, i + 1);
      quad(f0L, f0R, f1R, f1L);
      quad(b0L, b1L, b1R, b0R);
      quad(f0L, f1L, b1L, b0L);
      quad(f0R, b0R, b1R, f1R);
    }
    const cap = (i, flip) => {
      const w = widths[i] / 2;
      const L = vertex(-w, front, i), R = vertex(w, front, i), l = vertex(-w, inner, i), r = vertex(w, inner, i);
      if (flip) quad(L, l, r, R); else quad(L, R, r, l);
    };
    cap(0, false); cap(n - 1, true);
    const geometry = new SN.T.BufferGeometry();
    geometry.setAttribute("position", new SN.T.Float32BufferAttribute(pos, 3));
    geometry.computeVertexNormals();
    return geometry;
  };
  SN.frontPane = function frontPane(points, widthBottom, widthTop, offset = 0, sign = 1) {
    const zBottom = points[0], yBottom = points[1], zTop = points[2], yTop = points[3],
      dz = zTop - zBottom, dy = yTop - yBottom, length = Math.hypot(dz, dy) * 0.94,
      angle = Math.atan2(dz, dy),
      geometry = SN.extrudeOutline([[-widthBottom / 2, -length / 2], [widthBottom / 2, -length / 2], [widthTop / 2, length / 2], [-widthTop / 2, length / 2]], 0.02, 0, 3, 1);
    geometry.rotateX(angle);
    geometry.translate(0, (yBottom + yTop) / 2 - Math.sin(angle) * offset * sign, (zBottom + zTop) / 2 + Math.cos(angle) * offset * sign);
    return geometry;
  };
  SN.buildBoatGeometry = function buildBoatGeometry(spec) {
    const L = spec.length, W = spec.width, f = L / 2,
      body = [], glass = [], trim = [], chrome = [], accent = [], red = [], blue = [], head = [], tail = [], plate = [];
    // Hull silhouette: raked bow, rising sheer and a shallow chine. Extruded
    // across the beam, then tapered to a point and rounded toward the keel.
    const hull = SN.extrudeOutline([
      [-f, 0.32], [-f + 0.2, 0.7], [-f * 0.55, 0.78], [0, 0.82], [f * 0.55, 0.9], [f * 0.86, 1.02], [f, 1.14],
      [f - 0.18, 0.58], [f * 0.72, 0.3], [f * 0.32, 0.14], [-f * 0.5, 0.12], [-f + 0.12, 0.2]
    ], W * 0.94, 0.04, 4, 2);
    hull.rotateY(-SN.PI / 2);
    const position = hull.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i), z = position.getZ(i), bow = SN.clamp((z / f - 0.24) / 0.76, 0, 1);
      let scale = 1 - 0.88 * Math.pow(bow, 1.15);
      if (y < 0.42) scale *= 0.7 + 0.3 * (y / 0.42);
      position.setX(i, position.getX(i) * scale);
    }
    hull.computeVertexNormals();
    body.push({ g: SN.weldGeometry(hull, 0.0006, true) });
    // Side decks, bow and stern decks leave a dark cockpit well in the middle.
    for (const side of [-1, 1]) {
      trim.push({ g: SN.roundedBox(W * 0.2, 0.05, L * 0.6, 0.02, 2), x: side * W * 0.33, y: 0.92, z: -f * 0.1 });
      chrome.push({ g: SN.cylinder, x: side * W * 0.42, y: 1.16, z: -f * 0.12, sx: 0.018, sy: L * 0.55, sz: 0.018, rx: SN.PI / 2 });
      for (const z of [-f * 0.62, -f * 0.12, f * 0.38])
        chrome.push({ g: SN.cylinder, x: side * W * 0.42, y: 1.04, z, sx: 0.015, sy: 0.24, sz: 0.015 });
    }
    body.push({ g: SN.roundedBox(W * 0.5, 0.05, L * 0.3, 0.02, 2), x: 0, y: 0.94, z: f * 0.52 });
    body.push({ g: SN.roundedBox(W * 0.66, 0.05, L * 0.18, 0.02, 2), x: 0, y: 0.9, z: -f * 0.8 });
    trim.push({ g: SN.roundedBox(W * 0.52, 0.08, L * 0.48, 0.03, 2), x: 0, y: 0.9, z: -f * 0.12 });
    // Console, wheel, two front seats and a rear bench.
    body.push({ g: SN.roundedBox(0.62, 0.34, 0.48, 0.05, 2), x: 0, y: 1.02, z: 0.28 });
    trim.push({ g: SN.roundedBox(0.5, 0.06, 0.34, 0.02, 2), x: 0, y: 1.2, z: 0.3 });
    chrome.push({ g: new SN.T.TorusGeometry(0.16, 0.02, 4, 12), x: 0, y: 1.16, z: 0.08, rx: -0.5 });
    for (const side of [-1, 1]) {
      accent.push({ g: SN.roundedBox(0.5, 0.3, 0.46, 0.06, 2), x: side * W * 0.2, y: 1.02, z: -f * 0.24 });
      accent.push({ g: SN.roundedBox(0.5, 0.4, 0.1, 0.04, 2), x: side * W * 0.2, y: 1.18, z: -f * 0.36 });
      accent.push({ g: SN.roundedBox(0.5, 0.03, 0.36, 0.01, 2), x: side * W * 0.2, y: 1.18, z: -f * 0.2 });
    }
    accent.push({ g: SN.roundedBox(W * 0.52, 0.3, 0.42, 0.05, 2), x: 0, y: 1.0, z: -f * 0.66 });
    accent.push({ g: SN.roundedBox(W * 0.52, 0.4, 0.1, 0.04, 2), x: 0, y: 1.18, z: -f * 0.76 });
    // Raked windscreen with a chrome frame.
    glass.push({ g: SN.roundedBox(W * 0.5, 0.34, 0.03, 0.02, 2), x: 0, y: 1.36, z: 0.56, rx: -0.5 });
    for (const side of [-1, 1])
      chrome.push({ g: SN.cylinder, x: side * W * 0.25, y: 1.36, z: 0.56, sx: 0.018, sy: 0.44, sz: 0.018, rx: -0.5 });
    chrome.push({ g: SN.cylinder, x: 0, y: 1.5, z: 0.48, sx: 0.016, sy: W * 0.5, sz: 0.016, rz: SN.PI / 2 });
    // Outboard motor and cavitation plate.
    trim.push({ g: SN.roundedBox(0.44, 0.62, 0.34, 0.06, 2), x: 0, y: 0.98, z: -f - 0.06 });
    trim.push({ g: SN.cylinder, x: 0, y: 0.5, z: -f - 0.02, sx: 0.07, sy: 0.9, sz: 0.07 });
    trim.push({ g: SN.roundedBox(0.16, 0.05, 0.4, 0.02, 1), x: 0, y: 0.2, z: -f - 0.02 });
    chrome.push({ g: SN.cylinder, x: 0, y: 0.16, z: -f - 0.2, sx: 0.13, sy: 0.03, sz: 0.13, rx: SN.PI / 2 });
    // Livery stripe follows the hull taper.
    for (const side of [-1, 1])
      for (const zc of [-f * 0.55, -f * 0.1, f * 0.35]) {
        const bow = SN.clamp((zc / f - 0.24) / 0.76, 0, 1), half = W * 0.46 * (1 - 0.88 * Math.pow(bow, 1.15));
        accent.push({ g: SN.roundedBox(0.035, 0.07, L * 0.42, 0.01, 1), x: side * (half + 0.012), y: 0.62, z: zc });
      }
    // Bow light, stern light and port/starboard navigation lamps.
    head.push({ g: SN.roundedBox(0.12, 0.08, 0.06, 0.02, 1), x: 0, y: 0.92, z: f * 0.48 });
    tail.push({ g: SN.roundedBox(0.16, 0.08, 0.05, 0.02, 1), x: 0, y: 0.96, z: -f - 0.24 });
    for (const side of [-1, 1])
      (side < 0 ? red : blue).push({ g: SN.roundedBox(0.08, 0.08, 0.06, 0.02, 1), x: side * W * 0.42, y: 0.94, z: f * 0.18 });
    plate.push({ g: new SN.T.PlaneGeometry(0.45, 0.1), x: 0, y: 0.74, z: -f - 0.3, ry: SN.PI });
    return {
      body: SN.merged(body), glass: SN.merged(glass), trim: SN.merged(trim), chrome: SN.merged(chrome),
      accent: SN.merged(accent), red: SN.merged(red), blue: SN.merged(blue),
      head: SN.merged(head), tail: SN.merged(tail), plate: SN.merged(plate)
    };
  };
  SN.buildVehicleGeometry = function buildVehicleGeometry(spec) {
    if (spec.bike) return SN.buildScooterGeometry(spec);
    if (spec.boat) return SN.buildBoatGeometry(spec);
    const L = spec.length, W = spec.width, H = spec.height, f = L / 2, shape = spec.shape,
      wheel = SN.vehicleWheelRadius(spec), belt = H * 0.55, tall = shape === "bus" || shape === "van",
      pickup = shape === "pickup" || shape === "redCrew",
      tumble = tall ? 0.09 : 0.2, bodyHalf = W * 0.48,
      tumbleAt = y => 1 - tumble * SN.clamp((y - belt) / Math.max(0.05, H - belt), 0, 1),
      sideXAt = y => bodyHalf * tumbleAt(y) + 0.009,
      body = [], glass = [], trim = [], chrome = [], accent = [], red = [], blue = [], head = [], tail = [], plate = [],
      profile = SN.vehicleSideProfile(spec), archR = wheel + 0.13,
      archH = Math.max(0.34, wheel * 2 - 0.3 + 0.08), wheelZ = L * 0.32;
    // Height of the silhouette at any station, so glass stays tucked under the roof
    // and C-pillars instead of floating above a sloping rear deck.
    const topAt = z => {
      let best = -Infinity;
      for (let i = 0; i < profile.length - 1; i++) {
        const a = profile[i], b = profile[i + 1];
        if ((z - a[0]) * (z - b[0]) <= 0 && a[0] !== b[0])
          best = Math.max(best, a[1] + (b[1] - a[1]) * ((z - a[0]) / (b[0] - a[0])));
      }
      return Number.isFinite(best) ? best : H;
    };
    // The shell is tapered toward the nose and tail, so details placed at the
    // extreme ends need the same width reduction the body vertices receive.
    const taperAt = z => {
      const za = Math.abs(z) / f;
      return za > 0.7 ? 1 - 0.18 * Math.pow((za - 0.7) / 0.3, 1.5) : 1;
    };
    const frontAt = y => {
      for (let i = 0; i < profile.length - 1; i++) {
        const a = profile[i], b = profile[i + 1];
        if (a[0] > 0 && b[0] > 0 && a[1] !== b[1] && (y - a[1]) * (y - b[1]) <= 0)
          return a[0] + (b[0] - a[0]) * ((y - a[1]) / (b[1] - a[1]));
      }
      return f;
    };
    const rearAt = y => {
      let best = -Infinity;
      for (let i = 0; i < profile.length - 1; i++) {
        const a = profile[i], b = profile[i + 1];
        if (a[0] < 0 && b[0] < 0 && a[1] !== b[1] && (y - a[1]) * (y - b[1]) <= 0)
          best = Math.max(best, a[0] + (b[0] - a[0]) * ((y - a[1]) / (b[1] - a[1])));
      }
      return Number.isFinite(best) ? best : -f;
    };
    const arch = zc => {
      const out = [];
      for (let i = 1; i < 7; i++) {
        const a = SN.PI - i * SN.PI / 7;
        out.push([zc + Math.cos(a) * archR, 0.3 + Math.sin(a) * archH]);
      }
      return out;
    };
    // Long livery bands are split so each piece follows the tail taper instead
    // of hovering beside the narrower ends of the shell.
    const sideStrip = (list, y, height, length, off = 0.006, center = 0) => {
      const half = length / 2, segs = 6, span = length / segs;
      for (const side of [-1, 1])
        for (let i = 0; i < segs; i++) {
          const zc = center - half + span * (i + 0.5);
          list.push({ g: SN.roundedBox(0.024, height, span - 0.003, 0.01, 1), x: side * (bodyHalf * taperAt(zc) + off), y, z: zc });
        }
    };
    const outline = profile.slice();
    outline.push([-f + 0.03, 0.3], [-wheelZ - archR, 0.3]);
    for (const p of arch(-wheelZ)) outline.push(p);
    outline.push([-wheelZ + archR, 0.3], [wheelZ - archR, 0.3]);
    for (const p of arch(wheelZ)) outline.push(p);
    outline.push([wheelZ + archR, 0.3], [f - 0.03, 0.3]);
    const shell = SN.extrudeOutline(outline, W * 0.96, 0.032, 4, 2);
    shell.rotateY(-SN.PI / 2);
    const position = shell.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i), z = position.getZ(i), za = Math.abs(z) / f;
      let scale = 1;
      if (za > 0.7) scale *= 1 - 0.18 * Math.pow((za - 0.7) / 0.3, 1.5);
      if (y > belt) scale *= tumbleAt(y);
      if (y < 0.42) scale *= 0.98;
      position.setX(i, position.getX(i) * scale);
    }
    shell.computeVertexNormals();
    const bodyShell = SN.weldGeometry(shell, 0.0006, true);
    body.push({ g: bodyShell });
    // Mirrors: a painted pod and a dark glass face on each side.
    for (const side of [-1, 1]) {
      const mx = side * bodyHalf * tumbleAt(H * 0.63) * 0.99, my = H * 0.63, mz = f * 0.23;
      body.push({ g: SN.vehicleMirror, x: mx, y: my, z: mz, sx: 0.072, sy: 0.05, sz: 0.1 });
      body.push({ g: SN.vehicleMirror, x: mx - side * 0.045, y: my - 0.03, z: mz - 0.02, sx: 0.045, sy: 0.03, sz: 0.045 });
      glass.push({ g: SN.box, x: mx, y: my, z: mz - 0.098, sx: 0.05, sy: 0.03, sz: 0.008 });
    }
    // Windows: two panes per side (one for a van cab, six for a bus), plus screens.
    const win = SN.vehicleWindowLayout(spec);
    const addSidePanes = (front, back, bottom, top, slant) => {
      if (back >= front) return;
      const mid = (front + back) / 2, gap = Math.min(0.05, (front - back) * 0.04),
        y = (bottom + top) / 2, x = sideXAt(y),
        warp = (py, pz) => (tumbleAt(py) / tumbleAt(y)) * taperAt(pz),
        roof = z => Math.max(bottom + 0.05, Math.min(top, topAt(z) - 0.035)),
        split = front - back > 0.95;
      for (const side of [-1, 1]) {
        if (!split) {
          glass.push({ g: SN.sidePane([[front, bottom], [back, bottom], [back, roof(back)], [front - slant, roof(front - slant)]], side * x, 0.016, warp) });
          continue;
        }
        const aBack = mid + gap, bFront = mid - gap;
        glass.push({ g: SN.sidePane([[front, bottom], [aBack, bottom], [aBack, roof(aBack)], [front - slant, roof(front - slant)]], side * x, 0.016, warp) });
        glass.push({ g: SN.sidePane([[bFront, bottom], [back, bottom], [back, roof(back)], [bFront, roof(bFront)]], side * x, 0.016, warp) });
      }
    };
    if (shape === "bus") {
      const count = 6, span = (win.front - win.back) / count,
        wy = (win.bottom + win.top) / 2,
        warp = (py, pz) => (tumbleAt(py) / tumbleAt(wy)) * taperAt(pz);
      for (const side of [-1, 1])
        for (let i = 0; i < count; i++)
          glass.push({ g: SN.sidePane([[win.front - i * span - 0.045, win.bottom], [win.front - (i + 1) * span + 0.045, win.bottom], [win.front - (i + 1) * span + 0.045, win.top], [win.front - i * span - 0.045, win.top]], side * sideXAt(wy), 0.016, warp) });
      trim.push({ g: SN.roundedBox(W * 0.03, H * 0.72, 0.06, 0.02, 1), x: sideXAt(1.2), y: H * 0.45, z: win.front * 0.94 });
      trim.push({ g: SN.roundedBox(W * 0.03, H * 0.72, 0.06, 0.02, 1), x: -sideXAt(1.2), y: H * 0.45, z: win.front * 0.94 });
    }
    else addSidePanes(win.front, win.back, win.bottom, win.top, shape === "van" ? 0.35 : shape === "coupe" || shape === "silverCrew" || pickup ? 0.3 : shape === "suv" ? 0.4 : shape === "hatch" ? 0.36 : 0.36);
    const screenPane = (bottom, top, wb, wt, edge) => {
      const stations = [];
      for (let i = 0; i <= 4; i++) {
        const y = bottom[1] + (top[1] - bottom[1]) * i / 4;
        stations.push([edge(y), y]);
      }
      return SN.profilePane(stations, wb, wt, 0.04);
    };
    if (win.screenBottom) {
      const wb = shape === "bus" ? W * 0.74 : shape === "van" ? W * 0.78 : W * 0.78,
        wt = shape === "bus" ? W * 0.7 : shape === "van" ? W * 0.8 : W * 0.68;
      glass.push({ g: screenPane(win.screenBottom, win.screenTop, wb, wt, frontAt) });
    }
    if (win.rearBottom && win.rearTop)
      glass.push({ g: screenPane(win.rearBottom, win.rearTop, W * 0.7, W * 0.6, rearAt) });
    // Bumpers, sills, door seams, arch liners and arch lips. Front and rear
    // fittings stand a few centimetres proud of the beveled shell so no detail
    // is swallowed by the paint surface.
    for (const end of [-1, 1]) {
      trim.push({ g: SN.roundedBox(W * 0.74, tall ? 0.3 : 0.2, 0.1, 0.035, 2), x: 0, y: tall ? 0.5 : 0.4, z: end * (f + 0.015) });
      trim.push({ g: SN.roundedBox(W * 0.6, 0.08, 0.05, 0.02, 2), x: 0, y: 0.34, z: end * (f + 0.025) });
      trim.push({ g: SN.roundedBox(W * 0.94, 0.62, archR * 1.7, 0.04, 2), x: 0, y: wheel + 0.17, z: end * wheelZ });
    }
    for (const side of [-1, 1]) {
      trim.push({ g: SN.roundedBox(0.05, tall ? 0.16 : 0.1, L * 0.3, 0.02, 2), x: side * (bodyHalf - 0.005), y: 0.32, z: 0 });
      for (const z of [win.back, (win.front + win.back) / 2, win.front + (shape === "bus" ? 0 : 0.02)])
        trim.push({ g: SN.roundedBox(0.012, belt - 0.36, 0.014, 0.004, 1), x: side * (bodyHalf * taperAt(z) + 0.006), y: (belt + 0.36) / 2, z });
      for (const zc of [-wheelZ, wheelZ])
        trim.push({
          g: new SN.T.TorusGeometry(archR * 0.99, 0.026, 3, 6, SN.PI), x: side * (bodyHalf - 0.012),
          y: 0.3, z: zc, ry: SN.PI / 2, sx: 1, sy: (archH + 0.02) / archR, sz: 1
        });
      for (const z of [win.back + 0.14, win.back + 0.2])
        chrome.push({ g: SN.roundedBox(0.05, 0.022, 0.12, 0.01, 1), x: side * (bodyHalf * taperAt(z) + 0.012), y: belt - 0.06, z });
    }
    // Grille, head and tail clusters placed on the local nose/tail surface.
    const grilleZ = frontAt(0.63) + 0.025;
    trim.push({ g: SN.roundedBox(W * 0.36, 0.17, 0.04, 0.02, 2), x: 0, y: 0.63, z: grilleZ });
    for (let i = 0; i < 3; i++)
      chrome.push({ g: SN.roundedBox(W * 0.32, 0.014, 0.02, 0.006, 1), x: 0, y: 0.59 + i * 0.045, z: grilleZ + 0.03 });
    const lightY = shape === "bus" ? 0.78 : tall ? 0.74 : shape === "suv" ? 0.62 : shape === "pickup" || shape === "redCrew" ? 0.58 : shape === "coupe" || shape === "silverCrew" ? 0.47 : shape === "hatch" ? 0.55 : 0.66,
      lightH = shape === "bus" ? 0.14 : tall ? 0.12 : 0.09,
      tailY = shape === "suv" ? 0.86 : shape === "coupe" || shape === "silverCrew" ? 0.5 : tall ? shape === "van" ? 0.68 : 0.7 : shape === "pickup" || shape === "redCrew" ? 0.68 : 0.66,
      tailH = tall || shape === "suv" || pickup ? 0.14 : 0.11;
    for (const side of [-1, 1]) {
      head.push({ g: SN.roundedBox(W * 0.18, lightH, 0.05, 0.035, 2), x: side * W * 0.28, y: lightY, z: frontAt(lightY) + 0.035 });
      head.push({ g: SN.roundedBox(W * 0.06, 0.06, 0.03, 0.02, 1), x: side * W * 0.34, y: lightY - 0.14, z: frontAt(lightY - 0.14) + 0.035 });
      tail.push({ g: SN.roundedBox(W * 0.18, tailH, 0.05, 0.035, 2), x: side * W * 0.24, y: tailY, z: rearAt(tailY) - 0.035 });
      chrome.push({ g: SN.cylinder, x: side * W * 0.26, y: 0.34, z: rearAt(0.34) - 0.015, sx: 0.032, sy: 0.14, sz: 0.032, rx: SN.PI / 2 });
    }
    // Wipers sit at the base of the windscreen.
    {
      const z0 = win.screenBottom[0], y0 = win.screenBottom[1],
        wdz = win.screenTop[0] - z0, wdy = win.screenTop[1] - y0,
        wlen = Math.max(0.001, Math.hypot(wdz, wdy)),
        wny = (-wdz / wlen), wnz = (wdy / wlen) * (wdz > 0 ? -1 : 1);
      for (const side of [-1, 1])
        trim.push({ g: SN.cylinder, x: side * W * 0.14, y: y0 + wny * 0.055, z: z0 + wnz * 0.055, sx: 0.007, sy: 0.34, sz: 0.007, rz: SN.PI / 2 + side * 0.12 });
    }
    // Plates front and rear.
    const plateGeometry = new SN.T.PlaneGeometry(0.5, 0.115);
    plate.push({ g: plateGeometry, x: 0, y: 0.48, z: f + 0.078 });
    plate.push({ g: plateGeometry, x: 0, y: tall ? 0.53 : 0.45, z: -f - 0.078, ry: SN.PI });
    // Shape-specific accessories and liveries.
    if (shape === "taxi") {
      accent.push({ g: SN.roundedBox(0.52, 0.18, 0.3, 0.03, 2), x: 0, y: H + 0.1, z: -0.12 });
      sideStrip(accent, 0.78, 0.13, L * 0.72, 0.005);
    }
    if (shape === "police") {
      trim.push({ g: SN.roundedBox(1.05, 0.07, 0.24, 0.02, 2), x: 0, y: H + 0.04, z: -0.12 });
      red.push({ g: SN.roundedBox(0.5, 0.09, 0.2, 0.025, 2), x: -0.26, y: H + 0.11, z: -0.12 });
      blue.push({ g: SN.roundedBox(0.5, 0.09, 0.2, 0.025, 2), x: 0.26, y: H + 0.11, z: -0.12 });
      sideStrip(accent, 0.72, 0.2, L * 0.74);
    }
    if (shape === "silverCrew" || shape === "coupe") {
      const deck = topAt(-f * 0.5);
      accent.push({ g: SN.roundedBox(W * 0.86, 0.05, 0.22, 0.02, 2), x: 0, y: deck + 0.2, z: -f * 0.5 });
      for (const side of [-1, 1])
        trim.push({ g: SN.roundedBox(0.05, 0.2, 0.08, 0.02, 1), x: side * W * 0.36, y: deck + 0.08, z: -f * 0.5 });
    }
    if (shape === "redCrew") {
      trim.push({ g: SN.roundedBox(W * 0.9, 0.08, 0.1, 0.03, 2), x: 0, y: 0.36, z: f + 0.045 });
      sideStrip(trim, 1.0, 0.1, L * 0.8, 0.005, -f * 0.05);
      accent.push({ g: SN.roundedBox(W * 0.8, 0.07, 0.18, 0.02, 2), x: 0, y: H + 0.02, z: -f * 0.24 });
    }
    if (pickup) {
      trim.push({ g: SN.roundedBox(W * 0.78, 0.04, L * 0.62, 0.02, 2), x: 0, y: 1.0, z: -f * 0.62 });
      for (const side of [-1, 1])
        body.push({ g: SN.roundedBox(0.07, 0.2, L * 0.62, 0.03, 2), x: side * bodyHalf * 0.94, y: 1.06, z: -f * 0.62 });
    }
    if (shape === "bus") {
      head.push({ g: SN.roundedBox(W * 0.5, 0.18, 0.025, 0.02, 2), x: 0, y: H * 0.94, z: frontAt(H * 0.94) + 0.03 });
      trim.push({ g: SN.roundedBox(W * 0.7, 0.18, L * 0.3, 0.06, 2), x: 0, y: H + 0.09, z: -L * 0.12 });
      sideStrip(accent, 0.95, 0.24, L * 0.88);
    }
    if (spec.name.includes("消防"))
      for (const side of [-1, 1]) {
        trim.push({ g: SN.roundedBox(0.06, 0.06, L * 0.34, 0.02, 1), x: side * W * 0.3, y: H + 0.12, z: -L * 0.08 });
        for (let i = 0; i < 6; i++)
          trim.push({ g: SN.roundedBox(W * 0.6, 0.045, 0.05, 0.012, 1), x: 0, y: H + 0.12, z: -L * 0.08 + (i - 2.5) * L * 0.05 });
      }
    if (spec.emergency) {
      trim.push({ g: SN.roundedBox(1.1, 0.07, 0.22, 0.02, 2), x: 0, y: H + 0.04, z: 0.5 });
      red.push({ g: SN.roundedBox(0.48, 0.09, 0.18, 0.025, 2), x: -0.27, y: H + 0.11, z: 0.5 });
      blue.push({ g: SN.roundedBox(0.48, 0.09, 0.18, 0.025, 2), x: 0.27, y: H + 0.11, z: 0.5 });
      sideStrip(accent, 0.98, 0.22, L * 0.72);
    }
    const weldedBody = SN.merged(body);
    // Snow/rubber sills: a darker lower band also hides the seam where the body
    // meets the wheel-arch cut-outs.
    return {
      body: weldedBody,
      glass: SN.merged(glass),
      trim: SN.merged(trim),
      chrome: SN.merged(chrome),
      accent: accent.length ? SN.merged(accent) : null,
      red: red.length ? SN.merged(red) : null,
      blue: blue.length ? SN.merged(blue) : null,
      head: SN.merged(head),
      tail: SN.merged(tail),
      plate: SN.merged(plate)
    };
  };
  SN.buildScooterGeometry = function buildScooterGeometry(spec) {
    const body = [], trim = [], chrome = [], glass = [], head = [], tail = [], accent = [];
    const sphere = SN.vehicleSphere;
    body.push({ g: SN.roundedBox(0.4, 0.1, 1.18, 0.05, 3), x: 0, y: 0.34, z: 0 });
    body.push({ g: SN.roundedBox(0.42, 0.3, 0.72, 0.07, 3), x: 0, y: 0.55, z: -0.3 });
    body.push({ g: SN.roundedBox(0.38, 0.46, 0.2, 0.06, 3), x: 0, y: 0.66, z: 0.52, rx: -0.18 });
    body.push({ g: SN.roundedBox(0.36, 0.1, 0.54, 0.05, 3), x: 0, y: 0.76, z: -0.32 });
    body.push({ g: SN.roundedBox(0.44, 0.42, 0.5, 0.06, 3), x: 0, y: 1.0, z: -0.66 });
    accent.push({ g: SN.roundedBox(0.3, 0.01, 0.02, 0.005, 1), x: 0, y: 1.0, z: -0.915 });
    for (const side of [-1, 1]) {
      chrome.push({ g: SN.cylinder, x: side * 0.16, y: 0.72, z: 0.66, sx: 0.025, sy: 0.62, sz: 0.025, rx: -0.22 });
      chrome.push({ g: SN.cylinder, x: side * 0.2, y: 1.0, z: 0.6, sx: 0.02, sy: 0.18, sz: 0.02, rz: SN.PI / 2 });
      trim.push({ g: sphere, x: side * 0.2, y: 1.01, z: 0.63, sx: 0.03, sy: 0.03, sz: 0.03 });
      trim.push({ g: sphere, x: side * 0.2, y: 1.02, z: 0.36, sx: 0.028, sy: 0.028, sz: 0.028 });
    }
    chrome.push({ g: SN.cylinder, x: 0, y: 1.02, z: 0.62, sx: 0.018, sy: 0.5, sz: 0.018, rz: SN.PI / 2 });
    trim.push({ g: SN.roundedBox(0.44, 0.06, 0.42, 0.02, 2), x: 0, y: 0.89, z: 0.58, rx: -0.18 });
    glass.push({ g: SN.roundedBox(0.32, 0.3, 0.02, 0.03, 2), x: 0, y: 1.02, z: 0.6, rx: -0.16 });
    head.push({ g: sphere, x: 0, y: 0.82, z: 0.73, sx: 0.075, sy: 0.065, sz: 0.05 });
    head.push({ g: sphere, x: 0, y: 0.97, z: 0.66, sx: 0.05, sy: 0.04, sz: 0.04 });
    tail.push({ g: SN.roundedBox(0.2, 0.07, 0.03, 0.02, 2), x: 0, y: 0.6, z: -0.95 });
    for (const end of [-1, 1]) {
      trim.push({ g: SN.cylinder, x: 0, y: 0.4, z: end * 0.72, sx: 0.03, sy: 0.55, sz: 0.03, rz: SN.PI / 2 });
      trim.push({ g: sphere, x: 0, y: 0.36, z: end * 0.74, sx: 0.1, sy: 0.1, sz: 0.04 });
      trim.push({ g: new SN.T.TorusGeometry(0.29, 0.04, 3, 7, SN.PI), x: 0, y: SN.vehicleWheelRadius(spec), z: end * spec.length * 0.36, ry: SN.PI / 2 });
    }
    for (const side of [-1, 1]) {
      chrome.push({ g: SN.cylinder, x: side * 0.255, y: 1.12, z: 0.6, sx: 0.012, sy: 0.2, sz: 0.012, rz: side * 0.32 });
      trim.push({ g: SN.vehicleMirror, x: side * 0.29, y: 1.21, z: 0.6, sx: 0.055, sy: 0.04, sz: 0.05 });
    }
    return {
      body: SN.merged(body), glass: SN.merged(glass), trim: SN.merged(trim), chrome: SN.merged(chrome),
      accent: SN.merged(accent), red: null, blue: null, head: SN.merged(head), tail: SN.merged(tail), plate: null
    };
  };
  SN.buildPlateTexture = function buildPlateTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const g = canvas.getContext("2d");
    g.fillStyle = "#eef0e6"; g.fillRect(0, 0, 256, 64);
    g.strokeStyle = "#2c3238"; g.lineWidth = 5; g.strokeRect(3, 3, 250, 58);
    g.fillStyle = "#2b7d55"; g.fillRect(10, 12, 40, 40);
    g.fillStyle = "#f4f6ec";
    g.font = "bold 22px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("서울", 30, 33);
    g.fillStyle = "#1b2024"; g.font = "bold 34px sans-serif"; g.textAlign = "left";
    g.fillText("24가 3187", 60, 35);
    return SN.canvasTexture(canvas);
  };
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
        height: 1.3,
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
    SN.vehicleSphere = new SN.T.SphereGeometry(1, 10, 7);
    SN.vehicleMirror = new SN.T.SphereGeometry(1, 7, 5);
    SN.wheelGeo = SN.latheProfile([
      [0.19, -0.105], [0.27, -0.118], [0.315, -0.1], [0.33, -0.065],
      [0.33, 0.065], [0.315, 0.1], [0.27, 0.118], [0.19, 0.105]
    ], 20);
    SN.wheelGeo.rotateZ(SN.PI / 2);
    const rimParts = [{ g: new SN.T.CylinderGeometry(0.09, 0.09, 0.15, 12), rz: SN.PI / 2 }];
    for (let i = 0; i < 5; i++) {
      const angle = i * SN.PI * 2 / 5;
      rimParts.push({ g: SN.box, x: 0, y: Math.sin(angle) * 0.11, z: Math.cos(angle) * 0.11, sx: 0.17, sy: 0.028, sz: 0.185, rx: angle });
    }
    rimParts.push({ g: new SN.T.CylinderGeometry(0.055, 0.055, 0.19, 10), rz: SN.PI / 2 });
    rimParts.push({ g: new SN.T.TorusGeometry(0.205, 0.016, 4, 16), ry: SN.PI / 2 });
    SN.rimGeo = SN.merged(rimParts);
    SN.brakeGeo = new SN.T.CylinderGeometry(0.17, 0.17, 0.022, 14);
    SN.brakeGeo.rotateZ(SN.PI / 2);
    SN.vehicleSpecs.push(
      { ...SN.vehicleSpecs[5], name: "特警厢车", emergency: true, topSpeed: 34, accel: 12, mass: 4.2, damage: 0.4 },
      { ...SN.vehicleSpecs[4], name: "装甲支援车", emergency: true, topSpeed: 30, accel: 10, mass: 6.2, damage: 0.24 },
      { ...SN.vehicleSpecs[5], name: "119 · 救护车", emergency: true, topSpeed: 35, cruise: 17 },
      { ...SN.vehicleSpecs[5], name: "119 · 消防车", emergency: true, length: 6.6, height: 2.8, mass: 5.2, cruise: 14 },
      { name: "汉江 · 快艇", shape: "boat", length: 6.2, width: 2.3, height: 1.72,
        topSpeed: 27, accel: 9.6, mass: 1.6, grip: 6.4, damage: 0.8, pitch: 44, cruise: 0, boat: true }
    );
    SN.vehicleGeometry = SN.vehicleSpecs.map(spec => SN.buildVehicleGeometry(spec));
    SN.carColors = [0xd82b32, 0x1761cf, 0xffa51e, 0x242d3c, 0x16814e, 0x9daebe, 0x854bbd, 0x13a7ab, 0xf16026, 0xb82558, 0xf4ce39, 0xdbe1e5];
    SN.cars = [];
    SN.carPaintSurface = SN.getSurface("carPaint");
    SN.vehicleAccentMats = [
      SN.mat(0xd8c49a, { roughness: 0.5, envMapIntensity: 0.9 }),
      SN.mat(0x8fc4bd, { roughness: 0.5 }),
      SN.mat(0xd8ae72, { roughness: 0.5 }),
      SN.mat(0x3a6f96, { roughness: 0.45, metalness: 0.2 })
    ];
    SN.plateMat = SN.mat(0xffffff, { map: SN.buildPlateTexture(), roughness: 0.55, metalness: 0.05 });
    SN.brakeMat = SN.mat(0x5b6064, { roughness: 0.52, metalness: 0.7 });
    SN.redLensMat = new SN.T.MeshBasicMaterial({ color: 0xff3b30 });
    SN.blueLensMat = new SN.T.MeshBasicMaterial({ color: 0x2f7bff });
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
    for (const [i, spot] of SN.lookParking.slice(0, 12).entries())
      SN.makeCar(spot.x, spot.z, spot.yaw, true, null, 0, [0, 1, 2, 4, 7][i % 5]);
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
    SN.spawnRiverBoats();
    SN.spawnAmbientBoats();
  });
  SN.riverBoats = [];
  SN.riverDocks = [];
  SN.spawnRiverBoats = function spawnRiverBoats() {
    // Four moorings on both banks, close enough to walk up and press F.
    for (const [x, side] of [[-180, 1], [760, 1], [-700, -1], [1450, -1]]) {
      const bank = side > 0 ? SN.riverNorth(x) : SN.riverSouth(x);
      let spot = null;
      for (const offset of [3.6, 3.1, 4.2]) {
        const z = bank + side * offset;
        if (SN.isWater(x, z, 0.5)) { spot = { x, z }; break; }
      }
      if (!spot)
        continue;
      const yaw = SN.PI / 2,
        c = SN.makeCar(spot.x, spot.z, yaw, true, null, 0, 16, "boat");
      Object.assign(c, { role: "boat", driver: false, parked: true, freeRolling: false, active: true,
        riverHome: { x: spot.x, z: spot.z, yaw } });
      c.root.visible = true;
      c.y = SN.WATER_Y + 0.18;
      c.root.position.set(c.x, c.y, c.z);
      SN.resetVehicleGround(c);
      SN.riverBoats.push(c);
      const land = SN.boatLanding(c);
      if (land) SN.riverDocks.push({ x: land.x, z: land.z, boat: c });
    }
  };
  SN.ambientBoats = [];
  SN.spawnAmbientBoats = function spawnAmbientBoats() {
    // Two boats keep the river moving even when the player stays on land.
    // Keep to the north and south channels so the boats never cross Yeouido.
    for (const [x, z, dir] of [[-1400, 120, 1], [900, 780, -1]]) {
      if (!SN.isWater(x, z, 1))
        continue;
      const yaw = dir > 0 ? SN.PI / 2 : -SN.PI / 2,
        c = SN.makeCar(x, z, yaw, true, null, 0, 16, "boat");
      Object.assign(c, { role: "boat", driver: true, parked: false, freeRolling: false,
        active: true, ambientBoat: 9 });
      c.y = SN.WATER_Y + 0.18;
      c.root.position.set(c.x, c.y, c.z);
      c.root.visible = true;
      SN.resetVehicleGround(c);
      SN.ambientBoats.push(c);
    }
  };
  SN.updateAmbientBoats = function updateAmbientBoats(dt) {
    for (const c of SN.ambientBoats) {
      if (!c.active || c === SN.player.car)
        continue;
      c.x += Math.sin(c.yaw) * c.ambientBoat * dt;
      if (c.x > 3000) c.x = -3000;
      else if (c.x < -3000) c.x = 3000;
      c.speed = c.ambientBoat;
      SN.updateVehicleGround(c, dt);
      c.px = c.x; c.pz = c.z; c.py = c.y; c.pyaw = c.yaw;
      c.ppitch = c.pitch; c.pterrainRoll = c.terrainRoll; c.proll = c.roll; c.psuspension = 0;
    }
  };
  // Startup phase 39: keep this order relative to the other systems.

  SN.registerInit(39, function initializeVehicles39() {
    const wheelFar = new SN.T.CylinderGeometry(0.17, 0.17, 0.15, 8);
    wheelFar.rotateZ(SN.PI / 2);
    const lower = SN.merged([{ g: SN.roundedBox(0.98, 0.5, 1, 0.22, 2), x: 0, y: 0.4, z: 0, sx: 1, sy: 1, sz: 1 }]);
    const upper = SN.merged([
      { g: SN.roundedBox(0.82, 0.4, 0.56, 0.2, 2), x: 0, y: 0.78, z: -0.05, sx: 1, sy: 1, sz: 1 },
      { g: wheelFar, x: -0.46, y: 0.2, z: 0.32 },
      { g: wheelFar, x: 0.46, y: 0.2, z: 0.32 },
      { g: wheelFar, x: -0.46, y: 0.2, z: -0.32 },
      { g: wheelFar, x: 0.46, y: 0.2, z: -0.32 }
    ]);
    SN.carLOD = [lower, upper].map((geometry, i) => {
      const mesh = new SN.T.InstancedMesh(geometry, new SN.T.MeshLambertMaterial({ color: i ? 0x294352 : 0xffffff }), Math.max(128, SN.cars.length));
      mesh.instanceMatrix.setUsage(SN.T.DynamicDrawUsage);
      mesh.frustumCulled = false; mesh.count = 0; SN.scene.add(mesh); return mesh;
    });
    // All vehicle wheels share three draws: tyre, rim and brake disc.
    SN.wheelInstances = [[SN.wheelGeo, SN.tireMat, true], [SN.rimGeo, SN.chromeMat, true], [SN.brakeGeo, SN.brakeMat, false]].map(([geometry, material, shadow]) => {
      const g = geometry.clone();
      g.boundingSphere = new SN.T.Sphere(new SN.T.Vector3(), SN.WORLD * 1.5);
      const mesh = new SN.T.InstancedMesh(g, material, 256);
      mesh.instanceMatrix.setUsage(SN.T.DynamicDrawUsage);
      mesh.castShadow = shadow;
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
    SN.carjack = null;
    SN.signalTick = -1;
    SN.signalColors = [0x211c1c, 0xff4238, 0x43ff8b, 0x16291e].map(SN.srgb);
    SN.signalLamps = new SN.T.InstancedMesh(SN.box, new SN.T.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, SN.trafficSignals.length * 2));
    SN.signalLamps.frustumCulled = false;
    for (let i = 0; i < SN.trafficSignals.length; i++) {
      const signal = SN.trafficSignals[i];
      signal.sn = Math.sin(signal.yaw); signal.co = Math.cos(signal.yaw);
      for (let lamp = 0; lamp < 2; lamp++) {
        SN.dummy.position.set(signal.poleX - Math.sin(signal.yaw) * 0.22, SN.surfaceHeight(signal.poleX, signal.poleZ) + 3.25 - lamp * 0.32, signal.poleZ - Math.cos(signal.yaw) * 0.22);
        SN.dummy.rotation.set(0, signal.yaw, 0);
        SN.dummy.scale.set(0.2, 0.2, 0.2);
        SN.dummy.updateMatrix();
        SN.signalLamps.setMatrixAt(i * 2 + lamp, SN.dummy.matrix);
      }
    }
    SN.scene.add(SN.signalLamps);
    SN.updateSignals();
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

  SN.cityTrafficBudget = function cityTrafficBudget() {
    const hour = SN.minutes / 60, rush = hour >= 7 && hour < 10 || hour >= 17 && hour < 20;
    return Math.round([10, 18, 28][SN.qualityLevel()] * (hour < 5 ? 0.45 : rush ? 1 : 0.78));
  };

  SN.cityTrafficSpeed = function cityTrafficSpeed(c, wanted, dt) {
    if (c.role !== "traffic" || c.missionTag || c.panic > 0) return wanted;
    const hour = SN.minutes / 60, rush = hour >= 7 && hour < 10 || hour >= 17 && hour < 20;
    if (rush && !c.spec.emergency) wanted = Math.min(wanted, c.type === 8 ? 9 : 6.5);
    if (c.type === 6) {
      if (c.busDwell > 0) { c.busDwell = Math.max(0, c.busDwell - dt); c.stuck = 0; return 0; }
      for (const stop of SN.busStops) {
        if (stop === c.lastBusStop && SN.simTime < c.busNext) continue;
        const dx = stop.roadX - c.x, dz = stop.roadZ - c.z;
        const along = dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw), across = Math.abs(dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw));
        if (along < -1 || along > 34 || across > 9 || (Math.sin(c.yaw) * stop.tx + Math.cos(c.yaw) * stop.tz) * -stop.side < 0.65) continue;
        wanted = Math.max(0, Math.min(wanted, Math.sqrt(Math.max(0, along - 2) * 5)));
        if (along < 4 && Math.abs(c.speed) < 1) {
          c.busDwell = 5; c.lastBusStop = stop; c.busNext = SN.simTime + 65; c.stuck = 0;
          for (const a of SN.actors) if (a.mode === "queue" && a.queueStop === stop) { a.mode = "walk"; a.modeTimer = 20; a.queueStop = null; }
        }
        break;
      }
    }
    if (c.hailedUntil > SN.simTime) { c.stuck = 0; wanted = 0; }
    if (!c.spec.emergency && SN.cars.some(o => o !== c && o.active && o.spec.emergency && !o.exploded && Math.hypot(o.x - c.x, o.z - c.z) < 24)) wanted = Math.min(wanted, 3);
    return wanted;
  };

  SN.hailTaxi = function hailTaxi() {
    if (SN.player.car || SN.heat > 0 || SN.campaign.active) { SN.toast("步行且没有通缉或委托时可扬招出租车", 3); return false; }
    const c = SN.cars.filter(c => c.active && c.type === 3 && c.role === "traffic" && c.driver && !c.exploded && Math.hypot(c.x - SN.player.x, c.z - SN.player.z) < 48 && SN.visibleBetween(SN.player.x, SN.player.y + 1, SN.player.z, c.x, c.y + 1, c.z))
      .sort((a, b) => Math.hypot(a.x - SN.player.x, a.z - SN.player.z) - Math.hypot(b.x - SN.player.x, b.z - SN.player.z))[0];
    if (!c) { SN.toast("附近没有空出租车 · 在主路边再试", 3); return false; }
    c.hailedUntil = SN.simTime + 35; c.aiNext = 0;
    SN.honk(c); SN.toast("出租车正在停车 · 地图点选目的地，再靠近按 F 乘坐", 5); return true;
  };

  SN.rideHailedTaxi = function rideHailedTaxi(c) {
    if (!SN.waypoint) { SN.toggleCityMap(true); SN.toast("在地图点选目的地，关地图后按 F 出发", 4); return; }
    const dest = SN.safePosition(SN.waypoint.x, SN.waypoint.z, 0.5);
    if (dest.unsafe) { SN.toast("此处无法下客，请换一个目的地", 3); return; }
    const fare = Math.max(30, Math.round(Math.hypot(dest.x - SN.player.x, dest.z - SN.player.z) * 0.08));
    if (SN.money < fare) { SN.toast("本次车费 ¥" + fare + " · 现金不足", 3); return; }
    SN.money -= fare; c.hailedUntil = 0;
    Object.assign(SN.player, { x: dest.x, z: dest.z, y: SN.surfaceHeight(dest.x, dest.z), speed: 0, vy: 0 });
    SN.minutes = (SN.minutes + 12) % 1440; SN.waypoint = null;
    SN.snapPlayer(); SN.streamCity(true); SN.saveCampaign(); SN.refreshHUD();
    SN.toast("出租车抵达 · 车费 ¥" + fare, 3);
  };

})(window.SN);
