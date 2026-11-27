import express from "express";
import path from "path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { createServer as createViteServer } from "vite";
import {
  LUNA_SYSTEM_INSTRUCTION,
  LUNA_SCHEMA_CARTA_GRATIS,
  LUNA_SCHEMA_TRES_CARTAS,
  LUNA_SCHEMA_CHAT,
  resolverPosicionesServidor,
  buildLunaPrompt,
} from "./server/lunaConfig";
import {
  ACTIVATION_BRUTEFORCE_MESSAGE,
  ACTIVATION_NOT_FOUND_MESSAGE,
  AUTH_REQUIRED_MESSAGE,
  CHAT_LIMIT_MESSAGE,
  DAILY_SPREAD_LIMIT_MESSAGE,
  MAX_CHAT_MESSAGES_PER_SPREAD,
  MAX_PAID_SPREADS_PER_DAY,
  checkActivationRateLimit,
  clearFailedActivations,
  clearSessionCookie,
  consumeChatMessageQuota,
  consumePaidThreeCardSpread,
  getRemainingSpreadsToday,
  inspectSessionFromRequest,
  isSessionSecretConfigured,
  parseImpultiendaPayload,
  recordCompraInFirestore,
  recordFailedActivation,
  setSessionCookie,
  signSessionToken,
  verifyChatSessionAvailable,
  verifyCompraCredentials,
  verifyImpultiendaWebhookAuth,
} from "./server/commerceAndAuth";
import { TODAS_LAS_CARTAS } from "./src/data/cartas";
import type { CartaConocimiento } from "./src/types/tarot";

dotenv.config();

// Ensure HMR is disabled in development container environment to avoid websocket errors
process.env.DISABLE_HMR = "true";

const app = express();
const PORT = 3000;

app.set("trust proxy", 1);
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

const ALLOWED_EXACT_ORIGINS = new Set([
  "https://ais-pre-je5p43zcti47smd73hwmjw-681555613321.us-west2.run.app",
  "https://ais-dev-je5p43zcti47smd73hwmjw-681555613321.us-west2.run.app",
  "https://clo67.github.io",
]);
if (process.env.APP_URL) {
  try {
    ALLOWED_EXACT_ORIGINS.add(new URL(process.env.APP_URL).origin);
  } catch {
    // Ignore malformed APP_URL
  }
}
const LOCALHOST_ORIGIN_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function isOriginAllowed(origin: string): boolean {
  if (!origin) return true; // Same-origin requests without Origin header
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;
  if (LOCALHOST_ORIGIN_REGEX.test(origin)) return true;
  return false;
}

app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (!isOriginAllowed(origin)) {
      return res.status(403).json({ success: false, error: "Origen no autorizado." });
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Rate limit diario en memoria por IP (máximo 5 cartas gratis por día SOLO en producción)
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const MAX_FREE_CARDS_PER_DAY = 5;
const GEMINI_FREE_CALL_TIMEOUT_MS = 16000;
const GEMINI_FREE_TOTAL_BUDGET_MS = 27000;
const GEMINI_PAID_CALL_TIMEOUT_MS = 45000;
const GEMINI_PAID_TOTAL_BUDGET_MS = 55000;
const ipDailyCounts = new Map<string, number>();

const RATE_LIMIT_MESSAGE =
  "Por hoy ya recibiste tus cartas gratis. Vuelve mañana, o desbloquea la Tirada Completa de 3 Cartas para profundizar.";

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "local";
}

function checkFreeCardRateLimit(ip: string): boolean {
  if (!IS_PRODUCTION) {
    return true;
  }
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

/**
 * Sorteo criptográfico real con Fisher-Yates sobre los 22 Arcanos Mayores (0..21)
 */
function sortearCartasFisherYates(cantidad: number, excluirNumeros: number[] = []): CartaConocimiento[] {
  const excluidos = new Set(excluirNumeros);
  const mazo = TODAS_LAS_CARTAS.filter((c) => !excluidos.has(c.numero));
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = mazo[i];
    mazo[i] = mazo[j];
    mazo[j] = tmp;
  }
  return mazo.slice(0, cantidad);
}

function isValidCardNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 21;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

type ValidationResult =
  | { ok: true }
  | { ok: false; kind: "CARD_MISMATCH" | "SCHEMA_INVALID"; detail: string };

