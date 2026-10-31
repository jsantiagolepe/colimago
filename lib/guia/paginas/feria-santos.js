// Feria de Todos los Santos Colima 2026 (/feria-de-todos-los-santos): el programa oficial
// día por día, por lugar y los conciertos estelares. Datos de data/feria-santos.json (los
// importa scripts/importar-extras.js desde la app). La página sale completa sin JavaScript;
// public/js/paginas/feria-santos.js solo filtra por día y por lugar y arma el "Al calendario".

const { h, raw } = require("../h");
const { t, tp, urlAbsoluta, SITIO } = require("../i18n");
const { icono } = require("../componentes");
const feria = require("../../../data/feria-santos.json");

const LUGARES = new Map(feria.lugares.map((l) => [l.id, l]));

function fechaLarga(lang, fecha) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString(lang === "en" ? "en-US" : "es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
function fechaCorta(lang, fecha) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString(lang === "en" ? "en-US" : "es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
}
const hoyColima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

// Las 00:00 son de la madrugada del día siguiente: van al final del día.
const clave = (e) => (e.hora === "00:00" ? "24:00" : e.hora);
const ordenados = (eventos) => [...eventos].sort((a, b) => clave(a).localeCompare(clave(b)));

function fila(lang, dia, e) {
  const lugar = LUGARES.get(e.lugar);
  return h`<li class="fs-evento" data-dia="${dia}" data-lugar="${e.lugar}" data-hora="${e.hora}" data-nombre="${e.nombre}">
    <time class="fs-hora">${e.hora}</time>
    <span class="fs-logo"><img src="${lugar.logo}" alt="" width="40" height="40" loading="lazy" decoding="async" /></span>
    <span class="fs-texto"><span class="fs-nombre">${e.nombre}</span><span class="fs-lugar${lugar.estelar ? " estelar" : ""}">${lugar.nombre}</span></span>
  </li>`;
}

module.exports = {
  rutas: ["/feria-de-todos-los-santos"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const hoy = hoyColima();
    const rango = `${fechaCorta(lang, feria.inicio)} – ${fechaCorta(lang, feria.fin)}`;
    const total = feria.programa.reduce((n, d) => n + d.eventos.length, 0);
    const titulo = t(lang, "feriasantos.feriaSantos.title");
    const edicion = t(lang, "feriasantos.feriaSantos.edicion", { numero: feria.edicion });

    const dias = feria.programa.map((d) => h`
      <section class="fs-dia" id="dia-${d.fecha}" data-dia="${d.fecha}" aria-labelledby="t-${d.fecha}">
        <h2 id="t-${d.fecha}"><span>${fechaLarga(lang, d.fecha)}</span> <span class="etiqueta-suave">${tp(lang, "feriasantos.feriaSantos.eventos", d.eventos.length)}</span></h2>
        <ul class="filas fs-lista">${ordenados(d.eventos).map((e) => fila(lang, d.fecha, e))}</ul>
      </section>`);

    const chipsDia = feria.programa.map((d) => h`<button class="chip" type="button" data-filtro-dia="${d.fecha}" aria-pressed="false">${fechaCorta(lang, d.fecha)}</button>`);
    const chipsLugar = feria.lugares.map((l) => h`<button class="chip chip-miniatura" type="button" data-filtro-lugar="${l.id}" aria-pressed="false"><img src="${l.logo}" alt="" width="28" height="28" loading="lazy" />${l.nombre}</button>`);

    const cuerpo = h`
<div class="envoltura feria-santos" data-fs data-inicio="${feria.inicio}" data-fin="${feria.fin}" data-hoy="${hoy}">
  <header class="pagina-cab">
    <h1 class="rotulo">${titulo}</h1>
    <p class="pagina-entrada">${edicion} · ${rango}</p>
  </header>

  <div class="fs-portada"><img src="/img/feria-santos/portada.webp" alt="${titulo}, ${edicion}" width="960" height="540" fetchpriority="high" decoding="async" /></div>

  <section class="bloque" aria-labelledby="t-bienvenida">
    <details class="tarjeta fs-bienvenida">
      <summary><strong id="t-bienvenida">${t(lang, "feriasantos.feriaSantos.bienvenida")}</strong> <span class="nota">${t(lang, "feriasantos.feriaSantos.bienvenidaLeer")}</span></summary>
      <div class="fs-mensaje">
        <img src="/img/feria-santos/gobernadora.webp" alt="${feria.firmante}" width="120" height="120" loading="lazy" />
        <div class="lectura">${feria.bienvenida.split("\n\n").map((p) => h`<p>${p}</p>`)}<p><strong>${feria.firmante}</strong><br />${feria.cargoFirmante}</p></div>
      </div>
    </details>
  </section>

  <section class="bloque" aria-label="${t(lang, "feriasantos.feriaSantos.vistas")}">
    <div class="chips chips-deslizables" role="group" aria-label="${t(lang, "feriasantos.feriaSantos.elegirDia")}">
      <button class="chip" type="button" data-filtro-dia="" aria-pressed="true">${t(lang, "guiaapp.feria.todosDias")}</button>
      ${chipsDia}
    </div>
    <div class="chips chips-deslizables fs-lugares" role="group" aria-label="${t(lang, "feriasantos.feriaSantos.vista.lugares")}">
      <button class="chip" type="button" data-filtro-lugar="" aria-pressed="true">${t(lang, "feriasantos.feriaSantos.todosLosLugares")}</button>
      <button class="chip" type="button" data-filtro-estelares aria-pressed="false">${icono("estrella")}${t(lang, "feriasantos.feriaSantos.vista.estelares")}</button>
      ${chipsLugar}
    </div>
    <p class="nota fs-aviso" data-fs-aviso hidden></p>
  </section>

  <div class="fs-dias">${dias}</div>

  <p class="nota fs-vacio" data-fs-vacio hidden>${t(lang, "guiaapp.feria.sinEventos")}</p>
  <div class="pagina-acciones"><button class="btn-contorno" type="button" data-fs-ics>${icono("calendario")}<span>${t(lang, "alcalendario.toCalendar.button")}</span></button></div>
  <p class="nota" style="margin-top:20px">${total} · ${t(lang, "feriasantos.feriaSantos.edicion", { numero: feria.edicion })}</p>
</div>`;

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Festival",
        name: `${titulo} ${feria.inicio.slice(0, 4)}`,
        startDate: feria.inicio,
        endDate: feria.fin,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        isAccessibleForFree: true,
        image: `${SITIO}/img/feria-santos/portada.webp`,
        location: { "@type": "Place", name: "Recinto Ferial de Colima", address: { "@type": "PostalAddress", addressLocality: "Colima", addressRegion: "Colima", addressCountry: "MX" } },
        url: urlAbsoluta(lang, "/feria-de-todos-los-santos"),
      },
    ];

    return {
      titulo: `${titulo} ${feria.inicio.slice(0, 4)}`,
      descripcion: t(lang, "guiaapp.feria.meta", { n: total }),
      activa: "inicio",
      cuerpo,
      css: ["app", "feria-santos"],
      js: ["app", "paginas/feria-santos"],
      ns: ["feriasantos", "guiaapp", "alcalendario"],
      jsonLd,
      og: { imagen: `${SITIO}/img/feria-santos/portada.webp`, alt: titulo, tipo: "website" },
      cache: "estatico",
      robots: lang === "en" ? "noindex, follow" : undefined,
      alternos: false,
    };
  },
};
