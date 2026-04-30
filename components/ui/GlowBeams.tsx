/**
 * GlowBeams
 *
 * Efecto de rayos de luz en V doble usando Skia.
 * 4 paths convergen en el mismo vértice (cx, cy):
 *   - Par exterior (más brillante): orígenes en ±18% fuera del ancho
 *   - Par interior (más tenue):     orígenes en 12% / 88% del ancho
 * Cada rayo tiene 3 capas (outer glow + inner glow + core).
 * El punto de convergencia es un resplandor difuso, sin círculo definido.
 */

import {
  BlurMask,
  Canvas,
  Circle,
  Path,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

interface Props {
  width: number;
  height: number;
}

const CYAN_CORE      = 'rgba(0, 210, 255, 0.9)';    // línea core exterior
const CYAN_INNER     = 'rgba(0, 200, 255, 0.15)';   // inner glow exterior
const CYAN_OUTER     = 'rgba(0, 180, 255, 0.06)';   // outer glow exterior
const CYAN_CORE_IN   = 'rgba(0, 210, 255, 0.5)';    // línea core interior (más tenue)
const CYAN_INNER_IN  = 'rgba(0, 200, 255, 0.08)';   // inner glow interior
const CYAN_OUTER_IN  = 'rgba(0, 180, 255, 0.03)';   // outer glow interior

export function GlowBeams({ width, height }: Props) {
  // Vértice: punto inferior central donde convergen los 4 rayos
  const cx = width / 2;
  const cy = height * 0.78;

  // Origen de los rayos exteriores: claramente fuera de los bordes superiores
  const leftOriginX  = -width * 0.18;
  const rightOriginX = width * 1.18;

  // Origen de los rayos interiores: dentro del ancho, más cerrados / verticales
  const leftInnerOriginX  = width * 0.12;
  const rightInnerOriginX = width * 0.88;

  const originY = 0;

  const leftPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(leftOriginX, originY);
    p.lineTo(cx, cy);
    return p;
  }, [leftOriginX, cx, cy]);

  const rightPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(rightOriginX, originY);
    p.lineTo(cx, cy);
    return p;
  }, [rightOriginX, cx, cy]);

  const leftInnerPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(leftInnerOriginX, originY);
    p.lineTo(cx, cy);
    return p;
  }, [leftInnerOriginX, cx, cy]);

  const rightInnerPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(rightInnerOriginX, originY);
    p.lineTo(cx, cy);
    return p;
  }, [rightInnerOriginX, cx, cy]);

  return (
    <Canvas style={{ position: 'absolute', top: 0, left: -24, width, height }} pointerEvents="none">

      {/* ── Par exterior: rayo izquierdo ── */}
      <Path path={leftPath} style="stroke" strokeWidth={38} color={CYAN_OUTER}>
        <BlurMask blur={20} style="normal" />
      </Path>
      <Path path={leftPath} style="stroke" strokeWidth={8} color={CYAN_INNER}>
        <BlurMask blur={6} style="normal" />
      </Path>
      <Path path={leftPath} style="stroke" strokeWidth={1.5} color={CYAN_CORE} />

      {/* ── Par exterior: rayo derecho ── */}
      <Path path={rightPath} style="stroke" strokeWidth={38} color={CYAN_OUTER}>
        <BlurMask blur={20} style="normal" />
      </Path>
      <Path path={rightPath} style="stroke" strokeWidth={8} color={CYAN_INNER}>
        <BlurMask blur={6} style="normal" />
      </Path>
      <Path path={rightPath} style="stroke" strokeWidth={1.5} color={CYAN_CORE} />

      {/* ── Par interior: rayo izquierdo (más tenue) ── */}
      <Path path={leftInnerPath} style="stroke" strokeWidth={24} color={CYAN_OUTER_IN}>
        <BlurMask blur={16} style="normal" />
      </Path>
      <Path path={leftInnerPath} style="stroke" strokeWidth={5} color={CYAN_INNER_IN}>
        <BlurMask blur={4} style="normal" />
      </Path>
      <Path path={leftInnerPath} style="stroke" strokeWidth={1.0} color={CYAN_CORE_IN} />

      {/* ── Par interior: rayo derecho (más tenue) ── */}
      <Path path={rightInnerPath} style="stroke" strokeWidth={24} color={CYAN_OUTER_IN}>
        <BlurMask blur={16} style="normal" />
      </Path>
      <Path path={rightInnerPath} style="stroke" strokeWidth={5} color={CYAN_INNER_IN}>
        <BlurMask blur={4} style="normal" />
      </Path>
      <Path path={rightInnerPath} style="stroke" strokeWidth={1.0} color={CYAN_CORE_IN} />

      {/* ── Resplandor difuso en el vértice (sin círculo definido) ── */}
      <Circle cx={cx} cy={cy} r={45}>
        <RadialGradient
          c={vec(cx, cy)}
          r={45}
          colors={['rgba(0, 210, 255, 0.18)', 'rgba(0, 200, 255, 0.05)', 'transparent']}
        />
      </Circle>

    </Canvas>
  );
}
