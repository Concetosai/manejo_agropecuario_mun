import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { createApp } from './server/app.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = createApp();

  // Determine execution mode (Cloud Run injects K_SERVICE and PORT 8080)
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.K_SERVICE) ||
    Boolean(process.env.CLOUD_RUN_JOB) ||
    (process.env.PORT !== undefined && process.env.PORT !== '3000' && process.env.NODE_ENV !== 'development');

  const distDir = path.resolve(__dirname, 'dist');
  const indexHtmlPath = path.resolve(distDir, 'index.html');

  if (isProduction) {
    // If running in production but dist is missing, build client bundle automatically
    if (!fs.existsSync(indexHtmlPath)) {
      console.log('Production detected: dist/index.html not found, executing client build...');
      try {
        execSync('npm run build', { stdio: 'inherit' });
      } catch (buildErr) {
        console.error('Failed to run build on startup:', buildErr);
      }
    }

    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
    }

    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Endpoint no encontrado' });
        return;
      }
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        res.status(500).send('Servidor Municipal: Generando archivos del sistema...');
      }
    });
  } else {
    // Development mode with Vite middlewares
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`H. Ayuntamiento de Pánuco Ganadero Server listening on port ${PORT} [mode: ${isProduction ? 'production' : 'development'}]`);
  });
}

startServer();
