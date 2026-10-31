// Endpoints /g/* de lo que la app sumó y depende del backend: clima y oleaje de las playas, avisos de
// protección civil, reseñas, "Pregúntale a un local" y "Cómo está ahora" (reportes en vivo). Se montan
// en el router de api.js (mismas reglas: el navegador nunca habla con el backend, validación aquí,
// verificarOrigen en lo que escribe, límites propios y errores en español).
//
//   GET    /clima-mar/:id                       → { clima, mar, actualizado, fuentes }
//   GET    /alertas                             → { alertas:[…] }
//   GET    /resenas?id=&pagina=                 → { resumen, resenas, hayMas, miResena }
//   POST   /resenas {id, calificacion, texto}   → { ok, resena }
//   DELETE /resenas/:id                         → { ok }
//   POST   /resenas/reportar {idResena, motivo} → { ok, oculta }
//   GET    /preguntas?tipo=&id=&pagina=         → { resumen, preguntas, hayMas }
//   POST   /preguntas {tipo, id, texto}         → { ok }
//   POST   /preguntas/responder {idPregunta, texto} → { ok }
//   DELETE /preguntas/:idPregunta[/:idRespuesta]    → { ok }
//   POST   /preguntas/reportar {idPregunta, idRespuesta?, motivo} → { ok, oculta }
//   GET    /vivo/lugar/:id                      → { tipos, reportes, miReporte }
//   POST   /vivo {id, tipo, nota?}              → { ok }
//   DELETE /vivo/:id                            → { ok }
//   POST   /vivo/reportar {idReporte, motivo}   → { ok, oculto }
//
// Del backend nunca se devuelve el _id de quien escribió (campo `user`): la web no ofrece bloquear
// personas, solo reportar. Los reportes en vivo se publican sin ubicación ("cerca" queda en falso).

const TIPOS_VIVO = ["mucha_gente", "poca_gente", "hay_sombra_agua", "rio_crecido", "oleaje_fuerte", "cerrado"];
const MAX = { resena: 500, pregunta: 200, respuesta: 500, nota: 80, motivo: 300 };

