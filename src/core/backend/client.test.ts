import { beforeEach, describe, expect, it, vi } from 'vitest';

const { command } = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock('../tauri', async (importOriginal) => ({ ...(await importOriginal<typeof import('../tauri')>()), command }));

import { BackendError, llamarBackend, subirImagen } from './client';

const FOTO = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])]);

beforeEach(() => {
  command.mockReset();
});

describe('subirImagen', () => {
  it('manda los bytes crudos con el destino y la carpeta en cabeceras, y regresa la URL', async () => {
    command.mockResolvedValue({
      status: 201,
      body: { response: true, url: 'https://res.cloudinary.com/ubnt3unc/image/upload/v1/magentagroup/properties/a.png' },
    });

    const url = await subirImagen('/magentagroup/images', 'magentagroup/properties', FOTO);

    expect(url).toBe('https://res.cloudinary.com/ubnt3unc/image/upload/v1/magentagroup/properties/a.png');
    const [nombre, bytes, opciones] = command.mock.calls[0];
    expect(nombre).toBe('backend_upload_image');
    expect(Array.from(bytes as Uint8Array)).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    expect(opciones).toEqual({ headers: { 'x-endpoint': '/magentagroup/images', 'x-folder': 'magentagroup/properties' } });
  });

  it('la cuenta principal sigue disponible en /images', async () => {
    command.mockResolvedValue({ status: 201, body: { response: true, url: 'https://res.cloudinary.com/main/x.jpg' } });

    await subirImagen('/images', 'posts', FOTO);

    expect(command.mock.calls[0][2]).toEqual({ headers: { 'x-endpoint': '/images', 'x-folder': 'posts' } });
  });

  it('503 con mensaje: dice que el servidor de fotos no está configurado y qué le falta', async () => {
    command.mockResolvedValue({ status: 503, body: { message: 'Faltan CLOUDINARY_API_KEY_MAGENTA, CLOUDINARY_API_SECRET_MAGENTA' } });

    const error = await subirImagen('/magentagroup/images', 'magentagroup/properties', FOTO).catch((e) => e);

    expect(error).toBeInstanceOf(BackendError);
    expect(error.status).toBe(503);
    expect(error.message).toContain('no está configurado');
    expect(error.message).toContain('CLOUDINARY_API_KEY_MAGENTA');
  });

  it('503 sin mensaje (Heroku contesta HTML): texto claro de que es del servidor', async () => {
    command.mockResolvedValue({ status: 503, body: {} });

    const error = await subirImagen('/magentagroup/images', 'magentagroup/properties', FOTO).catch((e) => e);

    expect(error.status).toBe(503);
    expect(error.message).toContain('problema del servidor');
  });

  it('429: avisa del límite de 10 fotos por minuto (no el "ThrottlerException" crudo)', async () => {
    command.mockResolvedValue({ status: 429, body: { message: 'ThrottlerException: Too Many Requests' } });

    const error = await subirImagen('/magentagroup/images', 'magentagroup/properties', FOTO).catch((e) => e);

    expect(error.status).toBe(429);
    expect(error.message).toContain('10 fotos por minuto');
    expect(error.message).not.toContain('Throttler');
  });

  it('413: la foto pesa más de 8 MB', async () => {
    command.mockResolvedValue({ status: 413, body: {} });

    const error = await subirImagen('/magentagroup/images', 'magentagroup/properties', FOTO).catch((e) => e);

    expect(error.status).toBe(413);
    expect(error.message).toContain('8 MB');
  });

  it('403: la cuenta no es admin (el endpoint de Magenta lo exige)', async () => {
    command.mockResolvedValue({ status: 403, body: {} });

    const error = await subirImagen('/magentagroup/images', 'magentagroup/properties', FOTO).catch((e) => e);

    expect(error.status).toBe(403);
    expect(error.message).toContain('permisos de administrador');
  });

  it('400 (no es una imagen real): deja pasar el mensaje del backend', async () => {
    command.mockResolvedValue({ status: 400, body: { message: 'Formato no permitido; solo jpeg, png, webp, gif, heic' } });

    const error = await subirImagen('/magentagroup/images', 'magentagroup/properties', FOTO).catch((e) => e);

    expect(error.status).toBe(400);
    expect(error.message).toBe('Formato no permitido; solo jpeg, png, webp, gif, heic');
  });

  it('un 201 sin URL es un error, no una foto vacía', async () => {
    command.mockResolvedValue({ status: 201, body: { response: true } });

    const error = await subirImagen('/magentagroup/images', 'magentagroup/properties', FOTO).catch((e) => e);

    expect(error.status).toBe(502);
  });
});

describe('llamarBackend (sin cambios por la subida)', () => {
  it('un 503 de una llamada normal sigue siendo 502 con el status real aparte', async () => {
    command.mockResolvedValue({ status: 503, body: {} });

    const error = await llamarBackend('/magentagroup').catch((e) => e);

    expect(error).toBeInstanceOf(BackendError);
    expect(error.status).toBe(502);
    expect(error.backendStatus).toBe(503);
  });

  it('un 429 de una llamada normal conserva el mensaje genérico', async () => {
    command.mockResolvedValue({ status: 429, body: {} });

    const error = await llamarBackend('/magentagroup').catch((e) => e);

    expect(error.status).toBe(429);
    expect(error.message).toContain('Demasiadas peticiones');
  });
});
