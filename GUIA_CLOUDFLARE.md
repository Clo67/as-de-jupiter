# Guía paso a paso: Cómo publicar el servidor de Luna en Cloudflare Workers (sin saber programar)

GitHub Pages solo sirve páginas estáticas (no puede guardar claves secretas ni ejecutar inteligencia artificial). Para que **As de Júpiter** funcione en `https://clo67.github.io/as-de-jupiter/`, vamos a publicar el archivo **`worker.js`** en **Cloudflare Workers** (es gratis y te permite guardar tu clave `GEMINI_API_KEY` de forma segura).

---

## Paso 1: Conseguir tu clave de Gemini (si todavía no la tenés copiada)
1. Entrá a **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)** con tu cuenta de Google.
2. Hacé clic en **"Create API key"** (o copiá la que ya tengas creada).
3. Guardala momentáneamente en un bloc de notas (empieza con `AIza...`). **No la compartas ni la pegues en GitHub.**

---

## Paso 2: Crear una cuenta gratuita en Cloudflare
1. Entrá a **[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)**.
2. Registrate con tu email y una contraseña (el plan **Free** alcanza perfectamente; no hace falta poner tarjeta para usar Workers).
3. Verificá tu correo electrónico si te lo pide.

---

## Paso 3: Crear tu Worker
1. En el menú de la izquierda de Cloudflare, hacé clic en **Workers & Pages** (o **Compute (Workers)** → **Workers & Pages**).
2. Hacé clic en el botón azul **Create** (o **Create application**).
3. Elegí **Start with Hello World!** (o **Create Worker**).
4. En **Name**, escribí un nombre fácil, por ejemplo: `as-de-jupiter-api`.
5. Hacé clic en **Deploy** (abajo a la derecha).
6. Esperá unos segundos hasta que aparezca la pantalla de éxito y luego hacé clic en **Edit code** (arriba a la derecha).

---

## Paso 4: Pegar el código de `worker.js`
1. En el editor de Cloudflare que se abrió, vas a ver un código corto de ejemplo (`export default ...`). **Seleccionalo todo y borralo** para que quede la pantalla en blanco.
2. Abrí el archivo **`worker.js`** de tu repositorio en GitHub:
   - Entrá a `https://github.com/Clo67/as-de-jupiter/blob/main/worker.js`
   - Hacé clic en el ícono de **copiar** (los dos cuadraditos arriba a la derecha del código, *Copy raw file*).
3. Volvé a la pestaña de Cloudflare y **pegá** todo el contenido dentro del editor en blanco.
4. Hacé clic en el botón azul **Deploy** (arriba a la derecha) para guardar y publicar.

---

## Paso 5: Cargar `GEMINI_API_KEY` como "Secret" (clave privada)
1. Salí del editor haciendo clic en la flechita de volver (arriba a la izquierda, junto al nombre `as-de-jupiter-api`).
2. Entrá a la pestaña **Settings** (Configuración) de tu Worker.
3. Bajá hasta la sección **Variables and Secrets**.
4. Hacé clic en **+ Add**.
5. Completá así:
   - **Type**: elegí **Secret** (¡muy importante para que quede encriptada y oculta!).
   - **Variable name**: escribí exactamente `GEMINI_API_KEY` (todo en mayúsculas y con guiones bajos).
   - **Value**: pegá tu clave de Gemini (`AIza...`).
6. Hacé clic en **Deploy** / **Save** para aplicar el secreto.

> **Opcional (recomendado si querés que el límite de 5 cartas por día se recuerde entre todos los servidores de Cloudflare):**
> En Cloudflare → menú izquierdo **Storage & Databases** → **KV** → **Create a namespace** (nombre: `RATE_LIMIT_KV`). Luego volvé a tu Worker → **Settings** → **Bindings** → **+ Add** → **KV Namespace** → Variable name `RATE_LIMIT_KV` → elegí el namespace creado y guardá. *(Si no hacés esto, el Worker igual funciona con memoria interna).*

---

## Paso 6: Probar que el Worker responde
1. En la pantalla principal de tu Worker en Cloudflare, mirá arriba donde dice **Visit** o **Preview URL** (por ejemplo: `https://as-de-jupiter-api.tu-usuario.workers.dev`).
2. Abrí esa URL en tu navegador agregándole `/api/health` al final:
   ```
   https://as-de-jupiter-api.tu-usuario.workers.dev/api/health
   ```
3. Si todo está bien, vas a ver en pantalla algo así:
   ```json
   {"status":"ok","service":"As de Júpiter - Luna Tarot Worker","geminiConfigured":true}
   ```
   Confirmá que diga `"geminiConfigured":true`.

---

## Paso 7: Conectar el Frontend de GitHub Pages con tu Worker
1. Abrí en GitHub el archivo **`src/config/apiConfig.ts`** (`https://github.com/Clo67/as-de-jupiter/blob/main/src/config/apiConfig.ts`).
2. Hacé clic en el ícono del **lápiz** (*Edit this file*).
3. Cambiá la última línea para poner la URL de tu Worker (sin `/` al final):
   ```ts
   export const API_BASE_URL: string = 'https://as-de-jupiter-api.tu-usuario.workers.dev';
   ```
4. Hacé clic en **Commit changes...** → **Commit changes**.
5. Esperá 1 o 2 minutos a que termine el despliegue en la pestaña **Actions** de GitHub.
6. Entrá a `https://clo67.github.io/as-de-jupiter/` y probá pedir una carta gratis.
