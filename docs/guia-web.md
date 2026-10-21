# Guía web de Colima Go (contraparte web de la app)

La app móvil (React Native, repo `ColimagoMovil`) tiene cinco pestañas: Inicio,
Explorar, Calendario, Favoritos y Ajustes, más las fichas de lugares,
municipios, fiestas y eventos. La guía web las replica en colimago.mx. La
portada (`/`) no cambia; la guía vive en rutas propias.

Sin framework ni build: HTML renderizado en el servidor (Express, plantillas
de JavaScript), CSS y JS vanilla en `public/`. El navegador nunca habla con el
backend (`backColimaApp`): todo pasa por este servidor.

## Rutas

Todas existen también bajo `/en/…` (mismo path, textos en inglés). Las páginas
de información tienen otro nombre en inglés (`RUTAS_EN` en `lib/guia/i18n.js`):
`/privacidad` ↔ `/en/privacy`, `/terminos` ↔ `/en/terms`, `/contacto` ↔
`/en/contact`. `ruta()` y `urlAbsoluta()` aceptan cualquiera de las dos formas, y
el nombre del otro idioma (`/en/privacidad`, `/privacy`) redirige con un 301.

| Ruta | Pantalla de la app | Datos |
|---|---|---|
| `/inicio` | Inicio (`MainScreen`): mapa de feria, Top 10, accesos | local + backend (Top 10) |
| `/explorar` | Explorar (feed): eventos + lugares intercalados | backend + local |
| `/calendario` | Calendario | backend |
| `/favoritos` | Favoritos | localStorage + cuenta |
| `/ajustes` | Ajustes | local |
| `/ajustes/cuenta` | Cuenta (eliminar cuenta) | cuenta |
| `/acerca-de` | Acerca de | local |
| `/privacidad` | Política de privacidad (AdSense la exige en el propio dominio) | `data/i18n/*/privacidad.json` |
| `/terminos` | Condiciones de uso | `data/i18n/*/terminos.json` |
| `/contacto` | Contacto: correo, redes y formulario (arma un correo, sin servidor) | `data/i18n/*/contacto.json` |
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

## Qué se indexa

`lib/guia/indexacion.js` decide qué páginas se ofrecen a los buscadores; las
páginas (robots y alternos) y el sitemap lo leen de ahí, para que digan lo mismo.

- **Inglés:** una página en `/en/…` solo se indexa si su texto principal está
  escrito en inglés. `/en/evento/*` queda fuera (la descripción se traduce con una
  máquina, sin revisar), igual que `/en/fiestas-del-pueblo/:id` (las fiestas solo
  tienen texto en español) y que `/en/lugar/:slug` de los 15 lugares sin
  `descripcion.en`. Esas páginas llevan `noindex, follow`, no entran al sitemap y
  su versión en español no anuncia alterna (`hreflang`). Cuando una persona
  revise las traducciones, basta con llenar el texto en inglés en los datos.
- **Eventos pasados:** `noindex` y fuera del sitemap (la página sigue existiendo).
- **Hoteles y restaurantes** del catálogo (tipos 20 y 21, datos de ejemplo):
  `noindex` y fuera del sitemap.

## Contexto propio de las fichas

El catálogo describe cada lugar o fiesta en una o dos frases, y los eventos traen el
texto de una publicación de redes. Cada ficha suma texto propio, sin inventar datos:

- `lugar` (`lugar-guia.js`): sobre el lugar, cómo llegar (distancia en línea recta al
  centro de Colima y de Manzanillo, con las coordenadas del catálogo), mejor época,
  consejos, lugares cercanos y el municipio. El texto por categoría vive en
  `data/i18n/*/lugarguia.json`.
- `evento` (`evento-guia.js`, `eventoguia.json`): cuándo y dónde, cómo llegar, qué hay
  cerca y el municipio. El texto del evento sale sin emojis (`sinEmojis` en
  `eventos-vista.js`).
- `fiesta` (`fiesta-guia.js`, `fiestaguia.json`): cuándo y dónde, qué esperar,
  consejos, lugares cercanos y el municipio.

Lo que no se sabe de un lugar en concreto (un horario, un precio, una ruta de
carretera) no se escribe: la sección lo dice o lo omite.

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
  indexacion.js    qué se indexa (inglés sin traducción, eventos pasados, ejemplos)
  sitemap.js       sitemap.xml dinámico
  paginas/*.js     una página por archivo: export function (req, ctx) → { titulo, … }
  paginas/legal-vista.js    plantilla de privacidad y condiciones (no es una página)
  paginas/{lugar,evento,fiesta}-guia.js   contexto propio de las fichas (no son páginas)
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

## Verificación

- `npm run verificar:guia` (servidor, sesión, API `/g/*`) y `npm run verificar:datos`.
- `npm run verificar:sitio`: lo que revisa AdSense y un buscador. Las páginas de
  información y sus alternos, los enlaces del pie, la portada, el sitemap, qué se
  indexa, las 300 palabras por ficha de lugar, los enlaces internos rotos y las
  claves de texto sin traducir. No necesita red (usa el backend falso).
