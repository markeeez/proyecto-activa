import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { session, cargando } = useAuth();

  // Mientras Supabase comprueba la sesión persistida, no redirigimos
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

  // TODO: comprobar si el usuario ha completado el onboarding
  // (ej: user_goals existe → onboarding completo)
  // Por ahora redirige siempre a la app principal
  return <Redirect href="/(tabs)/(nutricion)" />;
}
