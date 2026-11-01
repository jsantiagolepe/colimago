#!/usr/bin/env node
// Ayuda para los enlaces de afiliados de Mercado Libre (data/afiliados.json).
//
//   npm run afiliados                      estado de cada producto y la búsqueda de Mercado Libre
//                                          con la que generar su enlace en el panel de afiliados
//   npm run afiliados -- --importar f.txt  pega enlaces desde un archivo: una línea por producto,
//                                          "<id> <enlace>" (separado por espacio, tabulador, coma o |)
//
// Sale con error si algún `url` no es un enlace válido de Mercado Libre.

const fs = require("fs");
const { ARCHIVO, cargar, esEnlaceValido, urlDeBusqueda, todosLosProductos } = require("../lib/guia/afiliados");

const argumentos = process.argv.slice(2);
const iImportar = argumentos.indexOf("--importar");

function importar(archivo) {
  if (!archivo || !fs.existsSync(archivo)) {
    console.error(`No encuentro el archivo: ${archivo || "(falta la ruta)"}`);
    process.exit(1);
  }
  const conocidos = new Set(todosLosProductos().map((p) => p.id));
  let texto = fs.readFileSync(ARCHIVO, "utf8");
  let puestos = 0;
  for (const linea of fs.readFileSync(archivo, "utf8").split("\n")) {
    const m = /^\s*([a-z0-9-]+)[\s,|;]+(\S+)\s*$/i.exec(linea);
    if (!m) continue;
    const [, id, url] = m;
    if (!conocidos.has(id)) {
      console.log(`✗ ${id}: no existe ese id en data/afiliados.json`);
      continue;
    }
    if (!esEnlaceValido(url)) {
      console.log(`✗ ${id}: el enlace no parece de Mercado Libre (${url})`);
      continue;
    }
    const patron = new RegExp(`("id": "${id}"[^\\n]*?"url": ")[^"]*(")`);
    if (!patron.test(texto)) continue;
    texto = texto.replace(patron, (_, a, b) => `${a}${url}${b}`);
    console.log(`✓ ${id}`);
    puestos++;
  }
  fs.writeFileSync(ARCHIVO, texto);
  console.log(`\n${puestos} enlace(s) guardados en data/afiliados.json`);
}

function estado() {
  const productos = todosLosProductos();
  const usadas = new Map();
  let faltan = 0;
  let malos = 0;
  console.log("Productos por kit (✓ con enlace · ○ sin enlace · ✗ enlace inválido)\n");
  for (const p of productos) {
    const marca = !p.url ? "○" : esEnlaceValido(p.url) ? "✓" : "✗";
    if (marca === "○") faltan++;
    if (marca === "✗") malos++;
    usadas.set(p.busqueda, (usadas.get(p.busqueda) || 0) + 1);
    console.log(`${marca} ${p.id.padEnd(22)} ${p.nombre}`);
    if (marca !== "✓") console.log(`    busca en Mercado Libre: ${urlDeBusqueda(p.busqueda)}`);
    if (marca === "✗") console.log(`    url inválida: ${p.url}`);
  }
  const { por_tipo, kits } = cargar();
  const sinKit = Object.values(por_tipo || {}).flat().filter((k) => !kits[k]);
  if (sinKit.length) console.log(`\n✗ por_tipo apunta a kits que no existen: ${[...new Set(sinKit)].join(", ")}`);
  console.log(`\n${productos.length - faltan - malos} con enlace, ${faltan} sin enlace, ${malos} inválidos.`);
  if (faltan) console.log("Un producto sin enlace no se publica; si un kit no tiene ninguno, la ficha no muestra el bloque.");
  process.exit(malos || sinKit.length ? 1 : 0);
}

if (iImportar >= 0) importar(argumentos[iImportar + 1]);
else estado();
