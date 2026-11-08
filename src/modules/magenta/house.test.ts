import { describe, expect, it } from 'vitest';
import { CASA_VACIA, ciudadCanonica, CIUDADES, coloniaExistente, coloniasDe, filtrarCasas, formDeCasa, miniatura, ordenarCasas, validarCasa, type Casa, type CasaForm } from './house';

// La casa del ejemplo (NN-HGS118), tal como se captura en el formulario.
const COMPLETA: CasaForm = {
  ...CASA_VACIA,
  code: ' NN-HGS118 ',
  typeHouse: 'Casa',
  city: 'Villa de Álvarez',
  colony: 'Alfredo V. Bonfil',
  cp: '28979',
  price: '$1,490,000',
  rooms: '3',
  toilets: '1',
  m2build: '108',
  resume: '🔥1,490,000 #VillaDeÁlvarez\n\n- 2 #Recámaras Con Clóset\n',
  url: 'https://www.realestatecolima.com/propiedad/casa-en-venta/colima/villa-de-alvarez/alfredo-v-bonfil-id-nn-hgs118',
  video: 'https://youtube.com/shorts/XVSbpucccnM?si=-VkFDYyKOUhDvrpR',
};

describe('validarCasa', () => {
  it('arma el payload de la casa de ejemplo: números reales, textos recortados, sin vacíos', () => {
    const { errores, payload } = validarCasa(COMPLETA, 15);

    expect(errores).toEqual({});
    expect(payload).toEqual({
      code: 'NN-HGS118',
      typeHouse: 'Casa',
      city: 'Villa de Álvarez',
      colony: 'Alfredo V. Bonfil',
      cp: 28979,
      price: 1490000,
      rooms: 3,
      toilets: 1,
      m2build: 108,
      status: true,
      resume: '🔥1,490,000 #VillaDeÁlvarez\n\n- 2 #Recámaras Con Clóset',
      url: COMPLETA.url,
      video: COMPLETA.video,
    });
    // Lo que se deja en blanco no viaja (el backend usa su valor por defecto).
    expect(payload).not.toHaveProperty('m2terrain');
    expect(payload).not.toHaveProperty('virtualTour');
  });

  it('pide lo obligatorio, con un mensaje por campo', () => {
    const { errores, payload } = validarCasa(CASA_VACIA, 0);

    expect(payload).toBeUndefined();
    expect(Object.keys(errores).sort()).toEqual(['city', 'code', 'colony', 'photos', 'price', 'rooms', 'toilets']);
  });

  it('el precio acepta comas, $ y espacios, pero no centavos ni letras', () => {
    const precio = (price: string) => validarCasa({ ...COMPLETA, price }, 1);
    expect(precio('1 490 000').payload?.price).toBe(1490000);
    expect(precio('1490000.50').errores.price).toBeDefined();
    expect(precio('mucho').errores.price).toBeDefined();
    expect(precio('0').errores.price).toBeDefined();
  });

  it('recámaras y baños aceptan 0 (un terreno) pero no negativos ni decimales', () => {
    expect(validarCasa({ ...COMPLETA, rooms: '0', toilets: '0' }, 1).payload).toMatchObject({ rooms: 0, toilets: 0 });
    expect(validarCasa({ ...COMPLETA, rooms: '-1' }, 1).errores.rooms).toBeDefined();
    expect(validarCasa({ ...COMPLETA, toilets: '1.5' }, 1).errores.toilets).toBeDefined();
  });

  it('el código postal es opcional, pero si se escribe son 5 dígitos', () => {
    expect(validarCasa({ ...COMPLETA, cp: '' }, 1).payload).not.toHaveProperty('cp');
    expect(validarCasa({ ...COMPLETA, cp: '289' }, 1).errores.cp).toBeDefined();
    expect(validarCasa({ ...COMPLETA, cp: '2897x' }, 1).errores.cp).toBeDefined();
  });

  it('los metros cuadrados aceptan decimales y rechazan texto', () => {
    expect(validarCasa({ ...COMPLETA, m2terrain: '120.5' }, 1).payload?.m2terrain).toBe(120.5);
    expect(validarCasa({ ...COMPLETA, m2build: 'grande' }, 1).errores.m2build).toBeDefined();
  });

  it('los links deben ser http(s) completos', () => {
    expect(validarCasa({ ...COMPLETA, virtualTour: 'tour.example.com/abc' }, 1).errores.virtualTour).toBeDefined();
    expect(validarCasa({ ...COMPLETA, video: 'javascript:alert(1)' }, 1).errores.video).toBeDefined();
    expect(validarCasa({ ...COMPLETA, virtualTour: 'https://tour.example.com/abc' }, 1).payload?.virtualTour).toBe(
      'https://tour.example.com/abc',
    );
  });

  it('sin fotos no hay casa, aunque lo demás esté bien', () => {
    const { errores, payload } = validarCasa(COMPLETA, 0);
    expect(payload).toBeUndefined();
    expect(errores).toEqual({ photos: 'Agrega al menos una foto.' });
  });

  it('una casa pausada viaja con status false', () => {
    expect(validarCasa({ ...COMPLETA, status: false }, 1).payload?.status).toBe(false);
  });
});

