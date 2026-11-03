// New House: achicar una foto que pasa del límite del backend (8 MB) antes de subirla.
//
// Se vuelve a dibujar en un canvas y se guarda como JPEG. Si todavía pesa de
// más, primero baja la calidad y después el tamaño, hasta que quepa. Una foto
// que ya cabe no se toca. La lógica va aparte de la pantalla (y recibe cómo
// abrir y codificar la foto) para poder probarla sin canvas.

import { MAX_BYTES_FOTO } from './house-upload';

/** El lado más largo con el que se prueba, de mayor a menor (una foto nunca se agranda). */
const LADOS = [4096, 3072, 2400, 1800, 1280];
/** Calidades JPEG que se prueban en cada tamaño, de mayor a menor. */
const CALIDADES = [0.9, 0.8, 0.7, 0.6];

/** Una foto ya abierta para irla codificando con distintos tamaños y calidades. */
export interface FotoAbierta {
  ancho: number;
  alto: number;
  /** La foto como JPEG, con su lado más largo a lo más `lado` px. */
  codificar: (lado: number, calidad: number) => Promise<Blob>;
  cerrar: () => void;
}

interface Dependencias {
  abrir: (archivo: Blob) => Promise<FotoAbierta>;
}

export class FotoNoSePudoAchicar extends Error {
  constructor() {
    super('No se pudo achicar la foto.');
    this.name = 'FotoNoSePudoAchicar';
  }
}

/** "Sin título.png" → "Sin título.jpg". */
function nombreJpg(nombre: string): string {
  return `${nombre.replace(/\.[^./\\]+$/, '')}.jpg`;
}

/**
 * La foto con peso de `limite` bytes o menos: la misma si ya cabía, o una
 * versión JPEG más chica. Falla con FotoNoSePudoAchicar si ni al tamaño más
 * pequeño cabe, o con el error de lectura si no se pudo abrir (formato que el
 * sistema no entiende).
 */
export async function reducirFoto(archivo: File, limite = MAX_BYTES_FOTO, dep: Dependencias = REALES): Promise<File> {
  if (archivo.size <= limite) return archivo;
  const foto = await dep.abrir(archivo);
  try {
    const largo = Math.max(foto.ancho, foto.alto);
    for (const lado of new Set(LADOS.map((l) => Math.min(l, largo)))) {
      for (const calidad of CALIDADES) {
        const reducida = await foto.codificar(lado, calidad);
        if (reducida.size <= limite) {
          return new File([reducida], nombreJpg(archivo.name), { type: 'image/jpeg', lastModified: archivo.lastModified });
        }
      }
    }
    throw new FotoNoSePudoAchicar();
  } finally {
    foto.cerrar();
  }
}

/** Abre la foto con el motor del propio sistema (WebKit), que también lee HEIC. */
async function abrirFoto(archivo: Blob): Promise<FotoAbierta> {
  const { fuente, ancho, alto, cerrar } = await decodificar(archivo);
  return {
    ancho,
    alto,
    cerrar,
    codificar: (lado, calidad) => {
      const escala = Math.min(1, lado / Math.max(ancho, alto));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.max(1, Math.round(ancho * escala));
      lienzo.height = Math.max(1, Math.round(alto * escala));
      const contexto = lienzo.getContext('2d');
      if (!contexto) throw new Error('No se pudo preparar la foto para achicarla.');
      // JPEG no tiene transparencia: sobre blanco, para que un PNG sin fondo no quede negro.
      contexto.fillStyle = '#fff';
      contexto.fillRect(0, 0, lienzo.width, lienzo.height);
      contexto.imageSmoothingQuality = 'high';
      contexto.drawImage(fuente, 0, 0, lienzo.width, lienzo.height);
      return new Promise<Blob>((resolver, rechazar) => {
        lienzo.toBlob(
          (blob) => {
            lienzo.width = lienzo.height = 0; // suelta la memoria del lienzo
            if (blob) resolver(blob);
            else rechazar(new Error('No se pudo guardar la foto achicada.'));
          },
          'image/jpeg',
          calidad,
        );
      });
    },
  };
}

async function decodificar(archivo: Blob): Promise<{ fuente: CanvasImageSource; ancho: number; alto: number; cerrar: () => void }> {
  try {
    // 'from-image' respeta la orientación de las fotos del teléfono.
    const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    return { fuente: bitmap, ancho: bitmap.width, alto: bitmap.height, cerrar: () => bitmap.close() };
  } catch {
    // Algunos formatos (p. ej. HEIC) los abre <img> pero no createImageBitmap.
    const url = URL.createObjectURL(archivo);
    try {
      const imagen = new Image();
      imagen.src = url;
      await imagen.decode();
      return { fuente: imagen, ancho: imagen.naturalWidth, alto: imagen.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error('No se pudo leer la foto.');
    }
  }
}

const REALES: Dependencias = { abrir: abrirFoto };
