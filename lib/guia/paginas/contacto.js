// Contacto: /contacto (en inglés, /en/contact). El correo, las redes y un
// formulario sencillo. Como el de Sugerir, el formulario no tiene servidor:
// arma el mensaje (siempre en español, lo lee el equipo) y lo pasa al correo de
// la persona o al portapapeles, con el mismo motor de public/js/paginas/sugerir.js.
// Sin JavaScript queda la plantilla editable y el enlace de correo.

const { h, raw, json } = require("../h");
const { t, urlAbsoluta, SITIO } = require("../i18n");
const { icono, letrero } = require("../componentes");
const { CORREO, REDES } = require("../layout");
const { fila, grupo } = require("./ajustes-filas");
const { armarMensaje, campoTexto, campoFilas, urlCorreo } = require("./sugerir");
const { marcado } = require("./legal-vista");

const MAX_MENSAJE = 1000;
const APP_WEB = "Web (colimago.mx)";

// Lo que va en el mensaje (siempre en español).
const TIPOS_ES = {
  pregunta: "Una pregunta",
  correccion: "Corregir información",
  publicidad: "Publicidad o colaboración",
  privacidad: "Privacidad y datos personales",
  otro: "Otra cosa",
};

const MODELO = {
  encabezado: "Mensaje desde el sitio (Colima Go)",
  lineas: [
    { r: "Tema", c: "tipo", req: true },
    { r: "Nombre", c: "nombre" },
    { r: "Mensaje", c: "mensaje", req: true },
    { r: "App", fijo: APP_WEB },
  ],
};

module.exports = {
  rutas: ["/contacto", "/contact"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const L = (clave, vars) => t(lang, `contacto.${clave}`, vars);
    const S = (clave, vars) => t(lang, `sugerir.${clave}`, vars);
    const externo = L("datos.externo");

    const opciones = Object.keys(TIPOS_ES).map((k) => ({ valor: TIPOS_ES[k], texto: L(`formulario.tipos.${k}`) }));
    const defecto = { tipo: TIPOS_ES.pregunta };
    const plantilla = armarMensaje(MODELO, defecto);
    const temas = L("temas.lista");

    const datos = grupo({
      id: "g-datos",
      titulo: L("datos.titulo"),
      filas: [
        fila({ href: `mailto:${CORREO}`, icono: "correo", titulo: L("datos.correo"), sub: CORREO }),
        fila({ href: "https://m.me/colimago", externo: true, externoTexto: externo, icono: "burbujas", titulo: L("datos.messenger"), sub: L("datos.mensajeria") }),
        fila({ href: REDES.facebook, externo: true, externoTexto: externo, icono: "facebook", titulo: L("datos.facebook") }),
        fila({ href: REDES.instagram, externo: true, externoTexto: externo, icono: "instagram", titulo: L("datos.instagram") }),
        fila({ href: REDES.tiktok, externo: true, externoTexto: externo, icono: "tiktok", titulo: L("datos.tiktok") }),
      ],
    });

    const config = {
      tipo: "contacto",
      modelo: MODELO,
      messenger: "",
      correo: CORREO,
      maxTexto: MAX_MENSAJE,
      etiquetas: {
        resumen: S("errores.resumen", { campos: "{campos}" }),
        errorTexto: S("errores.texto"),
        errorOpcion: S("errores.opcion"),
        copiado: S("copiado"),
        copiarError: S("copiarError"),
      },
    };

    const cuerpo = h`
<div class="envoltura">
  ${letrero({ id: "t-contacto", texto: L("titulo"), tinta: "lona", giro: -0.9, entrada: L("entrada"), compacto: true })}
  <div class="contacto">
    <div class="contacto-lado">
      ${datos}
      <section class="contacto-temas" aria-labelledby="t-temas">
        <h2 class="grupo-titulo" id="t-temas">${L("temas.titulo")}</h2>
        <ul class="lectura">${temas.map((item) => h`<li>${marcado(lang, item, externo)}</li>`)}</ul>
        <p class="nota">${L("temas.respuesta")}</p>
      </section>
    </div>
    <section class="contacto-formulario sg" aria-labelledby="t-formulario">
      <div class="sg-col">
        <h2 class="seccion-titulo" id="t-formulario">${L("formulario.titulo")}</h2>
        <p class="nota sg-ayuda">${L("formulario.intro")}</p>
        <form class="sg-form con-js" id="sg-form" data-sugerir novalidate>
          <p class="nota sg-leyenda">* ${S("obligatorio")}</p>
          ${campoFilas({ nombre: "tipo", etiqueta: L("formulario.tipo"), opciones, elegido: TIPOS_ES.pregunta })}
          ${campoTexto({ nombre: "nombre", etiqueta: L("formulario.nombre"), ejemplo: L("formulario.nombreEjemplo") })}
          ${campoTexto({ nombre: "mensaje", etiqueta: L("formulario.mensaje"), ejemplo: L("formulario.mensajeEjemplo"), req: true, largo: true, max: MAX_MENSAJE, filas: 6 })}
        </form>
        <section class="sg-sin-js sin-js" aria-labelledby="sj-titulo">
          <h3 class="seccion-titulo" id="sj-titulo">${S("sinJs.titulo")}</h3>
          <p class="nota">${S("sinJs.ayuda")}</p>
          <textarea class="sg-plantilla" rows="${plantilla.split("\n").length + 4}" aria-labelledby="sj-titulo">${plantilla}</textarea>
          <div class="sg-botones">
            <a class="btn-contorno" href="${urlCorreo(plantilla)}">${icono("correo")}<span>${S("sinJs.correo")}</span></a>
          </div>
        </section>
      </div>
      <aside class="sg-salida con-js" aria-labelledby="sg-prev-t">
        <h2 class="seccion-titulo" id="sg-prev-t">${S("vistaPrevia")}</h2>
        <output class="sg-mensaje" id="sg-mensaje" for="sg-form">${plantilla}</output>
        <p class="aviso-error sg-resumen" id="sg-resumen" role="alert" hidden></p>
        <div class="sg-botones">
          <a class="btn-pintado" id="sg-correo" href="${urlCorreo(plantilla)}">${icono("correo")}<span>${L("formulario.enviar")}</span></a>
          <button class="btn-contorno" id="sg-copiar" type="button">${icono("copiar")}<span>${S("copiar")}</span></button>
        </div>
      </aside>
    </section>
  </div>
  <script type="application/json" id="sugerir-config">${json(config)}</script>
</div>`;

    return {
      titulo: L("titulo"),
      descripcion: L("descripcion"),
      activa: "ajustes",
      cuerpo,
      css: ["filas", "sugerir", "contacto"],
      js: ["paginas/sugerir"],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: L("titulo"),
          url: urlAbsoluta(lang, "/contacto"),
          inLanguage: lang === "en" ? "en" : "es-MX",
          description: L("descripcion"),
          mainEntity: { "@type": "Organization", name: "Colima Go", url: `${SITIO}/`, email: CORREO, sameAs: Object.values(REDES) },
        },
      ],
      cache: "estatico",
    };
  },
};
