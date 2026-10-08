// Monta el panel heredado como lo hace la app y recorre lo que cambió al
// pasarlo a Tauri: fetch local, sesión, diálogos propios en lugar de
// alert/confirm/prompt, guardar archivo y desmontaje limpio.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { montarDashboard } from './dashboard';

interface Peticion {
  metodo: string;
  url: string;
  body: unknown;
}

function crearBackendFalso(respuestas: Record<string, unknown> = {}) {
  const peticiones: Peticion[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const metodo = (init.method || 'GET').toUpperCase();
    peticiones.push({ metodo, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const clave = `${metodo} ${url.split('?')[0]}`;
    const cuerpo = clave in respuestas ? respuestas[clave] : metodo === 'GET' ? [] : { ok: true };
    const status = (cuerpo as { __status?: number })?.__status ?? 200;
    return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
  });
  return { fetch, peticiones };
}

function montar(respuestas?: Record<string, unknown>) {
  const raiz = document.createElement('div');
  document.body.appendChild(raiz);
  const backend = crearBackendFalso(respuestas);
  const opciones = {
    fetch: backend.fetch,
    usuario: { nombre: 'Julio' },
    cerrarSesion: vi.fn(),
    volverAlInicio: vi.fn(),
    alExpirarSesion: vi.fn(),
    guardarArchivo: vi.fn(async () => true),
  };
  const desmontar = montarDashboard(raiz, opciones);
  return { raiz, backend, opciones, desmontar };
}

const esperar = () => new Promise((r) => setTimeout(r, 0));
async function hastaQue(condicion: () => boolean) {
  for (let i = 0; i < 50 && !condicion(); i++) await esperar();
  expect(condicion()).toBe(true);
}
const boton = (texto: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto) as HTMLButtonElement;
const pestana = (estatus: string) => document.querySelector(`.tab[data-estatus="${estatus}"]`) as HTMLButtonElement;

afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-modulo]').forEach((s) => s.remove());
});

