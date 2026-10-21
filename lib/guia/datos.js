// Datos locales de la guía web: municipios, lugares, fiestas del pueblo, feria
// charrotaurina y el mapa de feria, más la lógica pura que la app móvil usa
// sobre ellos (tianguis y fiestas). Los JSON viven en data/ y los genera
// scripts/importar-app-movil.js desde la app; esquemas y reglas de saneo en
// docs/guia-datos.md.
//
// Todo se carga una vez, al requerir el módulo, y queda congelado (los
// arreglos y objetos que exporta son compartidos entre peticiones: copia
// antes de ordenar, p. ej. [...lugares].sort()). Todas las funciones son puras:
// no leen el reloj ni la zona horaria del servidor, no mutan sus argumentos y
// no tienen efectos. Donde hace falta "hoy", se recibe como argumento (ver
// hoyEnColima).
//
// Portada de la lógica (src/presentation/components/colimaapp/ de la app):
//   tianguisUtils.ts       → diaSemana, seCelebraEn, horasResumen, etiquetaDias,
//                            cuandoSePone, filtrarTianguis
//   fiestasPuebloUtils.ts  → etiquetaFecha, cifraDia, esVigente, fiestasPorMes
//   utils/postDescription.ts → textoDescripcion
// Diferencias con la app, a propósito:
//   · esVigente recibe { mes, dia } numéricos. La app hace new Date("YYYY-MM-DD")
//     (medianoche UTC) y lee getDate() local: en México marca el día anterior.
//   · Las fechas "YYYY-MM-DD" se descomponen a mano; el día de la semana sale de
//     Date.UTC, así que no depende de la zona del servidor (Vercel corre en UTC).
//   · Los textos (días, meses, "Todos los días") salen de data/i18n/<idioma>/datos.json.

const municipiosJSON = require("../../data/municipios.json");
const lugaresJSON = require("../../data/lugares.json");
const fiestasJSON = require("../../data/fiestas-pueblo.json");
const feriaJSON = require("../../data/feria.json");
const mapaFeriaJSON = require("../../data/mapa-feria.json");

function congelar(valor) {
  if (valor && typeof valor === "object" && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    for (const hijo of Object.values(valor)) congelar(hijo);
  }
  return valor;
}

const textosJSON = congelar({
  es: require("../../data/i18n/es/datos.json"),
  en: require("../../data/i18n/en/datos.json"),
});

// ---------- Idioma y textos ----------

// "en", "en-US" → "en"; cualquier otra cosa → "es".
function idioma(lang) {
  return String(lang || "").toLowerCase().startsWith("en") ? "en" : "es";
}

// Los textos reutilizables de la app (categorías, servicios, días, meses…).
// Lo que falta en inglés cae al español.
function textos(lang) {
  return textosJSON[idioma(lang)];
}

const colador = new Intl.Collator("es");
const porTitulo = (a, b) => colador.compare(a.titulo, b.titulo) || (a.id < b.id ? -1 : 1);
const porTipoYTitulo = (a, b) => a.tipo - b.tipo || porTitulo(a, b);

// ---------- Municipios ----------

const municipios = congelar(municipiosJSON);
const municipiosPorId = new Map(municipios.map((m) => [m.id, m]));
const municipiosPorSlug = new Map(municipios.map((m) => [m.slug, m]));

function municipioPorId(id) {
  return municipiosPorId.get(Number(id)) || null;
}

function municipioPorSlug(slug) {
  return municipiosPorSlug.get(String(slug)) || null;
}

// ---------- Lugares ----------

// Orden: tipo y luego título (alfabético en español).
const lugares = congelar([...lugaresJSON].sort(porTipoYTitulo));
const lugaresPorSlug = new Map(lugares.map((l) => [l.slug, l]));
const lugaresPorId = new Map(lugares.map((l) => [l.id, l]));
const lugaresDelTipo = new Map();
for (const lugar of lugares) {
  if (!lugaresDelTipo.has(lugar.tipo)) lugaresDelTipo.set(lugar.tipo, []);
  lugaresDelTipo.get(lugar.tipo).push(lugar);
}
for (const lista of lugaresDelTipo.values()) congelar(lista);

function lugarPorSlug(slug) {
  return lugaresPorSlug.get(String(slug)) || null;
}

function lugarPorId(id) {
  return lugaresPorId.get(String(id)) || null;
}

// Lugares de un tipo (10..18, 20, 21, 30, 31), por título.
function lugaresPorTipo(tipo) {
  return lugaresDelTipo.get(Number(tipo)) || [];
}

