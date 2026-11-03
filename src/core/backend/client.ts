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

/**
 * Ejecuta una llamada nativa al backend y aplica la semántica de errores de
 * arriba. Compartido por las llamadas JSON y por la subida de imágenes.
 */
async function datosDelBackend(
  llamar: () => Promise<RespuestaCruda>,
  mensajeError: string | undefined,
  /** Mensajes propios de la llamada por status; reciben el "message" del backend ('' si no mandó). */
  mensajesPorStatus: Record<number, (delBackend: string) => string> = {},
): Promise<DatosBackend> {
  let respuesta: RespuestaCruda;
  try {
    respuesta = await llamar();
  } catch (err) {
    if (err instanceof AppError && err.kind === 'notAuthenticated') {
      throw new BackendError(401, err.message);
    }
    throw err;
  }

  const { status } = respuesta;
  const datos: DatosBackend =
    respuesta.body && typeof respuesta.body === 'object' ? (respuesta.body as DatosBackend) : {};

  const mensajePropio = mensajesPorStatus[status];
  if (mensajePropio) {
    throw new BackendError(status, mensajePropio(textoMensaje(datos.message)), status);
  }
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
  return datos;
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

  const datos = await datosDelBackend(
    () =>
      command<RespuestaCruda>('backend_request', {
        method,
        path: ruta,
        query: params,
        body: method === 'GET' ? null : (body ?? {}),
      }),
    mensajeError,
  );
  return datos as T;
}

/**
 * A dónde se sube una imagen. Cada app tiene su propia cuenta de Cloudinary
 * y el backend guarda las credenciales (nunca van en la app):
 *   - `/images`: la cuenta principal (ColimaApp).
 *   - `/magentagroup/images`: la cuenta de Magenta Group; solo admin. Todo lo
 *     de Magenta (fotos del catálogo, CRM) sube por aquí.
 * Debe coincidir con UPLOAD_ENDPOINTS en src-tauri/src/backend.rs.
 */
export type DestinoImagen = '/images' | '/magentagroup/images';

// Errores de la subida que merecen un texto más claro que el genérico.
const MENSAJES_DE_SUBIDA: Record<number, (delBackend: string) => string> = {
  413: () => 'La foto pesa más de 8 MB. Elige una más ligera.',
  429: () => 'Se alcanzó el límite de 10 fotos por minuto. Espera un momento e inténtalo de nuevo.',
  // El backend avisa qué variables de Cloudinary le faltan; no es culpa de esta computadora.
  503: (delBackend) =>
    delBackend
      ? `El servidor de fotos no está configurado: ${delBackend}`
      : 'El servidor de fotos no está disponible (503). Es un problema del servidor, no de tu computadora; inténtalo en un momento.',
};

/**
 * Sube una imagen del disco a Cloudinary a través del backend y regresa su
 * URL pública. Los bytes viajan crudos hacia Rust, que los manda como
 * multipart con el JWT; `carpeta` solo admite letras, números, `_`, `-` y `/`
 * (la misma regla del backend). El backend limita a 8 MB por imagen y a 10
 * subidas por minuto: pasado el límite responde 429.
 */
export async function subirImagen(destino: DestinoImagen, carpeta: string, archivo: Blob): Promise<string> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const datos = await datosDelBackend(
    () =>
      command<RespuestaCruda>('backend_upload_image', bytes, {
        headers: { 'x-endpoint': destino, 'x-folder': carpeta },
      }),
    'No se pudo subir la imagen.',
    MENSAJES_DE_SUBIDA,
  );
  if (typeof datos.url !== 'string' || !datos.url) {
    throw new BackendError(502, 'El backend no devolvió la dirección de la imagen.');
  }
  return datos.url;
}
