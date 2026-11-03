// Guía de estudio de cada paso de la ruta: qué aprender primero y qué
// después, los conceptos que debes poder explicar, qué buscar, dónde
// aprenderlo (gratis, YouTube, Udemy), qué practicar, tips y la estructura
// del entregable. Los pasos sin guía propia usan la de su tipo.
//
// Los cursos de Udemy y los videos se enlazan como búsquedas: así siempre
// ves lo más nuevo y mejor calificado, y nunca un enlace roto.

import type { RoadmapLink, RoadmapTask, TaskKind } from './roadmap';

export type SourceKind = 'gratis' | 'video' | 'curso' | 'lectura' | 'herramienta';

export interface GuideSource extends RoadmapLink {
  kind: SourceKind;
  /** Por qué este y no otro. */
  note?: string;
}

export interface Guide {
  /** Qué es y por qué importa, en dos líneas. */
  why: string;
  /** Cómo estudiarlo, en orden: primero esto, luego aquello. */
  steps: string[];
  /** Lo que debes poder explicar sin ver tus notas: [término, definición]. */
  concepts?: [string, string][];
  /** Qué escribir en Google o YouTube. */
  searches: string[];
  sources?: GuideSource[];
  /** Qué hacer con las manos. */
  practice: string[];
  tips?: string[];
  /** Estructura del entregable (secciones o columnas). */
  template?: string[];
  /** Prompt para la IA, si aplica. */
  prompt?: string;
}

export const SOURCE_KINDS: Record<SourceKind, string> = {
  gratis: 'Gratis',
  video: 'Video',
  curso: 'Curso',
  lectura: 'Lectura',
  herramienta: 'Herramienta',
};

const q = encodeURIComponent;
export const googleUrl = (texto: string) => `https://www.google.com/search?q=${q(texto)}`;
export const youtubeUrl = (texto: string) => `https://www.youtube.com/results?search_query=${q(texto)}`;
export const udemyUrl = (texto: string) => `https://www.udemy.com/courses/search/?q=${q(texto)}&sort=highest-rated`;

const yt = (label: string, busqueda: string, note?: string): GuideSource => ({ kind: 'video', label, url: youtubeUrl(busqueda), note });
const udemy = (label: string, busqueda: string, note?: string): GuideSource => ({ kind: 'curso', label, url: udemyUrl(busqueda), note });

// Fuentes que se repiten.
const S = {
  advisera: { kind: 'gratis', label: 'Advisera ISO 27001 Foundations', url: 'https://advisera.com/training/iso-27001-foundations-course/', note: 'Gratis y actualizado a 2022. Tu curso base.' },
  adviseraBlog: { kind: 'lectura', label: 'Blog de Advisera (27001Academy)', url: 'https://advisera.com/27001academy/blog/', note: 'Artículos claros sobre cada cláusula y control.' },
  alison: { kind: 'gratis', label: 'Alison: SGSI en español', url: 'https://alison.com/es/curso/iso-iec-27001-sistemas-de-gestion-de-seguridad-de-la-informacion-sgsi', note: 'Útil para conceptos en español; su Anexo A es de la versión 2013.' },
  iso27000: { kind: 'lectura', label: 'ISO/IEC 27000 gratis', url: 'https://standards.iso.org/ittf/PubliclyAvailableStandards/', note: 'Busca 27000 en la lista: vocabulario oficial.' },
  isoOBP: { kind: 'lectura', label: 'ISO Online Browsing Platform', url: 'https://www.iso.org/obp/ui/', note: 'Muestra gratis el índice y las definiciones de las normas.' },
  nist80030: { kind: 'lectura', label: 'NIST SP 800-30 Rev. 1', url: 'https://csrc.nist.gov/pubs/sp/800/30/r1/final', note: 'Proceso de evaluación de riesgos; lee secciones 2 y 3.' },
  nistCsf: { kind: 'lectura', label: 'NIST CSF 2.0', url: 'https://www.nist.gov/cyberframework', note: 'Incluye guías rápidas y perfiles de ejemplo.' },
  nistGlossary: { kind: 'lectura', label: 'Glosario de NIST (CSRC)', url: 'https://csrc.nist.gov/glossary', note: 'Definiciones oficiales de cualquier término.' },
  cis: { kind: 'lectura', label: 'CIS Controls v8', url: 'https://www.cisecurity.org/controls', note: 'Controles técnicos priorizados.' },
  simplyCyber: yt('Simply Cyber (Gerald Auger)', 'Simply Cyber GRC analyst', 'El canal más enfocado en carrera GRC.'),
  messer: yt('Professor Messer: Security+', 'Professor Messer Security+ SY0-701', 'Fundamentos de seguridad gratis y muy ordenados.'),
  udemyFoundation: udemy('Udemy: ISO 27001:2022 Foundation by Example', 'ISO 27001:2022 Foundation by Example', 'Bien calificado (≈4.6) y con ejemplos; cómpralo en oferta.'),
  udemyLab: { kind: 'curso', label: 'Udemy: Practical ISO 27001:2022 Lab', url: 'https://www.udemy.com/course/6895975/', note: 'Muy práctico: riesgo, SoA, auditoría y revisión por la dirección.' },
  cisoAssistant: { kind: 'herramienta', label: 'CISO Assistant', url: 'https://github.com/intuitem/ciso-assistant-community' },
  claude: { kind: 'herramienta', label: 'Claude', url: 'https://claude.ai' },
  notebookLM: { kind: 'herramienta', label: 'NotebookLM', url: 'https://notebooklm.google.com' },
  sheets: { kind: 'herramienta', label: 'Google Sheets', url: 'https://sheets.google.com' },
} satisfies Record<string, GuideSource>;

