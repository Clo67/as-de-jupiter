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

app.set("trust proxy", 1);
app.use(express.json());

const ALLOWED_EXACT_ORIGINS = new Set(["https://clo67.github.io"]);
const LOCALHOST_ORIGIN_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function isOriginAllowed(origin: string): boolean {
  if (!origin) return true; // Same-origin requests without Origin header
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;
  if (LOCALHOST_ORIGIN_REGEX.test(origin)) return true;
  if (/^https:\/\/ais-(dev|pre)-[a-z0-9-]+\.us-[a-z0-9]+\.run\.app$/i.test(origin)) return true;
  return false;
}

app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (!isOriginAllowed(origin)) {
      return res.status(403).json({ success: false, error: "Origen no autorizado." });
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Rate limit diario en memoria por IP (máximo 5 cartas gratis por día)
const MAX_FREE_CARDS_PER_DAY = 5;
const ipDailyCounts = new Map<string, number>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "local";
}

function checkFreeCardRateLimit(ip: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${today}:${ip}`;
  if (ipDailyCounts.size > 5000) {
    for (const k of ipDailyCounts.keys()) {
      if (!k.startsWith(`${today}:`)) ipDailyCounts.delete(k);
    }
  }
  const current = ipDailyCounts.get(key) || 0;
  if (current >= MAX_FREE_CARDS_PER_DAY) {
    return false;
  }
  ipDailyCounts.set(key, current + 1);
  return true;
}

function isValidCardNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 21;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function validateCartaGratis(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (!data.carta || typeof data.carta !== "object") return false;
  return (
    isValidCardNumber(data.carta.numero) &&
    isNonEmptyString(data.carta.nombre) &&
    isNonEmptyString(data.interpretacion_breve)
  );
}

function validateTresCartas(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.cartas) || data.cartas.length !== 3) return false;
  if (!isNonEmptyString(data.cierre_narrativo)) return false;
  const seen = new Set<number>();
  for (const c of data.cartas) {
    if (!c || typeof c !== "object") return false;
    if (!isNonEmptyString(c.posicion)) return false;
    if (!isValidCardNumber(c.numero) || seen.has(c.numero)) return false;
    seen.add(c.numero);
    if (!isNonEmptyString(c.nombre) || !isNonEmptyString(c.interpretacion)) return false;
  }
  return true;
}

function validateChat(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (!isNonEmptyString(data.respuesta)) return false;
  if (data.cartas_nuevas !== undefined) {
    if (!Array.isArray(data.cartas_nuevas)) return false;
    for (const c of data.cartas_nuevas) {
      if (!c || typeof c !== "object") return false;
      if (!isValidCardNumber(c.numero) || !isNonEmptyString(c.nombre)) return false;
    }
  }
  return true;
}

// List of recommended models to cascade through in case of 503 / high demand spikes
const MODEL_CANDIDATES = [
  "gemini-4-hydrogen",
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
 * Resilient generate content wrapper with model cascade, exponential backoff & schema validation
 */
async function generateWithGeminiFallback(params: {
  contents: string;
  systemInstruction: string;
  responseSchema: any;
  validator: (data: any) => boolean;
}): Promise<any> {
  const ai = getGeminiClient();
  let lastError: any = null;

  for (const modelName of MODEL_CANDIDATES) {
    const maxRetries = 2;
    const isGemini4 = modelName.startsWith("gemini-4-");
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 400, 4000);
          console.log(`[Gemini Retry] Retrying model ${modelName} in ${Math.round(backoff)}ms (attempt ${attempt + 1})...`);
          await delay(backoff);
        }

        const config: Record<string, any> = {
          systemInstruction: params.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
        };
        if (!isGemini4) {
          config.temperature = 0.7;
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config,
        });

        if (response.text) {
          const cleaned = response.text
            .trim()
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
          const parsed = JSON.parse(cleaned);
          if (params.validator(parsed)) {
            return parsed;
          }
          throw new Error("La respuesta del modelo no cumplió con el schema esperado.");
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
          break;
        }
      }
    }
  }

  throw lastError || new Error("Todos los modelos de Gemini están experimentando alta demanda.");
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
  const clientIp = getClientIp(req);
  if (!checkFreeCardRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      code: "RATE_LIMIT_EXCEEDED",
      error:
        "Hoy ya consultaste tus 5 cartas gratuitas. Las cartas necesitan reposar hasta mañana para seguir guiándote con claridad.",
    });
  }

  const { tema = "futuro", pregunta = "" } = req.body || {};
  try {
    const prompt = buildLunaPrompt({
      tipo: "carta_gratis",
      tema,
      pregunta,
    });

    const parsedData = await generateWithGeminiFallback({
      contents: prompt,
      systemInstruction: LUNA_SYSTEM_INSTRUCTION,
      responseSchema: LUNA_SCHEMA_CARTA_GRATIS,
      validator: validateCartaGratis,
    });

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
    res.status(502).json({
      success: false,
      error: "Las cartas necesitan un momento de silencio. Probá de nuevo en unos segundos.",
    });
  }
});

// Endpoint 2: Lectura de 3 cartas (paga)
app.post("/api/tarot/lectura-tres-cartas", async (req, res) => {
  const {
    tema = "futuro",
    pregunta = "",
    posiciones = ["Situación actual", "Obstáculo / Desafío", "Consejo y rumbo"],
  } = req.body || {};

  try {
    const prompt = buildLunaPrompt({
      tipo: "tres_cartas",
      tema,
      pregunta,
      esquemaPosiciones: posiciones,
    });

    const parsedData = await generateWithGeminiFallback({
      contents: prompt,
      systemInstruction: LUNA_SYSTEM_INSTRUCTION,
      responseSchema: LUNA_SCHEMA_TRES_CARTAS,
      validator: validateTresCartas,
    });

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
    res.status(502).json({
      success: false,
      error: "Las cartas necesitan un momento de silencio. Probá de nuevo en unos segundos.",
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
  } = req.body || {};

  if (!nuevaPregunta || typeof nuevaPregunta !== "string" || !nuevaPregunta.trim()) {
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

    const parsedData = await generateWithGeminiFallback({
      contents: prompt,
      systemInstruction: LUNA_SYSTEM_INSTRUCTION,
      responseSchema: LUNA_SCHEMA_CHAT,
      validator: validateChat,
    });

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
    res.status(502).json({
      success: false,
      error: "Las cartas necesitan un momento de silencio. Probá de nuevo en unos segundos.",
    });
  }
});

// Garantizar que cualquier ruta /api/* inexistente devuelva JSON y no HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ success: false, error: "Ruta de API no encontrada." });
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
