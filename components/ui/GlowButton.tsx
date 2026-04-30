/**
 * GlowButton — canvas Skia detrás del hijo (p. ej. TouchableOpacity).
 * Capas: resplandor exterior difuso, degradado del “relleno”, brillo tipo gloss.
 */

import React, { cloneElement, isValidElement, useState, type ReactElement } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from 'react-native';
import {
  BlurMask,
  Canvas,
  LinearGradient,
  Oval,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';

const DEFAULT_GLOW_PADDING = 40;

/** Expansión del rect de glow respecto al botón (antes del blur). */
const GLOW_RECT_OUTSET = 6;

/** Degradado horizontal: cyan más oscuro → más claro. */
const GRAD_CYAN_DARK = '#36b7e9';
const GRAD_CYAN_LIGHT = '#73ddfa';

export type GlowButtonProps = {
  children: ReactElement;
  /** Debe coincidir con el `borderRadius` del botón (p. ej. 14). */
  borderRadius: number;
  /** Espacio extra alrededor del botón para que el blur no se corte (por defecto 40). */
  glowPadding?: number;
};

export function GlowButton({
  children,
  borderRadius,
  glowPadding = DEFAULT_GLOW_PADDING,
}: GlowButtonProps) {
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setW(width);
    setH(height);
  };

  const pad = glowPadding;
  const canvasW = w + pad * 2;
  const canvasH = h + pad * 2;

  const touchable = isValidElement(children)
    ? cloneElement(children as ReactElement<{ style?: unknown }>, {
        style: [
          (children as ReactElement<{ style?: unknown }>).props.style,
          { backgroundColor: 'transparent' },
        ],
      })
    : children;

  const bw = w;
  const bh = h;
  const gx = pad - GLOW_RECT_OUTSET;
  const gy = pad - GLOW_RECT_OUTSET;
  const gw = bw + GLOW_RECT_OUTSET * 2;
  const gh = bh + GLOW_RECT_OUTSET * 2;
  const glowR = borderRadius + GLOW_RECT_OUTSET * 0.5;

  const glossW = bw * 0.72;
  const glossH = bh * 0.26;
  const glossX = pad + (bw - glossW) / 2;
  const glossY = pad + bh * 0.35 - glossH / 2;

  const gradY = pad + bh / 2;

  return (
    <View style={{ position: 'relative', alignSelf: 'stretch' }} onLayout={onLayout}>
      {w > 0 && h > 0 ? (
        <Canvas
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -pad,
            top: -pad,
            width: canvasW,
            height: canvasH,
          }}
        >
          {/* Capa 1 — glow exterior */}
          <RoundedRect
            x={gx}
            y={gy}
            width={gw}
            height={gh}
            r={glowR}
            color="rgba(0, 200, 224, 0.3)"
          >
            <BlurMask blur={18} style="normal" />
          </RoundedRect>

          {/* Capa 2 — degradado del botón (mismo radio que el botón) */}
          <RoundedRect x={pad} y={pad} width={bw} height={bh} r={borderRadius}>
            <LinearGradient
              start={vec(pad, gradY)}
              end={vec(pad + bw, gradY)}
              colors={[GRAD_CYAN_DARK, GRAD_CYAN_LIGHT]}
            />
          </RoundedRect>

          {/* Capa 3 — gloss */}
          <Oval x={glossX} y={glossY} width={glossW} height={glossH} color="rgba(255,255,255,0.18)">
            <BlurMask blur={6} style="normal" />
          </Oval>
        </Canvas>
      ) : null}

      {touchable}
    </View>
  );
}
