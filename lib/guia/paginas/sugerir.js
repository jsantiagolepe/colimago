// Sugerir: los formularios de la app (evento, fiesta, lugar, comentario
// general, corrección de una fiesta y los atajos de foto y de cambio de un
// tianguis), en la web.
//
// La web no tiene servidor de mensajes. Igual que la app, arma el mensaje y se
// lo pasa a Messenger de Colima Go (https://m.me/colimago?text=…); como el texto
// prellenado puede no aparecer en Messenger de escritorio, ofrece también el
// correo (mailto) y copiar el mensaje. Los tres usan el MISMO texto, que sale
// siempre en español (lo lee el equipo) con las plantillas exactas de la app
// (sugerencias.ts).
//
// Sin JavaScript no se puede armar el mensaje con lo escrito: la página muestra
// la plantilla en un <textarea> editable, más un enlace a Messenger y otro de
// correo. Con JavaScript (public/js/paginas/sugerir.js) los campos arman el
// mensaje en vivo y se validan.
//
// Sin anuncios (son formularios) y fuera del índice: noindex, follow.

const { h, raw, json, esc } = require("../h");
const { t, ruta, nombreMunicipio } = require("../i18n");
const D = require("../datos");
const { icono, letrero, chip } = require("../componentes");

const CORREO = "colimago.app@gmail.com";
const MAX_TEXTO = 300;
const MAX_CALIFICACION = 5;
const APP_WEB = "Web (colimago.mx)"; // la línea "App:" del comentario general

// ---------- Textos del mensaje (siempre en español) ----------
const GENERAL_ES = {
  idea: "Tengo una idea",
  falta: "Falta algo (lugar, fiesta o evento)",
  error: "Algo no funciona",
  opinion: "Qué me parece la app",
  otro: "Otra cosa",
};
const CORRECCION_ES = {
  correcta: "Los datos son correctos",
  fechas: "Las fechas son otras",
  lugar: "El lugar está mal",
  cancelada: "Ya no se celebra",
  otro: "Otra corrección",
};
// requiere nota: sin detalle el mensaje no sirve
const CORRECCION_NOTA = { correcta: false, fechas: true, lugar: true, cancelada: false, otro: true };
const CORRECCION_ETIQUETA = { correcta: "suggestNoteOptional", fechas: "suggestNoteDates", lugar: "suggestNotePlace", cancelada: "suggestNoteOptional", otro: "suggestNoteOther" };

// Mismos tipos que `type` de los posts. `es` es lo que va en el mensaje.
const CATEGORIAS = [
  { tipo: 10, slug: "rios", es: "Río" },
  { tipo: 11, slug: "playas", es: "Playa" },
  { tipo: 12, slug: "lagunas", es: "Laguna" },
  { tipo: 13, slug: "montanas", es: "Montaña" },
  { tipo: 14, slug: "arqueologia", es: "Zona arqueológica" },
  { tipo: 15, slug: "parques", es: "Parque o jardín" },
  { tipo: 16, slug: "patrimonio", es: "Patrimonio (templo, museo, hacienda)" },
  { tipo: 17, slug: "balnearios", es: "Balneario" },
  { tipo: 18, slug: "rutas", es: "Ruta" },
  { tipo: 30, slug: "tianguis", es: "Tianguis" },
  { tipo: 31, slug: "mercados", es: "Mercado" },
];

// Un modelo describe el mensaje: encabezado y líneas. Cada línea:
//   { r: rótulo, c: campo del formulario | fijo: valor fijo, req: siempre sale,
//     siempre: sale aunque esté vacío, solo: { campo, valor }, fmt: "{v} de 5" }
//   { texto: línea suelta }
// Lo usan el servidor (plantilla sin JavaScript) y el navegador (mensaje en vivo).
function armarMensaje(modelo, valores = {}) {
  const lineas = [modelo.encabezado];
  for (const l of modelo.lineas) {
    if (l.solo && valores[l.solo.campo] !== l.solo.valor) continue;
    if (l.texto) {
      lineas.push(l.texto);
      continue;
    }
    const v = l.fijo != null ? l.fijo : String(valores[l.c] == null ? "" : valores[l.c]).trim();
    if (l.c === "calificacion" && !(Number(v) > 0)) continue;
    if (!v && !l.req && !l.siempre) continue;
    lineas.push(`${l.r}:${v ? ` ${l.fmt ? l.fmt.replace("{v}", v) : v}` : ""}`);
  }
  return lineas.join("\n");
}

