// Un fetch() que no sale a la red: atiende las rutas /api/* del panel con
// las funciones de rutas.ts y regresa un Response igual al que daba
// server.js (mismo status y mismo JSON). Así dashboard.js sigue llamando
// fetch('/api/...') como siempre.

export type DatosPeticion = Record<string, any>;

export interface PeticionLocal {
  params: Record<string, string>;
  query: URLSearchParams;
  body: DatosPeticion;
}

export interface RespuestaLocal {
  status: number;
  body: unknown;
}

export interface Ruta {
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE';
  patron: string;
  manejador: (peticion: PeticionLocal) => Promise<RespuestaLocal> | RespuestaLocal;
}

function coincidir(patron: string, ruta: string): Record<string, string> | null {
  const partesPatron = patron.split('/');
  const partesRuta = ruta.split('/');
  if (partesPatron.length !== partesRuta.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < partesPatron.length; i++) {
    const parte = partesPatron[i];
    if (parte.startsWith(':')) {
      if (!partesRuta[i]) return null;
      try {
        params[parte.slice(1)] = decodeURIComponent(partesRuta[i]);
      } catch {
        return null;
      }
    } else if (parte !== partesRuta[i]) {
      return null;
    }
  }
  return params;
}

function responder({ status, body }: RespuestaLocal): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function crearFetchLocal(rutas: readonly Ruta[]) {
  return async function fetchLocal(entrada: string, init: RequestInit = {}): Promise<Response> {
    const metodo = (init.method || 'GET').toUpperCase();
    const url = new URL(entrada, 'http://panel.local');

    for (const ruta of rutas) {
      if (ruta.metodo !== metodo) continue;
      const params = coincidir(ruta.patron, url.pathname);
      if (!params) continue;

      let body: DatosPeticion = {};
      if (typeof init.body === 'string' && init.body) {
        let datos: unknown;
        try {
          datos = JSON.parse(init.body);
        } catch {
          return responder({ status: 400, body: { error: 'El cuerpo de la petición no es JSON válido.' } });
        }
        if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
          return responder({ status: 400, body: { error: 'El cuerpo de la petición debe ser un objeto JSON.' } });
        }
        body = datos as DatosPeticion;
      }
      return responder(await ruta.manejador({ params, query: url.searchParams, body }));
    }
    return responder({ status: 404, body: { error: 'Esa ruta no existe en el panel.' } });
  };
}
