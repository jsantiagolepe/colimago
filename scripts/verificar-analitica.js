#!/usr/bin/env node
// Verificación rápida de la analítica: que POST /e arme el log con la forma
// exacta de POST /colimago-logs (cualquier campo de más o con mal formato lo
// rechaza el backend con 400), lo mande con la cabecera x-logs-key y sin
// Authorization, y que descarte bots, eventos inválidos, otros orígenes y el
// registro apagado.
//
// No necesita el backend real: levanta uno falso en un puerto libre.
//
//   npm run verificar:analitica
//   (o) node scripts/verificar-analitica.js

const http = require("http");

process.env.NODE_ENV = "test";
process.env.ANALITICA_ACTIVO = "1"; // fuera de Vercel el registro está apagado
process.env.COLIMAGO_LOGS_KEY = "clave-de-prueba";

// Los campos de CreateColimagoLogDto en backColimaApp (src/colimago-logs/dto).
const CAMPOS = new Set([
  "event", "platform", "ts", "path", "target", "place", "item", "channel", "referrer",
  "utmSource", "utmMedium", "utmCampaign", "device", "os", "browser", "country", "region",
  "city", "visitor", "lang",
]);
const OBLIGATORIOS = ["event", "platform", "ts", "path", "channel", "device", "visitor"];

const UA = {
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  instagramIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0",
  chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  chromeIpad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1",
  googlebot: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  lighthouse: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Chrome-Lighthouse",
  curl: "curl/8.7.1",
};

const recibidas = [];
let simular = null; // { status, body } de la próxima respuesta del backend falso
const backendFalso = http.createServer((req, res) => {
  let cuerpo = "";
  req.on("data", (c) => (cuerpo += c));
  req.on("end", () => {
    let json = null;
    try {
      json = JSON.parse(cuerpo);
    } catch {}
    recibidas.push({ metodo: req.method, ruta: req.url, authorization: req.headers.authorization || null, clave: req.headers["x-logs-key"] || null, json });
    const r = simular || { status: 201, body: { message: "Log saved", response: true } };
    simular = null;
    res.writeHead(r.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(r.body));
  });
});

