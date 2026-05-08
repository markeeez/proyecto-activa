import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  cargando: boolean;
  cerrarSesion: () => Promise<void>;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  cargando: true,
  cerrarSesion: async () => {},
});

function extraerRecoveryParams(url: string): { accessToken: string | null; refreshToken: string | null; type: string | null } {
  const params = new URLSearchParams();
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const hash = url.split('#')[1] ?? '';

  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  for (const [key, value] of new URLSearchParams(hash)) params.set(key, value);

  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    type: params.get('type'),
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Cargar sesión persistida al arrancar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCargando(false);
    });

    // Escuchar cambios de sesión (login, logout, refresh de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setCargando(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleRecoveryUrl = async (url: string | null) => {
      if (!url || !url.includes('restablecer-contrasena')) return;

      const { accessToken, refreshToken, type } = extraerRecoveryParams(url);
      if (type !== 'recovery' || !accessToken || !refreshToken) {
        router.replace('/(auth)/restablecer-contrasena?error=invalid');
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      router.replace(error ? '/(auth)/restablecer-contrasena?error=invalid' : '/(auth)/restablecer-contrasena');
    };

    void Linking.getInitialURL().then(handleRecoveryUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleRecoveryUrl(url);
    });

    return () => subscription.remove();
  }, []);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        cargando,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}
