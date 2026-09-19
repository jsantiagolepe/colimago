#!/usr/bin/env node
// Verificación rápida de que TODAS las llamadas del panel al backend de
// ColimaApp llevan la cabecera `Authorization: Bearer <token>` y que el
// token NO viaja como campo "token" en la query ni en el body (el backend
// ya no lo acepta ahí).
//
// No necesita el backend real ni Google: levanta un backend falso en un
// puerto libre, arranca server.js apuntando a él, firma una cookie de
// sesión con SESSION_SECRET y recorre todas las rutas /api/*. Al final
// imprime, por cada llamada que llegó al backend falso, si traía la
// cabecera y si se coló un "token" en query/body, y falla en ambos casos.
//
//   npm run verificar
//   (o) node scripts/verificar-backend.js

const http = require("http");
const assert = require("assert");

const TOKEN = "jwt-de-prueba-" + Date.now();
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "secreto-de-prueba";
process.env.NODE_ENV = "test";

// --- 1. Backend falso: responde 200 { response:true } y anota cada petición ---
const recibidas = [];
let simularStatus = 0; // status que el backend falso devolverá en su próxima respuesta
const backendFalso = http.createServer((req, res) => {
  let cuerpo = "";
  req.on("data", (c) => (cuerpo += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    let json = null;
    try {
      json = cuerpo ? JSON.parse(cuerpo) : null;
    } catch {
      json = null;
    }
    recibidas.push({
      metodo: req.method,
      ruta: url.pathname,
      authorization: req.headers.authorization || null,
      tokenEnQuery: url.searchParams.has("token"),
      tokenEnBody: Boolean(json && "token" in json),
      // Nombres de los campos multipart (para confirmar "image" y "folder").
      camposMultipart: [...cuerpo.matchAll(/;\s*name="([^"]+)"/g)].map((m) => m[1]),
      contentType: req.headers["content-type"] || "",
      multipart: (req.headers["content-type"] || "").startsWith("multipart/form-data"),
    });

    // Simula los errores nuevos del backend (401/403/429/400 con
    // { message, statusCode }) para comprobar que el panel reenvía el
    // "message" en vez de un 502 genérico.
    if (simularStatus) {
      const status = simularStatus;
      simularStatus = 0;
      res.writeHead(status, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: `Mensaje simulado ${status}`, statusCode: status }));
    }
    if (json && json.cambios && json.cambios.campoRaro) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ response: false, message: "Campos no permitidos: campoRaro" }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ response: true, eventos: [], posts: [], lugares: [], registros: [], locales: [] }));
  });
});

