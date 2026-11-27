import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type express from 'express';
import { getServerFirestore } from './firebaseAdmin';

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const MAX_PAID_SPREADS_PER_DAY = 5;
export const MAX_CHAT_MESSAGES_PER_SPREAD = 10;
export const SESSION_COOKIE_NAME = 'as_jupiter_session';
export const DAILY_SPREAD_LIMIT_MESSAGE =
  'Por hoy Luna ya leyó tus cartas. Vuelve mañana para una nueva tirada.';
export const CHAT_LIMIT_MESSAGE =
  'Ya completaste las 10 consultas de esta tirada. Realiza una nueva Tirada Completa de 3 Cartas si deseas seguir profundizando.';
export const ACTIVATION_NOT_FOUND_MESSAGE =
  'No encontramos esa compra. Revisa que el email y el número de pedido sean los del mail de confirmación. Si acabas de pagar, espera un minuto y vuelve a intentar.';
export const ACTIVATION_BRUTEFORCE_MESSAGE =
  'Demasiados intentos fallidos. Espera una hora antes de volver a intentar o contáctanos si necesitas ayuda con tu pedido.';
export const AUTH_REQUIRED_MESSAGE =
  'Esta función forma parte del acceso completo de Luna. Desbloquea o activa tu compra para continuar.';

const TEST_BUYER_EMAIL = 'prueba@asdejupiter.com';
const TEST_BUYER_ORDER = 'TEST-0001';

// Clave de sesión: usa SESSION_SECRET de entorno; en desarrollo la persiste en /tmp para sobrevivir reinicios sin usar secretos fijos
const DEV_SECRET_FILE = path.join('/tmp', '.as_jupiter_dev_session_secret');
let cachedFallbackSecret: string | null = null;

export function isSessionSecretConfigured(): boolean {
  const configured = process.env.SESSION_SECRET?.trim();
  return Boolean(configured && configured.length >= 16);
}

function getOrCreateDevFallbackSecret(): string {
  if (IS_PRODUCTION) {
    throw new Error('SESSION_SECRET_MISSING_IN_PRODUCTION');
  }
  if (cachedFallbackSecret) return cachedFallbackSecret;
  try {
    if (fs.existsSync(DEV_SECRET_FILE)) {
      const stored = fs.readFileSync(DEV_SECRET_FILE, 'utf8').trim();
      if (stored.length >= 32) {
        cachedFallbackSecret = stored;
        return stored;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(DEV_SECRET_FILE, generated, { mode: 0o600 });
    cachedFallbackSecret = generated;
    return generated;
  } catch {
    // Si no se puede escribir en /tmp, usar clave aleatoria en memoria solo en desarrollo
  }
  cachedFallbackSecret = crypto.randomBytes(32).toString('hex');
  return cachedFallbackSecret;
}

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return configured;
  }
  if (IS_PRODUCTION) {
    throw new Error('SESSION_SECRET_MISSING_IN_PRODUCTION');
  }
  return getOrCreateDevFallbackSecret();
}

if (!isSessionSecretConfigured()) {
  const rawLen = (process.env.SESSION_SECRET || '').trim().length;
  if (IS_PRODUCTION) {
    console.error(
      rawLen === 0
        ? '[Tarot][auth] ERROR_CRITICO_PRODUCCION | Falta SESSION_SECRET en producción. Los desbloqueos y sesiones pagas quedan rechazados hasta configurarla en Settings > Secrets.'
        : '[Tarot][auth] ERROR_CRITICO_PRODUCCION | SESSION_SECRET en producción debe tener al menos 16 caracteres. Los desbloqueos y sesiones pagas quedan rechazados.'
    );
  } else {
    console.warn(
      '[Tarot][auth] SESSION_SECRET no definida; usando clave aleatoria persistente local en /tmp exclusivamente para desarrollo.'
    );
  }
}

const PAID_STATUS_KEYWORDS = new Set([
  'pagado',
  'pagada',
  'aprobado',
  'aprobada',
  'paid',
  'approved',
  'completed',
  'complete',
  'accredited',
  'acreditado',
  'acreditada',
  'confirmed',
  'confirmado',
  'confirmada',
  'succeeded',
  'success',
  'authorized',
  'autorizado',
  'autorizada',
  'settled',
  'captured',
]);