const MODELOS = {
  evento: () => ({
    encabezado: "Evento nuevo (Colima Go)",
    lineas: [
      { r: "Evento", c: "nombre", req: true },
      { r: "Municipio", c: "municipio", req: true },
      { r: "Fecha y hora", c: "fecha", req: true },
      { r: "Lugar", c: "lugar" },
      { r: "Más datos o enlace", c: "notas" },
    ],
  }),
  fiesta: () => ({
    encabezado: "Fiesta nueva para el calendario (Colima Go)",
    lineas: [
      { r: "Fiesta", c: "nombre", req: true },
      { r: "Municipio", c: "municipio", req: true },
      { r: "Pueblo o localidad", c: "localidad" },
      { r: "Fechas", c: "fechas", req: true },
      { r: "Más datos", c: "notas" },
    ],
  }),
  lugar: () => ({
    encabezado: "Lugar nuevo para Rincones Naturales (Colima Go)",
    lineas: [
      { r: "Nombre", c: "nombre", req: true },
      { r: "Tipo", c: "categoria", req: true },
      { r: "Municipio", c: "municipio", req: true },
      { r: "Dónde queda o cómo llegar", c: "referencia" },
      { r: "Más datos", c: "notas" },
    ],
  }),
  general: () => ({
    encabezado: "Comentario sobre Colima Go",
    lineas: [
      { r: "Tipo", c: "tipo", req: true },
      { r: "Calificación", c: "calificacion", solo: { campo: "tipo", valor: GENERAL_ES.opinion }, fmt: `{v} de ${MAX_CALIFICACION}` },
      { r: "Comentario", c: "comentario", req: true },
      { r: "App", fijo: APP_WEB },
    ],
  }),
  correccion: (f) => ({
    encabezado: "Corrección de fiesta (Colima Go)",
    lineas: [
      { r: "Fiesta", fijo: `${f.nombre} [${f.id}]` },
      { r: "Lugar en la app", fijo: `${f.localidad}, ${nombreMunicipio(f.municipioId)}` },
      { r: "Fechas en la app", fijo: D.etiquetaFecha(f, "es") },
      { r: "Qué pasa", c: "tipo", req: true },
      { r: "Detalle", c: "nota" },
    ],
  }),
  foto: (l) => ({
    encabezado: `Foto para un lugar de ${l.tipo === 30 || l.tipo === 31 ? "Tianguis y mercados" : "Rincones Naturales"} (Colima Go)`,
    lineas: [
      { r: "Lugar", fijo: l.titulo.trim() },
      ...(nombreMunicipio(l.municipioId) ? [{ r: "Municipio", fijo: nombreMunicipio(l.municipioId) }] : []),
      { texto: "Te envío mi foto a continuación (puedes publicarla con mi crédito)." },
    ],
  }),
  cambio: (l) => ({
    encabezado: "Cambio en un tianguis o mercado (Colima Go)",
    lineas: [
      { r: "Lugar", fijo: l.titulo.trim() },
      ...(nombreMunicipio(l.municipioId) ? [{ r: "Municipio", fijo: nombreMunicipio(l.municipioId) }] : []),
      { r: "Qué cambió (día, lugar u horario)", c: "cambio", siempre: true },
    ],
  }),
};

// ---------- Piezas de formulario ----------
const marcaObligatorio = (req) => (req ? raw('<span class="sg-req" aria-hidden="true"> *</span>') : "");

