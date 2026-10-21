// Eventos de la guía web: lee el feed PÚBLICO de backColimaApp (siempre a
// través de lib/colima-backend.js, el navegador nunca habla con el backend),
// lo normaliza a una forma estable y lo cachea en memoria.
//
// Qué trae el backend y qué trampas tiene (ver el informe del backend):
//   · GET /post/ no recibe parámetros: devuelve TODOS los eventos, pasados y
//     futuros, en un orden propio. Filtrar y ordenar es trabajo de este
//     archivo (proximos, pasados, eventosDeMunicipio).
//   · `date` es hora "flotante": el reloj UTC del string es la hora local de
//     Colima. Nunca se convierte de zona; se corta el string. Por eso las
//     fechas del día se calculan con aritmética por componentes y no con
//     new Date('YYYY-MM-DD') + toISOString().
//   · `finishDate` solo vale si `moreDays` es true; si no, el backend manda
//     Date.now() (un número) y se ignora.
//   · `images` es un string (URL de Cloudinary) o [] cuando no hay imagen.
//   · `municipality` es un string "1".."10" (o null).
//   · Las redes sociales vienen con "" o null cuando no hay: se descartan.
//
// Se pide el feed SIN token (versión anónima): like/favorite del usuario
// van por /g/metricas y /g/favoritos (lib/guia/api.js), no aquí. Así una sola
// copia en memoria sirve a todos los visitantes.
//
// Caché y fallos (obtenerEventos):
//   · 60 s fresco; si el backend falla se sirve la copia anterior hasta 1 h
//     (ok:false) y nunca se lanza una excepción.
//   · Llamadas simultáneas comparten una sola petición.
//   · Reintenta 2 veces (espera 1 s y 2 s) solo ante error de red/timeout o
//     5xx; el timeout es de 15 s. Un 4xx o un { response:false } no se
//     reintentan. Tras un fallo total no se vuelve a intentar durante 15 s
//     para que un backend caído no frene cada visita.
//   · La caché vive en la memoria de la instancia: en Vercel cada instancia
//     tiene la suya, y se pierde en cada arranque en frío.
//
// Exporta:
//   hoyEnColima([ahora])            → 'YYYY-MM-DD' en America/Mexico_City
//   normalizarEvento(crudo)         → Evento | null (null si no tiene id,
//                                     título o fecha válidos)
//   obtenerEventos()                → Promise<{ eventos, ok, actualizado }>
//   obtenerEvento(id)               → Promise<Evento | null>
//   obtenerTop10()                  → Promise<[{ id, titulo, imagenes, esPortada, fecha }]>
//   esVigente(ev, hoy)              → boolean
//   proximos(eventos, hoy)          → Evento[] (vigentes, fecha+hora asc)
//   pasados(eventos, hoy)           → Evento[] (ya terminados, más reciente primero)
//   diasDelEvento(ev)               → ['YYYY-MM-DD', …] de fecha a finFecha
//   eventosDeMunicipio(eventos, municipioId, hoy) → Evento[] (vigentes, fecha asc)
//   urlImagen(url, ancho)           → URL (Cloudinary con w_<ancho>,q_auto,f_auto)
//   fechaDeIso(valor)               → 'YYYY-MM-DD' | null (sin convertir zona)
//
// Evento = {
//   id, titulo, subtitulo, descripcion:{es,en}, imagen:string|null,
//   fecha:'YYYY-MM-DD', hora:'HH:MM'|null, finFecha:'YYYY-MM-DD'|null,
//   todoElDia, municipioId:number|null, subTipo, color, esPortada, hijos:[id],
//   ubicacion:{nombre,descripcion,lat,lng}|null,
//   redes:{web,facebook,whatsapp,instagram,tiktok,youtube,mail,phone} (solo los no vacíos),
//   likes, vistas, comentarios, referencia, creado, actualizado
// }
// Los eventos que devuelven las funciones son los de la caché: no los
// mutes (el arreglo sí es una copia, se puede ordenar).

const { llamarBackend, BackendError } = require("../colima-backend");

const ID_RE = /^[a-f0-9]{24}$/;

const TTL_FRESCO_MS = 60 * 1000;
const TTL_OBSOLETO_MS = 60 * 60 * 1000;
const MAX_DIAS_EVENTO = 400; // tope de diasDelEvento ante una finFecha absurda
const MAX_FICHAS_EN_CACHE = 300;

