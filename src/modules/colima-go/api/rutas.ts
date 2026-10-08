// Las rutas /api/* del panel de Colima Go. Es el mismo mapeo que hacía
// server.js en la versión web (ruta del panel → endpoint de backColimaApp,
// validaciones y forma de la respuesta); lo que cambió es que ya no hay un
// servidor intermedio: llamarBackend() pide la petición a Rust, que agrega
// el token de la sesión.

import { BackendError, llamarBackend, type DatosBackend, type OpcionesBackend } from '../../../core/backend/client';
import { AppError, command } from '../../../core/tauri';
import type { DatosPeticion, RespuestaLocal, Ruta } from './fetch-local';

const json = (body: unknown, status = 200): RespuestaLocal => ({ status, body });

// proxyBackend + rutaBackend de server.js: llama al backend y, si respondió
// error, contesta con el mismo status y el "message" que devolvió:
//   401 token inválido/expirado · 403 el usuario no es administrador ·
//   429 rate limit (p. ej. "traducir", máx. 20 por hora) · 400 datos
//   inválidos · 200 con { response:false, message } → 400.
// Un problema de red se vuelve 500, como antes.
async function proxy(
  ruta: string,
  opciones: OpcionesBackend,
  formar: (datos: DatosBackend) => unknown,
): Promise<RespuestaLocal> {
  try {
    return json(formar(await llamarBackend(ruta, opciones)));
  } catch (err) {
    if (err instanceof BackendError) {
      const body = err.backendStatus === undefined ? { error: err.message } : { error: err.message, backendStatus: err.backendStatus };
      return json(body, err.status);
    }
    console.error(err);
    const mensaje = err instanceof AppError && err.kind === 'network' ? err.message : 'No se pudo conectar con el backend de ColimaApp';
    return json({ error: mensaje }, 500);
  }
}

const ok = () => ({ ok: true });

// Acciones de producción: todas son PATCH /post/production/<acción> { id }.
function accionProduccion(accion: string, mensajeError: string): Ruta['manejador'] {
  return ({ params }) =>
    proxy(`/post/production/${accion}`, { method: 'PATCH', body: { id: params.id }, mensajeError }, ok);
}

// El esquema de "location" en el backend todavía carga el campo
// "idLocation" (heredado de eventos, que sí referencian un lugar guardado).
// Un post local no tiene ese lugar, pero el DTO lo exige como string, así
// que se rellena vacío para no bloquear el guardado.
function normalizarLocation(body: DatosPeticion) {
  if (body.location && body.location.idLocation === undefined) {
    body.location.idLocation = '';
  }
}

