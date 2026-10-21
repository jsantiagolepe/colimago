// Inicio (/inicio): el hub de la app, "la calle de la feria".
//
//   1. Letrero "Del mar al volcán" + el mapa de feria: los diez municipios
//      como focos colgados de cables, la costa del Pacífico y el Volcán de
//      Fuego, con la ficha del municipio elegido al lado.
//   2. Top 10 (solo si el backend trae elementos con imágenes).
//   3. Banner de anuncio.
//   4. "Explora Colima": carteles y tablas colgantes con los accesos.
//   5. Anuncio infeed y cierre con los botones de descarga.
//
// Todo sale en el HTML del servidor (los buscadores leen las diez fichas y los
// enlaces); public/js/paginas/inicio.js solo mejora: cambia la ficha visible,
// enciende los focos, mueve el carrusel y calcula las cuerdas.

const { h, raw } = require("../h");
const { t, ruta: rutaIdioma, urlAbsoluta, descripcion, fechaLarga, SITIO } = require("../i18n");
const { icono, letrero, guirnalda, chip, botonesTiendas, anuncio } = require("../componentes");
const { municipios, mapaFeria } = require("../datos");
const { obtenerTop10, urlImagen } = require("../eventos");

// ---------- Geometría del mapa de feria ----------
// Lienzo de referencia 1000 × 800 (aspecto 0.8 de la app). Los cables y la
// costa se dibujan en SVG con ese viewBox (estirado, trazo sin escalar); los
// focos y las etiquetas van en HTML, en porcentajes del lienzo.
const LIENZO_ANCHO = 1000;
const LIENZO_ALTO = LIENZO_ANCHO * mapaFeria.aspecto;
const redondear = (n) => Math.round(n * 10) / 10;

function geometriaMapa() {
  const nodos = new Map([[0, { x: mapaFeria.volcan.x, y: mapaFeria.volcan.y }]]);
  for (const m of municipios) nodos.set(m.id, { x: m.mapa.x, y: m.mapa.y });

  // Cada cable es una curva cuadrática: el punto de control es el punto medio
  // desplazado hacia abajo el 12 % del largo del cable; en su punto medio real
  // ((p + 2·control + q) / 4) cuelga un foco chico.
  const cables = mapaFeria.cables.map(([a, b]) => {
    const p = nodos.get(a);
    const q = nodos.get(b);
    const largo = Math.hypot((q.x - p.x) * LIENZO_ANCHO, (q.y - p.y) * LIENZO_ALTO);
    const control = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + (mapaFeria.curvatura * largo) / LIENZO_ALTO };
    const medio = { x: (p.x + 2 * control.x + q.x) / 4, y: (p.y + 2 * control.y + q.y) / 4 };
    const punto = (n) => `${redondear(n.x * LIENZO_ANCHO)},${redondear(n.y * LIENZO_ALTO)}`;
    return { d: `M${punto(p)} Q${punto(control)} ${punto(q)}`, medio };
  });

  // La costa viene en fracciones del lienzo ("M0,.6 C…"): se escala a 1000 × 800.
  const costa = mapaFeria.costa.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => `${redondear(x * LIENZO_ANCHO)},${redondear(y * LIENZO_ALTO)}`);

  // Orden de encendido: de la costa (y mayor) al volcán, un paso por foco.
  const piezas = [
    ...municipios.map((m) => ({ clave: `m${m.id}`, y: m.mapa.y })),
    { clave: "v", y: mapaFeria.volcan.y },
    ...cables.map((c, i) => ({ clave: `c${i}`, y: c.medio.y })),
  ].sort((a, b) => b.y - a.y);
  const orden = new Map(piezas.map((p, i) => [p.clave, i]));

  return { cables, costa, orden };
}
const GEOMETRIA = geometriaMapa();