describe('panel de Colima Go dentro de la app', () => {
  it('se monta, saluda y carga pendientes y lugares', async () => {
    const { backend } = montar();
    expect(document.getElementById('bienvenida')?.textContent).toBe('Bienvenido, Julio');
    expect(document.getElementById('avatar-inicial')?.textContent).toBe('J');
    expect(document.head.querySelector('style[data-modulo="colima-go"]')).not.toBeNull();
    await hastaQue(() => backend.peticiones.length >= 2);
    expect(backend.peticiones.map((p) => p.url)).toEqual(['/api/pendientes?estatus=pendiente', '/api/lugares']);
    await hastaQue(() => document.getElementById('lista')!.textContent!.includes('Todo revisado'));
  });

  it('cerrar sesión llama a la app', () => {
    const { opciones } = montar();
    (document.getElementById('btn-logout') as HTMLButtonElement).click();
    expect(opciones.cerrarSesion).toHaveBeenCalledOnce();
  });

  it('el botón Inicio regresa a las tarjetas de la app', () => {
    const { opciones } = montar();
    (document.getElementById('btn-inicio') as HTMLButtonElement).click();
    expect(opciones.volverAlInicio).toHaveBeenCalledOnce();
  });

  it('un 401 del backend regresa al login con su mensaje', async () => {
    const { opciones } = montar({
      'GET /api/pendientes': { __status: 401, error: 'Token expirado', backendStatus: 401 },
    });
    await hastaQue(() => opciones.alExpirarSesion.mock.calls.length > 0);
    expect(opciones.alExpirarSesion).toHaveBeenCalledWith('Token expirado');
  });

  it('borrar un lugar pide confirmación con un diálogo propio (sin confirm())', async () => {
    const confirmNativo = vi.spyOn(window, 'confirm');
    const { backend } = montar({ 'GET /api/lugares': [{ _id: 'l1', nombre: 'Jardín', latitud: '19', longitud: '-103' }] });
    pestana('lugares').click();
    await hastaQue(() => !!document.querySelector('#tbody-lugares tr[data-id="l1"]'));

    (document.querySelector('#tbody-lugares [data-accion="borrar"]') as HTMLButtonElement).click();
    await hastaQue(() => !!document.querySelector('.modal-overlay'));
    expect(document.querySelector('.texto-dialogo')?.textContent).toBe('¿Borrar este lugar?');

    // Cancelar no borra nada
    boton('Cancelar').click();
    await esperar();
    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(backend.peticiones.some((p) => p.metodo === 'DELETE')).toBe(false);

    // Confirmar sí
    (document.querySelector('#tbody-lugares [data-accion="borrar"]') as HTMLButtonElement).click();
    await hastaQue(() => !!document.querySelector('.modal-overlay'));
    const aceptar = document.querySelector('.modal-overlay [data-dialogo="aceptar"]') as HTMLButtonElement;
    expect(aceptar.textContent).toBe('Borrar');
    aceptar.click();
    await hastaQue(() => backend.peticiones.some((p) => p.metodo === 'DELETE'));
    expect(backend.peticiones.find((p) => p.metodo === 'DELETE')?.url).toBe('/api/lugares/l1');
    expect(confirmNativo).not.toHaveBeenCalled();
  });

  it('Escape cancela el diálogo', async () => {
    const { backend } = montar({ 'GET /api/directorio': [{ _id: 'd1', municipio_nombre: 'Colima', facebook_id: '1' }] });
    pestana('directorio').click();
    await hastaQue(() => !!document.querySelector('#tbody-directorio tr[data-id="d1"]'));
    (document.querySelector('#tbody-directorio [data-accion="borrar"]') as HTMLButtonElement).click();
    await hastaQue(() => !!document.querySelector('.modal-overlay'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await esperar();
    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(backend.peticiones.some((p) => p.metodo === 'DELETE')).toBe(false);
  });

  it('editar directorio usa un formulario con los valores actuales (sin prompt())', async () => {
    const promptNativo = vi.spyOn(window, 'prompt');
    const { backend } = montar({
      'GET /api/directorio': [{ _id: 'd1', municipio_nombre: 'Colima', facebook_id: '111', facebook_url: 'https://facebook.com/a' }],
    });
    pestana('directorio').click();
    await hastaQue(() => !!document.querySelector('#tbody-directorio tr[data-id="d1"]'));
    (document.querySelector('#tbody-directorio [data-accion="editar"]') as HTMLButtonElement).click();
    await hastaQue(() => !!document.querySelector('.form-dialogo'));

    const campoId = document.getElementById('dialogo-campo-0') as HTMLInputElement;
    expect(campoId.value).toBe('111');
    expect((document.getElementById('dialogo-campo-1') as HTMLInputElement).value).toBe('https://facebook.com/a');
    campoId.value = '222';
    (document.querySelector('.form-dialogo') as HTMLFormElement).requestSubmit();

    await hastaQue(() => backend.peticiones.some((p) => p.metodo === 'PUT'));
    expect(backend.peticiones.find((p) => p.metodo === 'PUT')).toEqual({
      metodo: 'PUT',
      url: '/api/directorio/d1',
      body: { facebook_id: '222', facebook_url: 'https://facebook.com/a' },
    });
    expect(promptNativo).not.toHaveBeenCalled();
  });

  it('un error del backend se avisa con un diálogo propio (sin alert())', async () => {
    const alertNativo = vi.spyOn(window, 'alert');
    montar({
      'GET /api/posts': [{ _id: 'p1', title: 'Feria', status: true, images: [] }],
      'POST /api/posts/p1/pausar': { __status: 403, error: 'Sin permisos', backendStatus: 403 },
    });
    pestana('activo').click();
    await hastaQue(() => !!boton('Pausar'));
    boton('Pausar').click();
    await hastaQue(() => document.querySelector('.texto-dialogo')?.textContent === 'Sin permisos');
    expect(alertNativo).not.toHaveBeenCalled();
  });

  it('exportar el catálogo pasa por guardarArchivo', async () => {
    const { opciones } = montar({ 'GET /api/locales/export': { response: true, catalog: [1, 2] } });
    pestana('locales').click();
    await hastaQue(() => !!document.getElementById('btn-exportar-catalogo'));
    (document.getElementById('btn-exportar-catalogo') as HTMLButtonElement).click();
    await hastaQue(() => opciones.guardarArchivo.mock.calls.length > 0);
    const [nombre, contenido] = opciones.guardarArchivo.mock.calls[0] as unknown as [string, string];
    expect(nombre).toBe('catalog.json');
    expect(JSON.parse(contenido)).toEqual({ response: true, catalog: [1, 2] });
  });

  it('al desmontarse no deja estilos, modales ni listeners', async () => {
    const { desmontar, raiz } = montar({ 'GET /api/lugares': [{ _id: 'l1', nombre: 'Jardín' }] });
    pestana('lugares').click();
    await hastaQue(() => !!document.querySelector('#tbody-lugares [data-accion="borrar"]'));
    (document.querySelector('#tbody-lugares [data-accion="borrar"]') as HTMLButtonElement).click();
    await hastaQue(() => !!document.querySelector('.modal-overlay'));

    desmontar();
    expect(raiz.innerHTML).toBe('');
    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(document.head.querySelector('style[data-modulo="colima-go"]')).toBeNull();
  });
});
