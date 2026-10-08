// Los errores no atrapados del frontend también van al log de la app
// (~/Library/Logs/com.juliosantiago.myproject/MyProject.log), para poder
// diagnosticar la app instalada sin abrir el inspector.

import { error as registrarError } from '@tauri-apps/plugin-log';

function describir(valor: unknown): string {
  if (valor instanceof Error) return `${valor.name}: ${valor.message}${valor.stack ? `\n${valor.stack}` : ''}`;
  return String(valor);
}

export function installErrorLogging(): void {
  window.addEventListener('error', (evento) => {
    void registrarError(`[webview] ${describir(evento.error ?? evento.message)}`).catch(() => {});
  });
  window.addEventListener('unhandledrejection', (evento) => {
    void registrarError(`[webview] promesa rechazada: ${describir(evento.reason)}`).catch(() => {});
  });
}