// Triángulo con cráter bajo el foco del volcán (SVG propio, no se estira).
const VOLCAN_SVG = raw(
  '<svg class="volcan" viewBox="0 0 120 84" aria-hidden="true" focusable="false">' +
    '<path class="volcan-cuerpo" d="M3 82 47 13 60 10 73 13 117 82Z"/>' +
    '<ellipse class="volcan-crater" cx="60" cy="12.5" rx="13" ry="3.6"/>' +
    '<path class="volcan-ladera" d="M50 30 38 62M70 30 82 60M60 40 60 70"/>' +
    "</svg>",
);

// ---------- Piezas ----------

function mapaFeriaHtml(lang) {
  const pos = (x, y) => `--x:${x};--y:${y}`;
  const cablesSvg = h`<svg class="mapa-cables" viewBox="0 0 ${LIENZO_ANCHO} ${LIENZO_ALTO}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path class="costa" d="${GEOMETRIA.costa}"/>
      ${GEOMETRIA.cables.map((c) => h`<path class="cable" d="${c.d}"/>`)}
    </svg>`;

  const focosCable = GEOMETRIA.cables.map((c, i) => h`<span class="foco-cable" style="${pos(redondear(c.medio.x * 1000) / 1000, redondear(c.medio.y * 1000) / 1000)};--i:${GEOMETRIA.orden.get(`c${i}`)}" aria-hidden="true"><span class="bombilla"></span></span>`);

  const nodos = municipios.map((m) => {
    const elegido = m.id === 1;
    return h`<a class="nodo${elegido ? " activo" : ""}" href="${rutaIdioma(lang, `/municipios/${m.slug}`)}" data-slug="${m.slug}" data-lado="${m.mapa.lado}" style="${pos(m.mapa.x, m.mapa.y)};--i:${GEOMETRIA.orden.get(`m${m.id}`)}"><span class="bombilla" aria-hidden="true"></span><span class="etiqueta">${m.nombre}</span></a>`;
  });

  const volcan = h`<span class="nodo-volcan" data-lado="${mapaFeria.volcan.lado}" style="${pos(mapaFeria.volcan.x, mapaFeria.volcan.y)};--i:${GEOMETRIA.orden.get("v")}"><span class="bombilla" aria-hidden="true"></span><span class="etiqueta etiqueta-fija">${t(lang, "inicio.mapa.volcan")}</span></span>`;

  return h`<div class="mapa" data-mapa role="group" aria-label="${t(lang, "inicio.mapa.etiqueta")}" aria-describedby="mapa-ayuda">
      <div class="mapa-lienzo">
        ${VOLCAN_SVG}
        ${cablesSvg}
        ${focosCable}
        <span class="oceano" aria-hidden="true">${t(lang, "inicio.mapa.oceano")}</span>
        ${volcan}
        ${nodos}
      </div>
      <p class="sr-only" id="mapa-ayuda">${t(lang, "inicio.mapa.ayuda")}</p>
      <p class="sr-only" role="status" aria-live="polite" data-mapa-estado></p>
    </div>`;
}

// Las diez fichas van en el HTML (la primera, Colima, visible; las demás se
// apilan en la misma celda y el script solo cambia cuál se ve).
function fichasHtml(lang) {
  return h`<div class="fichas" data-fichas>
      ${municipios.map((m) => {
        const nombre = m.nombre;
        const elegido = m.id === 1;
        return h`<article class="ficha${elegido ? " activa" : ""}" data-slug="${m.slug}" aria-labelledby="ficha-${m.slug}-n">
          <span class="medallon medallon-elegido ficha-medallon"><img src="${m.estampa}" alt="" width="200" height="200"${elegido ? raw(' fetchpriority="high"') : raw(' loading="lazy" decoding="async"')} /></span>
          <div class="ficha-texto">
            <h3 class="rotulo ficha-nombre" id="ficha-${m.slug}-n">${nombre}</h3>
            <p class="ficha-apodo">${descripcion(lang, m.apodo)}</p>
            <p class="ficha-desc">${descripcion(lang, m.descCorta)}</p>
          </div>
          <a class="btn-pintado ficha-ver" href="${rutaIdioma(lang, `/municipios/${m.slug}`)}" aria-label="${t(lang, "inicio.ficha.verNombre", { nombre })}"><span>${t(lang, "inicio.ficha.ver")}</span>${icono("flecha-derecha")}</a>
        </article>`;
      })}
    </div>`;
}

