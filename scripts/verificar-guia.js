#!/usr/bin/env node
// Verificación de la capa de servidor de la guía web: lib/guia/eventos.js
// (feed, normalización, caché), lib/guia/sesion.js (cookie cifrada, CSRF,
// límites) y lib/guia/api.js (endpoints /g/*).
//
// No necesita el backend real ni Google: levanta un backend falso en un
// puerto libre que responde con datos REALES de producción (scripts/
// fixtures/guia/: feed de 30 eventos, findOne, comentario) y con respuestas
// plausibles, según el informe del backend, para like, comentario, favoritos,
// métricas, reporte, ocultar, vista, login y borrar cuenta. No hace ninguna
// petición de red al backend de producción.
//
// Importa ../server. Si server.js ya monta el router (app.use("/g", …)), se
// prueba tal cual; si todavía no, el script lo monta delante, con el mismo
// express.json() global que usa server.js, para que funcione en ambos casos.
//
//   npm run verificar:guia
//   (o) node scripts/verificar-guia.js

const http = require("http");
const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "secreto-de-prueba-guia";
delete process.env.VISITAS_ACTIVO;

// --- Datos reales de producción (solo lectura, copiados al repo) ---

const FIXTURES = path.join(__dirname, "fixtures", "guia");
const leer = (nombre) => JSON.parse(fs.readFileSync(path.join(FIXTURES, nombre), "utf8"));
const feedCrudo = leer("feed.json");
const findOneCrudo = leer("findone.json");
const findOneLocalCrudo = leer("findone-local.json");
const comentarioCrudo = leer("comment.json").comments[0];

const ID_ULTRA = findOneCrudo.post._id;
const ID_LOCAL = findOneLocalCrudo.post._id;
const ID_EXTRA = "aaaaaaaaaaaaaaaaaaaaaaa1"; // evento que findOne conoce pero el feed no
const ID_PAUSADO = "aaaaaaaaaaaaaaaaaaaaaaa2"; // evento con status:false
const ID_NOEXISTE = "0".repeat(24);
const feedIds = feedCrudo.map((e) => e._id);

const ANA = { id: "bbbbbbbbbbbbbbbbbbbbbb01", name: "Ana Pérez", img: "https://lh3.googleusercontent.com/a/ana", email: "ana@correo.mx" };
const BETO = { id: "bbbbbbbbbbbbbbbbbbbbbb02", name: "Beto Gómez", img: "https://lh3.googleusercontent.com/a/beto", email: "beto@correo.mx" };

const b64 = (obj) => Buffer.from(typeof obj === "string" ? obj : JSON.stringify(obj)).toString("base64url");
const jwtFalso = (u, expSegundos) =>
  `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email: u.email, tv: 0, exp: expSegundos })}.${b64("firma-falsa-" + u.id)}`;
const EN_UN_ANIO = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
const JWT_ANA = jwtFalso(ANA, EN_UN_ANIO);
const JWT_BETO = jwtFalso(BETO, EN_UN_ANIO);
const TOKENS = new Map([[JWT_ANA, ANA], [JWT_BETO, BETO]]);
const CREDENCIALES = { "cred.ana.google": [ANA, JWT_ANA], "cred.beto.google": [BETO, JWT_BETO] };

// --- Backend falso ---

const recibidas = [];
const estado = {
  feedModo: "ok", // ok | 500 | 400 | caido | lento | raro
  feedRetraso: 0,
  top10Modo: "vacio", // vacio | array | objeto | 500
  contadores: { feed: 0, findOne: 0, top10: 0, comment: 0, metrics: 0 },
  forzar: new Map(), // "METODO /ruta" → { status, body, veces }
  revocados: new Set(),
  vistaFalla: false,
  likes: new Map(), // idPost → Set(userId)
  comentarios: [],
  favoritos: new Map(), // userId → [idPost…]
  ocultos: [],
  reportes: [],
  vistas: 0,
  enVuelo: 0,
  maxEnVuelo: 0,
};
const postsConocidos = new Set([...feedIds, ID_ULTRA, ID_EXTRA, ID_PAUSADO, ID_LOCAL]);
let secuencia = 0;
const nuevoId = () => "cccccccc" + (++secuencia).toString(16).padStart(16, "0");
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
const mismasClaves = (obj, claves) => Boolean(obj) && Object.keys(obj).sort().join() === [...claves].sort().join();

function enviar(res, status, cuerpo) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

function reiniciarEstado() {
  for (const k of Object.keys(estado.contadores)) estado.contadores[k] = 0;
  estado.feedModo = "ok";
  estado.feedRetraso = 0;
  estado.top10Modo = "vacio";
  estado.forzar.clear();
  estado.revocados.clear();
  estado.vistaFalla = false;
  estado.likes.clear();
  estado.ocultos = [];
  estado.reportes = [];
  estado.favoritos = new Map([[ANA.id, [feedIds[0], ID_LOCAL]]]);
  estado.comentarios = [
    // El comentario real de producción, con un autor inventado.
    { ...comentarioCrudo, post: ID_ULTRA, user: BETO.id, name: BETO.name, img: BETO.img, _id: "dddddddddddddddddddddd01", status: true },
    { ...comentarioCrudo, post: ID_ULTRA, user: ANA.id, name: ANA.name, img: ANA.img, _id: "dddddddddddddddddddddd02", status: true, content: "Estuvo padrísimo", createdAt: "2026-10-16T03:00:00.000Z" },
  ];
}

const REQUIEREN_USUARIO = new Set([
  "POST /api/like", "POST /api/comment", "DELETE /api/comment", "GET /api/favorite", "POST /api/favorite",
  "DELETE /api/favorite", "POST /api/hide", "POST /api/report", "DELETE /api/configuration/delete",
]);

function postDeFeed(id) {
  return feedCrudo.find((e) => e._id === id);
}

