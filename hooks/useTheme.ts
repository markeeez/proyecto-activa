/**
 * useTheme — Hook principal Active Sky × Nothing Design System
 *
 * Uso:
 *   const { c, ts, f, s, r, isDark } = useTheme();
 *
 *   c  → colores del tema activo
 *   ts → escala tipográfica Nothing
 *   f  → nombres de fuente (FontFamily)
 *   s  → espaciado
 *   r  → radios de borde
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Colors,
  FontFamily,
  TypeScale,
  Typography,
  Spacing,
  Radius,
} from '@/constants/theme';
import type { Theme } from '@/constants/theme';

interface UseThemeReturn {
  c:      Theme;
  ts:     typeof TypeScale;
  t:      typeof Typography;   // alias legacy
  f:      typeof FontFamily;
  s:      typeof Spacing;
  r:      typeof Radius;
  scheme: 'light' | 'dark';
  isDark: boolean;
}

export function useTheme(): UseThemeReturn {
  const scheme = useColorScheme() ?? 'dark';

  return {
    c:      Colors[scheme],
    ts:     TypeScale,
    t:      Typography,
    f:      FontFamily,
    s:      Spacing,
    r:      Radius,
    scheme,
    isDark: scheme === 'dark',
  };
}
