// Plantillas HTML con escape automático para la guía web.
//
//   h`<p>${texto}</p>`      → todo lo interpolado se escapa, salvo lo que ya
//                             sea HTML seguro (resultado de otro h`` o raw()).
//   raw("<b>x</b>")         → marca una cadena como HTML de confianza.
//   json(objeto)            → JSON para meter dentro de un <script>, con < y
//                             los separadores de línea escapados.
//
// Arreglos se aplanan; null, undefined y false no pintan nada (así
// `${cond && h`…`}` funciona). Cuidado: el número 0 sí se pinta.
//
// Los textos de usuarios (comentarios) y del backend (títulos y descripciones
// de eventos) son texto libre: nunca se pegan en HTML sin pasar por aquí.

class HtmlSeguro {
  constructor(texto) {
    this.texto = texto;
  }
  toString() {
    return this.texto;
  }
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function raw(texto) {
  return new HtmlSeguro(String(texto ?? ""));
}

function pintar(valor) {
  if (valor === null || valor === undefined || valor === false || valor === true) return "";
  if (valor instanceof HtmlSeguro) return valor.texto;
  if (Array.isArray(valor)) return valor.map(pintar).join("");
  return esc(valor);
}

function h(cadenas, ...valores) {
  let salida = cadenas[0];
  for (let i = 0; i < valores.length; i++) salida += pintar(valores[i]) + cadenas[i + 1];
  return new HtmlSeguro(salida);
}

// JSON para <script type="application/json"> o JSON-LD: evita cerrar la
// etiqueta o abrir un comentario HTML desde dentro de los datos.
function json(objeto) {
  return raw(
    JSON.stringify(objeto)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(new RegExp("\\u2028", "g"), "\\u2028")
      .replace(new RegExp("\\u2029", "g"), "\\u2029"),
  );
}

// Atributos HTML a partir de un objeto: { "data-id": 3, hidden: true, rel: null }
// → ' data-id="3" hidden'. Los valores se escapan; false/null se omiten.
function atributos(objeto) {
  if (!objeto) return raw("");
  let salida = "";
  for (const [clave, valor] of Object.entries(objeto)) {
    if (valor === null || valor === undefined || valor === false) continue;
    salida += valor === true ? ` ${clave}` : ` ${clave}="${esc(valor)}"`;
  }
  return raw(salida);
}

module.exports = { h, raw, esc, json, atributos, HtmlSeguro };
