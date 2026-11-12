/* 程序化纹理、PBR 材质与通用几何辅助函数。 */
"use strict";
(function (SN) {
  SN.surfaceRandom = function surfaceRandom() {
    SN.surfaceSeed = (Math.imul(SN.surfaceSeed, 1664525) + 1013904223) >>> 0;
    return SN.surfaceSeed / 4294967296;
  };

  SN.texRange = function texRange(a, b) {
    return a + (b - a) * SN.surfaceRandom();
  };

  SN.hash2 = function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  SN.tileNoise = function tileNoise(x, y, period, s) {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi,
      u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % period) + period) % period,
      y0 = ((yi % period) + period) % period,
      x1 = (x0 + 1) % period,
      y1 = (y0 + 1) % period;
    const a = SN.hash2(x0, y0, s), b = SN.hash2(x1, y0, s), c = SN.hash2(x0, y1, s), d = SN.hash2(x1, y1, s);
    return SN.lerp(SN.lerp(a, b, u), SN.lerp(c, d, u), v);
  };

  SN.tileFbm = function tileFbm(u, v, octaves, s) {
    let total = 0, amp = 0.5, norm = 0, period = 4;
    for (let i = 0; i < octaves; i++) {
      total += amp * SN.tileNoise(u * period, v * period, period, s + i * 131);
      norm += amp;
      amp *= 0.5;
      period *= 2;
    }
    return total / norm;
  };

  SN.makeCanvas = function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  // Tileable grayscale fields for the wet-road layer. Both are mip-mapped and
  // sampled in world space, so the pattern never swims with the camera.
  SN.buildWetMaskTexture = function buildWetMaskTexture() {
    const size = 256, canvas = SN.makeCanvas(size, size), ctx = canvas.getContext("2d"),
      img = ctx.createImageData(size, size), data = img.data;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const broad = SN.tileFbm(u, v, 4, 8123);
        const detail = SN.tileFbm(u + 0.31, v + 0.17, 3, 9127);
        const value = SN.clamp((broad - 0.5) * 2.35 + 0.5 + (detail - 0.5) * 0.18, 0, 1);
        const g = Math.round(value * 255), i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = g;
        data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    const texture = SN.tuneTexture(new SN.T.CanvasTexture(canvas));
    texture.encoding = SN.T.LinearEncoding;
    texture.wrapS = texture.wrapT = SN.T.RepeatWrapping;
    return texture;
  };
  SN.buildRippleTexture = function buildRippleTexture() {
    const size = 128, canvas = SN.makeCanvas(size, size), ctx = canvas.getContext("2d"),
      img = ctx.createImageData(size, size), data = img.data;
    const centers = [[0.18, 0.24, 0.9], [0.64, 0.38, 1.35], [0.37, 0.79, 1.1], [0.84, 0.86, 0.75]];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        let ring = 0;
        for (const c of centers) {
          let dx = u - c[0], dy = v - c[1];
          dx -= Math.round(dx);
          dy -= Math.round(dy);
          const dist = Math.hypot(dx, dy);
          ring += Math.sin(dist * 78 * c[2] - 1.1) * Math.exp(-dist * 5.5);
        }
        const g = Math.round(SN.clamp(128 + ring * 42, 0, 255)), i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = g;
        data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    const texture = SN.tuneTexture(new SN.T.CanvasTexture(canvas));
    texture.encoding = SN.T.LinearEncoding;
    texture.wrapS = texture.wrapT = SN.T.RepeatWrapping;
    return texture;
  };
  // Wetness is baked into the surface shader instead of drawn as coplanar decals.
  // The low roughness drives environment reflections; albedo darkening keeps the
  // puddle readable in daylight. All variation lives in world space.
  SN.applyWetSurface = function applyWetSurface(material, options) {
    const opts = options || {}, strength = opts.strength === undefined ? 1 : opts.strength,
      darken = opts.darken === undefined ? 0.42 : opts.darken,
      previous = material.onBeforeCompile;
    material.onBeforeCompile = shader => {
      if (previous) previous.call(material, shader);
      shader.uniforms.uWet = SN.wetUniforms.wet;
      shader.uniforms.uWetTime = SN.wetUniforms.time;
      shader.uniforms.uPuddleMask = SN.wetUniforms.puddle;
      shader.uniforms.uRippleMap = SN.wetUniforms.ripple;
      shader.uniforms.uWetNight = SN.wetUniforms.night;
      shader.uniforms.uWetStrength = { value: strength };
      shader.uniforms.uWetDarken = { value: darken };
      shader.fragmentShader = "uniform float uWet;\nuniform float uWetTime;\nuniform float uWetStrength;\nuniform float uWetDarken;\nuniform float uWetNight;\nuniform sampler2D uPuddleMask;\nuniform sampler2D uRippleMap;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
        vec2 wetCell = vPbrWorld.xz * 0.058;
        float wetNoise = texture2D(uPuddleMask, wetCell).r;
        float puddleMask = smoothstep(0.50, 0.64, wetNoise) * uWet * uWetStrength;
        diffuseColor.rgb *= 1.0 - puddleMask * uWetDarken;`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        vec2 rippleUv = vPbrWorld.xz * 1.15 + vec2(uWetTime * 0.018, uWetTime * 0.013);
        float rippleTone = texture2D(uRippleMap, rippleUv).g - 0.5;
        float wetMask = clamp(puddleMask, 0.0, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.055 + rippleTone * 0.045, wetMask);
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.62, uWet * 0.55 * uWetStrength);`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.06, 0.095, 0.13) * wetMask * uWetNight * 0.9;`);
    };
    material.needsUpdate = true;
    return material;
  };

  SN.noiseHeightCanvas = function noiseHeightCanvas(size, seed, base, contrast, fine) {
    const c = SN.makeCanvas(size, size), ctx = c.getContext("2d"), img = ctx.createImageData(size, size), d = img.data;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        let n = SN.tileFbm(u, v, 3, seed);
        n = (n - 0.5) * contrast + base + (SN.hash2(x, y, seed + 11) - 0.5) * fine;
        const g = SN.clamp(n, 0, 1) * 255, i = (y * size + x) * 4;
        d[i] = g;
        d[i + 1] = g;
        d[i + 2] = g;
        d[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  SN.colorFromHeight = function colorFromHeight(heightCanvas, tint, contrast, seed) {
    const width = heightCanvas.width,
      height = heightCanvas.height,
      src = heightCanvas.getContext("2d").getImageData(0, 0, width, height).data;
    const c = SN.makeCanvas(width, height),
      ctx = c.getContext("2d"),
      img = ctx.createImageData(width, height),
      d = img.data;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4, h = src[i] / 255, shade = 0.7 + h * contrast + (SN.hash2(x, y, seed) - 0.5) * 0.035;
        d[i] = SN.clamp(tint[0] * shade, 0, 255);
        d[i + 1] = SN.clamp(tint[1] * shade, 0, 255);
        d[i + 2] = SN.clamp(tint[2] * shade, 0, 255);
        d[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  SN.roughFromHeight = function roughFromHeight(heightCanvas, base, spread, seed) {
    const width = heightCanvas.width,
      height = heightCanvas.height,
      src = heightCanvas.getContext("2d").getImageData(0, 0, width, height).data;
    const c = SN.makeCanvas(width, height),
      ctx = c.getContext("2d"),
      img = ctx.createImageData(width, height),
      d = img.data;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4,
          h = src[i] / 255,
          rough = SN.clamp(base + (h - 0.5) * spread + (SN.hash2(x, y, seed) - 0.5) * 0.05, 0, 1);
        const g = rough * 255;
        d[i] = g;
        d[i + 1] = g;
        d[i + 2] = g;
        d[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  SN.normalTextureFromCanvas = function normalTextureFromCanvas(canvas, strength) {
    const width = canvas.width,
      height = canvas.height,
      src = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    const c = SN.makeCanvas(width, height),
      ctx = c.getContext("2d"),
      img = ctx.createImageData(width, height),
      d = img.data;
    const at = (x, y) => src[(((y + height) % height) * width + ((x + width) % width)) * 4] / 255;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
        const len = Math.sqrt(dx * dx + dy * dy + 1), i = (y * width + x) * 4;
        d[i] = (-dx / len * 0.5 + 0.5) * 255;
        d[i + 1] = (dy / len * 0.5 + 0.5) * 255;
        d[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    const tex = SN.tuneTexture(new SN.T.CanvasTexture(c));
    tex.encoding = SN.T.LinearEncoding;
    tex.wrapS = tex.wrapT = SN.T.RepeatWrapping;
    return tex;
  };

  SN.linearTextureFromCanvas = function linearTextureFromCanvas(canvas) {
    const tex = SN.tuneTexture(new SN.T.CanvasTexture(canvas));
    tex.encoding = SN.T.LinearEncoding;
    tex.wrapS = tex.wrapT = SN.T.RepeatWrapping;
    return tex;
  };

  SN.colorTextureFromCanvas = function colorTextureFromCanvas(canvas) {
    const tex = SN.tuneTexture(new SN.T.CanvasTexture(canvas));
    tex.encoding = SN.T.sRGBEncoding;
    tex.wrapS = tex.wrapT = SN.T.RepeatWrapping;
    return tex;
  };

  SN.finishSurface = function finishSurface(key, colorCanvas, heightCanvas, roughCanvas, extra, normalStrength) {
    const result = {
      map: SN.colorTextureFromCanvas(colorCanvas),
      normalMap: SN.normalTextureFromCanvas(heightCanvas, normalStrength || 2.1),
      roughnessMap: SN.linearTextureFromCanvas(roughCanvas)
    };
    if (extra)
      Object.assign(result, extra);
    SN.surfaceCache.set(key, result);
    return result;
  };

  SN.buildConcrete = function buildConcrete(key, seed, tint, options) {
    const size = SN.PBR_TEX_SIZE, opts = options || {};
    const height = SN.noiseHeightCanvas(size, seed, 0.55, 0.17, 0.055), hctx = height.getContext("2d");
    hctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 10; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(size * 0.05, size * 0.24),
        g = hctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(96,91,84," + SN.texRange(0.16, 0.38).toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,255,255,0)");
      hctx.fillStyle = g;
      hctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    hctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < (opts.cracks === undefined ? 7 : opts.cracks); i++) {
      hctx.strokeStyle = "rgba(44,42,38," + SN.texRange(0.3, 0.62).toFixed(3) + ")";
      hctx.lineWidth = SN.texRange(0.7, 1.7);
      let x = SN.texRange(0, size), y = SN.texRange(0, size);
      hctx.beginPath();
      hctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += SN.texRange(-26, 26);
        y += SN.texRange(10, 42);
        hctx.lineTo(x, y);
      }
      hctx.stroke();
    }
    if (opts.joints) {
      hctx.strokeStyle = "rgba(53,51,47,.6)";
      hctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const p = i * size / 4;
        hctx.beginPath();
        hctx.moveTo(p, 0);
        hctx.lineTo(p, size);
        hctx.stroke();
        hctx.beginPath();
        hctx.moveTo(0, p + ((i % 2) * 13));
        hctx.lineTo(size, p + ((i % 2) * 13));
        hctx.stroke();
      }
    }
    const color = SN.colorFromHeight(height, tint, 0.52, seed + 3), cctx = color.getContext("2d");
    cctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 8; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(size * 0.04, size * 0.2),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(112,103,90," + SN.texRange(0.12, 0.3).toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 4200; i++) {
      cctx.fillStyle = "rgba(48,45,41," + SN.texRange(0.03, 0.12).toFixed(3) + ")";
      cctx.fillRect(Math.floor(SN.texRange(0, size)), Math.floor(SN.texRange(0, size)), 1, 1);
    }
    if (opts.streaks) {
      for (let i = 0; i < 16; i++) {
        const x = SN.texRange(0, size), w = SN.texRange(3, 16), g = cctx.createLinearGradient(0, 0, 0, size);
        g.addColorStop(0, "rgba(70,66,58,0)");
        g.addColorStop(0.35, "rgba(70,66,58," + SN.texRange(0.05, 0.16).toFixed(3) + ")");
        g.addColorStop(1, "rgba(70,66,58,0)");
        cctx.fillStyle = g;
        cctx.fillRect(x, 0, w, size);
      }
    }
    const rough = SN.roughFromHeight(height, 0.87, 0.2, seed + 5);
    return SN.finishSurface(key, color, height, rough, null, opts.normalStrength || 2);
  };

  SN.buildAsphalt = function buildAsphalt(key, seed) {
    const size = SN.PBR_TEX_SIZE, height = SN.noiseHeightCanvas(size, seed, 0.4, 0.38, 0.2), hctx = height.getContext("2d");
    for (let i = 0; i < 7000; i++) {
      const g = Math.floor(SN.texRange(70, 215)), s = SN.texRange(1, 2.6);
      hctx.fillStyle = "rgba(" + g + "," + g + "," + g + "," + SN.texRange(0.25, 0.8).toFixed(3) + ")";
      hctx.fillRect(SN.texRange(0, size), SN.texRange(0, size), s, s);
    }
    for (let i = 0; i < 7; i++) {
      const x = SN.texRange(0, size),
        y = SN.texRange(0, size),
        w = SN.texRange(size * 0.12, size * 0.42),
        h = SN.texRange(size * 0.08, size * 0.3);
      hctx.fillStyle = "rgba(38,37,35," + SN.texRange(0.2, 0.42).toFixed(3) + ")";
      hctx.fillRect(x, y, w, h);
      hctx.strokeStyle = "rgba(25,24,23,.35)";
      hctx.lineWidth = 2;
      hctx.strokeRect(x, y, w, h);
    }
    hctx.strokeStyle = "rgba(30,29,27,.55)";
    for (let i = 0; i < 6; i++) {
      hctx.lineWidth = SN.texRange(1, 2.4);
      let x = SN.texRange(0, size), y = SN.texRange(0, size);
      hctx.beginPath();
      hctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += SN.texRange(-34, 34);
        y += SN.texRange(-22, 30);
        hctx.lineTo(x, y);
      }
      hctx.stroke();
    }
    const color = SN.colorFromHeight(height, [86, 84, 80], 0.5, seed + 3), cctx = color.getContext("2d");
    for (let i = 0; i < 6500; i++) {
      const pick = SN.texRange(0, 1), g = pick > 0.55 ? Math.floor(SN.texRange(105, 155)) : Math.floor(SN.texRange(35, 66));
      cctx.fillStyle = "rgba(" + g + "," + (g + 1) + "," + (g + 2) + "," + SN.texRange(0.15, 0.6).toFixed(3) + ")";
      cctx.fillRect(SN.texRange(0, size), SN.texRange(0, size), SN.texRange(1, 2.2), SN.texRange(1, 2.2));
    }
    for (let i = 0; i < 7; i++) {
      const x = SN.texRange(0, size),
        y = SN.texRange(0, size),
        w = SN.texRange(size * 0.12, size * 0.4),
        h = SN.texRange(size * 0.08, size * 0.28);
      cctx.fillStyle = "rgba(44,43,41," + SN.texRange(0.25, 0.5).toFixed(3) + ")";
      cctx.fillRect(x, y, w, h);
    }
    cctx.save();
    cctx.translate(size * 0.5, size * 0.5);
    cctx.rotate(-0.22);
    const tyre = cctx.createLinearGradient(0, -size * 0.2, 0, size * 0.2);
    tyre.addColorStop(0, "rgba(25,25,24,0)");
    tyre.addColorStop(0.5, "rgba(25,25,24,.26)");
    tyre.addColorStop(1, "rgba(25,25,24,0)");
    cctx.fillStyle = tyre;
    cctx.fillRect(-size, -size * 0.2, size * 2, size * 0.4);
    cctx.restore();
    cctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 5; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(size * 0.03, size * 0.12),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(30,30,28,.4)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "source-over";
    const dryRough = SN.roughFromHeight(height, 0.9, 0.14, seed + 5);
    const wetRough = SN.roughFromHeight(height, 0.72, 0.22, seed + 7), wctx = wetRough.getContext("2d");
    for (let i = 0; i < 12; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(size * 0.05, size * 0.19),
        g = wctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(10,10,10,.92)");
      g.addColorStop(0.65, "rgba(22,22,22,.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      wctx.fillStyle = g;
      wctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    return SN.finishSurface(key, color, height, dryRough, { wetRoughnessMap: SN.linearTextureFromCanvas(wetRough) }, 2.4);
  };

  SN.buildBrick = function buildBrick(key, seed) {
    const size = SN.PBR_TEX_SIZE, height = SN.makeCanvas(size, size), hctx = height.getContext("2d");
    hctx.fillStyle = "#6e6a62";
    hctx.fillRect(0, 0, size, size);
    const color = SN.makeCanvas(size, size), cctx = color.getContext("2d");
    cctx.fillStyle = "#7d776d";
    cctx.fillRect(0, 0, size, size);
    const rough = SN.makeCanvas(size, size), rctx = rough.getContext("2d");
    rctx.fillStyle = "#e2e2e2";
    rctx.fillRect(0, 0, size, size);
    const bw = 64, bh = 32, mortar = 3;
    for (let row = 0; row < size / bh; row++)
      for (let col = -1; col <= size / bw; col++) {
        const x = col * bw + (row % 2) * bw * 0.5, y = row * bh, variant = SN.hash2(col, row, seed);
        hctx.fillStyle = "rgb(" + Math.floor(148 + variant * 46) + "," + Math.floor(148 + variant * 44) + "," + Math.floor(146 + variant * 38) + ")";
        hctx.fillRect(x + mortar, y + mortar, bw - mortar * 2, bh - mortar * 2);
        const cr = Math.floor(128 + variant * 42), cg = Math.floor(72 + variant * 30), cb = Math.floor(58 + variant * 24);
        cctx.fillStyle = "rgb(" + cr + "," + cg + "," + cb + ")";
        cctx.fillRect(x + mortar, y + mortar, bw - mortar * 2, bh - mortar * 2);
        cctx.fillStyle = "rgba(30,20,16," + SN.texRange(0.02, 0.12).toFixed(3) + ")";
        cctx.fillRect(x + mortar, y + bh * 0.55, bw - mortar * 2, bh * 0.22);
        rctx.fillStyle = "rgb(" + Math.floor(192 + variant * 34) + "," + Math.floor(192 + variant * 34) + "," + Math.floor(192 + variant * 34) + ")";
        rctx.fillRect(x + mortar, y + mortar, bw - mortar * 2, bh - mortar * 2);
        if (variant > 0.72) {
          cctx.fillStyle = "rgba(55,48,40,.35)";
          cctx.fillRect(x + mortar, y + mortar, bw - mortar * 2, 3);
        }
      }
    cctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 9; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(size * 0.05, size * 0.2),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(58,50,40,.34)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 1400; i++) {
      cctx.fillStyle = "rgba(36,30,25," + SN.texRange(0.05, 0.2).toFixed(3) + ")";
      cctx.fillRect(SN.texRange(0, size), SN.texRange(0, size), 1, 1);
    }
    return SN.finishSurface(key, color, height, rough, null, 2.6);
  };

  SN.buildTileSurface = function buildTileSurface(key, seed, tint) {
    const size = SN.PBR_TEX_SIZE, height = SN.makeCanvas(size, size), hctx = height.getContext("2d");
    const color = SN.makeCanvas(size, size), cctx = color.getContext("2d");
    const rough = SN.makeCanvas(size, size), rctx = rough.getContext("2d");
    hctx.fillStyle = "#5f5c55";
    hctx.fillRect(0, 0, size, size);
    cctx.fillStyle = "#5c5952";
    cctx.fillRect(0, 0, size, size);
    rctx.fillStyle = "#e6e6e6";
    rctx.fillRect(0, 0, size, size);
    const step = 64, grout = 4;
    for (let row = 0; row < size / step; row++)
      for (let col = 0; col < size / step; col++) {
        const x = col * step + grout * 0.5,
          y = row * step + grout * 0.5,
          w = step - grout,
          h = step - grout,
          v = SN.hash2(col, row, seed);
        hctx.fillStyle = "rgb(" + Math.floor(150 + v * 50) + "," + Math.floor(150 + v * 50) + "," + Math.floor(148 + v * 48) + ")";
        hctx.fillRect(x, y, w, h);
        hctx.fillStyle = "rgba(255,255,255,.22)";
        hctx.fillRect(x, y, w, 2);
        hctx.fillRect(x, y, 2, h);
        cctx.fillStyle = "rgb(" + Math.floor(tint[0] * (0.92 + v * 0.16)) + "," + Math.floor(tint[1] * (0.92 + v * 0.16)) + "," + Math.floor(tint[2] * (0.92 + v * 0.16)) + ")";
        cctx.fillRect(x, y, w, h);
        rctx.fillStyle = "rgb(" + Math.floor(186 + v * 30) + "," + Math.floor(186 + v * 30) + "," + Math.floor(186 + v * 30) + ")";
        rctx.fillRect(x, y, w, h);
        if (v > 0.82) {
          cctx.strokeStyle = "rgba(38,35,30,.5)";
          cctx.lineWidth = 1;
          cctx.beginPath();
          cctx.moveTo(x + SN.texRange(4, 20), y + SN.texRange(4, 50));
          cctx.lineTo(x + SN.texRange(26, 52), y + SN.texRange(10, 54));
          cctx.stroke();
        }
      }
    cctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 8; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(size * 0.04, size * 0.17),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(66,60,50,.3)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "source-over";
    return SN.finishSurface(key, color, height, rough, null, 1.8);
  };

  SN.buildStone = function buildStone(key, seed) {
    const size = SN.PBR_TEX_SIZE,
      height = SN.noiseHeightCanvas(size, seed, 0.52, 0.14, 0.05),
      hctx = height.getContext("2d");
    hctx.strokeStyle = "rgba(44,42,38,.32)";
    for (let i = 0; i < 16; i++) {
      hctx.lineWidth = SN.texRange(0.6, 2);
      hctx.beginPath();
      let x = 0, y = SN.texRange(0, size);
      hctx.moveTo(x, y);
      for (let s = 0; s < 7; s++) {
        x += size / 7;
        y += SN.texRange(-12, 12);
        hctx.lineTo(x, y);
      }
      hctx.stroke();
    }
    hctx.fillStyle = "rgba(30,29,26,.4)";
    for (let i = 0; i < 320; i++) {
      hctx.beginPath();
      hctx.arc(SN.texRange(0, size), SN.texRange(0, size), SN.texRange(0.5, 2.4), 0, SN.TAU);
      hctx.fill();
    }
    const color = SN.colorFromHeight(height, [172, 160, 140], 0.42, seed + 3), cctx = color.getContext("2d");
    cctx.strokeStyle = "rgba(214,201,178,.18)";
    for (let i = 0; i < 9; i++) {
      cctx.lineWidth = SN.texRange(0.6, 2);
      cctx.beginPath();
      let x = 0, y = SN.texRange(0, size);
      cctx.moveTo(x, y);
      for (let s = 0; s < 7; s++) {
        x += size / 7;
        y += SN.texRange(-10, 10);
        cctx.lineTo(x, y);
      }
      cctx.stroke();
    }
    cctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 10; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(size * 0.04, size * 0.2),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(92,86,70," + SN.texRange(0.16, 0.34).toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "source-over";
    const rough = SN.roughFromHeight(height, 0.84, 0.2, seed + 5);
    return SN.finishSurface(key, color, height, rough, null, 1.6);
  };

  SN.buildMetalPaint = function buildMetalPaint(key, seed) {
    const size = SN.PBR_TEX_SIZE,
      height = SN.noiseHeightCanvas(size, seed, 0.5, 0.08, 0.04),
      hctx = height.getContext("2d");
    const color = SN.colorFromHeight(height, [152, 151, 146], 0.24, seed + 3), cctx = color.getContext("2d");
    const rough = SN.roughFromHeight(height, 0.52, 0.16, seed + 5), rctx = rough.getContext("2d");
    for (let i = 0; i < 260; i++) {
      const x = SN.texRange(0, size), y = SN.texRange(0, size), len = SN.texRange(4, 44), ang = SN.texRange(-0.35, 0.35);
      hctx.strokeStyle = "rgba(" + (SN.texRange(0, 1) > 0.5 ? "180,180,176" : "72,72,70") + "," + SN.texRange(0.15, 0.5).toFixed(3) + ")";
      hctx.lineWidth = SN.texRange(0.5, 1.2);
      hctx.beginPath();
      hctx.moveTo(x, y);
      hctx.lineTo(x + Math.sin(ang) * len, y + Math.cos(ang) * len);
      hctx.stroke();
      cctx.strokeStyle = "rgba(" + (SN.texRange(0, 1) > 0.55 ? "212,210,204" : "86,86,84") + "," + SN.texRange(0.1, 0.35).toFixed(3) + ")";
      cctx.lineWidth = SN.texRange(0.4, 1);
      cctx.beginPath();
      cctx.moveTo(x, y);
      cctx.lineTo(x + Math.sin(ang) * len, y + Math.cos(ang) * len);
      cctx.stroke();
      rctx.strokeStyle = "rgba(80,80,80,.4)";
      rctx.lineWidth = 0.8;
      rctx.beginPath();
      rctx.moveTo(x, y);
      rctx.lineTo(x + Math.sin(ang) * len, y + Math.cos(ang) * len);
      rctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const cx = SN.texRange(0, size), cy = SN.texRange(0, size), r = SN.texRange(6, 46);
      const g = hctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(70,62,54,.6)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      hctx.fillStyle = g;
      hctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const cg = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      cg.addColorStop(0, "rgba(126,74,46,.75)");
      cg.addColorStop(0.55, "rgba(146,92,58,.4)");
      cg.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = cg;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const rg = rctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, "rgba(228,228,228,.85)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      rctx.fillStyle = rg;
      rctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "multiply";
    const dirt = cctx.createLinearGradient(0, size * 0.55, 0, size);
    dirt.addColorStop(0, "rgba(255,255,255,1)");
    dirt.addColorStop(1, "rgba(120,116,108,1)");
    cctx.fillStyle = dirt;
    cctx.fillRect(0, 0, size, size);
    cctx.globalCompositeOperation = "source-over";
    return SN.finishSurface(key, color, height, rough, null, 1.2);
  };

  SN.buildGlassSurface = function buildGlassSurface(key, seed) {
    const size = SN.PBR_TEX_SIZE,
      height = SN.noiseHeightCanvas(size, seed, 0.5, 0.03, 0.02),
      hctx = height.getContext("2d");
    const color = SN.makeCanvas(size, size), cctx = color.getContext("2d");
    cctx.fillStyle = "#4b5b5e";
    cctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 28; i++) {
      const x = SN.texRange(0, size), w = SN.texRange(2, 18), g = cctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, "rgba(150,168,170,0)");
      g.addColorStop(0.5, "rgba(150,168,170," + SN.texRange(0.04, 0.16).toFixed(3) + ")");
      g.addColorStop(1, "rgba(150,168,170,0)");
      cctx.fillStyle = g;
      cctx.fillRect(x, 0, w, size);
    }
    for (let i = 0; i < 40; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(8, 52),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(198,204,198," + SN.texRange(0.03, 0.12).toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    const rough = SN.makeCanvas(size, size), rctx = rough.getContext("2d");
    rctx.fillStyle = "#242424";
    rctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 34; i++) {
      const x = SN.texRange(0, size),
        y = SN.texRange(0, size),
        r = SN.texRange(10, 70),
        g = rctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(120,120,120,.55)");
      g.addColorStop(1, "rgba(36,36,36,0)");
      rctx.fillStyle = g;
      rctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return SN.finishSurface(key, color, height, rough, null, 1.1);
  };

  SN.buildWood = function buildWood(key, seed) {
    const size = SN.PBR_TEX_SIZE, height = SN.makeCanvas(size, size), hctx = height.getContext("2d");
    const color = SN.makeCanvas(size, size), cctx = color.getContext("2d");
    const rough = SN.makeCanvas(size, size), rctx = rough.getContext("2d");
    const plank = 64;
    for (let i = 0; i < size / plank; i++) {
      const v = SN.hash2(i, 3, seed), base = [92 + v * 26, 62 + v * 20, 44 + v * 14];
      hctx.fillStyle = "rgb(" + Math.floor(150 + v * 40) + "," + Math.floor(150 + v * 40) + "," + Math.floor(150 + v * 40) + ")";
      hctx.fillRect(i * plank, 0, plank, size);
      cctx.fillStyle = "rgb(" + Math.floor(base[0]) + "," + Math.floor(base[1]) + "," + Math.floor(base[2]) + ")";
      cctx.fillRect(i * plank, 0, plank, size);
      rctx.fillStyle = "rgb(" + Math.floor(190 + v * 24) + "," + Math.floor(190 + v * 24) + "," + Math.floor(190 + v * 24) + ")";
      rctx.fillRect(i * plank, 0, plank, size);
      hctx.strokeStyle = "rgba(40,35,30,.65)";
      hctx.lineWidth = 3;
      hctx.beginPath();
      hctx.moveTo(i * plank, 0);
      hctx.lineTo(i * plank, size);
      hctx.stroke();
      for (let g = 0; g < 4; g++) {
        const gx = i * plank + SN.texRange(6, plank - 6);
        hctx.strokeStyle = "rgba(90,90,90,.25)";
        hctx.lineWidth = SN.texRange(0.6, 1.4);
        hctx.beginPath();
        for (let y = 0; y < size; y += 24)
          hctx.lineTo(gx + Math.sin(y * 0.04 + g) * 2, y);
        hctx.stroke();
        cctx.strokeStyle = "rgba(42,28,20,.35)";
        cctx.lineWidth = SN.texRange(0.6, 1.4);
        cctx.beginPath();
        for (let y = 0; y < size; y += 24)
          cctx.lineTo(gx + Math.sin(y * 0.04 + g) * 2, y);
        cctx.stroke();
      }
      if (v > 0.7) {
        const ky = SN.texRange(20, size - 20);
        cctx.fillStyle = "rgba(36,24,17,.6)";
        cctx.beginPath();
        cctx.ellipse(i * plank + plank * 0.5, ky, SN.texRange(2, 4), SN.texRange(5, 9), 0, 0, SN.TAU);
        cctx.fill();
      }
    }
    return SN.finishSurface(key, color, height, rough, null, 1.6);
  };

  SN.buildRoofTile = function buildRoofTile(key, seed) {
    const size = SN.PBR_TEX_SIZE,
      height = SN.noiseHeightCanvas(size, seed, 0.45, 0.12, 0.04),
      hctx = height.getContext("2d");
    const color = SN.colorFromHeight(height, [74, 86, 90], 0.35, seed + 3), cctx = color.getContext("2d");
    const rough = SN.roughFromHeight(height, 0.8, 0.2, seed + 5);
    for (let row = 0; row < 16; row++)
      for (let col = 0; col < 16; col++) {
        const x = col * 32, y = row * 32, v = SN.hash2(col, row, seed), g = Math.floor(155 + v * 55);
        hctx.fillStyle = "rgba(" + g + "," + g + "," + g + ",.34)";
        hctx.beginPath();
        hctx.ellipse(x + 16, y + 16, 15, 13, 0, 0, SN.TAU);
        hctx.fill();
        cctx.fillStyle = "rgba(" + Math.floor(90 + v * 44) + "," + Math.floor(96 + v * 44) + "," + Math.floor(98 + v * 44) + ",.45)";
        cctx.beginPath();
        cctx.ellipse(x + 16, y + 16, 14, 12, 0, 0, SN.TAU);
        cctx.fill();
        cctx.strokeStyle = "rgba(28,32,34,.35)";
        cctx.lineWidth = 1;
        cctx.beginPath();
        cctx.moveTo(x, y + 31);
        cctx.lineTo(x + 32, y + 31);
        cctx.stroke();
      }
    return SN.finishSurface(key, color, height, rough, null, 1.5);
  };

  SN.buildGrass = function buildGrass(key, seed) {
    const size = SN.PBR_TEX_SIZE,
      height = SN.noiseHeightCanvas(size, seed, 0.5, 0.16, 0.12),
      hctx = height.getContext("2d");
    const color = SN.colorFromHeight(height, [84, 102, 70], 0.38, seed + 3), cctx = color.getContext("2d");
    for (let i = 0; i < 9000; i++) {
      const x = SN.texRange(0, size), y = SN.texRange(0, size), v = SN.texRange(0, 1);
      cctx.strokeStyle = v > 0.55 ? "rgba(110,128,82,.5)" : "rgba(48,62,40,.45)";
      cctx.lineWidth = SN.texRange(0.6, 1.4);
      cctx.beginPath();
      cctx.moveTo(x, y);
      cctx.lineTo(x + SN.texRange(-2, 2), y - SN.texRange(2, 7));
      cctx.stroke();
    }
    cctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 10; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(size * 0.05, size * 0.2),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(118,104,66,.32)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "source-over";
    const rough = SN.roughFromHeight(height, 0.94, 0.1, seed + 5);
    return SN.finishSurface(key, color, height, rough, null, 1.4);
  };

  SN.buildPaint = function buildPaint(key, seed) {
    const size = SN.PBR_TEX_SIZE,
      height = SN.noiseHeightCanvas(size, seed, 0.52, 0.06, 0.06),
      hctx = height.getContext("2d");
    hctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 26; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(4, 26),
        g = hctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(48,46,42,.6)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      hctx.fillStyle = g;
      hctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    hctx.globalCompositeOperation = "source-over";
    const color = SN.colorFromHeight(height, [226, 218, 196], 0.18, seed + 3), cctx = color.getContext("2d");
    for (let i = 0; i < 420; i++) {
      const x = SN.texRange(0, size), y = SN.texRange(0, size), w = SN.texRange(2, 28), h = SN.texRange(1, 6);
      cctx.fillStyle = "rgba(64,62,58," + SN.texRange(0.2, 0.55).toFixed(3) + ")";
      cctx.fillRect(x, y, w, h);
    }
    cctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 8; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(size * 0.03, size * 0.14),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(120,112,96,.3)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "source-over";
    const rough = SN.roughFromHeight(height, 0.72, 0.24, seed + 5);
    return SN.finishSurface(key, color, height, rough, null, 1.2);
  };

  SN.buildPuddle = function buildPuddle(key, seed) {
    const size = SN.PBR_TEX_SIZE, color = SN.makeCanvas(size, size), cctx = color.getContext("2d");
    cctx.clearRect(0, 0, size, size);
    for (let i = 0; i < 9; i++) {
      const cx = SN.texRange(size * 0.2, size * 0.8),
        cy = SN.texRange(size * 0.2, size * 0.8),
        r = SN.texRange(size * 0.08, size * 0.24);
      const g = cctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      g.addColorStop(0, "rgba(28,38,44,.78)");
      g.addColorStop(0.62, "rgba(34,46,52,.58)");
      g.addColorStop(0.9, "rgba(46,58,62,.2)");
      g.addColorStop(1, "rgba(46,58,62,0)");
      cctx.fillStyle = g;
      cctx.beginPath();
      cctx.ellipse(cx, cy, r * SN.texRange(0.8, 1.2), r * SN.texRange(0.55, 0.9), SN.texRange(0, SN.TAU), 0, SN.TAU);
      cctx.fill();
    }
    const height = SN.makeCanvas(size, size), hctx = height.getContext("2d");
    hctx.fillStyle = "#808080";
    hctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 220; i++) {
      const x = SN.texRange(0, size),
        y = SN.texRange(0, size),
        r = SN.texRange(4, 18),
        g = hctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(150,150,150,.4)");
      g.addColorStop(1, "rgba(128,128,128,0)");
      hctx.fillStyle = g;
      hctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const rough = SN.makeCanvas(size, size), rctx = rough.getContext("2d");
    rctx.fillStyle = "#e6e6e6";
    rctx.fillRect(0, 0, size, size);
    rctx.fillStyle = "#101010";
    rctx.beginPath();
    rctx.ellipse(size * 0.5, size * 0.5, size * 0.3, size * 0.24, 0, 0, SN.TAU);
    rctx.fill();
    return SN.finishSurface(key, color, height, rough, null, 1.4);
  };

  SN.buildFabric = function buildFabric(key, seed) {
    const size = SN.PBR_TEX_SIZE, height = SN.makeCanvas(size, size), hctx = height.getContext("2d");
    const color = SN.makeCanvas(size, size), cctx = color.getContext("2d");
    hctx.fillStyle = "#7d7d7d";
    hctx.fillRect(0, 0, size, size);
    cctx.fillStyle = "#d6d2ca";
    cctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 4) {
      const l = y % 8 ? 196 : 214;
      hctx.fillStyle = "rgb(" + l + "," + l + "," + l + ")";
      hctx.fillRect(0, y, size, 2);
      cctx.fillStyle = y % 8 ? "rgba(188,184,176,.62)" : "rgba(236,232,224,.7)";
      cctx.fillRect(0, y, size, 2);
    }
    for (let x = 0; x < size; x += 4) {
      hctx.fillStyle = "rgba(214,214,214,.35)";
      hctx.fillRect(x, 0, 1, size);
      cctx.fillStyle = "rgba(170,166,158,.25)";
      cctx.fillRect(x, 0, 1, size);
    }
    for (let i = 0; i < 5000; i++) {
      const g = Math.floor(SN.texRange(60, 150));
      hctx.fillStyle = "rgba(" + g + "," + g + "," + g + "," + SN.texRange(0.06, 0.22).toFixed(3) + ")";
      hctx.fillRect(SN.texRange(0, size), SN.texRange(0, size), SN.texRange(1, 2), SN.texRange(1, 2));
    }
    cctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 14; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(size * 0.03, size * 0.16),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(150,146,138,.22)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "source-over";
    const rough = SN.roughFromHeight(height, 0.9, 0.12, seed);
    return SN.finishSurface(key, color, height, rough, null, 1.3);
  };

  SN.buildSkin = function buildSkin(key, seed) {
    const size = SN.PBR_TEX_SIZE,
      height = SN.noiseHeightCanvas(size, seed, 0.5, 0.04, 0.02),
      hctx = height.getContext("2d");
    const color = SN.colorFromHeight(height, [214, 198, 184], 0.12, seed + 3), cctx = color.getContext("2d");
    cctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 40; i++) {
      const cx = SN.texRange(0, size),
        cy = SN.texRange(0, size),
        r = SN.texRange(8, 46),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(198,146,128," + SN.texRange(0.06, 0.18).toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 9000; i++) {
      cctx.fillStyle = "rgba(120,96,82," + SN.texRange(0.02, 0.07).toFixed(3) + ")";
      cctx.fillRect(SN.texRange(0, size), SN.texRange(0, size), 1, 1);
    }
    const rough = SN.roughFromHeight(height, 0.52, 0.14, seed + 5);
    return SN.finishSurface(key, color, height, rough, null, 0.8);
  };

  SN.buildHair = function buildHair(key, seed) {
    const size = SN.PBR_TEX_SIZE, height = SN.makeCanvas(size, size), hctx = height.getContext("2d");
    const color = SN.makeCanvas(size, size), cctx = color.getContext("2d");
    hctx.fillStyle = "#8c8c8c";
    hctx.fillRect(0, 0, size, size);
    cctx.fillStyle = "#a8a49e";
    cctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2400; i++) {
      const x = SN.texRange(0, size), y = SN.texRange(0, size), len = SN.texRange(10, 60), v = SN.texRange(0, 1);
      hctx.strokeStyle = "rgba(" + Math.floor(90 + v * 120) + "," + Math.floor(90 + v * 120) + "," + Math.floor(90 + v * 120) + ",.4)";
      hctx.lineWidth = SN.texRange(0.5, 1.6);
      hctx.beginPath();
      hctx.moveTo(x, y);
      hctx.lineTo(x + SN.texRange(-4, 4), y + len);
      hctx.stroke();
      cctx.strokeStyle = v > 0.5 ? "rgba(236,232,224,.24)" : "rgba(70,66,60,.3)";
      cctx.lineWidth = SN.texRange(0.5, 1.4);
      cctx.beginPath();
      cctx.moveTo(x, y);
      cctx.lineTo(x + SN.texRange(-4, 4), y + len);
      cctx.stroke();
    }
    const rough = SN.roughFromHeight(height, 0.66, 0.16, seed);
    return SN.finishSurface(key, color, height, rough, null, 1.4);
  };

  SN.buildCarPaint = function buildCarPaint(key, seed) {
    const size = SN.PBR_TEX_SIZE,
      height = SN.noiseHeightCanvas(size, seed, 0.5, 0.02, 0.015),
      hctx = height.getContext("2d");
    const color = SN.makeCanvas(size, size), cctx = color.getContext("2d");
    cctx.fillStyle = "#d9d8d4";
    cctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 280; i++) {
      const x = SN.texRange(0, size), y = SN.texRange(0, size), len = SN.texRange(6, 50), ang = SN.texRange(-0.4, 0.4);
      cctx.strokeStyle = "rgba(120,120,118," + SN.texRange(0.06, 0.2).toFixed(3) + ")";
      cctx.lineWidth = SN.texRange(0.4, 0.9);
      cctx.beginPath();
      cctx.moveTo(x, y);
      cctx.lineTo(x + Math.sin(ang) * len, y + Math.cos(ang) * len);
      cctx.stroke();
      hctx.strokeStyle = "rgba(110,110,110,.3)";
      hctx.lineWidth = 0.7;
      hctx.beginPath();
      hctx.moveTo(x, y);
      hctx.lineTo(x + Math.sin(ang) * len, y + Math.cos(ang) * len);
      hctx.stroke();
    }
    const rough = SN.roughFromHeight(height, 0.42, 0.1, seed + 5);
    return SN.finishSurface(key, color, height, rough, null, 1);
  };

  SN.buildFacadeMaps = function buildFacadeMaps(variant) {
    if (SN.facadeCache.has(variant))
      return SN.facadeCache.get(variant);
    const w = 512, h = 1024, glassTower = variant === 3;
    const height = SN.makeCanvas(w, h), hctx = height.getContext("2d"), himg = hctx.createImageData(w, h), hd = himg.data;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, n = SN.tileFbm(u, v, 3, 700 + variant * 97);
        const g = SN.clamp(0.5 + (n - 0.5) * 0.22 + (SN.hash2(x, y, variant + 31) - 0.5) * 0.035, 0, 1) * 255;
        const i = (y * w + x) * 4;
        hd[i] = g;
        hd[i + 1] = g;
        hd[i + 2] = g;
        hd[i + 3] = 255;
      }
    hctx.putImageData(himg, 0, 0);
    const color = SN.colorFromHeight(height, glassTower ? [86, 149, 180] : [[219, 197, 151], [196, 111, 80], [156, 200, 190]][variant], 0.42, 811 + variant),
      cctx = color.getContext("2d");
    const rough = SN.makeCanvas(w, h), rctx = rough.getContext("2d");
    rctx.fillStyle = glassTower ? "#6a6a6a" : "#dcdcdc";
    rctx.fillRect(0, 0, w, h);
    const emissive = SN.makeCanvas(w, h), ectx = emissive.getContext("2d");
    ectx.fillStyle = "#000";
    ectx.fillRect(0, 0, w, h);
    // Masonry courses and glazed shop-house tiles are baked into the shared atlas.
    if (variant === 1 || variant === 2) {
      const tileH = variant === 1 ? 16 : 48, tileW = variant === 1 ? 48 : 64;
      cctx.strokeStyle = variant === 1 ? "#8d6554" : "#759c98";
      cctx.lineWidth = variant === 1 ? 2 : 3;
      for (let y = 0; y < h; y += tileH) {
        cctx.beginPath(); cctx.moveTo(0, y); cctx.lineTo(w, y); cctx.stroke();
        for (let x = (variant === 1 && y / tileH % 2 ? -tileW / 2 : 0); x < w; x += tileW) {
          cctx.beginPath(); cctx.moveTo(x, y); cctx.lineTo(x, y + tileH); cctx.stroke();
        }
      }
    }
    const cols = glassTower ? 6 : 4, rows = glassTower ? 14 : 8, cw = w / cols, ch = h / rows;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const v = SN.hash2(col, row, 901 + variant);
        const ww = glassTower ? cw * 0.84 : cw * 0.6, wh = glassTower ? ch * 0.76 : ch * 0.55;
        const x = col * cw + (cw - ww) * 0.5, y = row * ch + (ch - wh) * 0.5;
        hctx.fillStyle = "rgba(38,38,38,.85)";
        hctx.fillRect(x, y, ww, wh);
        hctx.fillStyle = "rgba(205,205,205,.7)";
        hctx.fillRect(x - 3, y - 3, ww + 6, 3);
        hctx.fillRect(x - 3, y + wh, ww + 6, 4);
        hctx.fillStyle = "rgba(28,28,28,.6)";
        hctx.fillRect(x, y + wh + 4, ww, 3);
        const glass = cctx.createLinearGradient(x, y, x + ww * 0.35, y + wh);
        glass.addColorStop(0, "rgba(" + (glassTower ? 74 : 54) + "," + (glassTower ? 98 : 72) + "," + (glassTower ? 108 : 82) + ",.95)");
        glass.addColorStop(0.45, "rgba(" + (glassTower ? 46 : 36) + "," + (glassTower ? 64 : 52) + "," + (glassTower ? 72 : 60) + ",.96)");
        glass.addColorStop(1, "rgba(" + (glassTower ? 28 : 26) + "," + (glassTower ? 38 : 34) + "," + (glassTower ? 44 : 38) + ",.98)");
        cctx.fillStyle = glass;
        cctx.fillRect(x, y, ww, wh);
        // Bright sky reflections, mullions and blinds remain readable without near geometry.
        cctx.fillStyle = glassTower ? "#8bc3df" : "#6799b1";
        cctx.fillRect(x + 3, y + 3, ww - 6, wh * 0.24);
        if (v > 0.62) {
          cctx.fillStyle = v > 0.85 ? "#e2c390" : "#b6c9c9";
          cctx.fillRect(x + 3, y + 3, ww - 6, wh * (0.22 + v * 0.23));
          cctx.fillStyle = "#8a9597";
          for (let blind = 8; blind < wh * 0.4; blind += 7) cctx.fillRect(x + 3, y + blind, ww - 6, 1);
        }
        cctx.strokeStyle = glassTower ? "#b5d5df" : "#e5d8bc";
        cctx.lineWidth = 3;
        cctx.strokeRect(x, y, ww, wh);
        cctx.fillStyle = "#c8d4d3";
        cctx.fillRect(x + ww * 0.5 - 1, y, 2, wh);
        cctx.fillRect(x, y + wh * 0.65, ww, 2);
        if (!glassTower && v < 0.22) {
          cctx.fillStyle = "#dedbcf"; cctx.fillRect(x + ww - 24, y + wh + 7, 28, 17);
          cctx.fillStyle = "#687579";
          for (let vent = 0; vent < 4; vent++) cctx.fillRect(x + ww - 20, y + wh + 10 + vent * 3, 20, 1);
        }
        cctx.fillStyle = glassTower ? "rgba(190,206,210,.2)" : "rgba(196,204,204,.13)";
        cctx.beginPath();
        cctx.moveTo(x, y);
        cctx.lineTo(x + ww * 0.42, y);
        cctx.lineTo(x, y + wh * 0.55);
        cctx.closePath();
        cctx.fill();
        rctx.fillStyle = glassTower ? "#2a2a2a" : (v > 0.5 ? "#3c3c3c" : "#505050");
        rctx.fillRect(x, y, ww, wh);
        cctx.fillStyle = "rgba(116,110,98," + (glassTower ? 0.16 : 0.22) + ")";
        cctx.fillRect(x - 4, y - 4, ww + 8, 3);
        cctx.fillStyle = "rgba(52,46,40,.28)";
        cctx.fillRect(x - 4, y + wh + 1, ww + 8, 2);
        if (v > 0.45) {
          const eg = ectx.createLinearGradient(x, y, x, y + wh);
          const warm = SN.hash2(col, row, 331) > 0.45;
          eg.addColorStop(0, warm ? "rgba(255,196,122,.85)" : "rgba(184,214,228,.75)");
          eg.addColorStop(0.7, warm ? "rgba(255,168,92,.5)" : "rgba(142,182,204,.35)");
          eg.addColorStop(1, "rgba(0,0,0,0)");
          ectx.fillStyle = eg;
          ectx.fillRect(x, y, ww, wh);
        }
        if (v > 0.8 && !glassTower) {
          cctx.fillStyle = "rgba(206,196,176,.6)";
          cctx.fillRect(x + 4, y + 6, ww - 8, wh * 0.2);
        }
      }
    const streak = cctx.createLinearGradient(0, h * 0.65, 0, h);
    streak.addColorStop(0, "rgba(255,255,255,0)");
    streak.addColorStop(1, "rgba(52,48,42,.25)");
    cctx.fillStyle = streak;
    cctx.fillRect(0, 0, w, h);
    cctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 10; i++) {
      const cx = SN.texRange(0, w),
        cy = SN.texRange(0, h),
        r = SN.texRange(20, 120),
        g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(92,84,72,.18)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g;
      cctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    cctx.globalCompositeOperation = "source-over";
    const result = SN.finishSurface("facade" + variant, color, height, rough, { emissiveMap: SN.colorTextureFromCanvas(emissive) }, 2.1);
    SN.facadeCache.set(variant, result);
    return result;
  };

  // One 1024-square atlas supplies shop bands, windows, transit maps and posters.
  SN.buildStorefrontAtlas = function buildStorefrontAtlas() {
    SN.storefrontTypes = [
      ["fashion", "로데오 부티크", "#243e58", "#e3b780"], ["restaurant", "순희네 손칼국수", "#a43d2f", "#e7c58b"],
      ["cafe", "청담 다과", "#24625b", "#d6a96b"], ["pharmacy", "약국", "#167f69", "#e4eee7"],
      ["bank", "은행", "#244d84", "#b8cbda"], ["phone", "휴대폰", "#3753a4", "#61d7ed"],
      ["cosmetics", "명동 향수", "#a45177", "#f4cee0"], ["chicken", "소리치는 치킨", "#b83e24", "#ffc14d"],
      ["pc", "별밤 PC방", "#452f87", "#7ce9ed"], ["convenience", "편의점", "#277f53", "#f7ad43"]
    ];
    const canvas = SN.makeCanvas(1024, 1024), g = canvas.getContext("2d");
    SN.storefrontGeos = []; SN.storeSignGeos = [];
    for (let type = 0; type < SN.storefrontTypes.length; type++) {
      const [kind, name, band, accent] = SN.storefrontTypes[type], x = type % 4 * 256, y = Math.floor(type / 4) * 256;
      g.save(); g.translate(x, y);
      const rect = (color, x, y, w, h) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
      rect("#d3c9b3", 0, 0, 256, 256); rect("#183344", 8, 55, 240, 184);
      rect(band, 0, 0, 256, 48); g.fillStyle = "#fff2dd"; g.font = "bold 23px sans-serif";
      g.textAlign = "center"; g.fillText(name, 128, 31, 240);
      const doorX = type % 2 ? 10 : 191, displayX = type % 2 ? 72 : 15;
      rect("#89a8b2", doorX, 55, 55, 184); rect("#203e50", doorX + 4, 60, 47, 173);
      rect("#e0d7ba", doorX + 40, 137, 3, 28); rect(accent, 0, 240, 256, 16);
      if (kind === "fashion") {
        for (let n = 0; n < 2; n++) {
          const u = displayX + 40 + n * 76;
          g.fillStyle = "#edc69a"; g.beginPath(); g.arc(u, 102, 12, 0, SN.TAU); g.fill();
          rect(n ? "#d35d4c" : "#f2dfbb", u - 19, 117, 38, 58);
          rect("#c1b7a4", u - 14, 175, 9, 48); rect("#c1b7a4", u + 5, 175, 9, 48);
          rect("#c2b49a", u - 27, 225, 54, 6);
        }
      } else if (kind === "restaurant" || kind === "chicken") {
        rect("#d5ae72", displayX, 188, 163, 15);
        for (let n = 0; n < 3; n++) {
          const u = displayX + n * 55;
          rect(kind === "chicken" ? "#ffbf4e" : "#e6dec3", u, 71, 49, 91);
          g.fillStyle = "#923b26"; g.beginPath(); g.arc(u + 24, 99, 15, 0, SN.TAU); g.fill();
          g.font = "13px sans-serif"; g.fillStyle = "#3f352c"; g.fillText(kind === "chicken" ? "치킨" : "메뉴", u + 24, 135);
          rect("#7c4d32", u + 12, 207, 25, 23);
        }
      } else if (kind === "cafe") {
        rect("#a76b45", displayX, 177, 163, 48);
        for (let n = 0; n < 3; n++) {
          rect("#eee1c3", displayX + 16 + n * 51, 151, 23, 25);
          rect("#253d3c", displayX + 19 + n * 51, 91, 32, 5);
          rect(accent, displayX + 30 + n * 51, 58, 3, 33);
        }
        rect("#24473e", displayX + 18, 112, 110, 25); g.font = "17px sans-serif"; g.fillStyle = "#eee8cd"; g.fillText("커피 · 차", displayX + 73, 131);
      } else if (kind === "pharmacy") {
        rect("#d8eee4", displayX, 62, 163, 172); rect("#22a36f", displayX + 65, 84, 30, 98); rect("#22a36f", displayX + 31, 118, 98, 30);
        rect("#a2c3b9", displayX + 12, 201, 140, 7);
      } else if (kind === "bank") {
        rect("#91aab9", displayX + 8, 80, 60, 144); rect("#112e48", displayX + 17, 100, 42, 50);
        rect("#6cc8d0", displayX + 23, 109, 30, 29); rect("#263b50", displayX + 21, 174, 36, 7);
        rect("#c7d4d5", displayX + 85, 72, 64, 127); g.fillStyle = "#204979"; g.font = "24px sans-serif"; g.fillText("ATM", displayX + 116, 125);
      } else if (kind === "phone" || kind === "pc") {
        rect("#405568", displayX, 194, 164, 29);
        for (let n = 0; n < 3; n++) {
          const u = displayX + 6 + n * 54;
          rect("#101a33", u, kind === "pc" ? 109 : 83, 44, kind === "pc" ? 60 : 100);
          rect(["#407ddd", "#a954bc", "#3fcaba"][n], u + 5, kind === "pc" ? 115 : 90, 34, kind === "pc" ? 46 : 78);
          rect(accent, u + 17, 176, 10, 18);
        }
      } else if (kind === "cosmetics") {
        rect("#e6bacb", displayX, 66, 162, 165);
        for (let n = 0; n < 4; n++) {
          rect("#fff1df", displayX + n * 40, 183, 32, 46);
          rect(n % 2 ? "#ae6f99" : "#72bcae", displayX + 9 + n * 40, 132, 18, 49);
          rect("#d0ac5c", displayX + 12 + n * 40, 122, 12, 11);
        }
      } else {
        for (let row = 0; row < 3; row++) {
          for (let n = 0; n < 7; n++) rect(["#ebc458", "#cb6356", "#83b8a2"][n % 3], displayX + n * 23, 80 + row * 45, 15, 29);
          rect("#e2d7bc", displayX, 110 + row * 45, 162, 6);
        }
        g.font = "20px sans-serif"; g.fillStyle = "#fff5d8"; g.fillText("24시", displayX + 81, 231);
      }
      // Narrow reflections leave the shop silhouettes visible through the glass.
      g.fillStyle = "rgba(154,220,241,.15)"; g.beginPath(); g.moveTo(displayX, 59); g.lineTo(displayX + 48, 59); g.lineTo(displayX + 140, 235); g.lineTo(displayX + 118, 235); g.fill();
      rect("#c9d4ce", displayX + 164, 51, 4, 187); g.restore();
      for (const sign of [false, true]) {
        const geo = new SN.T.PlaneGeometry(1, 1), uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (x + 2 + uv.getX(k) * 252) / 1024, 1 - (y + 2 + (1 - uv.getY(k)) * (sign ? 44 : 252)) / 1024);
        (sign ? SN.storeSignGeos : SN.storefrontGeos).push(geo);
      }
    }
    const texture = SN.canvasTexture(canvas);
    SN.storefrontMat = SN.mat(0xffffff, { map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.3, roughness: 0.65 });
    SN.neonMats.push(SN.storefrontMat);
  };

  SN.buildCityArtAtlas = function buildCityArtAtlas() {
    SN.buildStorefrontAtlas();
    const canvas = SN.makeCanvas(1024, 1024), g = canvas.getContext("2d");
    SN.artNames = ["순희네 손칼국수", "만복 철물", "대성 인쇄", "옥이 반찬",
      "달빛 노래방", "새벽 포차", "별밤 PC방", "명동 향수",
      "청솔 자산운용", "한결 회계", "한강 투자자문", "테헤란로 캐피탈"];
    SN.artAtlasGeos = [];
    for (let i = 0; i < 32; i++) {
      const x = i % 4 * 256, y = Math.floor(i / 4) * 128;
      g.save(); g.translate(x, y);
      const color = ["#953f32", "#d7b46a", "#247b93", "#e7d9b4", "#c92c7c", "#df6c28", "#3446a1", "#215c66", "#14344f", "#e9e4d6", "#22495e", "#21364c"][i % 12];
      g.fillStyle = i < 12 ? color : "#e8e3d2"; g.fillRect(0, 0, 256, 128);
      g.strokeStyle = "#f9e9be"; g.lineWidth = 4; g.strokeRect(6, 6, 244, 116);
      g.textAlign = "center"; g.textBaseline = "middle";
      if (i < 12) {
        g.fillStyle = [1, 3, 9].includes(i) ? "#283340" : "#fff2d1";
        g.font = "bold 29px sans-serif"; g.fillText(SN.artNames[i], 128, 54, 230);
        g.font = "16px sans-serif"; g.fillText(i < 4 ? "종로 · 오래된 골목" : i < 8 ? "서울 · OPEN 24" : "SEOUL · BUSINESS", 128, 93, 225);
      } else if (i < 16) {
        g.fillStyle = ["#28557b", "#cf7950", "#588b83", "#7e708d"][i - 12]; g.fillRect(0, 0, 256, 128);
        g.fillStyle = "#fff1ce"; g.font = "bold 62px sans-serif"; g.fillText(String(101 + i - 12), 128, 52);
        g.font = "21px sans-serif"; g.fillText("아파트 단지", 128, 100);
      } else if (i === 16 || i === 17) {
        g.fillStyle = "#31515f"; g.fillRect(0, 0, 256, 128);
        for (let row = 0; row < 3; row++) {
          for (let n = 0; n < 12; n++) {
            g.fillStyle = ["#e4ba58", "#e76e58", "#72c6bd", "#ebe7cd"][((n * 3 + row + i) % 4)];
            g.fillRect(8 + n * 20, 25 + row * 25, 12, 18);
          }
          g.fillStyle = "#bdc9b8"; g.fillRect(5, 45 + row * 25, 246, 3);
        }
        g.fillStyle = "rgba(151,221,241,.22)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(154, 0); g.lineTo(0, 100); g.fill();
        g.fillStyle = "#e5d7b4"; g.fillRect(0, 0, 256, 7); g.fillRect(0, 113, 256, 15);
        for (const u of [0, 83, 170, 251]) g.fillRect(u, 0, 5, 128);
        if (i === 17) { g.fillStyle = "#273b44"; g.fillRect(88, 9, 77, 104); g.fillStyle = "#d1e3d2"; g.fillRect(151, 57, 4, 20); }
      } else if (i === 18) {
        g.fillStyle = "#153c55"; g.font = "bold 21px sans-serif"; g.fillText("서울 버스 · 노선도", 128, 20);
        for (let line = 0; line < 3; line++) {
          g.strokeStyle = ["#2580bf", "#36a267", "#d98238"][line]; g.lineWidth = 4;
          g.beginPath(); g.moveTo(20, 48 + line * 27); g.lineTo(236, 48 + line * 27); g.stroke();
          for (let n = 0; n < 6; n++) { g.fillStyle = "#fffaf0"; g.beginPath(); g.arc(25 + n * 40, 48 + line * 27, 5, 0, SN.TAU); g.fill(); }
        }
      } else if (i === 19) {
        g.fillStyle = "#17735d"; g.fillRect(0, 0, 256, 128); g.fillStyle = "#ffffff";
        g.font = "bold 27px sans-serif"; g.fillText("↑ 종로   강남 ↗", 128, 43);
        g.font = "19px sans-serif"; g.fillText("Jongno    Gangnam", 128, 82);
      } else if (i < 24) {
        g.fillStyle = ["#2355ab", "#36a455", "#e67a35", "#39b7d3"][i - 20]; g.fillRect(0, 0, 256, 128);
        g.fillStyle = "#ffffff"; g.font = "bold 48px sans-serif"; g.fillText(String(i - 19) + " 지하철", 128, 48);
        g.font = "19px sans-serif"; g.fillText("SUBWAY  ↓", 128, 94);
      } else if (i >= 26) {
        g.fillStyle = ["#215c79", "#267566", "#d39a36", "#bf6b32", "#2c787c", "#4b6889"][i - 26];
        g.fillRect(0, 0, 256, 128); g.fillStyle = "#fff3d4";
        g.font = "bold 32px sans-serif";
        g.fillText(["주차장", "한강공원", "놀이터", "안전제일", "주유소", "학교 운동장"][i - 26], 128, 51, 230);
        g.font = "22px sans-serif";
        g.fillText(["停车场 · P", "汉江公园 · 自行车道", "儿童游乐场", "施工中 · 注意安全", "加油站 · 24시", "校园运动场"][i - 26], 128, 94, 230);
      } else {
        g.fillStyle = ["#f4bf42", "#df524d", "#77d4cc", "#c6a2d9"][i % 4]; g.fillRect(0, 0, 256, 128);
        g.fillStyle = "#243e4b"; g.font = "bold 33px sans-serif"; g.fillText(i % 2 ? "1 + 1" : "오늘의 메뉴", 128, 42);
        g.font = "22px sans-serif"; g.fillText(i % 2 ? "행사 상품 · 24시" : "김밥 · 떡볶이", 128, 91);
      }
      g.restore();
      const geo = new SN.T.PlaneGeometry(1, 1), uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (x + 2 + uv.getX(k) * 252) / 1024, 1 - (y + 2 + (1 - uv.getY(k)) * 124) / 1024);
      SN.artAtlasGeos.push(geo);
    }
    SN.artAtlasTexture = SN.canvasTexture(canvas); SN.artAtlasTexture.encoding = SN.T.sRGBEncoding;
    SN.artSignMat = SN.mat(0xffffff, { map: SN.artAtlasTexture, emissive: 0xffffff, emissiveMap: SN.artAtlasTexture, emissiveIntensity: 0.2, roughness: 0.65, side: SN.T.DoubleSide });
    SN.artSignMat.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float artRow=floor((1.-vUv.y)*8.);
        float artGlow = artRow < 3.0 ? 1.0 : (artRow < 4.0 ? 0.0 : (artRow < 5.0 ? 0.22 : (artRow < 6.0 ? 1.0 : 0.0)));
        totalEmissiveRadiance*=artGlow;`);
    };
    SN.artPanelMat = SN.artSignMat;
    SN.neonMats.push(SN.artSignMat);
    SN.ledCanvas = SN.makeCanvas(512, 128); SN.ledTexture = SN.canvasTexture(SN.ledCanvas);
    SN.ledTexture.encoding = SN.T.sRGBEncoding; SN.ledTexture.generateMipmaps = false; SN.ledTexture.minFilter = SN.T.LinearFilter;
    SN.ledMat = SN.mat(0xffffff, { map: SN.ledTexture, emissive: 0xffffff, emissiveMap: SN.ledTexture, emissiveIntensity: 0.7, side: SN.T.DoubleSide });
    SN.neonMats.push(SN.ledMat); SN.ledTick = -1;
  };

  SN.updateCityArt = function updateCityArt() {
    const tick = Math.floor(SN.renderTime * 5);
    if (tick !== SN.ledTick && SN.ledCanvas) {
      SN.ledTick = tick;
      const g = SN.ledCanvas.getContext("2d");
      const ad = Math.floor(tick / 50) % 3;
      const titles = ["한걸음배송", "백구물산", "零点代驾 · 영시 대리"];
      const lines = ["让每一条街都准时  ·  한 걸음 먼저", "城市更新 · 街坊生活  ·  서울의 내일", "夜路慢一点 · 平安到家  ·  안전 귀가"];
      g.fillStyle = ["#143d51", "#272542", "#14382f"][ad]; g.fillRect(0, 0, 512, 128);
      g.fillStyle = ["#54ffe2", "#ff6dbb", "#ffe06b"][ad]; g.fillRect(0, 0, 8, 128);
      g.textAlign = "center"; g.font = "bold 42px sans-serif"; g.fillText(titles[ad], 260, 57, 470);
      g.fillStyle = "#fff0ce"; g.font = "23px sans-serif"; g.textAlign = "left";
      const scroll = (tick * 7) % 680;
      for (let i = 0; i < 2; i++) g.fillText(lines[ad], 16 - scroll + i * 680, 104);
      g.fillStyle = "rgba(8,20,42,.2)"; for (let y = 0; y < 128; y += 4) g.fillRect(0, y, 512, 1);
      SN.ledTexture.needsUpdate = true;
    }
    if (SN.banpoFountain) {
      SN.banpoFountain.material.opacity = 0.44 + SN.night * 0.24;
      SN.banpoFountain.material.color.setHSL(0.52 + Math.sin(SN.renderTime * 0.3) * 0.05, 0.65, 0.7);
    }
  };

  SN.getSurface = function getSurface(key) {
    if (SN.surfaceCache.has(key))
      return SN.surfaceCache.get(key);
    if (key === "asphalt")
      return SN.buildAsphalt(key, 120341);
    if (key === "brick")
      return SN.buildBrick(key, 55117);
    if (key === "tile")
      return SN.buildTileSurface(key, 31871, [166, 160, 146]);
    if (key === "stone")
      return SN.buildStone(key, 77129);
    if (key === "metal")
      return SN.buildMetalPaint(key, 44109);
    if (key === "glass")
      return SN.buildGlassSurface(key, 61027);
    if (key === "stucco")
      return SN.buildConcrete(key, 20443, [178, 168, 148], { cracks: 4, joints: false, streaks: true });
    if (key === "wood")
      return SN.buildWood(key, 81233);
    if (key === "roofTile")
      return SN.buildRoofTile(key, 99181);
    if (key === "grass")
      return SN.buildGrass(key, 43003);
    if (key === "paint")
      return SN.buildPaint(key, 18899);
    if (key === "puddle")
      return SN.buildPuddle(key, 72007);
    if (key === "fabric")
      return SN.buildFabric(key, 33331);
    if (key === "skin")
      return SN.buildSkin(key, 64237);
    if (key === "hair")
      return SN.buildHair(key, 19073);
    if (key === "carPaint")
      return SN.buildCarPaint(key, 88001);
    return SN.buildConcrete(key, 55661, [152, 147, 138], { cracks: 7, joints: true, streaks: false });
  };
  // World-space planar UVs: project along each wall tangent, including diagonal streets,
  // so a 4 m wall corner and a 140 m road share the same texel density.

  SN.applyWorldUV = function applyWorldUV(material, scaleX, scaleY, extra) {
    const ax = scaleX === undefined ? 0.28 : scaleX, ay = scaleY === undefined ? ax : scaleY;
    const wallProjection = extra === SN.facadeHook;
    material.customProgramCacheKey = function worldSurfaceKey() {
      return (wallProjection ? "wall-tangent|" : "surface|") + (extra ? extra.toString() : "") + this.onBeforeCompile.toString();
    };
    material.onBeforeCompile = shader => {
      shader.uniforms.uPbrScale = { value: new SN.T.Vector2(ax, ay) };
      shader.vertexShader = "uniform vec2 uPbrScale;\nvarying vec3 vPbrWorld;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `#include <uv_vertex>
 vec4 pbrPos=vec4(position,1.0);vec3 pbrNor=normal;
 #ifdef USE_INSTANCING
  pbrPos=instanceMatrix*pbrPos;pbrNor=mat3(instanceMatrix)*pbrNor;
 #endif
 pbrPos=modelMatrix*pbrPos;vPbrWorld=pbrPos.xyz;
 pbrNor=normalize(mat3(modelMatrix)*pbrNor);
 vec2 pbrTangent=normalize(vec2(pbrNor.z,-pbrNor.x)+vec2(.00001));
 vUv=(abs(pbrNor.y)>.55?pbrPos.xz:vec2(${wallProjection ? "dot(pbrPos.xz,pbrTangent)" : "pbrPos.x+pbrPos.z"},pbrPos.y))*uPbrScale;`);
      if (extra)
        extra(shader);
    };
  };
  // Object-space variant for moving meshes: the same planar projection, but the
  // texture travels with the vehicle instead of swimming through world space.

  SN.applyLocalUV = function applyLocalUV(material, scaleX, scaleY) {
    const ax = scaleX === undefined ? 0.28 : scaleX, ay = scaleY === undefined ? ax : scaleY;
    material.onBeforeCompile = shader => {
      shader.uniforms.uPbrScale = { value: new SN.T.Vector2(ax, ay) };
      shader.vertexShader = "uniform vec2 uPbrScale;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `#include <uv_vertex>
 vec3 pbrNor=normal;
 #ifdef USE_INSTANCING
  pbrNor=mat3(instanceMatrix)*pbrNor;
 #endif
 pbrNor=normalize(pbrNor);
 vUv=(abs(pbrNor.y)>.55?position.xz:vec2(position.x+position.z,position.y))*uPbrScale;`);
    };
  };

  SN.pbrMat = function pbrMat(key, color, params) {
    const p = params || {}, surface = SN.getSurface(key);
    const opts = {
      map: surface.map,
      normalMap: surface.normalMap,
      roughnessMap: surface.roughnessMap,
      roughness: 1,
      metalness: 0
    };
    for (const k in p)
      if (k !== "uvScale" && k !== "uvScaleY" && k !== "normalStrength" && k !== "shaderHook")
        opts[k] = p[k];
    const m = SN.mat(SN.srgb(color), opts);
    const ns = p.normalStrength === undefined ? 0.55 : p.normalStrength;
    m.normalScale.set(ns, ns);
    const sx = p.uvScale === undefined ? 0.3 : p.uvScale, sy = p.uvScaleY === undefined ? sx : p.uvScaleY;
    SN.applyWorldUV(m, sx, sy, p.shaderHook);
    return m;
  };

  SN.record = function record(list, x, y, z, sx, sy, sz, yaw = 0, color = null) {
    list.push({ x, y, z, sx, sy, sz, yaw, color });
  };

  // Decorative overhangs do not block pedestrians, but must stop the camera boom.
  SN.registerCameraPart = function registerCameraPart(p, geo = SN.box) {
    if (geo !== SN.box || p.y < 2 || !p.cameraOccluder && (p.sy > 1.2 || p.sx < 1.5 || p.sz < 0.5)) return;
    if (![p.x, p.y, p.z, p.sx, p.sy, p.sz].every(Number.isFinite)) return;
    const pitch = p.pitch || p.rx || 0, yaw = p.yaw || p.ry || 0;
    const hy = (Math.abs(Math.cos(pitch)) * p.sy + Math.abs(Math.sin(pitch)) * p.sz) / 2;
    const depth = Math.abs(Math.cos(pitch)) * p.sz + Math.abs(Math.sin(pitch)) * p.sy;
    const hx = (Math.abs(Math.cos(yaw)) * p.sx + Math.abs(Math.sin(yaw)) * depth) / 2;
    const hz = (Math.abs(Math.sin(yaw)) * p.sx + Math.abs(Math.cos(yaw)) * depth) / 2;
    const b = { minX: p.x - hx, maxX: p.x + hx, minY: p.y - hy, maxY: p.y + hy, minZ: p.z - hz, maxZ: p.z + hz, stamp: 0 };
    for (let iz = Math.floor(b.minZ / 48); iz <= Math.floor(b.maxZ / 48); iz++)
      for (let ix = Math.floor(b.minX / 48); ix <= Math.floor(b.maxX / 48); ix++) {
        const key = ix + "," + iz;
        if (!SN.cameraPropBins.has(key)) SN.cameraPropBins.set(key, []);
        SN.cameraPropBins.get(key).push(b);
      }
    return b;
  };

  SN.releaseCameraParts = function releaseCameraParts(boxes) {
    for (const b of boxes || [])
      for (let iz = Math.floor(b.minZ / 48); iz <= Math.floor(b.maxZ / 48); iz++)
        for (let ix = Math.floor(b.minX / 48); ix <= Math.floor(b.maxX / 48); ix++) {
          const key = ix + "," + iz, bin = SN.cameraPropBins.get(key);
          if (!bin) continue;
          const index = bin.indexOf(b);
          if (index >= 0) bin.splice(index, 1);
          if (!bin.length) SN.cameraPropBins.delete(key);
        }
  };

  SN.registerTile = function registerTile(geo, material, entries, shadows, tileSize, key, range, minQ = 0) {
    // Bound the transformed source geometry, not an entire grid cell plus a full
    // part diagonal. Tall or sparse batches otherwise intersect unrelated views.
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const bounds = new Float32Array(entries.length * 4);
    for (let i = 0; i < entries.length; i++) {
      const p = entries[i];
      const source = p.g || geo;
      if (!source.boundingBox) source.computeBoundingBox();
      const b = source.boundingBox;
      const x = (b.min.x + b.max.x) * p.sx / 2, y = (b.min.y + b.max.y) * p.sy / 2, z = (b.min.z + b.max.z) * p.sz / 2;
      const hx = (b.max.x - b.min.x) * Math.abs(p.sx) / 2, hy = (b.max.y - b.min.y) * Math.abs(p.sy) / 2, hz = (b.max.z - b.min.z) * Math.abs(p.sz) / 2;
      const yaw = p.yaw || p.ry || 0, pitch = p.pitch || p.rx || 0, roll = p.rz || 0;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      const xx = cy * cr + sy * sp * sr, xy = -cy * sr + sy * sp * cr, xz = sy * cp;
      const yx = cp * sr, yy = cp * cr, yz = -sp;
      const zx = -sy * cr + cy * sp * sr, zy = sy * sr + cy * sp * cr, zz = cy * cp;
      const cx = p.x + xx * x + xy * y + xz * z, ex = Math.abs(xx) * hx + Math.abs(xy) * hy + Math.abs(xz) * hz;
      const cy0 = p.y + yx * x + yy * y + yz * z, ey = Math.abs(yx) * hx + Math.abs(yy) * hy + Math.abs(yz) * hz;
      const cz = p.z + zx * x + zy * y + zz * z, ez = Math.abs(zx) * hx + Math.abs(zy) * hy + Math.abs(zz) * hz;
      bounds[i * 4] = cx; bounds[i * 4 + 1] = cy0; bounds[i * 4 + 2] = cz;
      bounds[i * 4 + 3] = Math.hypot(ex, ey, ez) + 0.001;
      minX = Math.min(minX, cx - ex); maxX = Math.max(maxX, cx + ex);
      minY = Math.min(minY, cy0 - ey); maxY = Math.max(maxY, cy0 + ey);
      minZ = Math.min(minZ, cz - ez); maxZ = Math.max(maxZ, cz + ez);
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    SN.cityTiles.push({
      sphere: new SN.T.Sphere(new SN.T.Vector3(cx, cy, cz), Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2), distance: 0,
      geo,
      material,
      entries,
      bounds,
      shadows,
      cx,
      cz,
      half: Math.hypot(maxX - minX, maxZ - minZ) / 2,
      range,
      minQ,
      mesh: null,
      lastNear: 0
    });
  };

  SN.buildInstances = function buildInstances(geo, material, list, shadows = false) {
    const tiles = new Map(), size = 320;
    for (const p of list) {
      const key = Math.floor(p.x / size) + "," + Math.floor(p.z / size);
      if (!tiles.has(key))
        tiles.set(key, []);
      tiles.get(key).push(p);
    }
    for (const [key, entries] of tiles)
      SN.registerTile(geo, material, entries, shadows, size, key, geo === SN.leafGeo ? 950 : 1650);
  };

  SN.activateCityTile = function activateCityTile(tile) {
    if (tile.merged) {
      const geometry = SN.mergeCityGeometry(tile), mesh = new SN.T.Mesh(geometry, tile.material);
      mesh.position.set(tile.cx, 0, tile.cz);
      mesh.castShadow = tile.shadows;
      mesh.receiveShadow = true;
      SN.scene.add(mesh);
      tile.mesh = mesh;
      return;
    }
    const g = tile.geo.clone(),
      mesh = new SN.T.InstancedMesh(g, tile.material, tile.entries.length), tint = new SN.T.Color();
    // The shared constructor supplies white instance colours for untinted parts.
    for (let i = 0; i < tile.entries.length; i++) {
      const p = tile.entries[i];
      SN.dummy.position.set(p.x, p.y, p.z);
      SN.dummy.rotation.set(p.pitch || p.rx || 0, p.yaw || p.ry || 0, p.rz || 0, "YXZ");
      SN.dummy.scale.set(p.sx, p.sy, p.sz);
      SN.dummy.updateMatrix();
      mesh.setMatrixAt(i, SN.dummy.matrix);
      if (p.color !== null && p.color !== undefined)
        mesh.setColorAt(i, tint.set(p.color).convertSRGBToLinear());
    }
    g.boundingSphere = new SN.T.Sphere(tile.sphere.center.clone(), tile.sphere.radius);
    mesh.frustumCulled = true;
    mesh.castShadow = tile.shadows;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    // This tile retains CPU transforms for streaming. Visible instances from all
    // tiles of the same geometry/material share the submission buffers below.
    tile.mesh = mesh;
  };

  // Preserve pending ranges when several simulation updates precede one draw.
  SN.markBufferRange = function markBufferRange(attribute, start, end) {
    const range = attribute.updateRange;
    if (range.count > 0) {
      end = Math.max(end, range.offset + range.count);
      start = Math.min(start, range.offset);
    }
    range.offset = start; range.count = end - start;
    attribute.needsUpdate = true;
  };

  // r128 invokes object draw callbacks in the colour pass, not the shadow pass.
  // Emptying this private geometry's draw range avoids any colour submission.
  SN.skipCityColor = function skipCityColor() {
    this.userData.drawStart = this.geometry.drawRange.start;
    this.userData.drawCount = this.geometry.drawRange.count;
    this.geometry.setDrawRange(0, 0);
  };
  SN.restoreCityRange = function restoreCityRange() {
    this.geometry.setDrawRange(this.userData.drawStart, this.userData.drawCount);
  };

  SN.packCityInstances = function packCityInstances(px, pz, level) {
    const groups = SN.cityInstanceGroups, sphere = SN.cityInstanceSphere, capacity = 2048;
    const state = SN.cityPacking, view = SN.tileProjection.elements;
    let changed = !view || state.tiles.length !== SN.cityTiles.length;
    for (let i = 0; i < 19; i++) {
      const value = i < 16 ? view && view[i] : i === 16 ? px : i === 17 ? pz : level;
      if (state.view[i] !== value) { changed = true; state.view[i] = value; }
    }
    for (let i = 0; i < SN.cityTiles.length; i++) {
      const tile = SN.cityTiles[i], mesh = tile.mesh;
      const flags = mesh ? (mesh.visible ? 1 : 0) + (mesh.castShadow ? 2 : 0) : 0;
      if (state.tiles[i] !== tile || state.meshes[i] !== mesh || state.flags[i] !== flags) changed = true;
      state.tiles[i] = tile; state.meshes[i] = mesh; state.flags[i] = flags;
    }
    state.tiles.length = state.meshes.length = state.flags.length = SN.cityTiles.length;
    if (changed) {
      for (const materials of groups.values()) for (const group of materials.values())
        for (const pool of group.pools) { pool.count = 0; for (const mesh of pool.meshes) mesh.count = 0; }
      for (const tile of SN.cityTiles) {
        if (tile.merged || !tile.mesh || !tile.mesh.visible) continue;
        let materials = groups.get(tile.geo);
        if (!materials) { materials = new Map(); groups.set(tile.geo, materials); }
        let group = materials.get(tile.material);
        if (!group) { group = { pools: [{ count: 0, meshes: [] }, { count: 0, meshes: [] }] }; materials.set(tile.material, group); }
        const matrices = tile.mesh.instanceMatrix.array, colors = tile.mesh.instanceColor.array;
        for (let i = 0; i < tile.entries.length; i++) {
          const b = i * 4;
          sphere.center.set(tile.bounds[b], tile.bounds[b + 1], tile.bounds[b + 2]); sphere.radius = tile.bounds[b + 3];
          const shadow = tile.mesh.castShadow && Math.hypot(sphere.center.x - px, sphere.center.z - pz) - sphere.radius < (level === 1 ? 100 : 150);
          const inView = SN.tileFrustum.intersectsSphere(sphere);
          for (let pass = 0; pass < 2; pass++) {
            if (pass === 0 ? !inView : !shadow) continue;
            const pool = group.pools[pass], slot = pool.count++;
            const page = Math.floor(slot / capacity), index = slot % capacity;
            let mesh = pool.meshes[page];
            if (!mesh) {
              mesh = new SN.T.InstancedMesh(tile.geo.clone(), tile.material, capacity);
              mesh.instanceMatrix.setUsage(SN.T.DynamicDrawUsage); mesh.instanceColor.setUsage(SN.T.DynamicDrawUsage);
              mesh.frustumCulled = false; mesh.receiveShadow = pass === 0; mesh.castShadow = pass === 1;
              Object.assign(mesh.userData, { cityBatch: true, sources: [], indices: new Uint16Array(capacity), dirtyStart: Infinity, dirtyEnd: 0 });
              if (pass === 1) { mesh.onBeforeRender = SN.skipCityColor; mesh.onAfterRender = SN.restoreCityRange; }
              pool.meshes.push(mesh); SN.scene.add(mesh);
            }
            const data = mesh.userData;
            // Stable source slots do not need to be recopied when another tile changes.
            if (data.sources[index] !== tile.mesh || data.indices[index] !== i) {
              for (let n = 0; n < 16; n++) mesh.instanceMatrix.array[index * 16 + n] = matrices[i * 16 + n];
              for (let n = 0; n < 3; n++) mesh.instanceColor.array[index * 3 + n] = colors[i * 3 + n];
              data.sources[index] = tile.mesh; data.indices[index] = i;
              data.dirtyStart = Math.min(data.dirtyStart, index); data.dirtyEnd = index + 1;
            }
            mesh.count = index + 1;
          }
        }
      }
    }
    for (const materials of groups.values()) for (const group of materials.values())
      for (const pool of group.pools) for (let i = pool.meshes.length - 1; i >= 0; i--) {
        const mesh = pool.meshes[i], data = mesh.userData;
        mesh.visible = mesh.count > 0;
        if (!mesh.count) {
          // Drop references to retired tile transforms even before releasing the page.
          data.sources.length = 0;
          if (SN.renderTime - data.lastNear > 3) {
            SN.scene.remove(mesh); mesh.geometry.dispose(); mesh.dispose(); pool.meshes.splice(i, 1);
          }
          continue;
        }
        data.lastNear = SN.renderTime; data.sources.length = mesh.count;
        if (data.dirtyEnd > data.dirtyStart) {
          SN.markBufferRange(mesh.instanceMatrix, data.dirtyStart * 16, data.dirtyEnd * 16);
          SN.markBufferRange(mesh.instanceColor, data.dirtyStart * 3, data.dirtyEnd * 3);
          data.dirtyStart = Infinity; data.dirtyEnd = 0;
        }
      }
  };

  SN.tileDistanceOrder = function tileDistanceOrder(a, b) { return a.distance - b.distance; };

  SN.streamCity = function streamCity(force = false) {
    const begin = performance.now();
    if (!force && SN.renderTime < SN.streamClock) return;
    SN.streamClock = SN.renderTime + 0.08;
    for (const registry of [SN.mergedCityMaterials, SN.staticInstanceMaterials]) for (const [source, target] of registry) {
      target.emissiveIntensity = source.emissiveIntensity;
      target.envMapIntensity = source.envMapIntensity;
      target.roughnessMap = source.roughnessMap;
      target.color.copy(source.color);
    }
    const px = SN.started ? SN.player.x : SN.camera.position.x,
      pz = SN.started ? SN.player.z : SN.camera.position.z, level = SN.qualityLevel(), pending = SN.tileQueue;
    pending.length = 0;
    SN.camera.updateMatrixWorld();
    SN.tileProjection.multiplyMatrices(SN.camera.projectionMatrix, SN.camera.matrixWorldInverse);
    SN.tileFrustum.setFromProjectionMatrix(SN.tileProjection);
    SN.streamUrbanDetails(px, pz, false);
    for (const tile of SN.cityTiles) {
      const distance = Math.max(0, Math.hypot(px - tile.cx, pz - tile.cz) - (tile.detail ? 0 : tile.half));
      tile.distance = distance;
      const lodRange = tile.landmark ? tile.range : tile.detail ? (level === 0 ? 190 : level === 1 ? 280 : 380) : tile.frontage ? (level === 0 ? 460 : level === 1 ? 720 : 1100) : tile.range * (level === 0 ? 0.6 : level === 1 ? 0.75 : 1);
      const near = level >= tile.minQ && distance < Math.min(tile.range, lodRange);
      const inView = (tile.shadows && distance < 110 || SN.tileFrustum.intersectsSphere(tile.sphere)) &&
        !(tile.material.transparent && tile.material.opacity === 0);
      if (near) {
        tile.lastNear = SN.renderTime;
        if (!tile.mesh && inView) pending.push(tile);
        else if (tile.mesh) {
          tile.mesh.visible = inView;
          tile.mesh.castShadow = tile.shadows && level > 0 && distance < (level === 1 ? 100 : 150);
        }
      } else if (tile.mesh) {
        tile.mesh.visible = false;
        if (distance > lodRange + 240 && SN.renderTime - tile.lastNear > 3) {
          SN.scene.remove(tile.mesh); tile.mesh.geometry.dispose();
          if (tile.mesh.dispose) tile.mesh.dispose();
          tile.mesh = null;
        }
      }
    }
    pending.sort(SN.tileDistanceOrder);
    let built = 0;
    // A teleport, showcase or initial load uses the same bounded streaming path.
    for (const tile of pending) {
      if (built && performance.now() - begin >= 3) break;
      SN.activateCityTile(tile);
      tile.mesh.castShadow = tile.shadows && level > 0 && tile.distance < (level === 1 ? 100 : 150);
      if (++built >= 3) break;
    }
    SN.perf.pendingTiles = pending.length - built;
    SN.packCityInstances(px, pz, level);
    SN.streamTerrain(px, pz, level);
    SN.perf.streamMs = performance.now() - begin;
    for (const group of SN.cityLandmarks)
      group.visible = Math.hypot(group.position.x - px, group.position.z - pz) < (group.userData.range || 2000);
  };
  // Static architecture is merged by material and spatial tile. UVs, normals and
  // vertex tints survive the merge, including the existing world-space PBR hooks.

  SN.mergeCityGeometry = function mergeCityGeometry(tile) {
    const pieces = [];
    let count = 0;
    for (const p of tile.entries) {
      const source = p.g || tile.geo, g = source.index ? source.toNonIndexed() : source.clone();
      SN.dummy.position.set(p.x - tile.cx, p.y, p.z - tile.cz);
      SN.dummy.rotation.set(p.pitch || p.rx || 0, p.yaw || p.ry || 0, p.rz || 0, "YXZ");
      SN.dummy.scale.set(p.sx, p.sy, p.sz);
      SN.dummy.updateMatrix();
      g.applyMatrix4(SN.dummy.matrix);
      pieces.push({ g, color: p.color });
      count += g.attributes.position.count;
    }
    const positions = new Float32Array(count * 3),
      normals = new Float32Array(count * 3),
      uvs = new Float32Array(count * 2),
      colors = new Float32Array(count * 3),
      tint = new SN.T.Color();
    let offset = 0;
    for (const part of pieces) {
      const a = part.g.attributes, n = a.position.count;
      positions.set(a.position.array, offset * 3);
      normals.set(a.normal.array, offset * 3);
      if (a.uv)
        uvs.set(a.uv.array, offset * 2);
      tint.set(part.color === null || part.color === undefined ? 0xffffff : part.color).convertSRGBToLinear();
      for (let i = offset; i < offset + n; i++) {
        colors[i * 3] = tint.r;
        colors[i * 3 + 1] = tint.g;
        colors[i * 3 + 2] = tint.b;
      }
      offset += n;
      part.g.dispose();
    }
    const g = new SN.T.BufferGeometry();
    g.setAttribute("position", new SN.T.BufferAttribute(positions, 3));
    g.setAttribute("normal", new SN.T.BufferAttribute(normals, 3));
    g.setAttribute("uv", new SN.T.BufferAttribute(uvs, 2));
    g.setAttribute("color", new SN.T.BufferAttribute(colors, 3));
    g.computeBoundingSphere();
    return g;
  };

  SN.staticCityTiles = function staticCityTiles(material, list, range = 1650, size = 320, detail = false, shadows = true, cameraParts = null) {
    if (!list.length)
      return;
    const geometry = list[0].g || SN.box;
    const instanced = list.every(p => (p.g || SN.box) === geometry);
    // Repeated boxes/planes need one transform each, not duplicated vertices and
    // a draw every 192 parts. Mixed atlas geometry still uses bounded merges.
    // Keep the two shader layouts on separate materials in r128.
    const registry = instanced ? SN.staticInstanceMaterials : SN.mergedCityMaterials;
    let mergedMaterial = registry.get(material);
    if (!mergedMaterial) {
      mergedMaterial = material.clone();
      mergedMaterial.onBeforeCompile = material.onBeforeCompile;
      mergedMaterial.customProgramCacheKey = material.customProgramCacheKey.bind(material);
      mergedMaterial.vertexColors = !instanced || material.vertexColors;
      registry.set(material, mergedMaterial);
      SN.envMats.push({ material: mergedMaterial, base: material.envMapIntensity });
    }
    const tiles = new Map();
    for (const p of list) {
      const box = SN.registerCameraPart(p, p.g || SN.box);
      if (box && cameraParts) cameraParts.push(box);
      const key = Math.floor(p.x / size) + "," + Math.floor(p.z / size);
      if (!tiles.has(key))
        tiles.set(key, []);
      tiles.get(key).push(p);
    }
    for (const [key, entries] of tiles) {
      if (instanced) {
        for (let first = 0; first < entries.length; first += 1024) {
          SN.registerTile(geometry, mergedMaterial, entries.slice(first, first + 1024), shadows, size, key, range);
          const tile = SN.cityTiles[SN.cityTiles.length - 1];
          tile.detail = detail;
          tile.frontage = material === SN.artSignMat || material === SN.storefrontMat || material === SN.urbanSignMaterial || material === SN.detailConcrete;
        }
        continue;
      }
      let first = 0, vertices = 0;
      for (let i = 0; i <= entries.length; i++) {
        const p = entries[i], geometry = p && (p.g || SN.box);
        const count = geometry ? (geometry.index ? geometry.index.count : geometry.attributes.position.count) : 0;
        if (i > first && (i === entries.length || i - first >= 192 || vertices + count > 12000)) {
          SN.registerTile(SN.box, mergedMaterial, entries.slice(first, i), shadows, size, key, range);
          const tile = SN.cityTiles[SN.cityTiles.length - 1];
          tile.merged = true; tile.detail = detail;
          tile.frontage = material === SN.artSignMat || material === SN.storefrontMat || material === SN.urbanSignMaterial || material === SN.detailConcrete;
          first = i; vertices = 0;
        }
        vertices += count;
      }
    }
  };

  SN.meshAt = function meshAt(geo, material, x, y, z, sx = 1, sy = 1, sz = 1, yaw = 0, parent = SN.scene) {
    const m = new SN.T.Mesh(geo, material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.y = yaw;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // Merge small procedural car parts at construction time to reduce draw calls.

  SN.merged = function merged(parts) {
    const positions = [], normals = [], uvs = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
      // Parts whose vertices are already placed in local body space omit x/y/z;
      // defaulting them here keeps the transform matrix finite for every part.
      SN.dummy.position.set(Number.isFinite(p.x) ? p.x : 0, Number.isFinite(p.y) ? p.y : 0, Number.isFinite(p.z) ? p.z : 0);
      SN.dummy.rotation.set(p.rx || p.pitch || 0, p.ry || p.yaw || 0, p.rz || 0, "YXZ");
      SN.dummy.scale.set(p.sx || 1, p.sy || 1, p.sz || 1);
      SN.dummy.updateMatrix();
      g.applyMatrix4(SN.dummy.matrix);
      // Large imported car meshes can exceed the argument limit of push(...array),
      // so merge with ordinary loops; output is identical.
      const position = g.attributes.position.array, normal = g.attributes.normal.array;
      for (let j = 0; j < position.length; j++) positions.push(position[j]);
      for (let j = 0; j < normal.length; j++) normals.push(normal[j]);
      if (g.attributes.uv) {
        const uv = g.attributes.uv.array;
        for (let j = 0; j < uv.length; j++) uvs.push(uv[j]);
      } else
        for (let j = 0; j < g.attributes.position.count; j++)
          uvs.push(0, 0);
      g.dispose();
    }
    const g = new SN.T.BufferGeometry();
    g.setAttribute("position", new SN.T.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new SN.T.Float32BufferAttribute(normals, 3));
    g.setAttribute("uv", new SN.T.Float32BufferAttribute(uvs, 2));
    return g;
  };
  // Weld coincident position/UV pairs, then rebuild smooth vertex normals. Extruded
  // car shells and tapered limbs arrive non-indexed and flat-shaded; this pass is
  // what turns the faceted outline into a continuous round surface.
  SN.weldGeometry = function weldGeometry(geometry, tolerance = 0.0002, positionOnly = false) {
    const position = geometry.attributes.position, uv = geometry.attributes.uv,
      index = geometry.index, count = index ? index.count : position.count,
      keyScale = 1 / tolerance, uvScale = 2048,
      positions = [], uvs = [], indices = [], lookup = new Map();
    for (let i = 0; i < count; i++) {
      const vertex = index ? index.getX(i) : i,
        x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex),
        u = uv ? uv.getX(vertex) : 0, v = uv ? uv.getY(vertex) : 0,
        key = Math.round(x * keyScale) + "," + Math.round(y * keyScale) + "," + Math.round(z * keyScale) +
          (positionOnly ? "" : "|" + Math.round(u * uvScale) + "," + Math.round(v * uvScale));
      let found = lookup.get(key);
      if (found === undefined) {
        found = positions.length / 3;
        lookup.set(key, found);
        positions.push(x, y, z);
        uvs.push(u, v);
      }
      indices.push(found);
    }
    const g = new SN.T.BufferGeometry();
    g.setAttribute("position", new SN.T.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new SN.T.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    geometry.dispose();
    return g;
  };
  // Comfortable Lathe helper: [[radius, y], ...] from bottom to top.
  SN.latheProfile = function latheProfile(points, segments = 12) {
    return new SN.T.LatheGeometry(points.map(point => new SN.T.Vector2(Math.max(0, point[0]), point[1])), segments);
  };
  // Extrude a closed 2D outline in the XY plane across the Z depth, then centre it.
  SN.extrudeOutline = function extrudeOutline(points, depth, bevel = 0.03, curveSegments = 6, bevelSegments = 2) {
    const shape = new SN.T.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++)
      shape.lineTo(points[i][0], points[i][1]);
    shape.closePath();
    const geometry = new SN.T.ExtrudeGeometry(shape, {
      depth: Math.max(0.002, depth - bevel * 2),
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: bevel > 0 ? bevelSegments : 0,
      curveSegments,
      steps: 1
    });
    geometry.translate(0, 0, -Math.max(0.002, depth - bevel * 2) / 2);
    return geometry;
  };
  // Startup phase 3: keep this order relative to the other systems.

  SN.registerInit(3, function initializeMaterials3() {
    SN.dummy = new SN.T.Object3D();
    SN.tempV = new SN.T.Vector3();
    SN.lookTarget = new SN.T.Vector3();
    SN.camTarget = new SN.T.Vector3();
    SN.camWant = new SN.T.Vector3();
    SN.skyDirection = new SN.T.Vector3();
    SN.cameraPropBins = new Map();
    SN.cameraPropStamp = 0;
    SN.box = new SN.T.BoxGeometry(1, 1, 1);
    SN.cylinder = new SN.T.CylinderGeometry(1, 1, 1, 7);
    SN.cupGeo = new SN.T.CylinderGeometry(0.78, 1, 1, 10);
    SN.leafGeo = new SN.T.IcosahedronGeometry(1, 1);
    // Hex colours are authored in sRGB; r128 feeds them straight into the linear pipeline,
    // so pale "concrete" values were acting as 0.7 albedo. Convert on the way in.
    SN.srgb = h => new SN.T.Color(h).convertSRGBToLinear();
    // Sky IBL needs to be dimmed together with the daylight cycle and kept well below the
    // key light, otherwise every standard material is lifted by a flat white ambient.
    SN.envMats = [];
    SN.mat = (color, extra) => {
      const opts = Object.assign({ color: typeof color === "number" ? SN.srgb(color) : color, roughness: 0.85 }, extra);
      if (opts.envMapIntensity === undefined)
        opts.envMapIntensity = (opts.metalness || 0) > 0.45 ? 0.9 : 0.3;
      const m = new SN.T.MeshStandardMaterial(opts);
      SN.envMats.push({ material: m, base: opts.envMapIntensity });
      return m;
    };
    // ---------------- Procedural PBR surface library ----------------
    // Every map below is painted locally on a canvas at startup. Each surface keeps
    // its colour, height and roughness in sync, then a Sobel pass turns height into
    // a tangent normal map. Nothing is fetched and no two materials share a flat tint.
    SN.PBR_TEX_SIZE = 512;
    SN.surfaceCache = new Map();
    SN.facadeCache = new Map();
    SN.surfaceSeed = 917431;
    SN.wetUniforms = {
      wet: { value: 0 },
      time: { value: 0 },
      night: { value: 0 },
      puddle: { value: SN.buildWetMaskTexture() },
      ripple: { value: SN.buildRippleTexture() }
    };
    // Core street surfaces. Albedo stays inside 0.05-0.4: nothing is pure white or black.
    SN.asphalt = SN.pbrMat("asphalt", 0x8a99ad, { uvScale: 1 / 6.2, roughness: 1, metalness: 0.03, envMapIntensity: 0.35 });
    SN.applyWorldUV(SN.asphalt, 1 / 6.2, 1 / 6.2, shader => {
      shader.fragmentShader = "varying vec3 vPbrWorld;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
        vec2 roadCell = floor(vPbrWorld.xz / 11.);
        float patchSeed = fract(sin(dot(roadCell,vec2(12.98,78.23)))*43758.5);
        vec2 patchUV = fract(vPbrWorld.xz / 11.) - vec2(.25 + patchSeed*.45,.45);
        float oil = (1.-smoothstep(.03,.15,length(patchUV*vec2(1.3,.8))))*step(.72,patchSeed);
        float repair = (1.-smoothstep(.17,.18,max(abs(patchUV.x),abs(patchUV.y)*1.5)))*step(patchSeed,.17);
        diffuseColor.rgb *= 1.-oil*.18-repair*.09;`);
    });
    SN.applyWetSurface(SN.asphalt, { strength: 1, darken: 0.42 });
    SN.sidewalk = SN.pbrMat("tile", 0xf4e9d1, { uvScale: 1 / 3.2, roughness: 1, metalness: 0.02, envMapIntensity: 0.28 });
    SN.applyWorldUV(SN.sidewalk, 1 / 3.2, 1 / 3.2, shader => {
      shader.fragmentShader = "varying vec3 vPbrWorld;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
        float south = step(800., vPbrWorld.z);
        float shopping = (1.-south)*step(285.,vPbrWorld.x)*step(vPbrWorld.x,580.);
        vec2 paving = vPbrWorld.xz / mix(.8,1.35,south);
        paving.x += mod(floor(paving.y),2.)*.5*(1.-south);
        vec2 joint = min(fract(paving),1.-fract(paving));
        float grout = smoothstep(.012,.035,min(joint.x,joint.y));
        float tileShade = .92 + .08*fract(sin(dot(floor(paving),vec2(12.98,78.23)))*43758.5);
        vec3 pavingTint = mix(vec3(1.,.96,.86),vec3(.76,.88,1.),south);
        pavingTint = mix(pavingTint,vec3(1.12,.78,.68),shopping*.65);
        diffuseColor.rgb *= pavingTint * tileShade * mix(.68,1.,grout);`);
    });
    SN.applyWetSurface(SN.sidewalk, { strength: 0.7, darken: 0.24 });
    SN.stripeMat = SN.pbrMat("paint", 0xffffff, { uvScale: 1 / 2.4, roughness: 0.9, metalness: 0.02, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    SN.curbMat = SN.pbrMat("concrete", 0xe7e4d9, { uvScale: 1 / 2, roughness: 1, metalness: 0.02, envMapIntensity: 0.25 });
    SN.stoneMat = SN.pbrMat("stone", 0xb2a68e, { uvScale: 1 / 3, roughness: 1, metalness: 0.02, envMapIntensity: 0.3 });
    SN.darkMat = SN.pbrMat("metal", 0x3a464c, { uvScale: 1 / 2.2, roughness: 0.82, metalness: 0.45, envMapIntensity: 0.75 });
    SN.asphaltBaseColor = SN.asphalt.color.clone();
    SN.asphaltWetColor = SN.srgb(0x4d4a45);
    SN.asphaltDryRough = SN.asphalt.roughnessMap;
    SN.asphaltWetRough = SN.getSurface("asphalt").wetRoughnessMap;
    SN.roadBatch = [];
    SN.sideBatch = [];
    SN.markBatch = [];
    SN.curbBatch = [];
    SN.trunkBatch = [];
    SN.leafBatch = [];
    SN.willowBatch = [];
    SN.lampBatch = [];
    SN.lampHeadBatch = [];
    SN.poolBatch = [];
    SN.roofBatch = [];
    SN.railBatch = [];
    SN.benchBatch = [];
    SN.foamBatch = [];
    SN.lampPoints = [];
    // Spatial tiles give r128 an explicit bounding sphere for instance-aware culling.
    SN.cityTiles = [];
    SN.cityInstanceGroups = new Map();
    SN.cityPacking = { view: new Float64Array(19).fill(NaN), tiles: [], meshes: [], flags: [] };
    SN.cityInstanceSphere = new SN.T.Sphere(new SN.T.Vector3(), 0);
    SN.tileQueue = []; SN.urbanRetired = new Set();
    SN.tileProjection = new SN.T.Matrix4(); SN.tileFrustum = new SN.T.Frustum();
    SN.actorCullSphere = new SN.T.Sphere(new SN.T.Vector3(), 4);
    SN.carCullSphere = new SN.T.Sphere(new SN.T.Vector3(), 8);
    SN.streamClock = 0;
    SN.mergedCityMaterials = new Map();
    SN.staticInstanceMaterials = new Map();
  });
})(window.SN);
