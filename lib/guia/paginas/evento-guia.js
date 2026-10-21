// Contexto propio de la ficha de un evento: lo que la guía sabe y el texto de los
// organizadores no dice. No es una página: la usa evento.js.
//
// El texto del evento (una publicación de redes, a menudo de un ayuntamiento) se
// muestra tal cual, sin emojis. Alrededor, la ficha suma: cuándo y dónde es, cómo
// llegar (la distancia al centro de Colima, con las coordenadas del propio
// evento), qué hay cerca en la guía y un párrafo sobre el municipio. Todo sale de
// datos del evento y del catálogo; lo que no se sabe no se escribe. Los textos
// viven en data/i18n/<idioma>/eventoguia.json.

const { h } = require("../h");
const { t, descripcion, ruta: rutaIdioma } = require("../i18n");
const datos = require("../datos");
const { esDeEjemplo } = require("../indexacion");
const { coordenadasValidas } = require("./lugares-vista");
const { distanciaKm, formatoKm, cercanos, CENTRO_COLIMA } = require("./lugar-guia");
const { marcado } = require("./legal-vista");

const G = (lang, clave, vars) => t(lang, `eventoguia.${clave}`, vars);
const minuscula = (texto) => (texto ? texto.charAt(0).toLowerCase() + texto.slice(1) : texto);

const seccion = (id, titulo, cuerpo) => h`
    <section class="detalle-seccion detalle-contexto lectura-contexto" aria-labelledby="t-${id}">
      <h2 class="seccion-titulo" id="t-${id}">${titulo}</h2>
      ${cuerpo}
    </section>`;

// "el sábado 24 de octubre a las 4:30 PM" / "del 31 de octubre al 2 de noviembre".
function fraseDeFecha(lang, ev, fecha) {
  return ev.finFecha ? `${G(lang, "cuando.desde")}${minuscula(fecha)}` : `${G(lang, "cuando.el")}${fecha}`;
}

// Hasta `max` lugares del municipio, de tipos distintos (primero los de Rincones).
function lugaresDelMunicipio(municipioId, max = 4) {
  const vistos = new Set();
  return datos.lugares
    .filter((l) => l.municipioId === municipioId && !esDeEjemplo(l))
    .sort((a, b) => (a.tipo >= 30) - (b.tipo >= 30) || a.tipo - b.tipo)
    .filter((l) => (vistos.has(l.tipo) ? false : vistos.add(l.tipo)))
    .slice(0, max);
}

// ev: evento normalizado (lib/guia/eventos.js); titulo y fecha ya van limpios.
function contexto(lang, ev, ctx, { titulo, fecha, municipio, pasado }) {
  const lugar = ev.ubicacion && ev.ubicacion.nombre ? ev.ubicacion.nombre.trim() : "";
  const vars = { titulo, fecha: fraseDeFecha(lang, ev, fecha), lugar, municipio: municipio ? municipio.nombre : "" };
  const clave = lugar ? (municipio ? "conLugar" : "conLugarSinMunicipio") : municipio ? "sinLugar" : "sinMunicipio";
  const sobre = seccion(
    "sobre",
    G(lang, "titulos.sobre"),
    h`<div class="lectura">
        <p>${G(lang, `cuando.${clave}`, vars)}</p>
        <p>${G(lang, "fuente")}</p>
        ${pasado && h`<p>${marcado(lang, G(lang, "pasado"), "")}</p>`}
      </div>`,
  );

  // Cómo llegar: con coordenadas, la distancia al centro de Colima; sin ellas, un aviso honesto.
  const conMapa = ev.ubicacion && coordenadasValidas({ ubicacion: ev.ubicacion }) && CENTRO_COLIMA;
  let llegar;
  if (conMapa) {
    const km = distanciaKm(ev.ubicacion, CENTRO_COLIMA);
    const nombre = lugar || (municipio ? municipio.nombre : titulo);
    llegar = G(lang, km < 3 ? "llegar.conMapaCentro" : "llegar.conMapa", { lugar: nombre, km: formatoKm(km) });
  } else {
    llegar = G(lang, "llegar.sinMapa");
  }
  const comoLlegar = seccion("llegar", G(lang, "titulos.llegar"), h`<p class="lectura">${llegar}</p>`);

  // Qué hay cerca: por coordenadas del evento; si no, lugares del municipio.
  const vecinos = conMapa
    ? cercanos({ id: ev.id, ubicacion: ev.ubicacion }, 4).map((c) => ({ lugar: c.lugar, km: c.km }))
    : municipio
      ? lugaresDelMunicipio(municipio.id).map((l) => ({ lugar: l, km: null }))
      : [];
  const nombreCategoria = (l) => {
    const categoria = datos.categoriaPorTipo(l.tipo);
    return categoria ? datos.nombreCategoria(categoria.slug, lang) : "";
  };
  const cerca = seccion(
    "cerca",
    G(lang, "titulos.cerca"),
    h`${vecinos.length > 0 && h`<p class="lectura">${G(lang, conMapa ? "cerca.intro" : "cerca.introMunicipio", { municipio: vars.municipio })}</p>`}
      ${
        vecinos.length > 0 &&
        h`<ul class="cerca-lista">
        ${vecinos.map(
          ({ lugar: l, km }) => h`<li>
          <a href="${rutaIdioma(lang, `/lugar/${l.slug}`)}">${l.titulo}</a>
          <span class="nota">${nombreCategoria(l)}${km !== null && ` · ${km < 1 ? G(lang, "cerca.pocosMetros") : G(lang, "cerca.km", { km: formatoKm(km) })}`}</span>
        </li>`,
        )}
      </ul>`
      }
      <p class="lectura">${marcado(lang, G(lang, "cerca.enlaces"), "")}</p>`,
  );

  // Sobre el municipio.
  const delMunicipio = municipio ? datos.lugares.filter((l) => l.municipioId === municipio.id && !esDeEjemplo(l)) : [];
  const sobreMunicipio = municipio
    ? seccion(
        "municipio",
        G(lang, "titulos.municipio", { municipio: municipio.nombre }),
        h`<div class="lectura">
        <p>${descripcion(lang, municipio.descCorta)}</p>
        <p>${G(lang, delMunicipio.length === 1 ? "municipio.conteo.uno" : "municipio.conteo.otros", { municipio: municipio.nombre, n: delMunicipio.length })}
          <a href="${ctx.ruta(`/municipios/${municipio.slug}`)}">${G(lang, "municipio.ver", { municipio: municipio.nombre })}</a>.</p>
      </div>`,
      )
    : "";

  return h`${sobre}${comoLlegar}${cerca}${sobreMunicipio}`;
}

module.exports = { contexto, lugaresDelMunicipio };
