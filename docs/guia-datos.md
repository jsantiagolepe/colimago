# Guía web: datos locales e imágenes

Los datos de la guía salen de la app móvil (`ColimagoMovil`, solo lectura) y
los genera `scripts/importar-app-movil.js`. No se editan a mano (salvo los
textos de `data/i18n/`): se corrige en la app y se vuelve a importar.

```
node scripts/importar-app-movil.js                  # datos e imágenes
node scripts/importar-app-movil.js --solo datos     # solo data/*.json
node scripts/importar-app-movil.js --solo imagenes  # solo public/img
  --origen <ruta>   repo de la app (por defecto ~/Documents/React Native/ColimagoMovil)
  --forzar          reconvierte aunque la imagen ya exista
  --q-foto 66  --q-ilustracion 56  --presupuesto-mb 12
npm run verificar:datos                             # 25 pruebas de integridad y lógica
```

Es idempotente: el JSON solo se reescribe si cambia, una imagen vigente se
omite y un sidecar conserva su `createdAt`. El script de cada dato documenta en
su cabecera de qué archivo de la app sale. Catálogo importado:
`catalogVersion 2026-10-20T04:38:53.000Z`.

Para consultar todo desde el servidor: `lib/guia/datos.js` (carga los JSON una
vez y los congela; copia antes de ordenar). Los textos reutilizables ya están
en el espacio de nombres `datos` de `lib/guia/i18n.js`
(`t(idioma, "datos.lugar.photoBy", { autor, licencia })`).

## Conteos

| Dato | Cantidad |
|---|---|
| Lugares | 178: ríos 9, playas 15, lagunas 10, montañas 13, arqueología 4, parques 16, patrimonio 21, balnearios 11, rutas 5, hoteles 2, restaurantes 2, tianguis 54, mercados 16 |
| Por municipio (1–10) | 59, 22, 25, 22, 6, 18, 7, 12, 5, 2 |
| Municipios | 10 |
| Fiestas del pueblo | 44 (30 aproximadas, 2 con fecha en texto, 1 cruza el año) |
| Imágenes de lugar | 56 fotos (15 propias + 41 de Wikimedia), 118 ilustraciones, 4 sin archivo |
| Carteles de la feria | 12 |
| `.webp` nuevos | 419 (`l` 348, `m` 10, `feria` 42, `c` 19), 10.2 MB; `public/img` completo, 12.4 MB |

## Esquemas

**`data/lugares.json`**: arreglo ordenado por `tipo` y luego `titulo` (`localeCompare('es')`).

```
id (_id del catálogo) · slug (kebab sin acentos, único y estable) · tipo (10–18, 20, 21, 30, 31)
municipioId · titulo · subtitulo (municipio CON acentos)
descripcion { es, en | null }
imagen { clave | null, tipo "foto"|"ilustracion"|"ninguna", archivo "l/<clave>" | null,
         ancho, alto (del original), credito { autor, licencia, fuente, url } | null }
ubicacion { lat, lng, nombre, descripcion } | null          (null sin coordenadas válidas o en 0,0)
ubicacionTexto { nombre, descripcion } | null               (EXTRA, ver abajo)
servicios [claves tal cual] · horario [{ dia, horas | null, dias?: [0–6] }] · abiertoTodoElDia
horarioInventado: true                                       (solo cuando aplica)
tiktok id | null · redes { web, facebook, whatsapp, instagram, tiktok, youtube, mail, phone } (solo las no vacías)
direccion · telefono · sitioWeb · calificacion · rango       (null si no hay)
dias [0–6] | null (solo tianguis y mercados) · semanasDelMes [1–5, -1 = última] | null
temporada { desde: [mes, día], hasta: [mes, día] } | null
```

Días: `0` = domingo … `6` = sábado (`Date.getDay()`). Imagen: `public/img/<archivo>-480.webp` y
`-800.webp` (`datos.rutaImagen(lugar.imagen, 480|800)`). Si el original es más chico que el ancho
(Boca de Pascuales 550 px, Agua Fría 720 px, Laguna La María 776 px), el archivo conserva el ancho
original: nunca se amplía.

**`data/municipios.json`**: `{ id, slug, nombre, apodo {es,en}, descCorta {es,en}, descLarga {es,en},
estampa "/img/estampa-<archivo>.webp", foto "/img/m/<slug>.webp", mapa { x, y, lado } }`. Posiciones
`x, y` en 0–1 sobre el lienzo del mapa de feria; `lado` = de qué lado va la etiqueta.

**`data/mapa-feria.json`**: `{ volcan { x, y, lado }, cables [[a, b]…] (0 = volcán), costa, aspecto 0.8,
curvatura 0.12 }`. `costa` es un trazo SVG con coordenadas como fracción del ancho (x) y del alto (y);
el alto es `ancho × aspecto`. Cada cable es una curva cuadrática cuyo punto de control es el punto medio
desplazado `curvatura × largo` hacia abajo (así lo dibuja la app). `curvatura` es un campo extra.

