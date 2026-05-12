import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRecordBaselineMap,
  calcularRecordFlagsPorLinea,
  valorRecordCardio,
  valorRecordFuerza,
} from '../lib/entrenamientoRecords.ts';

test('fuerza marca max_weight cuando supera el historico', () => {
  const flags = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'press',
      tracking_mode: 'strength',
      sets: [{ setId: '1', tipoUi: 'lineal', kg: '101', reps: '3', completada: true }],
    },
    buildRecordBaselineMap([{ exerciseId: 'press', recordType: 'max_weight', value: 100 }]),
  );

  assert.equal(flags[0]?.maxWeight, true);
});

test('fuerza marca max_volume cuando kg por reps supera el historico', () => {
  const flags = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'press',
      tracking_mode: 'strength',
      sets: [{ setId: '1', tipoUi: 'lineal', kg: '80', reps: '8', completada: true }],
    },
    buildRecordBaselineMap([{ exerciseId: 'press', recordType: 'max_volume', value: 600 }]),
  );

  assert.equal(flags[0]?.maxVolume, true);
});

test('una misma serie puede marcar peso y volumen', () => {
  const flags = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'press',
      tracking_mode: 'strength',
      sets: [{ setId: '1', tipoUi: 'lineal', kg: '110', reps: '7', completada: true }],
    },
    buildRecordBaselineMap([
      { exerciseId: 'press', recordType: 'max_weight', value: 100 },
      { exerciseId: 'press', recordType: 'max_volume', value: 700 },
    ]),
  );

  assert.deepEqual(flags[0], { maxWeight: true, maxVolume: true });
});

test('empatar el historico no marca record', () => {
  const flags = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'press',
      tracking_mode: 'strength',
      sets: [{ setId: '1', tipoUi: 'lineal', kg: '100', reps: '7', completada: true }],
    },
    buildRecordBaselineMap([
      { exerciseId: 'press', recordType: 'max_weight', value: 100 },
      { exerciseId: 'press', recordType: 'max_volume', value: 700 },
    ]),
  );

  assert.deepEqual(flags[0], {});
});

test('serie incompleta no marca record', () => {
  const flags = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'press',
      tracking_mode: 'strength',
      sets: [{ setId: '1', tipoUi: 'lineal', kg: '120', reps: '7', completada: false }],
    },
    buildRecordBaselineMap([{ exerciseId: 'press', recordType: 'max_weight', value: 100 }]),
  );

  assert.deepEqual(flags[0], {});
});

test('bajar peso o reps elimina los flags', () => {
  const baseline = buildRecordBaselineMap([
    { exerciseId: 'press', recordType: 'max_weight', value: 100 },
    { exerciseId: 'press', recordType: 'max_volume', value: 700 },
  ]);
  const antes = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'press',
      tracking_mode: 'strength',
      sets: [{ setId: '1', tipoUi: 'lineal', kg: '110', reps: '7', completada: true }],
    },
    baseline,
  );
  const despues = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'press',
      tracking_mode: 'strength',
      sets: [{ setId: '1', tipoUi: 'lineal', kg: '99', reps: '7', completada: true }],
    },
    baseline,
  );

  assert.equal(antes[0]?.maxWeight, true);
  assert.deepEqual(despues[0], {});
});

test('solo la mejor serie actual recibe el icono de record', () => {
  const flags = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'press',
      tracking_mode: 'strength',
      sets: [
        { setId: '1', tipoUi: 'lineal', kg: '105', reps: '3', completada: true },
        { setId: '2', tipoUi: 'lineal', kg: '110', reps: '3', completada: true },
      ],
    },
    buildRecordBaselineMap([{ exerciseId: 'press', recordType: 'max_weight', value: 100 }]),
  );

  assert.deepEqual(flags[0], {});
  assert.equal(flags[1]?.maxWeight, true);
});

test('cardio marca max_duration', () => {
  const flags = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'run',
      tracking_mode: 'cardio_time',
      sets: [{ setId: '1', tipoUi: 'lineal', kg: '', reps: '', duracionSeg: '31', completada: true }],
    },
    buildRecordBaselineMap([{ exerciseId: 'run', recordType: 'max_duration', value: 1800 }]),
  );

  assert.equal(flags[0]?.maxDuration, true);
});

test('cardio marca max_distance', () => {
  const flags = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'run',
      tracking_mode: 'cardio_time_distance',
      sets: [{ setId: '1', tipoUi: 'lineal', kg: '', reps: '', distanciaKm: '5.1', completada: true }],
    },
    buildRecordBaselineMap([{ exerciseId: 'run', recordType: 'max_distance', value: 5 }]),
  );

  assert.equal(flags[0]?.maxDistance, true);
});

test('cardio puede marcar tiempo y km', () => {
  const flags = calcularRecordFlagsPorLinea(
    {
      exerciseId: 'run',
      tracking_mode: 'cardio_time_distance',
      sets: [
        {
          setId: '1',
          tipoUi: 'lineal',
          kg: '',
          reps: '',
          duracionSeg: '41',
          distanciaKm: '8',
          completada: true,
        },
      ],
    },
    buildRecordBaselineMap([
      { exerciseId: 'run', recordType: 'max_duration', value: 2400 },
      { exerciseId: 'run', recordType: 'max_distance', value: 7.5 },
    ]),
  );

  assert.deepEqual(flags[0], { maxDuration: true, maxDistance: true });
});

test('valores nulos, cero o invalidos no generan records', () => {
  assert.equal(valorRecordFuerza({ kg: '', reps: '5', completada: true }, 'max_weight'), null);
  assert.equal(valorRecordFuerza({ kg: '0', reps: '5', completada: true }, 'max_volume'), null);
  assert.equal(valorRecordCardio({ duracionSeg: '0', completada: true }, 'max_duration'), null);
  assert.equal(valorRecordCardio({ distanciaKm: 'abc', completada: true }, 'max_distance'), null);
});
