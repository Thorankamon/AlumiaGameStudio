#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# © 2026 thorankamon — Tous droits réservés.
# Utilisation gratuite, modification et redistribution interdites.
"""
AlumiaGameStudio — serveur local (aucune installation, Python 3 suffit)

Lancer :   python3 serveur_studio.py          (port 8000 par défaut)
           python3 serveur_studio.py 8080     (autre port)
Ouvrir :   http://localhost:8000/alumia-game-studio.html

Il fait deux choses :
  1) il sert tes pages HTML (dossier du script)
  2) il offre une petite API pour CHARGER / CRÉER / MODIFIER / SUPPRIMER
     les données de chaque projet de jeu, rangées dans  projets/<NomProjet>/

Structure d'un projet :
  projets/MonJeu/data/projet.json          (infos du projet)
  projets/MonJeu/data/<document>.json      (petites listes : interrupteurs, variables…)
  projets/MonJeu/data/<collection>/<id>.json  (un fichier par élément : maps, events…)
  projets/MonJeu/assets/<type>/<fichier>   (images, audio, models3d, textures…)

API (toutes les réponses sont en JSON) :
  GET    /api/ping
  GET    /api/projects                       POST {name}
  DELETE /api/projects/<p>                   PATCH {name}  (renommer)
  POST   /api/projects/<p>/duplicate         {name}
  GET|PUT|DELETE /api/p/<p>/doc/<nom>
  GET    /api/p/<p>/col/<nom>                (liste)   POST (ajout, id auto, ?prefix=map)
  GET|PUT|DELETE|PATCH /api/p/<p>/col/<nom>/<id>      (PATCH {id} = renommer)
  GET    /api/p/<p>/assets/<type>            POST ?name=fichier.png (corps = fichier brut)
  DELETE|PATCH /api/p/<p>/assets/<type>/<fichier>
  Les fichiers sont lisibles directement : /projets/<p>/assets/<type>/<fichier>
"""
import http.server, socketserver, json, os, re, sys, shutil, threading, traceback, webbrowser
from datetime import datetime
from urllib.parse import urlparse, parse_qs, unquote, quote

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(ROOT, "projets")
LOCK = threading.Lock()
NAME_RE = re.compile(r"^\w[\w \-.]{0,79}$")          # pas de / \ : .. au début
MAX_JSON = 50 * 1024 * 1024
MAX_FILE = 300 * 1024 * 1024
BLOCKED_EXT = {".html", ".htm", ".js", ".mjs", ".py", ".exe", ".bat", ".cmd", ".sh", ".php", ".dll"}
SUBDIRS = ["images", "audio", "models3d", "textures"]


class ApiError(Exception):
    def __init__(self, code, msg):
        self.code, self.msg = code, msg


def safe(n):
    if not isinstance(n, str) or not NAME_RE.match(n) or ".." in n or n[-1] in ". ":
        raise ApiError(400, "Nom invalide : %r (lettres, chiffres, espace, - _ . seulement)" % (n,))
    return n


def safe_file(n):
    safe(n)
    if os.path.splitext(n)[1].lower() in BLOCKED_EXT:
        raise ApiError(400, "Type de fichier interdit : " + n)
    return n


def j(raw):
    try:
        return json.loads(raw.decode("utf-8")) if raw else None
    except Exception:
        raise ApiError(400, "JSON invalide")


def need(d, key):
    if not isinstance(d, dict) or key not in d:
        raise ApiError(400, "Champ manquant : " + key)
    return d[key]


