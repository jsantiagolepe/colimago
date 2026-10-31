#!/usr/bin/env node
// Lista lo que todavía lleva [VERIFICAR] o [COMPLETAR] y por eso NO se publica: datos de las
// fichas (data/lugares-contenido.json), bloques de las guías (data/guias/*.md) y párrafos de
// Acerca de (data/i18n/*/acerca.json). Al quitar la marca de un texto y confirmarlo, el texto
// se publica solo en el siguiente despliegue.
//
//   npm run pendientes            resumen por archivo
//   npm run pendientes -- --todo  cada pendiente, con su texto

const contenido = require("../lib/guia/contenido");
const guias = require("../lib/guia/guias");
const { MARCA } = contenido;
const fs = require("fs");
const path = require("path");

const detalle = process.argv.includes("--todo");
const acerca = [];
for (const lang of ["es"]) {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "i18n", lang, "acerca.json"), "utf8"));
  (d.mas || []).forEach((sec) => sec.parrafos.filter((p) => MARCA.test(p)).forEach((p) => acerca.push({ slug: "acerca-de", campo: sec.titulo, texto: p })));
}

const grupos = [
  ["Fichas (data/lugares-contenido.json)", contenido.pendientes()],
  ["Guías (data/guias/*.md)", guias.pendientes()],
  ["Acerca de (data/i18n/es/acerca.json; el texto en inglés repite lo mismo)", acerca],
];

let total = 0;
for (const [titulo, items] of grupos) {
  total += items.length;
  console.log(`\n${titulo}: ${items.length} pendientes`);
  const porSlug = new Map();
  for (const i of items) porSlug.set(i.slug, [...(porSlug.get(i.slug) || []), i]);
  for (const [slug, lista] of porSlug) {
    console.log(`  ${slug}: ${lista.length}`);
    if (detalle) for (const i of lista) console.log(`      · ${i.campo}: ${i.texto}`);
  }
}
console.log(`\nTotal: ${total}`);
