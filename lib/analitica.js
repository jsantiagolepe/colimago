// Analítica anónima de colimago.mx, del lado del servidor: convierte lo que
// mandó el navegador (POST /e) y las cabeceras de la petición en el log que
// guarda el backend (POST /colimago-logs de backColimaApp, colección propia
// `colimago_logs`). Es la misma forma de registro que usa realestatecolima.mx.
//
// La IP y el user agent se leen aquí y no salen de este servidor: al backend
// solo llegan el hash del visitante, el tipo de dispositivo y la ubicación
// aproximada. Nada de esto identifica a una persona.

const { createHmac } = require("crypto");

// Palabra corta en minúsculas con guion bajo: no cabe texto libre en un
// target ni en un lugar de la página.
const PALABRA = /^[a-z0-9_]{1,32}$/;
const ITEM = /^[a-z0-9._-]{1,80}$/;
const HOST = /^[a-z0-9.-]{1,100}$/;

// Todo navegador real se anuncia "Mozilla/5.0 (…)", así que lo que no empieza
// así (curl, scripts, monitores) no es una persona. Los rastreadores que sí
// ejecutan JavaScript (Googlebot renderiza las páginas) y las pruebas de
// velocidad se anuncian como navegador: esos se filtran por nombre.
const BOT =
  /bot\b|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|facebookexternalhit|monitor|uptime|python-requests|curl\/|wget|axios|node-fetch|go-http-client|okhttp\/|java\//i;

const esBot = (userAgent) => !userAgent || !userAgent.startsWith("Mozilla/") || BOT.test(userAgent);

// ---- El dispositivo ---------------------------------------------------------

function dispositivo(ua) {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "mobile";
  return "desktop";
}

function sistema(ua) {
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Macintosh|Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}

