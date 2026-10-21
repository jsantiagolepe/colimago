#!/usr/bin/env node
// Backend falso de ColimaApp para desarrollar y probar la guía sin tocar
// producción. Responde con la forma real del backend (ver docs/guia-web.md),
// usando como datos el feed real guardado en scripts/fixtures/.
//
//   node scripts/backend-falso.js [puerto]        (por defecto 4010)
//   COLIMA_BACKEND_URL=http://127.0.0.1:4010/api PORT=3100 node server.js
//
// Variables: TOP10=1 devuelve tres eventos en /post/top10 (en producción
// hoy viene vacío); VACIO=1 devuelve el feed vacío; FALLA=1 responde 503.
// Lo que escribe (me gusta, comentarios, favoritos) vive en memoria.
//
// Acepta cualquier credencial de Google en POST /login/google y devuelve un
// JWT de mentira ("prueba.<id>"); las rutas de usuario exigen ese Bearer.

const http = require("http");
const fs = require("fs");
const path = require("path");

const puerto = Number(process.argv[2]) || 4010;
const leer = (nombre) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", nombre), "utf8"));

const feed = leer("feed.json");
const comentariosBase = leer("comentarios.json").comments;
const USUARIO = { _id: "6ad0aaaaaaaaaaaaaaaaaaaa", name: "Persona de Prueba", img: "", email: "prueba@example.com" };
const TOKEN = `prueba.${USUARIO._id}`;

const likes = new Set();
const favoritos = new Map(); // id → registro
const comentarios = new Map(); // idPost → comentarios añadidos
const vistas = new Map();
let siguienteComentario = 1;

function metricas(id) {
  const ev = feed.find((e) => e._id === id);
  const extra = comentarios.get(id) || [];
  return {
    likes: (ev ? ev.likes : 0) + (likes.has(id) ? 1 : 0),
    like: likes.has(id),
    comments: (ev ? ev.comments : 0) + extra.length,
    views: (ev ? ev.views : 0) + (vistas.get(id) || 0),
    favorite: favoritos.has(id),
  };
}

