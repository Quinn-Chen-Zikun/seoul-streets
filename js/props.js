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
        SN.record(SN.leafBatch, x + Math.sin(a) * 1.2 * scale, y + (6.1 + i * 0.45) * scale, z + Math.cos(a) * 1.2 * scale, 2.9 * scale, 3 * scale, 2.8 * scale, a, [0x668970, 0x719b78, 0x8ca67c][i]);
      }
      SN.record(SN.leafBatch, x + SN.rand(-0.4, 0.4) * scale, y + 4.9 * scale, z + SN.rand(-0.4, 0.4) * scale, 3.6 * scale, 2.1 * scale, 3.4 * scale, SN.rand(0, SN.TAU), 0x587a5a);
      SN.record(SN.leafBatch, x + SN.rand(-0.5, 0.5) * scale, y + 8.35 * scale, z + SN.rand(-0.5, 0.5) * scale, 2 * scale, 1.8 * scale, 1.9 * scale, SN.rand(0, SN.TAU), 0x8aa87e);
    }
  };

  SN.cityGroup = function cityGroup(x, z, range = 1900, y = null) {
    const g = new SN.T.Group();
    g.position.set(x, y === null ? SN.surfaceHeight(x, z) : y, z);
    g.userData.parts = new Map();
    g.userData.range = range;
    SN.scene.add(g);
    SN.cityLandmarks.push(g);
    return g;
  };

  SN.cityPart = function cityPart(g, key, x, y, z, w, h, d, yaw = 0, geo = SN.box, rx = 0) {
    if (!g.userData.parts.has(key))
      g.userData.parts.set(key, []);
    g.userData.parts.get(key).push({ g: geo, x, y, z, sx: w, sy: h, sz: d, ry: yaw, rx });
  };

  SN.finishCityGroup = function finishCityGroup(g) {
    const sites = g.userData.sites || [];
    if (sites.length) {
      let floor = g.position.y;
      for (const site of sites)
        floor = Math.max(floor, site.ground.high + 0.12);
      const lift = floor - g.position.y;
      g.position.y = floor;
      for (const site of sites) {
        site.collider.minY += lift;
        site.collider.height += lift;
        SN.addFoundation(site.x, site.z, site.w, site.d, 0, site.ground, floor);
        SN.authoredBuildingSites.push({ ...site, floor });
      }
    }
    for (const [key, parts] of g.userData.parts) {
      const m = new SN.T.Mesh(SN.merged(parts), SN.cityPalette[key]);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    delete g.userData.parts;
    return g;
  };

  SN.citySolid = function citySolid(g, x, z, w, d, h) {
    const px = g.position.x + x,
      pz = g.position.z + z,
      ground = SN.footprintTerrain(px, pz, w, d),
      collider = SN.addOBB(px, pz, w, d, h, 0, g.position.y);
    if (!g.userData.sites)
      g.userData.sites = [];
    g.userData.sites.push({ x: px, z: pz, w, d, ground, collider });
  };

  SN.cityLabel = function cityLabel(g, text, z, width = 30) {
    SN.sign(text, g.position.x, g.position.y + 6, g.position.z + z, width, 3, 0, true);
  };

  SN.cityWindows = function cityWindows(g, x, z, w, d, h, key = "glass") {
    for (let y = 5; y < h - 2; y += 5) {
      SN.cityPart(g, key, x, y, z + d / 2 + 0.08, w * 0.9, 1.6, 0.18);
      SN.cityPart(g, key, x - w / 2 - 0.08, y, z, 0.18, 1.6, d * 0.9);
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
    SN.finishCityGroup(g);
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
    let count = 0;
    for (let i = 0; i < 150; i++) {
      const a = SN.rand(0, SN.TAU), r = Math.sqrt(SN.rnd()) * 34, x = px + Math.sin(a) * r, z = pz + Math.cos(a) * r;
      if (SN.isWater(x, z, 1) || SN.surfaceTypeAt(x, z) !== 0 || SN.blocked(x, z, 0.2))
        continue;
      if (SN.hillHeight(x, z) > 2.5)
        continue;
      const s = SN.rand(0.6, 1.3);
      SN.dummy.position.set(x, SN.surfaceHeight(x, z), z);
      SN.dummy.rotation.set(0, SN.rand(0, SN.TAU), 0);
      SN.dummy.scale.set(s, SN.rand(0.7, 1.4), s);
      SN.dummy.updateMatrix();
      SN.groundDetails.setMatrixAt(count, SN.dummy.matrix);
      const c = SN.groundDetails.instanceColor ? SN.groundDetails.instanceColor : null;
      SN.groundDetails.setColorAt(count, SN.tintColor.setHSL(0.26 + SN.rand(-0.03, 0.03), 0.5, SN.rand(0.14, 0.25)).convertSRGBToLinear());
      count++;
    }
    SN.groundDetails.count = count;
    SN.groundDetails.instanceMatrix.needsUpdate = true;
    if (SN.groundDetails.instanceColor)
      SN.groundDetails.instanceColor.needsUpdate = true;
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
    SN.yeouidoMesh = SN.meshAt(new SN.T.CylinderGeometry(1, 1, 1, 40), SN.mat(0x6f8a58), SN.island.x, 0.05, SN.island.z, SN.island.rx, 1.75, SN.island.rz);
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
      gold: SN.pbrMat("metal", 0xe2be74, { uvScale: 0.45, metalness: 0.82, roughness: 0.42 }),
      teal: SN.pbrMat("metal", 0x69a69c, { uvScale: 0.5, metalness: 0.45, roughness: 0.75 }),
      dark: SN.pbrMat("metal", 0x53666c, { uvScale: 0.45, metalness: 0.4, roughness: 0.86 }),
      white: SN.pbrMat("stucco", 0xf0e8d8, { uvScale: 0.4, roughness: 1, metalness: 0.02 }),
      red: SN.pbrMat("paint", 0xc07664, { uvScale: 0.5, roughness: 0.92 }),
      grass: SN.pbrMat("grass", 0xc4d4b0, { uvScale: 0.8, roughness: 1 }),
      light: SN.pbrMat("paint", 0xffe9c8, { uvScale: 0.5, emissive: 0x9fe0cc, emissiveIntensity: 0.7, roughness: 0.42 })
    };
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
      SN.cityPart(g, "stone", 0, 9, 0, 150, 18, 65);
      SN.cityPart(g, "glass", 0, 13, 34, 138, 13, 1);
      for (const x of [-54, 0, 54]) {
        SN.cityPart(g, "cream", x, 22, 0, 23, 12, 38, 0, new SN.T.CylinderGeometry(1, 1, 1, 12), SN.PI / 2);
        SN.cityPart(g, "gold", x, 28, 0, 4, 1, 70);
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
      SN.cityPart(g, "stone", 0, 0.15, 0, 170, 0.3, 95);
      SN.cityPart(g, "wood", 50, 0.6, -27, 30, 1.2, 14);
      for (const x of [32, 68]) {
        SN.cityPart(g, "dark", x, 2, -27, 2, 4, 2);
        SN.cityPart(g, "gold", x, 6, -27, 0.25, 8, 0.25);
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
      for (let i = 0; i < 3; i++) {
        const h = 175 + i * 24, w = 27 - i * 3;
        SN.cityPart(g, "gold", -24 + i * 22, h / 2, 0, w, h, 35);
        for (let y = 3; y < h; y += 3.4)
          SN.cityPart(g, "dark", -24 + i * 22, y, 18, w, 0.28, 0.22);
      }
      SN.citySolid(g, 0, 0, 80, 38, 225);
      SN.cityLabel(g, "육삼빛 · 金穗楼", 28, 37);
      SN.finishCityGroup(g);
    }
    // Convention / mall courts, express terminal and Jamsil sports park.
    {
      const g = SN.cityGroup(1760, 1330, 2600);
      SN.cityPart(g, "glass", 0, 16, 0, 265, 32, 180);
      for (let i = 0; i < 5; i++)
        SN.cityPart(g, "cream", -112 + i * 56, 37, 0, 35, 9, 190, 0, new SN.T.CylinderGeometry(1, 1, 1, 6), SN.PI / 2);
      SN.cityPart(g, "teal", 0, 5, 93, 235, 10, 8);
      SN.citySolid(g, 0, 0, 265, 180, 40);
      SN.cityLabel(g, "삼성 · 겹빛 컨벤션 / 몰", 99, 100);
      SN.finishCityGroup(g);
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
      SN.citySolid(g, 0, 0, 210, 70, 16);
      SN.cityLabel(g, "고속버스 · 江南客运站", 40, 70);
      SN.finishCityGroup(g);
    }
    {
      const g = SN.cityGroup(2740, 1390, 3900);
      for (let i = 0; i < 9; i++) {
        const w = 74 - i * 5, y = i * 39;
        SN.cityPart(g, i % 3 === 0 ? "teal" : "glass", Math.sin(i * 0.6) * 8, y + 20, 0, w, 40, w * 0.7, i * 0.055);
        SN.cityPart(g, "cream", Math.sin(i * 0.6) * 8, y + 40, 0, w + 1, 1.2, w * 0.7 + 1, i * 0.055);
      }
      SN.cityPart(g, "gold", 10, 393, 0, 1.2, 82, 1.2);
      SN.citySolid(g, 0, 0, 85, 60, 400);
      SN.cityPart(g, "stone", 0, 0.1, 80, 200, 0.2, 80);
      SN.cityLabel(g, "잠실 · 물결첨탑", 45, 50);
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
      SN.finishCityGroup(g);
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
      SN.finishCityGroup(g);
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
      SN.finishCityGroup(g);
      SN.cityTransit.push({ kind: "cable", root: g, phase: i });
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
    SN.leafMat = SN.pbrMat("grass", 0xffffff, { uvScale: 0.4, flatShading: true, roughness: 1, metalness: 0, envMapIntensity: 0.25 });
    SN.poleMat = SN.pbrMat("metal", 0x768688, { uvScale: 0.6, metalness: 0.55, roughness: 0.62 });
    SN.lampGlow = SN.pbrMat("paint", 0xfff0d0, { uvScale: 0.8, emissive: 0xffd791, emissiveIntensity: 0, roughness: 0.4 });
    SN.staticCityTiles(SN.asphalt, SN.roadBatch, 1650, 240, false, false);
    SN.staticCityTiles(SN.sidewalk, SN.sideBatch, 1650, 240, false, false);
    SN.staticCityTiles(SN.stripeMat, SN.markBatch, 900, 240, false, false);
    SN.staticCityTiles(SN.curbMat, SN.curbBatch, 1000, 240, false, false);
    for (let i = 0; i < SN.buildingMats.length; i++)
      SN.staticCityTiles(SN.buildingMats[i], SN.buildingBatches[i].filter(b => !b.lot || b.lot.era !== "brick").map(b => ({ ...b, g: SN.urbanBlockGeo })));
    SN.staticCityTiles(SN.cityPalette.brick, SN.urbanShells);
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
  // Startup phase 12: keep this order relative to the other systems.

  SN.registerInit(12, function initializeProps12() {
    // Ground-floor shopfronts get a real display window with shelves, a backing
    // sign box, protruding blade signs and a soft neon halo.
    SN.shopSignBacks = [];
    SN.shopDisplays = [];
    SN.shopShelves = [];
    SN.bladeBacks = [];
    SN.bladeFaces = [];
    SN.shopGlow = [];
    SN.bladeGlow = [];
    for (let index = 0; index < SN.shopFronts.length; index++) {
      const front = SN.shopFronts[index],
        col = SN.shopColorHex[front.idx],
        tx = Math.cos(front.yaw),
        tz = -Math.sin(front.yaw);
      SN.record(SN.shopSignBacks, front.x + front.nx * 0.03, 3.5, front.z + front.nz * 0.03, front.signW + 0.3, 1, 0.14, front.yaw);
      if (front.upper)
        SN.record(SN.shopSignBacks, front.x + front.nx * 0.04, front.upper.y, front.z + front.nz * 0.04, front.upper.w + 0.24, 1.7, 0.14, front.yaw);
      SN.record(SN.shopDisplays, front.x - front.nx * 0.07, 1.62, front.z - front.nz * 0.07, front.w * 0.82, 2.3, 1, front.yaw, col);
      for (let row = 0; row < 2; row++)
        SN.record(SN.shopShelves, front.x - front.nx * 0.04, 0.88 + row * 0.62, front.z - front.nz * 0.04, front.w * 0.62, 0.07, 0.14, front.yaw);
      if (index % 2 === 0)
        SN.record(SN.shopGlow, front.x + front.nx * 0.28, 3.5, front.z + front.nz * 0.28, front.signW * 1.25, 1.55, 1, front.yaw, col);
      if (index % 3 === 0) {
        const bx = front.x + front.nx * 0.65, bz = front.z + front.nz * 0.65;
        SN.record(SN.bladeBacks, bx, 4.7, bz, 0.2, 2.8, 1.15, front.yaw);
        SN.record(SN.bladeFaces, bx + tx * 0.11, 4.7, bz + tz * 0.11, 0.92, 2.45, 1, front.yaw + SN.PI / 2, col);
        SN.record(SN.bladeFaces, bx - tx * 0.11, 4.7, bz - tz * 0.11, 0.92, 2.45, 1, front.yaw - SN.PI / 2, col);
        SN.record(SN.bladeGlow, bx + tx * 0.2, 4.7, bz + tz * 0.2, 1.7, 3, 1, front.yaw + SN.PI / 2, col);
        SN.record(SN.bladeGlow, bx - tx * 0.2, 4.7, bz - tz * 0.2, 1.7, 3, 1, front.yaw - SN.PI / 2, col);
      }
    }
    SN.detailTiles(SN.box, SN.detailDark, SN.shopSignBacks, false);
    SN.detailTiles(SN.detailPlaneGeo, SN.detailDisplayMat, SN.shopDisplays, false);
    SN.detailTiles(SN.box, SN.detailRailMat, SN.shopShelves, false);
    SN.detailTiles(SN.box, SN.detailDark, SN.bladeBacks, false);
    SN.detailTiles(SN.detailPlaneGeo, SN.detailSignMat, SN.bladeFaces, false);
    SN.detailTiles(SN.detailPlaneGeo, SN.detailNeonGlowMat, SN.shopGlow, false);
    SN.detailTiles(SN.detailPlaneGeo, SN.detailNeonGlowMat, SN.bladeGlow, false);
    // Bus shelters: merged once per material, with a lit route board facing the kerb.
    SN.busMetalParts = [];
    SN.busGlassParts = [];
    SN.busBenchParts = [];
    SN.busSigns = [];
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
    SN.signalRed = [];
    SN.signalGreen = [];
    SN.signalRedMat = SN.mat(0x7a2f2a, { emissive: 0xff4238, emissiveIntensity: 1.1 });
    SN.signalGreenMat = SN.mat(0x2f6b4a, { emissive: 0x46ff8a, emissiveIntensity: 1.1 });
    SN.neonMats.push(SN.signalRedMat, SN.signalGreenMat);
    SN.signalFlip = 0;
    for (const corner of SN.crossingCorners) {
      const x = corner.x, z = corner.z;
      if (SN.isWater(x, z, 1) || SN.inPalace(x, z, 1) || SN.onRoadway(x, z, 0.35) || SN.blocked(x, z, 0.6))
        continue;
      const y = SN.surfaceHeight(x, z), sigYaw = corner.yaw;
      SN.record(SN.signalPoles, x, y + 1.7, z, 0.24, 3.4, 0.24, 0);
      SN.record(SN.signalHeads, x, y + 3.05, z, 0.34, 0.72, 0.26, sigYaw);
      const lx = x + Math.sin(sigYaw) * 0.17, lz = z + Math.cos(sigYaw) * 0.17;
      if (SN.signalFlip++ % 2 === 0)
        SN.record(SN.signalGreen, lx, y + 2.88, lz, 0.16, 0.16, 0.05, sigYaw);
      else
        SN.record(SN.signalRed, lx, y + 3.18, lz, 0.16, 0.16, 0.05, sigYaw);
      SN.addCollider(x, z, 0.32, 0.32, 3.4);
    }
    SN.detailTiles(SN.cylinder, SN.detailMetal, SN.signalPoles, false);
    SN.detailTiles(SN.box, SN.detailDark, SN.signalHeads, false);
    SN.detailTiles(SN.box, SN.signalRedMat, SN.signalRed, false);
    SN.detailTiles(SN.box, SN.signalGreenMat, SN.signalGreen, false);
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
          for (const lane of [-3.6, 3.6]) {
            const x = a[0] + dx * t / len + nx * lane, z = a[1] + dz * t / len + nz * lane;
            SN.record(SN.laneArrows, x, SN.surfaceHeight(x, z) + 0.018, z, 1, 1, 1, yaw);
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
      SN.record(SN.urbanAwning, x + nx * 0.75, y + 3.1, z + nz * 0.75, spec.front + 0.2, 0.16, 1.65, yaw, 0x639a8e);
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
      SN.record(SN.urbanScooters, x, SN.surfaceHeight(x, z), z, 1, 1, 1, f.yaw + 0.55, [0x8b998f, 0xb88365, 0x647c8f][i % 3]);
      SN.addOBB(x, z, 0.65, 1.65, 1.25, f.yaw + 0.55);
    }
    // Human-scale pushcarts leave a continuous 3.6 m pedestrian route through Myeongdong.
    for (let i = 0; i < 13; i++) {
      const x = 305 + i * 18, z = -430 + (i % 2 ? 6.3 : -6.3), yaw = i % 2 ? SN.PI : 0;
      if (SN.blocked(x, z, 1.6) || SN.onRoadway(x, z, 0.2))
        continue;
      const y = SN.surfaceHeight(x, z);
      SN.record(SN.urbanStalls, x, y + 0.55, z, 2.1, 1.1, 1.15, yaw);
      SN.record(SN.urbanStallCloth, x, y + 2.22, z, 2.6, 0.14, 1.75, yaw, SN.shopColorHex[i % 8]);
      for (const side of [-1, 1])
        SN.record(SN.urbanStallMetal, x + side * 0.95, y + 1.15, z, 0.045, 2.3, 0.045, yaw);
      for (let bowl = 0; bowl < 4; bowl++)
        SN.record(SN.urbanStallMetal, x - 0.7 + bowl * 0.45, y + 1.18, z, 0.26, 0.12, 0.3, yaw);
      SN.addOBB(x, z, 2.1, 1.15, 1.3, yaw);
    }
    SN.detailTiles(SN.tableGeo, SN.cityPalette.teal, SN.urbanTables);
    SN.detailTiles(SN.chairGeo, SN.cityPalette.teal, SN.urbanSeats);
    SN.detailTiles(SN.scooterBodyGeo, SN.detailMetal, SN.urbanScooters);
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
})(window.SN);
