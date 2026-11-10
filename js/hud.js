/* HUD、提示、武器栏、小地图与全城地图。 */
"use strict";
(function (SN) {
  SN.toast = function toast(text, duration = 4) {
    SN.$("toast").textContent = text;
    SN.$("toast").classList.add("show");
    SN.toastTime = duration;
  };

  SN.drawWeaponIcon = function drawWeaponIcon(canvas, index, active) {
    const c = canvas.getContext("2d"), s = canvas.width;
    c.clearRect(0, 0, s, s);
    c.save();
    c.translate(s / 2, s / 2);
    c.lineCap = "round";
    c.lineJoin = "round";
    const col = active ? "#eafff4" : "#9db8b1", accent = active ? "#ffcf8a" : "#6f8983";
    c.strokeStyle = col;
    c.fillStyle = col;
    if (index === 0) {
      c.fillStyle = col;
      c.fillRect(-s * 0.17, -s * 0.2, s * 0.27, s * 0.22);
      c.fillRect(-s * 0.2, -s * 0.3, s * 0.32, s * 0.14);
      c.fillStyle = accent;
      c.fillRect(-s * 0.16, -s * 0.03, s * 0.24, s * 0.05);
      c.fillStyle = col;
      c.fillRect(-s * 0.23, -s * 0.24, s * 0.06, s * 0.12);
    }
    else if (index === 1) {
      c.fillRect(-s * 0.2, -s * 0.16, s * 0.36, s * 0.1);
      c.fillStyle = accent;
      c.fillRect(-s * 0.2, -s * 0.17, s * 0.08, s * 0.12);
      c.fillStyle = col;
      c.save();
      c.translate(-s * 0.07, s * 0);
      c.rotate(0.28);
      c.fillRect(-s * 0.06, 0, s * 0.12, s * 0.22);
      c.restore();
      c.fillRect(-s * 0.23, -s * 0.14, s * 0.05, s * 0.05);
    }
    else {
      c.fillRect(-s * 0.3, -s * 0.09, s * 0.46, s * 0.1);
      c.fillRect(s * 0.1, -s * 0.075, s * 0.22, s * 0.045);
      c.fillStyle = accent;
      c.fillRect(-s * 0.11, -s * 0.045, s * 0.06, s * 0.13);
      c.fillStyle = col;
      c.fillRect(-s * 0.27, -s * 0.03, s * 0.1, s * 0.13);
      c.fillRect(-s * 0.02, -s * 0.16, s * 0.1, s * 0.05);
    }
    c.restore();
  };

  SN.refreshWeaponSlots = function refreshWeaponSlots() {
    for (let i = 0; i < 3; i++) {
      const active = !SN.holstered && SN.selectedWeapon === i;
      SN.slotElements[i].slot.classList.toggle("active", active);
      SN.slotElements[i].slot.style.opacity = SN.weapons[i].owned ? (active ? "1" : ".72") : ".34";
      SN.drawWeaponIcon(SN.slotElements[i].cv, i, active);
    }
  };

  SN.speakBubble = function speakBubble(a, text, mood = "neutral") {
    if (!text)
      return;
    const b = SN.bubblePool[SN.bubbleCursor++ % SN.bubblePool.length];
    b.el.textContent = text;
    b.el.className = "bubble " + (mood === "angry" ? "angry" : mood === "scared" ? "scared" : "");
    b.el.style.display = "block";
    b.x = a.x;
    b.y = SN.groundUnder(a.x, a.z, 0.2) + 2.05;
    b.z = a.z;
    b.life = b.total = SN.rand(2.2, 3.1);
  };

  SN.showPopup = function showPopup(text, color, x, y, z, duration = 1.25) {
    const p = SN.popPool[SN.popCursor++ % SN.popPool.length];
    p.el.textContent = text;
    p.el.style.color = color;
    p.el.style.display = "block";
    p.x = x;
    p.y = y;
    p.z = z;
    p.life = p.total = duration;
  };

  SN.projectWorld = function projectWorld(x, y, z, out) {
    SN.projectVector.set(x, y, z).applyMatrix4(SN.camera.matrixWorldInverse);
    if (SN.projectVector.z > -0.08)
      return false;
    SN.projectVector.applyMatrix4(SN.camera.projectionMatrix);
    if (SN.projectVector.z > 1)
      return false;
    out.x = (SN.projectVector.x * 0.5 + 0.5) * innerWidth;
    out.y = (-SN.projectVector.y * 0.5 + 0.5) * innerHeight;
    return true;
  };

  SN.updateWorldUI = function updateWorldUI(dt) {
    for (const b of SN.bubblePool) {
      if (b.life <= 0)
        continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.el.style.display = "none";
        continue;
      }
      if (!SN.projectWorld(b.x, b.y, b.z, SN.screenPoint)) {
        b.el.style.display = "none";
        continue;
      }
      b.el.style.display = "block";
      b.el.style.transform = "translate(" + (SN.screenPoint.x - b.el.offsetWidth * 0.5).toFixed(1) + "px," + (SN.screenPoint.y - b.el.offsetHeight).toFixed(1) + "px)";
      b.el.style.opacity = SN.clamp(b.life / 0.35, 0, 1);
    }
    for (const p of SN.popPool) {
      if (p.life <= 0)
        continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.el.style.display = "none";
        continue;
      }
      if (!SN.projectWorld(p.x, p.y + (1 - p.life / p.total) * 0.7, p.z, SN.screenPoint)) {
        p.el.style.display = "none";
        continue;
      }
      p.el.style.display = "block";
      p.el.style.transform = "translate(" + (SN.screenPoint.x - p.el.offsetWidth * 0.5).toFixed(1) + "px," + SN.screenPoint.y.toFixed(1) + "px)";
      p.el.style.opacity = SN.clamp(p.life / 0.3, 0, 1);
    }
  };

  SN.toggleCityMap = function toggleCityMap(force) {
    if (!SN.started || SN.player.dead || SN.cinematic || SN.storyDialogue || SN.shopMenuOpen)
      return;
    SN.cityMapOpen = typeof force === "boolean" ? force : !SN.cityMapOpen;
    if (SN.cityMapOpen) {
      SN.toggleJournal(false);
      SN.clearInput();
      if (document.pointerLockElement)
        document.exitPointerLock();
      SN.selectedDistrict = SN.cityDistricts.indexOf(SN.cityDistrictAt(SN.player.x, SN.player.z));
    }
    SN.$("cityMap").classList.toggle("open", SN.cityMapOpen);
    if (SN.cityMapOpen) {
      SN.renderAtlasList();
      SN.drawCityAtlas();
      SN.$("closeCityMap").focus();
    }
    else
      SN.canvas.focus();
  };

  SN.renderAtlasList = function renderAtlasList() {
    SN.$("districtList").innerHTML = SN.cityDistricts.map((d, i) => "<button data-district=\"" + i + "\" class=\"" + (i === SN.selectedDistrict ? "selected" : "") + "\"><span>" + d.name + "</span><small>" + String(i + 1).padStart(2, "0") + "</small></button>").join("");
    const d = SN.cityDistricts[SN.selectedDistrict];
    SN.$("atlasSelected").textContent = d.ko + " · " + (Math.hypot(d.x - SN.player.x, d.z - SN.player.z) / 1000).toFixed(1) + " km";
    SN.$("atlasTravel").disabled = !!(SN.campaign.active || SN.heat > 0 || SN.player.car);
    SN.$("atlasHint").textContent = SN.campaign.active ? "任务进行中：接驳暂停，驾驶或步行抵达。" : SN.heat > 0 ? "通缉期间城市接驳暂停。" : SN.player.car ? "请先下车，再使用城市接驳。" : "选择城区，乘接驳车抵达安全街口。";
  };

  SN.drawCityAtlas = function drawCityAtlas() {
    if (!SN.cityMapOpen)
      return;
    const rect = SN.$("atlasView").getBoundingClientRect(),
      ratio = Math.min(devicePixelRatio || 1, 2),
      w = rect.width,
      h = rect.height;
    if (!w || !h)
      return;
    SN.atlas.width = Math.round(w * ratio);
    SN.atlas.height = Math.round(h * ratio);
    const g = SN.atlasContext;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    const size = Math.min(w - 20, h - 20),
      k = size / (SN.EXTENT * 2),
      ox = (w - size) / 2,
      oz = (h - size) / 2,
      X = x => ox + (x + SN.EXTENT) * k,
      Z = z => oz + (z + SN.EXTENT) * k;
    g.drawImage(SN.mapCanvas, ox, oz, size, size);
    g.strokeStyle = "#ccdfca12";
    g.lineWidth = 1;
    for (let v = -3000; v <= 3000; v += 1000) {
      g.beginPath();
      g.moveTo(X(v), oz);
      g.lineTo(X(v), oz + size);
      g.stroke();
      g.beginPath();
      g.moveTo(ox, Z(v));
      g.lineTo(ox + size, Z(v));
      g.stroke();
    }
    g.font = "10px system-ui";
    g.textAlign = "center";
    g.fillStyle = "#a8c4bd";
    g.fillText("北汉山 · BUKHANSAN", X(0), Z(-2900));
    g.fillText("冠岳山 · GWANAKSAN", X(-600), Z(3020));
    g.fillStyle = "#a7dbe2";
    g.fillText("汉 江  /  H A N G A N G", X(1300), Z(500));
    const offsets = [
      [-60, -48],
      [42, -40],
      [66, -8],
      [-65, -20],
      [45, 17],
      [-70, 20],
      [-35, -30],
      [-35, 30],
      [5, 65],
      [0, 34],
      [45, 38],
      [60, -25],
      [-20, -36]
    ];
    for (let i = 0; i < SN.cityDistricts.length; i++) {
      const d = SN.cityDistricts[i],
        x = X(d.x),
        z = Z(d.z),
        dx = offsets[i][0] * (size / 750),
        dz = offsets[i][1] * (size / 750),
        lx = SN.clamp(x + dx, 65, w - 65),
        lz = SN.clamp(z + dz, 14, h - 14);
      g.strokeStyle = i === SN.selectedDistrict ? "#e5c18b" : "#abcab477";
      g.beginPath();
      g.moveTo(x, z);
      g.lineTo(lx, lz);
      g.stroke();
      g.fillStyle = d.color;
      g.beginPath();
      g.arc(x, z, i === SN.selectedDistrict ? 5 : 3, 0, SN.TAU);
      g.fill();
      g.font = (i === SN.selectedDistrict ? "600 " : "") + "11px system-ui";
      const tw = g.measureText(d.name).width;
      g.fillStyle = "#0c2535e8";
      g.fillRect(lx - tw / 2 - 5, lz - 9, tw + 10, 18);
      g.fillStyle = i === SN.selectedDistrict ? "#ffda9e" : "#dfede0";
      g.fillText(d.name, lx, lz + 4);
    }
    for (const hospital of SN.hospitals) {
      g.fillStyle = "#b8f7cc";
      g.fillRect(X(hospital.x) - 3, Z(hospital.z) - 1, 6, 2);
      g.fillRect(X(hospital.x) - 1, Z(hospital.z) - 3, 2, 6);
    }
    for (const station of SN.policeStations) {
      g.strokeStyle = "#84b6eb";
      g.strokeRect(X(station.x) - 2, Z(station.z) - 2, 4, 4);
    }
    for (const stop of SN.subwayStops) {
      g.strokeStyle = "#c8b7eb";
      g.beginPath();
      g.arc(X(stop.x), Z(stop.z), 2, 0, SN.TAU);
      g.stroke();
    }
    for (const contact of SN.contacts) {
      g.fillStyle = "#a5efcb";
      g.save();
      g.translate(X(contact.x), Z(contact.z));
      g.rotate(SN.PI / 4);
      g.fillRect(-2, -2, 4, 4);
      g.restore();
    }
    const target = SN.currentTarget();
    if (target) {
      g.setLineDash([5, 4]);
      g.strokeStyle = "#ffdb9d";
      g.beginPath();
      g.moveTo(X(SN.player.x), Z(SN.player.z));
      g.lineTo(X(target.x), Z(target.z));
      g.stroke();
      g.setLineDash([]);
      g.strokeRect(X(target.x) - 5, Z(target.z) - 5, 10, 10);
    }
    g.save();
    g.translate(X(SN.player.x), Z(SN.player.z));
    g.rotate(-SN.player.yaw + SN.PI);
    g.fillStyle = "#fff4cf";
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(5, 6);
    g.lineTo(0, 3);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.restore();
    g.fillStyle = "#dfebd8";
    g.textAlign = "left";
    g.font = "10px system-ui";
    g.fillText("N ↑", 20, 25);
    g.fillText("1 km", 20, h - 22);
    g.fillRect(20, h - 16, 1000 * k, 2);
  };

  SN.travelToDistrict = function travelToDistrict() {
    if (!SN.cityMapOpen || SN.campaign.active || SN.heat > 0 || SN.player.car)
      return;
    const d = SN.cityDistricts[SN.selectedDistrict], p = SN.safePosition(d.travel[0], d.travel[1], 0.5);
    SN.clearInput();
    Object.assign(SN.player, p, { y: SN.groundUnder(p.x, p.z), vy: 0, speed: 0, motionSpeed: 0, grounded: true });
    SN.player.fallPeak = SN.player.y;
    SN.playerRoot.position.set(SN.player.x, SN.player.y, SN.player.z);
    SN.snapPlayer();
    SN.playerRender.x = p.x;
    SN.playerRender.z = p.z;
    SN.playerRender.y = SN.player.y;
    SN.camTarget.set(p.x, SN.player.y + 1.3, p.z);
    SN.lookTarget.copy(SN.camTarget);
    SN.camera.position.set(p.x, SN.player.y + 3, p.z + 6);
    SN.populationClock = -1;
    SN.updateCityPopulation();
    SN.stageLoanCar();
    SN.snapCars();
    SN.streamCity(true);
    SN.toggleCityMap(false);
    SN.toast("城市接驳 · " + d.name + " · 街边已备车", 4);
    SN.refreshHUD();
  };

  SN.drawMap = function drawMap() {
    const px = SN.player.x,
      pz = SN.player.z,
      range = SN.player.car ? 250 : 175,
      k = SN.mapSize / (range * 2),
      angle = SN.camYaw + SN.PI;
    SN.ctx.clearRect(0, 0, SN.mapSize, SN.mapSize);
    SN.ctx.save();
    SN.ctx.beginPath();
    SN.ctx.arc(180, 180, 177, 0, SN.TAU);
    SN.ctx.clip();
    SN.ctx.fillStyle = "#203d43";
    SN.ctx.fillRect(0, 0, 360, 360);
    SN.ctx.translate(180, 180);
    SN.ctx.rotate(angle);
    SN.ctx.scale(k, k);
    SN.ctx.translate(-px, -pz);
    SN.ctx.drawImage(SN.mapCanvas, -SN.EXTENT, -SN.EXTENT, SN.EXTENT * 2, SN.EXTENT * 2);
    for (const crew of SN.crews) {
      SN.ctx.fillStyle = crew.css + "33";
      SN.ctx.strokeStyle = crew.css + "99";
      SN.ctx.lineWidth = 1.5 / k;
      SN.ctx.beginPath();
      SN.ctx.arc(crew.x, crew.z, crew.radius, 0, SN.TAU);
      SN.ctx.fill();
      SN.ctx.stroke();
    }
    const dot = (x, z, color, r = 3) => {
      SN.ctx.fillStyle = color;
      SN.ctx.beginPath();
      SN.ctx.arc(x, z, r / k, 0, SN.TAU);
      SN.ctx.fill();
    };
    for (const c of SN.cars) {
      if (!c.active || c === SN.player.car)
        continue;
      if (c.role === "police")
        dot(c.x, c.z, Math.floor(SN.simTime * 5) % 2 ? "#ff6464" : "#6ba7ff", 4);
      else
        dot(c.x, c.z, c.marked ? "#ffc776" : c.role === "gang" ? "#ef7661" : "#b1c0b6", 2);
    }
    for (const a of SN.actors) {
      if (!a.active || a.down || a.inCar)
        continue;
      if (a.kind === "police")
        dot(a.x, a.z, Math.floor(SN.simTime * 5) % 2 ? "#ff6464" : "#6ba7ff", 3);
      else if (a.kind === "gang")
        dot(a.x, a.z, a.hostile ? "#ff635b" : SN.crews[a.crew].css, 3);
    }
    for (const p of SN.pickups)
      if (p.cooldown <= 0) {
        SN.ctx.fillStyle = "#ffd38b";
        SN.ctx.fillRect(p.x - 3 / k, p.z - 3 / k, 6 / k, 6 / k);
      }
    for (const h of SN.hospitals) {
      SN.ctx.strokeStyle = "#e4fff0";
      SN.ctx.lineWidth = 2 / k;
      SN.ctx.beginPath();
      SN.ctx.moveTo(h.x - 4 / k, h.z);
      SN.ctx.lineTo(h.x + 4 / k, h.z);
      SN.ctx.moveTo(h.x, h.z - 4 / k);
      SN.ctx.lineTo(h.x, h.z + 4 / k);
      SN.ctx.stroke();
    }
    for (const station of SN.policeStations)
      dot(station.x, station.z, "#7fbbec", 3);
    for (const stop of SN.subwayStops)
      dot(stop.x, stop.z, "#b7a0df", 3);
    for (const d of SN.cityDistricts) {
      if (Math.hypot(d.x - px, d.z - pz) > range * 0.8)
        continue;
      SN.ctx.save();
      SN.ctx.translate(d.x, d.z);
      SN.ctx.rotate(-angle);
      SN.ctx.scale(1 / k, 1 / k);
      SN.ctx.font = "12px system-ui";
      SN.ctx.textAlign = "center";
      SN.ctx.fillStyle = "#ecedda";
      SN.ctx.fillText(d.name, 0, -12);
      SN.ctx.restore();
    }
    for (const contact of SN.contacts)
      dot(contact.x, contact.z, "#90d8c4", 4);
    for (const mesh of SN.objectiveMarkers)
      if (mesh.visible)
        dot(mesh.position.x, mesh.position.z, "#ffcd85", 3);
    if (SN.phoneMapped)
      for (const shop of SN.shopSpecs.concat(SN.smallShopSpecs)) {
        const chain = SN.shopChainOf(shop);
        dot(shop.x, shop.z, chain ? chain.accentCss : shop.kind === "pharmacy" ? "#c8f0d8" : "#ffd59a", shop.kind === "mart" ? 4 : 3);
      }
    const stars = Math.ceil(SN.heat);
    if (stars > 0) {
      SN.ctx.fillStyle = "rgba(255,92,68,.08)";
      SN.ctx.strokeStyle = "rgba(255,120,84,.78)";
      SN.ctx.lineWidth = 2 / k;
      SN.ctx.setLineDash([6 / k, 5 / k]);
      SN.ctx.beginPath();
      SN.ctx.arc(SN.searchX, SN.searchZ, SN.searchRadius, 0, SN.TAU);
      SN.ctx.fill();
      SN.ctx.stroke();
      SN.ctx.setLineDash([]);
    }
    if (SN.helicopter.active)
      dot(SN.helicopter.root.position.x, SN.helicopter.root.position.z, "#d7f4ff", 4);
    const m = SN.currentTarget();
    SN.ctx.strokeStyle = "#b7ffcb8a";
    SN.ctx.setLineDash([5 / k, 5 / k]);
    SN.ctx.lineWidth = 1.5 / k;
    SN.ctx.beginPath();
    SN.ctx.moveTo(px, pz);
    SN.ctx.lineTo(m.x, m.z);
    SN.ctx.stroke();
    SN.ctx.setLineDash([]);
    SN.ctx.restore();
    const dx = (m.x - px) * k, dz = (m.z - pz) * k, ca = Math.cos(angle), sa = Math.sin(angle);
    let mx = ca * dx - sa * dz, mz = sa * dx + ca * dz;
    const dist = Math.hypot(mx, mz);
    if (dist > 155) {
      mx *= 155 / dist;
      mz *= 155 / dist;
    }
    SN.ctx.fillStyle = "#b8ffd0";
    SN.ctx.beginPath();
    SN.ctx.arc(180 + mx, 180 + mz, 6, 0, SN.TAU);
    SN.ctx.fill();
    SN.ctx.strokeStyle = "#b8ffd055";
    SN.ctx.lineWidth = 2;
    SN.ctx.beginPath();
    SN.ctx.arc(180 + mx, 180 + mz, 11 + Math.sin(SN.simTime * 3) * 2, 0, SN.TAU);
    SN.ctx.stroke();
    SN.ctx.save();
    SN.ctx.translate(180, 180);
    SN.ctx.rotate(SN.camYaw - SN.player.yaw);
    SN.ctx.fillStyle = "#fff0cb";
    SN.ctx.beginPath();
    SN.ctx.moveTo(0, -10);
    SN.ctx.lineTo(7, 7);
    SN.ctx.lineTo(0, 4);
    SN.ctx.lineTo(-7, 7);
    SN.ctx.closePath();
    SN.ctx.fill();
    SN.ctx.restore();
    SN.ctx.fillStyle = "#d7ebde";
    SN.ctx.font = "13px system-ui";
    SN.ctx.textAlign = "center";
    SN.ctx.fillText("N", 180 + Math.sin(angle) * 155, 185 - Math.cos(angle) * 155);
  };

  SN.areaName = function areaName(x, z) {
    if (Math.abs(x) > 1150 || z < -1100 || z > 1240)
      return SN.cityDistrictAt(x, z).ko + " · " + SN.cityDistrictAt(x, z).name;
    if (SN.onIsland(x, z))
      return "여의도 · 汝矣岛";
    if (SN.pointInRiver(x, z)) {
      const b = SN.causewayAt(x, z);
      return b ? b.name + " · 汉江大桥" : "한강 · 汉江";
    }
    if (z >= SN.riverSouth(x)) {
      if (z < 950 && z - SN.riverSouth(x) < 70)
        return "한강공원 · 汉江公园";
      if (Math.hypot(x + 130, z - 1080) < 120)
        return "강남역 · 江南站";
      if (Math.abs(z - 1060) < 55)
        return "테헤란로 · 德黑兰路";
      if (Math.abs(z - 900) < 50)
        return "봉은사로 · 奉恩寺路";
      if (Math.abs(x + 130) < 55)
        return "강남대로 · 江南大路";
      return "강남 · 江南";
    }
    if (z > -10 && z < SN.riverNorth(x) + 30)
      return "한강공원 · 汉江公园";
    if (SN.inPalace(x, z, 30))
      return "북궐 · 北阙";
    if (Math.hypot(x, z + 340) < 250)
      return "남산 · 南山";
    if (x > 250 && x < 600 && z > -620 && z < -120)
      return "명동 · 明洞";
    if (Math.hypot(x - 900, z + 612) < 110)
      return "광장시장 · 广藏市场";
    let best = 70, name = "도심 · 市中心";
    for (let i = 0; i < SN.roads.length; i++) {
      const r = SN.roads[i];
      for (let j = 0; j < r.points.length - 1; j++) {
        const a = r.points[j], b = r.points[j + 1], d = SN.segmentDistance(x, z, a[0], a[1], b[0], b[1]);
        if (d < best) {
          best = d;
          name = r.name;
        }
      }
    }
    return name;
  };

  SN.setText = function setText(id, val) {
    const k = id;
    if (SN.domCache.get(k) === val)
      return;
    SN.domCache.set(k, val);
    SN.$(id).textContent = val;
  };

  SN.setStyle = function setStyle(id, prop, val) {
    const k = id + prop;
    if (SN.domCache.get(k) === val)
      return;
    SN.domCache.set(k, val);
    SN.$(id).style[prop] = val;
  };

  SN.setHtml = function setHtml(id, val) {
    const k = id + "h";
    if (SN.domCache.get(k) === val)
      return;
    SN.domCache.set(k, val);
    SN.$(id).innerHTML = val;
  };

  SN.refreshHUD = function refreshHUD() {
    const c = SN.player.car, w = SN.weapons[SN.selectedWeapon];
    SN.setText("area", SN.areaName(SN.player.x, SN.player.z));
    const turf = SN.crews.find(g => Math.hypot(g.x - SN.player.x, g.z - SN.player.z) < g.radius);
    const region = SN.cityDistrictAt(SN.player.x, SN.player.z).ko + " / " + SN.cityDistrictAt(SN.player.x, SN.player.z).name;
    SN.setText("district", turf ? turf.name + " 地盘 · " + (turf.anger > 0 ? "敌对" : "保持克制") : region);
    SN.setText("clock", String(Math.floor(SN.minutes / 60) % 24).padStart(2, "0") + ":" + String(Math.floor(SN.minutes) % 60).padStart(2, "0"));
    SN.setText("speed", String(Math.round(Math.abs(c ? c.speed : SN.player.speed) * 3.6)));
    SN.setText("mode", c ? c.spec.name + " · 车况 " + Math.ceil(c.health) + "%" : SN.GAITS[SN.player.gait].name + " · 首尔探索者");
    SN.setText("money", "¥ " + SN.money.toLocaleString("zh-CN"));
    SN.setStyle("healthBar", "width", SN.player.health + "%");
    SN.setStyle("armorBar", "width", SN.player.armor + "%");
    SN.setText("vitalsText", "生命 " + Math.ceil(SN.player.health) + " · 护甲 " + Math.ceil(SN.player.armor));
    const stars = Math.ceil(SN.heat);
    let starsHtml = "";
    for (let i = 0; i < 5; i++)
      starsHtml += "<span class=\"" + (i < stars ? "" : "dim") + "\">" + (i < stars ? "★" : "☆") + "</span>";
    SN.setHtml("heat", starsHtml);
    SN.$("heat").classList.toggle("searching", stars > 0 && SN.wantedSearch === 1);
    SN.$("heat").classList.toggle("flash", stars > 0 && SN.wantedFlash > 0);
    SN.$("heat").setAttribute("aria-label", "通缉 " + stars + " / 5");
    SN.setText("wantedState", stars > 0 ? (SN.wantedSearch === 2 ? "警方目击 · 追捕中" : "搜索中 · 离开搜索圈后递减") : "");
    SN.setText("weaponName", SN.holstered || !w ? "徒手 · 武器已收起" : w.name);
    SN.setText("ammo", SN.reloadTime > 0 ? "换弹中…" : w && !SN.holstered ? (w.capacity ? w.mag + " / " + w.reserve : "近身武器") : "—");
    SN.setText("weaponHint", c ? "F 下车 · 空格手刹" : SN.holstered ? "Q / 1–3 装备 · 滚轮变焦" : "Q / 1–3 武器 · 滚轮变焦 · H 收起");
    if (c) {
      SN.setHtml("interaction", "<kbd>F</kbd>下车 · 空格手刹 · S 制动 / 倒车");
      SN.$("interaction").classList.add("visible");
    }
    else if (SN.doorTarget) {
      SN.setHtml("interaction", "<kbd>F</kbd>「" + (SN.doorTarget.dir > 0 ? "进入" : "离开") + "」" + SN.doorTarget.e.name);
      SN.$("interaction").classList.add("visible");
    }
    else if (SN.nearestCar && SN.nearDistance < 5.5) {
      SN.setHtml("interaction", "<kbd>F</kbd>" + (SN.nearestCar.driver ? "拉出驾驶员并接管" : "驾驶") + " · " + SN.nearestCar.spec.name);
      SN.$("interaction").classList.add("visible");
    }
    else
      SN.$("interaction").classList.remove("visible");
    SN.setText("touchEnter", c ? "下车" : "上车");
    SN.refreshWeaponSlots();
    SN.refreshMissionHUD();
    SN.drawMap();
  };
  // Startup phase 28: keep this order relative to the other systems.

  SN.registerInit(28, function initializeHud28() {
    SN.toastTime = 0;
  });
  // Startup phase 30: keep this order relative to the other systems.

  SN.registerInit(30, function initializeHud30() {
    SN.slotElements = [];
    for (let i = 0; i < 3; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      const cv = document.createElement("canvas");
      cv.width = 88;
      cv.height = 88;
      slot.appendChild(cv);
      const tag = document.createElement("small");
      tag.textContent = String(i + 1);
      slot.appendChild(tag);
      SN.$("weaponSlots").appendChild(slot);
      SN.slotElements.push({ slot, cv });
    }
  });
  // Startup phase 34: keep this order relative to the other systems.

  SN.registerInit(34, function initializeHud34() {
    // World-space pickup popups and character speech bubbles are pooled DOM nodes.
    SN.bubblePool = [];
    SN.popPool = [];
    SN.speechLayer = SN.$("speechLayer");
    SN.popupLayer = SN.$("worldPopups");
    for (let i = 0; i < 10; i++) {
      const el = document.createElement("div");
      el.className = "bubble";
      el.style.display = "none";
      SN.speechLayer.appendChild(el);
      SN.bubblePool.push({ el, life: 0, total: 2.6, x: 0, y: 0, z: 0 });
    }
    for (let i = 0; i < 14; i++) {
      const el = document.createElement("div");
      el.className = "pop";
      el.style.display = "none";
      SN.popupLayer.appendChild(el);
      SN.popPool.push({ el, life: 0, total: 1.3, x: 0, y: 0, z: 0 });
    }
    SN.bubbleCursor = 0;
    SN.popCursor = 0;
    SN.projectVector = new SN.T.Vector3();
    SN.screenPoint = { x: 0, y: 0 };
  });
  // Startup phase 42: keep this order relative to the other systems.

  SN.registerInit(42, function initializeHud42() {
    // A cached, canvas-drawn map of the actual playable world.
    SN.mapCanvas = document.createElement("canvas");
    SN.mapCanvas.width = 2048;
    SN.mapCanvas.height = 2048;
    SN.mg = SN.mapCanvas.getContext("2d");
    SN.mapScale = 2048 / (SN.EXTENT * 2);
    SN.mg.fillStyle = "#29494b";
    SN.mg.fillRect(0, 0, 2048, 2048);
    SN.mg.translate(1024, 1024);
    SN.mg.scale(SN.mapScale, SN.mapScale);
    SN.mg.fillStyle = "#375c53";
    for (let i = 0; i < SN.hillDefs.length; i++) {
      const h = SN.hillDefs[i];
      SN.mg.beginPath();
      SN.mg.arc(h[0], h[1], h[2], 0, SN.TAU);
      SN.mg.fill();
    }
    SN.mg.fillStyle = "#326e7b";
    SN.mg.beginPath();
    for (let x = -SN.WORLD; x <= SN.WORLD; x += 25) {
      const z = SN.riverNorth(x);
      if (x === -SN.WORLD)
        SN.mg.moveTo(x, z);
      else
        SN.mg.lineTo(x, z);
    }
    for (let x = SN.WORLD; x >= -SN.WORLD; x -= 25)
      SN.mg.lineTo(x, SN.riverSouth(x));
    SN.mg.closePath();
    SN.mg.fill();
    SN.mg.fillStyle = "#4c7468";
    SN.mg.beginPath();
    SN.mg.ellipse(SN.island.x, SN.island.z, SN.island.rx, SN.island.rz, 0, 0, SN.TAU);
    SN.mg.fill();
    SN.mg.fillStyle = "#46665b";
    SN.mg.fillRect(-315, -1105, 650, 285);
    SN.mg.fillStyle = "#5d6b60";
    SN.mg.fillRect(806, -652, 188, 80);
    SN.mg.fillStyle = "#53716c";
    for (let i = 0; i < SN.colliders.length; i++) {
      const b = SN.colliders[i];
      SN.mg.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ);
    }
    for (const b of SN.placedBuildings) {
      SN.mg.save();
      SN.mg.translate(b.x, b.z);
      SN.mg.rotate(-b.yaw);
      SN.mg.fillRect(-b.w / 2, -b.d / 2, b.w, b.d);
      SN.mg.restore();
    }
    SN.mg.lineCap = "round";
    for (let i = 0; i < SN.roads.length; i++) {
      const r = SN.roads[i];
      SN.mg.strokeStyle = "#94aaa1";
      SN.mg.lineWidth = r.width;
      SN.mg.beginPath();
      for (let j = 0; j < r.points.length; j++) {
        const p = r.points[j];
        if (j === 0)
          SN.mg.moveTo(p[0], p[1]);
        else
          SN.mg.lineTo(p[0], p[1]);
      }
      SN.mg.stroke();
    }
    SN.mg.strokeStyle = "#a8b699";
    SN.mg.lineWidth = 10;
    for (let i = 0; i < SN.paths.length; i++) {
      const p = SN.paths[i];
      SN.mg.beginPath();
      SN.mg.moveTo(p.a[0], p.a[1]);
      SN.mg.lineTo(p.b[0], p.b[1]);
      SN.mg.stroke();
    }
    SN.mg.fillStyle = "#326e7b";
    SN.mg.beginPath();
    SN.mg.ellipse(SN.lakePark.x, SN.lakePark.z, SN.lakePark.rx, SN.lakePark.rz, 0, 0, SN.TAU);
    SN.mg.fill();
    SN.mg.fillStyle = "#c6c5ad";
    SN.mg.fillRect(-3186, -2975, 52, 2150);
    SN.mg.fillStyle = "#718b91";
    SN.mg.fillRect(-2690, -2205, 100, 610);
    SN.mg.setLineDash([25, 15]);
    SN.mg.strokeStyle = "#e1bc80";
    SN.mg.lineWidth = 11;
    for (const e of SN.elevatedSegments) {
      SN.mg.beginPath();
      SN.mg.moveTo(...e.a);
      SN.mg.lineTo(...e.b);
      SN.mg.stroke();
    }
    SN.mg.setLineDash([]);
    SN.mini = SN.$("minimap");
    SN.ctx = SN.mini.getContext("2d");
    SN.mapSize = 360;
  });
  // Startup phase 45: keep this order relative to the other systems.

  SN.registerInit(45, function initializeHud45() {
    SN.cityMapOpen = false;
    SN.selectedDistrict = 0;
    SN.atlas = SN.$("atlasCanvas");
    SN.atlasContext = SN.atlas.getContext("2d");
    SN.$("openCityMap").addEventListener("click", () => SN.toggleCityMap());
    SN.$("minimap").addEventListener("click", () => SN.toggleCityMap());
    SN.$("closeCityMap").addEventListener("click", () => SN.toggleCityMap(false));
    SN.$("atlasTravel").addEventListener("click", SN.travelToDistrict);
    SN.$("districtList").addEventListener("click", event => {
      const button = event.target.closest("[data-district]");
      if (!button)
        return;
      SN.selectedDistrict = Number(button.dataset.district);
      SN.renderAtlasList();
      SN.drawCityAtlas();
    });
    window.addEventListener("resize", SN.drawCityAtlas);
    SN.domCache = new Map();
  });
})(window.SN);
