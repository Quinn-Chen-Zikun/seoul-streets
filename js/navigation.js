/* 共用道路导航、全城地图平移缩放及地图图标。 */
"use strict";
(function (SN) {
  SN.navigationTarget = function navigationTarget() {
    if (SN.player.car && SN.player.car.spec.boat && SN.campaign.active && SN.campaign.active.status === "running") {
      const objective = SN.activeObjective();
      if (objective && objective.type === "race" && objective.boat) return objective;
    }
    if (SN.waypoint) return SN.waypoint;
    const event = SN.streetEvent;
    if (event && event.phase === "running" && Number.isFinite(event.x) && Number.isFinite(event.z))
      return { x: event.x, z: event.z };
    return SN.currentTarget();
  };

  SN.projectToRoad = function projectToRoad(x, z) {
    let best = null, distance = Infinity;
    for (let i = 0; i < SN.roadNodes.length; i++) {
      const a = SN.roadNodes[i];
      for (const edge of a.links) {
        if (edge.index <= i) continue;
        const b = SN.roadNodes[edge.index], dx = b.x - a.x, dz = b.z - a.z, len = dx * dx + dz * dz;
        if (len < 0.01) continue;
        const t = SN.clamp(((x - a.x) * dx + (z - a.z) * dz) / len, 0, 1), px = a.x + dx * t, pz = a.z + dz * t;
        const d = (x - px) ** 2 + (z - pz) ** 2;
        if (d < distance) { distance = d; best = { x: px, z: pz, a: i, b: edge.index }; }
      }
    }
    return best;
  };

  SN.roadRoute = function roadRoute(from, to) {
    const start = SN.projectToRoad(from.x, from.z), goal = SN.projectToRoad(to.x, to.z);
    if (!start || !goal) return [];
    if (start.a === goal.a && start.b === goal.b) return [start, goal];
    let best = [], bestDistance = Infinity;
    for (const end of [goal.a, goal.b]) {
      const tree = SN.navigationTree(end);
      for (const first of [start.a, start.b]) {
        const path = [start]; let current = first, distance = 0;
        const seen = new Set();
        while (current >= 0 && SN.roadNodes[current] && !seen.has(current)) {
          seen.add(current); const n = SN.roadNodes[current], previous = path[path.length - 1];
          path.push(n); distance += Math.hypot(n.x - previous.x, n.z - previous.z);
          if (current === end) break;
          current = tree[current];
        }
        if (current !== end) continue;
        const last = path[path.length - 1]; distance += Math.hypot(last.x - goal.x, last.z - goal.z);
        if (distance < bestDistance) { bestDistance = distance; best = path.concat([goal]); }
      }
    }
    return best;
  };

  function isBoatRaceTarget(target) {
    return !!target && SN.campaign.active && SN.campaign.active.status === "running" &&
      target.type === "race" && target.boat && SN.player.car && SN.player.car.spec.boat;
  }

  SN.getGPSRoute = function getGPSRoute(target = SN.navigationTarget()) {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) return [];
    if (isBoatRaceTarget(target)) return [SN.player, target];
    const cache = SN.gpsCache;
    if (!cache || SN.simTime > cache.until || Math.hypot(cache.x - target.x, cache.z - target.z) > 20 || Math.hypot(cache.px - SN.player.x, cache.pz - SN.player.z) > 35) {
      SN.gpsCache = { x: target.x, z: target.z, px: SN.player.x, pz: SN.player.z, until: SN.simTime + 1,
        route: SN.roadRoute(SN.player, target) };
    }
    return SN.gpsCache.route;
  };

  SN.missionRoadCircuit = function missionRoadCircuit(points) {
    const circuit = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      for (const p of SN.roadRoute({ x: a[0], z: a[1] }, { x: b[0], z: b[1] })) {
        const last = circuit[circuit.length - 1];
        if (!last || Math.hypot(last[0] - p.x, last[1] - p.z) > 3) circuit.push([p.x, p.z]);
      }
    }
    return circuit.length > 1 ? circuit : points;
  };

  SN.drawGPS = function drawGPS(g, X, Z, width) {
    const target = SN.navigationTarget(), route = SN.getGPSRoute(target);
    if (!route.length) return;
    const boatRace = isBoatRaceTarget(target);
    g.strokeStyle = target === SN.waypoint ? "#58e4ef" : "#ffd34d"; g.lineWidth = width; g.lineJoin = "round";
    // A dashed bearing points to the buoy without implying a collision-free route.
    if (boatRace) g.setLineDash([width * 2, width * 2]);
    g.beginPath(); route.forEach((p, i) => { if (!i) g.moveTo(X(p.x), Z(p.z)); else g.lineTo(X(p.x), Z(p.z)); }); g.stroke();
    if (boatRace) { g.setLineDash([]); return; }
    // Dashed ends indicate the short on-foot section between a street and a door.
    g.setLineDash([width * 2, width * 2]); g.lineWidth = width * 0.65;
    g.beginPath(); g.moveTo(X(SN.player.x), Z(SN.player.z)); g.lineTo(X(route[0].x), Z(route[0].z));
    const last = route[route.length - 1]; g.moveTo(X(last.x), Z(last.z)); g.lineTo(X(target.x), Z(target.z)); g.stroke(); g.setLineDash([]);
  };

  SN.drawStreetMapIcons = function drawStreetMapIcons(g, X, Z, size, local = false) {
    for (const p of SN.streetPoints) {
      if (p.kind === "story" && p.index !== SN.campaign.progress) continue;
      if (local && Math.hypot(p.x - SN.player.x, p.z - SN.player.z) > 360) continue;
      g.fillStyle = p.color; g.beginPath(); g.arc(X(p.x), Z(p.z), size * 0.65, 0, SN.TAU); g.fill();
      g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold " + size + "px sans-serif";
      g.fillStyle = "#102a35"; g.fillText(p.glyph, X(p.x), Z(p.z) + 0.5);
    }
    if (local) for (const [i, cat] of SN.luckyCats.entries()) {
      if (SN.progression.cats.includes(i) || Math.hypot(cat.x - SN.player.x, cat.z - SN.player.z) > 45) continue;
      g.fillStyle = "#ffe5a4"; g.fillRect(X(cat.x) - size / 4, Z(cat.z) - size / 4, size / 2, size / 2);
    }
    g.textBaseline = "alphabetic";
  };

  SN.setWaypoint = function setWaypoint(x, z) {
    if (![x, z].every(Number.isFinite)) return;
    SN.waypoint = { x: SN.clamp(x, -SN.WORLD + 20, SN.WORLD - 20), z: SN.clamp(z, -SN.WORLD + 20, SN.WORLD - 20) };
    SN.gpsCache = null;
    SN.setText("atlasWaypoint", "已设导航点 · " + (Math.hypot(x - SN.player.x, z - SN.player.z) / 1000).toFixed(2) + " km");
  };

  SN.bindNavigation = function bindNavigation() {
    const pointers = new Map(); let start = null, moved = false, pinch = 0;
    const zoom = factor => { SN.atlasView.zoom = SN.clamp(SN.atlasView.zoom * factor, 1, 8); SN.drawCityAtlas(); };
    SN.$("atlasZoomIn").addEventListener("click", () => zoom(1.4));
    SN.$("atlasZoomOut").addEventListener("click", () => zoom(1 / 1.4));
    SN.$("atlasCenter").addEventListener("click", () => { SN.atlasView.x = SN.player.x; SN.atlasView.z = SN.player.z; SN.drawCityAtlas(); });
    SN.$("atlasClear").addEventListener("click", () => { SN.waypoint = null; SN.gpsCache = null; SN.setText("atlasWaypoint", "拖动平移 · 滚轮 / 双指缩放 · 点按设置导航"); SN.drawCityAtlas(); });
    SN.atlas.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY > 0 ? 0.85 : 1.18); }, { passive: false });
    SN.atlas.addEventListener("pointerdown", e => {
      e.preventDefault(); SN.capturePointer(SN.atlas, e); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = { x: e.clientX, y: e.clientY }; moved = false;
      if (pointers.size === 2) { const a = [...pointers.values()]; pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); moved = true; }
    });
    SN.atlas.addEventListener("pointermove", e => {
      const previous = pointers.get(e.pointerId); if (!previous || !SN.atlasTransform) return;
      const dx = e.clientX - previous.x, dy = e.clientY - previous.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const a = [...pointers.values()], distance = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (pinch > 0) zoom(distance / pinch); pinch = distance; moved = true;
      } else {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) moved = true;
        if (moved) { SN.atlasView.x = SN.clamp(SN.atlasView.x - dx / SN.atlasTransform.k, -SN.WORLD, SN.WORLD); SN.atlasView.z = SN.clamp(SN.atlasView.z - dy / SN.atlasTransform.k, -SN.WORLD, SN.WORLD); SN.drawCityAtlas(); }
      }
    });
    const end = e => {
      if (!pointers.has(e.pointerId)) return;
      if (!moved && pointers.size === 1 && e.type === "pointerup" && SN.atlasTransform) {
        const r = SN.atlas.getBoundingClientRect(), t = SN.atlasTransform;
        SN.setWaypoint((e.clientX - r.left - t.ox) / t.k - SN.EXTENT, (e.clientY - r.top - t.oz) / t.k - SN.EXTENT);
        SN.drawCityAtlas();
      }
      pointers.delete(e.pointerId); pinch = 0;
      if (pointers.size) { start = [...pointers.values()][0]; moved = true; }
    };
    SN.atlas.addEventListener("pointerup", end); SN.atlas.addEventListener("pointercancel", end); SN.atlas.addEventListener("lostpointercapture", end);
  };
  SN.registerInit(25.7, function initializeNavigation() {
    SN.waypoint = null; SN.gpsCache = null; SN.atlasTransform = null;
    SN.atlasView = { x: 0, z: 0, zoom: 1 };
  });
})(window.SN);