// Lo que se lista en la ficha de un municipio, como en la app: atracciones
// (tipos 10–18, por tipo y título), hoteles, restaurantes, tianguis y mercados.
function lugaresDeMunicipio(municipioId) {
  const id = Number(municipioId);
  const suyos = lugares.filter((l) => l.municipioId === id);
  return {
    atracciones: suyos.filter((l) => l.tipo >= 10 && l.tipo <= 18).sort(porTipoYTitulo),
    hoteles: suyos.filter((l) => l.tipo === 20).sort(porTitulo),
    restaurantes: suyos.filter((l) => l.tipo === 21).sort(porTitulo),
    tianguis: suyos.filter((l) => l.tipo === 30).sort(porTitulo),
    mercados: suyos.filter((l) => l.tipo === 31).sort(porTitulo),
  };
}

// Las 9 categorías de Rincones Naturales, en el orden de las pestañas de la app.
// `miniatura` es la ruta sin extensión: /img/c/<slug>.webp (160×160).
const categoriasRincones = congelar([
  { slug: "rios", tipo: 10, miniatura: "/img/c/rios" },
  { slug: "playas", tipo: 11, miniatura: "/img/c/playas" },
  { slug: "lagunas", tipo: 12, miniatura: "/img/c/lagunas" },
  { slug: "montanas", tipo: 13, miniatura: "/img/c/montanas" },
  { slug: "arqueologia", tipo: 14, miniatura: "/img/c/arqueologia" },
  { slug: "parques", tipo: 15, miniatura: "/img/c/parques" },
  { slug: "patrimonio", tipo: 16, miniatura: "/img/c/patrimonio" },
  { slug: "balnearios", tipo: 17, miniatura: "/img/c/balnearios" },
  { slug: "rutas", tipo: 18, miniatura: "/img/c/rutas" },
]);

// Las dos pestañas de Tianguis y mercados (misma forma que las categorías).
const categoriasTianguis = congelar([
  { slug: "tianguis", tipo: 30, miniatura: "/img/c/tianguis" },
  { slug: "mercados", tipo: 31, miniatura: "/img/c/mercados" },
]);

function categoriaPorSlug(slug) {
  return categoriasRincones.find((c) => c.slug === slug) || null;
}

function categoriaPorTipo(tipo) {
  return categoriasRincones.concat(categoriasTianguis).find((c) => c.tipo === Number(tipo)) || null;
}

// Nombre de una categoría ("rios" → "Ríos"), o de hoteles/restaurantes.
function nombreCategoria(slug, lang) {
  const categoria = textos(lang).categorias[slug];
  return categoria ? categoria.nombre : "";
}

// Descripción en el idioma pedido; en inglés cae al español si no hay traducción.
function textoDescripcion(lugar, lang) {
  if (!lugar || !lugar.descripcion) return "";
  const en = lugar.descripcion.en;
  return idioma(lang) === "en" && en && en.trim() ? en : lugar.descripcion.es || "";
}

// Nombre de un servicio en el idioma pedido; null si no se conoce la clave
// (la app los ignora: "Wifi gratis" de un hotel, por ejemplo).
function servicioNombre(clave, lang) {
  return textos(lang).serviciosNombre[String(clave).toLowerCase()] || null;
}

// Servicios con nombre conocido: [{ clave, nombre }], en el orden del catálogo.
function serviciosPintables(servicios, lang) {
  const salida = [];
  for (const clave of servicios || []) {
    const nombre = servicioNombre(clave, lang);
    if (nombre) salida.push({ clave, nombre });
  }
  return salida;
}

// Ruta de la imagen de un lugar a 480 u 800 px (.webp), o null si no tiene archivo.
function rutaImagen(imagen, ancho) {
  if (!imagen || !imagen.archivo) return null;
  return `/img/${imagen.archivo}-${ancho === 480 ? 480 : 800}.webp`;
}

// ¿Hay coordenadas para pintar un mapa? (167 de 178; 9 tianguis solo traen texto)
function tieneMapa(lugar) {
  return !!(lugar && lugar.ubicacion);
}

// Nombre y "cómo llegar" del lugar, con o sin coordenadas: { nombre, descripcion } o null.
function textoUbicacion(lugar) {
  const fuente = lugar && (lugar.ubicacion || lugar.ubicacionTexto);
  return fuente ? { nombre: fuente.nombre, descripcion: fuente.descripcion } : null;
}

