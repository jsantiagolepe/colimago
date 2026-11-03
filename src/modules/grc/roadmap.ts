// Ruta de 6 meses para entrar a GRC (Gobierno, Riesgo y Cumplimiento) en
// ciberseguridad: primero el SGSI e ISO 27001, a la par la práctica en una
// empresa ficticia, después el portafolio y el CV (a partir del mes 3 ya se
// aplica a vacantes), las herramientas y la IA, y al final Lead Implementer.
//
// Es contenido fijo: lo que se guarda es solo qué pasos ya terminaste
// (model.ts). Los ids de los pasos no deben cambiar, o se pierde su check.

export type TaskKind = 'estudio' | 'practica' | 'herramienta' | 'carrera' | 'cert';

export interface RoadmapLink {
  label: string;
  url: string;
}

export interface RoadmapTask {
  id: string;
  title: string;
  /** Cómo hacerlo o qué entregar. */
  detail?: string;
  kind: TaskKind;
  links?: RoadmapLink[];
  /** Si es un hito, su nombre corto para la fila de hitos. */
  milestone?: string;
}

export interface RoadmapWeek {
  /** 1 a 26. */
  n: number;
  title: string;
  /** Qué debes poder hacer al terminar la semana. */
  goal: string;
  tasks: RoadmapTask[];
}

export interface RoadmapPhase {
  id: string;
  month: number;
  title: string;
  summary: string;
  color: string;
  weeks: RoadmapWeek[];
}

export const KINDS: Record<TaskKind, { label: string; color: string }> = {
  estudio: { label: 'Estudio', color: '#3364c9' },
  practica: { label: 'Empresa ficticia', color: '#1f8a6e' },
  herramienta: { label: 'Herramienta / IA', color: '#8a4fc9' },
  carrera: { label: 'Carrera', color: '#c97a14' },
  cert: { label: 'Certificación', color: '#c9384a' },
};

/** La empresa ficticia donde implementas todo lo que estudias. */
export const COMPANY = {
  name: 'Pacífica Logística',
  pitch:
    'Empresa ficticia de logística en Manzanillo, Colima: 80 empleados, rastreo de envíos para tiendas en línea, ' +
    'oficina y bodega. Usa Google Workspace, un ERP en la nube, una app de rastreo en AWS y laptops propias. ' +
    'Sus clientes le piden pruebas de seguridad y la dirección quiere certificarse en ISO 27001.',
};

// Enlaces que se repiten.
const L = {
  adviseraFoundations: { label: 'Advisera: ISO 27001 Foundations (curso gratis)', url: 'https://advisera.com/training/iso-27001-foundations-course/' },
  adviseraAuditor: { label: 'Advisera: Internal Auditor (curso gratis)', url: 'https://advisera.com/training/iso-27001-internal-auditor-course/' },
  adviseraLI: { label: 'Advisera: Lead Implementer', url: 'https://training.advisera.com/course/iso-27001-lead-implementer-course/' },
  pecbLI: { label: 'PECB: ISO/IEC 27001', url: 'https://pecb.com/en/education-and-certification-for-individuals/iso-iec-27001' },
  alison: { label: 'Alison: SGSI ISO 27001 (español, gratis)', url: 'https://alison.com/es/curso/iso-iec-27001-sistemas-de-gestion-de-seguridad-de-la-informacion-sgsi' },
  iso27000: { label: 'ISO: normas gratuitas (incluye 27000)', url: 'https://standards.iso.org/ittf/PubliclyAvailableStandards/' },
  iso27001: { label: 'ISO/IEC 27001 en iso.org', url: 'https://www.iso.org/standard/27001' },
  nistCsf: { label: 'NIST Cybersecurity Framework 2.0', url: 'https://www.nist.gov/cyberframework' },
  nist80030: { label: 'NIST SP 800-30 (evaluación de riesgos)', url: 'https://csrc.nist.gov/pubs/sp/800/30/r1/final' },
  cis: { label: 'CIS Controls', url: 'https://www.cisecurity.org/controls' },
  cisoAssistant: { label: 'CISO Assistant (open source)', url: 'https://github.com/intuitem/ciso-assistant-community' },
  eramba: { label: 'Eramba (community)', url: 'https://eramba.org' },
  ghPages: { label: 'GitHub Pages', url: 'https://pages.github.com' },
  loom: { label: 'Loom', url: 'https://www.loom.com' },
  notebookLM: { label: 'NotebookLM', url: 'https://notebooklm.google.com' },
  claude: { label: 'Claude', url: 'https://claude.ai' },
  drawio: { label: 'draw.io', url: 'https://app.diagrams.net' },
  isaca: { label: 'ISACA', url: 'https://www.isaca.org' },
  owasp: { label: 'OWASP capítulos', url: 'https://owasp.org/chapters/' },
  awesomeGrcAi: { label: 'awesome-grc-ai', url: 'https://github.com/ethanolivertroy/awesome-grc-ai' },
  lookerStudio: { label: 'Looker Studio', url: 'https://lookerstudio.google.com' },
} satisfies Record<string, RoadmapLink>;

