import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, Swipeable } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { BuscadorAlimentos } from '@/components/nutricion/BuscadorAlimentos';
import { CalendarioNutricion } from '@/components/nutricion/CalendarioNutricion';
import { MealShareModal } from '@/components/nutricion/MealShareModal';
import { SortableMealList } from '@/components/SortableMealList';
import { GlowButton } from '@/components/ui/GlowButton';

import LogoDark from '@/assets/images/logo_sb.svg';
import LogoLight from '@/assets/images/logo_light_sb.svg';
import { COMIDAS_PREDETERMINADAS } from '@/constants/comidasPredeterminadas';
import { useComidaPortapapeles } from '@/context/ComidaPortapapelesContext';
import { useAuth } from '@/hooks/useAuth';
import { useNutricion } from '@/hooks/useNutricion';
import { useTheme } from '@/hooks/useTheme';
import {
  agregarDiasIso,
  esDiaPasadoVsHoy,
  formatRangoSemanaCortoES,
  getSemanaMovil,
} from '@/lib/fechaNutricion';
import { iconoComida } from '@/lib/iconosComida';
import { emitNutricionLogActualizado } from '@/lib/nutricionEvents';
import { calcularEstadoDia } from '@/lib/nutricionEstadoDia';
import { guardarOrdenComidas, obtenerOrdenComidas } from '@/lib/nutricionLogPreferencias';
import { alimentosService } from '@/services/alimentos.service';
import { nutricionService } from '@/services/nutricion.service';
import type { ComidaConAlimentos, UltimaComidaAnteriorNutricion } from '@/types/app.types';
import type { Food } from '@/types/database.types';

const SKELETON_FADE_MS = 200;
const MACRO_CARBS_COLOR = '#16C862';

type NutricionStyles = ReturnType<typeof makeStyles>;
type SkeletonPalette = {
  surface: string;
  surfaceAlt: string;
  block: string;
  shimmer: string;
};
type SugerenciaComidaAnterior =
  | { estado: 'cargando' }
  | { estado: 'sinDatos' }
  | { estado: 'disponible'; data: UltimaComidaAnteriorNutricion };

function pct(actual: number, objetivo: number): number {
  if (!Number.isFinite(actual) || !Number.isFinite(objetivo) || objetivo <= 0) return 0;
  return Math.max(0, Math.min(actual / objetivo, 1));
}

function textoCompartirComida(comida: ComidaConAlimentos): string {
  const macros = `${Math.round(comida.totalCalorias)} kcal | ${Math.round(comida.totalProteinas)}P ${Math.round(comida.totalCarbos)}C ${Math.round(comida.totalGrasas)}G`;
  const alimentos = comida.items
    .map((item) => {
      const nombre = item.food?.nombre ?? 'Alimento';
      return `- ${nombre}: ${Math.round(item.gramos)} g, ${Math.round(item.calorias_calculadas)} kcal`;
    })
    .join('\n');

  return alimentos.length > 0
    ? `${comida.nombre}\n${macros}\n${alimentos}`
    : `${comida.nombre}\n${macros}`;
}

function KcalRing({
  actual,
  objetivo,
  color,
  trackColor,
  styles,
}: {
  actual: number;
  objetivo: number;
  color: string;
  trackColor: string;
  styles: NutricionStyles;
}) {
  const size = 94;
  const center = size / 2;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const arcRatio = 0.78;
  const arc = circumference * arcRatio;
  const startAngle = 90 + ((1 - arcRatio) * 360) / 2;
  const progress = pct(actual, objetivo);

  return (
    <View style={styles.goalKcalRing}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          transform={`rotate(${startAngle} ${center} ${center})`}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          strokeDashoffset={arc * (1 - progress)}
          transform={`rotate(${startAngle} ${center} ${center})`}
        />
      </Svg>
      <View style={styles.goalKcalCenter}>
        <Text style={styles.goalKcalValue} numberOfLines={1} adjustsFontSizeToFit>
          {Math.round(actual)}
        </Text>
        <Text style={styles.goalKcalUnit}>kcal</Text>
      </View>
    </View>
  );
}

interface SkeletonProps {
  styles: NutricionStyles;
  shimmerOpacity: Animated.Value;
  colors: SkeletonPalette;
}

const stylesStatic = StyleSheet.create({
  skeletonBlock: {
    overflow: 'hidden',
  },
});

function SkeletonBlock({
  style,
  shimmerOpacity,
  colors,
}: {
  style?: StyleProp<ViewStyle>;
  shimmerOpacity: Animated.Value;
  colors: SkeletonPalette;
}) {
  return (
    <View style={[stylesStatic.skeletonBlock, { backgroundColor: colors.block }, style]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: colors.shimmer, opacity: shimmerOpacity },
        ]}
      />
    </View>
  );
}