// Una casa como la devuelve GET /magentagroup.
const GUARDADA: Casa = {
  _id: '6ad03583e0b2b55e60e8184d',
  code: 'NN-HGS118',
  city: 'Villa de Álvarez',
  colony: 'Alfredo V. Bonfil',
  cp: 28979,
  typeHouse: 'Casa',
  price: 1490000,
  rooms: 3,
  toilets: 1,
  m2build: 108,
  m2terrain: 0,
  status: true,
  resume: 'Casa lista para habitar',
  url: 'https://www.realestatecolima.com/propiedad/x',
  video: '',
  virtualTour: '',
  photos: ['https://res.cloudinary.com/ubnt3unc/image/upload/v1/magentagroup/properties/a.png'],
};

describe('validarCasa al editar', () => {
  it('lo que se dejó en blanco viaja explícito (0 / ""), para poder borrarlo', () => {
    const form: CasaForm = { ...formDeCasa(GUARDADA), cp: '', m2build: '', resume: '', url: '' };

    const { errores, payload } = validarCasa(form, 1, { edicion: true });

    expect(errores).toEqual({});
    expect(payload).toMatchObject({ cp: 0, m2build: 0, m2terrain: 0, resume: '', url: '', video: '', virtualTour: '' });
  });

  it('al crear, en cambio, lo vacío no viaja', () => {
    const { payload } = validarCasa({ ...formDeCasa(GUARDADA), cp: '', m2build: '', resume: '', url: '' }, 1);

    for (const campo of ['cp', 'm2build', 'm2terrain', 'resume', 'url', 'video', 'virtualTour']) {
      expect(payload).not.toHaveProperty(campo);
    }
  });

  it('una casa guardada sin fotos se puede editar sin agregar una; al crear sigue haciendo falta', () => {
    expect(validarCasa(formDeCasa(GUARDADA), 0, { edicion: true }).errores).toEqual({});
    expect(validarCasa(formDeCasa(GUARDADA), 0).errores.photos).toBeDefined();
  });

  it('sigue validando lo demás al editar', () => {
    const { errores, payload } = validarCasa({ ...formDeCasa(GUARDADA), price: 'mucho', colony: '' }, 1, { edicion: true });

    expect(payload).toBeUndefined();
    expect(Object.keys(errores).sort()).toEqual(['colony', 'price']);
  });
});

