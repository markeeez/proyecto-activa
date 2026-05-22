import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Fuentes Nothing Design System
// Instalar: npx expo install @expo-google-fonts/space-grotesk @expo-google-fonts/space-mono @expo-google-fonts/doto
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
import {
  Doto_400Regular,
} from '@expo-google-fonts/doto';

import { AuthProvider } from '@/context/AuthContext';
import { EntrenoProvider } from '@/context/EntrenoContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { TimerDescansoProvider } from '@/context/TimerDescansoContext';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { notificacionesService } from '@/services/notificaciones.service';
import { configurarGoogle } from '@/services/social-auth.service';

SplashScreen.preventAutoHideAsync();

// Tras sesión activa, la comprobación user_goals → /(onboarding)/datos vive en app/index.tsx.

// Configurar Google SDK una sola vez al arrancar
configurarGoogle();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();

  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    Doto_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (!user?.id) return;
    void notificacionesService.registrarDispositivo(user.id).catch(() => undefined);
    void notificacionesService.sincronizarRecordatoriosLocales(user.id).catch(() => undefined);
    void notificacionesService.reconciliarNotificacionesPresentadas().catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    const abrirDesdeNotificacion = (response: Notifications.NotificationResponse | null | undefined) => {
      if (response?.notification) {
        void notificacionesService.marcarNotificacionLocalLeida(response.notification).catch(() => undefined);
        const data = response.notification.request.content.data;
        const remoteEventId = typeof data?.notificationEventId === 'string'
          ? data.notificationEventId
          : typeof data?.eventId === 'string'
            ? data.eventId
            : null;
        if (remoteEventId) {
          void notificacionesService.marcarEventoLeido(remoteEventId).then(() => {
            notificacionesService.emitirCambio();
          }).catch(() => undefined);
        }
      }
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        router.push(url as any);
      }
    };

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      void notificacionesService.registrarNotificacionLocal(notification).catch(() => undefined);
      notificacionesService.emitirCambio();
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener(abrirDesdeNotificacion);
    void Notifications.getLastNotificationResponseAsync().then(abrirDesdeNotificacion).catch(() => undefined);
    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <TimerDescansoProvider>
    <EntrenoProvider>
      <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </NavigationThemeProvider>
    </EntrenoProvider>
    </TimerDescansoProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <RootLayoutNav />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
