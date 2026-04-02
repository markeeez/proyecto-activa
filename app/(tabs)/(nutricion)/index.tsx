import { useMemo } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNutricion } from '@/hooks/useNutricion';
import { useTheme } from '@/hooks/useTheme';

type MacroKey = 'proteinas' | 'carbos' | 'grasas';

export default function NutricionIndex() {
  const { c, f, ts, s, r } = useTheme();
  const { fecha, cambiarFecha, resumen, objetivos, cargando } = useNutricion();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const fechaSeleccionada = new Date(`${fecha}T00:00:00`);
  const fechaLabel = fechaSeleccionada.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });
  const objetivoCalorias = objetivos?.calorias_objetivo ?? 2000;
  const totalCalorias = resumen?.totalCalorias ?? 0;
  const totalProteinas = resumen?.totalProteinas ?? 0;
  const totalCarbos = resumen?.totalCarbos ?? 0;
  const totalGrasas = resumen?.totalGrasas ?? 0;
  const comidas = resumen?.comidas ?? [];
  const progresoCalorias = Math.min(1, totalCalorias / Math.max(1, objetivoCalorias));

  const semana = getSemanaMovil(fecha);
  const macros = {
    proteinas: {
      label: 'PROTEINAS',
      actual: totalProteinas,
      objetivo: objetivos?.proteinas_objetivo ?? 0,
    },
    carbos: {
      label: 'CARBOS',
      actual: totalCarbos,
      objetivo: objetivos?.carbos_objetivo ?? 0,
    },
    grasas: {
      label: 'GRASAS',
      actual: totalGrasas,
      objetivo: objetivos?.grasas_objetivo ?? 0,
    },
  };

  return (
    <View style={styles.root}>
      {cargando && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={c.primary} />
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.weekCalendar}>
          {semana.map((d, index) => (
            <Pressable
              key={`${d.key}-${d.dia}-${index}`}
              style={[styles.dayItem, d.activo && styles.dayItemActive]}
              onPress={() => cambiarFecha(d.fechaIso)}
            >
              <Text style={[styles.dayLetter, d.activo && styles.dayLetterActive]}>{d.key}</Text>
              <Text style={[styles.dayNumber, d.activo && styles.dayNumberActive]}>{d.dia}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryValue}>
              {Math.round(totalCalorias)}
              <Text style={styles.summaryUnit}> KCAL</Text>
            </Text>
            <Text style={styles.summaryGoal}>{fechaLabel.toUpperCase()}</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progresoCalorias * 100}%` }]} />
          </View>

          <Text style={styles.summaryGoal}>OBJETIVO: {Math.round(objetivoCalorias)} KCAL</Text>

          {(['proteinas', 'carbos', 'grasas'] as MacroKey[]).map((macro) => {
            const data = macros[macro];
            const porcentaje = data.objetivo > 0 ? Math.min(1, data.actual / data.objetivo) : 0;
            return (
              <View key={macro} style={styles.macroRow}>
                <Text style={styles.macroLabel}>{data.label}</Text>
                <Text style={styles.macroValue}>
                  {Math.round(data.actual)} / {Math.round(data.objetivo)}g
                </Text>
                <View style={styles.macroTrack}>
                  <View style={[styles.macroFill, { width: `${porcentaje * 100}%` }]} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.mealsBlock}>
          <Text style={styles.sectionTitle}>COMIDAS DEL DIA</Text>
          {comidas.map((meal) => (
            <View key={meal.mealId} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTitle}>{meal.mealType?.nombre ?? 'Comida'}</Text>
                <Text style={styles.mealMeta}>
                  {Math.round(meal.totalCalorias)} KCAL  -  {Math.round(meal.totalProteinas)}P  |  {Math.round(meal.totalCarbos)}C  |  {Math.round(meal.totalGrasas)}G
                </Text>
              </View>

              <View style={styles.mealItemsList}>
                {meal.items.map((item) => (
                  <View key={item.id} style={styles.foodRow}>
                    <View style={styles.foodMain}>
                      <Text style={styles.foodName}>{item.food?.nombre ?? 'Alimento'}</Text>
                      <Text style={styles.foodMeta}>
                        {Math.round(item.gramos)}g  -  {Math.round(item.calorias_calculadas)} kcal
                      </Text>
                    </View>
                    <Text style={styles.foodMacros}>
                      {Math.round(item.proteinas_calculadas)}P / {Math.round(item.carbos_calculados)}C / {Math.round(item.grasas_calculadas)}G
                    </Text>
                  </View>
                ))}
                {meal.items.length === 0 && (
                  <Text style={styles.emptyMealText}>Todavia no hay alimentos en esta comida.</Text>
                )}
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => router.push({
                    pathname: '/(tabs)/(nutricion)/agregar',
                    params: { mealTypeId: meal.mealType?.id, mealId: meal.mealId, fecha },
                  })}
                >
                  <Text style={styles.addBtnText}>+</Text>
                </Pressable>

                <View style={styles.queryBox}>
                  <TextInput
                    placeholder="Consulta tus dudas aquí"
                    placeholderTextColor={c.textMuted}
                    style={styles.queryInput}
                    editable={false}
                  />
                </View>
              </View>
            </View>
          ))}
          {comidas.length === 0 && (
            <View style={styles.mealCard}>
              <Text style={styles.emptyMealText}>No hay comidas registradas para este dia.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function getSemanaMovil(fechaIso: string) {
  const base = new Date(`${fechaIso}T00:00:00`);
  const day = base.getDay(); // 0 domingo
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);

  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    return {
      key: days[i],
      dia: d.getDate(),
      activo: iso === fechaIso,
      fechaIso: iso,
    };
  });
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
    loadingOverlay: {
      position: 'absolute',
      top: 12,
      right: 20,
      zIndex: 10,
    },
    scroll: {
      paddingHorizontal: s.lg,
      paddingTop: s.xl,
      paddingBottom: s['3xl'],
      gap: s.lg,
    },
    weekCalendar: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      paddingHorizontal: s.sm,
      paddingVertical: s.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dayItem: {
      width: 36,
      paddingVertical: s.xs,
      borderRadius: r.pill,
      alignItems: 'center',
      gap: 2,
    },
    dayItemActive: {
      backgroundColor: c.textDisplay,
    },
    dayLetter: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.7,
    },
    dayLetterActive: {
      color: c.background,
    },
    dayNumber: {
      ...ts.caption,
      fontFamily: f.monoBold,
      color: c.textDisplay,
    },
    dayNumberActive: {
      color: c.background,
    },
    summaryCard: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      gap: s.sm,
    },
    summaryTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    summaryValue: {
      ...ts.heading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    summaryUnit: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    summaryGoal: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.7,
    },
    progressTrack: {
      height: 7,
      backgroundColor: c.primaryBg,
      borderRadius: r.pill,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: c.primary,
      borderRadius: r.pill,
    },
    macroRow: {
      gap: s.xs,
    },
    macroLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: ts.label.letterSpacing,
    },
    macroValue: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.text,
    },
    macroTrack: {
      height: 6,
      backgroundColor: c.separator,
      borderRadius: r.pill,
      overflow: 'hidden',
    },
    macroFill: {
      height: '100%',
      backgroundColor: c.primary,
      borderRadius: r.pill,
    },
    mealsBlock: {
      gap: s.sm,
    },
    sectionTitle: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: ts.label.letterSpacing,
    },
    mealCard: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      paddingVertical: s.md,
      gap: s.md,
    },
    mealHeader: {
      gap: s.xs,
    },
    mealItemsList: {
      gap: s.sm,
    },
    foodRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: s.md,
    },
    foodMain: {
      flex: 1,
    },
    mealTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    mealMeta: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.4,
    },
    foodName: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    foodMeta: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
    },
    foodMacros: {
      ...ts.caption,
      fontFamily: f.monoBold,
      color: c.primary,
    },
    emptyMealText: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      marginTop: s.xs,
    },
    addBtn: {
      width: '30%',
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textDisplay,
      letterSpacing: 0.8,
      fontSize: 12,
    },
    queryBox: {
      width: '70%',
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      height: 42,
      justifyContent: 'center',
      paddingHorizontal: s.md,
    },
    queryInput: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
    },
  });
}