// ---------- Top 10 ----------
const MAX_DIAPOSITIVAS = 30;

// Cada imagen de cada elemento es una diapositiva (como en la app).
function diapositivasTop10(top) {
  const salida = [];
  for (const el of top || []) {
    if (!el || !Array.isArray(el.imagenes)) continue;
    for (const imagen of el.imagenes) {
      if (salida.length >= MAX_DIAPOSITIVAS) return salida;
      salida.push({ id: el.id, titulo: el.titulo, fecha: el.fecha, imagen });
    }
  }
  return salida;
}

function top10Html(lang, diapositivas) {
  const total = diapositivas.length;
  const iconoPausa = raw('<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5v14M15 5v14"/></svg>');
  return h`<section class="top10" aria-labelledby="t-top10">
    <div class="envoltura">
      ${letrero({ id: "t-top10", texto: t(lang, "inicio.top10.titulo"), tinta: "lona", giro: 0.8, nivel: 2, compacto: true, focos: 30, comba: 0.5 })}
    </div>
    <div class="envoltura">
      <div class="carrusel" data-carrusel role="region" aria-roledescription="carrusel" aria-label="${t(lang, "inicio.top10.carrusel")}">
        <div class="carrusel-pista" data-pista>
          ${diapositivas.map(
            (d, i) => h`<div class="diapositiva" role="group" aria-roledescription="diapositiva" aria-label="${t(lang, "inicio.top10.diapositiva", { n: i + 1, total })}">
            <a class="diap-enlace" href="${rutaIdioma(lang, `/evento/${d.id}`)}">
              <span class="marco diap-foto"><img src="${urlImagen(d.imagen, 480)}" srcset="${urlImagen(d.imagen, 480)} 480w, ${urlImagen(d.imagen, 800)} 800w" sizes="(max-width: 860px) 82vw, 520px" alt="" width="800" height="640"${i === 0 ? raw(' decoding="async"') : raw(' loading="lazy" decoding="async"')} /></span>
              <span class="diap-titulo">${d.titulo}</span>
              ${d.fecha && h`<time class="diap-fecha" datetime="${d.fecha}">${fechaLarga(lang, d.fecha)}</time>`}
            </a>
          </div>`,
          )}
        </div>
        ${
          total > 1 &&
          h`<div class="carrusel-mando" data-mando hidden>
          <div class="carrusel-botones">
            <button class="btn-icono" type="button" data-anterior aria-label="${t(lang, "inicio.top10.anterior")}">${icono("flecha-izquierda")}</button>
            <button class="btn-icono" type="button" data-pausa aria-label="${t(lang, "inicio.top10.pausar")}" data-pausar="${t(lang, "inicio.top10.pausar")}" data-reanudar="${t(lang, "inicio.top10.reanudar")}"><span data-ic-pausa>${iconoPausa}</span><span data-ic-play hidden>${icono("reproducir")}</span></button>
            <button class="btn-icono" type="button" data-siguiente aria-label="${t(lang, "inicio.top10.siguiente")}">${icono("flecha-derecha")}</button>
          </div>
          <div class="carrusel-focos" role="group" aria-label="${t(lang, "inicio.top10.indicadores")}">
            ${diapositivas.map((d, i) => h`<button class="carrusel-foco" type="button" data-ir="${i}" aria-label="${t(lang, "inicio.top10.ir", { n: i + 1, titulo: d.titulo })}"><span class="foco-solo" aria-hidden="true"></span></button>`)}
          </div>
        </div>`
        }
      </div>
    </div>
  </section>`;
}

