require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieSession = require("cookie-session");
const { llamarBackend, BackendError } = require("./lib/colima-backend");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Backend real de ColimaApp (NestJS): este panel ya no toca Mongo directo
// para nada. Todo — login, eventos, producción, posts locales, lugares,
// directorio, la búsqueda/edición libre de posts y la subida de imágenes —
// pasa por aquí, siempre a través de lib/colima-backend.js.
const COLIMA_BACKEND_URL = process.env.COLIMA_BACKEND_URL;

// Debe coincidir con src/common/constants/admin.constant.ts en
// backColimaApp. No es secreto (es solo un id de Mongo), pero define quién
// puede entrar al panel: cualquier otra cuenta de Google se rechaza en
// POST /auth/google.
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "6705a6ce37e1cf2548b7f44c";

// Mismo aviso para consola, login y /api/*: dónde va la variable depende de
// si corres en local (.env) o en Vercel (Settings → Environment Variables,
// y un Redeploy después de guardarla, porque solo aplica a deploys nuevos).
const MENSAJE_SIN_BACKEND =
  "Falta la variable COLIMA_BACKEND_URL. En local va en el archivo .env (copia .env.example); en Vercel, en Settings → Environment Variables y luego Redeploy.";

if (!COLIMA_BACKEND_URL) {
  console.warn(`${MENSAJE_SIN_BACKEND} Mientras tanto, ninguna sección del panel podrá cargar datos.`);
}
if (!process.env.SESSION_SECRET) {
  console.warn(
    "Falta SESSION_SECRET en tu archivo .env — usando un valor de desarrollo. Ponle uno real antes de desplegar este panel en cualquier lugar que no sea tu máquina.",
  );
}

// La sesión vive firmada dentro de la cookie (cookie-session), no en la
// memoria del servidor: en Vercel cada petición puede caer en una instancia
// distinta, y con express-session (MemoryStore) el login se "olvidaba".
// Solo guarda el JWT del admin y su nombre, cabe de sobra en una cookie.
// "trust proxy" es para que Express sepa que detrás del proxy de Vercel la
// conexión sí es HTTPS y acepte poner la cookie con secure:true.
app.set("trust proxy", 1);
app.use(
  cookieSession({
    name: "colimago.sesion",
    keys: [process.env.SESSION_SECRET || "dev-secret-cambia-esto"],
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60 * 1000, // 12 horas
  }),
);

// --- Sesión: login con Google, restringido a la cuenta administradora ---
// Reemplaza al modal de "login" de index.html que antes no validaba nada y
// te dejaba pasar directo al panel. Ahora: Google confirma quién eres, el
// backend verifica ese id_token y nos da un JWT propio, y aquí revisamos
// que el usuario devuelto sea exactamente ADMIN_USER_ID antes de abrir
// sesión. El JWT de esa sesión (no un token fijo en .env) es lo que se
// reenvía al backend en cada petición de este usuario, como cabecera
// `Authorization: Bearer <jwt>` (el backend ya no lo acepta en body/query).

