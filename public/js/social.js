/* Guía web de Colima Go — me gusta, comentarios, reportar, ocultar y vistas.
   Se conecta a los botones que pinta accionesPost() (lib/guia/componentes.js):
     [data-accion="me-gusta" | "comentarios" | "menu-post"] con data-id.
   Cada tarjeta o ficha marca su contenedor con data-post="<id>" para poder
   quitarla al ocultar. Los comentarios en línea usan
   <section data-comentarios-inline data-id="<id>">.
   Requiere core.js. Todo pasa por /g/* (el navegador no habla con el backend). */
(function () {
  'use strict';
  var Colima = window.Colima;
  if (!Colima) return;
  var T = Colima.T, esc = Colima.esc, ic = Colima.ic, $ = Colima.$, $$ = Colima.$$, api = Colima.api;
  var LIMITE_COMENTARIO = 500;
  var LIMITE_REPORTE = 1000;
  var lang = (window.COLIMAGO || {}).lang === 'en' ? 'en' : 'es';

  // ---------- Contadores y estado del me gusta ----------
  function contenedores(id) { return $$('[data-acciones][data-id="' + id + '"]'); }
  function ponerContador(id, nombre, valor) {
    contenedores(id).forEach(function (c) {
      var el = $('[data-contador="' + nombre + '"]', c);
      if (el) el.textContent = String(Math.max(0, valor));
    });
    // Los contadores de comentarios también pueden estar fuera de las acciones (cabecera de la sección).
    $$('[data-total-comentarios="' + id + '"]').forEach(function (el) { if (nombre === 'comentarios') el.textContent = String(Math.max(0, valor)); });
  }
  function leerContador(id, nombre) {
    var c = contenedores(id)[0];
    var el = c && $('[data-contador="' + nombre + '"]', c);
    return el ? Number(el.textContent) || 0 : 0;
  }
  function marcarMeGusta(id, activo) {
    contenedores(id).forEach(function (c) {
      var b = $('[data-accion="me-gusta"]', c);
      if (b) b.setAttribute('aria-pressed', String(!!activo));
    });
  }

  // Trae contadores del backend (POST /g/metricas, de 100 en 100): con sesión
  // marca los me gusta de la persona; los contenedores con data-metricas (los
  // lugares, cuyos contadores no vienen en el catálogo) llenan sus números.
  function cargarMetricas() {
    var ids = [];
    $$('[data-acciones][data-id]').forEach(function (c) {
      var conSesion = !!Colima.usuario();
      if ((conSesion || c.hasAttribute('data-metricas')) && ids.indexOf(c.dataset.id) < 0) ids.push(c.dataset.id);
    });
    if (!ids.length) return;
    for (var i = 0; i < ids.length; i += 100) {
      api('/metricas', { metodo: 'POST', cuerpo: { ids: ids.slice(i, i + 100) } }).then(function (r) {
        if (!r.ok || !r.datos.metricas) return;
        Object.keys(r.datos.metricas).forEach(function (id) {
          var m = r.datos.metricas[id];
          var c = contenedores(id)[0];
          if (!c) return;
          if (c.hasAttribute('data-metricas')) {
            ponerContador(id, 'likes', m.likes || 0);
            ponerContador(id, 'comentarios', m.comentarios || 0);
            ponerContador(id, 'vistas', m.vistas || 0);
            c.removeAttribute('hidden');
          }
          if (Colima.usuario()) marcarMeGusta(id, m.activo);
        });
      });
    }
  }

  // ---------- Me gusta ----------
  function alternarMeGusta(boton) {
    var id = boton.dataset.id;
    Colima.requerirSesion('pitchMeGusta').then(function (ok) {
      if (!ok) return;
      boton.disabled = true;
      api('/me-gusta', { metodo: 'POST', cuerpo: { idPost: id } }).then(function (r) {
        boton.disabled = false;
        if (!r.ok) return Colima.toast(Colima.mensajeError(r));
        var activo = !!r.datos.activo;
        marcarMeGusta(id, activo);
        ponerContador(id, 'likes', leerContador(id, 'likes') + (activo ? 1 : -1));
      });
    });
  }

  // ---------- Comentarios ----------
  function fechaCorta(iso) {
    try { return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
  }
  function htmlComentario(c) {
    var avatar = c.img
      ? '<img class="comentario-avatar" src="' + esc(c.img) + '" alt="" width="38" height="38" referrerpolicy="no-referrer" loading="lazy" />'
      : '<span class="comentario-avatar" aria-hidden="true"></span>';
    return '<li class="comentario" data-comentario="' + esc(c.id) + '">' + avatar +
      '<div class="comentario-burbuja"><div class="comentario-nombre">' + esc(c.nombre) + '</div>' +
      '<div class="comentario-texto">' + esc(c.texto) + '</div>' +
      '<div class="comentario-pie"><time datetime="' + esc(c.fecha) + '">' + esc(fechaCorta(c.fecha)) + '</time>' +
      (c.propio ? '<button class="comentario-borrar" type="button" data-borrar="' + esc(c.id) + '">' + esc(T('comentarios.eliminar')) + '</button>' : '') +
      '</div></div></li>';
  }

  // Pinta lista + formulario dentro de `contenedor` para el post `id`.
  function montarComentarios(contenedor, id) {
    contenedor.innerHTML =
      '<ul class="comentarios-lista" aria-live="polite"></ul>' +
      '<form class="comentarios-form" novalidate>' +
      '<div><label class="sr-only" for="com-' + id + '">' + esc(T('comentarios.placeholder')) + '</label>' +
      '<textarea id="com-' + id + '" rows="1" maxlength="' + LIMITE_COMENTARIO + '" placeholder="' + esc(T('comentarios.placeholder')) + '"></textarea>' +
      '<div class="comentarios-contador" aria-hidden="true"><span data-n>0</span>/' + LIMITE_COMENTARIO + '</div></div>' +
      '<button class="btn-enviar" type="submit" aria-label="' + esc(T('comentarios.enviar')) + '" disabled>' + ic('enviar') + '</button></form>';
    var lista = $('.comentarios-lista', contenedor);
    var form = $('form', contenedor);
    var campo = $('textarea', form);
    var enviar = $('.btn-enviar', form);
    var contador = $('[data-n]', form);
    var comentarios = [];

    function pintar() {
      if (!comentarios.length) {
        lista.innerHTML = '<li class="estado-vista" style="padding:28px 12px"><span class="ev-icono">' + ic('burbujas') + '</span><h3>' + esc(T('comentarios.vacioTitulo')) + '</h3><p>' + esc(T('comentarios.vacioTexto')) + '</p></li>';
      } else {
        lista.innerHTML = comentarios.map(htmlComentario).join('');
      }
      ponerContador(id, 'comentarios', comentarios.length);
    }
    lista.innerHTML = '<li class="cargando"><span class="cargando-focos"><span style="--i:0"></span><span style="--i:1"></span><span style="--i:2"></span><span style="--i:3"></span><span style="--i:4"></span></span></li>';
    function cargar() {
      return api('/comentarios/' + encodeURIComponent(id)).then(function (r) {
        if (!r.ok) { lista.innerHTML = '<li class="aviso-error">' + esc(T('comentarios.errorCargar')) + '</li>'; return; }
        comentarios = r.datos.comentarios || [];
        pintar();
      });
    }
    var primeraCarga = false;
    Colima.sesionLista.then(function () { primeraCarga = true; return cargar(); });

    function ajustarAlto() { campo.style.height = 'auto'; campo.style.height = Math.min(campo.scrollHeight, 160) + 'px'; }
    campo.addEventListener('input', function () {
      contador.textContent = String(campo.value.length);
      enviar.disabled = !campo.value.trim();
      ajustarAlto();
    });
    // Escribir exige sesión: al enfocar sin sesión se ofrece iniciarla.
    campo.addEventListener('focus', function () {
      if (Colima.usuario()) return;
      campo.blur();
      Colima.requerirSesion('pitchComentar').then(function (ok) { if (ok) { campo.focus(); cargar(); } });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var texto = campo.value.trim();
      if (!texto) return;
      if (texto.length > LIMITE_COMENTARIO) return Colima.toast(T('comentarios.limite'));
      enviar.disabled = true;
      api('/comentarios/' + encodeURIComponent(id), { metodo: 'POST', cuerpo: { contenido: texto } }).then(function (r) {
        if (!r.ok || !r.datos.comentario) { enviar.disabled = false; return Colima.toast(r.error || T('comentarios.errorEnviar')); }
        comentarios.push(r.datos.comentario);
        campo.value = ''; contador.textContent = '0'; ajustarAlto();
        pintar();
        Colima.toast(T('comentarios.publicado'));
        var ultimo = lista.lastElementChild; if (ultimo && ultimo.scrollIntoView) ultimo.scrollIntoView({ block: 'nearest' });
      });
    });
    lista.addEventListener('click', function (e) {
      var b = e.target.closest('[data-borrar]');
      if (!b) return;
      var idComentario = b.dataset.borrar;
      b.disabled = true;
      api('/comentarios/' + encodeURIComponent(id) + '/' + encodeURIComponent(idComentario), { metodo: 'DELETE' }).then(function (r) {
        if (!r.ok) { b.disabled = false; return Colima.toast(r.error || T('comentarios.errorBorrar')); }
        comentarios = comentarios.filter(function (c) { return c.id !== idComentario; });
        pintar();
        Colima.toast(T('comentarios.borrado'));
      });
    });
    // Al iniciar o cerrar sesión cambia cuáles comentarios son propios.
    Colima.alCambiarSesion(function () { if (primeraCarga && contenedor.isConnected) cargar(); });
  }

  function abrirComentarios(id) {
    var cuerpo = document.createElement('div');
    Colima.hoja({ id: 'dlg-comentarios', titulo: T('comentarios.titulo'), cuerpo: cuerpo });
    montarComentarios(cuerpo, id);
  }

  // ---------- Reportar y ocultar ----------
  function abrirReporte(id, tipo) {
    var motivos = T('reportar.motivos');
    var motivosEs = T('reportar.motivosEs');
    if (!Array.isArray(motivos)) return;
    if (!Array.isArray(motivosEs)) motivosEs = motivos;
    var cuerpo = document.createElement('form');
    cuerpo.noValidate = true;
    cuerpo.innerHTML =
      '<fieldset style="border:0;padding:0;margin:0 0 16px"><legend class="campo-etiqueta tablilla" style="font-size:14px;color:var(--tinta-suave);margin-bottom:8px">' + esc(T('reportar.motivo')) + '</legend>' +
      '<div class="opciones">' + motivos.map(function (m, i) {
        return '<label class="opcion"><input type="radio" name="motivo" value="' + i + '" /><span>' + esc(m) + '</span></label>';
      }).join('') + '</div></fieldset>' +
      '<div class="campo"><label for="rep-texto">' + esc(T('reportar.otro')) + '</label>' +
      '<textarea id="rep-texto" maxlength="' + LIMITE_REPORTE + '"></textarea></div>' +
      '<p class="aviso-error" role="alert" hidden></p>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn-pintado btn-bandera" type="submit"><span>' + esc(T('reportar.enviar')) + '</span></button></div>';
    var d = Colima.hoja({ id: 'dlg-reporte', titulo: T('reportar.titulo'), cuerpo: cuerpo });
    var error = $('.aviso-error', cuerpo);
    cuerpo.addEventListener('submit', function (e) {
      e.preventDefault();
      var elegido = $('input[name="motivo"]:checked', cuerpo);
      var libre = $('#rep-texto', cuerpo).value.trim();
      var texto = (elegido ? motivosEs[Number(elegido.value)] : '') + (elegido && libre ? ' — ' : '') + libre;
      if (!texto) { error.textContent = T('reportar.vacio'); error.hidden = false; return; }
      if (texto.length > LIMITE_REPORTE) { error.textContent = T('reportar.limite'); error.hidden = false; return; }
      var enviar = $('button[type="submit"]', cuerpo);
      enviar.disabled = true;
      api('/reportar', { metodo: 'POST', cuerpo: { idReport: id, tipo: tipo || 'post', texto: texto } }).then(function (r) {
        if (!r.ok) { enviar.disabled = false; error.textContent = r.error || T('reportar.error'); error.hidden = false; return; }
        Colima.toast(T('reportar.enviado'));
        Colima.cerrarHoja(d);
      });
    });
  }
  // El feed que sirve el servidor es el público (misma versión para todos), así
  // que no respeta lo que cada persona ocultó: se recuerda en este navegador.
  var CLAVE_OCULTOS = 'colimago-ocultos';
  function ocultosGuardados() {
    try { var l = JSON.parse(Colima.leer(CLAVE_OCULTOS) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
  }
  function aplicarOcultos(raizBusqueda) {
    var ids = ocultosGuardados();
    if (!ids.length) return;
    $$('[data-post]', raizBusqueda).forEach(function (el) { if (ids.indexOf(el.dataset.post) >= 0) el.remove(); });
  }
  function ocultarPost(id) {
    api('/ocultar', { metodo: 'POST', cuerpo: { idPost: id } }).then(function (r) {
      if (!r.ok) return Colima.toast(r.error || T('ocultar.error'));
      var ids = ocultosGuardados();
      if (ids.indexOf(id) < 0) { ids.push(id); Colima.guardar(CLAVE_OCULTOS, JSON.stringify(ids.slice(-300))); }
      $$('[data-post="' + id + '"]').forEach(function (el) { el.remove(); });
      Colima.toast(T('ocultar.listo'));
    });
  }

  // Menú flotante de la tarjeta: Reportar / Ocultar publicación.
  var menuAbierto = null;
  function cerrarMenu() { if (menuAbierto) { menuAbierto.remove(); menuAbierto = null; } }
  function abrirMenu(boton) {
    cerrarMenu();
    var id = boton.dataset.id;
    var menu = document.createElement('div');
    menu.className = 'menu-flotante';
    menu.setAttribute('role', 'menu');
    menu.innerHTML =
      '<button type="button" role="menuitem" data-m="reportar">' + ic('bandera') + '<span>' + esc(T('menu.reportar')) + '</span></button>' +
      (boton.dataset.sinOcultar ? '' : '<button type="button" role="menuitem" data-m="ocultar">' + ic('ojo-tachado') + '<span>' + esc(T('menu.ocultar')) + '</span></button>');
    document.body.appendChild(menu);
    var r = boton.getBoundingClientRect();
    var ancho = menu.offsetWidth;
    menu.style.top = (window.scrollY + r.bottom + 6) + 'px';
    menu.style.left = Math.max(8, Math.min(window.scrollX + r.right - ancho, window.scrollX + document.documentElement.clientWidth - ancho - 8)) + 'px';
    var primero = $('button', menu); if (primero) primero.focus();
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]');
      if (!b) return;
      cerrarMenu();
      Colima.requerirSesion('pitchAcciones').then(function (ok) {
        if (!ok) return;
        if (b.dataset.m === 'reportar') abrirReporte(id, 'post');
        else ocultarPost(id);
      });
    });
    menuAbierto = menu;
  }
  document.addEventListener('click', function (e) { if (menuAbierto && !menuAbierto.contains(e.target) && !e.target.closest('[data-accion="menu-post"]')) cerrarMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarMenu(); });
  window.addEventListener('scroll', cerrarMenu, { passive: true });

  // ---------- Vistas: una por publicación y sesión de navegación ----------
  function registrarVista(id) {
    var clave = 'colimago-vista-' + id;
    try { if (sessionStorage.getItem(clave)) return; sessionStorage.setItem(clave, '1'); } catch (e) { /* sin sessionStorage: se cuenta una vez por carga */ }
    api('/vista/' + encodeURIComponent(id), { metodo: 'POST', cuerpo: {} });
  }

  // ---------- Eventos delegados ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-accion]');
    if (!b) return;
    switch (b.dataset.accion) {
      case 'me-gusta': e.preventDefault(); alternarMeGusta(b); break;
      case 'comentarios': e.preventDefault(); abrirComentarios(b.dataset.id); break;
      case 'menu-post': e.preventDefault(); abrirMenu(b); break;
      case 'reportar': e.preventDefault(); Colima.requerirSesion('pitchAcciones').then(function (ok) { if (ok) abrirReporte(b.dataset.id, b.dataset.tipo || 'post'); }); break;
      default: break;
    }
  });

  // ---------- Arranque ----------
  aplicarOcultos();
  $$('[data-comentarios-inline][data-id]').forEach(function (c) { montarComentarios(c, c.dataset.id); });
  $$('[data-registrar-vista]').forEach(function (el) { registrarVista(el.dataset.registrarVista); });
  var arrancado = false;
  Colima.sesionLista.then(function () { arrancado = true; cargarMetricas(); });
  Colima.alCambiarSesion(function (u) {
    if (!arrancado) return; // la primera carga ya lo hace
    if (u) cargarMetricas();
    else $$('[data-accion="me-gusta"]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
  });

  Colima.social = { aplicarOcultos: aplicarOcultos, montarComentarios: montarComentarios, abrirComentarios: abrirComentarios, abrirReporte: abrirReporte, registrarVista: registrarVista, cargarMetricas: cargarMetricas };
})();