async function manejar(req, res, r) {
  const p = r.ruta.replace(/\/$/, "");
  const clave = `${r.metodo} ${p}`;
  const forzado = estado.forzar.get(clave);
  if (forzado) {
    if (--forzado.veces <= 0) estado.forzar.delete(clave);
    return enviar(res, forzado.status, forzado.body || { message: "forzado", statusCode: forzado.status });
  }

  // Como el backend real: un token inválido da 401 incluso en rutas públicas.
  let usuario = null;
  if (r.authorization) {
    const token = r.authorization.replace(/^Bearer /, "");
    usuario = TOKENS.get(token) || null;
    if (!usuario || estado.revocados.has(token)) {
      return enviar(res, 401, { message: "Invalid token", error: "Unauthorized", statusCode: 401 });
    }
  } else if (REQUIEREN_USUARIO.has(clave)) {
    return enviar(res, 401, { message: "Missing token", error: "Unauthorized", statusCode: 401 });
  }
  const j = r.json || {};
  const ok = (extra) => enviar(res, 200, { response: true, ...extra });
  const fallo = (message) => enviar(res, 200, { message, response: false });
  const rechazar400 = () => enviar(res, 400, { message: ["property should not exist"], error: "Bad Request", statusCode: 400 });

  switch (clave) {
    case "GET /api/post": {
      estado.contadores.feed++;
      if (estado.feedModo === "caido") return req.socket.destroy();
      if (estado.feedModo === "500") {
        res.writeHead(503, { "Content-Type": "text/html" });
        return res.end("<h1>Service Unavailable</h1>");
      }
      if (estado.feedModo === "400") return enviar(res, 400, { message: "no", statusCode: 400 });
      if (estado.feedModo === "lento") await pausa(400);
      if (estado.feedRetraso) await pausa(estado.feedRetraso);
      if (estado.feedModo === "raro") {
        return enviar(res, 200, [
          feedCrudo[0],
          { ...feedCrudo[1], _id: undefined },
          { ...feedCrudo[2], title: "   " },
          { ...feedCrudo[3], date: "2026-02-31T00:00:00.000Z" },
          { ...feedCrudo[4], date: "no-es-fecha" },
          feedCrudo[0],
          "texto",
          null,
          { ...feedCrudo[5], _id: "XYZ" },
        ]);
      }
      return enviar(res, 200, feedCrudo);
    }
    case "GET /api/post/findOne": {
      estado.contadores.findOne++;
      const id = r.query.id;
      if (!id) return enviar(res, 400, { message: ["id should not be empty"], statusCode: 400 });
      if (!/^[a-f0-9]{24}$/.test(id)) return fallo("Internal server error while fetching the post");
      if (id === ID_ULTRA) return enviar(res, 200, findOneCrudo);
      if (id === ID_LOCAL) return enviar(res, 200, findOneLocalCrudo);
      if (id === ID_EXTRA) return ok({ message: "This is the one Post", post: { ...findOneCrudo.post, _id: ID_EXTRA, title: "Evento fuera del feed" } });
      if (id === ID_PAUSADO) return ok({ message: "This is the one Post", post: { ...findOneCrudo.post, _id: ID_PAUSADO, status: false } });
      const delFeed = postDeFeed(id);
      if (delFeed) return ok({ message: "This is the one Post", post: delFeed });
      return fallo("Post not found");
    }
    case "GET /api/post/top10": {
      estado.contadores.top10++;
      if (estado.top10Modo === "500") return enviar(res, 500, { message: "boom" });
      if (estado.top10Modo === "vacio") return enviar(res, 200, []);
      const lista = [0, 1].map((i) => ({ _id: feedIds[i], title: feedCrudo[i].title, images: [feedCrudo[i].images], isCover: i === 0, date: feedCrudo[i].date }));
      return enviar(res, 200, estado.top10Modo === "objeto" ? { top10: lista } : lista);
    }
    case "GET /api/comment": {
      estado.contadores.comment++;
      if (!postsConocidos.has(r.query.idPost)) return fallo("Post not found");
      const comments = estado.comentarios
        .filter((c) => c.post === r.query.idPost && c.status)
        .map(({ post, ...c }) => ({ ...c, deleteComment: Boolean(usuario) && c.user === usuario.id }));
      return ok({ message: "Comments retrieved successfully", comments });
    }
    case "POST /api/comment": {
      if (!mismasClaves(j, ["idPost", "content"]) || typeof j.content !== "string" || j.content.length < 1 || j.content.length > 500) return rechazar400();
      if (!postsConocidos.has(j.idPost)) return fallo("Post not found");
      const _id = nuevoId();
      estado.comentarios.push({ post: j.idPost, _id, user: usuario.id, name: usuario.name, img: usuario.img, status: true, content: j.content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      return ok({ message: "New Comment", idComment: _id });
    }
    case "DELETE /api/comment": {
      const i = estado.comentarios.findIndex((c) => c._id === r.query.idComment && c.post === r.query.idPost && c.user === usuario.id);
      if (i < 0) return fallo("Post or comment not found, or post not owned by the user");
      estado.comentarios.splice(i, 1);
      return ok({ message: "Comment removed successfully" });
    }
    case "POST /api/like": {
      if (!mismasClaves(j, ["idPost"])) return rechazar400();
      if (!postsConocidos.has(j.idPost)) return fallo("Post not found");
      const set = estado.likes.get(j.idPost) || new Set();
      estado.likes.set(j.idPost, set);
      if (set.delete(usuario.id)) return ok({ message: "Like removed" });
      set.add(usuario.id);
      return ok({ message: "New like added" });
    }
    case "POST /api/view": {
      if (!mismasClaves(j, ["idPost"])) return rechazar400();
      if (estado.vistaFalla) return enviar(res, 500, { message: "boom" });
      estado.vistas++;
      return ok({ message: "New view" });
    }
    case "POST /api/metrics": {
      estado.contadores.metrics++;
      if (!mismasClaves(j, ["ids"]) || !Array.isArray(j.ids) || j.ids.length < 1 || j.ids.length > 100) return rechazar400();
      const metrics = {};
      for (const id of j.ids) {
        const base = id === ID_ULTRA ? findOneCrudo.post : postDeFeed(id);
        if (!base) continue;
        const set = estado.likes.get(id) || new Set();
        metrics[id] = {
          likes: base.likes + set.size,
          like: Boolean(usuario) && set.has(usuario.id),
          comments: estado.comentarios.filter((c) => c.post === id).length,
          views: base.views,
          favorite: Boolean(usuario) && (estado.favoritos.get(usuario.id) || []).includes(id),
        };
      }
      return ok({ message: "Metrics retrieved successfully", metrics });
    }
    case "GET /api/favorite": {
      const lista = (estado.favoritos.get(usuario.id) || []).map((id) =>
        id === ID_LOCAL
          ? { _id: ID_LOCAL, title: "Los Amiales", images: ["rio-los-amiales"], isCover: false, date: "2026-09-14T00:18:04.478Z", kind: "local" }
          : { _id: id, title: postDeFeed(id).title, images: [postDeFeed(id).images], isCover: postDeFeed(id).isCover, date: postDeFeed(id).date, kind: "event" },
      );
      return enviar(res, 200, lista);
    }
    case "POST /api/favorite": {
      if (!mismasClaves(j, ["idPost"])) return rechazar400();
      estado.enVuelo++;
      estado.maxEnVuelo = Math.max(estado.maxEnVuelo, estado.enVuelo);
      await pausa(8);
      estado.enVuelo--;
      if (!postsConocidos.has(j.idPost)) return fallo("Post not found");
      const lista = estado.favoritos.get(usuario.id) || [];
      if (lista.includes(j.idPost)) return fallo("already exist favorite");
      estado.favoritos.set(usuario.id, [...lista, j.idPost]);
      return ok({ message: "New Favorite" });
    }
    case "DELETE /api/favorite": {
      const lista = estado.favoritos.get(usuario.id) || [];
      if (!lista.includes(r.query.idPost)) return fallo("Favorite not found or already removed");
      estado.favoritos.set(usuario.id, lista.filter((id) => id !== r.query.idPost));
      return ok({ message: "Favorite removed successfully" });
    }
    case "POST /api/hide": {
      if (!mismasClaves(j, ["idPost"])) return rechazar400();
      if (!postsConocidos.has(j.idPost)) return fallo("Post not found");
      if (estado.ocultos.includes(`${usuario.id}:${j.idPost}`)) return fallo("already exist hide");
      estado.ocultos.push(`${usuario.id}:${j.idPost}`);
      return ok({ message: "New Hide" });
    }
    case "POST /api/report": {
      if (!mismasClaves(j, ["idReport", "type", "text"]) || !["comment", "post", "photo"].includes(j.type) || typeof j.text !== "string" || j.text.length < 1 || j.text.length > 1000) return rechazar400();
      estado.reportes.push(j);
      return ok({ message: "Report created successfully" });
    }
    case "DELETE /api/configuration/delete": {
      estado.revocados.add(r.authorization.replace(/^Bearer /, ""));
      return ok({ message: "Data removed successfully" });
    }
    case "POST /api/login/google": {
      if (!mismasClaves(j, ["token", "platform"]) || j.platform !== "web" || r.authorization) return rechazar400();
      const par = CREDENCIALES[j.token];
      if (!par) return fallo("error, verify token");
      const [u, token] = par;
      return ok({ message: "User processed successfully", user: { _id: u.id, name: u.name, img: u.img, email: u.email }, token });
    }
    default:
      return enviar(res, 404, { message: `Cannot ${r.metodo} ${r.ruta}`, statusCode: 404 });
  }
}

const backendFalso = http.createServer((req, res) => {
  const trozos = [];
  req.on("data", (c) => trozos.push(c));
  req.on("end", () => {
    const crudo = Buffer.concat(trozos).toString("utf8");
    const url = new URL(req.url, "http://x");
    let json = null;
    try {
      json = crudo ? JSON.parse(crudo) : null;
    } catch {}
    const registro = {
      metodo: req.method,
      ruta: url.pathname,
      query: Object.fromEntries(url.searchParams),
      authorization: req.headers.authorization || null,
      json,
      contentType: req.headers["content-type"] || "",
      largo: crudo.length,
    };
    recibidas.push(registro);
    manejar(req, res, registro).catch((err) => {
      console.error("backend falso:", err);
      if (!res.headersSent) enviar(res, 500, {});
    });
  });
});

// --- Utilidades de la prueba ---

let fallos = 0;
let total = 0;
function comprobar(ok, texto) {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${texto}`);
}
const titulo = (t) => console.log(`\n${t}`);

const desde = (n) => recibidas.slice(n);
const llamadas = (n, metodo, ruta) => desde(n).filter((r) => r.metodo === metodo && r.ruta.replace(/\/$/, "") === `/api${ruta}`);

const errores = []; // todos los mensajes de error que dio la API: todos deben estar en español

async function main() {
  await new Promise((ok) => backendFalso.listen(0, "127.0.0.1", ok));
  process.env.COLIMA_BACKEND_URL = `http://127.0.0.1:${backendFalso.address().port}/api`;
  reiniciarEstado();

  // Los módulos se cargan DESPUÉS de fijar el entorno.
  const express = require("express");
  const app = require("../server");
  const eventos = require("../lib/guia/eventos");
  const sesion = require("../lib/guia/sesion");
  const guiaApi = require("../lib/guia/api");

  // ¿server.js ya monta /g? Se pregunta al propio servidor.
  const sondeo = http.createServer(app);
  await new Promise((ok) => sondeo.listen(0, "127.0.0.1", ok));
  const r0 = await fetch(`http://127.0.0.1:${sondeo.address().port}/g/sesion`);
  // VERIFICAR_GUIA_MONTAR=1 fuerza el montaje del script (para probar ese camino aunque server.js ya monte /g).
  const montado = !process.env.VERIFICAR_GUIA_MONTAR && (r0.headers.get("content-type") || "").includes("json") && r0.status === 200;
  sondeo.close();
  let aplicacion = app;
  if (!montado) {
    aplicacion = express();
    aplicacion.set("trust proxy", 1);
    aplicacion.use(express.json()); // como el de server.js
    aplicacion.use("/g", guiaApi);
    aplicacion.use(app);
    // Como el manejador de errores de server.js, para el JSON mal formado que lee el express.json() global.
    aplicacion.use((err, req, res, next) => {
      res.status(err.status || 500).json({ error: err.type === "entity.parse.failed" ? "El cuerpo de la petición no es JSON válido." : "Ocurrió un error." });
    });
  }
  console.log(montado ? "server.js ya monta /g: se prueba tal cual." : "server.js todavía no monta /g: el script lo monta delante.");

  const sitio = http.createServer(aplicacion);
  await new Promise((ok) => sitio.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${sitio.address().port}`;

  async function pedir(metodo, ruta, { cuerpo, crudo, cookie, csrf = true, headers = {} } = {}) {
    const cab = { ...headers };
    if (csrf && metodo !== "GET") cab["X-Requested-With"] = "colimago";
    if (cookie) cab.Cookie = `${sesion.NOMBRE_COOKIE}=${cookie}`;
    let body;
    if (crudo !== undefined) body = crudo;
    else if (cuerpo !== undefined) body = JSON.stringify(cuerpo);
    if (body !== undefined) cab["Content-Type"] = "application/json";
    const res = await fetch(base + ruta, { method: metodo, headers: cab, body });
    const texto = await res.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {}
    if (json && typeof json.error === "string") errores.push(json.error);
    return { status: res.status, json, texto, headers: res.headers, setCookie: res.headers.getSetCookie() };
  }
  const valorCookie = (r) => {
    const c = r.setCookie.find((x) => x.startsWith(`${sesion.NOMBRE_COOKIE}=`));
    return c ? c.split(";")[0].slice(sesion.NOMBRE_COOKIE.length + 1) : null;
  };
  const cookieBorrada = (r) => r.setCookie.some((c) => c.startsWith(`${sesion.NOMBRE_COOKIE}=;`) && /Expires=Thu, 01 Jan 1970/i.test(c));
  const entrar = async (cred) => {
    const r = await pedir("POST", "/g/login/google", { cuerpo: { credential: cred } });
    return valorCookie(r);
  };
  const reiniciarTodo = () => {
    guiaApi._interno.reiniciar();
    eventos._interno.reiniciar();
    reiniciarEstado();
  };

  // ======================================================================
  titulo("Fechas y normalización de los 30 eventos reales:");
  // ======================================================================
  const HOY = "2026-10-20";
  const evs = feedCrudo.map(eventos.normalizarEvento);
  comprobar(evs.length === 30 && evs.every(Boolean), "los 30 eventos del feed se normalizan");
  comprobar(new Set(evs.map((e) => e.id)).size === 30 && evs.every((e) => e.titulo), "ids únicos y todos con título");
  comprobar(evs.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.fecha)), "fecha siempre 'YYYY-MM-DD'");
  comprobar(
    evs.every((e, i) => (feedCrudo[i].allDay ? e.hora === null && e.todoElDia : e.hora === feedCrudo[i].date.slice(11, 16) && !e.todoElDia)),
    "hora = el reloj del string ISO (sin convertir zona); null si todoElDia",
  );
  const e24 = evs.find((e) => e.id === "6ac82d4b030fa4a6d5938de8");
  comprobar(e24.fecha === "2026-10-24" && e24.hora === "16:30", "2026-10-24T16:30:00.000Z → 2026-10-24 16:30 (no 10:30 de Colima)");
  const tarde = eventos.normalizarEvento({ ...feedCrudo[0], allDay: false, date: "2026-10-24T23:30:00.000Z" });
  comprobar(tarde.fecha === "2026-10-24" && tarde.hora === "23:30", "23:30Z sigue siendo 23:30 del mismo día");
  const conFin = evs.filter((e) => e.finFecha);
  comprobar(conFin.length === feedCrudo.filter((e) => e.moreDays).length && conFin.length === 6, "finFecha solo en los 6 eventos con moreDays");
  comprobar(conFin.every((e) => e.finFecha > e.fecha), "finFecha siempre posterior a fecha");
  comprobar(
    feedCrudo.every((c, i) => c.moreDays || (typeof c.finishDate === "number" ? evs[i].finFecha === null : true)),
    "el finishDate numérico (Date.now()) se ignora",
  );
  comprobar(
    evs.every((e, i) => (feedCrudo[i].municipality === null ? e.municipioId === null : typeof e.municipioId === "number" && e.municipioId === Number(feedCrudo[i].municipality))),
    "municipioId es número (el backend manda el string \"1\"…\"10\")",
  );
  comprobar(evs.every((e) => typeof e.imagen === "string" && e.imagen.startsWith("https://res.cloudinary.com/")), "imagen es la URL original (string)");
  comprobar(eventos.normalizarEvento({ ...feedCrudo[0], images: [] }).imagen === null, "images: [] → imagen null");
  comprobar(eventos.normalizarEvento({ ...feedCrudo[0], images: "" }).imagen === null, "images: \"\" → imagen null");
  comprobar(evs.every((e) => e.descripcion.es && e.descripcion.en) && eventos.normalizarEvento({ ...feedCrudo[0], descriptionEnglish: null }).descripcion.en === "", "descripcion {es,en}; en cae a '' si falta");
  comprobar(evs.every((e) => e.ubicacion === null), "sin ubicación cuando hasLocation es false (los 30 reales)");
  comprobar(evs.every((e) => Object.keys(e.redes).join() === "facebook"), "redes: solo las no vacías (los 30 reales traen solo facebook)");
  comprobar(evs.every((e) => e.likes >= 0 && e.vistas >= 0 && e.comentarios >= 0 && e.subTipo >= 1012 && e.esPortada === false && e.hijos.length === 0), "contadores, subTipo, esPortada e hijos");
  const lugar = { hasLocation: true, location: { name: "Jardín Núñez", descriptionLocation: "Centro", latitude: 19.24, longitude: -103.72 } };
  comprobar(
    JSON.stringify(eventos.normalizarEvento({ ...feedCrudo[0], ...lugar }).ubicacion) === JSON.stringify({ nombre: "Jardín Núñez", descripcion: "Centro", lat: 19.24, lng: -103.72 }),
    "ubicación válida {nombre,descripcion,lat,lng}",
  );
  comprobar(
    [
      { ...lugar, hasLocation: false },
      { ...lugar, location: { ...lugar.location, name: "" } },
      { ...lugar, location: { ...lugar.location, latitude: 0 } },
      { ...lugar, location: { ...lugar.location, longitude: NaN } },
    ].every((l) => eventos.normalizarEvento({ ...feedCrudo[0], ...l }).ubicacion === null),
    "ubicación descartada sin hasLocation, sin nombre, con lat/lng en 0 o no finitos",
  );
  const redes = eventos.normalizarEvento({ ...feedCrudo[0], socialNetworks: { web: "https://colima.gob.mx", facebook: "javascript:alert(1)", whatsapp: "", instagram: null, tiktok: "  ", youtube: "https://youtu.be/x", mail: "a@b.mx", phone: "312 100 0000" } }).redes;
  comprobar(Object.keys(redes).sort().join() === "mail,phone,web,youtube", "redes: ''/null/espacios y enlaces javascript: se descartan");
  comprobar(
    [{ ...feedCrudo[0], _id: "xyz" }, { ...feedCrudo[0], title: "" }, { ...feedCrudo[0], date: "2026-02-31T00:00:00.000Z" }, { ...feedCrudo[0], date: "hola" }, null, "x"].every((c) => eventos.normalizarEvento(c) === null),
    "sin id, sin título o con fecha inválida → null",
  );

  titulo("Orden y consultas (hoy = 2026-10-20):");
  const prox = eventos.proximos(evs, HOY);
  const pas = eventos.pasados(evs, HOY);
  const clave = (e) => `${e.fecha}T${e.hora || "00:00"}`;
  comprobar(prox.length === 8 && pas.length === 22, `8 próximos y 22 pasados (el informe del backend cuenta lo mismo): ${prox.length}/${pas.length}`);
  comprobar(prox.every((e, i) => i === 0 || clave(prox[i - 1]) <= clave(e)), "próximos: fecha + hora ascendente");
  comprobar(pas.every((e, i) => i === 0 || clave(pas[i - 1]) >= clave(e)), "pasados: más reciente primero");
  comprobar(prox[0].fecha === "2026-10-24" && pas[0].fecha === "2026-10-18", "primer próximo 24-oct; primer pasado 18-oct");
  comprobar(prox.length + pas.length === 30 && prox.every((p) => !pas.includes(p)), "próximos y pasados no se traslapan y suman 30");
  const enCurso = evs.find((e) => e.fecha === "2026-10-17" && e.finFecha === "2026-10-18");
  comprobar(eventos.esVigente(enCurso, "2026-10-18") && !eventos.esVigente(enCurso, "2026-10-19"), "esVigente usa finFecha: un evento de varios días sigue hasta su último día");
  comprobar(eventos.esVigente(evs.find((e) => e.fecha === "2026-10-24"), "2026-10-24"), "el día del evento todavía es vigente");
  const m1 = eventos.eventosDeMunicipio(evs, 1, HOY);
  comprobar(m1.length > 0 && m1.every((e) => e.municipioId === 1 && eventos.esVigente(e, HOY)) && m1.every((e, i) => i === 0 || clave(m1[i - 1]) <= clave(e)), "eventosDeMunicipio: vigentes del municipio, fecha ascendente");
  comprobar(eventos.eventosDeMunicipio(evs, "9", HOY).map((e) => e.id).join() === "6ac82d4b030fa4a6d5938de8", "eventosDeMunicipio acepta el id como texto (Cuauhtémoc → 1 evento vigente)");

  const fin = (f, ff) => eventos.normalizarEvento({ ...feedCrudo[0], allDay: true, moreDays: true, date: `${f}T00:00:00.000Z`, finishDate: `${ff}T00:00:00.000Z` });
  comprobar(eventos.diasDelEvento(evs.find((e) => e.fecha === "2026-10-31")).join() === "2026-10-31,2026-11-01,2026-11-02", "diasDelEvento cruza de mes: 31-oct → 2-nov");
  comprobar(eventos.diasDelEvento(evs.find((e) => e.fecha === "2026-12-01")).length === 12, "diasDelEvento 1 al 12 de diciembre = 12 días");
  comprobar(eventos.diasDelEvento(fin("2028-02-28", "2028-03-01")).join() === "2028-02-28,2028-02-29,2028-03-01", "diasDelEvento respeta el 29 de febrero (año bisiesto)");
  comprobar(eventos.diasDelEvento(fin("2027-02-28", "2027-03-01")).join() === "2027-02-28,2027-03-01", "…y no lo inventa en año común");
  comprobar(eventos.diasDelEvento(fin("2026-12-30", "2027-01-02")).join() === "2026-12-30,2026-12-31,2027-01-01,2027-01-02", "diasDelEvento cruza de año");
  comprobar(eventos.diasDelEvento(e24).join() === "2026-10-24", "un evento de un solo día → [fecha]");
  comprobar(eventos.diasDelEvento(fin("2026-01-01", "2030-01-01")).length === 400, "una finFecha absurda se corta a 400 días");

  titulo("hoyEnColima y urlImagen:");
  comprobar(/^\d{4}-\d{2}-\d{2}$/.test(eventos.hoyEnColima()), "hoyEnColima() → 'YYYY-MM-DD'");
  comprobar(eventos.hoyEnColima(new Date("2026-10-20T05:59:59Z")) === "2026-10-19", "05:59 UTC todavía es 19-oct en Colima (UTC-6)");
  comprobar(eventos.hoyEnColima(new Date("2026-10-20T06:00:00Z")) === "2026-10-20", "06:00 UTC ya es 20-oct en Colima");
  const cloud = "https://res.cloudinary.com/jsantiago/image/upload/v1791503296/eventos-pendientes/x.jpg";
  comprobar(eventos.urlImagen(cloud, 600) === "https://res.cloudinary.com/jsantiago/image/upload/w_600,q_auto,f_auto/v1791503296/eventos-pendientes/x.jpg", "urlImagen inserta w_<ancho>,q_auto,f_auto/ tras upload/");
  comprobar(eventos.urlImagen(eventos.urlImagen(cloud, 600), 600) === eventos.urlImagen(cloud, 600), "…y no la transforma dos veces");
  comprobar(eventos.urlImagen("https://example.com/a.jpg", 600) === "https://example.com/a.jpg", "otra URL queda igual");
  comprobar(eventos.urlImagen(null, 600) === null && eventos.urlImagen("", 600) === null, "null → null");

  // ======================================================================
  titulo("Feed: caché, reintentos y stale-if-error (backend falso):");
  // ======================================================================
  const cfg = eventos._interno.config;
  Object.assign(cfg, { esperasMs: [5, 10], falloEsperaMs: 0, timeoutMs: 300, timeoutFichaMs: 300 });

  reiniciarTodo();
  let n = recibidas.length;
  const a1 = await eventos.obtenerEventos();
  const a2 = await eventos.obtenerEventos();
  comprobar(estado.contadores.feed === 1 && llamadas(n, "GET", "/post").length === 1, "dos obtenerEventos seguidos → UNA llamada al backend");
  comprobar(a1.ok && a2.ok && a1.eventos.length === 30 && a1.actualizado === a2.actualizado && a1.actualizado > 0, "ok:true, 30 eventos, mismo `actualizado`");
  comprobar(llamadas(n, "GET", "/post")[0].authorization === null && Object.keys(llamadas(n, "GET", "/post")[0].query).length === 0, "el feed se pide sin token y sin parámetros");
  a1.eventos.sort((x, y) => x.fecha.localeCompare(y.fecha));
  comprobar((await eventos.obtenerEventos()).eventos[0].id === a2.eventos[0].id, "ordenar el arreglo devuelto no altera la caché");

  reiniciarTodo();
  estado.feedRetraso = 80;
  const grupo = await Promise.all([1, 2, 3, 4, 5].map(() => eventos.obtenerEventos()));
  estado.feedRetraso = 0;
  comprobar(estado.contadores.feed === 1 && grupo.every((g) => g.ok && g.eventos.length === 30), "5 llamadas simultáneas comparten UNA petición");

  eventos._interno.envejecer(61 * 1000);
  estado.feedModo = "500";
  estado.contadores.feed = 0;
  const previoActualizado = grupo[0].actualizado - 61 * 1000; // `actualizado` es la hora de la copia, ya envejecida
  const s1 = await eventos.obtenerEventos();
  comprobar(!s1.ok && s1.eventos.length === 30 && s1.actualizado === previoActualizado, "stale-if-error: el backend falla (503) → la lista anterior con ok:false");
  comprobar(estado.contadores.feed === 3, `5xx: 1 intento + 2 reintentos (${estado.contadores.feed} llamadas)`);
  estado.feedModo = "ok";
  const s2 = await eventos.obtenerEventos();
  comprobar(s2.ok && s2.eventos.length === 30 && s2.actualizado > previoActualizado, "al volver el backend, se recupera (ok:true y copia nueva)");

  eventos._interno.envejecer(61 * 60 * 1000 + 1000);
  estado.feedModo = "500";
  const s3 = await eventos.obtenerEventos();
  comprobar(!s3.ok && s3.eventos.length === 0 && s3.actualizado === 0, "pasada 1 h de la copia, ya no se sirve: [] con ok:false");

  reiniciarTodo();
  estado.feedModo = "400";
  const s4 = await eventos.obtenerEventos();
  comprobar(!s4.ok && s4.eventos.length === 0 && estado.contadores.feed === 1, "un 4xx no se reintenta (1 llamada)");

  reiniciarTodo();
  estado.feedModo = "caido";
  const s5 = await eventos.obtenerEventos();
  comprobar(!s5.ok && s5.eventos.length === 0 && estado.contadores.feed === 3, "error de red (conexión cortada): 3 intentos, no lanza");

  reiniciarTodo();
  estado.feedModo = "lento";
  cfg.timeoutMs = 100;
  const s6 = await eventos.obtenerEventos();
  cfg.timeoutMs = 300;
  comprobar(!s6.ok && s6.eventos.length === 0 && estado.contadores.feed === 3, "timeout: se corta la petición y se reintenta (3 intentos)");

  reiniciarTodo();
  cfg.falloEsperaMs = 60000;
  estado.feedModo = "500";
  await eventos.obtenerEventos();
  const antesEspera = estado.contadores.feed;
  await eventos.obtenerEventos();
  comprobar(antesEspera === 3 && estado.contadores.feed === 3, "tras un fallo total no se vuelve a golpear al backend durante la espera");
  cfg.falloEsperaMs = 0;

  reiniciarTodo();
  estado.feedModo = "raro";
  const raro = await eventos.obtenerEventos();
  comprobar(raro.ok && raro.eventos.length === 1, "el feed descarta lo que no sirve (sin id, sin título, fecha inválida, repetidos, basura)");

  titulo("obtenerEvento y obtenerTop10:");
  reiniciarTodo();
  await eventos.obtenerEventos();
  n = recibidas.length;
  const delFeed = await eventos.obtenerEvento(feedIds[3]);
  comprobar(delFeed && delFeed.id === feedIds[3] && llamadas(n, "GET", "/post/findOne").length === 0, "obtenerEvento sale de la caché del feed (sin llamar a findOne)");
  const extra = await eventos.obtenerEvento(ID_EXTRA);
  comprobar(extra && extra.titulo === "Evento fuera del feed" && llamadas(n, "GET", "/post/findOne").length === 1, "si no está en el feed, pide GET /post/findOne/?id=");
  await eventos.obtenerEvento(ID_EXTRA);
  comprobar(llamadas(n, "GET", "/post/findOne").length === 1, "…y recuerda la ficha 60 s");
  comprobar((await eventos.obtenerEvento(ID_NOEXISTE)) === null, "response:false (no existe) → null");
  comprobar((await eventos.obtenerEvento(ID_LOCAL)) === null, "un lugar (type ≠ 1, sin kind) → null");
  comprobar((await eventos.obtenerEvento(ID_PAUSADO)) === null, "un evento pausado (status:false) → null");
  n = recibidas.length;
  comprobar((await eventos.obtenerEvento("xyz")) === null && (await eventos.obtenerEvento("A".repeat(24))) === null && (await eventos.obtenerEvento(undefined)) === null && recibidas.length === n, "id que no son 24 hex → null sin llamar al backend");
  estado.forzar.set("GET /api/post/findOne", { status: 500, veces: 1 });
  eventos._interno.reiniciar();
  comprobar((await eventos.obtenerEvento("aaaaaaaaaaaaaaaaaaaaaaa3")) === null, "si findOne falla, devuelve null (no lanza)");

  reiniciarTodo();
  n = recibidas.length;
  comprobar(Array.isArray(await eventos.obtenerTop10()) && (await eventos.obtenerTop10()).length === 0 && llamadas(n, "GET", "/post/top10").length === 1, "top10 vacío ([] del backend) → [] y se cachea 60 s");
  for (const modo of ["array", "objeto"]) {
    reiniciarTodo();
    estado.top10Modo = modo;
    const t = await eventos.obtenerTop10();
    comprobar(
      t.length === 2 && mismasClaves(t[0], ["id", "titulo", "imagenes", "esPortada", "fecha"]) && t[0].imagenes.length === 1 && t[0].esPortada && !t[1].esPortada && /^\d{4}-\d{2}-\d{2}$/.test(t[0].fecha),
      `top10 acepta ${modo === "array" ? "un array directo" : "{ top10:[…] }"}`,
    );
  }
  reiniciarTodo();
  estado.top10Modo = "500";
  comprobar((await eventos.obtenerTop10()).length === 0, "top10 con el backend caído → []");

  // ======================================================================
  titulo("Sesión: login, cookie cifrada y CSRF:");
  // ======================================================================
  reiniciarTodo();
  n = recibidas.length;
  const login = await pedir("POST", "/g/login/google", { cuerpo: { credential: "cred.ana.google" } });
  const cookieAna = valorCookie(login);
  const setCookieAna = login.setCookie.find((c) => c.startsWith(`${sesion.NOMBRE_COOKIE}=`)) || "";
  const llegoLogin = llamadas(n, "POST", "/login/google")[0];
  comprobar(login.status === 200 && login.json.usuario.nombre === ANA.name && login.json.usuario.email === ANA.email && login.json.usuario.img === ANA.img, "login con Google: 200 y { usuario:{nombre,img,email} }");
  comprobar(mismasClaves(llegoLogin.json, ["token", "platform"]) && llegoLogin.json.platform === "web" && llegoLogin.authorization === null, "el backend recibe exactamente { token, platform:'web' } y sin Authorization");
  comprobar(!login.texto.includes(JWT_ANA) && !login.texto.includes(ANA.id) && !/"token"|"_id"/.test(login.texto), "la respuesta del login no trae el JWT, el _id ni 'token'");
  comprobar(
    /HttpOnly/i.test(setCookieAna) && /SameSite=Lax/i.test(setCookieAna) && /Max-Age=2592000(;|$)/.test(setCookieAna) && /Path=\//.test(setCookieAna) && !/Secure/i.test(setCookieAna),
    "cookie colimago.u: HttpOnly, SameSite=Lax, 30 días, Path=/ (sin Secure fuera de producción)",
  );
  const partesJwt = JWT_ANA.split(".");
  const pistas = [JWT_ANA, partesJwt[0], partesJwt[1], b64(JWT_ANA), Buffer.from(JWT_ANA).toString("base64"), ANA.email, b64(ANA.email), ANA.id];
  comprobar(cookieAna && pistas.every((p) => !decodeURIComponent(setCookieAna).includes(p)), "el JWT (ni su payload, ni el email) aparecen en claro en el Set-Cookie");
  const abierta = sesion._interno.descifrar(cookieAna);
  comprobar(abierta && abierta.t === JWT_ANA && abierta.i === ANA.id && abierta.n === ANA.name && abierta.g === ANA.img && abierta.e === ANA.email, "descifrada con la llave correcta trae {t,i,n,g,e}");
  const login2 = await pedir("POST", "/g/login/google", { cuerpo: { credential: "cred.ana.google" } });
  comprobar(valorCookie(login2) && valorCookie(login2) !== cookieAna, "cada cookie lleva un iv distinto (AES-GCM no repite)");

  const ses = await pedir("GET", "/g/sesion", { cookie: cookieAna });
  comprobar(ses.status === 200 && mismasClaves(ses.json.usuario, ["nombre", "img", "email"]) && ses.json.usuario.nombre === ANA.name, "GET /g/sesion con cookie → { usuario:{nombre,img,email} }");
  const sinSes = await pedir("GET", "/g/sesion");
  comprobar(sinSes.status === 200 && sinSes.json.usuario === null, "GET /g/sesion sin cookie → { usuario:null }");

  const mitad = Math.floor(cookieAna.length / 2);
  const alterada = cookieAna.slice(0, mitad) + (cookieAna[mitad] === "A" ? "B" : "A") + cookieAna.slice(mitad + 1);
  const rAlterada = await pedir("GET", "/g/sesion", { cookie: alterada });
  comprobar(rAlterada.json.usuario === null && cookieBorrada(rAlterada), "una cookie alterada es 'sin sesión' y se borra");
  const secretoReal = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "otro-secreto-distinto";
  const deOtraLlave = sesion._interno.cifrar({ t: JWT_ANA, i: ANA.id, n: "x", g: "", e: "x@y.z", x: Date.now() + 1e9 });
  process.env.SESSION_SECRET = secretoReal;
  comprobar((await pedir("GET", "/g/sesion", { cookie: deOtraLlave })).json.usuario === null, "una cookie cifrada con otro SESSION_SECRET no abre sesión");
  const vencida = sesion._interno.cifrar({ t: JWT_ANA, i: ANA.id, n: "x", g: "", e: "x@y.z", x: Date.now() - 1000 });
  comprobar((await pedir("GET", "/g/sesion", { cookie: vencida })).json.usuario === null, "una cookie de más de 30 días no abre sesión");
  const jwtVencido = jwtFalso(ANA, Math.floor(Date.now() / 1000) - 60);
  const conJwtVencido = sesion._interno.cifrar({ t: jwtVencido, i: ANA.id, n: "x", g: "", e: "x@y.z", x: Date.now() + 1e9 });
  n = recibidas.length;
  const rVencido = await pedir("GET", `/g/comentarios/${ID_ULTRA}`, { cookie: conJwtVencido });
  comprobar(rVencido.status === 200 && llamadas(n, "GET", "/comment")[0].authorization === null, "un JWT con exp vencido nunca se reenvía al backend (iría un 401)");

  // Secure en producción (se lee NODE_ENV en cada respuesta).
  {
    const mini = express();
    mini.get("/", (req, res) => {
      sesion.iniciarSesion(res, { token: JWT_ANA, user: { _id: ANA.id, name: ANA.name, email: ANA.email } });
      res.end("ok");
    });
    const srv = http.createServer(mini);
    await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
    process.env.NODE_ENV = "production";
    const rp = await fetch(`http://127.0.0.1:${srv.address().port}/`);
    process.env.NODE_ENV = "test";
    srv.close();
    comprobar(/;\s*Secure/i.test(rp.headers.getSetCookie()[0] || ""), "con NODE_ENV=production la cookie lleva Secure");
  }

  const mala = await pedir("POST", "/g/login/google", { cuerpo: { credential: "cred.mala.google" } });
  comprobar(mala.status === 401 && /Google/.test(mala.json.error) && valorCookie(mala) === null, "credencial rechazada por el backend → 401 en español, sin cookie");
  guiaApi._interno.reiniciar(); // el límite de login (8/min) cuenta también los intentos inválidos
  n = recibidas.length;
  const credencialesMalas = [{}, { credential: "" }, { credential: 123 }, { credential: { $ne: 1 } }, { credential: "no es un jwt" }, { credential: "a.b.c".padEnd(5000, "x") }];
  let todasMalas = true;
  for (const cuerpo of credencialesMalas) todasMalas = todasMalas && (await pedir("POST", "/g/login/google", { cuerpo })).status === 400;
  comprobar(todasMalas && recibidas.length === n, "credential ausente, vacía, no-texto o con forma rara → 400 sin llamar al backend");

  const lo = await pedir("POST", "/g/logout", { cookie: cookieAna });
  comprobar(lo.status === 200 && lo.json.ok === true && cookieBorrada(lo), "POST /g/logout borra la cookie");

  titulo("CSRF (verificarOrigen):");
  const hostSitio = new URL(base).host;
  const csrf = [
    ["sin X-Requested-With", { csrf: false }, 403],
    ["X-Requested-With distinto", { csrf: false, headers: { "X-Requested-With": "XMLHttpRequest" } }, 403],
    ["Origin de otro sitio", { headers: { Origin: "https://evil.example" } }, 403],
    ["Origin: null", { headers: { Origin: "null" } }, 403],
    ["Sec-Fetch-Site: cross-site", { headers: { "Sec-Fetch-Site": "cross-site" } }, 403],
    ["Sec-Fetch-Site: same-site", { headers: { "Sec-Fetch-Site": "same-site" } }, 403],
    ["cabecera + Origin del mismo sitio", { headers: { Origin: `http://${hostSitio}` } }, 200],
    ["cabecera + Sec-Fetch-Site: same-origin", { headers: { "Sec-Fetch-Site": "same-origin" } }, 200],
    ["cabecera sola (curl, sin Origin)", {}, 200],
  ];
  for (const [nombre, opc, esperado] of csrf) {
    const r = await pedir("POST", "/g/logout", opc);
    comprobar(r.status === esperado, `${nombre.padEnd(38)} → ${r.status}`);
  }
  comprobar((await pedir("GET", "/g/sesion", { headers: { Origin: "https://evil.example" } })).status === 200, "un GET no exige la cabecera");
  n = recibidas.length;
  const sinCsrf = [
    ["POST", "/g/me-gusta", { idPost: ID_ULTRA }], ["POST", `/g/comentarios/${ID_ULTRA}`, { contenido: "hola" }],
    ["DELETE", `/g/comentarios/${ID_ULTRA}/${ID_ULTRA}`], ["POST", `/g/vista/${ID_ULTRA}`], ["POST", "/g/metricas", { ids: [ID_ULTRA] }],
    ["POST", "/g/favoritos", { idPost: ID_ULTRA }], ["DELETE", `/g/favoritos/${ID_ULTRA}`], ["POST", "/g/favoritos/fusionar", { ids: [] }],
    ["POST", "/g/reportar", { idReport: ID_ULTRA, tipo: "post", texto: "x" }], ["POST", "/g/ocultar", { idPost: ID_ULTRA }], ["DELETE", "/g/cuenta"],
    ["POST", "/g/login/google", { credential: "cred.ana.google" }],
  ];
  let todo403 = true;
  for (const [m, ruta, cuerpo] of sinCsrf) todo403 = todo403 && (await pedir(m, ruta, { cuerpo, cookie: cookieAna, csrf: false })).status === 403;
  comprobar(todo403 && recibidas.length === n, "TODOS los endpoints que escriben dan 403 sin X-Requested-With y no llegan al backend");

  // ======================================================================
  titulo("Comentarios:");
  // ======================================================================
  reiniciarTodo();
  const cookieBeto = await entrar("cred.beto.google");
  const cAna = await entrar("cred.ana.google");
  n = recibidas.length;
  const anon = await pedir("GET", `/g/comentarios/${ID_ULTRA}`);
  const llegoC = llamadas(n, "GET", "/comment")[0];
  comprobar(anon.status === 200 && anon.json.comentarios.length === 2 && llegoC.authorization === null && llegoC.query.idPost === ID_ULTRA, "GET anónimo: 2 comentarios, backend sin Authorization, idPost en la query");
  comprobar(anon.json.comentarios.every((c) => mismasClaves(c, ["id", "nombre", "img", "texto", "fecha", "propio"])), "cada comentario trae solo {id,nombre,img,texto,fecha,propio}");
  comprobar(!anon.texto.includes(BETO.id) && !anon.texto.includes(ANA.id) && !/"user"|"status"|"_id"|"updatedAt"|"deleteComment"/.test(anon.texto), "no expone el _id del usuario, user, status ni deleteComment");
  comprobar(anon.json.comentarios[0].texto === comentarioCrudo.content && anon.json.comentarios[0].fecha === comentarioCrudo.createdAt && anon.json.comentarios[1].texto === "Estuvo padrísimo", "texto y fecha ISO intactos; orden: el más antiguo primero (como el backend)");
  comprobar(anon.json.comentarios.every((c) => c.propio === false), "anónimo: ningún comentario es propio");
  await pedir("GET", `/g/comentarios/${ID_ULTRA}`);
  comprobar(llamadas(n, "GET", "/comment").length === 1, "el GET anónimo se cachea unos segundos (1 sola llamada al backend)");
  const conSes = await pedir("GET", `/g/comentarios/${ID_ULTRA}`, { cookie: cAna });
  const llegoC2 = llamadas(n, "GET", "/comment")[1];
  comprobar(llegoC2 && llegoC2.authorization === `Bearer ${JWT_ANA}`, "con sesión sí manda Authorization: Bearer");
  comprobar(conSes.json.comentarios.map((c) => c.propio).join() === "false,true" && !conSes.texto.includes(ANA.id), "propio = deleteComment del backend (solo el de Ana), sin ids de usuario");

  n = recibidas.length;
  const pub = await pedir("POST", `/g/comentarios/${ID_ULTRA}`, { cuerpo: { contenido: "  Nos vemos ahí \u0007 " }, cookie: cAna });
  const llegoP = llamadas(n, "POST", "/comment")[0];
  comprobar(pub.status === 201 && pub.json.comentario.texto === "Nos vemos ahí" && pub.json.comentario.propio === true && pub.json.comentario.nombre === ANA.name && /^[a-f0-9]{24}$/.test(pub.json.comentario.id), "POST comentario: 201, texto recortado y limpio, propio:true");
  comprobar(mismasClaves(llegoP.json, ["idPost", "content"]) && llegoP.authorization === `Bearer ${JWT_ANA}` && llegoP.json.content === "Nos vemos ahí", "el backend recibe solo {idPost, content} con Authorization");
  const trasPublicar = await pedir("GET", `/g/comentarios/${ID_ULTRA}`);
  comprobar(trasPublicar.json.comentarios.length === 3, "publicar invalida la caché anónima");
  const sinSesionPub = await pedir("POST", `/g/comentarios/${ID_ULTRA}`, { cuerpo: { contenido: "hola" } });
  comprobar(sinSesionPub.status === 401 && sinSesionPub.json.requiereSesion === true, "comentar sin sesión → 401");

  n = recibidas.length;
  const borrarAjeno = await pedir("DELETE", `/g/comentarios/${ID_ULTRA}/dddddddddddddddddddddd01`, { cookie: cAna });
  comprobar(borrarAjeno.status === 404 && /comentario/.test(borrarAjeno.json.error), "borrar el comentario de otro → 404 en español");
  const borrar = await pedir("DELETE", `/g/comentarios/${ID_ULTRA}/${pub.json.comentario.id}`, { cookie: cAna });
  const llegoD = llamadas(n, "DELETE", "/comment").pop();
  comprobar(borrar.status === 200 && borrar.json.ok === true, "borrar el propio → { ok:true }");
  comprobar(llegoD.query.idPost === ID_ULTRA && llegoD.query.idComment === pub.json.comentario.id && llegoD.largo === 0 && llegoD.contentType === "" && llegoD.authorization === `Bearer ${JWT_ANA}`, "DELETE al backend: ids en la query string, sin cuerpo, con Authorization");
  const trasBorrar = await pedir("GET", `/g/comentarios/${ID_ULTRA}`);
  comprobar(trasBorrar.json.comentarios.length === 2, "borrar invalida la caché anónima");
  const noExiste = await pedir("GET", `/g/comentarios/${ID_NOEXISTE}`);
  comprobar(noExiste.status === 404 && noExiste.json.error === "No encontramos esa publicación.", "post inexistente → 404 'No encontramos esa publicación.'");

  // ======================================================================
  titulo("Me gusta (Authorization, toggle):");
  // ======================================================================
  n = recibidas.length;
  const like1 = await pedir("POST", "/g/me-gusta", { cuerpo: { idPost: ID_ULTRA, token: "intento", name: "x" }, cookie: cAna });
  const llegoL = llamadas(n, "POST", "/like")[0];
  comprobar(like1.status === 200 && like1.json.ok === true && like1.json.activo === true, "primer toque: { ok:true, activo:true } ('New like added')");
  comprobar(llegoL.authorization === `Bearer ${JWT_ANA}`, "manda Authorization: Bearer <jwt del usuario>");
  comprobar(Object.keys(llegoL.query).length === 0 && mismasClaves(llegoL.json, ["idPost"]) && !JSON.stringify(llegoL.json).includes("token"), "nada en la query; el body es solo { idPost } (ignora campos extra del navegador)");
  const like2 = await pedir("POST", "/g/me-gusta", { cuerpo: { idPost: ID_ULTRA }, cookie: cAna });
  comprobar(like2.json.activo === false, "segundo toque: activo:false ('Like removed')");
  n = recibidas.length;
  const sinLike = await pedir("POST", "/g/me-gusta", { cuerpo: { idPost: ID_ULTRA } });
  comprobar(sinLike.status === 401 && sinLike.json.requiereSesion === true && recibidas.length === n, "sin sesión → 401 y no llega al backend");

  // ======================================================================
  titulo("Un 401 del backend con token de usuario borra la cookie:");
  // ======================================================================
  estado.revocados.add(JWT_ANA);
  n = recibidas.length;
  const exp1 = await pedir("POST", "/g/me-gusta", { cuerpo: { idPost: ID_ULTRA }, cookie: cAna });
  comprobar(exp1.status === 401 && exp1.json.sesionExpirada === true && exp1.json.error === "Tu sesión expiró, inicia sesión de nuevo." && cookieBorrada(exp1), "me-gusta: 401 { sesionExpirada:true } y Set-Cookie que borra colimago.u");
  reiniciarTodo();
  estado.revocados.add(JWT_ANA);
  n = recibidas.length;
  const exp3 = await pedir("GET", `/g/comentarios/${ID_ULTRA}`, { cookie: cAna });
  const intentos = llamadas(n, "GET", "/comment");
  comprobar(exp3.status === 200 && intentos.length === 2 && intentos[0].authorization === `Bearer ${JWT_ANA}` && intentos[1].authorization === null && cookieBorrada(exp3), "GET comentarios con token revocado: borra la cookie y reintenta anónimo (200)");
  n = recibidas.length;
  const exp4 = await pedir("POST", `/g/vista/${ID_ULTRA}`, { cookie: cAna });
  comprobar(exp4.status === 204 && llamadas(n, "POST", "/view").pop().authorization === null && cookieBorrada(exp4), "vista con token revocado: 204, reintenta anónimo y borra la cookie");
  n = recibidas.length;
  const exp5 = await pedir("POST", "/g/metricas", { cuerpo: { ids: [ID_ULTRA] }, cookie: cAna });
  comprobar(exp5.status === 200 && exp5.json.metricas[ID_ULTRA] && cookieBorrada(exp5) && llamadas(n, "POST", "/metrics").pop().authorization === null, "métricas con token revocado: reintenta anónimo y borra la cookie");
  for (const [m, ruta, cuerpo] of [["GET", "/g/favoritos"], ["POST", "/g/favoritos", { idPost: feedIds[2] }], ["POST", "/g/ocultar", { idPost: ID_ULTRA }], ["DELETE", "/g/cuenta"], ["POST", "/g/reportar", { idReport: ID_ULTRA, tipo: "post", texto: "x" }], ["POST", `/g/comentarios/${ID_ULTRA}`, { contenido: "hola" }]]) {
    const r = await pedir(m, ruta, { cuerpo, cookie: cAna });
    comprobar(r.status === 401 && r.json.sesionExpirada === true && cookieBorrada(r), `${m} ${ruta.split("/").slice(0, 3).join("/")}: 401 sesionExpirada y cookie borrada`);
  }

  // ======================================================================
  titulo("Vistas y métricas:");
  // ======================================================================
  reiniciarTodo();
  const c1 = await entrar("cred.ana.google");
  n = recibidas.length;
  const v1 = await pedir("POST", `/g/vista/${ID_ULTRA}`);
  const llegoV = llamadas(n, "POST", "/view")[0];
  comprobar(v1.status === 204 && v1.texto === "" && llegoV.authorization === null && mismasClaves(llegoV.json, ["idPost"]), "vista anónima: 204 sin cuerpo; backend sin Authorization y body { idPost }");
  await pedir("POST", `/g/vista/${ID_ULTRA}`, { cookie: c1 });
  comprobar(llamadas(n, "POST", "/view")[1].authorization === `Bearer ${JWT_ANA}`, "vista con sesión: manda Authorization");
  estado.vistaFalla = true;
  comprobar((await pedir("POST", `/g/vista/${ID_ULTRA}`)).status === 204, "si el backend falla (500) la vista igual responde 204");
  estado.vistaFalla = false;
  estado.forzar.set("POST /api/view", { status: 429, veces: 1 });
  comprobar((await pedir("POST", `/g/vista/${ID_ULTRA}`)).status === 204, "…y también con un 429 del backend");

  reiniciarTodo();
  const c2 = await entrar("cred.ana.google");
  estado.likes.set(ID_ULTRA, new Set([ANA.id]));
  n = recibidas.length;
  const mAnon = await pedir("POST", "/g/metricas", { cuerpo: { ids: [ID_ULTRA, feedIds[0], ID_NOEXISTE] } });
  const llegoM = llamadas(n, "POST", "/metrics")[0];
  comprobar(mAnon.status === 200 && llegoM.authorization === null && mismasClaves(llegoM.json, ["ids"]), "métricas anónimas: sin Authorization, body { ids }");
  const mu = mAnon.json.metricas[ID_ULTRA];
  comprobar(mismasClaves(mu, ["likes", "activo", "comentarios", "vistas", "favorito"]) && mu.likes === findOneCrudo.post.likes + 1 && mu.activo === false && mu.favorito === false && mu.comentarios === 2 && mu.vistas === findOneCrudo.post.views, "forma { likes, activo, comentarios, vistas, favorito }; anónimo: activo y favorito en false");
  comprobar(!(ID_NOEXISTE in mAnon.json.metricas) && Object.keys(mAnon.json.metricas).length === 2, "un id desconocido simplemente no aparece");
  await pedir("POST", "/g/metricas", { cuerpo: { ids: [feedIds[0], ID_ULTRA] } });
  comprobar(llamadas(n, "POST", "/metrics").length === 1, "caché de 30 s para anónimos: el segundo pedido no llega al backend");
  await pedir("POST", "/g/metricas", { cuerpo: { ids: [feedIds[0], feedIds[1]] } });
  comprobar(llamadas(n, "POST", "/metrics").length === 2 && llamadas(n, "POST", "/metrics")[1].json.ids.join() === feedIds[1], "…y de un pedido mixto solo se piden al backend los que faltan");
  const mConSes = await pedir("POST", "/g/metricas", { cuerpo: { ids: [ID_ULTRA, feedIds[0]] }, cookie: c2 });
  const llegoM3 = llamadas(n, "POST", "/metrics")[2];
  comprobar(llegoM3.authorization === `Bearer ${JWT_ANA}` && mConSes.json.metricas[ID_ULTRA].activo === true && mConSes.json.metricas[feedIds[0]].favorito === true, "con sesión: Authorization, activo (like) y favorito del usuario");
  await pedir("POST", "/g/metricas", { cuerpo: { ids: [ID_ULTRA, feedIds[0]] }, cookie: c2 });
  comprobar(llamadas(n, "POST", "/metrics").length === 4, "con sesión NUNCA se cachea");
  n = recibidas.length;
  const muchos = Array.from({ length: 150 }, () => nuevoId());
  const mMuchos = await pedir("POST", "/g/metricas", { cuerpo: { ids: muchos } });
  const trozos = llamadas(n, "POST", "/metrics");
  comprobar(mMuchos.status === 200 && trozos.length === 2 && trozos[0].json.ids.length === 100 && trozos[1].json.ids.length === 50, "150 ids se parten en llamadas de 100 + 50");

  // ======================================================================
  titulo("Favoritos de cuenta:");
  // ======================================================================
  reiniciarTodo();
  const c3 = await entrar("cred.ana.google");
  comprobar((await pedir("GET", "/g/favoritos")).status === 401, "GET /g/favoritos sin sesión → 401");
  n = recibidas.length;
  const fav = await pedir("GET", "/g/favoritos", { cookie: c3 });
  const ev0 = fav.json.favoritos.find((f) => f.id === feedIds[0]);
  const lu0 = fav.json.favoritos.find((f) => f.id === ID_LOCAL);
  comprobar(fav.status === 200 && llamadas(n, "GET", "/favorite")[0].authorization === `Bearer ${JWT_ANA}` && fav.json.favoritos.length === 2, "GET /g/favoritos → lista del backend con Authorization");
  comprobar(mismasClaves(ev0, ["id", "titulo", "imagen", "esPortada", "fecha", "tipo"]) && ev0.tipo === "evento" && ev0.imagen === feedCrudo[0].images && ev0.fecha === "2026-10-24", "evento: tipo 'evento', imagen = URL, fecha 'YYYY-MM-DD'");
  comprobar(lu0.tipo === "lugar" && lu0.imagen === "rio-los-amiales" && lu0.fecha === "2026-09-14", "lugar (kind local): tipo 'lugar', imagen = imageKey");
  const add = await pedir("POST", "/g/favoritos", { cuerpo: { idPost: feedIds[1] }, cookie: c3 });
  comprobar(add.status === 200 && add.json.ok === true && estado.favoritos.get(ANA.id).includes(feedIds[1]), "POST /g/favoritos → { ok:true }");
  comprobar((await pedir("POST", "/g/favoritos", { cuerpo: { idPost: feedIds[1] }, cookie: c3 })).json.ok === true, "agregar uno que ya estaba ('already exist') se toma como éxito");
  n = recibidas.length;
  const quitar = await pedir("DELETE", `/g/favoritos/${feedIds[1]}`, { cookie: c3 });
  const llegoF = llamadas(n, "DELETE", "/favorite")[0];
  comprobar(quitar.status === 200 && llegoF.query.idPost === feedIds[1] && llegoF.largo === 0 && llegoF.contentType === "" && llegoF.authorization === `Bearer ${JWT_ANA}`, "DELETE /g/favoritos/:id → DELETE al backend con idPost en la query, sin cuerpo");
  comprobar((await pedir("DELETE", `/g/favoritos/${feedIds[1]}`, { cookie: c3 })).json.ok === true, "quitar uno que ya no estaba se toma como éxito");
  estado.maxEnVuelo = 0;
  n = recibidas.length;
  const nuevosFav = [feedIds[0], feedIds[4], ID_NOEXISTE, feedIds[5]]; // el primero ya está; uno no existe
  const fusion = await pedir("POST", "/g/favoritos/fusionar", { cuerpo: { ids: nuevosFav }, cookie: c3 });
  const subidos = llamadas(n, "POST", "/favorite");
  comprobar(subidos.map((s) => s.json.idPost).join() === [feedIds[4], ID_NOEXISTE, feedIds[5]].join(), "fusionar sube solo los que faltan, en el orden recibido");
  comprobar(estado.maxEnVuelo === 1, "…uno por uno (nunca dos peticiones a la vez)");
  comprobar(fusion.status === 200 && !fusion.json.incompleto && [feedIds[0], feedIds[4], feedIds[5], ID_LOCAL].every((id) => fusion.json.favoritos.some((f) => f.id === id)) && fusion.json.favoritos.length === 4, "…ignora 'Post not found' y devuelve la lista completa como GET");
  n = recibidas.length;
  estado.forzar.set("POST /api/favorite", { status: 429, veces: 1 });
  const parcial = await pedir("POST", "/g/favoritos/fusionar", { cuerpo: { ids: [feedIds[6], feedIds[7]] }, cookie: c3 });
  comprobar(parcial.status === 200 && parcial.json.incompleto === true && llamadas(n, "POST", "/favorite").length === 1, "si el backend responde 429 a mitad, se detiene y marca incompleto:true");
  comprobar((await pedir("POST", "/g/favoritos/fusionar", { cuerpo: { ids: [] }, cookie: c3 })).status === 200, "fusionar con [] solo devuelve la lista");

  // ======================================================================
  titulo("Reportar, ocultar y borrar cuenta:");
  // ======================================================================
  n = recibidas.length;
  const rep = await pedir("POST", "/g/reportar", { cuerpo: { idReport: ID_ULTRA, tipo: "comment", texto: "  Es spam  ", extra: 1 }, cookie: c3 });
  const llegoR = llamadas(n, "POST", "/report")[0];
  comprobar(rep.status === 200 && rep.json.ok === true && mismasClaves(llegoR.json, ["idReport", "type", "text"]) && llegoR.json.type === "comment" && llegoR.json.text === "Es spam" && llegoR.authorization === `Bearer ${JWT_ANA}`, "reportar: { idReport, type, text } recortado, con Authorization");
  n = recibidas.length;
  const ocul = await pedir("POST", "/g/ocultar", { cuerpo: { idPost: ID_ULTRA }, cookie: c3 });
  comprobar(ocul.status === 200 && mismasClaves(llamadas(n, "POST", "/hide")[0].json, ["idPost"]), "ocultar: POST /hide { idPost }");
  comprobar((await pedir("POST", "/g/ocultar", { cuerpo: { idPost: ID_ULTRA }, cookie: c3 })).json.ok === true, "ocultar uno ya oculto ('already exist hide') se toma como éxito");
  n = recibidas.length;
  const cuenta = await pedir("DELETE", "/g/cuenta", { cookie: c3 });
  const llegoCta = llamadas(n, "DELETE", "/configuration/delete")[0];
  comprobar(cuenta.status === 200 && cuenta.json.ok === true && llegoCta.authorization === `Bearer ${JWT_ANA}` && llegoCta.largo === 0 && cookieBorrada(cuenta), "DELETE /g/cuenta: borra en el backend (con Authorization, sin cuerpo) y cierra sesión");

  // ======================================================================
  titulo("Errores del backend en español:");
  // ======================================================================
  reiniciarTodo();
  const c4 = await entrar("cred.ana.google");
  estado.forzar.set("POST /api/like", { status: 429, veces: 1 });
  const e429 = await pedir("POST", "/g/me-gusta", { cuerpo: { idPost: ID_ULTRA }, cookie: c4 });
  comprobar(e429.status === 429 && e429.json.error === "Demasiadas solicitudes, intenta de nuevo en un momento.", "429 del backend → 429 'Demasiadas solicitudes, intenta de nuevo en un momento.'");
  estado.forzar.set("POST /api/like", { status: 500, veces: 1 });
  const e500 = await pedir("POST", "/g/me-gusta", { cuerpo: { idPost: ID_ULTRA }, cookie: c4 });
  comprobar(e500.status === 502 && !valorCookie(e500) && !cookieBorrada(e500), "500 del backend → 502 en español (y la sesión sigue)");
  const eNoPost = await pedir("POST", "/g/me-gusta", { cuerpo: { idPost: ID_NOEXISTE }, cookie: c4 });
  comprobar(eNoPost.status === 404 && eNoPost.json.error === "No encontramos esa publicación.", "{ response:false, 'Post not found' } → 404 'No encontramos esa publicación.'");
  estado.forzar.set("POST /api/comment", { status: 200, body: { message: "Error new comment", response: false }, veces: 1 });
  const eInterno = await pedir("POST", `/g/comentarios/${ID_ULTRA}`, { cuerpo: { contenido: "hola" }, cookie: c4 });
  comprobar(eInterno.status === 502 && /No se pudo completar/.test(eInterno.json.error), "{ response:false } interno → 502 en español");
  estado.forzar.set("POST /api/comment", { status: 429, veces: 1 });
  comprobar((await pedir("POST", `/g/comentarios/${ID_ULTRA}`, { cuerpo: { contenido: "hola" }, cookie: c4 })).status === 429, "429 al comentar → 429");
  estado.forzar.set("POST /api/login/google", { status: 429, veces: 1 });
  const login429 = await pedir("POST", "/g/login/google", { cuerpo: { credential: "cred.ana.google" } });
  comprobar(login429.status === 429 && login429.json.error === "Demasiadas solicitudes, intenta de nuevo en un momento.", "429 del backend en el login → 429 amable");
  const guardado = process.env.COLIMA_BACKEND_URL;
  process.env.COLIMA_BACKEND_URL = "http://127.0.0.1:1/api"; // nadie escucha
  const eRed = await pedir("POST", "/g/me-gusta", { cuerpo: { idPost: ID_ULTRA }, cookie: c4 });
  process.env.COLIMA_BACKEND_URL = guardado;
  comprobar(eRed.status === 502 && !cookieBorrada(eRed), "backend inalcanzable → 502 en español, sin borrar la sesión");
  delete process.env.COLIMA_BACKEND_URL;
  const eSinUrl = await pedir("POST", "/g/me-gusta", { cuerpo: { idPost: ID_ULTRA }, cookie: c4 });
  process.env.COLIMA_BACKEND_URL = guardado;
  comprobar(eSinUrl.status === 503, "sin COLIMA_BACKEND_URL → 503 en español");

  // ======================================================================
  titulo("Límites propios (antes de llamar al backend):");
  // ======================================================================
  reiniciarTodo();
  n = recibidas.length;
  let codigos = [];
  for (let i = 0; i < 9; i++) codigos.push((await pedir("POST", "/g/login/google", { cuerpo: { credential: "cred.mala.google" } })).status);
  const rLim = await pedir("POST", "/g/login/google", { cuerpo: { credential: "cred.ana.google" } });
  comprobar(codigos.slice(0, 8).every((c) => c === 401) && codigos[8] === 429 && llamadas(n, "POST", "/login/google").length === 8, "login: 8 por minuto por IP; el 9.º da 429 sin llamar al backend");
  comprobar(rLim.status === 429 && Number(rLim.headers.get("retry-after")) >= 1 && rLim.json.reintentarEn >= 1 && /minuto/.test(rLim.json.error), "…con Retry-After y mensaje en español");

  reiniciarTodo();
  const c5 = await entrar("cred.ana.google");
  const cB = await entrar("cred.beto.google");
  n = recibidas.length;
  codigos = [];
  for (let i = 0; i < 16; i++) codigos.push((await pedir("POST", `/g/comentarios/${ID_ULTRA}`, { cuerpo: { contenido: `comentario ${i}` }, cookie: c5 })).status);
  comprobar(codigos.slice(0, 15).every((c) => c === 201) && codigos[15] === 429 && llamadas(n, "POST", "/comment").length === 15, "comentarios: 15 por minuto por usuario; el 16.º da 429 sin llamar al backend");
  comprobar((await pedir("POST", `/g/comentarios/${ID_ULTRA}`, { cuerpo: { contenido: "yo sí puedo" }, cookie: cB })).status === 201, "el límite es por usuario: otro usuario sigue pudiendo comentar");

  reiniciarTodo();
  const c6 = await entrar("cred.ana.google");
  n = recibidas.length;
  codigos = [];
  for (let i = 0; i < 6; i++) codigos.push((await pedir("POST", "/g/reportar", { cuerpo: { idReport: ID_ULTRA, tipo: "post", texto: `motivo ${i}` }, cookie: c6 })).status);
  comprobar(codigos.slice(0, 5).every((c) => c === 200) && codigos[5] === 429 && llamadas(n, "POST", "/report").length === 5, "reportes: 5 por minuto por usuario; el 6.º da 429 sin llamar al backend");

  reiniciarTodo();
  n = recibidas.length;
  codigos = [];
  for (let i = 0; i < 61; i++) codigos.push((await pedir("POST", `/g/vista/${ID_ULTRA}`)).status);
  comprobar(codigos.slice(0, 60).every((c) => c === 204) && codigos[60] === 429 && llamadas(n, "POST", "/view").length === 60, "vistas: 60 por minuto por IP; la 61.ª da 429 sin llamar al backend");

  reiniciarTodo();
  const c7 = await entrar("cred.ana.google");
  codigos = [];
  for (let i = 0; i < 6; i++) codigos.push((await pedir("POST", "/g/favoritos/fusionar", { cuerpo: { ids: [] }, cookie: c7 })).status);
  comprobar(codigos.slice(0, 5).every((c) => c === 200) && codigos[5] === 429, "fusionar favoritos: 5 por minuto por usuario");

  // ======================================================================
  titulo("Validación de ids, longitudes y cuerpos:");
  // ======================================================================
  reiniciarTodo();
  const c8 = await entrar("cred.ana.google");
  n = recibidas.length;
  const malos = [
    ["POST", "/g/me-gusta", { idPost: "abc" }], ["POST", "/g/me-gusta", { idPost: "A".repeat(24) }], ["POST", "/g/me-gusta", { idPost: { $ne: 1 } }], ["POST", "/g/me-gusta", {}],
    ["GET", "/g/comentarios/xyz"], ["POST", "/g/comentarios/xyz", { contenido: "hola" }], ["DELETE", `/g/comentarios/${ID_ULTRA}/xyz`], ["DELETE", `/g/comentarios/xyz/${ID_ULTRA}`],
    ["POST", "/g/vista/xyz"],
    ["POST", "/g/metricas", { ids: ["abc"] }], ["POST", "/g/metricas", { ids: [] }], ["POST", "/g/metricas", {}], ["POST", "/g/metricas", { ids: "x" }],
    ["POST", "/g/metricas", { ids: Array.from({ length: 201 }, () => ID_ULTRA) }], ["POST", "/g/metricas", { ids: [ID_ULTRA, 5] }],
    ["POST", "/g/favoritos", { idPost: "abc" }], ["DELETE", "/g/favoritos/xyz"],
    ["POST", "/g/favoritos/fusionar", { ids: ["abc"] }], ["POST", "/g/favoritos/fusionar", { ids: Array.from({ length: 201 }, () => ID_ULTRA) }], ["POST", "/g/favoritos/fusionar", {}],
    ["POST", "/g/reportar", { idReport: "abc", tipo: "post", texto: "x" }], ["POST", "/g/reportar", { idReport: ID_ULTRA, tipo: "user", texto: "x" }],
    ["POST", "/g/reportar", { idReport: ID_ULTRA, tipo: "post", texto: "" }], ["POST", "/g/reportar", { idReport: ID_ULTRA, tipo: "post", texto: "   " }],
    ["POST", "/g/reportar", { idReport: ID_ULTRA, tipo: "post", texto: "a".repeat(1001) }], ["POST", "/g/reportar", { idReport: ID_ULTRA, tipo: "post", texto: 5 }],
    ["POST", "/g/ocultar", { idPost: "abc" }],
  ];
  let todos400 = true;
  const fallaron = [];
  for (const [m, ruta, cuerpo] of malos) {
    const r = await pedir(m, ruta, { cuerpo, cookie: c8 });
    if (r.status !== 400) {
      todos400 = false;
      fallaron.push(`${m} ${ruta} → ${r.status}`);
    }
    guiaApi._interno.reiniciar(); // que el límite no tape la validación
  }
  comprobar(todos400 && recibidas.length === n, `${malos.length} peticiones con ids o datos inválidos → 400 y NINGUNA llega al backend${fallaron.length ? " (fallaron: " + fallaron.join("; ") + ")" : ""}`);
  const largos = [["", 400], ["   \n  ", 400], [7, 400], ["a".repeat(501), 400], ["a".repeat(500), 201], ["a", 201]];
  for (const [contenido, esperado] of largos) {
    const r = await pedir("POST", `/g/comentarios/${ID_ULTRA}`, { cuerpo: { contenido }, cookie: c8 });
    comprobar(r.status === esperado, `comentario de ${typeof contenido === "string" ? JSON.stringify(contenido.length > 12 ? `${contenido.length} caracteres` : contenido) : "tipo " + typeof contenido} → ${r.status}${r.status === 400 ? ` ("${r.json.error}")` : ""}`);
  }
  comprobar((await pedir("POST", "/g/reportar", { cuerpo: { idReport: ID_ULTRA, tipo: "photo", texto: "a".repeat(1000) }, cookie: c8 })).status === 200, "reporte de exactamente 1000 caracteres → 200");
  const grande = await pedir("POST", `/g/comentarios/${ID_ULTRA}`, { cuerpo: { contenido: "a".repeat(9000) }, cookie: c8 });
  comprobar(grande.status === 413 && /grande/.test(grande.json.error), "cuerpo de más de 8 kB → 413 en español");
  const ocho = await pedir("POST", "/g/metricas", { cuerpo: { ids: [ID_ULTRA], relleno: "x".repeat(8300) } });
  comprobar(ocho.status === 413, "el límite de 8 kB se mide también cuando otro parser ya leyó el cuerpo");
  const malJson = await pedir("POST", "/g/me-gusta", { crudo: "{esto no es json", cookie: c8 });
  comprobar(malJson.status === 400 && /JSON/.test(malJson.json.error), "JSON mal formado → 400 en español");
  const arreglo = await pedir("POST", "/g/me-gusta", { crudo: "[1,2]", cookie: c8 });
  comprobar(arreglo.status === 400, "un arreglo como cuerpo → 400");
  const nada = await pedir("GET", "/g/no-existe");
  comprobar(nada.status === 404 && nada.json && nada.json.error === "Esa ruta no existe.", "una ruta desconocida bajo /g → 404 JSON");
  comprobar((await pedir("GET", "/g/sesion")).headers.get("cache-control") === "no-store" && (await pedir("GET", `/g/comentarios/${ID_ULTRA}`)).headers.get("cache-control") === "no-store" && ocho.headers.get("cache-control") === "no-store", "todas las respuestas llevan Cache-Control: no-store");

  titulo("Idioma de los errores:");
  const ingles = errores.filter((e) => /not found|invalid|failed|unauthorized|missing|too many|already|forbidden|bad request/i.test(e));
  comprobar(errores.length > 40 && ingles.length === 0, `los ${errores.length} mensajes de error vistos en esta corrida están en español${ingles.length ? " (en inglés: " + [...new Set(ingles)].join(" | ") + ")" : ""}`);

  sitio.close();
  backendFalso.close();
  console.log(
    fallos
      ? `\n${fallos} de ${total} comprobaciones fallaron.`
      : `\nTodo bien: ${total} comprobaciones. Eventos normalizados y cacheados, sesión cifrada, CSRF, límites propios y endpoints /g/* hablan con el backend solo con Authorization: Bearer y sin exponer tokens ni ids de usuario.`,
  );
  process.exit(fallos ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
