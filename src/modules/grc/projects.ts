// Proyectos del portafolio: cada uno junta varios pasos de la ruta en algo
// que puedes mostrar. Los "extra" son para cuando vas adelantado o
// después del mes 6. Las notas de un proyecto se guardan con su id.

export interface Project {
  id: string;
  n: number;
  title: string;
  /** Semanas de la ruta donde se construye; vacío en los extra. */
  weeks: number[];
  extra?: boolean;
  /** Qué problema resuelve, en una línea. */
  goal: string;
  /** Lo que demuestra (palabras clave para CV y LinkedIn). */
  skills: string[];
  deliverables: string[];
  steps: string[];
  tools: string[];
  /** Cómo contarlo en tu web y en entrevistas. */
  pitch: string;
  /** Una línea lista para tu CV. */
  cvLine: string;
}

export const PROJECTS: Project[] = [
  {
    id: 'proj-sgsi',
    n: 1,
    title: 'SGSI de Pacífica Logística',
    weeks: [1, 2, 5, 6, 7, 8],
    goal: 'Diseñar los documentos núcleo de un SGSI según ISO 27001:2022.',
    skills: ['ISO 27001', 'SGSI', 'Políticas de seguridad', 'Declaración de Aplicabilidad', 'Análisis de brechas'],
    deliverables: ['Ficha y contexto de la organización', 'Alcance del SGSI', 'Política de seguridad', 'SoA de 93 controles', 'Políticas de accesos, uso aceptable, clasificación e incidentes', 'Análisis de brechas'],
    steps: ['Contexto y partes interesadas', 'Alcance', 'Política', 'SoA', 'Políticas específicas', 'Gap analysis', 'Resumen e índice'],
    tools: ['Google Docs/Sheets', 'draw.io', 'IA para borradores', 'GitHub'],
    pitch: 'Partí de una empresa de logística de 80 personas que quería certificarse y construí los documentos que un auditor revisa primero, justificando cada control con un riesgo.',
    cvLine: 'Diseñé la documentación núcleo de un SGSI ISO 27001:2022 (alcance, política, SoA de 93 controles y gap analysis) para una empresa simulada de 80 empleados.',
  },
  {
    id: 'proj-riesgos',
    n: 2,
    title: 'Metodología y registro de riesgos',
    weeks: [3, 4, 6],
    goal: 'Identificar, valorar y tratar riesgos de forma consistente.',
    skills: ['Gestión de riesgos', 'ISO 27005', 'NIST SP 800-30', 'Plan de tratamiento'],
    deliverables: ['Inventario de 20 activos', 'Metodología 5×5 con criterio de aceptación', 'Registro de 15–20 riesgos', 'Plan de tratamiento', 'Video de 3 minutos'],
    steps: ['Inventario', 'Metodología', 'Escenarios (con ayuda de IA)', 'Valoración', 'Tratamiento y riesgo residual'],
    tools: ['Google Sheets', 'IA', 'Loom'],
    pitch: 'Definí cómo medir el riesgo para que dos personas lleguen al mismo resultado y prioricé dónde invertir primero.',
    cvLine: 'Elaboré metodología de riesgos 5×5 y registro de 18 riesgos con plan de tratamiento alineado al Anexo A de ISO 27001.',
  },
  {
    id: 'proj-terceros',
    n: 3,
    title: 'Riesgo de terceros (TPRM)',
    weeks: [11, 12],
    goal: 'Evaluar la seguridad de proveedores críticos.',
    skills: ['Gestión de riesgos de terceros', 'Cuestionarios de seguridad', 'Debida diligencia'],
    deliverables: ['Cuestionario de 30 preguntas', 'Evaluación de 2 proveedores', 'Matriz de criticidad de proveedores'],
    steps: ['Clasificar proveedores por criticidad', 'Cuestionario por dominios', 'Evaluar respuestas y evidencias', 'Informe con riesgos y condiciones contractuales'],
    tools: ['Google Forms/Sheets'],
    pitch: 'Creé el proceso para decidir si un proveedor es seguro antes de darle acceso a datos de clientes.',
    cvLine: 'Desarrollé un cuestionario de seguridad de 30 controles y evalué a 2 proveedores críticos con matriz de riesgo.',
  },
  {
    id: 'proj-herramienta',
    n: 4,
    title: 'Programa GRC en una plataforma',
    weeks: [14, 15, 16, 17],
    goal: 'Operar riesgos, controles y cumplimiento en una herramienta GRC y reportar a la dirección.',
    skills: ['Plataformas GRC', 'CISO Assistant', 'Dashboards', 'Reporte ejecutivo', 'IA responsable'],
    deliverables: ['Instancia de CISO Assistant con Pacífica cargada', 'Evaluación de cumplimiento ISO 27001', 'Dashboard de riesgos', 'Informe ejecutivo de 2 páginas', 'Video'],
    steps: ['Instalar', 'Cargar activos y riesgos', 'Evaluar controles', 'Dashboard', 'Informe ejecutivo'],
    tools: ['CISO Assistant', 'Docker', 'Looker Studio', 'Loom'],
    pitch: 'Pasé el SGSI de hojas sueltas a una plataforma GRC y convertí los datos en un informe que la dirección puede usar para decidir.',
    cvLine: 'Implementé un programa GRC en CISO Assistant y elaboré dashboard e informe ejecutivo de riesgos para la dirección.',
  },
  {
    id: 'proj-auditoria',
    n: 5,
    title: 'Auditoría interna simulada',
    weeks: [12, 13, 23],
    goal: 'Verificar con evidencia el cumplimiento de controles y cerrar hallazgos.',
    skills: ['Auditoría interna', 'ISO 19011', 'Hallazgos', 'Acciones correctivas'],
    deliverables: ['Plan de auditoría', 'Checklist de 5 controles', 'Informe de hallazgos', 'Plan de acciones correctivas'],
    steps: ['Plan y alcance', 'Checklist', 'Evidencia simulada', 'Hallazgos', 'Causa raíz y acciones'],
    tools: ['Google Docs/Sheets'],
    pitch: 'Audité controles como lo haría un auditor interno y llevé cada hallazgo hasta su causa raíz.',
    cvLine: 'Realicé una auditoría interna simulada de ISO 27001, documenté hallazgos y diseñé acciones correctivas con análisis de causa raíz.',
  },
  {
    id: 'proj-continuidad',
    n: 6,
    title: 'Continuidad y ejercicio de ransomware',
    weeks: [18],
    goal: 'Preparar a la empresa para seguir operando ante un incidente grave.',
    skills: ['Continuidad de negocio', 'BIA', 'RTO/RPO', 'Ejercicios de mesa', 'Respuesta a incidentes'],
    deliverables: ['BIA de 3 procesos', 'Plan de continuidad', 'Guion e informe de ejercicio de mesa'],
    steps: ['BIA', 'RTO/RPO', 'Estrategias', 'Escenario de ransomware', 'Lecciones aprendidas'],
    tools: ['Google Sheets', 'paquetes de ejercicios de CISA'],
    pitch: 'Medí cuánto aguanta la operación sin sistemas y probé el plan con un ejercicio de ransomware.',
    cvLine: 'Elaboré BIA, plan de continuidad y facilité un ejercicio de mesa de ransomware con informe de lecciones aprendidas.',
  },
  {
    id: 'proj-privacidad',
    n: 7,
    title: 'Privacidad y concientización',
    weeks: [19, 20],
    goal: 'Cumplir la ley de datos personales y reducir el riesgo humano.',
    skills: ['Privacidad', 'LFPDPPP', 'GDPR', 'Concientización', 'KPIs del SGSI'],
    deliverables: ['Inventario de datos personales', 'Aviso de privacidad', 'Mapa requisito legal → control', 'Programa anual de concientización', 'Módulo de phishing', 'Tablero de KPIs'],
    steps: ['Inventario de datos', 'Aviso', 'Mapeo a controles', 'Programa de concientización', 'Módulo', 'KPIs'],
    tools: ['Google Docs/Sheets/Slides'],
    pitch: 'Uní cumplimiento legal y seguridad: qué datos tenemos, qué dice la ley y qué control lo cumple, más un programa para las personas.',
    cvLine: 'Desarrollé inventario de datos personales, aviso de privacidad y programa anual de concientización con 8 indicadores.',
  },
  {
    id: 'proj-capstone',
    n: 8,
    title: 'Capstone: SGSI completo',
    weeks: [22, 23, 25],
    goal: 'Contar de principio a fin cómo se implementa un SGSI.',
    skills: ['Implementación ISO 27001', 'Gestión de proyectos', 'Revisión por la dirección', 'Mejora continua'],
    deliverables: ['Plan de implementación a 12 meses', 'Acta de revisión por la dirección', 'Caso de estudio de 1 página', 'Video de 5 minutos'],
    steps: ['Plan', 'Revisión por la dirección', 'Índice de todo', 'Caso de estudio', 'Video'],
    tools: ['GitHub Pages', 'Loom'],
    pitch: 'Es la historia completa: de una empresa sin SGSI a una lista para su auditoría de certificación.',
    cvLine: 'Lideré de forma simulada la implementación completa de un SGSI ISO 27001:2022, desde el contexto hasta la revisión por la dirección.',
  },
  {
    id: 'proj-mapeo',
    n: 9,
    title: 'Extra: un control, tres marcos',
    weeks: [],
    extra: true,
    goal: 'Mostrar que un mismo control cumple ISO 27001, NIST CSF 2.0 y CIS Controls.',
    skills: ['Mapeo de marcos', 'NIST CSF 2.0', 'CIS Controls', 'Cumplimiento unificado'],
    deliverables: ['Matriz de 40 controles en 3 marcos', 'Guía de evidencias por control'],
    steps: ['Elegir 40 controles', 'Mapear', 'Definir evidencia común', 'Resumen de ahorro de esfuerzo'],
    tools: ['Google Sheets'],
    pitch: 'Reduje el trabajo de cumplimiento mostrando qué evidencia sirve para varios marcos a la vez.',
    cvLine: 'Construí una matriz de controles unificada ISO 27001 / NIST CSF 2.0 / CIS v8 con evidencias comunes.',
  },
  {
    id: 'proj-ia',
    n: 10,
    title: 'Extra: gobierno de IA',
    weeks: [],
    extra: true,
    goal: 'Definir cómo una empresa usa IA generativa de forma segura.',
    skills: ['Gobierno de IA', 'ISO 42001', 'NIST AI RMF', 'Política de uso de IA'],
    deliverables: ['Política de uso de IA', 'Inventario de herramientas de IA', 'Evaluación de riesgos de IA'],
    steps: ['Leer NIST AI RMF (resumen)', 'Inventario de usos de IA en Pacífica', 'Riesgos (fuga de datos, sesgo, alucinaciones)', 'Política y controles'],
    tools: ['NIST AI RMF', 'IA'],
    pitch: 'Llevé GRC a la IA: qué se permite, qué no y cómo se controla. Es de los temas más buscados ahora.',
    cvLine: 'Elaboré política y evaluación de riesgos de IA generativa alineadas a NIST AI RMF e ISO/IEC 42001.',
  },
];

export const projectById = (id: string | undefined) => PROJECTS.find((p) => p.id === id);
