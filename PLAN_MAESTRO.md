# 🐂 PLAN MAESTRO — Sistema Municipal de Registro de Fierro Quemador
### H. Ayuntamiento Constitucional de Pánuco, Ver.

> **Propósito de este documento:** es la fuente única de contexto. Si eres una IA
> (o un desarrollador) retomando el proyecto, lee **este archivo completo primero**.
> Con esta lectura debes saber dónde está todo, cómo se despliega y qué sigue,
> sin tener que explorar el código. Se actualiza al cierre de cada sesión.

- **Última actualización:** 15/Oct/2026
- **Versión del plan:** V4.0
- **Repositorio:** `https://github.com/Concetosai/manejo_agropecuario_mun.git` (rama `main`)
- **Producción:** `https://manejo-agropecuario-mun.vercel.app`
- **Carpeta local:** `C:\PROYECTOS_AYUNTAMIENTO_PANUCO\GANADERIA_FIERROS_V10`
- **Idioma de trabajo y de respuesta con el usuario:** **Español**.

---

## 1. ¿Qué es esta aplicación?

Sistema web para el **registro, control y emisión de certificados oficiales del Fierro
Quemador y Señal de Sangre** ganadero del municipio de Pánuco, Veracruz.

Módulos principales:
1. **Registro (Alta / Nuevo Expediente)** — captura de datos del productor, predio, fierro, evidencias (INE, foto, firma, fierro) y validación.
2. **Creador de Fierro** — diseñador gráfico del fierro (vectorial) y su vectorización 64D.
3. **Buscador / Padrón Pecuario Municipal** — consulta multi‑criterio, comparación de similitud, apertura de expediente y escaneo de QR.
4. **Anti‑duplicidad** — detección en tiempo real por nombre/CURP/INE y por vector/similitud de fierro.
5. **Certificado** — vista previa y modo consolidado/PDF con QR de verificación.
6. **Reportes, Auditoría, Configuración y Digitalización Histórica.**
7. **Finanzas / Trámites** — órdenes de cobro, recibos con sello PAGADO, y los 5 trámites (Alta, Revalidación, Baja, Constancia, Degüello).
8. **Verificación pública por QR** — página sin login que valida un certificado escaneado.

---

## 2. Stack y arquitectura

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4.
- **Backend de producción:** función serverless en `api/app.ts` (Express) desplegada en **Vercel**.
- **Backend local:** `server.ts` (arranca en puerto `3000`, ver `server.ts:15`) que monta `server/app.ts`. **Solo para desarrollo local.**
- **Routing en producción (`vercel.json`):**
  - `/api/(.*)` → `/api/index` → `api/index.ts` → `api/app.ts` (función serverless, `maxDuration: 60`, `memory: 1024`).
  - `/((?!api/).*)` → `/index.html` (SPA fallback).
- **Persistencia:** Google Sheets vía Apps Script (`Google_docs/code.gs`) + `localStorage` (cache/offline) + **Cloudinary** (imágenes) + opcional Firebase Firestore (no configurado en prod).
- **IA/OCR:** Groq, PaddleOCR (LAN), Google Gemini, Tesseract.js.

> ⚠️ **Importante:** `api/app.ts` (producción) y `server/app.ts` (local) están **divergidos** (~900 líneas). El OCR que corre en producción es siempre `api/app.ts`.

---

## 3. Despliegue y entornos

### Flujo de trabajo
1. Editar código.
2. `npm run lint` (tsc) + `npm test` + `npm run build`.
3. `git add` → `git commit` → `git push origin main`.
4. **Vercel despliega automáticamente** desde `main`. Verificar con `vercel ls` y probar la URL de producción.

### Git
- Remoto: `Concetosai/manejo_agropecuario_mun`.
- Usuario git: `bachilleresaiapp6-cmyk`.
- Helper de credenciales: `manager` (GCM) + `wincred`. `gh` **no** está instalado.
- `git push` puede requerir reautenticación; si da 403, borrar credencial de wincred/GCM.

### Vercel
- CLI 51.8.0, sesión como `concetosai`.
- Proyecto vinculado: `manejo-agropecuario-mun` (`.vercel/project.json`, ignorado por git).
- Comandos útiles: `vercel ls`, `vercel logs --environment production`, `vercel env ls`, `vercel env pull`.
- Las variables `GROQ_API_KEY` y `GEMINI_API_KEY` en Vercel son **Sensitive** (no se pueden leer con `env pull`, devuelven `""`).

