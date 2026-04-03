import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Image } from 'expo-image';
import { alimentosService } from '@/services/alimentos.service';
import { useTheme } from '@/hooks/useTheme';
import type { Food } from '@/types/database.types';

export type CrearAlimentoModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string | null | undefined;
  /** Tras crear o resolver por código (OFF). */
  onFoodCreated?: (food: Food) => void;
  /** Favoritos (escáner): si faltan, no se muestra la estrella. */
  esFavoritoAlimento?: (food: Food) => boolean;
  onToggleFavorito?: (food: Food) => void | Promise<void>;
};

type CrearModo = 'foto' | 'manual' | 'escaner';

export function CrearAlimentoModal({
  visible,
  onClose,
  userId,
  onFoodCreated,
  esFavoritoAlimento,
  onToggleFavorito,
}: CrearAlimentoModalProps) {
  const { c, f, ts, s, r } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r, insets.bottom), [c, f, ts, s, r, insets.bottom]);

  const [modo, setModo] = useState<CrearModo>('foto');
  const [permission, requestPermission] = useCameraPermissions();

  const [nombreFoto, setNombreFoto] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);
  const [msgFoto, setMsgFoto] = useState<string | null>(null);
  const [guardandoFoto, setGuardandoFoto] = useState(false);

  const [manualNombre, setManualNombre] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [manualP, setManualP] = useState('');
  const [manualC, setManualC] = useState('');
  const [manualG, setManualG] = useState('');
  const [manualFibra, setManualFibra] = useState('');
  const [guardandoManual, setGuardandoManual] = useState(false);
  const [msgManual, setMsgManual] = useState<string | null>(null);

  const [codigoLeido, setCodigoLeido] = useState<string | null>(null);
  const [cargandoCodigo, setCargandoCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [foodCodigo, setFoodCodigo] = useState<Food | null>(null);
  const lastScanRef = useRef<{ data: string; t: number }>({ data: '', t: 0 });

  const cameraRef = useRef<CameraView>(null);
  const prevModoRef = useRef<CrearModo>('foto');
  /** Fuerza remontaje del escáner (evita vista negra al volver a «Escanea código» en Android). */
  const [escanerMountGen, setEscanerMountGen] = useState(0);

  const necesitaCamara = modo === 'foto' || modo === 'escaner';
  const camaraNativa = Platform.OS !== 'web';

  useEffect(() => {
    if (!visible) {
      prevModoRef.current = 'foto';
      return;
    }
    if (modo === 'escaner' && prevModoRef.current !== 'escaner') {
      setEscanerMountGen((g) => g + 1);
    }
    prevModoRef.current = modo;
  }, [visible, modo]);

  useEffect(() => {
    if (!visible) {
      setModo('foto');
      setNombreFoto('');
      setFotoUri(null);
      setMsgFoto(null);
      setGuardandoFoto(false);
      setManualNombre('');
      setManualKcal('');
      setManualP('');
      setManualC('');
      setManualG('');
      setManualFibra('');
      setMsgManual(null);
      setCodigoLeido(null);
      setErrorCodigo(null);
      setFoodCodigo(null);
      setCargandoCodigo(false);
      lastScanRef.current = { data: '', t: 0 };
    }
  }, [visible]);

  useEffect(() => {
    if (visible && necesitaCamara && camaraNativa && !permission?.granted) {
      requestPermission();
    }
  }, [visible, necesitaCamara, camaraNativa, permission?.granted, requestPermission]);

  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    const data = String(result.data ?? '').trim();
    if (!data) return;
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
        } else {
          setErrorCodigo('No encontramos este producto en Open Food Facts o faltan datos nutricionales.');
        }
      } finally {
        setCargandoCodigo(false);
      }
    })();
  }, []);

  const guardarDesdeFoto = async () => {
    if (!userId) {
      setMsgFoto('Inicia sesión para crear alimentos.');
      return;
    }
    const nombre = nombreFoto.trim();
    if (!nombre) {
      setMsgFoto('Indica el nombre del alimento.');
      return;
    }
    if (!fotoUri) {
      setMsgFoto('Haz una foto de la etiqueta antes de guardar.');
      return;
    }
    setGuardandoFoto(true);
    setMsgFoto(null);
    try {
      /** Macros en 0 hasta integrar lectura por IA desde la imagen (`fotoUri`). */
      const food = await alimentosService.crearAlimentoPersonalizado(userId, {
        nombre,
        calorias: 0,
        proteinas: 0,
        carbohidratos: 0,
        grasas: 0,
        fibra: null,
        azucar: null,
      });
      onFoodCreated?.(food);
      onClose();
    } catch (e: unknown) {
      setMsgFoto(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardandoFoto(false);
    }
  };

  const tomarFotoEtiqueta = async () => {
    if (!cameraRef.current || !camaraNativa || fotoUri) return;
    setCapturando(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.55 });
      if (pic?.uri) setFotoUri(pic.uri);
    } catch {
      /* noop */
    } finally {
      setCapturando(false);
    }
  };

  const repetirFoto = () => {
    setFotoUri(null);
    setMsgFoto(null);
  };

  const puedeGuardarFoto =
    Boolean(userId) && nombreFoto.trim().length > 0 && Boolean(fotoUri);

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
    const fib = manualFibra.trim()
      ? Number(manualFibra.replace(',', '.'))
      : null;
    if (manualFibra.trim() && (!Number.isFinite(fib) || (fib ?? 0) < 0)) {
      setMsgManual('La fibra debe ser un número válido.');
      return;
    }
    setGuardandoManual(true);
    setMsgManual(null);
    try {
      const food = await alimentosService.crearAlimentoPersonalizado(userId, {
        nombre,
        calorias: kcal,
        proteinas: p,
        carbohidratos: carb,
        grasas: gr,
        fibra: fib,
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

  /** Vista previa de la captura en el mismo recuadro que la cámara, o cámara en vivo. */
  const renderCuadroFotoEtiqueta = () => {
    if (fotoUri) {
      return (
        <View style={[styles.cameraBox, styles.cameraFlexFill]}>
          <Image source={{ uri: fotoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      );
    }
    if (!camaraNativa) {
      return (
        <View style={[styles.cameraPlaceholder, styles.cameraFlexFill]}>
          <Text style={styles.cameraPlaceholderText}>
            La cámara no está disponible en web. Usa la app en el móvil para esta función.
          </Text>
        </View>
      );
    }
    if (!permission?.granted) {
      return (
        <Pressable style={[styles.permBox, styles.cameraFlexFill]} onPress={() => requestPermission()}>
          <Ionicons name="camera-outline" size={36} color={c.textMuted} />
          <Text style={styles.permText}>Toca para permitir el acceso a la cámara</Text>
        </Pressable>
      );
    }
    return (
      <View style={[styles.cameraBox, styles.cameraFlexFill]}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          active={visible && modo === 'foto' && !fotoUri}
        />
      </View>
    );
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
        <CameraView
          key={`barcode-${escanerMountGen}`}
          style={StyleSheet.absoluteFill}
          facing="back"
          active={visible && modo === 'escaner'}
          barcodeScannerEnabled
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
          }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={styles.scanOverlay} pointerEvents="none">
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.topBar}>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Text style={styles.closeText}>X</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>Crear alimento</Text>
            <View style={styles.topBarSpacer} />
          </View>

          {modo === 'foto' && (
            <View style={styles.bodyFlex}>
              <View style={styles.fotoHeader}>
                <Text style={styles.sectionTitle}>Crea con una foto</Text>
                <Text style={styles.sectionSubtitle}>
                  Haz una foto a la etiqueta nutricional e indica el nombre. Las calorías y macros se completarán más
                  adelante con un modelo de IA a partir de la imagen; por ahora se guardan en 0.
                </Text>
                <Text style={styles.fieldLabel}>Nombre del alimento</Text>
                <TextInput
                  {...inputProps}
                  placeholder="Ej. Yogur natural Hacendado"
                  value={nombreFoto}
                  onChangeText={setNombreFoto}
                />
              </View>
              <View style={styles.fotoCameraArea}>{renderCuadroFotoEtiqueta()}</View>
              <View style={styles.fotoFooter}>
                <Pressable
                  style={[
                    styles.secondaryBtn,
                    (capturando || (!fotoUri && (!permission?.granted || !camaraNativa))) && styles.btnDisabled,
                  ]}
                  onPress={fotoUri ? repetirFoto : tomarFotoEtiqueta}
                  disabled={
                    capturando || (!fotoUri && (!permission?.granted || !camaraNativa))
                  }
                >
                  {capturando && !fotoUri ? (
                    <ActivityIndicator color={c.textDisplay} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>
                      {fotoUri ? 'Repetir foto' : 'Hacer foto a la etiqueta'}
                    </Text>
                  )}
                </Pressable>
                {!!msgFoto && <Text style={styles.msgError}>{msgFoto}</Text>}
                <Pressable
                  style={[
                    styles.primaryBtn,
                    (!puedeGuardarFoto || guardandoFoto) && styles.btnDisabled,
                  ]}
                  onPress={guardarDesdeFoto}
                  disabled={!puedeGuardarFoto || guardandoFoto}
                >
                  {guardandoFoto ? (
                    <ActivityIndicator color={c.background} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Guardar alimento</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {modo === 'manual' && (
            <ScrollView
              style={styles.bodyFlex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sectionTitle}>Añade un alimento</Text>
              <Text style={styles.sectionSubtitle}>
                Rellena el formulario con los datos del alimento (valores por 100 g).
              </Text>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                {...inputProps}
                placeholder="Nombre del alimento"
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
              <Text style={styles.fieldLabel}>Proteínas (g)</Text>
              <TextInput
                {...inputProps}
                placeholder="0"
                keyboardType="decimal-pad"
                value={manualP}
                onChangeText={setManualP}
              />
              <Text style={styles.fieldLabel}>Carbohidratos (g)</Text>
              <TextInput
                {...inputProps}
                placeholder="0"
                keyboardType="decimal-pad"
                value={manualC}
                onChangeText={setManualC}
              />
              <Text style={styles.fieldLabel}>Grasas (g)</Text>
              <TextInput
                {...inputProps}
                placeholder="0"
                keyboardType="decimal-pad"
                value={manualG}
                onChangeText={setManualG}
              />
              <Text style={styles.fieldLabel}>Fibra (g, opcional)</Text>
              <TextInput
                {...inputProps}
                placeholder="—"
                keyboardType="decimal-pad"
                value={manualFibra}
                onChangeText={setManualFibra}
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

          {modo === 'escaner' && (
            <View style={styles.bodyFlex}>
              <View style={styles.escanerHeader}>
                <Text style={styles.sectionTitle}>Escanea código de barras</Text>
                <Text style={styles.sectionSubtitle}>
                  Coloca la línea roja a lo largo del código de barras del producto.
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
              style={[styles.segmentItem, modo === 'foto' && styles.segmentItemActive]}
              onPress={() => setModo('foto')}
            >
              <Ionicons
                name="camera-outline"
                size={24}
                color={modo === 'foto' ? c.textDisplay : c.textMuted}
              />
            </Pressable>
            <Pressable
              style={[styles.segmentItem, modo === 'manual' && styles.segmentItemActive]}
              onPress={() => {
                setModo('manual');
                if (manualNombre.trim().length === 0 && nombreFoto.trim().length > 0) {
                  setManualNombre(nombreFoto.trim());
                }
              }}
            >
              <Ionicons
                name="create-outline"
                size={24}
                color={modo === 'manual' ? c.textDisplay : c.textMuted}
              />
            </Pressable>
            <Pressable
              style={[styles.segmentItem, modo === 'escaner' && styles.segmentItemActive]}
              onPress={() => setModo('escaner')}
            >
              <Ionicons
                name="scan-outline"
                size={24}
                color={modo === 'escaner' ? c.textDisplay : c.textMuted}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
      paddingHorizontal: s.xs,
      paddingTop: s.xs,
      paddingBottom: 0,
      minHeight: '100%',
    },
    dismissArea: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      height: '97%',
      maxHeight: '97%',
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.background,
      overflow: 'hidden',
      flexDirection: 'column',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.md,
      paddingTop: s.md,
      paddingBottom: s.sm,
      gap: s.sm,
    },
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
    sheetTitle: {
      flex: 1,
      textAlign: 'center',
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    topBarSpacer: { width: 42 },
    bodyFlex: {
      flex: 1,
      minHeight: 0,
    },
    scrollContent: {
      paddingHorizontal: s.md,
      paddingBottom: s.lg,
      gap: s.sm,
    },
    fotoHeader: {
      paddingHorizontal: s.md,
      paddingBottom: s.xs,
    },
    fotoCameraArea: {
      flex: 1,
      minHeight: 120,
      marginHorizontal: s.md,
      marginTop: s.xs,
    },
    fotoFooter: {
      paddingHorizontal: s.md,
      paddingTop: s.sm,
      paddingBottom: s.xs,
      gap: s.xs,
    },
    escanerHeader: {
      paddingHorizontal: s.md,
      paddingBottom: s.xs,
    },
    escanerCameraWrap: {
      flex: 1,
      minHeight: 140,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: s.sm,
    },
    escanerBottomScroll: {
      flexGrow: 0,
      maxHeight: 240,
      paddingHorizontal: s.md,
    },
    escanerBottomContent: {
      paddingBottom: s.md,
      gap: s.sm,
    },
    sectionTitle: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      marginTop: s.xs,
    },
    sectionSubtitle: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
      lineHeight: 20,
      marginBottom: s.xs,
    },
    fieldLabel: { ...ts.caption, fontFamily: f.mono, color: c.textMuted, marginTop: s.xs },
    fieldInput: {
      height: 46,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      color: c.textDisplay,
      fontFamily: f.sans,
      ...ts.body,
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
      minHeight: 140,
      width: '100%',
      alignSelf: 'stretch',
    },
    cameraScanSized: {
      width: '92%',
      maxWidth: 420,
      height: 256,
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
      height: 3,
      backgroundColor: '#E53935',
      borderRadius: 2,
      shadowColor: '#f00',
      shadowOpacity: 0.6,
      shadowRadius: 6,
    },
    secondaryBtn: {
      marginTop: s.xs,
      height: 46,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    secondaryBtnText: { ...ts.label, fontFamily: f.mono, color: c.textDisplay },
    primaryBtn: {
      marginTop: s.sm,
      height: 48,
      borderRadius: r.pill,
      backgroundColor: c.textDisplay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { ...ts.label, fontFamily: f.monoBold, color: c.background },
    btnDisabled: { opacity: 0.55 },
    msgError: { ...ts.caption, fontFamily: f.mono, color: c.danger, marginTop: s.xs },
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
      paddingBottom: Math.max(s.md, insetBottom + s.sm),
      gap: s.sm,
      backgroundColor: c.background,
    },
    segmentItem: {
      flex: 1,
      height: 52,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentItemActive: {
      borderColor: c.textDisplay,
      backgroundColor: c.surfaceElevated,
    },
  });
}
