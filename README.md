# As de Júpiter ♃ — Tarot de Marsella con Luna (IA)

> **As de Júpiter** es una Progressive Web App (PWA) de lecturas simbólicas, reflexivas y de autoconocimiento basadas en la tradición del **Tarot de Marsella**, guiadas por **Luna**, una tarotista de Inteligencia Artificial impulsada por los modelos Gemini de Google.

---

## 🌟 Características Principales

- **Tirada Gratuita de 1 Carta**: Reflexión focalizada con selección temática (*Amor*, *Dinero & Trabajo*, *Futuro & Destino*, *Familia & Hogar*).
- **Lectura Profunda de 3 Cartas**: Tirada completa orientada a *Situación actual*, *Obstáculo o Desafío* y *Consejo & Rumbo*, con síntesis narrativa y consejos prácticos.
- **Chat de Consulta con Luna**: Diálogo interactivo post-lectura para despejar dudas, repreguntar y recibir arcanos complementarios contextuales.
- **Grimorio de los 22 Arcanos Mayores**: Base de conocimiento completa con buscador, simbolismo tradicional, aspectos positivos/desafiantes y consejos detallados por ámbito.
- **Diseño Celestial & Atmosférico**: Paleta nocturna en tonos índigo y oro viejo (`#D4AF37`), animaciones fluidas con `motion` y tipografía *Cinzel* + *Plus Jakarta Sans*.
- **PWA (Progressive Web App)**: Instalable en dispositivos Android, iOS (Safari) y escritorio, con caché de servicio y soporte sin conexión.
- **Arquitectura Segura & Resiliente**:
  - API proxy con Node.js y Express (las claves de API nunca se exponen al cliente).
  - Cascada de modelos Gemini con reintentos exponenciales contra picos de demanda.
  - Motor de contingencia local basado en el dataset de Marsella ante indisponibilidad de red.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons, Vite PWA (`vite-plugin-pwa`).
- **Backend / Servidor**: Node.js, Express, `tsx`, `@google/genai` (Google Gen AI SDK), `esbuild`.
- **Inteligencia Artificial**: Google Gemini API (`gemini-3.7-flash`, `gemini-flash-latest`, `gemini-3.1-flash-lite`).

---

## 🚀 Inicio Rápido (Desarrollo Local)

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/as-de-jupiter.git
cd as-de-jupiter
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto tomando como base `.env.example`:
```bash
cp .env.example .env
```
Edita `.env` e ingresa tu clave de API de Google Gemini:
```env
GEMINI_API_KEY="tu_api_key_de_gemini"
```

### 4. Iniciar en modo desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

---

## 📦 Scripts Disponibles

- `npm run dev`: Inicia el servidor full-stack (Express + middleware Vite en desarrollo) con recarga automática.
- `npm run build`: Compila el cliente estático en `dist/` y empaqueta el servidor Node en `dist/server.cjs` mediante `esbuild`.
- `npm start`: Inicia el servidor compilado de producción (`node dist/server.cjs`).
- `npm run lint`: Ejecuta el chequeo de tipos TypeScript (`tsc --noEmit`).

---

## 🔗 Cómo Conectar este Repositorio a GitHub

1. **Crea un nuevo repositorio en GitHub**:
   - Ingresa a [github.com/new](https://github.com/new).
   - Nómbralo (por ejemplo: `as-de-jupiter`).
   - Puedes dejarlo público o privado. No agregues README, .gitignore ni licencia (ya están creados).

2. **Vincula el repositorio remoto y sube tus cambios**:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/as-de-jupiter.git
   git branch -M main
   git push -u origin main
   ```

---

## 📜 Ética y Declaración de Uso

Las lecturas proporcionadas por **Luna** en **As de Júpiter** son herramientas simbólicas de introspección y crecimiento personal. No constituyen predicciones infalibles ni reemplazan el juicio individual o el asesoramiento legal, médico, financiero o psicológico profesional.
