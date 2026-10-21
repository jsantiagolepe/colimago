// Fiestas del Pueblo: el calendario de fiestas patronales, ferias y
// cabalgatas, mes por mes (/fiestas-del-pueblo), y la ficha de cada fiesta
// (/fiestas-del-pueblo/:id), que es la hoja de la app convertida en página
// real e indexable.
//
// Datos 100 % locales (data/fiestas-pueblo.json): no hay backend ni fechas con
// año, las fiestas se repiten cada año. Por eso la página sale igual para todo
// el mundo y es cacheable; "hoy" lo calcula el navegador con la hora de Colima
// (public/js/paginas/fiestas.js), que también salta al mes actual.
//
// Sin JavaScript: los doce meses, sus fiestas y la navegación por anclas
// (#mes-N) funcionan igual; solo faltan el "Hoy" y el salto al mes actual.

const { h, raw, atributos } = require("../h");
const { t, tn, ruta, urlAbsoluta, SITIO } = require("../i18n");
const D = require("../datos");
const { fiestaIndexable } = require("../indexacion");
const { contexto } = require("./fiesta-guia");
const { icono, letrero, boton, anuncio, intercalarAnuncios } = require("../componentes");

// Cada mes se pinta con una de las dos tintas de letrero, alternando.
const tonoMes = (mes) => (mes % 2 ? "lona" : "bandera");

// Los textos de las fiestas solo existen en español: en la página en inglés se
// marcan para que el lector de pantalla y el traductor lo sepan.
const langEs = (lang) => (lang === "en" ? raw(' lang="es"') : "");

function recortar(texto, max) {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max - 1);
  return `${corte.slice(0, corte.lastIndexOf(" ") > 40 ? corte.lastIndexOf(" ") : corte.length).replace(/[ ,;:.]+$/, "")}…`;
}

// ---------- Fila de fiesta (la usan la lista y "Más fiestas") ----------
// La fecha va pintada tipo rótulo: la cifra grande en Shrikhand sobre una
// pincelada de lona o bandera. Cuando la cifra no cuenta toda la historia
// (cruza de mes o la fecha es un texto) se escribe la fecha completa debajo.
function fila(f, lang, { conDescripcion = true } = {}) {
  const mes = f.inicio.mes;
  const fecha = D.etiquetaFecha(f, lang);
  const cifra = D.cifraDia(f);
  const mesCorto = D.textos(lang).mesesCortos[mes - 1];
  const fechaCompleta = Boolean(f.fechaTexto || (f.fin && f.fin.mes !== mes));
  // Para "hoy" el navegador compara mes*100+día; las de fecha en texto nunca.
  const desde = f.inicio.mes * 100 + f.inicio.dia;
  const hasta = f.fin ? f.fin.mes * 100 + f.fin.dia : desde;
  const vigencia = f.fechaTexto ? null : { "data-desde": desde, "data-hasta": hasta };
  return h`<li class="fiesta tono-${tonoMes(mes)}"${atributos(vigencia)}>
    <a class="fiesta-enlace" href="${ruta(lang, `/fiestas-del-pueblo/${f.id}`)}">
      <span class="fiesta-fecha">
        <span class="fiesta-pintura" aria-hidden="true"></span>
        <span class="foco-solo encendido fiesta-foco" aria-hidden="true" hidden></span>
        <span class="fiesta-cifra rotulo cifra${cifra.length > 3 ? " cifra-larga" : ""}">${cifra}</span>
        <span class="fiesta-mes tablilla">${mesCorto}</span>
      </span>
      <span class="fiesta-cuerpo">
        <span class="fiesta-nombre">${f.nombre}</span>
        <span class="fiesta-lugar tablilla"><span class="pastilla pastilla-hoy fiesta-hoy" hidden>${t(lang, "fiestas.hoy")}</span><span>${D.lugarDeFiesta(f)}</span></span>
        ${fechaCompleta && h`<span class="fiesta-rango">${fecha}</span>`}
        ${conDescripcion && h`<span class="fiesta-desc"${langEs(lang)} hidden>${f.descripcion.es}</span>`}
      </span>
      <span class="fiesta-ir" aria-hidden="true">${icono("chevron-derecha")}</span>
    </a>
  </li>`;
}

