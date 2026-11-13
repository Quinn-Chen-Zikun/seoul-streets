/* 城西军事禁区：营区建筑、岗哨、坦克、军用直升机与轻型飞机。 */
"use strict";
(function (SN) {
  const X0 = -2528, X1 = -2312, Z0 = -1006, Z1 = -880;
  const CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;
  const HW = (X1 - X0) / 2, HD = (Z1 - Z0) / 2;
  const GATE_Z = -943, GATE_HALF = 10.5;
  // Filled once the terrain exists; the module itself must load before any world init runs.
  let Y = 0;
  const WORLD = (lx, lz) => ({ x: CX + lx, z: CZ + lz });
  // Civilians and street pedestrians must never be placed inside the wire.
  SN.inMilitaryZone = (x, z, r = 0) => x > X0 - r && x < X1 + r && z > Z0 - r && z < Z1 + r;

  SN.military = {
    x0: X0, x1: X1, z0: Z0, z1: Z1, cx: CX, cz: CZ, y: Y,
    inside: false, alarm: 0, tanks: [], aircraft: [], guards: [],
    nearest: null, nearestDistance: Infinity, nextScan: 0,
    rotorClock: 0
  };
  const M = SN.military;

  function solidPart(g, key, x, y, z, w, h, d, yaw = 0, geo = SN.box, rx = 0) {
    SN.cityPart(g, key, x, y, z, w, h, d, yaw, geo, rx);
  }

  function wall(g, x, z, w, d, h = 3.4) {
    solidPart(g, "armyWall", x, h / 2, z, w, h, d);
    solidPart(g, "armyDark", x, h + 0.08, z, w + 0.12, 0.16, d + 0.12);
    SN.citySolid(g, x, z, Math.max(0.5, w), Math.max(0.5, d), h + 0.2);
  }

  function watchtower(g, x, z) {
    const h = 6.4;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        solidPart(g, "armyDark", x + sx * 1.35, h / 2, z + sz * 1.35, 0.34, h, 0.34);
    solidPart(g, "armyWall", x, h + 0.15, z, 4.1, 0.3, 4.1);
    solidPart(g, "armyWall", x, h + 1.35, z, 3.4, 2.3, 3.4);
    solidPart(g, "glass", x, h + 1.55, z + 1.72, 2.9, 0.9, 0.1);
    solidPart(g, "glass", x, h + 1.55, z - 1.72, 2.9, 0.9, 0.1);
    solidPart(g, "glass", x + 1.72, h + 1.55, z, 0.1, 0.9, 2.9);
    solidPart(g, "glass", x - 1.72, h + 1.55, z, 0.1, 0.9, 2.9);
    solidPart(g, "armyDark", x, h + 2.7, z, 4.4, 0.3, 4.4);
    SN.citySolid(g, x, z, 3.6, 3.6, h + 0.4);
    const lamp = SN.glow(SN.scene, x + CX, Y + h + 3.4, z + CZ, 1.6, 0xffe0a8);
    lamp.material.opacity = 0.55;
  }

  function crates(g, x, z, n) {
    for (let i = 0; i < n; i++) {
      const a = i * 2.1, r = 1.4 + (i % 3) * 0.7;
      solidPart(g, i % 2 ? "armyDark" : "armyWall", x + Math.cos(a) * r, 0.5 + (i % 2) * 0.42,
        z + Math.sin(a) * r, 1.1, 1.0, 1.1, a * 0.4);
    }
    SN.citySolid(g, x, z, 3.4, 3.4, 1.2);
  }

  SN.buildTankGeometry = function buildTankGeometry(spec) {
    const L = spec.length, W = spec.width;
    const body = [], glass = [], trim = [], chrome = [], accent = [], head = [], tail = [];
    // Hull and sloped glacis.
    body.push({ g: SN.roundedBox(W * 0.84, 0.86, L * 0.8, 0.16, 2), y: 1.02 });
    body.push({ g: SN.box, y: 1.48, z: L * 0.31, sx: W * 0.7, sy: 0.44, sz: L * 0.18, rx: -0.32 });
    // Turret, mantlet, gun barrel, cupola and hatches.
    body.push({ g: SN.roundedBox(W * 0.58, 0.66, L * 0.34, 0.16, 2), y: 1.72, z: -L * 0.06 });
    body.push({ g: SN.roundedBox(0.5, 0.46, 0.62, 0.1, 2), y: 1.7, z: L * 0.19 });
    body.push({ g: new SN.T.CylinderGeometry(0.105, 0.135, L * 0.38, 10), y: 1.84, z: L * 0.33, rx: SN.PI / 2 });
    body.push({ g: new SN.T.CylinderGeometry(0.32, 0.36, 0.22, 12), x: 0.56, y: 2.12, z: -L * 0.13 });
    body.push({ g: SN.box, x: -0.54, y: 2.1, z: -L * 0.12, sx: 0.62, sy: 0.08, sz: 0.78 });
    // Fenders and stowage.
    for (const side of [-1, 1]) {
      body.push({ g: SN.box, x: side * (W * 0.42), y: 1.3, z: 0, sx: 0.34, sy: 0.12, sz: L * 0.78 });
      accent.push({ g: SN.roundedBox(0.4, 0.44, 1.2, 0.08, 2), x: side * (W * 0.29), y: 1.86, z: -L * 0.24 });
      accent.push({ g: SN.roundedBox(0.36, 0.3, 0.86, 0.06, 2), x: side * (W * 0.24), y: 2.04, z: L * 0.02 });
    }
    // Tracks and road wheels.
    for (const side of [-1, 1]) {
      trim.push({ g: SN.roundedBox(0.62, 1.05, L * 0.94, 0.2, 2), x: side * (W * 0.43), y: 0.6 });
      trim.push({ g: SN.box, x: side * (W * 0.43), y: 1.16, z: 0, sx: 0.68, sy: 0.18, sz: L * 0.9 });
      for (let i = 0; i < 6; i++)
        trim.push({ g: new SN.T.CylinderGeometry(0.4, 0.4, 0.68, 10), x: side * (W * 0.43), y: 0.52, z: -L * 0.36 + i * L * 0.144, rz: SN.PI / 2 });
      for (let i = 0; i < 7; i++)
        trim.push({ g: SN.box, x: side * (W * 0.43), y: 1.13, z: -L * 0.42 + i * L * 0.14, sx: 0.7, sy: 0.09, sz: 0.2 });
    }
    // Vision blocks and optics.
    glass.push({ g: SN.box, x: 0, y: 1.82, z: L * 0.14, sx: 0.62, sy: 0.16, sz: 0.07 });
    glass.push({ g: SN.box, x: 0.52, y: 2.12, z: -L * 0.09, sx: 0.3, sy: 0.16, sz: 0.3 });
    for (const side of [-1, 1])
      glass.push({ g: SN.box, x: side * 0.5, y: 1.82, z: -L * 0.01, sx: 0.08, sy: 0.14, sz: 0.34 });
    // Antenna and tow hooks.
    chrome.push({ g: new SN.T.CylinderGeometry(0.022, 0.03, 1.1, 6), x: -W * 0.2, y: 2.55, z: -L * 0.2 });
    for (const side of [-1, 1])
      head.push({ g: SN.box, x: side * W * 0.32, y: 1.26, z: L * 0.4, sx: 0.24, sy: 0.16, sz: 0.08 });
    for (const side of [-1, 1])
      tail.push({ g: SN.box, x: side * W * 0.32, y: 1.26, z: -L * 0.4, sx: 0.2, sy: 0.14, sz: 0.08 });
    return {
      body: SN.merged(body), glass: SN.merged(glass), trim: SN.merged(trim),
      chrome: SN.merged(chrome), accent: SN.merged(accent),
      head: SN.merged(head), tail: SN.merged(tail)
    };
  };

  // ---------- Aircraft ----------
  function buildMilitaryHelicopter() {
    const root = new SN.T.Group(), body = new SN.T.Group();
    root.add(body);
    const olive = SN.mat(0x4d5a3e, { metalness: 0.32, roughness: 0.56 }),
      oliveDark = SN.mat(0x37412e, { metalness: 0.4, roughness: 0.5 }),
      glass = SN.mat(0x93cbd2, { metalness: 0.25, roughness: 0.1, transparent: true, opacity: 0.62 }),
      dark = SN.mat(0x1c221d, { metalness: 0.62, roughness: 0.35 }),
      tan = SN.mat(0x9a8f62, { metalness: 0.2, roughness: 0.8 });
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
      const m = new SN.T.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      body.add(m);
      return m;
    };
    add(new SN.T.SphereGeometry(1, 16, 12), olive, 0, 0.15, 0, 1.12, 1.0, 2.1);
    add(SN.box, oliveDark, 0, -0.4, 0.1, 1.85, 0.55, 3.0);
    add(new SN.T.SphereGeometry(0.8, 14, 10), glass, 0, 0.18, 1.85, 0.86, 0.72, 1.0);
    add(new SN.T.CylinderGeometry(0.14, 0.3, 3.6, 8), olive, 0, 0.38, -3.0, 1, 1, 1, SN.PI / 2);
    add(SN.box, oliveDark, 0, 1.0, -4.55, 0.1, 1.2, 0.9, 0, 0, 0.16);
    add(SN.box, olive, 0, 0.55, -4.5, 1.7, 0.1, 0.5);
    for (const side of [-1, 1]) {
      add(new SN.T.CylinderGeometry(0.055, 0.055, 2.9, 6), dark, side * 0.95, -0.95, 0.1, 1, 1, 1, SN.PI / 2);
      add(new SN.T.CylinderGeometry(0.045, 0.045, 1.05, 6), dark, side * 0.72, -0.5, 0.35, 1, 1, 1, 0, 0, side * 0.4);
      add(SN.box, tan, side * 1.02, -0.5, 0.35, 0.04, 0.5, 0.12, 0, 0, side * 0.4);
      // Rocket pods: military silhouette without insignia.
      add(new SN.T.CylinderGeometry(0.2, 0.2, 0.95, 10), oliveDark, side * 1.03, -0.18, 0.55, 1, 1, 1, SN.PI / 2);
      for (let i = 0; i < 3; i++)
        add(new SN.T.CylinderGeometry(0.055, 0.055, 0.99, 6), dark, side * (1.03 + (i - 1) * 0.1), -0.18 + (i % 2 ? 0.09 : -0.09), 0.56, 1, 1, 1, SN.PI / 2);
    }
    add(new SN.T.CylinderGeometry(0.09, 0.13, 0.55, 8), dark, 0, 1.2, 0);
    const rotor = new SN.T.Group();
    rotor.position.set(0, 1.48, 0);
    body.add(rotor);
    for (let i = 0; i < 4; i++) {
      const blade = new SN.T.Mesh(SN.box, dark);
      blade.scale.set(0.16, 0.035, 5.2);
      blade.rotation.y = i * SN.PI / 2;
      blade.castShadow = true;
      rotor.add(blade);
    }
    const tailRotor = new SN.T.Group();
    tailRotor.position.set(0.16, 0.92, -4.62);
    body.add(tailRotor);
    for (let i = 0; i < 3; i++) {
      const blade = new SN.T.Mesh(SN.box, dark);
      blade.scale.set(0.03, 1.05, 0.1);
      blade.rotation.z = i * SN.PI / 3;
      tailRotor.add(blade);
    }
    add(SN.box, oliveDark, 0, -1.0, 1.5, 1.4, 0.32, 0.5);
    SN.glow(body, 0, -0.75, 1.95, 1.1, 0xdff2ff);
    root.userData.rotor = rotor;
    root.userData.tailRotor = tailRotor;
    return root;
  }

  function buildLightPlane() {
    const root = new SN.T.Group(), body = new SN.T.Group();
    root.add(body);
    const olive = SN.mat(0x556044, { metalness: 0.3, roughness: 0.58 }),
      cream = SN.mat(0xc9c4ae, { metalness: 0.2, roughness: 0.7 }),
      glass = SN.mat(0x9fd6df, { metalness: 0.25, roughness: 0.08, transparent: true, opacity: 0.6 }),
      dark = SN.mat(0x20251f, { metalness: 0.6, roughness: 0.4 }),
      tan = SN.mat(0x9a8f62, { metalness: 0.2, roughness: 0.8 });
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
      const m = new SN.T.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      body.add(m);
      return m;
    };
    add(new SN.T.CylinderGeometry(0.52, 0.7, 6.4, 12), olive, 0, 0.05, 0, 1, 1, 1, SN.PI / 2);
    add(new SN.T.SphereGeometry(0.52, 12, 9), olive, 0, 0.05, 3.2, 1, 1, 1.1);
    add(new SN.T.SphereGeometry(0.48, 12, 9), glass, 0, 0.52, 1.55, 0.82, 0.72, 1.5);
    add(SN.box, olive, 0, 0.05, -3.4, 4.2, 0.12, 0.9);
    add(SN.box, olive, 0, 0.7, -3.55, 0.1, 1.0, 0.8);
    add(SN.box, olive, 0, 0.0, 0, 11.2, 0.14, 1.7);
    add(SN.box, tan, 0, 0.02, 0, 11.32, 0.03, 1.9);
    for (const side of [-1, 1]) {
      add(SN.box, oliveDarkWing(), side * 4.9, 0.03, 0, 0.16, 0.2, 1.2);
      add(new SN.T.CylinderGeometry(0.035, 0.035, 1.55, 6), dark, side * 1.55, -0.65, 0.4, 1, 1, 1, SN.PI / 2);
      add(new SN.T.CylinderGeometry(0.3, 0.3, 0.18, 10), dark, side * 1.55, -0.72, 0.4, 1, 1, 1, 0, 0, SN.PI / 2);
    }
    add(new SN.T.CylinderGeometry(0.16, 0.16, 0.3, 8), dark, 0, 0.05, 3.72, 1, 1, 1, SN.PI / 2);
    const prop = new SN.T.Group();
    prop.position.set(0, 0.05, 3.88);
    body.add(prop);
    for (let i = 0; i < 2; i++) {
      const blade = new SN.T.Mesh(SN.box, dark);
      blade.scale.set(0.14, 1.9, 0.05);
      blade.rotation.z = i * SN.PI / 2;
      prop.add(blade);
    }
    add(new SN.T.CylinderGeometry(0.035, 0.035, 1.4, 6), dark, 0, -0.75, 1.2, 1, 1, 1, SN.PI / 2);
    add(new SN.T.CylinderGeometry(0.32, 0.32, 0.16, 10), dark, 0, -0.92, 1.9, 1, 1, 1, 0, 0, SN.PI / 2);
    root.userData.prop = prop;
    return root;
  }
  function oliveDarkWing() {
    return SN.mat(0x37412e, { metalness: 0.4, roughness: 0.5 });
  }

  function makeAircraft(kind, x, z, yaw) {
    const root = kind === "heli" ? buildMilitaryHelicopter() : buildLightPlane();
    const ground = SN.surfaceHeight(x, z);
    const rest = kind === "heli" ? 1.05 : 1.25;
    root.position.set(x, ground + rest, z);
    root.rotation.y = yaw;
    SN.scene.add(root);
    const a = {
      kind, root, x, z, yaw, rest,
      y: ground + rest,
      ground, speed: 0, vy: 0, pitch: 0, roll: 0,
      health: 140, occupied: false, airborne: false,
      rotorSpin: 0, propSpin: 0,
      spec: kind === "heli"
        ? { name: "武直 · 军用直升机", width: 2.5, length: 6.5, height: 2.8, topSpeed: 34 }
        : { name: "侦察机 · 轻型飞机", width: 11.2, length: 7.8, height: 2.2, topSpeed: 52 }
    };
    a.solid = SN.addOBB(x, z, kind === "heli" ? 3.2 : 6, kind === "heli" ? 7.2 : 8.4, 3.4, yaw, ground);
    updateAircraftSolid(a);
    M.aircraft.push(a);
    return a;
  }

  function updateAircraftSolid(a) {
    const b = a.solid;
    if (!b) return;
    b.x = a.x;
    b.z = a.z;
    b.hw = a.kind === "heli" ? 3.2 : 6;
    b.hd = a.kind === "heli" ? 4.4 : 5.2;
    b.minY = a.y - 1.2;
    b.height = a.y + 3.2;
    b.minX = a.x - b.hw;
    b.maxX = a.x + b.hw;
    b.minZ = a.z - b.hd;
    b.maxZ = a.z + b.hd;
  }

  function aircraftBlocked(a, x, z, y) {
    if (Math.abs(x) > SN.WORLD - 12 || Math.abs(z) > SN.WORLD - 12) return true;
    for (const b of SN.colliders) {
      if (b.height < y - 0.4 || b.minY > y + 2.4) continue;
      if (x > b.minX - 1.6 && x < b.maxX + 1.6 && z > b.minZ - 1.6 && z < b.maxZ + 1.6) return true;
    }
    return false;
  }

  // ---------- Base construction ----------
  SN.registerInit(21.7, function initializeMilitary21() {
    Y = M.y = SN.surfaceHeight(CX, CZ);
    if (!SN.cityPalette.armyWall) {
      SN.cityPalette.armyWall = SN.pbrMat("stucco", 0x6d7259, { uvScale: 0.5, roughness: 0.92, metalness: 0.06 });
      SN.cityPalette.armyDark = SN.pbrMat("metal", 0x3a4033, { uvScale: 0.6, roughness: 0.78, metalness: 0.3 });
      SN.cityPalette.tarmac = SN.pbrMat("asphalt", 0x646b67, { uvScale: 1 / 7, roughness: 1, metalness: 0.03, envMapIntensity: 0.3 });
      SN.cityPalette.hazard = SN.pbrMat("paint", 0xe3b23c, { uvScale: 0.6, roughness: 0.85 });
      SN.cityPalette.armyTent = SN.pbrMat("fabric", 0x55603f, { uvScale: 0.9, roughness: 1, metalness: 0.02 });
      SN.cityPalette.armySand = SN.pbrMat("stone", 0xb5a67c, { uvScale: 0.7, roughness: 1, metalness: 0.02 });
    }
    const g = SN.cityGroup(CX, CZ, 2200, Y + 0.01);
    g.userData.id = "military-base";

    // Paved compound.
    solidPart(g, "tarmac", 0, 0.015, 0, HW * 2 - 1, 0.05, HD * 2 - 1);
    // Perimeter: north, south, west, and east with a vehicle gate.
    wall(g, 0, -HD, HW * 2, 0.45);
    wall(g, 0, HD, HW * 2, 0.45);
    wall(g, -HW, 0, 0.45, HD * 2);
    const eastLen = HD - GATE_HALF;
    wall(g, HW, -(GATE_HALF + eastLen / 2), 0.45, eastLen);
    wall(g, HW, GATE_HALF + eastLen / 2, 0.45, eastLen);
    for (const sz of [-1, 1]) {
      solidPart(g, "armyWall", HW, 2.2, sz * (GATE_HALF + 0.6), 0.7, 4.4, 1.2);
      SN.citySolid(g, HW, sz * (GATE_HALF + 0.6), 0.7, 1.2, 4.4);
    }
    // Gate sign and barrier arm.
    SN.sign("军事禁区 · 禁止驶入", CX + HW + 0.6, Y + 4.4, CZ, 13, 1.7, Math.PI / 2, false);
    const barrierPivot = new SN.T.Group();
    barrierPivot.position.set(CX + HW - 0.4, Y + 1.35, CZ - GATE_HALF + 0.7);
    SN.scene.add(barrierPivot);
    SN.meshAt(SN.box, SN.cityPalette.hazard, 0, 0, 9.2, 0.16, 0.16, 18, 0, barrierPivot);
    M.barrier = barrierPivot;

    // Barracks, command post, armory and hangar.
    const building = (lx, lz, w, d, h, key, roofKey, yaw = 0) => {
      solidPart(g, key, lx, h / 2, lz, w, h, d, yaw);
      solidPart(g, roofKey, lx, h + 0.22, lz, w + 0.7, 0.44, d + 0.7, yaw);
      solidPart(g, "dark", lx, 1.05, lz + d / 2 + 0.04, w * 0.22, 2.1, 0.14, yaw);
      SN.citySolid(g, lx, lz, w, d, h + 0.4);
    };
    building(-72, -48, 44, 16, 5.6, "armyWall", "armyDark");
    building(-22, -48, 34, 16, 5.0, "armyWall", "armyDark");
    building(26, -48, 28, 16, 6.6, "armyWall", "armyDark");
    building(-96, -6, 18, 24, 5.0, "armyDark", "tarmac");
    // Hangar: three walls and a roof, open toward the runway.
    solidPart(g, "armyWall", 40, 4.5, -9, 44, 9, 0.7);
    solidPart(g, "armyWall", 18, 4.5, 4.5, 0.7, 9, 27);
    solidPart(g, "armyWall", 62, 4.5, 4.5, 0.7, 9, 27);
    solidPart(g, "armyDark", 40, 9.2, 4.5, 45.4, 0.5, 28.4);
    SN.citySolid(g, 40, -9, 44, 0.9, 9);
    SN.citySolid(g, 18, 4.5, 0.9, 27, 9);
    SN.citySolid(g, 62, 4.5, 0.9, 27, 9);
    // Runway and markings.
    solidPart(g, "tarmac", -10, 0.05, 38, 180, 0.06, 18);
    for (let i = 0; i < 14; i++)
      solidPart(g, "white", -92 + i * 12.4, 0.09, 38, 5.4, 0.02, 0.5);
    for (const end of [-1, 1])
      for (let i = 0; i < 6; i++)
        solidPart(g, "white", end * 86, 0.09, 30.8 + i * 2.9, 3.4, 0.02, 0.34);
    // Helipad.
    solidPart(g, "armyDark", 74, 0.06, -38, 27, 0.06, 27, 0, new SN.T.CylinderGeometry(1, 1, 1, 28));
    solidPart(g, "hazard", 74, 0.1, -38, 22, 0.02, 22, 0, new SN.T.RingGeometry(0.86, 1, 32, 1, 0, SN.TAU), -Math.PI / 2);
    solidPart(g, "white", 68.5, 0.1, -38, 1.1, 0.02, 10);
    solidPart(g, "white", 79.5, 0.1, -38, 1.1, 0.02, 10);
    solidPart(g, "white", 74, 0.1, -38, 11, 0.02, 1.1);
    // Tank bays.
    for (const lz of [-16, 6]) {
      solidPart(g, "hazard", -70, 0.09, lz, 12, 0.02, 0.3);
      solidPart(g, "hazard", -70, 0.09, lz + 5.2, 12, 0.02, 0.3);
    }
    // Watchtowers and yard props.
    watchtower(g, -HW + 4, -HD + 4);
    watchtower(g, HW - 6, -HD + 4);
    watchtower(g, -HW + 4, HD - 4);
    watchtower(g, HW - 6, HD - 4);
    crates(g, -52, -30, 5);
    crates(g, 8, -34, 4);
    // Fuel tanks.
    for (let i = 0; i < 3; i++) {
      solidPart(g, "armyDark", -92 + i * 4.2, 2.0, -30, 3.6, 2.4, 7.2, 0, new SN.T.CylinderGeometry(1, 1, 1, 16));
      SN.citySolid(g, -92 + i * 4.2, -30, 3.4, 6.8, 3.4);
    }
    // Yard dressing: painted guide lines, truck bays, canvas tents, sandbag posts,
    // concrete barriers, floodlights and a radar mast so the compound reads as a
    // working base instead of an empty apron.
    const paint = (lx, lz, w, d, color = "white") => solidPart(g, color, lx, 0.062, lz, w, 0.015, d);
    paint(0, -60, HW * 2 - 6, 0.22);
    paint(0, 60, HW * 2 - 6, 0.22);
    paint(-103, 0, 0.22, HD * 2 - 6);
    // Lane from the gate to the hangar, with a stop bar.
    for (const lz of [-3.4, 3.4]) paint(84, lz, 50, 0.22, "hazard");
    paint(97, 0, 0.36, 19);
    for (let i = 0; i < 5; i++) {
      paint(70 + i * 6, -8.6 + i * 0.4, 2.6, 0.2, "hazard");
      paint(70 + i * 6, 8.6 - i * 0.4, 2.6, 0.2, "hazard");
    }
    // Parking bays in front of the barracks.
    for (let i = 0; i < 7; i++) paint(-92 + i * 6.4, -33.5, 0.16, 5.4);
    paint(-74.2, -36.2, 24, 0.16);
    // Sandbag posts: two arcs covering the gate approach.
    const sandbag = (lx, lz) => solidPart(g, "armySand", lx, 0.17, lz, 0.66, 0.3, 0.4);
    for (const side of [-1, 1])
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 5; i++)
          sandbag(93 - i * 0.7, side * (12.6 + row * 0.34) - i * side * 0.28 + (row % 2) * 0.3);
    // Concrete barriers flanking the gate.
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const bx = 89 - i * 2.7, bz = side * (15 + i * 0.3);
        solidPart(g, "stone", bx, 0.55, bz, 2.5, 1.1, 0.62);
        solidPart(g, "hazard", bx, 1.12, bz, 2.5, 0.12, 0.66);
      }
    // Parked canvas trucks.
    const truck = (lx, lz, yaw, cab = 1) => {
      solidPart(g, "armyDark", lx, 1.02, lz, 6.4, 1.5, 2.3, yaw);
      solidPart(g, "armyTent", lx - 0.8 * cab, 1.86, lz, 3.2, 1.24, 2.2, yaw);
      solidPart(g, "armyWall", lx + 2.42 * cab, 1.16, lz, 1.5, 1.8, 2.16, yaw);
      solidPart(g, "glass", lx + 3.18 * cab, 1.62, lz, 0.06, 0.56, 1.7, yaw);
      for (const sx of [-2.2, 1.9])
        for (const sz of [-1.06, 1.06])
          solidPart(g, "dark", lx + sx * cab, 0.42, lz + sz, 0.72, 0.84, 0.36, yaw);
      SN.citySolid(g, lx, lz, 6.4, 2.3, 2.6);
    };
    truck(-40, -34.4, 0);
    truck(-31, -34.4, 0);
    truck(-22, -34.4, 0, -1);
    truck(-70, 23.4, 0);
    // Field tents along the yard edge.
    for (let i = 0; i < 3; i++) {
      const lx = -44 + i * 11, lz = 21;
      solidPart(g, "armyTent", lx, 1.02, lz, 6, 1.62, 5);
      for (const s of [-1, 1])
        solidPart(g, "armyTent", lx, 2.28, lz + s * 1.3, 6.24, 0.16, 2.9, 0, SN.box, s * 0.6);
      solidPart(g, "armyDark", lx, 1.02, lz - 2.52, 0.9, 1.7, 0.08);
      SN.citySolid(g, lx, lz, 6, 5, 2.9);
    }
    // Radar mast on the command post roof.
    solidPart(g, "armyDark", -22, 7.1, -48, 0.28, 4.2, 0.28);
    solidPart(g, "silver", -22, 9.35, -48, 0.46, 0.46, 0.46);
    solidPart(g, "armyWall", -22, 9.72, -48.25, 3, 0.16, 1.5, 0, new SN.T.SphereGeometry(1, 12, 6, 0, SN.TAU, 0, Math.PI / 2), -0.9);
    // Floodlight masts around the yard; warm heads double as night beacons.
    for (const [lx, lz] of [[12, 25], [-62, 25], [99, 26], [-101, -52]]) {
      solidPart(g, "armyDark", lx, 4.6, lz, 0.3, 9.2, 0.3);
      solidPart(g, "armyDark", lx, 9.12, lz, 2.2, 0.18, 0.5);
      for (const s of [-1, 1]) {
        solidPart(g, "white", lx + s * 0.85, 8.94, lz - 0.24, 0.62, 0.42, 0.14);
        SN.glow(SN.scene, CX + lx + s * 0.85, Y + 8.9, CZ + lz - 0.3, 1.15, 0xffe3b0);
      }
    }
    // Striped windsock beside the helipad.
    solidPart(g, "silver", 90, 2.6, -27, 0.12, 5.2, 0.12);
    solidPart(g, "red", 90, 4.85, -25.75, 0.72, 2.4, 0.72, 0, new SN.T.CylinderGeometry(0.3, 0.15, 1, 8), Math.PI / 2);
    solidPart(g, "white", 90, 4.85, -24.35, 0.5, 0.7, 0.5, 0, new SN.T.CylinderGeometry(0.15, 0.05, 1, 8), Math.PI / 2);

    // Flag mast.
    solidPart(g, "silver", 0, 5.5, -22, 0.18, 11, 0.18);
    solidPart(g, "red", 1.9, 9.9, -22, 3.6, 1.8, 0.05);
    SN.cityLabel(g, "城西军事禁区", HD - 2, 20);
    SN.finishCityGroup(g);

    // Two tanks use the regular car system so every existing driving rule applies.
    SN.vehicleSpecs.push({
      name: "K1 · 主战坦克", shape: "tank", length: 7.2, width: 3.4, height: 2.6,
      topSpeed: 15, accel: 5.2, mass: 26, grip: 12.5, damage: 0.16, pitch: 26, cruise: 5, tank: true
    });
    const tankType = SN.vehicleSpecs.length - 1;
    SN.vehicleGeometry.push(SN.buildTankGeometry(SN.vehicleSpecs[tankType]));
    for (const [lx, lz] of [[-70, -16], [-70, 6]]) {
      const p = WORLD(lx, lz);
      const tank = SN.makeCar(p.x, p.z, Math.PI / 2, true, null, 0, tankType, "military");
      tank.paint.color.copy(SN.srgb(0x55603f));
      tank.paintColor = 0x55603f;
      tank.military = true;
      M.tanks.push(tank);
    }

    const heliP = WORLD(74, -38), planeP = WORLD(40, 38);
    makeAircraft("heli", heliP.x, heliP.z, Math.PI / 2);
    makeAircraft("plane", planeP.x, planeP.z, -Math.PI / 2);
  });

  SN.registerInit(22.4, function initializeMilitaryGuards() {
    if (!SN.actors || !SN.actors.length) return;
    const spots = [[HW - 22, GATE_Z + 6], [HW - 22, GATE_Z - 6], [26, -36], [34, 15]];
    for (const [lx, lz] of spots) {
      const p = WORLD(lx, lz);
      const actor = SN.actors.find(a => a.kind === "police" && !a.active && !a.inCar && !a.guard);
      if (!actor) break;
      Object.assign(actor, {
        x: p.x, z: p.z, homeX: p.x, homeZ: p.z, yaw: Math.atan2(X1 - p.x, CZ - p.z),
        active: true, guard: true, footPolice: false, inCar: null, down: 0, fall: 0,
        health: 160, armored: true, armedWeapon: 2, meleeOnly: false,
        hostile: false, panic: 0, cool: 0.9, linger: 0,
        wanderX: 5, wanderZ: 5, pedWindowX: p.x, pedWindowZ: p.z,
        mode: "idle", modeTimer: 999
      });
      actor.rig.root.scale.setScalar(1.05);
      actor.rig.height = 1.05;
      for (const part of actor.rig.parts)
        if (part.matType === "cloth" && (part.geoName === "torso" || part.geoName === "box" || part.geoName === "legs"))
          part.colorObject.setHex(0x4c573b);
      actor.rig.root.position.set(p.x, SN.surfaceHeight(p.x, p.z), p.z);
      actor.rig.root.rotation.y = actor.yaw;
      M.guards.push(actor);
    }
  });

  // ---------- Entry, guarding and alarm ----------
  SN.updateMilitary = function updateMilitary(dt) {
    const m = SN.military, p = SN.player;
    const inside = p.x > X0 && p.x < X1 && p.z > Z0 && p.z < Z1 && p.y < Y + 10;
    if (SN.started && inside && !m.inside && !p.aircraft) {
      m.inside = true;
      if (SN.heat < 5) {
        SN.forceWanted(5, "擅闯军事禁区 ★5");
        SN.toast("警报：擅闯军事禁区 · 通缉 ★5", 4);
      }
      m.alarm = 10;
    }
    if (!inside) m.inside = false;
    m.alarm = Math.max(0, m.alarm - dt);
    // Nearest aircraft wins the F prompt when the player is not in a car.
    m.nextScan -= dt;
    if (!p.car && !p.aircraft && m.nextScan <= 0) {
      m.nextScan = 0.18;
      m.nearest = null;
      m.nearestDistance = Infinity;
      for (const a of m.aircraft) {
        if (a.health <= 0) continue;
        const d = Math.hypot(a.x - p.x, a.z - p.z);
        if (d < m.nearestDistance) { m.nearestDistance = d; m.nearest = a; }
      }
    }
    if (p.car || p.aircraft) { m.nearest = null; m.nearestDistance = Infinity; }
    // Idle rotors and propellers.
    m.rotorClock += dt;
    for (const a of m.aircraft) {
      if (a === p.aircraft) continue;
      const spin = a.kind === "heli" ? 2.2 : 0.6;
      const rotor = a.root.userData.rotor, tailRotor = a.root.userData.tailRotor, prop = a.root.userData.prop;
      if (rotor) rotor.rotation.y += dt * spin;
      if (tailRotor) tailRotor.rotation.x += dt * spin * 1.6;
      if (prop) prop.rotation.z += dt * spin;
      updateAircraftSolid(a);
    }
    // Red alarm beacons over the gate while the alert is live.
    if (m.beaconA) {
      const on = m.alarm > 0 && (Math.floor(m.alarm * 3) % 2 === 0);
      m.beaconA.material.opacity = on ? 0.95 : 0.08;
      m.beaconB.material.opacity = on ? 0.08 : 0.95;
    }
    // Barrier lifts for any approaching vehicle or the player on foot.
    if (m.barrier) {
      const near = Math.hypot(p.x - (X1 + 4), p.z - GATE_Z) < 16 || m.inside;
      m.barrier.rotation.x = SN.lerp(m.barrier.rotation.x, near ? -1.35 : 0, 1 - Math.exp(-dt * 3.2));
    }
  };

  SN.boardAircraft = function boardAircraft(a) {
    if (!a || a.occupied || a.health <= 0) return false;
    SN.player.aircraft = a;
    a.occupied = true;
    a.airborne = a.kind === "plane" ? false : a.y - a.ground > 2;
    SN.player.car = null;
    Object.assign(SN.player, { x: a.x, z: a.z, y: a.y, yaw: a.yaw, speed: 0, vy: 0, grounded: false, vault: null });
    SN.playerRoot.visible = false;
    SN.camYaw = a.yaw;
    SN.camPitch = 0.06;
    SN.lookDelay = 0;
    SN.snapPlayer();
    SN.flying = SN.aiming = false;
    SN.toast(a.kind === "heli"
      ? "直升机启动 · W/S 前后 · A/D 转向 · 空格下降并着陆"
      : "飞机滑跑 · 按住 W 加速离地 · A/D 转向 · 空格下降", 5);
    SN.refreshHUD();
    return true;
  };

  SN.exitAircraft = function exitAircraft() {
    const a = SN.player.aircraft;
    if (!a) return false;
    const ground = SN.surfaceHeight(a.x, a.z);
    if (a.y - ground > 2.4) {
      SN.toast(a.kind === "heli" ? "旋翼仍在空中 · 按住空格降到地面再离开" : "飞机仍在空中 · 按住空格降落再离开", 3);
      return false;
    }
    const off = a.kind === "plane" ? 6.2 : 3.6;
    const px = a.x + Math.cos(a.yaw) * off, pz = a.z - Math.sin(a.yaw) * off;
    const safe = SN.safePosition(px, pz, 0.4);
    SN.player.aircraft = null;
    a.occupied = false;
    a.speed = 0;
    a.airborne = false;
    a.y = ground + a.rest;
    a.pitch = 0;
    a.root.rotation.set(0, a.yaw, 0);
    Object.assign(SN.player, { x: safe.x, z: safe.z, y: SN.surfaceHeight(safe.x, safe.z), vy: 0, grounded: true, yaw: a.yaw });
    SN.playerRoot.visible = true;
    SN.playerRoot.rotation.set(0, a.yaw, 0);
    SN.snapPlayer();
    SN.toast("已离开驾驶座", 2);
    SN.refreshHUD();
    return true;
  };

  SN.updateAircraft = function updateAircraft(dt) {
    const a = SN.player.aircraft, input = SN.driveControls();
    if (!a) return;
    const ground = SN.surfaceHeight(a.x, a.z);
    a.ground = ground;
    a.steer = SN.lerp(a.steer || 0, input.steer, 1 - Math.exp(-dt * 8));
    if (a.kind === "heli") {
      a.root.userData.rotor.rotation.y += dt * 34;
      a.root.userData.tailRotor.rotation.x += dt * 56;
      const accel = input.throttle * 13;
      a.speed += (accel - a.speed * (input.throttle ? 0.28 : 1.35)) * dt;
      a.speed = SN.clamp(a.speed, -9, 34);
      a.yaw -= a.steer * (0.55 + Math.min(1.05, Math.abs(a.speed) / 22)) * dt;
      const targetY = ground + (input.brake ? 0.95 : 15);
      a.y += SN.clamp(targetY - a.y, -6.5 * dt, 4.8 * dt);
      a.pitch = SN.lerp(a.pitch, input.throttle * -0.09, 1 - Math.exp(-dt * 3));
      a.roll = SN.lerp(a.roll, -a.steer * 0.13, 1 - Math.exp(-dt * 4));
    } else {
      if (a.root.userData.prop) a.root.userData.prop.rotation.z += dt * (4 + Math.abs(a.speed) * 1.8);
      if (!a.airborne) {
        a.speed += (input.throttle > 0 ? 9.5 : input.throttle < 0 ? -14 : -3.2) * dt;
        a.speed = SN.clamp(a.speed, 0, 52);
        a.yaw -= a.steer * Math.min(0.7, a.speed / 34) * dt;
        if (a.speed > 22) {
          a.airborne = true;
          a.vy = 2.6;
          SN.toast("已离地 · 空格下降着陆", 3);
        }
      } else {
        a.speed += (input.throttle > 0 ? 7 : input.throttle < 0 ? -9 : -1.2) * dt;
        a.speed = SN.clamp(a.speed, 12, 52);
        a.yaw -= a.steer * 0.62 * dt;
        const cruise = Math.max(a.y, ground + 26);
        a.vy = SN.lerp(a.vy, input.brake ? -7 : a.y < cruise ? 3.4 : 0, 1 - Math.exp(-dt * 2.2));
        a.y += a.vy * dt;
        if (a.y <= ground + a.rest) {
          a.y = ground + a.rest;
          a.airborne = false;
          a.vy = 0;
          a.speed = Math.min(a.speed, 16);
          SN.toast("已着陆 · 停稳后按 F 离开", 3);
        }
      }
      a.pitch = SN.lerp(a.pitch, a.airborne ? SN.clamp(-a.vy * 0.03 + input.throttle * -0.05, -0.24, 0.24) : 0, 1 - Math.exp(-dt * 3));
      a.roll = SN.lerp(a.roll, a.airborne ? -a.steer * 0.2 : 0, 1 - Math.exp(-dt * 3));
    }
    const nx = a.x + Math.sin(a.yaw) * a.speed * dt;
    const nz = a.z + Math.cos(a.yaw) * a.speed * dt;
    if (aircraftBlocked(a, nx, nz, a.y)) {
      a.speed *= -0.18;
      a.health = Math.max(0, a.health - 8);
      SN.camShake = 0.35;
      SN.camShakeTime = 0.3;
      if (SN.simTime > (a.bumpToast || 0)) { a.bumpToast = SN.simTime + 2.5; SN.toast("撞击 · 机体受损", 2); }
    } else {
      a.x = nx;
      a.z = nz;
    }
    if (a.y < ground + a.rest) a.y = ground + a.rest;
    if (!a.airborne && input.brake) a.speed *= Math.exp(-dt * 2.2);
    a.root.position.set(a.x, a.y, a.z);
    a.root.rotation.set(a.pitch, a.yaw, a.roll);
    updateAircraftSolid(a);
    Object.assign(SN.player, { x: a.x, z: a.z, y: a.y, yaw: a.yaw, speed: Math.abs(a.speed), grounded: a.y - ground < 1.4 });
    if (SN.lookDelay <= 0 && !SN.keys.KeyX && !SN.touch.rear)
      SN.camYaw = SN.approachAngle(SN.camYaw, a.yaw, dt * 2.6);
    if (a.health <= 0 && !a.crashed) {
      a.crashed = true;
      SN.toast("机体严重受损 · 立即降落", 4);
    }
  };

  SN.renderAircraft = function renderAircraft(alpha) {
    const p = SN.player, a = p.aircraft;
    if (a) {
      const rx = SN.lerp(SN.playerPrev.x, p.x, alpha), rz = SN.lerp(SN.playerPrev.z, p.z, alpha);
      a.root.position.set(rx, a.y, rz);
      a.root.rotation.set(a.pitch, SN.playerPrev.yaw + SN.angleDelta(SN.playerPrev.yaw, p.yaw) * alpha, a.roll);
    }
    for (const other of M.aircraft) {
      if (other === a) continue;
      other.root.rotation.set(other.pitch, other.yaw, other.roll || 0);
    }
  };

  // Base alarm beacons are attached to the gate once the scene is live.
  SN.registerInit(22.6, function initializeMilitaryBeacons() {
    const x = X1 + 3.4, z = GATE_Z;
    M.beaconA = SN.glow(SN.scene, x, Y + 6.2, z - 1.1, 2.4, 0xff3b30);
    M.beaconB = SN.glow(SN.scene, x, Y + 6.2, z + 1.1, 2.4, 0x3c7bff);
    M.beaconA.material.opacity = 0.08;
    M.beaconB.material.opacity = 0.08;
  });
})(window.SN);
