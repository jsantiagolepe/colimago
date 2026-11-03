# MyProject

Aplicación personal de escritorio para macOS: un solo lugar para mis apps,
proyectos, dashboards, estudio, finanzas, ideas y herramientas. Hecha con
**Tauri 2 + React 19 + TypeScript**; el backend sigue siendo el NestJS
remoto en Heroku.

Después del login se abre el **inicio**: arriba, **Pendientes** (lo que
falta hoy en Calendar y Tareas; se palomea ahí mismo y se recorre si no
cabe) y **Tu semana** (de lunes a domingo, qué porcentaje de lo de cada
día quedó resuelto: los checks de Calendar de ese día y las tareas con esa
fecha terminadas a tiempo); abajo, una tarjeta por módulo. Hoy son
**ColimaGo** (el panel de administración que antes vivía en colimago.mx:
eventos, producción, posts locales, lugares y directorio), **MagentaApp**,
**MagentaWeb**, **ColimaGoWeb**, **English**, **Finances**, **GRC** (ruta
de 6 meses para entrar a GRC en ciberseguridad: SGSI e ISO 27001, práctica
en una empresa ficticia, portafolio, CV y Lead Implementer, semana por
semana y con cada paso para palomear), **Tareas** (con fecha, hechas y por
hacer), **Cursos** y **Score**. **Calendar** (el mes a pantalla completa
con checks diarios) ya no tiene tarjeta en el inicio, pero sigue en
`#/calendar` y sus checks siguen saliendo en Pendientes.

## Requisitos

- macOS 13 o superior, con las herramientas de línea de comandos de Xcode.
- Node 22 (`nvm use` dentro de la carpeta toma la versión de `.nvmrc`).
- Rust estable (`rustup`).

## Comandos

```sh
npm install            # dependencias del frontend y la CLI de Tauri
npm run app:dev        # la app en modo desarrollo, con recarga en vivo
npm run app:install    # compila, instala en /Applications y la abre
npm run app:build      # solo compila (.app y .dmg en src-tauri/target/release/bundle/)
npm test               # pruebas del frontend (Vitest)
cd src-tauri && cargo test   # pruebas del núcleo en Rust
```

La app instalada no necesita ningún servidor local ni `npm run dev`.

## Cómo está organizada

```
src/                         Frontend (React + TypeScript)
  app/                       Router y marco de la parte privada
  core/                      Lo que comparten todos los módulos
    auth/                    Sesión, login con Google, rutas protegidas
    backend/client.ts        Cliente del backend remoto (vía Rust)
    platform/                Enlaces externos, guardar archivos, logs, datos locales
    ui/                      Piezas visuales comunes
  features/login/            Pantalla de inicio de sesión
  features/home/             Inicio (pendientes y tarjetas de módulos) y pantalla de módulo vacío
  modules/                   Un directorio por módulo + registry.ts
    colima-go/
      api/rutas.ts           Las rutas /api/* que antes atendía server.js
      legacy/                El panel original (JS sin framework), montado tal cual
    calendar/                El mes, el panel del día y el modal para agregar checks
    tasks/                   Tareas: agregar, palomear, editar, fecha, borrar y deshacer
src-tauri/                   Núcleo nativo (Rust)
  src/auth/                  Login con Google (loopback) y sesión en el Llavero
  src/backend.rs             Única puerta hacia el backend; agrega el token
  src/maps.rs                Resuelve links cortos de Google Maps
  src/files.rs               Guardar archivos con el diálogo nativo
  src/storage.rs             Datos locales de los módulos (JSON en Application Support)
  src/config.rs              URL del backend, client id de Google, cuenta dueña
  capabilities/default.json  Permisos de la ventana (lista explícita)
```

### Agregar un módulo

1. Crea `src/modules/<id>/index.ts` que exporte un `AppModule` (ver
   `src/modules/types.ts`) con su `path`, su ícono y color de tarjeta y,
   cuando tenga pantalla, su componente (`React.lazy`). Sin componente,
   el módulo abre una pantalla vacía.
2. Agrégalo a la lista de `src/modules/registry.ts`, en el orden en que
   debe salir en el inicio.

