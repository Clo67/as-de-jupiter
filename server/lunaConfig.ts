import { Type } from '@google/genai';
import cartasConocimientoJson from '../src/data/cartas_conocimiento.json';
import type { CartaConocimiento } from '../src/types/tarot';

/**
 * Esquemas de posiciones definidos exclusivamente en el servidor
 */
export const ESQUEMAS_POSICIONES_SERVER: Record<string, string[]> = {
  situacion_obstaculo_consejo: ['Situación actual', 'Obstáculo / Desafío', 'Consejo y rumbo'],
  pasado_presente_futuro: ['Raíz o Pasado', 'Presente actual', 'Tendencia Futura'],
  mente_corazon_accion: ['Lo que piensas (Mente)', 'Lo que sientes (Corazón)', 'Hacia dónde actuar'],
};

export function resolverPosicionesServidor(esquemaId?: unknown): string[] {
  if (typeof esquemaId === 'string' && ESQUEMAS_POSICIONES_SERVER[esquemaId]) {
    return ESQUEMAS_POSICIONES_SERVER[esquemaId];
  }
  return ESQUEMAS_POSICIONES_SERVER.situacion_obstaculo_consejo;
}

/**
 * Luna System Instruction - As de Júpiter (solo servidor)
 */
export const LUNA_SYSTEM_INSTRUCTION = `Eres Luna, la tarotista de IA de "As de Júpiter", una aplicación de lectura
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
Trabajas exclusivamente con la iconografía del Tarot de Marsella. En 'simbolo_clave' solo puedes mencionar elementos visuales que figuren en 'iconografia_marsella' de la ficha recibida. Nunca uses elementos de otros mazos como el Rider-Waite.

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

const CARTAS_BY_NUMERO = new Map<number, CartaConocimiento>(
  (cartasConocimientoJson.cartas as CartaConocimiento[]).map((c) => [c.numero, c])
);

function buildFichasParaCartas(numeros: number[]): string {
  const unicos = Array.from(new Set(numeros)).filter((n) => CARTAS_BY_NUMERO.has(n));
  if (unicos.length === 0) {
    return 'No hay cartas específicas extendidas aún en esta consulta; mantente fiel a la tradición de los 22 Arcanos Mayores del Tarot de Marsella.';
  }
  const fichas = unicos.map((n) => CARTAS_BY_NUMERO.get(n)!);
  return JSON.stringify(fichas);
}

export const LUNA_SCHEMA_CARTA_GRATIS = {
  type: Type.OBJECT,
  properties: {
    carta: {
      type: Type.OBJECT,
      properties: {
        numero: { type: Type.INTEGER, description: 'Número exacto del arcano mayor sorteado (0 al 21)' },
        nombre: { type: Type.STRING, description: 'Nombre exacto del arcano mayor sorteado' },
      },
      required: ['numero', 'nombre'],
    },
    interpretacion_breve: {
      type: Type.STRING,
      description: '3 a 4 líneas máximo, en el tono de Luna, interpretando la carta sorteada en relación directa con el tema y pregunta del usuario.',
    },
    simbolo_clave: {
      type: Type.STRING,
      description: 'Una o dos líneas en lenguaje simple y tuteo neutro explicando por qué esta carta significa eso en esta lectura, señalando únicamente un elemento visual que figure en iconografia_marsella de la ficha recibida.',
    },
  },
  required: ['carta', 'interpretacion_breve', 'simbolo_clave'],
};

export const LUNA_SCHEMA_TRES_CARTAS = {
  type: Type.OBJECT,
  properties: {
    cartas: {
      type: Type.ARRAY,
      description: 'Exactamente las 3 cartas sorteadas en el mismo orden y con las posiciones asignadas',
      items: {
        type: Type.OBJECT,
        properties: {
          posicion: { type: Type.STRING, description: 'Nombre exacto de la posición asignada por el servidor' },
          numero: { type: Type.INTEGER, description: 'Número exacto del arcano mayor sorteado (0 al 21)' },
          nombre: { type: Type.STRING, description: 'Nombre exacto del arcano mayor sorteado' },
          interpretacion: { type: Type.STRING, description: 'Interpretación profunda y personalizada de la carta sorteada en esa posición' },
          simbolo_clave: {
            type: Type.STRING,
            description: 'Una o dos líneas en lenguaje simple y tuteo neutro explicando por qué esta carta significa eso en esta posición, señalando únicamente un elemento visual que figure en iconografia_marsella de la ficha recibida.',
          },
        },
        required: ['posicion', 'numero', 'nombre', 'interpretacion', 'simbolo_clave'],
      },
    },
    cierre_narrativo: {
      type: Type.STRING,
      description: 'Párrafo breve que conecta las tres cartas sorteadas como una historia coherente, cerrando con un consejo práctico.',
    },
  },
  required: ['cartas', 'cierre_narrativo'],
};

export const LUNA_SCHEMA_CHAT = {
  type: Type.OBJECT,
  properties: {
    respuesta: {
      type: Type.STRING,
      description: 'Respuesta de Luna a la consulta de seguimiento, manteniendo tono cálido, místico y práctico.',
    },
    cartas_nuevas: {
      type: Type.ARRAY,
      description: 'Solo la carta adicional sorteada si la consulta lo amerita genuinamente; de lo contrario, arreglo vacío []',
      items: {
        type: Type.OBJECT,
        properties: {
          numero: { type: Type.INTEGER, description: 'Número del arcano mayor sorteado (0 al 21)' },
          nombre: { type: Type.STRING, description: 'Nombre exacto del arcano mayor sorteado' },
          motivo: { type: Type.STRING, description: 'Por qué esta carta complementa la respuesta' },
        },
        required: ['numero', 'nombre'],
      },
    },
  },
  required: ['respuesta'],
};

export function buildLunaPrompt(params: {
  tipo: 'carta_gratis' | 'tres_cartas' | 'chat';
  tema: string;
  pregunta?: string;
  cartaSorteada?: CartaConocimiento;
  cartasSorteadas?: Array<{ posicion: string; carta: CartaConocimiento }>;
  cartasPrevias?: Array<{ numero: number; nombre: string; posicion?: string }>;
  cartaComplementariaSorteada?: CartaConocimiento | null;
  historialChat?: Array<{ role: 'user' | 'model'; text: string }>;
  nuevaPregunta?: string;
}): string {
  const {
    tipo,
    tema,
    pregunta,
    cartaSorteada,
    cartasSorteadas,
    cartasPrevias,
    cartaComplementariaSorteada,
    historialChat,
    nuevaPregunta,
  } = params;

  const numerosParaFicha: number[] = [];
  if (tipo === 'carta_gratis' && cartaSorteada) {
    numerosParaFicha.push(cartaSorteada.numero);
  } else if (tipo === 'tres_cartas' && cartasSorteadas) {
    cartasSorteadas.forEach((c) => numerosParaFicha.push(c.carta.numero));
  } else if (tipo === 'chat') {
    cartasPrevias?.forEach((c) => numerosParaFicha.push(Number(c.numero)));
    if (cartaComplementariaSorteada) {
      numerosParaFicha.push(cartaComplementariaSorteada.numero);
    }
  }

  let prompt = `FICHA DE CONOCIMIENTO DE LAS CARTAS EN ESTA LECTURA:\n${buildFichasParaCartas(numerosParaFicha)}\n\n`;

  if (tipo === 'carta_gratis' && cartaSorteada) {
    prompt += `TIPO DE LECTURA: CARTA GRATIS (1 carta ya sorteada al azar).
