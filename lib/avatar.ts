import { Image } from 'react-native';

import { supabase } from '@/lib/supabase';
import { extensionDesdeMime, validarAvatar } from '@/lib/avatarValidation';

function medirImagen(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
}

/**
 * Sube un avatar a `avatars/{userId}/avatar.{ext}` y devuelve la URL pública.
 * Valida MIME, dimensiones y tamaño antes de subir.
 */
export async function subirAvatar(userId: string, uri: string, mimeType: string): Promise<string> {
  let dimensiones: { width: number; height: number };
  try {
    dimensiones = await medirImagen(uri);
  } catch {
    throw new Error('No se pudieron leer las dimensiones de la imagen.');
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('No se pudo leer la imagen seleccionada.');
  }
  const buffer = await response.arrayBuffer();

  validarAvatar({
    mime: mimeType,
    width: dimensiones.width,
    height: dimensiones.height,
    bytes: buffer.byteLength,
  });

  const path = `${userId}/avatar.${extensionDesdeMime(mimeType)}`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, { upsert: true, contentType: mimeType });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
