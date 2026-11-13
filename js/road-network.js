/* Road network: shared C1 height profiles, junction ownership, meshes and terrain cut/fill. */
(function (SN) {
  const ROAD_STEP = 4,
    CONTROL_STEP = 40,
    BLEND_WIDTH = 28,
    BRIDGE_RAMP = 300,
    GRADE_LIMIT = 0.04;

  function pointOnPolyline(road, s) {
    s = SN.clamp(s, 0, road.length);
    const segments = road.segments;
    let lo = 0, hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid].s1 < s)
        lo = mid + 1;
      else
        hi = mid;
    }
    const seg = segments[lo], t = seg.len > 1e-8 ? (s - seg.s0) / seg.len : 0;
    return {
      x: SN.lerp(seg.a[0], seg.b[0], t),
      z: SN.lerp(seg.a[1], seg.b[1], t),
      tx: seg.dx / seg.len,
      tz: seg.dz / seg.len,
      nx: seg.dz / seg.len,
      nz: -seg.dx / seg.len,
      yaw: seg.yaw
    };
  }
  SN.roadPointAt = function roadPointAt(road, s) {
    return pointOnPolyline(road, s);
  };

  SN.closestRoadPoint = function closestRoadPoint(road, x, z) {
    let best = null, distance = Infinity;
    for (const seg of road.segments) {
      const den = seg.dx * seg.dx + seg.dz * seg.dz;
      const t = den > 1e-10 ? SN.clamp(((x - seg.a[0]) * seg.dx + (z - seg.a[1]) * seg.dz) / den, 0, 1) : 0;
      const px = seg.a[0] + seg.dx * t, pz = seg.a[1] + seg.dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < distance) {
        distance = d;
        best = {
          distance: d,
          s: seg.s0 + seg.len * t,
          x: px,
          z: pz,
          across: ((x - px) * seg.dz - (z - pz) * seg.dx) / seg.len
        };
      }
    }
    return best;
  };

  SN.bridgeProfile = function bridgeProfile(b, z) {
    const base = 0.12, deck = SN.BRIDGE_DECK === undefined ? 9 : SN.BRIDGE_DECK;
    const edge = Math.min(z - b.z0, b.z1 - z);
    return base + (deck - base) * SN.smoothRange(0, BRIDGE_RAMP, edge);
  };

  function bankProfile(road, s) {
    const edge = Math.min(s, road.length - s);
    return 0.2 + 7.8 * SN.smoothRange(0, BRIDGE_RAMP, edge);
  }

  function rampProfile(road, s) {
    const h = road.rampHeights;
    if (!h || h.length < 2)
      return 0.2;
    for (let i = 0; i < road.segments.length; i++) {
      const seg = road.segments[i];
      if (s <= seg.s1 || i === road.segments.length - 1) {
        const t = seg.len > 1e-8 ? SN.clamp((s - seg.s0) / seg.len, 0, 1) : 0;
        return SN.lerp(h[i], h[Math.min(i + 1, h.length - 1)], SN.smoothRange(0, 1, t));
      }
    }
    return h[h.length - 1];
  }

  function specialHeight(profile, s) {
    if (profile.kind === "bridge")
      return SN.bridgeProfile(profile.bridgeDef, pointOnPolyline(profile.road, s).z);
    if (profile.kind === "bank")
      return bankProfile(profile.road, s);
    if (profile.kind === "ramp")
      return rampProfile(profile.road, s);
    return null;
  }

  function hermite(profile, s) {
    const c = profile.controls, m = profile.ms;
    if (c.length === 1)
      return c[0].y;
    s = SN.clamp(s, 0, profile.length);
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (c[mid].s < s)
        lo = mid;
      else
        hi = mid;
    }
    const h = c[hi].s - c[lo].s;
    if (h < 1e-8)
      return c[lo].y;
    const t = (s - c[lo].s) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * c[lo].y + (t3 - 2 * t2 + t) * h * m[lo] +
      (-2 * t3 + 3 * t2) * c[hi].y + (t3 - t2) * h * m[hi];
  }

  SN.roadProfileHeight = function roadProfileHeight(profile, s) {
    if (!profile)
      return 0;
    const fixed = specialHeight(profile, s);
    return fixed === null ? hermite(profile, s) : fixed;
  };

  SN.roadProfileSlope = function roadProfileSlope(profile, s) {
    s = SN.clamp(s, 0.01, profile.length - 0.01);
    return (SN.roadProfileHeight(profile, s + 0.05) - SN.roadProfileHeight(profile, s - 0.05)) / 0.1;
  };

  SN.roadSample = function roadSample(x, z, padding = 0, hint = null) {
    const profiles = SN.roadProfileCells.get(Math.floor(x / 100) + "," + Math.floor(z / 100)) || [];
    let best = null, bestScore = Infinity, bestDistance = Infinity;
    for (const profile of profiles) {
      const closest = SN.closestRoadPoint(profile.road, x, z);
      const edge = profile.width / 2 + (profile.sidewalkW || 2) + 0.3;
      let distance = closest.distance;
      // Bridge ends own the last few metres of their approach so a lower road
      // passing underneath cannot steal the wheels or the camera floor.
      if (profile.bridge && distance <= edge + 32 &&
        (closest.s < 0.5 || closest.s > profile.length - 0.5))
        distance = Math.max(0, distance - 30);
      if (distance > edge + padding)
        continue;
      const height = SN.roadProfileHeight(profile, closest.s);
      let score = distance;
      // At a crossing the two centre lines are both at distance zero, so height
      // is what tells the wheels which road they belong to. A level difference of
      // one metre costs far more than any plausible sideways offset, which keeps
      // the lower street from snapping up onto an overpass (and back down again).
      if (hint !== null)
        score += Math.max(0, Math.abs(height - hint) - 0.35) * 20;
      if (score < bestScore - 1e-6 ||
        (Math.abs(score - bestScore) < 1e-6 && best && height < best.height)) {
        bestScore = score;
        bestDistance = closest.distance;
        best = { profile, distance, edge, height, across: closest.across, s: closest.s };
      }
    }
    return best;
  };

  SN.roadHeight = function roadHeight(x, z, hint = null) {
    const sample = SN.roadSample(x, z, 0, hint);
    return sample ? sample.height : SN.hillHeight(x, z);
  };

  SN.roadTerrainHeight = function roadTerrainHeight(x, z, natural = SN.hillHeight(x, z)) {
    const sample = SN.roadSample(x, z, BLEND_WIDTH);
    if (!sample)
      return natural;
    const lifted = sample.profile.bridge || sample.profile.elevated;
    // A deck above open ground stays a bridge. A deck lower than the hillside
    // is a cut, or the mountain swallows the road at its approach.
    if (lifted && natural <= sample.height + 0.4)
      return natural;
    const inner = sample.edge + 0.3, outer = inner + BLEND_WIDTH;
    if (sample.distance <= inner)
      return sample.height + 0.02;
    const blend = 1 - SN.smoothRange(inner, outer, sample.distance);
    return SN.lerp(natural, sample.height + 0.02, blend);
  };

  function lineCrossing(a, b, c, d) {
    const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1];
    const den = rx * sz - rz * sx;
    if (Math.abs(den) < 1e-8)
      return null;
    const qx = c[0] - a[0], qz = c[1] - a[1];
    const t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
    if (t < 0.004 || t > 0.996 || u < 0.004 || u > 0.996)
      return null;
    return { t, u, x: a[0] + rx * t, z: a[1] + rz * t };
  }

  function layerHeight(road, x, z, s) {
    if (road.special === "bridge")
      return SN.bridgeProfile(road.bridgeDef, z);
    if (road.special === "bank")
      return bankProfile(road, s);
    if (road.special === "ramp")
      return rampProfile(road, s);
    return SN.onIsland(x, z) ? 0.8 : SN.hillHeight(x, z);
  }

  function separated(a, b, ha, hb) {
    // The riverside expressways are a true upper deck: only their ramps join them.
    if (a.special === "bank" && b.special !== "ramp" && !b.bridge)
      return true;
    if (b.special === "bank" && a.special !== "ramp" && !a.bridge)
      return true;
    return Math.abs(ha - hb) > 3 && (a.special || b.special);
  }

  function makeControls(road) {
    const positions = [0, road.length];
    for (let s = CONTROL_STEP; s < road.length - 1; s += CONTROL_STEP)
      positions.push(s);
    for (const event of road.events)
      positions.push(event.s);
    positions.sort((a, b) => a - b);
    const unique = [];
    for (const s of positions)
      if (!unique.length || Math.abs(s - unique[unique.length - 1]) > 6)
        unique.push(SN.clamp(s, 0, road.length));
    const controls = unique.map(s => {
      const p = pointOnPolyline(road, s);
      return {
        s,
        x: p.x,
        z: p.z,
        y: layerHeight(road, p.x, p.z, s),
        natural: SN.onIsland(p.x, p.z) ? 0.8 : SN.hillHeight(p.x, p.z),
        node: false,
        group: null
      };
    });
    for (const event of road.events) {
      let best = controls[0];
      for (const control of controls)
        if (Math.abs(control.s - event.s) < Math.abs(best.s - event.s))
          best = control;
      event.control = best;
      best.node = true;
    }
    road.controls = controls;
    return controls;
  }

  function pchipSlopes(controls) {
    const n = controls.length, ms = new Array(n).fill(0);
    if (n < 2)
      return ms;
    const delta = new Array(n - 1);
    for (let i = 0; i < n - 1; i++)
      delta[i] = (controls[i + 1].y - controls[i].y) / Math.max(1e-6, controls[i + 1].s - controls[i].s);
    for (let i = 1; i < n - 1; i++) {
      const h0 = controls[i].s - controls[i - 1].s, h1 = controls[i + 1].s - controls[i].s;
      const d0 = delta[i - 1], d1 = delta[i];
      if (d0 * d1 <= 0)
        ms[i] = 0;
      else {
        const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
        ms[i] = (w1 + w2) / (w1 / d0 + w2 / d1);
      }
    }
    ms[0] = 0;
    ms[n - 1] = 0;
    return ms;
  }

  function moveControl(control, y) {
    const delta = y - control.y;
    if (control.groupMembers) {
      for (const member of control.groupMembers)
        member.y += delta;
    }
    else
      control.y = y;
  }

  // Grade limiting as a stable cut/fill sweep. Each pass only lowers a point
  // that sits above its neighbour's reachable window, or raises one that sits
  // below it; neither operator can amplify a value, so the profile settles
  // instead of drifting. Junction groups move as a unit through moveControl.
  function gradeClamp(road) {
    const c = road.controls;
    if (road.special || c.length < 2)
      return;
    const roadLimit = mountainRoad(road) ? 0.12 : GRADE_LIMIT;
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i];
      if (a.locked && b.locked)
        continue;
      const limit = roadLimit * (b.s - a.s);
      const dy = b.y - a.y;
      if (Math.abs(dy) <= limit)
        continue;
      const sign = Math.sign(dy), mid = (a.y + b.y) / 2;
      if (!a.locked && !b.locked) {
        moveControl(a, mid - sign * limit / 2);
        moveControl(b, mid + sign * limit / 2);
      } else if (!b.locked)
        moveControl(b, a.y + sign * limit);
      else
        moveControl(a, b.y - sign * limit);
    }
    for (let i = c.length - 2; i >= 0; i--) {
      const a = c[i], b = c[i + 1];
      if (a.locked && b.locked)
        continue;
      const limit = roadLimit * (b.s - a.s);
      const dy = b.y - a.y;
      if (Math.abs(dy) <= limit)
        continue;
      const sign = Math.sign(dy), mid = (a.y + b.y) / 2;
      if (!a.locked && !b.locked) {
        moveControl(a, mid - sign * limit / 2);
        moveControl(b, mid + sign * limit / 2);
      } else if (!b.locked)
        moveControl(b, a.y + sign * limit);
      else
        moveControl(a, b.y - sign * limit);
    }
  }

  function resolveProfiles(roads) {
    const groups = new Map();
    for (const road of roads)
      for (const control of road.controls) {
        control.roadRef = road;
        control.groupMembers = null;
        control.locked = false;
        if (control.group) {
          if (!groups.has(control.group))
            groups.set(control.group, []);
          groups.get(control.group).push(control);
        }
      }
    for (const members of groups.values()) {
      const elevated = members.filter(control => control.special);
      if (!elevated.length) {
        const ground = members.reduce((sum, control) => sum + control.natural, 0) / members.length;
        for (const control of members) {
          control.y = ground;
          control.groupMembers = members;
          control.locked = false;
        }
        continue;
      }
      // An elevated road that meets the street at roughly its own level is a
      // real connection (a bridge landing, a ramp foot) and the two must share
      // one height. Only a deck passing well above the ground is a flyover, and
      // there the street keeps its own level instead of being lifted skyward.
      const ground = members.filter(control => !control.special);
      const groundLevel = ground.length ? ground.reduce((sum, control) => sum + control.natural, 0) / ground.length : 0;
      const deckLevel = elevated.reduce((sum, control) => sum + control.y, 0) / elevated.length;
      const bridgeLanding = elevated.some(control => control.roadRef && control.roadRef.bridge &&
        (control.s <= 0.6 || control.s >= control.roadRef.length - 0.6));
      if (bridgeLanding || Math.abs(deckLevel - groundLevel) <= 3) {
        for (const control of members) {
          control.y = deckLevel;
          control.groupMembers = members;
          control.locked = true;
        }
        continue;
      }
      for (const control of ground) {
        control.y = control.natural;
        control.groupMembers = ground.length > 1 ? ground : null;
        control.locked = false;
      }
      for (const control of elevated) {
        control.groupMembers = elevated.length > 1 ? elevated : null;
        control.locked = true;
      }
    }
    // Rebuild the junction audit list from the split groups so a flyover is not
    // mistaken for two streets meeting at a mismatched height.
    SN.roadJunctions = [];
    for (const members of groups.values()) {
      if (members.length < 2)
        continue;
      for (const level of [members.filter(control => !control.special), members.filter(control => control.special)])
        if (level.length > 1)
          SN.roadJunctions.push({ height: level[0].y, members: level.map(control => ({ control })) });
    }
    // Gwanghwamun frontage: junction averaging with the riverside expressway
    // lifted the dead-end palace approach into a 5.5 m road slab that buried the
    // gate and courtyard. Anchor the palace plaza to ground level before the
    // grade passes so the 4% limit ramps the surrounding streets naturally.
    const inPalacePlaza = control => control.x >= -340 && control.x <= 360 && control.z >= -890 && control.z <= -755;
    for (const road of roads) {
      if (road.special)
        continue;
      for (const control of road.controls) {
        if (!inPalacePlaza(control))
          continue;
        control.y = 0.12;
        control.locked = true;
        if (control.groupMembers)
          for (const member of control.groupMembers) {
            member.y = 0.12;
            member.locked = true;
          }
      }
    }
    for (let pass = 0; pass < 260; pass++) {
      for (const road of roads) {
        if (road.special)
          continue;
        const c = road.controls;
        for (let i = 1; i < c.length - 1; i++)
          if (!c[i].locked && !c[i].groupMembers)
            c[i].y = c[i].y * 0.66 + (c[i - 1].y + c[i + 1].y) * 0.17;
      }
      for (const road of roads)
        gradeClamp(road);
    }
    for (let pass = 0; pass < 420; pass++)
      for (const road of roads)
        gradeClamp(road);
    for (const members of groups.values()) {
      const rep = members[0], natural = rep.natural;
      moveControl(rep, SN.clamp(rep.y, natural - 80, natural + 80));
    }
    for (const road of roads)
      for (const control of road.controls)
        if (!control.groupMembers)
          control.y = SN.clamp(control.y, control.natural - 80, control.natural + 80);
    for (let pass = 0; pass < 160; pass++)
      for (const road of roads)
        gradeClamp(road);
  }

  function buildJunctions(roads) {
    for (const road of roads)
      road.events = [];
    const links = [];
    const addEvent = (road, s) => {
      const event = { s: SN.clamp(s, 0, road.length), control: null };
      road.events.push(event);
      return event;
    };
    for (let i = 0; i < roads.length; i++) {
      const a = roads[i];
      for (let j = i + 1; j < roads.length; j++) {
        const b = roads[j];
        for (const sa of a.segments)
          for (const sb of b.segments) {
            const hit = lineCrossing(sa.a, sa.b, sb.a, sb.b);
            if (!hit)
              continue;
            const sA = sa.s0 + sa.len * hit.t, sB = sb.s0 + sb.len * hit.u;
            const ha = layerHeight(a, hit.x, hit.z, sA), hb = layerHeight(b, hit.x, hit.z, sB);
            if (separated(a, b, ha, hb))
              continue;
            links.push({ a, sA, b, sB });
          }
      }
    }
    const endpoints = [];
    for (const road of roads)
      endpoints.push({ road, s: 0, x: road.points[0][0], z: road.points[0][1] },
        { road, s: road.length, x: road.points[road.points.length - 1][0], z: road.points[road.points.length - 1][1] });
    for (const end of endpoints) {
      let best = null, distance = 6;
      for (const other of roads) {
        if (other === end.road)
          continue;
        const closest = SN.closestRoadPoint(other, end.x, end.z);
        if (closest.distance < distance) {
          distance = closest.distance;
          best = { other, s: closest.s };
        }
      }
      if (!best || (best.s < 0.5 || best.s > best.other.length - 0.5) && best.other === end.road)
        continue;
      const ha = layerHeight(end.road, end.x, end.z, end.s);
      const point = pointOnPolyline(best.other, best.s);
      const hb = layerHeight(best.other, point.x, point.z, best.s);
      if (!end.road.bridge && separated(end.road, best.other, ha, hb))
        continue;
      links.push({ a: end.road, sA: end.s, b: best.other, sB: best.s });
    }
    for (const link of links) {
      if (link.a === link.b)
        continue;
      const ea = addEvent(link.a, link.sA), eb = addEvent(link.b, link.sB);
    }
    for (const road of roads) {
      const controls = makeControls(road);
      for (const event of road.events) {
        if (!event.control) {
          let best = controls[0];
          for (const control of controls)
            if (Math.abs(control.s - event.s) < Math.abs(best.s - event.s))
              best = control;
          event.control = best;
        }
      }
    }
    const parent = new Map();
    const keyOf = (road, control) => road._index + ":" + control.s.toFixed(2);
    const find = key => {
      while (parent.get(key) !== key) {
        parent.set(key, parent.get(parent.get(key)));
        key = parent.get(key);
      }
      return key;
    };
    const union = (a, b) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb)
        parent.set(ra, rb);
    };
    for (const road of roads)
      for (const control of road.controls) {
        const key = keyOf(road, control);
        parent.set(key, key);
        control.special = !!road.special;
      }
    for (const link of links) {
      if (link.a === link.b)
        continue;
      let ca = null, cb = null;
      for (const event of link.a.events)
        if (Math.abs(event.s - link.sA) < 0.6)
          ca = event.control;
      for (const event of link.b.events)
        if (Math.abs(event.s - link.sB) < 0.6)
          cb = event.control;
      if (ca && cb)
        union(keyOf(link.a, ca), keyOf(link.b, cb));
    }
    const groups = new Map();
    for (const road of roads)
      for (const control of road.controls) {
        const root = find(keyOf(road, control));
        if (!groups.has(root))
          groups.set(root, []);
        groups.get(root).push(control);
      }
    for (const [root, members] of groups) {
      if (members.length < 2)
        continue;
      for (const control of members)
        control.group = root;
    }
    SN.roadJunctions = [];
    for (const [root, members] of groups) {
      if (members.length < 2)
        continue;
      const special = members.find(control => control.special);
      const height = special ? special.y : members.reduce((sum, control) => sum + control.y, 0) / members.length;
      for (const control of members)
        control.y = height;
      SN.roadJunctions.push({ height, members: members.map(control => ({ control })) });
    }
    return groups;
  }

  function finalizeProfiles(roads) {
    for (const road of roads) {
      const profile = {
        road,
        name: road.name,
        width: road.width,
        sidewalkW: road.sidewalkW,
        laneOffset: road.laneOffset,
        lanes: road.lanes,
        median: road.median,
        pedestrian: road.pedestrian,
        bridge: !!road.bridge,
        elevated: road.special === "bank" || road.special === "ramp",
        kind: road.special || "road",
        bridgeDef: road.bridgeDef,
        length: road.length,
        controls: road.controls,
        ms: pchipSlopes(road.controls)
      };
      road.profile = profile;
      SN.roadProfiles.push(profile);
      const pad = profile.width / 2 + (profile.sidewalkW || 2) + BLEND_WIDTH + 2;
      for (let iz = Math.floor((road.minZ - pad) / 100); iz <= Math.floor((road.maxZ + pad) / 100); iz++)
        for (let ix = Math.floor((road.minX - pad) / 100); ix <= Math.floor((road.maxX + pad) / 100); ix++) {
          const key = ix + "," + iz;
          if (!SN.roadProfileCells.has(key))
            SN.roadProfileCells.set(key, []);
          SN.roadProfileCells.get(key).push(profile);
        }
    }
  }

  function roadSamples(road, step) {
    const list = [0, road.length];
    for (let s = step; s < road.length - 0.1; s += step)
      list.push(s);
    for (const seg of road.segments) {
      list.push(seg.s0);
      list.push(Math.min(road.length, seg.s1));
    }
    list.sort((a, b) => a - b);
    const out = [];
    for (const s of list)
      if (!out.length || Math.abs(s - out[out.length - 1]) > 0.05)
        out.push(s);
    return out;
  }

  function recordPiece(list, ax, az, ay, bx, bz, by, width, lift, height, color = null) {
    const dx = bx - ax, dz = bz - az, horizontal = Math.hypot(dx, dz);
    if (horizontal < 1e-5)
      return null;
    const yaw = Math.atan2(dx, dz), midY = (ay + by) / 2 + lift;
    SN.record(list, (ax + bx) / 2, midY, (az + bz) / 2, width, height, Math.hypot(horizontal, by - ay) + 0.035, yaw, color);
    const piece = list[list.length - 1];
    piece.pitch = -Math.atan2(by - ay, horizontal);
    return piece;
  }

  function addRoadMarkings(road, half) {
    const profile = road.profile, lanes = road.lanes, laneWidth = 3.2;
    if (road.pedestrian || lanes < 2)
      return;
    // Solid edge lines just inside the kerb read the carriageway width at a glance.
    for (const side of [-1, 1])
      for (let s = 2; s < road.length - 2; s += 9) {
        const a = pointOnPolyline(road, s), b = pointOnPolyline(road, s + 9),
          y0 = SN.roadProfileHeight(profile, s), y1 = SN.roadProfileHeight(profile, s + 9),
          off = side * (road.width / 2 - 0.55);
        recordPiece(SN.markBatch,
          a.x + a.nx * off, a.z + a.nz * off, y0,
          b.x + b.nx * off, b.z + b.nz * off, y1,
          0.1, 0.167, 0.018, 0xdce2e6);
      }
    for (let lane = 1; lane < lanes; lane++) {
      const centre = lane === lanes / 2,
        off = (lane - lanes / 2) * laneWidth + (centre ? 0 : Math.sign(lane - lanes / 2) * road.median / 2);
      if (centre && road.median)
        continue;
      if (centre) {
        for (let s = 4; s < road.length - 4; s += 4) {
          const a = pointOnPolyline(road, s), b = pointOnPolyline(road, s + 4);
          const y0 = SN.roadProfileHeight(profile, s), y1 = SN.roadProfileHeight(profile, s + 4);
          for (const side of [-0.13, 0.13])
            recordPiece(SN.markBatch,
              a.x + a.nx * (off + side), a.z + a.nz * (off + side), y0,
              b.x + b.nx * (off + side), b.z + b.nz * (off + side), y1,
              0.1, 0.167, 0.018, 0xcda451);
        }
      } else {
        for (let s = 4; s < road.length - 4; s += 12) {
          const a = pointOnPolyline(road, s), b = pointOnPolyline(road, s + 4);
          const y0 = SN.roadProfileHeight(profile, s), y1 = SN.roadProfileHeight(profile, s + 4);
          recordPiece(SN.markBatch,
            a.x + a.nx * off, a.z + a.nz * off, y0,
            b.x + b.nx * off, b.z + b.nz * off, y1,
            0.12, 0.167, 0.018, 0xffffff);
        }
      }
    }
  }

  function buildRoadMeshes(road) {
    if (road.bridge)
      return;
    const profile = road.profile, samples = roadSamples(road, ROAD_STEP);
    for (let i = 0; i < samples.length - 1; i++) {
      const s0 = samples[i], s1 = samples[i + 1];
      const a = pointOnPolyline(road, s0), b = pointOnPolyline(road, s1);
      const y0 = SN.roadProfileHeight(profile, s0), y1 = SN.roadProfileHeight(profile, s1);
      recordPiece(SN.roadBatch, a.x, a.z, y0, b.x, b.z, y1, profile.width, 0.09, 0.16);
      const nx = (a.nx + b.nx) / 2, nz = (a.nz + b.nz) / 2;
      for (const side of [-1, 1]) {
        const off = (profile.width / 2 + 0.3 + profile.sidewalkW / 2) * side;
        recordPiece(SN.sideBatch, a.x + nx * off, a.z + nz * off, y0, b.x + nx * off, b.z + nz * off, y1,
          profile.sidewalkW, 0.19, 0.32);
        const kerb = (profile.width / 2 + 0.15) * side;
        recordPiece(SN.curbBatch, a.x + nx * kerb, a.z + nz * kerb, y0, b.x + nx * kerb, b.z + nz * kerb, y1,
          0.3, 0.27, 0.16);
      }
    }
    addRoadMarkings(road, profile.width / 2);
    if (road.median)
      for (let s = 6; s < road.length - 6; s += 6) {
        const a = pointOnPolyline(road, s), b = pointOnPolyline(road, s + 6);
        const y0 = SN.roadProfileHeight(profile, s) + 0.28, y1 = SN.roadProfileHeight(profile, s + 6) + 0.28;
        const piece = recordPiece(SN.medianBatch, a.x, a.z, y0, b.x, b.z, y1, road.median, 0, 0.38);
        if (piece)
          piece.median = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: road.median, d: 6, yaw: a.yaw };
      }
    if (road.special !== "bank" && road.special !== "ramp")
      for (let s = 6; s < road.length - 3; s += 8) {
        const a = pointOnPolyline(road, s), b = pointOnPolyline(road, s + 8);
        for (const side of [-1, 1]) {
          const off = (profile.width / 2 + profile.sidewalkW + 0.4) * side;
          const x = (a.x + b.x) / 2 + a.nx * off, z = (a.z + b.z) / 2 + a.nz * off;
          const top = (SN.roadProfileHeight(profile, s) + SN.roadProfileHeight(profile, s + 8)) / 2;
          const bottom = SN.hillHeight(x, z);
          if (Math.abs(top - bottom) <= 0.75)
            continue;
          const piece = recordPiece(SN.retainingBatch,
            a.x + a.nx * off, a.z + a.nz * off, top,
            b.x + b.nx * off, b.z + b.nz * off, top,
            0.38, 0, Math.abs(top - bottom) + 0.4);
          if (piece)
            piece.y = (top + bottom) / 2 - 0.1;
        }
      }
    if (profile.width >= 7)
      for (let s = 27; s < road.length - 14; s += 66) {
        const p = pointOnPolyline(road, s), y = SN.roadProfileHeight(profile, s);
        for (const side of [-1, 1]) {
          const off = (profile.width / 2 + 0.3 + Math.min(1.1, profile.sidewalkW * 0.45)) * side;
          SN.addLamp(p.x + p.nx * off, p.z + p.nz * off, p.yaw, y);
        }
      }
  }

  function buildBridgeMeshes(road, b) {
    const profile = road.profile, deckW = profile.width, half = deckW * 0.5;
    const samples = roadSamples(road, ROAD_STEP);
    for (let i = 0; i < samples.length - 1; i++) {
      const s0 = samples[i], s1 = samples[i + 1];
      const a = pointOnPolyline(road, s0), b1 = pointOnPolyline(road, s1);
      const y0 = SN.roadProfileHeight(profile, s0), y1 = SN.roadProfileHeight(profile, s1);
      recordPiece(SN.sideBatch, a.x, a.z, y0 - 0.16, b1.x, b1.z, y1 - 0.16, deckW + 8, 0, 0.3);
      recordPiece(SN.roadBatch, a.x, a.z, y0, b1.x, b1.z, y1, deckW, 0.09, 0.16);
      for (const side of [-1, 1]) {
        const off = (half + 2.1) * side;
        recordPiece(SN.sideBatch, a.x + side * (half + 2.1), a.z, y0, b1.x + side * (half + 2.1), b1.z, y1, 4, 0.24, 0.22);
        recordPiece(SN.curbBatch, a.x + side * (half + 0.15), a.z, y0, b1.x + side * (half + 0.15), b1.z, y1, 0.3, 0.27, 0.16);
        recordPiece(SN.railBatch, a.x + side * (half - 0.45), a.z, y0, b1.x + side * (half - 0.45), b1.z, y1, 0.32, 0.58, 0.7);
        for (const level of [0.55, 1.22])
          recordPiece(SN.bridgeGirders, a.x + side * (half + 4.05), a.z, y0, b1.x + side * (half + 4.05), b1.z, y1, 0.075, level, 0.075);
        for (const off of [-0.6, 0.6])
          recordPiece(SN.bridgeGirders, a.x + side * half * 0.48 + off, a.z, y0, b1.x + side * half * 0.48 + off, b1.z, y1, 0.12, -1.2, 1.8);
        recordPiece(SN.bridgeGirders, a.x + side * half * 0.48, a.z, y0, b1.x + side * half * 0.48, b1.z, y1, 1.5, -2.05, 0.16);
      }
      if (profile.lanes >= 2)
        for (const side of [-1, 1])
          for (let lane = 1; lane < profile.lanes / 2; lane++) {
            const off = side * (profile.median / 2 + lane * 3.2);
            recordPiece(SN.markBatch, a.x + off, a.z, y0, b1.x + off, b1.z, y1, 0.12, 0.167, 0.018);
          }
      if (profile.median) {
        const piece = recordPiece(SN.medianBatch, a.x, a.z, y0 + 0.3, b1.x, b1.z, y1 + 0.3, profile.median, 0, 0.4);
        if (piece)
          piece.median = { x: (a.x + b1.x) / 2, z: (a.z + b1.z) / 2, w: profile.median, d: Math.hypot(b1.x - a.x, b1.z - a.z), yaw: 0 };
      }
    }
    for (let s = 60; s < road.length - 50; s += 60) {
      const p = pointOnPolyline(road, s), y = SN.roadProfileHeight(profile, s);
      for (const side of [-1, 1]) {
        const lx = p.x + side * (half + 2.6), lz = p.z;
        SN.record(SN.lampBatch, lx, y + 4.4, lz, 0.18, 8.8, 0.18);
        SN.record(SN.lampHeadBatch, lx, y + 8.6, lz, 2.6, 0.12, 0.55);
        SN.lampPoints.push({ x: lx, z: lz, y: y + 8.3 });
        SN.addProp(lx, lz, 0.45, 0.45, 8.8);
      }
    }
    for (let z = b.z0 + 75; z < b.z1 - 60; z += 46) {
      const top = SN.bridgeProfile(b, z) - 2.1;
      for (const side of [-1, 1])
        SN.record(SN.sideBatch, b.x + side * half * 0.55, (top - 2.5) / 2, z, 2.2, top + 2.5, 3.6);
      SN.record(SN.sideBatch, b.x, top - 0.3, z, deckW * 0.77, 0.8, 3.9);
    }
    for (let z = b.z0 + 80; z < b.z1 - 80; z += 30)
      if (!SN.onIsland(b.x, z))
        for (const side of [-1, 1])
          SN.addPropOBB(b.x + side * (half - 0.45), z + 15, 0.5, 30.4, 1.5, 0);
  }

  function findSlopeShot(roads) {
    let best = null;
    for (const road of roads) {
      if (road.bridge || road.pedestrian || road.width < 10 || road.special)
        continue;
      const profile = road.profile;
      for (let s = 30; s < road.length - 30; s += 6) {
        const y0 = SN.roadProfileHeight(profile, s - 4), y1 = SN.roadProfileHeight(profile, s + 4);
        const grade = (y1 - y0) / 8;
        if (Math.abs(grade) < 0.028 || Math.abs(grade) > 0.055)
          continue;
        const p = pointOnPolyline(road, s);
        if (SN.isWater(p.x, p.z, 8))
          continue;
        const before = (SN.roadProfileHeight(profile, s - 4) - SN.roadProfileHeight(profile, s - 12)) / 8;
        const transition = Math.abs(grade - before);
        const score = Math.abs(grade) + transition * 1.4;
        if (!best || score > best.score) {
          let side = 1, px = p.x + p.nx * (road.width / 2 + 2.2), pz = p.z + p.nz * (road.width / 2 + 2.2);
          if (SN.isWater(px, pz, 1.5)) {
            side = -1;
            px = p.x - p.nx * (road.width / 2 + 2.2);
            pz = p.z - p.nz * (road.width / 2 + 2.2);
          }
          best = { x: p.x, z: p.z, y: SN.roadProfileHeight(profile, s), yaw: p.yaw, grade, score, side, px, pz, road, s };
        }
      }
    }
    SN.slopeShot = best;
    return best;
  }

  SN.buildRoadNetwork = function buildRoadNetwork() {
    const roads = SN.roads || [];
    for (let i = 0; i < roads.length; i++) {
      const road = roads[i];
      road._index = i;
      road.segments = [];
      let total = 0;
      for (let j = 1; j < road.points.length; j++) {
        const a = road.points[j - 1], b = road.points[j];
        const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 0.01)
          continue;
        road.segments.push({ a, b, dx, dz, len, s0: total, s1: total + len, yaw: Math.atan2(dx, dz) });
        total += len;
      }
      road.length = total;
      if (road.bridge)
        road.special = "bridge";
      else if (/江边北路|奥林匹克/.test(road.name))
        road.special = "bank";
      else if (/匝道/.test(road.name))
        road.special = "ramp";
      else
        road.special = null;
      road.minX = Infinity;
      road.maxX = -Infinity;
      road.minZ = Infinity;
      road.maxZ = -Infinity;
      for (const point of road.points) {
        road.minX = Math.min(road.minX, point[0]);
        road.maxX = Math.max(road.maxX, point[0]);
        road.minZ = Math.min(road.minZ, point[1]);
        road.maxZ = Math.max(road.maxZ, point[1]);
      }
      if (road.special === "ramp") {
        const count = Math.max(2, road.segments.length + 1);
        road.rampHeights = [];
        for (let k = 0; k < count; k++)
          road.rampHeights.push(count === 3 ? [8, 5, 0.2][k] : SN.lerp(8, 0.2, k / (count - 1)));
      }
    }
    SN.roadJunctions = [];
    buildJunctions(roads);
    resolveProfiles(roads);
    finalizeProfiles(roads);
    for (const road of roads) {
      road.profile.ms = pchipSlopes(road.controls);
      if (road.bridge)
        buildBridgeMeshes(road, road.bridgeDef);
      else
        buildRoadMeshes(road);
    }
    findSlopeShot(roads);
  };

  // Mountain lanes climb far more steeply than city streets. Pulling them down
  // to the 4% urban limit left the Namsan road floating at its foot and buried
  // under the summit, so it is graded against its own 12% limit instead.
  function mountainRoad(road) {
    // Only genuine mountain lanes get the looser limit. City streets that
    // happen to cross a hill keep the urban limit and cut or fill the slope,
    // because a 20% grade through town reads as a wall, not a road.
    return /남산순환로|북악|인왕|고개|산길/.test(road.name || "");
  }

  function roadGradeLimit(road) {
    if (road.bridge || road.special === "ramp" || road.special === "bridge")
      return 0.06;
    if (mountainRoad(road))
      return 0.2;
    return road.lanes >= 4 || road.width >= 18 ? 0.08 : 0.12;
  }

  SN.auditRoadContinuity = function auditRoadContinuity() {
    const result = {
      roads: 0, samples: 0, stepIssues: 0, gradeIssues: 0, curvatureIssues: 0, jointIssues: 0,
      maxStep: 0, maxGrade: 0, maxGradeChange: 0, issues: []
    };
    for (const road of SN.roads) {
      if (!road.profile || road.length < 4)
        continue;
      const profile = road.profile, limit = roadGradeLimit(road);
      const stepLimit = Math.max(0.12, limit * 2 + 0.0005);
      const curveLimit = Math.max(0.03, limit * 0.55);
      result.roads++;
      const count = Math.max(1, Math.ceil(road.length / 2));
      let previousGrade = null;
      for (let i = 0; i < count; i++) {
        const s0 = Math.min(road.length - 2, i * 2), s1 = s0 + 2;
        if (s1 > road.length + 0.001)
          break;
        const h0 = SN.roadProfileHeight(profile, s0), h1 = SN.roadProfileHeight(profile, s1);
        const step = Math.abs(h1 - h0), grade = step / 2;
        result.samples++;
        result.maxStep = Math.max(result.maxStep, step);
        result.maxGrade = Math.max(result.maxGrade, grade);
        if (step > stepLimit) {
          result.stepIssues++;
          if (result.issues.length < 30) result.issues.push("step " + road.name + " s=" + s0.toFixed(1) + " " + step.toFixed(3));
        }
        if (grade > limit + 0.0005) {
          result.gradeIssues++;
          if (result.issues.length < 30) result.issues.push("grade " + road.name + " s=" + s0.toFixed(1) + " " + (grade * 100).toFixed(2) + "%");
        }
        if (previousGrade !== null) {
          const change = Math.abs(grade - previousGrade);
          result.maxGradeChange = Math.max(result.maxGradeChange, change);
          if (change > curveLimit) {
            result.curvatureIssues++;
            if (result.issues.length < 30) result.issues.push("curve " + road.name + " s=" + s0.toFixed(1) + " " + (change * 100).toFixed(2) + "%");
          }
        }
        previousGrade = grade;
      }
    }
    for (const junction of SN.roadJunctions || []) {
      if (junction.members.length < 2)
        continue;
      let min = Infinity, max = -Infinity;
      for (const member of junction.members) {
        const profile = member.control.profileRoad;
        const y = member.control.y;
        min = Math.min(min, y);
        max = Math.max(max, y);
      }
      if (max - min > 0.05) {
        result.jointIssues++;
        if (result.issues.length < 30) result.issues.push("joint " + (max - min).toFixed(3));
      }
    }
    for (const bridge of SN.bridges || []) {
      const road = SN.roads.find(item => item.bridge && item.bridgeDef === bridge);
      if (!road || !road.profile)
        continue;
      for (const s of [0, road.length]) {
        const h = SN.roadProfileHeight(road.profile, s);
        const p = pointOnPolyline(road, s);
        let closest = null, distance = 8;
        for (const other of SN.roads) {
          if (other === road)
            continue;
          const point = SN.closestRoadPoint(other, p.x, p.z);
          if (point.distance < distance) {
            distance = point.distance;
            closest = { road: other, point };
          }
        }
        if (closest) {
          const otherH = SN.roadProfileHeight(closest.road.profile, closest.point.s);
          if (Math.abs(h - otherH) > 0.05) {
            result.jointIssues++;
            if (result.issues.length < 30) result.issues.push("bridge " + bridge.name + " " + Math.abs(h - otherH).toFixed(3) + " " + closest.road.name + " s=" + closest.point.s.toFixed(1) + " d=" + s);
          }
        }
      }
    }
    return result;
  };
})(window.SN);
