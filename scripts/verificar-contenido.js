#!/usr/bin/env node
// Verificación del contenido propio (lo que pide AdSense): fichas sin texto repetido, noindex
// automático de las fichas con poco texto, guías, metadatos únicos y que ninguna marca
// [VERIFICAR] / [COMPLETAR] llegue a una página publicada. Sin red: levanta el servidor en
// memoria y lee el sitemap.xml.
//
//   npm run verificar:contenido

const http = require("http");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "secreto-de-prueba-contenido";
delete process.env.ANALITICA_ACTIVO;

const app = require("../server");
const datos = require("../lib/guia/datos");
const guias = require("../lib/guia/guias");
const { esDeEjemplo } = require("../lib/guia/indexacion");
const { palabrasPropias, MIN_PALABRAS_PROPIAS } = require("../lib/guia/contenido");

let total = 0;
let fallos = 0;
function comprobar(condicion, texto, detalle) {
  total++;
  if (!condicion) fallos++;
  console.log(`${condicion ? "✓" : "✗"} ${texto}${!condicion && detalle ? `\n    ${detalle}` : ""}`);
}
const titulo = (t) => console.log(`\n${t}`);

const meta = (html, nombre) => {
  const m = new RegExp(`<meta name="${nombre}" content="([^"]*)"`).exec(html);
  return m ? m[1] : "";
};
const tituloDe = (html) => ((/<title>([^<]*)<\/title>/.exec(html) || [])[1] || "").trim();

async function enParalelo(items, n, fn) {
  const salida = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        salida[k] = await fn(items[k]);
      }
    }),
  );
  return salida;
}

