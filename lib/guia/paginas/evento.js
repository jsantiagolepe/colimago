// /evento/:id: detalle de un evento del backend (o de una portada/programa,
// que además lista sus eventos hijos).
//
// El cartel va completo (sin recortar) en una columna fija a la izquierda en
// escritorio; los botones de atrás, compartir y favorito van sobre el cartel
// con su propio fondo y un velo solo arriba. El texto va debajo de la foto, no
// encima. Las vistas se suman con data-registrar-vista y los comentarios se
// montan en línea (public/js/social.js).
//
// 404 para un id con formato inválido, inexistente, pausado o que sea un
// lugar (eventos.js ya lo decide en obtenerEvento).

const { h } = require("../h");
const { t, urlAbsoluta } = require("../i18n");
const { obtenerEvento, obtenerEventos, hoyEnColima, urlImagen } = require("../eventos");
const { guirnalda, boton, accionesPost, botonFavorito, anuncio, icono, fotoMarco } = require("../componentes");
const V = require("./eventos-vista");

const REDES = [
  { clave: "facebook", icono: "facebook", nombre: "Facebook" },
  { clave: "instagram", icono: "instagram", nombre: "Instagram" },
  { clave: "tiktok", icono: "tiktok", nombre: "TikTok" },
  { clave: "youtube", icono: "youtube", nombre: "YouTube" },
  { clave: "whatsapp", icono: "whatsapp", nombre: "WhatsApp" },
  { clave: "web", icono: "web", nombre: "Web" },
];

const mayuscula = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto);
const sinEspacios = (texto) => String(texto || "").toLowerCase().replace(/\s+/g, " ").trim();

// ---------- Datos estructurados ----------

// La hora del backend es la hora de Colima tal cual (sin zona): UTC−6 todo el
// año desde que México quitó el horario de verano, así que va con -06:00.
function jsonLdEvento(ctx, ev, municipio, texto) {
  const inicio = ev.hora && !ev.todoElDia ? `${ev.fecha}T${ev.hora}:00-06:00` : ev.fecha;
  const lugar = {
    "@type": "Place",
    address: { "@type": "PostalAddress", addressLocality: municipio ? municipio.nombre : undefined, addressRegion: "Colima", addressCountry: "MX" },
  };
  if (ev.ubicacion) {
    lugar.name = ev.ubicacion.nombre;
    lugar.geo = { "@type": "GeoCoordinates", latitude: ev.ubicacion.lat, longitude: ev.ubicacion.lng };
  }
  const evento = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.titulo,
    startDate: inicio,
    endDate: ev.finFecha || undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: lugar,
    image: ev.imagen ? [ev.imagen] : undefined,
    description: texto ? texto.trim().slice(0, 1500) : undefined,
    url: urlAbsoluta(ctx.lang, `/evento/${ev.id}`),
  };
  const migas = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t(ctx.lang, "comun.nav.inicio"), item: urlAbsoluta(ctx.lang, "/inicio") },
      { "@type": "ListItem", position: 2, name: t(ctx.lang, "comun.nav.explorar"), item: urlAbsoluta(ctx.lang, "/explorar") },
      { "@type": "ListItem", position: 3, name: ev.titulo, item: urlAbsoluta(ctx.lang, `/evento/${ev.id}`) },
    ],
  };
  return [evento, migas];
}

// ---------- Piezas ----------

function botonesDelCartel(ctx, ev) {
  const { lang } = ctx;
  const url = urlAbsoluta(lang, `/evento/${ev.id}`);
  return h`<div class="detalle-botones">
    <a class="btn-foto" href="${ctx.ruta("/explorar")}" data-volver aria-label="${t(lang, "evento.volver")}">${icono("flecha-izquierda")}</a>
    <span class="detalle-botones-der">
      <button class="btn-foto" type="button" data-accion="compartir" data-url="${url}" data-titulo="${ev.titulo}" data-texto="${ev.titulo} · ${V.fechaParaCompartir(lang, ev)}" data-campana="evento" aria-label="${t(lang, "comun.compartir")}">${icono("compartir")}</button>
      ${botonFavorito({ id: ev.id, titulo: ev.titulo, imagen: ev.imagen ? urlImagen(ev.imagen, 480) : "", tipo: "evento", esPortada: ev.esPortada, fecha: ev.fecha, variante: "foto", lang })}
    </span>
  </div>`;
}

