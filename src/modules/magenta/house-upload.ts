// New House: subir las fotos a Cloudinary (vía el backend) y guardar la casa.
//
// El backend limita POST /images a 10 subidas por minuto por IP y a 8 MB por
// foto (images.controller.ts / throttle.config.ts). Una casa con 15 fotos
// pasa del límite, así que las subidas van de una en una, con un respiro
// antes de llegar al tope, y un 429 inesperado (otra app compartiendo la IP)
// espera y reintenta en vez de fallar la casa completa.

import { BackendError, llamarBackend, subirImagen } from '../../core/backend/client';
import { ordenarCasas, type Casa, type CasaPayload, type Colonia } from './house';

/** Las fotos de Magenta suben a su propia cuenta de Cloudinary (POST /api/magentagroup/images, solo admin). */
export const DESTINO_FOTOS = '/magentagroup/images';
/** Carpeta de esa cuenta donde caen las fotos de las casas. */
export const CARPETA_FOTOS = 'magentagroup/properties';
/** Lo máximo que acepta el backend por foto. */
export const MAX_BYTES_FOTO = 8 * 1024 * 1024;

const VENTANA_MS = 60_000;
/** Un poco menos que las 10 del backend, para dejar margen. */
const SUBIDAS_POR_VENTANA = 9;
const REINTENTOS_429 = 3;
const ESPERA_429_MS = 20_000;

export class SubidaCancelada extends Error {
  constructor() {
    super('Subida cancelada.');
    this.name = 'SubidaCancelada';
  }
}

/**
 * Una foto de la casa: una del disco (`file`, que se sube y entonces recibe
 * su `url`) o una que ya estaba guardada en la casa (solo `url`; no se vuelve
 * a subir).
 */
export type FotoPorSubir = { file: Blob; url?: string } | { file?: undefined; url: string };

export interface AvanceSubida {
  /** Fotos ya subidas, de `total` (solo cuentan las que había que subir). */
  hechas: number;
  total: number;
  /** Si está esperando por el límite, cuántos segundos faltan. */
  esperaSegundos?: number;
}

interface Dependencias {
  subir: (archivo: Blob) => Promise<string>;
  ahora: () => number;
  dormir: (ms: number) => Promise<void>;
}

const REALES: Dependencias = {
  subir: (archivo) => subirImagen(DESTINO_FOTOS, CARPETA_FOTOS, archivo),
  ahora: () => Date.now(),
  dormir: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
};

/**
 * Sube las fotos que aún no tienen URL, en orden, y las va anotando en cada
 * foto (`foto.url`) para que un reintento retome donde se quedó. Regresa las
 * URLs de TODAS en el mismo orden que `fotos` (las que ya eran de la casa se
 * quedan como están). `cancelada()` corta antes de la siguiente subida (p. ej.
 * al salir de la pantalla).
 */
export async function subirFotos(
  fotos: FotoPorSubir[],
  alAvanzar: (avance: AvanceSubida) => void,
  cancelada: () => boolean = () => false,
  dep: Dependencias = REALES,
): Promise<string[]> {
  const porSubir = fotos.filter((f) => !f.url);
  const total = porSubir.length;
  const hechas = () => porSubir.filter((f) => f.url).length;
  const instantes: number[] = [];
  alAvanzar({ hechas: hechas(), total });

  const esperar = async (ms: number) => {
    // Cuenta regresiva de a segundo para que la pantalla muestre cuánto falta.
    for (let restante = ms; restante > 0 && !cancelada(); restante -= 1000) {
      alAvanzar({ hechas: hechas(), total, esperaSegundos: Math.ceil(restante / 1000) });
      await dep.dormir(Math.min(1000, restante));
    }
    alAvanzar({ hechas: hechas(), total });
  };

  for (const foto of porSubir) {
    if (cancelada()) throw new SubidaCancelada();

    // Respiro antes de pasar el tope de subidas por minuto.
    while (instantes.length > 0 && dep.ahora() - instantes[0] >= VENTANA_MS) instantes.shift();
    if (instantes.length >= SUBIDAS_POR_VENTANA) {
      await esperar(instantes[0] + VENTANA_MS - dep.ahora());
      if (cancelada()) throw new SubidaCancelada();
    }

    for (let intento = 0; ; intento++) {
      try {
        instantes.push(dep.ahora());
        foto.url = await dep.subir(foto.file as Blob); // sin url, siempre trae su archivo
        break;
      } catch (err) {
        if (err instanceof BackendError && err.status === 429 && intento < REINTENTOS_429) {
          await esperar(ESPERA_429_MS);
          if (cancelada()) throw new SubidaCancelada();
          continue;
        }
        throw err;
      }
    }
    alAvanzar({ hechas: hechas(), total });
  }

  return fotos.map((f) => f.url as string);
}

