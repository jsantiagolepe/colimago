// Enlaces de afiliados de Mercado Libre para el bloque "Qué llevar" de las fichas.
//
// Los productos viven en data/afiliados.json, agrupados en "kits" (playa, pesca…). Cada
// ficha recibe el kit de su categoría (`por_tipo`) o el que se le asigne a mano
// (`por_lugar`, por slug). Un producto solo se publica si tiene un enlace de afiliado
// válido en `url`; sin enlace no se pinta nada (en desarrollo se ve resaltado como
// borrador). Si ningún producto del kit tiene enlace, el bloque entero se omite.
//
// Los enlaces se generan en el panel de afiliados de Mercado Libre; `npm run afiliados`
// lista qué falta y ayuda a pegarlos.

const fs = require("fs");
const path = require("path");
const { mostrarBorradores } = require("./contenido");

const ARCHIVO = path.join(__dirname, "..", "..", "data", "afiliados.json");

// Los enlaces de afiliado de Mercado Libre son meli.la/… o URLs de mercadolibre.com.mx.
const ENLACE_VALIDO = /^https:\/\/(meli\.la|([a-z0-9-]+\.)*mercadolibre\.com(\.mx)?|mercadolivre\.com\.br)\/\S+$/i;
const MAX_PRODUCTOS = 6;

const esEnlaceValido = (url) => ENLACE_VALIDO.test(String(url || "").trim());

// Búsqueda en Mercado Libre México: sirve para generar el enlace de afiliado en el panel.
const urlDeBusqueda = (busqueda) =>
  `https://listado.mercadolibre.com.mx/${String(busqueda || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

let cache = null;
function cargar() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") console.error("afiliados: no se pudo leer data/afiliados.json:", err.message);
    cache = { por_tipo: {}, por_lugar: {}, kits: {} };
  }
  return cache;
}

// Todos los productos de todos los kits, con la clave de su kit.
function todosLosProductos() {
  const { kits } = cargar();
  return Object.entries(kits || {}).flatMap(([kit, datos]) => (datos.items || []).map((item) => ({ kit, ...item })));
}

// El kit de una ficha: { intro, items: [{ id, nombre, nota, url, pendiente }] } o null.
// `pendiente` marca un producto sin enlace válido (solo se devuelve fuera de producción).
function kitDe(lugar) {
  const { por_tipo, por_lugar, kits } = cargar();
  const claves = (por_lugar && por_lugar[lugar.slug]) || (por_tipo && por_tipo[String(lugar.tipo)]) || [];
  const elegidos = claves.map((c) => kits && kits[c]).filter(Boolean);
  if (elegidos.length === 0) return null;
  const items = elegidos
    .flatMap((k) => k.items || [])
    .map((i) => ({ ...i, url: String(i.url || "").trim(), pendiente: !esEnlaceValido(i.url) }))
    .filter((i) => mostrarBorradores() || !i.pendiente)
    .slice(0, MAX_PRODUCTOS);
  if (items.length === 0 || (!mostrarBorradores() && items.every((i) => i.pendiente))) return null;
  return { intro: elegidos[0].intro || "", items };
}

module.exports = { esEnlaceValido, urlDeBusqueda, kitDe, todosLosProductos, cargar, ARCHIVO };
