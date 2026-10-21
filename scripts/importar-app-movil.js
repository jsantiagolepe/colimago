#!/usr/bin/env node
// Importa a la guía web los datos locales y las imágenes de la app móvil
// Colima Go (repo ColimagoMovil, React Native). SOLO LEE la app: jamás
// escribe en ella. Todo lo que genera queda en este repo:
//
//   data/municipios.json, data/mapa-feria.json, data/lugares.json,
//   data/fiestas-pueblo.json, data/feria.json,
//   data/i18n/{es,en}/datos.json
//   public/img/{l,m,feria,c}/*.webp (+ un sidecar .webp.json por imagen)
//
// Es idempotente: con la misma app produce los mismos archivos (el JSON solo
// se reescribe si cambia; una imagen ya convertida y más nueva que su origen
// se omite; un sidecar existente conserva su createdAt).
//
//   node scripts/importar-app-movil.js                  datos e imágenes
//   node scripts/importar-app-movil.js --solo datos     solo los JSON
//   node scripts/importar-app-movil.js --solo imagenes  solo los .webp
//   --origen <ruta>     repo de la app (por defecto, la ruta de abajo)
//   --forzar            reconvierte aunque la imagen ya exista
//   --q-foto N          calidad webp de las fotos (66)
//   --q-ilustracion N   calidad webp de las ilustraciones (56)
//   --presupuesto-mb N  aviso si las imágenes nuevas pasan de N MB (12)
//
// Sin dependencias npm. Imágenes con `cwebp` (libwebp, brew install webp); las
// medidas de los JPG se leen de su cabecera en JavaScript puro, así que `sips`
// no hace falta. Nunca se amplía una imagen: si el original es más chico que
// el ancho pedido, se convierte tal cual.
//
// ─── De dónde sale cada dato (rutas relativas al repo de la app) ───────────
//
// data/lugares.json (178)
//   assets/catalog/catalog.json            los 178 registros del catálogo
//   src/config/photoCredits.ts             crédito de las 41 fotos de Wikimedia
//   src/config/lugaresSinFoto.ts           las 118 claves cuya imagen es una
//                                          ilustración "SIN FOTO AÚN"
//   src/infrastructure/mappers/images.mappers.ts   imageKey → archivo JPG
//   src/config/municipalitiesData.ts       nombre del municipio con acentos
//   El catálogo trae date/finishDate/createdAt/updatedAt (fecha del lote de
//   exportación), avatar, images, allDay, moreDays, isCover, isTop, reference,
//   color, municipality, children, subType, status, kind: nada de eso se
//   copia. Reglas de saneo en docs/guia-datos.md.
//
// data/municipios.json (10), data/mapa-feria.json
//   src/config/municipalitiesData.ts       id, nombre, claves de los textos
//   src/locales/{es,en}.json               descCorta / descLarga
//   src/presentation/components/colimaapp/MapaFeria.tsx   posiciones, cables,
//                                          volcán, costa y proporción
//   public/index.html (este repo)          apodos en español (ficha de la
//                                          portada); el inglés está en este
//                                          archivo (APODOS_EN)
//
// data/fiestas-pueblo.json (44)
//   src/config/fiestasPueblo.ts            se evalúa el .ts sin sus tipos
//
// data/feria.json
//   src/config/feriaCharrotaurinaContent.ts  textos largos y ubicación
//   src/presentation/components/colimaapp/FeriaDetailsScreen.tsx  párrafo "La
//                                          feria" con sus 6 enlaces, fotos
//   src/presentation/components/details/PhotoEvent.tsx   12 carteles
//   src/presentation/components/details/ServicesIcon.tsx servicios que se pintan
//   NO se importan el `schedule`, el `videoTikTok` ni el nombre "Río Los
//   Amiales" de la ubicación: son relleno copiado de otro lugar. La ubicación
//   se llama "Recinto Ferial de Villa de Álvarez", como dice su propia
//   descripción.
//
// data/i18n/{es,en}/datos.json
//   src/locales/{es,en}.json               textos reutilizables (copiados tal
//                                          cual, salvo "Rios" → "Ríos")
//   src/presentation/components/details/ServicesIcon.tsx  claves de servicios
//   src/config/CalendarLocale.ts           nombres de los días
//   src/presentation/components/colimaapp/fiestasPuebloUtils.ts  meses cortos
//   Lo que la app no trae traducido (etiquetas de servicios en inglés,
//   "Cerrado", "Horario por confirmar", "Ver en Maps", fechas de texto libre
//   de dos fiestas) está en las tablas de este archivo.
//
// Imágenes (todas JPG en la app, a WebP aquí; sidecar con el origen)
//   public/img/l/<clave>-{480,800}.webp    una por imageKey (174)
//   public/img/m/<slug>.webp               src/img/logos/*, tamaño original
//   public/img/feria/…-{480,800}.webp      assets/images/fiestasCharrotaurinas
//   public/img/c/<categoria>.webp          miniatura 160×160 recortada al
//                                          centro de assets/images/<cat>/<cat>.jpg
//   public/img/c/portada-<x>-{480,800}.webp  portadas de las tablas de Inicio

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const ORIGEN_POR_DEFECTO = "/Users/juliosantiago/Documents/React Native/ColimagoMovil";
const FECHA_USO = "2026-10-20";

// ─── Argumentos ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function opcion(nombre, porDefecto) {
  const i = args.indexOf(nombre);
  return i === -1 ? porDefecto : args[i + 1];
}
const ORIGEN = path.resolve(opcion("--origen", ORIGEN_POR_DEFECTO));
const SOLO = opcion("--solo", null);
const FORZAR = args.includes("--forzar");
const Q_FOTO = Number(opcion("--q-foto", 66));
const Q_ILUSTRACION = Number(opcion("--q-ilustracion", 56));
const PRESUPUESTO_MB = Number(opcion("--presupuesto-mb", 12));
const Q_CARTEL = 72;
const Q_PORTADA = 70;
const Q_MUNICIPIO = 80;
const Q_MINIATURA = 78;

if (SOLO !== null && SOLO !== "datos" && SOLO !== "imagenes") {
  fail('--solo solo acepta "datos" o "imagenes"');
}
if (![Q_FOTO, Q_ILUSTRACION, PRESUPUESTO_MB].every(Number.isFinite)) {
  fail("--q-foto, --q-ilustracion y --presupuesto-mb deben ser números");
}
const HACER_DATOS = SOLO !== "imagenes";
const HACER_IMAGENES = SOLO !== "datos";