export const GUIDES: Record<string, Guide> = {
  /* ---------------- Mes 1 ---------------- */
  's01-a': {
    why: 'Sin un lugar fijo para tus archivos y un horario fijo, la ruta se cae en la semana 3. Esto es tu “oficina”.',
    steps: [
      'Crea la carpeta GRC-Portafolio con subcarpetas: 01-Estudio, 02-Pacifica-Logistica, 03-Portafolio, 04-Empleo.',
      'Crea el repo privado grc-portfolio en GitHub con un README que diga qué es y que la empresa es ficticia.',
      'Bloquea en tu calendario 1 h de lunes a viernes y un bloque el sábado; trátalo como una junta.',
      'Decide dónde tomas apuntes: aquí, en la biblioteca de cada paso. Todo lo demás son archivos de entregables.',
    ],
    searches: ['cómo crear un repositorio en GitHub', 'GitHub README markdown guía', 'time blocking estudio'],
    sources: [{ kind: 'gratis', label: 'GitHub Docs: Hello World', url: 'https://docs.github.com/es/get-started/start-your-journey/hello-world' }],
    practice: ['Sube a tu repo un README con tu objetivo: “Analista GRC en 6 meses”.'],
    tips: ['Nombra los archivos con número y fecha: 02-registro-riesgos-v1-2026-11.xlsx. Así se ve profesional.'],
  },
  's01-b': {
    why: 'Todo GRC se construye sobre estas palabras. Si las dominas, entiendes cualquier norma; si no, todo suena a lo mismo.',
    steps: [
      'Primero la tríada CIA: qué protege cada una y un ejemplo de cómo se rompe.',
      'Después la cadena del riesgo: activo → amenaza → vulnerabilidad → riesgo → control. Es una sola historia.',
      'Luego tipos de control: preventivo, detectivo, correctivo; y administrativo, técnico, físico.',
      'Al final, escribe cada término con tus palabras y un ejemplo de Pacífica Logística.',
    ],
    concepts: [
      ['Confidencialidad', 'Que la información solo la vea quien tiene permiso. Se rompe con una fuga de datos.'],
      ['Integridad', 'Que la información sea correcta y no se altere sin autorización. Se rompe si alguien cambia una factura.'],
      ['Disponibilidad', 'Que la información y los sistemas estén accesibles cuando se necesitan. Se rompe con ransomware o una caída.'],
      ['Activo', 'Cualquier cosa con valor para la organización: datos, sistemas, personas, procesos, reputación.'],
      ['Amenaza', 'Lo que puede causar daño: un atacante, un empleado descuidado, un incendio.'],
      ['Vulnerabilidad', 'La debilidad que la amenaza aprovecha: contraseña débil, sistema sin parches, falta de respaldo.'],
      ['Riesgo', 'Posibilidad de que una amenaza explote una vulnerabilidad y cause impacto. Se mide como probabilidad × impacto.'],
      ['Control', 'Medida que reduce el riesgo: una política, MFA, un respaldo, una cerradura.'],
      ['Riesgo residual', 'El riesgo que queda después de aplicar controles.'],
      ['Apetito de riesgo', 'Cuánto riesgo está dispuesta a aceptar la dirección para lograr sus objetivos.'],
    ],
    searches: ['CIA triad explained', 'threat vs vulnerability vs risk', 'tipos de controles preventivo detectivo correctivo', 'qué es un activo de información ISO 27001'],
    sources: [S.messer, S.nistGlossary, yt('Videos cortos de la tríada CIA', 'CIA triad explained cybersecurity'), S.simplyCyber],
    practice: [
      'Guarda en tu biblioteca los 10 conceptos de arriba (botón “Usar”) y reescríbelos con tus palabras.',
      'Agrega 10 más hasta llegar a 20: autenticación, autorización, MFA, cifrado, incidente, evento, política, procedimiento, evidencia, auditoría.',
      'Para 3 activos de Pacífica escribe la cadena completa: activo → amenaza → vulnerabilidad → riesgo → control.',
    ],
    tips: [
      'Truco: si puedes explicarlo con un ejemplo de tu vida diaria (tu casa, tu teléfono), ya lo entendiste.',
      'No memorices definiciones en inglés; entiende la idea. En entrevistas te piden ejemplos, no citas.',
    ],
  },
  's01-c': {
    why: 'ISO 27000 es el diccionario oficial de toda la familia 27000. Hablar con sus palabras te hace sonar como del gremio.',
    steps: [
      'Descarga ISO/IEC 27000 de la página de normas gratuitas.',
      'Lee primero la introducción y la sección del panorama del SGSI: te dice cómo encajan 27001, 27002, 27005…',
      'Luego recorre los términos y definiciones y quédate con los 15 que más vas a usar.',
    ],
    concepts: [
      ['SGSI', 'Sistema de Gestión de Seguridad de la Información: el conjunto de políticas, procesos, roles y controles para gestionar el riesgo de la información de forma continua.'],
      ['ISO 27001', 'La norma certificable: dice QUÉ debe tener un SGSI (cláusulas 4 a 10 + Anexo A).'],
      ['ISO 27002', 'La guía: explica CÓMO implementar cada control del Anexo A.'],
      ['ISO 27005', 'Guía de gestión de riesgos de seguridad de la información.'],
    ],
    searches: ['ISO 27000 family explained', 'diferencia ISO 27001 y 27002', 'familia ISO 27000 explicada'],
    sources: [S.iso27000, S.isoOBP, yt('Familia ISO 27000 explicada', 'ISO 27000 family of standards explained')],
    practice: ['Haz un mapa (draw.io o papel) de la familia: 27000 → 27001 → 27002 → 27005 → 27701 → 27017/27018, con una línea de qué hace cada una.'],
    tips: ['La 27001 es lo que te auditan; la 27002 es tu manual. Esa frase te salva en entrevistas.'],
  },
  's01-d': {
    why: 'Un curso estructurado te da el orden; tú solo pones la constancia. Este es gratis y prepara para tu primera certificación.',
    steps: ['Crea tu cuenta en Advisera e inscríbete.', 'Ve el módulo 1 completo sin saltar y haz su quiz.', 'Anota en tu biblioteca 3 ideas clave del módulo.'],
    searches: ['Advisera ISO 27001 Foundations course review'],
    sources: [S.advisera, S.udemyFoundation, S.adviseraBlog],
    practice: ['Al terminar cada módulo, explica en voz alta (o grabándote 2 min) lo que aprendiste.'],
    tips: ['Videos a 1.25×; pausa para anotar. Mejor 30 min diarios que 4 h el domingo.'],
  },
  's01-e': {
    why: 'Practicar en una empresa ficticia convierte la teoría en entregables que puedes mostrar. Es tu “experiencia” antes de tener experiencia.',
    steps: ['Define giro, tamaño, sedes y procesos principales.', 'Lista sistemas y proveedores.', 'Dibuja un organigrama simple con quién sería dueño de qué.'],
    searches: ['company profile template', 'organigrama empresa logística pequeña'],
    practice: ['Un documento de una página con la ficha. Guárdalo en 02-Pacifica-Logistica y enlázalo aquí como entregable.'],
    template: ['Nombre y giro', 'Tamaño y sedes', 'Procesos clave (ventas, operación de bodega, rastreo, facturación, RR. HH.)', 'Sistemas (Google Workspace, ERP, app de rastreo en AWS, laptops)', 'Proveedores críticos', 'Clientes y qué datos maneja', 'Organigrama y responsables', 'Por qué quiere ISO 27001'],
    tips: ['Hazla realista pero pequeña. Todo lo que inventes aquí lo vas a reutilizar 6 meses.'],
  },
  's02-a': {
    why: 'Las cláusulas 4 a 10 son el “sistema” del SGSI: sin ellas los controles son cosas sueltas. El ciclo PDCA explica por qué nunca se termina.',
    steps: [
      'Primero entiende PDCA: Planificar, Hacer, Verificar, Actuar.',
      'Después ubica cada cláusula en el ciclo: 4–6 planificar, 7–8 hacer, 9 verificar, 10 actuar.',
      'Luego entiende que el Anexo A son 93 controles que eliges según tus riesgos.',
    ],
    concepts: [
      ['Cláusula 4 Contexto', 'Entender la organización, partes interesadas y definir el alcance del SGSI.'],
      ['Cláusula 5 Liderazgo', 'Compromiso de la dirección, política de seguridad y roles.'],
      ['Cláusula 6 Planificación', 'Evaluar y tratar riesgos; objetivos de seguridad.'],
      ['Cláusula 7 Soporte', 'Recursos, competencia, concientización, comunicación y documentos.'],
      ['Cláusula 8 Operación', 'Ejecutar la evaluación y el tratamiento de riesgos.'],
      ['Cláusula 9 Evaluación', 'Medir, auditar internamente y revisión por la dirección.'],
      ['Cláusula 10 Mejora', 'No conformidades, acciones correctivas y mejora continua.'],
      ['PDCA', 'Ciclo de mejora continua: Planificar, Hacer, Verificar, Actuar.'],
    ],
    searches: ['ISO 27001 clauses 4 to 10 explained', 'ciclo PDCA ISO 27001', 'Annex SL high level structure'],
    sources: [S.advisera, yt('Cláusulas de ISO 27001 explicadas', 'ISO 27001 clauses 4-10 explained'), S.adviseraBlog, S.udemyFoundation],
    practice: ['Dibuja el ciclo PDCA y coloca cada cláusula en su fase.'],
    tips: ['Las cláusulas 1 a 3 son introducción (alcance, referencias, términos); las certificables son de la 4 a la 10.'],
  },
  's02-b': {
    why: 'Resumir con tus palabras es la forma más rápida de detectar lo que no entendiste.',
    steps: ['Una fila por cláusula (y subcláusula importante).', 'Escribe qué pide y qué evidencia mostrarías a un auditor.', 'Revisa contra el curso y corrige.'],
    searches: ['ISO 27001 mandatory documents list 2022', 'ISO 27001 required evidence per clause'],
    sources: [{ kind: 'lectura', label: 'Advisera: documentos obligatorios de ISO 27001', url: googleUrl('Advisera list of mandatory documents ISO 27001 2022') }],
    practice: ['Tabla en tu biblioteca o en Sheets; guárdala como entregable.'],
    template: ['Cláusula', 'Qué pide (tus palabras)', 'Documento o registro que lo prueba', 'Ejemplo en Pacífica'],
    tips: ['La palabra clave es “evidencia”: un auditor no cree, verifica.'],
  },
  's02-c': {
    why: 'Escuchar los mismos conceptos en español refuerza lo que viste en inglés.',
    steps: ['Avanza la primera mitad del curso.', 'Compara: ¿qué explicó distinto que Advisera?', 'Ojo: su Anexo A es de 2013 (114 controles); el vigente de 2022 tiene 93.'],
    searches: ['curso SGSI ISO 27001 español', 'ISO 27001 2022 cambios respecto a 2013'],
    sources: [S.alison, yt('ISO 27001 en español', 'ISO 27001 SGSI explicación en español')],
    practice: ['Anota 3 conceptos nuevos en tu biblioteca.'],
  },
  's02-d': {
    why: 'El contexto define todo lo demás: qué te afecta y a quién debes cumplirle. Es lo primero que revisa un auditor.',
    steps: ['Lista asuntos internos (cultura, recursos, sistemas) y externos (leyes, clientes, competencia, amenazas).', 'Lista partes interesadas: clientes, empleados, dirección, proveedores, autoridades.', 'Para cada una, ¿qué espera en seguridad?'],
    searches: ['ISO 27001 clause 4.1 4.2 example', 'interested parties ISO 27001 example', 'análisis PESTEL'],
    sources: [S.adviseraBlog],
    practice: ['Documento “Contexto de la organización” de Pacífica, 1–2 páginas.'],
    template: ['Asuntos internos', 'Asuntos externos', 'Parte interesada', 'Sus requisitos de seguridad', 'Cómo los atiende el SGSI'],
    tips: ['Usa FODA o PESTEL para no olvidar nada.'],
  },
  's03-a': {
    why: 'El riesgo es el corazón de GRC: todas las decisiones (qué control, cuánto invertir) salen de aquí.',
    steps: [
      'Primero el proceso: identificar → analizar → evaluar → tratar → monitorear.',
      'Después entiende probabilidad e impacto y cómo se combinan en una matriz.',
      'Luego cualitativo (alto/medio/bajo) vs. cuantitativo (dinero, FAIR).',
      'Al final, las 4 opciones de tratamiento.',
    ],
    concepts: [
      ['Evaluación de riesgos', 'Identificar, analizar y valorar riesgos para decidir cuáles tratar.'],
      ['Probabilidad', 'Qué tan posible es que ocurra el evento (ej. 1 a 5).'],
      ['Impacto', 'Qué tan grave sería si ocurre (ej. 1 a 5).'],
      ['Mitigar', 'Reducir el riesgo con controles.'],
      ['Transferir', 'Pasar parte del riesgo a un tercero (seguro, proveedor).'],
      ['Evitar', 'Dejar de hacer la actividad que genera el riesgo.'],
      ['Aceptar', 'Asumirlo conscientemente, con firma del dueño del riesgo.'],
      ['Dueño del riesgo', 'Persona con autoridad para decidir sobre ese riesgo.'],
    ],
    searches: ['NIST SP 800-30 risk assessment process', 'risk matrix 5x5 explained', 'risk treatment options', 'evaluación de riesgos ISO 27005 ejemplo'],
    sources: [S.nist80030, S.simplyCyber, yt('Cómo hacer una evaluación de riesgos', 'how to do a cybersecurity risk assessment GRC'), udemy('Cursos de evaluación de riesgos', 'cybersecurity risk assessment')],
    practice: ['Valora a mano 3 riesgos con una matriz 5×5 antes de abrir la hoja de cálculo.'],
    tips: ['Primero cualitativo. FAIR (cuantitativo) es un plus para después del mes 6.'],
  },
  's03-b': {
    why: 'No puedes proteger lo que no sabes que tienes. El inventario es la base del análisis de riesgos.',
    steps: ['Piensa por tipo: información, software, hardware, servicios, personas.', 'A cada activo ponle dueño y clasificación.', 'Indica dónde vive y su valor en CIA (1–3).'],
    searches: ['information asset inventory template ISO 27001', 'asset register example'],
    sources: [S.sheets],
    practice: ['20 activos de Pacífica en Sheets.'],
    template: ['ID', 'Activo', 'Tipo', 'Dueño', 'Ubicación / sistema', 'Clasificación', 'C (1-3)', 'I (1-3)', 'D (1-3)', 'Notas'],
    tips: ['Incluye cosas que no son “de TI”: contratos con clientes, el conocimiento del jefe de bodega.'],
  },
  's03-c': {
    why: 'La metodología hace que dos personas valoren igual el mismo riesgo. Sin ella, el registro es opinión.',
    steps: ['Define escalas de 1 a 5 con descripción concreta.', 'Define la fórmula (P × I) y los rangos de color.', 'Define el criterio de aceptación: por ejemplo, ≤ 6 se acepta.'],
    searches: ['risk assessment methodology document ISO 27001 example', 'risk acceptance criteria example'],
    practice: ['Documento de 1–2 páginas con escalas, matriz y criterio.'],
    template: ['Propósito y alcance', 'Escala de probabilidad (1–5 con ejemplos)', 'Escala de impacto (1–5 en dinero, operación, legal, reputación)', 'Matriz y niveles', 'Criterio de aceptación', 'Roles y frecuencia de revisión'],
    tips: ['Describe el impacto en cosas medibles: “más de 1 día sin rastreo de envíos” es mejor que “alto”.'],
  },
  's03-d': {
    why: 'La IA acelera la lluvia de ideas, pero el criterio es tuyo. Aprender a usarla bien ya es una habilidad que piden.',
    steps: ['Dale contexto real de la empresa ficticia.', 'Pide escenarios por activo.', 'Revisa cada uno: ¿aplica? ¿qué vulnerabilidad explota? Descarta lo genérico.'],
    searches: ['AI prompts for risk assessment cybersecurity'],
    sources: [S.claude],
    practice: ['Agrega 5 escenarios que la IA te ayudó a ver y que tú validaste.'],
    prompt: 'Eres analista GRC. Empresa: Pacífica Logística (logística, 80 empleados, Google Workspace, ERP en la nube, app de rastreo en AWS). Para el activo “[ACTIVO]”, propón 5 escenarios de riesgo con amenaza, vulnerabilidad e impacto en confidencialidad, integridad o disponibilidad. Sé específico al negocio.',
    tips: ['Nunca pongas datos reales de una empresa real en una IA pública.'],
  },
  's04-a': {
    why: 'El Anexo A es el catálogo de controles de donde eliges cómo reducir tus riesgos. En la versión 2022 son 93, en 4 temas.',
    steps: [
      'Primero los 4 temas: organizacionales (5.x, 37), personas (6.x, 8), físicos (7.x, 14), tecnológicos (8.x, 34).',
      'Después lee el título de los 93 y marca los que ya entiendes.',
      'Luego profundiza en 10 clave: control de accesos, gestión de proveedores, gestión de incidentes, respaldos, registro y monitoreo, gestión de vulnerabilidades, concientización, clasificación, teletrabajo, inteligencia de amenazas.',
    ],
    concepts: [
      ['Anexo A', 'Lista de 93 controles de referencia de ISO 27001:2022, agrupados en 4 temas.'],
      ['Control organizacional', 'Políticas, roles, proveedores, gestión de activos e incidentes (sección 5).'],
      ['Control de personas', 'Selección, capacitación, confidencialidad y teletrabajo (sección 6).'],
      ['Control físico', 'Perímetros, accesos físicos, equipos y escritorio limpio (sección 7).'],
      ['Control tecnológico', 'Accesos, cifrado, respaldos, monitoreo y desarrollo seguro (sección 8).'],
    ],
    searches: ['ISO 27001 2022 Annex A controls explained', 'ISO 27001 2022 11 new controls', 'controles anexo A 2022 explicados'],
    sources: [yt('Anexo A explicado', 'ISO 27001 2022 Annex A controls explained'), S.adviseraBlog, udemy('Cursos del Anexo A', 'ISO 27001 Annex A controls 2022')],
    practice: ['Para tus 10 controles clave, guarda un apunte: qué es y qué riesgo de Pacífica reduce.'],
    tips: ['Aprende los 11 controles nuevos de 2022 (inteligencia de amenazas, servicios en la nube, prevención de fuga de datos…): salen mucho en entrevistas.'],
  },
  's04-b': {
    why: 'El registro de riesgos es el entregable más pedido en entrevistas GRC. Si lo puedes explicar, ya hablas como analista.',
    steps: ['Parte de tu inventario y metodología.', 'Escribe cada riesgo como frase: “Por [vulnerabilidad], [amenaza] podría [evento], causando [impacto]”.', 'Valora, asigna dueño y decide el tratamiento.'],
    searches: ['cyber risk register template', 'how to write a risk statement', 'risk register example ISO 27001'],
    sources: [S.sheets, yt('Cómo llenar un registro de riesgos', 'risk register walkthrough GRC analyst')],
    practice: ['15–20 riesgos en Sheets con formato condicional por nivel.'],
    template: ['ID', 'Activo', 'Amenaza', 'Vulnerabilidad', 'Descripción del riesgo', 'Probabilidad', 'Impacto', 'Nivel', 'Dueño', 'Tratamiento', 'Control(es) Anexo A', 'Riesgo residual', 'Estado'],
    tips: ['Calidad sobre cantidad: 15 riesgos bien escritos valen más que 60 genéricos.'],
  },
  's04-c': {
    why: 'Terminar el curso te deja listo para los exámenes de práctica del mes 2.',
    steps: ['Ve los módulos que te faltan.', 'Haz todos los quizzes; repite los que fallaste.'],
    searches: ['ISO 27001 foundation exam practice questions'],
    sources: [S.advisera, S.udemyFoundation],
    practice: ['Lista en tu biblioteca los 5 temas que más te costaron.'],
  },
  's04-d': {
    why: 'Publicar desde el inicio construye tu marca y muestra constancia, que es lo que más buscan en perfiles junior.',
    steps: ['Cuenta qué empezaste, por qué y qué aprendiste esta semana.', 'Una idea concreta (por ejemplo, la cadena del riesgo).', 'Cierra con lo que viene.'],
    searches: ['LinkedIn post ideas cybersecurity beginner'],
    practice: ['Publica y guarda el enlace aquí como entregable.'],
    tips: ['Corto, honesto y sin exagerar. Etiqueta #GRC #ISO27001 #ciberseguridad.'],
  },

  /* ---------------- Mes 2 ---------------- */
  's05-a': {
    why: 'El alcance dice qué entra al SGSI. Un alcance mal definido es la causa número uno de auditorías complicadas.',
    steps: ['Define procesos, sedes, sistemas y personas incluidas.', 'Justifica exclusiones.', 'Lista interfaces y dependencias (lo que está fuera pero conecta).'],
    searches: ['ISO 27001 scope statement example', 'ISMS scope 4.3 interfaces dependencies'],
    sources: [S.adviseraBlog],
    template: ['Declaración de alcance (1 párrafo)', 'Procesos incluidos', 'Ubicaciones', 'Sistemas y tecnología', 'Exclusiones y justificación', 'Interfaces y dependencias'],
    practice: ['Documento de 1 página para Pacífica.'],
  },
  's05-b': {
    why: 'La política es el compromiso de la dirección por escrito: marca la dirección de todo el SGSI.',
    steps: ['Lee 2 ejemplos públicos de políticas de seguridad.', 'Haz un borrador con IA usando tu contexto.', 'Recórtala: una política buena cabe en 2 páginas.'],
    searches: ['information security policy template ISO 27001 5.2', 'SANS security policy templates'],
    sources: [{ kind: 'lectura', label: 'SANS: plantillas de políticas', url: 'https://www.sans.org/information-security-policy/' }, S.claude],
    template: ['Propósito', 'Alcance', 'Objetivos de seguridad', 'Compromiso de la dirección', 'Roles y responsabilidades', 'Cumplimiento y excepciones', 'Revisión y aprobación'],
    prompt: 'Redacta una política de seguridad de la información de máximo 2 páginas para Pacífica Logística que cumpla la cláusula 5.2 de ISO 27001:2022. Usa lenguaje claro, sin relleno, e incluye objetivos medibles.',
    practice: ['Política v1 en tu carpeta; enlázala aquí.'],
  },
  's05-c': {
    why: 'La Declaración de Aplicabilidad (SoA) une riesgos y controles: es el documento que todo auditor revisa línea por línea.',
    steps: ['Lista los 93 controles.', 'Marca si aplica y por qué (riesgo, ley, contrato).', 'Indica el estado de implementación.'],
    searches: ['statement of applicability template ISO 27001 2022', 'SoA example'],
    sources: [S.sheets, S.udemyLab],
    template: ['Control', 'Nombre', 'Aplica (sí/no)', 'Justificación', 'Riesgo(s) relacionado(s)', 'Estado', 'Evidencia'],
    practice: ['SoA completa en Sheets.'],
    tips: ['Excluir un control requiere justificación sólida; “no tenemos presupuesto” no lo es.'],
  },
  's05-d': {
    why: 'Los exámenes de práctica revelan tus huecos antes del examen real.',
    steps: ['Haz un examen sin notas.', 'Anota cada pregunta fallada y el tema.', 'Repasa solo esos temas.'],
    searches: ['ISO 27001 foundation practice exam'],
    sources: [S.advisera, S.udemyFoundation],
    practice: ['Lista de temas débiles en tu biblioteca.'],
  },
  's06-b': {
    why: 'Tu primera certificación en ISO 27001: la prueba objetiva de que conoces la norma.',
    steps: ['Revisa requisitos técnicos del examen en línea.', 'Duerme bien; preséntalo en un lugar tranquilo.', 'Al aprobar, descarga certificado e insignia.'],
    searches: ['Advisera ISO 27001 foundations exam tips'],
    sources: [S.advisera],
    practice: ['Guarda el enlace a tu certificado como entregable.'],
  },
  's06-d': {
    why: 'Identificar riesgos no sirve si no hay un plan con dueños y fechas para reducirlos.',
    steps: ['Toma los riesgos a tratar.', 'Asigna control, responsable, fecha y costo estimado.', 'Calcula el riesgo residual esperado.'],
    searches: ['risk treatment plan template ISO 27001'],
    template: ['Riesgo', 'Opción de tratamiento', 'Control / acción', 'Responsable', 'Fecha', 'Recursos', 'Riesgo residual esperado', 'Aprobación del dueño'],
    practice: ['Plan en Sheets, ligado a tu registro.'],
  },
  's07-a': {
    why: 'Escribir políticas es trabajo diario de un analista GRC. Una política clara se cumple; una confusa se ignora.',
    steps: ['Entiende la jerarquía: política → estándar → procedimiento → guía.', 'Aprende la estructura típica.', 'Lee una política real de una organización pública.'],
    concepts: [
      ['Política', 'Qué se debe hacer y por qué; la aprueba la dirección. Cambia poco.'],
      ['Estándar', 'Requisitos obligatorios concretos (ej. contraseñas de 12 caracteres).'],
      ['Procedimiento', 'Pasos para cumplir (cómo se da de alta a un usuario).'],
      ['Guía', 'Recomendación no obligatoria.'],
    ],
    searches: ['policy vs standard vs procedure vs guideline', 'how to write a security policy'],
    sources: [{ kind: 'lectura', label: 'SANS: plantillas de políticas', url: 'https://www.sans.org/information-security-policy/' }],
    practice: ['Guarda los 4 conceptos y un ejemplo de cada uno en Pacífica.'],
  },
  's07-b': {
    why: 'El control de accesos es de los controles más auditados y donde más fallan las empresas.',
    steps: ['Entiende mínimo privilegio, necesidad de saber y segregación de funciones.', 'Define altas, cambios y bajas de usuarios.', 'Agrega MFA y revisión periódica de accesos.'],
    concepts: [
      ['Mínimo privilegio', 'Dar solo los permisos indispensables para el trabajo.'],
      ['Segregación de funciones', 'Que una sola persona no controle todo un proceso crítico.'],
      ['Revisión de accesos', 'Validar cada cierto tiempo que los permisos siguen siendo necesarios.'],
    ],
    searches: ['access control policy template', 'joiner mover leaver process', 'user access review process'],
    template: ['Propósito y alcance', 'Principios', 'Altas / cambios / bajas', 'Cuentas privilegiadas', 'Autenticación y MFA', 'Revisión de accesos', 'Excepciones'],
    practice: ['Política de control de accesos v1.'],
  },
  's07-c': {
    why: 'La clasificación dice cómo tratar cada tipo de información; el uso aceptable dice qué pueden hacer los empleados.',
    steps: ['Define 3 o 4 niveles con ejemplos.', 'Por nivel: quién accede, cómo se comparte y cómo se destruye.', 'Escribe reglas de uso aceptable: correo, equipos, internet, IA.'],
    searches: ['data classification policy levels example', 'acceptable use policy template'],
    template: ['Niveles de clasificación', 'Etiquetado', 'Manejo por nivel', 'Uso aceptable de equipos y cuentas', 'Uso de IA generativa', 'Sanciones'],
    practice: ['Ambos documentos (pueden ir juntos).'],
    tips: ['Agrega una sección de uso de IA: es un tema actual que impresiona en entrevistas.'],
  },
  's07-d': {
    why: 'Todas las empresas tendrán incidentes; la diferencia es si saben qué hacer. Es un control clave del Anexo A.',
    steps: ['Aprende el ciclo: preparación, detección, contención, erradicación, recuperación, lecciones aprendidas.', 'Define severidades y tiempos.', 'Define a quién notificar (dirección, clientes, autoridad).'],
    concepts: [
      ['Evento', 'Algo observable que puede o no ser un problema.'],
      ['Incidente', 'Evento que afecta o puede afectar la seguridad de la información.'],
    ],
    searches: ['NIST SP 800-61 incident response lifecycle', 'incident response procedure template'],
    sources: [{ kind: 'lectura', label: 'NIST SP 800-61 (respuesta a incidentes)', url: 'https://csrc.nist.gov/pubs/sp/800/61/r3/final' }],
    template: ['Definiciones', 'Roles', 'Clasificación de severidad', 'Flujo paso a paso', 'Tiempos de respuesta', 'Comunicación y notificación', 'Registro y lecciones aprendidas'],
    practice: ['Procedimiento v1 con un diagrama en draw.io.'],
  },
  's08-a': {
    why: 'Muchas empresas (sobre todo de EE. UU.) usan NIST CSF. Saber ISO y NIST te hace más contratable.',
    steps: ['Primero las 6 funciones y qué cubre cada una.', 'Después categorías y subcategorías.', 'Luego perfiles (actual vs. objetivo) y niveles de implementación.'],
    concepts: [
      ['Gobernar (GV)', 'Estrategia, roles, políticas y gestión de riesgos de la cadena de suministro.'],
      ['Identificar (ID)', 'Activos, riesgos y mejoras.'],
      ['Proteger (PR)', 'Accesos, capacitación, seguridad de datos y plataformas.'],
      ['Detectar (DE)', 'Monitoreo continuo y análisis de eventos.'],
      ['Responder (RS)', 'Gestión, análisis y comunicación de incidentes.'],
      ['Recuperar (RC)', 'Restaurar y comunicar después de un incidente.'],
    ],
    searches: ['NIST CSF 2.0 explained', 'NIST CSF 2.0 vs ISO 27001', 'NIST CSF 2.0 español'],
    sources: [S.nistCsf, yt('NIST CSF 2.0 explicado', 'NIST CSF 2.0 explained'), S.simplyCyber],
    practice: ['Guarda las 6 funciones como conceptos.'],
  },
  's08-b': {
    why: 'Mapear controles entre marcos es tarea diaria en GRC: un control bien hecho cumple varios marcos a la vez.',
    steps: ['Elige 20 controles del Anexo A.', 'Busca su equivalente en CSF 2.0 (NIST publica referencias cruzadas).', 'Marca coincidencias parciales.'],
    searches: ['NIST CSF 2.0 ISO 27001 mapping', 'NIST informative references CSF 2.0'],
    sources: [S.nistCsf, S.cis],
    template: ['Control ISO 27001', 'Descripción', 'Categoría NIST CSF 2.0', 'Control CIS (opcional)', 'Coincidencia (total/parcial)', 'Notas'],
    practice: ['Tabla de mapeo en Sheets.'],
  },
  's08-c': {
    why: 'El análisis de brechas responde “¿qué nos falta para certificarnos?”. Es lo primero que hace un consultor.',
    steps: ['Por cada cláusula y control aplicable: estado actual.', 'Madurez de 0 a 5.', 'Prioriza por riesgo y esfuerzo.'],
    searches: ['ISO 27001 gap analysis template', 'maturity model 0-5 security'],
    template: ['Requisito', 'Estado actual', 'Evidencia existente', 'Brecha', 'Madurez (0–5)', 'Acción recomendada', 'Prioridad'],
    practice: ['Gap analysis en Sheets con resumen ejecutivo de media página.'],
  },
  's08-d': {
    why: 'Un proyecto terminado y presentable vale más que diez a medias. Este es la base de tu portafolio.',
    steps: ['Reúne: ficha, contexto, alcance, política, metodología, registro, SoA, plan de tratamiento, gap.', 'Escribe un resumen de una página.', 'Súbelo al repo con un README índice.'],
    searches: ['GRC portfolio project example github'],
    template: ['Resumen (problema, enfoque, resultado)', 'Índice de entregables con enlaces', 'Herramientas usadas', 'Qué aprendí', 'Aviso: empresa ficticia'],
    practice: ['Proyecto 1 publicado en tu repo.'],
  },

  /* ---------------- Mes 3 ---------------- */
  's09-a': {
    why: 'Una página propia te diferencia de la mayoría de candidatos junior y es gratis.',
    steps: ['Elige plantilla sencilla (Jekyll o HTML simple).', 'Crea el repo usuario.github.io.', 'Agrega secciones y publica.'],
    searches: ['GitHub Pages portfolio tutorial', 'cybersecurity portfolio website examples', 'GRC analyst portfolio github pages'],
    sources: [{ kind: 'gratis', label: 'GitHub Pages: guía rápida', url: 'https://docs.github.com/es/pages/quickstart' }, yt('Portafolio con GitHub Pages', 'GitHub Pages portfolio website tutorial'), S.claude],
    practice: ['Página publicada con tu URL guardada aquí.'],
    tips: ['Que cargue rápido y se lea en celular. Lo importante son los proyectos, no el diseño.'],
  },
  's10-a': {
    why: 'Los reclutadores de GRC buscan en LinkedIn por palabras clave; si no las tienes, no apareces.',
    steps: ['Titular con rol + norma + habilidad.', 'Acerca de en 3 párrafos: quién eres, qué sabes hacer, qué buscas.', 'Destacados: tu web y tus mejores proyectos.'],
    searches: ['LinkedIn profile tips GRC analyst', 'LinkedIn headline cybersecurity entry level'],
    sources: [S.simplyCyber],
    practice: ['Perfil completo; pide a alguien que lo revise.'],
    tips: ['Habilidades: ISO 27001, Gestión de riesgos, NIST CSF, Políticas de seguridad, Auditoría interna.'],
  },
  's10-b': {
    why: 'El CV es tu filtro de entrada. En GRC se valora la claridad: si tu CV es claro, asumen que tus documentos también.',
    steps: ['Una página, sin foto ni gráficas de habilidades.', 'Sección Proyectos con resultados concretos.', 'Versión en inglés para vacantes remotas.'],
    searches: ['GRC analyst resume entry level example', 'ATS friendly resume'],
    template: ['Encabezado (nombre, ciudad, LinkedIn, web)', 'Resumen de 3 líneas', 'Certificaciones', 'Proyectos (3–4 con logros)', 'Experiencia previa traducida a habilidades GRC', 'Educación', 'Habilidades y herramientas'],
    practice: ['CV en español e inglés en PDF.'],
    tips: ['Ejemplo de logro: “Elaboré el registro de riesgos (18 riesgos) y la SoA de 93 controles para una empresa simulada de 80 empleados”.'],
  },
  's10-c': {
    why: 'La IA detecta palabras clave faltantes y frases confusas en segundos.',
    steps: ['Pega tu CV y la vacante.', 'Pide qué falta y qué sobra.', 'Ajusta solo con cosas verdaderas.'],
    sources: [S.claude],
    searches: ['ATS keywords GRC analyst'],
    prompt: 'Actúa como reclutador de ciberseguridad. Compara mi CV con esta vacante de Analista GRC. Dime: 1) palabras clave que faltan y que sí tengo evidencia de dominar, 2) frases vagas que debo hacer concretas, 3) qué quitarías. No inventes experiencia. [CV] [VACANTE]',
    practice: ['Guarda aquí la versión final y el prompt que te funcionó.'],
  },
  's10-d': {
    why: 'Las ofertas reales te dicen qué estudiar. Tu ruta debe responder a lo que pide el mercado.',
    steps: ['Busca en LinkedIn, OCC, Indeed y Computrabajo: “Analista GRC”, “Cumplimiento TI”, “Riesgo tecnológico”, “Auditor TI”.', 'Copia requisitos en una hoja.', 'Cuenta repeticiones.'],
    searches: ['Analista GRC vacante', 'IT risk analyst job description', 'auditor de TI junior requisitos'],
    template: ['Empresa', 'Puesto', 'Requisitos', 'Certificaciones pedidas', 'Herramientas', 'Inglés', 'Remoto/presencial', 'Salario'],
    practice: ['Hoja con 20 ofertas y el top 10 de requisitos.'],
  },
  's11-d': {
    why: 'Toda empresa depende de proveedores, y muchas brechas vienen de ellos. Gestionar riesgo de terceros (TPRM) es un rol muy contratado.',
    steps: ['Entiende el ciclo: debida diligencia → contrato → monitoreo → salida.', 'Arma un cuestionario por dominios.', 'Evalúa y califica 2 proveedores ficticios.'],
    concepts: [
      ['TPRM', 'Gestión de riesgos de terceros: evaluar y vigilar la seguridad de proveedores.'],
      ['Debida diligencia', 'Investigar a un proveedor antes de contratarlo.'],
      ['SIG / CAIQ', 'Cuestionarios estándar de evaluación de proveedores (Shared Assessments y Cloud Security Alliance).'],
    ],
    searches: ['third party risk management process', 'vendor security questionnaire template', 'CSA CAIQ'],
    sources: [{ kind: 'lectura', label: 'CSA: CAIQ', url: googleUrl('Cloud Security Alliance CAIQ download') }, udemy('Cursos de riesgo de terceros', 'third party risk management')],
    template: ['Dominio (gobierno, accesos, datos, continuidad, incidentes, cumplimiento)', 'Pregunta', 'Respuesta del proveedor', 'Evidencia pedida', 'Calificación', 'Riesgo resultante'],
    practice: ['Cuestionario de 30 preguntas + informe de 2 proveedores (ej. paquetería y proveedor del ERP).'],
  },
  's12-b': {
    why: 'Responder en voz alta es otra habilidad distinta a saber. Practicar te quita los nervios.',
    steps: ['Pide a la IA que te entreviste, una pregunta a la vez.', 'Responde por escrito o en voz alta.', 'Pide retroalimentación y repite las débiles.'],
    sources: [S.claude, S.simplyCyber],
    searches: ['GRC analyst interview questions', 'preguntas entrevista analista de riesgos TI'],
    prompt: 'Eres entrevistador para un puesto de Analista GRC junior. Hazme 10 preguntas de una en una (ISO 27001, riesgos, políticas, auditoría, situaciones). Después de cada respuesta califícala de 1 a 5 y dime cómo mejorarla.',
    practice: ['Guarda tus mejores respuestas como apuntes.'],
  },
  's12-d': {
    why: 'Auditar es verificar con evidencia que lo escrito se cumple. Muchos puestos de entrada son de auditoría de TI.',
    steps: ['Entiende tipos de auditoría: primera, segunda y tercera parte.', 'Aprende a recolectar evidencia: entrevista, observación, revisión de documentos y registros.', 'Aprende a clasificar hallazgos.'],
    concepts: [
      ['No conformidad mayor', 'Falta un requisito o falla de forma sistemática; pone en riesgo la certificación.'],
      ['No conformidad menor', 'Falla aislada que no compromete el sistema.'],
      ['Observación / oportunidad de mejora', 'No incumple, pero podría mejorarse.'],
      ['ISO 19011', 'Guía para auditar sistemas de gestión.'],
    ],
    searches: ['ISO 27001 internal audit process', 'audit evidence types', 'major vs minor nonconformity'],
    sources: [{ kind: 'gratis', label: 'Advisera Internal Auditor', url: 'https://advisera.com/training/iso-27001-internal-auditor-course/' }],
    practice: ['Guarda los 4 conceptos.'],
  },
  's13-b': {
    why: 'Un informe de auditoría simulado demuestra que sabes revisar evidencia y escribir hallazgos claros.',
    steps: ['Elige 5 controles.', 'Escribe el criterio y qué evidencia pedirías.', 'Simula hallazgos y escribe el informe.'],
    searches: ['ISO 27001 internal audit checklist', 'how to write audit findings'],
    template: ['Objetivo y alcance', 'Criterios', 'Checklist (control, pregunta, evidencia esperada, resultado)', 'Hallazgos (condición, criterio, causa, efecto, recomendación)', 'Conclusión'],
    practice: ['Plan + checklist + informe de 2 páginas.'],
    tips: ['Un hallazgo bien escrito tiene condición (qué viste), criterio (qué pedía la norma), causa y efecto.'],
  },
  's13-d': {
    why: 'Elegir con datos (lo que piden las ofertas) evita gastar en la certificación equivocada.',
    steps: ['Revisa tu hoja de 20 ofertas.', 'Compara costo, tiempo y reconocimiento.', 'Decide y agenda fecha.'],
    searches: ['ISO 27001 Lead Implementer vs Lead Auditor', 'CompTIA Security+ vs ISC2 CC GRC'],
    practice: ['Apunte con tu decisión y por qué.'],
  },

  /* ---------------- Mes 4 ---------------- */
  's14-a': {
    why: 'Las empresas usan plataformas GRC; saber operar una (aunque sea open source) te da algo concreto que contar.',
    steps: ['Revisa requisitos e instala Docker Desktop.', 'Sigue el Quick Start del repo o usa la prueba en la nube.', 'Recorre: dominios, activos, riesgos, marcos, auditorías.'],
    searches: ['CISO Assistant tutorial', 'CISO Assistant docker install', 'Docker Desktop Mac install'],
    sources: [S.cisoAssistant, yt('Demo de CISO Assistant', 'CISO Assistant GRC demo')],
    practice: ['Instancia funcionando y capturas del tablero.'],
  },
  's14-b': {
    why: 'Pasar tu SGSI de hojas a una plataforma muestra que entiendes el modelo de datos de GRC.',
    steps: ['Crea el dominio Pacífica Logística.', 'Carga activos y riesgos.', 'Activa el marco ISO 27001:2022 y evalúa controles.'],
    searches: ['CISO Assistant risk assessment', 'CISO Assistant compliance assessment ISO 27001'],
    sources: [S.cisoAssistant],
    practice: ['Evaluación de cumplimiento con al menos 30 controles evaluados.'],
  },
  's15-a': {
    why: 'Prompts probados te ahorran horas; además, “uso responsable de IA en GRC” es un tema que buscan.',
    steps: ['Escribe 5 prompts con contexto, tarea, formato y restricciones.', 'Pruébalos y mejóralos.', 'Guarda los finales aquí.'],
    sources: [S.claude, { kind: 'lectura', label: 'awesome-grc-ai', url: 'https://github.com/ethanolivertroy/awesome-grc-ai' }],
    searches: ['prompt engineering for compliance', 'AI governance NIST AI RMF'],
    practice: ['Biblioteca de 5 prompts como apuntes.'],
    tips: ['Estructura: rol + contexto + tarea + formato de salida + lo que NO debe hacer.'],
  },
  's15-b': {
    why: 'NotebookLM responde solo con tus fuentes: ideal para repasar tus propios entregables.',
    steps: ['Crea un cuaderno “GRC”.', 'Sube tus apuntes exportados y tus documentos.', 'Pide preguntas tipo examen y resúmenes.'],
    sources: [S.notebookLM],
    searches: ['NotebookLM tutorial study'],
    practice: ['Exporta tu biblioteca (botón en Biblioteca) y súbela.'],
  },
  's16-a': {
    why: 'La dirección no lee registros de 50 filas; lee 2 páginas con decisiones. Saber resumir es lo que te hace crecer.',
    steps: ['Elige el top 5 por nivel.', 'Explica cada uno en lenguaje de negocio (dinero, clientes, operación).', 'Termina con decisiones que necesitas.'],
    searches: ['executive cyber risk report example', 'how to present cyber risk to board'],
    template: ['Resumen en 3 líneas', 'Mapa de calor', 'Top 5 riesgos (qué, impacto en el negocio, tendencia)', 'Avance de tratamientos', 'Decisiones solicitadas'],
    practice: ['Informe de 2 páginas en PDF.'],
  },
  's16-b': {
    why: 'Un dashboard hace visible el estado del programa de un vistazo.',
    steps: ['Conecta tu registro de riesgos de Sheets.', 'Gráficas: riesgos por nivel, por dueño, tratamientos por estado.', 'Agrega el mapa de calor.'],
    searches: ['Looker Studio dashboard tutorial', 'risk heat map google sheets'],
    sources: [{ kind: 'herramienta', label: 'Looker Studio', url: 'https://lookerstudio.google.com' }],
    practice: ['Dashboard con enlace compartible.'],
  },

  /* ---------------- Mes 5 ---------------- */
  's18-a': {
    why: 'La continuidad responde “¿cómo seguimos operando si algo grave pasa?”. Es parte del Anexo A y de muchos puestos de riesgo.',
    steps: ['Primero BIA: qué procesos son críticos y cuánto aguantan detenidos.', 'Después RTO y RPO.', 'Luego estrategias de recuperación y pruebas.'],
    concepts: [
      ['BIA', 'Análisis de impacto al negocio: qué pasa si un proceso se detiene y por cuánto tiempo.'],
      ['RTO', 'Tiempo máximo para restablecer un proceso o sistema.'],
      ['RPO', 'Máxima pérdida de datos tolerable, medida en tiempo (ej. 4 horas).'],
      ['DRP', 'Plan de recuperación ante desastres de TI.'],
      ['BCP', 'Plan de continuidad del negocio completo (personas, procesos, TI).'],
    ],
    searches: ['business impact analysis explained', 'RTO vs RPO', 'ISO 22301 basics'],
    sources: [yt('BIA, RTO y RPO explicados', 'business impact analysis RTO RPO explained'), udemy('Cursos de continuidad de negocio', 'business continuity ISO 22301')],
    practice: ['Guarda los 5 conceptos.'],
  },
  's18-b': {
    why: 'Con el BIA decides qué recuperar primero; con el plan, cómo.',
    steps: ['Elige 3 procesos (rastreo, facturación, bodega).', 'Calcula impacto por hora/día.', 'Define RTO/RPO y estrategia.'],
    searches: ['BIA template', 'business continuity plan template small business'],
    template: ['Proceso', 'Dueño', 'Impacto a 4 h / 1 día / 1 semana', 'RTO', 'RPO', 'Dependencias', 'Estrategia de recuperación'],
    practice: ['BIA en Sheets + plan de 2 páginas.'],
  },
  's18-c': {
    why: 'Un ejercicio de mesa prueba el plan de incidentes sin romper nada. Facilitarlo es una habilidad muy valorada.',
    steps: ['Escribe el escenario en 3–4 “inyecciones” que se revelan poco a poco.', 'Define roles y preguntas.', 'Documenta decisiones y lecciones.'],
    searches: ['ransomware tabletop exercise scenario', 'CISA tabletop exercise packages'],
    sources: [{ kind: 'gratis', label: 'CISA: paquetes de ejercicios de mesa', url: 'https://www.cisa.gov/resources-tools/services/cisa-tabletop-exercise-packages' }],
    template: ['Objetivos', 'Participantes y roles', 'Escenario e inyecciones', 'Preguntas por inyección', 'Decisiones tomadas', 'Lecciones aprendidas y acciones'],
    practice: ['Guion e informe del ejercicio.'],
  },
  's19-a': {
    why: 'Privacidad y seguridad van juntas: muchos roles de cumplimiento piden conocer la ley de datos personales.',
    steps: ['Primero conceptos: dato personal, dato sensible, responsable, encargado, titular.', 'Después principios y derechos ARCO.', 'Luego obligaciones: aviso de privacidad, medidas de seguridad, vulneraciones.', 'GDPR como referencia internacional.'],
    concepts: [
      ['Dato personal', 'Cualquier información de una persona identificada o identificable.'],
      ['Dato sensible', 'Datos cuyo mal uso puede discriminar o causar daño grave (salud, religión, etc.).'],
      ['Responsable', 'Quien decide sobre el tratamiento de los datos.'],
      ['Encargado', 'Quien trata datos por cuenta del responsable (un proveedor).'],
      ['Derechos ARCO', 'Acceso, Rectificación, Cancelación y Oposición.'],
      ['Aviso de privacidad', 'Documento que informa al titular qué datos se recaban y para qué.'],
    ],
    searches: ['LFPDPPP 2025 resumen', 'derechos ARCO explicados', 'GDPR basics explained', 'ISO 27701'],
    sources: [yt('LFPDPPP explicada', 'Ley Federal de Protección de Datos Personales en Posesión de los Particulares explicada'), yt('GDPR en 10 minutos', 'GDPR explained')],
    practice: ['Guarda los 6 conceptos con ejemplo de Pacífica.'],
    tips: ['La ley mexicana cambió en 2025; usa fuentes de 2025 en adelante.'],
  },
  's19-b': {
    why: 'Sin saber qué datos personales tienes, no puedes protegerlos ni cumplir la ley.',
    steps: ['Lista los procesos que usan datos personales.', 'Por cada uno: qué datos, finalidad, dónde, quién accede, cuánto tiempo.', 'Redacta el aviso de privacidad a partir de esto.'],
    searches: ['record of processing activities template', 'aviso de privacidad ejemplo'],
    template: ['Proceso', 'Titulares', 'Datos', '¿Sensibles?', 'Finalidad', 'Sistema / ubicación', 'Accesos', 'Conservación', 'Transferencias'],
    practice: ['Inventario + aviso de privacidad borrador.'],
  },
  's20-a': {
    why: 'Las personas son el control más débil y el más barato de mejorar.',
    steps: ['Define temas por mes (phishing, contraseñas, IA, viajes…).', 'Elige formatos (videos, correo, simulaciones).', 'Define métricas.'],
    searches: ['security awareness program plan', 'security awareness metrics'],
    template: ['Mes', 'Tema', 'Público', 'Formato', 'Responsable', 'Métrica'],
    practice: ['Calendario anual en Sheets.'],
  },
  's20-b': {
    why: 'Crear capacitación demuestra que puedes comunicar seguridad a no técnicos.',
    steps: ['5 señales de phishing con ejemplos.', 'Qué hacer y a quién reportar.', 'Quiz de 5 preguntas.'],
    searches: ['phishing awareness training slides', 'phishing red flags examples'],
    sources: [{ kind: 'gratis', label: 'Google Phishing Quiz', url: 'https://phishingquiz.withgoogle.com/' }],
    practice: ['10 diapositivas + quiz.'],
  },
  's20-c': {
    why: 'Lo que no se mide no se mejora; la cláusula 9.1 pide medir el SGSI.',
    steps: ['Elige 8 indicadores útiles.', 'Define fórmula, meta y frecuencia.', 'Simula valores de 3 meses.'],
    searches: ['ISMS KPIs examples ISO 27001 9.1', 'security metrics examples'],
    template: ['Indicador', 'Fórmula', 'Meta', 'Frecuencia', 'Responsable', 'Fuente de datos'],
    practice: ['Tabla de KPIs con valores simulados.'],
  },
  's21-b': {
    why: 'STAR convierte tus proyectos en historias de experiencia que el entrevistador recuerda.',
    steps: ['Elige 5 situaciones de tus proyectos.', 'Escribe Situación, Tarea, Acción y Resultado.', 'Ensaya en voz alta: 2 minutos cada una.'],
    searches: ['STAR method interview examples'],
    template: ['Situación', 'Tarea', 'Acción (lo que hiciste tú)', 'Resultado (con números)'],
    practice: ['5 historias como apuntes.'],
  },
  's21-c': {
    why: 'Un analista GRC no configura firewalls, pero debe entender qué son para evaluar controles.',
    steps: ['Para cada tema: qué es, qué riesgo reduce, qué control del Anexo A lo cubre.', 'Usa videos cortos de nivel Security+.'],
    searches: ['encryption at rest vs in transit', 'vulnerability management lifecycle', 'backup 3-2-1 rule', 'MFA explained'],
    sources: [S.messer, S.cis],
    practice: ['Un apunte por tema con su control del Anexo A.'],
  },

  /* ---------------- Mes 6 ---------------- */
  's22-a': {
    why: 'Lead Implementer prueba que puedes llevar una implementación completa; es la certificación que más te sube de nivel en ISO.',
    steps: ['Compara opciones: Advisera, PECB vía partner, BSI.', 'Revisa costo total (curso, examen, emisión, cuota anual).', 'Agenda la fecha del examen para la semana 24.'],
    searches: ['ISO 27001 Lead Implementer exam format', 'PECB Lead Implementer cost', 'Advisera Lead Implementer review'],
    sources: [{ kind: 'gratis', label: 'Advisera Lead Implementer', url: 'https://training.advisera.com/course/iso-27001-lead-implementer-course/' }, { kind: 'lectura', label: 'PECB ISO/IEC 27001', url: 'https://pecb.com/en/education-and-certification-for-individuals/iso-iec-27001' }, udemy('Preparación Lead Implementer', 'ISO 27001 Lead Implementer')],
    practice: ['Apunte con la decisión, costo y fecha.'],
  },
  's22-c': {
    why: 'Un plan de implementación demuestra que piensas como líder de proyecto, no solo como redactor de documentos.',
    steps: ['Divide en fases: inicio, contexto y riesgos, documentación, implementación, auditoría interna, revisión, certificación.', 'Asigna entregables y responsables.', 'Haz el Gantt.'],
    searches: ['ISO 27001 implementation project plan template', 'Gantt chart google sheets'],
    template: ['Fase', 'Entregables', 'Responsable', 'Inicio', 'Fin', 'Dependencias'],
    practice: ['Gantt de 12 meses.'],
  },
  's23-b': {
    why: 'La revisión por la dirección (9.3) cierra el ciclo PDCA: la dirección decide con base en resultados.',
    steps: ['Lee qué entradas pide la 9.3.', 'Reúne datos simulados (KPIs, auditoría, riesgos).', 'Escribe el acta con decisiones.'],
    searches: ['ISO 27001 management review inputs outputs', 'management review minutes template'],
    template: ['Asistentes', 'Estado de acciones previas', 'Cambios en el contexto', 'Desempeño (KPIs, auditorías, no conformidades)', 'Riesgos', 'Oportunidades de mejora', 'Decisiones y responsables'],
    practice: ['Acta de 2 páginas.'],
  },
  's23-c': {
    why: 'Corregir la causa (no el síntoma) es lo que hace que el SGSI mejore de verdad.',
    steps: ['Para cada hallazgo, análisis de causa raíz (5 porqués).', 'Acción correctiva y responsable.', 'Cómo verificarás que funcionó.'],
    concepts: [['Acción correctiva', 'Acción para eliminar la causa de una no conformidad y que no se repita.'], ['5 porqués', 'Técnica para llegar a la causa raíz preguntando “¿por qué?” varias veces.']],
    searches: ['5 whys root cause analysis', 'corrective action plan ISO 27001 10.2'],
    template: ['Hallazgo', 'Causa raíz', 'Corrección inmediata', 'Acción correctiva', 'Responsable', 'Fecha', 'Verificación de eficacia'],
    practice: ['Plan de acciones correctivas.'],
  },
  's25-a': {
    why: 'El capstone junta todo en una historia: “así implementé un SGSI de principio a fin”. Es tu carta fuerte en entrevistas.',
    steps: ['Ordena todos los entregables por fase PDCA.', 'Escribe el caso de estudio de una página.', 'Publícalo en tu web con índice.'],
    searches: ['case study format portfolio'],
    template: ['Contexto de la empresa', 'Reto', 'Enfoque por fases', 'Entregables (con enlaces)', 'Resultados e indicadores', 'Lecciones aprendidas'],
    practice: ['Página del capstone publicada.'],
  },
  's11-b': {
    why: 'Muchas vacantes GRC se llenan por recomendación. Tu red es parte de tu búsqueda.',
    steps: ['Busca analistas GRC, auditores de TI y reclutadores de ciberseguridad en tu país.', 'Envía invitación con nota corta y personalizada.', 'Comenta con valor en sus publicaciones antes de pedir algo.'],
    searches: ['LinkedIn connection request message examples cybersecurity', 'networking tips GRC career'],
    sources: [S.simplyCyber],
    prompt: 'Escribe 3 versiones de una nota de conexión de LinkedIn (máx. 280 caracteres) para un Analista GRC senior. Soy junior en transición, estoy implementando un SGSI simulado con ISO 27001. Sin pedir trabajo, cálido y concreto.',
    practice: ['Guarda aquí con quién conectaste y qué aprendiste de su perfil.'],
  },
  's15-c': {
    why: 'Gobernar la IA es GRC puro: decidir qué se permite, qué no y cómo se controla.',
    steps: ['Lista usos permitidos y prohibidos.', 'Define qué datos nunca entran a una IA pública.', 'Define revisión humana y cómo se cita.'],
    searches: ['generative AI acceptable use policy template', 'NIST AI RMF playbook'],
    sources: [{ kind: 'lectura', label: 'NIST AI RMF', url: 'https://www.nist.gov/itl/ai-risk-management-framework' }],
    template: ['Propósito', 'Herramientas aprobadas', 'Usos permitidos', 'Usos prohibidos', 'Datos que nunca se comparten', 'Revisión humana', 'Responsables'],
    practice: ['Regla de 1 página; es la semilla del proyecto extra de gobierno de IA.'],
  },
  's19-c': {
    why: 'Traducir una ley a controles concretos es exactamente lo que hace un analista de cumplimiento.',
    steps: ['Extrae 10 obligaciones de la ley.', 'Busca el control del Anexo A que la cubre.', 'Define la evidencia.'],
    searches: ['ISO 27701 mapping privacy controls', 'regulatory requirements mapping matrix'],
    template: ['Artículo / obligación', 'Qué exige', 'Control ISO 27001', 'Evidencia', 'Responsable', 'Estado'],
    practice: ['Matriz de 10 filas en Sheets.'],
  },
  's21-a': {
    why: 'Un simulacro largo prueba tu resistencia y tus historias STAR.',
    steps: ['Pídele a la IA un proceso completo: presentación, técnicas, situacionales y tus preguntas.', 'Responde en voz alta con cronómetro.', 'Pide retroalimentación y repite la parte débil.'],
    searches: ['GRC analyst mock interview', 'ISO 27001 interview questions'],
    sources: [S.claude, yt('Simulacros de entrevista GRC', 'GRC analyst mock interview')],
    prompt: 'Haz una entrevista completa de 30 minutos para Analista GRC junior: 2 de presentación, 5 técnicas (ISO 27001, riesgos, auditoría, NIST), 3 situacionales. Una pregunta a la vez y al final un informe con calificación y 3 mejoras.',
    practice: ['Guarda el informe de retroalimentación como apunte.'],
  },
  's22-b': {
    why: 'La planeación define si el proyecto SGSI termina a tiempo o se arrastra años.',
    steps: ['Caso de negocio y aprobación de la dirección.', 'Equipo, roles y comunicación.', 'Contexto, alcance, riesgos (ya los tienes) y cronograma.'],
    searches: ['ISO 27001 implementation project initiation', 'ISMS business case'],
    sources: [{ kind: 'gratis', label: 'Advisera Lead Implementer', url: 'https://training.advisera.com/course/iso-27001-lead-implementer-course/' }, S.udemyLab],
    practice: ['Caso de negocio de 1 página para Pacífica.'],
  },
  's23-a': {
    why: 'Saber cómo es la auditoría externa te permite preparar a la empresa para aprobarla.',
    steps: ['Etapa 1: revisión documental.', 'Etapa 2: verificación en campo.', 'Después: auditorías de seguimiento anuales y recertificación cada 3 años.'],
    concepts: [
      ['Auditoría etapa 1', 'Revisión de documentos y preparación para la etapa 2.'],
      ['Auditoría etapa 2', 'Verificación de que el SGSI funciona en la práctica.'],
      ['Auditoría de seguimiento', 'Revisión anual entre recertificaciones.'],
    ],
    searches: ['ISO 27001 certification audit stage 1 stage 2', 'ISO 27001 surveillance audit'],
    practice: ['Checklist “¿Está Pacífica lista para la etapa 1?”.'],
  },
  's24-b': {
    why: 'El examen Lead Implementer valida que puedes implementar un SGSI completo.',
    steps: ['Revisa formato y si es a libro abierto.', 'Repasa tus entregables: son tus mejores ejemplos para preguntas de caso.', 'Administra el tiempo por pregunta.'],
    searches: ['PECB ISO 27001 Lead Implementer exam tips', 'Advisera Lead Implementer exam'],
    practice: ['Guarda tu resultado y la fecha del certificado.'],
    tips: ['En preguntas de caso, responde como implementador: contexto → riesgo → control → evidencia.'],
  },
};

