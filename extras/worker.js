// No usado en producción; versión de respaldo para Cloudflare, puede estar desactualizada
/**
 * As de Júpiter — Backend Proxy en Cloudflare Worker
 *
 * Este archivo se publica en Cloudflare Workers (sin dependencias externas).
 * Protege tu GEMINI_API_KEY como "Secret" en Cloudflare, restringe CORS a tu dominio,
 * aplica un límite diario por IP para cartas gratis y valida el JSON de Gemini antes de responder.
 */

const ALLOWED_EXACT_ORIGINS = new Set([
  'https://ais-pre-je5p43zcti47smd73hwmjw-681555613321.us-west2.run.app',
  'https://ais-dev-je5p43zcti47smd73hwmjw-681555613321.us-west2.run.app',
  'https://clo67.github.io',
]);

const LOCALHOST_ORIGIN_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const MAX_FREE_CARDS_PER_DAY = 5;
const MAX_OTHER_REQUESTS_PER_DAY = 30;
const GEMINI_TIMEOUT_MS = 25000;

const MODEL_CANDIDATES = [
  'gemini-4-hydrogen',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

const ESQUEMAS_POSICIONES_SERVER = {
  situacion_obstaculo_consejo: ['Situación actual', 'Obstáculo / Desafío', 'Consejo y rumbo'],
  pasado_presente_futuro: ['Raíz o Pasado', 'Presente actual', 'Tendencia Futura'],
  mente_corazon_accion: ['Lo que piensas (Mente)', 'Lo que sientes (Corazón)', 'Hacia dónde actuar'],
};

function resolverPosicionesServidor(esquemaId) {
  if (typeof esquemaId === 'string' && ESQUEMAS_POSICIONES_SERVER[esquemaId]) {
    return ESQUEMAS_POSICIONES_SERVER[esquemaId];
  }
  return ESQUEMAS_POSICIONES_SERVER.situacion_obstaculo_consejo;
}

const LUNA_SYSTEM_INSTRUCTION = `Eres Luna, la tarotista de IA de "As de Júpiter", una aplicación de lectura
de Tarot de Marsella. Tu función es realizar lecturas simbólicas y
reflexivas para acompañar a quien consulta, nunca predicciones garantizadas
ni diagnósticos de ningún tipo.

TONO Y VOZ: Hablas con una mezcla equilibrada de tres registros: calidez
cercana (como una amiga sabia que escucha de verdad), un toque
místico/ceremonial (sin caer en lo teatral ni sobrecargado de metáforas),
y practicidad (siempre cierras con algo concreto y accionable, no solo
poesía). Te diriges al consultante de tú (tuteo neutro, nunca vos ni
usted). Nunca uses voseo rioplatense (cuidá, elegí, tenés); usa siempre
tuteo neutro (cuida, elige, tienes). Evitas sonar genérica o como un horóscopo
de revista: cada lectura debe sentirse dirigida a la pregunta específica que
trajo la persona.

BASE DE CONOCIMIENTO: Trabajas exclusivamente con los 22 Arcanos Mayores
del Tarot de Marsella provistos en el archivo de datos de cartas. No usas
arcanos menores, no inventas cartas fuera de esa lista, no contradices el
significado base de cada carta (puedes adaptar lenguaje y énfasis, no el
núcleo del significado).

CÓMO TRABAJAS CON LAS CARTAS: Las cartas ya fueron sorteadas al azar, como al
mezclar un mazo, y te llegan en el mensaje. No las cambies ni elijas otras.
Tu tarea es interpretar esas cartas exactas en relación con el tema y la
pregunta de quien consulta.
No inventes plazos ni fechas (como 'este año', 'el próximo año', 'en tres meses')
que la persona no mencionó en su pregunta. Si la pregunta no indica un tiempo,
habla del momento presente y de los próximos pasos.

TIPOS DE LECTURA:
- CARTA GRATIS: 1 carta sorteada al azar según el tema (amor/dinero/futuro/familia).
  Interpretación de 3 a 4 líneas máximo.
- LECTURA DE 3 CARTAS (paga): interpretación desarrollada de las 3 cartas sorteadas
  según sus posiciones, más un cierre narrativo breve que conecta las tres cartas.
- CHAT DE CONSULTA (post-pago): responde preguntas de seguimiento,
  manteniendo coherencia con las cartas ya mostradas en la sesión.

LÍMITES DE SEGURIDAD (no negociables): nunca garantiza resultados futuros
reales, nunca diagnostica enfermedades ni da indicaciones médicas, nunca
da instrucciones financieras como garantía de resultado, nunca sugiere
reemplazar terapia o atención profesional. Si la pregunta del usuario
suena a angustia real o riesgo (autolesión, violencia, crisis emocional),
Luna no sigue con la lectura como si nada: responde con cuidado genuino y
sugiere buscar apoyo profesional, sin usar una tirada como reemplazo.
Presenta siempre la lectura como herramienta simbólica/reflexiva, usando
frases como "esto invita a pensar en..." en vez de "esto va a pasar".

FORMATO DE SALIDA: responde siempre en el JSON estructurado indicado por
el schema correspondiente, sin texto fuera del JSON.`;

const LUNA_SCHEMA_CARTA_GRATIS = {
  type: 'OBJECT',
  properties: {
    carta: {
      type: 'OBJECT',
      properties: {
        numero: { type: 'INTEGER', description: 'Número exacto del arcano mayor sorteado (0 al 21)' },
        nombre: { type: 'STRING', description: 'Nombre exacto del arcano mayor sorteado' },
      },
      required: ['numero', 'nombre'],
    },
    interpretacion_breve: {
      type: 'STRING',
      description: '3 a 4 líneas máximo, en el tono de Luna, interpretando la carta sorteada en relación directa con el tema y pregunta del usuario.',
    },
  },
  required: ['carta', 'interpretacion_breve'],
};

const LUNA_SCHEMA_TRES_CARTAS = {
  type: 'OBJECT',
  properties: {
    cartas: {
      type: 'ARRAY',
      description: 'Exactamente las 3 cartas sorteadas en el mismo orden y con las posiciones asignadas',
      items: {
        type: 'OBJECT',
        properties: {
          posicion: { type: 'STRING', description: 'Nombre exacto de la posición asignada por el servidor' },
          numero: { type: 'INTEGER', description: 'Número exacto del arcano mayor sorteado (0 al 21)' },
          nombre: { type: 'STRING', description: 'Nombre exacto del arcano mayor sorteado' },
          interpretacion: { type: 'STRING', description: 'Interpretación profunda y personalizada de la carta sorteada en esa posición' },
        },
        required: ['posicion', 'numero', 'nombre', 'interpretacion'],
      },
    },
    cierre_narrativo: {
      type: 'STRING',
      description: 'Párrafo breve que conecta las tres cartas sorteadas como una historia coherente, cerrando con un consejo práctico.',
    },
  },
  required: ['cartas', 'cierre_narrativo'],
};

const LUNA_SCHEMA_CHAT = {
  type: 'OBJECT',
  properties: {
    respuesta: {
      type: 'STRING',
      description: 'Respuesta de Luna a la consulta de seguimiento, manteniendo tono cálido, místico y práctico.',
    },
    cartas_nuevas: {
      type: 'ARRAY',
      description: 'Solo la carta adicional sorteada si la consulta lo amerita genuinamente; de lo contrario, arreglo vacío []',
      items: {
        type: 'OBJECT',
        properties: {
          numero: { type: 'INTEGER', description: 'Número del arcano mayor sorteado (0 al 21)' },
          nombre: { type: 'STRING', description: 'Nombre exacto del arcano mayor sorteado' },
          motivo: { type: 'STRING', description: 'Por qué esta carta complementa la respuesta' },
        },
        required: ['numero', 'nombre'],
      },
    },
  },
  required: ['respuesta'],
};

const CARTAS_DATA = [
  {
    numero: 0,
    nombre: 'El Loco',
    palabras_clave: ['libertad', 'espontaneidad', 'riesgo', 'inocencia', 'salto de fe'],
    significado_general: 'Representa el inicio de un camino sin plan fijo, la confianza en lo desconocido y la libertad de no estar atado a estructuras.',
    aspecto_positivo: 'Apertura a nuevas experiencias, espontaneidad, desapego de lo material, confianza en el proceso.',
    aspecto_desafiante: 'Falta de rumbo, decisiones impulsivas, ignorar riesgos evidentes.',
    temas: {
      amor: 'Una conexión que empieza sin ataduras ni expectativas; puede señalar a alguien que evita comprometerse o una etapa de apertura emocional.',
      dinero: 'Riesgo financiero, gasto impulsivo o el inicio de un proyecto sin plan claro todavía.',
      futuro: 'Un camino abierto, múltiples posibilidades, pero sin dirección definida aún.',
      familia: 'Necesidad de independencia dentro del núcleo familiar, o un quiebre con lo tradicional.',
    },
    consejo: 'Anímate a dar el paso, pero mira dónde pisas antes de saltar.',
  },
  {
    numero: 1,
    nombre: 'El Mago',
    palabras_clave: ['voluntad', 'habilidad', 'iniciativa', 'recursos', 'acción'],
    significado_general: 'Simboliza la capacidad de transformar una idea en acción concreta usando los recursos disponibles.',
    aspecto_positivo: 'Confianza, creatividad, capacidad de manifestar objetivos, buena comunicación.',
    aspecto_desafiante: 'Manipulación, dispersión, usar el talento sin ética o sin foco.',
    temas: {
      amor: 'Alguien que toma la iniciativa; capacidad de seducción o de construir algo nuevo con determinación.',
      dinero: 'Momento favorable para emprender o concretar un plan financiero con los recursos que ya tienes.',
      futuro: 'Un período de acción concreta donde tus decisiones tienen peso real.',
      familia: 'Rol de quien organiza o toma las riendas dentro de la familia.',
    },
    consejo: 'Tienes las herramientas necesarias; el paso siguiente es empezar.',
  },
  {
    numero: 2,
    nombre: 'La Papisa',
    palabras_clave: ['intuición', 'misterio', 'conocimiento interior', 'quietud', 'sabiduría'],
    significado_general: 'Representa el saber interior, la introspección y la sabiduría que no se explica racionalmente.',
    aspecto_positivo: 'Intuición aguda, paciencia, conexión con un saber más profundo.',
    aspecto_desafiante: 'Aislamiento, secretismo excesivo, bloqueo emocional.',
    temas: {
      amor: 'Una relación con capas ocultas o no dichas; necesidad de escuchar la intuición antes de actuar.',
      dinero: 'Momento de esperar y observar antes de mover recursos; información aún no revelada.',
      futuro: 'Un período de introspección más que de acción externa.',
      familia: 'Secretos familiares o una figura materna/mentora con peso simbólico.',
    },
    consejo: 'No fuerces respuestas; algunas cosas se revelan con tiempo.',
  },
  {
    numero: 3,
    nombre: 'La Emperatriz',
    palabras_clave: ['abundancia', 'fertilidad', 'creatividad', 'cuidado', 'naturaleza'],
    significado_general: 'Simboliza la creación, el crecimiento y la abundancia en un sentido amplio: material, emocional o creativo.',
    aspecto_positivo: 'Prosperidad, cuidado de uno mismo y de otros, creatividad floreciente.',
    aspecto_desafiante: 'Sobreprotección, dependencia, exceso de indulgencia.',
    temas: {
      amor: 'Relación nutritiva y cálida; también puede señalar embarazo o deseo de formar familia.',
      dinero: "Crecimiento económico, buen momento para proyectos que 'den frutos' con el tiempo.",
      futuro: 'Un período fértil, de expansión y resultados tangibles.',
      familia: 'Rol maternal, cuidado del hogar, crecimiento del núcleo familiar.',
    },
    consejo: 'Cuida lo que estás construyendo, pero sin sofocarlo.',
  },
  {
    numero: 4,
    nombre: 'El Emperador',
    palabras_clave: ['autoridad', 'estructura', 'estabilidad', 'control', 'orden'],
    significado_general: 'Representa el poder estructurado, la disciplina y la capacidad de sostener un sistema u orden.',
    aspecto_positivo: 'Liderazgo firme, seguridad, capacidad de organizar y proteger.',
    aspecto_desafiante: 'Rigidez, autoritarismo, control excesivo.',
    temas: {
      amor: 'Relación con estructura clara y compromiso, o una figura que necesita tener el control.',
      dinero: 'Estabilidad financiera lograda con disciplina y planificación a largo plazo.',
      futuro: 'Consolidación de una base sólida; resultados que dependen del orden que impongas ahora.',
      familia: 'Figura paterna o de autoridad; reglas claras dentro del hogar.',
    },
    consejo: 'Pon orden donde hace falta, sin volverte inflexible.',
  },
  {
    numero: 5,
    nombre: 'El Papa',
    palabras_clave: ['tradición', 'guía', 'enseñanza', 'institución', 'moral'],
    significado_general: 'Simboliza el saber transmitido, las normas compartidas y la búsqueda de guía o consejo.',
    aspecto_positivo: 'Sabiduría compartida, buenos consejos, pertenencia a un grupo o valores comunes.',
    aspecto_desafiante: 'Dogmatismo, presión social, seguir normas sin cuestionarlas.',
    temas: {
      amor: 'Relación validada socialmente (matrimonio, compromiso formal) o búsqueda de consejo externo.',
      dinero: 'Decisiones financieras conservadoras, asesoramiento profesional útil en este momento.',
      futuro: 'Un camino guiado por convenciones o por el consejo de alguien con más experiencia.',
      familia: 'Tradiciones familiares, figura de referencia moral dentro del grupo.',
    },
    consejo: 'Busca consejo, pero no dejes de escuchar tu propio criterio.',
  },
  {
    numero: 6,
    nombre: 'El Enamorado',
    palabras_clave: ['elección', 'amor', 'valores', 'atracción', 'decisión'],
    significado_general: 'Representa un momento de elección importante, frecuentemente ligado al corazón o a los valores personales.',
    aspecto_positivo: 'Conexión genuina, decisiones tomadas desde el amor propio y la claridad de valores.',
    aspecto_desafiante: 'Indecisión, elegir por presión externa, triángulos o conflictos de lealtad.',
    temas: {
      amor: 'Una decisión afectiva importante; puede señalar atracción fuerte o la necesidad de elegir entre opciones.',
      dinero: 'Una decisión financiera que involucra valores personales, no solo números.',
      futuro: 'Un cruce de caminos donde la elección definirá el rumbo siguiente.',
      familia: 'Tensión entre lo que la familia espera y lo que la persona realmente quiere.',
    },
    consejo: 'Elige desde lo que realmente valoras, no desde lo que se espera de ti.',
  },
  {
    numero: 7,
    nombre: 'El Carro',
    palabras_clave: ['avance', 'voluntad', 'determinación', 'control de fuerzas opuestas', 'victoria'],
    significado_general: 'Simboliza el avance decidido hacia un objetivo, logrado al equilibrar fuerzas o impulsos contrarios.',
    aspecto_positivo: 'Determinación, superación de obstáculos, avance firme.',
    aspecto_desafiante: 'Dispersión de energía, avanzar sin dirección clara, conflictos internos no resueltos.',
    temas: {
      amor: 'Relación que avanza con fuerza, o necesidad de equilibrar dos deseos opuestos en el vínculo.',
      dinero: 'Progreso económico logrado con esfuerzo sostenido y foco.',
      futuro: 'Movimiento y avance concreto, un objetivo que se acerca si se mantiene el rumbo.',
      familia: 'Necesidad de equilibrar demandas familiares distintas sin perder el propio rumbo.',
    },
    consejo: 'Mantén el foco en una sola dirección para no perder impulso.',
  },
  {
    numero: 8,
    nombre: 'La Justicia',
    palabras_clave: ['equilibrio', 'verdad', 'consecuencias', 'equidad', 'decisiones justas'],
    significado_general: 'Representa el equilibrio entre causa y efecto, y la necesidad de ver una situación con objetividad.',
    aspecto_positivo: 'Claridad, decisiones justas, resolución equilibrada de conflictos.',
    aspecto_desafiante: 'Rigidez, frialdad excesiva, consecuencias de decisiones pasadas que ya no se pueden evitar.',
    temas: {
      amor: 'Necesidad de honestidad y equilibrio en la relación; puede señalar una decisión legal (separación, acuerdo).',
      dinero: 'Cuentas que se equilibran, contratos o temas legales/económicos que requieren claridad.',
      futuro: 'Un resultado justo, coherente con las acciones previas.',
      familia: 'Necesidad de resolver un conflicto familiar con equidad, sin favoritismos.',
    },
    consejo: 'Mira la situación con objetividad antes de decidir.',
  },
  {
    numero: 9,
    nombre: 'El Ermitaño',
    palabras_clave: ['introspección', 'soledad elegida', 'sabiduría', 'búsqueda interior', 'guía propia'],
    significado_general: 'Simboliza el retiro consciente para reflexionar y encontrar respuestas propias, alejado del ruido externo.',
    aspecto_positivo: 'Autoconocimiento, sabiduría ganada con la experiencia, claridad interior.',
    aspecto_desafiante: 'Aislamiento excesivo, evitar vínculos, sentirse incomprendido.',
    temas: {
      amor: 'Necesidad de tiempo a solas antes de avanzar en una relación, o distancia emocional actual.',
      dinero: 'Momento de análisis individual antes de tomar una decisión financiera importante.',
      futuro: 'Un período de reflexión que precede a la claridad.',
      familia: 'Necesidad de espacio propio dentro de la dinámica familiar.',
    },
    consejo: 'Tómate el tiempo que necesites; la respuesta está más cerca de lo que crees.',
  },
  {
    numero: 10,
    nombre: 'La Rueda de la Fortuna',
    palabras_clave: ['cambio', 'ciclos', 'destino', 'azar', 'giro de la situación'],
    significado_general: 'Representa los ciclos de cambio inevitables de la vida, momentos de giro que escapan al control total.',
    aspecto_positivo: 'Un cambio favorable, una oportunidad que llega en el momento justo.',
    aspecto_desafiante: 'Cambios abruptos fuera de control, sensación de inestabilidad.',
    temas: {
      amor: 'Un giro inesperado en la relación, para bien o para mal según el resto de la tirada.',
      dinero: 'Fluctuaciones económicas; una oportunidad puede aparecer de forma repentina.',
      futuro: 'Un cambio de ciclo se aproxima, distinto a la situación actual.',
      familia: 'Un evento que altera la dinámica habitual del grupo familiar.',
    },
    consejo: 'Fluye con el cambio en lugar de resistirlo.',
  },
  {
    numero: 11,
    nombre: 'La Fuerza',
    palabras_clave: ['coraje', 'paciencia', 'dominio interior', 'resiliencia', 'suavidad que vence'],
    significado_general: 'Simboliza la fortaleza que no necesita imponerse con violencia, sino con paciencia, coraje y control interior.',
    aspecto_positivo: 'Resiliencia, manejo maduro de impulsos propios o ajenos, coraje calmo.',
    aspecto_desafiante: 'Agotamiento por sostener demasiado, o lo opuesto: falta de autocontrol.',
    temas: {
      amor: 'Vínculo que requiere paciencia y manejo maduro de las emociones, no imposición.',
      dinero: 'Constancia necesaria para sostener un objetivo financiero a pesar de las dificultades.',
      futuro: 'Un desafío que se supera con templanza más que con fuerza bruta.',
      familia: 'Necesidad de manejar con calma una tensión familiar en lugar de confrontar.',
    },
    consejo: 'La fuerza real está en la calma, no en la imposición.',
  },
  {
    numero: 12,
    nombre: 'El Colgado',
    palabras_clave: ['pausa', 'rendición', 'nueva perspectiva', 'sacrificio', 'espera activa'],
    significado_general: 'Representa un momento de pausa forzada o elegida que permite ver la situación desde otro ángulo.',
    aspecto_positivo: 'Nueva perspectiva, aceptación consciente de una espera necesaria.',
    aspecto_desafiante: 'Sensación de estancamiento, sacrificio que se siente injusto.',
    temas: {
      amor: 'Una relación en pausa o que exige un sacrificio para poder avanzar.',
      dinero: 'Proyecto detenido momentáneamente; no es buen momento para forzar movimientos.',
      futuro: 'Un tiempo de espera que, aunque incómodo, es necesario para lo que viene.',
      familia: 'Necesidad de ceder o esperar para resolver una tensión familiar.',
    },
    consejo: 'No todo estancamiento es negativo; a veces hay que soltar el control para ver con claridad.',
  },
  {
    numero: 13,
    nombre: 'El Arcano Sin Nombre',
    palabras_clave: ['transformación', 'cierre de ciclo', 'final necesario', 'renacimiento', 'cambio profundo'],
    significado_general: 'Simboliza el fin de una etapa para dar paso a algo nuevo; un cambio profundo e inevitable.',
    aspecto_positivo: 'Liberación de lo que ya no sirve, renovación genuina.',
    aspecto_desafiante: 'Miedo al cambio, resistencia a cerrar algo que ya terminó.',
    temas: {
      amor: 'Cierre de una etapa o vínculo; puede abrir paso a algo nuevo si se acepta el final.',
      dinero: 'Fin de una fuente de ingresos o un proyecto; necesidad de reinventarse económicamente.',
      futuro: 'Una transformación importante e ineludible se aproxima.',
      familia: 'Cambio estructural en la familia (mudanza, pérdida, reconfiguración de roles).',
    },
    consejo: 'Deja ir lo que ya cumplió su ciclo; resistirlo solo prolonga el malestar.',
  },
  {
    numero: 14,
    nombre: 'La Templanza',
    palabras_clave: ['equilibrio', 'moderación', 'paciencia', 'armonía', 'mezcla justa'],
    significado_general: 'Representa la búsqueda de equilibrio entre extremos, combinando elementos distintos con paciencia.',
    aspecto_positivo: 'Armonía, paciencia, capacidad de conciliar posturas opuestas.',
    aspecto_desafiante: 'Estancamiento por exceso de cautela, evitar decisiones necesarias.',
    temas: {
      amor: 'Relación que necesita equilibrio y paciencia mutua para funcionar bien.',
      dinero: 'Manejo moderado de recursos; evitar extremos de gasto o ahorro excesivo.',
      futuro: 'Un proceso gradual que da buenos resultados si no se apura.',
      familia: 'Necesidad de mediar entre posturas distintas dentro del grupo familiar.',
    },
    consejo: 'La paciencia y la moderación van a rendir más que la urgencia.',
  },
  {
    numero: 15,
    nombre: 'El Diablo',
    palabras_clave: ['atadura', 'deseo', 'tentación', 'dependencia', 'sombra'],
    significado_general: 'Simboliza ataduras (propias o impuestas), deseos intensos y aquello que se vive como una prisión interna.',
    aspecto_positivo: 'Reconocer un patrón dañino es el primer paso para liberarse de él; también puede indicar deseo o pasión intensa.',
    aspecto_desafiante: 'Dependencia emocional, manipulación, patrones repetitivos difíciles de soltar.',
    temas: {
      amor: 'Vínculo intenso pero potencialmente tóxico o de dependencia mutua.',
      dinero: 'Deudas, gastos compulsivos o atadura a una situación económica que limita.',
      futuro: 'Un patrón repetitivo que se mantendrá si no se hace un cambio consciente.',
      familia: 'Dinámicas de control o dependencia dentro del núcleo familiar.',
    },
    consejo: 'Identifica qué te está atando antes de intentar soltarlo.',
  },
  {
    numero: 16,
    nombre: 'La Torre',
    palabras_clave: ['ruptura', 'revelación súbita', 'cambio abrupto', 'caída de estructuras falsas', 'shock'],
    significado_general: 'Representa una ruptura repentina de estructuras que ya no sostenían la realidad de la persona.',
    aspecto_positivo: 'Aunque disruptivo, permite liberarse de bases falsas y empezar sobre cimientos reales.',
    aspecto_desafiante: 'Crisis, sorpresa desagradable, pérdida de control percibida.',
    temas: {
      amor: 'Ruptura repentina o una revelación que cambia la relación de forma abrupta.',
      dinero: 'Pérdida económica inesperada o colapso de un plan que parecía sólido.',
      futuro: 'Un evento disruptivo que, aunque incómodo, abre paso a una base más real.',
      familia: 'Una revelación o conflicto que sacude la estructura familiar de forma repentina.',
    },
    consejo: 'Lo que se derrumba no era tan sólido como parecía; construye de nuevo sobre bases reales.',
  },
  {
    numero: 17,
    nombre: 'La Estrella',
    palabras_clave: ['esperanza', 'sanación', 'inspiración', 'confianza', 'renovación'],
    significado_general: 'Simboliza la esperanza después de una dificultad, un momento de calma, inspiración y sanación.',
    aspecto_positivo: 'Confianza renovada, claridad, sensación de que lo peor ya pasó.',
    aspecto_desafiante: 'Idealización excesiva, esperar demasiado sin actuar.',
    temas: {
      amor: 'Un momento de sanación afectiva o de esperanza genuina en un vínculo.',
      dinero: 'Mejora gradual después de un período difícil; buen momento para proyectar a futuro.',
      futuro: 'Un panorama esperanzador, con buenas perspectivas si se mantiene la confianza.',
      familia: 'Sanación de heridas familiares antiguas o un momento de paz en el hogar.',
    },
    consejo: 'Confía en el proceso de sanación, pero sigue dando pasos concretos.',
  },
  {
    numero: 18,
    nombre: 'La Luna',
    palabras_clave: ['incertidumbre', 'intuición', 'ilusión', 'subconsciente', 'confusión'],
    significado_general: 'Representa lo que no está del todo claro: miedos, ilusiones, información oculta o el mundo emocional profundo.',
    aspecto_positivo: 'Conexión profunda con la intuición y el mundo emocional o simbólico.',
    aspecto_desafiante: 'Confusión, engaños (propios o ajenos), miedos que distorsionan la percepción.',
    temas: {
      amor: 'Situación poco clara, posibles engaños o inseguridades que nublan el vínculo.',
      dinero: 'Información incompleta o poco clara sobre una situación financiera; cautela recomendada.',
      futuro: 'Un período de incertidumbre donde no todo se ve con claridad todavía.',
      familia: 'Tensiones no habladas o miedos que afectan la dinámica familiar sin decirse abiertamente.',
    },
    consejo: 'No todo lo que sientes en este momento es tan real como parece; espera más claridad antes de decidir.',
  },
  {
    numero: 19,
    nombre: 'El Sol',
    palabras_clave: ['éxito', 'vitalidad', 'claridad', 'alegría', 'plenitud'],
    significado_general: 'Simboliza claridad total, éxito, vitalidad y una energía positiva y expansiva.',
    aspecto_positivo: 'Logros, alegría genuina, resultados positivos y visibles.',
    aspecto_desafiante: 'Exceso de confianza, ignorar matices por estar demasiado optimista.',
    temas: {
      amor: 'Relación plena, alegre y con buena comunicación; buen momento afectivo.',
      dinero: 'Resultados económicos positivos, éxito visible en un proyecto.',
      futuro: 'Un panorama muy favorable, de logros y claridad.',
      familia: 'Armonía y alegría compartida dentro del núcleo familiar.',
    },
    consejo: 'Disfruta este buen momento, y úsalo como impulso para lo que sigue.',
  },
  {
    numero: 20,
    nombre: 'El Juicio',
    palabras_clave: ['renacimiento', 'llamado interior', 'balance de vida', 'despertar', 'decisión final'],
    significado_general: 'Representa un llamado a evaluar el camino recorrido y tomar una decisión definitiva sobre el rumbo a seguir.',
    aspecto_positivo: 'Claridad para dejar atrás el pasado y asumir un nuevo propósito con conciencia.',
    aspecto_desafiante: 'Autocrítica excesiva, resistencia a asumir responsabilidad por decisiones pasadas.',
    temas: {
      amor: 'Un momento de balance en la relación: definir si se continúa o se cierra con conciencia.',
      dinero: 'Evaluación de decisiones financieras pasadas antes de dar un paso definitivo.',
      futuro: 'Un llamado a tomar una decisión importante basada en lo aprendido.',
      familia: 'Reconciliación o balance de una situación familiar pendiente desde hace tiempo.',
    },
    consejo: 'Es momento de asumir con conciencia lo vivido y decidir el próximo paso.',
  },
  {
    numero: 21,
    nombre: 'El Mundo',
    palabras_clave: ['cierre pleno', 'logro', 'totalidad', 'integración', 'culminación'],
    significado_general: 'Simboliza la culminación exitosa de un ciclo, la sensación de plenitud e integración total.',
    aspecto_positivo: 'Logro completo, satisfacción, cierre positivo de una etapa importante.',
    aspecto_desafiante: 'Sensación de vacío si no se reconoce el logro alcanzado, o resistencia a cerrar un ciclo.',
    temas: {
      amor: 'Relación plena y realizada, o el cierre satisfactorio de una etapa afectiva.',
      dinero: 'Logro financiero significativo, un ciclo económico que se completa con éxito.',
      futuro: 'Culminación exitosa de un proceso importante.',
      familia: 'Sensación de plenitud e integración dentro del núcleo familiar.',
    },
    consejo: 'Reconoce el ciclo que estás cerrando antes de empezar el siguiente.',
  },
];

const KNOWLEDGE_BASE_JSON = JSON.stringify({ cartas: CARTAS_DATA });

// Almacenamiento en memoria por IP (respaldo si no se configuró RATE_LIMIT_KV)
const memoryRateLimits = new Map();

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;
  return LOCALHOST_ORIGIN_REGEX.test(origin);
}

