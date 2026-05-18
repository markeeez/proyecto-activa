import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const STORAGE_KEY = 'activa:onboarding:first-value-notification-requested';

/**
 * Pide permiso de notificaciones tras el primer "valor" del usuario
 * (primera comida o primer entreno). Sólo se solicita una vez por instalación.
 * Solo se marca como solicitado tras obtener una respuesta del SO, para que un
 * fallo transitorio no impida volver a preguntar más adelante.
 */
export async function solicitarNotificacionesTrasPrimerValor(): Promise<void> {
  try {
    const yaSolicitado = await AsyncStorage.getItem(STORAGE_KEY);
    if (yaSolicitado === '1') return;

    const actual = await Notifications.getPermissionsAsync();
    if (actual.status !== 'undetermined') {
      await AsyncStorage.setItem(STORAGE_KEY, '1');
      return;
    }

    const resultado = await Notifications.requestPermissionsAsync();
    if (resultado.status === 'granted' || resultado.status === 'denied') {
      await AsyncStorage.setItem(STORAGE_KEY, '1');
    }
  } catch (error) {
    if (__DEV__) console.warn('[onboardingNotifications]', error);
  }
}
