// New House (CRM Magenta): del formulario a lo que espera
// POST /magentagroup. Solo lógica pura; la pantalla vive en HouseFormPage.tsx.
//
// El backend valida con forbidNonWhitelisted: un campo que su DTO no declara
// hace que TODO el POST falle, así que aquí solo se arma lo que declara
// (backColimaApp/src/magentagroup/dto/create-magentagroup.dto.ts).

export const TIPOS = ['Casa', 'Departamento', 'Local', 'Bodega', 'Terreno'] as const;
export type TipoCasa = (typeof TIPOS)[number];

/** Los únicos municipios donde Magenta compra (así se guardan en `city`). */
export const CIUDADES = ['Colima', 'Villa de Álvarez', 'Comala'] as const;

/** La ciudad de la lista que es la misma que `texto` (sin importar acentos, mayúsculas ni espacios), o el texto limpio si no está. */
export function ciudadCanonica(texto: string): string {
  const limpio = (texto ?? '').trim().replace(/\s+/g, ' ');
  const clave = sinAcentos(limpio);
  return CIUDADES.find((c) => sinAcentos(c) === clave) ?? limpio;
}

/** Lo que se captura, tal cual lo escribe la persona (todo texto). */
export interface CasaForm {
  code: string;
  typeHouse: TipoCasa;
  city: string;
  colony: string;
  cp: string;
  price: string;
  rooms: string;
  toilets: string;
  m2build: string;
  m2terrain: string;
  resume: string;
  url: string;
  video: string;
  virtualTour: string;
  status: boolean;
}

export const CASA_VACIA: CasaForm = {
  code: '',
  typeHouse: 'Casa',
  city: '',
  colony: '',
  cp: '',
  price: '',
  rooms: '',
  toilets: '',
  m2build: '',
  m2terrain: '',
  resume: '',
  url: '',
  video: '',
  virtualTour: '',
  status: true,
};

/** Lo que recibe POST /magentagroup. */
export interface CasaPayload {
  code: string;
  typeHouse: TipoCasa;
  city: string;
  colony: string;
  price: number;
  rooms: number;
  toilets: number;
  status: boolean;
  photos: string[];
  cp?: number;
  m2build?: number;
  m2terrain?: number;
  resume?: string;
  url?: string;
  video?: string;
  virtualTour?: string;
}

export type ErroresCasa = Partial<Record<keyof CasaForm | 'photos', string>>;

/** "1,490,000", "$ 1 490 000" → 1490000. Devuelve NaN si no es un número. */
function numero(texto: string): number {
  const limpio = texto.replace(/[\s$,]/g, '');
  return limpio === '' || !/^\d*\.?\d+$/.test(limpio) ? NaN : Number(limpio);
}

