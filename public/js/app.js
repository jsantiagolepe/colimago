/* Guía web de Colima Go — piezas de las pantallas nuevas (buscar, cerca de mí, mapa, Yo,
   feria, planes…): catálogo, ubicación, distancias, almacenamiento en el navegador y
   archivos .ics. Se expone como window.ColimaApp. Sin dependencias. */
(function () {
  'use strict';
  var C = window.COLIMAGO || {};
  var lang = C.lang === 'en' ? 'en' : 'es';
  var ZONA = 'America/Mexico_City';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(nombre, clase) { return '<svg class="ic' + (clase ? ' ' + clase : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + nombre + '"/></svg>'; }
  function ruta(destino) { return lang === 'en' ? '/en' + (destino === '/' ? '' : destino) : destino; }
  // Textos de los espacios que pidió la página (layout: ns). Plural: T('espacio.clave', {count:n}, n) busca _one/_other.
  function T(clave, vars, n) {
    var ns = C.ns || {};
    function buscar(k) { return k.split('.').reduce(function (o, x) { return o == null ? o : o[x]; }, ns); }
    var v = n === undefined ? undefined : buscar(clave + (n === 1 ? '_one' : '_other'));
    if (typeof v !== 'string') v = buscar(clave);
    if (typeof v !== 'string') return clave;
    var datos = Object.assign({}, n === undefined ? null : { count: n }, vars);
    return v.replace(/\{(\w+)\}/g, function (m, k) { return k in datos ? datos[k] : m; });
  }
  function txt(vars, clave, v) {
    var t = String(clave).split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, vars || {});
    if (typeof t !== 'string') return clave;
    return v ? t.replace(/\{(\w+)\}/g, function (m, k) { return k in v ? v[k] : m; }) : t;
  }

  // ---------- Almacenamiento (todo se queda en este navegador) ----------
  function lee(clave, porDefecto) {
    try { var v = localStorage.getItem(clave); return v == null ? porDefecto : JSON.parse(v); } catch (e) { return porDefecto; }
  }
  function guarda(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch (e) { return false; }
  }

  // ---------- Fechas (hora de Colima) ----------
  function hoy() { return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date()); }
  function fechaLarga(f, opciones) {
    var p = f.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', Object.assign({ weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }, opciones));
  }
  function sumaDias(f, n) {
    var p = f.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.toISOString().slice(0, 10);
  }
  function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---------- Catálogo ----------
  var promesaCatalogo = null;
  function catalogo() {
    if (!promesaCatalogo) {
      promesaCatalogo = fetch('/catalogo-' + lang + '.json').then(function (r) {
        if (!r.ok) throw new Error('catalogo');
        return r.json();
      }).then(function (c) {
        c.lugares.forEach(function (l) { l.url = ruta('/lugar/' + l.s); });
        return c;
      });
      promesaCatalogo.catch(function () { promesaCatalogo = null; });
    }
    return promesaCatalogo;
  }
  function foto(l, ancho) { return l && l.f ? '/img/' + l.f + '-' + (ancho || 480) + '.webp' : null; }
  function normalizar(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  // ---------- Ubicación y distancias ----------
  function ubicar(opciones) {
    return new Promise(function (resolver, rechazar) {
      if (!navigator.geolocation) return rechazar({ code: 0 });
      navigator.geolocation.getCurrentPosition(function (p) { resolver({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }); }, rechazar,
        Object.assign({ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }, opciones));
    });
  }
  function distanciaM(a, b) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function textoDistancia(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)) + ' km'; }

  // ---------- Archivos .ics ----------
  function icsTexto(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFecha(f, h) { return f.replace(/-/g, '') + 'T' + (h || '09:00').replace(':', '') + '00'; }
  // eventos: [{ titulo, fecha:'YYYY-MM-DD', hora:'HH:MM'|null, minutos, lugar, descripcion }]
  function descargarICS(nombre, eventos) {
    var lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Colima Go//colimago.mx//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    eventos.forEach(function (e, i) {
      var inicio = e.hora ? icsFecha(e.fecha, e.hora) : null;
      lineas.push('BEGIN:VEVENT', 'UID:' + Date.now() + '-' + i + '@colimago.mx', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z');
      if (inicio) {
        var h = e.hora.split(':').map(Number), fin = h[0] * 60 + h[1] + (e.minutos || 90);
        var dias = Math.floor(fin / 1440), fm = fin % 1440;
        var finTxt = icsFecha(sumaDias(e.fecha, dias), String(Math.floor(fm / 60)).padStart(2, '0') + ':' + String(fm % 60).padStart(2, '0'));
        lineas.push('DTSTART;TZID=' + ZONA + ':' + inicio, 'DTEND;TZID=' + ZONA + ':' + finTxt);
      } else {
        lineas.push('DTSTART;VALUE=DATE:' + e.fecha.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + sumaDias(e.fecha, 1).replace(/-/g, ''));
      }
      lineas.push('SUMMARY:' + icsTexto(e.titulo));
      if (e.lugar) lineas.push('LOCATION:' + icsTexto(e.lugar));
      if (e.descripcion) lineas.push('DESCRIPTION:' + icsTexto(e.descripcion));
      lineas.push('END:VEVENT');
    });
    lineas.push('END:VCALENDAR');
    var blob = new Blob([lineas.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (nombre || 'colima-go').replace(/[^\w-]+/g, '-').toLowerCase() + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function aviso(texto) { if (window.Colima && window.Colima.toast) window.Colima.toast(texto); }

  window.ColimaApp = { T: T, lang: lang, esc: esc, ic: ic, ruta: ruta, txt: txt, lee: lee, guarda: guarda, hoy: hoy, fechaLarga: fechaLarga, sumaDias: sumaDias, id: id, catalogo: catalogo, foto: foto, normalizar: normalizar, ubicar: ubicar, distanciaM: distanciaM, textoDistancia: textoDistancia, descargarICS: descargarICS, aviso: aviso };
})();