app.post("/auth/google", async (req, res) => {
  try {
    if (!COLIMA_BACKEND_URL) {
      return res.status(500).json({ error: MENSAJE_SIN_BACKEND });
    }
    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({ error: "Falta el token de Google." });
    }

    // Única llamada sin token de admin: es justo la que lo consigue.
    let datos;
    try {
      datos = await llamarBackend(null, "/login/google", {
        method: "POST",
        body: { token: credential, platform: "web" },
        mensajeError: "No se pudo iniciar sesión.",
      });
    } catch (err) {
      if (err instanceof BackendError) {
        return res.status(401).json({ error: err.message || "No se pudo iniciar sesión." });
      }
      throw err;
    }

    if (!datos.user || String(datos.user._id) !== ADMIN_USER_ID) {
      return res.status(403).json({ error: "Esta cuenta de Google no tiene permisos de administrador." });
    }

    req.session.adminToken = datos.token;
    req.session.adminName = datos.user.name || datos.user.email || "Administrador";
    res.json({ ok: true, name: req.session.adminName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

app.get("/auth/me", (req, res) => {
  if (!req.session || !req.session.adminToken) {
    return res.status(401).json({ error: "No autenticado" });
  }
  res.json({ name: req.session.adminName || "Administrador" });
});

app.post("/auth/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// Sirve dashboard.html solo con sesión iniciada. Vive en views/ (no en
// public/) a propósito: Vercel sirve public/ como archivos estáticos antes
// de llegar a Express, y si estuviera ahí cualquiera lo abriría sin pasar
// por esta revisión. Lo que sí es público (index.html con el login) va en
// public/ y se sirve libremente más abajo.
app.get("/dashboard.html", (req, res) => {
  if (!req.session || !req.session.adminToken) {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

app.use(express.static(path.join(__dirname, "public")));

// Todo /api/* requiere sesión iniciada. El token que se reenvía al backend
// en cada ruta de abajo es el de ESTA sesión (req.session.adminToken), no
// un secreto fijo compartido por cualquiera que abra el panel.
app.use("/api", (req, res, next) => {
  if (!req.session || !req.session.adminToken) {
    return res.status(401).json({ error: "No has iniciado sesión." });
  }
  next();
});

// --- Helpers comunes a todas las rutas /api/* ---

function backendConfigurado(res) {
  if (!COLIMA_BACKEND_URL) {
    res.status(500).json({ error: MENSAJE_SIN_BACKEND });
    return false;
  }
  return true;
}

// Llama al backend con el token de la sesión (lib/colima-backend.js pone la
// cabecera Authorization) y, si el backend respondió error, contesta al
// panel con el mismo status y el "message" que devolvió:
//   401 token inválido/expirado · 403 el usuario no es administrador ·
//   429 rate limit (p. ej. "traducir", máx. 20 por hora) · 400 datos
//   inválidos · 200 con { response:false, message } → 400.
// Regresa null cuando ya respondió el error, para que la ruta solo siga
// cuando hay datos.
async function proxyBackend(req, res, ruta, opciones) {
  try {
    return await llamarBackend(req.session.adminToken, ruta, opciones);
  } catch (err) {
    if (err instanceof BackendError) {
      res.status(err.status).json({ error: err.message, backendStatus: err.backendStatus });
      return null;
    }
    throw err;
  }
}

// Envuelve el handler de cada ruta: revisa que haya backend configurado y
// convierte cualquier excepción (red caída, backend sin JSON) en el 500
// genérico de siempre.
function rutaBackend(handler) {
  return async (req, res) => {
    if (!backendConfigurado(res)) return;
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
    }
  };
}

// --- Eventos pendientes (revisión de lo detectado por n8n) ---
// Migrado a backColimaApp (fase 2): este panel ya no toca la colección
// "eventos_pendientes" en Mongo, solo agrega el token de administrador y
// reenvía al backend real.

// Lista eventos por estatus. Ej: GET /api/pendientes?estatus=pendiente
app.get(
  "/api/pendientes",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/eventos-pendientes", {
      query: { estatus: req.query.estatus || "pendiente" },
      mensajeError: "No se pudieron cargar los eventos",
    });
    if (datos) res.json(datos.eventos || []);
  }),
);

// --- Directorio de municipios por ID de página de Facebook ---

// Listar todo el directorio
app.get(
  "/api/directorio",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/directorio-municipios", {
      mensajeError: "No se pudo cargar el directorio",
    });
    if (datos) res.json(datos.registros || []);
  }),
);

// Agregar un nuevo registro al directorio
app.post(
  "/api/directorio",
  rutaBackend(async (req, res) => {
    const { municipio_id, municipio_nombre, facebook_url, facebook_id, nota } =
      req.body || {};

    if (!facebook_id || !municipio_nombre) {
      return res
        .status(400)
        .json({ error: "Falta el ID de Facebook o el nombre del municipio" });
    }

    const datos = await proxyBackend(req, res, "/directorio-municipios", {
      method: "POST",
      body: {
        municipio_id,
        municipio_nombre,
        facebook_url,
        facebook_id: String(facebook_id),
        nota,
      },
      mensajeError: "No se pudo agregar el registro",
    });
    if (datos) res.json({ ok: true, _id: datos.registro?._id });
  }),
);

// Editar un registro del directorio
app.put(
  "/api/directorio/:id",
  rutaBackend(async (req, res) => {
    const body = { ...req.body, id: req.params.id };
    if (body.facebook_id !== undefined) body.facebook_id = String(body.facebook_id);

    const datos = await proxyBackend(req, res, "/directorio-municipios", {
      method: "PATCH",
      body,
      mensajeError: "No se pudo editar el registro",
    });
    if (datos) res.json({ ok: true });
  }),
);

// Borrar un registro del directorio
app.delete(
  "/api/directorio/:id",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/directorio-municipios", {
      method: "DELETE",
      body: { id: req.params.id },
      mensajeError: "No se pudo borrar el registro",
    });
    if (datos) res.json({ ok: true });
  }),
);

// --- Lugares (para el subtítulo de los eventos y para Configuración > Lugares) ---
// Migrado a backColimaApp (fase 3): este panel ya no toca la colección
// "lugares" en Mongo, solo agrega el token de administrador y reenvía.

