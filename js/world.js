/* 地形、河流、道路、空间索引与碰撞。 */
"use strict";
(function (SN) {
  SN.riverNorth = function riverNorth(x) {
    return SN.RIVER_N + Math.sin(x * 0.0037) * 13 + Math.sin(x * 0.011 + 1.2) * 6;
  };

  SN.riverSouth = function riverSouth(x) {
    return SN.RIVER_S + Math.sin(x * 0.0031 + 2.1) * 8 + Math.sin(x * 0.009 + 0.5) * 4;
  };

  SN.pointInRiver = function pointInRiver(x, z) {
    return z > SN.riverNorth(x) && z < SN.riverSouth(x);
  };

  SN.onIsland = function onIsland(x, z) {
    return ((x - SN.island.x) / SN.island.rx) ** 2 + ((z - SN.island.z) / SN.island.rz) ** 2 < 1;
  };

  SN.inLake = function inLake(x, z) {
    return ((x - SN.lakePark.x) / SN.lakePark.rx) ** 2 + ((z - SN.lakePark.z) / SN.lakePark.rz) ** 2 < 1;
  };

  SN.bridgeProfile = function bridgeProfile(b, z) {
    const edge = Math.min(z - b.z0, b.z1 - z);
    return 0.12 + (SN.BRIDGE_DECK - 0.12) * SN.clamp(edge / 55, 0, 1);
  };

  SN.causewayAt = function causewayAt(x, z, r = 0) {
    for (let i = 0; i < SN.bridges.length; i++) {
      const b = SN.bridges[i];
      if (Math.abs(x - b.x) < b.w * 0.5 - r && z > b.z0 + r && z < b.z1 - r)
        return b;
    }
    return null;
  };

  SN.onCauseway = function onCauseway(x, z, r = 0) {
    return !!SN.causewayAt(x, z, r);
  };

  SN.bridgeHeight = function bridgeHeight(x, z) {
    const b = SN.causewayAt(x, z);
    return b ? SN.bridgeProfile(b, z) : -1;
  };

  SN.terrainNoise = function terrainNoise(x, z) {
    return SN.tileNoise(x, z, 4096, 731) * 0.58 + SN.tileNoise(x * 2.07 + 13, z * 2.07 - 9, 4096, 883) * 0.28 + SN.tileNoise(x * 4.13 - 7, z * 4.13 + 17, 4096, 997) * 0.14;
  };

  SN.hillHeight = function hillHeight(x, z) {
    let height = 0;
    for (let i = 0; i < SN.hillDefs.length; i++) {
      const p = SN.hillDefs[i], nx = (x - p[0]) / p[2], nz = (z - p[1]) / p[2];
      if (nx * nx + nz * nz > 1.35)
        continue;
      const warp = (SN.terrainNoise(x / 240, z / 240) - 0.5) * 0.12, d = Math.hypot(nx + warp, nz * 0.94 - warp);
      if (d >= 1)
        continue;
      const envelope = (1 - d * d) ** 3,
        ridge = 1 - Math.abs(SN.terrainNoise(x / 185 + i * 3, z / 185) - 0.5) * 1.2,
        valley = SN.terrainNoise(x / 470 - 8, z / 470 + 4);
      const h = p[3] * envelope * (0.8 + ridge * 0.25 + valley * 0.13);
      height = Math.pow(Math.pow(height, 4) + Math.pow(h, 4), 0.25);
    }
    // The palace courtyard is an excavated urban terrace, with blended forest edges.
    const palaceDistance = Math.max(Math.abs(x - 10) - 330, Math.abs(z + 962) - 150);
    height *= SN.smoothRange(0, 80, palaceDistance);
    return height;
  };

  SN.terrainSlope = function terrainSlope(x, z) {
    return Math.hypot(SN.hillHeight(x + 3, z) - SN.hillHeight(x - 3, z), SN.hillHeight(x, z + 3) - SN.hillHeight(x, z - 3)) / 6;
  };

  SN.roadMetrics = function roadMetrics(requested, name = "", pedestrian = false) {
    const alley = /골목|뒤안길/.test(name) || requested <= 6;
    const lanes = alley || pedestrian ? 1 : requested <= 14 ? 2 : requested <= 22 ? 4 : requested <= 28 ? 6 : 8;
    const median = lanes >= 6 ? 1 : 0,
      width = lanes === 1 ? SN.clamp(requested, 4, 6) : lanes === 2 ? 7 : lanes * 3.2 + median + 0.8;
    return {
      width,
      lanes,
      laneWidth: 3.2,
      median,
      sidewalkW: lanes >= 6 ? 4 : lanes === 4 ? 3 : 2,
      laneOffset: lanes === 1 ? 0 : median / 2 + 1.6
    };
  };

  SN.registerRoadProfile = function registerRoadProfile(a, b, metrics, bridge = false, elevated = false) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      steps = Math.max(1, Math.ceil(length / 6)),
      heights = [];
    for (let i = 0; i <= steps; i++) {
      const x = SN.lerp(a[0], b[0], i / steps), z = SN.lerp(a[1], b[1], i / steps);
      heights.push(bridge ? SN.bridgeHeight(x, z) : SN.hillHeight(x, z));
    }
    if (!bridge && !elevated) {
      for (let pass = 0; pass < 3; pass++)
        for (let i = 1; i < steps; i++)
          heights[i] = (heights[i - 1] + heights[i] * 2 + heights[i + 1]) / 4;
      const rise = length / steps * 0.24;
      for (let pass = 0; pass < 4; pass++) {
        for (let i = 1; i <= steps; i++)
          heights[i] = SN.clamp(heights[i], heights[i - 1] - rise, heights[i - 1] + rise);
        for (let i = steps - 1; i >= 0; i--)
          heights[i] = SN.clamp(heights[i], heights[i + 1] - rise, heights[i + 1] + rise);
      }
    }
    const profile = { a, b, dx, dz, length, steps, heights, ...metrics, bridge, elevated };
    SN.roadProfiles.push(profile);
    const pad = metrics.width / 2 + metrics.sidewalkW + 18;
    for (let iz = Math.floor((Math.min(a[1], b[1]) - pad) / 100); iz <= Math.floor((Math.max(a[1], b[1]) + pad) / 100); iz++)
      for (let ix = Math.floor((Math.min(a[0], b[0]) - pad) / 100); ix <= Math.floor((Math.max(a[0], b[0]) + pad) / 100); ix++) {
        const key = ix + "," + iz;
        if (!SN.roadProfileCells.has(key))
          SN.roadProfileCells.set(key, []);
        SN.roadProfileCells.get(key).push(profile);
      }
  };

  SN.roadSample = function roadSample(x, z, padding = 0) {
    let best = null, distance = Infinity;
    for (const p of SN.roadProfileCells.get(Math.floor(x / 100) + "," + Math.floor(z / 100)) || []) {
      const t = SN.clamp(((x - p.a[0]) * p.dx + (z - p.a[1]) * p.dz) / (p.length * p.length), 0, 1),
        rx = p.a[0] + p.dx * t,
        rz = p.a[1] + p.dz * t,
        d = Math.hypot(x - rx, z - rz),
        edge = p.width / 2 + p.sidewalkW + 0.3;
      if (d > edge + padding || d >= distance)
        continue;
      const f = t * p.steps,
        i = Math.min(p.steps - 1, Math.floor(f)),
        height = SN.lerp(p.heights[i], p.heights[i + 1], f - i),
        across = ((x - rx) * p.dz - (z - rz) * p.dx) / p.length;
      best = { profile: p, distance: d, edge, height, across };
      distance = d;
    }
    return best;
  };

  SN.roadTerrainHeight = function roadTerrainHeight(x, z, natural = SN.hillHeight(x, z)) {
    const sample = SN.roadSample(x, z, 15);
    if (!sample || sample.profile.bridge || sample.profile.elevated)
      return natural;
    const blend = 1 - SN.smoothRange(sample.edge, sample.edge + 15, sample.distance);
    return SN.lerp(natural, sample.height - 0.16, blend);
  };

  SN.cityDistrictAt = function cityDistrictAt(x, z) {
    let best = Infinity, result = SN.cityDistricts[0];
    for (const d of SN.cityDistricts) {
      const v = ((x - d.x) / d.rx) ** 2 + ((z - d.z) / d.rz) ** 2;
      if (v < best) {
        best = v;
        result = d;
      }
    }
    return result;
  };

  SN.elevatedHeight = function elevatedHeight(x, z) {
    for (; SN.elevatedIndexed < SN.elevatedSegments.length; SN.elevatedIndexed++) {
      const e = SN.elevatedSegments[SN.elevatedIndexed], pad = e.w / 2;
      for (let iz = Math.floor((Math.min(e.a[1], e.b[1]) - pad) / 100); iz <= Math.floor((Math.max(e.a[1], e.b[1]) + pad) / 100); iz++)
        for (let ix = Math.floor((Math.min(e.a[0], e.b[0]) - pad) / 100); ix <= Math.floor((Math.max(e.a[0], e.b[0]) + pad) / 100); ix++) {
          const key = ix + "," + iz;
          if (!SN.elevatedCells.has(key))
            SN.elevatedCells.set(key, []);
          SN.elevatedCells.get(key).push(e);
        }
    }
    let height = -1;
    for (const e of SN.elevatedCells.get(Math.floor(x / 100) + "," + Math.floor(z / 100)) || []) {
      const dx = e.b[0] - e.a[0],
        dz = e.b[1] - e.a[1],
        t = SN.clamp(((x - e.a[0]) * dx + (z - e.a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
      if (SN.segmentDistance(x, z, ...e.a, ...e.b) < e.w / 2)
        height = Math.max(height, SN.lerp(e.y0, e.y1, t));
    }
    return height;
  };

  SN.segmentDistance = function segmentDistance(x, z, ax, az, bx, bz) {
    const dx = bx - ax,
      dz = bz - az,
      den = dx * dx + dz * dz,
      t = den > 1e-10 ? SN.clamp(((x - ax) * dx + (z - az) * dz) / den, 0, 1) : 0;
    return Math.hypot(x - ax - t * dx, z - az - t * dz);
  };

  SN.isWater = function isWater(x, z, r = 0) {
    return SN.inLake(x, z) || (SN.pointInRiver(x, z) && !SN.onIsland(x, z) && !SN.onCauseway(x, z, r));
  };

  SN.groundHeight = function groundHeight(x, z) {
    const b = SN.causewayAt(x, z);
    if (b)
      return SN.bridgeProfile(b, z);
    if (SN.onIsland(x, z))
      return 0.8;
    return SN.hillHeight(x, z);
  };
  // Shore paving masks the intentionally low-poly shoreline.

  SN.strip = function strip(list, ax, az, bx, bz, width, y = 0.12, height = 0.2) {
    const dx = bx - ax, dz = bz - az;
    SN.record(list, (ax + bx) / 2, y, (az + bz) / 2, width, height, Math.hypot(dx, dz), Math.atan2(dx, dz));
  };

  SN.roadHeight = function roadHeight(x, z) {
    const eh = SN.elevatedHeight(x, z), bh = SN.bridgeHeight(x, z), sample = SN.roadSample(x, z);
    return Math.max(eh, bh >= 0 ? bh : sample ? sample.height : SN.hillHeight(x, z));
  };

  SN.terrainStrip = function terrainStrip(list, ax, az, bx, bz, width, lift, height) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), steps = Math.ceil(len / 14);
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps,
        t1 = (i + 1) / steps,
        x0 = SN.lerp(ax, bx, t0),
        z0 = SN.lerp(az, bz, t0),
        x1 = SN.lerp(ax, bx, t1),
        z1 = SN.lerp(az, bz, t1),
        y0 = SN.roadHeight(x0, z0),
        y1 = SN.roadHeight(x1, z1);
      SN.record(list, (x0 + x1) / 2, (y0 + y1) / 2 + lift, (z0 + z1) / 2, width, height, Math.hypot(len / steps, y1 - y0) + 0.2, Math.atan2(dx, dz));
      list[list.length - 1].pitch = -Math.atan2(y1 - y0, len / steps);
    }
  };

  SN.addRoad = function addRoad(name, points, width = 14, pedestrian = false) {
    const metrics = SN.roadMetrics(width, /남산순환/.test(name) ? "골목" : name, pedestrian);
    width = metrics.width;
    const sidewalkW = metrics.sidewalkW, road = { name, points, ...metrics, pedestrian };
    SN.roads.push(road);
    for (let i = 1; i < points.length; i++)
      SN.registerRoadProfile(points[i - 1], points[i], metrics, false, /江边北路|奥林匹克|匝道/.test(name));
    for (let k = 0; k < points.length - 1; k++) {
      const a = points[k],
        b = points[k + 1],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        nx = dz / len,
        nz = -dx / len,
        yaw = Math.atan2(dx, dz);
      SN.terrainStrip(SN.roadBatch, a[0], a[1], b[0], b[1], width, 0.09, 0.16);
      for (const side of [-1, 1]) {
        const off = (width / 2 + 0.3 + sidewalkW / 2) * side;
        SN.terrainStrip(SN.sideBatch, a[0] + nx * off, a[1] + nz * off, b[0] + nx * off, b[1] + nz * off, sidewalkW, 0.19, 0.32);
        SN.terrainStrip(SN.curbBatch, a[0] + nx * (width / 2 + 0.15) * side, a[1] + nz * (width / 2 + 0.15) * side, b[0] + nx * (width / 2 + 0.15) * side, b[1] + nz * (width / 2 + 0.15) * side, 0.3, 0.27, 0.16);
      }
      if (!pedestrian && road.lanes >= 2) {
        const lanes = road.lanes, laneWidth = 3.2;
        for (let lane = 1; lane < lanes; lane++) {
          const centre = lane === lanes / 2,
            off = (lane - lanes / 2) * laneWidth + (centre ? 0 : Math.sign(lane - lanes / 2) * road.median / 2);
          if (centre && road.median)
            continue;
          for (let t = 4; t < len - 4; t += centre ? 10 : 12) {
            const x = a[0] + dx * t / len + nx * off, z = a[1] + dz * t / len + nz * off;
            for (const double of (centre ? [-0.13, 0.13] : [0])) {
              SN.record(SN.markBatch, x + nx * double, SN.roadHeight(x, z) + 0.19, z + nz * double, centre ? 0.1 : 0.12, 0.018, centre ? 9.9 : 4, yaw, centre ? 0xcda451 : 0xffffff);
              SN.markBatch[SN.markBatch.length - 1].pitch = -Math.atan2(SN.roadHeight(x + dx / len * 2, z + dz / len * 2) - SN.roadHeight(x - dx / len * 2, z - dz / len * 2), 4);
            }
          }
        }
      }
      if (road.median)
        for (let t = 10; t < len - 10; t += 6) {
          const x = a[0] + dx * t / len, z = a[1] + dz * t / len;
          SN.record(SN.medianBatch, x, SN.roadHeight(x, z) + 0.28, z, road.median, 0.38, 5.8, yaw);
          SN.medianSolids.push({ x, z, yaw, w: road.median, d: 5.8 });
        }
      for (let t = 7; t < len - 7; t += 12)
        for (const side of [-1, 1]) {
          const off = (width / 2 + sidewalkW + 0.4) * side,
            x = a[0] + nx * off + dx * t / len,
            z = a[1] + nz * off + dz * t / len,
            top = SN.roadHeight(x, z),
            bottom = SN.hillHeight(x, z);
          if (Math.abs(top - bottom) > 0.7)
            SN.record(SN.retainingBatch, x, (top + bottom) / 2 - 0.1, z, 0.38, Math.abs(top - bottom) + 0.4, 12.2, yaw);
        }
      if (width >= 7)
        for (let t = 27; t < len - 14; t += 66) {
          const x = a[0] + dx * t / len, z = a[1] + dz * t / len;
          for (const side of [-1, 1])
            SN.addLamp(x + nx * (width / 2 + 0.3 + Math.min(1.1, sidewalkW * 0.45)) * side, z + nz * (width / 2 + 0.3 + Math.min(1.1, sidewalkW * 0.45)) * side, yaw);
        }
    }
    return road;
  };

  SN.addProp = function addProp(x, z, w, d, h = 6) {
    if (SN.collidersReady && w < 1 && d < 1 && SN.inDrivingLane(x, z, 0.5))
      return;
    if (SN.collidersReady)
      SN.addCollider(x, z, w, d, h);
    else
      SN.propSolids.push([x, z, w, d, h]);
  };

  SN.addPropOBB = function addPropOBB(x, z, w, d, h, yaw) {
    if (SN.collidersReady)
      SN.addOBB(x, z, w, d, h, yaw);
    else
      SN.propOBBs.push([x, z, w, d, h, yaw]);
  };

  SN.addLamp = function addLamp(x, z, yaw = 0) {
    const y = SN.roadHeight(x, z) + 0.35;
    SN.record(SN.lampBatch, x, y + 4.6, z, 0.2, 9.2, 0.2);
    SN.record(SN.lampBatch, x, y + 9, z, 3.2, 0.15, 0.18, yaw);
    SN.record(SN.lampHeadBatch, x, y + 8.9, z, 3.1, 0.13, 0.65, yaw);
    SN.record(SN.poolBatch, x, y + 0.26, z, 12, 12, 1);
    SN.addProp(x, z, 0.55, 0.55, 9.2);
    SN.lampPoints.push({ x, z, y: y + 8.7 });
  };
  // Nine long crossings anchor the map; each is a road for navigation and a dry causeway for collision.

  SN.addBridge = function addBridge(name, x, z0, z1, deckW = 30) {
    const metrics = SN.roadMetrics(deckW, name);
    deckW = metrics.width;
    const b = { name, x, z0, z1, w: deckW + 8.6 };
    SN.bridges.push(b);
    SN.roads.push({ name, points: [[x, z0], [x, z1]], ...metrics, bridge: true });
    SN.registerRoadProfile([x, z0], [x, z1], metrics, true);
    const half = deckW * 0.5;
    for (let z = z0; z < z1; z += 10) {
      const yc = (SN.bridgeProfile(b, z) + SN.bridgeProfile(b, z + 10)) * 0.5;
      SN.record(SN.sideBatch, x, yc - 0.16, z + 5, deckW + 8, 0.3, 10.3);
      SN.sideBatch[SN.sideBatch.length - 1].fixedHeight = true;
      SN.sideBatch[SN.sideBatch.length - 1].pitch = -Math.atan2(SN.bridgeProfile(b, z + 10) - SN.bridgeProfile(b, z), 10);
      SN.record(SN.roadBatch, x, yc + 0.09, z + 5, deckW, 0.16, 10.3);
      SN.roadBatch[SN.roadBatch.length - 1].pitch = -Math.atan2(SN.bridgeProfile(b, z + 10) - SN.bridgeProfile(b, z), 10);
      for (const s of [-1, 1]) {
        SN.record(SN.sideBatch, x + s * (half + 2.1), yc + 0.13, z + 5, 4, 0.22, 10.3);
        SN.sideBatch[SN.sideBatch.length - 1].pitch = SN.roadBatch[SN.roadBatch.length - 1].pitch;
        SN.record(SN.curbBatch, x + s * (half + 0.15), yc + 0.19, z + 5, 0.3, 0.16, 10.3);
        SN.curbBatch[SN.curbBatch.length - 1].pitch = SN.roadBatch[SN.roadBatch.length - 1].pitch;
        SN.record(SN.railBatch, x + s * (half - 0.45), yc + 0.58, z + 5, 0.32, 0.7, 10.1);
        SN.railBatch[SN.railBatch.length - 1].pitch = SN.roadBatch[SN.roadBatch.length - 1].pitch;
        for (const level of [0.55, 1.22]) {
          SN.record(SN.bridgeGirders, x + s * (half + 4.05), yc + level, z + 5, 0.075, 0.075, 10.1);
          SN.bridgeGirders[SN.bridgeGirders.length - 1].pitch = SN.roadBatch[SN.roadBatch.length - 1].pitch;
        }
        for (const off of [-0.6, 0.6]) {
          SN.record(SN.bridgeGirders, x + s * half * 0.48 + off, yc - 1.2, z + 5, 0.12, 1.8, 10.15);
          SN.bridgeGirders[SN.bridgeGirders.length - 1].pitch = SN.roadBatch[SN.roadBatch.length - 1].pitch;
        }
        SN.record(SN.bridgeGirders, x + s * half * 0.48, yc - 2.05, z + 5, 1.5, 0.16, 10.15);
        SN.bridgeGirders[SN.bridgeGirders.length - 1].pitch = SN.roadBatch[SN.roadBatch.length - 1].pitch;
      }
      for (const side of [-1, 1])
        for (let lane = 1; lane < metrics.lanes / 2; lane++) {
          const off = side * (metrics.median / 2 + lane * 3.2);
          SN.record(SN.markBatch, x + off, yc + 0.185, z + 5, 0.12, 0.02, 4);
          SN.markBatch[SN.markBatch.length - 1].pitch = SN.roadBatch[SN.roadBatch.length - 1].pitch;
        }
      SN.record(SN.medianBatch, x, yc + 0.3, z + 5, metrics.median, 0.4, 10.1);
      SN.medianBatch[SN.medianBatch.length - 1].pitch = SN.roadBatch[SN.roadBatch.length - 1].pitch;
      SN.medianSolids.push({ x, z: z + 5, w: metrics.median, d: 10, yaw: 0 });
      if (Math.round((z - z0) / 10) % 6 === 0)
        for (const s of [-1, 1]) {
          const lx = x + s * (half + 2.6);
          SN.record(SN.lampBatch, lx, yc + 4.4, z + 5, 0.18, 8.8, 0.18);
          SN.record(SN.lampHeadBatch, lx, yc + 8.6, z + 5, 2.6, 0.12, 0.55);
          SN.lampPoints.push({ x: lx, z: z + 5, y: yc + 8.3 });
          SN.addProp(lx, z + 5, 0.45, 0.45, 8.8);
        }
    }
    for (let z = z0 + 75; z < z1 - 60; z += 46) {
      const top = SN.bridgeProfile(b, z) - 2.1;
      for (const side of [-1, 1])
        SN.record(SN.sideBatch, x + side * half * 0.55, (top - 2.5) / 2, z, 2.2, top + 2.5, 3.6);
      SN.record(SN.sideBatch, x, top - 0.3, z, deckW * 0.77, 0.8, 3.9);
    }
    for (let z = z0 + 80; z < z1 - 80; z += 30)
      if (!SN.onIsland(x, z))
        for (const s of [-1, 1])
          SN.addPropOBB(x + s * (half - 0.45), z + 15, 0.5, 30.4, 1.5, 0);
    return b;
  };

  SN.terrainHeight = function terrainHeight(x, z) {
    const gx = SN.clamp((x + SN.EXTENT) / (SN.EXTENT * 2 / SN.terrainDivisions), 0, SN.terrainDivisions - 0.00001),
      gz = SN.clamp((z + SN.EXTENT) / (SN.EXTENT * 2 / SN.terrainDivisions), 0, SN.terrainDivisions - 0.00001),
      ix = Math.floor(gx),
      iz = Math.floor(gz),
      u = gx - ix,
      v = gz - iz,
      i = iz * (SN.terrainDivisions + 1) + ix;
    const a = SN.gp.getY(i),
      b = SN.gp.getY(i + SN.terrainDivisions + 1),
      d = SN.gp.getY(i + 1),
      c = SN.gp.getY(i + SN.terrainDivisions + 2);
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
  };

  SN.rasterSurface = function rasterSurface(minX, maxX, minZ, maxZ, test, height, type) {
    if (type >= 2 && maxX - minX < 90 && maxZ - minZ < 90)
      SN.localSurfacePatches.push({ minX, maxX, minZ, maxZ, test, height });
    const x0 = SN.clamp(Math.floor((minX - SN.SURFACE_ORIGIN) / SN.SURFACE_CELL), 0, SN.SURFACE_SIZE - 1),
      x1 = SN.clamp(Math.ceil((maxX - SN.SURFACE_ORIGIN) / SN.SURFACE_CELL), 0, SN.SURFACE_SIZE - 1),
      z0 = SN.clamp(Math.floor((minZ - SN.SURFACE_ORIGIN) / SN.SURFACE_CELL), 0, SN.SURFACE_SIZE - 1),
      z1 = SN.clamp(Math.ceil((maxZ - SN.SURFACE_ORIGIN) / SN.SURFACE_CELL), 0, SN.SURFACE_SIZE - 1);
    for (let iz = z0; iz <= z1; iz++)
      for (let ix = x0; ix <= x1; ix++) {
        const x = SN.SURFACE_ORIGIN + ix * SN.SURFACE_CELL, z = SN.SURFACE_ORIGIN + iz * SN.SURFACE_CELL;
        if (test(x, z)) {
          const i = iz * SN.SURFACE_SIZE + ix;
          SN.surfaceGrid[i] = Math.max(SN.surfaceGrid[i], height(x, z));
          SN.surfaceTypes[i] = type;
        }
      }
  };

  SN.surfaceHeight = function surfaceHeight(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z))
      return 0;
    let precise = -Infinity;
    for (const p of SN.localSurfacePatches)
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && p.test(x, z))
        precise = Math.max(precise, p.height(x, z));
    if (Number.isFinite(precise))
      return precise;
    const sample = SN.roadSample(x, z);
    if (sample) {
      const road = sample.profile, carriageway = sample.distance < road.width / 2;
      return SN.roadHeight(x, z) + (carriageway ? 0.17 : 0.35) + (carriageway ? Math.max(0, 1 - Math.abs(sample.across) / (road.width / 2)) * 0.025 : 0);
    }
    const gx = SN.clamp((x - SN.SURFACE_ORIGIN) / SN.SURFACE_CELL, 0, SN.SURFACE_SIZE - 1.00001),
      gz = SN.clamp((z - SN.SURFACE_ORIGIN) / SN.SURFACE_CELL, 0, SN.SURFACE_SIZE - 1.00001),
      ix = Math.floor(gx),
      iz = Math.floor(gz),
      u = gx - ix,
      v = gz - iz,
      i = iz * SN.SURFACE_SIZE + ix;
    const a = SN.surfaceGrid[i],
      b = SN.surfaceGrid[i + 1],
      c = SN.surfaceGrid[i + SN.SURFACE_SIZE],
      d = SN.surfaceGrid[i + SN.SURFACE_SIZE + 1];
    if (SN.surfaceTypes[i] === 3 || SN.surfaceTypes[i + 1] === 3 || SN.surfaceTypes[i + SN.SURFACE_SIZE] === 3 || SN.surfaceTypes[i + SN.SURFACE_SIZE + 1] === 3)
      return Math.max(a, b, c, d);
    return SN.lerp(SN.lerp(a, b, u), SN.lerp(c, d, u), v);
  };
  // Highest surface inside the foot disc: keeps a planted sole from sinking when
  // the character straddles a kerb or a stair edge.

  SN.groundUnder = function groundUnder(x, z, r = 0.2) {
    let h = SN.surfaceHeight(x, z);
    h = Math.max(h, SN.surfaceHeight(x + r, z), SN.surfaceHeight(x - r, z), SN.surfaceHeight(x, z + r), SN.surfaceHeight(x, z - r));
    return h;
  };

  SN.addCollider = function addCollider(x, z, w, d, height = 40) {
    const base = SN.groundHeight(x, z),
      b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: base, height: base + height, rayStamp: 0 };
    SN.colliders.push(b);
    const x0 = SN.clamp(Math.floor((b.minX + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1),
      x1 = SN.clamp(Math.floor((b.maxX + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1),
      z0 = SN.clamp(Math.floor((b.minZ + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1),
      z1 = SN.clamp(Math.floor((b.maxZ + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1);
    for (let zz = z0; zz <= z1; zz++)
      for (let xx = x0; xx <= x1; xx++)
        SN.bins[zz * SN.BIN_COUNT + xx].push(b);
  };

  SN.addOBB = function addOBB(x, z, w, d, height = 40, yaw = 0, base = null) {
    const floor = base === null ? SN.groundHeight(x, z) : base,
      b = {
      x,
      z,
      hw: w / 2,
      hd: d / 2,
      cos: Math.cos(yaw),
      sin: Math.sin(yaw),
      yaw,
      minX: x - 999,
      maxX: x + 999,
      minZ: z - 999,
      maxZ: z + 999,
      minY: floor,
      height: floor + height,
      rayStamp: 0
    };
    const radius = Math.hypot(b.hw, b.hd);
    b.minX = x - radius;
    b.maxX = x + radius;
    b.minZ = z - radius;
    b.maxZ = z + radius;
    SN.obbColliders.push(b);
    const x0 = SN.clamp(Math.floor((b.minX + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1),
      x1 = SN.clamp(Math.floor((b.maxX + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1),
      z0 = SN.clamp(Math.floor((b.minZ + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1),
      z1 = SN.clamp(Math.floor((b.maxZ + SN.EXTENT) / SN.BIN_SIZE), 0, SN.BIN_COUNT - 1);
    for (let zz = z0; zz <= z1; zz++)
      for (let xx = x0; xx <= x1; xx++)
        SN.obbBins[zz * SN.BIN_COUNT + xx].push(b);
    return b;
  };

  SN.inDrivingLane = function inDrivingLane(x, z, pad = 0) {
    for (const r of SN.roadProfileCells.get(Math.floor(x / 100) + "," + Math.floor(z / 100)) || [])
      if (SN.segmentDistance(x, z, ...r.a, ...r.b) < r.width / 2 + pad)
        return true;
    return false;
  };

  SN.aabbPush = function aabbPush(x, z, r, b) {
    const qx = SN.clamp(x, b.minX, b.maxX), qz = SN.clamp(z, b.minZ, b.maxZ);
    let dx = x - qx, dz = z - qz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r)
      return false;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      SN.circlePush.nx = dx / d;
      SN.circlePush.nz = dz / d;
      SN.circlePush.depth = r - d;
      return true;
    }
    const left = x - b.minX, right = b.maxX - x, back = z - b.minZ, front = b.maxZ - z;
    let m = left, nx = -1, nz = 0;
    if (right < m) {
      m = right;
      nx = 1;
      nz = 0;
    }
    if (back < m) {
      m = back;
      nx = 0;
      nz = -1;
    }
    if (front < m) {
      m = front;
      nx = 0;
      nz = 1;
    }
    SN.circlePush.nx = nx;
    SN.circlePush.nz = nz;
    SN.circlePush.depth = r + m;
    return true;
  };

  SN.orientedPush = function orientedPush(x, z, r, cx, cz, hw, hd, cos, sin) {
    const wx = x - cx, wz = z - cz, lx = wx * cos - wz * sin, lz = wx * sin + wz * cos;
    const qx = SN.clamp(lx, -hw, hw), qz = SN.clamp(lz, -hd, hd);
    let dx = lx - qx, dz = lz - qz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r)
      return false;
    let nx, nz, depth;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = dx / d;
      nz = dz / d;
      depth = r - d;
    }
    else {
      const left = lx + hw, right = hw - lx, back = lz + hd, front = hd - lz;
      let m = left;
      nx = -1;
      nz = 0;
      if (right < m) {
        m = right;
        nx = 1;
        nz = 0;
      }
      if (back < m) {
        m = back;
        nx = 0;
        nz = -1;
      }
      if (front < m) {
        m = front;
        nx = 0;
        nz = 1;
      }
      depth = r + m;
    }
    SN.circlePush.nx = nx * cos + nz * sin;
    SN.circlePush.nz = -nx * sin + nz * cos;
    SN.circlePush.depth = depth;
    return true;
  };

  SN.obbPush = function obbPush(x, z, r, b) {
    return SN.orientedPush(x, z, r, b.x, b.z, b.hw, b.hd, b.cos, b.sin);
  };
  // Resolve penetration and slide: position is pushed out along the contact normal.

  SN.resolveCircle = function resolveCircle(x, z, r) {
    let nx = 0, nz = 0, hit = false;
    for (let iter = 0; iter < 2; iter++) {
      let moved = false,
        ix = SN.clamp(Math.floor((x + SN.EXTENT) / SN.BIN_SIZE), 1, SN.BIN_COUNT - 2),
        iz = SN.clamp(Math.floor((z + SN.EXTENT) / SN.BIN_SIZE), 1, SN.BIN_COUNT - 2);
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const cell = SN.bins[(iz + dz) * SN.BIN_COUNT + ix + dx];
          for (let i = 0; i < cell.length; i++) {
            const b = cell[i];
            if (SN.aabbPush(x, z, r, b)) {
              x += SN.circlePush.nx * (SN.circlePush.depth + 0.002);
              z += SN.circlePush.nz * (SN.circlePush.depth + 0.002);
              nx += SN.circlePush.nx;
              nz += SN.circlePush.nz;
              hit = true;
              moved = true;
            }
          }
          const oc = SN.obbBins[(iz + dz) * SN.BIN_COUNT + ix + dx];
          for (let i = 0; i < oc.length; i++) {
            const b = oc[i];
            if (SN.obbPush(x, z, r, b)) {
              x += SN.circlePush.nx * (SN.circlePush.depth + 0.002);
              z += SN.circlePush.nz * (SN.circlePush.depth + 0.002);
              nx += SN.circlePush.nx;
              nz += SN.circlePush.nz;
              hit = true;
              moved = true;
            }
          }
        }
      if (!moved)
        break;
    }
    const len = Math.hypot(nx, nz);
    SN.circleResult.x = x;
    SN.circleResult.z = z;
    SN.circleResult.hit = hit;
    SN.circleResult.nx = hit && len > 0.0001 ? nx / len : 0;
    SN.circleResult.nz = hit && len > 0.0001 ? nz / len : 0;
    return SN.circleResult;
  };

  SN.carCirclePush = function carCirclePush(x, z, r, c, pad = 0) {
    return SN.orientedPush(x, z, r, c.x, c.z, c.spec.width / 2 + pad, c.spec.length / 2 + pad, Math.cos(c.yaw), Math.sin(c.yaw));
  };

  SN.blocked = function blocked(x, z, r) {
    if (Math.abs(x) > SN.WORLD - r || Math.abs(z) > SN.WORLD - r)
      return true;
    if (SN.isWater(x, z, r) || SN.isWater(x + r, z, r) || SN.isWater(x - r, z, r) || SN.isWater(x, z + r, r) || SN.isWater(x, z - r, r))
      return true;
    const ix = SN.clamp(Math.floor((x + SN.EXTENT) / SN.BIN_SIZE), 1, SN.BIN_COUNT - 2),
      iz = SN.clamp(Math.floor((z + SN.EXTENT) / SN.BIN_SIZE), 1, SN.BIN_COUNT - 2);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const cell = SN.bins[(iz + dz) * SN.BIN_COUNT + ix + dx];
        for (let i = 0; i < cell.length; i++) {
          const b = cell[i];
          if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ)
            return true;
        }
        const oc = SN.obbBins[(iz + dz) * SN.BIN_COUNT + ix + dx];
        for (let i = 0; i < oc.length; i++) {
          const b = oc[i];
          if (SN.obbPush(x, z, r, b))
            return true;
        }
      }
    return false;
  };

  SN.safePosition = function safePosition(x, z, r = 0.3, car = null) {
    const valid = (px, pz) => SN.terrainSlope(px, pz) < 0.48 && (car ? !SN.carBlocked(px, pz, car.yaw, car) && !SN.carWater(px, pz, car.yaw, car) : !SN.blocked(px, pz, r));
    if (Number.isFinite(x) && Number.isFinite(z) && valid(x, z))
      return { x, z };
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      x = -40;
      z = -770;
    }
    for (let radius = 2; radius <= 320; radius += 2) {
      const steps = Math.max(12, Math.ceil(radius * SN.TAU / 3));
      for (let i = 0; i < steps; i++) {
        const angle = i * SN.TAU / steps, px = x + Math.sin(angle) * radius, pz = z + Math.cos(angle) * radius;
        if (valid(px, pz))
          return { x: px, z: pz };
      }
    }
    throw new Error("无法找到可通行的出生位置");
  };

  SN.validateSpawns = function validateSpawns() {
    for (const c of SN.cars) {
      const p = SN.safePosition(c.x, c.z, 1.2, c);
      c.x = p.x;
      c.z = p.z;
      SN.resetVehicleGround(c);
      c.root.position.set(c.x, c.y, c.z);
      if (c.occupant) {
        c.occupant.x = c.x;
        c.occupant.z = c.z;
      }
    }
    for (const a of SN.actors) {
      if (a.inCar || a.shopId)
        continue;
      const p = SN.safePosition(a.x, a.z);
      a.x = a.homeX = p.x;
      a.z = a.homeZ = p.z;
    }
    for (const p of SN.pickups) {
      const safe = SN.safePosition(p.x, p.z, 0.55);
      p.x = safe.x;
      p.z = safe.z;
      p.root.position.set(p.x, SN.surfaceHeight(p.x, p.z) + 0.06, p.z);
    }
    for (const h of SN.hospitals)
      Object.assign(h, SN.safePosition(h.x, h.z, 0.35));
    const p = SN.safePosition(SN.player.x, SN.player.z);
    SN.player.x = p.x;
    SN.player.z = p.z;
    SN.player.y = SN.surfaceHeight(p.x, p.z);
    SN.player.fallPeak = SN.player.y;
    SN.playerRoot.position.set(SN.player.x, SN.player.y, SN.player.z);
    SN.validateCampaignLocations();
  };

  SN.validateCity = function validateCity() {
    for (const d of SN.cityDistricts) {
      const p = SN.safePosition(d.travel[0], d.travel[1], 1.3);
      d.travel = [p.x, p.z];
      if (SN.blocked(p.x, p.z, 0.5))
        throw new Error("城区接驳点不可通行：" + d.id);
    }
    for (const h of SN.hospitals)
      if (SN.blocked(h.x, h.z, 0.3))
        throw new Error("医疗转运点不可通行");
    for (const contact of SN.contacts)
      if (SN.blocked(contact.x, contact.z, 0.3))
        throw new Error("联系人不可到达：" + contact.id);
    for (const b of SN.placedBuildings) {
      const ground = SN.footprintTerrain(b.x, b.z, b.w, b.d, b.yaw);
      if (!ground.buildable || b.foundationBase > ground.low + 0.02 || b.base < ground.high)
        throw new Error("建筑地基未贴合地形");
    }
    for (const site of SN.authoredBuildingSites)
      if (!site.ground.buildable || site.floor < site.ground.high)
        throw new Error("地标地基未贴合地形");
    for (const spec of SN.enterableSpecs.concat(SN.shopSpecs, SN.smallShopSpecs))
      if (!SN.authoredTerrain(spec).buildable)
        throw new Error("商店地基位于陡坡");
    for (const c of SN.cars)
      if (SN.carBlocked(c.x, c.z, c.yaw, c) || SN.carWater(c.x, c.z, c.yaw, c))
        throw new Error("车辆出生点不可通行");
    for (const a of SN.actors)
      if (!a.inCar && !a.shopId && SN.blocked(a.x, a.z, 0.3))
        throw new Error("角色出生点不可通行");
    if (SN.blocked(SN.player.x, SN.player.z, 0.3))
      throw new Error("玩家出生点不可通行");
    if (SN.bridges.length !== 9)
      throw new Error("跨江路网缺失");
    const root = SN.nearestRoadNode(-40, -770), seen = new Set([root]), queue = [root];
    for (let i = 0; i < queue.length; i++)
      for (const link of SN.roadNodes[queue[i]].links)
        if (!seen.has(link.index)) {
          seen.add(link.index);
          queue.push(link.index);
        }
    for (const d of SN.cityDistricts)
      if (!seen.has(SN.nearestRoadNode(...d.travel)))
        throw new Error("城区道路未连通：" + d.id);
  };
  // Startup phase 4: keep this order relative to the other systems.

  SN.registerInit(4, function initializeWorld4() {
    // Seoul layout: the Han River runs west-east across the south, Namsan sits in the centre.
    SN.RIVER_N = 60;
    SN.RIVER_S = 860;
    SN.BRIDGE_DECK = 9;
    SN.island = { x: -1050, z: 450, rx: 690, rz: 235 };
    SN.lakePark = { x: 2720, z: 1730, rx: 150, rz: 95 };
    SN.bridges = [];
    // Bugaksan and Inwangsan behind the palace, Namsan in the middle, hills on every edge.
    // Smooth compact foothills, warped ridges and broad valleys; north is -Z.
    SN.hillDefs = [
      [-300, -2930, 1250, 510],
      [700, -3070, 1000, 430],
      [-900, 3150, 1150, 470],
      [450, 3300, 950, 380],
      [500, -1370, 410, 31],
      [-1100, -230, 390, 28],
      [-80, -1390, 320, 154],
      [-1090, -1080, 350, 160],
      [930, -1180, 270, 95],
      [0, -340, 345, 116],
      [280, -300, 195, 44],
      [-1140, -150, 240, 65],
      [1160, -380, 260, 67],
      [1120, 1320, 290, 63],
      [-1140, 1280, 300, 62]
    ];
    SN.roadProfileCells = new Map();
    SN.roadProfiles = [];
    SN.retainingBatch = [];
    SN.medianBatch = [];
    SN.medianSolids = [];
    // Han riverside promenades: both banks, plus Yeouido's park loop.
    // Compressed Seoul atlas. North is -Z; units are metres. Buildings are original.
    SN.cityDistricts = [
      {
        id: "jongno",
        name: "钟路 · 光化门",
        ko: "종로 · 광화문",
        x: 0,
        z: -800,
        rx: 820,
        rz: 350,
        color: "#cfb581",
        travel: [-40, -770]
      },
      {
        id: "bukchon",
        name: "北村坡巷",
        ko: "북촌",
        x: 500,
        z: -1360,
        rx: 360,
        rz: 380,
        color: "#c6a88b",
        travel: [620, -1180]
      },
      {
        id: "myeong",
        name: "明洞 · 南大门",
        ko: "명동 · 남대문",
        x: 340,
        z: -470,
        rx: 540,
        rz: 300,
        color: "#e7a9a7",
        travel: [390, -446]
      },
      {
        id: "station",
        name: "首尔站",
        ko: "서울역",
        x: -1230,
        z: -620,
        rx: 360,
        rz: 310,
        color: "#abbfc9",
        travel: [-1230, -800]
      },
      {
        id: "namsan",
        name: "南山",
        ko: "남산",
        x: 0,
        z: -340,
        rx: 280,
        rz: 270,
        color: "#8eae88",
        travel: [-330, -480]
      },
      {
        id: "itaewon",
        name: "梨泰院 · 龙山",
        ko: "이태원 · 용산",
        x: -1050,
        z: -190,
        rx: 400,
        rz: 230,
        color: "#c79bcb",
        travel: [-1100, -100]
      },
      {
        id: "hongdae",
        name: "弘大 · 新村",
        ko: "홍대 · 신촌",
        x: -1900,
        z: -730,
        rx: 650,
        rz: 630,
        color: "#e0b68d",
        travel: [-1900, -800]
      },
      {
        id: "yeouido",
        name: "汝矣岛",
        ko: "여의도",
        x: -1050,
        z: 450,
        rx: 690,
        rz: 235,
        color: "#b7cbbc",
        travel: [-1450, 450]
      },
      {
        id: "gangnam",
        name: "江南 · 德黑兰路",
        ko: "강남 · 테헤란로",
        x: 300,
        z: 1430,
        rx: 1000,
        rz: 600,
        color: "#8cbcc8",
        travel: [-130, 1084]
      },
      {
        id: "samseong",
        name: "三成 · 会展区",
        ko: "삼성",
        x: 1600,
        z: 1410,
        rx: 550,
        rz: 540,
        color: "#9faed5",
        travel: [1600, 1060]
      },
      {
        id: "jamsil",
        name: "蚕室 · 湖畔",
        ko: "잠실",
        x: 2700,
        z: 1440,
        rx: 700,
        rz: 800,
        color: "#a5cfb8",
        travel: [2750, 1060]
      },
      {
        id: "seongsu",
        name: "圣水 · 工坊街",
        ko: "성수",
        x: 1760,
        z: -350,
        rx: 750,
        rz: 570,
        color: "#c9aa88",
        travel: [1900, -430]
      },
      {
        id: "gimpo",
        name: "金浦机场",
        ko: "김포공항",
        x: -2900,
        z: -1930,
        rx: 620,
        rz: 1150,
        color: "#9cb8cb",
        travel: [-2530, -1500]
      }
    ];
    SN.cityServices = SN.cityDistricts.map(d => ({
      id: d.id,
      label: d.name,
      x: d.travel[0] + 46,
      z: d.travel[1] - 48,
      policeX: d.travel[0] + 90,
      policeZ: d.travel[1] - 48
    }));
    SN.landmarkReserves = [
      { x: -2840, z: -1900, r: 970 },
      { x: 500, z: -1360, r: 270 },
      { x: -1230, z: -610, r: 155 },
      { x: -1900, z: -1130, r: 240 },
      { x: -1900, z: -570, r: 100 },
      { x: -1370, z: 335, r: 110 },
      { x: -500, z: 520, r: 85 },
      { x: 1760, z: 1330, r: 175 },
      { x: 2740, z: 1390, r: 160 },
      { x: 2720, z: 1730, r: 200 },
      { x: 2260, z: 1300, r: 190 },
      { x: 650, z: 1600, r: 155 },
      { x: -500, z: -550, r: 90 }
    ];
    for (let i = 0; i < 12; i++)
      SN.landmarkReserves.push({ x: 1540 + i % 4 * 145, z: -670 + Math.floor(i / 4) * 170, r: 48 });
    SN.elevatedSegments = [];
    SN.elevatedCells = new Map();
    SN.elevatedIndexed = 0;
    SN.paths = [
      { a: [-1120, 32], b: [1120, 32], w: 9, name: "한강공원 북측 산책로" },
      { a: [-1010, 420], b: [-815, 420], w: 8, name: "여의도공원 서측 산책로" },
      { a: [-745, 470], b: [-540, 470], w: 8, name: "여의도공원 동측 산책로" },
      { a: [-830, 340], b: [-830, 560], w: 8, name: "여의도 세로 산책로" }
    ];
    SN.hillTrails = [
      { a: [0, -150], b: [-55, -215], w: 5 },
      { a: [-55, -215], b: [-38, -285], w: 5 },
      { a: [-38, -285], b: [0, -318], w: 5 },
      { a: [-30, -1076], b: [-56, -1130], w: 5 },
      { a: [-56, -1130], b: [-80, -1185], w: 5 },
      { a: [-720, 34], b: [-700, -30], w: 6 },
      { a: [700, 60], b: [700, 20], w: 6 }
    ];
    SN.paths.push(...SN.hillTrails);
    // The south promenade follows the bank curve in short segments instead of a fixed z.
    for (const x of [-2700, -2100, -1450, -780, -130, 560, 1150, 1900, 2750])
      for (const z of [-105, 970]) {
        SN.elevatedSegments.push({ a: [x, z - 85], b: [x, z], w: 34, y0: 0.2, y1: 8 }, { a: [x, z], b: [x, z + 85], w: 34, y0: 8, y1: 0.2 });
      }
    for (const [batch, lift] of [[SN.roadBatch, 0.09], [SN.sideBatch, 0.13], [SN.curbBatch, 0.19], [SN.markBatch, 0.195]])
      for (const p of batch) {
        if (p.fixedHeight || p.sy > 0.6)
          continue;
        const h = SN.roadHeight(p.x, p.z);
        if (Number.isFinite(h)) {
          p.y = h + lift;
          const dx = Math.sin(p.yaw) * p.sz / 2, dz = Math.cos(p.yaw) * p.sz / 2;
          p.pitch = -Math.atan2(SN.roadHeight(p.x + dx, p.z + dz) - SN.roadHeight(p.x - dx, p.z - dz), p.sz);
        }
      }
    for (let x = -3520; x < 3520; x += 160)
      SN.paths.push({ a: [x, SN.riverSouth(x) + 12], b: [x + 160, SN.riverSouth(x + 160) + 12], w: 8, name: "한강공원 남측 산책로" });
    SN.terrainDivisions = 740;
    SN.groundGeo = new SN.T.PlaneGeometry(SN.EXTENT * 2, SN.EXTENT * 2, SN.terrainDivisions, SN.terrainDivisions);
    SN.groundGeo.rotateX(-SN.PI / 2);
    SN.gp = SN.groundGeo.attributes.position;
    SN.gc = new Float32Array(SN.gp.count * 3);
    SN.terrainColor = new SN.T.Color();
    for (let i = 0; i < SN.gp.count; i++) {
      const x = SN.gp.getX(i), z = SN.gp.getZ(i);
      SN.gp.setY(i, (SN.pointInRiver(x, z) || SN.inLake(x, z)) ? -2.2 : SN.hillHeight(x, z) - 0.12);
    }
    for (let i = 0; i < SN.gp.count; i++) {
      const x = SN.gp.getX(i),
        z = SN.gp.getZ(i),
        h = SN.gp.getY(i),
        row = SN.terrainDivisions + 1,
        spacing = SN.EXTENT * 2 / SN.terrainDivisions;
      const slope = Math.hypot(SN.gp.getY(Math.min(SN.gp.count - 1, i + 1)) - SN.gp.getY(Math.max(0, i - 1)), SN.gp.getY(Math.min(SN.gp.count - 1, i + row)) - SN.gp.getY(Math.max(0, i - row))) / (spacing * 2),
        grain = SN.terrainNoise(x / 45, z / 45);
      SN.terrainColor.setHex(slope > 0.64 ? 0x8b9083 : slope > 0.4 ? 0x6b765d : h > 24 ? 0x3e6749 : 0x718b56).convertSRGBToLinear();
      SN.terrainColor.multiplyScalar(0.9 + grain * 0.2);
      SN.gc[i * 3] = SN.terrainColor.r;
      SN.gc[i * 3 + 1] = SN.terrainColor.g;
      SN.gc[i * 3 + 2] = SN.terrainColor.b;
    }
    SN.groundGeo.setAttribute("color", new SN.T.BufferAttribute(SN.gc, 3));
    SN.groundGeo.computeVertexNormals();
    SN.terrainPages = [];
    SN.terrainMaterial = SN.mat(0xffffff, { vertexColors: true, flatShading: false });
    for (let tz = 0; tz < SN.terrainDivisions; tz += 40)
      for (let tx = 0; tx < SN.terrainDivisions; tx += 40) {
        const nx = Math.min(40, SN.terrainDivisions - tx),
          nz = Math.min(40, SN.terrainDivisions - tz),
          positions = [],
          colors = [],
          indices = [];
        for (let z = 0; z <= nz; z++)
          for (let x = 0; x <= nx; x++) {
            const i = (tz + z) * (SN.terrainDivisions + 1) + tx + x;
            positions.push(SN.gp.getX(i), SN.gp.getY(i), SN.gp.getZ(i));
            colors.push(SN.gc[i * 3], SN.gc[i * 3 + 1], SN.gc[i * 3 + 2]);
          }
        for (let z = 0; z < nz; z++)
          for (let x = 0; x < nx; x++) {
            const a = z * (nx + 1) + x, b = a + nx + 1;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
          }
        const geo = new SN.T.BufferGeometry();
        geo.setAttribute("position", new SN.T.Float32BufferAttribute(positions, 3));
        geo.setAttribute("color", new SN.T.Float32BufferAttribute(colors, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mesh = SN.meshAt(geo, SN.terrainMaterial, 0, 0, 0);
        mesh.castShadow = false;
        SN.terrainPages.push({
          mesh,
          tx,
          tz,
          nx,
          nz,
          x: -SN.EXTENT + (tx + nx / 2) * (SN.EXTENT * 2 / SN.terrainDivisions),
          z: -SN.EXTENT + (tz + nz / 2) * (SN.EXTENT * 2 / SN.terrainDivisions)
        });
      }
    // The Han River: both shores and Yeouido use the same functions as collision.
    SN.waterVertices = [];
    SN.waterNormals = [];
    for (let x = -SN.WORLD; x < SN.WORLD; x += 20)
      for (let z = 0; z < 900; z += 20) {
        if (!SN.pointInRiver(x + 10, z + 10) || SN.onIsland(x + 10, z + 10))
          continue;
        const v = [x, -0.65, z, x, -0.65, z + 20, x + 20, -0.65, z, x + 20, -0.65, z, x, -0.65, z + 20, x + 20, -0.65, z + 20];
        SN.waterVertices.push(...v);
        for (let n = 0; n < 6; n++)
          SN.waterNormals.push(0, 1, 0);
      }
    SN.waterGeo = new SN.T.BufferGeometry();
    SN.waterGeo.setAttribute("position", new SN.T.Float32BufferAttribute(SN.waterVertices, 3));
    SN.waterGeo.setAttribute("normal", new SN.T.Float32BufferAttribute(SN.waterNormals, 3));
    SN.waterTime = { value: 0 };
    SN.waterNight = { value: 0 };
    SN.waterSun = { value: new SN.T.Vector3(-0.8, 0.35, -0.25) };
    SN.waterSunColor = { value: new SN.T.Color(0xffd9a3).convertSRGBToLinear() };
    SN.waterSkyHorizon = { value: new SN.T.Color(0xf8bc88).convertSRGBToLinear() };
    SN.waterSkyTop = { value: new SN.T.Color(0x397b91).convertSRGBToLinear() };
    SN.waterMat = SN.mat(0x559b9b, { metalness: 0.5, roughness: 0.24, envMapIntensity: 1.15 });
    SN.waterMat.onBeforeCompile = s => {
      s.uniforms.uTime = SN.waterTime;
      s.uniforms.uNight = SN.waterNight;
      s.uniforms.uSunDir = SN.waterSun;
      s.uniforms.uSunColor = SN.waterSunColor;
      s.uniforms.uSkyHorizon = SN.waterSkyHorizon;
      s.uniforms.uSkyTop = SN.waterSkyTop;
      s.fragmentShader = "uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyHorizon; uniform vec3 uSkyTop;\n" + s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace("#include <tonemapping_fragment>", `vec3 lakeView=normalize(cameraPosition-vLake);vec3 lakeHalf=normalize(lakeView+normalize(uSunDir));vec3 lakeUp=vec3(0.,1.,0.);float lakeGlint=pow(max(dot(lakeUp,lakeHalf),0.),150.)*max(dot(lakeUp,normalize(uSunDir)),0.)*2.6;outgoingLight+=uSunColor*lakeGlint;float lakeMirror=pow(1.-max(dot(lakeUp,lakeView),0.),3.);outgoingLight=mix(outgoingLight,uSkyHorizon*.85+uSkyTop*.15,lakeMirror*.3);
#include <tonemapping_fragment>`);
      s.vertexShader = "uniform float uTime; varying vec3 vLake;\n" + s.vertexShader;
      s.vertexShader = s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vLake=position; transformed.y += sin(position.x*.055+uTime*.7)*.12+cos(position.z*.07+uTime*.5)*.09;");
      s.vertexShader = s.vertexShader.replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n objectNormal=normalize(vec3(-.018*cos(position.x*.055+uTime*.7),1.,.015*sin(position.z*.07+uTime*.5)));");
      s.fragmentShader = "uniform float uTime; uniform float uNight; varying vec3 vLake;\n" + s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n float ripple=sin(vLake.x*.16+vLake.z*.11+uTime)*sin(vLake.z*.22-uTime*.6); diffuseColor.rgb += vec3(.12,.16,.14)*pow(max(ripple,0.),12.)*(1.-uNight*.8);");
    };
    SN.water = SN.meshAt(SN.waterGeo, SN.waterMat, 0, 0, 0);
    SN.water.castShadow = false;
    for (let x = -SN.WORLD; x < SN.WORLD; x += 20) {
      SN.strip(SN.sideBatch, x, SN.riverNorth(x), x + 20, SN.riverNorth(x + 20), 12, 0.16, 0.45);
      SN.strip(SN.foamBatch, x, SN.riverNorth(x), x + 20, SN.riverNorth(x + 20), 7, -0.56, 0.14);
      SN.strip(SN.sideBatch, x, SN.riverSouth(x), x + 20, SN.riverSouth(x + 20), 12, 0.16, 0.45);
      SN.strip(SN.foamBatch, x, SN.riverSouth(x), x + 20, SN.riverSouth(x + 20), 7, -0.56, 0.14);
    }
    SN.roads = [];
    SN.bridgeGirders = [];
    // Static props discovered before the collision grid exists are queued, then flushed.
    SN.propSolids = [];
    SN.propOBBs = [];
    SN.collidersReady = false;
    SN.addBridge("한강대교", -130, -70, 930, 30);
    SN.addBridge("양화대교", -780, -70, 930, 30);
    SN.addBridge("성수대교", 560, -70, 930, 28);
    // Downtown grid: Sejong-daero sweeps around the west flank of Namsan to the main bridge.
    SN.addRoad("세종대로", [
      [0, -840],
      [-90, -730],
      [-210, -620],
      [-320, -490],
      [-390, -360],
      [-405, -240],
      [-350, -130],
      [-245, -55],
      [-150, -30],
      [-130, -30]
    ], 32);
    SN.addRoad("종로", [[-1140, -800], [900, -800]], 30);
    SN.addRoad("을지로", [[-1080, -640], [1030, -640]], 26);
    SN.addRoad("명동길", [[290, -430], [560, -430]], 7, true);
    SN.addRoad("명동 동쪽길", [[560, -430], [860, -430]], 18);
    SN.addRoad("퇴계로", [[-1140, -40], [920, -40]], 28);
    SN.addRoad("서대문로", [[-700, -940], [-700, -40]], 28);
    SN.addRoad("남대문로", [[360, -800], [360, -40]], 24);
    SN.addRoad("동호로", [[560, -820], [560, -70]], 28);
    SN.addRoad("동대문로", [[760, -940], [760, -40]], 28);
    SN.addRoad("광장시장길", [[760, -700], [980, -700]], 18);
    SN.addRoad("남산순환로", [
      [-330, -480],
      [-200, -535],
      [-40, -505],
      [100, -430],
      [130, -320],
      [70, -215],
      [-15, -180],
      [-65, -255],
      [0, -320]
    ], 18);
    // Gangnam: the two signature boulevards plus the river approaches.
    SN.addRoad("강남대로", [[-130, 930], [-130, 1245]], 32);
    SN.addRoad("테헤란로", [[-1120, 1060], [1150, 1060]], 32);
    SN.addRoad("봉은사로", [[-1140, 900], [1150, 900]], 30);
    SN.addRoad("영동대로", [[560, 930], [560, 1245]], 30);
    SN.addRoad("양화로", [[-780, -940], [-780, -70]], 30);
    SN.addRoad("양화로 남단", [[-780, 930], [-780, 1245]], 28);
    SN.addRoad("여의대로", [[-1040, 450], [-520, 450]], 26);
    // Nine crossings, with approach roads connecting the two banks and western island.
    for (const [name, x] of [["가양대교", -2700], ["성산대교", -2100], ["서강대교", -1450], ["동호대교", 1150], ["청담대교", 1900], ["잠실대교", 2750]])
      SN.addBridge(name, x, -70, 930, 28);
    for (const x of [-2700, -2100, -1450, -780, -130, 560, 1150, 1900, 2750]) {
      SN.addRoad("北岸桥头", [[x, -800], [x, -70]], 20);
      SN.addRoad("南岸桥头", x === 2750 ? [[x, 930], [x, 1120], [3100, 1200], [3100, 2020]] : [[x, 930], [x, 2020]], 24);
    }
    SN.addRoad("北岸联络路", [[-3400, -40], [3400, -40]], 24);
    SN.addRoad("南岸联络路", [[-3400, 900], [3400, 900]], 24);
    SN.addRoad("양화로 · 弘大新村", [[-2700, -800], [-2100, -800], [-1450, -800], [-1140, -800]], 30);
    SN.addRoad("서부간선", [[-2380, -2300], [-2380, -1300], [-2700, -800]], 24);
    SN.addRoad("机场接驳路", [[-2700, -1500], [-2530, -1500], [-2300, -1300], [-2300, -800]], 22);
    SN.addRoad("터미널 순환로", [[-2530, -2300], [-2380, -2300], [-2380, -1500], [-2530, -1500], [-2530, -2300]], 18);
    SN.addRoad("신촌로", [[-2300, -1300], [-1450, -1300], [-1450, -800]], 24);
    SN.addRoad("홍익로", [
      [-1900, -1300],
      [-2130, -1300],
      [-2130, -950],
      [-1900, -950],
      [-1900, -800],
      [-1900, -430],
      [-1450, -430]
    ], 18);
    SN.addRoad("버스킹 골목", [[-2100, -570], [-1700, -570]], 8);
    SN.addRoad("서울역 진입로", [[-1450, -800], [-1115, -800], [-1115, -430], [-1230, -430], [-1140, -40]], 22);
    SN.addRoad("이태원로", [[-1450, -100], [-1100, -100], [-850, -180], [-700, -40]], 14);
    SN.addRoad("남대문 시장길", [[-700, -550], [-390, -550]], 10);
    SN.addRoad("북촌로", [[360, -800], [360, -1160], [620, -1180], [620, -1540], [360, -1540]], 10);
    SN.addRoad("북촌 골목", [[360, -1360], [520, -1300], [620, -1360]], 6);
    SN.addRoad("동부 도심", [[760, -800], [1900, -800], [2750, -800], [3200, -430]], 26);
    SN.addRoad("성수 공방길", [[860, -430], [2750, -430]], 18);
    SN.addRoad("성수 창고길", [[1450, -800], [1450, -180], [2250, -180], [2250, -800]], 14);
    SN.addRoad("테헤란로 동쪽", [[1150, 1060], [3200, 1060]], 32);
    SN.addRoad("남부 순환로", [[-2700, 2020], [3200, 2020]], 26);
    SN.addRoad("삼성로", [[1600, 900], [1600, 2020]], 28);
    SN.addRoad("잠실 호수길", [[2450, 1060], [2450, 1920], [3000, 1920], [3000, 1060]], 18);
    SN.addRoad("터미널로", [[560, 1600], [1150, 1600]], 24);
    SN.addRoad("여의도 순환로", [[-1560, 450], [-1450, 450], [-1050, 450], [-780, 450], [-480, 450]], 22);
    // Bent service lanes divide deep blocks into narrow, independently seeded lots.
    SN.addRoad("잔등 골목", [[-700, -720], [-580, -724], [-490, -701], [-300, -701]], 4.6, true);
    SN.addRoad("벽돌 골목", [[-620, -800], [-622, -724], [-601, -640]], 4.2, true);
    SN.addRoad("솔빛 골목", [[-700, -920], [-560, -911], [-420, -930], [-350, -800]], 5.2, true);
    SN.addRoad("종이등 골목", [[360, -535], [418, -524], [480, -548], [560, -530]], 4.2, true);
    SN.addRoad("여울 골목", [[420, -640], [421, -524], [436, -430], [422, -320], [560, -302]], 4.4, true);
    SN.addRoad("오래뜰 골목", [[360, -250], [445, -258], [560, -240]], 4.6, true);
    SN.addRoad("도시뒤안길", [[-700, 1160], [-420, 1148], [-130, 1170], [140, 1152], [560, 1164]], 6.4);
    // Elevated riverside highways descend at their ends; ramps join each district.
    for (const bank of [-1, 1]) {
      const z = bank < 0 ? -105 : 970,
        points = [[-3400, z], [-3240, z], [3240, z], [3400, z]],
        name = bank < 0 ? "강변북로 · 江边北路" : "올림픽대로 · 奥林匹克大路";
      for (let i = 0; i < 3; i++)
        SN.elevatedSegments.push({ a: points[i], b: points[i + 1], w: 26, y0: i === 0 ? 0.2 : 8, y1: i === 2 ? 0.2 : 8 });
      SN.addRoad(name, points, 24);
      for (const x of [-2700, -2100, -1450, -780, -130, 560, 1150, 1900, 2750]) {
        const target = bank < 0 ? -250 : 1120, pts = [[x - 170, z], [x - 80, z + bank * 30], [x, target]];
        SN.elevatedSegments.push({ a: pts[0], b: pts[1], w: 12, y0: 8, y1: 5 }, { a: pts[1], b: pts[2], w: 12, y0: 5, y1: 0.2 });
        SN.addRoad("匝道 · " + name, pts, 10);
      }
      for (let x = -3200; x <= 3200; x += 65) {
        SN.record(SN.sideBatch, x, 3.8, z, 1.8, 7.6, 12);
        for (const side of [-1, 1])
          SN.record(SN.railBatch, x, 9, z + side * 12.6, 64, 0.85, 0.28);
      }
    }
    for (const x of [-2700, -2100, -1450, -780, -130, 560, 1150, 1900, 2750])
      for (const z of [-105, 970]) {
        SN.elevatedSegments.push({ a: [x, z - 85], b: [x, z], w: 34, y0: 0.2, y1: 8 }, { a: [x, z], b: [x, z + 85], w: 34, y0: 8, y1: 0.2 });
      }
    for (const [batch, lift] of [[SN.roadBatch, 0.09], [SN.sideBatch, 0.13], [SN.curbBatch, 0.19], [SN.markBatch, 0.195]])
      for (const p of batch) {
        if (p.fixedHeight || p.sy > 0.6)
          continue;
        const h = SN.roadHeight(p.x, p.z);
        if (Number.isFinite(h)) {
          p.y = h + lift;
          const dx = Math.sin(p.yaw) * p.sz / 2, dz = Math.cos(p.yaw) * p.sz / 2;
          p.pitch = -Math.atan2(SN.roadHeight(p.x + dx, p.z + dz) - SN.roadHeight(p.x - dx, p.z - dz), p.sz);
        }
      }
    for (let x = -3520; x < 3520; x += 160)
      SN.paths.push({ a: [x, SN.riverNorth(x) - 18], b: [x + 160, SN.riverNorth(x + 160) - 18], w: 9, name: "汉江北岸公园" });
    // Cut/fill is baked into both render terrain and the sampled surface.
    for (let i = 0; i < SN.gp.count; i++) {
      const x = SN.gp.getX(i), z = SN.gp.getZ(i);
      SN.gp.setY(i, (SN.pointInRiver(x, z) || SN.inLake(x, z)) ? -2.2 : SN.roadTerrainHeight(x, z, SN.gp.getY(i) + 0.12) - 0.12);
    }
    SN.groundGeo.computeVertexNormals();
    for (const page of SN.terrainPages) {
      const position = page.mesh.geometry.attributes.position;
      let index = 0;
      for (let z = 0; z <= page.nz; z++)
        for (let x = 0; x <= page.nx; x++) {
          position.setY(index++, SN.gp.getY((page.tz + z) * (SN.terrainDivisions + 1) + page.tx + x));
        }
      position.needsUpdate = true;
      page.mesh.geometry.computeVertexNormals();
      page.mesh.geometry.computeBoundingSphere();
    }
    // Open medians at every junction, preserving turning space and pedestrian crossings.
    for (let i = SN.medianBatch.length - 1; i >= 0; i--) {
      const p = SN.medianBatch[i];
      if (SN.roads.some(r => r.points.some((a, j) => {
        if (!j)
          return false;
        const b = r.points[j - 1], yaw = Math.atan2(a[0] - b[0], a[1] - b[1]);
        return Math.abs(Math.sin(yaw - p.yaw)) > 0.2 && SN.segmentDistance(p.x, p.z, ...a, ...b) < r.width / 2 + 7;
      }))) {
        SN.medianBatch.splice(i, 1);
        SN.medianSolids.splice(i, 1);
      }
    }
    // Kerbs stop at junctions; the road remains level through the crossing.
    for (const list of [SN.sideBatch, SN.curbBatch]) {
      const clipped = [];
      for (const p of list) {
        if (p.sy > 0.6 || p.sx > 5 || p.sz < 5) {
          clipped.push(p);
          continue;
        }
        const pieces = Math.ceil(p.sz / 1.6), length = p.sz / pieces;
        for (let i = 0; i < pieces; i++) {
          const along = -p.sz / 2 + (i + 0.5) * length, x = p.x + Math.sin(p.yaw) * along, z = p.z + Math.cos(p.yaw) * along;
          if (SN.inDrivingLane(x, z, -0.02))
            continue;
          clipped.push({ ...p, x, z, y: p.y - Math.sin(p.pitch || 0) * along, sz: length + 0.012 });
        }
      }
      list.length = 0;
      for (const p of clipped)
        list.push(p);
    }
    SN.eastWest = [["종로", -800], ["을지로", -640], ["명동길", -430], ["퇴계로", -40], ["봉은사로", 900], ["테헤란로", 1060]];
    // Rasterize once. Runtime sampling is four typed-array reads, with no road scans.
    SN.SURFACE_CELL = 2;
    SN.SURFACE_ORIGIN = -SN.EXTENT;
    SN.SURFACE_SIZE = SN.EXTENT * 2 / SN.SURFACE_CELL + 1;
    SN.localSurfacePatches = [];
    SN.surfaceGrid = new Float32Array(SN.SURFACE_SIZE * SN.SURFACE_SIZE);
    SN.surfaceTypes = new Uint8Array(SN.surfaceGrid.length);
    for (let iz = 0; iz < SN.SURFACE_SIZE; iz++)
      for (let ix = 0; ix < SN.SURFACE_SIZE; ix++)
        SN.surfaceGrid[iz * SN.SURFACE_SIZE + ix] = SN.terrainHeight(SN.SURFACE_ORIGIN + ix * SN.SURFACE_CELL, SN.SURFACE_ORIGIN + iz * SN.SURFACE_CELL) + 0.01;
    for (const r of SN.roads)
      for (let j = 0; j < r.points.length - 1; j++) {
        const a = r.points[j], b = r.points[j + 1], w = r.width / 2 + (r.sidewalkW || 3.5) + 0.3;
        SN.rasterSurface(Math.min(a[0], b[0]) - w, Math.max(a[0], b[0]) + w, Math.min(a[1], b[1]) - w, Math.max(a[1], b[1]) + w, (x, z) => SN.segmentDistance(x, z, ...a, ...b) < w, (x, z) => SN.roadHeight(x, z) + (SN.segmentDistance(x, z, ...a, ...b) < r.width / 2 ? 0.17 : 0.35), 1);
      }
    SN.rasterSurface(SN.island.x - SN.island.rx, SN.island.x + SN.island.rx, SN.island.z - SN.island.rz, SN.island.z + SN.island.rz, SN.onIsland, () => 0.93, 3);
    for (const p of SN.paths)
      SN.rasterSurface(Math.min(p.a[0], p.b[0]) - p.w, Math.max(p.a[0], p.b[0]) + p.w, Math.min(p.a[1], p.b[1]) - p.w, Math.max(p.a[1], p.b[1]) + p.w, (x, z) => SN.segmentDistance(x, z, ...p.a, ...p.b) < p.w / 2, (x, z) => SN.groundHeight(x, z) + 0.26, 3);
    // Shared collision bins keep checks local even in the dense eastern city.
    SN.bins = Array.from({ length: SN.BIN_COUNT * SN.BIN_COUNT }, () => []);
    SN.colliders = [];
    // Oriented boxes cover diagonals the axis-aligned grid cannot: railings, signposts, bridge rails.
    SN.obbColliders = [];
    SN.obbBins = Array.from({ length: SN.BIN_COUNT * SN.BIN_COUNT }, () => []);
    SN.junctionPoles = new Set();
    for (let i = SN.propSolids.length - 1; i >= 0; i--) {
      const p = SN.propSolids[i];
      if (p[2] < 1 && p[3] < 1 && SN.inDrivingLane(p[0], p[1], 0.5)) {
        SN.junctionPoles.add(p[0] + "," + p[1]);
        SN.propSolids.splice(i, 1);
      }
    }
    for (const list of [SN.lampBatch, SN.lampHeadBatch, SN.poolBatch, SN.lampPoints])
      for (let i = list.length - 1; i >= 0; i--)
        if (SN.junctionPoles.has(list[i].x + "," + list[i].z))
          list.splice(i, 1);
    SN.collidersReady = true;
    for (const p of SN.propSolids)
      SN.addCollider(p[0], p[1], p[2], p[3], p[4]);
    SN.propSolids.length = 0;
    for (const p of SN.propOBBs)
      SN.addOBB(p[0], p[1], p[2], p[3], p[4], p[5]);
    SN.propOBBs.length = 0;
    SN.circlePush = { nx: 0, nz: 0, depth: 0 };
    SN.circleResult = { x: 0, z: 0, nx: 0, nz: 0, hit: false };
  });
})(window.SN);