/** El texto para mostrar de un error de cualquiera de estas llamadas. */
export function mensajeDeError(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Ocurrió un error inesperado.';
}

/** POST /magentagroup. Un código repetido llega como BackendError con su mensaje. */
export async function guardarCasa(casa: CasaPayload): Promise<void> {
  await llamarBackend('/magentagroup', {
    method: 'POST',
    body: casa,
    mensajeError: 'No se pudo guardar la casa.',
  });
}

/** GET /magentagroup: todo el catálogo (público en el backend), las más nuevas primero. */
export async function listarCasas(): Promise<Casa[]> {
  const datos = await llamarBackend<Record<string, unknown>>('/magentagroup', {
    mensajeError: 'No se pudo cargar el catálogo.',
  });
  // El backend responde un arreglo; llamarBackend lo trata como objeto.
  if (!Array.isArray(datos)) throw new BackendError(502, 'El backend no devolvió la lista de casas.');
  return ordenarCasas(datos as unknown as Casa[]);
}

/**
 * PATCH /magentagroup/:id (admin): cambia los campos que se manden; `photos`
 * reemplaza a las guardadas. Un código repetido llega como BackendError con su mensaje.
 */
export async function actualizarCasa(id: string, casa: Partial<CasaPayload>): Promise<void> {
  await llamarBackend(`/magentagroup/${id}`, {
    method: 'PATCH',
    body: casa,
    mensajeError: 'No se pudieron guardar los cambios.',
  });
}

/**
 * GET /magentagroup/colonias (público): las colonias agregadas desde el CRM
 * más las que ya usan las casas del catálogo, cada una con su ciudad.
 */
export async function listarColonias(): Promise<Colonia[]> {
  const datos = await llamarBackend<Record<string, unknown>>('/magentagroup/colonias', {
    mensajeError: 'No se pudo cargar la lista de colonias.',
  });
  // El backend responde un arreglo; llamarBackend lo trata como objeto.
  if (!Array.isArray(datos)) throw new BackendError(502, 'El backend no devolvió la lista de colonias.');
  return datos as unknown as Colonia[];
}

/**
 * POST /magentagroup/colonias (admin): guarda la colonia en la base de Magenta.
 * Si ya existía (sin importar acentos ni mayúsculas), regresa la que estaba
 * guardada en vez de duplicarla.
 */
export async function guardarColonia(city: string, colony: string): Promise<Colonia> {
  const datos = await llamarBackend<{ colony?: Colonia }>('/magentagroup/colonias', {
    method: 'POST',
    body: { city, colony },
    mensajeError: 'No se pudo guardar la colonia.',
  });
  const guardada = datos.colony;
  return typeof guardada?.colony === 'string' && typeof guardada.city === 'string' ? guardada : { city, colony };
}

/** DELETE /magentagroup (admin). Borra solo el registro: las fotos se quedan en Cloudinary. */
export async function borrarCasa(id: string): Promise<void> {
  await llamarBackend('/magentagroup', {
    method: 'DELETE',
    body: { id },
    mensajeError: 'No se pudo eliminar la casa.',
  });
}
