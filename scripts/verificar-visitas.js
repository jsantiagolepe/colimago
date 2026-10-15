#!/usr/bin/env node
// Verificación rápida del registro de visitas: que POST /visita arme el
// `app_opened` con platform "web" y lo mande a POST /logs del backend con
// exactamente los campos que ese endpoint acepta (cualquier otro lo rechaza
// con 400), sin Authorization, y que descarte bots, ids inválidos y el
// registro apagado.
//
// No necesita el backend real: levanta uno falso en un puerto libre.
//
//   npm run verificar:visitas
//   (o) node scripts/verificar-visitas.js

const http = require("http");

process.env.NODE_ENV = "test";
process.env.VISITAS_ACTIVO = "1"; // fuera de Vercel el registro está apagado

// Los campos de CreateLogDto en backColimaApp (src/logs/dto/create-log.dto.ts).
const CAMPOS = ["event", "userId", "platform", "deviceModel", "osVersion", "appVersion", "appBuild", "timestamp"];

const ID = "6acd5bfd8677ca46b7ae4296";
const UA = {
  chromeAndroid: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  firefoxAndroid: "Mozilla/5.0 (Android 13; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1",
  facebookIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.0.0]",
  edgeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  googlebot: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  lighthouse: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Chrome-Lighthouse",
  headless: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36",
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
    recibidas.push({ metodo: req.method, ruta: req.url, authorization: req.headers.authorization || null, json });
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

  const visita = (body, userAgent) =>
    fetch(`${base}/visita`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(userAgent ? { "User-Agent": userAgent } : {}) },
      body: JSON.stringify(body),
    });

  let fallos = 0;
  const comprobar = (ok, texto) => {
    if (!ok) fallos++;
    console.log(`${ok ? "✓" : "✗"} ${texto}`);
  };

  // --- Navegadores reales: qué evento llega al backend ---
  console.log("Evento que llega a POST /logs:");
  const casos = [
    ["chromeAndroid", "Chrome 126", "Android"], // Chrome congela Android en "10; K": sin versión
    ["firefoxAndroid", "Firefox 128", "Android 13"],
    ["samsung", "Samsung Internet 25", "Android 14"],
    ["safariIphone", "Safari 17", "iOS 17.5"],
    ["chromeIphone", "Chrome 126", "iOS 17.5"],
    ["facebookIphone", "Facebook", "iOS 17.5"],
    ["edgeWindows", "Edge 126", "Windows"],
    ["safariMac", "Safari 17", "macOS"],
  ];
  for (const [clave, navegador, sistema] of casos) {
    const antes = recibidas.length;
    const res = await visita({ userId: ID }, UA[clave]);
    const e = recibidas[antes] && recibidas[antes].json;
    const ok =
      res.status === 204 &&
      recibidas.length === antes + 1 &&
      recibidas[antes].metodo === "POST" &&
      recibidas[antes].ruta === "/api/logs" &&
      recibidas[antes].authorization === null &&
      Object.keys(e).sort().join() === [...CAMPOS].sort().join() &&
      e.event === "app_opened" &&
      e.platform === "web" &&
      e.userId === ID &&
      e.deviceModel === navegador &&
      e.osVersion === sistema &&
      /^\d+\.\d+\.\d+$/.test(e.appVersion) &&
      e.appBuild === "local" &&
      !Number.isNaN(Date.parse(e.timestamp)) &&
      new Date(e.timestamp).toISOString() === e.timestamp;
    comprobar(ok, `${clave.padEnd(15)} → ${e ? `${e.deviceModel} · ${e.osVersion}` : "(no llegó)"}`);
  }

  // --- Lo que no debe llegar al backend ---
  console.log("\nLo que se descarta:");
  const descartes = [
    ["Googlebot", { userId: ID }, UA.googlebot, 204],
    ["Lighthouse", { userId: ID }, UA.lighthouse, 204],
    ["Chrome headless", { userId: ID }, UA.headless, 204],
    ["curl", { userId: ID }, UA.curl, 204],
    ["sin User-Agent (fetch: node)", { userId: ID }, "", 204],
    ["sin userId", {}, UA.safariIphone, 400],
    ["userId con un email", { userId: "alguien@correo.com" }, UA.safariIphone, 400],
    ["userId de 23 caracteres", { userId: ID.slice(1) }, UA.safariIphone, 400],
    ["userId que no es texto", { userId: { $ne: 1 } }, UA.safariIphone, 400],
  ];
  for (const [nombre, body, ua, esperado] of descartes) {
    const antes = recibidas.length;
    const res = await visita(body, ua);
    comprobar(res.status === esperado && recibidas.length === antes, `${nombre.padEnd(28)} → ${res.status}, backend no llamado`);
  }

  // Campos de más en el body no se reenvían: el backend los rechazaría con 400.
  {
    const antes = recibidas.length;
    const res = await visita({ userId: ID, email: "a@b.mx", platform: "ios", appBuild: "x" }, UA.safariIphone);
    const e = recibidas[antes] && recibidas[antes].json;
    comprobar(
      res.status === 204 && e && Object.keys(e).sort().join() === [...CAMPOS].sort().join() && e.platform === "web" && e.appBuild === "local",
      "campos extra del navegador → ignorados, platform sigue en web",
    );
  }

  // --- El backend falla: 502 para el navegador, que lo ignora ---
  console.log("\nFallos del backend:");
  for (const [nombre, respuesta] of [
    ["400 de validación", { status: 400, body: { message: ["platform must be one of the following values: ios, android"], statusCode: 400 } }],
    ["429 por rate limit", { status: 429, body: { message: "ThrottlerException: Too Many Requests", statusCode: 429 } }],
    ["200 con response:false", { status: 200, body: { message: "Error saving log", response: false } }],
  ]) {
    simular = respuesta;
    const res = await visita({ userId: ID }, UA.safariIphone);
    comprobar(res.status === 502, `${nombre.padEnd(24)} → ${res.status}`);
  }

  sitio.close();
  backendFalso.close();
  console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : "\nTodo bien: cada visita llega como app_opened / platform web, con los campos exactos de POST /logs y sin Authorization.");
  process.exit(fallos ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
