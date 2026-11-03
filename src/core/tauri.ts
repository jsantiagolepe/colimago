// Puente con el núcleo nativo (src-tauri/src). Todo lo que necesita red,
// disco o el Llavero pasa por un comando de Rust; aquí solo se llama y se
// normaliza el error que regresa ({ kind, message }, ver error.rs).

import { invoke, type InvokeArgs, type InvokeOptions } from '@tauri-apps/api/core';

export type AppErrorKind = 'notAuthenticated' | 'signIn' | 'cancelled' | 'network' | 'invalidRequest' | 'internal';

export class AppError extends Error {
  readonly kind: AppErrorKind;

  constructor(kind: AppErrorKind, message: string) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
  }
}

function esErrorDeRust(err: unknown): err is { kind: AppErrorKind; message: string } {
  return typeof err === 'object' && err !== null && 'kind' in err && 'message' in err;
}

/**
 * Llama un comando de Rust. `args` es el objeto de argumentos o, para mandar
 * un archivo sin pasarlo por JSON, los bytes crudos (con los datos sueltos en
 * `opciones.headers`).
 */
export async function command<T>(nombre: string, args?: InvokeArgs, opciones?: InvokeOptions): Promise<T> {
  try {
    return await invoke<T>(nombre, args, opciones);
  } catch (err) {
    if (esErrorDeRust(err)) throw new AppError(err.kind, String(err.message));
    throw new AppError('internal', typeof err === 'string' ? err : 'Ocurrió un error inesperado.');
  }
}