---

## 4. Variables de entorno

`.env` (local, **gitignored** por `.gitignore:7:.env*`):
```
VITE_GOOGLE_API_URL=<Apps Script /exec>
VITE_GOOGLE_TOKEN=<token de Apps Script>   # ⚠️ pendiente rotar por filtración
OLLAMA_URL=<opcional, NO usado en prod>
GROQ_API_KEY=<...>       # Válida, pero SIN modelo de visión en la cuenta
GEMINI_API_KEY=<...>     # Válida; models: gemini-3.1-flash-lite OK, gemini-3.8-flash a veces 503
```
- `.env.example` está rastreado y **no** contiene secretos.
- No hay `VITE_FIREBASE_*` en producción → **Firestore deshabilitado en prod** (se usa Google Sheets).
- ⚠️ **Seguridad pendiente:** hay un token filtrado en `CONTEXTO_PROYECTO_PANUCO.md` (rastreado por git) → rotar/quitar.

---

## 5. Mapa de archivos clave

### Raíz
| Archivo | Rol |
|---|---|
| `index.html` | HTML base de la SPA. |
| `vite.config.ts` | Config Vite. |
| `tsconfig.json` | TS. El `lint` (`tsc --noEmit`) **incluye `api/`** además de `src/`. |
| `vercel.json` | Framework, build, rewrites, límites de la función. |
| `server.ts` | Servidor Express local (puerto 3000). |
| `api/index.ts` | Entrypoint serverless → `createApp()` de `api/app.ts`. |
| `api/app.ts` | **Backend de producción** (rutas OCR, IA, etc.). |
| `Google_docs/code.gs` | Apps Script (Google Sheets). ⚠️ **Pendiente redeploy.** |
| `package.json` | Scripts (`lint`, `test`, `build`, `dev`). |

### `src/`
| Archivo | Rol |
|---|---|
| `src/main.tsx` | Entrada. Decide `VerificacionPublica` (si `?verificar=`) vs `<App />`. |
| `src/App.tsx` | Orquestador: tabs, navegación, sesión de operador, sincronización, handler del certificado. |
| `src/types/index.ts` | Todos los tipos (`ProducerData`, `HistoricalRecord`, `MunicipalUser`, etc.). |

### `src/components/` (principales)
- **Tabs:** `TabRegistro`, `TabCreador`, `TabBuscador`, `TabAntiduplicidad`, `TabCertificado`, `TabReportes`, `TabAuditoria`, `TabConfiguracion`, `TabDigitalizacionHistorica`.
- **Certificado:** `TabCertificado.tsx` (incluye generación del **QR** e imagen real del fierro).
- **Evidencias/Portafolio:** `ProductorAuditoriaModal.tsx` (lee INE/foto/firma/fierro/recibo con prioridad de URLs).
- **Fierro:** `Creador` + `ImportarImagenFierro.tsx` + `VectorizacionFierroPanel.tsx` + `VectorComparisonModal.tsx` + `AntiduplicidadModal.tsx`.
- **Captura:** `IneScanner.tsx` (OCR INE), `PhotoCaptureModal.tsx`, `SignaturePad.tsx`, `QrScannerModal.tsx` (escáner QR con cámara).
- **Verificación:** `VerificacionPublica.tsx` (**nuevo**, página pública del QR).
- **Finanzas:** `Finance/FinanceManager.tsx`, `Finance/ConfirmarPagoModal.tsx`.
- **Trámites:** `Hub/ProceduresHub.tsx`, `Views/{RevalidacionView,BajaFierroView,ConstanciaView,DeguelloView}.tsx`.
- **Otros:** `Navbar.tsx`, `FloatingAIAssistant.tsx`, `AuthModal.tsx`, `DocumentDispatchSection.tsx`, `TexasGuillocheCertificateBorder.tsx`, `PanucoMunicipalLogo.tsx` (escudo en SVG — placeholder, pendiente subir el oficial), `FichaRegistroTradicional.tsx`, `ValidationErrorsModal.tsx`, `MissingFieldsModal.tsx`, `VersionHistoryModal.tsx`.

