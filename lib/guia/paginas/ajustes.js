// Ajustes (/ajustes) y Cuenta (/ajustes/cuenta).
//
// Se sirven siempre anónimas (invitado) y con cache "ninguno": lo personal (la
// tarjeta de cuenta, "Cerrar sesión", eliminar cuenta, la apariencia elegida)
// lo completa public/js/paginas/ajustes.js en el navegador.
//
// Sin anuncios (regla de la app y de AdSense: nunca en ajustes ni formularios).

const { h, raw, json } = require("../h");
const { t, ruta: rutaIdioma } = require("../i18n");
const { icono, letrero, boton, TIENDAS } = require("../componentes");
const { urlMessenger } = require("../datos");
const { fila, grupo } = require("./ajustes-filas");

const ENLACE_INVITAR = "https://www.colimago.mx/app?utm_source=web&utm_medium=share&utm_campaign=ajustes";
const RESENA = {
  ios: `${TIENDAS.ios}?action=write-review`,
  android: `${TIENDAS.android}&showAllReviews=true`,
};

// ---------- Ajustes ----------

function tarjetaCuenta(lang) {
  return h`<section class="cuenta-tarjeta" data-cuenta aria-label="${t(lang, "ajustes.tarjeta.etiqueta")}">
    <div class="cuenta-estado" data-estado="invitado">
      <span class="cuenta-medallon"><span class="perro" aria-hidden="true"></span></span>
      <h2 class="cuenta-titulo">${t(lang, "ajustes.tarjeta.invitado")}</h2>
      <p class="cuenta-texto">${t(lang, "ajustes.tarjeta.invitadoTexto")}</p>
      ${boton({ texto: t(lang, "ajustes.tarjeta.iniciar"), variante: "foco", attrs: { "data-accion": "iniciar-sesion" } })}
    </div>
    <div class="cuenta-estado" data-estado="sesion" hidden>
      <span class="cuenta-medallon" data-medallon><span class="perro" aria-hidden="true"></span></span>
      <h2 class="cuenta-titulo" data-nombre>${t(lang, "ajustes.tarjeta.sinNombre")}</h2>
      <p class="cuenta-texto cuenta-correo" data-correo hidden></p>
    </div>
  </section>`;
}

function controlApariencia(lang) {
  const opcion = (valor, clave) => h`<label class="opcion"><input type="radio" name="apariencia" value="${valor}" /><span>${t(lang, `ajustes.preferencias.${clave}`)}</span></label>`;
  return h`<div class="opciones seg" role="radiogroup" aria-label="${t(lang, "ajustes.preferencias.grupoApariencia")}" data-apariencia hidden>
      ${opcion("sistema", "sistema")}${opcion("oscuro", "noche")}${opcion("claro", "dia")}
    </div>
    <p class="fila-estado" role="status" aria-live="polite" data-apariencia-estado></p>`;
}

