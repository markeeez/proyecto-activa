import { DeviceEventEmitter } from 'react-native';

export const NUTRICION_LOG_ACTUALIZADO = 'nutricion-log-actualizado';

export type NutricionLogActualizadoPayload = { fechaLog?: string };

export function emitNutricionLogActualizado(payload?: NutricionLogActualizadoPayload) {
  DeviceEventEmitter.emit(NUTRICION_LOG_ACTUALIZADO, payload ?? {});
}
