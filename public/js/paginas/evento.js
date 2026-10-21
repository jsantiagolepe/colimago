/* Detalle de evento — el botón "Volver" regresa a la pantalla de donde se
   llegó (feed, calendario, favoritos) cuando viene de este mismo sitio; si se
   llegó por un enlace compartido, es un enlace normal a /explorar. */
(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    var volver = e.target.closest('[data-volver]');
    if (!volver || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var referente = document.referrer || '';
    if (history.length > 1 && referente.indexOf(location.origin + '/') === 0) {
      e.preventDefault();
      history.back();
    }
  });
})();
