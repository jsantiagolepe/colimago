// La "guía de visita" de la ficha de un lugar: lo que sirve para planear la salida y que
// el catálogo (una descripción de unas 50 palabras) no cuenta. No es una página: la usa
// lugar.js.
//
// Solo lleva texto que es de ESE lugar:
//   · lo que se escribió y confirmó en data/lugares-contenido.json (descripción larga,
//     cómo llegar, mejor época, consejos, datos concretos y fotos; ver contenido.js);
//   · las distancias en línea recta al centro de Colima y de Manzanillo, calculadas con
//     las coordenadas del propio catálogo;
//   · los lugares más cercanos y el municipio.
// Las secciones que dependen de texto propio (sobre el lugar, cómo llegar, mejor época,
// consejos, datos, fotos) no se pintan si el lugar no lo tiene: no hay texto de relleno
// por categoría.
//
//   const g = guia(lang, lugar, ctx)
//   g.perfil · g.datos · g.galeria · g.llegar · g.epoca · g.consejos · g.llevar · g.cerca · g.municipio   (HTML o "")

const fs = require("fs");
const path = require("path");
const { h, raw, esc } = require("../h");
const { t, descripcion, ruta: rutaIdioma } = require("../i18n");
const datos = require("../datos");
const { esDeEjemplo } = require("../indexacion");
const { paraPintar } = require("../contenido");
const { kitDe } = require("../afiliados");
const { municipioDe, coordenadasValidas } = require("./lugares-vista");

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

// Los textos propios están en español: en la página en inglés se marca el idioma.
const atributoIdioma = (lang) => (lang === "en" ? raw(' lang="es"') : "");

// Párrafo propio; en desarrollo, un borrador (con [VERIFICAR]) se ve resaltado.
const parrafo = (lang, p, etiqueta = "p") =>
  p.pendiente
    ? raw(`<${etiqueta} class="borrador" title="${esc(G(lang, "borrador"))}"${lang === "en" ? ' lang="es"' : ""}>${esc(p.texto)}</${etiqueta}>`)
    : raw(`<${etiqueta}${lang === "en" ? ' lang="es"' : ""}>${esc(p.texto)}</${etiqueta}>`);

// Las fotos propias están en public/img/<archivo>-480.webp y -800.webp; la que no existe no se pinta.
const RAIZ_IMG = path.join(__dirname, "..", "..", "..", "public", "img");
const existeFoto = (archivo) => fs.existsSync(path.join(RAIZ_IMG, `${archivo}-800.webp`));

function guia(lang, lugar, ctx) {
  const categoria = datos.categoriaPorTipo(lugar.tipo);
  const vacia = { perfil: "", datos: "", galeria: "", llegar: "", epoca: "", consejos: "", llevar: "", cerca: "", municipio: "", actualizado: null };
  // Hoteles y restaurantes (datos de ejemplo) y lugares sin categoría no llevan guía.
  if (!categoria || esDeEjemplo(lugar)) return vacia;

  const municipio = municipioDe(lugar);
  const infoMunicipio = datos.municipioPorId(lugar.municipioId);
  const propio = paraPintar(lugar.slug);

  // --- Sobre el lugar (descripción larga) ---
  const perfil =
    propio.parrafos.length > 0
      ? seccion("perfil", G(lang, "titulos.perfil", { lugar: lugar.titulo }), h`<div class="lectura">${propio.parrafos.map((p) => parrafo(lang, p))}</div>`)
      : "";

  // --- Datos concretos: costo, horarios, precios, accesibilidad, salvavidas, renta ---
  const datosVisita =
    propio.datos.length > 0
      ? seccion(
          "datos",
          G(lang, "titulos.datos"),
          h`<dl class="lugar-datos">${propio.datos.map((d) => h`<div${d.pendiente ? raw(' class="borrador"') : ""}><dt>${G(lang, `datos.${d.clave}`)}</dt><dd${atributoIdioma(lang)}>${d.texto}</dd></div>`)}</dl>`,
        )
      : "";

  // --- Fotos propias ---
  const fotos = propio.galeria.filter((f) => existeFoto(f.archivo));
  const galeria =
    fotos.length > 0
      ? seccion(
          "galeria",
          G(lang, "titulos.galeria"),
          h`<ul class="lugar-galeria">${fotos.map(
            (f) => h`<li><figure><img src="/img/${f.archivo}-800.webp" srcset="/img/${f.archivo}-480.webp 480w, /img/${f.archivo}-800.webp 800w" sizes="(max-width: 700px) 100vw, 320px" alt="${f.alt}" loading="lazy" decoding="async" />${f.credito && h`<figcaption class="nota">${f.credito}</figcaption>`}</figure></li>`,
          )}</ul>`,
        )
      : "";

  // --- Cómo llegar: las distancias calculadas son siempre únicas; el texto propio, si lo hay ---
  const llegar = seccion(
    "llegar",
    G(lang, propio.llegar ? "titulos.llegar" : "titulos.distancias"),
    h`<div class="lectura">
        <p>${frasesDeDistancia(lang, lugar, municipio)}</p>
        ${propio.llegar && parrafo(lang, propio.llegar)}
      </div>`,
  );

  // --- Mejor época y consejos: solo con texto propio ---
  const epoca = propio.epoca ? seccion("epoca", G(lang, "titulos.epoca"), h`<div class="lectura">${parrafo(lang, propio.epoca)}</div>`) : "";
  const consejos =
    propio.consejos.length > 0
      ? seccion(
          "consejos",
          G(lang, "titulos.consejos"),
          h`<div class="lectura"><ul>${propio.consejos.map((c) => parrafo(lang, c, "li"))}</ul></div>`,
        )
      : "";

  // --- Qué llevar: productos de afiliados (Mercado Libre) que sirven para ese tipo de lugar ---
  const kit = kitDe(lugar);
  const llevar = kit
    ? seccion(
        "llevar",
        G(lang, "titulos.llevar"),
        h`<p class="lectura"${atributoIdioma(lang)}>${kit.intro}</p>
      <ul class="cerca-lista">
        ${kit.items.map(
          (i) => h`<li${i.pendiente ? raw(` class="borrador" title="${esc(G(lang, "llevar.sinEnlace"))}"`) : ""}>
          ${i.pendiente ? h`<span${atributoIdioma(lang)}>${i.nombre}</span>` : h`<a href="${i.url}" target="_blank" rel="sponsored nofollow noopener"${atributoIdioma(lang)}>${i.nombre}</a>`}
          <span class="nota"${atributoIdioma(lang)}>${i.nota}</span>
        </li>`,
        )}
      </ul>
      <p class="nota">${G(lang, "llevar.aviso")}</p>`,
      )
    : "";

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

  return { perfil, datos: datosVisita, galeria, llegar, epoca, consejos, llevar, cerca, municipio: municipioSeccion, actualizado: propio.actualizado };
}

module.exports = { guia, distanciaKm, formatoKm, cercanos, CENTRO_COLIMA };
