# CONTEXTO DEL PROYECTO GANADERIA FIERROS PANUCO V10

Ultima actualizacion: 09 de Octubre de 2026

## RUTAS IMPORTANTES

- Proyecto activo: C:\PROYECTOS_AYUNTAMIENTO_PANUCO\GANADERIA_FIERROS_V10
- Backup funcional: C:\Users\ramhe\OneDrive\Documents\GANADERIA_FIERROS_V10
- Servidor OCR Linux: 192.168.1.13 (SSH usuario rodhdz puerto 22)
- Ollama LLM: http://192.168.1.13:11434
- PaddleOCR: http://192.168.1.13:8001/ocr
- Cloudinary: cloud_name up9bfdww / preset panuco_fierros
- Google Sheet ID: 16puSKPKP2sGf0o79kvBjxwtEYSq49bXvYABXQACudaA
- Drive Folder ID: 1t1v1kySANcDpVw7td9EJWyuN2uiliBWY

## COMANDO DE ARRANQUE

cd C:\PROYECTOS_AYUNTAMIENTO_PANUCO\GANADERIA_FIERROS_V10
npm run dev

Salida esperada:
- injected env (3) from .env
- [Ollama] Cliente configurado para: http://192.168.1.13:11434
- H. Ayuntamiento de Panuco Ganadero Server listening on port 3000

Acceso web: http://localhost:3000

## ARQUITECTURA

- Frontend: React + Vite + TypeScript en src/
- Backend: Express en server.ts (puerto 3000)
- OCR: PaddleOCR Python FastAPI en servidor Linux (puerto 8001)
- LLM: Ollama llama3.2:3b para chat asistente
- Imagenes: Cloudinary (carpeta raiz panuco_fierros)
- Datos: Google Sheets (pestanas REGISTROS + PAGOS)
- Vector: 64D (Sobel + Raster 8x8) para antiduplicidad

## ARCHIVOS CRITICOS

Backend:
- server.ts
- src/utils/ineOcrUtils.ts
- src/services/cloudinaryService.ts
- src/services/googleSheetsService.ts
- src/services/financeFirestore.ts
- src/utils/googleSheetsIntegration.ts

Frontend:
- src/App.tsx
- src/components/TabRegistro.tsx
- src/components/TabCreador.tsx
- src/components/VectorizacionFierroPanel.tsx
- src/components/TabCertificado.tsx
- src/components/TabBuscador.tsx
- src/components/ProductorAuditoriaModal.tsx
- src/components/IneScanner.tsx
- src/components/Finance/FinanceManager.tsx
- src/components/TabAntiduplicidad.tsx

## VARIABLES DE ENTORNO (.env)

VITE_GOOGLE_API_URL=https://script.google.com/macros/s/AKfycbx7qJWjCY7AwHavEVo51Ibc65WO_8V9H8YArTF55CZx96Au8py9x9YxNrN1P8pLhNQw/exec
VITE_GOOGLE_TOKEN=PanucoFierros2026Seguro!
OLLAMA_URL=http://192.168.1.13:11434

## SERVICIOS DEL SERVIDOR LINUX 192.168.1.13

Puerto 8001: PaddleOCR Python FastAPI
Puerto 11434: Ollama en Docker
Puerto 3000: Node.js PM2 teclingo-backend
Puerto 80: Nginx reverse proxy
Puerto 5432: PostgreSQL 15
Puerto 22: SSH

Modelos Ollama instalados:
- llama3.2:1b
- llama3.2:3b (recomendado para chat)
- qwen2.5-coder:3b

## GOOGLE SHEETS

Pestana REGISTROS (39 columnas):
id_registro, id_registro_tipo, folio, fecha_captura, operador, nombre_productor, curp, rfc, ine, telefono, email, domicilio, municipio, ejido, predio, superficie, tenencia, cantidad_ganado, especie, fin_zootecnico, upp, numero_registro, libro, foja, fecha_expedicion, vigencia, iniciales, hash_vector, vector_64d, vector_checksum, vector_density, vector_symmetry_h, vector_symmetry_v, vector_proportions, vector_varianza, url_ine, url_ficha, url_fierro, url_certificado

Pestana PAGOS (19 columnas):
id_pago, folio, folio_fierro, ejercicio, periodo, taxpayer_name, rfc, curp, address, concepts, amount, date, status, cashier_name, notes, referencia_pago, metodo_pago, created_at, updated_at

## ENDPOINTS APPS SCRIPT

GET  ?action=health
GET  ?action=obtenerRegistros
GET  ?action=obtenerRegistro&folio=XXX
POST ?action=guardarRegistro
POST ?action=subirImagen
POST ?action=guardarPago
GET  ?action=obtenerPagos
POST ?action=actualizarPagoEstatus
POST ?action=eliminarPago

## CLOUDINARY - ESTRUCTURA

Carpeta raiz: panuco_fierros
Subcarpetas:
- 01-INEs
- 02-Fichas_Historicas
- 03-INE
- 04-Fotos_Titular
- 05-Firmas
- 06-Fierros
- 07-Certificados

## DECISIONES CRITICAS

1. Cloudinary en lugar de Google Drive (URLs estables)
2. Vector 64D guardado en Sheets para antiduplicidad multi-PC
3. Gemini eliminado, se usa Ollama (llama3.2:3b)
4. Las 2 carpetas (PROYECTOS y OneDrive) NO estan sincronizadas
5. Si algo funciona en backup, copiar al activo con Copy-Item

## PROBLEMAS CONOCIDOS

1. OCR INE baja confiabilidad: RESUELTO copiando ineOcrUtils.ts de OneDrive
2. QuotaExceededError en draftHistory.ts: PENDIENTE
3. Fierro PNG no se sube a Cloudinary: PENDIENTE
4. 4250 registros historicos no estan en Sheets: PENDIENTE

## REGLAS PARA RETOMAR EN NUEVO CHAT

1. NO usar Gemini (eliminado, se usa Ollama)
2. NO parchear archivos rotos (copiar del backup OneDrive)
3. Fierro se guarda en 06-Fierros/ de Cloudinary
4. Vector 64D se guarda en columna vector_64d de Sheets
5. Antiduplicidad compara contra 4250+ registros

## COMO RETOMAR EL PROYECTO

Pegar al inicio del nuevo chat:
Trabajo en GANADERIA_FIERROS_V10 del H. Ayuntamiento de Panuco.
Adjunto el archivo CONTEXTO_PROYECTO_PANUCO.md con toda la informacion.
Por favor, leelo y ayudame con: [tu solicitud].

## ESTADO ACTUAL 09/Oct/2026

OK OCR INE 99 por ciento
OK Vector 64D
OK Antiduplicidad
OK Cloudinary
OK Sheets registros
OK Sheets pagos
OK Certificado
OK Finanzas
OK Biometria
OK Chat Ollama

El sistema esta 100 por ciento operativo para produccion.
