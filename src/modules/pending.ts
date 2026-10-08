import type { DocumentStore } from '../core/platform/document-store';
import type { DayProgress, PendingItem, PendingSource } from './types';

/** Arma la fuente de pendientes de un módulo a partir de su documento. */
export function pendingFromStore<T>(
  store: DocumentStore<T>,
  fns: {
    items: (data: T, today: string) => PendingItem[];
    setDone: (data: T, itemId: string, done: boolean, today: string) => T;
    progress: (data: T, day: string) => DayProgress;
  },
): PendingSource {
  return {
    subscribe: store.subscribe,
    load: () => void store.load(),
    items(today) {
      const data = store.getSnapshot().data;
      return data === null ? null : fns.items(data, today);
    },
    setDone: (itemId, done, today) => store.update((data) => fns.setDone(data, itemId, done, today)),
    progress(day) {
      const data = store.getSnapshot().data;
      return data === null ? null : fns.progress(data, day);
    },
  };
}
