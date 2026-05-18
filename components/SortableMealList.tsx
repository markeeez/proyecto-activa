/**
 * SortableMealList
 * ─────────────────
 * Drop-in replacement for DraggableFlatList that avoids the ghost-on-drop
 * artefact. The real item follows the gesture — no floating overlay.
 *
 * Requirements: react-native-gesture-handler v2, react-native-reanimated v3
 *
 * Stale-closure fix: every callback that the gesture worklet invokes via
 * runOnJS is wrapped in a stable ref-forwarding function so the gesture
 * is created once (keyed on `index`) yet always calls the latest closure.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

// ─── Public types ─────────────────────────────────────────────────────────────

export type DragItemParams<T> = {
  item: T;
  drag: () => void;
  isActive: boolean;
};

type Props<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (params: DragItemParams<T>) => React.ReactNode;
  onDragEnd: (params: { data: T[] }) => void;
  ListHeaderComponent?: (() => React.ReactNode) | null;
  ListFooterComponent?: (() => React.ReactNode) | null;
  contentContainerStyle?: ViewStyle;
  containerStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
};

// Pre-allocate shared values for up to this many items
const MAX_ITEMS = 12;

// ─── Per-item animated row ────────────────────────────────────────────────────

type RowProps<T> = {
  item: T;
  index: number;
  renderItem: (p: DragItemParams<T>) => React.ReactNode;
  activeSV: SharedValue<number>;
  dragYSV: SharedValue<number>;
  shiftSV: SharedValue<number>;
  /** Stable ref-forwarding wrappers — never change identity after mount */
  stableActivate: (i: number) => void;
  stableLayout: (i: number, h: number) => void;
  stableShifts: (y: number) => void;
  stableCommit: () => void;
};

