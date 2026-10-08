// Puente con el núcleo nativo (src-tauri/src). Todo lo que necesita red,
// disco o el Llavero pasa por un comando de Rust; aquí solo se llama y se
// normaliza el error que regresa ({ kind, message }, ver error.rs).

import { invoke } from '@tauri-apps/api/core';

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

export async function command<T>(nombre: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(nombre, args);
  } catch (err) {
    if (esErrorDeRust(err)) throw new AppError(err.kind, String(err.message));
    throw new AppError('internal', typeof err === 'string' ? err : 'Ocurrió un error inesperado.');
  }
}
