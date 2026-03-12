import { Router } from 'express';
import { queryOne } from '../db/pool.ts';

export const reportsRouter = Router();

// Resumo numérico utilizado no dashboard.
// Mantém os contadores principais em um endpoint próprio para evitar múltiplas chamadas do frontend.
reportsRouter.get('/reports/summary', async (_req, res, next) => {
  try {
    const inbound = await queryOne<any>('SELECT COUNT(*) AS count FROM inbound');
    const outbound = await queryOne<any>('SELECT COUNT(*) AS count FROM expedition');
    const trucks = await queryOne<any>("SELECT COUNT(*) AS count FROM trucks WHERE status <> 'Despachado'");
    const items = await queryOne<any>('SELECT COUNT(*) AS count FROM items');

    res.json({
      inbound: Number(inbound?.count || 0),
      outbound: Number(outbound?.count || 0),
      trucks: Number(trucks?.count || 0),
      items: Number(items?.count || 0),
    });
  } catch (error) {
    next(error);
  }
});
