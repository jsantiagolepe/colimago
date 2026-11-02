/* Analítica anónima de Colima Go: qué página se vio y qué se tocó.
   Nada de esto identifica a una persona. Cada evento va a POST /e de este
   mismo sitio, que le agrega el dispositivo, la ubicación aproximada y un
   hash de visitante que cambia cada día (ver lib/analitica.js), y lo manda al
   backend (colección colimago_logs). Sin dependencias; un fallo nunca se nota.

   Un click solo cuenta si cae en un enlace a las tiendas de la app, Mercado
   Libre, mapas, WhatsApp, redes, teléfono o correo, o en un elemento con
   data-track="nombre". El dónde sale de data-place del elemento más cercano,
   del pie o la cabecera, o de la ruta. */
(function () {
  'use strict';

  var ENDPOINT = '/e';
  var PALABRA = /^[a-z0-9_]{1,32}$/;
  var ORIGEN = 'colimago-origen';
  var ORIGEN_TTL_MS = 30 * 60 * 1000;

  // "No rastrear" y Global Privacy Control apagan la analítica.
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  // /login sirve la portada, pero es la entrada del panel: no es una visita.
  if (location.pathname === '/login') return;

  function limpio(valor) {
    var t = (valor || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60);
    return t || undefined;
  }

  // El referrer se reduce a su dominio; un enlace de este mismo sitio no es
  // un origen, ni lo que no es una página web (android-app://...).
  function dominioDe(referrer) {
    try {
      var u = new URL(referrer);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
      var host = u.hostname.toLowerCase();
      return host === location.hostname ? undefined : host;
    } catch (e) { return undefined; }
  }

  function origenDeLaPagina() {
    var p = new URLSearchParams(location.search);
    var o = {
      referrer: dominioDe(document.referrer),
      utmSource: limpio(p.get('utm_source')),
      utmMedium: limpio(p.get('utm_medium')),
      utmCampaign: limpio(p.get('utm_campaign')),
      gclid: p.has('gclid') || undefined,
      fbclid: p.has('fbclid') || undefined
    };
    Object.keys(o).forEach(function (k) { if (o[k] === undefined) delete o[k]; });
    return o;
  }

  // Se decide una vez por carga, con el aterrizaje real: moverse entre páginas
  // sin recargar quita el UTM de la dirección, pero la visita sigue siendo la
  // misma. Un aterrizaje con origen propio (un anuncio, un enlace de otro
  // sitio) reemplaza lo recordado; uno sin origen conserva el de los últimos
  // 30 minutos, para que una ficha abierta en otra pestaña siga siendo del
  // anuncio que trajo a la persona.
  var aterrizaje;
  function origen() {
    if (aterrizaje) return aterrizaje;
    var ahora = Date.now();
    var nuevo = origenDeLaPagina();
    var guardado = null;
    try { guardado = JSON.parse(localStorage.getItem(ORIGEN)); } catch (e) { /* sin almacenamiento */ }

    var elegido;
    if (Object.keys(nuevo).length > 0) elegido = { at: ahora, origen: nuevo };
    else if (guardado && typeof guardado.at === 'number' && guardado.origen && guardado.at <= ahora && ahora - guardado.at < ORIGEN_TTL_MS) elegido = guardado;
    else elegido = { at: ahora, origen: {} };

    try { localStorage.setItem(ORIGEN, JSON.stringify(elegido)); } catch (e) { /* ignorar */ }
    aterrizaje = elegido.origen;
    return aterrizaje;
  }

  function idioma() {
    var l = document.documentElement.lang || '';
    return l.slice(0, 2) === 'en' ? 'en' : l.slice(0, 2) === 'es' ? 'es' : undefined;
  }

  function mandar(evento) {
    var cuerpo = JSON.stringify(evento);
    try {
      // Sobrevive al cierre de la página, que es lo que pasa al tocar un enlace externo.
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([cuerpo], { type: 'application/json' }))) return;
    } catch (e) { /* cae a fetch */ }
    try {
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true }).catch(function () {});
    } catch (e) { /* la analítica nunca avisa de un fallo */ }
  }

  function conOrigen(evento) {
    var o = origen();
    Object.keys(o).forEach(function (k) { evento[k] = o[k]; });
    evento.lang = idioma();
    return evento;
  }

  // ---- Qué significa un click ----

  // Un enlace que sale del sitio, nombrado por lo que es. Lo que no está aquí
  // no vale la pena contarlo (un enlace externo cualquiera).
  function clasificar(href) {
    if (!href) return null;
    if (href.indexOf('tel:') === 0) return 'call';
    if (href.indexOf('mailto:') === 0) return 'email';
    var u;
    try { u = new URL(href); } catch (e) { return null; } // los enlaces relativos son navegación
    var host = u.hostname.replace(/^www\./, '');

    if (host === 'wa.me' || host === 'api.whatsapp.com') {
      // wa.me/?text=... deja elegir a quién se manda; wa.me/<número> escribe a un negocio.
      return u.pathname.replace(/\//g, '') === '' ? 'whatsapp_share' : 'whatsapp_contact';
    }
    if (host === 'apps.apple.com') return 'app_store';
    if (host === 'play.google.com') return 'google_play';
    if (host === 'meli.la' || /(^|\.)mercadolibre\.com(\.mx)?$/.test(host)) return 'mercadolibre';
    if (host === 'maps.apple.com' || host === 'maps.app.goo.gl' || host === 'goo.gl' || (host === 'google.com' && u.pathname.indexOf('/maps') === 0)) return 'maps';
    if (host === 'facebook.com' || /\.facebook\.com$/.test(host)) return u.pathname.indexOf('/sharer') === 0 ? 'facebook_share' : 'facebook_page';
    if (host === 'instagram.com' || /\.instagram\.com$/.test(host)) return 'instagram';
    if (host === 'tiktok.com' || /\.tiktok\.com$/.test(host)) return 'tiktok';
    return null;
  }

  // En qué parte de la página, cuando nada más cercano lo dice.
  function lugarDeRuta(ruta) {
    var r = ruta.replace(/^\/en(?=\/|$)/, '') || '/';
    if (r === '/' || r === '/inicio') return 'home';
    if (/^\/(lugar|place)\//.test(r)) return 'ficha';
    if (/^\/(evento|event)\//.test(r)) return 'evento';
    if (r === '/explorar') return 'explorar';
    if (r === '/mapa') return 'mapa';
    if (r === '/calendario') return 'calendario';
    if (r === '/buscar') return 'buscar';
    return 'otra';
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-track], a[href]');
    if (!el) return;
    var explicito = el.getAttribute('data-track');
    var target = explicito && PALABRA.test(explicito) ? explicito : clasificar(el.getAttribute('href'));
    if (!target) return;

    var cercano = el.closest('[data-place]');
    var lugar = cercano && cercano.getAttribute('data-place');
    if (!lugar || !PALABRA.test(lugar)) lugar = el.closest('footer') ? 'footer' : el.closest('header') ? 'header' : lugarDeRuta(location.pathname);

    mandar(conOrigen({ event: 'click', path: location.pathname, target: target, place: lugar }));
  }, true);

  // ---- Páginas vistas ----

  function vista() { mandar(conOrigen({ event: 'page_view', path: location.pathname })); }
  // Espera a que la página termine de cargar para no competir con ella.
  if (document.readyState === 'complete') vista();
  else window.addEventListener('load', vista);
})();