// Ajustable solo desde las pruebas (scripts/verificar-guia.js).
const config = {
  timeoutMs: 15000,
  timeoutFichaMs: 10000,
  esperasMs: [1000, 2000],
  falloEsperaMs: 15000,
};

// --- Fechas: todo por componentes, sin zonas horarias ---

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

function esBisiesto(a) {
  return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
}

function diasEnMes(a, m) {
  if (m === 2) return esBisiesto(a) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

function dos(n) {
  return String(n).padStart(2, "0");
}

// "2026-10-24T16:30:00.000Z" → { fecha:'2026-10-24', hora:'16:30' }. La hora
// es null si el string no la trae o no es válida. Una fecha imposible
// (2026-02-31) da null. Un número o un Date (epoch) se leen con su reloj UTC.
function leerIso(valor) {
  if (valor instanceof Date || (typeof valor === "number" && Number.isFinite(valor))) {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return null;
    valor = d.toISOString();
  }
  if (typeof valor !== "string") return null;
  const m = RE_ISO.exec(valor.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const mes = Number(m[2]);
  const d = Number(m[3]);
  if (mes < 1 || mes > 12 || d < 1 || d > diasEnMes(a, mes)) return null;
  let hora = null;
  if (m[4] !== undefined) {
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    if (hh <= 23 && mm <= 59) hora = `${dos(hh)}:${dos(mm)}`;
  }
  return { fecha: `${m[1]}-${m[2]}-${m[3]}`, hora };
}

function fechaDeIso(valor) {
  const leida = leerIso(valor);
  return leida ? leida.fecha : null;
}

// 'YYYY-MM-DD' + 1 día, con las reglas del calendario (bisiestos incluidos).
function diaSiguiente(fecha) {
  let a = Number(fecha.slice(0, 4));
  let m = Number(fecha.slice(5, 7));
  let d = Number(fecha.slice(8, 10)) + 1;
  if (d > diasEnMes(a, m)) {
    d = 1;
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return `${String(a).padStart(4, "0")}-${dos(m)}-${dos(d)}`;
}

const formatoHoy = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// La fecha de hoy en Colima (America/Mexico_City). `ahora` solo existe para
// poder probarla con una hora fija.
function hoyEnColima(ahora = new Date()) {
  const partes = {};
  for (const p of formatoHoy.formatToParts(ahora)) partes[p.type] = p.value;
  return `${partes.year}-${partes.month}-${partes.day}`;
}

// --- Normalización ---

const REDES = ["web", "facebook", "whatsapp", "instagram", "tiktok", "youtube", "mail", "phone"];
const REDES_ENLACE = new Set(["web", "facebook", "instagram", "tiktok", "youtube"]);
// Un enlace de red social con estos esquemas se descarta: acabaría en un href.
const ESQUEMA_PELIGROSO = /^\s*(?:javascript|data|vbscript|file):/i;

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function numero(valor) {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function numeroOpcional(valor) {
  if (typeof valor === "string" && valor.trim() !== "") valor = Number(valor);
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function urlHttp(valor) {
  const t = texto(valor);
  return /^https?:\/\//i.test(t) ? t : null;
}

// El backend manda un string (feed, findOne) o un arreglo con una URL
// (top10, favoritos); [] o "" significan "sin imagen".
function primeraImagen(valor) {
  if (Array.isArray(valor)) return valor.length ? urlHttp(valor[0]) : null;
  return urlHttp(valor);
}

function ubicacionDe(crudo) {
  const l = crudo.location;
  if (crudo.hasLocation !== true || !l || typeof l !== "object") return null;
  const nombre = texto(l.name);
  const lat = numeroOpcional(l.latitude);
  const lng = numeroOpcional(l.longitude);
  if (!nombre || lat === null || lng === null || lat === 0 || lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { nombre, descripcion: texto(l.descriptionLocation), lat, lng };
}

function redesDe(sn) {
  const redes = {};
  if (!sn || typeof sn !== "object") return redes;
  for (const clave of REDES) {
    const valor = texto(sn[clave]);
    if (!valor) continue;
    if (REDES_ENLACE.has(clave) && ESQUEMA_PELIGROSO.test(valor)) continue;
    redes[clave] = valor;
  }
  return redes;
}

/**
 * Convierte un post crudo del backend (feed o findOne) en un Evento.
 * Devuelve null si no se puede usar: sin _id de 24 hex, sin título o sin
 * una fecha válida.
 */
function normalizarEvento(crudo) {
  if (!crudo || typeof crudo !== "object") return null;
  const id = typeof crudo._id === "string" ? crudo._id : "";
  const titulo = texto(crudo.title);
  const inicio = leerIso(crudo.date);
  if (!ID_RE.test(id) || !titulo || !inicio) return null;

  const todoElDia = crudo.allDay === true;

  // finishDate solo cuenta con moreDays: si no, es Date.now() (un número).
  let finFecha = null;
  if (crudo.moreDays === true && typeof crudo.finishDate === "string") {
    const fin = fechaDeIso(crudo.finishDate);
    if (fin && fin > inicio.fecha) finFecha = fin;
  }

  const municipio = Number(crudo.municipality);
  const subTipo = numeroOpcional(crudo.subType);

  return {
    id,
    titulo,
    subtitulo: texto(crudo.subtitle),
    descripcion: {
      es: typeof crudo.description === "string" ? crudo.description : "",
      en: typeof crudo.descriptionEnglish === "string" ? crudo.descriptionEnglish : "",
    },
    imagen: primeraImagen(crudo.images),
    fecha: inicio.fecha,
    hora: todoElDia ? null : inicio.hora,
    finFecha,
    todoElDia,
    municipioId: Number.isInteger(municipio) && municipio >= 1 ? municipio : null,
    subTipo,
    color: texto(crudo.color),
    esPortada: crudo.isCover === true,
    hijos: Array.isArray(crudo.children) ? crudo.children.filter((h) => typeof h === "string" && ID_RE.test(h)) : [],
    ubicacion: ubicacionDe(crudo),
    redes: redesDe(crudo.socialNetworks),
    likes: numero(crudo.likes),
    vistas: numero(crudo.views),
    comentarios: numero(crudo.comments),
    referencia: texto(crudo.reference),
    creado: typeof crudo.createdAt === "string" ? crudo.createdAt : null,
    actualizado: typeof crudo.updatedAt === "string" ? crudo.updatedAt : null,
  };
}

// --- Consultas sobre una lista de eventos (puras, no tocan la caché) ---

function fin(ev) {
  return ev.finFecha || ev.fecha;
}

function claveOrden(ev) {
  return `${ev.fecha}T${ev.hora || "00:00"}`;
}

function porFechaAsc(a, b) {
  const x = claveOrden(a);
  const y = claveOrden(b);
  if (x !== y) return x < y ? -1 : 1;
  return a.titulo.localeCompare(b.titulo, "es");
}

function esVigente(ev, hoy) {
  return fin(ev) >= hoy;
}

function proximos(eventos, hoy) {
  return eventos.filter((ev) => esVigente(ev, hoy)).sort(porFechaAsc);
}

function pasados(eventos, hoy) {
  return eventos.filter((ev) => !esVigente(ev, hoy)).sort((a, b) => porFechaAsc(b, a));
}

function diasDelEvento(ev) {
  const dias = [ev.fecha];
  if (!ev.finFecha) return dias;
  let dia = ev.fecha;
  while (dia < ev.finFecha && dias.length < MAX_DIAS_EVENTO) {
    dia = diaSiguiente(dia);
    dias.push(dia);
  }
  return dias;
}

function eventosDeMunicipio(eventos, municipioId, hoy) {
  const id = Number(municipioId);
  return eventos.filter((ev) => ev.municipioId === id && esVigente(ev, hoy)).sort(porFechaAsc);
}

// Cloudinary entrega la imagen ya recortada y en el mejor formato si se
// pide en la URL (…/image/upload/w_600,q_auto,f_auto/v123/x.jpg): una foto
// de 130 kB baja a 60 kB. Cualquier otra URL se devuelve igual.
function urlImagen(url, ancho) {
  if (typeof url !== "string" || !url) return null;
  const marca = "/image/upload/";
  const i = url.indexOf(marca);
  const w = Math.round(Number(ancho));
  if (i === -1 || !Number.isFinite(w) || w < 16 || w > 4000) return url;
  const resto = url.slice(i + marca.length);
  if (/^w_\d+[,/]/.test(resto)) return url; // ya viene transformada
  return `${url.slice(0, i + marca.length)}w_${w},q_auto,f_auto/${resto}`;
}

// --- Llamadas al backend con reintentos ---

function dormir(ms) {
  return new Promise((ok) => setTimeout(ok, ms));
}

// Solo vale la pena reintentar cuando el backend pudo estar ocupado o
// dormido: sin respuesta (red, timeout) o un 5xx. Un 4xx o un
// { response:false } darían lo mismo otra vez.
function reintentable(err) {
  return err instanceof BackendError && (err.red === true || err.backendStatus >= 500);
}

async function pedirConReintentos(ruta, opciones) {
  let ultimo;
  for (let intento = 0; intento <= config.esperasMs.length; intento++) {
    if (intento > 0) await dormir(config.esperasMs[intento - 1]);
    try {
      return await llamarBackend(null, ruta, { ...opciones, timeoutMs: config.timeoutMs });
    } catch (err) {
      ultimo = err;
      if (!reintentable(err)) break;
    }
  }
  throw ultimo;
}

function avisarFallo(que, err) {
  console.error(`[guia] No se pudo cargar ${que}:`, err instanceof Error ? err.message : err);
}

// --- Feed de eventos (caché de 60 s, stale-if-error de 1 h) ---

const feed = { eventos: null, momento: 0, enVuelo: null, falloHasta: 0 };

function respuestaFeed(ok) {
  return { eventos: feed.eventos ? [...feed.eventos] : [], ok, actualizado: feed.eventos ? feed.momento : 0 };
}

async function recargarFeed() {
  try {
    if (!process.env.COLIMA_BACKEND_URL) throw new Error("Falta la variable COLIMA_BACKEND_URL");
    const crudos = await pedirConReintentos("/post/");
    if (!Array.isArray(crudos)) throw new Error("El feed del backend no es un arreglo");
    const vistos = new Set();
    const eventos = [];
    for (const crudo of crudos) {
      const ev = normalizarEvento(crudo);
      if (ev && !vistos.has(ev.id)) {
        vistos.add(ev.id);
        eventos.push(ev);
      }
    }
    feed.eventos = eventos;
    feed.momento = Date.now();
    feed.falloHasta = 0;
    return respuestaFeed(true);
  } catch (err) {
    avisarFallo("el feed de eventos", err);
    feed.falloHasta = Date.now() + config.falloEsperaMs;
    return fallidoFeed();
  }
}

// La copia anterior sirve hasta 1 h; pasado eso se descarta.
function fallidoFeed() {
  if (feed.eventos && Date.now() - feed.momento >= TTL_OBSOLETO_MS) {
    feed.eventos = null;
    feed.momento = 0;
  }
  return respuestaFeed(false);
}

/**
 * Todos los eventos normalizados del feed público.
 * Nunca lanza: si el backend falla devuelve la copia anterior (hasta 1 h) o
 * [] con ok:false. `actualizado` es el momento (ms) en que se bajó la copia.
 */
async function obtenerEventos() {
  const ahora = Date.now();
  if (feed.eventos && ahora - feed.momento < TTL_FRESCO_MS) return respuestaFeed(true);
  if (feed.enVuelo) return feed.enVuelo;
  if (ahora < feed.falloHasta) return fallidoFeed();
  feed.enVuelo = recargarFeed().finally(() => {
    feed.enVuelo = null;
  });
  return feed.enVuelo;
}

// --- Un evento por id ---

const fichas = new Map(); // id → { ev: Evento|null, momento }
const fichasEnVuelo = new Map();

function recordarFicha(id, ev) {
  fichas.delete(id);
  if (fichas.size >= MAX_FICHAS_EN_CACHE) fichas.delete(fichas.keys().next().value);
  fichas.set(id, { ev, momento: Date.now() });
}

function buscarEnFeed(id) {
  return feed.eventos ? feed.eventos.find((e) => e.id === id) || null : null;
}

async function pedirFicha(id) {
  try {
    if (!process.env.COLIMA_BACKEND_URL) throw new Error("Falta la variable COLIMA_BACKEND_URL");
    const datos = await llamarBackend(null, "/post/findOne/", {
      query: { id },
      timeoutMs: config.timeoutFichaMs,
    });
    const post = datos && datos.post;
    // findOne no filtra: también devuelve lugares (kind local, type ≠ 1) y
    // eventos pausados. Aquí solo interesan los eventos publicados.
    if (!post || post.kind === "local" || Number(post.type) !== 1 || post.status === false) {
      recordarFicha(id, null);
      return null;
    }
    const ev = normalizarEvento(post);
    recordarFicha(id, ev);
    return ev;
  } catch (err) {
    // { response:false } (no existe, id inválido): el evento no existe.
    if (err instanceof BackendError && err.backendStatus === 200) {
      recordarFicha(id, null);
      return null;
    }
    avisarFallo(`el evento ${id}`, err);
    return buscarEnFeed(id); // copia vieja del feed, mejor que nada
  }
}

/**
 * Un evento por su id. Sale de la caché del feed si está fresca; si no, de
 * GET /post/findOne/. null si el id no tiene 24 hex, no existe, no es un
 * evento (lugar) o está pausado. Nunca lanza.
 */
async function obtenerEvento(id) {
  if (typeof id !== "string" || !ID_RE.test(id)) return null;
  const ahora = Date.now();
  if (feed.eventos && ahora - feed.momento < TTL_FRESCO_MS) {
    const delFeed = buscarEnFeed(id);
    if (delFeed) return delFeed;
  }
  const previo = fichas.get(id);
  if (previo && ahora - previo.momento < TTL_FRESCO_MS) return previo.ev;
  if (fichasEnVuelo.has(id)) return fichasEnVuelo.get(id);
  const promesa = pedirFicha(id).finally(() => fichasEnVuelo.delete(id));
  fichasEnVuelo.set(id, promesa);
  return promesa;
}

// --- Top 10 (GET /post/top10, caché de 60 s) ---

const top = { lista: null, momento: 0, enVuelo: null, falloHasta: 0 };

function normalizarTop(crudo) {
  if (!crudo || typeof crudo !== "object") return null;
  const id = typeof crudo._id === "string" ? crudo._id : "";
  const titulo = texto(crudo.title);
  if (!ID_RE.test(id) || !titulo) return null;
  const imagenes = (Array.isArray(crudo.images) ? crudo.images : [crudo.images]).map(urlHttp).filter(Boolean);
  return { id, titulo, imagenes, esPortada: crudo.isCover === true, fecha: fechaDeIso(crudo.date) };
}

async function recargarTop() {
  try {
    if (!process.env.COLIMA_BACKEND_URL) throw new Error("Falta la variable COLIMA_BACKEND_URL");
    const datos = await llamarBackend(null, "/post/top10", { timeoutMs: config.timeoutFichaMs });
    const crudos = Array.isArray(datos) ? datos : Array.isArray(datos.top10) ? datos.top10 : null;
    if (!crudos) throw new Error("El top 10 del backend no es un arreglo");
    top.lista = crudos.map(normalizarTop).filter(Boolean).slice(0, 10);
    top.momento = Date.now();
    top.falloHasta = 0;
    return [...top.lista];
  } catch (err) {
    avisarFallo("el top 10", err);
    top.falloHasta = Date.now() + config.falloEsperaMs;
    return listaTopObsoleta();
  }
}

function listaTopObsoleta() {
  if (top.lista && Date.now() - top.momento < TTL_OBSOLETO_MS) return [...top.lista];
  top.lista = null;
  return [];
}

/**
 * El Top 10 del backend: [{ id, titulo, imagenes:[url], esPortada, fecha }].
 * [] si no hay o si falla (con la copia anterior hasta 1 h). Nunca lanza.
 */
async function obtenerTop10() {
  const ahora = Date.now();
  if (top.lista && ahora - top.momento < TTL_FRESCO_MS) return [...top.lista];
  if (top.enVuelo) return top.enVuelo;
  if (ahora < top.falloHasta) return listaTopObsoleta();
  top.enVuelo = recargarTop().finally(() => {
    top.enVuelo = null;
  });
  return top.enVuelo;
}

module.exports = {
  hoyEnColima,
  normalizarEvento,
  obtenerEventos,
  obtenerEvento,
  obtenerTop10,
  esVigente,
  proximos,
  pasados,
  diasDelEvento,
  eventosDeMunicipio,
  urlImagen,
  fechaDeIso,
  // Solo para scripts/verificar-guia.js.
  _interno: {
    config,
    reiniciar() {
      Object.assign(feed, { eventos: null, momento: 0, enVuelo: null, falloHasta: 0 });
      Object.assign(top, { lista: null, momento: 0, enVuelo: null, falloHasta: 0 });
      fichas.clear();
      fichasEnVuelo.clear();
    },
    // Hace "más viejas" las copias en memoria, para probar caducidad y stale-if-error.
    envejecer(ms) {
      feed.momento -= ms;
      top.momento -= ms;
      for (const f of fichas.values()) f.momento -= ms;
    },
  },
};
