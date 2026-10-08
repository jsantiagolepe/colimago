// Port de scripts/verificar-backend.js de la versión web: cada ruta /api/*
// del panel debe llegar al endpoint correcto del backend, con el cuerpo
// esperado, sin que el token viaje nunca desde el frontend (lo pone Rust),
// y los errores del backend deben llegar al panel con su status y mensaje.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Llamada {
  cmd: string;
  method?: string;
  path?: string;
  query?: Record<string, string>;
  body?: Record<string, unknown> | null;
  url?: string;
}

const llamadas: Llamada[] = [];
let siguiente: unknown = null;
let siguienteError: unknown = null;

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, args: Record<string, unknown> = {}) => {
    llamadas.push({ cmd, ...args } as Llamada);
    if (siguienteError) {
      const err = siguienteError;
      siguienteError = null;
      throw err;
    }
    if (cmd === 'resolve_maps_link') return 'https://www.google.com/maps/place/Jard%C3%ADn/@19.24,-103.72';
    if (siguiente) {
      const respuesta = siguiente;
      siguiente = null;
      return respuesta;
    }
    return { status: 200, body: { response: true, eventos: [], posts: [], lugares: [], registros: [], locales: [] } };
  }),
}));

const { fetchColimaGo } = await import('./index');

function llamar(metodo: string, ruta: string, body?: unknown) {
  return fetchColimaGo(ruta, {
    method: metodo,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  llamadas.length = 0;
  siguiente = null;
  siguienteError = null;
});

describe('rutas del panel → backend', () => {
  const casos: Array<[string, string, unknown, string, string]> = [
    ['GET', '/api/pendientes?estatus=pendiente', undefined, 'GET', '/eventos-pendientes'],
    ['GET', '/api/pendientes/mismo-dia?fecha=2026-09-17&excluir=abc', undefined, 'GET', '/eventos-pendientes/mismo-dia'],
    ['POST', '/api/pendientes/abc/traducir', undefined, 'POST', '/eventos-pendientes/traducir'],
    ['POST', '/api/pendientes/abc/aprobar', { title: 'x' }, 'POST', '/eventos-pendientes/aprobar'],
    ['POST', '/api/pendientes/abc/rechazar', undefined, 'POST', '/eventos-pendientes/rechazar'],
    ['POST', '/api/pendientes/abc/deshacer', undefined, 'POST', '/eventos-pendientes/deshacer'],
    ['POST', '/api/pendientes/abc/publicar', undefined, 'POST', '/eventos-pendientes/publicar'],
    ['GET', '/api/directorio', undefined, 'GET', '/directorio-municipios'],
    ['POST', '/api/directorio', { municipio_nombre: 'Colima', facebook_id: 1 }, 'POST', '/directorio-municipios'],
    ['PUT', '/api/directorio/abc', { facebook_id: 2 }, 'PATCH', '/directorio-municipios'],
    ['DELETE', '/api/directorio/abc', undefined, 'DELETE', '/directorio-municipios'],
    ['GET', '/api/lugares', undefined, 'GET', '/lugares'],
    ['POST', '/api/lugares', { nombre: 'Jardín' }, 'POST', '/lugares'],
    ['PUT', '/api/lugares/abc', { nombre: 'Jardín 2' }, 'PATCH', '/lugares'],
    ['DELETE', '/api/lugares/abc', undefined, 'DELETE', '/lugares'],
    ['GET', '/api/posts-admin?q=feria', undefined, 'GET', '/post/admin-search'],
    ['PUT', '/api/posts-admin/abc', { title: 'Nuevo', _id: 'zzz' }, 'PATCH', '/post/admin-update'],
    ['GET', '/api/posts?estatus=activo', undefined, 'GET', '/post/production'],
    ['POST', '/api/posts/abc/pausar', undefined, 'PATCH', '/post/production/pause'],
    ['POST', '/api/posts/abc/activar', undefined, 'PATCH', '/post/production/activate'],
    ['POST', '/api/posts/abc/papelera', undefined, 'PATCH', '/post/production/trash'],
    ['POST', '/api/posts/abc/restaurar', undefined, 'PATCH', '/post/production/restore'],
    ['DELETE', '/api/posts/abc', undefined, 'DELETE', '/post'],
    ['GET', '/api/locales?type=10', undefined, 'GET', '/post/local'],
    ['POST', '/api/locales', { title: 'Río', location: {} }, 'POST', '/post/local'],
    ['PUT', '/api/locales/abc', { title: 'Río 2' }, 'PATCH', '/post/local'],
    ['POST', '/api/locales/abc/baja', undefined, 'DELETE', '/post/local'],
    ['POST', '/api/locales/abc/reactivar', undefined, 'PATCH', '/post/local'],
    ['GET', '/api/locales/export', undefined, 'GET', '/post/export-locales'],
  ];

  it.each(casos)('%s %s → backend %s %s', async (metodo, ruta, body, metodoBackend, rutaBackend) => {
    const res = await llamar(metodo, ruta, body);
    expect(res.status).toBe(200);
    expect(llamadas).toHaveLength(1);
    const [llamada] = llamadas;
    expect(llamada.cmd).toBe('backend_request');
    expect(llamada.method).toBe(metodoBackend);
    expect(llamada.path).toBe(rutaBackend);
    // El token nunca sale del frontend: lo agrega Rust.
    expect(JSON.stringify(llamada)).not.toMatch(/token/i);
    if (metodoBackend === 'GET') expect(llamada.body).toBeNull();
  });

  it('manda los cuerpos y la query como server.js', async () => {
    await llamar('POST', '/api/pendientes/abc/aprobar', { title: 'Feria', date: '2026-10-10' });
    expect(llamadas.at(-1)?.body).toEqual({ title: 'Feria', date: '2026-10-10', id: 'abc' });

    await llamar('POST', '/api/directorio', { municipio_nombre: 'Colima', facebook_id: 141016 });
    expect(llamadas.at(-1)?.body).toMatchObject({ facebook_id: '141016', municipio_nombre: 'Colima' });

    await llamar('PUT', '/api/posts-admin/abc', { title: 'Nuevo', _id: 'zzz' });
    expect(llamadas.at(-1)?.body).toEqual({ id: 'abc', cambios: { title: 'Nuevo' } });

    await llamar('POST', '/api/locales', { title: 'Río', location: { name: 'X' } });
    expect(llamadas.at(-1)?.body).toEqual({ title: 'Río', location: { name: 'X', idLocation: '' } });

    await llamar('POST', '/api/locales/abc/reactivar');
    expect(llamadas.at(-1)?.body).toEqual({ id: 'abc', status: true });

    await llamar('GET', '/api/pendientes/mismo-dia?fecha=2026-09-17&excluir=abc');
    expect(llamadas.at(-1)?.query).toEqual({ fecha: '2026-09-17', excluir: 'abc' });

    await llamar('GET', '/api/pendientes');
    expect(llamadas.at(-1)?.query).toEqual({ estatus: 'pendiente' });

    await llamar('GET', '/api/posts-admin');
    expect(llamadas.at(-1)?.query).toEqual({});
  });

  it('regresa los datos con la forma de antes', async () => {
    siguiente = { status: 200, body: { response: true, eventos: [{ _id: '1' }] } };
    expect(await (await llamar('GET', '/api/pendientes')).json()).toEqual([{ _id: '1' }]);

    siguiente = { status: 200, body: { response: true, registro: { _id: 'r1' } } };
    expect(await (await llamar('POST', '/api/directorio', { municipio_nombre: 'Colima', facebook_id: '1' })).json()).toEqual({
      ok: true,
      _id: 'r1',
    });

    siguiente = { status: 200, body: { response: true, descriptionEnglish: 'Hello' } };
    expect(await (await llamar('POST', '/api/pendientes/abc/traducir')).json()).toEqual({ descriptionEnglish: 'Hello' });
  });
});

describe('errores del backend', () => {
  it.each([401, 403, 429, 400])('backend %i → panel con el mismo status y su mensaje', async (status) => {
    siguiente = { status, body: { message: `Mensaje simulado ${status}`, statusCode: status } };
    const res = await llamar('GET', '/api/posts?estatus=activo');
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: `Mensaje simulado ${status}`, backendStatus: status });
  });

  it('NestJS con message en arreglo', async () => {
    siguiente = { status: 400, body: { message: ['title es obligatorio', 'date no es fecha'] } };
    const data = await (await llamar('POST', '/api/locales', { title: '' })).json();
    expect(data.error).toBe('title es obligatorio. date no es fecha');
  });

  it('200 con { response:false } → 400 con el mensaje', async () => {
    siguiente = { status: 200, body: { response: false, message: 'Campos no permitidos: campoRaro' } };
    const res = await llamar('PUT', '/api/posts-admin/abc', { campoRaro: 1 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Campos no permitidos: campoRaro');
  });

  it('{ response:false } sin mensaje usa el de la ruta', async () => {
    siguiente = { status: 200, body: { response: false } };
    const res = await llamar('POST', '/api/pendientes/abc/rechazar');
    expect((await res.json()).error).toBe('No se pudo rechazar el evento');
  });

  it('503 de Heroku → 502', async () => {
    siguiente = { status: 503, body: {} };
    const res = await llamar('GET', '/api/lugares');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'El backend de ColimaApp respondió 503', backendStatus: 503 });
  });

  it('sin sesión → 401 sin backendStatus (el panel vuelve al login sin aviso extra)', async () => {
    siguienteError = { kind: 'notAuthenticated', message: 'No has iniciado sesión.' };
    const res = await llamar('GET', '/api/lugares');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'No has iniciado sesión.' });
  });

  it('red caída → 500 con un mensaje claro', async () => {
    siguienteError = { kind: 'network', message: 'No se pudo conectar con el backend. Revisa tu conexión a internet.' };
    const res = await llamar('GET', '/api/directorio');
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/conexión a internet/);
  });
});

