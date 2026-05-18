import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import Logo from '@/assets/images/logos/logo.svg';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

const DOT_COUNT = 3;
const DOT_DURATION = 500;

function Dot({ index }: { index: number }) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withDelay(
      index * 180,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOT_DURATION, easing: Easing.out(Easing.ease) }),
          withTiming(0.25, { duration: DOT_DURATION, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, [index, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, style]} />;
}

export default function LoadingSplash() {
  return (
    <View style={styles.container}>
      <Logo width={140} height={140} />
      <View style={styles.dotsRow}>
        {Array.from({ length: DOT_COUNT }).map((_, i) => (
          <Dot key={i} index={i} />
        ))}
      </View>
    </View>
  );
}

export const LoadingSplashStyles = {
  wordmarkFont: FontFamily.monoBold,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
    gap: Spacing.xl,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.primary,
  },
});
