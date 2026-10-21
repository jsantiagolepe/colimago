// Fiestas Charrotaurinas (Feria de la Villa): la ficha de la edición 2026 de
// los Festejos Charrotaurinos de Villa de Álvarez (data/feria.json).
//
// Todo el texto de la feria existe solo en español (en la app también): en la
// ruta en inglés la interfaz se traduce y el contenido queda en español, con
// lang="es" en cada bloque. Los textos largos de las "tablas" (Bienvenida y
// Reina) y de las seis tradiciones viven en <details> en la propia página, para
// que se lean y se indexen sin JavaScript; con JavaScript los enlaces del
// texto y las tablas abren esos mismos contenidos en una hoja
// (public/js/paginas/feria.js), y los carteles se amplían en un visor.

const { h, raw, json } = require("../h");
const { t, ruta, urlAbsoluta, fechaCorta, SITIO } = require("../i18n");
const D = require("../datos");
const { icono, letrero, boton, anuncio } = require("../componentes");

const F = D.feria;

// Alto (a 800 px de ancho) de cada foto: sirve para reservar el espacio y que
// la página no se mueva al cargar. Las medidas salen de public/img/feria/.
const ALTO_800 = {
  bienvenida: 714, reina: 582, petatera: 538, cabalgatas: 567, recibimientos: 484, mojigangos: 620,
  "despedida-payaso": 449, "enanitos-toreros": 401, portada: 1227,
};
const nombreArchivo = (rutaBase) => rutaBase.split("/").pop();

// Orden de los contenidos largos (los dos mensajes y las seis tradiciones).
const TEMAS = ["bienvenida", "reina", "petatera", "cabalgatas", "recibimientos", "mojigangos", "despedidaPayaso", "enanitosToreros"];

const langEs = (lang) => (lang === "en" ? raw(' lang="es"') : "");

function foto(base, { alt = "", sizes, prioridad = false } = {}) {
  const alto = ALTO_800[nombreArchivo(base)];
  return h`<img src="${base}-800.webp" srcset="${base}-480.webp 480w, ${base}-800.webp 800w" sizes="${sizes}" alt="${alt}" width="800"${alto ? raw(` height="${alto}"`) : ""} ${prioridad ? raw('fetchpriority="high"') : raw('loading="lazy" decoding="async"')} />`;
}

// "La feria": el párrafo con sus seis enlaces subrayados. En el texto los
// marcadores van como {petatera}; cada uno apunta a su contenido en la página.
function historia(lang) {
  return F.historia.es.split(/\{(\w+)\}/).map((trozo, i) => {
    if (i % 2 === 0) return trozo;
    const tema = F.temas[trozo];
    if (!tema) return trozo;
    return h`<a class="feria-enlace" href="#tema-${trozo}" data-tema="${trozo}" data-titulo="${tema.titulo}">${F.enlaces.es[trozo] || tema.titulo}</a>`;
  });
}

function textoLargo(tema) {
  return String(tema.texto).split("\n").filter(Boolean).map((p) => h`<p>${p}</p>`);
}

// Una "tabla" colgante: foto 4:5 sobre una franja de lona o de bandera.
function tabla(clave, tinta, lang) {
  const tema = F.temas[clave];
  return h`<li class="tabla-col">
    <a class="tabla-colgante tabla-${tinta}" href="#tema-${clave}" data-tema="${clave}" data-titulo="${tema.titulo}" aria-label="${t(lang, "feria.leerTema", { titulo: tema.titulo })}">
      <span class="tabla-cara">
        ${foto(tema.foto, { sizes: "(max-width: 860px) 44vw, 220px" })}
        <span class="tabla-nombre rotulo"${langEs(lang)}>${tema.titulo}</span>
      </span>
    </a>
    ${tema.autor && h`<span class="tabla-autor"${langEs(lang)}>${tema.autor}</span>`}
  </li>`;
}

