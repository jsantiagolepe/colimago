// Tianguis y mercados (/tianguis-y-mercados).
//
// Datos locales (lib/guia/datos.js: filtrarTianguis, municipiosConLugares,
// cuandoSePone…); la página no toca el backend, así que se sirve "estatico".
// Los filtros son parte de la URL, así que funcionan sin JavaScript y se pueden
// compartir:
//   ?tipo=tianguis|mercados   (por defecto tianguis)
//   &dia=0-6                  (0 = domingo; solo tianguis; "Todos" = sin dia)
//   &municipio=1-10           (si el municipio no tiene lugares de ese tipo, se ignora)
//
// Composición: "el pizarrón de la semana": un tablero colgado con los siete
// días como columnas; cada columna cuenta cuántos tianguis se ponen ese día
// (con el municipio elegido) y es el enlace que filtra. Debajo, los municipios
// con su estampa y la lista agrupada por municipio, con un anuncio cada 3.

const { h } = require("../h");
const datos = require("../datos");
const I = require("../i18n");
const { letrero, boton, chip, tarjetaLugar, estadoVista, anuncio, intercalarAnuncios } = require("../componentes");

const TIPO = { tianguis: datos.TIPO_TIANGUIS, mercados: datos.TIPO_MERCADO };
const SEMANA = [1, 2, 3, 4, 5, 6, 0]; // lunes a domingo (los números son Date.getDay())
const DESTINO = "/tianguis-y-mercados";

// ---------- Filtros ----------

// Normaliza (y descarta lo que no aplica): el día solo cuenta en tianguis, y un
// municipio sin lugares de ese tipo se ignora (como en la app).
function normalizar({ tipo, dia, municipio }) {
  const t = tipo === "mercados" ? "mercados" : "tianguis";
  const d = t === "tianguis" && /^[0-6]$/.test(String(dia ?? "")) ? Number(dia) : null;
  const mun = /^(10|[1-9])$/.test(String(municipio ?? "")) ? Number(municipio) : null;
  return { tipo: t, dia: d, municipio: mun !== null && datos.municipiosConLugares(TIPO[t]).includes(mun) ? mun : null };
}

function consultaDe({ tipo, dia, municipio }) {
  const partes = [];
  if (tipo === "mercados") partes.push("tipo=mercados");
  if (dia !== null) partes.push(`dia=${dia}`);
  if (municipio !== null) partes.push(`municipio=${municipio}`);
  return partes.length ? `?${partes.join("&")}` : "";
}

function lista(f) {
  return datos.filtrarTianguis({ tipo: TIPO[f.tipo], dia: f.dia, municipioId: f.municipio });
}

// ---------- Piezas ----------

function ordenaPorMunicipio(lugares) {
  // filtrarTianguis ya ordena por municipio y título; aquí solo se parte en grupos.
  const grupos = [];
  for (const l of lugares) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.id === l.municipioId) ultimo.lugares.push(l);
    else grupos.push({ id: l.municipioId, lugares: [l] });
  }
  return grupos;
}

function cabeceraGrupo(grupo) {
  const m = datos.municipioPorId(grupo.id);
  if (!m) return "";
  return h`<h3 class="tg-grupo"><span class="medallon"><img src="${m.estampa}" alt="" width="200" height="200" loading="lazy" decoding="async" /></span><span class="tg-grupo-nombre">${m.nombre}</span><span class="tg-grupo-n">${grupo.lugares.length}</span></h3>`;
}

function tarjeta(lugar, lang) {
  // Los de temporada (tianguis navideños) llevan sus fechas: "Todos los días" solo sería engañoso.
  const temporada = datos.etiquetaTemporada(lugar, lang);
  const base = datos.cuandoSePone(lugar, lang);
  const cuando = temporada ? `${I.t(lang, "tianguis.temporada")} ${temporada}${base ? ` · ${base}` : ""}` : base;
  const donde = datos.textoUbicacion(lugar);
  const extra = h`<span class="tg-cuando">${cuando || ""}</span><span class="tg-donde">${donde ? donde.nombre : ""}</span>`;
  return tarjetaLugar(lugar, { lang, extra, sizes: "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" });
}

