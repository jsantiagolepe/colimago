---
version: 1
slug: "public-css-guia-css"
primary_target: "public/css/guia.css"
related_targets: []
---

# Surface brief: guía web (la contraparte web de la app Colima Go)

Scope: las rutas de la guía en colimago.mx (`/inicio`, `/explorar`, `/calendario`, `/favoritos`, `/ajustes`, `/rincones-naturales`, `/playas`, `/municipios`, `/lugar/*`, `/evento/*`, `/fiestas-del-pueblo`, `/fiestas-charrotaurinas`, `/tianguis-y-mercados`, y sus versiones `/en/*`). Visitor mode: **Operate** (revisar qué hay, guardar, comentar) con **Persuade** al final (instalar la app). La portada `/` queda intacta.
Audience: colimenses y visitantes que abren un enlace compartido en Facebook/WhatsApp y siguen navegando. Action: encontrar el lugar o evento, guardarlo, comentar, compartirlo, y al final instalar la app. Proof: los datos reales de la app (178 lugares, 44 fiestas, los diez municipios) y el feed real del backend. Constraints: Express sin framework ni build, HTML renderizado en servidor, JS vanilla; las mismas fuentes, tokens y focos de la portada; noche/día; reduced motion; contraste AA; sin datos inventados (cifras, reseñas, calificaciones).

## Direction contract

THESIS: La guía es la calle de la feria vista por dentro: la misma noche y los mismos focos de la portada, pero ahora cada puesto trabaja (feed, calendario, favoritos, fichas). Rechaza el directorio turístico genérico (buscador gigante + rejilla de tarjetas iguales) y el tablero de administración (barra lateral + tablas).

OWN-WORLD: suelo índigo-asfalto, foco azafrán solo como luz y acción, lonas azul y bandera roja como tintas de letrero, vapor como texto; Shrikhand solo para letreros y nombres pintados, Barlow Condensed para tablillas, Barlow para leer. Cada página abre con su propia guirnalda y un letrero colgado con giro leve; las listas son puestos: la foto manda y el texto va debajo, nunca encima. La barra de pestañas de la app se vuelve el cable: en móvil, una barra inferior cuyo borde superior es el cable y la pestaña activa cuelga un foco encendido; en escritorio, píldoras en la barra superior con el foco bajo la activa. Los anuncios son franjas "Publicidad" con filetes finos y espacio reservado, nunca encima del contenido.

STORY: La persona llega por un evento o lugar compartido, lo ve completo (fecha, lugar, comentarios), navega los cinco puestos, guarda favoritos sin cuenta, entra con Google para dar me gusta y comentar, y al final instala la app.

FIRST VIEWPORT: (Inicio) la noche con el cable de focos cruzando arriba y el letrero "Del mar al volcán" colgado de él; debajo, el mapa de feria a todo el ancho de la envoltura: los diez municipios como focos colgados de cables entre sí, la costa punteada y el Volcán de Fuego, con la ficha del municipio elegido al lado (medallón con anillo azafrán, nombre pintado, dos líneas, botón pintado "Ver municipio"). En móvil el mapa ocupa el ancho y la ficha va debajo. La barra (superior en escritorio, inferior en móvil) deja claros los cinco puestos.

FORM: extensión de "Night-market sign river" ya elegida para la portada (seed key 3a83cb91), trasladada al hub de la app (MapaFeria + Top 10 + tablas colgantes). Sin torneo de conceptos: el mundo y la forma están establecidos; cada página resuelve su propia composición (mapa, feed, calendario en tira de mes, tablero de playas, mes a mes de fiestas, carteles de la feria).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
