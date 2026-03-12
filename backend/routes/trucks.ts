import { Router } from 'express';
import mysql from 'mysql2/promise';
import { execute, queryOne, withTransaction } from '../db/pool.ts';
import { logAction } from '../services/auditService.ts';
import { fetchTrucksWithItems } from '../services/truckDataService.ts';

export const trucksRouter = Router();

// Retorna os veículos do pátio já enriquecidos com seus itens.
// Esta rota é o principal ponto de leitura da Portaria, do dashboard e de telas que precisam
// enxergar o caminhão junto com a carga vinculada.
trucksRouter.get('/trucks', async (_req, res, next) => {
  try {
    res.json(await fetchTrucksWithItems());
  } catch (error) {
    next(error);
  }
});

// Registra a entrada do veículo no pátio.
// Quando o caminhão entra carregado, os itens já são persistidos em truck_items na mesma transação,
// para garantir que o inbound encontre exatamente a carga declarada na portaria.
trucksRouter.post('/trucks/entry', async (req, res, next) => {
  const { plate, driver, type, load_status, supplier, customer, items } = req.body;

  try {
    const truckId = await withTransaction(async (conn) => {
      const [result] = await conn.execute<mysql.ResultSetHeader>(
        'INSERT INTO trucks (plate, driver, type, load_status, supplier, customer, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [plate, driver, type, load_status, supplier || null, customer || null, 'Em pátio']
      );

      const newTruckId = result.insertId;

      if (load_status === 'Loaded' && Array.isArray(items)) {
        for (const item of items) {
          await conn.execute(
            'INSERT INTO truck_items (truck_id, item_id, quantity, direction) VALUES (?, ?, ?, ?)',
            [newTruckId, item.item_id, item.quantity, 'Inbound']
          );
        }
      }

      return newTruckId;
    });

    await logAction('Entry', 'Trucks', `Caminhão ${plate} entrou no pátio (${load_status})`);
    res.json({ id: String(truckId) });
  } catch (error) {
    next(error);
  }
});

// Marca a saída do veículo do pátio.
// É acionada quando o fluxo operacional considera o caminhão despachado/finalizado.
trucksRouter.post('/trucks/exit/:id', async (req, res, next) => {
  try {
    const truck = await queryOne<any>('SELECT plate FROM trucks WHERE id = ?', [req.params.id]);
    await execute(
      "UPDATE trucks SET exit_time = CURRENT_TIMESTAMP, status = 'Despachado', last_action = 'Despachado' WHERE id = ?",
      [req.params.id]
    );

    if (truck) {
      await logAction('Exit', 'Trucks', `Caminhão ${truck.plate} saiu do pátio`);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Endpoint de compatibilidade para inclusão de itens após o caminhão já existir.
// Continua útil para fluxos da interface que ainda adicionam itens separadamente da entrada.
trucksRouter.post('/trucks/:id/items', async (req, res, next) => {
  const truckId = Number(req.params.id);
  const itemId = Number(req.body.item_id);
  const quantity = Number(req.body.quantity);
  const direction = req.body.direction === 'Outbound' ? 'Outbound' : 'Inbound';

  try {
    const truck = await queryOne<any>('SELECT * FROM trucks WHERE id = ?', [truckId]);
    if (!truck) {
      return res.status(404).json({ error: 'Veículo não encontrado' });
    }

    if (!itemId) {
      return res.status(400).json({ error: 'Item inválido' });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantidade inválida' });
    }

    const item = await queryOne<any>('SELECT id FROM items WHERE id = ?', [itemId]);
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    const result = await execute(
      'INSERT INTO truck_items (truck_id, item_id, quantity, direction) VALUES (?, ?, ?, ?)',
      [truckId, itemId, quantity, direction]
    );

    await logAction('Update', 'Trucks', `Item ${itemId} vinculado ao caminhão ${truck.plate} (${direction})`);
    res.json({ id: String(result.insertId) });
  } catch (error) {
    next(error);
  }
});