// Listar todos los lugares
app.get(
  "/api/lugares",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/lugares", {
      mensajeError: "No se pudo cargar la lista de lugares",
    });
    if (datos) res.json(datos.lugares || []);
  }),
);

// Agregar un nuevo lugar
app.post(
  "/api/lugares",
  rutaBackend(async (req, res) => {
    const { nombre } = req.body || {};
    if (!nombre) {
      return res.status(400).json({ error: "Falta el nombre del lugar" });
    }

    const datos = await proxyBackend(req, res, "/lugares", {
      method: "POST",
      body: { ...req.body },
      mensajeError: "No se pudo agregar el lugar",
    });
    if (datos) res.json({ ok: true, _id: datos.lugar?._id });
  }),
);

// Editar un lugar
app.put(
  "/api/lugares/:id",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/lugares", {
      method: "PATCH",
      body: { ...req.body, id: req.params.id },
      mensajeError: "No se pudo editar el lugar",
    });
    if (datos) res.json({ ok: true });
  }),
);

// Borrar un lugar
app.delete(
  "/api/lugares/:id",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/lugares", {
      method: "DELETE",
      body: { id: req.params.id },
      mensajeError: "No se pudo borrar el lugar",
    });
    if (datos) res.json({ ok: true });
  }),
);

// --- "Posts" en Configuración: buscar cualquier post (evento o local) por
// id o por título, y editar sus campos directamente. Reemplaza al viejo
// editor genérico de Mongo ("Base de Datos"): ya no hay acceso a Mongo
// crudo desde el panel, esto pasa por el backend igual que todo lo demás.

// Buscar posts. Ej: GET /api/posts-admin?q=feria del hongo
app.get(
  "/api/posts-admin",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/post/admin-search", {
      query: { q: req.query.q || undefined },
      mensajeError: "No se pudo buscar posts",
    });
    if (datos) res.json(datos.posts || []);
  }),
);

// Editar los campos de un post existente. "cambios" solo admite campos del
// schema de Post (title, subtitle, description, descriptionEnglish, images,
// date, finishDate, status, isTop, isCover, location, socialNetworks,
// municipality, ...); si va algo fuera de eso el backend responde
// { response:false, message:"Campos no permitidos: ..." } y ese mensaje
// llega tal cual al panel vía proxyBackend. Aquí solo se quita _id.
app.put(
  "/api/posts-admin/:id",
  rutaBackend(async (req, res) => {
    const cambios = { ...(req.body || {}) };
    delete cambios._id;

    const datos = await proxyBackend(req, res, "/post/admin-update", {
      method: "PATCH",
      body: { id: req.params.id, cambios },
      mensajeError: "No se pudo editar el post",
    });
    if (datos) res.json({ ok: true });
  }),
);

// Traduce contenido_crudo al inglés con Claude Haiku (backend) y regresa el
// resultado. No lo guarda todavía — el panel lo manda de vuelta como
// "descriptionEnglish" cuando se aprueba el evento. El backend limita esto
// a 20 por hora: al pasarse responde 429 y el mensaje se muestra tal cual.
app.post(
  "/api/pendientes/:id/traducir",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/eventos-pendientes/traducir", {
      method: "POST",
      body: { id: req.params.id },
      mensajeError: "No se pudo traducir. Revisa tu ANTHROPIC_API_KEY y tu saldo.",
    });
    if (datos) res.json({ descriptionEnglish: datos.descriptionEnglish });
  }),
);

// Busca eventos ya aprobados/publicados que caigan en la misma fecha, para
// detectar publicaciones repetidas del mismo ayuntamiento antes de aprobar
// otra vez el mismo evento. GET /api/pendientes/mismo-dia?fecha=YYYY-MM-DD&excluir=<id>
app.get(
  "/api/pendientes/mismo-dia",
  rutaBackend(async (req, res) => {
    const { fecha, excluir } = req.query;
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: "Falta una fecha válida (YYYY-MM-DD)" });
    }

    const datos = await proxyBackend(req, res, "/eventos-pendientes/mismo-dia", {
      query: { fecha, excluir: excluir || undefined },
      mensajeError: "No se pudo buscar eventos de esa fecha",
    });
    if (datos) res.json(datos.eventos || []);
  }),
);

// Aprobar un evento (recibe los datos capturados a mano por el revisor)
app.post(
  "/api/pendientes/:id/aprobar",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/eventos-pendientes/aprobar", {
      method: "POST",
      body: { ...req.body, id: req.params.id },
      mensajeError: "No se pudo aprobar el evento",
    });
    if (datos) res.json({ ok: true });
  }),
);

