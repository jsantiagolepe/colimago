// Guías: /guias (índice) y /guias/:slug (artículo). Los artículos viven en data/guias/*.md
// (ver lib/guia/guias.js) y enlazan a las fichas de lugares. Cada artículo lleva autor, fecha
// de publicación y de actualización, foto con crédito, las fichas relacionadas y datos
// estructurados Article y BreadcrumbList.
//
// Los textos están en español: en /en/guias* el marco de la página sale en inglés, el texto
// se marca lang="es" y la página lleva noindex (igual que las fichas sin traducción).

const { h, raw, esc } = require("../h");
const { t, ruta, urlAbsoluta, fechaLarga, SITIO } = require("../i18n");
const guias = require("../guias");
const { mostrarBorradores } = require("../contenido");

const { icono, sinFoto } = require("../componentes");
const { municipioDe, textoCredito } = require("./lugares-vista");

const T = (lang, clave, vars) => t(lang, `guias.${clave}`, vars);
const marcaEs = (lang) => (lang === "en" ? raw(' lang="es"') : "");

// "31 de octubre de 2026" / "October 31, 2026"
function fechaCompleta(lang, fecha) {
  if (!fecha) return "";
  const [a] = fecha.split("-");
  return lang === "en" ? `${fechaLarga("en", fecha)}, ${a}` : `${fechaLarga("es", fecha)} de ${a}`;
}

function foto(g, tam = 800) {
  const f = guias.fotoDe(g);
  if (!f) return null;
  return { ...f, src: `/img/${f.archivo}-${tam}.webp`, srcset: `/img/${f.archivo}-480.webp 480w, /img/${f.archivo}-800.webp 800w` };
}

function tarjeta(lang, g) {
  const f = foto(g, 480);
  const publica = guias.guiaIndexable(g);
  return h`<article class="tarjeta-lugar guia-tarjeta">
    <span class="marco marco-4-3">${f ? h`<img src="${f.src}" srcset="${f.srcset}" sizes="(max-width: 700px) 100vw, 33vw" alt="${f.alt}" width="480" height="360" loading="lazy" decoding="async" />` : sinFoto()}</span>
    <h2 class="tl-titulo"${marcaEs(lang)}><a href="${ruta(lang, `/guias/${g.slug}`)}">${g.titulo}</a></h2>
    <p class="tl-muni tablilla-muni"><time datetime="${g.actualizado}">${T(lang, "actualizado", { fecha: fechaCompleta(lang, g.actualizado) })}</time>${!publica && h` · <span class="borrador">${T(lang, "borrador")}</span>`}</p>
    <p class="tl-desc"${marcaEs(lang)}>${g.descripcion}</p>
  </article>`;
}

function indice(lang) {
  const todas = guias.todas();
  const publicas = guias.indexables();
  // En producción solo se listan las que ya se pueden publicar; en desarrollo, todas.
  const mostradas = mostrarBorradores() ? todas : publicas;
  const cuerpo = h`
<div class="envoltura guias">
  <header class="pagina-cab">
    <h1 class="rotulo">${T(lang, "titulo")}</h1>
    <p class="pagina-entrada">${T(lang, "entrada")}</p>
  </header>
  <section class="bloque" style="margin-top:24px" aria-label="${T(lang, "titulo")}">
    ${
      mostradas.length > 0
        ? h`<div class="rejilla-lugares">${mostradas.map((g) => tarjeta(lang, g))}</div>`
        : h`<p class="lectura">${T(lang, "pronto")}</p>`
    }
  </section>
</div>`;
  return {
    titulo: T(lang, "titulo"),
    descripcion: T(lang, "descripcion"),
    activa: "inicio",
    cuerpo,
    css: ["app", "gastronomia", "guias"],
    robots: lang === "es" && publicas.length > 0 ? undefined : "noindex, follow",
    alternos: false,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: T(lang, "titulo"),
        url: urlAbsoluta(lang, "/guias"),
        inLanguage: lang === "en" ? "en" : "es-MX",
        mainEntity: { "@type": "ItemList", itemListElement: publicas.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: urlAbsoluta(lang, `/guias/${g.slug}`), name: g.titulo })) },
      },
    ],
    cache: "estatico",
    ruta: "/guias",
  };
}

function bloque(lang, b) {
  const marca = (pendiente, html) => (pendiente ? raw(html.replace(/^<(\w+)/, `<$1 class="borrador" title="${esc(T(lang, "borradorAviso"))}"`)) : raw(html));
  if (b.tipo === "h2") return marca(b.pendiente, `<h2 class="seccion-titulo">${guias.enLinea(lang, b.texto)}</h2>`);
  if (b.tipo === "h3") return marca(b.pendiente, `<h3>${guias.enLinea(lang, b.texto)}</h3>`);
  if (b.items) return raw(`<${b.tipo}>${b.items.map((i) => (i.pendiente ? `<li class="borrador" title="${esc(T(lang, "borradorAviso"))}">` : "<li>") + guias.enLinea(lang, i.texto) + "</li>").join("")}</${b.tipo}>`);
  return marca(b.pendiente, `<p>${guias.enLinea(lang, b.texto)}</p>`);
}