type Paso = [kind: TaskKind, title: string, detail?: string, links?: RoadmapLink[], milestone?: string];

function semana(n: number, title: string, goal: string, pasos: Paso[]): RoadmapWeek {
  const letras = 'abcdefgh';
  return {
    n,
    title,
    goal,
    tasks: pasos.map(([kind, t, detail, links, milestone], i) => ({
      id: `s${String(n).padStart(2, '0')}-${letras[i]}`,
      kind,
      title: t,
      detail,
      links,
      milestone,
    })),
  };
}

const P = COMPANY.name;

export const PHASES: RoadmapPhase[] = [
  {
    id: 'mes-1',
    month: 1,
    title: 'Fundamentos y SGSI',
    summary: 'Entiendes qué es un SGSI, cómo se analiza un riesgo y creas tu empresa ficticia.',
    color: '#1f8a6e',
    weeks: [
      semana(1, 'Arranque y bases de seguridad', 'Tener tu sistema de estudio listo y dominar el vocabulario básico.', [
        ['practica', 'Prepara tu espacio de trabajo', 'Carpeta “GRC-Portafolio” (Drive o Notion), repo privado grc-portfolio en GitHub y 1 h diaria bloqueada en tu calendario.'],
        ['estudio', 'Tríada CIA y conceptos de riesgo', 'Confidencialidad, integridad, disponibilidad; activo, amenaza, vulnerabilidad, riesgo y control. Escribe tu glosario de 20 términos.'],
        ['estudio', 'Lee ISO/IEC 27000 (vocabulario)', 'Es gratuita. Lee el panorama y los términos y definiciones; complementa tu glosario.', [L.iso27000]],
        ['estudio', 'Inscríbete a ISO 27001 Foundations y termina el módulo 1', 'El curso de Advisera es gratis y está actualizado a la versión 2022; solo el examen se paga.', [L.adviseraFoundations]],
        ['practica', `Crea la ficha de ${P}`, 'Giro, tamaño, procesos, sistemas, proveedores, clientes y organigrama básico (1 página).'],
      ]),
      semana(2, '¿Qué es un SGSI?', 'Explicar las cláusulas 4 a 10 de ISO 27001 y el ciclo PDCA con tus palabras.', [
        ['estudio', 'Estructura de ISO 27001 y ciclo PDCA', 'Siguientes módulos de Advisera Foundations: cláusulas 4–10 y Anexo A.', [L.adviseraFoundations]],
        ['estudio', 'Resumen de una página de las cláusulas 4 a 10', 'Una línea por cláusula: qué pide y qué evidencia se espera.'],
        ['estudio', 'Refuerzo en español: SGSI en Alison (primera mitad)', undefined, [L.alison]],
        ['practica', `${P}: contexto y partes interesadas`, 'Cláusula 4: asuntos internos/externos y tabla de partes interesadas con sus requisitos.'],
      ]),
      semana(3, 'Riesgo: la pieza central', 'Hacer un inventario de activos y definir una metodología de riesgo.', [
        ['estudio', 'Gestión de riesgos: ISO 27005 y NIST SP 800-30', 'Lee las secciones de conceptos y el proceso de evaluación de SP 800-30 (gratis).', [L.nist80030]],
        ['practica', `${P}: inventario de activos`, '20 activos en Google Sheets: nombre, tipo, dueño, ubicación y clasificación.'],
        ['practica', `${P}: metodología de riesgo`, 'Matriz 5×5 (probabilidad × impacto), escalas descritas y criterio de aceptación del riesgo.'],
        ['herramienta', 'IA como lluvia de ideas de amenazas', 'Pide a la IA escenarios de amenaza por activo; tú decides cuáles aplican y por qué. Nunca copies sin revisar.', [L.claude]],
      ]),
      semana(4, 'Anexo A y registro de riesgos', 'Conocer los 93 controles y tener tu primer registro de riesgos.', [
        ['estudio', 'Los 93 controles del Anexo A', 'Cuatro temas: organizacionales, personas, físicos y tecnológicos. Anota 10 que te parezcan clave.'],
        ['practica', `${P}: registro de riesgos`, '15 a 20 riesgos con valoración, dueño y tratamiento (mitigar, transferir, evitar o aceptar).'],
        ['estudio', 'Termina el curso ISO 27001 Foundations', 'Videos y quizzes completos.', [L.adviseraFoundations]],
        ['carrera', 'Primer post en LinkedIn', '“Empiezo mi camino en GRC”: qué estás aprendiendo y por qué. Corto y honesto.'],
      ]),
    ],
  },
  {
    id: 'mes-2',
    month: 2,
    title: 'ISO 27001 a fondo y Foundation',
    summary: 'Escribes los documentos núcleo del SGSI, te certificas en Foundation y cierras tu Proyecto 1.',
    color: '#3364c9',
    weeks: [
      semana(5, 'Alcance, política y SoA', 'Tener los tres documentos que todo auditor pide primero.', [
        ['practica', `${P}: alcance del SGSI`, 'Cláusula 4.3: qué procesos, sedes y sistemas entran y cuáles no, con justificación.'],
        ['practica', `${P}: Política de Seguridad de la Información`, 'Cláusula 5.2. Borrador con IA; tú ajustas al contexto y quitas lo genérico.'],
        ['practica', `${P}: Declaración de Aplicabilidad (SoA)`, 'Los 93 controles en Sheets: aplica / no aplica, justificación y estado.'],
        ['cert', 'Exámenes de práctica de Foundation', 'Haz los de Advisera y anota los temas donde fallas.', [L.adviseraFoundations]],
      ]),
      semana(6, 'Certificación Foundation', 'Obtener tu primera certificación de ISO 27001.', [
        ['cert', 'Dos exámenes de práctica con 80 % o más', 'Repasa solo los temas que fallaste.'],
        ['cert', 'Presenta el examen ISO 27001 Foundations', 'En línea y supervisado. Al aprobar recibes certificado e insignia para LinkedIn.', [L.adviseraFoundations], 'Foundation'],
        ['carrera', 'Agrega la certificación a LinkedIn y a tu CV', 'Sección Licencias y certificaciones + la insignia.'],
        ['practica', `${P}: plan de tratamiento de riesgos`, 'Por riesgo: control elegido, dueño, fecha y riesgo residual esperado.'],
      ]),
      semana(7, 'Políticas clave', 'Saber escribir una política clara y tener las más pedidas.', [
        ['estudio', 'Anatomía de una política', 'Propósito, alcance, roles, declaraciones, excepciones, cumplimiento y revisión. Política ≠ procedimiento ≠ estándar.'],
        ['practica', `${P}: Política de control de accesos`, 'Mínimo privilegio, altas/bajas, MFA, revisión trimestral de accesos.'],
        ['practica', `${P}: Uso aceptable y clasificación de la información`, 'Niveles (pública, interna, confidencial) y cómo se maneja cada uno.'],
        ['practica', `${P}: Procedimiento de gestión de incidentes`, 'Roles, severidades, tiempos de respuesta y a quién se notifica.'],
      ]),
      semana(8, 'NIST CSF 2.0, brechas y Proyecto 1', 'Hablar de dos marcos y entregar tu primer proyecto completo.', [
        ['estudio', 'NIST CSF 2.0', 'Las 6 funciones: Gobernar, Identificar, Proteger, Detectar, Responder y Recuperar.', [L.nistCsf]],
        ['practica', 'Mapeo ISO 27001 ↔ NIST CSF 2.0', 'Tabla de 20 controles del Anexo A con su categoría equivalente en CSF.'],
        ['practica', `${P}: análisis de brechas (gap analysis)`, 'Estado actual vs. lo que pide ISO 27001, con nivel de madurez y prioridad.'],
        ['carrera', `Empaqueta el Proyecto 1: “SGSI de ${P}”`, 'PDF con resumen + hojas de cálculo en tu repo. Indica que la empresa es ficticia.', undefined, 'Proyecto 1'],
      ]),
    ],
  },
  {
    id: 'mes-3',
    month: 3,
    title: 'Portafolio, web, CV y primeras vacantes',
    summary: 'Publicas tu página, dejas listos LinkedIn y CV y empiezas a aplicar cada semana.',
    color: '#c97a14',
    weeks: [
      semana(9, 'Tu página publicada', 'Tener una URL pública con tus proyectos.', [
        ['herramienta', 'Crea tu página con GitHub Pages', 'Secciones: Inicio, Sobre mí, Proyectos, Certificaciones y Contacto. Sencilla y rápida.', [L.ghPages], 'Web'],
        ['carrera', 'Publica el Proyecto 1', 'Formato de caso: problema → enfoque → entregables → resultado. Con enlaces a los archivos.'],
        ['carrera', 'Publica el Proyecto 2: registro y metodología de riesgos', 'Muestra la matriz, 5 riesgos de ejemplo y cómo decidiste el tratamiento.'],
        ['herramienta', 'Video de 3 minutos explicando tu registro de riesgos', 'Graba pantalla y voz; ponlo en la página del proyecto.', [L.loom]],
      ]),
      semana(10, 'LinkedIn y CV', 'Que un reclutador entienda en 10 segundos qué haces.', [
        ['carrera', 'LinkedIn completo', 'Titular (“Analista GRC | ISO 27001 | Gestión de riesgos”), Acerca de, foto, banner y tu web en Destacados.'],
        ['carrera', 'CV de una página orientado a GRC', 'Verbos de logro: documenté, evalué, mapeé, implementé. Versión en español y en inglés.', undefined, 'CV'],
        ['herramienta', 'Revisa tu CV con IA contra 3 ofertas reales', 'Pide palabras clave que faltan y claridad. Regla: nunca inventar experiencia.', [L.claude]],
        ['carrera', 'Analiza 20 ofertas', 'Analista GRC, Cumplimiento, Riesgo de TI, Auditor de TI jr. Anota los requisitos que más se repiten.'],
      ]),
      semana(11, 'Empiezas a aplicar', 'Tener tus primeras 5 aplicaciones enviadas.', [
        ['carrera', 'Aplica a 5 vacantes', 'Registra cada una (empresa, fecha, estado) en Tareas o en una hoja de seguimiento.', undefined, 'Aplicando'],
        ['carrera', 'Conecta con 10 personas de GRC', 'Mensaje breve y concreto; no pidas trabajo en el primer mensaje.'],
        ['carrera', 'Únete a una comunidad', 'Capítulo local de ISACA u OWASP; apúntate a un evento.', [L.isaca, L.owasp]],
        ['practica', `${P}: Proyecto 3 — riesgo de terceros`, 'Cuestionario de 30 preguntas para proveedores y evaluación de 2 proveedores ficticios.'],
      ]),
      semana(12, 'Preparar entrevistas', 'Responder con seguridad las preguntas básicas de GRC.', [
        ['carrera', 'Aplica a 5 vacantes'],
        ['herramienta', 'Simulacro de entrevista con IA', '¿Qué es un SGSI? ¿Cómo harías un análisis de riesgo? ¿Política vs. procedimiento? Pide retroalimentación.', [L.claude]],
        ['carrera', 'Publica el Proyecto 3 y compártelo en LinkedIn'],
        ['estudio', 'Auditoría interna: evidencia y no conformidades', 'Curso gratis de Internal Auditor de Advisera (conceptos de ISO 19011).', [L.adviseraAuditor]],
      ]),
      semana(13, 'Cierre del trimestre', 'Tener todo actualizado y decidida tu siguiente certificación.', [
        ['carrera', 'Aplica a 5 vacantes'],
        ['practica', `${P}: auditoría interna simulada`, 'Plan, checklist de 5 controles, hallazgos e informe breve.'],
        ['carrera', 'Revisión trimestral', 'Actualiza CV, web y LinkedIn con todo lo nuevo. Revisa qué aplicaciones respondieron.'],
        ['cert', 'Decide tu siguiente certificación', 'Lead Implementer (recomendado). Si las ofertas piden base técnica, considera ISC2 CC o Security+.'],
      ]),
    ],
  },
  {
    id: 'mes-4',
    month: 4,
    title: 'Herramientas GRC e IA',
    summary: 'Llevas tu SGSI a una plataforma GRC real, usas IA con criterio y aprendes a reportar a dirección.',
    color: '#8a4fc9',
    weeks: [
      semana(14, 'Una plataforma GRC real', 'Operar riesgos y controles en una herramienta, no solo en hojas de cálculo.', [
        ['herramienta', 'Instala CISO Assistant', 'Con Docker o con su prueba en la nube. Es open source.', [L.cisoAssistant]],
        ['herramienta', `Carga ${P} en CISO Assistant`, 'Activos, riesgos, el marco ISO 27001 y el estado de tus controles.'],
        ['herramienta', 'Documenta el flujo con capturas', 'Servirán para el Proyecto 4.'],
        ['carrera', 'Aplica a 5 vacantes'],
      ]),
      semana(15, 'IA para GRC, con criterio', 'Trabajar más rápido con IA sin perder calidad ni confidencialidad.', [
        ['herramienta', 'Tu biblioteca de prompts', 'Política, escenario de riesgo, mapeo de controles, resumen ejecutivo y respuesta a cuestionario de seguridad.', [L.claude, L.awesomeGrcAi]],
        ['herramienta', 'Estudia con NotebookLM', 'Sube tus notas y entregables y genera preguntas de repaso y resúmenes.', [L.notebookLM]],
        ['practica', 'Escribe tu regla de uso de IA', 'Nada confidencial real en herramientas públicas; todo resultado se revisa; se cita la fuente.'],
        ['carrera', 'Aplica a 5 vacantes'],
      ]),
      semana(16, 'Reportes que se leen', 'Comunicar riesgo a la dirección en lenguaje de negocio.', [
        ['practica', `${P}: informe ejecutivo de riesgos`, '2 páginas: top 5 riesgos, tendencia, decisiones que necesitas de la dirección.'],
        ['herramienta', 'Dashboard de riesgos', 'Mapa de calor y estado de tratamientos en Google Sheets o Looker Studio.', [L.lookerStudio]],
        ['herramienta', 'Explora Eramba (opcional) y compárala con CISO Assistant', undefined, [L.eramba]],
        ['carrera', 'Aplica a 5 vacantes y suma 5 conexiones'],
      ]),
      semana(17, 'Proyecto 4 publicado', 'Mostrar que sabes operar un programa GRC con herramientas.', [
        ['carrera', 'Publica el Proyecto 4: “Programa GRC en herramienta”', 'CISO Assistant + dashboard + informe ejecutivo.', undefined, 'Proyecto 4'],
        ['herramienta', 'Video de 3 minutos del Proyecto 4', undefined, [L.loom]],
        ['carrera', 'Post en LinkedIn con lo que aprendiste'],
        ['carrera', 'Aplica a 5 vacantes'],
      ]),
    ],
  },
  {
    id: 'mes-5',
    month: 5,
    title: 'Continuidad, privacidad y entrevistas',
    summary: 'Cubres continuidad de negocio, privacidad y concientización, y te preparas a fondo para entrevistas.',
    color: '#c9384a',
    weeks: [
      semana(18, 'Continuidad e incidentes', 'Saber qué es un BIA, RTO y RPO y conducir un ejercicio de mesa.', [
        ['estudio', 'Continuidad de negocio', 'BIA, RTO, RPO y conceptos de ISO 22301.'],
        ['practica', `${P}: BIA y plan de continuidad`, 'Tres procesos críticos con su impacto, RTO/RPO y estrategia de recuperación.'],
        ['practica', `${P}: ejercicio de mesa de ransomware`, 'Guion, roles, decisiones y lecciones aprendidas.'],
        ['carrera', 'Aplica a 5 vacantes'],
      ]),
      semana(19, 'Privacidad y regulación', 'Relacionar requisitos legales con controles.', [
        ['estudio', 'Ley de protección de datos de tu país y nociones de GDPR', 'En México, la LFPDPPP vigente. Principios, derechos ARCO y aviso de privacidad.'],
        ['practica', `${P}: inventario de datos personales`, 'Qué datos, de quién, para qué, dónde se guardan y quién accede.'],
        ['practica', 'Mapea requisitos de privacidad a controles', 'Requisito legal → control ISO 27001 → evidencia.'],
        ['carrera', 'Aplica a 5 vacantes'],
      ]),
      semana(20, 'Concientización y métricas', 'Diseñar un programa de concientización y medir el SGSI.', [
        ['practica', `${P}: programa anual de concientización`, 'Temas por mes, público, formato y métricas.'],
        ['practica', 'Módulo de capacitación sobre phishing', '10 diapositivas con ejemplos y un quiz.'],
        ['practica', 'Indicadores del SGSI', '8 KPIs: % de personal capacitado, tiempo de respuesta a incidentes, revisiones de acceso a tiempo…'],
        ['carrera', 'Aplica a 5 vacantes'],
      ]),
      semana(21, 'Entrevistas a fondo', 'Contar tus proyectos como experiencia real.', [
        ['herramienta', 'Simulacro de entrevista de 30 minutos con IA', 'Y uno con una persona real si puedes.', [L.claude]],
        ['carrera', 'Cinco historias STAR con tus proyectos', 'Situación, tarea, acción y resultado, cada una en 2 minutos.'],
        ['estudio', 'Temas técnicos a nivel GRC', 'Cifrado, MFA, respaldos, gestión de vulnerabilidades y de parches: qué son y qué control los cubre.', [L.cis]],
        ['carrera', 'Aplica a 5 vacantes y da seguimiento a las anteriores'],
      ]),
    ],
  },
  {
    id: 'mes-6',
    month: 6,
    title: 'Lead Implementer y búsqueda intensiva',
    summary: 'Te certificas como Lead Implementer, cierras tu SGSI completo y aceleras la búsqueda.',
    color: '#0f7c8c',
    weeks: [
      semana(22, 'Lead Implementer I', 'Planear la implementación de un SGSI de principio a fin.', [
        ['cert', 'Elige proveedor y presupuesto de Lead Implementer', 'Advisera (curso gratis + examen) o PECB con un partner (curso con examen incluido). Revisa precios actuales.', [L.adviseraLI, L.pecbLI]],
        ['estudio', 'Planeación e inicio del proyecto SGSI', 'Dominios de inicio, contexto, liderazgo y planeación.'],
        ['practica', `${P}: plan de implementación a 12 meses`, 'Fases, entregables, responsables y cronograma (Gantt).'],
        ['carrera', 'Aplica a 5 vacantes'],
      ]),
      semana(23, 'Lead Implementer II', 'Operar, medir y mejorar el SGSI.', [
        ['estudio', 'Implementación, monitoreo, mejora y auditoría de certificación', 'Etapas 1 y 2 de la auditoría externa.'],
        ['practica', `${P}: revisión por la dirección`, 'Cláusula 9.3: acta simulada con entradas y decisiones.'],
        ['practica', `${P}: acciones correctivas`, 'Para los hallazgos de tu auditoría interna: causa raíz, acción y verificación.'],
        ['carrera', 'Aplica a 5 vacantes'],
      ]),
      semana(24, 'Examen Lead Implementer', 'Certificarte.', [
        ['cert', 'Dos exámenes de práctica'],
        ['cert', 'Presenta el examen Lead Implementer', 'Sin experiencia comprobable, PECB otorga primero el nivel Provisional; se sube de nivel con horas de proyecto.', undefined, 'Lead Implementer'],
        ['carrera', 'Actualiza LinkedIn y CV con la certificación'],
        ['carrera', 'Aplica a 5 vacantes'],
      ]),
      semana(25, 'Capstone: tu SGSI completo', 'Tener un caso de estudio que puedas mostrar en cualquier entrevista.', [
        ['carrera', `Publica el capstone “SGSI de ${P}”`, 'Índice de todos los entregables y un caso de estudio de una página.', undefined, 'Capstone'],
        ['herramienta', 'Video de 5 minutos recorriendo el SGSI', undefined, [L.loom]],
        ['carrera', 'Aplica a 10 vacantes'],
      ]),
      semana(26, 'Siguiente nivel', 'Cerrar la ruta y planear los siguientes 6 meses.', [
        ['carrera', 'Retrospectiva de 6 meses', 'Qué funcionó, qué no, qué ofertas respondieron y por qué.'],
        ['cert', 'Plan de los próximos 6 meses', 'Lead Auditor, ISO 42001 (IA) y, con experiencia, CISA o CRISC.', [L.isaca]],
        ['carrera', 'Aplica a 10 vacantes y da seguimiento'],
        ['carrera', 'Celebra: terminaste la ruta'],
      ]),
    ],
  },
];

