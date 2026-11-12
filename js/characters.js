/* 人物骨架、服装材质、步态与玩家移动。 */
"use strict";
(function (SN) {
  // ---------------------------------------------------------------------------
  // Procedural character geometry. Everything is lofted, lathed or extruded so
  // the same builder can emit a detailed near model and a light crowd model with
  // the same silhouette. No primitives remain visible as cubes.
  // ---------------------------------------------------------------------------
  SN.characterLimb = function characterLimb(detail) {
    const points = detail
      ? [[0.04, -0.5], [0.20, -0.47], [0.36, -0.38], [0.46, -0.21], [0.49, 0.02], [0.45, 0.26], [0.32, 0.43], [0.04, 0.5]]
      : [[0.06, -0.5], [0.34, -0.40], [0.48, -0.14], [0.47, 0.18], [0.30, 0.44], [0.06, 0.5]];
    return SN.latheProfile(points, detail ? 12 : 7);
  };
  SN.characterTorso = function characterTorso(detail) {
    const points = detail
      ? [[0.138, -0.12], [0.151, 0.0], [0.174, 0.15], [0.208, 0.27], [0.238, 0.36], [0.245, 0.41], [0.205, 0.455], [0.12, 0.483], [0.05, 0.49]]
      : [[0.14, -0.12], [0.16, 0.02], [0.195, 0.2], [0.24, 0.36], [0.23, 0.44], [0.12, 0.49]];
    return SN.latheProfile(points, detail ? 12 : 8);
  };
  SN.characterSkirt = function characterSkirt(detail) {
    return SN.latheProfile([[0.155, 0.02], [0.185, -0.10], [0.225, -0.24], [0.245, -0.34], [0.24, -0.36]], detail ? 12 : 5);
  };
  SN.characterHead = function characterHead(detail) {
    const sphere = new SN.T.SphereGeometry(1, detail ? 14 : 9, detail ? 9 : 6),
      small = new SN.T.SphereGeometry(1, detail ? 10 : 6, detail ? 7 : 4),
      position = sphere.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i), py = position.getY(i), pz = position.getZ(i);
      let x = px * 0.112, y = 0.10 + py * 0.134, z = pz * 0.106;
      const lower = SN.clamp(-py, 0, 1);
      x *= 1 - 0.23 * lower * lower;
      z *= 1 - 0.11 * lower;
      if (pz > 0) {
        z *= 0.93;
        z += 0.0045 * Math.exp(-((py - 0.34) * (py - 0.34)) / 0.035) * (1 - Math.min(1, Math.abs(px)));
      }
      position.setXYZ(i, x, y, z);
    }
    sphere.computeVertexNormals();
    const parts = [
      { g: sphere },
      { g: small, x: 0, y: 0.047, z: 0.031, sx: 0.080, sy: 0.060, sz: 0.080 },
      { g: small, x: 0, y: 0.084, z: 0.106, sx: 0.020, sy: 0.031, sz: 0.030 },
      { g: small, x: 0, y: 0.064, z: 0.117, sx: 0.015, sy: 0.014, sz: 0.016 },
      { g: small, x: 0.111, y: 0.096, z: -0.004, sx: 0.021, sy: 0.039, sz: 0.026, rx: 0.1 },
      { g: small, x: -0.111, y: 0.096, z: -0.004, sx: 0.021, sy: 0.039, sz: 0.026, rx: 0.1 }
    ];
    const merged = SN.merged(parts);
    // Narrow and slightly shorten the cranium: ~15.5 cm wide, 0.24 m tall, which
    // lands the rig on a seven-and-a-half-head silhouette once hair is added.
    merged.scale(0.74, 0.93, 0.88);
    sphere.dispose();
    small.dispose();
    return merged;
  };
  SN.characterFace = function characterFace(detail) {
    const nx = detail ? 10 : 5, ny = detail ? 7 : 4, positions = [], uvs = [], indices = [];
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        const u = i / nx, v = j / ny, half = 0.060 * Math.pow(Math.sin(Math.PI * v), 0.55),
          x = (u - 0.5) * 2 * half, y = 0.010 + v * 0.185,
          cx = x / 0.080, cy = (y - 0.105) / 0.125,
          surface = Math.sqrt(Math.max(0.015, 1 - cx * cx - cy * cy));
        let z = 0.088 * surface + 0.0025;
        z += 0.033 * Math.exp(-(x / 0.026) * (x / 0.026) - ((y - 0.079) / 0.036) * ((y - 0.079) / 0.036));
        positions.push(x, y, z);
        uvs.push(u, v);
      }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 2, d = a + nx + 1;
        indices.push(a, b, c, a, c, d);
      }
    const geometry = new SN.T.BufferGeometry();
    geometry.setAttribute("position", new SN.T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new SN.T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };
  SN.characterShoe = function characterShoe(detail, boot) {
    const outline = boot
      ? [[-0.142, 0], [-0.152, 0.055], [-0.132, 0.145], [-0.055, 0.19], [0.045, 0.183], [0.125, 0.12], [0.168, 0.055], [0.168, 0]]
      : [[-0.132, 0], [-0.142, 0.042], [-0.118, 0.082], [-0.045, 0.113], [0.035, 0.112], [0.105, 0.076], [0.158, 0.038], [0.158, 0]];
    const geometry = SN.extrudeOutline(outline, detail ? 0.19 : 0.175, detail ? 0.026 : 0, detail ? 5 : 2, detail ? 2 : 1);
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(0, -0.031, 0);
    return SN.weldGeometry(geometry, 0.0004);
  };
  SN.characterSole = function characterSole(detail) {
    const outline = [[-0.142, 0], [-0.148, 0.032], [-0.135, 0.05], [0.11, 0.05], [0.164, 0.035], [0.168, 0.012], [0.16, 0]];
    const geometry = SN.extrudeOutline(outline, detail ? 0.201 : 0.19, detail ? 0.008 : 0, detail ? 4 : 2, 2);
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(0, -0.0225, 0);
    return SN.weldGeometry(geometry, 0.0004);
  };
  SN.characterHand = function characterHand(detail, grip) {
    const sphere = new SN.T.SphereGeometry(1, detail ? 8 : 5, detail ? 6 : 4),
      parts = [
        { g: sphere, x: 0, y: -0.046, z: 0, sx: 0.040, sy: 0.053, sz: 0.025 },
        { g: sphere, x: 0, y: -0.088, z: grip ? 0.024 : 0.006, sx: 0.034, sy: 0.043, sz: 0.023, rx: grip ? 0.6 : 0.05 },
        { g: sphere, x: 0, y: -0.058, z: -0.02, sx: 0.021, sy: 0.025, sz: 0.018 },
        { g: sphere, x: 0.038, y: -0.052, z: grip ? 0.02 : 0.008, sx: 0.013, sy: 0.030, sz: 0.014, rz: -0.72 }
      ];
    const merged = SN.merged(parts);
    sphere.dispose();
    return merged;
  };
  SN.characterHair = function characterHair(style, detail) {
    const sphere = new SN.T.SphereGeometry(1, detail ? 12 : 6, detail ? 7 : 4),
      cap = new SN.T.SphereGeometry(1, detail ? 14 : 7, detail ? 7 : 4, 0, SN.TAU, 0, Math.PI * 0.4),
      parts = [];
    if (style === "cap") {
      const dome = new SN.T.SphereGeometry(1, detail ? 14 : 7, detail ? 6 : 4, 0, SN.TAU, 0, Math.PI * 0.5);
      parts.push({ g: dome, x: 0, y: 0.185, z: -0.006, sx: 0.133, sy: 0.094, sz: 0.131 });
      parts.push({ g: new SN.T.CylinderGeometry(1, 1, 1, detail ? 16 : 8, 1, false, -Math.PI / 2, Math.PI), x: 0, y: 0.178, z: 0.068, sx: 0.142, sy: 0.018, sz: 0.105 });
      dome.dispose();
    } else if (style === "beanie") {
      const dome = new SN.T.SphereGeometry(1, detail ? 14 : 7, detail ? 6 : 4, 0, SN.TAU, 0, Math.PI * 0.55);
      parts.push({ g: dome, x: 0, y: 0.128, z: -0.008, sx: 0.132, sy: 0.135, sz: 0.131 });
      parts.push({ g: new SN.T.TorusGeometry(0.118, 0.026, detail ? 6 : 4, detail ? 14 : 7), x: 0, y: 0.152, z: -0.008, rx: Math.PI / 2 });
      dome.dispose();
    } else {
      parts.push({ g: cap, x: 0, y: 0.101, z: -0.008, sx: 0.127, sy: 0.141, sz: 0.126 });
      if (style === "short" || style === "undercut") {
        parts.push({ g: sphere, x: 0, y: 0.118, z: -0.056, sx: 0.116, sy: 0.088, sz: 0.082 });
        if (style === "short") {
          parts.push({ g: sphere, x: 0.104, y: 0.108, z: -0.012, sx: 0.022, sy: 0.052, sz: 0.036 });
          parts.push({ g: sphere, x: -0.104, y: 0.108, z: -0.012, sx: 0.022, sy: 0.052, sz: 0.036 });
        }
      } else if (style === "bob") {
        parts.push({ g: sphere, x: 0, y: 0.048, z: -0.056, sx: 0.114, sy: 0.132, sz: 0.086 });
        parts.push({ g: sphere, x: 0.099, y: 0.045, z: -0.018, sx: 0.034, sy: 0.138, sz: 0.082 });
        parts.push({ g: sphere, x: -0.099, y: 0.045, z: -0.018, sx: 0.034, sy: 0.138, sz: 0.082 });
      } else if (style === "long") {
        parts.push({ g: sphere, x: 0, y: -0.006, z: -0.058, sx: 0.116, sy: 0.245, sz: 0.086 });
        parts.push({ g: sphere, x: 0.099, y: -0.004, z: -0.016, sx: 0.036, sy: 0.212, sz: 0.082 });
        parts.push({ g: sphere, x: -0.099, y: -0.004, z: -0.016, sx: 0.036, sy: 0.212, sz: 0.082 });
      } else if (style === "pony") {
        parts.push({ g: sphere, x: 0, y: 0.114, z: -0.07, sx: 0.07, sy: 0.07, sz: 0.06 });
        parts.push({ g: sphere, x: 0, y: 0.02, z: -0.14, sx: 0.048, sy: 0.155, sz: 0.055, rx: 0.32 });
      }
    }
    const merged = SN.merged(parts);
    merged.scale(0.74, 1, 0.88);
    cap.dispose();
    sphere.dispose();
    return merged;
  };
  SN.prepareCrowdGeometry = function prepareCrowdGeometry() {
    const lowSphere = new SN.T.SphereGeometry(1, 6, 4);
    SN.crowdGeo = {
      box: SN.box,
      sphere: lowSphere,
      capsule: SN.merged([
        { g: new SN.T.CylinderGeometry(0.5, 0.5, 0.5, 6), x: 0, y: 0, z: 0 },
        { g: lowSphere, x: 0, y: 0.25, z: 0, sx: 0.5, sy: 0.25, sz: 0.5 },
        { g: lowSphere, x: 0, y: -0.25, z: 0, sx: 0.5, sy: 0.25, sz: 0.5 }
      ]),
      limb: SN.characterLimb(false),
      torso: SN.characterTorso(false),
      skirt: SN.characterSkirt(false),
      shoe: SN.characterShoe(false, false),
      boot: SN.characterShoe(false, true),
      sole: SN.characterSole(false),
      handGrip: SN.characterHand(false, true),
      handOpen: SN.characterHand(false, false),
      head: SN.characterHead(false),
      face: SN.characterFace(false),
      hairShort: SN.characterHair("short", false),
      hairUnder: SN.characterHair("undercut", false),
      hairBob: SN.characterHair("bob", false),
      hairPony: SN.characterHair("pony", false),
      hairLong: SN.characterHair("long", false),
      hatCap: SN.characterHair("cap", false),
      hatBeanie: SN.characterHair("beanie", false),
      glasses: SN.glassesGeo,
      chain: SN.chainGeo,
      print: SN.printGeo,
      panel: SN.roundedBox(1, 1, 1, 0.3, 2)
    };
  };

  SN.actorMaterial = function actorMaterial(color, rough = 0.8) {
    const key = color + "|" + rough;
    if (!SN.paletteMaterials.has(key))
      SN.paletteMaterials.set(key, SN.mat(color, { roughness: rough }));
    return SN.paletteMaterials.get(key);
  };

  SN.clothMaterial = function clothMaterial(color) {
    if (!SN.clothPartMaterials.has(color)) {
      const m = new SN.T.MeshStandardMaterial({
        color: SN.srgb(color),
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
        color: SN.srgb(color),
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
        color: SN.srgb(color),
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
    let choice = Math.imul(index + 1, 2654435761) >>> 0;
    const pick = values => { choice = (Math.imul(choice, 1664525) + 1013904223) >>> 0; return values[choice % values.length]; },
      men = index % 3 !== 2,
      skin = pick([0xd8ac88, 0xba8564, 0xe4bf9d, 0x966c52, 0xc79270, 0x6f4b39]);
    if (def)
      return {
        archetype: id,
        build: SN.rand(...def.build),
        height: SN.rand(...def.height),
        hair: pick(def.hair),
        outfit: ["student", "tourist", "nightlife"].includes(id) && index % 4 === 0 ? "hoodie" : def.outfit,
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
        backpack: ["student", "tourist"].includes(id) && index % 3 !== 0,
        chain: id === "nightlife",
        accessory: def.accessory,
        shorts: id === "jogger",
        skirt: !men && ["office", "student", "couple", "nightlife", "tourist"].includes(id) && index % 4 === 0,
        skirtColor: pick(def.pants),
        padded: id === "elder" || (id === "vendor" && index % 3 === 0),
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
      outer: gang ? (teal ? 0x24746f : 0xa44536) : 0x285e9a,
      pants: gang ? (teal ? 0x293541 : 0x393033) : 0x26313f,
      hairColor: 0x211d23,
      accent: gang ? (teal ? 0xe5e2c7 : 0xf5c566) : 0xbce5f0,
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
      const m = new SN.T.Mesh(SN.rigGeo[geoName], matType === "face" ? SN.faceMaterial : matType === "cloth" ? SN.clothMaterial(color) : matType === "skin" ? SN.skinMaterial(color) : matType === "hair" ? SN.hairMaterial(color) : SN.actorMaterial(color, SN.rigMatRough[matType] || 0.8));
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.scale.set(sx, sy, sz);
      // Large body volumes define the silhouette; seams, eyes and badges do not
      // need their own shadow draw on the directly rendered player rig.
      m.castShadow = !detail && !["box", "sphere", "print", "chain", "glasses", "face", "panel"].includes(geoName);
      m.receiveShadow = false;
      parent.add(m);
      const rec = {
        mesh: m,
        geoName,
        matType,
        color,
        colorObject: matType === "face" ? new SN.T.Color(0xffffff) : SN.srgb(color),
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
    const b = p.build || 1, chest = 0.84 * b, shoulderWidth = 0.94 * b * (p.men === false ? 0.9 : 1),
      hipWidth = 0.098 * b * (p.men === false ? 1.08 : 1);
    // pelvis and belt ride with the torso, so a seated driver folds cleanly
    part(torso, "limb", "cloth", p.pants, 0, -0.055, 0, 0.30, 0.2, 0.21, 0, 0, 0);
    part(torso, "torso", "cloth", 0x171b20, 0, -0.005, 0, chest * 0.96, 0.075, 0.62, 0, 0, 0, true);
    if (p.cargo)
      for (const side of [-1, 1])
        part(torso, "panel", "cloth", p.pants, side * 0.175, -0.12, 0.045, 0.06, 0.13, 0.035, 0, 0, side * 0.08, true);
    // neck
    part(torso, "limb", "skin", p.skin, 0, 0.47, 0, 0.085, 0.13, 0.082);
    // shirt / body base
    part(torso, "torso", "cloth", p.shirt, 0, 0, 0, chest, 1, 0.64);
    if (p.outfit === "jacket") {
      part(torso, "torso", "cloth", p.outer, 0, -0.005, -0.01, chest * 1.045, 1.005, 0.69, 0, 0, 0);
      part(torso, "panel", "cloth", p.shirt, 0, 0.2, 0.108, 0.105, 0.36, 0.026);
      part(torso, "panel", "cloth", p.outer, 0.13, 0.205, 0.112, 0.145, 0.4, 0.032, 0, -0.1, 0.05);
      part(torso, "panel", "cloth", p.outer, -0.13, 0.205, 0.112, 0.145, 0.4, 0.032, 0, 0.1, -0.05);
      part(torso, "panel", "cloth", p.outer, 0.09, 0.405, 0.066, 0.095, 0.052, 0.07, 0, -0.18, 0.42);
      part(torso, "panel", "cloth", p.outer, -0.09, 0.405, 0.066, 0.095, 0.052, 0.07, 0, 0.18, -0.42);
      part(torso, "panel", "cloth", p.outer, 0.155, 0.11, 0.125, 0.055, 0.09, 0.022, 0, 0, 0.2, true);
    }
    else if (p.outfit === "hoodie") {
      part(torso, "torso", "cloth", p.outer, 0, 0, 0, chest * 1.075, 1.01, 0.7);
      part(torso, "sphere", "cloth", p.outer, 0, 0.43, -0.095, 0.132, 0.085, 0.105);
      part(torso, "sphere", "cloth", p.outer, 0, 0.395, -0.13, 0.115, 0.06, 0.06);
      part(torso, "panel", "cloth", p.outer, 0, 0.1, 0.145, 0.17, 0.135, 0.026, 0.06, 0, 0);
      part(torso, "capsule", "cloth", p.accent, 0.048, 0.37, 0.088, 0.011, 0.16, 0.011, 0.12, 0, 0.08, true);
      part(torso, "capsule", "cloth", p.accent, -0.048, 0.37, 0.088, 0.011, 0.16, 0.011, 0.12, 0, -0.08, true);
    }
    else {
      const artwork = part(torso, "print", "print", p.accent, 0, 0.19, 0.116, 1, 1, 1, 0, 0, 0, true);
      artwork.material = SN.printPartMaterial(p.accent);
    }
    if (p.padded) {
      part(torso, "torso", "cloth", p.outer, 0, 0, 0, chest * 1.1, 1.02, 0.74);
      for (let i = 0; i < 3; i++)
        part(torso, "panel", "cloth", p.outer, 0, 0.06 + i * 0.13, 0.148 + i * 0.01, 0.36 - i * 0.035, 0.018, 0.014, 0, 0, 0, true);
    }
    if (p.outfit === "uniform") {
      part(torso, "torso", "cloth", p.outer, 0, 0, 0, chest * 1.04, 1.005, 0.685);
      part(torso, "panel", "cloth", p.outer, 0.09, 0.405, 0.062, 0.095, 0.052, 0.07, 0, -0.18, 0.42);
      part(torso, "panel", "cloth", p.outer, -0.09, 0.405, 0.062, 0.095, 0.052, 0.07, 0, 0.18, -0.42);
      part(torso, "torso", "cloth", 0x1b2739, 0, 0.17, 0.03, 0.93, 0.32, 0.63, 0, 0, 0, true);
      part(torso, "panel", "metal", p.accent, 0.1, 0.29, 0.129, 0.042, 0.048, 0.008, 0, 0, 0, true);
      part(torso, "panel", "cloth", p.accent, 0.15, 0.39, 0.03, 0.065, 0.032, 0.016, 0, 0, -0.18, true);
      part(torso, "panel", "cloth", 0xbce5f0, 0, 0.29, -0.158, 0.34, 0.055, 0.016);
    }
    if (p.tie) {
      part(torso, "panel", "cloth", p.accent, 0, 0.25, 0.15, 0.038, 0.28, 0.016, 0, 0, 0.04, true);
      part(torso, "panel", "cloth", p.shirt, 0, 0.405, 0.13, 0.125, 0.042, 0.02);
    }
    if (p.chain)
      part(torso, "chain", "metal", 0xd8c88a, 0, 0.4, 0.055, 1, 1, 1, SN.PI / 2, 0, 0, true);
    if (p.backpack) {
      part(torso, "panel", "cloth", p.accent, 0, 0.22, -0.18, 0.27, 0.35, 0.14);
      part(torso, "panel", "cloth", 0x30393a, 0.125, 0.22, 0.07, 0.038, 0.28, 0.016, 0, 0, 0, true);
      part(torso, "panel", "cloth", 0x30393a, -0.125, 0.22, 0.07, 0.038, 0.28, 0.016, 0, 0, 0, true);
    }
    if (p.skirt)
      part(torso, "skirt", "cloth", p.skirtColor || p.pants, 0, -0.19, 0, 1, 1, 1);
    if (p.player) {
      part(torso, "panel", "cloth", 0xf0c45c, 0, 0.34, -0.178, 0.4, 0.06, 0.016);
      part(torso, "panel", "cloth", 0xe4edf2, 0, 0.16, -0.178, 0.15, 0.09, 0.016);
    }
    // head
    const head = joint(torso, 0, SN.HEAD_JOINT_Y, 0);
    part(head, "head", "skin", p.skin, 0, 0, 0, 1, 1, 1);
    // Eyes, brows, nose shading and lips are painted once on a small transparent
    // patch; the head itself keeps a plain skin texture so instance tinting works.
    part(head, "face", "face", 0xffffff, 0, 0, 0, 1, 1, 1, 0, 0, 0, true);
    if (p.glasses)
      part(head, "glasses", "glass", 0x101820, 0, 0, 0, 1, 1, 1, 0, 0, 0, true);
    if (p.mask)
      part(head, "sphere", "cloth", 0x1e2428, 0, 0.062, 0.078, 0.084, 0.052, 0.045, 0, 0, 0, true);
    const hairGeoName = p.hair === "undercut" ? "hairUnder" : p.hair === "bob" ? "hairBob" : p.hair === "pony" ? "hairPony" : p.hair === "long" ? "hairLong" : p.hair === "cap" ? "hatCap" : p.hair === "beanie" ? "hatBeanie" : "hairShort";
    part(head, hairGeoName, "hair", p.hair === "cap" ? p.capColor : (p.hairColor || 0x241d19), 0, 0, 0, 1, 1, 1);
    if (p.hair === "cap")
      part(head, "hairShort", "hair", p.hairColor, 0, 0.13, -0.02, 0.95, 0.9, 0.95);
    const arms = [], legs = [];
    for (const side of [-1, 1]) {
      const mirror = side === 1;
      const shoulder = joint(torso, side * SN.SHOULDER_X * shoulderWidth, SN.SHOULDER_Y, 0),
        elbow = joint(shoulder, 0, -SN.ARM_UPPER, 0),
        hand = joint(elbow, 0, -SN.ARM_LOWER, 0);
      // Deltoid and tapered limb overlap a few centimetres past each hinge, so a
      // bent elbow keeps a continuous rounded surface with no ball joint and no gap.
      part(shoulder, "sphere", "cloth", p.outfit === "tee" ? p.shirt : p.outer, 0, 0.012, 0, 0.09, 0.105, 0.098);
      part(shoulder, "limb", p.outfit === "tee" ? "skin" : "cloth", p.outfit === "tee" ? p.skin : p.outer, 0, -SN.ARM_UPPER * 0.5, 0, 0.155, SN.ARM_UPPER + 0.06, 0.145);
      if (p.outfit === "tee")
        part(shoulder, "limb", "cloth", p.shirt, 0, -0.085, 0, 0.172, 0.2, 0.162);
      part(elbow, "limb", p.outfit === "tee" ? "skin" : "cloth", p.outfit === "tee" ? p.skin : p.outer, 0, -SN.ARM_LOWER * 0.5, 0, 0.132, SN.ARM_LOWER + 0.05, 0.124);
      if (p.outfit !== "tee")
        part(elbow, "limb", "cloth", p.outer, 0, -SN.ARM_LOWER * 0.82, 0, 0.138, 0.1, 0.13, 0, 0, 0, true);
      if (p.outfit === "uniform")
        part(elbow, "limb", "cloth", p.accent, 0, -SN.ARM_LOWER * 0.72, 0, 0.138, 0.032, 0.13, 0, 0, 0, true);
      if (mirror && p.accent && !p.player)
        part(elbow, "panel", "metal", 0xc9c2a5, 0, -SN.ARM_LOWER * 0.76, 0.038, 0.045, 0.032, 0.012, 0, 0, 0, true);
      if (mirror)
        part(elbow, "chain", "metal", 0x2a3136, 0, -SN.ARM_LOWER * 0.9, 0, 0.78, 0.78, 0.62, SN.PI / 2, 0, 0, true);
      part(hand, side < 0 ? "handOpen" : "handGrip", "skin", p.skin, 0, 0, 0, 1, 1, 1);
      arms.push({ upper: shoulder, lower: elbow, hand });
      // leg
      const hip = joint(root, side * hipWidth, SN.HIP_Y, 0),
        knee = joint(hip, 0, -SN.UPPER_LEG, 0),
        foot = joint(knee, 0, -SN.LOWER_LEG, 0.028);
      part(hip, "limb", "cloth", p.pants, 0, -SN.UPPER_LEG * 0.48, 0, 0.19, SN.UPPER_LEG + 0.07, 0.185);
      part(knee, "limb", p.shorts ? "skin" : "cloth", p.shorts ? p.skin : p.pants, 0, -SN.LOWER_LEG * 0.48, 0, 0.155, SN.LOWER_LEG + 0.06, 0.15);
      if (!p.shorts)
        part(knee, "panel", "cloth", p.pants, 0, -SN.LOWER_LEG * 0.72, 0.062, 0.1, 0.12, 0.018, 0, 0, 0, true);
      part(foot, p.shoes === "boot" ? "boot" : "shoe", "cloth", p.shoes === "boot" ? 0x2c2c2c : 0x2f3a44, 0, 0, 0, 1, 1, 1);
      // The sole slab bottom is exactly SOLE_DROP below the ankle joint, so an
      // ankle posed at ground height puts rubber on the surface, not through it.
      part(foot, "sole", "cloth", p.shoes === "boot" ? 0x3b3833 : 0xd7d5cb, 0, -(SN.ANKLE_Y - 0.0225), 0, 1, 1, 1);
      legs.push({ upper: hip, lower: knee, foot, planted: false, plantX: 0, plantZ: 0 });
    }
    // Large accessories survive middle-distance LOD; tiny seams disappear first.
    if (p.accessory === "briefcase")
      part(arms[0].hand, "panel", "cloth", p.accent, -0.02, -0.21, 0, 0.12, 0.3, 0.4);
    if (p.accessory === "camera") {
      accessories.cameraBody = part(torso, "panel", "cloth", 0x303e48, 0, 0.19, 0.17, 0.22, 0.14, 0.09);
      accessories.cameraLens = part(torso, "sphere", "glass", 0x9dc7cf, 0, 0.19, 0.245, 0.056, 0.056, 0.04);
      for (const side of [-1, 1])
        part(torso, "capsule", "cloth", p.accent, side * 0.1, 0.33, 0.12, 0.016, 0.25, 0.016, 0, 0, side * 0.3);
    }
    if (p.accessory === "cane") {
      part(arms[0].hand, "limb", "metal", 0xa18c6a, 0, -0.42, 0.02, 0.025, 0.85, 0.025);
      part(arms[0].hand, "capsule", "metal", 0x5b5245, 0, -0.015, 0.04, 0.034, 0.04, 0.14, 0, 0, SN.PI / 2);
    }
    if (p.accessory === "deliveryBox") {
      part(torso, "panel", "cloth", p.outer, 0, 0.25, -0.29, 0.45, 0.47, 0.35);
      part(torso, "panel", "cloth", p.accent, 0, 0.25, -0.468, 0.34, 0.1, 0.012);
      part(head, "sphere", "cloth", p.outer, 0, 0.15, -0.025, 0.145, 0.15, 0.14);
      part(head, "sphere", "glass", 0x9bb9bb, 0, 0.115, 0.085, 0.105, 0.042, 0.07);
    }
    if (p.accessory === "hardhat") {
      part(head, "sphere", "cloth", p.outer, 0, 0.21, -0.01, 0.15, 0.1, 0.15);
      part(head, "sphere", "cloth", p.outer, 0, 0.17, 0.075, 0.16, 0.018, 0.11);
      for (const side of [-1, 1])
        part(torso, "panel", "cloth", p.accent, side * 0.145, 0.26, 0.153, 0.055, 0.35, 0.014);
      part(torso, "panel", "cloth", p.accent, 0, 0.1, 0.16, 0.38, 0.06, 0.014);
    }
    if (p.accessory === "apron") {
      part(torso, "panel", "cloth", p.outer, 0, 0, 0.14, 0.34, 0.66, 0.028);
      part(torso, "panel", "cloth", p.accent, 0, 0.05, 0.158, 0.19, 0.1, 0.014);
    }
    if (p.accessory === "scarf") {
      part(torso, "chain", "cloth", p.accent, 0, 0.44, 0.02, 2.1, 2.1, 2.1, SN.PI / 2, 0, 0, true);
      part(torso, "panel", "cloth", p.accent, 0.08, 0.31, 0.145, 0.085, 0.24, 0.02);
    }
    if (p.accessory === "headphones") {
      for (const side of [-1, 1])
        part(head, "sphere", "cloth", p.accent, side * 0.128, 0.11, -0.005, 0.026, 0.042, 0.042);
      part(head, "chain", "cloth", p.accent, 0, 0.1, -0.005, 2.35, 2.35, 2.35, 0, 0, SN.PI / 2, true);
      part(torso, "capsule", "cloth", p.accent, 0.2, 0.31, 0.05, 0.018, 0.1, 0.018);
    }
    if (p.accessory === "earrings")
      for (const side of [-1, 1])
        part(head, "chain", "metal", p.accent, side * 0.121, 0.018, 0, 0.32, 0.48, 0.32, 0, 0, 0, true);
    if (p.accessory === "crewBand") {
      part(arms[0].upper, "limb", "cloth", p.accent, 0, -0.12, 0, 0.2, 0.075, 0.19);
      part(torso, "panel", "cloth", p.accent, 0.13, 0.25, 0.15, 0.04, 0.18, 0.012, 0, 0, p.archetype === "crew0" ? 0.4 : -0.4);
      part(torso, "panel", "cloth", p.accent, 0, 0.29, -0.17, 0.24, 0.08, 0.012);
    }
    const weapon = joint(arms[1].hand, 0, -0.075, 0);
    part(weapon, "box", "metal", 0x3b4a52, 0, -0.08, 0.02, 0.055, 0.19, 0.07).visible = true;
    const barrel = part(weapon, "box", "metal", 0x6a8791, 0, -0.18, 0.02, 0.085, 0.14, 0.11);
    root.scale.setScalar(height);
    for (const item of parts) item.wardrobeTone = item.geoName === "sole" ? "accent" :
      item.geoName === "shoe" || item.geoName === "boot" ? "shoe" : item.color === p.pants ? "pants" :
      item.color === p.outer ? "outer" : item.color === p.shirt ? "inner" : item.color === p.accent || p.player && [0xf0c45c, 0xe4edf2].includes(item.color) ? "accent" : "fixed";
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
        const soleGround = SN.groundUnder(leg.plantX, leg.plantZ, 0.115, rootY);
        const hToe = SN.groundUnder(leg.plantX + fx * 0.155, leg.plantZ + fz * 0.155, 0.05, rootY),
          hHeel = SN.groundUnder(leg.plantX - fx * 0.155, leg.plantZ - fz * 0.155, 0.05, rootY);
        slope = SN.clamp(Math.atan2(hToe - hHeel, 0.31), -0.62, 0.62);
        footY = SN.ANKLE_Y + (soleGround - rootY) / h - (SN.SOLE_DROP * (1 - Math.cos(slope))) / h;
      }
      else {
        const t = SN.clamp((q - duty) / (1 - duty), 0, 1), smooth = t * t * (3 - 2 * t);
        footZ = SN.lerp(-reach, reach, smooth);
        const lift = (0.07 + jog * 0.105 + run * 0.15) * w;
        const sx = r.root.position.x + fx * footZ, sz = r.root.position.z + fz * footZ;
        const swingGround = SN.groundUnder(sx, sz, 0.09, rootY);
        footY = Math.max(SN.ANKLE_Y + (swingGround - rootY) / h, SN.ANKLE_Y - 0.24) + Math.sin(t * SN.PI) * lift;
        leg.upper.rotation.z = 0;
        const hToe = SN.groundUnder(sx + fx * 0.155, sz + fz * 0.155, 0.05, rootY),
          hHeel = SN.groundUnder(sx - fx * 0.155, sz - fz * 0.155, 0.05, rootY);
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
    const aimWeight = r === SN.playerRig ? (m.aim || 0) : aim ? 1 : 0;
    const arm0x = r.arms[0].upper.rotation.x, arm0y = r.arms[0].upper.rotation.y, arm0z = r.arms[0].upper.rotation.z,
      arm1x = r.arms[1].upper.rotation.x, arm1y = r.arms[1].upper.rotation.y, arm1z = r.arms[1].upper.rotation.z,
      elbow0 = r.arms[0].lower.rotation.x, elbow1 = r.arms[1].lower.rotation.x;
    if (aimWeight > 0.001) {
      if (weapon === 2 || weapon === 4 || weapon === 5) {
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
      r.arms[0].upper.rotation.set(SN.lerp(arm0x, r.arms[0].upper.rotation.x, aimWeight), SN.lerp(arm0y, r.arms[0].upper.rotation.y, aimWeight), SN.lerp(arm0z, r.arms[0].upper.rotation.z, aimWeight));
      r.arms[1].upper.rotation.set(SN.lerp(arm1x, r.arms[1].upper.rotation.x, aimWeight), SN.lerp(arm1y, r.arms[1].upper.rotation.y, aimWeight), SN.lerp(arm1z, r.arms[1].upper.rotation.z, aimWeight));
      r.arms[0].lower.rotation.x = SN.lerp(elbow0, r.arms[0].lower.rotation.x, aimWeight);
      r.arms[1].lower.rotation.x = SN.lerp(elbow1, r.arms[1].lower.rotation.x, aimWeight);
    }
    if (attack > 0 && (weapon === 0 || weapon === 3)) {
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
      forward = c.spec.shape === "bus" ? c.spec.length * 0.33 : c.spec.shape === "van" ? c.spec.length * 0.3 : c.spec.length * 0.09;
    // c.body carries the suspension bob; without it the seated body visibly
    // shivers against the cabin while driving over uneven ground.
    const bob = c.body ? c.body.position.y : 0;
    r.root.position.set(c.root.position.x + Math.cos(c.root.rotation.y) * side + Math.sin(c.root.rotation.y) * forward, c.root.position.y + bob + 0.14, c.root.position.z - Math.sin(c.root.rotation.y) * side + Math.cos(c.root.rotation.y) * forward);
    r.root.rotation.order = "YXZ";
    r.root.rotation.set(c.pitch, c.root.rotation.y, c.terrainRoll + c.roll);
  };

  SN.flushActors = function flushActors() {
    for (const batch of SN.npcBatches)
      batch.count = 0;
    for (const a of SN.actors) {
      if (!a.active || a.modelAgent)
        continue;
      const actorDistance = Math.hypot(a.x - SN.player.x, a.z - SN.player.z);
      if (actorDistance > 150)
        continue;
      const r = a.rig;
      SN.actorCullSphere.center.set(a.x, SN.surfaceHeight(a.x, a.z) + 1.2, a.z);
      if (actorDistance > 16 && !SN.tileFrustum.intersectsSphere(SN.actorCullSphere)) continue;
      if (a.inCar) {
        if (!a.inCar.active || !a.inCar.root.visible)
          continue;
        SN.poseDriver(a, a.inCar);
      }
      else if (!a.bail) {
        r.root.position.set(a.x, SN.groundUnder(a.x, a.z, 0.2, r.root.position.y), a.z);
        r.root.rotation.y = a.yaw;
      }
      if (a.poseDirty || a.inCar || !a.matrixReady) {
        r.root.updateMatrixWorld(true);
        a.poseDirty = false;
        a.matrixReady = true;
      }
      const detailed = actorDistance <= (SN.qualityLevel() === 0 ? 18 : SN.qualityLevel() === 1 ? 26 : 35);
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

  SN.recoverFromWater = function recoverFromWater() {
    const p = SN.player;
    if (!SN.isWater(p.x, p.z, 0.12)) {
      if (p.grounded && !p.car && !p.vault && !SN.blocked(p.x, p.z, 0.32)) {
        if (!p.safeLand) p.safeLand = { x: p.x, z: p.z };
        p.safeLand.x = p.x; p.safeLand.z = p.z;
      }
      return false;
    }
    if (p.car) { p.car.speed = p.car.vx = p.car.vz = 0; p.car.parked = true; p.car = null; }
    const land = p.safeLand || { x: -40, z: -770 }, safe = SN.safePosition(land.x, land.z, 0.4);
    Object.assign(p, safe, { y: SN.groundUnder(safe.x, safe.z), vy: 0, speed: 0, motionSpeed: 0,
      grounded: true, vault: null, bail: null });
    p.fallPeak = p.y; SN.playerRoot.visible = true; SN.clearInput(); SN.snapPlayer();
    SN.toast("已回到安全岸边", 3); return true;
  };

  SN.tryVault = function tryVault() {
    const p = SN.player;
    if (!p.grounded || p.car || p.vault) return false;
    const dx = Math.sin(p.yaw), dz = Math.cos(p.yaw);
    SN.sightOrigin.set(p.x, p.y + 0.45, p.z); SN.sightDirection.set(dx, 0, dz);
    const hit = SN.solidRayDistance(SN.sightOrigin, SN.sightDirection, 1.25, 0.2);
    if (hit >= 1.25) return false;
    for (let distance = hit + 0.75; distance <= 3.25; distance += 0.25) {
      const x = p.x + dx * distance, z = p.z + dz * distance, y = SN.groundUnder(x, z);
      if (SN.blocked(x, z, 0.35) || Math.abs(y - p.y) > 0.4 ||
          SN.cars.some(c => c.active && SN.carCirclePush(x, z, 0.45, c))) continue;
      // A clear capsule above the obstacle prevents vaulting through walls or low roofs.
      SN.sightOrigin.set(p.x, Math.max(p.y, y) + 1.5, p.z);
      if (SN.solidRayDistance(SN.sightOrigin, SN.sightDirection, distance, 0.32) < distance) return false;
      p.vault = { x: p.x, z: p.z, y: p.y, toX: x, toZ: z, toY: y, time: 0, duration: 0.55 };
      SN.jumpBuffer = 0; p.grounded = false; SN.firing = SN.aiming = false;
      return true;
    }
    return false;
  };

  SN.updateVault = function updateVault(dt) {
    const p = SN.player, v = p.vault;
    if (!v) return false;
    v.time += dt;
    const t = SN.clamp(v.time / v.duration, 0, 1), blend = t * t * (3 - 2 * t);
    p.x = SN.lerp(v.x, v.toX, blend); p.z = SN.lerp(v.z, v.toZ, blend);
    p.y = SN.lerp(v.y, v.toY, blend) + Math.sin(t * SN.PI) * 1.3;
    p.speed = 0; p.vy = 0;
    SN.playerRoot.position.set(p.x, p.y, p.z);
    SN.poseRig(SN.playerRig, 0, 0, SN.simTime, true, false, 0, -1);
    SN.playerRig.torso.rotation.x = Math.sin(t * SN.PI) * 0.6;
    SN.playerRig.arms[0].upper.rotation.x = -1.6 * Math.sin(t * SN.PI);
    if (t >= 1) { p.vault = null; p.grounded = true; p.fallPeak = p.y; p.motionSpeed *= 0.5; }
    return true;
  };

  SN.playerMotion = function playerMotion(dt) {
    if (SN.recoverFromWater() || SN.updateVault(dt)) return;
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
    if (SN.jumpBuffer > 0 && moving && SN.tryVault()) { SN.updateVault(dt); return; }
    // Sub-step and resolve penetration so the body slides around walls instead of stopping dead.
    const vx = SN.player.moveX * SN.player.motionSpeed * dt, vz = SN.player.moveZ * SN.player.motionSpeed * dt;
    const stepLength = Math.hypot(vx, vz);
    if (stepLength > 0.000001) {
      const substeps = Math.min(5, Math.max(1, Math.ceil(stepLength / 0.32))), sx = vx / substeps, sz = vz / substeps;
      for (let i = 0; i < substeps; i++) {
        const nx = SN.player.x + sx, nz = SN.player.z + sz;
        if (Math.abs(nx) > SN.WORLD - 0.3 || Math.abs(nz) > SN.WORLD - 0.3 || SN.isWater(nx, nz, 0.28))
          break;
        const hit = SN.resolveCircle(nx, nz, 0.28, SN.player.y);
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
        const fixed = SN.resolveCircle(nx, nz, 0.28, SN.player.y);
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
    const floor = SN.groundUnder(SN.player.x, SN.player.z, 0.22, SN.player.y);
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
    SN.playerRoot.rotation.set(0, SN.player.yaw, 0);
    SN.advanceGait(SN.playerRig, moved, dt, SN.player.gait, SN.player.grounded && wasGrounded);
    SN.player.phase = SN.playerRig.motion.phase;
    SN.playerRig.motion.aim = SN.lerp(SN.playerRig.motion.aim || 0, aim || SN.firing ? 1 : 0, 1 - Math.exp(-dt * 16));
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
    SN.SHOULDER_X = 0.175;
    SN.SHOULDER_Y = 0.42;
    SN.HEAD_JOINT_Y = 0.52;
    SN.ARM_UPPER = 0.29;
    SN.ARM_LOWER = 0.27;
    SN.sphereGeo = new SN.T.SphereGeometry(1, 12, 9);
    SN.capsuleGeo = SN.merged([
      { g: new SN.T.CylinderGeometry(0.5, 0.5, 0.5, 12), x: 0, y: 0, z: 0 },
      { g: SN.sphereGeo, x: 0, y: 0.25, z: 0, sx: 0.5, sy: 0.25, sz: 0.5 },
      { g: SN.sphereGeo, x: 0, y: -0.25, z: 0, sx: 0.5, sy: 0.25, sz: 0.5 }
    ]);
    // Waist -> chest loft, flattened on Z when placed to get an oval torso.
    SN.torsoGeo = SN.characterTorso(true);
    // Shoe uppers are extruded from a real side profile and welded smooth; a separate
    // slab below carries the pale sole rubber.
    SN.shoeGeo = SN.characterShoe(true, false);
    SN.bootGeo = SN.characterShoe(true, true);
    SN.soleGeo = SN.characterSole(true);
    // Sculpted head: ellipsoid with a tapered jaw, brow ridge, nose, chin and ears.
    SN.headGeo = SN.characterHead(true);
    SN.hairShort = SN.characterHair("short", true);
    SN.hairUnder = SN.characterHair("undercut", true);
    SN.hairBob = SN.characterHair("bob", true);
    SN.hairPony = SN.characterHair("pony", true);
    SN.hairLong = SN.characterHair("long", true);
    SN.hatCap = SN.characterHair("cap", true);
    SN.hatBeanie = SN.characterHair("beanie", true);
    SN.glassesGeo = SN.merged([
      { g: new SN.T.TorusGeometry(0.034, 0.0055, 5, 12), x: 0.052, y: 0.104, z: 0.122 },
      { g: new SN.T.TorusGeometry(0.034, 0.0055, 5, 12), x: -0.052, y: 0.104, z: 0.122 },
      { g: SN.cylinder, x: 0, y: 0.108, z: 0.126, sx: 0.005, sy: 0.028, sz: 0.005, rz: SN.PI / 2 },
      { g: SN.cylinder, x: 0.103, y: 0.11, z: 0.096, sx: 0.006, sy: 0.078, sz: 0.006, rx: SN.PI / 2 },
      { g: SN.cylinder, x: -0.103, y: 0.11, z: 0.096, sx: 0.006, sy: 0.078, sz: 0.006, rx: SN.PI / 2 }
    ]);
    SN.chainGeo = new SN.T.TorusGeometry(0.055, 0.009, 5, 14);
    SN.printGeo = new SN.T.PlaneGeometry(0.15, 0.15);
    // Curled grip hand and relaxed open hand. The weapon group hangs from the wrist.
    SN.handGrip = SN.characterHand(true, true);
    SN.handOpen = SN.characterHand(true, false);
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
    // A single shared face texture. It only paints eyes, brows, nose shadow and
    // lips with alpha; the skin colour underneath comes from the tinted head mesh,
    // so every pedestrian still gets their own complexion.
    SN.faceCanvas = document.createElement("canvas");
    SN.faceCanvas.width = SN.faceCanvas.height = 256;
    {
      const g = SN.faceCanvas.getContext("2d");
      g.clearRect(0, 0, 256, 256);
      const eyeY = 108;
      for (const ex of [56, 200]) {
        g.fillStyle = "rgba(245,239,227,0.97)";
        g.beginPath();
        g.ellipse(ex, eyeY, 28, 9.5, 0, 0, SN.TAU);
        g.fill();
        g.fillStyle = "#4a3323";
        g.beginPath();
        g.arc(ex, eyeY + 0.5, 10, 0, SN.TAU);
        g.fill();
        g.fillStyle = "#12100d";
        g.beginPath();
        g.arc(ex, eyeY + 0.5, 4.6, 0, SN.TAU);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.92)";
        g.beginPath();
        g.arc(ex - 2.8, eyeY - 2.8, 2.2, 0, SN.TAU);
        g.fill();
        g.strokeStyle = "rgba(47,33,24,0.75)";
        g.lineWidth = 2.6;
        g.beginPath();
        g.ellipse(ex, eyeY, 28, 9.5, 0, Math.PI * 1.04, Math.PI * 1.96);
        g.stroke();
        g.strokeStyle = "rgba(46,32,23,0.7)";
        g.lineWidth = 5.4;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(ex - 28, 87);
        g.quadraticCurveTo(ex, 79, ex + 28, 88);
        g.stroke();
      }
      const nose = g.createLinearGradient(126, 116, 132, 170);
      nose.addColorStop(0, "rgba(120,78,54,0)");
      nose.addColorStop(0.55, "rgba(110,70,48,0.24)");
      nose.addColorStop(1, "rgba(88,54,38,0.12)");
      g.fillStyle = nose;
      g.beginPath();
      g.moveTo(120, 116);
      g.quadraticCurveTo(112, 150, 120, 168);
      g.lineTo(136, 168);
      g.quadraticCurveTo(142, 148, 136, 118);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(92,57,40,0.5)";
      g.lineWidth = 3;
      g.lineCap = "round";
      for (const side of [-1, 1]) {
        g.beginPath();
        g.arc(128 + side * 8, 167, 5.5, side < 0 ? Math.PI * 0.9 : Math.PI * 1.7, side < 0 ? Math.PI * 1.9 : Math.PI * 0.9);
        g.stroke();
      }
      g.strokeStyle = "rgba(122,62,58,0.78)";
      g.lineWidth = 4.2;
      g.beginPath();
      g.moveTo(107, 198);
      g.quadraticCurveTo(128, 204, 149, 198);
      g.stroke();
      g.strokeStyle = "rgba(168,94,86,0.36)";
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(111, 205);
      g.quadraticCurveTo(128, 210, 145, 205);
      g.stroke();
    }
    SN.faceTexture = SN.canvasTexture(SN.faceCanvas);
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
      limb: SN.characterLimb(true),
      torso: SN.torsoGeo,
      skirt: SN.characterSkirt(true),
      shoe: SN.shoeGeo,
      boot: SN.bootGeo,
      sole: SN.soleGeo,
      handGrip: SN.handGrip,
      handOpen: SN.handOpen,
      head: SN.headGeo,
      face: SN.characterFace(true),
      hairShort: SN.hairShort,
      hairUnder: SN.hairUnder,
      hairBob: SN.hairBob,
      hairPony: SN.hairPony,
      hairLong: SN.hairLong,
      hatCap: SN.hatCap,
      hatBeanie: SN.hatBeanie,
      glasses: SN.glassesGeo,
      chain: SN.chainGeo,
      print: SN.printGeo,
      panel: SN.roundedBox(1, 1, 1, 0.3, 3)
    };
    SN.prepareCrowdGeometry();
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
      face: SN.mat(0xffffff, {
        map: SN.faceTexture,
        transparent: true,
        alphaTest: 0.02,
        depthWrite: false,
        roughness: 0.78,
        metalness: 0,
        envMapIntensity: 0.2,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      }),
      print: SN.mat(0xffffff, { map: SN.printTexture, transparent: true, roughness: 0.9, side: SN.T.DoubleSide }),
      glass: SN.mat(0xffffff, { metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.5, envMapIntensity: 1.3 })
    };
    SN.faceMaterial = SN.mat(0xffffff, {
      map: SN.faceTexture,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      roughness: 0.78,
      metalness: 0,
      envMapIntensity: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
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
    SN.rigMatRough = { skin: 0.6, cloth: 0.9, hair: 0.76, metal: 0.3, eye: 0.2, face: 0.78, print: 0.88, glass: 0.15 };
    SN.printPartMaterials = new Map();
    // Pedestrian archetypes are pooled identities, never rebuilt while walking into view.
    // Students are adult academy commuters. Palettes and accessory silhouettes are original.
    SN.pedestrianArchetypes = {
      office: {
        label: "上班族",
        pool: 18,
        outfit: "jacket",
        hair: ["short", "bob", "pony", "long"],
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
        hair: ["cap", "bob", "short", "beanie"],
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
        outer: [0xf0b32f, 0xffcb45],
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
        hair: ["cap", "bob", "short", "beanie"],
        outer: [0xcf5a42, 0xb94338],
        shirt: [0xf3e0b5, 0xffefd0],
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
        hair: ["pony", "undercut", "bob", "short", "long", "beanie"],
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
      shirt: 0xffd259,
      outer: 0x137fba,
      pants: 0x78869b,
      hairColor: 0x1b2120,
      accent: 0xffcf63,
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
