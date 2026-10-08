import type { HubSection } from '../../features/home/hub';

export type Platform = 'ios' | 'android' | 'facebook';

/** Una app o página de la que anotas un número cada día. */
export interface ScoreItem {
  id: string;
  name: string;
}

export interface PlatformInfo extends HubSection {
  id: Platform;
  /** Qué se cuenta: "descargas", "visualizaciones". */
  metric: string;
  /** Cómo se llaman sus elementos: "apps", "páginas". */
  itemsName: string;
  items: readonly ScoreItem[];
}

const APPS: readonly ScoreItem[] = [
  { id: 'colima-go', name: 'Colima Go' },
  { id: 'magenta-group', name: 'Magenta Group' },
  { id: 'real-estate-colima', name: 'Real Estate Colima' },
];

const PAGINAS: readonly ScoreItem[] = [
  { id: 'impercasa', name: 'ImperCasa' },
  { id: 'colima-go', name: 'Colima Go' },
  { id: 'energycol', name: 'EnergyCol' },
  { id: 'real-estate-js', name: 'Real Estate JS' },
  { id: 'infratec', name: 'Infratec' },
];

// Colores validados (contraste y daltonismo) para las líneas de tendencia;
// en modo oscuro, score.css usa un paso más claro de cada uno.
export const PLATFORMS: readonly PlatformInfo[] = [
  { id: 'ios', title: 'iOS', description: 'Descargas de tus 3 apps.', icon: 'download', color: '#4a3aa7', metric: 'descargas', itemsName: 'apps', items: APPS },
  { id: 'android', title: 'Android', description: 'Descargas de tus 3 apps.', icon: 'download', color: '#2e9e5b', metric: 'descargas', itemsName: 'apps', items: APPS },
  { id: 'facebook', title: 'Facebook', description: 'Visualizaciones de 5 páginas.', icon: 'eye', color: '#1877f2', metric: 'visualizaciones', itemsName: 'páginas', items: PAGINAS },
];

export const platformById = (id: string | undefined) => PLATFORMS.find((p) => p.id === id);
