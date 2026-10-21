// Piezas compartidas por las pantallas sociales de la guía (Explorar, detalle
// de evento, Calendario y Favoritos). No es una página: index.js no la monta.
//
// Todo texto de interfaz sale del espacio "evento" de data/i18n; lo que viene
// del backend (títulos, descripciones, lugares) es texto libre y se pinta
// siempre por h`` (escapa).

const { h, raw } = require("../h");
const { t, ruta, urlAbsoluta, nombreMunicipio, fechaConDia, fechaLarga, fechaCorta, hora12, descripcion } = require("../i18n");
const { municipioPorId } = require("../datos");
const { urlImagen } = require("../eventos");
const { icono } = require("../componentes");

const ID_RE = /^[a-f0-9]{24}$/;

// ---------- Municipio ----------

function municipioDe(ev) {
  return ev && ev.municipioId ? municipioPorId(ev.municipioId) : null;
}

function hrefMunicipio(lang, municipio) {
  return municipio ? ruta(lang, `/municipios/${municipio.slug}`) : null;
}

// Medallón (la acuarela del municipio) o, sin municipio, el Perro de Colima.
function medallonMunicipio(municipio, { tam = 46 } = {}) {
  if (!municipio) {
    return h`<span class="medallon medallon-perro" style="width:${tam}px" aria-hidden="true"><span class="perro"></span></span>`;
  }
  return h`<span class="medallon" style="width:${tam}px"><img src="${municipio.estampa}" alt="" width="200" height="200" loading="lazy" decoding="async" /></span>`;
}

// ---------- Cuándo ----------

// "sábado 24 de octubre a las 4:30 PM" · "Del 31 de octubre al 2 de noviembre".
// La hora es "flotante" (la de Colima): se lee tal cual, sin zonas horarias.
function textoFecha(lang, ev, { conDia = true } = {}) {
  const largo = (f) => (conDia ? fechaConDia(lang, f) : fechaLarga(lang, f));
  const hora = ev.todoElDia ? null : ev.hora;
  if (ev.finFecha) {
    const rango = t(lang, "evento.rango", { inicio: largo(ev.fecha), fin: largo(ev.finFecha) });
    return hora ? t(lang, "evento.rangoHora", { rango, hora: hora12(hora) }) : rango;
  }
  return hora ? t(lang, "evento.fechaHora", { fecha: largo(ev.fecha), hora: hora12(hora) }) : largo(ev.fecha);
}

// Como la app móvil en las listas: "16 de octubre a las 9:00 PM" (sin día de la semana).
function textoFechaCorta(lang, ev) {
  return textoFecha(lang, ev, { conDia: false });
}

// "<fecha>" para compartir: "24 de octubre" / "Oct 24".
function fechaParaCompartir(lang, ev) {
  return fechaCorta(lang, ev.fecha);
}

// ¿Está pasando hoy (o ya acabó)? Con fechas 'YYYY-MM-DD' basta comparar texto.
function estadoDelEvento(ev, hoy) {
  const fin = ev.finFecha || ev.fecha;
  if (fin < hoy) return "paso";
  if (ev.fecha <= hoy) return "hoy";
  return "proximo";
}

// ---------- Color del evento → paleta de la guía ----------

// El backend manda un nombre de color; solo se reconocen los dos tintes de
// letrero. Lo demás (white, vacío…) es la luz del foco.
function tintaDelEvento(ev) {
  const c = String(ev.color || "").toLowerCase();
  if (c === "red") return "bandera";
  if (c === "blue") return "lona";
  return "foco";
}

// ---------- Fotos ----------

function sinFoto(lang) {
  return h`<span class="sin-foto" role="img" aria-label="${t(lang, "evento.sinFoto")}"></span>`;
}

// Cloudinary entrega la foto ya a la anchura pedida (urlImagen).
function imagenEvento(lang, ev, { sizes = "100vw", anchos = [480, 800, 1200], prioridad = false, alt = "" } = {}) {
  if (!ev.imagen) return sinFoto(lang);
  const srcset = anchos.map((a) => `${urlImagen(ev.imagen, a)} ${a}w`).join(", ");
  const medio = anchos[Math.min(1, anchos.length - 1)];
  return h`<img src="${urlImagen(ev.imagen, medio)}" srcset="${srcset}" sizes="${sizes}" alt="${alt}" ${prioridad ? raw('fetchpriority="high" decoding="async"') : raw('loading="lazy" decoding="async"')} />`;
}

// ---------- Acciones con contadores que llena social.js ----------

// accionesPost() pinta ceros y social.js los completa solo con sesión. Los
// lugares no traen contadores en el catálogo: se marcan con data-metricas y
// se ocultan hasta que social.js los llena.
function conMetricas(html) {
  return raw(String(html).replace("data-acciones", "data-acciones data-metricas hidden"));
}

// ---------- Texto de los organizadores ----------

// Los textos de los eventos vienen de publicaciones de redes sociales, llenas de
// emojis. En la guía se leen limpios: se quitan los emojis (y sus uniones y
// variantes) y se acomodan los espacios, sin tocar © ® ™ ni los números.
const EMOJI = /\p{Extended_Pictographic}|[\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;
const SIMBOLOS_DE_TEXTO = new Set(["\u00A9", "\u00AE", "\u2122"]);
function sinEmojis(texto) {
  return String(texto || "")
    .replace(EMOJI, (c) => (SIMBOLOS_DE_TEXTO.has(c) ? c : ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------- Texto para metadatos ----------

// Una línea limpia (sin saltos ni espacios dobles) para <meta description>.
function resumen(texto, max = 150) {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max);
  const espacio = corte.lastIndexOf(" ");
  return `${corte.slice(0, espacio > max * 0.6 ? espacio : max).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

// ---------- Redes sociales de un evento ----------

// URL segura para un href, o null. El backend a veces manda un enlace sin
// esquema ("facebook.com/…") o solo el número de WhatsApp.
function urlRed(clave, valor) {
  const v = String(valor || "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (clave === "whatsapp") {
    const digitos = v.replace(/\D/g, "");
    return digitos.length >= 8 ? `https://wa.me/${digitos}` : null;
  }
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return `https://${v}`;
  return null;
}

module.exports = {
  ID_RE,
  municipioDe,
  hrefMunicipio,
  medallonMunicipio,
  nombreMunicipio,
  textoFecha,
  textoFechaCorta,
  fechaParaCompartir,
  estadoDelEvento,
  tintaDelEvento,
  sinFoto,
  imagenEvento,
  conMetricas,
  resumen,
  sinEmojis,
  urlRed,
  icono,
  urlAbsoluta,
  descripcion,
};
