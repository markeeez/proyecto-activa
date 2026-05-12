import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

function usePulse() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
}

/** Fila ejercicio: thumbnail cuadrado + nombre + 2 chips meta */
export function EjercicioRowSkeleton({ color, count = 8 }: { color: string; count?: number }) {
  const opacity = usePulse();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={[skRow.row, { opacity }]}>
          <View style={[skRow.thumb, { backgroundColor: color }]} />
          <View style={skRow.body}>
            <View style={[skRow.title, { backgroundColor: color, width: i % 3 === 0 ? '75%' : i % 3 === 1 ? '60%' : '85%' }]} />
            <View style={skRow.meta}>
              <View style={[skRow.chip, { backgroundColor: color, width: 70 }]} />
              <View style={[skRow.chip, { backgroundColor: color, width: 50 }]} />
            </View>
          </View>
        </Animated.View>
      ))}
    </>
  );
}

const skRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: 8,
  },
  title: {
    height: 13,
    borderRadius: 6,
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    height: 10,
    borderRadius: 5,
  },
});

/** Fila alimento: nombre + chips macro a la izquierda, bloque kcal a la derecha */
export function AlimentoRowSkeleton({ color, count = 7 }: { color: string; count?: number }) {
  const opacity = usePulse();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={[skFood.row, { opacity }]}>
          <View style={skFood.main}>
            <View style={[skFood.name, { backgroundColor: color, width: i % 3 === 0 ? '70%' : i % 3 === 1 ? '55%' : '80%' }]} />
            <View style={skFood.macros}>
              <View style={[skFood.macro, { backgroundColor: color, width: 28 }]} />
              <View style={[skFood.macro, { backgroundColor: color, width: 28 }]} />
              <View style={[skFood.macro, { backgroundColor: color, width: 28 }]} />
            </View>
          </View>
          <View style={skFood.right}>
            <View style={[skFood.kcal, { backgroundColor: color }]} />
            <View style={[skFood.star, { backgroundColor: color }]} />
          </View>
        </Animated.View>
      ))}
    </>
  );
}

const skFood = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  main: { flex: 1, gap: 7 },
  name: { height: 13, borderRadius: 6 },
  macros: { flexDirection: 'row', gap: 8 },
  macro: { height: 10, borderRadius: 5 },
  right: { alignItems: 'flex-end', gap: 6 },
  kcal: { width: 36, height: 16, borderRadius: 6 },
  star: { width: 20, height: 20, borderRadius: 10 },
});

/** Card rutina: título + chip dificultad + línea músculos + métrica + footer */
export function RutinaCardSkeleton({ color, borderColor, surface, count = 5 }: { color: string; borderColor: string; surface: string; count?: number }) {
  const opacity = usePulse();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={[skCard.card, { backgroundColor: surface, borderColor, opacity }]}>
          <View style={skCard.top}>
            <View style={[skCard.title, { backgroundColor: color, width: i % 2 === 0 ? '65%' : '80%' }]} />
            <View style={[skCard.chip, { backgroundColor: color }]} />
          </View>
          <View style={[skCard.line, { backgroundColor: color, width: '90%' }]} />
          <View style={[skCard.line, { backgroundColor: color, width: 80 }]} />
          <View style={[skCard.divider, { backgroundColor: borderColor }]} />
          <View style={[skCard.action, { backgroundColor: color }]} />
        </Animated.View>
      ))}
    </>
  );
}

const skCard = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    height: 14,
    borderRadius: 6,
    flex: 1,
  },
  chip: {
    height: 20,
    width: 60,
    borderRadius: 10,
  },
  line: {
    height: 10,
    borderRadius: 5,
  },
  divider: {
    height: 1,
  },
  action: {
    height: 10,
    borderRadius: 5,
    width: 90,
    alignSelf: 'flex-end',
  },
});
