import type { ComponentType } from 'react';
import type { ModuleIconName } from '../core/ui/ModuleIcon';

/**
 * Un módulo de MyProject (ColimaGo, MagentaApp, English, Finances…). Cada
 * uno vive en src/modules/<id>/ con su propia UI, su acceso a datos y sus
 * estilos, se registra en registry.ts y aparece como tarjeta en el inicio.
 */
export interface AppModule {
  /** Identificador estable; también es el nombre de su carpeta. */
  id: string;
  /** Nombre visible. */
  title: string;
  /** Una línea para su tarjeta en el inicio. Sin ella, la tarjeta dice que está vacío. */
  description?: string;
  /** Ruta base dentro de la app, p. ej. "/colima-go". Sus subrutas cuelgan de aquí. */
  path: `/${string}`;
  /** Ícono de su tarjeta. */
  icon: ModuleIconName;
  /** Color del ícono de su tarjeta. */
  color: string;
  /**
   * Pantalla del módulo. Conviene React.lazy para cargarlo solo al abrirlo.
   * Sin ella, el módulo abre una pantalla vacía.
   */
  component?: ComponentType;
  /** Lo que el módulo tiene pendiente hoy, para la tarjeta grande del inicio. */
  pending?: PendingSource;
  /** Mostrar en su tarjeta del inicio cuántos de sus pendientes de hoy faltan. */
  showPendingCount?: boolean;
  /**
   * Sin tarjeta en el inicio: su ruta sigue abierta y sus pendientes siguen
   * saliendo en la tarjeta de Pendientes (p. ej. Calendar).
   */
  hidden?: boolean;
}

/** Un pendiente de hoy en la tarjeta grande del inicio. */
export interface PendingItem {
  /** Único dentro de su módulo. */
  id: string;
  title: string;
  /** Texto corto al lado: "1 hora", "Venció ayer"… */
  detail?: string;
  /** Color del check; si no trae, usa el del módulo. */
  color?: string;
  /** Ya se le pasó la fecha. */
  overdue?: boolean;
  done: boolean;
  /**
   * Si se resuelve en otra pantalla (p. ej. escribir un número), a dónde
   * lleva; entonces el inicio no lo palomea, abre esa pantalla.
   */
  href?: string;
}

export interface PendingSource {
  subscribe: (listener: () => void) => () => void;
  load: () => void;
  /**
   * Lo que toca hoy (fecha "AAAA-MM-DD"), incluido lo atrasado, hecho o
   * no: el inicio muestra lo no hecho. `null` mientras carga.
   */
  items: (today: string) => PendingItem[] | null;
  setDone: (itemId: string, done: boolean, today: string) => void;
  /**
   * Cuántas cosas tocaban ese día y cuántas se resolvieron, para la
   * gráfica de la semana del inicio. `null` mientras carga.
   */
  progress: (day: string) => DayProgress | null;
}

export interface DayProgress {
  total: number;
  done: number;
}