### `src/utils/` y `src/services/`
- **`qrVerification.ts`** (nuevo): payload del QR, checksum, URL pública, decodificación y extracción de folio.
- `database.ts` (merge Sheets+local), `googleSheetsIntegration.ts` (sync), `localFierrosStorage.ts` (localStorage), `auditAuth.ts` (sesión/auditoría), `brandVectorization.ts` (vector 64D), `canvasRenderer.ts`, `guilloche.ts`, `pdfGenerator.ts`, `pdfOrdenCobro.ts`, `formValidation.ts`, `numberingConfig.ts`, `similarity.ts`, `catalogs.ts`, `reportsData.ts`, `preferences.ts`, `draftHistory.ts`, `historicalDocumentOcr.ts`, `ineOcrUtils.ts`.
- `services/`: `cloudinaryService.ts`, `googleSheetsService.ts`, `financeCatalogService.ts`, `financeFirestore.ts`, `biometricsService.ts`.

> ℹ️ Hay **muchos archivos `.bak-*`** (copias de seguridad de sesiones anteriores) en el repo. No forman parte del build; conviene limpiarlos algún día.

---

## 6. Persistencia de datos

1. **Google Sheets** (fuente de verdad) a través de Apps Script (`Google_docs/code.gs`).
   - Endpoints expuestos vía `VITE_GOOGLE_API_URL` + `VITE_GOOGLE_TOKEN`.
2. **localStorage** — cache del padrón (`getMunicipalDatabase`, `getLocalFierros`) para operar con baja conectividad.
3. **Cloudinary** — imágenes: INE, foto titular, firma, fierro digitalizado, recibo, certificado. Las URLs se persisten en el registro (`url_ine`, `url_foto_titular`, `url_firma`, `url_fierro`, `url_recibo_cloudinary`, `url_certificado`, `url_certificado_imagen`).
4. **Firebase Firestore** — opcional, **no configurado en producción**.

**Prioridad de imagen del fierro (consistente en toda la app):**
`url_fierro → fierroImageUrl → imagenes.fierro_digitalizado → extractedBrandImage → imagen_base64`.

---

## 7. Flujos principales

### 7.1 Registro / Alta
Captura de datos → validación (`formValidation.ts`) → evidencias (INE con OCR, foto, firma, fierro) → guardado en Sheets + subida diferida a Cloudinary → redirección al **Certificado** (FASE 0.1).

### 7.2 Creador de Fierro
Diseño gráfico → vectorización 64D (`brandVectorization.ts`) → checksum `VEC64-XXXXXXXX-XXXXXXXX` → comparación de similitud para anti‑duplicidad.

### 7.3 Buscador / Padrón
Consulta multi‑criterio → tabla con miniaturas **reales** del fierro → "Comparar Similitud" → "Auditar Expediente" (`ProductorAuditoriaModal`) → **Acceso rápido por QR** (`QrScannerModal`).

### 7.4 Certificado
Vista previa / **modo consolidado (PDF)**. Incluye la imagen real del fierro, sellos, y el **QR de verificación** (ver §9).

### 7.5 Finanzas / Trámites
Órdenes de cobro → recibo con **sello PAGADO** → foto del recibo a Cloudinary → portafolio de evidencias.

### 7.6 Ciclo del operador (FASE 0.4)
Al cerrar un registro: limpieza de borradores, reset de preloads de finanzas, retorno al hub.

---

## 8. OCR / Inteligencia Artificial (solo en `api/app.ts`)

Orden de motores por ruta:
- **`/api/ai/scan-ine`:** Groq → PaddleOCR (LAN `192.168.1.13:8001`) → Gemini → Tesseract.
- **`/api/ai/scan-historical`:** Gemini → Paddle → Tesseract.
- **`/api/ai/vectorize-fierro`:** matemática local (Gemini heráldico opcional).
- **`/api/ai/assistant`:** Gemini.

Claves y estado real:
- **Groq:** clave válida, pero la cuenta **no tiene modelo de visión** → ese motor está muerto (se omite en Vercel).
- **Gemini:** `gemini-3.1-flash-lite` funciona; `gemini-3.8-flash` a veces da `503` por saturación. Candidatos actuales: `gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`.
- **PaddleOCR:** servicio en **LAN**; **omitido en Vercel** (no alcanzable).
- **Tesseract.js:** **no funciona en Vercel** (falta el `.wasm` en serverless) → omitido con guard `IS_VERCEL`.

### 🔒 Blindaje anti‑504 (aplicado)
- `const IS_VERCEL = Boolean(process.env.VERCEL)`.
- PaddleOCR se omite en Vercel.
- En los loops de Gemini (scan-ine y scan-historical) se envuelve la llamada en `withTimeout(promise, 30000)` y se corta por **presupuesto de 52s** (`GEMINI_OCR_BUDGET_MS`) → nunca se llega al límite de 60s de Vercel.
- Cliente `IneScanner.tsx`: maneja respuestas no‑JSON / HTTP de error con mensaje amigable.

