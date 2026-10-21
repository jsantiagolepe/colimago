// Municipios: la lista (/municipios) y la ficha de cada uno (/municipios/:slug).
//
// Lista: los diez municipios a lo largo de un cable vertical (zigzag): cada
// medallón cuelga del cable y su texto cae a un lado, alternando. Un banner
// cada cuatro (solo banners, como la app).
//
// Ficha: franja de feria (medallón, letrero colgante y la "postal" con la
// foto del municipio) y, debajo, descripción larga y las secciones que tenga:
// eventos vigentes (backend, si responde), atracciones, tianguis y mercados,
// hoteles y restaurantes. Anuncios: uno por cada 3 elementos de cada sección,
// formatos turnados en toda la página; si ninguna sección llega a 3, un banner
// tras las listas (la regla de §5.3 del informe de pantallas).
//
// Datos locales: lib/guia/datos.js. Eventos: lib/guia/eventos.js (solo para la
// ficha; si el backend falla la sección Eventos no aparece).

const { h, raw } = require("../h");
const datos = require("../datos");
const feed = require("../eventos");
const I = require("../i18n");
const { icono, letrero, guirnalda, anuncio, intercalarAnuncios, imagenLugar, sinFoto, chip } = require("../componentes");

const RUTAS = ["/municipios", "/municipios/:slug"];

// ---------- Utilidades ----------

// Recorta un texto a `max` caracteres sin partir palabras (para <meta description>).
function recortar(texto, max = 155) {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max - 1);
  return `${corte.slice(0, corte.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "")}…`;
}

function migasJsonLd(lang, pasos) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: pasos.map(([nombre, destino], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: nombre,
      item: I.urlAbsoluta(lang, destino),
    })),
  };
}

// Medallón con la estampa (acuarela) del municipio; decorativo: el nombre va al lado.
function medallonEstampa(m) {
  return h`<span class="medallon"><img src="${m.estampa}" alt="" width="200" height="200" loading="lazy" decoding="async" /></span>`;
}

// ================= LISTA =================

function filaMunicipio(m, i, { lang, ctx, primero, ultimo }) {
  const href = ctx.ruta(`/municipios/${m.slug}`);
  const atracciones = datos.lugaresDeMunicipio(m.id).atracciones.length;
  const lado = i % 2 === 0 ? "der" : "izq";
  const cta = atracciones > 0 ? I.tn(lang, "municipios.lugares", atracciones) : ctx.t("municipios.verMunicipio");
  return h`
    <li class="muni-item${primero ? " es-primero" : ""}${ultimo ? " es-ultimo" : ""}" data-lado="${lado}" data-revela>
      <a class="muni-sello" href="${href}" tabindex="-1" aria-hidden="true">${medallonEstampa(m)}</a>
      <div class="muni-texto">
        <h2 class="muni-nombre"><a href="${href}">${m.nombre}</a></h2>
        <p class="muni-apodo">${I.descripcion(lang, m.apodo)}</p>
        <p class="muni-desc">${I.descripcion(lang, m.descCorta)}</p>
        <p class="muni-cta"><span>${cta}</span>${icono("flecha-derecha")}</p>
      </div>
    </li>`;
}

function paginaLista(ctx) {
  const { lang } = ctx;
  const mezcla = intercalarAnuncios(datos.municipios, { cada: 4, formatos: ["banner"], cierre: false });
  const filas = mezcla.map((item, k) => {
    if (item.anuncio) return h`<li class="muni-anuncio">${anuncio({ lang, formato: "banner", indice: item.indice })}</li>`;
    const i = datos.municipios.indexOf(item);
    const antes = mezcla[k - 1];
    const despues = mezcla[k + 1];
    return filaMunicipio(item, i, { lang, ctx, primero: !antes || antes.anuncio, ultimo: !despues || despues.anuncio });
  });

  const cuerpo = h`
    <div class="muni-pagina">
      <div class="envoltura">
        ${letrero({ id: "t-municipios", texto: ctx.t("municipios.letrero"), tinta: "bandera", giro: -0.7, entrada: ctx.t("municipios.entrada"), focos: 34, comba: 0.55 })}
        <ol class="muni-hilo" aria-label="${ctx.t("municipios.listaEtiqueta")}">${filas}</ol>
      </div>
    </div>`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: ctx.t("municipios.listaTitulo"),
    numberOfItems: datos.municipios.length,
    itemListElement: datos.municipios.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nombre,
      url: I.urlAbsoluta(lang, `/municipios/${m.slug}`),
    })),
  };

  return {
    titulo: ctx.t("municipios.listaTitulo"),
    descripcion: ctx.t("municipios.listaDescripcion"),
    activa: "inicio",
    ruta: "/municipios",
    cuerpo,
    css: ["municipios"],
    js: ["paginas/municipios"],
    jsonLd: [itemList, migasJsonLd(lang, [[ctx.t("municipios.inicio"), "/inicio"], [ctx.t("municipios.letrero"), "/municipios"]])],
    cache: "estatico",
  };
}

