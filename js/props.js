/* 街道设施、植被、交通景物与细节分块。 */
"use strict";
(function (SN) {
  SN.tree = function tree(x, z, willow = false, scale = 1) {
    if (SN.onRoadway(x, z, 0.5) || SN.landmarkReserves.some(c => Math.hypot(x - c.x, z - c.z) < c.r))
      return;
    if (SN.enterableSpecs.some(spec => Math.abs(x - spec.x) < spec.w / 2 + 1.5 && Math.abs(z - spec.z) < spec.d / 2 + 1.5))
      return;
    if (SN.shopSpecs.concat(SN.smallShopSpecs).some(spec => Math.abs(x - spec.x) < spec.w / 2 + 1.5 && Math.abs(z - spec.z) < spec.d / 2 + 1.5))
      return;
    if (SN.isWater(x, z) && !SN.onCauseway(x, z) || SN.blocked(x, z, 0.5))
      return;
    const y = SN.surfaceHeight(x, z);
    SN.addProp(x, z, Math.max(0.75, 0.85 * scale), Math.max(0.75, 0.85 * scale), 6.2 * scale);
    SN.record(SN.trunkBatch, x, y + 3.1 * scale, z, 0.42 * scale, 6.2 * scale, 0.42 * scale);
    if (willow) {
      SN.record(SN.leafBatch, x, y + 7.1 * scale, z, 4.9 * scale, 2.8 * scale, 4.9 * scale, SN.rand(0, SN.TAU), 0x79a36c);
      SN.record(SN.leafBatch, x, y + 6.1 * scale, z, 3.5 * scale, 1.7 * scale, 3.4 * scale, SN.rand(0, SN.TAU), 0x5f8a5d);
      for (let i = 0; i < 5; i++) {
        const a = i * SN.TAU / 5;
        SN.record(SN.willowBatch, x + Math.sin(a) * 3.6 * scale, y + 4.9 * scale, z + Math.cos(a) * 3.6 * scale, 1.25 * scale, 3.8 * scale, 1.3 * scale, a, 0x7ca476);
      }
      for (let i = 0; i < 4; i++) {
        const a = i * SN.TAU / 4 + 0.4;
        SN.record(SN.willowBatch, x + Math.sin(a) * 4.5 * scale, y + 4.4 * scale, z + Math.cos(a) * 4.5 * scale, 0.9 * scale, 3.1 * scale, 0.95 * scale, a, 0x6b956b);
      }
    }
    else {
      // Three big lobes, a shaded understory and a bright crown: reading as layered
      // foliage instead of a single low-poly ball.
      for (let i = 0; i < 3; i++) {
        const a = i * SN.TAU / 3;
        SN.record(SN.leafBatch, x + Math.sin(a) * 1.2 * scale, y + (6.1 + i * 0.45) * scale, z + Math.cos(a) * 1.2 * scale, 2.9 * scale, 3 * scale, 2.8 * scale, a, [0x7d9c80, 0x8aab84, 0xa3bb8e][i]);
      }
      SN.record(SN.leafBatch, x + SN.rand(-0.4, 0.4) * scale, y + 4.9 * scale, z + SN.rand(-0.4, 0.4) * scale, 3.6 * scale, 2.1 * scale, 3.4 * scale, SN.rand(0, SN.TAU), 0x6c8e68);
      SN.record(SN.leafBatch, x + SN.rand(-0.5, 0.5) * scale, y + 8.35 * scale, z + SN.rand(-0.5, 0.5) * scale, 2 * scale, 1.8 * scale, 1.9 * scale, SN.rand(0, SN.TAU), 0xa2bb90);
    }
  };

  SN.cityGroup = function cityGroup(x, z, range = 1900, y = null) {
    const g = new SN.T.Group();
    g.position.set(x, y === null ? SN.surfaceHeight(x, z) : y, z);
    g.userData.parts = new Map();
    g.userData.range = range;
    g.userData.id = "landmark-" + x + "," + z;
    SN.scene.add(g);
    SN.cityLandmarks.push(g);
    return g;
  };

  SN.cityPart = function cityPart(g, key, x, y, z, w, h, d, yaw = 0, geo = SN.box, rx = 0) {
    if (!g.userData.parts.has(key))
      g.userData.parts.set(key, []);
    g.userData.parts.get(key).push({ g: geo, x, y, z, sx: w, sy: h, sz: d, ry: yaw, rx });
  };

  SN.finishCityGroup = function finishCityGroup(g, movable = false) {
    const sites = g.userData.sites || [];
    if (sites.length) {
      // Reject an invalid group before creating foundations, colliders or signs.
      const invalid = sites.find(site => !site.ground.buildable || !Number.isFinite(site.ground.high));
      if (invalid) {
        SN.reportContentProblem(invalid.id, invalid.x, invalid.z, "地标地基不可建造", "跳过此组地标");
        SN.scene.remove(g);
        SN.cityLandmarks.splice(SN.cityLandmarks.indexOf(g), 1);
        return null;
      }
      let floor = g.position.y;
      for (const site of sites)
        floor = Math.max(floor, site.ground.high + 0.12);
      g.position.y = floor;
      for (const site of sites) {
        site.collider = SN.addOBB(site.x, site.z, site.w, site.d, site.h, 0, floor);
        SN.addFoundation(site.x, site.z, site.w, site.d, 0, site.ground, floor);
        SN.authoredBuildingSites.push({ ...site, floor });
      }
    }
    for (const label of g.userData.labels || [])
      SN.sign(label.text, g.position.x, g.position.y + 6, g.position.z + label.z, label.width, 3, 0, true);
    for (const [key, parts] of g.userData.parts) {
      if (movable) {
        const mesh = new SN.T.Mesh(SN.merged(parts), SN.cityPalette[key]);
        mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
        continue;
      }
      const geometries = new Map();
      for (const p of parts) {
        if (!geometries.has(p.g)) geometries.set(p.g, []);
        geometries.get(p.g).push({ ...p, x: p.x + g.position.x, y: p.y + g.position.y, z: p.z + g.position.z });
      }
      for (const list of geometries.values()) {
        const first = SN.cityTiles.length;
        SN.staticCityTiles(SN.cityPalette[key], list, g.userData.range, 320, false, true);
        for (let i = first; i < SN.cityTiles.length; i++) SN.cityTiles[i].landmark = true;
      }
    }
    delete g.userData.parts;
    return g;
  };

  SN.citySolid = function citySolid(g, x, z, w, d, h) {
    const px = g.position.x + x,
      pz = g.position.z + z,
      ground = SN.footprintTerrain(px, pz, w, d);
    if (!g.userData.sites)
      g.userData.sites = [];
    g.userData.sites.push({ id: g.userData.id + "-" + g.userData.sites.length, x: px, z: pz, w, d, h, ground });
  };

  SN.cityLabel = function cityLabel(g, text, z, width = 30) {
    if (!g.userData.labels)
      g.userData.labels = [];
    g.userData.labels.push({ text, z, width });
  };

  SN.cityWindows = function cityWindows(g, x, z, w, d, h, key = "glass") {
    const block = { x, z, w, d, h, base: 0, yaw: 0 };
    for (const f of SN.buildingFaces(block)) {
      const bays = Math.max(1, Math.floor(f.w / 4.5)), step = f.w / bays;
      for (let y = 4.4; y < h - 1; y += 3.8)
        for (let n = 0; n < bays; n++) {
          const u = (n + 0.5) * step - f.w / 2;
          const xx = x + f.nx * (f.depth + 0.12) + Math.cos(f.yaw) * u;
          const zz = z + f.nz * (f.depth + 0.12) - Math.sin(f.yaw) * u;
          SN.cityPart(g, key, xx, y, zz, step * 0.7, 2.2, 0.12, f.yaw);
          SN.cityPart(g, "cream", xx, y - 1.15, zz, step * 0.76, 0.12, 0.22, f.yaw);
        }
    }
  };

  SN.originalAirliner = function originalAirliner(x, z, moving = false) {
    const g = SN.cityGroup(x, z, 2800, 0);
    SN.cityPart(g, "white", 0, 3, 0, 2.7, 2.7, 20, 0, new SN.T.SphereGeometry(1, 16, 10));
    SN.cityPart(g, "teal", 0, 3.5, -15, 2, 3, 6, 0, new SN.T.SphereGeometry(1, 10, 8));
    SN.cityPart(g, "white", 0, 2.9, 0, 37, 0.45, 8, 0.13);
    SN.cityPart(g, "teal", 0, 3, -15, 14, 0.35, 5);
    SN.cityPart(g, "teal", 0, 7, -15, 0.45, 8, 6);
    for (const side of [-1, 1]) {
      SN.cityPart(g, "dark", side * 8, 1.8, 2, 1.4, 1.4, 3, 0, new SN.T.SphereGeometry(1, 10, 8));
      SN.cityPart(g, "dark", side * 1.4, 0.6, -2, 0.4, 1.2, 0.4);
      SN.cityPart(g, "light", side * 18, 3, 0, 0.4, 0.3, 0.5);
      for (let i = 0; i < 14; i++)
        SN.cityPart(g, "dark", side * 2.55, 4, -12 + i * 1.65, 0.15, 0.45, 0.55);
    }
    SN.cityPart(g, "glass", 0, 4.3, 16, 3, 0.8, 1);
    SN.finishCityGroup(g, true);
    if (moving)
      SN.cityTransit.push({ kind: "plane", root: g });
    return g;
  };

  SN.updateCityTransit = function updateCityTransit(time) {
    for (const transit of SN.cityTransit) {
      const g = transit.root;
      if (transit.kind === "ferry") {
        const a = time * 0.007;
        g.position.set(Math.sin(a) * 3180, 0.05 + Math.sin(time * 0.8) * 0.08, 740 + Math.cos(a) * 29);
        g.rotation.y = Math.atan2(Math.cos(a) * 3180, -Math.sin(a) * 29);
      }
      else if (transit.kind === "train") {
        const t = (time % 190) / 190, along = t < 0.5 ? t * 2 : 2 - t * 2;
        g.position.set(1924, 18.3, -330 + along * 1430);
        g.rotation.y = t < 0.5 ? 0 : SN.PI;
      }
      else if (transit.kind === "cable") {
        const t = (Math.sin(time * 0.035 + transit.phase * SN.PI) + 1) / 2;
        g.position.lerpVectors(SN.cableStart, SN.cableEnd, t);
        g.position.z += transit.phase * 5;
        g.rotation.z = Math.sin(time * 1.2) * 0.025;
      }
      else if (transit.kind === "plane") {
        const t = time % 240;
        if (t < 26) {
          const u = t / 26;
          g.position.set(SN.lerp(-2940, -3160, u), 0, SN.lerp(-2600, -2800, u));
          g.rotation.set(0, Math.atan2(-220, -200), 0);
        }
        else if (t < 48) {
          const u = (t - 26) / 22;
          g.position.set(-3160, 0.12, -2800 + u * u * 1700);
          g.rotation.set(0, 0, 0);
        }
        else if (t < 70) {
          const u = (t - 48) / 22;
          g.position.set(-3160, Math.pow(u, 0.9) * 280, -1100 + u * 1600);
          g.rotation.set(-0.12, 0, 0);
        }
        else if (t < 160) {
          const u = (t - 70) / 90,
            v = 1 - u,
            x = v * v * v * -3160 + 3 * v * v * u * -1500 + 3 * v * u * u * -1500 + u * u * u * -3160,
            z = v * v * v * 500 + 3 * v * v * u * 1200 + 3 * v * u * u * -4700 + u * u * u * -3500,
            dx = 3 * v * v * 1660 - 3 * u * u * 1660,
            dz = 3 * v * v * 700 + 6 * v * u * -5900 + 3 * u * u * 1200;
          g.position.set(x, SN.lerp(280, 240, u) + Math.sin(u * SN.PI) * 160, z);
          g.rotation.set(0, Math.atan2(dx, dz), Math.sin(u * SN.TAU) * 0.16);
        }
        else if (t < 195) {
          const u = (t - 160) / 35;
          g.position.set(-3160, 240 * (1 - u), -3500 + u * 800);
          g.rotation.set(0.04, 0, 0);
        }
        else if (t < 215) {
          const u = (t - 195) / 20;
          g.position.set(-3160, 0, -2700 + (2 * u - u * u) * 800);
          g.rotation.set(0, 0, 0);
        }
        else if (t < 223) {
          const u = (t - 215) / 8;
          g.position.set(SN.lerp(-3160, -2940, u), 0, -1900);
          g.rotation.set(0, SN.PI / 2, 0);
        }
        else {
          const u = (t - 223) / 17;
          g.position.set(-2940, 0, SN.lerp(-1900, -2600, u));
          g.rotation.set(0, SN.PI, 0);
        }
      }
    }
  };

  // The cable line is also a way up the mountain: board at either station and
  // ride the cabin instead of fighting the slope.
  SN.updateCable = function updateCable() {
    SN.cableTarget = null;
    if (SN.cableRide || SN.player.car || SN.player.aircraft || SN.player.dead || !SN.cableStations)
      return;
    for (const station of SN.cableStations) {
      const ground = SN.surfaceHeight(station.x, station.z);
      if (Math.hypot(SN.player.x - station.x, SN.player.z - station.z) < 9 && Math.abs(SN.player.y - ground) < 5) {
        SN.cableTarget = station;
        return;
      }
    }
  };

  SN.startCableRide = function startCableRide() {
    const from = SN.cableTarget;
    if (!from || SN.cableRide)
      return false;
    if (SN.campaign.active && SN.campaign.active.status === "running") {
      SN.toast("任务进行中，缆车暂停载客", 3);
      return false;
    }
    if (SN.heat > 0) {
      SN.toast("通缉期间缆车停运", 3);
      return false;
    }
    const to = SN.cableStations.find(station => station !== from);
    if (!to)
      return false;
    SN.clearInput();
    SN.player.car = null; SN.player.bail = null; SN.player.vault = null;
    SN.playerRoot.visible = false;
    SN.cableTarget = null;
    SN.cableRide = { from, to, time: 0, duration: 9 };
    SN.toast("缆车进站 · " + to.name, 3.2);
    return true;
  };

  SN.updateCableRide = function updateCableRide(dt) {
    const ride = SN.cableRide;
    if (!ride)
      return false;
    ride.time += dt;
    const t = SN.clamp(ride.time / ride.duration, 0, 1), eased = t * t * (3 - 2 * t);
    SN.player.x = SN.lerp(ride.from.ride.x, ride.to.ride.x, eased);
    SN.player.z = SN.lerp(ride.from.ride.z, ride.to.ride.z, eased);
    SN.player.y = SN.lerp(ride.from.ride.y, ride.to.ride.y, eased) + 1.2;
    SN.player.yaw = Math.atan2(ride.to.ride.x - ride.from.ride.x, ride.to.ride.z - ride.from.ride.z);
    SN.camYaw = SN.player.yaw;
    SN.lookDelay = 0;
    if (t < 1)
      return true;
    const landing = SN.safePosition(ride.to.x, ride.to.z, 0.4);
    Object.assign(SN.player, {
      x: landing.x, z: landing.z, y: SN.surfaceHeight(landing.x, landing.z),
      vy: 0, speed: 0, motionSpeed: 0, bail: null
    });
    SN.playerRoot.visible = true;
    SN.snapPlayer();
    SN.cableRide = null;
    SN.toast("缆车已抵达 · " + ride.to.name, 3);
    return false;
  };

  SN.surfaceTypeAt = function surfaceTypeAt(x, z) {
    const ix = SN.clamp(Math.floor((x + SN.EXTENT) / SN.SURFACE_CELL), 0, SN.SURFACE_SIZE - 1),
      iz = SN.clamp(Math.floor((z + SN.EXTENT) / SN.SURFACE_CELL), 0, SN.SURFACE_SIZE - 1);
    return SN.surfaceTypes[iz * SN.SURFACE_SIZE + ix];
  };

  SN.updateGroundDetails = function updateGroundDetails() {
    if (SN.qualityLevel() < 2) {
      SN.groundDetails.visible = false;
      return;
    }
    SN.groundDetails.visible = true;
    const px = SN.playerRender.x, pz = SN.playerRender.z;
    if (Math.hypot(px - SN.detailX, pz - SN.detailZ) < 15)
      return;
    SN.detailX = px;
    SN.detailZ = pz;
    // Decorative regeneration must not advance the simulation's random sequence.
    const simulationSeed = SN.seed;
    let count = 0;
    for (let i = 0; i < 150; i++) {
      const a = SN.rand(0, SN.TAU), r = Math.sqrt(SN.rnd()) * 34, x = px + Math.sin(a) * r, z = pz + Math.cos(a) * r;
      if (SN.isWater(x, z, 1) || SN.surfaceTypeAt(x, z) !== 0 || SN.blocked(x, z, 0.2))
        continue;
      if (SN.hillHeight(x, z) > 2.5)
        continue;
      // The military compound is paved even where the terrain layer still reads
      // as grass, so its asphalt must not sprout tufts.
      if (SN.military && x > SN.military.x0 && x < SN.military.x1 && z > SN.military.z0 && z < SN.military.z1)
        continue;
      const s = SN.rand(0.6, 1.3);
      SN.dummy.position.set(x, SN.surfaceHeight(x, z), z);
      SN.dummy.rotation.set(0, SN.rand(0, SN.TAU), 0);
      SN.dummy.scale.set(s, SN.rand(0.7, 1.4), s);
      SN.dummy.updateMatrix();
      SN.groundDetails.setMatrixAt(count, SN.dummy.matrix);
      SN.groundDetails.setColorAt(count, new SN.T.Color().setHSL(0.26 + SN.rand(-0.03, 0.03), 0.5, SN.rand(0.14, 0.25)));
      count++;
    }
    SN.groundDetails.count = count;
    SN.groundDetails.instanceMatrix.needsUpdate = true;
    if (SN.groundDetails.instanceColor)
      SN.groundDetails.instanceColor.needsUpdate = true;
    SN.seed = simulationSeed;
  };

  SN.cableSpan = function cableSpan(ax, ay, az, bx, by, bz, sag) {
    const count = Math.max(4, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
    for (let i = 0; i < count; i++) {
      const t0 = i / count,
        t1 = (i + 1) / count,
        x0 = SN.lerp(ax, bx, t0),
        z0 = SN.lerp(az, bz, t0),
        y0 = SN.lerp(ay, by, t0) - sag * 4 * t0 * (1 - t0),
        x1 = SN.lerp(ax, bx, t1),
        z1 = SN.lerp(az, bz, t1),
        y1 = SN.lerp(ay, by, t1) - sag * 4 * t1 * (1 - t1),
        length = Math.hypot(x1 - x0, z1 - z0);
      SN.record(SN.urbanWires, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0.024, 0.024, Math.hypot(length, y1 - y0), Math.atan2(x1 - x0, z1 - z0));
      SN.urbanWires[SN.urbanWires.length - 1].pitch = -Math.atan2(y1 - y0, length);
    }
  };
  // Startup phase 8: keep this order relative to the other systems.

  SN.registerInit(8, function initializeProps8() {
    for (let i = 0; i < SN.roads.length; i++) {
      const r = SN.roads[i];
      if (r.bridge)
        continue;
      for (let j = 0; j < r.points.length - 1; j++) {
        const a = r.points[j],
          b = r.points[j + 1],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz),
          nx = dz / len,
          nz = -dx / len;
        for (let t = 17; t < len - 8; t += 34)
          for (const s of [-1, 1]) {
            const x = a[0] + dx * t / len + nx * (r.width / 2 + 0.3 + Math.min(1.1, r.sidewalkW * 0.45)) * s,
              z = a[1] + dz * t / len + nz * (r.width / 2 + 0.3 + Math.min(1.1, r.sidewalkW * 0.45)) * s;
            if (!SN.blocked(x, z, 1) && !SN.isWater(x, z, 0.4))
              SN.tree(x, z, false, SN.rand(0.85, 1.15));
          }
      }
    }
    // Han riverside parks on both banks: promenades, benches, willows.
    SN.benchSpots = [];
    for (let i = 0; i < SN.paths.length; i++) {
      const p = SN.paths[i],
        dx = p.b[0] - p.a[0],
        dz = p.b[1] - p.a[1],
        len = Math.hypot(dx, dz),
        nx = dz / len,
        nz = -dx / len,
        segs = Math.max(1, Math.ceil(len / 18));
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs,
          t1 = (s + 1) / segs,
          x0 = SN.lerp(p.a[0], p.b[0], t0),
          z0 = SN.lerp(p.a[1], p.b[1], t0),
          x1 = SN.lerp(p.a[0], p.b[0], t1),
          z1 = SN.lerp(p.a[1], p.b[1], t1);
        SN.strip(SN.sideBatch, x0, z0, x1, z1, p.w, SN.groundHeight((x0 + x1) * 0.5, (z0 + z1) * 0.5) + 0.13, 0.28);
      }
      for (let t = 12; t < len - 10; t += 34) {
        const x = p.a[0] + dx * t / len, z = p.a[1] + dz * t / len, bridgeHere = SN.bridges.some(b => Math.abs(x - b.x) < 24);
        for (const s of [-1, 1])
          if (!bridgeHere)
            SN.tree(x + nx * (p.w / 2 + 3) * s, z + nz * (p.w / 2 + 3) * s, true, 0.82);
        if (t % 102 < 34)
          SN.addLamp(x, z, Math.atan2(dx, dz));
        if (t % 68 < 34 && !bridgeHere) {
          const bx = x + nx * (p.w / 2 + 1.6), bz = z + nz * (p.w / 2 + 1.6), by = Math.atan2(dx, dz);
          SN.record(SN.benchBatch, bx, SN.groundHeight(x, z) + 0.55, bz, 1.2, 0.3, 3.2, by);
          SN.addProp(bx, bz, 1.2, 3.2, 1);
          SN.benchSpots.push({ x: bx, z: bz, yaw: by });
        }
      }
    }
    for (let x = -1120; x < 1120; x += 30) {
      let near = false;
      for (const b of SN.bridges)
        if (Math.abs(x - b.x) < 24)
          near = true;
      if (near)
        continue;
      SN.tree(x, SN.riverNorth(x) - 28, true, 0.95);
      SN.tree(x, SN.riverSouth(x) + 4, true, 0.95);
    }
    // Promenade benches are generated along each bank path below, so they always sit on land.
    // Yeouido: a low green island carrying its own glass cluster.
    SN.yeouidoMesh = SN.meshAt(new SN.T.CylinderGeometry(1, 1, 1, 40), SN.pbrMat("grass", 0xa4b391, { uvScale: 0.22, roughness: 1 }), SN.island.x, 0.05, SN.island.z, SN.island.rx, 1.75, SN.island.rz);
    SN.yeouidoMesh.castShadow = false;
    for (let i = 0; i < 90; i++) {
      const a = SN.rnd() * SN.TAU, r = Math.sqrt(SN.rnd());
      const x = SN.island.x + Math.sin(a) * r * SN.island.rx * 0.92, z = SN.island.z + Math.cos(a) * r * SN.island.rz * 0.9;
      if (Math.abs(x + 780) < 32)
        continue;
      SN.tree(x, z, i % 4 === 0, 0.85);
    }
    SN.sign("여 의 도", -900, 4, 380, 18, 4, 0);
    SN.sign("汝 矣 島 公 園", -900, 9, 380, 16, 3, 0);
  });
  // Startup phase 10: keep this order relative to the other systems.

  SN.registerInit(10, function initializeProps10() {
    // ---------------- Original architecture and public transport ----------------
    SN.cityLandmarks = [];
    SN.cityTransit = [];
    SN.subwayStops = [];
    SN.cityPalette = {
      stone: SN.pbrMat("stone", 0xd6c8ac, { uvScale: 0.34, roughness: 1, metalness: 0.02 }),
      wood: SN.pbrMat("wood", 0xd8b898, { uvScale: 0.7, roughness: 1, metalness: 0.02 }),
      tile: SN.pbrMat("roofTile", 0xb8c8cc, { uvScale: 0.5, roughness: 1, metalness: 0.06 }),
      brick: SN.pbrMat("brick", 0xffe8dc, { uvScale: 0.44, roughness: 1 }),
      cream: SN.pbrMat("stucco", 0xf2e4c8, { uvScale: 0.36, roughness: 1, metalness: 0.02 }),
      glass: SN.pbrMat("glass", 0xc2dde0, { uvScale: 0.5, metalness: 0.62, roughness: 1, envMapIntensity: 1.1 }),
      gold: SN.pbrMat("metal", 0xffc34c, { uvScale: 0.45, metalness: 0.82, roughness: 0.42 }),
      teal: SN.pbrMat("metal", 0x69a69c, { uvScale: 0.5, metalness: 0.45, roughness: 0.75 }),
      dark: SN.pbrMat("metal", 0x53666c, { uvScale: 0.45, metalness: 0.4, roughness: 0.86 }),
      white: SN.pbrMat("stucco", 0xf0e8d8, { uvScale: 0.4, roughness: 1, metalness: 0.02 }),
      red: SN.pbrMat("paint", 0xf2442f, { uvScale: 0.5, roughness: 0.92 }),
      grass: SN.pbrMat("grass", 0xadc09a, { uvScale: 0.8, roughness: 1 }),
      light: SN.pbrMat("paint", 0xffe9c8, { uvScale: 0.5, emissive: 0x9fe0cc, emissiveIntensity: 0.7, roughness: 0.42 })
    };
    SN.cityPalette.silver = SN.pbrMat("metal", 0xb4d5ec, { uvScale: 0.16, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.7 });
    // Warm sodium lamp glass: the shared "light" material is a mint-white strip
    // for vehicle lamps, which reads wrong on a plaza street lamp.
    SN.cityPalette.warmLamp = SN.pbrMat("paint", 0xffe2b0, { uvScale: 0.5, emissive: 0xffb45e, emissiveIntensity: 1.5, roughness: 0.5 });
    SN.cityPalette.plazaPink = SN.pbrMat("paint", 0xff5d9e, { uvScale: 0.5, emissive: 0xff2f80, emissiveIntensity: 1.25, roughness: 0.5 });
    SN.cityPalette.plazaCyan = SN.pbrMat("paint", 0x5fe6da, { uvScale: 0.5, emissive: 0x2fd0c2, emissiveIntensity: 1.1, roughness: 0.5 });
    SN.neonMats.push(SN.cityPalette.warmLamp, SN.cityPalette.plazaPink, SN.cityPalette.plazaCyan);
    SN.cityPalette.curtain = SN.buildingMats[3].clone();
    SN.cityPalette.curtain.onBeforeCompile = shader => {
      SN.buildingMats[3].onBeforeCompile(shader);
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vUv=uv*vec2(18.,16.);");
    };
    SN.cityPalette.curtain.color.copy(SN.srgb(0xc2e2f1)); SN.neonMats.push(SN.cityPalette.curtain);
    SN.cityPalette.goldFacade = SN.buildingMats[3].clone();
    SN.cityPalette.goldFacade.onBeforeCompile = shader => {
      SN.buildingMats[3].onBeforeCompile(shader);
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vUv=uv*vec2(4.,8.6);");
    };
    SN.cityPalette.goldFacade.color.copy(SN.srgb(0xffd16c)); SN.neonMats.push(SN.cityPalette.goldFacade);
    const silverCompile = SN.cityPalette.silver.onBeforeCompile;
    SN.cityPalette.silver.onBeforeCompile = shader => {
      silverCompile(shader);
      shader.fragmentShader = "varying vec3 vPbrWorld;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        vec2 panel=fract(vec2(vPbrWorld.x+vPbrWorld.z*.35,vPbrWorld.y)*.7);
        float seam=step(.965,panel.x)+step(.96,panel.y);
        diffuseColor.rgb*=1.-min(seam,1.)*.28;`);
    };
    // DDP: two low silver shells, a dark ribbon of glass and an open forecourt.
    {
      const g = SN.cityGroup(SN.ddpSite.x, SN.ddpSite.z, 2400);
      g.userData.id = SN.ddpSite.id;
      const shell = new SN.T.SphereGeometry(1, 24, 12);
      SN.cityPart(g, "stone", 0, 0.1, 0, 200, 0.2, 132);
      SN.cityPart(g, "dark", 0, 5, 0, 138, 10, 58);
      SN.cityPart(g, "glass", 0, 8, 30, 136, 8, 1);
      SN.cityPart(g, "silver", -30, 11, -8, 64, 18, 36, 0.14, shell);
      SN.cityPart(g, "silver", 44, 10, 1, 45, 15, 31, -0.2, shell);
      SN.citySolid(g, -27, -5, 112, 58, 27);
      SN.citySolid(g, 55, 0, 50, 48, 23);
      SN.cityLabel(g, "동대문 디자인 플라자 · DDP", 54, 52);
      if (SN.finishCityGroup(g)) {
        const site = SN.ddpSite, ground = SN.footprintTerrain(site.x, site.z, site.w, site.d);
        SN.addFoundation(site.x, site.z, site.w, site.d, 0, ground, g.position.y);
        SN.rasterSurface(site.x - site.w / 2, site.x + site.w / 2, site.z - site.d / 2, site.z + site.d / 2,
          () => true, () => g.position.y + 0.2, 3);
        SN.localSurfacePatches.push({
          minX: site.x - site.w / 2, maxX: site.x + site.w / 2,
          minZ: site.z - site.d / 2, maxZ: site.z + site.d / 2,
          test: () => true, height: () => g.position.y + 0.2
        });
      }
    }
    // Hanok courtyards follow the slope; narrow lanes retain usable doors and gaps.
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 5; col++) {
        const x = 395 + col * 40, z = -1480 + row * 44, ground = SN.footprintTerrain(x, z, 27, 25);
        if (SN.onRoadway(x, z, 13) || !ground.buildable)
          continue;
        const g = SN.cityGroup(x, z, 1000, ground.high + 0.12);
        SN.addFoundation(x, z, 27, 25, 0, ground, g.position.y);
        SN.cityPart(g, "stone", 0, 0.5, 0, 25, 1, 23);
        SN.cityPart(g, "cream", 0, 2.8, -5, 23, 4.6, 11);
        SN.cityPart(g, "wood", -9, 2.8, 4, 5, 4.6, 14);
        for (const xx of [-11, -5, 1, 7, 11])
          SN.cityPart(g, "wood", xx, 3, 1, 0.45, 5, 0.45);
        SN.cityPart(g, "tile", 0, 6.2, -5, 19, 4.6, 10, SN.PI / 4, new SN.T.CylinderGeometry(0.2, 1, 1, 4));
        SN.cityPart(g, "tile", 0, 4.8, -5, 20, 0.35, 11, SN.PI / 4, new SN.T.CylinderGeometry(1, 1.1, 1, 4));
        SN.citySolid(g, 0, -5, 23, 11, 7);
        SN.citySolid(g, -9, 4, 5, 14, 7);
        SN.finishCityGroup(g);
      }
    SN.sign("북촌 · 솔안개 골목", 620, SN.hillHeight(620, -1180) + 6, -1180, 23, 3, 0, true);
    // Namdaemun market: a permeable pair of covered shopping rows.
    {
      const g = SN.cityGroup(-500, -550, 1000);
      for (let i = 0; i < 12; i++)
        for (const side of [-1, 1]) {
          const x = -70 + i * 13, z = side * 15;
          SN.cityPart(g, "wood", x, 1, z, 9, 2, 6);
          SN.cityPart(g, i % 2 ? "red" : "cream", x, 3.4, z, 11, 0.4, 9);
          SN.cityPart(g, "dark", x - 4, 1.8, z, 0.16, 3.6, 0.16);
          SN.citySolid(g, x, z, 9, 6, 2);
          for (let j = 0; j < 3; j++)
            SN.cityPart(g, ["gold", "teal", "cream"][j], x - 2 + j * 2, 2.3, z, 1.1, 0.5, 2);
        }
      SN.cityLabel(g, "남대문 · 종이등 장터", 30, 35);
      SN.finishCityGroup(g);
    }
    // Seoul Station: split barrel canopy, raised concourse and six original rail tracks.
    {
      const g = SN.cityGroup(-1230, -610, 2300);
      SN.cityPart(g, "brick", 0, 9, 0, 150, 18, 65);
      SN.cityWindows(g, 0, 0, 150, 65, 18);
      SN.cityPart(g, "cream", 0, 19, 29, 35, 4, 15);
      SN.cityPart(g, "teal", 0, 28, 24, 12, 12, 12, 0, new SN.T.SphereGeometry(1, 16, 10, 0, SN.TAU, 0, SN.PI / 2));
      SN.cityPart(g, "gold", 0, 43, 24, 0.7, 9, 0.7);
      for (let x = -66; x <= 66; x += 12) SN.cityPart(g, "cream", x, 9, 33, 1.6, 18, 1.2);
      SN.cityPart(g, "cream", 0, 2.4, 36, 150, 0.5, 5);
      SN.cityPart(g, "glass", 0, 13, 34, 138, 13, 1);
      for (const x of [-54, 0, 54]) {
        // Barrel vault over the concourse: length (h) runs along z and the
        // section radii (w/d) give a 23 x 12 m profile.
        SN.cityPart(g, "cream", x, 24.5, 0, 11.5, 38, 6, 0, new SN.T.CylinderGeometry(1, 1, 1, 12), SN.PI / 2);
        SN.cityPart(g, "gold", x, 30.9, 0, 1.2, 0.8, 40);
      }
      SN.cityPart(g, "stone", 0, 0.2, 70, 175, 0.4, 65);
      SN.citySolid(g, 0, 0, 150, 65, 28);
      SN.cityLabel(g, "서울역 · 首尔站", 35, 60);
      for (let i = 0; i < 6; i++) {
        const x = -60 + i * 24;
        SN.cityPart(g, "stone", x, 0.3, -200, 8, 0.6, 330);
        for (const side of [-1, 1])
          SN.cityPart(g, "dark", x + side * 0.85, 0.65, -200, 0.15, 0.2, 330);
        for (let z = -355; z < -50; z += 6)
          SN.cityPart(g, "wood", x, 0.5, z, 3, 0.15, 0.4);
        SN.cityPart(g, "cream", x, 5, -105, 13, 0.6, 125);
      }
      SN.finishCityGroup(g);
    }
    // Hilly Itaewon fronts with terraces and warm, original venue signs.
    for (let i = 0; i < 18; i++) {
      const x = -1400 + i * 30, z = -150 - Math.sin(i * 0.5) * 30, g = SN.cityGroup(x, z, 1000), h = 8 + i % 4 * 3;
      const ground = SN.footprintTerrain(x, z, 23, 19);
      if (SN.onRoadway(x, z, 20) || !SN.footprintFree(x, z, 21, 17) || !ground.buildable) {
        SN.scene.remove(g);
        SN.cityLandmarks.pop();
        continue;
      }
      g.position.y = ground.high + 0.12;
      SN.addFoundation(x, z, 23, 19, 0, ground, g.position.y);
      SN.cityPart(g, i % 2 ? "brick" : "cream", 0, h / 2, 0, 21, h, 17);
      SN.cityPart(g, "dark", 0, h + 0.2, 0, 23, 0.4, 19);
      SN.cityWindows(g, 0, 0, 21, 17, h);
      SN.cityPart(g, "teal", 0, 3, 9, 17, 0.5, 3);
      SN.citySolid(g, 0, 0, 21, 17, h);
      if (i % 3 === 0)
        SN.cityLabel(g, ["달바람 음악실", "여울빛 식탁", "안개잔 다방"][i % 3], 9.1, 17);
      SN.finishCityGroup(g);
    }
    // Hongdae busking square and Sinchon campus cloisters.
    {
      const g = SN.cityGroup(-1900, -570, 1300);
      // A flush stone paving, not a 30 cm raised deck: the props and pedestrian
      // surface all sit at the group's ground level, so a thick slab would sink
      // everyone to the ankles across the whole square.
      SN.cityPart(g, "stone", 0, 0.02, 0, 170, 0.06, 95);
      // The square is 170 x 95 m: one uniform slab reads as a car park. Band it
      // like a real plaza - a dark perimeter, a stone grid and a dark apron in
      // front of the stage - so the eye gets scale cues at ground level.
      for (const side of [-1, 1]) {
        SN.cityPart(g, "dark", side * 83, 0.055, 0, 3.6, 0.012, 95);
        SN.cityPart(g, "dark", 0, 0.055, side * 46, 170, 0.012, 3.6);
      }
      for (const x of [-62, -28, 28, 62])
        SN.cityPart(g, "dark", x, 0.052, 0, 1.1, 0.012, 92);
      for (const z of [-30, -15, 15, 30])
        SN.cityPart(g, "dark", 0, 0.052, z, 166, 0.012, 1.1);
      SN.cityPart(g, "dark", 50, 0.054, -14, 38, 0.012, 18);
      // Busking stage: wooden deck, dark backdrop, truss and warm deck lights.
      SN.cityPart(g, "wood", 50, 0.6, -27, 30, 1.2, 14);
      SN.cityPart(g, "dark", 50, 3, -34.1, 30, 5.6, 0.5);
      SN.cityPart(g, "plazaPink", 50, 4.9, -33.82, 26, 0.12, 0.05);
      SN.cityPart(g, "plazaCyan", 50, 1.7, -33.82, 26, 0.08, 0.05);
      for (const x of [32, 68]) {
        SN.cityPart(g, "dark", x, 2, -27, 2, 4, 2);
        SN.cityPart(g, "gold", x, 6, -27, 0.25, 8, 0.25);
      }
      for (const x of [34, 66])
        SN.cityPart(g, "silver", x, 7.4, -24, 0.18, 0.18, 0.18);
      SN.cityPart(g, "silver", 50, 7.4, -24, 32, 0.18, 0.18);
      for (const x of [40, 46, 54, 60])
        SN.cityPart(g, "warmLamp", x, 7.05, -24, 1.1, 0.5, 0.7);
      // Spectator barriers facing the deck keep the busking circle readable.
      for (let i = 0; i < 6; i++) {
        const x = 32 + i * 7.2;
        SN.cityPart(g, "silver", x, 1.05, -16.5, 6.6, 0.09, 0.09);
        SN.cityPart(g, "silver", x, 0.56, -16.5, 6.6, 0.07, 0.07);
        for (const side of [-1, 1])
          SN.cityPart(g, "silver", x + side * 3.2, 0.55, -16.5, 0.09, 1.1, 0.09);
      }
      // Market corner along the north edge: three awning stalls with counters.
      for (const [i, sx] of [-70, -57, -44].entries()) {
        const aw = ["red", "cream", "teal"][i];
        SN.cityPart(g, "wood", sx, 0.55, -29, 5, 1.1, 2.8);
        SN.cityPart(g, "dark", sx, 1.5, -30.2, 5, 2.6, 0.18);
        for (const side of [-1, 1])
          SN.cityPart(g, "dark", sx + side * 2.35, 1.4, -29, 0.14, 2.8, 0.14);
        SN.cityPart(g, aw, sx, 2.85, -29, 5.8, 0.16, 3.6);
        SN.cityPart(g, aw, sx, 2.4, -27.25, 5.8, 0.42, 0.08);
        SN.cityPart(g, i === 1 ? "plazaCyan" : "plazaPink", sx, 2.18, -27.2, 5.6, 0.06, 0.05);
        SN.cityPart(g, "warmLamp", sx, 2.62, -30.1, 3.6, 0.16, 0.1);
        SN.cityPart(g, "gold", sx, 0.78, -27.55, 0.9, 0.06, 0.45);
      }
      // Café corner on the south side: parasols, round tables and stools, with
      // two runs of festoon lights overhead so the corner reads after dark.
      for (const z of [14, 30]) {
        for (const x of [-72, -18])
          SN.cityPart(g, "silver", x, 1.65, z, 0.1, 3.3, 0.1);
        SN.cityPart(g, "dark", -45, 3.3, z, 54, 0.03, 0.03);
        for (let i = 0; i < 13; i++)
          SN.cityPart(g, "warmLamp", -70.5 + i * 4.3, 3.18, z, 0.16, 0.2, 0.16);
      }
      for (const [tx, tz, uk] of [[-60, 16, "red"], [-42, 31, "cream"], [-24, 16, "teal"], [-60, 34, "cream"]]) {
        SN.cityPart(g, "silver", tx, 1.3, tz, 0.12, 2.6, 0.12);
        SN.cityPart(g, uk, tx, 2.6, tz, 4.6, 0.34, 4.6, 0, new SN.T.CylinderGeometry(1, 1, 1, 8));
        SN.cityPart(g, "dark", tx, 0.74, tz, 2.2, 0.1, 2.2, 0, new SN.T.CylinderGeometry(1, 1, 1, 16));
        SN.cityPart(g, "silver", tx, 0.37, tz, 0.14, 0.74, 0.14);
        for (const a of [0.2, 2.3, 4.4]) {
          const px = tx + Math.sin(a) * 1.6, pz = tz + Math.cos(a) * 1.6;
          SN.cityPart(g, "dark", px, 0.44, pz, 0.5, 0.07, 0.5);
          SN.cityPart(g, "silver", px, 0.22, pz, 0.07, 0.44, 0.07);
        }
      }
      // Planters and banner poles frame the entrances without blocking the alley.
      for (const [px, pz] of [[-80, -20], [-80, 20], [80, -20], [80, 20], [15, 40], [-15, -40]]) {
        SN.cityPart(g, "stone", px, 0.3, pz, 3.6, 0.6, 3.6);
        SN.cityPart(g, "grass", px, 0.68, pz, 3.1, 0.4, 3.1);
      }
      for (const [bx, bz, bk] of [[78, -13, "red"], [78, 13, "teal"], [78, -21, "gold"]]) {
        SN.cityPart(g, "silver", bx, 4, bz, 0.12, 8, 0.12);
        SN.cityPart(g, bk, bx - 0.7, 6.4, bz, 1.3, 2.4, 0.06);
      }
      // Street lamps on the two long edges. Their glow sprites are queued here
      // and created in phase 18: the shared glow material does not exist yet
      // while the props phase is building.
      SN.hongdaeLampGlows = [];
      for (const x of [-72, -36, 0, 36, 72])
        for (const z of [-38, 38]) {
          SN.cityPart(g, "dark", x, 2.9, z, 0.18, 5.8, 0.18);
          SN.cityPart(g, "warmLamp", x, 5.85, z, 0.9, 0.34, 0.9);
          SN.cityPart(g, "dark", x, 6.06, z, 1.0, 0.1, 1.0);
          SN.hongdaeLampGlows.push([g.position.x + x, g.position.y + 5.85, g.position.z + z]);
        }
      // Corner trees soften the hard edge of the plaza.
      for (const [tx, tz] of [[-77, -41], [77, -41], [-77, 41], [77, 41]]) {
        const ty = g.position.y + 0.05;
        SN.addProp(tx, tz, 0.9, 0.9, 6.8);
        SN.record(SN.trunkBatch, tx, ty + 3.4, tz, 0.5, 6.8, 0.5);
        for (let i = 0; i < 3; i++) {
          const a = i * SN.TAU / 3;
          SN.record(SN.leafBatch, tx + Math.sin(a) * 1.3, ty + 6.7 + i * 0.5, tz + Math.cos(a) * 1.3, 3.1, 3.2, 3, a, [0x7d9c80, 0x8aab84, 0xa3bb8e][i]);
        }
        SN.record(SN.leafBatch, tx, ty + 5.4, tz, 3.9, 2.3, 3.7, SN.rand(0, SN.TAU), 0x6c8e68);
      }
      for (let i = 0; i < 9; i++)
        SN.cityPart(g, "red", -64 + i * 16, 0.65, 25, 6, 0.3, 1.5);
      SN.cityLabel(g, "홍대 · 여울음 무대", -36, 36);
      SN.finishCityGroup(g);
    }
    {
      const g = SN.cityGroup(-1900, -1130, 2000);
      for (const x of [-135, 135]) {
        SN.cityPart(g, "brick", x, 13, 0, 45, 26, 210);
        SN.cityWindows(g, x, 0, 45, 210, 26);
        SN.citySolid(g, x, 0, 45, 210, 26);
      }
      SN.cityPart(g, "cream", 0, 15, -100, 245, 30, 40);
      SN.citySolid(g, 0, -100, 245, 40, 30);
      SN.cityPart(g, "grass", 0, 0.1, 0, 195, 0.2, 120);
      SN.cityPart(g, "stone", 0, 0.3, 0, 12, 0.4, 165);
      SN.cityPart(g, "gold", 0, 12, -65, 4, 24, 4);
      SN.cityLabel(g, "솔여울 배움뜰 · 新村学园", 110, 65);
      SN.finishCityGroup(g);
    }
    // Yeouido civic hall: low open colonnade and offset copper dome, never a replica.
    {
      const g = SN.cityGroup(-1350, 335, 2800);
      SN.cityPart(g, "stone", 0, 10, 0, 140, 20, 75);
      SN.cityPart(g, "glass", 0, 12, 39, 125, 12, 1);
      for (let x = -65; x <= 65; x += 13)
        SN.cityPart(g, "cream", x, 15, 48, 3, 30, 3);
      SN.cityPart(g, "cream", 0, 30, 35, 150, 2, 35);
      SN.cityPart(g, "teal", -18, 35, -6, 43, 23, 32, 0, new SN.T.SphereGeometry(1, 24, 12, 0, SN.TAU, 0, SN.PI / 2));
      SN.cityPart(g, "gold", -18, 60, -6, 1.2, 18, 1.2);
      SN.citySolid(g, 0, 0, 140, 75, 35);
      SN.cityLabel(g, "여의도 · 시민의회", 53, 52);
      SN.finishCityGroup(g);
    }
    {
      const g = SN.cityGroup(-500, 520, 3200);
      SN.cityPart(g, "goldFacade", 0, 110, 0, 1, 1, 1, 0, SN.roundedBox(52, 220, 36, 4));
      for (let y = 5; y < 215; y += 3.4)
        for (const side of [-1, 1])
          SN.cityPart(g, "dark", 0, y, side * 18.05, 47, 0.28, 0.16);
      SN.cityPart(g, "gold", 0, 5, 0, 72, 10, 42);
      SN.citySolid(g, 0, 0, 80, 38, 225);
      SN.cityLabel(g, "63빌딩 · 63 大厦", 28, 37);
      SN.finishCityGroup(g);
    }
    // Convention / mall courts, express terminal and Jamsil sports park.
    {
      const g = SN.cityGroup(1760, 1330, 2600);
      SN.cityPart(g, "glass", 0, 16, 0, 265, 32, 180);
      // Scale is applied before rotation: a barrel lying along z needs its length
      // in h and its radius in w/d, or it becomes a 380 m cream wall.
      for (let i = 0; i < 5; i++)
        SN.cityPart(g, "cream", -112 + i * 56, 36.6, 0, 17.5, 190, 4.6, 0, new SN.T.CylinderGeometry(1, 1, 1, 6), SN.PI / 2);
      SN.cityPart(g, "teal", 0, 5, 93, 235, 10, 8);
      SN.cityWindows(g, 0, 0, 265, 180, 32);
      SN.citySolid(g, 0, 0, 265, 180, 40);
      // 겹빛 몰: a grand glass entrance, an escalator stair down to a paved
      // forecourt, and a fountain court with kiosks so the mall has a real front
      // instead of ending at a blank wall.
      SN.cityPart(g, "stone", 0, 0.12, 128, 170, 0.24, 62);
      SN.cityPart(g, "stone", 0, 0.28, 128, 60, 0.08, 56);
      for (const side of [-1, 1]) {
        SN.cityPart(g, "gold", side * 44, 13, 99, 5, 26, 5);
        SN.cityPart(g, "cream", side * 44, 27, 99, 7, 3, 7);
        SN.citySolid(g, side * 44, 99, 5, 5, 29);
      }
      SN.cityPart(g, "cream", 0, 27, 99, 93, 4, 8);
      SN.cityPart(g, "glass", 0, 12, 97, 76, 24, 1);
      SN.cityPart(g, "dark", 0, 5, 96.5, 18, 10, 1);
      SN.cityPart(g, "glass", 0, 24.8, 112, 96, 0.8, 30);
      // Ribs under the glass canopy: without them the 30 m awning reads as a
      // floating pale sheet from the forecourt.
      for (let i = -3; i <= 3; i++)
        SN.cityPart(g, "silver", i * 14, 24.34, 112, 0.5, 0.5, 30);
      SN.cityPart(g, "silver", 0, 24.34, 126.7, 96, 0.55, 0.55);
      SN.cityPart(g, "gold", 0, 30.2, 99, 100, 2.2, 1.2);
      SN.cityPart(g, "curtain", 76, 20, 90.6, 56, 14, 0.5);
      SN.cityPart(g, "curtain", -76, 20, 90.6, 56, 14, 0.5);
      for (const x of [-100, -88, 88, 100])
        SN.cityPart(g, "cream", x, 16, 90.8, 3, 32, 1.4);
      for (const side of [-1, 1])
        SN.cityPart(g, "silver", side * 47, 12, 126, 0.8, 24, 0.8);
      for (let i = 0; i < 6; i++)
        SN.cityPart(g, "stone", 0, 0.28 + i * 0.4, 108 - i * 2.4, 46 - i * 3, 0.4, 2.4);
      SN.cityPart(g, "teal", 0, 0.62, 131, 25, 0.06, 17, 0, new SN.T.CylinderGeometry(1, 1, 1, 32));
      SN.cityPart(g, "stone", 0, 0.32, 131, 28, 0.62, 20, 0, new SN.T.CylinderGeometry(1, 1, 1, 32));
      // A live water disc and a cluster of jets: the bare teal cylinder read as
      // an empty blue plate from the forecourt.
      const fountainWater = SN.meshAt(new SN.T.CylinderGeometry(1, 1, 1, 32), SN.waterMat,
        0, 0.66, 131, 12.6, 0.02, 12.6, 0, g);
      fountainWater.castShadow = false;
      const jetMat = new SN.T.MeshBasicMaterial({
        color: 0xd8f4ff, transparent: true, opacity: 0.26,
        blending: SN.T.AdditiveBlending, depthWrite: false, side: SN.T.DoubleSide
      });
      for (const [dx, dz, h, r] of [[0, 0, 5.6, 0.3], [2.3, 0, 3.8, 0.18], [-2.3, 0, 3.8, 0.18], [0, 2.1, 3.8, 0.18], [0, -2.1, 3.8, 0.18]]) {
        const jet = new SN.T.Mesh(new SN.T.CylinderGeometry(r, r * 0.45, h, 8, 1, true), jetMat);
        jet.position.set(dx, 0.66 + h / 2, 131 + dz);
        g.add(jet);
      }
      SN.cityPart(g, "gold", 0, 4.6, 131, 0.9, 8.6, 0.9);
      SN.cityPart(g, "gold", 0, 8.6, 131, 3.2, 1.1, 3.2, SN.PI / 4, SN.box);
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const x = side * (36 + i * 9), z = 118 + i * 10;
        SN.cityPart(g, "dark", x, 1.15, z, 6.4, 2.3, 3.8);
        SN.cityPart(g, "cream", x, 2.15, z - 1.92, 6, 0.7, 0.08);
        SN.cityPart(g, "red", x, 2.55, z, 7.2, 0.22, 4.6);
        SN.cityPart(g, "cream", x, 2.75, z, 7.6, 0.18, 5);
        SN.citySolid(g, x, z, 7.6, 5, 3.4);
      }
      for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
        const x = side * (16 + i * 8), z = 146;
        SN.cityPart(g, "wood", x, 0.62, z, 3.4, 0.16, 0.8);
        SN.cityPart(g, "wood", x, 1.02, z - 0.35, 3.4, 0.7, 0.12);
        SN.cityPart(g, "dark", x, 0.3, z, 0.16, 0.6, 0.6);
      }
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const x = side * (68 + i * 4), z = 120 + i * 12;
        SN.cityPart(g, "cream", x, 0.75, z, 2.2, 1.5, 2.2);
        SN.cityPart(g, "teal", x, 1.62, z, 2.4, 0.3, 2.4);
      }
      SN.citySolid(g, 0, 131, 28, 20, 1.2);
      // Forecourt furniture: bollards along the street edge and shin-high
      // planters with clipped shrubs frame the fountain.
      for (let i = -5; i <= 5; i++) {
        SN.cityPart(g, "dark", i * 15, 0.45, 156, 0.5, 0.9, 0.5);
        SN.cityPart(g, "gold", i * 15, 0.92, 156, 0.58, 0.1, 0.58);
      }
      for (const x of [-40, 40]) {
        SN.cityPart(g, "stone", x, 0.55, 146, 4.4, 1.1, 3.2);
        SN.cityPart(g, "grass", x, 1.16, 146, 4, 0.14, 2.8);
        SN.cityPart(g, "grass", x, 1.95, 146, 2.6, 1.5, 2.2, 0, new SN.T.SphereGeometry(1, 8, 6));
        SN.citySolid(g, x, 146, 4.4, 3.2, 2.4);
      }
      // One entrance sign only: two labels at the same depth overlapped into
      // unreadable double lettering.
      SN.cityLabel(g, "겹빛몰 · 대형상가 大商场", 104, 46);
      SN.finishCityGroup(g);
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++)
          SN.tree(1760 + side * (84 + i * 6), 1330 + 142 + i * 8, false, 0.9);
    }
    {
      const g = SN.cityGroup(770, 1510, 1800);
      SN.cityPart(g, "cream", 0, 8, 0, 210, 16, 70);
      SN.cityPart(g, "glass", 0, 9, 36, 195, 10, 1);
      for (let i = 0; i < 12; i++) {
        const x = -99 + i * 18;
        SN.cityPart(g, "stone", x, 0.2, 58, 12, 0.4, 35);
        SN.cityPart(g, "teal", x, 5, 54, 14, 0.6, 34);
        SN.cityPart(g, "dark", x, 2, 60, 2, 4, 0.4);
      }
      SN.cityWindows(g, 0, 0, 210, 70, 16);
      SN.citySolid(g, 0, 0, 210, 70, 16);
      SN.cityLabel(g, "고속버스 · 江南客运站", 40, 70);
      SN.finishCityGroup(g);
    }
    {
      const g = SN.cityGroup(2740, 1390, 3900);
      const tower = new SN.T.CylinderGeometry(0.05, 1, 1, 8, 1);
      SN.cityPart(g, "curtain", 0, 205, 0, 43, 410, 33, SN.PI / 8, tower);
      for (const side of [-1, 1]) {
        SN.cityPart(g, "silver", side * 16, 200, 0, 1.1, 390, 1.1, side * SN.PI / 2, SN.box, -0.08);
        SN.cityPart(g, "silver", 0, 200, side * 12, 1.1, 390, 1.1, 0, SN.box, -side * 0.06);
      }
      SN.cityPart(g, "silver", -2.6, 411, 0, 1.4, 35, 1.4);
      SN.cityPart(g, "silver", 2.6, 411, 0, 1.4, 35, 1.4);
      SN.citySolid(g, 0, 0, 85, 60, 400);
      SN.cityPart(g, "stone", 0, 0.1, 80, 200, 0.2, 80);
      SN.cityLabel(g, "롯데월드타워 · 乐天世界塔", 45, 50);
      SN.finishCityGroup(g);
    }
    {
      const g = SN.cityGroup(2260, 1300, 2900);
      for (let i = 0; i < 44; i++) {
        const a = i * SN.TAU / 44, x = Math.sin(a) * 130, z = Math.cos(a) * 93;
        SN.cityPart(g, i % 3 ? "cream" : "teal", x, 14, z, 21, 27, 28, a);
        SN.cityPart(g, "white", x, 30, z, 24, 2, 40, a);
        SN.citySolid(g, x, z, 17, 19, 27);
      }
      SN.cityPart(g, "grass", 0, 0.2, 0, 155, 0.3, 95);
      for (const z of [-46, 46])
        SN.cityPart(g, "white", 0, 0.4, z, 150, 0.15, 0.3);
      for (const x of [-75, 75])
        SN.cityPart(g, "white", x, 0.4, 0, 0.3, 0.15, 92);
      SN.cityPart(g, "white", 0, 0.4, 0, 0.3, 0.15, 92);
      for (const x of [-115, 115])
        for (const z of [-80, 80]) {
          SN.cityPart(g, "dark", x, 30, z, 1, 60, 1);
          SN.cityPart(g, "light", x, 60, z, 10, 3, 1);
        }
      SN.cityLabel(g, "잠실 · 열린경기장", 115, 60);
      SN.finishCityGroup(g);
    }
    {
      const lake = SN.meshAt(new SN.T.CircleGeometry(1, 64), SN.waterMat, SN.lakePark.x, -0.55, SN.lakePark.z, SN.lakePark.rx, SN.lakePark.rz, 1);
      lake.rotation.x = -SN.PI / 2;
      lake.castShadow = false;
      for (let i = 0; i < 72; i++) {
        const a = i * SN.TAU / 72, x = SN.lakePark.x + Math.cos(a) * 171, z = SN.lakePark.z + Math.sin(a) * 117;
        SN.record(SN.sideBatch, x, 0.1, z, 15, 0.3, 15);
        if (i % 3 === 0)
          SN.tree(x + Math.cos(a) * 15, z + Math.sin(a) * 15, false, 1.15);
      }
    }
    // Converted Seongsu workshops: sawtooth roofs, loading docks, café courtyards.
    for (let i = 0; i < 12; i++) {
      const x = 1540 + i % 4 * 145, z = -670 + Math.floor(i / 4) * 170;
      if (SN.onRoadway(x, z, 38))
        continue;
      const g = SN.cityGroup(x, z, 1500);
      SN.cityPart(g, "brick", 0, 5, 0, 65, 10, 55);
      for (let r = -2; r <= 2; r++) {
        SN.cityPart(g, "tile", r * 13, 12, 0, 9, 4, 39, SN.PI / 4, new SN.T.CylinderGeometry(0.1, 1, 1, 4));
        SN.cityPart(g, "glass", r * 13, 11, 28, 9, 2, 0.2);
      }
      SN.cityPart(g, "wood", 0, 0.5, 35, 70, 1, 14);
      SN.cityWindows(g, 0, 0, 65, 55, 10);
      SN.citySolid(g, 0, 0, 65, 55, 13);
      SN.cityLabel(g, ["벽돌숨 공방", "비늘빛 커피", "느린실 작업실"][i % 3], 28.5, 32);
      SN.finishCityGroup(g);
    }
    // Airport apron and terminal. The runway is deliberately long and unobstructed.
    {
      const g = SN.cityGroup(-3030, -1900, 3900, 0);
      SN.cityPart(g, "dark", -130, 0.02, 0, 52, 0.12, 2150);
      SN.cityPart(g, "stone", -65, -0.02, 0, 250, 0.08, 2300);
      SN.cityPart(g, "dark", 90, 0.06, 0, 24, 0.1, 2070);
      SN.cityPart(g, "stone", 275, 0.1, 0, 300, 0.2, 1100);
      for (let z = -1000; z <= 1000; z += 52) {
        SN.cityPart(g, "white", -130, 0.1, z, 0.8, 0.03, 24);
        for (const x of [-157, -103])
          SN.cityPart(g, "light", x, 0.15, z, 0.25, 0.18, 0.25);
      }
      for (const z of [-980, 980]) {
        for (let i = -4; i <= 4; i++)
          SN.cityPart(g, "white", -130 + i * 4, 0.12, z, 1.8, 0.03, 42);
        SN.cityPart(g, "white", -130, 0.12, z + Math.sign(z) * 45, 46, 0.03, 1);
      }
      for (const z of [-800, -400, 0, 400, 800]) {
        SN.cityPart(g, "dark", -20, 0.09, z, 240, 0.12, 21);
        SN.cityPart(g, "gold", -20, 0.17, z, 240, 0.03, 0.35);
      }
      SN.cityPart(g, "gold", 90, 0.15, 0, 0.4, 0.025, 2040);
      SN.cityPart(g, "cream", 390, 12, 0, 100, 24, 610);
      SN.cityPart(g, "glass", 338, 13, 0, 1, 15, 580);
      SN.cityPart(g, "teal", 390, 27, 0, 130, 5, 640);
      SN.citySolid(g, 390, 0, 100, 610, 30);
      for (let i = 0; i < 7; i++) {
        const z = -252 + i * 84;
        SN.cityPart(g, "cream", 292, 5, z, 95, 6, 9);
        SN.cityPart(g, "glass", 292, 5, z + 4.6, 85, 4, 0.2);
        SN.cityPart(g, "dark", 246, 3, z, 9, 6, 10);
        SN.citySolid(g, 292, z, 95, 9, 8);
        SN.cityPart(g, "gold", 217, 0.2, z, 35, 0.08, 0.45);
      }
      SN.cityPart(g, "stone", 470, 24, -420, 13, 48, 13);
      SN.cityPart(g, "glass", 470, 52, -420, 27, 9, 27);
      SN.cityPart(g, "teal", 470, 58, -420, 32, 3, 32);
      SN.cityPart(g, "gold", 470, 66, -420, 0.5, 14, 0.5);
      SN.citySolid(g, 470, -420, 32, 32, 60);
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 10; col++) {
          const x = 580 + col * 8, z = 200 + row * 12;
          SN.cityPart(g, "white", x, 0.2, z, 0.15, 0.05, 10);
          if ((row + col) % 3 === 0)
            SN.cityPart(g, ["teal", "white", "dark"][row % 3], x + 3, 1, z, 3, 2, 6);
        }
      SN.cityLabel(g, "김포공항 · 金浦机场", 312, 70);
      SN.finishCityGroup(g);
      // Runway numbers are local canvas drawings, laid flat on the asphalt.
      for (const [z, text] of [[-2850, "18"], [-950, "36"]]) {
        const m = SN.sign(text, -3160, 0.18, z, 19, 25);
        m.rotation.x = -SN.PI / 2;
      }
    }
    for (let i = 0; i < 6; i++) {
      const plane = SN.originalAirliner(-2815, -2150 + i * 84);
      plane.rotation.y = -SN.PI / 2;
    }
    SN.loopPlane = SN.originalAirliner(-3160, -2800, true);
    // Ferry stays inside the south channel, beneath every bridge deck.
    {
      const g = SN.cityGroup(0, 740, 1800, 0);
      SN.cityPart(g, "teal", 0, 0.5, 0, 13, 2, 39);
      SN.cityPart(g, "cream", 0, 3, 0, 11, 3, 29);
      SN.cityPart(g, "glass", 0, 4.3, 0, 10, 1.2, 24);
      SN.cityPart(g, "white", 0, 5.3, -2, 13, 0.6, 32);
      SN.cityPart(g, "gold", 0, 7, -9, 0.2, 3, 0.2);
      SN.finishCityGroup(g, true);
      SN.cityTransit.push({ kind: "ferry", root: g });
    }
    // Elevated metro crosses the east side of Cheongdam bridge; the train has four cars.
    {
      const g = SN.cityGroup(1924, 400, 2600, 0);
      SN.cityPart(g, "stone", 0, 17, 0, 9, 2, 1600);
      for (const side of [-1, 1])
        SN.cityPart(g, "dark", side * 1.8, 18.15, 0, 0.18, 0.3, 1600);
      for (let z = -750; z <= 750; z += 90)
        SN.cityPart(g, "stone", 0, 8, z, 3, 16, 5);
      SN.finishCityGroup(g);
    }
    {
      const g = SN.cityGroup(1924, 400, 2400, 18.3);
      for (let i = 0; i < 4; i++) {
        const z = i * 22;
        SN.cityPart(g, "cream", 0, 1.8, z, 3.4, 3.6, 20);
        SN.cityPart(g, "teal", 0, 1, z, 3.5, 0.6, 20.1);
        for (const side of [-1, 1])
          for (let w = -3; w <= 3; w++)
            SN.cityPart(g, "glass", side * 1.73, 2.2, z + w * 2.6, 0.1, 1.2, 1.8);
        SN.cityPart(g, "dark", 0, 0.1, z, 2.8, 0.5, 17);
      }
      SN.finishCityGroup(g, true);
      SN.cityTransit.push({ kind: "train", root: g });
    }
    // Cable line follows Namsan's western climb; paired cabins reverse at stations.
    SN.cableStart = new SN.T.Vector3(-320, 12, -520);
    SN.cableEnd = new SN.T.Vector3(-38, SN.hillHeight(-38, -340) + 23, -340);
    {
      const g = SN.cityGroup(0, 0, 1800, 0),
        cable = new SN.T.BufferGeometry().setFromPoints([SN.cableStart, SN.cableEnd]),
        line = new SN.T.Line(cable, new SN.T.LineBasicMaterial({ color: 0x435158 }));
      g.add(line);
      for (const p of [SN.cableStart, SN.cableEnd]) {
        SN.cityPart(g, "stone", p.x, p.y - 5, p.z, 14, 3, 12);
        SN.cityPart(g, "teal", p.x, p.y + 2, p.z, 17, 1, 14);
        SN.cityPart(g, "dark", p.x, p.y / 2, p.z, 1, p.y, 1);
      }
      SN.finishCityGroup(g);
    }
    for (let i = 0; i < 2; i++) {
      const g = SN.cityGroup(-320, -520, 1700, 0);
      SN.cityPart(g, "teal", 0, -3, 0, 3, 2.5, 3);
      SN.cityPart(g, "glass", 0, -2, 0, 2.8, 1.6, 2.8);
      SN.cityPart(g, "dark", 0, 0, 0, 0.2, 3, 0.2);
      SN.finishCityGroup(g, true);
      SN.cityTransit.push({ kind: "cable", root: g, phase: i });
    }
    SN.cableTarget = null;
    SN.cableRide = null;
    SN.cableStations = [
      { x: SN.cableStart.x, z: SN.cableStart.z, name: "南山缆车 · 山下站", ride: SN.cableStart },
      { x: SN.cableEnd.x, z: SN.cableEnd.z, name: "南山缆车 · 山顶站", ride: SN.cableEnd }
    ];
    for (const station of SN.cableStations) {
      const label = SN.cityGroup(station.x, station.z, 700);
      SN.cityLabel(label, "남산 케이블카 · 南山缆车", -8, 12, 0);
      SN.finishCityGroup(label);
    }
    // Stair entrances are real stepped surfaces descending from a raised landing.
    for (const d of SN.cityDistricts) {
      const x = d.travel[0] - 25, z = d.travel[1] - 21;
      if (SN.isWater(x, z) || SN.blocked(x, z, 8))
        continue;
      const g = SN.cityGroup(x, z, 850);
      for (let i = 0; i < 9; i++)
        SN.cityPart(g, "stone", 0, 1.8 - i * 0.2, -5 + i * 1.1, 6, 3.6 - i * 0.4, 1.1);
      for (const side of [-1, 1])
        SN.cityPart(g, "dark", side * 3.5, 2.6, 0, 0.2, 1.3, 11);
      SN.cityPart(g, "teal", 0, 5, 4, 8, 1, 3);
      SN.cityPart(g, "dark", 0, 1.8, 5, 6, 3.6, 0.5);
      SN.cityLabel(g, d.ko + " · 지하철", -5, 13);
      SN.finishCityGroup(g);
      SN.subwayStops.push({ x, z, label: d.name });
      SN.rasterSurface(x - 3, x + 3, z - 5, z + 5, () => true, (px, pz) => g.position.y + SN.clamp(3.6 - (pz - z + 5) * 0.36, 0, 3.6), 3);
    }
    SN.trunkMat = SN.pbrMat("wood", 0xc8a482, { uvScale: 1.1, roughness: 1, metalness: 0, envMapIntensity: 0.2 });
    SN.foliageFocus = { value: new SN.T.Vector3() };
    SN.leafMat = SN.pbrMat("grass", 0xffffff, { uvScale: 0.4, flatShading: true, roughness: 1, metalness: 0, envMapIntensity: 0.25, emissive: 0x355d45, emissiveIntensity: 0.18 });
    const leafCompile = SN.leafMat.onBeforeCompile;
    SN.leafMat.customProgramCacheKey = () => "foliage-camera-corridor-v2";
    SN.leafMat.onBeforeCompile = shader => {
      leafCompile(shader);
      shader.uniforms.uFoliageFocus = SN.foliageFocus;
      shader.fragmentShader = "varying vec3 vPbrWorld; uniform vec3 uFoliageFocus;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <alphatest_fragment>", `#include <alphatest_fragment>
        vec3 boom = uFoliageFocus - cameraPosition;
        float along = clamp(dot(vPbrWorld - cameraPosition, boom) / max(dot(boom, boom), .01), 0., 1.);
        float corridor = length(vPbrWorld - cameraPosition - boom * along);
        float keep = min(smoothstep(1.1, 2.1, corridor), smoothstep(1.5, 2.6, distance(vPbrWorld, cameraPosition)));
        float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (dither > mix(.03, 1., keep)) discard;`);
    };
    SN.poleMat = SN.pbrMat("metal", 0x768688, { uvScale: 0.6, metalness: 0.55, roughness: 0.62 });
    SN.lampGlow = SN.pbrMat("paint", 0xfff0d0, { uvScale: 0.8, emissive: 0xffd791, emissiveIntensity: 0, roughness: 0.4 });
    SN.staticCityTiles(SN.asphalt, SN.roadBatch, 1650, 240, false, false);
    SN.staticCityTiles(SN.sidewalk, SN.sideBatch, 1650, 240, false, false);
    SN.staticCityTiles(SN.stripeMat, SN.markBatch, 900, 240, false, false);
    SN.staticCityTiles(SN.manholeMat, SN.manholeBatch, 900, 240, false, false);
    SN.staticCityTiles(SN.curbMat, SN.curbBatch, 1000, 240, false, false);
    for (let i = 0; i < SN.buildingMats.length; i++)
      SN.staticCityTiles(SN.buildingMats[i], SN.buildingBatches[i].map(b => ({ ...b, g: SN.urbanBlockGeo })));
    SN.staticCityTiles(SN.buildingMats[1], SN.urbanShells);
    SN.staticCityTiles(SN.cityPalette.cream, SN.urbanRoofParts);
    SN.staticCityTiles(SN.pbrMat("concrete", 0x9ca49a, { uvScale: 0.22, roughness: 1, metalness: 0.03 }), SN.roofBatch);
    SN.buildInstances(SN.cylinder, SN.trunkMat, SN.trunkBatch);
    SN.buildInstances(SN.leafGeo, SN.leafMat, SN.leafBatch.concat(SN.willowBatch));
    SN.buildInstances(SN.box, SN.poleMat, SN.lampBatch);
    SN.buildInstances(SN.box, SN.lampGlow, SN.lampHeadBatch, false);
    SN.buildInstances(SN.box, SN.stoneMat, SN.railBatch, false);
    SN.buildInstances(SN.box, SN.pbrMat("wood", 0xb89270, { uvScale: 0.8, roughness: 1, metalness: 0.02 }), SN.benchBatch);
    SN.foamMat = new SN.T.MeshBasicMaterial({
      color: 0xdaf2e9,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: SN.T.AdditiveBlending
    });
    SN.buildInstances(SN.box, SN.foamMat, SN.foamBatch, false);
    // Pooled sodium/LED points snap to the nearest real lamp heads: 3 on 高, 2 on 中.
    SN.streetLights = [
      new SN.T.PointLight(0xffbe78, 0, 32, 2),
      new SN.T.PointLight(0xffcf96, 0, 28, 2),
      new SN.T.PointLight(0xcfe4ff, 0, 24, 2)
    ];
    for (const l of SN.streetLights) {
      l.castShadow = false;
      SN.scene.add(l);
    }
    // Grass tufts are a single instanced draw, recycled around the player and only on 高.
    SN.tuftGeo = SN.merged([
      { g: SN.box, x: 0, y: 0.22, z: 0, sx: 0.045, sy: 0.44, sz: 0.045 },
      { g: SN.box, x: 0, y: 0.18, z: 0, sx: 0.04, sy: 0.36, sz: 0.04, ry: 1.05 },
      { g: SN.box, x: 0, y: 0.16, z: 0, sx: 0.038, sy: 0.32, sz: 0.038, ry: 2.1 }
    ]);
    SN.groundDetails = new SN.T.InstancedMesh(SN.tuftGeo, SN.mat(0xffffff, { roughness: 1 }), 150);
    SN.groundDetails.instanceMatrix.setUsage(SN.T.DynamicDrawUsage);
    SN.groundDetails.frustumCulled = false;
    SN.groundDetails.count = 0;
    SN.scene.add(SN.groundDetails);
    SN.detailX = 1000000000;
    SN.detailZ = 1000000000;
    SN.glowCanvas = document.createElement("canvas");
    SN.glowCanvas.width = 64;
    SN.glowCanvas.height = 64;
    SN.glowCtx = SN.glowCanvas.getContext("2d");
    SN.grad = SN.glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    SN.grad.addColorStop(0, "rgba(255,218,146,.6)");
    SN.grad.addColorStop(0.4, "rgba(255,211,130,.25)");
    SN.grad.addColorStop(1, "rgba(255,211,130,0)");
    SN.glowCtx.fillStyle = SN.grad;
    SN.glowCtx.fillRect(0, 0, 64, 64);
    SN.poolGeo = new SN.T.PlaneGeometry(1, 1);
    SN.poolGeo.rotateX(-SN.PI / 2);
    SN.poolMat = new SN.T.MeshBasicMaterial({
      map: SN.canvasTexture(SN.glowCanvas),
      transparent: true,
      depthWrite: false,
      blending: SN.T.AdditiveBlending,
      opacity: 0
    });
    for (let i = 0; i < SN.poolBatch.length; i++) {
      SN.poolBatch[i].sz = SN.poolBatch[i].sy;
      SN.poolBatch[i].sy = 1;
    }
    SN.buildInstances(SN.poolGeo, SN.poolMat, SN.poolBatch, false);
  });
  // Startup phase 18.5: the plaza lamp halos, once the shared glow material exists.
  SN.registerInit(18.5, function initializePlazaGlows() {
    for (const p of SN.hongdaeLampGlows || [])
      SN.glow(SN.scene, p[0], p[1], p[2], 1.45, 0xffd9a0);
    SN.hongdaeLampGlows = null;
  });
  // Startup phase 12: keep this order relative to the other systems.

  SN.registerInit(12, function initializeProps12() {
    // Ground-floor shopfronts get a real display window with shelves, a backing
    const banners = [], bannerTexture = SN.textTexture("서울 · 한강", "#e54330", "#fff2be", 128, 256);
    const bannerMaterial = SN.mat(0xffffff, { map: bannerTexture, roughness: 1, side: SN.T.DoubleSide });
    for (let i = 0; i < SN.lampPoints.length; i += 13) {
      const lamp = SN.lampPoints[i];
      SN.record(banners, lamp.x + 0.55, lamp.y - 2.6, lamp.z, 1, 2.2, 1, i % 2 ? SN.PI / 2 : 0);
    }
    SN.detailTiles(SN.detailPlaneGeo, bannerMaterial, banners, false);
    // Bus shelters: merged once per material, with a lit route board facing the kerb.
    SN.busMetalParts = [];
    SN.busGlassParts = [];
    SN.busBenchParts = [];
    SN.busSigns = [];
    SN.busStops = [];
    SN.busStopCount = 0;
    for (const road of SN.roads) {
      if (road.bridge || road.width < 24 || SN.busStopCount >= 14)
        continue;
      for (let j = 0; j < road.points.length - 1 && SN.busStopCount < 14; j++) {
        const a = road.points[j], b = road.points[j + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 70)
          continue;
        const tx = dx / len, tz = dz / len, nx = dz / len, nz = -dx / len;
        for (let t = 85; t < len - 45 && SN.busStopCount < 14; t += 290) {
          const side = (SN.busStopCount % 2) ? 1 : -1,
            off = road.width * 0.5 + 2.05,
            x = a[0] + tx * t + nx * off * side,
            z = a[1] + tz * t + nz * off * side;
          if (SN.isWater(x, z, 3) || SN.inPalace(x, z, 4) || SN.blocked(x, z, 1.8))
            continue;
          const y = SN.surfaceHeight(x, z),
            yaw = Math.atan2(-nx * side, -nz * side),
            sx = x + nx * side * 0.8,
            sz = z + nz * side * 0.8;
          SN.busMetalParts.push({ g: SN.box, x, y: y + 2.58, z, sx: 4.6, sy: 0.14, sz: 1.95, ry: yaw });
          for (const e of [-1, 1])
            for (const n of [0.78, -0.08]) {
              SN.busMetalParts.push({
                g: SN.box,
                x: x + Math.cos(yaw) * e * 2.18 + nx * side * n,
                y: y + 1.3,
                z: z - Math.sin(yaw) * e * 2.18 + nz * side * n,
                sx: 0.1,
                sy: 2.6,
                sz: 0.1,
                ry: yaw
              });
            }
          SN.busGlassParts.push({ g: SN.box, x: sx, y: y + 1.38, z: sz, sx: 4.28, sy: 2.35, sz: 0.07, ry: yaw });
          for (const e of [-1, 1])
            SN.busGlassParts.push({
              g: SN.box,
              x: x + Math.cos(yaw) * e * 2.16 + nx * side * 0.38,
              y: y + 1.38,
              z: z - Math.sin(yaw) * e * 2.16 + nz * side * 0.38,
              sx: 0.07,
              sy: 2.3,
              sz: 1.7,
              ry: yaw
            });
          SN.busBenchParts.push({ g: SN.box, x: x + nx * side * 0.42, y: y + 0.44, z: z + nz * side * 0.42, sx: 2.9, sy: 0.12, sz: 0.52, ry: yaw });
          SN.busBenchParts.push({ g: SN.box, x: x + nx * side * 0.12, y: y + 0.22, z: z + nz * side * 0.12, sx: 2.7, sy: 0.34, sz: 0.32, ry: yaw });
          SN.busSigns.push({
            x: x + nx * side * 0.55,
            y: y + 1.95,
            z: z + nz * side * 0.55,
            sx: 2,
            sy: 0.66,
            sz: 1,
            yaw: Math.atan2(-nx * side, -nz * side)
          });
          SN.addOBB(x + nx * side * 0.78, z + nz * side * 0.78, 4.3, 0.18, 2.3, yaw);
          SN.addOBB(x + nx * side * 0.4, z + nz * side * 0.4, 2.9, 0.55, 0.75, yaw);
          SN.busStops.push({ x, z, yaw, tx, tz, roadX: a[0] + tx * t, roadZ: a[1] + tz * t, side });
          SN.busStopCount++;
        }
      }
    }
    for (const pair of [
      [SN.busMetalParts, SN.detailMetal],
      [SN.busGlassParts, SN.detailGlassMat],
      [SN.busBenchParts, SN.mat(0x826d52, { roughness: 0.82 })]
    ]) {
      SN.staticCityTiles(pair[1], pair[0], 120, 48, true, pair[1] !== SN.detailGlassMat);
    }
    if (SN.busSigns.length) {
      const busSignTex = SN.textTexture("버스 · 公交", "#173c43", "#d8ffe9", 256, 64);
      const busSignMat = SN.mat(0xffffff, {
        map: busSignTex,
        emissive: 0xffffff,
        emissiveMap: busSignTex,
        emissiveIntensity: 0.55,
        side: SN.T.DoubleSide
      });
      SN.detailTiles(SN.detailPlaneGeo, busSignMat, SN.busSigns, false);
    }
    // Bollards, crossing signals, bins and vending machines.
    SN.bollardPosts = [];
    SN.bollardBands = [];
    for (const corner of SN.crossingCorners) {
      const bx = corner.x + Math.cos(corner.yaw) * 0.7, bz = corner.z - Math.sin(corner.yaw) * 0.7;
      if (SN.isWater(bx, bz, 1) || SN.inPalace(bx, bz, 1) || SN.onRoadway(bx, bz, 0.35) || SN.blocked(bx, bz, 0.5))
        continue;
      const by = SN.surfaceHeight(bx, bz);
      SN.record(SN.bollardPosts, bx, by + 0.42, bz, 0.26, 0.84, 0.26, 0);
      SN.record(SN.bollardBands, bx, by + 0.64, bz, 0.29, 0.09, 0.29, 0);
    }
    SN.detailTiles(SN.cylinder, SN.detailMetal, SN.bollardPosts, false);
    SN.detailTiles(SN.cylinder, SN.mat(0xd9d8c7, { roughness: 0.6 }), SN.bollardBands, false);
    SN.signalPoles = [];
    SN.signalHeads = [];
    for (const signal of SN.trafficSignals) {
      const x = signal.poleX, z = signal.poleZ, y = SN.surfaceHeight(x, z);
      if (SN.isWater(x, z, 0.3) || SN.blocked(x, z, 0.3) || SN.inDrivingLane(x, z, 1)) continue;
      SN.record(SN.signalPoles, x, y + 1.7, z, 0.16, 3.4, 0.16);
      SN.record(SN.signalHeads, x, y + 3.08, z + 0.02, 0.34, 0.72, 0.3, signal.yaw);
      SN.addCollider(x, z, 0.2, 0.2, 3.4);
    }
    SN.detailTiles(SN.cylinder, SN.detailMetal, SN.signalPoles, false);
    SN.detailTiles(SN.box, SN.detailDark, SN.signalHeads, false);
    SN.binBodies = [];
    SN.binLids = [];
    for (let i = 0; i < SN.shopFronts.length; i += 5) {
      const front = SN.shopFronts[i], side = (i % 2) ? 1 : -1, tx = Math.cos(front.yaw), tz = -Math.sin(front.yaw);
      const x = front.x + front.nx * 1 + tx * side * front.w * 0.32, z = front.z + front.nz * 1 + tz * side * front.w * 0.32;
      if (SN.blocked(x, z, 0.55))
        continue;
      const y = SN.surfaceHeight(x, z);
      SN.record(SN.binBodies, x, y + 0.42, z, 0.62, 0.84, 0.62, 0);
      SN.record(SN.binLids, x, y + 0.87, z, 0.68, 0.08, 0.68, 0);
      SN.addCollider(x, z, 0.58, 0.58, 0.9);
    }
    SN.detailTiles(SN.cylinder, SN.mat(0x3e5a4f, { roughness: 0.8 }), SN.binBodies, false);
    SN.detailTiles(SN.cylinder, SN.detailDark, SN.binLids, false);
    SN.vendingBodies = [];
    SN.vendingFronts = [];
    SN.vendingGlow = [];
    for (let i = 2; i < SN.shopFronts.length; i += 7) {
      const front = SN.shopFronts[i], side = (i % 2) ? 1 : -1, tx = Math.cos(front.yaw), tz = -Math.sin(front.yaw);
      const x = front.x + front.nx * 1.15 + tx * side * front.w * 0.26,
        z = front.z + front.nz * 1.15 + tz * side * front.w * 0.26;
      if (SN.blocked(x, z, 0.7))
        continue;
      const y = SN.surfaceHeight(x, z);
      SN.record(SN.vendingBodies, x, y + 0.95, z, 0.95, 1.9, 0.7, front.yaw, [0x5a8fa0, 0xb05a52, 0x5e7a54][i % 3]);
      SN.record(SN.vendingFronts, x + front.nx * 0.37, y + 1.08, z + front.nz * 0.37, 0.74, 1.35, 1, front.yaw);
      SN.record(SN.vendingGlow, x + front.nx * 0.5, y + 1.08, z + front.nz * 0.5, 1.2, 1.7, 1, front.yaw, 0xffe2b0);
      SN.addCollider(x, z, 0.95, 0.7, 1.9);
    }
    SN.detailTiles(SN.box, SN.mat(0xffffff, { roughness: 0.55, metalness: 0.25 }), SN.vendingBodies, false);
    SN.detailTiles(SN.detailPlaneGeo, SN.detailVendingFront, SN.vendingFronts, false);
    SN.detailTiles(SN.detailPlaneGeo, SN.detailNeonGlowMat, SN.vendingGlow, false);
    // Road surface storytelling: manholes, painted arrows, scuffs and old patches.
    SN.manholes = [];
    SN.laneArrows = [];
    SN.wornMarks = [];
    SN.roadPatches = [];
    SN.arrowGeo = SN.merged([
      { g: SN.box, x: 0, y: 0, z: -0.2, sx: 0.26, sy: 0.025, sz: 2.4 },
      { g: new SN.T.CylinderGeometry(0.02, 0.62, 0.04, 3), x: 0, y: 0, z: 1.18, ry: SN.PI }
    ]);
    for (const road of SN.roads.filter(r => !r.pedestrian))
      for (let j = 0; j < road.points.length - 1; j++) {
        const a = road.points[j],
          b = road.points[j + 1],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz),
          yaw = Math.atan2(dx, dz),
          nx = dz / len,
          nz = -dx / len;
        for (let t = 18; t < len - 10; t += 37) {
          if (SN.rnd() < 0.42)
            continue;
          const off = SN.rand(-road.width * 0.32, road.width * 0.32),
            x = a[0] + dx * t / len + nx * off,
            z = a[1] + dz * t / len + nz * off;
          SN.record(SN.manholes, x, SN.surfaceHeight(x, z) + 0.012, z, 0.5, 0.03, 0.5, SN.rnd() * SN.TAU);
        }
        for (let t = 42; t < len - 22; t += 64) {
          for (const lane of road.lanes >= 2 ? [-road.laneOffset, road.laneOffset] : [0]) {
            const x = a[0] + dx * t / len + nx * lane, z = a[1] + dz * t / len + nz * lane;
            SN.record(SN.laneArrows, x, SN.surfaceHeight(x, z) + 0.018, z, 1, 1, 1, yaw + (lane > 0 ? SN.PI : 0));
          }
        }
        for (let t = 9; t < len - 4; t += 17) {
          if (SN.rnd() < 0.55)
            continue;
          const off = SN.rand(-road.width * 0.4, road.width * 0.4),
            x = a[0] + dx * t / len + nx * off,
            z = a[1] + dz * t / len + nz * off;
          SN.record(SN.wornMarks, x, SN.surfaceHeight(x, z) + 0.008, z, 0.1, 0.012, SN.rand(1.4, 4.2), yaw);
        }
        for (let t = 25; t < len - 14; t += 56) {
          if (SN.rnd() < 0.6)
            continue;
          const off = SN.rand(-road.width * 0.36, road.width * 0.36),
            x = a[0] + dx * t / len + nx * off,
            z = a[1] + dz * t / len + nz * off;
          SN.record(SN.roadPatches, x, SN.surfaceHeight(x, z) + 0.006, z, SN.rand(1.2, 3.4), 0.01, SN.rand(2, 6), SN.rand(0, SN.TAU));
        }
      }
    SN.detailTiles(SN.cylinder, SN.mat(0x454c4b, { metalness: 0.5, roughness: 0.6 }), SN.manholes, false);
    SN.detailTiles(SN.arrowGeo, SN.mat(0xddd9c4, { roughness: 0.9 }), SN.laneArrows, false);
    SN.detailTiles(SN.box, SN.mat(0xc7c4b2, { transparent: true, opacity: 0.34, roughness: 1, depthWrite: false }), SN.wornMarks, false, 100, 1);
    SN.detailTiles(SN.box, SN.mat(0x353d3f, { transparent: true, opacity: 0.27, roughness: 1, depthWrite: false }), SN.roadPatches, false, 100, 1);
    // Stone embankment walls along both Han river banks.
    SN.bankStones = [];
    SN.bankPalette = [0x8d8f84, 0x9a9a8b, 0x7f857d, 0xa5a294, 0x929487];
    for (let x = -1240; x < 1240; x += 3.2) {
      let nearBridge = false;
      for (const b of SN.bridges)
        if (Math.abs(x - b.x) < b.w * 0.5 + 2)
          nearBridge = true;
      if (nearBridge)
        continue;
      const zn = SN.riverNorth(x),
        zs = SN.riverSouth(x),
        yawN = Math.atan2(3.2, SN.riverNorth(x + 3.2) - zn),
        yawS = Math.atan2(3.2, SN.riverSouth(x + 3.2) - zs);
      for (let row = 0; row < 3; row++) {
        SN.record(SN.bankStones, x + SN.rand(-0.4, 0.4), -0.3 + row * 0.34, zn - 0.85 - row * 0.24, 1, 0.66, 3.1, yawN, SN.bankPalette[Math.floor(SN.rnd() * SN.bankPalette.length)]);
        SN.record(SN.bankStones, x + SN.rand(-0.4, 0.4), -0.3 + row * 0.34, zs + 0.85 + row * 0.24, 1, 0.66, 3.1, yawS, SN.bankPalette[Math.floor(SN.rnd() * SN.bankPalette.length)]);
      }
    }
    SN.detailTiles(SN.box, SN.mat(0xffffff, { roughness: 0.95 }), SN.bankStones, false);
    // Painted steel arches sit outside the pedestrian rails of the three central bridges.
    const bridgeArches = [];
    for (const b of SN.bridges) {
      if (![-780, -130, 560].includes(b.x)) continue;
      const z0 = b.z0 + 280, span = b.z1 - b.z0 - 560, half = (b.w - 9) * 0.5;
      const color = b.x === -130 ? 0xde6041 : b.x === 560 ? 0x28a8b7 : 0x519fe5;
      for (const side of [-1, 1]) {
        const x = b.x + side * (half + 4.4);
        for (let i = 0; i < 20; i++) {
          const za = z0 + span * i / 20, zb = z0 + span * (i + 1) / 20;
          const ya = SN.bridgeProfile(b, za) + 1.4 + Math.sin(i / 20 * SN.PI) * 26;
          const yb = SN.bridgeProfile(b, zb) + 1.4 + Math.sin((i + 1) / 20 * SN.PI) * 26;
          SN.record(bridgeArches, x, (ya + yb) / 2, (za + zb) / 2, 0.7, 0.7, Math.hypot(zb - za, yb - ya) + 0.1, 0, color);
          bridgeArches[bridgeArches.length - 1].pitch = -Math.atan2(yb - ya, zb - za);
          if (i % 2 === 0) {
            const base = SN.bridgeProfile(b, za) + 1;
            SN.record(bridgeArches, x, (base + ya) / 2, za, 0.16, ya - base, 0.16, 0, color);
          }
        }
      }
    }
    SN.staticCityTiles(SN.mat(0xffffff, { roughness: 0.5, metalness: 0.3 }), bridgeArches, 1800, 180, false, false);
    // Bridge rails get upright posts and a warm reflector cap every few bays.
    SN.bridgePosts = [];
    SN.bridgeCaps = [];
    for (const b of SN.bridges) {
      const half = (b.w - 9) * 0.5;
      for (let z = b.z0 + 3; z < b.z1 - 2; z += 5.5) {
        const yc = SN.bridgeProfile(b, z);
        for (const s of [-1, 1]) {
          SN.record(SN.bridgePosts, b.x + s * (half - 0.45), yc + 0.9, z, 0.14, 1.8, 0.14, 0, 0x3c4849);
          SN.record(SN.bridgePosts, b.x + s * (half + 4.05), yc + 0.65, z, 0.065, 1.3, 0.065, 0, 0x3c4849);
          if (Math.round((z - b.z0) / 5.5) % 5 === 0)
            SN.record(SN.bridgeCaps, b.x + s * (half - 0.45), yc + 1.82, z, 0.2, 0.2, 0.2, 0);
        }
      }
    }
    SN.detailTiles(SN.box, SN.mat(0xffffff, { roughness: 0.6, metalness: 0.3 }), SN.bridgePosts, false);
    SN.detailTiles(SN.box, SN.lampGlow, SN.bridgeCaps, false);
    // Urban infrastructure: gutters, tree pits and tiled pavements share PBR surfaces.
    SN.urbanPaving = [];
    SN.urbanGutters = [];
    SN.urbanDrains = [];
    SN.urbanUtility = [];
    SN.urbanWires = [];
    SN.urbanAwning = [];
    SN.urbanTables = [];
    SN.urbanSeats = [];
    SN.urbanScooters = [];
    SN.urbanStalls = [];
    SN.urbanStallMetal = [];
    SN.urbanStallCloth = [];
    SN.pavingMaterial = SN.pbrMat("tile", 0xcfc6b4, { uvScale: 2, roughness: 1, metalness: 0.02 });
    SN.drainGeo = SN.merged(Array.from({ length: 9 }, (_, i) => ({ g: SN.box, x: 0, y: 0, z: -0.36 + i * 0.09, sx: 0.42, sy: 0.035, sz: 0.035 })));
    SN.pitGeo = SN.merged([
      { g: SN.box, x: -0.78, y: 0, z: 0, sx: 0.12, sy: 0.12, sz: 1.65 },
      { g: SN.box, x: 0.78, y: 0, z: 0, sx: 0.12, sy: 0.12, sz: 1.65 },
      { g: SN.box, x: 0, y: 0, z: -0.78, sx: 1.65, sy: 0.12, sz: 0.12 },
      { g: SN.box, x: 0, y: 0, z: 0.78, sx: 1.65, sy: 0.12, sz: 0.12 }
    ]);
    SN.treePits = [];
    SN.treeSoil = [];
    for (const trunk of SN.trunkBatch)
      if (SN.surfaceTypeAt(trunk.x, trunk.z) === 1) {
        const y = SN.surfaceHeight(trunk.x, trunk.z);
        SN.record(SN.treePits, trunk.x, y + 0.02, trunk.z, 1, 1, 1);
        SN.record(SN.treeSoil, trunk.x, y + 0.016, trunk.z, 1.44, 0.018, 1.44);
      }
    for (const road of SN.roads) {
      if (road.bridge || /江边北路|奥林匹克|匝道/.test(road.name))
        continue;
      for (let j = 1; j < road.points.length; j++) {
        const a = road.points[j - 1],
          b = road.points[j],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz),
          tx = dx / len,
          tz = dz / len,
          nx = tz,
          nz = -tx,
          yaw = Math.atan2(dx, dz);
        let previousPole = null;
        for (let t = 4; t < len - 4; t += 4)
          for (const side of [-1, 1]) {
            const x = a[0] + tx * t + nx * (road.width / 2 + 0.3 + (road.sidewalkW || 3.5) / 2) * side,
              z = a[1] + tz * t + nz * (road.width / 2 + 0.3 + (road.sidewalkW || 3.5) / 2) * side;
            if (SN.onRoadway(x, z, 0.12) || SN.isWater(x, z))
              continue;
            SN.record(SN.urbanPaving, x, SN.roadHeight(x, z) + 0.357, z, road.sidewalkW || 3.5, 0.014, 3.98, yaw);
            const gx = a[0] + tx * t + nx * (road.width / 2 - 0.18) * side,
              gz = a[1] + tz * t + nz * (road.width / 2 - 0.18) * side;
            SN.record(SN.urbanGutters, gx, SN.roadHeight(gx, gz) + 0.175, gz, 0.28, 0.012, 4, yaw);
            if (Math.round(t / 4) % 7 === 1)
              SN.record(SN.urbanDrains, gx, SN.roadHeight(gx, gz) + 0.195, gz, 1, 1, 1, yaw);
          }
        if (road.width <= 22)
          for (let t = 16; t < len - 8; t += 32) {
            const x = a[0] + tx * t + nx * (road.width / 2 + (road.sidewalkW || 3.5) * 0.72),
              z = a[1] + tz * t + nz * (road.width / 2 + (road.sidewalkW || 3.5) * 0.72);
            if (SN.onRoadway(x, z, 0.2) || SN.blocked(x, z, 0.45) || SN.isWater(x, z)) {
              previousPole = null;
              continue;
            }
            const y = SN.surfaceHeight(x, z);
            SN.record(SN.urbanUtility, x, y + 4.5, z, 0.18, 9, 0.18, yaw);
            SN.record(SN.urbanUtility, x, y + 8.2, z, 1.7, 0.13, 0.13, yaw);
            SN.record(SN.urbanUtility, x + 0.12, y + 6.8, z, 0.42, 1, 0.42, yaw);
            SN.addCollider(x, z, 0.35, 0.35, 9);
            if (previousPole)
              for (const wire of [-0.56, 0, 0.56])
                SN.cableSpan(previousPole.x + nx * wire, previousPole.y + 8.45, previousPole.z + nz * wire, x + nx * wire, y + 8.45, z + nz * wire, 1.05);
            previousPole = { x, y, z };
          }
      }
    }
    SN.staticCityTiles(SN.pavingMaterial, SN.urbanPaving, 120, 48, true, false);
    SN.staticCityTiles(SN.curbMat, SN.urbanGutters, 120, 48, true, false);
    SN.detailTiles(SN.drainGeo, SN.darkMat, SN.urbanDrains);
    SN.detailTiles(SN.pitGeo, SN.curbMat, SN.treePits);
    SN.detailTiles(SN.box, SN.trunkMat, SN.treeSoil);
    SN.detailTiles(SN.cylinder, SN.detailConcrete, SN.urbanUtility);
    SN.staticCityTiles(SN.darkMat, SN.urbanWires, 120, 48, true, false);
    // Small plastic furniture and unbranded delivery scooters are reusable models.
    SN.tableGeo = SN.merged([
      { g: SN.cylinder, x: 0, y: 0.72, z: 0, sx: 0.54, sy: 0.045, sz: 0.54 },
      ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ g: SN.box, x: x * 0.31, y: 0.35, z: z * 0.31, sx: 0.045, sy: 0.7, sz: 0.045 })))
    ]);
    SN.chairGeo = SN.merged([
      { g: SN.box, x: 0, y: 0.43, z: 0, sx: 0.42, sy: 0.06, sz: 0.42 },
      { g: SN.box, x: 0, y: 0.67, z: -0.19, sx: 0.42, sy: 0.45, sz: 0.06 },
      ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ g: SN.box, x: x * 0.16, y: 0.2, z: z * 0.16, sx: 0.035, sy: 0.4, sz: 0.035 })))
    ]);
    SN.scooterBodyGeo = SN.merged([
      { g: SN.box, x: 0, y: 0.36, z: 0, sx: 0.36, sy: 0.12, sz: 1.2 },
      { g: SN.box, x: 0, y: 0.7, z: 0.4, sx: 0.46, sy: 0.7, sz: 0.22, rx: -0.18 },
      { g: SN.box, x: 0, y: 0.72, z: -0.3, sx: 0.42, sy: 0.16, sz: 0.66 },
      { g: SN.box, x: 0, y: 1.03, z: -0.6, sx: 0.48, sy: 0.48, sz: 0.44 },
      { g: SN.box, x: 0, y: 1.15, z: 0.47, sx: 0.67, sy: 0.055, sz: 0.06 }
    ]);
    SN.scooterWheelGeo = SN.merged([
      { g: SN.cylinder, x: 0, y: 0.25, z: 0.63, sx: 0.25, sy: 0.12, sz: 0.25, rz: SN.PI / 2 },
      { g: SN.cylinder, x: 0, y: 0.25, z: -0.62, sx: 0.25, sy: 0.12, sz: 0.25, rz: SN.PI / 2 }
    ]);
    for (const spec of SN.shopSpecs) {
      const yaw = { south: 0, north: SN.PI, east: SN.PI / 2, west: -SN.PI / 2 }[spec.side],
        nx = Math.sin(yaw),
        nz = Math.cos(yaw),
        tx = Math.cos(yaw),
        tz = -Math.sin(yaw),
        x = spec.x + nx * spec.depth / 2,
        z = spec.z + nz * spec.depth / 2,
        y = SN.groundHeight(x, z);
      SN.record(SN.urbanAwning, x + nx * 0.75, y + 3.1, z + nz * 0.75, spec.front + 0.2, 0.16, 1.65, yaw, 0xf6a335);
      SN.urbanAwning[SN.urbanAwning.length - 1].pitch = 0.12;
      for (const side of [-1, 1]) {
        const px = x + tx * side * 4 + nx * 1.25, pz = z + tz * side * 4 + nz * 1.25;
        if (SN.onRoadway(px, pz, 0.7) || SN.blocked(px, pz, 0.65))
          continue;
        SN.record(SN.urbanTables, px, y + 0.35, pz, 1, 1, 1, yaw, 0xc7bca2);
        SN.addCollider(px, pz, 1.05, 1.05, 1.1);
        for (const seat of [-1, 1])
          SN.record(SN.urbanSeats, px + tx * seat * 0.9, y + 0.35, pz + tz * seat * 0.9, 1, 1, 1, yaw + seat * SN.PI / 2, 0x6b928a);
      }
    }
    for (let i = 0; i < SN.shopFronts.length; i += 8) {
      const f = SN.shopFronts[i],
        x = f.x + f.nx * 1.2 + Math.cos(f.yaw) * f.w * 0.3,
        z = f.z + f.nz * 1.2 - Math.sin(f.yaw) * f.w * 0.3;
      if (SN.onRoadway(x, z, 0.85) || SN.blocked(x, z, 0.75))
        continue;
      SN.record(SN.urbanScooters, x, SN.surfaceHeight(x, z), z, 1, 1, 1, f.yaw + 0.55, [0x24b69b, 0xff8137, 0x317fdd][i % 3]);
      SN.addOBB(x, z, 0.65, 1.65, 1.25, f.yaw + 0.55);
    }
    // Human-scale pushcarts leave a continuous 3.6 m pedestrian route through Myeongdong.
    for (let i = 0; i < 13; i++) {
      const x = 305 + i * 18, z = -430 + (i % 2 ? 6.3 : -6.3), yaw = i % 2 ? SN.PI : 0;
      if (SN.blocked(x, z, 1.6) || SN.onRoadway(x, z, 0.2))
        continue;
      const y = SN.surfaceHeight(x, z);
      SN.record(SN.urbanStalls, x, y + 0.55, z, 2.1, 1.1, 1.15, yaw);
      const cloth = i % 2 ? 0xff8b2d : 0xe74332;
      SN.record(SN.urbanStallCloth, x, y + 2.22, z, 2.6, 0.14, 1.75, yaw, cloth);
      SN.record(SN.urbanStallCloth, x, y + 1.4, z - Math.cos(yaw) * 0.75, 2.6, 1.6, 0.04, yaw, cloth);
      for (const side of [-1, 1])
        SN.record(SN.urbanStallMetal, x + side * 0.95, y + 1.15, z, 0.045, 2.3, 0.045, yaw);
      for (let bowl = 0; bowl < 4; bowl++)
        SN.record(SN.urbanStallMetal, x - 0.7 + bowl * 0.45, y + 1.18, z, 0.26, 0.12, 0.3, yaw);
      SN.addOBB(x, z, 2.1, 1.15, 1.3, yaw);
    }
    SN.detailTiles(SN.tableGeo, SN.cityPalette.teal, SN.urbanTables);
    SN.detailTiles(SN.chairGeo, SN.cityPalette.teal, SN.urbanSeats);
    SN.detailTiles(SN.scooterBodyGeo, SN.mat(0xffffff, { roughness: 0.32, metalness: 0.22 }), SN.urbanScooters);
    SN.detailTiles(SN.scooterWheelGeo, SN.darkMat, SN.urbanScooters);
    SN.staticCityTiles(SN.laundryMat, SN.urbanAwning, 120, 48, true, false);
    SN.detailTiles(SN.box, SN.cityPalette.wood, SN.urbanStalls);
    SN.detailTiles(SN.box, SN.detailMetal, SN.urbanStallMetal);
    SN.detailTiles(SN.box, SN.laundryMat, SN.urbanStallCloth);
    // Tower forecourts have restrained paving bands, planters and low benches.
    SN.plazaParts = [];
    SN.plazaSeats = [];
    for (const b of SN.placedBuildings)
      if (b.era === "tower") {
        const f = SN.buildingFaces(b)[0], depth = 5.2, p = SN.lotPoint(b, 0, b.d / 2 + depth / 2 + 0.3);
        SN.record(SN.plazaParts, p.x, b.base + 0.26, p.z, b.w, 0.18, depth, b.yaw);
        for (const side of [-1, 1]) {
          const q = SN.lotPoint(b, side * (b.w / 2 - 2.6), b.d / 2 + 2.7);
          SN.record(SN.plazaSeats, q.x, b.base + 0.58, q.z, 2.8, 0.5, 0.75, b.yaw);
        }
      }
    SN.staticCityTiles(SN.stoneMat, SN.plazaParts, 650, 120, false, false);
    SN.detailTiles(SN.box, SN.cityPalette.wood, SN.plazaSeats);
    SN.staticCityTiles(SN.detailDark, SN.bridgeGirders, 1800, 180, false, true);
    // A continuous embankment, separated cycle lane and stair landings on both banks.
    SN.riverWalls = [];
    SN.cyclePaving = [];
    SN.cycleMarks = [];
    SN.riverRails = [];
    for (let x = -3400; x < 3400; x += 12)
      for (const side of [-1, 1]) {
        if (SN.bridges.some(b => Math.abs(x + 6 - b.x) < b.w / 2 + 8))
          continue;
        const shore = side < 0 ? SN.riverNorth : SN.riverSouth,
          z0 = shore(x),
          z1 = shore(x + 12),
          z = (z0 + z1) / 2,
          yaw = Math.atan2(12, z1 - z0);
        SN.rasterSurface(x, x + 12, Math.min(z0, z1) + side * 8 - 2, Math.max(z0, z1) + side * 8 + 2, (px, pz) => Math.abs(pz - shore(px) - side * 8) < 1.9, () => 0.31, 2);
        SN.record(SN.riverWalls, x + 6, -0.7, z, 1.2, 2.8, 12.1, yaw);
        SN.record(SN.cyclePaving, x + 6, 0.285, z + side * 8, 3.4, 0.05, 12.1, yaw, 0x76958a);
        SN.record(SN.cycleMarks, x + 6, 0.316, z + side * 8, 0.1, 0.015, 3, yaw);
        SN.record(SN.riverRails, x + 6, 1.05, z + side * 1.7, 0.055, 0.055, 12, yaw);
        for (let k = 0; k < 4; k++)
          SN.record(SN.riverRails, x + k * 3, 0.7, SN.lerp(z0, z1, k / 4) + side * 1.7, 0.055, 1.1, 0.055);
      }
    SN.staticCityTiles(SN.stoneMat, SN.riverWalls, 1300, 180, false, false);
    SN.staticCityTiles(SN.asphalt, SN.cyclePaving, 1100, 180, false, false);
    SN.staticCityTiles(SN.stripeMat, SN.cycleMarks, 500, 120, false, false);
    SN.staticCityTiles(SN.detailMetal, SN.riverRails, 120, 48, true, false);
    // Palace masonry courses, timber brackets and gate studs retain an open passage.
    SN.palaceMasonry = [];
    SN.palaceFittings = [];
    SN.palaceTiles = [];
    for (const wall of [
      [-300, -840, -19, -840],
      [19, -840, 320, -840],
      [-300, -1080, 320, -1080],
      [-300, -1080, -300, -840],
      [320, -1080, 320, -840]
    ]) {
      const [ax, az, bx, bz] = wall,
        len = Math.hypot(bx - ax, bz - az),
        dx = (bx - ax) / len,
        dz = (bz - az) / len,
        yaw = Math.atan2(dx, dz);
      for (let t = 1; t < len; t += 2.4) {
        for (let row = 0; row < 5; row++) {
          const along = Math.min(len - 1, t + (row % 2) * 1.1);
          SN.record(SN.palaceMasonry, ax + dx * along, 0.42 + row * 0.81, az + dz * along, 1.83, 0.76, 2.31, yaw, [0xc1b9a8, 0xd0c7b4, 0xb0aa9d][row % 3]);
        }
        SN.record(SN.palaceTiles, ax + dx * t, 4.57, az + dz * t, 2.3, 0.25, 2.38, yaw);
      }
    }
    for (const x of [-17, -11, -5, 5, 11, 17])
      for (const z of [-849, -831]) {
        SN.record(SN.palaceFittings, x, 8.7, z, 0.32, 2.3, 0.32);
        SN.record(SN.palaceFittings, x, 9.55, z, 2.4, 0.24, 0.7);
        SN.record(SN.palaceFittings, x, 9.1, z, 1.5, 0.24, 1.1);
      }
    for (const side of [-1, 1])
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 5; col++)
          SN.record(SN.palaceFittings, side * 6.5, 1.1 + row * 0.85, -850 + col * 1.2, 0.09, 0.09, 0.09);
    SN.staticCityTiles(SN.stoneMat, SN.palaceMasonry, 120, 48, true, false);
    SN.staticCityTiles(SN.cityPalette.tile, SN.palaceTiles, 600, 120, false, false);
    SN.staticCityTiles(SN.cityPalette.wood, SN.palaceFittings, 120, 48, true, false);
    // Contour-following stair flights have precise collision heights; retaining walls
    // sit below their treads and do not replace the existing driveable mountain road.
    SN.mountainSteps = [];
    SN.mountainWalls = [];
    SN.mountainRails = [];
    SN.mountainFlights = [];
    for (let flight = 0; flight < 6; flight++) {
      const radius0 = 238 - flight * 18,
        radius1 = radius0 - 18,
        from = flight % 2 ? 2.58 : 1.86,
        to = flight % 2 ? 1.86 : 2.58;
      for (let part = 0; part < 5; part++) {
        const t0 = part / 5,
          t1 = (part + 1) / 5,
          r0 = SN.lerp(radius0, radius1, t0),
          r1 = SN.lerp(radius0, radius1, t1),
          a0 = SN.lerp(from, to, t0),
          a1 = SN.lerp(from, to, t1),
          ax = Math.cos(a0) * r0,
          az = -340 + Math.sin(a0) * r0,
          bx = Math.cos(a1) * r1,
          bz = -340 + Math.sin(a1) * r1,
          dx = bx - ax,
          dz = bz - az,
          len = Math.hypot(dx, dz),
          yaw = Math.atan2(dx, dz),
          count = Math.ceil(len / 0.38),
          heights = [];
        if (SN.onRoadway((ax + bx) / 2, (az + bz) / 2, 5))
          continue;
        for (let step = 0; step < count; step++) {
          const t = (step + 0.5) / count, x = SN.lerp(ax, bx, t), z = SN.lerp(az, bz, t), y = SN.hillHeight(x, z) + 0.24;
          heights.push(y);
          SN.record(SN.mountainSteps, x, y - 0.14, z, 2.6, 0.28, len / count + 0.035, yaw);
          if (step % 5 === 0) {
            for (const side of [-1, 1]) {
              const px = x + dz / len * side * 1.6, pz = z - dx / len * side * 1.6;
              SN.record(SN.mountainWalls, px, y - 1.2, pz, 0.55, 2.4, len / count * 5 + 0.03, yaw);
              SN.record(SN.mountainRails, px, y + 0.5, pz, 0.05, 1, 0.05, yaw);
            }
          }
        }
        for (const side of [-1, 1]) {
          const rise = heights[heights.length - 1] - heights[0];
          SN.record(SN.mountainRails, (ax + bx) / 2 + dz / len * side * 1.6, (heights[0] + heights[heights.length - 1]) / 2 + 0.98, (az + bz) / 2 - dx / len * side * 1.6, 0.06, 0.06, Math.hypot(len, rise), yaw);
          SN.mountainRails[SN.mountainRails.length - 1].pitch = -Math.atan2(rise, len);
        }
        SN.mountainFlights.push({ ax, az, bx, bz, heights });
        SN.rasterSurface(Math.min(ax, bx) - 2, Math.max(ax, bx) + 2, Math.min(az, bz) - 2, Math.max(az, bz) + 2, (x, z) => SN.segmentDistance(x, z, ax, az, bx, bz) < 1.3, (x, z) => heights[SN.clamp(Math.floor(((x - ax) * dx + (z - az) * dz) / (len * len) * count), 0, count - 1)], 3);
      }
    }
    SN.staticCityTiles(SN.stoneMat, SN.mountainSteps, 800, 120, false, false);
    SN.staticCityTiles(SN.stoneMat, SN.mountainWalls, 900, 120, false, true);
    SN.detailTiles(SN.box, SN.detailMetal, SN.mountainRails);
  });
  SN.registerInit(17.5, function initializeStreetArt() {
    const panels = [], signs = [], metal = [], stone = [], fabric = [];
    const panel = (list, id, x, y, z, w, h, yaw = 0) => list.push({ g: SN.artAtlasGeos[id], x, y, z, sx: w, sy: h, sz: 1, yaw });
    // Route boards, line-colour pylons and bike racks share the sign atlas.
    for (const [i, stop] of SN.subwayStops.entries()) {
      const y = SN.surfaceHeight(stop.x, stop.z);
      SN.record(metal, stop.x + 4.2, y + 2.3, stop.z - 5, 0.18, 4.6, 0.18);
      panel(signs, 20 + i % 4, stop.x + 4.2, y + 4, stop.z - 5, 1.6, 1.3);
      panel(panels, 18, stop.x - 4, y + 1.5, stop.z - 5, 1.2, 1.6);
      for (let n = 0; n < 3; n++) {
        const x = stop.x + 6 + n * 1.1;
        for (const zz of [-0.35, 0.35]) SN.record(metal, x, y + 0.4, stop.z + zz, 0.07, 0.8, 0.07);
        SN.record(metal, x, y + 0.8, stop.z, 0.07, 0.07, 0.77);
      }
    }
    for (const stop of SN.busSigns) {
      panel(panels, 18, stop.x, stop.y - 1.1, stop.z + 0.06, 1.05, 1.35, stop.yaw);
    }
    // Low planter surrounds stop the street trees looking planted in asphalt.
    for (const t of SN.trunkBatch) {
      const road = SN.roadSample(t.x, t.z);
      if (!road || road.distance > road.profile.width / 2 + 5) continue;
      const y = SN.surfaceHeight(t.x, t.z);
      for (const side of [-1, 1]) {
        SN.record(stone, t.x + side * 0.8, y + 0.2, t.z, 0.16, 0.4, 1.7);
        SN.record(stone, t.x, y + 0.2, t.z + side * 0.8, 1.7, 0.4, 0.16);
      }
    }
    // Sign gantries stay above vehicles and leave all pavement access clear.
    for (const road of SN.roads) {
      if (road.bridge || road.pedestrian || road.width < 24) continue;
      for (let n = 1; n < road.points.length; n++) {
        const a = road.points[n - 1], b = road.points[n], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
        if (length < 210) continue;
        const tx = dx / length, tz = dz / length, x = a[0] + tx * 100, z = a[1] + tz * 100;
        const y = SN.surfaceHeight(x, z), yaw = Math.atan2(tx, tz), off = road.width / 2 + 1;
        if (SN.blocked(x + tz * off, z - tx * off, 0.5)) continue;
        SN.record(metal, x + tz * off, y + 3.4, z - tx * off, 0.25, 6.8, 0.25);
        SN.record(metal, x + tz * off / 2, y + 6.65, z - tx * off / 2, off, 0.22, 0.22, yaw);
        panel(signs, 19, x + tz * 2, y + 6.2, z - tx * 2, 7, 1.75, yaw + SN.PI);
      }
    }
    // Actual shops retain their open door and interior; posters occupy only side glass.
    for (const spec of SN.allShopSpecs) {
      for (const side of [-1, 1]) {
        const p = SN.shopLocalPoint(spec, side * (spec.front * 0.5 - 1.1), -0.19);
        panel(panels, 24 + (side > 0 ? 1 : 0), p.x, spec.base + 1.65, p.z, 0.85, 1.05, spec.yaw);
        const shelf = SN.shopLocalPoint(spec, side * (spec.front * 0.5 - 1.4), 0.35);
        panel(panels, 16, shelf.x, spec.base + 1.15, shelf.z, 1.7, 1.4, spec.yaw);
      }
      const b = { x: spec.x, z: spec.z, w: spec.w, d: spec.d, base: spec.base, yaw: 0 };
      for (const f of SN.buildingFaces(b)) {
        if (f.nx * Math.sin(spec.yaw) + f.nz * Math.cos(spec.yaw) > 0.9) continue;
        SN.facadePart(panels, b, f, 0, spec.h - 0.45, 0.19, f.w - 0.2, 0.68, 1, null, SN.artAtlasGeos[3]);
        const bays = Math.max(1, Math.floor(f.w / 3.2));
        for (let n = 0; n < bays; n++)
          SN.facadePart(panels, b, f, (n + 0.5) * f.w / bays - f.w / 2, 1.55, 0.19, f.w / bays - 0.25, 1.8, 1, null, SN.artAtlasGeos[16]);
      }
    }
    // Pojangmacha roofs and valances sit over the existing market stalls.
    for (let i = 0; i < 12; i++) {
      const x = 900 + (i % 4 - 1.5) * 26, z = -590 + (Math.floor(i / 4) - 1) * 30;
      fabric.push({ g: SN.hanokArtGeo, x, y: 3.35, z, sx: 13.4, sy: 1.3, sz: 8.2, color: i % 2 ? 0xe76937 : 0xefb94a });
      panel(signs, i % 2 ? 5 : 0, x, 2.9, z + 4.2, 10.5, 0.8);
      for (const side of [-1, 1]) SN.record(fabric, x + side * 6, 1.9, z, 0.08, 2.5, 7, 0, 0xdd653d);
    }
    // Shallow Cheonggyecheon garden channel: interrupt the basin at existing roads.
    const water = [], ripple = [];
    for (let x = 100; x <= 1100; x += 12) {
      const z = -705;
      if (!SN.roadGap(x, z, 14, 12) || SN.blocked(x, z, 5)) continue;
      const y = SN.surfaceHeight(x, z);
      SN.record(water, x, y + 0.04, z, 12.1, 0.06, 7.5);
      for (const side of [-1, 1]) {
        SN.record(stone, x, y + 0.12, z + side * 4.5, 12.1, 0.24, 1.5);
        SN.record(stone, x, y + 0.03, z + side * 6.7, 12.1, 0.06, 2.9);
      }
      for (let n = 0; n < 3; n++) SN.record(ripple, x - 4 + n * 4, y + 0.09, z + Math.sin(x + n) * 2, 2, 0.025, 0.08);
      if (x % 60 === 40) for (let n = -2; n <= 2; n++) SN.record(stone, x, y + 0.14, z + n * 1.4, 1.5, 0.28, 1);
    }
    SN.cityArtStats.streamSections = water.length;
    SN.staticCityTiles(SN.mat(0x359da9, { roughness: 0.26, metalness: 0.25 }), water, 1500, 240, false, false);
    SN.staticCityTiles(SN.mat(0xb7ece4, { roughness: 0.4 }), ripple, 1000, 240, false, false);
    SN.sign("청계천 · 清溪川", 160, 2.1, -698, 7, 1.2);
    SN.staticCityTiles(SN.artSignMat, panels.concat(signs), 1200, 240, false, false);
    SN.staticCityTiles(SN.detailMetal, metal, 1000, 240, false, false);
    SN.staticCityTiles(SN.stoneMat, stone, 1000, 240, false, false);
    SN.staticCityTiles(SN.laundryMat, fabric, 1300, 240, false, false);
    // Banpo's arcs are one transparent ribbon mesh, without extra lights or particles.
    const jets = [], bridge = SN.bridges.find(b => b.name === "반포대교") || SN.bridges[0];
    for (let z = 170; z <= 740; z += 18) for (const side of [-1, 1]) {
      const x = bridge.x + side * (bridge.w / 2 + 0.3), y = SN.surfaceHeight(bridge.x, z) + 0.5;
      if (!SN.isWater(x + side * 15, z)) continue;
      const point = t => [x + side * 20 * t, y + Math.sin(t * SN.PI) * 6 - t * (y + 0.6), z];
      for (let n = 0; n < 12; n++) {
        const a = point(n / 12), b = point((n + 1) / 12), width = 0.18 + n * 0.025;
        jets.push(a[0], a[1], a[2] - width, a[0], a[1], a[2] + width, b[0], b[1], b[2] + width,
          a[0], a[1], a[2] - width, b[0], b[1], b[2] + width, b[0], b[1], b[2] - width);
      }
    }
    const geometry = new SN.T.BufferGeometry(); geometry.setAttribute("position", new SN.T.Float32BufferAttribute(jets, 3)); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    SN.banpoFountain = new SN.T.Mesh(geometry, new SN.T.MeshBasicMaterial({ color: 0x86d9ec, side: SN.T.DoubleSide, transparent: true, opacity: 0.6, depthWrite: false }));
    SN.scene.add(SN.banpoFountain);
  });
  // Small occupied plots use the same tiled materials as the surrounding street.
  SN.lookLotFree = function lookLotFree(x, z, yaw, w = 24, d = 22) {
    const district = SN.cityDistrictAt(x, z).id;
    if (SN.lookLots.filter(p => p.district === district && p.kind !== "camp").length >= 6 && Math.abs(z - SN.riverNorth(x)) > 60 && Math.abs(z - SN.riverSouth(x)) > 60) return null;
    if (!SN.zoneFree(x, z, 17) || SN.inPalace(x, z, 18) || SN.isWater(x, z, 18) ||
        (SN.ddpSite && Math.abs(x - SN.ddpSite.x) < SN.ddpSite.w / 2 + 36 && Math.abs(z - SN.ddpSite.z) < SN.ddpSite.d / 2 + 36) ||
        !SN.footprintFree(x, z, w + 2, d + 2, yaw) || !SN.roadGap(x, z, w + 2, d + 2, yaw) ||
        SN.lookLots.some(p => Math.hypot(p.x - x, p.z - z) < 56)) return null;
    const ground = SN.footprintTerrain(x, z, w, d, yaw), lot = { x, z, yaw, w, d, district };
    if (!ground.buildable || ground.high - ground.low > 0.45) return null;
    for (let u = -w / 2; u <= w / 2; u += 4)
      for (let v = -d / 2; v <= d / 2; v += 4) {
        const p = SN.lotPoint(lot, u, v);
        if (SN.blocked(p.x, p.z, 2.2) || SN.isWater(p.x, p.z)) return null;
      }
    lot.base = ground.high + 0.06;
    return lot;
  };

  SN.buildLookLot = function buildLookLot(lot, kind, batch) {
    lot.kind = kind; SN.lookLots.push(lot);
    const box = (list, u, y, v, w, h, d, color, geo = SN.box, pitch = 0) => {
      const p = SN.lotPoint(lot, u, v);
      list.push({ g: geo, x: p.x, y: lot.base + y, z: p.z, sx: w, sy: h, sz: d, yaw: lot.yaw, pitch, color });
    };
    const solid = (u, v, w, d, h) => {
      const p = SN.lotPoint(lot, u, v); SN.addOBB(p.x, p.z, w, d, h, lot.yaw, lot.base);
    };
    const seat = (u, v) => {
      box(batch.props, u, 0.52, v, 2.8, 0.15, 0.65, 0xb98654);
      box(batch.props, u, 0.94, v - 0.28, 2.8, 0.65, 0.1, 0xb98654);
      for (const side of [-1, 1]) box(batch.props, u + side, 0.24, v, 0.12, 0.48, 0.6, 0x364954);
      solid(u, v, 2.8, 0.7, 1.2);
    };
    const planting = kind === "park" || kind === "playground" || kind === "camp";
    box(planting ? batch.grass : batch.paving, 0, -0.06, 0, 24, 0.12, 22, planting ? 0x9fc47c : 0xd6d3c1);
    // Only the paving changes the walking surface; the plot centre stays traversable.
    const radius = 17, co = Math.cos(lot.yaw), si = Math.sin(lot.yaw);
    SN.rasterSurface(lot.x - radius, lot.x + radius, lot.z - radius, lot.z + radius,
      (x, z) => Math.abs((x - lot.x) * co - (z - lot.z) * si) < 12 && Math.abs((x - lot.x) * si + (z - lot.z) * co) < 11,
      () => lot.base, 2);
    const label = { parking: 26, park: 27, playground: 28, construction: 29, gas: 30, school: 31, camp: 27 }[kind];
    box(batch.signs, -8.5, 2.1, 9.3, 4.2, 1.1, 1, null, SN.artAtlasGeos[label]);
    box(batch.props, -8.5, 1, 9.2, 0.12, 2, 0.12, 0x465d62);
    if (planting) {
      for (const u of [-9, 9]) {
        const p = SN.lotPoint(lot, u, -7); SN.tree(p.x, p.z, false, 0.72);
      }
      box(batch.paving, 0, 0.018, 0, 3, 0.025, 22, 0xf0d8a8);
      seat(-6, 5); seat(6, 5);
    }
    if (kind === "parking" || kind === "gas") {
      for (let n = 0; n < 5; n++) {
        box(batch.paint, -9 + n * 3.6, 0.022, -5, 0.11, 0.025, 5.4, 0xf8e9ba);
        if (kind === "parking" && n === 1) {
          const p = SN.lotPoint(lot, -3.6, -5);
          SN.lookParking.push({ x: p.x, z: p.z, yaw: lot.yaw });
        }
      }
      if (kind === "gas") {
        box(batch.props, 0, 4.1, -3, 16, 0.32, 9, 0xf0e5c8);
        box(batch.props, 0, 4.12, 1.55, 16, 0.35, 0.12, 0x28b6ae);
        for (const u of [-6, 6]) {
          box(batch.props, u, 2, -3, 0.3, 4, 0.3, 0xebcf85); solid(u, -3, 0.35, 0.35, 4.2);
          box(batch.props, u, 0.8, -2.2, 0.75, 1.6, 0.55, 0x2caaa8);
          box(batch.props, u, 1.2, -1.9, 0.5, 0.4, 0.02, 0x173d49); solid(u, -2.2, 0.8, 0.65, 1.6);
        }
      }
    }
    if (kind === "construction") {
      for (let n = 0; n < 6; n++) {
        box(batch.props, -10 + n * 4, 1.2, -10, 3.8, 2.4, 0.12, n % 2 ? 0xf3bc49 : 0x406675);
        solid(-10 + n * 4, -10, 3.8, 0.2, 2.4);
      }
      for (let n = 0; n < 3; n++) box(batch.props, 5, 0.5 + n * 0.6, -5, 5 - n, 0.6, 4 - n, 0xc2a887);
      solid(5, -5, 5, 4, 2);
      for (const u of [-7.6, -6.4]) for (const v of [-4.6, -3.4]) box(batch.props, u, 12, v, 0.16, 24, 0.16, 0xf5be43);
      for (let n = 0; n < 12; n++) box(batch.props, -7, 1 + n * 2, -4, 1.5, 0.1, 1.5, 0xe8aa35);
      box(batch.props, 0, 23.2, -4, 18, 0.6, 1.2, 0xffc448);
      box(batch.props, -9, 22.5, -4, 3, 1.4, 2, 0x536371);
      box(batch.props, 7, 18, -4, 0.045, 10, 0.045, 0x425560);
      box(batch.props, 7, 13, -4, 0.6, 0.5, 0.45, 0xe8aa35); solid(-7, -4, 1.5, 1.5, 24);
    }
    if (kind === "school" || kind === "playground") {
      box(batch.paint, 0, 0.024, -2, 16, 0.03, 13, kind === "school" ? 0x438e88 : 0xe5a464);
      for (const s of [-1, 1]) {
        box(batch.paint, s * 7.5, 0.045, -2, 0.12, 0.015, 12, 0xffefd7);
        box(batch.paint, 0, 0.045, -2 + s * 6, 15, 0.015, 0.12, 0xffefd7);
      }
      if (kind === "school") {
        box(batch.paint, 0, 0.045, -2, 0.12, 0.015, 12, 0xffefd7);
        for (const s of [-1, 1]) {
          box(batch.props, s * 8.4, 1.7, -2, 0.12, 3.4, 0.12, 0xd3e2df); solid(s * 8.4, -2, 0.2, 0.2, 3.8);
          box(batch.props, s * 8, 3.1, -2, 0.12, 1.1, 1.8, 0xe3ded0);
          box(batch.props, s * 7.4, 2.85, -2, 0.75, 0.08, 0.7, 0xee9853);
        }
      } else {
        for (const u of [-5, -1]) box(batch.props, u, 1.8, -4, 0.16, 3.6, 0.16, 0x388fc2);
        box(batch.props, -3, 3.6, -4, 4.3, 0.16, 0.16, 0xffce50);
        for (const u of [-3.5, -2.5]) box(batch.props, u, 2, -4, 0.035, 3, 0.035, 0xd6ded5);
        box(batch.props, -3, 0.55, -4, 1.2, 0.13, 0.5, 0xf87856);
        box(batch.props, 5, 1.05, -3, 1.2, 0.12, 4, 0xffce50, SN.box, -0.5);
        box(batch.props, 5, 1.1, -5, 1.2, 2.2, 0.15, 0x31afa9); solid(5, -3, 1.3, 4, 2.2);
      }
    }
    if (kind === "camp" || kind === "park") {
      if (kind === "camp") for (const u of [-6, 6]) {
        box(batch.fabric, u, 1, -4, 4.2, 2, 3.3, u < 0 ? 0xf0b953 : 0x4fbbb2, SN.lookTentGeo);
        box(batch.props, u, 0.7, -2.33, 1.2, 1.4, 0.04, 0x263d54); solid(u, -4, 4.1, 3.2, 2.1);
        box(batch.fabric, u, 0.025, 0, 4, 0.025, 2.8, 0xead7af);
      }
      // An open kiosk counter; its awning is narrow and included in camera avoidance.
      box(batch.props, 8, 1, -8, 3.4, 2, 2.2, 0xf6e0ac); solid(8, -8, 3.4, 2.2, 2);
      box(batch.props, 8, 2.9, -8, 4.2, 0.14, 2.8, 0x32aa9d);
      box(batch.signs, 8, 2.55, -6.5, 3.5, 0.65, 1, null, SN.artAtlasGeos[24]);
    }
  };

  SN.buildRiverCyclists = function buildRiverCyclists() {
    SN.cycleRoutes = []; SN.cycleNearby = []; SN.cycleRefresh = -1; SN.cycleFrameTime = null;
    SN.cyclists = Array.from({ length: 8 }, (_, index) => ({ index, x: 0, y: 0, z: 0, active: false }));
    for (const side of [-1, 1]) {
      const shore = side < 0 ? SN.riverNorth : SN.riverSouth;
      let start = null;
      for (let x = -3300; x <= 3300; x += 4) {
        const z = shore(x) + side * 8;
        const free = !SN.bridges.some(b => Math.abs(x - b.x) < b.w / 2 + 12) &&
          !SN.blocked(x, z, 1.2) && !SN.isWater(x, z) && !SN.inDrivingLane(x, z, 1) && SN.surfaceHeight(x, z) < 1;
        if (free && start === null) start = x;
        if (start !== null && (!free || x - start >= 160 || x === 3300)) {
          if (x - start >= 56) SN.cycleRoutes.push({ x0: start + 3, x1: x - 7, side, x: (start + x) / 2, z: shore((start + x) / 2) + side * 8 });
          start = null;
        }
      }
    }
    const parts = [], add = (x, y, z, w, h, d, color, pitch = 0, geo = SN.box) => parts.push({ g: geo, x, y, z, sx: w, sy: h, sz: d, pitch, color });
    add(0, 0.64, 0, 0.07, 0.07, 1.2, 0x45d5c2);
    add(0, 0.67, -0.3, 0.07, 0.65, 0.07, 0xffd266, -0.4);
    add(0, 0.67, 0.5, 0.07, 0.65, 0.07, 0x45d5c2, -0.2);
    add(0, 0.62, 0.03, 0.07, 0.07, 0.95, 0x45d5c2, 0.55);
    add(0, 1.02, -0.35, 0.25, 0.07, 0.3, 0x293c4c);
    add(0, 1.12, 0.53, 0.55, 0.06, 0.07, 0xc6e3e5);
    add(0, 1.31, -0.12, 0.38, 0.53, 0.24, 0xf9b63e, 0.48);
    add(0, 1.69, 0.13, 0.25, 0.26, 0.24, 0xe5b793);
    add(0, 1.84, 0.12, 0.29, 0.12, 0.3, 0xe4f2eb);
    for (const s of [-1, 1]) add(s * 0.22, 1.3, 0.35, 0.095, 0.4, 0.1, 0xe5b793, -0.65);
    const geometry = SN.mergeCityGeometry({ entries: parts, geo: SN.box, cx: 0, cz: 0 });
    SN.cycleBodies = new SN.T.InstancedMesh(geometry, SN.mat(0xffffff, { vertexColors: true, roughness: 0.78 }), 8);
    const wheel = new SN.T.TorusGeometry(0.34, 0.045, 4, 12); wheel.rotateY(SN.PI / 2);
    SN.cycleWheels = new SN.T.InstancedMesh(wheel, SN.mat(0x26394a, { roughness: 0.9 }), 16);
    SN.cycleLegs = new SN.T.InstancedMesh(SN.box, SN.mat(0x356789, { roughness: 0.9 }), 32);
    for (const mesh of [SN.cycleBodies, SN.cycleWheels, SN.cycleLegs]) {
      mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false;
      mesh.instanceMatrix.setUsage(SN.T.DynamicDrawUsage); SN.scene.add(mesh);
    }
  };

  SN.renderRiverCyclists = function renderRiverCyclists() {
    if (!SN.cycleBodies) return;
    const dt = SN.cycleFrameTime === null ? 0 : SN.clamp(SN.renderTime - SN.cycleFrameTime, 0, 1);
    SN.cycleFrameTime = SN.renderTime;
    const px = SN.started ? SN.player.x : SN.camera.position.x, pz = SN.started ? SN.player.z : SN.camera.position.z;
    const limit = [2, 4, 8][SN.qualityLevel()], near = SN.cycleNearby;
    if (SN.renderTime >= SN.cycleRefresh) {
      SN.cycleRefresh = SN.renderTime + 0.5; near.length = 0;
      for (const route of SN.cycleRoutes) {
        route.distance = Math.hypot(route.x - px, route.z - pz);
        if (route.distance < 250) near.push(route);
      }
      near.sort((a, b) => a.distance - b.distance);
    }
    let count = 0, legs = 0;
    for (const rider of SN.cyclists) rider.active = false;
    for (let i = 0; i < Math.min(limit, near.length * 2); i++) {
      const route = near[Math.floor(i / 2)], shore = route.side < 0 ? SN.riverNorth : SN.riverSouth;
      const rider = SN.cyclists[i], length = route.x1 - route.x0;
      if (rider.route !== route) { rider.route = route; rider.travel = (SN.renderTime * 3.4 + i * 39) % (length * 2); rider.x = route.x0; rider.z = shore(route.x0) + route.side * 8; }
      const waiting = SN.started && Math.hypot(rider.x - px, rider.z - pz) < 2.6;
      if (!waiting) rider.travel = (rider.travel + dt * (3.4 + i % 2 * 0.5)) % (length * 2);
      const phase = rider.travel;
      const forward = phase < length, x = route.x0 + (forward ? phase : length * 2 - phase);
      const z = shore(x) + route.side * 8 + (forward ? 0.6 : -0.6), y = SN.surfaceHeight(x, z) + 0.025;
      if (Math.hypot(x - px, z - pz) > 210) continue;
      const yaw = Math.atan2(2, shore(x + 1) - shore(x - 1)) + (forward ? 0 : SN.PI), co = Math.cos(yaw), si = Math.sin(yaw);
      rider.x = x; rider.y = y; rider.z = z; rider.active = true;
      SN.dummy.position.set(x, y, z); SN.dummy.rotation.set(0, yaw, 0); SN.dummy.scale.set(1, 1, 1); SN.dummy.updateMatrix();
      SN.cycleBodies.setMatrixAt(count, SN.dummy.matrix);
      for (let side = -1; side <= 1; side += 2) {
        SN.dummy.position.set(x + si * side * 0.64, y + 0.35, z + co * side * 0.64);
        SN.dummy.updateMatrix(); SN.cycleWheels.setMatrixAt(count * 2 + (side > 0 ? 1 : 0), SN.dummy.matrix);
        const pedal = SN.renderTime * 6 + side * SN.PI;
        const kneeY = 0.85 + Math.sin(pedal) * 0.14, kneeZ = 0.18 + Math.cos(pedal) * 0.12;
        for (let j = 0; j < 2; j++) {
          const ay = j ? kneeY : 1.06, az = j ? kneeZ : -0.3;
          const by = j ? 0.48 + Math.sin(pedal) * 0.13 : kneeY, bz = j ? Math.cos(pedal) * 0.13 : kneeZ;
          const cy = (ay + by) / 2, cz = (az + bz) / 2;
          SN.dummy.position.set(x + co * side * 0.13 + si * cz, y + cy, z - si * side * 0.13 + co * cz);
          SN.dummy.rotation.set(Math.atan2(bz - az, by - ay), yaw, 0, "YXZ");
          SN.dummy.scale.set(0.13, Math.hypot(by - ay, bz - az), 0.13); SN.dummy.updateMatrix();
          SN.cycleLegs.setMatrixAt(legs++, SN.dummy.matrix);
        }
        SN.dummy.rotation.set(0, yaw, 0); SN.dummy.scale.set(1, 1, 1);
      }
      count++;
    }
    SN.cycleBodies.count = count; SN.cycleWheels.count = count * 2; SN.cycleLegs.count = legs;
    SN.cycleBodies.instanceMatrix.needsUpdate = true;
    SN.cycleWheels.instanceMatrix.needsUpdate = true;
    SN.cycleLegs.instanceMatrix.needsUpdate = true;
  };

  // Large open lawns used to be bare green plates. Walk a deterministic grid over
  // the city and give each suitable patch a grove, a bench and lamp, a picnic
  // blanket, a flower bed or a low hedge, so the grass reads as used parkland.
  SN.dressOpenLawns = function dressOpenLawns(batch) {
    SN.lawnSpots = [];
    const hash = (i, j, k) => {
      const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const part = (list, x, y, z, w, h, d, color, yaw = 0) =>
      list.push({ g: SN.box, x, y, z, sx: w, sy: h, sz: d, yaw, pitch: 0, color });
    for (let i = 0; i < 88; i++)
      for (let j = 0; j < 76; j++) {
        if (hash(i, j, 3) > 0.46)
          continue;
        const x = -2816 + i * 64 + (hash(i, j, 1) - 0.5) * 26;
        const z = -2432 + j * 64 + (hash(i, j, 2) - 0.5) * 26;
        if (SN.isWater(x, z, 5) || SN.onRoadway(x, z, 9) || SN.blocked(x, z, 2.6))
          continue;
        if (SN.surfaceTypeAt(x, z) !== 0)
          continue;
        if (x > -340 && x < 360 && z > -890 && z < -755)
          continue;
        if (Math.hypot(x - 2260, z - 1300) < 165)
          continue;
        const y = SN.surfaceHeight(x, z);
        if (!Number.isFinite(y) || Math.abs(SN.hillHeight(x, z) - SN.hillHeight(x + 6, z + 6)) > 1.6)
          continue;
        const roll = hash(i, j, 4), yaw = hash(i, j, 5) * SN.TAU;
        if (roll < 0.42) {
          SN.tree(x, z, false, 0.72 + hash(i, j, 6) * 0.4);
          if (hash(i, j, 7) < 0.62) {
            const a = hash(i, j, 8) * SN.TAU;
            SN.tree(x + Math.cos(a) * 4.6, z + Math.sin(a) * 4.6, false, 0.62 + hash(i, j, 9) * 0.3);
          }
        } else if (roll < 0.62) {
          // A bench facing the lawn, with a lamp beside it and a seat registered
          // so pedestrians in the crowd can actually stop and use it.
          part(batch.props, x, y + 0.44, z, 1.9, 0.12, 0.55, 0xb98654, yaw);
          part(batch.props, x - Math.sin(yaw) * 0.26, y + 0.8, z - Math.cos(yaw) * 0.26, 1.9, 0.5, 0.1, 0xb98654, yaw);
          part(batch.props, x, y + 0.21, z, 0.12, 0.42, 0.5, 0x364954, yaw);
          SN.benchSpots.push({ x, z, yaw });
          SN.addOBB(x, z, 1.9, 0.65, 1.05, yaw, y);
          const lx = x + Math.sin(yaw) * 2.6, lz = z + Math.cos(yaw) * 2.6;
          part(batch.props, lx, y + 1.5, lz, 0.12, 3, 0.12, 0x3d4b4a);
          part(batch.props, lx, y + 3.02, lz, 0.5, 0.18, 0.5, 0xe9d8a6);
        } else if (roll < 0.78) {
          part(batch.fabric, x, y + 0.035, z, 2.6, 0.04, 2.1, [0xd86f6f, 0xe3b04f, 0x5fa7b8][Math.floor(hash(i, j, 9) * 3)], yaw);
          part(batch.props, x + Math.cos(yaw) * 0.9, y + 0.24, z + Math.sin(yaw) * 0.9, 0.5, 0.3, 0.35, 0xc9a96a, yaw + 0.4);
        } else if (roll < 0.92) {
          for (let k = 0; k < 5; k++) {
            const a = k * SN.TAU / 5 + yaw;
            part(batch.grass, x + Math.sin(a) * 1.7, y + 0.2, z + Math.cos(a) * 1.7, 0.9, 0.3, 0.9,
              [0xe6a8b4, 0xe8cf78, 0xc78fce][k % 3], a);
          }
          part(batch.paving, x, y + 0.015, z, 5, 0.03, 5, 0xcfc9b4, yaw);
        } else {
          for (let k = 0; k < 3; k++) {
            const a = yaw + k * 1.3;
            part(batch.grass, x + Math.sin(a) * 2.6, y + 0.55, z + Math.cos(a) * 2.6, 2.4, 1.1, 1.1, 0x6f9b62, a);
          }
        }
        SN.lawnSpots.push({ x, z, y });
      }
  };

  SN.registerInit(17.6, function* initializeOccupiedLots() {
    SN.lookLots = []; SN.lookParking = [];
    SN.lookTentGeo = new SN.T.BufferGeometry();
    SN.lookTentGeo.setAttribute("position", new SN.T.Float32BufferAttribute([
      -.5, -.5, -.5, 0, .5, -.5, .5, -.5, -.5,
      .5, -.5, .5, 0, .5, .5, -.5, -.5, .5,
      -.5, -.5, .5, 0, .5, .5, 0, .5, -.5, -.5, -.5, .5, 0, .5, -.5, -.5, -.5, -.5,
      0, .5, .5, .5, -.5, .5, .5, -.5, -.5, 0, .5, .5, .5, -.5, -.5, 0, .5, -.5
    ], 3));
    SN.lookTentGeo.setAttribute("uv", new SN.T.Float32BufferAttribute(new Float32Array(36), 2));
    SN.lookTentGeo.computeVertexNormals(); SN.lookTentGeo.computeBoundingSphere();
    const batch = { props: [], paving: [], grass: [], paint: [], fabric: [], signs: [] };
    const trunkStart = SN.trunkBatch.length, leafStart = SN.leafBatch.length;
    const kinds = ["parking", "park", "playground", "construction", "gas", "school"];
    for (const road of SN.roads) {
      yield "填充街区空地";
      if (road.bridge || road.pedestrian || /机场|匝道|江边北路|奥林匹克/.test(road.name)) continue;
      for (let j = 1; j < road.points.length && SN.lookLots.length < 72; j++) {
        const a = road.points[j - 1], b = road.points[j], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 80) continue;
        const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
        for (let t = 40; t < length - 30 && SN.lookLots.length < 72; t += 145) {
          yield "补齐街角设施";
          for (const side of [-1, 1]) for (const setback of [20, 48, 78]) {
            const offset = road.width / 2 + (road.sidewalkW || 4) + setback;
            const lot = SN.lookLotFree(a[0] + tx * t + tz * offset * side, a[1] + tz * t - tx * offset * side, Math.atan2(tx, tz) - side * SN.PI / 2);
            if (lot) { SN.buildLookLot(lot, kinds[SN.lookLots.length % kinds.length], batch); break; }
          }
        }
      }
    }
    for (let x = -2700; x <= 2700; x += 180) {
      yield "汉江野餐与骑行";
      for (const side of [-1, 1]) {
        const shore = side < 0 ? SN.riverNorth : SN.riverSouth;
        const lot = SN.lookLotFree(x, shore(x) + side * 42, side < 0 ? 0 : SN.PI);
        if (lot) SN.buildLookLot(lot, "camp", batch);
      }
    }
    yield "铺设草坪设施";
    // Planting trees consumes the simulation's random stream; put the seed back
    // so colours and spawn choices later in the build stay as authored.
    const lawnSeed = SN.seed;
    SN.dressOpenLawns(batch);
    SN.seed = lawnSeed;
    SN.staticCityTiles(SN.detailConcrete, batch.props, 760, 240, false, false);
    SN.staticCityTiles(SN.sidewalk, batch.paving, 650, 240, false, false);
    SN.staticCityTiles(SN.laundryMat, batch.fabric, 500, 240, false, false);
    SN.staticCityTiles(SN.stripeMat, batch.paint, 500, 240, false, false);
    SN.staticCityTiles(SN.artSignMat, batch.signs, 650, 240, false, false);
    SN.staticCityTiles(SN.cityPalette.grass || SN.leafMat, batch.grass, 760, 240, false, false);
    SN.buildInstances(SN.cylinder, SN.trunkMat, SN.trunkBatch.slice(trunkStart));
    SN.buildInstances(SN.leafGeo, SN.leafMat, SN.leafBatch.slice(leafStart));
    SN.buildRiverCyclists();
  });
})(window.SN);