> **Gotcha PowerShell:** interpolar `${m}` en URLs (no `$m:...`, que rompe el scope de variable).

---

## 9. Sistema QR y Verificación Pública 🆕

### 9.1 Generación (QR real)
`TabCertificado.tsx` genera el QR con la librería `qrcode`, codificando una **URL pública de verificación**:

```
https://<host>/?verificar=<token>
```

El `<token>` es un **Base64URL** de un JSON compacto (`src/utils/qrVerification.ts`):

```json
{
  "v": 1,
  "f": "PAN-2026-04290",         // folio oficial
  "r": "REG-HAYTO-4290",         // número de registro
  "t": "AGUILAR TELLO BLANCA ISABEL",
  "c": "AUTV910616MVZGLL06",     // CURP
  "p": "BALN",                    // predio
  "u": "14-514-5840-540",        // clave UPP
  "e": "2026-10-15",             // expedición
  "g": "2026 - 2029",            // vigencia
  "i": "https://res.cloudinary.com/.../fierro.png",  // opcional
  "s": "XXXXXXXXYYYYYYYY"        // checksum de integridad
}
```

### 9.2 Verificación pública
- `src/main.tsx` detecta `?verificar=` y renderiza `VerificacionPublica.tsx` **sin login**.
- Muestra sello **"CERTIFICADO VÁLIDO"** (verde) o **"CÓDIGO NO VÁLIDO"** (rojo) según el checksum, más los datos y la imagen del fierro.
- Funciona en **celular y PC**: cualquier cámara que abra la URL.

### 9.3 Escaneo dentro de la app
- `QrScannerModal.tsx` (librería `html5-qrcode`) abre la cámara, detecta el QR y extrae el folio con `extractFolioFromScan()` (soporta URL con token, JSON, token directo o folio en texto).
- Se abre desde el Buscador ("Acceso Rápido por Código QR") y abre el expediente del productor.
- **Robustez:** intenta cámara trasera → frontal → lista de dispositivos; botones "Reintentar cámara" y "Cambiar cámara"; mensajes de error claros (permisos, sin cámara, en uso, HTTPS); alternativa de subir imagen.
- ⚠️ La cámara requiere **contexto seguro**: HTTPS (producción lo es) o `localhost`.

### 9.4 ¿Se requiere columna en la BD o Cloudinary?
**No es obligatorio.** El QR es **autónomo (self‑contained)**: los datos y la firma de
integridad viajan dentro del propio código, así que la verificación pública no depende
de la base de datos. **Opcionalmente** se puede:
- Guardar el PNG del QR en Cloudinary y persistir `url_qr` en la hoja (respaldo/reimpresión), y/o
- Añadir un endpoint `verificarFolio` en Apps Script para verificar **en vivo** contra el padrón (detectar cancelaciones/revalidaciones).

---

## 10. Comandos y convenciones

```bash
npm run dev      # servidor local (tsx server.ts, puerto 3000)
npm run lint     # tsc --noEmit (valida src/ y api/)
npm test         # tsx --test src/utils/__tests__/*.test.ts  (15 pruebas)
npm run build    # vite build
```

- **No** agregar comentarios innecesarios; seguir el estilo y los patrones existentes.
- Cada módulo usa constantes `FIX_*` / `P4-QR` / `FASE_*` para marcar cambios (convención del repo).
- Los textos de la app van en **español** con acentos correctos.

---

## 11. Estado actual (checklist)

### ✅ Completado
- **FASE 2 Bloques A–G** y **FASE 0.1 – 0.4** (ciclo del operador) — 100%.
- Tarjeta "Recibo de Pago (Sellado)" en evidencias; botón "Ver/Cargar" eliminado; `TabCertificado` con **imagen real** del fierro.
- README.md corregido.
- **Despliegue seguro a Vercel** funcionando (commit `a5008e7`).
- **Blindaje OCR anti‑504** desplegado y verificado (commit `0dcea8e`, `c33ba89`): scan-ine responde HTTP 200 con JSON limpio.
- **Miniatura real del fierro en el Buscador** (commit `f479769`): usa la misma prioridad de URL que el certificado y las evidencias.
- **Sistema QR real + Verificación Pública + escáner robusto (cámara PC/celular)** — implementado en esta sesión.

