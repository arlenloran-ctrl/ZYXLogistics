import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './backend/config/env.ts';
import { createPool, query } from './backend/db/pool.ts';
import { ensureDatabaseSchema } from './backend/db/schema.ts';
import { errorHandler } from './backend/middleware/errorHandler.ts';
import { apiRouter } from './backend/routes/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});
app.use('/api', apiRouter);
app.use(errorHandler);

// Bootstrap principal do servidor.
// Aqui concentramos somente a inicialização da aplicação: conexão com banco,
// garantia do schema, configuração do Vite em desenvolvimento e subida do HTTP server.
async function startServer() {
  createPool();

  try {
    await query('SELECT 1 AS ok');
    await ensureDatabaseSchema();
    console.log(`MySQL conectado em ${env.dbHost}:${env.dbPort}/${env.dbName}`);
  } catch (error: any) {
    console.error('Falha ao iniciar servidor:', error);

    if (error?.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Verifique se o IP da sua máquina está liberado no Remote MySQL da Hostinger e se DB_USER/DB_PASSWORD estão corretos.');
    }

    if (error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT') {
      console.error('Não foi possível alcançar o host MySQL. Confira host, porta e regras de rede/firewall.');
    }

    process.exit(1);
  }

  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}

startServer();