**`data/fiestas-pueblo.json`**: `{ id, nombre, inicio {mes,dia}, fin {mes,dia} | null, fechaTexto | null,
aproximada, localidad, municipioId, descripcion {es}, fuente {nombre,url} }`. Sin `fin` dura un día;
`fin` anterior a `inicio` cruza el año. Las fiestas solo existen en español.

**`data/feria.json`**: `{ edicion {numero:169, anio:2026}, titulo, subtitulo, municipioId: 2, pitch {es,en},
portada "/img/feria/portada", temas {…}, historia {es,en}, enlaces {es,en}, carteles […], ubicacion
{ nombre, descripcion, lat, lng }, servicios […], abiertoTodoElDia: true }`.
`temas`: `bienvenida`, `reina`, `petatera`, `cabalgatas`, `recibimientos`, `mojigangos`, `despedidaPayaso`,
`enanitosToreros`, cada uno `{ titulo, texto, foto }` (+ `autor` en bienvenida y reina). `texto` separa
párrafos con `\n`. Fotos: `/img/feria/<nombre>-{480,800}.webp`.
`historia`: el párrafo "La feria" con 6 marcadores `{petatera}`, `{cabalgatas}`, `{recibimientos}`,
`{mojigangos}`, `{despedidaPayaso}`, `{enanitosToreros}`; cada uno se pinta como enlace que abre
`temas[clave]`, con el texto de `enlaces[idioma][clave]` (campo extra). `carteles`:
`{ id "cartel-MMDD", mes, dia, nombre, imagen "/img/feria/<id>" }` en orden cronológico.

**`data/i18n/{es,en}/datos.json`**: `categorias {slug: {nombre}}` (13: las 11 con miniatura, hoteles y
restaurantes), `serviciosNombre` (30 claves), `diasLargos`/`diasCortos` (domingo primero),
`mesesLargos`/`mesesCortos`, y los grupos `lugar`, `tianguis`, `fiestas`, `feria`, `municipios`,
`rincones`, `compartir`, `sugerir`, `contacto`, `generales` con las claves de `es.json`/`en.json` de la
app (mismo nombre de clave, texto copiado). Interpolación `{var}` (la app usa `{{var}}`).

## Reglas de saneo

- No se copian `date`, `finishDate`, `createdAt`, `updatedAt` (son la fecha del lote de exportación), ni
  `avatar`, `images`, `allDay`, `moreDays`, `isCover`, `isTop`, `reference`, `color`, `municipality`,
  `children`, `subType`, `status`, `kind`, `hasLocation` (poco fiable: se decide por coordenadas).
- `subtitulo`: el del catálogo viene sin acentos (`Tecoman`); se usa el nombre del municipio por id.
- `descripcion.en` vacía en el catálogo (19 lugares) → `null`; `textoDescripcion` cae al español.
- `horas`: `null` = cerrado; `"Horario por confirmar"` se conserva (la UI lo trata como sin dato).
  `miercoles`/`sabado` sin acento del catálogo original → `miércoles`/`sábado`.
- `abiertoTodoElDia` pisa al horario. Los 12 lugares originales que traen una tabla de relleno con
  `openAllDay` llevan `horarioInventado: true`: no mostrar su tabla.
- Hoteles y restaurantes (4, datos de ejemplo sin fuente): `telefono`, `calificacion` y `rango` en `null`.
- Ubicación válida = latitud y longitud finitas y distintas de 0,0. Quedan sin `ubicacion` 11 lugares: 9
  tianguis sin coordenadas y los 2 restaurantes (0,0).
- Servicios: se guardan las claves tal cual; los nombres salen de `serviciosNombre`. La app solo pinta 23;
  aquí se agregan `park`, `landscape`, `cleaning_services`, `wi-fi`, `fireplace`, `cabin_rental` y
  `local_dining`. Los textos libres de los hoteles ("Wifi gratis") no tienen nombre (`servicioNombre` → `null`).
- Feria: no se importan `schedule`, `videoTikTok` ni el nombre "Río Los Amiales" (relleno copiado de otro
  lugar). La ubicación se llama "Recinto Ferial de Villa de Álvarez", como dice su propia descripción
  (libramiento Gobernadora Griselda Álvarez). Servicios: solo los 5 que la app pinta (sin `wi-fi` ni
  `landscape`). Se corrigieron dos acentos en los carteles: "Ganaderías", "Luis Ángel".
- Categorías: "Rios" (sin acento en la app) → "Ríos".
- Sidecars: cada `.webp` lleva `<archivo>.webp.json` con su origen en la app (y autor y licencia si es de
  Wikimedia).

## Atribuciones obligatorias