function validateCartaGratis(data: any, cartaSorteada: CartaConocimiento): ValidationResult {
  if (!data || typeof data !== "object") {
    return { ok: false, kind: "SCHEMA_INVALID", detail: "Respuesta JSON no es un objeto" };
  }
  if (!data.carta || typeof data.carta !== "object") {
    return { ok: false, kind: "SCHEMA_INVALID", detail: "Falta objeto 'carta'" };
  }
  if (!isValidCardNumber(data.carta.numero)) {
    return {
      ok: false,
      kind: "SCHEMA_INVALID",
      detail: `Número de carta inválido (${String(data.carta.numero)})`,
    };
  }
  if (!isNonEmptyString(data.interpretacion_breve)) {
    return { ok: false, kind: "SCHEMA_INVALID", detail: "Falta 'interpretacion_breve'" };
  }
  if (!isNonEmptyString(data.simbolo_clave)) {
    return { ok: false, kind: "SCHEMA_INVALID", detail: "Falta 'simbolo_clave'" };
  }
  if (data.carta.numero !== cartaSorteada.numero) {
    return {
      ok: false,
      kind: "CARD_MISMATCH",
      detail: `Se sorteó #${cartaSorteada.numero} y el modelo devolvió #${data.carta.numero}`,
    };
  }
  return { ok: true };
}

function validateTresCartas(
  data: any,
  cartasSorteadas: Array<{ posicion: string; carta: CartaConocimiento }>
): ValidationResult {
  if (!data || typeof data !== "object") {
    return { ok: false, kind: "SCHEMA_INVALID", detail: "Respuesta JSON no es un objeto" };
  }
  if (!Array.isArray(data.cartas) || data.cartas.length !== 3) {
    return { ok: false, kind: "SCHEMA_INVALID", detail: "El arreglo 'cartas' no tiene 3 elementos" };
  }
  if (!isNonEmptyString(data.cierre_narrativo)) {
    return { ok: false, kind: "SCHEMA_INVALID", detail: "Falta 'cierre_narrativo'" };
  }
  const seen = new Set<number>();
  for (let i = 0; i < 3; i++) {
    const c = data.cartas[i];
    const esperada = cartasSorteadas[i].carta;
    if (!c || typeof c !== "object") {
      return { ok: false, kind: "SCHEMA_INVALID", detail: `Carta en índice ${i} inválida` };
    }
    if (!isValidCardNumber(c.numero) || seen.has(c.numero)) {
      return {
        ok: false,
        kind: "SCHEMA_INVALID",
        detail: `Número inválido o repetido en índice ${i} (${String(c.numero)})`,
      };
    }
    seen.add(c.numero);
    if (!isNonEmptyString(c.interpretacion)) {
      return { ok: false, kind: "SCHEMA_INVALID", detail: `Falta 'interpretacion' en índice ${i}` };
    }
    if (!isNonEmptyString(c.simbolo_clave)) {
      return { ok: false, kind: "SCHEMA_INVALID", detail: `Falta 'simbolo_clave' en índice ${i}` };
    }
    if (c.numero !== esperada.numero) {
      return {
        ok: false,
        kind: "CARD_MISMATCH",
        detail: `Posición ${i + 1}: se sorteó #${esperada.numero} y el modelo devolvió #${c.numero}`,
      };
    }
  }
  return { ok: true };
}

function validateChat(data: any, cartaComplementaria: CartaConocimiento | null): ValidationResult {
  if (!data || typeof data !== "object") {
    return { ok: false, kind: "SCHEMA_INVALID", detail: "Respuesta JSON no es un objeto" };
  }
  if (!isNonEmptyString(data.respuesta)) {
    return { ok: false, kind: "SCHEMA_INVALID", detail: "Falta 'respuesta'" };
  }
  if (data.cartas_nuevas !== undefined) {
    if (!Array.isArray(data.cartas_nuevas)) {
      return { ok: false, kind: "SCHEMA_INVALID", detail: "'cartas_nuevas' no es un arreglo" };
    }
    if (data.cartas_nuevas.length > 1) {
      return { ok: false, kind: "SCHEMA_INVALID", detail: "Se devolvió más de 1 carta complementaria" };
    }
    for (const c of data.cartas_nuevas) {
      if (!c || typeof c !== "object") {
        return { ok: false, kind: "SCHEMA_INVALID", detail: "Carta complementaria inválida" };
      }
      if (!isValidCardNumber(c.numero)) {
        return { ok: false, kind: "SCHEMA_INVALID", detail: `Número inválido en cartas_nuevas (${String(c.numero)})` };
      }
      if (!cartaComplementaria || c.numero !== cartaComplementaria.numero) {
        return {
          ok: false,
          kind: "CARD_MISMATCH",
          detail: `Carta complementaria: se sorteó #${cartaComplementaria?.numero ?? "ninguna"} y el modelo devolvió #${c.numero}`,
        };
      }
    }
  }
  return { ok: true };
}

