// /calendario: la tabla del mes y la lista de eventos del día elegido.
//
// Se pinta completa en el servidor (enlaces ?mes=YYYY-MM&dia=YYYY-MM-DD, así
// funciona sin JavaScript). public/js/paginas/calendario.js cambia de mes y de
// día sin recargar con los eventos embebidos en <script id="calendario-datos">
// y recalcula "hoy" con la hora de Colima.
//
// Fechas: todo por componentes (año, mes, día), nunca new Date('YYYY-MM-DD') +
// toISOString: la hora del backend es la de Colima tal cual (ver eventos.js).

const { h, json } = require("../h");
const { t, tn, MESES, DIAS, DIAS_CORTOS, diaDeLaSemana, fechaLarga, urlAbsoluta } = require("../i18n");
const { obtenerEventos, hoyEnColima, diasDelEvento, proximos } = require("../eventos");
const { municipios } = require("../datos");
const { letrero, boton, estadoVista, anuncio, intercalarAnuncios, icono } = require("../componentes");
const V = require("./eventos-vista");

const ANIO_MIN = 2000;
const ANIO_MAX = 2100;
const MAX_PUNTOS = 5;

// ---------- Aritmética de fechas (por componentes) ----------

const dos = (n) => String(n).padStart(2, "0");
const esBisiesto = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const diasEnMes = (a, m) => (m === 2 ? (esBisiesto(a) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31);
const clave = (a, m, d) => `${String(a).padStart(4, "0")}-${dos(m)}-${dos(d)}`;
const claveMes = (a, m) => `${String(a).padStart(4, "0")}-${dos(m)}`;
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

function leerMes(valor) {
  const r = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(typeof valor === "string" ? valor : "");
  if (!r) return null;
  const a = Number(r[1]);
  return a >= ANIO_MIN && a <= ANIO_MAX ? { a, m: Number(r[2]) } : null;
}

function leerDia(valor) {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof valor === "string" ? valor : "");
  if (!r) return null;
  const a = Number(r[1]);
  const m = Number(r[2]);
  const d = Number(r[3]);
  if (a < ANIO_MIN || a > ANIO_MAX || m < 1 || m > 12 || d < 1 || d > diasEnMes(a, m)) return null;
  return { a, m, d };
}

function mesVecino({ a, m }, paso) {
  const total = a * 12 + (m - 1) + paso;
  return { a: Math.floor(total / 12), m: (total % 12) + 1 };
}

// ---------- Enlaces ----------

function urlMes(ctx, mes, dia) {
  return `${ctx.ruta("/calendario")}?mes=${claveMes(mes.a, mes.m)}${dia ? `&dia=${dia}` : ""}`;
}

// ---------- Piezas ----------

function marcadorDePunto(ev) {
  return ev.esPortada ? h`<i class="pt pt-bombilla"></i>` : h`<i class="pt pt-${V.tintaDelEvento(ev)}"></i>`;
}

function celdaDelDia(ctx, { a, m, d }, { eventos, hoy, elegido }) {
  const { lang } = ctx;
  const fecha = clave(a, m, d);
  const n = eventos.length;
  const esHoy = fecha === hoy;
  const esElegido = fecha === elegido;
  const etiqueta = [fechaLarga(lang, fecha), n ? tn(lang, "calendario.nEventos", n) : "", esHoy ? t(lang, "calendario.hoy") : ""].filter(Boolean).join(", ");
  return h`<td><a class="dia${esHoy ? " es-hoy" : ""}${esElegido ? " es-elegido" : ""}${n ? " con-eventos" : ""}" href="${urlMes(ctx, { a, m }, fecha)}" data-dia="${fecha}" aria-label="${etiqueta}"${esHoy ? h` aria-current="date"` : esElegido ? h` aria-current="true"` : ""}>
    <span class="dia-num">${d}</span>
    <span class="dia-puntos" aria-hidden="true">${eventos.slice(0, MAX_PUNTOS).map(marcadorDePunto)}</span>
  </a></td>`;
}

function filasDelMes(ctx, mes, { porDia, hoy, elegido }) {
  const vacias = diaDeLaSemana(clave(mes.a, mes.m, 1)); // domingo = 0
  const celdas = [];
  for (let i = 0; i < vacias; i++) celdas.push(h`<td class="dia-vacio"></td>`);
  for (let d = 1; d <= diasEnMes(mes.a, mes.m); d++) {
    celdas.push(celdaDelDia(ctx, { a: mes.a, m: mes.m, d }, { eventos: porDia.get(clave(mes.a, mes.m, d)) || [], hoy, elegido }));
  }
  while (celdas.length % 7) celdas.push(h`<td class="dia-vacio"></td>`);
  const filas = [];
  for (let i = 0; i < celdas.length; i += 7) filas.push(h`<tr>${celdas.slice(i, i + 7)}</tr>`);
  return filas;
}

