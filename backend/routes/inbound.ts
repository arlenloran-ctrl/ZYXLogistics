import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.ts';
import { logAction } from '../services/auditService.ts';
import { fetchTruckItemsByTruckIds } from '../services/truckDataService.ts';
import { normalizeRows } from '../utils/normalize.ts';

export const inboundRouter = Router();

// Lista os recebimentos já efetivados.
// A resposta volta com dados do caminhão e também com os itens vinculados para a tela de inbound.
inboundRouter.get('/inbound', async (_req, res, next) => {
  try {
    const rows = await query<any[]>(
      `SELECT ib.*, t.plate AS truck_plate, t.driver AS truck_driver,
              (SELECT COALESCE(SUM(quantity), 0) FROM truck_items WHERE truck_id = ib.truck_id AND direction = 'Inbound') AS total_quantity
       FROM inbound ib
       JOIN trucks t ON t.id = ib.truck_id
       ORDER BY ib.received_at DESC, ib.id DESC`
    );

    const itemsByTruck = await fetchTruckItemsByTruckIds(rows.map((row) => row.truck_id), 'Inbound');

    res.json(
      normalizeRows(rows).map((row) => ({
        ...row,
        truck_id: String(row.truck_id),
        items: itemsByTruck.get(String(row.truck_id)) || [],
      }))
    );
  } catch (error) {
    next(error);
  }
});

// Efetiva o recebimento de um caminhão carregado.
// Além de criar o lançamento em inbound, incrementa o estoque item a item e atualiza o estado do caminhão
// para que ele passe a ficar disponível para um próximo ciclo operacional.
inboundRouter.post('/inbound', async (req, res, next) => {
  const truckId = Number(req.body.truck_id);

  try {
    const truck = await queryOne<any>('SELECT * FROM trucks WHERE id = ?', [truckId]);
    if (!truck) {
      return res.status(404).json({ error: 'Veículo não encontrado no pátio' });
    }

    if (truck.status === 'Despachado') {
      return res.status(400).json({ error: 'Veículo já foi despachado' });
    }

    const truckItems = await query<any[]>(
      'SELECT * FROM truck_items WHERE truck_id = ? AND direction = ? ORDER BY id ASC',
      [truckId, 'Inbound']
    );

    const totalQuantity = truckItems.reduce((sum, item) => sum + Number(item.quantity), 0);
    const loadNumber = `INB-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;

    await withTransaction(async (conn) => {
      await conn.execute(
        'INSERT INTO inbound (load_number, supplier, truck_id, quantity) VALUES (?, ?, ?, ?)',
        [loadNumber, truck.supplier || 'Não informado', truckId, totalQuantity]
      );

      for (const item of truckItems) {
        await conn.execute(
          `INSERT INTO inventory (item_id, quantity, last_updated)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), last_updated = CURRENT_TIMESTAMP`,
          [item.item_id, item.quantity]
        );
      }

      await conn.execute(
        "UPDATE trucks SET status = 'Em pátio', last_action = 'Recebido', load_status = 'Empty', type = 'Outbound' WHERE id = ?",
        [truckId]
      );
    });

    await logAction('Create', 'Inbound', `Recebimento ${loadNumber} no caminhão ${truck.plate}`);
    res.json({ success: true, load_number: loadNumber });
  } catch (error) {
    next(error);
  }
});