// Rechazar un evento
app.post(
  "/api/pendientes/:id/rechazar",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/eventos-pendientes/rechazar", {
      method: "POST",
      body: { id: req.params.id },
      mensajeError: "No se pudo rechazar el evento",
    });
    if (datos) res.json({ ok: true });
  }),
);

// Devolver un evento a pendiente (por si te equivocas)
app.post(
  "/api/pendientes/:id/deshacer",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/eventos-pendientes/deshacer", {
      method: "POST",
      body: { id: req.params.id },
      mensajeError: "No se pudo deshacer",
    });
    if (datos) res.json({ ok: true });
  }),
);

// Publicar un evento aprobado a producción (crea el Post kind:'event' en el backend)
app.post(
  "/api/pendientes/:id/publicar",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/eventos-pendientes/publicar", {
      method: "POST",
      body: { id: req.params.id },
      mensajeError: "No se pudo publicar el evento",
    });
    if (datos) res.json({ ok: true, postId: datos.postId });
  }),
);

// --- Posts en producción (Activos / Pausados / Papelera) ---
// Migrado a backColimaApp (fase 1 de mover colimago de Mongo directo
// al backend real): este panel ya no toca la colección "posts" en Mongo
// para estas acciones, solo agrega el token de administrador y reenvía.

// Lista posts según su estado. Ej: GET /api/posts?estatus=activo
app.get(
  "/api/posts",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/post/production", {
      query: { estatus: req.query.estatus || "activo" },
      mensajeError: "No se pudieron cargar los posts",
    });
    if (datos) res.json(datos.posts || []);
  }),
);

function accionProduccion(ruta, mensajeError) {
  return rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, `/post/production/${ruta}`, {
      method: "PATCH",
      body: { id: req.params.id },
      mensajeError,
    });
    if (datos) res.json({ ok: true });
  });
}

// Pausar (ocultar) un post activo
app.post("/api/posts/:id/pausar", accionProduccion("pause", "No se pudo pausar el post"));

// Reactivar un post pausado
app.post("/api/posts/:id/activar", accionProduccion("activate", "No se pudo activar el post"));

// Mover un post a la papelera (borrado suave, recuperable)
app.post("/api/posts/:id/papelera", accionProduccion("trash", "No se pudo mover a la papelera"));

// Restaurar un post de la papelera
app.post("/api/posts/:id/restaurar", accionProduccion("restore", "No se pudo restaurar el post"));

// Eliminar un post permanentemente (solo desde la papelera). Reutiliza el
// endpoint genérico de borrado físico del backend (ya excluye kind:'local').
app.delete(
  "/api/posts/:id",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/post", {
      method: "DELETE",
      body: { id: req.params.id },
      mensajeError: "No se pudo eliminar el post",
    });
    if (datos) res.json({ ok: true });
  }),
);

// --- Posts locales (ríos, playas, lagos, montañas, hoteles, restaurantes) ---
// Ver docs/local-catalog-contract.md en el repo de la app. Este panel es
// cliente HTTP del backend real (backColimaApp); no toca Mongo directo aquí.

// El esquema de "location" en el backend real todavía carga el campo
// "idLocation" (heredado de eventos, que sí referencian un lugar guardado).
// Un post local no tiene ese lugar de referencia, pero el DTO lo exige como
// string, así que este panel lo rellena vacío para no bloquear el guardado.
function normalizarLocation(body) {
  if (body.location && body.location.idLocation === undefined) {
    body.location.idLocation = "";
  }
}

// Listar posts locales (cualquier status, para poder ver también los dados
// de baja), opcionalmente filtrados por categoría y/o municipio.
app.get(
  "/api/locales",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/post/local", {
      query: {
        type: req.query.type || undefined,
        municipalityId: req.query.municipalityId || undefined,
      },
      mensajeError: "No se pudieron cargar los posts locales",
    });
    if (datos) res.json(datos.locales || []);
  }),
);

// Alta de un post local nuevo. El panel nunca manda campos de evento
// (date, finishDate, isCover, etc.) porque el formulario del cliente solo
// junta los campos de §4 del contrato.
app.post(
  "/api/locales",
  rutaBackend(async (req, res) => {
    const body = { ...req.body };
    normalizarLocation(body);

    const datos = await proxyBackend(req, res, "/post/local", {
      method: "POST",
      body,
      mensajeError: "No se pudo crear el post local",
    });
    if (datos) res.json({ ok: true, post: datos.post });
  }),
);

