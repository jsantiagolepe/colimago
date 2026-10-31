// Gastronomía típica de Colima: /gastronomia (platillos y bebidas, con filtro por tipo) y
// /gastronomia/:id (el platillo y dónde probarlo). Datos de data/gastronomia.json y textos de
// data/i18n/*/gastro.json, ambos importados de la app.

const { h } = require("../h");
const { t, ruta, urlAbsoluta, SITIO } = require("../i18n");
const datos = require("../datos");
const { icono, sinFoto, tarjetaLugar, estadoVista, anuncio } = require("../componentes");
const platillos = require("../../../data/gastronomia.json");

const TIPOS = ["platillo", "antojito", "bebida", "postre"];
const nombre = (lang, id) => t(lang, `gastro.dishes.${id}.name`);
const descripcion = (lang, id) => t(lang, `gastro.dishes.${id}.desc`);

function foto(p, tam = 480, alt = "") {
  if (!p.foto) return h`<span class="marco marco-4-3">${sinFoto()}</span>`;
  return h`<span class="marco marco-4-3"><img src="${p.foto}-${tam}.webp" srcset="${p.foto}-480.webp 480w, ${p.foto}-800.webp 800w" sizes="(max-width: 700px) 100vw, 33vw" alt="${alt}" width="${tam}" height="${Math.round(tam * 0.75)}" loading="lazy" decoding="async" /></span>`;
}

function tarjeta(lang, p) {
  return h`<article class="tarjeta-lugar plato" data-tipo="${p.tipo}">
    ${foto(p, 480, nombre(lang, p.id))}
    <h3 class="tl-titulo"><a href="${ruta(lang, `/gastronomia/${p.id}`)}">${nombre(lang, p.id)}</a></h3>
    <p class="tl-muni tablilla-muni">${t(lang, `gastro.dishType.${p.tipo}`)}</p>
    <p class="tl-desc">${descripcion(lang, p.id)}</p>
  </article>`;
}

function lista(lang, req) {
  const tipo = TIPOS.includes(req.query.tipo) ? req.query.tipo : null;
  const mostrados = platillos.filter((p) => !tipo || p.tipo === tipo);
  const destacado = !tipo ? platillos.find((p) => p.destacado) : null;
  const resto = destacado ? mostrados.filter((p) => p !== destacado) : mostrados;
  const base = ruta(lang, "/gastronomia");
  const chips = [h`<a class="chip" href="${base}"${tipo ? "" : h` aria-current="true"`}>${t(lang, "guiaapp.todo")}</a>`].concat(
    TIPOS.map((x) => h`<a class="chip" href="${base}?tipo=${x}"${tipo === x ? h` aria-current="true"` : ""}>${t(lang, `gastro.dishFilter.${x}`)}</a>`),
  );
  const cuerpo = h`
<div class="envoltura gastronomia">
  <header class="pagina-cab">
    <h1 class="rotulo">${t(lang, "gastro.gastronomy")}</h1>
    <p class="pagina-entrada">${t(lang, "gastro.gastronomyPitch")}</p>
  </header>
  <nav class="chips chips-deslizables" aria-label="${t(lang, "gastro.gastronomy")}">${chips}</nav>
  ${destacado && h`<section class="bloque" style="margin-top:24px"><h2>${t(lang, "gastro.gastronomyFeatured")}</h2>
    <a class="plato-destacado" href="${ruta(lang, `/gastronomia/${destacado.id}`)}">${foto(destacado, 800, nombre(lang, destacado.id))}<span><strong>${nombre(lang, destacado.id)}</strong><span>${descripcion(lang, destacado.id)}</span></span></a></section>`}
  <section class="bloque" style="margin-top:24px">
    ${resto.length ? h`<div class="rejilla-lugares">${resto.map((p) => tarjeta(lang, p))}</div>` : estadoVista({ icono: "cubiertos", titulo: t(lang, "gastro.gastronomyEmpty") })}
  </section>
</div>`;
  return {
    titulo: t(lang, "gastro.gastronomy"),
    descripcion: t(lang, "guiaapp.gastronomia.meta"),
    activa: "inicio",
    cuerpo,
    css: ["app", "gastronomia"],
    jsonLd: [{ "@context": "https://schema.org", "@type": "ItemList", name: t(lang, "gastro.gastronomy"), itemListElement: platillos.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: urlAbsoluta(lang, `/gastronomia/${p.id}`), name: nombre(lang, p.id) })) }],
    og: { imagen: `${SITIO}/img/gastronomia/sopitos01-800.webp`, alt: t(lang, "gastro.gastronomy") },
    cache: "estatico",
    ruta: "/gastronomia",
    consulta: tipo ? `?tipo=${tipo}` : "",
  };
}

function detalle(lang, id) {
  const p = platillos.find((x) => x.id === id);
  if (!p) return { status: 404 };
  const lugares = p.lugares.map((s) => datos.lugarPorSlug(s)).filter(Boolean);
  const cuerpo = h`
<div class="envoltura-lectura gastronomia">
  <nav class="migas"><a href="${ruta(lang, "/gastronomia")}">${icono("chevron-izquierda")}${t(lang, "gastro.gastronomy")}</a></nav>
  <header class="pagina-cab"><h1 class="rotulo">${nombre(lang, p.id)}</h1><p class="pagina-entrada"><span class="etiqueta-suave">${t(lang, `gastro.dishType.${p.tipo}`)}</span></p></header>
  ${foto(p, 800, nombre(lang, p.id))}
  <p class="lectura" style="margin-top:20px">${descripcion(lang, p.id)}</p>
  <section class="bloque" style="margin-top:32px"><h2>${t(lang, "gastro.gastronomyWhere")}</h2>
    ${lugares.length ? h`<div class="rejilla-lugares">${lugares.map((l) => tarjetaLugar(lugares.length && l, { lang }))}</div>` : h`<p class="nota">${t(lang, "gastro.gastronomyWhereEmpty")}</p>`}
  </section>
</div>`;
  return {
    titulo: nombre(lang, p.id),
    descripcion: descripcion(lang, p.id).slice(0, 155),
    activa: "inicio",
    cuerpo,
    css: ["app", "gastronomia"],
    og: { imagen: p.foto ? `${SITIO}${p.foto}-800.webp` : undefined, alt: nombre(lang, p.id) },
    cache: "estatico",
    ruta: `/gastronomia/${id}`,
  };
}

module.exports = {
  rutas: ["/gastronomia", "/gastronomia/:id"],
  async pagina(req, ctx) {
    return req.params.id ? detalle(ctx.lang, req.params.id) : lista(ctx.lang, req);
  },
};