// Los navegadores internos van primero: también dicen ser Safari o Chrome.
function navegador(ua) {
  if (/Instagram/.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return "Facebook";
  if (/TikTok|musical_ly|Bytedance/i.test(ua)) return "TikTok";
  if (/EdgA?\/|Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung";
  if (/Firefox|FxiOS/.test(ua)) return "Firefox";
  if (/CriOS|Chrome/.test(ua)) return "Chrome";
  if (/Safari/.test(ua)) return "Safari";
  return "Other";
}

// Colima no tiene horario de verano: el día es una fecha UTC-6 simple.
const diaMexico = (fecha) => new Date(fecha.getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Hash del día, la IP y el navegador, firmado con un secreto: cuenta a las
// personas distintas de un día y no significa nada al día siguiente (el día
// es parte del hash) ni fuera del servidor (el secreto lo es). No sigue a
// nadie de un día a otro.
const visitante = (secreto, ip, userAgent, ahora) =>
  createHmac("sha256", secreto)
    .update(`visitor|${diaMexico(ahora)}|${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);

// Vercel pone la ubicación aproximada de la IP en estas cabeceras (la ciudad
// va codificada como URL). En local no existen.
function geo(cabecera) {
  const leer = (nombre) => {
    const valor = cabecera(nombre);
    if (!valor) return undefined;
    try {
      return decodeURIComponent(valor).slice(0, 80);
    } catch {
      return undefined;
    }
  };
  const pais = (cabecera("x-vercel-ip-country") || "").toUpperCase();
  return {
    country: /^[A-Z]{2}$/.test(pais) ? pais : undefined,
    region: leer("x-vercel-ip-country-region")?.slice(0, 8),
    city: leer("x-vercel-ip-city"),
  };
}

const ipDe = (cabecera) => cabecera("x-real-ip") || (cabecera("x-forwarded-for") || "").split(",")[0].trim() || "";

// ---- De dónde llegó la visita -----------------------------------------------

const hostEs = (host, dominios) => dominios.some((d) => host === d || host.endsWith(`.${d}`));

const SOCIAL = [
  "facebook.com", "fb.com", "fb.me", "instagram.com", "tiktok.com", "youtube.com", "youtu.be",
  "linkedin.com", "pinterest.com", "twitter.com", "x.com", "t.co", "threads.net", "whatsapp.com",
  "wa.me", "messenger.com",
];
const BUSCADOR = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|brave)\./;
const MEDIO_DE_PAGO = /^(cpc|ppc|paid|paidsearch|paid_search|paid_social|paidsocial|display|cpm)$/i;
const FUENTE_META = /^(meta|facebook|fb|instagram|ig)$/i;
const FUENTE_GOOGLE = /^(google|google_ads|googleads|adwords)$/i;

function canal(a) {
  const pago = Boolean(a.utmMedium && MEDIO_DE_PAGO.test(a.utmMedium));
  const fuente = a.utmSource || "";

  if (a.gclid || (pago && FUENTE_GOOGLE.test(fuente))) return "google_ads";
  if (pago && FUENTE_META.test(fuente)) return "meta_ads";
  if (a.utmSource || a.utmMedium || a.utmCampaign) return "campaign";
  // Facebook agrega fbclid a todo enlace abierto desde él, sea anuncio o no.
  if (a.fbclid) return "social";

  if (a.referrer) {
    if (BUSCADOR.test(a.referrer)) return "search";
    if (hostEs(a.referrer, SOCIAL)) return "social";
    return "referral";
  }
  return "direct";
}

// ---- Lo que manda el navegador ----------------------------------------------

const texto = (valor, max) => {
  if (typeof valor !== "string") return undefined;
  const limpio = valor.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return limpio || undefined;
};

// El lugar, evento, fiesta o guía al que pertenece una ruta: el último tramo
// de /lugar/:slug, /evento/:id, /fiestas-del-pueblo/:id, /gastronomia/:id y
// /guias/:slug (con o sin el prefijo /en).
const RUTA_CON_ITEM = /^(?:\/en)?\/(?:lugar|place|evento|event|fiestas-del-pueblo|gastronomia|guias|guides)\/([^/]+)$/;

function itemDeRuta(ruta) {
  const m = RUTA_CON_ITEM.exec(ruta);
  if (!m) return undefined;
  let slug;
  try {
    slug = decodeURIComponent(m[1]).toLowerCase();
  } catch {
    return undefined;
  }
  return ITEM.test(slug) ? slug : undefined;
}

/**
 * Solo lo que el backend va a aceptar, o null: un campo malo haría que rechace
 * el evento entero, así que lo que no cabe se descarta aquí.
 */
function leerEvento(cuerpo) {
  if (typeof cuerpo !== "object" || cuerpo === null) return null;
  if (cuerpo.event !== "page_view" && cuerpo.event !== "click") return null;
  if (typeof cuerpo.path !== "string") return null;
  const ruta = cuerpo.path.split(/[?#]/)[0];
  if (!/^\/\S{0,199}$/.test(ruta)) return null;

  const target = typeof cuerpo.target === "string" && PALABRA.test(cuerpo.target) ? cuerpo.target : undefined;
  if (cuerpo.event === "click" && !target) return null;

  return {
    event: cuerpo.event,
    path: ruta,
    target: cuerpo.event === "click" ? target : undefined,
    place: typeof cuerpo.place === "string" && PALABRA.test(cuerpo.place) ? cuerpo.place : undefined,
    item: itemDeRuta(ruta),
    referrer: typeof cuerpo.referrer === "string" && HOST.test(cuerpo.referrer) ? cuerpo.referrer : undefined,
    utmSource: texto(cuerpo.utmSource, 60),
    utmMedium: texto(cuerpo.utmMedium, 60),
    utmCampaign: texto(cuerpo.utmCampaign, 60),
    gclid: cuerpo.gclid === true || undefined,
    fbclid: cuerpo.fbclid === true || undefined,
    lang: cuerpo.lang === "es" || cuerpo.lang === "en" ? cuerpo.lang : undefined,
  };
}

/**
 * El cuerpo de POST /colimago-logs del backend para este evento.
 *
 * @param {object} evento    lo que devolvió leerEvento.
 * @param {(nombre: string) => string|undefined} cabecera  lee una cabecera de la petición.
 * @param {string} secreto   COLIMAGO_LOGS_KEY (firma el hash del visitante).
 * @param {Date} [ahora]
 */
function armarLog(evento, cabecera, secreto, ahora = new Date()) {
  const userAgent = String(cabecera("user-agent") || "").slice(0, 500);
  return {
    event: evento.event,
    platform: "web",
    ts: ahora.toISOString(),
    path: evento.path,
    target: evento.target,
    place: evento.place,
    item: evento.item,
    channel: canal(evento),
    referrer: evento.referrer,
    utmSource: evento.utmSource,
    utmMedium: evento.utmMedium,
    utmCampaign: evento.utmCampaign,
    device: dispositivo(userAgent),
    os: sistema(userAgent),
    browser: navegador(userAgent),
    ...geo(cabecera),
    visitor: visitante(secreto, ipDe(cabecera), userAgent, ahora),
    lang: evento.lang,
  };
}

module.exports = { armarLog, leerEvento, esBot, canal, itemDeRuta, dispositivo, sistema, navegador, visitante, diaMexico };
