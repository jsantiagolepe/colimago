// Buscar (/buscar): lugares, eventos, la feria, fiestas del pueblo y gastronomía, con filtros.
// La página es un cascarón; public/js/paginas/buscar.js busca en /catalogo-<idioma>.json.

const { h } = require("../h");
const { t } = require("../i18n");
const { icono } = require("../componentes");

const TABS = ["all", "lugar", "evento", "feria", "fiesta", "platillo"];

module.exports = {
  rutas: ["/buscar"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const cuerpo = h`
<div class="envoltura-lectura buscar" data-buscar>
  <header class="pagina-cab"><h1 class="rotulo">${t(lang, "buscar.search.open")}</h1></header>
  <form class="campo-buscar" role="search" onsubmit="return false">
    ${icono("buscar")}
    <label class="sr-only" for="q">${t(lang, "buscar.search.open")}</label>
    <input id="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="${t(lang, "buscar.search.placeholder")}" value="${String(req.query.q || "").slice(0, 80)}" />
  </form>
  <div class="chips chips-deslizables" style="margin-top:14px" role="tablist" aria-label="${t(lang, "buscar.search.filtersLabel")}">
    ${TABS.map((x, i) => h`<button class="chip" type="button" role="tab" data-tab="${x}" aria-selected="${i === 0}">${t(lang, `buscar.search.tab.${x}`)}</button>`)}
  </div>
  <div class="chips" style="margin-top:10px" aria-label="${t(lang, "buscar.search.filtersLabel")}">
    <button class="chip" type="button" data-filtro="semana" aria-pressed="false">${t(lang, "buscar.search.filter.esteSemana")}</button>
  </div>
  <div class="buscar-res" data-res aria-live="polite">
    <div class="estado-vista"><span class="ev-icono">${icono("buscar")}</span><h2>${t(lang, "buscar.search.hintTitle")}</h2><p>${t(lang, "buscar.search.hint")}</p></div>
  </div>
</div>`;
    return { titulo: t(lang, "buscar.search.open"), descripcion: t(lang, "guiaapp.buscar.meta"), activa: "inicio", cuerpo, css: ["app"], js: ["app", "paginas/buscar"], ns: ["buscar", "guiaapp"], robots: "noindex, follow", cache: "estatico" };
  },
};
