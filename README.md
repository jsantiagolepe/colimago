# colimago — panel de administración de Colima Go

Panel interno de [colimago.mx](https://colimago.mx) para revisar eventos
detectados por el flujo de n8n, administrar posts (eventos y locales), lugares
y el directorio de páginas de Facebook. No toca MongoDB directo: todo pasa por
el backend real de ColimaApp (`backColimaApp`, NestJS, desplegado en Heroku).

## Cómo correrlo en local

1. Necesitas `backColimaApp` accesible (local en `http://localhost:3000/api` o
   el de producción, `https://colimaapp.herokuapp.com/api`).
2. Abre una terminal dentro de esta carpeta (`colimago`) y corre:
   ```
   npm install
   ```
3. Copia `.env.example` a `.env` y llena:
   - `COLIMA_BACKEND_URL`: URL del backend, con el prefijo `/api`.
   - `SESSION_SECRET`: un valor aleatorio para firmar la cookie de sesión.
   - `ADMIN_USER_ID`: debe coincidir con `src/common/constants/admin.constant.ts`
     en `backColimaApp` (ya trae el valor correcto por default).
4. Corre el servidor:
   ```
   npm start
   ```
5. Abre tu navegador en: http://localhost:3001 e inicia sesión con la cuenta
   de Google administradora (la de `ADMIN_USER_ID`).

## Despliegue en Vercel (colimago.mx)

El repo está conectado a Vercel: cada `git push` a `main` se despliega solo.
No hay paso de build; Vercel corre `server.js` como función serverless a
través de `api/index.js` (ver `vercel.json`) y sirve `public/` como
archivos estáticos.

Antes del primer despliegue, en Vercel → Settings → Environment Variables
captura (para Production y Preview):

| Variable             | Valor                                        |
| -------------------- | -------------------------------------------- |
| `COLIMA_BACKEND_URL` | `https://colimaapp.herokuapp.com/api`        |
| `SESSION_SECRET`     | un valor aleatorio largo (ver `.env.example`) |
| `ADMIN_USER_ID`      | `6705a6ce37e1cf2548b7f44c`                   |

Y en Google Cloud Console, en el cliente OAuth web que usa `public/index.html`
(`GOOGLE_CLIENT_ID_WEB`), agrega como **Orígenes de JavaScript autorizados**:
`https://colimago.mx`, `https://www.colimago.mx` y la URL `*.vercel.app` del
proyecto. Sin eso el botón de Google no carga en producción.

El backend de Heroku no necesita cambios (ni CORS): el navegador nunca le
habla directo, siempre lo hace este servidor.

### Estructura

- `server.js` — la app de Express: login con Google, sesión, y proxy de
  todas las rutas `/api/*` hacia `backColimaApp`.
- `api/index.js` — punto de entrada para Vercel (solo exporta `server.js`).
- `public/` — lo público: `index.html` (página + login).
- `views/` — lo privado: `dashboard.html`, servido por Express solo con
  sesión iniciada (por eso no está en `public/`).

## Qué hace

- **Pendientes / Aprobados / Rechazados:** revisión de eventos detectados por
  n8n — traducir con IA, aprobar (captura fecha, municipio, tipo, etc.),
  rechazar, deshacer, y publicar a producción.
- **Producción:** Activos / Pausados / Papelera de los eventos ya publicados.
- **Posts locales:** alta, edición, baja lógica y export del catálogo para
  la app (ríos, playas, hoteles, restaurantes — ver
  `docs/local-catalog-contract.md` en el repo de la app).
- **Configuración → Directorio de páginas / Lugares / Posts:** CRUD de la
  relación página de Facebook↔municipio, lugares para el subtítulo de
  eventos, y búsqueda/edición libre de cualquier post por título o `_id`.

## Seguridad

El login usa Google Identity Services, restringido a una sola cuenta
(`ADMIN_USER_ID`, verificado por el backend). La sesión es una cookie firmada
con `SESSION_SECRET` (`cookie-session`) que guarda solo el JWT real de esa
sesión — no hay ningún token ni contraseña fija compartida en el `.env`.
