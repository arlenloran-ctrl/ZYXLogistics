import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.ts';
import { logAction } from '../services/auditService.ts';
import { fetchTruckItemsByTruckIds } from '../services/truckDataService.ts';
import { normalizeRows } from '../utils/normalize.ts';

export const expeditionRouter = Router();

// Lista as expedições registradas, trazendo também os itens que saíram em cada carga.
// A tela de expedição usa esta rota para histórico e conferência do que foi carregado.
expeditionRouter.get('/expedition', async (_req, res, next) => {
  try {
    const rows = await query<any[]>(
      `SELECT ex.*, t.plate AS truck_plate, t.driver AS truck_driver,
              (SELECT COALESCE(SUM(quantity), 0) FROM truck_items WHERE truck_id = ex.truck_id AND direction = 'Outbound') AS total_quantity
       FROM expedition ex
       JOIN trucks t ON t.id = ex.truck_id
       ORDER BY ex.shipped_at DESC, ex.id DESC`
    );

    const itemsByTruck = await fetchTruckItemsByTruckIds(rows.map((row) => row.truck_id), 'Outbound');

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

// Efetiva uma expedição.
// O fluxo valida disponibilidade do caminhão, reserva/baixa estoque e registra os itens em truck_items
// com direction Outbound, que depois alimentam dashboard, conferência e histórico.
expeditionRouter.post('/expedition', async (req, res, next) => {
  const truckId = Number(req.body.truck_id);
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  try {
    const truck = await queryOne<any>('SELECT * FROM trucks WHERE id = ?', [truckId]);
    if (!truck) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    if (truck.status === 'Despachado') {
      return res.status(400).json({ error: 'Caminhão já foi despachado' });
    }

    if (truck.load_status !== 'Empty') {
      return res.status(400).json({ error: 'Caminhão deve estar vazio para expedição' });
    }

    const totalQuantity = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    const orderNumber = `EXP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;

    await withTransaction(async (conn) => {
      await conn.execute(
        'INSERT INTO expedition (order_number, customer, truck_id, quantity) VALUES (?, ?, ?, ?)',
        [orderNumber, truck.customer || 'Não informado', truckId, totalQuantity]
      );

      for (const item of items) {
        const [stockRows] = await conn.query<any[]>('SELECT * FROM inventory WHERE item_id = ? FOR UPDATE', [item.item_id]);
        const stock = stockRows[0];

        if (!stock || Number(stock.quantity) < Number(item.quantity)) {
          throw new Error(`Estoque insuficiente para o item ${item.item_id}`);
        }

        await conn.execute(
          'UPDATE inventory SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE item_id = ?',
          [item.quantity, item.item_id]
        );
        await conn.execute(
          'INSERT INTO truck_items (truck_id, item_id, quantity, direction) VALUES (?, ?, ?, ?)',
          [truckId, item.item_id, item.quantity, 'Outbound']
        );
      }

      await conn.execute(
        "UPDATE trucks SET status = 'Carregado', last_action = 'Carregado', load_status = 'Loaded', type = 'Inbound' WHERE id = ?",
        [truckId]
      );
    });

    await logAction('Create', 'Expedition', `Expedição ${orderNumber} no caminhão ${truck.plate}`);
    res.json({ success: true, order_number: orderNumber });
  } catch (error) {
    next(error);
  }
});
