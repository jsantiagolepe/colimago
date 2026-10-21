// Contexto propio de la ficha de una fiesta del pueblo: cuándo y dónde es, qué
// esperar de una fiesta de pueblo, consejos, lo que hay cerca en la guía y un
// párrafo sobre el municipio. No es una página: la usa fiestas-pueblo.js.
//
// El catálogo describe cada fiesta en una o dos frases; esto es lo que ayuda a
// decidir si ir. Todo sale de datos de la fiesta y del catálogo (data/), más
// texto general sobre fiestas de pueblo (data/i18n/<idioma>/fiestaguia.json);
// lo que no se sabe de una fiesta en concreto no se escribe.

const { h } = require("../h");
const { t, descripcion, ruta: rutaIdioma } = require("../i18n");
const datos = require("../datos");
const { esDeEjemplo } = require("../indexacion");
const { marcado } = require("./legal-vista");
const { lugaresDelMunicipio } = require("./evento-guia");

const G = (lang, clave, vars) => t(lang, `fiestaguia.${clave}`, vars);

// "5 de enero" / "January 5"; con `sinMes`, solo el día ("5" / "5").
function diaLargo(lang, { mes, dia }, sinMes = false) {
  // En español el mes va en minúscula en medio de la frase ("5 de enero").
  const nombre = datos.textos(lang).mesesLargos[mes - 1];
  if (sinMes) return String(dia);
  return lang === "en" ? `${nombre} ${dia}` : `${dia} de ${nombre.toLowerCase()}`;
}

// La oración de "cuándo y dónde" de la fiesta, según cómo se conozca su fecha.
function oracionDeCuando(lang, f, vars) {
  if (f.fechaTexto) return G(lang, "cuando.texto", { ...vars, fecha: datos.etiquetaFecha(f, lang) });
  const mismoDia = !f.fin || (f.fin.mes === f.inicio.mes && f.fin.dia === f.inicio.dia);
  if (mismoDia) return G(lang, "cuando.unDia", { ...vars, fecha: diaLargo(lang, f.inicio) });
  const mismoMes = f.fin.mes === f.inicio.mes;
  // "del 5 al 6 de enero" / "from January 5 to 6"; si cruza de mes, cada fecha completa.
  const inicio = lang === "en" || !mismoMes ? diaLargo(lang, f.inicio) : diaLargo(lang, f.inicio, true);
  const fin = lang === "en" && mismoMes ? diaLargo(lang, f.fin, true) : diaLargo(lang, f.fin);
  return G(lang, "cuando.rango", { ...vars, inicio, fin });
}

const seccion = (id, titulo, cuerpo) => h`
    <section class="ff-seccion lectura-contexto" aria-labelledby="t-${id}">
      <h2 class="seccion-titulo" id="t-${id}">${titulo}</h2>
      ${cuerpo}
    </section>`;

function contexto(lang, f, ctx) {
  const municipio = datos.municipioPorId(f.municipioId);
  const nombreMunicipio = municipio ? municipio.nombre : "";
  // "en Suchitlán, en el municipio de Comala, Colima"; sin repetir cuando la localidad es el propio municipio.
  const clave = !municipio ? "sinMunicipio" : f.localidad === nombreMunicipio ? "soloMunicipio" : "conLocalidad";
  const vars = { nombre: f.nombre, donde: G(lang, `donde.${clave}`, { localidad: f.localidad, municipio: nombreMunicipio }) };

  const sobre = seccion(
    "sobre",
    G(lang, "titulos.sobre"),
    h`<div class="lectura">
        <p>${oracionDeCuando(lang, f, vars)}${f.aproximada && ` ${G(lang, "cuando.aproximada")}`}</p>
        <p>${G(lang, "repite")}</p>
      </div>`,
  );
  const esperar = seccion("esperar", G(lang, "titulos.esperar"), h`<p class="lectura">${G(lang, "esperar")}</p>`);
  const consejos = seccion(
    "consejos",
    G(lang, "titulos.consejos"),
    h`<div class="lectura"><ul>${t(lang, "fiestaguia.consejos").map((c) => h`<li>${c}</li>`)}</ul></div>`,
  );

  const vecinos = municipio ? lugaresDelMunicipio(municipio.id) : [];
  const nombreCategoria = (l) => {
    const categoria = datos.categoriaPorTipo(l.tipo);
    return categoria ? datos.nombreCategoria(categoria.slug, lang) : "";
  };
  const cerca = seccion(
    "cerca",
    G(lang, "titulos.cerca"),
    h`${vecinos.length > 0 && h`<p class="lectura">${G(lang, "cerca.intro", { municipio: nombreMunicipio })}</p>
      <ul class="cerca-lista">
        ${vecinos.map((l) => h`<li><a href="${rutaIdioma(lang, `/lugar/${l.slug}`)}">${l.titulo}</a><span class="nota">${nombreCategoria(l)}</span></li>`)}
      </ul>`}
      <p class="lectura">${marcado(lang, G(lang, "cerca.enlaces"), "")}</p>`,
  );

  const delMunicipio = municipio ? datos.lugares.filter((l) => l.municipioId === municipio.id && !esDeEjemplo(l)) : [];
  const sobreMunicipio = municipio
    ? seccion(
        "municipio",
        G(lang, "titulos.municipio", { municipio: nombreMunicipio }),
        h`<div class="lectura">
        <p>${descripcion(lang, municipio.descCorta)}</p>
        <p>${G(lang, delMunicipio.length === 1 ? "municipio.conteo.uno" : "municipio.conteo.otros", { municipio: nombreMunicipio, n: delMunicipio.length })}
          <a href="${ctx.ruta(`/municipios/${municipio.slug}`)}">${G(lang, "municipio.ver", { municipio: nombreMunicipio })}</a>.</p>
      </div>`,
      )
    : "";

  return h`<div class="envoltura ff-contexto">${sobre}${esperar}${consejos}${cerca}${sobreMunicipio}</div>`;
}

module.exports = { contexto, oracionDeCuando };