### ⏳ Pendiente / Bloqueado
- **Redesplegar `code.gs`** en Apps Script (para que `url_certificado_imagen` persista).
- **Rotar token** filtrado en `CONTEXTO_PROYECTO_PANUCO.md`.
- `.gitignore` local ya incluye `.vercel` (hecho).
- Limpieza futura de archivos `.bak-*`.
- **P3** WhatsApp/Email del recibo desde Finanzas (~1 hr).
- **P6** Reabrir ciclo desde Finanzas (~1 hr).
- **P7** Ajustes de calidad del certificado (acentos, `SIMBAD`→`SINIIGA`, formato fechas, QR duplicado en páginas 1 y 2).
- **P10** Firmas reales del Director y Tesorero en la credencial CR‑80.
- Escudo municipal oficial (hoy es placeholder SVG en `PanucoMunicipalLogo.tsx`).
- **FASE 5** Bloqueo post‑recibo · **FASE 6** Portafolio unificado · **FASE 7** Testing E2E.

---

## 12. Backlog de propuestas (P8–P16)

| # | Propuesta | Notas |
|---|-----------|-------|
| P8 | Endpoint `verificarFolio` en Apps Script | Verificación **en vivo** del QR (complementa §9). |
| P9 | Mejoras del escáner QR | Vibración, historial, compartir folio. |
| P10 | Firmas reales Director/Tesorero | Imágenes en `municipalConfig`. |
| P11 | Exportación masiva de certificados (ZIP) | Por ejido / año / filtro. |
| P12 | Notificaciones push de refrendo | Cron Apps Script + WhatsApp Business. |
| P13 | Mapa interactivo del padrón | Requiere coordenadas GPS. |
| P14 | Dashboard analítico | Altas/mes, recaudación, estados. |
| P15 | Offline robusto | Service Worker + IndexedDB. |
| P16 | Multi‑usuario con roles | Restricciones reales por rol. |

---

## 13. Gotchas / lecciones aprendidas

1. **Producción ≠ local:** el OCR real vive en `api/app.ts`, no en `server/app.ts`.
2. **tsc incluye `api/`:** cualquier cambio en `api/app.ts` debe pasar `npm run lint`.
3. **PowerShell:** usar `${var}` al interpolar en strings con `:`.
4. **Vercel runtime:** nada que dependa de WASM (Tesseract) ni de LAN (Paddle) funciona allí.
5. **Gemini 503:** es saturación transitoria; el fallback de modelos lo cubre.
6. **Claves en Vercel son Sensitive:** no se pueden leer; no perderlas.
7. **QR autónomo:** no depende de BD ni Cloudinary para verificar.
8. **`.bak-*` por doquier:** tener cuidado al hacer búsquedas globales (ruido).
9. **Regla 403 al push:** limpiar credencial wincred/GCM y reautenticar.
10. **Regla 504 en Vercel:** límite de 60s → usar presupuestos de tiempo (`withTimeout`).

---

## 14. Changelog reciente

| Fecha | Commit | Descripción |
|-------|--------|-------------|
| 15/Oct/2026 | *(pendiente)* | Sistema QR real + Verificación Pública + escáner robusto (PC/celular). |
| 15/Oct/2026 | `f479769` | Miniatura real del fierro (Cloudinary) en la tabla del Buscador. |
| 15/Oct/2026 | `c33ba89` | Blindaje OCR anti‑504 (withTimeout + presupuesto Gemini; Paddle omitido en Vercel; cliente tolerante). |
| 15/Oct/2026 | `0dcea8e` | Evitar 504 en OCR de Vercel y robustecer fallback Gemini. |
| — | `a5008e7` | Grandes cambios de certificado/Evidencias + despliegue inicial a Vercel. |

---

## 15. Cómo continuar (para la próxima sesión)

1. Leer este documento.
2. `git pull` y `npm install` si hace falta.
3. Verificar producción (`vercel ls`; abrir la URL; probar el QR).
4. Revisar §11 (Pendiente) y §12 (Backlog); el usuario prioriza.
5. Recordar: **hablar en español**, **no tocar `server/app.ts` para cambios de producción**, y **commitear+pushear** solo cuando se pida.

> Nota: los archivos `CONTEXTO_PROYECTO_PANUCO.md` y
> `CONTEXTO_PROYECTO_PANUCO_plan_maestro.txt` son **históricos** (V3.3, 11/Oct/2026).
> Este `PLAN_MAESTRO.md` es la versión vigente.