async function main() {
  await new Promise((ok) => backendFalso.listen(0, "127.0.0.1", ok));
  process.env.COLIMA_BACKEND_URL = `http://127.0.0.1:${backendFalso.address().port}/api`;

  const app = require("../server");
  const sitio = http.createServer(app);
  await new Promise((ok) => sitio.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${sitio.address().port}`;

  const enviar = (body, userAgent, extra = {}) =>
    fetch(`${base}/e`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(userAgent ? { "User-Agent": userAgent } : {}), ...extra },
      body: JSON.stringify(body),
    });

  let fallos = 0;
  const comprobar = (ok, texto) => {
    if (!ok) fallos++;
    console.log(`${ok ? "✓" : "✗"} ${texto}`);
  };
  const formaValida = (e) =>
    Object.keys(e).every((k) => CAMPOS.has(k) && e[k] !== undefined) &&
    OBLIGATORIOS.every((k) => k in e) &&
    e.platform === "web" &&
    /^[a-f0-9]{16,64}$/.test(e.visitor) &&
    new Date(e.ts).toISOString() === e.ts;

  // --- Eventos válidos: qué llega al backend ---
  console.log("Log que llega a POST /colimago-logs:");
  const casos = [
    ["page_view de la portada", { event: "page_view", path: "/", lang: "es" }, "safariIphone", { device: "mobile", os: "iOS", browser: "Safari", channel: "direct", path: "/" }],
    ["page_view de una ficha", { event: "page_view", path: "/lugar/Playa-Cuyutlan?x=1" }, "chromeWindows", { device: "desktop", os: "Windows", browser: "Chrome", item: "playa-cuyutlan", path: "/lugar/Playa-Cuyutlan" }],
    ["page_view en inglés", { event: "page_view", path: "/en/place/playa-cuyutlan", lang: "en" }, "chromeIpad", { device: "tablet", item: "playa-cuyutlan", lang: "en" }],
    ["click a la App Store", { event: "click", path: "/", target: "app_store", place: "footer" }, "safariIphone", { target: "app_store", place: "footer" }],
    ["click de Mercado Libre", { event: "click", path: "/lugar/playa-cuyutlan", target: "mercadolibre", place: "ficha" }, "chromeWindows", { target: "mercadolibre", item: "playa-cuyutlan" }],
    ["anuncio de Instagram", { event: "page_view", path: "/", utmSource: "meta", utmMedium: "paid_social", utmCampaign: "colima-go", referrer: "l.instagram.com" }, "instagramIphone", { channel: "meta_ads", browser: "Instagram", utmCampaign: "colima-go", referrer: "l.instagram.com" }],
    ["búsqueda de Google", { event: "page_view", path: "/explorar", referrer: "www.google.com" }, "chromeWindows", { channel: "search" }],
    ["fbclid sin UTM", { event: "page_view", path: "/", fbclid: true }, "instagramIphone", { channel: "social" }],
  ];
  for (const [nombre, body, ua, esperado] of casos) {
    const antes = recibidas.length;
    const res = await enviar(body, UA[ua]);
    const r = recibidas[antes];
    const e = r && r.json;
    const ok =
      res.status === 204 &&
      recibidas.length === antes + 1 &&
      r.metodo === "POST" &&
      r.ruta === "/api/colimago-logs" &&
      r.authorization === null &&
      r.clave === "clave-de-prueba" &&
      formaValida(e) &&
      Object.entries(esperado).every(([k, v]) => e[k] === v);
    comprobar(ok, `${nombre.padEnd(26)} → ${e ? `${e.event} ${e.path} ${e.target || ""} ${e.channel}`.trim() : "(no llegó)"}`);
  }

  // --- Lo que no debe llegar al backend ---
  console.log("\nLo que se descarta:");
  const descartes = [
    ["Googlebot", { event: "page_view", path: "/" }, UA.googlebot, 204],
    ["Lighthouse", { event: "page_view", path: "/" }, UA.lighthouse, 204],
    ["curl", { event: "page_view", path: "/" }, UA.curl, 204],
    ["sin User-Agent", { event: "page_view", path: "/" }, "", 204],
    ["evento desconocido", { event: "purchase", path: "/" }, UA.safariIphone, 400],
    ["click sin target", { event: "click", path: "/" }, UA.safariIphone, 400],
    ["target con texto libre", { event: "click", path: "/", target: "Hola mundo" }, UA.safariIphone, 400],
    ["ruta con dominio", { event: "page_view", path: "https://evil.com/" }, UA.safariIphone, 400],
    ["ruta que no es texto", { event: "page_view", path: { $ne: 1 } }, UA.safariIphone, 400],
    ["cuerpo que no es objeto", "hola", UA.safariIphone, 400],
  ];
  for (const [nombre, body, ua, esperado] of descartes) {
    const antes = recibidas.length;
    const res = await enviar(body, ua);
    comprobar(res.status === esperado && recibidas.length === antes, `${nombre.padEnd(26)} → ${res.status}, backend no llamado`);
  }

  {
    const antes = recibidas.length;
    const res = await enviar({ event: "page_view", path: "/" }, UA.safariIphone, { Origin: "https://otro-sitio.com" });
    comprobar(res.status === 403 && recibidas.length === antes, "Origin de otro sitio         → 403, backend no llamado");
  }
  {
    const antes = recibidas.length;
    const res = await enviar({ event: "page_view", path: "/" }, UA.safariIphone, { Origin: "https://www.colimago.mx" });
    comprobar(res.status === 204 && recibidas.length === antes + 1, "Origin www.colimago.mx        → 204, llega al backend");
  }

  // Campos de más del navegador no se reenvían: el backend los rechazaría con 400.
  {
    const antes = recibidas.length;
    const res = await enviar({ event: "page_view", path: "/", platform: "ios", visitor: "x", email: "a@b.mx", ip: "1.2.3.4", userId: "1" }, UA.safariIphone);
    const e = recibidas[antes] && recibidas[antes].json;
    comprobar(res.status === 204 && e && formaValida(e) && !("email" in e) && !("ip" in e) && e.visitor !== "x", "campos extra del navegador → ignorados");
  }

  // La IP y el user agent nunca salen: el hash cambia con la IP y no la contiene.
  {
    const hashDe = async (ip) => {
      const antes = recibidas.length;
      await enviar({ event: "page_view", path: "/" }, UA.safariIphone, { "x-real-ip": ip });
      return recibidas[antes].json.visitor;
    };
    const a = await hashDe("203.0.113.7");
    const a2 = await hashDe("203.0.113.7");
    const b = await hashDe("203.0.113.8");
    const crudo = JSON.stringify(recibidas.map((r) => r.json));
    comprobar(a === a2 && a !== b && !crudo.includes("203.0.113") && !crudo.includes("Mozilla"), "visitor: estable por IP, distinto entre IPs, sin IP ni user agent");
  }

  // --- La geo de Vercel ---
  {
    const antes = recibidas.length;
    await enviar({ event: "page_view", path: "/" }, UA.safariIphone, { "x-vercel-ip-country": "MX", "x-vercel-ip-country-region": "COL", "x-vercel-ip-city": "Santiago%20de%20Colima" });
    const e = recibidas[antes].json;
    comprobar(e.country === "MX" && e.region === "COL" && e.city === "Santiago de Colima", "ubicación de las cabeceras de Vercel");
  }

  // --- El backend falla: la página nunca lo nota ---
  console.log("\nFallos del backend:");
  for (const [nombre, respuesta] of [
    ["400 de validación", { status: 400, body: { message: ["device must be one of the following values"], statusCode: 400 } }],
    ["401 clave inválida", { status: 401, body: { message: "Invalid logs key", statusCode: 401 } }],
    ["429 por rate limit", { status: 429, body: { message: "ThrottlerException: Too Many Requests", statusCode: 429 } }],
  ]) {
    simular = respuesta;
    const res = await enviar({ event: "page_view", path: "/" }, UA.safariIphone);
    comprobar(res.status === 204, `${nombre.padEnd(24)} → ${res.status}`);
  }

  sitio.close();
  backendFalso.close();
  console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : "\nTodo bien: cada evento llega a POST /colimago-logs con los campos exactos, x-logs-key y sin Authorization.");
  process.exit(fallos ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
