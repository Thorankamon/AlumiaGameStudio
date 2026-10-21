/* © 2026 thorankamon — Tous droits réservés.
   studio-events.js — éditeur d'events partagé (Gestion des Events, Gestion des MAP, plus tard les événements communs).
   À inclure après studio-api.js et studio-chars.js.

   API :
     await Events.ctxLoad(force)                  charge interrupteurs, variables, characters, météos, maps, sons…
     Events.blank("event"|"pnj"|"graphic")        nouvel event {name,note,pages:[…]}
     await Events.mount(el, ev, {onChange})       éditeur intégré dans une page (modifie ev en direct)
     await Events.modal(ev, {title})              éditeur en fenêtre ; renvoie une copie modifiée ou null
     await Events.cmdEditor(el, cmds, {onChange}) éditeur de commandes seul (pour les événements communs)
     Events.charGet(id)                           charge {data,img} d'un character (avec cache)
   Contrats de données lus :
     doc "interrupteurs" = [{id,name}]   doc "variables" = [{id,name}]   collection "evcommuns" = [{name,…}]
   Un event : {name, note, pages:[{cond,g,mv,o,p,trig,cmds}]} ; un id est ajouté par la collection ou la map. */
(function () {
  const CTX = { fx: [], sw: [], vars: [], self: [], common: [], chars: [], meteo: [], maps: [], audio: [], images: [], ok: false };
  const arr = v => Array.isArray(v) ? v : [];
  const E = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const get = (o, k) => k.split(".").reduce((a, b) => a && a[b], o);
  const set = (o, k, v) => { const p = k.split("."); let a = o; while (p.length > 1) { const q = p.shift(); a = a[q] = a[q] || {}; } a[p[0]] = v; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const nameOf = (l, id) => { const x = arr(l).find(y => String(y.id) === String(id)); return x && x.name ? x.name : ""; };
  async function ctxLoad(force) {
    if (CTX.ok && !force) return CTX;
    const g = async f => { try { return await f(); } catch (e) { return null; } };
    CTX.sw = arr(await g(() => Studio.doc("interrupteurs", [])));
    CTX.vars = arr(await g(() => Studio.doc("variables", [])));
    CTX.self = arr(await g(() => Studio.doc("interrupteurs-locaux", [])));
    CTX.fx = arr(await g(() => Studio.col("effets", "effet").list()));
    CTX.common = arr(await g(() => Studio.col("evcommuns", "evcommun").list()));
    CTX.chars = arr(await g(() => Studio.col("characters", "character").list()));
    CTX.meteo = arr(await g(() => Studio.col("meteo", "meteo").list()));
    CTX.maps = arr(await g(() => Studio.col("maps", "map").list()));
    CTX.audio = arr(await g(() => Studio.assets("audio").list()));
    CTX.images = arr(await g(() => Studio.assets("images").list()));
    CTX.ok = true; return CTX;
  }
  // ---------- characters (cache)
  const CH = {};
  function charGet(id) {
    if (!id) return Promise.resolve(null);
    if (!CH[id]) CH[id] = (async () => { const data = await Studio.col("characters", "character").get(id); const img = await Chars.loadImg(Chars.assets().url(data.image)); return { data, img }; })().catch(() => null);
    return CH[id];
  }
  // ---------- modèles
  const page = () => ({ cond: { sw1on: false, sw1: 1, sw2on: false, sw2: 1, von: false, v: 1, vop: ">=", vval: 0, son: false, ss: "A" },
    g: { char: "", c: 0, r: 0, img: "", scale: 100, rot: 0, op: 100, blend: "normal", spin: 0 }, fx: [], mv: { type: "fixed", speed: 3, freq: 3 }, o: { walk: true, step: false, dirfix: false, through: false, transp: false },
    p: { hero: "meme", tiles: "meme" }, trig: "action", cmds: [] });
  function blank(kind) { const p = page(); if (kind === "event") { p.o.transp = true; p.o.walk = false; p.p.hero = "dessous"; } if (kind === "graphic") { p.trig = "none"; p.o.walk = false; p.p.hero = "dessous"; } return { name: "", note: "", pages: [p] }; }
  // ---------- CSS
  function css() {
    if (document.getElementById("ev-css")) return; const s = document.createElement("style"); s.id = "ev-css";
    s.textContent = `.ev-ed{font:13px Segoe UI,system-ui,sans-serif;color:#1e293b;display:flex;flex-direction:column;height:100%;min-height:0}.ev-ed *{box-sizing:border-box}
.ev-ed button{background:#3b82f6;color:#fff;border:0;border-radius:6px;padding:4px 9px;cursor:pointer;font:inherit}.ev-ed button.g{background:#64748b}.ev-ed button.r{background:#ef4444}.ev-ed button.on{outline:2px solid #fbbf24}
.ev-ed input[type=text],.ev-ed input[type=number],.ev-ed select,.ev-ed textarea{padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#1e293b;font:inherit}
.ev-head{display:flex;gap:8px;align-items:center;padding:6px 0;flex-wrap:wrap}.ev-head input[type=text]{flex:1;min-width:120px}.ev-id{background:#e2e8f0;border-radius:6px;padding:3px 8px;color:#475569}
.ev-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px}.ev-tabs button{background:#e2e8f0;color:#1e293b}.ev-tabs button.on{background:#3b82f6;color:#fff;outline:0}
.ev-body{flex:1;display:flex;gap:10px;min-height:0}.ev-left{width:330px;overflow:auto;padding-right:6px;flex-shrink:0}.ev-right{flex:1;min-width:0;display:flex;flex-direction:column}
.ev-f{display:flex;align-items:center;gap:6px;margin:4px 0}.ev-f>label{flex:1;color:#334155}.ev-f input[type=number]{width:70px}.ev-f select,.ev-f input[type=text]{width:170px}.ev-f textarea{width:100%}.ev-f.area{display:block}.ev-f.area label{display:block;margin-bottom:2px}.ev-h{color:#64748b;font-size:11px;max-width:90px;overflow:hidden;white-space:nowrap}.ev-ed .ev-f .ev-pk{width:92px}.ev-multi{display:flex;flex-wrap:wrap;gap:4px 12px}.ev-ed .ev-f.area .ev-multi label{display:flex;gap:4px;align-items:center;margin:0}
.ev-ed h5{margin:12px 0 4px;color:#0f172a;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e2e8f0}.ev-ed h5:first-child{margin-top:0}
.ev-cmd{display:flex;flex-direction:column;flex:1;min-height:0}.ev-tb{display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap}
.ev-rows{flex:1;overflow:auto;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:6px;font:12.5px Consolas,monospace;outline:0;min-height:160px}
.ev-r{padding:2px 6px;border-radius:4px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ev-r:hover{background:#1e293b}.ev-r.on{background:#2563eb}.ev-r.lab{color:#94a3b8;cursor:default}.ev-r.add{color:#475569}
.ev-pv{display:block;background:repeating-conic-gradient(#e5e7eb 0 25%,#fff 0 50%) 0 0/10px 10px;border:1px solid #cbd5e1;border-radius:6px;image-rendering:pixelated;margin:4px 0}
.ev-ov{position:fixed;inset:0;background:#0009;display:flex;align-items:center;justify-content:center;z-index:200}.ev-bx{background:#fff;border-radius:12px;padding:16px;display:flex;flex-direction:column;max-height:92vh;color:#1e293b}.ev-bx h3{margin-bottom:8px;font:600 15px Segoe UI,system-ui,sans-serif}
.ev-ft{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}.ev-ft button{background:#3b82f6;color:#fff;border:0;border-radius:6px;padding:6px 14px;cursor:pointer;font:13px Segoe UI,system-ui,sans-serif}.ev-ft button.g{background:#64748b}`;
    document.head.appendChild(s);
  }
  // ---------- générateur de formulaires
  const POS = [["bas", "En bas"], ["milieu", "Au milieu"], ["haut", "En haut"]];
  const DIRS = [["0", "Bas"], ["1", "Gauche"], ["2", "Droite"], ["3", "Haut"]];
  const OPS = [["=", "="], [">=", "≥"], ["<=", "≤"], [">", ">"], ["<", "<"], ["!=", "≠"]];
  const SSF = () => { const l = CTX.self.filter(x => x && x.id); return l.length ? l.map(x => [x.id, x.id + (x.name ? " — " + x.name : "")]) : [["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]]; };
  function opts(f) {
    const none = [["", "— aucun —"]], m = x => [x.id, x.name || x.id];
    if (f.src === "audio") return none.concat(CTX.audio.map(a => [a.name, a.name]));
    if (f.src === "images") return none.concat(CTX.images.map(a => [a.name, a.name]));
    if (f.src === "chars") return none.concat(CTX.chars.map(m));
    if (f.src === "meteo") return [["", "— aucune (ciel dégagé) —"]].concat(CTX.meteo.map(m));
    if (f.src === "maps") return [["", "— choisir une map —"]].concat(CTX.maps.map(m));
    if (f.src === "common") return [["", "— choisir —"]].concat(CTX.common.map(m));
    return typeof f.o === "function" ? f.o() : f.o;
  }
  function fieldEl(f, obj, cb) {
    const row = document.createElement("div"); row.className = "ev-f" + (f.area ? " area" : "");
    let v = get(obj, f.k); if (v === undefined && f.def !== undefined) { v = f.def; set(obj, f.k, v); } if (v === undefined && (f.t === "sw" || f.t === "var")) { v = 1; set(obj, f.k, 1); }
    if (f.t === "multi") { const L = f.src === "fx" ? CTX.fx : [], cur = new Set(arr(v)); row.className = "ev-f area";
      row.innerHTML = `<label>${f.l}</label><div class="ev-multi">${L.length ? L.map(x => `<label><input type="checkbox" value="${E(x.id)}" ${cur.has(x.id) ? "checked" : ""}> ${E(x.name || x.id)}</label>`).join("") : '<span class="ev-h" style="max-width:none">Aucun effet créé (voir Gestion des effets).</span>'}</div>`;
      row.addEventListener("change", () => { set(obj, f.k, [...row.querySelectorAll("input:checked")].map(i => i.value)); cb && cb(); }); return row; }
    let inp = "";
    if (f.t === "text") inp = f.area ? `<textarea rows="${f.rows || 4}">${E(v || "")}</textarea>` : `<input type="text" value="${E(v || "")}">`;
    else if (f.t === "num") inp = `<input type="number" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.step ? `step="${f.step}"` : ""} value="${v ?? ""}">`;
    else if (f.t === "chk") inp = `<input type="checkbox" ${v ? "checked" : ""}>`;
    else if (f.t === "col") inp = `<input type="color" value="${v || "#000000"}">`;
    else if (f.t === "sw" || f.t === "var") { const LL = f.t === "sw" ? CTX.sw : CTX.vars; inp = (LL.length ? `<select class="ev-pk"><option value="">choisir…</option>${LL.map(x => `<option value="${x.id}">${x.id} — ${E(x.name || "(sans nom)")}</option>`).join("")}</select>` : "") + `<input type="number" min="1" value="${v || 1}"><span class="ev-h"></span>`; }
    else { const o = opts(f), cur = v == null ? "" : String(v); const has = o.some(x => String(x[0]) === cur); const oo = has || !cur ? o : o.concat([[cur, cur + " (introuvable)"]]); inp = `<select>${oo.map(x => `<option value="${E(x[0])}" ${String(x[0]) === cur ? "selected" : ""}>${E(x[1])}</option>`).join("")}</select>`; }
    row.innerHTML = f.t === "chk" ? `<label>${f.l}</label>${inp}` : (f.area ? `<label>${f.l}</label>${inp}` : `<label>${f.l}</label>${inp}`);
    const el = (f.t === "sw" || f.t === "var") ? row.querySelector("input") : row.querySelector("input,select,textarea"), hint = row.querySelector(".ev-h"), pk = row.querySelector(".ev-pk");
    if (pk) pk.onchange = () => { if (pk.value) { el.value = pk.value; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); pk.value = ""; } };
    const hn = () => { if (hint) hint.textContent = nameOf(f.t === "sw" ? CTX.sw : CTX.vars, el.value) || ""; }; hn();
    const read = () => { let x; if (f.t === "chk") x = el.checked; else if (f.t === "num") x = el.value === "" ? null : +el.value; else if (f.t === "sw" || f.t === "var") x = Math.max(1, parseInt(el.value) || 1); else x = el.value; set(obj, f.k, x); hn(); };
    el.addEventListener(["text", "num", "sw", "var", "col"].includes(f.t) ? "input" : "change", () => { read(); if (!f.re) cb && cb(); });
    if (f.re || ["text", "num", "sw", "var"].includes(f.t)) el.addEventListener("change", () => { read(); cb && cb(); });
    return row;
  }
  function form(fields, obj, onChange) {
    const box = document.createElement("div");
    const build = () => { box.innerHTML = ""; fields.forEach(f => { if (f.h) { const h = document.createElement("h5"); h.textContent = f.h; box.appendChild(h); return; } if (f.show && !f.show(obj)) return;
      box.appendChild(fieldEl(f, obj, () => { onChange && onChange(); })); const el = box.lastChild; if (f.re) el.querySelector("input,select").addEventListener("change", () => build()); }); };
    build(); return box;
  }
  function dialog(title, body, o = {}) {
    return new Promise(res => {
      css(); const ov = document.createElement("div"); ov.className = "ev-ov"; ov.innerHTML = `<div class="ev-bx ev-ed" style="${o.style || "width:520px;max-width:94vw"}"><h3>${title}</h3><div class="ev-dbody" style="overflow:auto;flex:1;min-height:0"></div><div class="ev-ft"><button class="g" data-x="no">Annuler</button><button data-x="ok">OK</button></div></div>`;
      ov.querySelector(".ev-dbody").appendChild(body); document.body.appendChild(ov);
      const close = v => { ov.remove(); res(v); }; ov.querySelector('[data-x="no"]').onclick = () => close(false); ov.querySelector('[data-x="ok"]').onclick = () => close(true);
    });
  }
  // ---------- commandes
  const BG = [["aucune", "Aucune"], ["fondu", "Fondu"], ["glisse_bas", "Glisse depuis le bas"], ["glisse_haut", "Glisse depuis le haut"], ["zoom", "Zoom"]];
  const BLEND = [["normal", "Normal"], ["add", "Additif (lumière)"], ["multiply", "Multiplier (ombre)"], ["screen", "Écran"], ["overlay", "Superposition"]];
  const EASE = [["linear", "Constant"], ["in", "Démarre doucement"], ["out", "Finit doucement"], ["inout", "Doux au début et à la fin"], ["bounce", "Rebond"], ["elastic", "Élastique"]];
  const FXT = [["hero", "Le héros"], ["self", "Cet event"], ["event", "Un event précis (ID)"], ["image", "Une image (numéro)"], ["screen", "L'écran entier"]];
  const CMD = {
    message: { ic: "💬", n: "Message", f: [
      { k: "name", l: "Nom du personnage", t: "text" },
      { k: "text", l: "Texte (une ligne = un retour à la ligne)", t: "text", area: true, rows: 5 },
      { k: "face", l: "Visage (image du projet)", t: "sel", src: "images" },
      { h: "Apparence de la fenêtre" },
      { k: "style", l: "Style", t: "sel", o: [["fenetre", "Fenêtre"], ["sombre", "Fond sombre"], ["transparent", "Transparent"], ["bulle", "Bulle au-dessus de l'event"]], def: "fenetre", re: true },
      { k: "pos", l: "Position", t: "sel", o: POS, def: "bas", show: c => c.style !== "bulle" },
      { k: "opacity", l: "Opacité de la fenêtre (%)", t: "num", min: 0, max: 100, def: 100 },
      { k: "bg", l: "Animation d'apparition du fond", t: "sel", o: BG, def: "fondu" },
      { k: "color", l: "Couleur du texte", t: "col", def: "#ffffff" },
      { h: "Affichage du texte" },
      { k: "tw", l: "Lettre par lettre", t: "chk", def: true, re: true },
      { k: "speed", l: "Vitesse (lettres par seconde)", t: "num", min: 1, max: 200, def: 30, show: c => c.tw },
      { k: "blip", l: "Son à chaque lettre", t: "sel", src: "audio", show: c => c.tw },
      { k: "wait", l: "Attendre une touche", t: "chk", def: true },
      { k: "auto", l: "Fermer seul après (secondes, 0 = non)", t: "num", min: 0, max: 60, step: .5, def: 0, show: c => !c.wait }],
      sum: c => `${c.name ? "[" + c.name + "] " : ""}${(c.text || "").split("\n")[0].slice(0, 70)}  ·${c.style === "bulle" ? "bulle" : c.pos || "bas"}${c.tw ? "·lettre par lettre" : ""}` },
    choices: { ic: "❓", n: "Choix", f: [{ k: "labels", l: "Options (une par ligne, de 2 à 6)", t: "text", area: true, rows: 6 }, { k: "cancel", l: "Si le joueur annule", t: "sel", o: [["none", "Rien (impossible d'annuler)"], ["last", "Choisir la dernière option"]], def: "none" }],
      sum: c => "Choix : " + c.opts.map(o => o.label).join(" / ") },
    if: { ic: "🔀", n: "Condition (si… sinon…)", f: [
      { k: "ct", l: "Condition sur", t: "sel", o: [["sw", "Un interrupteur"], ["var", "Une variable"], ["self", "Un interrupteur local"]], def: "sw", re: true },
      { k: "id", l: "Interrupteur n°", t: "sw", show: c => c.ct === "sw" }, { k: "on", l: "Est activé", t: "chk", def: true, show: c => c.ct === "sw" || c.ct === "self" },
      { k: "vid", l: "Variable n°", t: "var", show: c => c.ct === "var" }, { k: "op", l: "Comparaison", t: "sel", o: OPS, def: ">=", show: c => c.ct === "var" },
      { k: "vk", l: "Comparer à", t: "sel", o: [["const", "Une valeur"], ["var", "Une autre variable"]], def: "const", re: true, show: c => c.ct === "var" },
      { k: "val", l: "Valeur", t: "num", def: 0, show: c => c.ct === "var" && c.vk !== "var" }, { k: "vid2", l: "Variable n°", t: "var", show: c => c.ct === "var" && c.vk === "var" },
      { k: "ss", l: "Interrupteur local", t: "sel", o: SSF, def: "A", show: c => c.ct === "self" }, { k: "hasElse", l: "Ajouter une branche « Sinon »", t: "chk", def: true }],
      sum: c => "Si " + condText(c) },
    sw: { ic: "🔘", n: "Interrupteur", f: [{ k: "id", l: "Interrupteur n°", t: "sw" }, { k: "v", l: "Mettre à", t: "sel", o: [["on", "Activé"], ["off", "Désactivé"], ["toggle", "Inverser"]], def: "on" }],
      sum: c => `Interrupteur #${c.id}${nameOf(CTX.sw, c.id) ? " « " + nameOf(CTX.sw, c.id) + " »" : ""} → ${{ on: "activé", off: "désactivé", toggle: "inversé" }[c.v]}` },
    var: { ic: "🔢", n: "Variable", f: [{ k: "id", l: "Variable n°", t: "var" }, { k: "op", l: "Opération", t: "sel", o: [["=", "Mettre à ="], ["+", "Ajouter +"], ["-", "Soustraire −"], ["*", "Multiplier ×"], ["/", "Diviser ÷"], ["%", "Reste (modulo)"]], def: "=" },
      { k: "src", l: "Valeur", t: "sel", o: [["const", "Constante"], ["random", "Nombre aléatoire"], ["var", "Une autre variable"]], def: "const", re: true },
      { k: "val", l: "Valeur", t: "num", def: 1, show: c => c.src === "const" }, { k: "min", l: "Minimum", t: "num", def: 1, show: c => c.src === "random" }, { k: "max", l: "Maximum", t: "num", def: 6, show: c => c.src === "random" }, { k: "vid", l: "Variable n°", t: "var", show: c => c.src === "var" }],
      sum: c => `Variable #${c.id}${nameOf(CTX.vars, c.id) ? " « " + nameOf(CTX.vars, c.id) + " »" : ""} ${c.op} ${c.src === "const" ? c.val : c.src === "random" ? `aléatoire(${c.min}…${c.max})` : "variable #" + c.vid}` },
    self: { ic: "🔹", n: "Interrupteur local", f: [{ k: "ss", l: "Interrupteur local", t: "sel", o: SSF, def: "A" }, { k: "v", l: "Mettre à", t: "sel", o: [["on", "Activé"], ["off", "Désactivé"]], def: "on" }], sum: c => `Interrupteur local ${c.ss} → ${c.v === "on" ? "activé" : "désactivé"}` },
    common: { ic: "🔁", n: "Appeler un événement commun", f: [{ k: "id", l: "Événement commun", t: "sel", src: "common" }], sum: c => "Événement commun : " + (nameOf(CTX.common, c.id) || c.id || "(aucun)") },
    wait: { ic: "⏱", n: "Attendre", f: [{ k: "sec", l: "Secondes", t: "num", min: 0, max: 600, step: .1, def: 1 }], sum: c => `Attendre ${c.sec} s` },
    comment: { ic: "📝", n: "Commentaire", f: [{ k: "text", l: "Texte", t: "text", area: true }], sum: c => "// " + (c.text || "").split("\n")[0] },
    exit: { ic: "⛔", n: "Arrêter l'event", f: [], sum: () => "Arrêter l'exécution" },
    teleport: { ic: "🚪", n: "Téléporter le héros", f: [{ k: "map", l: "Map", t: "sel", src: "maps" }, { k: "x", l: "X", t: "num", min: 0, def: 1 }, { k: "y", l: "Y", t: "num", min: 0, def: 1 }, { k: "dir", l: "Direction", t: "sel", o: [["keep", "Inchangée"], ["0", "Bas"], ["1", "Gauche"], ["2", "Droite"], ["3", "Haut"]], def: "keep" }, { k: "fade", l: "Fondu", t: "sel", o: [["black", "Noir"], ["white", "Blanc"], ["none", "Aucun"]], def: "black" }],
      sum: c => `Téléporter → ${nameOf(CTX.maps, c.map) || c.map || "?"} (${c.x},${c.y})` },
    screen: { ic: "🎬", n: "Effet d'écran", f: [{ k: "kind", l: "Effet", t: "sel", o: [["fadeout", "Fondu vers le noir"], ["fadein", "Retour depuis le noir"], ["tint", "Teinte de l'écran"], ["flash", "Flash"], ["shake", "Secousse"]], def: "tint", re: true },
      { k: "col", l: "Couleur", t: "col", def: "#0b1e5a", show: c => c.kind === "tint" || c.kind === "flash" }, { k: "op", l: "Intensité (%)", t: "num", min: 0, max: 100, def: 40, show: c => c.kind === "tint" || c.kind === "flash" },
      { k: "power", l: "Force", t: "num", min: 1, max: 9, def: 5, show: c => c.kind === "shake" }, { k: "sec", l: "Durée (s)", t: "num", min: 0, step: .1, def: 1 }, { k: "wait", l: "Attendre la fin", t: "chk", def: true }], sum: c => "Écran : " + c.kind },
    weather: { ic: "🌦", n: "Changer la météo", f: [{ k: "id", l: "Météo", t: "sel", src: "meteo" }, { k: "fade", l: "Transition (s)", t: "num", min: 0, step: .5, def: 3 }], sum: c => "Météo : " + (c.id ? (nameOf(CTX.meteo, c.id) || c.id) : "ciel dégagé") },
    battle: { ic: "⚔️", n: "Lancer un combat", f: [{ k: "group", l: "Groupe d'ennemis n°", t: "num", min: 1, def: 1 }, { k: "escape", l: "Fuite possible", t: "chk", def: true }, { k: "lose", l: "En cas de défaite", t: "sel", o: [["gameover", "Game over"], ["continue", "Continuer l'event"]], def: "gameover" }], sum: c => `Combat : groupe #${c.group}${c.escape ? "" : " (sans fuite)"}` },
    encounters: { ic: "🚫", n: "Combats aléatoires", f: [{ k: "on", l: "Combats aléatoires activés", t: "chk", def: false }], sum: c => "Combats aléatoires : " + (c.on ? "activés" : "désactivés") },
    music: { ic: "🎵", n: "Jouer une musique", f: [{ k: "file", l: "Fichier", t: "sel", src: "audio" }, { k: "vol", l: "Volume (%)", t: "num", min: 0, max: 100, def: 80 }, { k: "pitch", l: "Hauteur (%)", t: "num", min: 50, max: 150, def: 100 }, { k: "fade", l: "Fondu d'entrée (s)", t: "num", min: 0, step: .5, def: 1 }], sum: c => "Musique : " + (c.file || "(aucune)") },
    stopmusic: { ic: "🔇", n: "Arrêter la musique", f: [{ k: "fade", l: "Fondu de sortie (s)", t: "num", min: 0, step: .5, def: 1 }], sum: c => `Arrêter la musique (${c.fade} s)` },
    sound: { ic: "🔊", n: "Jouer un son", f: [{ k: "file", l: "Fichier", t: "sel", src: "audio" }, { k: "vol", l: "Volume (%)", t: "num", min: 0, max: 100, def: 90 }, { k: "pitch", l: "Hauteur (%)", t: "num", min: 50, max: 150, def: 100 }], sum: c => "Son : " + (c.file || "(aucun)") },
    graphic: { ic: "🖼", n: "Changer l'apparence de l'event", f: [{ k: "char", l: "Character", t: "sel", src: "chars" }, { k: "r", l: "Direction", t: "sel", o: DIRS, def: "0" }, { k: "c", l: "Frame (colonne, dès 0)", t: "num", min: 0, def: 0 }], sum: c => "Apparence : " + (nameOf(CTX.chars, c.char) || "aucune") },
    transp: { ic: "👻", n: "Rendre transparent / visible", f: [{ k: "on", l: "Transparent", t: "chk", def: true }], sum: c => c.on ? "Devenir transparent" : "Devenir visible" },
    erase: { ic: "🗑", n: "Effacer cet event (jusqu'au changement de map)", f: [], sum: () => "Effacer cet event" },
    showImage: { ic: "🖼", n: "Afficher une image", f: [
      { k: "n", l: "Numéro d'image (1 à 50, pour la retrouver)", t: "num", min: 1, max: 50, def: 1 }, { k: "file", l: "Image", t: "sel", src: "images" },
      { h: "Position" },
      { k: "mode", l: "Fixée à…", t: "sel", re: true, o: [["screen", "L'écran (ne bouge pas)"], ["map", "La map (défile avec elle)"], ["event", "Un event (le suit)"]], def: "screen" },
      { k: "ev", l: "Event ID (0 = cet event)", t: "num", min: 0, def: 0, show: c => c.mode === "event" },
      { k: "origin", l: "Point d'ancrage", t: "sel", o: [["tl", "Coin haut-gauche"], ["c", "Centre"], ["bc", "Bas-centre"]], def: "tl" },
      { k: "x", l: "X (px)", t: "num", def: 0 }, { k: "y", l: "Y (px)", t: "num", def: 0 },
      { h: "Apparence" },
      { k: "scale", l: "Échelle (%)", t: "num", min: 1, max: 1000, def: 100 }, { k: "flip", l: "Miroir horizontal", t: "chk", def: false },
      { k: "rot", l: "Rotation (°)", t: "num", def: 0 }, { k: "spin", l: "Rotation continue (° par seconde, 0 = aucune)", t: "num", def: 0 },
      { k: "opacity", l: "Opacité (%)", t: "num", min: 0, max: 100, def: 100 }, { k: "blend", l: "Mode de fusion", t: "sel", o: BLEND, def: "normal" },
      { k: "layer", l: "Profondeur d'affichage", t: "sel", o: [["under", "Sous les events"], ["over", "Au-dessus des events"], ["ui", "Au-dessus de tout (même des fenêtres)"]], def: "over" },
      { k: "fade", l: "Apparition en fondu (s)", t: "num", min: 0, step: .1, def: 0 },
      { h: "Effets" }, { k: "fx", l: "Effets appliqués à l'image", t: "multi", src: "fx" }],
      sum: c => `Image n°${c.n} : ${c.file || "(aucune)"} — ${{ screen: "écran", map: "map", event: "event " + c.ev }[c.mode]}, ${c.scale}%${c.rot ? ", rot " + c.rot + "°" : ""}${c.spin ? ", tourne " + c.spin + "°/s" : ""}` },
    moveImage: { ic: "➡️", n: "Déplacer / transformer une image", f: [
      { k: "n", l: "Numéro d'image", t: "num", min: 1, max: 50, def: 1 }, { k: "rel", l: "Valeurs relatives (ajoutées à la position actuelle)", t: "chk", def: false },
      { k: "x", l: "X (px)", t: "num", def: 0 }, { k: "y", l: "Y (px)", t: "num", def: 0 }, { k: "scale", l: "Échelle (%)", t: "num", def: 100 }, { k: "rot", l: "Rotation (°)", t: "num", def: 0 }, { k: "opacity", l: "Opacité (%)", t: "num", min: 0, max: 100, def: 100 },
      { h: "Durée" }, { k: "time", l: "Durée du mouvement (secondes)", t: "num", min: 0, step: .1, def: 1 }, { k: "ease", l: "Type de mouvement", t: "sel", o: EASE, def: "inout" },
      { k: "yoyo", l: "Aller-retour", t: "chk", def: false }, { k: "repeat", l: "Répétitions (0 = une fois, -1 = sans fin)", t: "num", min: -1, def: 0 }, { k: "wait", l: "Attendre la fin avant de continuer", t: "chk", def: true }],
      sum: c => `Image n°${c.n} → ${c.rel ? "décaler de " : ""}(${c.x},${c.y}), ${c.scale}%, ${c.rot}° en ${c.time} s${c.yoyo ? ", aller-retour" : ""}${c.repeat ? ", ×" + (c.repeat < 0 ? "∞" : c.repeat + 1) : ""}` },
    rotateImage: { ic: "🔄", n: "Faire tourner une image", f: [{ k: "n", l: "Numéro d'image", t: "num", min: 1, max: 50, def: 1 }, { k: "speed", l: "Vitesse (° par seconde, négatif = sens inverse)", t: "num", def: 90 }, { k: "time", l: "Pendant (secondes, 0 = jusqu'à l'arrêt)", t: "num", min: 0, step: .5, def: 0 }, { k: "wait", l: "Attendre la fin", t: "chk", def: false, show: c => c.time > 0 }],
      sum: c => `Image n°${c.n} tourne à ${c.speed}°/s${c.time ? " pendant " + c.time + " s" : ""}` },
    eraseImage: { ic: "🚮", n: "Effacer une image", f: [{ k: "n", l: "Numéro d'image (0 = toutes)", t: "num", min: 0, max: 50, def: 1 }, { k: "fade", l: "Disparition en fondu (s)", t: "num", min: 0, step: .1, def: 0 }], sum: c => `Effacer ${c.n ? "l'image n°" + c.n : "toutes les images"}` },
    applyEffect: { ic: "✨", n: "Appliquer des effets", f: [
      { k: "target", l: "Sur", t: "sel", o: FXT, def: "hero", re: true }, { k: "id", l: "Event ID", t: "num", min: 0, def: 0, show: c => c.target === "event" }, { k: "n", l: "Image n°", t: "num", min: 1, max: 50, def: 1, show: c => c.target === "image" },
      { k: "fx", l: "Effets (plusieurs possibles)", t: "multi", src: "fx" },
      { k: "mode", l: "Effets déjà présents", t: "sel", o: [["add", "Les garder (ajouter)"], ["replace", "Les remplacer"]], def: "add" },
      { k: "time", l: "Durée (s, 0 = celle de l'effet)", t: "num", min: 0, step: .5, def: 0 }],
      sum: c => `Effets sur ${{ hero: "le héros", self: "cet event", event: "l'event " + c.id, image: "l'image n°" + c.n, screen: "l'écran" }[c.target]} : ${arr(c.fx).map(i => nameOf(CTX.fx, i) || i).join(" + ") || "(aucun)"}` },
    clearEffects: { ic: "🧹", n: "Retirer des effets", f: [
      { k: "target", l: "Sur", t: "sel", o: FXT, def: "hero", re: true }, { k: "id", l: "Event ID", t: "num", min: 0, def: 0, show: c => c.target === "event" }, { k: "n", l: "Image n°", t: "num", min: 1, max: 50, def: 1, show: c => c.target === "image" },
      { k: "fx", l: "Effets à retirer (aucun coché = tous)", t: "multi", src: "fx" }, { k: "fade", l: "Retrait progressif (s)", t: "num", min: 0, step: .5, def: 0 }],
      sum: c => `Retirer ${arr(c.fx).length ? arr(c.fx).map(i => nameOf(CTX.fx, i) || i).join(" + ") : "tous les effets"} ${{ hero: "du héros", self: "de cet event", event: "de l'event " + c.id, image: "de l'image n°" + c.n, screen: "de l'écran" }[c.target]}` }
  };
  const GROUPS = [["Messages", ["message", "choices"]], ["Logique", ["if", "sw", "var", "self", "common", "wait", "comment", "exit"]], ["Scène", ["teleport", "screen", "weather", "battle", "encounters"]], ["Audio", ["music", "stopmusic", "sound"]], ["Event", ["graphic", "transp", "erase"]], ["Images et effets", ["showImage", "moveImage", "rotateImage", "eraseImage", "applyEffect", "clearEffects"]]];
  function condText(c) { if (c.ct === "var") return `variable #${c.vid}${nameOf(CTX.vars, c.vid) ? " «" + nameOf(CTX.vars, c.vid) + "»" : ""} ${c.op} ${c.vk === "var" ? "variable #" + c.vid2 : c.val}`; if (c.ct === "self") return `interrupteur local ${c.ss} est ${c.on ? "activé" : "désactivé"}`; return `interrupteur #${c.id}${nameOf(CTX.sw, c.id) ? " «" + nameOf(CTX.sw, c.id) + "»" : ""} est ${c.on ? "activé" : "désactivé"}`; }
  function cmdDialog(type, orig) {
    const d = CMD[type], c = clone(orig || { t: type });
    if (type === "choices") c.labels = (c.opts || [{ label: "Oui" }, { label: "Non" }]).map(o => o.label).join("\n");
    if (!d.f.length) return Promise.resolve(c);
    const b = form(d.f, c);
    return dialog(`${d.ic} ${d.n}`, b, { style: "width:540px;max-width:94vw" }).then(ok => {
      if (!ok) return null;
      if (type === "choices") { const L = c.labels.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 6); while (L.length < 2) L.push("Option " + (L.length + 1)); const old = (orig && orig.opts) || []; c.opts = L.map((label, i) => ({ label, cmds: old[i] ? old[i].cmds : [] })); delete c.labels; }
      if (type === "if") { c.then = c.then || []; c.else = c.else || []; }
      return c;
    });
  }
  // ---------- éditeur de commandes (arbre)
  async function cmdEditor(el, root, o = {}) {
    css(); await ctxLoad();
    const ui = document.createElement("div"); ui.className = "ev-cmd ev-ed"; let sel = null, R = [];
    ui.innerHTML = `<div class="ev-tb"><select class="ins"><option value="">＋ Insérer une commande…</option>${GROUPS.map(g => `<optgroup label="${g[0]}">${g[1].map(t => `<option value="${t}">${CMD[t].ic} ${CMD[t].n}</option>`).join("")}</optgroup>`).join("")}</select><button class="g" data-b="edit">✏ Modifier</button><button class="g" data-b="dup">⧉</button><button class="g" data-b="up">▲</button><button class="g" data-b="dn">▼</button><button class="r" data-b="del">🗑</button></div><div class="ev-rows" tabindex="0"></div>`;
    el.appendChild(ui); const box = ui.querySelector(".ev-rows"), chg = () => o.onChange && o.onChange();
    function collect(list, depth, out) {
      list.forEach((c, i) => { out.push({ k: "c", list, i, c, depth });
        if (c.t === "if") { collect(c.then, depth + 1, out); if (c.hasElse) { out.push({ k: "lab", depth, txt: "◆ Sinon" }); collect(c.else, depth + 1, out); } out.push({ k: "lab", depth, txt: "◆ Fin de la condition" }); }
        else if (c.t === "choices") { c.opts.forEach(op => { out.push({ k: "lab", depth, txt: `◆ Si « ${op.label} »` }); collect(op.cmds, depth + 1, out); }); out.push({ k: "lab", depth, txt: "◆ Fin des choix" }); } });
      out.push({ k: "add", list, i: list.length, depth });
    }
    function draw() {
      R = []; collect(root, 0, R); const keep = sel ? R.findIndex(r => r.k !== "lab" && r.list === sel.list && r.i === sel.i && (r.k === sel.k)) : -1;
      box.innerHTML = R.map((r, n) => `<div class="ev-r ${r.k}${n === keep ? " on" : ""}" data-n="${n}" style="padding-left:${6 + r.depth * 18}px">${r.k === "c" ? `${CMD[r.c.t].ic} ${E(CMD[r.c.t].sum(r.c))}` : r.k === "add" ? "◇" : E(r.txt)}</div>`).join("");
    }
    const target = () => { if (!sel) return { list: root, at: root.length }; return sel.k === "add" ? { list: sel.list, at: sel.i } : { list: sel.list, at: sel.i + 1 }; };
    box.onclick = e => { const r = R[+(e.target.closest(".ev-r") || {}).dataset?.n]; if (!r || r.k === "lab") return; sel = { list: r.list, i: r.i, k: r.k }; draw(); };
    box.ondblclick = e => { const r = R[+(e.target.closest(".ev-r") || {}).dataset?.n]; if (r && r.k === "c") edit(); };
    box.onkeydown = e => { if (e.key === "Delete") del(); else if (e.key === "Enter") edit(); };
    ui.querySelector(".ins").onchange = async e => { const t = e.target.value; e.target.value = ""; if (!t) return; const c = await cmdDialog(t, null); if (!c) return; if (t === "if") { c.then = []; c.else = []; } const { list, at } = target(); list.splice(at, 0, c); sel = { list, i: at, k: "c" }; draw(); chg(); };
    async function edit() { if (!sel || sel.k !== "c") return; const c = sel.list[sel.i], r = await cmdDialog(c.t, c); if (!r) return; Object.keys(c).forEach(k => delete c[k]); Object.assign(c, r); draw(); chg(); }
    function del() { if (!sel || sel.k !== "c") return; sel.list.splice(sel.i, 1); sel = null; draw(); chg(); }
    ui.querySelector(".ev-tb").onclick = e => { const b = e.target.dataset.b; if (!b) return; if (b === "edit") edit(); else if (b === "del") del(); else if (sel && sel.k === "c") { const { list, i } = sel;
      if (b === "dup") { list.splice(i + 1, 0, clone(list[i])); sel = { list, i: i + 1, k: "c" }; } else if (b === "up" && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; sel = { list, i: i - 1, k: "c" }; } else if (b === "dn" && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; sel = { list, i: i + 1, k: "c" }; } draw(); chg(); } };
    draw(); return { redraw: draw };
  }
  // ---------- éditeur d'event (pages + conditions + commandes)
  const TRIG = [["action", "Touche d'action"], ["contact_hero", "Contact avec le héros"], ["contact_event", "Contact de l'event avec le héros"], ["auto", "Automatique"], ["parallel", "Processus parallèle"], ["none", "Aucun (simple décor)"]];
  const PAGE_FIELDS = [
    { h: "Conditions d'apparition de cette page" },
    { k: "cond.sw1on", l: "Interrupteur activé", t: "chk" }, { k: "cond.sw1", l: "  n°", t: "sw" },
    { k: "cond.sw2on", l: "Et un autre interrupteur", t: "chk" }, { k: "cond.sw2", l: "  n°", t: "sw" },
    { k: "cond.von", l: "Variable", t: "chk" }, { k: "cond.v", l: "  n°", t: "var" }, { k: "cond.vop", l: "  doit être", t: "sel", o: OPS }, { k: "cond.vval", l: "  valeur", t: "num" },
    { k: "cond.son", l: "Interrupteur local activé", t: "chk" }, { k: "cond.ss", l: "  lequel", t: "sel", o: SSF },
    { h: "Apparence" },
    { k: "g.char", l: "Character", t: "sel", src: "chars", re: false }, { k: "g.r", l: "Direction", t: "sel", o: DIRS, def: "0" }, { k: "g.c", l: "Frame (colonne, dès 0)", t: "num", min: 0 },
    { k: "g.img", l: "…ou une image (remplace le character)", t: "sel", src: "images", re: true },
    { k: "g.scale", l: "Échelle de l'image (%)", t: "num", min: 1, max: 1000, def: 100, show: p => p.g.img }, { k: "g.rot", l: "Rotation (°)", t: "num", def: 0, show: p => p.g.img }, { k: "g.spin", l: "Rotation continue (°/s)", t: "num", def: 0, show: p => p.g.img },
    { k: "g.op", l: "Opacité (%)", t: "num", min: 0, max: 100, def: 100, show: p => p.g.img }, { k: "g.blend", l: "Mode de fusion", t: "sel", o: BLEND, def: "normal", show: p => p.g.img },
    { h: "Effets visuels permanents" }, { k: "fx", l: "Effets appliqués à cet event", t: "multi", src: "fx" },
    { h: "Priorité" },
    { k: "p.hero", l: "Par rapport au héros", t: "sel", o: [["dessous", "Sous le héros"], ["meme", "Au même niveau que le héros"], ["dessus", "Au-dessus du héros"]] },
    { k: "p.tiles", l: "Par rapport au décor", t: "sel", o: [["dessous", "Sous les éléments du décor"], ["meme", "Au même niveau que le décor"], ["dessus", "Au-dessus des éléments du décor"]] },
    { h: "Mouvement" },
    { k: "mv.type", l: "Type", t: "sel", o: [["fixed", "Fixe"], ["random", "Aléatoire"], ["toward", "Se rapproche du héros"], ["away", "Fuit le héros"]] },
    { k: "mv.speed", l: "Vitesse (1 lent – 6 rapide)", t: "num", min: 1, max: 6 }, { k: "mv.freq", l: "Fréquence (1 – 5)", t: "num", min: 1, max: 5 },
    { h: "Options" },
    { k: "o.walk", l: "Animation de marche", t: "chk" }, { k: "o.step", l: "Animation sur place", t: "chk" }, { k: "o.dirfix", l: "Direction fixe", t: "chk" }, { k: "o.through", l: "Traversable", t: "chk" }, { k: "o.transp", l: "Transparent (invisible)", t: "chk" },
    { h: "Déclenchement" }, { k: "trig", l: "Se déclenche", t: "sel", o: TRIG }
  ];
  async function mount(el, ev, o = {}) {
    css(); await ctxLoad(); ev.pages = ev.pages && ev.pages.length ? ev.pages : [page()]; let pi = 0;
    el.innerHTML = ""; const root = document.createElement("div"); root.className = "ev-ed"; el.appendChild(root);
    const chg = () => o.onChange && o.onChange(ev);
    root.innerHTML = `<div class="ev-head"><label>Nom</label><input type="text" class="nm" placeholder="Nom de l'event ou du PNJ"><span class="ev-id">ID : ${E(ev.id ?? "—")}</span><label>Note</label><input type="text" class="nt" placeholder="Remarque libre"></div><div class="ev-tabs"></div><div class="ev-body"><div class="ev-left"></div><div class="ev-right"></div></div>`;
    const nm = root.querySelector(".nm"), nt = root.querySelector(".nt"), tabs = root.querySelector(".ev-tabs"), L = root.querySelector(".ev-left"), Rr = root.querySelector(".ev-right");
    nm.value = ev.name || ""; nt.value = ev.note || ""; nm.oninput = () => { ev.name = nm.value; chg(); }; nt.oninput = () => { ev.note = nt.value; chg(); };
    function drawTabs() {
      tabs.innerHTML = ev.pages.map((p, i) => `<button class="${i === pi ? "on" : ""}" data-i="${i}">Page ${i + 1}</button>`).join("") + `<button class="g" data-a="add">＋ Page</button><button class="g" data-a="dup">⧉ Copier la page</button><button class="r" data-a="del">🗑 Supprimer la page</button>`;
    }
    tabs.onclick = e => { const b = e.target; if (b.dataset.i != null) pi = +b.dataset.i; else if (b.dataset.a === "add") { ev.pages.push(page()); pi = ev.pages.length - 1; chg(); } else if (b.dataset.a === "dup") { ev.pages.splice(pi + 1, 0, clone(ev.pages[pi])); pi++; chg(); } else if (b.dataset.a === "del") { if (ev.pages.length < 2) return; if (!confirm("Supprimer cette page ?")) return; ev.pages.splice(pi, 1); pi = Math.max(0, pi - 1); chg(); } else return; renderPage(); };
    async function preview(cv) { const g = ev.pages[pi].g, c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height); if (g.img) { try { const im = await Chars.loadImg(Studio.assets("images").url(g.img)), k = Math.min(cv.width / im.width, cv.height / im.height, 1); c.drawImage(im, (cv.width - im.width * k) / 2, (cv.height - im.height * k) / 2, im.width * k, im.height * k); } catch (e) {} return; } const ch = await charGet(g.char); if (!ch) return; const s = ch.data, k = Math.min(cv.width / s.fw, cv.height / s.fh); c.imageSmoothingEnabled = false; c.drawImage(ch.img, (g.c || 0) * s.fw, (+g.r || 0) * s.fh, s.fw, s.fh, (cv.width - s.fw * k) / 2, cv.height - s.fh * k, s.fw * k, s.fh * k); }
    function renderPage() {
      drawTabs(); const p = ev.pages[pi]; L.innerHTML = ""; Rr.innerHTML = "";
      const cv = document.createElement("canvas"); cv.width = 96; cv.height = 96; cv.className = "ev-pv";
      let last = p.g.char; const f = form(PAGE_FIELDS, p, async () => { if (p.g.char !== last) { last = p.g.char; const ch = await charGet(p.g.char); p.g.r = "0"; p.g.c = ch && ch.data.format === "mz" ? 1 : 0; f.querySelectorAll('select,input').forEach(() => 0); renderPage(); } preview(cv); chg(); });
      // l'aperçu est inséré juste après le titre « Apparence »
      L.appendChild(f); const hs = [...f.querySelectorAll("h5")].find(h => h.textContent === "Apparence"); if (hs) hs.after(cv); preview(cv);
      cmdEditor(Rr, p.cmds, { onChange: chg });
    }
    renderPage(); return { redraw: renderPage };
  }
  async function modal(ev, o = {}) {
    css(); await ctxLoad(true); const c = clone(ev); c.pages = c.pages && c.pages.length ? c.pages : [page()];
    const host = document.createElement("div"); host.style.cssText = "width:min(1100px,92vw);height:74vh"; await mount(host, c);
    const ok = await dialog(o.title || "Éditer l'event", host, { style: "width:min(1140px,96vw)" }); return ok ? c : null;
  }
  // ---------- index d'utilisation (où sont utilisés interrupteurs, variables, interrupteurs locaux)
  async function usage() {
    const idx = {}, add = (k, w) => { (idx[k] = idx[k] || []).push(w); };
    const cmds = (list, w) => arr(list).forEach(c => {
      if (c.t === "message" && c.face) add("img:" + c.face, w + " — visage de message");
      else if (c.t === "showImage") { add("img:" + c.file, w + " — commande Afficher une image"); arr(c.fx).forEach(i => add("fx:" + i, w + " — image n°" + c.n)); }
      else if (c.t === "applyEffect" || c.t === "clearEffects") arr(c.fx).forEach(i => add("fx:" + i, w + " — commande " + (c.t === "applyEffect" ? "Appliquer" : "Retirer") + " des effets"));
      else if (c.t === "sw") add("sw:" + c.id, w + " — commande Interrupteur");
      else if (c.t === "var") { add("var:" + c.id, w + " — commande Variable"); if (c.src === "var") add("var:" + c.vid, w + " — lue par une commande Variable"); }
      else if (c.t === "self") add("self:" + c.ss, w + " — commande Interrupteur local");
      else if (c.t === "common") add("common:" + c.id, w + " — appel");
      else if (c.t === "if") { if (c.ct === "sw") add("sw:" + c.id, w + " — condition"); else if (c.ct === "self") add("self:" + c.ss, w + " — condition"); else { add("var:" + c.vid, w + " — condition"); if (c.vk === "var") add("var:" + c.vid2, w + " — condition"); } cmds(c.then, w); cmds(c.else, w); }
      else if (c.t === "choices") arr(c.opts).forEach(o => cmds(o.cmds, w));
    });
    const ev = (e, w) => arr(e.pages).forEach((p, i) => { const ww = `${w} (page ${i + 1})`, c = p.cond || {};
      if (c.sw1on) add("sw:" + c.sw1, ww + " — condition d'apparition"); if (c.sw2on) add("sw:" + c.sw2, ww + " — condition d'apparition");
      if (c.von) add("var:" + c.v, ww + " — condition d'apparition"); if (c.son) add("self:" + c.ss, ww + " — condition d'apparition"); if (p.g && p.g.img) add("img:" + p.g.img, ww + " — apparence de l'event"); arr(p.fx).forEach(i => add("fx:" + i, ww + " — effet permanent")); cmds(p.cmds, ww); });
    const g = async f => { try { return arr(await f()); } catch (e) { return []; } };
    (await g(() => Studio.col("maps", "map").getAll())).forEach(m => arr(m.events).forEach(e => ev(e, `Map « ${m.name || m.id} » — event « ${e.name || e.id} »`)));
    (await g(() => Studio.col("events", "event").getAll())).forEach(e => ev(e, `Modèle d'event « ${e.name || e.id} »`));
    (await g(() => Studio.col("evcommuns", "evcommun").getAll())).forEach(e => { const w = `Événement commun « ${e.name || e.id} »`, t = e.trigger || {};
      if (["switch", "both"].includes(t.cond) || t.type === "switch") add("sw:" + t.sw, w + " — déclencheur"); if (["variable", "both"].includes(t.cond) || t.type === "variable") add("var:" + t.var, w + " — déclencheur"); cmds(e.cmds, w); });
    return idx;
  }
  // ---------- renommer une image : met à jour toutes les références (maps, modèles, événements communs)
  async function renameImage(oldN, newN) {
    let n = 0; const fixCmds = l => arr(l).forEach(c => { if (c.t === "message" && c.face === oldN) { c.face = newN; n++; } else if (c.t === "showImage" && c.file === oldN) { c.file = newN; n++; } else if (c.t === "if") { fixCmds(c.then); fixCmds(c.else); } else if (c.t === "choices") arr(c.opts).forEach(o => fixCmds(o.cmds)); });
    const fixEv = e => { const b = n; arr(e.pages).forEach(p => { if (p.g && p.g.img === oldN) { p.g.img = newN; n++; } fixCmds(p.cmds); }); return n !== b; };
    const g = async f => { try { return arr(await f()); } catch (e) { return []; } };
    const M = Studio.col("maps", "map"), V = Studio.col("events", "event"), K = Studio.col("evcommuns", "evcommun");
    for (const m of await g(() => M.getAll())) { let ch = false; arr(m.events).forEach(e => { if (fixEv(e)) ch = true; }); if (ch) await M.save(m.id, m); }
    for (const e of await g(() => V.getAll())) if (fixEv(e)) await V.save(e.id, e);
    for (const e of await g(() => K.getAll())) { const b = n; fixCmds(e.cmds); if (n !== b) await K.save(e.id, e); }
    return n;
  }
  window.Events = { renameImage, usage, form, dialog, ctxLoad, ctx: CTX, blank, page, mount, modal, cmdEditor, charGet, CMD, summary: ev => `${(ev.pages || []).length} page(s), ${(ev.pages || []).reduce((n, p) => n + (p.cmds || []).length, 0)} commande(s)` };
})();
