/* 商店外观、室内陈设、店员、交易与抢劫流程。 */
"use strict";
(function (SN) {
  SN.shopChainOf = function shopChainOf(spec) {
    return spec.chain ? SN.shopChains.find(c => c.id === spec.chain) : null;
  };

  SN.shopDisplayName = function shopDisplayName(spec) {
    const chain = SN.shopChainOf(spec);
    if (!chain)
      return spec.name;
    return chain.brand + " · " + spec.district + "店";
  };

  SN.shopCanvasTexture = function shopCanvasTexture(width, height, draw) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    draw(c.getContext("2d"), width, height);
    const tex = SN.tuneTexture(new SN.T.CanvasTexture(c));
    tex.encoding = SN.T.sRGBEncoding;
    return tex;
  };

  SN.drawShopLogo = function drawShopLogo(g, x, y, r, chain) {
    if (chain.logo === "medallion") {
      g.fillStyle = chain.accentCss;
      g.beginPath();
      g.arc(x, y, r, 0, SN.TAU);
      g.fill();
      g.fillStyle = "#11332f";
      g.beginPath();
      g.arc(x, y, r * 0.78, 0, SN.TAU);
      g.fill();
      g.strokeStyle = chain.accentCss;
      g.lineWidth = Math.max(2, r * 0.07);
      g.beginPath();
      g.arc(x, y, r * 0.66, 0, SN.TAU);
      g.stroke();
      g.fillStyle = chain.accentCss;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "700 " + Math.floor(r * 0.82) + "px system-ui";
      g.fillText("24", x, y - r * 0.06);
      g.font = "600 " + Math.floor(r * 0.28) + "px system-ui";
      g.fillText("MART", x, y + r * 0.5);
    }
    else {
      g.fillStyle = "#3a2a20";
      g.beginPath();
      g.arc(x, y, r, 0, SN.TAU);
      g.fill();
      g.strokeStyle = chain.accentCss;
      g.lineWidth = Math.max(2, r * 0.08);
      for (let i = 0; i < 10; i++) {
        const a = i * SN.TAU / 10;
        g.beginPath();
        g.moveTo(x + Math.sin(a) * r * 0.54, y - Math.cos(a) * r * 0.54);
        g.lineTo(x + Math.sin(a) * r * 0.94, y - Math.cos(a) * r * 0.94);
        g.stroke();
      }
      g.fillStyle = chain.accentCss;
      g.beginPath();
      g.arc(x, y, r * 0.42, 0, SN.TAU);
      g.fill();
      g.fillStyle = "#4a2f1c";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "700 " + Math.floor(r * 0.4) + "px system-ui";
      g.fillText("한빛", x, y);
    }
  };

  SN.shopSignTexture = function shopSignTexture(spec) {
    if (!spec.chain)
      return null;
    if (SN.shopSignCache.has(spec.id))
      return SN.shopSignCache.get(spec.id);
    const chain = SN.shopChainOf(spec);
    const tex = SN.shopCanvasTexture(1024, 112, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#" + chain.body.toString(16).padStart(6, "0"));
      grad.addColorStop(1, "#" + chain.band.toString(16).padStart(6, "0"));
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.fillStyle = chain.accentCss + "22";
      g.fillRect(0, 0, w, 5);
      g.fillRect(0, h - 5, w, 5);
      SN.drawShopLogo(g, 60, h / 2, 39, chain);
      g.textAlign = "left";
      g.textBaseline = "middle";
      g.fillStyle = chain.accentCss;
      g.font = "600 42px system-ui";
      g.fillText(chain.brand, 118, 42);
      g.fillStyle = "#f2e9d8";
      g.font = "400 22px system-ui";
      g.fillText(chain.brandCn + " · " + spec.district + "店", 120, 78);
      g.textAlign = "right";
      g.fillStyle = "#e8f6eeaa";
      g.font = "500 17px system-ui";
      g.fillText("OPEN 24H · 자동문", w - 24, 56);
    });
    SN.shopSignCache.set(spec.id, tex);
    return tex;
  };

  SN.shopBladeTexture = function shopBladeTexture(spec) {
    if (!spec.chain)
      return null;
    const key = spec.id + "|blade";
    if (SN.shopSignCache.has(key))
      return SN.shopSignCache.get(key);
    const chain = SN.shopChainOf(spec);
    const tex = SN.shopCanvasTexture(256, 384, (g, w, h) => {
      g.fillStyle = "#" + chain.body.toString(16).padStart(6, "0");
      g.fillRect(0, 0, w, h);
      g.strokeStyle = chain.accentCss + "88";
      g.lineWidth = 6;
      g.strokeRect(8, 8, w - 16, h - 16);
      SN.drawShopLogo(g, w / 2, 104, 64, chain);
      g.fillStyle = chain.accentCss;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "600 35px system-ui";
      g.fillText(chain.brand, w / 2, 218);
      g.fillStyle = "#f3ead9";
      g.font = "400 24px system-ui";
      g.fillText(chain.brandCn, w / 2, 258);
      g.fillStyle = chain.accentCss + "cc";
      g.font = "500 20px system-ui";
      g.fillText("24 HOUR", w / 2, 314);
    });
    SN.shopSignCache.set(key, tex);
    return tex;
  };

  SN.shopTileTexture = function shopTileTexture() {
    if (SN.shopTileCache.has("tile"))
      return SN.shopTileCache.get("tile");
    const tex = SN.shopCanvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#e4e0d4";
      g.fillRect(0, 0, w, h);
      const cell = w / 8;
      for (let iy = 0; iy < 8; iy++)
        for (let ix = 0; ix < 8; ix++) {
          const shade = 226 + ((ix * 7 + iy * 11) % 3) * 4;
          g.fillStyle = "rgb(" + shade + "," + (shade - 4) + "," + (shade - 14) + ")";
          g.fillRect(ix * cell + 1, iy * cell + 1, cell - 2, cell - 2);
          if ((ix + iy) % 9 === 0) {
            g.fillStyle = "#c8c2b344";
            g.fillRect(ix * cell + 6, iy * cell + 6, cell * 0.3, cell * 0.2);
          }
        }
      g.strokeStyle = "#b9b2a1";
      g.lineWidth = 2;
      for (let i = 0; i <= 8; i++) {
        g.beginPath();
        g.moveTo(i * cell, 0);
        g.lineTo(i * cell, h);
        g.stroke();
        g.beginPath();
        g.moveTo(0, i * cell);
        g.lineTo(w, i * cell);
        g.stroke();
      }
    });
    tex.wrapS = tex.wrapT = SN.T.RepeatWrapping;
    SN.shopTileCache.set("tile", tex);
    return tex;
  };

  SN.productLabelTexture = function productLabelTexture(label, paper, ink) {
    const key = label + paper + ink;
    if (SN.productLabelCache.has(key))
      return SN.productLabelCache.get(key);
    const tex = SN.shopCanvasTexture(256, 128, (g, w, h) => {
      g.fillStyle = paper;
      g.fillRect(0, 0, w, h);
      g.fillStyle = ink;
      g.globalAlpha = 0.16;
      g.fillRect(0, h * 0.62, w, h * 0.38);
      g.globalAlpha = 1;
      g.strokeStyle = ink;
      g.lineWidth = 5;
      g.strokeRect(7, 7, w - 14, h - 14);
      g.textAlign = "center";
      g.fillStyle = ink;
      g.font = "700 30px system-ui";
      g.fillText(label, w / 2, 55);
      g.font = "600 14px system-ui";
      g.fillText("ORIGINAL · SEOUL", w / 2, 86);
      g.globalAlpha = 0.75;
      g.font = "500 12px system-ui";
      g.fillText("Net 120 g / 2026", w / 2, 106);
    });
    SN.productLabelCache.set(key, tex);
    return tex;
  };

  SN.prepareShopBasis = function prepareShopBasis(spec) {
    const hw = spec.w / 2, hd = spec.d / 2;
    spec.minX = spec.x - hw;
    spec.maxX = spec.x + hw;
    spec.minZ = spec.z - hd;
    spec.maxZ = spec.z + hd;
    spec.inwardX = spec.side === "north" ? 0 : spec.side === "south" ? 0 : spec.side === "east" ? -1 : 1;
    spec.inwardZ = spec.side === "north" ? 1 : spec.side === "south" ? -1 : 0;
    spec.rightX = spec.inwardZ;
    spec.rightZ = -spec.inwardX;
    spec.doorPoint = {
      x: spec.side === "east" ? spec.maxX : spec.side === "west" ? spec.minX : spec.x,
      z: spec.side === "south" ? spec.maxZ : spec.side === "north" ? spec.minZ : spec.z
    };
    spec.yaw = spec.side === "east" ? SN.PI / 2 : spec.side === "west" ? -SN.PI / 2 : spec.side === "south" ? 0 : SN.PI;
    spec.outside = { x: spec.doorPoint.x + Math.sin(spec.yaw) * 2.15, z: spec.doorPoint.z + Math.cos(spec.yaw) * 2.15 };
    spec.innerPoint = { x: spec.doorPoint.x - Math.sin(spec.yaw) * 1.9, z: spec.doorPoint.z - Math.cos(spec.yaw) * 1.9 };
    spec.shellGroup = new SN.T.Group();
    spec.shellGroup.name = "shop-shell-" + spec.id;
    SN.scene.add(spec.shellGroup);
    spec.interiorGroup = null;
    spec.fixturesBuilt = false;
    spec.doorOpen = 0;
    spec.doorPulse = 0;
    spec.playerInside = false;
    spec.enterCool = 0;
    spec.robbery = null;
    spec.robberyCool = 0;
    spec.alarm = 0;
    spec.phoneSeen = false;
  };

  SN.shopLocalPoint = function shopLocalPoint(spec, u, v) {
    return {
      x: spec.doorPoint.x + spec.rightX * u + spec.inwardX * v,
      z: spec.doorPoint.z + spec.rightZ * u + spec.inwardZ * v
    };
  };

  SN.shopWorldBox = function shopWorldBox(parts, spec, u, v, y, su, sy, sv) {
    const p = SN.shopLocalPoint(spec, u, v), alongX = Math.abs(spec.inwardX) > 0.5;
    parts.push({ g: SN.box, x: p.x, y: y, z: p.z, sx: alongX ? sv : su, sy: sy, sz: alongX ? su : sv });
  };

  SN.shopSolid = function shopSolid(spec, u, v, su, sv, height) {
    const p = SN.shopLocalPoint(spec, u, v), alongX = Math.abs(spec.inwardX) > 0.5;
    SN.addOBB(p.x, p.z, alongX ? sv : su, alongX ? su : sv, height, 0, spec.base);
  };

  SN.shopMesh = function shopMesh(parts, color, extra, group, shadow = true) {
    if (!parts.length)
      return null;
    const m = new SN.T.Mesh(SN.merged(parts), SN.iMat(color, extra));
    m.castShadow = shadow;
    m.receiveShadow = true;
    (group || SN.scene).add(m);
    return m;
  };

  SN.prepareShopLayout = function prepareShopLayout(spec) {
    const front = spec.front, depth = spec.depth;
    if (spec.kind === "mart") {
      spec.counterSpot = SN.shopLocalPoint(spec, -3.8, 10.95);
      spec.counterFace = SN.shopLocalPoint(spec, -3.8, 12.05);
      spec.clerkSpot = SN.shopLocalPoint(spec, -3.8, 13.15);
      spec.clerkYaw = spec.yaw;
      spec.shopperSpots = [SN.shopLocalPoint(spec, 2.45, 6.35), SN.shopLocalPoint(spec, -4.35, 7.55)];
      spec.ramenSpot = SN.shopLocalPoint(spec, 4.05, 11.25);
    }
    else if (spec.kind === "stall") {
      spec.counterSpot = SN.shopLocalPoint(spec, 0, depth * 0.42);
      spec.counterFace = SN.shopLocalPoint(spec, 0, depth * 0.64);
      spec.clerkSpot = SN.shopLocalPoint(spec, 0, depth * 0.78);
      spec.clerkYaw = spec.yaw;
      spec.shopperSpots = [SN.shopLocalPoint(spec, -1.6, depth * 0.2)];
    }
    else {
      spec.counterSpot = SN.shopLocalPoint(spec, -front * 0.2, depth * 0.54);
      spec.counterFace = SN.shopLocalPoint(spec, -front * 0.2, depth * 0.7);
      spec.clerkSpot = SN.shopLocalPoint(spec, -front * 0.2, depth * 0.82);
      spec.clerkYaw = spec.yaw;
      spec.shopperSpots = [SN.shopLocalPoint(spec, front * 0.27, depth * 0.38)];
    }
  };

  SN.buildShopShell = function buildShopShell(spec) {
    SN.prepareShopBasis(spec);
    SN.prepareShopLayout(spec);
    let top = -999;
    for (let ix = -1; ix <= 1; ix++)
      for (let iz = -1; iz <= 1; iz++)
        top = Math.max(top, SN.surfaceHeight(spec.x + ix * spec.w * 0.42, spec.z + iz * spec.d * 0.42));
    spec.base = Math.max(top + 0.06, SN.groundHeight(spec.x, spec.z) + 0.05);
    SN.addFoundation(spec.x, spec.z, spec.w, spec.d, 0, SN.footprintTerrain(spec.x, spec.z, spec.w, spec.d), spec.base);
    const base = spec.base, h = spec.h, TH = 0.3, DOOR_H = 2.56;
    const chain = SN.shopChainOf(spec),
      facade = chain ? chain.body : 0x4d5654,
      band = chain ? chain.band : 0x6f7f78,
      accent = chain ? chain.accent : 0xa5f0cb;
    SN.rasterSurface(spec.minX, spec.maxX, spec.minZ, spec.maxZ, () => true, () => base, 2);
    const walls = [], bandParts = [], glass = [], frames = [], trim = [], floorParts = [], roof = [];
    for (const sideName of ["north", "south", "east", "west"]) {
      const horizontal = sideName === "north" || sideName === "south", axis = horizontal ? "x" : "z";
      const frontSide = sideName === spec.side;
      const coord = sideName === "north" ? spec.minZ : sideName === "south" ? spec.maxZ : sideName === "west" ? spec.minX : spec.maxX;
      const a0 = horizontal ? spec.minX : spec.minZ, a1 = horizontal ? spec.maxX : spec.maxZ;
      let spans = [[a0, a1]];
      if (frontSide) {
        const c = horizontal ? spec.x : spec.z,
          d0 = Math.max(a0, c - spec.door.width / 2),
          d1 = Math.min(a1, c + spec.door.width / 2);
        spans = [];
        if (d0 - a0 > 0.06)
          spans.push([a0, d0]);
        if (a1 - d1 > 0.06)
          spans.push([d1, a1]);
        SN.wallBand(walls, axis, d0, d1, coord, base + DOOR_H, h - DOOR_H, TH);
        for (const g of [d0, d1]) {
          if (axis === "x")
            frames.push({ g: SN.box, x: g, y: base + DOOR_H / 2, z: coord, sx: 0.16, sy: DOOR_H, sz: TH + 0.12 });
          else
            frames.push({ g: SN.box, x: coord, y: base + DOOR_H / 2, z: g, sx: TH + 0.12, sy: DOOR_H, sz: 0.16 });
        }
      }
      for (const span of spans) {
        const b0 = span[0], b1 = span[1], len = b1 - b0;
        if (len <= 0.04)
          continue;
        const glazed = frontSide;
        if (glazed) {
          SN.wallBand(walls, axis, b0, b1, coord, base, 0.46, TH);
          SN.wallBand(walls, axis, b0, b1, coord, base + 2.52, h - 2.52, TH);
          SN.wallBand(glass, axis, b0, b1, coord, base + 0.46, 2.06, 0.055);
          SN.wallBand(trim, axis, b0, b1, coord, base + 2.48, 0.13, TH + 0.05);
          SN.wallBand(trim, axis, b0, b1, coord, base + 0.47, 0.11, TH + 0.05);
          SN.wallBand(bandParts, axis, b0, b1, coord, base + 0.06, 0.4, 0.06);
          const count = Math.max(1, Math.round(len / 2.3));
          for (let m = 0; m <= count; m++) {
            const p = b0 + len * m / count;
            if (axis === "x")
              frames.push({ g: SN.box, x: p, y: base + 1.5, z: coord, sx: 0.09, sy: 2.03, sz: TH + 0.06 });
            else
              frames.push({ g: SN.box, x: coord, y: base + 1.5, z: p, sx: TH + 0.06, sy: 2.03, sz: 0.09 });
          }
        }
        else {
          SN.wallBand(walls, axis, b0, b1, coord, base, h, TH);
          SN.wallBand(bandParts, axis, b0, b1, coord, base + 0.28, 0.56, TH + 0.05);
          SN.wallBand(trim, axis, b0, b1, coord, base + 1.36, 0.08, TH + 0.03);
        }
        if (axis === "x")
          SN.addOBB((b0 + b1) / 2, coord, b1 - b0, TH, h, 0, base);
        else
          SN.addOBB(coord, (b0 + b1) / 2, TH, b1 - b0, h, 0, base);
      }
    }
    for (const cx of [spec.minX, spec.maxX])
      for (const cz of [spec.minZ, spec.maxZ])
        trim.push({ g: SN.box, x: cx, y: base + h / 2, z: cz, sx: 0.38, sy: h, sz: 0.38 });
    // floor, ceiling deck and roof parapet
    floorParts.push({ g: SN.box, x: spec.x, y: base - 0.08, z: spec.z, sx: spec.w, sy: 0.16, sz: spec.d });
    SN.shopMesh(walls, facade, null, spec.shellGroup);
    SN.shopMesh(bandParts, band, null, spec.shellGroup);
    SN.shopMesh(trim, 0x2d3a3a, null, spec.shellGroup);
    SN.shopMesh(glass, 0xa9d4d2, {
      transparent: true,
      opacity: 0.27,
      roughness: 0.05,
      metalness: 0.25,
      side: SN.T.DoubleSide,
      depthWrite: false
    }, spec.shellGroup, false);
    SN.shopMesh(frames, 0x3a4a4a, null, spec.shellGroup);
    SN.shopMesh(floorParts, 0xb7b2a5, null, spec.shellGroup, false);
    SN.shopMesh([{ g: SN.box, x: spec.x, y: base + h - 0.14, z: spec.z, sx: spec.w - 0.2, sy: 0.14, sz: spec.d - 0.2 }], 0xcfd0c5, null, spec.shellGroup, false);
    roof.push({ g: SN.box, x: spec.x, y: base + h + 0.16, z: spec.z, sx: spec.w + 0.32, sy: 0.26, sz: spec.d + 0.32 });
    const parapet = [];
    SN.wallBand(parapet, "x", spec.minX - 0.1, spec.maxX + 0.1, spec.minZ - 0.12, base + h + 0.28, 0.48, 0.22);
    SN.wallBand(parapet, "x", spec.minX - 0.1, spec.maxX + 0.1, spec.maxZ + 0.12, base + h + 0.28, 0.48, 0.22);
    SN.wallBand(parapet, "z", spec.minZ - 0.12, spec.maxZ + 0.12, spec.minX - 0.12, base + h + 0.28, 0.48, 0.22);
    SN.wallBand(parapet, "z", spec.minZ - 0.12, spec.maxZ + 0.12, spec.maxX + 0.12, base + h + 0.28, 0.48, 0.22);
    SN.shopMesh(roof, 0x7b827d, null, spec.shellGroup);
    SN.shopMesh(parapet, 0x646d68, null, spec.shellGroup);
    // door threshold mat
    const matAlongX = Math.abs(Math.cos(spec.yaw)) > 0.5;
    const matParts = [
      {
        g: SN.box,
        x: spec.doorPoint.x,
        y: base + 0.012,
        z: spec.doorPoint.z,
        sx: matAlongX ? 1.9 : 0.55,
        sy: 0.02,
        sz: matAlongX ? 0.55 : 1.9
      }
    ];
    SN.shopMesh(matParts, 0x34474a, null, spec.shellGroup, false);
    // automatic sliding door: two framed glass leaves on a local track
    const doorGroup = new SN.T.Group();
    doorGroup.position.set(spec.doorPoint.x, base, spec.doorPoint.z);
    doorGroup.rotation.y = spec.yaw;
    spec.shellGroup.add(doorGroup);
    const panelW = spec.door.width / 2 - 0.035, leaves = [];
    for (const s of [-1, 1]) {
      const leaf = new SN.T.Group();
      leaf.position.set(s * panelW * 0.5, 0, 0);
      doorGroup.add(leaf);
      const leafMesh = new SN.T.Mesh(SN.box, SN.iMat(0xbfe4e1, {
        transparent: true,
        opacity: 0.32,
        roughness: 0.05,
        metalness: 0.15,
        side: SN.T.DoubleSide,
        depthWrite: false
      }));
      leafMesh.position.set(0, 1.28, 0);
      leafMesh.scale.set(panelW, 2.45, 0.055);
      leafMesh.castShadow = false;
      leaf.add(leafMesh);
      for (const p of [
        { x: 0, y: 0.08, z: 0, sx: panelW, sy: 0.14, sz: 0.09 },
        { x: 0, y: 2.47, z: 0, sx: panelW, sy: 0.12, sz: 0.09 },
        { x: -panelW / 2 + 0.035, y: 1.28, z: 0, sx: 0.07, sy: 2.45, sz: 0.09 },
        { x: panelW / 2 - 0.035, y: 1.28, z: 0, sx: 0.07, sy: 2.45, sz: 0.09 }
      ]) {
        const bar = SN.meshAt(SN.box, SN.iMat(0x33494b), p.x, p.y, p.z, p.sx, p.sy, p.sz, 0, leaf);
        bar.castShadow = false;
      }
      leaves.push(leaf);
    }
    spec.doorLeaves = leaves;
    spec.doorLeafBase = panelW * 0.5;
    spec.doorGroup = doorGroup;
    // chain fascia, main sign, blade sign and entrance light
    const signW = Math.min(spec.front - 1.2, 9.8), signH = 0.86;
    const out = { x: spec.doorPoint.x + Math.sin(spec.yaw) * 0.18, z: spec.doorPoint.z + Math.cos(spec.yaw) * 0.18 };
    if (chain) {
      const st = SN.shopSignTexture(spec),
        sm = SN.mat(0xffffff, { map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.66, side: SN.T.DoubleSide });
      const smesh = SN.meshAt(new SN.T.PlaneGeometry(signW, signH), sm, out.x, base + h - 0.52, out.z, 1, 1, 1, spec.yaw);
      smesh.castShadow = false;
      spec.shellGroup.add(smesh);
      const bt = SN.shopBladeTexture(spec),
        bm = SN.mat(0xffffff, { map: bt, emissive: 0xffffff, emissiveMap: bt, emissiveIntensity: 0.72, side: SN.T.DoubleSide });
      const bp = SN.shopLocalPoint(spec, spec.front * 0.5 - 0.8, -0.62);
      const blade = SN.meshAt(new SN.T.PlaneGeometry(1.15, 1.72), bm, bp.x, base + 2.6, bp.z, 1, 1, 1, spec.yaw + SN.PI / 2);
      blade.castShadow = false;
      spec.shellGroup.add(blade);
      const bladeArm = SN.meshAt(SN.box, SN.iMat(0x39494a), bp.x, base + 2.6, bp.z, 0.12, 1.5, 0.12);
      spec.shellGroup.add(bladeArm);
      SN.glow(SN.scene, out.x, base + 2.82, out.z, 1.45, accent);
      SN.glow(SN.scene, bp.x, base + 2.7, bp.z, 0.9, accent);
    }
    else {
      const st = SN.textTexture(spec.name, "#23363b", "#e8f1de", 768, 160);
      const sm = SN.mat(0xffffff, { map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.58, side: SN.T.DoubleSide });
      const smesh = SN.meshAt(new SN.T.PlaneGeometry(signW, signH), sm, out.x, base + h - 0.5, out.z, 1, 1, 1, spec.yaw);
      smesh.castShadow = false;
      spec.shellGroup.add(smesh);
      const lampColor = spec.light || 0xffd39a;
      SN.glow(SN.scene, out.x, base + 2.7, out.z, 1.2, lampColor);
    }
    // shallow canopy over the entrance
    const canopy = [];
    SN.shopWorldBox(canopy, spec, 0, -0.62, base + 2.76, spec.door.width + 1.1, 0.1, 1.15);
    SN.shopMesh(canopy, band, null, spec.shellGroup, false);
    // interior floor tiling is visible from the street, so it belongs to the shell
    const floorMat = new SN.T.MeshStandardMaterial({ map: SN.shopTileTexture(), color: 0xf3eee2, roughness: 0.62, metalness: 0.02 });
    const floorMesh = new SN.T.Mesh(new SN.T.BoxGeometry(spec.w - 0.1, 0.035, spec.d - 0.1), floorMat);
    // The walkable floor is `base`; put the visible tile top exactly on it so the
    // customer's soles and the door mat do not float or sink.
    floorMesh.position.set(spec.x, base - 0.0175, spec.z);
    floorMesh.receiveShadow = true;
    spec.shellGroup.add(floorMesh);
    // room record and door integration
    SN.interiors.push({
      id: spec.id,
      name: spec.name,
      minX: spec.minX,
      maxX: spec.maxX,
      minZ: spec.minZ,
      maxZ: spec.maxZ,
      floor: base,
      ceil: base + h - 0.18,
      door: spec.doorPoint,
      inner: spec.innerPoint,
      outside: spec.outside,
      shop: spec
    });
    return spec;
  };

  SN.shopInteriorStart = function shopInteriorStart(spec) {
    const g = new SN.T.Group();
    g.name = "shop-interior-" + spec.id;
    g.visible = false;
    spec.shellGroup.add(g);
    spec.interiorGroup = g;
    spec.fixturesBuilt = true;
    spec.shopLights = [];
    spec.stockMaps = new Map();
    return g;
  };

  SN.shopLampLight = function shopLampLight(spec, x, y, z, color, intensity, distance) {
    const light = new SN.T.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    light.visible = false;
    SN.scene.add(light);
    spec.shopLights.push(light);
    return light;
  };

  SN.shopTrimPoint = function shopTrimPoint(spec, u, v, y) {
    const p = SN.shopLocalPoint(spec, u, v);
    return { x: p.x, y: y, z: p.z };
  };

  SN.addShopStock = function addShopStock(spec, labelIndex, shape, u, v, y, size, tint) {
    const key = labelIndex + "|" + shape;
    let map = spec.stockMaps.get(key);
    if (!map) {
      map = { items: [] };
      spec.stockMaps.set(key, map);
    }
    const p = SN.shopLocalPoint(spec, u, v), alongX = Math.abs(spec.inwardX) > 0.5;
    map.items.push({ x: p.x, y, z: p.z, sx: alongX ? size[2] : size[0], sy: size[1], sz: alongX ? size[0] : size[2], tint });
  };

  SN.flushShopStock = function flushShopStock(spec, group) {
    for (const [key, map] of spec.stockMaps) {
      if (!map.items.length)
        continue;
      const sep = key.indexOf("|"),
        labelIndex = Number(key.slice(0, sep)),
        shape = key.slice(sep + 1),
        data = SN.shopProductLabels[labelIndex];
      const tex = SN.productLabelTexture(data.label, data.paper, data.ink);
      const material = new SN.T.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.52, metalness: 0.02 });
      const geometry = shape === "cup" ? SN.cupGeo : shape === "bottle" ? SN.cylinder : SN.box;
      const mesh = new SN.T.InstancedMesh(geometry, material, map.items.length);
      mesh.instanceMatrix.setUsage(SN.T.StaticDrawUsage);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      for (let i = 0; i < map.items.length; i++) {
        const it = map.items[i];
        SN.dummy.position.set(it.x, it.y, it.z);
        SN.dummy.rotation.set(0, (labelIndex * 0.7 + it.x * 0.13) % SN.TAU, 0);
        SN.dummy.scale.set(it.sx, it.sy, it.sz);
        SN.dummy.updateMatrix();
        mesh.setMatrixAt(i, SN.dummy.matrix);
        mesh.setColorAt(i, it.tint);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor)
        mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
    }
  };

  SN.shopPromoTexture = function shopPromoTexture(title, sub, color) {
    return SN.shopCanvasTexture(512, 384, (g, w, h) => {
      g.fillStyle = "#f2eddf";
      g.fillRect(0, 0, w, h);
      g.fillStyle = color;
      g.fillRect(0, 0, w, h * 0.54);
      g.fillStyle = "#f7f2e8";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "700 54px system-ui";
      g.fillText(title, w / 2, h * 0.27);
      g.font = "500 21px system-ui";
      g.fillText(sub, w / 2, h * 0.43);
      g.fillStyle = "#26383a";
      g.font = "600 30px system-ui";
      g.fillText("ORIGINAL CITY EDITION", w / 2, h * 0.68);
      g.fillStyle = "#506463";
      g.font = "400 20px system-ui";
      g.fillText("서울 · 24 HOUR NEIGHBOURHOOD", w / 2, h * 0.8);
      g.strokeStyle = color;
      g.lineWidth = 8;
      g.strokeRect(6, 6, w - 12, h - 12);
    });
  };

  SN.shopWallSign = function shopWallSign(spec, group, text, u, v, y, w, h, bg, fg, faceInward = true) {
    const p = SN.shopLocalPoint(spec, u, v), yaw = faceInward ? spec.yaw : spec.yaw + SN.PI;
    const tex = SN.textTexture(text, bg, fg, 512, 160);
    const material = SN.mat(0xffffff, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.38, side: SN.T.DoubleSide });
    const m = SN.meshAt(new SN.T.PlaneGeometry(w, h), material, p.x, y, p.z, 1, 1, 1, yaw);
    m.castShadow = false;
    group.add(m);
    return m;
  };
  // ---------- Convenience-store interior ----------

  SN.buildMartInterior = function buildMartInterior(spec) {
    const g = SN.shopInteriorStart(spec),
      base = spec.base,
      h = spec.h,
      ceil = base + h - 0.2,
      chain = SN.shopChainOf(spec) || SN.shopChains[0];
    const solids = [], warm = [], metal = [], dark = [], paper = [], cool = [];
    // ceiling, panels and the two cool-white practicals
    SN.shopMesh([{ g: SN.box, x: spec.x, y: ceil + 0.05, z: spec.z, sx: spec.w - 0.3, sy: 0.12, sz: spec.d - 0.3 }], 0xd7dad2, null, g, false);
    const panelParts = [];
    for (let row = 0; row < 3; row++)
      for (const u of [-2.25, 2.25]) {
        const v = 3 + row * 3.6;
        SN.shopWorldBox(panelParts, spec, u, v, ceil - 0.06, 1.95, 0.08, 0.62);
        const cp = SN.shopLocalPoint(spec, u, v);
        SN.glow(SN.scene, cp.x, ceil - 0.16, cp.z, 1, 0xeaf8ff);
      }
    SN.shopMesh(panelParts, 0xf3f8f1, { emissive: 0xe6f6ff, emissiveIntensity: 1.35 }, g, false);
    SN.shopLampLight(spec, spec.x + spec.inwardX * 2.6, ceil - 0.55, spec.z + spec.inwardZ * 2.6, 0xe9f6ff, 1.1, 21);
    SN.shopLampLight(spec, spec.x + spec.inwardX * (spec.depth * 0.72), ceil - 0.5, spec.z + spec.inwardZ * (spec.depth * 0.72), 0xdfefff, 1, 20);
    // two long gondolas: base, spine, boards, end caps
    for (const u of [-2.35, 2.35]) {
      const rowParts = [], endParts = [], edgeParts = [];
      SN.shopWorldBox(rowParts, spec, u, 6.9, base + 0.16, 0.98, 0.32, 4.9);
      SN.shopWorldBox(rowParts, spec, u, 6.9, base + 0.9, 0.09, 1.48, 4.9);
      for (let level = 0; level < 4; level++) {
        const y = base + 0.38 + level * 0.35;
        SN.shopWorldBox(edgeParts, spec, u, 6.9, y, 1.04, 0.055, 4.78);
        SN.shopWorldBox(edgeParts, spec, u, 6.9, y - 0.09, 0.96, 0.06, 4.72);
      }
      for (const v of [4.62, 9.18])
        SN.shopWorldBox(endParts, spec, u, v, base + 0.82, 0.98, 1.55, 0.1);
      SN.shopMesh(rowParts, 0x697773, null, g);
      SN.shopMesh(edgeParts, 0xd9d3c3, null, g);
      SN.shopMesh(endParts, 0x475955, null, g);
      SN.shopSolid(spec, u, 6.9, 1.08, 4.95, 1.6);
      for (const side of [-1, 1]) {
        const su = u + side * 0.34;
        for (let level = 0; level < 4; level++) {
          const y = base + 0.44 + level * 0.35;
          for (let i = 0; i < 8; i++) {
            const v = 4.92 + i * 0.55, label = (i + level * 2 + (u > 0 ? 1 : 0)) % SN.shopProductLabels.length;
            const shape = level === 0 | level === 2 ? "bottle" : (i % 5 === 3 ? "bag" : "box");
            const tint = new SN.T.Color().setHSL(((label * 53 + i * 31) % 360) / 360, 0.28, level === 3 ? 0.76 : 0.64);
            if (shape === "bottle")
              SN.addShopStock(spec, label, "bottle", su, v, y + 0.17, [0.13, 0.34, 0.13], tint);
            else if (shape === "bag")
              SN.addShopStock(spec, label, "box", su, v, y + 0.18, [0.28, 0.34, 0.12], tint);
            else
              SN.addShopStock(spec, label, "box", su, v, y + 0.16, [0.24, 0.3, 0.2], tint);
          }
        }
      }
    }
    // glowing drink fridge bank along the right wall
    const fridgeParts = [], fridgeLight = [], fridgeFrames = [];
    SN.shopWorldBox(fridgeParts, spec, 5.38, 6.55, base + 1.45, 0.86, 2.9, 5.6);
    SN.shopWorldBox(fridgeLight, spec, 5.08, 6.55, base + 2.82, 0.1, 0.1, 5.3);
    for (let level = 0; level < 4; level++)
      SN.shopWorldBox(fridgeFrames, spec, 5.08, 6.55, base + 0.48 + level * 0.62, 0.05, 0.05, 5.25);
    for (const v of [4.35, 6.55, 8.75])
      SN.shopWorldBox(fridgeFrames, spec, 4.93, v, base + 1.42, 0.09, 2.55, 0.07);
    SN.shopWorldBox(fridgeFrames, spec, 4.93, 4.35, base + 1.42, 0.09, 2.55, 0.07);
    SN.shopWorldBox(fridgeFrames, spec, 4.93, 8.75, base + 1.42, 0.09, 2.55, 0.07);
    SN.shopWorldBox(fridgeFrames, spec, 4.93, 6.55, base + 1.42, 0.09, 2.55, 0.07);
    SN.shopMesh(fridgeParts, 0x2f4449, null, g);
    SN.shopMesh(fridgeLight, 0xd9fbff, { emissive: 0x9feeff, emissiveIntensity: 1.5 }, g, false);
    SN.shopMesh(fridgeFrames, 0x44595b, null, g);
    const fridgeGlass = new SN.T.Mesh(new SN.T.PlaneGeometry(5.35, 2.35), SN.iMat(0xbfe9e6, {
      transparent: true,
      opacity: 0.23,
      roughness: 0.04,
      metalness: 0.28,
      side: SN.T.DoubleSide,
      depthWrite: false
    }));
    const fgPoint = SN.shopLocalPoint(spec, 4.9, 6.55);
    fridgeGlass.position.set(fgPoint.x, base + 1.42, fgPoint.z);
    fridgeGlass.rotation.y = spec.yaw + SN.PI / 2;
    g.add(fridgeGlass);
    SN.shopSolid(spec, 5.38, 6.55, 1, 5.7, 2.9);
    for (let level = 0; level < 4; level++)
      for (let i = 0; i < 12; i++) {
        const label = (i + level * 3) % SN.shopProductLabels.length,
          v = 4.18 + i * 0.405,
          tint = new SN.T.Color().setHSL(((label * 47 + level * 23) % 360) / 360, 0.3, 0.7);
        SN.addShopStock(spec, label, "bottle", 5.36, v, base + 0.62 + level * 0.61, [0.14, 0.31, 0.14], tint);
      }
    const fridgeGlow = SN.shopLocalPoint(spec, 4.8, 6.55);
    SN.glow(SN.scene, fridgeGlow.x, base + 1.45, fridgeGlow.z, 2.1, 0x9cefff);
    // counter, register, card terminal and the cigarette rack behind the clerk
    SN.shopWorldBox(warm, spec, -3.8, 12.05, base + 0.5, 4.15, 0.98, 1.05);
    SN.shopWorldBox(metal, spec, -3.8, 12.05, base + 1.02, 4.25, 0.09, 1.14);
    SN.shopWorldBox(warm, spec, -3.8, 11.55, base + 0.72, 4.1, 0.3, 0.08);
    SN.shopSolid(spec, -3.8, 12.05, 4.35, 1.2, 1.1);
    SN.shopWorldBox(dark, spec, -4.55, 12.05, base + 1.14, 0.38, 0.2, 0.3);
    const screenP = SN.shopLocalPoint(spec, -4.55, 11.92);
    const regScreen = SN.meshAt(SN.box, SN.mat(0xbff5e2, { emissive: 0x8ff0c6, emissiveIntensity: 1.2 }), screenP.x, base + 1.4, screenP.z, 0.36, 0.24, 0.04, spec.yaw);
    g.add(regScreen);
    SN.shopWorldBox(dark, spec, -3.2, 12, base + 1.12, 0.24, 0.16, 0.2);
    SN.shopWorldBox(dark, spec, -3.2, 11.9, base + 1.2, 0.17, 0.08, 0.12);
    SN.shopWorldBox(metal, spec, -4.05, 12, base + 1.08, 0.32, 0.05, 0.34);
    // wall cigarette rack and small saferack
    SN.shopWorldBox(dark, spec, -3.85, 13.78, base + 1.9, 3.3, 1.05, 0.15);
    for (let i = 0; i < 18; i++) {
      const u = -5.25 + (i % 9) * 0.34, v = 13.7, row = Math.floor(i / 9);
      SN.shopWorldBox(paper, spec, u, v, base + 2.22 - row * 0.36, 0.27, 0.24, 0.07);
    }
    SN.shopMesh(warm, chain.band, null, g);
    SN.shopMesh(metal, 0xaab5ae, null, g);
    SN.shopMesh(dark, 0x323f42, null, g);
    SN.shopMesh(paper, chain.accent, { emissive: chain.accent, emissiveIntensity: 0.18 }, g, false);
    // ramen / hot-water station at the back right
    const ramen = SN.shopLocalPoint(spec, 4.05, 12.35);
    SN.shopWorldBox(warm, spec, 4.05, 12.35, base + 0.52, 1.05, 0.98, 1.55);
    SN.shopWorldBox(metal, spec, 4.05, 12.35, base + 1.03, 1.15, 0.08, 1.64);
    SN.shopSolid(spec, 4.05, 12.35, 1.15, 1.7, 1.1);
    SN.shopWorldBox(dark, spec, 4.05, 12.6, base + 1.35, 0.56, 0.52, 0.38);
    SN.shopWorldBox(metal, spec, 4.05, 12.37, base + 1.28, 0.08, 0.4, 0.08);
    for (let i = 0; i < 3; i++)
      SN.shopWorldBox(paper, spec, 3.55 + i * 0.17, 12.7, base + 1.16, 0.14, 0.2, 0.14);
    for (let i = 0; i < 6; i++)
      SN.addShopStock(spec, 1, "cup", 3.62 + (i % 3) * 0.3, 12.02 + Math.floor(i / 3) * 0.3, base + 1.13, [0.15, 0.21, 0.15], new SN.T.Color().setHSL(((i * 61) % 360) / 360, 0.34, 0.66));
    SN.shopWallSign(spec, g, "라면 · 泡面", 4.05, 13.82, base + 2.5, 1.9, 0.55, "#6b3524", "#ffe7c4");
    const steam = SN.shopLocalPoint(spec, 4.05, 12.45);
    SN.glow(SN.scene, steam.x, base + 1.7, steam.z, 0.85, 0xffdfb0);
    // window bar along the front glazing, left of the entrance, with three stools
    SN.shopWorldBox(metal, spec, -3.35, 0.58, base + 1.02, 3.55, 0.08, 0.38);
    SN.shopWorldBox(metal, spec, -3.35, 0.58, base + 0.52, 0.1, 0.9, 0.3);
    SN.shopSolid(spec, -3.35, 0.58, 3.65, 0.5, 1.02);
    for (const u of [-4.55, -3.1, -1.65]) {
      const st = SN.shopLocalPoint(spec, u, 1.28);
      const stool = new SN.T.Mesh(SN.cylinder, SN.iMat(0x354a4b));
      stool.position.set(st.x, base + 0.42, st.z);
      stool.scale.set(0.24, 0.78, 0.24);
      g.add(stool);
      const seat = new SN.T.Mesh(SN.cylinder, SN.iMat(0x7a8b83));
      seat.position.set(st.x, base + 0.82, st.z);
      seat.scale.set(0.3, 0.08, 0.3);
      g.add(seat);
      SN.shopSolid(spec, u, 1.28, 0.6, 0.6, 0.82);
    }
    // snack rack and basket stack near the entrance
    SN.shopWorldBox(warm, spec, -5.15, 2.35, base + 0.62, 0.46, 1.22, 2.2);
    for (let level = 0; level < 3; level++)
      SN.shopWorldBox(metal, spec, -5.15, 2.35, base + 0.28 + level * 0.38, 0.55, 0.05, 2.25);
    SN.shopSolid(spec, -5.15, 2.35, 0.65, 2.3, 1.25);
    for (let level = 0; level < 3; level++)
      for (let i = 0; i < 5; i++)
        SN.addShopStock(spec, (i + level) % 6, "box", -5.15, 1.5 + i * 0.34, base + 0.34 + level * 0.38, [0.24, 0.3, 0.18], new SN.T.Color().setHSL(((i * 67 + level * 31) % 360) / 360, 0.32, 0.73));
    for (let i = 0; i < 3; i++)
      SN.shopWorldBox(paper, spec, 2.75 + i * 0.18, 1.05 + i * 0.1, base + 0.24 + i * 0.22, 0.6, 0.42, 0.6);
    SN.shopSolid(spec, 2.75, 1.12, 0.85, 0.85, 0.8);
    for (let i = 0; i < 2; i++) {
      const bp = SN.shopLocalPoint(spec, 4.75 + i * 0.7, 0.85);
      const bin = new SN.T.Mesh(SN.cylinder, SN.iMat(i ? 0x5f7470 : 0x48605d));
      bin.position.set(bp.x, base + 0.48, bp.z);
      bin.scale.set(0.28, 0.96, 0.28);
      g.add(bin);
    }
    // posters, aisle signs and wall clock
    const promo = SN.shopPromoTexture("거리를 걷다", "街头补给 · CITY WALK", "#" + chain.band.toString(16).padStart(6, "0"));
    const pm = SN.mat(0xffffff, { map: promo, emissive: 0xffffff, emissiveMap: promo, emissiveIntensity: 0.25 });
    const pp = SN.shopLocalPoint(spec, 0, 13.82);
    const poster = SN.meshAt(new SN.T.PlaneGeometry(1.7, 1.3), pm, pp.x, base + 1.95, pp.z, 1, 1, 1, spec.yaw);
    g.add(poster);
    SN.shopWallSign(spec, g, "간식 · 零食", -2.35, 9.55, base + 2.62, 1.55, 0.46, "#20393a", "#d8ffe8");
    SN.shopWallSign(spec, g, "음료 · 饮料", 2.35, 9.55, base + 2.62, 1.55, 0.46, "#20393a", "#d8ffe8");
    SN.shopWallSign(spec, g, "계산 · 收银", -3.8, 12.05, base + 2.35, 1.5, 0.42, "#213b3b", "#ffe3ae");
    // small red alarm beacon over the counter
    const bp = SN.shopLocalPoint(spec, -3.8, 13.45);
    const beacon = new SN.T.Mesh(new SN.T.SphereGeometry(0.16, 10, 8), SN.mat(0x8f2d25, { emissive: 0xff4b32, emissiveIntensity: 0.2 }));
    beacon.position.set(bp.x, base + 2.85, bp.z);
    g.add(beacon);
    spec.alarmBeacon = beacon;
    spec.alarmLight = SN.shopLampLight(spec, bp.x, base + 2.7, bp.z, 0xff4d35, 0, 12);
    SN.flushShopStock(spec, g);
    spec.counterWorld = SN.shopLocalPoint(spec, -3.8, 12.05);
    return g;
  };
  // ---------- Independent small-shop interiors ----------

  SN.buildSmallInterior = function buildSmallInterior(spec) {
    const g = SN.shopInteriorStart(spec), base = spec.base, ceil = base + spec.h - 0.25, kind = spec.kind;
    const wood = [], metal = [], dark = [], soft = [], paper = [];
    // shell interior lining tone: café warm, pharmacy clean, karaoke dark
    const wall = kind === "cafe" ? 0x6a503c : kind === "pharmacy" ? 0xd5e2dc : kind === "phone" ? 0xbcc9c8 : kind === "karaoke" ? 0x2b2334 : 0x7a5b3f;
    SN.shopMesh([{ g: SN.box, x: spec.x, y: ceil + 0.02, z: spec.z, sx: spec.w - 0.25, sy: 0.1, sz: spec.d - 0.25 }], wall, null, g, false);
    if (kind === "cafe") {
      SN.shopWorldBox(wood, spec, -1.6, spec.depth * 0.7, base + 0.52, 3.6, 1.02, 0.9);
      SN.shopWorldBox(metal, spec, -1.6, spec.depth * 0.7, base + 1.05, 3.7, 0.07, 1);
      SN.shopSolid(spec, -1.6, spec.depth * 0.7, 3.8, 1.05, 1.1);
      SN.shopWorldBox(dark, spec, -2.35, spec.depth * 0.7, base + 1.3, 0.55, 0.5, 0.55);
      SN.shopWorldBox(metal, spec, -1.25, spec.depth * 0.7, base + 1.2, 0.65, 0.35, 0.5);
      for (let i = 0; i < 3; i++)
        SN.shopWorldBox(paper, spec, -0.45 + i * 0.22, spec.depth * 0.7, base + 1.15, 0.18, 0.22, 0.32);
      for (const u of [2.35])
        for (const v of [3.9, 6.6]) {
          const t = SN.shopLocalPoint(spec, u, v);
          const top = new SN.T.Mesh(SN.cylinder, SN.iMat(0x8a6a4a));
          top.position.set(t.x, base + 0.74, t.z);
          top.scale.set(0.62, 0.07, 0.62);
          g.add(top);
          const stem = new SN.T.Mesh(SN.cylinder, SN.iMat(0x4a3d32));
          stem.position.set(t.x, base + 0.36, t.z);
          stem.scale.set(0.09, 0.72, 0.09);
          g.add(stem);
          SN.shopSolid(spec, u, v, 1.25, 1.25, 0.8);
          for (const s of [-1, 1]) {
            const ch = SN.shopLocalPoint(spec, u + s * 0.82, v);
            const seat = new SN.T.Mesh(SN.box, SN.iMat(0x4b5b58));
            seat.position.set(ch.x, base + 0.44, ch.z);
            seat.scale.set(0.42, 0.08, 0.42);
            g.add(seat);
            const legs = new SN.T.Mesh(SN.box, SN.iMat(0x343e3d));
            legs.position.set(ch.x, base + 0.22, ch.z);
            legs.scale.set(0.36, 0.44, 0.36);
            g.add(legs);
          }
        }
      for (const v of [3.4, 6.4]) {
        const p = SN.shopLocalPoint(spec, 0, v);
        const pendant = new SN.T.Mesh(new SN.T.ConeGeometry(0.38, 0.3, 10), SN.iMat(0x2f3436));
        pendant.position.set(p.x, base + 2.45, p.z);
        g.add(pendant);
        const bulb = new SN.T.Mesh(new SN.T.SphereGeometry(0.09, 8, 6), SN.mat(0xffe4b8, { emissive: 0xffca83, emissiveIntensity: 1.3 }));
        bulb.position.set(p.x, base + 2.32, p.z);
        g.add(bulb);
        SN.glow(SN.scene, p.x, base + 2.2, p.z, 1.25, 0xffcf94);
      }
      SN.shopLampLight(spec, spec.x + spec.inwardX * 3.2, ceil - 0.6, spec.z + spec.inwardZ * 3.2, 0xffc98d, 1.15, 15);
      SN.shopWallSign(spec, g, "오늘의 커피 · 今日咖啡", 0, spec.depth - 0.25, base + 2.35, 2.7, 0.62, "#3c2b20", "#ffe2b0");
      SN.shopWallSign(spec, g, "골목다방", -1.6, spec.depth - 1.2, base + 2.15, 1.6, 0.5, "#3c2b20", "#ffe2b0");
    }
    else if (kind === "phone") {
      for (const u of [-2.2, 1.5])
        for (const v of [2.9, 5]) {
          SN.shopWorldBox(metal, spec, u, v, base + 0.45, 0.9, 0.9, 1.75);
          SN.shopWorldBox(dark, spec, u, v, base + 0.92, 0.78, 0.08, 0.78);
          SN.shopSolid(spec, u, v, 1.05, 1.85, 0.95);
          for (let i = 0; i < 4; i++)
            SN.shopWorldBox(paper, spec, u - 0.3 + i * 0.2, v, base + 0.98, 0.13, 0.28, 0.2);
        }
      SN.shopWorldBox(wood, spec, -1.6, spec.depth * 0.7, base + 0.55, 3.1, 1.05, 0.85);
      SN.shopWorldBox(metal, spec, -1.6, spec.depth * 0.7, base + 1.08, 3.2, 0.07, 0.95);
      SN.shopSolid(spec, -1.6, spec.depth * 0.7, 3.3, 1, 1.12);
      SN.shopWorldBox(dark, spec, -2.1, spec.depth * 0.7, base + 1.25, 0.4, 0.3, 0.3);
      for (const u of [-2.4, 0, 2.4])
        SN.shopWallSign(spec, g, "바다폰 · 海声手机", u, spec.depth - 0.3, base + 2.25, 1.6, 0.48, "#20353a", "#dff8ff");
      SN.shopLampLight(spec, spec.x + spec.inwardX * 3.4, ceil - 0.5, spec.z + spec.inwardZ * 3.4, 0xe6f4ff, 1.2, 16);
    }
    else if (kind === "pharmacy") {
      for (const u of [-2.6, 2.45]) {
        SN.shopWorldBox(soft, spec, u, 4.1, base + 0.8, 0.65, 1.6, 3.5);
        for (let level = 0; level < 4; level++)
          SN.shopWorldBox(metal, spec, u, 4.1, base + 0.35 + level * 0.42, 0.8, 0.05, 3.55);
        SN.shopSolid(spec, u, 4.1, 0.8, 3.6, 1.7);
        for (let level = 0; level < 4; level++)
          for (let i = 0; i < 6; i++)
            SN.shopWorldBox(paper, spec, u - 0.18 * Math.sign(u), 3 + i * 0.44, base + 0.53 + level * 0.42, 0.17, 0.32, 0.18);
      }
      SN.shopWorldBox(wood, spec, -1.2, spec.depth * 0.7, base + 0.55, 2.9, 1.06, 0.9);
      SN.shopWorldBox(metal, spec, -1.2, spec.depth * 0.7, base + 1.09, 3, 0.08, 1);
      SN.shopSolid(spec, -1.2, spec.depth * 0.7, 3.1, 1.05, 1.12);
      SN.shopWorldBox(dark, spec, -2, spec.depth * 0.7, base + 1.25, 0.4, 0.3, 0.32);
      SN.shopWallSign(spec, g, "+  솔잎약방 · 松叶药房  +", 0, spec.depth - 0.25, base + 2.35, 3.6, 0.62, "#e7f4e8", "#2f6b4b");
      SN.shopLampLight(spec, spec.x + spec.inwardX * 3.2, ceil - 0.5, spec.z + spec.inwardZ * 3.2, 0xeafff1, 1.35, 16);
    }
    else if (kind === "stall") {
      SN.shopWorldBox(wood, spec, 0, spec.depth * 0.64, base + 0.55, 4.4, 1.08, 0.95);
      SN.shopWorldBox(metal, spec, 0, spec.depth * 0.64, base + 1.1, 4.5, 0.06, 1.05);
      SN.shopSolid(spec, 0, spec.depth * 0.64, 4.55, 1.1, 1.15);
      for (const u of [-1.3, 0.1, 1.5])
        SN.shopWorldBox(dark, spec, u, spec.depth * 0.64, base + 1.3, 0.5, 0.35, 0.45);
      for (const u of [-1.55, -0.45, 0.7, 1.8]) {
        const st = SN.shopLocalPoint(spec, u, 2.35), round = new SN.T.Mesh(SN.cylinder, SN.iMat(0x7a5b3a));
        round.position.set(st.x, base + 0.62, st.z);
        round.scale.set(0.28, 0.08, 0.28);
        g.add(round);
        const leg = new SN.T.Mesh(SN.cylinder, SN.iMat(0x3c3730));
        leg.position.set(st.x, base + 0.3, st.z);
        leg.scale.set(0.06, 0.6, 0.06);
        g.add(leg);
        SN.benchSpots.push({ x: st.x, z: st.z, yaw: spec.yaw + SN.PI / 2 });
      }
      for (const u of [-1.6, 0, 1.6]) {
        const p = SN.shopLocalPoint(spec, u, 3.9);
        const lamp = new SN.T.Mesh(new SN.T.ConeGeometry(0.3, 0.24, 10), SN.iMat(0x342b26));
        lamp.position.set(p.x, base + 2.35, p.z);
        g.add(lamp);
        SN.glow(SN.scene, p.x, base + 2.2, p.z, 1.05, 0xffc47e);
      }
      SN.shopWallSign(spec, g, "별빛분식 · 星光小吃", 0, spec.depth - 0.2, base + 2.3, 2.8, 0.6, "#4a241c", "#ffe0aa");
      SN.shopLampLight(spec, spec.x + spec.inwardX * 2.4, ceil - 0.5, spec.z + spec.inwardZ * 2.4, 0xffbf7e, 1.25, 12);
    }
    else {
      SN.shopWorldBox(dark, spec, -1.7, spec.depth * 0.7, base + 0.55, 3.4, 1.05, 0.9);
      SN.shopWorldBox(metal, spec, -1.7, spec.depth * 0.7, base + 1.08, 3.5, 0.08, 1);
      SN.shopSolid(spec, -1.7, spec.depth * 0.7, 3.6, 1.05, 1.12);
      SN.shopWorldBox(dark, spec, -2.4, spec.depth - 0.55, base + 1.2, 1.1, 0.6, 2.4);
      for (const item of [{ u: -3.9, v: 5, c: 0xff5aa8 }, { u: 3.9, v: 6.4, c: 0x9b7bff }]) {
        const p = SN.shopLocalPoint(spec, item.u, item.v);
        const strip = SN.meshAt(SN.box, SN.mat(item.c, { emissive: item.c, emissiveIntensity: 1.5 }), p.x, base + 1.6, p.z, 0.08, 2.6, 0.08);
        g.add(strip);
        SN.glow(SN.scene, p.x, base + 1.6, p.z, 1.2, item.c);
      }
      SN.shopWallSign(spec, g, "달빛노래방 · 月光练歌房", 0, spec.depth - 0.25, base + 2.2, 3.4, 0.64, "#221b2b", "#f3a7ff");
      SN.shopWallSign(spec, g, "노래 · 唱歌  2F", 2.1, spec.depth - 1.5, base + 1.7, 1.5, 0.45, "#221b2b", "#9ee9ff");
      SN.shopLampLight(spec, spec.x + spec.inwardX * 3.4, ceil - 0.5, spec.z + spec.inwardZ * 3.4, 0xb48aff, 1.05, 14);
    }
    SN.shopMesh(wood.concat(soft), kind === "pharmacy" ? 0xc7d8d2 : kind === "karaoke" ? 0x3a3048 : 0x7b5b3e, null, g);
    SN.shopMesh(metal, 0x9aa8a0, null, g);
    SN.shopMesh(dark, kind === "karaoke" ? 0x1d1824 : 0x323d3f, null, g);
    SN.shopMesh(paper, 0xe8e0cc, { emissive: 0xfff0cf, emissiveIntensity: 0.1 }, g, false);
    // small warm pendant over the counter for every shop
    const cp = SN.shopLocalPoint(spec, -1.6, spec.depth * 0.7);
    const pendantCord = new SN.T.Mesh(SN.box, SN.iMat(0x2a2c2c));
    pendantCord.position.set(cp.x, base + 2.6, cp.z);
    pendantCord.scale.set(0.04, 0.5, 0.04);
    g.add(pendantCord);
    const shade = new SN.T.Mesh(new SN.T.ConeGeometry(0.3, 0.24, 10), SN.iMat(0x36403f));
    shade.position.set(cp.x, base + 2.3, cp.z);
    g.add(shade);
    const bulb = new SN.T.Mesh(new SN.T.SphereGeometry(0.09, 8, 6), SN.mat(0xffe0b0, { emissive: 0xffc985, emissiveIntensity: 1.25 }));
    bulb.position.set(cp.x, base + 2.2, cp.z);
    g.add(bulb);
    SN.glow(SN.scene, cp.x, base + 2.08, cp.z, 1.05, kind === "karaoke" ? 0xb78cff : 0xffcf96);
    return g;
  };

  SN.buildShopInterior = function buildShopInterior(spec) {
    if (spec.interiorGroup)
      return;
    if (["pc", "chicken", "clothing", "barber", "weapons", "home"].includes(spec.kind))
      SN.buildDestinationInterior(spec);
    else if (spec.kind === "mart")
      SN.buildMartInterior(spec);
    else
      SN.buildSmallInterior(spec);
  };
  // Shop clerks wear an original two-tone apron, a chain cap and a small scanner.
  // The extra meshes join the ordinary instanced rig batches.

  SN.shopDressClerk = function shopDressClerk(a, chain, kind) {
    const fallback = {
      apron: kind === "cafe" ? 0x6c4b30 : kind === "phone" ? 0x244a58 : kind === "pharmacy" ? 0xdfe9df : kind === "stall" ? 0x7c3d27 : 0x37254b,
      shirt: 0xeee6d5,
      cap: kind === "cafe" ? 0x4b3524 : kind === "phone" ? 0x1c3a46 : kind === "pharmacy" ? 0x4c7a60 : kind === "stall" ? 0x5a2b1d : 0x2a1b39,
      accent: 0xd7c9a6
    };
    const vest = chain ? chain.apron : fallback.apron,
      pants = 0x2b343a,
      shirt = chain ? chain.shirt : fallback.shirt,
      cap = chain ? chain.cap : fallback.cap,
      accent = chain ? chain.accent : fallback.accent;
    const armParents = new Set(), legParents = new Set();
    for (const arm of a.rig.arms) {
      armParents.add(arm.upper);
      armParents.add(arm.lower);
    }
    for (const leg of a.rig.legs) {
      legParents.add(leg.upper);
      legParents.add(leg.lower);
      legParents.add(leg.foot);
    }
    for (const p of a.rig.parts) {
      if (p.geoName === "hatCap" && p.mesh.parent === a.rig.head)
        p.mesh.visible = false;
      if (p.matType !== "cloth")
        continue;
      if (legParents.has(p.mesh.parent) || p.mesh.parent === a.rig.root)
        p.colorObject.setHex(pants);
      else if (armParents.has(p.mesh.parent))
        p.colorObject.setHex(shirt);
      else if (p.geoName === "torso" || p.geoName === "sphere" || p.geoName === "capsule")
        p.colorObject.setHex(vest);
      else if (p.geoName === "box")
        p.colorObject.setHex(accent);
      else
        p.colorObject.setHex(shirt);
    }
    const bib = SN.meshAt(SN.box, SN.actorMaterial(vest, 0.9), 0, 0.07, 0.132, 0.34, 0.42, 0.026, 0, a.rig.torso);
    bib.castShadow = true;
    a.rig.parts.push({
      mesh: bib,
      geoName: "box",
      matType: "cloth",
      color: vest,
      colorObject: new SN.T.Color(vest),
      detail: false,
      batchKey: "box|cloth"
    });
    const stripe = SN.meshAt(SN.box, SN.actorMaterial(0xf1ead5, 0.9), 0, 0.235, 0.149, 0.3, 0.045, 0.012, 0, a.rig.torso);
    a.rig.parts.push({
      mesh: stripe,
      geoName: "box",
      matType: "cloth",
      color: 0xf1ead5,
      colorObject: new SN.T.Color(0xf1ead5),
      detail: false,
      batchKey: "box|cloth"
    });
    const badge = SN.meshAt(SN.box, SN.actorMaterial(accent, 0.45), 0.12, 0.13, 0.151, 0.1, 0.055, 0.015, 0, a.rig.torso);
    a.rig.parts.push({
      mesh: badge,
      geoName: "box",
      matType: "metal",
      color: accent,
      colorObject: new SN.T.Color(accent),
      detail: false,
      batchKey: "box|metal"
    });
    const capMesh = SN.meshAt(SN.rigGeo.hatCap, SN.actorMaterial(cap, 0.8), 0, 0, 0, 1, 1, 1, 0, a.rig.head);
    a.rig.parts.push({
      mesh: capMesh,
      geoName: "hatCap",
      matType: "hair",
      color: cap,
      colorObject: new SN.T.Color(cap),
      detail: false,
      batchKey: "hatCap|hair"
    });
    if (a.shopRole === "clerk" && a.shop && a.shop.kind === "mart") {
      const scanner = SN.meshAt(SN.box, SN.actorMaterial(0x35484b, 0.5), 0, -0.01, 0.06, 0.055, 0.11, 0.07, 0, a.rig.arms[1].hand);
      a.rig.parts.push({
        mesh: scanner,
        geoName: "box",
        matType: "metal",
        color: 0x35484b,
        colorObject: new SN.T.Color(0x35484b),
        detail: false,
        batchKey: "box|metal"
      });
      a.scanner = scanner;
    }
  };

  SN.placeShopActor = function placeShopActor(spec, role, x, z, yaw) {
    const index = SN.shopActorStart + SN.shopActorPosts.length;
    if (index >= SN.npcCapacity)
      return null;
    const a = SN.actorAt(index, x, z, "civilian", -1, role === "clerk" ? "vendor" : "tourist");
    Object.assign(a, {
      x,
      z,
      homeX: x,
      homeZ: z,
      yaw,
      kind: "civilian",
      crew: -1,
      active: false,
      down: 0,
      fall: 0,
      inCar: null,
      health: 100,
      hostile: false,
      panic: 0,
      flinch: 0,
      interior: true,
      shop: spec,
      shopId: spec.id,
      shopRole: role,
      shopState: role === "clerk" ? "idle" : "browse",
      shopTimer: SN.rand(1.2, 4.5),
      shopGreetCool: role === "clerk" ? 0 : SN.rand(3, 9),
      shopTarget: 0,
      shopTargetTimer: SN.rand(2, 5),
      shopPanic: 0,
      shopSurrender: 0,
      shopDialogCool: 0,
      shopBaseX: x,
      shopBaseZ: z
    });
    a.shopRoute = spec.kind === "mart" ? [
      SN.shopLocalPoint(spec, 0, 5.1),
      SN.shopLocalPoint(spec, -0.9, 8.7),
      SN.shopLocalPoint(spec, 3.65, 5.6),
      SN.shopLocalPoint(spec, -1.1, 3.25)
    ] : [
      SN.shopLocalPoint(spec, spec.front * 0.16, spec.depth * 0.35),
      SN.shopLocalPoint(spec, -spec.front * 0.24, spec.depth * 0.5),
      SN.shopLocalPoint(spec, 0, spec.depth * 0.24)
    ];
    a.rig.root.position.set(x, spec.base, z);
    a.rig.root.rotation.y = yaw;
    if (role === "clerk") {
      spec.clerk = a;
      SN.shopDressClerk(a, SN.shopChainOf(spec), spec.kind);
    }
    else {
      if (!spec.shoppers)
        spec.shoppers = [];
      spec.shoppers.push(a);
    }
    SN.shopActorPosts.push(a);
    return a;
  };

  SN.shopPoseClerk = function shopPoseClerk(a, dt, time) {
    const r = a.rig, spec = a.shop, b = spec.base;
    a.x = a.shopBaseX;
    a.z = a.shopBaseZ;
    if (a.shopState === "surrender") {
      r.root.position.set(a.x, b, a.z);
      a.yaw = SN.approachAngle(a.yaw, Math.atan2(SN.player.x - a.x, SN.player.z - a.z), dt * 4);
      r.root.rotation.y = a.yaw;
      r.torso.position.set(0, 0.48, 0);
      r.torso.rotation.set(0, 0, 0);
      r.head.rotation.set(-0.08, 0, Math.sin(time * 13) * 0.05);
      for (let i = 0; i < 2; i++) {
        r.arms[i].upper.rotation.set(-2.65, 0, i ? 0.52 : -0.52);
        r.arms[i].lower.rotation.x = -0.32;
      }
      return;
    }
    if (a.shopState === "greet") {
      a.shopTimer -= dt;
      r.root.position.set(a.x, b, a.z);
      a.yaw = SN.approachAngle(a.yaw, Math.atan2(SN.player.x - a.x, SN.player.z - a.z), dt * 4);
      r.root.rotation.y = a.yaw;
      r.torso.position.set(0, 0.48, 0);
      r.torso.rotation.set(0, 0, 0);
      r.head.rotation.set(-0.04, 0, 0);
      r.arms[1].upper.rotation.set(-2.22, 0, -0.5 + Math.sin(time * 7) * 0.14);
      r.arms[1].lower.rotation.x = -0.55;
      r.arms[0].upper.rotation.set(-0.18, 0, 0.08);
      r.arms[0].lower.rotation.x = -0.3;
      if (a.shopTimer <= 0) {
        a.shopState = "idle";
        a.shopTimer = SN.rand(2, 4.5);
      }
      return;
    }
    a.shopTimer -= dt;
    if (a.shopTimer <= 0) {
      const roll = SN.rnd();
      a.shopState = roll < 0.4 ? "scan" : roll < 0.72 ? "arrange" : "idle";
      a.shopTimer = SN.rand(2.2, 4.8);
    }
    const distance = Math.hypot(SN.player.x - a.x, SN.player.z - a.z);
    const faceYaw = distance < 7.2 ? Math.atan2(SN.player.x - a.x, SN.player.z - a.z) : spec.clerkYaw;
    r.root.position.set(a.x, b, a.z);
    r.root.rotation.y = SN.approachAngle(a.yaw, faceYaw, dt * 2.4);
    a.yaw = r.root.rotation.y;
    r.torso.position.set(0, 0.48 + Math.sin(time * 1.3 + a.index) * 0.008, 0);
    r.torso.rotation.set(0.02, 0, 0);
    r.arms[0].upper.rotation.set(-0.08, 0, 0.06);
    r.arms[0].lower.rotation.x = -0.16;
    r.head.rotation.set(0, 0, 0);
    if (distance < 6) {
      let local = SN.angleDelta(a.yaw, Math.atan2(SN.player.x - a.x, SN.player.z - a.z));
      local = SN.clamp(local, -0.75, 0.75);
      r.head.rotation.y = local * 0.8;
    }
    if (a.shopState === "scan") {
      r.head.rotation.x = 0.24;
      r.arms[1].upper.rotation.set(-1.12, 0, -0.22);
      r.arms[1].lower.rotation.x = -1.06;
      if (a.scanner)
        a.scanner.visible = true;
    }
    else if (a.shopState === "arrange") {
      r.torso.rotation.x = 0.13;
      r.head.rotation.x = 0.18;
      r.arms[0].upper.rotation.set(-1.18, 0, 0.12);
      r.arms[1].upper.rotation.set(-1.2, 0, -0.12);
      r.arms[0].lower.rotation.x = -0.5;
      r.arms[1].lower.rotation.x = -0.44;
      if (a.scanner)
        a.scanner.visible = false;
    }
    else {
      r.arms[1].upper.rotation.set(-0.4, 0, -0.1);
      r.arms[1].lower.rotation.x = -0.85;
      r.head.rotation.x = 0.04 + Math.sin(time * 0.55 + a.index) * 0.04;
      if (a.scanner)
        a.scanner.visible = true;
    }
  };

  SN.shopPoseShopper = function shopPoseShopper(a, dt, time) {
    const r = a.rig, b = a.shop.base;
    if (a.shopState === "scared") {
      a.shopTimer -= dt;
      if (a.shopTimer <= 0) {
        a.shopState = "browse";
        a.shopTimer = SN.rand(1.4, 3.2);
      }
      const target = SN.shopLocalPoint(a.shop, 3.9, a.shop.depth * 0.74);
      const dx = target.x - a.x, dz = target.z - a.z, len = Math.hypot(dx, dz);
      if (len > 0.35) {
        const step = Math.min(len, 2.2 * dt), res = SN.resolveCircle(a.x + dx / len * step, a.z + dz / len * step, 0.27);
        if (!res.hit) {
          a.x = res.x;
          a.z = res.z;
        }
        a.yaw = SN.approachAngle(a.yaw, Math.atan2(dx, dz), dt * 7);
      }
      r.root.position.set(a.x, b, a.z);
      r.root.rotation.y = a.yaw;
      SN.advanceGait(r, 0, dt, 0);
      SN.poseRig(r, 0, a.phase, time, false, false, 0, -1);
      r.torso.position.y -= 0.34;
      r.head.rotation.x = 0.2;
      for (let i = 0; i < 2; i++) {
        r.arms[i].upper.rotation.set(-2.5, 0, i ? 0.45 : -0.45);
        r.arms[i].lower.rotation.x = -0.33;
      }
      return;
    }
    if (a.shopState === "reach") {
      a.shopTimer -= dt;
      r.root.position.set(a.x, b, a.z);
      r.root.rotation.y = a.yaw;
      SN.advanceGait(r, 0, dt, 0);
      SN.poseRig(r, 0, a.phase, time, false, false, 0, -1);
      r.arms[1].upper.rotation.set(-2.35 + Math.sin(time * 1.8) * 0.08, 0, -0.35);
      r.arms[1].lower.rotation.x = -0.38;
      r.head.rotation.x = -0.16;
      if (a.shopTimer <= 0) {
        a.shopState = "browse";
        a.shopTimer = SN.rand(0.5, 1.5);
      }
      return;
    }
    a.shopTimer -= dt;
    if (a.shopTimer <= 0 && a.shopState !== "walk") {
      a.shopState = SN.rnd() < 0.3 ? "reach" : "walk";
      a.shopTimer = SN.rnd(2.2, 4.8);
      if (a.shopState === "walk")
        a.shopTarget = (a.shopTarget + 1) % a.shopRoute.length;
    }
    let tx = a.x, tz = a.z, speed = 0;
    if (a.shopState === "walk") {
      const goal = a.shopRoute[a.shopTarget];
      tx = goal.x;
      tz = goal.z;
      if (Math.hypot(tx - a.x, tz - a.z) > 0.55)
        speed = SN.GAITS[0].speed * 0.8;
      else
        a.shopTimer = Math.min(a.shopTimer, 0.2);
    }
    const dx = tx - a.x, dz = tz - a.z, len = Math.hypot(dx, dz);
    if (speed > 0) {
      a.yaw = SN.approachAngle(a.yaw, Math.atan2(dx, dz), dt * 5);
      const step = Math.min(len, speed * dt);
      const res = SN.resolveCircle(a.x + dx / len * step, a.z + dz / len * step, 0.27);
      if (!res.hit) {
        a.x = res.x;
        a.z = res.z;
      }
      else
        a.shopTarget = (a.shopTarget + 1) % a.shopRoute.length;
    }
    r.root.position.set(a.x, b, a.z);
    r.root.rotation.y = a.yaw;
    SN.advanceGait(r, speed * dt, dt, speed > 0 ? 0 : 1);
    a.phase = r.motion.phase;
    SN.poseRig(r, speed, a.phase, time, false, false, 0, -1);
    r.head.rotation.y = Math.sin(time * 0.6 + a.index) * 0.28;
    if (speed === 0 && a.shopState !== "reach")
      r.head.rotation.x = 0.16;
  };

  SN.updateShopActor = function updateShopActor(a, dt, time) {
    a.shopGreetCool = Math.max(0, (a.shopGreetCool || 0) - dt);
    if (a.shopRole === "clerk")
      SN.shopPoseClerk(a, dt, time);
    else
      SN.shopPoseShopper(a, dt, time);
  };
  // Shop streaming, automatic doors, counter focus and the convenience-store robbery.

  SN.startShopRobbery = function startShopRobbery(spec) {
    const clerk = spec.clerk;
    if (!clerk || clerk.down || spec.robbery || spec.robberyCool > 0)
      return;
    spec.robbery = { timer: 3.15, cash: Math.round(SN.rand(150, 240)) };
    spec.robberyCool = 105;
    spec.alarm = 9;
    if (clerk) {
      clerk.shopState = "surrender";
      clerk.shopTimer = 4;
      clerk.shopSurrender = 4;
      clerk.hostile = false;
      SN.speakBubble(clerk, "돈…돈 가져가세요! 别、别开枪！", "scared");
    }
    for (const shopper of (spec.shoppers || [])) {
      shopper.shopState = "scared";
      shopper.shopTimer = 8;
    }
    SN.toast("抢劫便利店 · 店员举起了双手 · 等待现金", 2.6);
  };

  SN.updateShops = function updateShops(dt) {
    let bestCounter = Infinity, bestShop = null, nearestLight = null, lightDistance = Infinity;
    for (const spec of SN.allShopSpecs) {
      const centerDistance = Math.hypot(SN.player.x - spec.x, SN.player.z - spec.z);
      if (!spec.fixturesBuilt && centerDistance < 62 && SN.shopBuildFrame !== SN.renderTime) {
        SN.shopBuildFrame = SN.renderTime;
        SN.buildShopInterior(spec);
      }
      const near = centerDistance < 96;
      if (spec.interiorGroup)
        spec.interiorGroup.visible = near;
      if (spec.shopLights)
        for (const light of spec.shopLights) {
          light.visible = false;
          if (centerDistance < 30 && centerDistance < lightDistance) { nearestLight = light; lightDistance = centerDistance; }
        }
      if (spec.fixturesBuilt) {
        if (spec.clerk)
          spec.clerk.active = near;
        for (const shopper of (spec.shoppers || []))
          shopper.active = near;
      }
      // local coordinates: u across the shopfront, v inward from the threshold
      const dx = SN.player.x - spec.doorPoint.x, dz = SN.player.z - spec.doorPoint.z;
      const u = dx * spec.rightX + dz * spec.rightZ, v = dx * spec.inwardX + dz * spec.inwardZ;
      const inside = !SN.player.car && !SN.player.dead && v > -0.1 && v < spec.depth - 0.05 && u > -spec.front * 0.5 + 0.1 && u < spec.front * 0.5 - 0.1 && SN.player.y < spec.base + spec.h;
      const wasInside = !!spec.lastInside;
      spec.lastInside = inside;
      const doorTargetOpen = !SN.player.car && (inside || (v < 0.1 && v > -3.4 && Math.abs(u) < spec.door.width * 0.5 + 1.25)) ? 1 : 0;
      spec.doorOpen += (doorTargetOpen - spec.doorOpen) * Math.min(1, dt * 5.5);
      if (spec.doorLeaves) {
        const slide = spec.doorLeafBase * (1 + spec.doorOpen * 2.04);
        spec.doorLeaves[0].position.x = -slide;
        spec.doorLeaves[1].position.x = slide;
      }
      if (inside && !wasInside) {
        if (spec.clerk && !spec.clerk.down && spec.clerk.shopGreetCool <= 0) {
          spec.clerk.shopState = "greet";
          spec.clerk.shopTimer = SN.rand(2.2, 3.4);
          spec.clerk.shopGreetCool = 22;
          SN.speakBubble(spec.clerk, "어서오세요！欢迎光临");
        }
      }
      // keep the alarm and cooldown ticking even after the player walks away
      spec.robberyCool = Math.max(0, (spec.robberyCool || 0) - dt);
      if (spec.robbery) {
        spec.robbery.timer -= dt;
        spec.alarm = Math.max(spec.alarm, dt + 0.1);
        if (!spec.clerk || spec.clerk.down) {
          spec.robbery = null;
        }
        else if (spec.robbery.timer <= 0) {
          const dropAt = spec.counterFace || spec.counterSpot;
          SN.spawnDrop(spec.clerk, spec.robbery.cash, dropAt.x, dropAt.z, spec.base + 1.06);
          SN.forceWanted(2, "抢劫便利店 ★2");
          spec.robbery = null;
          spec.alarm = 9;
          if (spec.clerk) {
            spec.clerk.shopState = "idle";
            spec.clerk.shopTimer = SN.rand(2, 4);
          }
          SN.toast("现金散落在柜台上 · 警方已接到报警", 3.2);
        }
      }
      if (spec.alarm > 0) {
        spec.alarm = Math.max(0, spec.alarm - dt);
        if (spec.alarmBeacon) {
          const pulse = 0.35 + Math.abs(Math.sin(SN.simTime * 7.5)) * 0.9;
          spec.alarmBeacon.material.emissiveIntensity = pulse;
        }
        if (spec.alarmLight)
          spec.alarmLight.intensity = spec.alarm > 0 ? 1.1 + Math.sin(SN.simTime * 10) * 0.35 : 0;
      }
      else if (spec.alarmLight && spec.alarmLight.intensity !== 0) {
        spec.alarmLight.intensity = 0;
        if (spec.alarmBeacon)
          spec.alarmBeacon.material.emissiveIntensity = 0.2;
      }
      if (inside && !SN.player.car && !SN.player.dead) {
        const d = Math.hypot(SN.player.x - spec.counterSpot.x, SN.player.z - spec.counterSpot.z);
        if (d < 2.15 && d < bestCounter && !spec.robbery && spec.robberyCool <= 0) {
          bestCounter = d;
          bestShop = spec;
        }
        // aiming a firearm at the clerk is the robbery trigger
        if (spec.kind === "mart" && spec.clerk && !spec.clerk.down && !spec.robbery && spec.robberyCool <= 0 && !SN.holstered && SN.selectedWeapon >= 1 && (SN.aiming || SN.firing)) {
          const cdx = spec.clerk.x - SN.player.x, cdz = spec.clerk.z - SN.player.z, cd = Math.hypot(cdx, cdz);
          if (cd < 8.2 && Math.cos(Math.atan2(cdx, cdz) - SN.camYaw) > 0.72)
            SN.startShopRobbery(spec);
        }
      }
    }
    bestShop = SN.updateStreetServices(bestCounter, bestShop);
    if (!bestShop) SN.counterTarget = null;
    else if (!SN.counterTarget || SN.counterTarget.shop !== bestShop)
      SN.counterTarget = { shop: bestShop, name: bestShop.name, kind: bestShop.kind };
    if (SN.shopMenuOpen && SN.activeShop) {
      if (SN.shopMenuStatusTimer > 0) {
        SN.shopMenuStatusTimer -= dt;
        if (SN.shopMenuStatusTimer <= 0)
          SN.$("shopMenuStatus").textContent = "";
      }
      if (SN.activeShop.robbery) {
        SN.closeShopMenu();
      }
    }
    if (nearestLight && SN.qualityLevel() > 0) nearestLight.visible = true;
  };

  SN.buildStreetServices = function buildStreetServices() {
    SN.streetServices = [];
    const locations = [
      { x: -72, z: -774, kind: "weapons", name: "총포상 · 武器铺", icon: "枪" },
      { x: -88, z: -800, kind: "repair", name: "韩序温 · 维修改色", icon: "修" },
      { x: 560, z: 900, kind: "repair", name: "白以贤 · 改装厂", icon: "修" },
      { x: 861, z: -615, kind: "stall", name: "광장시장 · 街边小吃", icon: "食" }
    ];
    const serviceMetal = SN.mat(0x35566a, { metalness: 0.35, roughness: 0.55 }),
      serviceTrim = SN.mat(0xffc653, { roughness: 0.65 }),
      serviceLight = new SN.T.MeshBasicMaterial({ color: 0x66eced });
    for (const spec of locations) {
      let p;
      if (spec.kind === "repair") {
        let distance = Infinity;
        for (const road of SN.roadSpawnPoints) {
          const d = Math.hypot(road.x - spec.x, road.z - spec.z);
          if (d < distance && !SN.blocked(road.x, road.z, 3)) { p = road; distance = d; }
        }
      }
      else p = SN.safePosition(spec.x, spec.z, 0.7);
      if (!p || p.unsafe) { SN.reportContentProblem(spec.name, spec.x, spec.z, "服务点无法安置", "跳过服务点"); continue; }
      const service = { ...spec, x: p.x, z: p.z, robberyCool: 0 };
      const ring = new SN.T.Mesh(new SN.T.TorusGeometry(spec.kind === "repair" ? 3.2 : 1.1, 0.07, 4, 24), new SN.T.MeshBasicMaterial({ color: spec.kind === "repair" ? 0x46dbe5 : 0xffcd56 }));
      ring.rotation.x = -SN.PI / 2;
      ring.position.set(p.x, SN.surfaceHeight(p.x, p.z) + 0.09, p.z);
      SN.scene.add(ring);
      const tag = SN.nameSprite(service.name, "#fff0b0");
      tag.position.set(p.x, ring.position.y + 2.7, p.z);
      SN.scene.add(tag);
      const fixture = new SN.T.Group();
      SN.scene.add(fixture);
      const y = ring.position.y;
      if (spec.kind === "repair") {
        // Open repair bay: paint and a high sign frame leave room for buses.
        fixture.position.set(p.x, y, p.z);
        fixture.rotation.y = p.yaw || 0;
        for (const side of [-1, 1]) {
          SN.meshAt(SN.box, serviceLight, side * 3.5, 0.015, 0, 0.12, 0.02, 7, 0, fixture);
          SN.meshAt(SN.box, serviceMetal, side * 3.5, 2.4, -3.5, 0.12, 4.8, 0.12, 0, fixture);
        }
        SN.meshAt(SN.box, serviceTrim, 0, 4.8, -3.5, 7.2, 0.2, 0.16, 0, fixture);
        tag.position.y = y + 4.2;
      }
      else if (spec.kind === "weapons") {
        for (let side = 0; side < 4; side++) {
          const angle = side * SN.PI / 2, x = p.x + Math.sin(angle) * 2.1, z = p.z + Math.cos(angle) * 2.1;
          if (SN.blocked(x, z, 1.1)) continue;
          fixture.position.set(x, SN.surfaceHeight(x, z), z);
          fixture.rotation.y = angle;
          SN.meshAt(SN.box, serviceMetal, 0, 0.5, 0, 1.8, 1, 0.65, 0, fixture);
          SN.meshAt(SN.box, serviceTrim, 0, 1.04, 0, 1.95, 0.08, 0.8, 0, fixture);
          const display = SN.buildRifleModel();
          display.rotation.set(SN.PI / 2, 0, SN.PI / 2);
          display.position.set(-0.4, 1.16, 0);
          fixture.add(display);
          SN.addOBB(x, z, 1.8, 0.65, 1.1, angle, fixture.position.y);
          break;
        }
      }
      fixture.traverse(mesh => { mesh.castShadow = false; });
      service.ring = ring; service.tag = tag; service.fixture = fixture;
      SN.streetServices.push(service);
    }
    const supplies = SN.streetServices.find(p => p.kind === "weapons");
    if (supplies) for (const [dx, kind] of [[2, "health"], [-2, "armor"]]) {
      const p = SN.safePosition(supplies.x + dx, supplies.z + 3, 0.4);
      SN.addPickup(p.x, p.z, kind);
    }
  };

  SN.updateStreetServices = function updateStreetServices(bestDistance = Infinity, best = null) {
    for (const s of SN.streetServices) {
      const d = Math.hypot(SN.player.x - s.x, SN.player.z - s.z);
      s.tag.visible = s.ring.visible = s.fixture.visible = d < 110;
      if (!SN.player.dead && d < bestDistance && d < (s.kind === "repair" ? 5.5 : 2.5) && (!SN.player.car || s.kind === "repair")) {
        best = s; bestDistance = d;
      }
    }
    return best;
  };

  SN.shopGoodsFor = function shopGoodsFor(spec) {
    return SN.shopGoods.filter(g => g.kinds.includes(spec.kind));
  };

  SN.shopAmmoWeapon = function shopAmmoWeapon() {
    if (SN.selectedWeapon >= 1 && SN.weapons[SN.selectedWeapon].owned && SN.weapons[SN.selectedWeapon].capacity)
      return SN.weapons[SN.selectedWeapon];
    for (let i = 1; i < SN.weapons.length; i++)
      if (SN.weapons[i].owned && SN.weapons[i].capacity)
        return SN.weapons[i];
    return null;
  };

  SN.shopGoodState = function shopGoodState(good) {
    if (["pc-hour", "sing", "home"].includes(good.id) && (SN.campaign.active || SN.heat > 0)) return { ok: false, reason: "先结束委托与通缉" };
    if (SN.money < good.price)
      return { ok: false, reason: "现金不足" };
    if (good.weapon !== undefined && SN.weapons[good.weapon].owned) return { ok: false, reason: "已拥有" };
    if (good.id === "respray") {
      if (!SN.player.car) return { ok: false, reason: "请驾驶车辆进入光圈" };
      if (SN.player.car.exploded) return { ok: false, reason: "残骸无法修复" };
      if (Math.abs(SN.player.car.speed) > 1) return { ok: false, reason: "请先停车" };
    }
    if (good.id === "drink" || good.id === "snack" || good.id === "aid") {
      if (SN.player.health >= 100)
        return { ok: false, reason: "生命已满" };
    }
    if (good.id === "armor" && SN.player.armor >= 100)
      return { ok: false, reason: "护甲已满" };
    if (good.id === "ammo") {
      const w = SN.shopAmmoWeapon();
      if (!w)
        return { ok: false, reason: "没有可用枪械" };
      if (w.reserve >= 240)
        return { ok: false, reason: "备弹已满" };
    }
    return { ok: true, reason: "" };
  };

  SN.renderShopMenu = function renderShopMenu() {
    const spec = SN.activeShop;
    if (!spec)
      return;
    const chain = SN.shopChainOf(spec),
      accent = chain ? chain.accentCss : spec.kind === "pharmacy" ? "#c8f0d8" : spec.kind === "phone" ? "#cfe6ff" : spec.kind === "karaoke" ? "#d6b4ff" : "#ffd59a";
    SN.$("shopMenu").style.setProperty("--shop-accent", accent);
    SN.setText("shopMenuChain", chain ? ("편의점 · " + chain.brand) : "소상점 · " + spec.name.split(" · ")[0]);
    SN.setText("shopMenuTitle", spec.name + " · 柜台");
    SN.setText("shopMenuTag", spec.kind === "repair" ? "维修车位 · 停稳车辆 · ¥ 350 维修改色" : spec.kind === "weapons" ? "총포상 · 武器与弹药" : spec.kind === "mart" ? "营业中 · 自动门 · 冷柜与热面台正常运转" : spec.kind === "cafe" ? "小馆营业中 · 现煮饮品" : spec.kind === "phone" ? "通信柜台 · 充值与维修" : spec.kind === "pharmacy" ? "药房柜台 · 急救与护具" : spec.kind === "stall" ? "街边小吃 · 热气腾腾" : "练歌房前台 · 营业中");
    SN.setText("shopMenuDescription", spec.kind === "repair" ? "把车停在蓝色光圈内，维修车身并更换车漆。改色后警方将失去车辆线索。" : spec.kind === "weapons" ? "挑一件趁手的武器。弹药盒补充当前选中的枪械，按数字键或点武器图标切换。" : spec.kind === "stall" ? "热食与饮料可以恢复生命。吃饱再回到街头。" : "店员把扫码枪放回台面，等你挑好需要的东西。");
    if (SN.destinationDescriptions[spec.kind]) {
      SN.setText("shopMenuTag", "营业中 · " + spec.name);
      SN.setText("shopMenuDescription", SN.destinationDescriptions[spec.kind]);
    }
    const goods = SN.shopGoodsFor(spec);
    SN.$("shopMenuItems").innerHTML = goods.map(g => {
      const state = SN.shopGoodState(g);
      return "<article class=\"shop-item" + (state.ok ? "" : " no") + "\"><span class=\"shop-icon\">" + g.icon + "</span><div><b>" + g.name + "</b><small>" + g.desc + (state.ok ? "" : " · " + state.reason) + "</small></div><button class=\"shop-buy\" data-good=\"" + g.id + "\"" + (state.ok ? "" : " disabled") + ">¥ " + g.price + "</button></article>";
    }).join("");
    SN.setText("shopMenuMoney", "现金 ¥ " + SN.money.toLocaleString("zh-CN") + " · 电话余额 ¥ " + SN.phoneCredit.toLocaleString("zh-CN"));
  };

  SN.openShopMenu = function openShopMenu() {
    if (!SN.counterTarget || !SN.counterTarget.shop || SN.counterTarget.shop.robbery || SN.counterTarget.shop.robberyCool > 0)
      return;
    SN.activeShop = SN.counterTarget.shop;
    SN.shopMenuOpen = true;
    SN.clearInput();
    SN.firing = SN.aiming = false;
    if (document.pointerLockElement)
      document.exitPointerLock();
    SN.renderShopMenu();
    SN.$("shopMenuStatus").textContent = "";
    SN.$("shopMenu").classList.add("open");
    SN.$("shopMenuClose").focus();
  };

  SN.closeShopMenu = function closeShopMenu() {
    SN.shopMenuOpen = false;
    SN.activeShop = null;
    SN.$("shopMenu").classList.remove("open");
    SN.$("shopMenuStatus").textContent = "";
    SN.shopMenuStatusTimer = 0;
    SN.canvas.focus();
  };

  SN.buyShopGood = function buyShopGood(id) {
    const spec = SN.activeShop;
    if (!spec || !SN.shopMenuOpen)
      return;
    const good = SN.shopGoods.find(g => g.id === id), state = good ? SN.shopGoodState(good) : null;
    if (!good || !good.kinds.includes(spec.kind) || !state.ok) {
      if (good && state)
        SN.$("shopMenuStatus").textContent = state.reason;
      return;
    }
    if (good.id === "home") { SN.closeShopMenu(); SN.openProperty(0); return; }
    SN.money -= good.price;
    let message = good.name + " · 已付款";
    if (good.weapon !== undefined) {
      const w = SN.weapons[good.weapon];
      w.owned = true; w.mag = w.capacity; w.reserve = w.capacity * 3;
      SN.campaign.loadoutLost = false;
      SN.refreshWeaponSlots();
    }
    if (good.id === "respray") {
      SN.repairVehicle(SN.player.car, true);
      SN.heat = 0; SN.wantedResisted = false;
      SN.clearWantedResponse();
      message += " · 车况恢复 · 通缉清除";
    }
    if (good.id === "outfit") { SN.progression.cityOutfit = ((SN.progression.cityOutfit || 0) + 1) % 3; SN.campaign.costume = "street"; SN.applyCostume(); message += " · 已换上新配色"; }
    if (good.id === "hair") { SN.progression.hair = ((SN.progression.hair || 0) + 1) % 3; SN.applyCityLook(); message += " · 发型已更新，便装时可见"; }
    if (good.id === "pc-hour" || good.id === "sing") {
      SN.minutes = (SN.minutes + (good.id === "pc-hour" ? 60 : 30)) % 1440; SN.player.health = 100;
      SN.phoneMapped = true; SN.soundStinger(true); message += " · 休息恢复，城市服务已标记";
    }
    SN.tone("sine", 750, 1000, 0.07, 0.025);
    if (good.heal) {
      const before = SN.player.health;
      SN.player.health = Math.min(100, SN.player.health + good.heal);
      message += " · 生命 +" + Math.round(SN.player.health - before);
    }
    if (good.id === "armor") {
      SN.player.armor = 100;
      message += " · 护甲已补满";
    }
    if (good.id === "ammo") {
      const w = SN.shopAmmoWeapon();
      if (w) {
        w.reserve = Math.min(240, w.reserve + 24);
        message += " · " + w.name + " 备弹 +24";
        SN.refreshWeaponSlots();
      }
    }
    if (good.id === "phone") {
      SN.phoneCredit += 100;
      message += " · 余额 ¥ " + SN.phoneCredit;
      if (!SN.phoneMapped) {
        SN.phoneMapped = true;
        message += " · 商店已标记在地图";
      }
    }
    SN.$("shopMenuStatus").textContent = message;
    SN.shopMenuStatusTimer = 4;
    SN.refreshHUD();
    SN.renderShopMenu();
    SN.saveCampaign();
  };
  // Startup phase 6: keep this order relative to the other systems.

  SN.registerInit(6, function initializeShops6() {
    // Two original convenience-store banners and a handful of independent shopfronts.
    // All names, marks, product lines and interior dressing are invented for this city.
    SN.shopChains = [
      {
        id: "mart24",
        brand: "24·마트",
        brandCn: "二十四便利",
        tag: "하루의 모든 길 · 每一天的街头",
        body: 0x143c39,
        band: 0x2f7a68,
        accent: 0xa9f0c8,
        accentCss: "#a9f0c8",
        cap: 0x1f5d53,
        apron: 0x236356,
        shirt: 0xd9e7dc,
        logo: "medallion"
      },
      {
        id: "hanbit",
        brand: "한빛스토어",
        brandCn: "韩光便利",
        tag: "한 줄기 빛, 한 걸음 가까이 · 一束光，一步近",
        body: 0x3a2a20,
        band: 0xa76a32,
        accent: 0xffd59a,
        accentCss: "#ffd59a",
        cap: 0x6d4526,
        apron: 0x7f512f,
        shirt: 0xf0dfc6,
        logo: "sun"
      }
    ];
    SN.shopSpecs = [
      {
        id: "mart-jongno",
        chain: "mart24",
        kind: "mart",
        district: "종로",
        x: -300,
        z: -775,
        side: "north",
        front: 12,
        depth: 14,
        zone: 30
      },
      {
        id: "mart-myeong",
        chain: "hanbit",
        kind: "mart",
        district: "명동",
        x: 470,
        z: -451,
        side: "south",
        front: 12,
        depth: 14,
        zone: 30
      },
      {
        id: "mart-hongdae",
        chain: "mart24",
        kind: "mart",
        district: "홍대",
        x: -1640,
        z: -449,
        side: "south",
        front: 12,
        depth: 14,
        zone: 30
      },
      {
        id: "mart-gangnam",
        chain: "hanbit",
        kind: "mart",
        district: "강남",
        x: 430,
        z: 1034,
        side: "south",
        front: 12,
        depth: 14,
        zone: 30
      },
      {
        id: "mart-yeouido",
        chain: "mart24",
        kind: "mart",
        district: "여의도",
        x: -1180,
        z: 471,
        side: "north",
        front: 12,
        depth: 14,
        zone: 30
      },
      {
        id: "mart-seongsu",
        chain: "hanbit",
        kind: "mart",
        district: "성수",
        x: 1900,
        z: -449,
        side: "south",
        front: 12,
        depth: 14,
        zone: 30
      },
      {
        id: "mart-jamsil",
        chain: "mart24",
        kind: "mart",
        district: "잠실",
        x: 2431,
        z: 1550,
        side: "east",
        front: 12,
        depth: 14,
        zone: 30
      },
      {
        id: "mart-gimpo",
        chain: "hanbit",
        kind: "mart",
        district: "김포",
        x: -2279,
        z: -950,
        side: "west",
        front: 12,
        depth: 14,
        zone: 30
      },
      {
        id: "mart-itaewon",
        chain: "mart24",
        kind: "mart",
        district: "이태원",
        x: -1180,
        z: -117,
        side: "south",
        front: 12,
        depth: 14,
        zone: 30
      }
    ];
    SN.smallShopSpecs = [
      {
        id: "cafe-golmok",
        kind: "cafe",
        name: "골목다방 · 巷口咖啡",
        x: -650,
        z: -775,
        side: "north",
        front: 8,
        depth: 9,
        zone: 22,
        light: 0xffc487
      },
      {
        id: "phone-bada",
        kind: "phone",
        name: "바다폰 · 海声手机",
        x: 520,
        z: -449,
        side: "south",
        front: 8,
        depth: 10,
        zone: 21,
        light: 0xdfeeff
      },
      {
        id: "pharm-sol",
        kind: "pharmacy",
        name: "솔잎약방 · 松叶药房",
        x: 355,
        z: 1034,
        side: "south",
        front: 9,
        depth: 9,
        zone: 22,
        light: 0xe9fff1
      },
      {
        id: "stall-bunsik",
        kind: "stall",
        name: "별빛분식 · 星光小吃",
        x: -80,
        z: 1037.5,
        side: "south",
        front: 6,
        depth: 6,
        zone: 19,
        light: 0xffca8a
      },
      {
        id: "karaoke-moon",
        kind: "karaoke",
        name: "달빛노래방 · 月光练歌房",
        x: -1540,
        z: -449,
        side: "south",
        front: 9,
        depth: 11,
        zone: 22,
        light: 0xcf9fff
      }
    ];
    SN.smallShopSpecs.push(
      { id: "pc-star", kind: "pc", name: "별밤 PC방 · 星夜网咖", x: -1450, z: -449, side: "south", front: 10, depth: 11, zone: 22 },
      { id: "chicken-shout", kind: "chicken", name: "소리치는 치킨 · 会喊的炸鸡", x: 610, z: -449, side: "south", front: 9, depth: 10, zone: 22 },
      { id: "clothes-tailor", kind: "clothing", name: "압구정 테일러 · 狎鸥亭裁缝", x: 610, z: 1034, side: "south", front: 9, depth: 10, zone: 22 },
      { id: "barber-workshop", kind: "barber", name: "백야 아뜰리에 · 白夜工坊理发间", x: -460, z: -775, side: "north", front: 8, depth: 9, zone: 22 },
      { id: "weapons-backroom", kind: "weapons", name: "만복 철물 · 万福五金后屋", x: -170, z: -775, side: "north", front: 9, depth: 10, zone: 22 },
      { id: "home-workshop", kind: "home", name: "乙支路工房 · 休息室", x: -220, z: -775, side: "north", front: 9, depth: 10, zone: 22 }
    );
    for (const spec of SN.shopSpecs.concat(SN.smallShopSpecs)) {
      spec.fw = spec.front;
      spec.fd = spec.depth;
      const horizontal = spec.side === "north" || spec.side === "south";
      spec.w = horizontal ? spec.front : spec.depth;
      spec.d = horizontal ? spec.depth : spec.front;
      spec.door = { side: spec.side, offset: 0, width: spec.kind === "mart" ? 2.5 : 2.15 };
      spec.h = spec.kind === "mart" ? 4 : 3.55;
      spec.light = spec.light || 0xeaf6ff;
      spec.name = SN.shopDisplayName(spec);
    }
  });
  // Startup phase 17: keep this order relative to the other systems.

  SN.registerInit(17, function initializeShops17() {
    // ============================ Walk-in shops ============================
    // Shop shells are built with the city; fixtures, stock, lights and staff stream
    // in only when the player gets close. Local coordinates run u across the frontage
    // and v inward from the door, so one authored layout serves all four orientations.
    SN.shopSignCache = new Map();
    SN.shopTileCache = new Map();
    SN.productLabelCache = new Map();
    // ---------- Shared interior dressing helpers ----------
    SN.shopProductLabels = [
      { label: "별밤 SNACK", paper: "#efdda5", ink: "#63391f" },
      { label: "담백면 CUP", paper: "#f1dfc4", ink: "#9e3d2c" },
      { label: "고래한모금", paper: "#bee2ee", ink: "#1b4d62" },
      { label: "구름결 TISSUE", paper: "#e4e7ee", ink: "#3d4960" },
      { label: "아침소 MILK", paper: "#f5f1e1", ink: "#2d5948" },
      { label: "하루약 CARE", paper: "#d4e9d0", ink: "#296040" }
    ];
    // Shop shells are part of the street and are built before the population starts.
    SN.allShopSpecs = SN.shopSpecs.concat(SN.smallShopSpecs);
    for (const spec of SN.allShopSpecs)
      SN.buildShopShell(spec);
    // Shop staff and patrons are ordinary pooled actors dropped onto interior floors.
    SN.interiorPosts.push({ slot: 30, x: -49.4, z: -781.4, yaw: SN.PI / 2, kind: "civilian", w: 0.5, d: 0.5 }, { slot: 31, x: -49.5, z: -775.4, yaw: -SN.PI / 2, kind: "civilian", w: 1.2, d: 1.4 }, { slot: 32, x: 31, z: -595.3, yaw: SN.PI, kind: "civilian", w: 0.4, d: 0.4 }, { slot: 33, x: 33.4, z: -602, yaw: 0, kind: "civilian", w: 1, d: 1.2 }, { slot: 50, x: 333.2, z: -754.2, yaw: SN.PI / 2, kind: "police", w: 0.4, d: 0.4 }, { slot: 51, x: 326.2, z: -746.6, yaw: SN.PI, kind: "police", w: 0.8, d: 0.8 }, { slot: 34, x: -663.1, z: -315, yaw: -SN.PI / 2, kind: "civilian", w: 0.4, d: 0.4 }, { slot: 35, x: -655.6, z: -311.2, yaw: SN.PI, kind: "civilian", w: 1, d: 1 }, { slot: 36, x: 302.6, z: 1009, yaw: SN.PI, kind: "civilian", w: 1, d: 1 }, { slot: 37, x: -521, z: 44, yaw: -SN.PI / 2, kind: "civilian", w: 0.8, d: 0.8 });
  });
  // Startup phase 23: keep this order relative to the other systems.

  SN.registerInit(23, function initializeShops23() {
    SN.shopActorPosts = [];
    for (const spec of SN.shopSpecs) {
      SN.placeShopActor(spec, "clerk", spec.clerkSpot.x, spec.clerkSpot.z, spec.clerkYaw);
      for (let i = 0; i < spec.shopperSpots.length; i++) {
        const p = spec.shopperSpots[i];
        SN.placeShopActor(spec, "shopper", p.x, p.z, spec.yaw + SN.rand(-1.2, 1.2));
      }
    }
    for (const spec of SN.smallShopSpecs)
      SN.placeShopActor(spec, "clerk", spec.clerkSpot.x, spec.clerkSpot.z, spec.clerkYaw);
  });
  // Startup phase 26: keep this order relative to the other systems.

  SN.registerInit(26, function initializeShops26() {
    SN.shopMenuOpen = false;
    SN.counterTarget = null;
    SN.activeShop = null;
    SN.phoneCredit = 0;
    SN.phoneMapped = false;
    SN.shopMenuStatusTimer = 0;
  });
  // Startup phase 52: keep this order relative to the other systems.

  SN.registerInit(52, function initializeShops52() {
    // ---------- Counter menu: convenience goods, first aid and phone credit ----------
    SN.shopGoods = [
      {
        id: "drink",
        icon: "🥤",
        name: "冰镇饮料",
        desc: "冷柜取出 · 恢复 25 生命",
        price: 8,
        kinds: ["mart", "cafe", "stall"],
        heal: 25
      },
      {
        id: "snack",
        icon: "🍘",
        name: "海苔米饼",
        desc: "货架零食 · 恢复 10 生命",
        price: 5,
        kinds: ["mart", "cafe", "stall", "karaoke"],
        heal: 10
      },
      {
        id: "aid",
        icon: "✚",
        name: "急救盒",
        desc: "紧急护理 · 恢复 60 生命",
        price: 35,
        kinds: ["mart", "pharmacy"],
        heal: 60
      },
      {
        id: "armor",
        icon: "◈",
        name: "软质护甲",
        desc: "贴身护板 · 护甲补满至 100",
        price: 60,
        kinds: ["mart", "pharmacy"]
      },
      { id: "ammo", icon: "▮", name: "弹药盒", desc: "补充当前枪械 · 备弹 +24", price: 60, kinds: ["mart", "weapons"] },
      {
        id: "phone",
        icon: "☎",
        name: "电话充值",
        desc: "余额 +100 · 首次充值点亮商店地图",
        price: 30,
        kinds: ["mart", "phone", "karaoke"]
      }
    ];
    for (const [weapon, price] of [[1, 380], [2, 1800], [3, 160], [4, 3200], [5, 7200], [6, 5200]])
      SN.shopGoods.push({ id: "weapon" + weapon, icon: "▰", name: SN.weapons[weapon].name, desc: SN.weapons[weapon].capacity ? "含弹匣与三组备弹" : "近战重击", price, kinds: ["weapons"], weapon });
    SN.shopGoods.push({ id: "respray", icon: "🔧", name: "维修与改色", desc: "恢复车况，清除通缉 · 停稳后购买", price: 350, kinds: ["repair"] });
    SN.shopGoods.push(
      { id: "chicken", icon: "食", name: "热炸鸡套餐", desc: "恢复 60 生命", price: 28, kinds: ["chicken"], heal: 60 },
      { id: "pc-hour", icon: "PC", name: "上机一小时", desc: "时间 +1 小时，恢复生命，标记城市服务", price: 25, kinds: ["pc"] },
      { id: "sing", icon: "♫", name: "练唱半小时", desc: "时间 +30 分钟，恢复生命", price: 40, kinds: ["karaoke"] },
      { id: "outfit", icon: "衣", name: "更换街头便装", desc: "蓝黄 / 珊瑚红 / 薄荷绿三种配色轮换", price: 120, kinds: ["clothing"] },
      { id: "hair", icon: "剪", name: "修剪发型", desc: "短发 / 短波波 / 两侧修短轮换", price: 60, kinds: ["barber"] },
      { id: "home", icon: "房", name: "安全屋管理", desc: "购买、休息存档、换装、存取车与收入", price: 0, kinds: ["home"] }
    );
    SN.destinationDescriptions = { pc: "电脑与座椅沿墙排列。上机休息后，手机地图会显示城市服务。", chicken: "热食恢复生命，走到柜台购买。", clothing: "三套便装配色可轮换购买，选择随进度保存。", barber: "三种发型可轮换修剪。穿便装时显示，选择随进度保存。", home: "乙支路工房的休息室，与门口房产共用存档和车库。" };
    const homeRoom = SN.allShopSpecs.find(s => s.kind === "home");
    if (homeRoom) Object.assign(SN.properties[0], homeRoom.outside);
    SN.streetServices = [];
    SN.$("shopMenuClose").addEventListener("click", SN.closeShopMenu);
    SN.$("shopMenuItems").addEventListener("click", event => {
      const button = event.target.closest("button[data-good]");
      if (button && !button.disabled)
        SN.buyShopGood(button.dataset.good);
    });
    SN.$("shopMenu").addEventListener("pointerdown", event => {
      if (event.target === SN.$("shopMenu"))
        SN.closeShopMenu();
    });
  });

  SN.applyCityLook = function applyCityLook() {
    if (!SN.wardrobe || !SN.wardrobe.base.length) return;
    const hair = ["hairUnder", "hairShort", "hairBob"][SN.progression.hair || 0];
    const outfit = SN.progression.cityOutfit || 0, palette = [SN.costumeStyles.street,
      { outer: 0xde6254, inner: 0xffead2, pants: 0x344c69, accent: 0xffdfa6, shoe: 0xe6dbca },
      { outer: 0x4ab79d, inner: 0xe8f2d6, pants: 0xe4d4b0, accent: 0x263f59, shoe: 0x314c64 }][outfit];
    for (const saved of SN.wardrobe.base) {
      const part = saved.part;
      if (["hairUnder", "hairShort", "hairBob"].includes(part.geoName)) { part.mesh.geometry = SN.rigGeo[hair]; }
      if (SN.campaign.costume === "street" && part.matType === "cloth") {
        if (outfit && palette[part.wardrobeTone] !== undefined) part.mesh.material = SN.clothMaterial(palette[part.wardrobeTone]);
        else part.mesh.material = saved.material;
      }
    }
  };

  SN.buildDestinationInterior = function buildDestinationInterior(spec) {
    const g = SN.shopInteriorStart(spec), base = spec.base, wood = [], dark = [], bright = [], metal = [], k = spec.kind;
    const box = (parts, u, v, y, w, h, d) => SN.shopWorldBox(parts, spec, u, v, base + y, w, h, d);
    box(wood, -spec.front * 0.2, spec.depth * 0.7, 0.5, 2.8, 1, 0.85);
    SN.shopSolid(spec, -spec.front * 0.2, spec.depth * 0.7, 2.8, 0.85, 1);
    box(bright, -spec.front * 0.2, spec.depth * 0.7, 1.03, 2.9, 0.06, 0.95);
    if (k === "pc") for (const u of [-3.6, 3.6]) for (const v of [2.4, 4.3]) {
      box(wood, u, v, 0.72, 1.2, 0.12, 1.4); box(dark, u, v, 1.15, 0.8, 0.64, 0.14);
      box(bright, u, v - 0.08, 1.15, 0.67, 0.5, 0.02); box(dark, u * 0.7, v, 0.42, 0.6, 0.65, 0.6);
      SN.shopSolid(spec, u, v, 1.1, 1.4, 1.4);
    }
    if (k === "clothing") for (const v of [2.5, 4.7]) {
      box(metal, 2.8, v, 1.6, 0.08, 2, 1.5);
      for (let i = 0; i < 3; i++) box(i % 2 ? bright : dark, 2.7, v - 0.5 + i * 0.5, 1.5, 0.7, 0.8, 0.22);
      SN.shopSolid(spec, 2.8, v, 0.9, 1.7, 1.9);
    }
    if (k === "barber") for (const v of [2.6, 4.6]) {
      box(metal, 3.3, v, 1.65, 0.08, 1.4, 1.4); box(bright, 3.24, v, 1.65, 0.02, 1.2, 1.2);
      box(dark, 2.4, v, 0.62, 0.7, 0.7, 0.75); box(metal, 2.4, v, 0.22, 0.45, 0.44, 0.45);
      SN.shopSolid(spec, 2.4, v, 0.75, 0.8, 1);
    }
    if (k === "chicken") {
      for (const v of [2.5, 4.8]) { box(wood, 2.6, v, 0.75, 1.4, 0.12, 1.3); box(bright, 2.6, v, 0.88, 0.6, 0.15, 0.5); SN.shopSolid(spec, 2.6, v, 1.4, 1.3, 0.9); }
      box(metal, 1.8, 8, 1.1, 2, 1.4, 1); box(dark, 1.8, 8, 1.85, 2, 0.18, 1);
    }
    if (k === "weapons") {
      box(dark, 2.8, 5, 1.25, 0.25, 2.5, 4);
      for (let i = 0; i < 4; i++) { box(metal, 2.6, 3.7 + i * 0.85, 1.5, 0.15, 0.13, 0.7); box(wood, 2.6, 3.7 + i * 0.85, 1.3, 0.2, 0.38, 0.2); }
      SN.shopSolid(spec, 2.8, 5, 0.65, 4, 2.5);
    }
    if (k === "home") {
      box(wood, 2.4, 6.6, 0.3, 1.7, 0.6, 2.8); box(bright, 2.4, 6.6, 0.65, 1.65, 0.15, 2.7);
      box(dark, 2.4, 5.7, 0.8, 1.45, 0.18, 0.6); SN.shopSolid(spec, 2.4, 6.6, 1.7, 2.8, 0.8);
      box(wood, -3.3, 2.5, 1, 0.6, 2, 2); SN.shopSolid(spec, -3.3, 2.5, 0.6, 2, 2);
    }
    box(bright, 0, spec.depth * 0.4, 3.1, 2.6, 0.06, 0.4);
    SN.shopMesh(wood, 0x927450, null, g, false); SN.shopMesh(dark, 0x2e3f55, null, g, false);
    SN.shopMesh(metal, 0xb3c6cb, { metalness: 0.5, roughness: 0.4 }, g, false);
    SN.shopMesh(bright, k === "pc" ? 0x68cbec : 0xf4c889, { emissive: k === "pc" ? 0x227abb : 0x775533, emissiveIntensity: 0.65 }, g, false);
    SN.shopWallSign(spec, g, spec.name, 0, spec.depth - 0.2, base + 2.4, 5.5, 0.6, "#193544", "#f8d89c");
  };

})(window.SN);