41 fotos son de Wikimedia Commons con licencia que exige crédito (30 CC BY-SA 3.0, 5 CC BY 2.0, 3 CC BY-SA
4.0, 2 CC BY-SA 2.0, 1 dominio público). En la ficha del lugar hay que mostrar
`imagen.credito`: "Foto: {autor} · {licencia} · Wikimedia Commons", con enlace a `credito.url`
(`datos.textos(lang).lugar.photoBy`). Autores: Yaomautzin Ohtokani Olvera Lara (14), Thelmadatter (10),
Miboro (2), Irene Soria Guzmán (2), Comisión Mexicana de Filmaciones (2) y uno de cada: KABAYEK, Wiper México,
Presagio, Diegofotografy, Adam Jones, Totocheca, Colima (usuario de Commons), Anahí González Hernández,
Osorioct, murguia.gloria, Gibrán Gutiérrez. Las 15 fotos propias y las ilustraciones no llevan crédito.
Las CC BY-SA obligan a conservar la licencia si la foto se modifica y redistribuye (aquí solo se recomprime
y reduce).

## Problemas de datos conocidos (decide el equipo de la web)

1. **118 de 174 imágenes son ilustraciones con el sello "SIN FOTO AÚN" incrustado** (66 % del catálogo). No
   se puede quitar. `imagen.tipo === "ilustracion"` permite decidir cómo mostrarlas; la app las acompaña con
   "¿Tienes una foto de este lugar?" (`lugar.sendPhotoTitle`, enlace a Messenger con `datos.urlMessenger`).
2. **4 hoteles/restaurantes sin imagen**, de ejemplo: mismo teléfono en dos, calificaciones sin fuente,
   2 restaurantes sin coordenadas. Siguen en los datos. `direccion` y `sitioWeb` de esos 4 se conservaron y
   probablemente también son de ejemplo (`lacasadelaabuela.mx`, `mariscoscarlos.mx`): no mostrarlos sin
   confirmar. La app solo los muestra como fila título + descripción.
3. **`ubicacionTexto` (extra al esquema pedido)**: 9 tianguis no tienen coordenadas pero sí dirección en
   texto, que la tarjeta de la app muestra. Para no perderla se guarda aparte y `ubicacion` sigue en `null`.
   Usa `datos.tieneMapa(lugar)` para el mapa y `datos.textoUbicacion(lugar)` para el texto.
4. **`tiktok`** de Los Amiales y El Sauce es el mismo id que el video de la feria
   (`7348919441922510086`): probablemente no es de esos ríos. Se conservó; conviene no mostrarlo.
5. **3 lagunas** (Carrizalillo, El Naranjal, Laguna La María) traen una tabla 08:00 – 20:00 todos los días,
   idéntica a la de relleno de otros originales pero con `openAllDay: false`, así que no se marcó como
   `horarioInventado`. Confirmar si es real.
6. **Calidad de foto**: Boca de Pascuales (550×300), Agua Fría (720×720) y Laguna La María (776×516) son
   chicas para una foto a ancho completo. Grutas de San Gabriel y Museo de las Culturas de Occidente no
   muestran lo que su nombre promete (según la revisión de la app).
7. **Fechas de fiestas**: 30 de 44 son aproximadas (`aproximada`); la UI debe mostrar "Las fechas pueden
   variar…" (`fiestas.festivalDatesApprox`). Dos fiestas (Entrada del Señor de la Expiración, Carnaval de
   Manzanillo) solo tienen fecha en texto y nunca son "de hoy"; su texto en inglés (`fechasTexto`) es
   traducción propia.
8. **Tianguis de temporada**: los 2 navideños con `temporada` dicen "Todos los días" en `cuandoSePone`; usa
   `etiquetaTemporada` para mostrar "19 dic – 24 dic". Otros 3 (navideños de Comala y Parque Hidalgo, Semana
   Santa en Suchitlán) tienen `dias: []`. Los 5 solo salen en "Todos", no en el filtro por día. Varios tianguis traen datos de baja confianza (la app
   mantiene el aviso "¿Cambió algo?" en `tianguis.marketsNoteText`).
9. **Feria 2026**: los textos de bienvenida y reina son de la edición 169 y caducan cada año. Se copiaron
   tal cual, con sus erratas ("acércanos", "confia", comilla sin cerrar). Los temas (`petatera`…) solo
   existen en español; `historia.en` y `enlaces.en` son traducción propia. La ubicación de la feria
   (19.2696, −103.7566) viene del código de la app: confirmar que sea el recinto.
10. **Traducciones propias** (la app no las trae): nombres de servicios en inglés, "Cerrado", "Horario por
    confirmar", "Ver en Maps", "Temporada", apodos de municipios en inglés, `historia.en` de la feria,
    `fechasTexto` en inglés. `directions_car` no tiene nombre en la app: se usó "Auto" / "Car".
11. **Orden**: la app ordena por título con SQLite (binario); aquí se ordena en español
    (`localeCompare('es')`), como `filtrarTianguis`.
12. `_id` de 159 lugares nuevos pueden no existir en el backend: verificar con `POST /metrics/` antes de
    mostrar me gusta o vistas de lugares.
