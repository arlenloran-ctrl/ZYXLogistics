export interface Item {
  id: string;
  code: string;
  description: string;
  unit: string;
  created_at: any;
}

export interface Truck {
  id: string;
  plate: string;
  driver: string;
  type: 'Inbound' | 'Outbound';
  load_status: 'Empty' | 'Loaded';
  entry_time: any;
  exit_time: any | null;
  status: 'Em pátio' | 'Recebido' | 'Carregado' | 'Despachado';
  last_action?: string;
  items?: TruckItem[];
  supplier?: string;
  customer?: string;
}

export interface TruckItem {
  id: string;
  truck_id: string;
  item_id: string;
  quantity: number;
  direction: 'Inbound' | 'Outbound';
  item_code?: string;
  item_description?: string;
  unit?: string;
}

export interface Inventory {
  id: string;
  item_id: string;
  quantity: number;
  item_code: string;
  item_description: string;
  unit: string;
  last_updated: any;
}

export interface Inbound {
  id: string;
  load_number: string;
  supplier: string;
  truck_id: string;
  received_at: any;
  status: string;
  truck_plate?: string;
  truck_driver?: string;
  total_quantity?: number;
  items?: TruckItem[];
}

export interface Expedition {
  id: string;
  order_number: string;
  customer: string;
  truck_id: string;
  shipped_at: any;
  truck_plate?: string;
  truck_driver?: string;
  total_quantity?: number;
  items?: TruckItem[];
}

export interface AuditLog {
  id: string;
  action: string;
  module: string;
  details: string;
  user: string;
  timestamp: any;
}

export interface DashboardSummary {
  inbound: number;
  outbound: number;
  trucks: number;
  items: number;
  inventory_value?: number;
}
