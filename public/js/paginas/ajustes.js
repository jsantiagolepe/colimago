/* Ajustes (/ajustes) y Cuenta (/ajustes/cuenta).
   El HTML sale siempre en versión invitado; aquí se completa lo personal:
   la tarjeta de cuenta, "Cerrar sesión", la apariencia (Sistema / Noche / Día)
   y eliminar la cuenta. Depende de window.Colima (public/js/core.js). */
(function () {
  'use strict';

  var C = window.Colima;
  if (!C) return;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var TX = {};
  try { TX = JSON.parse(($('#ajustes-textos') || {}).textContent || '{}'); } catch (e) { TX = {}; }
  function texto(plantilla, vars) {
    return String(plantilla || '').replace(/\{(\w+)\}/g, function (m, k) { return vars && k in vars ? vars[k] : m; });
  }

  /* ---------- Sesión: tarjeta de cuenta, cerrar sesión, eliminar cuenta ---------- */
  var tarjeta = $('[data-cuenta]');
  var grupoSesion = $('#g-sesion');
  var botonEliminar = $('[data-eliminar]');
  var avisos = $$('[data-aviso-sesion]');
  var sesionComo = $('[data-sesion-como]');

  function pintarMedallon(medallon, img) {
    var perro = $('.perro', medallon);
    var foto = $('img', medallon);
    var valida = typeof img === 'string' && /^https:\/\//.test(img);
    if (!valida) {
      if (foto) foto.remove();
      if (perro) perro.hidden = false;
      medallon.classList.remove('con-foto');
      return;
    }
    if (!foto) {
      foto = new Image();
      foto.alt = '';
      foto.width = 96;
      foto.height = 96;
      foto.referrerPolicy = 'no-referrer';
      foto.addEventListener('error', function () { pintarMedallon(medallon, null); });
      medallon.appendChild(foto);
    }
    if (foto.getAttribute('src') !== img) foto.src = img;
    if (perro) perro.hidden = true;
    medallon.classList.add('con-foto');
  }

  function pintarSesion(u) {
    if (tarjeta) {
      $('[data-estado="invitado"]', tarjeta).hidden = !!u;
      var conSesion = $('[data-estado="sesion"]', tarjeta);
      conSesion.hidden = !u;
      if (u) {
        if (u.nombre) $('[data-nombre]', conSesion).textContent = u.nombre;
        var correo = $('[data-correo]', conSesion);
        correo.textContent = u.email || '';
        correo.hidden = !u.email;
        pintarMedallon($('[data-medallon]', conSesion), u.img);
      }
    }
    if (grupoSesion) grupoSesion.hidden = !u;
    if (botonEliminar) botonEliminar.disabled = !u || botonEliminar.dataset.ocupado === '1';
    avisos.forEach(function (el) { el.hidden = !!u; });
    if (sesionComo) {
      sesionComo.hidden = !u;
      if (u) sesionComo.textContent = texto(TX.sesionComo, { nombre: u.nombre || u.email || '' });
    }
  }

  // Cambios posteriores (iniciar o cerrar sesión). sesionLista cubre el caso en
  // que el servidor diga que ya no hay sesión aunque el navegador la recordara.
  C.alCambiarSesion(pintarSesion);
  if (C.sesionLista) C.sesionLista.then(function (u) { pintarSesion(u || null); });

  /* ---------- Apariencia: Sistema / Noche / Día ---------- */
  var apariencia = $('[data-apariencia]');
  if (apariencia && C.modoTema && C.fijarTema) {
    var radios = $$('input[type="radio"]', apariencia);
    var estado = $('[data-apariencia-estado]');
    var pintarApariencia = function () {
      var modo = C.modoTema();
      radios.forEach(function (r) { r.checked = r.value === modo; });
      if (estado) estado.textContent = C.temaActual() === 'oscuro' ? TX.ahoraNoche : TX.ahoraDia;
    };
    apariencia.hidden = false;
    radios.forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) { C.fijarTema(r.value); pintarApariencia(); } });
    });
    document.addEventListener('colimago:tema', pintarApariencia);
    var sistema = window.matchMedia('(prefers-color-scheme: dark)');
    if (sistema.addEventListener) sistema.addEventListener('change', pintarApariencia);
    pintarApariencia();
  }

  /* ---------- Eliminar cuenta ---------- */
  if (botonEliminar) {
    var etiqueta = $('span', botonEliminar);
    var normal = etiqueta ? etiqueta.textContent : '';
    var terminar = function () {
      botonEliminar.dataset.ocupado = '0';
      if (etiqueta) etiqueta.textContent = normal;
      botonEliminar.disabled = !C.usuario();
    };
    botonEliminar.addEventListener('click', function () {
      if (botonEliminar.disabled || botonEliminar.dataset.ocupado === '1') return;
      C.confirmar({ titulo: TX.confirmarTitulo, texto: TX.confirmarTexto, aceptar: TX.confirmarBoton, peligro: true }).then(function (acepto) {
        if (!acepto) return;
        botonEliminar.dataset.ocupado = '1';
        botonEliminar.disabled = true;
        if (etiqueta) etiqueta.textContent = TX.eliminando;
        C.api('/cuenta', { metodo: 'DELETE' }).then(function (r) {
          if (r.ok) {
            // El servidor ya cerró la sesión; cerrarSesion deja al navegador igual
            // (usuario nulo y favoritos locales vacíos).
            return C.cerrarSesion().then(function () {
              terminar();
              C.toast(TX.exito, { duracion: 4200 });
            });
          }
          terminar();
          if (r.status === 401) return; // api() ya avisó que la sesión expiró
          C.toast(r.status === 429 ? C.T('demasiadas') : TX.error, { duracion: 3600 });
        });
      });
    });
  }
})();
