/* Guía web de Colima Go — núcleo del navegador.
   Tema, guirnaldas, entrada al hacer scroll, avisos, sesión con Google,
   favoritos (en el navegador y en la cuenta), compartir, hojas y diálogos.
   Se expone como window.Colima para social.js y los scripts de cada página.
   Sin dependencias. El HTML funciona sin este script: aquí solo se completa
   lo que depende de la persona. */
(function () {
  'use strict';

  var C = window.COLIMAGO || {};
  var raiz = document.documentElement;
  var reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- Textos del cliente (data/i18n/<idioma>/cliente.json) ----------
  function T(clave, vars) {
    var v = String(clave).split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, C.textos || {});
    if (typeof v !== 'string') return v == null ? clave : v;
    return vars ? v.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; }) : v;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function ic(nombre, clase) {
    return '<svg class="ic' + (clase ? ' ' + clase : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + nombre + '"/></svg>';
  }
  function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ } }
  function leer(clave) { try { return localStorage.getItem(clave); } catch (e) { return null; } }
  function borrar(clave) { try { localStorage.removeItem(clave); } catch (e) { /* sin almacenamiento */ } }

  // ---------- Tema: claro / oscuro, con preferencia del sistema y memoria ----------
  var interruptor = document.getElementById('interruptor');
  var sistemaOscuro = window.matchMedia('(prefers-color-scheme: dark)');
  function temaActual() { return raiz.dataset.tema || (sistemaOscuro.matches ? 'oscuro' : 'claro'); }
  function pintarInterruptor() {
    if (!interruptor) return;
    var oscuro = temaActual() === 'oscuro';
    interruptor.setAttribute('aria-label', oscuro ? interruptor.dataset.ariaClaro : interruptor.dataset.ariaOscuro);
    interruptor.setAttribute('aria-pressed', String(oscuro));
  }
  if (interruptor) {
    interruptor.addEventListener('click', function () {
      var siguiente = temaActual() === 'oscuro' ? 'claro' : 'oscuro';
      raiz.dataset.tema = siguiente;
      guardar('colimago-tema', siguiente);
      pintarInterruptor();
      document.dispatchEvent(new CustomEvent('colimago:tema', { detail: siguiente }));
    });
    sistemaOscuro.addEventListener('change', pintarInterruptor);
    pintarInterruptor();
  }
  // Apariencia con tres estados (Sistema / Noche / Día), para Ajustes.
  function fijarTema(modo) {
    if (modo === 'sistema') { delete raiz.dataset.tema; borrar('colimago-tema'); }
    else { raiz.dataset.tema = modo; guardar('colimago-tema', modo); }
    pintarInterruptor();
    document.dispatchEvent(new CustomEvent('colimago:tema', { detail: temaActual() }));
  }
  function modoTema() { var t = leer('colimago-tema'); return t === 'claro' || t === 'oscuro' ? t : 'sistema'; }

  // ---------- Guirnaldas: un cable con focos, colgado en catenaria ----------
  // y(x) = 4·comba·x·(1−x), en la misma escala que el SVG del cable.
  // Un foco cada ~38px, para que no se amontonen en pantallas angostas.
  function tenderGuirnaldas(raizBusqueda) {
    $$('.guirnalda', raizBusqueda).forEach(function (g) {
      var ancho = g.clientWidth;
      if (!ancho || g._ancho === ancho) return;
      g._ancho = ancho;
      var n = Math.max(8, Math.min(Number(g.dataset.focos) || 30, Math.round(ancho / 38)));
      var comba = Number(g.dataset.comba) || 0.5;
      g.innerHTML = '<svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0,0 Q500,' + (comba * 200) + ' 1000,0"/></svg>';
      for (var i = 0; i < n; i++) {
        var x = (i + 0.5) / n;
        var foco = document.createElement('span');
        foco.className = 'foco';
        foco.style.left = (x * 100) + '%';
        foco.style.top = (4 * comba * x * (1 - x) * 100) + '%';
        foco.style.setProperty('--i', i);
        g.appendChild(foco);
      }
      if (observadorEntrada && !g.classList.contains('encendida')) observadorEntrada.observe(g);
    });
  }
  // Cada letrero cuelga de su cable con dos cuerdas; su largo se calcula para
  // tocar el cable en esa x. Sirve a todo lo que lleve .letrero-colgante.
  function colgarLetreros(raizBusqueda) {
    $$('.letrero-colgante', raizBusqueda).forEach(function (hEl) {
      var zona = hEl.closest('[data-cable]');
      var cable = zona && $('.guirnalda', zona);
      if (!cable) return;
      var c = cable.getBoundingClientRect();
      var caja = hEl.getBoundingClientRect();
      if (!c.width) return;
      var comba = Number(cable.dataset.comba) || 0.5;
      // El giro mueve la caja; se mide sin él para que la cuerda no salga corta.
      var cuerdas = [0.14, 0.86].map(function (f) {
        var x = Math.min(1, Math.max(0, (caja.left + caja.width * f - c.left) / c.width));
        return caja.top - (c.top + 4 * comba * x * (1 - x) * c.height);
      });
      hEl.style.setProperty('--cuerda', Math.max(10, Math.round(Math.min.apply(null, cuerdas))));
    });
  }

  // ---------- Al entrar en pantalla: se encienden los focos y aparece el contenido ----------
  var observadorEntrada = 'IntersectionObserver' in window ? new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add(e.target.classList.contains('guirnalda') ? 'encendida' : 'visto');
      observadorEntrada.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0 }) : null;
  function observarEntrada(raizBusqueda) {
    $$('.guirnalda, [data-revela]', raizBusqueda).forEach(function (el) {
      if (observadorEntrada) observadorEntrada.observe(el);
      else el.classList.add(el.classList.contains('guirnalda') ? 'encendida' : 'visto');
    });
  }

  function acomodar(raizBusqueda) {
    tenderGuirnaldas(raizBusqueda);
    colgarLetreros(raizBusqueda);
    observarEntrada(raizBusqueda);
  }
  acomodar();
  var esperaTendido;
  window.addEventListener('resize', function () {
    clearTimeout(esperaTendido);
    esperaTendido = setTimeout(function () { tenderGuirnaldas(); colgarLetreros(); document.dispatchEvent(new CustomEvent('colimago:redimension')); }, 120);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { colgarLetreros(); });

  // ---------- Barra: sombra al hacer scroll ----------
  var barra = $('.barra');
  if (barra) {
    var alHacerScroll = function () { barra.classList.toggle('con-sombra', window.scrollY > 8); };
    window.addEventListener('scroll', alHacerScroll, { passive: true });
    alHacerScroll();
  }

  // ---------- Avisos breves (toast) ----------
  var contenedorToasts = document.getElementById('toasts');
  function toast(texto, opciones) {
    if (!contenedorToasts || !texto) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="foco-solo encendido" aria-hidden="true"></span><span>' + esc(texto) + '</span>';
    contenedorToasts.appendChild(el);
    var duracion = (opciones && opciones.duracion) || 2600;
    setTimeout(function () { el.classList.add('sale'); setTimeout(function () { el.remove(); }, 260); }, duracion);
  }

  // ---------- Llamadas a /g/* (el navegador nunca habla con el backend) ----------
  var usuario = null;
  function api(ruta, opciones) {
    opciones = opciones || {};
    var init = { method: opciones.metodo || 'GET', headers: { 'X-Requested-With': 'colimago', 'Accept': 'application/json' }, credentials: 'same-origin' };
    if (opciones.cuerpo !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opciones.cuerpo);
    }
    return fetch('/g' + ruta, init).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (datos) {
        if (res.status === 401 && datos && datos.sesionExpirada) { fijarUsuario(null); toast(T('login.expirada')); }
        return { ok: res.ok, status: res.status, datos: datos || {}, error: datos && datos.error };
      });
    }, function () {
      return { ok: false, status: 0, datos: {}, error: T('sinConexion') };
    });
  }
  function mensajeError(r) {
    if (r.status === 429) return T('demasiadas');
    return r.error || T('errorGenerico');
  }

  // ---------- Sesión ----------
  var escuchasSesion = [];
  function pintarUsuario() {
    var btn = document.getElementById('btn-usuario');
    if (!btn) return;
    if (usuario) {
      btn.classList.add('con-sesion');
      btn.setAttribute('aria-label', usuario.nombre || T('login.titulo'));
      btn.innerHTML = usuario.img ? '<img src="' + esc(usuario.img) + '" alt="" referrerpolicy="no-referrer" width="40" height="40" />' : ic('usuario');
    } else {
      btn.classList.remove('con-sesion');
      btn.innerHTML = ic('usuario');
    }
  }
  function fijarUsuario(u) {
    var cambio = JSON.stringify(u) !== JSON.stringify(usuario);
    usuario = u;
    if (u) guardar('colimago-usuario', JSON.stringify({ nombre: u.nombre, img: u.img }));
    else borrar('colimago-usuario');
    pintarUsuario();
    if (cambio) {
      escuchasSesion.forEach(function (cb) { try { cb(usuario); } catch (e) { /* un oyente no rompe a los demás */ } });
      document.dispatchEvent(new CustomEvent('colimago:sesion', { detail: usuario }));
    }
  }
  function alCambiarSesion(cb) { escuchasSesion.push(cb); if (usuario !== null) cb(usuario); }
  // Solo se consulta al servidor si este navegador ya inició sesión alguna vez.
  var pistaUsuario = leer('colimago-usuario');
  var sesionLista = new Promise(function (resolver) {
    if (!pistaUsuario) { resolver(null); return; }
    try { var p = JSON.parse(pistaUsuario); usuario = { nombre: p.nombre, img: p.img }; pintarUsuario(); } catch (e) { /* pista dañada */ }
    api('/sesion').then(function (r) {
      var u = r.ok && r.datos.usuario ? r.datos.usuario : null;
      usuario = null; // fuerza el aviso a los oyentes con el dato real
      fijarUsuario(u);
      resolver(u);
    });
  });

  // ---------- Hojas (diálogos nativos) ----------
  function cerrarHoja(d) { if (d.open) d.close(); }
  function hoja(opciones) {
    var id = opciones.id;
    var previa = id && document.getElementById(id);
    if (previa) previa.remove();
    var d = document.createElement('dialog');
    d.className = 'hoja' + (opciones.ancha ? ' hoja-ancha' : '');
    if (id) d.id = id;
    var tituloId = (id || 'hoja') + '-titulo';
    d.setAttribute('aria-labelledby', tituloId);
    d.innerHTML = '<div class="hoja-asa" aria-hidden="true"></div>' +
      '<div class="hoja-cabeza"><h2 id="' + tituloId + '">' + esc(opciones.titulo || '') + '</h2>' +
      '<button class="hoja-cerrar" type="button" aria-label="' + esc(T('cerrar')) + '">' + ic('cerrar') + '</button></div>' +
      '<div class="hoja-cuerpo"></div>';
    var cuerpo = $('.hoja-cuerpo', d);
    if (typeof opciones.cuerpo === 'string') cuerpo.innerHTML = opciones.cuerpo;
    else if (opciones.cuerpo) cuerpo.appendChild(opciones.cuerpo);
    $('.hoja-cerrar', d).addEventListener('click', function () { cerrarHoja(d); });
    d.addEventListener('click', function (e) { if (e.target === d) cerrarHoja(d); });
    d.addEventListener('close', function () {
      if (!$('dialog.hoja[open]')) document.body.classList.remove('hoja-abierta');
      if (opciones.alCerrar) opciones.alCerrar(d);
      setTimeout(function () { d.remove(); }, 50);
    });
    document.body.appendChild(d);
    d.showModal();
    document.body.classList.add('hoja-abierta');
    return d;
  }

  // Confirmación: devuelve una promesa con true (aceptó) o false.
  function confirmar(opciones) {
    return new Promise(function (resolver) {
      var cuerpo = document.createElement('div');
      cuerpo.innerHTML = '<p style="color:var(--tinta-suave);margin-bottom:20px">' + esc(opciones.texto || '') + '</p>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">' +
        '<button class="btn-contorno" type="button" data-r="no">' + esc(opciones.cancelar || T('cancelar')) + '</button>' +
        '<button class="btn-pintado ' + (opciones.peligro ? 'btn-bandera' : '') + ' btn-chico" type="button" data-r="si"><span>' + esc(opciones.aceptar) + '</span></button></div>';
      var decidido = false;
      var d = hoja({ id: 'dlg-confirmar', titulo: opciones.titulo, cuerpo: cuerpo, alCerrar: function () { if (!decidido) resolver(false); } });
      cuerpo.addEventListener('click', function (e) {
        var b = e.target.closest('[data-r]');
        if (!b) return;
        decidido = true; resolver(b.dataset.r === 'si'); cerrarHoja(d);
      });
    });
  }

  // ---------- Login con Google ----------
  var scriptGoogle = null;
  function cargarGoogle() {
    if (window.google && window.google.accounts) return Promise.resolve();
    if (scriptGoogle) return scriptGoogle;
    scriptGoogle = new Promise(function (resolver, rechazar) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = resolver;
      s.onerror = function () { scriptGoogle = null; rechazar(new Error('google')); };
      document.head.appendChild(s);
    });
    return scriptGoogle;
  }

  var resolviendoLogin = null;
  // Abre la hoja de inicio de sesión. Devuelve una promesa: true si la persona
  // quedó con sesión, false si cerró la hoja.
  function iniciarSesion(motivo) {
    if (usuario) return Promise.resolve(true);
    return new Promise(function (resolver) {
      var terminado = false;
      function terminar(valor) { if (terminado) return; terminado = true; resolver(valor); }
      var l = C.legales || {};
      var cuerpo = document.createElement('div');
      cuerpo.className = 'login-hoja';
      cuerpo.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding:6px 0 4px">' +
        '<span class="perro" style="width:54px;height:54px;background:var(--acento-texto)" aria-hidden="true"></span>' +
        '<p style="color:var(--tinta-suave);max-width:28em">' + esc(motivo || T('pitchGeneral')) + '</p>' +
        '<div id="google-btn-wrap" style="min-height:44px;display:flex;justify-content:center"></div>' +
        '<p class="aviso-error" id="login-error" role="alert" hidden></p>' +
        '<p id="login-cargando" role="status" class="nota" hidden>' + esc(T('login.cargando')) + '</p>' +
        '<p class="nota" style="max-width:30em">' + esc(T('login.aceptoPre')) + ' <a href="' + esc(l.privacidad || '#') + '" target="_blank" rel="noopener">' + esc(T('login.politicas')) + '</a>, ' +
        '<a href="' + esc(l.condiciones || '#') + '" target="_blank" rel="noopener">' + esc(T('login.condiciones')) + '</a> ' + esc(T('login.y')) + ' <a href="' + esc(l.eula || '#') + '" target="_blank" rel="noopener">EULA</a>.</p></div>';
      var d = hoja({ id: 'dlg-login', titulo: T('login.titulo'), cuerpo: cuerpo, alCerrar: function () { terminar(!!usuario); } });
      var error = $('#login-error', cuerpo);
      var cargando = $('#login-cargando', cuerpo);
      function fallo(mensaje) { cargando.hidden = true; error.textContent = mensaje; error.hidden = false; }

      cargarGoogle().then(function () {
        window.google.accounts.id.initialize({
          client_id: C.googleClientId,
          callback: function (respuesta) {
            error.hidden = true; cargando.hidden = false;
            api('/login/google', { metodo: 'POST', cuerpo: { credential: respuesta.credential } }).then(function (r) {
              if (!r.ok || !r.datos.usuario) return fallo(r.status === 429 ? T('demasiadas') : (r.error || T('login.error')));
              fijarUsuario(r.datos.usuario);
              toast(T('login.bienvenido', { nombre: r.datos.usuario.nombre || '' }));
              sincronizarFavoritos();
              terminar(true);
              cerrarHoja(d);
            });
          },
        });
        window.google.accounts.id.renderButton($('#google-btn-wrap', cuerpo), {
          type: 'standard', theme: temaActual() === 'oscuro' ? 'filled_black' : 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: C.lang,
        });
      }).catch(function () { fallo(T('login.bloqueado')); });
    });
  }
  // Para acciones que exigen sesión: pide login con su propio motivo.
  function requerirSesion(motivoClave) {
    if (usuario) return Promise.resolve(true);
    return iniciarSesion(T(motivoClave || 'pitchAcciones'));
  }
  function cerrarSesion() {
    return api('/logout', { metodo: 'POST', cuerpo: {} }).then(function () {
      fijarUsuario(null);
      Favoritos.vaciarLocal();
      try { if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect(); } catch (e) { /* sin GIS */ }
      toast(T('login.cerrada'));
    });
  }

  // ---------- Favoritos: localStorage + cuenta ----------
  // Registro: { id, titulo, imagen, tipo: 'lugar' | 'evento', esPortada, fecha }.
  // Sin sesión viven solo en este navegador; con sesión también en la cuenta,
  // y al iniciar sesión se fusionan con los de la cuenta.
  var CLAVE_FAV = 'colimago-favoritos';
  var Favoritos = {
    lista: function () {
      try { var l = JSON.parse(leer(CLAVE_FAV) || '[]'); return Array.isArray(l) ? l.filter(function (f) { return f && f.id; }) : []; } catch (e) { return []; }
    },
    guardarLista: function (lista) { guardar(CLAVE_FAV, JSON.stringify(lista)); pintarFavoritos(); document.dispatchEvent(new CustomEvent('colimago:favoritos', { detail: lista })); },
    tiene: function (id) { return Favoritos.lista().some(function (f) { return f.id === id; }); },
    vaciarLocal: function () { Favoritos.guardarLista([]); },
    agregar: function (item) {
      var lista = Favoritos.lista();
      if (!lista.some(function (f) { return f.id === item.id; })) { lista.unshift(item); Favoritos.guardarLista(lista); }
      if (!usuario) return Promise.resolve(true);
      return api('/favoritos', { metodo: 'POST', cuerpo: { idPost: item.id } }).then(function (r) {
        if (r.ok) return true;
        Favoritos.quitarLocal(item.id); toast(mensajeError(r)); return false;
      });
    },
    quitarLocal: function (id) { Favoritos.guardarLista(Favoritos.lista().filter(function (f) { return f.id !== id; })); },
    quitar: function (id) {
      var anterior = Favoritos.lista();
      Favoritos.quitarLocal(id);
      if (!usuario) return Promise.resolve(true);
      return api('/favoritos/' + encodeURIComponent(id), { metodo: 'DELETE' }).then(function (r) {
        if (r.ok) return true;
        Favoritos.guardarLista(anterior); toast(mensajeError(r)); return false;
      });
    },
    // Trae la lista de la cuenta (subiendo antes los favoritos de este navegador).
    sincronizar: function () { return sincronizarFavoritos(); },
  };
  function imagenFavoritoDeCuenta(f) {
    if (!f.imagen) return '';
    if (f.tipo === 'lugar') return /^(\/|https?:)/.test(f.imagen) ? f.imagen : '/img/l/' + f.imagen + '-480.webp';
    return f.imagen;
  }
  function sincronizarFavoritos() {
    if (!usuario) return Promise.resolve(Favoritos.lista());
    var ids = Favoritos.lista().map(function (f) { return f.id; }).slice(0, 200);
    return api('/favoritos/fusionar', { metodo: 'POST', cuerpo: { ids: ids } }).then(function (r) {
      if (!r.ok || !Array.isArray(r.datos.favoritos)) return Favoritos.lista();
      var lista = r.datos.favoritos.map(function (f) {
        return { id: f.id, titulo: f.titulo, imagen: imagenFavoritoDeCuenta(f), tipo: f.tipo === 'lugar' ? 'lugar' : 'evento', esPortada: !!f.esPortada, fecha: f.fecha ? String(f.fecha).slice(0, 10) : '' };
      });
      Favoritos.guardarLista(lista);
      return lista;
    });
  }
  function pintarFavoritos() {
    var ids = {};
    Favoritos.lista().forEach(function (f) { ids[f.id] = true; });
    $$('[data-favorito]').forEach(function (b) {
      var activo = !!ids[b.dataset.id];
      b.setAttribute('aria-pressed', String(activo));
      b.setAttribute('aria-label', activo ? (b.dataset.etiquetaQuitar || T('favoritos.quitarTitulo')) : (b.dataset.etiquetaGuardar || b.getAttribute('aria-label')));
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-favorito]');
    if (!b) return;
    e.preventDefault();
    var id = b.dataset.id;
    if (Favoritos.tiene(id)) {
      Favoritos.quitar(id).then(function (ok) { if (ok) toast(T('favoritoQuitado')); });
    } else {
      Favoritos.agregar({
        id: id, titulo: b.dataset.titulo || '', imagen: b.dataset.imagen || '', tipo: b.dataset.tipo === 'evento' ? 'evento' : 'lugar',
        esPortada: b.dataset.portada === '1', fecha: b.dataset.fecha || '',
      }).then(function (ok) { if (ok) toast(T('favoritoAgregado')); });
    }
  });
  window.addEventListener('storage', function (e) { if (e.key === CLAVE_FAV) pintarFavoritos(); });

  // ---------- Compartir ----------
  function urlConUtm(url, campana) {
    try {
      var u = new URL(url, location.origin);
      if (!u.searchParams.has('utm_source')) { u.searchParams.set('utm_source', 'web'); u.searchParams.set('utm_medium', 'share'); if (campana) u.searchParams.set('utm_campaign', campana); }
      return u.toString();
    } catch (e) { return url; }
  }
  function compartir(datos) {
    var url = urlConUtm(datos.url || location.href, datos.campana);
    var titulo = datos.titulo || document.title;
    var texto = datos.texto || titulo;
    var movil = window.matchMedia('(pointer: coarse)').matches;
    if (navigator.share && movil) {
      return navigator.share({ title: titulo, text: texto, url: url }).catch(function () { /* cerrar la hoja no es un error */ });
    }
    var mensaje = texto + ' ' + url;
    var enlaces = [
      { clave: 'whatsapp', href: 'https://wa.me/?text=' + encodeURIComponent(mensaje), icono: 'whatsapp' },
      { clave: 'facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), icono: 'facebook' },
      { clave: 'x', href: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(texto) + '&url=' + encodeURIComponent(url), icono: 'externo' },
      { clave: 'correo', href: 'mailto:?subject=' + encodeURIComponent(titulo) + '&body=' + encodeURIComponent(mensaje), icono: 'correo' },
    ];
    var cuerpo = document.createElement('div');
    cuerpo.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px">' +
      enlaces.map(function (a) { return '<a class="btn-contorno" target="_blank" rel="noopener" href="' + esc(a.href) + '">' + ic(a.icono) + '<span>' + esc(T('compartir.' + a.clave)) + '</span></a>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:8px"><input type="text" readonly value="' + esc(url) + '" aria-label="URL" style="flex:1" />' +
      '<button class="btn-contorno" type="button" data-copiar>' + ic('copiar') + '<span>' + esc(T('compartir.copiar')) + '</span></button></div>';
    var d = hoja({ id: 'dlg-compartir', titulo: T('compartir.titulo'), cuerpo: cuerpo });
    $('input', cuerpo).addEventListener('focus', function (e) { e.target.select(); });
    $('[data-copiar]', cuerpo).addEventListener('click', function () {
      var listo = function () { toast(T('compartir.copiado')); cerrarHoja(d); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(listo, function () { $('input', cuerpo).select(); });
      else { $('input', cuerpo).select(); document.execCommand && document.execCommand('copy'); listo(); }
    });
    return Promise.resolve();
  }

  // ---------- Acciones delegadas: compartir, iniciar y cerrar sesión ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-accion]');
    if (!b) return;
    var accion = b.dataset.accion;
    if (accion === 'compartir') {
      e.preventDefault();
      compartir({ url: b.dataset.url, titulo: b.dataset.titulo, texto: b.dataset.texto, campana: b.dataset.campana });
    } else if (accion === 'iniciar-sesion') {
      e.preventDefault();
      iniciarSesion(b.dataset.motivo ? T(b.dataset.motivo) : null);
    } else if (accion === 'cerrar-sesion') {
      e.preventDefault();
      cerrarSesion();
    }
  });

  // ---------- Anuncios de AdSense: se piden al acercarse a la pantalla ----------
  if (C.anuncios && 'IntersectionObserver' in window) {
    var observadorAnuncios = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        observadorAnuncios.unobserve(e.target);
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (err) { /* sin anuncio: el espacio queda reservado */ }
      });
    }, { rootMargin: '600px 0px' });
    $$('ins.adsbygoogle').forEach(function (el) { observadorAnuncios.observe(el); });
  }

  // ---------- Utilidades para los demás scripts ----------
  pintarFavoritos();
  window.Colima = {
    T: T, esc: esc, ic: ic, $: $, $$: $$, api: api, mensajeError: mensajeError, toast: toast,
    usuario: function () { return usuario; }, sesionLista: sesionLista, alCambiarSesion: alCambiarSesion,
    iniciarSesion: iniciarSesion, requerirSesion: requerirSesion, cerrarSesion: cerrarSesion,
    hoja: hoja, cerrarHoja: cerrarHoja, confirmar: confirmar, compartir: compartir,
    favoritos: Favoritos, pintarFavoritos: pintarFavoritos,
    temaActual: temaActual, fijarTema: fijarTema, modoTema: modoTema,
    acomodar: acomodar, tenderGuirnaldas: tenderGuirnaldas, colgarLetreros: colgarLetreros,
    reducirMovimiento: reducirMovimiento, guardar: guardar, leer: leer,
  };
  document.dispatchEvent(new CustomEvent('colimago:listo'));
})();
