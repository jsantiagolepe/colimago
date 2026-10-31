// Las guías (/guias): artículos largos en data/guias/<slug>.md, con enlaces a las fichas.
//
// Cada archivo empieza con un encabezado entre líneas "---" (clave: valor) y sigue con el
// texto en un Markdown mínimo: "## " y "### " para títulos, "- " para listas, párrafos
// separados por una línea en blanco, [texto](/ruta) para enlaces y **negritas**.
//
//   ---
//   titulo: Fin de semana en Colima: itinerario de 2 días
//   descripcion: Una frase para el buscador (unos 150 caracteres).
//   fecha: 2026-10-31            # publicación
//   actualizado: 2026-10-31      # última revisión
//   autor: Redacción de Colima Go
//   lugares: slug-uno, slug-dos  # fichas relacionadas; la foto sale de la primera que la tenga
//   ---
//
// Igual que en las fichas (contenido.js), un bloque que todavía lleva [VERIFICAR] no se
// publica ni se cuenta; en desarrollo se ve resaltado. Una guía se indexa sola cuando sus
// bloques publicables suman unas 600 palabras.

const fs = require("fs");
const path = require("path");
const { esc } = require("./h");
const { ruta: rutaIdioma } = require("./i18n");
const { tieneMarca, palabras, mostrarBorradores } = require("./contenido");
const datos = require("./datos");

const CARPETA = path.join(__dirname, "..", "..", "data", "guias");
const MIN_PALABRAS_GUIA = 600;

// "[texto](/ruta)" y "**negrita**" sobre texto ya escapado. Solo enlaces internos o https.
function enLinea(lang, texto) {
  return esc(texto)
    .replace(/\[([^\]]+)\]\((\/[^)\s]*|https:\/\/[^)\s]+)\)/g, (m, txt, url) => (url.startsWith("/") ? `<a href="${esc(rutaIdioma(lang, url))}">${txt}</a>` : `<a href="${url}" target="_blank" rel="noopener nofollow">${txt}</a>`))
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function bloquesDe(cuerpo) {
  const salida = [];
  for (const parrafo of cuerpo.split(/\n\s*\n/)) {
    const lineas = parrafo.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lineas.length) continue;
    if (lineas.every((l) => /^(- |\d+\. )/.test(l))) {
      salida.push({ tipo: /^- /.test(lineas[0]) ? "ul" : "ol", items: lineas.map((l) => l.replace(/^(- |\d+\. )/, "").trim()) });
    } else if (/^### /.test(lineas[0])) {
      salida.push({ tipo: "h3", texto: lineas[0].slice(4).trim() });
    } else if (/^## /.test(lineas[0])) {
      salida.push({ tipo: "h2", texto: lineas[0].slice(3).trim() });
    } else {
      salida.push({ tipo: "p", texto: lineas.join(" ").trim() });
    }
  }
  return salida;
}

const textoDe = (b) => (b.items ? b.items.join(" ") : b.texto);

function leer(archivo) {
  const crudo = fs.readFileSync(path.join(CARPETA, archivo), "utf8");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(crudo);
  if (!m) throw new Error(`guías: ${archivo} no tiene encabezado`);
  const meta = {};
  for (const linea of m[1].split("\n")) {
    const i = linea.indexOf(":");
    if (i > 0) meta[linea.slice(0, i).trim()] = linea.slice(i + 1).replace(/\s+#.*$/, "").trim();
  }
  const bloques = bloquesDe(m[2]).map((b) => ({ ...b, pendiente: tieneMarca(textoDe(b)) || (b.items && b.items.some(tieneMarca)) }));
  // En una lista, solo se quitan los elementos con marca; el bloque se queda con el resto.
  for (const b of bloques) {
    if (b.items) {
      b.items = b.items.map((texto) => ({ texto, pendiente: tieneMarca(texto) }));
      b.pendiente = false;
    }
  }
  const slug = archivo.replace(/\.md$/, "");
  const lugares = (meta.lugares || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    slug,
    titulo: meta.titulo,
    descripcion: meta.descripcion,
    fecha: meta.fecha,
    actualizado: meta.actualizado || meta.fecha,
    autor: meta.autor || "Redacción de Colima Go",
    lugares,
    bloques,
  };
}

let cache = null;
function todas() {
  if (cache) return cache;
  let archivos = [];
  try {
    archivos = fs.readdirSync(CARPETA).filter((f) => f.endsWith(".md"));
  } catch {
    // aún no hay guías
  }
  cache = archivos.map(leer).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.slug.localeCompare(b.slug)));
  return cache;
}

// Los bloques que se publican (y los que no, resaltados, solo fuera de producción).
function paraPintar(guia) {
  const ver = mostrarBorradores();
  const bloques = guia.bloques
    .map((b) => (b.items ? { ...b, items: b.items.filter((i) => ver || !i.pendiente) } : b))
    .filter((b) => (ver || !b.pendiente) && (!b.items || b.items.length > 0));
  return bloques;
}

// Palabras ya publicables de una guía (sin los bloques con marca).
function palabrasPublicas(guia) {
  return guia.bloques.reduce((n, b) => {
    if (b.items) return n + b.items.filter((i) => !i.pendiente).reduce((s, i) => s + palabras(i.texto), 0);
    return b.pendiente ? n : n + palabras(b.texto);
  }, 0);
}

const guiaIndexable = (guia) => palabrasPublicas(guia) >= MIN_PALABRAS_GUIA;
const porSlug = (slug) => todas().find((g) => g.slug === slug) || null;
const indexables = () => todas().filter(guiaIndexable);

// Fichas relacionadas que existen, y la primera foto real entre ellas.
const fichasDe = (guia) => guia.lugares.map((s) => datos.lugarPorSlug(s)).filter(Boolean);
function fotoDe(guia) {
  const l = fichasDe(guia).find((x) => x.imagen && x.imagen.tipo === "foto" && x.imagen.archivo);
  return l ? { archivo: l.imagen.archivo, credito: l.imagen.credito || null, alt: l.titulo, ancho: l.imagen.ancho, alto: l.imagen.alto } : null;
}

// Marcas pendientes para `npm run pendientes`.
function pendientes() {
  const salida = [];
  for (const g of todas()) {
    g.bloques.forEach((b, i) => {
      if (b.items) b.items.filter((x) => x.pendiente).forEach((x) => salida.push({ slug: g.slug, campo: `bloque ${i + 1}`, texto: x.texto }));
      else if (b.pendiente) salida.push({ slug: g.slug, campo: `bloque ${i + 1}`, texto: b.texto });
    });
  }
  return salida;
}

module.exports = { MIN_PALABRAS_GUIA, enLinea, todas, porSlug, paraPintar, palabrasPublicas, guiaIndexable, indexables, fichasDe, fotoDe, pendientes };