describe('formDeCasa', () => {
  it('llena el formulario con la casa; los opcionales en 0 quedan en blanco', () => {
    expect(formDeCasa(GUARDADA)).toEqual({
      code: 'NN-HGS118',
      typeHouse: 'Casa',
      city: 'Villa de Álvarez',
      colony: 'Alfredo V. Bonfil',
      cp: '28979',
      price: '1490000',
      rooms: '3',
      toilets: '1',
      m2build: '108',
      m2terrain: '',
      resume: 'Casa lista para habitar',
      url: 'https://www.realestatecolima.com/propiedad/x',
      video: '',
      virtualTour: '',
      status: true,
    });
  });

  it('recámaras y baños en 0 se muestran como 0 (un terreno), no en blanco', () => {
    expect(formDeCasa({ ...GUARDADA, rooms: 0, toilets: 0 })).toMatchObject({ rooms: '0', toilets: '0' });
  });

  it('ida y vuelta: sin tocar nada, el formulario valida y regresa los mismos datos', () => {
    const { errores, payload } = validarCasa(formDeCasa(GUARDADA), 1, { edicion: true });

    expect(errores).toEqual({});
    expect(payload).toMatchObject({
      code: 'NN-HGS118',
      price: 1490000,
      rooms: 3,
      toilets: 1,
      cp: 28979,
      m2build: 108,
      m2terrain: 0,
      status: true,
    });
  });

  it('el tipo se reconoce sin importar mayúsculas; uno desconocido cae en Casa', () => {
    expect(formDeCasa({ ...GUARDADA, typeHouse: 'departamento' }).typeHouse).toBe('Departamento');
    expect(formDeCasa({ ...GUARDADA, typeHouse: 'Castillo' }).typeHouse).toBe('Casa');
  });

  it('una casa pausada se carga pausada; campos que faltan (catálogo viejo) no rompen', () => {
    const vieja = { _id: 'x', code: 'V-1', city: 'Colima', colony: 'Centro', typeHouse: 'Casa', price: 500000, rooms: 2, toilets: 1, photos: [] } as unknown as Casa;

    expect(formDeCasa({ ...GUARDADA, status: false }).status).toBe(false);
    expect(formDeCasa(vieja)).toMatchObject({ status: true, resume: '', url: '', cp: '', m2build: '' });
  });
});

