require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieSession = require("cookie-session");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Backend real de ColimaApp (NestJS): este panel ya no toca Mongo directo
// para nada. Todo — login, eventos, producción, posts locales, lugares,
// directorio y la búsqueda/edición libre de posts — pasa por aquí.
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
// reenvía al backend en cada petición de este usuario.

app.post("/auth/google", async (req, res) => {
  try {
    if (!COLIMA_BACKEND_URL) {
      return res.status(500).json({ error: MENSAJE_SIN_BACKEND });
    }
    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({ error: "Falta el token de Google." });
    }

    const respuesta = await fetch(`${COLIMA_BACKEND_URL}/login/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: credential, platform: "web" }),
    });
    const datos = await respuesta.json();

    if (!respuesta.ok || datos.response === false) {
      return res.status(401).json({ error: datos.message || "No se pudo iniciar sesión." });
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

// --- Eventos pendientes (revisión de lo detectado por n8n) ---
// Migrado a backColimaApp (fase 2): este panel ya no toca la colección
// "eventos_pendientes" en Mongo, solo agrega el token de administrador y
// reenvía al backend real.

// Lista eventos por estatus. Ej: GET /api/pendientes?estatus=pendiente
app.get("/api/pendientes", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const params = new URLSearchParams({
      token: req.session.adminToken,
      estatus: req.query.estatus || "pendiente",
    });
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/eventos-pendientes?${params}`,
      undefined,
      "No se pudieron cargar los eventos",
    );
    if (datos) res.json(datos.eventos || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// --- Directorio de municipios por ID de página de Facebook ---

// Listar todo el directorio
app.get("/api/directorio", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const params = new URLSearchParams({ token: req.session.adminToken });
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/directorio-municipios?${params}`,
      undefined,
      "No se pudo cargar el directorio",
    );
    if (datos) res.json(datos.registros || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Agregar un nuevo registro al directorio
app.post("/api/directorio", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const { municipio_id, municipio_nombre, facebook_url, facebook_id, nota } =
      req.body || {};

    if (!facebook_id || !municipio_nombre) {
      return res
        .status(400)
        .json({ error: "Falta el ID de Facebook o el nombre del municipio" });
    }

    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/directorio-municipios`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: req.session.adminToken,
          municipio_id,
          municipio_nombre,
          facebook_url,
          facebook_id: String(facebook_id),
          nota,
        }),
      },
      "No se pudo agregar el registro",
    );
    if (datos) res.json({ ok: true, _id: datos.registro?._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Editar un registro del directorio
app.put("/api/directorio/:id", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const body = { ...req.body, id: req.params.id, token: req.session.adminToken };
    if (body.facebook_id !== undefined) body.facebook_id = String(body.facebook_id);

    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/directorio-municipios`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "No se pudo editar el registro",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Borrar un registro del directorio
app.delete("/api/directorio/:id", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/directorio-municipios`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.params.id, token: req.session.adminToken }),
      },
      "No se pudo borrar el registro",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// --- Lugares (para el subtítulo de los eventos y para Configuración > Lugares) ---
// Migrado a backColimaApp (fase 3): este panel ya no toca la colección
// "lugares" en Mongo, solo agrega el token de administrador y reenvía.

// Listar todos los lugares
app.get("/api/lugares", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const params = new URLSearchParams({ token: req.session.adminToken });
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/lugares?${params}`,
      undefined,
      "No se pudo cargar la lista de lugares",
    );
    if (datos) res.json(datos.lugares || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Agregar un nuevo lugar
app.post("/api/lugares", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const { nombre } = req.body || {};
    if (!nombre) {
      return res.status(400).json({ error: "Falta el nombre del lugar" });
    }

    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/lugares`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...req.body, token: req.session.adminToken }),
      },
      "No se pudo agregar el lugar",
    );
    if (datos) res.json({ ok: true, _id: datos.lugar?._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Editar un lugar
app.put("/api/lugares/:id", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/lugares`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...req.body, id: req.params.id, token: req.session.adminToken }),
      },
      "No se pudo editar el lugar",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Borrar un lugar
app.delete("/api/lugares/:id", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/lugares`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.params.id, token: req.session.adminToken }),
      },
      "No se pudo borrar el lugar",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// --- "Posts" en Configuración: buscar cualquier post (evento o local) por
