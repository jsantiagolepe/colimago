#!/usr/bin/env node
// Segundo importador de la app móvil (repo ColimagoMovil, SOLO LECTURA): trae lo que
// la app sumó después del primero (scripts/importar-app-movil.js).
//
//   data/feria-santos.json            Feria de Todos los Santos 2026 (src/config/feriaSantosContent.ts)
//   data/gastronomia.json             platillos (src/config/gastronomia.ts)
//   data/i18n/{es,en}/<espacio>.json  textos de la app (src/locales/{es,en}.json), uno por función
//   public/img/feria-santos/          portada, gobernadora y logos de los escenarios
//   public/img/gastronomia/           fotos de los platillos
//
// Los textos de la app usan i18next ({{var}}, _one/_other); aquí se pasan a {var} y a
// las mismas claves con sufijo (lo lee tp() de lib/guia/i18n.js).
//
//   node scripts/importar-extras.js [--origen <ruta>]

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const i = process.argv.indexOf("--origen");
const ORIGEN = path.resolve(i === -1 ? "/Users/juliosantiago/Documents/React Native/ColimagoMovil" : process.argv[i + 1]);

const leer = (rel) => fs.readFileSync(path.join(ORIGEN, rel), "utf8");
const escribir = (rel, valor) => {
  const ruta = path.join(RAIZ, rel);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const texto = (typeof valor === "string" ? valor : JSON.stringify(valor, null, 2)) + "\n";
  if (!fs.existsSync(ruta) || fs.readFileSync(ruta, "utf8") !== texto) fs.writeFileSync(ruta, texto);
};

// ─── .ts de la app → objeto ─────────────────────────────────────────────────
function evaluarTS(fuente, retorno) {
  const js = fuente
    .replace(/require\('([^']+)'\)/g, (m, ruta) => JSON.stringify(path.basename(ruta)))
    .replace(/^export type [^=]+=\s*\{[\s\S]*?^\};?\s*$/gm, "")
    .replace(/^export type [^=]+=[^{]*?;\s*$/gm, "")
    .replace(/^export interface \w+ \{[\s\S]*?^\}\s*$/gm, "")
    .replace(/^export const (\w+)\s*(?::[^=]+)?=/gm, "const $1 =")
    .replace(/^const (\w+)\s*(?::[^=]+)?=/gm, "const $1 =");
  return JSON.parse(JSON.stringify(vm.runInNewContext(`(function(){\n${js}\n;return ${retorno};\n})()`, {}, { timeout: 2000 })));
}

// ─── Textos ─────────────────────────────────────────────────────────────────
// espacio web → claves de la app que lo forman ({ destino?: origen } o nombre)
const ESPACIOS = {
  gastro: ["gastronomy", "gastronomySubtitle", "gastronomyPitch", "gastronomyFeatured", "gastronomyTry", "gastronomyCount", "gastronomyPlacesOne", "gastronomyPlacesMany", "gastronomyWhere", "gastronomyWhereEmpty", "gastronomyEmpty", "gastronomyMissing", "dishFilter", "dishType", "dishes"],
  comer: ["eat"],
  cerca: ["nearby"],
  mapa: ["map"],
  pasaporte: ["passport"],
  listas: ["lists"],
  planes: ["plan"],
  buscar: ["search"],
  feriasantos: ["feriaSantos"],
  playaahora: ["beachNow"],
  resenas: ["resenas"],
  preguntas: ["preguntas"],
  vivo: ["vivo"],
  alertas: ["alertas"],
  alcalendario: ["toCalendar"],
  yo: ["me", "homeCards", "municipalitiesMap"],
};

function convertir(valor) {
  if (typeof valor === "string") return valor.replace(/\{\{\s*(\w+)\s*\}\}/g, "{$1}");
  if (Array.isArray(valor)) return valor.map(convertir);
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, convertir(v)]));
  return valor;
}

// Textos que en la web dicen otra cosa (el teléfono es el navegador, no hay "ajustes del teléfono").
const SOBRESCRITURAS = {
  es: {
    "pasaporte.passport.intro": "Sella cada lugar natural o turístico cuando llegues. Tus sellos se guardan en este navegador.",
    "pasaporte.passport.denied": "Sin permiso de ubicación no podemos sellar. Actívalo en la configuración del sitio de tu navegador.",
    "cerca.nearby.deniedText": "Sin tu ubicación no podemos ordenar los lugares por distancia. Permítela en la configuración del sitio de tu navegador o elige un municipio.",
    "mapa.map.deniedText": "Para ver lo que tienes cerca permite la ubicación en tu navegador.",
    "listas.lists.hint": "Los lugares que quieres visitar o ya visitaste. Se guardan en este navegador.",
    "planes.plan.emptyText": "Crea un plan con las fechas de tu viaje y ve agregando lugares y eventos desde su ficha.",
    "planes.plan.dayEmptyText": "Abre un lugar o un evento y toca \"Agregar al plan\".",
  },
  en: {
    "pasaporte.passport.intro": "Stamp each natural or tourist spot when you get there. Your stamps are saved in this browser.",
    "pasaporte.passport.denied": "Without location permission we can't stamp. Enable it in your browser's site settings.",
    "cerca.nearby.deniedText": "Without your location we can't sort places by distance. Allow it in your browser's site settings or pick a municipality.",
    "mapa.map.deniedText": "To see what is near you, allow location in your browser.",
    "listas.lists.hint": "The places you want to visit or have already visited. They are saved in this browser.",
    "planes.plan.emptyText": "Create a plan with your trip dates and add places and events from their page.",
    "planes.plan.dayEmptyText": "Open a place or an event and tap \"Add to plan\".",
  },
};

