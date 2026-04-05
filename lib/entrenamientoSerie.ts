/**
 * Tipos de serie en UI ↔ valores en routine_sets.tipo_serie (plantilla) y legado workout_sets.
 */

import type { TipoSerie } from '@/types/database.types';

export type TipoSerieUi =
  | 'lineal'
  | 'warm_up'
  | 'top_set'
  | 'back_off'
  | 'superserie';

/** Valores persistidos en routine_sets.tipo_serie (tabla routines). */
export type TipoSeriePlantillaDb =
  | 'lineal'
  | 'warm_up'
  | 'top_set'
  | 'back_off'
  | 'superset';

export function tipoSerieUiADb(ui: TipoSerieUi): TipoSeriePlantillaDb {
  switch (ui) {
    case 'lineal':
      return 'lineal';
    case 'warm_up':
      return 'warm_up';
    case 'top_set':
      return 'top_set';
    case 'back_off':
      return 'back_off';
    case 'superserie':
      return 'superset';
  }
}

export function tipoSerieDbAUi(db: TipoSerie | TipoSeriePlantillaDb): TipoSerieUi {
  switch (db) {
    case 'lineal':
      return 'lineal';
    case 'warm_up':
      return 'warm_up';
    case 'top_set':
      return 'top_set';
    case 'back_off':
      return 'back_off';
    case 'superset':
      return 'superserie';
    default:
      return 'lineal';
  }
}

export function etiquetaTipoSerieUi(ui: TipoSerieUi): string {
  switch (ui) {
    case 'lineal':
      return 'Lineal';
    case 'warm_up':
      return 'Warm Up';
    case 'top_set':
      return 'Top Set';
    case 'back_off':
      return 'Back Off';
    case 'superserie':
      return 'Superserie';
  }
}

/** Abreviatura en la columna SERIE cuando no es lineal */
export function abrevTipoSerieUi(ui: TipoSerieUi): string | null {
  switch (ui) {
    case 'lineal':
      return null;
    case 'warm_up':
      return 'WU';
    case 'top_set':
      return 'TS';
    case 'back_off':
      return 'BO';
    case 'superserie':
      return 'SS';
  }
}
