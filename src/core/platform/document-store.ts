import { useEffect, useSyncExternalStore } from 'react';
import { localData } from './data';

export interface DocumentSnapshot<T> {
  /** `null` mientras carga (o si no se pudo abrir). */
  data: T | null;
  error: string | null;
}

export interface DocumentStore<T> {
  /** Lee el documento una sola vez por sesión; la primera vez que no existe, guarda `initial()`. */
  load(): Promise<void>;
  /** Aplica un cambio (función pura) y lo guarda. No hace nada si aún no carga. */
  update(change: (data: T) => T): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): DocumentSnapshot<T>;
}

const mensaje = (err: unknown) => (err instanceof Error ? ` ${err.message}` : '');

/**
 * Un documento de `localData` en memoria, compartido por todas las
 * pantallas que lo usan (p. ej. el calendario y la tarjeta de pendientes
 * del inicio): todas ven el mismo estado y los guardados van uno detrás
 * de otro, así que nunca se pisan.
 */
export function createDocumentStore<T>(
  name: string,
  initial: () => T,
  /** Convierte lo leído del disco al formato actual (p. ej. de una versión anterior). */
  migrate: (raw: unknown) => T = (raw) => raw as T,
): DocumentStore<T> {
  let snapshot: DocumentSnapshot<T> = { data: null, error: null };
  let carga: Promise<void> | null = null;
  let cola: Promise<void> = Promise.resolve();
  const oyentes = new Set<() => void>();

  function emitir(cambios: Partial<DocumentSnapshot<T>>) {
    snapshot = { ...snapshot, ...cambios };
    oyentes.forEach((oyente) => oyente());
  }

  function guardar(data: T) {
    cola = cola
      .then(() => localData.write(name, data))
      .then(() => {
        if (snapshot.error) emitir({ error: null });
      })
      .catch((err: unknown) => emitir({ error: `No se pudieron guardar tus cambios.${mensaje(err)}` }));
  }

  return {
    load() {
      carga ??= localData.read<T>(name).then(
        (leido) => {
          const data = leido === null ? initial() : migrate(leido);
          emitir({ data, error: null });
          if (leido === null || data !== leido) guardar(data);
        },
        (err: unknown) => {
          carga = null; // que se pueda reintentar
          emitir({ error: `No se pudieron abrir tus datos.${mensaje(err)}` });
        },
      );
      return carga;
    },
    update(change) {
      if (snapshot.data === null) return;
      const siguiente = change(snapshot.data);
      if (siguiente === snapshot.data) return;
      emitir({ data: siguiente });
      guardar(siguiente);
    },
    subscribe(listener) {
      oyentes.add(listener);
      return () => oyentes.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
}

/** Usa un documento en un componente: lo carga y se vuelve a pintar con cada cambio. */
export function useDocument<T>(store: DocumentStore<T>) {
  const { data, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    void store.load();
  }, [store]);
  return { data, error, update: store.update };
}
