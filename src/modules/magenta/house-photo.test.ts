import { describe, expect, it, vi } from 'vitest';
import { FotoNoSePudoAchicar, reducirFoto, type FotoAbierta } from './house-photo';

const LIMITE = 3000;

/** Una foto que "pesa" lado × calidad bytes al codificarla, para ver qué combinaciones prueba. */
function fotoFalsa(ancho: number, alto: number) {
  const llamadas: [number, number][] = [];
  const cerrar = vi.fn();
  const foto: FotoAbierta = {
    ancho,
    alto,
    cerrar,
    codificar: async (lado, calidad) => {
      llamadas.push([lado, calidad]);
      return new Blob([new Uint8Array(Math.round(lado * calidad))]);
    },
  };
  const abrir = vi.fn(async () => foto);
  return { dep: { abrir }, llamadas, cerrar, abrir };
}

function archivo(nombre: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], nombre, { type: 'image/png', lastModified: 1700000000000 });
}

describe('reducirFoto', () => {
  it('una foto que ya cabe se regresa tal cual, sin abrirla', async () => {
    const { dep, abrir } = fotoFalsa(6000, 4000);
    const foto = archivo('casa.png', LIMITE);

    expect(await reducirFoto(foto, LIMITE, dep)).toBe(foto);
    expect(abrir).not.toHaveBeenCalled();
  });

  it('primero baja la calidad y se queda con la primera que cabe', async () => {
    const { dep, llamadas, cerrar } = fotoFalsa(6000, 4000);

    const reducida = await reducirFoto(archivo('Sin título - 11.33.33-1.png', 9000), LIMITE, dep);

    expect(llamadas).toEqual([
      [4096, 0.9],
      [4096, 0.8],
      [4096, 0.7], // 2867 bytes ≤ 3000
    ]);
    expect(reducida.size).toBe(2867);
    expect(reducida.type).toBe('image/jpeg');
    expect(reducida.name).toBe('Sin título - 11.33.33-1.jpg');
    expect(reducida.lastModified).toBe(1700000000000);
    expect(cerrar).toHaveBeenCalledOnce();
  });

  it('si bajar la calidad no alcanza, achica el tamaño', async () => {
    const { dep, llamadas } = fotoFalsa(6000, 4000);

    const reducida = await reducirFoto(archivo('casa.png', 9000), 1500, dep);

    expect(llamadas.at(-1)).toEqual([2400, 0.6]); // 1440 bytes
    expect(llamadas.map(([lado]) => lado)).toEqual([4096, 4096, 4096, 4096, 3072, 3072, 3072, 3072, 2400, 2400, 2400, 2400]);
    expect(reducida.size).toBe(1440);
  });

  it('nunca agranda la foto', async () => {
    const { dep, llamadas } = fotoFalsa(2000, 1000);

    await reducirFoto(archivo('casa.png', 9000), LIMITE, dep);

    expect(llamadas[0]).toEqual([2000, 0.9]);
    expect(llamadas.every(([lado]) => lado <= 2000)).toBe(true);
  });

  it('si ni al tamaño más chico cabe, falla y suelta la foto', async () => {
    const { dep, cerrar } = fotoFalsa(6000, 4000);

    await expect(reducirFoto(archivo('casa.png', 9000), 100, dep)).rejects.toBeInstanceOf(FotoNoSePudoAchicar);
    expect(cerrar).toHaveBeenCalledOnce();
  });

  it('si no se puede abrir, falla con ese error', async () => {
    const abrir = vi.fn().mockRejectedValue(new Error('No se pudo leer la foto.'));

    await expect(reducirFoto(archivo('casa.heic', 9000), LIMITE, { abrir })).rejects.toThrow('No se pudo leer la foto.');
  });

  it('cambia la extensión a .jpg (y la agrega si no tenía)', async () => {
    const { dep } = fotoFalsa(6000, 4000);

    expect((await reducirFoto(archivo('IMG_0001.HEIC', 9000), LIMITE, dep)).name).toBe('IMG_0001.jpg');
    expect((await reducirFoto(archivo('foto', 9000), LIMITE, dep)).name).toBe('foto.jpg');
    expect((await reducirFoto(archivo('mi.casa.final.png', 9000), LIMITE, dep)).name).toBe('mi.casa.final.jpg');
  });
});
