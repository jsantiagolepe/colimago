import { beforeEach, describe, expect, it, vi } from 'vitest';

const { llamarBackend } = vi.hoisted(() => ({ llamarBackend: vi.fn() }));
vi.mock('../../core/backend/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/backend/client')>()),
  llamarBackend,
}));

import { BackendError } from '../../core/backend/client';
import {
  actualizarCasa,
  borrarCasa,
  guardarColonia,
  listarCasas,
  listarColonias,
  mensajeDeError,
  subirFotos,
  SubidaCancelada,
  type AvanceSubida,
  type FotoPorSubir,
} from './house-upload';

beforeEach(() => {
  llamarBackend.mockReset();
});

// Reloj falso: `dormir` solo adelanta la hora, así las pruebas no esperan.
function entorno(subir: (archivo: Blob) => Promise<string>) {
  let reloj = 0;
  const dormido: number[] = [];
  return {
    dep: {
      subir,
      ahora: () => reloj,
      dormir: async (ms: number) => {
        dormido.push(ms);
        reloj += ms;
      },
    },
    dormido,
    avanzar: (ms: number) => (reloj += ms),
  };
}

const fotos = (n: number): FotoPorSubir[] => Array.from({ length: n }, (_, i) => ({ file: new Blob([`foto${i}`]) }));

describe('subirFotos', () => {
  it('sube en orden y regresa las URLs en el mismo orden', async () => {
    let n = 0;
    const { dep } = entorno(async () => `https://res.cloudinary.com/x/${n++}.jpg`);
    const lista = fotos(3);

    const urls = await subirFotos(lista, () => {}, () => false, dep);

    expect(urls).toEqual([0, 1, 2].map((i) => `https://res.cloudinary.com/x/${i}.jpg`));
    expect(lista.map((f) => f.url)).toEqual(urls);
  });

  it('una casa de 15 fotos no pasa de 9 subidas por minuto: espera a que se libere la ventana', async () => {
    const instantes: number[] = [];
    const e = entorno(async () => 'https://x/y.jpg');
    const dep = { ...e.dep, subir: async () => (instantes.push(e.dep.ahora()), 'https://x/y.jpg') };

    await subirFotos(fotos(15), () => {}, () => false, dep);

    expect(instantes).toHaveLength(15);
    for (const t of instantes) {
      const enLaVentana = instantes.filter((u) => u >= t && u < t + 60_000).length;
      expect(enLaVentana).toBeLessThanOrEqual(9);
    }
    expect(e.dormido.length).toBeGreaterThan(0); // sí tuvo que esperar
  });

  it('un reintento retoma donde se quedó: las fotos ya subidas no se vuelven a subir', async () => {
    const subir = vi.fn().mockResolvedValueOnce('https://x/0.jpg').mockResolvedValueOnce('https://x/1.jpg').mockRejectedValueOnce(
      new BackendError(502, 'El backend respondió 503'),
    );
    const lista = fotos(4);

    await expect(subirFotos(lista, () => {}, () => false, entorno(subir).dep)).rejects.toThrow('503');
    expect(lista.map((f) => f.url)).toEqual(['https://x/0.jpg', 'https://x/1.jpg', undefined, undefined]);

    subir.mockReset().mockResolvedValueOnce('https://x/2.jpg').mockResolvedValueOnce('https://x/3.jpg');
    const urls = await subirFotos(lista, () => {}, () => false, entorno(subir).dep);

    expect(subir).toHaveBeenCalledTimes(2);
    expect(urls).toEqual(['https://x/0.jpg', 'https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']);
  });

  it('un 429 espera 20 s y reintenta la misma foto', async () => {
    const subir = vi.fn().mockRejectedValueOnce(new BackendError(429, 'Demasiadas peticiones')).mockResolvedValueOnce('https://x/0.jpg');
    const e = entorno(subir);
    const avances: AvanceSubida[] = [];

    const urls = await subirFotos(fotos(1), (a) => avances.push(a), () => false, e.dep);

    expect(urls).toEqual(['https://x/0.jpg']);
    expect(subir).toHaveBeenCalledTimes(2);
    expect(e.dormido.reduce((a, b) => a + b, 0)).toBe(20_000);
    expect(avances.some((a) => a.esperaSegundos === 20)).toBe(true);
  });

  it('si el 429 no se quita tras los reintentos, falla con ese error', async () => {
    const subir = vi.fn().mockRejectedValue(new BackendError(429, 'Demasiadas peticiones'));

    await expect(subirFotos(fotos(1), () => {}, () => false, entorno(subir).dep)).rejects.toMatchObject({ status: 429 });
    expect(subir).toHaveBeenCalledTimes(4); // el intento original + 3 reintentos
  });

  it('otro error del backend no se reintenta', async () => {
    const subir = vi.fn().mockRejectedValue(new BackendError(400, 'Formato no permitido'));

    await expect(subirFotos(fotos(2), () => {}, () => false, entorno(subir).dep)).rejects.toThrow('Formato no permitido');
    expect(subir).toHaveBeenCalledTimes(1);
  });

  it('al cancelar (salir de la pantalla) no sube la siguiente foto', async () => {
    let cancelar = false;
    const subir = vi.fn(async () => {
      cancelar = true;
      return 'https://x/0.jpg';
    });

    await expect(subirFotos(fotos(3), () => {}, () => cancelar, entorno(subir).dep)).rejects.toBeInstanceOf(SubidaCancelada);
    expect(subir).toHaveBeenCalledTimes(1);
  });

  it('informa el avance foto por foto', async () => {
    const avances: AvanceSubida[] = [];
    await subirFotos(fotos(2), (a) => avances.push({ ...a }), () => false, entorno(async () => 'https://x/y.jpg').dep);

    expect(avances.map((a) => `${a.hechas}/${a.total}`)).toEqual(['0/2', '1/2', '2/2']);
  });
});

