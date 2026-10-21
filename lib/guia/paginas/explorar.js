// /explorar: el feed de la guía. Eventos del backend con un lugar del
// catálogo local entre uno y otro (como la pestaña Explorar de la app).
//
// Armado: los eventos próximos van por fecha; tras cada uno se intercala un
// lugar sorteado con una "bolsa" sin repetición. El barajado es determinista
// (semilla = fecha de hoy en Colima + ids de los eventos + filtros) para que el
// HTML de dos visitas seguidas sea idéntico y la CDN pueda cachearlo. Sin
// eventos próximos se muestran solo lugares sorteados.
//
// Filtros como enlaces (funcionan sin JavaScript): ?mostrar=todos (incluye los
// ya pasados, al final), ?municipio=<slug> y ?pagina=N (12 eventos por página).
// public/js/paginas/explorar.js mejora "Ver más" (trae la página siguiente
// sin recargar) y el texto colapsado.

const { h, raw, json } = require("../h");
const { t, tn, urlAbsoluta } = require("../i18n");
const datos = require("../datos");
const { obtenerEventos, proximos, pasados, hoyEnColima, urlImagen } = require("../eventos");
const { letrero, boton, chip, anuncio, botonesTiendas, estadoVista, accionesPost, botonFavorito, listaConAnuncios, imagenLugar, icono } = require("../componentes");
const V = require("./eventos-vista");

const POR_PAGINA = 12; // eventos por página (≈24 tarjetas con los lugares)

// tipo de lugar → clave de categoría en data/i18n/<idioma>/datos.json
const CATEGORIA_DE_TIPO = { 10: "rios", 11: "playas", 12: "lagunas", 13: "montanas", 14: "arqueologia", 15: "parques", 16: "patrimonio", 17: "balnearios", 18: "rutas", 20: "hoteles", 21: "restaurantes", 30: "tianguis", 31: "mercados" };

// ---------- Sorteo determinista ----------

function hash32(texto) {
  let valor = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    valor ^= texto.charCodeAt(i);
    valor = Math.imul(valor, 16777619);
  }
  return valor >>> 0;
}

// Mulberry32: generador pequeño y estable entre versiones de Node.
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function barajar(lista, semilla) {
  const salida = [...lista];
  const rnd = azar(hash32(semilla));
  for (let i = salida.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [salida[i], salida[j]] = [salida[j], salida[i]];
  }
  return salida;
}

// n lugares sin repetirse: se baraja la bolsa y, si se acaba, se vuelve a barajar.
// Cada ronda va en dos grupos: primero los lugares con foto real y luego los que
// solo tienen la ilustración "sin foto aún" de la guía.
function sorteoDeLugares(pool, semilla, n) {
  const conFoto = pool.filter((l) => l.imagen && l.imagen.tipo === "foto");
  const demas = pool.filter((l) => !(l.imagen && l.imagen.tipo === "foto"));
  const salida = [];
  for (let ronda = 0; pool.length && salida.length < n; ronda++) {
    salida.push(...barajar(conFoto, `${semilla}#${ronda}a`), ...barajar(demas, `${semilla}#${ronda}b`));
  }
  return salida.slice(0, n);
}

// ---------- Filtros y enlaces ----------

function numeroDePagina(valor) {
  const n = Number.parseInt(valor, 10);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
}

function urlFeed(ctx, { mostrar, municipio, pagina }) {
  const q = new URLSearchParams();
  if (mostrar === "todos") q.set("mostrar", "todos");
  if (municipio) q.set("municipio", municipio.slug);
  if (pagina > 1) q.set("pagina", String(pagina));
  const texto = q.toString();
  return ctx.ruta("/explorar") + (texto ? `?${texto}` : "");
}

// ---------- Tarjetas ----------

function textoColapsable(ctx, texto) {
  if (!texto || !texto.trim()) return "";
  return h`<div class="post-texto" data-texto>
    <p class="post-texto-cuerpo">${texto.trim()}</p>
    <button class="post-ver-mas" type="button" hidden aria-expanded="false" data-mas="${t(ctx.lang, "comun.verMas")}" data-menos="${t(ctx.lang, "comun.verMenos")}">${t(ctx.lang, "comun.verMas")}</button>
  </div>`;
}

function cabezaDePost(ctx, { municipio, titulo, href, favorito }) {
  const enlaceMunicipio = V.hrefMunicipio(ctx.lang, municipio);
  return h`<header class="post-cabeza">
    ${enlaceMunicipio ? h`<a class="post-medallon" href="${enlaceMunicipio}" tabindex="-1" aria-hidden="true">${V.medallonMunicipio(municipio)}</a>` : V.medallonMunicipio(null)}
    <div class="post-id">
      <h2 class="post-titulo"><a href="${href}">${titulo}</a></h2>
      ${municipio && h`<a class="tablilla-muni" href="${enlaceMunicipio}">${municipio.nombre}</a>`}
    </div>
    ${favorito}
  </header>`;
}

