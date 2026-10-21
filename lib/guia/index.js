// Guía web de Colima Go: monta las páginas (es y en), la API JSON del
// navegador (/g/*) y el sitemap en la app de Express.
//
//   const montarGuia = require("./lib/guia");
//   montarGuia(app);   // en server.js, antes de express.static y del 404
//
// Cada página es un módulo de lib/guia/paginas/ con esta forma:
//
//   module.exports = {
//     rutas: ["/explorar"],                 // patrones de Express, sin prefijo de idioma
//     async pagina(req, ctx) {              // ctx: { lang, t(clave, vars), ruta(path) }
//       return { titulo, descripcion, activa, cuerpo, css, js, jsonLd, robots, og,
//                cache: "estatico" | "evento" | "ninguno",
//                status: 404 }              // 404 → cae al 404 del sitio
//       // o { redirigir: "/otra", status: 301 }
//     },
//   };
//
// Las páginas salen siempre en su versión anónima y cacheable por la CDN: lo
// que depende de la persona (sesión, me gusta, favoritos) lo completa el
// navegador con public/js/core.js. El navegador nunca habla con el backend:
// todo pasa por /g/* (lib/guia/api.js).

const express = require("express");
const { layout } = require("./layout");
const { t, ruta: rutaIdioma } = require("./i18n");
const { h } = require("./h");

// Las páginas se listan con require estático (Vercel empaqueta lo que ve).
// Una página que aún no existe se omite sin romper las demás.
const PAGINAS = [
  () => require("./paginas/inicio"),
  () => require("./paginas/explorar"),
  () => require("./paginas/calendario"),
  () => require("./paginas/favoritos"),
  () => require("./paginas/ajustes"),
  () => require("./paginas/acerca-de"),
  () => require("./paginas/rincones"),
  () => require("./paginas/playas"),
  () => require("./paginas/municipios"),
  () => require("./paginas/fiestas-pueblo"),
  () => require("./paginas/feria"),
  () => require("./paginas/tianguis"),
  () => require("./paginas/lugar"),
  () => require("./paginas/evento"),
  () => require("./paginas/sugerir"),
];

const CACHE = {
  // Contenido que solo cambia con un despliegue.
  estatico: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  // Eventos del backend: un minuto fresco, diez de reserva.
  evento: "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
  ninguno: "no-store",
};

function paginaError(lang) {
  const cuerpo = h`<div class="envoltura"><div class="estado-vista" style="padding-block:96px">
    <h1 class="rotulo" style="font-size:40px">${t(lang, "comun.errorTitulo")}</h1>
    <p>${t(lang, "comun.errorMensaje")}</p>
    <a class="btn-pintado" href="${rutaIdioma(lang, "/inicio")}"><span>${t(lang, "comun.volverInicio")}</span></a>
  </div></div>`;
  return layout({ lang, ruta: "/inicio", titulo: t(lang, "comun.errorTitulo"), descripcion: t(lang, "comun.errorMensaje"), cuerpo, robots: "noindex, follow", alternos: false });
}

function manejador(modulo) {
  return async (req, res, next) => {
    const lang = req.lang || "es";
    const ctx = { lang, t: (clave, vars) => t(lang, clave, vars), ruta: (destino) => rutaIdioma(lang, destino) };
    try {
      const r = await modulo.pagina(req, ctx);
      if (!r || r.status === 404) return next();
      if (r.redirigir) return res.redirect(r.status || 301, r.redirigir);
      const html = layout({ lang, ruta: r.ruta || req.path, consulta: r.consulta || "", ...r });
      res
        .status(r.status || 200)
        .set("Cache-Control", CACHE[r.cache || "estatico"] || CACHE.estatico)
        .type("html")
        .send(html);
    } catch (err) {
      console.error(`Error en la página ${req.originalUrl}:`, err);
      res.status(500).set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex").type("html").send(paginaError(lang));
    }
  };
}

function montarGuia(app) {
  // API JSON del navegador (la entrega lib/guia/api.js).
  try {
    app.use("/g", require("./api"));
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND") throw err;
    console.warn("Guía: falta lib/guia/api.js; las funciones de cuenta no estarán disponibles.");
  }

  const paginas = express.Router();
  for (const cargar of PAGINAS) {
    let modulo;
    try {
      modulo = cargar();
    } catch (err) {
      // Solo se omite si lo que falta es la propia página (la primera línea del
      // mensaje nombra el módulo que no se encontró; el resto es la pila).
      if (err.code === "MODULE_NOT_FOUND" && /\.\/paginas\//.test(err.message.split("\n")[0])) continue;
      throw err;
    }
    for (const patron of modulo.rutas) paginas.get(patron, manejador(modulo));
  }

  // Inglés bajo /en; español en la raíz. /en a secas lleva al inicio.
  const idioma = (lang) => (req, res, next) => {
    req.lang = lang;
    next();
  };
  app.get("/en", (req, res) => res.redirect(302, "/en/inicio"));
  app.use("/en", idioma("en"), paginas);
  app.use(idioma("es"), paginas);

  // ads.txt de AdSense: solo existe cuando ADSENSE_CLIENT está configurado.
  const publicador = /^ca-(pub-\d+)$/.exec(process.env.ADSENSE_CLIENT || "");
  if (publicador) {
    app.get("/ads.txt", (req, res) => {
      res.set("Cache-Control", "public, max-age=0, s-maxage=3600");
      res.type("text/plain").send(`google.com, ${publicador[1]}, DIRECT, f08c47fec0942fa0\n`);
    });
  }

  try {
    const { sitemap } = require("./sitemap");
    app.get("/sitemap.xml", sitemap);
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND") throw err;
  }
}

module.exports = montarGuia;