function responder(res, estado, cuerpo) {
  res.writeHead(estado, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

const servidor = http.createServer((req, res) => {
  let texto = "";
  req.on("data", (c) => (texto += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    const ruta = url.pathname.replace(/^\/api/, "").replace(/\/$/, "") || "/";
    let cuerpo = {};
    try {
      cuerpo = texto ? JSON.parse(texto) : {};
    } catch {}
    const conSesion = req.headers.authorization === `Bearer ${TOKEN}`;
    const exigir = () => {
      if (conSesion) return false;
      responder(res, 401, { message: req.headers.authorization ? "Invalid token" : "Missing token", error: "Unauthorized", statusCode: 401 });
      return true;
    };
    if (process.env.FALLA === "1") return responder(res, 503, { message: "Servicio no disponible" });
    console.log(`[backend falso] ${req.method} ${ruta}${url.search}${conSesion ? " (con sesión)" : ""}`);

    if (req.method === "GET" && ruta === "/post") {
      const lista = process.env.VACIO === "1" ? [] : feed.map((e) => ({ ...e, like: conSesion && likes.has(e._id), favorite: conSesion && favoritos.has(e._id) }));
      return responder(res, 200, lista);
    }
    if (req.method === "GET" && ruta === "/post/top10") {
      if (process.env.TOP10 !== "1") return responder(res, 200, []);
      return responder(res, 200, feed.filter((e) => e.images).slice(0, 3).map((e) => ({ _id: e._id, title: e.title, images: [e.images], isCover: e.isCover, date: e.date })));
    }
    if (req.method === "GET" && ruta === "/post/findOne") {
      const ev = feed.find((e) => e._id === url.searchParams.get("id"));
      return responder(res, 200, ev ? { message: "This is the one Post", response: true, post: ev } : { message: "Post not found", response: false });
    }
    if (req.method === "GET" && ruta === "/comment") {
      const id = url.searchParams.get("idPost");
      const base = id === "6ac82d4d030fa4a6d5938df7" ? comentariosBase : [];
      const propios = (comentarios.get(id) || []).map((c) => ({ ...c, deleteComment: conSesion }));
      return responder(res, 200, { message: "Comments retrieved successfully", response: true, comments: [...base, ...propios] });
    }
    if (req.method === "POST" && ruta === "/comment") {
      if (exigir()) return;
      const lista = comentarios.get(cuerpo.idPost) || [];
      const _id = `6ad1${String(siguienteComentario++).padStart(20, "0")}`;
      lista.push({ _id, name: USUARIO.name, img: USUARIO.img, user: USUARIO._id, status: true, content: cuerpo.content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      comentarios.set(cuerpo.idPost, lista);
      return responder(res, 200, { message: "New Comment", response: true, idComment: _id });
    }
    if (req.method === "DELETE" && ruta === "/comment") {
      if (exigir()) return;
      const id = url.searchParams.get("idPost");
      const lista = (comentarios.get(id) || []).filter((c) => c._id !== url.searchParams.get("idComment"));
      comentarios.set(id, lista);
      return responder(res, 200, { message: "Comment removed successfully", response: true });
    }
    if (req.method === "POST" && ruta === "/metrics") {
      const salida = {};
      for (const id of cuerpo.ids || []) if (feed.some((e) => e._id === id) || /^[a-f0-9]{24}$/.test(id)) salida[id] = metricas(id);
      return responder(res, 200, { message: "Metrics retrieved successfully", response: true, metrics: salida });
    }
    if (req.method === "POST" && ruta === "/view") {
      vistas.set(cuerpo.idPost, (vistas.get(cuerpo.idPost) || 0) + 1);
      return responder(res, 200, { message: "New view", response: true });
    }
    if (req.method === "POST" && ruta === "/like") {
      if (exigir()) return;
      const activo = !likes.has(cuerpo.idPost);
      if (activo) likes.add(cuerpo.idPost);
      else likes.delete(cuerpo.idPost);
      return responder(res, 200, { message: activo ? "New like added" : "Like removed", response: true });
    }
    if (ruta === "/favorite") {
      if (exigir()) return;
      if (req.method === "GET") return responder(res, 200, [...favoritos.values()]);
      if (req.method === "POST") {
        const ev = feed.find((e) => e._id === cuerpo.idPost);
        favoritos.set(cuerpo.idPost, ev
          ? { _id: ev._id, title: ev.title, images: ev.images ? [ev.images] : [], isCover: ev.isCover, date: ev.date, kind: "event" }
          : { _id: cuerpo.idPost, title: "Lugar", images: [], isCover: false, date: new Date().toISOString(), kind: "local" });
        return responder(res, 200, { message: "New Favorite", response: true });
      }
      if (req.method === "DELETE") {
        favoritos.delete(url.searchParams.get("idPost"));
        return responder(res, 200, { message: "Favorite removed successfully", response: true });
      }
    }
    if (req.method === "POST" && (ruta === "/hide" || ruta === "/report")) {
      if (exigir()) return;
      return responder(res, 200, { message: ruta === "/hide" ? "New Hide" : "Report created successfully", response: true });
    }
    if (req.method === "POST" && ruta === "/login/google") {
      if (!cuerpo.token) return responder(res, 200, { message: "error, verify token", response: false });
      return responder(res, 200, { message: "User processed successfully", user: USUARIO, token: TOKEN, response: true });
    }
    if (req.method === "DELETE" && ruta === "/configuration/delete") {
      if (exigir()) return;
      return responder(res, 200, { message: "Data removed successfully", response: true });
    }
    if (req.method === "POST" && ruta === "/logs") return responder(res, 201, { message: "Log saved", response: true });
    if (req.method === "GET" && ruta === "/version") return responder(res, 200, { message: "ok", response: true, version: 32 });
    responder(res, 404, { message: `Ruta no simulada: ${req.method} ${ruta}`, statusCode: 404 });
  });
});

servidor.listen(puerto, "127.0.0.1", () => console.log(`Backend falso en http://127.0.0.1:${puerto}/api`));
