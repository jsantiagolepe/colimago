/* Sugerir — arma el mensaje en vivo y lo manda por Messenger, correo o portapapeles.
   El servidor describe el mensaje (encabezado y líneas, siempre en español) en
   #sugerir-config; aquí se rellena con lo que la persona escribe. Los tres
   botones usan el MISMO texto. Si falta un dato obligatorio, ninguno envía:
   se marca el campo, se resume qué falta y el foco va al primero. */
(function () {
  'use strict';

  var configEl = document.getElementById('sugerir-config');
  var form = document.getElementById('sg-form');
  if (!configEl || !form) return;
  var config = JSON.parse(configEl.textContent);
  var textos = config.etiquetas || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var vista = document.getElementById('sg-mensaje');
  var enlaceMessenger = document.getElementById('sg-messenger');
  var enlaceCorreo = document.getElementById('sg-correo');
  var botonCopiar = document.getElementById('sg-copiar');
  var resumen = document.getElementById('sg-resumen');

  // ---------- El mensaje ----------
  function valores() {
    var v = {};
    $$('input[name], textarea[name]', form).forEach(function (el) {
      if (el.type === 'radio') { if (el.checked) v[el.name] = el.value; }
      else v[el.name] = el.value;
    });
    return v;
  }
  // Misma función que lib/guia/paginas/sugerir.js (armarMensaje).
  function armar(valores) {
    var modelo = config.modelo;
    var lineas = [modelo.encabezado];
    modelo.lineas.forEach(function (l) {
      if (l.solo && valores[l.solo.campo] !== l.solo.valor) return;
      if (l.texto) { lineas.push(l.texto); return; }
      var v = l.fijo != null ? l.fijo : String(valores[l.c] == null ? '' : valores[l.c]).trim();
      if (l.c === 'calificacion' && !(Number(v) > 0)) return;
      if (!v && !l.req && !l.siempre) return;
      lineas.push(l.r + ':' + (v ? ' ' + (l.fmt ? l.fmt.replace('{v}', v) : v) : ''));
    });
    return lineas.join('\n');
  }
  function urlCorreo(mensaje) {
    var partes = mensaje.split('\n');
    var cod = function (s) { return encodeURIComponent(s).replace(/%0A/g, '%0D%0A'); };
    return 'mailto:' + config.correo + '?subject=' + cod(partes[0]) + '&body=' + cod(partes.slice(1).join('\n'));
  }
  var mensajeActual = '';
  function actualizar() {
    mensajeActual = armar(valores());
    if (vista) vista.textContent = mensajeActual;
    if (enlaceMessenger) enlaceMessenger.href = config.messenger + encodeURIComponent(mensajeActual);
    if (enlaceCorreo) enlaceCorreo.href = urlCorreo(mensajeActual);
  }

  // ---------- Validación ----------
  function etiquetaDe(campo) {
    var rotulo = $('label, legend', campo);
    return rotulo ? rotulo.textContent.replace(/\s*\*\s*$/, '').trim() : campo.dataset.campo;
  }
  function esValido(campo) {
    var radios = $$('input[type="radio"]', campo);
    if (radios.length) return radios.some(function (r) { return r.checked; });
    var control = $('input, textarea', campo);
    return !!control && control.value.trim().length > 0;
  }
  function marcar(campo, invalido) {
    var error = $('.campo-error', campo);
    var control = $('input[type="text"], textarea', campo);
    if (control) control.setAttribute('aria-invalid', invalido ? 'true' : 'false');
    if (error) {
      error.hidden = !invalido;
      error.textContent = invalido ? (campo.querySelector('input[type="radio"]') ? textos.errorOpcion : textos.errorTexto) : '';
    }
    campo.classList.toggle('con-error', invalido);
  }
  function obligatorios() { return $$('.campo[data-obligatorio]', form).filter(function (c) { return !c.hidden; }); }
  // Devuelve los campos obligatorios que faltan (y los marca).
  function validar() {
    var faltan = [];
    obligatorios().forEach(function (campo) {
      var falta = !esValido(campo);
      marcar(campo, falta);
      if (falta) faltan.push(campo);
    });
    if (resumen) {
      resumen.hidden = faltan.length === 0;
      resumen.textContent = faltan.length ? (textos.resumen || '').replace('{campos}', faltan.map(etiquetaDe).join(', ')) : '';
    }
    return faltan;
  }
  function exigir(e) {
    var faltan = validar();
    if (!faltan.length) return true;
    e.preventDefault();
    var primero = $('input:not([type="hidden"]), textarea', faltan[0]);
    if (primero) primero.focus();
    return false;
  }
  [enlaceMessenger, enlaceCorreo].forEach(function (a) { if (a) a.addEventListener('click', exigir); });

  // ---------- Copiar ----------
  function avisar(texto) { if (window.Colima && window.Colima.toast) window.Colima.toast(texto); }
  function copiarRespaldo() {
    var area = document.createElement('textarea');
    area.value = mensajeActual;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    return ok;
  }
  if (botonCopiar) {
    botonCopiar.addEventListener('click', function (e) {
      if (!exigir(e)) return;
      var listo = function () { avisar(textos.copiado); };
      var fallo = function () { if (copiarRespaldo()) listo(); else avisar(textos.copiarError); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(mensajeActual).then(listo, fallo);
      else fallo();
    });
  }

  // ---------- Cambios en los campos ----------
  form.addEventListener('input', function (e) {
    var campo = e.target.closest('.campo');
    if (campo && campo.classList.contains('con-error') && esValido(campo)) {
      marcar(campo, false);
      if (resumen && !resumen.hidden && obligatorios().every(esValido)) { resumen.hidden = true; resumen.textContent = ''; }
    }
    if (e.target.matches('textarea')) contar(e.target);
    actualizar();
  });
  form.addEventListener('change', function (e) {
    if (e.target.type === 'radio') {
      var campo = e.target.closest('.campo');
      if (campo) marcar(campo, false);
      if (resumen && !resumen.hidden && obligatorios().every(esValido)) { resumen.hidden = true; resumen.textContent = ''; }
      alCambiarTipo(e.target);
    }
    actualizar();
  });

  function contar(area) {
    var cuenta = $('[data-cuenta="' + area.name + '"]', form);
    if (cuenta) cuenta.textContent = area.value.length + '/' + config.maxTexto;
  }
  $$('textarea', form).forEach(contar);

  // Comentario general: la calificación solo aparece con "Qué me parece la app".
  // Corrección: la etiqueta y lo obligatorio de la nota cambian con el tipo.
  function alCambiarTipo(radio) {
    if (config.tipo === 'general' && radio.name === 'tipo') {
      var calif = $('.sg-calificacion', form);
      if (calif) calif.hidden = radio.dataset.clave !== 'opinion';
    }
    if (config.tipo === 'correccion' && radio.name === 'tipo') {
      var nota = $('.campo[data-campo="nota"]', form);
      if (!nota) return;
      var etiqueta = $('[data-etiqueta-nota]', nota);
      if (etiqueta && radio.dataset.etiqueta) etiqueta.textContent = radio.dataset.etiqueta;
      var requerida = radio.dataset.req === '1';
      if (requerida) nota.setAttribute('data-obligatorio', ''); else nota.removeAttribute('data-obligatorio');
      var marca = $('[data-marca-req]', nota);
      if (marca) marca.hidden = !requerida;
      var area = $('textarea', nota);
      if (area) area.setAttribute('aria-required', requerida ? 'true' : 'false');
      marcar(nota, false);
    }
  }

  // ---------- Calificación con focos (tocar el mismo valor la quita) ----------
  var focos = $$('.sg-foco', form);
  var campoCalif = $('input[name="calificacion"]', form);
  var textoCalif = $('.sg-calif-texto', form);
  function pintarCalificacion(n) {
    focos.forEach(function (b) {
      var enc = Number(b.dataset.n) <= n;
      b.setAttribute('aria-pressed', String(Number(b.dataset.n) === n));
      $('.foco-solo', b).classList.toggle('encendido', enc);
    });
    if (textoCalif) textoCalif.textContent = n > 0 ? textoCalif.dataset.plantilla.replace('{n}', n) : textoCalif.dataset.vacio;
  }
  focos.forEach(function (b) {
    b.addEventListener('click', function () {
      var n = Number(b.dataset.n);
      var actual = Number(campoCalif.value) || 0;
      campoCalif.value = String(n === actual ? 0 : n);
      pintarCalificacion(Number(campoCalif.value));
      actualizar();
    });
  });

  // Estado inicial (el navegador puede restaurar lo escrito al volver atrás).
  $$('input[type="radio"]:checked', form).forEach(alCambiarTipo);
  pintarCalificacion(Number(campoCalif && campoCalif.value) || 0);
  actualizar();
})();
