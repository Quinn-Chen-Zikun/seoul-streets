/* 剧情人物、任务、对话、换装与进度存档。 */
"use strict";
(function (SN) {
  SN.costumeStyles = {
    street: { outer: 0x137fba, inner: 0xffd259, pants: 0x365d83, accent: 0xffd259, shoe: 0x2f3a44, extras: [] },
    night: { outer: 0x284b70, inner: 0x1d3049, pants: 0x23354d, accent: 0x56dbed, shoe: 0x23354d, extras: ["armor", "helmet", "coat"] },
    rain: { outer: 0x2b9ac4, inner: 0xf7d764, pants: 0x33495c, accent: 0xffd75e, shoe: 0xefd35b, extras: ["hood", "coat"] },
    ash: { outer: 0xe0e5dd, inner: 0x485764, pants: 0x586677, accent: 0xe68168, shoe: 0x384451, extras: ["armor"] },
    route: { outer: 0xe58a39, inner: 0xffedc9, pants: 0x2c4b65, accent: 0xf8dc84, shoe: 0x51453d, extras: ["pack"] },
    dawn: { outer: 0xf2dfb4, inner: 0xe8eee0, pants: 0x644956, accent: 0xda6955, shoe: 0xddd4bc, extras: ["scarf"] }
  };
  SN.buildWardrobe = function buildWardrobe() {
    for (const part of SN.playerRig.parts)
      SN.wardrobe.base.push({ part, material: part.mesh.material, visible: part.mesh.visible });
    const armor = SN.mat(0x425d78, { roughness: 0.95, metalness: 0.08 }),
      cloth = SN.mat(0x344c66, { roughness: 1, side: SN.T.DoubleSide }),
      edge = SN.mat(0x737e7f, { roughness: 0.7 }),
      visor = SN.mat(0x536e76, { metalness: 0.45, roughness: 0.3, emissive: 0x29454b, emissiveIntensity: 0.2 });
    SN.wardrobe.accent = visor;
    SN.wardrobe.materials = { armor, cloth, edge, visor };
    const add = (parent, geo, material, x, y, z, sx, sy, sz, rz = 0) => {
      const mesh = SN.meshAt(geo, material, x, y, z, sx, sy, sz, 0, parent);
      mesh.rotation.z = rz;
      mesh.userData.lookRole = parent === SN.playerRig.head ? "helmet" : "armor";
      SN.wardrobe.extras.push(mesh);
      return mesh;
    };
    add(SN.playerRig.torso, SN.roundedBox(0.34, 0.34, 0.09, 0.03), armor, 0, 0.25, 0.13, 1, 1, 1);
    for (const side of [-1, 1]) {
      add(SN.playerRig.torso, SN.box, armor, side * 0.15, 0.045, 0.125, 0.12, 0.12, 0.06, side * 0.08);
      add(SN.playerRig.torso, SN.box, edge, side * 0.12, -0.005, 0.145, 0.075, 0.048, 0.035);
      add(SN.playerRig.torso, SN.roundedBox(0.08, 0.1, 0.07, 0.015), cloth, side * 0.2, -0.035, 0.03, 1, 1, 1);
    }
    add(SN.playerRig.head, SN.roundedBox(0.29, 0.29, 0.27, 0.065), armor, 0, 0.115, -0.005, 1, 1, 1);
    // Two offset visor panes and an off-centre brow seam: no ears or familiar insignia.
    add(SN.playerRig.head, SN.box, visor, -0.061, 0.112, 0.137, 0.115, 0.044, 0.014, -0.08);
    add(SN.playerRig.head, SN.box, visor, 0.066, 0.122, 0.137, 0.105, 0.034, 0.014, 0.14);
    add(SN.playerRig.head, SN.box, edge, 0.096, 0.22, 0.07, 0.025, 0.017, 0.12);
    for (const arm of SN.playerRig.arms) {
      add(arm.upper, SN.roundedBox(0.19, 0.13, 0.2, 0.04), armor, 0, 0.012, 0, 1, 1, 1);
      add(arm.lower, SN.box, armor, 0, -0.15, 0.057, 0.135, 0.16, 0.055);
    }
    for (const leg of SN.playerRig.legs) {
      add(leg.lower, SN.roundedBox(0.15, 0.16, 0.075, 0.025), armor, 0, -0.025, 0.072, 1, 1, 1);
      add(leg.lower, SN.box, armor, 0, -0.24, 0.066, 0.12, 0.22, 0.045);
    }
    const emblemCanvas = document.createElement("canvas");
    emblemCanvas.width = emblemCanvas.height = 96;
    const g = emblemCanvas.getContext("2d");
    g.strokeStyle = "#c0c8bd";
    g.lineWidth = 7;
    g.lineCap = "square";
    g.beginPath();
    g.arc(47, 45, 26, 0.38, 4.9);
    g.stroke();
    g.beginPath();
    g.moveTo(52, 33);
    g.lineTo(52, 63);
    g.lineTo(70, 63);
    g.moveTo(70, 35);
    g.lineTo(70, 48);
    g.stroke();
    SN.wardrobe.emblem = add(SN.playerRig.torso, new SN.T.PlaneGeometry(0.115, 0.115), new SN.T.MeshStandardMaterial({ map: SN.canvasTexture(emblemCanvas), transparent: true, roughness: 0.95 }), -0.035, 0.29, 0.18, 1, 1, 1);
    for (const side of [-1, 1]) {
      let parent = SN.playerRig.torso;
      const chain = [];
      for (let i = 0; i < 4; i++) {
        const pivot = new SN.T.Group();
        pivot.position.set(i === 0 ? side * 0.18 : 0, i === 0 ? 0.39 : -0.28, i === 0 ? -0.2 : 0);
        parent.add(pivot);
        const panel = new SN.T.Mesh(new SN.T.PlaneGeometry(0.32 + i * 0.025, 0.29), cloth);
        panel.position.y = -0.145;
        panel.castShadow = true;
        pivot.add(panel);
        chain.push(pivot);
        if (i === 0) {
          pivot.userData.lookRole = "coat";
          SN.wardrobe.extras.push(pivot);
        }
        parent = pivot;
      }
      SN.wardrobe.chains.push(chain);
    }
    const hood = add(SN.playerRig.torso, SN.rigGeo.sphere, cloth, 0, 0.42, -0.16, 0.18, 0.16, 0.16);
    hood.userData.lookRole = "hood";
    const pack = add(SN.playerRig.torso, SN.roundedBox(0.32, 0.42, 0.19, 0.04), armor, 0, 0.2, -0.25, 1, 1, 1);
    pack.userData.lookRole = "pack";
    const scarf = add(SN.playerRig.torso, SN.box, edge, 0, 0.44, 0, 0.3, 0.09, 0.2);
    scarf.userData.lookRole = "scarf";
    const tail = add(SN.playerRig.torso, SN.box, edge, -0.09, 0.25, 0.16, 0.1, 0.35, 0.035);
    tail.userData.lookRole = "scarf";
    SN.applyCostume();
  };

  SN.applyCostume = function applyCostume() {
    const wearing = SN.campaign.costume !== "street", style = SN.costumeStyles[SN.campaign.costume] || SN.costumeStyles.street;
    const helmet = style.extras.includes("helmet");
    for (const saved of SN.wardrobe.base) {
      const part = saved.part, hand = part.geoName === "handGrip" || part.geoName === "handOpen";
      const tone = style[part.wardrobeTone];
      part.mesh.material = wearing && hand ? SN.actorMaterial(0xe3dfcf, 0.94) : wearing && part.matType === "cloth" && tone !== undefined ? SN.clothMaterial(tone) : saved.material;
      part.mesh.visible = saved.visible && !(helmet && (part.matType === "hair" || part.matType === "eye" || part.matType === "glass"));
    }
    for (const mesh of SN.wardrobe.extras)
      mesh.visible = style.extras.includes(mesh.userData.lookRole);
    if (SN.wardrobe.materials) for (const [key, material] of Object.entries(SN.wardrobe.materials))
      material.color.copy(SN.srgb(key === "visor" || key === "edge" ? style.accent : style.outer));
    SN.setText("costumeName", SN.costumeLabel(SN.campaign.costume) + " · K 切换");
    SN.applyCityLook();
    if (SN.models && SN.models.applyPlayerOutfit) SN.models.applyPlayerOutfit();
    SN.updateWeaponVisuals();
  };

  SN.costumeLabel = function costumeLabel(id) {
    return {
      street: "城市便装",
      night: "街行者",
      rain: "街行者 · 雨痕",
      ash: "街行者 · 灰线",
      route: "街行者 · 远灯",
      dawn: "街行者 · 晨雾"
    }[id] || "街行者";
  };

  SN.cycleCostume = function cycleCostume() {
    if (!SN.canControl() && !(SN.pauseOpen && !SN.player.dead && !SN.arrestState))
      return;
    const index = SN.campaign.unlocks.indexOf(SN.campaign.costume);
    SN.campaign.costume = SN.campaign.unlocks[(index + 1) % SN.campaign.unlocks.length];
    SN.applyCostume();
    SN.saveCampaign();
    SN.toast("已换装 · " + SN.costumeLabel(SN.campaign.costume), 2);
  };

  SN.updateCoat = function updateCoat(time) {
    for (const chain of SN.wardrobe.chains)
      for (let i = 0; i < chain.length; i++) {
        const pivot = chain[i], speed = SN.player.car ? 0 : SN.clamp(SN.player.motionSpeed / 6.8, 0, 1);
        pivot.rotation.x = 0.1 + speed * (0.2 + i * 0.025) + Math.sin(time * 5.3 - i * 0.85) * (0.025 + speed * 0.07);
        pivot.rotation.z = Math.sin(time * 2.3 - i * 0.7) * (0.015 + speed * 0.025);
      }
  };

  SN.nameSprite = function nameSprite(text, color) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(8,28,36,.88)";
    g.fillRect(0, 8, 512, 80);
    g.fillStyle = color;
    g.fillRect(0, 8, 5, 80);
    g.font = "500 29px system-ui";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#eaf3e9";
    g.fillText(text, 256, 49);
    const sprite = new SN.T.Sprite(new SN.T.SpriteMaterial({ map: SN.canvasTexture(c), transparent: true, depthWrite: false }));
    sprite.scale.set(3.8, 0.71, 1);
    return sprite;
  };

  SN.buildStoryCharacters = function buildStoryCharacters() {
    for (let i = 0; i < SN.contacts.length; i++) {
      const contact = SN.contacts[i],
        profile = Object.assign({}, SN.makeProfile(100 + i, "civilian", -1), contact.profile, { accent: contact.accent, mask: false, player: false }),
        rig = SN.makeRig(profile.outer, profile.skin, i === 2 ? 1.06 : 1, profile);
      SN.scene.add(rig.root);
      rig.weapon.visible = false;
      const accessory = SN.mat(contact.accent, { roughness: 0.82 });
      if (i === 0) {
        SN.meshAt(SN.box, SN.mat(0x645c47), 0, 0.075, 0.14, 0.27, 0.32, 0.035, 0, rig.torso);
        for (const side of [-1, 1])
          SN.meshAt(SN.box, accessory, side * 0.06, 0.15, 0.17, 0.025, 0.09, 0.02, 0, rig.torso);
      }
      if (i === 1) {
        SN.meshAt(SN.box, accessory, 0.14, 0.12, -0.005, 0.035, 0.1, 0.04, 0, rig.head);
        SN.meshAt(SN.box, accessory, 0, 0.34, 0.125, 0.12, 0.016, 0.015, 0, rig.torso);
      }
      if (i === 2)
        SN.meshAt(SN.box, accessory, 0, -0.09, 0.08, 0.17, 0.07, 0.045, 0, rig.arms[0].upper);
      if (i === 3) {
        SN.meshAt(SN.box, SN.mat(0x334355), 0, -0.06, 0.07, 0.13, 0.19, 0.035, 0, rig.arms[0].hand);
        SN.meshAt(SN.box, accessory, 0.11, 0.25, 0.15, 0.025, 0.045, 0.015, 0, rig.torso);
      }
      if (i === 4) {
        SN.meshAt(SN.box, SN.mat(0x38545b), 0.14, 0.1, 0.17, 0.15, 0.13, 0.07, 0, rig.torso);
        SN.meshAt(SN.box, accessory, -0.08, 0.14, 0.135, 0.02, 0.13, 0.015, 0, rig.head);
      }
      if (i === 5) {
        SN.meshAt(SN.box, accessory, 0, 0.43, 0.035, 0.23, 0.055, 0.18, 0, rig.torso);
        SN.meshAt(SN.box, accessory, -0.06, 0.31, 0.14, 0.07, 0.22, 0.035, 0, rig.torso);
      }
      if (contact.id === "sound") {
        const guitar = SN.meshAt(new SN.T.SphereGeometry(1, 12, 8), SN.cityPalette.gold, 0.2, 0.06, 0.24, 0.22, 0.3, 0.08, 0.3, rig.torso);
        SN.meshAt(SN.box, SN.cityPalette.wood, 0.05, 0.39, 0.23, 0.055, 0.55, 0.04, -0.35, rig.torso);
        SN.meshAt(SN.box, SN.cityPalette.dark, -0.65, 0.8, 0.1, 0.025, 1.6, 0.025, 0, rig.root);
        SN.meshAt(new SN.T.SphereGeometry(0.05, 8, 6), SN.cityPalette.dark, -0.65, 1.62, 0.1, 1, 1, 1, 0, rig.root);
        guitar.castShadow = true;
      }
      const tag = SN.nameSprite(contact.name, "#a5f0cb");
      SN.scene.add(tag);
      const diamond = new SN.T.Mesh(new SN.T.OctahedronGeometry(0.18), new SN.T.MeshBasicMaterial({ color: 0xa5f0cb }));
      SN.scene.add(diamond);
      SN.storyNpcs.push({ contact, rig, tag, diamond });
    }
    const passengerProfile = Object.assign({}, SN.makeProfile(82, "civilian", -1), { outer: 0x806c51, shirt: 0xaca68a, hair: "bob", backpack: false, glasses: true });
    SN.taxiPassenger = { rig: SN.makeRig(0x806c51, passengerProfile.skin, 0.98, passengerProfile), index: 82 };
    SN.scene.add(SN.taxiPassenger.rig.root);
    SN.taxiPassenger.rig.root.visible = false;
    // Authored low cover uses the existing collider and ray-hit systems.
    for (const point of [
      { x: -525, z: 42.3, w: 2.2, d: 1 },
      { x: -515, z: 42.3, w: 2.2, d: 1 },
      { x: -678, z: -333, w: 2.4, d: 1.2 },
      { x: 447, z: -333, w: 2.4, d: 1.1 }
    ]) {
      const y = SN.surfaceHeight(point.x, point.z);
      SN.meshAt(SN.box, SN.mat(0x56625e, { roughness: 0.9 }), point.x, y + 0.46, point.z, point.w, 0.92, point.d);
      SN.meshAt(SN.box, SN.mat(0xa99769), point.x, y + 0.94, point.z, point.w + 0.05, 0.06, point.d + 0.05);
      SN.addOBB(point.x, point.z, point.w, point.d, 0.98, 0, y);
      SN.encounterCover.push(point);
    }
  };

  SN.updateStoryCharacters = function updateStoryCharacters(time) {
    const next = SN.storyMissions[SN.campaign.progress];
    for (let i = 0; i < SN.storyNpcs.length; i++) {
      const npc = SN.storyNpcs[i], c = npc.contact, d = Math.hypot(SN.player.x - c.x, SN.player.z - c.z), visible = d < 140;
      const modeled = !!npc.modelAgent;
      npc.rig.root.visible = visible && !modeled;
      npc.tag.visible = npc.diamond.visible = visible;
      if (!visible)
        continue;
      const groundY = SN.groundUnder(c.x, c.z, 0.2);
      if (!modeled) {
        npc.rig.root.position.set(c.x, groundY, c.z);
        npc.rig.root.rotation.y = d < 6 ? Math.atan2(SN.player.x - c.x, SN.player.z - c.z) : c.yaw;
        SN.poseRig(npc.rig, 0, 0, time + i, false, false, 0, -1);
        npc.rig.arms[0].lower.rotation.x = -0.25 - Math.sin(time * 0.7 + i) * 0.12;
      }
      npc.tag.position.set(c.x, groundY + 2.55, c.z);
      npc.diamond.position.set(c.x, groundY + 2.05 + Math.sin(time * 2 + i) * 0.07, c.z);
      npc.diamond.rotation.y = time;
      npc.diamond.material.color.setHex(next && next.giver === c.id ? 0xffce85 : 0x85c9b9);
    }
    if (SN.taxiPassenger) {
      const a = SN.campaign.active, m = SN.missionDefinition(), o = SN.activeObjective(), r = SN.taxiPassenger.rig;
      r.root.visible = !!(a && a.status === "running" && (m.id === "taxi" || m.id === "ferry"));
      if (r.root.visible) {
        if ((o.type === "taxiDrop" || o.type === "escape" || o.escortCar || m.id === "ferry" && a.step >= 2) && a.taxi) {
          SN.poseDriver(SN.taxiPassenger, a.taxi);
          r.root.position.x += Math.cos(a.taxi.yaw) * a.taxi.spec.width * 0.46;
          r.root.position.z -= Math.sin(a.taxi.yaw) * a.taxi.spec.width * 0.46;
        }
        else if (Number.isFinite(o.x) && Number.isFinite(o.z)) {
          r.root.position.set(o.x, SN.surfaceHeight(o.x, o.z), o.z);
          SN.poseRig(r, 0, 0, time, false, false, 0, -1);
        }
        else r.root.visible = false;
      }
    }
    SN.updateCoat(time);
  };

  SN.nearestContact = function nearestContact() {
    if (SN.player.car || SN.player.dead)
      return null;
    let nearest = null, distance = 3.3;
    for (const c of SN.contacts) {
      const d = Math.hypot(SN.player.x - c.x, SN.player.z - c.z);
      if (d < distance && SN.visibleBetween(SN.player.x, SN.player.y + 1, SN.player.z, c.x, SN.surfaceHeight(c.x, c.z) + 1, c.z)) {
        distance = d;
        nearest = c;
      }
    }
    return nearest;
  };

  SN.validateCampaignLocations = function validateCampaignLocations() {
    SN.validateStoryData();
    for (const m of [...SN.storyMissions, ...SN.sideJobs])
      for (const o of m.objectives) {
        if (o.siteAdjusted || o.contact || !Number.isFinite(o.x))
          continue;
        for (const moved of SN.buildingRelocations)
          if (Math.abs(o.x - moved.x) < moved.w / 2 + 5 && Math.abs(o.z - moved.z) < moved.d / 2 + 5) {
            o.x += moved.dx;
            o.z += moved.dz;
            o.siteAdjusted = true;
            break;
          }
      }
    for (const c of SN.contacts)
      Object.assign(c, SN.safePosition(c.x, c.z, 0.42, null, "contact-" + c.id));
    for (const m of [...SN.storyMissions, ...SN.sideJobs])
      for (const o of m.objectives) {
        if (o.contact) {
          const c = SN.contacts.find(item => item.id === o.contact);
          if (c) { o.x = c.x; o.z = c.z; }
        }
        else if (Number.isFinite(o.x) && o.type !== "tail" && o.type !== "chase")
          Object.assign(o, SN.safePosition(o.x, o.z, 0.42, null, "objective-" + m.id + "-" + m.objectives.indexOf(o)));
      }
  };
  // ========================== Save / journal / dialogue ==========================

  SN.missionDefinition = function missionDefinition(active = SN.campaign.active) {
    return active ? (active.kind === "story" ? SN.storyMissions : SN.sideJobs)[active.index] : null;
  };

  SN.activeObjective = function activeObjective() {
    const m = SN.missionDefinition();
    return m && SN.campaign.active ? m.objectives[SN.campaign.active.step] : null;
  };

  SN.checkpointRecord = function checkpointRecord(active) {
    return {
      kind: active.kind,
      index: active.index,
      step: active.step,
      spawn: { x: active.spawn.x, z: active.spawn.z },
      targetPosition: active.targetPosition || null
    };
  };

  SN.campaignRecord = function campaignRecord() {
    return {
        version: 3,
        progress: SN.campaign.progress,
        jobIndex: SN.campaign.jobIndex,
        jobWins: SN.campaign.jobWins,
        checkpoint: SN.campaign.checkpoint,
        active: SN.campaign.active ? SN.checkpointRecord(SN.campaign.active) : null,
        money: SN.money,
        completed: SN.completed,
        costume: SN.campaign.costume,
        unlocks: SN.campaign.unlocks,
        weapons: SN.weapons.map(w => w.owned),
        loadoutLost: !!SN.campaign.loadoutLost,
        ammunition: SN.weapons.map(w => ({ mag: w.mag, reserve: w.reserve })),
        phoneCredit: SN.phoneCredit,
        phoneMapped: SN.phoneMapped,
        progression: SN.progression,
        world: { minutes: SN.minutes, health: SN.player.health, armor: SN.player.armor,
          weapon: SN.selectedWeapon, holstered: !!SN.holstered, walkMode: !!SN.player.walkMode },
        schema: 5
      };
  };

  SN.saveCampaign = function saveCampaign(storage = null) {
    if (!storage || typeof storage.setItem !== "function") storage = null;
    if (SN.devMode && !storage) return;
    try {
      (storage || localStorage).setItem("seoul-night-ledger-v3", JSON.stringify(SN.campaignRecord()));
      SN.campaign.storageOK = true;
    }
    catch (error) {
      SN.campaign.storageOK = false;
    }
  };

  SN.validCheckpoint = function validCheckpoint(value, progress) {
    if (!value || !["story", "side"].includes(value.kind))
      return null;
    const list = value.kind === "story" ? SN.storyMissions : SN.sideJobs;
    if (!Number.isInteger(value.index) || !list[value.index] || !Number.isInteger(value.step) || value.step < 0 || value.step >= list[value.index].objectives.length || value.kind === "story" && value.index !== progress)
      return null;
    const spawn = value.spawn;
    if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.z) || Math.abs(spawn.x) > SN.WORLD - 10 || Math.abs(spawn.z) > SN.WORLD - 10)
      return null;
    const target = value.targetPosition;
    return { kind: value.kind, index: value.index, step: value.step, spawn: { x: spawn.x, z: spawn.z },
      targetPosition: target && [target.x, target.z].every(Number.isFinite) && Math.abs(target.x) < SN.WORLD && Math.abs(target.z) < SN.WORLD ? { x: target.x, z: target.z } : null };
  };

  SN.loadCampaign = function loadCampaign(data, storage = null) {
    if (SN.devMode && data === undefined && !storage) return;
    try {
      if (data === undefined) {
        const raw = (storage || localStorage).getItem("seoul-night-ledger-v3");
        if (!raw) return;
        if (raw.length > 262144) { SN.campaign.storageOK = false; return; }
        data = JSON.parse(raw);
      }
      if (!data || data.version !== 3)
        return;
      SN.hasSave = true;
      SN.restoreProgression(data.progression);
      SN.campaign.progress = Number.isInteger(data.progress) ? SN.clamp(data.progress, 0, SN.storyMissions.length) : 0;
      SN.campaign.jobIndex = Number.isInteger(data.jobIndex) ? SN.clamp(data.jobIndex, 0, SN.sideJobs.length - 1) : 0;
      SN.campaign.jobWins = SN.sideJobs.map((job, i) => Array.isArray(data.jobWins) && Number.isFinite(data.jobWins[i]) ? SN.clamp(Math.floor(data.jobWins[i]), 0, 99999) : 0);
      SN.money = Number.isFinite(data.money) ? SN.clamp(Math.floor(data.money), 0, 99999999) : 2400;
      SN.completed = Number.isFinite(data.completed) ? SN.clamp(Math.floor(data.completed), 0, 99999) : 0;
      SN.phoneCredit = Number.isFinite(data.phoneCredit) ? SN.clamp(Math.floor(data.phoneCredit), 0, 999999) : 0;
      SN.phoneMapped = !!data.phoneMapped;
      SN.campaign.unlocks = ["street", "night"];
      if (SN.campaign.progress >= 2)
        SN.campaign.unlocks.push("rain");
      if (SN.campaign.progress >= 5)
        SN.campaign.unlocks.push("ash");
      if (SN.campaign.progress >= 6)
        SN.campaign.unlocks.push("route");
      if (SN.campaign.progress >= 7)
        SN.campaign.unlocks.push("dawn");
      SN.campaign.costume = SN.campaign.unlocks.includes(data.costume) ? data.costume : "street";
      const migrate = value => {
        if (!value || typeof value !== "object") return null;
        const checkpoint = { ...value };
        if ((!data.schema || data.schema < 4) && checkpoint.kind === "story" && Number.isInteger(checkpoint.step) && checkpoint.step >= 0) {
          if (checkpoint.index === 0) checkpoint.step = 0;
          if (checkpoint.index === 3 && checkpoint.step >= 3) checkpoint.step += 2;
        }
        return SN.validCheckpoint(checkpoint, SN.campaign.progress);
      };
      SN.campaign.checkpoint = migrate(data.checkpoint);
      const resume = migrate(data.active);
      SN.campaign.active = null;
      if (resume)
        SN.campaign.active = Object.assign(resume, { status: "suspended", reason: "已载入检查点 · 在日志中继续", time: SN.missionDefinition(resume).limit });
      SN.weapons[0].owned = true;
      for (let i = 1; i < SN.weapons.length; i++)
        SN.weapons[i].owned = Array.isArray(data.weapons) ? !!data.weapons[i] : i === 1 && !data.loadoutLost;
      SN.campaign.loadoutLost = !!data.loadoutLost;
      for (let i = 1; i < SN.weapons.length; i++) {
        const ammo = Array.isArray(data.ammunition) && data.ammunition[i], w = SN.weapons[i];
        if (!w.owned) { w.mag = w.reserve = 0; continue; }
        if (ammo && Number.isFinite(ammo.mag) && Number.isFinite(ammo.reserve)) {
          w.mag = SN.clamp(Math.floor(ammo.mag), 0, w.capacity);
          w.reserve = SN.clamp(Math.floor(ammo.reserve), 0, 240);
        } else { w.mag = w.capacity; w.reserve = w.capacity * 2; }
      }
      SN.campaign.storageOK = true;
      const world = data.world;
      if (world && typeof world === "object") {
        if (Number.isFinite(world.minutes)) SN.minutes = SN.clamp(world.minutes, 0, 1439.99);
        if (Number.isFinite(world.health)) SN.player.health = SN.clamp(world.health, 1, 100);
        if (Number.isFinite(world.armor)) SN.player.armor = SN.clamp(world.armor, 0, 100);
        SN.selectedWeapon = world.weapon === -1 ? -1 : Number.isInteger(world.weapon) && SN.weapons[world.weapon] && SN.weapons[world.weapon].owned ? world.weapon : 0;
        SN.holstered = world.holstered !== false; SN.player.walkMode = !!world.walkMode;
      }
    }
    catch (error) {
      SN.campaign.storageOK = false;
    }
  };

  SN.rewardLabel = function rewardLabel(m) {
    return "¥ " + m.reward + " · 声望 +" + (m.respect || 20) + (m.unlock !== undefined ? " · 解锁 " + SN.weapons[m.unlock].name : "") + (m.costume ? " · " + SN.costumeLabel(m.costume) : "");
  };

  SN.journalMarkup = function journalMarkup(m, index, story) {
    const done = story && index < SN.campaign.progress,
      locked = story && index > SN.campaign.progress,
      active = SN.campaign.active && SN.campaign.active.kind === (story ? "story" : "side") && SN.campaign.active.index === index,
      giver = SN.contacts.find(c => c.id === m.giver);
    return "<article class=\"journal-row " + (locked ? "locked " : active ? "active " : "") + "\"><b>" + (done ? "✓ " : locked ? "🔒 " : "◇ ") + m.title + "</b><p>" + (done ? m.outro : m.brief) + "</p><p>" + giver.name + " · " + SN.rewardLabel(m) + "</p><p>" + m.fail + "</p>" + (!story ? "<p>已完成 " + SN.campaign.jobWins[index] + " 次</p>" : "") + (!locked && !done ? "<button data-track=\"" + (story ? "story" : "side") + "\" data-index=\"" + index + "\">标记起点</button>" : "") + "</article>";
  };

  SN.renderJournal = function renderJournal() {
    SN.setText("journalSummary", "主线 " + SN.campaign.progress + " / " + SN.storyMissions.length + " · 街头工作 " + SN.campaign.jobWins.reduce((sum, n) => sum + n, 0) + " 次 · " + SN.costumeLabel(SN.campaign.costume));
    SN.$("storyRows").innerHTML = SN.storyMissions.map((m, i) => SN.journalMarkup(m, i, true)).join("");
    SN.$("jobRows").innerHTML = SN.sideJobs.map((m, i) => SN.journalMarkup(m, i, false)).join("");
    const a = SN.campaign.active;
    let html = "";
    if (a) {
      html = "<p class=\"accent\">" + SN.missionDefinition().title + " · 检查点 " + (a.step + 1) + " / " + SN.missionDefinition().objectives.length + "<br>" + (a.reason || "每个目标完成后自动保存") + "</p>";
      if (a.status !== "running")
        html += "<button data-action=\"retry\">从检查点继续</button>";
      html += "<button data-action=\"suspend\">" + (a.kind === "story" ? "暂存主线，返回街头" : "结束本次支线") + "</button>";
    }
    else if (SN.campaign.checkpoint)
      html = "<button data-action=\"resumeStory\">继续暂存的主线</button>";
    SN.$("journalActions").innerHTML = html;
    SN.setText("saveStatus", SN.campaign.storageOK ? "进度会在目标完成、换装和离开页面时保存到本机。" : "浏览器存储不可用：本次仍可完整游玩，关闭页面后进度不保留。");
  };

  SN.toggleJournal = function toggleJournal(force) {
    if (force !== false && (!SN.started || SN.player.dead || SN.streetPanelOpen))
      return;
    SN.journalOpen = typeof force === "boolean" ? force : !SN.journalOpen;
    if (SN.journalOpen) {
      if (SN.pauseOpen) SN.togglePause(false);
      SN.closeDialogue();
      SN.clearInput();
      if (document.pointerLockElement)
        document.exitPointerLock();
      SN.renderJournal();
    }
    SN.$("journal").classList.toggle("open", SN.journalOpen);
    if (SN.journalOpen)
      SN.$("journalClose").focus();
    else
      SN.canvas.focus();
  };

  SN.suspendMission = function suspendMission() {
    const a = SN.campaign.active;
    if (!a)
      return;
    SN.hideMissionResult();
    if (a.kind === "story")
      SN.campaign.checkpoint = SN.checkpointRecord(a);
    SN.cleanupEncounter();
    SN.campaign.active = null;
    SN.saveCampaign();
    SN.renderJournal();
  };

  SN.trackMission = function trackMission(kind, index) {
    if (SN.campaign.active) {
      SN.toast("先在日志中暂存主线或结束本次支线，再标记其他联系人。", 3);
      return;
    }
    SN.campaign.tracked = kind;
    if (kind === "side")
      SN.campaign.jobIndex = index;
    SN.toggleJournal(false);
    SN.saveCampaign();
    SN.toast("已标记 " + SN.contacts.find(c => c.id === (kind === "story" ? SN.storyMissions[SN.campaign.progress] : SN.sideJobs[index]).giver).name + " · 靠近按 E", 4);
  };

  SN.nextMission = function nextMission() {
    if (!SN.started || SN.paused || SN.player.dead || SN.cinematic || SN.storyDialogue || SN.journalOpen)
      return;
    if (SN.campaign.active && SN.campaign.active.kind === "side") {
      SN.cleanupEncounter();
      SN.campaign.active = null;
    }
    SN.campaign.jobIndex = (SN.campaign.jobIndex + 1) % SN.sideJobs.length;
    if (!SN.campaign.active)
      SN.campaign.tracked = "side";
    SN.saveCampaign();
    SN.toast("支线 " + (SN.campaign.jobIndex + 1) + " / " + SN.sideJobs.length + " · " + SN.sideJobs[SN.campaign.jobIndex].title + (SN.campaign.active ? " · 主线完成后可接取" : " · 前往联系人按 E"), 4);
  };

  SN.offeredMission = function offeredMission(contact) {
    if (SN.campaign.active)
      return null;
    if (SN.campaign.tracked === "side" && SN.sideJobs[SN.campaign.jobIndex].giver === contact.id)
      return { kind: "side", index: SN.campaign.jobIndex };
    if (SN.storyMissions[SN.campaign.progress] && SN.storyMissions[SN.campaign.progress].giver === contact.id && Math.hypot(SN.player.x - SN.missionStart(SN.storyMissions[SN.campaign.progress]).x, SN.player.z - SN.missionStart(SN.storyMissions[SN.campaign.progress]).z) < 8)
      return { kind: "story", index: SN.campaign.progress };
    const index = SN.sideJobs.findIndex(m => m.giver === contact.id);
    return index >= 0 ? { kind: "side", index } : null;
  };

  SN.openDialogue = function openDialogue(contact) {
    SN.storyDialogue = { contact, line: 0, offer: SN.offeredMission(contact) };
    SN.clearInput();
    if (document.pointerLockElement)
      document.exitPointerLock();
    SN.$("dialogue").classList.add("open");
    SN.renderDialogue();
    SN.$("dialogueNext").focus();
  };

  SN.renderDialogue = function renderDialogue() {
    const d = SN.storyDialogue;
    if (!d)
      return;
    const last = d.line >= d.contact.lines.length - 1, m = d.offer ? SN.missionDefinition(d.offer) : null;
    SN.setText("dialogueName", d.contact.name);
    SN.setText("dialogueRole", d.contact.role);
    SN.setText("dialogueText", d.contact.lines[d.line]);
    SN.setText("dialogueCount", (d.line + 1) + " / " + d.contact.lines.length);
    SN.$("dialogueOffer").innerHTML = last && m ? "<h3>" + m.title + "</h3><p>" + m.brief + "</p><p>" + "首个目标：" + m.objectives[0].text + "</p><p class=\"accent\">" + SN.rewardLabel(m) + "</p><p>失败：" + m.fail + " 每个目标完成后保存检查点。</p>" : "";
    SN.setText("dialogueNext", last ? (m ? "接受任务 · E" : "结束对话 · E") : "继续 · E");
  };

  SN.closeDialogue = function closeDialogue() {
    SN.storyDialogue = null;
    SN.$("dialogue").classList.remove("open");
  };

  SN.advanceDialogue = function advanceDialogue() {
    const d = SN.storyDialogue;
    if (!d)
      return;
    if (d.line < d.contact.lines.length - 1) {
      d.line++;
      SN.renderDialogue();
      return;
    }
    const offer = d.offer;
    SN.closeDialogue();
    if (offer)
      SN.startMission(offer.kind, offer.index);
    else
      SN.canvas.focus();
  };

  SN.interactStory = function interactStory() {
    if (SN.storyDialogue) {
      SN.advanceDialogue();
      return;
    }
    if (!SN.canControl())
      return;
    const o = SN.activeObjective();
    if (SN.campaign.active && SN.campaign.active.status === "running" && o && o.type === "collect" && SN.objectiveDistance(o) < (o.r || 3) && !SN.player.car) {
      SN.interactPulse = true;
      return;
    }
    if (SN.interactStreet()) return;
    if (SN.counterTarget) {
      SN.openShopMenu();
      return;
    }
    const c = SN.nearestContact();
    if (c) {
      SN.openDialogue(c);
      return;
    }
    SN.toast("靠近有姓名标记的人物交谈，或到目标处收集。", 2);
  };

  SN.beginCinematic = function beginCinematic(m, ending = false) {
    if (SN.devMode) return;
    SN.clearInput();
    const giver = SN.contacts.find(c => c.id === m.giver),
      near = giver && Math.hypot(SN.player.x - giver.x, SN.player.z - giver.z) < 10,
      focus = near ? giver : SN.player;
    SN.cinematic = {
      elapsed: 0,
      duration: 2.7,
      x: focus.x,
      z: focus.z,
      y: SN.surfaceHeight(focus.x, focus.z),
      yaw: near ? giver.yaw : SN.player.yaw
    };
    SN.$("briefingTag").textContent = ending ? "任务完成 · " + SN.rewardLabel(m) : "任务简报 · " + SN.contacts.find(c => c.id === m.giver).name;
    SN.$("briefingTitle").textContent = m.title;
    SN.$("briefingText").textContent = ending ? (m.outro || "报酬已到账。随时回到联系人处接下一单。") : m.brief;
    SN.$("briefing").classList.add("visible");
    document.documentElement.classList.add("cinematic");
  };

  SN.endCinematic = function endCinematic() {
    SN.cinematic = null;
    SN.$("briefing").classList.remove("visible");
    document.documentElement.classList.remove("cinematic");
    SN.clearInput();
  };

  SN.cinematicCamera = function cinematicCamera(dt) {
    if (!SN.cinematic)
      return false;
    const c = SN.cinematic;
    c.elapsed += dt;
    const t = SN.clamp(c.elapsed / c.duration, 0, 1),
      angle = c.yaw + 0.65 + Math.sin(t * SN.PI) * 0.3,
      r = SN.lerp(4.2, 2.7, t),
      y = c.y + 1.25;
    SN.cameraAnchor.set(c.x, y, c.z);
    SN.camWant.set(c.x + Math.sin(angle) * r, c.y + 2.25, c.z + Math.cos(angle) * r);
    const f = SN.cameraFraction(c.x, y, c.z, SN.camWant.x, SN.camWant.y, SN.camWant.z);
    SN.camera.position.lerpVectors(SN.cameraAnchor, SN.camWant, f);
    SN.camera.lookAt(SN.cameraAnchor);
    SN.sky.position.copy(SN.camera.position);
    if (t >= 1)
      SN.endCinematic();
    return true;
  };
  // =========================== Objective state machine ===========================

  SN.stageLoanCar = function stageLoanCar(type = 3) {
    if (SN.player.car)
      return;
    if (!SN.vehicleSpecs[type]) type = 3;
    const o = SN.activeObjective(), target = o && ["tail", "chase", "ambush"].includes(o.type) ? SN.missionCar : o;
    const following = o && ["tail", "chase", "ambush"].includes(o.type);
    SN.placeMissionVehicle(SN.loanCar, following ? target.x - Math.sin(target.yaw) * 35 : SN.player.x,
      following ? target.z - Math.cos(target.yaw) * 35 : SN.player.z, type, target);

  };

  SN.startMission = function startMission(kind, index) {
    if (SN.campaign.active)
      return;
    const m = (kind === "story" ? SN.storyMissions : SN.sideJobs)[index];
    if (!m || kind === "story" && index !== SN.campaign.progress)
      return;
    if (!SN.canStartActivity(m)) return;
    SN.finishStreetEvent(false, true);
    SN.hideMissionResult();
    SN.waypoint = null;
    const saved = kind === "story" ? SN.campaign.checkpoint : null, step = saved && saved.index === index ? saved.step : 0;
    SN.campaign.active = {
      kind,
      index,
      step,
      status: "running",
      spawn: saved && saved.index === index ? saved.spawn : { x: SN.player.x, z: SN.player.z },
      time: m.limit,
      remaining: m.totalLimit || m.limit,
      contractCar: null,
      targetPosition: saved && saved.targetPosition || null
    };
    SN.campaign.tracked = kind;
    if (kind === "side")
      SN.campaign.jobIndex = index;
    SN.prepareObjective();
    SN.saveCampaign();
    SN.beginCinematic(m);
  };

  SN.cleanupEncounter = function cleanupEncounter() {
    const active = SN.campaign.active;
    if (active && (active.status === "complete" || active.status === "failed")) {
      active.contractCar = null;
      active.taxi = null;
    }
    if (SN.escortActor) SN.escortActor.rig.root.visible = false;
    for (const car of SN.convoyCars || []) { car.active = false; car.root.visible = false; }
    SN.missionDriver.active = false;
    SN.missionDriver.inCar = null;
    SN.missionCar.occupant = null;
    for (const a of SN.encounterActors) {
      a.active = false;
      a.hostile = false;
      a.inCar = null;
    }
    SN.encounterActors.length = 0;
    for (const markerMesh of SN.objectiveMarkers)
      markerMesh.visible = false;
    if (SN.player.car !== SN.missionCar) {
      SN.missionCar.active = false;
      SN.missionCar.root.visible = false;
      SN.missionCar.parked = true;
      SN.missionCar.speed = SN.missionCar.vx = SN.missionCar.vz = 0;
    }
    SN.flushActors();
  };

  SN.prepareObjective = function prepareObjective() {
    const a = SN.campaign.active, m = SN.missionDefinition(), o = SN.activeObjective();
    if (a && o && o.fromTarget) {
      const target = a.targetPosition || a.spawn, pickup = SN.safePosition(target.x, target.z, 0.35);
      o.x = pickup.x; o.z = pickup.z;
    }
    SN.cleanupEncounter();
    if (!a || !o)
      return;
    a.status = "running";
    a.reason = "";
    a.elapsed = 0;
    a.hold = 0;
    a.exposure = 0;
    a.lost = 0;
    a.outside = 0;
    a.integrity = 100;
    a.wave = 0;
    a.departed = false;
    a.interact = false;
    a.defeated = 0;
    a.remaining = Number.isFinite(a.remaining) ? a.remaining : (m.totalLimit || m.limit);
    a.time = Math.min(o.seconds || m.limit, a.remaining);
    SN.prepareStreetObjective(a, m, o);
    if (m.id === "race")
      a.time = Math.max(1, a.raceTime || m.limit);
    SN.interactPulse = false;
    if (["tail", "chase", "ambush"].includes(o.type)) {
      SN.repairVehicle(SN.missionCar);
      Object.assign(SN.missionCar, {
        x: o.x,
        z: o.z,
        yaw: o.type === "tail" ? SN.PI / 2 : 0,
        health: 100,
        parked: true,
        active: true,
        speed: 0,
        vx: 0,
        vz: 0,
        stuck: 0,
        index: 0,
        cruise: o.type === "tail" ? 9 : 15,
        route: o.route || (o.type === "tail" ? [[760, -430], [760, -640], [360, -640], [360, -430]] : [[-130, 1060], [560, 1060], [560, 900], [-130, 900]])
      });
      const firstTurn = SN.missionCar.route[0];
      SN.placeMissionVehicle(SN.missionCar, o.x, o.z, undefined, { x: firstTurn[0], z: firstTurn[1] });
      SN.resetVehicleGround(SN.missionCar);
      SN.missionCar.route = SN.missionRoadCircuit(SN.missionCar.route);
      SN.missionCar.root.visible = true;
      SN.missionDriver.active = true;
      SN.missionDriver.inCar = SN.missionCar;
      SN.missionDriver.x = SN.missionCar.x;
      SN.missionDriver.z = SN.missionCar.z;
      SN.missionDriver.health = 100;
      SN.missionDriver.down = 0;
      SN.missionCar.occupant = SN.missionDriver;
      SN.stageLoanCar();
      if (o.type === "ambush") SN.stageConvoy(o);
    }
    if (o.type === "taxiPickup" && !SN.player.car || o.type === "race" && !SN.player.car)
      SN.stageLoanCar();
    if (o.type === "taxiDrop" && !a.taxi) {
      SN.stageLoanCar();
      a.taxi = SN.loanCar;
    }
    if (o.type === "escape") {
      SN.forceWanted(o.heat, "任务目标 · 警方通缉");
      SN.spawnClock = 0;
      SN.lastSeen = SN.simTime;
    }
    if (o.type === "fight" || o.type === "defend") {
      if (o.melee) { SN.selectWeapon(0); SN.holstered = true; }
      else { const w = SN.weapons[o.supply === undefined ? 1 : o.supply]; w.owned = true; }
      SN.player.armor = Math.max(SN.player.armor, 60);
      SN.player.health = Math.max(SN.player.health, 75);
      for (const w of SN.weapons)
        if (w.owned) {
          w.mag = w.capacity;
          w.reserve = Math.max(w.reserve, w.capacity * 5);
        }
      SN.spawnEncounter(o, o.type === "fight" ? o.count : 3, 0);
    }
    if (a.kind === "story")
      SN.campaign.checkpoint = SN.checkpointRecord(a);
  };

  SN.retryCheckpoint = function retryCheckpoint() {
    const a = SN.campaign.active;
    if (!a)
      return;
    if (SN.arrestState && !SN.arrestState.done) SN.finishArrest();
    SN.hideMissionResult();
    SN.cleanupEncounter();
    if (SN.player.car) {
      SN.player.car.speed = SN.player.car.vx = SN.player.car.vz = 0;
      SN.player.car.parked = true;
      SN.player.car = null;
    }
    if (SN.missionDefinition().id === "race") {
      a.raceTime = SN.missionDefinition().limit;
    }
    a.remaining = SN.missionDefinition().totalLimit || SN.missionDefinition().limit;
    a.taxi = null;
    a.raceCar = null;
    a.contractCar = null;
    SN.holstered = true;
    SN.player.vault = null; SN.hurtSource = null; SN.slowMotion = 0;
    const p = SN.safePosition(a.spawn.x, a.spawn.z, 0.4);
    Object.assign(SN.player, p, {
      y: SN.groundUnder(p.x, p.z, 0.22),
      health: 100,
      armor: 60,
      dead: 0,
      bail: null,
      vy: 0,
      speed: 0,
      motionSpeed: 0,
      grounded: true
    });
    SN.playerRoot.visible = true;
    SN.playerRoot.rotation.set(0, SN.player.yaw, 0);
    SN.playerRoot.position.set(SN.player.x, SN.player.y, SN.player.z);
    SN.player.fallPeak = SN.player.y;
    SN.player.lastHurt = SN.simTime; SN.player.hitReact = 0;
    SN.carjack = null; SN.reloadTime = 0;
    if (SN.selectedWeapon < 0) SN.selectedWeapon = 0;
    Object.assign(SN.playerRig.motion, { speed: 0, weight: 0, lean: 0, phase: 0 });
    for (const leg of SN.playerRig.legs) leg.planted = false;
    SN.$("downscreen").classList.remove("visible");
    SN.$("arrestScreen").classList.remove("visible");
    SN.$("arrestPrompt").classList.remove("visible");
    SN.heat = 0;
    SN.survivedPeak = 0;
    SN.wantedSearch = 0;
    SN.wantedResisted = false;
    SN.arrestState = null;
    SN.clearWantedResponse();
    for (const c of SN.crews)
      c.anger = 0;
    for (const officer of SN.actors)
      if (officer.kind === "police") {
        officer.active = false;
        officer.inCar = null;
      }
    for (const c of SN.pursuitCars) {
      c.active = false;
      c.root.visible = false;
      c.occupant = null;
    }
    SN.clearInput();
    SN.prepareObjective();
    SN.snapPlayer();
    SN.saveCampaign();
    SN.toggleJournal(false);
    SN.beginCinematic(SN.missionDefinition());
  };

  SN.failMission = function failMission(reason) {
    const a = SN.campaign.active;
    if (!a || a.status !== "running")
      return;
    a.status = "failed";
    a.reason = reason + " · J 从检查点继续";
    if (a.kind === "story")
      SN.campaign.checkpoint = SN.checkpointRecord(a);
    SN.cleanupEncounter();
    SN.saveCampaign();
    SN.toast("任务失败 · " + a.reason, 7);
    SN.showMissionResult(false, SN.missionDefinition(), reason);
  };

  SN.finishObjective = function finishObjective() {
    const a = SN.campaign.active;
    if (!a || a.status !== "running")
      return;
    const m = SN.missionDefinition();
    const previous = SN.activeObjective();
    if (["tail", "chase", "ambush"].includes(previous.type)) a.targetPosition = { x: SN.missionCar.x, z: SN.missionCar.z };
    a.step++;
    if (a.step >= m.objectives.length) {
      a.status = "complete";
      SN.cleanupEncounter();
      SN.money += m.reward;
      SN.progression.respect += m.respect || 20;
      if (a.kind === "story") SN.progression.stats.missionsPassed++;
      else SN.progression.stats.activitiesPassed++;
      SN.completed++;
      if (a.kind === "story") {
        SN.campaign.progress++;
        SN.campaign.checkpoint = null;
      }
      else
        SN.campaign.jobWins[a.index]++;
      if (m.unlock !== undefined) {
        const w = SN.weapons[m.unlock];
        w.owned = true;
        w.mag = w.capacity;
        w.reserve = Math.max(w.reserve, w.capacity * 5);
      }
      if (m.costume && !SN.campaign.unlocks.includes(m.costume))
        SN.campaign.unlocks.push(m.costume);
      SN.campaign.active = null;
      SN.campaign.tracked = SN.campaign.progress < SN.storyMissions.length ? "story" : "side";
      SN.saveCampaign();
      SN.toast("任务完成 · " + SN.rewardLabel(m), 6);
      SN.showMissionResult(true, m, m.outro || "报酬已到账");
      return;
    }
    a.spawn = SN.safePosition(SN.player.x, SN.player.z, 0.4);
    SN.carjack = null;
    a.raceTime = a.time;
    if ((m.id === "taxi" || m.id === "ferry") && SN.player.car)
      a.taxi = SN.player.car;
    SN.prepareObjective();
    SN.saveCampaign();
    SN.toast("检查点 " + a.step + " / " + m.objectives.length + " 已保存 · " + m.objectives[a.step].text, 4);
  };

  SN.objectiveDistance = function objectiveDistance(o) {
    return Math.hypot(SN.player.x - o.x, SN.player.z - o.z);
  };

  SN.currentTarget = function currentTarget() {
    const a = SN.campaign.active, o = SN.activeObjective();
    if (a && o) {
      if (["tail", "chase", "ambush"].includes(o.type))
        return SN.missionCar.active ? SN.missionCar : o;
      if (o.type === "drive" && o.contract && a.contractCar && SN.player.car !== a.contractCar) return a.contractCar;
      if (o.escortCar && a.taxi && SN.player.car !== a.taxi) return a.taxi;
      if (o.type === "vehicle" && a.contractCar) return a.contractCar;
      if (o.type === "escape") return { x: SN.searchX + SN.searchRadius + 100, z: SN.searchZ };
      return o;
    }
    const m = SN.campaign.tracked === "side" ? SN.sideJobs[SN.campaign.jobIndex] : SN.storyMissions[SN.campaign.progress] || SN.sideJobs[SN.campaign.jobIndex];
    return SN.missionStart(m);
  };

  SN.updateMission = function updateMission(dt) {
    const a = SN.campaign.active, o = SN.activeObjective();
    if (!a || a.status !== "running" || !o) {
      SN.interactPulse = false;
      return;
    }
    const m = SN.missionDefinition();
    a.time -= dt;
    a.remaining -= dt;
    a.elapsed += dt;
    if (SN.player.dead) {
      SN.failMission("你已倒下，医疗站将接应你");
      return;
    }
    if (a.time <= 0 || a.remaining <= 0) {
      SN.failMission("超过任务时限");
      return;
    }
    const distance = Number.isFinite(o.x) ? SN.objectiveDistance(o) : 0;
    let done = false;
    if (o.type === "go")
      done = distance < (o.r || 5) && (!o.room || !!SN.interiorAt(SN.player.x, SN.player.z, SN.player.y) && SN.interiorAt(SN.player.x, SN.player.z, SN.player.y).id === o.room);
    else if (o.type === "collect")
      done = SN.interactPulse && !SN.player.car && distance < (o.r || 3) && Math.abs(SN.player.y - SN.surfaceHeight(o.x, o.z)) < 1.3;
    else if (o.type === "delivery")
      done = distance < (o.r || 5);
    else if (o.type === "tail") {
      if (!a.departed && SN.player.car) {
        a.departed = true;
        SN.missionCar.parked = false;
      }
      const d = Math.hypot(SN.player.x - SN.missionCar.x, SN.player.z - SN.missionCar.z),
        visible = SN.visibleBetween(SN.missionCar.x, SN.surfaceHeight(SN.missionCar.x, SN.missionCar.z) + 1.5, SN.missionCar.z, SN.player.x, SN.player.y + 1, SN.player.z),
        bearing = ((SN.player.x - SN.missionCar.x) * Math.sin(SN.missionCar.yaw) + (SN.player.z - SN.missionCar.z) * Math.cos(SN.missionCar.yaw)) / Math.max(d, 0.01);
      if (a.departed) {
        a.exposure = SN.clamp(a.exposure + dt * (visible && (d < 18 || d < 55 && bearing > 0.15) ? 35 : -14), 0, 100);
        a.lost = d > 110 || !visible ? a.lost + dt : 0;
        if (d >= 18 && d <= 85 && visible)
          a.hold += dt;
      }
      if (SN.missionCar.health <= 0 || a.exposure >= 100 || a.lost >= 12 || SN.heat >= 1) {
        SN.failMission(SN.missionCar.health <= 0 ? "运账车已损毁" : a.lost >= 12 ? "跟丢了运账车" : "运账车察觉了跟踪");
        return;
      }
      done = a.hold >= o.duration;
    }
    else if (o.type === "chase" || o.type === "ambush") {
      if (!a.departed && SN.player.car) {
        a.departed = true;
        SN.missionCar.parked = false;
      }
      const d = Math.hypot(SN.player.x - SN.missionCar.x, SN.player.z - SN.missionCar.z);
      a.lost = a.departed && d > 180 ? a.lost + dt : 0;
      if (SN.missionCar.health <= 0 || a.lost >= 15) {
        SN.failMission(SN.missionCar.health <= 0 ? "运单车毁坏，底单丢失" : "运单车逃离了街区");
        return;
      }
      if (SN.missionCar.health <= 35) {
        SN.missionCar.parked = true;
        SN.missionCar.speed = SN.missionCar.vx = SN.missionCar.vz = 0;
      }
      a.hold = SN.missionCar.health <= 35 && d < 12 ? a.hold + dt : 0;
      done = a.hold >= 2;
    }
    else if (o.type === "escape") {
      done = SN.heat === 0;
      if (done) SN.holstered = true;
    }
    else if (["vehicle", "drive", "escort"].includes(o.type)) {
      done = SN.updateStreetObjective(a, o, dt, distance);
      if (a.status !== "running") return;
    }
    else if (o.type === "taxiPickup") {
      done = !!SN.player.car && SN.player.car.type === 3 && distance < o.r && Math.abs(SN.player.car.speed) < 1;
      if (done)
        a.taxi = SN.player.car;
    }
    else if (o.type === "taxiDrop") {
      if (!a.taxi)
        a.taxi = SN.loanCar;
      a.outside = SN.player.car !== a.taxi ? a.outside + dt : 0;
      if (a.taxi.health <= 0 || a.outside > 15) {
        SN.failMission("乘客中止了行程");
        return;
      }
      done = SN.player.car === a.taxi && distance < o.r && Math.abs(SN.player.car.speed) < 1;
    }
    else if (o.type === "race") {
      if (a.step === 0 && !a.raceCar && SN.player.car)
        a.raceCar = SN.player.car;
      if (!a.raceCar && SN.player.car)
        a.raceCar = SN.player.car;
      a.outside = a.raceCar && SN.player.car !== a.raceCar ? a.outside + dt : 0;
      if (a.raceCar && a.raceCar.health <= 0 || a.outside > 15) {
        SN.failMission("赛车无法继续");
        return;
      }
      done = !!SN.player.car && distance < o.r;
    }
    else if (o.type === "fight" || o.type === "defend") {
      a.outside = distance > (o.type === "fight" ? 45 : 40) ? a.outside + dt : 0;
      if (a.outside > 10) {
        SN.failMission("你离开了任务战区");
        return;
      }
      a.defeated = 0;
      let threats = 0;
      for (const enemy of SN.encounterActors) {
        if (enemy.health <= 0) a.defeated++;
        else if (enemy.active && (enemy.x - o.x) ** 2 + (enemy.z - o.z) ** 2 < 25) threats++;
      }
      if (o.type === "fight")
        done = a.defeated >= o.count;
      else {
        if (distance < 22)
          a.hold += dt;
        a.integrity = Math.max(0, a.integrity - dt * threats * 7);
        if (a.hold > 12 && a.wave === 0) {
          a.wave = 1;
          SN.spawnEncounter(o, 2, 3);
        }
        if (a.hold > 24 && a.wave === 1) {
          a.wave = 2;
          SN.spawnEncounter(o, 3, 5);
        }
        if (a.integrity <= 0) {
          SN.failMission("接应点失守");
          return;
        }
        done = a.hold >= o.duration;
      }
    }
    SN.interactPulse = false;
    if (done)
      SN.finishObjective();
  };

  SN.spawnEncounter = function spawnEncounter(o, count, offset) {
    for (let i = 0; i < count; i++) {
      const slot = offset + i, a = SN.actors[SN.encounterStart + slot];
      if (!a)
        continue;
      const role = o.melee ? 0 : o.room && i === count - 1 ? 3 : slot % 3, stats = SN.enemyRoles[role], angle = slot * 2.4;
      const spot = o.room ? [[-531, 41], [-509, 41], [-523, 40.2], [-513, 45]][i % 4] : [o.x + Math.sin(angle) * (17 + slot % 2 * 4), o.z + Math.cos(angle) * (17 + slot % 2 * 4)],
        p = SN.safePosition(spot[0], spot[1], 0.4);
      Object.assign(a, {
        x: p.x,
        z: p.z,
        homeX: p.x,
        homeZ: p.z,
        active: true,
        health: stats.hp,
        maxHealth: stats.hp,
        down: 0,
        fall: 0,
        stagger: false,
        hostile: true,
        inCar: null,
        crew: slot % 2,
        enemyRole: role,
        room: o.room || null,
        cool: 1.2 + slot * 0.25,
        flinch: 0,
        phase: 0,
        burst: 0,
        attackWindup: 0,
        coverSet: false,
        coverTimer: 0,
        strafeClock: 0,
        dropGiven: false,
        bumpCool: 0,
        carHitCool: 0,
        yaw: Math.atan2(SN.player.x - p.x, SN.player.z - p.z)
      });
      a.rig.root.scale.setScalar(role === 3 ? 1.13 : 1);
      a.rig.height = role === 3 ? 1.13 : 1;
      for (const part of a.missionArmorParts)
        part.visible = role === 3;
      for (const part of a.rig.parts) {
        if (part.matType === "cloth")
          part.colorObject.setHex(part.geoName === "torso" || part.geoName === "box" ? stats.color : 0x2c3439);
        if (part.matType === "metal")
          part.colorObject.setHex(role === 3 ? 0xc4a374 : 0x94a4a0);
      }
      SN.encounterActors.push(a);
      SN.advanceGait(a.rig, 0, 0, 0);
      a.rig.root.position.set(a.x, SN.surfaceHeight(a.x, a.z), a.z);
    }
  };

  SN.updateEncounterActor = function updateEncounterActor(a, dt, time) {
    if (a.health <= 0) {
      a.down = 999;
      a.fall = Math.min(1, a.fall + dt * 2.7);
      SN.poseRig(a.rig, 0, 0, time, false, false, 0, -1, a.fall);
      return;
    }
    const stats = SN.enemyRoles[a.enemyRole], o = SN.activeObjective();
    if (!o)
      return;
    const oldX = a.x,
      oldZ = a.z,
      distance = Math.hypot(a.x - SN.player.x, a.z - SN.player.z),
      floor = SN.surfaceHeight(a.x, a.z),
      sight = SN.visibleBetween(a.x, floor + 1.4, a.z, SN.player.x, SN.player.y + 1.1, SN.player.z),
      cycle = (time + a.index * 0.53) % 4.2,
      peek = cycle > 1.5,
      melee = a.enemyRole === 0;
    a.cool -= dt;
    a.flinch = Math.max(0, a.flinch - dt);
    a.coverTimer -= dt;
    let tx = SN.player.x, tz = SN.player.z, speed = melee ? 4.1 : 2.6, crouch = false;
    if (melee && o.type === "defend" && distance > 9) {
      tx = o.x;
      tz = o.z;
    }
    if (!melee) {
      if (a.coverTimer <= 0) {
        a.coverTimer = 3.5;
        let cover = null, best = 14;
        for (const c of SN.encounterCover) {
          const d = Math.hypot(a.x - c.x, a.z - c.z);
          if (d < best) {
            best = d;
            cover = c;
          }
        }
        for (const c of SN.cars) {
          if (!c.active)
            continue;
          const d = Math.hypot(a.x - c.x, a.z - c.z);
          if (d < best) {
            best = d;
            cover = { x: c.x, z: c.z, w: c.spec.width, d: c.spec.length };
          }
        }
        if (cover) {
          const dx = cover.x - SN.player.x,
            dz = cover.z - SN.player.z,
            len = Math.hypot(dx, dz) || 1,
            off = Math.max(cover.w, cover.d) * 0.55 + 0.8;
          a.coverX = cover.x + dx / len * off;
          a.coverZ = cover.z + dz / len * off;
          a.coverSet = !SN.blocked(a.coverX, a.coverZ, 0.32);
        }
        else
          a.coverSet = false;
      }
      if (a.coverSet) {
        const angle = Math.atan2(SN.player.x - a.coverX, SN.player.z - a.coverZ),
          side = (a.index % 2 ? 1 : -1) * (peek ? 1.8 : 0);
        tx = a.coverX + Math.cos(angle) * side;
        tz = a.coverZ - Math.sin(angle) * side;
        crouch = !peek && Math.hypot(tx - a.x, tz - a.z) < 1.5;
      }
      else {
        const angle = Math.atan2(SN.player.x - a.x, SN.player.z - a.z), flank = (a.index % 2 ? 1 : -1) * (a.room ? 3 : 8);
        tx = SN.player.x - Math.sin(angle) * (a.room ? 4 : 14) + Math.cos(angle) * flank;
        tz = SN.player.z - Math.cos(angle) * (a.room ? 4 : 14) - Math.sin(angle) * flank;
      }
    }
    if (a.room) {
      tx = SN.clamp(tx, -533, -507);
      tz = SN.clamp(tz, 40.1, 45.7);
    }
    if (a.flinch > 0)
      speed *= 0.2;
    if (SN.player.dead)
      speed = 0;
    const dx = tx - a.x, dz = tz - a.z, len = Math.hypot(dx, dz);
    if (len > 0.35 && distance > (melee ? 1.4 : 2)) {
      const step = Math.min(len, speed * dt), nx = a.x + dx / len * step, nz = a.z + dz / len * step;
      let resolved = SN.resolveCircle(nx, nz, 0.3);
      if (resolved.hit) {
        const side = a.index % 2 ? 1 : -1;
        resolved = SN.resolveCircle(a.x + dz / Math.max(len, 0.01) * step * side, a.z - dx / Math.max(len, 0.01) * step * side, 0.3);
      }
      if (!SN.isWater(resolved.x, resolved.z, 0.3)) {
        a.x = resolved.x;
        a.z = resolved.z;
      }
    }
    a.yaw = SN.approachAngle(a.yaw, Math.atan2(SN.player.x - a.x, SN.player.z - a.z), dt * 9);
    if (!SN.player.dead && a.flinch <= 0 && sight) {
      if (melee && distance < 2 && a.cool <= 0) {
        if (a.attackWindup === 0) {
          a.attackWindup = 0.42;
          a.cool = 0.42;
        }
        else {
          SN.hurtPlayer(stats.damage, false, a);
          a.attackWindup = 0;
          a.cool = 1.15;
          SN.emitSparks(SN.player.x, SN.player.y + 1, SN.player.z, 3, false);
        }
      }
      if (melee && distance >= 2)
        a.attackWindup = 0;
      if (!melee && peek && distance < 90 && a.cool <= 0) {
        a.cool = stats.weapon === 2 ? (a.burst++ % 3 < 2 ? 0.18 : 1.5) : 1.35;
        SN.shotOrigin.set(a.x, SN.surfaceHeight(a.x, a.z) + 1.4, a.z);
        SN.shotEnd.set(SN.player.x + SN.rand(-0.65, 0.65), SN.player.y + 1.1, SN.player.z + SN.rand(-0.65, 0.65));
        SN.spawnMuzzleFlash(SN.shotOrigin, true);
        SN.spawnTracer(SN.shotOrigin, SN.shotEnd, true);
        SN.soundEnemyShot(a);
        SN.emitSparks(SN.shotOrigin.x, SN.shotOrigin.y, SN.shotOrigin.z, 2, true);
        if (SN.rnd() < SN.clamp(0.65 - distance * 0.006, 0.15, 0.6)) {
          SN.hurtPlayer(stats.damage, false, a);
          if (SN.player.car)
            SN.player.car.health = Math.max(0, SN.player.car.health - 2);
        }
      }
    }
    const moved = Math.hypot(a.x - oldX, a.z - oldZ);
    SN.advanceGait(a.rig, moved, dt, melee ? 1.4 : 1);
    a.rig.root.position.set(a.x, SN.surfaceHeight(a.x, a.z), a.z);
    a.rig.root.rotation.y = a.yaw;
    SN.poseRig(a.rig, speed, a.phase, time, false, !melee && peek, a.attackWindup > 0 ? 0.7 : 0, stats.weapon);
    if (crouch) {
      a.rig.torso.position.y -= 0.32;
      a.rig.head.rotation.x = 0.12;
    }
    if (a.flinch > 0)
      a.rig.torso.rotation.x -= a.flinch * 1.4;
  };

  SN.updateCampaignMarkers = function updateCampaignMarkers(time) {
    const target = SN.currentTarget(), o = SN.activeObjective(), a = SN.campaign.active;
    SN.marker.visible = !!target && (!a || a.status === "running");
    if (target)
      SN.marker.position.set(target.x, SN.surfaceHeight(target.x, target.z) + 0.05, target.z);
    for (const mesh of SN.objectiveMarkers)
      mesh.visible = false;
    if (a && a.status === "running" && o) {
      if (["fight", "defend"].includes(o.type)) {
        let i = 0;
        for (const enemy of SN.encounterActors) {
          if (!enemy.active || enemy.health <= 0 || i >= SN.objectiveMarkers.length)
            continue;
          const mesh = SN.objectiveMarkers[i++];
          mesh.visible = true;
          mesh.position.set(enemy.x, SN.surfaceHeight(enemy.x, enemy.z) + 2.25 + Math.sin(time * 3) * 0.08, enemy.z);
          mesh.material.color.setHex(enemy.enemyRole === 3 ? 0xffcd85 : 0xf08b79);
          mesh.rotation.y = time;
        }
      }
      else {
        const m = SN.missionDefinition();
        let i = 0;
        for (let n = a.step + 1; n < m.objectives.length && i < 3; n++) {
          const next = m.objectives[n];
          if (!["collect", "race"].includes(next.type) || !Number.isFinite(next.x))
            continue;
          const mesh = SN.objectiveMarkers[i++];
          mesh.visible = true;
          mesh.material.color.setHex(0x7bb7ac);
          mesh.position.set(next.x, SN.surfaceHeight(next.x, next.z) + 1.5, next.z);
          mesh.rotation.y = time;
        }
      }
    }
  };

  SN.missionStatusText = function missionStatusText() {
    const a = SN.campaign.active, o = SN.activeObjective();
    if (!a || !o)
      return "靠近标记起点，按 E 听取简报。";
    if (a.status !== "running")
      return a.reason || "J 从检查点继续";
    if (o.type === "tail")
      return !a.departed ? "附近已备车 · F 上车后目标发车" : "跟踪 " + Math.floor(a.hold) + " / " + o.duration + " 秒 · 暴露 " + Math.round(a.exposure) + "% · 失联 " + a.lost.toFixed(1) + " / 12 秒";
    if (o.type === "chase" || o.type === "ambush")
      return "目标车况 " + Math.ceil(SN.missionCar.health) + "% · 降至 35% 后靠近 2 秒（勿摧毁）";
    if (o.type === "defend")
      return "坚守 " + Math.floor(a.hold) + " / " + o.duration + " 秒 · 接应完整度 " + Math.ceil(a.integrity) + "%" + (a.outside ? " · 返回战区 " + Math.ceil(10 - a.outside) + " 秒" : "");
    if (o.type === "fight") {
      const boss = SN.encounterActors.find(enemy => enemy.enemyRole === 3 && enemy.health > 0);
      return "击退 " + (a.defeated || 0) + " / " + o.count + (boss ? " · 重装守账人 " + Math.ceil(boss.health) + " HP" : "") + " · 留意掩体两侧";
    }
    if (o.type === "escape")
      return "收起武器，断开视线并离开红色搜索圈；隐藏或换车会加快降级。";
    if (o.type === "taxiDrop")
      return "乘客已上车 · 同一辆出租车送达，停稳结算。";
    if (o.roof)
      return "从停车楼南门进入，沿现有坡道步行上层。";
    return "检查点 " + (a.step + 1) + " / " + SN.missionDefinition().objectives.length + " · " + (a.step ? "此前目标已保存" : "倒下后可在日志重试");
  };

  SN.refreshMissionHUD = function refreshMissionHUD() {
    const a = SN.campaign.active,
      m = SN.missionDefinition() || (SN.campaign.tracked === "side" ? SN.sideJobs[SN.campaign.jobIndex] : SN.storyMissions[SN.campaign.progress] || SN.sideJobs[SN.campaign.jobIndex]),
      target = SN.currentTarget(),
      distance = target ? Math.hypot(SN.player.x - target.x, SN.player.z - target.z) : 0,
      seconds = a ? Math.max(0, Math.ceil(a.time || 0)) : 0;
    const objective = SN.activeObjective();
    SN.setText("objectiveText", a ? (a.status === "running" ? (objective ? objective.text : m.title) : "检查点待续 · 打开任务日志") : "前往「" + SN.contacts.find(c => c.id === m.giver).name.split(" · ")[0] + "」");
    SN.setText("objectiveDistance", distance > 1000 ? (distance / 1000).toFixed(1) + " km" : Math.round(distance) + " m");
    SN.setText("objectiveTimer", a && a.status === "running" && a.time > 0 ? String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0") : "");
    SN.setText("missionName", m.title);
    SN.setText("missionTag", a ? (a.kind === "story" ? "主线" : "支线") + " / " + (a.step + 1) + " · " + (a.status === "running" ? "进行中" : "检查点待续") : (SN.campaign.tracked === "story" && SN.campaign.progress < SN.storyMissions.length ? "主线 · 等待接取" : "支线 · " + (SN.campaign.jobIndex + 1) + " / " + SN.sideJobs.length));
    SN.setText("missionDesc", a ? m.brief : SN.contacts.find(c => c.id === m.giver).name + " · " + m.brief);
    SN.setHtml("objectiveList", m.objectives.map((o, i) => "<li class=\"" + (a ? (i < a.step ? "done" : i === a.step ? "current" : "") : "") + "\">" + o.text + "</li>").join(""));
    SN.setText("missionDetail", SN.missionStatusText());
    SN.setText("countdown", a ? (a.status === "running" ? String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0") : "J 继续") : "E 接取");
    SN.setText("reward", "+ ¥ " + m.reward + " · " + (distance > 1000 ? (distance / 1000).toFixed(1) + " km" : Math.round(distance) + " m"));
    SN.setStyle("missionProgress", "transform", "scaleX(" + (a ? SN.clamp((a.step + 1) / m.objectives.length, 0, 1) : 0) + ")");
    SN.setStyle("missionProgress", "background", a && a.status !== "running" ? "#eb987d" : "#a5f0cb");
    const c = SN.nearestContact(),
      o = SN.activeObjective(),
      collect = a && a.status === "running" && o && o.type === "collect" && !SN.player.car && SN.objectiveDistance(o) < (o.r || 3),
      shopHint = SN.counterTarget ? "E " + (SN.counterTarget.kind === "mart" ? "柜台购买" : "商店") + " · " + SN.counterTarget.name : "",
      hint = collect ? "E 收集 · " + o.text : shopHint ? shopHint : c ? "E 对话 · " + c.name : "";
    SN.$("storyInteract").classList.toggle("available", !!hint);
    if (hint) {
      SN.setText("storyInteract", collect ? "E 收集" : SN.counterTarget ? "E 购买" : "E " + c.name.split(" · ")[0]);
      SN.setText("interaction", hint);
      SN.$("interaction").classList.add("visible");
    }
    SN.refreshStreetHUD();
  };

  SN.bindCampaignUI = function bindCampaignUI() {
    SN.$("journalBtn").addEventListener("click", () => SN.toggleJournal());
    SN.$("journalClose").addEventListener("click", () => SN.toggleJournal(false));
    SN.$("jobBtn").addEventListener("click", () => { SN.togglePause(false); SN.nextMission(); });
    SN.$("costumeBtn").addEventListener("click", SN.cycleCostume);
    SN.$("storyInteract").addEventListener("click", SN.interactStory);
    SN.$("dialogueNext").addEventListener("click", SN.advanceDialogue);
    SN.$("dialogueClose").addEventListener("click", SN.closeDialogue);
    SN.$("cinemaSkip").addEventListener("click", SN.endCinematic);
    SN.$("journal").addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button)
        return;
      if (button.dataset.track)
        SN.trackMission(button.dataset.track, Number(button.dataset.index));
      if (button.dataset.action === "retry")
        SN.retryCheckpoint();
      if (button.dataset.action === "suspend") {
        SN.suspendMission();
      }
      if (button.dataset.action === "resumeStory" && SN.campaign.checkpoint && !SN.campaign.active) {
        SN.campaign.active = Object.assign({}, SN.campaign.checkpoint, { status: "suspended" });
        SN.retryCheckpoint();
      }
    });
    window.addEventListener("beforeunload", SN.saveCampaign);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && SN.started)
        SN.saveCampaign();
    });
  };
  // Startup phase 25: keep this order relative to the other systems.

  SN.registerInit(25, function initializeMissions25() {
    // Original campaign data. Every objective is a durable checkpoint.
    SN.contacts = [
      {
        id: "mentor",
        name: "한서온 · 韩序温",
        role: "종로 · 修车师傅",
        x: -30,
        z: -765,
        yaw: SN.PI,
        accent: 0xc0a16c,
        profile: {
          outfit: "jacket",
          outer: 0x425862,
          shirt: 0xb9a47b,
          pants: 0x30383b,
          hair: "short",
          hairColor: 0x827c71,
          glasses: true,
          cargo: true
        },
        lines: [
          "首尔不会替新人留位置。我叫韩序温，车坏了可以来找我。",
          "银光团和赤鹰帮都在收一笔来路不明的过路钱。先把送货单对清楚，别急着站队。",
          "记下人说的话，也留下纸上的证据。两者未必一样。"
        ]
      },
      {
        id: "silver",
        name: "류가람 · 柳嘉岚",
        role: "명동 · 银光团负责人",
        x: 444,
        z: -405,
        yaw: 0,
        accent: 0x61bcaa,
        profile: {
          outfit: "jacket",
          outer: 0x243f40,
          shirt: 0xd1c6b1,
          pants: 0x353e45,
          hair: "bob",
          hairColor: 0x211f25,
          chain: true,
          men: false
        },
        lines: ["这里的商贩认我的名字。最近却有人借这个名字收钱。", "别开枪惊动那辆运账车。跟着它，看最后是谁来接货。", "你是新人，反而没人认识你的车。保持距离。"]
      },
      {
        id: "red",
        name: "임도겸 · 林道谦",
        role: "강남 · 赤鹰帮负责人",
        x: -182,
        z: 988,
        yaw: SN.PI,
        accent: 0xbc715f,
        profile: {
          outfit: "hoodie",
          outer: 0x603e39,
          shirt: 0x353536,
          pants: 0x263039,
          hair: "undercut",
          hairColor: 0x352d24,
          chain: true,
          cargo: true
        },
        lines: ["柳嘉岚觉得只有她被冒名？我们的货也被那伙人扣下了。", "有辆车带着付款底单。逼停它，别把底单烧成灰。", "警察会追上来。你把自己带回来，我们再谈欠你的。"]
      },
      {
        id: "detective",
        name: "윤해솔 · 尹海率",
        role: "종로 · 刑警",
        x: 346,
        z: -752,
        yaw: SN.PI / 2,
        accent: 0x8babbf,
        profile: {
          outfit: "jacket",
          outer: 0x73776e,
          shirt: 0x374c60,
          pants: 0x30383f,
          hair: "pony",
          hairColor: 0x222b2b,
          glasses: true,
          men: false
        },
        lines: ["我不需要两帮人给的口供。我需要三处互相印证的原始记录。", "有人用伪造的执法单据，把两边的生意拴在同一本账上。", "拿到证据后先摆脱追踪。我要的是活着的证人。"]
      },
      {
        id: "informant",
        name: "채나린 · 蔡娜凛",
        role: "광장시장 · 街头消息员",
        x: 902,
        z: -674,
        yaw: SN.PI,
        accent: 0xd5af59,
        profile: {
          outfit: "hoodie",
          outer: 0xb0924f,
          shirt: 0x45606b,
          pants: 0x33474a,
          hair: "cap",
          capColor: 0x38545b,
          hairColor: 0x513c2b,
          backpack: true,
          men: false
        },
        lines: ["市场上没有秘密，只有还没被听见的声音。", "我备份了账本，但原件还在停车楼。现在他们要把证人也抹掉。", "帮我守住医院外的接应点，转运车需要一点时间。"]
      },
      {
        id: "rival",
        name: "백이현 · 白以贤",
        role: "강남역 · 跑街车手",
        x: -154,
        z: 1084,
        yaw: SN.PI / 2,
        accent: 0xbda5ce,
        profile: {
          outfit: "jacket",
          outer: 0x4c475e,
          shirt: 0xb2adb1,
          pants: 0x252d36,
          hair: "undercut",
          hairColor: 0x675449,
          glasses: false,
          cargo: true
        },
        lines: ["上回被你逼停的车，是我替他们调的。现在轮到他们追我了。", "我知道停车楼的侧路。钥匙藏在上层，沿坡道上去就能找到。", "这次跑完这一程，我想开一家只修车、不问货的店。"]
      }
    ];
    SN.storyMissions = [
      {
        id: "arrival",
        title: "01 · 종로 / 第一张送货单",
        giver: "mentor",
        brief: "初到首尔，你接下韩序温的一趟跑腿。两份盖章相同、金额不同的单据，把你带进了两支街区帮派的争执。",
        reward: 650,
        unlock: 0,
        limit: 300,
        fail: "倒下即失败；已完成目标保留。",
        outro: "两张单据，两个收款人。韩序温让你去明洞问个明白。",
        objectives: [
          { type: "go", text: "到 종로 便利店门外取件", x: -39, z: -778, r: 3 },
          { type: "collect", text: "在 카페 门外收取另一张送货单 · E", x: 34, z: -609, r: 2.5 },
          { type: "go", text: "回 종로 将单据交给韩序温", contact: "mentor", r: 3 }
        ]
      },
      {
        id: "shadow",
        title: "02 · 명동 / 车灯之后",
        giver: "silver",
        brief: "柳嘉岚否认加收费用。她让你盯住运账车，查出冒用银光团名义的人。保持距离，别让后视镜里的身影变得熟悉。",
        reward: 1000,
        costume: "rain",
        limit: 300,
        fail: "暴露满 100%、失联 12 秒、警戒升至一级、目标车毁坏或倒下即失败。",
        outro: "运账车的收货地址指向江南。蔡娜凛留下了一份副本。",
        objectives: [
          { type: "go", text: "到 명동 路口的观察点", x: 378, z: -444, r: 7 },
          { type: "tail", text: "跟踪运账车 28 秒 · 18–85 米，避开后视镜", x: 416, z: -430, duration: 28 },
          { type: "go", text: "到 광장시장 联系蔡娜凛", contact: "informant", r: 3 }
        ]
      },
      {
        id: "intercept",
        title: "03 · 강남 / 截住底单",
        giver: "red",
        brief: "林道谦也收到伪造账单。带走底单的司机正在江南绕行：逼停车辆、保住证据，然后甩开巡警。",
        reward: 1450,
        unlock: 1,
        limit: 300,
        fail: "目标车毁坏、目标逃离超过 180 米持续 15 秒，或倒下即失败。",
        outro: "底单上出现了伪造的执法编号。尹海率愿意核对原件。",
        objectives: [
          { type: "go", text: "到 강남대로 取用借来的车辆", x: -145, z: 1050, r: 7 },
          { type: "chase", text: "追停运单车 · 碰撞或射击令车况低于 35%", x: -130, z: 1020 },
          { type: "escape", text: "摆脱两级警戒并收起武器", heat: 2 }
        ]
      },
      {
        id: "papertrail",
        title: "04 · 서울 / 三份原件",
        giver: "detective",
        brief: "尹海率发现两帮人的账目被同一批中间人篡改。你必须跨越三个街区，把互相印证的原件送到警方手里。",
        reward: 1850,
        unlock: 2,
        limit: 480,
        fail: "倒下即失败；每份原件单独保存检查点。",
        outro: "原件拼出了真相：中间人准备烧账灭口，医院的证人危在旦夕。",
        objectives: [
          { type: "collect", text: "광장시장 · 摊位账条 · E", x: 906, z: -672, r: 2.5 },
          { type: "collect", text: "명동 · 运费签收页 · E", x: 430, z: -406, r: 2.5 },
          { type: "collect", text: "강남 · 医院外的监控存储片 · E", x: 306, z: 986, r: 2.5 },
          { type: "go", text: "回 종로 派出所向尹海率交证", contact: "detective", r: 3 }
        ]
      },
      {
        id: "hold",
        title: "05 · 응급실 / 留一盏灯",
        giver: "informant",
        brief: "蔡娜凛的线人躲进医院。两帮的激进成员先后赶来，你必须守住接应点，让证人安全转运。",
        reward: 2300,
        costume: "ash",
        limit: 360,
        fail: "接应完整度归零、离开 40 米超过 10 秒或倒下即失败。",
        outro: "转运完成。白以贤承认替中间人改装车辆，愿意交出停车楼钥匙。",
        objectives: [
          { type: "go", text: "赶到 응급실 医院外接应点", x: -682, z: -330, r: 5 },
          { type: "defend", text: "保护接应点 35 秒 · 优先击退近战者", x: -682, z: -330, duration: 35 },
          { type: "escape", text: "甩开追踪，等待警戒解除", heat: 1 }
        ]
      },
      {
        id: "key",
        title: "06 · 한강 / 沿坡道向上",
        giver: "rival",
        brief: "白以贤交代了存账地点。停车楼上层藏着钥匙，楼下是守账人。你决定把原件交给警方，结束这场互相猜疑。",
        reward: 2600,
        costume: "route",
        limit: 420,
        fail: "倒下即失败；钥匙到手后会保留。",
        outro: "钥匙已经到手。韩序温说，最后一程，他会在街口等你。",
        objectives: [
          { type: "go", text: "抵达 한강 停车楼南门", x: -520, z: 53, r: 5 },
          { type: "collect", text: "沿坡道到停车楼上层取钥匙 · E", x: -520, z: 14, r: 2.5, roof: true },
          { type: "go", text: "到 종로 与韩序温确认计划", contact: "mentor", r: 3 }
        ]
      },
      {
        id: "dawn",
        title: "07 · 주차장 / 归还账本",
        giver: "mentor",
        brief: "韩序温替你备好补给。进入停车楼，突破守账人的交叉火力，把账本带出封锁线。你不必成为任何一帮的人。",
        reward: 3600,
        costume: "dawn",
        limit: 420,
        fail: "离开停车楼战区 45 米超过 10 秒、倒下即失败。",
        outro: "账本交给了尹海率。两帮撤掉路口的收费牌，你终于有了一条由自己选择的道路。主线完结，街头工作仍可继续。",
        objectives: [
          { type: "go", text: "进入 주차장 停车楼下层 · F 进门", x: -520, z: 44, r: 2, room: "garage" },
          { type: "fight", text: "室内交火 · 击退 4 名守账人", x: -520, z: 43, room: "garage", count: 4 },
          { type: "collect", text: "取得下层保管箱中的原始账本 · E", x: -508, z: 42, r: 2 },
          { type: "escape", text: "带账本离开并甩掉两级警戒", heat: 2 }
        ]
      }
    ];
    SN.sideJobs = [
      {
        id: "taxi",
        title: "出租车 · 종로 到 명동",
        giver: "mentor",
        brief: "用路边的汉江出租车接一位通勤乘客。停稳接客，再把人送到明洞。",
        reward: 520,
        limit: 240,
        fail: "载客后车辆毁坏、离车 15 秒或倒下即失败。",
        objectives: [
          { type: "taxiPickup", text: "驾驶出租车到 종로 接客并停稳", x: -68, z: -798, r: 10 },
          { type: "taxiDrop", text: "送乘客到 명동 东街路边并停稳", x: 590, z: -428, r: 12 }
        ]
      },
      {
        id: "delivery",
        title: "限时配送 · 을지로 急送零件",
        giver: "mentor",
        brief: "韩序温的修车客人等着零件。取货后 95 秒内送到乙支路。",
        reward: 700,
        limit: 240,
        fail: "取货后 95 秒未交付，或倒下即失败。",
        objectives: [
          { type: "collect", text: "向韩序温领取零件 · E", contact: "mentor", r: 3 },
          { type: "delivery", text: "95 秒内送到 을지로 街口", x: -686, z: -622, r: 5, seconds: 95 }
        ]
      },
      {
        id: "race",
        title: "街头计时 · 강남 三个弯",
        giver: "rival",
        brief: "白以贤用三个街口计时。驾驶车辆按顺序过点，90 秒内完成最后一个弯。",
        reward: 1100,
        limit: 90,
        fail: "90 秒超时、赛车毁坏、离车 15 秒或倒下即失败。",
        objectives: [
          { type: "race", text: "检查点 1 · 강남대로", x: -130, z: 1060, r: 13 },
          { type: "race", text: "检查点 2 · 테헤란로", x: 560, z: 1060, r: 13 },
          { type: "race", text: "检查点 3 · 봉은사로", x: 560, z: 900, r: 13 }
        ]
      },
      {
        id: "turf",
        title: "街区解围 · 명동",
        giver: "silver",
        brief: "堵住小巷的激进成员不肯散场。柳嘉岚请你清出一条让店主回家的路。",
        reward: 1250,
        limit: 300,
        fail: "离开战区 45 米超过 10 秒或倒下即失败。",
        objectives: [
          { type: "go", text: "到 명동 集合点", x: 450, z: -330, r: 6 },
          { type: "fight", text: "击退 5 名堵路成员", x: 450, z: -330, count: 5 }
        ]
      },
      {
        id: "rooftop",
        title: "楼顶寻物 · 주차장",
        giver: "informant",
        brief: "蔡娜凛把三枚备用存储片藏在停车楼上层。沿现有坡道上楼，逐个找回。",
        reward: 800,
        limit: 360,
        fail: "倒下即失败；收集进度按检查点保留。",
        objectives: [
          { type: "collect", text: "沿坡道找回上层西侧存储片 · E", x: -530, z: 17, r: 2.3, roof: true },
          { type: "collect", text: "找回上层中央存储片 · E", x: -520, z: 11, r: 2.3, roof: true },
          { type: "collect", text: "找回上层东侧存储片 · E", x: -509, z: 21, r: 2.3, roof: true }
        ]
      }
    ];
    SN.contacts.push({
      id: "sound",
      name: "문새리 · 文赛梨",
      role: "弘大 · 街演组织者",
      x: -1900,
      z: -540,
      yaw: SN.PI,
      accent: 0xc7a17b,
      profile: {
        outfit: "hoodie",
        outer: 0x89745c,
        shirt: 0xcbbba3,
        pants: 0x354547,
        hair: "bob",
        hairColor: 0x30282c,
        men: false,
        backpack: true
      },
      lines: ["我在桥下收过风声，也在这里收过掌声。今晚我们要把两种声音都留下。", "圣水的朋友替我们修好录音机，先替我去拿回来。"]
    }, {
      id: "dispatch",
      name: "강도림 · 姜道林",
      role: "金浦 · 机场调度",
      x: -2510,
      z: -1515,
      yaw: 0,
      accent: 0x91b6c5,
      profile: {
        outfit: "jacket",
        outer: 0x435d72,
        shirt: 0xc5c5b3,
        pants: 0x313842,
        hair: "short",
        hairColor: 0x40332e,
        glasses: true
      },
      lines: ["下一班落地之前，我得把所有手写交接单送到车站。", "城市从来不会同时睡着。机场亮着灯的时候，汉江的渡船也还在走。"]
    }, {
      id: "maker",
      name: "서이담 · 徐以谈",
      role: "圣水 · 工坊修复师",
      x: 1900,
      z: -412,
      yaw: SN.PI,
      accent: 0xbf9276,
      profile: {
        outfit: "jacket",
        outer: 0x8b624f,
        shirt: 0xbaa381,
        pants: 0x3c4145,
        hair: "pony",
        hairColor: 0x242d29,
        men: false,
        cargo: true
      },
      lines: ["旧厂房里留下的每一道划痕，都是有人认真做过事的证据。", "把修好的零件送到三成，再去蚕室湖边找回收据。我们只收该收的钱。"]
    });
    SN.sideJobs.push({
      id: "airport",
      title: "航班交接 · 金浦 → 首尔站",
      giver: "dispatch",
      brief: "姜道林要赶在换班前交接两份原始记录。沿机场接驳路出发，经新村抵达首尔站。",
      reward: 1800,
      limit: 600,
      fail: "倒下或超时即失败；每站保存进度。",
      objectives: [
        { type: "collect", text: "领取机场交接单 · E", contact: "dispatch", r: 3 },
        { type: "go", text: "新村学园南门核对封签", x: -1900, z: -980, r: 9 },
        { type: "go", text: "首尔站广场交接", x: -1230, z: -530, r: 10 }
      ]
    }, {
      id: "busking",
      title: "风声与掌声 · 弘大 → 圣水",
      giver: "sound",
      brief: "为文赛梨取回工坊修好的录音机，带回弘大的街演舞台。",
      reward: 1650,
      limit: 660,
      fail: "倒下或超时即失败。",
      objectives: [
        { type: "go", text: "前往圣水工坊联系徐以谈", contact: "maker", r: 3 },
        { type: "collect", text: "领取修好的录音机 · E", contact: "maker", r: 3 },
        { type: "go", text: "带回弘大街演舞台", contact: "sound", r: 3 }
      ]
    }, {
      id: "eastbank",
      title: "修复后的城市 · 三成与蚕室",
      giver: "maker",
      brief: "沿东岸过桥，替徐以谈送出展陈零件，再去蚕室湖畔收回签收页。",
      reward: 2100,
      limit: 600,
      fail: "倒下或超时即失败。",
      objectives: [
        { type: "collect", text: "领取展陈零件 · E", contact: "maker", r: 3 },
        { type: "go", text: "三成会展南广场交件", x: 1760, z: 1445, r: 12 },
        { type: "collect", text: "蚕室湖畔收据 · E", x: 2720, z: 1860, r: 3 },
        { type: "go", text: "返回圣水工坊", contact: "maker", r: 3 }
      ]
    }, {
      id: "riverlights",
      title: "两岸漫游 · 首尔街头",
      giver: "mentor",
      brief: "韩序温想知道新开的跨江路线是否畅通。沿途到访梨泰院、汝矣岛、江南和蚕室。",
      reward: 2400,
      limit: 900,
      fail: "倒下或超时即失败；各站分别保存。",
      objectives: [
        { type: "go", text: "梨泰院坡道街口", x: -1100, z: -100, r: 12 },
        { type: "go", text: "汝矣岛市民议会广场", x: -1370, z: 520, r: 12 },
        { type: "go", text: "江南客运站", x: 770, z: 1590, r: 12 },
        { type: "go", text: "蚕室体育公园", x: 2260, z: 1430, r: 12 }
      ]
    });
    SN.campaign = {
      version: 3,
      progress: 0,
      jobIndex: 0,
      jobWins: SN.sideJobs.map(() => 0),
      checkpoint: null,
      active: null,
      tracked: "story",
      costume: "street",
      unlocks: ["street", "night"],
      storageOK: true
    };
    SN.taxiPassenger = null;
    SN.money = 2400;
    SN.completed = 0;
    SN.storyDialogue = null;
    SN.journalOpen = false;
    SN.cinematic = null;
    SN.interactPulse = false;
  });
  // Startup phase 27: keep this order relative to the other systems.

  SN.registerInit(27, function initializeMissions27() {
    SN.storyNpcs = [];
    SN.encounterActors = [];
    SN.encounterCover = [];
    SN.missionCar = SN.makeCar(0, -800, SN.PI / 2, true, null, 0, 2, "mission");
    SN.missionCar.active = false;
    SN.missionCar.root.visible = false;
    SN.missionCar.marked = true;
    SN.missionCar.paint.color.setHex(0x957052);
    SN.loanCar = SN.makeCar(-66, -766, SN.PI / 2, true, null, 0, 3);
    SN.loanCar.paint.color.setHex(0xb9a373);
    SN.marker = new SN.T.Group();
    SN.scene.add(SN.marker);
    SN.beamMat = new SN.T.MeshBasicMaterial({
      color: 0xffce85,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: SN.T.AdditiveBlending,
      side: SN.T.DoubleSide
    });
    SN.beam = new SN.T.Mesh(new SN.T.CylinderGeometry(0.65, 1.3, 14, 12, 1, true), SN.beamMat);
    SN.beam.position.y = 7;
    SN.marker.add(SN.beam);
    SN.ring = new SN.T.Mesh(new SN.T.TorusGeometry(1.8, 0.065, 6, 32), new SN.T.MeshBasicMaterial({ color: 0xffce85 }));
    SN.ring.rotation.x = SN.PI / 2;
    SN.ring.position.y = 0.16;
    SN.marker.add(SN.ring);
    SN.gem = new SN.T.Mesh(new SN.T.OctahedronGeometry(0.4), new SN.T.MeshBasicMaterial({ color: 0xffe6b9, wireframe: true }));
    SN.gem.position.y = 3;
    SN.marker.add(SN.gem);
    SN.objectiveMarkers = [];
    for (let i = 0; i < 8; i++) {
      const mesh = new SN.T.Mesh(new SN.T.OctahedronGeometry(0.25), new SN.T.MeshBasicMaterial({ color: 0xffce85, depthTest: false, transparent: true, opacity: 0.8 }));
      mesh.renderOrder = 5;
      mesh.visible = false;
      SN.scene.add(mesh);
      SN.objectiveMarkers.push(mesh);
    }
  });
  // Startup phase 50: keep this order relative to the other systems.

  SN.registerInit(50, function initializeMissions50() {
    // ====================== Original characters and wardrobe ======================
    SN.wardrobe = { extras: [], chains: [], base: [], emblem: null, accent: null };
    // Encounter tactics reuse pooled actors, world collision, cover rays and tracers.
    SN.enemyRoles = [
      { name: "近战打手", hp: 75, weapon: 0, damage: 10, color: 0x867353 },
      { name: "手枪手", hp: 90, weapon: 1, damage: 6, color: 0x54756f },
      { name: "步枪手", hp: 115, weapon: 2, damage: 7, color: 0x655871 },
      { name: "重装守账人", hp: 270, weapon: 2, damage: 9, color: 0x454c53 }
    ];
  });
})(window.SN);
