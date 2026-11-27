/**
 * Configuración de conexión con el Backend
 *
 * - Si publicas con el botón "Publish" de AI Studio o pruebas en desarrollo local,
 *   deja API_BASE_URL vacío '' para usar el servidor Express integrado en el mismo dominio.
 * - Si en el futuro usas un hosting estático externo (como GitHub Pages), pega aquí
 *   la URL de tu Cloudflare Worker (sin barra "/" al final).
 */
export const API_BASE_URL: string =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL || '';
