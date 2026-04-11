import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

/**
 * Punto de entrada tras autenticación: comprueba user_goals una vez por carga
 * de esta ruta y redirige a onboarding o a la app principal.
 */
export default function Index() {
  const { session, cargando } = useAuth();
  const [tieneGoals, setTieneGoals] = useState<boolean | null>(null);

  useEffect(() => {
    if (cargando) return;

    if (!session) {
      setTieneGoals(null);
      return;
    }

    let cancel = false;
    setTieneGoals(null);

    void (async () => {
      const { data } = await supabase
        .from('user_goals')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!cancel) {
        setTieneGoals(data != null);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [session, cargando]);

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/iniciar-sesion" />;
  }

  if (tieneGoals === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!tieneGoals) {
    return <Redirect href="/(onboarding)/datos" />;
  }

  return <Redirect href="/(tabs)/(nutricion)" />;
}