function fail(mensaje) {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

// ─── Utilidades de archivos ─────────────────────────────────────────────────

const enOrigen = (...partes) => path.join(ORIGEN, ...partes);
const enRepo = (...partes) => path.join(RAIZ, ...partes);

function leerOrigen(rel) {
  const ruta = enOrigen(rel);
  if (!fs.existsSync(ruta)) fail(`No existe ${rel} en el origen (${ORIGEN}). ¿La ruta de --origen es la de la app?`);
  return fs.readFileSync(ruta, "utf8");
}

const leerJSONOrigen = (rel) => JSON.parse(leerOrigen(rel));

// JSON con 2 espacios, salvo los arreglos cortos de números o textos
// ([1, 2, 3]), que van en una línea: el diff de un cambio queda legible.
function serializar(valor, sangria = "") {
  if (Array.isArray(valor)) {
    if (valor.length === 0) return "[]";
    if (valor.every((v) => v === null || typeof v !== "object")) {
      const linea = `[${valor.map((v) => JSON.stringify(v)).join(", ")}]`;
      if (linea.length <= 100) return linea;
    }
    const interior = `${sangria}  `;
    return `[\n${valor.map((v) => interior + serializar(v, interior)).join(",\n")}\n${sangria}]`;
  }
  if (valor && typeof valor === "object") {
    const claves = Object.keys(valor).filter((k) => valor[k] !== undefined);
    if (claves.length === 0) return "{}";
    const interior = `${sangria}  `;
    return `{\n${claves.map((k) => `${interior}${JSON.stringify(k)}: ${serializar(valor[k], interior)}`).join(",\n")}\n${sangria}}`;
  }
  return JSON.stringify(valor);
}

// Escribe un JSON solo si cambia. Devuelve true si escribió.
function escribirJSON(rel, objeto) {
  const ruta = enRepo(rel);
  const texto = serializar(objeto) + "\n";
  if (fs.existsSync(ruta) && fs.readFileSync(ruta, "utf8") === texto) return false;
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, texto);
  return true;
}

// "Villa de Álvarez" → "villa-de-alvarez"
function kebab(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const colador = new Intl.Collator("es");

// Evalúa un .ts de la app que solo declara constantes: quita los `export type`
// y las anotaciones de tipo de los `export const` y lo corre en un contexto
// vacío (sin require, sin process). `retorno` es la expresión que devuelve.
function evaluarTS(fuente, retorno, nombre) {
  const js = fuente
    .replace(/^export type [^=]+=\s*\{[\s\S]*?\};\s*$/gm, "")
    .replace(/^export const (\w+)\s*(?::[^=]+)?=/gm, "const $1 =");
  try {
    const valor = vm.runInNewContext(`(function () {\n${js}\n;return ${retorno};\n})()`, {}, { timeout: 2000 });
    return JSON.parse(JSON.stringify(valor));
  } catch (error) {
    return fail(`No se pudo leer ${nombre}: ${error.message}`);
  }
}

// ─── Medidas de imágenes (sin dependencias) ─────────────────────────────────

function dimensionesJPEG(ruta) {
  const buf = fs.readFileSync(ruta);
  if (buf[0] !== 0xff || buf[1] !== 0xd8) fail(`${ruta} no es un JPEG`);
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marcador = buf[i + 1];
    if (marcador === 0xff) {
      i += 1;
      continue;
    }
    if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
      i += 2;
      continue;
    }
    // SOF0..SOF15, salvo DHT (C4), JPG (C8) y DAC (CC)
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return fail(`No encontré las medidas de ${ruta}`);
}

// ─── Lectura de la app ──────────────────────────────────────────────────────

// images.mappers.ts: clave → ruta del JPG relativa al repo de la app.
function cargarMapper() {
  const fuente = leerOrigen("src/infrastructure/mappers/images.mappers.ts");
  const dir = enOrigen("src/infrastructure/mappers");
  const mapa = new Map();
  for (const m of fuente.matchAll(/^\s*(\w+):\s*require\('([^']+)'\)/gm)) {
    mapa.set(m[1], path.relative(ORIGEN, path.resolve(dir, m[2])).split(path.sep).join("/"));
  }
  if (mapa.size < 200) fail(`images.mappers.ts trae ${mapa.size} claves; esperaba unas 250`);
  return mapa;
}

// municipalitiesData.ts: los 10 municipios con su clave de logo y de textos.
function cargarMunicipiosApp() {
  const fuente = leerOrigen("src/config/municipalitiesData.ts");
  const re =
    /name: '([^']+)',\s*id: (\d+),\s*imageKey: '(\w+)',\s*avatarKey: '\w+',\s*descriptionKey: t\('smallDescription(\w+)'\),\s*descriptionFullKey: t\('description(\w+)'\)/g;
  const lista = [...fuente.matchAll(re)].map((m) => ({
    nombre: m[1],
    id: Number(m[2]),
    claveLogo: m[3],
    sufijoCorta: m[4],
    sufijoLarga: m[5],
  }));
  if (lista.length !== 10) fail(`municipalitiesData.ts trae ${lista.length} municipios; esperaba 10`);
  return lista;
}

// ─── Tablas propias (lo que la app no trae) ─────────────────────────────────

// Apodos en inglés de la ficha de municipios (el español sale de public/index.html).
// Clave: nombre del archivo del escudo (src/img/logos/<archivo>.jpg).
const APODOS_EN = {
  colima: "The capital, founded in 1523",
  villadealvarez: "Feria de la Villa and horse parades",
  comala: "Pueblo Mágico, the White Town of America",
  manzanillo: "Sailfish Capital of the World",
  tecoman: "World Capital of Lime",
  armeria: "The Palo Verde estuary",
  minatitlan: "Between mountains and rivers",
  coquimatlan: "Agricultural tradition",
  cuahutemoc: "The central valley",
  ixtlahuacan: "A refuge among the mountains",
};

// Etiquetas de servicios: la app solo las trae en español y en minúsculas
// (ServicesIcon.tsx → serviceNames); aquí van con mayúscula inicial y acentos,
// y el inglés es traducción propia. `directions_car` no tiene etiqueta en la
// app (su icono existe, pero ningún lugar lo usa): "Auto" / "Car".
const SERVICIOS_NOMBRE = {
  bathroom: ["Baños", "Restrooms"],
  camping: ["Camping", "Camping"],
  directions_boat: ["Barco", "Boat"],
  directions_car: ["Auto", "Car"],
  equipment_rental: ["Renta de equipo", "Equipment rental"],
  food_drink: ["Comida y bebidas", "Food and drinks"],
  hotel: ["Hotel", "Hotel"],
  local_parking: ["Estacionamiento", "Parking"],
  picnic_area: ["Área de picnic", "Picnic area"],
  pool: ["Piscina", "Pool"],
  restaurant: ["Restaurante", "Restaurant"],
  sports_tennis: ["Tenis", "Tennis"],
  tour_guide: ["Guía turístico", "Tour guide"],
  wifi: ["Wi-Fi", "Wi-Fi"],
  umbrella: ["Enramadas", "Palapas"],
  fishing: ["Pesca", "Fishing"],
  bbq: ["Asadores", "Grills"],
  cabain_rental: ["Cabañas", "Cabins"], // "cabain" es un typo del origen: se conserva la clave
  kayak_rental: ["Lanchas", "Small boats"],
  pet_friendly: ["Mascotas", "Pets welcome"],
  hiking: ["Senderismo", "Hiking"],
  nature_people: ["Observación", "Nature observation"],
  mountain_biking: ["Ciclismo", "Cycling"],
  // Claves que la app ignora en silencio pero que el catálogo trae y vale la pena mostrar
  park: ["Parque", "Park"],
  landscape: ["Paisaje", "Scenery"],
  cleaning_services: ["Limpieza", "Cleaning"],
  "wi-fi": ["Wi-Fi", "Wi-Fi"],
  fireplace: ["Fogata", "Campfire"],
  cabin_rental: ["Cabañas", "Cabins"],
  local_dining: ["Comida", "Food"],
};