function MealCardsSkeleton({ styles, shimmerOpacity, colors }: SkeletonProps) {
  return (
    <View style={styles.skeletonMealsList}>
      {COMIDAS_PREDETERMINADAS.map((meal) => (
        <View
          key={`meal-skeleton-${meal.slot}`}
          style={[styles.mealCard, styles.skeletonSurface, { backgroundColor: colors.surface, borderColor: colors.surfaceAlt }]}
        >
          <View style={styles.mealHeaderRow}>
            <SkeletonBlock style={styles.skeletonMealIcon} shimmerOpacity={shimmerOpacity} colors={colors} />

            <View style={styles.mealHeaderText}>
              <SkeletonBlock style={styles.skeletonMealTitle} shimmerOpacity={shimmerOpacity} colors={colors} />
              <View style={styles.mealMetaRow}>
                <SkeletonBlock style={styles.skeletonMealKcal} shimmerOpacity={shimmerOpacity} colors={colors} />
                <View style={styles.mealMetaDivider} />
                <SkeletonBlock style={styles.skeletonMealMacro} shimmerOpacity={shimmerOpacity} colors={colors} />
                <View style={styles.mealMetaDivider} />
                <SkeletonBlock style={styles.skeletonMealMacro} shimmerOpacity={shimmerOpacity} colors={colors} />
                <View style={styles.mealMetaDivider} />
                <SkeletonBlock style={styles.skeletonMealMacro} shimmerOpacity={shimmerOpacity} colors={colors} />
              </View>
            </View>

            <SkeletonBlock style={styles.skeletonAddBtn} shimmerOpacity={shimmerOpacity} colors={colors} />
          </View>

          <View
            style={[
              styles.mealItemsList,
              styles.skeletonMealItemsList,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.surfaceAlt },
            ]}
          >
            <View style={styles.foodRow}>
              <SkeletonBlock style={styles.skeletonFoodName} shimmerOpacity={shimmerOpacity} colors={colors} />
              <View style={styles.foodMetaRow}>
                <SkeletonBlock style={styles.skeletonFoodGrams} shimmerOpacity={shimmerOpacity} colors={colors} />
                <View style={styles.foodMetrics}>
                  <SkeletonBlock style={styles.skeletonFoodMetric} shimmerOpacity={shimmerOpacity} colors={colors} />
                  <SkeletonBlock style={styles.skeletonFoodMetric} shimmerOpacity={shimmerOpacity} colors={colors} />
                  <SkeletonBlock style={styles.skeletonFoodMetric} shimmerOpacity={shimmerOpacity} colors={colors} />
                  <SkeletonBlock style={styles.skeletonFoodKcal} shimmerOpacity={shimmerOpacity} colors={colors} />
                </View>
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function ordenarComidas(comidas: ComidaConAlimentos[], ordenIds: string[] | null): ComidaConAlimentos[] {
  if (!ordenIds?.length) {
    return [...comidas].sort((a, b) => a.orden - b.orden);
  }
  const map = new Map(comidas.map((c) => [c.mealId, c]));
  const seen = new Set<string>();
  const out: ComidaConAlimentos[] = [];
  for (const id of ordenIds) {
    const c = map.get(id);
    if (c) {
      out.push(c);
      seen.add(id);
    }
  }
  for (const c of comidas) {
    if (!seen.has(c.mealId)) out.push(c);
  }
  return out;
}

export default function NutricionIndex() {
  const { c, f, ts, s, r, isDark } = useTheme();
  const MealAiLogo = isDark ? LogoDark : LogoLight;
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const {
    fecha,
    cambiarFecha,
    resumen,
    objetivos,
    cargando,
    eliminarComidaDelLog,
    crearComidaPersonalizada,
    eliminarAlimento,
    reemplazarAlimento,
    vaciarComida,
    pegarAlimentosEnComida,
    obtenerUltimaComidaAnterior,
    copiarComidaAnteriorEnComida,
  } = useNutricion();
  const {
    lineas: lineasCopiadas,
    copiarDesdeComida,
    limpiarPortapapeles,
    tieneCopia,
  } = useComidaPortapapeles();

  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);
  const skeletonColors = useMemo<SkeletonPalette>(
    () => ({
      surface: isDark ? c.surfaceElevated : c.surface,
      surfaceAlt: isDark ? c.surface : c.surfaceElevated,
      block: isDark ? c.borderVisible : c.border,
      shimmer: isDark ? c.separator : c.borderVisible,
    }),
    [c, isDark],
  );

  const [ordenIds, setOrdenIds] = useState<string[] | null>(null);
  // dragOverride: orden optimista durante/después de un drag. Se limpia cuando llegan datos frescos.
  const [dragOverride, setDragOverride] = useState<ComidaConAlimentos[] | null>(null);
  const [modalNuevaComida, setModalNuevaComida] = useState(false);
  const [nombreNuevaComida, setNombreNuevaComida] = useState('');
  const [calendarioVisible, setCalendarioVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [menuComida, setMenuComida] = useState<ComidaConAlimentos | null>(null);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });
  const [comidaCompartir, setComidaCompartir] = useState<ComidaConAlimentos | null>(null);
  const [mealIdBuscador, setMealIdBuscador] = useState<string | null>(null);
  const [itemAReemplazar, setItemAReemplazar] = useState<
    | { id: string; meal_id: string; food: Food; gramos: number }
    | null
  >(null);
  const [sugerenciasComidaAnterior, setSugerenciasComidaAnterior] = useState<Record<string, SugerenciaComidaAnterior>>({});
  const [sugerenciasDescartadas, setSugerenciasDescartadas] = useState<Set<string>>(() => new Set());
  const [copiandoComidaAnteriorId, setCopiandoComidaAnteriorId] = useState<string | null>(null);
  const fechaActualNutricionRef = useRef(fecha);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void obtenerOrdenComidas(user.id, fecha).then(setOrdenIds);
  }, [user?.id, fecha]);

  useEffect(() => {
    fechaActualNutricionRef.current = fecha;
    setSugerenciasComidaAnterior({});
    setSugerenciasDescartadas(new Set());
    setCopiandoComidaAnteriorId(null);
  }, [fecha]);

  /** Quitar del orden guardado los meal_id que ya no existen en el log. */
  useEffect(() => {
    if (!user?.id || !resumen?.comidas) return;
    setOrdenIds((prev) => {
      if (prev == null) return prev;
      const present = new Set(resumen.comidas.map((x) => x.mealId));
      const next = prev.filter((id) => present.has(id));
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      void guardarOrdenComidas(user.id, fecha, next);
      return next;
    });
  }, [resumen?.comidas, user?.id, fecha]);

  const listaOrdenada = useMemo(
    () => ordenarComidas(resumen?.comidas ?? [], ordenIds),
    [resumen?.comidas, ordenIds],
  );

  // comidasData: usa el override del drag si existe, si no la lista ordenada del servidor.
  // Esto evita el render extra que causaba que los macros aparecieran antes que las comidas.
  const comidasData = dragOverride ?? listaOrdenada;

  // Limpiar el override cuando llegan datos frescos del servidor.
  useEffect(() => {
    setDragOverride(null);
  }, [resumen]);

  // true mientras se cargan datos de un día nuevo (resumen aún no corresponde a `fecha`)
  const cargandoDia = cargando && !resumen;

  useEffect(() => {
    if (!user?.id || cargandoDia) return;

    const comidasPendientes = comidasData.filter(
      (meal) =>
        meal.items.length === 0 &&
        !sugerenciasDescartadas.has(meal.mealId) &&
        !sugerenciasComidaAnterior[meal.mealId],
    );
    if (!comidasPendientes.length) return;

    setSugerenciasComidaAnterior((prev) => {
      const next = { ...prev };
      for (const meal of comidasPendientes) {
        next[meal.mealId] = { estado: 'cargando' };
      }
      return next;
    });

    const fechaCarga = fecha;
    for (const meal of comidasPendientes) {
      void obtenerUltimaComidaAnterior(meal.nombre)
        .then((data) => {
          if (fechaActualNutricionRef.current !== fechaCarga) return;
          setSugerenciasComidaAnterior((prev) => ({
            ...prev,
            [meal.mealId]: data?.lineas.length
              ? { estado: 'disponible', data }
              : { estado: 'sinDatos' },
          }));
        })
        .catch((e) => {
          if (fechaActualNutricionRef.current !== fechaCarga) return;
          console.error('[Nutricion] sugerencia comida anterior', e);
          setSugerenciasComidaAnterior((prev) => ({
            ...prev,
            [meal.mealId]: { estado: 'sinDatos' },
          }));
        });
    }
  }, [
    cargandoDia,
    comidasData,
    fecha,
    obtenerUltimaComidaAnterior,
    sugerenciasComidaAnterior,
    sugerenciasDescartadas,
    user?.id,
  ]);

  const semana = useMemo(() => getSemanaMovil(fecha), [fecha]);
  const rangoSemanaLabel = useMemo(() => formatRangoSemanaCortoES(semana), [semana]);
  const skeletonFadeOpacity = useRef(new Animated.Value(cargandoDia ? 1 : 0)).current;
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;
  const contentOpacity = useRef(new Animated.Value(cargandoDia ? 0 : 1)).current;
  const [skeletonVisible, setSkeletonVisible] = useState(cargandoDia);

  const kcalActual = Math.round(resumen?.totalCalorias ?? 0);
  const kcalObjetivo = Math.round(objetivos?.calorias_objetivo ?? 0);
  const estadoKcal = calcularEstadoDia(kcalActual, kcalObjetivo);
  const colorKcalRing =
    estadoKcal === 'dentro' ? c.success
    : estadoKcal === 'cerca' ? c.warning
    : estadoKcal === 'sobre' ? c.danger
    : c.primary;
  const goalMacros = useMemo(
    () => [
      {
        key: 'proteinas',
        label: 'Proteínas',
        actual: Math.round(resumen?.totalProteinas ?? 0),
        objetivo: Math.round(objetivos?.proteinas_objetivo ?? 0),
        color: c.primary,
      },
      {
        key: 'carbos',
        label: 'Carbohidratos',
        actual: Math.round(resumen?.totalCarbos ?? 0),
        objetivo: Math.round(objetivos?.carbos_objetivo ?? 0),
        color: MACRO_CARBS_COLOR,
      },
      {
        key: 'grasas',
        label: 'Grasas',
        actual: Math.round(resumen?.totalGrasas ?? 0),
        objetivo: Math.round(objetivos?.grasas_objetivo ?? 0),
        color: c.macroFat,
      },
    ],
    [
      c.macroFat,
      c.primary,
      objetivos?.carbos_objetivo,
      objetivos?.grasas_objetivo,
      objetivos?.proteinas_objetivo,
      resumen?.totalCarbos,
      resumen?.totalGrasas,
      resumen?.totalProteinas,
    ],
  );

  const renderGoalCard = useCallback(
    () => (
      <View style={styles.goalCard}>
        <KcalRing
          actual={kcalActual}
          objetivo={kcalObjetivo}
          color={colorKcalRing}
          trackColor={c.primaryBg}
          styles={styles}
        />

        <View style={styles.goalMain}>
          <View style={styles.goalBadge}>
            <Text style={styles.goalBadgeText}>OBJETIVO DIARIO</Text>
          </View>

          <View style={styles.goalMacrosRow}>
            {goalMacros.map((macro) => {
              const progress = pct(macro.actual, macro.objetivo);
              return (
                <View key={macro.key} style={styles.goalMacro}>
                  <View style={[styles.goalMacroIcon, { backgroundColor: macro.color }]}>
                    {macro.key === 'proteinas' ? (
                      <MaterialCommunityIcons
                        name="food-drumstick-outline"
                        size={17}
                        color="#FFFFFF"
                      />
                    ) : macro.key === 'carbos' ? (
                      <MaterialCommunityIcons name="barley" size={17} color="#FFFFFF" />
                    ) : (
                      <Ionicons name="water-outline" size={17} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={styles.goalMacroBody}>
                    <Text style={styles.goalMacroLabel} numberOfLines={1}>
                      {macro.label}
                    </Text>
                    <Text style={styles.goalMacroValue} numberOfLines={1} adjustsFontSizeToFit>
                      <Text style={{ color: macro.color }}>{macro.actual}</Text>
                      <Text style={styles.goalMacroTarget}> / {macro.objetivo} g</Text>
                    </Text>
                    <View style={styles.goalMacroTrack}>
                      <View style={[styles.goalMacroFill, { width: `${progress * 100}%`, backgroundColor: macro.color }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    ),
    [c.primaryBg, colorKcalRing, goalMacros, kcalActual, kcalObjetivo, styles],
  );

  const avanzarDia = useCallback(() => {
    cambiarFecha(agregarDiasIso(fecha, 1));
  }, [fecha, cambiarFecha]);

  const retrocederDia = useCallback(() => {
    cambiarFecha(agregarDiasIso(fecha, -1));
  }, [fecha, cambiarFecha]);

  const abrirCalendario = useCallback(() => {
    setCalendarioVisible(true);
  }, []);

  const cerrarCalendario = useCallback(() => {
    setCalendarioVisible(false);
  }, []);

  const seleccionarDiaCalendario = useCallback(
    (fechaIso: string) => {
      cambiarFecha(fechaIso);
      setCalendarioVisible(false);
    },
    [cambiarFecha],
  );

  const swipeCalendario = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
          'worklet';
          if (e.translationX < -48) {
            runOnJS(avanzarDia)();
          } else if (e.translationX > 48) {
            runOnJS(retrocederDia)();
          }
        }),
    [avanzarDia, retrocederDia],
  );

  const onDragEnd = useCallback(
    ({ data }: { data: ComidaConAlimentos[] }) => {
      setDragOverride(data);
      const ids = data.map((c) => c.mealId);
      setOrdenIds(ids);
      if (user?.id) void guardarOrdenComidas(user.id, fecha, ids);

      // Timeout de seguridad: si el servidor no responde en 10s, limpiar el override
      // para que el estado visual vuelva a sincronizarse con lo que haya en servidor.
      const safetyTimer = setTimeout(() => setDragOverride(null), 10_000);

      const lid = resumen?.logId;
      if (lid) {
        nutricionService
          .actualizarOrdenComidas(lid, ids)
          .then(() => clearTimeout(safetyTimer))
          .catch(() => {
            clearTimeout(safetyTimer);
            setDragOverride(null);
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              console.warn('[nutricion] actualizarOrdenComidas falló — orden revertido');
            }
          });
      } else {
        clearTimeout(safetyTimer);
      }
    },
    [user?.id, fecha, resumen?.logId],
  );

  const confirmarNuevaComida = useCallback(async () => {
    if (!nombreNuevaComida.trim()) return;
    try {
      const nuevoMealId = await crearComidaPersonalizada(nombreNuevaComida.trim());
      setModalNuevaComida(false);
      setNombreNuevaComida('');
      if (nuevoMealId && esDiaPasadoVsHoy(fecha)) {
        setMealIdBuscador(nuevoMealId);
      }
    } catch {
      /* silencioso; podría mostrarse toast */
    }
  }, [nombreNuevaComida, crearComidaPersonalizada, fecha]);

  const abrirRegistrarComida = useCallback(
    (mealId: string) => {
      setSugerenciasDescartadas((prev) => {
        const next = new Set(prev);
        next.add(mealId);
        return next;
      });
      setMealIdBuscador(mealId);
    },
    [],
  );

  const descartarSugerenciaComidaAnterior = useCallback((mealId: string) => {
    setSugerenciasDescartadas((prev) => {
      const next = new Set(prev);
      next.add(mealId);
      return next;
    });
  }, []);

  const confirmarCopiarComidaAnterior = useCallback(
    async (meal: ComidaConAlimentos) => {
      if (copiandoComidaAnteriorId) return;
      setCopiandoComidaAnteriorId(meal.mealId);
      try {
        const copiada = await copiarComidaAnteriorEnComida(meal.mealId, meal.nombre);
        if (copiada) {
          setSugerenciasComidaAnterior((prev) => {
            const next = { ...prev };
            delete next[meal.mealId];
            return next;
          });
          setSugerenciasDescartadas((prev) => {
            const next = new Set(prev);
            next.add(meal.mealId);
            return next;
          });
        }
      } catch (e) {
        console.error('[Nutricion] copiar comida anterior', e);
      } finally {
        setCopiandoComidaAnteriorId(null);
      }
    },
    [copiandoComidaAnteriorId, copiarComidaAnteriorEnComida],
  );

  const cerrarBuscadorAlimentos = useCallback(() => {
    setMealIdBuscador(null);
  }, []);

  const handleReemplazar = useCallback(
    async (food: Food, gramos: number) => {
      if (!itemAReemplazar) return;
      await reemplazarAlimento(itemAReemplazar, food, gramos);
      emitNutricionLogActualizado({ fechaLog: fecha });
      setItemAReemplazar(null);
    },
    [itemAReemplazar, reemplazarAlimento, fecha],
  );

  const registrarAlimentoSeleccionado = useCallback(
    async (food: Food, gramos: number) => {
      if (!mealIdBuscador || !user?.id) return;

      const foodReal = await alimentosService.asegurarFoodParaLog(food);
      await nutricionService.añadirAlimentoAComida({
        mealId: mealIdBuscador,
        foodId: foodReal.id,
        gramos,
        food: {
          calorias: Number(foodReal.calorias ?? 0),
          proteinas: Number(foodReal.proteinas ?? 0),
          carbohidratos: Number(foodReal.carbohidratos ?? 0),
          grasas: Number(foodReal.grasas ?? 0),
        },
      });
      emitNutricionLogActualizado({ fechaLog: fecha });
    },
    [fecha, mealIdBuscador, user?.id],
  );

  const eliminarComidaSeleccionada = useCallback(async () => {
    const meal = menuComida;
    const logId = resumen?.logId;
    if (!meal || !logId) return;

    setMenuComida(null);
    try {
      await eliminarComidaDelLog(logId, meal.mealId);
    } catch (e) {
      console.error('[Nutricion] eliminar comida', e);
    }
  }, [eliminarComidaDelLog, menuComida, resumen?.logId]);

  const copiarComidaSeleccionada = useCallback(() => {
    if (!menuComida) return;
    copiarDesdeComida(menuComida.items);
    setMenuComida(null);
  }, [copiarDesdeComida, menuComida]);

  const compartirComidaSeleccionada = useCallback(() => {
    if (!menuComida) return;
    const meal = menuComida;
    setMenuComida(null);
    setComidaCompartir(meal);
  }, [menuComida]);

  const pegarEnComidaSeleccionada = useCallback(async () => {
    const meal = menuComida;
    if (!meal || !lineasCopiadas?.length) return;
    setMenuComida(null);
    try {
      await pegarAlimentosEnComida(meal.mealId, lineasCopiadas);
      limpiarPortapapeles();
    } catch (e) {
      console.error('[Nutricion] pegar comida', e);
    }
  }, [limpiarPortapapeles, lineasCopiadas, menuComida, pegarAlimentosEnComida]);

  const vaciarComidaSeleccionada = useCallback(async () => {
    const meal = menuComida;
    if (!meal) return;
    setMenuComida(null);
    try {
      await vaciarComida(meal.mealId);
    } catch (e) {
      console.error('[Nutricion] vaciar comida', e);
    }
  }, [menuComida, vaciarComida]);

  useEffect(() => {
    if (cargandoDia) {
      setSkeletonVisible(true);
      skeletonFadeOpacity.setValue(1);
      contentOpacity.setValue(0);
      shimmerOpacity.setValue(0.3);

      const shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerOpacity, {
            toValue: 0.8,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerOpacity, {
            toValue: 0.3,
            duration: 650,
            useNativeDriver: true,
          }),
        ]),
      );

      shimmerLoop.start();
      return () => shimmerLoop.stop();
    }

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: SKELETON_FADE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(skeletonFadeOpacity, {
        toValue: 0,
        duration: SKELETON_FADE_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setSkeletonVisible(false);
    });
  }, [cargandoDia, contentOpacity, shimmerOpacity, skeletonFadeOpacity]);

  const renderHeader = useCallback(() => {
    return (
      <>
        <View style={styles.screenHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Alimentación</Text>
            <View style={styles.titleBadge}>
              <Ionicons name="nutrition-outline" size={15} color={c.primary} />
            </View>
          </View>

        </View>

        <View style={styles.weekStripCard}>
          <View style={styles.weekStripLeft}>
            <Text style={styles.weekStripTitle}>Esta semana</Text>
            <Text style={styles.weekStripSubtitle} numberOfLines={1} ellipsizeMode="tail">
              {rangoSemanaLabel}
            </Text>
          </View>
          <GestureDetector gesture={swipeCalendario}>
            <View style={styles.weekStripDaysGestureHost}>
              <View style={styles.weekStripDaysWrap}>
                {semana.map((d, index) => (
                  <View key={`${d.key}-${d.fechaIso}-${index}`} style={styles.weekDayColumn}>
                    <Pressable
                      style={styles.weekDayPress}
                      onPress={() => cambiarFecha(d.fechaIso)}
                      hitSlop={{ top: 4, bottom: 4, left: 1, right: 1 }}
                    >
                      <View style={[styles.weekDayCell, d.activo && styles.weekDayCellActive]}>
                        <Text style={[styles.weekDayLetter, d.activo && styles.weekDayLetterActive]}>{d.key}</Text>
                        <Text
                          style={[styles.weekDayNumber, d.activo && styles.weekDayNumberActive]}
                          allowFontScaling={false}
                        >
                          {d.dia}
                        </Text>
                      </View>
                    </Pressable>
                    <View style={[styles.weekDayUnderline, d.activo && styles.weekDayUnderlineActive]} />
                  </View>
                ))}
              </View>
            </View>
          </GestureDetector>
          <Pressable
            onPress={abrirCalendario}
            hitSlop={8}
            style={styles.weekStripCalendarBtn}
            accessibilityRole="button"
            accessibilityLabel="Abrir calendario de nutrición"
          >
            <Ionicons name="calendar-outline" size={18} color={c.textDisplay} />
          </Pressable>
        </View>

        {renderGoalCard()}

        <Text style={styles.sectionTitle}>COMIDAS DEL DÍA</Text>

        {skeletonVisible && (
          <Animated.View pointerEvents="none" style={{ opacity: skeletonFadeOpacity }}>
            <MealCardsSkeleton
              styles={styles}
              shimmerOpacity={shimmerOpacity}
              colors={skeletonColors}
            />
          </Animated.View>
        )}
      </>
    );
  }, [
    swipeCalendario,
    semana,
    rangoSemanaLabel,
    styles,
    cambiarFecha,
    abrirCalendario,
    c.textDisplay,
    c.primary,
    renderGoalCard,
    shimmerOpacity,
    skeletonColors,
    skeletonFadeOpacity,
    skeletonVisible,
  ]);

  const renderItem = useCallback(
    ({ item: meal, drag, isActive }: { item: ComidaConAlimentos; drag: () => void; isActive: boolean; }) => {
      const mealIcon = iconoComida(meal.nombre, meal.isDefault);
      const sugerenciaAnterior = sugerenciasComidaAnterior[meal.mealId];
      const sugerenciaAnteriorData =
        sugerenciaAnterior?.estado === 'disponible' ? sugerenciaAnterior.data : null;
      const mostrarSugerenciaAnterior =
        meal.items.length === 0 &&
        !sugerenciasDescartadas.has(meal.mealId) &&
        sugerenciaAnteriorData !== null;
      const copiandoAnterior = copiandoComidaAnteriorId === meal.mealId;

      return (
        <Animated.View style={{ opacity: contentOpacity }}>
          <View style={[styles.mealCard, isActive && styles.mealCardActive]}>
              <View style={styles.mealHeaderRow}>
                <Pressable onLongPress={drag} delayLongPress={150} style={styles.mealIconWrap} hitSlop={12}>
                  <Ionicons name={mealIcon} size={27} color={c.primary} />
                </Pressable>

                <View style={styles.mealHeaderText}>
                  <Text style={styles.mealTitle} numberOfLines={1} adjustsFontSizeToFit>
                    {meal.nombre}
                  </Text>
                  <View style={styles.mealMetaRow}>
                    <Ionicons name="flame-outline" size={11} color={c.danger} />
                    <Text style={styles.mealMetaKcal}>{Math.round(meal.totalCalorias)} kcal</Text>
                    <View style={styles.mealMetaDivider} />
                    <Text style={styles.mealMetaProtein}>{Math.round(meal.totalProteinas)}P</Text>
                    <View style={styles.mealMetaDivider} />
                    <Text style={styles.mealMetaCarbs}>{Math.round(meal.totalCarbos)}C</Text>
                    <View style={styles.mealMetaDivider} />
                    <Text style={styles.mealMetaFat}>{Math.round(meal.totalGrasas)}G</Text>
                  </View>
                </View>

                <View style={styles.mealActionRow}>
                  <Pressable style={styles.mealAiBtn} accessibilityRole="button" accessibilityLabel="Asistente IA">
                    <MealAiLogo width={18} height={18} />
                  </Pressable>
                  <Pressable
                    style={styles.mealMenuBtn}
                    onPress={(event) => {
                      setMenuAnchor({
                        x: event.nativeEvent.pageX,
                        y: event.nativeEvent.pageY,
                      });
                      setMenuComida(meal);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Abrir menú de comida"
                  >
                    <Ionicons name="ellipsis-vertical" size={22} color={c.textDisplay} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.mealItemsList}>
                {meal.items.map((item) => {
                  const rightActionsFood = () => (
                    <View style={styles.swipeRight}>
                      <View style={styles.swipeDeleteFoodInner}>
                        <Text style={styles.swipeDeleteTxt}>Quitar</Text>
                      </View>
                    </View>
                  );
                  return (
                    <Swipeable
                      key={item.id}
                      renderRightActions={rightActionsFood}
                      overshootRight={false}
                      friction={2}
                      onSwipeableOpen={(direction) => {
                        if (direction !== 'right') return;
                        void (async () => {
                          try {
                            await eliminarAlimento(item.id);
                          } catch (e) {
                            console.error('[Nutricion] eliminar alimento', e);
                          }
                        })();
                      }}
                    >
                      <Pressable
                        style={styles.foodRow}
                        hitSlop={6}
                        onPress={() => {
                          if (!item.food) return;
                          setItemAReemplazar({
                            id: item.id,
                            meal_id: item.meal_id,
                            food: item.food,
                            gramos: item.gramos,
                          });
                        }}
                      >
                        <Text style={styles.foodName} numberOfLines={1}>{item.food?.nombre ?? 'Alimento'}</Text>

                        <View style={styles.foodMetaRow}>
                          <Text style={styles.foodMeta}>{Math.round(item.gramos)} g</Text>
                          <View style={styles.foodMetrics}>
                            <Text style={[styles.foodMetricText, styles.foodMacroProteinText]}>
                              {Math.round(item.proteinas_calculadas)}P
                            </Text>
                            <Text style={[styles.foodMetricText, styles.foodMacroCarbsText]}>
                              {Math.round(item.carbos_calculados)}C
                            </Text>
                            <Text style={[styles.foodMetricText, styles.foodMacroFatText]}>
                              {Math.round(item.grasas_calculadas)}G
                            </Text>
                            <Text style={styles.foodKcalText}>{Math.round(item.calorias_calculadas)} kcal</Text>
                          </View>
                        </View>
                      </Pressable>
                    </Swipeable>
                  );
                })}
                {mostrarSugerenciaAnterior && (
                  <View style={styles.previousMealSuggestion}>
                    <View style={styles.previousMealSuggestionTextWrap}>
                      <Text style={styles.previousMealSuggestionTitle} numberOfLines={1}>
                        Copiar comida anterior
                      </Text>
                      <Text style={styles.previousMealSuggestionMeta} numberOfLines={1}>
                        {sugerenciaAnteriorData?.lineas.length} alimentos del {sugerenciaAnteriorData?.fecha}
                      </Text>
                    </View>
                    <View style={styles.previousMealSuggestionActions}>
                      <Pressable
                        style={[styles.previousMealSuggestionBtn, styles.previousMealSuggestionAccept]}
                        onPress={() => void confirmarCopiarComidaAnterior(meal)}
                        disabled={copiandoAnterior}
                        accessibilityRole="button"
                        accessibilityLabel={`Copiar comida anterior en ${meal.nombre}`}
                      >
                        <Ionicons name="checkmark" size={17} color={c.textOnPrimary} />
                      </Pressable>
                      <Pressable
                        style={styles.previousMealSuggestionBtn}
                        onPress={() => descartarSugerenciaComidaAnterior(meal.mealId)}
                        disabled={copiandoAnterior}
                        accessibilityRole="button"
                        accessibilityLabel={`Descartar copiar comida anterior en ${meal.nombre}`}
                      >
                        <Ionicons name="close" size={17} color={c.textDisplay} />
                      </Pressable>
                    </View>
                  </View>
                )}
                {meal.items.length === 0 && !mostrarSugerenciaAnterior && (
                  <Text style={styles.emptyMealSlotHint}>Todavía no hay alimentos en esta comida</Text>
                )}
              </View>

              <Pressable
                style={styles.registerMealBtn}
                onPress={() => abrirRegistrarComida(meal.mealId)}
                accessibilityRole="button"
                accessibilityLabel={`Registrar comida en ${meal.nombre}`}
              >
                <Ionicons name="add-circle-outline" size={17} color={c.primary} />
                <Text style={styles.registerMealBtnText}>Registrar alimento</Text>
              </Pressable>
          </View>
        </Animated.View>
      );
    },
    [
      styles,
      eliminarAlimento,
      setItemAReemplazar,
      c.primary,
      c.danger,
      c.textDisplay,
      c.textOnPrimary,
      contentOpacity,
      abrirRegistrarComida,
      MealAiLogo,
      sugerenciasComidaAnterior,
      sugerenciasDescartadas,
      copiandoComidaAnteriorId,
      confirmarCopiarComidaAnterior,
      descartarSugerenciaComidaAnterior,
    ],
  );

  const abrirNuevaComida = useCallback(() => {
    setNombreNuevaComida('');
    setModalNuevaComida(true);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <SortableMealList
        data={cargandoDia ? [] : comidasData}
        keyExtractor={(item) => item.mealId}
        onDragEnd={onDragEnd}
        ListHeaderComponent={renderHeader}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        containerStyle={styles.listContainer}
      />

      {!cargandoDia && (
        <View style={styles.fixedAddMealWrap}>
          {isDark ? (
            <GlowButton borderRadius={999} glowPadding={18}>
              <Pressable
                style={styles.addMealBtn}
                onPress={abrirNuevaComida}
                accessibilityRole="button"
                accessibilityLabel="Añadir comida"
              >
                <Ionicons name="add-circle-outline" size={17} color={c.textOnPrimary} />
                <Text style={styles.addMealBtnText}>Añadir comida</Text>
              </Pressable>
            </GlowButton>
          ) : (
            <Pressable
              style={styles.addMealBtn}
              onPress={abrirNuevaComida}
              accessibilityRole="button"
              accessibilityLabel="Añadir comida"
            >
              <Ionicons name="add-circle-outline" size={17} color={c.textOnPrimary} />
              <Text style={styles.addMealBtnText}>Añadir comida</Text>
            </Pressable>
          )}
        </View>
      )}

      {menuComida && (
        <View style={styles.mealMenuLayer} pointerEvents="box-none">
          <Pressable style={styles.mealMenuDismiss} onPress={() => setMenuComida(null)} />
          <View
            style={[
              styles.mealMenuPopover,
              {
                top: Math.min(menuAnchor.y + 10, windowHeight - 276),
                left: Math.min(Math.max(menuAnchor.x - 176, s.md), windowWidth - 206),
              },
            ]}
          >
            <Text style={styles.mealMenuTitle} numberOfLines={1}>
              {menuComida.nombre}
            </Text>
            <Pressable
              style={styles.mealMenuOption}
              onPress={compartirComidaSeleccionada}
            >
              <Ionicons name="share-outline" size={17} color={c.textDisplay} />
              <Text style={styles.mealMenuOptionText}>
                Compartir
              </Text>
            </Pressable>
            <Pressable
              style={[styles.mealMenuOption, menuComida.items.length === 0 && styles.mealMenuOptionDisabled]}
              onPress={copiarComidaSeleccionada}
              disabled={menuComida.items.length === 0}
            >
              <Ionicons name="copy-outline" size={17} color={menuComida.items.length > 0 ? c.textDisplay : c.textMuted} />
              <Text style={[styles.mealMenuOptionText, menuComida.items.length === 0 && styles.mealMenuOptionTextDisabled]}>
                Copiar comida
              </Text>
            </Pressable>
            <Pressable
              style={[styles.mealMenuOption, !tieneCopia && styles.mealMenuOptionDisabled]}
              onPress={() => void pegarEnComidaSeleccionada()}
              disabled={!tieneCopia}
            >
              <Ionicons name="clipboard-outline" size={17} color={tieneCopia ? c.textDisplay : c.textMuted} />
              <Text style={[styles.mealMenuOptionText, !tieneCopia && styles.mealMenuOptionTextDisabled]}>
                Pegar comida
              </Text>
            </Pressable>
            <Pressable
              style={[styles.mealMenuOption, menuComida.items.length === 0 && styles.mealMenuOptionDisabled]}
              onPress={() => void vaciarComidaSeleccionada()}
              disabled={menuComida.items.length === 0}
            >
              <Ionicons name="remove-circle-outline" size={17} color={menuComida.items.length > 0 ? c.textDisplay : c.textMuted} />
              <Text style={[styles.mealMenuOptionText, menuComida.items.length === 0 && styles.mealMenuOptionTextDisabled]}>
                Vaciar comida
              </Text>
            </Pressable>
            <View style={styles.mealMenuDivider} />
            <Pressable style={styles.mealMenuOption} onPress={() => void eliminarComidaSeleccionada()}>
              <Ionicons name="trash-outline" size={17} color={c.danger} />
              <Text style={styles.mealMenuOptionDanger}>Eliminar comida</Text>
            </Pressable>
          </View>
        </View>
      )}

      {comidasData.length === 0 && !cargando && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyMealText}>No hay comidas registradas para este día.</Text>
        </View>
      )}

      <CalendarioNutricion
        visible={calendarioVisible}
        fechaActual={fecha}
        objetivos={objetivos}
        onClose={cerrarCalendario}
        onSeleccionarDia={seleccionarDiaCalendario}
      />

      <MealShareModal
        visible={comidaCompartir !== null}
        onClose={() => setComidaCompartir(null)}
        comida={comidaCompartir}
        initialDark={isDark}
        fallbackMessage={comidaCompartir ? textoCompartirComida(comidaCompartir) : ''}
      />

      <BuscadorAlimentos
        visible={mealIdBuscador !== null}
        onClose={cerrarBuscadorAlimentos}
        onAlimentoSeleccionado={registrarAlimentoSeleccionado}
        userId={user?.id}
      />

      {itemAReemplazar !== null && (
        <BuscadorAlimentos
          visible
          onClose={() => setItemAReemplazar(null)}
          onAlimentoSeleccionado={handleReemplazar}
          userId={user?.id}
          alimentoInicial={{ food: itemAReemplazar.food, gramos: itemAReemplazar.gramos }}
        />
      )}

      <Modal visible={modalNuevaComida} transparent animationType="fade" onRequestClose={() => setModalNuevaComida(false)}>
        <KeyboardAvoidingView
          style={[
            styles.modalKeyboardAvoiding,
            Platform.OS === 'android' && keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null,
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setModalNuevaComida(false)}>
            <Pressable
              style={[styles.modalCard, { paddingBottom: s.lg + Math.max(insets.bottom, s.md) }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHandle} />

              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setModalNuevaComida(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={20} color={c.textDisplay} />
              </Pressable>

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Añadir comida</Text>
                <Text style={styles.modalSubtitle}>Escribe el nombre de la comida</Text>
              </View>

              <View style={styles.modalFieldBlock}>
                <Text style={styles.modalLabel}>Nombre</Text>
                <View style={styles.modalInputWrap}>
                  <Ionicons name="pricetag-outline" size={18} color={c.textSecondary} />
                  <View style={styles.modalInputAccent} />
                  <TextInput
                    value={nombreNuevaComida}
                    onChangeText={setNombreNuevaComida}
                    placeholder="Ej: Post Cena"
                    placeholderTextColor={c.textMuted}
                    style={styles.modalInput}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => void confirmarNuevaComida()}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.modalBtnGhost} onPress={() => setModalNuevaComida(false)}>
                  <Text style={styles.modalBtnGhostText}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.modalBtnPrimary} onPress={() => void confirmarNuevaComida()}>
                  <Text style={styles.modalBtnPrimaryText}>Aceptar</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function makeStyles(
  c: ReturnType<typeof useTheme>['c'],
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    listContainer: {
      flex: 1,
      marginBottom: 78,
    },
    listContent: {
      paddingHorizontal: s.md,
      paddingBottom: s.md,
      gap: s.sm,
    },
    skeletonSurface: {
      overflow: 'hidden',
    },
    skeletonMealsList: {
      gap: s.sm,
    },
    skeletonMealIcon: {
      width: 44,
      height: 44,
      borderRadius: r.pill,
    },
    skeletonMealTitle: {
      width: '58%',
      height: 18,
      borderRadius: r.technical,
    },
    skeletonMealKcal: {
      width: 52,
      height: 12,
      borderRadius: r.technical,
    },
    skeletonMealMacro: {
      width: 20,
      height: 12,
      borderRadius: r.technical,
    },
    skeletonAddBtn: {
      width: 38,
      height: 38,
      borderRadius: r.sm,
    },
    skeletonMealItemsList: {
      overflow: 'hidden',
    },
    skeletonFoodName: {
      width: '62%',
      height: 16,
      borderRadius: r.technical,
    },
    skeletonFoodGrams: {
      width: 40,
      height: 13,
      borderRadius: r.technical,
    },
    skeletonFoodMetric: {
      width: 18,
      height: 13,
      borderRadius: r.technical,
    },
    skeletonFoodKcal: {
      width: 48,
      height: 13,
      borderRadius: r.technical,
    },
    screenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.md,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    screenTitle: {
      ...ts.heading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: -0.6,
    },
    titleBadge: {
      width: s.lg,
      height: s.lg,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsButton: {
      width: 42,
      height: 42,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekStripCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingVertical: s.xs,
      paddingHorizontal: s.sm,
      gap: s.xs,
    },
    weekStripLeft: {
      justifyContent: 'center',
      alignItems: 'flex-start',
      flexShrink: 0,
      maxWidth: 112,
      paddingRight: s.xs,
    },
    weekStripTitle: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      letterSpacing: -0.2,
    },
    weekStripSubtitle: {
      marginTop: 1,
      fontSize: 10,
      lineHeight: 13,
      fontFamily: f.sans,
      color: c.textMuted,
    },
    weekStripDaysGestureHost: {
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
    },
    weekStripDaysWrap: {
      flex: 1,
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
      paddingHorizontal: 2,
    },
    weekDayColumn: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
    },
    weekDayPress: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    weekDayCell: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      width: '100%',
      minWidth: 0,
      paddingHorizontal: 3,
      paddingVertical: 5,
      borderRadius: r.pill,
      overflow: 'hidden',
    },
    weekDayCellActive: {
      backgroundColor: c.primary,
    },
    weekDayLetter: {
      fontSize: 10,
      lineHeight: 12,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.45,
      textTransform: 'uppercase',
    },
    weekDayLetterActive: {
      color: c.textOnPrimary,
    },
    weekDayNumber: {
      marginTop: 1,
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: -0.35,
      includeFontPadding: false,
      textAlign: 'center',
    },
    weekDayNumberActive: {
      color: c.textOnPrimary,
    },
    weekDayUnderline: {
      width: '75%',
      maxWidth: 36,
      height: 2,
      marginTop: 3,
      borderRadius: 1,
      backgroundColor: c.border,
    },
    weekDayUnderlineActive: {
      height: 3,
      maxWidth: 38,
      backgroundColor: c.primary,
    },
    weekStripCalendarBtn: {
      width: 36,
      height: 36,
      flexShrink: 0,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginTop: s.md,
    },
    mealCard: {
      position: 'relative',
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      paddingVertical: s.md,
      gap: s.sm,
    },
    mealCardActive: {
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
    },
    mealHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.md,
    },
    mealIconWrap: {
      width: 52,
      height: 52,
      borderRadius: r.pill,
      backgroundColor: c.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mealHeaderText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    swipeDeleteTxt: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textOnPrimary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    swipeRight: {
      justifyContent: 'center',
      marginLeft: s.sm,
    },
    swipeDeleteFoodInner: {
      backgroundColor: c.danger,
      justifyContent: 'center',
      alignItems: 'center',
      width: 76,
      borderRadius: r.sm,
      flex: 1,
      marginVertical: 2,
    },
    mealItemsList: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    foodRow: {
      gap: 3,
      backgroundColor: 'transparent',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    mealTitle: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      fontSize: 20,
      lineHeight: 24,
      letterSpacing: -0.45,
      color: c.textDisplay,
    },
    mealMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'nowrap',
      flexShrink: 1,
      minWidth: 0,
    },
    mealMetaKcal: {
      fontFamily: f.sansBold,
      fontSize: 10,
      lineHeight: 13,
      color: c.textSecondary,
    },
    mealMetaDivider: {
      width: 1,
      height: 12,
      alignSelf: 'center',
      backgroundColor: c.borderVisible,
    },
    mealMetaProtein: {
      fontFamily: f.sansBold,
      fontSize: 10,
      lineHeight: 13,
      color: c.primary,
    },
    mealMetaCarbs: {
      fontFamily: f.sansBold,
      fontSize: 10,
      lineHeight: 13,
      color: c.success,
    },
    mealMetaFat: {
      fontFamily: f.sansBold,
      fontSize: 10,
      lineHeight: 13,
      color: c.macroFat,
    },
    foodName: {
      fontFamily: f.sansBold,
      fontSize: 12,
      lineHeight: 15,
      color: c.textDisplay,
      alignSelf: 'stretch',
    },
    foodMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.sm,
    },
    foodMeta: {
      fontFamily: f.sans,
      fontSize: 10,
      lineHeight: 13,
      color: c.textMuted,
      flexShrink: 1,
    },
    foodMetrics: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'nowrap',
      gap: 6,
      flexShrink: 0,
    },
    foodMetricText: {
      fontFamily: f.sansBold,
      fontSize: 10,
      lineHeight: 13,
    },
    foodMacroProteinText: {
      color: c.primary,
    },
    foodMacroCarbsText: {
      color: c.success,
    },
    foodMacroFatText: {
      color: c.macroFat,
    },
    foodKcalText: {
      fontSize: 9,
      lineHeight: 12,
      fontFamily: f.sansMedium,
      color: c.textMuted,
      marginLeft: 2,
    },
    emptyMealText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textMuted,
      paddingHorizontal: s.md,
      paddingVertical: s.lg,
      textAlign: 'center',
    },
    emptyMealSlotHint: {
      fontFamily: f.sans,
      fontSize: 14,
      lineHeight: 18,
      color: c.textMuted,
      paddingHorizontal: s.md,
      paddingVertical: 10,
      textAlign: 'center',
    },
    previousMealSuggestion: {
      minHeight: 54,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.sm,
    },
    previousMealSuggestionTextWrap: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    previousMealSuggestionTitle: {
      fontSize: 13,
      lineHeight: 16,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    previousMealSuggestionMeta: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sans,
      color: c.textMuted,
    },
    previousMealSuggestionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
      flexShrink: 0,
    },
    previousMealSuggestionBtn: {
      width: 32,
      height: 32,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previousMealSuggestionAccept: {
      borderColor: c.primary,
      backgroundColor: c.primary,
    },
    emptyOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: s.xl,
      top: '45%',
    },
    addBtn: {
      width: 38,
      height: 38,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: {
      fontSize: 22,
      lineHeight: 24,
      fontFamily: f.mono,
      color: c.textDisplay,
    },
    mealActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
      flexShrink: 0,
    },
    mealAiBtn: {
      width: 36,
      height: 36,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    mealMenuBtn: {
      width: 36,
      height: 36,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    registerMealBtn: {
      minHeight: 31,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: 'transparent',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    registerMealBtnText: {
      ...ts.label,
      fontFamily: f.sansMedium,
      color: c.primary,
      letterSpacing: 0,
    },
    goalCard: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surface,
      marginTop: s.sm,
      paddingHorizontal: s.sm,
      paddingVertical: s.sm,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: s.sm,
    },
    goalKcalRing: {
      width: 96,
      height: 102,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    goalKcalCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      top: 29,
      left: 14,
      right: 14,
    },
    goalKcalValue: {
      fontSize: 18,
      lineHeight: 28,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: 0,
      includeFontPadding: false,
      textAlign: 'center',
    },
    goalKcalUnit: {
      marginTop: 2,
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      includeFontPadding: false,
    },
    goalMain: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
    },
    goalBadge: {
      alignSelf: 'center',
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: s.sm,
      paddingVertical: 5,
    },
    goalBadgeText: {
      ...ts.label,
      fontFamily: f.mono,
      fontSize: 11,
      lineHeight: 13,
      color: c.primary,
      letterSpacing: 3,
      includeFontPadding: false,
    },
    goalMacrosRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: s.xs,
    },
    goalMacro: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 1,
    },
    goalMacroIcon: {
      width: 26,
      height: 26,
      borderRadius: r.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalMacroBody: {
      width: '100%',
      minWidth: 0,
      alignItems: 'center',
      gap: 4,
    },
    goalMacroLabel: {
      fontSize: 10,
      lineHeight: 12,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'center',
      includeFontPadding: false,
    },
    goalMacroValue: {
      width: '100%',
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansBold,
      textAlign: 'center',
      includeFontPadding: false,
    },
    goalMacroTarget: {
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    goalMacroTrack: {
      width: '100%',
      height: 6,
      borderRadius: r.pill,
      backgroundColor: c.borderVisible,
      overflow: 'hidden',
    },
    goalMacroFill: {
      height: '100%',
      borderRadius: r.pill,
    },
    fixedAddMealWrap: {
      position: 'absolute',
      left: s.md,
      right: s.md,
      bottom: s.sm,
      zIndex: 20,
      marginBottom: 15,
    },
    addMealBtn: {
      borderWidth: 0,
      borderColor: 'transparent',
      borderRadius: r.pill,
      backgroundColor: c.primary,
      minHeight: 31,
      paddingVertical: 6,
      paddingHorizontal: s.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    addMealBtnDisabled: {
      opacity: 0.45,
    },
    addMealBtnText: {
      ...ts.label,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
      letterSpacing: 0,
    },
    mealMenuPopover: {
      position: 'absolute',
      width: 190,
      maxHeight: 260,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surfaceElevated,
      paddingVertical: s.xs,
      paddingHorizontal: s.sm,
      zIndex: 30,
    },
    mealMenuLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
    },
    mealMenuDismiss: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    mealMenuTitle: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      paddingHorizontal: s.xs,
      paddingVertical: s.xs,
    },
    mealMenuOption: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
      borderRadius: r.sm,
      paddingHorizontal: s.xs,
    },
    mealMenuOptionDisabled: {
      opacity: 0.45,
    },
    mealMenuOptionText: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    mealMenuOptionTextDisabled: {
      color: c.textMuted,
    },
    mealMenuOptionDanger: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansMedium,
      color: c.danger,
    },
    mealMenuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.borderVisible,
      marginVertical: 2,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
      justifyContent: 'flex-end',
    },
    modalKeyboardAvoiding: {
      flex: 1,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingTop: 34,
      paddingHorizontal: s.lg,
      gap: s.lg,
    },
    modalHandle: {
      position: 'absolute',
      top: 12,
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: r.pill,
      backgroundColor: c.textMuted,
      opacity: 0.72,
    },
    modalCloseBtn: {
      position: 'absolute',
      top: 20,
      right: s.md,
      width: 30,
      height: 30,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalHeader: {
      gap: 7,
    },
    modalTitle: {
      fontSize: 20,
      lineHeight: 25,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      letterSpacing: 0,
    },
    modalSubtitle: {
      fontSize: 13,
      lineHeight: 17,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    modalFieldBlock: {
      gap: 9,
    },
    modalLabel: {
      fontSize: 13,
      lineHeight: 16,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    modalInputWrap: {
      minHeight: 47,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: s.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    modalInputAccent: {
      width: 2,
      height: 24,
      borderRadius: r.pill,
      backgroundColor: c.primary,
    },
    modalInput: {
      fontFamily: f.sans,
      color: c.text,
      fontSize: 14,
      lineHeight: 18,
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
    },
    modalActions: {
      flexDirection: 'row',
      gap: s.md,
    },
    modalBtnGhost: {
      flex: 1,
      minHeight: 43,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnGhostText: {
      fontSize: 13,
      lineHeight: 16,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    modalBtnPrimary: {
      flex: 1,
      minHeight: 43,
      backgroundColor: c.primary,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnPrimaryText: {
      fontSize: 13,
      lineHeight: 16,
      fontFamily: f.sansBold,
      color: c.textOnPrimary,
      letterSpacing: 0,
    },
  });
}