export const WEEKS: RoadmapWeek[] = PHASES.flatMap((p) => p.weeks);
export const TASKS: RoadmapTask[] = WEEKS.flatMap((w) => w.tasks);
export const TOTAL_WEEKS = WEEKS.length;

/** Recursos de la pestaña Recursos, por grupo. Precios aproximados a noviembre de 2026. */
export const RESOURCES: { title: string; items: (RoadmapLink & { note: string })[] }[] = [
  {
    title: 'Cursos y certificaciones',
    items: [
      { ...L.adviseraFoundations, note: 'Curso gratis actualizado a ISO 27001:2022; el examen se paga y da certificado acreditado e insignia para LinkedIn.' },
      { ...L.alison, note: 'Curso gratuito en español para reforzar conceptos de SGSI.' },
      { ...L.adviseraAuditor, note: 'Curso gratis de auditoría interna; ideal antes de tu auditoría simulada.' },
      { ...L.adviseraLI, note: 'Opción económica de Lead Implementer: curso gratis, examen de pago.' },
      { ...L.pecbLI, note: 'La más reconocida. El examen Lead de PECB cuesta unos US$1,000; con curso y examen incluido suele rondar US$2,000. Sin experiencia el título inicial es “Provisional”.' },
      { label: 'ISC2 Certified in Cybersecurity (CC)', url: 'https://www.isc2.org/certifications/cc', note: 'Base técnica opcional. El programa gratuito cerró el 20 de mayo de 2026; ahora cuesta US$199 + US$50 al año.' },
    ],
  },
  {
    title: 'Marcos y normas',
    items: [
      { ...L.iso27000, note: 'ISO/IEC 27000 (vocabulario) es de descarga gratuita.' },
      { ...L.iso27001, note: 'La norma en sí es de pago; cómprala cuando prepares Lead Implementer.' },
      { ...L.nistCsf, note: 'Gratis. Versión 2.0, con la función Gobernar.' },
      { ...L.nist80030, note: 'Guía gratuita para evaluar riesgos.' },
      { ...L.cis, note: 'Controles priorizados; útiles para entender el lado técnico.' },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { ...L.cisoAssistant, note: 'Plataforma GRC open source: riesgos, controles, marcos y auditorías.' },
      { ...L.eramba, note: 'Alternativa GRC con edición Community gratuita.' },
      { ...L.ghPages, note: 'Hospeda tu página de portafolio gratis.' },
      { ...L.drawio, note: 'Diagramas de alcance, procesos y arquitectura.' },
      { ...L.lookerStudio, note: 'Dashboards gratuitos a partir de Google Sheets.' },
      { ...L.loom, note: 'Videos cortos explicando tus proyectos.' },
    ],
  },
  {
    title: 'IA para GRC',
    items: [
      { ...L.claude, note: 'Borradores de políticas, escenarios de riesgo, mapeos, simulacros de entrevista y revisión de CV.' },
      { ...L.notebookLM, note: 'Estudia sobre tus propios apuntes: resúmenes y preguntas de repaso.' },
      { ...L.awesomeGrcAi, note: 'Lista curada de herramientas y marcos de IA + GRC (incluye gobierno de IA).' },
    ],
  },
];

