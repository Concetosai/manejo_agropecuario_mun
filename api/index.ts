import type { Express } from 'express';

let cachedApp: Express | null = null;
let cachedError: Error | null = null;

async function getApp(): Promise<Express> {
  if (cachedApp) return cachedApp;
  if (cachedError) throw cachedError;

  try {
    const mod = await import('./app.js');
    cachedApp = mod.createApp();
    return cachedApp;
  } catch (err: any) {
    cachedError = err;
    console.error('[api/index] Error creando app:', err);
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
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