function filaDeEvento(ctx, ev) {
  const { lang } = ctx;
  const municipio = V.municipioDe(ev);
  return h`<li><a class="evento-fila" href="${ctx.ruta(`/evento/${ev.id}`)}">
    <span class="evento-marca" aria-hidden="true">${ev.esPortada ? h`<span class="foco-solo encendido"></span>` : h`<i class="pt pt-grande pt-${V.tintaDelEvento(ev)}"></i>`}</span>
    <span class="evento-texto">
      <span class="evento-titulo">${ev.titulo}</span>
      ${municipio && h`<span class="tablilla-muni">${municipio.nombre}</span>`}
      ${!ev.esPortada && h`<span class="evento-fecha">${V.textoFechaCorta(lang, ev)}</span>`}
    </span>
    <span class="evento-chevron" aria-hidden="true">${icono("chevron-derecha")}</span>
  </a></li>`;
}

function tituloDeLaLista(lang, dia, hoy) {
  return dia === hoy ? t(lang, "calendario.eventosHoy") : t(lang, "calendario.eventosDia", { fecha: fechaLarga(lang, dia) });
}

// ---------- Página ----------

module.exports = {
  rutas: ["/calendario"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const consulta = req.query || {};
    const hoy = hoyEnColima();
    const hoyPartes = leerDia(hoy);
    const diaPedido = leerDia(consulta.dia);
    const mesPedido = leerMes(consulta.mes);
    const hayParametros = Boolean(diaPedido || mesPedido);

    // Mes a mostrar y día elegido (hoy si cae en el mes; si no, el día 1)
    const mes = mesPedido || (diaPedido && { a: diaPedido.a, m: diaPedido.m }) || { a: hoyPartes.a, m: hoyPartes.m };
    let elegido;
    if (diaPedido && diaPedido.a === mes.a && diaPedido.m === mes.m) elegido = clave(diaPedido.a, diaPedido.m, diaPedido.d);
    else if (mes.a === hoyPartes.a && mes.m === hoyPartes.m) elegido = hoy;
    else elegido = clave(mes.a, mes.m, 1);
    const siguiendoHoy = !hayParametros;

    const feed = await obtenerEventos();
    const feedCaido = !feed.ok && feed.eventos.length === 0;

    // Un evento aparece en cada día entre su fecha y su finFecha.
    const porDia = new Map();
    for (const ev of feed.eventos) {
      for (const dia of diasDelEvento(ev)) {
        if (!porDia.has(dia)) porDia.set(dia, []);
        porDia.get(dia).push(ev);
      }
    }
    for (const [dia, lista] of porDia) porDia.set(dia, proximos(lista, "0000-00-00")); // por hora; "proximos" solo ordena aquí

    // Primera impresión útil: si hoy no tiene eventos y nadie pidió un día, se
    // abre en el siguiente día de este mes que sí tenga (hoy sigue marcado).
    if (!hayParametros && !(porDia.get(elegido) || []).length) {
      const prefijo = claveMes(mes.a, mes.m);
      const siguientes = [...porDia.keys()].filter((d) => d > elegido && d.startsWith(prefijo)).sort();
      if (siguientes.length) elegido = siguientes[0];
    }

    const delDia = porDia.get(elegido) || [];
    const anterior = mesVecino(mes, -1);
    const siguiente = mesVecino(mes, 1);
    const nombreMes = `${mayuscula(MESES[lang][mes.m - 1])} ${mes.a}`;

    const filasMes = filasDelMes(ctx, mes, { porDia, hoy, elegido });
    const reintentar = { texto: t(lang, "comun.reintentar"), href: ctx.ruta("/calendario") + (hayParametros ? `?mes=${claveMes(mes.a, mes.m)}&dia=${elegido}` : ""), variante: "foco" };
    const estadoError = estadoVista({ icono: "nube-tachada", titulo: t(lang, "comun.errorTitulo"), mensaje: t(lang, "calendario.errorFeed"), accion: reintentar });
    const estadoVacio = estadoVista({ icono: "calendario", titulo: t(lang, "calendario.vacioTitulo"), mensaje: t(lang, "calendario.vacioTexto") });

    let lista;
    if (feedCaido) lista = estadoError;
    else if (!delDia.length) lista = estadoVacio;
    else {
      // Anuncios solo-banner cada 3 eventos (y uno al cierre si hay menos de 3), dentro de su <li>.
      const filas = intercalarAnuncios(delDia, { cada: 3, formatos: ["banner"] }).map((item) =>
        item.anuncio ? h`<li class="agenda-anuncio">${anuncio({ lang, formato: item.formato, indice: item.indice })}</li>` : filaDeEvento(ctx, item),
      );
      lista = h`<ul class="agenda-lista">${filas}</ul>`;
    }

    // Lo que necesita el script para cambiar de mes sin recargar.
    const textosCliente = {
      meses: MESES[lang],
      dias: DIAS_CORTOS[lang],
      diasLargos: DIAS[lang],
      hoy: t(lang, "calendario.hoy"),
      eventosHoy: t(lang, "calendario.eventosHoy"),
      eventosDia: t(lang, "calendario.eventosDia"),
      nEventos: { uno: t(lang, "calendario.nEventos.uno"), otros: t(lang, "calendario.nEventos.otros") },
      fechaDia: t(lang, "calendario.fechaDia"),
      fechaHora: t(lang, "evento.fechaHora"),
      rango: t(lang, "evento.rango"),
      rangoHora: t(lang, "evento.rangoHora"),
    };
    const cliente = {
      lang,
      hoy,
      mes: claveMes(mes.a, mes.m),
      dia: elegido,
      siguiendoHoy,
      falla: feedCaido,
      base: ctx.ruta("/calendario"),
      baseEvento: ctx.ruta("/evento/"),
      municipios: Object.fromEntries(municipios.map((m) => [m.id, m.nombre])),
      eventos: feed.eventos.map((ev) => ({ i: ev.id, t: ev.titulo, f: ev.fecha, h: ev.hora, e: ev.finFecha, a: ev.todoElDia ? 1 : 0, m: ev.municipioId, c: V.tintaDelEvento(ev), p: ev.esPortada ? 1 : 0 })),
      t: textosCliente,
    };

    const cuerpo = h`
<div class="calendario">
  <div class="calendario-envoltura">
    ${letrero({
      id: "t-calendario",
      texto: t(lang, "calendario.titulo"),
      tinta: "lona",
      giro: 0.8,
      entrada: t(lang, "calendario.entrada"),
      extra: boton({ texto: t(lang, "calendario.sugerir"), href: ctx.ruta("/sugerir/evento"), variante: "contorno", icono: "mas", attrs: { "aria-label": t(lang, "calendario.sugerirAria") } }),
      focos: 34,
      comba: 0.5,
    })}
    <div class="calendario-rejilla">
      <section class="mes" aria-labelledby="t-mes" data-mes>
        <div class="mes-cabeza">
          <a class="btn-icono" href="${urlMes(ctx, anterior)}" data-mes-paso="-1" aria-label="${t(lang, "calendario.mesAnterior")}">${icono("chevron-izquierda")}</a>
          <h2 class="rotulo mes-titulo" id="t-mes" aria-live="polite">${nombreMes}</h2>
          <a class="btn-icono" href="${urlMes(ctx, siguiente)}" data-mes-paso="1" aria-label="${t(lang, "calendario.mesSiguiente")}">${icono("chevron-derecha")}</a>
        </div>
        <table class="mes-tabla">
          <caption class="sr-only">${nombreMes}</caption>
          <thead><tr>${DIAS_CORTOS[lang].map((corto, i) => h`<th scope="col"><abbr title="${DIAS[lang][i]}">${corto}</abbr></th>`)}</tr></thead>
          <tbody data-cuerpo-mes>${filasMes}</tbody>
        </table>
        <p class="mes-pie"><a class="btn-texto" href="${ctx.ruta("/calendario")}" data-ir-hoy>${t(lang, "calendario.irAHoy")}</a></p>
      </section>
      <section class="agenda" aria-labelledby="t-agenda">
        <h2 class="agenda-titulo" id="t-agenda" aria-live="polite">${tituloDeLaLista(lang, elegido, hoy)}</h2>
        <div class="agenda-cuerpo" data-agenda>${lista}</div>
      </section>
    </div>
  </div>
  <script type="application/json" id="calendario-datos">${json(cliente)}</script>
  <template id="tpl-error">${estadoError}</template>
  <template id="tpl-vacio">${estadoVacio}</template>
  <template id="tpl-anuncio-0">${anuncio({ lang, formato: "banner", indice: 0 })}</template>
  <template id="tpl-anuncio-1">${anuncio({ lang, formato: "banner", indice: 1 })}</template>
  <template id="tpl-anuncio-2">${anuncio({ lang, formato: "banner", indice: 2 })}</template>
</div>`;

    return {
      titulo: t(lang, "calendario.metaTitulo"),
      descripcion: t(lang, "calendario.metaDescripcion"),
      activa: "calendario",
      cuerpo,
      css: ["calendario"],
      js: ["paginas/calendario"],
      robots: hayParametros ? "noindex, follow" : undefined,
      canonical: hayParametros ? urlAbsoluta(lang, "/calendario") : undefined,
      consulta: hayParametros ? `?mes=${claveMes(mes.a, mes.m)}&dia=${elegido}` : "",
      cache: feedCaido ? "ninguno" : "evento",
    };
  },
};