TEMA ELEGIDO: ${tema.toUpperCase()}
PREGUNTA DEL CONSULTANTE: ${pregunta && pregunta.trim() ? `"${pregunta.trim()}"` : 'Sin pregunta específica, lectura general sobre el tema.'}
CARTA SORTEADA AL AZAR (NO LA CAMBIES):
- Número: ${cartaSorteada.numero}
- Nombre exacto: ${cartaSorteada.nombre}

INSTRUCCIÓN ESPECÍFICA:
1. Interpreta EXCLUSIVAMENTE la carta sorteada (${cartaSorteada.numero} - ${cartaSorteada.nombre}). No la cambies ni elijas otra.
2. Devuelve exactamente numero: ${cartaSorteada.numero} y nombre: "${cartaSorteada.nombre}".
3. Proporciona una interpretación breve de 3 a 4 líneas máximo en tu tono característico (cálido, místico, práctico y en tuteo neutro), respondiendo directamente al tema y pregunta del consultante.
4. En "simbolo_clave", escribe 1 o 2 líneas simples (en tuteo neutro) explicando por qué esta carta simboliza eso en esta lectura, mencionando exclusivamente elementos visuales presentes en "iconografia_marsella" de la ficha recibida (nunca elementos de otros mazos como el Rider-Waite).
5. Responde estrictamente en formato JSON según el schema.`;
  } else if (tipo === 'tres_cartas' && cartasSorteadas && cartasSorteadas.length === 3) {
    prompt += `TIPO DE LECTURA: LECTURA DE 3 CARTAS (ya sorteadas al azar por el servidor).