// Editar un post local existente (incluye reactivarlo mandando status:true).
app.put(
  "/api/locales/:id",
  rutaBackend(async (req, res) => {
    const body = { ...req.body, id: req.params.id };
    normalizarLocation(body);

    const datos = await proxyBackend(req, res, "/post/local", {
      method: "PATCH",
      body,
      mensajeError: "No se pudo editar el post local",
    });
    if (datos) res.json({ ok: true, post: datos.post });
  }),
);

// Baja lógica (status:false). Nunca hay un endpoint de borrado físico para
// posts locales: sus likes/comentarios/favoritos cuelgan de su _id permanente.
app.post(
  "/api/locales/:id/baja",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/post/local", {
      method: "DELETE",
      body: { id: req.params.id },
      mensajeError: "No se pudo dar de baja el post local",
    });
    if (datos) res.json({ ok: true });
  }),
);

// Reactivar (status:true) un post local dado de baja.
app.post(
  "/api/locales/:id/reactivar",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/post/local", {
      method: "PATCH",
      body: { id: req.params.id, status: true },
      mensajeError: "No se pudo reactivar el post local",
    });
    if (datos) res.json({ ok: true });
  }),
);

// Export del catálogo para empaquetar en el siguiente release de la app
// (contrato §7). El panel solo reenvía el JSON tal cual; el navegador lo
// descarga como archivo.
app.get(
  "/api/locales/export",
  rutaBackend(async (req, res) => {
    const datos = await proxyBackend(req, res, "/post/export-locales", {
      mensajeError: "No se pudo exportar el catálogo",
    });
    if (datos) res.json(datos);
  }),
);

// --- Imágenes (POST /images del backend → Cloudinary) ---
// El panel recibe el multipart del navegador (campos "image" y "folder",
// los mismos nombres que espera el backend), lo valida y lo reenvía con la
// cabecera Authorization.

const IMAGEN_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const IMAGEN_TIPOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
// Solo letras, números, "_", "-" y "/": sin "&", espacios ni "..".
const FOLDER_VALIDO = /^[A-Za-z0-9_\-/]+$/;

app.post(
  "/api/images",
  // Se guarda el multipart crudo (con un margen sobre los 8 MB para las
  // cabeceras del boundary); si lo excede, el manejador de errores de
  // abajo responde 413 con un mensaje legible.
  express.raw({ type: "multipart/form-data", limit: IMAGEN_MAX_BYTES + 512 * 1024 }),
  rutaBackend(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: "La petición debe ser multipart/form-data con el campo \"image\"." });
    }

    let form;
    try {
      form = await new Response(req.body, {
        headers: { "content-type": req.headers["content-type"] },
      }).formData();
    } catch {
      return res.status(400).json({ error: "No se pudo leer el formulario de la imagen." });
    }

    const folder = form.get("folder");
    if (folder !== null && (typeof folder !== "string" || !FOLDER_VALIDO.test(folder) || folder.includes(".."))) {
      return res.status(400).json({
        error: "La carpeta (folder) solo admite letras, números, \"_\", \"-\" y \"/\".",
      });
    }

    const archivo = form.get("image");
    if (!archivo || typeof archivo === "string") {
      return res.status(400).json({ error: "Falta el archivo de imagen (campo \"image\")." });
    }
    if (!IMAGEN_TIPOS.has(archivo.type)) {
      return res.status(400).json({ error: "La imagen debe ser JPEG, PNG, WebP, GIF o HEIC." });
    }
    if (archivo.size > IMAGEN_MAX_BYTES) {
      return res.status(400).json({ error: "La imagen pesa más de 8 MB." });
    }

    // Se reconstruye el multipart en vez de reenviar el crudo para que al
    // backend solo lleguen los campos ya validados.
    const formData = new FormData();
    formData.append("image", archivo, archivo.name || "imagen");
    if (folder !== null) formData.append("folder", folder);

    const datos = await proxyBackend(req, res, "/images", {
      method: "POST",
      formData,
      mensajeError: "No se pudo subir la imagen",
    });
    if (datos) res.json(datos);
  }),
);

// Errores que Express lanza antes de llegar a una ruta (body demasiado
// grande, JSON malformado): se contestan en JSON para que el panel pueda
// mostrar el mensaje en vez de una página HTML de error.
app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "La imagen pesa más de 8 MB." });
  }
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es JSON válido." });
  }
  console.error(err);
  res.status(err?.status || 500).json({ error: "Ocurrió un error en el panel." });
});

// En local (npm start) levantamos el puerto. En Vercel este archivo se
// importa desde api/index.js y es Vercel quien atiende las peticiones.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`colimago corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
