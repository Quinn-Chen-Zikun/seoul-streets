/* 人物骨骼模型、服装遮罩、动画状态与车辆外壳加载。 */
"use strict";
(function (SN) {
  const M = SN.models = {
    ready: false,
    carReady: false,
    peopleReady: false,
    animReady: false,
    loading: false,
    finished: false,
    failed: false,
    warned: false,
    timedOut: false,
    total: 0,
    done: 0,
    errors: 0,
    progress: 0,
    prototypes: { male: null, female: null },
    skinMaps: { male: { light: null, dark: null }, female: { light: null, dark: null } },
    hair: {},
    clips: {},
    carPrototypes: {},
    carTypes: {},
    outfits: {},
    agents: [],
    playerAgent: null,
    playerOutfitId: "player-street",
    playerPartsHidden: false,
    runtimeReady: false,
    assignClock: 0,
    lastAssign: -1,
    stats: { agents: 0, visible: 0, cars: 0, models: 0 },
    garmentStats: { male: null, female: null },
    agentSerial: 0,
    statsClock: 0,
    maxAgents: 10
  };

  const PEOPLE = {
    male: "assets/models/people/Superhero_Male_FullBody.gltf",
    female: "assets/models/people/Superhero_Female_FullBody.gltf"
  };
  const LIGHT_MAPS = {
    male: "assets/models/people/T_Superhero_Male_Ligh.png",
    female: "assets/models/people/T_Superhero_Female_Light_BaseColor.png"
  };
  const HAIRS = ["Hair_SimpleParted", "Hair_Buzzed", "Hair_BuzzedFemale", "Hair_Buns", "Hair_Long", "Hair_Beard"];
  const HAIR_FILES = {
    Hair_SimpleParted: "assets/models/hair/Hair_SimpleParted.gltf",
    Hair_Buzzed: "assets/models/hair/Hair_Buzzed.gltf",
    Hair_BuzzedFemale: "assets/models/hair/Hair_BuzzedFemale.gltf",
    Hair_Buns: "assets/models/hair/Hair_Buns.gltf",
    Hair_Long: "assets/models/hair/Hair_Long.gltf",
    Hair_Beard: "assets/models/hair/Hair_Beard.gltf"
  };
  const ANIM_FILE = "assets/models/anim/UAL1_Standard.glb";
  const CAR_FILES = {
    sports1: "assets/models/cars/sports1.glb",
    sports2: "assets/models/cars/sports2.glb",
    suv: "assets/models/cars/suv.glb",
    taxi: "assets/models/cars/taxi.glb",
    pickup: "assets/models/cars/pickup.glb",
    police: "assets/models/cars/police.glb"
  };
  const CAR_MODEL_BY_TYPE = { 0: "sports1", 1: "sports2", 2: "suv", 3: "taxi", 4: "pickup", 7: "sports2", 9: "police", 10: "sports1", 11: "pickup" };

  function warnOnce(text) {
    if (M.warned) return;
    M.warned = true;
    console.warn(text);
  }

  function colorValue(hex) {
    return new SN.T.Color().copy(SN.srgb(hex));
  }

  // A full-body base mesh gets two four-channel skin-weight category groups. The
  // shirt, trousers and shoes are resolved per vertex after skinning so every pose
  // stays dressed without extra geometry.
  function categoryOfBone(name) {
    const n = String(name || "").toLowerCase();
    if (n === "head" || n.indexOf("neck") >= 0) return "skin";
    if (n.indexOf("hand") >= 0 || n.indexOf("index") >= 0 || n.indexOf("middle") >= 0 ||
        n.indexOf("pinky") >= 0 || n.indexOf("ring") >= 0 || n.indexOf("thumb") >= 0) return "hand";
    if (n.indexOf("lowerarm") >= 0) return "lowerarm";
    if (n.indexOf("upperarm") >= 0) return "upperarm";
    if (n.indexOf("thigh") >= 0) return "thigh";
    if (n.indexOf("calf") >= 0) return "calf";
    if (n.indexOf("foot") >= 0 || n.indexOf("ball") >= 0) return "foot";
    return "torso";
  }

  function attrComponent(attribute, index, component) {
    if (!attribute) return 0;
    if (typeof attribute.getComponent === "function") return attribute.getComponent(index, component);
    const size = attribute.itemSize || 4;
    return attribute.array ? attribute.array[index * size + component] || 0 : 0;
  }

  function buildClothMasks(body) {
    const geo = body.geometry;
    if (!geo || !geo.attributes || !geo.attributes.skinIndex || !geo.attributes.skinWeight || !body.skeleton) return false;
    const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight,
      bones = body.skeleton.bones, count = pos.count;
    if (!count || !bones || !bones.length) return false;
    const index = new Uint8Array(count), weight = new Float32Array(count);
    const a = new Float32Array(count * 4), b = new Float32Array(count * 4);
    let clothing = 0;
    for (let i = 0; i < count; i++) {
      let total = 0;
      for (let k = 0; k < 4; k++) {
        const bone = bones[attrComponent(si, i, k)];
        const w = attrComponent(sw, i, k);
        if (!bone || !(w > 0)) continue;
        total += w;
        const kind = categoryOfBone(bone.name);
        if (kind === "torso") a[i * 4] += w;
        else if (kind === "upperarm") a[i * 4 + 1] += w;
        else if (kind === "lowerarm") a[i * 4 + 2] += w;
        else if (kind === "thigh") b[i * 4] += w;
        else if (kind === "calf") b[i * 4 + 1] += w;
        else if (kind === "foot") b[i * 4 + 2] += w;
        else if (kind === "hand") a[i * 4 + 3] += w;
        else if (kind === "skin") b[i * 4 + 3] += w;
      }
      if (total > 0.00001) {
        index[i] = 1;
        weight[i] = total;
        for (let k = 0; k < 4; k++) {
          a[i * 4 + k] /= total;
          b[i * 4 + k] /= total;
        }
        if (a[i * 4] + a[i * 4 + 1] + a[i * 4 + 2] + b[i * 4] + b[i * 4 + 1] + b[i * 4 + 2] > 0.35) clothing++;
      }
    }
    if (clothing < count * 0.28) return false;
    geo.setAttribute("aClothA", new SN.T.BufferAttribute(a, 4));
    geo.setAttribute("aClothB", new SN.T.BufferAttribute(b, 4));
    return true;
  }

  // ---------- 服装外壳 ----------
  // Each body prototype is measured once in bind pose. Tops, bottoms and shoes
  // are then built as independent skinned shells that share the body skeleton,
  // so fabric hangs from smooth cross-sections instead of following anatomy.
  const fabricTextures = new Map(), garmentMaterials = new Map(), skinCoverMaterials = new Map();
  let relaxQuat = null;

  function garmentCss(hex, shift) {
    const f = 1 + (shift || 0), add = shift > 0 ? 9 : 0;
    return "rgb(" + SN.clamp(Math.round(((hex >> 16) & 255) * f + add), 0, 255) + "," +
      SN.clamp(Math.round(((hex >> 8) & 255) * f + add), 0, 255) + "," +
      SN.clamp(Math.round((hex & 255) * f + add), 0, 255) + ")";
  }

  function fabricStyleFor(part, outfit) {
    if (part === "shoes") return "shoe";
    if (part === "top") return outfit.fabricTop || "cotton";
    return outfit.fabricBottom || (outfit.skirt ? "silk" : "denim");
  }

  function fabricTexture(style, hex, part, outfit) {
    const accentHex = outfit && outfit.accent !== undefined ? outfit.accent : 0xd8d2c4;
    const collarHex = outfit && outfit.collar !== undefined ? outfit.collar : 0xe6e3d9;
    const key = style + "|" + hex + "|" + accentHex + "|" + collarHex + "|" + part;
    if (fabricTextures.has(key)) return fabricTextures.get(key);
    const size = 256, canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    let seed = (hex ^ Math.imul(style.length + 3, 7919)) >>> 0;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const base = garmentCss(hex, -0.035);
    const dark = garmentCss(hex, -0.34), light = garmentCss(hex, 0.26);
    const accent = garmentCss(outfit && outfit.accent !== undefined ? outfit.accent : 0xd8d2c4, 0);
    const collar = garmentCss(outfit && outfit.collar !== undefined ? outfit.collar : 0xe6e3d9, 0);
    const line = (x0, y0, x1, y1, width, color, alpha) => {
      ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
    };
    const dashed = (x0, y0, x1, y1, width, color, alpha) => {
      ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
    };
    const rect = (x, y, w, h, color, alpha) => {
      ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha; ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.restore();
    };
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.045)";
      ctx.fillRect(rnd() * size, rnd() * size, 1, 1);
    }
    if (style === "denim" || style === "work" || style === "cargo") {
      for (let x = -60; x < 300; x += 14) line(x, 0, x + 64, 256, 1, "#ffffff", 0.12);
      rect(0, 0, 256, 16, dark, 0.55);
      line(0, 17, 256, 17, 1, light, 0.35);
      line(9, 0, 9, 256, 2, dark, 0.75);
      line(247, 0, 247, 256, 2, dark, 0.75);
      dashed(13, 16, 13, 250, 2, accent, 0.4);
      dashed(243, 16, 243, 250, 2, accent, 0.4);
      line(44, 48, 70, 82, 2, accent, 0.45);
      line(212, 48, 186, 82, 2, accent, 0.45);
      line(44, 48, 96, 48, 1, dark, 0.5);
      line(212, 48, 160, 48, 1, dark, 0.5);
      rect(42, 46, 3, 3, light, 0.8);
      rect(211, 46, 3, 3, light, 0.8);
      if (style === "cargo" || style === "work") {
        rect(30, 120, 44, 46, dark, 0.35);
        rect(182, 120, 44, 46, dark, 0.35);
        line(30, 120, 74, 120, 1, light, 0.3);
        line(182, 120, 226, 120, 1, light, 0.3);
        line(52, 120, 52, 166, 1, light, 0.2);
        line(204, 120, 204, 166, 1, light, 0.2);
      }
    } else if (style === "suit" || style === "school") {
      for (let x = 4; x < 256; x += 22) line(x, 0, x, 256, 1, light, 0.16);
      if (part === "top") {
        ctx.fillStyle = "#ecebe4";
        ctx.beginPath(); ctx.moveTo(110, 0); ctx.lineTo(146, 0); ctx.lineTo(132, 74); ctx.lineTo(124, 74); ctx.closePath(); ctx.fill();
        ctx.fillStyle = accent;
        if (style === "suit") {
          ctx.beginPath(); ctx.moveTo(124, 14); ctx.lineTo(132, 14); ctx.lineTo(136, 96); ctx.lineTo(128, 110); ctx.lineTo(120, 96); ctx.closePath(); ctx.fill();
        } else {
          ctx.beginPath(); ctx.moveTo(120, 20); ctx.lineTo(136, 20); ctx.lineTo(145, 34); ctx.lineTo(136, 46); ctx.lineTo(120, 46); ctx.lineTo(111, 34); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = dark; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(108, 0); ctx.lineTo(126, 80); ctx.lineTo(96, 64); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(148, 0); ctx.lineTo(130, 80); ctx.lineTo(160, 64); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        for (let y = 90; y < 190; y += 30) {
          ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(128, y, 3, 0, SN.TAU); ctx.fill();
        }
        if (style === "school") rect(150, 66, 18, 22, accent, 0.8);
      } else {
        rect(0, 0, 256, 18, dark, 0.35);
        line(128, 18, 128, 256, 1, light, 0.28);
        line(9, 0, 9, 256, 1, dark, 0.45);
        line(247, 0, 247, 256, 1, dark, 0.45);
      }
      rect(0, 0, 256, 10, collar, 0.85);
    } else if (style === "knit" || style === "wool") {
      if (style === "wool") {
        for (let x = -256; x < 256; x += 12) line(x, 0, x + 256, 256, 2, "#ffffff", 0.05);
        for (let x = 0; x < 256; x += 12) line(x, 0, x + 256, 256, 1, "#000000", 0.1);
      } else {
        for (let y = 0; y < 256; y += 7) {
          line(0, y, 256, y, 1, dark, 0.16);
          line(0, y + 1, 256, y + 1, 1, light, 0.1);
        }
        for (let x = 0; x < 256; x += 13) line(x, 0, x, 256, 1, light, 0.05);
      }
      rect(0, 0, 256, 12, collar, 0.3);
    } else if (style === "hivis") {
      for (const y of [58, 128]) {
        rect(0, y, 256, 14, "#c9d4d8", 0.92);
        rect(0, y + 4, 256, 3, "#ffffff", 0.8);
        rect(0, y - 2, 256, 1, "#3c444a", 0.5);
      }
      rect(0, 0, 256, 8, dark, 0.55);
      rect(104, 26, 48, 20, "#f7f4e8", 0.88);
      ctx.fillStyle = "#25313a"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("한빛", 128, 37);
    } else if (style === "police") {
      rect(0, 0, 256, 12, dark, 0.6);
      ctx.fillStyle = "#d9c06a"; ctx.beginPath(); ctx.arc(154, 70, 15, 0, SN.TAU); ctx.fill();
      ctx.fillStyle = "#1d3b5c"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("경찰", 154, 71);
      line(16, 40, 16, 96, 3, accent, 0.7);
      rect(0, 214, 256, 18, "#111820", 0.9);
      rect(0, 216, 256, 2, accent, 0.5);
      rect(124, 214, 8, 8, accent, 0.8);
    } else if (style === "check") {
      // 方格衬衫：宽窄两组经纬线叠出苏格兰格，前襟中线压在胸口。
      for (let x = 0; x < 256; x += 32) line(x, 0, x, 256, 7, dark, 0.24);
      for (let y = 0; y < 256; y += 32) line(0, y, 256, y, 7, dark, 0.24);
      for (let x = 16; x < 256; x += 32) line(x, 0, x, 256, 2, light, 0.3);
      for (let y = 16; y < 256; y += 32) line(0, y, 256, y, 2, light, 0.3);
      for (let x = -256; x < 512; x += 64) line(x, 0, x + 256, 256, 1, accent, 0.2);
      if (part === "top") {
        line(128, 10, 128, 246, 2, dark, 0.32);
        rect(0, 0, 256, 8, collar, 0.7);
        for (let y = 40; y < 230; y += 34) { ctx.fillStyle = light; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(128, y, 2.4, 0, SN.TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else {
        rect(0, 0, 256, 12, dark, 0.35);
        rect(0, 246, 256, 10, dark, 0.4);
      }
    } else if (style === "tee" || style === "sport") {
      ctx.fillStyle = accent; ctx.globalAlpha = 0.92;
      ctx.beginPath(); ctx.arc(128, 132, 30, 0, SN.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#12181d";
      ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(style === "sport" ? "07" : "서울", 128, 134);
      if (style === "sport") {
        rect(0, 28, 256, 6, accent, 0.7);
        rect(0, 38, 256, 2, light, 0.5);
      }
      rect(0, 246, 256, 10, dark, 0.5);
      rect(0, 0, 256, 6, collar, 0.5);
    } else if (style === "apron") {
      rect(0, 0, 256, 8, collar, 0.6);
      ctx.fillStyle = "rgba(240,236,222,0.9)";
      ctx.beginPath(); ctx.moveTo(94, 44); ctx.lineTo(162, 44); ctx.lineTo(174, 250); ctx.lineTo(82, 250); ctx.closePath(); ctx.fill();
      line(104, 44, 110, 14, 3, "rgba(240,236,222,0.9)", 0.9);
      line(152, 44, 146, 14, 3, "rgba(240,236,222,0.9)", 0.9);
      rect(122, 150, 12, 14, "rgba(60,64,68,0.35)", 1);
      rect(112, 196, 32, 20, "rgba(60,64,68,0.22)", 1);
    } else if (style === "silk") {
      for (let i = 0; i < 70; i++) {
        const x = rnd() * 256, y = rnd() * 256, r = 2 + rnd() * 7;
        ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.10)" : "rgba(120,70,90,0.10)";
        ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, SN.TAU); ctx.stroke();
      }
      rect(0, 0, 256, 8, collar, 0.4);
    } else if (style === "leather") {
      line(128, 0, 128, 256, 1, dark, 0.5);
      for (let i = 0; i < 40; i++) { const y = rnd() * 256; line(0, y, 256, y + 2, 1, light, 0.04); }
      rect(0, 0, 256, 10, dark, 0.5);
      dashed(128, 10, 128, 246, 2, light, 0.35);
    } else if (style === "nylon") {
      for (let y = 0; y < 256; y += 26) {
        line(0, y, 256, y, 1, light, 0.08);
        line(0, y + 1, 256, y + 1, 1, dark, 0.08);
      }
      rect(0, 0, 256, 10, dark, 0.35);
    } else if (style === "shoe") {
      rect(0, 0, 256, 40, dark, 0.75);
      rect(0, 218, 256, 38, dark, 0.65);
      line(0, 40, 256, 40, 1, light, 0.35);
      line(0, 218, 256, 218, 1, light, 0.25);
      for (let y = 76; y < 158; y += 15) {
        line(78, y, 178, y, 3, light, 0.85);
        line(78, y + 3, 178, y + 3, 1, dark, 0.4);
      }
      line(70, 60, 186, 170, 2, accent, 0.25);
      rect(0, 196, 256, 10, dark, 0.35);
    } else {
      rect(0, 0, 256, 8, collar, 0.5);
      rect(0, 246, 256, 10, dark, 0.45);
      if (part === "top") {
        line(128, 12, 128, 244, 2, dark, 0.28);
        dashed(128, 12, 128, 244, 1, light, 0.18);
        line(64, 190, 104, 190, 2, dark, 0.35);
        line(152, 190, 192, 190, 2, dark, 0.35);
      }
    }
    const texture = new SN.T.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = SN.T.RepeatWrapping;
    texture.encoding = SN.T.sRGBEncoding;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
    fabricTextures.set(key, texture);
    return texture;
  }

  function garmentMaterialFor(sex, outfitId, part, variant) {
    const key = [sex, outfitId, part, variant].join("|");
    if (garmentMaterials.has(key)) return garmentMaterials.get(key);
    const outfit = M.outfits[outfitId] || M.outfits.office;
    const hex = part === "top" ? outfit.top : part === "bottom" ? outfit.bottom : outfit.shoe;
    const style = fabricStyleFor(part, outfit);
    const texture = fabricTexture(style, hex, part, outfit);
    const material = new SN.T.MeshStandardMaterial({
      map: texture || null,
      color: texture ? (variant ? 0xffffff : 0xf1f1f1) : colorValue(hex),
      roughness: part === "shoes" ? 0.58 : SN.clamp(outfit.rough || 0.92, 0.5, 1),
      metalness: part === "shoes" ? 0.04 : 0,
      side: part === "shoes" ? SN.T.FrontSide : SN.T.DoubleSide,
      vertexColors: true,
      envMapIntensity: part === "shoes" ? 0.5 : 0.22,
      skinning: true
    });
    // r128 still selects USE_SKINNING from the material flag, not from the
    // object type. Without this every shell is drawn in its bind T-pose.
    material.skinning = true;
    material.name = "garment-" + key;
    material.userData.garmentPart = part;
    material.userData.garmentStyle = style;
    SN.envMats.push({ material, base: material.envMapIntensity });
    garmentMaterials.set(key, material);
    return material;
  }

  function skinMaterialFor(proto, tone, outfitId) {
    if (!proto || !proto.mask) return null;
    const key = proto.id + "|" + tone + "|" + outfitId;
    if (skinCoverMaterials.has(key)) return skinCoverMaterials.get(key);
    const outfit = M.outfits[outfitId] || M.outfits.office;
    const map = M.skinMaps[proto.id] && (M.skinMaps[proto.id][tone] || proto.maps.dark) || proto.maps.dark;
    const sleeve = outfit.sleeve || "long";
    const armStart = proto.bones && proto.bones.upperarm_l ? Math.abs(proto.bones.upperarm_l.x) : 0.212;
    const armElbow = proto.bones && proto.bones.lowerarm_l ? Math.abs(proto.bones.lowerarm_l.x) : 0.463;
    // Both sleeve lengths must end where the shell actually ends, not at a fixed
    // x. Male and female skeletons have wrists 6.5 cm apart, so a hard-coded
    // boundary hid the female forearm past her cuff and left the hand floating.
    // Short sleeves stop two thirds of the way down the upper arm; the cuff lands
    // 0.012 m inside that station, so the mask sits 6 mm beyond the cuff.
    const shortEnd = SN.lerp(armStart, armElbow, 0.6) - 0.006;
    const handX = proto.bones && proto.bones.hand_l ? Math.abs(proto.bones.hand_l.x) : 0.7065;
    const longCuffX = handX - 0.014;
    const uniforms = {
      uTopColor: { value: colorValue(outfit.top) },
      uBottomColor: { value: colorValue(outfit.bottom) },
      uSleeveUpperX: { value: sleeve === "none" ? -1 : sleeve === "short" ? shortEnd : armElbow + 0.02 },
      uSleeveLowerX: { value: sleeve === "long" ? longCuffX + 0.006 : -1 },
      uLegLower: { value: outfit.shorts || outfit.skirt ? 0 : 1 },
      uLegsAll: { value: outfit.shorts || outfit.skirt ? 0 : 1 },
      uBottomHem: { value: outfit.skirt ? 0.6 : 0.58 }
    };
    const material = proto.material.clone();
    material.name = "skin-" + key;
    material.map = map || null;
    material.color.set(0xffffff);
    material.roughness = 0.74;
    material.metalness = 0;
    material.normalMap = null;
    material.roughnessMap = null;
    material.metalnessMap = null;
    material.aoMap = null;
    material.emissiveMap = null;
    material.emissive.set(0x000000);
    material.envMapIntensity = 0.3;
    material.side = SN.T.FrontSide;
    material.vertexColors = false;
    material.skinning = true;
    material.userData.clothUniforms = uniforms;
    material.userData.skinCover = true;
    material.onBeforeCompile = shader => {
      for (const name of Object.keys(uniforms)) shader.uniforms[name] = uniforms[name];
      shader.vertexShader = [
        "attribute vec4 aClothA;",
        "attribute vec4 aClothB;",
        "varying vec4 vClothA;",
        "varying vec4 vClothB;",
        "varying float vBindX;",
        "varying float vBindY;",
        shader.vertexShader
      ].join("\n");
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", [
        "#include <begin_vertex>",
        "vClothA = aClothA;",
        "vClothB = aClothB;",
        "vBindX = abs(position.x);",
        "vBindY = position.y;"
      ].join("\n"));
      shader.fragmentShader = [
        "uniform float uSleeveUpperX;",
        "uniform float uSleeveLowerX;",
        "uniform float uLegLower;",
        "uniform float uLegsAll;",
        "uniform float uBottomHem;",
        "varying vec4 vClothA;",
        "varying vec4 vClothB;",
        "varying float vBindX;",
        "varying float vBindY;",
        shader.fragmentShader
      ].join("\n");
      shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>", [
        "#include <clipping_planes_fragment>",
        "float torsoCover = vClothA.x;",
        "float upperCover = vClothA.y * step(vBindX, uSleeveUpperX);",
        "float lowerCover = vClothA.z * step(vBindX, uSleeveLowerX);",
        "float thighCover = vClothB.x * mix(step(uBottomHem, vBindY), 1.0, uLegsAll);",
        "float calfCover = vClothB.y * uLegLower;",
        "float footCover = vClothB.z;",
        "float covered = max(max(torsoCover, upperCover), max(lowerCover, max(thighCover, max(calfCover, footCover))));",
        "if (covered > 0.5) discard;"
      ].join("\n"));
    };
    material.customProgramCacheKey = () => "seoul-skin-cover-v1";
    SN.envMats.push({ material, base: 0.3 });
    skinCoverMaterials.set(key, material);
    return material;
  }

  function newGarmentBuilder() {
    return { pos: [], uv: [], col: [], si: [], sw: [], tri: [] };
  }

  function addGVertex(builder, x, y, z, u, v, weights, shade) {
    const index = builder.pos.length / 3;
    builder.pos.push(x, y, z);
    builder.uv.push(u, v);
    const list = [];
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i];
      if (w && w[1] > 0.0001 && Number.isFinite(w[1])) list.push(w);
    }
    list.sort((a, b) => b[1] - a[1]);
    let total = 0;
    for (let i = 0; i < Math.min(4, list.length); i++) total += list[i][1];
    if (!(total > 0.00001)) { list.length = 0; list.push([0, 1]); total = 1; }
    for (let k = 0; k < 4; k++) {
      const w = list[k];
      builder.si.push(w ? w[0] : 0);
      builder.sw.push(w ? w[1] / total : 0);
    }
    const c = shade === undefined ? 1 : shade;
    builder.col.push(c, c, c);
    return index;
  }

  function addGarmentRing(builder, center, uAxis, vAxis, radiusU, radiusV, segments, v, weightsFn, uStart, uSpan) {
    const start = builder.pos.length / 3;
    const us = uStart === undefined ? 0.5 : uStart, span = uSpan === undefined ? 1 : uSpan;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments, angle = t * SN.TAU, ca = Math.cos(angle), sa = Math.sin(angle);
      const x = center.x + uAxis.x * radiusU * ca + vAxis.x * radiusV * sa;
      const y = center.y + uAxis.y * radiusU * ca + vAxis.y * radiusV * sa;
      const z = center.z + uAxis.z * radiusU * ca + vAxis.z * radiusV * sa;
      addGVertex(builder, x, y, z, us + t * span, v, weightsFn({ x, y, z }, angle));
    }
    return { start, count: segments + 1 };
  }

  function stitchGarmentRings(builder, low, high) {
    for (let s = 0; s < low.count - 1; s++) {
      const a = low.start + s, b = low.start + s + 1, c = high.start + s, d = high.start + s + 1;
      builder.tri.push(a, b, c, b, d, c);
    }
  }

  function finishGarment(builder, meta) {
    const geometry = new SN.T.BufferGeometry();
    if (meta) geometry.userData = meta;
    geometry.setAttribute("position", new SN.T.Float32BufferAttribute(builder.pos, 3));
    geometry.setAttribute("normal", new SN.T.Float32BufferAttribute(new Array(builder.pos.length).fill(0), 3));
    geometry.setAttribute("uv", new SN.T.Float32BufferAttribute(builder.uv, 2));
    geometry.setAttribute("color", new SN.T.Float32BufferAttribute(builder.col, 3));
    geometry.setAttribute("skinIndex", new SN.T.Uint16BufferAttribute(builder.si, 4));
    geometry.setAttribute("skinWeight", new SN.T.Float32BufferAttribute(builder.sw, 4));
    geometry.setIndex(builder.tri);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function boneIdx(proto, name) {
    const index = proto.boneIndex[name];
    return index === undefined ? 0 : index;
  }

  function spineWeights(proto, y) {
    const chain = [["pelvis", 0.9], ["spine_01", 1.06], ["spine_02", 1.18], ["spine_03", 1.31], ["neck_01", 1.56]];
    if (y <= chain[0][1]) return [[boneIdx(proto, chain[0][0]), 1]];
    for (let i = 1; i < chain.length; i++) {
      if (y <= chain[i][1]) {
        const a = chain[i - 1], b = chain[i];
        const f = SN.clamp((y - a[1]) / Math.max(0.001, b[1] - a[1]), 0, 1);
        return [[boneIdx(proto, a[0]), 1 - f], [boneIdx(proto, b[0]), f]];
      }
    }
    return [[boneIdx(proto, "neck_01"), 1]];
  }

  function torsoWeightsFor(proto, point) {
    if (point.y > 1.43) {
      const c = SN.clamp((Math.abs(point.x) - 0.03) / 0.16, 0, 1) * 0.55;
      const clav = point.x >= 0 ? "clavicle_l" : "clavicle_r";
      return [[boneIdx(proto, "spine_03"), 1 - c], [boneIdx(proto, clav), c]];
    }
    return spineWeights(proto, point.y);
  }

  let chainProjection = null, chainDirection = null, chainOffset = null;

  function nearestOnSegment(point, a, b, out) {
    chainDirection.subVectors(b, a);
    const lengthSq = chainDirection.lengthSq();
    let t = lengthSq > 0.0000001 ? chainOffset.subVectors(point, a).dot(chainDirection) / lengthSq : 0;
    t = SN.clamp(t, 0, 1);
    out.copy(a).addScaledVector(chainDirection, t);
    return t;
  }

  // Project a shell vertex onto the bone segments of a limb in bind pose and
  // give it at most two normalised weights: the owning bone plus its neighbour
  // across the closest joint. This keeps elbows, knees and hips continuous.
  function chainWeightsFor(proto, point, segments, blend) {
    if (!chainProjection) {
      chainProjection = new SN.T.Vector3();
      chainDirection = new SN.T.Vector3();
      chainOffset = new SN.T.Vector3();
    }
    let bestIndex = 0, bestT = 0, bestLength = 0, bestDistance = Infinity;
    const probe = chainProjection;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const t = nearestOnSegment(point, segment.a, segment.b, probe);
      // addGarmentRing hands the weight callback a plain {x, y, z} sample, so
      // never depend on point being a THREE.Vector3 here.
      const dx = point.x - probe.x, dy = point.y - probe.y, dz = point.z - probe.z;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
        bestT = t;
        bestLength = segment.a.distanceTo(segment.b);
      }
    }
    const segment = segments[bestIndex];
    const half = Math.max(0.001, (blend === undefined ? 0.12 : blend) * 0.5);
    const along = bestT * bestLength, remain = (1 - bestT) * bestLength;
    let previous = "", previousWeight = 0, next = "", nextWeight = 0;
    if (bestIndex > 0 && along < half) {
      previous = segments[bestIndex - 1].bone;
      previousWeight = 0.5 * (1 - along / half);
    } else if (bestIndex === 0 && segment.prev && along < half) {
      previous = segment.prev;
      previousWeight = (segment.prevMax === undefined ? 0.25 : segment.prevMax) * (1 - along / half);
    } else if (bestIndex < segments.length - 1 && remain < half) {
      next = segments[bestIndex + 1].bone;
      nextWeight = 0.5 * (1 - remain / half);
    }
    const weights = [];
    const current = 1 - previousWeight - nextWeight;
    if (previous && previousWeight > 0.0001) weights.push([boneIdx(proto, previous), previousWeight]);
    if (current > 0.0001) weights.push([boneIdx(proto, segment.bone), current]);
    if (next && nextWeight > 0.0001) weights.push([boneIdx(proto, next), nextWeight]);
    if (!weights.length) weights.push([boneIdx(proto, segment.bone), 1]);
    let total = 0;
    for (const item of weights) total += item[1];
    for (const item of weights) item[1] /= total;
    return weights;
  }

  function armWeightSegments(proto, side) {
    const suffix = side > 0 ? "_l" : "_r";
    const upper = proto.bones["upperarm" + suffix], lower = proto.bones["lowerarm" + suffix], hand = proto.bones["hand" + suffix];
    if (!upper || !lower || !hand) return null;
    return [
      { bone: "upperarm" + suffix, a: upper, b: lower, prev: "clavicle" + suffix, prevMax: 0.22 },
      { bone: "lowerarm" + suffix, a: lower, b: hand }
    ];
  }

  function sleeveWeightsFor(proto, point, side, armSegments) {
    const segments = armSegments || armWeightSegments(proto, side);
    if (!segments) return [[boneIdx(proto, side > 0 ? "upperarm_l" : "upperarm_r"), 1]];
    return chainWeightsFor(proto, point, segments, 0.13);
  }

  function hipWeightsFor(proto, point) {
    const pelvis = 0.45 + SN.clamp((point.y - 0.86) / 0.2, 0, 1) * 0.55;
    const thigh = 1 - pelvis;
    const t = SN.clamp(point.x / 0.09, -1, 1);
    const wl = Math.max(0, t), wr = Math.max(0, -t), total = wl + wr || 1;
    return [[boneIdx(proto, "pelvis"), pelvis], [boneIdx(proto, "thigh_l"), thigh * wl / total], [boneIdx(proto, "thigh_r"), thigh * wr / total]];
  }

  function legWeightSegments(proto, side) {
    const suffix = side > 0 ? "_l" : "_r";
    const thigh = proto.bones["thigh" + suffix], calf = proto.bones["calf" + suffix], foot = proto.bones["foot" + suffix];
    if (!thigh || !calf || !foot) return null;
    return [
      { bone: "thigh" + suffix, a: thigh, b: calf, prev: "pelvis", prevMax: 0.28 },
      { bone: "calf" + suffix, a: calf, b: foot }
    ];
  }

  function legWeightsFor(proto, point, side, legSegments) {
    const segments = legSegments || legWeightSegments(proto, side);
    if (!segments) return [[boneIdx(proto, side > 0 ? "thigh_l" : "thigh_r"), 1]];
    return chainWeightsFor(proto, point, segments, 0.13);
  }

  function skirtWeightsFor(proto, point) {
    const thigh = SN.clamp((1.02 - point.y) / 0.4, 0, 1) * 0.34;
    const t = SN.clamp(point.x / 0.1, -1, 1);
    const wl = Math.max(0, t), wr = Math.max(0, -t), total = wl + wr || 1;
    return [[boneIdx(proto, "pelvis"), 1 - thigh], [boneIdx(proto, "thigh_l"), thigh * wl / total], [boneIdx(proto, "thigh_r"), thigh * wr / total]];
  }

  function shoeWeightsFor(proto, point, side) {
    const f = SN.clamp((point.z + 0.02) / 0.12, 0, 1) * 0.8;
    return [[boneIdx(proto, side > 0 ? "foot_l" : "foot_r"), 1 - f], [boneIdx(proto, side > 0 ? "ball_l" : "ball_r"), f]];
  }

  function legRadiusAt(proto, y) {
    const keys = [[0.08, 0.052], [0.28, 0.068], [0.45, 0.062], [0.55, 0.072], [0.7, 0.088], [0.88, 0.102], [0.98, 0.108]];
    if (y <= keys[0][0]) return keys[0][1] * proto.height / 1.81;
    for (let i = 1; i < keys.length; i++) {
      if (y <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        const f = (y - a[0]) / (b[0] - a[0]);
        return SN.lerp(a[1], b[1], SN.smoothRange(0, 1, f)) * proto.height / 1.81;
      }
    }
    return keys[keys.length - 1][1] * proto.height / 1.81;
  }

  function profileAt(profile, y) {
    if (!profile || !profile.length) return { y, rx: 0.16, rz: 0.1, cz: 0 };
    if (y <= profile[0].y) return profile[0];
    if (y >= profile[profile.length - 1].y) return profile[profile.length - 1];
    for (let i = 1; i < profile.length; i++) {
      if (y <= profile[i].y) {
        const a = profile[i - 1], b = profile[i];
        const f = (y - a.y) / Math.max(0.001, b.y - a.y);
        return { y, rx: SN.lerp(a.rx, b.rx, f), rz: SN.lerp(a.rz, b.rz, f), cz: SN.lerp(a.cz, b.cz, f) };
      }
    }
    return profile[profile.length - 1];
  }

  function buildTopGeometry(proto, variant, low) {
    const coat = variant === "topCoat";
    const sleeve = variant === "topNone" ? "none" : variant === "topShort" ? "short" : "long";
    const segments = low ? 10 : 20, bands = low ? 7 : 13;
    const pad = coat ? 0.048 : 0.03;
    const hemY = coat ? 0.88 : 1.01, topY = 1.515, collarY = 1.556;
    const builder = newGarmentBuilder();
    const stations = [];
    for (let i = 0; i <= bands; i++) {
      const y = SN.lerp(hemY, topY, i / bands);
      const p = profileAt(proto.torsoProfile, y);
      stations.push({ y, rx: Math.max(0.105, p.rx + pad), rz: Math.max(0.078, p.rz + pad), cz: p.cz });
    }
    let chest = stations.findIndex(s => s.y >= 1.28);
    if (chest < 0) chest = stations.length - 1;
    for (let i = chest - 1; i >= 0; i--) {
      stations[i].rx = Math.max(stations[i].rx, stations[i + 1].rx);
      stations[i].rz = Math.max(stations[i].rz, stations[i + 1].rz);
    }
    for (let pass = 0; pass < 2; pass++) {
      const copy = stations.map(s => ({ rx: s.rx, rz: s.rz }));
      for (let i = 1; i < stations.length - 1; i++) {
        stations[i].rx = (copy[i - 1].rx + copy[i].rx * 2 + copy[i + 1].rx) / 4;
        stations[i].rz = (copy[i - 1].rz + copy[i].rz * 2 + copy[i + 1].rz) / 4;
      }
    }
    const front = new SN.T.Vector3(0, 0, 1), across = new SN.T.Vector3(1, 0, 0);
    const rings = [];
    for (let i = 0; i < stations.length; i++) {
      const s = stations[i], v = (s.y - hemY) / (collarY - hemY) * 0.93;
      // u = 0.5 is the middle of the canvas, so start a quarter turn early and
      // the printed chest (tie, badge, logo, reflective text) lands on the front.
      rings.push(addGarmentRing(builder, { x: 0, y: s.y, z: s.cz }, front, across, s.rz, s.rx, segments, v,
        point => torsoWeightsFor(proto, point), 0.25, 1));
    }
    for (let i = 1; i < rings.length; i++) stitchGarmentRings(builder, rings[i - 1], rings[i]);
    const hem = stations[0];
    const rim = addGarmentRing(builder, { x: 0, y: hem.y + 0.014, z: hem.cz }, front, across, hem.rz * 0.92, hem.rx * 0.92, segments, 0,
      point => torsoWeightsFor(proto, point), 0.25, 1);
    stitchGarmentRings(builder, rings[0], rim);
    const last = stations[stations.length - 1];
    const neckR = 0.092 + pad * 0.35;
    let prev = rings[rings.length - 1];
    for (let d = 1; d <= 3; d++) {
      const f = d / 3;
      const y = SN.lerp(last.y, 1.55, f);
      const k = Math.cos(f * SN.PI / 2);
      const rx = neckR + (last.rx - neckR) * k, rz = neckR + (last.rz - neckR) * k;
      const cz = SN.lerp(last.cz, -0.014, f);
      const r = addGarmentRing(builder, { x: 0, y, z: cz }, front, across, rz, rx, segments, (y - hemY) / (collarY - hemY) * 0.96,
        point => torsoWeightsFor(proto, point), 0.25, 1);
      stitchGarmentRings(builder, prev, r);
      prev = r;
    }
    const collarWeights = () => [[boneIdx(proto, "neck_01"), 0.55], [boneIdx(proto, "spine_03"), 0.45]];
    const collar = addGarmentRing(builder, { x: 0, y: 1.566, z: -0.014 }, front, across, neckR * 0.92, neckR * 0.86, segments, 1, collarWeights, 0.25, 1);
    stitchGarmentRings(builder, prev, collar);
    const inner = addGarmentRing(builder, { x: 0, y: 1.552, z: -0.014 }, front, across, neckR * 0.7, neckR * 0.66, segments, 1, collarWeights, 0.25, 1);
    stitchGarmentRings(builder, collar, inner);
    const cuffs = [];
    if (sleeve !== "none") {
      const long = sleeve === "long";
      const sleeveSegments = low ? 8 : 12, sleeveStations = low ? 4 : 7;
      for (const side of [-1, 1]) {
        const upper = proto.bones[side > 0 ? "upperarm_l" : "upperarm_r"];
        const lower = proto.bones[side > 0 ? "lowerarm_l" : "lowerarm_r"];
        const hand = proto.bones[side > 0 ? "hand_l" : "hand_r"];
        if (!upper || !lower || !hand) continue;
        const armSegments = armWeightSegments(proto, side);
        const x0 = 0.155;
        const x1 = long ? Math.abs(hand.x) + 0.004 : SN.lerp(Math.abs(upper.x), Math.abs(lower.x), 0.6) + 0.006;
        const endY = long ? hand.y : SN.lerp(upper.y, lower.y, 0.6);
        const endZ = long ? hand.z : SN.lerp(upper.z, lower.z, 0.6);
        const axis = new SN.T.Vector3(side, 0, 0), up = new SN.T.Vector3(0, 1, 0);
        const normal = new SN.T.Vector3().crossVectors(axis, up);
        const wristR = (proto.armGauge && proto.armGauge.wrist) || 0.042;
        const bicepR = (proto.armGauge && proto.armGauge.bicep) || 0.052;
        // Fit the sleeve to the measured arm (plus cloth ease) instead of the old
        // fixed 7.5-10 cm radius that left the thin hand floating in the opening.
        const endRadius = long ? wristR + 0.014 + pad * 0.1 : bicepR + 0.025 + pad * 0.2;
        const ringList = [];
        for (let i = 0; i <= sleeveStations; i++) {
          const f = i / sleeveStations;
          const x = SN.lerp(x0, x1, f) * side;
          const y = SN.lerp(upper.y, endY, f) - 0.006;
          const z = SN.lerp(upper.z, endZ, f) - 0.006 * Math.sin(f * SN.PI);
          const radius = long
            ? SN.lerp(0.082, endRadius, Math.pow(f, 0.72))
            : SN.lerp(0.09, endRadius, Math.pow(f, 0.55));
          ringList.push(addGarmentRing(builder, { x, y, z }, up, normal, radius, radius, sleeveSegments, f,
            point => sleeveWeightsFor(proto, point, side, armSegments), 0, 0.28));
        }
        for (let i = 1; i < ringList.length; i++) stitchGarmentRings(builder, ringList[i - 1], ringList[i]);
        const lastStation = ringList[ringList.length - 1];
        const cuffX = x1 * side - side * 0.018;
        const cuffRadius = long ? endRadius : endRadius + 0.002;
        const cuff = addGarmentRing(builder, { x: cuffX, y: endY - 0.006, z: endZ },
          up, normal, cuffRadius, cuffRadius, sleeveSegments, 1,
          point => sleeveWeightsFor(proto, point, side, armSegments), 0, 0.28);
        stitchGarmentRings(builder, lastStation, cuff);
        // Fold the cuff back inside so the sleeve end reads as a hem instead of
        // an open paper tube. The arm still leaves through the middle.
        const innerCuff = addGarmentRing(builder, { x: cuffX - side * 0.045, y: endY - 0.006, z: endZ },
          up, normal, cuffRadius * 0.72, cuffRadius * 0.72, sleeveSegments, 1,
          point => sleeveWeightsFor(proto, point, side, armSegments), 0, 0.28);
        stitchGarmentRings(builder, cuff, innerCuff);
        const indices = [];
        const step = Math.max(1, Math.ceil(sleeveSegments / 6));
        for (let s = 0; s < sleeveSegments; s += step) indices.push(cuff.start + s);
        cuffs.push({ side, indices, x: cuffX, y: endY - 0.006, z: endZ, radius: cuffRadius });
      }
    }
    return finishGarment(builder, { cuffs });
  }

  function buildBottomGeometry(proto, variant, low) {
    const shorts = variant === "shorts";
    const segments = low ? 10 : 16, hipBands = low ? 4 : 7, legBands = low ? 5 : 11;
    const builder = newGarmentBuilder();
    const pad = shorts ? 0.018 : 0.022;
    const waistY = 1.075, crotchY = 0.8;
    const front = new SN.T.Vector3(0, 0, 1), across = new SN.T.Vector3(1, 0, 0);
    const stations = [];
    for (let i = 0; i <= hipBands; i++) {
      const y = SN.lerp(crotchY, waistY, i / hipBands);
      const p = profileAt(proto.hipProfile, y);
      stations.push({ y, rx: Math.max(0.12, p.rx + pad), rz: Math.max(0.085, p.rz + pad), cz: p.cz });
    }
    for (let pass = 0; pass < 2; pass++) {
      const copy = stations.map(s => ({ rx: s.rx, rz: s.rz }));
      for (let i = 1; i < stations.length - 1; i++) {
        stations[i].rx = (copy[i - 1].rx + copy[i].rx * 2 + copy[i + 1].rx) / 4;
        stations[i].rz = (copy[i - 1].rz + copy[i].rz * 2 + copy[i + 1].rz) / 4;
      }
    }
    const hipRings = [];
    for (const s of stations) {
      hipRings.push(addGarmentRing(builder, { x: 0, y: s.y, z: s.cz }, front, across, s.rz, s.rx, segments,
        0.46 + (s.y - crotchY) / Math.max(0.01, waistY - crotchY) * 0.5, point => hipWeightsFor(proto, point), 0.25, 1));
    }
    for (let i = 1; i < hipRings.length; i++) stitchGarmentRings(builder, hipRings[i - 1], hipRings[i]);
    const waist = stations[stations.length - 1], crotch = stations[0];
    const waistRim = addGarmentRing(builder, { x: 0, y: waist.y - 0.014, z: waist.cz }, front, across, waist.rz * 0.92, waist.rx * 0.92, segments, 0.98,
      point => hipWeightsFor(proto, point), 0.25, 1);
    stitchGarmentRings(builder, waistRim, hipRings[hipRings.length - 1]);
    const crotchRim = addGarmentRing(builder, { x: 0, y: crotch.y + 0.014, z: crotch.cz }, front, across, crotch.rz * 0.9, crotch.rx * 0.9, segments, 0.44,
      point => hipWeightsFor(proto, point), 0.25, 1);
    stitchGarmentRings(builder, hipRings[0], crotchRim);
    const ankleY = shorts ? 0.585 : 0.105, legTop = 0.955;
    const hems = [];
    for (const side of [-1, 1]) {
      const cx = Math.abs(proto.bones.thigh_l.x) * side;
      const legSegments = legWeightSegments(proto, side);
      const legRings = [];
      for (let i = 0; i <= legBands; i++) {
        const y = SN.lerp(ankleY, legTop, i / legBands);
        const flare = shorts && i === 0 ? 0.008 : 0;
        const radius = Math.max(0.05, legRadiusAt(proto, y) + pad * 0.85 + flare);
        const z = SN.lerp(-0.052, -0.036, (y - ankleY) / Math.max(0.01, legTop - ankleY));
        legRings.push(addGarmentRing(builder, { x: cx, y, z }, front, across, radius, radius, segments,
          0.06 + (y - 0.105) / 0.695 * 0.4,
          point => legWeightsFor(proto, point, side, legSegments), 0.5, 0.5));
      }
      for (let i = 1; i < legRings.length; i++) stitchGarmentRings(builder, legRings[i - 1], legRings[i]);
      const bottom = legRings[0];
      const hemRadius = Math.max(0.045, legRadiusAt(proto, ankleY) + pad * 0.85) * 0.9;
      const cuff = addGarmentRing(builder, { x: cx, y: ankleY + 0.016, z: -0.052 }, front, across,
        hemRadius, hemRadius, segments, 0.04,
        point => legWeightsFor(proto, point, side, legSegments), 0.5, 0.5);
      stitchGarmentRings(builder, bottom, cuff);
      const innerHem = addGarmentRing(builder, { x: cx, y: ankleY + 0.046, z: -0.052 }, front, across,
        hemRadius * 0.78, hemRadius * 0.78, segments, 0.04,
        point => legWeightsFor(proto, point, side, legSegments), 0.5, 0.5);
      stitchGarmentRings(builder, cuff, innerHem);
      const indices = [];
      const step = Math.max(1, Math.ceil(segments / 6));
      for (let s = 0; s < segments; s += step) indices.push(cuff.start + s);
      hems.push({ side, indices, x: cx, y: ankleY + 0.016, z: -0.052, radius: hemRadius });
    }
    return finishGarment(builder, { hems });
  }

  function buildSkirtGeometry(proto, low) {
    const segments = low ? 12 : 20, bands = low ? 6 : 11;
    const builder = newGarmentBuilder();
    const front = new SN.T.Vector3(0, 0, 1), across = new SN.T.Vector3(1, 0, 0);
    const hemY = 0.6, waistY = 1.05;
    const rings = [];
    for (let i = 0; i <= bands; i++) {
      const f = i / bands, y = SN.lerp(hemY, waistY, f);
      const p = profileAt(proto.hipProfile, Math.min(1.08, y));
      const flare = 0.135 * Math.pow(1 - f, 1.35);
      const rx = Math.max(0.125, p.rx + 0.03 + flare);
      const rz = Math.max(0.09, p.rz + 0.03 + flare * 0.8);
      rings.push(addGarmentRing(builder, { x: 0, y, z: p.cz }, front, across, rz, rx, segments, f * 0.94,
        point => skirtWeightsFor(proto, point)));
    }
    for (let i = 1; i < rings.length; i++) stitchGarmentRings(builder, rings[i - 1], rings[i]);
    const hemRim = addGarmentRing(builder, { x: 0, y: hemY + 0.016, z: 0 }, front, across, 0.27, 0.28, segments, 0,
      point => skirtWeightsFor(proto, point));
    stitchGarmentRings(builder, rings[0], hemRim);
    return finishGarment(builder);
  }

  function buildShoeGeometry(proto, low) {
    const segments = low ? 8 : 12;
    const builder = newGarmentBuilder();
    const scale = proto.height / 1.81;
    const xAxis = new SN.T.Vector3(1, 0, 0), yAxis = new SN.T.Vector3(0, 1, 0);
    const stations = [
      [-0.082, 0.04, 0.034, 0.058], [-0.064, 0.052, 0.046, 0.058], [-0.036, 0.062, 0.058, 0.058],
      [-0.007, 0.068, 0.06, 0.055], [0.028, 0.074, 0.048, 0.047], [0.058, 0.07, 0.038, 0.04], [0.083, 0.045, 0.026, 0.034]
    ];
    for (const side of [-1, 1]) {
      const foot = proto.bones[side > 0 ? "foot_l" : "foot_r"];
      const ball = proto.bones[side > 0 ? "ball_l" : "ball_r"];
      if (!foot || !ball) continue;
      const cx = foot.x;
      const baseZ = foot.z;
      const soleY = 0.012;
      const rings = [];
      for (let i = 0; i < stations.length; i++) {
        const st = stations[i];
        const z = baseZ + st[0] * scale + (ball.z - foot.z) * (i / (stations.length - 1));
        const ring = addGarmentRing(builder, { x: cx, y: st[3] * scale, z }, xAxis, yAxis,
          st[1] * scale, st[2] * scale, segments, i / (stations.length - 1),
          point => shoeWeightsFor(proto, point, side));
        for (let v = ring.start; v < ring.start + ring.count; v++) {
          if (builder.pos[v * 3 + 1] < soleY) {
            builder.pos[v * 3 + 1] = soleY;
            builder.col[v * 3] = builder.col[v * 3 + 1] = builder.col[v * 3 + 2] = 0.36;
          }
        }
        rings.push(ring);
      }
      for (let i = 1; i < rings.length; i++) stitchGarmentRings(builder, rings[i - 1], rings[i]);
      const heelCenter = addGVertex(builder, cx, stations[0][3] * scale, baseZ + stations[0][0] * scale,
        0.5, 0, shoeWeightsFor(proto, { x: cx, y: 0.05, z: baseZ }, side));
      const toeCenter = addGVertex(builder, cx, stations[stations.length - 1][3] * scale, baseZ + ball.z - foot.z + stations[6][0] * scale,
        0.5, 1, shoeWeightsFor(proto, { x: cx, y: 0.05, z: ball.z }, side));
      const first = rings[0], last = rings[rings.length - 1];
      for (let s = 0; s < segments; s++) {
        builder.tri.push(heelCenter, first.start + s + 1, first.start + s);
        builder.tri.push(toeCenter, last.start + s, last.start + s + 1);
      }
    }
    return finishGarment(builder);
  }

  function mergeSkinnedParts(parts) {
    let vertexTotal = 0, indexTotal = 0;
    for (const part of parts) {
      vertexTotal += part.geometry.attributes.position.count;
      indexTotal += part.geometry.index ? part.geometry.index.count : 0;
    }
    const position = new Float32Array(vertexTotal * 3), normal = new Float32Array(vertexTotal * 3);
    const uv = new Float32Array(vertexTotal * 2), color = new Float32Array(vertexTotal * 3);
    const skinIndex = new Uint16Array(vertexTotal * 4), skinWeight = new Float32Array(vertexTotal * 4);
    const index = vertexTotal > 65535 ? new Uint32Array(indexTotal) : new Uint16Array(indexTotal);
    let vo = 0, io = 0;
    const geometry = new SN.T.BufferGeometry();
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p], g = part.geometry, count = g.attributes.position.count;
      position.set(g.attributes.position.array, vo * 3);
      normal.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      color.set(g.attributes.color.array, vo * 3);
      skinIndex.set(g.attributes.skinIndex.array, vo * 4);
      skinWeight.set(g.attributes.skinWeight.array, vo * 4);
      const source = g.index ? g.index.array : null;
      if (source) for (let i = 0; i < source.length; i++) index[io + i] = source[i] + vo;
      geometry.addGroup(io, source ? source.length : 0, part.materialIndex);
      io += source ? source.length : 0;
      vo += count;
    }
    geometry.setAttribute("position", new SN.T.BufferAttribute(position, 3));
    geometry.setAttribute("normal", new SN.T.BufferAttribute(normal, 3));
    geometry.setAttribute("uv", new SN.T.BufferAttribute(uv, 2));
    geometry.setAttribute("color", new SN.T.BufferAttribute(color, 3));
    geometry.setAttribute("skinIndex", new SN.T.Uint16BufferAttribute(skinIndex, 4));
    geometry.setAttribute("skinWeight", new SN.T.BufferAttribute(skinWeight, 4));
    geometry.setIndex(index instanceof Uint32Array ? new SN.T.BufferAttribute(index, 1) : new SN.T.Uint16BufferAttribute(index, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }

  function collectBodyCategories(proto) {
    const geometry = proto.body.geometry, pos = geometry.attributes.position;
    const si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight, bones = proto.body.skeleton.bones;
    const cats = new Uint8Array(pos.count);
    const codes = { torso: 0, upperarm: 1, lowerarm: 2, hand: 3, thigh: 4, calf: 5, foot: 6, skin: 7 };
    for (let i = 0; i < pos.count; i++) {
      let best = -1, bestWeight = -1;
      for (let k = 0; k < 4; k++) {
        const weight = attrComponent(sw, i, k);
        if (weight > bestWeight) { bestWeight = weight; best = attrComponent(si, i, k); }
      }
      const bone = bones[best];
      cats[i] = bone ? codes[categoryOfBone(bone.name)] || 0 : 0;
    }
    return cats;
  }

  function sampleProfile(proto, y0, y1, bands, allowed, maxAbsX) {
    const pos = proto.body.geometry.attributes.position.array;
    const tolerance = (y1 - y0) / bands * 0.9 + 0.008;
    const raw = [];
    for (let i = 0; i < bands; i++) {
      const y = y0 + (y1 - y0) * i / (bands - 1);
      let rx = 0, zmin = Infinity, zmax = -Infinity, n = 0;
      for (let v = 0; v < proto.vcat.length; v++) {
        if (allowed.indexOf(proto.vcat[v]) < 0) continue;
        if (Math.abs(pos[v * 3 + 1] - y) > tolerance) continue;
        const x = pos[v * 3];
        if (Math.abs(x) > maxAbsX) continue;
        rx = Math.max(rx, Math.abs(x));
        zmin = Math.min(zmin, pos[v * 3 + 2]);
        zmax = Math.max(zmax, pos[v * 3 + 2]);
        n++;
      }
      raw.push({ y, rx, rz: n >= 3 ? Math.max(0.02, (zmax - zmin) / 2) : 0, cz: n >= 3 ? (zmax + zmin) / 2 : 0, ok: n >= 3 });
    }
    let previous = null;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i].ok) previous = raw[i];
      else if (previous) { raw[i].rx = previous.rx; raw[i].rz = previous.rz; raw[i].cz = previous.cz; }
    }
    let next = null;
    for (let i = raw.length - 1; i >= 0; i--) {
      if (raw[i].ok) next = raw[i];
      else if (next) { raw[i].rx = next.rx; raw[i].rz = next.rz; raw[i].cz = next.cz; }
    }
    for (const item of raw) {
      if (!(item.rx > 0)) item.rx = 0.16;
      if (!(item.rz > 0)) item.rz = 0.1;
      item.rx = Math.max(item.rx, 0.075);
      item.rz = Math.max(item.rz, 0.05);
    }
    for (let pass = 0; pass < 2; pass++) {
      const copy = raw.map(item => ({ rx: item.rx, rz: item.rz, cz: item.cz }));
      for (let i = 1; i < raw.length - 1; i++) {
        raw[i].rx = (copy[i - 1].rx + copy[i].rx * 2 + copy[i + 1].rx) / 4;
        raw[i].rz = (copy[i - 1].rz + copy[i].rz * 2 + copy[i + 1].rz) / 4;
        raw[i].cz = (copy[i - 1].cz + copy[i].cz * 2 + copy[i + 1].cz) / 4;
      }
    }
    return raw;
  }

  // Real wrist thickness from the body mesh, so the sleeve can end as a fitted
  // cuff instead of the same 7.5 cm bell on every body type. A wide open bell
  // around a 3 cm wrist is what reads as "the hand is not attached".
  function measureArmGauge(proto) {
    const upper = proto.bones && proto.bones.upperarm_l;
    const lower = proto.bones && proto.bones.lowerarm_l, hand = proto.bones && proto.bones.hand_l;
    if (!upper || !lower || !hand || !proto.body || !proto.body.geometry) return { wrist: 0.042, bicep: 0.052 };
    const pos = proto.body.geometry.attributes.position;
    if (!pos) return { wrist: 0.042, bicep: 0.052 };
    const band = (a, b, t0, t1, quantile) => {
      const sx = b.x - a.x, sy = b.y - a.y, sz = b.z - a.z;
      const len2 = Math.max(1e-6, sx * sx + sy * sy + sz * sz);
      const radii = [];
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const t = ((px - a.x) * sx + (py - a.y) * sy + (pz - a.z) * sz) / len2;
        if (t < t0 || t > t1) continue;
        const cx = a.x + sx * t, cy = a.y + sy * t, cz = a.z + sz * t;
        radii.push(Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy) + (pz - cz) * (pz - cz)));
      }
      if (!radii.length) return null;
      radii.sort((x, y) => x - y);
      return radii[Math.min(radii.length - 1, Math.floor((radii.length - 1) * quantile))];
    };
    // The median is the actual cloth-bearing surface; the old 95th percentile
    // was a single wrist bump and inflated every sleeve by nearly 2 cm.
    const wrist = band(lower, hand, 0.9, 0.99, 0.5);
    const bicep = band(upper, lower, 0.45, 0.68, 0.5);
    return {
      wrist: Math.max(0.028, Math.min(0.055, wrist === null ? 0.042 : wrist)),
      bicep: Math.max(0.036, Math.min(0.07, bicep === null ? 0.052 : bicep))
    };
  }

  function validateGarmentWeights(geometry, boneCount, label) {
    const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
    if (!skinIndex || !skinWeight) return 0;
    const indices = skinIndex.array, weights = skinWeight.array;
    let repaired = 0;
    for (let v = 0; v < skinWeight.count; v++) {
      let total = 0;
      for (let k = 0; k < 4; k++) {
        const at = v * 4 + k;
        let weight = weights[at];
        if (!Number.isFinite(weight) || weight < 0 || indices[at] >= boneCount) {
          weight = 0;
          indices[at] = 0;
          weights[at] = 0;
        }
        total += weight;
      }
      if (!(total > 0.0001)) {
        indices[v * 4] = 0; weights[v * 4] = 1;
        for (let k = 1; k < 4; k++) { indices[v * 4 + k] = 0; weights[v * 4 + k] = 0; }
        repaired++;
      } else if (Math.abs(total - 1) > 0.001) {
        for (let k = 0; k < 4; k++) weights[v * 4 + k] /= total;
        repaired++;
      }
    }
    if (repaired > 0) console.warn("服装蒙皮权重已修正 " + label + "：" + repaired + " 个顶点");
    return repaired;
  }

  function prepareGarments(proto, sex) {
    proto.id = sex;
    proto.garmentsReady = false;
    proto.garmentGeos = {};
    proto.garmentFarGeos = {};
    proto.garmentTris = { high: {}, low: {} };
    proto.boneIndex = {};
    const bones = proto.body.skeleton && proto.body.skeleton.bones;
    if (!bones || !bones.length || !proto.body.geometry.attributes.skinIndex) return;
    bones.forEach((bone, index) => { if (proto.boneIndex[bone.name] === undefined) proto.boneIndex[bone.name] = index; });
    proto.scene.updateMatrixWorld(true);
    proto.bones = {};
    const position = new SN.T.Vector3();
    const names = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "Head", "clavicle_l", "clavicle_r",
      "upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r", "hand_l", "hand_r", "thigh_l", "thigh_r",
      "calf_l", "calf_r", "foot_l", "foot_r", "ball_l", "ball_r"];
    for (const name of names) {
      const bone = bones.find(item => item.name === name);
      if (bone) { bone.getWorldPosition(position); proto.bones[name] = position.clone(); }
    }
    if (!proto.bones.upperarm_l || !proto.bones.lowerarm_l || !proto.bones.thigh_l) return;
    proto.armGauge = measureArmGauge(proto);
    proto.vcat = collectBodyCategories(proto);
    proto.torsoProfile = sampleProfile(proto, 0.88, 1.565, 18, [0], 0.25);
    proto.hipProfile = sampleProfile(proto, 0.72, 1.1, 10, [0, 4], 0.27);
    const variants = ["topLong", "topShort", "topNone", "topCoat", "pants", "shorts", "skirt", "shoes"];
    for (const key of variants) {
      for (const low of [false, true]) {
        let geometry;
        if (key === "shoes") geometry = buildShoeGeometry(proto, low);
        else if (key === "skirt") geometry = buildSkirtGeometry(proto, low);
        else if (key === "pants" || key === "shorts") geometry = buildBottomGeometry(proto, key, low);
        else geometry = buildTopGeometry(proto, key, low);
        proto.garmentGeos[key + (low ? "|lo" : "|hi")] = geometry;
        proto.garmentTris[low ? "low" : "high"][key] = geometry.index ? geometry.index.count / 3 : 0;
        validateGarmentWeights(geometry, bones.length, key + (low ? " 低模" : " 高模"));
      }
    }
    const high = proto.garmentTris.high;
    proto.garmentsReady = high.pants > 120 && high.topLong > 180 && high.shoes > 80 && high.skirt > 80;
    M.garmentStats[sex] = proto.garmentTris;
    if (SN.devMode) {
      console.log("服装三角面 " + (sex === "male" ? "男" : "女") + " 高：" +
        ["topLong", "topShort", "topNone", "topCoat", "pants", "shorts", "skirt", "shoes"].map(key => key + "=" + Math.round(high[key])).join(" ") +
        " 低：" + Math.round(proto.garmentTris.low.topLong + proto.garmentTris.low.pants + proto.garmentTris.low.shoes));
    }
  }

  function garmentGeometry(proto, key, low) {
    return proto.garmentGeos[key + (low ? "|lo" : "|hi")] || proto.garmentGeos[key + "|hi"];
  }

  function garmentFarGeometry(proto, keys) {
    const cacheKey = keys.top + "|" + keys.bottom;
    if (proto.garmentFarGeos[cacheKey]) return proto.garmentFarGeos[cacheKey];
    const geometry = mergeSkinnedParts([
      { geometry: proto.garmentGeos[keys.top + "|lo"], materialIndex: 0 },
      { geometry: proto.garmentGeos[keys.bottom + "|lo"], materialIndex: 1 },
      { geometry: proto.garmentGeos["shoes|lo"], materialIndex: 2 }
    ]);
    proto.garmentFarGeos[cacheKey] = geometry;
    return geometry;
  }

  function preparePerson(gltf, sex) {
    const scene = gltf.scene;
    let body = null, bodyScore = -1;
    scene.updateMatrixWorld(true);
    scene.traverse(object => {
      if (!object.isSkinnedMesh || !object.geometry || !object.geometry.attributes.position) return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      const named = material && /superhero/i.test(material.name || "");
      const score = object.geometry.attributes.position.count + (named ? 100000 : 0);
      if (score > bodyScore) { bodyScore = score; body = object; }
    });
    if (!body) throw new Error("人物身体网格缺失");
    const material = Array.isArray(body.material) ? body.material[0] : body.material;
    if (!material) throw new Error("人物身体材质缺失");
    const mask = buildClothMasks(body);
    const bounds = new SN.T.Box3().setFromObject(scene);
    const height = Math.max(1.3, bounds.max.y - bounds.min.y);
    // Hair files are authored in absolute character space; cache the bind-pose
    // transform once so later animation cannot bake a walking head pose into it.
    const headBone = scene.getObjectByName("Head");
    const sceneInverse = new SN.T.Matrix4().copy(scene.matrixWorld).invert();
    const headRest = headBone
      ? new SN.T.Matrix4().multiplyMatrices(sceneInverse, headBone.matrixWorld).invert()
      : new SN.T.Matrix4();
    const proto = {
      id: sex,
      scene,
      body,
      bodyName: body.name,
      material,
      height,
      mask,
      maps: { dark: material.map || null, light: null },
      headName: "Head",
      headRest,
      garmentsReady: false
    };
    M.skinMaps[sex].dark = proto.maps.dark;
    try { prepareGarments(proto, sex); }
    catch (error) {
      proto.garmentsReady = false;
      console.warn("服装外壳生成失败，保留贴图服装。");
    }
    return proto;
  }

  function prepareHair(gltf, id) {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    let mesh = null;
    scene.traverse(object => { if (!mesh && object.isMesh && object.geometry) mesh = object; });
    if (!mesh) throw new Error("发型网格缺失");
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    M.hair[id] = { geometry, material: mesh.material, id };
  }

  function prepareAnimation(gltf) {
    const clips = gltf.animations || [];
    if (!clips.length) throw new Error("动画库为空");
    for (const clip of clips) {
      // Root translation is authored flat in this library; removing it guarantees
      // gameplay code owns every metre of position.
      clip.tracks = clip.tracks.filter(track => !/^root\.position$/.test(track.name));
      M.clips[clip.name] = clip;
    }
    M.animReady = true;
  }

  function categoryForCarMaterial(name) {
    const n = String(name || "").toLowerCase();
    if (n.indexOf("window") >= 0 || n === "glass") return "glass";
    if (n.indexOf("headlight") >= 0) return "head";
    if (n.indexOf("taillight") >= 0 || n.indexOf("brakelight") >= 0 || n === "tail") return "tail";
    if (n.indexOf("bluelight") >= 0) return "policeBlue";
    if (n.indexOf("whitelight") >= 0) return "policeWhite";
    if (n === "grey" || n === "black" || n.indexOf("trim") >= 0 || n.indexOf("chrome") >= 0) return "trim";
    return "paint";
  }

  function isUnderWheel(object, stop) {
    let node = object;
    while (node && node !== stop) {
      if (/wheel/i.test(node.name || "")) return true;
      node = node.parent;
    }
    return false;
  }

  function collectWheelRoots(scene) {
    const roots = [];
    scene.traverse(object => {
      if (!/wheel/i.test(object.name || "")) return;
      if (isUnderWheel(object.parent, scene)) return;
      let hasMesh = false;
      object.traverse(child => { if (child.isMesh) hasMesh = true; });
      if (hasMesh) roots.push(object);
    });
    return roots;
  }

  function prepareCar(file, key) {
    const scene = file.scene;
    scene.updateMatrixWorld(true);
    const bodyByCategory = new Map(), wheelRoots = collectWheelRoots(scene);
    scene.traverse(object => {
      if (!object.isMesh || !object.geometry || isUnderWheel(object, scene)) return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      const category = categoryForCarMaterial(material && material.name);
      if (!bodyByCategory.has(category)) bodyByCategory.set(category, []);
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      bodyByCategory.get(category).push({ g: geometry });
    });
    if (!bodyByCategory.size) throw new Error("车辆外壳缺失");
    const root = new SN.T.Group();
    root.name = "car-" + key;
    for (const [category, parts] of bodyByCategory) {
      const merged = parts.length === 1 ? parts[0].g : SN.merged(parts);
      if (parts.length > 1) for (const part of parts) part.g.dispose();
      const mesh = new SN.T.Mesh(merged, M.carTrimMat || SN.tireMat);
      mesh.name = "body-" + category;
      mesh.userData.carCategory = category;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      root.add(mesh);
    }
    const wheels = [];
    for (const wheelRoot of wheelRoots) {
      const box = new SN.T.Box3().setFromObject(wheelRoot);
      const center = box.getCenter(new SN.T.Vector3());
      const size = box.getSize(new SN.T.Vector3());
      const parts = [];
      wheelRoot.traverse(object => {
        if (!object.isMesh || !object.geometry) return;
        const geometry = object.geometry.clone();
        geometry.applyMatrix4(object.matrixWorld);
        parts.push({ g: geometry });
      });
      if (!parts.length) continue;
      const geometry = parts.length === 1 ? parts[0].g : SN.merged(parts);
      if (parts.length > 1) for (const part of parts) part.g.dispose();
      geometry.translate(-center.x, -center.y, -center.z);
      wheels.push({
        geometry,
        center,
        front: /front/i.test(wheelRoot.name || ""),
        radius: Math.max(size.y, size.z) * 0.5
      });
    }
    for (const wheel of wheels) {
      const pivot = new SN.T.Group();
      pivot.position.copy(wheel.center);
      pivot.userData.wheelPivot = true;
      pivot.userData.front = wheel.front;
      const spin = new SN.T.Group();
      spin.userData.wheelSpin = true;
      const mesh = new SN.T.Mesh(wheel.geometry, M.carWheelMat || SN.tireMat);
      mesh.userData.carCategory = "wheel";
      mesh.castShadow = false;
      spin.add(mesh);
      pivot.add(spin);
      root.add(pivot);
    }
    // The pickup is authored Z-up; every other vehicle already points down +Z.
    const pickup = key === "pickup";
    if (pickup) root.rotation.x = -SN.PI / 2;
    const bounds = new SN.T.Box3().setFromObject(root);
    const size = bounds.getSize(new SN.T.Vector3()), center = bounds.getCenter(new SN.T.Vector3());
    const proto = {
      key,
      root,
      pickup,
      size,
      center,
      minY: bounds.min.y,
      length: Math.max(0.1, size.z),
      width: Math.max(0.1, size.x),
      height: Math.max(0.1, size.y),
      glass: bodyByCategory.has("glass"),
      wheelRadius: wheels.length ? wheels.reduce((sum, wheel) => sum + wheel.radius, 0) / wheels.length : 0.3
    };
    M.carPrototypes[key] = proto;
    M.carTypes[key] = true;
    M.carPrototypeCount = Object.keys(M.carPrototypes).length;
  }

  function outfitDefaults(overrides) {
    return Object.assign({
      top: 0x3b4b58,
      bottom: 0x2a333c,
      shoe: 0x171b1f,
      accent: 0xc9a45d,
      collar: 0xd8ddd9,
      belt: 0x171b20,
      sole: 0x111417,
      sleeve: "long",
      shorts: false,
      skirt: false,
      topHem: 1.0,
      beltY: 1.06,
      shortHem: 0.6,
      rough: 0.92,
      inflate: 0.02,
      cap: false,
      capColor: 0x26313d,
      backpack: false,
      satchel: false,
      box: false,
      glasses: false,
      mask: false,
      apron: false,
      badge: false,
      topStyle: "",
      fabricTop: "cotton",
      fabricBottom: "denim",
      label: ""
    }, overrides || {});
  }

  function defineOutfits() {
    M.outfits = {
      office: outfitDefaults({ label: "西装", top: 0x252f3d, bottom: 0x2a3442, accent: 0x9b3b44, collar: 0xe8e7df, cap: false, badge: true, fabricTop: "suit", fabricBottom: "suit" }),
      hoodie: outfitDefaults({ label: "连帽衫", top: 0x455d6b, bottom: 0x2d3946, accent: 0xe0a94d, collar: 0x74909b, inflate: 0.034, fabricTop: "knit", fabricBottom: "denim" }),
      delivery: outfitDefaults({ label: "配送制服", top: 0xd88a2a, bottom: 0x2d373f, accent: 0xf0ce74, collar: 0xe9d8a8, cap: true, capColor: 0xd88a2a, backpack: true, box: true, badge: true, fabricTop: "hivis", fabricBottom: "work" }),
      student: outfitDefaults({ label: "校服", top: 0x273b57, bottom: 0x3a4558, accent: 0xb6c7d4, collar: 0xe9e7dc, cap: false, badge: true, satchel: true, fabricTop: "school", fabricBottom: "suit" }),
      schoolSkirt: outfitDefaults({ label: "校服裙", top: 0x273b57, bottom: 0x394354, accent: 0xb6c7d4, collar: 0xe9e7dc, skirt: true, badge: true, satchel: true, fabricTop: "school", fabricBottom: "suit" }),
      hiking: outfitDefaults({ label: "登山装", top: 0x5e6f4d, bottom: 0x5a5847, accent: 0xd9a64e, collar: 0x9ca486, cap: true, capColor: 0x4b5c43, inflate: 0.03, fabricTop: "nylon", fabricBottom: "cargo" }),
      police: outfitDefaults({ label: "警服", top: 0x24456a, bottom: 0x1d2838, accent: 0x9fcce5, collar: 0xbfdceb, belt: 0x101720, cap: true, capColor: 0x1c3552, inflate: 0.026, badge: true, fabricTop: "police", fabricBottom: "suit" }),
      gangTeal: outfitDefaults({ label: "青帮", top: 0x246f68, bottom: 0x28333c, accent: 0xe7e2c2, collar: 0x2f8b80, cap: true, capColor: 0x1f5b56, inflate: 0.026, mask: true, fabricTop: "leather", fabricBottom: "denim" }),
      gangRed: outfitDefaults({ label: "赤帮", top: 0x8d3a31, bottom: 0x393033, accent: 0xf0c45f, collar: 0x642a25, cap: true, capColor: 0x6b2b25, inflate: 0.026, mask: true, fabricTop: "leather", fabricBottom: "denim" }),
      summerDress: outfitDefaults({ label: "夏日裙装", top: 0xc48d97, bottom: 0xc48d97, accent: 0xf0d3b4, collar: 0xe6b7bb, sleeve: "short", skirt: true, topHem: 0.98, inflate: 0.02, fabricTop: "silk", fabricBottom: "silk" }),
      tourist: outfitDefaults({ label: "游客装", top: 0x789b9d, bottom: 0x6b6252, accent: 0xe0b56e, collar: 0xb7d2cb, sleeve: "short", shorts: true, backpack: true, inflate: 0.02, fabricTop: "tee", fabricBottom: "cargo" }),
      elder: outfitDefaults({ label: "长者外套", top: 0x80766d, bottom: 0x4d4e4f, accent: 0xcbb59c, collar: 0xb7ad9d, inflate: 0.034, topStyle: "coat", fabricTop: "wool", fabricBottom: "suit" }),
      nightlife: outfitDefaults({ label: "夜行装", top: 0x5d4678, bottom: 0x2c283d, accent: 0x91ded2, collar: 0x9e77ad, inflate: 0.024, glasses: true, fabricTop: "leather", fabricBottom: "denim" }),
      worker: outfitDefaults({ label: "施工服", top: 0xe0a82e, bottom: 0x4a5259, accent: 0xe8e0c8, collar: 0x9d7c27, cap: true, capColor: 0xe0a82e, inflate: 0.026, badge: true, fabricTop: "hivis", fabricBottom: "work" }),
      vendor: outfitDefaults({ label: "摊主围裙", top: 0xb94d3e, bottom: 0x373d42, accent: 0xf1d9a5, collar: 0xd8b89b, sleeve: "short", apron: true, cap: true, capColor: 0x8e3a30, fabricTop: "apron", fabricBottom: "denim" }),
      jogger: outfitDefaults({ label: "慢跑装", top: 0x638269, bottom: 0x2d3238, accent: 0xe8c56b, collar: 0xa8c1a4, sleeve: "short", shorts: true, inflate: 0.016, fabricTop: "sport", fabricBottom: "sport" }),
      tank: outfitDefaults({ label: "背心", top: 0x9e6d4d, bottom: 0x4a4f54, accent: 0xe3c58d, collar: 0x9e6d4d, sleeve: "none", inflate: 0.014, fabricTop: "knit", fabricBottom: "denim" }),
      market: outfitDefaults({ label: "市场便装", top: 0x7c5a44, bottom: 0x3c4248, accent: 0xd8b777, collar: 0xd8cbb4, sleeve: "short", satchel: true, inflate: 0.022, fabricTop: "check", fabricBottom: "cargo" }),
      nurse: outfitDefaults({ label: "医护服", top: 0xc7d9d4, bottom: 0xc7d9d4, accent: 0x4f8f86, collar: 0xeef3ed, badge: true, satchel: true, inflate: 0.022, fabricTop: "cotton", fabricBottom: "suit" }),
      security: outfitDefaults({ label: "保安制服", top: 0x2b3a4a, bottom: 0x222c36, accent: 0xd8b04a, collar: 0xaebbc4, cap: true, capColor: 0x1f2b37, badge: true, inflate: 0.026, fabricTop: "suit", fabricBottom: "suit" }),
      player: outfitDefaults({ label: "城市便装", top: 0x137fba, bottom: 0x365d83, accent: 0xffd259, collar: 0xffd259, sleeve: "long", inflate: 0.026, fabricTop: "tee", fabricBottom: "denim" })
    };
  }

  function ensureOutfit(id, overrides) {
    if (!M.outfits[id]) M.outfits[id] = outfitDefaults(Object.assign({ label: id }, overrides || {}));
    return M.outfits[id];
  }

  function sleeveValues(outfit) {
    if (outfit.sleeve === "long") return { long: 1, short: 0, end: 1 };
    if (outfit.sleeve === "none") return { long: 0, short: 0, end: 0.2 };
    return { long: 0, short: 1, end: 0.39 };
  }

  function makeFallbackBody(sex, tone, outfit) {
    return new SN.T.MeshStandardMaterial({
      color: colorValue(outfit.top),
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0.25
    });
  }

  function makeBodyMaterial(sex, tone, outfitId) {
    const proto = M.prototypes[sex];
    if (!proto) return null;
    const outfit = M.outfits[outfitId] || M.outfits.office;
    if (!proto.mask) return makeFallbackBody(sex, tone, outfit);
    const map = M.skinMaps[sex][tone] || proto.maps.dark;
    const sleeve = sleeveValues(outfit);
    const uniforms = {
      uTopColor: { value: colorValue(outfit.top) },
      uBottomColor: { value: colorValue(outfit.bottom) },
      uShoeColor: { value: colorValue(outfit.shoe) },
      uAccentColor: { value: colorValue(outfit.accent) },
      uCollarColor: { value: colorValue(outfit.collar) },
      uBeltColor: { value: colorValue(outfit.belt) },
      uSoleColor: { value: colorValue(outfit.sole) },
      uSleeveEnd: { value: sleeve.end },
      uLongSleeve: { value: sleeve.long },
      uShortSleeve: { value: sleeve.short },
      uShorts: { value: outfit.shorts ? 1 : 0 },
      uLongLegs: { value: outfit.skirt || outfit.shorts ? 0 : 1 },
      uBadge: { value: outfit.badge ? 1 : 0 },
      uTopHem: { value: outfit.topHem },
      uBeltY: { value: outfit.beltY },
      uShortHem: { value: outfit.shortHem },
      uInflate: { value: outfit.inflate },
      uClothRough: { value: outfit.rough },
      uSkinTint: { value: tone === "light" ? new SN.T.Color(1.0, 0.9, 0.82) : new SN.T.Color(1.0, 0.97, 0.93) }
    };
    const material = proto.material.clone();
    material.name = "cloth-" + sex + "-" + tone + "-" + outfitId;
    material.map = map;
    material.color.set(0xffffff);
    material.roughness = 0.9;
    material.metalness = 0;
    material.normalMap = null;
    material.roughnessMap = null;
    material.metalnessMap = null;
    material.aoMap = null;
    material.emissiveMap = null;
    material.envMapIntensity = 0.3;
    material.side = SN.T.FrontSide;
    material.vertexColors = false;
    material.skinning = true;
    material.userData.clothUniforms = uniforms;
    material.onBeforeCompile = shader => {
      for (const key of Object.keys(uniforms)) shader.uniforms[key] = uniforms[key];
      shader.vertexShader = [
        "attribute vec4 aClothA;",
        "attribute vec4 aClothB;",
        "uniform float uSleeveEnd;",
        "uniform float uLongSleeve;",
        "uniform float uShortSleeve;",
        "uniform float uShorts;",
        "uniform float uLongLegs;",
        "uniform float uTopHem;",
        "uniform float uShortHem;",
        "uniform float uInflate;",
        "varying vec3 vClothMix;",
        "varying float vClothMask;",
        "varying float vBindY;",
        "varying float vBindX;",
        "varying float vHand;",
        "varying vec3 vObjNormal;",
        shader.vertexShader
      ].join("\n");
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", [
        "#include <begin_vertex>",
        "vec4 ca = aClothA;",
        "vec4 cb = aClothB;",
        "float axY = abs(position.x);",
        "float skinMask = clamp(ca.w + cb.w, 0.0, 1.0);",
        "float hem = smoothstep(uTopHem - 0.012, uTopHem + 0.012, position.y);",
        "float topW = ca.x * hem + ca.y + ca.z;",
        "float bottomW = ca.x * (1.0 - hem) + cb.x + cb.y;",
        "float shoeW = cb.z;",
        "float bareUpper = ca.y * (1.0 - uLongSleeve - uShortSleeve);",
        "float bareLower = ca.z * (1.0 - uLongSleeve);",
        "float bareLegs = (cb.x + cb.y) * (1.0 - uLongLegs) - cb.x * uShorts;",
        "float bare = clamp(bareUpper + bareLower + bareLegs, 0.0, 1.0);",
        "float clothMask = clamp(1.0 - skinMask, 0.0, 1.0) * (1.0 - bare);",
        "vec3 clothMix = vec3(topW, bottomW, shoeW);",
        "vClothMix = clothMix;",
        "vClothMask = clothMask;",
        "vBindY = position.y;",
        "vBindX = axY;",
        "vHand = clamp(ca.w, 0.0, 1.0);",
        "vObjNormal = normalize(objectNormal);",
        "transformed += objectNormal * (uInflate * smoothstep(0.0, 0.7, clothMask));"
      ].join("\n"));
      shader.fragmentShader = [
        "uniform vec3 uTopColor;",
        "uniform vec3 uBottomColor;",
        "uniform vec3 uShoeColor;",
        "uniform vec3 uAccentColor;",
        "uniform vec3 uCollarColor;",
        "uniform vec3 uBeltColor;",
        "uniform vec3 uSoleColor;",
        "uniform vec3 uSkinTint;",
        "uniform float uBeltY;",
        "uniform float uTopHem;",
        "uniform float uShortHem;",
        "uniform float uLongSleeve;",
        "uniform float uShorts;",
        "uniform float uBadge;",
        "uniform float uClothRough;",
        "varying vec3 vClothMix;",
        "varying float vClothMask;",
        "varying float vBindY;",
        "varying float vBindX;",
        "varying float vHand;",
        "varying vec3 vObjNormal;",
        shader.fragmentShader
      ].join("\n");
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", [
        "vec4 rawTexel = texture2D(map, vUv);",
        "vec4 texel = vec4(pow(max(rawTexel.rgb, vec3(0.0)), vec3(2.2)), rawTexel.a);",
        "float lum = dot(texel.rgb, vec3(0.299, 0.587, 0.114));",
        "float total = max(vClothMix.x + vClothMix.y + vClothMix.z, 0.0001);",
        "vec3 garment = (uTopColor * vClothMix.x + uBottomColor * vClothMix.y + uShoeColor * vClothMix.z) / total;",
        "vec3 cloth = garment * (0.9 + 0.12 * lum);",
        "cloth *= 0.955 + 0.045 * sin(vBindX * 380.0 + vBindY * 41.0) * sin(vBindY * 430.0);",
        "float topF = clamp(vClothMix.x / total, 0.0, 1.0);",
        "float bottomF = clamp(vClothMix.y / total, 0.0, 1.0);",
        "float front = smoothstep(0.15, 0.55, vObjNormal.z);",
        "float collar = topF * smoothstep(1.59, 1.62, vBindY) * (1.0 - smoothstep(1.68, 1.71, vBindY));",
        "cloth = mix(cloth, uCollarColor * (0.82 + 0.2 * lum), collar * 0.95);",
        "float hemBand = topF * (1.0 - smoothstep(0.012, 0.03, abs(vBindY - uTopHem)));",
        "cloth = mix(cloth, uTopColor * 0.7, hemBand * 0.75);",
        "float belt = bottomF * (1.0 - smoothstep(0.02, 0.04, abs(vBindY - uBeltY)));",
        "cloth = mix(cloth, uBeltColor, belt * 0.95);",
        "float buckle = belt * front * (1.0 - smoothstep(0.025, 0.04, vBindX));",
        "cloth = mix(cloth, uAccentColor, buckle * 0.8);",
        "float placket = topF * front * (1.0 - smoothstep(0.005, 0.014, vBindX)) * smoothstep(uTopHem + 0.02, uTopHem + 0.05, vBindY);",
        "cloth = mix(cloth, uTopColor * 0.55, placket * 0.65);",
        "float badge = uBadge * topF * front * (1.0 - smoothstep(0.018, 0.032, vBindX)) * smoothstep(1.33, 1.35, vBindY) * (1.0 - smoothstep(1.41, 1.43, vBindY));",
        "cloth = mix(cloth, uAccentColor, badge * 0.9);",
        "float cuff = uLongSleeve * smoothstep(0.08, 0.3, vHand) * (1.0 - smoothstep(0.6, 0.85, vHand));",
        "cloth = mix(cloth, uTopColor * 0.62, cuff * 0.8);",
        "float shortCuff = uShorts * bottomF * (1.0 - smoothstep(0.02, 0.04, abs(vBindY - uShortHem)));",
        "cloth = mix(cloth, uBottomColor * 0.7, shortCuff * 0.8);",
        "float knee = bottomF * front * (1.0 - smoothstep(0.014, 0.032, abs(vBindY - 0.57)));",
        "cloth = mix(cloth, uBottomColor * 0.76, knee * 0.45);",
        "float sole = vClothMix.z * (1.0 - smoothstep(0.04, 0.06, vBindY));",
        "cloth = mix(cloth, uSoleColor, sole * 0.95);",
        "float lace = vClothMix.z * front * smoothstep(0.065, 0.085, vBindY) * (1.0 - smoothstep(0.12, 0.14, vBindY)) * (1.0 - smoothstep(0.04, 0.07, vBindX));",
        "cloth = mix(cloth, uAccentColor, lace * 0.55);",
        "vec3 skin = texel.rgb * uSkinTint;",
        "diffuseColor.rgb = mix(skin, cloth, clamp(vClothMask, 0.0, 1.0));",
        "diffuseColor.a = texel.a;"
      ].join("\n"));
      shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.72, uClothRough, vClothMask);");
    };
    material.customProgramCacheKey = () => "seoul-cloth-v1";
    return material;
  }

  const bodyMaterials = new Map();
  function bodyMaterial(sex, tone, outfitId) {
    const key = sex + "|" + tone + "|" + outfitId;
    if (!bodyMaterials.has(key)) {
      const material = makeBodyMaterial(sex, tone, outfitId);
      if (material) {
        SN.envMats.push({ material, base: 0.3 });
        bodyMaterials.set(key, material);
      }
    }
    return bodyMaterials.get(key) || null;
  }

  const hairMaterials = new Map();
  function hairMaterial(proto, color, underHat) {
    const key = proto.id + "|" + color + (underHat ? "|hat" : "");
    if (!hairMaterials.has(key)) {
      const material = proto.material.clone();
      material.color.copy(colorValue(color)).lerp(new SN.T.Color(0xffffff), 0.08);
      material.roughness = 0.86;
      material.metalness = 0;
      material.side = SN.T.DoubleSide;
      material.envMapIntensity = 0.35;
      if (underHat) {
        // Hair meshes are authored in character space; clip the crown so a cap
        // never lets strands poke through, while the lower hair remains.
        material.onBeforeCompile = shader => {
          shader.uniforms.uHairCut = { value: 1.7 };
          shader.vertexShader = "varying float vHairSurfaceY;\n" + shader.vertexShader.replace("#include <begin_vertex>",
            "#include <begin_vertex>\nvHairSurfaceY = position.y;");
          shader.fragmentShader = "uniform float uHairCut;\nvarying float vHairSurfaceY;\n" + shader.fragmentShader.replace(
            "#include <clipping_planes_fragment>",
            "#include <clipping_planes_fragment>\nif (vHairSurfaceY > uHairCut) discard;");
        };
        material.customProgramCacheKey = () => "seoul-hair-hat-v1";
      }
      SN.envMats.push({ material, base: 0.35 });
      hairMaterials.set(key, material);
    }
    return hairMaterials.get(key);
  }

  function toneFor(skin) {
    const color = new SN.T.Color(skin);
    const lum = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
    return lum < 0.43 ? "dark" : "light";
  }

  function sexForProfile(profile) {
    return profile && profile.men === false ? "female" : "male";
  }

  function hairIdFor(style, sex) {
    if (style === "long") return "Hair_Long";
    if (style === "pony") return "Hair_Buns";
    if (style === "bob") return sex === "female" ? "Hair_BuzzedFemale" : "Hair_SimpleParted";
    if (style === "undercut") return "Hair_Buzzed";
    if (style === "cap" || style === "beanie") return sex === "female" ? "Hair_BuzzedFemale" : "Hair_Buzzed";
    return sex === "female" ? "Hair_SimpleParted" : "Hair_SimpleParted";
  }

  function outfitForArchetype(archetype, profile, kind, crew, sex) {
    if (kind === "police") return "police";
    if (kind === "gang") return crew === 0 ? "gangTeal" : "gangRed";
    if (profile && profile.skirt) return archetype === "student" ? "schoolSkirt" : "summerDress";
    if (archetype === "office") return "office";
    if (archetype === "student") return "student";
    if (archetype === "tourist") return profile && profile.shorts ? "tourist" : "tourist";
    if (archetype === "elder") return "elder";
    if (archetype === "delivery") return "delivery";
    if (archetype === "vendor") return "vendor";
    if (archetype === "couple") return sex === "female" ? "summerDress" : "hoodie";
    if (archetype === "jogger") return "jogger";
    if (archetype === "worker") return "worker";
    if (archetype === "nightlife") return "nightlife";
    if (profile && profile.outfit === "hoodie") return "hoodie";
    if (profile && profile.outfit === "tee") return sex === "female" ? "summerDress" : "tourist";
    return "office";
  }

  function makeAgent(sex, parent, isPlayer) {
    const proto = M.prototypes[sex];
    if (!proto || !SN.T.SkeletonUtils || typeof SN.T.SkeletonUtils.clone !== "function") return null;
    const root = SN.T.SkeletonUtils.clone(proto.scene);
    root.name = isPlayer ? "player-model" : "npc-model";
    root.rotation.set(0, 0, 0);
    root.position.set(0, 0, 0);
    root.visible = !!isPlayer;
    const agent = {
      id: M.agentSerial++,
      root,
      mixer: new SN.T.AnimationMixer(root),
      body: null,
      headBone: null,
      handBone: null,
      hairMesh: null,
      capMesh: null,
      skirt: null,
      pack: null,
      garments: null,
      farGarment: null,
      garmentKeys: null,
      garmentMaterials: null,
      garmentDetailLow: false,
      garmentsEnabled: false,
      garmentTris: null,
      fingerCurl: [],
      faceExtras: null,
      satchel: null,
      actions: {},
      action: null,
      actionName: "",
      sex,
      target: null,
      source: null,
      lookKey: "",
      outfitId: "",
      lodClock: 0,
      isPlayer: !!isPlayer,
      publicAgent: false
    };
    let best = null, bestCount = -1;
    root.traverse(object => {
      if (object.isSkinnedMesh && object.geometry && object.geometry.attributes.position) {
        const material = Array.isArray(object.material) ? object.material[0] : object.material;
        const count = object.geometry.attributes.position.count + (material && /superhero/i.test(material.name || "") ? 100000 : 0);
        if (count > bestCount) { best = object; bestCount = count; }
        object.frustumCulled = false;
        object.receiveShadow = false;
        object.castShadow = false;
      }
      if (object.isMesh) {
        object.frustumCulled = false;
        object.receiveShadow = false;
        object.castShadow = false;
      }
    });
    agent.body = best;
    agent.headBone = root.getObjectByName("Head");
    agent.handBone = root.getObjectByName("hand_r");
    if (!agent.body || !agent.headBone) return null;
    if (isPlayer) agent.body.castShadow = SN.qualityLevel() >= 1;
    if (parent) parent.add(root);
    else try { SN.scene.add(root); } catch (error) { return null; }
    if (agent.body) agent.body.castShadow = isPlayer && SN.qualityLevel() >= 1;
    collectFingerCurl(agent);
    return agent;
  }

  function headTransform(agent) {
    agent.root.updateWorldMatrix(true, true);
    agent.headBone.updateWorldMatrix(true, false);
    const rootWorld = new SN.T.Matrix4().copy(agent.root.matrixWorld).invert();
    return new SN.T.Matrix4().multiplyMatrices(rootWorld, agent.headBone.matrixWorld).invert();
  }

  function attachHair(agent, id, color, underHat) {
    if (agent.hairMesh && agent.hairMesh.parent) agent.hairMesh.parent.remove(agent.hairMesh);
    agent.hairMesh = null;
    const proto = M.hair[id];
    if (!proto) return;
    const mesh = new SN.T.Mesh(proto.geometry, hairMaterial(proto, color, !!underHat));
    mesh.name = "hair";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    const protoModel = M.prototypes[agent.sex];
    mesh.matrix.copy(protoModel && protoModel.headRest ? protoModel.headRest : headTransform(agent));
    agent.headBone.add(mesh);
    agent.hairMesh = mesh;
  }

  let capScale = 0;
  function attachCap(agent, color) {
    if (!agent.capMesh) {
      if (!SN.rigGeo || !SN.rigGeo.hatCap) return;
      if (!capScale) {
        SN.rigGeo.hatCap.computeBoundingBox();
        const box = SN.rigGeo.hatCap.boundingBox, size = box.getSize(new SN.T.Vector3());
        capScale = 0.235 / Math.max(0.001, Math.max(size.x, size.z));
      }
      const material = new SN.T.MeshStandardMaterial({ color: colorValue(color), roughness: 0.85, metalness: 0.02, envMapIntensity: 0.3 });
      agent.capMesh = new SN.T.Mesh(SN.rigGeo.hatCap, material);
      agent.capMesh.name = "cap";
      agent.capMesh.castShadow = false;
      agent.capMesh.frustumCulled = false;
      agent.capMesh.matrixAutoUpdate = false;
      agent.headBone.add(agent.capMesh);
    }
    agent.capMesh.visible = true;
    agent.capMesh.material.color.copy(colorValue(color));
    // The procedural hat points are head-joint local, so the cap only needs a
    // shared scale and a few millimetres of forward offset.
    const center = new SN.T.Matrix4().makeTranslation(0, 0.01 * capScale, 0.004 * capScale);
    const scale = new SN.T.Matrix4().makeScale(capScale, capScale * 0.9, capScale);
    agent.capMesh.matrix.copy(center).multiply(scale);
  }

  let skirtGeometry = null, packGeometry = null;
  function ensureSkirt(agent) {
    if (agent.skirt) return;
    const geometry = skirtGeometry || (skirtGeometry = new SN.T.CylinderGeometry(0.19, 0.31, 0.54, 10, 1, true));
    const material = new SN.T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, side: SN.T.DoubleSide, envMapIntensity: 0.25 });
    const mesh = new SN.T.Mesh(geometry, material);
    mesh.name = "skirt";
    mesh.position.y = 0.77;
    mesh.visible = false;
    mesh.castShadow = false;
    agent.root.add(mesh);
    agent.skirt = mesh;
  }

  function ensurePack(agent) {
    if (agent.pack) return;
    const material = new SN.T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.02, envMapIntensity: 0.25 });
    const geometry = packGeometry || (packGeometry = SN.roundedBox(0.29, 0.38, 0.16, 0.04));
    const mesh = new SN.T.Mesh(geometry, material);
    mesh.name = "pack";
    mesh.position.set(0, 1.22, -0.18);
    mesh.visible = false;
    mesh.castShadow = false;
    agent.root.add(mesh);
    agent.pack = mesh;
  }

  let capBadgeGeometry = null, glassesGeometry = null, maskGeometry = null;
  let badgeMaterial = null, glassesMaterial = null, maskMaterial = null;
  let satchelGeometry = null, strapGeometry = null;
  function ensureFaceExtras(agent) {
    if (agent.faceExtras || !agent.headBone || !SN.roundedBox) return agent.faceExtras;
    const head = agent.headBone;
    const make = (name, geometry, material, x, y, z) => {
      const mesh = new SN.T.Mesh(geometry, material);
      mesh.name = name;
      mesh.position.set(x, y, z);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.visible = false;
      head.add(mesh);
      return mesh;
    };
    // Shared across every person: the uniform glints and the face masks never
    // change colour, so one material each keeps the material count flat.
    if (!badgeMaterial) {
      badgeMaterial = new SN.T.MeshStandardMaterial({ color: 0xd9c06a, roughness: 0.42, metalness: 0.45 });
      glassesMaterial = new SN.T.MeshStandardMaterial({ color: 0x151b21, roughness: 0.32, metalness: 0.4, envMapIntensity: 0.8 });
      maskMaterial = new SN.T.MeshStandardMaterial({ color: 0xe7eae6, roughness: 0.86, metalness: 0 });
      for (const material of [badgeMaterial, glassesMaterial, maskMaterial]) SN.envMats.push({ material, base: material.envMapIntensity || 0.3 });
    }
    agent.faceExtras = {
      badge: make("cap-badge", capBadgeGeometry || (capBadgeGeometry = SN.roundedBox(0.055, 0.06, 0.016, 0.008, 2)), badgeMaterial, 0, 0.176, 0.098),
      glasses: make("glasses", glassesGeometry || (glassesGeometry = SN.roundedBox(0.165, 0.042, 0.035, 0.014, 2)), glassesMaterial, 0, 0.104, 0.118),
      mask: make("face-mask", maskGeometry || (maskGeometry = SN.roundedBox(0.13, 0.085, 0.045, 0.022, 2)), maskMaterial, 0, 0.046, 0.098)
    };
    return agent.faceExtras;
  }

  function ensureSatchel(agent) {
    if (agent.satchel || !SN.roundedBox) return;
    const material = new SN.T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.02, envMapIntensity: 0.2 });
    const bag = new SN.T.Mesh(satchelGeometry || (satchelGeometry = SN.roundedBox(0.26, 0.2, 0.09, 0.026, 3)), material);
    bag.name = "satchel";
    bag.position.set(0.195, 0.95, -0.015);
    bag.rotation.y = -0.12;
    bag.visible = false;
    bag.castShadow = false;
    agent.root.add(bag);
    const strap = new SN.T.Mesh(strapGeometry || (strapGeometry = SN.roundedBox(0.035, 0.64, 0.018, 0.008, 2)), material);
    strap.name = "satchel-strap";
    strap.position.set(0.005, 1.2, 0.104);
    strap.rotation.z = 0.68;
    strap.visible = false;
    strap.castShadow = false;
    agent.root.add(strap);
    agent.satchel = { bag, strap, material };
  }

  function ensureGarmentMeshes(agent) {
    if (agent.garments || !agent.body || !agent.body.skeleton) return;
    const dummy = new SN.T.MeshStandardMaterial({ color: 0xffffff, skinning: true });
    const garments = {};
    for (const part of ["top", "bottom", "shoes"]) {
      const mesh = new SN.T.SkinnedMesh(new SN.T.BufferGeometry(), dummy);
      mesh.name = "garment-" + part;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false;
      mesh.bind(agent.body.skeleton, agent.body.bindMatrix);
      agent.body.add(mesh);
      garments[part] = mesh;
    }
    const far = new SN.T.SkinnedMesh(new SN.T.BufferGeometry(), dummy);
    far.name = "garment-far";
    far.visible = false;
    far.frustumCulled = false;
    far.castShadow = false;
    far.receiveShadow = false;
    far.matrixAutoUpdate = false;
    far.bind(agent.body.skeleton, agent.body.bindMatrix);
    agent.body.add(far);
    agent.garments = garments;
    agent.farGarment = far;
    agent.garmentDetailLow = false;
  }

  function resolveGarmentKeys(outfit) {
    const top = outfit.topStyle === "coat" ? "topCoat" :
      outfit.sleeve === "none" ? "topNone" : outfit.sleeve === "short" ? "topShort" : "topLong";
    const bottom = outfit.skirt ? "skirt" : outfit.shorts ? "shorts" : "pants";
    return { top, bottom, shoes: "shoes" };
  }

  function applyGarments(agent, proto, sex, tone, outfitId, outfit, variant, low) {
    if (!proto || !proto.garmentsReady) { agent.garmentsEnabled = false; return; }
    ensureGarmentMeshes(agent);
    if (!agent.garments) { agent.garmentsEnabled = false; return; }
    const keys = resolveGarmentKeys(outfit);
    agent.garmentsEnabled = true;
    agent.garmentKeys = keys;
    agent.garmentVariant = variant % 2;
    agent.garmentDetailLow = !!low;
    const materials = [
      garmentMaterialFor(sex, outfitId, "top", agent.garmentVariant),
      garmentMaterialFor(sex, outfitId, "bottom", agent.garmentVariant),
      garmentMaterialFor(sex, outfitId, "shoes", agent.garmentVariant)
    ];
    agent.garmentMaterials = materials;
    const names = ["top", "bottom", "shoes"];
    for (let i = 0; i < names.length; i++) {
      const mesh = agent.garments[names[i]];
      mesh.geometry = garmentGeometry(proto, keys[names[i]], low);
      mesh.material = materials[i];
      mesh.visible = !low;
    }
    agent.farGarment.geometry = garmentFarGeometry(proto, keys);
    agent.farGarment.material = materials;
    agent.farGarment.visible = !!low;
    agent.garmentTris = {
      top: proto.garmentTris[low ? "low" : "high"][keys.top],
      bottom: proto.garmentTris[low ? "low" : "high"][keys.bottom],
      shoes: proto.garmentTris[low ? "low" : "high"].shoes,
      far: low ? proto.garmentTris.low[keys.top] + proto.garmentTris.low[keys.bottom] + proto.garmentTris.low.shoes : 0
    };
  }

  function setGarmentLow(agent, low) {
    if (!agent || !agent.garments || !agent.garmentKeys) return;
    low = !!low;
    if (agent.garmentDetailLow === low) return;
    const proto = M.prototypes[agent.sex];
    if (!proto || !proto.garmentsReady) return;
    agent.garmentDetailLow = low;
    const keys = agent.garmentKeys, names = ["top", "bottom", "shoes"];
    for (let i = 0; i < names.length; i++) {
      const mesh = agent.garments[names[i]];
      mesh.geometry = garmentGeometry(proto, keys[names[i]], low);
      mesh.visible = !low;
    }
    agent.farGarment.geometry = garmentFarGeometry(proto, keys);
    agent.farGarment.visible = low;
    agent.garmentTris.far = low ? proto.garmentTris.low[keys.top] + proto.garmentTris.low[keys.bottom] + proto.garmentTris.low.shoes : 0;
  }

  function setAgentShadow(agent, cast) {
    if (!agent) return;
    if (agent.body) agent.body.castShadow = !!cast;
    if (agent.garments) for (const part of Object.keys(agent.garments)) agent.garments[part].castShadow = !!cast;
    if (agent.farGarment) agent.farGarment.castShadow = !!cast;
  }

  function collectFingerCurl(agent) {
    const bones = agent.body && agent.body.skeleton && agent.body.skeleton.bones;
    if (!bones || !bones.length) return;
    agent.root.updateMatrixWorld(true);
    const quaternion = new SN.T.Quaternion();
    for (const bone of bones) {
      const match = /^(index|middle|pinky|ring|thumb)_0([123])_([lr])$/.exec(bone.name || "");
      if (!match) continue;
      if (!bone.children.some(child => child.isBone)) continue;
      const side = match[3] === "l" ? 1 : -1;
      bone.getWorldQuaternion(quaternion);
      quaternion.invert();
      const axis = new SN.T.Vector3(0, 0, -side).applyQuaternion(quaternion).normalize();
      const amount = (match[1] === "thumb" ? 0.09 : 0.18) * (match[2] === "2" ? 1.25 : match[2] === "3" ? 0.85 : 1);
      agent.fingerCurl.push({ bone, axis, angle: amount });
    }
  }

  function relaxFingers(agent) {
    if (!agent || !agent.fingerCurl || !agent.fingerCurl.length) return;
    if (!relaxQuat) relaxQuat = new SN.T.Quaternion();
    for (const finger of agent.fingerCurl) {
      relaxQuat.setFromAxisAngle(finger.axis, finger.angle);
      finger.bone.quaternion.multiply(relaxQuat);
    }
  }

  function dressAgent(agent, sex, target) {
    if (!agent || !agent.body) return;
    const profile = target.profile || SN.playerProfile || {};
    const proto = M.prototypes[sex];
    const outfitId = target.outfitId || outfitForArchetype(target.archetype, profile, target.kind, target.crew, sex);
    ensureOutfit(outfitId);
    const outfit = M.outfits[outfitId] || M.outfits.office;
    const tone = target.tone || toneFor(profile.skin || 0xd3a27c);
    const hairStyle = target.hair || profile.hair || "short";
    const hairId = hairIdFor(hairStyle, sex);
    const hairColor = profile.hairColor || 0x2a211c;
    const shell = !!(proto && proto.garmentsReady);
    const variant = (target.variant === undefined ? agent.id : target.variant) % 2;
    const cap = !!(target.cap || outfit.cap || hairStyle === "cap" || hairStyle === "beanie" || profile.accessory === "hardhat");
    const beanie = hairStyle === "beanie";
    const capColor = target.capColor || outfit.capColor || profile.capColor || 0x26313d;
    const glasses = !!(target.glasses || profile.glasses || outfit.glasses);
    const faceMask = !!(target.mask || profile.mask || outfit.mask);
    const satchel = !!(target.satchel || outfit.satchel);
    const box = !!outfit.box;
    const lookKey = [sex, outfitId, tone, hairId, hairColor, cap, beanie, capColor, glasses, faceMask, satchel, box,
      !!outfit.skirt, !!outfit.backpack, !!target.backpack, variant, shell].join("|");
    if (agent.lookKey === lookKey) {
      agent.outfitId = outfitId;
      return;
    }
    const material = shell ? skinMaterialFor(proto, tone, outfitId) : bodyMaterial(sex, tone, outfitId);
    if (material) agent.body.material = material;
    agent.sex = sex;
    agent.outfitId = outfitId;
    agent.lookKey = lookKey;
    attachHair(agent, hairId, hairColor, cap && !beanie);
    const eyebrows = agent.root.getObjectByName("Eyebrows");
    if (eyebrows && M.hair[hairId]) eyebrows.material = hairMaterial(M.hair[hairId], hairColor);
    const extras = ensureFaceExtras(agent);
    if (extras) {
      // The procedural cap already carries its own brim; only the badge is
      // extra, sitting on the front of the crown instead of a second visor.
      extras.badge.visible = !!(cap && !beanie && outfit.badge && (outfitId === "police" || outfitId === "security" || outfitId === "worker"));
      extras.glasses.visible = glasses && !faceMask;
      extras.mask.visible = faceMask;
    }
    if (cap) attachCap(agent, capColor);
    else if (agent.capMesh) agent.capMesh.visible = false;
    ensureSatchel(agent);
    if (agent.satchel) {
      agent.satchel.bag.visible = satchel && !box;
      agent.satchel.strap.visible = satchel && !box;
      agent.satchel.material.color.copy(colorValue(outfit.bottom));
    }
    if (!shell) {
      ensureSkirt(agent);
      agent.skirt.visible = !!outfit.skirt;
      if (outfit.skirt) agent.skirt.material.color.copy(colorValue(outfit.bottom));
    } else if (agent.skirt) {
      agent.skirt.visible = false;
    }
    ensurePack(agent);
    agent.pack.visible = !!(outfit.backpack || target.backpack || box);
    if (agent.pack.visible) {
      agent.pack.material.color.copy(colorValue(box ? outfit.accent : outfit.top));
      agent.pack.scale.set(box ? 1.2 : 1, box ? 1.24 : 1, box ? 1.34 : 1);
    }
    agent.root.scale.setScalar(target.height || 1);
    applyGarments(agent, proto, sex, tone, outfitId, outfit, variant, !!agent.garmentDetailLow);
    setAgentShadow(agent, agent.body.castShadow);
  }

  function actionFor(agent, name) {
    const clip = M.clips[name];
    if (!clip) return null;
    if (!agent.actions[name]) agent.actions[name] = agent.mixer.clipAction(clip);
    return agent.actions[name];
  }

  const ONE_SHOT = {
    Pistol_Shoot: true, Punch_Jab: true, Punch_Cross: true, Hit_Chest: true, Hit_Head: true,
    Death01: true, Jump_Start: true, Jump_Land: true, Pistol_Reload: true, Sitting_Enter: true, Sitting_Exit: true
  };

  function playClip(agent, name, options) {
    const action = actionFor(agent, name);
    if (!action) return false;
    const opts = options || {};
    const once = opts.once !== undefined ? !!opts.once : !!ONE_SHOT[name];
    if (agent.actionName === name && agent.action === action) {
      if (once && name !== "Death01" && !action.isRunning()) {
        action.reset();
        action.enabled = true;
        action.play();
      }
      if (opts.timeScale !== undefined) action.setEffectiveTimeScale(opts.timeScale);
      return true;
    }
    const previous = agent.action;
    action.reset();
    action.setLoop(once ? SN.T.LoopOnce : SN.T.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.setEffectiveTimeScale(opts.timeScale === undefined ? 1 : opts.timeScale);
    action.setEffectiveWeight(1);
    action.enabled = true;
    action.play();
    if (previous && previous !== action) previous.crossFadeTo(action, opts.fade === undefined ? 0.18 : opts.fade, false);
    agent.action = action;
    agent.actionName = name;
    return true;
  }

  function gaitClip(gait) {
    if (gait >= 1.7) return "Sprint_Loop";
    if (gait >= 0.7) return "Jog_Fwd_Loop";
    return "Walk_Loop";
  }

  function gaitSpeed(gait) {
    if (gait >= 1.7) return 6.8;
    if (gait >= 0.7) return 3.2;
    return 1.5;
  }

  function animateActor(agent, actor, dt) {
    agent.mixer.update(dt);
    relaxFingers(agent);
    const motion = actor.rig && actor.rig.motion ? actor.rig.motion : null;
    let name = "Idle_Loop", timeScale = 1;
    if (actor.down > 0 || actor.health <= 0) name = "Death01";
    else if (actor.bail) name = "Jump_Loop";
    else if (actor.sitting) name = "Sitting_Idle_Loop";
    else if (actor.phone || actor.chat) name = "Idle_Talking_Loop";
    else if (actor.attackTimer > 0) name = actor.armedWeapon >= 0 && !actor.meleeOnly ? "Pistol_Shoot" : "Punch_Jab";
    else if (actor.flinch > 0) name = "Hit_Chest";
    else if (actor.hostile && actor.armedWeapon >= 0 && !actor.meleeOnly) name = "Pistol_Aim_Neutral";
    else if (motion && motion.speed > 0.14) {
      name = gaitClip(motion.gait);
      timeScale = SN.clamp(motion.speed / gaitSpeed(motion.gait), 0.28, 1.85);
    }
    playClip(agent, name, { timeScale, fade: name === "Death01" ? 0.1 : 0.2 });
  }

  function animateStory(agent, npc, dt) {
    agent.mixer.update(dt);
    relaxFingers(agent);
    playClip(agent, "Idle_Loop", { timeScale: 1, fade: 0.25 });
  }

  function animatePlayer(agent, dt) {
    agent.mixer.update(dt);
    relaxFingers(agent);
    let name = "Idle_Loop", timeScale = 1;
    if (SN.player.dead || SN.player.health <= 0) name = "Death01";
    else if (SN.player.hitReact > 0) name = "Hit_Chest";
    else if (SN.player.car) name = "Driving_Loop";
    else if (SN.player.swimming) name = "Swim_Idle_Loop";
    else if (SN.player.bail || SN.player.vault || !SN.player.grounded) name = "Jump_Loop";
    else if (SN.reloadTime > 0 && !SN.holstered) name = "Pistol_Reload";
    else if (SN.attackTime > 0 && (SN.selectedWeapon === 0 || SN.selectedWeapon === 3)) name = "Punch_Jab";
    else if (!SN.holstered && SN.firing && SN.selectedWeapon >= 0) name = "Pistol_Shoot";
    else if (!SN.holstered && SN.aiming) name = "Pistol_Aim_Neutral";
    else if (SN.player.motionSpeed > 0.12) {
      name = gaitClip(SN.player.gait);
      timeScale = SN.clamp(SN.player.motionSpeed / gaitSpeed(SN.player.gait), 0.28, 1.9);
    }
    playClip(agent, name, { timeScale, fade: 0.16 });
  }

  // Each story costume keeps its own garment cut, so pressing K changes the
  // silhouette and fabric as well as the colour.
  const costumeFabric = {
    street: { fabricTop: "tee", fabricBottom: "denim", sleeve: "long", inflate: 0.026, topStyle: "" },
    night: { fabricTop: "leather", fabricBottom: "denim", sleeve: "long", inflate: 0.03, topStyle: "coat" },
    rain: { fabricTop: "knit", fabricBottom: "work", sleeve: "long", inflate: 0.032, topStyle: "coat" },
    ash: { fabricTop: "suit", fabricBottom: "suit", sleeve: "long", inflate: 0.028, topStyle: "" },
    route: { fabricTop: "hivis", fabricBottom: "work", sleeve: "long", inflate: 0.03, topStyle: "", backpack: true },
    dawn: { fabricTop: "check", fabricBottom: "cargo", sleeve: "short", inflate: 0.024, topStyle: "" }
  };
  function playerTarget() {
    const costume = (SN.campaign && SN.campaign.costume) || "street";
    const style = (SN.costumeStyles && SN.costumeStyles[costume]) || (SN.costumeStyles && SN.costumeStyles.street) || {};
    const cut = costumeFabric[costume] || costumeFabric.street;
    const helmet = !!(style.extras && style.extras.indexOf("helmet") >= 0);
    const id = "player-" + costume;
    const outfit = ensureOutfit(id, {
      label: SN.costumeLabel ? SN.costumeLabel(costume) : "城市便装",
      top: style.outer === undefined ? 0x137fba : style.outer,
      bottom: style.pants === undefined ? 0x365d83 : style.pants,
      accent: style.accent === undefined ? 0xffd259 : style.accent,
      collar: style.inner === undefined ? 0xffd259 : style.inner,
      shoe: style.shoe === undefined ? 0x2f3a44 : style.shoe,
      belt: style.shoe === undefined ? 0x23292f : style.shoe,
      sleeve: cut.sleeve,
      cap: helmet,
      capColor: style.outer === undefined ? 0x24313c : style.outer,
      fabricTop: cut.fabricTop,
      fabricBottom: cut.fabricBottom,
      topStyle: cut.topStyle,
      backpack: !!cut.backpack,
      inflate: cut.inflate
    });
    M.playerOutfitId = id;
    M.playerAgent.outfitId = id;
    return {
      profile: SN.playerProfile,
      outfitId: id,
      hair: SN.playerProfile.hair,
      tone: toneFor(SN.playerProfile.skin),
      hairColor: SN.playerProfile.hairColor,
      height: 1,
      cap: outfit.cap,
      capColor: outfit.capColor,
      variant: 0
    };
  }

  function dressPlayer() {
    const agent = M.playerAgent;
    if (!agent) return;
    const target = playerTarget();
    dressAgent(agent, "male", target);
    agent.root.position.set(0, 0, 0);
    agent.root.rotation.set(0, 0, 0);
    agent.root.scale.setScalar(1);
  }

  function hidePlayerParts() {
    if (!M.playerAgent || !SN.playerRig) return;
    for (const part of SN.playerRig.parts) part.mesh.visible = false;
    if (SN.wardrobe && SN.wardrobe.extras) for (const extra of SN.wardrobe.extras) extra.visible = false;
    if (SN.wardrobe && SN.wardrobe.chains) for (const chain of SN.wardrobe.chains) for (const pivot of chain) pivot.visible = false;
    M.playerPartsHidden = true;
  }

  function attachPlayerWeapon() {
    if (!M.playerAgent || !SN.playerRig || !SN.playerRig.weapon || !M.playerAgent.handBone) return;
    const group = SN.playerRig.weapon;
    if (group.parent !== M.playerAgent.handBone) {
      M.playerAgent.handBone.add(group);
      group.position.set(0, 0.085, 0.015);
      group.rotation.set(SN.PI, 0, 0);
    }
  }

  function ensureRuntime() {
    if (M.runtimeReady) return;
    if (!M.ready || !SN.scene || !SN.playerRoot) return;
    try {
      let player = makeAgent("male", SN.playerRoot, true);
      if (!player) return;
      M.playerAgent = player;
      attachPlayerWeapon();
      dressPlayer();
      hidePlayerParts();
      // Seven agents per sex keep ten mixed-gender pedestrians covered without
      // paying for twenty full skeletons.
      for (let i = 0; i < 14; i++) {
        const sex = i % 2 === 0 ? "female" : "male";
        const agent = makeAgent(sex, SN.scene, false);
        if (!agent) continue;
        agent.root.visible = false;
        dressAgent(agent, sex, { profile: SN.makeProfile(i, "civilian", -1), outfitId: i % 2 ? "office" : "hoodie", height: 1 });
        M.agents.push(agent);
      }
      M.runtimeReady = true;
      if (M.playerAgent.actionName !== "Idle_Loop") playClip(M.playerAgent, "Idle_Loop", { fade: 0 });
    }
    catch (error) {
      warnOnce("人物模型初始化失败，继续使用程序化角色。");
      M.runtimeReady = false;
    }
  }

  function targetForActor(actor) {
    const profile = (actor.rig && actor.rig.profile) || SN.makeProfile(actor.index || 0, actor.kind || "civilian", actor.crew);
    const sex = sexForProfile(profile);
    const outfitId = outfitForArchetype(actor.archetype, profile, actor.kind, actor.crew, sex);
    return {
      source: actor,
      actor,
      profile,
      sex,
      outfitId,
      hair: profile.hair,
      tone: toneFor(profile.skin),
      hairColor: profile.hairColor,
      height: profile.height || 1,
      cap: profile.hair === "cap" || profile.hair === "beanie" || profile.accessory === "hardhat",
      capColor: profile.capColor,
      backpack: !!profile.backpack,
      glasses: !!profile.glasses,
      mask: !!profile.mask,
      satchel: profile.accessory === "satchel" || profile.accessory === "briefcase",
      variant: (actor.index || 0) % 2,
      x: actor.x,
      z: actor.z
    };
  }

  function targetForStory(npc, index) {
    const c = npc.contact, profile = npc.rig.profile || SN.makeProfile(100 + index, "civilian", -1);
    const sex = sexForProfile(profile);
    const base = ["office", "nightlife", "worker", "delivery", "vendor", "gangTeal"][index % 6];
    const id = "contact-" + index;
    const baseOutfit = M.outfits[base] || M.outfits.office;
    const useCap = index === 4 || !!baseOutfit.cap || profile.hair === "cap";
    ensureOutfit(id, {
      label: c.name || "街面联系人",
      top: baseOutfit.top,
      bottom: baseOutfit.bottom,
      accent: c.accent || profile.accent || baseOutfit.accent,
      collar: profile.shirt || baseOutfit.collar,
      shoe: baseOutfit.shoe,
      sleeve: baseOutfit.sleeve,
      skirt: baseOutfit.skirt,
      shorts: baseOutfit.shorts,
      cap: useCap,
      capColor: profile.capColor || baseOutfit.capColor,
      backpack: baseOutfit.backpack,
      satchel: baseOutfit.satchel,
      box: baseOutfit.box,
      glasses: baseOutfit.glasses,
      mask: baseOutfit.mask,
      topStyle: baseOutfit.topStyle,
      fabricTop: baseOutfit.fabricTop,
      fabricBottom: baseOutfit.fabricBottom,
      inflate: baseOutfit.inflate
    });
    return {
      source: npc,
      npc,
      profile,
      sex,
      outfitId: id,
      hair: profile.hair,
      tone: toneFor(profile.skin),
      hairColor: profile.hairColor,
      height: profile.height || 1,
      cap: useCap,
      capColor: profile.capColor || baseOutfit.capColor,
      backpack: false,
      glasses: !!profile.glasses,
      mask: !!profile.mask,
      satchel: profile.accessory === "satchel" || profile.accessory === "briefcase",
      variant: index % 2,
      x: c.x,
      z: c.z
    };
  }

  function releaseAgent(agent) {
    if (!agent) return;
    if (agent.source) {
      if (agent.source.rig) agent.source.modelAgent = false;
      else if (agent.source.contact) agent.source.modelAgent = false;
    }
    agent.target = null;
    agent.source = null;
    agent.root.visible = false;
    // A pooled skeleton may be handed to a target with an identical look next
    // frame; clear the cache so the hidden shells are rebuilt and reshown.
    agent.lookKey = "";
    setAgentShadow(agent, false);
    if (agent.garments) for (const part of Object.keys(agent.garments)) agent.garments[part].visible = false;
    if (agent.farGarment) agent.farGarment.visible = false;
  }

  function assignAgent(agent, target, distance) {
    agent.target = target;
    agent.source = target.source;
    if (target.actor) target.actor.modelAgent = true;
    else if (target.npc) target.npc.modelAgent = true;
    dressAgent(agent, target.sex, target);
    agent.root.visible = true;
    agent.root.scale.setScalar(target.height || 1);
    // Start a neutral clip immediately so a newly assigned skeleton never shows
    // its bind pose for the frames before the first distance-based update.
    if (!agent.action) playClip(agent, "Idle_Loop", { fade: 0 });
  }

  function shadowRank() {
    const quality = SN.qualityLevel();
    if (quality < 1) return 0;
    return quality >= 2 ? 3 : 1;
  }

  function refreshAssignments(force) {
    if (!M.runtimeReady) return;
    if (!force && SN.simTime - M.lastAssign < 0.24) return;
    M.lastAssign = SN.simTime;
    const max = SN.qualityLevel() === 0 ? 4 : SN.qualityLevel() === 1 ? 7 : M.maxAgents;
    const targets = [];
    if (SN.actors && SN.actors.length) {
      for (const actor of SN.actors) {
        if (!actor.active || actor.inCar) continue;
        const distance = Math.hypot(actor.x - SN.player.x, actor.z - SN.player.z);
        if (distance > 70) continue;
        targets.push({ target: targetForActor(actor), distance });
      }
    }
    if (SN.storyNpcs && SN.storyNpcs.length) {
      for (let i = 0; i < SN.storyNpcs.length; i++) {
        const npc = SN.storyNpcs[i], c = npc.contact;
        const distance = Math.hypot(c.x - SN.player.x, c.z - SN.player.z);
        if (distance > 70) continue;
        targets.push({ target: targetForStory(npc, i), distance });
      }
    }
    targets.sort((a, b) => a.distance - b.distance);
    const desired = targets.slice(0, max), wanted = new Set(desired.map(item => item.target.source));
    for (const agent of M.agents) {
      if (!agent.source || wanted.has(agent.source)) continue;
      releaseAgent(agent);
    }
    for (const item of desired) {
      const target = item.target;
      let agent = M.agents.find(candidate => candidate.source === target.source);
      if (!agent) {
        agent = M.agents.find(candidate => !candidate.source && candidate.sex === target.sex);
        if (!agent) {
          let farthest = null, farDistance = item.distance;
          for (const candidate of M.agents) {
            if (!candidate.source) continue;
            const d = Math.hypot(candidate.source.x - SN.player.x, candidate.source.z - SN.player.z);
            if (candidate.sex === target.sex && d > farDistance) { farthest = candidate; farDistance = d; }
          }
          if (!farthest) continue;
          releaseAgent(farthest);
          agent = farthest;
        }
        assignAgent(agent, target, item.distance);
      } else {
        agent.target = target;
        agent.source = target.source;
        // A pooled skeleton can be handed a target whose archetype or outfit
        // changed (shift changes, staged scenes). dressAgent early-outs when the
        // resolved look is identical, so this stays cheap.
        dressAgent(agent, target.sex, target);
      }
      agent.target.distance = item.distance;
    }
    const casters = shadowRank();
    const ordered = M.agents.filter(agent => agent.source).sort((a, b) => (a.target.distance || 0) - (b.target.distance || 0));
    for (const agent of M.agents) {
      const cast = casters > 0 && ordered.indexOf(agent) < casters;
      setAgentShadow(agent, cast || (agent.isPlayer && SN.qualityLevel() >= 1));
    }
  }

  function updateAgentTarget(agent, target, dt, full) {
    if (agent.isPlayer) return;
    const source = target.actor || target.npc;
    if (!source) return;
    let x = source.x, z = source.z, yaw = source.yaw || 0, y = 0;
    if (target.npc) {
      const c = target.npc.contact;
      x = c.x; z = c.z;
      const d = Math.hypot(SN.player.x - c.x, SN.player.z - c.z);
      yaw = d < 6 ? Math.atan2(SN.player.x - c.x, SN.player.z - c.z) : c.yaw;
      y = SN.groundUnder(x, z, 0.2);
    }
    else if (source.bail && source.rig) {
      x = source.rig.root.position.x; z = source.rig.root.position.z;
      y = source.rig.root.position.y; yaw = source.rig.root.rotation.y;
    }
    else {
      // The procedural rig already resolves bridges and raised sidewalks with
      // the previous frame's height; reuse it instead of sampling from zero.
      y = source.rig && source.rig.root ? source.rig.root.position.y : SN.groundUnder(x, z, 0.2);
    }
    agent.root.position.set(x, y, z);
    agent.root.rotation.y = yaw;
    if (!full) return;
    if (target.actor) animateActor(agent, target.actor, dt);
    else animateStory(agent, target.npc, dt);
  }

  // Walk and jog clips dip the shoes 2-3 cm below the model origin, which is the
  // road surface, so the player visibly wades through the asphalt. Measure the
  // current shoe sole every frame and lift only the visual root by exactly the
  // penetration; gameplay height (SN.player.y) is untouched.
  let plantTmp = null;
  function plantPlayerFeet(agent, dt) {
    const shoes = agent.garments && agent.garments.shoes;
    const offGround = SN.player.car || SN.player.bail || SN.player.swimming || !SN.player.grounded;
    if (offGround || !shoes || !shoes.isSkinnedMesh || !shoes.geometry || !shoes.geometry.attributes.position) {
      if (agent.footLift) {
        agent.footLift = 0;
        agent.root.position.y = 0;
      }
      return;
    }
    (SN.playerRoot || agent.root).updateMatrixWorld(true);
    if (!plantTmp) plantTmp = new SN.T.Vector3();
    const tmp = plantTmp;
    const count = shoes.geometry.attributes.position.count;
    let lowest = Infinity;
    for (let i = 0; i < count; i++) {
      shoes.boneTransform(i, tmp);
      tmp.applyMatrix4(shoes.matrixWorld);
      if (tmp.y < lowest) lowest = tmp.y;
    }
    if (!Number.isFinite(lowest)) return;
    const current = agent.footLift || 0;
    const needed = SN.player.y - (lowest - current);
    const next = SN.clamp(needed, 0, 0.12);
    agent.footLift = next;
    agent.root.position.y = next;
  }

  function updatePlayer(dt) {
    if (!M.playerAgent) return;
    const style = (SN.campaign && SN.campaign.costume) || "street";
    if (M.playerOutfitId !== "player-" + style) dressPlayer();
    attachPlayerWeapon();
    animatePlayer(M.playerAgent, dt);
    plantPlayerFeet(M.playerAgent, dt);
    if (!M.playerPartsHidden) hidePlayerParts();
  }

  function ensureCarMaterials() {
    if (M.carGlassMat) return;
    M.carGlassMat = new SN.T.MeshStandardMaterial({ color: 0x0b1217, roughness: 0.14, metalness: 0.7, envMapIntensity: 1.1 });
    M.carTrimMat = new SN.T.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.72, metalness: 0.22, envMapIntensity: 0.4 });
    M.carWheelMat = new SN.T.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.88, metalness: 0.05, envMapIntensity: 0.2 });
    M.carHeadMat = new SN.T.MeshStandardMaterial({ color: 0xffe4b7, emissive: 0xffdf9f, emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.15 });
    M.carTailMat = new SN.T.MeshStandardMaterial({ color: 0x6b0f0b, emissive: 0xff2a1d, emissiveIntensity: 0.4, roughness: 0.32, metalness: 0.12 });
    M.carPoliceBlueMat = new SN.T.MeshStandardMaterial({ color: 0x194b9a, emissive: 0x2b6dff, emissiveIntensity: 0.5, roughness: 0.24, metalness: 0.2 });
    M.carPoliceWhiteMat = new SN.T.MeshStandardMaterial({ color: 0xe8eef1, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.24, metalness: 0.1 });
    for (const material of [M.carGlassMat, M.carTrimMat, M.carWheelMat, M.carHeadMat, M.carTailMat, M.carPoliceBlueMat, M.carPoliceWhiteMat])
      SN.envMats.push({ material, base: material.envMapIntensity || 0.3 });
  }

  function carMaterialFor(car, category) {
    if (category === "paint") return car.modelPaint;
    if (category === "glass") return M.carGlassMat;
    if (category === "trim" || category === "wheel") return category === "wheel" ? M.carWheelMat : M.carTrimMat;
    if (category === "head") return M.carHeadMat;
    if (category === "tail") return M.carTailMat;
    if (category === "policeBlue") return M.carPoliceBlueMat;
    if (category === "policeWhite") return M.carPoliceWhiteMat;
    return M.carTrimMat;
  }

  M.updateCars = function updateCars(dt) {
    if (!M.carReady) return;
    const night = SN.clamp(SN.night || 0, 0, 1), time = SN.renderTime || 0;
    if (M.carHeadMat) M.carHeadMat.emissiveIntensity = 0.12 + night * 1.7;
    if (M.carTailMat) M.carTailMat.emissiveIntensity = 0.22 + night * 1.15;
    const flash = night > 0.12 ? (Math.sin(time * 9) > 0 ? 2.4 : 0.18) : 0.22;
    if (M.carPoliceBlueMat) M.carPoliceBlueMat.emissiveIntensity = flash;
    if (M.carPoliceWhiteMat) M.carPoliceWhiteMat.emissiveIntensity = night > 0.12 ? (Math.sin(time * 9) > 0 ? 0.2 : 1.9) : 0.2;
    for (const car of SN.cars) {
      if (!car.active || !car.modelWheels || !car.modelWheels.length) continue;
      if (car.modelPaint) {
        car.modelPaint.color.copy(car.paint.color);
        car.modelPaint.roughness = car.paint.roughness;
      }
      if (!car.root.visible) continue;
      const radius = Math.max(0.12, car.modelWheelRadius || car.wheelRadius || 0.3);
      if (car !== SN.player.car) car.modelSpin = ((car.modelSpin || 0) + (car.speed || 0) * dt / radius) % SN.TAU;
      const spin = car === SN.player.car ? car.spin || 0 : car.modelSpin || 0;
      for (const wheel of car.modelWheels) {
        if (wheel.front) wheel.pivot.rotation[wheel.steerAxis] = -car.steer || 0;
        wheel.spin.rotation.x = spin;
      }
    }
  };

  M.attachCar = function attachCar(car) {
    if (!car || !car.body) return false;
    const key = CAR_MODEL_BY_TYPE[car.type];
    const proto = M.carReady ? M.carPrototypes[key] : null;
    if (!proto) {
      car.modeled = false;
      car.modelKey = "";
      car.modelRoot = null;
      car.modelWheels = [];
      car.modelGlass = [];
      return false;
    }
    ensureCarMaterials();
    const spec = car.spec || SN.vehicleSpecs[car.type] || { width: 1.8, height: 1.4, length: 4.4 };
    let scaleLength = spec.length / proto.length;
    let scaleWidth = SN.clamp(spec.width / proto.width, scaleLength * 0.82, scaleLength * 1.18);
    let scaleHeight = SN.clamp(spec.height / proto.height, scaleLength * 0.85, scaleLength * 1.15);
    if (!Number.isFinite(scaleWidth) || !Number.isFinite(scaleHeight) || !Number.isFinite(scaleLength)) {
      scaleWidth = scaleHeight = scaleLength = 1;
    }
    const group = proto.root.clone(true);
    group.name = "model-" + key;
    // Scale runs before the pickup's -90° X rotation, so its length axis is
    // local Y; all other vehicles already use local Z as length.
    group.scale.set(scaleWidth, proto.pickup ? scaleLength : scaleHeight, proto.pickup ? scaleHeight : scaleLength);
    group.position.set(-proto.center.x * scaleWidth, -proto.minY * scaleHeight, -proto.center.z * scaleLength);
    if (!car.modelPaint) {
      car.modelPaint = new SN.T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.52, metalness: 0.32, envMapIntensity: 0.75 });
      SN.envMats.push({ material: car.modelPaint, base: 0.75 });
    }
    car.modelPaint.color.copy(car.paint.color);
    const glass = [], wheels = [];
    group.traverse(object => {
      if (object.userData && object.userData.carCategory) {
        object.material = carMaterialFor(car, object.userData.carCategory);
        object.castShadow = object.userData.carCategory === "paint" || object.userData.carCategory === "trim";
        object.receiveShadow = false;
        if (object.userData.carCategory === "glass") glass.push(object);
      }
      if (object.userData && object.userData.wheelPivot) {
        const spin = object.children.find(child => child.userData && child.userData.wheelSpin);
        if (spin) wheels.push({
          pivot: object,
          spin,
          front: !!object.userData.front,
          steerAxis: proto.pickup ? "z" : "y"
        });
      }
    });
    if (car.modelRoot && car.modelRoot.parent === car.body) car.body.remove(car.modelRoot);
    car.body.add(group);
    for (const child of car.body.children) {
      if (child === group || car.lights && car.lights.indexOf(child) >= 0) continue;
      child.visible = false;
    }
    for (const wheel of car.wheels || []) wheel.pivot.visible = false;
    car.modelRoot = group;
    car.modelWheels = wheels;
    car.modelGlass = glass;
    car.modelKey = key;
    car.modeled = true;
    car.modelSpin = car.spin || 0;
    car.modelWheelRadius = proto.wheelRadius * (scaleHeight + scaleLength) * 0.5;
    if (car.glassBroken) for (const mesh of glass) mesh.visible = false;
    return true;
  };

  M.spawnPerson = function spawnPerson(spec) {
    if (!M.ready || !M.runtimeReady) return null;
    const options = spec || {};
    const sex = options.sex === "female" || options.female ? "female" : "male";
    const agent = makeAgent(sex, options.parent || SN.scene, false);
    if (!agent) return null;
    const profile = Object.assign({}, SN.makeProfile(options.index || 7, "civilian", -1), {
      men: sex !== "female",
      skin: options.skin || 0xd3a27c,
      hair: options.hair || "short",
      hairColor: options.hairColor || 0x2a211c,
      height: options.height || 1,
      capColor: options.capColor || 0x26313d,
      accessory: options.accessory || null
    });
    const target = {
      profile,
      sex,
      outfitId: options.outfit || (sex === "female" ? "summerDress" : "office"),
      hair: profile.hair,
      tone: options.tone || toneFor(profile.skin),
      hairColor: profile.hairColor,
      height: profile.height,
      cap: !!options.cap,
      capColor: profile.capColor,
      backpack: !!options.backpack,
      toneName: options.tone
    };
    dressAgent(agent, sex, target);
    agent.publicAgent = true;
    agent.root.position.set(options.x || 0, options.y === undefined ? SN.groundUnder(options.x || 0, options.z || 0, 0.2) : options.y, options.z || 0);
    agent.root.rotation.y = options.yaw || 0;
    agent.root.visible = options.visible !== false;
    playClip(agent, options.clip || "Idle_Loop", { fade: 0 });
    agent.update = dt => { agent.mixer.update(dt || 0); relaxFingers(agent); };
    agent.play = name => playClip(agent, name, { fade: 0.15 });
    return agent;
  };

  M.spawnCar = function spawnCar(type) {
    const key = CAR_MODEL_BY_TYPE[type];
    const proto = M.carReady ? M.carPrototypes[key] : null;
    if (!proto) return null;
    ensureCarMaterials();
    const root = proto.root.clone(true);
    const paint = new SN.T.MeshStandardMaterial({ color: colorValue(type === 3 ? 0xff7a16 : type === 9 ? 0xd3e3e7 : 0x9aa4ad), roughness: 0.52, metalness: 0.3, envMapIntensity: 0.7 });
    root.traverse(object => {
      if (object.userData && object.userData.carCategory) {
        if (object.userData.carCategory === "paint") object.material = paint;
        else object.material = carMaterialFor({ modelPaint: paint }, object.userData.carCategory);
      }
    });
    root.userData.modelKey = key;
    return root;
  };

  M.applyPlayerOutfit = function applyPlayerOutfit() {
    M.playerPartsHidden = false;
    if (!M.playerAgent) return;
    dressPlayer();
    hidePlayerParts();
  };

  M.updatePlayer = updatePlayer;
  M.refreshAssignments = refreshAssignments;

  M.update = function update(dt) {
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.12) : 1 / 60;
    if (M.carReady) M.updateCars(step);
    if (!M.ready) return;
    ensureRuntime();
    if (!M.runtimeReady) return;
    refreshAssignments(false);
    updatePlayer(step);
    let visible = 0, agentCount = 0;
    for (const agent of M.agents) {
      if (!agent.source) continue;
      agentCount++;
      const target = agent.target;
      const distance = Math.hypot((target.x || 0) - SN.player.x, (target.z || 0) - SN.player.z);
      if (distance > 70) { releaseAgent(agent); continue; }
      setGarmentLow(agent, !agent.isPlayer && (SN.qualityLevel() === 0 || distance > 34));
      const full = distance <= 35;
      agent.root.visible = true;
      updateAgentTarget(agent, target, 0, false);
      if (full) {
        updateAgentTarget(agent, target, step, true);
        agent.lodClock = 0;
      } else {
        agent.lodClock += step;
        // Mid-distance agents keep their place every frame but advance the mixer
        // at 5 Hz, which is invisible at this range and keeps CPU cost flat.
        if (agent.lodClock >= 0.2) {
          agent.lodClock = 0;
          updateAgentTarget(agent, target, 0.2, true);
        }
      }
      visible++;
    }
    if (M.playerAgent) {
      M.playerAgent.root.visible = SN.playerRoot ? SN.playerRoot.visible : true;
      setAgentShadow(M.playerAgent, SN.qualityLevel() >= 1);
    }
    M.stats.agents = agentCount;
    M.stats.visible = visible;
    M.statsClock += step;
    if (M.statsClock >= 0.25) {
      M.statsClock = 0;
      let cars = 0;
      for (let i = 0; i < SN.cars.length; i++) {
        const car = SN.cars[i];
        if (car.active && car.modelKey) cars++;
      }
      M.stats.cars = cars;
      M.stats.models = M.carPrototypeCount || 0;
    }
  };

  M.beginLoad = function beginLoad() {
    if (M.loading || M.finished) return;
    M.loading = true;
    defineOutfits();
    const protocol = window.location ? window.location.protocol : "https:";
    if (!SN.T || !SN.T.GLTFLoader || !SN.T.SkeletonUtils || protocol === "file:") {
      M.failed = true;
      warnOnce("人物与车辆模型不可用（需要 http(s) 环境与加载器），继续使用程序化外观。");
      finish();
      return;
    }
    M.total = 2 + HAIRS.length + 1 + Object.keys(CAR_FILES).length + 2;
    const done = () => {
      M.done++;
      M.progress = M.total ? M.done / M.total : 1;
      if (M.done >= M.total) finish();
    };
    const fail = () => { M.errors++; done(); };
    const loadGltf = (url, ok) => {
      try {
        new SN.T.GLTFLoader().load(url, data => {
          if (M.finished) return;
          try { ok(data); } catch (error) {
            M.errors++;
            warnOnce("人物或车辆模型处理失败，继续使用程序化外观。");
          }
          done();
        }, undefined, fail);
      } catch (error) { fail(); }
    };
    loadGltf(PEOPLE.male, data => { M.prototypes.male = preparePerson(data, "male"); });
    loadGltf(PEOPLE.female, data => { M.prototypes.female = preparePerson(data, "female"); });
    for (const id of HAIRS) loadGltf(HAIR_FILES[id], data => prepareHair(data, id));
    loadGltf(ANIM_FILE, prepareAnimation);
    for (const key of Object.keys(CAR_FILES)) loadGltf(CAR_FILES[key], data => prepareCar(data, key));
    for (const sex of ["male", "female"]) {
      try {
        new SN.T.TextureLoader().load(LIGHT_MAPS[sex], texture => {
          if (M.finished) return;
          texture.flipY = false;
          texture.encoding = SN.T.sRGBEncoding;
          texture.needsUpdate = true;
          M.skinMaps[sex].light = texture;
          done();
        }, undefined, fail);
      } catch (error) { fail(); }
    }
    setTimeout(() => {
      if (M.finished) return;
      M.timedOut = true;
      warnOnce("模型资源加载超时，继续使用程序化角色与车辆。");
      finish();
    }, 9000);
  };

  function finish() {
    if (M.finished) return;
    M.finished = true;
    M.loading = false;
    M.peopleReady = !!(M.prototypes.male && M.prototypes.female && M.prototypes.male.mask && M.prototypes.female.mask);
    M.animReady = Object.keys(M.clips).length > 0;
    M.carReady = Object.keys(M.carPrototypes).length > 0;
    if (M.prototypes.male && !M.skinMaps.male.light) M.skinMaps.male.light = M.prototypes.male.maps.dark;
    if (M.prototypes.female && !M.skinMaps.female.light) M.skinMaps.female.light = M.prototypes.female.maps.dark;
    M.ready = !!(M.peopleReady && M.animReady);
    if (!M.ready && !M.failed) warnOnce("模型资源未完整载入，继续使用程序化角色与车辆。");
    else if (M.errors && !M.warned) warnOnce("部分模型文件未能载入，已保留可用外观并继续。");
    if (!M.failed) M.failed = !M.ready && !M.carReady;
  }

  SN.registerInit(12.5, function* initializeModels12() {
    M.beginLoad();
    while (!M.finished) {
      const percent = M.total ? Math.round(M.done / M.total * 100) : 0;
      if (SN.$("loadingStatus")) SN.$("loadingStatus").textContent = "载入人物与车辆模型 · " + percent + "%";
      if (SN.$("loadingProgress")) SN.$("loadingProgress").value = SN.clamp(percent, 8, 96);
      yield "载入人物与车辆模型 · " + percent + "%";
    }
    if (SN.$("loadingStatus")) SN.$("loadingStatus").textContent = M.ready ? "人物与车辆模型已就绪" : "使用程序化人物与车辆";
  });
})(window.SN);