// Textos que la app trae fijos en español (no están en los locales).
const TEXTOS_PROPIOS = {
  cerrado: ["Cerrado", "Closed"],
  horarioPorConfirmar: ["Horario por confirmar", "Hours to be confirmed"],
  verEnMaps: ["Ver en Maps", "View on Maps"],
  temporada: ["Temporada", "Seasonal"],
};

// Fechas de texto libre de las fiestas (la app solo las tiene en español).
const FECHA_TEXTO_EN = {
  "senor-expiracion-lo-de-villa": "The Tuesday after January 6",
  "carnaval-manzanillo": "February, before Lent (the date changes every year)",
};

// Historia de la feria en inglés (la app solo la trae en español) y el texto
// de cada enlace. Los marcadores {clave} son los mismos del español.
const FERIA_HISTORIA_EN =
  "With more than 165 years of history in honor of San Felipe de Jesús, the Charrotaurino festivities of Villa de Álvarez are Intangible Cultural Heritage of Colima. Their crown jewel is {petatera}, the largest handmade bullring in the world, built every year without nails from wood and palm mats. The fiesta opens with the nighttime {cabalgatas}, while at midday the {recibimientos} gather families with brass-band music and the presence of {mojigangos}. In the ring there are jaripeos and bullfights, highlighted by the traditional {despedidaPayaso} with the {enanitosToreros}, who close the bullfighting events.";
const FERIA_ENLACES_EN = {
  petatera: "La Petatera",
  cabalgatas: "cabalgatas",
  recibimientos: "recibimientos",
  mojigangos: "mojigangos",
  despedidaPayaso: "clown's farewell",
  enanitosToreros: "enanitos toreros",
};

// Firma de la reina (el texto de la app no la trae aparte; sale de su propio
// texto: "Soy Osiris Janice Flores Méndez… Reina de los Festejos … 2026").
const FERIA_AUTOR_REINA = "Osiris Janice Flores Méndez, Reina de los Festejos Charrotaurinos 2026";

// Nombre de la foto de cada tema en public/img/feria/ (sin sufijo).
const FERIA_FOTO_TEMA = {
  bienvenida: "bienvenida",
  reina: "reina",
  petatera: "petatera",
  cabalgatas: "cabalgatas",
  recibimientos: "recibimientos",
  mojigangos: "mojigangos",
  despedidaPayaso: "despedida-payaso",
  enanitosToreros: "enanitos-toreros",
};

// Acentos que faltan en los nombres de los carteles de la feria.
const CORRECCIONES_CARTEL = { "Torneo Nacional de Ganaderias": "Torneo Nacional de Ganaderías", "Luis Angel": "Luis Ángel" };

const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

// Categorías: slug web, tipo del catálogo, carpeta de la app, clave del título
// en los locales. Los 9 primeros son Rincones Naturales.
const CATEGORIAS = [
  { slug: "rios", tipo: 10, carpeta: "rivers", clave: "rivers" },
  { slug: "playas", tipo: 11, carpeta: "beaches", clave: "beaches" },
  { slug: "lagunas", tipo: 12, carpeta: "lakes", clave: "lakes" },
  { slug: "montanas", tipo: 13, carpeta: "mountains", clave: "mountains" },
  { slug: "arqueologia", tipo: 14, carpeta: "archaeology", clave: "archaeology" },
  { slug: "parques", tipo: 15, carpeta: "parks", clave: "parks" },
  { slug: "patrimonio", tipo: 16, carpeta: "temples", clave: "heritage" },
  { slug: "balnearios", tipo: 17, carpeta: "spas", clave: "spas" },
  { slug: "rutas", tipo: 18, carpeta: "routes", clave: "routes" },
  { slug: "tianguis", tipo: 30, carpeta: "tianguis", clave: "tianguis" },
  { slug: "mercados", tipo: 31, carpeta: "mercados", clave: "marketsOnly" },
];
// Hoteles y restaurantes solo llevan nombre (no tienen miniatura).
const CATEGORIAS_SIN_IMAGEN = [
  { slug: "hoteles", clave: "hotels" },
  { slug: "restaurantes", clave: "restaurants" },
];

// Lo único que se conserva de la tabla anterior si la app cambia el nombre:
// "Rios" (sin acento) es un descuido del copy de la app.
const CORRECCION_CATEGORIA_ES = { rios: "Ríos" };

// ─── Plan de imágenes ───────────────────────────────────────────────────────

// Cada entrada: { origen (relativo a la app), salida (relativa a public/img,
// sin extensión ni sufijo), anchos: [480, 800] | [null] (original) | cuadrado:
// lado, calidad, nota (texto extra del sidecar) }.
const plan = [];
const agregarImagen = (entrada) => plan.push(entrada);

// ─── Municipios y mapa de la feria ──────────────────────────────────────────

function construirMunicipios(mapper, es, en) {
  const html = fs.readFileSync(enRepo("public/index.html"), "utf8");
  const apodosEs = {};
  for (const m of html.matchAll(/<div class="ficha-texto" data-muni="(\w+)"[^>]*>\s*<h3>[^<]*<\/h3>\s*<p class="apodo">([^<]+)<\/p>/g)) {
    apodosEs[m[1]] = m[2].trim();
  }

  const mapa = leerMapaFeria().posiciones;
  return cargarMunicipiosApp().map((m) => {
    const slug = kebab(m.nombre);
    const logo = mapper.get(m.claveLogo);
    if (!logo) fail(`images.mappers.ts no tiene ${m.claveLogo}`);
    const archivo = path.basename(logo, path.extname(logo)); // colima, villadealvarez, cuahutemoc…
    if (!apodosEs[archivo]) fail(`public/index.html no tiene la ficha "${archivo}" (apodo en español)`);
    if (!APODOS_EN[archivo]) fail(`Falta el apodo en inglés de ${archivo} en APODOS_EN`);
    const textos = (clave) => {
      if (!es[clave] || !en[clave]) fail(`Faltan en es.json/en.json: ${clave}`);
      return { es: es[clave], en: en[clave] };
    };
    const posicion = mapa[m.id];
    if (!posicion) fail(`MapaFeria.tsx no tiene posición para el municipio ${m.id}`);
    agregarImagen({ origen: logo, salida: `m/${slug}`, anchos: [null], calidad: Q_MUNICIPIO, nota: `Municipality photo (${m.nombre}); the app keeps it at 300 px, so it is not enlarged.` });
    return {
      id: m.id,
      slug,
      nombre: m.nombre,
      apodo: { es: apodosEs[archivo], en: APODOS_EN[archivo] },
      descCorta: textos(`smallDescription${m.sufijoCorta}`),
      descLarga: textos(`description${m.sufijoLarga}`),
      estampa: `/img/estampa-${archivo}.webp`,
      foto: `/img/m/${slug}.webp`,
      mapa: { x: posicion.x, y: posicion.y, lado: posicion.lado },
    };
  });
}