/* ---------- Guías compartidas y por tipo ---------- */

const APLICAR: Guide = {
  why: 'Aplicar es un número: entre más aplicaciones bien hechas, más entrevistas. La constancia semanal gana.',
  steps: [
    'Busca en LinkedIn, OCC, Indeed, Computrabajo y portales de las Big Four.',
    'Adapta 2–3 líneas del CV y del mensaje a cada vacante.',
    'Registra cada aplicación y da seguimiento a los 7 días.',
  ],
  searches: ['Analista GRC', 'Analista de cumplimiento TI', 'IT risk analyst remote LATAM', 'Auditor de sistemas junior', 'Analista de seguridad de la información junior'],
  sources: [
    { kind: 'herramienta', label: 'LinkedIn Empleos: Analista GRC', url: 'https://www.linkedin.com/jobs/search/?keywords=Analista%20GRC' },
    { kind: 'herramienta', label: 'OCC: seguridad de la información', url: 'https://www.occ.com.mx/empleos/de-seguridad-de-la-informacion/' },
    S.simplyCyber,
  ],
  practice: ['Guarda aquí cada vacante como enlace (empresa y puesto en el título) y su estado en la nota.'],
  tips: ['No esperes cumplir el 100 %: si cubres el 60 % de los requisitos, aplica.', 'Mensaje corto al reclutador con el enlace a tu proyecto más relevante.'],
};

