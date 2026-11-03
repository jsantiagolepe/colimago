// Panel de administración de Colima Go (módulo "colima-go" de MyProject).
//
// Es el mismo panel que antes vivía en views/dashboard.html y servía
// Express; aquí se conserva casi intacto (JS sin framework) y se monta
// dentro de la app con montarDashboard(). Lo que cambió para correr en
// Tauri:
//   - "fetch" ya no es el de window: es local a este módulo y las rutas
//     /api/* las atiende ../api/rutas.ts, que habla con el backend a
//     través de Rust (el JWT nunca llega a este código).
//   - alert/confirm/prompt se reemplazaron por modales propios (avisar,
//     confirmar, pedirCampos): WKWebView, el motor web de la app en macOS,
//     no los implementa — confirm() siempre regresaba false.
//   - Cerrar sesión, la sesión vencida y la descarga del catálogo pasan
//     por las funciones que recibe montarDashboard().
//
// Todo lo que se monta aquí se quita con la función que regresa, para
// que el panel no deje estilos ni listeners al salir de él.

import marcado from './dashboard-markup.html?raw';
import estilosCss from './dashboard.css?inline';

/**
 * @param {HTMLElement} raiz
 * @param {import('./dashboard').OpcionesDashboard} opciones
 * @returns {() => void} función para desmontar el panel
 */
