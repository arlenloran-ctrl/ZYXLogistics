import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.ts';
import { logAction } from '../services/auditService.ts';
import { normalizeRows } from '../utils/normalize.ts';

export const inventoryRouter = Router();

// Lista o estoque consolidado já com os dados descritivos do item.
// É usado tanto na tela de estoque quanto em partes do frontend que precisam exibir saldo disponível.
inventoryRouter.get('/inventory', async (_req, res, next) => {
  try {
    const inventory = await query<any[]>(
      `SELECT inv.*, i.code AS item_code, i.description AS item_description, i.unit
       FROM inventory inv
       JOIN items i ON i.id = inv.item_id
       ORDER BY i.code ASC`
    );

    res.json(normalizeRows(inventory).map((row) => ({ ...row, item_id: String(row.item_id) })));
  } catch (error) {
    next(error);
  }
});

// Ajuste manual de estoque.
// Hoje a interface usa esta rota para correções pontuais e também como compatibilidade
// para chamadas legadas da camada de dados do frontend.
inventoryRouter.post('/inventory/adjust', async (req, res, next) => {
  const { item_id, quantity, reason } = req.body;

  try {
    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO inventory (item_id, quantity, last_updated)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), last_updated = CURRENT_TIMESTAMP`,
        [item_id, quantity]
      );
    });

    const item = await queryOne<any>('SELECT code FROM items WHERE id = ?', [item_id]);
    await logAction(
      'Adjustment',
      'Inventory',
      `Ajuste manual para ${item?.code || item_id}: ${quantity} (${reason || 'Sem motivo'})`
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
