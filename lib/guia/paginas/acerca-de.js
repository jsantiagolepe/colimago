// Acerca de (/acerca-de): el sello de Colima Go, el texto de la app, contacto,
// enlaces legales, redes y el crédito de InfraTec. Todo es fijo (local), así
// que la página se cachea como estática. Los textos viven en data/i18n/*/acerca.json.

const { h, raw, esc } = require("../h");
const { t, ruta: rutaIdioma, urlAbsoluta, SITIO } = require("../i18n");
const { icono, letrero } = require("../componentes");
const { legales, CORREO, REDES } = require("../layout");
const { fila, grupo } = require("./ajustes-filas");
const { tieneMarca, mostrarBorradores } = require("../contenido");

const INFRATEC = "https://www.infratec.mx";

// Las secciones largas de acerca.json ("mas"). Un párrafo que todavía lleva [COMPLETAR] (datos
// personales por llenar) no se publica; en desarrollo se ve resaltado. Los marcadores {correo},
// {contacto} y {sugerir} se vuelven enlaces.
function seccionesLargas(lang, enlaces) {
  const T = (clave) => t(lang, `acerca.${clave}`);
  const vinculos = {
    correo: `<a href="mailto:${CORREO}">${esc(CORREO)}</a>`,
    contacto: `<a href="${esc(enlaces.contacto)}">${esc(T("enlaces.contacto"))}</a>`,
    sugerir: `<a href="${esc(rutaIdioma(lang, "/sugerir/general"))}">${esc(T("enlaces.sugerir"))}</a>`,
  };
  const ver = mostrarBorradores();
  const secciones = (T("mas") || [])
    .map((sec) => ({ titulo: sec.titulo, parrafos: sec.parrafos.filter((p) => ver || !tieneMarca(p)).map((p) => ({ pendiente: tieneMarca(p), html: esc(p).replace(/\{(correo|contacto|sugerir)\}/g, (m, k) => vinculos[k]) })) }))
    .filter((sec) => sec.parrafos.length > 0);
  if (!secciones.length) return "";
  return h`<div class="acerca-mas lectura">
    ${secciones.map((sec) => h`<section><h2 class="seccion-titulo">${sec.titulo}</h2>${sec.parrafos.map((p) => raw(`<p${p.pendiente ? ' class="borrador"' : ""}>${p.html}</p>`))}</section>`)}
  </div>`;
}

module.exports = {
  rutas: ["/acerca-de"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const L = (clave) => t(lang, `acerca.${clave}`);
    const externo = L("externo");
    const asunto = encodeURIComponent(L("contacto.asunto"));
    const mailto = `mailto:${CORREO}?subject=${asunto}`;

    // Privacidad, condiciones y contacto son páginas de este mismo sitio; solo
    // el EULA (el de la app) sigue en su página externa.
    const enlaces = legales(lang);
    const contacto = grupo({
      id: "g-contacto",
      titulo: L("contacto.titulo"),
      filas: [
        fila({ href: mailto, icono: "correo", titulo: L("contacto.correo"), sub: CORREO }),
        fila({ href: enlaces.contacto, icono: "burbujas", titulo: L("contacto.pagina") }),
        fila({ href: enlaces.privacidad, icono: "escudo", titulo: L("contacto.privacidad") }),
        fila({ href: enlaces.condiciones, icono: "documento", titulo: L("contacto.condiciones") }),
        fila({ href: enlaces.eula, externo: true, externoTexto: externo, icono: "documento", titulo: L("contacto.eula") }),
      ],
    });

    const redes = [
      ["facebook", REDES.facebook, "facebook", true],
      ["instagram", REDES.instagram, "instagram", true],
      ["tiktok", REDES.tiktok, "tiktok", true],
      ["correo", mailto, "correo", false],
    ];

    const cuerpo = h`
<div class="envoltura">
  ${letrero({ id: "t-acerca", texto: L("letrero"), tinta: "bandera", giro: -0.9, nivel: 1, compacto: true })}
  <div class="acerca">
    <div class="acerca-sello">
      <div class="sello" data-revela>
        <span class="perro sello-perro" aria-hidden="true"></span>
        <p class="sello-nombre rotulo">Colima <span>Go</span></p>
      </div>
      <p class="acerca-texto" data-revela="2">${L("texto")}</p>
      <p class="acerca-credito" data-revela="3">${L("creditoPre")} <a href="${INFRATEC}" target="_blank" rel="noopener">${L("creditoNombre")}<span class="sr-only"> (${externo})</span></a></p>
    </div>
    <div class="acerca-lado">
      ${contacto}
      <section class="grupo" aria-labelledby="g-redes-t">
        <h2 class="grupo-titulo" id="g-redes-t">${L("siguenos.titulo")}</h2>
        <ul class="redes">
          ${redes.map(([clave, href, ic, abre]) => h`<li><a class="btn-contorno" href="${href}"${abre ? raw(' target="_blank" rel="noopener"') : ""}>${icono(ic)}<span>${L(`siguenos.${clave}`)}</span>${abre && h`<span class="sr-only"> (${externo})</span>`}</a></li>`)}
        </ul>
      </section>
    </div>
  </div>
  ${seccionesLargas(lang, enlaces)}
</div>`;

    const url = urlAbsoluta(lang, "/acerca-de");
    return {
      titulo: L("titulo"),
      descripcion: L("descripcion"),
      activa: "ajustes",
      cuerpo,
      css: ["filas", "acerca"],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: L("titulo"),
          url,
          inLanguage: lang === "en" ? "en" : "es-MX",
          description: L("descripcion"),
          mainEntity: {
            "@type": "Organization",
            name: "Colima Go",
            url: `${SITIO}/`,
            email: CORREO,
            sameAs: Object.values(REDES),
          },
        },
      ],
      cache: "estatico",
    };
  },
};
