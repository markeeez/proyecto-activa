import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alimentosService } from '@/services/alimentos.service';
import { nutricionService } from '@/services/nutricion.service';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import type { Food } from '@/types/database.types';

type TabKey = 'base' | 'favoritos' | 'creados';

export default function AgregarAlimento() {
  const { c, f, ts, s, r } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);
  const { mealId } = useLocalSearchParams<{ mealId?: string }>();

  const [tab, setTab] = useState<TabKey>('base');
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Food[]>([]);
  const [recientes, setRecientes] = useState<Food[]>([]);
  const [creados, setCreados] = useState<Food[]>([]);
  const [favoritos, setFavoritos] = useState<Food[]>([]);
  const [favoritosIds, setFavoritosIds] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foodSeleccionado, setFoodSeleccionado] = useState<Food | null>(null);
  const [gramos, setGramos] = useState('100');
  const [guardando, setGuardando] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const favStorageKey = user?.id ? `activa_food_favorites_${user.id}` : '';

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) return;
      try {
        const [recentFoods, createdFoods] = await Promise.all([
          alimentosService.obtenerRecientes(user.id),
          alimentosService.obtenerAlimentosCreados(user.id),
        ]);
        if (!active) return;
        setRecientes(recentFoods);
        setCreados(createdFoods);
      } catch {
        if (!active) return;
        setRecientes([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id || !favStorageKey) return;

      const desdeBd = await alimentosService.obtenerFavoritosUsuario(user.id);
      if (!active) return;
      if (desdeBd.length > 0) {
        setFavoritos(desdeBd);
        setFavoritosIds(desdeBd.map((f) => f.id));
        return;
      }

      const raw = await AsyncStorage.getItem(favStorageKey);
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      setFavoritosIds(ids);
      if (ids.length === 0) {
        setFavoritos([]);
        return;
      }
      try {
        const foods = await alimentosService.obtenerAlimentosPorIds(ids);
        if (!active) return;
        const mapById = new Map(foods.map((f) => [f.id, f]));
        setFavoritos(ids.map((id) => mapById.get(id)).filter(Boolean) as Food[]);
      } catch {
        if (!active) return;
        setFavoritos([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [favStorageKey, user?.id]);

  useEffect(() => {
    const term = query.trim();
    if (tab !== 'base' || term.length < 2) {
      if (tab === 'base') setResultados([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCargando(true);
      setError(null);
      try {
        const data = await alimentosService.buscarAlimento(term, user?.id);
        setResultados(data);
      } catch (e: any) {
        setError(e?.message ?? 'No se pudo buscar alimentos.');
      } finally {
        setCargando(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, tab, user?.id]);

  useEffect(() => {
    const term = query.trim();
    if (tab !== 'creados' || !user?.id) return;

    const timer = setTimeout(async () => {
      setCargando(true);
      setError(null);
      try {
        const data = await alimentosService.obtenerAlimentosCreados(user.id, term);
        setCreados(data);
      } catch (e: any) {
        setError(e?.message ?? 'No se pudo cargar alimentos creados.');
      } finally {
        setCargando(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [tab, query, user?.id]);

  const confirmarAgregar = async () => {
    if (!mealId || !foodSeleccionado) return;
    const gramosNumero = Number(gramos);
    if (!Number.isFinite(gramosNumero) || gramosNumero <= 0) return;

    setGuardando(true);
    try {
      const foodReal = await alimentosService.asegurarFoodParaLog(foodSeleccionado);
      await nutricionService.añadirAlimentoAComida({
        mealId,
        foodId: foodReal.id,
        gramos: gramosNumero,
        food: {
          calorias: Number(foodReal.calorias ?? 0),
          proteinas: Number(foodReal.proteinas ?? 0),
          carbohidratos: Number(foodReal.carbohidratos ?? 0),
          grasas: Number(foodReal.grasas ?? 0),
        },
      });
      setFoodSeleccionado(null);
      setGramos('100');
      setOkMsg('Alimento agregado. Puedes seguir añadiendo mas.');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo agregar el alimento.');
    } finally {
      setGuardando(false);
    }
  };

  const toggleFavorito = async (food: Food) => {
    if (!user?.id || !favStorageKey) return;
    let foodId = food.id;
    try {
      const real = await alimentosService.asegurarFoodParaLog(food);
      foodId = real.id;
    } catch {
      return;
    }

    const activo = !favoritosIds.includes(foodId);
    const okDb = await alimentosService.setFavoritoUsuario(user.id, foodId, activo);

    if (okDb) {
      const next = activo
        ? [foodId, ...favoritosIds.filter((id) => id !== foodId)].slice(0, 80)
        : favoritosIds.filter((id) => id !== foodId);
      setFavoritosIds(next);
      const foods = await alimentosService.obtenerAlimentosPorIds(next);
      const mapById = new Map(foods.map((f) => [f.id, f]));
      setFavoritos(next.map((id) => mapById.get(id)).filter(Boolean) as Food[]);
      return;
    }

    const next = favoritosIds.includes(foodId)
      ? favoritosIds.filter((id) => id !== foodId)
      : [foodId, ...favoritosIds].slice(0, 80);
    setFavoritosIds(next);
    await AsyncStorage.setItem(favStorageKey, JSON.stringify(next));
    try {
      const foods = await alimentosService.obtenerAlimentosPorIds(next);
      const mapById = new Map(foods.map((f) => [f.id, f]));
      setFavoritos(next.map((id) => mapById.get(id)).filter(Boolean) as Food[]);
    } catch {
      setFavoritos([]);
    }
  };

  const listaActual = tab === 'base' ? (query.trim().length >= 2 ? resultados : recientes) : tab === 'favoritos' ? favoritos : creados;

  const foodEsFavorito = (food: Food) => {
    if (favoritosIds.includes(food.id)) return true;
    if (food.api_source && food.api_id) {
      return favoritos.some(
        (f) => f.api_source === food.api_source && f.api_id === food.api_id,
      );
    }
    return false;
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={styles.dismissArea} onPress={() => router.back()} />
      <View style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>X</Text>
        </Pressable>
        <View style={styles.searchWrap}>
          <TextInput
            placeholder="Buscar alimentos"
            placeholderTextColor={c.textMuted}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            autoFocus
          />
        </View>
      </View>

      <View style={styles.tabsRow}>
        <Pressable onPress={() => setTab('base')}>
          <Text style={[styles.tabText, tab === 'base' && styles.tabActive]}>Base de Datos</Text>
        </Pressable>
        <Pressable onPress={() => setTab('favoritos')}>
          <Text style={[styles.tabText, tab === 'favoritos' && styles.tabActive]}>Favoritos</Text>
        </Pressable>
        <Pressable onPress={() => setTab('creados')}>
          <Text style={[styles.tabText, tab === 'creados' && styles.tabActive]}>Creados</Text>
        </Pressable>
      </View>

      {cargando && (
        <View style={styles.stateRow}>
          <ActivityIndicator color={c.primary} />
        </View>
      )}
      {!!error && <Text style={styles.errorText}>[ERROR: {error}]</Text>}
      {!!okMsg && <Text style={styles.okText}>[{okMsg}]</Text>}

      <ScrollView contentContainerStyle={styles.list}>
        {tab === 'base' && query.trim().length < 2 && (
          <Text style={styles.sectionTitle}>Ingresados Recientemente</Text>
        )}
        {listaActual.map((food) => (
          <Pressable
            key={food.id}
            style={styles.foodRow}
            onPress={() => {
              setFoodSeleccionado(food);
              setGramos('100');
            }}
          >
            <View style={styles.foodMain}>
              <View style={styles.foodTitleRow}>
                <Text style={styles.foodName}>{food.nombre}</Text>
                {badgeOrigenAlimento(food) === 'basico' && (
                  <View style={styles.badgeBasico}>
                    <Text style={styles.badgeBasicoText}>Básico ✓</Text>
                  </View>
                )}
                {badgeOrigenAlimento(food) === 'marca' && (
                  <View style={styles.badgeMarca}>
                    <Text style={styles.badgeMarcaText}>Marca</Text>
                  </View>
                )}
              </View>
              <Text style={styles.foodMeta}>
                {Math.round(food.proteinas)}P | {Math.round(food.carbohidratos)}C | {Math.round(food.grasas)}G
              </Text>
            </View>
            <View style={styles.foodRight}>
              <Pressable onPress={() => toggleFavorito(food)} style={styles.favBtn}>
                <Text style={styles.favText}>{foodEsFavorito(food) ? '★' : '☆'}</Text>
              </Pressable>
              <Text style={styles.foodKcal}>{Math.round(food.calorias)} kcal</Text>
            </View>
          </Pressable>
        ))}
        {!cargando && listaActual.length === 0 && (
          <Text style={styles.emptyText}>Sin resultados para tu busqueda.</Text>
        )}
      </ScrollView>

      <Modal visible={!!foodSeleccionado} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Agregar alimento</Text>
            <Text style={styles.modalFoodName}>{foodSeleccionado?.nombre}</Text>
            <TextInput
              value={gramos}
              onChangeText={setGramos}
              keyboardType="numeric"
              style={styles.gramosInput}
              placeholder="100"
              placeholderTextColor={c.textMuted}
            />
            <Text style={styles.modalHint}>Cantidad en gramos</Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setFoodSeleccionado(null)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={confirmarAgregar} disabled={guardando}>
                {guardando ? (
                  <ActivityIndicator color={c.background} />
                ) : (
                  <Text style={styles.confirmText}>Agregar y seguir</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </View>
  );
}

function badgeOrigenAlimento(food: Food): 'basico' | 'marca' | null {
  const src = food.api_source ?? '';
  const sk = food.source_kind ?? '';
  if (
    src === 'builtin' ||
    sk === 'usda_foundation' ||
    sk === 'usda_sr_legacy' ||
    food.verified_basic === true
  ) {
    return 'basico';
  }
  if (sk === 'usda_fndds' || food.food_tier === 'brand' || src === 'openfoodfacts') {
    return 'marca';
  }
  return null;
}

function makeStyles(
  c: ReturnType<typeof useTheme>['c'],
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
      paddingHorizontal: s.xs,
      paddingTop: s.xs,
      paddingBottom: 0,
    },
    dismissArea: {
      ...StyleSheet.absoluteFillObject,
    },
    root: {
      height: '97%',
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.background,
      paddingHorizontal: s.md,
      paddingTop: s.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: s.sm },
    closeBtn: {
      width: 42,
      height: 42,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    closeText: { ...ts.label, fontFamily: f.monoBold, color: c.textDisplay, fontSize: 13 },
    searchWrap: {
      flex: 1,
      height: 42,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      justifyContent: 'center',
      paddingHorizontal: s.md,
    },
    searchInput: { ...ts.bodySm, fontFamily: f.sans, color: c.textDisplay },
    tabsRow: {
      marginTop: s.md,
      flexDirection: 'row',
      gap: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.separator,
      paddingBottom: s.sm,
    },
    tabText: { ...ts.label, fontFamily: f.mono, color: c.textMuted },
    tabActive: { color: c.textDisplay },
    stateRow: { marginTop: s.md },
    errorText: { ...ts.caption, fontFamily: f.mono, color: c.danger, marginTop: s.sm },
    okText: { ...ts.caption, fontFamily: f.mono, color: c.success, marginTop: s.sm },
    list: { paddingVertical: s.md, gap: s.sm },
    sectionTitle: { ...ts.subheading, fontFamily: f.sansBold, color: c.textDisplay, marginBottom: s.xs },
    foodRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: c.separator,
      paddingBottom: s.sm,
    },
    foodRight: { alignItems: 'flex-end', gap: 2 },
    favBtn: { paddingHorizontal: 2, paddingVertical: 1 },
    favText: { color: c.warning, fontSize: 15, lineHeight: 17, fontFamily: f.monoBold },
    foodMain: { flex: 1, gap: 2 },
    foodTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    foodName: { ...ts.body, fontFamily: f.sansMedium, color: c.textDisplay, flexShrink: 1 },
    badgeBasico: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: r.sm,
      backgroundColor: c.success + '22',
      borderWidth: 1,
      borderColor: c.success + '55',
    },
    badgeBasicoText: { ...ts.caption, fontFamily: f.monoBold, color: c.success, fontSize: 10 },
    badgeMarca: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: r.sm,
      backgroundColor: c.textMuted + '18',
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    badgeMarcaText: { ...ts.caption, fontFamily: f.mono, color: c.textSecondary, fontSize: 10 },
    foodMeta: { ...ts.caption, fontFamily: f.mono, color: c.textSecondary },
    foodKcal: { ...ts.bodySm, fontFamily: f.monoBold, color: c.textDisplay },
    emptyText: { ...ts.bodySm, fontFamily: f.sans, color: c.textMuted, marginTop: s.sm },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: s.lg,
    },
    modalCard: {
      borderRadius: r.lg,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderVisible,
      padding: s.md,
      gap: s.sm,
    },
    modalTitle: { ...ts.subheading, fontFamily: f.sansBold, color: c.textDisplay },
    modalFoodName: { ...ts.bodySm, fontFamily: f.sans, color: c.textSecondary },
    gramosInput: {
      height: 46,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: s.md,
      color: c.textDisplay,
      fontFamily: f.mono,
      ...ts.body,
    },
    modalHint: { ...ts.caption, fontFamily: f.mono, color: c.textMuted },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: s.sm, marginTop: s.xs },
    cancelBtn: {
      height: 40,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingHorizontal: s.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: { ...ts.label, fontFamily: f.mono, color: c.textSecondary },
    confirmBtn: {
      height: 40,
      borderRadius: r.pill,
      backgroundColor: c.textDisplay,
      paddingHorizontal: s.md,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 92,
    },
    confirmText: { ...ts.label, fontFamily: f.mono, color: c.background },
  });
}
