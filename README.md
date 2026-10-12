# Sistema Municipal de Registro de Fierro Quemador — H. Ayuntamiento de Pánuco, Ver.

Aplicación de la Dirección de Fomento Agropecuario para el registro, digitalización,
antiduplicidad y certificación de Fierros de Herrar y Señales de Sangre.

## Arquitectura

- **Frontend:** React 19 + Vite + TypeScript + Tailwind 4 (`src/`).
- **Backend local:** Express en `server.ts` (puerto 3000), que monta la app de `server/app.ts`.
- **Datos:** Google Apps Script (hojas `REGISTROS` y `PAGOS`) y Firebase/Firestore para finanzas.
- **Almacenamiento de imágenes:** Cloudinary.
- **API interna (`/api`):** asistente IA, OCR de INE, OCR histórico, vectorización 64D y biométricos.

## Desarrollo local

**Requisitos:** Node.js 20+

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Crea `.env` a partir de `.env.example` y define:
   ```env
   VITE_GOOGLE_API_URL=<url del Apps Script>
   VITE_GOOGLE_TOKEN=<token>
   OLLAMA_URL=http://192.168.1.13:11434
   # Opcional (habilita IA/OCR multimodal y análisis heráldico):
   GEMINI_API_KEY=<tu_api_key>
   ```
3. Arranca:
   ```bash
   npm run dev
   ```
   Acceso en http://localhost:3000

## Despliegue en Vercel

El proyecto está preparado para Vercel con frontend estático (Vite) y una función
serverless que reutiliza la app Express (`api/[...path].ts` → `server/app.ts`).

### 1. Variables de entorno (Vercel → Project → Settings → Environment Variables)

Necesarias en **build** (las `VITE_*` se incrustan en el bundle):

| Variable | Descripción |
|---|---|
| `VITE_GOOGLE_API_URL` | URL de ejecución del Google Apps Script |
| `VITE_GOOGLE_TOKEN` | Token de acceso al Apps Script |
| `VITE_FIREBASE_*` | Configuración de Firebase (si se usa Firestore) |

Opcionales para las funciones `/api`:

| Variable | Descripción |
|---|---|
| `GEMINI_API_KEY` | Habilita el asistente IA y OCR multimodal |
| `PADDLE_OCR_URL` | Endpoint PaddleOCR (por defecto LAN 192.168.1.13; no accesible desde Vercel) |

### 2. Configuración

- `vercel.json` ya define `framework: vite`, `buildCommand: npm run build`,
  `outputDirectory: dist` y `maxDuration: 60s` para las funciones.
- No requiere configuración manual adicional: importa el repositorio en Vercel y despliega.

### Limitaciones en serverless

- `PADDLE_OCR_URL` apunta a la red local del municipio; en Vercel no es alcanzable,
  por lo que el OCR cae a Gemini o Tesseract.
- Tesseract puede ser lento en arranque en frío. El límite de cuerpo de las funciones
  de Vercel es ~4.5 MB (comprime las imágenes antes de enviarlas).
- Los biométricos usan memoria en proceso; WebAuthn opera del lado del cliente.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Express + Vite) |
| `npm run build` | Build de producción a `dist/` |
| `npm run preview` | Vista previa del build |
| `npm run lint` | Verificación de tipos (`tsc --noEmit`) |
| `npm test` | Pruebas unitarias (`tsx --test`) |
