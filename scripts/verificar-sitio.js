#!/usr/bin/env node
// Verificación de lo que revisa AdSense (y un buscador) en el sitio: las páginas
// de información, los enlaces del pie, la portada, el sitemap, qué se indexa y
// cuánto texto propio tiene cada ficha. Sin red: usa el backend falso con el
// feed real guardado en scripts/fixtures/.
//
//   npm run verificar:sitio
//   (o) node scripts/verificar-sitio.js
//
// Comprueba:
//   · /privacidad, /terminos y /contacto (y /en/privacy, /en/terms, /en/contact):
//     existen, dicen lo que AdSense exige y sus alternos (hreflang) apuntan bien;
//     el nombre de la ruta en el otro idioma redirige con un 301.
//   · El pie de la guía, la portada y Acerca de enlazan a esas páginas dentro del
//     mismo dominio y sin target="_blank"; ya no quedan enlaces a Google Sites.
//   · La portada tiene contenido propio, enlaces a la guía y sus cifras son reales.
//   · El sitemap incluye las páginas nuevas y deja fuera lo que no se indexa.
//   · Eventos pasados, /en/evento/*, hoteles y restaurantes de ejemplo y las fichas
//     en inglés sin traducción llevan noindex.
//   · Cada ficha de lugar indexable y de fiesta trae al menos 300 palabras de texto.
//   · Ningún enlace interno de las páginas principales da 404 y no se ve ninguna
//     clave de texto sin traducir.

const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "secreto-de-prueba-sitio";
delete process.env.VISITAS_ACTIVO;

const RAIZ = path.join(__dirname, "..");
const MIN_PALABRAS_LUGAR = 300;
const CORREO = "colimago.app@gmail.com";

let total = 0;
let fallos = 0;
function comprobar(condicion, texto, detalle) {
  total++;
  if (!condicion) fallos++;
  console.log(`${condicion ? "✓" : "✗"} ${texto}${!condicion && detalle ? `\n    ${detalle}` : ""}`);
}
const titulo = (t) => console.log(`\n${t}`);

function puertoLibre() {
  return new Promise((ok, mal) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
    s.on("error", mal);
  });
}

// ---------- Utilidades de HTML ----------