function SortableRow<T>({
  item,
  index,
  renderItem,
  activeSV,
  dragYSV,
  shiftSV,
  stableActivate,
  stableLayout,
  stableShifts,
  stableCommit,
}: RowProps<T>) {
  // Mirror isActive to JS state so renderItem sees it
  const [isActiveJS, setIsActiveJS] = useState(false);

  useAnimatedReaction(
    () => activeSV.value === index,
    (cur, prev) => {
      if (cur !== prev) runOnJS(setIsActiveJS)(cur);
    },
    [index],
  );

  const aStyle = useAnimatedStyle(() => {
    const active = activeSV.value === index;
    return {
      transform: [{ translateY: active ? dragYSV.value : shiftSV.value }],
      zIndex: active ? 999 : 1,
      elevation: active ? 8 : 0,
    };
  }, [index]);

  /**
   * The gesture is memoized on `index` only — but it calls the *stable*
   * wrappers whose identity never changes, so there is no stale-closure risk.
   */
  const gesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(150)
        .minPointers(1)
        .maxPointers(1)
        .onStart(() => {
          'worklet';
          runOnJS(stableActivate)(index);
        })
        .onChange((e) => {
          'worklet';
          dragYSV.value = e.translationY;
          runOnJS(stableShifts)(e.translationY);
        })
        .onEnd(() => {
          'worklet';
          runOnJS(stableCommit)();
        })
        .onFinalize(() => {
          'worklet';
          // Safety net for cancelled gestures — stableCommit is idempotent
          if (activeSV.value === index) {
            runOnJS(stableCommit)();
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index], // stableActivate / stableShifts / stableCommit are stable by design
  );

  const drag = useCallback(() => stableActivate(index), [stableActivate, index]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={aStyle}
        onLayout={(e) => stableLayout(index, e.nativeEvent.layout.height)}
      >
        {renderItem({ item, drag, isActive: isActiveJS })}
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SortableMealList<T>({
  data,
  keyExtractor,
  renderItem,
  onDragEnd,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
  containerStyle,
  showsVerticalScrollIndicator = false,
}: Props<T>) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const heightsRef = useRef<number[]>([]);
  const activeIdxRef = useRef(-1);
  const dropIdxRef = useRef(-1);

  // ── Scroll lock ───────────────────────────────────────────────────────────
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // ── Shared values ─────────────────────────────────────────────────────────
  const activeSV = useSharedValue(-1);
  const dragYSV = useSharedValue(0);

  // One shift shared value per slot (hooks must be called unconditionally)
  const shift0 = useSharedValue(0);
  const shift1 = useSharedValue(0);
  const shift2 = useSharedValue(0);
  const shift3 = useSharedValue(0);
  const shift4 = useSharedValue(0);
  const shift5 = useSharedValue(0);
  const shift6 = useSharedValue(0);
  const shift7 = useSharedValue(0);
  const shift8 = useSharedValue(0);
  const shift9 = useSharedValue(0);
  const shift10 = useSharedValue(0);
  const shift11 = useSharedValue(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shiftSVs = React.useMemo(
    () => [shift0, shift1, shift2, shift3, shift4, shift5, shift6, shift7, shift8, shift9, shift10, shift11],
    [],
  );

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    activeSV.value = -1;
    dragYSV.value = 0;
    for (let i = 0; i < MAX_ITEMS; i++) shiftSVs[i].value = 0;
    activeIdxRef.current = -1;
    dropIdxRef.current = -1;
  }, [activeSV, dragYSV, shiftSVs]);

  // ── Shift siblings ────────────────────────────────────────────────────────
  const applyShifts = useCallback(
    (translationY: number) => {
      const n = data.length;
      const ai = activeIdxRef.current;
      if (ai < 0 || n === 0) return;

      const heights = heightsRef.current;
      const activeH = heights[ai] ?? 80;

      let drop = ai;
      if (translationY > 0) {
        let accum = 0;
        for (let i = ai + 1; i < n; i++) {
          const h = heights[i] ?? 80;
          if (translationY > accum + h / 2) { drop = i; accum += h; }
          else break;
        }
      } else {
        let accum = 0;
        for (let i = ai - 1; i >= 0; i--) {
          const h = heights[i] ?? 80;
          if (translationY < accum - h / 2) { drop = i; accum -= h; }
          else break;
        }
      }

      dropIdxRef.current = drop;

      for (let i = 0; i < n; i++) {
        if (i === ai) continue;
        let shift = 0;
        if (drop > ai && i > ai && i <= drop) shift = -activeH;
        else if (drop < ai && i < ai && i >= drop) shift = activeH;
        if (shiftSVs[i]) shiftSVs[i].value = shift;
      }
    },
    [data.length, shiftSVs],
  );

  // ── Commit ────────────────────────────────────────────────────────────────
  const commitDrop = useCallback(() => {
    const ai = activeIdxRef.current;
    if (ai < 0) return; // idempotent guard (onFinalize fires after onEnd)

    const di = dropIdxRef.current >= 0 ? dropIdxRef.current : ai;

    // Build new order from the CURRENT data prop (always fresh via dataRef below)
    const newData = [...data];
    const [moved] = newData.splice(ai, 1);
    newData.splice(di, 0, moved);

    resetAll();
    setScrollEnabled(true);
    onDragEnd({ data: newData });
  }, [data, onDragEnd, resetAll]);

  // ── Activate ──────────────────────────────────────────────────────────────
  const handleActivate = useCallback(
    (index: number) => {
      activeIdxRef.current = index;
      dropIdxRef.current = index;
      activeSV.value = index;
      dragYSV.value = 0;
      setScrollEnabled(false);
    },
    [activeSV, dragYSV],
  );

  const handleLayout = useCallback((index: number, height: number) => {
    heightsRef.current[index] = height;
  }, []);

  // ── Stable ref-forwarding wrappers ────────────────────────────────────────
  // These have a stable identity (created once) but always call the latest
  // version of the underlying function through a ref. This means gestures
  // memoized on `index` never hold a stale closure.
  const commitDropRef = useRef(commitDrop);
  const applyShiftsRef = useRef(applyShifts);
  const handleActivateRef = useRef(handleActivate);
  const handleLayoutRef = useRef(handleLayout);

  useEffect(() => { commitDropRef.current = commitDrop; });
  useEffect(() => { applyShiftsRef.current = applyShifts; });
  useEffect(() => { handleActivateRef.current = handleActivate; });
  useEffect(() => { handleLayoutRef.current = handleLayout; });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableCommit = useCallback(() => commitDropRef.current(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableShifts = useCallback((y: number) => applyShiftsRef.current(y), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableActivate = useCallback((i: number) => handleActivateRef.current(i), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLayout = useCallback((i: number, h: number) => handleLayoutRef.current(i, h), []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={containerStyle}
      contentContainerStyle={contentContainerStyle}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    >
      {ListHeaderComponent?.()}

      {data.slice(0, MAX_ITEMS).map((item, index) => (
        <SortableRow
          key={keyExtractor(item)}
          item={item}
          index={index}
          renderItem={renderItem}
          activeSV={activeSV}
          dragYSV={dragYSV}
          shiftSV={shiftSVs[index]}
          stableActivate={stableActivate}
          stableLayout={stableLayout}
          stableShifts={stableShifts}
          stableCommit={stableCommit}
        />
      ))}

      {ListFooterComponent?.()}
    </ScrollView>
  );
}
