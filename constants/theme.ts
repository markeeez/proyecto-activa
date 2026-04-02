/**
 * ─────────────────────────────────────────────────────────────
 *  ACTIVE SKY × NOTHING DESIGN SYSTEM
 *
 *  Base monocromática Nothing (tipografía, superficies, jerarquía)
 *  + Acento Active Sky celeste (#00B4D8 / #00D4FF).
 *  El celeste reemplaza el rojo de Nothing como color de acción.
 *
 *  Hook principal: import { useTheme } from '@/hooks/useTheme'
 * ─────────────────────────────────────────────────────────────
 */

import { Platform } from 'react-native';

// ─── Paleta base (no usar directamente en componentes) ────────────────────────

const Palette = {
  // Active Sky — único acento de color
  sky:       '#00B4D8',   // Light mode
  skyNeon:   '#00D4FF',   // Dark mode (neon sobre OLED)
  skyBg:     '#E0F7FC',   // Fondo tint sky en light
  skyBgDark: '#003344',   // Fondo tint sky en dark

  // Nothing — Monocromáticos Dark
  black:          '#000000',
  surface:        '#111111',
  surfaceRaised:  '#1A1A1A',
  borderSubtle:   '#222222',
  borderVisible:  '#333333',
  textDisabled:   '#666666',
  textSecondary:  '#999999',
  textPrimary:    '#E8E8E8',
  textDisplay:    '#FFFFFF',

  // Nothing — Monocromáticos Light
  lightBg:            '#F5F5F5',
  lightSurface:       '#FFFFFF',
  lightSurfaceRaised: '#F0F0F0',
  lightBorderSubtle:  '#E8E8E8',
  lightBorderVisible: '#CCCCCC',
  lightTextDisabled:  '#999999',
  lightTextSecondary: '#666666',
  lightTextPrimary:   '#1A1A1A',
  lightTextDisplay:   '#000000',

  // Semáforo (idénticos en ambos modos — son señales, no UI)
  success: '#4A9E5C',   // Nothing --success
  warning: '#D4A843',   // Nothing --warning
  danger:  '#D71921',   // Nothing --accent (error/danger)

  // Macros nutrición
  protein: '#7C3AED',
  carbs:   '#D4A843',   // Reutiliza warning — coherencia Nothing
  fat:     '#D97706',
} as const;

// ─── Temas ────────────────────────────────────────────────────────────────────

export const Colors = {

  light: {
    // Fondos — "printed technical manual"
    background:       Palette.lightBg,
    surface:          Palette.lightSurface,
    surfaceElevated:  Palette.lightSurfaceRaised,

    // Jerarquía de texto Nothing (4 niveles)
    textDisplay:      Palette.lightTextDisplay,      // 100% — Hero, números
    text:             Palette.lightTextPrimary,      // 90%  — Cuerpo principal
    textSecondary:    Palette.lightTextSecondary,    // 60%  — Labels, metadata
    textMuted:        Palette.lightTextDisabled,     // 40%  — Deshabilitado, hints
    textInverse:      Palette.textDisplay,
    textOnPrimary:    Palette.textDisplay,

    // Acento Active Sky (reemplaza rojo Nothing como acción primaria)
    primary:          Palette.sky,
    primaryHover:     '#0096C7',
    primaryBg:        Palette.skyBg,
    primaryText:      Palette.sky,

    // Bordes Nothing
    border:           Palette.lightBorderSubtle,
    borderVisible:    Palette.lightBorderVisible,
    separator:        Palette.lightBorderSubtle,

    // Navegación
    tabBar:           Palette.lightSurface,
    tabIconDefault:   Palette.lightTextDisabled,
    tabIconSelected:  Palette.sky,

    // Semáforo de calorías
    success:          Palette.success,
    successBg:        '#D4F0DA',
    successText:      '#2D6A3F',

    warning:          Palette.warning,
    warningBg:        '#FAF0D4',
    warningText:      '#7A5A1A',

    danger:           Palette.danger,
    dangerBg:         '#FAD4D4',
    dangerText:       '#8B0000',

    // Macros nutrición
    macroCalories:    Palette.sky,
    macroProtein:     Palette.protein,
    macroCarbs:       Palette.carbs,
    macroFat:         Palette.fat,

    // Planes
    planFree:         Palette.lightTextSecondary,
    planPlus:         Palette.sky,
    planPremium:      Palette.protein,

    // Sombras — Nothing no usa sombras, pero se mantiene para compatibilidad
    shadowColor:      '#000000',
    shadowOpacity:    0,  // Flat surfaces, border separation

    // Compat legacy
    tint:             Palette.sky,
    icon:             Palette.lightTextSecondary,
  },

  dark: {
    // Fondos — "instrument panel in a dark room" (OLED black)
    background:       Palette.black,
    surface:          Palette.surface,
    surfaceElevated:  Palette.surfaceRaised,

    // Jerarquía de texto Nothing (4 niveles)
    textDisplay:      Palette.textDisplay,      // 100% — Hero, números
    text:             Palette.textPrimary,      // 90%  — Cuerpo principal
    textSecondary:    Palette.textSecondary,    // 60%  — Labels, metadata
    textMuted:        Palette.textDisabled,     // 40%  — Deshabilitado, hints
    textInverse:      Palette.lightTextDisplay,
    textOnPrimary:    Palette.black,

    // Acento Active Sky (neon sobre OLED)
    primary:          Palette.skyNeon,
    primaryHover:     Palette.sky,
    primaryBg:        Palette.skyBgDark,
    primaryText:      Palette.skyNeon,

    // Bordes Nothing
    border:           Palette.borderSubtle,
    borderVisible:    Palette.borderVisible,
    separator:        Palette.borderSubtle,

    // Navegación
    tabBar:           Palette.surface,
    tabIconDefault:   Palette.textDisabled,
    tabIconSelected:  Palette.skyNeon,

    // Semáforo (mismas señales, fondos oscuros Nothing)
    success:          Palette.success,
    successBg:        '#0D2E18',
    successText:      '#6FCF8A',

    warning:          Palette.warning,
    warningBg:        '#2E2200',
    warningText:      '#E8C46A',

    danger:           Palette.danger,
    dangerBg:         '#2E0000',
    dangerText:       '#F08080',

    // Macros nutrición (ligeramente más brillantes en dark)
    macroCalories:    Palette.skyNeon,
    macroProtein:     '#A78BFA',
    macroCarbs:       '#E8C46A',
    macroFat:         '#FB923C',

    // Planes
    planFree:         Palette.textSecondary,
    planPlus:         Palette.skyNeon,
    planPremium:      '#A78BFA',

    // Sombras — Nothing flat
    shadowColor:      '#000000',
    shadowOpacity:    0,

    // Compat legacy
    tint:             Palette.skyNeon,
    icon:             Palette.textSecondary,
  },

} as const;

