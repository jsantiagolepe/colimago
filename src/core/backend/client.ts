// Cliente del backend remoto (NestJS en Heroku). Es el antiguo
// lib/colima-backend.js: la petición la hace Rust (que agrega
// `Authorization: Bearer <jwt>`; el token nunca llega aquí) y esta capa
// conserva la misma semántica de errores que tenía la versión web:
//
//   - 401/403/429/400 del backend → BackendError con ese status y el
//     "message" que mandó (o un texto por defecto).
//   - cualquier otro status que no sea 2xx → BackendError 502.
//   - 200 con { response:false, message } → BackendError 400.

import { AppError, command } from '../tauri';

const MENSAJES_POR_STATUS: Record<number, string> = {
  400: 'El backend rechazó la petición.',
  401: 'Tu sesión con el backend ya no es válida. Inicia sesión otra vez.',
  403: 'Esta cuenta no tiene permisos de administrador en el backend.',
  429: 'Demasiadas peticiones al backend. Espera un momento e inténtalo de nuevo.',
};

const STATUS_CON_MENSAJE = new Set(Object.keys(MENSAJES_POR_STATUS).map(Number));

export class BackendError extends Error {
  /** El status con el que se le contesta a quien llamó. */
  readonly status: number;
  /** El HTTP real del backend; undefined si ni siquiera se llegó a él (sin sesión). */
  readonly backendStatus: number | undefined;

  constructor(status: number, message: string, backendStatus?: number) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
    this.backendStatus = backendStatus;
  }
}

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OpcionesBackend {
  method?: MetodoHttp;
  /** Parámetros de query; se omiten los null/undefined. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Cuerpo JSON (POST/PUT/PATCH/DELETE). */
  body?: unknown;
  /** Mensaje si el backend responde { response:false } sin "message". */
  mensajeError?: string;
}

// El backend responde JSON libre; cada módulo lee los campos que conoce.
export type DatosBackend = Record<string, any>;

interface RespuestaCruda {
  status: number;
  body: unknown;
}

// NestJS a veces manda "message" como arreglo (errores de validación).
function textoMensaje(message: unknown): string {
  if (Array.isArray(message)) return message.filter(Boolean).join('. ');
  return typeof message === 'string' && message.trim() ? message : '';
}

export async function llamarBackend<T extends DatosBackend = DatosBackend>(
  ruta: string,
  opciones: OpcionesBackend = {},
): Promise<T> {
  const { method = 'GET', query = {}, body, mensajeError } = opciones;
  const params = Object.fromEntries(
    Object.entries(query)
      .filter(([, valor]) => valor !== undefined && valor !== null)
      .map(([clave, valor]) => [clave, String(valor)]),
  );

  let respuesta: RespuestaCruda;
  try {
    respuesta = await command<RespuestaCruda>('backend_request', {
      method,
      path: ruta,
      query: params,
      body: method === 'GET' ? null : (body ?? {}),
    });
  } catch (err) {
    if (err instanceof AppError && err.kind === 'notAuthenticated') {
      throw new BackendError(401, err.message);
    }
    throw err;
  }

  const { status } = respuesta;
  const datos: DatosBackend =
    respuesta.body && typeof respuesta.body === 'object' ? (respuesta.body as DatosBackend) : {};

  if (STATUS_CON_MENSAJE.has(status)) {
    throw new BackendError(status, textoMensaje(datos.message) || MENSAJES_POR_STATUS[status], status);
  }
  if (status < 200 || status >= 300) {
    throw new BackendError(502, `El backend de ColimaApp respondió ${status}`, status);
  }
  // Errores "de negocio" que el backend responde con 200 (no encontrado,
  // "Campos no permitidos: ...", etc.).
  if (datos.response === false) {
    throw new BackendError(400, textoMensaje(datos.message) || mensajeError || MENSAJES_POR_STATUS[400], status);
  }
  return datos as T;
}