class TarotDiagnosticError extends Error {
  public readonly reasonCode: string;

  constructor(reasonCode: string, message: string) {
    super(message);
    this.name = "TarotDiagnosticError";
    this.reasonCode = reasonCode;
  }
}

// Modelos por tipo de lectura con cascada de respaldo
const MODELS_CARTA_GRATIS = [
  "gemini-3.1-flash-lite",
  "gemini-4-hydrogen",
  "gemini-flash-latest",
];

const MODELS_PAGO = [
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
      console.error("[Tarot][config] ERROR_CONFIG | Falta GEMINI_API_KEY en variables de entorno.");
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

function sanitizeErrorDetail(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || "Error desconocido");
  return raw.replace(/AIza[A-Za-z0-9_-]+/g, "[REDACTED]").slice(0, 220);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, modelName: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new TarotDiagnosticError(
              "TIMEOUT_GEMINI",
              `Tiempo de espera agotado (${timeoutMs}ms) esperando respuesta de ${modelName}`
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Resilient generate content wrapper with model cascade, per-attempt timeout, and number-only card validation (1 retry on mismatch)
 */
async function generateWithGeminiFallback(params: {
  endpointTag: string;
  contents: string;
  systemInstruction: string;
  responseSchema: any;
  modelCandidates: string[];
  validator: (data: any) => ValidationResult;
  callTimeoutMs?: number;
  totalBudgetMs?: number;
}): Promise<any> {
  if (!process.env.GEMINI_API_KEY) {
    throw new TarotDiagnosticError("FALTA_API_KEY", "GEMINI_API_KEY no configurada en el servidor");
  }

  const ai = getGeminiClient();
  const startedAt = Date.now();
  const maxCallTimeoutMs = params.callTimeoutMs ?? GEMINI_FREE_CALL_TIMEOUT_MS;
  const totalBudgetMs = params.totalBudgetMs ?? GEMINI_FREE_TOTAL_BUDGET_MS;
  let lastError: TarotDiagnosticError | null = null;

  for (const modelName of params.modelCandidates) {
    const maxRetries = 1; // Reintenta una vez ante error transitorio o discrepancia de carta
    const isGemini4 = modelName.startsWith("gemini-4-");

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= totalBudgetMs) {
        console.warn(
          `[Tarot][${params.endpointTag}] PRESUPUESTO_TIEMPO_AGOTADO | ms=${elapsed} | ultimoMotivo=${lastError?.reasonCode || "DESCONOCIDO"}`
        );
        throw (
          lastError ||
          new TarotDiagnosticError("TIMEOUT_TOTAL", "Se agotó el presupuesto de tiempo antes de completar la lectura")
        );
      }

      try {
        if (attempt > 0) {
          const backoff = Math.min(600 * Math.pow(2, attempt) + Math.random() * 200, 1800);
          console.log(
            `[Tarot][${params.endpointTag}] REINTENTO | modelo=${modelName} | intento=${attempt + 1} | esperaMs=${Math.round(backoff)}`
          );
          await delay(backoff);
        }

        const config: Record<string, any> = {
          systemInstruction: params.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
        };
        if (isGemini4) {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        } else {
          config.temperature = 0.7;
        }

        const remainingBudget = Math.max(4000, totalBudgetMs - (Date.now() - startedAt));
        const callTimeout = Math.min(maxCallTimeoutMs, remainingBudget);

        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: params.contents,
            config,
          }),
          callTimeout,
          modelName
        );

        if (!response.text) {
          lastError = new TarotDiagnosticError(
            "RESPUESTA_VACIA_GEMINI",
            `El modelo ${modelName} devolvió una respuesta vacía`
          );
          console.warn(
            `[Tarot][${params.endpointTag}] ${lastError.reasonCode} | modelo=${modelName} | intento=${attempt + 1}`
          );
          continue;
        }

        let parsed: any;
        try {
          const cleaned = response.text
            .trim()
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
          parsed = JSON.parse(cleaned);
        } catch {
          lastError = new TarotDiagnosticError(
            "JSON_INVALIDO_GEMINI",
            `La salida de ${modelName} no fue JSON válido`
          );
          console.warn(
            `[Tarot][${params.endpointTag}] ${lastError.reasonCode} | modelo=${modelName} | intento=${attempt + 1}`
          );
          continue;
        }

        const validation = params.validator(parsed);
        if (validation.ok === false) {
          const reasonCode =
            validation.kind === "CARD_MISMATCH"
              ? "FALLO_VERIFICACION_CARTA"
              : "FALLO_VALIDACION_SCHEMA";
          lastError = new TarotDiagnosticError(reasonCode, validation.detail);
          console.warn(
            `[Tarot][${params.endpointTag}] ${reasonCode} | modelo=${modelName} | intento=${attempt + 1} | detalle=${validation.detail}`
          );
          continue;
        }

        console.log(
          `[Tarot][${params.endpointTag}] OK | modelo=${modelName} | duracionMs=${Date.now() - startedAt}`
        );
        return parsed;
      } catch (err: any) {
        if (err instanceof TarotDiagnosticError) {
          lastError = err;
          console.warn(
            `[Tarot][${params.endpointTag}] ${err.reasonCode} | modelo=${modelName} | intento=${attempt + 1} | detalle=${err.message}`
          );
          if (err.reasonCode === "TIMEOUT_GEMINI") {
            // Pasar directo al siguiente modelo si este agotó su tiempo
            break;
          }
          continue;
        }

        const errMsg = sanitizeErrorDetail(err);
        const isTransient =
          errMsg.includes("503") ||
          errMsg.includes("high demand") ||
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("overloaded");

        const reasonCode = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")
          ? "CUOTA_API_GEMINI"
          : errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand")
            ? "ALTA_DEMANDA_GEMINI"
            : "ERROR_API_GEMINI";

        lastError = new TarotDiagnosticError(reasonCode, errMsg);
        console.warn(
          `[Tarot][${params.endpointTag}] ${reasonCode} | modelo=${modelName} | intento=${attempt + 1} | detalle=${errMsg}`
        );

        if (!isTransient && attempt === 0) {
          break;
        }
      }
    }
  }

  throw (
    lastError ||
    new TarotDiagnosticError("GEMINI_NO_DISPONIBLE", "Todos los modelos de respaldo fallaron")
  );
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "As de Júpiter - Luna Tarot API",
    environment: IS_PRODUCTION ? "production" : "development",
    rateLimitActive: IS_PRODUCTION,
  });
});

