// La "guía de visita" de la ficha de un lugar: lo que sirve para planear la
// salida y que el catálogo (una descripción de unas 50 palabras) no cuenta.
// No es una página: la usa lugar.js.
//
// Cada sección junta texto escrito por categoría (data/i18n/<idioma>/lugarguia.json:
// qué esperar, mejor época, consejos) con datos de ESE lugar: el municipio y su
// descripción, los servicios del catálogo, la distancia en línea recta al centro de
// Colima y de Manzanillo (con las coordenadas del propio catálogo) y los lugares
// más cercanos. No inventa nada de un lugar en concreto: lo que no se sabe (un
// horario, un precio, una ruta de carretera) no se escribe.
//
//   const g = guia(lang, lugar, ctx)
//   g.perfil · g.llegar · g.epoca · g.consejos · g.cerca · g.municipio   (HTML o "")

const { h } = require("../h");
const { t, descripcion, ruta: rutaIdioma } = require("../i18n");
const datos = require("../datos");
const { esDeEjemplo } = require("../indexacion");
const { listaConY, municipioDe, coordenadasValidas } = require("./lugares-vista");

const G = (lang, clave, vars) => t(lang, `lugarguia.${clave}`, vars);

// ---------- Distancias ----------

// Dos puntos de referencia del propio catálogo: el Jardín Libertad (centro de
// Colima) y el Jardín Álvaro Obregón (centro de Manzanillo).
const referencia = (slug) => {
  const lugar = datos.lugarPorSlug(slug);
  return lugar && coordenadasValidas(lugar) ? lugar.ubicacion : null;
};
const CENTRO_COLIMA = referencia("centro-historico-de-colima-jardin-libertad-y-portales");
const CENTRO_MANZANILLO = referencia("jardin-alvaro-obregon");

// Distancia en línea recta (haversine), en km.
function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}
const formatoKm = (km) => (km < 10 ? km.toFixed(1) : String(Math.round(km)));

// Hasta `max` lugares del catálogo más cercanos, sin repetir más de dos del mismo tipo
// (en el centro de Colima hay muchos mercados y no deben ser todo lo que se lista).
function cercanos(lugar, max = 5) {
  if (!coordenadasValidas(lugar)) return [];
  const ordenados = datos.lugares
    .filter((x) => x.id !== lugar.id && !esDeEjemplo(x) && coordenadasValidas(x))
    .map((x) => ({ lugar: x, km: distanciaKm(lugar.ubicacion, x.ubicacion) }))
    .sort((a, b) => a.km - b.km);
  const porTipo = new Map();
  const elegidos = [];
  const sobrantes = [];
  for (const c of ordenados) {
    const n = porTipo.get(c.lugar.tipo) || 0;
    if (n < 2) {
      elegidos.push(c);
      porTipo.set(c.lugar.tipo, n + 1);
    } else {
      sobrantes.push(c);
    }
    if (elegidos.length === max) break;
  }
  return [...elegidos, ...sobrantes].slice(0, max).sort((a, b) => a.km - b.km);
}

// ---------- Piezas ----------

const seccion = (id, titulo, cuerpo) => h`
    <section class="lugar-seccion lugar-guia lectura-contexto" aria-labelledby="t-${id}">
      <h2 class="seccion-titulo" id="t-${id}">${titulo}</h2>
      ${cuerpo}
    </section>`;

// "Restaurante" → "restaurante" para meterlo en una frase; "Wi-Fi" se queda como está.
const enMinuscula = (nombre) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñü ]*$/.test(nombre) ? nombre.toLowerCase() : nombre);

// Nombre de la categoría de un lugar ("Ríos", "Tianguis"…).
function nombreDeCategoria(lang, lugar) {
  const categoria = datos.categoriaPorTipo(lugar.tipo);
  return categoria ? datos.nombreCategoria(categoria.slug, lang) : "";
}

// Ruta de la lista de la categoría de un lugar.
function rutaDeCategoria(categoria) {
  if (categoria.tipo >= 30) return "/tianguis-y-mercados";
  return categoria.slug === "playas" ? "/playas" : `/rincones-naturales/${categoria.slug}`;
}

function frasesDeDistancia(lang, lugar, municipio) {
  const vars = { lugar: lugar.titulo, municipio };
  if (!coordenadasValidas(lugar) || !CENTRO_COLIMA) return G(lang, "llegar.sinCoordenadas", vars);
  const kmColima = distanciaKm(lugar.ubicacion, CENTRO_COLIMA);
  vars.kmColima = formatoKm(kmColima);
  if (kmColima < 3 && lugar.municipioId === 1) return G(lang, "llegar.centro", vars);
  const kmManzanillo = CENTRO_MANZANILLO ? distanciaKm(lugar.ubicacion, CENTRO_MANZANILLO) : Infinity;
  if (kmManzanillo > 70) return G(lang, "llegar.colima", vars);
  vars.kmManzanillo = formatoKm(kmManzanillo);
  return G(lang, "llegar.ambos", vars);
}

