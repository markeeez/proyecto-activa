/**
 * Traducción ES↔EN: LibreTranslate (instancia configurada + espejos) y respaldo MyMemory.
 * En móvil la instancia pública a menudo falla por rate limit; MyMemory suele responder sin API key.
 */
import { LIBRETRANSLATE_API_KEY, LIBRETRANSLATE_URL } from '@/constants/config';

const UA = 'ActivaNutricion/1.0 (Expo)';

const EXTRA_LIBRE_BASES = [
  'https://translate.argosopentech.com',
  'https://libretranslate.de',
];

async function tryLibreAtBase(
  base: string,
  text: string,
  source: string,
  target: string,
): Promise<string | null> {
  const b = base.replace(/\/$/, '');
  const body: Record<string, string> = {
    q: text.slice(0, 4500),
    source,
    target,
    format: 'text',
  };
  if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;

  const res = await fetch(`${b}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { translatedText?: string; error?: string };
  if (j.error) return null;
  const out = typeof j.translatedText === 'string' ? j.translatedText.trim() : '';
  return out.length > 0 ? out : null;
}

async function myMemoryTranslate(
  text: string,
  source: 'en' | 'es',
  target: 'en' | 'es',
): Promise<string | null> {
  try {
    const q = text.trim().slice(0, 450);
    if (!q) return null;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${source}|${target}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
    };
    if (j.responseStatus != null && j.responseStatus !== 200) return null;
    const t = j.responseData?.translatedText;
    if (typeof t !== 'string' || !t.trim()) return null;
    return t.trim();
  } catch {
    return null;
  }
}

/**
 * Traduce texto entre idiomas (códigos ISO que aceptan LibreTranslate / MyMemory).
 */
export async function libreTranslate(
  text: string,
  source: string,
  target: string,
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (source === target) return trimmed;

  const primary = LIBRETRANSLATE_URL.replace(/\/$/, '');
  const bases = [...new Set([primary, ...EXTRA_LIBRE_BASES])];

  for (const base of bases) {
    try {
      const out = await tryLibreAtBase(base, trimmed, source, target);
      if (out) return out;
    } catch {
      continue;
    }
  }

  const sm = source === 'en' || source === 'es' ? source : null;
  const tm = target === 'en' || target === 'es' ? target : null;
  if (sm && tm) {
    const mm = await myMemoryTranslate(trimmed, sm, tm);
    if (mm) return mm;
  }

  return null;
}
