/* Tianguis y mercados: marca "Hoy" en el pizarrón de la semana.
   Los filtros son enlaces normales (funcionan sin este script, y las páginas
   se sirven en caché), así que el día de hoy solo se puede saber aquí, en el
   navegador. El día se toma con la hora de Colima, no con la del aparato. */
(function () {
  'use strict';

  var tablero = document.querySelector('[data-pizarron]');
  if (!tablero) return;

  // 0 = domingo … 6 = sábado, en la zona de Colima
  function diaDeHoy() {
    try {
      var corto = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', weekday: 'short' }).format(new Date());
      var i = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(corto);
      if (i >= 0) return i;
    } catch (e) { /* sin Intl con zonas: se usa el reloj del aparato */ }
    return new Date().getDay();
  }

  var enlace = tablero.querySelector('[data-dia="' + diaDeHoy() + '"]');
  if (!enlace) return;
  var marca = document.createElement('span');
  marca.className = 'tg-hoy';
  marca.setAttribute('aria-hidden', 'true');
  marca.textContent = tablero.getAttribute('data-hoy') || '';
  enlace.appendChild(marca);
  // El lector de pantalla también debe saberlo
  var etiqueta = enlace.getAttribute('aria-label');
  if (etiqueta && marca.textContent) enlace.setAttribute('aria-label', etiqueta + ' (' + marca.textContent + ')');
})();