describe('subirFotos con fotos que la casa ya tenía (edición)', () => {
  it('no vuelve a subir las que ya tienen URL, las conserva en su lugar y solo cuenta las nuevas', async () => {
    const lista: FotoPorSubir[] = [
      { url: 'https://res.cloudinary.com/x/vieja1.jpg' },
      { file: new Blob(['nueva']) },
      { url: 'https://res.cloudinary.com/x/vieja2.jpg' },
    ];
    const subir = vi.fn().mockResolvedValue('https://res.cloudinary.com/x/nueva.jpg');
    const avances: AvanceSubida[] = [];

    const urls = await subirFotos(lista, (a) => avances.push({ ...a }), () => false, entorno(subir).dep);

    expect(subir).toHaveBeenCalledTimes(1);
    expect(urls).toEqual([
      'https://res.cloudinary.com/x/vieja1.jpg',
      'https://res.cloudinary.com/x/nueva.jpg',
      'https://res.cloudinary.com/x/vieja2.jpg',
    ]);
    expect(avances.map((a) => `${a.hechas}/${a.total}`)).toEqual(['0/1', '1/1']);
  });

  it('sin fotos nuevas no sube nada y regresa las mismas URLs', async () => {
    const subir = vi.fn();
    const lista: FotoPorSubir[] = [{ url: 'https://x/1.jpg' }, { url: 'https://x/2.jpg' }];

    expect(await subirFotos(lista, () => {}, () => false, entorno(subir).dep)).toEqual(['https://x/1.jpg', 'https://x/2.jpg']);
    expect(subir).not.toHaveBeenCalled();
  });
});