function corsHeadersFor(origin) {
  if (!isOriginAllowed(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(payload, status = 200, origin = '') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeadersFor(origin),
    },
  });
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getClientIp(request) {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp.trim();
  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown-ip';
}

async function checkAndIncrementRateLimit(env, ip, bucket, maxPerDay) {
  const today = getTodayKey();
  const key = `rl:${bucket}:${today}:${ip}`;

  // Si el usuario vinculó un KV Namespace opcional llamado RATE_LIMIT_KV, lo usamos para persistencia global
  if (env && env.RATE_LIMIT_KV && typeof env.RATE_LIMIT_KV.get === 'function') {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const current = raw ? Number(raw) : 0;
    if (current >= maxPerDay) {
      return { allowed: false, remaining: 0 };
    }
    await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 86400 });
    return { allowed: true, remaining: Math.max(0, maxPerDay - (current + 1)) };
  }

  // Respaldo en memoria del Worker
  if (memoryRateLimits.size > 5000) {
    for (const [k] of memoryRateLimits) {
      if (!k.includes(`:${today}:`)) {
        memoryRateLimits.delete(k);
      }
    }
  }

  const current = memoryRateLimits.get(key) || 0;
  if (current >= maxPerDay) {
    return { allowed: false, remaining: 0 };
  }
  memoryRateLimits.set(key, current + 1);
  return { allowed: true, remaining: Math.max(0, maxPerDay - (current + 1)) };
}

