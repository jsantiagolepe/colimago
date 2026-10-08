// Comandos de autenticación (src-tauri/src/auth). El frontend nunca recibe
// el JWT: solo el nombre y correo de la cuenta.

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { command } from '../tauri';

export interface SessionUser {
  id: string;
  name: string;
  email?: string;
}

export const authApi = {
  getSession: () => command<SessionUser | null>('auth_get_session'),
  /** Abre Google en el navegador y resuelve cuando terminas de iniciar sesión. */
  signInWithGoogle: () => command<SessionUser>('auth_sign_in_google'),
  cancelSignIn: () => command<void>('auth_cancel_sign_in'),
  reopenSignIn: () => command<void>('auth_reopen_sign_in'),
  signOut: () => command<void>('auth_sign_out'),
  /** El backend rechazó la sesión (401): Rust ya la borró. */
  onSessionExpired: (alExpirar: (mensaje?: string) => void): Promise<UnlistenFn> =>
    listen<{ message: string | null }>('auth:session-expired', (evento) => alExpirar(evento.payload.message ?? undefined)),
};
