// Piezas de HTML que comparten todas las páginas de la guía.
//
// Cada función devuelve HTML seguro (h.js). Las clases viven en
// public/css/guia.css. Todas reciben el idioma (`lang`: "es" | "en") cuando
// pintan texto.

const { h, raw, esc, atributos } = require("./h");
const { t, tn, ruta, nombreMunicipio, descripcion } = require("./i18n");

// ---------- Iconos ----------
// icono("corazon") → <svg class="ic"><use href="#i-corazon"/></svg>. El sprite
// va una vez por página, en layout.js.
function icono(nombre, clase = "") {
  return raw(`<svg class="ic${clase ? ` ${esc(clase)}` : ""}" aria-hidden="true" focusable="false"><use href="#i-${esc(nombre)}"/></svg>`);
}

// ---------- Guirnalda y letrero colgante ----------
// El cable y los focos los tiende public/js/core.js según el ancho.
function guirnalda({ focos = 30, comba = 0.5, alto = 48 } = {}) {
  return h`<div class="guirnalda" data-focos="${focos}" data-comba="${comba}" style="--alto:${alto}px" aria-hidden="true"></div>`;
}

// Encabezado de página: su propia guirnalda y el letrero colgado de ella.
//   letrero({ id: "t-explorar", texto: "Explorar", tinta: "lona", giro: -1, entrada: "…", nivel: 1 })
function letrero({ id, texto, tinta = "lona", giro = -1, entrada, nivel = 1, focos = 30, comba = 0.5, compacto = false, extra }) {
  const etiqueta = `h${nivel}`;
  return h`
    <div class="cabecera${compacto ? " cabecera-compacta" : ""}" data-cable>
      ${guirnalda({ focos, comba, alto: compacto ? 36 : 48 })}
      <div class="cabecera-fila${entrada || extra ? " con-entrada" : ""}">
        ${raw(`<${etiqueta}`)} class="rotulo letrero-colgante letrero-${tinta}" ${id ? raw(`id="${esc(id)}"`) : ""} style="--giro:${giro}deg" data-revela>${texto}${raw(`</${etiqueta}>`)}
        ${(entrada || extra) && h`<div class="cabecera-entrada-caja" data-revela="2">${entrada && h`<p class="cabecera-entrada">${entrada}</p>`}${extra}</div>`}
      </div>
    </div>`;
}