export const rutas: readonly Ruta[] = [
  // --- Eventos pendientes (revisión de lo detectado por n8n) ---
  {
    metodo: 'GET',
    patron: '/api/pendientes',
    manejador: ({ query }) =>
      proxy(
        '/eventos-pendientes',
        { query: { estatus: query.get('estatus') || 'pendiente' }, mensajeError: 'No se pudieron cargar los eventos' },
        (d) => d.eventos || [],
      ),
  },
  // Eventos ya aprobados/publicados de la misma fecha, para detectar
  // publicaciones repetidas antes de aprobar otra vez el mismo evento.
  {
    metodo: 'GET',
    patron: '/api/pendientes/mismo-dia',
    manejador: ({ query }) => {
      const fecha = query.get('fecha');
      if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return json({ error: 'Falta una fecha válida (YYYY-MM-DD)' }, 400);
      }
      return proxy(
        '/eventos-pendientes/mismo-dia',
        { query: { fecha, excluir: query.get('excluir') || undefined }, mensajeError: 'No se pudo buscar eventos de esa fecha' },
        (d) => d.eventos || [],
      );
    },
  },
  // Traduce contenido_crudo al inglés con Claude (en el backend). No lo
  // guarda: el panel lo manda como "descriptionEnglish" al aprobar.
  {
    metodo: 'POST',
    patron: '/api/pendientes/:id/traducir',
    manejador: ({ params }) =>
      proxy(
        '/eventos-pendientes/traducir',
        { method: 'POST', body: { id: params.id }, mensajeError: 'No se pudo traducir. Revisa tu ANTHROPIC_API_KEY y tu saldo.' },
        (d) => ({ descriptionEnglish: d.descriptionEnglish }),
      ),
  },
  {
    metodo: 'POST',
    patron: '/api/pendientes/:id/aprobar',
    manejador: ({ params, body }) =>
      proxy('/eventos-pendientes/aprobar', { method: 'POST', body: { ...body, id: params.id }, mensajeError: 'No se pudo aprobar el evento' }, ok),
  },
  {
    metodo: 'POST',
    patron: '/api/pendientes/:id/rechazar',
    manejador: ({ params }) =>
      proxy('/eventos-pendientes/rechazar', { method: 'POST', body: { id: params.id }, mensajeError: 'No se pudo rechazar el evento' }, ok),
  },
  {
    metodo: 'POST',
    patron: '/api/pendientes/:id/deshacer',
    manejador: ({ params }) =>
      proxy('/eventos-pendientes/deshacer', { method: 'POST', body: { id: params.id }, mensajeError: 'No se pudo deshacer' }, ok),
  },
  // Publica un evento aprobado (crea el Post kind:'event' en el backend).
  {
    metodo: 'POST',
    patron: '/api/pendientes/:id/publicar',
    manejador: ({ params }) =>
      proxy(
        '/eventos-pendientes/publicar',
        { method: 'POST', body: { id: params.id }, mensajeError: 'No se pudo publicar el evento' },
        (d) => ({ ok: true, postId: d.postId }),
      ),
  },

  // --- Directorio de municipios por ID de página de Facebook ---
  {
    metodo: 'GET',
    patron: '/api/directorio',
    manejador: () => proxy('/directorio-municipios', { mensajeError: 'No se pudo cargar el directorio' }, (d) => d.registros || []),
  },
  {
    metodo: 'POST',
    patron: '/api/directorio',
    manejador: ({ body }) => {
      const { municipio_id, municipio_nombre, facebook_url, facebook_id, nota } = body;
      if (!facebook_id || !municipio_nombre) {
        return json({ error: 'Falta el ID de Facebook o el nombre del municipio' }, 400);
      }
      return proxy(
        '/directorio-municipios',
        {
          method: 'POST',
          body: { municipio_id, municipio_nombre, facebook_url, facebook_id: String(facebook_id), nota },
          mensajeError: 'No se pudo agregar el registro',
        },
        (d) => ({ ok: true, _id: d.registro?._id }),
      );
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/directorio/:id',
    manejador: ({ params, body }) => {
      const cuerpo: DatosPeticion = { ...body, id: params.id };
      if (cuerpo.facebook_id !== undefined) cuerpo.facebook_id = String(cuerpo.facebook_id);
      return proxy('/directorio-municipios', { method: 'PATCH', body: cuerpo, mensajeError: 'No se pudo editar el registro' }, ok);
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/directorio/:id',
    manejador: ({ params }) =>
      proxy('/directorio-municipios', { method: 'DELETE', body: { id: params.id }, mensajeError: 'No se pudo borrar el registro' }, ok),
  },

  // --- Lugares (subtítulo de los eventos y Configuración > Lugares) ---
  {
    metodo: 'GET',
    patron: '/api/lugares',
    manejador: () => proxy('/lugares', { mensajeError: 'No se pudo cargar la lista de lugares' }, (d) => d.lugares || []),
  },
  {
    metodo: 'POST',
    patron: '/api/lugares',
    manejador: ({ body }) => {
      if (!body.nombre) return json({ error: 'Falta el nombre del lugar' }, 400);
      return proxy('/lugares', { method: 'POST', body: { ...body }, mensajeError: 'No se pudo agregar el lugar' }, (d) => ({
        ok: true,
        _id: d.lugar?._id,
      }));
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/lugares/:id',
    manejador: ({ params, body }) =>
      proxy('/lugares', { method: 'PATCH', body: { ...body, id: params.id }, mensajeError: 'No se pudo editar el lugar' }, ok),
  },
  {
    metodo: 'DELETE',
    patron: '/api/lugares/:id',
    manejador: ({ params }) =>
      proxy('/lugares', { method: 'DELETE', body: { id: params.id }, mensajeError: 'No se pudo borrar el lugar' }, ok),
  },
  // Link corto de Google Maps → link largo (lo resuelve Rust: el webview no
  // puede seguir ese redirect por CORS).
  {
    metodo: 'GET',
    patron: '/api/resolver-maps',
    manejador: async ({ query }) => {
      try {
        return json({ url: await command<string>('resolve_maps_link', { url: query.get('url') || '' }) });
      } catch (err) {
        if (err instanceof AppError && err.kind === 'notAuthenticated') return json({ error: err.message }, 401);
        if (err instanceof AppError && err.kind === 'invalidRequest') return json({ error: err.message }, 400);
        return json({ error: err instanceof Error ? err.message : 'No se pudo abrir el link corto.' }, 502);
      }
    },
  },

  // --- "Posts" en Configuración: buscar cualquier post y editar sus campos ---
  {
    metodo: 'GET',
    patron: '/api/posts-admin',
    manejador: ({ query }) =>
      proxy('/post/admin-search', { query: { q: query.get('q') || undefined }, mensajeError: 'No se pudo buscar posts' }, (d) => d.posts || []),
  },
  // "cambios" solo admite campos del schema de Post; si va algo fuera, el
  // backend responde { response:false, message:"Campos no permitidos: ..." }.
  {
    metodo: 'PUT',
    patron: '/api/posts-admin/:id',
    manejador: ({ params, body }) => {
      const cambios = { ...body };
      delete cambios._id;
      return proxy('/post/admin-update', { method: 'PATCH', body: { id: params.id, cambios }, mensajeError: 'No se pudo editar el post' }, ok);
    },
  },

  // --- Posts en producción (Activos / Pausados / Papelera) ---
  {
    metodo: 'GET',
    patron: '/api/posts',
    manejador: ({ query }) =>
      proxy(
        '/post/production',
        { query: { estatus: query.get('estatus') || 'activo' }, mensajeError: 'No se pudieron cargar los posts' },
        (d) => d.posts || [],
      ),
  },
  { metodo: 'POST', patron: '/api/posts/:id/pausar', manejador: accionProduccion('pause', 'No se pudo pausar el post') },
  { metodo: 'POST', patron: '/api/posts/:id/activar', manejador: accionProduccion('activate', 'No se pudo activar el post') },
  { metodo: 'POST', patron: '/api/posts/:id/papelera', manejador: accionProduccion('trash', 'No se pudo mover a la papelera') },
  { metodo: 'POST', patron: '/api/posts/:id/restaurar', manejador: accionProduccion('restore', 'No se pudo restaurar el post') },
  // Eliminar permanentemente (solo desde la papelera). El backend ya
  // excluye kind:'local' de este borrado físico.
  {
    metodo: 'DELETE',
    patron: '/api/posts/:id',
    manejador: ({ params }) =>
      proxy('/post', { method: 'DELETE', body: { id: params.id }, mensajeError: 'No se pudo eliminar el post' }, ok),
  },

  // --- Posts locales (ríos, playas, lagos, montañas, hoteles, restaurantes) ---
  {
    metodo: 'GET',
    patron: '/api/locales',
    manejador: ({ query }) =>
      proxy(
        '/post/local',
        {
          query: { type: query.get('type') || undefined, municipalityId: query.get('municipalityId') || undefined },
          mensajeError: 'No se pudieron cargar los posts locales',
        },
        (d) => d.locales || [],
      ),
  },
  {
    metodo: 'POST',
    patron: '/api/locales',
    manejador: ({ body }) => {
      const cuerpo = { ...body };
      normalizarLocation(cuerpo);
      return proxy('/post/local', { method: 'POST', body: cuerpo, mensajeError: 'No se pudo crear el post local' }, (d) => ({
        ok: true,
        post: d.post,
      }));
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/locales/:id',
    manejador: ({ params, body }) => {
      const cuerpo = { ...body, id: params.id };
      normalizarLocation(cuerpo);
      return proxy('/post/local', { method: 'PATCH', body: cuerpo, mensajeError: 'No se pudo editar el post local' }, (d) => ({
        ok: true,
        post: d.post,
      }));
    },
  },
  // Baja lógica (status:false). No hay borrado físico de posts locales:
  // sus likes/comentarios/favoritos cuelgan de su _id permanente.
  {
    metodo: 'POST',
    patron: '/api/locales/:id/baja',
    manejador: ({ params }) =>
      proxy('/post/local', { method: 'DELETE', body: { id: params.id }, mensajeError: 'No se pudo dar de baja el post local' }, ok),
  },
  {
    metodo: 'POST',
    patron: '/api/locales/:id/reactivar',
    manejador: ({ params }) =>
      proxy(
        '/post/local',
        { method: 'PATCH', body: { id: params.id, status: true }, mensajeError: 'No se pudo reactivar el post local' },
        ok,
      ),
  },
  // Export del catálogo para el siguiente release de la app (contrato §7).
  {
    metodo: 'GET',
    patron: '/api/locales/export',
    manejador: () => proxy('/post/export-locales', { mensajeError: 'No se pudo exportar el catálogo' }, (d) => d),
  },
];
