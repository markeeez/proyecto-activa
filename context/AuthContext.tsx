import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
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