function importarTextos() {
  for (const lang of ["es", "en"]) {
    const fuente = JSON.parse(leer(`src/locales/${lang}.json`));
    for (const [espacio, claves] of Object.entries(ESPACIOS)) {
      const salida = {};
      for (const clave of claves) {
        if (!(clave in fuente)) {
          if (lang === "es") console.warn(`  aviso: ${clave} no está en es.json`);
          continue;
        }
        salida[clave] = convertir(fuente[clave]);
      }
      for (const [clavePunto, texto] of Object.entries(SOBRESCRITURAS[lang])) {
        const [esp, ...ruta] = clavePunto.split(".");
        if (esp !== espacio) continue;
        let nodo = salida;
        for (const parte of ruta.slice(0, -1)) nodo = nodo[parte] || (nodo[parte] = {});
        nodo[ruta[ruta.length - 1]] = texto;
      }
      escribir(`data/i18n/${lang}/${espacio}.json`, salida);
    }
  }
}

// ─── Datos ──────────────────────────────────────────────────────────────────
function importarFeria() {
  const f = evaluarTS(leer("src/config/feriaSantosContent.ts"), "{titulo,edicion,FERIA_COLIMA_ID,inicio,fin,COLOR_FERIA,bienvenida,firmante,cargoFirmante,lugares,programa}");
  const lugares = f.lugares.map((l) => ({ id: l.id, nombre: l.nombre, logo: `/img/feria-santos/${path.basename(l.logo, ".png")}.webp`, estelar: !!l.estelar }));
  const programa = f.programa.map((d) => ({
    fecha: d.fecha,
    eventos: d.eventos.map(([hora, lugar, nombre]) => ({ hora, lugar, nombre })),
  }));
  escribir("data/feria-santos.json", {
    titulo: f.titulo,
    edicion: f.edicion,
    lugarId: f.FERIA_COLIMA_ID,
    inicio: f.inicio,
    fin: f.fin,
    color: f.COLOR_FERIA,
    firmante: f.firmante,
    cargoFirmante: f.cargoFirmante,
    bienvenida: f.bienvenida,
    lugares,
    programa,
  });
  const eventos = programa.reduce((n, d) => n + d.eventos.length, 0);
  console.log(`  feria: ${programa.length} días, ${eventos} eventos, ${lugares.length} lugares`);
}

function importarGastronomia() {
  const platillos = evaluarTS(leer("src/config/gastronomia.ts"), "platillos");
  // `lugares` son _id del catálogo: aquí se guardan los slugs de la guía
  const catalogo = JSON.parse(fs.readFileSync(path.join(RAIZ, "data/lugares.json"), "utf8"));
  const lista = Array.isArray(catalogo) ? catalogo : catalogo.lugares;
  const slugDe = new Map(lista.map((l) => [l.id, l.slug]));
  const salida = platillos.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    destacado: !!p.destacado,
    foto: p.imageKey ? `/img/gastronomia/${p.imageKey}` : null,
    lugares: p.lugares.map((id) => slugDe.get(id)).filter(Boolean),
  }));
  escribir("data/gastronomia.json", salida);
  console.log(`  gastronomía: ${salida.length} platillos`);
}

// ─── Imágenes (cwebp; los PNG de los logos conservan su transparencia) ──────
function cwebp() {
  for (const c of [process.env.CWEBP, "/opt/homebrew/bin/cwebp", "/usr/local/bin/cwebp"].filter(Boolean)) if (fs.existsSync(c)) return c;
  throw new Error("No encontré cwebp (brew install webp)");
}
function convertir_img(origenRel, salidaRel, ancho) {
  const destino = path.join(RAIZ, "public/img", salidaRel);
  const origen = path.join(ORIGEN, origenRel);
  if (fs.existsSync(destino) && fs.statSync(destino).mtimeMs >= fs.statSync(origen).mtimeMs) return;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const opciones = ["-quiet", "-m", "6", "-q", "72", "-alpha_q", "90"];
  if (ancho) opciones.push("-resize", String(ancho), "0");
  execFileSync(cwebp(), [...opciones, origen, "-o", destino]);
  fs.writeFileSync(`${destino}.json`, JSON.stringify({ prompt: `Origin: ${origenRel} in ColimagoMovil (React Native repo), converted to WebP with cwebp for colimago.mx (2026-10-31).`, createdAt: new Date().toISOString() }, null, 2));
}
function importarImagenes() {
  convertir_img("assets/images/feria2026/portada.webp", "feria-santos/portada.webp", 960);
  convertir_img("assets/images/feria2026/gobernadora.webp", "feria-santos/gobernadora.webp", 360);
  convertir_img("assets/images/feria2026/logo-blanco.png", "feria-santos/logo-blanco.webp", 320);
  for (const f of fs.readdirSync(path.join(ORIGEN, "assets/images/feria2026/lugares"))) {
    if (f.endsWith(".png")) convertir_img(`assets/images/feria2026/lugares/${f}`, `feria-santos/${f.replace(/\.png$/, ".webp")}`, 240);
  }
  for (const carpeta of fs.readdirSync(path.join(ORIGEN, "assets/images/gastronomia"))) {
    const dir = path.join(ORIGEN, "assets/images/gastronomia", carpeta);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".webp")) continue;
      const base = f.replace(/\.webp$/, "");
      convertir_img(`assets/images/gastronomia/${carpeta}/${f}`, `gastronomia/${base}-480.webp`, 480);
      convertir_img(`assets/images/gastronomia/${carpeta}/${f}`, `gastronomia/${base}-800.webp`, 800);
    }
  }
}

console.log(`Origen: ${ORIGEN}`);
importarTextos();
importarFeria();
importarGastronomia();
importarImagenes();
console.log("Listo.");