function tarjetaEvento(ctx, ev, { hoy, prioridad }) {
  const { lang } = ctx;
  const municipio = V.municipioDe(ev);
  const href = ctx.ruta(`/evento/${ev.id}`);
  const estado = V.estadoDelEvento(ev, hoy);
  const lugar = ev.ubicacion ? ev.ubicacion.nombre : ev.subtitulo;
  const texto = V.descripcion(lang, ev.descripcion);
  return h`<article class="post post-evento${estado === "paso" ? " post-paso" : ""}" data-post="${ev.id}">
    ${cabezaDePost(ctx, {
      municipio,
      titulo: ev.titulo,
      href,
      favorito: botonFavorito({ id: ev.id, titulo: ev.titulo, imagen: ev.imagen ? urlImagen(ev.imagen, 480) : "", tipo: "evento", esPortada: ev.esPortada, fecha: ev.fecha, variante: "icono", lang }),
    })}
    <a class="post-foto" href="${href}" tabindex="-1" aria-hidden="true"><div class="marco marco-4-5">${V.imagenEvento(lang, ev, { sizes: "(max-width: 680px) 100vw, 640px", prioridad })}</div></a>
    <div class="post-datos">
      <p class="post-cuando">
        <span class="pastilla pastilla-lona">${icono("calendario")}<time datetime="${ev.fecha}">${V.textoFecha(lang, ev)}</time></span>
        ${estado === "hoy" && h`<span class="pastilla pastilla-hoy">${t(lang, "explorar.hoy")}</span>`}
        ${estado === "paso" && h`<span class="pastilla pastilla-tenue">${t(lang, "explorar.yaPaso")}</span>`}
      </p>
      ${lugar && h`<p class="post-sitio">${icono("lugar")}<span>${lugar}</span></p>`}
    </div>
    <div class="post-barra">${accionesPost({ id: ev.id, likes: ev.likes, comentarios: ev.comentarios, vistas: ev.vistas, url: urlAbsoluta(lang, `/evento/${ev.id}`), titulo: ev.titulo, texto: `${ev.titulo} · ${V.fechaParaCompartir(lang, ev)}`, lang })}</div>
    ${textoColapsable(ctx, texto)}
  </article>`;
}

function tarjetaLugar(ctx, lugar) {
  const { lang } = ctx;
  const municipio = datos.municipioPorId(lugar.municipioId);
  const href = ctx.ruta(`/lugar/${lugar.slug}`);
  const categoria = CATEGORIA_DE_TIPO[lugar.tipo] ? datos.nombreCategoria(CATEGORIA_DE_TIPO[lugar.tipo], lang) : "";
  const imagenFav = datos.rutaImagen(lugar.imagen, 480) || "";
  return h`<article class="post post-lugar" data-post="${lugar.id}">
    ${cabezaDePost(ctx, {
      municipio,
      titulo: lugar.titulo,
      href,
      favorito: botonFavorito({ id: lugar.id, titulo: lugar.titulo, imagen: imagenFav, tipo: "lugar", variante: "icono", lang }),
    })}
    <a class="post-foto" href="${href}" tabindex="-1" aria-hidden="true"><div class="marco ${lugar.imagen && lugar.imagen.tipo === "ilustracion" ? "marco-4-3 post-ilustracion" : "marco-4-5"}">${imagenLugar(lugar, { sizes: "(max-width: 680px) 100vw, 640px", alt: "" })}</div></a>
    <div class="post-datos">
      <p class="post-sitio">${icono("hoja")}<span class="tablilla-tenue">${categoria || t(lang, "explorar.lugar")}</span></p>
    </div>
    <div class="post-barra">${V.conMetricas(accionesPost({ id: lugar.id, url: urlAbsoluta(lang, `/lugar/${lugar.slug}`), titulo: lugar.titulo, texto: lugar.titulo, lang }))}</div>
    ${textoColapsable(ctx, datos.textoDescripcion(lugar, lang))}
  </article>`;
}

// ---------- Filtros ----------

