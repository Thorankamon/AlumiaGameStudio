/* © 2026 thorankamon — Tous droits réservés.
   studio-api.js — à inclure dans CHAQUE page du studio :
   <script src="studio-api.js"></script>
   (les pages doivent être ouvertes via http://localhost:8000/... avec serveur_studio.py lancé)

   EXEMPLES
   // Documents (petites listes : interrupteurs, variables, chronomètres…)
   const sw = await Studio.doc("interrupteurs", []);      // charge (ou [] si absent)
   await Studio.saveDoc("interrupteurs", sw);              // enregistre
   await Studio.deleteDoc("interrupteurs");                // supprime

   // Collections (un fichier par élément : maps, events, characters…)
   const maps = Studio.col("maps", "map");                 // prefix des ids : map001, map002…
   await maps.list();            // [{id, name, modified}]
   await maps.getAll();          // tous les éléments chargés
   const m = await maps.get("map001");
   const {id} = await maps.add({name:"Village", w:20, h:15});
   await maps.save("map001", m); // modifier
   await maps.rename("map001", "village");
   await maps.duplicate("map001");
   await maps.remove("map001");  // supprimer

   // Fichiers (images, sons, modèles 3D…)
   const img = Studio.assets("images");
   await img.list();             // [{name,size,modified,url}]
   const up = await img.upload(fichierInput.files[0]);     // {name,url}
   imgTag.src = img.url("hero.png");
   await img.rename("hero.png","heros.png");
   await img.remove("heros.png");

   // Projets (au démarrage de chaque page : await Studio.ensureProject();)
   Studio.project; Studio.setProject("MonJeu"); await Studio.projects();
   Studio.onProject(() => recharger());                    // si on change de projet dans le menu

   // Sauvegarde automatique (anti-spam)
   const auto = Studio.autosave(() => Studio.saveDoc("variables", vars), 800);
   // à chaque modif : auto();   // auto.flush() force l'enregistrement immédiat
*/
(function () {
  const LS = "alumiaGameStudio_projet";
  const enc = encodeURIComponent;

  class StudioError extends Error {
    constructor(msg, status) { super(msg); this.status = status; }
  }

  async function req(method, url, body, isRaw) {
    const o = { method, headers: {} };
    if (isRaw) { o.body = body; o.headers["Content-Type"] = "application/octet-stream"; }
    else if (body !== undefined) { o.body = JSON.stringify(body); o.headers["Content-Type"] = "application/json"; }
    let r;
    try { r = await fetch(url, o); }
    catch (e) { throw new StudioError("Serveur injoignable : lance serveur_studio.py et ouvre la page via http://localhost:8000", 0); }
    const t = await r.text();
    let data = null;
    try { data = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) throw new StudioError((data && data.error) || ("Erreur " + r.status), r.status);
    return data;
  }

  const S = {
    StudioError,
    get project() { return new URLSearchParams(location.search).get("projet") || localStorage.getItem(LS) || ""; },
    setProject(n) { localStorage.setItem(LS, n); window.dispatchEvent(new Event("studio-project")); },
    onProject(cb) { window.addEventListener("studio-project", cb); },
    _p() {
      const p = S.project;
      if (!p) throw new StudioError("Aucun projet choisi (menu en haut de AlumiaGameStudio).", 0);
      return "/api/p/" + enc(p);
    },

    ping: () => req("GET", "/api/ping").then(() => true, () => false),
    api: req,   // appel brut : Studio.api("GET", "/api/projects")

    // Garantit qu'un projet valide est choisi (reprend le premier, ou crée « MonPremierJeu »).
    // À appeler au démarrage de chaque page : await Studio.ensureProject();
    async ensureProject() {
      const l = await S.projects();
      if (S.project && l.includes(S.project)) return S.project;
      const n = l.length ? l[0] : (await req("POST", "/api/projects", { name: "MonPremierJeu" })).name;
      localStorage.setItem(LS, n);   // silencieux : la page qui appelle est justement en train de démarrer
      return n;
    },

    // ----- projets
    projects: () => req("GET", "/api/projects"),
    async createProject(name) { const r = await req("POST", "/api/projects", { name }); S.setProject(r.name); return r; },
    async deleteProject(name) { await req("DELETE", "/api/projects/" + enc(name)); if (S.project === name) localStorage.removeItem(LS); },
    async renameProject(name, nouveau) { const r = await req("PATCH", "/api/projects/" + enc(name), { name: nouveau }); if (S.project === name) S.setProject(r.name); return r; },
    duplicateProject: (name, nouveau) => req("POST", "/api/projects/" + enc(name) + "/duplicate", { name: nouveau }),

    // ----- documents
    async doc(name, def = null) {
      try { return await req("GET", S._p() + "/doc/" + enc(name)); }
      catch (e) { if (e.status === 404) return def; throw e; }
    },
    saveDoc: (name, data) => req("PUT", S._p() + "/doc/" + enc(name), data),
    deleteDoc: (name) => req("DELETE", S._p() + "/doc/" + enc(name)),

    // ----- collections
    col(name, prefix) {
      const base = () => S._p() + "/col/" + enc(name);
      const c = {
        list: () => req("GET", base()),
        get: (id) => req("GET", base() + "/" + enc(id)),
        async getAll() { const l = await c.list(); return Promise.all(l.map(x => c.get(x.id))); },
        add: (data) => req("POST", base() + "?prefix=" + enc(prefix || name), data),
        save: (id, data) => req("PUT", base() + "/" + enc(id), data),
        remove: (id) => req("DELETE", base() + "/" + enc(id)),
        rename: (id, nouveau) => req("PATCH", base() + "/" + enc(id), { id: nouveau }),
        async duplicate(id) {
          const d = await c.get(id);
          if (d && typeof d === "object" && typeof d.name === "string") d.name += " (copie)";
          return c.add(d);
        }
      };
      return c;
    },

    // ----- fichiers (assets)
    assets(type) {
      const base = () => S._p() + "/assets/" + enc(type);
      return {
        list: () => req("GET", base()),
        upload: (file, name) => req("POST", base() + "?name=" + enc(name || file.name), file, true),
        remove: (n) => req("DELETE", base() + "/" + enc(n)),
        rename: (n, nouveau) => req("PATCH", base() + "/" + enc(n), { name: nouveau }),
        url: (n) => "/projets/" + enc(S.project) + "/assets/" + enc(type) + "/" + enc(n)
      };
    },

    // ----- effet de couleur d'un tileset (nuit, sépia…) : renvoie un canvas, ou l'image telle quelle si aucun effet
    tintImage(src, t) {
      if (!t || (t.b === 100 && t.c === 100 && t.s === 100 && !t.h && !t.sep && !t.op)) return src;
      const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
      const x = c.getContext("2d");
      x.filter = `brightness(${t.b}%) contrast(${t.c}%) saturate(${t.s}%) hue-rotate(${t.h}deg) sepia(${t.sep}%)`;
      x.drawImage(src, 0, 0); x.filter = "none";
      if (t.op > 0) { x.globalCompositeOperation = "source-atop"; x.globalAlpha = t.op / 100; x.fillStyle = t.col; x.fillRect(0, 0, c.width, c.height); }
      return c;
    },

    // ----- sauvegarde automatique (debounce)
    autosave(fn, delay = 800) {
      let t = null;
      const run = () => { clearTimeout(t); t = null; return fn(); };
      const trigger = () => { clearTimeout(t); t = setTimeout(run, delay); };
      trigger.flush = () => (t ? run() : Promise.resolve());
      window.addEventListener("beforeunload", () => { if (t) run(); });
      return trigger;
    }
  };

  // quand le menu parent change de projet, les pages dans l'iframe sont prévenues
  window.addEventListener("storage", (e) => { if (e.key === LS) window.dispatchEvent(new Event("studio-project")); });
  window.Studio = S;
})();