function cuerpoAjustes(lang) {
  const L = (clave) => t(lang, `ajustes.${clave}`);
  const externo = L("externo");
  const otro = lang === "es" ? "en" : "es";

  const grupoColima = grupo({
    id: "g-colima",
    titulo: L("colima.titulo"),
    filas: [
      fila({ href: urlMessenger(L("colima.ideaMensaje")), externo: true, externoTexto: externo, icono: "foco", titulo: L("colima.idea"), sub: L("colima.ideaSub") }),
      fila({
        boton: true,
        attrs: { "data-accion": "compartir", "data-url": ENLACE_INVITAR, "data-texto": t(lang, "comun.invitarMensaje"), "data-titulo": "Colima Go" },
        icono: "compartir",
        titulo: L("colima.invitar"),
        sub: L("colima.invitarSub"),
        flecha: false,
      }),
      fila({
        icono: "estrella",
        titulo: L("colima.calificar"),
        sub: L("colima.calificarSub"),
        fin: h`<a class="btn-icono" href="${RESENA.ios}" target="_blank" rel="noopener" aria-label="${L("colima.appStore")} (${externo})">${icono("apple")}</a><a class="btn-icono" href="${RESENA.android}" target="_blank" rel="noopener" aria-label="${L("colima.googlePlay")} (${externo})">${icono("google-play")}</a>`,
        claseExtra: "fila-calificar",
      }),
      fila({ href: rutaIdioma(lang, "/acerca-de"), icono: "info", titulo: L("colima.acerca") }),
    ],
  });

  const grupoPreferencias = grupo({
    id: "g-preferencias",
    titulo: L("preferencias.titulo"),
    filas: [
      fila({
        href: rutaIdioma(otro, "/ajustes"),
        attrs: { hreflang: otro },
        icono: "idioma",
        titulo: L("preferencias.idioma"),
        sub: L("preferencias.idiomaSub"),
        valor: L("preferencias.idiomaActual"),
      }),
      fila({ icono: "luna", titulo: L("preferencias.apariencia"), sub: L("preferencias.aparienciaSub"), control: controlApariencia(lang) }),
      fila({ href: rutaIdioma(lang, "/ajustes/cuenta"), icono: "usuario", titulo: L("preferencias.cuenta"), sub: L("preferencias.cuentaSub") }),
    ],
  });

  const grupoSesion = grupo({
    id: "g-sesion",
    titulo: L("sesion.titulo"),
    oculto: true,
    filas: [fila({ boton: true, attrs: { "data-accion": "cerrar-sesion" }, icono: "salir", titulo: L("sesion.cerrar"), flecha: false, peligro: true })],
  });

  return h`
<div class="envoltura">
  ${letrero({ id: "t-ajustes", texto: L("letrero"), tinta: "lona", giro: -0.8, nivel: 1, compacto: true })}
  <div class="ajustes">
    ${tarjetaCuenta(lang)}
    <div class="ajustes-grupos">
      ${grupoColima}
      ${grupoPreferencias}
      ${grupoSesion}
    </div>
  </div>
</div>
<script type="application/json" id="ajustes-textos">${json({
    ahoraNoche: L("preferencias.ahoraNoche"),
    ahoraDia: L("preferencias.ahoraDia"),
  })}</script>`;
}

// ---------- Cuenta ----------

function cuerpoCuenta(lang) {
  const L = (clave) => t(lang, `ajustes.cuenta.${clave}`);
  return h`
<div class="envoltura">
  ${letrero({
    id: "t-cuenta",
    texto: L("letrero"),
    tinta: "bandera",
    giro: -0.7,
    nivel: 1,
    compacto: true,
    extra: h`<a class="btn-texto cuenta-volver" href="${rutaIdioma(lang, "/ajustes")}">${icono("flecha-izquierda")}<span>${L("volver")}</span></a>`,
  })}
  <div class="cuenta-pagina">
    <p class="cuenta-sesion-como" data-sesion-como hidden></p>
    <section class="zona-peligro" aria-labelledby="zp-titulo">
      <span class="zp-icono">${icono("bote")}</span>
      <div class="zp-cuerpo">
        <h2 class="zp-titulo" id="zp-titulo">${L("eliminar")}</h2>
        <p class="zp-texto">${L("eliminarTexto")}</p>
        <p class="zp-aviso" id="zp-aviso" data-aviso-sesion>${icono("info")}<span>${L("requiereSesion")}</span></p>
        <div class="zp-acciones">
          ${boton({ texto: L("eliminar"), variante: "bandera", attrs: { "data-eliminar": true, disabled: true, "aria-describedby": "zp-aviso" } })}
          ${boton({ texto: L("iniciar"), variante: "contorno", attrs: { "data-accion": "iniciar-sesion", "data-aviso-sesion": true } })}
        </div>
      </div>
    </section>
  </div>
</div>
<script type="application/json" id="ajustes-textos">${json({
    sesionComo: L("sesionComo"),
    confirmarTitulo: L("confirmarTitulo"),
    confirmarTexto: L("confirmarTexto"),
    confirmarBoton: L("confirmarBoton"),
    eliminando: L("eliminando"),
    eliminar: L("eliminar"),
    exito: L("exito"),
    error: L("error"),
  })}</script>`;
}

module.exports = {
  rutas: ["/ajustes", "/ajustes/cuenta"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const esCuenta = /^\/ajustes\/cuenta\/?$/.test(req.path);
    const clave = esCuenta ? "ajustes.cuenta" : "ajustes";
    return {
      ruta: esCuenta ? "/ajustes/cuenta" : "/ajustes",
      titulo: t(lang, `${clave}.titulo`),
      descripcion: t(lang, `${clave}.descripcion`),
      activa: "ajustes",
      cuerpo: esCuenta ? cuerpoCuenta(lang) : cuerpoAjustes(lang),
      css: ["filas", "ajustes"],
      js: ["paginas/ajustes"],
      robots: "noindex, follow",
      cache: "ninguno",
    };
  },
};
