import { DeviceEventEmitter } from 'react-native';

export const ENTRENAMIENTO_TAB_SOLICITADO = 'entrenamiento-tab-solicitado';

export type EntrenamientoTabSolicitado = 'entrenos' | 'rutinas';

let tabPendiente: EntrenamientoTabSolicitado | null = null;

export function solicitarEntrenamientoTab(tab: EntrenamientoTabSolicitado) {
  tabPendiente = tab;
  DeviceEventEmitter.emit(ENTRENAMIENTO_TAB_SOLICITADO, { tab });
}

export function consumirEntrenamientoTabSolicitado() {
  const tab = tabPendiente;
  tabPendiente = null;
  return tab;
}