function bloqueFiltros(ctx, { mostrar, municipio, hayFiltros, nProximos, nPasados, conteo }) {
  const { lang } = ctx;
  const enlace = (cambio) => urlFeed(ctx, { mostrar, municipio, pagina: 1, ...cambio });
  const resumen = [mostrar === "todos" ? t(lang, "explorar.todos") : t(lang, "explorar.proximos"), municipio && municipio.nombre].filter(Boolean).join(" · ");
  return h`<nav class="filtros" aria-labelledby="t-filtros">
    <h2 class="filtros-titulo" id="t-filtros">${t(lang, "explorar.filtros")}</h2>
    <div class="filtros-grupo" role="group" aria-label="${t(lang, "explorar.mostrar")}">
      ${chip({ texto: t(lang, "explorar.proximos"), href: enlace({ mostrar: "proximos" }), activo: mostrar !== "todos" })}
      ${chip({ texto: t(lang, "explorar.todos"), href: enlace({ mostrar: "todos" }), activo: mostrar === "todos" })}
    </div>
    <div class="filtros-grupo filtros-municipios chips-deslizables" role="group" aria-label="${t(lang, "explorar.municipio")}">
      ${chip({ texto: t(lang, "explorar.todosMunicipios"), href: enlace({ municipio: null }), activo: !municipio })}
      ${datos.municipios.map((m) => chip({ texto: m.nombre, href: enlace({ municipio: m }), activo: Boolean(municipio && municipio.id === m.id), miniatura: m.estampa }))}
    </div>
    <p class="filtros-resumen" aria-live="polite">
      <span>${t(lang, "explorar.mostrando")}: <strong>${resumen}</strong></span>
      ${conteo && (mostrar === "todos" ? h`<span class="nota">${tn(lang, "explorar.eventosProximos", nProximos)} · ${tn(lang, "explorar.eventosPasados", nPasados)}</span>` : h`<span class="nota">${tn(lang, "explorar.eventosProximos", nProximos)}</span>`)}
      ${hayFiltros && h`<a class="btn-texto" href="${ctx.ruta("/explorar")}">${t(lang, "explorar.quitarFiltros")}</a>`}
    </p>
  </nav>`;
}

function bloquesDelRiel(ctx) {
  const { lang } = ctx;
  return h`<div class="riel-extras">
    <section class="riel-bloque" aria-labelledby="t-riel-sugerir">
      <h2 class="riel-titulo" id="t-riel-sugerir">${t(lang, "explorar.sugerirTitulo")}</h2>
      <p>${t(lang, "explorar.sugerirTexto")}</p>
      ${boton({ texto: t(lang, "explorar.sugerirBoton"), href: ctx.ruta("/sugerir/evento"), variante: "contorno", icono: "mas" })}
    </section>
    <section class="riel-bloque" aria-labelledby="t-riel-app">
      <h2 class="riel-titulo" id="t-riel-app">${t(lang, "comun.promoDescargaTitulo")}</h2>
      ${botonesTiendas(lang, { chico: true })}
    </section>
    ${anuncio({ lang, formato: "banner", indice: 2, clase: "anuncio-riel" })}
  </div>`;
}

// ---------- Página ----------