describe('validaciones locales (no llegan al backend)', () => {
  it.each([
    ['POST', '/api/directorio', { municipio_nombre: 'Colima' }, 'Falta el ID de Facebook'],
    ['POST', '/api/lugares', { nota: 'x' }, 'Falta el nombre del lugar'],
    ['GET', '/api/pendientes/mismo-dia?fecha=ayer', undefined, 'Falta una fecha válida'],
  ])('%s %s', async (metodo, ruta, body, mensaje) => {
    const res = await llamar(metodo, ruta, body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(mensaje);
    expect(llamadas).toHaveLength(0);
  });

  it('cuerpo que no es objeto JSON', async () => {
    const res = await fetchColimaGo('/api/posts-admin/abc', { method: 'PUT', body: '[1,2]' });
    expect(res.status).toBe(400);
    expect(llamadas).toHaveLength(0);
  });

  it('ruta inexistente → 404', async () => {
    const res = await llamar('GET', '/api/no-existe');
    expect(res.status).toBe(404);
  });
});

describe('link corto de Google Maps', () => {
  it('lo resuelve Rust', async () => {
    const res = await llamar('GET', `/api/resolver-maps?url=${encodeURIComponent('https://maps.app.goo.gl/abc')}`);
    expect(await res.json()).toEqual({ url: 'https://www.google.com/maps/place/Jard%C3%ADn/@19.24,-103.72' });
    expect(llamadas[0]).toEqual({ cmd: 'resolve_maps_link', url: 'https://maps.app.goo.gl/abc' });
  });

  it('link inválido → 400', async () => {
    siguienteError = { kind: 'invalidRequest', message: 'Solo se aceptan links cortos de Google Maps.' };
    const res = await llamar('GET', '/api/resolver-maps?url=https://evil.com');
    expect(res.status).toBe(400);
  });
});
