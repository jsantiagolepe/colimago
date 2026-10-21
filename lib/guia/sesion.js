// Sesión de USUARIO de la guía web (cualquier cuenta de Google que entre con
// "Iniciar sesión"). No tiene nada que ver con la sesión del panel de
// administración (cookie-session, cookie 'colimago.sesion', server.js): son
// cookies distintas, con llaves distintas, y una no abre la otra.
//
// Cómo guarda la sesión: el JWT que devuelve POST /login/google del backend
// (dura 1 año y lleva el email) NUNCA llega al navegador en claro ni se
// guarda en el servidor (en Vercel cada petición puede caer en otra
// instancia). Va dentro de la cookie 'colimago.u', cifrado con AES-256-GCM:
//
//   cookie = base64url( versión(1) | iv(12) | tag(16) | cifrado )
//   payload = { t:jwt, i:id, n:nombre, g:img, e:email, x:caduca(ms) }
//
// La llave se deriva de SESSION_SECRET con crypto.scryptSync (con una sal
// propia, así no se reutiliza tal cual la llave con la que cookie-session
// firma la sesión del panel). El tag de GCM hace que cualquier cambio a la
// cookie se detecte: una cookie alterada, de otra llave o vencida se
// trata como "sin sesión" y se borra. Sin SESSION_SECRET usa el mismo valor
// de desarrollo que server.js y lo avisa por consola: en producción SIEMPRE
// debe estar definido, o cualquiera que lea este repo puede descifrar las
// cookies de los usuarios.
//
// Cookie: httpOnly (el JS de la página no la lee), sameSite lax, secure si
// NODE_ENV=production, path /, 30 días. No se parsea con ninguna librería:
// se lee el encabezado Cookie a mano (leerCookie).
//
// Un JWT cuya fecha de expiración (claim exp) ya pasó se descarta al leer la
// sesión: el backend contesta 401 a cualquier ruta, incluso las públicas, si
// recibe un token vencido, así que nunca se le reenvía.
//
// Exporta:
//   middlewareSesion       (req,res,next) puebla req.usuario =
//                          { token, id, nombre, img, email } | null
//   iniciarSesion(res, { token, user })  user = { _id, name, img, email };
//                          pone la cookie y devuelve el mismo objeto usuario
//   cerrarSesion(res)      borra la cookie
//   exigirUsuario          401 JSON si no hay sesión
//   verificarOrigen        defensa CSRF (ver abajo) para POST/PUT/PATCH/DELETE
//   limitar({ clave, max, ventanaMs, mensaje })  fábrica de middleware de
//                          límite de tasa en memoria; 429 JSON al pasarse
//   ipDe(req)              la IP real (req.ip, "trust proxy" ya está activo)
//   usuarioPublico(usuario)  { nombre, img, email } (lo único que ve el navegador)
//   NOMBRE_COOKIE          'colimago.u'
//
// CSRF (verificarOrigen): la cookie es lax, pero además cada petición que
// escribe debe traer `X-Requested-With: colimago` (un formulario de otro
// sitio no puede mandarla; un fetch de otro sitio necesitaría un preflight
// CORS que este servidor nunca aprueba) y, si el navegador manda Origin o
// Sec-Fetch-Site, tienen que ser del mismo origen.
//
// Límite de tasa (limitar): ventana fija, en la memoria de la instancia. En
// Vercel cada instancia lleva su cuenta, así que es un freno contra abuso
// y no una cuota exacta. La clave la elige quien lo usa (por IP, por
// usuario…); si clave() devuelve vacío no se limita esa petición.

const crypto = require("crypto");

const NOMBRE_COOKIE = "colimago.u";
const DURACION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const SECRETO_DESARROLLO = "dev-secret-cambia-esto"; // el mismo de server.js
const SAL = "colimago.guia.sesion.v1";
const VERSION = 1;
const MAX_COOKIE = 3800; // los navegadores descartan cookies de más de ~4096 bytes
const METODOS_QUE_ESCRIBEN = new Set(["POST", "PUT", "PATCH", "DELETE"]);

if (!process.env.SESSION_SECRET) {
  console.warn(
    "Falta SESSION_SECRET: la sesión de usuarios de la guía usa un valor de desarrollo. Ponle uno real antes de desplegar (ver .env.example).",
  );
}

// --- Cifrado ---

