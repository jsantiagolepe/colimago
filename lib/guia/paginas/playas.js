// Playas: /playas (y /en/playas).
//
// Su propia composición, hermana de la sección Playas de la portada: una foto
// grande y pegajosa que cambia (fundido) y un tablero de playas con filas
// separadas por filetes. Cada fila es un enlace real a su ficha; sin JavaScript
// se ve la primera foto y todas las filas siguen siendo enlaces. El tablero se
// parte en bloques de tres filas con un anuncio entre cada bloque.

const { h, raw } = require("../h");
const { t, tn, urlAbsoluta, SITIO } = require("../i18n");
const datos = require("../datos");
const { letrero, anuncio, intercalarAnuncios, estadoVista, sinFoto } = require("../componentes");
const { municipioDe, rutaLugar, textoCredito } = require("./lugares-vista");

const colador = new Intl.Collator("es");
// Las cinco que enseña la portada van primero (en su orden); luego las demás con
// foto, por título, y al final las que solo tienen ilustración.
const DE_LA_PORTADA = ["el-paraiso", "boca-de-pascuales", "tecuanillo", "la-boquita", "el-real"];

function ordenar(playas) {
  const rango = (l) => {
    const i = DE_LA_PORTADA.indexOf(l.slug);
    if (i >= 0) return i;
    return l.imagen && l.imagen.tipo === "foto" ? 10 : 20;
  };
  return [...playas].sort((a, b) => rango(a) - rango(b) || colador.compare(a.titulo, b.titulo));
}

// Pie de la foto grande para cada playa (la primera visible; el script alterna).
function leyenda(lang, lugar, visible) {
  const credito = textoCredito(lang, lugar.imagen && lugar.imagen.credito, "playas");
  return h`<span class="playas-pie-item" data-pie="${lugar.slug}"${visible ? "" : raw(" hidden")}>${t(lang, "playas.fotoDe", { lugar: lugar.titulo, municipio: municipioDe(lugar) })}${credito && h` <span class="playas-credito">${credito}</span>`}</span>`;
}

function imagenGrande(lang, lugar, indice) {
  const img = lugar.imagen;
  const base = img && img.archivo ? `/img/${img.archivo}` : null;
  if (!base) return null;
  const alt = `${lugar.titulo}, ${municipioDe(lugar)}`;
  const sizes = "(max-width: 860px) 100vw, 56vw";
  const alto = Math.round((800 * (img.alto || 3)) / (img.ancho || 4));
  // La primera lleva su fuente real; en móvil la foto grande no se muestra, así que
  // un <source> con media se queda con un GIF vacío y no la descarga. Las demás se
  // piden (data-src) cuando alguien las enciende.
  if (indice === 0) {
    return h`<picture><source media="(max-width: 860px)" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACw=" /><img class="activa" data-playa="${lugar.slug}" data-alt="${alt}" src="${base}-800.webp" srcset="${base}-480.webp 480w, ${base}-800.webp 800w" sizes="${sizes}" alt="${alt}" width="800" height="${alto}" fetchpriority="high" decoding="async" /></picture>`;
  }
  return h`<img data-playa="${lugar.slug}" data-alt="${alt}" alt="" data-src="${base}-800.webp" data-srcset="${base}-480.webp 480w, ${base}-800.webp 800w" sizes="${sizes}" alt="${alt}" width="800" height="${alto}" decoding="async" />`;
}

function fila(lang, lugar, activa) {
  const img = lugar.imagen;
  const mini =
    img && img.archivo
      ? h`<img src="/img/${img.archivo}-480.webp" alt="" width="480" height="${Math.round((480 * (img.alto || 3)) / (img.ancho || 4))}" loading="lazy" decoding="async" />`
      : sinFoto();
  return h`<li class="playa-fila${activa ? " activa" : ""}" data-playa="${lugar.slug}">
    <a href="${rutaLugar(lang, lugar)}">
      <span class="marco playa-miniatura">${mini}</span>
      <span class="playa-nombre">${lugar.titulo}</span>
      <span class="playa-muni">${municipioDe(lugar)}</span>
      <span class="playa-dato">${datos.textoDescripcion(lugar, lang)}</span>
    </a>
  </li>`;
}

module.exports = {
  rutas: ["/playas"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const playas = ordenar(datos.lugaresPorTipo(11));
    const n = playas.length;
    const titulo = t(lang, "playas.tituloPagina", { n });

    // Bloques de tres filas con un anuncio (banner) detrás de cada uno.
    const elementos = intercalarAnuncios(playas, { cada: 3, formatos: ["banner"] });
    const bloques = [];
    let actual = [];
    let numeroFila = 0;
    for (const el of elementos) {
      if (el.anuncio) {
        if (actual.length) bloques.push(h`<ul class="playas-bloque">${actual}</ul>`);
        actual = [];
        bloques.push(anuncio({ lang, formato: el.formato, indice: el.indice }));
      } else {
        actual.push(fila(lang, el, numeroFila === 0));
        numeroFila++;
      }
    }
    if (actual.length) bloques.push(h`<ul class="playas-bloque">${actual}</ul>`);

    const cuerpo = h`
<div class="envoltura playas">
  ${letrero({
    id: "t-playas",
    texto: t(lang, "playas.titulo"),
    tinta: "bandera",
    giro: -1,
    focos: 30,
    comba: 0.45,
    entrada: t(lang, "playas.entrada"),
    extra: n > 0 ? h`<p class="playas-contador">${tn(lang, "playas.contador", n)}</p>` : null,
  })}
  ${
    n === 0
      ? estadoVista({ icono: "hoja", titulo: t(lang, "playas.vacioTitulo") })
      : h`<div class="playas-rejilla">
    <figure class="playas-foto" data-revela>
      <div class="marco">${playas.map((p, i) => imagenGrande(lang, p, i))}</div>
      <figcaption class="playas-pie" id="pie-playa">${playas.map((p, i) => leyenda(lang, p, i === 0))}</figcaption>
    </figure>
    <div class="playas-tablero" role="group" aria-label="${t(lang, "playas.tablero")}">${bloques}</div>
  </div>`
  }
</div>`;

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: titulo,
        numberOfItems: n,
        itemListElement: playas.map((l, i) => ({ "@type": "ListItem", position: i + 1, url: urlAbsoluta(lang, `/lugar/${l.slug}`), name: l.titulo })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t(lang, "playas.inicio"), item: urlAbsoluta(lang, "/inicio") },
          { "@type": "ListItem", position: 2, name: t(lang, "playas.titulo"), item: urlAbsoluta(lang, "/playas") },
        ],
      },
    ];

    return {
      titulo,
      descripcion: t(lang, "playas.meta"),
      activa: "inicio",
      cuerpo,
      css: ["playas"],
      js: ["paginas/playas"],
      jsonLd,
      og: { imagen: `${SITIO}/img/c/portada-playas-800.webp`, alt: t(lang, "playas.titulo"), tipo: "website" },
      cache: "estatico",
    };
  },
};
