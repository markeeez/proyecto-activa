import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import LoadingSplash from '@/components/LoadingSplash';
import { Colors, FontFamily } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

type GoalsState = 'loading' | 'has' | 'none' | 'error';

/**
 * Punto de entrada tras autenticación: comprueba user_goals y redirige a
 * onboarding o a la app principal. Distingue entre "sin objetivos" y "error"
 * para no enviar a onboarding a usuarios existentes con problemas de red.
 */
export default function Index() {
  const { session, cargando } = useAuth();
  const [goals, setGoals] = useState<GoalsState>('loading');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (cargando) return;
    if (!session) {
      setGoals('loading');
      return;
    }

    let cancelado = false;
    setGoals('loading');

    void (async () => {
      const { data, error } = await supabase
        .from('user_goals')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (cancelado) return;
      if (error) {
        setGoals('error');
        return;
      }
      setGoals(data != null ? 'has' : 'none');
    })();

    return () => {
      cancelado = true;
    };
  }, [session, cargando, intento]);

  if (cargando) {
    return <LoadingSplash />;
  }

  if (!session) {
    return <Redirect href="/(auth)/iniciar-sesion" />;
  }

  if (goals === 'loading') {
    return <LoadingSplash />;
  }

  if (goals === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No se pudo cargar tu perfil</Text>
        <Text style={styles.subtitle}>Revisa tu conexión e inténtalo de nuevo.</Text>
        <Pressable style={styles.retry} onPress={() => setIntento((n) => n + 1)}>
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (goals === 'none') {
    return <Redirect href="/(onboarding)/objetivo" />;
  }

  return <Redirect href="/(tabs)/inicio" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
    padding: 24,
    gap: 12,
  },
  title: { color: Colors.dark.textDisplay, fontFamily: FontFamily.sansBold, fontSize: 16, textAlign: 'center' },
  subtitle: { color: Colors.dark.textSecondary, fontFamily: FontFamily.sans, fontSize: 13, textAlign: 'center' },
  retry: {
    marginTop: 8,
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: Colors.dark.background, fontFamily: FontFamily.sansBold, fontSize: 12, letterSpacing: 1.6 },
});