// id o por título, y editar sus campos directamente. Reemplaza al viejo
// editor genérico de Mongo ("Base de Datos"): ya no hay acceso a Mongo
// crudo desde el panel, esto pasa por el backend igual que todo lo demás.

// Buscar posts. Ej: GET /api/posts-admin?q=feria del hongo
app.get("/api/posts-admin", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const params = new URLSearchParams({ token: req.session.adminToken });
    if (req.query.q) params.set("q", req.query.q);

    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post/admin-search?${params}`,
      undefined,
      "No se pudo buscar posts",
    );
    if (datos) res.json(datos.posts || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Editar los campos de un post existente (JSON libre; el backend descarta
// _id, kind y los arreglos sociales, que no se tocan desde aquí).
app.put("/api/posts-admin/:id", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const cambios = { ...(req.body || {}) };
    delete cambios._id;

    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post/admin-update`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.params.id, token: req.session.adminToken, cambios }),
      },
      "No se pudo editar el post",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Traduce contenido_crudo al inglés con Claude Haiku (backend) y regresa el
// resultado. No lo guarda todavía — el panel lo manda de vuelta como
// "descriptionEnglish" cuando se aprueba el evento.
app.post("/api/pendientes/:id/traducir", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/eventos-pendientes/traducir`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.params.id, token: req.session.adminToken }),
      },
      "No se pudo traducir. Revisa tu ANTHROPIC_API_KEY y tu saldo.",
    );
    if (datos) res.json({ descriptionEnglish: datos.descriptionEnglish });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Busca eventos ya aprobados/publicados que caigan en la misma fecha, para
// detectar publicaciones repetidas del mismo ayuntamiento antes de aprobar
// otra vez el mismo evento. GET /api/pendientes/mismo-dia?fecha=YYYY-MM-DD&excluir=<id>
app.get("/api/pendientes/mismo-dia", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const { fecha, excluir } = req.query;
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: "Falta una fecha válida (YYYY-MM-DD)" });
    }

    const params = new URLSearchParams({ token: req.session.adminToken, fecha });
    if (excluir) params.set("excluir", excluir);

    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/eventos-pendientes/mismo-dia?${params}`,
      undefined,
      "No se pudo buscar eventos de esa fecha",
    );
    if (datos) res.json(datos.eventos || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Aprobar un evento (recibe los datos capturados a mano por el revisor)
app.post("/api/pendientes/:id/aprobar", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const body = { ...req.body, id: req.params.id, token: req.session.adminToken };
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/eventos-pendientes/aprobar`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "No se pudo aprobar el evento",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Rechazar un evento
app.post("/api/pendientes/:id/rechazar", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/eventos-pendientes/rechazar`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.params.id, token: req.session.adminToken }),
      },
      "No se pudo rechazar el evento",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Devolver un evento a pendiente (por si te equivocas)
app.post("/api/pendientes/:id/deshacer", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/eventos-pendientes/deshacer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.params.id, token: req.session.adminToken }),
      },
      "No se pudo deshacer",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Publicar un evento aprobado a producción (crea el Post kind:'event' en el backend)
app.post("/api/pendientes/:id/publicar", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/eventos-pendientes/publicar`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.params.id, token: req.session.adminToken }),
      },
      "No se pudo publicar el evento",
    );
    if (datos) res.json({ ok: true, postId: datos.postId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// --- Posts en producción (Activos / Pausados / Papelera) ---
// Migrado a backColimaApp (fase 1 de mover colimago de Mongo directo
// al backend real): este panel ya no toca la colección "posts" en Mongo
// para estas acciones, solo agrega el token de administrador y reenvía.

// Lista posts según su estado. Ej: GET /api/posts?estatus=activo
app.get("/api/posts", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const params = new URLSearchParams({
      token: req.session.adminToken,
      estatus: req.query.estatus || "activo",
    });
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post/production?${params}`,
      undefined,
      "No se pudieron cargar los posts",
    );
    if (datos) res.json(datos.posts || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

async function accionProduccion(req, res, ruta, mensajeError) {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post/production/${ruta}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.params.id, token: req.session.adminToken }),
      },
      mensajeError,
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
}

// Pausar (ocultar) un post activo
app.post("/api/posts/:id/pausar", (req, res) =>
  accionProduccion(req, res, "pause", "No se pudo pausar el post"),
);

// Reactivar un post pausado
app.post("/api/posts/:id/activar", (req, res) =>
  accionProduccion(req, res, "activate", "No se pudo activar el post"),
);