El router le da su ruta protegida y el inicio su tarjeta automáticamente.
Cada módulo trae su propia forma de volver al inicio (ColimaGo: el botón
**Inicio** arriba de su barra lateral). Si el módulo necesita algo nativo
(otra API, disco, notificaciones), se agrega un comando en
`src-tauri/src`, se declara en `src-tauri/build.rs` y se concede en
`src-tauri/capabilities/default.json`. Para guardar datos propios ya
existe `createDocumentStore` (`src/core/platform/document-store.ts`): un
documento JSON por nombre (`calendar`, `tasks`), en memoria y compartido
por todas las pantallas que lo usan, con los guardados en fila.

Para que un módulo aparezca en **Pendientes** y en **Tu semana**, dale un
`pending` (ver `PendingSource` en `src/modules/types.ts`); lo más fácil es
armarlo con `pendingFromStore` a partir de su documento, como
`src/modules/tasks/store.ts`.

## Datos locales

Los módulos que guardan cosas en tu Mac (hoy, Calendar y Tareas) lo hacen en
`~/Library/Application Support/com.juliosantiago.myproject/data/<nombre>.json`.
La versión de desarrollo y la instalada usan la misma carpeta, así que ven
los mismos datos. Para respaldar o empezar de cero, copia o borra ese
archivo con la app cerrada; si `calendar.json` o `tasks.json` no existen,
vuelven los datos de ejemplo.

## Inicio de sesión

Google no permite iniciar sesión dentro de un webview embebido ni acepta
el origen `tauri://localhost`, así que la app sigue el estándar para apps
nativas (RFC 8252):

1. Al pulsar **Continuar con Google**, Rust levanta un servidor efímero en
   `http://localhost:3001` (o `:5173` si 3001 está ocupado) y abre esa
   página en tu navegador.
2. La página usa el mismo botón de Google y el mismo client id web que
   usaba colimago.mx; Google le entrega el `id_token`.
3. La página lo regresa a la app junto con un `state` aleatorio. La app
   valida `state`, `nonce`, audiencia, emisor y vigencia, y lo manda al
   backend (`POST /login/google`), que verifica la firma y responde con
   su JWT.
4. Si la cuenta es la autorizada (`config.rs`), el JWT se guarda en el
   **Llavero de macOS** y entras directo al inicio. La sesión sobrevive a
   cerrar la app; si el backend la rechaza (401), se borra y vuelves al
   login.

Los dos orígenes (`http://localhost:3001` y `http://localhost:5173`) ya
están autorizados en el cliente OAuth web de Google Cloud. Si algún día se
cambian los puertos en `config.rs`, hay que agregarlos ahí también
(Credenciales → Orígenes de JavaScript autorizados).

## Seguridad

- No hay secretos en la app ni en el repo. El client id de Google es
  público; el único dato sensible es el JWT de la sesión, que vive en el
  Llavero y nunca llega al frontend: Rust lo agrega a cada petición.
- El webview no tiene acceso directo a red, disco ni shell. Solo puede
  llamar los comandos listados en `capabilities/default.json`; la puerta
  al backend solo acepta rutas relativas a la URL configurada y nunca
  sigue redirects con el token.
- CSP estricta (`script-src 'self'`, sin `eval`), conexiones solo por IPC,
  y la ventana nunca navega fuera de la app: los enlaces externos se abren
  en tu navegador.
- La app se firma con tu certificado de Apple Development si existe, para
  que macOS la reconozca como la misma app entre versiones.

## Configuración

Todo está en `src-tauri/src/config.rs`. Para compilar contra otro backend
o con otra cuenta autorizada:

```sh
MYPROJECT_BACKEND_URL=http://localhost:3000/api npm run app:dev
MYPROJECT_OWNER_USER_ID=<id de Mongo> npm run app:build
```

## Diagnóstico

- Log de la app instalada: `~/Library/Logs/com.juliosantiago.myproject/MyProject.log`
  (peticiones al backend con su status y tiempo, inicio/cierre de sesión y
  errores del frontend; nunca tokens).
- "Otra aplicación está usando los puertos 3001 y 5173": cierra lo que los
  use (`lsof -i :3001`) e intenta de nuevo.
