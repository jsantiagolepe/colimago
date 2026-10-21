// /favoritos: lo que la persona guardó con el corazón.
//
// El servidor siempre responde la misma página anónima (cache "ninguno" y
// robots noindex): la lista vive en el navegador (localStorage, vía
// Colima.favoritos de core.js) y, con sesión, también en la cuenta.
// public/js/paginas/favoritos.js pinta las tarjetas; aquí van el contenedor,
// el estado vacío, un cargando-focos y los bloques de anuncio como <template>.

const { h, json } = require("../h");
const { t, ruta, MESES } = require("../i18n");
const { letrero, estadoVista, cargandoFocos, anuncio } = require("../componentes");

module.exports = {
  rutas: ["/favoritos"],
  async pagina(req, ctx) {
    const { lang } = ctx;

    // Textos y enlaces que el script necesita para pintar las tarjetas.
    const cliente = {
      lang,
      base: ruta(lang, "/"),
      meses: MESES[lang],
      fechaDia: t(lang, "favoritos.fechaDia"),
      t: {
        lugar: t(lang, "favoritos.lugar"),
        evento: t(lang, "favoritos.evento"),
        borrar: t(lang, "favoritos.borrar"),
        borrarAria: t(lang, "favoritos.borrarAria"),
        sinFoto: t(lang, "favoritos.sinFoto"),
        cuenta: { uno: t(lang, "favoritos.cuenta.uno"), otros: t(lang, "favoritos.cuenta.otros") },
      },
    };

    const cuerpo = h`
<div class="favoritos">
  <div class="favoritos-envoltura">
    ${letrero({ id: "t-favoritos", texto: t(lang, "favoritos.titulo"), tinta: "bandera", giro: -0.9, entrada: t(lang, "favoritos.entrada"), focos: 34, comba: 0.5 })}
    <div class="favoritos-sesion" data-aviso-sesion>
      <p data-sin-sesion>${t(lang, "favoritos.sinSesion")}</p>
      <p data-con-sesion hidden>${t(lang, "favoritos.conSesion")}</p>
      <button class="btn-contorno" type="button" data-accion="iniciar-sesion" data-motivo="pitchGeneral" data-sin-sesion>${t(lang, "favoritos.iniciarSesion")}</button>
    </div>
    <section class="favoritos-cuerpo" aria-labelledby="t-lista">
      <h2 class="sr-only" id="t-lista">${t(lang, "favoritos.lista")}</h2>
      <p class="favoritos-cuenta nota" data-cuenta hidden></p>
      <div id="favoritos-lista" data-favoritos aria-live="polite" aria-busy="true">
        ${cargandoFocos()}
        <noscript><p class="nota">${t(lang, "favoritos.sinJs")}</p></noscript>
      </div>
    </section>
  </div>
  <script type="application/json" id="favoritos-datos">${json(cliente)}</script>
  <template id="tpl-vacio">${estadoVista({ icono: "corazon", titulo: t(lang, "favoritos.vacioTitulo"), mensaje: t(lang, "favoritos.vacioTexto"), accion: { texto: t(lang, "favoritos.explorar"), href: ctx.ruta("/explorar"), variante: "foco" } })}</template>
  <template id="tpl-anuncio-banner">${anuncio({ lang, formato: "banner", indice: 0 })}</template>
  <template id="tpl-anuncio-infeed">${anuncio({ lang, formato: "infeed", indice: 1 })}</template>
</div>`;

    return {
      titulo: t(lang, "favoritos.metaTitulo"),
      descripcion: t(lang, "favoritos.metaDescripcion"),
      activa: "favoritos",
      cuerpo,
      css: ["favoritos"],
      js: ["paginas/favoritos"],
      robots: "noindex, follow",
      cache: "ninguno",
    };
  },
};
