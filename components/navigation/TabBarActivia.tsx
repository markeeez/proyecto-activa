/**
 * Tab bar inferior — solo presentación (react-native-svg).
 *
 * Diseño: Inicio | Alimentación | [FAB IA centrado] | Entreno | Más
 * El FAB sobresale por encima de la barra y navega a (ia).
 */

import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useCallback, useState } from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Path, Svg } from 'react-native-svg';

import LogoSbBlack from '@/assets/images/logo_sb_black.svg';
import ProfileNavIcon from '@/assets/images/profile_nav_icon.svg';
import ProgressNavIcon from '@/assets/images/progress_nav_icon.svg';
import { useTheme } from '@/hooks/useTheme';

/* ── Colores ──────────────────────────────────────────────────────── */
const INACTIVE_GRAY = '#8E8E93';
const BAR_DARK      = '#1C1C1E';
const BAR_LIGHT     = '#FFFFFF';
const BORDER_DARK   = 'rgba(255,255,255,0.12)';
const BORDER_LIGHT  = 'rgba(0,0,0,0.10)';

/* ── Métricas ─────────────────────────────────────────────────────── */
const TAB_ROW_H  = 49;
const FAB_SIZE   = 56;
const FAB_RADIUS = FAB_SIZE / 2;
const ICON_SIZE  = 24;
const LABEL_SIZE = 10.5;

/**
 * Rutas que no deben aparecer en la barra visible.
 * expo-router pasa igualmente todas las rutas al custom tab bar,
 * independientemente de href: null, así que las filtramos aquí.
 */
const HIDDEN_ROUTES = new Set(['(progreso)', 'index']);

/** Path de relleno: rectángulo plano. */
function fillPath(w: number, h: number): string {
  return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
}

/** Borde superior recto. */
function borderPath(w: number): string {
  return `M 0 0 L ${w} 0`;
}

function resolveTabLabel(
  options: BottomTabBarProps['descriptors'][string]['options'],
  routeName: string,
): string {
  const { tabBarLabel, title } = options;
  if (typeof tabBarLabel === 'string') return tabBarLabel;
  if (title != null && String(title).length > 0) return String(title);
  return routeName;
}