// ---------- Explora Colima: carteles y tablas colgantes ----------
function carteloHtml(lang, { href, tinta, giro, portada, titulo, subtitulo, detalle, revela = 1 }) {
  return h`<a class="cartel cuelga letrero-${tinta}" href="${href}" style="--giro:${giro}deg" data-revela="${revela}">
      <span class="cartel-portada"><img src="${portada}-480.webp" srcset="${portada}-480.webp 480w, ${portada}-800.webp 800w" sizes="(max-width: 860px) 96px, 160px" alt="" width="800" height="1227" loading="lazy" decoding="async" /></span>
      <span class="cartel-texto">
        <span class="cartel-titulo rotulo">${titulo}</span>
        <span class="cartel-sub">${subtitulo}</span>
        <span class="cartel-detalle">${detalle}</span>
      </span>
      <span class="cartel-ir" aria-hidden="true">${icono("flecha-derecha")}</span>
    </a>`;
}

function tablaHtml(lang, { href, tinta, giro, imagen, srcset, ancho, alto, nombre, revela = 1, posicion }) {
  return h`<a class="tabla cuelga letrero-${tinta}" href="${href}" style="--giro:${giro}deg" data-revela="${revela}">
      <span class="tabla-cara">
        <img src="${imagen}"${srcset && raw(` srcset="${srcset}" sizes="(max-width: 860px) 44vw, 220px"`)} alt="" width="${ancho}" height="${alto}" loading="lazy" decoding="async"${posicion && raw(` style="object-position:${posicion}"`)} />
        <span class="tabla-nombre">${nombre}</span>
      </span>
    </a>`;
}