// --- Rate limiter anti fuerza bruta para /api/auth/activar (máx 5 fallos / hora / IP) ---
const activationFailuresByIp = new Map<string, number[]>();
const ACTIVATION_WINDOW_MS = 60 * 60 * 1000;
const MAX_FAILED_ACTIVATIONS_PER_HOUR = 5;

export function checkActivationRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const cutoff = now - ACTIVATION_WINDOW_MS;
  const recent = (activationFailuresByIp.get(ip) || []).filter((ts) => ts > cutoff);
  if (recent.length === 0) {
    activationFailuresByIp.delete(ip);
  } else {
    activationFailuresByIp.set(ip, recent);
  }
  return {
    allowed: recent.length < MAX_FAILED_ACTIVATIONS_PER_HOUR,
    remaining: Math.max(0, MAX_FAILED_ACTIVATIONS_PER_HOUR - recent.length),
  };
}

export function recordFailedActivation(ip: string): void {
  const now = Date.now();
  const cutoff = now - ACTIVATION_WINDOW_MS;
  if (activationFailuresByIp.size > 5000) {
    for (const [k, list] of activationFailuresByIp.entries()) {
      const valid = list.filter((ts) => ts > cutoff);
      if (valid.length === 0) activationFailuresByIp.delete(k);
      else activationFailuresByIp.set(k, valid);
    }
  }
  const recent = (activationFailuresByIp.get(ip) || []).filter((ts) => ts > cutoff);
  recent.push(now);
  activationFailuresByIp.set(ip, recent);
}

export function clearFailedActivations(ip: string): void {
  activationFailuresByIp.delete(ip);
}

// --- Almacenamiento en memoria exclusivo para desarrollo/vista previa (!IS_PRODUCTION) ---
const devComprasStore = new Map<
  string,
  {
    email: string;
    pedido: string;
    pedidoNormalizado: string;
    fecha: string;
    estado: string;
    producto: string;
  }
>();
const devDailyUsageStore = new Map<string, number>();
const devChatSessionsStore = new Map<
  string,
  {
    buyerEmail: string;
    mensajesUsados: number;
    maxMensajes: number;
    tema: string;
    createdAt: string;
    updatedAt: string;
  }
>();