// Webhook de Impultienda: recibe aviso de compra, verifica secreto/firma y guarda compras pagadas en Firestore ("compras")
app.post("/api/webhooks/impultienda", async (req, res) => {
  const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const authResult = verifyImpultiendaWebhookAuth(req, rawBody);

  if (!authResult.ok) {
    const statusCode = authResult.reason === "SECRET_NO_CONFIGURADO" ? 503 : 401;
    console.warn(`[Tarot][webhook-impultienda] RECHAZADO | motivo=${authResult.reason}`);
    return res.status(statusCode).json({ success: false, error: "Webhook no autorizado." });
  }

  if (process.env.WEBHOOK_DEBUG === "true") {
    console.log("[Tarot][webhook-impultienda][DEBUG] Payload recibido:", JSON.stringify(req.body));
  }

  const parsed = parseImpultiendaPayload(req.body);
  if (!parsed) {
    console.warn("[Tarot][webhook-impultienda] PAYLOAD_INCOMPLETO | faltan email o numero de pedido");
    return res.status(400).json({ success: false, error: "Formato de notificación no reconocido." });
  }

  if (!parsed.isPaid) {
    console.log(`[Tarot][webhook-impultienda] IGNORADO_NO_PAGADO | estado=${parsed.estado}`);
    return res.status(200).json({ success: true, recorded: false, reason: "estado_no_pagado" });
  }

  try {
    await recordCompraInFirestore(parsed);
    console.log(`[Tarot][webhook-impultienda] COMPRA_REGISTRADA | estado=${parsed.estado}`);
    return res.status(200).json({ success: true, recorded: true });
  } catch (err) {
    const detail = sanitizeErrorDetail(err);
    console.error(`[Tarot][webhook-impultienda] ERROR_FIRESTORE | detalle=${detail}`);
    return res.status(500).json({ success: false, error: "No se pudo registrar la compra." });
  }
});

