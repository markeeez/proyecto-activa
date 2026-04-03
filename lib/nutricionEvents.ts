import { DeviceEventEmitter } from 'react-native';

export const NUTRICION_LOG_ACTUALIZADO = 'nutricion-log-actualizado';

export function emitNutricionLogActualizado() {
  DeviceEventEmitter.emit(NUTRICION_LOG_ACTUALIZADO);
}
