// Acerca de (/acerca-de): el sello de Colima Go, el texto de la app, contacto,
// enlaces legales, redes y el crédito de InfraTec. Todo es fijo (local), así
// que la página se cachea como estática. Los textos viven en data/i18n/*/acerca.json.

const { h, raw } = require("../h");
const { t, ruta: rutaIdioma, urlAbsoluta, SITIO } = require("../i18n");
const { icono, letrero } = require("../componentes");
const { legales, CORREO, REDES } = require("../layout");
const { fila, grupo } = require("./ajustes-filas");

const INFRATEC = "https://www.infratec.mx";

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
