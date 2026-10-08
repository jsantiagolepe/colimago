// Tipos del panel heredado (dashboard.js, JavaScript sin framework).

export interface OpcionesDashboard {
  /** Atiende las rutas /api/* del panel con la misma forma que antes daba server.js. */
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  usuario: { nombre: string };
  cerrarSesion: () => void;
  /** Regresa a la pantalla de inicio de MyProject (las tarjetas de módulos). */
  volverAlInicio: () => void;
  /** Se llama con el mensaje del backend cuando la sesión ya no es válida. */
  alExpirarSesion: (mensaje?: string) => void;
  /** Abre el diálogo nativo de "Guardar"; resuelve false si se canceló. */
  guardarArchivo: (nombreSugerido: string, contenido: string) => Promise<boolean>;
}

export function montarDashboard(raiz: HTMLElement, opciones: OpcionesDashboard): () => void;
