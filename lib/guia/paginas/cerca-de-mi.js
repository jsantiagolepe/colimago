// Cerca de mí (/cerca-de-mi): lugares del catálogo ordenados por distancia. La ubicación se
// pide en el navegador al abrir la página y no se envía ni se guarda en ningún lado.
const { h } = require("../h");
const { t } = require("../i18n");
const { icono } = require("../componentes");

module.exports = {
  rutas: ["/cerca-de-mi"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const cuerpo = h`
<div class="envoltura-lectura cerca" data-cerca>
  <header class="pagina-cab"><h1 class="rotulo">${t(lang, "cerca.nearby.title")}</h1><p class="pagina-entrada">${t(lang, "cerca.nearby.cardHint")}</p></header>
  <div class="chips" role="group" aria-label="${t(lang, "cerca.nearby.radiusLabel")}" data-radios hidden></div>
  <div data-estado class="estado-inline" role="status">${t(lang, "cerca.nearby.loading")}</div>
  <div data-lista></div>
</div>`;
    return { titulo: t(lang, "cerca.nearby.title"), descripcion: t(lang, "guiaapp.cerca.meta"), activa: "inicio", cuerpo, css: ["app"], js: ["app", "paginas/cerca-de-mi"], ns: ["cerca", "guiaapp", "buscar"], robots: "noindex, follow", cache: "estatico" };
  },
};