TEMA ELEGIDO: ${tema.toUpperCase()}
PREGUNTA DEL CONSULTANTE: ${pregunta && pregunta.trim() ? `"${pregunta.trim()}"` : 'Lectura general sobre el tema.'}
CARTAS SORTEADAS Y POSICIONES ASIGNADAS (EN ESTE ORDEN EXACTO, NO LAS CAMBIES):
1. Posición: "${cartasSorteadas[0].posicion}" -> Número: ${cartasSorteadas[0].carta.numero}, Nombre exacto: "${cartasSorteadas[0].carta.nombre}"
2. Posición: "${cartasSorteadas[1].posicion}" -> Número: ${cartasSorteadas[1].carta.numero}, Nombre exacto: "${cartasSorteadas[1].carta.nombre}"
3. Posición: "${cartasSorteadas[2].posicion}" -> Número: ${cartasSorteadas[2].carta.numero}, Nombre exacto: "${cartasSorteadas[2].carta.nombre}"

INSTRUCCIÓN ESPECÍFICA:
1. Interpreta EXCLUSIVAMENTE las 3 cartas sorteadas en el mismo orden y con las posiciones exactas indicadas arriba. No cambies los números, los nombres ni las posiciones.
2. Brinda una interpretación desarrollada para cada una de las 3 posiciones conectadas a la pregunta del consultante.
3. Para cada carta, completa "simbolo_clave" con 1 o 2 líneas simples (en tuteo neutro) explicando por qué esa carta tiene ese significado en esa posición, mencionando exclusivamente elementos visuales que figuren en "iconografia_marsella" de la ficha recibida (nunca elementos de otros mazos como el Rider-Waite).
4. Brinda un cierre narrativo integrador que una las tres cartas como una historia con un consejo práctico final.
5. Responde estrictamente en formato JSON según el schema.`;
  } else if (tipo === 'chat') {
    prompt += `TIPO DE LECTURA: CHAT DE CONSULTA (Seguimiento post-tirada).
TEMA: ${tema.toUpperCase()}
${pregunta ? `PREGUNTA INICIAL DE LA SESIÓN: "${pregunta}"\n` : ''}`;

    if (cartasPrevias && cartasPrevias.length > 0) {
      prompt += `CARTAS YA MOSTRADAS EN ESTA SESIÓN:\n`;
      cartasPrevias.forEach((c) => {
        prompt += `- Arcano ${c.numero}: ${c.nombre} ${c.posicion ? `(Posición: ${c.posicion})` : ''}\n`;
      });
      prompt += '\n';
    }

    if (cartaComplementariaSorteada) {
      prompt += `CARTA ADICIONAL SORTEADA AL AZAR POR SI LA CONSULTA LO AMERITA:
- Número: ${cartaComplementariaSorteada.numero}, Nombre exacto: "${cartaComplementariaSorteada.nombre}"
(Si la pregunta no requiere carta nueva, deja "cartas_nuevas" como arreglo vacío []. Si sí la requiere, incluye ÚNICAMENTE esta carta sorteada, nunca otra).\n\n`;
    }

    if (historialChat && historialChat.length > 0) {
      prompt += `HISTORIAL DE LA CONVERSACIÓN:\n`;
      historialChat.forEach((msg) => {
        prompt += `${msg.role === 'user' ? 'Consultante' : 'Luna'}: ${msg.text}\n`;
      });
      prompt += '\n';
    }

    prompt += `NUEVA PREGUNTA DEL CONSULTANTE: "${nuevaPregunta}"

INSTRUCCIÓN ESPECÍFICA:
1. Responde a la pregunta de seguimiento de forma empática y en tuteo neutro, conectando con las cartas ya vistas en la sesión.
2. No inventes ni elijas cartas por tu cuenta: si y solo si la consulta amerita genuinamente una carta adicional, usa exclusivamente la carta adicional sorteada arriba en "cartas_nuevas"; de lo contrario deja el arreglo vacío [].
3. Responde estrictamente en formato JSON según el schema.`;
  }

  return prompt;
}
