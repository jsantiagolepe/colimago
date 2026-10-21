# Guía web de Colima Go (contraparte web de la app)

La app móvil (React Native, repo `ColimagoMovil`) tiene cinco pestañas: Inicio,
Explorar, Calendario, Favoritos y Ajustes, más las fichas de lugares,
municipios, fiestas y eventos. La guía web las replica en colimago.mx. La
portada (`/`) no cambia; la guía vive en rutas propias.

Sin framework ni build: HTML renderizado en el servidor (Express, plantillas
de JavaScript), CSS y JS vanilla en `public/`. El navegador nunca habla con el
backend (`backColimaApp`): todo pasa por este servidor.

## Rutas

Todas existen también bajo `/en/…` (mismo path, textos en inglés).

| Ruta | Pantalla de la app | Datos |
|---|---|---|
| `/inicio` | Inicio (`MainScreen`): mapa de feria, Top 10, accesos | local + backend (Top 10) |
| `/explorar` | Explorar (feed): eventos + lugares intercalados | backend + local |
| `/calendario` | Calendario | backend |
| `/favoritos` | Favoritos | localStorage + cuenta |
| `/ajustes` | Ajustes | local |
| `/ajustes/cuenta` | Cuenta (eliminar cuenta) | cuenta |
| `/acerca-de` | Acerca de | local |
| `/rincones-naturales` y `/rincones-naturales/:categoria` | Rincones Naturales (9 categorías) | local |
| `/playas` | Playas | local |
| `/municipios` y `/municipios/:slug` | Municipios y detalle | local + backend (eventos) |
| `/fiestas-del-pueblo` y `/fiestas-del-pueblo/:id` | Fiestas del Pueblo y su hoja | local |
| `/fiestas-charrotaurinas` | Feria Charrotaurina | local |
| `/tianguis-y-mercados` | Tianguis y mercados | local |
| `/lugar/:slug` | Detalle de lugar | local + backend (contadores, comentarios) |
| `/evento/:id` | Detalle de evento / portada | backend |

Categorías de Rincones (`:categoria`): `rios` (10), `playas` (11), `lagunas`
(12), `montanas` (13), `arqueologia` (14), `parques` (15), `patrimonio` (16),
`balnearios` (17), `rutas` (18).

## Datos locales (`data/`)

Los genera `scripts/importar-app-movil.js` desde el repo de la app (solo
lectura). No se editan a mano salvo `data/feria.json` y los textos de
`data/i18n/`.

- `data/municipios.json`, `data/lugares.json`, `data/fiestas-pueblo.json`,
  `data/feria.json`, `data/mapa-feria.json`, `data/i18n/{es,en}/*.json`.
- Esquemas: ver `docs/guia-datos.md`.
- Imágenes: `public/img/l/` (lugares), `public/img/m/` (municipios),
  `public/img/feria/`, `public/img/c/` (categorías y portadas de tablas).

## Backend (público) y sesión

Ver `lib/guia/eventos.js` (feed con caché), `lib/guia/sesion.js` (cookie
cifrada con el JWT de usuario, límites de tasa) y `lib/guia/api.js`
(endpoints JSON `/g/*` para el navegador). Notas del backend:

- `GET /post/` no recibe parámetros: devuelve todos los eventos (pasados y
  futuros). El orden y el filtro de fechas se hacen aquí.
- `date` es hora flotante: el reloj UTC es la hora local de Colima. No
  convertir zona horaria.
- `finishDate` solo vale si `moreDays` es `true` (si no, es `Date.now()`).
- `images` es un string (URL de Cloudinary) o `[]`.
- Los comentarios exponen el `_id` del usuario: se quita antes de mandarlos
  al navegador.
- Likes, comentarios, favoritos de cuenta, reportar y ocultar exigen login
  con Google (`platform: "web"`).

## Archivos y quién los toca

```
lib/guia/
  index.js         router raíz (monta es y en, api, sitemap)
  h.js             plantillas HTML con escape automático
  i18n.js          t(), fechas, nombres de municipio
  datos.js         carga y consultas del catálogo local
  eventos.js       feed del backend, caché y normalización
  sesion.js        cookie de sesión de usuario, límites de tasa
  api.js           endpoints JSON /g/*
  layout.js        <html>, barra, pestañas, pie, plantillas globales
  componentes.js   letrero, guirnalda, tarjetas, anuncio, etc.
  paginas/*.js     una página por archivo: export function (req, ctx) → { titulo, … }
public/css/guia.css          tokens, base y componentes
public/css/paginas/*.css     estilos propios de cada página
public/js/core.js            tema, guirnaldas, revelado, favoritos, toasts, login
public/js/social.js          me gusta, comentarios, reportar
public/js/paginas/*.js       interacción propia de cada página
```

## Variables de entorno nuevas

- `ADSENSE_CLIENT` (`ca-pub-…`), `ADSENSE_SLOT_FEED`, `ADSENSE_SLOT_BANNER`:
  activan Google AdSense en los espacios de anuncio. Sin ellas cada espacio
  muestra una promo propia de Colima Go.
- `GOOGLE_CLIENT_ID_WEB`: client id de Google para el login de usuarios
  (por defecto el de la portada).
