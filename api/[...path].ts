import { createApp } from '../server/app.ts';

// Vercel Serverless Function (catch-all bajo /api/*)
// Reutiliza la misma app Express de server/app.ts (rutas /api/ai/* y /api/biometrics/*).
const app = createApp();

export default app;
