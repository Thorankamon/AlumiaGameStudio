/* © 2026 thorankamon — Tous droits réservés.
   studio-fx.js — moteur d'effets visuels cumulables (aperçus et futur moteur de jeu).
   Un effet (collection « effets ») : {name, note, targets:{hero,pnj,event,image,screen}, duration, stack:[{type,on,…paramètres}]}
   Fx.render(source, stack, t) → {canvas, ox, oy} : le sprite (source) dessiné avec tous les effets ; (ox,oy) = position de
   l'angle haut-gauche de la source dans le canvas renvoyé (qui est plus grand : ombre, reflet, lueur dépassent). */
(function () {
  const num = (k, l, min, max, def, step) => ({ k, l, t: "num", min, max, def, step: step || 1 });
  const col = (k, l, def) => ({ k, l, t: "col", def });
  const COMP = {
    shadow: { ic: "🌑", n: "Ombre portée", p: [{ k: "mode", l: "Type", t: "sel", o: [["ellipse", "Ellipse au sol"], ["cast", "Ombre projetée"]], def: "ellipse" }, num("op", "Opacité (%)", 0, 100, 45), num("size", "Taille (%)", 20, 200, 80), num("dy", "Décalage vertical (px)", -40, 40, 0), num("blur", "Flou (px)", 0, 20, 3), num("angle", "Angle de projection (°)", -80, 80, 30), num("len", "Longueur de l'ombre (%)", 20, 200, 80), col("col", "Couleur", "#000000")] },
    reflection: { ic: "🪞", n: "Reflet (eau, sol brillant)", p: [num("op", "Opacité (%)", 0, 100, 45), num("len", "Hauteur du reflet (%)", 10, 100, 70), num("gap", "Écart avec le sprite (px)", -20, 40, 0), num("wave", "Ondulation (px)", 0, 10, 0, .5), num("wspeed", "Vitesse d'ondulation", 0, 10, 3, .5)] },
    glow: { ic: "✨", n: "Lueur", p: [col("col", "Couleur", "#ffe27a"), num("radius", "Rayon (px)", 1, 30, 8), num("power", "Intensité (%)", 0, 300, 100), num("pulse", "Pulsation (%)", 0, 100, 30), num("speed", "Vitesse de pulsation", 0, 10, 2, .5)] },
    outline: { ic: "🖍", n: "Contour", p: [col("col", "Couleur", "#ffffff"), num("size", "Épaisseur (px)", 1, 8, 2)] },
    tint: { ic: "🎨", n: "Couleur (teinte, luminosité…)", p: [col("col", "Couleur ajoutée", "#3366ff"), num("op", "Intensité de la couleur (%)", 0, 100, 0), num("bri", "Luminosité (%)", 0, 300, 100), num("sat", "Saturation (%)", 0, 300, 100), num("hue", "Teinte (°)", -180, 180, 0)] },
    blur: { ic: "🌫", n: "Flou", p: [num("px", "Force (px)", 0, 20, 2, .5)] },
    pulse: { ic: "💓", n: "Transparence pulsante", p: [num("min", "Opacité minimale (%)", 0, 100, 40), num("speed", "Vitesse", 0, 10, 2, .5)] },
    shake: { ic: "📳", n: "Tremblement", p: [num("amp", "Amplitude (px)", 0, 12, 2, .5), num("speed", "Vitesse", 1, 10, 5, .5)] },
    float: { ic: "🎈", n: "Flottement", p: [num("amp", "Amplitude (px)", 0, 20, 4, .5), num("speed", "Vitesse", 0, 10, 1.5, .5)] },
    glitch: { ic: "⚡", n: "Grésillement / glitch", p: [num("power", "Intensité (%)", 0, 100, 50), num("freq", "Fréquence (par seconde)", 0, 30, 8), num("shift", "Décalage de couleurs (px)", 0, 12, 3), num("slices", "Tranches décalées", 0, 12, 4), num("noise", "Parasites (%)", 0, 60, 8), num("lines", "Lignes de balayage (%)", 0, 100, 25)] },
    pixelate: { ic: "🔳", n: "Pixelisation", p: [num("size", "Taille des pixels", 1, 16, 3)] },
    silhouette: { ic: "👤", n: "Silhouette unie", p: [col("col", "Couleur", "#000000"), num("op", "Opacité (%)", 0, 100, 100)] }
  };
  const PRESETS = {
    "🌑 Ombre simple": [{ type: "shadow" }],
    "🪞 Reflet d'eau": [{ type: "reflection", op: 50, len: 70, wave: 2, wspeed: 3 }, { type: "shadow", op: 25 }],
    "⚡ Grésillement électrique": [{ type: "glitch", power: 70, freq: 10 }, { type: "glow", col: "#8ad8ff", radius: 6, power: 120, pulse: 40, speed: 6 }],
    "📺 Hologramme": [{ type: "tint", col: "#00e5ff", op: 55, bri: 120 }, { type: "glitch", power: 35, freq: 5, noise: 4, lines: 55 }, { type: "float", amp: 3, speed: 1 }, { type: "pulse", min: 60, speed: 3 }],
    "👻 Fantôme": [{ type: "tint", col: "#a8c4ff", op: 35, bri: 120 }, { type: "pulse", min: 35, speed: 1.2 }, { type: "float", amp: 5, speed: 1 }, { type: "blur", px: 1 }],
    "☣️ Poison": [{ type: "tint", col: "#2fd13a", op: 40 }, { type: "pulse", min: 70, speed: 3 }],
    "🔥 Brûlé": [{ type: "glow", col: "#ff7a1a", radius: 10, power: 150, pulse: 50, speed: 5 }, { type: "shake", amp: 1, speed: 8 }],
    "🧊 Gelé": [{ type: "tint", col: "#7fd3ff", op: 45, bri: 110, sat: 70 }, { type: "outline", col: "#dff6ff", size: 1 }],
    "🕶 Silhouette + contour": [{ type: "silhouette", col: "#101018" }, { type: "outline", col: "#ffd34d", size: 2 }]
  };
  const defs = type => { const o = { type, on: true }; COMP[type].p.forEach(f => o[f.k] = f.def); return o; };
  const full = c => Object.assign(defs(c.type), c);
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const silh = (src, color, a) => { const c = mk(src.width, src.height), x = c.getContext("2d"); x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-in"; x.globalAlpha = a == null ? 1 : a; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; };
  function render(src, stack, t) {
    t = t || 0; const st = (stack || []).filter(c => c.on !== false && COMP[c.type]).map(full), w = src.width, h = src.height, M = 26;
    const has = ty => st.find(c => c.type === ty);
    // 1) sprite transformé (avec marge M)
    let spr = mk(w + M * 2, h + M * 2); spr.getContext("2d").drawImage(src, M, M);
    let alpha = 1, dx = 0, dy = 0;
    for (const c of st) {
      const W = spr.width, H = spr.height;
      if (c.type === "tint") { const n = mk(W, H), x = n.getContext("2d"); x.filter = `brightness(${c.bri}%) saturate(${c.sat}%) hue-rotate(${c.hue}deg)`; x.drawImage(spr, 0, 0); x.filter = "none"; if (c.op > 0) { x.globalCompositeOperation = "source-atop"; x.globalAlpha = c.op / 100; x.fillStyle = c.col; x.fillRect(0, 0, W, H); } spr = n; }
      else if (c.type === "blur" && c.px > 0) { const n = mk(W, H), x = n.getContext("2d"); x.filter = `blur(${c.px}px)`; x.drawImage(spr, 0, 0); spr = n; }
      else if (c.type === "pixelate" && c.size > 1) { const n = mk(W, H), x = n.getContext("2d"), s = document.createElement("canvas"); s.width = Math.ceil(W / c.size); s.height = Math.ceil(H / c.size); s.getContext("2d").drawImage(spr, 0, 0, s.width, s.height); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, s.width * c.size, s.height * c.size); spr = n; }
      else if (c.type === "silhouette") { const s = silh(spr, c.col), n = mk(W, H), x = n.getContext("2d"); x.drawImage(spr, 0, 0); x.globalAlpha = c.op / 100; x.globalCompositeOperation = "source-atop"; x.drawImage(s, 0, 0); spr = n; }
      else if (c.type === "outline") { const s = silh(spr, c.col), n = mk(W, H), x = n.getContext("2d"), r = c.size; for (let a = 0; a < 16; a++) x.drawImage(s, Math.cos(a / 16 * 6.283) * r, Math.sin(a / 16 * 6.283) * r); x.drawImage(spr, 0, 0); spr = n; }
      else if (c.type === "glow") { const s = silh(spr, c.col), n = mk(W, H), x = n.getContext("2d"), k = (c.power / 100) * (1 - c.pulse / 100 * (.5 - .5 * Math.sin(t * c.speed * 6.283))); x.filter = `blur(${c.radius}px)`; for (let i = 0; i < Math.ceil(k); i++) { x.globalAlpha = Math.min(1, k - i); x.drawImage(s, 0, 0); } x.filter = "none"; x.globalAlpha = 1; x.drawImage(spr, 0, 0); spr = n; }
      else if (c.type === "glitch") {
        const tick = Math.floor(t * Math.max(1, c.freq)), on = hash(tick) < c.power / 100;
        const n = mk(W, H), x = n.getContext("2d"); x.drawImage(spr, 0, 0);
        if (on || c.lines > 0 || c.noise > 0) {
          const d = x.getImageData(0, 0, W, H), p = d.data, o = new Uint8ClampedArray(p);
          if (on) {
            for (let s = 0; s < c.slices; s++) { const y0 = Math.floor(hash(tick * 7 + s) * H), hh = 2 + Math.floor(hash(tick * 13 + s) * H * .12), off = Math.round((hash(tick * 3 + s) - .5) * c.power * .6);
              for (let y = y0; y < Math.min(H, y0 + hh); y++) for (let xx = 0; xx < W; xx++) { const sx = xx - off, i = (y * W + xx) * 4; if (sx >= 0 && sx < W) { const j = (y * W + sx) * 4; p[i] = o[j]; p[i + 1] = o[j + 1]; p[i + 2] = o[j + 2]; p[i + 3] = o[j + 3]; } else p[i + 3] = 0; } }
            if (c.shift > 0) { const o2 = new Uint8ClampedArray(p), sh = Math.round(c.shift * c.power / 50) || 1; for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { const i = (y * W + xx) * 4, a = Math.max(0, xx - sh), b = Math.min(W - 1, xx + sh); p[i] = o2[(y * W + a) * 4]; p[i + 2] = o2[(y * W + b) * 4 + 2]; p[i + 3] = Math.max(o2[i + 3], o2[(y * W + a) * 4 + 3], o2[(y * W + b) * 4 + 3]) * (o2[i + 3] || o2[(y * W + a) * 4 + 3] || o2[(y * W + b) * 4 + 3] ? 1 : 0); } }
          }
          if (c.lines > 0) for (let y = 0; y < H; y += 2) for (let xx = 0; xx < W; xx++) { const i = (y * W + xx) * 4; p[i + 3] *= 1 - c.lines / 130; }
          if (c.noise > 0) { const cnt = Math.floor(W * H * c.noise / 100 * .1); for (let k = 0; k < cnt; k++) { const px = Math.floor(hash(t * 91 + k) * W), py = Math.floor(hash(t * 53 + k * 3) * H), i = (py * W + px) * 4; if (p[i + 3] > 0) { const v = hash(k + tick) > .5 ? 255 : 0; p[i] = p[i + 1] = p[i + 2] = v; } } }
          x.putImageData(d, 0, 0);
        }
        spr = n;
      }
      else if (c.type === "pulse") alpha *= c.min / 100 + (1 - c.min / 100) * (.5 + .5 * Math.sin(t * c.speed * 6.283));
      else if (c.type === "shake") { dx += (Math.sin(t * c.speed * 17.3) + Math.sin(t * c.speed * 29.1)) / 2 * c.amp; dy += (Math.sin(t * c.speed * 23.7) + Math.sin(t * c.speed * 11.3)) / 2 * c.amp * .6; }
      else if (c.type === "float") dy += Math.sin(t * c.speed * 6.283) * c.amp;
    }
    // 2) toile finale
    const refl = has("reflection"), shd = has("shadow"), padX = Math.ceil(Math.max(34, w * .7)), padT = 44, padB = Math.ceil(refl ? h * refl.len / 100 + Math.max(0, refl.gap) + 60 : 60);
    const out = mk(w + padX * 2, h + padT + padB), c = out.getContext("2d"), ox = padX, oy = padT, feet = oy + h;
    if (refl) { const rh = Math.round(h * refl.len / 100) + 2 * M, rc = mk(spr.width, spr.height), rx = rc.getContext("2d"); rx.translate(0, spr.height); rx.scale(1, -1); rx.drawImage(spr, 0, 0);
      const fade = mk(spr.width, spr.height), fx = fade.getContext("2d"); fx.drawImage(rc, 0, 0); const g = fx.createLinearGradient(0, M, 0, M + h * refl.len / 100); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); fx.globalCompositeOperation = "destination-in"; fx.fillStyle = g; fx.fillRect(0, 0, fade.width, fade.height);
      c.save(); c.globalAlpha = refl.op / 100 * alpha; const top = feet + refl.gap - M;
      if (refl.wave > 0) { for (let y = 0; y < spr.height; y++) c.drawImage(fade, 0, y, spr.width, 1, ox - M + Math.sin(y * .45 + t * refl.wspeed * 3) * refl.wave, top + y, spr.width, 1); } else c.drawImage(fade, ox - M, top); c.restore(); }
    if (shd) { c.save(); c.globalAlpha = shd.op / 100; if (shd.blur > 0) c.filter = `blur(${shd.blur}px)`;
      if (shd.mode === "cast") { const s = silh(spr, shd.col), k = shd.len / 100 * .6; c.setTransform(1, 0, -Math.tan(shd.angle * Math.PI / 180) * k, -k, ox - M + (Math.tan(shd.angle * Math.PI / 180) * k) * 0 + dx * 0, feet + shd.dy + M * k); c.drawImage(s, 0, 0); }
      else { const rx = w * (shd.size / 100) * .42, ry = Math.max(3, rx * .28); c.fillStyle = shd.col; c.beginPath(); c.ellipse(ox + w / 2, feet + shd.dy - ry * .3, rx, ry, 0, 0, 7); c.fill(); }
      c.restore(); }
    c.globalAlpha = alpha; c.drawImage(spr, ox - M + dx, oy - M + dy); c.globalAlpha = 1;
    return { canvas: out, ox, oy };
  }
  window.Fx = { COMP, PRESETS, defs, full, render };
})();
