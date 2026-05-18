import { supabase } from '@/lib/supabase';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIME_ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function extensionDesdeMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  return 'jpg';
}

/**
 * Sube un avatar a `avatars/{userId}/avatar.{ext}` y devuelve la URL pública.
 * Valida MIME y tamaño antes de subir. La extensión se decide por el MIME
 * para que el bucket sirva el Content-Type correcto.
 */
export async function subirAvatar(userId: string, uri: string, mimeType: string): Promise<string> {
  const mime = MIME_ALLOWED.has(mimeType) ? mimeType : 'image/jpeg';

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('No se pudo leer la imagen seleccionada.');
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('La imagen seleccionada está vacía.');
  }
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error('La imagen supera el tamaño máximo de 5 MB.');
  }

  const path = `${userId}/avatar.${extensionDesdeMime(mime)}`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, { upsert: true, contentType: mime });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
