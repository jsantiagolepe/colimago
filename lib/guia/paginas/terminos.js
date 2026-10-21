// Condiciones de uso: /terminos (en inglés, /en/terms). El texto está en
// data/i18n/<idioma>/terminos.json; la plantilla es la de
// lib/guia/paginas/legal-vista.js.

const { paginaLegal } = require("./legal-vista");

module.exports = {
  rutas: ["/terminos", "/terms"],
  async pagina(req, ctx) {
    return paginaLegal({ lang: ctx.lang, espacio: "terminos", rutaPagina: "/terminos", tinta: "lona", giro: 0.9 });
  },
};
