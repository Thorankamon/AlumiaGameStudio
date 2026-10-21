/* © 2026 thorankamon — Tous droits réservés.
   studio-lists.js — éditeur de listes (interrupteurs, variables, interrupteurs locaux).
   Données : doc « interrupteurs » [{id,name,group,initial,note}], doc « variables » [{id,name,group,initial,min,max,note}],
             doc « interrupteurs-locaux » [{id:"A",name,note}].  Lues par l'éditeur d'events (noms, sélecteurs). */
(function () {
  const E = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = n => String(n).padStart(4, "0");
  function css() {
    if (document.getElementById("ls-css")) return; const s = document.createElement("style"); s.id = "ls-css";
    s.textContent = `.ls{font:13px Segoe UI,system-ui,sans-serif;color:#1e293b;display:flex;flex-direction:column;height:100%;min-height:0}.ls *{box-sizing:border-box}
.ls button{background:#3b82f6;color:#fff;border:0;border-radius:6px;padding:5px 10px;cursor:pointer;font:inherit}.ls button.g{background:#64748b}.ls button.r{background:#ef4444}
.ls input[type=text],.ls input[type=number],.ls input[type=search],.ls select{padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#1e293b;font:inherit}
.ls-tb{display:flex;gap:8px;align-items:center;padding:8px 10px;background:#f1f5f9;border-bottom:1px solid #cbd5e1;flex-wrap:wrap}
.ls-main{flex:1;display:flex;min-height:0}.ls-w{flex:1;overflow:auto;background:#fff}.ls-side{width:340px;border-left:1px solid #cbd5e1;background:#f8fafc;overflow:auto;padding:10px;flex-shrink:0}
.ls table{border-collapse:collapse;width:100%}.ls th{position:sticky;top:0;background:#e2e8f0;text-align:left;padding:6px 8px;font-weight:600;z-index:1}.ls td{padding:3px 6px;border-bottom:1px solid #eef2f7}
.ls td.id{font:12px Consolas,monospace;color:#475569;width:60px}.ls td input[type=text]{width:100%;min-width:90px}.ls tr:hover td{background:#f8fafc}
.ls button.u{background:#e2e8f0;color:#1e293b;padding:2px 8px}.ls button.x{background:transparent;color:#ef4444;padding:2px 6px}
.ls-side h4{margin-bottom:6px}.ls-side ul{margin-left:16px}.ls-side li{margin:3px 0;color:#334155}.ls .hint{color:#64748b;font-size:12px}`;
    document.head.appendChild(s);
  }
  async function mount(cfg) {
    css(); const el = cfg.el; el.innerHTML = "";
    let items = await Studio.doc(cfg.doc, null), U = {}, q = "", grp = "";
    const defs = () => { const o = {}; cfg.cols.forEach(c => { o[c.k] = c.def !== undefined ? c.def : (c.t === "chk" ? false : c.t === "num" ? null : ""); }); return o; };
    if (!Array.isArray(items) || !items.length) { items = cfg.seed().map(id => ({ id, ...defs() })); await Studio.saveDoc(cfg.doc, items); }
    items.forEach(it => { const d = defs(); for (const k in d) if (it[k] === undefined) it[k] = d[k]; });
    const hasGroup = cfg.cols.some(c => c.k === "group");
    const root = document.createElement("div"); root.className = "ls"; el.appendChild(root);
    root.innerHTML = `<div class="ls-tb"><input type="search" class="q" placeholder="Rechercher…" style="width:200px">${hasGroup ? '<select class="gs"></select>' : ""}
      <button class="add">＋ ${cfg.noun}</button>${cfg.idMode === "int" ? '<button class="add" data-n="10">＋ 10</button><button class="add" data-n="50">＋ 50</button>' : ""}<button class="g" data-b="u">↻ Utilisations</button><button class="g" data-b="csv">⬇ Exporter (CSV)</button><span class="st hint"></span></div>
      <div class="ls-main"><div class="ls-w"><table><thead></thead><tbody></tbody></table></div><aside class="ls-side"><h4>Où est-il utilisé ?</h4><div class="uses hint">${E(cfg.hint || "")}<br><br>Clique sur « n × » d'une ligne pour voir où elle est utilisée.</div></aside></div><datalist id="grp"></datalist>`;
    const tb = root.querySelector("tbody"), st = root.querySelector(".st"), side = root.querySelector(".uses");
    root.querySelector("thead").innerHTML = `<tr><th>ID</th>${cfg.cols.map(c => `<th style="${c.w ? "width:" + c.w : ""}">${c.l}</th>`).join("")}<th>Utilisé</th><th></th></tr>`;
    const sorted = () => items.slice().sort((a, b) => cfg.idMode === "int" ? a.id - b.id : String(a.id).localeCompare(String(b.id)));
    const auto = Studio.autosave(async () => { try { await Studio.saveDoc(cfg.doc, sorted()); st.textContent = "✔ enregistré " + new Date().toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }); } catch (e) { st.textContent = "⚠ " + e.message; } }, 600);
    const touch = () => { st.textContent = "● modifié"; auto(); };
    function cell(it, c) { const v = it[c.k];
      if (c.t === "chk") return `<td><input type="checkbox" data-k="${c.k}" ${v ? "checked" : ""}></td>`;
      if (c.t === "num") return `<td><input type="number" data-k="${c.k}" value="${v ?? ""}" placeholder="${c.ph || ""}" style="width:90px"></td>`;
      return `<td><input type="text" data-k="${c.k}" value="${E(v)}" placeholder="${c.ph || ""}" ${c.k === "group" ? 'list="grp"' : ""}></td>`; }
    function groups() { const g = [...new Set(items.map(i => i.group).filter(Boolean))].sort(); root.querySelector("#grp").innerHTML = g.map(x => `<option value="${E(x)}">`).join("");
      const s = root.querySelector(".gs"); if (s) { s.innerHTML = '<option value="">Tous les groupes</option>' + g.map(x => `<option ${x === grp ? "selected" : ""}>${E(x)}</option>`).join(""); } }
    function draw() {
      const f = sorted().filter(it => (!grp || it.group === grp) && (!q || (String(it.id) + " " + (it.name || "") + " " + (it.note || "") + " " + (it.group || "")).toLowerCase().includes(q)));
      tb.innerHTML = f.map(it => { const n = (U[cfg.kind + ":" + it.id] || []).length;
        return `<tr data-id="${E(it.id)}"><td class="id">${cfg.idMode === "int" ? pad(it.id) : E(it.id)}</td>${cfg.cols.map(c => cell(it, c)).join("")}<td><button class="u" data-u="${E(it.id)}">${n ? n + " ×" : "—"}</button></td><td><button class="x" data-x="${E(it.id)}" title="Supprimer">🗑</button></td></tr>`; }).join("") || `<tr><td colspan="${cfg.cols.length + 3}" class="hint" style="padding:14px">Aucun résultat.</td></tr>`;
    }
    const find = id => items.find(i => String(i.id) === String(id));
    tb.addEventListener("input", e => { const tr = e.target.closest("tr"), it = tr && find(tr.dataset.id), k = e.target.dataset.k; if (!it || !k || e.target.type === "checkbox") return; it[k] = e.target.type === "number" ? (e.target.value === "" ? null : +e.target.value) : e.target.value; touch(); });
    tb.addEventListener("change", e => { const tr = e.target.closest("tr"), it = tr && find(tr.dataset.id), k = e.target.dataset.k; if (!it || !k) return; if (e.target.type === "checkbox") it[k] = e.target.checked; if (k === "group") groups(); touch(); });
    tb.addEventListener("click", async e => { const u = e.target.dataset.u, x = e.target.dataset.x;
      if (u != null) { const it = find(u), l = U[cfg.kind + ":" + u] || []; side.className = "uses"; side.innerHTML = `<b>${cfg.idMode === "int" ? "#" + pad(u) : u} ${E(it.name || "(sans nom)")}</b><br>` + (l.length ? `<ul>${l.map(w => `<li>${E(w)}</li>`).join("")}</ul>` : '<span class="hint">Pas encore utilisé nulle part.</span>'); }
      else if (x != null) { const it = find(x), n = (U[cfg.kind + ":" + x] || []).length;
        if (!confirm(`Supprimer « ${it.name || x} » ?` + (n ? `\n\n⚠ Utilisé ${n} fois : les events garderont ce numéro mais le nom sera perdu.` : ""))) return;
        items = items.filter(i => String(i.id) !== String(x)); touch(); groups(); draw(); } });
    root.querySelector(".q").oninput = e => { q = e.target.value.toLowerCase().trim(); draw(); };
    if (hasGroup) root.querySelector(".gs").onchange = e => { grp = e.target.value; draw(); };
    root.querySelectorAll(".add").forEach(b => b.onclick = () => { const n = +b.dataset.n || 1;
      if (cfg.idMode === "int") { let m = Math.max(0, ...items.map(i => +i.id)); for (let k = 0; k < n; k++) items.push({ id: ++m, ...defs() }); }
      else { const used = new Set(items.map(i => i.id)), l = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find(c => !used.has(c)); if (!l) return alert("Les 26 lettres sont déjà utilisées."); items.push({ id: l, ...defs() }); }
      touch(); groups(); draw(); tb.lastElementChild && tb.lastElementChild.scrollIntoView(); });
    async function refreshU() { st.textContent = "Analyse des utilisations…"; try { U = await Events.usage(); } catch (e) { U = {}; } st.textContent = ""; draw(); }
    root.querySelector('[data-b="u"]').onclick = refreshU;
    root.querySelector('[data-b="csv"]').onclick = () => { const q2 = v => '"' + String(v ?? "").replace(/"/g, '""') + '"', head = ["ID", ...cfg.cols.map(c => c.l)], rows = sorted().map(i => [i.id, ...cfg.cols.map(c => i[c.k])]);
      const blob = new Blob(["\ufeff" + [head, ...rows].map(r => r.map(q2).join(";")).join("\n")], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = cfg.doc + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
    window.addEventListener("beforeunload", () => { if (st.textContent.startsWith("●")) Studio.saveDoc(cfg.doc, sorted()); });
    groups(); draw(); refreshU();
  }
  window.Lists = { mount };
})();