const urlMaps = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const urlTikTokEmbed = (id) => `https://www.tiktok.com/embed/${id}`;
const urlMessenger = (texto) => `https://m.me/colimago?text=${encodeURIComponent(texto)}`;

// ---------- Tianguis y mercados ----------

const TIPO_TIANGUIS = 30;
const TIPO_MERCADO = 31;

// La semana va de lunes a domingo (los números son Date.getDay(): 0 = domingo).
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

// Texto del horario cuando la fuente no lo confirma.
const SIN_HORARIO = "Horario por confirmar";

// "2026-10-20" → { anio, mes, dia }
function partesISO(iso) {
  const [anio, mes, dia] = String(iso).slice(0, 10).split("-").map(Number);
  return { anio, mes, dia };
}

// Día de la semana de "YYYY-MM-DD": 0 = domingo … 6 = sábado, sin zonas horarias.
function diaSemana(iso) {
  const { anio, mes, dia } = partesISO(iso);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

const diasDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

// Semanas del mes: 1 a 5; -1 = la última. Sin dato, todas.
function coincideSemanaDelMes(semanas, iso) {
  if (!semanas || semanas.length === 0) return true;
  const { anio, mes, dia } = partesISO(iso);
  const semana = Math.ceil(dia / 7);
  const esUltima = dia + 7 > diasDelMes(anio, mes);
  return semanas.some((s) => (s === -1 ? esUltima : s === semana));
}

const claveMesDia = (mes, dia) => mes * 100 + dia;

// ¿Cae la fecha en la temporada? Puede cruzar el fin de año (15 dic – 6 ene).
function enTemporada(temporada, iso) {
  if (!temporada) return true;
  const { mes, dia } = partesISO(iso);
  const hoy = claveMesDia(mes, dia);
  const desde = claveMesDia(temporada.desde[0], temporada.desde[1]);
  const hasta = claveMesDia(temporada.hasta[0], temporada.hasta[1]);
  return desde <= hasta ? hoy >= desde && hoy <= hasta : hoy >= desde || hoy <= hasta;
}

// ¿Se pone este tianguis en la fecha ("YYYY-MM-DD")? Los mercados no cuentan.
function seCelebraEn(lugar, iso) {
  return (
    lugar.tipo === TIPO_TIANGUIS &&
    (lugar.dias || []).includes(diaSemana(iso)) &&
    coincideSemanaDelMes(lugar.semanasDelMes, iso) &&
    enTemporada(lugar.temporada, iso)
  );
}

// Minutos desde la medianoche de la primera hora del texto; sin hora, al final del día.
function horaInicio(horas) {
  const m = /(\d{1,2}):(\d{2})/.exec(horas || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
}

// Horario que aplica a un día de la semana (0–6), o null si ese día no hay o no se sabe.
function horarioDelDia(lugar, dia) {
  const filas = lugar.horario || [];
  const exacta = filas.find((f) => (f.dias || []).includes(dia));
  if (exacta) return exacta.horas;
  // Fichas sin `dias` por fila: si solo hay un horario, es el de todos los días
  const conHoras = filas.filter((f) => f.horas);
  return conHoras.length === 1 ? conHoras[0].horas : null;
}

// Horario para el resumen de una tarjeta: el único que tiene el lugar. Con
// varios (distinto por día) o ninguno confirmado devuelve null; la ficha trae
// la tabla completa.
function horasResumen(lugar) {
  const reales = [...new Set((lugar.horario || []).map((f) => f.horas).filter((h) => !!h && h !== SIN_HORARIO))];
  return reales.length === 1 ? reales[0] : null;
}

// "Dom", "Lun–Vie" o "Lun, Mié y Sáb": los días en texto corto, agrupando los
// consecutivos (≥ 3 seguidos se escriben "Lun–Vie"); los 7 → "Todos los días".
function etiquetaDias(dias, lang) {
  const t = textos(lang);
  const presentes = ORDEN_SEMANA.filter((d) => (dias || []).includes(d));
  if (presentes.length === 0) return "";
  if (presentes.length === 7) return t.tianguis.everyDay;
  const grupos = [];
  for (const d of presentes) {
    const ultimo = grupos[grupos.length - 1];
    const previo = ORDEN_SEMANA.indexOf(d) - 1;
    if (ultimo && ORDEN_SEMANA[previo] === ultimo[ultimo.length - 1]) ultimo.push(d);
    else grupos.push([d]);
  }
  const nombres = t.diasCortos;
  const textosGrupo = grupos.map((g) => (g.length >= 3 ? `${nombres[g[0]]}–${nombres[g[g.length - 1]]}` : g.map((d) => nombres[d]).join(", ")));
  const y = idioma(lang) === "en" ? " and " : " y ";
  return textosGrupo.length > 1 ? `${textosGrupo.slice(0, -1).join(", ")}${y}${textosGrupo[textosGrupo.length - 1]}` : textosGrupo[0];
}

// "Dom · 07:00 - 14:00": cuándo se pone, en una línea para listas y tarjetas.
function cuandoSePone(lugar, lang) {
  return [etiquetaDias(lugar.dias, lang), horasResumen(lugar)].filter(Boolean).join(" · ");
}

// "19 dic – 24 dic" (en inglés "Dec 19 – Dec 24"); "" si el lugar no es de temporada.
// La app no la muestra, pero los 2 tianguis navideños dicen "Todos los días"
// sin ella.
function etiquetaTemporada(lugar, lang) {
  if (!lugar.temporada) return "";
  const { mesesCortos } = textos(lang);
  const [desde, hasta] = [lugar.temporada.desde, lugar.temporada.hasta].map(([mes, dia]) =>
    idioma(lang) === "en" ? `${mesesCortos[mes - 1]} ${dia}` : `${dia} ${mesesCortos[mes - 1]}`,
  );
  return desde === hasta ? desde : `${desde} – ${hasta}`;
}

// Lista de la pantalla de Tianguis y mercados. `tipo` 30 (tianguis) o 31
// (mercados); `dia` 0–6 o null = todos; `municipioId` 1–10 o null = todos. Los
// de temporada solo salen con dia = null (no son de ningún día fijo). Orden:
// municipio y luego título.
function filtrarTianguis({ tipo = TIPO_TIANGUIS, dia = null, municipioId = null } = {}) {
  const t = Number(tipo);
  const d = dia === null || dia === undefined || dia === "" ? null : Number(dia);
  const m = municipioId === null || municipioId === undefined || municipioId === "" ? null : Number(municipioId);
  return lugaresPorTipo(t)
    .filter((l) => (d === null || (!l.temporada && (l.dias || []).includes(d))) && (m === null || l.municipioId === m))
    .sort((a, b) => a.municipioId - b.municipioId || porTitulo(a, b));
}

// Municipios que tienen al menos un lugar de ese tipo, en orden de id.
function municipiosConLugares(tipo) {
  return [...new Set(lugaresPorTipo(tipo).map((l) => l.municipioId))].sort((a, b) => a - b);
}

// Tianguis que se ponen en la fecha ("YYYY-MM-DD"), del que abre más temprano al que abre más tarde.
function tianguisDelDia(iso) {
  const dia = diaSemana(iso);
  return lugaresPorTipo(TIPO_TIANGUIS)
    .filter((l) => seCelebraEn(l, iso))
    .sort((a, b) => horaInicio(horarioDelDia(a, dia)) - horaInicio(horarioDelDia(b, dia)) || porTitulo(a, b));
}

// ---------- Fiestas del pueblo ----------

const fiestas = congelar(fiestasJSON);
const fiestasPorId = new Map(fiestas.map((f) => [f.id, f]));

function fiestaPorId(id) {
  return fiestasPorId.get(String(id)) || null;
}

// "5 ene", "2–9 oct" o "23 ene – 3 feb" (en inglés "Jan 5", "Oct 2–9", "Jan 23 – Feb 3");
// con fecha de texto libre, ese texto.
function etiquetaFecha(fiesta, lang) {
  const t = textos(lang);
  if (fiesta.fechaTexto) return t.fiestas.fechasTexto[fiesta.id] || fiesta.fechaTexto;
  const { inicio, fin } = fiesta;
  const meses = t.mesesCortos;
  const en = idioma(lang) === "en";
  const dia = (f) => (en ? `${meses[f.mes - 1]} ${f.dia}` : `${f.dia} ${meses[f.mes - 1]}`);
  if (!fin || (fin.mes === inicio.mes && fin.dia === inicio.dia)) return dia(inicio);
  if (fin.mes === inicio.mes) return en ? `${meses[inicio.mes - 1]} ${inicio.dia}–${fin.dia}` : `${inicio.dia}–${fin.dia} ${meses[inicio.mes - 1]}`;
  return `${dia(inicio)} – ${dia(fin)}`;
}

// Cifra grande de la tarjeta: "2–9" o "5"; si cruza de mes o es texto libre, solo el día de inicio.
function cifraDia(fiesta) {
  if (fiesta.fechaTexto || !fiesta.fin || fiesta.fin.mes !== fiesta.inicio.mes) return `${fiesta.inicio.dia}`;
  return fiesta.fin.dia === fiesta.inicio.dia ? `${fiesta.inicio.dia}` : `${fiesta.inicio.dia}–${fiesta.fin.dia}`;
}

// ¿Se celebra hoy? `hoy` = { mes, dia } numéricos (1–12, 1–31); las fiestas se
// repiten cada año, así que el año no cuenta. Las de fecha de texto libre
// nunca son "de hoy". Si el rango cruza el fin de año (28 dic – 12 ene), la
// fecha vale si es posterior al inicio o anterior al fin.
function esVigente(fiesta, hoy) {
  if (fiesta.fechaTexto || !hoy) return false;
  const mes = Number(hoy.mes);
  const dia = Number(hoy.dia);
  if (!Number.isInteger(mes) || !Number.isInteger(dia)) return false;
  const actual = claveMesDia(mes, dia);
  const desde = claveMesDia(fiesta.inicio.mes, fiesta.inicio.dia);
  const hasta = fiesta.fin ? claveMesDia(fiesta.fin.mes, fiesta.fin.dia) : desde;
  return desde <= hasta ? actual >= desde && actual <= hasta : actual >= desde || actual <= hasta;
}

// Doce meses, cada uno con las fiestas que EMPIEZAN en él, por día de inicio
// (con el mismo día, en el orden de data/fiestas-pueblo.json, como la app). Una
// que cruza de mes aparece solo en el mes en que empieza. Los meses sin
// fiestas se incluyen, con arreglo vacío.
const fiestasMeses = congelar(
  Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    fiestas: fiestas.filter((f) => f.inicio.mes === i + 1).sort((a, b) => a.inicio.dia - b.inicio.dia),
  })),
);