// ================= FICHA =================

// ¿Qué dice la fecha de un evento? Un día: "sábado 24 de octubre · 9:00 PM"; varios: "24 oct – 26 oct".
function textoFecha(ev, lang) {
  if (ev.finFecha && ev.finFecha !== ev.fecha) return `${I.fechaCorta(lang, ev.fecha)} – ${I.fechaCorta(lang, ev.finFecha)}`;
  const dia = I.fechaConDia(lang, ev.fecha);
  return ev.hora && !ev.todoElDia ? `${dia} · ${I.hora12(ev.hora)}` : dia;
}

// Eventos vigentes del municipio. Si el backend falla (o no hay), [] y la sección no sale.
async function eventosDelMunicipio(id) {
  try {
    const { eventos } = await feed.obtenerEventos();
    if (!Array.isArray(eventos) || eventos.length === 0) return [];
    return feed.eventosDeMunicipio(eventos, id, feed.hoyEnColima());
  } catch {
    return [];
  }
}

// Una fila de la ficha: miniatura (4:3) + texto, enlazada de punta a punta.
function filaConFoto({ href, foto, categoria, titulo, linea }) {
  return h`
    <article class="mh-fila">
      <div class="marco marco-4-3 mh-foto">${foto}</div>
      <div class="mh-texto">
        ${categoria && h`<p class="tablilla-muni">${categoria}</p>`}
        <h3 class="mh-titulo"><a href="${href}">${titulo}</a></h3>
        ${linea}
      </div>
      ${icono("chevron-derecha", "mh-chevron")}
    </article>`;
}

function filaAtraccion(lugar, { lang, ctx }) {
  const categoria = datos.categoriaPorTipo(lugar.tipo);
  const texto = datos.textoDescripcion(lugar, lang);
  return filaConFoto({
    href: ctx.ruta(`/lugar/${lugar.slug}`),
    foto: imagenLugar(lugar, { sizes: "96px", alt: "" }),
    categoria: categoria ? datos.nombreCategoria(categoria.slug, lang) : "",
    titulo: lugar.titulo,
    linea: texto ? h`<p class="mh-desc">${texto}</p>` : "",
  });
}

function filaTianguis(lugar, { lang, ctx }) {
  // Los de temporada (tianguis navideños) llevan sus fechas: "Todos los días" solo sería engañoso.
  const temporada = datos.etiquetaTemporada(lugar, lang);
  const base = datos.cuandoSePone(lugar, lang);
  const cuando = temporada ? `${ctx.t("municipios.temporada")} ${temporada}${base ? ` · ${base}` : ""}` : base;
  return filaConFoto({
    href: ctx.ruta(`/lugar/${lugar.slug}`),
    foto: imagenLugar(lugar, { sizes: "96px", alt: "" }),
    titulo: lugar.titulo,
    linea: cuando ? h`<p class="mh-cuando">${cuando}</p>` : "",
  });
}

function filaEvento(ev, { lang, ctx }) {
  const chica = feed.urlImagen(ev.imagen, 200);
  const grande = feed.urlImagen(ev.imagen, 400);
  const foto = ev.imagen
    ? h`<img src="${chica}" srcset="${chica} 1x, ${grande} 2x" alt="" width="96" height="72" loading="lazy" decoding="async" />`
    : sinFoto();
  return filaConFoto({
    href: ctx.ruta(`/evento/${ev.id}`),
    foto,
    titulo: ev.titulo,
    linea: ev.esPortada ? "" : h`<p class="mh-cuando"><time datetime="${ev.fecha}">${textoFecha(ev, lang)}</time></p>`,
  });
}

