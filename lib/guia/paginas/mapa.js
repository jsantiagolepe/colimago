// Mapa (/mapa): todo el catálogo con pines por categoría, sobre OpenStreetMap (Leaflet).
const { h } = require("../h");
const { t } = require("../i18n");
const { icono } = require("../componentes");

const CATS = ["playas", "rios", "naturaleza", "cultura", "mercados", "comer", "dormir"];

module.exports = {
  rutas: ["/mapa"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const cuerpo = h`
<div class="envoltura mapa-general" data-mapa>
  <header class="pagina-cab"><h1 class="rotulo">${t(lang, "mapa.map.title")}</h1><p class="pagina-entrada">${t(lang, "mapa.map.cardHint")}</p></header>
  <div class="chips chips-deslizables" role="group" aria-label="${t(lang, "mapa.map.categoriesLabel")}">
    <button class="chip" type="button" data-cat="" aria-pressed="true">${t(lang, "mapa.map.all")}</button>
    ${CATS.map((c) => h`<button class="chip" type="button" data-cat="${c}" aria-pressed="false"><i class="pin pin-${c}"></i>${t(lang, `mapa.map.cat.${c}`)}</button>`)}
  </div>
  <div class="mapa-lienzo" id="mapa-lienzo" role="application" aria-label="${t(lang, "mapa.map.title")}"></div>
  <div class="pagina-acciones"><button class="btn-contorno" type="button" data-yo>${icono("ubicacion")}<span>${t(lang, "mapa.map.seeNearby")}</span></button></div>
  <noscript><p class="nota">${t(lang, "guiaapp.mapa.sinJs")}</p></noscript>
</div>`;
    return {
      titulo: t(lang, "mapa.map.title"), descripcion: t(lang, "guiaapp.mapa.meta"), activa: "inicio", cuerpo,
      css: ["app", "mapa", "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"],
      js: ["app", "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js", "paginas/mapa"], ns: ["mapa", "guiaapp"], cache: "estatico",
    };
  },
};