// ---------- Lista: doce meses ----------
function seccionMes({ mes, filas, nFiestas, lang }) {
  const nombre = D.textos(lang).mesesLargos[mes - 1];
  return h`<section class="mes tono-${tonoMes(mes)}" id="mes-${mes}" data-mes="${mes}" aria-labelledby="mes-t-${mes}">
    <div class="mes-cabeza">
      <h2 class="mes-nombre rotulo" id="mes-t-${mes}">${nombre}</h2>
      <span class="pastilla pastilla-lona mes-actual" hidden>${t(lang, "fiestas.esteMes")}</span>
      <span class="mes-filete" aria-hidden="true"></span>
      <span class="mes-cuenta tablilla-tenue">${tn(lang, "fiestas.fiestasMes", nFiestas)}</span>
    </div>
    ${filas.length ? h`<ul class="mes-lista">${filas}</ul>` : h`<p class="mes-vacio nota">${t(lang, "fiestas.sinFiestasMes")}</p>`}
  </section>`;
}

// Navegación de meses: un cable vertical con un foco por mes en escritorio, una
// fila de chips deslizables en móvil. Es el mismo marcado: son enlaces a #mes-N.
function navegacionMeses(lang) {
  const { mesesLargos, mesesCortos } = D.textos(lang);
  return h`<nav class="fp-meses" aria-label="${t(lang, "fiestas.navMeses")}">
    <ul>
      ${mesesLargos.map(
        (nombre, i) => h`<li><a href="#mes-${i + 1}" data-mes="${i + 1}">
          <span class="foco-solo" aria-hidden="true"></span>
          <span class="mes-largo">${nombre}</span><span class="mes-corto" aria-hidden="true">${mesesCortos[i]}</span>
        </a></li>`,
      )}
    </ul>
  </nav>`;
}

function lista(req, ctx) {
  const { lang } = ctx;

  // Los anuncios cuentan fiestas, no cabeceras de mes: uno cada seis (solo
  // banners), y si hubiera menos de seis, uno al cierre.
  const elementos = [];
  for (const { mes, fiestas } of D.fiestasPorMes()) {
    elementos.push({ tipo: "mes", mes, nFiestas: fiestas.length });
    for (const f of fiestas) elementos.push({ tipo: "fiesta", f });
  }
  const conAnuncios = intercalarAnuncios(elementos, { cada: 6, formatos: ["banner"], cuenta: (e) => e.tipo === "fiesta" });
  const meses = [];
  for (const e of conAnuncios) {
    if (e.tipo === "mes") meses.push({ mes: e.mes, nFiestas: e.nFiestas, filas: [] });
    else if (e.anuncio) meses[meses.length - 1].filas.push(h`<li class="fp-anuncio">${anuncio({ lang, formato: "banner", indice: e.indice })}</li>`);
    else meses[meses.length - 1].filas.push(fila(e.f, lang));
  }

  const titulo = t(lang, "datos.fiestas.townFestivals");
  const entrada = t(lang, "datos.fiestas.townFestivalsIntro");
  const cuerpo = h`
    <div class="envoltura">
      ${letrero({
        id: "t-fiestas",
        texto: titulo,
        tinta: "bandera",
        giro: -1,
        entrada,
        extra: boton({
          texto: t(lang, "datos.sugerir.suggestShort"),
          href: ruta(lang, "/sugerir/fiesta"),
          variante: "contorno",
          icono: "mas",
          attrs: { "aria-label": t(lang, "datos.sugerir.suggestButton") },
        }),
      })}
    </div>
    <div class="envoltura fp" data-fiestas>
      ${navegacionMeses(lang)}
      <div class="fp-contenido">
        <p class="fp-nota nota">${icono("info")}<span>${t(lang, "fiestas.notaGeneral")}</span></p>
        ${meses.map((m) => seccionMes({ ...m, lang }))}
        ${lang === "en" && h`<p class="nota fp-aviso-es">${t(lang, "fiestas.soloEspanol")}</p>`}
      </div>
    </div>`;

  const url = urlAbsoluta(lang, "/fiestas-del-pueblo");
  return {
    titulo: t(lang, "fiestas.meta.titulo"),
    descripcion: t(lang, "fiestas.meta.descripcion"),
    ruta: "/fiestas-del-pueblo",
    activa: "inicio",
    cache: "estatico",
    cuerpo,
    css: ["fiestas"],
    js: ["paginas/fiestas"],
    jsonLd: [
      migas(lang, [{ nombre: titulo, url }]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t(lang, "fiestas.meta.titulo"),
        description: t(lang, "fiestas.meta.descripcion"),
        url,
        inLanguage: lang === "en" ? "en" : "es-MX",
        isPartOf: { "@type": "WebSite", name: "Colima Go", url: `${SITIO}/` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: D.fiestas.length,
          itemListElement: D.fiestas.map((f, i) => ({ "@type": "ListItem", position: i + 1, name: f.nombre, url: urlAbsoluta(lang, `/fiestas-del-pueblo/${f.id}`) })),
        },
      },
    ],
  };
}