export function montarDashboard(raiz, opciones) {
  const { usuario, cerrarSesion, volverAlInicio, alExpirarSesion, guardarArchivo } = opciones;

  // Los estilos del panel son globales (body, inputs, .modal-overlay…), así
  // que solo existen mientras el panel está montado.
  const estilos = document.createElement('style');
  estilos.dataset.modulo = 'colima-go';
  estilos.textContent = estilosCss;
  document.head.appendChild(estilos);
  raiz.innerHTML = marcado;

  // Si la respuesta es 401 (sesión vencida o nunca iniciada), regresa al
  // login en vez de dejar la pantalla mostrando errores confusos. Esto
  // cubre TODAS las llamadas fetch del panel sin tener que tocar cada una:
  // "fetch" es local a este módulo (las rutas /api/* las atiende
  // ../api/rutas.ts, ya no un servidor). Cuando el 401 viene del backend
  // de ColimaApp (token inválido o expirado; rutas.ts lo marca con
  // "backendStatus"), el login muestra el mensaje que mandó para que se
  // entienda por qué hay que volver a entrar. Los 403 (no eres
  // administrador) y 429 (rate limit) NO se interceptan aquí: llegan con su
  // "message" en data.error y cada acción lo muestra con respuestaOk() o
  // con su propio manejo de errores.
  const fetch = async (...args) => {
    const res = await opciones.fetch(...args);
    if (res.status === 401) {
      let mensaje;
      try {
        const data = await res.clone().json();
        if (data && data.backendStatus && data.error) mensaje = data.error;
      } catch (err) { /* sin cuerpo JSON: solo regresa al login */ }
      alExpirarSesion(mensaje);
    }
    return res;
  };

  // WKWebView no implementa alert(), confirm() ni prompt() (dentro de la
  // app no muestran nada: confirm() regresa false y prompt() null), así
  // que estos tres los reemplazan con los modales del propio panel. Cada
  // uno regresa una promesa que se resuelve al cerrarse; Escape o un clic
  // en el fondo cuentan como "Cancelar".
  function abrirDialogo(htmlCaja, alCerrar) {
    const overlay = crearModal(htmlCaja);
    const quitarModal = overlay.remove; // la versión de crearModal, que devuelve el foco
    let cerrado = false;
    const cerrar = (valor) => {
      if (cerrado) return;
      cerrado = true;
      quitarModal();
      alCerrar(valor);
    };
    overlay.remove = () => cerrar(undefined);
    return { overlay, cerrar };
  }

  function avisar(mensaje) {
    return new Promise((resolver) => {
      const { overlay, cerrar } = abrirDialogo(`
        <div class="modal-box">
          <p class="texto-dialogo">${escapeHtml(mensaje)}</p>
          <div class="acciones-modal">
            <button type="button" class="btn-agregar-directorio" data-dialogo="aceptar">Entendido</button>
          </div>
        </div>
      `, () => resolver());
      overlay.firstElementChild.setAttribute('role', 'alertdialog');
      overlay.firstElementChild.setAttribute('aria-label', mensaje);
      const aceptar = overlay.querySelector('[data-dialogo="aceptar"]');
      aceptar.addEventListener('click', () => cerrar());
      aceptar.focus();
    });
  }

  function confirmar(mensaje, { textoAceptar = 'Continuar', peligro = false } = {}) {
    return new Promise((resolver) => {
      const { overlay, cerrar } = abrirDialogo(`
        <div class="modal-box">
          <p class="texto-dialogo">${escapeHtml(mensaje)}</p>
          <div class="acciones-modal">
            <button type="button" class="btn-terciario" data-dialogo="cancelar">Cancelar</button>
            <button type="button" class="${peligro ? 'btn-peligro' : 'btn-agregar-directorio'}" data-dialogo="aceptar">${escapeHtml(textoAceptar)}</button>
          </div>
        </div>
      `, (valor) => resolver(valor === true));
      overlay.firstElementChild.setAttribute('role', 'alertdialog');
      overlay.firstElementChild.setAttribute('aria-label', mensaje);
      overlay.querySelector('[data-dialogo="cancelar"]').addEventListener('click', () => cerrar(false));
      overlay.querySelector('[data-dialogo="aceptar"]').addEventListener('click', () => cerrar(true));
      // Como confirm(): el foco empieza en la opción segura.
      overlay.querySelector('[data-dialogo="cancelar"]').focus();
    });
  }

  // Un formulario chico en lugar de varios prompt() seguidos. Cada campo
  // trae su valor actual: guardar sin tocarlo lo deja igual. Regresa
  // { nombre: valor } o null si se canceló.
  function pedirCampos(titulo, campos) {
    return new Promise((resolver) => {
      const { overlay, cerrar } = abrirDialogo(`
        <div class="modal-box">
          <h3>${escapeHtml(titulo)}</h3>
          <form class="form-dialogo" novalidate>
            ${campos.map((campo, i) => `
              <div class="campo-fecha">
                <label for="dialogo-campo-${i}">${escapeHtml(campo.etiqueta)}</label>
                <input type="text" id="dialogo-campo-${i}" ${campo.inputmode ? `inputmode="${campo.inputmode}"` : ''} value="${escapeHtml(campo.valor ?? '')}" />
              </div>
            `).join('')}
            <div class="acciones-modal">
              <button type="button" class="btn-terciario" data-dialogo="cancelar">Cancelar</button>
              <button type="submit" class="btn-agregar-directorio">Guardar</button>
            </div>
          </form>
        </div>
      `, (valores) => resolver(valores ?? null));
      overlay.querySelector('[data-dialogo="cancelar"]').addEventListener('click', () => cerrar(null));
      overlay.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const valores = {};
        campos.forEach((campo, i) => {
          valores[campo.nombre] = overlay.querySelector(`#dialogo-campo-${i}`).value;
        });
        cerrar(valores);
      });
    });
  }

  // Para las acciones que no necesitan leer la respuesta (pausar, borrar,
  // aprobar…): si el servidor respondió error (403 no administrador, 429
  // rate limit, 400 del backend, etc.) muestra el mensaje y regresa false,
  // para que la acción no siga como si hubiera funcionado.
  async function respuestaOk(res, mensajeGenerico = 'Ocurrió un error, intenta de nuevo.') {
    if (res.ok) return true;
    let data = {};
    try { data = await res.json(); } catch (err) { /* sin JSON */ }
    avisar(data.error || mensajeGenerico);
    return false;
  }

  // Todo lo que viene de Facebook o de la base (textos, títulos, URLs) pasa
  // por aquí antes de meterse en innerHTML: un "<" en un post no debe
  // romper la tarjeta ni inyectar HTML.
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Íconos en línea, misma familia de trazo (Feather) que la barra lateral.
  const svgIcono = (trazos) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazos}</svg>`;
  const ICONOS = {
    calendario: svgIcono('<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>'),
    idioma: svgIcono('<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>'),
    pin: svgIcono('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>'),
    alerta: svgIcono('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'),
    descarga: svgIcono('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>'),
    mas: svgIcono('<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>'),
    cerrar: svgIcono('<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'),
    externo: svgIcono('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>'),
    anterior: svgIcono('<polyline points="15 18 9 12 15 6"></polyline>'),
    siguiente: svgIcono('<polyline points="9 18 15 12 9 6"></polyline>'),
  };

  // Saca nombre y coordenadas de un link largo de Google Maps, p. ej.
  // .../maps/place/Jard%C3%ADn+principal/@19.28,-103.73,1355m/data=...!3d19.2867942!4d-103.7342375...
  // Prefiere !3d/!4d (el pin del lugar) sobre @lat,lng (el centro del mapa,
  // que se mueve si arrastraste la vista). Regresa null si no trae nada útil.
  function extraerDatosDeLinkMaps(texto) {
    let url;
    try { url = new URL(texto); } catch { return null; }
    if (!/(^|\.)google\.[a-z.]+$/.test(url.hostname) || !url.pathname.includes('/maps')) return null;

    const decodificar = (t) => { try { return decodeURIComponent(t); } catch { return t; } };
    const completo = decodificar(url.pathname);
    const lugar = url.pathname.match(/\/place\/([^/]+)/);
    const nombre = lugar ? decodificar(lugar[1].replace(/\+/g, ' ')).trim() : '';

    const pin = completo.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    const vista = completo.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const q = (url.searchParams.get('q') || url.searchParams.get('query') || '').match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    const coords = pin || vista || q;

    // Un "nombre" que en realidad son coordenadas (link de un pin suelto) no sirve como nombre.
    const nombreUtil = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(nombre) ? '' : nombre;
    if (!nombreUtil && !coords) return null;
    return { nombre: nombreUtil, lat: coords ? coords[1] : '', lng: coords ? coords[2] : '' };
  }

  // Crea un modal accesible: role="dialog", cierra con Escape o clic en el
  // fondo, enfoca el primer campo y devuelve el foco a donde estaba al
  // cerrarse (sin importar cuál de los botones lo cerró).
  function crearModal(htmlCaja) {
    const focoPrevio = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = htmlCaja;
    const caja = overlay.firstElementChild;
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-modal', 'true');
    const titulo = caja.querySelector('h3');
    if (titulo) {
      titulo.id = `modal-titulo-${Date.now()}`;
      caja.setAttribute('aria-labelledby', titulo.id);
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    const removerOriginal = overlay.remove.bind(overlay);
    overlay.remove = () => {
      removerOriginal();
      if (focoPrevio && document.contains(focoPrevio)) focoPrevio.focus();
    };
    document.body.appendChild(overlay);
    // Enfoca el primer campo de texto; si no hay, el propio diálogo (para no
    // pintar el anillo de foco sobre una opción como si ya estuviera elegida).
    const primerCampo = caja.querySelector('input:not([type="checkbox"]), select, textarea');
    caja.tabIndex = -1;
    (primerCampo || caja).focus();
    return overlay;
  }

  function alPresionarEscape(e) {
    if (e.key !== 'Escape') return;
    const abiertos = document.querySelectorAll('.modal-overlay');
    if (abiertos.length) abiertos[abiertos.length - 1].remove();
  }
  document.addEventListener('keydown', alPresionarEscape);

  const lista = document.getElementById('lista');
  let estatusActual = 'pendiente';
  let eventosPendientes = []; // cola para el modo tarjeta grande
  let descripcionIngles = ''; // texto de "descriptionEnglish" — se resetea con cada tarjeta
  let subtituloSeleccionado = ''; // nombre del lugar elegido como "subtitle" — se resetea con cada tarjeta
  let subtituloDespues = false; // true = aprobar sin lugar (no se manda "subtitle"; el backend guarda '') — se resetea con cada tarjeta
  let lugaresDisponibles = []; // lista de lugares para el select de subtítulo

  // --- Ajusta estas listas libremente si no coinciden con tu app ---

  const MUNICIPIOS = {
    1: 'Colima',
    2: 'Villa de Álvarez',
    3: 'Manzanillo',
    4: 'Comala',
    5: 'Minatitlán',
    6: 'Tecomán',
    7: 'Armería',
    8: 'Coquimatlán',
    9: 'Cuauhtémoc',
    10: 'Ixtlahuacán',
  };

  const TIPOS_EVENTO = {
    1012: 'Deportivo',
    1013: 'Social',
    1014: 'Musical',
    1015: 'Cultural',
    1016: 'Ganadero',
    1017: 'Religioso',
    1018: 'Gastronómico',
    1019: 'Otro',
  };

  // Categorías de posts locales (contrato §5). 10-13 ya existen en la app;
  // 20-21 son hoteles/restaurantes; 14, 30 y 31 son las más nuevas (zonas
  // arqueológicas, tianguis y mercados). Cada una es una tarjeta en la
  // sección; una categoría que llegue del backend y no esté aquí también
  // sale, como "Categoría N", para que ningún post quede escondido.
  const CATEGORIAS_LOCAL = {
    10: 'Ríos',
    11: 'Playas',
    12: 'Lagos',
    13: 'Montañas',
    14: 'Zonas arqueológicas',
    20: 'Hoteles',
    21: 'Restaurantes',
    30: 'Tianguis',
    31: 'Mercados',
  };

  const ICONOS_CATEGORIA_LOCAL = {
    10: svgIcono('<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path>'),
    11: svgIcono('<path d="M22 12a10.06 10.06 1 0 0-20 0Z"></path><path d="M12 12v8a2 2 0 0 0 4 0"></path><path d="M12 2v1"></path>'),
    12: svgIcono('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>'),
    13: svgIcono('<path d="m8 3 4 8 5-5 5 15H2L8 3z"></path>'),
    14: svgIcono('<polyline points="2 21 2 17 6 17 6 13 9 13 9 9 15 9 15 13 18 13 18 17 22 17 22 21 2 21"></polyline>'),
    20: svgIcono('<path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8v9"></path>'),
    21: svgIcono('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>'),
    30: svgIcono('<path d="M19 20 10 4"></path><path d="m5 20 9-16"></path><path d="M3 20h18"></path><path d="m12 15-3 5"></path><path d="m12 15 3 5"></path>'),
    31: svgIcono('<path d="M3 9l2-5h14l2 5"></path><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"></path><path d="M5 12v8h14v-8"></path>'),
  };
  const iconoCategoriaLocal = (tipo) => ICONOS_CATEGORIA_LOCAL[tipo] || ICONOS.pin;
  const nombreCategoriaLocal = (tipo) => CATEGORIAS_LOCAL[tipo] || `Categoría ${tipo}`;

  // Claves de "services" que ya usa la app (contrato §4).
  const SERVICIOS_LOCAL = {
    restaurant: 'Restaurante',
    bathroom: 'Baños',
    'wi-fi': 'Wi-Fi',
    pool: 'Alberca',
    local_parking: 'Estacionamiento',
    picnic_area: 'Área de picnic',
    landscape: 'Paisaje',
    tour_guide: 'Guía turístico',
    food_drink: 'Alimentos y bebidas',
  };

  document.querySelector('.sidebar-nav').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.removeAttribute('aria-current');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-current', 'page');
    estatusActual = tab.dataset.estatus;
    if (estatusActual === 'locales') reiniciarVistaLocales();
    document.getElementById('titulo-pagina').textContent = tab.dataset.titulo;
    cargarEventos();
  });

  document.getElementById('btn-logout').addEventListener('click', () => cerrarSesion());
  document.getElementById('btn-inicio').addEventListener('click', () => volverAlInicio());

  // La app ya validó la sesión antes de montar el panel (antes era /auth/me).
  {
    const nombre = usuario.nombre || 'Administrador';
    document.getElementById('bienvenida').textContent = `Bienvenido, ${nombre}`;
    document.getElementById('avatar-inicial').textContent = nombre.charAt(0).toUpperCase();
  }

  // Una fecha sin hora ("2026-10-10", o medianoche UTC como la guarda Mongo
  // para eventos de todo el día) es un día de calendario, no un instante:
  // se formatea en UTC para que en México no se muestre el día anterior.
  function formatearFecha(fechaStr) {
    if (!fechaStr) return 'Sin fecha';
    const f = new Date(fechaStr);
    if (Number.isNaN(f.getTime())) return 'Sin fecha';
    const esDiaCalendario = /^\d{4}-\d{2}-\d{2}(T00:00(:00(\.000)?)?Z)?$/.test(String(fechaStr));
    return f.toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
      ...(esDiaCalendario ? { timeZone: 'UTC' } : {}),
    });
  }

  const SECCIONES_TABLA = ['directorio', 'lugares', 'locales', 'posts-admin'];

  async function cargarEventos() {
    lista.classList.toggle('content-ancho', SECCIONES_TABLA.includes(estatusActual));
    lista.classList.toggle('content-pendientes', estatusActual === 'pendiente');
    lista.innerHTML = '<div class="estado-vacio">Cargando…</div>';
    try {
      if (estatusActual === 'directorio') {
        await cargarDirectorio();
        return;
      }
      if (estatusActual === 'lugares') {
        await cargarLugares();
        return;
      }
      if (estatusActual === 'locales') {
        await cargarLocales();
        return;
      }
      if (estatusActual === 'posts-admin') {
        await cargarPostsAdmin();
        return;
      }
      if (['activo', 'pausado', 'papelera'].includes(estatusActual)) {
        await cargarPosts();
        return;
      }
      const res = await fetch(`/api/pendientes?estatus=${estatusActual}`);
      const eventos = await res.json();

      if (estatusActual === 'pendiente') {
        eventosPendientes = eventos;
        try {
          const resLugares = await fetch('/api/lugares');
          lugaresDisponibles = await resLugares.json();
        } catch (err) {
          lugaresDisponibles = [];
        }
        renderTarjetaGrande();
      } else {
        renderListaCompacta(eventos);
      }
    } catch (err) {
      lista.innerHTML = '<div class="estado-vacio">No se pudo conectar con el backend. Revisa tu conexión a internet e inténtalo de nuevo.</div>';
    }
  }

  // ---------- Modo "Producción": Activos / Pausados / Papelera ----------

  async function cargarPosts() {
    try {
      const res = await fetch(`/api/posts?estatus=${estatusActual}`);
      const posts = await res.json();
      renderPosts(posts);
    } catch (err) {
      lista.innerHTML = '<div class="estado-vacio">No se pudo cargar la lista de producción.</div>';
    }
  }

  // Texto de "vacío" por sección, en lenguaje del panel y no con la clave interna.
  const MENSAJES_VACIO = {
    aprobado: 'No hay eventos aprobados por ahora.',
    rechazado: 'No hay eventos rechazados por ahora.',
    activo: 'No hay eventos activos en producción.',
    pausado: 'No hay eventos pausados.',
    papelera: 'La papelera está vacía.',
  };
  const htmlVacio = () => `<div class="estado-vacio">${MENSAJES_VACIO[estatusActual] || 'No hay nada aquí por ahora.'}</div>`;

  // Quita una tarjeta de la lista y, si era la última, muestra el estado vacío.
  function quitarTarjeta(card) {
    card.remove();
    if (!lista.children.length) lista.innerHTML = htmlVacio();
  }

  function renderPosts(posts) {
    if (!posts.length) {
      lista.innerHTML = htmlVacio();
      return;
    }
    lista.innerHTML = '';
    posts.forEach(p => lista.appendChild(crearTarjetaPost(p)));
  }

  function crearTarjetaPost(p) {
    const card = document.createElement('div');
    card.className = 'card';

    const primeraImagen = Array.isArray(p.images) ? p.images.find(Boolean) : null;
    const imagenHtml = primeraImagen
      ? `<img src="${escapeHtml(primeraImagen)}" alt="" loading="lazy" />`
      : `<div class="sin-imagen-chica">Sin imagen</div>`;

    const nombreMunicipio = MUNICIPIOS[p.municipality] || 'Sin municipio';
    const inicio = formatearFecha(p.date);
    const fin = p.moreDays && p.finishDate ? ` – ${formatearFecha(p.finishDate)}` : '';

    let botonesHtml = '';
    if (estatusActual === 'activo') {
      botonesHtml = `<button class="btn-deshacer" data-accion="pausar">Pausar</button>
                      <button class="btn-deshacer" data-accion="papelera">Mover a papelera</button>`;
    } else if (estatusActual === 'pausado') {
      botonesHtml = `<button class="btn-deshacer" data-accion="activar">Reactivar</button>
                      <button class="btn-deshacer" data-accion="papelera">Mover a papelera</button>`;
    } else {
      botonesHtml = `<button class="btn-deshacer" data-accion="restaurar">Restaurar</button>
                      <button class="btn-deshacer peligro" data-accion="eliminar">Eliminar definitivo</button>`;
    }

    card.innerHTML = `
      ${imagenHtml}
      <div class="card-body">
        <div class="meta">
          <span class="badge">${nombreMunicipio}</span>
          ${p.status ? '' : '<span class="estado-pausado">Pausado</span>'}
        </div>
        <div class="fecha-evento">${ICONOS.calendario} ${inicio}${fin}</div>
        <p class="texto-chico titulo-card">${escapeHtml(p.title || 'Sin título')}</p>
        <p class="texto-chico">${escapeHtml((p.description || '').trim())}</p>
        <div class="acciones-card">${botonesHtml}</div>
      </div>
    `;

    const TEXTO_CARGA = { pausar: 'Pausando…', papelera: 'Moviendo…', activar: 'Reactivando…', restaurar: 'Restaurando…', eliminar: 'Eliminando…' };
    card.querySelectorAll('button[data-accion]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const accion = btn.dataset.accion;
        if (accion === 'eliminar' && !(await confirmar('Esto borra el post de forma permanente y no se puede deshacer. ¿Continuar?', { textoAceptar: 'Eliminar definitivo', peligro: true }))) return;
        // Mientras responde el backend, ningún botón de esta tarjeta se puede volver a pulsar.
        const botones = card.querySelectorAll('button[data-accion]');
        const textoOriginal = btn.textContent;
        botones.forEach(b => { b.disabled = true; });
        btn.textContent = TEXTO_CARGA[accion] || 'Guardando…';
        const restaurar = () => {
          botones.forEach(b => { b.disabled = false; });
          btn.textContent = textoOriginal;
        };
        try {
          const res = accion === 'eliminar'
            ? await fetch(`/api/posts/${p._id}`, { method: 'DELETE' })
            : await fetch(`/api/posts/${p._id}/${accion}`, { method: 'POST' });
          if (!(await respuestaOk(res))) { restaurar(); return; }
          quitarTarjeta(card);
        } catch (err) {
          avisar('Ocurrió un error, intenta de nuevo.');
          restaurar();
        }
      });
    });

    return card;
  }

  // ---------- Modo "Directorio": municipios por ID de página de Facebook ----------

  async function cargarDirectorio() {
    try {
      const res = await fetch('/api/directorio');
      const registros = await res.json();
      renderDirectorio(registros);
    } catch (err) {
      lista.innerHTML = '<div class="estado-vacio">No se pudo cargar el directorio.</div>';
    }
  }

  function renderDirectorio(registros) {
    const filasHtml = registros.length
      ? registros.map(r => `
          <tr data-id="${escapeHtml(r._id)}">
            <td>${escapeHtml(r.municipio_nombre || '—')}</td>
            <td>${r.facebook_url ? `<a href="${escapeHtml(r.facebook_url)}" target="_blank" rel="noopener">${escapeHtml(r.facebook_url)}</a>` : '—'}</td>
            <td class="tnum">${escapeHtml(r.facebook_id)}</td>
            <td>
              <div class="acciones-fila">
                <button class="btn-editar-fila" data-accion="editar">Editar</button>
                <button class="btn-borrar-fila" data-accion="borrar">Borrar</button>
              </div>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="4" class="vacio">Sin registros todavía. Agrega la primera página arriba.</td></tr>`;

    lista.innerHTML = `
      <div class="form-directorio">
        <div class="campo">
          <label for="dir-municipio">Municipio</label>
          <select id="dir-municipio">
            <option value="">Sin municipio (ej. página estatal)</option>
            ${Object.entries(MUNICIPIOS).map(([id, nombre]) => `<option value="${id}">${nombre}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label for="dir-url">URL de Facebook</label>
          <input type="url" name="facebook_url" id="dir-url" placeholder="https://www.facebook.com/..." />
        </div>
        <div class="campo">
          <label for="dir-id">ID de Facebook <span class="req">*</span></label>
          <input type="text" inputmode="numeric" name="facebook_id" id="dir-id" placeholder="141016469255329" />
        </div>
        <button class="btn-agregar-directorio" id="btn-agregar-dir">Agregar</button>
      </div>
      <div class="tabla-wrap">
        <table class="tabla-directorio">
          <thead>
            <tr><th>Municipio</th><th>URL</th><th>ID de Facebook</th><th><span class="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody id="tbody-directorio">${filasHtml}</tbody>
        </table>
      </div>
    `;

    document.getElementById('btn-agregar-dir').addEventListener('click', async () => {
      const municipioSelect = document.getElementById('dir-municipio');
      const urlInput = document.getElementById('dir-url');
      const idInput = document.getElementById('dir-id');

      if (!idInput.value.trim()) {
        await avisar('Ingresa el ID de Facebook.');
        idInput.focus();
        return;
      }
      const btnAgregar = document.getElementById('btn-agregar-dir');
      btnAgregar.disabled = true;
      btnAgregar.textContent = 'Agregando…';

      const body = {
        municipio_id: municipioSelect.value,
        municipio_nombre: municipioSelect.value ? MUNICIPIOS[municipioSelect.value] : 'Sin municipio',
        facebook_url: urlInput.value.trim(),
        facebook_id: idInput.value.trim(),
      };

      try {
        const res = await fetch('/api/directorio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          avisar(data.error || 'No se pudo agregar.');
          btnAgregar.disabled = false;
          btnAgregar.textContent = 'Agregar';
          return;
        }
        cargarDirectorio();
      } catch (err) {
        avisar('Ocurrió un error, intenta de nuevo.');
        btnAgregar.disabled = false;
        btnAgregar.textContent = 'Agregar';
      }
    });

    document.querySelectorAll('#tbody-directorio tr[data-id]').forEach((fila, i) => {
      const id = fila.dataset.id;
      const registro = registros[i];
      fila.querySelector('[data-accion="borrar"]')?.addEventListener('click', async () => {
        if (!(await confirmar('¿Borrar este registro del directorio?', { textoAceptar: 'Borrar', peligro: true }))) return;
        const res = await fetch(`/api/directorio/${id}`, { method: 'DELETE' });
        if (!(await respuestaOk(res))) return;
        cargarDirectorio();
      });
      fila.querySelector('[data-accion="editar"]')?.addEventListener('click', async () => {
        // Cada campo ya trae el valor actual: guardar sin tocarlo lo deja igual
        // (antes venían vacíos y dar Enter borraba el dato).
        const valores = await pedirCampos('Editar página', [
          { nombre: 'facebook_id', etiqueta: 'ID de Facebook', valor: registro.facebook_id, inputmode: 'numeric' },
          { nombre: 'facebook_url', etiqueta: 'URL de Facebook', valor: registro.facebook_url },
        ]);
        if (valores === null) return;
        const res = await fetch(`/api/directorio/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ facebook_id: valores.facebook_id, facebook_url: valores.facebook_url }),
        });
        if (!(await respuestaOk(res))) return;
        cargarDirectorio();
      });
    });
  }

  // ---------- Modo "Lugares": lugares para el subtítulo de los eventos ----------

  async function cargarLugares() {
    try {
      const res = await fetch('/api/lugares');
      const registros = await res.json();
      renderLugares(registros);
    } catch (err) {
      lista.innerHTML = '<div class="estado-vacio">No se pudo cargar la lista de lugares.</div>';
    }
  }

  function renderLugares(registros) {
    const filasHtml = registros.length
      ? registros.map(r => `
          <tr data-id="${escapeHtml(r._id)}">
            <td>${escapeHtml(r.nombre || '—')}</td>
            <td>${escapeHtml(r.municipio_nombre || '—')}</td>
            <td class="tnum">${escapeHtml(r.latitud ?? '—')}</td>
            <td class="tnum">${escapeHtml(r.longitud ?? '—')}</td>
            <td>${escapeHtml(r.nota || '—')}</td>
            <td>
              <div class="acciones-fila">
                <button class="btn-editar-fila" data-accion="editar">Editar</button>
                <button class="btn-borrar-fila" data-accion="borrar">Borrar</button>
              </div>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="6" class="vacio">Sin lugares todavía. Agrega el primero arriba.</td></tr>`;

    lista.innerHTML = `
      <div class="form-directorio">
        <div class="campo">
          <label for="lug-nombre">Nombre <span class="req">*</span></label>
          <input type="text" name="nombre" id="lug-nombre" placeholder="Jardín Libertad" />
        </div>
        <div class="campo">
          <label for="lug-municipio">Municipio</label>
          <select id="lug-municipio">
            <option value="">Selecciona…</option>
            ${Object.entries(MUNICIPIOS).map(([id, nombre]) => `<option value="${id}">${nombre}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label for="lug-lat">Latitud</label>
          <input type="text" inputmode="decimal" name="latitud" id="lug-lat" placeholder="19.2433" />
        </div>
        <div class="campo">
          <label for="lug-lng">Longitud</label>
          <input type="text" inputmode="decimal" name="longitud" id="lug-lng" placeholder="-103.7247" />
        </div>
        <div class="campo">
          <label for="lug-nota">Nota (opcional)</label>
          <input type="text" name="nota" id="lug-nota" placeholder="Referencia u otro dato" />
        </div>
        <button class="btn-agregar-directorio" id="btn-agregar-lugar">Agregar</button>
      </div>
      <div class="tabla-wrap">
        <table class="tabla-directorio">
          <thead>
            <tr><th>Nombre</th><th>Municipio</th><th>Latitud</th><th>Longitud</th><th>Nota</th><th><span class="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody id="tbody-lugares">${filasHtml}</tbody>
        </table>
      </div>
    `;

    document.getElementById('btn-agregar-lugar').addEventListener('click', async () => {
      const nombreInput = document.getElementById('lug-nombre');
      const municipioSelect = document.getElementById('lug-municipio');
      const latInput = document.getElementById('lug-lat');
      const lngInput = document.getElementById('lug-lng');
      const notaInput = document.getElementById('lug-nota');

      if (!nombreInput.value.trim()) {
        await avisar('Ingresa el nombre del lugar.');
        nombreInput.focus();
        return;
      }
      const btnAgregar = document.getElementById('btn-agregar-lugar');
      btnAgregar.disabled = true;
      btnAgregar.textContent = 'Agregando…';

      const body = {
        nombre: nombreInput.value.trim(),
        municipio_id: municipioSelect.value,
        municipio_nombre: municipioSelect.value ? MUNICIPIOS[municipioSelect.value] : '',
        latitud: latInput.value.trim(),
        longitud: lngInput.value.trim(),
        nota: notaInput.value.trim(),
      };

      try {
        const res = await fetch('/api/lugares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          avisar(data.error || 'No se pudo agregar.');
          btnAgregar.disabled = false;
          btnAgregar.textContent = 'Agregar';
          return;
        }
        cargarLugares();
      } catch (err) {
        avisar('Ocurrió un error, intenta de nuevo.');
        btnAgregar.disabled = false;
        btnAgregar.textContent = 'Agregar';
      }
    });

    document.querySelectorAll('#tbody-lugares tr[data-id]').forEach((fila, i) => {
      const id = fila.dataset.id;
      const registro = registros[i];
      fila.querySelector('[data-accion="borrar"]')?.addEventListener('click', async () => {
        if (!(await confirmar('¿Borrar este lugar?', { textoAceptar: 'Borrar', peligro: true }))) return;
        const res = await fetch(`/api/lugares/${id}`, { method: 'DELETE' });
        if (!(await respuestaOk(res))) return;
        cargarLugares();
      });
      fila.querySelector('[data-accion="editar"]')?.addEventListener('click', async () => {
        // Igual que en el directorio: cada campo viene con el valor actual.
        const valores = await pedirCampos('Editar lugar', [
          { nombre: 'nombre', etiqueta: 'Nombre', valor: registro.nombre },
          { nombre: 'latitud', etiqueta: 'Latitud', valor: registro.latitud, inputmode: 'decimal' },
          { nombre: 'longitud', etiqueta: 'Longitud', valor: registro.longitud, inputmode: 'decimal' },
          { nombre: 'nota', etiqueta: 'Nota', valor: registro.nota },
        ]);
        if (valores === null) return;
        const res = await fetch(`/api/lugares/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: valores.nombre,
            latitud: valores.latitud,
            longitud: valores.longitud,
            nota: valores.nota,
          }),
        });
        if (!(await respuestaOk(res))) return;
        cargarLugares();
      });
    });
  }

  // ---------- Modo "Posts locales": lugares fijos (ríos, playas, hoteles, restaurantes) ----------
  // Ver docs/local-catalog-contract.md en el repo de la app: es la única
  // fuente de verdad de los campos, códigos y ciclo de vida de esta sección.

  // La sección tiene tres pantallas, todas armadas con el catálogo completo
  // (una sola petición): las tarjetas de categoría, la lista de una
  // categoría con la foto de cada post, y el detalle de un post, que es
  // donde están Editar, Dar de baja y Reactivar.
  let localesTodos = [];
  let filtroLocalMunicipio = '';
  let vistaLocalTipo = null; // categoría abierta; null = pantalla de tarjetas
  let vistaLocalId = null; // post abierto; null = lista de la categoría

  function reiniciarVistaLocales() {
    vistaLocalTipo = null;
    vistaLocalId = null;
    filtroLocalMunicipio = '';
  }

  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  async function cargarLocales() {
    try {
      const res = await fetch('/api/locales');
      const data = await res.json();
      // Si en lo que llegaba la respuesta se cambió de sección, no pisar la otra.
      if (estatusActual !== 'locales') return;
      if (!res.ok) {
        lista.innerHTML = `<div class="estado-vacio">${escapeHtml(data.error || 'No se pudo cargar el catálogo local.')}</div>`;
        return;
      }
      localesTodos = data;
      renderLocales();
    } catch (err) {
      lista.innerHTML = '<div class="estado-vacio">No se pudo conectar con el servidor.</div>';
    }
  }

  function renderLocales() {
    if (vistaLocalId) {
      const loc = localesTodos.find(l => l._id === vistaLocalId);
      if (loc) return renderDetalleLocal(loc);
      vistaLocalId = null;
    }
    if (vistaLocalTipo !== null) return renderCategoriaLocal(vistaLocalTipo);
    renderCategoriasLocales();
  }

  // La foto del post es la primera de "images" (URLs), si el backend la
  // trae. Sin foto, o si falla al cargar, se queda el ícono de la categoría.
  function htmlFotoLocal(loc, clase) {
    const url = Array.isArray(loc.images) ? loc.images.find(u => typeof u === 'string' && u) : null;
    return `<span class="${clase}">${iconoCategoriaLocal(loc.type)}${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" />` : ''}</span>`;
  }

  function quitarFotosRotas() {
    lista.querySelectorAll('.foto-local img, .foto-local-grande img').forEach(img => {
      img.addEventListener('error', () => img.remove(), { once: true });
    });
  }

  const badgeEstatusLocal = (loc) => loc.status ? '<span class="badge-activo">Activo</span>' : '<span class="badge-inactivo">Inactivo</span>';

  // ----- Pantalla 1: una tarjeta por categoría -----

  function renderCategoriasLocales() {
    const cuenta = {};
    localesTodos.forEach(loc => {
      if (!cuenta[loc.type]) cuenta[loc.type] = { activos: 0, bajas: 0 };
      if (loc.status) cuenta[loc.type].activos++; else cuenta[loc.type].bajas++;
    });
    const tipos = [
      ...Object.keys(CATEGORIAS_LOCAL),
      ...Object.keys(cuenta).filter(tipo => !(tipo in CATEGORIAS_LOCAL)),
    ];

    const tarjetasHtml = tipos.map(tipo => {
      const { activos, bajas } = cuenta[tipo] || { activos: 0, bajas: 0 };
      const detalle = activos + bajas === 0
        ? 'Sin posts'
        : `${plural(activos, 'activo', 'activos')}${bajas ? ` · ${bajas} de baja` : ''}`;
      return `
        <button type="button" class="tarjeta-categoria" data-tipo="${escapeHtml(tipo)}">
          <span class="tarjeta-categoria-icono">${iconoCategoriaLocal(tipo)}</span>
          <span class="tarjeta-categoria-nombre">${escapeHtml(nombreCategoriaLocal(tipo))}</span>
          <span class="tarjeta-categoria-cuenta">${detalle}</span>
        </button>
      `;
    }).join('');

    lista.innerHTML = `
      <div class="barra-locales">
        <p class="resumen-locales">${plural(localesTodos.length, 'post local', 'posts locales')} en ${plural(tipos.length, 'categoría', 'categorías')}</p>
        <div class="acciones">
          <button class="btn-secundario" id="btn-exportar-catalogo">${ICONOS.descarga}<span>Exportar catálogo para la app</span></button>
          <button class="btn-agregar-directorio" id="btn-agregar-local">${ICONOS.mas}<span>Agregar post local</span></button>
        </div>
      </div>
      <div class="grid-categorias">${tarjetasHtml}</div>
    `;

    document.getElementById('btn-agregar-local').addEventListener('click', () => abrirModalLocal(null));
    document.getElementById('btn-exportar-catalogo').addEventListener('click', exportarCatalogoLocal);
    lista.querySelectorAll('.tarjeta-categoria').forEach(tarjeta => {
      tarjeta.addEventListener('click', () => {
        vistaLocalTipo = tarjeta.dataset.tipo;
        filtroLocalMunicipio = '';
        renderLocales();
      });
    });
  }

  // ----- Pantalla 2: los posts de una categoría, con su foto -----

  function renderCategoriaLocal(tipo) {
    const nombre = nombreCategoriaLocal(tipo);
    const delTipo = localesTodos.filter(loc => String(loc.type) === String(tipo));
    const visibles = filtroLocalMunicipio
      ? delTipo.filter(loc => String(loc.municipalityId) === filtroLocalMunicipio)
      : delTipo;

    const filasHtml = visibles.length
      ? visibles.map(loc => {
          const municipio = MUNICIPIOS[loc.municipalityId] || 'Sin municipio';
          const zona = loc.subtitle && loc.subtitle !== municipio ? ` · ${escapeHtml(loc.subtitle)}` : '';
          return `
            <button type="button" class="fila-local ${loc.status ? '' : 'fila-inactiva'}" data-id="${escapeHtml(loc._id)}">
              ${htmlFotoLocal(loc, 'foto-local')}
              <span class="fila-local-texto">
                <span class="fila-local-titulo">${escapeHtml(loc.title || 'Sin título')}</span>
                <span class="fila-local-sub">${escapeHtml(municipio)}${zona}</span>
              </span>
              ${badgeEstatusLocal(loc)}
              <span class="fila-local-flecha">${ICONOS.siguiente}</span>
            </button>
          `;
        }).join('')
      : `<div class="estado-vacio">${delTipo.length ? 'No hay posts de esta categoría en ese municipio.' : `Todavía no hay posts en ${escapeHtml(nombre)}.`}</div>`;

    lista.innerHTML = `
      <div class="cabecera-local">
        <button type="button" class="btn-volver" id="loc-volver">${ICONOS.anterior}<span>Categorías</span></button>
        <h2 class="cabecera-local-titulo"><span class="cabecera-local-icono">${iconoCategoriaLocal(tipo)}</span>${escapeHtml(nombre)}</h2>
        <span class="cabecera-local-cuenta">${plural(visibles.length, 'post', 'posts')}</span>
      </div>
      <div class="barra-locales">
        <div class="filtros">
          <div class="campo-select">
            <label for="loc-filtro-municipio">Municipio</label>
            <select id="loc-filtro-municipio">
              <option value="">Todos</option>
              ${Object.entries(MUNICIPIOS).map(([id, nombreMunicipio]) => `<option value="${id}" ${filtroLocalMunicipio === id ? 'selected' : ''}>${nombreMunicipio}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="acciones">
          <button class="btn-agregar-directorio" id="btn-agregar-local">${ICONOS.mas}<span>Agregar en ${escapeHtml(nombre)}</span></button>
        </div>
      </div>
      <div class="lista-locales">${filasHtml}</div>
    `;

    document.getElementById('loc-volver').addEventListener('click', () => {
      vistaLocalTipo = null;
      renderLocales();
    });
    document.getElementById('loc-filtro-municipio').addEventListener('change', (e) => {
      filtroLocalMunicipio = e.target.value;
      renderLocales();
    });
    document.getElementById('btn-agregar-local').addEventListener('click', () => abrirModalLocal(null, tipo));
    lista.querySelectorAll('.fila-local').forEach(fila => {
      fila.addEventListener('click', () => {
        vistaLocalId = fila.dataset.id;
        renderLocales();
      });
    });
    quitarFotosRotas();
  }

  // ----- Pantalla 3: un post, con sus acciones -----

  function renderDetalleLocal(loc) {
    const nombre = nombreCategoriaLocal(loc.type);
    const municipio = MUNICIPIOS[loc.municipalityId] || 'Sin municipio';
    const ubicacion = loc.location || {};
    const coordenadas = ubicacion.latitude != null && ubicacion.longitude != null ? `${ubicacion.latitude}, ${ubicacion.longitude}` : '';
    const horario = loc.openAllDay
      ? 'Abierto todo el día'
      : (Array.isArray(loc.schedule) ? loc.schedule : []).map(item => `${item.day}: ${item.hours}`).join(' · ');

    const datos = [
      ['Servicios', (Array.isArray(loc.services) ? loc.services : []).map(clave => SERVICIOS_LOCAL[clave] || clave).join(', ')],
      ['Horario', horario],
      ['Ubicación', [ubicacion.name, coordenadas].filter(Boolean).join(' · ')],
      ['Dirección', loc.address],
      ['Teléfono', loc.phone],
      ['Clave de imagen', loc.imageKey],
      ['ID permanente', loc._id],
    ].filter(([, valor]) => valor);

    lista.innerHTML = `
      <div class="cabecera-local">
        <button type="button" class="btn-volver" id="loc-volver">${ICONOS.anterior}<span>${escapeHtml(nombre)}</span></button>
      </div>
      <article class="detalle-local ${loc.status ? '' : 'fila-inactiva'}">
        ${htmlFotoLocal(loc, 'foto-local-grande')}
        <div class="detalle-local-cuerpo">
          <div class="detalle-local-meta">
            <span class="badge">${escapeHtml(nombre)}</span>
            <span class="detalle-local-municipio">${escapeHtml(municipio)}</span>
            ${badgeEstatusLocal(loc)}
          </div>
          <h2 class="detalle-local-titulo">${escapeHtml(loc.title || 'Sin título')}</h2>
          ${loc.subtitle && loc.subtitle !== municipio ? `<p class="detalle-local-subtitulo">${escapeHtml(loc.subtitle)}</p>` : ''}
          <p class="detalle-local-descripcion">${escapeHtml(loc.description || '')}</p>
          <dl class="detalle-local-datos">
            ${datos.map(([etiqueta, valor]) => `<dt>${etiqueta}</dt><dd>${escapeHtml(valor)}</dd>`).join('')}
          </dl>
          <div class="acciones-detalle">
            <button type="button" class="btn-agregar-directorio" data-accion="editar">Editar</button>
            ${loc.status
              ? '<button type="button" class="btn-baja-local" data-accion="baja">Dar de baja</button>'
              : '<button type="button" class="btn-secundario" data-accion="reactivar">Reactivar</button>'}
          </div>
        </div>
      </article>
    `;

    document.getElementById('loc-volver').addEventListener('click', () => {
      vistaLocalId = null;
      vistaLocalTipo = String(loc.type);
      renderLocales();
    });
    lista.querySelector('[data-accion="editar"]').addEventListener('click', () => abrirModalLocal(loc));
    lista.querySelector('[data-accion="baja"]')?.addEventListener('click', async () => {
      if (!(await confirmar(`¿Dar de baja "${loc.title}"? No se borra: solo deja de exportarse a la app y se puede reactivar después.`, { textoAceptar: 'Dar de baja' }))) return;
      const res = await fetch(`/api/locales/${loc._id}/baja`, { method: 'POST' });
      if (!(await respuestaOk(res))) return;
      cargarLocales();
    });
    lista.querySelector('[data-accion="reactivar"]')?.addEventListener('click', async () => {
      const res = await fetch(`/api/locales/${loc._id}/reactivar`, { method: 'POST' });
      if (!(await respuestaOk(res))) return;
      cargarLocales();
    });
    quitarFotosRotas();
  }

  async function exportarCatalogoLocal() {
    const btn = document.getElementById('btn-exportar-catalogo');
    btn.disabled = true;
    const etiqueta = btn.querySelector('span');
    const textoOriginal = etiqueta.textContent;
    etiqueta.textContent = 'Exportando…';
    try {
      const res = await fetch('/api/locales/export');
      const data = await res.json();
      if (!res.ok) {
        avisar(data.error || 'No se pudo exportar el catálogo.');
        return;
      }
      // En la app no hay descargas del navegador: se abre el diálogo
      // nativo de "Guardar" y Rust escribe el archivo donde elijas.
      await guardarArchivo('catalog.json', JSON.stringify(data, null, 2));
    } catch (err) {
      avisar('Ocurrió un error al exportar, intenta de nuevo.');
    } finally {
      btn.disabled = false;
      etiqueta.textContent = textoOriginal;
    }
  }

  // Arma una fila de horario (día/hora) dentro del formulario de post local.
  function crearFilaHorario(contenedor, dia = '', horas = '') {
    const fila = document.createElement('div');
    fila.className = 'schedule-fila';
    fila.innerHTML = `
      <input type="text" placeholder="Día (ej. Lunes a viernes)" aria-label="Día" class="loc-schedule-dia" value="${escapeHtml(dia)}" />
      <input type="text" placeholder="Horario (ej. 9:00 - 18:00)" aria-label="Horario" class="loc-schedule-horas" value="${escapeHtml(horas)}" />
      <button type="button" class="btn-quitar-fila" title="Quitar horario" aria-label="Quitar horario">${ICONOS.cerrar}</button>
    `;
    fila.querySelector('.btn-quitar-fila').addEventListener('click', () => fila.remove());
    contenedor.appendChild(fila);
  }

  // "tipoInicial" preselecciona la categoría al agregar desde la lista de una.
  function abrirModalLocal(local, tipoInicial) {
    const esNuevo = !local;

    const tipoSeleccionado = String(local ? local.type : (tipoInicial ?? ''));
    // Un post con una categoría que no está en la lista (ver CATEGORIAS_LOCAL)
    // conserva la suya en el select; si no, guardar lo obligaría a cambiarla.
    const categoriaAjena = tipoSeleccionado && !(tipoSeleccionado in CATEGORIAS_LOCAL)
      ? `<option value="${escapeHtml(tipoSeleccionado)}" selected>${escapeHtml(nombreCategoriaLocal(tipoSeleccionado))}</option>`
      : '';
    const opcionesCategoria = categoriaAjena + Object.entries(CATEGORIAS_LOCAL)
      .map(([id, nombre]) => `<option value="${id}" ${tipoSeleccionado === id ? 'selected' : ''}>${nombre}</option>`)
      .join('');
    const opcionesMunicipio = Object.entries(MUNICIPIOS)
      .map(([id, nombre]) => `<option value="${id}" ${local && String(local.municipalityId) === id ? 'selected' : ''}>${nombre}</option>`)
      .join('');
    const opcionesServicios = Object.entries(SERVICIOS_LOCAL)
      .map(([clave, etiqueta]) => `
        <label><input type="checkbox" class="loc-servicio" value="${clave}" ${local && Array.isArray(local.services) && local.services.includes(clave) ? 'checked' : ''} /> ${etiqueta}</label>
      `).join('');

    const loc = local || {};
    const socialNetworks = loc.socialNetworks || {};
    const location = loc.location || {};
    const tieneUbicacion = !!(location && (location.name || location.latitude || location.longitude));

    const overlay = crearModal(`
      <div class="modal-box modal-box-local">
        <h3>${esNuevo ? 'Agregar post local' : 'Editar post local'}</h3>
        <p class="hint">Lugar fijo de Colima. Se captura una sola vez; la app lo recibe empaquetado en el siguiente release.</p>
        <div class="form-local">
          <div class="fila-campos">
            <div class="campo-select">
              <label>Categoría <span class="req">*</span></label>
              <select id="loc-type">
                <option value="">Selecciona…</option>
                ${opcionesCategoria}
              </select>
            </div>
            <div class="campo-select">
              <label>Municipio <span class="req">*</span></label>
              <select id="loc-municipio">
                <option value="">Selecciona…</option>
                ${opcionesMunicipio}
              </select>
            </div>
            <div class="campo-select campo-corto">
              <label for="loc-subtype">Subcategoría</label>
              <input type="number" id="loc-subtype" value="${loc.subType ?? 0}" />
            </div>
          </div>

          <div class="campo-fecha">
            <label>Título <span class="req">*</span></label>
            <input type="text" id="loc-title" value="${escapeHtml(loc.title || '')}" placeholder="Ej. Río Los Amiales" />
          </div>
          <div class="campo-fecha">
            <label>Subtítulo (normalmente municipio o zona)</label>
            <input type="text" id="loc-subtitle" value="${escapeHtml(loc.subtitle || '')}" />
          </div>
          <div class="campo-fecha">
            <label>Descripción (español) <span class="req">*</span></label>
            <textarea id="loc-description">${escapeHtml(loc.description || '')}</textarea>
          </div>
          <div class="campo-fecha">
            <label>Descripción (inglés)</label>
            <textarea id="loc-description-en">${escapeHtml(loc.descriptionEnglish || '')}</textarea>
          </div>
          <div class="campo-fecha">
            <label>Clave de imagen (imageKey)</label>
            <input type="text" id="loc-imagekey" value="${escapeHtml(loc.imageKey || '')}" placeholder="ej. rio_los_amiales_1" />
            <p class="ayuda-campo">Esta clave debe existir también en el repo de la app (imagesMappers) con la foto correspondiente, agregada ahí antes del próximo release.</p>
          </div>
          <div class="campo-fecha">
            <label>Slug (opcional, informativo)</label>
            <input type="text" id="loc-slug" value="${escapeHtml(loc.slug || '')}" placeholder="ej. rio-los-amiales" />
          </div>

          <div class="seccion">
            <div class="seccion-titulo">Ubicación (opcional)</div>
            <label class="check-linea"><input type="checkbox" id="loc-tiene-ubicacion" ${tieneUbicacion ? 'checked' : ''} /> Este lugar tiene coordenadas / acceso que capturar</label>
            <div id="loc-ubicacion-campos" class="campos-ubicacion" ${tieneUbicacion ? '' : 'hidden'}>
              <div class="campo-fecha">
                <label for="loc-lat">Latitud</label>
                <input type="text" inputmode="decimal" id="loc-lat" value="${escapeHtml(location.latitude ?? '')}" />
              </div>
              <div class="campo-fecha">
                <label for="loc-lng">Longitud</label>
                <input type="text" inputmode="decimal" id="loc-lng" value="${escapeHtml(location.longitude ?? '')}" />
              </div>
              <div class="campo-fecha">
                <label for="loc-loc-nombre">Nombre del punto</label>
                <input type="text" id="loc-loc-nombre" value="${escapeHtml(location.name || '')}" />
              </div>
              <div class="campo-fecha">
                <label for="loc-loc-desc">Descripción del acceso</label>
                <input type="text" id="loc-loc-desc" value="${escapeHtml(location.descriptionLocation || '')}" />
              </div>
            </div>
          </div>

          <div class="seccion">
            <div class="seccion-titulo">Servicios</div>
            <div class="servicios-grid">${opcionesServicios}</div>
          </div>

          <div class="seccion">
            <div class="seccion-titulo">Horario</div>
            <label class="check-linea"><input type="checkbox" id="loc-openallday" ${loc.openAllDay ? 'checked' : ''} /> Abierto todo el día</label>
            <div class="schedule-filas" id="loc-schedule-filas"></div>
            <button type="button" class="btn-secundario btn-agregar-fila" id="loc-agregar-horario">${ICONOS.mas}<span>Agregar horario</span></button>
          </div>

          <div class="seccion">
            <div class="seccion-titulo">Video y redes sociales</div>
            <div class="campo-fecha">
              <label>Video de TikTok (URL)</label>
              <input type="text" id="loc-video" value="${escapeHtml(loc.videoTikTok || '')}" />
            </div>
            <div class="fila-campos">
              <div class="campo-fecha"><label>Web</label><input type="text" id="loc-web" value="${escapeHtml(socialNetworks.web || '')}" /></div>
              <div class="campo-fecha"><label>Facebook</label><input type="text" id="loc-facebook" value="${escapeHtml(socialNetworks.facebook || '')}" /></div>
              <div class="campo-fecha"><label>WhatsApp</label><input type="text" id="loc-whatsapp" value="${escapeHtml(socialNetworks.whatsapp || '')}" /></div>
            </div>
            <div class="fila-campos">
              <div class="campo-fecha"><label>Instagram</label><input type="text" id="loc-instagram" value="${escapeHtml(socialNetworks.instagram || '')}" /></div>
              <div class="campo-fecha"><label>TikTok</label><input type="text" id="loc-tiktok" value="${escapeHtml(socialNetworks.tiktok || '')}" /></div>
              <div class="campo-fecha"><label>YouTube</label><input type="text" id="loc-youtube" value="${escapeHtml(socialNetworks.youtube || '')}" /></div>
            </div>
          </div>

          <div class="seccion" id="loc-seccion-hotel-restaurante" style="display:none;">
            <div class="seccion-titulo">Datos de hotel / restaurante</div>
            <div class="campo-fecha">
              <label>Dirección</label>
              <input type="text" id="loc-address" value="${escapeHtml(loc.address || '')}" />
            </div>
            <div class="fila-campos">
              <div class="campo-fecha"><label>Teléfono</label><input type="text" id="loc-phone" value="${escapeHtml(loc.phone || '')}" /></div>
              <div class="campo-fecha"><label>Sitio web</label><input type="text" id="loc-website" value="${escapeHtml(loc.website || '')}" /></div>
              <div class="campo-fecha"><label>Correo</label><input type="text" id="loc-email" value="${escapeHtml(loc.email || '')}" /></div>
            </div>
            <div class="fila-campos">
              <div class="campo-fecha campo-corto"><label>Calificación</label><input type="number" step="0.1" min="0" max="5" id="loc-rating" value="${loc.rating ?? ''}" /></div>
              <div class="campo-fecha campo-corto"><label>Rango de precio</label><input type="text" id="loc-pricerange" value="${escapeHtml(loc.priceRange || '')}" placeholder="ej. $$" /></div>
            </div>
          </div>
        </div>

        <p id="loc-error" class="error-form" style="display:none;"></p>
        <div id="loc-id-asignado"></div>

        <div class="acciones-modal">
          <button type="button" class="btn-terciario" id="loc-cancelar">${esNuevo ? 'Cancelar' : 'Cerrar'}</button>
          <button type="button" class="btn-agregar-directorio" id="loc-guardar">${esNuevo ? 'Crear' : 'Guardar cambios'}</button>
        </div>
      </div>
    `);

    const filasContenedor = overlay.querySelector('#loc-schedule-filas');
    (loc.schedule || []).forEach(item => crearFilaHorario(filasContenedor, item.day, item.hours));
    overlay.querySelector('#loc-agregar-horario').addEventListener('click', () => crearFilaHorario(filasContenedor));

    const selectTipo = overlay.querySelector('#loc-type');
    const seccionHotelRestaurante = overlay.querySelector('#loc-seccion-hotel-restaurante');
    function actualizarSeccionHotelRestaurante() {
      const esHotelORestaurante = ['20', '21'].includes(selectTipo.value);
      seccionHotelRestaurante.style.display = esHotelORestaurante ? 'flex' : 'none';
    }
    selectTipo.addEventListener('change', actualizarSeccionHotelRestaurante);
    actualizarSeccionHotelRestaurante();

    const checkUbicacion = overlay.querySelector('#loc-tiene-ubicacion');
    const camposUbicacion = overlay.querySelector('#loc-ubicacion-campos');
    checkUbicacion.addEventListener('change', () => {
      camposUbicacion.hidden = !checkUbicacion.checked;
    });

    overlay.querySelector('#loc-cancelar').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#loc-guardar').addEventListener('click', () => guardarLocal(overlay, local));
  }

  // Junta un número de un input; devuelve undefined si está vacío (para no
  // mandar campos numéricos opcionales vacíos, que el backend rechazaría).
  function numeroOpcional(valor) {
    if (valor === '' || valor === null || valor === undefined) return undefined;
    const n = Number(valor);
    return Number.isNaN(n) ? undefined : n;
  }

  function textoOpcional(valor) {
    const v = (valor || '').trim();
    return v === '' ? undefined : v;
  }

  async function guardarLocal(overlay, localExistente) {
    // Ya se creó en un click anterior: el botón ahora solo cierra el modal
    // (evita volver a enviar el alta si el usuario le da clic de nuevo).
    if (overlay.querySelector('#loc-id-asignado').children.length) {
      overlay.remove();
      cargarLocales();
      return;
    }

    const errorEl = overlay.querySelector('#loc-error');
    errorEl.style.display = 'none';

    const type = numeroOpcional(overlay.querySelector('#loc-type').value);
    const municipalityId = numeroOpcional(overlay.querySelector('#loc-municipio').value);
    const title = overlay.querySelector('#loc-title').value.trim();
    const description = overlay.querySelector('#loc-description').value.trim();

    if (type === undefined || municipalityId === undefined || !title || !description) {
      errorEl.textContent = 'Completa categoría, municipio, título y descripción.';
      errorEl.style.display = 'block';
      return;
    }

    const body = {
      kind: 'local',
      type,
      municipalityId,
      subType: numeroOpcional(overlay.querySelector('#loc-subtype').value) ?? 0,
      title,
      description,
      subtitle: textoOpcional(overlay.querySelector('#loc-subtitle').value),
      descriptionEnglish: textoOpcional(overlay.querySelector('#loc-description-en').value),
      imageKey: textoOpcional(overlay.querySelector('#loc-imagekey').value),
      slug: textoOpcional(overlay.querySelector('#loc-slug').value),
      openAllDay: overlay.querySelector('#loc-openallday').checked,
      videoTikTok: textoOpcional(overlay.querySelector('#loc-video').value),
    };

    const servicios = Array.from(overlay.querySelectorAll('.loc-servicio:checked')).map(chk => chk.value);
    if (servicios.length) body.services = servicios;

    const schedule = Array.from(overlay.querySelectorAll('.schedule-fila')).map(fila => ({
      day: fila.querySelector('.loc-schedule-dia').value.trim(),
      hours: fila.querySelector('.loc-schedule-horas').value.trim(),
    })).filter(item => item.day && item.hours);
    if (schedule.length) body.schedule = schedule;

    if (overlay.querySelector('#loc-tiene-ubicacion').checked) {
      const lat = numeroOpcional(overlay.querySelector('#loc-lat').value);
      const lng = numeroOpcional(overlay.querySelector('#loc-lng').value);
      const nombreUbicacion = overlay.querySelector('#loc-loc-nombre').value.trim();
      if (lat !== undefined && lng !== undefined && nombreUbicacion) {
        body.location = {
          latitude: lat,
          longitude: lng,
          name: nombreUbicacion,
          descriptionLocation: overlay.querySelector('#loc-loc-desc').value.trim(),
        };
      }
    }

    const socialNetworks = {
      web: textoOpcional(overlay.querySelector('#loc-web').value),
      facebook: textoOpcional(overlay.querySelector('#loc-facebook').value),
      whatsapp: textoOpcional(overlay.querySelector('#loc-whatsapp').value),
      instagram: textoOpcional(overlay.querySelector('#loc-instagram').value),
      tiktok: textoOpcional(overlay.querySelector('#loc-tiktok').value),
      youtube: textoOpcional(overlay.querySelector('#loc-youtube').value),
    };
    if (Object.values(socialNetworks).some(v => v !== undefined)) {
      body.socialNetworks = socialNetworks;
    }

    if ([20, 21].includes(type)) {
      body.address = textoOpcional(overlay.querySelector('#loc-address').value);
      body.phone = textoOpcional(overlay.querySelector('#loc-phone').value);
      body.website = textoOpcional(overlay.querySelector('#loc-website').value);
      body.email = textoOpcional(overlay.querySelector('#loc-email').value);
      body.rating = numeroOpcional(overlay.querySelector('#loc-rating').value);
      body.priceRange = textoOpcional(overlay.querySelector('#loc-pricerange').value);
    }

    // Limpia claves undefined: el backend rechaza cuerpos con campos que no
    // reconoce, así que es mejor no mandarlos en vez de mandarlos en null/undefined.
    Object.keys(body).forEach(key => { if (body[key] === undefined) delete body[key]; });

    const btnGuardar = overlay.querySelector('#loc-guardar');
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando…';

    try {
      const esNuevo = !localExistente;
      const url = esNuevo ? '/api/locales' : `/api/locales/${localExistente._id}`;
      const res = await fetch(url, {
        method: esNuevo ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'No se pudo guardar.';
        errorEl.style.display = 'block';
        btnGuardar.disabled = false;
        btnGuardar.textContent = esNuevo ? 'Crear' : 'Guardar cambios';
        return;
      }

      if (esNuevo && data.post && data.post._id) {
        // El modal se queda abierto mostrando el id; la lista de atrás ya
        // puede traer el post nuevo (y el conteo de su tarjeta).
        cargarLocales();
        const idAsignadoEl = overlay.querySelector('#loc-id-asignado');
        idAsignadoEl.innerHTML = `
          <div class="id-asignado">
            <span>Post local creado. Su id permanente es</span>
            <code id="loc-id-texto">${data.post._id}</code>
            <button type="button" id="loc-copiar-id">Copiar</button>
          </div>
        `;
        idAsignadoEl.querySelector('#loc-copiar-id').addEventListener('click', async (e) => {
          try {
            await navigator.clipboard.writeText(data.post._id);
            e.target.textContent = 'Copiado';
          } catch (err) {
            e.target.textContent = 'Selecciónalo y copia';
          }
        });
        btnGuardar.textContent = 'Cerrar';
        btnGuardar.disabled = false;
        overlay.querySelector('#loc-cancelar').textContent = 'Seguir editando aquí';
      } else {
        overlay.remove();
        cargarLocales();
      }
    } catch (err) {
      errorEl.textContent = 'Ocurrió un error, intenta de nuevo.';
      errorEl.style.display = 'block';
      btnGuardar.disabled = false;
      btnGuardar.textContent = localExistente ? 'Guardar cambios' : 'Crear';
    }
  }

  // ---------- Modo "Posts" (Configuración): buscar un post y editar sus campos ----------
  // Reemplaza al viejo editor genérico de Mongo ("Base de Datos"): ya no hay
  // acceso a Mongo crudo desde el panel — esto busca/edita solo dentro de la
  // colección de posts (evento o local), pasando por el backend real.

  let busquedaPostsAdmin = '';

  async function cargarPostsAdmin() {
    try {
      const params = new URLSearchParams();
      if (busquedaPostsAdmin) params.set('q', busquedaPostsAdmin);
      const res = await fetch(`/api/posts-admin?${params}`);
      const data = await res.json();
      if (!res.ok) {
        lista.innerHTML = `<div class="estado-vacio">${escapeHtml(data.error || 'No se pudieron buscar posts.')}</div>`;
        return;
      }
      renderPostsAdmin(data);
    } catch (err) {
      lista.innerHTML = '<div class="estado-vacio">No se pudo conectar con el servidor.</div>';
    }
  }

  function renderPostsAdmin(posts) {
    const filasHtml = posts.length
      ? posts.map(post => `
          <tr data-id="${escapeHtml(post._id)}">
            <td class="celda-id">${escapeHtml(post._id)}</td>
            <td>${escapeHtml(post.title || 'Sin título')}</td>
            <td>${post.kind === 'local' ? 'Local' : 'Evento'}</td>
            <td>${post.status ? '<span class="badge-activo">Activo</span>' : '<span class="badge-inactivo">Inactivo</span>'}</td>
            <td>
              <div class="acciones-fila">
                <button class="btn-editar-fila" data-accion="editar">Editar</button>
              </div>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="5" class="vacio">${busquedaPostsAdmin ? 'Sin resultados para esa búsqueda.' : 'Sin posts todavía.'}</td></tr>`;

    lista.innerHTML = `
      <div class="barra-locales">
        <div class="filtros">
          <div class="campo-select campo-busqueda">
            <label for="posts-admin-buscar">Buscar por título o pegar un _id</label>
            <input type="search" id="posts-admin-buscar" value="${escapeHtml(busquedaPostsAdmin)}" placeholder="Ej. Feria del Hongo, o 66f1a2b3c4d5e6f7a8b9c0d1" />
          </div>
        </div>
        <div class="acciones">
          <button class="btn-agregar-directorio" id="btn-buscar-posts-admin">Buscar</button>
        </div>
      </div>
      <p class="hint">${busquedaPostsAdmin ? `${posts.length} resultado${posts.length === 1 ? '' : 's'}.` : `Sin buscar nada, muestra los ${posts.length} más recientes.`} Editar aquí es de campo libre — para dar de alta o dar de baja usa las secciones "Posts locales", "Producción" o "Pendientes".</p>
      <div class="tabla-wrap">
        <table class="tabla-directorio">
          <thead>
            <tr><th>_id</th><th>Título</th><th>Tipo</th><th>Estatus</th><th><span class="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody id="tbody-posts-admin">${filasHtml}</tbody>
        </table>
      </div>
    `;

    const inputBuscar = document.getElementById('posts-admin-buscar');
    const ejecutarBusqueda = () => {
      busquedaPostsAdmin = inputBuscar.value.trim();
      cargarPostsAdmin();
    };
    document.getElementById('btn-buscar-posts-admin').addEventListener('click', ejecutarBusqueda);
    inputBuscar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ejecutarBusqueda();
    });

    document.querySelectorAll('#tbody-posts-admin tr[data-id]').forEach((fila, i) => {
      const post = posts[i];
      fila.querySelector('[data-accion="editar"]')?.addEventListener('click', () => {
        abrirModalEditarPost(post);
      });
    });
  }

  function abrirModalEditarPost(post) {
    const { _id, ...camposEditables } = post;
    const textoInicial = JSON.stringify(camposEditables, null, 2);

    const overlay = crearModal(`
      <div class="modal-box modal-box-local">
        <h3>Editar post</h3>
        <p class="hint">_id: <code>${escapeHtml(_id)}</code>. Edita el JSON y guarda. Cambiar "kind" o los contadores sociales (likes, comments, views, favorites, hides) no tiene efecto: esos se manejan desde sus propios flujos.</p>
        <textarea id="post-admin-json" class="editor-json" rows="16" spellcheck="false" aria-label="JSON del post">${escapeHtml(textoInicial)}</textarea>
        <p id="post-admin-error" class="error-form" role="alert" style="display:none;"></p>
        <div class="acciones-modal">
          <button type="button" class="btn-terciario" id="post-admin-cancelar">Cancelar</button>
          <button type="button" class="btn-agregar-directorio" id="post-admin-guardar">Guardar</button>
        </div>
      </div>
    `);

    document.getElementById('post-admin-cancelar').addEventListener('click', () => overlay.remove());

    document.getElementById('post-admin-guardar').addEventListener('click', async () => {
      const textarea = document.getElementById('post-admin-json');
      const errorEl = document.getElementById('post-admin-error');
      let cambios;
      try {
        cambios = JSON.parse(textarea.value);
      } catch (err) {
        errorEl.textContent = 'El JSON no es válido: ' + err.message;
        errorEl.style.display = 'block';
        return;
      }

      const btnGuardar = document.getElementById('post-admin-guardar');
      btnGuardar.disabled = true;
      btnGuardar.textContent = 'Guardando…';

      try {
        const res = await fetch(`/api/posts-admin/${_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cambios),
        });
        const data = await res.json();
        if (!res.ok) {
          errorEl.textContent = data.error || 'No se pudo guardar.';
          errorEl.style.display = 'block';
          btnGuardar.disabled = false;
          btnGuardar.textContent = 'Guardar';
          return;
        }
        overlay.remove();
        cargarPostsAdmin();
      } catch (err) {
        errorEl.textContent = 'Ocurrió un error, intenta de nuevo.';
        errorEl.style.display = 'block';
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar';
      }
    });
  }

  // ---------- Modo "Pendientes": una tarjeta grande a la vez ----------

  // Modal que enumera los campos obligatorios que faltan al aprobar un evento.
  function mostrarModalFaltantes(faltantes) {
    const overlay = crearModal(`
      <div class="modal-box">
        <h3>Falta información</h3>
        <p class="hint">Completa estos campos antes de aprobar el evento:</p>
        <ul class="lista-faltantes">
          ${faltantes.map(f => `<li>${f}</li>`).join('')}
        </ul>
        <div class="acciones-modal">
          <button type="button" class="btn-agregar-directorio" id="btn-cerrar-faltantes">Entendido</button>
        </div>
      </div>
    `);
    document.getElementById('btn-cerrar-faltantes').addEventListener('click', () => overlay.remove());
  }

  // Busca eventos ya aprobados/publicados en la misma fecha (para detectar
  // que un ayuntamiento repitió la misma publicación) y, si hay alguno,
  // muestra un modal con el título de cada uno y un acceso al post original.
  async function buscarYMostrarEventosMismoDia(fechaISO, idEventoActual) {
    if (!fechaISO) return;
    try {
      const res = await fetch(`/api/pendientes/mismo-dia?fecha=${fechaISO}&excluir=${idEventoActual}`);
      if (!res.ok) return;
      const eventos = await res.json();
      if (!Array.isArray(eventos) || !eventos.length) return;

      const overlay = crearModal(`
        <div class="modal-box modal-box-repetidos">
          <h3>${ICONOS.alerta} Posible evento repetido</h3>
          <p class="hint">Ya hay ${eventos.length} evento${eventos.length === 1 ? '' : 's'} aprobado${eventos.length === 1 ? '' : 's'} con fecha ${formatearFechaAmigable(fechaISO)}. Revisa si es el mismo antes de aprobar de nuevo:</p>
          ${eventos.map(e => `
            <div class="item-evento-repetido">
              <div>
                <div class="titulo-evento-repetido">${escapeHtml(e.title || 'Sin título')}</div>
                <div class="badge-estatus-repetido">${[e.pagina_origen, e.estatus_revision].filter(Boolean).map(escapeHtml).join(' · ')}</div>
              </div>
              ${e.post_url ? `<a class="btn-ver-original-repetido" href="${escapeHtml(e.post_url)}" target="_blank" rel="noopener">Ver post ${ICONOS.externo}</a>` : ''}
            </div>
          `).join('')}
          <button type="button" class="btn-cerrar-grande" id="btn-cerrar-repetidos">Cerrar</button>
        </div>
      `);
      document.getElementById('btn-cerrar-repetidos').addEventListener('click', () => overlay.remove());
    } catch (err) {
      // Si falla la búsqueda no bloqueamos el flujo de aprobar/rechazar.
    }
  }

  function fechaHoyISO() {
    const ahora = new Date();
    const dosDigitos = (n) => String(n).padStart(2, '0');
    return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
  }

  // Convierte el valor crudo de un <input type="date"|"datetime-local">
  // (ej. "2026-09-12" o "2026-09-12T17:00") a un texto legible en español,
  // ej. "Sábado 12 de septiembre 2026, 5:00 p.m.". Se arma la fecha con
  // año/mes/día locales (sin pasar por Date-desde-string) para no correr
  // un día por husos horarios.
  function formatearFechaAmigable(valor) {
    if (!valor) return '';
    const [parteFecha, parteHora] = valor.split('T');
    const [anio, mes, dia] = parteFecha.split('-').map(Number);
    if (!anio || !mes || !dia) return '';
    const fecha = new Date(anio, mes - 1, dia);
    const diaSemana = fecha.toLocaleDateString('es-MX', { weekday: 'long' });
    const mesNombre = fecha.toLocaleDateString('es-MX', { month: 'long' });
    let texto = `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)} ${dia} de ${mesNombre} ${anio}`;
    if (parteHora) {
      const [h, m] = parteHora.split(':').map(Number);
      const horaFecha = new Date(2000, 0, 1, h, m);
      const hora = horaFecha
        .toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' })
        .replace(/\s*([ap])\.?\s*m\.?/i, ' $1.m.'); // "5:00 p. m." -> "5:00 p.m."
      texto += `, ${hora}`;
    }
    return texto;
  }


  function renderTarjetaGrande() {
    if (!eventosPendientes.length) {
      lista.innerHTML = '<div class="estado-vacio">Todo revisado: no quedan eventos pendientes.</div>';
      return;
    }

    const total = eventosPendientes.length;
    const ev = eventosPendientes[0];
    const imagenes = Array.isArray(ev.imagenes) ? ev.imagenes.filter(Boolean) : [];
    let indiceImagen = 0;

    const imagenHtml = imagenes.length
      ? `<div class="imagen-wrap">
           <img id="img-actual" src="${escapeHtml(imagenes[0])}" alt="Imagen 1 del post" />
           ${imagenes.length > 1 ? `
             <button class="nav-imagen izq" id="btn-img-izq" aria-label="Imagen anterior">${ICONOS.anterior}</button>
             <button class="nav-imagen der" id="btn-img-der" aria-label="Imagen siguiente">${ICONOS.siguiente}</button>
             <span class="contador-imagenes" id="contador-imagenes" aria-live="polite">1 / ${imagenes.length}</span>
           ` : ''}
         </div>`
      : `<div class="imagen-wrap"><div class="sin-imagen">Este post no tiene imagen</div></div>`;

    lista.innerHTML = `
      <div class="progreso">${total === 1 ? 'Queda 1 por revisar' : `Quedan ${total} por revisar`}</div>
      <div class="card-grande">
        ${imagenHtml}
        <div class="contenido">
          <div class="meta">
            ${ev.plataforma ? `<span class="badge">${escapeHtml(ev.plataforma)}</span>` : ''}
            <span>${escapeHtml(ev.pagina_origen || 'Página desconocida')}</span>
            <span aria-hidden="true">·</span>
            <span>Detectado ${formatearFecha(ev.detectado_en)}</span>
          </div>
          <p class="texto">${escapeHtml((ev.contenido_crudo || '').trim())}</p>
          <a class="enlace-original" href="${escapeHtml(ev.post_url)}" target="_blank" rel="noopener">Ver post original en Facebook ${ICONOS.externo}</a>

          <div class="fila-traducir" id="fila-traducir">
            <button type="button" class="btn-traducir" data-accion="traducir">${ICONOS.idioma} Traducir</button>
            <span class="nota-obligatorio">Obligatorio <span class="req">*</span></span>
          </div>

          <div class="form-fecha">
            <div class="checks">
              <label><input type="checkbox" id="chk-allday" /> Todo el día (sin hora específica)</label>
              <label><input type="checkbox" id="chk-moredays" /> Dura más de un día</label>
              <label><input type="checkbox" id="chk-iscover" /> Es Evento Padre</label>
            </div>
            <div class="campos-fecha">
              <div class="campo-fecha campo-fecha-compacto">
                <label id="lbl-inicio" for="input-date">Fecha del evento</label>
                <div class="fila-fecha">
                  <input type="date" id="input-date" />
                  <span class="fecha-amigable" id="fecha-amigable-inicio"></span>
                </div>
              </div>
              <div class="campo-fecha campo-fecha-compacto" id="wrap-finish" style="display:none;">
                <label id="lbl-fin" for="input-finish">Fecha de término</label>
                <div class="fila-fecha">
                  <input type="date" id="input-finish" />
                  <span class="fecha-amigable" id="fecha-amigable-fin"></span>
                </div>
              </div>
            </div>

            <div class="campos-fecha">
              <div class="campo-select">
                <label for="select-municipio">Municipio <span class="req">*</span> ${ev.municipio_sugerido ? '<span class="etiqueta-autodetectado">· autodetectado, verifica</span>' : ''}</label>
                <select id="select-municipio">
                  <option value="">Selecciona…</option>
                  ${Object.entries(MUNICIPIOS).map(([id, nombre]) => `<option value="${id}">${nombre}</option>`).join('')}
                </select>
              </div>
              <div class="campo-select">
                <label for="select-tipo">Tipo de evento <span class="req">*</span></label>
                <select id="select-tipo">
                  <option value="">Selecciona…</option>
                  ${Object.entries(TIPOS_EVENTO).map(([id, nombre]) => `<option value="${id}">${nombre}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="campo-fecha">
              <label for="input-title">Título <span class="req">*</span></label>
              <input type="text" id="input-title" placeholder="Ej. Feria del Hongo - El Terrero 2026" />
            </div>

            <div class="campo-fecha">
              <label>Subtítulo (lugar) <span class="req">*</span></label>
              <div class="fila-ubicacion" id="fila-subtitulo">
                <button type="button" class="btn-ubicacion" id="btn-elegir-subtitulo">${ICONOS.pin} Agregar ubicación (subtítulo)</button>
              </div>
            </div>
          </div>

          <div class="acciones-grandes">
            <button class="accion-grande btn-rechazar-g" id="btn-rechazar">Rechazar</button>
            <button class="accion-grande btn-aprobar-g" id="btn-aprobar">Aprobar evento</button>
          </div>
        </div>
      </div>
    `;

    const chkAllDay = document.getElementById('chk-allday');
    const chkMoreDays = document.getElementById('chk-moredays');
    const chkIsCover = document.getElementById('chk-iscover');

    // --- Carrusel de imágenes ---
    if (imagenes.length > 1) {
      const imgActual = document.getElementById('img-actual');
      const contador = document.getElementById('contador-imagenes');
      const actualizarImagen = () => {
        imgActual.src = imagenes[indiceImagen];
        imgActual.alt = `Imagen ${indiceImagen + 1} del post`;
        contador.textContent = `${indiceImagen + 1} / ${imagenes.length}`;
      };
      document.getElementById('btn-img-izq').addEventListener('click', () => {
        indiceImagen = (indiceImagen - 1 + imagenes.length) % imagenes.length;
        actualizarImagen();
      });
      document.getElementById('btn-img-der').addEventListener('click', () => {
        indiceImagen = (indiceImagen + 1) % imagenes.length;
        actualizarImagen();
      });
    }
    const inputDate = document.getElementById('input-date');
    const inputFinish = document.getElementById('input-finish');
    const wrapFinish = document.getElementById('wrap-finish');
    const lblInicio = document.getElementById('lbl-inicio');
    const lblFin = document.getElementById('lbl-fin');
    const fechaAmigableInicio = document.getElementById('fecha-amigable-inicio');
    const fechaAmigableFin = document.getElementById('fecha-amigable-fin');

    // "inicial" = al abrir la tarjeta: no se precarga la fecha de hoy, para
    // no aprobar por descuido un evento con la fecha equivocada.
    function actualizarTipoInputs(inicial = false) {
      const tipo = chkAllDay.checked ? 'date' : 'datetime-local';
      const hoy = fechaHoyISO();
      // Al pedir hora, precargamos la fecha ya elegida (o la de hoy) con 01:00,
      // porque los eventos casi siempre caen en horas en punto.
      [inputDate, inputFinish].forEach((input) => {
        const diaPrevio = (input.value || '').slice(0, 10);
        input.type = tipo;
        if (tipo === 'datetime-local') {
          input.value = diaPrevio || !inicial ? `${diaPrevio || hoy}T01:00` : '';
        } else {
          input.value = diaPrevio;
        }
      });
      lblInicio.textContent = chkAllDay.checked ? 'Fecha del evento' : 'Fecha y hora de inicio';
      lblFin.textContent = chkAllDay.checked ? 'Fecha de término' : 'Fecha y hora de término';
      fechaAmigableInicio.textContent = formatearFechaAmigable(inputDate.value);
      fechaAmigableFin.textContent = formatearFechaAmigable(inputFinish.value);
    }
    chkAllDay.addEventListener('change', () => actualizarTipoInputs());
    inputDate.addEventListener('input', () => {
      fechaAmigableInicio.textContent = formatearFechaAmigable(inputDate.value);
    });
    inputFinish.addEventListener('input', () => {
      fechaAmigableFin.textContent = formatearFechaAmigable(inputFinish.value);
    });
    // Al terminar de elegir la fecha de inicio, busca si ya hay otro evento
    // aprobado ese mismo día (ayuntamientos que repiten la misma publicación).
    inputDate.addEventListener('change', () => {
      const fechaISO = (inputDate.value || '').slice(0, 10);
      if (fechaISO.length === 10) {
        buscarYMostrarEventosMismoDia(fechaISO, ev._id);
      }
    });
    actualizarTipoInputs(true);

    // Preselecciona el municipio si coincide con algo en el directorio
    if (ev.municipio_sugerido) {
      const selectMunicipioAuto = document.getElementById('select-municipio');
      selectMunicipioAuto.value = String(ev.municipio_sugerido);
    }

    chkMoreDays.addEventListener('change', () => {
      wrapFinish.style.display = chkMoreDays.checked ? 'flex' : 'none';
    });

    // --- Traducción (descriptionEnglish) ---
    descripcionIngles = '';
    const filaTraducir = document.getElementById('fila-traducir');
    const HTML_BOTON_TRADUCIR = `<button type="button" class="btn-traducir" data-accion="traducir">${ICONOS.idioma} Traducir</button>`;

    async function ejecutarTraduccion() {
      filaTraducir.innerHTML = `<button type="button" class="btn-traducir" disabled>Traduciendo…</button>`;
      try {
        const res = await fetch(`/api/pendientes/${ev._id}/traducir`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          filaTraducir.innerHTML = `${HTML_BOTON_TRADUCIR}<p class="error-traduccion" role="alert">${escapeHtml(data.error || 'No se pudo traducir.')}</p>`;
          return;
        }
        descripcionIngles = data.descriptionEnglish || '';
        filaTraducir.innerHTML = `
          <div class="caja-traduccion">
            <label for="input-description-english">Descripción en inglés (descriptionEnglish) <span class="req">*</span></label>
            <textarea id="input-description-english">${escapeHtml(descripcionIngles)}</textarea>
            <button type="button" class="btn-traducir" data-accion="traducir" style="align-self:flex-start;">${ICONOS.idioma} Volver a traducir</button>
          </div>
        `;
        document.getElementById('input-description-english').addEventListener('input', (e) => {
          descripcionIngles = e.target.value;
        });
      } catch (err) {
        filaTraducir.innerHTML = `${HTML_BOTON_TRADUCIR}<p class="error-traduccion" role="alert">Ocurrió un error, intenta de nuevo.</p>`;
      }
    }

    // Delegación: el botón se reemplaza varias veces (traducir, reintentar,
    // volver a traducir), así que escuchamos en el contenedor fijo.
    filaTraducir.addEventListener('click', (e) => {
      if (e.target.closest('[data-accion="traducir"]')) ejecutarTraduccion();
    });

    // Modal para dar de alta un lugar nuevo sin salir de Pendientes. Se usa
    // tanto desde el picker de "Subtítulo (lugar)" como, si algún día se
    // necesita, desde cualquier otro punto — por eso recibe un callback en
    // vez de asumir a dónde va el nombre elegido.
    function abrirModalAgregarLugar(alGuardar) {
      const overlay = crearModal(`
        <div class="modal-box">
          <h3>Agregar lugar</h3>
          <p class="hint">Se agrega al directorio de lugares y queda disponible aquí de inmediato.</p>
          <div class="campo-fecha">
            <label for="modal-lugar-url">Link de Google Maps (opcional)</label>
            <input type="url" id="modal-lugar-url" placeholder="Pega aquí el link del lugar" />
            <p id="modal-lugar-url-estado" class="hint" style="margin:4px 0 0; display:none;"></p>
          </div>
          <div class="campo-fecha">
            <label for="modal-lugar-nombre">Nombre <span class="req">*</span></label>
            <input type="text" id="modal-lugar-nombre" placeholder="Jardín Libertad" />
          </div>
          <div class="campo-fecha">
            <label for="modal-lugar-municipio">Municipio</label>
            <select id="modal-lugar-municipio">
              <option value="">Selecciona…</option>
              ${Object.entries(MUNICIPIOS).map(([id, nombre]) => `<option value="${id}">${nombre}</option>`).join('')}
            </select>
          </div>
          <div class="campo-fecha">
            <label for="modal-lugar-lat">Latitud (opcional)</label>
            <input type="text" inputmode="decimal" id="modal-lugar-lat" placeholder="19.2433" />
          </div>
          <div class="campo-fecha">
            <label for="modal-lugar-lng">Longitud (opcional)</label>
            <input type="text" inputmode="decimal" id="modal-lugar-lng" placeholder="-103.7247" />
          </div>
          <div class="campo-fecha">
            <label for="modal-lugar-nota">Nota (opcional)</label>
            <input type="text" id="modal-lugar-nota" placeholder="Referencia u otro dato" />
          </div>
          <p id="modal-lugar-error" class="error-form" role="alert" style="display:none;"></p>
          <div class="acciones-modal">
            <button type="button" class="btn-terciario" id="modal-lugar-cancelar">Cancelar</button>
            <button type="button" class="btn-agregar-directorio" id="modal-lugar-guardar">Guardar</button>
          </div>
        </div>
      `);

      document.getElementById('modal-lugar-cancelar').addEventListener('click', () => overlay.remove());

      const nombreInput = document.getElementById('modal-lugar-nombre');
      const municipioSelect = document.getElementById('modal-lugar-municipio');

      // Al pegar un link de Google Maps llena nombre, latitud y longitud.
      // El municipio no viene en el link, ese se elige a mano.
      const urlInput = document.getElementById('modal-lugar-url');
      const urlEstado = document.getElementById('modal-lugar-url-estado');
      let ultimoLink = ''; // "paste" y "change" disparan los dos; se procesa una vez
      async function aplicarLinkMaps() {
        const texto = urlInput.value.trim();
        if (texto === ultimoLink) return;
        ultimoLink = texto;
        if (!texto) { urlEstado.style.display = 'none'; return; }

        let datos = extraerDatosDeLinkMaps(texto);
        if (!datos && /^https?:\/\/(maps\.app\.)?goo\.gl\//i.test(texto)) {
          urlEstado.textContent = 'Abriendo link corto…';
          urlEstado.style.display = 'block';
          try {
            const res = await fetch(`/api/resolver-maps?url=${encodeURIComponent(texto)}`);
            const r = await res.json();
            if (res.ok) datos = extraerDatosDeLinkMaps(r.url);
          } catch (err) { /* cae al mensaje de abajo */ }
        }

        if (!datos) {
          urlEstado.textContent = 'No encontré el lugar en ese link. Ábrelo en Google Maps y copia el link de la barra del navegador.';
          urlEstado.style.color = 'var(--coral)';
          urlEstado.style.display = 'block';
          return;
        }
        if (datos.nombre) nombreInput.value = datos.nombre;
        if (datos.lat) document.getElementById('modal-lugar-lat').value = datos.lat;
        if (datos.lng) document.getElementById('modal-lugar-lng').value = datos.lng;
        urlEstado.textContent = `Listo: ${[datos.nombre, datos.lat && `${datos.lat}, ${datos.lng}`].filter(Boolean).join(' · ')}. Revisa y elige el municipio.`;
        urlEstado.style.color = '';
        urlEstado.style.display = 'block';
        municipioSelect.focus();
      }
      urlInput.addEventListener('paste', () => setTimeout(aplicarLinkMaps, 0));
      urlInput.addEventListener('change', aplicarLinkMaps);

      document.getElementById('modal-lugar-guardar').addEventListener('click', async () => {
        const errorEl = document.getElementById('modal-lugar-error');
        const nombre = nombreInput.value.trim();
        if (!nombre) {
          errorEl.textContent = 'Ingresa el nombre del lugar.';
          errorEl.style.display = 'block';
          return;
        }

        const municipioNombre = municipioSelect.value ? MUNICIPIOS[municipioSelect.value] : '';
        const body = {
          nombre,
          municipio_id: municipioSelect.value,
          municipio_nombre: municipioNombre,
          latitud: document.getElementById('modal-lugar-lat').value.trim(),
          longitud: document.getElementById('modal-lugar-lng').value.trim(),
          nota: document.getElementById('modal-lugar-nota').value.trim(),
        };

        const btnGuardar = document.getElementById('modal-lugar-guardar');
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Guardando…';

        try {
          const res = await fetch('/api/lugares', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            errorEl.textContent = data.error || 'No se pudo agregar.';
            errorEl.style.display = 'block';
            btnGuardar.disabled = false;
            btnGuardar.textContent = 'Guardar';
            return;
          }

          // Disponible de inmediato para el resto de esta sesión, sin recargar nada.
          lugaresDisponibles.push({ _id: data._id, nombre, municipio_nombre: municipioNombre });
          overlay.remove();
          alGuardar(nombre);
        } catch (err) {
          errorEl.textContent = 'Ocurrió un error, intenta de nuevo.';
          errorEl.style.display = 'block';
          btnGuardar.disabled = false;
          btnGuardar.textContent = 'Guardar';
        }
      });
    }

    // --- Subtítulo (lugar): mismo patrón visual que "Agregar ubicación" ---
    subtituloSeleccionado = '';
    subtituloDespues = false;
    const filaSubtitulo = document.getElementById('fila-subtitulo');

    function renderFilaSubtitulo() {
      if (subtituloDespues) {
        filaSubtitulo.innerHTML = `
          <span class="ubicacion-elegida">${ICONOS.pin} Sin lugar (se asigna después) <button type="button" id="btn-quitar-subtitulo">Cambiar</button></span>
        `;
        document.getElementById('btn-quitar-subtitulo').addEventListener('click', () => {
          subtituloDespues = false;
          renderFilaSubtitulo();
          abrirModalElegirSubtitulo();
        });
      } else if (subtituloSeleccionado) {
        filaSubtitulo.innerHTML = `
          <span class="ubicacion-elegida">${ICONOS.pin} ${escapeHtml(subtituloSeleccionado)} <button type="button" id="btn-quitar-subtitulo">Quitar</button></span>
        `;
        document.getElementById('btn-quitar-subtitulo').addEventListener('click', () => {
          subtituloSeleccionado = '';
          renderFilaSubtitulo();
        });
      } else {
        filaSubtitulo.innerHTML = `<button type="button" class="btn-ubicacion" id="btn-elegir-subtitulo">${ICONOS.pin} Agregar ubicación (subtítulo)</button>`;
        document.getElementById('btn-elegir-subtitulo').addEventListener('click', abrirModalElegirSubtitulo);
      }
    }
    document.getElementById('btn-elegir-subtitulo').addEventListener('click', abrirModalElegirSubtitulo);

    function abrirModalElegirSubtitulo() {
      const overlay = crearModal(`
        <div class="modal-box">
          <h3>Elige el lugar (subtítulo)</h3>
          <p class="hint">Lugares de tu directorio, con su municipio para que no te equivoques de cuál es.</p>
          ${lugaresDisponibles.length
            ? lugaresDisponibles.map((l, i) => `<button type="button" class="opcion-ubicacion" data-indice="${i}">${escapeHtml(l.nombre)}${l.municipio_nombre ? ` <span class="municipio-opcion">· ${escapeHtml(l.municipio_nombre)}</span>` : ''}</button>`).join('')
            : `<p class="hint">Todavía no hay lugares guardados.</p>`
          }
          <button type="button" class="btn-agregar-directorio" id="btn-agregar-lugar-desde-picker" style="width:100%; margin-top:6px;">${ICONOS.mas}<span>Agregar lugar</span></button>
          <button type="button" class="btn-terciario" id="btn-lugar-desde-link" style="width:100%; margin-top:6px; padding:10px;">Agregar desde link de Google Maps</button>
          <button type="button" class="btn-terciario" id="btn-lugar-despues" style="width:100%; margin-top:6px; padding:10px;">Asignar lugar después</button>
          <button type="button" class="modal-cerrar" id="btn-cerrar-modal-subtitulo">Cancelar</button>
        </div>
      `);

      overlay.querySelectorAll('.opcion-ubicacion').forEach(btn => {
        btn.addEventListener('click', () => {
          subtituloSeleccionado = lugaresDisponibles[Number(btn.dataset.indice)].nombre;
          subtituloDespues = false;
          renderFilaSubtitulo();
          overlay.remove();
        });
      });
      const alGuardarLugarNuevo = (nombreNuevo) => {
        subtituloSeleccionado = nombreNuevo;
        subtituloDespues = false;
        renderFilaSubtitulo();
      };
      document.getElementById('btn-agregar-lugar-desde-picker').addEventListener('click', () => {
        overlay.remove();
        abrirModalAgregarLugar(alGuardarLugarNuevo);
      });
      // Mismo modal de alta; el campo del link es el primero, así que
      // crearModal ya lo deja enfocado para pegar directo.
      document.getElementById('btn-lugar-desde-link').addEventListener('click', () => {
        overlay.remove();
        abrirModalAgregarLugar(alGuardarLugarNuevo);
      });
      document.getElementById('btn-lugar-despues').addEventListener('click', () => {
        subtituloSeleccionado = '';
        subtituloDespues = true;
        renderFilaSubtitulo();
        overlay.remove();
      });
      document.getElementById('btn-cerrar-modal-subtitulo').addEventListener('click', () => overlay.remove());
    }

    document.getElementById('btn-rechazar').addEventListener('click', (e) => accionarPendiente(ev, 'rechazar', undefined, e.target));
    document.getElementById('btn-aprobar').addEventListener('click', (e) => {
      const selectMunicipio = document.getElementById('select-municipio');
      const selectTipo = document.getElementById('select-tipo');

      const inputTitle = document.getElementById('input-title');

      const faltantes = [];
      if (!inputDate.value) faltantes.push('Fecha del evento');
      if (!selectMunicipio.value) faltantes.push('Municipio');
      if (!selectTipo.value) faltantes.push('Tipo de evento');
      if (!inputTitle.value.trim()) faltantes.push('Título');
      if (!subtituloSeleccionado && !subtituloDespues) faltantes.push('Subtítulo (lugar) — o elige "Asignar lugar después"');
      if (!descripcionIngles.trim()) faltantes.push('Descripción en inglés (usa el botón "Traducir")');
      if (chkMoreDays.checked && !inputFinish.value) faltantes.push('Fecha de término (marcaste "dura más de un día")');
      if (faltantes.length) {
        mostrarModalFaltantes(faltantes);
        return;
      }

      const body = {
        date: inputDate.value,
        allDay: chkAllDay.checked,
        moreDays: chkMoreDays.checked,
        isCover: chkIsCover.checked,
        municipality: selectMunicipio.value,
        title: inputTitle.value.trim(),
      };
      // Con "Asignar lugar después" no se manda subtitle: el backend guarda
      // '' (mismo default del schema de Post), así que el móvil recibe un
      // string vacío como en cualquier post sin subtítulo — nunca null.
      if (subtituloSeleccionado) body.subtitle = subtituloSeleccionado;
      body.subType = selectTipo.value;
      if (chkMoreDays.checked) {
        body.finishDate = inputFinish.value;
      }
      if (descripcionIngles.trim()) {
        body.descriptionEnglish = descripcionIngles.trim();
      }
      accionarPendiente(ev, 'aprobar', body, e.target);
    });
  }

  // "aprobar" tarda más que las demás acciones porque el backend sube cada
  // imagen de Facebook a Cloudinary (una migración a URLs permanentes)
  // antes de responder, así que el botón se deshabilita con un texto de
  // carga mientras se espera — evita doble clic y deja claro que sigue
  // trabajando. Si el backend responde error (p. ej. falló la subida a
  // Cloudinary), la tarjeta NO se quita de la lista: sigue pendiente y se
  // puede reintentar.
  async function accionarPendiente(ev, accion, body, btn) {
    const textoOriginal = btn ? btn.textContent : null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = accion === 'aprobar' ? 'Aprobando…' : 'Guardando…';
    }
    try {
      const res = await fetch(`/api/pendientes/${ev._id}/${accion}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!(await respuestaOk(res))) {
        if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
        return;
      }
      eventosPendientes = eventosPendientes.filter(e => e._id !== ev._id);
      renderTarjetaGrande();
    } catch (err) {
      avisar('Ocurrió un error, intenta de nuevo.');
      if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
    }
  }

  // ---------- Modo "Aprobados" / "Rechazados": lista compacta ----------

  function renderListaCompacta(eventos) {
    if (!eventos.length) {
      lista.innerHTML = htmlVacio();
      return;
    }

    lista.innerHTML = '';
    eventos.forEach(ev => lista.appendChild(crearTarjetaCompacta(ev)));
  }

  function crearTarjetaCompacta(ev) {
    const card = document.createElement('div');
    card.className = 'card';

    const primeraImagen = Array.isArray(ev.imagenes) ? ev.imagenes.find(Boolean) : null;
    const imagenHtml = primeraImagen
      ? `<img src="${escapeHtml(primeraImagen)}" alt="" loading="lazy" />`
      : `<div class="sin-imagen-chica">Sin imagen</div>`;

    let fechaHtml = '';
    if (ev.date) {
      const inicio = formatearFecha(ev.date);
      const fin = ev.moreDays && ev.finishDate ? ` – ${formatearFecha(ev.finishDate)}` : '';
      const hora = ev.allDay ? ' · Todo el día' : '';
      fechaHtml = `<div class="fecha-evento">${ICONOS.calendario} ${inicio}${fin}${hora}</div>`;
    }

    let botonesHistorial = `<button class="btn-deshacer" data-accion="deshacer">Regresar a pendiente</button>`;
    if (ev.post_url) {
      botonesHistorial += `<a class="btn-deshacer" href="${escapeHtml(ev.post_url)}" target="_blank" rel="noopener">Ver original ${ICONOS.externo}</a>`;
    }
    if (estatusActual === 'aprobado') {
      botonesHistorial += `<button class="btn-agregar-directorio btn-publicar" data-accion="publicar">Publicar a producción</button>`;
    }

    card.innerHTML = `
      ${imagenHtml}
      <div class="card-body">
        <div class="meta">
          ${ev.plataforma ? `<span class="badge">${escapeHtml(ev.plataforma)}</span>` : ''}
          <span>${escapeHtml(ev.pagina_origen || 'Página desconocida')}</span>
        </div>
        ${fechaHtml}
        <p class="texto-chico">${escapeHtml((ev.contenido_crudo || '').trim())}</p>
        <div class="acciones-card">${botonesHistorial}</div>
      </div>
    `;

    const btnDeshacer = card.querySelector('[data-accion="deshacer"]');
    btnDeshacer.addEventListener('click', async () => {
      const textoOriginalDeshacer = btnDeshacer.textContent;
      btnDeshacer.disabled = true;
      btnDeshacer.textContent = 'Regresando…';
      try {
        const res = await fetch(`/api/pendientes/${ev._id}/deshacer`, { method: 'POST' });
        if (!(await respuestaOk(res))) {
          btnDeshacer.disabled = false;
          btnDeshacer.textContent = textoOriginalDeshacer;
          return;
        }
        quitarTarjeta(card);
      } catch (err) {
        avisar('Ocurrió un error, intenta de nuevo.');
        btnDeshacer.disabled = false;
        btnDeshacer.textContent = textoOriginalDeshacer;
      }
    });

    const btnPublicar = card.querySelector('[data-accion="publicar"]');
    if (btnPublicar) {
      btnPublicar.addEventListener('click', () => publicarAProduccion(ev, card, btnPublicar));
    }

    return card;
  }

  async function publicarAProduccion(ev, card, btn) {
    btn.disabled = true;
    btn.textContent = 'Publicando…';
    try {
      const res = await fetch(`/api/pendientes/${ev._id}/publicar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        avisar(data.error || 'No se pudo publicar.');
        btn.disabled = false;
        btn.textContent = 'Publicar a producción';
        return;
      }
      quitarTarjeta(card);
    } catch (err) {
      avisar('Ocurrió un error, intenta de nuevo.');
      btn.disabled = false;
      btn.textContent = 'Publicar a producción';
    }
  }

  cargarEventos();

  return function desmontar() {
    document.removeEventListener('keydown', alPresionarEscape);
    document.querySelectorAll('.modal-overlay').forEach((overlay) => overlay.remove());
    estilos.remove();
    raiz.innerHTML = '';
  };
}
