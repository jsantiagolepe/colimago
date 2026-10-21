/* Rincones Naturales: en móvil la tira de categorías se desliza, así que al
   cargar se centra la pestaña activa para que se vea cuál es. */
(function () {
  'use strict';
  var activa = document.querySelector('.rincones-pestanas [aria-current]');
  var tira = activa && activa.closest('.chips-deslizables');
  if (!tira) return;
  function centrar() {
    if (tira.scrollWidth <= tira.clientWidth + 1) return; // todo cabe: no hay nada que mover
    var a = activa.getBoundingClientRect();
    var t = tira.getBoundingClientRect();
    tira.scrollLeft = Math.max(0, tira.scrollLeft + (a.left - t.left) - (t.width - a.width) / 2);
  }
  centrar();
  // Las fuentes cambian el ancho de los chips: se vuelve a centrar cuando están.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(centrar);
})();