export type Theme = typeof Colors.light;
export type ColorKey = keyof Theme;

// ─── Tipografía Nothing ───────────────────────────────────────────────────────

/**
 * Nombres de fuente para usar en fontFamily de StyleSheet.
 * Requiere cargar con useFonts() en _layout.tsx.
 * Instalar: npx expo install @expo-google-fonts/space-grotesk
 *                             @expo-google-fonts/space-mono
 *                             @expo-google-fonts/doto
 */
export const FontFamily = {
  // Display — dot-matrix, solo para hero moments (36px+)
  display:  'Doto_400Regular',

  // Body / UI — jerarquía principal
  sans:       'SpaceGrotesk_400Regular',
  sansLight:  'SpaceGrotesk_300Light',
  sansMedium: 'SpaceGrotesk_500Medium',
  sansBold:   'SpaceGrotesk_700Bold',

  // Data / Labels — números, ALL CAPS labels
  mono:       'SpaceMono_400Regular',
  monoBold:   'SpaceMono_700Bold',
} as const;

/**
 * Escala tipográfica Nothing.
 * Usar con FontFamily para construir estilos completos.
 */
export const TypeScale = {
  displayXl: { fontSize: 72, lineHeight: 72,  letterSpacing: -2.16 }, // Hero números
  displayLg: { fontSize: 48, lineHeight: 50,  letterSpacing: -0.96 }, // Sección hero
  displayMd: { fontSize: 36, lineHeight: 40,  letterSpacing: -0.72 }, // Título página
  heading:   { fontSize: 24, lineHeight: 29,  letterSpacing: -0.24 }, // Sección
  subheading:{ fontSize: 18, lineHeight: 23,  letterSpacing: 0     }, // Subsección
  body:      { fontSize: 16, lineHeight: 24,  letterSpacing: 0     }, // Cuerpo
  bodySm:    { fontSize: 14, lineHeight: 21,  letterSpacing: 0.14  }, // Cuerpo secundario
  caption:   { fontSize: 12, lineHeight: 17,  letterSpacing: 0.48  }, // Timestamps
  label:     { fontSize: 11, lineHeight: 13,  letterSpacing: 0.88  }, // ALL CAPS monospace
} as const;

// Alias cortos para uso frecuente
export const Typography = {
  // Tamaños (legacy compat)
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  28,
  xxxl: 34,

  // Pesos
  light:     '300' as const,
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
} as const;

// ─── Espaciado Nothing (base 8px) ─────────────────────────────────────────────

export const Spacing = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
  '3xl': 64,
  '4xl': 96,
} as const;

// ─── Radios ───────────────────────────────────────────────────────────────────

/**
 * Nothing usa radios contenidos:
 * - Cards: 12–16px
 * - Buttons: pill (9999) o técnico (4–8px)
 * - Nunca > 16px en cards
 */
export const Radius = {
  technical: 4,
  sm:        8,
  md:        12,
  lg:        16,
  pill:      9999,
} as const;

// ─── Fuentes del sistema (fallback) ───────────────────────────────────────────

export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'ui-serif',
    rounded: 'ui-rounded',
    mono:    'ui-monospace',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    rounded: 'normal',
    mono:    'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, monospace",
  },
});
