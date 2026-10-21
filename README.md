# colimago — sitio web de Colima Go

[colimago.mx](https://colimago.mx) tiene tres partes: la **portada** (`/`, una
página estática que invita a instalar la app), la **guía web** (la contraparte
web de la app móvil: inicio, explorar, calendario, favoritos, lugares,
municipios, fiestas y eventos; ver [Guía web](#guía-web)) y el **panel de
administración** (hoy apagado).

## Panel de administración

Panel interno de [colimago.mx](https://colimago.mx) para revisar eventos
detectados por el flujo de n8n, administrar posts (eventos y locales), lugares
y el directorio de páginas de Facebook. No toca MongoDB directo: todo pasa por
el backend real de ColimaApp (`backColimaApp`, NestJS, desplegado en Heroku).

## Panel de administración: desactivado

Desde el 10 de octubre de 2026 el panel está **apagado**, para que nadie
pueda iniciar sesión ni modificar datos desde colimago.mx mientras no se
usa. Se apagó con un interruptor, no borrando código: se puede prender de
nuevo en minutos.

**Qué sigue funcionando:** la portada (`/`), los links de descarga (`/app`,
`/ios`, `/android`, `/realestate`), las imágenes, `robots.txt`, `sitemap.xml`, `llms.txt` y
la página 404.

**Qué está apagado:** `/login`, `/dashboard.html`, `/auth/*` y `/api/*`
responden el 404 normal del sitio, como si no existieran. El corte ocurre
antes de revisar la sesión, así que aunque alguien tuviera una cookie de
sesión vigente, ninguna petición llega al backend.

**Qué no se tocó:**

- Todo el código del panel: `views/dashboard.html`, las rutas de
  `server.js`, `lib/colima-backend.js` y el modal de login de
  `public/index.html` (solo se abre en `/login`, que ahora da 404).
- Las reglas de `robots.txt` para `/login`, `/dashboard.html`, `/api/` y
  `/auth/` (sirven igual al reactivar).
- Las variables de Vercel (`COLIMA_BACKEND_URL`, `SESSION_SECRET`,
  `ADMIN_USER_ID`).
- El backend (`backColimaApp`): este interruptor solo cierra la puerta de
  colimago.mx; la app sigue funcionando igual. Si el flujo de n8n sigue
  corriendo, los eventos que detecte se acumulan como pendientes y
  aparecen en **Pendientes** al reactivar el panel.

### Cómo reactivarlo

Todo depende de una sola variable, `PANEL_ACTIVO` (ver el inicio de
`server.js`). Solo el valor `1` lo prende; sin la variable, o con
cualquier otro valor, queda apagado.

**En colimago.mx (producción):**

1. Vercel → el proyecto → Settings → Environment Variables → agrega
   `PANEL_ACTIVO` con valor `1` (en Production, y en Preview si también
   lo quieres ahí).
2. Deployments → el más reciente → **Redeploy**. Las variables solo
   aplican a deploys nuevos.
3. Confirma que siguen capturadas `COLIMA_BACKEND_URL`, `SESSION_SECRET`
   y `ADMIN_USER_ID` (ver [Despliegue en Vercel](#despliegue-en-vercel-colimagomx)).
4. Abre https://colimago.mx/login e inicia sesión con la cuenta de Google
   administradora.
5. Si el botón de Google no carga, revisa en Google Cloud Console que el
   cliente OAuth siga teniendo los orígenes autorizados (sección de
   Vercel, abajo).

**Solo en tu computadora, sin abrirlo en internet:** agrega
`PANEL_ACTIVO=1` a tu `.env` y corre `npm start` (ver
[Cómo correrlo en local](#cómo-correrlo-en-local)). Si `COLIMA_BACKEND_URL`
apunta al backend de producción, puedes administrar desde
http://localhost:3001 mientras colimago.mx sigue con el panel apagado.

**Para volver a apagarlo:** borra `PANEL_ACTIVO` en Vercel (o ponle `0`) y
haz Redeploy.

### Cómo saber en qué estado está

- https://colimago.mx/login: si da la página 404, está apagado; si abre la
  ventana de "Bienvenido de vuelta", está prendido.
- En los logs (Vercel o la terminal), al arrancar con el panel apagado se
  imprime: `Panel de administración desactivado (PANEL_ACTIVO no es 1)…`.

## Guía web

La guía replica en la web lo que hace la app móvil (`ColimagoMovil`): las cinco
pestañas (Inicio, Explorar, Calendario, Favoritos, Ajustes) y las fichas de
lugares, municipios, fiestas del pueblo, la Feria Charrotaurina y eventos, en
español y en inglés (`/en/…`). Es HTML renderizado en el servidor (sin
framework ni build), con CSS y JS vanilla. Documentación a fondo:
[docs/guia-web.md](docs/guia-web.md) (rutas y módulos) y
[docs/guia-datos.md](docs/guia-datos.md) (datos e imágenes).

- **Eventos, Top 10, comentarios y contadores** vienen del backend real, leídos
  desde este servidor (el navegador nunca habla con Heroku) y cacheados un
  minuto. Los eventos pasados se separan de los próximos.
- **Lugares, municipios, fiestas del pueblo y la Feria** vienen de `data/`,
  exportado de la app con `node scripts/importar-app-movil.js` (solo lee el repo
  de la app; `--origen <ruta>` para otra ubicación). Si la app cambia su
  catálogo, se vuelve a correr y se sube el resultado.
- **Cuentas:** login con Google (`platform: "web"`). Me gusta, comentarios,
  favoritos de cuenta y reportar exigen sesión; favoritos también funcionan sin
  cuenta (en el navegador). La sesión es una cookie cifrada, httpOnly.
- **Anuncios:** la app usa AdMob; la web usa Google AdSense. El ID de editor
  (`ca-pub-5479273904422379`) ya está en el código: la guía carga el script de
  AdSense, publica `/ads.txt` y la portada lleva solo la etiqueta
  `google-adsense-account` (sin cargar nada). Los bloques de anuncio se piden
  cuando están `ADSENSE_SLOT_BANNER` y `ADSENSE_SLOT_FEED` (los números de las
  unidades que se crean en AdSense → Anuncios → Por unidad de anuncio); sin
  ellos cada espacio muestra una promo propia de Colima Go, a lo más una por ~9
  elementos. Con los bloques activos, la cadencia es la de la app (cada 3).
  Mantén apagados los "anuncios automáticos" del sitio en AdSense: el diseño
  reserva el espacio de cada anuncio y no admite anuncios sobre el contenido.
- **SEO:** `/sitemap.xml` es dinámico (lugares, municipios, fiestas, eventos
  vigentes, es/en con hreflang). Favoritos, ajustes y sugerencias llevan
  `noindex`.

Probarla en local, sin tocar producción: en una terminal
`node scripts/backend-falso.js 4010` (backend falso con el feed real; `TOP10=1`
llena el Top 10, `FALLA=1` simula un error), y en otra
`COLIMA_BACKEND_URL=http://127.0.0.1:4010/api npm start`; abre
http://localhost:3001/inicio. Verificaciones sin red: `npm run verificar:datos`
y `npm run verificar:guia`.

Variables de entorno nuevas (todas opcionales): `ADSENSE_CLIENT` (vacía apaga AdSense),
`ADSENSE_SLOT_BANNER`, `ADSENSE_SLOT_FEED`, `GOOGLE_CLIENT_ID_WEB` (por defecto,
el de la portada). En Vercel debe estar definida `SESSION_SECRET`: con ella se
cifra la cookie de sesión de los usuarios. Para que el login de Google funcione
en producción, `https://colimago.mx` y `https://www.colimago.mx` deben estar
como orígenes autorizados del cliente OAuth web.

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
   - `PANEL_ACTIVO`: `1` para usar el panel. Sin eso, `/login` y
     `/dashboard.html` dan 404 (ver [Panel de administración: desactivado](#panel-de-administración-desactivado)).
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
| `PANEL_ACTIVO`       | `1` solo para prender el panel (hoy no está: apagado) |

Y en Google Cloud Console, en el cliente OAuth web que usa `public/index.html`
(`GOOGLE_CLIENT_ID_WEB`), agrega como **Orígenes de JavaScript autorizados**:
`https://colimago.mx`, `https://www.colimago.mx` y la URL `*.vercel.app` del
proyecto. Sin eso el botón de Google no carga en producción.

El backend de Heroku no necesita CORS: el navegador nunca le habla directo,
siempre lo hace este servidor. Lo único que necesita es aceptar
`platform: "web"` en `POST /logs` (ver [Registro de visitas](#registro-de-visitas)).

### Estructura

- `server.js` — la app de Express: login con Google, sesión, y proxy de
  todas las rutas `/api/*` hacia `backColimaApp`.
- `lib/colima-backend.js` — el único cliente HTTP hacia `backColimaApp`.
  Toda llamada al backend sale de aquí con la cabecera
  `Authorization: Bearer <token de admin>` — la única forma en que el
  backend acepta el token (ya no viaja como campo `token` en query/body).
  Convierte los 401/403/429/400 del backend y los
  `{ response:false, message }` en errores con el `message` original.
- `scripts/verificar-backend.js` — `npm run verificar`: levanta un backend
  falso, recorre todas las rutas `/api/*` y comprueba que cada llamada
  llegó con la cabecera `Authorization` y sin `token` en query/body (y que
  `POST /images` manda los campos `image` y `folder`). No necesita el
  backend real, y prende el panel solo para su prueba (`PANEL_ACTIVO=1`).
- `lib/visitas.js` — arma el evento `app_opened` de una visita (navegador,
  sistema, versión del sitio) y descarta bots.
- `scripts/verificar-visitas.js` — `npm run verificar:visitas`: con un
  backend falso, comprueba que cada visita llega a `POST /logs` con
  `platform: "web"` y solo los campos que ese endpoint acepta.
- `api/index.js` — punto de entrada para Vercel (solo exporta `server.js`).
- `public/` — lo público: `index.html` (página + login).
- `views/` — lo privado: `dashboard.html`, servido por Express solo con
  sesión iniciada (por eso no está en `public/`).

## Registro de visitas

Cada visita a la portada (`/`) guarda un `app_opened` en la colección `logs`
de Mongo, la misma donde la app móvil guarda el suyo, con `platform: "web"`:

```js
{
  event: 'app_opened',
  userId: '6acd5bfd8677ca46b7ae4296',  // id aleatorio que guarda el navegador
  platform: 'web',
  deviceModel: 'Chrome 126',           // el navegador (o 'Facebook', 'Instagram')
  osVersion: 'iOS 17.5',               // el sistema; 'Android', 'Windows', 'macOS' sin versión
  appVersion: '1.0.0',                 // versión de package.json
  appBuild: '3669c93',                 // commit desplegado; 'local' fuera de Vercel
  timestamp: ISODate('2026-10-12T22:15:24.662Z')
}
```

**Cómo llega ahí:** el script del final de `public/index.html` manda
`POST /visita` con solo el `userId`; `server.js` lo completa con
`lib/visitas.js` y lo envía a `POST /logs` del backend, sin
`Authorization` (el endpoint es público). Igual que en la app, no se guarda
IP, user agent, cookies ni nada de una cuenta.

**Qué cuenta como una visita:**

- Una por pestaña: recargar la página no suma, abrirla en otra pestaña sí.
- `userId` se guarda en `localStorage` (`colimago-visitante`); si el
  navegador no deja guardarlo, no se registra nada (la app hace lo mismo
  con su id).
- Solo la portada. `/app`, `/ios`, `/android` y `/realestate` no registran.
- Se descartan los bots (Googlebot, Lighthouse, Chrome headless, curl…) por
  su user agent.

**Cuándo está prendido:** en Vercel solo en Production (`VERCEL_ENV`), para
que los deploys de prueba no ensucien los datos. En local queda apagado; para
probarlo, `VISITAS_ACTIVO=1` en `.env` y un `COLIMA_BACKEND_URL` de
desarrollo. `npm run verificar:visitas` lo prueba sin backend real.

**Límites que conviene saber:**

- Chrome oculta la versión de Android (siempre dice 10), y Windows y macOS
  tampoco la dan en el user agent, por eso `osVersion` es solo `Android`,
  `Windows` o `macOS` en esos casos. El iPad en modo escritorio se ve como
  `macOS`.
- Todas las visitas llegan al backend desde este servidor, así que su límite
  de 30 por minuto por IP (`THROTTLE_LOGS` en `backColimaApp`) cuenta a todos
  los visitantes juntos. Más de 30 portadas abiertas en un minuto pierden
  eventos (el backend responde 429; queda en los logs de Vercel).
- Requiere que `backColimaApp` acepte `platform: "web"` (`LOG_PLATFORMS` en
  `src/logs/entities/log.entity.ts`); mientras no esté desplegado, el backend
  rechaza el evento con 400 y no se guarda nada.

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
Ese JWT es el que `lib/colima-backend.js` manda al backend en cada
petición como `Authorization: Bearer <jwt>`. Si el backend responde 401
(token inválido/expirado) el panel muestra el mensaje y regresa al login;
los 403 (la cuenta no es administradora) y 429 (rate limit, p. ej.
"traducir" máx. 20 por hora) se muestran tal cual al usuario.

Para ver en consola cada llamada al backend y si lleva la cabecera, corre
el panel con `COLIMA_DEBUG_BACKEND=1 npm start`.

## Guía web: servidor

La guía web (la contraparte web de la app móvil, ver `docs/guia-web.md`) tiene
una capa de servidor propia. El navegador nunca habla con `backColimaApp`: todo
pasa por aquí, con `lib/colima-backend.js`.

- `lib/guia/eventos.js` — lee el feed público (`GET /post/`, sin token),
  normaliza cada evento (fecha y hora sin convertir zona, `finFecha` solo con
  `moreDays`, imagen `string|null`, municipio como número) y lo guarda en
  memoria: 60 s fresco, hasta 1 h como respaldo si el backend falla, una sola
  petición para llamadas simultáneas y 2 reintentos solo ante red o 5xx. También
  `obtenerEvento(id)`, `obtenerTop10()` y las consultas (`proximos`, `pasados`,
  `eventosDeMunicipio`, `diasDelEvento`, `urlImagen`). Nunca lanza.
- `lib/guia/sesion.js` — sesión de usuario (cualquier cuenta de Google), aparte
  de la del panel: cookie `colimago.u` (httpOnly, sameSite lax, 30 días, `secure`
  en producción) con el JWT del backend **cifrado** con AES-256-GCM, más la
  defensa CSRF (`X-Requested-With: colimago` + mismo origen) y el límite de tasa
  en memoria.
- `lib/guia/api.js` — endpoints JSON bajo `/g`, todos con `Cache-Control:
  no-store`, errores en español y cuerpo máximo de 8 kB:

  | Endpoint | Qué hace |
  | --- | --- |
  | `GET /g/sesion` | `{ usuario:{nombre,img,email}\|null }` |
  | `POST /g/login/google` `{credential}` | login (8/min por IP); guarda la sesión |
  | `POST /g/logout` | cierra sesión |
  | `POST /g/me-gusta` `{idPost}` | alterna el me gusta → `{ ok, activo }` |
  | `GET /g/comentarios/:id` | comentarios sin datos de usuario, con `propio` |
  | `POST /g/comentarios/:id` `{contenido}` | comenta (1–500, 15/min por usuario) |
  | `DELETE /g/comentarios/:id/:idComentario` | borra el propio |
  | `POST /g/vista/:id` | cuenta una vista → 204 (60/min por IP) |
  | `POST /g/metricas` `{ids}` | likes, vistas, comentarios y marcas del usuario |
  | `GET/POST /g/favoritos`, `DELETE /g/favoritos/:id` | favoritos de cuenta |
  | `POST /g/favoritos/fusionar` `{ids}` | sube los favoritos locales que falten |
  | `POST /g/reportar` `{idReport,tipo,texto}` | reporta (5/min por usuario) |
  | `POST /g/ocultar` `{idPost}` | oculta un evento para el usuario |
  | `DELETE /g/cuenta` | borra la cuenta en el backend y cierra sesión |

  Toda petición que escribe (POST/PUT/PATCH/DELETE) debe llevar la cabecera
  `X-Requested-With: colimago`. El router se monta con
  `app.use("/g", require("./lib/guia/api"))` (lo hace `lib/guia/index.js`).

**Variables:** `COLIMA_BACKEND_URL` (sin ella los endpoints responden 503 y los
eventos quedan vacíos), `SESSION_SECRET` (llave de la cookie `colimago.u`; sin
ella se usa un valor de desarrollo y se avisa por consola: en producción debe
estar definida) y `NODE_ENV=production` (pone `Secure` en la cookie).

**Límites que conviene saber:** todos los visitantes salen a `backColimaApp` por
la misma IP de Vercel, así que el backend cuenta sus límites (login 10/min,
comentario 15/min, reporte 5/min, ocultar 30/min, 120/min en el resto) entre
todos. Por eso hay límites propios antes de llamar y cachés cortas para lo
anónimo (comentarios 20 s, métricas 30 s). Límites y cachés viven en la memoria
de cada instancia de Vercel: frenan abusos, no son una cuota exacta.

**Probarlo:** `npm run verificar:guia` levanta un backend falso (con datos reales
de producción en `scripts/fixtures/guia/`), importa `server.js` y comprueba
normalización, caché, sesión cifrada, CSRF, límites y cada endpoint. No toca el
backend real.
