// Vercel Serverless Function unica bajo /api
// NO llama createApp() al cargar (evita crash si algun import pesado falla).
// En su lugar, crea la app DENTRO del handler, con try/catch.

import type { Express } from 'express';

let cachedApp: Express | null = null;
let cachedError: Error | null = null;

function getApp(): Express {
  if (cachedApp) return cachedApp;
  if (cachedError) throw cachedError;

  try {
    const { createApp } = require('./app');
    cachedApp = createApp();
    return cachedApp;
  } catch (err: any) {
    cachedError = err;
    console.error('[api/index] Error creando app:', err);
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const app = getApp();
    return app(req, res);
  } catch (err: any) {
    console.error('[api/index] Handler error:', err);
    res.status(500).json({
      success: false,
      error: 'Error al inicializar la aplicacion: ' + (err?.message || 'desconocido'),
      stack: err?.stack?.split('\n').slice(0, 10).join('\n'),
    });
  }
}