import { crearFetchLocal } from './fetch-local';
import { rutas } from './rutas';

/** El fetch que recibe el panel: atiende /api/* sin servidor intermedio. */
export const fetchColimaGo = crearFetchLocal(rutas);
