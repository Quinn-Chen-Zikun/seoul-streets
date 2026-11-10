/* 人物骨架、服装材质、步态与玩家移动。 */
"use strict";
(function (SN) {
  SN.actorMaterial = function actorMaterial(color, rough = 0.8) {
    const key = color + "|" + rough;
    if (!SN.paletteMaterials.has(key))
      SN.paletteMaterials.set(key, SN.mat(color, { roughness: rough }));
    return SN.paletteMaterials.get(key);
  };

  SN.clothMaterial = function clothMaterial(color) {
    if (!SN.clothPartMaterials.has(color)) {
      const m = new SN.T.MeshStandardMaterial({
        color,
        map: SN.fabricSurface.map,
        normalMap: SN.fabricSurface.normalMap,
        roughnessMap: SN.fabricSurface.roughnessMap,
        roughness: 1,
        metalness: 0.02,
        envMapIntensity: 0.3,
        normalScale: new SN.T.Vector2(0.6, 0.6)
      });
      SN.envMats.push({ material: m, base: 0.3 });
      SN.clothPartMaterials.set(color, m);
    }
    return SN.clothPartMaterials.get(color);
  };

  SN.skinMaterial = function skinMaterial(color) {
    if (!SN.skinPartMaterials.has(color)) {
      const m = new SN.T.MeshStandardMaterial({
        color,
        map: SN.skinSurface.map,
        normalMap: SN.skinSurface.normalMap,
        roughnessMap: SN.skinSurface.roughnessMap,
        roughness: 1,
        metalness: 0.02,
        envMapIntensity: 0.35,
        normalScale: new SN.T.Vector2(0.25, 0.25)
      });
      SN.envMats.push({ material: m, base: 0.35 });
      SN.skinPartMaterials.set(color, m);
    }
    return SN.skinPartMaterials.get(color);
  };

  SN.hairMaterial = function hairMaterial(color) {
    if (!SN.hairPartMaterials.has(color)) {
      const m = new SN.T.MeshStandardMaterial({
        color,
        map: SN.hairSurface.map,
        normalMap: SN.hairSurface.normalMap,
        roughnessMap: SN.hairSurface.roughnessMap,
        roughness: 1,
        metalness: 0.06,
        envMapIntensity: 0.4,
        normalScale: new SN.T.Vector2(0.4, 0.4)
      });
      SN.envMats.push({ material: m, base: 0.4 });
      SN.hairPartMaterials.set(color, m);
    }
    return SN.hairPartMaterials.get(color);
  };

  SN.printPartMaterial = function printPartMaterial(color) {
    if (!SN.printPartMaterials.has(color))
      SN.printPartMaterials.set(color, new SN.T.MeshStandardMaterial({ map: SN.printTexture, color, transparent: true, roughness: 0.88, side: SN.T.DoubleSide }));
    return SN.printPartMaterials.get(color);
  };

  SN.makeProfile = function makeProfile(index, kind, crew, archetype = null) {
    const id = archetype || (kind === "civilian" ? SN.pedestrianSlots[index % SN.pedestrianSlots.length] : null),
      def = SN.pedestrianArchetypes[id];
    const pick = values => values[index % values.length],
      men = index % 3 !== 2,
      skin = pick([0xd8ac88, 0xba8564, 0xe4bf9d, 0x966c52, 0xc79270, 0x6f4b39]);
    if (def)
      return {
        archetype: id,
        build: SN.rand(...def.build),
        height: SN.rand(...def.height),
        hair: pick(def.hair),
        outfit: def.outfit,
        skin,
        shirt: pick(def.shirt),
        outer: pick(def.outer),
        pants: pick(def.pants),
        hairColor: id === "elder" ? pick([0xa3a39a, 0xc4beb0, 0x6f716e]) : id === "nightlife" ? pick([0x272330, 0x69516b, 0x553f32]) : pick([0x211c1b, 0x3c2c25, 0x584637]),
        accent: pick(def.accent),
        men,
        shoes: id === "worker" ? "boot" : "shoe",
        cargo: id === "worker" || id === "delivery",
        capColor: pick(def.outer),
        glasses: id === "elder" || index % 6 === 0,
        mask: false,
        backpack: ["student", "tourist"].includes(id),
        chain: id === "nightlife",
        accessory: def.accessory,
        shorts: id === "jogger",
        tie: id === "office" || id === "student"
      };
    const gang = kind === "gang", teal = crew === 0;
    return {
      archetype: gang ? "crew" + crew : "police",
      build: gang ? SN.rand(1, 1.2) : 1.07,
      height: SN.rand(0.98, 1.1),
      hair: gang ? (teal ? pick(["undercut", "bob"]) : pick(["cap", "short"])) : "cap",
      outfit: gang ? (teal ? "jacket" : "hoodie") : "uniform",
      skin,
      shirt: teal ? 0xa9c4bc : 0x9d8677,
      outer: gang ? (teal ? 0x204e51 : 0x6b3835) : 0x2c3f63,
      pants: gang ? (teal ? 0x293541 : 0x393033) : 0x26313f,
      hairColor: 0x211d23,
      accent: gang ? (teal ? 0x62d8bf : 0xe59c6b) : 0x9aaec8,
      men,
      shoes: "boot",
      cargo: !teal,
      capColor: gang ? 0x733d35 : 0x2b3852,
      glasses: gang && teal,
      mask: gang && !teal && index % 2 === 0,
      backpack: false,
      chain: gang,
      accessory: gang ? "crewBand" : null
    };
  };

  SN.makeRig = function makeRig(clothes = 0x517b84, skin = 0xcf9d78, height = 1, profile = null) {
    const p = profile || {
      build: 1,
      hair: "short",
      outfit: "tee",
      skin,
      shirt: clothes,
      outer: 0x3a4650,
      pants: 0x2f3d4a,
      hairColor: 0x241d19,
      accent: 0xc9a15b,
      men: true,
      shoes: "shoe",
      cargo: false,
      capColor: 0x24313c,
      glasses: false,
      mask: false,
      backpack: false,
      chain: false
    };
    const root = new SN.T.Group(), torso = new SN.T.Group(), parts = [], accessories = {};
    root.scale.setScalar(height);
    root.add(torso);
    torso.position.y = SN.TORSO_Y;
    function part(parent, geoName, matType, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, detail = false) {
      const m = new SN.T.Mesh(SN.rigGeo[geoName], matType === "cloth" ? SN.clothMaterial(color) : matType === "skin" ? SN.skinMaterial(color) : matType === "hair" ? SN.hairMaterial(color) : SN.actorMaterial(color, SN.rigMatRough[matType] || 0.8));
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      m.receiveShadow = false;
      parent.add(m);
      const rec = {
        mesh: m,
        geoName,
        matType,
        color,
        colorObject: new SN.T.Color(color),
        detail: !!detail,
        batchKey: geoName + "|" + matType
      };
      parts.push(rec);
      return m;
    }
    function joint(parent, x, y, z) {
      const g = new SN.T.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    }
    const b = p.build || 1, chest = 1.02 * b, shoulderWidth = 0.94 * b;
    // pelvis and belt ride with the torso, so a seated driver folds cleanly
    part(torso, "box", "cloth", p.pants, 0, -0.075, 0, 0.3, 0.17, 0.2, 0, 0, 0);
    part(torso, "box", "cloth", 0x171b20, 0, -0.005, 0, 0.315, 0.035, 0.205, 0, 0, 0);
    if (p.cargo) {
      part(torso, "box", "cloth", p.pants, 0.185, -0.12, 0.01, 0.055, 0.13, 0.09, 0, 0, 0.08, true);
      part(torso, "box", "cloth", p.pants, -0.185, -0.12, 0.01, 0.055, 0.13, 0.09, 0, 0, -0.08, true);
    }
    // neck
    part(torso, "capsule", "skin", p.skin, 0, 0.475, 0, 0.085, 0.09, 0.075);
    // shirt / body base
    part(torso, "torso", "cloth", p.shirt, 0, 0, 0, chest, 1, 0.64);
    if (p.outfit === "jacket") {
      part(torso, "torso", "cloth", p.outer, 0, -0.005, -0.01, chest * 1.045, 1.005, 0.69, 0, 0, 0);
      part(torso, "box", "cloth", p.shirt, 0, 0.2, 0.112, 0.115, 0.36, 0.045, 0, 0, 0);
      part(torso, "box", "cloth", p.outer, 0.135, 0.2, 0.118, 0.155, 0.42, 0.055, 0, -0.08, 0.045);
      part(torso, "box", "cloth", p.outer, -0.135, 0.2, 0.118, 0.155, 0.42, 0.055, 0, 0.08, -0.045);
      part(torso, "box", "cloth", p.outer, 0, 0.2, -0.108, 0.36, 0.43, 0.065);
      part(torso, "box", "cloth", p.outer, 0.105, 0.405, 0.065, 0.095, 0.055, 0.075, 0, -0.18, 0.38);
      part(torso, "box", "cloth", p.outer, -0.105, 0.405, 0.065, 0.095, 0.055, 0.075, 0, 0.18, -0.38);
      part(torso, "box", "cloth", p.outer, 0.16, 0.11, 0.13, 0.06, 0.09, 0.03, 0, 0, 0.2, true);
    }
    else if (p.outfit === "hoodie") {
      part(torso, "torso", "cloth", p.outer, 0, 0, 0, chest * 1.075, 1.01, 0.7);
      part(torso, "sphere", "cloth", p.outer, 0, 0.44, -0.09, 0.135, 0.09, 0.11);
      part(torso, "box", "cloth", p.outer, 0, 0.1, 0.135, 0.16, 0.13, 0.045, 0, 0, 0);
      part(torso, "box", "cloth", p.accent, 0.05, 0.4, 0.06, 0.016, 0.14, 0.016, 0, 0, 0.1, true);
      part(torso, "box", "cloth", p.accent, -0.05, 0.4, 0.06, 0.016, 0.14, 0.016, 0, 0, -0.1, true);
    }
    else {
      const artwork = part(torso, "print", "print", p.accent, 0, 0.19, 0.116, 1, 1, 1, 0, 0, 0, true);
      artwork.material = SN.printPartMaterial(p.accent);
    }
    if (p.outfit === "uniform") {
      part(torso, "torso", "cloth", p.outer, 0, 0, 0, chest * 1.04, 1.005, 0.685);
      part(torso, "box", "cloth", p.outer, 0.105, 0.405, 0.06, 0.095, 0.055, 0.075, 0, -0.18, 0.38);
      part(torso, "box", "cloth", p.outer, -0.105, 0.405, 0.06, 0.095, 0.055, 0.075, 0, 0.18, -0.38);
      part(torso, "box", "cloth", 0x1b2739, 0, 0.17, 0.115, 0.3, 0.3, 0.05, 0, 0, 0);
      part(torso, "box", "metal", p.accent, 0.11, 0.29, 0.145, 0.045, 0.05, 0.012, 0, 0, 0, true);
      part(torso, "box", "cloth", p.accent, 0.16, 0.39, 0.02, 0.075, 0.035, 0.02, 0, 0, -0.18, true);
    }
    if (p.tie) {
      part(torso, "box", "cloth", p.accent, 0, 0.25, 0.153, 0.038, 0.28, 0.025, 0, 0, 0.04);
      part(torso, "box", "cloth", p.shirt, 0, 0.405, 0.13, 0.13, 0.045, 0.03);
    }
    if (p.chain) {
      part(torso, "chain", "metal", 0xd8c88a, 0, 0.4, 0.055, 1, 1, 1, SN.PI / 2, 0, 0, true);
    }
    if (p.backpack) {
      part(torso, "box", "cloth", p.accent, 0, 0.22, -0.18, 0.28, 0.36, 0.15, 0, 0, 0, false);
      part(torso, "box", "cloth", 0x30393a, 0.13, 0.22, 0.07, 0.045, 0.28, 0.02, 0, 0, 0, true);
      part(torso, "box", "cloth", 0x30393a, -0.13, 0.22, 0.07, 0.045, 0.28, 0.02, 0, 0, 0, true);
    }
    // head
    const head = joint(torso, 0, SN.HEAD_JOINT_Y, 0);
    part(head, "head", "skin", p.skin, 0, 0, 0, 1, 1, 1);
    // eyes: whites, iris, pupil, brows
    for (const s of [-1, 1]) {
      part(head, "sphere", "eye", 0xf2ede1, s * 0.048, 0.098, 0.105, 0.032, 0.021, 0.015, 0, 0, 0, true);
      part(head, "sphere", "eye", 0x2b2017, s * 0.048, 0.098, 0.119, 0.014, 0.014, 0.008, 0, 0, 0, true);
      part(head, "sphere", "eye", 0x080705, s * 0.048, 0.098, 0.124, 0.007, 0.007, 0.004, 0, 0, 0, true);
      part(head, "box", "hair", p.hairColor, s * 0.05, 0.132, 0.107, 0.055, 0.014, 0.012, 0, 0, s * 0.09, true);
    }
    part(head, "box", "eye", 0x5a3330, 0, 0.036, 0.096, 0.05, 0.009, 0.008, 0, 0, 0, true);
    if (p.glasses)
      part(head, "glasses", "glass", 0x101820, 0, 0, 0, 1, 1, 1, 0, 0, 0, true);
    if (p.mask)
      part(head, "box", "cloth", 0x1e2428, 0, 0.045, 0.075, 0.17, 0.09, 0.09, 0, 0, 0, true);
    const hairGeoName = p.hair === "undercut" ? "hairUnder" : p.hair === "bob" ? "hairBob" : p.hair === "pony" ? "hairPony" : p.hair === "cap" ? "hatCap" : "hairShort";
    part(head, hairGeoName, "hair", p.hair === "cap" ? p.capColor : (p.hairColor || 0x241d19), 0, 0, 0, 1, 1, 1);
    if (p.hair === "cap")
      part(head, "hairShort", "hair", p.hairColor, 0, 0.13, -0.02, 0.96, 0.96, 0.96);
    const arms = [], legs = [];
    for (const side of [-1, 1]) {
      const mirror = side === 1;
      const shoulder = joint(torso, side * SN.SHOULDER_X * shoulderWidth, SN.SHOULDER_Y, 0),
        elbow = joint(shoulder, 0, -SN.ARM_UPPER, 0),
        hand = joint(elbow, 0, -SN.ARM_LOWER, 0);
      // deltoid
      part(shoulder, "sphere", "cloth", p.outfit === "tee" ? p.shirt : p.outer, 0, 0.01, 0, 0.105, 0.11, 0.105);
      const sleeveLower = p.outfit === "tee";
      part(shoulder, "capsule", "cloth", p.outfit === "tee" ? p.shirt : p.outer, 0, -SN.ARM_UPPER * 0.46, 0, 0.15, 0.29, 0.155);
      part(elbow, "capsule", "skin", p.skin, 0, -SN.ARM_LOWER * 0.46, 0, 0.125, 0.265, 0.125);
      if (!sleeveLower)
        part(elbow, "capsule", "cloth", p.outer, 0, -SN.ARM_LOWER * 0.42, 0, 0.142, 0.25, 0.142);
      if (p.outfit === "uniform")
        part(elbow, "box", "cloth", p.accent, 0, -SN.ARM_LOWER * 0.72, 0, 0.13, 0.03, 0.135, 0, 0, 0, true);
      if (mirror && p.accent && !p.player)
        part(elbow, "box", "metal", 0xc9c2a5, 0, -SN.ARM_LOWER * 0.78, 0.04, 0.05, 0.035, 0.045, 0, 0, 0, true);
      // wrist watch
      if (mirror)
        part(elbow, "box", "metal", 0x2a3136, 0, -SN.ARM_LOWER * 0.88, 0.028, 0.06, 0.018, 0.06, 0, 0, 0, true);
      const handMesh = part(hand, side < 0 ? "handOpen" : "handGrip", "skin", p.skin, 0, 0, 0, 1, 1, 1);
      if (p.player)
        handMesh.material = SN.skinMaterial(p.skin);
      arms.push({ upper: shoulder, lower: elbow, hand });
      // leg
      const hip = joint(root, side * 0.105 * b, SN.HIP_Y, 0),
        knee = joint(hip, 0, -SN.UPPER_LEG, 0),
        foot = joint(knee, 0, -SN.LOWER_LEG, 0.028);
      part(hip, "capsule", "cloth", p.pants, 0, -SN.UPPER_LEG * 0.46, 0, 0.175, 0.45, 0.18);
      part(knee, "sphere", "cloth", p.pants, 0, 0, 0, 0.078, 0.075, 0.08);
      part(knee, "capsule", p.shorts ? "skin" : "cloth", p.shorts ? p.skin : p.pants, 0, -SN.LOWER_LEG * 0.46, 0, 0.148, 0.43, 0.155);
      if (!p.shorts)
        part(knee, "box", "cloth", p.pants, 0, -SN.LOWER_LEG * 0.72, 0.055, 0.11, 0.12, 0.04, 0, 0, 0, true);
      part(foot, p.shoes === "boot" ? "boot" : "shoe", "cloth", p.shoes === "boot" ? 0x2c2c2c : 0x2f3a44, 0, 0, 0, 1, 1, 1);
      // The sole slab bottom is exactly SOLE_DROP below the ankle joint, so an
      // ankle posed at ground height puts rubber on the surface, not through it.
      part(foot, "sole", "cloth", p.shoes === "boot" ? 0x3b3833 : 0xd7d5cb, 0, -(SN.ANKLE_Y - 0.0225), 0, 1, 1, 1);
      legs.push({ upper: hip, lower: knee, foot, planted: false, plantX: 0, plantZ: 0 });
    }
    // Large accessories survive middle-distance LOD; tiny seams disappear first.
    if (p.accessory === "briefcase")
      part(arms[0].hand, "box", "cloth", p.accent, -0.02, -0.21, 0, 0.12, 0.3, 0.4);
    if (p.accessory === "camera") {
      accessories.cameraBody = part(torso, "box", "cloth", 0x303e48, 0, 0.19, 0.17, 0.23, 0.15, 0.1);
      accessories.cameraLens = part(torso, "sphere", "glass", 0x9dc7cf, 0, 0.19, 0.245, 0.058, 0.058, 0.04);
      for (const side of [-1, 1])
        part(torso, "box", "cloth", p.accent, side * 0.1, 0.33, 0.12, 0.02, 0.25, 0.025, 0, 0, side * 0.3);
    }
    if (p.accessory === "cane") {
      part(arms[0].hand, "box", "metal", 0xa18c6a, 0, -0.42, 0.02, 0.027, 0.85, 0.027);
      part(arms[0].hand, "box", "metal", 0x5b5245, 0, -0.015, 0.04, 0.035, 0.04, 0.15);
    }
    if (p.accessory === "deliveryBox") {
      part(torso, "box", "cloth", p.outer, 0, 0.25, -0.29, 0.47, 0.49, 0.37);
      part(torso, "box", "cloth", p.accent, 0, 0.25, -0.481, 0.35, 0.11, 0.015);
      part(head, "sphere", "cloth", p.outer, 0, 0.15, -0.025, 0.145, 0.15, 0.14);
      part(head, "box", "glass", 0x9bb9bb, 0, 0.1, 0.123, 0.23, 0.075, 0.025);
    }
    if (p.accessory === "hardhat") {
      part(head, "sphere", "cloth", p.outer, 0, 0.21, -0.01, 0.15, 0.1, 0.15);
      part(head, "box", "cloth", p.outer, 0, 0.17, 0.02, 0.32, 0.035, 0.31);
      for (const side of [-1, 1])
        part(torso, "box", "cloth", p.accent, side * 0.145, 0.26, 0.153, 0.055, 0.35, 0.02);
      part(torso, "box", "cloth", p.accent, 0, 0.1, 0.16, 0.38, 0.06, 0.02);
    }
    if (p.accessory === "apron") {
      part(torso, "box", "cloth", p.outer, 0, 0, 0.14, 0.34, 0.66, 0.045);
      part(torso, "box", "cloth", p.accent, 0, 0.05, 0.17, 0.19, 0.1, 0.025);
    }
    if (p.accessory === "scarf") {
      part(torso, "box", "cloth", p.accent, 0, 0.45, 0.04, 0.27, 0.085, 0.17);
      part(torso, "box", "cloth", p.accent, 0.08, 0.32, 0.145, 0.085, 0.24, 0.025);
    }
    if (p.accessory === "headphones") {
      for (const side of [-1, 1])
        part(head, "box", "cloth", p.accent, side * 0.135, 0.12, -0.01, 0.05, 0.075, 0.075);
      part(torso, "box", "cloth", p.accent, 0.2, 0.31, 0.05, 0.035, 0.1, 0.09);
    }
    if (p.accessory === "earrings")
      for (const side of [-1, 1])
        part(head, "chain", "metal", p.accent, side * 0.123, 0.018, 0, 0.3, 0.45, 0.3, 0, 0, 0, true);
    if (p.accessory === "crewBand") {
      part(arms[0].upper, "box", "cloth", p.accent, 0, -0.12, 0.082, 0.18, 0.075, 0.025);
      part(torso, "box", "cloth", p.accent, 0.13, 0.25, 0.15, 0.04, 0.18, 0.02, 0, 0, p.archetype === "crew0" ? 0.4 : -0.4);
    }
    const weapon = joint(arms[1].hand, 0, -0.075, 0);
    part(weapon, "box", "metal", 0x3b4a52, 0, -0.08, 0.02, 0.055, 0.19, 0.07).visible = true;
    const barrel = part(weapon, "box", "metal", 0x6a8791, 0, -0.18, 0.02, 0.085, 0.14, 0.11);
    root.scale.setScalar(height);
    return {
      root,
      torso,
      head,
      arms,
      legs,
      parts,
      accessories,
      weapon,
      barrel,
      height,
      profile: p,
      motion: { gait: 0, phase: 0, speed: 0, weight: 0, lean: 0, grounded: true }
    };
  };

  SN.gaitValue = function gaitValue(g, key) {
    const lo = Math.min(1, Math.floor(g));
    return SN.lerp(SN.GAITS[lo][key], SN.GAITS[lo + 1][key], g - lo);
  };

  SN.advanceGait = function advanceGait(r, distance, dt, gait, grounded = true) {
    const m = r.motion, blend = 1 - Math.exp(-dt * 9), speed = dt > 0 ? distance / dt : 0;
    m.gait = SN.lerp(m.gait, gait, blend);
    m.weight = SN.lerp(m.weight, speed > 0.04 ? 1 : 0, blend);
    m.lean = SN.lerp(m.lean, SN.clamp((speed - m.speed) / Math.max(dt, 0.001) * 0.012, -0.13, 0.18), blend);
    m.speed = speed;
    m.grounded = grounded;
    if (grounded)
      m.phase = (m.phase + distance / SN.gaitValue(m.gait, "cycle") * SN.TAU) % SN.TAU;
  };
  // Foot targets are read from the same height grid the player stands on, so a
  // planted sole follows kerbs, slopes and bridge decks instead of a flat plane.

  SN.poseRig = function poseRig(r, speed, phase, time, jumping = false, aim = false, attack = 0, weapon = -1, fall = 0) {
    const m = r.motion,
      g = m.gait,
      w = m.weight,
      run = SN.clamp(g - 1, 0, 1),
      jog = Math.min(g, 1),
      wave = Math.sin(m.phase),
      bob = (1 - Math.cos(m.phase * 2)) * 0.5 * w * (0.014 + jog * 0.012 + run * 0.022),
      breath = Math.sin(time * 2.1) * 0.008;
    const rootY = r.root.position.y, h = r.height, yaw = r.root.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
    r.head.rotation.set(Math.sin(time * 0.73) * 0.035 * (1 - w), Math.sin(time * 0.49) * 0.23 * (1 - w), 0);
    r.torso.position.set(Math.sin(time * 0.8) * 0.012 * (1 - w), SN.TORSO_Y - jog * 0.03 - run * 0.055 + bob + breath, 0);
    r.torso.rotation.set((aim ? 0.045 : jog * 0.06 + run * 0.2) * w + m.lean, -wave * w * (0.045 + jog * 0.055 + run * 0.04), Math.sin(time * 0.8) * 0.018 * (1 - w));
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? 1 : -1,
        leg = r.legs[i],
        arm = r.arms[i],
        q = (m.phase / SN.TAU + i * 0.5) % 1,
        duty = SN.gaitValue(g, "stance"),
        cycle = SN.gaitValue(g, "cycle"),
        reach = cycle * duty * 0.5;
      let footZ, footY = SN.ANKLE_Y, slope = 0;
      const stance = q < duty && !jumping && w > 0.08;
      if (stance) {
        if (!leg.planted) {
          const forward = reach * (1 - 2 * q / duty) * h, side = sign * -0.105 * h;
          leg.plantX = r.root.position.x + Math.sin(yaw) * forward + Math.cos(yaw) * side;
          leg.plantZ = r.root.position.z + Math.cos(yaw) * forward - Math.sin(yaw) * side;
        }
        const dx = leg.plantX - r.root.position.x, dz = leg.plantZ - r.root.position.z;
        footZ = (dx * fx + dz * fz) / h;
        const lateral = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / h + sign * 0.105;
        leg.upper.rotation.z = SN.clamp(lateral / 0.72, -0.22, 0.22);
        // Highest surface under the sole disc, plus a toe/heel slope sample. The
        // pivot is shortened by SOLE_DROP*(1-cos) so a level sole rotated onto the
        // slope still rests on it instead of hovering over the downhill edge.
        const soleGround = SN.groundUnder(leg.plantX, leg.plantZ, 0.115);
        const hToe = SN.groundUnder(leg.plantX + fx * 0.155, leg.plantZ + fz * 0.155, 0.05),
          hHeel = SN.groundUnder(leg.plantX - fx * 0.155, leg.plantZ - fz * 0.155, 0.05);
        slope = SN.clamp(Math.atan2(hToe - hHeel, 0.31), -0.62, 0.62);
        footY = SN.ANKLE_Y + (soleGround - rootY) / h - (SN.SOLE_DROP * (1 - Math.cos(slope))) / h;
      }
      else {
        const t = SN.clamp((q - duty) / (1 - duty), 0, 1), smooth = t * t * (3 - 2 * t);
        footZ = SN.lerp(-reach, reach, smooth);
        const lift = (0.07 + jog * 0.105 + run * 0.15) * w;
        const sx = r.root.position.x + fx * footZ, sz = r.root.position.z + fz * footZ;
        const swingGround = SN.groundUnder(sx, sz, 0.09);
        footY = Math.max(SN.ANKLE_Y + (swingGround - rootY) / h, SN.ANKLE_Y - 0.24) + Math.sin(t * SN.PI) * lift;
        leg.upper.rotation.z = 0;
        const hToe = SN.groundUnder(sx + fx * 0.155, sz + fz * 0.155, 0.05),
          hHeel = SN.groundUnder(sx - fx * 0.155, sz - fz * 0.155, 0.05);
        slope = SN.clamp(Math.atan2(hToe - hHeel, 0.31), -0.62, 0.62);
      }
      leg.planted = stance;
      footZ *= w;
      const baseHip = SN.HIP_Y - jog * 0.045 - run * 0.075 + bob * 0.7;
      // Lower the hip when the ground falls away, so the ankle can always reach it.
      const hipY = Math.max(0.16, Math.min(baseHip, footY + (SN.UPPER_LEG + SN.LOWER_LEG) * 0.998));
      leg.upper.position.y = hipY;
      const vertical = Math.max(0.18, hipY - footY),
        distance = SN.clamp(Math.hypot(footZ, vertical), 0.03, (SN.UPPER_LEG + SN.LOWER_LEG) * 0.998);
      const knee = SN.PI - Math.acos(SN.clamp((SN.UPPER_LEG * SN.UPPER_LEG + SN.LOWER_LEG * SN.LOWER_LEG - distance * distance) / (2 * SN.UPPER_LEG * SN.LOWER_LEG), -1, 1)),
        hip = -Math.atan2(footZ, vertical) - Math.acos(SN.clamp((SN.UPPER_LEG * SN.UPPER_LEG + distance * distance - SN.LOWER_LEG * SN.LOWER_LEG) / (2 * SN.UPPER_LEG * distance), -1, 1));
      leg.upper.rotation.x = hip;
      leg.lower.rotation.x = knee;
      arm.upper.rotation.set(wave * sign * w * (0.2 + jog * 0.33 + run * 0.34), 0, sign * (0.05 + run * 0.075));
      arm.lower.rotation.set(-0.12 - jog * 0.68 - run * 0.34 - Math.max(0, wave * sign) * w * 0.18, 0, 0);
      if (jumping) {
        leg.planted = false;
        leg.upper.rotation.x = i === 0 ? -0.62 : 0.14;
        leg.lower.rotation.x = 0.82;
        arm.upper.rotation.x = -0.58;
        arm.lower.rotation.x = -0.5;
        footY = SN.ANKLE_Y + 0.06;
        leg.upper.position.y = SN.HIP_Y;
      }
      leg.foot.rotation.x = -(leg.upper.rotation.x + leg.lower.rotation.x) - slope;
    }
    if (aim) {
      if (weapon === 2) {
        r.arms[1].upper.rotation.set(-1.3, -0.1, -0.15);
        r.arms[1].lower.rotation.x = -0.38;
        r.arms[0].upper.rotation.set(-1.2, 0.2, 0.55);
        r.arms[0].lower.rotation.x = -0.95;
        r.arms[0].lower.rotation.z = -0.2;
        r.torso.rotation.y += 0.1;
      }
      else {
        r.arms[1].upper.rotation.set(-1.3 + SN.armRecoil * 2.4, 0, -0.16);
        r.arms[1].lower.rotation.x = -0.3 - SN.armRecoil * 1.5;
        r.arms[0].upper.rotation.set(-1.16, 0, -0.34);
        r.arms[0].lower.rotation.x = -0.6;
      }
      r.arms[1].hand.rotation.set(0, 0, 0);
    }
    if (attack > 0 && weapon === 0) {
      const swing = Math.sin(attack * SN.PI);
      r.arms[1].upper.rotation.set(-1.72 + swing * 2.9, 0, -0.08 - swing * 0.24);
      r.arms[1].lower.rotation.x = -0.5 + swing * 0.35;
      r.torso.rotation.y -= swing * 0.28;
      r.torso.rotation.x += swing * 0.1;
    }
    if (weapon === 2 && !aim && attack <= 0) {
      r.arms[0].upper.rotation.set(-0.58 + Math.sin(m.phase) * w * 0.1, 0.08, 0.42);
      r.arms[0].lower.rotation.x = -0.52;
    }
    r.weapon.visible = weapon >= 0 && !(r === SN.playerRig && weapon === 0 && SN.weapons[0].fists);
    r.barrel.scale.set(weapon === 0 ? 0.45 : 1, weapon === 2 ? 3.7 : weapon === 0 ? 5 : 1, weapon === 0 ? 0.45 : 1);
    if (r !== SN.playerRig)
      r.barrel.position.y = weapon === 2 ? -0.28 : weapon === 0 ? -0.3 : -0.18;
    if (r === SN.playerRig)
      SN.updateWeaponVisuals();
    r.root.rotation.z = -fall * 1.46;
  };

  SN.poseDriver = function poseDriver(a, c) {
    const r = a.rig;
    r.motion.weight = 0;
    r.weapon.visible = false;
    r.root.rotation.z = 0;
    r.head.rotation.set(0, Math.sin(SN.simTime * 0.6 + a.index) * 0.07, 0);
    r.torso.position.set(0, 0.48, 0);
    r.torso.rotation.set(0.06, c.steer * 0.08, 0);
    for (let i = 0; i < 2; i++) {
      const leg = r.legs[i], arm = r.arms[i];
      leg.planted = false;
      leg.upper.position.y = 0.45;
      leg.upper.rotation.set(-1.18, 0, i ? -0.05 : 0.05);
      leg.lower.rotation.x = 1.34;
      leg.foot.rotation.x = -0.16;
      arm.upper.rotation.set(-0.98, 0, i ? -0.08 : 0.08);
      arm.lower.rotation.x = -0.66;
    }
    if (c.spec.bike) {
      SN.poseRider(r, c, SN.simTime, a.index);
      return;
    }
    const side = -c.spec.width * 0.23,
      forward = c.spec.shape === "bus" ? c.spec.length * 0.33 : c.spec.shape === "van" ? c.spec.length * 0.3 : 0.05;
    r.root.position.set(c.root.position.x + Math.cos(c.root.rotation.y) * side + Math.sin(c.root.rotation.y) * forward, c.root.position.y + 0.14, c.root.position.z - Math.sin(c.root.rotation.y) * side + Math.cos(c.root.rotation.y) * forward);
    r.root.rotation.order = "YXZ";
    r.root.rotation.set(c.pitch, c.root.rotation.y, c.terrainRoll + c.roll);
  };

  SN.flushActors = function flushActors() {
    for (const batch of SN.npcBatches)
      batch.count = 0;
    for (const a of SN.actors) {
      if (!a.active)
        continue;
      const actorDistance = Math.hypot(a.x - SN.player.x, a.z - SN.player.z);
      if (actorDistance > 150)
        continue;
      const r = a.rig;
      if (a.inCar) {
        if (!a.inCar.active || !a.inCar.root.visible)
          continue;
        SN.poseDriver(a, a.inCar);
      }
      else if (!a.bail) {
        r.root.position.set(a.x, SN.groundUnder(a.x, a.z, 0.2), a.z);
        r.root.rotation.y = a.yaw;
      }
      if (a.poseDirty || a.inCar || !a.matrixReady) {
        r.root.updateMatrixWorld(true);
        a.poseDirty = false;
        a.matrixReady = true;
      }
      const detailed = actorDistance <= 30;
      for (const p of r.parts) {
        if (!p.mesh.visible)
          continue;
        if (p.detail && !detailed)
          continue;
        if (actorDistance > 78 && (p.geoName === "sphere" || p.geoName === "sole" || p.geoName === "handOpen" || p.geoName === "handGrip" || p.geoName === "chain" || p.geoName === "glasses"))
          continue;
        if (p.mesh.parent === r.weapon && !r.weapon.visible)
          continue;
        const batch = SN.npcBatchMap.get(p.batchKey);
        if (!batch || batch.count >= batch.capacity)
          continue;
        const i = batch.count++;
        batch.mesh.setMatrixAt(i, p.mesh.matrixWorld);
        batch.mesh.setColorAt(i, p.colorObject);
      }
    }
    for (const b of SN.npcBatches) {
      b.mesh.count = b.count;
      if (!b.count)
        continue;
      b.mesh.instanceMatrix.updateRange.offset = 0;
      b.mesh.instanceMatrix.updateRange.count = b.count * 16;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) {
        b.mesh.instanceColor.updateRange.offset = 0;
        b.mesh.instanceColor.updateRange.count = b.count * 3;
        b.mesh.instanceColor.needsUpdate = true;
      }
    }
  };

  SN.playerMotion = function playerMotion(dt) {
    if (SN.updateBailout(SN.player, SN.playerRig, dt, true))
      return;
    let f = (SN.keys.KeyW || SN.keys.ArrowUp ? 1 : 0) - (SN.keys.KeyS || SN.keys.ArrowDown ? 1 : 0) + SN.touch.y,
      s = (SN.keys.KeyD || SN.keys.ArrowRight ? 1 : 0) - (SN.keys.KeyA || SN.keys.ArrowLeft ? 1 : 0) + SN.touch.x;
    const len = Math.hypot(f, s), moving = len > 0.12;
    if (len > 1) {
      f /= len;
      s /= len;
    }
    const aim = SN.aiming && !SN.holstered,
      analog = SN.joy.id !== -1 || Math.hypot(SN.touch.x, SN.touch.y) > 0.01,
      wantsSprint = !!(SN.keys.ShiftLeft || SN.keys.ShiftRight || SN.touch.sprint),
      sprinting = moving && !aim && wantsSprint;
    SN.player.gait = sprinting ? 2 : aim || SN.player.walkMode || analog && len < 0.55 ? 0 : 1;
    const targetSpeed = moving ? SN.GAITS[SN.player.gait].speed : 0;
    SN.player.motionSpeed = SN.lerp(SN.player.motionSpeed, targetSpeed, 1 - Math.exp(-dt * (moving ? 26 : 30)));
    if (SN.player.motionSpeed < 0.015)
      SN.player.motionSpeed = 0;
    const oldX = SN.player.x, oldZ = SN.player.z, wasGrounded = SN.player.grounded;
    if (moving) {
      const dx = Math.sin(SN.camYaw) * f - Math.cos(SN.camYaw) * s,
        dz = Math.cos(SN.camYaw) * f + Math.sin(SN.camYaw) * s,
        magnitude = Math.hypot(dx, dz);
      if (magnitude > 0.000001) {
        SN.player.moveX = dx / magnitude;
        SN.player.moveZ = dz / magnitude;
      }
      SN.player.yaw = SN.approachAngle(SN.player.yaw, aim ? SN.camYaw : Math.atan2(dx, dz), dt * 24);
    }
    else if (aim || SN.firing)
      SN.player.yaw = SN.approachAngle(SN.player.yaw, SN.camYaw, dt * 26);
    // Sub-step and resolve penetration so the body slides around walls instead of stopping dead.
    const vx = SN.player.moveX * SN.player.motionSpeed * dt, vz = SN.player.moveZ * SN.player.motionSpeed * dt;
    const stepLength = Math.hypot(vx, vz);
    if (stepLength > 0.000001) {
      const substeps = Math.min(5, Math.max(1, Math.ceil(stepLength / 0.32))), sx = vx / substeps, sz = vz / substeps;
      for (let i = 0; i < substeps; i++) {
        const nx = SN.player.x + sx, nz = SN.player.z + sz;
        if (Math.abs(nx) > SN.WORLD - 0.3 || Math.abs(nz) > SN.WORLD - 0.3 || SN.isWater(nx, nz, 0.28))
          break;
        const hit = SN.resolveCircle(nx, nz, 0.28);
        SN.player.x = hit.x;
        SN.player.z = hit.z;
        if (hit.hit && Math.abs(hit.nx * sx + hit.nz * sz) > stepLength * 0.7)
          break;
      }
    }
    // Every car is a solid oriented box on foot; stand on the near side and it pushes you clear.
    for (const c of SN.cars) {
      if (!c.active || !c.root.visible)
        continue;
      if (SN.carCirclePush(SN.player.x, SN.player.z, 0.34, c)) {
        const push = SN.circlePush, px0 = SN.player.x, pz0 = SN.player.z;
        let nx = SN.player.x + push.nx * (push.depth + 0.01), nz = SN.player.z + push.nz * (push.depth + 0.01);
        const fixed = SN.resolveCircle(nx, nz, 0.28);
        nx = fixed.x;
        nz = fixed.z;
        if (!SN.isWater(nx, nz, 0.26) && Math.abs(nx) < SN.WORLD - 0.3 && Math.abs(nz) < SN.WORLD - 0.3) {
          SN.player.x = nx;
          SN.player.z = nz;
        }
        else {
          SN.player.x = px0;
          SN.player.z = pz0;
        }
        if (Math.abs(c.speed) > 4 && SN.simTime - SN.player.lastHurt > 0.7)
          SN.hurtPlayer(Math.abs(c.speed) * 1.3);
      }
    }
    const moved = Math.hypot(SN.player.x - oldX, SN.player.z - oldZ);
    SN.player.speed = dt > 0 ? moved / dt : 0;
    if (SN.player.speed > 1.15 && !SN.player.dead) {
      for (const a of SN.actors) {
        if (!a.active || a.down || a.inCar || a.missionEnemy || a.kind === "police" || a.interior)
          continue;
        if (Math.hypot(a.x - SN.player.x, a.z - SN.player.z) > 0.86)
          continue;
        SN.bumpActor(a, SN.player.speed, false);
      }
    }
    const floor = SN.groundUnder(SN.player.x, SN.player.z, 0.22);
    SN.coyoteTime = SN.player.grounded ? 0.1 : Math.max(0, SN.coyoteTime - dt);
    SN.jumpBuffer = Math.max(0, SN.jumpBuffer - dt);
    if ((SN.player.grounded || SN.coyoteTime > 0) && SN.jumpBuffer > 0) {
      SN.player.vy = 6.1;
      SN.jumpBuffer = 0;
      SN.coyoteTime = 0;
      SN.player.fallPeak = SN.player.y;
      SN.player.grounded = false;
    }
    if (SN.player.grounded && SN.player.y - floor > 0.38) {
      SN.player.grounded = false;
      SN.player.vy = 0;
      SN.player.fallPeak = SN.player.y;
    }
    if (!SN.player.grounded) {
      SN.player.fallPeak = Math.max(SN.player.fallPeak, SN.player.y);
      SN.player.vy -= 18 * dt;
      SN.player.y += SN.player.vy * dt;
      if (SN.player.y <= floor) {
        const drop = SN.player.fallPeak - floor;
        SN.player.y = floor;
        SN.player.vy = 0;
        SN.player.grounded = true;
        if (drop > 3.5)
          SN.hurtPlayer(Math.min(100, (drop - 3.5) * 13), true);
      }
    }
    else {
      SN.player.y = floor;
      SN.player.fallPeak = floor;
    }
    SN.playerRoot.position.set(SN.player.x, SN.player.y, SN.player.z);
    SN.playerRoot.rotation.y = SN.player.yaw;
    SN.advanceGait(SN.playerRig, moved, dt, SN.player.gait, SN.player.grounded && wasGrounded);
    SN.player.phase = SN.playerRig.motion.phase;
    SN.poseRig(SN.playerRig, SN.player.speed, SN.player.phase, SN.simTime, !SN.player.grounded, aim || SN.firing, SN.attackTime / 0.52, SN.holstered ? -1 : SN.selectedWeapon);
    SN.player.hitReact = Math.max(0, SN.player.hitReact - dt);
    if (SN.player.hitReact > 0) {
      const kick = Math.sin(SN.player.hitReact / 0.45 * SN.PI) * 0.16;
      SN.playerRig.torso.rotation.x -= kick;
      SN.playerRig.torso.rotation.z += kick * 0.55;
    }
    if (aim)
      SN.playerRig.torso.rotation.x += SN.camPitch * 0.6;
  };
  // Startup phase 19: keep this order relative to the other systems.

  SN.registerInit(19, function initializeCharacters19() {
    // ---------------------------------------------------------------------------
    // Character rig, rebuilt for the 1.78 m eight-head silhouette.
    // Every visual part is one of a small set of shared geometries, so all NPCs
    // still render as a handful of instanced draws. Detail parts (eyes, jewellery,
    // buckles) are tagged and skipped beyond ~30 m.
    // ---------------------------------------------------------------------------
    SN.RIG_BASE = 1.78;
    SN.SOLE_DROP = 0.058;
    SN.UPPER_LEG = 0.455;
    SN.LOWER_LEG = 0.44;
    SN.ANKLE_Y = SN.SOLE_DROP;
    SN.HIP_Y = SN.ANKLE_Y + SN.UPPER_LEG + SN.LOWER_LEG;
    SN.TORSO_Y = 1.03;
    SN.SHOULDER_X = 0.245;
    SN.SHOULDER_Y = 0.42;
    SN.HEAD_JOINT_Y = 0.52;
    SN.ARM_UPPER = 0.29;
    SN.ARM_LOWER = 0.27;
    SN.sphereGeo = new SN.T.SphereGeometry(1, 12, 10);
    SN.capsuleGeo = SN.merged([
      { g: new SN.T.CylinderGeometry(0.5, 0.5, 0.5, 10), x: 0, y: 0, z: 0 },
      { g: SN.sphereGeo, x: 0, y: 0.25, z: 0, sx: 0.5, sy: 0.25, sz: 0.5 },
      { g: SN.sphereGeo, x: 0, y: -0.25, z: 0, sx: 0.5, sy: 0.25, sz: 0.5 }
    ]);
    // Waist -> chest lathe; flattened on Z when placed to get an oval torso.
    SN.torsoGeo = new SN.T.LatheGeometry([
      new SN.T.Vector2(0.148, -0.11),
      new SN.T.Vector2(0.162, -0.04),
      new SN.T.Vector2(0.172, 0.05),
      new SN.T.Vector2(0.205, 0.18),
      new SN.T.Vector2(0.238, 0.34),
      new SN.T.Vector2(0.25, 0.41),
      new SN.T.Vector2(0.185, 0.455)
    ], 12);
    // Shoe uppers sit above a separate sole slab, so soles can stay pale and clean.
    SN.shoeGeo = SN.merged([
      { g: SN.roundedBox(0.19, 0.075, 0.285, 0.028), x: 0, y: 0.008, z: 0.035 },
      { g: SN.roundedBox(0.175, 0.05, 0.08, 0.022), x: 0, y: 0, z: 0.17 },
      { g: SN.box, x: 0, y: 0.035, z: -0.095, sx: 0.06, sy: 0.06, sz: 0.02 }
    ]);
    SN.bootGeo = SN.merged([
      { g: SN.roundedBox(0.195, 0.15, 0.29, 0.03), x: 0, y: 0.045, z: 0.03 },
      { g: SN.roundedBox(0.18, 0.06, 0.09, 0.02), x: 0, y: 0.005, z: 0.17 },
      { g: SN.box, x: 0, y: 0.09, z: -0.09, sx: 0.16, sy: 0.05, sz: 0.05 }
    ]);
    SN.soleGeo = SN.roundedBox(0.208, 0.045, 0.335, 0.02);
    // Sculpted head: cranium, cheekbones, jaw, chin, nose, brow ridge and ears.
    // Flatter face plane than a plain ellipsoid, so eyes, brows and the mouth line
    // sit proud of the skin instead of disappearing inside the cranium.
    SN.headGeo = SN.merged([
      { g: SN.sphereGeo, x: 0, y: 0.1, z: 0, sx: 0.116, sy: 0.13, sz: 0.112 },
      { g: SN.roundedBox(0.105, 0.09, 0.1, 0.028), x: 0, y: 0.045, z: 0.032 },
      { g: SN.box, x: 0, y: 0.012, z: 0.058, sx: 0.062, sy: 0.035, sz: 0.042 },
      { g: SN.sphereGeo, x: 0.074, y: 0.082, z: 0.048, sx: 0.045, sy: 0.04, sz: 0.045 },
      { g: SN.sphereGeo, x: -0.074, y: 0.082, z: 0.048, sx: 0.045, sy: 0.04, sz: 0.045 },
      { g: SN.box, x: 0, y: 0.086, z: 0.105, sx: 0.026, sy: 0.05, sz: 0.034 },
      { g: SN.box, x: 0, y: 0.135, z: 0.104, sx: 0.155, sy: 0.024, sz: 0.02 },
      { g: SN.sphereGeo, x: 0.116, y: 0.09, z: -0.006, sx: 0.031, sy: 0.045, sz: 0.022 },
      { g: SN.sphereGeo, x: -0.116, y: 0.09, z: -0.006, sx: 0.031, sy: 0.045, sz: 0.022 }
    ]);
    // Hair is a cap plus a couple of masses: never a full sphere over the face.
    SN.hairShort = SN.merged([
      { g: SN.sphereGeo, x: 0, y: 0.155, z: -0.034, sx: 0.124, sy: 0.105, sz: 0.128 },
      { g: SN.box, x: 0, y: 0.13, z: -0.085, sx: 0.2, sy: 0.1, sz: 0.08 },
      { g: SN.box, x: 0.098, y: 0.125, z: -0.02, sx: 0.032, sy: 0.075, sz: 0.105 },
      { g: SN.box, x: -0.098, y: 0.125, z: -0.02, sx: 0.032, sy: 0.075, sz: 0.105 }
    ]);
    SN.hairUnder = SN.merged([
      { g: SN.roundedBox(0.225, 0.07, 0.235, 0.03), x: 0, y: 0.19, z: -0.01 },
      { g: SN.box, x: 0, y: 0.14, z: -0.085, sx: 0.19, sy: 0.075, sz: 0.07 },
      { g: SN.box, x: 0, y: 0.205, z: 0.065, sx: 0.21, sy: 0.035, sz: 0.06 }
    ]);
    SN.hairBob = SN.merged([
      { g: SN.sphereGeo, x: 0, y: 0.155, z: -0.032, sx: 0.128, sy: 0.11, sz: 0.13 },
      { g: SN.box, x: 0.105, y: 0.06, z: -0.02, sx: 0.045, sy: 0.2, sz: 0.15 },
      { g: SN.box, x: -0.105, y: 0.06, z: -0.02, sx: 0.045, sy: 0.2, sz: 0.15 },
      { g: SN.box, x: 0, y: 0.13, z: -0.1, sx: 0.21, sy: 0.14, sz: 0.06 }
    ]);
    SN.hairPony = SN.merged([
      { g: SN.sphereGeo, x: 0, y: 0.16, z: -0.032, sx: 0.126, sy: 0.105, sz: 0.13 },
      { g: SN.sphereGeo, x: 0, y: 0.11, z: -0.145, sx: 0.075, sy: 0.075, sz: 0.075 },
      { g: SN.box, x: 0, y: 0.03, z: -0.185, sx: 0.065, sy: 0.18, sz: 0.065 },
      { g: SN.box, x: 0, y: -0.06, z: -0.21, sx: 0.05, sy: 0.1, sz: 0.05 }
    ]);
    SN.hatCap = SN.merged([
      { g: SN.sphereGeo, x: 0, y: 0.19, z: -0.022, sx: 0.13, sy: 0.075, sz: 0.13 },
      { g: SN.box, x: 0, y: 0.16, z: 0.08, sx: 0.225, sy: 0.028, sz: 0.115 },
      { g: SN.box, x: 0, y: 0.158, z: 0.135, sx: 0.2, sy: 0.022, sz: 0.06 }
    ]);
    SN.glassesGeo = SN.merged([
      { g: SN.box, x: 0.055, y: 0.104, z: 0.128, sx: 0.07, sy: 0.045, sz: 0.012 },
      { g: SN.box, x: -0.055, y: 0.104, z: 0.128, sx: 0.07, sy: 0.045, sz: 0.012 },
      { g: SN.box, x: 0, y: 0.108, z: 0.13, sx: 0.03, sy: 0.01, sz: 0.01 },
      { g: SN.box, x: 0.105, y: 0.11, z: 0.1, sx: 0.012, sy: 0.012, sz: 0.062 },
      { g: SN.box, x: -0.105, y: 0.11, z: 0.1, sx: 0.012, sy: 0.012, sz: 0.062 }
    ]);
    SN.chainGeo = new SN.T.TorusGeometry(0.055, 0.009, 4, 10);
    SN.printGeo = new SN.T.PlaneGeometry(0.15, 0.15);
    // Curled grip hand and relaxed open hand. The weapon group hangs from the wrist.
    SN.handGrip = SN.merged([
      { g: SN.roundedBox(0.072, 0.085, 0.05, 0.014), x: 0, y: -0.042, z: 0 },
      { g: SN.roundedBox(0.068, 0.058, 0.036, 0.012), x: 0, y: -0.094, z: 0.016, rx: 0.28 },
      { g: SN.roundedBox(0.026, 0.055, 0.026, 0.008), x: 0.04, y: -0.05, z: 0.018, rz: -0.55 },
      { g: SN.roundedBox(0.024, 0.05, 0.022, 0.008), x: 0, y: -0.092, z: -0.02, rx: 0.7 }
    ]);
    SN.handOpen = SN.merged([
      { g: SN.roundedBox(0.072, 0.09, 0.048, 0.014), x: 0, y: -0.045, z: 0 },
      { g: SN.roundedBox(0.066, 0.055, 0.03, 0.01), x: 0, y: -0.1, z: 0.004 },
      { g: SN.roundedBox(0.024, 0.055, 0.024, 0.008), x: 0.042, y: -0.055, z: 0.004, rz: -0.55 }
    ]);
    // Original printed-shirt artwork: an abstract lantern glyph, drawn locally.
    SN.printCanvas = document.createElement("canvas");
    SN.printCanvas.width = SN.printCanvas.height = 128;
    {
      const g = SN.printCanvas.getContext("2d");
      g.clearRect(0, 0, 128, 128);
      g.strokeStyle = "#f5ffef";
      g.lineWidth = 7;
      g.beginPath();
      g.arc(64, 58, 30, 0, SN.TAU);
      g.stroke();
      g.beginPath();
      g.moveTo(64, 24);
      g.lineTo(64, 92);
      g.moveTo(38, 58);
      g.lineTo(90, 58);
      g.stroke();
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(42, 92);
      g.lineTo(86, 92);
      g.stroke();
      g.fillStyle = "#f5ffef";
      g.beginPath();
      g.arc(64, 58, 7, 0, SN.TAU);
      g.fill();
    }
    SN.printTexture = SN.canvasTexture(SN.printCanvas);
    // Subtle procedural weave for cloth: near-white, so per-instance palette tints
    // still read correctly while collars and sleeves pick up a little grain.
    SN.fabricSurface = SN.getSurface("fabric");
    SN.skinSurface = SN.getSurface("skin");
    SN.hairSurface = SN.getSurface("hair");
    for (const tex of [SN.fabricSurface.map, SN.fabricSurface.normalMap, SN.fabricSurface.roughnessMap])
      tex.repeat.set(3, 3);
    SN.rigGeo = {
      box: SN.box,
      sphere: SN.sphereGeo,
      capsule: SN.capsuleGeo,
      torso: SN.torsoGeo,
      shoe: SN.shoeGeo,
      boot: SN.bootGeo,
      sole: SN.soleGeo,
      handGrip: SN.handGrip,
      handOpen: SN.handOpen,
      head: SN.headGeo,
      hairShort: SN.hairShort,
      hairUnder: SN.hairUnder,
      hairBob: SN.hairBob,
      hairPony: SN.hairPony,
      hatCap: SN.hatCap,
      glasses: SN.glassesGeo,
      chain: SN.chainGeo,
      print: SN.printGeo
    };
    // Shared white materials; per-instance colour carries the actual palette.
    SN.rigBatchMaterials = {
      skin: SN.mat(0xffffff, {
        map: SN.skinSurface.map,
        normalMap: SN.skinSurface.normalMap,
        roughnessMap: SN.skinSurface.roughnessMap,
        roughness: 1,
        metalness: 0.02,
        envMapIntensity: 0.35,
        normalScale: new SN.T.Vector2(0.22, 0.22)
      }),
      cloth: SN.mat(0xffffff, {
        map: SN.fabricSurface.map,
        normalMap: SN.fabricSurface.normalMap,
        roughnessMap: SN.fabricSurface.roughnessMap,
        roughness: 1,
        metalness: 0.02,
        envMapIntensity: 0.3,
        normalScale: new SN.T.Vector2(0.6, 0.6)
      }),
      hair: SN.mat(0xffffff, {
        map: SN.hairSurface.map,
        normalMap: SN.hairSurface.normalMap,
        roughnessMap: SN.hairSurface.roughnessMap,
        roughness: 1,
        metalness: 0.06,
        envMapIntensity: 0.4,
        normalScale: new SN.T.Vector2(0.4, 0.4)
      }),
      metal: SN.mat(0xffffff, { metalness: 0.55, roughness: 0.34, envMapIntensity: 0.9 }),
      eye: SN.mat(0xffffff, { roughness: 0.16, metalness: 0.05, envMapIntensity: 1 }),
      print: SN.mat(0xffffff, { map: SN.printTexture, transparent: true, roughness: 0.9, side: SN.T.DoubleSide }),
      glass: SN.mat(0xffffff, { metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.5, envMapIntensity: 1.3 })
    };
    SN.paletteMaterials = new Map();
    // The player rig is a real group of meshes, not an instanced batch, so it needs
    // its own woven-cloth material variants to match the NPCs.
    SN.clothPartMaterials = new Map();
    SN.skinPartMaterials = new Map();
    SN.hairPartMaterials = new Map();
    // A cool back light gives hair, collars and shoulders a readable edge at night.
    SN.rimLight = new SN.T.DirectionalLight(0x9fd6ff, 0.35);
    SN.rimLight.castShadow = false;
    SN.scene.add(SN.rimLight, SN.rimLight.target);
    SN.rigMatRough = { skin: 0.6, cloth: 0.9, hair: 0.76, metal: 0.3, eye: 0.2, print: 0.88, glass: 0.15 };
    SN.printPartMaterials = new Map();
    // Pedestrian archetypes are pooled identities, never rebuilt while walking into view.
    // Students are adult academy commuters. Palettes and accessory silhouettes are original.
    SN.pedestrianArchetypes = {
      office: {
        label: "上班族",
        pool: 18,
        outfit: "jacket",
        hair: ["short", "bob", "pony"],
        outer: [0x293b50, 0x4e4b59, 0x61615c],
        shirt: [0xdce5dc, 0xb9d0d9],
        pants: [0x26323c, 0x403a48],
        accent: [0x99734e, 0x9aa8bd],
        height: [0.94, 1.08],
        build: [0.89, 1.15],
        speed: [1.18, 1.64],
        traits: [0.28, 0.25, 0.47],
        accessory: "briefcase"
      },
      student: {
        label: "学园通勤者",
        pool: 14,
        outfit: "jacket",
        hair: ["short", "bob", "pony", "undercut"],
        outer: [0x314b68, 0x4e665a],
        shirt: [0xe6e5d5, 0xd1dce1],
        pants: [0x353d53, 0x3f4c48],
        accent: [0xd2ab69, 0xab8196],
        height: [0.91, 1.06],
        build: [0.86, 1.05],
        speed: [1.25, 1.75],
        traits: [0.23, 0.16, 0.61],
        accessory: "satchel"
      },
      tourist: {
        label: "游客",
        pool: 16,
        outfit: "tee",
        hair: ["cap", "bob", "short"],
        outer: [0x6a8f8a, 0xb07c60],
        shirt: [0xe1bf85, 0x92bbc1, 0xb28fa8],
        pants: [0x5f6957, 0x454e67],
        accent: [0xe5a767, 0x9fc3ac],
        height: [0.9, 1.12],
        build: [0.91, 1.26],
        speed: [0.85, 1.25],
        traits: [0.18, 0.12, 0.7],
        accessory: "camera"
      },
      elder: {
        label: "长者",
        pool: 12,
        outfit: "jacket",
        hair: ["short", "bob", "cap"],
        outer: [0x8c7f74, 0x71677a, 0x657b75],
        shirt: [0xc8bd9c, 0xa3b2ae],
        pants: [0x555452, 0x454f56],
        accent: [0xceb9a0, 0x9ca6aa],
        height: [0.84, 0.98],
        build: [0.91, 1.15],
        speed: [0.48, 0.82],
        traits: [0.24, 0.08, 0.68],
        accessory: "cane"
      },
      jogger: {
        label: "江边跑者",
        pool: 20,
        outfit: "tee",
        hair: ["pony", "short", "cap"],
        outer: [0x538b8c, 0xad7756],
        shirt: [0x75b9a4, 0xeb9e65, 0x8298cb],
        pants: [0x273c4a, 0x3c354a],
        accent: [0xd3f1b9, 0xebd7a1],
        height: [0.94, 1.1],
        build: [0.85, 1.08],
        speed: [2.35, 3.25],
        traits: [0.48, 0.2, 0.32],
        accessory: "headphones"
      },
      delivery: {
        label: "配送员",
        pool: 12,
        outfit: "jacket",
        hair: ["short", "pony"],
        outer: [0x478e90, 0xdfa45e],
        shirt: [0xc8dfdb, 0xddd1b5],
        pants: [0x293e48, 0x48504a],
        accent: [0xe7ecc2, 0xa8dbe1],
        height: [0.91, 1.08],
        build: [0.92, 1.15],
        speed: [1.5, 1.95],
        traits: [0.39, 0.31, 0.3],
        accessory: "deliveryBox"
      },
      vendor: {
        label: "街头摊主",
        pool: 10,
        outfit: "tee",
        hair: ["cap", "bob", "short"],
        outer: [0x804d36, 0x466961],
        shirt: [0xdac5a0, 0xc5917a],
        pants: [0x3c4145, 0x554b3c],
        accent: [0xdfa259, 0xb5c9a6],
        height: [0.87, 1.05],
        build: [1, 1.28],
        speed: [0.7, 1.05],
        traits: [0.4, 0.36, 0.24],
        accessory: "apron"
      },
      couple: {
        label: "结伴散步者",
        pool: 12,
        outfit: "jacket",
        hair: ["pony", "undercut", "bob", "short"],
        outer: [0xb68b82, 0x7c929c, 0x9389a7],
        shirt: [0xd7d2bb, 0xc2dacb],
        pants: [0x484458, 0x3a4c52],
        accent: [0xf0c9a2, 0xc7e6d4],
        height: [0.9, 1.08],
        build: [0.87, 1.13],
        speed: [0.92, 1.18],
        traits: [0.45, 0.14, 0.41],
        accessory: "scarf"
      },
      worker: {
        label: "施工人员",
        pool: 10,
        outfit: "jacket",
        hair: ["short", "pony"],
        outer: [0xedb93e, 0xde803e],
        shirt: [0x687b83, 0x6b7e6b],
        pants: [0x4b5660, 0x55564e],
        accent: [0xdcebd2, 0xe8dcb6],
        height: [0.97, 1.13],
        build: [1.04, 1.3],
        speed: [0.95, 1.35],
        traits: [0.53, 0.32, 0.15],
        accessory: "hardhat"
      },
      nightlife: {
        label: "夜游人群",
        pool: 20,
        outfit: "jacket",
        hair: ["undercut", "bob", "pony"],
        outer: [0x664e83, 0x376c78, 0xa1576b, 0x2f394c],
        shirt: [0xd6aabf, 0xa7d9d7, 0xd5c2aa],
        pants: [0x2c293f, 0x35424a],
        accent: [0x84dbce, 0xe1b2da],
        height: [0.92, 1.12],
        build: [0.87, 1.18],
        speed: [1, 1.5],
        traits: [0.24, 0.44, 0.32],
        accessory: "earrings"
      }
    };
    SN.pedestrianSlots = Object.entries(SN.pedestrianArchetypes).flatMap(([id, def]) => Array.from({ length: def.pool }, () => id));
    SN.playerProfile = {
      build: 1.02,
      hair: "undercut",
      outfit: "jacket",
      skin: 0xd3a27c,
      shirt: 0x25313a,
      outer: 0x1f5f63,
      pants: 0x222b34,
      hairColor: 0x1b2120,
      accent: 0xb9d7c9,
      men: true,
      trousers: "slacks",
      shoes: "boot",
      cargo: false,
      capColor: 0x24313c,
      glasses: false,
      mask: false,
      backpack: false,
      chain: false,
      player: true
    };
    SN.GAITS = [
      { name: "步行", speed: 1.5, cycle: 1.4, stance: 0.64 },
      { name: "慢跑", speed: 3.2, cycle: 2.1, stance: 0.48 },
      { name: "疾跑", speed: 6.8, cycle: 3.05, stance: 0.34 }
    ];
    SN.playerRig = SN.makeRig(0x517b84, SN.playerProfile.skin, 1, SN.playerProfile);
    SN.playerRoot = SN.playerRig.root;
    SN.scene.add(SN.playerRoot);
  });
  // Startup phase 21: keep this order relative to the other systems.

  SN.registerInit(21, function initializeCharacters21() {
    SN.player = {
      x: -40,
      z: -770,
      y: 0,
      yaw: SN.PI,
      vy: 0,
      grounded: true,
      speed: 0,
      phase: 0,
      car: null,
      health: 100,
      armor: 60,
      dead: 0,
      lastHurt: -100,
      gait: 1,
      walkMode: false,
      hitReact: 0,
      fallPeak: 0,
      motionSpeed: 0,
      moveX: 0,
      moveZ: 1
    };
    SN.player.y = SN.surfaceHeight(SN.player.x, SN.player.z);
    SN.playerRoot.position.set(SN.player.x, SN.player.y, SN.player.z);
  });
})(window.SN);
