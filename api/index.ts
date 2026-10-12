import { createApp } from '../server/app.ts';

// Vercel Serverless Function única bajo /api (ver vercel.json rewrite "/api/(.*)" -> "/api/index").
// La sintaxis catch-all [...path].ts solo funciona en Next.js; en Vite se usa este archivo + rewrite.
// Reutiliza la misma app Express de server/app.ts (rutas /api/ai/* y /api/biometrics/*).
const app = createApp();

export default app;