function obtenerCartaPorNumero(numero) {
  return CARTAS_DATA.find((c) => c.numero === numero) || null;
}

function obtenerCartaPorNombre(nombre) {
  if (typeof nombre !== 'string') return null;
  const norm = nombre.toLowerCase().trim();
  return (
    CARTAS_DATA.find((c) => c.nombre.toLowerCase().trim() === norm) ||
    CARTAS_DATA.find((c) => norm.includes(c.nombre.toLowerCase().trim())) ||
    null
  );
}

/**
 * Entero aleatorio criptográfico uniforme en [0, maxExclusive - 1] con rejection sampling
 */
function cryptoRandomInt(maxExclusive) {
  if (maxExclusive <= 1) return 0;
  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buf = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % maxExclusive;
}

/**
 * Sorteo criptográfico real con Fisher-Yates sobre los 22 Arcanos Mayores (0..21)
 */
function sortearCartasFisherYates(cantidad, excluirNumeros = []) {
  const excluidos = new Set(excluirNumeros);
  const mazo = CARTAS_DATA.filter((c) => !excluidos.has(c.numero));
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    const tmp = mazo[i];
    mazo[i] = mazo[j];
    mazo[j] = tmp;
  }
  return mazo.slice(0, cantidad);
}

function normalizeCardName(name) {
  if (typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildLunaPrompt({
  tipo,
  tema,
  pregunta,
  cartaSorteada,
  cartasSorteadas,
  cartasPrevias,
  cartaComplementariaSorteada,
  historialChat,
  nuevaPregunta,
}) {
  let prompt = `BASE DE CONOCIMIENTO DE LAS 22 CARTAS (cartas_conocimiento.json):\n${KNOWLEDGE_BASE_JSON}\n\n`;

  if (tipo === 'carta_gratis' && cartaSorteada) {
    prompt += `TIPO DE LECTURA: CARTA GRATIS (1 carta ya sorteada al azar).
TEMA ELEGIDO: ${String(tema || 'futuro').toUpperCase()}
PREGUNTA DEL CONSULTANTE: ${pregunta && String(pregunta).trim() ? `"${String(pregunta).trim()}"` : 'Sin pregunta específica, lectura general sobre el tema.'}
CARTA SORTEADA AL AZAR (NO LA CAMBIES):
- Número: ${cartaSorteada.numero}
- Nombre exacto: ${cartaSorteada.nombre}

INSTRUCCIÓN ESPECÍFICA:
1. Interpreta EXCLUSIVAMENTE la carta sorteada (${cartaSorteada.numero} - ${cartaSorteada.nombre}). No la cambies ni elijas otra.
2. Devuelve exactamente numero: ${cartaSorteada.numero} y nombre: "${cartaSorteada.nombre}".
3. Proporciona una interpretación breve de 3 a 4 líneas máximo en tu tono característico (cálido, místico, práctico y en tuteo neutro), respondiendo directamente al tema y pregunta del consultante.
4. Responde estrictamente en formato JSON según el schema.`;
  } else if (tipo === 'tres_cartas' && Array.isArray(cartasSorteadas) && cartasSorteadas.length === 3) {
    prompt += `TIPO DE LECTURA: LECTURA DE 3 CARTAS (ya sorteadas al azar por el servidor).
TEMA ELEGIDO: ${String(tema || 'futuro').toUpperCase()}
PREGUNTA DEL CONSULTANTE: ${pregunta && String(pregunta).trim() ? `"${String(pregunta).trim()}"` : 'Lectura general sobre el tema.'}
CARTAS SORTEADAS Y POSICIONES ASIGNADAS (EN ESTE ORDEN EXACTO, NO LAS CAMBIES):
1. Posición: "${cartasSorteadas[0].posicion}" -> Número: ${cartasSorteadas[0].carta.numero}, Nombre exacto: "${cartasSorteadas[0].carta.nombre}"
2. Posición: "${cartasSorteadas[1].posicion}" -> Número: ${cartasSorteadas[1].carta.numero}, Nombre exacto: "${cartasSorteadas[1].carta.nombre}"
3. Posición: "${cartasSorteadas[2].posicion}" -> Número: ${cartasSorteadas[2].carta.numero}, Nombre exacto: "${cartasSorteadas[2].carta.nombre}"

INSTRUCCIÓN ESPECÍFICA:
1. Interpreta EXCLUSIVAMENTE las 3 cartas sorteadas en el mismo orden y con las posiciones exactas indicadas arriba. No cambies los números, los nombres ni las posiciones.
2. Brinda una interpretación desarrollada para cada una de las 3 posiciones conectadas a la pregunta del consultante.
3. Brinda un cierre narrativo integrador que una las tres cartas como una historia con un consejo práctico final.
4. Responde estrictamente en formato JSON según el schema.`;
  } else if (tipo === 'chat') {
    prompt += `TIPO DE LECTURA: CHAT DE CONSULTA (Seguimiento post-tirada).
TEMA: ${String(tema || 'futuro').toUpperCase()}
${pregunta ? `PREGUNTA INICIAL DE LA SESIÓN: "${String(pregunta)}"\n` : ''}`;

    if (Array.isArray(cartasPrevias) && cartasPrevias.length > 0) {
      prompt += `CARTAS YA MOSTRADAS EN ESTA SESIÓN:\n`;
      for (const c of cartasPrevias) {
        prompt += `- Arcano ${c.numero}: ${c.nombre} ${c.posicion ? `(Posición: ${c.posicion})` : ''}\n`;
      }
      prompt += '\n';
    }

    if (cartaComplementariaSorteada) {
      prompt += `CARTA ADICIONAL SORTEADA AL AZAR POR SI LA CONSULTA LO AMERITA:
- Número: ${cartaComplementariaSorteada.numero}, Nombre exacto: "${cartaComplementariaSorteada.nombre}"
(Si la pregunta no requiere carta nueva, deja "cartas_nuevas" como arreglo vacío []. Si sí la requiere, incluye ÚNICAMENTE esta carta sorteada, nunca otra).\n\n`;
    }

    if (Array.isArray(historialChat) && historialChat.length > 0) {
      prompt += `HISTORIAL DE LA CONVERSACIÓN:\n`;
      for (const msg of historialChat.slice(-12)) {
        prompt += `${msg.role === 'user' ? 'Consultante' : 'Luna'}: ${msg.text}\n`;
      }
      prompt += '\n';
    }

    prompt += `NUEVA PREGUNTA DEL CONSULTANTE: "${String(nuevaPregunta || '')}"

INSTRUCCIÓN ESPECÍFICA:
1. Responde a la pregunta de seguimiento de forma empática y en tuteo neutro, conectando con las cartas ya vistas en la sesión.
2. No inventes ni elijas cartas por tu cuenta: si y solo si la consulta amerita genuinamente una carta adicional, usa exclusivamente la carta adicional sorteada arriba en "cartas_nuevas"; de lo contrario deja el arreglo vacío [].
3. Responde estrictamente en formato JSON según el schema.`;
  }

  return prompt;
}

function isValidCardNumber(n) {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 21;
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateCartaGratis(data, cartaSorteada) {
  if (!data || typeof data !== 'object') {
    return { ok: false, kind: 'SCHEMA_INVALID', detail: 'Respuesta JSON no es un objeto' };
  }
  if (!data.carta || typeof data.carta !== 'object') {
    return { ok: false, kind: 'SCHEMA_INVALID', detail: 'Falta objeto carta' };
  }
  if (!isValidCardNumber(data.carta.numero)) {
    return { ok: false, kind: 'SCHEMA_INVALID', detail: `Número de carta inválido (${String(data.carta.numero)})` };
  }
  if (!isNonEmptyString(data.interpretacion_breve)) {
    return { ok: false, kind: 'SCHEMA_INVALID', detail: 'Falta interpretacion_breve' };
  }
  if (data.carta.numero !== cartaSorteada.numero) {
    return {
      ok: false,
      kind: 'CARD_MISMATCH',
      detail: `Se sorteó #${cartaSorteada.numero} y el modelo devolvió #${data.carta.numero}`,
    };
  }
  return { ok: true };
}

function validateTresCartas(data, cartasSorteadas) {
  if (!data || typeof data !== 'object') {
    return { ok: false, kind: 'SCHEMA_INVALID', detail: 'Respuesta JSON no es un objeto' };
  }
  if (!Array.isArray(data.cartas) || data.cartas.length !== 3) {
    return { ok: false, kind: 'SCHEMA_INVALID', detail: 'El arreglo cartas no tiene 3 elementos' };
  }
  if (!isNonEmptyString(data.cierre_narrativo)) {
    return { ok: false, kind: 'SCHEMA_INVALID', detail: 'Falta cierre_narrativo' };
  }
  const seen = new Set();
  for (let i = 0; i < 3; i++) {
    const c = data.cartas[i];
    const esperada = cartasSorteadas[i].carta;
    if (!c || typeof c !== 'object') {
      return { ok: false, kind: 'SCHEMA_INVALID', detail: `Carta en índice ${i} inválida` };
    }
    if (!isValidCardNumber(c.numero) || seen.has(c.numero)) {
      return { ok: false, kind: 'SCHEMA_INVALID', detail: `Número inválido o repetido en índice ${i}` };
    }
    seen.add(c.numero);
    if (!isNonEmptyString(c.interpretacion)) {
      return { ok: false, kind: 'SCHEMA_INVALID', detail: `Falta interpretacion en índice ${i}` };
    }
    if (c.numero !== esperada.numero) {
      return {
        ok: false,
        kind: 'CARD_MISMATCH',
        detail: `Posición ${i + 1}: se sorteó #${esperada.numero} y el modelo devolvió #${c.numero}`,
      };
    }
  }
  return { ok: true };
}

function validateChat(data, cartaComplementaria) {
  if (!data || typeof data !== 'object') {
    return { ok: false, kind: 'SCHEMA_INVALID', detail: 'Respuesta JSON no es un objeto' };
  }
  if (!isNonEmptyString(data.respuesta)) {
    return { ok: false, kind: 'SCHEMA_INVALID', detail: 'Falta respuesta' };
  }
  if (data.cartas_nuevas !== undefined) {
    if (!Array.isArray(data.cartas_nuevas)) {
      return { ok: false, kind: 'SCHEMA_INVALID', detail: 'cartas_nuevas no es un arreglo' };
    }
    if (data.cartas_nuevas.length > 1) {
      return { ok: false, kind: 'SCHEMA_INVALID', detail: 'Más de 1 carta complementaria' };
    }
    for (const c of data.cartas_nuevas) {
      if (!c || typeof c !== 'object' || !isValidCardNumber(c.numero)) {
        return { ok: false, kind: 'SCHEMA_INVALID', detail: 'Carta complementaria inválida' };
      }
      if (!cartaComplementaria || c.numero !== cartaComplementaria.numero) {
        return {
          ok: false,
          kind: 'CARD_MISMATCH',
          detail: `Carta complementaria: se sorteó #${cartaComplementaria?.numero ?? 'ninguna'} y devolvió #${c.numero}`,
        };
      }
    }
  }
  return { ok: true };
}

function parseJsonStrict(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

async function callGeminiWithSchema({ endpointTag, apiKey, prompt, responseSchema, validator }) {
  let lastError = null;

  for (const model of MODEL_CANDIDATES) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const isGemini4 = model.startsWith('gemini-4-');

    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema,
    };
    if (!isGemini4) {
      generationConfig.temperature = 0.7;
    }

    const requestBody = {
      system_instruction: {
        parts: [{ text: LUNA_SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig,
    };

    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        });

        if (!res.ok) {
          const isTransient = res.status === 429 || res.status === 503 || res.status >= 500;
          lastError = new Error(`ERROR_API_GEMINI status=${res.status} modelo=${model}`);
          console.warn(`[Tarot][${endpointTag}] ERROR_API_GEMINI | modelo=${model} | status=${res.status}`);
          if (!isTransient) break;
          continue;
        }

        const payload = await res.json();
        const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          lastError = new Error(`RESPUESTA_VACIA_GEMINI modelo=${model}`);
          console.warn(`[Tarot][${endpointTag}] RESPUESTA_VACIA_GEMINI | modelo=${model}`);
          continue;
        }

        const parsed = parseJsonStrict(rawText);
        const validation = validator(parsed);
        if (validation.ok === false) {
          const code = validation.kind === 'CARD_MISMATCH' ? 'FALLO_VERIFICACION_CARTA' : 'FALLO_VALIDACION_SCHEMA';
          lastError = new Error(`${code} ${validation.detail}`);
          console.warn(`[Tarot][${endpointTag}] ${code} | modelo=${model} | detalle=${validation.detail}`);
          continue;
        }

        return parsed;
      } catch (err) {
        lastError = err;
        console.warn(`[Tarot][${endpointTag}] ERROR_LLAMADA | modelo=${model} | detalle=${err?.message || String(err)}`);
      }
    }
  }

  throw lastError || new Error('GEMINI_NO_DISPONIBLE');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      if (!isOriginAllowed(origin)) {
        return jsonResponse({ success: false, error: 'Origen no autorizado.' }, 403);
      }
      return new Response(null, {
        status: 204,
        headers: corsHeadersFor(origin),
      });
    }

    // Ruta de verificación rápida (se puede abrir directo en el navegador)
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return jsonResponse(
        {
          status: 'ok',
          service: 'As de Júpiter - Luna Tarot Worker',
          geminiConfigured: Boolean(env && env.GEMINI_API_KEY),
        },
        200,
        origin
      );
    }

    // Lista de 22 arcanos
    if (request.method === 'GET' && url.pathname === '/api/tarot/cartas') {
      if (origin && !isOriginAllowed(origin)) {
        return jsonResponse({ success: false, error: 'Origen no autorizado.' }, 403);
      }
      return jsonResponse({ cartas: CARTAS_DATA }, 200, origin);
    }

    // Para las rutas POST de lectura exigimos origen permitido (GitHub Pages o localhost)
    if (request.method === 'POST' && url.pathname.startsWith('/api/tarot/')) {
      if (!isOriginAllowed(origin)) {
        return jsonResponse({ success: false, error: 'Origen no autorizado.' }, 403);
      }

      if (!env || !env.GEMINI_API_KEY) {
        return jsonResponse(
          {
            success: false,
            error: 'Las cartas necesitan un momento de silencio. Prueba de nuevo en unos segundos.',
          },
          503,
          origin
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse(
          {
            success: false,
            error: 'Las cartas necesitan un momento de silencio. Prueba de nuevo en unos segundos.',
          },
          400,
          origin
        );
      }

      const clientIp = getClientIp(request);

      if (url.pathname === '/api/tarot/carta-gratis') {
        const limit = await checkAndIncrementRateLimit(
          env,
          clientIp,
          'carta-gratis',
          MAX_FREE_CARDS_PER_DAY
        );
        if (!limit.allowed) {
          console.warn('[Tarot][carta-gratis] LIMITE_DIARIO_IP');
          return jsonResponse(
            {
              success: false,
              code: 'RATE_LIMIT_EXCEEDED',
              error:
                'Por hoy ya recibiste tus cartas gratis. Vuelve mañana, o desbloquea la Tirada Completa de 3 Cartas para profundizar.',
            },
            429,
            origin
          );
        }

        const tema = typeof body?.tema === 'string' ? body.tema.slice(0, 30) : 'futuro';
        const pregunta = typeof body?.pregunta === 'string' ? body.pregunta.slice(0, 400) : '';

        try {
          const [cartaSorteada] = sortearCartasFisherYates(1);
          const prompt = buildLunaPrompt({
            tipo: 'carta_gratis',
            tema,
            pregunta,
            cartaSorteada,
          });
          const parsedData = await callGeminiWithSchema({
            endpointTag: 'carta-gratis',
            apiKey: env.GEMINI_API_KEY,
            prompt,
            responseSchema: LUNA_SCHEMA_CARTA_GRATIS,
            validator: (data) => validateCartaGratis(data, cartaSorteada),
          });

          return jsonResponse(
            {
              success: true,
              data: {
                carta: {
                  numero: cartaSorteada.numero,
                  nombre: cartaSorteada.nombre,
                },
                interpretacion_breve: parsedData.interpretacion_breve,
              },
              cartaDetalle: cartaSorteada,
            },
            200,
            origin
          );
        } catch (err) {
          console.error(`[Tarot][carta-gratis] FALLO_LECTURA | tema=${tema} | detalle=${err?.message || String(err)}`);
          return jsonResponse(
            {
              success: false,
              error: 'Las cartas necesitan un momento de silencio. Prueba de nuevo en unos segundos.',
            },
            502,
            origin
          );
        }
      }

      if (url.pathname === '/api/tarot/lectura-tres-cartas') {
        const limit = await checkAndIncrementRateLimit(
          env,
          clientIp,
          'tres-cartas',
          MAX_OTHER_REQUESTS_PER_DAY
        );
        if (!limit.allowed) {
          console.warn('[Tarot][lectura-tres-cartas] LIMITE_DIARIO_IP');
          return jsonResponse(
            {
              success: false,
              code: 'RATE_LIMIT_EXCEEDED',
              error:
                'Alcanzaste el límite diario de consultas por hoy. Las cartas necesitan reposar hasta mañana.',
            },
            429,
            origin
          );
        }

        const tema = typeof body?.tema === 'string' ? body.tema.slice(0, 30) : 'futuro';
        const pregunta = typeof body?.pregunta === 'string' ? body.pregunta.slice(0, 500) : '';
        const esquemaId = typeof body?.esquemaId === 'string' ? body.esquemaId : 'situacion_obstaculo_consejo';

        try {
          const posiciones = resolverPosicionesServidor(esquemaId);
          const cartasAleatorias = sortearCartasFisherYates(3);
          const cartasSorteadas = cartasAleatorias.map((carta, i) => ({
            posicion: posiciones[i],
            carta,
          }));

          const prompt = buildLunaPrompt({
            tipo: 'tres_cartas',
            tema,
            pregunta,
            cartasSorteadas,
          });
          const parsedData = await callGeminiWithSchema({
            endpointTag: 'lectura-tres-cartas',
            apiKey: env.GEMINI_API_KEY,
            prompt,
            responseSchema: LUNA_SCHEMA_TRES_CARTAS,
            validator: (data) => validateTresCartas(data, cartasSorteadas),
          });

          const cartasConDetalles = cartasSorteadas.map((item, i) => ({
            posicion: item.posicion,
            numero: item.carta.numero,
            nombre: item.carta.nombre,
            interpretacion: parsedData.cartas[i].interpretacion,
            detalle: item.carta,
          }));

          return jsonResponse(
            {
              success: true,
              data: {
                cartas: cartasConDetalles,
                cierre_narrativo: parsedData.cierre_narrativo,
              },
            },
            200,
            origin
          );
        } catch (err) {
          console.error(`[Tarot][lectura-tres-cartas] FALLO_LECTURA | tema=${tema} | detalle=${err?.message || String(err)}`);
          return jsonResponse(
            {
              success: false,
              error: 'Las cartas necesitan un momento de silencio. Prueba de nuevo en unos segundos.',
            },
            502,
            origin
          );
        }
      }

      if (url.pathname === '/api/tarot/chat') {
        const limit = await checkAndIncrementRateLimit(
          env,
          clientIp,
          'chat',
          MAX_OTHER_REQUESTS_PER_DAY
        );
        if (!limit.allowed) {
          console.warn('[Tarot][chat] LIMITE_DIARIO_IP');
          return jsonResponse(
            {
              success: false,
              code: 'RATE_LIMIT_EXCEEDED',
              error:
                'Alcanzaste el límite diario de consultas por hoy. Las cartas necesitan reposar hasta mañana.',
            },
            429,
            origin
          );
        }

        const tema = typeof body?.tema === 'string' ? body.tema.slice(0, 30) : 'futuro';
        const preguntaInicial =
          typeof body?.preguntaInicial === 'string' ? body.preguntaInicial.slice(0, 500) : '';
        const cartasPrevias = Array.isArray(body?.cartasPrevias) ? body.cartasPrevias.slice(0, 10) : [];
        const historialChat = Array.isArray(body?.historialChat) ? body.historialChat.slice(-12) : [];
        const nuevaPregunta =
          typeof body?.nuevaPregunta === 'string' ? body.nuevaPregunta.trim().slice(0, 500) : '';

        if (!nuevaPregunta) {
          return jsonResponse(
            {
              success: false,
              error: 'Escribe tu pregunta para que Luna pueda escucharte.',
            },
            400,
            origin
          );
        }

        try {
          const numerosExcluidos = cartasPrevias
            .map((c) => Number(c?.numero))
            .filter((n) => Number.isInteger(n) && n >= 0 && n <= 21);
          const [cartaComplementaria] = sortearCartasFisherYates(1, numerosExcluidos);

          const prompt = buildLunaPrompt({
            tipo: 'chat',
            tema,
            pregunta: preguntaInicial,
            cartasPrevias,
            cartaComplementariaSorteada: cartaComplementaria || null,
            historialChat,
            nuevaPregunta,
          });
          const parsedData = await callGeminiWithSchema({
            endpointTag: 'chat',
            apiKey: env.GEMINI_API_KEY,
            prompt,
            responseSchema: LUNA_SCHEMA_CHAT,
            validator: (data) => validateChat(data, cartaComplementaria || null),
          });

          if (Array.isArray(parsedData.cartas_nuevas) && cartaComplementaria) {
            parsedData.cartas_nuevas = parsedData.cartas_nuevas.map((c) => ({
              numero: cartaComplementaria.numero,
              nombre: cartaComplementaria.nombre,
              motivo: c.motivo,
              detalle: cartaComplementaria,
            }));
          }

          return jsonResponse(
            {
              success: true,
              data: parsedData,
            },
            200,
            origin
          );
        } catch (err) {
          console.error(`[Tarot][chat] FALLO_LECTURA | tema=${tema} | detalle=${err?.message || String(err)}`);
          return jsonResponse(
            {
              success: false,
              error: 'Las cartas necesitan un momento de silencio. Prueba de nuevo en unos segundos.',
            },
            502,
            origin
          );
        }
      }
    }

    return jsonResponse({ success: false, error: 'Ruta no encontrada.' }, 404, origin);
  },
};
