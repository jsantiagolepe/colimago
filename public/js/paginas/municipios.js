/* Municipios (lista y ficha): detalles que dependen de medir la página.
   La página funciona sin este script; aquí solo se afinan las cuerdas de la
   franja de feria de la ficha. */
(function () {
  'use strict';

  // El medallón de la franja cuelga del cable con su propia cuerda. core.js ya
  // mide la de cada letrero; aquí se mide la del medallón con la misma fórmula
  // (el cable es una catenaria: y = 4·comba·x·(1−x)), para que toque el cable.
  function colgarSellos() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-colgar]'), function (el) {
      var zona = el.closest('[data-cable]');
      var cable = zona && zona.querySelector('.guirnalda');
      if (!cable) return;
      var c = cable.getBoundingClientRect();
      var caja = el.getBoundingClientRect();
      if (!c.width) return;
      var comba = Number(cable.dataset.comba) || 0.5;
      var x = Math.min(1, Math.max(0, (caja.left + caja.width / 2 - c.left) / c.width));
      var cuerda = caja.top - (c.top + 4 * comba * x * (1 - x) * c.height);
      el.style.setProperty('--cuerda', Math.max(10, Math.round(cuerda)));
    });
  }

  function iniciar() {
    colgarSellos();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(colgarSellos);
    // core.js avisa tras tender de nuevo las guirnaldas al cambiar el ancho.
    document.addEventListener('colimago:redimension', colgarSellos);
  }

  // core.js tiende las guirnaldas al cargar; se mide después de eso.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
