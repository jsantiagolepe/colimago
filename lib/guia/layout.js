// Marco HTML de todas las páginas de la guía: <head>, barra superior, barra de
// pestañas (móvil), pie, avisos y scripts globales.
//
//   layout({ lang, ruta, titulo, descripcion, activa, cuerpo, css, js, jsonLd, robots, og })
//
// - ruta: path SIN prefijo de idioma ("/explorar"); sirve para el canonical y
//   los enlaces es/en. `consulta` (opcional) es el query string a conservar.
// - activa: pestaña resaltada: "inicio" | "explorar" | "calendario" | "favoritos" | "ajustes".
// - css / js: archivos propios de la página, relativos a /css/paginas y /js/paginas.
// - jsonLd: objetos schema.org (se serializan con json()).

const { h, raw, esc, json } = require("./h");
const { t, ruta: rutaIdioma, urlAbsoluta, espacio, SITIO } = require("./i18n");
const { sprite } = require("./iconos");
const { icono, ADSENSE_ACTIVO, ADSENSE_CLIENT } = require("./componentes");

// Mismo client id público que usa la portada para el login (no es secreto).
const GOOGLE_CLIENT_ID_WEB =
  process.env.GOOGLE_CLIENT_ID_WEB || "1099296294747-n5pk9f851nee646ce5vo437cp9ted6ms.apps.googleusercontent.com";

// Para que un despliegue nuevo no sirva CSS/JS viejos desde la caché.
const VERSION = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);

const PESTANAS = [
  { clave: "favoritos", icono: "corazon" },
  { clave: "explorar", icono: "brujula" },
  { clave: "inicio", icono: "inicio" },
  { clave: "calendario", icono: "calendario" },
  { clave: "ajustes", icono: "ajustes" },
];
const ENLACES_ESCRITORIO = ["inicio", "explorar", "calendario", "favoritos", "ajustes"];

// Páginas de información. La política de privacidad, las condiciones y el
// contacto viven en este mismo dominio (en inglés tienen otro nombre: ver
// RUTAS_EN en i18n.js); el EULA es de la app y sigue en su sitio externo.
const EULA = "https://sites.google.com/view/eula-colimaapp/inicio";
function legales(lang) {
  return {
    privacidad: rutaIdioma(lang, "/privacidad"),
    condiciones: rutaIdioma(lang, "/terminos"),
    contacto: rutaIdioma(lang, "/contacto"),
    eula: EULA,
  };
}
const CORREO = "colimago.app@gmail.com";
const REDES = {
  facebook: "https://www.facebook.com/colimago",
  instagram: "https://www.instagram.com/colimaapp",
  tiktok: "https://www.tiktok.com/@colimaapp",
};

// Tema antes de pintar (evita el destello): lo guardado gana; si no, el del sistema.
const ARRANQUE_TEMA = `(function(){var t=null;try{t=localStorage.getItem('colimago-tema')}catch(e){}if(t==='claro'||t==='oscuro')document.documentElement.dataset.tema=t;document.documentElement.classList.add('js')})();`;

function cabeza({ lang, ruta, consulta = "", titulo, descripcion, robots, og = {}, css = [], jsonLd = [], canonical, alternos = true }) {
  const completo = titulo.includes("Colima Go") ? titulo : `${titulo} | Colima Go`;
  const url = canonical || `${urlAbsoluta(lang, ruta)}${consulta}`;
  const imagen = og.imagen || `${SITIO}/og-colima-go.jpg`;
  const locale = lang === "en" ? "en_US" : "es_MX";
  return h`
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${completo}</title>
<meta name="description" content="${descripcion}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="${robots}" />
${alternos && h`<link rel="alternate" hreflang="es-MX" href="${urlAbsoluta("es", ruta)}" />
<link rel="alternate" hreflang="en" href="${urlAbsoluta("en", ruta)}" />
<link rel="alternate" hreflang="x-default" href="${urlAbsoluta("es", ruta)}" />`}
<meta name="theme-color" content="#0e1119" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#f4f4f1" media="(prefers-color-scheme: light)" />
<link rel="icon" href="/img/perro-de-colima.webp" type="image/webp" />
<link rel="apple-touch-icon" href="/img/perro-de-colima.webp" />
<meta property="og:type" content="${og.tipo || "website"}" />
<meta property="og:site_name" content="Colima Go" />
<meta property="og:locale" content="${locale}" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${completo}" />
<meta property="og:description" content="${descripcion}" />
<meta property="og:image" content="${imagen}" />
${og.alt && h`<meta property="og:image:alt" content="${og.alt}" />`}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${completo}" />
<meta name="twitter:description" content="${descripcion}" />
<meta name="twitter:image" content="${imagen}" />
<meta name="apple-itunes-app" content="app-id=1665801713" />
${ADSENSE_ACTIVO && h`<meta name="google-adsense-account" content="${ADSENSE_CLIENT}" />`}
<script>${raw(ARRANQUE_TEMA)}</script>
<link rel="preload" as="font" href="/fonts/barlow-400.woff2" type="font/woff2" crossorigin>
<link rel="preload" as="font" href="/fonts/shrikhand-400.woff2" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/guia.css?v=${VERSION}" />
${css.map((c) => h`<link rel="stylesheet" href="/css/paginas/${c}.css?v=${VERSION}" />`)}
${jsonLd.map((d) => h`<script type="application/ld+json">${json(d)}</script>`)}`;
}