function campoTexto({ nombre, etiqueta, ejemplo = "", req = false, largo = false, max = MAX_TEXTO, filas = 4 }) {
  const id = `c-${nombre}`;
  const comun = raw(`${req ? ' aria-required="true"' : ""} aria-describedby="e-${nombre}${largo ? ` n-${nombre}` : ""}"`);
  return h`<div class="campo" data-campo="${nombre}"${req ? raw(" data-obligatorio") : ""}>
    <label for="${id}">${etiqueta}${marcaObligatorio(req)}</label>
    ${largo
      ? h`<textarea id="${id}" name="${nombre}" maxlength="${max}" rows="${filas}" placeholder="${ejemplo}"${comun}></textarea>`
      : h`<input id="${id}" name="${nombre}" type="text" maxlength="${max}" placeholder="${ejemplo}" autocomplete="off"${comun} />`}
    <span class="campo-error" id="e-${nombre}" hidden></span>
    ${largo && h`<span class="ayuda sg-cuenta" id="n-${nombre}" data-cuenta="${nombre}" aria-hidden="true"></span>`}
  </div>`;
}

// Chips de una sola elección (municipio, tipo de lugar): radios con aspecto de chip.
function campoChips({ nombre, etiqueta, opciones, req = true, elegido = "" }) {
  return h`<fieldset class="campo" data-campo="${nombre}"${req ? raw(" data-obligatorio") : ""}>
    <legend class="campo-etiqueta">${etiqueta}${marcaObligatorio(req)}</legend>
    <div class="opciones" role="presentation">
      ${opciones.map((o) => h`<label class="opcion"><input type="radio" name="${nombre}" value="${o.valor}"${o.valor === elegido ? raw(" checked") : ""} /><span>${o.texto}</span></label>`)}
    </div>
    <span class="campo-error" id="e-${nombre}" hidden></span>
  </fieldset>`;
}

