export interface User {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
  isAnonymous?: boolean;
  tenantId?: string | null;
  providerData?: Array<{ providerId: string; displayName: string | null; email: string | null; photoURL: string | null }>;
}

// Implementação mínima compatível com o formato de data esperado pelo frontend.
// Foi mantida porque parte da interface ainda usa essa abstração em helpers de exibição.
class Timestamp {
  private date: Date;
  constructor(date: Date) { this.date = date; }
  static now() { return new Timestamp(new Date()); }
  toDate() { return this.date; }
}

const systemUser: User = {
  uid: 'system-access',
  email: 'sistema@local',
  displayName: 'Acesso direto',
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  tenantId: null,
  providerData: []
};

const currentUser: User = systemUser;
const collectionListeners = new Map<string, Set<(snapshot: any) => void>>();

// Wrapper único para chamadas HTTP da camada de dados.
// Todas as operações do frontend passam por aqui para manter tratamento de erro, headers padronizados
// e redução de cache indevido nas respostas do backend.
async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-App-Client': 'zyx-web',
      ...(options?.headers || {})
    },
    ...options
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

// Constrói um objeto de snapshot compatível com o formato esperado pelas telas.
// A ideia é preservar a assinatura usada antes no frontend sem acoplar a interface ao backend REST.
function makeSnapshot(collectionName: string, data: any[]) {
  return { size: data.length, docs: data.map((item) => ({ id: String(item.id), data: () => item })), empty: data.length === 0, collectionName };
}

// Resolve uma coleção lógica do frontend para o endpoint real da API.
// Esta função concentra a compatibilidade de leitura e evita espalhar mapeamentos por vários componentes.
async function fetchCollection(collectionName: string, queryObj?: any) {
  switch (collectionName) {
    case 'items':
      return await api('/api/items');
    case 'trucks': {
      let rows = await api('/api/trucks');
      if (queryObj?.filters?.length) {
        rows = rows.filter((row: any) => queryObj.filters.every((filter: any) => {
          if (filter.op === '==') return row[filter.field] === filter.value;
          if (filter.op === '!=') return row[filter.field] !== filter.value;
          if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.includes(row[filter.field]);
          return true;
        }));
      }
      return rows;
    }
    case 'inbound':
      return await api('/api/inbound');
    case 'expedition':
      return await api('/api/expedition');
    case 'inventory':
      return await api('/api/inventory');
    case 'audit_logs': {
      let rows = await api('/api/audit');
      if (queryObj?.orderBy?.field) rows.sort((a: any, b: any) => String(b[queryObj.orderBy.field]).localeCompare(String(a[queryObj.orderBy.field])));
      if (queryObj?.limitCount) rows = rows.slice(0, queryObj.limitCount);
      return rows;
    }
    default:
      if (collectionName.startsWith('trucks/') && collectionName.endsWith('/items')) {
        const truckId = collectionName.split('/')[1];
        const trucks = await api('/api/trucks');
        const truck = trucks.find((row: any) => String(row.id) === String(truckId));
        return truck?.items || [];
      }
      if (collectionName.startsWith('inbound/') && collectionName.endsWith('/items')) {
        const inboundId = collectionName.split('/')[1];
        const rows = await api('/api/inbound');
        const inbound = rows.find((row: any) => String(row.id) === String(inboundId));
        return inbound?.items || [];
      }
      if (collectionName.startsWith('expedition/') && collectionName.endsWith('/items')) {
        const expeditionId = collectionName.split('/')[1];
        const rows = await api('/api/expedition');
        const expedition = rows.find((row: any) => String(row.id) === String(expeditionId));
        return expedition?.items || [];
      }
      return [];
  }
}

// Notifica observers de uma coleção após alguma alteração.
// Isso mantém a interface reativa sem depender de websockets ou polling automático.
async function notifyCollection(collectionName: string) {
  const listeners = collectionListeners.get(collectionName);
  if (!listeners?.size) return;
  const data = await fetchCollection(collectionName);
  const snapshot = makeSnapshot(collectionName, data);
  for (const listener of listeners) listener(snapshot);
}