module.exports = function montar(router, H) {
  const { backend, ruta, ErrorApi, idDe, cuerpo, conSesionOpcional, verificarOrigen, exigirUsuario, limitar, porIp, porUsuario, MSG_GENERICO_429 } = H;
  const MINUTO = 60 * 1000;
  const leer = limitar({ clave: porIp, max: 90, ventanaMs: MINUTO, mensaje: MSG_GENERICO_429 });
  const escribir = limitar({ clave: porUsuario, max: 12, ventanaMs: MINUTO, mensaje: "Estás publicando muy rápido. Espera un momento e inténtalo de nuevo." });
  const reportar = limitar({ clave: porUsuario, max: 5, ventanaMs: MINUTO, mensaje: "Enviaste varios reportes seguidos. Espera un momento e inténtalo de nuevo." });

  const texto = (valor, max, vacio = "Escribe algo antes de enviarlo.", opcional = false) => {
    if (valor === undefined || valor === null || valor === "") {
      if (opcional) return "";
      throw new ErrorApi(400, vacio);
    }
    if (typeof valor !== "string") throw new ErrorApi(400, vacio);
    const limpio = valor.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (!limpio && !opcional) throw new ErrorApi(400, vacio);
    if (limpio.length > max) throw new ErrorApi(400, `No puede pasar de ${max} caracteres.`);
    return limpio;
  };
  const pagina = (v) => (/^\d{1,3}$/.test(String(v || "")) ? Number(v) : 1);
  const sinUsuario = ({ user, ...resto }) => resto; // eslint-disable-line no-unused-vars

  // Cachés cortas para lo anónimo
  const cache = new Map();
  async function cacheado(clave, ttl, cargar) {
    const g = cache.get(clave);
    if (g && Date.now() - g.t < ttl) return g.v;
    const v = await cargar();
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    cache.set(clave, { v, t: Date.now() });
    return v;
  }

  // --- Clima y mar ---
  router.get("/clima-mar/:id", leer, ruta(async (req, res) => {
    const id = idDe(req.params.id);
    const lang = req.query.lang === "en" ? "en" : "es";
    const d = await cacheado(`cm:${id}:${lang}`, 10 * MINUTO, () => backend(null, `/clima-mar/${id}`, { query: { lang } }));
    res.json({ clima: d.clima || null, mar: d.mar || null, actualizado: d.actualizado || null, fuentes: d.fuentes || { clima: null, mar: null } });
  }));

  // --- Avisos de protección civil ---
  router.get("/alertas", leer, ruta(async (req, res) => {
    const d = await cacheado("alertas", 2 * MINUTO, () => backend(null, "/alertas"));
    res.json({ alertas: (Array.isArray(d.alertas) ? d.alertas : []).map(({ _id, ...a }) => ({ id: _id, ...a })) });
  }));

  // --- Reseñas ---
  router.get("/resenas", leer, ruta(async (req, res) => {
    const idPost = idDe(req.query.id);
    const d = await conSesionOpcional(req, res, (token) => backend(token, "/resenas", { query: { idPost, pagina: pagina(req.query.pagina) } }));
    res.json({ resumen: d.resumen, resenas: (d.resenas || []).map(sinUsuario), hayMas: !!d.hayMas, miResena: d.miResena ? sinUsuario(d.miResena) : null });
  }));
  router.post("/resenas", verificarOrigen, exigirUsuario, escribir, ruta(async (req, res) => {
    const b = cuerpo(req);
    const idPost = idDe(b.id);
    const calificacion = Number(b.calificacion);
    if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) throw new ErrorApi(400, "Elige una calificación de 1 a 5.");
    const d = await backend(req.usuario.token, "/resenas", { method: "POST", body: { idPost, calificacion, texto: texto(b.texto, MAX.resena, "", true) } });
    res.status(201).json({ ok: true, resena: d.resena ? sinUsuario(d.resena) : null });
  }));
  router.delete("/resenas/:id", verificarOrigen, exigirUsuario, escribir, ruta(async (req, res) => {
    await backend(req.usuario.token, "/resenas", { method: "DELETE", query: { idPost: idDe(req.params.id) }, sinCuerpo: true });
    res.json({ ok: true });
  }));
  router.post("/resenas/reportar", verificarOrigen, exigirUsuario, reportar, ruta(async (req, res) => {
    const b = cuerpo(req);
    const d = await backend(req.usuario.token, "/resenas/reportar", { method: "POST", body: { idResena: idDe(b.idResena), motivo: texto(b.motivo, MAX.motivo, "Cuéntanos el motivo del reporte.") } });
    res.json({ ok: true, oculta: !!d.oculta });
  }));

  // --- Preguntas ---
  const destino = (tipo) => {
    if (tipo !== "lugar" && tipo !== "municipio") throw new ErrorApi(400, "El destino de la pregunta no es válido.");
    return tipo;
  };
  const idDestino = (tipo, id) => (tipo === "municipio" ? (/^(10|[1-9])$/.test(String(id)) ? String(id) : idDe(id)) : idDe(id));
  router.get("/preguntas", leer, ruta(async (req, res) => {
    const tipo = destino(req.query.tipo);
    const d = await conSesionOpcional(req, res, (token) => backend(token, "/preguntas", { query: { tipo, id: idDestino(tipo, req.query.id), pagina: pagina(req.query.pagina) } }));
    const limpia = (r) => sinUsuario(r);
    res.json({ resumen: d.resumen, preguntas: (d.preguntas || []).map((p) => ({ ...limpia(p), respuestas: (p.respuestas || []).map(limpia) })), hayMas: !!d.hayMas });
  }));
  router.post("/preguntas", verificarOrigen, exigirUsuario, escribir, ruta(async (req, res) => {
    const b = cuerpo(req), tipo = destino(b.tipo);
    await backend(req.usuario.token, "/preguntas", { method: "POST", body: { tipo, id: idDestino(tipo, b.id), texto: texto(b.texto, MAX.pregunta) } });
    res.status(201).json({ ok: true });
  }));
  router.post("/preguntas/responder", verificarOrigen, exigirUsuario, escribir, ruta(async (req, res) => {
    const b = cuerpo(req);
    await backend(req.usuario.token, "/preguntas/responder", { method: "POST", body: { idPregunta: idDe(b.idPregunta), texto: texto(b.texto, MAX.respuesta) } });
    res.status(201).json({ ok: true });
  }));
  router.delete("/preguntas/:idPregunta", verificarOrigen, exigirUsuario, escribir, ruta(async (req, res) => {
    await backend(req.usuario.token, "/preguntas", { method: "DELETE", query: { idPregunta: idDe(req.params.idPregunta) }, sinCuerpo: true });
    res.json({ ok: true });
  }));
  router.delete("/preguntas/:idPregunta/:idRespuesta", verificarOrigen, exigirUsuario, escribir, ruta(async (req, res) => {
    await backend(req.usuario.token, "/preguntas/respuesta", { method: "DELETE", query: { idPregunta: idDe(req.params.idPregunta), idRespuesta: idDe(req.params.idRespuesta) }, sinCuerpo: true });
    res.json({ ok: true });
  }));
  router.post("/preguntas/reportar", verificarOrigen, exigirUsuario, reportar, ruta(async (req, res) => {
    const b = cuerpo(req);
    const body = { idPregunta: idDe(b.idPregunta), motivo: texto(b.motivo, MAX.motivo, "Cuéntanos el motivo del reporte.") };
    if (b.idRespuesta) body.idRespuesta = idDe(b.idRespuesta);
    const d = await backend(req.usuario.token, "/preguntas/reportar", { method: "POST", body });
    res.json({ ok: true, oculta: !!d.oculta });
  }));

  // --- Cómo está ahora ---
  router.get("/vivo/lugar/:id", leer, ruta(async (req, res) => {
    const idPost = idDe(req.params.id);
    const d = await conSesionOpcional(req, res, (token) => backend(token, "/reportes-vivo/lugar", { query: { idPost } }));
    res.json({ tipos: (d.tiposDisponibles || TIPOS_VIVO).filter((x) => TIPOS_VIVO.includes(x)), reportes: (d.reportes || []).map(sinUsuario), miReporte: d.miReporte ? sinUsuario(d.miReporte) : null });
  }));
  router.post("/vivo", verificarOrigen, exigirUsuario, escribir, ruta(async (req, res) => {
    const b = cuerpo(req);
    if (!TIPOS_VIVO.includes(b.tipo)) throw new ErrorApi(400, "Elige cómo está el lugar.");
    await backend(req.usuario.token, "/reportes-vivo", { method: "POST", body: { idPost: idDe(b.id), tipo: b.tipo, nota: texto(b.nota, MAX.nota, "", true) } });
    res.status(201).json({ ok: true });
  }));
  router.delete("/vivo/:id", verificarOrigen, exigirUsuario, escribir, ruta(async (req, res) => {
    await backend(req.usuario.token, "/reportes-vivo", { method: "DELETE", query: { idPost: idDe(req.params.id) }, sinCuerpo: true });
    res.json({ ok: true });
  }));
  router.post("/vivo/reportar", verificarOrigen, exigirUsuario, reportar, ruta(async (req, res) => {
    const b = cuerpo(req);
    const d = await backend(req.usuario.token, "/reportes-vivo/reportar", { method: "POST", body: { idReporte: idDe(b.idReporte), motivo: texto(b.motivo, MAX.motivo, "Cuéntanos el motivo del reporte.") } });
    res.json({ ok: true, oculto: !!d.oculto });
  }));

  router._extraInterno = { reiniciar() { cache.clear(); [leer, escribir, reportar].forEach((l) => l.reiniciar && l.reiniciar()); } };
};
