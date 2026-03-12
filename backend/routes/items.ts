import { Router } from 'express';
import { execute, query, queryOne } from '../db/pool.ts';
import { logAction } from '../services/auditService.ts';
import { normalizeRows } from '../utils/normalize.ts';

export const itemsRouter = Router();

// Lista os itens mestres cadastrados no sistema.
// Esta rota alimenta cadastros, inbound, expedição e consultas de estoque no frontend.
itemsRouter.get('/items', async (_req, res, next) => {
  try {
    const items = await query<any[]>('SELECT * FROM items ORDER BY created_at DESC, id DESC');
    res.json(normalizeRows(items));
  } catch (error) {
    next(error);
  }
});

// Cria um novo item do catálogo.
// Após persistir, grava auditoria para que o dashboard e o histórico tenham rastreabilidade.
itemsRouter.post('/items', async (req, res, next) => {
  const { code, description, unit } = req.body;

  try {
    const result = await execute('INSERT INTO items (code, description, unit) VALUES (?, ?, ?)', [code, description, unit]);
    await logAction('Create', 'Items', `Item ${code} criado`);
    res.json({ id: String(result.insertId) });
  } catch (error) {
    next(error);
  }
});

// Atualiza o cadastro básico do item.
// É usada pela manutenção de itens na interface administrativa.
itemsRouter.put('/items/:id', async (req, res, next) => {
  const { id } = req.params;
  const { code, description, unit } = req.body;

  try {
    await execute('UPDATE items SET code = ?, description = ?, unit = ? WHERE id = ?', [code, description, unit, id]);
    await logAction('Update', 'Items', `Item ${code} atualizado`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Remove um item do catálogo.
// Antes de excluir, buscamos o código para registrar uma trilha legível na auditoria.
itemsRouter.delete('/items/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    const item = await queryOne<any>('SELECT code FROM items WHERE id = ?', [id]);
    await execute('DELETE FROM items WHERE id = ?', [id]);

    if (item) {
      await logAction('Delete', 'Items', `Item ${item.code} excluído`);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