// Consultar estado actual de desbloqueo (nunca devuelve 401 para evitar ruido en consola al iniciar)
app.get("/api/auth/session", async (req, res) => {
  const authCheck = inspectSessionFromRequest(req);
  if (authCheck.ok === false) {
    console.log(`[Tarot][auth-session] NO_ACTIVO | motivo="${authCheck.reason}"`);
    return res.json({
      unlocked: false,
      isTestBuyer: false,
      tiradasRestantesHoy: null,
      maxTiradasPorDia: MAX_PAID_SPREADS_PER_DAY,
      maxMensajesPorTirada: MAX_CHAT_MESSAGES_PER_SPREAD,
    });
  }
  const session = authCheck.session;

  try {
    const tiradasRestantesHoy = await getRemainingSpreadsToday(session);
    return res.json({
      unlocked: true,
      isTestBuyer: session.isTest,
      tiradasRestantesHoy,
      maxTiradasPorDia: MAX_PAID_SPREADS_PER_DAY,
      maxMensajesPorTirada: MAX_CHAT_MESSAGES_PER_SPREAD,
    });
  } catch (err) {
    const detail = sanitizeErrorDetail(err);
    console.error(`[Tarot][auth-session] ERROR_FIRESTORE | detalle=${detail}`);
    return res.json({
      unlocked: true,
      isTestBuyer: session.isTest,
      tiradasRestantesHoy: MAX_PAID_SPREADS_PER_DAY,
      maxTiradasPorDia: MAX_PAID_SPREADS_PER_DAY,
      maxMensajesPorTirada: MAX_CHAT_MESSAGES_PER_SPREAD,
    });
  }
});

