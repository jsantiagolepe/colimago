#!/usr/bin/env node
// Verificación rápida de la capa de datos locales de la guía: que los JSON de
// data/ (generados por scripts/importar-app-movil.js) tengan los conteos y la
// forma que documenta docs/guia-datos.md, que cada imagen que referencian
// exista en public/img (con su sidecar, sin ampliar el original y dentro del
// presupuesto de peso) y que la lógica de lib/guia/datos.js (tianguis y
// fiestas) dé los resultados de la app móvil, incluido el cruce de año y la
// zona horaria.
//
// No necesita red ni la app móvil.
//
//   npm run verificar:datos
//   (o) node scripts/verificar-datos.js

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const datos = require("../lib/guia/datos");

const leerJSON = (rel) => JSON.parse(fs.readFileSync(path.join(RAIZ, rel), "utf8"));
const enImg = (...partes) => path.join(RAIZ, "public", "img", ...partes);

let pasaron = 0;
let fallaron = 0;
function prueba(nombre, fn) {
  try {
    fn();
    pasaron += 1;
    console.log(`  ok     ${nombre}`);
  } catch (error) {
    fallaron += 1;
    console.log(`  FALLA  ${nombre}\n         ${String(error.message).split("\n").join("\n         ")}`);
  }
}

// Medidas de un .webp (lossy VP8, lossless VP8L o extendido VP8X) leyendo su cabecera.
function dimensionesWebp(ruta) {
  const b = fs.readFileSync(ruta);
  assert(b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP", `${ruta} no es WebP`);
  const tipo = b.toString("ascii", 12, 16);
  if (tipo === "VP8 ") return { ancho: b.readUInt16LE(26) & 0x3fff, alto: b.readUInt16LE(28) & 0x3fff };
  if (tipo === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { ancho: (bits & 0x3fff) + 1, alto: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (tipo === "VP8X") return { ancho: b.readUIntLE(24, 3) + 1, alto: b.readUIntLE(27, 3) + 1 };
  throw new Error(`${ruta}: tipo WebP desconocido ${tipo}`);
}

// Que exista public/img/<ruta>.webp (la ruta va sin extensión, como en los JSON)
// y su sidecar con el formato del repo.
const archivosRevisados = new Set();
function exigirImagen(ruta) {
  const webp = enImg(`${ruta.replace(/^\/img\//, "").replace(/^\//, "").replace(/\.webp$/, "")}.webp`);
  assert(fs.existsSync(webp), `falta ${path.relative(RAIZ, webp)}`);
  assert(fs.existsSync(`${webp}.json`), `falta el sidecar ${path.relative(RAIZ, webp)}.json`);
  if (!archivosRevisados.has(webp)) {
    archivosRevisados.add(webp);
    const sidecar = JSON.parse(fs.readFileSync(`${webp}.json`, "utf8"));
    assert(typeof sidecar.prompt === "string" && sidecar.prompt.startsWith("Origin: pre-existing Colima Go app asset,"), `sidecar mal formado: ${webp}.json`);
    assert(!Number.isNaN(Date.parse(sidecar.createdAt)), `createdAt inválido en ${webp}.json`);
  }
  return webp;
}

const lugares = datos.lugares;
const cuenta = (lista, clave) => lista.reduce((acc, x) => ((acc[clave(x)] = (acc[clave(x)] || 0) + 1), acc), {});

console.log("Conteos y forma de los datos");

prueba("178 lugares, por tipo y por municipio como en la app", () => {
  assert.strictEqual(lugares.length, 178);
  assert.deepStrictEqual(cuenta(lugares, (l) => l.tipo), { 10: 9, 11: 15, 12: 10, 13: 13, 14: 4, 15: 16, 16: 21, 17: 11, 18: 5, 20: 2, 21: 2, 30: 54, 31: 16 });
  assert.deepStrictEqual(cuenta(lugares, (l) => l.municipioId), { 1: 59, 2: 22, 3: 25, 4: 22, 5: 6, 6: 18, 7: 7, 8: 12, 9: 5, 10: 2 });
});

prueba("ids y slugs únicos; slug en kebab sin acentos", () => {
  assert.strictEqual(new Set(lugares.map((l) => l.id)).size, 178);
  assert.strictEqual(new Set(lugares.map((l) => l.slug)).size, 178);
  for (const l of lugares) assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.slug), `slug inválido: ${l.slug}`);
  for (const l of lugares) assert.strictEqual(datos.lugarPorSlug(l.slug).id, l.id);
  for (const l of lugares) assert.strictEqual(datos.lugarPorId(l.id).slug, l.slug);
});

prueba("lugares.json va ordenado por tipo y luego por título (es)", () => {
  const colador = new Intl.Collator("es");
  const crudo = leerJSON("data/lugares.json");
  for (let i = 1; i < crudo.length; i += 1) {
    const a = crudo[i - 1];
    const b = crudo[i];
    assert(a.tipo < b.tipo || (a.tipo === b.tipo && colador.compare(a.titulo, b.titulo) <= 0), `fuera de orden: ${a.titulo} / ${b.titulo}`);
  }
});

prueba("esquema de cada lugar: solo las claves documentadas, sin campos de exportación", () => {
  const permitidas = new Set(["id", "slug", "tipo", "municipioId", "titulo", "subtitulo", "descripcion", "imagen", "ubicacion", "ubicacionTexto", "servicios", "horario", "abiertoTodoElDia", "horarioInventado", "tiktok", "redes", "direccion", "telefono", "sitioWeb", "calificacion", "rango", "dias", "semanasDelMes", "temporada"]);
  for (const l of lugares) {
    for (const clave of Object.keys(l)) assert(permitidas.has(clave), `${l.slug}: clave inesperada ${clave}`);
    for (const clave of ["date", "finishDate", "createdAt", "updatedAt"]) assert(!(clave in l), `${l.slug}: trae ${clave}`);
    assert(l.subtitulo === datos.municipioPorId(l.municipioId).nombre, `${l.slug}: subtítulo sin acentos o distinto del municipio`);
    assert(typeof l.descripcion.es === "string" && l.descripcion.es.length > 0, `${l.slug}: sin descripción`);
    assert(l.descripcion.en === null || l.descripcion.en.length > 0, `${l.slug}: en vacío en vez de null`);
    assert(Array.isArray(l.horario) && Array.isArray(l.servicios) && typeof l.redes === "object", `${l.slug}: forma`);
    for (const fila of l.horario) assert(typeof fila.dia === "string" && (fila.horas === null || typeof fila.horas === "string"), `${l.slug}: fila de horario`);
  }
  assert.strictEqual(lugares.filter((l) => l.descripcion.en === null).length, 19);
});

prueba("10 municipios con slug, apodo, textos, estampa, foto y posición en el mapa", () => {
  const m = datos.municipios;
  assert.strictEqual(m.length, 10);
  assert.deepStrictEqual(m.map((x) => x.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepStrictEqual(m.map((x) => x.slug), ["colima", "villa-de-alvarez", "manzanillo", "comala", "minatitlan", "tecoman", "armeria", "coquimatlan", "cuauhtemoc", "ixtlahuacan"]);
  assert.strictEqual(m[1].nombre, "Villa de Álvarez");
  for (const x of m) {
    for (const campo of ["apodo", "descCorta", "descLarga"]) assert(x[campo].es && x[campo].en, `${x.slug}: falta ${campo} es/en`);
    assert(x.mapa.x > 0 && x.mapa.x < 1 && x.mapa.y > 0 && x.mapa.y < 1 && ["derecha", "izquierda", "abajo"].includes(x.mapa.lado), `${x.slug}: mapa`);
    exigirImagen(x.foto.replace(/\.webp$/, ""));
    assert(fs.existsSync(enImg(x.estampa.replace(/^\/img\//, ""))), `falta ${x.estampa}`);
  }
});

prueba("mapa de feria: 13 cables entre ids 0..10, volcán, costa y proporción", () => {
  const mapa = datos.mapaFeria;
  assert.strictEqual(mapa.cables.length, 13);
  for (const [a, b] of mapa.cables) assert(a >= 0 && a <= 10 && b >= 0 && b <= 10 && a !== b);
  assert.deepStrictEqual([mapa.volcan.x, mapa.volcan.y, mapa.aspecto], [0.86, 0.07, 0.8]);
  assert(mapa.costa.startsWith("M0,") && !/[${}]/.test(mapa.costa));
});

prueba("44 fiestas: 30 aproximadas, 2 de fecha en texto, municipios válidos, 12 meses", () => {
  assert.strictEqual(datos.fiestas.length, 44);
  assert.strictEqual(new Set(datos.fiestas.map((f) => f.id)).size, 44);
  assert.strictEqual(datos.fiestas.filter((f) => f.aproximada).length, 30);
  assert.strictEqual(datos.fiestas.filter((f) => f.fechaTexto).length, 2);
  for (const f of datos.fiestas) {
    assert(datos.municipioPorId(f.municipioId), `${f.id}: municipio`);
    assert(f.descripcion.es && f.fuente.nombre && /^https?:\/\//.test(f.fuente.url), `${f.id}: descripción o fuente`);
    assert(f.inicio.mes >= 1 && f.inicio.mes <= 12 && f.inicio.dia >= 1 && f.inicio.dia <= 31, `${f.id}: inicio`);
  }
});

prueba("sin datos de relleno: hoteles/restaurantes sin teléfono, calificación ni precio; 12 horarios inventados", () => {
  for (const l of lugares.filter((x) => x.tipo === 20 || x.tipo === 21)) assert(l.telefono === null && l.calificacion === null && l.rango === null, l.slug);
  const inventados = lugares.filter((l) => l.horarioInventado);
  assert.strictEqual(inventados.length, 12);
  for (const l of inventados) assert(l.abiertoTodoElDia === true && l.horario.length > 0, l.slug);
  assert.strictEqual(lugares.filter((l) => l.abiertoTodoElDia).length, 39);
});

prueba("ubicación: 167 con coordenadas válidas (ninguna 0,0); 9 tianguis solo con texto; 2 sin nada", () => {
  const con = lugares.filter((l) => l.ubicacion);
  assert.strictEqual(con.length, 167);
  for (const l of con) assert(Number.isFinite(l.ubicacion.lat) && Number.isFinite(l.ubicacion.lng) && !(l.ubicacion.lat === 0 && l.ubicacion.lng === 0), l.slug);
  const soloTexto = lugares.filter((l) => !l.ubicacion && l.ubicacionTexto);
  assert.strictEqual(soloTexto.length, 9);
  for (const l of soloTexto) assert(l.tipo === 30 && l.ubicacionTexto.nombre, l.slug);
  assert.strictEqual(lugares.filter((l) => !l.ubicacion && !l.ubicacionTexto).length, 2);
  assert.strictEqual(datos.textoUbicacion(soloTexto[0]).nombre, soloTexto[0].ubicacionTexto.nombre);
  assert.strictEqual(datos.tieneMapa(soloTexto[0]), false);
});

console.log("\nImágenes");

prueba("imágenes: 56 fotos, 118 ilustraciones, 4 sin archivo; 41 con crédito de Wikimedia", () => {
  assert.deepStrictEqual(cuenta(lugares, (l) => l.imagen.tipo), { foto: 56, ilustracion: 118, ninguna: 4 });
  const creditos = lugares.filter((l) => l.imagen.credito);
  assert.strictEqual(creditos.length, 41);
  for (const l of creditos) {
    const c = l.imagen.credito;
    assert(l.imagen.tipo === "foto" && c.autor && c.licencia && c.fuente === "Wikimedia Commons" && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(c.url), `${l.slug}: crédito`);
  }
  for (const l of lugares.filter((x) => x.imagen.tipo === "ilustracion")) assert.strictEqual(l.imagen.credito, null, l.slug);
  for (const l of lugares.filter((x) => x.imagen.tipo === "ninguna")) {
    assert.deepStrictEqual([l.imagen.clave, l.imagen.archivo, l.imagen.ancho, l.imagen.alto, l.imagen.credito], [null, null, null, null, null], l.slug);
    assert([20, 21].includes(l.tipo));
  }
});

prueba("cada imagen de lugar existe en -480 y -800 (con sidecar) y nunca se amplió", () => {
  let revisadas = 0;
  for (const l of lugares.filter((x) => x.imagen.archivo)) {
    const { clave, archivo, ancho, alto } = l.imagen;
    assert.strictEqual(archivo, `l/${clave}`);
    for (const objetivo of [480, 800]) {
      const dim = dimensionesWebp(exigirImagen(`${archivo}-${objetivo}`));
      assert.strictEqual(dim.ancho, Math.min(objetivo, ancho), `${archivo}-${objetivo}: ancho ${dim.ancho}`);
      assert(Math.abs(dim.alto - (dim.ancho * alto) / ancho) <= 1.5, `${archivo}-${objetivo}: proporción`);
      revisadas += 1;
    }
    assert.strictEqual(datos.rutaImagen(l.imagen, 480), `/img/${archivo}-480.webp`);
  }
  assert.strictEqual(revisadas, 348);
  assert.strictEqual(datos.rutaImagen(lugares.find((l) => l.imagen.tipo === "ninguna").imagen, 800), null);
});

prueba("feria: portada, 8 fotos de temas y 12 carteles existen en -480 y -800", () => {
  const feria = datos.feria;
  const rutas = [feria.portada, ...Object.values(feria.temas).map((t) => t.foto), ...feria.carteles.map((c) => c.imagen)];
  assert.strictEqual(rutas.length, 1 + 8 + 12);
  for (const ruta of rutas) for (const objetivo of [480, 800]) assert(dimensionesWebp(exigirImagen(`${ruta}-${objetivo}`)).ancho <= objetivo);
});

prueba("categorías y portadas: 11 miniaturas de 160×160 y 4 portadas -480/-800", () => {
  for (const c of [...datos.categoriasRincones, ...datos.categoriasTianguis]) {
    const dim = dimensionesWebp(exigirImagen(c.miniatura));
    assert.deepStrictEqual([dim.ancho, dim.alto], [160, 160], c.slug);
  }
  for (const nombre of ["rincones", "playas", "tianguis", "feria"]) for (const objetivo of [480, 800]) exigirImagen(`/img/c/portada-${nombre}-${objetivo}`);
});

prueba("las imágenes nuevas (l, m, c, feria) pesan menos de 12 MB", () => {
  let bytes = 0;
  let archivos = 0;
  for (const carpeta of ["l", "m", "c", "feria"]) {
    for (const f of fs.readdirSync(enImg(carpeta)).filter((x) => x.endsWith(".webp"))) {
      bytes += fs.statSync(enImg(carpeta, f)).size;
      archivos += 1;
      assert(fs.existsSync(enImg(carpeta, `${f}.json`)), `${carpeta}/${f} sin sidecar`);
    }
  }
  assert.strictEqual(archivos, 419);
  assert(bytes < 12 * 1024 * 1024, `${(bytes / 1048576).toFixed(2)} MB`);
});

console.log("\nFeria charrotaurina");

prueba("feria: ubicación corregida, 12 carteles en orden, 6 enlaces con sus temas, sin relleno", () => {
  const f = datos.feria;
  assert.strictEqual(f.municipioId, 2);
  assert.strictEqual(f.ubicacion.nombre, "Recinto Ferial de Villa de Álvarez");
  assert(!/Amiales/.test(JSON.stringify(f)), "queda 'Río Los Amiales'");
  assert(!("schedule" in f) && !("horario" in f) && !("videoTikTok" in f) && !("tiktok" in f));
  assert(f.abiertoTodoElDia === true);
  assert.deepStrictEqual(f.servicios, ["restaurant", "bathroom", "local_parking", "food_drink", "pet_friendly"]);
  assert.strictEqual(f.carteles.length, 12);
  assert.strictEqual(new Set(f.carteles.map((c) => c.id)).size, 12);
  for (let i = 1; i < 12; i += 1) assert(f.carteles[i - 1].mes * 100 + f.carteles[i - 1].dia <= f.carteles[i].mes * 100 + f.carteles[i].dia, "carteles fuera de orden");
  for (const idioma of ["es", "en"]) {
    const marcadores = (f.historia[idioma].match(/\{(\w+)\}/g) || []).map((m) => m.slice(1, -1));
    assert.deepStrictEqual(marcadores.sort(), ["cabalgatas", "despedidaPayaso", "enanitosToreros", "mojigangos", "petatera", "recibimientos"], idioma);
    for (const m of marcadores) assert(f.temas[m] && f.enlaces[idioma][m], `${idioma}: ${m}`);
  }
  assert(f.temas.bienvenida.autor && f.temas.reina.autor);
  assert.strictEqual(f.edicion.numero, 169);
});

console.log("\nTextos reutilizables (data/i18n/*/datos.json)");

prueba("es y en tienen las mismas claves; categorías, servicios, días y meses completos", () => {
  const claves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? claves(v, `${p}${k}.`) : [`${p}${k}`]));
  const es = datos.textos("es");
  const en = datos.textos("en");
  assert.deepStrictEqual(claves(es).sort(), claves(en).sort());
  assert.strictEqual(Object.keys(es.categorias).length, 13);
  assert.strictEqual(es.categorias.rios.nombre, "Ríos");
  assert.strictEqual(en.categorias.rios.nombre, "Rivers");
  for (const l of lugares) for (const s of l.servicios) if (l.tipo < 20) assert(es.serviciosNombre[s.toLowerCase()], `servicio sin nombre: ${s} (${l.slug})`);
  for (const t of [es, en]) {
    assert([t.diasLargos.length, t.diasCortos.length, t.mesesLargos.length, t.mesesCortos.length].join() === "7,7,12,12");
    assert(!/\{\{/.test(JSON.stringify(t)), "quedan {{…}} de i18next");
  }
  assert.deepStrictEqual([es.diasCortos[0], es.diasCortos[6], en.diasCortos[0]], ["Dom", "Sáb", "Sun"]);
  assert.strictEqual(datos.nombreCategoria("tianguis", "es"), "Tianguis");
  assert.strictEqual(datos.servicioNombre("local_parking", "en"), "Parking");
  assert.strictEqual(datos.servicioNombre("Wifi gratis", "es"), null);
});

console.log("\nLógica de tianguis y mercados");

prueba("catálogo de consultas: categorías de rincones, lugares por tipo y por municipio", () => {
  assert.deepStrictEqual(datos.categoriasRincones.map((c) => [c.slug, c.tipo]), [["rios", 10], ["playas", 11], ["lagunas", 12], ["montanas", 13], ["arqueologia", 14], ["parques", 15], ["patrimonio", 16], ["balnearios", 17], ["rutas", 18]]);
  assert.strictEqual(datos.categoriasRincones[0].miniatura, "/img/c/rios");
  assert.strictEqual(datos.categoriaPorSlug("lagunas").tipo, 12);
  assert.strictEqual(datos.lugaresPorTipo(11).length, 15);
  const m1 = datos.lugaresDeMunicipio(1);
  assert.deepStrictEqual([m1.atracciones.length, m1.hoteles.length, m1.restaurantes.length, m1.tianguis.length, m1.mercados.length], [24, 2, 1, 26, 6]);
  assert.strictEqual(datos.lugaresDeMunicipio(3).restaurantes.length, 1);
  assert.strictEqual(datos.lugaresDeMunicipio(10).tianguis.length + datos.lugaresDeMunicipio(10).mercados.length, 0);
  const tipos = m1.atracciones.map((l) => l.tipo);
  assert.deepStrictEqual(tipos, [...tipos].sort((a, b) => a - b), "atracciones por tipo");
});

prueba("filtrarTianguis: total, por día (los de temporada solo con 'todos') y por municipio", () => {
  assert.strictEqual(datos.filtrarTianguis({ tipo: 30 }).length, 54);
  assert.strictEqual(datos.filtrarTianguis({ tipo: 31 }).length, 16);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6].map((dia) => datos.filtrarTianguis({ tipo: 30, dia }).length), [13, 5, 3, 6, 4, 7, 15]);
  assert.strictEqual(datos.filtrarTianguis({ tipo: 31, dia: 3 }).length, 16, "los mercados abren todos los días");
  const navidenos = datos.filtrarTianguis({ tipo: 30 }).filter((l) => l.temporada);
  assert.strictEqual(navidenos.length, 2);
  for (let dia = 0; dia < 7; dia += 1) assert(!datos.filtrarTianguis({ tipo: 30, dia }).some((l) => l.temporada), "navideño en un día");
  assert.deepStrictEqual(cuenta(datos.filtrarTianguis({ tipo: 30 }), (l) => l.municipioId), { 1: 26, 2: 12, 3: 4, 4: 4, 5: 1, 6: 5, 7: 1, 8: 1 });
  assert.deepStrictEqual(cuenta(datos.filtrarTianguis({ tipo: 31 }), (l) => l.municipioId), { 1: 6, 3: 5, 6: 3, 7: 1, 9: 1 });
  assert.strictEqual(datos.filtrarTianguis({ tipo: 30, dia: 6, municipioId: 1 }).every((l) => l.municipioId === 1 && l.dias.includes(6)), true);
  assert.deepStrictEqual(datos.municipiosConLugares(30), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepStrictEqual(datos.municipiosConLugares(31), [1, 3, 6, 7, 9]);
  const colador = new Intl.Collator("es");
  const lista = datos.filtrarTianguis({ tipo: 30 });
  for (let i = 1; i < lista.length; i += 1) assert(lista[i - 1].municipioId < lista[i].municipioId || (lista[i - 1].municipioId === lista[i].municipioId && colador.compare(lista[i - 1].titulo, lista[i].titulo) <= 0), "orden municipio y título");
  assert.strictEqual(datos.filtrarTianguis({ tipo: "30", dia: "0", municipioId: "1" }).length, datos.filtrarTianguis({ tipo: 30, dia: 0, municipioId: 1 }).length);
});

prueba("etiquetaDias y cuandoSePone, en español y en inglés", () => {
  assert.strictEqual(datos.etiquetaDias([0, 1, 2, 3, 4, 5, 6], "es"), "Todos los días");
  assert.strictEqual(datos.etiquetaDias([0, 1, 2, 3, 4, 5, 6], "en"), "Every day");
  assert.strictEqual(datos.etiquetaDias([1, 2, 3, 4, 5], "es"), "Lun–Vie");
  assert.strictEqual(datos.etiquetaDias([6, 0], "es"), "Sáb, Dom");
  assert.strictEqual(datos.etiquetaDias([0, 6], "es"), "Sáb, Dom", "la semana empieza en lunes");
  assert.strictEqual(datos.etiquetaDias([1, 3, 6], "es"), "Lun, Mié y Sáb");
  assert.strictEqual(datos.etiquetaDias([1, 3, 6], "en"), "Mon, Wed and Sat");
  assert.strictEqual(datos.etiquetaDias([4, 5, 6, 0], "es"), "Jue–Dom");
  assert.strictEqual(datos.etiquetaDias([], "es"), "");
  const villa = lugares.find((l) => /^Tianguis de la Villa/.test(l.titulo));
  assert.strictEqual(datos.cuandoSePone(villa, "es"), "Dom · 07:00 - 14:00");
  assert.strictEqual(datos.cuandoSePone(villa, "en"), "Sun · 07:00 - 14:00");
  const mercado = lugares.find((l) => l.titulo === "Mercado Constitución");
  assert.strictEqual(datos.cuandoSePone(mercado, "es"), "Todos los días · 07:00 - 17:00");
  // "Horario por confirmar" no es un horario: se omite del resumen
  const sinHora = lugares.find((l) => /Los domingos vamos a Comala/.test(l.titulo));
  assert.strictEqual(datos.horasResumen(sinHora), null);
  assert.strictEqual(datos.cuandoSePone(sinHora, "es"), "Dom");
  // varios horarios distintos: el resumen no elige uno
  const varios = lugares.filter((l) => l.tipo >= 30).find((l) => new Set(l.horario.map((h) => h.horas).filter((h) => h && h !== datos.SIN_HORARIO)).size > 1);
  assert.strictEqual(datos.horasResumen(varios), null);
  const pulgas = lugares.find((l) => l.titulo === "Tianguis Navideño de Las Pulgas");
  assert.strictEqual(datos.etiquetaTemporada(pulgas, "es"), "19 dic – 24 dic");
  assert.strictEqual(datos.etiquetaTemporada(villa, "es"), "");
});

prueba("seCelebraEn / tianguisDelDia: día de la semana, semana del mes y temporada", () => {
  assert.strictEqual(datos.diaSemana("2026-10-18"), 0);
  assert.strictEqual(datos.diaSemana("2026-10-20"), 2);
  assert.strictEqual(datos.diaSemana("2026-10-24"), 6);
  const andador = lugares.find((l) => /Andador Constitución/.test(l.titulo));
  const comuna = lugares.find((l) => /La Comuna/.test(l.titulo));
  assert(datos.seCelebraEn(andador, "2026-10-10") && !datos.seCelebraEn(andador, "2026-10-17"), "segundo sábado");
  assert(datos.seCelebraEn(comuna, "2026-10-31") && !datos.seCelebraEn(comuna, "2026-10-24"), "último sábado");
  const pulgas = lugares.find((l) => l.titulo === "Tianguis Navideño de Las Pulgas");
  assert(datos.seCelebraEn(pulgas, "2026-12-20") && !datos.seCelebraEn(pulgas, "2026-10-20") && !datos.seCelebraEn(pulgas, "2026-12-25"), "temporada 19–24 dic");
  const villa = lugares.find((l) => /^Tianguis de la Villa/.test(l.titulo));
  assert(datos.tianguisDelDia("2026-10-18").some((l) => l.id === villa.id) && !datos.tianguisDelDia("2026-10-19").some((l) => l.id === villa.id));
  for (let d = 18; d <= 24; d += 1) assert(datos.tianguisDelDia(`2026-10-${d}`).length > 0, `sin tianguis el ${d}`);
  assert(!datos.tianguisDelDia("2026-10-18").some((l) => l.tipo === 31), "los mercados nunca salen");
});

console.log("\nLógica de fiestas del pueblo");

prueba("esVigente: rangos de un día, del mismo mes, que cruzan de mes y que cruzan el año", () => {
  const f = (id) => datos.fiestaPorId(id);
  const hoy = (mes, dia) => ({ mes, dia });
  const expiracion = f("senor-expiracion-coquimatlan"); // 28 dic – 12 ene
  for (const [mes, dia, esperado] of [[12, 27, false], [12, 28, true], [12, 31, true], [1, 1, true], [1, 5, true], [1, 12, true], [1, 13, false], [6, 1, false]]) {
    assert.strictEqual(datos.esVigente(expiracion, hoy(mes, dia)), esperado, `${dia}/${mes}`);
  }
  const queso = f("queso-y-tinto-comala"); // 15–18 oct
  assert.deepStrictEqual([14, 15, 18, 19].map((d) => datos.esVigente(queso, hoy(10, d))), [false, true, true, false]);
  const limon = f("feria-limon-tecoman"); // 23 ene – 3 feb
  assert.deepStrictEqual([[1, 22], [1, 23], [1, 31], [2, 3], [2, 4]].map(([m, d]) => datos.esVigente(limon, hoy(m, d))), [false, true, true, true, false]);
  const salud = f("virgen-salud-colima"); // 2 feb
  assert.deepStrictEqual([[2, 1], [2, 2], [2, 3]].map(([m, d]) => datos.esVigente(salud, hoy(m, d))), [false, true, false]);
  const ilumina = f("manzanillo-se-ilumina"); // 31 dic
  assert.deepStrictEqual([[12, 30], [12, 31], [1, 1]].map(([m, d]) => datos.esVigente(ilumina, hoy(m, d))), [false, true, false]);
  const carnaval = f("carnaval-manzanillo"); // fecha en texto: nunca es "de hoy"
  assert.strictEqual(datos.esVigente(carnaval, hoy(2, 7)), false);
  assert.strictEqual(datos.esVigente(salud, null), false);
  assert.strictEqual(datos.esVigente(salud, { mes: "x", dia: 2 }), false);
  // ningún día del año deja de ser consultable: cada fiesta con rango fijo es vigente en su inicio
  for (const fiesta of datos.fiestas.filter((x) => !x.fechaTexto)) assert(datos.esVigente(fiesta, hoy(fiesta.inicio.mes, fiesta.inicio.dia)), fiesta.id);
});

prueba("etiquetaFecha y cifraDia", () => {
  const f = (id) => datos.fiestaPorId(id);
  assert.strictEqual(datos.etiquetaFecha(f("virgen-salud-colima"), "es"), "2 feb");
  assert.strictEqual(datos.etiquetaFecha(f("queso-y-tinto-comala"), "es"), "15–18 oct");
  assert.strictEqual(datos.etiquetaFecha(f("feria-limon-tecoman"), "es"), "23 ene – 3 feb");
  assert.strictEqual(datos.etiquetaFecha(f("senor-expiracion-coquimatlan"), "es"), "28 dic – 12 ene");
  assert.strictEqual(datos.etiquetaFecha(f("virgen-salud-colima"), "en"), "Feb 2");
  assert.strictEqual(datos.etiquetaFecha(f("queso-y-tinto-comala"), "en"), "Oct 15–18");
  assert.strictEqual(datos.etiquetaFecha(f("feria-limon-tecoman"), "en"), "Jan 23 – Feb 3");
  assert.strictEqual(datos.etiquetaFecha(f("senor-expiracion-lo-de-villa"), "es"), "El martes siguiente al 6 de enero");
  assert.strictEqual(datos.etiquetaFecha(f("senor-expiracion-lo-de-villa"), "en"), "The Tuesday after January 6");
  assert.strictEqual(datos.cifraDia(f("queso-y-tinto-comala")), "15–18");
  assert.strictEqual(datos.cifraDia(f("virgen-salud-colima")), "2");
  assert.strictEqual(datos.cifraDia(f("feria-limon-tecoman")), "23", "cruza de mes: solo el día de inicio");
  assert.strictEqual(datos.cifraDia(f("senor-expiracion-lo-de-villa")), "7", "texto libre: el día de inicio");
  assert.strictEqual(datos.lugarDeFiesta(f("fiestas-zacualpan")), "Zacualpan, Comala");
  assert.strictEqual(datos.lugarDeFiesta(f("feria-limon-tecoman")), "Tecomán");
});

prueba("fiestasPorMes: 12 meses, cada fiesta en el mes de su inicio y por día", () => {
  const meses = datos.fiestasPorMes();
  assert.deepStrictEqual(meses.map((m) => m.mes), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepStrictEqual(meses.map((m) => m.fiestas.length), [6, 5, 4, 2, 3, 1, 1, 2, 6, 5, 3, 6]);
  assert.strictEqual(meses.reduce((n, m) => n + m.fiestas.length, 0), 44);
  for (const m of meses) {
    for (const fiesta of m.fiestas) assert.strictEqual(fiesta.inicio.mes, m.mes, fiesta.id);
    for (let i = 1; i < m.fiestas.length; i += 1) assert(m.fiestas[i - 1].inicio.dia <= m.fiestas[i].inicio.dia, `mes ${m.mes} fuera de orden`);
  }
  // misma fecha de inicio: el orden de data/fiestas-pueblo.json, como la app
  assert.deepStrictEqual(meses[11].fiestas.slice(0, 3).map((x) => x.id), ["inmaculada-minatitlan", "guadalupe-comala", "guadalupe-manzanillo"]);
  assert(Object.isFrozen(meses) && Object.isFrozen(datos.lugares), "los datos exportados deben estar congelados");
});

prueba("textoDescripcion: inglés si hay traducción, si no español", () => {
  const sinEn = lugares.find((l) => l.descripcion.en === null);
  const conEn = lugares.find((l) => l.descripcion.en);
  assert.strictEqual(datos.textoDescripcion(sinEn, "en"), sinEn.descripcion.es);
  assert.strictEqual(datos.textoDescripcion(sinEn, "es"), sinEn.descripcion.es);
  assert.strictEqual(datos.textoDescripcion(conEn, "en"), conEn.descripcion.en);
  assert.strictEqual(datos.textoDescripcion(conEn, "en-US"), conEn.descripcion.en);
  assert.strictEqual(datos.textoDescripcion(conEn, "es"), conEn.descripcion.es);
  assert.strictEqual(datos.textoDescripcion(conEn), conEn.descripcion.es);
  assert.strictEqual(datos.textoDescripcion(null, "en"), "");
});

prueba("hoyEnColima y las fechas no dependen de la zona horaria del servidor", () => {
  // 20:30 del 20 de octubre en Colima (UTC−6) ya es 21 de octubre en UTC
  assert.deepStrictEqual(datos.hoyEnColima(new Date("2026-10-21T02:30:00Z")), { anio: 2026, mes: 10, dia: 20, iso: "2026-10-20" });
  assert.strictEqual(datos.hoyEnColima(new Date("2026-10-20T05:59:00Z")).dia, 19);
  assert.strictEqual(datos.hoyEnColima(new Date("2026-01-01T05:59:00Z")).iso, "2025-12-31");
  // las mismas cuentas en tres zonas horarias distintas (procesos aparte, con TZ)
  const guion = `
    const d = require(${JSON.stringify(path.join(RAIZ, "lib/guia/datos"))});
    const f = d.fiestaPorId("senor-expiracion-coquimatlan");
    console.log(JSON.stringify([d.diaSemana("2026-10-20"), d.hoyEnColima(new Date("2026-10-21T02:30:00Z")).iso, d.esVigente(f, { mes: 1, dia: 5 }), d.tianguisDelDia("2026-10-24").length, d.filtrarTianguis({ tipo: 30, dia: 6 }).length]));
  `;
  const resultados = ["UTC", "America/Mexico_City", "Pacific/Auckland"].map((TZ) => execFileSync(process.execPath, ["-e", guion], { env: { ...process.env, TZ }, encoding: "utf8" }).trim());
  assert.strictEqual(new Set(resultados).size, 1, resultados.join(" | "));
});

console.log(`\n${pasaron} pruebas pasaron, ${fallaron} fallaron.`);
process.exit(fallaron ? 1 : 0);
