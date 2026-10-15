// Arma el evento `app_opened` de una visita a la portada, con la misma forma
// que manda la app móvil a POST /logs de backColimaApp (colección `logs`),
// pero con platform "web". Lo arma este servidor y no el navegador: así el
// backend recibe siempre campos validados por nosotros, el navegador solo
// aporta su id de visitante, y los bots se descartan aquí con el user agent
// (que el backend no guarda, ni este servidor tampoco).
//
// Qué lleva cada campo en la web:
//   userId       id aleatorio que el navegador guarda (24 hex, como el de la app)
//   deviceModel  el navegador: "Chrome 126", "Safari 17", "Facebook"…
//   osVersion    el sistema: "iOS 17.5", "Android 13"… o solo "Android",
//                "Windows", "macOS" cuando el user agent no dice la versión
//   appVersion   la versión de package.json
//   appBuild     el commit desplegado (7 caracteres), o "local"
//   timestamp    la hora (UTC) en que llegó la visita a este servidor

const { version } = require("../package.json");

const ID_VISITANTE = /^[0-9a-f]{24}$/;

// Todo navegador real se anuncia "Mozilla/5.0 (…)", así que lo que no empieza
// así (curl, scripts, monitores) no es una persona. Los rastreadores que sí
// ejecutan JavaScript (Googlebot, Lighthouse) ejecutarían el script de la
// portada y se anuncian como navegador: esos se filtran por nombre.
const BOT = /bot\b|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|monitor|uptime/i;

function esBot(userAgent) {
  return !userAgent || !userAgent.startsWith("Mozilla/") || BOT.test(userAgent);
}

// Chrome congela su user agent: toda versión de Android aparece como
// "Android 10; K", así que ese 10 no dice nada y se omite. iOS sí manda la
// versión real; Windows (10 y 11 se anuncian igual) y macOS (siempre
// 10_15_7) no, y quedan sin versión para no inventar un dato.
function sistema(ua) {
  const ios = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)(?:_(\d+))?/);
  if (ios) return ios[2] ? `iOS ${ios[1]}.${ios[2]}` : `iOS ${ios[1]}`;
  if (/Android/.test(ua)) {
    const android = ua.match(/Android (\d+(?:\.\d+)?)/);
    return android && !/Android 10; K\)/.test(ua) ? `Android ${android[1]}` : "Android";
  }
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "unknown";
}

// El orden importa: casi todos los navegadores dicen ser "Chrome" y
// "Safari" además de lo que son. Facebook e Instagram van primero porque
// la gente llega de sus publicaciones y los abre su navegador interno.
const NAVEGADORES = [
  [/FBAN|FBAV/, () => "Facebook"],
  [/Instagram/, () => "Instagram"],
  [/(?:EdgA?|EdgiOS|Edge)\/(\d+)/, (v) => `Edge ${v}`],
  [/OPR\/(\d+)/, (v) => `Opera ${v}`],
  [/SamsungBrowser\/(\d+)/, (v) => `Samsung Internet ${v}`],
  [/(?:Firefox|FxiOS)\/(\d+)/, (v) => `Firefox ${v}`],
  [/(?:Chrome|CriOS)\/(\d+)/, (v) => `Chrome ${v}`],
  [/Version\/(\d+).*Safari\//, (v) => `Safari ${v}`],
];

function navegador(ua) {
  for (const [patron, nombre] of NAVEGADORES) {
    const coincide = ua.match(patron);
    if (coincide) return nombre(coincide[1]);
  }
  return undefined;
}

function idValido(userId) {
  return typeof userId === "string" && ID_VISITANTE.test(userId);
}

/**
 * El cuerpo de POST /logs del backend para esta visita.
 *
 * @param {string} userId     id del visitante (ya validado con idValido).
 * @param {string} userAgent  cabecera User-Agent de la petición.
 * @param {Date} [ahora]
 */
function armarEvento(userId, userAgent, ahora = new Date()) {
  const ua = String(userAgent || "").slice(0, 500);
  return {
    event: "app_opened",
    userId,
    platform: "web",
    deviceModel: navegador(ua),
    osVersion: sistema(ua),
    appVersion: version,
    appBuild: (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7),
    timestamp: ahora.toISOString(),
  };
}

module.exports = { armarEvento, esBot, idValido };
