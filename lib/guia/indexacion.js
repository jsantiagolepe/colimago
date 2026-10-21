// Qué páginas de la guía se ofrecen a los buscadores y cuáles no.
//
// Un buscador (y la revisión de AdSense) juzga el sitio por lo que indexa, así
// que se indexa solo lo que está a la altura:
//   · Las páginas en inglés solo se indexan si su texto principal está escrito
//     en inglés. Las descripciones de los eventos se traducen con una máquina
//     (backend, Claude Haiku) sin revisión, y los lugares y fiestas que no
//     tienen traducción salen en español bajo una página en inglés: hasta que
//     una persona las revise, esas páginas llevan noindex y no entran al
//     sitemap ni se anuncian como alterna (hreflang) de su versión en español.
//   · Un evento que ya terminó no se indexa: su página sigue existiendo (los
//     enlaces viejos funcionan) pero deja de ser contenido útil.
//   · Los hoteles y restaurantes del catálogo son datos de ejemplo.
//
// Las usan las páginas (robots y alternos) y el sitemap, para que las dos
// cosas digan siempre lo mismo.

const tieneTexto = (valor) => typeof valor === "string" && valor.trim().length > 0;

// Hoteles (20) y restaurantes (21) del catálogo: datos de ejemplo.
const esDeEjemplo = (lugar) => lugar.tipo === 20 || lugar.tipo === 21;

function lugarIndexable(lugar, lang) {
  if (esDeEjemplo(lugar)) return false;
  return lang !== "en" || tieneTexto(lugar.descripcion && lugar.descripcion.en);
}

function fiestaIndexable(fiesta, lang) {
  return lang !== "en" || tieneTexto(fiesta.descripcion && fiesta.descripcion.en);
}

// Eventos: la traducción al inglés es automática, así que /en/evento/* no se indexa.
// `hoy` es 'YYYY-MM-DD' (hoyEnColima de eventos.js).
function eventoIndexable(evento, lang, hoy) {
  if (lang === "en") return false;
  return (evento.finFecha || evento.fecha) >= hoy;
}

module.exports = { esDeEjemplo, lugarIndexable, fiestaIndexable, eventoIndexable };