async function main() {
  const servidor = http.createServer(app);
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const traer = async (ruta) => {
    const r = await fetch(`${base}${ruta}`);
    return { status: r.status, html: await r.text() };
  };

  // ---------- Fichas ----------
  titulo("Fichas de lugar");
  const lugares = datos.lugares.filter((l) => !esDeEjemplo(l));
  const fichas = await enParalelo(lugares, 8, async (l) => ({ l, ...(await traer(`/lugar/${l.slug}`)) }));
  const indexables = fichas.filter((f) => !/noindex/.test(meta(f.html, "robots")));
  const noindex = fichas.filter((f) => /noindex/.test(meta(f.html, "robots")));
  console.log(`  ${fichas.length} fichas: ${indexables.length} indexables, ${noindex.length} con noindex`);
  comprobar(fichas.every((f) => f.status === 200), "todas las fichas responden 200");
  comprobar(
    fichas.every((f) => (palabrasPropias(f.l) >= MIN_PALABRAS_PROPIAS) === !/noindex/.test(meta(f.html, "robots"))),
    `noindex automático: solo se indexa la ficha con ${MIN_PALABRAS_PROPIAS} palabras propias o más`,
    fichas.filter((f) => (palabrasPropias(f.l) >= MIN_PALABRAS_PROPIAS) === /noindex/.test(meta(f.html, "robots"))).map((f) => f.l.slug).join(", "),
  );
  const REPETIDOS = ["El litoral colimense tiene playas de arena clara", "Por carretera el trayecto es más largo", "Colima tiene clima cálido casi todo el año", "Lleva agua, gorra y protector solar: en Colima el sol pega fuerte"];
  comprobar(fichas.every((f) => !REPETIDOS.some((r) => f.html.includes(r))), "ninguna ficha repite los bloques genéricos (litoral, cómo llegar, clima, consejos comunes)");
  comprobar(fichas.every((f) => /Actualizado el \d+ de \w+ de \d{4}/.test(f.html)), 'cada ficha muestra "Actualizado el [fecha]"');
  comprobar(fichas.every((f) => /"@type":"TouristAttraction"|"@type":\["TouristAttraction","Beach"\]/.test(f.html) && /"@type":"BreadcrumbList"/.test(f.html)), "cada ficha trae TouristAttraction (Beach en playas) y BreadcrumbList");
  comprobar(noindex.every((f) => !/id="t-epoca"|id="t-consejos"/.test(f.html)), "las fichas sin texto propio no muestran Mejor época ni Consejos");
  comprobar(indexables.every((f) => /id="t-perfil"/.test(f.html) && /id="t-llegar"/.test(f.html)), "las fichas indexables muestran su descripción larga y Cómo llegar");
  comprobar(fichas.every((f) => /id="t-llegar"/.test(f.html)), "todas las fichas conservan las distancias calculadas");

  // ---------- Guías ----------
  titulo("Guías");
  const lista = await traer("/guias");
  const publicas = guias.indexables();
  comprobar(lista.status === 200 && publicas.every((g) => lista.html.includes(`/guias/${g.slug}`)), `/guias lista las ${publicas.length} guías publicables`);
  comprobar(guias.todas().length >= 10, "hay al menos 10 guías");
  const arts = await enParalelo(guias.todas(), 4, async (g) => ({ g, ...(await traer(`/guias/${g.slug}`)) }));
  comprobar(arts.every((a) => a.status === 200 && /"@type":"Article"/.test(a.html) && /"datePublished"/.test(a.html) && /"dateModified"/.test(a.html)), "cada guía trae datos estructurados Article con fecha de publicación y de actualización");
  comprobar(arts.every((a) => /Por <span>/.test(a.html) && /Actualizado el/.test(a.html)), "cada guía muestra autor, fecha y actualización");
  comprobar(arts.every((a) => /<a href="\/lugar\//.test(a.html)), "cada guía enlaza a fichas de lugares");
  const enlacesRotos = [];
  for (const a of arts) {
    for (const m of a.html.matchAll(/href="(\/(?:lugar|guias)\/[^"#?]+)"/g)) {
      const r = await traer(m[1]);
      if (r.status !== 200) enlacesRotos.push(`${a.g.slug} → ${m[1]}`);
    }
  }
  comprobar(enlacesRotos.length === 0, "los enlaces de las guías a fichas y a otras guías existen", enlacesRotos.join("\n    "));
  comprobar(/<a href="\/guias"[^>]*>Guías<\/a>/.test(lista.html), "el menú principal incluye Guías");
  const portada = await traer("/");
  comprobar(/href="\/guias"/.test(portada.html) && /id="guias"/.test(portada.html), "la portada enlaza a las guías");
  comprobar(!/Descárgala gratis|descarga la app|en la app\b|la app reúne|una sola app/i.test(portada.html.replace(/<template[\s\S]*?<\/template>/g, "")), "la portada ya no empuja la app (solo queda el bloque final)");
  comprobar((portada.html.match(/class="tiendas"/g) || []).length === 1, "la portada tiene un solo bloque de descarga");
  const playas = await traer("/playas");
  comprobar(!/App Store|Google Play/.test(playas.html), "la lista de playas ya no lleva banners de descarga de la app");

  // ---------- Acerca de ----------
  titulo("Acerca de");
  const acerca = await traer("/acerca-de");
  comprobar(/Quién hace Colima Go/.test(acerca.html) && /De dónde salen los datos/.test(acerca.html) && /Cómo reportar un error/.test(acerca.html), "Acerca de explica quién, de dónde salen los datos, verificación, actualización y reportes");

  // ---------- Sitemap y metadatos ----------
  titulo("Sitemap y metadatos");
  const sitemap = (await traer("/sitemap.xml")).html;
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace("https://www.colimago.mx", ""));
  comprobar(urls.length > 0, `el sitemap trae ${urls.length} URL`);
  const enMapa = new Set(urls);
  comprobar(noindex.every((f) => !enMapa.has(`/lugar/${f.l.slug}`)), "ninguna ficha con noindex está en el sitemap");
  comprobar(indexables.every((f) => enMapa.has(`/lugar/${f.l.slug}`)), "todas las fichas indexables están en el sitemap");
  comprobar(publicas.every((g) => enMapa.has(`/guias/${g.slug}`)) && (publicas.length === 0 || enMapa.has("/guias")), "las guías publicables y su índice están en el sitemap");
  const paginas = await enParalelo(urls.filter((u) => !u.startsWith("/evento/")), 8, async (u) => ({ u, ...(await traer(u)) }));
  comprobar(paginas.every((p) => p.status === 200), "todas las URL del sitemap responden 200", paginas.filter((p) => p.status !== 200).map((p) => `${p.status} ${p.u}`).join(", "));
  comprobar(paginas.every((p) => !/noindex/.test(meta(p.html, "robots"))), "ninguna URL del sitemap lleva noindex", paginas.filter((p) => /noindex/.test(meta(p.html, "robots"))).map((p) => p.u).join(", "));
  // La unicidad se exige dentro de cada idioma: la versión en inglés de una ficha comparte nombre con la española.
  const repetidos = (campo) => {
    const vistos = new Map();
    for (const p of paginas) {
      const v = `${p.u.startsWith("/en/") ? "en" : "es"}|${campo(p.html)}`;
      vistos.set(v, [...(vistos.get(v) || []), p.u]);
    }
    return [...vistos].filter(([v, us]) => us.length > 1 || v.length <= 3).map(([v, us]) => `"${v.slice(3, 63)}" → ${us.join(", ")}`);
  };
  const titulosRepetidos = repetidos(tituloDe);
  const descripcionesRepetidas = repetidos((h) => meta(h, "description"));
  comprobar(titulosRepetidos.length === 0, "title único y no vacío en cada página indexable", titulosRepetidos.join("\n    "));
  comprobar(descripcionesRepetidas.length === 0, "meta description única y no vacía en cada página indexable", descripcionesRepetidas.join("\n    "));

  // ---------- Marcas ----------
  titulo("Marcas de borrador");
  const todas = [...fichas, ...arts, ...paginas, acerca, lista, portada];
  const conMarca = todas.filter((p) => /\[(VERIFICAR|COMPLETAR)/i.test(p.html));
  comprobar(conMarca.length === 0, "ninguna página publicada muestra [VERIFICAR] ni [COMPLETAR]", conMarca.map((p) => p.u || (p.l && p.l.slug) || (p.g && p.g.slug)).join(", "));

  servidor.close();
  console.log(`\n${total - fallos}/${total} comprobaciones correctas${fallos ? `, ${fallos} con fallos` : ""}`);
  process.exit(fallos ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