def atomic(path, raw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(raw)
    os.replace(tmp, path)          # écriture atomique : jamais de fichier à moitié écrit


def write_json(path, data):
    atomic(path, json.dumps(data, ensure_ascii=False, indent=1).encode("utf-8"))


def read_json(path):
    if not os.path.isfile(path):
        raise ApiError(404, "Introuvable : " + os.path.basename(path))
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        raise ApiError(500, "Fichier JSON illisible : " + os.path.basename(path))


def pdir(p):
    d = os.path.join(PROJ, safe(p))
    if not os.path.isdir(d):
        raise ApiError(404, "Projet introuvable : " + p)
    return d


def make_project(name):
    d = os.path.join(PROJ, safe(name))
    if os.path.exists(d):
        raise ApiError(409, "Ce projet existe déjà : " + name)
    os.makedirs(os.path.join(d, "data"))
    for s in SUBDIRS:
        os.makedirs(os.path.join(d, "assets", s))
    write_json(os.path.join(d, "data", "projet.json"),
               {"name": name, "cree": datetime.now().isoformat(timespec="seconds")})


# ---------------------------------------------------------------- routes
def r_projects(m, p, raw):
    if not p:
        if m == "GET":
            return sorted(x for x in os.listdir(PROJ) if os.path.isdir(os.path.join(PROJ, x)))
        if m == "POST":
            name = need(j(raw), "name")
            make_project(name)
            return {"name": name}
    elif len(p) == 1:
        d = pdir(p[0])
        if m == "DELETE":
            shutil.rmtree(d)
            return {"ok": True}
        if m == "PATCH":
            new = safe(need(j(raw), "name"))
            nd = os.path.join(PROJ, new)
            if os.path.exists(nd):
                raise ApiError(409, "Ce projet existe déjà : " + new)
            os.rename(d, nd)
            return {"name": new}
    elif len(p) == 2 and p[1] == "duplicate" and m == "POST":
        d = pdir(p[0])
        new = safe(need(j(raw), "name"))
        nd = os.path.join(PROJ, new)
        if os.path.exists(nd):
            raise ApiError(409, "Ce projet existe déjà : " + new)
        shutil.copytree(d, nd)
        return {"name": new}
    raise ApiError(405, "Méthode non supportée")


def list_col(d):
    out = []
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.endswith(".json"):
                path = os.path.join(d, f)
                name = None
                try:
                    with open(path, "r", encoding="utf-8") as fh:
                        data = json.load(fh)
                    if isinstance(data, dict):
                        name = data.get("name")
                except Exception:
                    pass
                out.append({"id": f[:-5], "name": name, "modified": os.path.getmtime(path)})
    return out


def next_id(d, prefix):
    mx = 0
    if os.path.isdir(d):
        for f in os.listdir(d):
            mt = re.fullmatch(re.escape(prefix) + r"(\d+)\.json", f)
            if mt:
                mx = max(mx, int(mt.group(1)))
    return "%s%03d" % (prefix, mx + 1)


def r_data(m, parts, q, raw):
    base = pdir(parts[1])
    kind, n = parts[2], len(parts)
    if n < 4:
        raise ApiError(404, "Route inconnue")
    name = safe(parts[3])

    if kind == "doc" and n == 4:
        path = os.path.join(base, "data", name + ".json")
        if m == "GET":
            return read_json(path)
        if m == "PUT":
            write_json(path, j(raw))
            return {"ok": True}
        if m == "DELETE":
            if not os.path.isfile(path):
                raise ApiError(404, "Introuvable")
            os.remove(path)
            return {"ok": True}

    elif kind == "col":
        d = os.path.join(base, "data", name)
        if n == 4:
            if m == "GET":
                return list_col(d)
            if m == "POST":
                data = j(raw)
                prefix = safe(q.get("prefix", [name])[0])
                iid = next_id(d, prefix)
                if isinstance(data, dict):
                    data["id"] = iid
                write_json(os.path.join(d, iid + ".json"), data)
                return {"id": iid}
        elif n == 5:
            iid = safe(parts[4])
            path = os.path.join(d, iid + ".json")
            if m == "GET":
                return read_json(path)
            if m == "PUT":
                write_json(path, j(raw))
                return {"ok": True}
            if m == "DELETE":
                if not os.path.isfile(path):
                    raise ApiError(404, "Introuvable : " + iid)
                os.remove(path)
                return {"ok": True}
            if m == "PATCH":
                new = safe(need(j(raw), "id"))
                np_ = os.path.join(d, new + ".json")
                if not os.path.isfile(path):
                    raise ApiError(404, "Introuvable : " + iid)
                if os.path.exists(np_):
                    raise ApiError(409, "Cet identifiant existe déjà : " + new)
                os.rename(path, np_)
                try:                      # garde le champ "id" cohérent
                    data = read_json(np_)
                    if isinstance(data, dict) and data.get("id") == iid:
                        data["id"] = new
                        write_json(np_, data)
                except ApiError:
                    pass
                return {"id": new}

    elif kind == "assets":
        d = os.path.join(base, "assets", name)
        if n == 4:
            if m == "GET":
                out = []
                if os.path.isdir(d):
                    for f in sorted(os.listdir(d)):
                        fp = os.path.join(d, f)
                        if os.path.isfile(fp) and not f.endswith(".tmp"):
                            out.append({"name": f, "size": os.path.getsize(fp),
                                        "modified": os.path.getmtime(fp),
                                        "url": "/projets/%s/assets/%s/%s" % (quote(parts[1]), quote(name), quote(f))})
                return out
            if m == "POST":
                fn = safe_file(q.get("name", [""])[0])
                stem, ext = os.path.splitext(fn)
                final, i = fn, 2
                while os.path.exists(os.path.join(d, final)):
                    final = "%s_%d%s" % (stem, i, ext)
                    i += 1
                atomic(os.path.join(d, final), raw)
                return {"name": final,
                        "url": "/projets/%s/assets/%s/%s" % (quote(parts[1]), quote(name), quote(final))}
        elif n == 5:
            fn = safe_file(parts[4])
            path = os.path.join(d, fn)
            if not os.path.isfile(path):
                raise ApiError(404, "Introuvable : " + fn)
            if m == "DELETE":
                os.remove(path)
                return {"ok": True}
            if m == "PATCH":
                new = safe_file(need(j(raw), "name"))
                np_ = os.path.join(d, new)
                if os.path.exists(np_):
                    raise ApiError(409, "Ce fichier existe déjà : " + new)
                os.rename(path, np_)
                return {"name": new}
    raise ApiError(405, "Méthode non supportée")


def route(m, parts, q, raw):
    if parts == ["ping"]:
        return {"ok": True}
    if parts and parts[0] == "projects":
        return r_projects(m, parts[1:], raw)
    if len(parts) >= 3 and parts[0] == "p":
        return r_data(m, parts, q, raw)
    raise ApiError(404, "Route inconnue")


# ---------------------------------------------------------------- HTTP
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/") and self.command != "GET":
            sys.stdout.write("  %s %s\n" % (self.command, unquote(self.path)))

    def send_json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def api(self, m):
        try:
            u = urlparse(self.path)
            parts = [unquote(x) for x in u.path.split("/")[2:] if x]
            q = parse_qs(u.query)
            is_up = m == "POST" and len(parts) == 4 and parts[0] == "p" and parts[2] == "assets"
            size = int(self.headers.get("Content-Length") or 0)
            if size > (MAX_FILE if is_up else MAX_JSON):
                raise ApiError(413, "Fichier trop gros")
            raw = self.rfile.read(size) if size else b""
            if m == "GET":
                res = route(m, parts, q, raw)
            else:
                with LOCK:
                    res = route(m, parts, q, raw)
            self.send_json(200, res)
        except ApiError as e:
            self.send_json(e.code, {"error": e.msg})
        except Exception:
            traceback.print_exc()
            self.send_json(500, {"error": "Erreur interne du serveur (voir la console)"})

    def do_GET(self):
        self.api("GET") if self.path.startswith("/api/") else super().do_GET()

    def _w(self, m):
        if self.path.startswith("/api/"):
            self.api(m)
        else:
            self.send_error(405)

    def do_POST(self): self._w("POST")
    def do_PUT(self): self._w("PUT")
    def do_DELETE(self): self._w("DELETE")
    def do_PATCH(self): self._w("PATCH")


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.makedirs(PROJ, exist_ok=True)
    if not any(os.path.isdir(os.path.join(PROJ, x)) for x in os.listdir(PROJ)):
        make_project("MonPremierJeu")
    try:
        srv = Server(("127.0.0.1", port), Handler)   # accessible seulement depuis cet ordinateur
    except OSError:
        print("Le port %d est déjà utilisé. Essaie : python3 serveur_studio.py %d" % (port, port + 1))
        sys.exit(1)
    url = "http://localhost:%d/alumia-game-studio.html" % port
    print("AlumiaGameStudio — serveur lancé\n  Dossier : %s\n  Projets : %s\n  Page    : %s\n  (Ctrl+C pour arrêter)\n" % (ROOT, PROJ, url))
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nServeur arrêté.")


if __name__ == "__main__":
    main()
