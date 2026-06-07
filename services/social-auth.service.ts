/**
 * SERVICIO DE AUTENTICACIÓN SOCIAL
 *
 * Google Sign-In y Apple Sign-In via Supabase signInWithIdToken.
 * El flujo nativo obtiene el idToken en el dispositivo y lo pasa
 * a Supabase, que gestiona la sesión desde ahí.
 *
 * Requiere dev build (no funciona en Expo Go):
 *   npx expo run:ios / npx expo run:android
 */

import { Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { GOOGLE_WEB_CLIENT_ID } from '@/constants/config';
import { traducirErrorAuth } from '@/services/auth.service';
import { normalizarNombrePerfil } from '@/services/perfil.service';

// ─── Google ───────────────────────────────────────────────────────────────────

/**
 * Configura el SDK de Google. Llamar una vez al arrancar la app (_layout.tsx).
 */
export function configurarGoogle() {
  GoogleSignin.configure({
    // El Web Client ID es el que Supabase usa para verificar el token.
    // Obténlo en: console.cloud.google.com → Credentials → OAuth 2.0 → Web Client
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ['profile', 'email'],
  });
}

export type SocialAuthError =
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'PLAY_SERVICES_NOT_AVAILABLE'
  | 'UNKNOWN'
  | 'NOT_CONFIGURED';

export interface SocialAuthResult {
  ok: boolean;
  error?: SocialAuthError;
  message?: string;
}

type AuthUserMetadata = {
  full_name?: string;
  name?: string;
};

function normalizarNombre(nombre: string | null | undefined): string | null {
  const limpio = normalizarNombrePerfil(nombre ?? '');
  return limpio ? limpio : null;
}

function nombreDesdeMetadata(metadata: AuthUserMetadata | null | undefined): string | null {
  return normalizarNombre(metadata?.full_name) ?? normalizarNombre(metadata?.name);
}

async function sincronizarNombreSocial(userId: string, nombre: string | null) {
  if (!nombre) return;

  const { data: perfil } = await supabase
    .from('profiles')
    .select('nombre')
    .eq('id', userId)
    .maybeSingle();

  const nombreActual = normalizarNombre((perfil as { nombre?: string | null } | null)?.nombre);
  if (nombreActual && nombreActual !== 'Sin nombre') return;

  await supabase
    .from('profiles')
    .update({ nombre })
    .eq('id', userId);
}

async function restaurarAvatarStorage(userId: string) {
  const { data: archivos } = await supabase.storage
    .from('avatars')
    .list(userId, { limit: 1, search: 'avatar' });

  if (!archivos || archivos.length === 0) return;

  const archivo = archivos[0];
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(`${userId}/${archivo.name}`);

  if (data?.publicUrl) {
    await supabase.auth.updateUser({
      data: { avatar_url: `${data.publicUrl}?v=${Date.now()}` },
    });
  }
}

/**
 * Inicia sesión con Google.
 * 1. Abre el selector de cuenta de Google (nativo).
 * 2. Obtiene el idToken.
 * 3. Pasa el idToken a Supabase para crear/recuperar la sesión.
 */
export async function loginConGoogle(): Promise<SocialAuthResult> {
  if (!GOOGLE_WEB_CLIENT_ID || GOOGLE_WEB_CLIENT_ID.startsWith('REEMPLAZAR')) {
    return { ok: false, error: 'NOT_CONFIGURED', message: 'Google Web Client ID no configurado.' };
  }

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();

    if (!response.data?.idToken) {
      return { ok: false, error: 'UNKNOWN', message: 'No se recibió idToken de Google.' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.data.idToken,
    });

    if (error) {
      return { ok: false, error: 'UNKNOWN', message: traducirErrorAuth(error) };
    }

    // Éxito: AuthProvider detecta el cambio de sesión automáticamente.
    const nombreGoogle =
      normalizarNombre(response.data.user.name) ??
      nombreDesdeMetadata(data.user?.user_metadata as AuthUserMetadata | null | undefined);

    if (data.user?.id) {
      await sincronizarNombreSocial(data.user.id, nombreGoogle);

      // Si el usuario ya tenía avatar propio en Storage, Supabase lo sobreescribe con el de Google.
      // Buscamos si existe un archivo subido por el usuario y lo restauramos en los metadatos.
      await restaurarAvatarStorage(data.user.id);
    }

    return { ok: true };

  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, error: 'CANCELLED' };
    }
    if (error.code === statusCodes.IN_PROGRESS) {
      return { ok: false, error: 'IN_PROGRESS' };
    }
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { ok: false, error: 'PLAY_SERVICES_NOT_AVAILABLE' };
    }
    return { ok: false, error: 'UNKNOWN', message: error.message };
  }
}

// ─── Apple ────────────────────────────────────────────────────────────────────

/**
 * Comprueba si Apple Sign-In está disponible en el dispositivo.
 * Solo disponible en iOS 13+.
 */
export async function appleDisponible(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Inicia sesión con Apple.
 * 1. Abre el sheet nativo de Apple.
 * 2. Obtiene el identityToken.
 * 3. Pasa el token a Supabase.
 *
 * REQUISITO: Tener Apple Developer account y configurado en Supabase.
 * Mientras no esté configurado, el botón se muestra deshabilitado.
 */
export async function loginConApple(): Promise<SocialAuthResult> {
  if (Platform.OS !== 'ios') {
    return { ok: false, error: 'UNKNOWN', message: 'Apple Sign-In solo disponible en iOS.' };
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { ok: false, error: 'UNKNOWN', message: 'No se recibió identityToken de Apple.' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) {
      return { ok: false, error: 'UNKNOWN', message: traducirErrorAuth(error) };
    }

    const nombreApple = normalizarNombre(
      [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
    );

    if (data.user?.id) {
      await sincronizarNombreSocial(data.user.id, nombreApple);
    }

    return { ok: true };

  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, error: 'CANCELLED' };
    }
    return { ok: false, error: 'UNKNOWN', message: error.message };
  }
}
