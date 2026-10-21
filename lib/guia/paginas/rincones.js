// Rincones Naturales: /rincones-naturales y /rincones-naturales/:categoria
// (y /en/…). Nueve categorías (ríos, playas, lagunas, montañas, arqueología,
// parques, patrimonio, balnearios, rutas) como pestañas que son enlaces reales;
// cada una lista sus lugares del catálogo local, con un anuncio cada tres.
// /rincones-naturales a secas redirige a la primera categoría.

const { h } = require("../h");
const { t, tn, urlAbsoluta, SITIO } = require("../i18n");
const datos = require("../datos");
const { letrero, boton, chip, tarjetaLugar, listaConAnuncios, estadoVista } = require("../componentes");
const { listaConY, municipioDe } = require("./lugares-vista");

const colador = new Intl.Collator("es");

function jsonLd(lang, categoria, nombre, titulo, lugares) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: titulo,
      numberOfItems: lugares.length,
      itemListElement: lugares.map((l, i) => ({ "@type": "ListItem", position: i + 1, url: urlAbsoluta(lang, `/lugar/${l.slug}`), name: l.titulo })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t(lang, "rincones.inicio"), item: urlAbsoluta(lang, "/inicio") },
        { "@type": "ListItem", position: 2, name: t(lang, "rincones.titulo"), item: urlAbsoluta(lang, "/rincones-naturales") },
        { "@type": "ListItem", position: 3, name: nombre, item: urlAbsoluta(lang, `/rincones-naturales/${categoria.slug}`) },
      ],
    },
  ];
}

module.exports = {
  rutas: ["/rincones-naturales", "/rincones-naturales/:categoria"],
  async pagina(req, ctx) {
    const { lang, ruta } = ctx;
    const pedida = req.params.categoria;
    if (!pedida) return { redirigir: ruta("/rincones-naturales/rios"), status: 302 };
    const categoria = datos.categoriaPorSlug(pedida) || datos.categoriaPorSlug(String(pedida).toLowerCase());
    if (!categoria) return { status: 404 };
    if (categoria.slug !== pedida) return { redirigir: ruta(`/rincones-naturales/${categoria.slug}`), status: 301 };

    const lugares = [...datos.lugaresPorTipo(categoria.tipo)].sort((a, b) => colador.compare(a.titulo, b.titulo));
    const nombre = datos.nombreCategoria(categoria.slug, lang);

    // Municipios con lugares en la categoría, en orden de id, para el texto de SEO.
    const municipios = [...new Set(lugares.map((l) => l.municipioId))].sort((a, b) => a - b).map((id) => municipioDe({ municipioId: id }));
    const vars = { n: lugares.length, munis: listaConY(lang, municipios), destacados: t(lang, `rincones.cat.${categoria.slug}.destacados`) };
    const titulo = t(lang, `rincones.cat.${categoria.slug}.titulo`, vars);
    const meta = t(lang, `rincones.cat.${categoria.slug}.meta`, vars);
    const intro = t(lang, `rincones.cat.${categoria.slug}.intro`, vars);

    const pestanas = datos.categoriasRincones.map(
      (c) => h`<li>${chip({ texto: datos.nombreCategoria(c.slug, lang), href: ruta(`/rincones-naturales/${c.slug}`), activo: c.slug === categoria.slug, miniatura: `${c.miniatura}.webp` })}</li>`,
    );

    const sizes = "(max-width: 600px) calc(100vw - 32px), (max-width: 1000px) 50vw, 380px";
    const tarjetas = lugares.length
      ? listaConAnuncios(lugares, (l) => tarjetaLugar(l, { lang, prioridad: l === lugares[0], sizes }), lang)
      : null;

    const cuerpo = h`
<div class="envoltura rincones">
  ${letrero({
    id: "t-rincones",
    texto: t(lang, "rincones.titulo"),
    tinta: "lona",
    giro: 0.9,
    focos: 26,
    comba: 0.7,
    entrada: t(lang, "rincones.entrada"),
    extra: boton({ texto: t(lang, "rincones.sugerir"), href: ruta(`/sugerir/lugar?tipo=${categoria.slug}`), variante: "contorno", chico: true, icono: "mas", attrs: { "aria-label": t(lang, "rincones.sugerirAria") } }),
  })}
  <nav class="rincones-pestanas" aria-label="${t(lang, "rincones.categorias")}">
    <ul class="chips chips-deslizables">${pestanas}</ul>
  </nav>
  <section class="rincones-categoria" aria-labelledby="t-categoria">
    <div class="rincones-cabeza">
      <h2 class="tablero-titulo" id="t-categoria">${nombre}</h2>
      <p class="rincones-contador">${tn(lang, "rincones.contador", lugares.length)}</p>
    </div>
    <p class="rincones-intro">${intro}</p>
    ${
      tarjetas
        ? h`<div class="rejilla-lugares">${tarjetas}</div>`
        : estadoVista({ icono: "hoja", titulo: t(lang, "rincones.vacioTitulo") })
    }
  </section>
</div>`;

    const esPlayas = categoria.slug === "playas";
    return {
      titulo,
      descripcion: meta,
      activa: "inicio",
      cuerpo,
      css: ["rincones"],
      js: ["paginas/rincones"],
      jsonLd: jsonLd(lang, categoria, nombre, titulo, lugares),
      // Las playas tienen su propia pantalla (/playas): ésa es la canónica.
      ...(esPlayas ? { canonical: urlAbsoluta(lang, "/playas"), alternos: false } : {}),
      og: { imagen: `${SITIO}/img/c/portada-${esPlayas ? "playas" : "rincones"}-800.webp`, alt: `${t(lang, "rincones.titulo")}: ${nombre}`, tipo: "website" },
      cache: "estatico",
    };
  },
};
