/* Playas: el tablero cambia la foto grande.
   Pasar el puntero, enfocar con el teclado o tocar una fila enciende su foto con
   un fundido. Cada fila es un enlace real: con ratón o teclado el clic sigue a la
   ficha; en pantallas táctiles con la foto grande a la vista, el primer toque
   cambia la foto y el segundo abre la ficha. Sin JavaScript queda la primera
   foto y todas las filas son enlaces. */
(function () {
  'use strict';
  var rejilla = document.querySelector('.playas-rejilla');
  if (!rejilla) return;
  var fotos = Array.prototype.slice.call(rejilla.querySelectorAll('.playas-foto img[data-playa]'));
  var pies = Array.prototype.slice.call(rejilla.querySelectorAll('[data-pie]'));
  var filas = Array.prototype.slice.call(rejilla.querySelectorAll('.playa-fila'));
  var contenedorFoto = rejilla.querySelector('.playas-foto');
  if (!fotos.length || !filas.length) return;

  var actual = fotos[0].dataset.playa;
  var deseada = actual;

  // ¿Se ve la foto grande? (en móvil se oculta y el tablero lleva miniaturas)
  function fotoVisible() { return !!contenedorFoto && contenedorFoto.offsetParent !== null; }

  function cargar(img) {
    if (!img.getAttribute('src') && img.dataset.src) {
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
    }
  }
  function encender(img) {
    fotos.forEach(function (f) {
      var activa = f === img;
      f.classList.toggle('activa', activa);
      f.alt = activa ? (f.dataset.alt || '') : ''; // solo la foto que se ve se anuncia
    });
    pies.forEach(function (p) { p.hidden = p.dataset.pie !== img.dataset.playa; });
    filas.forEach(function (fila) { fila.classList.toggle('activa', fila.dataset.playa === img.dataset.playa); });
    actual = img.dataset.playa;
  }

  function elegir(slug) {
    if (slug === actual && slug === deseada) return;
    deseada = slug;
    var img = fotos.filter(function (f) { return f.dataset.playa === slug; })[0];
    if (!img) return;
    cargar(img);
    var listo = function () { if (deseada === slug) encender(img); };
    if (img.complete && img.naturalWidth) listo();
    else img.addEventListener('load', listo, { once: true });
  }

  var puedeHover = window.matchMedia('(hover: hover)');
  var tactil = window.matchMedia('(pointer: coarse)');
  filas.forEach(function (fila) {
    var enlace = fila.querySelector('a');
    if (!enlace) return;
    var slug = fila.dataset.playa;
    fila.addEventListener('mouseenter', function () { if (puedeHover.matches && fotoVisible()) elegir(slug); });
    enlace.addEventListener('focus', function () { if (fotoVisible()) elegir(slug); });
    enlace.addEventListener('click', function (e) {
      if (!tactil.matches || !fotoVisible() || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (actual !== slug) { e.preventDefault(); elegir(slug); }
    });
  });

  // Al acercarse al tablero se piden las siguientes fotos con calma (de una en una),
  // para que el cambio sea inmediato sin bajar las quince de golpe.
  var precargado = false;
  function precargar() {
    if (precargado || !fotoVisible()) return;
    precargado = true;
    var pendientes = fotos.filter(function (f) { return !f.getAttribute('src'); }).slice(0, 4);
    pendientes.forEach(cargar);
  }
  var tablero = rejilla.querySelector('.playas-tablero');
  if (tablero) {
    tablero.addEventListener('pointerenter', precargar, { once: true });
    tablero.addEventListener('focusin', precargar, { once: true });
  }
})();
