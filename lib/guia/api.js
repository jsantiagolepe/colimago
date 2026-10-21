// API JSON de la guía web, para el navegador: sesión de usuario, me gusta,
// comentarios, vistas, métricas, favoritos de cuenta, reportes, ocultar y
// borrar cuenta. El navegador NUNCA habla con backColimaApp (NestJS en
// Heroku): este router es el proxy. Cada endpoint valida lo que llega,
// llama al backend con lib/colima-backend.js (el mismo cliente del panel) y
// devuelve solo lo que la página necesita: nunca un token, ni el email o el
// _id de otro usuario.
//
// Montaje en server.js (el router ya incluye su propio 404 y su manejador de
// errores para todo lo que cuelga de /g):
//
//   const guiaApi = require("./lib/guia/api");
//   app.use("/g", guiaApi);   // antes del 404 general; mejor aún, antes de express.json()
//
// Es independiente de POST /auth/google y del panel: tiene su propia cookie
// ('colimago.u', ver lib/guia/sesion.js), acepta CUALQUIER cuenta de Google y
// guarda el JWT que devuelve el backend cifrado dentro de la cookie.
//
// Reglas comunes:
//   · Todo responde JSON, con mensajes de error en español y
//     `Cache-Control: no-store` (más X-Robots-Tag: noindex).
//   · Los ids (idPost, idReport, :id…) se validan con /^[a-f0-9]{24}$/ antes
//     de llamar al backend (él contesta 200 con error genérico si no lo son).
//   · Cuerpo máximo de 8 kB (413 si se pasa). Aunque server.js ya haya leído
//     el cuerpo con su express.json() global, aquí se vuelve a medir.
//   · POST/PUT/PATCH/DELETE exigen verificarOrigen (cabecera
//     `X-Requested-With: colimago` y mismo origen): 403 si no.
//   · Errores del backend: 401 con token de usuario → se borra la cookie y se
//     responde 401 { error, sesionExpirada:true }; 429 → 429 con mensaje
//     amable; { response:false } → 400/404/409/502 según el mensaje; red
//     caída o timeout → 502/504. El Authorization solo se manda cuando hay
//     sesión y la ruta lo necesita.
//   · El backend limita por IP y TODOS los visitantes de la web salen por la
//     IP de Vercel: login 10/min, comentario 15/min, reporte 5/min, ocultar
//     30/min y el resto 120/min por ruta, compartidos. Por eso aquí hay
//     límites propios (por IP o por usuario) ANTES de llamar, y cachés
//     cortas para lo anónimo (comentarios 20 s, métricas 30 s). Los límites
//     y cachés viven en la memoria de cada instancia de Vercel.
//
// Endpoints (todos bajo /g):
//   GET    /sesion                       → { usuario:{nombre,img,email}|null }
//   POST   /login/google {credential}    → { usuario } (8/min por IP)
//   POST   /logout                       → { ok:true }
//   POST   /me-gusta {idPost}            → { ok:true, activo:boolean } (toggle)
//   GET    /comentarios/:id              → { comentarios:[{id,nombre,img,texto,fecha,propio}] }
//   POST   /comentarios/:id {contenido}  → 201 { comentario } (1–500 caracteres, 15/min por usuario)
//   DELETE /comentarios/:id/:idComentario→ { ok:true }
//   POST   /vista/:id                    → 204 (ignora fallos; 60/min por IP)
//   POST   /metricas {ids:[…≤200]}       → { metricas:{ id:{likes,activo,comentarios,vistas,favorito} } }
//   GET    /favoritos                    → { favoritos:[{id,titulo,imagen,esPortada,fecha,tipo}] }
//   POST   /favoritos {idPost}           → { ok:true }
//   DELETE /favoritos/:id                → { ok:true }
//   POST   /favoritos/fusionar {ids:[…≤200]} → { favoritos[, incompleto:true] }
//   POST   /reportar {idReport,tipo,texto} → { ok:true } (tipo post|comment|photo, texto 1–1000, 5/min por usuario)
//   POST   /ocultar {idPost}             → { ok:true }
//   DELETE /cuenta                       → { ok:true } (borra la cuenta en el backend y cierra sesión)
//
// Variable de entorno: COLIMA_BACKEND_URL (la misma que usa todo el sitio);
// sin ella los endpoints que llaman al backend responden 503.