describe('llamadas al catálogo', () => {
  const CASA = { _id: 'aaa', code: 'MG-001' };

  it('listarCasas pide GET /magentagroup y regresa las más nuevas primero', async () => {
    llamarBackend.mockResolvedValue([{ _id: '1', code: 'viejo' }, { _id: '3', code: 'nuevo' }, { _id: '2', code: 'medio' }]);

    const casas = await listarCasas();

    expect(llamarBackend).toHaveBeenCalledWith('/magentagroup', expect.objectContaining({ mensajeError: expect.any(String) }));
    expect(casas.map((c) => c.code)).toEqual(['nuevo', 'medio', 'viejo']);
  });

  it('listarCasas con un catálogo vacío regresa []', async () => {
    llamarBackend.mockResolvedValue([]);

    expect(await listarCasas()).toEqual([]);
  });

  it('listarCasas rechaza una respuesta que no es una lista', async () => {
    llamarBackend.mockResolvedValue({ message: 'raro' });

    await expect(listarCasas()).rejects.toMatchObject({ status: 502 });
  });

  it('actualizarCasa hace PATCH /magentagroup/:id con los campos y las fotos', async () => {
    llamarBackend.mockResolvedValue({ response: true });

    await actualizarCasa('6ad03583e0b2b55e60e8184d', { price: 1200000, photos: ['https://x/1.jpg'] });

    expect(llamarBackend).toHaveBeenCalledWith(
      '/magentagroup/6ad03583e0b2b55e60e8184d',
      expect.objectContaining({ method: 'PATCH', body: { price: 1200000, photos: ['https://x/1.jpg'] } }),
    );
  });

  it('borrarCasa hace DELETE /magentagroup con el id en el cuerpo', async () => {
    llamarBackend.mockResolvedValue({ response: true });

    await borrarCasa(CASA._id);

    expect(llamarBackend).toHaveBeenCalledWith('/magentagroup', expect.objectContaining({ method: 'DELETE', body: { id: 'aaa' } }));
  });

  it('listarColonias pide GET /magentagroup/colonias y regresa la lista tal cual', async () => {
    const lista = [{ city: 'Colima', colony: 'Centro' }, { city: 'Comala', colony: 'Suchitlán' }];
    llamarBackend.mockResolvedValue(lista);

    expect(await listarColonias()).toEqual(lista);
    expect(llamarBackend).toHaveBeenCalledWith('/magentagroup/colonias', expect.not.objectContaining({ method: 'POST' }));
  });

  it('listarColonias rechaza una respuesta que no es una lista', async () => {
    llamarBackend.mockResolvedValue({ message: 'raro' });

    await expect(listarColonias()).rejects.toMatchObject({ status: 502 });
  });

  it('guardarColonia hace POST /magentagroup/colonias con la ciudad y la colonia', async () => {
    llamarBackend.mockResolvedValue({ response: true, colony: { city: 'Colima', colony: 'San Bernardo' } });

    const guardada = await guardarColonia('Colima', 'San Bernardo');

    expect(guardada).toEqual({ city: 'Colima', colony: 'San Bernardo' });
    expect(llamarBackend).toHaveBeenCalledWith(
      '/magentagroup/colonias',
      expect.objectContaining({ method: 'POST', body: { city: 'Colima', colony: 'San Bernardo' } }),
    );
  });

  it('guardarColonia regresa la que ya estaba guardada si el backend la reconoció con otra escritura', async () => {
    llamarBackend.mockResolvedValue({ response: true, colony: { city: 'Colima', colony: 'Álamos' } });

    expect(await guardarColonia('colima', 'alamos')).toEqual({ city: 'Colima', colony: 'Álamos' });
  });

  it('guardarColonia usa lo que se mandó si la respuesta no trae la colonia', async () => {
    llamarBackend.mockResolvedValue({ response: true });

    expect(await guardarColonia('Colima', 'Centro')).toEqual({ city: 'Colima', colony: 'Centro' });
  });

  it('guardarColonia deja pasar el error del backend (p. ej. sin permiso de administrador)', async () => {
    llamarBackend.mockRejectedValue(new BackendError(403, 'Esta cuenta no tiene permisos de administrador en el backend.'));

    await expect(guardarColonia('Colima', 'Centro')).rejects.toMatchObject({ status: 403 });
  });

  it('un error del backend (p. ej. código repetido o sin permiso) llega tal cual', async () => {
    llamarBackend.mockRejectedValue(new BackendError(400, 'Ya existe una propiedad con el código MG-001'));

    await expect(actualizarCasa('aaa', { code: 'MG-001' })).rejects.toThrow('Ya existe una propiedad con el código MG-001');
  });

  it('mensajeDeError usa el mensaje del error, o uno genérico si no hay', () => {
    expect(mensajeDeError(new BackendError(403, 'Sin permisos'))).toBe('Sin permisos');
    expect(mensajeDeError('texto suelto')).toBe('Ocurrió un error inesperado.');
  });
});
