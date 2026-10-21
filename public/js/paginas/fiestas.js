/* Fiestas del Pueblo — lo que el HTML no puede saber.
   El servidor manda siempre la misma página (doce meses, sus fiestas, anclas
   #mes-N). Aquí, con la hora de Colima del navegador:
     1. marca lo que se celebra HOY (sin año; los rangos que cruzan de año
        cuentan; las fechas en texto libre nunca);
     2. marca el mes en curso;
     3. al abrir, salta al mes actual (sin animación);
     4. enciende el foco del mes que va pasando por la pantalla y mantiene a la
        vista su chip en la fila deslizable de móvil. */
(function () {
  'use strict';

  var raiz = document.querySelector('[data-fiestas]');
  if (!raiz) return;

  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var movil = window.matchMedia('(max-width: 860px)');
  var sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- La fecha de hoy en Colima ----------
  // Los servidores y a veces los teléfonos no están en la hora de Colima: se
  // pide el mes y el día de esa zona, no los locales del aparato.
  function hoyEnColima() {
    try {
      var mes = 0;
      var dia = 0;
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', month: 'numeric', day: 'numeric' })
        .formatToParts(new Date())
        .forEach(function (p) {
          if (p.type === 'month') mes = Number(p.value);
          if (p.type === 'day') dia = Number(p.value);
        });
      if (mes && dia) return { mes: mes, dia: dia };
    } catch (e) { /* sin Intl con zonas */ }
    // Colima no cambia de horario: UTC−6 todo el año.
    var d = new Date(Date.now() - 6 * 3600 * 1000);
    return { mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
  }

  // desde y hasta son mes*100+día. Si hasta < desde el rango cruza el fin de año.
  function esVigente(desde, hasta, hoy) {
    var actual = hoy.mes * 100 + hoy.dia;
    return desde <= hasta ? actual >= desde && actual <= hasta : actual >= desde || actual <= hasta;
  }

  var hoy = hoyEnColima();

  // ---------- 1. Fiestas de hoy ----------
  $$('.fiesta[data-desde]', raiz).forEach(function (fila) {
    if (!esVigente(Number(fila.dataset.desde), Number(fila.dataset.hasta), hoy)) return;
    fila.classList.add('es-hoy');
    ['.fiesta-foco', '.fiesta-hoy', '.fiesta-desc'].forEach(function (selector) {
      var el = fila.querySelector(selector);
      if (el) el.hidden = false;
    });
  });

  // ---------- 2. Mes en curso ----------
  var seccionActual = document.getElementById('mes-' + hoy.mes);
  if (seccionActual) {
    seccionActual.setAttribute('data-actual', '');
    var pastilla = seccionActual.querySelector('.mes-actual');
    if (pastilla) pastilla.hidden = false;
  }

  // ---------- 3. Al abrir, el mes de hoy ----------
  function irAlMes(mes) {
    var seccion = document.getElementById('mes-' + mes);
    if (!seccion) return;
    var html = document.documentElement;
    var previo = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto'; // sin animación
    seccion.scrollIntoView({ block: 'start' });
    html.style.scrollBehavior = previo;
  }
  function esApertura() {
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.type && nav.type !== 'navigate') return false; // recarga o volver atrás: el navegador recuerda dónde ibas
    } catch (e) { /* sin Navigation Timing */ }
    return !location.hash && window.scrollY < 80;
  }
  if (esApertura()) {
    irAlMes(hoy.mes);
    var yo = window.scrollY;
    // Cuando terminan de cargar las fuentes la altura puede moverse unos píxeles.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (Math.abs(window.scrollY - yo) < 3) irAlMes(hoy.mes); });
    }
  }

  // ---------- 4. El foco del mes que pasa ----------
  var riel = raiz.querySelector('.fp-meses');
  var enlaces = $$('a[data-mes]', riel);
  var secciones = $$('.mes', raiz);
  var mesMarcado = 0;

  function centrarChip(enlace) {
    if (!movil.matches || !riel) return;
    var izquierda = enlace.getBoundingClientRect().left - riel.getBoundingClientRect().left + riel.scrollLeft;
    riel.scrollTo({ left: izquierda - (riel.clientWidth - enlace.offsetWidth) / 2, behavior: sinMovimiento.matches ? 'auto' : 'smooth' });
  }
  function marcar(mes) {
    if (mes === mesMarcado) return;
    mesMarcado = mes;
    enlaces.forEach(function (a) {
      var activo = Number(a.dataset.mes) === mes;
      if (activo) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      var foco = a.querySelector('.foco-solo');
      if (foco) foco.classList.toggle('encendido', activo);
      if (activo) centrarChip(a);
    });
  }
  function calcular() {
    // La línea de lectura: debajo de la barra y, en móvil, de los chips pegados.
    var barra = document.querySelector('.barra');
    var corte = (barra ? barra.offsetHeight : 64) + (movil.matches && riel ? riel.offsetHeight : 0) + 48;
    var actual = 0;
    secciones.forEach(function (s) { if (s.getBoundingClientRect().top <= corte) actual = Number(s.dataset.mes); });
    marcar(actual);
  }
  var pendiente = false;
  function alDesplazar() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(function () { pendiente = false; calcular(); });
  }
  window.addEventListener('scroll', alDesplazar, { passive: true });
  window.addEventListener('resize', alDesplazar);
  calcular();
})();