// ---------- La guía ----------

function guia(lang, lugar, ctx) {
  const categoria = datos.categoriaPorTipo(lugar.tipo);
  // Hoteles y restaurantes (datos de ejemplo) y lugares sin categoría no llevan guía.
  if (!categoria || esDeEjemplo(lugar)) return { perfil: "", llegar: "", epoca: "", consejos: "", cerca: "", municipio: "" };

  const municipio = municipioDe(lugar);
  const infoMunicipio = datos.municipioPorId(lugar.municipioId);
  const textos = (clave) => G(lang, `categorias.${categoria.slug}.${clave}`, { lugar: lugar.titulo, municipio });

  // --- Sobre el lugar ---
  const servicios = [...new Set(datos.serviciosPintables(lugar.servicios, lang).map((s) => s.nombre))];
  const perfil = seccion(
    "perfil",
    G(lang, "titulos.perfil", { lugar: lugar.titulo }),
    h`<div class="lectura">
        <p>${textos("perfil")}${servicios.length > 0 && ` ${G(lang, "servicios", { servicios: listaConY(lang, servicios.map(enMinuscula)) })}`}</p>
        <p>${textos("esperar")}</p>
      </div>`,
  );

  // --- Cómo llegar ---
  const llegar = seccion(
    "llegar",
    G(lang, "titulos.llegar"),
    h`<div class="lectura">
        <p>${frasesDeDistancia(lang, lugar, municipio)}</p>
        <p>${G(lang, "llegar.consejo")}</p>
      </div>`,
  );

  // --- Mejor época ---
  const epoca = seccion(
    "epoca",
    G(lang, "titulos.epoca"),
    h`<div class="lectura">
        <p>${textos("epoca")}</p>
        <p>${G(lang, "clima")}</p>
      </div>`,
  );

  // --- Consejos ---
  const consejos = seccion(
    "consejos",
    G(lang, "titulos.consejos"),
    h`<div class="lectura"><ul>
        ${[...t(lang, `lugarguia.categorias.${categoria.slug}.consejos`), ...t(lang, "lugarguia.comunes")].map((c) => h`<li>${c}</li>`)}
      </ul></div>`,
  );

  // --- Qué hay cerca ---
  const vecinos = cercanos(lugar);
  const cerca =
    vecinos.length === 0
      ? ""
      : seccion(
          "cerca",
          G(lang, "titulos.cerca"),
          h`<p class="lectura">${G(lang, "cerca.intro", { lugar: lugar.titulo })}</p>
      <ul class="cerca-lista">
        ${vecinos.map(
          ({ lugar: x, km }) => h`<li>
          <a href="${rutaIdioma(lang, `/lugar/${x.slug}`)}">${x.titulo}</a>
          <span class="nota">${nombreDeCategoria(lang, x)} · ${km < 1 ? G(lang, "cerca.pocosMetros") : G(lang, "cerca.km", { km: formatoKm(km) })}</span>
        </li>`,
        )}
      </ul>`,
        );

  // --- Más del municipio y de la categoría ---
  const delMunicipio = datos.lugares.filter((x) => x.municipioId === lugar.municipioId && !esDeEjemplo(x));
  const otrosMunicipios = datos.lugaresPorTipo(lugar.tipo)
    .filter((x) => x.municipioId !== lugar.municipioId && !esDeEjemplo(x))
    .map((x) => ({ lugar: x, km: coordenadasValidas(lugar) && coordenadasValidas(x) ? distanciaKm(lugar.ubicacion, x.ubicacion) : Infinity }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 3);
  const nombreCategoria = datos.nombreCategoria(categoria.slug, lang);
  const municipioSeccion = infoMunicipio
    ? seccion(
        "municipio",
        G(lang, "titulos.municipio", { municipio }),
        h`<div class="lectura">
        <p>${descripcion(lang, infoMunicipio.descCorta)}</p>
        <p>${G(lang, delMunicipio.length === 1 ? "municipio.conteo.uno" : "municipio.conteo.otros", { municipio, n: delMunicipio.length })}
          <a href="${ctx.ruta(`/municipios/${infoMunicipio.slug}`)}">${G(lang, "municipio.verMunicipio", { municipio })}</a>.</p>
        ${
          otrosMunicipios.length > 0 &&
          h`<p>${G(lang, "municipio.otrosDe")}
          ${otrosMunicipios.map(({ lugar: x }, i) => h`${i > 0 && ", "}<a href="${rutaIdioma(lang, `/lugar/${x.slug}`)}">${x.titulo}</a>`)}.
          <a href="${ctx.ruta(rutaDeCategoria(categoria))}">${G(lang, "municipio.verCategoria", { categoria: nombreCategoria })}</a>.</p>`
        }
      </div>`,
      )
    : "";

  return { perfil, llegar, epoca, consejos, cerca, municipio: municipioSeccion };
}

module.exports = { guia, distanciaKm, formatoKm, cercanos, CENTRO_COLIMA };