let llaveEnMemoria = null; // { secreto, llave }: scrypt tarda ~50 ms, se hace una vez

function llave() {
  const secreto = process.env.SESSION_SECRET || SECRETO_DESARROLLO;
  if (!llaveEnMemoria || llaveEnMemoria.secreto !== secreto) {
    llaveEnMemoria = { secreto, llave: crypto.scryptSync(secreto, SAL, 32) };
  }
  return llaveEnMemoria.llave;
}

function cifrar(payload) {
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv("aes-256-gcm", llave(), iv);
  cifrador.setAAD(Buffer.from(NOMBRE_COOKIE)); // ata el contenido a esta cookie
  const cifrado = Buffer.concat([cifrador.update(JSON.stringify(payload), "utf8"), cifrador.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cifrador.getAuthTag(), cifrado]).toString("base64url");
}

// null ante cualquier problema: formato, llave distinta, alterada, vencida.
function descifrar(valor) {
  try {
    if (typeof valor !== "string" || valor.length < 40 || valor.length > 4096) return null;
    const bytes = Buffer.from(valor, "base64url");
    if (bytes.length < 30 || bytes[0] !== VERSION) return null;
    const descifrador = crypto.createDecipheriv("aes-256-gcm", llave(), bytes.subarray(1, 13));
    descifrador.setAAD(Buffer.from(NOMBRE_COOKIE));
    descifrador.setAuthTag(bytes.subarray(13, 29));
    const json = Buffer.concat([descifrador.update(bytes.subarray(29)), descifrador.final()]).toString("utf8");
    const p = JSON.parse(json);
    if (!p || typeof p !== "object") return null;
    if (typeof p.t !== "string" || !p.t || typeof p.i !== "string" || !p.i) return null;
    if (typeof p.x !== "number" || p.x < Date.now()) return null;
    return {
      t: p.t,
      i: p.i,
      n: typeof p.n === "string" ? p.n : "",
      g: typeof p.g === "string" ? p.g : "",
      e: typeof p.e === "string" ? p.e : "",
      x: p.x,
    };
  } catch {
    return null;
  }
}