/** Reglas de la pestaña Método. */
export const RULES: { title: string; text: string }[] = [
  { title: 'Un solo proyecto', text: `Todo lo que practiques va en ${COMPANY.name}. Nada de empezar otra empresa, otro curso u otro marco hasta terminar la ruta.` },
  { title: 'Semana cerrada, semana nueva', text: 'No abras la siguiente semana hasta palomear la actual. Si te atrasas, reprograma desde hoy: se mueve el calendario, no tu avance.' },
  { title: 'Estudio y práctica a la par', text: 'Cada tema que estudias se convierte esa misma semana en un entregable de la empresa ficticia.' },
  { title: 'Todo deja evidencia', text: 'Cada paso termina en un archivo en tu carpeta GRC-Portafolio. Lo que no está escrito, no pasó (igual que en una auditoría).' },
  { title: 'La IA es borrador, tú eres el analista', text: 'Úsala para arrancar y revisar, nunca para entregar sin leer. Nada confidencial real en herramientas públicas.' },
  { title: 'Ritmo fijo', text: 'Entre 8 y 10 horas por semana: 1 h de lunes a viernes y un bloque de 3 a 5 h el fin de semana para la práctica.' },
];

const semanaDePaso = new Map(WEEKS.flatMap((w) => w.tasks.map((t) => [t.id, w] as const)));

/** La semana a la que pertenece un paso. */
export const weekOfTask = (taskId: string) => semanaDePaso.get(taskId);
