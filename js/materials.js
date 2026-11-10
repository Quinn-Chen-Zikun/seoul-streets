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
    const color = SN.colorFromHeight(height, glassTower ? [82, 96, 102] : [[154, 150, 142], [160, 151, 136], [164, 153, 134]][variant], 0.42, 811 + variant),
      cctx = color.getContext("2d");
    const rough = SN.makeCanvas(w, h), rctx = rough.getContext("2d");
    rctx.fillStyle = glassTower ? "#6a6a6a" : "#dcdcdc";
    rctx.fillRect(0, 0, w, h);
    const emissive = SN.makeCanvas(w, h), ectx = emissive.getContext("2d");
    ectx.fillStyle = "#000";
    ectx.fillRect(0, 0, w, h);
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
  // World-space planar UVs: horizontal faces use XZ, vertical faces use X+Y and Y,
  // so a 4 m wall corner and a 140 m road share the same texel density.

  SN.applyWorldUV = function applyWorldUV(material, scaleX, scaleY, extra) {
    const ax = scaleX === undefined ? 0.28 : scaleX, ay = scaleY === undefined ? ax : scaleY;
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
 vUv=(abs(pbrNor.y)>.55?pbrPos.xz:vec2(pbrPos.x+pbrPos.z,pbrPos.y))*uPbrScale;`);
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
    const m = SN.mat(color, opts);
    const ns = p.normalStrength === undefined ? 0.55 : p.normalStrength;
    m.normalScale.set(ns, ns);
    const sx = p.uvScale === undefined ? 0.3 : p.uvScale, sy = p.uvScaleY === undefined ? sx : p.uvScaleY;
    SN.applyWorldUV(m, sx, sy, p.shaderHook);
    return m;
  };

  SN.record = function record(list, x, y, z, sx, sy, sz, yaw = 0, color = null) {
    list.push({ x, y, z, sx, sy, sz, yaw, color });
  };

  SN.registerTile = function registerTile(geo, material, entries, shadows, tileSize, key, range, minQ = 0) {
    const parts = key.split(",");
    SN.cityTiles.push({
      geo,
      material,
      entries,
      shadows,
      cx: (Number(parts[0]) + 0.5) * tileSize,
      cz: (Number(parts[1]) + 0.5) * tileSize,
      half: tileSize * 0.71,
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
      mesh = new SN.T.InstancedMesh(g, tile.material, tile.entries.length),
      bounds = new SN.T.Box3(),
      v = new SN.T.Vector3();
    // Uncoloured instances (setback towers, roof blocks) must stay white, not black.
    if (tile.entries.some(p => p.color !== null && p.color !== undefined))
      mesh.instanceColor = new SN.T.InstancedBufferAttribute(new Float32Array(tile.entries.length * 3).fill(1), 3);
    for (let i = 0; i < tile.entries.length; i++) {
      const p = tile.entries[i];
      SN.dummy.position.set(p.x, p.y, p.z);
      SN.dummy.rotation.set(p.pitch || 0, p.yaw || 0, 0, "YXZ");
      SN.dummy.scale.set(p.sx, p.sy, p.sz);
      SN.dummy.updateMatrix();
      mesh.setMatrixAt(i, SN.dummy.matrix);
      if (p.color !== null && p.color !== undefined)
        mesh.setColorAt(i, SN.tintColor.setHex(p.color).convertSRGBToLinear());
      const r = Math.hypot(p.sx, p.sy, p.sz);
      bounds.expandByPoint(v.set(p.x - r, p.y - r, p.z - r));
      bounds.expandByPoint(v.set(p.x + r, p.y + r, p.z + r));
    }
    g.boundingSphere = bounds.getBoundingSphere(new SN.T.Sphere());
    mesh.frustumCulled = true;
    mesh.castShadow = tile.shadows;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    SN.scene.add(mesh);
    tile.mesh = mesh;
  };

  SN.streamCity = function streamCity(force = false) {
    for (const [source, target] of SN.mergedCityMaterials) {
      target.emissiveIntensity = source.emissiveIntensity;
      target.envMapIntensity = source.envMapIntensity;
      target.roughnessMap = source.roughnessMap;
      target.color.copy(source.color);
    }
    if (!force && SN.renderTime < SN.streamClock)
      return;
    SN.streamClock = SN.renderTime + 0.16;
    const px = SN.started ? SN.player.x : SN.camera.position.x,
      pz = SN.started ? SN.player.z : SN.camera.position.z,
      level = SN.qualityLevel(),
      pending = [];
    SN.streamUrbanDetails(px, pz, force);
    for (const tile of SN.cityTiles) {
      const distance = Math.max(0, Math.hypot(px - tile.cx, pz - tile.cz) - (tile.detail ? 0 : tile.half)),
        near = level >= tile.minQ && distance < tile.range * (tile.detail ? (level === 0 ? 0.75 : 1) : (level === 0 ? 0.65 : level === 1 ? 0.8 : 1));
      if (near) {
        tile.lastNear = SN.renderTime;
        if (!tile.mesh)
          pending.push({ tile, distance });
        else
          tile.mesh.visible = true;
      }
      else if (tile.mesh) {
        tile.mesh.visible = false;
        if (distance > tile.range + (tile.detail ? 90 : 400) && SN.renderTime - tile.lastNear > 3) {
          SN.scene.remove(tile.mesh);
          tile.mesh.geometry.dispose();
          if (tile.mesh.dispose)
            tile.mesh.dispose();
          tile.mesh = null;
        }
      }
    }
    pending.sort((a, b) => a.distance - b.distance);
    const deadline = performance.now() + (force ? 10000 : 4);
    for (const item of pending) {
      SN.activateCityTile(item.tile);
      if (performance.now() > deadline)
        break;
    }
    for (const page of SN.terrainPages)
      page.mesh.visible = Math.hypot(page.x - px, page.z - pz) < SN.Q[level].far + 600;
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

  SN.staticCityTiles = function staticCityTiles(material, list, range = 1650, size = 320, detail = false, shadows = true) {
    if (!list.length)
      return;
    let mergedMaterial = SN.mergedCityMaterials.get(material);
    if (!mergedMaterial) {
      mergedMaterial = material.clone();
      mergedMaterial.onBeforeCompile = material.onBeforeCompile;
      mergedMaterial.customProgramCacheKey = material.customProgramCacheKey.bind(material);
      mergedMaterial.vertexColors = true;
      SN.mergedCityMaterials.set(material, mergedMaterial);
      SN.envMats.push({ material: mergedMaterial, base: material.envMapIntensity });
    }
    const tiles = new Map();
    for (const p of list) {
      const key = Math.floor(p.x / size) + "," + Math.floor(p.z / size);
      if (!tiles.has(key))
        tiles.set(key, []);
      tiles.get(key).push(p);
    }
    for (const [key, entries] of tiles) {
      SN.registerTile(SN.box, mergedMaterial, entries, shadows, size, key, range);
      const tile = SN.cityTiles[SN.cityTiles.length - 1];
      tile.merged = true;
      tile.detail = detail;
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
    const positions = [], normals = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
      SN.dummy.position.set(p.x, p.y, p.z);
      SN.dummy.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      SN.dummy.scale.set(p.sx || 1, p.sy || 1, p.sz || 1);
      SN.dummy.updateMatrix();
      g.applyMatrix4(SN.dummy.matrix);
      positions.push(...g.attributes.position.array);
      normals.push(...g.attributes.normal.array);
      g.dispose();
    }
    const g = new SN.T.BufferGeometry();
    g.setAttribute("position", new SN.T.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new SN.T.Float32BufferAttribute(normals, 3));
    return g;
  };
  // Startup phase 3: keep this order relative to the other systems.

  SN.registerInit(3, function initializeMaterials3() {
    SN.dummy = new SN.T.Object3D();
    SN.tempV = new SN.T.Vector3();
    SN.tintColor = new SN.T.Color();
    SN.lookTarget = new SN.T.Vector3();
    SN.camTarget = new SN.T.Vector3();
    SN.camWant = new SN.T.Vector3();
    SN.skyDirection = new SN.T.Vector3();
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
      const opts = Object.assign({ roughness: 0.85 }, extra);
      // Every hex colour in the project is authored in sRGB. Material colours must
      // be linear in r128, otherwise they render pale and desaturated after sRGB output.
      opts.color = SN.srgb(color);
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
    // Core street surfaces. Albedo stays inside 0.05-0.4: nothing is pure white or black.
    SN.asphalt = SN.pbrMat("asphalt", 0xcac4ba, { uvScale: 1 / 6.2, roughness: 1, metalness: 0.03, envMapIntensity: 0.35 });
    SN.sidewalk = SN.pbrMat("concrete", 0xcfc6b4, { uvScale: 1 / 3.2, roughness: 1, metalness: 0.02, envMapIntensity: 0.28 });
    SN.stripeMat = SN.pbrMat("paint", 0xbdb69a, { uvScale: 1 / 2.4, roughness: 0.9, metalness: 0.02, envMapIntensity: 0.3 });
    SN.curbMat = SN.pbrMat("concrete", 0xa9a294, { uvScale: 1 / 2, roughness: 1, metalness: 0.02, envMapIntensity: 0.25 });
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
    SN.streamClock = 0;
    SN.mergedCityMaterials = new Map();
  });
})(window.SN);
