// Páginas legales (política de privacidad y condiciones de uso): una sola
// plantilla para las dos. No es una página: index.js no la monta; la usan
// privacidad.js y terminos.js.
//
// Los textos viven en data/i18n/<idioma>/<espacio>.json, con esta forma:
//   { titulo, descripcion, actualizado, actualizadoIso, actualizadoEtiqueta,
//     indice, externo, intro: [párrafo…],
//     secciones: [{ id, titulo, parrafos: [], lista: [], cierre: [] }] }
//
// Dentro de un texto: [nombre](destino) es un enlace y **texto** es negrita.
// El destino puede ser una URL https (se abre en otra pestaña), un mailto: o
// una ruta del sitio en español ("/contacto"): el servidor la lleva al idioma
// de la página (en inglés, /en/contact). Todo lo demás se escapa.

const { h, raw, esc } = require("../h");
const { t, ruta: rutaIdioma, urlAbsoluta, SITIO } = require("../i18n");
const { letrero } = require("../componentes");

function marcado(lang, texto, externo) {
  const html = esc(texto)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (coincidencia, nombre, destino) => {
      if (/^https:\/\//.test(destino)) return `<a href="${destino}" target="_blank" rel="noopener">${nombre}<span class="sr-only"> (${esc(externo)})</span></a>`;
      if (/^mailto:/.test(destino)) return `<a href="${destino}">${nombre}</a>`;
      if (destino.startsWith("/")) return `<a href="${esc(rutaIdioma(lang, destino))}">${nombre}</a>`;
      return coincidencia;
    });
  return raw(html);
}

// ruta: la ruta en español de la página ("/privacidad"); espacio: su espacio de textos.
function paginaLegal({ lang, espacio, rutaPagina, tinta, giro }) {
  const L = (clave) => t(lang, `${espacio}.${clave}`);
  const externo = L("externo");
  const p = (texto) => h`<p>${marcado(lang, texto, externo)}</p>`;
  const secciones = L("secciones");
  const intro = L("intro");

  const cuerpo = h`
<div class="envoltura">
  ${letrero({ id: `t-${espacio}`, texto: L("titulo"), tinta, giro, compacto: true })}
  <div class="legal">
    <nav class="legal-indice" aria-labelledby="legal-indice-t">
      <h2 class="grupo-titulo" id="legal-indice-t">${L("indice")}</h2>
      <ol>
        ${secciones.map((s) => h`<li><a href="#${s.id}">${s.titulo.replace(/^\d+\.\s*/, "")}</a></li>`)}
      </ol>
    </nav>
    <article class="legal-cuerpo">
      <p class="nota legal-fecha">${L("actualizadoEtiqueta")}: <time datetime="${L("actualizadoIso")}">${L("actualizado")}</time></p>
      <div class="lectura legal-intro">${intro.map(p)}</div>
      ${secciones.map(
        (s) => h`<section class="legal-seccion" id="${s.id}" aria-labelledby="t-${s.id}">
        <h2 class="seccion-titulo" id="t-${s.id}">${s.titulo}</h2>
        <div class="lectura">
          ${(s.parrafos || []).map(p)}
          ${s.lista && h`<ul>${s.lista.map((item) => h`<li>${marcado(lang, item, externo)}</li>`)}</ul>`}
          ${(s.cierre || []).map(p)}
        </div>
      </section>`,
      )}
    </article>
  </div>
</div>`;

  const url = urlAbsoluta(lang, rutaPagina);
  return {
    titulo: L("titulo"),
    descripcion: L("descripcion"),
    activa: "ajustes",
    cuerpo,
    css: ["legal"],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: L("titulo"),
        url,
        inLanguage: lang === "en" ? "en" : "es-MX",
        description: L("descripcion"),
        dateModified: L("actualizadoIso"),
        isPartOf: { "@type": "WebSite", name: "Colima Go", url: `${SITIO}/` },
      },
    ],
    cache: "estatico",
  };
}

module.exports = { paginaLegal, marcado };