function acordeon(lang) {
  return h`<div class="temas">
    ${TEMAS.map((clave) => {
      const tema = F.temas[clave];
      return h`<details class="tema">
        <summary><span class="tema-titulo"${langEs(lang)}>${tema.titulo}</span>${icono("chevron-abajo")}</summary>
        <div class="tema-cuerpo" id="tema-${clave}">
          <figure class="tema-foto">${foto(tema.foto, { sizes: "(max-width: 860px) 100vw, 560px" })}</figure>
          <div class="lectura"${langEs(lang)}>
            ${textoLargo(tema)}
            ${tema.autor && h`<p class="tema-firma">${tema.autor}</p>`}
          </div>
        </div>
      </details>`;
    })}
  </div>`;
}

function cartel(c, lang) {
  const fecha = fechaCorta(lang, `${F.edicion.anio}-${String(c.mes).padStart(2, "0")}-${String(c.dia).padStart(2, "0")}`);
  return h`<li class="cartel">
    <a href="${c.imagen}-800.webp" data-visor="carteles" data-titulo="${c.nombre}" data-fecha="${fecha}" aria-label="${t(lang, "feria.carteles.ampliar", { nombre: c.nombre, fecha })}">
      <span class="marco marco-4-5"><img src="${c.imagen}-480.webp" alt="" width="480" height="600" loading="lazy" decoding="async" /></span>
      <span class="cartel-fecha tablilla">${fecha}</span>
      <span class="cartel-nombre"${langEs(lang)}>${c.nombre}</span>
    </a>
  </li>`;
}