// ---------- Botones ----------
// boton({ texto, href, variante: "foco"|"lona"|"bandera"|"contorno"|"texto", chico, ancho, icono, sub, attrs, peligro })
function boton({ texto, href, variante = "foco", chico = false, ancho = false, icono: ic, sub, attrs, peligro = false, tipo = "button" }) {
  const pintado = ["foco", "lona", "bandera"].includes(variante);
  const clases = [
    pintado ? "btn-pintado" : variante === "texto" ? "btn-texto" : "btn-contorno",
    variante === "lona" ? "btn-lona" : variante === "bandera" ? "btn-bandera" : "",
    chico ? "btn-chico" : "",
    ancho ? "btn-ancho" : "",
    peligro ? "btn-peligro" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const contenido = h`${ic && icono(ic)}${sub ? h`<span><small>${sub}</small>${texto}</span>` : h`<span>${texto}</span>`}`;
  if (href) return h`<a class="${clases}" href="${href}"${atributos(attrs)}>${contenido}</a>`;
  return h`<button class="${clases}" type="${tipo}"${atributos(attrs)}>${contenido}</button>`;
}

// Los dos botones de descarga de la app (mismos enlaces que la portada).
const TIENDAS = {
  ios: "https://apps.apple.com/mx/app/colima-go/id1665801713",
  android: "https://play.google.com/store/apps/details?id=mx.shago.colimaapp",
};
function botonesTiendas(lang, { chico = false } = {}) {
  return h`<div class="tiendas">
    ${boton({ variante: "foco", chico, href: TIENDAS.ios, icono: "apple", sub: t(lang, "comun.descargalaEn"), texto: "App Store", attrs: { target: "_blank", rel: "noopener" } })}
    ${boton({ variante: "foco", chico, href: TIENDAS.android, icono: "google-play", sub: t(lang, "comun.disponibleEn"), texto: "Google Play", attrs: { target: "_blank", rel: "noopener" } })}
  </div>`;
}

// ---------- Chips ----------
function chip({ texto, href, activo = false, attrs, miniatura }) {
  const clases = `chip${miniatura ? " chip-miniatura" : ""}`;
  const contenido = h`${miniatura && h`<img src="${miniatura}" alt="" width="28" height="28" loading="lazy" />`}<span>${texto}</span>`;
  if (href) return h`<a class="${clases}" href="${href}"${activo ? raw(' aria-current="true"') : ""}${atributos(attrs)}>${contenido}</a>`;
  return h`<button class="${clases}" type="button" aria-pressed="${activo ? "true" : "false"}"${atributos(attrs)}>${contenido}</button>`;
}

// ---------- Fotos ----------
function sinFoto() {
  return raw('<span class="sin-foto" role="img" aria-label="Sin foto"></span>');
}

// Foto de un lugar del catálogo: <picture> con las dos anchuras generadas por
// scripts/importar-app-movil.js (-480 y -800). Sin archivo → Perro de Colima.
//   imagenLugar(lugar, { sizes, prioridad, alt })
function imagenLugar(lugar, { sizes = "(max-width: 860px) 100vw, 33vw", prioridad = false, alt } = {}) {
  const img = lugar.imagen;
  if (!img || !img.archivo) return sinFoto();
  const base = `/img/${img.archivo}`;
  return h`<img src="${base}-480.webp" srcset="${base}-480.webp 480w, ${base}-800.webp 800w" sizes="${sizes}" alt="${alt ?? lugar.titulo}" width="800" height="${Math.round((800 * (img.alto || 3)) / (img.ancho || 4))}" ${prioridad ? raw('fetchpriority="high"') : raw('loading="lazy" decoding="async"')} />`;
}

function fotoMarco({ cuerpo, ratio = "16-10", clase = "" }) {
  return h`<div class="marco marco-${ratio}${clase ? ` ${clase}` : ""}">${cuerpo}</div>`;
}

function medallon({ src, alt = "", tam = 64, clase = "" }) {
  return h`<span class="medallon${clase ? ` ${clase}` : ""}" style="width:${tam}px"><img src="${src}" alt="${alt}" width="200" height="200" loading="lazy" /></span>`;
}

// ---------- Corazón de favoritos ----------
// Los datos viajan en atributos; public/js/core.js guarda en localStorage y,
// con sesión, en la cuenta. tipo: "lugar" | "evento".
function botonFavorito({ id, titulo, imagen, tipo, esPortada = false, fecha = "", variante = "foto", lang }) {
  const clase = variante === "foto" ? "btn-foto" : "btn-icono";
  return h`<button class="${clase}" type="button" data-favorito data-id="${id}" data-titulo="${titulo}" data-imagen="${imagen || ""}" data-tipo="${tipo}" data-portada="${esPortada ? "1" : "0"}" data-fecha="${fecha}" aria-pressed="false" aria-label="${t(lang, "comun.guardarFavorito")}">${icono("corazon")}</button>`;
}

// ---------- Tarjeta de lugar ----------
// La foto manda; el nombre, el municipio y dos líneas de texto van debajo.
function tarjetaLugar(lugar, { lang, extra, prioridad = false, sizes, conFavorito = true } = {}) {
  const href = ruta(lang, `/lugar/${lugar.slug}`);
  const municipio = nombreMunicipio(lugar.municipioId) || lugar.subtitulo;
  const texto = descripcion(lang, lugar.descripcion);
  const imagenFav = lugar.imagen && lugar.imagen.archivo ? `/img/${lugar.imagen.archivo}-480.webp` : "";
  return h`
    <article class="tarjeta-lugar">
      ${fotoMarco({ ratio: "16-10", cuerpo: imagenLugar(lugar, { prioridad, sizes }) })}
      ${conFavorito && h`<div class="tl-accion">${botonFavorito({ id: lugar.id, titulo: lugar.titulo, imagen: imagenFav, tipo: "lugar", lang })}</div>`}
      <h3 class="tl-titulo"><a href="${href}">${lugar.titulo}</a></h3>
      <p class="tl-muni tablilla-muni">${municipio}</p>
      ${extra ? h`<p class="tl-extra">${extra}</p>` : h`<p class="tl-desc">${texto}</p>`}
    </article>`;
}

// ---------- Estado vacío / error ----------
function estadoVista({ icono: ic = "hoja", titulo, mensaje, accion }) {
  return h`
    <div class="estado-vista">
      <span class="ev-icono">${icono(ic)}</span>
      <h2>${titulo}</h2>
      ${mensaje && h`<p>${mensaje}</p>`}
      ${accion && (accion.href ? boton({ texto: accion.texto, href: accion.href, variante: accion.variante || "foco" }) : boton({ texto: accion.texto, variante: accion.variante || "foco", attrs: accion.attrs }))}
    </div>`;
}

function cargandoFocos() {
  return raw('<div class="cargando" role="status" aria-label="Cargando"><span class="cargando-focos"><span style="--i:0"></span><span style="--i:1"></span><span style="--i:2"></span><span style="--i:3"></span><span style="--i:4"></span></span></div>');
}

// ---------- Anuncios ----------
// Espacio reservado (misma regla que la app: nunca sobre estados vacíos,
// errores, formularios ni hojas). Con ADSENSE_CLIENT y ADSENSE_SLOT_* en el
// entorno pinta un bloque de Google AdSense; si no, una promo propia de Colima
// Go en el mismo lugar, para que el espacio nunca quede en blanco.
// El ID de editor de AdSense de Colima Go (no es secreto: va en el código de
// cada página). Se puede cambiar con ADSENSE_CLIENT, o apagar dejándola vacía.
const ADSENSE_CLIENT = process.env.ADSENSE_CLIENT === undefined ? "ca-pub-5479273904422379" : process.env.ADSENSE_CLIENT;
const SLOTS = {
  banner: process.env.ADSENSE_SLOT_BANNER || "",
  infeed: process.env.ADSENSE_SLOT_FEED || "",
};
// ACTIVO: el script de AdSense se carga en las páginas (conecta el sitio y
// permite anuncios). Los bloques solo se piden cuando hay ADSENSE_SLOT_*; sin
// ellos cada espacio sigue mostrando una promo propia.
const ADSENSE_ACTIVO = Boolean(ADSENSE_CLIENT && /^ca-pub-\d+$/.test(ADSENSE_CLIENT));
const HAY_BLOQUES = ADSENSE_ACTIVO && Boolean(SLOTS.banner || SLOTS.infeed);

function anuncio({ lang, formato = "banner", indice = 0, clase = "" }) {
  const slot = SLOTS[formato] || SLOTS.banner || SLOTS.infeed;
  if (HAY_BLOQUES && slot) {
    return h`<aside class="anuncio anuncio-${formato}${clase ? ` ${clase}` : ""}" aria-label="${t(lang, "comun.publicidad")}">
      <span class="anuncio-etiqueta">${t(lang, "comun.publicidad")}</span>
      <ins class="adsbygoogle" data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>
    </aside>`;
  }
  const promos = ["descarga", "sugerir", "invitar"];
  const promo = promos[indice % promos.length];
  const contenido =
    promo === "descarga"
      ? h`<div><h3 class="rotulo">${t(lang, "comun.promoDescargaTitulo")}</h3><p>${t(lang, "comun.promoDescargaTexto")}</p></div>${botonesTiendas(lang, { chico: true })}`
      : promo === "sugerir"
        ? h`<div><h3 class="rotulo">${t(lang, "comun.promoSugerirTitulo")}</h3><p>${t(lang, "comun.promoSugerirTexto")}</p></div>${boton({ texto: t(lang, "comun.promoSugerirBoton"), href: ruta(lang, "/sugerir/evento"), variante: "contorno" })}`
        : h`<div><h3 class="rotulo">${t(lang, "comun.promoInvitarTitulo")}</h3><p>${t(lang, "comun.promoInvitarTexto")}</p></div>${boton({ texto: t(lang, "comun.invitar"), variante: "contorno", icono: "compartir", attrs: { "data-accion": "compartir", "data-url": "https://www.colimago.mx/app?utm_source=web&utm_medium=share&utm_campaign=promo", "data-texto": t(lang, "comun.invitarMensaje") } })}`;
  return h`<aside class="anuncio anuncio-promo${formato === "infeed" ? " anuncio-infeed-promo" : ""}${clase ? ` ${clase}` : ""}" aria-label="Colima Go">
    <span class="anuncio-etiqueta" style="width:100%">Colima Go</span>${contenido}
  </aside>`;
}

// Port de utils/intercalarAnuncios.ts de la app: tras cada `cada` elementos
// contados se inserta un anuncio, alternando formatos; si la lista tiene
// menos de `cada` (y al menos uno) se añade uno al final; lista vacía, ninguno.
// Devuelve el mismo arreglo con objetos { anuncio: true, formato, id } en medio.
function intercalarAnuncios(items, { cada = 3, formatos = ["banner", "infeed"], cuenta, cierre = true, primerAnuncio = 0 } = {}) {
  // Los espacios de AdSense siguen la cadencia de la app (cada 3). Mientras no
  // haya AdSense, lo que se pinta son promos propias y repetirlas cada tres
  // elementos convertiría la lista en un feed de promociones: una por ~9.
  if (!HAY_BLOQUES) cada = Math.max(cada, 9);
  const cuenta_ = cuenta || (() => true);
  const salida = [];
  let contados = 0;
  let nAnuncios = 0;
  for (const item of items) {
    salida.push(item);
    if (!cuenta_(item)) continue;
    contados++;
    if (contados % cada === 0) {
      salida.push({ anuncio: true, formato: formatos[(primerAnuncio + nAnuncios) % formatos.length], id: `ad-${primerAnuncio + nAnuncios}`, indice: primerAnuncio + nAnuncios });
      nAnuncios++;
    }
  }
  if (cierre && contados >= 1 && nAnuncios === 0) {
    salida.push({ anuncio: true, formato: formatos[primerAnuncio % formatos.length], id: "ad-cierre", indice: primerAnuncio });
  }
  return salida;
}

// Pinta una lista con anuncios intercalados: pintar(item) para cada elemento.
function listaConAnuncios(items, pintar, lang, opciones = {}) {
  return intercalarAnuncios(items, opciones).map((item) => (item.anuncio ? anuncio({ lang, formato: item.formato, indice: item.indice }) : pintar(item)));
}

// ---------- Acciones de un post (me gusta, comentarios, vistas, compartir, menú) ----------
// public/js/social.js las conecta. `activo` es el me gusta del usuario (solo se
// sabe con sesión; el HTML sale siempre en versión anónima y el script lo ajusta).
function accionesPost({ id, likes = 0, comentarios = 0, vistas = 0, url, titulo, texto, lang, menu = true, pastilla = false, enlaceComentarios }) {
  const etiqueta = (n, clave) => t(lang, clave);
  return h`
    <div class="acciones${pastilla ? " acciones-pastilla" : ""}" data-acciones data-id="${id}">
      <button class="acc" type="button" data-accion="me-gusta" data-id="${id}" aria-pressed="false" aria-label="${etiqueta(likes, "comun.meGusta")}">${icono("me-gusta")}<span class="contador" data-contador="likes">${likes}</span></button>
      ${
        enlaceComentarios
          ? h`<a class="acc" href="${enlaceComentarios}" aria-label="${etiqueta(comentarios, "comun.comentarios")}">${icono("comentario")}<span class="contador" data-contador="comentarios">${comentarios}</span></a>`
          : h`<button class="acc" type="button" data-accion="comentarios" data-id="${id}" aria-label="${etiqueta(comentarios, "comun.comentarios")}">${icono("comentario")}<span class="contador" data-contador="comentarios">${comentarios}</span></button>`
      }
      <span class="acc" role="img" aria-label="${etiqueta(vistas, "comun.vistas")}">${icono("ojo")}<span class="contador" data-contador="vistas">${vistas}</span></span>
      ${!pastilla && h`<span class="acc-espacio"></span>`}
      ${url && h`<button class="acc" type="button" data-accion="compartir" data-url="${url}" data-titulo="${titulo || ""}" data-texto="${texto || ""}" aria-label="${t(lang, "comun.compartir")}">${icono("compartir")}</button>`}
      ${menu && h`<button class="acc" type="button" data-accion="menu-post" data-id="${id}" aria-haspopup="menu" aria-label="${t(lang, "comun.masOpciones")}">${icono("mas-opciones")}</button>`}
    </div>`;
}

module.exports = {
  icono,
  guirnalda,
  letrero,
  boton,
  botonesTiendas,
  TIENDAS,
  chip,
  sinFoto,
  imagenLugar,
  fotoMarco,
  medallon,
  botonFavorito,
  tarjetaLugar,
  estadoVista,
  cargandoFocos,
  anuncio,
  intercalarAnuncios,
  listaConAnuncios,
  accionesPost,
  ADSENSE_ACTIVO,
  ADSENSE_CLIENT,
  tn,
};
