/* Feria de Todos los Santos: filtra el programa por día y por lugar, abre en el día de hoy
   (si la feria está en curso), atenúa lo que ya pasó y baja el programa a un .ics. */
(function () {
  'use strict';
  var raiz = document.querySelector('[data-fs]');
  var A = window.ColimaApp;
  if (!raiz || !A) return;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var eventos = $$('.fs-evento', raiz);
  var secciones = $$('.fs-dia', raiz);
  var vacio = raiz.querySelector('[data-fs-vacio]');
  var estado = { dia: '', lugar: '', estelares: false };

  function aplicar() {
    var visibles = 0;
    eventos.forEach(function (e) {
      var ok = (!estado.dia || e.dataset.dia === estado.dia) && (!estado.lugar || e.dataset.lugar === estado.lugar) && (!estado.estelares || e.querySelector('.fs-lugar.estelar'));
      e.hidden = !ok;
      if (ok) visibles++;
    });
    secciones.forEach(function (s) { s.hidden = !s.querySelector('.fs-evento:not([hidden])'); });
    if (vacio) vacio.hidden = visibles > 0;
    $$('[data-filtro-dia]', raiz).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.filtroDia === estado.dia)); });
    $$('[data-filtro-lugar]', raiz).forEach(function (b) { b.setAttribute('aria-pressed', String(!estado.estelares && b.dataset.filtroLugar === estado.lugar)); });
    var est = raiz.querySelector('[data-filtro-estelares]');
    if (est) est.setAttribute('aria-pressed', String(estado.estelares));
  }

  raiz.addEventListener('click', function (e) {
    var d = e.target.closest('[data-filtro-dia]');
    var l = e.target.closest('[data-filtro-lugar]');
    var s = e.target.closest('[data-filtro-estelares]');
    if (d) { estado.dia = d.dataset.filtroDia; aplicar(); if (estado.dia) { var sec = document.getElementById('dia-' + estado.dia); if (sec) sec.scrollIntoView({ block: 'start' }); } }
    else if (l) { estado.lugar = l.dataset.filtroLugar; estado.estelares = false; aplicar(); }
    else if (s) { estado.estelares = !estado.estelares; estado.lugar = ''; aplicar(); }
  });

  // En curso: el día de hoy primero y lo ya pasado atenuado
  var hoy = A.hoy();
  if (hoy >= raiz.dataset.inicio && hoy <= raiz.dataset.fin) {
    estado.dia = hoy;
    var ahora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    eventos.forEach(function (e) { if (e.dataset.dia === hoy && e.dataset.hora !== '00:00' && e.dataset.hora < ahora) e.classList.add('pasado'); });
  }
  aplicar();

  // Al calendario: lo que se ve ahora (el día elegido, o todo)
  var boton = raiz.querySelector('[data-fs-ics]');
  if (boton) boton.addEventListener('click', function () {
    var lista = eventos.filter(function (e) { return !e.hidden; }).map(function (e) {
      var fecha = e.dataset.dia, hora = e.dataset.hora;
      if (hora === '00:00') fecha = A.sumaDias(fecha, 1); // madrugada del día siguiente
      return { titulo: e.dataset.nombre, fecha: fecha, hora: hora, minutos: 90, lugar: e.querySelector('.fs-lugar').textContent + ' · Recinto Ferial, Colima' };
    });
    if (!lista.length) return;
    A.descargarICS('feria-de-todos-los-santos' + (estado.dia ? '-' + estado.dia : ''), lista);
    A.aviso(A.T('alcalendario.toCalendar.addedMany', {}, lista.length));
  });
})();