function exploraHtml(lang) {
  const L = (clave) => t(lang, `inicio.explora.${clave}`);
  const ruta = (destino) => rutaIdioma(lang, destino);
  const cable = (focos, comba, alto = 40) => guirnalda({ focos, comba, alto });

  return h`<section class="explora" aria-labelledby="t-explora">
    <div class="envoltura">
      ${letrero({ id: "t-explora", texto: L("titulo"), tinta: "bandera", giro: -0.9, nivel: 2, compacto: true, focos: 30, comba: 0.5 })}
      <div class="tendedero">
        <div class="piso piso-a">
          <div class="tramo tramo-cartel">
            ${cable(22, 0.42)}
            ${carteloHtml(lang, { href: ruta("/fiestas-charrotaurinas"), tinta: "lona", giro: -0.6, portada: "/img/c/portada-feria", titulo: L("feria.titulo"), subtitulo: L("feria.subtitulo"), detalle: L("feria.detalle") })}
          </div>
          <div class="tramo tramo-tablas">
            ${cable(12, 0.5)}
            ${tablaHtml(lang, { href: ruta("/fiestas-del-pueblo"), tinta: "bandera", giro: -1, imagen: "/img/fiestas-del-pueblo-760.webp", ancho: 760, alto: 428, nombre: L("fiestasPueblo"), revela: 1, posicion: "38% 50%" })}
            ${tablaHtml(lang, { href: ruta("/rincones-naturales"), tinta: "lona", giro: 0.8, imagen: "/img/c/portada-rincones-480.webp", srcset: "/img/c/portada-rincones-480.webp 480w, /img/c/portada-rincones-800.webp 800w", ancho: 800, alto: 533, nombre: L("rincones"), revela: 2 })}
          </div>
        </div>
        <div class="piso piso-b">
          <div class="tramo tramo-tablas">
            ${cable(12, 0.5)}
            ${tablaHtml(lang, { href: ruta("/playas"), tinta: "lona", giro: 0.7, imagen: "/img/c/portada-playas-480.webp", srcset: "/img/c/portada-playas-480.webp 480w, /img/c/portada-playas-800.webp 800w", ancho: 800, alto: 800, nombre: L("playas"), revela: 1 })}
            ${tablaHtml(lang, { href: ruta("/municipios"), tinta: "bandera", giro: -0.8, imagen: "/img/municipios-420.webp", ancho: 420, alto: 280, nombre: L("municipios"), revela: 2 })}
          </div>
          <div class="tramo tramo-cartel">
            ${cable(22, 0.42)}
            ${carteloHtml(lang, { href: ruta("/tianguis-y-mercados"), tinta: "bandera", giro: 0.6, portada: "/img/c/portada-tianguis", titulo: L("tianguis.titulo"), subtitulo: L("tianguis.subtitulo"), detalle: L("tianguis.detalle"), revela: 2 })}
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

// ---------- Datos estructurados ----------
function jsonLdInicio(lang, descripcionPagina) {
  const accesos = [
    ["/fiestas-charrotaurinas", t(lang, "inicio.explora.feria.titulo")],
    ["/fiestas-del-pueblo", t(lang, "inicio.explora.fiestasPueblo")],
    ["/rincones-naturales", t(lang, "inicio.explora.rincones")],
    ["/playas", t(lang, "inicio.explora.playas")],
    ["/municipios", t(lang, "inicio.explora.municipios")],
    ["/tianguis-y-mercados", t(lang, "inicio.explora.tianguis.titulo")],
  ];
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Colima Go",
      url: `${SITIO}/`,
      inLanguage: lang === "en" ? "en" : "es-MX",
      description: descripcionPagina,
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: t(lang, "inicio.explora.titulo"),
      itemListElement: accesos.map(([destino, nombre], i) => ({ "@type": "ListItem", position: i + 1, name: nombre, url: urlAbsoluta(lang, destino) })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: t(lang, "inicio.mapa.titulo"),
      itemListElement: municipios.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.nombre, url: urlAbsoluta(lang, `/municipios/${m.slug}`) })),
    },
  ];
}

module.exports = {
  rutas: ["/inicio"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const titulo = t(lang, "inicio.titulo");
    const descripcionPagina = t(lang, "inicio.descripcion");

    // El backend puede venir vacío o caído: nunca lanza, y sin imágenes no se pinta nada.
    const diapositivas = diapositivasTop10(await obtenerTop10());

    const cuerpo = h`
<div class="inicio">
  <div class="envoltura">
    ${letrero({ id: "t-inicio", texto: t(lang, "inicio.letrero"), tinta: "bandera", giro: -1.1, entrada: t(lang, "inicio.entrada"), nivel: 1, compacto: true, focos: 34, comba: 0.45 })}
  </div>

  <section class="mapa-seccion" aria-labelledby="t-municipios">
    <h2 class="sr-only" id="t-municipios">${t(lang, "inicio.mapa.titulo")}</h2>
    <div class="envoltura">
      <div class="escena">
        ${mapaFeriaHtml(lang)}
        ${fichasHtml(lang)}
      </div>
      <nav class="lista-municipios" aria-label="${t(lang, "inicio.lista.etiqueta")}">
        ${municipios.map((m) => chip({ texto: m.nombre, href: rutaIdioma(lang, `/municipios/${m.slug}`), miniatura: m.estampa }))}
      </nav>
    </div>
  </section>

  ${diapositivas.length > 0 && top10Html(lang, diapositivas)}

  <div class="envoltura inicio-anuncio">${anuncio({ lang, formato: "banner", indice: 2 })}</div>

  ${exploraHtml(lang)}

  <div class="envoltura inicio-anuncio">${anuncio({ lang, formato: "infeed", indice: 1 })}</div>

  <section class="cierre" aria-labelledby="t-cierre">
    <div class="envoltura">
      ${guirnalda({ focos: 40, comba: 0.7, alto: 80 })}
      <span class="perro" aria-hidden="true"></span>
      <h2 class="rotulo" id="t-cierre" data-revela>${t(lang, "inicio.cierre.titulo")}</h2>
      <p class="cierre-texto" data-revela="2">${t(lang, "inicio.cierre.texto")}</p>
      <div class="cierre-botones" data-revela="3">${botonesTiendas(lang)}</div>
      <p class="cierre-enlace" data-revela="3"><a href="${rutaIdioma(lang, "/sugerir/general")}">${t(lang, "inicio.cierre.sugerir")}</a></p>
    </div>
  </section>
</div>`;

    return {
      titulo,
      descripcion: descripcionPagina,
      activa: "inicio",
      cuerpo,
      css: ["inicio"],
      js: ["paginas/inicio"],
      jsonLd: jsonLdInicio(lang, descripcionPagina),
      cache: "evento",
    };
  },
};
