// Texto propio de los lugares y reglas de publicación de lo que está en borrador.
//
// El catálogo (data/lugares.json, generado por scripts/importar-app-movil.js) trae una
// descripción de unas 50 palabras por lugar. El texto que sí escribimos nosotros vive en
// data/lugares-contenido.json, por slug, y NO lo toca el importador:
//
//   "<slug>": {
//     "descripcion_larga": ["párrafo", "párrafo"],   // o un solo texto con párrafos separados por línea en blanco
//     "como_llegar": "…", "mejor_epoca": "…", "consejos": ["…"],
//     "datos": { "costo_entrada": "…", "horarios": "…", "precios_comida": "…",
//                "accesibilidad": "…", "salvavidas": "…", "renta_equipo": "…" },
//     "galeria": [{ "archivo": "g/<slug>/01", "alt": "…", "credito": "…" }],
//     "actualizado": "2026-10-31"
//   }
//
// Regla de los borradores: un párrafo, consejo o dato que todavía contiene [VERIFICAR] o
// [COMPLETAR] NO se publica (ni se cuenta como texto propio) hasta que se confirme y se
// quite la marca. Así ninguna marca llega a la web y cada ficha se indexa sola cuando
// acumula texto publicable. En desarrollo (sin NODE_ENV=production ni VERCEL_ENV=production)
// los borradores sí se ven, resaltados, para poder revisarlos.

const fs = require("fs");
const path = require("path");

const MARCA = /\[(VERIFICAR|COMPLETAR)[^\]]*\]/i;
const MIN_PALABRAS_PROPIAS = 150;

const mostrarBorradores = () => process.env.VERCEL_ENV !== "production" && process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

const tieneMarca = (texto) => MARCA.test(String(texto || ""));
const palabras = (texto) => (String(texto || "").match(/\S+/g) || []).length;
const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");
const lista = (valor) => (Array.isArray(valor) ? valor.map(texto).filter(Boolean) : []);

// Divide un texto en párrafos (línea en blanco) o acepta ya una lista.
const parrafosDe = (valor) => (Array.isArray(valor) ? lista(valor) : texto(valor).split(/\n\s*\n/).map(texto).filter(Boolean));

// Separa lo publicable de lo pendiente: [{ texto, pendiente }]
const piezas = (items) => items.map((t) => ({ texto: t, pendiente: tieneMarca(t) }));
const publicables = (items) => items.filter((p) => !p.pendiente);

let cache = null;
function cargar() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "data", "lugares-contenido.json"), "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") console.error("contenido: no se pudo leer data/lugares-contenido.json:", err.message);
    cache = {};
  }
  return cache;
}

const DATOS = [
  ["costo_entrada", "costoEntrada"],
  ["horarios", "horarios"],
  ["precios_comida", "preciosComida"],
  ["accesibilidad", "accesibilidad"],
  ["salvavidas", "salvavidas"],
  ["renta_equipo", "rentaEquipo"],
];

// Lo que hay de un lugar, separado en publicable y pendiente. Siempre devuelve un objeto.
function contenidoDe(slug) {
  const bruto = cargar()[slug] || {};
  const parrafos = piezas(parrafosDe(bruto.descripcion_larga));
  const consejos = piezas(lista(bruto.consejos));
  const llegar = texto(bruto.como_llegar) ? piezas([texto(bruto.como_llegar)]) : [];
  const epoca = texto(bruto.mejor_epoca) ? piezas([texto(bruto.mejor_epoca)]) : [];
  const datosBrutos = bruto.datos || {};
  const datos = DATOS.filter(([k]) => texto(datosBrutos[k])).map(([k, clave]) => ({ clave, texto: texto(datosBrutos[k]), pendiente: tieneMarca(datosBrutos[k]) }));
  const galeria = (Array.isArray(bruto.galeria) ? bruto.galeria : []).filter((f) => f && texto(f.archivo) && texto(f.alt));
  return { parrafos, consejos, llegar, epoca, datos, galeria, actualizado: texto(bruto.actualizado) || null };
}

// Lo que se pinta en la página según el entorno: borradores solo fuera de producción.
function paraPintar(slug) {
  const c = contenidoDe(slug);
  const ver = (items) => (mostrarBorradores() ? items : publicables(items));
  return {
    parrafos: ver(c.parrafos),
    consejos: ver(c.consejos),
    llegar: ver(c.llegar)[0] || null,
    epoca: ver(c.epoca)[0] || null,
    datos: ver(c.datos),
    galeria: c.galeria,
    actualizado: c.actualizado,
    hayBorrador: [c.parrafos, c.consejos, c.llegar, c.epoca, c.datos].some((items) => items.some((p) => p.pendiente)),
  };
}

// Palabras de texto propio ya publicable de un lugar: su descripción del catálogo más lo
// que se haya escrito y confirmado en data/lugares-contenido.json.
function palabrasPropias(lugar) {
  const c = contenidoDe(lugar.slug);
  const base = palabras(lugar.descripcion && lugar.descripcion.es);
  const extra = [...c.parrafos, ...c.consejos, ...c.llegar, ...c.epoca, ...c.datos].filter((p) => !p.pendiente).reduce((n, p) => n + palabras(p.texto), 0);
  return base + extra;
}

// Fecha de la última revisión de la ficha: la propia de data/lugares-contenido.json si la
// tiene; si no, la de la última importación del catálogo (data/catalogo-fecha.json, que se
// actualiza a mano cuando se vuelve a importar o revisar el catálogo).
function fechaActualizacion(slug) {
  const propia = contenidoDe(slug).actualizado;
  if (propia) return propia;
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "data", "catalogo-fecha.json"), "utf8")).lugares || null;
  } catch {
    return null;
  }
}

// Marcas pendientes de todo el archivo, para `npm run pendientes`.
function pendientes() {
  const salida = [];
  for (const [slug, bruto] of Object.entries(cargar())) {
    const revisar = (campo, valor) => {
      if (tieneMarca(valor)) salida.push({ slug, campo, texto: String(valor) });
    };
    parrafosDe(bruto.descripcion_larga).forEach((p, i) => revisar(`descripcion_larga[${i}]`, p));
    revisar("como_llegar", bruto.como_llegar);
    revisar("mejor_epoca", bruto.mejor_epoca);
    lista(bruto.consejos).forEach((c, i) => revisar(`consejos[${i}]`, c));
    for (const [k] of DATOS) revisar(`datos.${k}`, (bruto.datos || {})[k]);
  }
  return salida;
}

module.exports = { MARCA, MIN_PALABRAS_PROPIAS, mostrarBorradores, tieneMarca, palabras, parrafosDe, contenidoDe, paraPintar, palabrasPropias, fechaActualizacion, pendientes };
