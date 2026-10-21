/* Inicio (/inicio): interacción del mapa de feria, el carrusel del Top 10 y
   las cuerdas del tendedero. El HTML ya es útil sin este script (cada foco es
   un enlace al municipio, la ficha de Colima está visible, el carrusel se
   desliza con el dedo): aquí solo se mejora. */
(function () {
  'use strict';

  var Colima = window.Colima || {};
  var reducir = window.matchMedia('(prefers-reduced-motion: reduce)');
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function limitar(n, min, max) { return Math.min(max, Math.max(min, n)); }

  /* ================== Mapa de feria ================== */
  function iniciarMapa(mapa) {
    var lienzo = $('.mapa-lienzo', mapa);
    var estado = $('[data-mapa-estado]', mapa);
    var fichas = $$('.ficha');
    if (!lienzo) return;

    // Cada foco pasa de enlace (sin JS) a botón con aria-pressed: tocarlo
    // cambia la ficha, no navega.
    var nodos = $$('a.nodo', lienzo).map(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = a.className;
      b.dataset.slug = a.dataset.slug;
      b.dataset.lado = a.dataset.lado;
      b.setAttribute('style', a.getAttribute('style') || '');
      b.innerHTML = a.innerHTML;
      a.parentNode.replaceChild(b, a);
      return b;
    });
    if (!nodos.length) return;

    var elegido = nodos.filter(function (n) { return n.classList.contains('activo'); })[0] || nodos[0];

    function nombreDe(slug) {
      var n = $('.etiqueta', nodos.filter(function (x) { return x.dataset.slug === slug; })[0]);
      return n ? n.textContent : slug;
    }

    function elegir(nodo, opciones) {
      opciones = opciones || {};
      var cambio = nodo !== elegido;
      elegido = nodo;
      nodos.forEach(function (n) {
        var activo = n === nodo;
        n.classList.toggle('activo', activo);
        n.setAttribute('aria-pressed', activo ? 'true' : 'false');
        n.tabIndex = activo ? 0 : -1;
      });
      fichas.forEach(function (f) {
        var activa = f.dataset.slug === nodo.dataset.slug;
        f.classList.remove('entra');
        f.classList.toggle('activa', activa);
        if (activa && cambio && !reducir.matches) {
          void f.offsetWidth; // reinicia la entrada de 8 px / 500 ms
          f.classList.add('entra');
        }
      });
      if (estado && cambio) {
        var ficha = fichas.filter(function (f) { return f.dataset.slug === nodo.dataset.slug; })[0];
        var apodo = ficha && $('.ficha-apodo', ficha);
        estado.textContent = nombreDe(nodo.dataset.slug) + (apodo ? '. ' + apodo.textContent : '');
      }
      if (opciones.enfocar) nodo.focus();
    }

    nodos.forEach(function (n) {
      n.setAttribute('aria-pressed', n === elegido ? 'true' : 'false');
      n.tabIndex = n === elegido ? 0 : -1; // un solo tope de tabulación; las flechas hacen el resto
      n.addEventListener('click', function () { elegir(n); });
    });

    // Flechas: el foco más cercano en esa dirección; si no hay, el siguiente o el anterior.
    var VECTORES = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    function centro(n) {
      var r = n.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    }
    function vecino(desde, dir) {
      var c = centro(desde);
      var mejor = null;
      var mejorPuntos = Infinity;
      nodos.forEach(function (n) {
        if (n === desde) return;
        var p = centro(n);
        var dx = p[0] - c[0];
        var dy = p[1] - c[1];
        var avance = dx * dir[0] + dy * dir[1];
        if (avance <= 0) return;
        var lateral = Math.abs(dx * dir[1] - dy * dir[0]);
        if (lateral > avance * 1.4) return; // fuera del cono de ±55°
        var puntos = avance + lateral * 1.2;
        if (puntos < mejorPuntos) { mejorPuntos = puntos; mejor = n; }
      });
      return mejor;
    }
    lienzo.addEventListener('keydown', function (e) {
      var actual = nodos.indexOf(document.activeElement);
      if (actual < 0) return;
      var destino = null;
      if (VECTORES[e.key]) {
        destino = vecino(nodos[actual], VECTORES[e.key]);
        if (!destino) {
          var paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
          destino = nodos[(actual + paso + nodos.length) % nodos.length];
        }
      } else if (e.key === 'Home') destino = nodos[0];
      else if (e.key === 'End') destino = nodos[nodos.length - 1];
      if (!destino) return;
      e.preventDefault();
      elegir(destino, { enfocar: true });
    });

    // Encendido de la costa al volcán (70 ms por paso); sin movimiento, de golpe.
    function encender() {
      if (mapa.classList.contains('encendido')) return;
      mapa.classList.add('encendido');
      var pasos = $$('[style*="--i"]', lienzo).length;
      setTimeout(function () { mapa.classList.add('listo'); }, reducir.matches ? 0 : pasos * 70 + 900);
    }
    if (reducir.matches || !('IntersectionObserver' in window)) encender();
    else {
      var vigia = new IntersectionObserver(function (entradas) {
        if (entradas.some(function (e) { return e.isIntersecting; })) { vigia.disconnect(); encender(); }
      }, { threshold: 0.2 });
      vigia.observe(mapa);
    }
  }

  /* ================== Carrusel del Top 10 ================== */
  function iniciarCarrusel(el) {
    var pista = $('[data-pista]', el);
    var mando = $('[data-mando]', el);
    var diaps = $$('.diapositiva', pista);
    if (!pista || !mando || diaps.length < 2) return;
    mando.hidden = false;

    var botonPausa = $('[data-pausa]', el);
    var focos = $$('[data-ir]', el);
    var actual = 0;
    var pausadoPorPersona = false;
    var visible = false;
    var ultimaInteraccion = 0;
    var mantenido = false; // ratón encima o foco dentro

    function posicion(i) { return diaps[i].offsetLeft; } // la pista es position: relative
    function irA(i, suave) {
      var destino = limitar(i, 0, diaps.length - 1);
      pista.scrollTo({ left: posicion(destino), behavior: suave && !reducir.matches ? 'smooth' : 'auto' });
    }
    function marcar() {
      var mejor = 0;
      var distancia = Infinity;
      diaps.forEach(function (d, i) {
        var dist = Math.abs(posicion(i) - pista.scrollLeft);
        if (dist < distancia) { distancia = dist; mejor = i; }
      });
      actual = mejor;
      focos.forEach(function (b, i) {
        if (i === actual) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        $('.foco-solo', b).classList.toggle('encendido', i === actual);
      });
    }
    var marco = 0;
    pista.addEventListener('scroll', function () {
      if (marco) return;
      marco = requestAnimationFrame(function () { marco = 0; marcar(); });
    }, { passive: true });
    window.addEventListener('resize', marcar);
    marcar();

    function siguiente(auto) { irA(actual >= diaps.length - 1 ? 0 : actual + 1, true); if (!auto) ultimaInteraccion = Date.now(); }
    function anterior() { irA(actual <= 0 ? diaps.length - 1 : actual - 1, true); ultimaInteraccion = Date.now(); }
    $('[data-siguiente]', el).addEventListener('click', function () { siguiente(false); });
    $('[data-anterior]', el).addEventListener('click', anterior);
    focos.forEach(function (b) {
      b.addEventListener('click', function () { irA(Number(b.dataset.ir), true); ultimaInteraccion = Date.now(); });
    });

    // Pausa: el avance automático solo existe sin "reducir movimiento" y se detiene
    // con el botón, al pasar el ratón o enfocar algo dentro, y mientras no se vea.
    function pintarPausa() {
      var pausado = pausadoPorPersona;
      botonPausa.setAttribute('aria-label', pausado ? botonPausa.dataset.reanudar : botonPausa.dataset.pausar);
      $('[data-ic-pausa]', botonPausa).hidden = pausado;
      $('[data-ic-play]', botonPausa).hidden = !pausado;
      botonPausa.hidden = reducir.matches;
    }
    botonPausa.addEventListener('click', function () { pausadoPorPersona = !pausadoPorPersona; pintarPausa(); });
    pintarPausa();
    var cambioMovimiento = function () { pintarPausa(); };
    if (reducir.addEventListener) reducir.addEventListener('change', cambioMovimiento); else if (reducir.addListener) reducir.addListener(cambioMovimiento);

    el.addEventListener('mouseenter', function () { mantenido = true; });
    el.addEventListener('mouseleave', function () { mantenido = el.contains(document.activeElement); });
    el.addEventListener('focusin', function () { mantenido = true; });
    el.addEventListener('focusout', function () { setTimeout(function () { mantenido = el.matches(':hover') || el.contains(document.activeElement); }, 0); });
    ['pointerdown', 'wheel', 'touchstart'].forEach(function (nombre) {
      pista.addEventListener(nombre, function () { ultimaInteraccion = Date.now(); }, { passive: true });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entradas) { visible = entradas[0].isIntersecting; }, { threshold: 0.35 }).observe(el);
    } else visible = true;

    setInterval(function () {
      if (reducir.matches || pausadoPorPersona || mantenido || !visible || document.hidden) return;
      if (Date.now() - ultimaInteraccion < 5000) return;
      siguiente(true);
    }, 2000);
  }

  /* ================== Cuerdas del tendedero ================== */
  // Cada pieza cuelga de su cable con dos cuerdas (en el 18 % y el 82 % de su
  // ancho). Se mide con la posición de maquetación (offsetLeft/Top), que no
  // cambia con el giro ni con la entrada, y se pone cada cuerda a su largo.
  function colgar() {
    $$('.tramo').forEach(function (tramo) {
      var cable = $('.guirnalda', tramo);
      if (!cable || !cable.offsetWidth) return;
      var comba = Number(cable.dataset.comba) || 0.5;
      $$('.cuelga', tramo).forEach(function (pieza) {
        var largos = [0.18, 0.82].map(function (f) {
          var x = limitar((pieza.offsetLeft + pieza.offsetWidth * f - cable.offsetLeft) / cable.offsetWidth, 0, 1);
          var yCable = cable.offsetTop + 4 * comba * x * (1 - x) * cable.offsetHeight;
          return Math.max(8, Math.round(pieza.offsetTop - yCable));
        });
        pieza.style.setProperty('--cuerda-a', largos[0]);
        pieza.style.setProperty('--cuerda-b', largos[1]);
        pieza.style.setProperty('--cuerda', Math.round((largos[0] + largos[1]) / 2));
      });
    });
  }

  function reacomodar() {
    colgar();
    if (Colima.colgarLetreros) Colima.colgarLetreros();
  }

  function iniciar() {
    var mapa = $('[data-mapa]');
    if (mapa) iniciarMapa(mapa);
    var carrusel = $('[data-carrusel]');
    if (carrusel) iniciarCarrusel(carrusel);
    colgar();
    document.addEventListener('colimago:redimension', colgar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reacomodar);
    // Los letreros miden su cuerda al cargar, con la entrada todavía a medio hacer:
    // se vuelve a medir cuando ya terminó.
    window.addEventListener('load', function () { reacomodar(); setTimeout(reacomodar, 1200); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
