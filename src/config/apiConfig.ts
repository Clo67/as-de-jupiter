/**
 * Configuración de conexión con el Backend (Cloudflare Worker)
 *
 * INSTRUCCIONES:
 * 1. Publicá el archivo `worker.js` en Cloudflare Workers (seguí la guía en GUIA_CLOUDFLARE.md).
 * 2. Copiá la URL que te da Cloudflare (ejemplo: 'https://as-de-jupiter-api.tu-usuario.workers.dev').
 * 3. Pegala abajo entre las comillas de API_BASE_URL (sin barra "/" al final).
 *
 * Nota: Si queda vacío '', la app usa el servidor integrado cuando se prueba en AI Studio o en local.
 */
export const API_BASE_URL: string =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL || '';