async function main() {
  await new Promise((ok) => backendFalso.listen(0, "127.0.0.1", ok));
  process.env.COLIMA_BACKEND_URL = `http://127.0.0.1:${backendFalso.address().port}/api`;

  // --- 2. Panel real (server.js) apuntando al backend falso ---
  const app = require("../server");
  const panel = http.createServer(app);
  await new Promise((ok) => panel.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${panel.address().port}`;

  // --- 3. Cookie de sesión firmada igual que la firma cookie-session ---
  const Keygrip = require("keygrip");
  const valor = Buffer.from(JSON.stringify({ adminToken: TOKEN, adminName: "Prueba" })).toString("base64");
  const firma = new Keygrip([process.env.SESSION_SECRET]).sign(`colimago.sesion=${valor}`);
  const cookie = `colimago.sesion=${valor}; colimago.sesion.sig=${firma}`;

  const llamar = (metodo, ruta, body, extra = {}) =>
    fetch(base + ruta, {
      method: metodo,
      headers: {
        Cookie: cookie,
        ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(extra.headers || {}),
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });

  // --- 4. Todas las rutas /api/* del panel ---
  const png = new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" });
  const formImagen = new FormData();
  formImagen.append("image", png, "prueba.png");
  formImagen.append("folder", "eventos/2026");

  const rutas = [
    ["GET", "/api/pendientes?estatus=pendiente"],
    ["GET", "/api/pendientes/mismo-dia?fecha=2026-09-17&excluir=abc"],
    ["POST", "/api/pendientes/abc/traducir"],
    ["POST", "/api/pendientes/abc/aprobar", { title: "x" }],
    ["POST", "/api/pendientes/abc/rechazar"],
    ["POST", "/api/pendientes/abc/deshacer"],
    ["POST", "/api/pendientes/abc/publicar"],
    ["GET", "/api/directorio"],
    ["POST", "/api/directorio", { municipio_nombre: "Colima", facebook_id: "1" }],
    ["PUT", "/api/directorio/abc", { facebook_id: "2" }],
    ["DELETE", "/api/directorio/abc"],
    ["GET", "/api/lugares"],
    ["POST", "/api/lugares", { nombre: "Jardín" }],
    ["PUT", "/api/lugares/abc", { nombre: "Jardín 2" }],
    ["DELETE", "/api/lugares/abc"],
    ["GET", "/api/posts-admin?q=feria"],
    ["PUT", "/api/posts-admin/abc", { title: "Nuevo" }],
    ["GET", "/api/posts?estatus=activo"],
    ["POST", "/api/posts/abc/pausar"],
    ["POST", "/api/posts/abc/activar"],
    ["POST", "/api/posts/abc/papelera"],
    ["POST", "/api/posts/abc/restaurar"],
    ["DELETE", "/api/posts/abc"],
    ["GET", "/api/locales?type=10"],
    ["POST", "/api/locales", { title: "Río", location: {} }],
    ["PUT", "/api/locales/abc", { title: "Río 2" }],
    ["POST", "/api/locales/abc/baja"],
    ["POST", "/api/locales/abc/reactivar"],
    ["GET", "/api/locales/export"],
    ["POST", "/api/images", formImagen],
  ];

  let fallos = 0;
  for (const [metodo, ruta, body] of rutas) {
    const antes = recibidas.length;
    const res = await llamar(metodo, ruta, body);
    const llegada = recibidas[antes];
    if (!llegada) {
      console.log(`✗ ${metodo} ${ruta} → el panel respondió ${res.status} y NO llamó al backend`);
      fallos++;
      continue;
    }
    const conCabecera = llegada.authorization === `Bearer ${TOKEN}`;
    const sinTokenSuelto = !llegada.tokenEnQuery && !llegada.tokenEnBody;
    const esImagen = llegada.ruta.endsWith("/images");
    const multipartOk = !esImagen
      || (llegada.multipart && llegada.camposMultipart.includes("image") && llegada.camposMultipart.includes("folder"));
    const ok = res.status === 200 && conCabecera && sinTokenSuelto && multipartOk;
    if (!ok) fallos++;
    console.log(
      `${ok ? "✓" : "✗"} ${metodo.padEnd(6)} ${ruta.padEnd(48)} → backend ${llegada.metodo} ${llegada.ruta}` +
        `  Authorization: ${conCabecera ? "Bearer ✓" : llegada.authorization || "FALTA"}` +
        `  sin token en query/body: ${sinTokenSuelto ? "✓" : `SE COLÓ en ${llegada.tokenEnQuery ? "query" : "body"}`}` +
        (esImagen ? `  multipart [${llegada.camposMultipart.join(", ")}]: ${multipartOk ? "✓" : "✗"}` : "") +
        `  panel: ${res.status}`,
    );
  }

  // --- 5. Errores nuevos: el panel debe reenviar el "message" con su status ---
  console.log("\nManejo de errores del backend:");
  const formImagen400 = new FormData();
  formImagen400.append("image", png, "prueba.png");
  formImagen400.append("folder", "eventos");
  const casos = [
    ["GET", "/api/posts?estatus=activo", 401],
    ["GET", "/api/posts?estatus=activo", 403],
    ["POST", "/api/pendientes/abc/traducir", 429],
    ["POST", "/api/images", 400, formImagen400],
  ];
  for (const [metodo, ruta, esperado, body] of casos) {
    simularStatus = esperado;
    const res = await llamar(metodo, ruta, body);
    const data = await res.json().catch(() => ({}));
    const ok =
      res.status === esperado &&
      data.backendStatus === esperado &&
      typeof data.error === "string" &&
      data.error.includes("Mensaje simulado");
    if (!ok) fallos++;
    console.log(`${ok ? "✓" : "✗"} ${metodo} ${ruta}: backend ${esperado} → panel ${res.status} error="${data.error}"`);
  }

  // /post/admin-update con campos fuera del schema → 200 { response:false, message }
  {
    const res = await llamar("PUT", "/api/posts-admin/abc", { campoRaro: 1 });
    const data = await res.json();
    const ok = res.status === 400 && data.error === "Campos no permitidos: campoRaro";
    if (!ok) fallos++;
    console.log(`${ok ? "✓" : "✗"} admin-update con campo fuera del schema → panel ${res.status} error="${data.error}"`);
  }

  // Validaciones locales de POST /api/images (no deben llegar al backend)
  console.log("\nValidaciones de POST /api/images:");
  const casosImagen = [
    ["folder con &", "eventos&x", png, "p.png", "folder"],
    ["folder con ..", "a/../b", png, "p.png", "folder"],
    ["archivo .txt", "eventos", new Blob(["hola"], { type: "text/plain" }), "p.txt", "JPEG"],
    ["archivo de 9 MB", "eventos", new Blob([Buffer.alloc(9 * 1024 * 1024)], { type: "image/png" }), "p.png", "8 MB"],
  ];
  for (const [nombre, folder, blob, filename, fragmento] of casosImagen) {
    const antes = recibidas.length;
    const fd = new FormData();
    fd.append("image", blob, filename);
    fd.append("folder", folder);
    const res = await llamar("POST", "/api/images", fd);
    const data = await res.json().catch(() => ({}));
    const ok = res.status >= 400 && res.status < 500 && String(data.error).includes(fragmento) && recibidas.length === antes;
    if (!ok) fallos++;
    console.log(`${ok ? "✓" : "✗"} ${nombre.padEnd(18)} → panel ${res.status} error="${data.error}" (backend no llamado: ${recibidas.length === antes})`);
  }

  panel.close();
  backendFalso.close();
  console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : "\nTodo bien: cada llamada al backend lleva Authorization: Bearer y ninguna manda token en query/body.");
  process.exit(fallos ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