// MapaFeria.tsx: posiciones (0..1), cables, volcán, costa y proporción.
function leerMapaFeria() {
  const fuente = leerOrigen("src/presentation/components/colimaapp/MapaFeria.tsx");
  const posiciones = {};
  for (const m of fuente.matchAll(/^\s*(\d+): \{x: ([\d.]+), y: ([\d.]+), ancla: '(\w+)'\}/gm)) {
    posiciones[Number(m[1])] = { x: Number(m[2]), y: Number(m[3]), lado: m[4] };
  }
  const volcan = /const VOLCAN: Punto = \{x: ([\d.]+), y: ([\d.]+)\}/.exec(fuente);
  const bloqueCables = /const CABLES: \[number, number\]\[\] = \[([\s\S]*?)\n\];/.exec(fuente);
  const proporcion = /const PROPORCION = ([\d.]+);/.exec(fuente);
  const costa = /Costa del Pacifico[\s\S]*?d=\{`([^`]+)`\}/.exec(fuente);
  const curvatura = /\+ largo \* ([\d.]+)\}/.exec(fuente);
  if (Object.keys(posiciones).length !== 10 || !volcan || !bloqueCables || !proporcion || !costa || !curvatura) {
    fail("No pude leer MapaFeria.tsx (posiciones, volcán, cables, proporción, costa o curvatura)");
  }
  const cables = [...bloqueCables[1].matchAll(/\[(\d+),\s*(\d+)\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
  // `M0,${alto * 0.6} C${ancho * 0.06},${alto * 0.73} …` → fracciones del ancho (x) y del alto (y)
  const trazo = costa[1].replace(/\$\{(?:ancho|alto) \* ([\d.]+)\}/g, "$1");
  if (/[${}]/.test(trazo)) fail(`No pude normalizar la costa de MapaFeria.tsx: ${trazo}`);
  return {
    posiciones,
    mapa: {
      volcan: { x: Number(volcan[1]), y: Number(volcan[2]), lado: "izquierda" },
      cables,
      costa: trazo,
      aspecto: Number(proporcion[1]),
      curvatura: Number(curvatura[1]),
    },
  };
}

// ─── Lugares ────────────────────────────────────────────────────────────────

function construirLugares(mapper, municipios) {
  const catalogo = leerJSONOrigen("assets/catalog/catalog.json");
  const creditos = evaluarTS(leerOrigen("src/config/photoCredits.ts"), "photoCredits", "photoCredits.ts");
  const sinFoto = new Set(evaluarTS(leerOrigen("src/config/lugaresSinFoto.ts"), "[...lugaresSinFoto]", "lugaresSinFoto.ts"));
  const nombreMunicipio = new Map(municipios.map((m) => [m.id, m]));

  const registros = catalogo.locales;
  const claves = new Set(registros.map((l) => l.imageKey));
  for (const clave of sinFoto) if (!claves.has(clave)) console.warn(`  aviso: lugaresSinFoto trae "${clave}", que no está en el catálogo`);

  // Slugs: el título en kebab sin acentos. Si dos chocan, el registro más viejo
  // (_id menor, que empieza con su fecha de creación) conserva el suyo y el
  // otro lleva "-<municipio>" (y "-2"… si aun así choca).
  const slugs = new Map();
  const usados = new Set();
  for (const l of [...registros].sort((a, b) => (a._id < b._id ? -1 : 1))) {
    const base = kebab(l.title);
    const sufijo = nombreMunicipio.get(l.municipalityId).slug;
    let slug = base;
    if (usados.has(slug)) slug = `${base}-${sufijo}`;
    for (let n = 2; usados.has(slug); n += 1) slug = `${base}-${sufijo}-${n}`;
    usados.add(slug);
    slugs.set(l._id, slug);
  }

  const lugares = registros.map((l) => {
    const municipio = nombreMunicipio.get(l.municipalityId);
    if (!municipio) fail(`${l.title}: municipalityId ${l.municipalityId} no existe`);
    const tienda = l.type === 20 || l.type === 21; // hoteles y restaurantes: datos de ejemplo

    // Imagen
    const rutaApp = mapper.get(l.imageKey);
    const existe = rutaApp && fs.existsSync(enOrigen(rutaApp));
    let imagen = { clave: null, tipo: "ninguna", archivo: null, ancho: null, alto: null, credito: null };
    if (existe) {
      const ilustracion = sinFoto.has(l.imageKey);
      const cred = creditos[l.imageKey];
      if (ilustracion && cred) fail(`${l.imageKey} es ilustración y tiene crédito`);
      const dim = dimensionesJPEG(enOrigen(rutaApp));
      imagen = {
        clave: l.imageKey,
        tipo: ilustracion ? "ilustracion" : "foto",
        archivo: `l/${l.imageKey}`,
        ancho: dim.ancho,
        alto: dim.alto,
        credito: cred ? { autor: cred.autor, licencia: cred.licencia, fuente: "Wikimedia Commons", url: cred.pagina || null } : null,
      };
      let nota = "";
      if (ilustracion) nota = "Illustration generated for the app (scripts/ilustraciones); it carries the embedded 'SIN FOTO AÚN' stamp.";
      else if (cred) nota = `Photo by ${cred.autor}, ${cred.licencia}, via Wikimedia Commons (${cred.pagina}).`;
      agregarImagen({ origen: rutaApp, salida: imagen.archivo, anchos: [480, 800], calidad: ilustracion ? Q_ILUSTRACION : Q_FOTO, nota });
    }

    // Ubicación: válida con coordenadas finitas, dentro del mundo y distintas de 0,0
    const loc = l.location || {};
    const coordenadas =
      Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude) &&
      Math.abs(loc.latitude) <= 90 && Math.abs(loc.longitude) <= 180 &&
      !(loc.latitude === 0 && loc.longitude === 0);
    const nombreLoc = (loc.name || "").trim();
    const descripcionLoc = (loc.descriptionLocation || "").trim();
    const ubicacion = coordenadas ? { lat: loc.latitude, lng: loc.longitude, nombre: nombreLoc, descripcion: descripcionLoc } : null;
    // Sin coordenadas pero con texto (9 tianguis): el texto es real y la tarjeta lo muestra
    const ubicacionTexto = !coordenadas && (nombreLoc || descripcionLoc) ? { nombre: nombreLoc, descripcion: descripcionLoc } : null;

    const horario = (l.schedule || []).map((h) => {
      const fila = { dia: corregirDia(h.day || ""), horas: h.hours == null ? null : h.hours };
      if (Array.isArray(h.days)) fila.dias = h.days;
      return fila;
    });

    const redes = {};
    for (const clave of ["web", "facebook", "whatsapp", "instagram", "tiktok", "youtube", "mail", "phone"]) {
      const valor = ((l.socialNetworks || {})[clave] || "").trim();
      if (valor) redes[clave] = valor;
    }

    const lugar = {
      id: l._id,
      slug: slugs.get(l._id),
      tipo: l.type,
      municipioId: l.municipalityId,
      titulo: l.title.trim(),
      subtitulo: municipio.nombre, // el subtitle del catálogo viene sin acentos
      descripcion: { es: (l.description || "").trim(), en: (l.descriptionEnglish || "").trim() || null },
      imagen,
      ubicacion,
      ubicacionTexto,
      servicios: l.services || [],
      horario,
      abiertoTodoElDia: !!l.openAllDay,
    };
    // openAllDay con una tabla de horario: la tabla es relleno copiado de otro lugar
    if (l.openAllDay && horario.length > 0) lugar.horarioInventado = true;
    Object.assign(lugar, {
      tiktok: (l.videoTikTok || "").trim() || null,
      redes,
      direccion: (l.address || "").trim() || null,
      // Hoteles y restaurantes son datos de ejemplo, sin fuente: sin teléfono, calificación ni precio
      telefono: tienda ? null : (l.phone || "").trim() || null,
      sitioWeb: (l.website || "").trim() || null,
      calificacion: tienda || l.rating == null ? null : l.rating,
      rango: tienda ? null : (l.priceRange || "").trim() || null,
      dias: Array.isArray(l.weekdays) ? l.weekdays : null,
      semanasDelMes: Array.isArray(l.weeksOfMonth) ? l.weeksOfMonth : null,
      temporada: l.season ? { desde: l.season.from, hasta: l.season.to } : null,
    });
    return lugar;
  });

  lugares.sort((a, b) => a.tipo - b.tipo || colador.compare(a.titulo, b.titulo) || (a.id < b.id ? -1 : 1));
  return { lugares, catalogVersion: catalogo.catalogVersion, creditos, sinFoto };
}

// Dos días del catálogo original van sin acento ("miercoles", "sabado").
function corregirDia(dia) {
  return dia.replace(/\bmiercoles\b/g, "miércoles").replace(/\bsabado\b/g, "sábado");
}

// ─── Fiestas del pueblo ─────────────────────────────────────────────────────

function construirFiestas() {
  const fuente = leerOrigen("src/config/fiestasPueblo.ts");
  const lista = evaluarTS(fuente, "fiestasPueblo", "fiestasPueblo.ts");
  if (!Array.isArray(lista) || lista.length === 0) fail("fiestasPueblo.ts no devolvió fiestas");
  return lista.map((f) => {
    if (!(f.municipioId >= 1 && f.municipioId <= 10)) fail(`Fiesta ${f.id}: municipioId ${f.municipioId} no existe`);
    return {
      id: f.id,
      nombre: f.nombre,
      inicio: f.inicio,
      fin: f.fin || null,
      fechaTexto: f.fechaTexto || null,
      aproximada: !!f.aproximada,
      localidad: f.localidad,
      municipioId: f.municipioId,
      descripcion: { es: f.descripcion },
      fuente: { nombre: f.fuenteNombre, url: f.fuenteUrl },
    };
  });
}

// ─── Feria charrotaurina ────────────────────────────────────────────────────

// Une las líneas partidas a mano en el código (una línea que no termina en
// signo y la siguiente empieza en minúscula) y separa los párrafos con "\n".
function normalizarTexto(texto) {
  const parrafos = [];
  for (const linea of texto.split("\n").map((s) => s.trim()).filter(Boolean)) {
    const ultimo = parrafos[parrafos.length - 1];
    if (ultimo !== undefined && !/[.!?:;»"”)]$/.test(ultimo) && /^[a-záéíóúñ]/.test(linea)) {
      parrafos[parrafos.length - 1] = `${ultimo} ${linea}`;
    } else {
      parrafos.push(linea);
    }
  }
  return parrafos.join("\n");
}

function construirFeria(es, en, municipios) {
  const c = evaluarTS(
    leerOrigen("src/config/feriaCharrotaurinaContent.ts"),
    "{title, subtitle, municipalityId, bienvenida, reinaFestejos, petatera, cabalgatas, recibimientos, mojigangos, despedidaPayaso, enanitosToreros, services, location}",
    "feriaCharrotaurinaContent.ts",
  );
  const pantalla = leerOrigen("src/presentation/components/colimaapp/FeriaDetailsScreen.tsx");
  const eventos = leerOrigen("src/presentation/components/details/PhotoEvent.tsx");
  const iconos = leerOrigen("src/presentation/components/details/ServicesIcon.tsx");
  const nombreMunicipio = municipios.find((m) => m.id === c.municipalityId).nombre;

  const fotoApp = (archivo) => `assets/images/fiestasCharrotaurinas/${archivo}`;
  const registrarFoto = (salida, archivo, nota) => {
    if (!fs.existsSync(enOrigen(fotoApp(archivo)))) fail(`No existe ${fotoApp(archivo)}`);
    agregarImagen({ origen: fotoApp(archivo), salida: `feria/${salida}`, anchos: [480, 800], calidad: Q_PORTADA, nota });
  };

  // Portada
  const portada = /const images = require\('[^']*\/fiestasCharrotaurinas\/([^']+)'\)/.exec(pantalla);
  if (!portada) fail("FeriaDetailsScreen.tsx: no encontré la portada");
  registrarFoto("portada", portada[1], "Cover of the Fiestas Charrotaurinas program.");

  // Bienvenida y reina: dos tablas colgantes
  const tablas = [...pantalla.matchAll(/<TablaColgante\s+titulo="([^"]+)"\s+fuente=\{require\('[^']*\/fiestasCharrotaurinas\/([^']+)'\)\}/g)];
  if (tablas.length !== 2) fail(`FeriaDetailsScreen.tsx: esperaba 2 tablas colgantes y hay ${tablas.length}`);

  // El párrafo "La feria" con sus 6 enlaces → marcadores {clave}
  const seccion = /<SeccionDetalle titulo=\{t\('feriaHistory'\)\}[^>]*>\s*<Text style=\{styles\.text\}>([\s\S]*?)<\/Text>\s*<\/SeccionDetalle>/.exec(pantalla);
  if (!seccion) fail("FeriaDetailsScreen.tsx: no encontré el párrafo de la feria");
  const enlaces = {};
  const historiaEs = seccion[1]
    .replace(/\{enlace\('([^']+)',\s*'([^']+)',\s*(\w+),\s*require\('[^']*\/fiestasCharrotaurinas\/([^']+)'\)\)\}/g, (_, etiqueta, titulo, clave, archivo) => {
      enlaces[clave] = { etiqueta, titulo, archivo };
      return `{${clave}}`;
    })
    .replace(/\{' '\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const claves = Object.keys(enlaces);
  if (claves.length !== 6 || (historiaEs.match(/[{}]/g) || []).length !== 12) fail(`FeriaDetailsScreen.tsx: el párrafo de la feria no quedó con 6 marcadores limpios: ${historiaEs}`);
  for (const clave of claves) {
    if (typeof c[clave] !== "string") fail(`feriaCharrotaurinaContent.ts no exporta ${clave}`);
    if (!FERIA_FOTO_TEMA[clave]) fail(`Falta el nombre de foto de ${clave} en FERIA_FOTO_TEMA`);
    if (!FERIA_ENLACES_EN[clave]) fail(`Falta el enlace en inglés de ${clave}`);
  }
  if ((FERIA_HISTORIA_EN.match(/\{\w+\}/g) || []).length !== 6) fail("FERIA_HISTORIA_EN debe tener 6 marcadores");

  const temas = {};
  // Bienvenida: la firma ("Tey Gutiérrez Andrade / Presidenta Municipal…") va en `autor`
  const [cuerpoBienvenida, ...firma] = c.bienvenida.split(/\n\s*\n/);
  temas.bienvenida = {
    titulo: tablas[0][1],
    texto: normalizarTexto(cuerpoBienvenida),
    foto: `/img/feria/${FERIA_FOTO_TEMA.bienvenida}`,
    autor: firma.join(" ").split("\n").map((s) => s.trim()).filter(Boolean).join(", ") || null,
  };
  temas.reina = {
    titulo: tablas[1][1],
    texto: normalizarTexto(c.reinaFestejos),
    foto: `/img/feria/${FERIA_FOTO_TEMA.reina}`,
    autor: FERIA_AUTOR_REINA,
  };
  registrarFoto(FERIA_FOTO_TEMA.bienvenida, tablas[0][2], "Photo for the welcome message of the Fiestas Charrotaurinas.");
  registrarFoto(FERIA_FOTO_TEMA.reina, tablas[1][2], "Photo for the message of the queen of the Fiestas Charrotaurinas.");
  for (const clave of claves) {
    temas[clave] = { titulo: enlaces[clave].titulo, texto: normalizarTexto(c[clave]), foto: `/img/feria/${FERIA_FOTO_TEMA[clave]}` };
    registrarFoto(FERIA_FOTO_TEMA[clave], enlaces[clave].archivo, `Photo of the "${enlaces[clave].titulo}" tradition of the Fiestas Charrotaurinas.`);
  }

  // Carteles: "Eventos destacados", ya en orden cronológico
  const carteles = [];
  const repetidos = {};
  for (const m of eventos.matchAll(/\{ id: (\d+), nombre: '([^']+)', fecha: '(\d+) (\w+)', url: require\('[^']*\/fiestasCharrotaurinas\/([^']+)'\) \}/g)) {
    const mes = MESES[m[4].toLowerCase()];
    if (!mes) fail(`PhotoEvent.tsx: mes desconocido "${m[4]}"`);
    const dia = Number(m[3]);
    const base = `cartel-${String(mes).padStart(2, "0")}${String(dia).padStart(2, "0")}`;
    repetidos[base] = (repetidos[base] || 0) + 1;
    const id = repetidos[base] === 1 ? base : `${base}-${repetidos[base]}`;
    const nombre = CORRECCIONES_CARTEL[m[2]] || m[2];
    carteles.push({ id, mes, dia, nombre, imagen: `/img/feria/${id}` });
    registrarFoto(id, m[5], `Official poster "${nombre}" (${dia}/${mes}) from the 2026 Fiestas Charrotaurinas program.`);
    plan[plan.length - 1].calidad = Q_CARTEL;
  }
  if (carteles.length !== 12) fail(`PhotoEvent.tsx: esperaba 12 carteles y hay ${carteles.length}`);

  // Servicios: solo los que la app pinta (las claves de serviceIcons)
  const bloque = /const serviceIcons[\s\S]*?\n {2}\};/.exec(iconos);
  if (!bloque) fail("ServicesIcon.tsx: no encontré serviceIcons");
  const pintables = new Set([...bloque[0].matchAll(/^ {4}(\w+): \{/gm)].map((m) => m[1]));
  const servicios = c.services.filter((s) => pintables.has(s.toLowerCase()));

  const edicion = /edición número (\d+)/.exec(c.bienvenida);
  const anio = /Festejos Charrotaurinos (\d{4})/.exec(c.bienvenida);
  if (!edicion || !anio) fail("feriaCharrotaurinaContent.ts: no encontré el número de edición o el año");
  if (!es.feriaPitch || !en.feriaPitch) fail("Faltan feriaPitch en es.json/en.json");

  return {
    feria: {
      edicion: { numero: Number(edicion[1]), anio: Number(anio[1]) },
      titulo: c.title,
      subtitulo: nombreMunicipio, // el código dice "Villa de Alvarez", sin acento
      municipioId: c.municipalityId,
      pitch: { es: es.feriaPitch, en: en.feriaPitch },
      portada: "/img/feria/portada",
      temas,
      historia: { es: historiaEs, en: FERIA_HISTORIA_EN },
      enlaces: {
        es: Object.fromEntries(claves.map((k) => [k, enlaces[k].etiqueta])),
        en: FERIA_ENLACES_EN,
      },
      carteles,
      // El código la llama "Río Los Amiales" (copiado de otro lugar); su descripción
      // habla del Recinto Ferial en el libramiento Griselda Álvarez.
      ubicacion: {
        nombre: "Recinto Ferial de Villa de Álvarez",
        descripcion: c.location.descriptionLocation,
        lat: c.location.latitude,
        lng: c.location.longitude,
      },
      servicios,
      abiertoTodoElDia: true,
    },
    portadaApp: portada[1],
  };
}

// ─── Textos reutilizables (data/i18n) ───────────────────────────────────────

function construirI18n(es, en, fiestas) {
  const iconos = leerOrigen("src/presentation/components/details/ServicesIcon.tsx");
  const calendario = leerOrigen("src/config/CalendarLocale.ts");
  const utilsFiestas = leerOrigen("src/presentation/components/colimaapp/fiestasPuebloUtils.ts");

  // Que la tabla de servicios cubra todas las claves que la app sabe pintar
  const bloque = /const serviceNames[\s\S]*?\};/.exec(iconos);
  const bloqueIconos = /const serviceIcons[\s\S]*?\n {2}\};/.exec(iconos);
  if (!bloque || !bloqueIconos) fail("ServicesIcon.tsx: no encontré serviceNames o serviceIcons");
  const nombresApp = Object.fromEntries([...bloque[0].matchAll(/^\s+(\w+): '([^']+)',/gm)].map((m) => [m[1], m[2]]));
  const clavesIconos = [...bloqueIconos[0].matchAll(/^ {4}(\w+): \{/gm)].map((m) => m[1]);
  for (const clave of clavesIconos) if (!SERVICIOS_NOMBRE[clave]) fail(`SERVICIOS_NOMBRE no cubre "${clave}" (la app lo pinta)`);
  for (const [clave, texto] of Object.entries(nombresApp)) {
    const ours = (SERVICIOS_NOMBRE[clave] || [""])[0];
    if (kebab(ours) !== kebab(texto)) console.warn(`  aviso: etiqueta de "${clave}" distinta de la app: "${ours}" vs "${texto}"`);
  }

  // Días y meses
  const dias = [...calendario.matchAll(/dayNames:\s*\[([^\]]*)\]/g)].map((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  if (dias.length < 2 || dias[0].length !== 7 || dias[1].length !== 7) fail("CalendarLocale.ts: no pude leer dayNames");
  const mesesCortosEs = (/const MESES_CORTOS = \[([^\]]*)\]/.exec(utilsFiestas) || [])[1];
  if (!mesesCortosEs) fail("fiestasPuebloUtils.ts: no encontré MESES_CORTOS");
  const mesesCortos = { es: [...mesesCortosEs.matchAll(/'([^']+)'/g)].map((m) => m[1]), en: en.months.map((m) => m.slice(0, 3)) };
  const diasCortos = (locale) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => locale.weekday[d]);

  const copiar = (locale, nombre, lista) => {
    const salida = {};
    for (const item of lista) {
      const [claveApp, claveWeb] = Array.isArray(item) ? item : [item, item];
      if (typeof locale[claveApp] !== "string") fail(`Falta "${claveApp}" en ${nombre}`);
      // La app interpola {{var}} (i18next); la guía web, {var} (lib/guia/i18n.js)
      salida[claveWeb] = locale[claveApp].replace(/\{\{(\w+)\}\}/g, "{$1}");
    }
    return salida;
  };
  // El `\n` de estos textos viene doble-escapado en es/en.json y se vería como "\n" literal
  const saltos = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v.replace(/\\n/g, "\n")]));
  // placesCount / placesCountOne tal cual y, para tn() de lib/guia/i18n.js, "lugares.uno" / "lugares.otros" con {n}
  const municipiosTextos = (textos) => ({
    ...textos,
    lugares: { uno: textos.placesCountOne, otros: textos.placesCount.replace("{count}", "{n}") },
  });
  const sugerencias = (locale) =>
    Object.keys(locale).filter((k) => k.startsWith("suggest") && !/^suggest(Rating|General|Event)/.test(k));

  const construir = (idioma, locale) => {
    const nombre = `${idioma}.json`;
    const i = idioma === "es" ? 0 : 1;
    const categorias = {};
    for (const c of CATEGORIAS) categorias[c.slug] = { nombre: (idioma === "es" && CORRECCION_CATEGORIA_ES[c.slug]) || locale[c.clave] };
    for (const c of CATEGORIAS_SIN_IMAGEN) categorias[c.slug] = { nombre: locale[c.clave] };
    for (const [slug, { nombre: n }] of Object.entries(categorias)) if (!n) fail(`Falta el nombre de la categoría ${slug} en ${nombre}`);

    const fechasTexto = {};
    for (const f of fiestas) {
      if (!f.fechaTexto) continue;
      if (idioma === "es") fechasTexto[f.id] = f.fechaTexto;
      else if (FECHA_TEXTO_EN[f.id]) fechasTexto[f.id] = FECHA_TEXTO_EN[f.id];
      else fail(`Falta la fecha de texto en inglés de la fiesta ${f.id} (FECHA_TEXTO_EN)`);
    }

    return {
      categorias,
      serviciosNombre: Object.fromEntries(Object.entries(SERVICIOS_NOMBRE).map(([k, v]) => [k, v[i]])),
      diasLargos: dias[i],
      diasCortos: diasCortos(locale),
      mesesLargos: locale.months,
      mesesCortos: mesesCortos[idioma],
      lugar: {
        ...copiar(locale, nombre, ["services", "description", "video", "location", "schedules", "openallday", "today", "watchVideo", "socialMedia", "photoBy", "sendPhotoTitle", "sendPhotoText", "sendPhotoButton", "noDescription", "noContentAvailable", "attractions", "hotels", "restaurants", "activities", "noRestaurantsAvailable", "noAttractionsAvailable", "noActivities", "knowOne", "letUsKnow", "recommendPlaceMessage"]),
        cerrado: TEXTOS_PROPIOS.cerrado[i],
        horarioPorConfirmar: TEXTOS_PROPIOS.horarioPorConfirmar[i],
        verEnMaps: TEXTOS_PROPIOS.verEnMaps[i],
      },
      tianguis: {
        ...copiar(locale, nombre, ["markets", "tianguis", "marketsOnly", "marketsSubtitle", "marketsPitch", "filterAll", "everyDay", "marketsEmpty", "marketsEmptyHint", "marketsFilterDay", "marketsFilterMunicipality", "marketsNoteTitle", "marketsNoteText", "marketsReportButton"]),
        temporada: TEXTOS_PROPIOS.temporada[i],
      },
      fiestas: {
        ...copiar(locale, nombre, [["town festivals", "townFestivals"], "townFestivalsIntro", "festivalDatesApprox", "festivalSource", "festivalSourceHint", "noFestivals"]),
        fechasTexto,
      },
      feria: copiar(locale, nombre, ["feriaPitch", "feriaHistory", "featuredEvents"]),
      municipios: municipiosTextos(copiar(locale, nombre, ["municipalities", "municipalitiesIntro", "seeMunicipality", "mapTitle", "mapHint", "volcanoName", "pacificOcean", "placesCount", "placesCountOne"])),
      rincones: copiar(locale, nombre, [["nature spots", "natureSpots"], "exploreColima"]),
      compartir: saltos(copiar(locale, nombre, ["share", "inviteFriend", "inviteFriendHint", "shareInviteMessage", "shareItemMessage"])),
      sugerir: copiar(locale, nombre, sugerencias(es)),
      contacto: copiar(locale, nombre, ["contact", "email", "privacyPolicy", "followUs", "developedBy", "aboutTitle"]),
      generales: copiar(locale, nombre, ["close", "goBack", "tryAgain", "somethingWentWrong", "couldNotLoadContent", "postNotAvailable"]),
    };
  };
  return { es: construir("es", es), en: construir("en", en) };
}

// ─── Categorías y portadas de tablas (solo imágenes) ───────────────────────

function planearCategorias(mapper) {
  for (const c of CATEGORIAS) {
    const origen = `assets/images/${c.carpeta}/${c.carpeta}.jpg`;
    if (!fs.existsSync(enOrigen(origen))) fail(`No existe ${origen}`);
    agregarImagen({ origen, salida: `c/${c.slug}`, cuadrado: 160, calidad: Q_MINIATURA, nota: `Square 160x160 center-cropped thumbnail of the "${c.slug}" category tab.` });
  }
  // Tablas colgantes de Inicio (MainScreen.tsx): Rincones usa lakes, Playas beaches, Tianguis la portada de tianguis
  // y la feria su portada. Fiestas del Pueblo y Municipios ya están en public/img (fiestas-del-pueblo-760, municipios-420).
  const portadas = [
    ["rincones", mapper.get("lakes")],
    ["playas", mapper.get("beaches")],
    ["tianguis", mapper.get("tianguisPortada")],
    ["feria", mapper.get("portadaCharrotaurinas")],
  ];
  for (const [nombre, origen] of portadas) {
    if (!origen || !fs.existsSync(enOrigen(origen))) fail(`No existe la portada de ${nombre} en el origen`);
    agregarImagen({ origen, salida: `c/portada-${nombre}`, anchos: [480, 800], calidad: Q_PORTADA, nota: `Cover for the "${nombre}" hanging sign on the home page.` });
  }
}

// ─── Conversión de imágenes ─────────────────────────────────────────────────

function encontrarCwebp() {
  for (const candidato of [process.env.CWEBP, "/opt/homebrew/bin/cwebp", "/usr/local/bin/cwebp", "cwebp"].filter(Boolean)) {
    try {
      execFileSync(candidato, ["-version"], { stdio: "ignore" });
      return candidato;
    } catch {}
  }
  return fail("No encontré cwebp. Instálalo con `brew install webp` o define CWEBP con su ruta.");
}

function prompt(origenRel, nota) {
  return `Origin: pre-existing Colima Go app asset, ${origenRel} in ColimagoMovil (React Native repo); converted to WebP with cwebp for colimago.mx. Use on the web guide (${FECHA_USO}).${nota ? ` ${nota}` : ""}`;
}

// Sidecar `<archivo>.webp.json` con el formato del repo. Conserva el createdAt
// de uno que ya exista.
function escribirSidecar(rutaWebp, texto) {
  const ruta = `${rutaWebp}.json`;
  let createdAt = new Date().toISOString();
  if (fs.existsSync(ruta)) {
    try {
      const previo = JSON.parse(fs.readFileSync(ruta, "utf8"));
      if (previo.createdAt) createdAt = previo.createdAt;
    } catch {}
  }
  const contenido = JSON.stringify({ prompt: texto, createdAt }, null, 2);
  if (!fs.existsSync(ruta) || fs.readFileSync(ruta, "utf8") !== contenido) fs.writeFileSync(ruta, contenido);
}

function convertirImagenes() {
  const cwebp = encontrarCwebp();
  const resumen = { convertidas: 0, omitidas: 0, bytes: 0, archivos: 0 };
  const porGrupo = {};
  const trabajos = [];
  for (const e of plan) {
    if (e.cuadrado) trabajos.push({ e, sufijo: "", ancho: null, cuadrado: e.cuadrado });
    else for (const ancho of e.anchos) trabajos.push({ e, sufijo: ancho === null ? "" : `-${ancho}`, ancho, cuadrado: 0 });
  }

  for (const t of trabajos) {
    const origen = enOrigen(t.e.origen);
    const destino = enRepo("public/img", `${t.e.salida}${t.sufijo}.webp`);
    const textoSidecar = prompt(t.e.origen, t.e.nota);
    const vigente =
      !FORZAR && fs.existsSync(destino) && fs.existsSync(`${destino}.json`) && fs.statSync(destino).mtimeMs >= fs.statSync(origen).mtimeMs;
    if (vigente) {
      resumen.omitidas += 1;
    } else {
      const dim = dimensionesJPEG(origen);
      const opciones = ["-quiet", "-m", "6", "-mt", "-q", String(t.e.calidad)];
      if (t.cuadrado) {
        const lado = Math.min(dim.ancho, dim.alto);
        const salida = Math.min(t.cuadrado, lado);
        opciones.push("-crop", String(Math.floor((dim.ancho - lado) / 2)), String(Math.floor((dim.alto - lado) / 2)), String(lado), String(lado));
        if (salida < lado) opciones.push("-resize", String(salida), String(salida));
      } else if (t.ancho && dim.ancho > t.ancho) {
        opciones.push("-resize", String(t.ancho), "0"); // nunca se amplía: si el original es menor, tal cual
      }
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      try {
        execFileSync(cwebp, [...opciones, origen, "-o", destino], { stdio: ["ignore", "ignore", "pipe"] });
      } catch (error) {
        fs.rmSync(destino, { force: true });
        fail(`cwebp falló con ${t.e.origen}: ${error.stderr ? error.stderr.toString().trim() : error.message}`);
      }
      resumen.convertidas += 1;
    }
    escribirSidecar(destino, textoSidecar);
    const bytes = fs.statSync(destino).size;
    resumen.bytes += bytes;
    resumen.archivos += 1;
    const grupo = t.e.salida.split("/")[0];
    porGrupo[grupo] = (porGrupo[grupo] || 0) + bytes;
  }
  return { resumen, porGrupo };
}

// ─── Principal ──────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(enOrigen("assets/catalog/catalog.json"))) fail(`${ORIGEN} no parece el repo de la app (falta assets/catalog/catalog.json)`);
  console.log(`Origen: ${ORIGEN}`);

  const es = leerJSONOrigen("src/locales/es.json");
  const en = leerJSONOrigen("src/locales/en.json");
  const mapper = cargarMapper();

  // Siempre se calcula todo en memoria (los datos dicen qué imágenes hacen falta)
  const municipios = construirMunicipios(mapper, es, en);
  const { mapa } = leerMapaFeria();
  const { lugares, catalogVersion, creditos, sinFoto } = construirLugares(mapper, municipios);
  const fiestas = construirFiestas();
  const { feria } = construirFeria(es, en, municipios);
  const i18n = construirI18n(es, en, fiestas);
  planearCategorias(mapper);

  const cuenta = (filtro) => lugares.filter(filtro).length;
  console.log(`Catálogo ${catalogVersion}: ${lugares.length} lugares, ${municipios.length} municipios, ${fiestas.length} fiestas, ${feria.carteles.length} carteles`);
  console.log(
    `  imágenes: ${cuenta((l) => l.imagen.tipo === "foto")} fotos (${Object.keys(creditos).length} con crédito), ${cuenta((l) => l.imagen.tipo === "ilustracion")} ilustraciones (${sinFoto.size} en lugaresSinFoto), ${cuenta((l) => l.imagen.tipo === "ninguna")} sin archivo`,
  );

  if (HACER_DATOS) {
    const salidas = [
      ["data/municipios.json", municipios],
      ["data/mapa-feria.json", mapa],
      ["data/lugares.json", lugares],
      ["data/fiestas-pueblo.json", fiestas],
      ["data/feria.json", feria],
      ["data/i18n/es/datos.json", i18n.es],
      ["data/i18n/en/datos.json", i18n.en],
    ];
    for (const [rel, objeto] of salidas) console.log(`  ${escribirJSON(rel, objeto) ? "escrito  " : "sin cambio"} ${rel}`);
  }

  if (HACER_IMAGENES) {
    console.log(`Convirtiendo imágenes (${plan.length} orígenes)…`);
    const { resumen, porGrupo } = convertirImagenes();
    const mb = (b) => (b / 1048576).toFixed(2);
    console.log(`  ${resumen.archivos} .webp: ${resumen.convertidas} convertidos, ${resumen.omitidas} ya vigentes, ${mb(resumen.bytes)} MB`);
    for (const [grupo, bytes] of Object.entries(porGrupo)) console.log(`    public/img/${grupo}/  ${mb(bytes)} MB`);
    if (resumen.bytes > PRESUPUESTO_MB * 1048576) {
      console.warn(`  ⚠ pasa del presupuesto de ${PRESUPUESTO_MB} MB: baja --q-foto o --q-ilustracion y repite con --forzar`);
    }
  }
}

main();
