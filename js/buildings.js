/* 城市建筑、地标、立面与可进入的室内空间。 */
"use strict";
(function (SN) {
  SN.facadeHook = function facadeHook(shader) {
    shader.fragmentShader = "varying vec3 vPbrWorld;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
 float litHash=fract(sin(dot(floor(vPbrWorld/3.2),vec3(127.1,311.7,74.7)))*43758.5453);
 totalEmissiveRadiance*=(.58+.42*litHash);`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
 float facadeRoughHash=fract(sin(dot(floor(vPbrWorld.xz/7.5),vec2(12.9898,78.233)))*43758.5453);
 roughnessFactor*=.86+.14*facadeRoughHash;`);
  };

  SN.zoneFree = function zoneFree(x, z, pad = 0) {
    for (let i = 0; i < SN.clearZones.length; i++) {
      const c = SN.clearZones[i];
      if (Math.hypot(x - c.x, z - c.z) < c.r + pad)
        return false;
    }
    return true;
  };

  SN.inPalace = function inPalace(x, z, pad = 0) {
    return x > -315 - pad && x < 335 + pad && z > -1105 - pad && z < -820 + pad;
  };

  SN.inMyeong = function inMyeong(x, z) {
    return x > 288 && x < 575 && z > -585 && z < -168;
  };
  // Each frontage has its own repeatable random stream, independent of prop order.

  SN.lotRng = function lotRng(value) {
    let state = value >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  };

  SN.authoredFootprint = function authoredFootprint(spec, x = spec.x, z = spec.z) {
    return spec.id === "cafe" ? { x: x + 2, z: z + 5, w: 18, d: 24 } : { x, z, w: spec.w, d: spec.d };
  };

  SN.authoredTerrain = function authoredTerrain(spec, x = spec.x, z = spec.z) {
    const plot = SN.authoredFootprint(spec, x, z);
    return SN.footprintTerrain(plot.x, plot.z, plot.w, plot.d);
  };

  SN.foundationGround = function foundationGround(x, z) {
    const road = SN.roadSample(x, z);
    return road ? SN.roadHeight(x, z) + (road.distance < road.profile.width / 2 ? 0.17 : 0.35) : SN.onIsland(x, z) ? 0.93 : SN.terrainHeight(x, z) + 0.01;
  };

  SN.footprintTerrain = function footprintTerrain(x, z, w, d, yaw = 0) {
    let low = Infinity, high = -Infinity, slope = 0;
    const co = Math.cos(yaw), sn = Math.sin(yaw), nx = Math.max(2, Math.ceil(w / 4)), nz = Math.max(2, Math.ceil(d / 4));
    for (let iz = 0; iz <= nz; iz++)
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx - 0.5) * w,
          v = (iz / nz - 0.5) * d,
          px = x + u * co + v * sn,
          pz = z - u * sn + v * co,
          h = SN.foundationGround(px, pz);
        low = Math.min(low, h);
        high = Math.max(high, h);
        slope = Math.max(slope, SN.terrainSlope(px, pz));
      }
    return { low, high, slope, buildable: slope < 0.3 && high - low < Math.min(5, Math.min(w, d) * 0.28 + 1) };
  };

  SN.addFoundation = function addFoundation(x, z, w, d, yaw, ground, floor) {
    SN.record(SN.foundationBatch, x, (ground.low - 0.6 + floor) / 2, z, w + 0.12, floor - ground.low + 0.6, d + 0.12, yaw);
  };

  SN.rectOverlap = function rectOverlap(a, b, gap = 0) {
    const ac = Math.cos(a.yaw || 0),
      as = Math.sin(a.yaw || 0),
      bc = Math.cos(b.yaw || 0),
      bs = Math.sin(b.yaw || 0),
      dx = b.x - a.x,
      dz = b.z - a.z;
    for (const axis of [[ac, -as], [as, ac], [bc, -bs], [bs, bc]]) {
      const nx = axis[0],
        nz = axis[1],
        ra = Math.abs(nx * ac - nz * as) * a.w / 2 + Math.abs(nx * as + nz * ac) * a.d / 2,
        rb = Math.abs(nx * bc - nz * bs) * b.w / 2 + Math.abs(nx * bs + nz * bc) * b.d / 2;
      if (Math.abs(dx * nx + dz * nz) >= ra + rb + gap)
        return false;
    }
    return true;
  };

  SN.footprintFree = function footprintFree(x, z, w, d, yaw = 0) {
    const a = { x, z, w, d, yaw };
    for (const b of SN.placedBuildings) {
      if (Math.hypot(x - b.x, z - b.z) > (w + d + b.w + b.d) * 0.55 + 4)
        continue;
      if (SN.rectOverlap(a, b, 1.6))
        return false;
    }
    return true;
  };

  SN.roadGap = function roadGap(x, z, w, d, yaw = 0) {
    const lot = { x, z, w, d, yaw };
    for (const path of SN.paths) {
      const dx = path.b[0] - path.a[0], dz = path.b[1] - path.a[1];
      if (SN.segmentDistance(x, z, ...path.a, ...path.b) > Math.hypot(w, d) / 2 + path.w / 2 + 1)
        continue;
      if (SN.rectOverlap(lot, {
        x: (path.a[0] + path.b[0]) / 2,
        z: (path.a[1] + path.b[1]) / 2,
        w: path.w + 1,
        d: Math.hypot(dx, dz),
        yaw: Math.atan2(dx, dz)
      }))
        return false;
    }
    for (const road of SN.roads)
      for (let j = 1; j < road.points.length; j++) {
        const a = road.points[j - 1],
          b = road.points[j],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          clearance = road.width + 2 * ((road.sidewalkW || 3.5) + 0.4);
        if (SN.segmentDistance(x, z, ...a, ...b) > Math.hypot(w, d) / 2 + clearance / 2)
          continue;
        if (SN.rectOverlap(lot, { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, w: clearance, d: len, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) }))
          return false;
      }
    return true;
  };

  SN.buildingFaces = function buildingFaces(b) {
    const w = b.w || b.sx, d = b.d || b.sz, angle = b.yaw || 0, c = Math.cos(angle), s = Math.sin(angle);
    return [
      { nx: 0, nz: 1, yaw: 0, w, depth: d / 2 },
      { nx: 1, nz: 0, yaw: SN.PI / 2, w: d, depth: w / 2 },
      { nx: 0, nz: -1, yaw: SN.PI, w, depth: d / 2 },
      { nx: -1, nz: 0, yaw: -SN.PI / 2, w: d, depth: w / 2 }
    ].map(f => ({ ...f, nx: f.nx * c + f.nz * s, nz: -f.nx * s + f.nz * c, yaw: f.yaw + angle }));
  };

  SN.lotPoint = function lotPoint(b, u, v) {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    return { x: b.x + u * c + v * s, z: b.z - u * s + v * c };
  };

  SN.addBuilding = function addBuilding(cx, cz, w, d, h, glass = false, yaw = 0, lotSeed = 1, era = "office") {
    if (!Number.isFinite(h) || h < 6)
      return null;
    const random = SN.lotRng(lotSeed),
      radius = Math.hypot(w, d) / 2,
      ground = SN.footprintTerrain(cx, cz, w, d, yaw),
      base = Math.max(0.4, ground.high + 0.12),
      candidate = { x: cx, z: cz, w, d, yaw };
    if (SN.isWater(cx, cz) || SN.onCauseway(cx, cz, -radius) || !ground.buildable || !SN.zoneFree(cx, cz, radius * 0.78) || SN.inPalace(cx, cz, radius) || !SN.footprintFree(cx, cz, w, d, yaw) || !SN.roadGap(cx, cz, w, d, yaw))
      return null;
    for (const u of [-w / 2, w / 2])
      for (const v of [-d / 2, d / 2]) {
        const corner = SN.lotPoint(candidate, u, v);
        if (SN.isWater(corner.x, corner.z))
          return null;
      }
    const variant = glass ? 3 : Math.floor(random() * 3),
      setback = glass && h > 64,
      lowerH = setback ? h * 0.68 : h,
      tint = [0xcbd0c6, 0xb7c1c2, 0xd4c6b1, 0xb5c3c5, 0xc8b9a4][Math.floor(random() * 5)],
      b = { ...candidate, h, base, era, seed: lotSeed, variant, lowerH, setback, upperW: w * 0.73, upperD: d * 0.76 };
    b.foundationBase = ground.low;
    b.foundationFloor = base;
    SN.addFoundation(cx, cz, w, d, yaw, ground, base);
    SN.record(SN.buildingBatches[variant], cx, base + lowerH / 2, cz, w, lowerH, d, yaw, tint);
    SN.buildingBatches[variant][SN.buildingBatches[variant].length - 1].lot = b;
    if (era === "brick")
      SN.urbanShells.push({
        g: SN.urbanBlockGeo,
        x: cx,
        y: base + lowerH / 2,
        z: cz,
        sx: w,
        sy: lowerH,
        sz: d,
        yaw,
        color: [0xc9b3a0, 0xf0d8c1, 0xbda4a0][Math.floor(random() * 3)]
      });
    SN.addOBB(cx, cz, w, d, lowerH, yaw, base);
    SN.placedBuildings.push(b);
    if (setback) {
      SN.record(SN.buildingBatches[variant], cx, base + lowerH + (h - lowerH) / 2, cz, b.upperW, h - lowerH, b.upperD, yaw, tint);
      SN.buildingBatches[variant][SN.buildingBatches[variant].length - 1].upper = true;
      SN.addOBB(cx, cz, b.upperW, b.upperD, h, yaw, base);
      SN.record(SN.roofBatch, cx, base + lowerH + 0.13, cz, w + 0.25, 0.26, d + 0.25, yaw);
    }
    const rw = setback ? b.upperW : w, rd = setback ? b.upperD : d;
    SN.record(SN.roofBatch, cx, base + h + 0.12, cz, rw + 0.28, 0.24, rd + 0.28, yaw);
    for (const side of [-1, 1]) {
      let p = SN.lotPoint(b, 0, side * (rd / 2 - 0.12));
      SN.record(SN.urbanRoofParts, p.x, base + h + 0.5, p.z, rw, 0.8, 0.24, yaw);
      p = SN.lotPoint(b, side * (rw / 2 - 0.12), 0);
      SN.record(SN.urbanRoofParts, p.x, base + h + 0.5, p.z, 0.24, 0.8, rd, yaw);
    }
    const hut = SN.lotPoint(b, rw * 0.18, -rd * 0.22);
    SN.record(SN.urbanRoofParts, hut.x, base + h + 1.25, hut.z, glass ? rw * 0.28 : 3.2, 2.5, glass ? rd * 0.34 : 2.8, yaw);
    SN.record(SN.roofBatch, hut.x, base + h + 2.59, hut.z, (glass ? rw * 0.28 : 3.2) + 0.3, 0.18, (glass ? rd * 0.34 : 2.8) + 0.3, yaw);
    return b;
  };

  SN.textTexture = function textTexture(text, bg = "#173c43", fg = "#d3ead4", width = 512, height = 128) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const g = c.getContext("2d");
    g.fillStyle = bg;
    g.fillRect(0, 0, width, height);
    g.strokeStyle = fg + "88";
    g.lineWidth = 3;
    g.strokeRect(7, 7, width - 14, height - 14);
    g.fillStyle = fg;
    g.font = "500 " + Math.floor(height * 0.48) + "px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, width / 2, height * 0.51, width * 0.91);
    const tex = SN.tuneTexture(new SN.T.CanvasTexture(c));
    tex.encoding = SN.T.sRGBEncoding;
    return tex;
  };

  SN.sign = function sign(text, x, y, z, w, h, yaw = 0, neon = false) {
    const tex = SN.textTexture(text, neon ? "#16353c" : "#1d5657", neon ? "#c7ffe5" : "#e7eed7");
    const material = SN.mat(0xffffff, {
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: neon ? 0.65 : 0.04,
      side: SN.T.DoubleSide
    });
    if (neon)
      SN.neonMats.push(material);
    const m = SN.meshAt(new SN.T.PlaneGeometry(w, h), material, x, y, z, 1, 1, 1, yaw);
    m.castShadow = false;
    return m;
  };
  // Namsan: an original observation tower on the summit, plus a winding road and trails.

  SN.namsanTower = function namsanTower(x, z) {
    const foundation = SN.footprintTerrain(x, z, 24, 24), y = foundation.high + 0.12, g = new SN.T.Group();
    SN.addFoundation(x, z, 24, 24, 0, foundation, y);
    g.position.set(x, y, z);
    SN.scene.add(g);
    const conc = SN.mat(0xd7dcd8, { roughness: 0.55 }),
      deckMat = SN.mat(0x9db3b8, { metalness: 0.35, roughness: 0.35 }),
      red = SN.mat(0xc0493d, { emissive: 0x8e2c25, emissiveIntensity: 0.4 });
    SN.meshAt(new SN.T.CylinderGeometry(22, 27, 5, 16), SN.stoneMat, 0, 2.5, 0, 1, 1, 1, 0, g);
    SN.addCollider(x, z, 46, 46, 7);
    SN.meshAt(new SN.T.CylinderGeometry(5.2, 7.4, 94, 12), conc, 0, 52, 0, 1, 1, 1, 0, g);
    SN.meshAt(new SN.T.CylinderGeometry(13.5, 15, 8, 16), deckMat, 0, 103, 0, 1, 1, 1, 0, g);
    SN.meshAt(new SN.T.CylinderGeometry(15.1, 15.1, 4.2, 16), SN.mat(0x7d9ea7, { metalness: 0.85, roughness: 0.16, envMapIntensity: 1.2 }), 0, 109, 0, 1, 1, 1, 0, g);
    SN.meshAt(new SN.T.CylinderGeometry(8, 10, 7, 12), conc, 0, 116, 0, 1, 1, 1, 0, g);
    SN.meshAt(new SN.T.CylinderGeometry(2.2, 4.2, 10, 10), deckMat, 0, 124, 0, 1, 1, 1, 0, g);
    SN.meshAt(new SN.T.CylinderGeometry(0.5, 1.2, 26, 8), conc, 0, 140, 0, 1, 1, 1, 0, g);
    SN.meshAt(new SN.T.ConeGeometry(1.2, 7, 8), red, 0, 156, 0, 1, 1, 1, 0, g);
    SN.meshAt(new SN.T.SphereGeometry(1.1, 8, 6), SN.mat(0xff6a55, { emissive: 0xff4a35, emissiveIntensity: 2.2 }), 0, 160, 0, 1, 1, 1, 0, g);
    SN.sign("남 산 · 首尔塔", x, y + 13, z + 30, 20, 3.6, 0, true);
  };

  SN.roofParts = function roofParts(x, y, z, w, d, h) {
    SN.palaceRoof.push({ g: new SN.T.CylinderGeometry(0.14, 1, 1, 4, 1), x, y, z, sx: w * 0.72, sy: h, sz: d * 0.72, ry: SN.PI / 4 });
    SN.palaceRoof.push({
      g: new SN.T.CylinderGeometry(1, 1.09, 0.34, 4, 1),
      x,
      y: y - h * 0.5,
      z,
      sx: w * 0.76,
      sy: 1,
      sz: d * 0.76,
      ry: SN.PI / 4
    });
  };

  SN.palaceHall = function palaceHall(x, z, w, d, roofH) {
    SN.palaceStone.push({ g: SN.box, x, y: 1.3, z, sx: w + 14, sy: 2.6, sz: d + 12 });
    SN.palaceStone.push({ g: SN.box, x, y: 0.55, z: z + d * 0.5 + 8, sx: 12, sy: 1.1, sz: 8 });
    for (const sx of [-1, 0, 1])
      for (const sz of [-1, 1])
        SN.palaceWood.push({ g: SN.box, x: x + sx * (w * 0.42), y: 7, z: z + sz * (d * 0.4), sx: 0.85, sy: 9, sz: 0.85 });
    for (const sz of [-1, 1])
      for (const sx of [-1, 1])
        SN.palaceWood.push({ g: SN.box, x: x + sx * (w * 0.45), y: 7, z: z + sz * (d * 0.43), sx: 0.85, sy: 9, sz: 0.85 });
    SN.palaceWood.push({ g: SN.box, x, y: 11.2, z, sx: w * 0.92, sy: 0.7, sz: d * 0.9 });
    SN.roofParts(x, 12.2 + roofH * 0.5, z, w + 7, d + 7, roofH);
    SN.palaceRoof.push({ g: SN.box, x, y: 12.2 + roofH, z, sx: w * 0.42, sy: 0.7, sz: 1.1 });
    SN.palaceWood.push({ g: SN.box, x, y: 6, z, sx: w * 0.72, sy: 7, sz: d * 0.64 });
    SN.addCollider(x, z, w + 14, d + 12, roofH + 12);
  };
  // Perimeter walls, with a gate opening on the south side.

  SN.palaceWall = function palaceWall(x1, z1, x2, z2) {
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, len = Math.hypot(x2 - x1, z2 - z1), yaw = Math.atan2(x2 - x1, z2 - z1);
    SN.palaceStone.push({ g: SN.box, x: mx, y: 2.1, z: mz, sx: 1.8, sy: 4.2, sz: len, ry: yaw });
    SN.palaceRoof.push({ g: SN.box, x: mx, y: 4.4, z: mz, sx: 2.25, sy: 0.4, sz: len, ry: yaw });
    SN.addCollider(mx, mz, Math.abs(x2 - x1) + 1.8, Math.abs(z2 - z1) + 1.8, 4.6);
  };

  SN.hillPath = function hillPath(points, width) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], len = Math.hypot(a[0] - b[0], a[1] - b[1]), steps = Math.ceil(len / 5);
      SN.rasterSurface(Math.min(a[0], b[0]) - width, Math.max(a[0], b[0]) + width, Math.min(a[1], b[1]) - width, Math.max(a[1], b[1]) + width, (x, z) => SN.segmentDistance(x, z, ...a, ...b) < width / 2, (x, z) => SN.hillHeight(x, z) + 0.22, 2);
      for (let j = 0; j < steps; j++) {
        const t = (j + 0.5) / steps, x = SN.lerp(a[0], b[0], t), z = SN.lerp(a[1], b[1], t);
        SN.record(SN.sideBatch, x, SN.hillHeight(x, z) + 0.11, z, width, 0.22, len / steps + 0.3, Math.atan2(b[0] - a[0], b[1] - a[1]));
        SN.sideBatch[SN.sideBatch.length - 1].pitch = -Math.atan2(SN.hillHeight(SN.lerp(a[0], b[0], (j + 1) / steps), SN.lerp(a[1], b[1], (j + 1) / steps)) - SN.hillHeight(SN.lerp(a[0], b[0], j / steps), SN.lerp(a[1], b[1], j / steps)), len / steps);
      }
    }
  };

  SN.detailTiles = function detailTiles(geo, material, list, shadows = false, tile = 48, minQ = 0) {
    tile = Math.min(tile, 48);
    const tiles = new Map();
    for (const p of list) {
      const key = Math.floor(p.x / tile) + "," + Math.floor(p.z / tile);
      if (!tiles.has(key))
        tiles.set(key, []);
      tiles.get(key).push(p);
    }
    for (const [key, entries] of tiles) {
      SN.registerTile(geo, material, entries, shadows, tile, key, 120, minQ);
      SN.cityTiles[SN.cityTiles.length - 1].detail = true;
    }
  };

  SN.updateDetailCulling = function updateDetailCulling() {
    SN.streamCity();
  };

  SN.onRoadway = function onRoadway(x, z, pad = 0) {
    return SN.inDrivingLane(x, z, pad);
  };
  // Near street architecture: actual reveals, metal frames and lived-in balconies.

  SN.facadePart = function facadePart(list, b, f, u, y, out, w, h, d, color = null, geo = SN.box) {
    const tx = Math.cos(f.yaw), tz = -Math.sin(f.yaw);
    list.push({
      g: geo,
      x: b.x + f.nx * (f.depth + out) + tx * u,
      y: b.base + y,
      z: b.z + f.nz * (f.depth + out) + tz * u,
      sx: w,
      sy: h,
      sz: d,
      yaw: f.yaw,
      color
    });
  };

  SN.buildUrbanDetailPage = function buildUrbanDetailPage(page) {
    const urbanConcrete = [],
      urbanMetal = [],
      urbanDark = [],
      urbanGlass = [],
      urbanBrick = [],
      urbanFabric = [],
      urbanPlants = [],
      urbanAC = [],
      urbanTanks = [],
      urbanSigns = [];
    const tileStart = SN.cityTiles.length;
    for (const b of page.buildings) {
      const random = SN.lotRng(b.seed ^ 174329),
        faces = SN.buildingFaces(b),
        floorHeight = b.era === "brick" ? 3.1 : 3.2,
        roofY = b.h,
        rw = b.setback ? b.upperW : b.w,
        rd = b.setback ? b.upperD : b.d;
      for (let faceIndex = 0; faceIndex < faces.length; faceIndex++) {
        const f = faces[faceIndex],
          front = faceIndex === 0,
          bays = Math.max(2, Math.floor((f.w - 1) / (b.era === "brick" ? 3.3 : 2.8))),
          bayW = (f.w - 0.7) / bays,
          rows = Math.max(1, Math.min(8, Math.floor((b.lowerH - 5.5) / floorHeight) + 1)),
          wall = b.era === "brick" ? urbanBrick : urbanConcrete;
        for (let floor = 0; floor < rows; floor++) {
          const y = 4.6 + floor * floorHeight, windowH = b.era === "brick" ? 1.5 : 1.95;
          SN.facadePart(wall, b, f, 0, y + windowH / 2 + 0.45, 0.16, f.w - 0.5, 0.65, 0.27);
          for (let bay = 0; bay < bays; bay++) {
            const u = -f.w / 2 + 0.35 + (bay + 0.5) * bayW, ww = bayW * (b.era === "brick" ? 0.62 : 0.76), shade = random();
            // Glazing is 22 cm behind the surrounding masonry and aluminium reveal.
            SN.facadePart(urbanGlass, b, f, u, y, 0.065, ww, windowH, 0.04, [0xa8b5b6, 0x6f8e99, 0xc2b7a0, 0x899796][Math.floor(shade * 4)]);
            for (const side of [-1, 1]) {
              SN.facadePart(wall, b, f, u + side * (ww / 2 + (bayW - ww) / 4), y, 0.18, (bayW - ww) / 2, windowH + 0.6, 0.3);
              SN.facadePart(urbanMetal, b, f, u + side * ww / 2, y, 0.28, 0.065, windowH + 0.12, 0.12);
              SN.facadePart(urbanMetal, b, f, u, y + side * windowH / 2, 0.27, ww + 0.13, 0.065, 0.13);
            }
            SN.facadePart(urbanMetal, b, f, u + (b.seed % 3 - 1) * ww * 0.16, y, 0.2, 0.045, windowH, 0.08);
            SN.facadePart(urbanConcrete, b, f, u, y - windowH / 2 - 0.08, 0.34, ww + 0.3, 0.13, 0.48);
            if (shade > 0.72)
              SN.facadePart(urbanFabric, b, f, u, y + windowH * 0.25, 0.095, ww * 0.95, windowH * 0.42, 0.025, 0xc7c0ad);
            if (front && floor % 2 === 0 && bay % 3 === 1 && b.era !== "tower") {
              const by = y - windowH / 2 - 0.15;
              SN.facadePart(urbanConcrete, b, f, u, by, 0.72, ww + 0.65, 0.16, 1.35);
              for (const railY of [by + 0.2, by + 1.05])
                SN.facadePart(urbanMetal, b, f, u, railY, 1.35, ww + 0.65, 0.055, 0.055);
              for (let rail = -ww / 2 - 0.25; rail <= ww / 2 + 0.25; rail += 0.28)
                SN.facadePart(urbanMetal, b, f, u + rail, by + 0.62, 1.35, 0.035, 0.9, 0.035);
              for (const side of [-1, 1])
                SN.facadePart(urbanMetal, b, f, u + side * (ww + 0.65) / 2, by + 0.65, 0.7, 0.055, 0.85, 1.35);
              SN.facadePart(urbanConcrete, b, f, u - ww * 0.3, by + 0.28, 0.94, 0.48, 0.4, 0.36);
              SN.facadePart(urbanPlants, b, f, u - ww * 0.3, by + 0.6, 0.94, 0.35, 0.35, 0.28, 0x628369, SN.leafGeo);
              if (shade > 0.4) {
                SN.facadePart(urbanMetal, b, f, u, by + 1.7, 0.75, ww, 0.025, 0.025);
                for (let item = 0; item < 3; item++)
                  SN.facadePart(urbanFabric, b, f, u - ww * 0.32 + item * ww * 0.31, by + 1.36, 0.75, 0.35, 0.62, 0.025, [0xb9c9cf, 0xc59b8f, 0xd1c8aa][item]);
              }
            }
            if ((bay + floor + b.seed) % 9 === 0)
              SN.facadePart(urbanAC, b, f, u + ww * 0.38, y - 1.1, 0.52, 1, 1, 1, null, SN.acGeo);
          }
        }
        // Drainpipes, elbows and brackets continue to the roofline.
        if (b.era !== "tower") {
          const pipeU = f.w / 2 - 0.48;
          SN.facadePart(urbanDark, b, f, pipeU, b.h / 2, 0.32, 0.085, b.h, 0.085);
          for (let y = 1; y < b.h; y += 3.1)
            SN.facadePart(urbanMetal, b, f, pipeU, y, 0.25, 0.19, 0.08, 0.4);
          SN.facadePart(urbanDark, b, f, pipeU - 0.24, 0.5, 0.32, 0.55, 0.08, 0.08);
        }
        if (front && b.era !== "tower")
          for (let panel = 0; panel < Math.min(SN.inMyeong(b.x, b.z) ? 3 : 1, Math.max(1, Math.floor((b.h - 4) / 2.3))); panel++) {
            const u = f.w / 2 - 0.9 - panel * 0.95,
              y = Math.min(5.7, b.h - 1.6) + panel * 2.3,
              out = 0.85,
              idx = (b.seed + panel) % 8;
            SN.facadePart(urbanDark, b, f, u, y, 0.48, 0.08, 0.18, 1.2);
            SN.facadePart(urbanDark, b, f, u, y, out, 0.85, 3.2, 0.24);
            SN.facadePart(urbanSigns, b, f, u, y, out + 0.14, 0.75, 3.05, 1, null, SN.verticalGeos[idx]);
          }
      }
      // Roof fences, clustered condensers, antennas and tank bases use per-lot seeds.
      for (const side of [-1, 1]) {
        const f = SN.buildingFaces({ ...b, w: rw, d: rd })[side < 0 ? 2 : 0];
        SN.facadePart(urbanMetal, b, f, 0, roofY + 1.25, -0.15, rw, 0.065, 0.065);
        for (let u = -rw / 2 + 0.4; u < rw / 2; u += 1.8)
          SN.facadePart(urbanMetal, b, f, u, roofY + 0.9, -0.15, 0.045, 0.75, 0.045);
      }
      for (let i = 0; i < 2 + b.seed % 4; i++) {
        const p = SN.lotPoint(b, (random() - 0.5) * rw * 0.6, (random() - 0.5) * rd * 0.6);
        SN.record(urbanAC, p.x, b.base + roofY + 0.75, p.z, 1.6, 1.5, 1.6, b.yaw);
      }
      const tank = SN.lotPoint(b, -rw * 0.23, -rd * 0.18);
      SN.record(urbanTanks, tank.x, b.base + roofY + 1.3, tank.z, 0.8, 1.7, 0.8, b.yaw, 0xaeb8b4);
      SN.record(urbanConcrete, tank.x, b.base + roofY + 0.35, tank.z, 1.9, 0.5, 1.9, b.yaw);
      const aerial = SN.lotPoint(b, rw * 0.3, rd * 0.2);
      SN.record(urbanMetal, aerial.x, b.base + roofY + 2.1, aerial.z, 0.05, 4.2, 0.05);
      for (let i = 0; i < 4; i++)
        SN.record(urbanMetal, aerial.x, b.base + roofY + 2.6 + i * 0.35, aerial.z, 1.1 - i * 0.16, 0.025, 0.025, b.yaw);
      // Exterior metal flights occupy only genuine gaps, never a neighbour or road.
      if (b.era === "brick" && b.seed % 3 === 0) {
        const center = SN.lotPoint(b, b.w / 2 + 0.85, 0), stair = { x: center.x, z: center.z, w: 1.5, d: 9, yaw: b.yaw };
        if (SN.roadGap(stair.x, stair.z, stair.w, stair.d, stair.yaw) && !SN.placedBuildings.some(other => other !== b && SN.rectOverlap(stair, other, 0.25))) {
          for (let step = 0; step < 32; step++) {
            const v = -4.35 + step * 0.28, p = SN.lotPoint(b, b.w / 2 + 0.85, v), top = b.base + 0.35 + (step + 1) * 0.19;
            SN.record(urbanMetal, p.x, top - 0.035, p.z, 1.25, 0.07, 0.29, b.yaw);
            if (step % 4 === 0) {
              SN.record(urbanDark, p.x, top - 0.55, p.z, 0.06, 1.1, 0.06, b.yaw);
              const edge = SN.lotPoint(b, b.w / 2 + 1.5, v);
              SN.record(urbanMetal, edge.x, top + 0.5, edge.z, 0.045, 1, 0.045, b.yaw);
            }
          }
          const landing = SN.lotPoint(b, b.w / 2 + 0.85, 4.8);
          SN.record(urbanMetal, landing.x, b.base + 6.43, landing.z, 1.4, 0.14, 1.2, b.yaw);
        }
      }
    }
    for (const [material, parts] of [
      [SN.detailConcrete, urbanConcrete],
      [SN.detailMetal, urbanMetal],
      [SN.detailDark, urbanDark],
      [SN.cityPalette.glass, urbanGlass],
      [SN.cityPalette.brick, urbanBrick],
      [SN.laundryMat, urbanFabric],
      [SN.urbanSignMaterial, urbanSigns]
    ])
      SN.staticCityTiles(material, parts, 120, 48, true, false);
    SN.detailTiles(SN.leafGeo, SN.leafMat, urbanPlants, false);
    SN.detailTiles(SN.acGeo, SN.detailMetal, urbanAC, false);
    SN.detailTiles(SN.cylinder, SN.detailMetal, urbanTanks, false);
    page.tiles = SN.cityTiles.slice(tileStart);
    page.ready = true;
  };

  SN.streamUrbanDetails = function streamUrbanDetails(px, pz, force) {
    const pending = [], retired = new Set();
    for (const page of SN.urbanDetailPages) {
      const distance = Math.hypot(px - page.x, pz - page.z);
      if (distance < 192 && !page.ready)
        pending.push({ page, distance });
      else if (distance > 340 && page.ready) {
        for (const tile of page.tiles) {
          retired.add(tile);
          if (tile.mesh) {
            SN.scene.remove(tile.mesh);
            tile.mesh.geometry.dispose();
            if (tile.mesh.dispose)
              tile.mesh.dispose();
          }
        }
        page.tiles = [];
        page.ready = false;
      }
    }
    if (retired.size)
      for (let i = SN.cityTiles.length - 1; i >= 0; i--)
        if (retired.has(SN.cityTiles[i]))
          SN.cityTiles.splice(i, 1);
    pending.sort((a, b) => a.distance - b.distance);
    const deadline = performance.now() + (force ? 24 : 3);
    let count = 0;
    for (const entry of pending) {
      SN.buildUrbanDetailPage(entry.page);
      count++;
      if (count >= (force ? 4 : 1) || performance.now() > deadline)
        break;
    }
  };

  SN.iMat = function iMat(color, extra) {
    const key = color + "|" + (extra ? JSON.stringify(extra) : "");
    let m = SN.enterableMats.get(key);
    if (!m) {
      m = SN.mat(color, extra);
      SN.enterableMats.set(key, m);
    }
    return m;
  };

  SN.mergedMesh = function mergedMesh(parts, color, extra, shadow = true) {
    if (!parts.length)
      return null;
    const mesh = new SN.T.Mesh(SN.merged(parts), SN.iMat(color, extra));
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    SN.scene.add(mesh);
    return mesh;
  };

  SN.wallBand = function wallBand(list, axis, a0, a1, coord, y, height, thick) {
    const len = a1 - a0;
    if (len <= 0.02)
      return;
    const mid = (a0 + a1) / 2;
    if (axis === "x")
      list.push({ g: SN.box, x: mid, y: y + height / 2, z: coord, sx: len, sy: height, sz: thick });
    else
      list.push({ g: SN.box, x: coord, y: y + height / 2, z: mid, sx: thick, sy: height, sz: len });
  };

  SN.buildCafeRoof = function buildCafeRoof(facade, base, spec) {
    const dx = spec.x - 34, dz = spec.z + 600;
    const mergedMesh = (parts, color, extra, shadow = true) => SN.cafeRoofBuilders.mergedMesh(parts.map(part => ({ ...part, x: part.x + dx, z: part.z + dz })), color, extra, shadow);
    const addCollider = (x, z, w, d, h) => SN.cafeRoofBuilders.addCollider(x + dx, z + dz, w, d, h);
    const addOBB = (x, z, w, d, h, yaw = 0, floor = null) => SN.cafeRoofBuilders.addOBB(x + dx, z + dz, w, d, h, yaw, floor);
    const rasterSurface = (x0, x1, z0, z1, test, height, type) => SN.cafeRoofBuilders.rasterSurface(x0 + dx, x1 + dx, z0 + dz, z1 + dz, (x, z) => test(x - dx, z - dz), (x, z) => height(x - dx, z - dz), type);
    const glow = (parent, x, y, z, size, color) => SN.cafeRoofBuilders.glow(parent, x + dx, y, z + dz, size, color);
    const sign = (text, x, y, z, w, h, yaw = 0, neon = false) => SN.cafeRoofBuilders.sign(text, x + dx, y, z + dz, w, h, yaw, neon);
    SN.addFoundation(34 + dx, -589 + dz, 8, 10, 0, SN.footprintTerrain(34 + dx, -589 + dz, 8, 10), base);
    // Rear annex with a walkable roof. The exterior stair + landing are baked
    // into the height field so the player simply walks up.
    const ax0 = 30, ax1 = 38, az0 = -594, az1 = -584, roofY = base + 3.82, th = 0.3;
    rasterSurface(ax0, ax1, az0, az1, () => true, () => roofY, 2);
    const shell = [], trim = [];
    // four annex walls, with a roof-level gap in the east wall where the landing arrives
    SN.wallBand(shell, "x", ax0, ax1, az0, base, roofY - base, th);
    SN.wallBand(shell, "x", ax0, ax1, az1, base, roofY - base, th);
    SN.wallBand(shell, "z", az0, az1, ax0, base, roofY - base, th);
    SN.wallBand(shell, "z", az0, -593.8, ax1, base, roofY - base, th);
    SN.wallBand(shell, "z", -591.4, az1, ax1, base, roofY - base, th);
    addCollider(ax0, az0, 0.4, az1 - az0, roofY - base);
    addCollider((ax0 + ax1) / 2, az0, ax1 - ax0, th, roofY - base);
    addCollider((ax0 + ax1) / 2, az1, ax1 - ax0, th, roofY - base);
    addCollider(ax1, (az0 - 593.8) / 2, th, Math.abs(-593.8 - az0), roofY - base);
    addCollider(ax1, (-591.4 + az1) / 2, th, az1 + 591.4, roofY - base);
    mergedMesh(shell, facade);
    // roof slab and parapets
    const parapet = 0x5f6b66;
    mergedMesh([{ g: SN.box, x: (ax0 + ax1) / 2, y: roofY - 0.11, z: (az0 + az1) / 2, sx: ax1 - ax0 + 0.3, sy: 0.22, sz: az1 - az0 + 0.3 }], 0x8d918a);
    const rails = [];
    SN.wallBand(rails, "x", ax0, ax1, az0, roofY, 0.92, 0.22);
    SN.wallBand(rails, "x", ax0, ax1, az1, roofY, 0.92, 0.22);
    SN.wallBand(rails, "z", az0, az1, ax0, roofY, 0.92, 0.22);
    addOBB((ax0 + ax1) / 2, az0, ax1 - ax0, 0.3, 1.05, 0, roofY);
    addOBB((ax0 + ax1) / 2, az1, ax1 - ax0, 0.3, 1.05, 0, roofY);
    addOBB(ax0, (az0 + az1) / 2, 0.3, az1 - az0, 1.05, 0, roofY);
    // landing bridge between annex and stair head
    const lx0 = 38, lx1 = 43, lz0 = -593.6, lz1 = -591;
    rasterSurface(lx0, lx1, lz0, lz1, () => true, () => roofY, 2);
    mergedMesh([{ g: SN.box, x: (lx0 + lx1) / 2, y: roofY - 0.07, z: (lz0 + lz1) / 2, sx: lx1 - lx0, sy: 0.14, sz: lz1 - lz0 }], 0x9a9d95);
    addOBB(lx1, (lz0 + lz1) / 2, 0.26, lz1 - lz0, 1.05, 0, roofY);
    addOBB((lx0 + lx1) / 2, lz0, lx1 - lx0, 0.26, 1.05, 0, roofY);
    mergedMesh(rails, parapet);
    // stair, rising from the street to the landing
    const sx0 = 40, sx1 = 44.4, sz0 = -591, sz1 = -584.5, run = sz1 - sz0, rise = roofY - (base + 0.08);
    // Quantise the walkable height to the step tops; a smooth ramp here would put
    // the player's soles inside the visible stair treads.
    rasterSurface(sx0, sx1, sz0, sz1, x => x > sx0 + 0.1 && x < sx1 - 0.1, (x, z) => base + 0.08 + rise * Math.ceil(SN.clamp((sz1 - z) / run, 0, 1) * 12) / 12, 2);
    const steps = [];
    for (let i = 0; i < 12; i++) {
      const t = (i + 0.5) / 12, z = SN.lerp(sz1, sz0, t), y = base + 0.08 + rise * (i + 1) / 12;
      steps.push({ g: SN.box, x: (sx0 + sx1) / 2, y: y - 0.14, z, sx: sx1 - sx0, sy: 0.28, sz: Math.abs(run) / 12 + 0.06 });
    }
    mergedMesh(steps, 0x8a8e86);
    const railParts = [
      {
        g: SN.box,
        x: sx1,
        y: base + 2.1,
        z: (sz0 + sz1) / 2,
        sx: 0.1,
        sy: 0.1,
        sz: Math.hypot(run, rise),
        rx: Math.atan2(rise, run)
      }
    ];
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      railParts.push({ g: SN.box, x: sx1, y: base + 0.25 + rise * t, z: SN.lerp(sz1, sz0, t), sx: 0.12, sy: 1.05, sz: 0.12 });
    }
    mergedMesh(railParts, 0x5c6660);
    addOBB(sx1, (sz0 + sz1) / 2, 0.22, Math.abs(run), 4.4, 0, base);
    // rooftop dressing
    const plant = 0x4f6f52, pot = 0x7c6957;
    mergedMesh([
      { g: SN.box, x: 32, y: roofY + 0.35, z: -591, sx: 1.2, sy: 0.7, sz: 1.2 },
      { g: SN.box, x: 35.5, y: roofY + 0.35, z: -587, sx: 1.2, sy: 0.7, sz: 1.2 }
    ], pot);
    mergedMesh([
      { g: SN.box, x: 32, y: roofY + 0.85, z: -591, sx: 1.5, sy: 0.42, sz: 1.5 },
      { g: SN.box, x: 35.5, y: roofY + 0.85, z: -587, sx: 1.5, sy: 0.42, sz: 1.5 }
    ], plant);
    addOBB(32, -591, 1.4, 1.4, 1.1, 0, roofY);
    addOBB(35.5, -587, 1.4, 1.4, 1.1, 0, roofY);
    mergedMesh([
      { g: SN.box, x: 34, y: roofY + 0.53, z: -593.2, sx: 3.2, sy: 0.1, sz: 0.5 },
      { g: SN.box, x: 34, y: roofY + 0.25, z: -593.2, sx: 0.16, sy: 0.5, sz: 0.4 }
    ], 0x8a7052);
    addOBB(34, -593.2, 3.2, 0.6, 0.9, 0, roofY);
    mergedMesh([{ g: SN.cylinder, x: 36.4, y: roofY + 1.25, z: -585.4, sx: 0.75, sy: 2.5, sz: 0.75 }], 0xbfc6c2);
    for (let i = 0; i < 4; i++)
      glow(SN.scene, 31 + i * 2.2, roofY + 2.6, -586.2, 1.5, 0xffd9a0);
    glow(SN.scene, 36.4, roofY + 2.4, -585.4, 2, 0xffe6bb);
    sign("루프 · 屋顶", 38.2, roofY + 2.2, -591.5, 2.6, 0.5, SN.PI / 2, true);
  };

  SN.buildEnterable = function buildEnterable(spec) {
    const hw = spec.w / 2, hd = spec.d / 2;
    spec.minX = spec.x - hw;
    spec.maxX = spec.x + hw;
    spec.minZ = spec.z - hd;
    spec.maxZ = spec.z + hd;
    let top = -999;
    for (let ix = -1; ix <= 1; ix++)
      for (let iz = -1; iz <= 1; iz++)
        top = Math.max(top, SN.surfaceHeight(spec.x + ix * hw * 0.9, spec.z + iz * hd * 0.9));
    const base = Math.max(top + 0.06, SN.authoredTerrain(spec).high + 0.06), h = spec.h;
    SN.addFoundation(spec.x, spec.z, spec.w, spec.d, 0, SN.footprintTerrain(spec.x, spec.z, spec.w, spec.d), base);
    SN.rasterSurface(spec.minX, spec.maxX, spec.minZ, spec.maxZ, () => true, () => base, 2);
    const side = spec.door.side;
    spec.doorPoint = {
      x: side === "east" ? spec.maxX : side === "west" ? spec.minX : spec.x,
      z: side === "south" ? spec.maxZ : side === "north" ? spec.minZ : spec.z
    };
    spec.yaw = side === "east" ? SN.PI / 2 : side === "west" ? -SN.PI / 2 : side === "south" ? 0 : SN.PI;
    spec.outside = { x: spec.doorPoint.x + Math.sin(spec.yaw) * 2.1, z: spec.doorPoint.z + Math.cos(spec.yaw) * 2.1 };
    spec.innerPoint = { x: spec.doorPoint.x - Math.sin(spec.yaw) * 1.9, z: spec.doorPoint.z - Math.cos(spec.yaw) * 1.9 };
    const wallParts = [], innerParts = [], trimParts = [], glassParts = [], floorParts = [], darkParts = [];
    const TH = 0.36,
      DOOR_H = 2.62,
      facade = SN.facadeColors[spec.kind] || 0x59615e,
      inner = SN.innerColors[spec.kind] || 0xd6d0bd;
    for (const sideName of ["north", "south", "east", "west"]) {
      const horizontal = sideName === "north" || sideName === "south";
      const axis = horizontal ? "x" : "z";
      const coord = sideName === "north" ? spec.minZ : sideName === "south" ? spec.maxZ : sideName === "west" ? spec.minX : spec.maxX;
      const a0 = horizontal ? spec.minX : spec.minZ, a1 = horizontal ? spec.maxX : spec.maxZ;
      let spans = [[a0, a1]];
      const isDoor = sideName === side;
      if (isDoor) {
        const c = horizontal ? spec.x : spec.z,
          g0 = Math.max(a0, c - spec.door.width / 2),
          g1 = Math.min(a1, c + spec.door.width / 2);
        spans = [];
        if (g0 - a0 > 0.06)
          spans.push([a0, g0]);
        if (a1 - g1 > 0.06)
          spans.push([g1, a1]);
        SN.wallBand(wallParts, axis, g0, g1, coord, base + DOOR_H, h - DOOR_H, TH);
        for (const g of [g0, g1]) {
          if (axis === "x")
            trimParts.push({ g: SN.box, x: g, y: base + DOOR_H / 2, z: coord, sx: 0.14, sy: DOOR_H, sz: TH + 0.1 });
          else
            trimParts.push({ g: SN.box, x: coord, y: base + DOOR_H / 2, z: g, sx: TH + 0.1, sy: DOOR_H, sz: 0.14 });
        }
        if (axis === "x")
          floorParts.push({ g: SN.box, x: (g0 + g1) / 2, y: base + 0.002, z: coord, sx: g1 - g0, sy: 0.01, sz: TH + 0.5 });
        else
          floorParts.push({ g: SN.box, x: coord, y: base + 0.002, z: (g0 + g1) / 2, sx: TH + 0.5, sy: 0.01, sz: g1 - g0 });
      }
      for (const span of spans) {
        const b0 = span[0], b1 = span[1];
        SN.wallBand(wallParts, axis, b0, b1, coord, base, 0.98, TH);
        SN.wallBand(glassParts, axis, b0, b1, coord, base + 0.98, 1.52, 0.05);
        SN.wallBand(wallParts, axis, b0, b1, coord, base + 2.5, h - 2.5, TH);
        const off = sideName === "north" ? TH / 2 + 0.035 : sideName === "south" ? -TH / 2 - 0.035 : sideName === "west" ? TH / 2 + 0.035 : -TH / 2 - 0.035;
        SN.wallBand(innerParts, axis, b0, b1, coord + off, base, 1.16, 0.04);
        SN.wallBand(innerParts, axis, b0, b1, coord + off, base + 2.6, h - 2.6, 0.04);
        const len = b1 - b0, count = Math.max(1, Math.round(len / 2.6));
        for (let m = 0; m <= count; m++) {
          const p = b0 + len * m / count;
          if (axis === "x")
            trimParts.push({ g: SN.box, x: p, y: base + 1.74, z: coord, sx: 0.09, sy: 1.54, sz: TH + 0.04 });
          else
            trimParts.push({ g: SN.box, x: coord, y: base + 1.74, z: p, sx: TH + 0.04, sy: 1.54, sz: 0.09 });
        }
        SN.wallBand(trimParts, axis, b0, b1, coord, base + 2.44, 0.1, TH + 0.05);
        if (axis === "x")
          SN.addCollider((b0 + b1) / 2, coord, b1 - b0, TH, h);
        else
          SN.addCollider(coord, (b0 + b1) / 2, TH, b1 - b0, h);
      }
    }
    for (const cx of [spec.minX, spec.maxX])
      for (const cz of [spec.minZ, spec.maxZ])
        trimParts.push({ g: SN.box, x: cx, y: base + h / 2, z: cz, sx: 0.44, sy: h, sz: 0.44 });
    // floor, ceiling and a solid roof with clutter
    floorParts.push({ g: SN.box, x: spec.x, y: base - 0.08, z: spec.z, sx: spec.w, sy: 0.16, sz: spec.d });
    SN.mergedMesh(floorParts, SN.floorColors[spec.kind] || 0xb3ab97);
    SN.mergedMesh([
      { g: SN.box, x: spec.x, y: base + h - 0.2, z: spec.z, sx: spec.w - 0.4, sy: 0.14, sz: spec.d - 0.4 },
      { g: SN.box, x: spec.x, y: base + h - 0.12, z: spec.z, sx: 0.9, sy: 0.2, sz: spec.d - 0.5 }
    ], 0xd6cfbd);
    darkParts.push({ g: SN.box, x: spec.x, y: base + h + 0.02, z: spec.z, sx: spec.w + 0.4, sy: 0.24, sz: spec.d + 0.4 });
    const roofClutter = [];
    for (let i = 0; i < 2; i++)
      roofClutter.push({ g: SN.box, x: spec.x - 3 + i * 5, y: base + h + 0.55, z: spec.z + 2.2, sx: 1.15, sy: 0.85, sz: 1.5 });
    roofClutter.push({ g: SN.cylinder, x: spec.x + 3.5, y: base + h + 1.15, z: spec.z - 3.2, sx: 0.85, sy: 2.1, sz: 0.85 });
    SN.mergedMesh(roofClutter, 0x9aa29c);
    SN.mergedMesh(darkParts, 0x646c69);
    const parapet = [];
    SN.wallBand(parapet, "x", spec.minX - 0.2, spec.maxX + 0.2, spec.minZ - 0.2, base + h + 0.14, 0.62, 0.26);
    SN.wallBand(parapet, "x", spec.minX - 0.2, spec.maxX + 0.2, spec.maxZ + 0.2, base + h + 0.14, 0.62, 0.26);
    SN.wallBand(parapet, "z", spec.minZ - 0.2, spec.maxZ + 0.2, spec.minX - 0.2, base + h + 0.14, 0.62, 0.26);
    SN.wallBand(parapet, "z", spec.minZ - 0.2, spec.maxZ + 0.2, spec.maxX + 0.2, base + h + 0.14, 0.62, 0.26);
    SN.mergedMesh(parapet, 0x707975);
    SN.mergedMesh(wallParts, facade);
    SN.mergedMesh(innerParts, inner);
    SN.mergedMesh(trimParts, 0x39484a);
    SN.mergedMesh(glassParts, 0xa9d4d2, {
      transparent: true,
      opacity: 0.24,
      roughness: 0.06,
      metalness: 0.22,
      side: SN.T.DoubleSide,
      depthWrite: false
    }, false);
    // street-facing sign, hanging door plate and a soft lamp over the threshold
    const lx = spec.doorPoint.x + Math.sin(spec.yaw) * 0.24, lz = spec.doorPoint.z + Math.cos(spec.yaw) * 0.24;
    SN.sign(spec.name, lx, base + 3.42, lz, Math.min(spec.door.width + 5.4, spec.w - 1.2), 0.62, spec.yaw, true);
    SN.sign("进入", lx, base + 2.18, lz, 1.2, 0.46, spec.yaw, true);
    SN.glow(SN.scene, lx, base + 2.32, lz, 1.15, 0xa9ffe3);
    // interior lamp: two for the bigger rooms
    for (let i = 0; i < 2; i++) {
      const px = spec.x + (i ? spec.w * 0.22 : -spec.w * 0.22), pz = spec.z + (i ? spec.d * 0.2 : -spec.d * 0.2);
      const lamp = new SN.T.PointLight(spec.light, i ? 0.9 : 1.25, Math.max(spec.w, spec.d) * 0.95, 2);
      lamp.position.set(px, base + h - 0.55, pz);
      SN.scene.add(lamp);
      SN.mergedMesh([{ g: SN.box, x: px, y: base + h - 0.32, z: pz, sx: 1.7, sy: 0.07, sz: 0.34 }], 0xfff2d8, { emissive: spec.light, emissiveIntensity: 1.15 }, false);
      SN.glow(SN.scene, px, base + h - 0.4, pz, 1.5, spec.light);
    }
    SN.interiors.push({
      id: spec.id,
      name: spec.name,
      minX: spec.minX,
      maxX: spec.maxX,
      minZ: spec.minZ,
      maxZ: spec.maxZ,
      floor: base,
      ceil: base + h - 0.22,
      door: spec.doorPoint,
      inner: spec.innerPoint,
      outside: spec.outside
    });
    // Furniture is shared per colour inside each shop.
    const groups = new Map();
    function buy(color, parts) {
      if (!groups.has(color))
        groups.set(color, []);
      const list = groups.get(color);
      for (const p of parts)
        list.push(p);
    }
    function solid(x, z, w, d, height) {
      SN.addCollider(x, z, w, d, height);
    }
    const x0 = spec.minX, x1 = spec.maxX, z0 = spec.minZ, z1 = spec.maxZ, cx = spec.x, cz = spec.z;
    if (spec.kind === "store") {
      buy(0x3f6b63, [
        { g: SN.box, x: cx + 1.5, y: base + 0.55, z: cz - 3.4, sx: 1, sy: 1.08, sz: 3.8 },
        { g: SN.box, x: cx + 1.5, y: base + 1.12, z: cz - 3.4, sx: 1.1, sy: 0.08, sz: 3.9 }
      ]);
      solid(cx + 1.5, cz - 3.4, 1.15, 3.9, 1.1);
      buy(0x8a7f6a, [{ g: SN.box, x: cx + 1.5, y: base + 0.28, z: cz - 3.4, sx: 0.7, sy: 0.56, sz: 3.6 }]);
      buy(0x5d6163, [{ g: SN.box, x: cx + 1.5, y: base + 1.35, z: cz - 4.55, sx: 0.52, sy: 0.32, sz: 0.4 }]);
      buy(0x8f8574, [{ g: SN.box, x: cx - 2.5, y: base + 1, z: z0 + 1.35, sx: 5.6, sy: 2, sz: 0.9 }]);
      for (let i = 0; i < 4; i++)
        buy(0x6d5f4c, [{ g: SN.box, x: cx - 4.9 + i * 1.55, y: base + 0.55 + i * 0.44, z: z0 + 1.35, sx: 5.3, sy: 0.06, sz: 0.86 }]);
      solid(cx - 2.5, z0 + 1.35, 5.7, 1, 2);
      buy(0xbcdde2, [{ g: SN.box, x: x0 + 1, y: base + 1.15, z: cz + 1.2, sx: 1.1, sy: 2.3, sz: 4.2 }]);
      buy(0xdff7f4, [{ g: SN.box, x: x0 + 1.58, y: base + 1.3, z: cz + 1.2, sx: 0.04, sy: 1.9, sz: 3.7 }], { emissive: 0xc9f2ee, emissiveIntensity: 0.7 });
      solid(x0 + 1.05, cz + 1.2, 1.15, 4.3, 2.3);
      const goods = [[0xd05a4a, 0xe2b454, 0x5f9c8c, 0xd7d0bd], [0x8a6ec0, 0xc9705f, 0x77a9c9, 0xe3d07a]];
      for (let r = 0; r < 2; r++)
        for (let i = 0; i < 8; i++)
          buy(goods[r][i % 4], [{ g: SN.box, x: cx - 4.6 + (i % 4) * 1.1, y: base + 1.28 + r * 0.42, z: z0 + 1.87, sx: 0.34, sy: 0.3, sz: 0.26 }]);
      buy(0x4aa79a, [{ g: SN.box, x: cx, y: base + 0.02, z: cz + 1.2, sx: spec.w - 2, sy: 0.02, sz: 0.6 }]);
    }
    else if (spec.kind === "cafe") {
      buy(0x6f5138, [
        { g: SN.box, x: cx - 2.6, y: base + 0.54, z: z1 - 1.9, sx: 5.4, sy: 1.06, sz: 0.8 },
        { g: SN.box, x: cx - 2.6, y: base + 1.09, z: z1 - 1.9, sx: 5.5, sy: 0.08, sz: 0.9 }
      ]);
      solid(cx - 2.6, z1 - 1.9, 5.5, 0.95, 1.1);
      buy(0x8a6a4a, [{ g: SN.box, x: cx - 3.6, y: base + 0.42, z: z0 + 2.2, sx: 2.2, sy: 0.84, sz: 0.9 }]);
      solid(cx - 3.6, z0 + 2.2, 2.3, 1, 0.9);
      buy(0x2c3134, [
        { g: SN.cylinder, x: cx - 5.1, y: base + 1.22, z: z1 - 2.1, sx: 0.32, sy: 0.36, sz: 0.32 },
        { g: SN.box, x: cx - 5.1, y: base + 1.42, z: z1 - 2.1, sx: 0.36, sy: 0.05, sz: 0.36 }
      ]);
      for (const t of [[cx + 2.5, z0 + 3.4], [cx + 2.5, cz], [cx - 1.6, z0 + 1.7]]) {
        buy(0x8b7256, [
          { g: SN.cylinder, x: t[0], y: base + 0.72, z: t[1], sx: 0.58, sy: 0.06, sz: 0.58 },
          { g: SN.cylinder, x: t[0], y: base + 0.36, z: t[1], sx: 0.09, sy: 0.72, sz: 0.09 }
        ]);
        solid(t[0], t[1], 1.1, 1.1, 0.8);
        for (const s of [-1, 1])
          buy(0x4b5b58, [
            { g: SN.box, x: t[0] + s * 0.78, y: base + 0.28, z: t[1], sx: 0.4, sy: 0.55, sz: 0.4 },
            { g: SN.box, x: t[0] + s * 0.78, y: base + 0.58, z: t[1] - 0.16, sx: 0.42, sy: 0.6, sz: 0.08 }
          ]);
      }
      buy(0x2d3536, [{ g: SN.box, x: cx + 2.4, y: base + 2.55, z: z0 + 0.55, sx: 2.6, sy: 1, sz: 0.08 }], { emissive: 0xffcf8f, emissiveIntensity: 0.5 });
      for (const p of [[cx - 3, cz - 1.5], [cx + 2.5, cz + 1.5], [cx - 3, cz + 3.6]]) {
        SN.mergedMesh([{ g: SN.cylinder, x: p[0], y: base + 2.9, z: p[1], sx: 0.24, sy: 0.24, sz: 0.24 }], 0x2f3436);
        SN.mergedMesh([{ g: SN.box, x: p[0], y: base + 2.78, z: p[1], sx: 0.5, sy: 0.05, sz: 0.5 }], 0xffe4b8, { emissive: 0xffca83, emissiveIntensity: 1.1 }, false);
        SN.glow(SN.scene, p[0], base + 2.6, p[1], 1.2, 0xffcf94);
      }
    }
    else if (spec.kind === "police") {
      buy(0x46545c, [
        { g: SN.box, x: x1 - 2.6, y: base + 0.54, z: cz, sx: 1.1, sy: 1.08, sz: 5.6 },
        { g: SN.box, x: x1 - 2.6, y: base + 1.1, z: cz, sx: 1.2, sy: 0.08, sz: 5.7 }
      ]);
      solid(x1 - 2.6, cz, 1.25, 5.7, 1.1);
      buy(0x8d7f68, [
        { g: SN.box, x: cx - 2.5, y: base + 0.38, z: z0 + 2.2, sx: 6.4, sy: 0.42, sz: 0.6 },
        { g: SN.box, x: cx - 2.5, y: base + 0.7, z: z0 + 2.2, sx: 6.4, sy: 0.34, sz: 0.1 }
      ]);
      solid(cx - 2.5, z0 + 2.2, 6.5, 0.7, 0.8);
      buy(0xb8c7c5, [
        { g: SN.box, x: cx - 2.4, y: base + 0.38, z: cz - 1.4, sx: 2.2, sy: 0.76, sz: 1.1 },
        { g: SN.box, x: cx - 2.4, y: base + 0.8, z: cz - 1.4, sx: 2.3, sy: 0.08, sz: 1.2 }
      ]);
      solid(cx - 2.4, cz - 1.4, 2.3, 1.2, 0.85);
      buy(0x2a3c4a, [{ g: SN.box, x: x0 + 0.9, y: base + 2.3, z: cz - 1.2, sx: 0.08, sy: 1.5, sz: 3.2 }]);
      buy(0x2d4a58, [{ g: SN.box, x: cx - 2, y: base + 0.02, z: cz + 2.6, sx: 6, sy: 0.02, sz: 0.7 }]);
    }
    else if (spec.kind === "hospital") {
      buy(0x7f9a97, [
        { g: SN.box, x: x0 + 3.4, y: base + 0.55, z: cz, sx: 1.1, sy: 1.1, sz: 5.2 },
        { g: SN.box, x: x0 + 3.4, y: base + 1.12, z: cz, sx: 1.2, sy: 0.08, sz: 5.3 }
      ]);
      solid(x0 + 3.4, cz, 1.25, 5.3, 1.15);
      for (let i = 0; i < 6; i++) {
        buy(0x5d7f83, [
          { g: SN.box, x: x1 - 1.7, y: base + 0.28, z: cz - 3.2 + i * 1.25, sx: 0.7, sy: 0.56, sz: 0.6 },
          { g: SN.box, x: x1 - 1.4, y: base + 0.7, z: cz - 3.2 + i * 1.25, sx: 0.12, sy: 0.62, sz: 0.56 }
        ]);
      }
      solid(x1 - 1.7, cz, 1, 7.6, 0.9);
      buy(0xd0d8d4, [
        { g: SN.box, x: cx - 1.5, y: base + 0.82, z: cz - 2.6, sx: 2.1, sy: 0.16, sz: 0.72 },
        { g: SN.box, x: cx - 1.5, y: base + 0.44, z: cz - 2.6, sx: 1.9, sy: 0.1, sz: 0.6 }
      ]);
      for (const l of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
        buy(0x7f8a88, [{ g: SN.cylinder, x: cx - 1.5 + l[0] * 0.85, y: base + 0.26, z: cz - 2.6 + l[1] * 0.28, sx: 0.08, sy: 0.52, sz: 0.08 }]);
      solid(cx - 1.5, cz - 2.6, 2.2, 0.9, 0.95);
      buy(0xc7483f, [
        { g: SN.box, x: cx, y: base + 3, z: z0 + 0.35, sx: 0.34, sy: 1.15, sz: 0.12 },
        { g: SN.box, x: cx, y: base + 3, z: z0 + 0.35, sx: 1.15, sy: 0.34, sz: 0.12 }
      ], { emissive: 0xff5a49, emissiveIntensity: 0.65 });
      buy(0xbfe8e6, [{ g: SN.box, x: cx, y: base + 3.3, z: z0 + 0.2, sx: 2.2, sy: 0.12, sz: 0.12 }], { emissive: 0xc8f5f2, emissiveIntensity: 0.8 });
      buy(0x9cc7c4, [{ g: SN.box, x: cx, y: base + 0.02, z: cz + 1.4, sx: spec.w - 2, sy: 0.02, sz: 0.7 }]);
    }
    for (const [color, parts] of groups)
      SN.mergedMesh(parts, color);
    if (spec.kind === "cafe")
      SN.buildCafeRoof(facade, base, spec);
    spec.base = base;
    return spec;
  };

  SN.buildGarage = function buildGarage(spec) {
    const hw = spec.w / 2, hd = spec.d / 2;
    spec.minX = spec.x - hw;
    spec.maxX = spec.x + hw;
    spec.minZ = spec.z - hd;
    spec.maxZ = spec.z + hd;
    let top = -999;
    for (let ix = -1; ix <= 1; ix++)
      for (let iz = -1; iz <= 1; iz++)
        top = Math.max(top, SN.surfaceHeight(spec.x + ix * hw * 0.9, spec.z + iz * hd * 0.9));
    const base = Math.max(top + 0.06, SN.groundHeight(spec.x, spec.z) + 0.05);
    const floorY = base + 0.06, upper = base + 4.06;
    spec.doorPoint = { x: spec.x, z: spec.maxZ };
    spec.yaw = 0;
    spec.outside = { x: spec.x, z: spec.maxZ + 2.4 };
    spec.innerPoint = { x: spec.x, z: spec.maxZ - 2 };
    // lower deck (south, entered from the street), ramp (middle), roof deck (north)
    // One height function prevents the rounded grid bounds of the upper deck
    // from overwriting the last ramp sample with a half-metre ledge.
    SN.rasterSurface(spec.minX + 1, spec.maxX - 1, spec.minZ + 1, spec.maxZ, () => true, (x, z) => floorY + (upper - floorY) * SN.clamp((spec.maxZ - 8 - z) / 8, 0, 1), 2);
    const concrete = 0x707a7a, dark = 0x4e5a5c, line = 0xd9ded8;
    const parts = [];
    // floor slabs
    parts.push({ g: SN.box, x: spec.x, y: floorY - 0.08, z: spec.maxZ - 4, sx: spec.w - 1, sy: 0.16, sz: 8 });
    parts.push({ g: SN.box, x: spec.x, y: upper - 0.1, z: spec.minZ + 13, sx: spec.w - 1, sy: 0.2, sz: 26 });
    // ramp slab, tilted to match the baked heights
    parts.push({
      g: SN.box,
      x: spec.x,
      y: (floorY + upper) / 2 - 0.07,
      z: spec.maxZ - 12,
      sx: spec.w - 1.6,
      sy: 0.16,
      sz: Math.hypot(8, upper - floorY),
      rx: Math.atan2(upper - floorY, 8)
    });
    SN.mergedMesh(parts, concrete);
    // perimeter walls (5.2 m tall: upper-deck parapet included)
    const walls = [], frame = [];
    const WT = 0.42;
    SN.wallBand(walls, "x", spec.minX, spec.maxX, spec.minZ, base, 5.2, WT);
    SN.wallBand(walls, "z", spec.minZ, spec.maxZ, spec.minX, base, 5.2, WT);
    SN.wallBand(walls, "z", spec.minZ, spec.maxZ, spec.maxX, base, 5.2, WT);
    const g0 = spec.x - spec.door.width / 2, g1 = spec.x + spec.door.width / 2;
    SN.wallBand(walls, "x", spec.minX, g0, spec.maxZ, base, 5.2, WT);
    SN.wallBand(walls, "x", g1, spec.maxX, spec.maxZ, base, 5.2, WT);
    SN.wallBand(walls, "x", g0, g1, spec.maxZ, base + 3.55, 5.2 - 3.55, WT);
    SN.addCollider(spec.x, spec.minZ, spec.w, WT, 5.2);
    SN.addCollider(spec.minX, spec.z, WT, spec.d, 5.2);
    SN.addCollider(spec.maxX, spec.z, WT, spec.d, 5.2);
    SN.addCollider((spec.minX + g0) / 2, spec.maxZ, g0 - spec.minX, WT, 5.2);
    SN.addCollider((g1 + spec.maxX) / 2, spec.maxZ, spec.maxX - g1, WT, 5.2);
    // horizontal slot glazing on the side walls
    for (const s of [-1, 1]) {
      const coord = s < 0 ? spec.minX : spec.maxX;
      SN.wallBand(frame, "z", spec.minZ + 2, spec.maxZ - 2, coord, base + 2.55, 0.55, 0.05);
    }
    SN.wallBand(frame, "x", spec.minX + 2, spec.maxX - 2, spec.minZ, base + 2.55, 0.55, 0.05);
    SN.mergedMesh(walls, dark);
    SN.mergedMesh(frame, 0x9fc7c8, {
      transparent: true,
      opacity: 0.34,
      roughness: 0.1,
      metalness: 0.2,
      side: SN.T.DoubleSide,
      depthWrite: false
    }, false);
    // ceiling over the lower deck with strip lights
    SN.mergedMesh([{ g: SN.box, x: spec.x, y: base + 3.42, z: spec.maxZ - 4, sx: spec.w - 1, sy: 0.22, sz: 8 }], 0x5d6666);
    const strips = [];
    for (let i = 0; i < 4; i++)
      strips.push({ g: SN.box, x: spec.x - 12 + i * 8, y: base + 3.29, z: spec.maxZ - 4, sx: 4.2, sy: 0.06, sz: 0.3 });
    SN.mergedMesh(strips, 0xf3f6e9, { emissive: 0xd6ecff, emissiveIntensity: 1.1 }, false);
    const lampA = new SN.T.PointLight(0xd8e9ff, 1.5, 26, 2);
    lampA.position.set(spec.x, base + 2.9, spec.maxZ - 4);
    SN.scene.add(lampA);
    const lampB = new SN.T.PointLight(0xe6f0ff, 0.8, 30, 2);
    lampB.position.set(spec.x, upper + 2.4, spec.minZ + 12);
    SN.scene.add(lampB);
    // pillars and parking furniture
    const columns = [[-10, 2], [-10, 6], [10, 2], [10, 6]];
    for (const c of columns) {
      SN.mergedMesh([{ g: SN.box, x: spec.x + c[0], y: base + 1.8, z: spec.maxZ - 8 + c[1] + 4, sx: 0.7, sy: 3.6, sz: 0.7 }], 0x8b9594);
      SN.addCollider(spec.x + c[0], spec.maxZ - 4 + c[1], 0.8, 0.8, 3.6);
    }
    const marks = [];
    for (let i = 0; i < 5; i++) {
      const px = spec.x - 10 + i * 5;
      marks.push({ g: SN.box, x: px, y: upper + 0.02, z: spec.minZ + 5, sx: 0.12, sy: 0.03, sz: 5 });
    }
    for (let i = 0; i < 5; i++) {
      marks.push({ g: SN.box, x: spec.x - 10 + i * 5, y: upper + 0.04, z: spec.minZ + 7.4, sx: 0.9, sy: 0.18, sz: 0.24 });
    }
    marks.push({ g: SN.box, x: spec.x, y: upper + 0.02, z: spec.minZ + 1.6, sx: 22, sy: 0.03, sz: 0.14 });
    SN.mergedMesh(marks, line);
    // ramp guard rails
    const rails = [];
    for (const s of [-1, 1]) {
      const rx = spec.x + s * (hw - 1);
      rails.push({
        g: SN.box,
        x: rx,
        y: base + 2.2,
        z: spec.maxZ - 12,
        sx: 0.14,
        sy: 0.14,
        sz: 9.1,
        rx: Math.atan2(upper - floorY, 8)
      });
      for (let i = 0; i < 4; i++)
        rails.push({ g: SN.box, x: rx, y: base + 0.6 + 1 * i, z: spec.maxZ - 15.7 + i * 2.4, sx: 0.16, sy: 1.2, sz: 0.16 });
      SN.addOBB(rx, spec.maxZ - 12, 0.3, 9.2, 5, 0, base);
    }
    SN.mergedMesh(rails, 0x9aa29e);
    // big blue P sign over the entrance plus door plates
    SN.sign("P 주차 · 停车楼", spec.x, base + 4.35, spec.maxZ + 0.28, 7.5, 1, 0, true);
    SN.sign("进入", spec.x, base + 2.15, spec.maxZ + 0.3, 1.3, 0.5, 0, true);
    SN.glow(SN.scene, spec.x, base + 2.3, spec.maxZ + 0.35, 1.4, 0xa9d8ff);
    for (let i = 0; i < 3; i++)
      SN.glow(SN.scene, spec.x - 8 + i * 8, base + 3.15, spec.maxZ - 4, 1.4, 0xd9ecff);
    SN.interiors.push({
      id: spec.id,
      name: spec.name,
      minX: spec.minX,
      maxX: spec.maxX,
      minZ: spec.maxZ - 8,
      maxZ: spec.maxZ,
      floor: floorY,
      ceil: base + 3.3,
      door: spec.doorPoint,
      inner: spec.innerPoint,
      outside: spec.outside
    });
    SN.enterables.push(spec);
    return spec;
  };
  // Doors are open cuts, but F gives a clean step through the threshold and the
  // on-screen hint tells the player exactly which room is in front of them.

  SN.enterableAt = function enterableAt(x, z) {
    for (const e of SN.enterables) {
      if (x > e.minX && x < e.maxX && z > e.minZ && z < e.maxZ)
        return e;
    }
    return null;
  };
  // Room records (floor / ceiling) drive the tight-interior camera and let door
  // hints know whether the player is already inside.

  SN.interiorAt = function interiorAt(x, z, y = null) {
    for (const room of SN.interiors) {
      if (x > room.minX && x < room.maxX && z > room.minZ && z < room.maxZ && (y === null || (y > room.floor - 0.8 && y < room.ceil + 0.9)))
        return room;
    }
    return null;
  };

  SN.updateDoorTarget = function updateDoorTarget() {
    SN.doorTarget = null;
    const inside = SN.enterableAt(SN.player.x, SN.player.z);
    if (inside) {
      if (Math.hypot(SN.player.x - inside.doorPoint.x, SN.player.z - inside.doorPoint.z) < 3.4)
        SN.doorTarget = { e: inside, dir: -1 };
      return;
    }
    let best = 3.4;
    for (const e of SN.enterables) {
      const d = Math.hypot(SN.player.x - e.outside.x, SN.player.z - e.outside.z);
      if (d < best) {
        best = d;
        SN.doorTarget = { e, dir: 1 };
      }
    }
  };

  SN.useDoor = function useDoor() {
    if (!SN.doorTarget || SN.player.dead)
      return false;
    const entering = SN.doorTarget.dir > 0, e = SN.doorTarget.e, p = entering ? e.innerPoint : e.outside;
    SN.player.x = p.x;
    SN.player.z = p.z;
    SN.player.y = SN.groundUnder(SN.player.x, SN.player.z, 0.22);
    SN.player.motionSpeed = SN.player.speed = 0;
    SN.player.vy = 0;
    SN.player.grounded = true;
    SN.player.moveX = 0;
    SN.player.moveZ = 0;
    for (const leg of SN.playerRig.legs)
      leg.planted = false;
    SN.camTarget.set(SN.player.x, SN.player.y + 1.3, SN.player.z);
    SN.lookTarget.copy(SN.camTarget);
    SN.doorTarget = null;
    SN.toast((entering ? "进入 " : "离开 ") + e.name + " · " + (e.id === "garage" ? "沿坡道上行" : "店内可射击与近战"), 2.2);
    return true;
  };
  // Startup phase 5: keep this order relative to the other systems.

  SN.registerInit(5, function initializeBuildings5() {
    // Facade maps are baked at 512x1024: concrete piers, recessed glazing, sills,
    // rain streaks and a separate emissive layer for lit offices. World UVs lock
    // one tile to 12.8 m x 25.6 m so every building shares real window scale.
    SN.buildingMats = [];
    SN.buildingBatches = [[], [], [], []];
    for (let i = 0; i < 3; i++) {
      const maps = SN.buildFacadeMaps(i),
        material = SN.mat(0xffffff, {
        map: maps.map,
        normalMap: maps.normalMap,
        roughnessMap: maps.roughnessMap,
        emissive: 0xffffff,
        emissiveMap: maps.emissiveMap,
        emissiveIntensity: 0,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.32
      });
      material.normalScale.set(0.72, 0.72);
      SN.applyWorldUV(material, 1 / 12.8, 1 / 25.6, SN.facadeHook);
      SN.buildingMats.push(material);
    }
    {
      const maps = SN.buildFacadeMaps(3),
        material = SN.mat(0xd7e0e2, {
        map: maps.map,
        normalMap: maps.normalMap,
        roughnessMap: maps.roughnessMap,
        emissive: 0xd8ecec,
        emissiveMap: maps.emissiveMap,
        emissiveIntensity: 0,
        roughness: 1,
        metalness: 0.4,
        envMapIntensity: 1.1
      });
      material.normalScale.set(0.4, 0.4);
      SN.applyWorldUV(material, 1 / 12.8, 1 / 25.6, SN.facadeHook);
      SN.buildingMats.push(material);
    }
    // Seoul building stock: mid-rise offices downtown, dense neon shops in Myeongdong,
    // glass towers in Gangnam and on Yeouido. Landmark plazas stay clear.
    // Six enterable interiors, each authored around its own open door. The clear
    // zones are registered before the procedural city runs, so no tower grows here.
    SN.enterableSpecs = [
      {
        id: "store",
        kind: "store",
        name: "편의점 · 便利店",
        x: -48,
        z: -778,
        w: 12,
        d: 13,
        h: 4.4,
        door: { side: "east", offset: 0, width: 2.6 },
        light: 0xffe0b0,
        zone: 24
      },
      {
        id: "cafe",
        kind: "cafe",
        name: "카페 · 咖啡店",
        x: 34,
        z: -600,
        w: 12,
        d: 12,
        h: 4.2,
        door: { side: "north", offset: 0, width: 2.4 },
        light: 0xffc487,
        zone: 30
      },
      {
        id: "police",
        kind: "police",
        name: "파출소 · 派出所",
        x: 330,
        z: -752,
        w: 20,
        d: 16,
        h: 4.6,
        door: { side: "east", offset: 0, width: 2.6 },
        light: 0xdfefff,
        zone: 25
      },
      {
        id: "hospitalA",
        kind: "hospital",
        name: "응급실 · 医院大厅",
        x: -660,
        z: -315,
        w: 18,
        d: 14,
        h: 4.6,
        door: { side: "south", offset: 0, width: 3 },
        light: 0xe8fbff,
        zone: 23,
        respawn: true
      },
      {
        id: "hospitalB",
        kind: "hospital",
        name: "응급실 · 医院大厅",
        x: 300,
        z: 1005,
        w: 18,
        d: 14,
        h: 4.6,
        door: { side: "south", offset: 0, width: 3 },
        light: 0xe8fbff,
        zone: 23,
        respawn: true
      },
      {
        id: "garage",
        kind: "garage",
        name: "주차장 · 停车楼",
        x: -520,
        z: 26,
        w: 32,
        d: 42,
        h: 4.2,
        door: { side: "south", offset: 0, width: 9 },
        light: 0xd8e9ff,
        zone: 46
      }
    ];
  });
  // Startup phase 7: keep this order relative to the other systems.

  SN.registerInit(7, function initializeBuildings7() {
    // Move authored interiors off steep ground before reserving their plots.
    SN.buildingRelocations = [];
    for (const spec of SN.enterableSpecs.concat(SN.shopSpecs, SN.smallShopSpecs)) {
      if (SN.authoredTerrain(spec).buildable)
        continue;
      const original = { x: spec.x, z: spec.z, w: spec.w, d: spec.d };
      let chosen = null;
      for (let radius = 4; radius <= 200 && !chosen; radius += 4)
        for (let i = 0; i < 32; i++) {
          const angle = i * SN.TAU / 32,
            x = original.x + Math.sin(angle) * radius,
            z = original.z + Math.cos(angle) * radius,
            ground = SN.authoredTerrain(spec, x, z),
            plot = SN.authoredFootprint(spec, x, z);
          if (!ground.buildable || !SN.roadGap(plot.x, plot.z, plot.w, plot.d) || SN.isWater(x, z, Math.hypot(plot.w, plot.d) / 2))
            continue;
          if (SN.enterableSpecs.concat(SN.shopSpecs, SN.smallShopSpecs).some(other => other !== spec && SN.rectOverlap({ x, z, w: spec.w + 4, d: spec.d + 4 }, other)))
            continue;
          chosen = { x, z };
          break;
        }
      if (!chosen)
        throw new Error("无法安置坡地商店：" + spec.id);
      spec.x = chosen.x;
      spec.z = chosen.z;
      SN.buildingRelocations.push({ ...original, dx: spec.x - original.x, dz: spec.z - original.z });
    }
    // Keep every district service on a buildable roadside plot, clear of intersections.
    SN.servicePlots = [];
    for (const h of SN.cityServices) {
      for (const police of [false, true]) {
        const source = SN.cityDistricts.find(d => d.id === h.id).travel;
        let chosen = null;
        for (let radius = 65; radius < 300 && !chosen; radius += 25)
          for (let i = 0; i < 20; i++) {
            const a = i * SN.TAU / 20, x = source[0] + Math.sin(a) * radius, z = source[1] + Math.cos(a) * radius;
            if (SN.isWater(x, z, 15) || SN.isWater(x - 12, z - 12) || SN.isWater(x + 12, z + 12) || SN.hillHeight(x, z) > 8 || !SN.roadGap(x, z, 24, 24) || SN.inPalace(x, z, 25) || SN.servicePlots.some(p => Math.hypot(x - p.x, z - p.z) < 40) || SN.enterableSpecs.some(p => Math.hypot(x - p.x, z - p.z) < 40) || SN.shopSpecs.some(p => Math.hypot(x - p.x, z - p.z) < 40) || SN.smallShopSpecs.some(p => Math.hypot(x - p.x, z - p.z) < 40) || SN.landmarkReserves.some(p => !(h.id === "gimpo" && p.x === -2840) && Math.hypot(x - p.x, z - p.z) < p.r + 18))
              continue;
            chosen = { x, z };
            break;
          }
        if (!chosen)
          chosen = { x: source[0] + (police ? 95 : 50), z: source[1] - 65 };
        SN.servicePlots.push(chosen);
        if (police) {
          h.policeX = chosen.x;
          h.policeZ = chosen.z - 12;
        }
        else {
          h.x = chosen.x;
          h.z = chosen.z - 15;
        }
      }
    }
    SN.clearZones = [
      { x: -690, z: -330, r: 38 },
      { x: 300, z: 990, r: 38 },
      { x: -520, z: 24, r: 50 },
      { x: 0, z: -812, r: 42 },
      { x: 0, z: -334, r: 34 },
      { x: -930, z: 450, r: 40 },
      { x: 620, z: 876, r: 36 },
      { x: -130, z: 1080, r: 32 },
      { x: 900, z: -612, r: 66 },
      { x: 450, z: -330, r: 44 },
      { x: -180, z: 1010, r: 44 }
    ];
    for (const s of SN.enterableSpecs)
      SN.clearZones.push({ x: s.x, z: s.z, r: s.zone });
    for (const s of SN.shopSpecs)
      SN.clearZones.push({ x: s.x, z: s.z, r: s.zone });
    for (const s of SN.smallShopSpecs)
      SN.clearZones.push({ x: s.x, z: s.z, r: s.zone });
    SN.clearZones.push(...SN.landmarkReserves);
    for (const h of SN.cityServices) {
      SN.clearZones.push({ x: h.x, z: h.z, r: 23 }, { x: h.policeX, z: h.policeZ, r: 22 });
    }
    SN.placedBuildings = [];
    SN.urbanShells = [];
    SN.urbanRoofParts = [];
    SN.urbanAlleys = [];
    SN.foundationBatch = [];
    SN.authoredBuildingSites = [];
    SN.bevelShape = new SN.T.Shape();
    SN.bevelShape.moveTo(-0.48, -0.5);
    SN.bevelShape.lineTo(0.48, -0.5);
    SN.bevelShape.lineTo(0.5, -0.48);
    SN.bevelShape.lineTo(0.5, 0.48);
    SN.bevelShape.lineTo(0.48, 0.5);
    SN.bevelShape.lineTo(-0.48, 0.5);
    SN.bevelShape.lineTo(-0.5, 0.48);
    SN.bevelShape.lineTo(-0.5, -0.48);
    SN.bevelShape.closePath();
    SN.urbanBlockGeo = new SN.T.ExtrudeGeometry(SN.bevelShape, { depth: 1, bevelEnabled: false, steps: 1, curveSegments: 1 });
    SN.urbanBlockGeo.rotateX(-SN.PI / 2);
    SN.urbanBlockGeo.translate(0, -0.5, 0);
    // Roads, bends and rear lanes establish blocks; frontage widths establish lots.
    // Large lots belong to occasional towers, while their neighbours stay smaller.
    for (let roadIndex = 0; roadIndex < SN.roads.length; roadIndex++) {
      const road = SN.roads[roadIndex];
      if (road.bridge || /江边北路|奥林匹克|匝道|机场|터미널 순환|남산순환/.test(road.name))
        continue;
      for (let segment = 1; segment < road.points.length; segment++) {
        const a = road.points[segment - 1],
          end = road.points[segment],
          dx = end[0] - a[0],
          dz = end[1] - a[1],
          len = Math.hypot(dx, dz),
          tx = dx / len,
          tz = dz / len,
          nx = tz,
          nz = -tx;
        for (const side of [-1, 1]) {
          let along = 18, lotIndex = 0, lastEra = "";
          while (along < len - 18) {
            const lotSeed = (Math.imul(Math.round(a[0]) + 4300, 73856093) ^ Math.imul(Math.round(a[1]) + 4700, 19349663) ^ Math.imul(lotIndex + 1, 83492791) ^ (side > 0 ? 19471 : 59183)) >>> 0,
              random = SN.lotRng(lotSeed),
              district = SN.cityDistrictAt(a[0] + tx * along, a[1] + tz * along).id,
              business = ["gangnam", "samseong", "jamsil", "yeouido"].includes(district),
              shopping = district === "myeong",
              tower = business && road.width >= 20 && lotIndex % 3 !== 1;
            let era = tower ? "tower" : random() < 0.56 ? "brick" : "office";
            if (era === lastEra && era !== "tower")
              era = era === "brick" ? "office" : "brick";
            lastEra = era;
            const w = tower ? 25 + random() * 17 : shopping ? 8.5 + random() * 7.5 : 10 + random() * 13,
              d = tower ? 25 + random() * 16 : 14 + random() * 11,
              gap = lotIndex % 5 === 3 ? 5.5 + random() * 3 : 1.8 + random() * 1.7,
              setback = 0.12 + random() * 0.18,
              off = road.width / 2 + (road.sidewalkW || 3.5) + 0.4 + setback + d / 2,
              center = along + w / 2,
              cx = a[0] + tx * center + nx * off * side,
              cz = a[1] + tz * center + nz * off * side,
              yaw = Math.atan2(-nx * side, -nz * side),
              h = tower ? 70 + Math.floor(random() * 32) * 3.6 : era === "brick" ? 6.6 + Math.floor(random() * 3) * 3.1 : 13.4 + Math.floor(random() * (shopping ? 4 : 8)) * 3.2;
            if (center + w / 2 < len - 16) {
              const lot = SN.addBuilding(cx, cz, w, d, h, tower, yaw, lotSeed, era);
              if (lot) {
                const walk = SN.lotPoint(lot, 0, d / 2 + setback / 2);
                SN.record(SN.sideBatch, walk.x, lot.base + 0.18, walk.z, w, 0.32, setback + 0.6, yaw);
                if (lotIndex % 5 === 3)
                  SN.urbanAlleys.push({
                    x: a[0] + tx * (center + w / 2 + gap / 2) + nx * off * side,
                    z: a[1] + tz * (center + w / 2 + gap / 2) + nz * off * side,
                    w: gap,
                    d: d + setback,
                    yaw
                  });
              }
            }
            along += w + gap;
            lotIndex++;
          }
        }
      }
    }
    for (const alley of SN.urbanAlleys)
      SN.record(SN.roadBatch, alley.x, SN.groundHeight(alley.x, alley.z) + 0.06, alley.z, alley.w, 0.12, alley.d, alley.yaw);
    SN.record(SN.sideBatch, 0, 0.14, -812, 190, 0.25, 96);
    // Zebra crossings at the main downtown intersections, clear of buildings.
    SN.crossings = [];
    SN.crossingSegments = [];
    SN.crossingCorners = [];
    for (const road of SN.roads)
      if (!road.bridge && road.width >= 14 && !/江边北路|奥林匹克|匝道/.test(road.name))
        for (let i = 1; i < road.points.length; i++)
          SN.crossingSegments.push({ a: road.points[i - 1], b: road.points[i], width: road.width });
    for (let i = 0; i < SN.crossingSegments.length; i++)
      for (let j = i + 1; j < SN.crossingSegments.length; j++) {
        const a = SN.crossingSegments[i],
          b = SN.crossingSegments[j],
          dx = a.b[0] - a.a[0],
          dz = a.b[1] - a.a[1],
          ex = b.b[0] - b.a[0],
          ez = b.b[1] - b.a[1],
          den = dx * ez - dz * ex;
        if (Math.abs(den) < Math.hypot(dx, dz) * Math.hypot(ex, ez) * 0.3)
          continue;
        const qx = b.a[0] - a.a[0], qz = b.a[1] - a.a[1], t = (qx * ez - qz * ex) / den, u = (qx * dz - qz * dx) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1)
          continue;
        const x = a.a[0] + dx * t, z = a.a[1] + dz * t;
        if (SN.hillHeight(x, z) > 4 || SN.crossings.some(c => Math.hypot(c[0] - x, c[1] - z) < 26))
          continue;
        SN.crossings.push([x, z]);
        const al = Math.hypot(dx, dz),
          bl = Math.hypot(ex, ez),
          nax = dz / al,
          naz = -dx / al,
          nbx = ez / bl,
          nbz = -ex / bl,
          cornerDet = nax * nbz - naz * nbx;
        for (const sa of [-1, 1])
          for (const sb of [-1, 1]) {
            const oa = sa * (a.width / 2 + 1.4),
              ob = sb * (b.width / 2 + 1.4),
              cx = x + (oa * nbz - naz * ob) / cornerDet,
              cz = z + (nax * ob - oa * nbx) / cornerDet;
            SN.crossingCorners.push({ x: cx, z: cz, yaw: Math.atan2(x - cx, z - cz) });
          }
        for (const pair of [[a, b], [b, a]]) {
          const road = pair[0],
            other = pair[1],
            vx = road.b[0] - road.a[0],
            vz = road.b[1] - road.a[1],
            len = Math.hypot(vx, vz),
            nx = vz / len,
            nz = -vx / len,
            yaw = Math.atan2(vx, vz);
          for (const side of [-1, 1]) {
            const along = (other.width / 2 + 3.5) * side, cx = x + vx / len * along, cz = z + vz / len * along;
            for (let off = -road.width / 2 + 1; off < road.width / 2 - 0.6; off += 1.45)
              SN.record(SN.markBatch, cx + nx * off, SN.roadHeight(cx, cz) + 0.195, cz + nz * off, 0.75, 0.018, 3.6, yaw);
            SN.record(SN.markBatch, cx + vx / len * side * 3, SN.roadHeight(cx, cz) + 0.195, cz + vz / len * side * 3, road.width / 2 - 0.5, 0.018, 0.32, yaw);
          }
        }
      }
    SN.neonMats = [];
    SN.sign("종 로", -500, 5, -782, 9, 2);
    SN.sign("을 지 로", -600, 5, -622, 9, 2);
    SN.sign("명 동 길", 448, 5, -412, 10, 2);
    SN.sign("퇴 계 로", -300, 5, -22, 9, 2);
    SN.sign("테 헤 란 로", 180, 5, 1078, 12, 2);
    SN.sign("봉 은 사 로", -500, 5, 918, 10, 2);
    SN.sign("세 종 대 로", -424, 5, -250, 11, 2, SN.PI / 2);
    SN.sign("강 남 대 로", -96, 5, 1140, 11, 2, SN.PI / 2);
    SN.sign("한 강 대 교", -130, 6, 0, 12, 2);
    SN.sign("양 화 대 교", -780, 6, 0, 12, 2);
    SN.sign("성 수 대 교", 560, 6, 0, 12, 2);
    SN.shopGlass = [];
    SN.shopFrames = [];
    SN.shopSigns = [[], [], [], [], [], [], [], []];
    SN.shopFronts = [];
    SN.shopNames = ["달비늘 식탁", "모래별 서가", "여울음 노래집", "구름접시", "잔물결 다방", "솔안개 약방", "초승도시락", "종이달 찻집"];
    SN.shopColors = ["#8ff1ce", "#ffc88d", "#c1d2ff", "#ff9bd2", "#a5ffcf", "#ffe28f", "#9bd6ff", "#ffb38a"];
    SN.shopColorHex = SN.shopColors.map(c => parseInt(c.slice(1), 16));
    // Choose visible street frontage by the nearest road; corner lots get two fronts.
    for (const batch of SN.buildingBatches)
      for (const b of batch) {
        if (b.upper)
          continue;
        const faces = SN.buildingFaces(b), base = b.lot ? b.lot.base : 0, frontRandom = SN.lotRng(b.lot ? b.lot.seed : 1);
        let best = Infinity;
        for (const f of faces) {
          f.distance = Infinity;
          const x = b.x + f.nx * f.depth, z = b.z + f.nz * f.depth;
          for (const r of SN.roads)
            for (let j = 0; j < r.points.length - 1; j++) {
              const a = r.points[j],
                c = r.points[j + 1],
                dx = c[0] - a[0],
                dz = c[1] - a[1],
                den = dx * dx + dz * dz,
                t = den ? SN.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / den, 0, 1) : 0,
                rx = a[0] + dx * t - x,
                rz = a[1] + dz * t - z;
              if (rx * f.nx + rz * f.nz > 0)
                f.distance = Math.min(f.distance, Math.hypot(rx, rz));
            }
          best = Math.min(best, f.distance);
        }
        for (const f of faces) {
          if (f.distance > best + 18)
            continue;
          const x = b.x + f.nx * (f.depth + 0.12), z = b.z + f.nz * (f.depth + 0.12), tx = Math.cos(f.yaw), tz = -Math.sin(f.yaw);
          SN.record(SN.shopGlass, x, base + 1.65, z, f.w * 0.87, 2.9, 0.12, f.yaw);
          for (let offset = -f.w * 0.4; offset < f.w * 0.45; offset += 3.2)
            SN.record(SN.shopFrames, x + tx * offset + f.nx * 0.1, base + 1.65, z + tz * offset + f.nz * 0.1, 0.12, 3.2, 0.16, f.yaw);
          const front = {
            x,
            z,
            base: b.lot ? b.lot.base : 0,
            lot: b.lot,
            yaw: f.yaw,
            w: f.w,
            nx: f.nx,
            nz: f.nz,
            idx: Math.floor(frontRandom() * 8),
            signW: Math.min(12, f.w * 0.65),
            upper: null
          };
          SN.record(SN.shopSigns[front.idx], front.x + f.nx * 0.15, base + 3.5, front.z + f.nz * 0.15, front.signW, 0.8, 0.12, f.yaw);
          if (frontRandom() < 0.5) {
            const upperW = Math.min(7, f.w * 0.42);
            front.upper = { y: base + 5.45, w: upperW };
            SN.record(SN.shopSigns[Math.floor(frontRandom() * 8)], front.x + f.nx * 0.2, base + 5.45, front.z + f.nz * 0.2, upperW, 1.5, 0.12, f.yaw);
          }
          SN.shopFronts.push(front);
        }
      }
    SN.detailTiles(SN.box, SN.mat(0x6f9da2, {
      metalness: 0.55,
      roughness: 0.12,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: SN.T.DoubleSide
    }), SN.shopGlass, false);
    SN.detailTiles(SN.box, SN.darkMat, SN.shopFrames, false);
    SN.shopSigns.forEach((batch, i) => {
      const texture = SN.textTexture(SN.shopNames[i], "#15383d", SN.shopColors[i]);
      const material = SN.mat(0xffffff, { map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.72 });
      SN.neonMats.push(material);
      SN.detailTiles(SN.box, material, batch, false);
    });
    // Myeongdong's neon canyon: vertical signs on both sides of the shopping street.
    SN.neonWords = ["노래방", "치킨", "분식", "약국", "PC방", "카페", "화장품", "김밥", "호프", "서점", "사진관", "떡볶이"];
    // Vertical signs are attached to seeded lot facades below, not floating in roads.
    SN.sign("명 동", 430, 9, -430, 18, 4, 0, true);
    SN.sign("明 洞 街 市", 430, 5.5, -412, 14, 2.6, 0, true);
    // Gate posts frame the shopping street without blocking traffic.
    for (const s of [-1, 1]) {
      SN.meshAt(SN.box, SN.darkMat, 430, 4, -430 + s * 13, 0.8, 8, 0.8);
      SN.addCollider(430, -430 + s * 13, 0.8, 0.8, 8);
    }
  });
  // Startup phase 9: keep this order relative to the other systems.

  SN.registerInit(9, function initializeBuildings9() {
    SN.namsanTower(0, -340);
    // Bukchwal palace: original walls, curved tiled roofs, gate and courtyard.
    SN.palaceStone = [];
    SN.palaceWood = [];
    SN.palaceRoof = [];
    SN.palaceDoor = [];
    SN.palaceHall(0, -972, 96, 58, 9);
    SN.palaceHall(-205, -990, 58, 40, 7.2);
    SN.palaceHall(210, -990, 58, 40, 7.2);
    SN.palaceWall(-300, -840, -19, -840);
    SN.palaceWall(19, -840, 320, -840);
    SN.palaceWall(-300, -1080, 320, -1080);
    SN.palaceWall(-300, -840, -300, -1080);
    SN.palaceWall(320, -840, 320, -1080);
    // Gate: stone piers, deep-red doors and two curved roof tiers.
    SN.palaceStone.push({ g: SN.box, x: -13, y: 3.6, z: -840, sx: 11, sy: 7.2, sz: 17 });
    SN.palaceStone.push({ g: SN.box, x: 13, y: 3.6, z: -840, sx: 11, sy: 7.2, sz: 17 });
    SN.palaceStone.push({ g: SN.box, x: 0, y: 7.3, z: -840, sx: 26, sy: 2.2, sz: 15 });
    SN.addCollider(-13, -840, 11, 17, 7.4);
    SN.addCollider(13, -840, 11, 17, 7.4);
    SN.palaceDoor.push({ g: SN.box, x: -6.8, y: 3.5, z: -847, sx: 7.4, sy: 6.4, sz: 0.5, ry: SN.PI / 2 });
    SN.palaceDoor.push({ g: SN.box, x: 6.8, y: 3.5, z: -847, sx: 7.4, sy: 6.4, sz: 0.5, ry: -SN.PI / 2 });
    SN.roofParts(0, 11.3, -840, 44, 26, 5.6);
    SN.roofParts(0, 17.4, -840, 32, 19, 4);
    SN.palaceRoof.push({ g: SN.box, x: 0, y: 12.2, z: -840, sx: 20, sy: 0.8, sz: 1 });
    // Courtyard paving, a few old trees, and the palace name boards.
    SN.record(SN.sideBatch, 10, 0.16, -960, 612, 0.25, 230);
    SN.rasterSurface(-296, 316, -1076, -846, () => true, () => 0.285, 2);
    for (const p of [[-160, -900], [160, -900], [-110, -1040], [120, -1040]])
      SN.tree(p[0], p[1], false, 1.15);
    {
      const stoneMesh = new SN.T.Mesh(SN.merged(SN.palaceStone), SN.stoneMat);
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      SN.scene.add(stoneMesh);
      const woodMesh = new SN.T.Mesh(SN.merged(SN.palaceWood), SN.mat(0x8a4a3a, { roughness: 0.72 }));
      woodMesh.castShadow = true;
      woodMesh.receiveShadow = true;
      SN.scene.add(woodMesh);
      const roofMesh = new SN.T.Mesh(SN.merged(SN.palaceRoof), SN.mat(0x2f3d40, { metalness: 0.18, roughness: 0.58 }));
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;
      SN.scene.add(roofMesh);
      const doorMesh = new SN.T.Mesh(SN.merged(SN.palaceDoor), SN.mat(0x7a2b22, { roughness: 0.7 }));
      doorMesh.castShadow = true;
      SN.scene.add(doorMesh);
    }
    SN.sign("북 궐", 0, 14, -824, 22, 4.2, 0, true);
    SN.sign("宮 闕 正 門", 0, 9, -824, 18, 2.6, 0, true);
    // Gwangjang market: original stalls with striped awnings.
    SN.stallWood = [];
    SN.stallRed = [];
    SN.stallCream = [];
    for (let i = 0; i < 12; i++) {
      const sx = 900 + ((i % 4) - 1.5) * 26, sz = -590 + (Math.floor(i / 4) - 1) * 30;
      SN.stallWood.push({ g: SN.box, x: sx, y: 1.1, z: sz, sx: 12, sy: 2.2, sz: 7 });
      SN.stallWood.push({ g: SN.box, x: sx - 6, y: 1.6, z: sz, sx: 0.25, sy: 3.2, sz: 0.25 });
      SN.stallWood.push({ g: SN.box, x: sx + 6, y: 1.6, z: sz, sx: 0.25, sy: 3.2, sz: 0.25 });
      (i % 2 ? SN.stallRed : SN.stallCream).push({ g: SN.box, x: sx, y: 3.4, z: sz, sx: 13.4, sy: 0.28, sz: 8.2 });
      SN.addCollider(sx, sz, 12, 7, 2.4);
    }
    {
      const a = new SN.T.Mesh(SN.merged(SN.stallWood), SN.mat(0x6d5644, { roughness: 0.85 })),
        b = new SN.T.Mesh(SN.merged(SN.stallRed), SN.mat(0xb84b3e, { roughness: 0.8 })),
        c = new SN.T.Mesh(SN.merged(SN.stallCream), SN.mat(0xd8c9a3, { roughness: 0.85 }));
      for (const m of [a, b, c]) {
        m.castShadow = true;
        m.receiveShadow = true;
        SN.scene.add(m);
      }
    }
    SN.sign("광 장 시 장", 900, 7, -546, 30, 4.5, 0, true);
    SN.sign("广 藏 市 场", 900, 3.5, -546, 18, 2.4, 0, true);
    // Mountain groves and stone trails.
    for (let i = 0; i < 21000; i++) {
      const x = SN.rand(-3560, 3560), z = SN.rand(-3560, 3560), h = SN.hillHeight(x, z);
      if (h > 7 && SN.terrainSlope(x, z) < 0.72 && !SN.isWater(x, z) && !SN.inPalace(x, z, 25) && Math.hypot(x, z + 340) > 36 && SN.zoneFree(x, z, 3))
        SN.tree(x, z, false, SN.rand(0.85, 1.65));
    }
    SN.hillPath([[0, -150], [-55, -215], [-38, -285], [0, -318]], 5);
    SN.hillPath([[-30, -1076], [-56, -1130], [-80, -1185]], 5);
    SN.hillPath([[-720, 34], [-700, -30]], 6);
    SN.hillPath([[700, 60], [700, 20]], 6);
    SN.sign("남 산 공 원", -90, 5.5, -80, 16, 3.2, 0);
    SN.sign("한 강 공원", 620, 5, 880, 20, 3.6, 0);
    SN.sign("漢 江 公 園", 620, 9, 880, 17, 2.8, 0);
  });
  // Startup phase 11: keep this order relative to the other systems.

  SN.registerInit(11, function initializeBuildings11() {
    // ============================ City detail dressing ============================
    // Depth layers over the procedural blocks: window bands and piers, balconies,
    // air conditioners, rooftop tanks, lit shop displays behind glass, street
    // furniture, worn paint, stone embankments and bridge fittings. Every repeated
    // piece is instanced, cut into ~100 m tiles, and only the tiles around the
    // player are drawn (updateDetailCulling).
    SN.detailCull = [];
    SN.detailTrimMat = SN.pbrMat("metal", 0xa4aaa4, { uvScale: 0.55, roughness: 0.9, metalness: 0.25 });
    SN.detailConcrete = SN.pbrMat("concrete", 0xd6ccb8, { uvScale: 0.42, roughness: 1, metalness: 0.02 });
    SN.detailMetal = SN.pbrMat("metal", 0xb2b6b4, { uvScale: 0.5, metalness: 0.62, roughness: 0.62 });
    SN.detailDark = SN.pbrMat("metal", 0x647276, { uvScale: 0.45, metalness: 0.38, roughness: 0.82 });
    SN.detailRailMat = SN.pbrMat("metal", 0x83908c, { uvScale: 0.6, metalness: 0.5, roughness: 0.7 });
    SN.detailGlassMat = SN.pbrMat("glass", 0xc8dede, {
      uvScale: 0.6,
      metalness: 0.5,
      roughness: 0.4,
      transparent: true,
      opacity: 0.36,
      side: SN.T.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.2
    });
    SN.detailPlaneGeo = new SN.T.PlaneGeometry(1, 1);
    SN.displayCanvas = document.createElement("canvas");
    SN.displayCanvas.width = 256;
    SN.displayCanvas.height = 128;
    {
      const g = SN.displayCanvas.getContext("2d"), bg = g.createLinearGradient(0, 0, 0, 128);
      bg.addColorStop(0, "#2b2119");
      bg.addColorStop(0.45, "#c79658");
      bg.addColorStop(1, "#4b3326");
      g.fillStyle = bg;
      g.fillRect(0, 0, 256, 128);
      for (let row = 0; row < 3; row++) {
        const yy = 24 + row * 29;
        g.fillStyle = "#3a291f";
        g.fillRect(7, yy + 20, 242, 4);
        for (let i = 0; i < 13; i++) {
          g.fillStyle = ["#f0cc81", "#cf6a53", "#8fc6ad", "#ded8c2", "#b17ac2"][(i + row) % 5];
          g.fillRect(10 + i * 18.5, yy, 12, 19);
        }
      }
      g.fillStyle = "#ffeec2";
      for (let i = 0; i < 4; i++)
        g.fillRect(30 + i * 60, 3, 26, 5);
      g.fillStyle = "#d9a75f";
      g.fillRect(0, 110, 256, 18);
    }
    SN.displayTexture = SN.tuneTexture(new SN.T.CanvasTexture(SN.displayCanvas));
    SN.displayTexture.encoding = SN.T.sRGBEncoding;
    SN.detailDisplayMat = SN.mat(0xffffff, {
      map: SN.displayTexture,
      emissive: 0xffffff,
      emissiveMap: SN.displayTexture,
      emissiveIntensity: 0.55,
      roughness: 0.8
    });
    SN.vendingCanvas = document.createElement("canvas");
    SN.vendingCanvas.width = 64;
    SN.vendingCanvas.height = 128;
    {
      const g = SN.vendingCanvas.getContext("2d");
      g.fillStyle = "#e7f2ee";
      g.fillRect(0, 0, 64, 128);
      g.fillStyle = "#20302f";
      g.fillRect(3, 6, 58, 88);
      for (let row = 0; row < 4; row++)
        for (let i = 0; i < 4; i++) {
          g.fillStyle = ["#ef785f", "#efd36d", "#79c5a7", "#8aa9dd"][(row + i) % 4];
          g.beginPath();
          g.arc(12 + i * 13, 18 + row * 20, 5, 0, SN.TAU);
          g.fill();
        }
      g.fillStyle = "#425856";
      g.fillRect(8, 100, 48, 8);
      g.fillRect(8, 112, 20, 6);
    }
    SN.vendingTexture = SN.tuneTexture(new SN.T.CanvasTexture(SN.vendingCanvas));
    SN.vendingTexture.encoding = SN.T.sRGBEncoding;
    SN.detailVendingFront = SN.mat(0xffffff, {
      map: SN.vendingTexture,
      emissive: 0xffffff,
      emissiveMap: SN.vendingTexture,
      emissiveIntensity: 0.5,
      roughness: 0.7
    });
    SN.detailNeonGlowMat = new SN.T.MeshBasicMaterial({
      map: SN.canvasTexture(SN.glowCanvas),
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: SN.T.AdditiveBlending,
      side: SN.T.DoubleSide
    });
    SN.detailSignMat = new SN.T.MeshBasicMaterial({ color: 0xffffff, fog: true });
    SN.acGeo = SN.merged([
      { g: SN.box, x: 0, y: 0, z: 0, sx: 0.9, sy: 0.55, sz: 0.44 },
      { g: new SN.T.CylinderGeometry(0.23, 0.23, 0.06, 10), x: 0, y: 0, z: 0.25, rx: SN.PI / 2 },
      { g: SN.box, x: 0, y: -0.33, z: -0.08, sx: 0.82, sy: 0.06, sz: 0.3 }
    ]);
    SN.laundryMat = SN.pbrMat("fabric", 0xffffff, { uvScale: 2, roughness: 1, side: SN.T.DoubleSide });
    SN.signAtlas = SN.makeCanvas(1024, 1024);
    SN.signContext = SN.signAtlas.getContext("2d");
    SN.verticalNames = ["달비늘", "모래별", "잔물결", "솔안개", "종이달", "여울음", "구름접시", "초승식탁"];
    SN.verticalGeos = [];
    for (let index = 0; index < 8; index++) {
      const col = index % 4, row = Math.floor(index / 4), x = col * 256, y = row * 512;
      SN.signContext.fillStyle = ["#324647", "#634d43", "#46566b", "#624b59"][col];
      SN.signContext.fillRect(x, y, 256, 512);
      SN.signContext.strokeStyle = SN.shopColors[index];
      SN.signContext.lineWidth = 9;
      SN.signContext.strokeRect(x + 10, y + 10, 236, 492);
      SN.signContext.fillStyle = SN.shopColors[index];
      SN.signContext.textAlign = "center";
      SN.signContext.textBaseline = "middle";
      SN.signContext.font = "600 70px sans-serif";
      const chars = Array.from(SN.verticalNames[index]);
      for (let k = 0; k < chars.length; k++)
        SN.signContext.fillText(chars[k], x + 128, y + 92 + k * 88);
      SN.signContext.font = "28px sans-serif";
      SN.signContext.fillText((index % 4 + 1) + " F", x + 128, y + 465);
      const geo = new SN.T.PlaneGeometry(1, 1), uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++)
        uv.setXY(k, (col + uv.getX(k)) / 4, 1 - (row + 1 - uv.getY(k)) / 2);
      SN.verticalGeos.push(geo);
    }
    SN.urbanSignTexture = SN.canvasTexture(SN.signAtlas);
    SN.urbanSignTexture.encoding = SN.T.sRGBEncoding;
    SN.urbanSignMaterial = SN.mat(0xffffff, {
      map: SN.urbanSignTexture,
      emissive: 0xffffff,
      emissiveMap: SN.urbanSignTexture,
      emissiveIntensity: 0.65,
      roughness: 0.65,
      side: SN.T.DoubleSide
    });
    SN.neonMats.push(SN.urbanSignMaterial);
    SN.urbanDetailPages = [];
    SN.urbanDetailMap = new Map();
    for (const b of SN.placedBuildings) {
      const ix = Math.floor(b.x / 96), iz = Math.floor(b.z / 96), key = ix + "," + iz;
      if (!SN.urbanDetailMap.has(key)) {
        const page = { x: (ix + 0.5) * 96, z: (iz + 0.5) * 96, buildings: [], ready: false, tiles: [] };
        SN.urbanDetailMap.set(key, page);
        SN.urbanDetailPages.push(page);
      }
      SN.urbanDetailMap.get(key).buildings.push(b);
    }
  });
  // Startup phase 16: keep this order relative to the other systems.

  SN.registerInit(16, function initializeBuildings16() {
    // ============================ Enterable interiors ============================
    // Each interior is a real hole in the city: the floor is baked into the coarse world
    // surface grid, walls are segmented around an open doorway, and every room is
    // lit from inside. Furniture is merged per colour to keep draw calls low.
    SN.enterables = [];
    SN.interiors = [];
    SN.interiorPosts = [];
    SN.doorTarget = null;
    SN.enterableMats = new Map();
    SN.windowGlassMat = SN.iMat(0xa9d4d2, {
      transparent: true,
      opacity: 0.24,
      roughness: 0.06,
      metalness: 0.22,
      side: SN.T.DoubleSide,
      depthWrite: false
    });
    SN.facadeColors = { store: 0x47595a, cafe: 0x6a5744, police: 0x4a5763, hospital: 0x9caca7 };
    SN.innerColors = { store: 0xd9cfb9, cafe: 0xd9bf9b, police: 0xc9d4d1, hospital: 0xe3e9e6 };
    SN.floorColors = { store: 0xb9aa91, cafe: 0x8d6849, police: 0xa9b3ad, hospital: 0xd5dedb };
    SN.cafeRoofBuilders = {
      mergedMesh: SN.mergedMesh,
      addCollider: SN.addCollider,
      addOBB: SN.addOBB,
      rasterSurface: SN.rasterSurface,
      glow: SN.glow,
      sign: SN.sign
    };
    for (const spec of SN.enterableSpecs) {
      if (spec.kind === "garage")
        SN.buildGarage(spec);
      else {
        const built = SN.buildEnterable(spec);
        SN.enterables.push(built);
      }
    }
  });
})(window.SN);