const express = require("express");
const { llamarBackend, BackendError } = require("../colima-backend");
const {
  middlewareSesion,
  iniciarSesion,
  cerrarSesion,
  exigirUsuario,
  verificarOrigen,
  limitar,
  ipDe,
  usuarioPublico,
} = require("./sesion");
const { fechaDeIso } = require("./eventos");

const router = express.Router();

const ID_RE = /^[a-f0-9]{24}$/;
const CREDENCIAL_RE = /^[\w-]+\.[\w-]+\.[\w-]+$/; // un id_token de Google es un JWT
const MAX_CUERPO = 8 * 1024;
const TIMEOUT_MS = 12000;
const MAX_COMENTARIO = 500;
const MAX_REPORTE = 1000;
const MAX_IDS = 200; // por petición a /metricas y /favoritos/fusionar
const TROZO_METRICAS = 100; // el backend admite 100 ids por llamada
const TIPOS_REPORTE = new Set(["post", "comment", "photo"]);

const TTL_COMENTARIOS_MS = 20 * 1000;
const TTL_METRICAS_MS = 30 * 1000;

// --- Errores ---

class ErrorApi extends Error {
  constructor(status, mensaje, extra) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}

const MSG_GENERICO_429 = "Demasiadas solicitudes, intenta de nuevo en un momento.";
const MSG_SESION_EXPIRADA = "Tu sesión expiró, inicia sesión de nuevo.";

// { response:false } del backend llega como BackendError con backendStatus
// 200: el único texto que lo distingue es su "message" (en inglés).
function errorDeNegocio(mensaje) {
  const m = String(mensaje || "");
  if (/comment/i.test(m) && /not found|not owned/i.test(m)) {
    return new ErrorApi(404, "No encontramos ese comentario, o no es tuyo.");
  }
  if (/post not found/i.test(m)) return new ErrorApi(404, "No encontramos esa publicación.");
  if (/not found/i.test(m)) return new ErrorApi(404, "No encontramos lo que buscas.");
  if (/already exist/i.test(m)) return new ErrorApi(409, "Eso ya estaba registrado.");
  if (/^error|internal/i.test(m)) {
    return new ErrorApi(502, "No se pudo completar la acción. Intenta de nuevo en un momento.");
  }
  return new ErrorApi(400, "No se pudo completar la acción.");
}

