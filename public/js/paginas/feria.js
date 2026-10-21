/* Fiestas Charrotaurinas — lo que mejora con JavaScript.
   Sin él la página ya se lee entera: los enlaces del texto y las tablas van a
   sus anclas (#tema-…, dentro de los <details>) y los carteles abren su imagen.
   Con él:
     1. los enlaces del texto y las dos tablas abren una hoja con la foto y el
        texto largo (el mismo contenido que los <details>);
     2. los carteles (y el programa) se amplían en un visor con dialog nativo,
        con flechas, teclado y toque para ver la imagen a su tamaño;
     3. la tira de carteles gana flechas para recorrerla. */
(function () {
  'use strict';

  var Colima = window.Colima;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function icono(nombre) {
    return '<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-' + nombre + '"/></svg>';
  }
  var textos = {};
  try { textos = JSON.parse(($('#feria-textos') || {}).textContent || '{}'); } catch (e) { /* sin textos: el visor usa los de arriba */ }
  function T(clave, vars) {
    var v = textos[clave] || clave;
    return vars ? v.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; }) : v;
  }
  function esClicNormal(e) { return !(e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey); }

  // ---------- 1. Hoja con el contenido de una tradición o un mensaje ----------
  function abrirTema(clave, titulo) {
    var origen = document.getElementById('tema-' + clave);
    if (!origen || !Colima || !Colima.hoja) return false;
    var copia = origen.cloneNode(true);
    copia.removeAttribute('id'); // el original sigue en la página
    Colima.hoja({ id: 'hoja-tema', titulo: titulo, cuerpo: copia, ancha: true });
    return true;
  }
  document.addEventListener('click', function (e) {
    var enlace = e.target.closest('a[data-tema]');
    if (!enlace || !esClicNormal(e)) return;
    var titulo = enlace.dataset.titulo || enlace.textContent.trim();
    if (abrirTema(enlace.dataset.tema, titulo)) e.preventDefault();
  });

  // ---------- 2. Visor de carteles ----------
  var visor = null;
  var grupo = [];
  var indice = 0;
  var abridor = null;

  function crearVisor() {
    var d = document.createElement('dialog');
    d.className = 'visor';
    d.setAttribute('aria-label', T('cerrar'));
    d.innerHTML =
      '<div class="visor-marco">' +
        '<div class="visor-barra"><span class="visor-contador" aria-live="polite"></span>' +
        '<button class="visor-btn visor-cerrar" type="button" aria-label="' + esc(T('cerrar')) + '">' + icono('cerrar') + '</button></div>' +
        '<div class="visor-escena">' +
          '<button class="visor-btn visor-flecha visor-ant" type="button" aria-label="' + esc(T('anterior')) + '">' + icono('chevron-izquierda') + '</button>' +
          '<span class="visor-marcador"></span>' +
          '<button class="visor-btn visor-flecha visor-sig" type="button" aria-label="' + esc(T('siguiente')) + '">' + icono('chevron-derecha') + '</button>' +
        '</div>' +
        '<div class="visor-pie"><p class="visor-titulo"></p><p class="visor-ayuda"></p></div>' +
      '</div>';
    // La imagen se crea aparte: aún no tiene src hasta que se abre un cartel.
    var img = document.createElement('img');
    img.className = 'visor-img';
    img.alt = '';
    $('.visor-marcador', d).replaceWith(img);
    document.body.appendChild(d);

    $('.visor-cerrar', d).addEventListener('click', function () { d.close(); });
    $('.visor-ant', d).addEventListener('click', function () { ir(-1); });
    $('.visor-sig', d).addEventListener('click', function () { ir(1); });
    $('.visor-img', d).addEventListener('click', function () { alternarZoom(d); });
    // Un toque fuera de la imagen (en la escena vacía) cierra.
    $('.visor-escena', d).addEventListener('click', function (e) { if (e.target === e.currentTarget) d.close(); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { ir(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { ir(1); e.preventDefault(); }
    });
    d.addEventListener('close', function () {
      d.classList.remove('ampliada');
      if (!$('dialog[open]')) document.body.classList.remove('hoja-abierta');
      if (abridor && document.contains(abridor)) abridor.focus({ preventScroll: true });
    });
    return d;
  }

  function alternarZoom(d) {
    var ampliada = d.classList.toggle('ampliada');
    $('.visor-ayuda', d).textContent = T(ampliada ? 'zoomQuitar' : 'zoom');
    var escena = $('.visor-escena', d);
    if (ampliada) { escena.scrollLeft = (escena.scrollWidth - escena.clientWidth) / 2; escena.scrollTop = 0; }
  }

  function pintar() {
    var item = grupo[indice];
    var img = $('.visor-img', visor);
    visor.classList.remove('ampliada');
    img.src = item.src;
    img.alt = item.titulo + (item.fecha ? ', ' + item.fecha : '');
    $('.visor-titulo', visor).innerHTML = (item.fecha ? '<span class="visor-fecha tablilla">' + esc(item.fecha) + '</span>' : '') + esc(item.titulo);
    $('.visor-ayuda', visor).textContent = T('zoom');
    $('.visor-contador', visor).textContent = grupo.length > 1 ? T('contador', { n: indice + 1, total: grupo.length }) : '';
    var varios = grupo.length > 1;
    $('.visor-ant', visor).hidden = !varios;
    $('.visor-sig', visor).hidden = !varios;
    $('.visor-ant', visor).disabled = indice === 0;
    $('.visor-sig', visor).disabled = indice === grupo.length - 1;
    var escena = $('.visor-escena', visor);
    escena.scrollLeft = 0; escena.scrollTop = 0;
  }
  function ir(paso) {
    var siguiente = indice + paso;
    if (siguiente < 0 || siguiente >= grupo.length) return;
    indice = siguiente;
    pintar();
  }

  function abrirVisor(enlace) {
    if (!visor) visor = crearVisor();
    var clave = enlace.dataset.visor;
    var elementos = $$('a[data-visor="' + clave + '"]');
    grupo = elementos.map(function (a) { return { src: a.getAttribute('href'), titulo: a.dataset.titulo || '', fecha: a.dataset.fecha || '' }; });
    indice = Math.max(0, elementos.indexOf(enlace));
    abridor = enlace;
    pintar();
    visor.showModal();
    document.body.classList.add('hoja-abierta');
  }
  document.addEventListener('click', function (e) {
    var enlace = e.target.closest('a[data-visor]');
    if (!enlace || !esClicNormal(e)) return;
    e.preventDefault();
    abrirVisor(enlace);
  });

  // ---------- 3. La tira de carteles ----------
  var tira = $('.carteles-tira');
  var flechas = $('.carteles-flechas');
  if (tira && flechas) {
    var revisar = function () { flechas.hidden = tira.scrollWidth <= tira.clientWidth + 4; };
    revisar();
    window.addEventListener('resize', revisar);
    flechas.addEventListener('click', function (e) {
      var boton = e.target.closest('[data-tira]');
      if (!boton) return;
      var reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      tira.scrollBy({ left: Number(boton.dataset.tira) * tira.clientWidth * 0.8, behavior: reducir ? 'auto' : 'smooth' });
    });
  }
})();