// Mover un post a la papelera (borrado suave, recuperable)
app.post("/api/posts/:id/papelera", (req, res) =>
  accionProduccion(req, res, "trash", "No se pudo mover a la papelera"),
);

// Restaurar un post de la papelera
app.post("/api/posts/:id/restaurar", (req, res) =>
  accionProduccion(req, res, "restore", "No se pudo restaurar el post"),
);

// Eliminar un post permanentemente (solo desde la papelera). Reutiliza el
// endpoint genérico de borrado físico del backend (ya excluye kind:'local').
app.delete("/api/posts/:id", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.params.id, token: req.session.adminToken }),
      },
      "No se pudo eliminar el post",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// --- Posts locales (ríos, playas, lagos, montañas, hoteles, restaurantes) ---
// Ver docs/local-catalog-contract.md en el repo de la app. Este panel es
// cliente HTTP del backend real (backColimaApp); no toca Mongo directo aquí.

// El token de admin ya no se revisa aquí: lo exige el middleware de sesión
// montado en app.use("/api", ...) antes de llegar a cualquier handler.
function backendConfigurado(res) {
  if (!COLIMA_BACKEND_URL) {
    res.status(500).json({ error: MENSAJE_SIN_BACKEND });
    return false;
  }
  return true;
}

// Reenvía la respuesta del backend real como un error legible del panel.
// El backend de posts locales responde 200 con { response:false, message }
// para sus errores de negocio (token inválido, no encontrado, etc.), así que
// hay que revisar ambos: el status HTTP y el campo "response".
async function proxyBackend(res, url, options, mensajeError) {
  const respuesta = await fetch(url, options);
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    res
      .status(502)
      .json({ error: `El backend de ColimaApp respondió ${respuesta.status}` });
    return null;
  }
  if (datos.response === false) {
    res.status(400).json({ error: datos.message || mensajeError });
    return null;
  }
  return datos;
}

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
app.get("/api/locales", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const params = new URLSearchParams({ token: req.session.adminToken });
    if (req.query.type) params.set("type", req.query.type);
    if (req.query.municipalityId)
      params.set("municipalityId", req.query.municipalityId);

    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post/local?${params}`,
      undefined,
      "No se pudieron cargar los posts locales",
    );
    if (datos) res.json(datos.locales || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Alta de un post local nuevo. El panel nunca manda campos de evento
// (date, finishDate, isCover, etc.) porque el formulario del cliente solo
// junta los campos de §4 del contrato.
app.post("/api/locales", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const body = { ...req.body, token: req.session.adminToken };
    normalizarLocation(body);

    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post/local`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "No se pudo crear el post local",
    );
    if (datos) res.json({ ok: true, post: datos.post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Editar un post local existente (incluye reactivarlo mandando status:true).
app.put("/api/locales/:id", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const body = { ...req.body, token: req.session.adminToken, id: req.params.id };
    normalizarLocation(body);

    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post/local`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "No se pudo editar el post local",
    );
    if (datos) res.json({ ok: true, post: datos.post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Baja lógica (status:false). Nunca hay un endpoint de borrado físico para
// posts locales: sus likes/comentarios/favoritos cuelgan de su _id permanente.
app.post("/api/locales/:id/baja", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post/local`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.params.id, token: req.session.adminToken }),
      },
      "No se pudo dar de baja el post local",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Reactivar (status:true) un post local dado de baja.
app.post("/api/locales/:id/reactivar", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post/local`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: req.params.id,
          token: req.session.adminToken,
          status: true,
        }),
      },
      "No se pudo reactivar el post local",
    );
    if (datos) res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// Export del catálogo para empaquetar en el siguiente release de la app
// (contrato §7). El panel solo reenvía el JSON tal cual; el navegador lo
// descarga como archivo.
app.get("/api/locales/export", async (req, res) => {
  if (!backendConfigurado(res)) return;
  try {
    const datos = await proxyBackend(
      res,
      `${COLIMA_BACKEND_URL}/post/export-locales?token=${encodeURIComponent(req.session.adminToken)}`,
      undefined,
      "No se pudo exportar el catálogo",
    );
    if (datos) res.json(datos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo conectar con el backend de ColimaApp" });
  }
});

// En local (npm start) levantamos el puerto. En Vercel este archivo se
// importa desde api/index.js y es Vercel quien atiende las peticiones.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`colimago corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