function articulo(lang, slug) {
  const g = guias.porSlug(slug);
  if (!g) return { status: 404 };
  const publica = guias.guiaIndexable(g);
  const bloques = guias.paraPintar(g);
  const f = foto(g);
  const fichas = guias.fichasDe(g);
  const otras = guias.todas().filter((x) => x.slug !== g.slug && (guias.guiaIndexable(x) || mostrarBorradores())).slice(0, 3);
  const url = urlAbsoluta(lang, `/guias/${g.slug}`);
  const credito = f && textoCredito(lang, f.credito, "lugar");
  const idioma = marcaEs(lang);

  const cuerpo = h`
<div class="envoltura-lectura guia-articulo">
  <nav class="lugar-migas" aria-label="${t(lang, "lugar.migas")}"><ol>
    <li><a href="${ruta(lang, "/inicio")}">${t(lang, "lugar.inicio")}</a></li>
    <li><a href="${ruta(lang, "/guias")}">${T(lang, "titulo")}</a></li>
    <li><span aria-current="page"${idioma}>${g.titulo}</span></li>
  </ol></nav>
  <article>
    <header class="pagina-cab">
      <h1 class="rotulo"${idioma}>${g.titulo}</h1>
      <p class="guia-firma nota">${T(lang, "por")} <span${idioma}>${g.autor}</span> · ${T(lang, "publicado", { fecha: "" })}<time datetime="${g.fecha}">${fechaCompleta(lang, g.fecha)}</time> · <time datetime="${g.actualizado}">${T(lang, "actualizado", { fecha: fechaCompleta(lang, g.actualizado) })}</time></p>
    </header>
    ${
      f &&
      h`<figure class="guia-portada"><span class="marco marco-4-3"><img src="${f.src}" srcset="${f.srcset}" sizes="(max-width: 899px) calc(100vw - 32px), 720px" alt="${f.alt}" width="800" height="600" fetchpriority="high" decoding="async" /></span>${credito && h`<figcaption class="nota">${credito}</figcaption>`}</figure>`
    }
    <div class="lectura guia-cuerpo"${idioma}>
      ${bloques.map((b) => bloque(lang, b))}
    </div>
    ${
      fichas.length > 0 &&
      h`<section class="bloque guia-fichas" aria-labelledby="t-guia-fichas"><h2 class="seccion-titulo" id="t-guia-fichas">${T(lang, "lugares")}</h2>
        <ul class="cerca-lista">${fichas.map((l) => h`<li><a href="${ruta(lang, `/lugar/${l.slug}`)}">${l.titulo}</a> <span class="nota">${municipioDe(l)}</span></li>`)}</ul></section>`
    }
    ${
      otras.length > 0 &&
      h`<section class="bloque guia-mas" aria-labelledby="t-guia-mas"><h2 class="seccion-titulo" id="t-guia-mas">${T(lang, "masGuias")}</h2>
        <ul class="cerca-lista">${otras.map((x) => h`<li><a href="${ruta(lang, `/guias/${x.slug}`)}"${idioma}>${x.titulo}</a></li>`)}</ul></section>`
    }
  </article>
</div>`;

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.titulo,
    description: g.descripcion,
    inLanguage: "es-MX",
    datePublished: g.fecha,
    dateModified: g.actualizado,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: g.autor, url: `${SITIO}/acerca-de` },
    publisher: { "@type": "Organization", name: "Colima Go", url: `${SITIO}/`, logo: { "@type": "ImageObject", url: `${SITIO}/img/perro-de-colima.webp` } },
    ...(f ? { image: [`${SITIO}${f.src}`] } : {}),
  };
  const migas = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t(lang, "lugar.inicio"), item: urlAbsoluta(lang, "/inicio") },
      { "@type": "ListItem", position: 2, name: T(lang, "titulo"), item: urlAbsoluta(lang, "/guias") },
      { "@type": "ListItem", position: 3, name: g.titulo, item: url },
    ],
  };
  return {
    titulo: g.titulo,
    descripcion: g.descripcion,
    activa: "inicio",
    cuerpo,
    css: ["app", "lugar", "guias"],
    robots: lang === "es" && publica ? undefined : "noindex, follow",
    alternos: false,
    jsonLd: [article, migas],
    og: { imagen: f ? `${SITIO}${f.src}` : undefined, alt: f ? f.alt : undefined, tipo: "article" },
    cache: "estatico",
    ruta: `/guias/${g.slug}`,
  };
}

module.exports = {
  rutas: ["/guias", "/guias/:slug"],
  async pagina(req, ctx) {
    return req.params.slug ? articulo(ctx.lang, req.params.slug) : indice(ctx.lang);
  },
};
