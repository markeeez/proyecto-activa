/**
 * Validacion pura para subida de avatares.
 *
 * No depende de react-native ni supabase, por lo que es testable bajo node:test
 * sin necesidad de mocks. La logica de subida real vive en lib/avatar.ts.
 */

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const AVATAR_MIN_DIMENSION = 64;
export const AVATAR_MAX_DIMENSION = 4096;

export const AVATAR_MIME_ALLOWED = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export function extensionDesdeMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  return 'jpg';
}

export function validarAvatar(input: {
  mime: string;
  width: number;
  height: number;
  bytes: number;
}): void {
  if (!AVATAR_MIME_ALLOWED.has(input.mime)) {
    throw new Error('Formato de imagen no soportado. Usa JPG, PNG, WEBP o HEIC.');
  }
  if (
    input.width < AVATAR_MIN_DIMENSION ||
    input.height < AVATAR_MIN_DIMENSION ||
    input.width > AVATAR_MAX_DIMENSION ||
    input.height > AVATAR_MAX_DIMENSION
  ) {
    throw new Error(
      `La imagen debe medir entre ${AVATAR_MIN_DIMENSION}px y ${AVATAR_MAX_DIMENSION}px por lado.`,
    );
  }
  if (input.bytes === 0) {
    throw new Error('La imagen seleccionada está vacía.');
  }
  if (input.bytes > AVATAR_MAX_BYTES) {
    throw new Error('La imagen supera el tamaño máximo de 5 MB.');
  }
}
