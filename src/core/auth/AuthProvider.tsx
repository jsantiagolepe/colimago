import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, type SessionUser } from './auth-api';

export type AuthStatus = 'checking' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  /** Aviso para la pantalla de login (por ejemplo, por qué se cerró la sesión). */
  notice: string | null;
  /** Lanza AppError si no se pudo (kind "cancelled" si lo cancelaste). */
  signIn: () => Promise<void>;
  cancelSignIn: () => Promise<void>;
  reopenSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Un módulo detectó que la sesión ya no es válida. */
  expireSession: (mensaje?: string) => void;
}

interface AuthSnapshot {
  status: AuthStatus;
  user: SessionUser | null;
  notice: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AVISO_SESION_TERMINADA = 'Tu sesión terminó. Inicia sesión otra vez.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>({ status: 'checking', user: null, notice: null });

  const markSignedOut = useCallback((notice: string | null) => {
    setSnapshot({ status: 'signedOut', user: null, notice });
  }, []);

  useEffect(() => {
    let vigente = true;
    authApi
      .getSession()
      .then((user) => {
        if (!vigente) return;
        setSnapshot(user ? { status: 'signedIn', user, notice: null } : { status: 'signedOut', user: null, notice: null });
      })
      .catch(() => vigente && markSignedOut(null));

    const dejarDeEscuchar = authApi.onSessionExpired((mensaje) => markSignedOut(mensaje || AVISO_SESION_TERMINADA));
    return () => {
      vigente = false;
      void dejarDeEscuchar.then((dejar) => dejar());
    };
  }, [markSignedOut]);

  const signIn = useCallback(async () => {
    const user = await authApi.signInWithGoogle();
    setSnapshot({ status: 'signedIn', user, notice: null });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.signOut();
    } finally {
      markSignedOut(null);
    }
  }, [markSignedOut]);

  const expireSession = useCallback(
    (mensaje?: string) => {
      // Rust normalmente ya la borró (401 del backend); esto lo asegura.
      void authApi.signOut().catch(() => {});
      markSignedOut(mensaje || AVISO_SESION_TERMINADA);
    },
    [markSignedOut],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...snapshot,
      signIn,
      cancelSignIn: authApi.cancelSignIn,
      reopenSignIn: authApi.reopenSignIn,
      signOut,
      expireSession,
    }),
    [snapshot, signIn, signOut, expireSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return context;
}
