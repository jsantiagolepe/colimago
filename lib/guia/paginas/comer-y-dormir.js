// Comer y dormir (/comer-y-dormir): restaurantes (tipo 21) y hoteles (tipo 20) del catálogo,
// con teléfono, dirección y sitio. Hoy son datos de ejemplo (ver indexacion.js), así que la
// página no se ofrece a los buscadores.

const { h } = require("../h");
const { t, ruta } = require("../i18n");
const datos = require("../datos");
const { icono, tarjetaLugar, estadoVista } = require("../componentes");

function negocio(lang, l) {
  const contacto = h`${l.direccion ? h`<span class="cd-dato">${icono("lugar")}${l.direccion}</span>` : ""}${l.telefono ? h`<a class="cd-dato" href="tel:${l.telefono}">${icono("telefono")}${t(lang, "comer.eat.contactCall")}: ${l.telefono}</a>` : ""}${l.sitioWeb ? h`<a class="cd-dato" href="${l.sitioWeb}" target="_blank" rel="noopener nofollow">${icono("web")}${t(lang, "comer.eat.contactWeb")}</a>` : ""}`;
  return tarjetaLugar(l, { lang, extra: contacto });
}

function seccion(lang, id, clave, lugares, vacioClave) {
  return h`<section class="bloque" aria-labelledby="${id}"><h2 id="${id}">${icono(clave === "sectionEat" ? "cubiertos" : "cama")}${t(lang, `comer.eat.${clave}`)}</h2>
    ${lugares.length ? h`<div class="rejilla-lugares">${lugares.map((l) => negocio(lang, l))}</div>` : estadoVista({ icono: clave === "sectionEat" ? "cubiertos" : "cama", titulo: t(lang, `comer.eat.${vacioClave}`), mensaje: t(lang, "comer.eat.emptyHint") })}
  </section>`;
}

module.exports = {
  rutas: ["/comer-y-dormir"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const comer = datos.lugaresPorTipo(21);
    const dormir = datos.lugaresPorTipo(20);
    const cuerpo = h`
<div class="envoltura comer-dormir">
  <header class="pagina-cab"><h1 class="rotulo">${t(lang, "comer.eat.title")}</h1></header>
  ${seccion(lang, "t-comer", "sectionEat", comer, "emptyEatTitle")}
  ${seccion(lang, "t-dormir", "sectionSleep", dormir, "emptySleepTitle")}
  <section class="bloque"><div class="tarjeta cd-cta"><div><h3>${t(lang, "comer.eat.ctaTitle")}</h3><p>${t(lang, "comer.eat.ctaText")}</p></div><a class="btn-pintado" href="${ruta(lang, "/contacto")}"><span>${t(lang, "comer.eat.ctaButton")}</span></a></div></section>
</div>`;
    return { titulo: t(lang, "comer.eat.title"), descripcion: t(lang, "guiaapp.comer.meta"), activa: "comer", cuerpo, css: ["app", "comer"], robots: "noindex, follow", cache: "estatico" };
  },
};
