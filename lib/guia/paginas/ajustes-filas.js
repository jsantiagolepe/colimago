// Filas agrupadas de Ajustes y Acerca de (GrupoLista / FilaLista de la app):
// un grupo sobre --suelo-2 con radio 14 y, dentro, filas con casilla de icono,
// título, subtítulo o valor, flecha y divisor. Las clases viven en
// public/css/paginas/filas.css.
//
//   grupo({ id, titulo, filas: [fila(...), …], clase })
//   fila({ href | accion | attrs, icono, titulo, sub, valor, flecha, externo, peligro, oculta, fin })
//
// Propuesta para la base: si otras pantallas necesitan listas agrupadas, estas
// dos funciones y filas.css son candidatas a pasar a componentes.js / guia.css.

const { h, raw, atributos } = require("../h");
const { icono } = require("../componentes");

// Una fila. Sin href ni accion es una fila informativa (div), y `fin` es lo que
// va a la derecha (por ejemplo, botones propios). `externo` abre en otra pestaña.
//   href       → <a>
//   boton      → <button> (con attrs, p. ej. data-accion)
//   control    → HTML debajo del texto (apariencia): la fila no es interactiva
function fila({ href, boton, attrs, icono: ic, titulo, sub, valor, flecha = true, externo = false, externoTexto = "", peligro = false, oculta = false, fin, control, claseExtra = "", id }) {
  const clases = `fila${peligro ? " fila-peligro" : ""}${control ? " fila-con-control" : ""}${claseExtra ? ` ${claseExtra}` : ""}`;
  const final = h`${valor && h`<span class="fila-valor">${valor}</span>`}${fin}${flecha && !fin && !control && icono(externo ? "externo" : "chevron-derecha", "fila-flecha")}`;
  const interior = h`
    <span class="fila-icono">${icono(ic)}</span>
    <span class="fila-texto"><span class="fila-titulo">${titulo}</span>${sub && h`<span class="fila-sub">${sub}</span>`}${externo && externoTexto && h`<span class="sr-only"> (${externoTexto})</span>`}</span>
    ${(valor || fin || (flecha && !control)) && h`<span class="fila-fin">${final}</span>`}`;
  let contenido;
  if (href) {
    contenido = h`<a class="${clases}" href="${href}"${externo ? raw(' target="_blank" rel="noopener"') : ""}${atributos(attrs)}>${interior}</a>`;
  } else if (boton) {
    contenido = h`<button class="${clases}" type="button"${atributos(attrs)}>${interior}</button>`;
  } else {
    contenido = h`<div class="${clases}"${atributos(attrs)}>${interior}${control && h`<div class="fila-control">${control}</div>`}</div>`;
  }
  return h`<li class="fila-item"${id ? raw(` id="${id}"`) : ""}${oculta ? raw(" hidden") : ""}>${contenido}</li>`;
}

function grupo({ id, titulo, filas, clase = "", oculto = false }) {
  return h`<section class="grupo${clase ? ` ${clase}` : ""}"${id ? raw(` id="${id}"`) : ""}${oculto ? raw(" hidden") : ""}${titulo ? raw(` aria-labelledby="${id}-t"`) : ""}>
    ${titulo && h`<h2 class="grupo-titulo" id="${id}-t">${titulo}</h2>`}
    <ul class="grupo-filas">${filas}</ul>
  </section>`;
}

module.exports = { fila, grupo };