const texto = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const palabras = (html) => (texto(html) ? texto(html).split(" ").length : 0);
const meta = (html, nombre) => (html.match(new RegExp(`<meta name="${nombre}" content="([^"]*)"`)) || [])[1];
const canonical = (html) => (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
const alternos = (html) => [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`);
const enlaces = (html) => [...html.matchAll(/<a\s[^>]*?href="([^"]*)"[^>]*>/g)].map((m) => ({ href: m[1].replace(/&amp;/g, "&"), etiqueta: m[0] }));
const pie = (html) => (html.match(/<footer[\s\S]*?<\/footer>/) || [""])[0];
const SITIO = "https://www.colimago.mx";

async function main() {
  // Backend falso (feed real) en un puerto libre y el sitio, en otro.
  const puertoBackend = await puertoLibre();
  const backend = spawn(process.execPath, [path.join(__dirname, "backend-falso.js"), String(puertoBackend)], { stdio: "ignore" });
  process.on("exit", () => backend.kill());
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://127.0.0.1:${puertoBackend}/api/post/`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  process.env.COLIMA_BACKEND_URL = `http://127.0.0.1:${puertoBackend}/api`;

  const app = require("../server");
  const servidor = http.createServer(app);
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const cache = new Map();
  async function pedir(ruta, opciones = {}) {
    const clave = `${ruta}|${opciones.redirect || ""}`;
    if (cache.has(clave)) return cache.get(clave);
    const r = await fetch(base + ruta, { redirect: opciones.redirect || "manual" });
    const res = { status: r.status, location: r.headers.get("location"), html: await r.text(), tipo: r.headers.get("content-type") || "" };
    cache.set(clave, res);
    return res;
  }

  const datos = require("../lib/guia/datos");
  const eventos = require("../lib/guia/eventos");
  const { lugarIndexable, eventoIndexable } = require("../lib/guia/indexacion");

  // ---------------------------------------------------------------- páginas nuevas
  titulo("Páginas de información:");
  const PAGINAS = [
    { es: "/privacidad", en: "/en/privacy", tituloEs: "Política de privacidad", tituloEn: "Privacy policy" },
    { es: "/terminos", en: "/en/terms", tituloEs: "Condiciones de uso", tituloEn: "Terms of use" },
    { es: "/contacto", en: "/en/contact", tituloEs: "Contacto", tituloEn: "Contact" },
  ];
  for (const p of PAGINAS) {
    const es = await pedir(p.es);
    const en = await pedir(p.en);
    comprobar(es.status === 200 && en.status === 200, `${p.es} y ${p.en} responden 200`, `es ${es.status}, en ${en.status}`);
    comprobar(new RegExp(`<title>${p.tituloEs} \\| Colima Go</title>`).test(es.html) && new RegExp(`<title>${p.tituloEn} \\| Colima Go</title>`).test(en.html), `${p.es}: título en español y en inglés`);
    comprobar(canonical(es.html) === SITIO + p.es && canonical(en.html) === SITIO + p.en, `${p.es}: canonical propio en cada idioma`, `${canonical(es.html)} · ${canonical(en.html)}`);
    const esperados = [`es-MX=${SITIO}${p.es}`, `en=${SITIO}${p.en}`, `x-default=${SITIO}${p.es}`];
    comprobar(esperados.every((a) => alternos(es.html).includes(a) && alternos(en.html).includes(a)), `${p.es}: hreflang es / en / x-default apuntan a las rutas de cada idioma`, alternos(es.html).join(" | "));
    comprobar(!/noindex/.test(meta(es.html, "robots") || "") && !/noindex/.test(meta(en.html, "robots") || ""), `${p.es}: se indexa`);
    comprobar(palabras(es.html) > 250 && palabras(en.html) > 250, `${p.es}: tiene texto de verdad (${palabras(es.html)} y ${palabras(en.html)} palabras)`);
    comprobar(es.html.includes(CORREO) && en.html.includes(CORREO), `${p.es}: lleva el correo ${CORREO}`);
  }
  const rEs = await pedir("/privacy");
  const rEn = await pedir("/en/privacidad");
  comprobar(rEs.status === 301 && rEs.location.endsWith("/privacidad"), "/privacy → 301 a /privacidad", `${rEs.status} ${rEs.location}`);
  comprobar(rEn.status === 301 && rEn.location.endsWith("/en/privacy"), "/en/privacidad → 301 a /en/privacy", `${rEn.status} ${rEn.location}`);
  comprobar((await pedir("/en/terminos")).location?.endsWith("/en/terms") && (await pedir("/en/contacto")).location?.endsWith("/en/contact"), "/en/terminos y /en/contacto también redirigen");

  titulo("Política de privacidad (lo que pide AdSense):");
  const priv = (await pedir("/privacidad")).html;
  const privEn = (await pedir("/en/privacy")).html;
  for (const [nombre, patron] of [
    ["usa cookies de proveedores externos, como Google, para mostrar anuncios", /proveedores externos, como Google, usan cookies para mostrar anuncios/],
    ["Google usa cookies de publicidad", /Google usa cookies de publicidad para mostrar anuncios/],
    ["enlace a adssettings.google.com", /href="https:\/\/adssettings\.google\.com"/],
    ["enlace a aboutads.info", /href="https:\/\/www\.aboutads\.info"/],
    ["enlace a policies.google.com/technologies/ads", /href="https:\/\/policies\.google\.com\/technologies\/ads"/],
    ["derechos ARCO y la ley federal", /Derechos \(ARCO\)|derechos ARCO/],
    ["menores de edad", /Menores de edad/],
    ["fecha de última actualización", /Última actualización: <time datetime="\d{4}-\d{2}-\d{2}">/],
    ["cookies y analítica", /Cookies y tecnologías similares/],
    ["formularios, inicio de sesión con Google, comentarios y favoritos", /Inicio de sesión con Google[\s\S]*Comentarios, Me gusta, favoritos y reportes[\s\S]*Formularios de sugerencias/],
  ]) {
    comprobar(patron.test(priv), `/privacidad: ${nombre}`);
  }
  comprobar(/adssettings\.google\.com/.test(privEn) && /aboutads\.info/.test(privEn) && /policies\.google\.com\/technologies\/ads/.test(privEn) && /Third-party vendors, including Google, use cookies/.test(privEn), "/en/privacy: la sección de publicidad y sus tres enlaces");
  comprobar(/id="arco"/.test(privEn) && /Your rights \(ARCO\)/.test(privEn), "/en/privacy: sección de derechos ARCO");
  comprobar(/href="\/contacto"/.test(priv) && /href="\/en\/contact"/.test(privEn), "los enlaces internos del texto legal van a la página de contacto de su idioma");

  titulo("Contacto:");
  const cont = (await pedir("/contacto")).html;
  comprobar(cont.includes(`mailto:${CORREO}`) && /facebook\.com\/colimago/.test(cont) && /instagram\.com\/colimaapp/.test(cont) && /tiktok\.com\/@colimaapp/.test(cont), "/contacto: correo y redes (Facebook, Instagram, TikTok)");
  comprobar(/<form class="sg-form[^"]*" id="sg-form"/.test(cont) && /name="mensaje"/.test(cont) && /id="sugerir-config"/.test(cont), "/contacto: formulario sencillo con campo de mensaje");
  comprobar(/maxlength="1000"/.test(cont), "/contacto: el mensaje admite 1000 caracteres");

  // ---------------------------------------------------------------- enlaces del pie
  titulo("Pie de página, Acerca de y portada:");
  const ENLACES = { es: ["/acerca-de", "/privacidad", "/terminos", "/contacto"], en: ["/en/acerca-de", "/en/privacy", "/en/terms", "/en/contact"] };
  for (const [idioma, ruta] of [["es", "/inicio"], ["es", "/explorar"], ["es", "/lugar/el-paraiso"], ["en", "/en/inicio"], ["en", "/en/lugar/zona-arqueologica-el-chanal"]]) {
    const html = (await pedir(ruta)).html;
    const enPie = enlaces(pie(html));
    const todos = ENLACES[idioma].every((h) => enPie.some((e) => e.href === h && !/target=/.test(e.etiqueta)));
    comprobar(todos, `${ruta}: el pie enlaza a ${ENLACES[idioma].join(", ")} sin target="_blank"`, enPie.map((e) => e.href).join(" "));
    comprobar(!/sites\.google\.com\/view\/(politica|condiciones)/.test(html), `${ruta}: sin enlaces a las políticas de Google Sites`);
  }
  const acerca = (await pedir("/acerca-de")).html;
  const acercaEn = (await pedir("/en/acerca-de")).html;
  comprobar(["/privacidad", "/terminos", "/contacto"].every((h) => enlaces(acerca).some((e) => e.href === h && !/target=/.test(e.etiqueta))), "/acerca-de: privacidad, condiciones y contacto dentro del dominio y sin target");
  comprobar(["/en/privacy", "/en/terms", "/en/contact"].every((h) => enlaces(acercaEn).some((e) => e.href === h && !/target=/.test(e.etiqueta))), "/en/acerca-de: lo mismo en inglés");
  comprobar(!/sites\.google\.com\/view\/(politica|condiciones)/.test(acerca + acercaEn), "/acerca-de: sin enlaces a Google Sites (solo queda el EULA de la app)");

  // El menú de arriba es el mismo en la portada y en la guía (es y en), en el mismo orden.
  const menu = (html) => enlaces((html.match(/<ul class="distritos">[\s\S]*?<\/ul>/) || [""])[0]).map((e) => e.href);
  const menuPortada = menu((await pedir("/")).html);
  const etiquetasMenu = (html) => [...((html.match(/<ul class="distritos">[\s\S]*?<\/ul>/) || [""])[0]).matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
  comprobar(menuPortada.length === 7, `portada: el menú tiene 7 opciones (${menuPortada.join(" ")})`);
  for (const ruta of ["/inicio", "/explorar", "/calendario", "/favoritos", "/ajustes", "/playas", "/municipios", "/fiestas-del-pueblo", "/lugar/el-paraiso", "/acerca-de", "/privacidad", "/contacto"]) {
    const html = (await pedir(ruta)).html;
    comprobar(JSON.stringify(menu(html)) === JSON.stringify(menuPortada) && JSON.stringify(etiquetasMenu(html)) === JSON.stringify(etiquetasMenu((await pedir("/")).html)), `${ruta}: el menú de arriba es idéntico al de la portada (mismas opciones, mismo orden)`, `${menu(html).join(" ")} · ${etiquetasMenu(html).join("/")}`);
  }
  // Los botones de la derecha (idioma, tema, favoritos, cuenta, descargar): los mismos y en el mismo orden.
  const botones = (html) => [...((html.match(/<div class="barra-acciones">[\s\S]*?<\/div>\s*<\/div>\s*<\/nav>/) || [""])[0]).matchAll(/<(?:a|button) class="([^"]*)"[^>]*>/g)].map((m) => m[1]);
  const botonesPortada = botones((await pedir("/")).html);
  comprobar(botonesPortada.join("|") === "btn-idioma|interruptor|btn-icono btn-favoritos|btn-icono btn-usuario|btn-pintado btn-descargar-nav", `portada: la barra trae idioma, tema, favoritos, cuenta y descargar (${botonesPortada.length} botones)`, botonesPortada.join("|"));
  for (const ruta of ["/inicio", "/explorar", "/lugar/el-paraiso", "/privacidad", "/en/inicio"]) {
    comprobar(botones((await pedir(ruta)).html).join("|") === botonesPortada.join("|"), `${ruta}: los botones de la barra son los mismos que los de la portada, en el mismo orden`, botones((await pedir(ruta)).html).join("|"));
  }
  const portadaHtml = (await pedir("/")).html;
  comprobar(/class="btn-idioma" href="\/en\/inicio"[^>]*aria-label="Cambiar a inglés">EN</.test(portadaHtml) && /class="btn-icono btn-favoritos" href="\/favoritos"/.test(portadaHtml) && /class="btn-icono btn-usuario" id="btn-usuario" href="\/ajustes"/.test(portadaHtml), "portada: EN lleva a la guía en inglés, el corazón a /favoritos y la cuenta a /ajustes");
  const menuEn = menu((await pedir("/en/inicio")).html);
  comprobar(menuEn.length === 7 && menuEn.every((h, i) => h === (menuPortada[i] === "/" ? "/" : `/en${menuPortada[i]}`)), "/en/inicio: el menú tiene las mismas 7 opciones, con su ruta en inglés", menuEn.join(" "));
  const marcado = async (ruta) => [...((await pedir(ruta)).html.match(/<ul class="distritos">[\s\S]*?<\/ul>/)[0]).matchAll(/<a href="([^"]+)" aria-current="[^"]+">/g)].map((m) => m[1]);
  comprobar((await marcado("/inicio")).join() === "/inicio" && (await marcado("/playas")).join() === "/playas" && (await marcado("/lugar/el-paraiso")).join() === "/inicio" && (await marcado("/rincones-naturales/rios")).join() === "/rincones-naturales" && (await marcado("/privacidad")).length === 0, "el menú marca la opción de la página en la que estás (y ninguna en privacidad)");
  comprobar((await pedir("/inicio")).html.includes('class="btn-icono btn-favoritos" href="/favoritos"') && (await pedir("/inicio")).html.includes('id="btn-usuario" href="/ajustes"'), "Favoritos y Ajustes siguen a un clic: iconos de corazón y de cuenta");
  comprobar(enlaces((await pedir("/")).html.match(/<a class="marca"[^>]*>/g).join("")).every((e) => e.href === "/") && /<a class="marca" href="\/"/.test((await pedir("/inicio")).html) && /<a class="marca" href="\/en\/inicio"/.test((await pedir("/en/inicio")).html), "el logo lleva a «/» en la portada y en la guía en español (en inglés, a /en/inicio)");
  const portada = (await pedir("/")).html;
  const pPie = enlaces(pie(portada)).map((e) => e.href);
  comprobar(["/acerca-de", "/privacidad", "/terminos", "/contacto", "/inicio"].every((h) => pPie.includes(h)), "portada: el pie tiene los mismos enlaces que /inicio (Acerca de, privacidad, condiciones, contacto)", pPie.join(" "));
  const mainPortada = (portada.split("<main")[1] || "").split("</main>")[0];
  const guiaEnlaces = ["/municipios", "/fiestas-del-pueblo", "/playas", "/rincones-naturales", "/explorar", "/calendario"];
  const hrefsMain = enlaces(mainPortada).map((e) => e.href);
  comprobar(guiaEnlaces.every((h) => hrefsMain.includes(h)), "portada: enlaces visibles a municipios, fiestas, playas, rincones, explorar y calendario");
  const tiendas = (mainPortada.match(/apps\.apple\.com|play\.google\.com/g) || []).length;
  comprobar(tiendas <= 2, `portada: los botones de descarga ya no dominan (${tiendas} enlaces a tiendas, antes 4)`);
  comprobar(palabras(mainPortada) > 700, `portada: texto propio y útil (${palabras(mainPortada)} palabras)`);
  comprobar(/<meta name="google-adsense-account" content="ca-pub-5479273904422379"/.test(portada) && /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-5479273904422379/.test(portada), "portada: siguen la etiqueta google-adsense-account y el script de AdSense");
  const cuenta = (tipos) => tipos.reduce((a, t) => a + datos.lugaresPorTipo(t).length, 0);
  const cifras = { rincones: cuenta([10, 11, 12, 13, 14, 15, 16, 17, 18]), tianguis: cuenta([30, 31]), fiestas: datos.fiestas.length, playas: cuenta([11]) };
  comprobar(new RegExp(`${cifras.rincones} rincones naturales`).test(portada) && new RegExp(`${cifras.tianguis} tianguis y mercados`).test(portada) && new RegExp(`${cifras.fiestas} fiestas del pueblo`).test(portada) && new RegExp(`${cifras.playas} playas`).test(portada), "portada: las cifras (rincones, tianguis y mercados, fiestas, playas) coinciden con los datos", JSON.stringify(cifras));
  // Playas, rincones y municipios de la portada llevan a su detalle real.
  const enSeccion = (id) => (portada.split(`id="${id}"`)[1] || "").split("</section>")[0];
  const hrefsDe = (id) => enlaces(enSeccion(id)).map((e) => e.href);
  const lugaresPortada = [...new Set([...hrefsDe("playas"), ...hrefsDe("rincones")].filter((h) => h.startsWith("/lugar/")))];
  comprobar(lugaresPortada.length === 15 && lugaresPortada.every((h) => datos.lugarPorSlug(h.slice("/lugar/".length))), `portada: las 5 playas y los 10 rincones enlazan a una ficha de lugar que existe (${lugaresPortada.length})`, lugaresPortada.join(" "));
  const municipiosPortada = [...new Set(hrefsDe("municipios").filter((h) => h.startsWith("/municipios/")))];
  comprobar(municipiosPortada.length === 10 && municipiosPortada.every((h) => datos.municipioPorSlug(h.slice("/municipios/".length))), "portada: cada uno de los diez municipios enlaza a su página", municipiosPortada.join(" "));
  comprobar(hrefsDe("playas").includes("/playas") && hrefsDe("rincones").includes("/rincones-naturales") && hrefsDe("rincones").includes("/rincones-naturales/rios") && hrefsDe("municipios").includes("/municipios"), "portada: los títulos y botones de cada sección llevan a su lista (/playas, /rincones-naturales, /municipios)");
  comprobar((await pedir("/ads.txt")).html.trim() === "google.com, pub-5479273904422379, DIRECT, f08c47fec0942fa0", "ads.txt sigue igual");
  comprobar(/Sitemap: https:\/\/www\.colimago\.mx\/sitemap\.xml/.test(require("fs").readFileSync(path.join(RAIZ, "public", "robots.txt"), "utf8")), "robots.txt sigue apuntando al sitemap");

  // ---------------------------------------------------------------- sitemap
  titulo("Sitemap:");
  const mapa = (await pedir("/sitemap.xml")).html;
  const locs = [...mapa.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  const hay = (u) => locs.includes(SITIO + u);
  comprobar(["/privacidad", "/en/privacy", "/terminos", "/en/terms", "/contacto", "/en/contact", "/acerca-de", "/en/acerca-de"].every(hay), "sitemap: privacidad, condiciones, contacto y acerca de, en español y en inglés");
  comprobar(!locs.some((u) => u.includes("/en/evento/")), "sitemap: ningún /en/evento/*");
  comprobar(!locs.some((u) => /hotel-la-casona|wyndham|la-casa-de-la-abuela|mariscos-carlos/.test(u)), "sitemap: sin hoteles ni restaurantes de ejemplo");
  const { eventos: lista } = await eventos.obtenerEventos();
  const hoy = eventos.hoyEnColima();
  const vigentes = lista.filter((e) => eventoIndexable(e, "es", hoy));
  const pasados = lista.filter((e) => !eventoIndexable(e, "es", hoy));
  comprobar(vigentes.length > 0 && pasados.length > 0, `el feed de prueba trae eventos vigentes (${vigentes.length}) y pasados (${pasados.length})`);
  comprobar(vigentes.every((e) => hay(`/evento/${e.id}`)) && pasados.every((e) => !hay(`/evento/${e.id}`)), "sitemap: solo los eventos que no han terminado");
  const sinIngles = datos.lugares.filter((l) => lugarIndexable(l, "es") && !lugarIndexable(l, "en"));
  const conIngles = datos.lugares.filter((l) => lugarIndexable(l, "en"));
  comprobar(sinIngles.length > 0 && sinIngles.every((l) => hay(`/lugar/${l.slug}`) && !hay(`/en/lugar/${l.slug}`)), `sitemap: ${sinIngles.length} lugares sin descripción en inglés van solo en español`);
  comprobar(conIngles.every((l) => hay(`/lugar/${l.slug}`) && hay(`/en/lugar/${l.slug}`)), `sitemap: ${conIngles.length} lugares con inglés van en los dos idiomas`);
  comprobar(datos.fiestas.every((f) => hay(`/fiestas-del-pueblo/${f.id}`)) && !locs.some((u) => u.includes("/en/fiestas-del-pueblo/")), "sitemap: las fiestas solo en español (su texto no está traducido)");
  comprobar(new Set(locs).size === locs.length, `sitemap: ninguna URL repetida (${locs.length})`);

  // ---------------------------------------------------------------- qué se indexa
  titulo("Qué se indexa:");
  const robots = async (ruta) => meta((await pedir(ruta)).html, "robots") || "";
  if (pasados[0]) comprobar(/noindex/.test(await robots(`/evento/${pasados[0].id}`)), "un evento pasado lleva noindex");
  if (vigentes[0]) comprobar(!/noindex/.test(await robots(`/evento/${vigentes[0].id}`)), "un evento vigente se indexa");
  if (vigentes[0]) {
    const en = await pedir(`/en/evento/${vigentes[0].id}`);
    comprobar(/noindex/.test(meta(en.html, "robots")) && alternos(en.html).length === 0, "/en/evento/* lleva noindex y sin hreflang");
    comprobar(alternos((await pedir(`/evento/${vigentes[0].id}`)).html).length === 0, "/evento/* no anuncia una alterna en inglés que no se indexa");
  }
  comprobar(/noindex/.test(await robots("/lugar/hotel-la-casona-de-don-jorge")), "hotel de ejemplo: noindex");
  comprobar(/noindex/.test(await robots("/en/lugar/el-paraiso")) && alternos((await pedir("/lugar/el-paraiso")).html).length === 0, "/en/lugar/el-paraiso (sin traducción) lleva noindex y su versión en español no anuncia alterna");
  comprobar(!/noindex/.test(await robots("/en/lugar/zona-arqueologica-el-chanal")) && alternos((await pedir("/lugar/zona-arqueologica-el-chanal")).html).length === 3, "/en/lugar/zona-arqueologica-el-chanal (traducido) se indexa con sus tres alternos");
  const fiesta = datos.fiestas[0];
  comprobar(/noindex/.test(await robots(`/en/fiestas-del-pueblo/${fiesta.id}`)) && !/noindex/.test(await robots(`/fiestas-del-pueblo/${fiesta.id}`)), "ficha de fiesta: español se indexa, inglés noindex");

  // ---------------------------------------------------------------- texto de las fichas
  titulo("Texto de las fichas de lugar:");
  const articulo = (html) => ((html.split('class="lugar-hoja"')[1] || "").split('id="comentarios"')[0]);
  let minimo = { n: Infinity, slug: "" };
  const cortas = [];
  for (const l of datos.lugares.filter((x) => lugarIndexable(x, "es"))) {
    const r = await pedir(`/lugar/${l.slug}`);
    const n = palabras(articulo(r.html));
    if (r.status !== 200) cortas.push(`${l.slug} → ${r.status}`);
    if (n < minimo.n) minimo = { n, slug: l.slug };
    if (n < MIN_PALABRAS_LUGAR) cortas.push(`${l.slug} (${n})`);
  }
  const indexables = datos.lugares.filter((x) => lugarIndexable(x, "es")).length;
  comprobar(cortas.length === 0, `las ${indexables} fichas indexables tienen al menos ${MIN_PALABRAS_LUGAR} palabras (la más corta: ${minimo.slug}, ${minimo.n})`, cortas.slice(0, 8).join(", "));
  const ficha = (await pedir("/lugar/el-paraiso")).html;
  comprobar(["Cómo llegar", "Mejor época para visitarlo", "Consejos para tu visita", "Qué hay cerca", "Más en Armería"].every((s) => ficha.includes(s)), "la ficha trae descripción, cómo llegar, mejor época, consejos, qué hay cerca y enlaces al municipio");
  comprobar(/href="\/municipios\/armeria"/.test(ficha) && (ficha.match(/href="\/lugar\/[^"]+"/g) || []).length >= 5, "la ficha enlaza al municipio y a otros lugares");
  comprobar(!/guia\.[a-z]+Titulo|lugarguia\./.test(texto(ficha)), "la ficha no muestra claves de texto sin traducir");

  titulo("Fichas de fiesta del pueblo:");
  const cortasFiestas = [];
  for (const f of datos.fiestas) {
    const html = (await pedir(`/fiestas-del-pueblo/${f.id}`)).html;
    const n = palabras((html.split("<main")[1] || "").split("</main>")[0]);
    if (n < MIN_PALABRAS_LUGAR || !/Sobre esta fiesta/.test(html)) cortasFiestas.push(`${f.id} (${n})`);
  }
  comprobar(cortasFiestas.length === 0, `las ${datos.fiestas.length} fichas de fiesta traen su contexto propio y al menos ${MIN_PALABRAS_LUGAR} palabras`, cortasFiestas.slice(0, 8).join(", "));

  titulo("Fichas de evento:");
  if (vigentes[0]) {
    const ev = vigentes.find((e) => /\p{Extended_Pictographic}/u.test(`${e.titulo} ${e.descripcion.es}`)) || vigentes[0];
    const html = (await pedir(`/evento/${ev.id}`)).html;
    const cuerpo = (html.split("<article")[1] || "").split("</article>")[0];
    const sinMarcado = texto(cuerpo).replace(/[©®™]/g, "");
    comprobar(!/\p{Extended_Pictographic}/u.test(sinMarcado), "el texto del evento sale sin emojis");
    comprobar(/Sobre este evento/.test(html) && /Cómo llegar/.test(html) && /Qué hacer cerca/.test(html), "el evento trae su párrafo propio de contexto (qué es, dónde, cómo llegar, qué hay cerca)");
    comprobar(palabras(cuerpo) > 200, `la ficha del evento pasa de 200 palabras (${palabras(cuerpo)})`);
  }

  // ---------------------------------------------------------------- enlaces rotos
  titulo("Enlaces internos:");
  const SEMILLAS = ["/", "/inicio", "/en/inicio", "/explorar", "/calendario", "/municipios", "/playas", "/rincones-naturales", "/tianguis-y-mercados", "/fiestas-del-pueblo", "/fiestas-charrotaurinas", "/acerca-de", "/en/acerca-de", "/privacidad", "/en/privacy", "/terminos", "/en/terms", "/contacto", "/en/contact", "/lugar/el-paraiso", "/lugar/zona-arqueologica-el-chanal", "/municipios/armeria"];
  if (vigentes[0]) SEMILLAS.push(`/evento/${vigentes[0].id}`);
  const vistos = new Set();
  const rotos = [];
  const sinTraducir = [];
  const SIN_TRADUCIR = /\b(lugarguia|eventoguia|privacidad|terminos|contacto|comun|acerca|sugerir|lugar|evento)\.[a-zA-Z]{3,}/;
  for (const semilla of SEMILLAS) {
    const r = await pedir(semilla);
    if (r.status >= 400) {
      rotos.push(`${semilla} → ${r.status}`);
      continue;
    }
    if (/html/.test(r.tipo)) {
      const visible = texto(r.html).replace(/\b[\w-]+\.(mx|com|org|net)\b[^\s]*/g, "");
      const clave = visible.match(SIN_TRADUCIR);
      if (clave) sinTraducir.push(`${semilla}: ${clave[0]}`);
    }
    for (const { href } of enlaces(r.html)) {
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const destino = href.split("#")[0];
      if (!destino || vistos.has(destino) || destino.startsWith("/g/")) continue;
      vistos.add(destino);
    }
  }
  for (const destino of vistos) {
    const r = await pedir(destino);
    let estado = r.status;
    if (estado >= 300 && estado < 400 && r.location) estado = (await pedir(new URL(r.location, base).pathname + new URL(r.location, base).search)).status;
    if (estado >= 400) rotos.push(`${destino} → ${estado}`);
  }
  comprobar(rotos.length === 0, `ningún enlace interno da 404 (${vistos.size} enlaces distintos revisados en ${SEMILLAS.length} páginas)`, rotos.slice(0, 10).join(", "));
  comprobar(sinTraducir.length === 0, "ninguna página muestra una clave de texto sin traducir", sinTraducir.slice(0, 5).join(" | "));
  const cssNuevos = ["/css/paginas/legal.css", "/css/paginas/contacto.css"];
  const estilos = await Promise.all(cssNuevos.map((c) => pedir(c)));
  comprobar(estilos.every((e) => e.status === 200 && /css/.test(e.tipo)), "los estilos nuevos (legal.css, contacto.css) se sirven");

  servidor.close();
  backend.kill();
  console.log(fallos ? `\n${fallos} de ${total} comprobaciones fallaron.` : `\nTodo bien: ${total} comprobaciones.`);
  process.exit(fallos ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
