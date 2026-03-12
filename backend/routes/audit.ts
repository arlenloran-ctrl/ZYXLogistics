import { Router } from 'express';
import { query } from '../db/pool.ts';
import { logAction } from '../services/auditService.ts';
import { normalizeRows } from '../utils/normalize.ts';

export const auditRouter = Router();

// Lista os últimos eventos de auditoria para dashboard e consulta operacional.
// O limite evita crescimento excessivo de payload sem perder a utilidade do histórico recente.
auditRouter.get('/audit', async (_req, res, next) => {
  try {
    const logs = await query<any[]>('SELECT * FROM audit_logs ORDER BY timestamp DESC, id DESC LIMIT 500');
    res.json(normalizeRows(logs));
  } catch (error) {
    next(error);
  }
});

// Permite registrar auditoria via API.
// É usado principalmente pela camada de dados do frontend para manter um ponto único de escrita.
auditRouter.post('/audit', async (req, res, next) => {
  const { action, module, details, user } = req.body;

  try {
    await logAction(action, module, details, user || 'Admin');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