module.exports = {
  rutas: ["/explorar"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const consulta = req.query || {};
    const mostrar = consulta.mostrar === "todos" ? "todos" : "proximos";
    const municipio = typeof consulta.municipio === "string" ? datos.municipioPorSlug(consulta.municipio) : null;
    const hayFiltros = mostrar === "todos" || Boolean(municipio);

    const hoy = hoyEnColima();
    const feed = await obtenerEventos();
    const delMunicipio = municipio ? feed.eventos.filter((ev) => ev.municipioId === municipio.id) : feed.eventos;
    const vigentes = proximos(delMunicipio, hoy);
    const yaPasaron = pasados(delMunicipio, hoy);
    const eventos = mostrar === "todos" ? [...vigentes, ...yaPasaron] : vigentes;

    const feedCaido = !feed.ok && feed.eventos.length === 0;
    const pool = datos.lugares.filter((l) => !municipio || l.municipioId === municipio.id);
    const semilla = [hoy, municipio ? municipio.slug : "", mostrar, eventos.map((e) => e.id).join(",")].join("|");

    // Qué va en esta página
    const conEventos = eventos.length > 0;
    const total = conEventos ? eventos.length : pool.length;
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    const pagina = Math.min(numeroDePagina(consulta.pagina), totalPaginas);
    const desde = (pagina - 1) * POR_PAGINA;
    let items = [];
    if (conEventos) {
      const lugares = sorteoDeLugares(pool, semilla, eventos.length);
      eventos.slice(desde, desde + POR_PAGINA).forEach((ev, i) => {
        items.push({ evento: ev });
        if (lugares[desde + i]) items.push({ lugar: lugares[desde + i] });
      });
    } else {
      items = sorteoDeLugares(pool, semilla, pool.length)
        .slice(desde, desde + POR_PAGINA)
        .map((lugar) => ({ lugar }));
    }

    const pintar = (item, i) => (item.evento ? tarjetaEvento(ctx, item.evento, { hoy, prioridad: pagina === 1 && i === 0 }) : tarjetaLugar(ctx, item.lugar));
    // Anuncios: cada 3 elementos, banner e infeed alternados, y la numeración sigue entre páginas.
    const porPagina = conEventos && pool.length ? POR_PAGINA * 2 : POR_PAGINA;
    const primerAnuncio = Math.floor(((pagina - 1) * porPagina) / 3);
    let tarjetas;
    if (items.length && !feedCaido) {
      let n = 0;
      tarjetas = listaConAnuncios(items, (item) => pintar(item, n++), lang, { cada: 3, primerAnuncio, cierre: pagina === totalPaginas });
    } else {
      tarjetas = items.map(pintar);
    }

    const hayMas = pagina < totalPaginas;
    const aviso = !feedCaido && !conEventos && pool.length
      ? h`<p class="feed-aviso">${municipio ? t(lang, "explorar.sinEventosMunicipio", { municipio: municipio.nombre }) : t(lang, "explorar.sinEventos")}</p>`
      : "";
    const reintentar = { texto: t(lang, "comun.reintentar"), href: urlFeed(ctx, { mostrar, municipio, pagina }), variante: "foco" };
    const estado = feedCaido
      ? estadoVista({ icono: "nube-tachada", titulo: t(lang, "comun.errorTitulo"), mensaje: t(lang, "explorar.errorFeed"), accion: reintentar })
      : !items.length
        ? estadoVista({ icono: "hoja", titulo: t(lang, "explorar.vacio"), accion: reintentar })
        : "";

    const filtros = bloqueFiltros(ctx, { mostrar, municipio, hayFiltros, nProximos: vigentes.length, nPasados: yaPasaron.length, conteo: !feedCaido });
    const paginas = totalPaginas > 1 && h`<nav class="feed-paginas" aria-label="${t(lang, "explorar.paginas")}">
      ${pagina > 1 && h`<a class="btn-contorno" rel="prev" href="${urlFeed(ctx, { mostrar, municipio, pagina: pagina - 1 })}">${icono("flecha-izquierda")}<span>${t(lang, "explorar.anteriores")}</span></a>`}
      ${hayMas && h`<a class="btn-contorno btn-ver-mas" rel="next" href="${urlFeed(ctx, { mostrar, municipio, pagina: pagina + 1 })}" data-ver-mas>${t(lang, "comun.verMas")}</a>`}
      <p class="nota" data-pagina-actual>${t(lang, "explorar.paginaDe", { n: pagina, total: totalPaginas })}</p>
    </nav>`;

    const cuerpo = h`
<div class="explorar">
  <div class="explorar-envoltura">
    ${letrero({
      id: "t-explorar",
      texto: t(lang, "explorar.titulo"),
      tinta: "lona",
      giro: -1,
      entrada: t(lang, "explorar.entrada"),
      extra: boton({ texto: t(lang, "explorar.sugerir"), href: ctx.ruta("/sugerir/evento"), variante: "contorno", icono: "mas", attrs: { "aria-label": t(lang, "explorar.sugerirAria") } }),
      focos: 34,
      comba: 0.5,
    })}
    <div class="explorar-rejilla">
      <div class="riel">
        ${filtros}
        ${bloquesDelRiel(ctx)}
      </div>
      <section class="feed" aria-label="${t(lang, "explorar.feedAria")}">
        ${estado}
        ${aviso}
        ${tarjetas.length > 0 && h`<div class="feed-lista" data-feed>${tarjetas}</div>`}
        ${paginas}
      </section>
    </div>
  </div>
</div>`;

    const base = ctx.ruta("/explorar");
    const variante = hayFiltros || pagina > 1;
    const listaItems = items.filter((i) => i.evento).map((i, n) => ({ "@type": "ListItem", position: desde + n + 1, url: urlAbsoluta(lang, `/evento/${i.evento.id}`), name: i.evento.titulo }));
    return {
      titulo: t(lang, "explorar.metaTitulo"),
      descripcion: t(lang, "explorar.metaDescripcion"),
      activa: "explorar",
      cuerpo,
      css: ["explorar"],
      js: ["social", "paginas/explorar"],
      jsonLd: listaItems.length && !variante ? [{ "@context": "https://schema.org", "@type": "ItemList", name: t(lang, "explorar.metaTitulo"), itemListElement: listaItems }] : [],
      robots: variante ? "noindex, follow" : undefined,
      canonical: variante ? urlAbsoluta(lang, "/explorar") : undefined,
      consulta: urlFeed(ctx, { mostrar, municipio, pagina }).slice(base.length),
      cache: feedCaido ? "ninguno" : "evento",
    };
  },
};