// Activar compra con email + número de pedido (máx 5 intentos fallidos por IP por hora)
app.post("/api/auth/activar", async (req, res) => {
  if (IS_PRODUCTION && !isSessionSecretConfigured()) {
    console.error(
      '[Tarot][auth-activar] DESBLOQUEO_RECHAZADO | motivo="Falta SESSION_SECRET válida en producción (mínimo 16 caracteres)"'
    );
    return res.status(503).json({
      success: false,
      code: "SERVER_CONFIG_ERROR",
      error: "El sistema de activación no está disponible en este momento por configuración del servidor.",
    });
  }

  const clientIp = getClientIp(req);
  const rateCheck = checkActivationRateLimit(clientIp);
  if (!rateCheck.allowed) {
    console.warn("[Tarot][auth-activar] BLOQUEO_FUERZA_BRUTA | maxFallosPorHora=5");
    return res.status(429).json({
      success: false,
      code: "ACTIVATION_RATE_LIMIT",
      error: ACTIVATION_BRUTEFORCE_MESSAGE,
    });
  }

  const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
  const rawPedido = typeof req.body?.pedido === "string" ? req.body.pedido : "";

  try {
    const result = await verifyCompraCredentials(rawEmail, rawPedido);
    if (!result.found) {
      recordFailedActivation(clientIp);
      console.warn("[Tarot][auth-activar] COMPRA_NO_ENCONTRADA");
      return res.status(401).json({
        success: false,
        code: "PURCHASE_NOT_FOUND",
        error: ACTIVATION_NOT_FOUND_MESSAGE,
      });
    }

    clearFailedActivations(clientIp);
    const jwt = signSessionToken({
      email: result.email,
      order: result.pedido,
      isTest: result.isTest,
    });
    setSessionCookie(req, res, jwt);

    const sessionClaims = {
      sub: result.email,
      order: result.pedido,
      isTest: result.isTest,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60,
    };
    let tiradasRestantesHoy = MAX_PAID_SPREADS_PER_DAY;
    try {
      tiradasRestantesHoy = await getRemainingSpreadsToday(sessionClaims);
    } catch {
      // Si aún no hay permiso IAM en entorno dev para consulta adicional, mantener valor por defecto
    }

    console.log(`[Tarot][auth-activar] ACTIVACION_EXITOSA | modoPrueba=${result.isTest}`);
    return res.json({
      success: true,
      data: {
        unlocked: true,
        isTestBuyer: result.isTest,
        tiradasRestantesHoy,
        maxTiradasPorDia: MAX_PAID_SPREADS_PER_DAY,
        maxMensajesPorTirada: MAX_CHAT_MESSAGES_PER_SPREAD,
      },
    });
  } catch (err) {
    const detail = sanitizeErrorDetail(err);
    console.error(`[Tarot][auth-activar] ERROR_VERIFICACION | detalle=${detail}`);
    return res.status(503).json({
      success: false,
      error: "No pudimos verificar tu compra en este momento. Intenta de nuevo en unos segundos.",
    });
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearSessionCookie(req, res);
  res.json({ success: true });
});

// Endpoint: Obtener todos los 22 arcanos mayores
app.get("/api/tarot/cartas", (req, res) => {
  res.json({ cartas: TODAS_LAS_CARTAS });
});

// Endpoint 1: Carta gratis (1 carta sorteada al azar en servidor)
app.post("/api/tarot/carta-gratis", async (req, res) => {
  const startedAt = Date.now();
  const clientIp = getClientIp(req);
  if (!checkFreeCardRateLimit(clientIp)) {
    console.warn(
      `[Tarot][carta-gratis] LIMITE_DIARIO_IP | env=${IS_PRODUCTION ? "production" : "development"} | max=${MAX_FREE_CARDS_PER_DAY}`
    );
    return res.status(429).json({
      success: false,
      code: "RATE_LIMIT_EXCEEDED",
      error: RATE_LIMIT_MESSAGE,
    });
  }

  const { tema = "futuro", pregunta = "" } = req.body || {};
  const temaLog = typeof tema === "string" ? tema.slice(0, 20) : "futuro";

  try {
    const [cartaSorteada] = sortearCartasFisherYates(1);

    const prompt = buildLunaPrompt({
      tipo: "carta_gratis",
      tema,
      pregunta,
      cartaSorteada,
    });

    const parsedData = await generateWithGeminiFallback({
      endpointTag: "carta-gratis",
      contents: prompt,
      systemInstruction: LUNA_SYSTEM_INSTRUCTION,
      responseSchema: LUNA_SCHEMA_CARTA_GRATIS,
      modelCandidates: MODELS_CARTA_GRATIS,
      validator: (data) => validateCartaGratis(data, cartaSorteada),
    });

    res.json({
      success: true,
      data: {
        carta: {
          numero: cartaSorteada.numero,
          nombre: cartaSorteada.nombre,
        },
        interpretacion_breve: parsedData.interpretacion_breve,
        simbolo_clave: parsedData.simbolo_clave,
      },
      cartaDetalle: cartaSorteada,
    });
  } catch (error: any) {
    const reasonCode = error instanceof TarotDiagnosticError ? error.reasonCode : "ERROR_INTERNO";
    const detail = sanitizeErrorDetail(error);
    console.error(
      `[Tarot][carta-gratis] FALLO_LECTURA | motivo=${reasonCode} | tema=${temaLog} | duracionMs=${Date.now() - startedAt} | detalle=${detail}`
    );
    res.status(502).json({
      success: false,
      error: "Las cartas necesitan un momento de silencio. Prueba de nuevo en unos segundos.",
    });
  }
});

// Endpoint 2: Lectura de 3 cartas (requiere compra activa + máx 5 por día por comprador)
app.post("/api/tarot/lectura-tres-cartas", async (req, res) => {
  const startedAt = Date.now();
  const authCheck = inspectSessionFromRequest(req);
  if (authCheck.ok === false) {
    console.warn(`[Tarot][lectura-tres-cartas] ACCESO_DENEGADO | motivo="${authCheck.reason}"`);
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      error: AUTH_REQUIRED_MESSAGE,
    });
  }
  const session = authCheck.session;

  const {
    tema = "futuro",
    pregunta = "",
    esquemaId = "situacion_obstaculo_consejo",
  } = req.body || {};
  const temaLog = typeof tema === "string" ? tema.slice(0, 20) : "futuro";

  try {
    const remainingBefore = await getRemainingSpreadsToday(session);
    if (remainingBefore <= 0) {
      console.warn('[Tarot][lectura-tres-cartas] ACCESO_DENEGADO | motivo="límite alcanzado"');
      return res.status(429).json({
        success: false,
        code: "DAILY_LIMIT_EXCEEDED",
        error: DAILY_SPREAD_LIMIT_MESSAGE,
      });
    }

    const posiciones = resolverPosicionesServidor(esquemaId);
    const cartasAleatorias = sortearCartasFisherYates(3);
    const cartasSorteadas = cartasAleatorias.map((carta, i) => ({
      posicion: posiciones[i],
      carta,
    }));

    const prompt = buildLunaPrompt({
      tipo: "tres_cartas",
      tema,
      pregunta,
      cartasSorteadas,
    });

    const parsedData = await generateWithGeminiFallback({
      endpointTag: "lectura-tres-cartas",
      contents: prompt,
      systemInstruction: LUNA_SYSTEM_INSTRUCTION,
      responseSchema: LUNA_SCHEMA_TRES_CARTAS,
      modelCandidates: MODELS_PAGO,
      validator: (data) => validateTresCartas(data, cartasSorteadas),
      callTimeoutMs: GEMINI_PAID_CALL_TIMEOUT_MS,
      totalBudgetMs: GEMINI_PAID_TOTAL_BUDGET_MS,
    });

    const quotaResult = await consumePaidThreeCardSpread(session, temaLog);
    if (quotaResult.allowed === false) {
      console.warn("[Tarot][lectura-tres-cartas] LIMITE_DIARIO_COMPRADOR_TX | max=5");
      return res.status(429).json({
        success: false,
        code: "DAILY_LIMIT_EXCEEDED",
        error: DAILY_SPREAD_LIMIT_MESSAGE,
      });
    }

    const cartasConDetalles = cartasSorteadas.map((item, i) => ({
      posicion: item.posicion,
      numero: item.carta.numero,
      nombre: item.carta.nombre,
      interpretacion: parsedData.cartas[i].interpretacion,
      simbolo_clave: parsedData.cartas[i].simbolo_clave,
      detalle: item.carta,
    }));

    res.json({
      success: true,
      data: {
        tiradaId: quotaResult.tiradaId,
        tiradasRestantesHoy: quotaResult.tiradasRestantesHoy,
        mensajesRestantes: MAX_CHAT_MESSAGES_PER_SPREAD,
        cartas: cartasConDetalles,
        cierre_narrativo: parsedData.cierre_narrativo,
      },
    });
  } catch (error: any) {
    const reasonCode = error instanceof TarotDiagnosticError ? error.reasonCode : "ERROR_INTERNO";
    const detail = sanitizeErrorDetail(error);
    console.error(
      `[Tarot][lectura-tres-cartas] FALLO_LECTURA | motivo=${reasonCode} | tema=${temaLog} | duracionMs=${Date.now() - startedAt} | detalle=${detail}`
    );
    res.status(502).json({
      success: false,
      error: "Las cartas necesitan un momento de silencio. Prueba de nuevo en unos segundos.",
    });
  }
});