// Hoteles y restaurantes: datos de ejemplo del catálogo; solo título y descripción.
function filaTexto(lugar, { lang, ctx }) {
  const texto = datos.textoDescripcion(lugar, lang) || ctx.t("municipios.sinDescripcion");
  return h`
    <article class="mh-fila mh-fila-texto">
      <div class="mh-texto">
        <h3 class="mh-titulo">${lugar.titulo}</h3>
        <p class="mh-desc">${texto}</p>
      </div>
    </article>`;
}

function seccion({ id, ic, titulo, cuenta, cuerpo }) {
  return h`
    <section class="mh-seccion" id="${id}" aria-labelledby="${id}-t">
      <h2 class="seccion-titulo" id="${id}-t">${icono(ic)}<span>${titulo}</span>${cuenta ? h`<span class="mh-cuenta pastilla pastilla-tenue">${cuenta}</span>` : ""}</h2>
      ${cuerpo}
    </section>`;
}

// Pinta una lista con anuncios (1 por cada 3, sin cierre) y lleva la cuenta de
// cuántos van, para turnar los formatos en toda la página.
function listaConAnuncios(items, pintar, lang, estado) {
  const mezcla = intercalarAnuncios(items, { cada: 3, cierre: false, primerAnuncio: estado.anuncios });
  estado.anuncios += mezcla.filter((x) => x.anuncio).length;
  return mezcla.map((x) => (x.anuncio ? anuncio({ lang, formato: x.formato, indice: x.indice }) : pintar(x)));
}

// "playas", "ríos"… la categoría de atracciones más numerosa, para el título.
function categoriaPrincipal(atracciones, lang) {
  const cuenta = new Map();
  for (const l of atracciones) cuenta.set(l.tipo, (cuenta.get(l.tipo) || 0) + 1);
  let mejor = null;
  for (const [tipo, n] of cuenta) if (!mejor || n > mejor.n || (n === mejor.n && tipo < mejor.tipo)) mejor = { tipo, n };
  const categoria = mejor && datos.categoriaPorTipo(mejor.tipo);
  return categoria ? datos.nombreCategoria(categoria.slug, lang).toLowerCase() : "";
}

function regla(actual, { lang, ctx }) {
  return h`
    <aside class="mh-regla" aria-labelledby="mh-regla-t">
      <h2 class="mh-regla-titulo tablilla-tenue" id="mh-regla-t">${ctx.t("municipios.regla")}</h2>
      <nav aria-label="${ctx.t("municipios.reglaEtiqueta")}">
        <ol>
          ${datos.municipios.map(
            (m) => h`<li><a href="${ctx.ruta(`/municipios/${m.slug}`)}"${m.id === actual.id ? raw(' aria-current="page"') : ""}>${medallonEstampa(m)}<span>${m.nombre}</span></a></li>`,
          )}
        </ol>
      </nav>
    </aside>`;
}

function vecinos(actual, { lang, ctx }) {
  const i = datos.municipios.findIndex((m) => m.id === actual.id);
  const anterior = datos.municipios[i - 1];
  const siguiente = datos.municipios[i + 1];
  const tarjeta = (m, clave, clase) => h`
    <a class="mh-vecino ${clase}" href="${ctx.ruta(`/municipios/${m.slug}`)}" rel="${clase === "es-anterior" ? "prev" : "next"}">
      ${clase === "es-anterior" && icono("flecha-izquierda", "mh-vecino-flecha")}
      ${medallonEstampa(m)}
      <span class="mh-vecino-texto"><span class="tablilla-tenue">${ctx.t(`municipios.${clave}`)}</span><span class="mh-vecino-nombre">${m.nombre}</span></span>
      ${clase === "es-siguiente" && icono("flecha-derecha", "mh-vecino-flecha")}
    </a>`;
  return h`
    <nav class="mh-vecinos" aria-label="${ctx.t("municipios.otrosMunicipios")}">
      ${anterior ? tarjeta(anterior, "anterior", "es-anterior") : h`<span></span>`}
      <a class="btn-contorno mh-todos-abajo" href="${ctx.ruta("/municipios")}"><span>${ctx.t("municipios.verTodos")}</span></a>
      ${siguiente ? tarjeta(siguiente, "siguiente", "es-siguiente") : h`<span></span>`}
    </nav>`;
}