export function TabBarActivia({
  state,
  descriptors,
  navigation,
  insets: tabInsets,
}: BottomTabBarProps) {
  const safe        = useSafeAreaInsets();
  const { c, isDark } = useTheme();
  const bottomInset = tabInsets?.bottom ?? safe.bottom;

  const barBg     = isDark ? BAR_DARK    : BAR_LIGHT;
  const borderClr = isDark ? BORDER_DARK : BORDER_LIGHT;
  const totalH    = TAB_ROW_H + bottomInset;

  const [barW, setBarW] = useState(0);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) setBarW(prev => Math.abs(prev - width) > 0.5 ? width : prev);
  }, []);

  const navigateToRoute = useCallback((routeName: string) => {
    const targetRoute = state.routes.find(r => r.name === routeName);
    if (!targetRoute) return;

    const event = navigation.emit({
      type: 'tabPress',
      target: targetRoute.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(targetRoute.name, targetRoute.params);
    }
  }, [state.routes, navigation]);

  const onFabPress = useCallback(() => {
    setMoreExpanded(false);
    navigateToRoute('(ia)');
  }, [navigateToRoute]);

  const toggleMoreExpanded = useCallback(() => {
    setMoreExpanded(prev => !prev);
  }, []);

  const onMoreOptionPress = useCallback((routeName: string) => {
    setMoreExpanded(false);
    navigateToRoute(routeName);
  }, [navigateToRoute]);

  // El FAB sobresale por encima del borde superior de la barra.
  const fabBottom = bottomInset + TAB_ROW_H - FAB_RADIUS - 12;

  return (
    <View
      style={[styles.root, { height: totalH }]}
      onLayout={onLayout}
      pointerEvents="box-none"
    >
      {/* ── Capa 1: fondo SVG ─────────────────────────────────────── */}
      {barW === 0
        ? <View style={[StyleSheet.absoluteFill, { backgroundColor: barBg }]} pointerEvents="none" />
        : (
          <Svg
            width={barW}
            height={totalH}
            style={styles.svgBg}
            pointerEvents="none"
          >
            <Path d={fillPath(barW, totalH)} fill={barBg} />
            <Path
              d={borderPath(barW)}
              fill="none"
              stroke={borderClr}
              strokeWidth={0.5}
            />
          </Svg>
        )
      }

      {/* ── Capa 2: fila de tabs ──────────────────────────────────── */}
      <View style={styles.tabRow} pointerEvents="box-none">
        {state.routes.map((route, index) => {
          // Ocultar rutas excluidas del tab bar (ej: progreso)
          if (HIDDEN_ROUTES.has(route.name)) return null;

          const { options } = descriptors[route.key];
          const focused     = state.index === index;
          const color       = focused ? c.primary : INACTIVE_GRAY;
          const tabColor    = route.name === '(perfil)' && moreExpanded ? c.primary : color;

          // Espacio vacío bajo el FAB: la ruta (ia) no se renderiza como botón
          if (route.name === '(ia)') {
            return <View key={route.key} style={styles.tabCenter} pointerEvents="none" />;
          }

          const onPress = () => {
            if (route.name === '(perfil)') {
              toggleMoreExpanded();
              return;
            }

            setMoreExpanded(false);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const label = resolveTabLabel(options, route.name);

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            >
              <View style={styles.tabInner}>
                {options.tabBarIcon != null
                  ? options.tabBarIcon({ focused: route.name === '(perfil)' ? moreExpanded : focused, color: tabColor, size: ICON_SIZE })
                  : <Ionicons name="ellipse-outline" size={ICON_SIZE} color={tabColor} />}
                <Text numberOfLines={1} style={[styles.label, { color: tabColor, marginTop: 2 }]}>
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {moreExpanded ? (
        <View
          pointerEvents="box-none"
          style={[styles.moreExpandedWrap, { bottom: totalH + 8 }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir a progreso"
            onPress={() => onMoreOptionPress('(progreso)')}
            style={({ pressed }) => [
              styles.moreExpandedAction,
              {
                backgroundColor: c.surface,
                borderColor: c.borderVisible,
              },
              pressed && styles.moreExpandedActionPressed,
            ]}
          >
            <ProgressNavIcon width={18} height={18} color={c.primary} />
            <Text style={[styles.moreExpandedLabel, { color: c.textDisplay }]}>Progreso</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir a perfil"
            onPress={() => onMoreOptionPress('(perfil)')}
            style={({ pressed }) => [
              styles.moreExpandedAction,
              {
                backgroundColor: c.surface,
                borderColor: c.borderVisible,
              },
              pressed && styles.moreExpandedActionPressed,
            ]}
          >
            <ProfileNavIcon width={18} height={18} color={c.primary} />
            <Text style={[styles.moreExpandedLabel, { color: c.textDisplay }]}>Perfil</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Capa 3: FAB IA ────────────────────────────────────────── */}
      {/*
        IMPORTANTE: el contenedor (fabWrap) es un View con pointerEvents="box-none",
        NO un Pressable. Así no intercepta los taps de los tabs que quedan debajo.
        Solo el círculo interior es Pressable.
      */}
      <View
        style={[styles.fabWrap, { bottom: fabBottom }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={onFabPress}
          accessibilityRole="button"
          accessibilityLabel="Abrir asistente IA"
        >
          <View style={[styles.fab, { backgroundColor: c.primary, ...Platform.select({
              ios: { shadowColor: c.primary },
              default: {},
            }) }]}>
            <LogoSbBlack width={26} height={26} />
          </View>
        </Pressable>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'visible',
  },

  svgBg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },

  tabRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: TAB_ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_ROW_H,
  },
  tabCenter: {
    flex: 1,
    height: TAB_ROW_H,
  },
  tabPressed: {
    opacity: 0.85,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: LABEL_SIZE,
    fontWeight: '400',
    letterSpacing: 0,
  },

  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    height: FAB_SIZE,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },

  moreExpandedWrap: {
    position: 'absolute',
    right: 8,
    gap: 8,
    alignItems: 'flex-end',
  },
  moreExpandedAction: {
    minWidth: 126,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  moreExpandedActionPressed: {
    opacity: 0.72,
  },
  moreExpandedLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
});
