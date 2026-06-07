import { useTheme } from '@/hooks/useTheme';
import { alimentosService } from '@/services/alimentos.service';
import type { Food } from '@/types/database.types';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type CrearAlimentoModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string | null | undefined;
  /** Pestaña inicial al abrir (por defecto 'manual'). */
  initialMode?: CrearModo;
  /** Tras crear o resolver por código (OFF). */
  onFoodCreated?: (food: Food) => void;
  /** Favoritos (escáner): si faltan, no se muestra la estrella. */
  esFavoritoAlimento?: (food: Food) => boolean;
  onToggleFavorito?: (food: Food) => void | Promise<void>;
};

export type CrearModo = 'foto' | 'manual' | 'escaner';

const BarcodeCameraView = CameraView as unknown as ComponentType<any>;

export function CrearAlimentoModal({
  visible,
  onClose,
  userId,
  initialMode = 'manual',
  onFoodCreated,
  esFavoritoAlimento,
  onToggleFavorito,
}: CrearAlimentoModalProps) {
  const { c, f, ts, s, r } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r, insets.bottom), [c, f, ts, s, r, insets.bottom]);

  const [modo, setModo] = useState<CrearModo>('manual');
  const [permission, requestPermission] = useCameraPermissions();

  const [manualNombre, setManualNombre] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [manualP, setManualP] = useState('');
  const [manualC, setManualC] = useState('');
  const [manualG, setManualG] = useState('');
  const [guardandoManual, setGuardandoManual] = useState(false);
  const [msgManual, setMsgManual] = useState<string | null>(null);
  const [mostrarAvisoKcal, setMostrarAvisoKcal] = useState(false);
  const [kcalCalculadas, setKcalCalculadas] = useState(0);

  const [codigoLeido, setCodigoLeido] = useState<string | null>(null);
  const [cargandoCodigo, setCargandoCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [foodCodigo, setFoodCodigo] = useState<Food | null>(null);
  const lastScanRef = useRef<{ data: string; t: number }>({ data: '', t: 0 });

  const prevModoRef = useRef<CrearModo>('manual');
  /**
   * Fuerza remontaje de cualquier CameraView al cambiar de pestaña.
   * Evita la pantalla negra en Android/iOS cuando la cámara no se
   * reactiva tras liberar el recurso de hardware entre foto ↔ escáner.
   */
  const [cameraMountGen, setCameraMountGen] = useState(0);

  const necesitaCamara = modo === 'foto' || modo === 'escaner';
  const camaraNativa = Platform.OS !== 'web';

  useEffect(() => {
    if (!visible) {
      prevModoRef.current = 'manual';
      return;
    }
    // Cada vez que se entra a una pestaña con cámara desde otra pestaña, forzar remontaje
    const vieneDeOtra = prevModoRef.current !== modo;
    if (vieneDeOtra && (modo === 'foto' || modo === 'escaner')) {
      setCameraMountGen((g) => g + 1);
    }
    prevModoRef.current = modo;
  }, [visible, modo]);

  useEffect(() => {
    if (!visible) {
      setModo(initialMode);
      setManualNombre('');
      setManualKcal('');
      setManualP('');
      setManualC('');
      setManualG('');
      setMsgManual(null);
      setMostrarAvisoKcal(false);
      setKcalCalculadas(0);
      setCodigoLeido(null);
      setErrorCodigo(null);
      setFoodCodigo(null);
      setCargandoCodigo(false);
      lastScanRef.current = { data: '', t: 0 };
    } else {
      setModo(initialMode);
    }
  }, [visible, initialMode]);

  useEffect(() => {
    if (visible && necesitaCamara && camaraNativa && !permission?.granted) {
      requestPermission();
    }
  }, [visible, necesitaCamara, camaraNativa, permission?.granted, requestPermission]);

  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    const data = String(result.data ?? '').trim();
    if (!data) return;
    // Bloquea cualquier nuevo escaneo mientras se procesa el actual o ya se encontró un producto.
    if (cargandoCodigo || foodCodigo) return;
    const now = Date.now();
    if (data === lastScanRef.current.data && now - lastScanRef.current.t < 2200) return;
    lastScanRef.current = { data, t: now };
    setCodigoLeido(data);
    setErrorCodigo(null);
    setFoodCodigo(null);
    setCargandoCodigo(true);
    void (async () => {
      try {
        const food = await alimentosService.resolverProductoPorCodigoBarras(data);
        if (food) {
          setFoodCodigo(food);
          // Cierra el modal de escáner y entrega el alimento al padre, que abrirá
          // el modal de cantidad. Así apagamos la cámara en cuanto hay match.
          onFoodCreated?.(food);
          onClose();
        } else {
          setErrorCodigo('No encontramos este producto en Open Food Facts o faltan datos nutricionales.');
        }
      } finally {
        setCargandoCodigo(false);
      }
    })();
  }, [cargandoCodigo, foodCodigo, onFoodCreated, onClose]);

  /** Valida macros vs kcal y guarda o muestra aviso. */
  const guardarManual = async () => {
    if (!userId) {
      setMsgManual('Inicia sesión para crear alimentos.');
      return;
    }
    const nombre = manualNombre.trim();
    if (!nombre) {
      setMsgManual('Indica el nombre del alimento.');
      return;
    }
    const kcal = Number(manualKcal.replace(',', '.'));
    const p = Number(manualP.replace(',', '.'));
    const carb = Number(manualC.replace(',', '.'));
    const gr = Number(manualG.replace(',', '.'));
    if (![kcal, p, carb, gr].every((n) => Number.isFinite(n) && n >= 0)) {
      setMsgManual('Revisa calorías y macros (números válidos).');
      return;
    }
    // Validación invisible: P*4 + C*4 + G*9
    const kcalEsperadas = p * 4 + carb * 4 + gr * 9;
    if (Math.abs(kcal - kcalEsperadas) > 20) {
      setKcalCalculadas(Math.round(kcalEsperadas));
      setMostrarAvisoKcal(true);
      return;
    }
    await ejecutarGuardadoManual(nombre, kcal, p, carb, gr);
  };

  /** Guarda el alimento con los valores proporcionados. */
  const ejecutarGuardadoManual = async (
    nombre: string,
    kcal: number,
    p: number,
    carb: number,
    gr: number,
  ) => {
    setGuardandoManual(true);
    setMsgManual(null);
    try {
      const food = await alimentosService.crearAlimentoPersonalizado(userId!, {
        nombre,
        calorias: kcal,
        proteinas: p,
        carbohidratos: carb,
        grasas: gr,
        fibra: null,
        azucar: null,
      });
      onFoodCreated?.(food);
      onClose();
    } catch (e: unknown) {
      setMsgManual(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardandoManual(false);
    }
  };

  /** El usuario confirma guardar con las kcal que introdujo (aunque no cuadren). */
  const confirmarConKcalUsuario = () => {
    setMostrarAvisoKcal(false);
    const kcal = Number(manualKcal.replace(',', '.'));
    const p = Number(manualP.replace(',', '.'));
    const carb = Number(manualC.replace(',', '.'));
    const gr = Number(manualG.replace(',', '.'));
    void ejecutarGuardadoManual(manualNombre.trim(), kcal, p, carb, gr);
  };

  /** Recalcula: pone las kcal correctas en el campo y cierra el aviso. */
  const recalcularKcal = () => {
    setManualKcal(String(kcalCalculadas));
    setMostrarAvisoKcal(false);
  };

  const renderCamaraEscaner = () => {
    if (!camaraNativa) {
      return (
        <View style={styles.cameraScanSized}>
          <Text style={styles.cameraPlaceholderText}>
            El escáner de códigos requiere la app en iOS o Android.
          </Text>
        </View>
      );
    }
    if (!permission?.granted) {
      return (
        <Pressable style={styles.cameraScanSized} onPress={() => requestPermission()}>
          <Ionicons name="barcode-outline" size={36} color={c.textMuted} />
          <Text style={styles.permText}>Toca para permitir el acceso a la cámara</Text>
        </Pressable>
      );
    }
    return (
      <View style={styles.cameraScanSized}>
        <BarcodeCameraView
          key={`barcode-${cameraMountGen}`}
          style={StyleSheet.absoluteFill}
          facing="back"
          active={visible && modo === 'escaner' && !cargandoCodigo && !foodCodigo}
          barcodeScannerEnabled={!cargandoCodigo && !foodCodigo}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
          }}
          onBarcodeScanned={cargandoCodigo || foodCodigo ? undefined : handleBarcodeScanned}
        />
        <View style={styles.scanOverlay} pointerEvents="none">
          <ScannerCorners styles={styles} />
          <View style={styles.scanLine} />
        </View>
      </View>
    );
  };

  const inputProps = {
    placeholderTextColor: c.textMuted,
    style: styles.fieldInput,
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.topBar}>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={c.textSecondary} />
            </Pressable>
            <Text style={styles.sheetTitle}>Crear alimento</Text>
            <View style={styles.topBarSpacer} />
          </View>

          {modo === 'manual' && (
            <ScrollView
              style={styles.bodyFlex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modeHeading}>
                <Text style={styles.sectionTitle}>Añade un alimento</Text>
                <View style={styles.modeIcon}>
                  <Ionicons name="create-outline" size={17} color={c.primary} />
                </View>
              </View>
              <Text style={styles.sectionSubtitle}>
                Rellena el formulario con los datos del alimento (valores por 100 g).
              </Text>
              <Text style={styles.fieldLabel}>Nombre del alimento</Text>
              <TextInput
                {...inputProps}
                placeholder="Ej. Avena en copos"
                value={manualNombre}
                onChangeText={setManualNombre}
              />
              <Text style={styles.fieldLabel}>Calorías (kcal / 100g)</Text>
              <TextInput
                {...inputProps}
                placeholder="0"
                keyboardType="decimal-pad"
                value={manualKcal}
                onChangeText={setManualKcal}
              />
              <Text style={styles.fieldLabel}>Proteínas (g / 100g)</Text>
              <TextInput
                {...inputProps}
                placeholder="0"
                keyboardType="decimal-pad"
                value={manualP}
                onChangeText={setManualP}
              />
              <Text style={styles.fieldLabel}>Carbohidratos (g / 100g)</Text>
              <TextInput
                {...inputProps}
                placeholder="0"
                keyboardType="decimal-pad"
                value={manualC}
                onChangeText={setManualC}
              />
              <Text style={styles.fieldLabel}>Grasas (g / 100g)</Text>
              <TextInput
                {...inputProps}
                placeholder="0"
                keyboardType="decimal-pad"
                value={manualG}
                onChangeText={setManualG}
              />
              {!!msgManual && <Text style={styles.msgError}>{msgManual}</Text>}
              <Pressable
                style={[styles.primaryBtn, guardandoManual && styles.btnDisabled]}
                onPress={guardarManual}
                disabled={guardandoManual}
              >
                {guardandoManual ? (
                  <ActivityIndicator color={c.background} />
                ) : (
                  <Text style={styles.primaryBtnText}>Guardar alimento</Text>
                )}
              </Pressable>
            </ScrollView>
          )}

          {mostrarAvisoKcal && (
            <View style={styles.kcalOverlay}>
              <View style={styles.kcalCard}>
                <View style={styles.kcalIconWrap}>
                  <Ionicons name="warning-outline" size={28} color={c.warning} />
                </View>
                <Text style={styles.kcalTitle}>Los macros no cuadran</Text>
                <Text style={styles.kcalBody}>
                  Has introducido{' '}
                  <Text style={styles.kcalBold}>{manualKcal} kcal</Text>, pero según los macros
                  (P×4 + C×4 + G×9) deberían ser aprox.{' '}
                  <Text style={styles.kcalBold}>{kcalCalculadas} kcal</Text>.
                </Text>
                <View style={styles.kcalActions}>
                  <Pressable style={styles.primaryBtn} onPress={recalcularKcal}>
                    <Ionicons name="calculator-outline" size={17} color={c.textOnPrimary} />
                    <Text style={styles.primaryBtnText}>Recalcular ({kcalCalculadas} kcal)</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={confirmarConKcalUsuario}>
                    <Text style={styles.secondaryBtnText}>Confirmar de todos modos</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {modo === 'escaner' && (
            <View style={styles.bodyFlex}>
              <View style={styles.escanerHeader}>
                <View style={styles.modeHeading}>
                  <Text style={styles.sectionTitle}>Escanea código de barras</Text>
                  <View style={styles.modeIcon}>
                    <Ionicons name="barcode-outline" size={17} color={c.primary} />
                  </View>
                </View>
                <Text style={styles.sectionSubtitle}>
                  Coloca la línea sobre el código de barras del producto.
                </Text>
              </View>
              <View style={styles.escanerCameraWrap}>
                {renderCamaraEscaner()}
              </View>
              <ScrollView
                style={styles.escanerBottomScroll}
                contentContainerStyle={styles.escanerBottomContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.aiNote}>
                  <Ionicons name="sparkles-outline" size={18} color={c.primary} />
                  <Text style={styles.aiNoteText}>
                    Scanner inteligente.{'\n'}Detectamos el código automáticamente y buscaremos la información del alimento al instante.
                  </Text>
                </View>
                {cargandoCodigo && (
                  <View style={styles.inlineLoading}>
                    <ActivityIndicator color={c.primary} />
                    <Text style={styles.inlineLoadingText}>Buscando producto…</Text>
                  </View>
                )}
                {!!codigoLeido && (
                  <Text style={styles.codigoText}>
                    Código: <Text style={styles.codigoMono}>{codigoLeido}</Text>
                  </Text>
                )}
                {!!foodCodigo && (
                  <View style={styles.foundBox}>
                    <Text style={styles.foundTitle}>Producto encontrado</Text>
                    <View style={styles.foundNameRow}>
                      <Text style={styles.foundName} numberOfLines={4}>
                        {foodCodigo.nombre}
                      </Text>
                      {userId && esFavoritoAlimento && onToggleFavorito && (
                        <Pressable
                          style={styles.foundFavBtn}
                          hitSlop={10}
                          onPress={() => {
                            void onToggleFavorito(foodCodigo);
                          }}
                        >
                          <Text style={styles.foundFavText}>
                            {esFavoritoAlimento(foodCodigo) ? '★' : '☆'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                    <Text style={styles.foundMeta}>
                      {Math.round(foodCodigo.calorias)} kcal · {Math.round(foodCodigo.proteinas)}P ·{' '}
                      {Math.round(foodCodigo.carbohidratos)}C · {Math.round(foodCodigo.grasas)}G
                    </Text>
                    <Pressable
                      style={styles.primaryBtn}
                      onPress={() => {
                        onFoodCreated?.(foodCodigo);
                        onClose();
                      }}
                    >
                      <Text style={styles.primaryBtnText}>Usar este alimento</Text>
                    </Pressable>
                  </View>
                )}
                {!!errorCodigo && <Text style={styles.msgError}>{errorCodigo}</Text>}
              </ScrollView>
            </View>
          )}

          <View style={styles.segmentWrap}>
            <Pressable
              style={[styles.segmentItem, modo === 'manual' && styles.segmentItemActive]}
              onPress={() => setModo('manual')}
            >
              <Ionicons
                name="create-outline"
                size={22}
                color={modo === 'manual' ? c.primary : c.textMuted}
              />
              <Text style={[styles.segmentLabel, modo === 'manual' && styles.segmentLabelActive]}>MANUAL</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentItem, modo === 'escaner' && styles.segmentItemActive]}
              onPress={() => setModo('escaner')}
            >
              <Ionicons
                name="barcode-outline"
                size={22}
                color={modo === 'escaner' ? c.primary : c.textMuted}
              />
              <Text style={[styles.segmentLabel, modo === 'escaner' && styles.segmentLabelActive]}>CÓDIGO</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type CrearAlimentoStyles = ReturnType<typeof makeStyles>;

function ScannerCorners({ styles }: { styles: CrearAlimentoStyles }) {
  return (
    <View style={styles.cornerLayer} pointerEvents="none">
      <View style={[styles.corner, styles.cornerTopLeft]} />
      <View style={[styles.corner, styles.cornerTopRight]} />
      <View style={[styles.corner, styles.cornerBottomLeft]} />
      <View style={[styles.corner, styles.cornerBottomRight]} />
    </View>
  );
}

function makeStyles(
  c: ReturnType<typeof useTheme>['c'],
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
  insetBottom: number,
) {
  return StyleSheet.create({
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
    sheet: {
      width: '100%',
      maxWidth: 400,
      height: '88%',
      borderRadius: 16,
      backgroundColor: c.background,
      overflow: 'hidden',
      flexDirection: 'column',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.md,
      paddingTop: s.md,
      paddingBottom: 12,
      gap: s.sm,
    },
    closeBtn: {
      width: 28,
      height: 28,
      borderRadius: r.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceElevated,
    },
    closeText: { fontSize: 13, lineHeight: 16, fontFamily: f.sansBold, color: c.textSecondary },
    sheetTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      lineHeight: 23,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    topBarSpacer: { width: 28 },
    bodyFlex: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: s.md,
    },
    scrollContent: {
      paddingBottom: s.sm,
      gap: 7,
    },
    fotoHeader: {
      paddingBottom: s.xs,
    },
    fotoCameraArea: {
      flex: 1,
      minHeight: 140,
      marginTop: s.sm,
    },
    fotoFooter: {
      paddingTop: s.sm,
      paddingBottom: s.xs,
      gap: s.xs,
    },
    escanerHeader: {
      paddingBottom: s.xs,
    },
    escanerCameraWrap: {
      flex: 1,
      minHeight: 180,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: s.xs,
    },
    escanerBottomScroll: {
      flexGrow: 0,
      maxHeight: 220,
    },
    escanerBottomContent: {
      paddingBottom: s.xs,
      gap: s.sm,
    },
    escanerFooter: {
      paddingTop: s.sm,
      paddingBottom: s.xs,
    },
    modeHeading: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.sm,
      marginTop: s.xs,
    },
    modeIcon: {
      width: 30,
      height: 30,
      borderRadius: r.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primaryBg,
    },
    sectionTitle: {
      fontSize: 16,
      lineHeight: 21,
      letterSpacing: 0,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      flex: 1,
    },
    sectionSubtitle: {
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginBottom: s.xs,
    },
    fieldLabel: {
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 0,
      fontFamily: f.sansMedium,
      color: c.textMuted,
      marginTop: s.xs,
    },
    fieldInput: {
      height: 40,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      color: c.textDisplay,
      fontFamily: f.sans,
      fontSize: 14,
      lineHeight: 18,
      letterSpacing: 0,
    },
    cameraBox: {
      borderRadius: r.lg,
      overflow: 'hidden',
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    cameraFlexFill: {
      flex: 1,
      minHeight: 96,
      width: '100%',
      alignSelf: 'stretch',
    },
    cameraScanSized: {
      width: '100%',
      height: '100%',
      minHeight: 128,
      borderRadius: r.lg,
      overflow: 'hidden',
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraPlaceholder: {
      borderRadius: r.lg,
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      padding: s.md,
    },
    cameraPlaceholderText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
    },
    permBox: {
      borderRadius: r.lg,
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
      padding: s.md,
    },
    permText: { ...ts.bodySm, fontFamily: f.sans, color: c.textSecondary, textAlign: 'center' },
    scanOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanLine: {
      width: '88%',
      height: 2,
      backgroundColor: c.primary,
      borderRadius: 2,
      shadowColor: c.primary,
      shadowOpacity: 0.8,
      shadowRadius: 8,
    },
    secondaryBtn: {
      marginTop: s.xs,
      height: 40,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    secondaryBtnText: {
      fontSize: 12,
      lineHeight: 15,
      letterSpacing: 0,
      fontFamily: f.sansBold,
      color: c.primary,
    },
    primaryBtn: {
      marginTop: s.xs,
      height: 40,
      borderRadius: r.pill,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    primaryBtnText: {
      fontSize: 12,
      lineHeight: 15,
      letterSpacing: 0,
      fontFamily: f.sansBold,
      color: c.textOnPrimary,
    },
    saveBtn: {
      backgroundColor: c.surfaceElevated,
    },
    saveBtnText: {
      color: c.textMuted,
    },
    btnDisabled: { opacity: 0.55 },
    msgError: { ...ts.caption, fontFamily: f.mono, color: c.danger, marginTop: s.xs },
    aiNote: {
      minHeight: 40,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
      paddingHorizontal: s.md,
      paddingVertical: 7,
      marginTop: s.sm,
    },
    aiNoteText: {
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      lineHeight: 16,
      letterSpacing: 0,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    photoHintRow: {
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
      paddingHorizontal: s.xs,
    },
    photoHintText: {
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 0,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    photoCaptureButton: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoCaptureInner: {
      width: 56,
      height: 56,
      borderRadius: r.pill,
      borderWidth: 3,
      borderColor: c.primary,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cornerLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    corner: {
      position: 'absolute',
      width: 24,
      height: 24,
      borderColor: c.primary,
    },
    cornerTopLeft: {
      top: 16,
      left: 16,
      borderTopWidth: 3,
      borderLeftWidth: 3,
      borderTopLeftRadius: r.sm,
    },
    cornerTopRight: {
      top: 16,
      right: 16,
      borderTopWidth: 3,
      borderRightWidth: 3,
      borderTopRightRadius: r.sm,
    },
    cornerBottomLeft: {
      bottom: 16,
      left: 16,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
      borderBottomLeftRadius: r.sm,
    },
    cornerBottomRight: {
      bottom: 16,
      right: 16,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderBottomRightRadius: r.sm,
    },
    inlineLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      marginTop: s.sm,
    },
    inlineLoadingText: { ...ts.bodySm, fontFamily: f.sans, color: c.textSecondary },
    codigoText: { ...ts.bodySm, fontFamily: f.sans, color: c.textSecondary, marginTop: s.xs },
    codigoMono: { fontFamily: f.mono, color: c.textDisplay },
    foundBox: {
      marginTop: s.sm,
      padding: s.md,
      borderRadius: r.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.success + '44',
    },
    foundTitle: { ...ts.caption, fontFamily: f.monoBold, color: c.success, marginBottom: 4 },
    foundNameRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
    },
    foundName: {
      flex: 1,
      minWidth: 0,
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    foundFavBtn: { paddingHorizontal: 4, paddingVertical: 2 },
    foundFavText: {
      color: c.warning,
      fontSize: 20,
      lineHeight: 22,
      fontFamily: f.monoBold,
    },
    foundMeta: { ...ts.caption, fontFamily: f.mono, color: c.textSecondary, marginTop: 4 },
    segmentWrap: {
      flexDirection: 'row',
      flexShrink: 0,
      borderTopWidth: 1,
      borderTopColor: c.separator,
      paddingHorizontal: s.md,
      paddingTop: s.sm,
      paddingBottom: Math.max(12, Math.min(20, insetBottom + s.sm)),
      gap: 8,
      backgroundColor: c.background,
    },
    segmentItem: {
      flex: 1,
      height: 44,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    segmentItemActive: {
      borderColor: c.primary,
      backgroundColor: c.surface,
    },
    segmentLabel: {
      fontSize: 9,
      lineHeight: 12,
      letterSpacing: 0,
      fontFamily: f.sansBold,
      color: c.textMuted,
    },
    segmentLabelActive: {
      color: c.primary,
    },
    kcalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: s.lg,
      zIndex: 10,
      borderRadius: 16,
    },
    kcalCard: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: c.background,
      borderRadius: r.lg,
      padding: s.lg,
      alignItems: 'center',
      gap: s.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    kcalIconWrap: {
      width: 48,
      height: 48,
      borderRadius: r.pill,
      backgroundColor: c.warningBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: s.xs,
    },
    kcalTitle: {
      fontSize: 16,
      lineHeight: 21,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'center',
    },
    kcalBody: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
    },
    kcalBold: {
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    kcalActions: {
      width: '100%',
      gap: s.xs,
      marginTop: s.xs,
    },
  });
}