function fiestasPorMes() {
  return fiestasMeses;
}

// "Localidad, Municipio", o solo el municipio si coinciden.
function lugarDeFiesta(fiesta) {
  const municipio = municipioPorId(fiesta.municipioId);
  const nombre = municipio ? municipio.nombre : "";
  return fiesta.localidad === nombre || !nombre ? fiesta.localidad : `${fiesta.localidad}, ${nombre}`;
}

// El día de hoy en Colima: { anio, mes, dia, iso }. Los servidores corren en UTC
// (Vercel): de 18:00 a 24:00 en Colima ya es "mañana" para su reloj, así que no
// se usa new Date().getDate(). Pasa `ahora` (un Date) para que sea pura.
const FORMATO_COLIMA = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", year: "numeric", month: "numeric", day: "numeric" });
function hoyEnColima(ahora = new Date()) {
  const p = {};
  for (const parte of FORMATO_COLIMA.formatToParts(ahora)) p[parte.type] = parte.value;
  const anio = Number(p.year);
  const mes = Number(p.month);
  const dia = Number(p.day);
  const dos = (n) => String(n).padStart(2, "0");
  return { anio, mes, dia, iso: `${anio}-${dos(mes)}-${dos(dia)}` };
}

// ---------- Feria charrotaurina ----------

