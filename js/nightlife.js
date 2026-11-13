/* 弘大街区的夜间酒吧：霓虹门面、吧台客人与钢管舞舞台。 */
"use strict";
(function (SN) {
  SN.nightBar = null;
  // The main loop calls this every frame; stays a no-op until the bar is built.
  SN.updateNightBar = function updateNightBar() {};
  // Bar guests are drawn through the instanced pedestrian batches, so their own
  // rigs stay hidden; this appends them after the street crowd has been flushed.
  SN.flushNightBar = function flushNightBar() {
    const bar = SN.nightBar;
    if (!bar || !bar.shown)
      return;
    bar.dropped = 0;
    for (const r of bar.shown) {
      r.root.updateMatrixWorld(true);
      for (const p of r.parts) {
        if (!p.mesh.visible || p.mesh.parent === r.weapon && !r.weapon.visible)
          continue;
        const batch = SN.npcBatchMap.get(p.batchKey);
        if (!batch || batch.count >= batch.capacity) {
          bar.dropped++;
          continue;
        }
        const i = batch.count++;
        batch.mesh.setMatrixAt(i, p.mesh.matrixWorld);
        batch.mesh.setColorAt(i, p.colorObject);
      }
    }
  };

  SN.registerInit(21.5, function initializeNightBar() {
    const bx = -1867, bz = -556;
    const ground = SN.footprintTerrain(bx, bz, 20, 14);
    if (!ground.buildable || SN.isWater(bx, bz, 20))
      return;
    // The Hongdae busking square paves this corner of the block. Sit the room
    // 2 cm above that paving instead of leaving the floor under it, which
    // buried the dance-floor inlay and sank every guest to the ankles.
    const plazaTop = SN.surfaceHeight(-1900, -570) + 0.05;
    const gy = Math.max(ground.high + 0.12, plazaTop + 0.02 - 0.18);
    const floorTop = gy + 0.18, stageTop = gy + 0.46;
    const g = SN.cityGroup(bx, bz, 1500, gy);

    // Two extra neon tints live beside the shared palette so they can be batched
    // with the other landmark geometry instead of becoming loose meshes.
    if (!SN.cityPalette.neonPink) {
      SN.cityPalette.neonPink = SN.pbrMat("paint", 0xff4d9a, { uvScale: 0.5, emissive: 0xff2f80, emissiveIntensity: 1.3, roughness: 0.45 });
      SN.cityPalette.neonCyan = SN.pbrMat("paint", 0x53e6d9, { uvScale: 0.5, emissive: 0x2fd0c2, emissiveIntensity: 1.1, roughness: 0.5 });
      SN.cityPalette.lampWarm = SN.pbrMat("paint", 0xffe3b8, { uvScale: 0.5, emissive: 0xffd39a, emissiveIntensity: 1.7, roughness: 0.55 });
      SN.cityPalette.barFloor = SN.pbrMat("wood", 0x4d3628, { uvScale: 0.9, roughness: 0.94 });
      SN.cityPalette.barWall = SN.pbrMat("wood", 0x3a2830, { uvScale: 0.8, roughness: 0.9 });
      SN.neonMats.push(SN.cityPalette.neonPink, SN.cityPalette.neonCyan, SN.cityPalette.lampWarm);
    }

    // ---------- shell ----------
    SN.cityPart(g, "stone", 0, 0.08, 0, 20, 0.18, 14);
    SN.cityPart(g, "barFloor", 0, 0.17, 0, 19.4, 0.02, 13.4);
    SN.cityPart(g, "dark", 0, 4.85, 0, 20.6, 0.35, 15.2);
    SN.cityPart(g, "barWall", 0, 4.6, 0, 19, 0.12, 13);
    SN.cityPart(g, "barWall", 0, 2.35, 6.7, 19.4, 4.7, 0.6);
    SN.cityPart(g, "barWall", 0, 1.35, 6.34, 19, 2.7, 0.12);
    SN.citySolid(g, 0, 6.7, 19.4, 0.6, 4.7);
    for (const side of [-1, 1]) {
      SN.cityPart(g, "barWall", side * 9.7, 2.35, 0, 0.6, 4.7, 13.4);
      SN.cityPart(g, "barWall", side * 9.34, 1.35, 0, 0.12, 2.7, 13);
      SN.cityPart(g, "neonCyan", side * 9.28, 2.72, 0, 0.05, 0.06, 12.4);
      SN.citySolid(g, side * 9.7, 0, 0.6, 13.4, 4.7);
    }
    // Warm ceiling panels carry the room's own light and read from the street.
    for (let i = 0; i < 6; i++)
      SN.cityPart(g, "lampWarm", -7 + i * 2.8, 4.52, i % 2 ? 4 : 1.4, 2.1, 0.06, 1.2);
    // Front: gold columns, glass bays and a wide open doorway in the middle.
    for (const cx of [-9.2, -2.9, 2.9, 9.2]) {
      SN.cityPart(g, "gold", cx, 2.35, -6.7, 0.7, 4.7, 0.7);
      SN.cityPart(g, "neonPink", cx, 2.2, -7.07, 0.1, 3.5, 0.1);
      SN.citySolid(g, cx, -6.7, 0.7, 0.7, 4.7);
    }
    for (const side of [-1, 1]) {
      const cx = side * 6.05;
      SN.cityPart(g, "glass", cx, 2.05, -6.7, 5.5, 3.5, 0.12);
      SN.cityPart(g, "dark", cx, 0.32, -6.7, 5.7, 0.5, 0.32);
      SN.cityPart(g, "neonPink", cx, 3.92, -6.7, 5.5, 0.09, 0.18);
      SN.citySolid(g, cx, -6.7, 5.7, 0.3, 3.9);
    }
    SN.cityPart(g, "cream", 0, 4.2, -6.7, 8.6, 0.85, 0.5);
    SN.cityPart(g, "neonCyan", 0, 4.2, -6.98, 8.2, 0.07, 0.08);
    // Canopy and the two shallow steps up from the pavement.
    SN.cityPart(g, "glass", 0, 3.5, -8.1, 9.4, 0.16, 2.8);
    SN.cityPart(g, "gold", 0, 3.42, -9.46, 9.6, 0.22, 0.22);
    for (const side of [-1, 1])
      SN.cityPart(g, "gold", side * 4.5, 1.75, -9.3, 0.12, 3.4, 0.12);
    SN.cityPart(g, "stone", 0, -0.03, -8.5, 9.6, 0.18, 2);
    SN.cityPart(g, "stone", 0, 0.09, -7.05, 9.6, 0.18, 1.3);
    for (const side of [-1, 1])
      SN.cityPart(g, "stone", side * 6.5, 0.3, -8.2, 1.3, 0.7, 1.3);
    // Roof sign: a warm pink neon board above the whole facade.
    SN.sign("홍대 나이트 · 弘大夜店 · BAR", bx, gy + 5.55, bz - 7.15, 15, 2.1, SN.PI, true);

    // ---------- bar ----------
    SN.cityPart(g, "dark", -4.6, 0.57, 5.1, 10.6, 1.14, 1.2);
    SN.cityPart(g, "wood", -4.6, 1.2, 5.1, 11.2, 0.12, 1.55);
    SN.cityPart(g, "red", -4.6, 0.48, 4.48, 10.8, 0.72, 0.08);
    SN.cityPart(g, "neonPink", -4.6, 0.14, 4.46, 10.8, 0.06, 0.05);
    SN.cityPart(g, "silver", -4.6, 0.3, 4.35, 10.6, 0.06, 0.06);
    SN.citySolid(g, -4.6, 5.1, 11.2, 1.55, 1.3);
    SN.cityPart(g, "dark", -4.2, 2.35, 6.4, 10.4, 1.8, 0.3);
    for (const sy of [1.6, 2.3])
      SN.cityPart(g, "wood", -4.2, sy, 6.25, 10, 0.06, 0.4);
    SN.cityPart(g, "neonPink", -4.2, 3.1, 6.2, 9.8, 0.06, 0.06);
    SN.cityPart(g, "neonCyan", -4.2, 1.55, 6.2, 9.8, 0.05, 0.06);
    for (let i = 0; i < 14; i++) {
      const key = ["teal", "red", "cream", "gold"][i % 4], x = -8.7 + i * 0.68, row = i % 2;
      SN.cityPart(g, key, x, 1.8 + row * 0.7, 6.22, 0.16, 0.34, 0.16);
      SN.cityPart(g, "silver", x, 1.99 + row * 0.7, 6.22, 0.07, 0.05, 0.07);
    }

    // ---------- stage ----------
    SN.cityPart(g, "dark", 5.2, 0.32, 3, 7.2, 0.28, 5.4);
    SN.cityPart(g, "wood", 5.2, 0.45, 3, 7.1, 0.02, 5.3);
    SN.cityPart(g, "neonPink", 5.2, 0.3, 0.31, 7, 0.07, 0.08);
    SN.cityPart(g, "neonCyan", 5.2, 0.46, 0.32, 7, 0.04, 0.04);
    for (const side of [-1, 1]) {
      SN.cityPart(g, "dark", side < 0 ? 1.7 : 8.7, 1.15, 4.85, 0.8, 1.4, 0.75);
      SN.cityPart(g, "silver", side < 0 ? 1.7 : 8.7, 1.92, 4.85, 0.5, 0.1, 0.5);
    }
    SN.cityPart(g, "dark", 5.2, 0.95, 4.95, 3.4, 0.95, 0.7);
    SN.cityPart(g, "neonCyan", 5.2, 1.47, 4.95, 3.1, 0.06, 0.5);
    SN.cityPart(g, "dark", 5.2, 3.05, 6.35, 8, 2.4, 0.14);
    for (let i = 0; i < 5; i++)
      SN.cityPart(g, i % 2 ? "neonPink" : "neonCyan", 2.2 + i * 1.5, 3.05, 6.26, 0.75, 2.1, 0.05);

    // Steel pole through the stage up into the ceiling.
    const steel = SN.cityPalette.silver;
    const pole = new SN.T.Mesh(new SN.T.CylinderGeometry(0.085, 0.085, 4.2, 12), steel);
    pole.position.set(5.2, 2.56, 3.2);
    pole.castShadow = true;
    g.add(pole);
    const poleBase = new SN.T.Mesh(new SN.T.CylinderGeometry(0.52, 0.58, 0.06, 18), steel);
    poleBase.position.set(5.2, 0.49, 3.2);
    g.add(poleBase);
    SN.glow(SN.scene, bx + 5.2, floorTop + 2.5, bz + 3.2, 1.35, 0xff9ad0);

    // ---------- lounge tables ----------
    const tableMat = SN.cityPalette.wood, legMat = SN.cityPalette.dark;
    const tables = [[-6.2, -2.4], [-1.6, -3.4]];
    for (const [tx, tz] of tables) {
      const top = new SN.T.Mesh(new SN.T.CylinderGeometry(0.62, 0.62, 0.08, 16), tableMat);
      top.position.set(tx, 1.04, tz);
      top.castShadow = true;
      g.add(top);
      const stem = new SN.T.Mesh(new SN.T.CylinderGeometry(0.08, 0.08, 0.98, 8), legMat);
      stem.position.set(tx, 0.52, tz);
      g.add(stem);
      const foot = new SN.T.Mesh(new SN.T.CylinderGeometry(0.34, 0.36, 0.06, 12), legMat);
      foot.position.set(tx, 0.05, tz);
      g.add(foot);
      SN.citySolid(g, tx, tz, 1.24, 1.24, 1.1);
      for (let k = 0; k < 3; k++) {
        const a = k * SN.TAU / 3 + 0.4, sax = Math.cos(a) * 1.08, saz = Math.sin(a) * 1.08;
        SN.cityPart(g, "dark", tx + sax, 0.31, tz + saz, 0.34, 0.62, 0.34);
        SN.cityPart(g, "wood", tx + sax, 0.64, tz + saz, 0.38, 0.06, 0.38);
      }
      for (let k = 0; k < 2; k++) {
        const dx = k ? 0.2 : -0.22, dz = k ? 0.18 : 0.12;
        const cup = new SN.T.Mesh(new SN.T.CylinderGeometry(0.05, 0.04, 0.14, 8), SN.mat(0xcdeef8, { transparent: true, opacity: 0.7, roughness: 0.2 }));
        cup.position.set(tx + dx, 1.14, tz + dz);
        g.add(cup);
      }
    }

    // ---------- dance floor ----------
    // A dark, glossy inlay separates the dance floor from the pale timber room and
    // gives the neon its own reflective surface to sit on.
    SN.cityPart(g, "dark", 1.2, 0.189, -2.2, 5.2, 0.018, 4.6);
    SN.cityPart(g, "neonPink", 1.2, 0.206, 0.08, 5.2, 0.015, 0.07);
    SN.cityPart(g, "neonCyan", 1.2, 0.206, -4.48, 5.2, 0.015, 0.07);
    for (const side of [-1, 1]) {
      SN.cityPart(g, "neonPink", 1.2 + side * 2.57, 0.206, -2.2, 0.07, 0.015, 4.6);
      SN.cityPart(g, "teal", 1.2 + side * 1.05, 0.204, -2.2, 0.06, 0.012, 3.6);
    }
    // Speaker stacks: twin cabinets flanking the stage plus a pair by the booth.
    for (const [sx, sz, rot] of [[1.95, 0.9, 0], [8.45, 0.9, 0], [3.05, 5.95, 1], [7.35, 5.95, 1]]) {
      const tall = rot ? 1.05 : 1.35;
      SN.cityPart(g, "dark", sx, tall / 2 + 0.19, sz, 0.62, tall, 0.58);
      for (const wy of [0.55, 0.95])
        for (const wx of [-0.17, 0.17]) {
          SN.cityPart(g, "silver", sx + wx, tall / 2 + 0.19 + (wy - 0.72) * 0.9, sz - 0.31, 0.16, 0.16, 0.02);
          SN.cityPart(g, "neonCyan", sx + wx, tall / 2 + 0.19 + (wy - 0.72) * 0.9, sz - 0.325, 0.1, 0.1, 0.012);
        }
      SN.citySolid(g, sx, sz, 0.66, 0.62, tall + 0.19);
    }
    // Poster lightboxes and a neon cocktail on the side wall.
    for (const [pz, key, y] of [[-2.6, "teal", 2.55], [0.6, "red", 2.55], [-4.6, "gold", 2.4]]) {
      SN.cityPart(g, "dark", -9.25, y, pz, 0.06, 1.75, 2.5);
      SN.cityPart(g, key, -9.2, y, pz, 0.04, 1.5, 2.26);
      SN.cityPart(g, "cream", -9.17, y + 0.5, pz, 0.03, 0.16, 1.7);
      SN.cityPart(g, "neonPink", -9.16, y - 0.1, pz, 0.03, 0.1, 1.2);
    }
    // The east wall is what the room camera faces; give it the same lit posters
    // so the dance floor is not backed by a bare purple plane.
    for (const [pz, key] of [[-3.2, "gold"], [-0.4, "red"], [2.4, "teal"]]) {
      SN.cityPart(g, "dark", 9.22, 1.9, pz, 0.06, 1.5, 2.1);
      SN.cityPart(g, key, 9.18, 1.9, pz, 0.04, 1.28, 1.86);
      SN.cityPart(g, "cream", 9.16, 2.36, pz, 0.03, 0.14, 1.4);
    }
    SN.cityPart(g, "neonCyan", 9.24, 2.6, -2.2, 0.05, 2.2, 0.09);
    SN.cityPart(g, "neonPink", 9.24, 1.4, -2.2, 0.05, 0.09, 2.4);
    // Ceiling truss with clamps: reads as a club rig rather than a bare slab.
    for (const tz of [-4.2, 0.2]) {
      SN.cityPart(g, "dark", 0, 4.42, tz, 18.4, 0.14, 0.18);
      for (let i = 0; i < 7; i++) {
        SN.cityPart(g, "silver", -8.4 + i * 2.8, 4.32, tz, 0.09, 0.12, 0.3);
        SN.cityPart(g, "lampWarm", -8.4 + i * 2.8, 4.26, tz - 0.14, 0.12, 0.12, 0.12);
      }
    }

    // ---------- mirror ball and sweeping beams ----------
    const beamTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d"), img = ctx.createImageData(64, 64);
      for (let x = 0; x < 64; x++) {
        const a = Math.pow(0.5 + 0.5 * Math.sin(x / 64 * Math.PI * 10), 3) * 190;
        for (let y = 0; y < 64; y++) {
          const i = (y * 64 + x) * 4;
          img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = a;
        }
      }
      ctx.putImageData(img, 0, 0);
      const t = new SN.T.CanvasTexture(c);
      t.wrapS = t.wrapT = SN.T.RepeatWrapping;
      return t;
    })();
    const spotTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d"), gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,0.95)");
      gr.addColorStop(0.4, "rgba(255,255,255,0.32)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 64, 64);
      return new SN.T.CanvasTexture(c);
    })();
    const ball = new SN.T.Mesh(new SN.T.SphereGeometry(0.42, 18, 12),
      SN.mat(0xdfe7ff, { metalness: 0.92, roughness: 0.18, emissive: 0x2a3b66, emissiveIntensity: 0.55 }));
    ball.position.set(bx + 1.2, floorTop + 3.62, bz - 2.2);
    ball.castShadow = true;
    SN.scene.add(ball);
    SN.nightBarBall = ball;
    SN.glow(SN.scene, bx + 1.2, floorTop + 3.66, bz - 2.2, 0.85, 0xbfd4ff);
    const beams = [];
    for (const [color, phase, lean] of [[0xff5aa2, 0, 0.18], [0x53e6d9, 2.1, -0.14]]) {
      const cone = new SN.T.Mesh(new SN.T.ConeGeometry(2.5, 4.1, 24, 1, true),
        new SN.T.MeshBasicMaterial({ color, map: beamTex, transparent: true, opacity: 0.3, blending: SN.T.AdditiveBlending, depthWrite: false, side: SN.T.DoubleSide }));
      cone.position.set(bx + 1.2, floorTop + 1.9, bz - 2.2);
      cone.rotation.z = lean;
      SN.scene.add(cone);
      beams.push({ mesh: cone, phase });
    }
    const spots = [];
    for (let i = 0; i < 4; i++) {
      const spot = new SN.T.Mesh(new SN.T.PlaneGeometry(2.6, 2.6),
        new SN.T.MeshBasicMaterial({ color: i % 2 ? 0x53e6d9 : 0xff5aa2, map: spotTex, transparent: true, opacity: 0.5, blending: SN.T.AdditiveBlending, depthWrite: false }));
      spot.rotation.x = -SN.PI / 2;
      spot.position.set(bx + 1.2, floorTop + 0.03, bz - 2.2);
      SN.scene.add(spot);
      spots.push({ mesh: spot, phase: i * Math.PI / 2 });
    }

    SN.finishCityGroup(g);
    // Self-lit lettering keeps the back wall readable in the dark room.
    SN.sign("NIGHT CLUB", bx + 5.2, gy + 3.6, bz + 6.18, 7.2, 1.05, SN.PI, true);
    SN.sign("BAR", bx - 4.6, gy + 3.62, bz + 6.22, 4, 0.8, SN.PI, true);
    // Walkable floors: the entrance apron, the step, the room and the stage.
    SN.rasterSurface(bx - 4.8, bx + 4.8, bz - 9.4, bz - 7.6, () => true, () => gy + 0.06, 2);
    SN.rasterSurface(bx - 4.8, bx + 4.8, bz - 7.6, bz - 6.4, () => true, () => floorTop, 2);
    SN.rasterSurface(bx - 9.4, bx + 9.4, bz - 6.4, bz + 6.4, () => true, () => floorTop, 2);
    SN.rasterSurface(bx + 1.6, bx + 8.8, bz + 0.3, bz + 5.7, () => true, () => stageTop, 2);

    // Warm interior light plus pink stage wash; enabled only near the venue.
    const lampWarm = new SN.T.PointLight(0xffc98a, 1.7, 22, 2);
    lampWarm.position.set(bx - 4, floorTop + 3.2, bz + 2.5);
    lampWarm.visible = false;
    SN.scene.add(lampWarm);
    const lampPink = new SN.T.PointLight(0xff5aa2, 1.7, 17, 2);
    lampPink.position.set(bx + 5, floorTop + 3.1, bz + 3);
    lampPink.visible = false;
    SN.scene.add(lampPink);
    const lampAmber = new SN.T.PointLight(0xffb46e, 1.1, 15, 2);
    lampAmber.position.set(bx - 2, floorTop + 2.9, bz - 4);
    lampAmber.visible = false;
    SN.scene.add(lampAmber);
    // Downlights sit right under the ceiling; anything lower reads as floating balls.
    for (const [lx, lz, color] of [[-7, 4.6, 0xffb46e], [-3, 1.2, 0xffd0a0], [1.5, -4, 0xff7ab8], [6.5, 2.4, 0x9ff3e8], [-6.5, -4.5, 0xffd0a0], [4, -5.5, 0xff8fc4]])
      SN.glow(SN.scene, bx + lx, floorTop + 4.36, bz + lz, 0.26, color);
    for (let i = 0; i < 8; i++)
      SN.glow(SN.scene, bx - 4.6 + i * 1.3, floorTop + 4.34, bz + 2.6, 0.2, i % 2 ? 0xffb0d0 : 0xffe2b0);

    // ---------- people ----------
    const seed = SN.seed;
    const drinkMat = SN.mat(0xffb64a, { transparent: true, opacity: 0.88, roughness: 0.25, metalness: 0.05 });
    const people = [];
    const dress = {
      patron: () => ({ shirt: 0x2c2f3e, outer: 0x3b3550, accent: 0xff7fb1 }),
      dancer: () => ({ shirt: 0x1f1a28, outer: 0x0f0d14, accent: 0xffd36e, skirt: true, skirtColor: 0x241c2c, men: false }),
      staff: () => ({ shirt: 0x1a1d22, outer: 0x2b2c33, accent: 0xe9d8b0 })
    };
    const person = (px, pz, pyaw, role, index, opts) => {
      const base = SN.makeProfile(index, "civilian", -1, role === "staff" ? "worker" : "nightlife");
      const profile = Object.assign({}, base, dress[role === "dancer" ? "dancer" : role === "staff" ? "staff" : "patron"](), opts || {});
      const rig = SN.makeRig(profile.outer, profile.skin, 1, profile);
      rig.weapon.visible = false;
      rig.root.rotation.y = pyaw;
      rig.root.position.set(px, role === "dancer" || role === "dj" ? stageTop : floorTop, pz);
      SN.scene.add(rig.root);
      rig.root.visible = false;
      const entry = { rig, role, x: px, z: pz, yaw: pyaw, phase: index * 1.37, drink: null };
      if (role === "patron" || role === "staff") {
        const glass = SN.meshAt(new SN.T.CylinderGeometry(0.04, 0.032, 0.12, 8), drinkMat, 0, 0, 0, 1, 1, 1, 0);
        glass.visible = false;
        entry.drink = glass;
      }
      people.push(entry);
      return entry;
    };
    const patrons = [];
    const counterXs = [-8.2, -6.5, -4.8, -3.1, -1.4, 0.3];
    counterXs.forEach((x, i) => patrons.push(person(bx + x, bz + 3.7, 0, "patron", 301 + i)));
    patrons.push(person(bx - 6.2, bz - 1.15, SN.PI, "patron", 321, { skirt: true, skirtColor: 0x3a2c3c }));
    patrons.push(person(bx - 6.2, bz - 3.65, 0, "patron", 322, { glasses: true }));
    patrons.push(person(bx - 1.6, bz - 2.15, SN.PI, "patron", 323, { skirt: true, skirtColor: 0x2c2636 }));
    patrons.push(person(bx - 1.6, bz - 4.65, 0, "patron", 324));
    const dancers = [
      person(bx + 5.82, bz + 3.2, -SN.PI / 2, "dancer", 341),
      person(bx + 4.58, bz + 3.2, SN.PI / 2, "dancer", 342)
    ];
    const floorDancers = [
      person(bx + 3.4, bz + 0.1, -SN.PI / 2, "floor", 371, { skirt: true, skirtColor: 0x2e2438 }),
      person(bx + 6.9, bz - 0.8, SN.PI / 2, "floor", 372),
      person(bx + 2.4, bz - 1.7, 0.4, "floor", 373, { skirt: true, skirtColor: 0x1f2b33 })
    ];
    const dj = person(bx + 5.2, bz + 5.35, SN.PI, "dj", 351, { accessory: "headphones", accent: 0x53e6d9, men: true });
    const bartender = person(bx - 4.2, bz + 6.12, SN.PI, "staff", 361, { accessory: "apron", men: true });
    SN.seed = seed;
    SN.nightBar = {
      x: bx, z: bz, gy, floorTop, stageTop, group: g,
      pole: { x: bx + 5.2, z: bz + 3.2 },
      ball, beams, spots, danceX: bx + 1.2, danceZ: bz - 2.2,
      people, patrons, dancers, floorDancers, dj, bartender,
      shown: [], lamps: [lampWarm, lampPink, lampAmber], lightsOn: false
    };

    SN.updateNightBar = function updateNightBar(dt, time) {
      const bar = SN.nightBar, p = SN.player;
      const distance = Math.hypot(p.x - bar.x, p.z - bar.z);
      const near = distance < 120;
      bar.lamps[0].visible = bar.lamps[1].visible = bar.lamps[2].visible = distance < 44;
      const inRoom = distance < 40;
      bar.ball.visible = inRoom;
      bar.ball.rotation.y = time * 0.7;
      bar.ball.rotation.z = Math.sin(time * 0.4) * 0.12;
      bar.beams[0].mesh.visible = bar.beams[1].mesh.visible = inRoom;
      if (inRoom) {
        bar.beams[0].mesh.rotation.y = time * 0.55;
        bar.beams[1].mesh.rotation.y = -time * 0.43 + 1.4;
        const pulse = 0.24 + Math.max(0, Math.sin(time * 2.6)) * 0.12;
        bar.beams[0].mesh.material.opacity = pulse;
        bar.beams[1].mesh.material.opacity = 0.36 - pulse * 0.35;
        bar.spots.forEach((s, i) => {
          const a = time * 0.42 + s.phase, r = 1.5;
          s.mesh.visible = true;
          s.mesh.position.set(bar.danceX + Math.cos(a) * r, bar.floorTop + 0.03, bar.danceZ + Math.sin(a) * r);
          s.mesh.material.opacity = 0.34 + Math.abs(Math.sin(time * 1.8 + i)) * 0.26;
        });
      } else {
        for (const s of bar.spots) s.mesh.visible = false;
      }
      bar.shown.length = 0;
      if (!near)
        for (const entry of bar.people)
          if (entry.drink) entry.drink.visible = false;
      if (!near)
        return;
      for (const entry of bar.people) {
        const r = entry.rig;
        bar.shown.push(r);
        if (entry.role === "dancer") {
          const i = bar.dancers.indexOf(entry);
          const ang = time * (0.62 + i * 0.14) + i * SN.PI;
          const px = bar.pole.x + Math.cos(ang) * 0.62, pz = bar.pole.z + Math.sin(ang) * 0.62;
          r.root.position.set(px, bar.stageTop, pz);
          r.root.rotation.y = Math.atan2(bar.pole.x - px, bar.pole.z - pz);
          SN.poseRig(r, 0, 0, time + i, false, false, 0, -1);
          const swing = Math.sin(time * 1.7 + i * 2.1);
          r.arms[0].upper.rotation.set(-0.1, 0.2, 2.85);
          r.arms[0].lower.rotation.set(-0.2, 0, 0);
          r.arms[1].upper.rotation.set(-0.35 + swing * 0.22, 0.25, -1.15);
          r.arms[1].lower.rotation.set(-0.58, 0, 0);
          r.legs[0].upper.rotation.set(0.08, 0, 0.12);
          r.legs[1].upper.rotation.set(-0.32 - Math.max(0, swing) * 0.22, 0, -0.08);
          r.legs[1].lower.rotation.set(0.48 + Math.max(0, swing) * 0.28, 0, 0);
          r.torso.rotation.z = swing * 0.17;
        }
        else if (entry.role === "dj") {
          SN.poseRig(r, 0, 0, time, false, false, 0, -1);
          const beat = Math.sin(time * 5.2);
          r.arms[0].upper.rotation.set(-1.55 + beat * 0.35, 0, 0.28);
          r.arms[1].upper.rotation.set(-1.55 - beat * 0.35, 0, -0.28);
          r.arms[0].lower.rotation.set(-0.85 - beat * 0.25, 0, 0);
          r.arms[1].lower.rotation.set(-0.85 + beat * 0.25, 0, 0);
          r.torso.rotation.x = -0.08 + Math.abs(beat) * 0.05;
          r.head.rotation.x = -0.15 + beat * 0.06;
        }
        else if (entry.role === "floor") {
          const beat = Math.sin(time * 2.6 + entry.phase);
          r.root.rotation.y = entry.yaw + Math.sin(time * 0.7 + entry.phase) * 0.5;
          SN.poseRig(r, 0, 0, time + entry.phase, false, false, 0, -1);
          r.torso.position.y = SN.TORSO_Y - 0.03 + Math.abs(beat) * 0.035;
          r.arms[0].upper.rotation.set(-1.95 + beat * 0.5, 0, 0.5);
          r.arms[1].upper.rotation.set(-1.95 - beat * 0.5, 0, -0.5);
          r.arms[0].lower.rotation.set(-0.65, 0, 0);
          r.arms[1].lower.rotation.set(-0.65, 0, 0);
          r.legs[0].upper.rotation.set(-0.08, 0, 0.09);
          r.legs[1].upper.rotation.set(-0.08, 0, -0.09);
          r.torso.rotation.z = beat * 0.06;
          r.head.rotation.x = -0.08;
        }
        else if (entry.role === "staff") {
          SN.poseRig(r, 0, 0, time + entry.phase, false, false, 0, -1);
          const wipe = Math.sin(time * 2.4);
          r.arms[0].upper.rotation.set(-0.95, 0, 0.16);
          r.arms[0].lower.rotation.set(-0.62, 0, wipe * 0.28);
          r.arms[1].upper.rotation.set(-0.3, 0, -0.24);
          r.arms[1].lower.rotation.set(-0.5, 0, 0);
          r.torso.rotation.z = wipe * 0.03;
        }
        else {
          // Patrons sway to the music and lift their glass now and then.
          const lift = Math.max(0, Math.sin(time * 0.72 + entry.phase));
          const sway = Math.sin(time * 1.1 + entry.phase);
          r.root.rotation.y = entry.yaw + sway * 0.09;
          SN.poseRig(r, 0, 0, time + entry.phase, false, false, 0, -1);
          r.arms[0].upper.rotation.set(-0.22 - lift * 1.02, 0, 0.12);
          r.arms[0].lower.rotation.set(-0.28 - lift * 1.18, 0, 0);
          r.arms[1].upper.rotation.set(-0.1 + sway * 0.05, 0, -0.12);
          r.arms[1].lower.rotation.set(-0.3, 0, 0);
          r.torso.rotation.z = sway * 0.035;
          r.head.rotation.x = -lift * 0.2;
        }
        r.root.updateMatrixWorld(true);
        if (entry.drink) {
          const hand = r.arms[0].hand;
          hand.getWorldPosition(entry.drink.position);
          entry.drink.position.y += 0.02;
          entry.drink.visible = true;
        }
      }
    };
  });
})(window.SN);