// Endpoint 3: Chat de consulta (requiere compra activa + máx 10 mensajes por tirada)
app.post("/api/tarot/chat", async (req, res) => {
  const startedAt = Date.now();
  const authCheck = inspectSessionFromRequest(req);
  if (authCheck.ok === false) {
    console.warn(`[Tarot][chat] ACCESO_DENEGADO | motivo="${authCheck.reason}"`);
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      error: AUTH_REQUIRED_MESSAGE,
    });
  }
  const session = authCheck.session;

  const {
    tema = "futuro",
    preguntaInicial = "",
    cartasPrevias = [],
    historialChat = [],
    nuevaPregunta = "",
    tiradaId = undefined,
  } = req.body || {};
  const temaLog = typeof tema === "string" ? tema.slice(0, 20) : "futuro";

  if (!nuevaPregunta || typeof nuevaPregunta !== "string" || !nuevaPregunta.trim()) {
    return res.status(400).json({ success: false, error: "La pregunta no puede estar vacía." });
  }

  try {
    const preCheck = await verifyChatSessionAvailable(
      session,
      typeof tiradaId === "string" ? tiradaId : undefined
    );
    if (preCheck.ok === false) {
      if (preCheck.reason === "CHAT_LIMIT_EXCEEDED") {
        console.warn('[Tarot][chat] ACCESO_DENEGADO | motivo="límite alcanzado"');
        return res.status(429).json({
          success: false,
          code: "CHAT_LIMIT_EXCEEDED",
          error: CHAT_LIMIT_MESSAGE,
          mensajesRestantes: 0,
        });
      }
      if (preCheck.reason === "DAILY_LIMIT_EXCEEDED") {
        console.warn('[Tarot][chat] ACCESO_DENEGADO | motivo="límite alcanzado"');
        return res.status(429).json({
          success: false,
          code: "DAILY_LIMIT_EXCEEDED",
          error: DAILY_SPREAD_LIMIT_MESSAGE,
          mensajesRestantes: 0,
        });
      }
      console.warn('[Tarot][chat] ACCESO_DENEGADO | motivo="sesión no encontrada (servidor reiniciado)"');
      return res.status(400).json({
        success: false,
        code: "INVALID_SESSION",
        error: "Esta sesión de tirada no es válida. Realiza una nueva tirada de 3 cartas para continuar.",
      });
    }

    const numerosExcluidos = Array.isArray(cartasPrevias)
      ? cartasPrevias
          .map((c: any) => Number(c?.numero))
          .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 21)
      : [];
    const [cartaComplementaria] = sortearCartasFisherYates(1, numerosExcluidos);

    const prompt = buildLunaPrompt({
      tipo: "chat",
      tema,
      pregunta: preguntaInicial,
      cartasPrevias,
      cartaComplementariaSorteada: cartaComplementaria || null,
      historialChat,
      nuevaPregunta,
    });

    const parsedData = await generateWithGeminiFallback({
      endpointTag: "chat",
      contents: prompt,
      systemInstruction: LUNA_SYSTEM_INSTRUCTION,
      responseSchema: LUNA_SCHEMA_CHAT,
      modelCandidates: MODELS_PAGO,
      validator: (data) => validateChat(data, cartaComplementaria || null),
      callTimeoutMs: GEMINI_PAID_CALL_TIMEOUT_MS,
      totalBudgetMs: GEMINI_PAID_TOTAL_BUDGET_MS,
    });

    const quotaConsume = await consumeChatMessageQuota(
      session,
      typeof tiradaId === "string" ? tiradaId : undefined,
      temaLog
    );
    if (quotaConsume.allowed === false) {
      const code = quotaConsume.reason;
      const errMsg =
        code === "DAILY_LIMIT_EXCEEDED"
          ? DAILY_SPREAD_LIMIT_MESSAGE
          : code === "CHAT_LIMIT_EXCEEDED"
            ? CHAT_LIMIT_MESSAGE
            : "Esta sesión de tirada ya no está disponible.";
      return res.status(code === "INVALID_SESSION" ? 400 : 429).json({
        success: false,
        code,
        error: errMsg,
        mensajesRestantes: 0,
      });
    }

    if (parsedData.cartas_nuevas && Array.isArray(parsedData.cartas_nuevas) && cartaComplementaria) {
      parsedData.cartas_nuevas = parsedData.cartas_nuevas.map((c: any) => ({
        numero: cartaComplementaria.numero,
        nombre: cartaComplementaria.nombre,
        motivo: c.motivo,
        detalle: cartaComplementaria,
      }));
    }

    res.json({
      success: true,
      data: {
        ...parsedData,
        tiradaId: quotaConsume.tiradaId,
        mensajesUsados: quotaConsume.mensajesUsados,
        mensajesRestantes: quotaConsume.mensajesRestantes,
      },
    });
  } catch (error: any) {
    const reasonCode = error instanceof TarotDiagnosticError ? error.reasonCode : "ERROR_INTERNO";
    const detail = sanitizeErrorDetail(error);
    console.error(
      `[Tarot][chat] FALLO_LECTURA | motivo=${reasonCode} | tema=${temaLog} | duracionMs=${Date.now() - startedAt} | detalle=${detail}`
    );
    res.status(502).json({
      success: false,
      error: "Las cartas necesitan un momento de silencio. Prueba de nuevo en unos segundos.",
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
