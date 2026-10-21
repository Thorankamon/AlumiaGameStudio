/* © 2026 thorankamon — Tous droits réservés.
   studio-chars.js — partagé par « Édition des Characters » et « Gestion des Characters ».
   À inclure APRÈS studio-api.js :  <script src="studio-api.js"></script><script src="studio-chars.js"></script>

   Un character (collection « characters », images dans assets/characters/) :
   { name, image, format:"xp"|"mz"|"libre", fw, fh, cols, rows,   // feuille principale
     scale:100,                                                    // taille dans le jeu en %
     sheets:[{id,name,image,format,fw,fh,cols,rows}],              // images supplémentaires
     anims:[{name,fps,loop,frames:[{s:"main"|id, c, r, d:1, fx:false}]}] }
   Lignes d'une feuille de marche : 0 = bas, 1 = gauche, 2 = droite, 3 = haut. */
(function () {
  const PRESETS = {
    xp:    { label: "RPG Maker XP — 4 colonnes × 4 lignes (frames 32×48)", fw: 32, fh: 48, cols: 4, rows: 4 },
    mz:    { label: "RPG Maker MZ — 3 colonnes × 4 lignes (frames 48×48)", fw: 48, fh: 48, cols: 3, rows: 4 },
    libre: { label: "Libre — tu choisis la taille et le nombre de frames", fw: 32, fh: 32, cols: 4, rows: 4 }
  };
  const DIRS = ["bas", "gauche", "droite", "haut"];
  const walk = (f, cols) => (f === "mz" && cols === 3) ? [1, 0, 1, 2] : Array.from({ length: cols }, (_, i) => i);
  const idle = (f, cols) => f === "mz" ? [Math.min(1, cols - 1)] : [0];

  const Chars = {
    PRESETS, DIRS, walk, idle,
    col: () => Studio.col("characters", "character"),
    assets: () => Studio.assets("characters"),
    defaultAnims(format, cols, rows) {
      const a = [];
      for (let r = 0; r < Math.min(4, rows); r++) {
        a.push({ name: "Marche " + DIRS[r], fps: 8, loop: true, frames: walk(format, cols).map(c => ({ s: "main", c, r, d: 1, fx: false })) });
        a.push({ name: "Immobile " + DIRS[r], fps: 1, loop: true, frames: idle(format, cols).map(c => ({ s: "main", c, r, d: 1, fx: false })) });
      }
      return a;
    },
    // Fenêtre de création / d'ajout. o = {title, name:true|false, file:"none"|"optional"|"required"}
    dialog(o) {
      return new Promise(res => {
        if (!document.getElementById("chm-css")) {
          const st = document.createElement("style"); st.id = "chm-css";
          st.textContent = ".chm{position:fixed;inset:0;background:#0008;display:flex;align-items:center;justify-content:center;z-index:99;font:13px Segoe UI,system-ui,sans-serif;color:#1e293b}.chb{background:#fff;border-radius:12px;padding:18px;width:400px;max-width:94vw}.chb h3{margin-bottom:10px}.chb label{display:block;margin:7px 0 2px;color:#475569}.chb input[type=text],.chb input[type=number],.chb select{width:100%;padding:5px 7px;border:1px solid #cbd5e1;border-radius:6px;font:inherit}.chg{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}.chr{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.chr button{border:0;border-radius:6px;padding:6px 14px;cursor:pointer;color:#fff;background:#3b82f6;font:inherit}.chr button.g{background:#64748b}";
          document.head.appendChild(st);
        }
        const d = document.createElement("div"); d.className = "chm";
        d.innerHTML = `<div class="chb"><h3>${o.title || "Nouveau character"}</h3>
          ${o.name === false ? "" : '<label>Nom<input type="text" id="cn"></label>'}
          ${o.file && o.file !== "none" ? `<label>Image ${o.file === "required" ? "" : "(facultative — sinon une feuille vierge est créée)"}<input type="file" id="cf" accept="image/*"></label>` : ""}
          <label>Format</label><select id="cfm">${Object.keys(PRESETS).map(k => `<option value="${k}">${PRESETS[k].label}</option>`).join("")}</select>
          <div class="chg" id="cfree" hidden><div><label>Largeur d'une frame (px)</label><input type="number" id="cfw" min="4" max="512"></div><div><label>Hauteur d'une frame (px)</label><input type="number" id="cfh" min="4" max="512"></div>
          <div><label>Colonnes (frames)</label><input type="number" id="cco" min="1" max="64"></div><div><label>Lignes</label><input type="number" id="cro" min="1" max="64"></div></div>
          <div class="chr"><button class="g" id="cno">Annuler</button><button id="cok">OK</button></div></div>`;
        document.body.appendChild(d);
        const $ = i => d.querySelector("#" + i), fill = () => { const p = PRESETS[$("cfm").value]; $("cfw").value = p.fw; $("cfh").value = p.fh; $("cco").value = p.cols; $("cro").value = p.rows; $("cfree").hidden = $("cfm").value !== "libre"; };
        $("cfm").onchange = fill; fill();
        if ($("cf") && $("cn")) $("cf").onchange = e => { const f = e.target.files[0]; if (f && !$("cn").value) $("cn").value = f.name.replace(/\.[^.]+$/, ""); };
        const close = v => { d.remove(); res(v); };
        $("cno").onclick = () => close(null);
        $("cok").onclick = () => {
          const file = $("cf") ? $("cf").files[0] : null, name = $("cn") ? $("cn").value.trim() : "";
          if ($("cn") && !name) return alert("Donne un nom.");
          if (o.file === "required" && !file) return alert("Choisis une image.");
          close({ name, file, format: $("cfm").value, fw: +$("cfw").value || 32, fh: +$("cfh").value || 32, cols: +$("cco").value || 4, rows: +$("cro").value || 4 });
        };
      });
    },
    // Fabrique (ou importe) une feuille et renvoie {image, format, fw, fh, cols, rows}
    async makeSheet(v, base) {
      let { format, fw, fh, cols, rows } = v;
      if (format !== "libre") { const p = PRESETS[format]; fw = p.fw; fh = p.fh; cols = p.cols; rows = p.rows; }
      let up;
      if (v.file) {
        const b = await createImageBitmap(v.file);
        if (format !== "libre") { fw = Math.max(1, Math.round(b.width / cols)); fh = Math.max(1, Math.round(b.height / rows)); }
        else { cols = Math.max(1, Math.floor(b.width / fw)); rows = Math.max(1, Math.floor(b.height / fh)); }
        up = await Chars.assets().upload(v.file);
      } else {
        if (cols * fw > 4096 || rows * fh > 4096) throw new Error("Image trop grande (maximum 4096 px).");
        const c = document.createElement("canvas"); c.width = cols * fw; c.height = rows * fh;
        const blob = await new Promise(r => c.toBlob(r, "image/png"));
        up = await Chars.assets().upload(blob, (base || "character").replace(/[^\w \-.]/g, "_").slice(0, 60) + ".png");
      }
      return { image: up.name, format, fw, fh, cols, rows };
    },
    async create(v) {
      const sh = await Chars.makeSheet(v, v.name);
      const r = await Chars.col().add({ name: v.name, ...sh, scale: 100, sheets: [], anims: Chars.defaultAnims(sh.format, sh.cols, sh.rows) });
      return r.id;
    },
    loadImg(u) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("Image introuvable")); i.src = u; }); }
  };
  window.Chars = Chars;
})();