function responderError(req, res, err) {
  if (res.headersSent) return;
  if (err instanceof ErrorApi) return res.status(err.status).json({ error: err.message, ...err.extra });

  if (err instanceof BackendError) {
    const estado = err.backendStatus;
    if (estado === 401) {
      if (req.usuario) {
        // El backend ya no acepta ese token (vencido, revocado, cuenta borrada).
        cerrarSesion(res);
        return res.status(401).json({ error: MSG_SESION_EXPIRADA, sesionExpirada: true });
      }
      return res.status(401).json({ error: "Inicia sesión para continuar.", requiereSesion: true });
    }
    if (estado === 429) return res.status(429).json({ error: MSG_GENERICO_429 });
    if (estado === 403) return res.status(403).json({ error: "No tienes permiso para hacer esto." });
    if (err.red) {
      return res.status(err.status === 504 ? 504 : 502).json({
        error:
          err.status === 504
            ? "El servicio tardó demasiado en responder. Intenta de nuevo."
            : "No pudimos conectar con el servicio. Intenta de nuevo en un momento.",
      });
    }
    if (estado === 200) {
      const e = errorDeNegocio(err.message);
      return res.status(e.status).json({ error: e.message });
    }
    if (estado === 0 || estado >= 500) {
      return res.status(502).json({ error: "El servicio no está respondiendo bien. Intenta de nuevo en un momento." });
    }
    return res.status(400).json({ error: "La solicitud no es válida." });
  }

  // Nada de esto debe llegar al navegador: ni el mensaje ni la pila.
  console.error(`[guia/api] ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: "Ocurrió un error inesperado. Intenta de nuevo." });
}

// Express 4 no atrapa las promesas rechazadas de un handler async.
function ruta(handler) {
  return (req, res) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((err) => responderError(req, res, err));
  };
}

// --- Llamadas al backend ---

function backend(token, rutaBackend, opciones = {}) {
  if (!process.env.COLIMA_BACKEND_URL) {
    return Promise.reject(new ErrorApi(503, "El servicio no está disponible por ahora."));
  }
  return llamarBackend(token, rutaBackend, { timeoutMs: TIMEOUT_MS, ...opciones });
}

// Para rutas públicas que cambian con sesión (comentarios, vista, métricas):
// manda el token si hay sesión y, si el backend responde 401 (token vencido o
// revocado), borra la cookie y reintenta como anónimo. `hacer(token)` recibe
// el token (o null) con el que debe llamar.
async function conSesionOpcional(req, res, hacer) {
  try {
    return await hacer(req.usuario ? req.usuario.token : null);
  } catch (err) {
    if (req.usuario && err instanceof BackendError && err.backendStatus === 401) {
      cerrarSesion(res); // deja req.usuario en null
      return hacer(null);
    }
    throw err;
  }
}

// Algunas respuestas { response:false } no son un fallo para la web (ya era
// favorito, ya estaba oculto, ya estaba borrado): se toman como éxito.
async function ignorando(promesa, patron) {
  try {
    return await promesa;
  } catch (err) {
    if (err instanceof BackendError && err.backendStatus === 200 && patron.test(err.message)) return null;
    throw err;
  }
}

// --- Validación ---

function cuerpo(req) {
  const b = req.body;
  return b && typeof b === "object" && !Array.isArray(b) ? b : {};
}

function idDe(valor, mensaje = "El identificador no es válido.") {
  if (typeof valor !== "string" || !ID_RE.test(valor)) throw new ErrorApi(400, mensaje);
  return valor;
}

function listaDeIds(valor, { permitirVacia }) {
  if (!Array.isArray(valor) || (!permitirVacia && valor.length === 0)) {
    throw new ErrorApi(400, "Falta la lista de ids.");
  }
  if (valor.length > MAX_IDS) throw new ErrorApi(400, `Son demasiados ids (máximo ${MAX_IDS}).`);
  const unicos = new Set();
  for (const id of valor) unicos.add(idDe(id, "Alguno de los ids no es válido."));
  return [...unicos];
}

function limpiarComentario(valor) {
  if (typeof valor !== "string") throw new ErrorApi(400, "Escribe un comentario antes de enviarlo.");
  const texto = valor
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (!texto) throw new ErrorApi(400, "Escribe un comentario antes de enviarlo.");
  if (texto.length > MAX_COMENTARIO) {
    throw new ErrorApi(400, `El comentario no puede pasar de ${MAX_COMENTARIO} caracteres.`);
  }
  return texto;
}

function urlHttps(valor) {
  return typeof valor === "string" && /^https?:\/\//i.test(valor.trim()) ? valor.trim() : null;
}

// --- Límites propios (el backend cuenta por IP, y todos compartimos la de Vercel) ---

const porIp = (req) => `ip:${ipDe(req)}`;
const porUsuario = (req) => (req.usuario ? `u:${req.usuario.id}` : null);
const MINUTO = 60 * 1000;

const limites = {
  login: limitar({
    clave: porIp,
    max: 8,
    ventanaMs: MINUTO,
    mensaje: "Demasiados intentos de inicio de sesión. Espera un minuto e inténtalo de nuevo.",
  }),
  comentar: limitar({
    clave: porUsuario,
    max: 15,
    ventanaMs: MINUTO,
    mensaje: "Estás comentando muy rápido. Espera un momento e inténtalo de nuevo.",
  }),
  reportar: limitar({
    clave: porUsuario,
    max: 5,
    ventanaMs: MINUTO,
    mensaje: "Enviaste varios reportes seguidos. Espera un momento e inténtalo de nuevo.",
  }),
  vista: limitar({ clave: porIp, max: 60, ventanaMs: MINUTO, mensaje: MSG_GENERICO_429 }),
  metricas: limitar({ clave: porIp, max: 60, ventanaMs: MINUTO, mensaje: MSG_GENERICO_429 }),
  leerComentarios: limitar({ clave: porIp, max: 90, ventanaMs: MINUTO, mensaje: MSG_GENERICO_429 }),
  meGusta: limitar({ clave: porUsuario, max: 60, ventanaMs: MINUTO, mensaje: MSG_GENERICO_429 }),
  borrarComentario: limitar({ clave: porUsuario, max: 30, ventanaMs: MINUTO, mensaje: MSG_GENERICO_429 }),
  favoritos: limitar({ clave: porUsuario, max: 60, ventanaMs: MINUTO, mensaje: MSG_GENERICO_429 }),
  fusionar: limitar({ clave: porUsuario, max: 5, ventanaMs: MINUTO, mensaje: MSG_GENERICO_429 }),
  ocultar: limitar({ clave: porUsuario, max: 20, ventanaMs: MINUTO, mensaje: MSG_GENERICO_429 }),
  cuenta: limitar({ clave: porUsuario, max: 5, ventanaMs: MINUTO, mensaje: MSG_GENERICO_429 }),
};

// --- Cachés en memoria, solo para lo anónimo ---

const cacheComentarios = new Map(); // idPost → { lista, momento }
const cacheMetricas = new Map(); // idPost → { metrica, momento }
const MAX_CACHE = 2000;

function guardarEnCache(mapa, clave, valor) {
  mapa.delete(clave);
  if (mapa.size >= MAX_CACHE) mapa.delete(mapa.keys().next().value);
  mapa.set(clave, valor);
}

// --- Preparación común de todo el router ---

router.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    Vary: "Cookie",
  });
  next();
});

// server.js ya puede haber leído el cuerpo con su express.json() (hasta
// 100 kB): aquí se vuelve a medir contra los 8 kB.
router.use((req, res, next) => {
  const largo = Number(req.headers["content-length"]);
  let demasiado = Number.isFinite(largo) && largo > MAX_CUERPO;
  if (!demasiado && req._body && req.body && typeof req.body === "object") {
    demasiado = Buffer.byteLength(JSON.stringify(req.body)) > MAX_CUERPO;
  }
  if (demasiado) return res.status(413).json({ error: "La petición es demasiado grande." });
  next();
});
router.use(express.json({ limit: MAX_CUERPO }));
router.use(middlewareSesion);

// --- Sesión ---

router.get("/sesion", (req, res) => {
  res.json({ usuario: usuarioPublico(req.usuario) });
});

router.post(
  "/login/google",
  verificarOrigen,
  limites.login,
  ruta(async (req, res) => {
    const { credential } = cuerpo(req);
    if (typeof credential !== "string" || credential.length > 4096 || !CREDENCIAL_RE.test(credential)) {
      throw new ErrorApi(400, "No recibimos un token de Google válido. Intenta de nuevo.");
    }

    let datos;
    try {
      // Sin Authorization: es la llamada que consigue el token. platform "web"
      // usa GOOGLE_CLIENT_ID_WEB del backend.
      datos = await backend(null, "/login/google", {
        method: "POST",
        body: { token: credential, platform: "web" },
        mensajeError: "No se pudo iniciar sesión.",
      });
    } catch (err) {
      if (err instanceof BackendError && (err.backendStatus === 200 || [400, 401, 403].includes(err.backendStatus))) {
        throw new ErrorApi(401, "No pudimos verificar tu cuenta de Google. Intenta de nuevo.");
      }
      throw err;
    }

    if (typeof datos.token !== "string" || !datos.user || !datos.user._id) {
      throw new ErrorApi(502, "El servicio no respondió como esperábamos. Intenta de nuevo.");
    }
    const usuario = iniciarSesion(res, { token: datos.token, user: datos.user });
    res.json({ usuario: usuarioPublico(usuario) });
  }),
);

router.post("/logout", verificarOrigen, (req, res) => {
  cerrarSesion(res);
  res.json({ ok: true });
});

// --- Me gusta ---

router.post(
  "/me-gusta",
  verificarOrigen,
  exigirUsuario,
  limites.meGusta,
  ruta(async (req, res) => {
    const idPost = idDe(cuerpo(req).idPost);
    // El backend alterna: "New like added" → ahora hay like, "Like removed" → ya no.
    const datos = await backend(req.usuario.token, "/like/", { method: "POST", body: { idPost } });
    const mensaje = String(datos.message || "");
    if (/removed/i.test(mensaje)) return res.json({ ok: true, activo: false });
    if (/added/i.test(mensaje)) return res.json({ ok: true, activo: true });
    throw new ErrorApi(502, "El servicio no respondió como esperábamos. Intenta de nuevo.");
  }),
);

// --- Comentarios ---

// Sin el _id ni el resto de datos del usuario que comentó: solo lo que se pinta.
function comentarioPublico(c) {
  if (!c || typeof c !== "object" || c.status === false || typeof c._id !== "string" || !ID_RE.test(c._id)) return null;
  return {
    id: c._id,
    nombre: typeof c.name === "string" && c.name.trim() ? c.name.trim() : "Usuario",
    img: urlHttps(c.img),
    texto: typeof c.content === "string" ? c.content : "",
    fecha: typeof c.createdAt === "string" ? c.createdAt : null,
    propio: c.deleteComment === true,
  };
}

router.get(
  "/comentarios/:id",
  limites.leerComentarios,
  ruta(async (req, res) => {
    const id = idDe(req.params.id);
    if (!req.usuario) {
      const guardado = cacheComentarios.get(id);
      if (guardado && Date.now() - guardado.momento < TTL_COMENTARIOS_MS) {
        return res.json({ comentarios: guardado.lista });
      }
    }
    let conToken = false;
    const datos = await conSesionOpcional(req, res, (token) => {
      conToken = Boolean(token);
      return backend(token, "/comment/", { query: { idPost: id } });
    });
    // El backend ya los manda del más antiguo al más nuevo.
    const lista = (Array.isArray(datos.comments) ? datos.comments : []).map(comentarioPublico).filter(Boolean);
    if (!conToken) guardarEnCache(cacheComentarios, id, { lista, momento: Date.now() });
    res.json({ comentarios: lista });
  }),
);

router.post(
  "/comentarios/:id",
  verificarOrigen,
  exigirUsuario,
  limites.comentar,
  ruta(async (req, res) => {
    const id = idDe(req.params.id);
    const contenido = limpiarComentario(cuerpo(req).contenido);
    const datos = await backend(req.usuario.token, "/comment/", {
      method: "POST",
      body: { idPost: id, content: contenido },
    });
    cacheComentarios.delete(id);
    res.status(201).json({
      comentario: {
        id: typeof datos.idComment === "string" && ID_RE.test(datos.idComment) ? datos.idComment : null,
        nombre: req.usuario.nombre,
        img: req.usuario.img || null,
        texto: contenido,
        fecha: new Date().toISOString(),
        propio: true,
      },
    });
  }),
);

router.delete(
  "/comentarios/:id/:idComentario",
  verificarOrigen,
  exigirUsuario,
  limites.borrarComentario,
  ruta(async (req, res) => {
    const idPost = idDe(req.params.id);
    const idComment = idDe(req.params.idComentario);
    // El backend lee los dos ids de la query string, no del cuerpo.
    await backend(req.usuario.token, "/comment/", {
      method: "DELETE",
      query: { idPost, idComment },
      sinCuerpo: true,
    });
    cacheComentarios.delete(idPost);
    res.json({ ok: true });
  }),
);

// --- Vistas y métricas ---

router.post(
  "/vista/:id",
  verificarOrigen,
  limites.vista,
  ruta(async (req, res) => {
    const idPost = idDe(req.params.id);
    try {
      await conSesionOpcional(req, res, (token) => backend(token, "/view/", { method: "POST", body: { idPost } }));
    } catch {
      // Una vista que no se cuenta no vale un error en la página.
    }
    res.status(204).end();
  }),
);

function metricaPublica(m) {
  const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    likes: n(m.likes),
    activo: m.like === true,
    comentarios: n(m.comments),
    vistas: n(m.views),
    favorito: m.favorite === true,
  };
}

router.post(
  "/metricas",
  verificarOrigen,
  limites.metricas,
  ruta(async (req, res) => {
    const ids = listaDeIds(cuerpo(req).ids, { permitirVacia: false });
    const metricas = {};
    let faltan = ids;

    // Lo anónimo (igual para todos) se cachea 30 s; lo de un usuario nunca.
    if (!req.usuario) {
      faltan = [];
      const ahora = Date.now();
      for (const id of ids) {
        const guardado = cacheMetricas.get(id);
        if (guardado && ahora - guardado.momento < TTL_METRICAS_MS) metricas[id] = guardado.metrica;
        else faltan.push(id);
      }
    }

    for (let i = 0; i < faltan.length; i += TROZO_METRICAS) {
      const trozo = faltan.slice(i, i + TROZO_METRICAS);
      let conToken = false;
      const datos = await conSesionOpcional(req, res, (token) => {
        conToken = Boolean(token);
        return backend(token, "/metrics/", { method: "POST", body: { ids: trozo } });
      });
      const crudas = datos.metrics && typeof datos.metrics === "object" ? datos.metrics : {};
      for (const id of trozo) {
        // Un id que el backend no conoce simplemente no aparece.
        if (!crudas[id] || typeof crudas[id] !== "object") continue;
        metricas[id] = metricaPublica(crudas[id]);
        if (!conToken) guardarEnCache(cacheMetricas, id, { metrica: metricas[id], momento: Date.now() });
      }
    }
    res.json({ metricas });
  }),
);

// --- Favoritos de cuenta ---

function favoritoPublico(f) {
  if (!f || typeof f !== "object" || typeof f._id !== "string" || !ID_RE.test(f._id)) return null;
  const tipo = f.kind === "local" ? "lugar" : "evento";
  const primera = Array.isArray(f.images) ? f.images[0] : f.images;
  // En eventos es una URL; en lugares es la imageKey (un nombre de imagen empaquetada).
  const imagen =
    tipo === "evento" ? urlHttps(primera) : typeof primera === "string" && primera.trim() ? primera.trim() : null;
  return {
    id: f._id,
    titulo: typeof f.title === "string" ? f.title : "",
    imagen,
    esPortada: f.isCover === true,
    fecha: fechaDeIso(f.date),
    tipo,
  };
}

async function listaDeFavoritos(req) {
  const datos = await backend(req.usuario.token, "/favorite/");
  if (!Array.isArray(datos)) throw new ErrorApi(502, "El servicio no respondió como esperábamos. Intenta de nuevo.");
  return datos.map(favoritoPublico).filter(Boolean);
}

router.get(
  "/favoritos",
  exigirUsuario,
  limites.favoritos,
  ruta(async (req, res) => {
    res.json({ favoritos: await listaDeFavoritos(req) });
  }),
);

router.post(
  "/favoritos/fusionar",
  verificarOrigen,
  exigirUsuario,
  limites.fusionar,
  ruta(async (req, res) => {
    const ids = listaDeIds(cuerpo(req).ids, { permitirVacia: true });
    const actuales = await listaDeFavoritos(req);
    const yaEstan = new Set(actuales.map((f) => f.id));
    const faltan = ids.filter((id) => !yaEstan.has(id));

    // Uno por uno y en orden, para no pasarnos del límite del backend.
    let incompleto = false;
    for (const idPost of faltan) {
      try {
        await backend(req.usuario.token, "/favorite/", { method: "POST", body: { idPost } });
      } catch (err) {
        if (err instanceof BackendError && err.backendStatus === 200) continue; // ya estaba, o ese id no existe
        if (err instanceof BackendError && err.backendStatus === 429) {
          incompleto = true;
          break;
        }
        throw err; // 401 → sesión expirada; red o 5xx → error
      }
    }

    const favoritos = faltan.length ? await listaDeFavoritos(req) : actuales;
    res.json(incompleto ? { favoritos, incompleto: true } : { favoritos });
  }),
);

router.post(
  "/favoritos",
  verificarOrigen,
  exigirUsuario,
  limites.favoritos,
  ruta(async (req, res) => {
    const idPost = idDe(cuerpo(req).idPost);
    await ignorando(backend(req.usuario.token, "/favorite/", { method: "POST", body: { idPost } }), /already exist/i);
    res.json({ ok: true });
  }),
);

router.delete(
  "/favoritos/:id",
  verificarOrigen,
  exigirUsuario,
  limites.favoritos,
  ruta(async (req, res) => {
    const idPost = idDe(req.params.id);
    await ignorando(
      backend(req.usuario.token, "/favorite/", { method: "DELETE", query: { idPost }, sinCuerpo: true }),
      /not found or already removed/i,
    );
    res.json({ ok: true });
  }),
);

// --- Reportar, ocultar y borrar la cuenta ---

router.post(
  "/reportar",
  verificarOrigen,
  exigirUsuario,
  limites.reportar,
  ruta(async (req, res) => {
    const { idReport, tipo, texto } = cuerpo(req);
    idDe(idReport);
    if (typeof tipo !== "string" || !TIPOS_REPORTE.has(tipo)) {
      throw new ErrorApi(400, "El tipo de reporte no es válido.");
    }
    const detalle = typeof texto === "string" ? texto.trim() : "";
    if (!detalle) throw new ErrorApi(400, "Cuéntanos el motivo del reporte.");
    if (detalle.length > MAX_REPORTE) {
      throw new ErrorApi(400, `El motivo no puede pasar de ${MAX_REPORTE} caracteres.`);
    }
    await backend(req.usuario.token, "/report/", {
      method: "POST",
      body: { idReport, type: tipo, text: detalle },
    });
    res.json({ ok: true });
  }),
);

router.post(
  "/ocultar",
  verificarOrigen,
  exigirUsuario,
  limites.ocultar,
  ruta(async (req, res) => {
    const idPost = idDe(cuerpo(req).idPost);
    await ignorando(backend(req.usuario.token, "/hide", { method: "POST", body: { idPost } }), /already exist/i);
    res.json({ ok: true });
  }),
);

router.delete(
  "/cuenta",
  verificarOrigen,
  exigirUsuario,
  limites.cuenta,
  ruta(async (req, res) => {
    await backend(req.usuario.token, "/configuration/delete/", { method: "DELETE", sinCuerpo: true });
    cerrarSesion(res);
    res.json({ ok: true });
  }),
);

// --- Lo que no encaja: todo lo que cuelga de /g contesta JSON ---

router.use((req, res) => {
  res.status(404).json({ error: "Esa ruta no existe." });
});

// Cuerpo muy grande o JSON mal formado (los lanza express.json de arriba).
router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "La petición es demasiado grande." });
  }
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es JSON válido." });
  }
  if (err && err.type === "charset.unsupported") {
    return res.status(415).json({ error: "La petición no se pudo leer." });
  }
  console.error(`[guia/api] ${req.method} ${req.path}:`, err);
  res.status(err && err.status >= 400 && err.status < 500 ? err.status : 500).json({
    error: "Ocurrió un error inesperado. Intenta de nuevo.",
  });
});

// Solo para scripts/verificar-guia.js: vuelve a cero los límites y las cachés.
router._interno = {
  reiniciar() {
    for (const limite of Object.values(limites)) limite.reiniciar();
    cacheComentarios.clear();
    cacheMetricas.clear();
  },
};

module.exports = router;