// ¿El claim exp del JWT ya pasó? Solo lee el payload (no verifica la firma,
// eso lo hace el backend). Si no se puede leer, no se opina: se da por vigente.
function jwtVencido(token) {
  try {
    const partes = token.split(".");
    if (partes.length !== 3) return false;
    const { exp } = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
    return typeof exp === "number" && exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

// --- Cookie ---

function leerCookie(req, nombre) {
  const cabecera = req.headers && req.headers.cookie;
  if (!cabecera) return null;
  for (const trozo of cabecera.split(";")) {
    const i = trozo.indexOf("=");
    if (i < 0 || trozo.slice(0, i).trim() !== nombre) continue;
    let valor = trozo.slice(i + 1).trim();
    if (valor.length > 1 && valor.startsWith('"') && valor.endsWith('"')) valor = valor.slice(1, -1);
    try {
      return decodeURIComponent(valor);
    } catch {
      return valor;
    }
  }
  return null;
}

function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function cerrarSesion(res) {
  res.clearCookie(NOMBRE_COOKIE, opcionesCookie());
  if (res.req) res.req.usuario = null;
}

// Lee la cookie (una sola vez por petición) y deja req.usuario.
function cargarUsuario(req, res) {
  if (req.usuario !== undefined) return req.usuario;
  const valor = leerCookie(req, NOMBRE_COOKIE);
  if (valor === null) {
    req.usuario = null;
    return null;
  }
  const p = descifrar(valor);
  if (!p || jwtVencido(p.t)) {
    // Cookie alterada, de otra llave o vencida: se borra para no repetir.
    if (res && !res.headersSent) res.clearCookie(NOMBRE_COOKIE, opcionesCookie());
    req.usuario = null;
    return null;
  }
  req.usuario = { token: p.t, id: p.i, nombre: p.n, img: p.g, email: p.e };
  return req.usuario;
}

function middlewareSesion(req, res, next) {
  cargarUsuario(req, res);
  next();
}

function recortar(valor, max) {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

function imgSegura(valor) {
  const t = recortar(valor, 300);
  return /^https:\/\//i.test(t) ? t : "";
}

function iniciarSesion(res, { token, user }) {
  const u = user || {};
  const id = String(u._id !== undefined ? u._id : u.id || "");
  if (typeof token !== "string" || !token || !id) {
    throw new TypeError("iniciarSesion necesita token y user._id");
  }
  const email = recortar(u.email, 150);
  const usuario = {
    token,
    id,
    nombre: recortar(u.name !== undefined ? u.name : u.nombre, 80) || email.split("@")[0] || "Usuario",
    img: imgSegura(u.img),
    email,
  };
  const armar = (img) =>
    cifrar({ t: usuario.token, i: usuario.id, n: usuario.nombre, g: img, e: usuario.email, x: Date.now() + DURACION_MS });
  let valor = armar(usuario.img);
  if (valor.length > MAX_COOKIE) {
    usuario.img = "";
    valor = armar("");
  }
  if (valor.length > MAX_COOKIE) throw new RangeError("La sesión no cabe en una cookie");
  res.cookie(NOMBRE_COOKIE, valor, { ...opcionesCookie(), maxAge: DURACION_MS });
  if (res.req) res.req.usuario = usuario;
  return usuario;
}

function usuarioPublico(usuario) {
  if (!usuario) return null;
  return { nombre: usuario.nombre, img: usuario.img || null, email: usuario.email };
}

function exigirUsuario(req, res, next) {
  if (!cargarUsuario(req, res)) {
    return res.status(401).json({ error: "Inicia sesión para continuar.", requiereSesion: true });
  }
  next();
}

// --- CSRF ---

function mismoSitio(origen, req) {
  let host;
  try {
    host = new URL(origen).host.toLowerCase();
  } catch {
    return false; // "null" (iframe con sandbox) u otro valor que no es un origen
  }
  const permitidos = [req.get("host"), (req.get("x-forwarded-host") || "").split(",")[0]]
    .map((h) => (h || "").trim().toLowerCase())
    .filter(Boolean);
  return permitidos.includes(host);
}

function verificarOrigen(req, res, next) {
  if (!METODOS_QUE_ESCRIBEN.has(req.method)) return next();
  const rechazar = () => res.status(403).json({ error: "No se pudo verificar el origen de la petición. Recarga la página." });
  if (req.get("x-requested-with") !== "colimago") return rechazar();
  const origen = req.get("origin");
  if (origen !== undefined && !mismoSitio(origen, req)) return rechazar();
  const sitio = req.get("sec-fetch-site");
  if (sitio && sitio !== "same-origin" && sitio !== "none") return rechazar();
  next();
}

// --- Límite de tasa ---

function ipDe(req) {
  return String(req.ip || (req.socket && req.socket.remoteAddress) || "desconocida").replace(/^::ffff:/, "");
}

function limitar({ clave, max, ventanaMs, mensaje }) {
  const cubos = new Map(); // clave → { n, reinicia }
  let ultimaLimpieza = Date.now();

  function limpiar(ahora) {
    ultimaLimpieza = ahora;
    for (const [k, c] of cubos) if (ahora >= c.reinicia) cubos.delete(k);
    // Tope duro contra una avalancha de claves distintas: se sueltan las más viejas.
    while (cubos.size > 20000) cubos.delete(cubos.keys().next().value);
  }

  function middleware(req, res, next) {
    const ahora = Date.now();
    if (ahora - ultimaLimpieza > ventanaMs || cubos.size > 5000) limpiar(ahora);
    let k;
    try {
      k = clave(req);
    } catch {
      k = null;
    }
    if (k === null || k === undefined || k === "") return next();
    let cubo = cubos.get(k);
    if (!cubo || ahora >= cubo.reinicia) {
      cubo = { n: 0, reinicia: ahora + ventanaMs };
      cubos.set(k, cubo);
    }
    cubo.n += 1;
    if (cubo.n > max) {
      const segundos = Math.max(1, Math.ceil((cubo.reinicia - ahora) / 1000));
      res.set("Retry-After", String(segundos));
      return res.status(429).json({ error: mensaje, reintentarEn: segundos });
    }
    next();
  }

  middleware.reiniciar = () => cubos.clear();
  return middleware;
}

module.exports = {
  middlewareSesion,
  iniciarSesion,
  cerrarSesion,
  exigirUsuario,
  verificarOrigen,
  limitar,
  ipDe,
  usuarioPublico,
  NOMBRE_COOKIE,
  // Solo para scripts/verificar-guia.js.
  _interno: { cifrar, descifrar, leerCookie },
};