// aria-current="page" solo en la ruta exacta de la pestaña; en sus páginas
// internas (un lugar, un municipio…) la pestaña es el "ancestro": "true".
function marcaActual(clave, activa, ruta) {
  if (activa !== clave) return raw("");
  return raw(` aria-current="${ruta === `/${clave}` ? "page" : "true"}"`);
}

function barra({ lang, ruta, consulta, activa }) {
  const otro = lang === "es" ? "en" : "es";
  return h`
<nav class="barra" aria-label="${t(lang, "comun.navPrincipal")}">
  <div class="envoltura">
    <a class="marca" href="${rutaIdioma(lang, "/inicio")}" aria-label="Colima Go, ${t(lang, "comun.nav.inicio")}">
      <span class="perro" aria-hidden="true"></span>
      <span class="marca-nombre">Colima <span>Go</span></span>
    </a>
    <ul class="distritos">
      ${ENLACES_ESCRITORIO.map((k) => h`<li><a href="${rutaIdioma(lang, `/${k}`)}"${marcaActual(k, activa, ruta)}>${t(lang, `comun.nav.${k}`)}</a></li>`)}
    </ul>
    <div class="barra-acciones">
      <a class="btn-idioma" href="${rutaIdioma(otro, ruta)}${consulta || ""}" hreflang="${otro}" lang="${otro}" aria-label="${t(lang, "comun.cambiarIdioma")}">${otro.toUpperCase()}</a>
      <button class="interruptor" id="interruptor" type="button" aria-label="${t(lang, "comun.temaOscuro")}" data-aria-claro="${t(lang, "comun.temaClaro")}" data-aria-oscuro="${t(lang, "comun.temaOscuro")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path class="vidrio" d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/></svg>
      </button>
      <a class="btn-icono btn-usuario" id="btn-usuario" href="${rutaIdioma(lang, "/ajustes")}" aria-label="${t(lang, "comun.miCuenta")}">${icono("usuario")}</a>
      <a class="btn-pintado btn-descargar-nav" href="/app">${t(lang, "comun.descargar")}</a>
    </div>
  </div>
</nav>`;
}

function pestanas({ lang, activa, ruta }) {
  return h`
<nav class="pestanas-app" aria-label="${t(lang, "comun.navSecciones")}">
  <ul>
    ${PESTANAS.map(({ clave, icono: ic }) => h`<li><a href="${rutaIdioma(lang, `/${clave}`)}"${marcaActual(clave, activa, ruta)}>${icono(ic)}<span>${t(lang, `comun.nav.${clave}`)}</span></a></li>`)}
  </ul>
</nav>`;
}

function pie({ lang }) {
  const L = legales(lang);
  return h`
<footer class="pie">
  <div class="envoltura">
    <a class="marca" href="/" aria-label="Colima Go, ${t(lang, "comun.portada")}">
      <span class="perro" aria-hidden="true"></span>
      <span class="marca-nombre">Colima <span>Go</span></span>
    </a>
    <nav class="pie-enlaces" aria-label="${t(lang, "comun.pieNav")}">
      <a href="${rutaIdioma(lang, "/acerca-de")}">${t(lang, "comun.acercaDe")}</a>
      <a href="${L.privacidad}">${t(lang, "comun.privacidad")}</a>
      <a href="${L.condiciones}">${t(lang, "comun.condiciones")}</a>
      <a href="${L.contacto}">${t(lang, "comun.contacto")}</a>
      <a href="${L.eula}" target="_blank" rel="noopener">EULA<span class="sr-only"> (${t(lang, "comun.seAbreEnPestana")})</span></a>
    </nav>
    <p>© Colima 360 — ${t(lang, "comun.derechos")}</p>
  </div>
</footer>`;
}

function layout(ctx) {
  const {
    lang = "es",
    ruta = "/",
    consulta = "",
    titulo,
    descripcion,
    activa,
    cuerpo,
    css = [],
    js = [],
    jsonLd = [],
    robots = "index, follow, max-image-preview:large",
    og,
    clase = "",
    canonical,
    alternos,
    sinPie = false,
  } = ctx;

  const config = {
    lang,
    base: rutaIdioma(lang, "/"),
    googleClientId: GOOGLE_CLIENT_ID_WEB,
    anuncios: ADSENSE_ACTIVO ? ADSENSE_CLIENT : null,
    legales: legales(lang),
    textos: espacio(lang, "cliente"),
  };

  return String(h`<!DOCTYPE html>
<html lang="${lang === "en" ? "en" : "es-MX"}">
<head>
${cabeza({ lang, ruta, consulta, titulo, descripcion, robots, og, css, jsonLd, canonical, alternos })}
</head>
<body class="${clase}">
${raw(sprite())}
<a class="saltar" href="#contenido">${t(lang, "comun.saltar")}</a>
${barra({ lang, ruta, consulta, activa })}
<main id="contenido">
${cuerpo}
</main>
${!sinPie && pie({ lang })}
${pestanas({ lang, activa, ruta })}
<div class="toasts" id="toasts" role="status" aria-live="polite" aria-atomic="false"></div>
<script>window.COLIMAGO=${json(config)};</script>
<script src="/js/core.js?v=${VERSION}" defer></script>
${js.map((j) => h`<script src="/js/${j}.js?v=${VERSION}" defer></script>`)}
${ADSENSE_ACTIVO && h`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`}
</body>
</html>`);
}

module.exports = { layout, GOOGLE_CLIENT_ID_WEB, legales, CORREO, REDES, VERSION };
