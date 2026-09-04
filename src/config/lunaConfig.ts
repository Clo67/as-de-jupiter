import { Type } from '@google/genai';
import cartasConocimientoJson from '../data/cartas_conocimiento.json';

/**
 * Luna System Instruction - As de Júpiter
 * Texto exacto e inmutable según especificación de diseño de Luna.
 */
export const LUNA_SYSTEM_INSTRUCTION = `Sos Luna, la tarotista de IA de "As de Júpiter", una aplicación de lectura
de Tarot de Marsella. Tu función es realizar lecturas simbólicas y
reflexivas para acompañar a quien consulta, nunca predicciones garantizadas
ni diagnósticos de ningún tipo.

TONO Y VOZ: Hablás con una mezcla equilibrada de tres registros: calidez
cercana (como una amiga sabia que escucha de verdad), un toque
místico/ceremonial (sin caer en lo teatral ni sobrecargado de metáforas),
y practicidad (siempre cerrás con algo concreto y accionable, no solo
poesía). Te dirigís al consultante de tú (tuteo neutro, nunca vos ni
usted). Evitás sonar genérica o como un horóscopo de revista: cada
lectura debe sentirse dirigida a la pregunta específica que trajo la
persona.

BASE DE CONOCIMIENTO: Trabajás exclusivamente con los 22 Arcanos Mayores
del Tarot de Marsella provistos en el archivo de datos de cartas. No usás
arcanos menores, no inventás cartas fuera de esa lista, no contradecís el
significado base de cada carta (podés adaptar lenguaje y énfasis, no el
núcleo del significado).

CÓMO ELEGÍS LAS CARTAS: No usás un generador aleatorio externo. Elegís las
cartas según la energía de la pregunta y el tema, como lo haría una
tarotista real, en el mismo llamado en que hacés la interpretación. Nunca
repitas mecánicamente la misma combinación para preguntas distintas.
La elección debe tener sentido narrativo real. En tiradas de varias
cartas, nunca repitas una misma carta dos veces.

TIPOS DE LECTURA:
- CARTA GRATIS: 1 carta según el tema (amor/dinero/futuro/familia).
  Interpretación de 3 a 4 líneas máximo.
- LECTURA DE 3 CARTAS (paga): interpretación desarrollada por posición,
  más un cierre narrativo breve que conecta las tres cartas.
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

/**
 * Base de conocimiento de las 22 cartas serializada para inyección de contexto
 */
export const LUNA_CARTAS_KNOWLEDGE_BASE = JSON.stringify(cartasConocimientoJson);

/**
 * Response schema para la carta gratis (1 carta)
 */
export const LUNA_SCHEMA_CARTA_GRATIS = {
  type: Type.OBJECT,
  properties: {
    carta: {
      type: Type.OBJECT,
      properties: {
        numero: { type: Type.INTEGER, description: "Número del arcano mayor (0 al 21)" },
        nombre: { type: Type.STRING, description: "Nombre exacto del arcano mayor" }
      },
      required: ["numero", "nombre"]
    },
    interpretacion_breve: {
      type: Type.STRING,
      description: "3 a 4 líneas máximo, en el tono de Luna, respondiendo directamente al tema y pregunta del usuario."
    }
  },
  required: ["carta", "interpretacion_breve"]
};

/**
 * Response schema para la lectura de 3 cartas
 */
export const LUNA_SCHEMA_TRES_CARTAS = {
  type: Type.OBJECT,
  properties: {
    cartas: {
      type: Type.ARRAY,
      description: "Exactamente 3 cartas para las 3 posiciones de la tirada, sin repetir ninguna carta",
      items: {
        type: Type.OBJECT,
        properties: {
          posicion: { type: Type.STRING, description: "Nombre de la posición (ej: Situación, Obstáculo, Consejo o Pasado, Presente, Futuro)" },
          numero: { type: Type.INTEGER, description: "Número del arcano mayor (0 al 21)" },
          nombre: { type: Type.STRING, description: "Nombre exacto del arcano mayor" },
          interpretacion: { type: Type.STRING, description: "Interpretación profunda y personalizada de la carta en esa posición" }
        },
        required: ["posicion", "numero", "nombre", "interpretacion"]
      }
    },
    cierre_narrativo: {
      type: Type.STRING,
      description: "Párrafo breve que conecta las tres cartas como una historia coherente, cerrando con un consejo práctico."
    }
  },
  required: ["cartas", "cierre_narrativo"]
};

/**
 * Response schema para el chat de consulta post-pago
 */
export const LUNA_SCHEMA_CHAT = {
  type: Type.OBJECT,
  properties: {
    respuesta: {
      type: Type.STRING,
      description: "Respuesta de Luna a la consulta de seguimiento, manteniendo tono cálido, místico y práctico."
    },
    cartas_nuevas: {
      type: Type.ARRAY,
      description: "Cartas adicionales traídas solo si la consulta lo amerita genuinamente",
      items: {
        type: Type.OBJECT,
        properties: {
          numero: { type: Type.INTEGER, description: "Número del arcano mayor (0 al 21)" },
          nombre: { type: Type.STRING, description: "Nombre del arcano mayor" },
          motivo: { type: Type.STRING, description: "Por qué aparece esta carta para complementar la respuesta" }
        },
        required: ["numero", "nombre"]
      }
    }
  },
  required: ["respuesta"]
};

/**
 * Helper para armar el prompt del usuario con contexto de cartas
 */
export function buildLunaPrompt(params: {
  tipo: 'carta_gratis' | 'tres_cartas' | 'chat';
  tema: string;
  pregunta?: string;
  esquemaPosiciones?: string[];
  cartasPrevias?: Array<{ numero: number; nombre: string; posicion?: string }>;
  historialChat?: Array<{ role: 'user' | 'model'; text: string }>;
  nuevaPregunta?: string;
}): string {
  const { tipo, tema, pregunta, esquemaPosiciones, cartasPrevias, historialChat, nuevaPregunta } = params;

  let prompt = `BASE DE CONOCIMIENTO DE LAS 22 CARTAS (cartas_conocimiento.json):\n${LUNA_CARTAS_KNOWLEDGE_BASE}\n\n`;

  if (tipo === 'carta_gratis') {
    prompt += `TIPO DE LECTURA: CARTA GRATIS (1 carta).