describe('miniatura', () => {
  it('Cloudinary: pide una versión chica al servidor (la que no baja la foto completa)', () => {
    expect(miniatura('https://res.cloudinary.com/ubnt3unc/image/upload/v1760/magentagroup/properties/a.png')).toBe(
      'https://res.cloudinary.com/ubnt3unc/image/upload/f_auto,q_auto,w_400,c_limit/v1760/magentagroup/properties/a.png',
    );
    expect(miniatura('https://res.cloudinary.com/ubnt3unc/image/upload/v1/a.png', 160)).toContain('w_160');
  });

  it('catálogo viejo (_next/image): usa directo el original, no la versión de 1920 px', () => {
    const next =
      'https://www.realestatecolima.com/_next/image?url=https%3A%2F%2Fs3.amazonaws.com%2Fnocnok-img%2Fpp-1.webp&w=1920&q=100';

    expect(miniatura(next)).toBe('https://s3.amazonaws.com/nocnok-img/pp-1.webp');
  });

  it('cualquier otra URL, o algo que no es URL, se deja tal cual', () => {
    expect(miniatura('https://example.com/foto.jpg')).toBe('https://example.com/foto.jpg');
    expect(miniatura('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
    expect(miniatura('no es url')).toBe('no es url');
  });
});

describe('filtrarCasas y ordenarCasas', () => {
  const casas: Casa[] = [
    { ...GUARDADA, _id: '2', code: 'NN-HGS118', colony: 'Alfredo V. Bonfil', city: 'Villa de Álvarez', status: true },
    { ...GUARDADA, _id: '1', code: 'MG-001', colony: 'Las Palmas', city: 'Colima', typeHouse: 'Terreno', status: false },
    { ...GUARDADA, _id: '3', code: 'MG-002', colony: 'Centro', city: 'Comala', street: 'Av. Madero', status: true },
  ];

  it('busca por código, colonia, ciudad, calle o tipo, sin importar acentos ni mayúsculas', () => {
    const codigos = (texto: string) => filtrarCasas(casas, texto, 'todas').map((c) => c.code);

    expect(codigos('hgs')).toEqual(['NN-HGS118']);
    expect(codigos('alvarez')).toEqual(['NN-HGS118']); // "Álvarez" con acento
    expect(codigos('PALMAS')).toEqual(['MG-001']);
    expect(codigos('madero')).toEqual(['MG-002']);
    expect(codigos('terreno')).toEqual(['MG-001']);
    expect(codigos('')).toHaveLength(3);
    expect(codigos('zzz')).toEqual([]);
  });

  it('varias palabras deben coincidir todas (en cualquier campo)', () => {
    expect(filtrarCasas(casas, 'mg colima', 'todas').map((c) => c.code)).toEqual(['MG-001']);
  });

  it('filtra por estado', () => {
    expect(filtrarCasas(casas, '', 'activas').map((c) => c.code)).toEqual(['NN-HGS118', 'MG-002']);
    expect(filtrarCasas(casas, '', 'pausadas').map((c) => c.code)).toEqual(['MG-001']);
    expect(filtrarCasas(casas, 'mg', 'activas').map((c) => c.code)).toEqual(['MG-002']);
  });

  it('las más nuevas primero (por _id de Mongo) sin modificar el arreglo original', () => {
    const original = [...casas];

    expect(ordenarCasas(casas).map((c) => c._id)).toEqual(['3', '2', '1']);
    expect(casas).toEqual(original);
  });
});

describe('coloniasDe y coloniaExistente', () => {
  const casas = [
    { city: 'Villa de Álvarez', colony: 'Alfredo V. Bonfil' },
    { city: 'Colima', colony: 'Las Palmas' },
    { city: 'Villa de Alvarez', colony: ' alfredo v. bonfil ' }, // repetida: otra ciudad escrita sin acento
    { city: 'Colima', colony: 'Centro' },
    { city: 'Colima', colony: 'Álamos' },
    { city: 'Colima', colony: '   ' }, // vacía: no cuenta
  ];

  it('regresa cada colonia una vez y en orden alfabético (con acentos en su lugar)', () => {
    expect(coloniasDe(casas)).toEqual(['Álamos', 'Alfredo V. Bonfil', 'Centro', 'Las Palmas']);
  });

  it('con ciudad, solo las de esa ciudad (sin importar acentos ni mayúsculas)', () => {
    expect(coloniasDe(casas, 'colima')).toEqual(['Álamos', 'Centro', 'Las Palmas']);
    expect(coloniasDe(casas, 'villa de alvarez')).toEqual(['Alfredo V. Bonfil']);
  });

  it('una ciudad sin colonias o escrita a medias no deja la lista vacía: regresa todas', () => {
    expect(coloniasDe(casas, 'Comala')).toHaveLength(4);
    expect(coloniasDe(casas, 'Villa de')).toHaveLength(4);
  });

  it('una ciudad en blanco no filtra', () => {
    expect(coloniasDe(casas, '  ')).toHaveLength(4);
  });

  it('reconoce una colonia que ya está aunque la escriban distinto', () => {
    const lista = ['Álamos', 'Las Palmas'];

    expect(coloniaExistente(lista, 'alamos')).toBe('Álamos');
    expect(coloniaExistente(lista, '  las   PALMAS ')).toBe('Las Palmas');
    expect(coloniaExistente(lista, 'Centro')).toBeUndefined();
    expect(coloniaExistente(lista, '   ')).toBeUndefined();
  });
});

describe('ciudadCanonica', () => {
  it('lleva cualquier escritura de las 3 ciudades a la de la lista', () => {
    expect(ciudadCanonica('villa de alvarez')).toBe('Villa de Álvarez');
    expect(ciudadCanonica('  COLIMA ')).toBe('Colima');
    expect(ciudadCanonica('comala')).toBe('Comala');
    expect(CIUDADES).toHaveLength(3);
  });

  it('una ciudad desconocida se conserva (limpia) y formDeCasa normaliza la guardada', () => {
    expect(ciudadCanonica('  Manzanillo  ')).toBe('Manzanillo');
    expect(formDeCasa({ _id: '1', code: 'A', city: 'villa de alvarez', colony: 'X', typeHouse: 'Casa', price: 1, rooms: 0, toilets: 0, status: true, photos: [] }).city).toBe('Villa de Álvarez');
  });
});