// Event de la edición: solo con fechas reales. Los carteles traen el día de
// cada evento del programa; el primero y el último marcan el inicio y el fin.
function jsonLdEvento(lang, url) {
  const cs = F.carteles;
  if (!cs || cs.length === 0 || !F.edicion || !F.edicion.anio) return null;
  const fecha = (c) => `${F.edicion.anio}-${String(c.mes).padStart(2, "0")}-${String(c.dia).padStart(2, "0")}`;
  const orden = [...cs].sort((a, b) => a.mes * 100 + a.dia - (b.mes * 100 + b.dia));
  const municipio = D.municipioPorId(F.municipioId);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${F.titulo} de ${F.subtitulo} ${F.edicion.anio}`,
    description: t("es", "feria.meta.descripcion", { numero: F.edicion.numero }),
    startDate: fecha(orden[0]),
    endDate: fecha(orden[orden.length - 1]),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    url,
    image: [`${SITIO}${F.portada}-800.webp`, ...orden.map((c) => `${SITIO}${c.imagen}-800.webp`)],
    location: {
      "@type": "Place",
      name: F.ubicacion.nombre,
      address: { "@type": "PostalAddress", addressLocality: municipio ? municipio.nombre : F.subtitulo, addressRegion: "Colima", addressCountry: "MX" },
      geo: { "@type": "GeoCoordinates", latitude: F.ubicacion.lat, longitude: F.ubicacion.lng },
    },
  };
}

// Los textos del visor de carteles, para el navegador.
function textosVisor(lang) {
  const v = {};
  for (const clave of ["cerrar", "anterior", "siguiente", "contador", "zoom", "zoomQuitar"]) v[clave] = t(lang, `feria.visor.${clave}`);
  return v;
}

module.exports = {
  rutas: ["/fiestas-charrotaurinas"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const municipio = D.municipioPorId(F.municipioId);
    const anio = F.edicion.anio;
    const url = urlAbsoluta(lang, "/fiestas-charrotaurinas");
    // Servicios y horario de la ficha en la app son relleno copiado de otros
    // lugares (ver docs/guia-datos.md): aquí solo se muestra lo que es de la feria.
    const mapa = F.ubicacion && Number.isFinite(F.ubicacion.lat) ? D.urlMaps(F.ubicacion.lat, F.ubicacion.lng) : null;

    const cuerpo = h`
      <div class="envoltura">
        ${letrero({
          id: "t-feria",
          texto: F.titulo,
          tinta: "lona",
          giro: -0.8,
          entrada: t(lang, "datos.feria.feriaPitch"),
        })}
      </div>

      <div class="envoltura feria">
        <div class="feria-programa">
          <div class="colgado colgado-programa">
            <a class="programa" href="${F.portada}-800.webp" data-visor="portada" data-titulo="${t(lang, "feria.portadaAlt", { anio, numero: F.edicion.numero })}" data-fecha="">
              ${foto(F.portada, { alt: t(lang, "feria.portadaAlt", { anio, numero: F.edicion.numero }), sizes: "(max-width: 860px) calc(100vw - 32px), 440px", prioridad: true })}
              <span class="programa-ampliar">${icono("ampliar")}<span>${t(lang, "feria.ampliarPrograma")}</span></span>
            </a>
          </div>
        </div>

        <div class="feria-info">
          <p class="feria-sub">
            ${municipio && h`<a class="feria-municipio" href="${ruta(lang, `/municipios/${municipio.slug}`)}">${F.subtitulo}${icono("chevron-derecha")}</a>`}
            <span class="tablilla-tenue">${t(lang, "feria.edicion", { numero: F.edicion.numero, anio })}</span>
          </p>

          <ul class="tablas colgado">
            ${tabla("bienvenida", "lona", lang)}
            ${tabla("reina", "bandera", lang)}
          </ul>

          <section class="feria-historia" aria-labelledby="t-historia">
            <h2 class="seccion-titulo" id="t-historia">${icono("bandera")}${t(lang, "datos.feria.feriaHistory")}</h2>
            <p class="lectura"${langEs(lang)}>${historia(lang)}</p>
            ${lang === "en" && t(lang, "feria.soloEspanol") && h`<p class="nota">${t(lang, "feria.soloEspanol")}</p>`}
          </section>

          <section class="feria-mas" aria-labelledby="t-mas">
            <h2 class="seccion-titulo" id="t-mas">${t(lang, "feria.masSobre")}</h2>
            <p class="nota">${t(lang, "feria.masSobreTexto")}</p>
            ${acordeon(lang)}
          </section>
        </div>
      </div>

      <section class="envoltura carteles" aria-labelledby="t-carteles">
        <div class="carteles-cabeza">
          <h2 class="seccion-titulo" id="t-carteles">${icono("calendario")}${t(lang, "datos.feria.featuredEvents")}</h2>
          <div class="carteles-flechas" hidden>
            <button class="btn-icono" type="button" data-tira="-1" aria-label="${t(lang, "feria.carteles.anterior")}">${icono("chevron-izquierda")}</button>
            <button class="btn-icono" type="button" data-tira="1" aria-label="${t(lang, "feria.carteles.siguiente")}">${icono("chevron-derecha")}</button>
          </div>
        </div>
        <ul class="carteles-tira">${F.carteles.map((c) => cartel(c, lang))}</ul>
      </section>

      <section class="envoltura visita" aria-labelledby="t-ubicacion">
        <div class="visita-lugar">
          <h2 class="seccion-titulo" id="t-ubicacion">${icono("lugar")}${t(lang, "datos.lugar.location")}</h2>
          <p class="visita-nombre tablero-titulo"${langEs(lang)}>${F.ubicacion.nombre}</p>
          <p class="lectura"${langEs(lang)}>${F.ubicacion.descripcion}</p>
          ${mapa && h`<div class="visita-mapa">${boton({ texto: t(lang, "datos.lugar.verEnMaps"), href: mapa, variante: "lona", icono: "externo", attrs: { target: "_blank", rel: "noopener" } })}</div>`}
        </div>
      </section>

      <div class="envoltura pagina-pie">
        ${anuncio({ lang, formato: "banner", indice: 0, clase: "anuncio-pie" })}
      </div>
      <script type="application/json" id="feria-textos">${json(textosVisor(lang))}</script>`;

    const evento = jsonLdEvento(lang, url);
    return {
      titulo: t(lang, "feria.meta.titulo", { anio }),
      descripcion: t(lang, "feria.meta.descripcion", { numero: F.edicion.numero }),
      ruta: "/fiestas-charrotaurinas",
      activa: "inicio",
      cache: "estatico",
      cuerpo,
      css: ["feria"],
      js: ["paginas/feria"],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Colima Go", item: `${SITIO}/` },
            { "@type": "ListItem", position: 2, name: F.titulo },
          ],
        },
        ...(evento ? [evento] : []),
      ],
    };
  },
};