export const db = {} as any;
export const auth = { get currentUser() { return currentUser; } };

export enum OperationType { CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write' }

// Ponto único para log e rethrow de erro vindo da camada de dados.
// Hoje é mais simples, mas foi mantido centralizado porque a interface já chama esse helper.
export function handleDataError(error: unknown, _operationType?: OperationType, _collectionName?: string) {
  console.error('Data Error:', error);
  throw error instanceof Error ? error : new Error(String(error));
}

// Formata datas do backend e também o Timestamp compatível definido neste arquivo.
export function formatDate(date: any, includeTime = true): string {
  if (!date) return '-';
  let d: Date;
  if (date instanceof Timestamp) d = date.toDate();
  else d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Data Inválida';
  return includeTime ? d.toLocaleString('pt-BR') : d.toLocaleDateString('pt-BR');
}

// Grava evento na auditoria e atualiza quem estiver observando a coleção de logs.
export const logAction = async (action: string, module: string, details: string, userEmail = 'Admin') => {
  await api('/api/audit', { method: 'POST', body: JSON.stringify({ action, module, details, user: userEmail }) });
  await notifyCollection('audit_logs');
};

// Helpers compatíveis com a API antiga usada pelos componentes.
// Mesmo com nomes herdados, hoje eles apenas constroem descritores para a camada REST.
export const collection = (_db: any, path: string) => ({ type: 'collection', path });
export const doc = (_db: any, collectionName: string, id: string) => ({ type: 'doc', collectionName, id });
export const where = (field: string, op: string, value: any) => ({ kind: 'where', field, op, value });
export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc') => ({ kind: 'orderBy', field, direction });
export const limit = (count: number) => ({ kind: 'limit', count });
export const query = (collectionRef: any, ...parts: any[]) => ({ type: 'query', path: collectionRef.path, filters: parts.filter((p) => p.kind === 'where'), orderBy: parts.find((p) => p.kind === 'orderBy'), limitCount: parts.find((p) => p.kind === 'limit')?.count });

// Consulta uma coleção inteira, com ou sem filtros locais.
// É amplamente usada em listagens do frontend.
export async function getDocs(ref: any) {
  const collectionName = ref.path;
  const data = await fetchCollection(collectionName, ref.type === 'query' ? ref : undefined);
  return makeSnapshot(collectionName, data);
}

// Busca um único registro quando a tela precisa de leitura pontual.
// Hoje temos suporte explícito para inventory e items, que são os usos reais do projeto.
export async function getDoc(ref: any) {
  if (ref.collectionName === 'inventory') {
    const rows = await api('/api/inventory');
    const item = rows.find((row: any) => String(row.item_id) === String(ref.id) || String(row.id) === String(ref.id));
    return { exists: () => !!item, data: () => item };
  }
  if (ref.collectionName === 'items') {
    const rows = await api('/api/items');
    const item = rows.find((row: any) => String(row.id) === String(ref.id));
    return { exists: () => !!item, data: () => item };
  }
  return { exists: () => false, data: () => null };
}

// Compatibilidade para gravação de documento avulso.
// No projeto atual é usada para ajuste de estoque.
export async function setDoc(ref: any, data: any, _options?: any) {
  if (ref.collectionName === 'inventory') {
    await api('/api/inventory/adjust', { method: 'POST', body: JSON.stringify({ item_id: ref.id, quantity: data.quantity ?? 0, reason: data.reason || 'Ajuste inicial' }) });
    await notifyCollection('inventory');
    return;
  }
  throw new Error('setDoc não suportado para este recurso');
}

// Cria novos registros nas coleções suportadas pela aplicação.
// Aqui fica o mapeamento entre a intenção do frontend e a rota real do backend.
export async function addDoc(collectionRef: any, data: any) {
  const path = collectionRef.path;
  if (path === 'items') {
    const result = await api('/api/items', { method: 'POST', body: JSON.stringify(data) });
    await notifyCollection('items');
    return { id: String(result.id) };
  }
  if (path === 'trucks') {
    const result = await api('/api/trucks/entry', { method: 'POST', body: JSON.stringify(data) });
    await notifyCollection('trucks');
    return { id: String(result.id) };
  }
  if (path.startsWith('trucks/') && path.endsWith('/items')) {
    const truckId = path.split('/')[1];
    const result = await api(`/api/trucks/${truckId}/items`, { method: 'POST', body: JSON.stringify(data) });
    await notifyCollection('trucks');
    return { id: String(result.id) };
  }
  if (path === 'inbound') {
    const result = await api('/api/inbound', { method: 'POST', body: JSON.stringify(data) });
    await notifyCollection('inbound');
    await notifyCollection('inventory');
    await notifyCollection('trucks');
    return { id: String(result.load_number || Date.now()) };
  }
  if (path === 'expedition') {
    const result = await api('/api/expedition', { method: 'POST', body: JSON.stringify(data) });
    await notifyCollection('expedition');
    await notifyCollection('inventory');
    await notifyCollection('trucks');
    return { id: String(result.order_number || Date.now()) };
  }
  if (path.startsWith('trucks/') || path.startsWith('inbound/') || path.startsWith('expedition/')) return { id: String(Date.now()) };
  if (path === 'audit_logs') {
    await logAction(data.action, data.module, data.details, data.user);
    return { id: String(Date.now()) };
  }
  throw new Error(`Coleção não suportada: ${path}`);
}

// Atualiza recursos que ainda possuem suporte explícito na camada de compatibilidade.
// O caso de trucks é usado principalmente para marcar saída/despacho.
export async function updateDoc(docRef: any, data: any) {
  if (docRef.collectionName === 'items') {
    await api(`/api/items/${docRef.id}`, { method: 'PUT', body: JSON.stringify(data) });
    await notifyCollection('items');
    return;
  }
  if (docRef.collectionName === 'trucks') {
    if (data.status === 'Despachado') {
      await api(`/api/trucks/exit/${docRef.id}`, { method: 'POST' });
      await notifyCollection('trucks');
      return;
    }
    await notifyCollection('trucks');
    return;
  }
  if (docRef.collectionName === 'inventory') {
    await api('/api/inventory/adjust', { method: 'POST', body: JSON.stringify({ item_id: docRef.id, quantity: data.quantity ?? 0, reason: data.reason || 'Ajuste manual' }) });
    await notifyCollection('inventory');
    return;
  }
  throw new Error(`updateDoc não suportado para ${docRef.collectionName}`);
}

// Exclusão suportada atualmente apenas para o cadastro de itens.
export async function deleteDoc(docRef: any) {
  if (docRef.collectionName === 'items') {
    await api(`/api/items/${docRef.id}`, { method: 'DELETE' });
    await notifyCollection('items');
    return;
  }
  throw new Error(`deleteDoc não suportado para ${docRef.collectionName}`);
}

// Simula observação em tempo real das coleções através de callbacks locais.
// É o mecanismo que mantém a interface atualizada após operações de create/update/delete.
export function onSnapshot(ref: any, onNext: (snapshot: any) => void, onError?: (error: any) => void) {
  const collectionName = ref.path;
  const wrapped = async () => {
    try {
      const data = await fetchCollection(collectionName, ref.type === 'query' ? ref : undefined);
      onNext(makeSnapshot(collectionName, data));
    } catch (error) {
      onError?.(error);
    }
  };
  wrapped();
  if (!collectionListeners.has(collectionName)) collectionListeners.set(collectionName, new Set());
  const listeners = collectionListeners.get(collectionName)!;
  const fn = (snapshot: any) => {
    const filtered = ref.type === 'query'
      ? makeSnapshot(collectionName, snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((row: any) => ref.filters.every((filter: any) => {
          if (filter.op === '==') return row[filter.field] === filter.value;
          if (filter.op === '!=') return row[filter.field] !== filter.value;
          if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.includes(row[filter.field]);
          return true;
        })).slice(0, ref.limitCount || undefined))
      : snapshot;
    onNext(filtered);
  };
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export { Timestamp };