// Radios en filas (comentario general y corrección de una fiesta).
function campoFilas({ nombre, etiqueta, opciones, elegido }) {
  return h`<fieldset class="campo sg-filas" data-campo="${nombre}">
    <legend class="campo-etiqueta">${etiqueta}</legend>
    ${opciones.map((o) => h`<label class="sg-fila"><input type="radio" name="${nombre}" value="${o.valor}"${o.valor === elegido ? raw(" checked") : ""}${raw(Object.entries(o.datos || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join(""))} /><span class="sg-marca" aria-hidden="true"></span><span>${o.texto}</span></label>`)}
  </fieldset>`;
}

function opcionesMunicipio() {
  return D.municipios.map((m) => ({ valor: m.nombre, texto: m.nombre }));
}

// ---------- Los siete formularios ----------
function construir(tipo, req, lang) {
  const S = (clave, vars) => t(lang, `sugerir.${clave}`, vars);
  const DS = (clave, vars) => t(lang, `datos.sugerir.${clave}`, vars);

  if (tipo === "evento") {
    return {
      titulo: S("evento.titulo"),
      intro: S("evento.intro"),
      modelo: MODELOS.evento(),
      activa: "explorar",
      campos: h`
        ${campoTexto({ nombre: "nombre", etiqueta: S("evento.nombre"), ejemplo: S("evento.nombreEjemplo"), req: true })}
        ${campoChips({ nombre: "municipio", etiqueta: DS("suggestMunicipality"), opciones: opcionesMunicipio() })}
        ${campoTexto({ nombre: "fecha", etiqueta: S("evento.fecha"), ejemplo: S("evento.fechaEjemplo"), req: true })}
        ${campoTexto({ nombre: "lugar", etiqueta: S("evento.lugar"), ejemplo: S("evento.lugarEjemplo") })}
        ${campoTexto({ nombre: "notas", etiqueta: S("evento.notas"), largo: true })}`,
    };
  }

  if (tipo === "fiesta") {
    return {
      titulo: DS("suggestNewTitle"),
      intro: DS("suggestNewIntro"),
      modelo: MODELOS.fiesta(),
      activa: "inicio",
      campos: h`
        ${campoTexto({ nombre: "nombre", etiqueta: DS("suggestName"), ejemplo: DS("suggestNameExample"), req: true })}
        ${campoChips({ nombre: "municipio", etiqueta: DS("suggestMunicipality"), opciones: opcionesMunicipio() })}
        ${campoTexto({ nombre: "localidad", etiqueta: DS("suggestLocality"), ejemplo: DS("suggestLocalityExample") })}
        ${campoTexto({ nombre: "fechas", etiqueta: DS("suggestDates"), ejemplo: DS("suggestDatesExample"), req: true })}
        ${campoTexto({ nombre: "notas", etiqueta: DS("suggestMore"), largo: true })}`,
    };
  }

  if (tipo === "lugar") {
    // ?tipo= preselecciona la categoría: el slug (rios) o el número (10).
    const pedido = String(req.query.tipo || "").toLowerCase();
    const previa = CATEGORIAS.find((c) => c.slug === pedido || String(c.tipo) === pedido);
    return {
      titulo: DS("suggestPlaceTitle"),
      intro: DS("suggestPlaceIntro"),
      modelo: MODELOS.lugar(),
      activa: "inicio",
      consulta: previa ? `?tipo=${previa.slug}` : "",
      campos: h`
        ${campoTexto({ nombre: "nombre", etiqueta: DS("suggestPlaceName"), ejemplo: DS("suggestPlaceNameExample"), req: true })}
        ${campoChips({
          nombre: "categoria",
          etiqueta: DS("suggestCategory"),
          opciones: CATEGORIAS.map((c) => ({ valor: c.es, texto: D.nombreCategoria(c.slug, lang) })),
          elegido: previa ? previa.es : "",
        })}
        ${campoChips({ nombre: "municipio", etiqueta: DS("suggestMunicipality"), opciones: opcionesMunicipio() })}
        ${campoTexto({ nombre: "referencia", etiqueta: DS("suggestReference"), ejemplo: DS("suggestReferenceExample") })}
        ${campoTexto({ nombre: "notas", etiqueta: DS("suggestMore"), largo: true })}`,
    };
  }

  if (tipo === "general") {
    const opciones = Object.keys(GENERAL_ES).map((k) => ({ valor: GENERAL_ES[k], texto: S(`general.${k}`), datos: { clave: k } }));
    const calificacion = h`<div class="campo sg-calificacion" data-campo="calificacion" hidden>
      <span class="campo-etiqueta" id="cal-etiqueta">${S("general.calificacion")}</span>
      <div class="sg-focos" role="group" aria-labelledby="cal-etiqueta">
        ${Array.from({ length: MAX_CALIFICACION }, (_, i) => i + 1).map((n) => h`<button class="sg-foco" type="button" data-n="${n}" aria-pressed="false" aria-label="${S("general.calificacionValor", { n, max: MAX_CALIFICACION })}"><span class="foco-solo" aria-hidden="true"></span></button>`)}
        <span class="sg-calif-texto" aria-live="polite" data-vacio="${S("general.sinCalificacion")}" data-plantilla="${S("general.calificacionValor", { n: "{n}", max: MAX_CALIFICACION })}">${S("general.sinCalificacion")}</span>
      </div>
      <input type="hidden" name="calificacion" value="0" />
    </div>`;
    return {
      titulo: S("general.titulo"),
      intro: S("general.intro"),
      modelo: MODELOS.general(),
      defecto: { tipo: GENERAL_ES.idea },
      activa: "inicio",
      campos: h`
        ${campoFilas({ nombre: "tipo", etiqueta: S("general.tipo"), opciones, elegido: GENERAL_ES.idea })}
        ${calificacion}
        ${campoTexto({ nombre: "comentario", etiqueta: S("general.comentario"), req: true, largo: true })}`,
    };
  }

  if (tipo === "correccion") {
    const f = D.fiestaPorId(String(req.query.fiesta || ""));
    if (!f) return null;
    const opciones = Object.keys(CORRECCION_ES).map((k) => ({
      valor: CORRECCION_ES[k],
      texto: DS(`suggestType_${k}`),
      datos: { etiqueta: DS(CORRECCION_ETIQUETA[k]), req: CORRECCION_NOTA[k] ? "1" : "0" },
    }));
    return {
      titulo: DS("suggestFixTitle"),
      intro: DS("suggestFixIntro"),
      modelo: MODELOS.correccion(f),
      defecto: { tipo: CORRECCION_ES.fechas },
      activa: "inicio",
      consulta: `?fiesta=${encodeURIComponent(f.id)}`,
      contexto: S("correccion.contexto", { nombre: f.nombre, lugar: D.lugarDeFiesta(f), fecha: D.etiquetaFecha(f, lang) }),
      volver: ruta(lang, `/fiestas-del-pueblo/${f.id}`),
      campos: h`
        ${campoFilas({ nombre: "tipo", etiqueta: DS("suggestFixTitle"), opciones, elegido: CORRECCION_ES.fechas })}
        <div class="campo" data-campo="nota" data-obligatorio>
          <label for="c-nota"><span data-etiqueta-nota>${DS("suggestNoteDates")}</span><span class="sg-req" aria-hidden="true" data-marca-req> *</span></label>
          <textarea id="c-nota" name="nota" maxlength="${MAX_TEXTO}" rows="4" aria-required="true" aria-describedby="e-nota n-nota"></textarea>
          <span class="campo-error" id="e-nota" hidden></span>
          <span class="ayuda sg-cuenta" id="n-nota" data-cuenta="nota" aria-hidden="true"></span>
        </div>`,
    };
  }

  if (tipo === "foto" || tipo === "cambio") {
    const l = D.lugarPorSlug(String(req.query.lugar || ""));
    if (!l) return null;
    const esTianguis = l.tipo === 30 || l.tipo === 31;
    if (tipo === "cambio" && !esTianguis) return null;
    const municipio = nombreMunicipio(l.municipioId);
    const lugarTexto = municipio ? `${l.titulo}, ${municipio}` : l.titulo;
    if (tipo === "foto") {
      return {
        titulo: S("foto.titulo"),
        intro: t(lang, "datos.lugar.sendPhotoText"),
        modelo: MODELOS.foto(l),
        activa: "inicio",
        consulta: `?lugar=${encodeURIComponent(l.slug)}`,
        contexto: S("foto.contexto", { lugar: lugarTexto }),
        volver: ruta(lang, `/lugar/${l.slug}`),
        ayuda: S("foto.ayuda"),
        campos: "",
      };
    }
    return {
      titulo: S("cambio.titulo"),
      intro: t(lang, "datos.tianguis.marketsNoteText"),
      modelo: MODELOS.cambio(l),
      activa: "inicio",
      consulta: `?lugar=${encodeURIComponent(l.slug)}`,
      contexto: S("cambio.contexto", { lugar: lugarTexto }),
      volver: ruta(lang, `/lugar/${l.slug}`),
      campos: campoTexto({ nombre: "cambio", etiqueta: S("cambio.campo"), ejemplo: S("cambio.ejemplo"), largo: true }),
    };
  }
  return null;
}

// mailto: asunto = primera línea; cuerpo = el resto (con saltos CRLF, RFC 6068).
function urlCorreo(mensaje) {
  const [asunto, ...resto] = mensaje.split("\n");
  const codificar = (s) => encodeURIComponent(s).replace(/%0A/g, "%0D%0A");
  return `mailto:${CORREO}?subject=${codificar(asunto)}&body=${codificar(resto.join("\n"))}`;
}

const TIPOS_NAV = ["evento", "fiesta", "lugar", "general"];

module.exports = {
  rutas: ["/sugerir", "/sugerir/:tipo"],
  armarMensaje, // para las pruebas y para la página de contacto
  campoTexto, // piezas del formulario que reutiliza la página de contacto
  campoFilas,
  urlCorreo,
  CORREO,
  MAX_TEXTO,
  async pagina(req, ctx) {
    const { lang } = ctx;
    const tipo = req.params.tipo;
    if (!tipo) return { redirigir: ctx.ruta("/sugerir/general"), status: 302 };
    const def = construir(tipo, req, lang);
    if (!def) return { status: 404 };

    const S = (clave, vars) => t(lang, `sugerir.${clave}`, vars);
    const plantilla = armarMensaje(def.modelo, def.defecto || {});
    const hayCampos = String(def.campos).length > 0;
    const config = {
      tipo,
      modelo: def.modelo,
      messenger: D.urlMessenger(""),
      correo: CORREO,
      maxTexto: MAX_TEXTO,
      etiquetas: {
        resumen: S("errores.resumen", { campos: "{campos}" }),
        errorTexto: S("errores.texto"),
        errorOpcion: S("errores.opcion"),
        copiado: S("copiado"),
        copiarError: S("copiarError"),
      },
    };

    const nav = TIPOS_NAV.includes(tipo)
      ? h`<nav class="sg-nav" aria-label="${S("nav.etiqueta")}"><p class="sg-nav-titulo tablilla-tenue">${S("nav.etiqueta")}</p><div class="chips">
          ${TIPOS_NAV.map((k) => chip({ texto: S(`nav.${k}`), href: ruta(lang, `/sugerir/${k}`), activo: k === tipo }))}
        </div></nav>`
      : "";

    const cuerpo = h`
      <div class="envoltura">
        ${letrero({ id: "t-sugerir", texto: def.titulo, tinta: "lona", giro: -0.9, entrada: def.intro, compacto: true })}
      </div>
      <div class="envoltura sg">
        <div class="sg-col">
          ${nav}
          ${def.contexto && h`<p class="sg-contexto">${icono("info")}<span>${def.contexto}</span>${def.volver && h`<a class="btn-texto" href="${def.volver}">${t(lang, "comun.volver")}</a>`}</p>`}
          ${def.ayuda && h`<p class="nota sg-ayuda">${def.ayuda}</p>`}
          <form class="sg-form con-js" id="sg-form" data-sugerir novalidate>
            ${hayCampos && h`<p class="nota sg-leyenda">* ${S("obligatorio")}</p>`}
            ${def.campos}
          </form>
          <section class="sg-sin-js sin-js" aria-labelledby="sj-titulo">
            <h2 class="seccion-titulo" id="sj-titulo">${S("sinJs.titulo")}</h2>
            <p class="nota">${S("sinJs.ayuda")}</p>
            <textarea class="sg-plantilla" rows="${plantilla.split("\n").length + 2}" aria-labelledby="sj-titulo">${plantilla}</textarea>
            <div class="sg-botones">
              <a class="btn-pintado" href="${D.urlMessenger("").replace("?text=", "")}" target="_blank" rel="noopener"><span>${S("sinJs.messenger")}</span></a>
              <a class="btn-contorno" href="${urlCorreo(plantilla)}">${icono("correo")}<span>${S("sinJs.correo")}</span></a>
            </div>
          </section>
        </div>
        <aside class="sg-salida con-js" aria-labelledby="sg-prev-t">
          <h2 class="seccion-titulo" id="sg-prev-t">${S("vistaPrevia")}</h2>
          <output class="sg-mensaje" id="sg-mensaje" for="sg-form">${plantilla}</output>
          ${lang === "en" && S("mensajeEnEspanol") && h`<p class="nota">${S("mensajeEnEspanol")}</p>`}
          <p class="aviso-error sg-resumen" id="sg-resumen" role="alert" hidden></p>
          <div class="sg-botones">
            <a class="btn-pintado" id="sg-messenger" href="${D.urlMessenger("").replace("?text=", "")}" target="_blank" rel="noopener">${icono("burbujas")}<span>${t(lang, "datos.sugerir.suggestSend")}</span></a>
            <a class="btn-contorno" id="sg-correo" href="${urlCorreo(plantilla)}">${icono("correo")}<span>${S("enviarCorreo")}</span></a>
            <button class="btn-contorno" id="sg-copiar" type="button">${icono("copiar")}<span>${S("copiar")}</span></button>
          </div>
          <p class="nota">${t(lang, "datos.sugerir.suggestMessengerNote")}</p>
          <p class="nota">${S("notaEscritorio")}</p>
        </aside>
      </div>
      <script type="application/json" id="sugerir-config">${json(config)}</script>`;

    return {
      titulo: def.titulo,
      descripcion: def.intro,
      ruta: `/sugerir/${tipo}`,
      consulta: def.consulta || "",
      activa: def.activa,
      cache: "ninguno",
      robots: "noindex, follow",
      cuerpo,
      css: ["sugerir"],
      js: ["paginas/sugerir"],
    };
  },
};
