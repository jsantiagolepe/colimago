// Idioma (es / en) de la guía web: textos, rutas con prefijo y fechas.
//
// Los textos viven en data/i18n/<idioma>/<espacio>.json. Cada archivo es un
// espacio de nombres: data/i18n/es/inicio.json → claves "inicio.…". Cada
// página tiene el suyo; "comun" y "cliente" son de la base. Lo que falta en
// inglés cae al español, y lo que falta en ambos devuelve la propia clave
// (se nota a simple vista en la página).
//
// Fechas: el backend manda hora "flotante" (el reloj UTC es la hora local de
// Colima), así que aquí nunca se usa Date con zonas: se trabaja con los
// componentes del texto 'YYYY-MM-DD' y 'HH:MM', igual que la app móvil.

const fs = require("fs");
const path = require("path");

const IDIOMAS = ["es", "en"];
const SITIO = "https://www.colimago.mx";

const RAIZ_TEXTOS = path.join(__dirname, "..", "..", "data", "i18n");
const textos = { es: {}, en: {} };

function cargarTextos() {
  for (const idioma of IDIOMAS) {
    const carpeta = path.join(RAIZ_TEXTOS, idioma);
    let archivos = [];
    try {
      archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith(".json"));
    } catch {
      continue; // aún no hay textos de ese idioma
    }
    for (const archivo of archivos) {
      const espacio = archivo.replace(/\.json$/, "");
      try {
        textos[idioma][espacio] = JSON.parse(fs.readFileSync(path.join(carpeta, archivo), "utf8"));
      } catch (err) {
        console.error(`i18n: no se pudo leer ${idioma}/${archivo}:`, err.message);
      }
    }
  }
}
cargarTextos();

function buscar(idioma, clave) {
  const [espacio, ...resto] = clave.split(".");
  let nodo = textos[idioma] && textos[idioma][espacio];
  for (const parte of resto) {
    if (nodo === null || typeof nodo !== "object") return undefined;
    nodo = nodo[parte];
  }
  return nodo;
}

// t("es", "inicio.titulo")  ·  t("en", "comun.hola", { nombre: "Ana" }) con {nombre} en el texto.
function t(idioma, clave, variables) {
  let valor = buscar(idioma, clave);
  if (valor === undefined && idioma !== "es") valor = buscar("es", clave);
  if (typeof valor !== "string") return valor === undefined ? clave : valor;
  if (variables) valor = valor.replace(/\{(\w+)\}/g, (m, k) => (k in variables ? String(variables[k]) : m));
  return valor;
}

// Plural: "<clave>.uno" cuando n es 1; "<clave>.otros" en cualquier otro caso.
function tn(idioma, clave, n) {
  return t(idioma, `${clave}.${n === 1 ? "uno" : "otros"}`, { n });
}

// Todo un espacio de nombres (para mandarlo al navegador).
function espacio(idioma, nombre) {
  return { ...(textos.es[nombre] || {}), ...((idioma !== "es" && textos[idioma][nombre]) || {}) };
}

// ---------- Rutas ----------
// ruta("en", "/explorar") → "/en/explorar"; ruta("es", "/explorar") → "/explorar".
function ruta(idioma, destino = "/") {
  const limpia = destino.startsWith("/") ? destino : `/${destino}`;
  return idioma === "en" ? `/en${limpia === "/" ? "" : limpia}` : limpia;
}
function urlAbsoluta(idioma, destino) {
  return `${SITIO}${ruta(idioma, destino)}`;
}

// ---------- Municipios (nombres fijos; los datos completos están en datos.js) ----------
const MUNICIPIOS = {
  1: "Colima",
  2: "Villa de Álvarez",
  3: "Manzanillo",
  4: "Comala",
  5: "Minatitlán",
  6: "Tecomán",
  7: "Armería",
  8: "Coquimatlán",
  9: "Cuauhtémoc",
  10: "Ixtlahuacán",
};
function nombreMunicipio(id) {
  return MUNICIPIOS[Number(id)] || "";
}

// ---------- Fechas ----------
const MESES = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const MESES_CORTOS = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const DIAS = {
  es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const DIAS_CORTOS = {
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

function partes(fecha) {
  const [a, m, d] = String(fecha).split("-").map(Number);
  return { a, m, d };
}

// Día de la semana (0 = domingo) de 'YYYY-MM-DD' sin pasar por zonas horarias.
function diaDeLaSemana(fecha) {
  const { a, m, d } = partes(fecha);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

// "16:30" → "4:30 PM"
function hora12(hora) {
  const [hh, mm] = String(hora).split(":").map(Number);
  const sufijo = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${sufijo}`;
}

// es: "16 de octubre a las 9:00 PM" · en: "October 16 at 9:00 PM" (sin hora si no se pasa).
function fechaLarga(idioma, fecha, hora) {
  if (!fecha) return "";
  const { m, d } = partes(fecha);
  const mes = MESES[idioma][m - 1];
  const dia = idioma === "en" ? `${mes} ${d}` : `${d} de ${mes}`;
  if (!hora) return dia;
  return idioma === "en" ? `${dia} at ${hora12(hora)}` : `${dia} a las ${hora12(hora)}`;
}

// "16 oct" / "Oct 16"
function fechaCorta(idioma, fecha) {
  if (!fecha) return "";
  const { m, d } = partes(fecha);
  return idioma === "en" ? `${MESES_CORTOS.en[m - 1]} ${d}` : `${d} ${MESES_CORTOS.es[m - 1]}`;
}

// "sábado 24 de octubre" / "Saturday, October 24"
function fechaConDia(idioma, fecha) {
  if (!fecha) return "";
  const dia = DIAS[idioma][diaDeLaSemana(fecha)];
  return idioma === "en" ? `${dia}, ${fechaLarga("en", fecha)}` : `${dia} ${fechaLarga("es", fecha)}`;
}

// Descripción en el idioma de la página: inglés si lo hay, si no español.
function descripcion(idioma, objeto) {
  if (!objeto) return "";
  if (idioma === "en" && objeto.en) return objeto.en;
  return objeto.es || objeto.en || "";
}

module.exports = {
  IDIOMAS,
  SITIO,
  t,
  tn,
  espacio,
  ruta,
  urlAbsoluta,
  nombreMunicipio,
  MESES,
  MESES_CORTOS,
  DIAS,
  DIAS_CORTOS,
  diaDeLaSemana,
  hora12,
  fechaLarga,
  fechaCorta,
  fechaConDia,
  descripcion,
};
