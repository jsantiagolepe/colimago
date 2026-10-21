/* Explorar — mejoras del feed. El HTML ya funciona sin este script (filtros y
   páginas son enlaces; el texto sale completo). Aquí:
   · texto colapsado a 2 líneas con "Ver más" (ExpandableText de la app);
   · "Ver más" trae la página siguiente con fetch, toma de ella el contenedor
     del feed (DOMParser) y lo añade, sin recargar ni tocar el servidor. */
(function () {
  'use strict';
  var Colima = window.Colima;
  if (!Colima) return;
  var $ = Colima.$, $$ = Colima.$$;

  // ---------- Texto colapsable ----------
  function medir(caja) {
    var cuerpo = $('.post-texto-cuerpo', caja);
    var boton = $('.post-ver-mas', caja);
    if (!cuerpo || !boton) return;
    // Abierto: el botón sigue visible para poder cerrarlo. Cerrado: solo si el texto se corta.
    boton.hidden = caja.classList.contains('abierto') ? false : !(cuerpo.scrollHeight > cuerpo.clientHeight + 1);
  }
  function prepararTextos(raiz) {
    $$('[data-texto]', raiz).forEach(function (caja) {
      if (caja._listo) return;
      caja._listo = true;
      var boton = $('.post-ver-mas', caja);
      if (!boton) return;
      boton.addEventListener('click', function () {
        var abierto = caja.classList.toggle('abierto');
        boton.setAttribute('aria-expanded', String(abierto));
        boton.textContent = abierto ? boton.dataset.menos : boton.dataset.mas;
      });
      medir(caja);
    });
  }
  function medirTodos() { $$('[data-texto]').forEach(medir); }

  // ---------- Ver más: trae la página siguiente ----------
  function pedirAnuncios(raiz) {
    // core.js solo pide los anuncios de AdSense que había al cargar la página.
    if (!(window.COLIMAGO || {}).anuncios) return;
    $$('ins.adsbygoogle:not([data-adsbygoogle-status])', raiz).forEach(function () {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* el espacio queda reservado */ }
    });
  }

  function verMas(enlace) {
    if (enlace.getAttribute('aria-busy') === 'true') return;
    enlace.setAttribute('aria-busy', 'true');
    fetch(enlace.href, { credentials: 'same-origin', headers: { 'X-Requested-With': 'colimago' } })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var nuevo = $('[data-feed]', doc);
        var actual = $('[data-feed]');
        if (!nuevo || !actual) throw new Error('sin feed');
        var primero = null;
        Array.prototype.slice.call(nuevo.children).forEach(function (hijo) {
          var nodo = document.importNode(hijo, true);
          actual.appendChild(nodo);
          if (!primero && nodo.matches('.post')) primero = nodo;
        });
        var paginasActual = $('.feed-paginas');
        var paginasNuevo = $('.feed-paginas', doc);
        if (paginasActual) {
          if (paginasNuevo) {
            var nuevaNav = document.importNode(paginasNuevo, true);
            // Las páginas anteriores ya están arriba: "Anteriores" sobra
            var anterior = $('[rel="prev"]', nuevaNav);
            if (anterior) anterior.remove();
            paginasActual.replaceWith(nuevaNav);
          } else paginasActual.remove();
        }
        // Lo que ya sabe hacer el resto de la guía, sobre las tarjetas nuevas
        Colima.pintarFavoritos();
        if (Colima.social) { Colima.social.aplicarOcultos(actual); Colima.social.cargarMetricas(); }
        prepararTextos(actual);
        pedirAnuncios(actual);
        // El botón que tenía el foco ya no existe: el foco pasa a la primera tarjeta nueva
        var titulo = primero && $('.post-titulo a', primero);
        if (titulo) titulo.focus({ preventScroll: false });
      })
      .catch(function () {
        enlace.removeAttribute('aria-busy');
        Colima.toast(Colima.T('errorGenerico'));
      });
  }

  document.addEventListener('click', function (e) {
    var enlace = e.target.closest('[data-ver-mas]');
    if (!enlace || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    verMas(enlace);
  });

  prepararTextos(document);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(medirTodos);
  document.addEventListener('colimago:redimension', medirTodos);
})();
