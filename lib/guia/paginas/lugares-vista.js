// Piezas que comparten las pantallas de lugares del catálogo: ficha de lugar,
// Rincones Naturales y Playas. Solo cosas de datos y de texto; el marcado de
// cada pantalla vive en su propio módulo.

const { h, raw } = require("../h");
const { t, ruta, nombreMunicipio, urlAbsoluta, SITIO } = require("../i18n");
const datos = require("../datos");

// Lista con conjunción: "A, B y C" / "A, B and C".
function listaConY(lang, elementos) {
  const lista = elementos.filter(Boolean);
  try {
    return new Intl.ListFormat(lang === "en" ? "en" : "es", { style: "long", type: "conjunction" }).format(lista);
  } catch {
    return lista.join(", ");
  }
}

// Nombre del municipio con acentos (el subtítulo del catálogo viene sin ellos).
function municipioDe(lugar) {
  return nombreMunicipio(lugar.municipioId) || lugar.subtitulo || "";
}

// Ruta (con idioma) de la ficha de un lugar.
function rutaLugar(lang, lugar) {
  return ruta(lang, `/lugar/${lugar.slug}`);
}

// Foto del lugar (real o ilustración) a 480 u 800 px, en absoluto para og:image y JSON-LD.
function urlFotoAbsoluta(lugar, ancho = 800) {
  const relativa = datos.rutaImagen(lugar.imagen, ancho);
  return relativa ? `${SITIO}${relativa}` : null;
}

// "Foto: autor · licencia · Wikimedia Commons" con "Wikimedia Commons" como enlace
// a la fuente cuando hay URL. `espacio` es "lugar" o "playas" (cada uno trae su clave).
function textoCredito(lang, credito, espacio = "lugar", clase = "") {
  if (!credito) return null;
  const texto = t(lang, `${espacio}.credito`, { autor: credito.autor, licencia: credito.licencia });
  const marca = credito.fuente || "Wikimedia Commons";
  const i = texto.lastIndexOf(marca);
  if (!credito.url || i < 0) return h`<span class="${clase}">${texto}</span>`;
  return h`<span class="${clase}">${texto.slice(0, i)}<a href="${credito.url}" target="_blank" rel="noopener nofollow">${marca}</a>${texto.slice(i + marca.length)}</span>`;
}

// Coordenadas que sí se pueden pintar en un mapa: números finitos, en rango, no 0,0.
function coordenadasValidas(lugar) {
  const u = lugar && lugar.ubicacion;
  if (!u) return false;
  const { lat, lng } = u;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(lat === 0 && lng === 0);
}

// Primeras ~155 letras de un texto, cortadas en palabra y con puntos suspensivos.
function resumen(texto, max = 155) {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim();
  if (limpio.length <= max + 5) return limpio;
  const corte = limpio.slice(0, max);
  const espacio = corte.lastIndexOf(" ");
  let corto = corte.slice(0, espacio > max * 0.6 ? espacio : max).replace(/[\s,;:.\-–—(]+$/, "");
  // Sin palabras sueltas al final ("…surf y…").
  const suelta = /\s+(y|e|o|u|de|del|la|el|las|los|en|con|a|un|una|que|por|para|and|or|of|the|in|with|to|a|an)$/i;
  while (suelta.test(corto)) corto = corto.replace(suelta, "").replace(/[\s,;:.\-–—(]+$/, "");
  return `${corto}…`;
}

// Categoría de Rincones (o Tianguis y mercados) a la que pertenece un lugar,
// con la ruta de su lista. null para hoteles y restaurantes.
function listaPadre(lang, lugar) {
  const categoria = datos.categoriaPorTipo(lugar.tipo);
  if (!categoria) return null;
  if (lugar.tipo >= 30) {
    return { padre: { nombre: t(lang, "lugar.tianguisMercados"), ruta: "/tianguis-y-mercados" }, categoria: null };
  }
  return {
    padre: { nombre: t(lang, "lugar.rincones"), ruta: "/rincones-naturales" },
    // Las playas tienen su propia pantalla (/playas), que es la que se enlaza.
    categoria: { nombre: datos.nombreCategoria(categoria.slug, lang), ruta: categoria.slug === "playas" ? "/playas" : `/rincones-naturales/${categoria.slug}`, slug: categoria.slug },
  };
}

// Ids de TikTok que aparecen en un solo lugar del catálogo. Un mismo id repetido
// en varios lugares (hoy en dos ríos y en la Feria) casi seguro es de otro sitio:
// no se muestra. Se calcula una vez, al cargar el módulo.
const CUENTA_TIKTOK = new Map();
for (const lugar of datos.lugares) {
  if (lugar.tiktok) CUENTA_TIKTOK.set(lugar.tiktok, (CUENTA_TIKTOK.get(lugar.tiktok) || 0) + 1);
}
function tiktokUnico(lugar) {
  return lugar.tiktok && CUENTA_TIKTOK.get(lugar.tiktok) === 1 ? String(lugar.tiktok) : null;
}

module.exports = { listaConY, municipioDe, rutaLugar, urlFotoAbsoluta, textoCredito, coordenadasValidas, resumen, listaPadre, tiktokUnico, urlAbsoluta, raw };