// --- JWT HS256 con node:crypto ---
export interface BuyerSessionClaims {
  sub: string;
  order: string;
  isTest: boolean;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

export function signSessionToken(payload: {
  email: string;
  order: string;
  isTest: boolean;
}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const claims: BuyerSessionClaims = {
    sub: payload.email.trim().toLowerCase(),
    order: payload.order.trim(),
    isTest: payload.isTest,
    iat: nowSec,
    exp: nowSec + 180 * 24 * 60 * 60, // 180 días (renovable al reactivar)
  };
  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigB64 = base64UrlEncode(
    crypto.createHmac('sha256', getSessionSecret()).update(signingInput).digest()
  );
  return `${signingInput}.${sigB64}`;
}

export function verifySessionToken(token: string): BuyerSessionClaims | null {
  try {
    if (IS_PRODUCTION && !isSessionSecretConfigured()) {
      return null;
    }
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', getSessionSecret()).update(signingInput).digest()
    );
    const sigBuf = Buffer.from(sigB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const claims = JSON.parse(base64UrlDecode(payloadB64)) as BuyerSessionClaims;
    if (!claims?.sub || !claims?.order || typeof claims.exp !== 'number') {
      return null;
    }
    if (claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (claims.isTest && IS_PRODUCTION) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export type SessionCheckResult =
  | { ok: true; session: BuyerSessionClaims }
  | { ok: false; reason: 'sin cookie' | 'token inválido o vencido' | 'SESSION_SECRET no configurada en producción' };

export function inspectSessionFromRequest(req: express.Request): SessionCheckResult {
  if (IS_PRODUCTION && !isSessionSecretConfigured()) {
    return { ok: false, reason: 'SESSION_SECRET no configurada en producción' };
  }
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return { ok: false, reason: 'sin cookie' };
  }
  const session = verifySessionToken(token);
  if (!session) {
    return { ok: false, reason: 'token inválido o vencido' };
  }
  return { ok: true, session };
}

export function getSessionFromRequest(req: express.Request): BuyerSessionClaims | null {
  const check = inspectSessionFromRequest(req);
  return check.ok ? check.session : null;
}

export function setSessionCookie(_req: express.Request, res: express.Response, jwt: string): void {
  const maxAge = 180 * 24 * 60 * 60;
  // Atributos obligatorios para funcionar dentro del iframe de aistudio.google.com (CHIPS) y en producción HTTPS
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(jwt)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=None',
    'Secure',
    'Partitioned',
    `Max-Age=${maxAge}`,
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(_req: express.Request, res: express.Response): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=None',
    'Secure',
    'Partitioned',
    'Max-Age=0',
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

// --- Normalización y validación de pedidos y correos ---
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOrderNumber(order: string): string {
  return order.trim().replace(/^#/, '').trim().toUpperCase();
}

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isTestBuyerCredentials(email: string, pedido: string): boolean {
  if (IS_PRODUCTION) return false;
  return (
    normalizeEmail(email) === TEST_BUYER_EMAIL &&
    normalizeOrderNumber(pedido) === normalizeOrderNumber(TEST_BUYER_ORDER)
  );
}

function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeDocIdSegment(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

// Recrear automáticamente al comprador de prueba TEST-0001 en memoria al arrancar en desarrollo
if (!IS_PRODUCTION) {
  const testEmailNorm = normalizeEmail(TEST_BUYER_EMAIL);
  const testOrderNorm = normalizeOrderNumber(TEST_BUYER_ORDER);
  const testDocId = `${safeDocIdSegment(testEmailNorm)}_${safeDocIdSegment(testOrderNorm)}`;
  devComprasStore.set(testDocId, {
    email: testEmailNorm,
    pedido: TEST_BUYER_ORDER,
    pedidoNormalizado: testOrderNorm,
    fecha: new Date().toISOString(),
    estado: 'aprobado',
    producto: 'Acceso Completo As de Júpiter (Prueba Desarrollo)',
  });
}

// --- Impultienda Webhook Auth & Flexible Payload Parser ---
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyImpultiendaWebhookAuth(
  req: express.Request,
  rawBody: Buffer
): { ok: boolean; reason?: string } {
  const secret = process.env.IMPULTIENDA_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return { ok: false, reason: 'SECRET_NO_CONFIGURADO' };
  }

  // 1) Token directo en query param (?token=... o ?secret=...)
  const queryToken =
    typeof req.query.token === 'string'
      ? req.query.token.trim()
      : typeof req.query.secret === 'string'
        ? req.query.secret.trim()
        : '';
  if (queryToken && timingSafeEqualStr(queryToken, secret)) {
    return { ok: true };
  }

  // 2) Token directo en headers comunes
  const headerCandidates = [
    req.headers['x-webhook-secret'],
    req.headers['x-impultienda-secret'],
    req.headers['x-webhook-token'],
    req.headers['x-api-key'],
    typeof req.headers.authorization === 'string' &&
    req.headers.authorization.toLowerCase().startsWith('bearer ')
      ? req.headers.authorization.slice(7).trim()
      : undefined,
  ];
  for (const val of headerCandidates) {
    if (typeof val === 'string' && val.trim() && timingSafeEqualStr(val.trim(), secret)) {
      return { ok: true };
    }
  }

  // 3) Firma HMAC-SHA256 en headers de firma comunes
  const sigCandidates = [
    req.headers['x-impultienda-signature'],
    req.headers['x-webhook-signature'],
    req.headers['x-hub-signature-256'],
    req.headers['x-signature'],
  ];
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedB64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

  for (const rawSig of sigCandidates) {
    if (typeof rawSig !== 'string' || !rawSig.trim()) continue;
    const cleaned = rawSig.trim().replace(/^sha256=/i, '');
    if (
      timingSafeEqualStr(cleaned.toLowerCase(), expectedHex) ||
      timingSafeEqualStr(cleaned, expectedB64)
    ) {
      return { ok: true };
    }
  }

  return { ok: false, reason: 'FIRMA_O_TOKEN_INVALIDO' };
}

export interface ParsedImpultiendaCompra {
  email: string;
  pedido: string;
  estado: string;
  isPaid: boolean;
  producto: string;
  fecha: string;
}

interface FlatField {
  path: string;
  key: string;
  value: unknown;
}

function collectFlatFields(obj: unknown, prefix = '', depth = 0, out: FlatField[] = []): FlatField[] {
  if (depth > 5 || obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    obj.slice(0, 10).forEach((item, idx) => {
      collectFlatFields(item, `${prefix}[${idx}]`, depth + 1, out);
    });
    return out;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const nextPath = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v !== 'object') {
        out.push({ path: nextPath.toLowerCase(), key: k.toLowerCase(), value: v });
      } else {
        collectFlatFields(v, nextPath, depth + 1, out);
      }
    }
  }
  return out;
}

export function parseImpultiendaPayload(payload: unknown): ParsedImpultiendaCompra | null {
  if (!payload || typeof payload !== 'object') return null;

  const fields = collectFlatFields(payload);

  // Buscar email con prioridad en campos de comprador/cliente
  const emailCandidates: Array<{ score: number; value: string }> = [];
  for (const f of fields) {
    if (typeof f.value !== 'string') continue;
    const trimmed = f.value.trim().toLowerCase();
    if (!isValidEmailFormat(trimmed)) continue;

    let score = 1;
    if (
      f.key.includes('buyer') ||
      f.key.includes('customer') ||
      f.key.includes('comprador') ||
      f.key.includes('client') ||
      f.path.includes('customer') ||
      f.path.includes('buyer') ||
      f.path.includes('comprador')
    ) {
      score += 4;
    }
    if (f.key === 'email' || f.key === 'correo' || f.key === 'mail') {
      score += 3;
    }
    if (f.path.includes('merchant') || f.path.includes('seller') || f.path.includes('tienda')) {
      score -= 3;
    }
    emailCandidates.push({ score, value: trimmed });
  }
  emailCandidates.sort((a, b) => b.score - a.score);
  const email = emailCandidates[0]?.value || '';

  // Buscar número de pedido
  const orderCandidates: Array<{ score: number; value: string }> = [];
  for (const f of fields) {
    if (typeof f.value !== 'string' && typeof f.value !== 'number') continue;
    const rawStr = String(f.value).trim();
    if (!rawStr || rawStr.length > 80) continue;

    let score = 0;
    if (
      f.key === 'order_number' ||
      f.key === 'numero_pedido' ||
      f.key === 'pedido' ||
      f.key === 'order_id' ||
      f.key === 'orderid'
    ) {
      score = 10;
    } else if (
      f.key === 'number' &&
      (f.path.includes('order') || f.path.includes('pedido') || f.path === 'number')
    ) {
      score = 8;
    } else if (
      f.key === 'reference' ||
      f.key === 'code' ||
      f.key === 'codigo' ||
      f.key === 'transaction_id'
    ) {
      score = 6;
    } else if (
      f.key === 'id' &&
      (f.path === 'id' || f.path.includes('order') || f.path.includes('pedido'))
    ) {
      score = 4;
    }

    if (score > 0) {
      orderCandidates.push({ score, value: rawStr });
    }
  }
  orderCandidates.sort((a, b) => b.score - a.score);
  const pedido = orderCandidates[0]?.value || '';

  // Buscar estado del pago
  const statusCandidates: Array<{ score: number; value: string }> = [];
  for (const f of fields) {
    if (typeof f.value === 'boolean' && (f.key === 'paid' || f.key === 'approved' || f.key === 'pagado')) {
      statusCandidates.push({ score: 9, value: f.value ? 'paid' : 'pending' });
      continue;
    }
    if (typeof f.value !== 'string') continue;
    const val = f.value.trim().toLowerCase();
    if (!val || val.length > 40) continue;

    let score = 0;
    if (
      f.key === 'payment_status' ||
      f.key === 'estado_pago' ||
      f.key === 'financial_status' ||
      f.key === 'status' ||
      f.key === 'estado'
    ) {
      score = 10;
    } else if (f.key === 'state' || f.key === 'event' || f.key === 'evento') {
      score = 6;
    }

    if (score > 0) {
      if (PAID_STATUS_KEYWORDS.has(val)) score += 3;
      statusCandidates.push({ score, value: val });
    }
  }
  statusCandidates.sort((a, b) => b.score - a.score);
  const estado = statusCandidates[0]?.value || '';
  const isPaid =
    PAID_STATUS_KEYWORDS.has(estado) ||
    estado.includes('paid') ||
    estado.includes('pagad') ||
    estado.includes('aprobad') ||
    estado.includes('approved');

  // Buscar producto
  let producto = 'Acceso Completo As de Júpiter (17 USD)';
  for (const f of fields) {
    if (typeof f.value !== 'string' || !f.value.trim()) continue;
    if (
      f.key === 'product_name' ||
      f.key === 'producto' ||
      f.key === 'product' ||
      (f.key === 'title' && (f.path.includes('item') || f.path.includes('product'))) ||
      (f.key === 'name' && (f.path.includes('item') || f.path.includes('product')))
    ) {
      producto = f.value.trim().slice(0, 120);
      break;
    }
  }

  if (!email || !pedido) {
    return null;
  }

  return {
    email,
    pedido,
    estado: estado || 'unknown',
    isPaid,
    producto,
    fecha: new Date().toISOString(),
  };
}

// --- Persistencia: en memoria durante desarrollo (!IS_PRODUCTION), Firestore real en producción ---
export async function recordCompraInFirestore(compra: ParsedImpultiendaCompra): Promise<string> {
  const normalizedEmail = normalizeEmail(compra.email);
  const normalizedOrder = normalizeOrderNumber(compra.pedido);
  const docId = `${safeDocIdSegment(normalizedEmail)}_${safeDocIdSegment(normalizedOrder)}`;

  if (!IS_PRODUCTION) {
    devComprasStore.set(docId, {
      email: normalizedEmail,
      pedido: compra.pedido.trim(),
      pedidoNormalizado: normalizedOrder,
      fecha: compra.fecha,
      estado: compra.estado,
      producto: compra.producto,
    });
    return docId;
  }

  const db = getServerFirestore();
  await db
    .collection('compras')
    .doc(docId)
    .set(
      {
        email: normalizedEmail,
        pedido: compra.pedido.trim(),
        pedidoNormalizado: normalizedOrder,
        fecha: compra.fecha,
        estado: compra.estado,
        producto: compra.producto,
      },
      { merge: true }
    );

  return docId;
}

export async function verifyCompraCredentials(
  rawEmail: string,
  rawPedido: string
): Promise<{ found: boolean; email: string; pedido: string; isTest: boolean }> {
  const email = normalizeEmail(rawEmail);
  const pedidoInput = rawPedido.trim();
  const normalizedOrder = normalizeOrderNumber(pedidoInput);

  if (!isValidEmailFormat(email) || !normalizedOrder || normalizedOrder.length > 80) {
    return { found: false, email, pedido: pedidoInput, isTest: false };
  }

  if (isTestBuyerCredentials(email, pedidoInput)) {
    return { found: true, email: TEST_BUYER_EMAIL, pedido: TEST_BUYER_ORDER, isTest: true };
  }

  const expectedDocId = `${safeDocIdSegment(email)}_${safeDocIdSegment(normalizedOrder)}`;

  if (!IS_PRODUCTION) {
    const devCompra = devComprasStore.get(expectedDocId);
    if (devCompra) {
      const status = devCompra.estado.toLowerCase();
      if (
        !status ||
        PAID_STATUS_KEYWORDS.has(status) ||
        status.includes('paid') ||
        status.includes('pagad') ||
        status.includes('aprobad') ||
        status.includes('approved')
      ) {
        return {
          found: true,
          email,
          pedido: devCompra.pedido,
          isTest: false,
        };
      }
    }
    return { found: false, email, pedido: pedidoInput, isTest: false };
  }

  const db = getServerFirestore();

  // Búsqueda directa por ID determinístico primero (O(1))
  const directSnap = await db.collection('compras').doc(expectedDocId).get();
  if (directSnap.exists) {
    const data = directSnap.data() || {};
    const status = String(data.estado || '').toLowerCase();
    if (
      !status ||
      PAID_STATUS_KEYWORDS.has(status) ||
      status.includes('paid') ||
      status.includes('pagad') ||
      status.includes('aprobad') ||
      status.includes('approved')
    ) {
      return {
        found: true,
        email,
        pedido: String(data.pedido || pedidoInput),
        isTest: false,
      };
    }
  }

  // Respaldo: consulta por email por si un registro fue cargado manualmente en Firestore con otro docId
  const querySnap = await db
    .collection('compras')
    .where('email', '==', email)
    .limit(20)
    .get();

  for (const doc of querySnap.docs) {
    const data = doc.data() || {};
    const docOrderNorm = normalizeOrderNumber(String(data.pedido || ''));
    const status = String(data.estado || '').toLowerCase();
    const statusOk =
      !status ||
      PAID_STATUS_KEYWORDS.has(status) ||
      status.includes('paid') ||
      status.includes('pagad') ||
      status.includes('aprobad') ||
      status.includes('approved');

    if (docOrderNorm === normalizedOrder && statusOk) {
      return {
        found: true,
        email,
        pedido: String(data.pedido || pedidoInput),
        isTest: false,
      };
    }
  }

  return { found: false, email, pedido: pedidoInput, isTest: false };
}

export async function getRemainingSpreadsToday(session: BuyerSessionClaims): Promise<number> {
  const fecha = todayUtcKey();
  const key = `${fecha}_${safeDocIdSegment(session.sub)}`;

  if (!IS_PRODUCTION) {
    const used = devDailyUsageStore.get(key) || 0;
    return Math.max(0, MAX_PAID_SPREADS_PER_DAY - used);
  }

  const db = getServerFirestore();
  const snap = await db.collection('uso_diario').doc(key).get();
  const used = snap.exists ? Number(snap.data()?.tiradasTresCartas || 0) : 0;
  return Math.max(0, MAX_PAID_SPREADS_PER_DAY - used);
}

export async function consumePaidThreeCardSpread(
  session: BuyerSessionClaims,
  tema: string
): Promise<
  | { allowed: true; tiradaId: string; tiradasRestantesHoy: number }
  | { allowed: false; tiradasRestantesHoy: 0 }
> {
  const fecha = todayUtcKey();
  const usageId = `${fecha}_${safeDocIdSegment(session.sub)}`;
  const tiradaId = `tir_${crypto.randomBytes(12).toString('hex')}`;
  const nowIso = new Date().toISOString();

  if (!IS_PRODUCTION) {
    const used = devDailyUsageStore.get(usageId) || 0;
    if (used >= MAX_PAID_SPREADS_PER_DAY) {
      return { allowed: false, tiradasRestantesHoy: 0 };
    }
    const nextUsed = used + 1;
    devDailyUsageStore.set(usageId, nextUsed);
    devChatSessionsStore.set(tiradaId, {
      buyerEmail: session.sub,
      mensajesUsados: 0,
      maxMensajes: MAX_CHAT_MESSAGES_PER_SPREAD,
      tema,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return {
      allowed: true,
      tiradaId,
      tiradasRestantesHoy: Math.max(0, MAX_PAID_SPREADS_PER_DAY - nextUsed),
    };
  }

  const db = getServerFirestore();
  const usageRef = db.collection('uso_diario').doc(usageId);
  const chatRef = db.collection('sesiones_chat').doc(tiradaId);

  return db.runTransaction(async (tx) => {
    const usageSnap = await tx.get(usageRef);
    const current = usageSnap.exists ? Number(usageSnap.data()?.tiradasTresCartas || 0) : 0;
    if (current >= MAX_PAID_SPREADS_PER_DAY) {
      return { allowed: false as const, tiradasRestantesHoy: 0 as const };
    }
    const nextCount = current + 1;
    tx.set(
      usageRef,
      {
        buyerEmail: session.sub,
        fecha,
        tiradasTresCartas: nextCount,
        updatedAt: nowIso,
      },
      { merge: true }
    );
    tx.set(chatRef, {
      buyerEmail: session.sub,
      mensajesUsados: 0,
      maxMensajes: MAX_CHAT_MESSAGES_PER_SPREAD,
      tema,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return {
      allowed: true as const,
      tiradaId,
      tiradasRestantesHoy: Math.max(0, MAX_PAID_SPREADS_PER_DAY - nextCount),
    };
  });
}

export async function verifyChatSessionAvailable(
  session: BuyerSessionClaims,
  requestedTiradaId: string | undefined
): Promise<
  | { ok: true; mensajesUsados: number; mensajesRestantes: number }
  | { ok: false; reason: 'CHAT_LIMIT_EXCEEDED' | 'INVALID_SESSION' | 'DAILY_LIMIT_EXCEEDED' }
> {
  const hasExplicitId = typeof requestedTiradaId === 'string' && requestedTiradaId.trim().length > 0;
  const tiradaId = hasExplicitId ? requestedTiradaId.trim() : '';

  if (hasExplicitId && (tiradaId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(tiradaId))) {
    return { ok: false, reason: 'INVALID_SESSION' };
  }

  const fecha = todayUtcKey();
  const usageId = `${fecha}_${safeDocIdSegment(session.sub)}`;

  if (!IS_PRODUCTION) {
    if (!hasExplicitId) {
      const standaloneUsed = devDailyUsageStore.get(`${usageId}_standalone`) || 0;
      if (standaloneUsed >= MAX_PAID_SPREADS_PER_DAY) {
        return { ok: false, reason: 'DAILY_LIMIT_EXCEEDED' };
      }
      return { ok: true, mensajesUsados: 0, mensajesRestantes: MAX_CHAT_MESSAGES_PER_SPREAD };
    }
    let rec = devChatSessionsStore.get(tiradaId);
    if (!rec && /^(tir|chat)_[a-f0-9]{16,32}$/.test(tiradaId)) {
      // El usuario tiene un JWT válido pero el servidor dev se reinició y borró el mapa en memoria: recrear sesión
      const nowIso = new Date().toISOString();
      rec = {
        buyerEmail: session.sub,
        mensajesUsados: 0,
        maxMensajes: MAX_CHAT_MESSAGES_PER_SPREAD,
        tema: 'general',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      devChatSessionsStore.set(tiradaId, rec);
    }
    if (!rec || rec.buyerEmail !== session.sub) {
      return { ok: false, reason: 'INVALID_SESSION' };
    }
    if (rec.mensajesUsados >= rec.maxMensajes) {
      return { ok: false, reason: 'CHAT_LIMIT_EXCEEDED' };
    }
    return {
      ok: true,
      mensajesUsados: rec.mensajesUsados,
      mensajesRestantes: Math.max(0, rec.maxMensajes - rec.mensajesUsados),
    };
  }

  const db = getServerFirestore();
  if (!hasExplicitId) {
    const usageSnap = await db.collection('uso_diario').doc(usageId).get();
    const standaloneUsed = usageSnap.exists ? Number(usageSnap.data()?.chatsIndependientes || 0) : 0;
    if (standaloneUsed >= MAX_PAID_SPREADS_PER_DAY) {
      return { ok: false, reason: 'DAILY_LIMIT_EXCEEDED' };
    }
    return { ok: true, mensajesUsados: 0, mensajesRestantes: MAX_CHAT_MESSAGES_PER_SPREAD };
  }

  const snap = await db.collection('sesiones_chat').doc(tiradaId).get();
  if (!snap.exists) {
    return { ok: false, reason: 'INVALID_SESSION' };
  }
  const data = snap.data() || {};
  if (String(data.buyerEmail || '') !== session.sub) {
    return { ok: false, reason: 'INVALID_SESSION' };
  }
  const maxMensajes = Number(data.maxMensajes || MAX_CHAT_MESSAGES_PER_SPREAD);
  const used = Number(data.mensajesUsados || 0);
  if (used >= maxMensajes) {
    return { ok: false, reason: 'CHAT_LIMIT_EXCEEDED' };
  }
  return {
    ok: true,
    mensajesUsados: used,
    mensajesRestantes: Math.max(0, maxMensajes - used),
  };
}

export async function consumeChatMessageQuota(
  session: BuyerSessionClaims,
  requestedTiradaId: string | undefined,
  tema: string
): Promise<
  | {
      allowed: true;
      tiradaId: string;
      mensajesUsados: number;
      mensajesRestantes: number;
    }
  | {
      allowed: false;
      reason: 'CHAT_LIMIT_EXCEEDED' | 'INVALID_SESSION' | 'DAILY_LIMIT_EXCEEDED';
      mensajesRestantes: 0;
    }
> {
  const nowIso = new Date().toISOString();
  const hasExplicitId = typeof requestedTiradaId === 'string' && requestedTiradaId.trim().length > 0;
  const effectiveTiradaId = hasExplicitId
    ? requestedTiradaId.trim()
    : `chat_${crypto.randomBytes(12).toString('hex')}`;

  if (effectiveTiradaId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(effectiveTiradaId)) {
    return { allowed: false, reason: 'INVALID_SESSION', mensajesRestantes: 0 };
  }

  const fecha = todayUtcKey();
  const usageId = `${fecha}_${safeDocIdSegment(session.sub)}`;

  if (!IS_PRODUCTION) {
    let record = devChatSessionsStore.get(effectiveTiradaId);
    if (!record) {
      if (hasExplicitId && !/^(tir|chat)_[a-f0-9]{16,32}$/.test(effectiveTiradaId)) {
        return { allowed: false, reason: 'INVALID_SESSION', mensajesRestantes: 0 };
      }
      if (!hasExplicitId) {
        const standaloneUsed = devDailyUsageStore.get(`${usageId}_standalone`) || 0;
        if (standaloneUsed >= MAX_PAID_SPREADS_PER_DAY) {
          return { allowed: false, reason: 'DAILY_LIMIT_EXCEEDED', mensajesRestantes: 0 };
        }
        devDailyUsageStore.set(`${usageId}_standalone`, standaloneUsed + 1);
      }
      record = {
        buyerEmail: session.sub,
        mensajesUsados: 0,
        maxMensajes: MAX_CHAT_MESSAGES_PER_SPREAD,
        tema,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }
    if (record.buyerEmail !== session.sub) {
      return { allowed: false, reason: 'INVALID_SESSION', mensajesRestantes: 0 };
    }
    if (record.mensajesUsados >= record.maxMensajes) {
      return { allowed: false, reason: 'CHAT_LIMIT_EXCEEDED', mensajesRestantes: 0 };
    }
    record.mensajesUsados += 1;
    record.updatedAt = nowIso;
    devChatSessionsStore.set(effectiveTiradaId, record);
    return {
      allowed: true,
      tiradaId: effectiveTiradaId,
      mensajesUsados: record.mensajesUsados,
      mensajesRestantes: Math.max(0, record.maxMensajes - record.mensajesUsados),
    };
  }

  const db = getServerFirestore();
  const chatRef = db.collection('sesiones_chat').doc(effectiveTiradaId);
  const usageRef = db.collection('uso_diario').doc(usageId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(chatRef);
    if (!snap.exists) {
      if (hasExplicitId) {
        return {
          allowed: false as const,
          reason: 'INVALID_SESSION' as const,
          mensajesRestantes: 0 as const,
        };
      }
      const usageSnap = await tx.get(usageRef);
      const standaloneUsed = usageSnap.exists ? Number(usageSnap.data()?.chatsIndependientes || 0) : 0;
      if (standaloneUsed >= MAX_PAID_SPREADS_PER_DAY) {
        return {
          allowed: false as const,
          reason: 'DAILY_LIMIT_EXCEEDED' as const,
          mensajesRestantes: 0 as const,
        };
      }
      tx.set(
        usageRef,
        {
          buyerEmail: session.sub,
          fecha,
          chatsIndependientes: standaloneUsed + 1,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      tx.set(chatRef, {
        buyerEmail: session.sub,
        mensajesUsados: 1,
        maxMensajes: MAX_CHAT_MESSAGES_PER_SPREAD,
        tema,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      return {
        allowed: true as const,
        tiradaId: effectiveTiradaId,
        mensajesUsados: 1,
        mensajesRestantes: MAX_CHAT_MESSAGES_PER_SPREAD - 1,
      };
    }

    const data = snap.data() || {};
    if (String(data.buyerEmail || '') !== session.sub) {
      return {
        allowed: false as const,
        reason: 'INVALID_SESSION' as const,
        mensajesRestantes: 0 as const,
      };
    }
    const maxMensajes = Number(data.maxMensajes || MAX_CHAT_MESSAGES_PER_SPREAD);
    const used = Number(data.mensajesUsados || 0);
    if (used >= maxMensajes) {
      return {
        allowed: false as const,
        reason: 'CHAT_LIMIT_EXCEEDED' as const,
        mensajesRestantes: 0 as const,
      };
    }

    const nextUsed = used + 1;
    tx.set(
      chatRef,
      {
        mensajesUsados: nextUsed,
        updatedAt: nowIso,
      },
      { merge: true }
    );
    return {
      allowed: true as const,
      tiradaId: effectiveTiradaId,
      mensajesUsados: nextUsed,
      mensajesRestantes: Math.max(0, maxMensajes - nextUsed),
    };
  });
}
