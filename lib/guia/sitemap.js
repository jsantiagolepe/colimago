// sitemap.xml dinámico: la portada y toda la guía (es y en), con hreflang.
//
// Reemplaza al public/sitemap.xml estático (la CDN lo serviría antes que
// Express). Incluye los 178 lugares (con la foto cuando es real), los diez
// municipios, las 44 fiestas del pueblo, la Feria y los eventos del backend
// vigentes o de los últimos 60 días. Si el backend falla, solo omite los
// eventos. No pone <lastmod> donde no lo conoce de verdad.

const datos = require("./datos");
const eventos = require("./eventos");
const { esc } = require("./h");

const SITIO = "https://www.colimago.mx";

// Páginas fijas de la guía. Favoritos, ajustes y sugerir no se indexan.
const FIJAS = [
  "/inicio",
  "/explorar",
  "/calendario",
  "/rincones-naturales/rios",
  "/rincones-naturales/playas",
  "/rincones-naturales/lagunas",
  "/rincones-naturales/montanas",
  "/rincones-naturales/arqueologia",
  "/rincones-naturales/parques",
  "/rincones-naturales/patrimonio",
  "/rincones-naturales/balnearios",
  "/rincones-naturales/rutas",
  "/playas",
  "/municipios",
  "/tianguis-y-mercados",
  "/fiestas-del-pueblo",
  "/fiestas-charrotaurinas",
  "/acerca-de",
];

// Fotos de la portada (las mismas que ya listaba el sitemap anterior).
const FOTOS_PORTADA = [
  "og-colima-go.jpg",
  "img/playa-el-paraiso.webp",
  "img/playa-boca-de-pascuales.webp",
  "img/playa-tecuanillo.webp",
  "img/playa-la-boquita.webp",
  "img/playa-el-real.webp",
  "img/laguna-carrizalillo.webp",
  "img/laguna-la-maria-760.webp",
  "img/laguna-el-naranjal-760.webp",
  "img/rio-los-amiales-760.webp",
  "img/rio-el-sauce-760.webp",
  "img/rio-parajes-760.webp",
  "img/rio-agua-fria-760.webp",
  "img/rio-zacualpan-760.webp",
  "img/montana-el-terrero-760.webp",
  "img/montana-la-gloria-escondida-760.webp",
  "img/fiestas-del-pueblo.webp",
  "img/fiesta-cabalgata-760.webp",
  "img/fiesta-petatera-760.webp",
  "img/fiesta-mojigangos-760.webp",
];

const imagenes = (rutas) => rutas.map((r) => `    <image:image><image:loc>${esc(`${SITIO}${r.startsWith("/") ? r : `/${r}`}`)}</image:loc></image:image>`).join("\n");

// <url> con sus dos idiomas: una entrada por idioma, cada una con los alternos.
function entradaDoble(ruta, { fotos = [], lastmod } = {}) {
  const es = `${SITIO}${ruta}`;
  const en = `${SITIO}/en${ruta}`;
  const alternos = `    <xhtml:link rel="alternate" hreflang="es-MX" href="${esc(es)}" />\n    <xhtml:link rel="alternate" hreflang="en" href="${esc(en)}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(es)}" />`;
  return [es, en]
    .map((loc) => `  <url>\n    <loc>${esc(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}${alternos}\n${fotos.length ? `${imagenes(fotos)}\n` : ""}  </url>`)
    .join("\n");
}

async function construir() {
  const bloques = [];

  // La portada: solo español.
  bloques.push(`  <url>\n    <loc>${SITIO}/</loc>\n${imagenes(FOTOS_PORTADA)}\n  </url>`);

  for (const ruta of FIJAS) bloques.push(entradaDoble(ruta));
  for (const m of datos.municipios) bloques.push(entradaDoble(`/municipios/${m.slug}`, { fotos: [`/img/m/${m.slug}.webp`] }));
  for (const f of datos.fiestas) bloques.push(entradaDoble(`/fiestas-del-pueblo/${f.id}`));
  for (const l of datos.lugares) {
    const foto = l.imagen && l.imagen.tipo === "foto" && l.imagen.archivo ? [`/img/${l.imagen.archivo}-800.webp`] : [];
    bloques.push(entradaDoble(`/lugar/${l.slug}`, { fotos: foto }));
  }

  // Eventos del backend: vigentes y de los últimos 60 días. Si falla, se omiten.
  try {
    const { eventos: lista } = await eventos.obtenerEventos();
    const hoy = eventos.hoyEnColima();
    const [a, m, d] = hoy.split("-").map(Number);
    const limite = new Date(Date.UTC(a, m - 1, d - 60)).toISOString().slice(0, 10);
    for (const ev of lista) {
      const fin = ev.finFecha || ev.fecha;
      if (fin >= limite) bloques.push(entradaDoble(`/evento/${ev.id}`));
    }
  } catch {
    // sin eventos en esta versión del sitemap
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${bloques.join("\n")}\n</urlset>\n`;
}

async function sitemap(req, res) {
  try {
    const xml = await construir();
    res.set("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    res.type("application/xml").send(xml);
  } catch (err) {
    console.error("No se pudo armar el sitemap:", err);
    res.status(500).type("text/plain").send("No se pudo generar el sitemap.");
  }
}

module.exports = { sitemap, construir };
