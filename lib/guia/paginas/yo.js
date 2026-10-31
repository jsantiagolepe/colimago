// Yo (/yo): el centro personal, igual que la pestaña Yo de la app: Pasaporte Colima, Mis listas,
// Mis planes, Favoritos y Ajustes. Todo lo personal (sellos, listas, planes) se guarda en este
// navegador (localStorage); nada de eso pasa por el servidor. Las páginas son cascarones: los pinta
// public/js/paginas/yo.js.
const { h } = require("../h");
const { t, ruta } = require("../i18n");
const { icono } = require("../componentes");

const VISTAS = {
  "/yo": { vista: "hub", titulo: (lang) => t(lang, "yo.me.title") },
  "/yo/pasaporte": { vista: "pasaporte", titulo: (lang) => t(lang, "pasaporte.passport.title") },
  "/yo/listas": { vista: "listas", titulo: (lang) => t(lang, "listas.lists.title") },
  "/yo/planes": { vista: "planes", titulo: (lang) => t(lang, "planes.plan.listTitle") },
};

function entrada(lang, vista) {
  if (vista === "hub") return "";
  return { pasaporte: t(lang, "pasaporte.passport.intro"), listas: t(lang, "listas.lists.hint"), planes: t(lang, "planes.plan.listHint") }[vista];
}

module.exports = {
  rutas: Object.keys(VISTAS),
  async pagina(req, ctx) {
    const { lang } = ctx;
    const def = VISTAS[req.path.replace(/(.)\/$/, "$1")];
    if (!def) return { status: 404 };
    const hub = def.vista === "hub";
    const cuerpo = h`
<div class="envoltura-lectura yo" data-yo="${def.vista}">
  ${!hub && h`<nav class="migas"><a href="${ruta(lang, "/yo")}">${icono("chevron-izquierda")}${t(lang, "yo.me.title")}</a></nav>`}
  <header class="pagina-cab"><h1 class="rotulo">${def.titulo(lang)}</h1>${entrada(lang, def.vista) && h`<p class="pagina-entrada">${entrada(lang, def.vista)}</p>`}</header>
  ${hub ? h`
  <div class="filas" style="margin-bottom:28px">
    <a class="fila" href="${ruta(lang, "/yo/pasaporte")}"><span class="fila-icono">${icono("pasaporte")}</span><span class="fila-texto"><span class="fila-titulo">${t(lang, "pasaporte.passport.title")}</span><span class="fila-sub" data-resumen="pasaporte">${t(lang, "yo.me.passportHint")}</span></span>${icono("chevron-derecha")}</a>
    <a class="fila" href="${ruta(lang, "/yo/listas")}"><span class="fila-icono">${icono("marcador")}</span><span class="fila-texto"><span class="fila-titulo">${t(lang, "listas.lists.title")}</span><span class="fila-sub" data-resumen="listas">${t(lang, "listas.lists.rowHint")}</span></span>${icono("chevron-derecha")}</a>
    <a class="fila" href="${ruta(lang, "/yo/planes")}"><span class="fila-icono">${icono("calendario")}</span><span class="fila-texto"><span class="fila-titulo">${t(lang, "planes.plan.listTitle")}</span><span class="fila-sub" data-resumen="planes">${t(lang, "planes.plan.cardHint")}</span></span>${icono("chevron-derecha")}</a>
    <a class="fila" href="${ruta(lang, "/favoritos")}"><span class="fila-icono">${icono("corazon")}</span><span class="fila-texto"><span class="fila-titulo">${t(lang, "comun.nav.favoritos")}</span></span>${icono("chevron-derecha")}</a>
    <a class="fila" href="${ruta(lang, "/ajustes")}"><span class="fila-icono">${icono("ajustes")}</span><span class="fila-texto"><span class="fila-titulo">${t(lang, "yo.me.settings")}</span></span>${icono("chevron-derecha")}</a>
  </div>` : h`<div data-contenido><p class="estado-inline">${t(lang, "comun.cargando")}</p></div>`}
</div>`;
    return { titulo: def.titulo(lang), descripcion: t(lang, "guiaapp.yo.meta"), activa: "yo", cuerpo, css: ["app", "yo", "gastronomia"], js: ["app", "mis", "paginas/yo"], ns: ["yo", "pasaporte", "listas", "planes", "alcalendario", "guiaapp", "buscar"], robots: "noindex, follow", cache: "estatico" };
  },
};