TEMA ELEGIDO: ${tema.toUpperCase()}
PREGUNTA DEL CONSULTANTE: ${pregunta && pregunta.trim() ? `"${pregunta.trim()}"` : "Sin pregunta específica, lectura general sobre el tema."}

INSTRUCCIÓN ESPECÍFICA:
1. Siente qué Arcano Mayor de los 22 corresponde a la energía de esta consulta.
2. Devuelve el número y nombre exacto de la carta elegida.
3. Proporciona una interpretación breve de 3 a 4 líneas máximo en tu tono característico (cálido, místico, práctico), respondiendo directamente al tema y pregunta del consultante.
4. Responde estrictamente en formato JSON según el schema.`;
  } else if (tipo === 'tres_cartas') {
    const posiciones = esquemaPosiciones || ["Situación actual", "Obstáculo / Desafío", "Consejo y rumbo"];
    prompt += `TIPO DE LECTURA: LECTURA DE 3 CARTAS.
TEMA ELEGIDO: ${tema.toUpperCase()}
PREGUNTA DEL CONSULTANTE: ${pregunta && pregunta.trim() ? `"${pregunta.trim()}"` : "Lectura general sobre el tema."}
POSICIONES DE LA TIRADA:
1. ${posiciones[0]}
2. ${posiciones[1]}
3. ${posiciones[2]}

INSTRUCCIÓN ESPECÍFICA:
1. Siente y selecciona 3 cartas distintas (sin repetir ninguna) de los 22 Arcanos Mayores para cada una de las 3 posiciones.
2. Brinda una interpretación desarrollada para cada una de las 3 posiciones conectadas a la pregunta del consultante.
3. Brinda un cierre narrativo integrador que una las tres cartas como una historia con un consejo práctico final.
4. Responde estrictamente en formato JSON según el schema.`;
  } else if (tipo === 'chat') {
    prompt += `TIPO DE LECTURA: CHAT DE CONSULTA (Seguimiento post-tirada).
TEMA: ${tema.toUpperCase()}
${pregunta ? `PREGUNTA INICIAL DE LA SESIÓN: "${pregunta}"\n` : ''}`;

    if (cartasPrevias && cartasPrevias.length > 0) {
      prompt += `CARTAS YA MOSTRADAS EN ESTA SESIÓN:\n`;
      cartasPrevias.forEach((c) => {
        prompt += `- Arcano ${c.numero}: ${c.nombre} ${c.posicion ? `(Posición: ${c.posicion})` : ''}\n`;
      });
      prompt += `\n`;
    }

    if (historialChat && historialChat.length > 0) {
      prompt += `HISTORIAL DE LA CONVERSACIÓN:\n`;
      historialChat.forEach((msg) => {
        prompt += `${msg.role === 'user' ? 'Consultante' : 'Luna'}: ${msg.text}\n`;
      });
      prompt += `\n`;
    }

    prompt += `NUEVA PREGUNTA DEL CONSULTANTE: "${nuevaPregunta}"

INSTRUCCIÓN ESPECÍFICA:
1. Responde a la pregunta de seguimiento de forma empática, conectando con las cartas ya vistas en la sesión.
2. Si y solo si la pregunta amerita genuinamente traer una carta adicional complementaria, inclúyela en "cartas_nuevas", de lo contrario deja el arreglo vacío.
3. Mantén coherencia, calidez, mística y practicidad.
4. Responde estrictamente en formato JSON según el schema.`;
  }

  return prompt;
}
