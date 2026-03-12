import { Router } from 'express';
import { env } from '../config/env.ts';
import { query } from '../db/pool.ts';

export const healthRouter = Router();

// Healthcheck simples para validar se a API está de pé e se o banco responde.
// É útil para diagnóstico local, monitoramento e verificação rápida após deploy.
healthRouter.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1 AS ok');
    res.json({ ok: true, database: env.dbName, host: env.dbHost });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
