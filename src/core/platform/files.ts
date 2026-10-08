import { command } from '../tauri';

/**
 * Abre el diálogo nativo de "Guardar" y escribe el archivo donde elijas.
 * Resuelve `false` si cancelaste.
 */
export function saveTextFile(nombreSugerido: string, contenido: string): Promise<boolean> {
  return command<boolean>('save_text_file', { suggestedName: nombreSugerido, contents: contenido });
}