// BreadcrumbList: Colima Go › Fiestas del Pueblo › (la fiesta).
function migas(lang, pasos) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ nombre: "Colima Go", url: `${SITIO}/` }, ...pasos].map((p, i, todos) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.nombre,
      ...(i < todos.length - 1 || p.url ? { item: p.url } : {}),
    })),
  };
}

// ---------- Ficha de una fiesta ----------
// Hasta cuatro más: dos del mismo mes y el resto del mismo municipio.
function relacionadas(f) {
  const orden = (a, b) => a.inicio.mes - b.inicio.mes || a.inicio.dia - b.inicio.dia;
  const mismoMes = D.fiestas.filter((x) => x.id !== f.id && x.inicio.mes === f.inicio.mes).sort(orden).slice(0, 2);
  const elegidas = new Set(mismoMes.map((x) => x.id));
  const mismoMunicipio = D.fiestas
    .filter((x) => x.id !== f.id && x.municipioId === f.municipioId && !elegidas.has(x.id))
    .sort(orden)
    .slice(0, 4 - mismoMes.length);
  return [...mismoMes, ...mismoMunicipio].sort(orden);
}

function ficha(req, ctx, f) {
  const { lang } = ctx;
  const mes = f.inicio.mes;
  const tono = tonoMes(mes);
  const fecha = D.etiquetaFecha(f, lang);
  const lugar = D.lugarDeFiesta(f);
  const municipio = D.municipioPorId(f.municipioId);
  const cifra = D.cifraDia(f);
  const mesCorto = D.textos(lang).mesesCortos[mes - 1];
  const url = urlAbsoluta(lang, `/fiestas-del-pueblo/${f.id}`);
  const parrafos = String(f.descripcion.es || "").split("\n").filter(Boolean);
  const otras = relacionadas(f);
  const listaUrl = ruta(lang, "/fiestas-del-pueblo");

  const cuerpo = h`
    <div class="envoltura ff-volver-caja">
      <a class="btn-texto ff-volver" href="${listaUrl}">${icono("flecha-izquierda")}<span>${t(lang, "fiestas.volver")}</span></a>
    </div>
    <div class="envoltura">
      ${letrero({ id: "t-fiesta", texto: f.nombre, tinta: tono, giro: mes % 2 ? -1 : 0.8, nivel: 1, compacto: true })}
    </div>
    <article class="envoltura ff tono-${tono}">
      <div class="ff-fecha">
        <div class="fiesta-fecha fiesta-fecha-grande">
          <span class="fiesta-pintura" aria-hidden="true"></span>
          <span class="fiesta-cifra rotulo cifra${cifra.length > 3 ? " cifra-larga" : ""}">${cifra}</span>
          <span class="fiesta-mes tablilla">${mesCorto}</span>
        </div>
        <div class="ff-datos">
          <p class="ff-rango"><span class="sr-only">${t(lang, "datos.sugerir.suggestDates")}: </span>${icono("calendario")}<span>${fecha}</span></p>
          <p class="ff-lugar tablilla">${icono("lugar")}<span>${lugar}</span></p>
          ${municipio && h`<a class="ff-municipio tablilla-muni" href="${ruta(lang, `/municipios/${municipio.slug}`)}">${t(lang, "fiestas.municipioDe", { nombre: municipio.nombre })} ${icono("flecha-derecha")}</a>`}
          ${f.aproximada && h`<p class="ff-aviso">${icono("info")}<span>${t(lang, "datos.fiestas.festivalDatesApprox")}</span></p>`}
        </div>
      </div>
      <div class="ff-texto">
        <div class="lectura"${langEs(lang)}>${parrafos.map((p) => h`<p>${p}</p>`)}</div>
        ${lang === "en" && t(lang, "fiestas.soloEspanol") && h`<p class="nota">${t(lang, "fiestas.soloEspanol")}</p>`}
        <div class="ff-acciones">
          ${boton({
            texto: t(lang, "comun.compartir"),
            icono: "compartir",
            variante: "foco",
            attrs: {
              "data-accion": "compartir",
              "data-url": url,
              "data-titulo": f.nombre,
              "data-texto": `${f.nombre}, ${lugar} · ${fecha}`,
              "data-campana": "fiesta",
            },
          })}
          <a class="btn-contorno" href="${f.fuente.url}" target="_blank" rel="noopener">
            ${icono("externo")}<span>${t(lang, "datos.fiestas.festivalSource", { fuente: f.fuente.nombre })}</span><span class="sr-only"> (${t(lang, "fiestas.fuenteAbre")})</span>
          </a>
          <a class="btn-texto" href="${ruta(lang, "/sugerir/correccion")}?fiesta=${encodeURIComponent(f.id)}"><span>${t(lang, "datos.sugerir.suggestFixButton")}</span></a>
        </div>
      </div>
    </article>
    ${contexto(lang, f, ctx)}
    ${otras.length > 0 && h`<section class="envoltura ff-mas" aria-labelledby="ff-mas-t">
      <h2 class="seccion-titulo" id="ff-mas-t">${t(lang, "fiestas.masFiestas")}</h2>
      <ul class="mes-lista">${otras.map((x) => fila(x, lang, { conDescripcion: false }))}</ul>
    </section>`}
    <div class="envoltura pagina-pie">
      ${anuncio({ lang, formato: "banner", indice: mes, clase: "anuncio-pie" })}
    </div>`;

  const resumen = recortar(parrafos[0], 100);
  return {
    titulo: t(lang, "fiestas.meta.detalleTitulo", { nombre: f.nombre, lugar }),
    descripcion: recortar(t(lang, "fiestas.meta.detalleDescripcion", { nombre: f.nombre, lugar, fecha, resumen }), 158),
    ruta: `/fiestas-del-pueblo/${f.id}`,
    activa: "inicio",
    cache: "estatico",
    // La descripción de las fiestas solo existe en español: bajo una página en inglés queda
    // fuera del índice y no se anuncia como alterna (lib/guia/indexacion.js).
    robots: fiestaIndexable(f, lang) ? undefined : "noindex, follow",
    alternos: fiestaIndexable(f, "en") ? undefined : false,
    cuerpo,
    css: ["fiestas"],
    js: [],
    jsonLd: [
      migas(lang, [{ nombre: t(lang, "datos.fiestas.townFestivals"), url: urlAbsoluta(lang, "/fiestas-del-pueblo") }, { nombre: f.nombre }]),
      // Sin Event: las fiestas se repiten cada año y no hay fecha con año que
      // no sería inventada; la ficha es solo una página con su descripción.
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: f.nombre,
        description: recortar(parrafos.join(" "), 300),
        url,
        inLanguage: lang === "en" ? "en" : "es-MX",
        isPartOf: { "@type": "WebSite", name: "Colima Go", url: `${SITIO}/` },
      },
    ],
  };
}

module.exports = {
  rutas: ["/fiestas-del-pueblo", "/fiestas-del-pueblo/:id"],
  async pagina(req, ctx) {
    if (!req.params.id) return lista(req, ctx);
    const f = D.fiestaPorId(req.params.id);
    if (!f) return { status: 404 };
    return ficha(req, ctx, f);
  },
};
