// Política de privacidad: /privacidad (en inglés, /en/privacy). Vive en el
// propio dominio porque AdSense la busca ahí, y dice cómo funciona la publicidad
// de Google. El texto está en data/i18n/<idioma>/privacidad.json; la plantilla
// es la de lib/guia/paginas/legal-vista.js.

const { paginaLegal } = require("./legal-vista");

module.exports = {
  rutas: ["/privacidad", "/privacy"],
  async pagina(req, ctx) {
    return paginaLegal({ lang: ctx.lang, espacio: "privacidad", rutaPagina: "/privacidad", tinta: "bandera", giro: -0.8 });
  },
};