function dato({ icono: nombre, etiqueta, cuerpo }) {
  return h`<div class="detalle-dato">
    <dt>${icono(nombre)}<span class="tablilla-tenue">${etiqueta}</span></dt>
    <dd>${cuerpo}</dd>
  </div>`;
}

function seccionPrograma(ctx, hijos) {
  const { lang } = ctx;
  return h`<section class="detalle-seccion" aria-labelledby="t-programa">
    <h2 class="seccion-titulo" id="t-programa">${t(lang, "evento.programa")}</h2>
    <ul class="programa">
      ${hijos.map((e) => {
        const municipio = V.municipioDe(e);
        return h`<li><a class="programa-item" href="${ctx.ruta(`/evento/${e.id}`)}">
          ${fotoMarco({ ratio: "16-9", cuerpo: V.imagenEvento(lang, e, { sizes: "(max-width: 700px) 100vw, 320px", anchos: [480, 800] }) })}
          <h3>${e.titulo}</h3>
          <p class="tablilla-tenue">${e.fecha ? V.textoFechaCorta(lang, e) : municipio ? municipio.nombre : ""}</p>
        </a></li>`;
      })}
    </ul>
  </section>`;
}

function seccionRedes(ctx, ev) {
  const { lang } = ctx;
  const enlaces = REDES.map((r) => ({ ...r, href: V.urlRed(r.clave, ev.redes[r.clave]) })).filter((r) => r.href);
  if (!enlaces.length) return "";
  return h`<section class="detalle-seccion" aria-labelledby="t-redes">
    <h2 class="seccion-titulo" id="t-redes">${t(lang, "evento.redes")}</h2>
    <ul class="redes">
      ${enlaces.map((r) => h`<li><a class="red red-${r.clave}" href="${r.href}" target="_blank" rel="noopener nofollow" aria-label="${r.nombre}" title="${r.nombre}">${icono(r.icono)}</a></li>`)}
    </ul>
  </section>`;
}

// ---------- Página ----------