module.exports = {
  rutas: [DESTINO],
  async pagina(req, ctx) {
    const { lang, t, ruta } = ctx;
    const f = normalizar({ tipo: req.query.tipo, dia: req.query.dia, municipio: req.query.municipio });
    const enlace = (cambios) => `${ruta(DESTINO)}${consultaDe(normalizar({ ...f, ...cambios }))}#filtros`;
    const T = datos.textos(lang);
    const esTianguis = f.tipo === "tianguis";
    const filtrado = f.dia !== null || f.municipio !== null;

    const lugares = lista(f);
    const nTianguis = datos.filtrarTianguis({ tipo: TIPO.tianguis }).length;
    const nMercados = datos.filtrarTianguis({ tipo: TIPO.mercados }).length;

    // --- Pestañas Tianguis / Mercados (con su miniatura)
    const tabs = h`
      <nav class="tg-tabs" aria-label="${t("tianguis.tipoEtiqueta")}">
        ${datos.categoriasTianguis.map((c) =>
          chip({
            texto: t(c.slug === "tianguis" ? "tianguis.tabTianguis" : "tianguis.tabMercados"),
            href: enlace({ tipo: c.slug, dia: null }),
            activo: f.tipo === c.slug,
            miniatura: `${c.miniatura}.webp`,
          }),
        )}
      </nav>`;

    // --- El pizarrón de la semana (solo tianguis): una columna por día
    let pizarron = "";
    if (esTianguis) {
      const porDia = SEMANA.map((d) => ({ d, n: datos.filtrarTianguis({ tipo: TIPO.tianguis, dia: d, municipioId: f.municipio }).length }));
      const maximo = Math.max(1, ...porDia.map((x) => x.n));
      const total = datos.filtrarTianguis({ tipo: TIPO.tianguis, municipioId: f.municipio }).length;
      const nombres = T.diasLargos;
      pizarron = h`
        <nav class="tg-pizarron" aria-label="${t("tianguis.diaEtiqueta")}" data-pizarron data-hoy="${t("tianguis.hoy")}">
          <ul>
            <li class="tg-col tg-col-todos">
              <a href="${enlace({ dia: null })}"${f.dia === null ? h` aria-current="true"` : ""} aria-label="${t("tianguis.diaTodosAria", { n: total })}" data-dia="todos">
                <span class="tg-n" aria-hidden="true">${total}</span>
                <span class="tg-dia" aria-hidden="true">${t("tianguis.diaTodos")}</span>
              </a>
            </li>
            ${porDia.map(
              ({ d, n }) => h`
              <li class="tg-col">
                <a href="${enlace({ dia: d })}"${f.dia === d ? h` aria-current="true"` : ""} aria-label="${t("tianguis.diaAria", { dia: nombres[d], n })}" data-dia="${d}">
                  <span class="tg-n" aria-hidden="true">${n}</span>
                  <span class="tg-barra" style="--p:${(n / maximo).toFixed(3)}" aria-hidden="true"></span>
                  <span class="tg-dia" aria-hidden="true">${T.diasCortos[d]}</span>
                </a>
              </li>`,
            )}
          </ul>
        </nav>`;
    }

    // --- Municipios (solo los que tienen lugares de ese tipo), con su estampa y el conteo
    const municipiosDelTipo = datos.municipiosConLugares(TIPO[f.tipo]).map((id) => datos.municipioPorId(id));
    const chipsMunicipio = h`
      <nav class="tg-munis" aria-label="${t("tianguis.municipioEtiqueta")}">
        ${chip({ texto: t("tianguis.municipioTodos"), href: enlace({ municipio: null }), activo: f.municipio === null })}
        ${municipiosDelTipo.map((m) => {
          const n = datos.filtrarTianguis({ tipo: TIPO[f.tipo], dia: f.dia, municipioId: m.id }).length;
          return chip({
            texto: h`${m.nombre}<span class="tg-chip-n">${n}</span>`,
            href: enlace({ municipio: m.id }),
            activo: f.municipio === m.id,
            miniatura: m.estampa,
            attrs: n === 0 ? { "data-vacio": "" } : undefined,
          });
        })}
      </nav>`;

    // --- Resultados
    let resultados;
    if (lugares.length === 0) {
      resultados = estadoVista({
        icono: "tienda",
        titulo: t(esTianguis ? "tianguis.vacioTitulo" : "tianguis.vacioMercados"),
        mensaje: t("tianguis.vacioTexto"),
        accion: { texto: t("tianguis.quitarFiltros"), href: ctx.ruta(DESTINO) + (esTianguis ? "" : "?tipo=mercados") + "#filtros", variante: "contorno" },
      });
    } else {
      // Encabezado de municipio + tarjetas; los encabezados no cuentan para los anuncios.
      const grupos = ordenaPorMunicipio(lugares);
      const conGrupos = f.municipio === null && grupos.length > 1;
      const piezas = [];
      for (const g of grupos) {
        if (conGrupos) piezas.push({ grupo: g });
        for (const l of g.lugares) piezas.push({ lugar: l });
      }
      const mezcla = intercalarAnuncios(piezas, { cada: 3, cuenta: (p) => !!p.lugar });
      const filas = mezcla.map((p) => {
        if (p.anuncio) return anuncio({ lang, formato: p.formato, indice: p.indice });
        return p.grupo ? cabeceraGrupo(p.grupo) : tarjeta(p.lugar, lang);
      });
      resultados = h`
        <h2 class="tg-resumen">${I.tn(lang, esTianguis ? "tianguis.resumenTianguis" : "tianguis.resumenMercados", lugares.length)}</h2>
        <div class="rejilla-lugares tg-lista">${filas}</div>`;
    }

    const cuerpo = h`
      <div class="tg-pagina">
        <div class="envoltura">
          ${letrero({
            id: "t-tianguis",
            texto: t("tianguis.letrero"),
            tinta: "bandera",
            giro: -0.9,
            entrada: t("tianguis.entrada"),
            extra: h`<div class="tg-sugerir">${boton({ texto: t("tianguis.sugerir"), href: ruta("/sugerir/lugar?tipo=tianguis"), variante: "contorno", chico: true, icono: "mas" })}</div>`,
            focos: 30,
            comba: 0.5,
          })}
          <section class="tg-filtros" id="filtros">
            ${tabs}
            ${pizarron}
            ${chipsMunicipio}
          </section>
          <section class="tg-resultados">${resultados}</section>
        </div>
      </div>`;

    // --- SEO: la vista sin filtros es la que se indexa; el resto apunta a ella y no se indexa.
    const dia = f.dia !== null ? T.diasLargos[f.dia].toLowerCase() : "";
    const muni = f.municipio !== null ? datos.municipioPorId(f.municipio).nombre : "";
    let titulo;
    let descripcion;
    if (!filtrado) {
      titulo = esTianguis ? t("tianguis.tituloTianguis") : t("tianguis.tituloMercados", { n: nMercados });
      descripcion = esTianguis ? t("tianguis.descripcionTianguis", { n: nTianguis }) : t("tianguis.descripcionMercados", { n: nMercados });
    } else {
      titulo = dia && muni ? t("tianguis.tituloDiaMunicipio", { dia, municipio: muni }) : dia ? t("tianguis.tituloDia", { dia }) : esTianguis ? t("tianguis.tituloMunicipio", { municipio: muni }) : t("tianguis.tituloMercadosMunicipio", { municipio: muni });
      descripcion = t("tianguis.descripcionFiltrada", { titulo, resumen: I.tn(lang, esTianguis ? "tianguis.resumenTianguis" : "tianguis.resumenMercados", lugares.length) });
    }
    const base = consultaDe(normalizar({ tipo: f.tipo }));
    const canonical = `${I.urlAbsoluta(lang, DESTINO)}${base}`;

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: titulo,
        numberOfItems: lugares.length,
        itemListElement: lugares.map((l, i) => ({ "@type": "ListItem", position: i + 1, name: l.titulo, url: I.urlAbsoluta(lang, `/lugar/${l.slug}`) })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("tianguis.migasInicio"), item: I.urlAbsoluta(lang, "/inicio") },
          { "@type": "ListItem", position: 2, name: t("tianguis.letrero"), item: I.urlAbsoluta(lang, DESTINO) },
        ],
      },
    ];

    return {
      titulo,
      descripcion,
      activa: "inicio",
      ruta: DESTINO,
      consulta: consultaDe(f),
      canonical,
      robots: filtrado ? "noindex, follow" : undefined,
      cuerpo,
      css: ["tianguis"],
      js: ["paginas/tianguis"],
      jsonLd,
      cache: "estatico",
    };
  },
};
