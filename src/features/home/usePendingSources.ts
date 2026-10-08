import { useEffect, useReducer } from 'react';
import { modules } from '../../modules/registry';
import type { AppModule, PendingSource } from '../../modules/types';

const fuentes = modules.filter((m): m is AppModule & { pending: PendingSource } => !!m.pending);

/**
 * Los módulos con pendientes (Calendar, Tareas…), ya cargándose, y la
 * pantalla se vuelve a pintar cada vez que cambia alguno.
 */
export function usePendingSources() {
  const [, repintar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const quitar = fuentes.map((m) => m.pending.subscribe(repintar));
    fuentes.forEach((m) => m.pending.load());
    return () => quitar.forEach((q) => q());
  }, []);
  return fuentes;
}