const feria = congelar(feriaJSON);
const mapaFeria = congelar(mapaFeriaJSON);

module.exports = {
  // idioma y textos
  idioma,
  textos,
  nombreCategoria,
  servicioNombre,
  serviciosPintables,
  textoDescripcion,
  // municipios
  municipios,
  municipioPorId,
  municipioPorSlug,
  // lugares
  lugares,
  lugarPorSlug,
  lugarPorId,
  lugaresPorTipo,
  lugaresDeMunicipio,
  categoriasRincones,
  categoriasTianguis,
  categoriaPorSlug,
  categoriaPorTipo,
  rutaImagen,
  tieneMapa,
  textoUbicacion,
  urlMaps,
  urlTikTokEmbed,
  urlMessenger,
  // tianguis y mercados
  diaSemana,
  seCelebraEn,
  horaInicio,
  horarioDelDia,
  horasResumen,
  etiquetaDias,
  cuandoSePone,
  etiquetaTemporada,
  filtrarTianguis,
  municipiosConLugares,
  tianguisDelDia,
  // fiestas del pueblo
  fiestas,
  fiestaPorId,
  etiquetaFecha,
  cifraDia,
  esVigente,
  fiestasPorMes,
  lugarDeFiesta,
  hoyEnColima,
  // feria
  feria,
  mapaFeria,
  // constantes
  TIPO_TIANGUIS,
  TIPO_MERCADO,
  SIN_HORARIO,
};
