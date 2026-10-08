import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocumentStore } from './document-store';

const disco = vi.hoisted(() => ({
  archivos: new Map<string, string>(),
  escrituras: [] as string[],
}));

vi.mock('./data', () => ({
  localData: {
    read: vi.fn(async (nombre: string) => {
      const texto = disco.archivos.get(nombre);
      return texto === undefined ? null : JSON.parse(texto);
    }),
    write: vi.fn(async (nombre: string, valor: unknown) => {
      await new Promise((r) => setTimeout(r, 1)); // que dos guardados se puedan cruzar
      disco.archivos.set(nombre, JSON.stringify(valor));
      disco.escrituras.push(JSON.stringify(valor));
    }),
  },
}));

const esperar = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  disco.archivos.clear();
  disco.escrituras.length = 0;
});

describe('documentos locales', () => {
  it('la primera vez guarda los datos iniciales, una sola vez', async () => {
    const inicial = vi.fn(() => ({ n: 1 }));
    const store = createDocumentStore('prueba', inicial);
    await Promise.all([store.load(), store.load()]);
    await esperar();
    expect(inicial).toHaveBeenCalledOnce();
    expect(store.getSnapshot().data).toEqual({ n: 1 });
    expect(disco.archivos.get('prueba')).toBe('{"n":1}');
  });

  it('si ya existe, no lo reemplaza', async () => {
    disco.archivos.set('prueba', '{"n":7}');
    const store = createDocumentStore('prueba', () => ({ n: 1 }));
    await store.load();
    expect(store.getSnapshot().data).toEqual({ n: 7 });
    expect(disco.escrituras).toEqual([]);
  });

  it('los cambios seguidos se guardan en orden y el último gana', async () => {
    const store = createDocumentStore('prueba', () => ({ n: 0 }));
    await store.load();
    const oyente = vi.fn();
    store.subscribe(oyente);
    store.update((d) => ({ n: d.n + 1 }));
    store.update((d) => ({ n: d.n + 1 }));
    store.update((d) => d); // sin cambio: ni aviso ni guardado
    await esperar();
    expect(oyente).toHaveBeenCalledTimes(2);
    expect(disco.escrituras).toEqual(['{"n":0}', '{"n":1}', '{"n":2}']);
    expect(disco.archivos.get('prueba')).toBe('{"n":2}');
  });

  it('antes de cargar, update no hace nada', () => {
    const store = createDocumentStore('prueba', () => ({ n: 0 }));
    store.update(() => ({ n: 5 }));
    expect(store.getSnapshot().data).toBeNull();
  });
});
