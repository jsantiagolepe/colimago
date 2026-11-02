// Enlaces de afiliados de Mercado Libre para el bloque "Qué llevar" de las fichas.
//
// Mismos productos y misma lógica que la app (ColimagoMovil/src/config/queLlevar.ts): los
// productos viven en data/afiliados.json, agrupados en "kits" (playa, pesca, camping…).
// Cada ficha recibe los kits de su tipo (`por_tipo`), el de camping si tiene ese servicio
// y el de la feria si es la Feria de Colima. De ahí ve pocos productos: BASICOS_POR_LUGAR
// básicos y MEJORA_POR_LUGAR de "Para ir más lejos" (`mejora: true`, los caros), elegidos
// con una mezcla determinista por lugar: el mismo lugar siempre ve los mismos.
// Un producto solo se publica si tiene un enlace de afiliado válido en `url`; si no queda
// ninguno, el bloque entero se omite.
//
// Los enlaces se generan en el panel de afiliados de Mercado Libre; `npm run afiliados`
// lista qué falta y ayuda a pegarlos.

const fs = require("fs");
const path = require("path");

const ARCHIVO = path.join(__dirname, "..", "..", "data", "afiliados.json");

// Id de la Feria de Colima en el catálogo: tiene su propio kit.
const FERIA_COLIMA_ID = "f6fed523b82fcd5da4f19b90";

// Los enlaces de afiliado de Mercado Libre son meli.la/… o URLs de mercadolibre.com.mx.
const ENLACE_VALIDO = /^https:\/\/(meli\.la|([a-z0-9-]+\.)*mercadolibre\.com(\.mx)?|mercadolivre\.com\.br)\/\S+$/i;
const BASICOS_POR_LUGAR = 3;
const MEJORA_POR_LUGAR = 1;

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
    cache = { por_tipo: {}, kits: {} };
  }
  return cache;
}

// Todos los productos de todos los kits, con la clave de su kit.
function todosLosProductos() {
  const { kits } = cargar();
  return Object.entries(kits || {}).flatMap(([kit, datos]) => (datos.items || []).map((item) => ({ kit, ...item })));
}

// Semilla numérica estable a partir del id del lugar (hash djb2), igual que la app.
function semillaDe(texto) {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h;
}

// Mezcla determinista (mulberry32): el mismo lugar siempre ve los mismos productos.
function mezclar(lista, semilla) {
  const copia = [...lista];
  let s = semilla;
  const azar = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Kits que le tocan a un lugar: los de su tipo, el de camping si tiene ese servicio y el de la feria.
function kitsDeLugar(lugar) {
  if (lugar.id === FERIA_COLIMA_ID) return ["feria"];
  const ids = [...(cargar().por_tipo[String(lugar.tipo)] || [])];
  if (ids.length > 0 && (lugar.servicios || []).includes("camping")) ids.push("camping");
  return ids;
}

// El kit de una ficha en un idioma: { intro, basicos: [...], mejora: [...] } o null.
// Cada producto: { id, nombre, nota, etiqueta, url }.
function kitDe(lugar, lang = "es") {
  const { kits } = cargar();
  const elegidos = kitsDeLugar(lugar).map((c) => kits[c]).filter(Boolean);
  if (elegidos.length === 0) return null;
  const txt = (v) => (v && (v[lang] || v.es)) || "";
  const publicables = elegidos.flatMap((k) => k.items || []).filter((i) => esEnlaceValido(i.url));
  const n = semillaDe(String(lugar.id));
  const elegir = (mejora, semilla, max) =>
    mezclar(publicables.filter((i) => Boolean(i.mejora) === mejora), semilla)
      .slice(0, max)
      .map((i) => ({ id: i.id, nombre: txt(i.nombre), nota: txt(i.nota), etiqueta: txt(i.etiqueta), url: i.url.trim() }));
  const basicos = elegir(false, n, BASICOS_POR_LUGAR);
  const mejora = elegir(true, (n ^ 0x9e3779b9) >>> 0, MEJORA_POR_LUGAR);
  return basicos.length + mejora.length > 0 ? { intro: txt(elegidos[0].intro), basicos, mejora } : null;
}

module.exports = { esEnlaceValido, urlDeBusqueda, kitDe, todosLosProductos, cargar, ARCHIVO };