function enteroNoNegativo(texto: string): number | null {
  const n = numero(texto);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function esUrl(texto: string): boolean {
  try {
    const { protocol } = new URL(texto);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Valida el formulario. Con `fotos` = cuántas fotos hay elegidas (la
 * validación no sube nada). Regresa los errores por campo en español, o el
 * payload sin fotos todavía (`photos` se llena con las URLs de Cloudinary
 * después de subirlas).
 *
 * Al `edicion` (PATCH /magentagroup/:id) un campo ausente significa "sin
 * cambio", así que lo que se dejó en blanco viaja explícito ("" o 0, que es
 * el valor por defecto del schema) para que se pueda borrar; y ya no se
 * exige foto (hay casas guardadas sin ellas y no deben quedar sin poder
 * editarse).
 */
export function validarCasa(
  form: CasaForm,
  fotos: number,
  { edicion = false }: { edicion?: boolean } = {},
): { errores: ErroresCasa; payload?: Omit<CasaPayload, 'photos'> } {
  const errores: ErroresCasa = {};
  const code = form.code.trim();
  const city = form.city.trim();
  const colony = form.colony.trim();

  if (!code) errores.code = 'Escribe el código de la propiedad.';
  if (!city) errores.city = 'Escribe la ciudad.';
  if (!colony) errores.colony = 'Elige la colonia o agrégala.';

  const price = numero(form.price);
  if (!Number.isInteger(price) || price <= 0) errores.price = 'Escribe el precio en pesos, sin centavos.';

  const rooms = enteroNoNegativo(form.rooms);
  if (rooms === null) errores.rooms = 'Escribe cuántas recámaras (0 si no tiene).';
  const toilets = enteroNoNegativo(form.toilets);
  if (toilets === null) errores.toilets = 'Escribe cuántos baños (0 si no tiene).';

  const cp = form.cp.trim() === '' ? undefined : enteroNoNegativo(form.cp);
  if (cp === null || (cp !== undefined && !/^\d{5}$/.test(form.cp.trim()))) errores.cp = 'El código postal tiene 5 dígitos.';

  const m2build = form.m2build.trim() === '' ? undefined : numero(form.m2build);
  if (m2build !== undefined && !(m2build > 0)) errores.m2build = 'Escribe los metros cuadrados como número.';
  const m2terrain = form.m2terrain.trim() === '' ? undefined : numero(form.m2terrain);
  if (m2terrain !== undefined && !(m2terrain > 0)) errores.m2terrain = 'Escribe los metros cuadrados como número.';

  for (const campo of ['url', 'video', 'virtualTour'] as const) {
    const valor = form[campo].trim();
    if (valor && !esUrl(valor)) errores[campo] = 'Pega un link completo que empiece con https://';
  }

  if (fotos === 0 && !edicion) errores.photos = 'Agrega al menos una foto.';

  if (Object.keys(errores).length > 0) return { errores };

  const payload: Omit<CasaPayload, 'photos'> = {
    code,
    typeHouse: form.typeHouse,
    city,
    colony,
    price,
    rooms: rooms as number,
    toilets: toilets as number,
    status: form.status,
  };
  // Opcionales: al crear solo viajan si se llenaron; al editar siempre.
  const numeros = { cp: cp ?? undefined, m2build, m2terrain };
  for (const [campo, valor] of Object.entries(numeros) as [keyof typeof numeros, number | undefined][]) {
    if (valor !== undefined) payload[campo] = valor;
    else if (edicion) payload[campo] = 0;
  }
  const textos = { resume: form.resume.trim(), url: form.url.trim(), video: form.video.trim(), virtualTour: form.virtualTour.trim() };
  for (const [campo, valor] of Object.entries(textos) as [keyof typeof textos, string][]) {
    if (valor || edicion) payload[campo] = valor;
  }
  return { errores, payload };
}

/** Una casa tal como la devuelve GET /magentagroup (la base: magentagroup.propiedades). */
export interface Casa {
  _id: string;
  code: string;
  city: string;
  colony: string;
  typeHouse: string;
  price: number;
  rooms: number;
  toilets: number;
  status: boolean;
  photos: string[];
  cp?: number;
  /** Pin aproximado de la casa (0 o ausente = sin ubicar). */
  latitude?: number;
  longitude?: number;
  street?: string;
  m2build?: number;
  m2terrain?: number;
  resume?: string;
  url?: string;
  video?: string;
  virtualTour?: string;
  top?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** El formulario ya lleno con los datos de una casa guardada. 0 en los opcionales = en blanco. */
export function formDeCasa(casa: Casa): CasaForm {
  const positivo = (n: number | undefined) => (n && n > 0 ? String(n) : '');
  return {
    code: casa.code ?? '',
    typeHouse: TIPOS.find((t) => t.toLowerCase() === String(casa.typeHouse).toLowerCase()) ?? 'Casa',
    city: ciudadCanonica(casa.city ?? ''),
    colony: casa.colony ?? '',
    cp: positivo(casa.cp),
    price: positivo(casa.price),
    rooms: String(casa.rooms ?? 0),
    toilets: String(casa.toilets ?? 0),
    m2build: positivo(casa.m2build),
    m2terrain: positivo(casa.m2terrain),
    resume: casa.resume ?? '',
    url: casa.url ?? '',
    video: casa.video ?? '',
    virtualTour: casa.virtualTour ?? '',
    status: casa.status !== false,
  };
}

/**
 * Versión liviana de una foto para miniaturas (la lista no debe bajar 25
 * fotos de 1920 px por casa). Cloudinary las reduce en el servidor; las del
 * catálogo viejo (`_next/image?url=…`) se piden directo al original.
 */
export function miniatura(url: string, ancho = 400): string {
  const cloudinary = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (cloudinary) return `${cloudinary[1]}f_auto,q_auto,w_${ancho},c_limit/${cloudinary[2]}`;
  try {
    const parsed = new URL(url);
    const original = parsed.pathname === '/_next/image' ? parsed.searchParams.get('url') : null;
    if (original && /^https:\/\//.test(original)) return original;
  } catch {
    // no era una URL: se deja tal cual
  }
  return url;
}

export type FiltroEstado = 'todas' | 'activas' | 'pausadas';

function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Las casas que coinciden con lo escrito (código, colonia, ciudad, calle o tipo; sin importar acentos) y el estado. */
export function filtrarCasas(casas: Casa[], texto: string, estado: FiltroEstado): Casa[] {
  const palabras = sinAcentos(texto).split(/\s+/).filter(Boolean);
  return casas.filter((c) => {
    if (estado === 'activas' && !c.status) return false;
    if (estado === 'pausadas' && c.status) return false;
    const pajar = sinAcentos([c.code, c.colony, c.city, c.street, c.typeHouse].filter(Boolean).join(' '));
    return palabras.every((p) => pajar.includes(p));
  });
}

/**
 * Una colonia con su ciudad y su ubicación, como la guarda el backend
 * (magentagroup.colonias). La ubicación es opcional: se dibuja como polígono
 * (`boundary`) o, si no hay, como círculo de `radius` metros alrededor del
 * centro (`latitude`/`longitude`).
 */
export type Colonia = Pick<Casa, 'city' | 'colony'> & {
  municipality?: string;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
  boundary?: { lat: number; lng: number }[];
  /** 'osm-polygon' | 'osm-point' | 'estimado' | 'manual' */
  geoSource?: string;
  /** true cuando ya se revisó en el mapa que es correcta. */
  geoVerified?: boolean;
};

/**
 * Cada colonia una sola vez (sin importar acentos ni mayúsculas), en orden
 * alfabético, solo las de la ciudad si se da una. Si la ciudad no coincide
 * con ninguna colonia (escrita a medias, o sin colonias aún), se regresan
 * todas: una lista vacía hacía parecer que las colonias no cargaron.
 */
export function coloniasDe(colonias: Colonia[], ciudad = ''): string[] {
  const ciudadBuscada = sinAcentos(ciudad.trim());
  if (ciudadBuscada && !colonias.some((c) => sinAcentos((c.city ?? '').trim()) === ciudadBuscada && c.colony?.trim())) {
    return coloniasDe(colonias);
  }
  const vistas = new Map<string, string>();
  for (const { city, colony } of colonias) {
    const nombre = colony?.trim();
    if (!nombre) continue;
    if (ciudadBuscada && sinAcentos((city ?? '').trim()) !== ciudadBuscada) continue;
    const clave = sinAcentos(nombre);
    if (!vistas.has(clave)) vistas.set(clave, nombre);
  }
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

/** La colonia de la lista que es la misma que `texto` (sin importar acentos, mayúsculas ni espacios de sobra), o undefined. */
export function coloniaExistente(colonias: string[], texto: string): string | undefined {
  const clave = sinAcentos(texto.trim().replace(/\s+/g, ' '));
  return clave ? colonias.find((c) => sinAcentos(c.trim().replace(/\s+/g, ' ')) === clave) : undefined;
}

/** Las más nuevas primero. El _id de Mongo empieza con la fecha de creación, así que sirve aun en casas sin `createdAt`. */
export function ordenarCasas(casas: Casa[]): Casa[] {
  return [...casas].sort((a, b) => (a._id < b._id ? 1 : a._id > b._id ? -1 : 0));
}