module.exports = {
  rutas: ["/evento/:id"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const id = req.params.id;
    if (!V.ID_RE.test(id)) return { status: 404 };
    const ev = await obtenerEvento(id);
    if (!ev) return { status: 404 };

    const hoy = hoyEnColima();
    const municipio = V.municipioDe(ev);
    const pasado = V.estadoDelEvento(ev, hoy) === "paso";
    const texto = V.descripcion(lang, ev.descripcion);
    const subtitulo = ev.subtitulo && !(ev.ubicacion && sinEspacios(ev.subtitulo) === sinEspacios(ev.ubicacion.nombre)) ? ev.subtitulo : "";

    // Eventos de un programa (solo las portadas): los hijos que sigan en el feed.
    let hijos = [];
    if (ev.esPortada && ev.hijos.length) {
      const feed = await obtenerEventos();
      const porId = new Map(feed.eventos.map((e) => [e.id, e]));
      hijos = ev.hijos
        .map((i) => porId.get(i))
        .filter(Boolean)
        .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    }

    const url = urlAbsoluta(lang, `/evento/${ev.id}`);
    const lugar = ev.ubicacion;
    const cartel = ev.imagen
      ? h`<div class="detalle-cartel">
          <div class="marco detalle-marco">${V.imagenEvento(lang, ev, { sizes: "(min-width: 900px) 46vw, 100vw", anchos: [480, 800, 1200, 1600], prioridad: true, alt: t(lang, "evento.altCartel", { titulo: ev.titulo }) })}</div>
          ${botonesDelCartel(ctx, ev)}
          <button class="btn-foto detalle-menu" type="button" data-accion="menu-post" data-id="${ev.id}" aria-haspopup="menu" aria-label="${t(lang, "comun.masOpciones")}">${icono("mas-opciones")}</button>
        </div>`
      : "";

    const cuerpo = h`
<article class="detalle${ev.imagen ? " con-cartel" : " sin-cartel"}" data-registrar-vista="${ev.id}">
  <div class="detalle-envoltura">
    ${guirnalda({ focos: 30, comba: 0.45, alto: 36 })}
    <div class="detalle-rejilla">
      ${cartel}
      <div class="detalle-info">
        ${!ev.imagen && h`<div class="detalle-barra">${botonesDelCartel(ctx, ev)}</div>`}
        <h1 class="rotulo detalle-titulo">${ev.titulo}</h1>
        ${subtitulo && h`<p class="detalle-subtitulo">${subtitulo}</p>`}
        ${municipio && h`<p class="detalle-municipio"><a class="tablilla-muni" href="${V.hrefMunicipio(lang, municipio)}">${municipio.nombre}</a></p>`}
        ${pasado && h`<p class="detalle-aviso" role="note">${icono("reloj")}<span>${t(lang, "evento.yaPaso")}</span><a href="${ctx.ruta("/explorar")}">${t(lang, "evento.verProximos")}</a></p>`}
        <dl class="detalle-datos">
          ${dato({ icono: "calendario", etiqueta: t(lang, "evento.fecha"), cuerpo: h`<time datetime="${ev.fecha}">${mayuscula(V.textoFecha(lang, ev))}</time>` })}
          ${lugar && dato({
            icono: "lugar",
            etiqueta: t(lang, "evento.lugar"),
            cuerpo: h`<span>${lugar.nombre}</span>${lugar.descripcion && h`<span class="nota">${lugar.descripcion}</span>`}<a class="detalle-mapa" href="https://www.google.com/maps/search/?api=1&amp;query=${lugar.lat},${lugar.lng}" target="_blank" rel="noopener">${t(lang, "evento.verMapa")}${icono("externo")}</a>`,
          })}
        </dl>
        ${accionesPost({ id: ev.id, likes: ev.likes, comentarios: ev.comentarios, vistas: ev.vistas, lang, menu: false, pastilla: true, enlaceComentarios: "#comentarios" })}
        ${texto && texto.trim() && h`<div class="lectura detalle-texto">${texto.trim()}</div>`}
        ${hijos.length > 0 && seccionPrograma(ctx, hijos)}
        ${seccionRedes(ctx, ev)}
        <section class="detalle-seccion detalle-comentarios" id="comentarios" aria-labelledby="t-comentarios">
          <h2 class="seccion-titulo" id="t-comentarios">${t(lang, "evento.comentarios")} <span class="contador" data-total-comentarios="${ev.id}">${ev.comentarios}</span></h2>
          <div data-comentarios-inline data-id="${ev.id}"><noscript><p class="nota">${t(lang, "evento.sinJs")}</p></noscript></div>
        </section>
      </div>
    </div>
    <div class="detalle-pie">
      ${boton({ texto: t(lang, "evento.verMasEventos"), href: ctx.ruta("/explorar"), variante: "foco", icono: "brujula" })}
      ${anuncio({ lang, formato: "banner", indice: 0, clase: "anuncio-pie" })}
    </div>
  </div>
</article>`;

    const descripcion = [mayuscula(V.textoFecha(lang, ev)), municipio && municipio.nombre].filter(Boolean).join(" · ");
    return {
      titulo: ev.titulo,
      descripcion: V.resumen(`${descripcion}. ${texto}`, 158),
      activa: "explorar",
      cuerpo,
      css: ["evento"],
      js: ["social", "paginas/evento"],
      jsonLd: jsonLdEvento(ctx, ev, municipio, texto),
      og: ev.imagen ? { imagen: ev.imagen, alt: ev.titulo, tipo: "article" } : { tipo: "article" },
      cache: "evento",
    };
  },
};
