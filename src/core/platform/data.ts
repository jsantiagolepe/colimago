import { command } from '../tauri';

/**
 * Documentos JSON propios de la app (src-tauri/src/storage.rs), uno por
 * nombre: "calendar", "finances"… Viven en Application Support, así que
 * la versión de desarrollo y la instalada ven los mismos datos.
 * Nombres: solo minúsculas, dígitos y guiones.
 */
export const localData = {
  /** `null` si el documento todavía no existe. */
  async read<T>(nombre: string): Promise<T | null> {
    const texto = await command<string | null>('data_read', { name: nombre });
    return texto === null ? null : (JSON.parse(texto) as T);
  },
  write(nombre: string, valor: unknown): Promise<void> {
    return command<void>('data_write', { name: nombre, contents: JSON.stringify(valor) });
  },
};