const VIDEO: Guide = {
  why: 'Explicar tu trabajo en video demuestra comunicación, la habilidad más valorada en GRC.',
  steps: ['Guion de 5 puntos: contexto, problema, qué hiciste, resultado, qué aprendiste.', 'Graba pantalla con tu entregable abierto.', 'Una sola toma; no busques perfección.'],
  searches: ['how to record a portfolio walkthrough video'],
  sources: [{ kind: 'herramienta', label: 'Loom', url: 'https://www.loom.com' }],
  practice: ['Guarda el enlace del video como entregable.'],
};

const PUBLICAR: Guide = {
  why: 'Lo que no se publica no existe para un reclutador.',
  steps: ['Página del proyecto en tu web con formato de caso.', 'Post en LinkedIn con una lección concreta y el enlace.', 'Guarda los enlaces aquí.'],
  searches: ['how to showcase portfolio projects LinkedIn'],
  template: ['Problema', 'Enfoque', 'Entregables', 'Resultado', 'Herramientas'],
  practice: ['Enlaces al proyecto y al post como entregables.'],
};

const EXAMEN_PRACTICA: Guide = {
  why: 'Los exámenes de práctica entrenan el formato y te muestran exactamente qué repasar.',
  steps: ['Hazlo cronometrado y sin notas.', 'Revisa cada error y por qué la correcta es correcta.', 'Repite hasta superar el 80 % dos veces.'],
  searches: ['ISO 27001 practice exam questions'],
  practice: ['Guarda tus puntajes y temas débiles como apuntes.'],
};

