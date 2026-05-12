import { CrearAlimentoModal } from '@/components/nutricion/CrearAlimentoModal';
import { AlimentoRowSkeleton } from '@/components/ui/SkeletonList';
import { useTheme } from '@/hooks/useTheme';
import { alimentosService } from '@/services/alimentos.service';
import type { Food } from '@/types/database.types';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type TabKey = 'base' | 'favoritos' | 'creados';

const BUSQUEDA_TIMEOUT_MS = 25_000;

export type BuscadorAlimentosProps = {
  visible: boolean;
  onClose: () => void;
  onAlimentoSeleccionado: (food: Food, gramos: number) => void | Promise<void>;
  userId?: string;
  onRegistrarPorFoto?: () => void;
};

function storageKeyUltimaBusqueda(userId: string) {
  return `activa_last_food_search_${userId}`;
}

function normalizarParaBuscar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function soloEnterosPositivos(texto: string): string {
  return texto.replace(/\D/g, '');
}

function conTimeoutBusqueda<T>(promise: Promise<T>, ms = BUSQUEDA_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('La busqueda tardo demasiado. Intentalo de nuevo.'));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function BuscadorAlimentos({
  visible,
  onClose,
  onAlimentoSeleccionado,
  userId,
  onRegistrarPorFoto,
}: BuscadorAlimentosProps) {
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [tab, setTab] = useState<TabKey>('base');
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Food[]>([]);
  const [ultimaBusqueda, setUltimaBusqueda] = useState<Food[]>([]);
  const [creados, setCreados] = useState<Food[]>([]);
  const [favoritos, setFavoritos] = useState<Food[]>([]);
  const [favoritosIds, setFavoritosIds] = useState<string[]>([]);
  const [cargandoBase, setCargandoBase] = useState(false);
  const [cargandoApis, setCargandoApis] = useState(false);
  const [cargandoCreados, setCargandoCreados] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foodSeleccionado, setFoodSeleccionado] = useState<Food | null>(null);
  const [gramos, setGramos] = useState('100');
  const [guardando, setGuardando] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [crearAlimentoModo, setCrearAlimentoModo] = useState<'foto' | 'manual' | 'escaner' | null>(null);
  const [inputCantidadEnfocado, setInputCantidadEnfocado] = useState(false);
  const busquedaVersionRef = useRef(0);

  const favStorageKey = userId ? `activa_food_favorites_${userId}` : '';

  useEffect(() => {
    if (visible) return;

    busquedaVersionRef.current += 1;
    setTab('base');
    setQuery('');
    setResultados([]);
    setUltimaBusqueda([]);
    setCargandoBase(false);
    setCargandoApis(false);
    setCargandoCreados(false);
    setError(null);
    setOkMsg(null);
    setFoodSeleccionado(null);
    setGramos('100');
    setGuardando(false);
    setCrearAlimentoModo(null);
    setInputCantidadEnfocado(false);
  }, [visible]);

  const alimentoCreadoOResuelto = (food: Food) => {
    if (food.is_custom && userId && food.created_by === userId) {
      setCreados((prev) => {
        const rest = prev.filter((x) => x.id !== food.id);
        return [food, ...rest];
      });
    }
    const versionAlAbrir = busquedaVersionRef.current;
    void (async () => {
      if (userId) {
        try {
          const list = await alimentosService.obtenerAlimentosCreados(userId);
          if (busquedaVersionRef.current !== versionAlAbrir) return;
          setCreados(list);
        } catch {
          /* noop */
        }
      }
      if (busquedaVersionRef.current !== versionAlAbrir) return;
      setFoodSeleccionado(food);
      setGramos('100');
    })();
  };

  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      if (!userId) return;
      try {
        const list = await alimentosService.obtenerAlimentosCreados(userId);
        if (!active) return;
        setCreados(list);
      } catch {
        if (!active) return;
        setCreados([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, visible]);

  useEffect(() => {
    if (visible) setUltimaBusqueda([]);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      if (!userId || !favStorageKey) return;

      const desdeBd = await alimentosService.obtenerFavoritosUsuario(userId);
      if (!active) return;
      if (desdeBd.length > 0) {
        setFavoritos(desdeBd);
        setFavoritosIds(desdeBd.map((food) => food.id));
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
        const mapById = new Map(foods.map((food) => [food.id, food]));
        setFavoritos(ids.map((id) => mapById.get(id)).filter(Boolean) as Food[]);
      } catch {
        if (!active) return;
        setFavoritos([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [favStorageKey, userId, visible]);

  useEffect(() => {
    const term = query.trim();
    if (!visible || tab !== 'base' || term.length < 2) {
      setResultados([]);
      setCargandoBase(false);
      setCargandoApis(false);
      return;
    }

    let cancelado = false;
    const version = ++busquedaVersionRef.current;
    const sigueActiva = () => !cancelado && busquedaVersionRef.current === version;

    const timer = setTimeout(async () => {
      if (!sigueActiva()) return;

      const inicioBusqueda = Date.now();
      setCargandoBase(true);
      setError(null);
      setOkMsg(null);
      let localData: Food[] = [];
      try {
        localData = await conTimeoutBusqueda(alimentosService.buscarAlimentoLocal(term, userId));
        if (!sigueActiva()) return;
        setResultados(localData);
        setUltimaBusqueda(localData);
        if (userId && localData.length > 0) {
          AsyncStorage.setItem(
            storageKeyUltimaBusqueda(userId),
            JSON.stringify(localData),
          ).catch(() => {});
        }
      } catch (e: unknown) {
        if (sigueActiva()) {
          setError(e instanceof Error ? e.message : 'No se pudo buscar alimentos.');
        }
        return;
      } finally {
        if (sigueActiva()) setCargandoBase(false);
      }

      if (!sigueActiva()) return;

      setCargandoApis(true);
      try {
        const idsLocales = new Set(localData.map((food) => food.id).filter(Boolean));
        const apiData = await conTimeoutBusqueda(
          alimentosService.enriquecerConApis(term, userId, idsLocales),
          Math.max(1_000, BUSQUEDA_TIMEOUT_MS - (Date.now() - inicioBusqueda)),
        );
        if (!sigueActiva()) return;

        if (apiData.length > 0) {
          const reranked = await alimentosService.rankearResultados(
            term,
            [...localData, ...apiData],
          );
          if (!sigueActiva()) return;
          setResultados(reranked);
          setUltimaBusqueda(reranked);
          if (userId && reranked.length > 0) {
            AsyncStorage.setItem(
              storageKeyUltimaBusqueda(userId),
              JSON.stringify(reranked),
            ).catch(() => {});
          }
        }
      } catch {
        /* La fase de APIs falla en silencio; la búsqueda local ya queda visible. */
      } finally {
        if (sigueActiva()) setCargandoApis(false);
      }
    }, 300);

    return () => {
      cancelado = true;
      busquedaVersionRef.current += 1;
      clearTimeout(timer);
      setCargandoBase(false);
      setCargandoApis(false);
    };
  }, [query, tab, userId, visible]);

  useEffect(() => {
    const term = query.trim();
    if (!visible || tab !== 'creados' || !userId) return;

    let cancelado = false;
    const version = ++busquedaVersionRef.current;
    const sigueActiva = () => !cancelado && busquedaVersionRef.current === version;

    const timer = setTimeout(async () => {
      if (!sigueActiva()) return;
      setCargandoCreados(true);
      setError(null);
      try {
        const data = await conTimeoutBusqueda(alimentosService.obtenerAlimentosCreados(userId));
        if (!sigueActiva()) return;
        if (!term) {
          setCreados(data);
          return;
        }
        const nq = normalizarParaBuscar(term);
        setCreados(data.filter((food) => normalizarParaBuscar(food.nombre ?? '').includes(nq)));
      } catch (e: unknown) {
        if (sigueActiva()) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar alimentos creados.');
        }
      } finally {
        if (sigueActiva()) setCargandoCreados(false);
      }
    }, 250);
    return () => {
      cancelado = true;
      busquedaVersionRef.current += 1;
      clearTimeout(timer);
      setCargandoCreados(false);
    };
  }, [tab, query, userId, visible]);

  const confirmarAgregar = async () => {
    if (!foodSeleccionado) return;
    const gramosNumero = Number(gramos);
    if (!Number.isFinite(gramosNumero) || gramosNumero <= 0) return;

    setGuardando(true);
    setError(null);
    try {
      await onAlimentoSeleccionado(foodSeleccionado, gramosNumero);
      setFoodSeleccionado(null);
      setGramos('100');
      setOkMsg('Alimento agregado. Puedes seguir añadiendo más.');
      if (userId) {
        alimentosService.obtenerAlimentosCreados(userId).then(setCreados).catch(() => {});
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar el alimento.');
    } finally {
      setGuardando(false);
    }
  };

  const toggleFavorito = async (food: Food) => {
    if (!userId || !favStorageKey) return;
    let foodId = food.id;
    try {
      const real = await alimentosService.asegurarFoodParaLog(food);
      foodId = real.id;
    } catch {
      return;
    }

    const activo = !favoritosIds.includes(foodId);
    const okDb = await alimentosService.setFavoritoUsuario(userId, foodId, activo);

    if (okDb) {
      const next = activo
        ? [foodId, ...favoritosIds.filter((id) => id !== foodId)].slice(0, 80)
        : favoritosIds.filter((id) => id !== foodId);
      setFavoritosIds(next);
      const foods = await alimentosService.obtenerAlimentosPorIds(next);
      const mapById = new Map(foods.map((item) => [item.id, item]));
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
      const mapById = new Map(foods.map((item) => [item.id, item]));
      setFavoritos(next.map((id) => mapById.get(id)).filter(Boolean) as Food[]);
    } catch {
      setFavoritos([]);
    }
  };

  const listaBaseSinBusqueda = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    for (const food of ultimaBusqueda) {
      if (seen.has(food.id)) continue;
      seen.add(food.id);
      out.push(food);
    }
    return out;
  }, [ultimaBusqueda]);

  const tituloListaBaseSinBusqueda = useMemo(() => {
    if (ultimaBusqueda.length === 0) return null;
    return 'Última búsqueda';
  }, [ultimaBusqueda.length]);

  const favoritosFiltrados = useMemo(() => {
    const q = query.trim();
    if (!q) return favoritos;
    const nq = normalizarParaBuscar(q);
    if (!nq) return favoritos;
    return favoritos.filter((food) => normalizarParaBuscar(food.nombre ?? '').includes(nq));
  }, [favoritos, query]);

  const creadosFiltrados = useMemo(() => {
    const q = query.trim();
    if (!q) return creados;
    const nq = normalizarParaBuscar(q);
    if (!nq) return creados;
    return creados.filter((food) => normalizarParaBuscar(food.nombre ?? '').includes(nq));
  }, [creados, query]);

  const listaActual =
    tab === 'base'
      ? query.trim().length >= 2
        ? resultados
        : listaBaseSinBusqueda
      : tab === 'favoritos'
        ? favoritosFiltrados
        : creadosFiltrados;

  const cargandoEnPestanaActiva =
    (tab === 'base' && cargandoBase) || (tab === 'creados' && cargandoCreados);

  const foodEsFavorito = (food: Food) => {
    if (favoritosIds.includes(food.id)) return true;
    if (food.api_source && food.api_id) {
      return favoritos.some(
        (fav) => fav.api_source === food.api_source && fav.api_id === food.api_id,
      );
    }
    return false;
  };

  const gramosSeleccionados = useMemo(() => {
    const parsed = Number(gramos.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [gramos]);

  const macrosSeleccion = useMemo(() => {
    const factor = gramosSeleccionados / 100;
    return {
      calorias: Math.round(Number(foodSeleccionado?.calorias ?? 0) * factor),
      proteinas: Number(foodSeleccionado?.proteinas ?? 0) * factor,
      carbohidratos: Number(foodSeleccionado?.carbohidratos ?? 0) * factor,
      grasas: Number(foodSeleccionado?.grasas ?? 0) * factor,
    };
  }, [foodSeleccionado, gramosSeleccionados]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={foodSeleccionado ? undefined : onClose} />
        <View style={styles.root}>
          {/* ── Header: título + X ── */}
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.popupTitle}>Añadir comida</Text>
              <Text style={styles.popupSubtitle}>Busca y selecciona un alimento</Text>
            </View>
            <Pressable style={styles.popupCloseBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={c.textSecondary} />
            </Pressable>
          </View>

          {/* ── Buscador + botón crear ── */}
          <View style={styles.searchRow}>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={c.textMuted} />
              <TextInput
                placeholder="Buscar alimento..."
                placeholderTextColor={c.textMuted}
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
                selectTextOnFocus
              />
            </View>
            <Pressable
              style={styles.crearBtn}
              onPress={() => setCrearAlimentoModo('foto')}
              accessibilityLabel="Crear alimento"
            >
              <Ionicons name="create-outline" size={20} color={c.textSecondary} />
            </Pressable>
          </View>

          {/* ── Pestañas ── */}
          <View style={styles.tabsRow}>
            {(['base', 'favoritos', 'creados'] as const).map((t) => (
              <Pressable
                key={t}
                style={[styles.tabPressable, tab === t && styles.tabPressableActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabActive]}>
                  {t === 'base' ? 'Base de Datos' : t === 'favoritos' ? 'Favoritos' : 'Creados'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── Estados de carga ── */}
          {cargandoEnPestanaActiva && (
            <AlimentoRowSkeleton color={c.surfaceElevated} />
          )}
          {!cargandoEnPestanaActiva && cargandoApis && tab === 'base' && (
            <View style={styles.apisRow}>
              <ActivityIndicator size="small" color={c.textMuted} />
              <Text style={styles.apisText}>Buscando más resultados...</Text>
            </View>
          )}
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!okMsg && <Text style={styles.okText}>{okMsg}</Text>}

          {/* ── Lista de alimentos ── */}
          <ScrollView style={styles.scrollList} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {tab === 'base' && query.trim().length < 2 && tituloListaBaseSinBusqueda && (
              <Text style={styles.sectionTitle}>{tituloListaBaseSinBusqueda}</Text>
            )}
            {listaActual.map((food) => {
              const badge = badgeOrigenAlimento(food);
              return (
                <Pressable
                  key={food.id}
                  style={styles.foodRow}
                  onPress={() => {
                    setFoodSeleccionado(food);
                    setGramos('100');
                  }}
                >
                  <View style={styles.foodMain}>
                    <Text style={styles.foodName} numberOfLines={2}>{food.nombre}</Text>
                    {badge === 'basico' && (
                      <View style={styles.badgeWrap}>
                        <View style={styles.badgeBasico}>
                          <Text style={styles.badgeBasicoText}>Básico ✓</Text>
                        </View>
                      </View>
                    )}
                    <View style={styles.macrosRow}>
                      <Text style={styles.macroP}>{Math.round(food.proteinas)}P</Text>
                      <Text style={styles.macroDivider}> | </Text>
                      <Text style={styles.macroC}>{Math.round(food.carbohidratos)}C</Text>
                      <Text style={styles.macroDivider}> | </Text>
                      <Text style={styles.macroG}>{Math.round(food.grasas)}G</Text>
                    </View>
                  </View>

                  <View style={styles.foodRight}>
                    <View style={styles.kcalBlock}>
                      <Text style={styles.foodKcal}>{Math.round(food.calorias)}</Text>
                      <Text style={styles.foodKcalUnit}>kcal</Text>
                    </View>
                    <Pressable onPress={() => toggleFavorito(food)} hitSlop={10} style={styles.favBtn}>
                      <Ionicons
                        name={foodEsFavorito(food) ? 'star' : 'star-outline'}
                        size={20}
                        color={foodEsFavorito(food) ? '#E8A317' : c.textMuted}
                      />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
            {!cargandoEnPestanaActiva && !cargandoApis && listaActual.length === 0 && (
              <Text style={styles.emptyText}>
                {tab === 'base' && query.trim().length < 2
                  ? 'Busca alimentos para añadir.'
                  : 'Sin resultados para tu búsqueda.'}
              </Text>
            )}
          </ScrollView>

          {/* ── Botones de acción rápida ── */}
          <View style={styles.quickActionsRow}>
            <Pressable
              style={styles.quickActionBtn}
              onPress={onRegistrarPorFoto}
              accessibilityLabel="Registrar por foto"
            >
              <Ionicons name="camera-outline" size={16} color={c.primary} />
              <Text style={styles.quickActionText}>Registrar por foto</Text>
            </Pressable>
            <Pressable
              style={styles.quickActionBtn}
              onPress={() => setCrearAlimentoModo('escaner')}
              accessibilityLabel="Escanear código"
            >
              <Ionicons name="scan-outline" size={16} color={c.primary} />
              <Text style={styles.quickActionText}>Escanear código</Text>
            </Pressable>
          </View>

          <Modal visible={!!foodSeleccionado} transparent animationType="fade" onRequestClose={() => setFoodSeleccionado(null)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setFoodSeleccionado(null)}>
              <View
                style={[
                  styles.modalCard,
                  inputCantidadEnfocado && styles.modalCardKeyboardVisible,
                ]}
                onStartShouldSetResponder={() => true}
                onResponderRelease={(e) => e.stopPropagation()}
              >
                <Pressable style={styles.modalCloseBtn} onPress={() => setFoodSeleccionado(null)}>
                  <Text style={styles.closeText}>X</Text>
                </Pressable>

                <View style={styles.modalHeaderBlock}>
                  <Text style={styles.modalTitle}>Agregar alimento</Text>
                  <Text style={styles.modalSubtitle}>
                    Ajusta la cantidad para ver los valores nutricionales
                  </Text>
                </View>

                <View style={styles.nutritionPreviewCard}>
                  <View style={styles.previewFoodHeader}>
                    <Text style={styles.previewFoodName} numberOfLines={2}>
                      {foodSeleccionado?.nombre}
                    </Text>
                    <Text style={styles.previewServingText}>
                      Por {Math.round(gramosSeleccionados || 100)} g
                    </Text>
                  </View>

                  <View style={styles.previewMacrosRow}>
                    <View style={styles.previewMacroItem}>
                      <Ionicons name="flame-outline" size={17} color={c.danger} />
                      <Text style={styles.previewMacroValue}>{macrosSeleccion.calorias}</Text>
                      <Text style={styles.previewMacroLabel}>kcal</Text>
                    </View>
                    <View style={styles.previewMacroDivider} />
                    <View style={styles.previewMacroItem}>
                      <MaterialCommunityIcons
                        name="food-drumstick-outline"
                        size={17}
                        color={c.primary}
                      />
                      <Text style={styles.previewMacroValue}>
                        {formatMacro(macrosSeleccion.proteinas)}
                      </Text>
                      <Text style={styles.previewMacroLabel}>Proteínas</Text>
                    </View>
                    <View style={styles.previewMacroDivider} />
                    <View style={styles.previewMacroItem}>
                      <MaterialCommunityIcons name="barley" size={17} color={MACRO_CARBS_COLOR} />
                      <Text style={styles.previewMacroValue}>
                        {formatMacro(macrosSeleccion.carbohidratos)}
                      </Text>
                      <Text style={styles.previewMacroLabel}>Carbohidratos</Text>
                    </View>
                    <View style={styles.previewMacroDivider} />
                    <View style={styles.previewMacroItem}>
                      <Ionicons name="water-outline" size={17} color={c.macroFat} />
                      <Text style={styles.previewMacroValue}>
                        {formatMacro(macrosSeleccion.grasas)}
                      </Text>
                      <Text style={styles.previewMacroLabel}>Grasas</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.gramsFieldBlock}>
                  <Text style={styles.gramsLabel}>Cantidad en gramos</Text>
                  <View style={styles.gramosInputWrap}>
                    <TextInput
                      value={gramos}
                      onChangeText={(value) => setGramos(soloEnterosPositivos(value))}
                      keyboardType="number-pad"
                      style={styles.gramosInput}
                      placeholder="100"
                      placeholderTextColor={c.textMuted}
                      maxLength={5}
                      selectTextOnFocus
                      onFocus={() => setInputCantidadEnfocado(true)}
                      onBlur={() => setInputCantidadEnfocado(false)}
                    />
                    <Text style={styles.gramsSuffix}>g</Text>
                  </View>
                  <Text style={styles.modalHint}>
                    Ingresa la cantidad en gramos que vas a consumir.
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <Pressable style={styles.cancelBtn} onPress={() => setFoodSeleccionado(null)}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={styles.confirmBtn}
                    onPress={confirmarAgregar}
                    disabled={guardando}
                  >
                    {guardando ? (
                      <ActivityIndicator color={c.background} />
                    ) : (
                      <Text style={styles.confirmText}>Agregar y seguir</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Modal>

          <CrearAlimentoModal
            visible={crearAlimentoModo !== null}
            onClose={() => setCrearAlimentoModo(null)}
            userId={userId}
            initialMode={crearAlimentoModo ?? 'foto'}
            onFoodCreated={alimentoCreadoOResuelto}
            esFavoritoAlimento={foodEsFavorito}
            onToggleFavorito={toggleFavorito}
          />
        </View>
      </View>
    </Modal>
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

const MACRO_CARBS_COLOR = '#16C862';

function formatMacro(value: number): string {
  if (!Number.isFinite(value)) return '0 g';
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} g`;
}

function makeStyles(
  c: ReturnType<typeof useTheme>['c'],
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    /* ── Backdrop / layout ── */
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    dismissArea: {
      ...StyleSheet.absoluteFillObject,
    },
    root: {
      width: '100%',
      maxWidth: 400,
      height: '60%',
      borderRadius: 16,
      backgroundColor: c.background,
      paddingHorizontal: s.md,
      paddingTop: s.md,
      overflow: 'hidden',
    },

    /* ── Título + cerrar ── */
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    titleBlock: {
      flex: 1,
      gap: 2,
    },
    popupTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      letterSpacing: -0.4,
    },
    popupSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    popupCloseBtn: {
      width: 28,
      height: 28,
      borderRadius: r.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceElevated,
      marginTop: 2,
    },

    /* ── Buscador ── */
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    searchWrap: {
      flex: 1,
      height: 40,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      lineHeight: 18,
      fontFamily: f.sans,
      color: c.text,
      paddingVertical: 0,
    },
    crearBtn: {
      width: 40,
      height: 40,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ── Pestañas ── */
    tabsRow: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    tabPressable: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabPressableActive: {
      borderBottomColor: c.primary,
    },
    tabText: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sansMedium,
      color: c.textMuted,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    tabActive: { color: c.primary, fontFamily: f.sansBold },

    /* ── Lista ── */
    scrollList: { flex: 1 },
    stateRow: { paddingVertical: s.md, alignItems: 'center' },
    apisRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
    },
    apisText: { fontSize: 12, fontFamily: f.sans, color: c.textMuted },
    errorText: { fontSize: 12, fontFamily: f.sans, color: c.danger, paddingVertical: 4 },
    okText: { fontSize: 12, fontFamily: f.sans, color: c.success, paddingVertical: 4 },
    list: { paddingBottom: 4 },
    sectionTitle: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sansBold,
      color: c.textSecondary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      paddingTop: 10,
      paddingBottom: 6,
    },

    /* ── Fila de alimento ── */
    foodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
      paddingVertical: 10,
      gap: 8,
    },
    foodMain: { flex: 1, gap: 2 },
    foodName: {
      fontSize: 15,
      lineHeight: 20,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    badgeWrap: { flexDirection: 'row', marginTop: 1 },
    badgeBasico: {
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 4,
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    badgeBasicoText: {
      fontSize: 9,
      lineHeight: 12,
      fontFamily: f.sansBold,
      color: c.textSecondary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    macrosRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 1,
    },
    macroP: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: f.sans,
      color: c.primary,
    },
    macroC: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: f.sans,
      color: c.success,
    },
    macroG: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: f.sans,
      color: c.macroFat,
    },
    macroDivider: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: f.sans,
      color: c.textMuted,
    },
    foodRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    kcalBlock: {
      alignItems: 'flex-end',
    },
    foodKcal: {
      fontSize: 18,
      lineHeight: 22,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    foodKcalUnit: {
      fontSize: 10,
      lineHeight: 13,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    favBtn: {
      padding: 4,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: f.sans,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: s.lg,
    },

    /* ── Botones rápidos ── */
    quickActionsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    },
    quickActionBtn: {
      flex: 1,
      height: 40,
      borderRadius: r.pill,
      borderWidth: 1.5,
      borderColor: c.primary,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    quickActionText: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansMedium,
      color: c.primary,
    },

    /* ── Modal de cantidad ── */
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      paddingHorizontal: s.md,
    },
    modalCard: {
      borderRadius: r.lg,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingHorizontal: s.md,
      paddingTop: s.md,
      paddingBottom: s.md,
      gap: s.md,
    },
    modalCardKeyboardVisible: {
      transform: [{ translateY: -72 }],
    },
    modalCloseBtn: {
      position: 'absolute',
      top: s.sm,
      right: s.sm,
      width: 28,
      height: 28,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      zIndex: 2,
    },
    modalHeaderBlock: {
      paddingRight: 42,
      gap: 2,
    },
    modalTitle: {
      fontSize: 18,
      lineHeight: 23,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    modalSubtitle: {
      fontSize: 11,
      lineHeight: 15,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    nutritionPreviewCard: {
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      padding: s.sm,
      gap: s.sm,
    },
    previewFoodHeader: {
      alignItems: 'center',
      gap: 1,
    },
    previewFoodName: {
      fontSize: 15,
      lineHeight: 19,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'center',
    },
    previewServingText: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
    },
    previewMacrosRow: {
      minHeight: 58,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: 7,
    },
    previewMacroItem: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: 2,
    },
    previewMacroDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: c.borderVisible,
      marginVertical: 6,
    },
    previewMacroValue: {
      fontSize: 14,
      lineHeight: 17,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'center',
    },
    previewMacroLabel: {
      fontSize: 9,
      lineHeight: 12,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
    },
    gramsFieldBlock: {
      gap: 7,
    },
    gramsLabel: {
      fontSize: 13,
      lineHeight: 16,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    gramosInputWrap: {
      height: 44,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.surfaceElevated,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.sm,
    },
    gramosInput: {
      flex: 1,
      color: c.text,
      fontFamily: f.sans,
      fontSize: 16,
      paddingVertical: 0,
    },
    gramsSuffix: {
      fontSize: 13,
      lineHeight: 16,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    modalHint: {
      fontSize: 10,
      lineHeight: 13,
      fontFamily: f.sans,
      color: c.textMuted,
    },
    modalActions: { flexDirection: 'row', gap: s.sm, marginTop: s.xs },
    cancelBtn: {
      flex: 1,
      height: 40,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    cancelText: {
      fontSize: 13,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    confirmBtn: {
      flex: 1.55,
      height: 40,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 92,
    },
    confirmText: {
      fontSize: 13,
      fontFamily: f.sansBold,
      color: c.textOnPrimary,
    },

    /* ── Escáner ── */
    closeText: {
      fontSize: 13,
      lineHeight: 16,
      fontFamily: f.sansBold,
      color: c.textSecondary,
    },
  });
}
