// Único punto de salida hacia el backend real de ColimaApp (backColimaApp).
// Ninguna otra parte del panel llama a fetch() contra el backend: todo pasa
// por llamarBackend(), que
//
//   1. agrega SIEMPRE la cabecera `Authorization: Bearer <token de admin>`
//      — es la única forma en que el backend acepta el token: ya no viaja
//      como campo "token" en la query ni en el body;
//   2. convierte los errores del backend (401/403/429/400, y los 200 con
//      { response:false, message }) en un BackendError con el status y el
//      "message" que devolvió, para que server.js se lo muestre al usuario
//      tal cual en vez de un "error genérico".
//
// El token es el JWT de la sesión del administrador (lo que devuelve
// POST /login/google); server.js lo saca de req.session.adminToken.

const MENSAJES_POR_STATUS = {
  400: "El backend rechazó la petición.",
  401: "Tu sesión con el backend ya no es válida. Inicia sesión otra vez.",
  403: "Esta cuenta no tiene permisos de administrador en el backend.",
  429: "Demasiadas peticiones al backend. Espera un momento e inténtalo de nuevo.",
};

// Errores que el backend devuelve con cuerpo { message, statusCode } y que
// hay que reenviar al panel con su mensaje en lugar de un 502 genérico.
const STATUS_CON_MENSAJE = new Set(Object.keys(MENSAJES_POR_STATUS).map(Number));

class BackendError extends Error {
  // status: el que responde este panel al navegador.
  // backendStatus: el HTTP real que devolvió el backend (útil para que el
  // panel distinga, por ejemplo, un 401 del backend de un 401 propio).
  constructor(status, message, backendStatus) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.backendStatus = backendStatus;
  }
}

// NestJS a veces manda "message" como arreglo (errores de validación).
function textoMensaje(message) {
  if (Array.isArray(message)) return message.filter(Boolean).join(". ");
  return typeof message === "string" && message.trim() ? message : "";
}

function urlBackend(ruta, params) {
  const base = process.env.COLIMA_BACKEND_URL;
  if (!base) {
    throw new Error("Falta la variable COLIMA_BACKEND_URL");
  }
  const query = params.toString();
  return `${base.replace(/\/$/, "")}${ruta}${query ? `?${query}` : ""}`;
}

/**
 * Llama al backend de ColimaApp.
 *
 * @param {string|null} token    JWT del administrador (null solo para el login).
 * @param {string} ruta          Ruta relativa al backend, ej. "/post/admin-update".
 * @param {object} [opciones]
 * @param {string} [opciones.method="GET"]
 * @param {object} [opciones.query]         Parámetros de query (se omiten los null/undefined).
 * @param {object} [opciones.body]          Cuerpo JSON (POST/PATCH/DELETE).
 * @param {FormData} [opciones.formData]    Cuerpo multipart (subida de imágenes); excluye a body.
 * @param {string} [opciones.mensajeError]  Mensaje si el backend responde
 *                                          { response:false } sin "message".
 * @returns {Promise<object>} el JSON que devolvió el backend.
 * @throws {BackendError} si el backend respondió error o { response:false }.
 */
async function llamarBackend(token, ruta, opciones = {}) {
  const { method = "GET", query = {}, body, formData, mensajeError } = opciones;

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null) params.set(clave, String(valor));
  }

  let cuerpo;
  if (formData) {
    // fetch pone solo el Content-Type multipart con el boundary.
    cuerpo = formData;
  } else if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    cuerpo = JSON.stringify(body || {});
  }

  const url = urlBackend(ruta, params);
  if (process.env.COLIMA_DEBUG_BACKEND) {
    const auth = headers.Authorization
      ? `Authorization: Bearer ${String(token).slice(0, 12)}…`
      : "SIN Authorization";
    console.log(`[backend] ${method} ${ruta} — ${auth}`);
  }

  const respuesta = await fetch(url, { method, headers, body: cuerpo });

  // Heroku puede contestar HTML (503, timeouts), así que no se asume JSON.
  const texto = await respuesta.text();
  let datos = {};
  try {
    datos = texto ? JSON.parse(texto) : {};
  } catch {
    datos = {};
  }
  if (datos === null || typeof datos !== "object") datos = {};

  if (STATUS_CON_MENSAJE.has(respuesta.status)) {
    throw new BackendError(
      respuesta.status,
      textoMensaje(datos.message) || MENSAJES_POR_STATUS[respuesta.status],
      respuesta.status,
    );
  }
  if (!respuesta.ok) {
    throw new BackendError(
      502,
      `El backend de ColimaApp respondió ${respuesta.status}`,
      respuesta.status,
    );
  }
  // Errores "de negocio" que el backend responde con 200 (token inválido en
  // el flujo viejo, no encontrado, "Campos no permitidos: ...", etc.).
  if (datos.response === false) {
    throw new BackendError(
      400,
      textoMensaje(datos.message) || mensajeError || MENSAJES_POR_STATUS[400],
      respuesta.status,
    );
  }
  return datos;
}

module.exports = { llamarBackend, BackendError };