async function paginaFicha(req, ctx, slugPedido) {
  const { lang } = ctx;
  const m = datos.municipioPorSlug(slugPedido);
  if (!m) {
    // Mayúsculas en el enlace (/municipios/Manzanillo): al slug de verdad.
    const minuscula = datos.municipioPorSlug(String(slugPedido).toLowerCase());
    if (minuscula) return { redirigir: ctx.ruta(`/municipios/${minuscula.slug}`), status: 301 };
    return { status: 404 };
  }

  const lugares = datos.lugaresDeMunicipio(m.id);
  const eventos = await eventosDelMunicipio(m.id);
  const tianguisYMercados = [...lugares.tianguis, ...lugares.mercados];
  const estado = { anuncios: 0 };
  const args = { lang, ctx };

  // --- Secciones, en el orden en que sirven al visitante: lo vivo primero; los
  // hoteles y restaurantes (datos de ejemplo) al final.
  const partes = [];
  const salto = [];

  if (eventos.length > 0) {
    salto.push({ id: "eventos", texto: ctx.t("municipios.secciones.eventos"), n: eventos.length });
    partes.push(
      seccion({
        id: "eventos",
        ic: "calendario",
        titulo: ctx.t("municipios.secciones.eventos"),
        cuenta: eventos.length,
        cuerpo: h`<div class="mh-lista">${listaConAnuncios(eventos, (ev) => filaEvento(ev, args), lang, estado)}</div>`,
      }),
    );
  }

  if (lugares.atracciones.length > 0) salto.push({ id: "atracciones", texto: ctx.t("municipios.secciones.atracciones"), n: lugares.atracciones.length });
  partes.push(
    seccion({
      id: "atracciones",
      ic: "lugar",
      titulo: ctx.t("municipios.secciones.atracciones"),
      cuenta: lugares.atracciones.length || null,
      cuerpo:
        lugares.atracciones.length > 0
          ? h`<div class="mh-lista">${listaConAnuncios(lugares.atracciones, (l) => filaAtraccion(l, args), lang, estado)}</div>`
          : h`<p class="mh-vacio">${ctx.t("municipios.atraccionesVacio")}</p>`,
    }),
  );

  if (tianguisYMercados.length > 0) {
    salto.push({ id: "tianguis", texto: ctx.t("municipios.secciones.tianguis"), n: tianguisYMercados.length });
    partes.push(
      seccion({
        id: "tianguis",
        ic: "tienda",
        titulo: ctx.t("municipios.secciones.tianguis"),
        cuenta: tianguisYMercados.length,
        cuerpo: h`<div class="mh-lista">${listaConAnuncios(tianguisYMercados, (l) => filaTianguis(l, args), lang, estado)}</div>`,
      }),
    );
  }

  if (lugares.hoteles.length > 0) salto.push({ id: "hoteles", texto: ctx.t("municipios.secciones.hoteles"), n: lugares.hoteles.length });
  partes.push(
    seccion({
      id: "hoteles",
      ic: "cama",
      titulo: ctx.t("municipios.secciones.hoteles"),
      cuenta: lugares.hoteles.length || null,
      cuerpo:
        lugares.hoteles.length > 0
          ? h`<div class="mh-lista">${listaConAnuncios(lugares.hoteles, (l) => filaTexto(l, args), lang, estado)}</div>`
          : h`<p class="mh-vacio">${ctx.t("municipios.hotelesVacio")} <a href="${ctx.ruta("/sugerir/lugar?tipo=hoteles")}">${ctx.t("municipios.hotelesVacioEnlace")}</a></p>`,
    }),
  );

  if (lugares.restaurantes.length > 0) salto.push({ id: "restaurantes", texto: ctx.t("municipios.secciones.restaurantes"), n: lugares.restaurantes.length });
  partes.push(
    seccion({
      id: "restaurantes",
      ic: "cubiertos",
      titulo: ctx.t("municipios.secciones.restaurantes"),
      cuenta: lugares.restaurantes.length || null,
      cuerpo:
        lugares.restaurantes.length > 0
          ? h`<div class="mh-lista">${listaConAnuncios(lugares.restaurantes, (l) => filaTexto(l, args), lang, estado)}</div>`
          : h`<p class="mh-vacio">${ctx.t("municipios.restaurantesVacio")}</p>`,
    }),
  );

  // Si ninguna sección llegó a 3 elementos: un banner tras las listas (nunca sobre
  // un estado vacío: solo si hay algo que listar).
  const hayContenido = salto.length > 0;
  const cierre = estado.anuncios === 0 && hayContenido ? h`<div class="mh-cierre">${anuncio({ lang, formato: "banner", indice: 0 })}</div>` : "";

  // --- Franja de feria
  const apodo = I.descripcion(lang, m.apodo);
  const franja = h`
    <header class="mf">
      <div class="envoltura">
        <nav class="mf-migas" aria-label="${ctx.t("municipios.migas")}">
          <a class="mf-todos" href="${ctx.ruta("/municipios")}">${icono("flecha-izquierda")}<span>${ctx.t("municipios.verTodos")}</span></a>
        </nav>
        <div class="cabecera mf-cabecera" data-cable>
          ${guirnalda({ focos: 34, comba: 0.5, alto: 48 })}
          <div class="mf-fila">
            <span class="mf-sello" data-colgar>${medallonEstampa(m)}</span>
            <div class="mf-nombre">
              <h1 class="rotulo letrero-colgante letrero-bandera" id="t-municipio" style="--giro:-1deg" data-revela>${m.nombre}</h1>
              ${apodo && h`<p class="mf-apodo tablilla">${apodo}</p>`}
            </div>
            <figure class="mf-postal"><img src="${m.foto}" alt="${ctx.t("municipios.postalAlt", { nombre: m.nombre })}" width="300" height="225" decoding="async" fetchpriority="high" /></figure>
          </div>
        </div>
      </div>
    </header>`;

  const larga = I.descripcion(lang, m.descLarga);
  const cuerpo = h`
    ${franja}
    <div class="mh">
      <div class="envoltura mh-cuerpo">
        <div class="mh-principal">
          <div class="mh-intro">
            <p class="mh-lectura">${larga}</p>
            ${
              salto.length > 1 &&
              h`<nav class="mh-salto" aria-label="${ctx.t("municipios.salto")}"><div class="chips">${salto.map((s) => chip({ texto: h`${s.texto}<span class="mh-chip-n">${s.n}</span>`, href: `#${s.id}` }))}</div></nav>`
            }
          </div>
          ${partes}
          ${cierre}
          ${vecinos(m, args)}
        </div>
        ${regla(m, args)}
      </div>
    </div>`;

  // --- SEO
  const cat = categoriaPrincipal(lugares.atracciones, lang);
  const titulo = cat
    ? ctx.t("municipios.tituloDetalle", { nombre: m.nombre, cosas: `${cat} ${ctx.t("municipios.yEventos")}` })
    : ctx.t("municipios.tituloDetalleSimple", { nombre: m.nombre });
  const conFoto = lugares.atracciones.find((l) => l.imagen && l.imagen.archivo);
  const urlFicha = I.urlAbsoluta(lang, `/municipios/${m.slug}`);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "AdministrativeArea",
      "@id": `${urlFicha}#municipio`,
      name: m.nombre,
      description: larga,
      url: urlFicha,
      image: `${I.SITIO}${m.foto}`,
      containedInPlace: {
        "@type": "State",
        name: "Colima",
        containedInPlace: { "@type": "Country", name: ctx.t("municipios.mexico") },
      },
    },
    migasJsonLd(lang, [
      [ctx.t("municipios.inicio"), "/inicio"],
      [ctx.t("municipios.letrero"), "/municipios"],
      [m.nombre, `/municipios/${m.slug}`],
    ]),
  ];

  return {
    titulo,
    descripcion: recortar(ctx.t("municipios.descripcionDetalle", { nombre: m.nombre, apodo: apodo, texto: I.descripcion(lang, m.descCorta) })),
    activa: "inicio",
    ruta: `/municipios/${m.slug}`,
    cuerpo,
    css: ["municipios"],
    js: ["paginas/municipios"],
    jsonLd,
    og: conFoto
      ? { imagen: `${I.SITIO}/img/${conFoto.imagen.archivo}-800.webp`, alt: ctx.t("municipios.ogAlt", { lugar: conFoto.titulo, nombre: m.nombre }), tipo: "website" }
      : undefined,
    cache: "evento",
  };
}

module.exports = {
  rutas: RUTAS,
  async pagina(req, ctx) {
    if (req.params && req.params.slug) return paginaFicha(req, ctx, req.params.slug);
    return paginaLista(ctx);
  },
};