const POR_TIPO: Record<TaskKind, Guide> = {
  estudio: {
    why: 'Estudiar con un orden claro y anotar con tus palabras es lo que hace que se te quede.',
    steps: ['Primero un video corto para la idea general.', 'Después una fuente oficial o un curso.', 'Al final escribe un resumen y 3 conceptos en tu biblioteca.'],
    searches: [],
    practice: ['Explica el tema en 2 minutos como si fuera a alguien sin conocimientos.'],
  },
  practica: {
    why: 'Cada entregable de la empresa ficticia es una prueba de que sabes hacer el trabajo.',
    steps: ['Busca 2 ejemplos o plantillas.', 'Haz tu versión para Pacífica Logística.', 'Revísala contra la norma y guarda el enlace aquí.'],
    searches: [],
    practice: ['Guarda el archivo en tu carpeta y su enlace como entregable.'],
  },
  herramienta: {
    why: 'Las herramientas multiplican tu trabajo, pero el criterio sigue siendo tuyo.',
    steps: ['Ve un tutorial corto.', 'Úsala con un caso de Pacífica.', 'Documenta con capturas.'],
    searches: [],
    practice: ['Guarda capturas o enlaces como entregables.'],
  },
  carrera: {
    why: 'Tu carrera avanza cuando lo que sabes se ve: perfil, proyectos y contactos.',
    steps: ['Hazlo hoy, aunque no quede perfecto.', 'Pide retroalimentación a alguien.', 'Mejóralo la siguiente semana.'],
    searches: [],
    practice: ['Guarda enlaces y resultados aquí.'],
  },
  cert: {
    why: 'Las certificaciones abren filtros de RR. HH.; tus proyectos convencen en la entrevista.',
    steps: ['Revisa el temario oficial.', 'Exámenes de práctica.', 'Repasa solo tus temas débiles.'],
    searches: [],
    practice: ['Guarda puntajes y fechas.'],
  },
};

/** La guía de un paso: la suya, una compartida o la de su tipo (con búsquedas tomadas del título). */
export function guideFor(task: RoadmapTask): { guide: Guide; generic: boolean } {
  const propia = GUIDES[task.id];
  if (propia) return { guide: propia, generic: false };
  const t = task.title.toLowerCase();
  const compartida = t.startsWith('aplica a')
    ? APLICAR
    : t.startsWith('video')
      ? VIDEO
      : t.startsWith('publica') || t.startsWith('post en linkedin')
        ? PUBLICAR
        : t.includes('exámenes de práctica') || t.includes('dos exámenes')
          ? EXAMEN_PRACTICA
          : null;
  if (compartida) return { guide: compartida, generic: false };
  const base = POR_TIPO[task.kind];
  return { guide: { ...base, searches: [task.title] }, generic: true };
}
