import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import {
  LUNA_SYSTEM_INSTRUCTION,
  LUNA_SCHEMA_CARTA_GRATIS,
  LUNA_SCHEMA_TRES_CARTAS,
  LUNA_SCHEMA_CHAT,
  buildLunaPrompt,
} from "./src/config/lunaConfig";
import { TODAS_LAS_CARTAS, obtenerCartaPorNumero, obtenerCartaPorNombre } from "./src/data/cartas";

dotenv.config();

// Ensure HMR is disabled in development container environment to avoid websocket errors
process.env.DISABLE_HMR = "true";

const app = express();
const PORT = 3000;

app.use(express.json());

// List of recommended models to cascade through in case of 503 / high demand spikes
const MODEL_CANDIDATES = [
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
];

// Lazy-initialize Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not set; requests may fail if key is required.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Utility to sleep with jitter
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resilient generate content wrapper with model cascade & exponential backoff
 */
async function generateWithGeminiFallback(params: {
  contents: string;
  systemInstruction: string;
  responseSchema: any;
  temperature?: number;
}): Promise<string> {
  const ai = getGeminiClient();
  let lastError: any = null;

  for (const modelName of MODEL_CANDIDATES) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 400, 4000);
          console.log(`[Gemini Retry] Retrying model ${modelName} in ${Math.round(backoff)}ms (attempt ${attempt + 1})...`);
          await delay(backoff);
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: "application/json",
            responseSchema: params.responseSchema,
            temperature: params.temperature ?? 0.7,
          },
        });

        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isTransient =
          errMsg.includes("503") ||
          errMsg.includes("high demand") ||
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("overloaded");

        console.warn(`[Gemini Warning] Model ${modelName} failed (attempt ${attempt + 1}):`, errMsg);

        if (!isTransient && attempt === 0) {
          // Non-transient error, move to next model candidate directly
          break;
        }
      }
    }
  }

  throw lastError || new Error("Todos los modelos de Gemini están experimentando alta demanda.");
}

/**
 * Intelligent in-memory fallback using the 22 Arcanos Mayores Marseille knowledge base
 * Activated only if all external API calls are unavailable.
 */
function generateLocalFallbackReading(params: {
  tipo: "carta_gratis" | "tres_cartas" | "chat";
  tema: string;
  pregunta?: string;
  posiciones?: string[];
  cartasPrevias?: Array<{ numero: number; nombre: string; posicion?: string }>;
}) {
  const { tipo, tema, pregunta = "", posiciones = ["Situación actual", "Obstáculo / Desafío", "Consejo y rumbo"] } = params;

  // Pick deterministic yet organic cards based on question hash & timestamp
  const seed = (pregunta + tema + Date.now()).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const shuffledCartas = [...TODAS_LAS_CARTAS].sort((a, b) => {
    return ((seed * (a.numero + 1)) % 100) - ((seed * (b.numero + 1)) % 100);
  });

  const temaKey = (["amor", "dinero", "futuro", "familia"].includes(tema) ? tema : "futuro") as "amor" | "dinero" | "futuro" | "familia";

  if (tipo === "carta_gratis") {
    const carta = shuffledCartas[0];
    const temaTexto = carta.temas ? carta.temas[temaKey] : carta.significado_general;
    return {
      carta: {
        numero: carta.numero,
        nombre: carta.nombre,
      },
      interpretacion_breve: `Para tu consulta sobre ${tema}, ${carta.nombre} se hace presente. ${temaTexto} En lo positivo, potencia ${carta.aspecto_positivo.toLowerCase()}, pero recuerda atender ${carta.aspecto_desafiante.toLowerCase()}. ${carta.consejo}`,
    };
  }

  if (tipo === "tres_cartas") {
    const seleccionadas = shuffledCartas.slice(0, 3);
    const cartas = seleccionadas.map((carta, i) => {
      const posNombre = posiciones[i] || `Posición ${i + 1}`;
      const temaTexto = carta.temas ? carta.temas[temaKey] : carta.significado_general;
      return {
        posicion: posNombre,
        numero: carta.numero,
        nombre: carta.nombre,
        interpretacion: `En la posición de ${posNombre}, ${carta.nombre} señala ${carta.significado_general.toLowerCase()} Frente a tu tema de ${tema}, ${temaTexto} Clave: ${carta.consejo}`,
        detalle: carta,
      };
    });

    return {
      cartas,
      cierre_narrativo: `El recorrido desde ${seleccionadas[0].nombre} pasando por el desafío de ${seleccionadas[1].nombre} culmina en la sabiduría de ${seleccionadas[2].nombre}. Esta tríada te invita a transformar la incertidumbre en foco claro: confía en tus recursos y avanza con templanza.`,
    };
  }

  // Chat fallback
  const cartaNueva = shuffledCartas[3];
  return {
    respuesta: `Al reflexionar sobre tu consulta y los arcanos presentes, la energía sugiere mantener la calma y escuchar tu intuición más profunda. ${cartaNueva.nombre} complementa esta etapa recordándote: "${cartaNueva.consejo}".`,
    cartas_nuevas: [
      {
        numero: cartaNueva.numero,
        nombre: cartaNueva.nombre,
        motivo: "Aparece para dar claridad práctica a tu pregunta de seguimiento.",
        detalle: cartaNueva,
      },
    ],
  };
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "As de Júpiter - Luna Tarot API" });
});

