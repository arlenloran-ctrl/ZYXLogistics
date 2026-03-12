import { query } from '../db/pool.ts';
import { normalizeRows } from '../utils/normalize.ts';

// Busca os itens vinculados a uma lista de caminhões já agrupando por truck_id.
// É usada por rotas que precisam montar a visão completa do caminhão com sua carga,
// como Portaria, Inbound, Expedição e alguns indicadores do dashboard.
export async function fetchTruckItemsByTruckIds(truckIds: Array<string | number>, direction?: 'Inbound' | 'Outbound') {
  if (!truckIds.length) {
    return new Map<string, any[]>();
  }

  const placeholders = truckIds.map(() => '?').join(', ');
  const params = direction ? [...truckIds, direction] : truckIds;
  const directionSql = direction ? ' AND ti.direction = ?' : '';

  const rows = await query<any[]>(
    `SELECT ti.*, i.code AS item_code, i.description AS item_description, i.unit
     FROM truck_items ti
     JOIN items i ON i.id = ti.item_id
     WHERE ti.truck_id IN (${placeholders})${directionSql}
     ORDER BY ti.id ASC`,
    params
  );

  const grouped = new Map<string, any[]>();

  for (const row of normalizeRows(rows)) {
    const truckId = String(row.truck_id);
    if (!grouped.has(truckId)) grouped.set(truckId, []);
    grouped.get(truckId)!.push({
      ...row,
      truck_id: String(row.truck_id),
      item_id: String(row.item_id),
    });
  }

  return grouped;
}

// Monta a lista principal de caminhões com seus itens embutidos.
// Esta função foi criada para concentrar a regra de composição em um lugar só,
// evitando repetir a mesma consulta em múltiplas rotas.
export async function fetchTrucksWithItems() {
  const trucks = await query<any[]>('SELECT * FROM trucks ORDER BY entry_time DESC, id DESC');
  const normalizedTrucks = normalizeRows(trucks).map((truck) => ({ ...truck }));
  const itemsByTruck = await fetchTruckItemsByTruckIds(normalizedTrucks.map((truck) => truck.id));

  return normalizedTrucks.map((truck) => ({
    ...truck,
    items: itemsByTruck.get(String(truck.id)) || [],
  }));
}
