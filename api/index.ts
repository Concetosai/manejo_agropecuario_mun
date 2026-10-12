import express from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check mínimo (sin dependencias pesadas)
app.get('/api/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/api/ai/scan-ine', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Función mínima funcionando - el problema está en api/app.ts' 
  });
});

app.post('/api/ai/scan-ine', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Función mínima funcionando - el problema está en api/app.ts' 
  });
});

export default app;