// Endpoint: Obtener todos los 22 arcanos mayores
app.get("/api/tarot/cartas", (req, res) => {
  res.json({ cartas: TODAS_LAS_CARTAS });
});

// Endpoint 1: Carta gratis (1 carta)
app.post("/api/tarot/carta-gratis", async (req, res) => {
  const { tema = "futuro", pregunta = "" } = req.body;
  try {
    const prompt = buildLunaPrompt({
      tipo: "carta_gratis",
      tema,
      pregunta,
    });

    let parsedData: any;
    try {
      const rawText = await generateWithGeminiFallback({
        contents: prompt,
        systemInstruction: LUNA_SYSTEM_INSTRUCTION,
        responseSchema: LUNA_SCHEMA_CARTA_GRATIS,
        temperature: 0.7,
      });
      parsedData = JSON.parse(rawText);
    } catch (apiErr) {
      console.warn("Fallback to Marseille knowledge engine for carta-gratis:", apiErr);
      parsedData = generateLocalFallbackReading({
        tipo: "carta_gratis",
        tema,
        pregunta,
      });
    }

    // Complement with card data from the knowledge base
    const cartaEncontrada =
      obtenerCartaPorNumero(parsedData.carta?.numero) ||
      obtenerCartaPorNombre(parsedData.carta?.nombre);

    res.json({
      success: true,
      data: parsedData,
      cartaDetalle: cartaEncontrada || null,
    });
  } catch (error: any) {
    console.error("Error en lectura de carta gratis:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al realizar la lectura con Luna",
    });
  }
});

// Endpoint 2: Lectura de 3 cartas (paga)
app.post("/api/tarot/lectura-tres-cartas", async (req, res) => {
  const {
    tema = "futuro",
    pregunta = "",
    posiciones = ["Situación actual", "Obstáculo / Desafío", "Consejo y rumbo"],
  } = req.body;

  try {
    const prompt = buildLunaPrompt({
      tipo: "tres_cartas",
      tema,
      pregunta,
      esquemaPosiciones: posiciones,
    });

    let parsedData: any;
    try {
      const rawText = await generateWithGeminiFallback({
        contents: prompt,
        systemInstruction: LUNA_SYSTEM_INSTRUCTION,
        responseSchema: LUNA_SCHEMA_TRES_CARTAS,
        temperature: 0.75,
      });
      parsedData = JSON.parse(rawText);
    } catch (apiErr) {
      console.warn("Fallback to Marseille knowledge engine for lectura-tres-cartas:", apiErr);
      parsedData = generateLocalFallbackReading({
        tipo: "tres_cartas",
        tema,
        pregunta,
        posiciones,
      });
    }

    // Attach card details for each card
    const cartasConDetalles = (parsedData.cartas || []).map((c: any) => {
      const detalle =
        c.detalle ||
        obtenerCartaPorNumero(c.numero) ||
        obtenerCartaPorNombre(c.nombre);
      return {
        ...c,
        detalle: detalle || null,
      };
    });

    res.json({
      success: true,
      data: {
        ...parsedData,
        cartas: cartasConDetalles,
      },
    });
  } catch (error: any) {
    console.error("Error en lectura de 3 cartas:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al realizar la lectura de 3 cartas con Luna",
    });
  }
});

// Endpoint 3: Chat de consulta (post-pago)
app.post("/api/tarot/chat", async (req, res) => {
  const {
    tema = "futuro",
    preguntaInicial = "",
    cartasPrevias = [],
    historialChat = [],
    nuevaPregunta = "",
  } = req.body;

  if (!nuevaPregunta || !nuevaPregunta.trim()) {
    return res.status(400).json({ success: false, error: "La pregunta no puede estar vacía." });
  }

  try {
    const prompt = buildLunaPrompt({
      tipo: "chat",
      tema,
      pregunta: preguntaInicial,
      cartasPrevias,
      historialChat,
      nuevaPregunta,
    });

    let parsedData: any;
    try {
      const rawText = await generateWithGeminiFallback({
        contents: prompt,
        systemInstruction: LUNA_SYSTEM_INSTRUCTION,
        responseSchema: LUNA_SCHEMA_CHAT,
        temperature: 0.7,
      });
      parsedData = JSON.parse(rawText);
    } catch (apiErr) {
      console.warn("Fallback to Marseille knowledge engine for chat:", apiErr);
      parsedData = generateLocalFallbackReading({
        tipo: "chat",
        tema,
        pregunta: nuevaPregunta,
        cartasPrevias,
      });
    }

    // Attach details for any newly brought cards
    if (parsedData.cartas_nuevas && Array.isArray(parsedData.cartas_nuevas)) {
      parsedData.cartas_nuevas = parsedData.cartas_nuevas.map((c: any) => {
        const detalle =
          c.detalle ||
          obtenerCartaPorNumero(c.numero) ||
          obtenerCartaPorNombre(c.nombre);
        return {
          ...c,
          detalle: detalle || null,
        };
      });
    }

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error("Error en chat con Luna:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al procesar la consulta con Luna",
    });
  }
});

// Setup Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use("/as-de-jupiter", express.static(distPath));
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`As de Júpiter (Luna Tarot) server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
