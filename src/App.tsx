import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  FileText, 
  History, 
  Settings,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Item, Inbound, Truck as TruckType, Expedition, AuditLog, DashboardSummary, Inventory, TruckItem } from './types';
import { 
  auth, db, logAction, formatDate,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, 
  query, where, orderBy, limit, onSnapshot, Timestamp, OperationType, handleDataError 
} from './dataClient';

const exportDataToExcel = (data: any[], filename: string) => {
  const processedData = data.map(item => {
    const newItem: any = {};
    Object.entries(item).forEach(([key, val]) => {
      if (key === 'id') return;
      if (val instanceof Timestamp) {
        newItem[key] = val.toDate().toLocaleString('pt-BR');
      } else if (Array.isArray(val)) {
        newItem[key] = val.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ');
      } else if (typeof val === 'object' && val !== null) {
        newItem[key] = JSON.stringify(val);
      } else {
        newItem[key] = val;
      }
    });
    return newItem;
  });

  const worksheet = XLSX.utils.json_to_sheet(processedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// --- Hooks & Helpers ---


const normalizePlateInput = (value: string) => {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);

  if (raw.length <= 3) {
    return raw;
  }

  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
};

const isValidPlate = (value: string) => {
  return /^[A-Z]{3}-(?:\d[A-Z]\d{2}|\d{4})$/.test(value);
};

function useDataTable<T>(data: T[], itemsPerPage: number = 10) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = React.useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(item => 
      Object.values(item as any).some(val => 
        String(val).toLowerCase().includes(query)
      )
    );
  }, [data, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, data.length]);

  return {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedData,
    totalItems: filteredData.length
  };
}

const Pagination = ({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (page: number) => void }) => {
  if (totalPages <= 1) return null;
  
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 mt-4 rounded-b-xl">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Próximo
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Anterior</span>
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Próximo</span>
              <ChevronRight size={20} />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

const SearchBar = ({ value, onChange, placeholder = "Pesquisar...", onExport }: { value: string, onChange: (val: string) => void, placeholder?: string, onExport?: () => void }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
      />
    </div>
    {onExport && (
      <button
        onClick={onExport}
        className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 flex items-center gap-2"
        title="Exportar para Excel"
      >
        <FileSpreadsheet size={20} />
        <span className="text-xs font-bold hidden sm:inline">Excel</span>
      </button>
    )}
  </div>
);

// --- Components ---

interface SidebarItemProps {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
  key?: React.Key;
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-black text-white shadow-lg shadow-black/10' 
        : 'text-gray-500 hover:bg-gray-100'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
    {active && <motion.div layoutId="active-pill" className="ml-auto"><ChevronRight size={16} /></motion.div>}
  </button>
);

const SectionHeader = ({ title, subtitle, action }: { title: string, subtitle: string, action?: React.ReactNode }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-500 text-sm">{subtitle}</p>
    </div>
    {action}
  </div>
);

const FullPageLoader = ({ loading }: { loading: boolean }) => (
  <AnimatePresence>
    {loading && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-md"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-16 h-16 border-4 border-black border-t-transparent rounded-full"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="absolute inset-0 flex items-center justify-center text-black font-bold text-xl"
            >
              Z
            </motion.div>
          </div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-black">Processando</span>
            <div className="flex gap-1 mt-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                  className="w-1 h-1 bg-black rounded-full"
                />
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const ActionButton = ({ 
  children, 
  loading, 
  disabled, 
  className = "btn-primary", 
  icon: Icon,
  type = "button",
  onClick,
  ...props 
}: any) => (
  <button
    type={type}
    disabled={loading || disabled}
    onClick={onClick}
    className={`${className} flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 relative overflow-hidden`}
    {...props}
  >
    {loading ? (
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
        />
        <span className="text-[10px] font-bold uppercase tracking-wider">Processando...</span>
      </div>
    ) : (
      <>
        {Icon && <Icon size={18} />}
        {children}
      </>
    )}
  </button>
);

// --- Modules ---

const Dashboard = () => {
  const [summary, setSummary] = useState<DashboardSummary>({ inbound: 0, outbound: 0, trucks: 0, items: 0 });
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [yardTrucks, setYardTrucks] = useState<TruckType[]>([]);
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);

  useEffect(() => {
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      setSummary(prev => ({ ...prev, items: snap.size }));
    });
    const unsubInbound = onSnapshot(collection(db, 'inbound'), (snap) => {
      setSummary(prev => ({ ...prev, inbound: snap.size }));
    });
    const unsubExpedition = onSnapshot(collection(db, 'expedition'), (snap) => {
      const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as Expedition));
      setSummary(prev => ({ ...prev, outbound: snap.size }));
      setExpeditions(rows);
    });
    const unsubTrucks = onSnapshot(query(collection(db, 'trucks'), where('status', '!=', 'Despachado')), (snap) => {
      const trucks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as TruckType));
      setSummary(prev => ({ ...prev, trucks: trucks.length }));
      setYardTrucks(trucks);
    });
    const unsubLogs = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(6)), (snap) => {
      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as AuditLog));
      setRecentLogs(logs);
    });

    return () => {
      unsubItems();
      unsubInbound();
      unsubExpedition();
      unsubTrucks();
      unsubLogs();
    };
  }, []);

  const stats = [
    { label: 'Itens Cadastrados', value: summary.items, icon: Package, color: 'bg-blue-50 text-blue-600' },
    { label: 'Recebimentos (Inbound)', value: summary.inbound, icon: ArrowDownCircle, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Expedições Realizadas', value: summary.outbound, icon: ArrowUpCircle, color: 'bg-orange-50 text-orange-600' },
    { label: 'Caminhões no Pátio', value: summary.trucks, icon: Truck, color: 'bg-purple-50 text-purple-600' },
  ];

  const yardStatus = useMemo(() => {
    const totalActive = yardTrucks.length || 1;
    const expeditionTruckIds = new Set(expeditions.map((expedition) => String(expedition.truck_id)));

    const inYard = yardTrucks.length;
    const loaded = yardTrucks.filter((truck) => truck.status === 'Carregado' && expeditionTruckIds.has(String(truck.id))).length;
    const awaitingInbound = yardTrucks.filter((truck) => truck.status === 'Em pátio' && (truck.items?.length || 0) > 0).length;
    const readyForExpedition = yardTrucks.filter((truck) => truck.status === 'Em pátio' && (truck.items?.length || 0) === 0).length;

    return [
      { label: 'Em pátio', value: inYard, helper: 'Todos os veículos ainda não despachados', color: 'bg-purple-500' },
      { label: 'Carregados', value: loaded, helper: 'Status Carregado com expedição registrada', color: 'bg-orange-500' },
      { label: 'Aguardando recebimento', value: awaitingInbound, helper: 'Em pátio com itens vinculados', color: 'bg-emerald-500' },
      { label: 'Prontos para expedição', value: readyForExpedition, helper: 'Em pátio e sem itens vinculados', color: 'bg-blue-500' },
    ].map((status) => ({
      ...status,
      percentage: Math.round((status.value / totalActive) * 100),
    }));
  }, [yardTrucks, expeditions]);

  const formatRelativeTime = (value: any) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return formatDate(value);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `Há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Há ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Há ${diffDays} dia(s)`;
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Dashboard" subtitle="Visão geral das operações da ZYX Logística" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
            <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
            <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-bold mb-4">Atividade Recente</h3>
          <div className="space-y-4">
            {recentLogs.length > 0 ? recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                  <History size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{log.action} · {log.module}</p>
                  <p className="text-xs text-gray-500 truncate">{log.details}</p>
                  <p className="text-xs text-gray-400">{formatRelativeTime(log.timestamp)} · {log.user || 'Sistema'}</p>
                </div>
              </div>
            )) : (
              <div className="text-sm text-gray-400 italic py-6">Nenhuma atividade registrada ainda.</div>
            )}
          </div>
        </div>
        <div className="card p-6">
          <h3 className="font-bold mb-4">Status do Pátio</h3>
          <div className="space-y-4">
            {yardStatus.map((status) => {
              const percentage = status.percentage;
              return (
                <div key={status.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{status.label}</p>
                      <p className="text-xs text-gray-400">{status.helper}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{status.value}</p>
                      <p className="text-xs text-gray-400">{percentage}%</p>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${status.color}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t text-xs text-gray-500">
              Total de veículos ativos no sistema: <span className="font-semibold text-gray-700">{yardTrucks.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ItemsManager = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ code: '', description: '', unit: 'UN' });

  const {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedData
  } = useDataTable(items);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'items'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as Item));
      setItems(data);
    }, (err) => handleDataError(err, OperationType.LIST, 'items'));
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingItem) {
        const changes: string[] = [];
        if (editingItem.code !== formData.code) changes.push(`Código: ${editingItem.code} -> ${formData.code}`);
        if (editingItem.description !== formData.description) changes.push(`Descrição: ${editingItem.description} -> ${formData.description}`);
        if (editingItem.unit !== formData.unit) changes.push(`Unidade: ${editingItem.unit} -> ${formData.unit}`);
        
        await updateDoc(doc(db, 'items', editingItem.id.toString()), formData);
        logAction("Update", "Items", `Item ${formData.code} atualizado. Alterações: ${changes.join(', ') || 'Nenhuma alteração detectada'}`, auth.currentUser?.email || 'Admin');
      } else {
        await addDoc(collection(db, 'items'), {
          ...formData,
          created_at: Timestamp.now()
        });
        logAction("Create", "Items", `Item criado: Código=${formData.code}, Descrição=${formData.description}, Unidade=${formData.unit}`, auth.currentUser?.email || 'Admin');
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ code: '', description: '', unit: 'UN' });
    } catch (err) {
      handleDataError(err, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'items');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({ code: item.code, description: item.description, unit: item.unit });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string | number) => {
    const itemToDelete = items.find(i => i.id.toString() === id.toString());
    if (confirm(`Deseja excluir o item ${itemToDelete?.code}?`)) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'items', id.toString()));
        logAction("Delete", "Items", `Item excluído: ${itemToDelete?.code} - ${itemToDelete?.description}`, auth.currentUser?.email || 'Admin');
      } catch (err) {
        handleDataError(err, OperationType.DELETE, 'items');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div>
      <FullPageLoader loading={loading} />
      <SectionHeader 
        title="Cadastro de Itens" 
        subtitle="Gerencie o catálogo de produtos e materiais"
        action={
          <ActionButton onClick={() => { setIsModalOpen(true); setEditingItem(null); }} icon={Plus}>
            Novo Item
          </ActionButton>
        }
      />

      <div className="card overflow-x-auto">
        <div className="p-4 border-b border-gray-100">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            onExport={() => exportDataToExcel(items, 'Catalogo_Itens')}
          />
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Código</th>
              <th className="table-header">Descrição</th>
              <th className="table-header">Unidade</th>
              <th className="table-header">Data Cadastro</th>
              <th className="table-header text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map(item => (
              <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="table-cell font-mono font-medium">{item.code}</td>
                <td className="table-cell">{item.description}</td>
                <td className="table-cell">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold">{item.unit}</span>
                </td>
                <td className="table-cell text-gray-500">{formatDate(item.created_at, false)}</td>
                <td className="table-cell text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      disabled={loading}
                      onClick={() => { setEditingItem(item); setFormData({ code: item.code, description: item.description, unit: item.unit }); setIsModalOpen(true); }}
                      className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      disabled={loading}
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">{editingItem ? 'Editar Item' : 'Novo Item'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código do Item</label>
                  <input 
                    required
                    className="input-field"
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                    placeholder="Ex: PRD-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <input 
                    required
                    className="input-field"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Descrição completa do item"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade de Medida</label>
                  <select 
                    className="input-field"
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  >
                    <option value="UN">Unidade (UN)</option>
                    <option value="KG">Quilo (KG)</option>
                    <option value="MT">Metro (MT)</option>
                    <option value="LT">Litro (LT)</option>
                    <option value="CX">Caixa (CX)</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                  <ActionButton type="submit" loading={loading} className="btn-primary flex-1">Salvar</ActionButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InboundManager = () => {
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<TruckType | null>(null);
  const [loading, setLoading] = useState(false);

  const pendingTable = useDataTable(trucks);
  const historyTable = useDataTable(inbounds);

  useEffect(() => {
    const unsubTrucks = onSnapshot(query(collection(db, 'trucks'), where('load_status', '==', 'Loaded'), where('status', '==', 'Em pátio')), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as TruckType));
      setTrucks(data);
    });
    const unsubInbound = onSnapshot(collection(db, 'inbound'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as Inbound));
      setInbounds(data);
    });
    return () => { unsubTrucks(); unsubInbound(); };
  }, []);

  const handleReceiveClick = async (truck: TruckType) => {
    const itemsSnap = await getDocs(collection(db, `trucks/${truck.id}/items`));
    const items = itemsSnap.docs.map(d => d.data() as TruckItem);
    setSelectedTruck({ ...truck, items });
    setIsModalOpen(true);
  };

  const handleConfirmReceipt = async () => {
    if (!selectedTruck) return;
    setLoading(true);
    try {
      const load_number = `INB-${Date.now().toString().slice(-6)}`;
      const total_quantity = selectedTruck.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;

      const inbRef = await addDoc(collection(db, 'inbound'), {
        load_number,
        supplier: selectedTruck.supplier || 'Não informado',
        truck_id: selectedTruck.id,
        truck_plate: selectedTruck.plate,
        truck_driver: selectedTruck.driver,
        total_quantity,
        received_at: Timestamp.now(),
        status: 'Recebido'
      });

      const itemsList = selectedTruck.items?.map(i => `${i.item_code} (${i.quantity} ${i.unit})`).join(', ');
      logAction("Create", "Inbound", `Recebimento ${load_number} concluído para veículo ${selectedTruck.plate}. Itens: ${itemsList}`, auth.currentUser?.email || 'Admin');
      
      setIsModalOpen(false);
      setSelectedTruck(null);
    } catch (err) {
      handleDataError(err, OperationType.CREATE, 'inbound');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <FullPageLoader loading={loading} />
      <div>
        <SectionHeader 
          title="Veículos Aguardando Recebimento" 
          subtitle="Veículos carregados no pátio pendentes de conferência"
        />

        <div className="card overflow-x-auto">
          <div className="p-4 border-b border-gray-100">
            <SearchBar 
              value={pendingTable.searchQuery} 
              onChange={pendingTable.setSearchQuery} 
              onExport={() => exportDataToExcel(trucks, 'Veiculos_Aguardando_Recebimento')}
            />
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Placa</th>
                <th className="table-header">Motorista</th>
                <th className="table-header">Transportadora</th>
                <th className="table-header">Entrada</th>
                <th className="table-header">Itens</th>
                <th className="table-header text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pendingTable.paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-gray-400 py-8">Nenhum veículo aguardando recebimento</td>
                </tr>
              ) : (
                pendingTable.paginatedData.map(truck => (
                  <tr key={truck.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="table-cell font-mono font-bold uppercase">{truck.plate}</td>
                    <td className="table-cell">{truck.driver}</td>
                    <td className="table-cell">{truck.supplier || 'Não informado'}</td>
                    <td className="table-cell text-gray-500">{formatDate(truck.entry_time)}</td>
                    <td className="table-cell text-xs text-gray-400">
                      {truck.items?.length || 0} itens
                    </td>
                    <td className="table-cell text-right">
                      <button 
                        onClick={() => handleReceiveClick(truck)}
                        className="btn-primary text-xs py-1 px-3"
                      >
                        Receber
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination currentPage={pendingTable.currentPage} totalPages={pendingTable.totalPages} onPageChange={pendingTable.setCurrentPage} />
        </div>
      </div>

      <div>
        <SectionHeader 
          title="Histórico de Recebimentos" 
          subtitle="Últimas cargas processadas e integradas ao estoque"
        />

        <div className="card overflow-x-auto">
          <div className="p-4 border-b border-gray-100">
            <SearchBar value={historyTable.searchQuery} onChange={historyTable.setSearchQuery} />
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Carga #</th>
                <th className="table-header">Transportadora</th>
                <th className="table-header">Placa Veículo</th>
                <th className="table-header">Motorista</th>
                <th className="table-header">Data/Hora</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {historyTable.paginatedData.map(inbound => (
                <tr key={inbound.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="table-cell font-mono font-medium">{inbound.load_number}</td>
                  <td className="table-cell">{inbound.supplier}</td>
                  <td className="table-cell font-bold uppercase">{inbound.truck_plate}</td>
                  <td className="table-cell">{inbound.truck_driver}</td>
                  <td className="table-cell text-gray-500">{formatDate(inbound.received_at)}</td>
                  <td className="table-cell">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                      <CheckCircle2 size={12} /> {inbound.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination currentPage={historyTable.currentPage} totalPages={historyTable.totalPages} onPageChange={historyTable.setCurrentPage} />
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && selectedTruck && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Conferência de Recebimento</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 uppercase text-[10px] font-bold">Veículo</p>
                    <p className="font-bold">{selectedTruck.plate}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 uppercase text-[10px] font-bold">Transportadora</p>
                    <p className="font-bold">{selectedTruck.supplier || selectedTruck.customer || 'Não informado'}</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">Itens na Carga:</p>
                  {selectedTruck.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.item_code} - {item.item_description}</span>
                      <span className="font-bold">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                  {(!selectedTruck.items || selectedTruck.items.length === 0) && (
                    <p className="text-sm text-gray-400 italic">Nenhum item registrado</p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                  <ActionButton 
                    onClick={handleConfirmReceipt}
                    loading={loading}
                    className="btn-primary flex-1"
                  >
                    Confirmar Recebimento
                  </ActionButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TruckControl = () => {
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    plate: string;
    driver: string;
    type: 'Inbound' | 'Outbound';
    load_status: 'Empty' | 'Loaded';
    supplier: string;
    customer: string;
    items: { item_id: string; quantity: number }[];
  }>({
    plate: '',
    driver: '',
    type: 'Outbound',
    load_status: 'Empty',
    supplier: '',
    customer: '',
    items: []
  });

  const {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedData
  } = useDataTable(trucks);

  useEffect(() => {
    const unsubTrucks = onSnapshot(collection(db, 'trucks'), async (snap) => {
      const trucksData = await Promise.all(snap.docs.map(async d => {
        const itemsSnap = await getDocs(collection(db, `trucks/${d.id}/items`));
        const truckItems = itemsSnap.docs.map(id => id.data() as TruckItem);
        return { id: d.id, ...d.data(), items: truckItems } as any as TruckType;
      }));
      setTrucks(trucksData.sort((a, b) => (b.entry_time?.seconds || 0) - (a.entry_time?.seconds || 0)));
    });
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as any as Item)));
    });
    return () => { unsubTrucks(); unsubItems(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!isValidPlate(formData.plate)) {
        alert('Informe uma placa válida no padrão ABC-1234 ou AAA-1B23.');
        setLoading(false);
        return;
      }

      if (formData.load_status === 'Loaded' && formData.items.length === 0) {
        alert('Por favor, adicione pelo menos um item para carga carregada.');
        setLoading(false);
        return;
      }

      const normalizedItems = formData.items.map(itemData => {
        const item = items.find(i => i.id.toString() === itemData.item_id);
        if (!item) {
          throw new Error('Selecione itens válidos para o veículo.');
        }
        if (!itemData.quantity || Number(itemData.quantity) <= 0) {
          throw new Error(`A quantidade do item ${item.code} deve ser maior que zero.`);
        }
        return {
          item_id: item.id,
          item_code: item.code,
          item_description: item.description,
          unit: item.unit,
          quantity: Number(itemData.quantity),
          direction: formData.type
        };
      });

      await addDoc(collection(db, 'trucks'), {
        plate: formData.plate,
        driver: formData.driver,
        type: formData.type,
        load_status: formData.load_status,
        supplier: formData.supplier,
        customer: formData.customer,
        status: 'Em pátio',
        entry_time: Timestamp.now(),
        last_action: 'Entrada',
        items: normalizedItems
      });

      const itemsList = formData.items.map(i => {
        const item = items.find(it => it.id.toString() === i.item_id);
        return `${item?.code} (${i.quantity} ${item?.unit})`;
      }).join(', ');

      logAction("Entry", "Trucks", `Entrada do veículo ${formData.plate} registrada (Motorista: ${formData.driver}, Tipo: ${formData.type}, Status: ${formData.load_status}${itemsList ? `, Itens: ${itemsList}` : ''})`, auth.currentUser?.email || 'Admin');
      
      setIsModalOpen(false);
      setFormData({ plate: '', driver: '', type: 'Outbound', load_status: 'Empty', supplier: '', customer: '', items: [] });
    } catch (err) {
      handleDataError(err, OperationType.CREATE, 'trucks');
    } finally {
      setLoading(false);
    }
  };

  const handleExit = async (id: string | number) => {
    const truck = trucks.find(t => t.id.toString() === id.toString());
    setLoading(true);
    try {
      await updateDoc(doc(db, 'trucks', id.toString()), {
        status: 'Despachado',
        exit_time: Timestamp.now(),
        last_action: 'Saída'
      });
      logAction("Exit", "Trucks", `Saída do veículo ${truck?.plate} registrada (Motorista: ${truck?.driver})`, auth.currentUser?.email || 'Admin');
    } catch (err) {
      handleDataError(err, OperationType.UPDATE, 'trucks');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { item_id: '', quantity: 0 }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  return (
    <div>
      <FullPageLoader loading={loading} />
      <SectionHeader 
        title="Controle de Portaria" 
        subtitle="Monitoramento de entrada e saída de veículos"
        action={
          <ActionButton onClick={() => setIsModalOpen(true)} icon={Plus}>
            Registrar Entrada
          </ActionButton>
        }
      />

      <div className="card overflow-x-auto">
        <div className="p-4 border-b border-gray-100">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            onExport={() => exportDataToExcel(trucks, 'Controle_Portaria')}
          />
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Placa</th>
              <th className="table-header">Motorista</th>
              <th className="table-header">Transportadora</th>
              <th className="table-header">Tipo</th>
              <th className="table-header">Carga</th>
              <th className="table-header">Entrada</th>
              <th className="table-header">Status</th>
              <th className="table-header">Última Ação</th>
              <th className="table-header text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map(truck => (
              <tr key={truck.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="table-cell font-mono font-bold uppercase">{truck.plate}</td>
                <td className="table-cell">{truck.driver}</td>
                <td className="table-cell text-gray-500">{truck.supplier || truck.customer || '-'}</td>
                <td className="table-cell">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${truck.type === 'Inbound' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                    {truck.type}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex flex-col gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold w-fit ${truck.load_status === 'Empty' ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-600'}`}>
                      {truck.load_status === 'Empty' ? 'Vazio' : 'Carregado'}
                    </span>
                    {truck.items && truck.items.length > 0 && (
                      <div className="space-y-1">
                        {truck.items.filter(i => i.direction === 'Inbound').length > 0 && (
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-blue-500 uppercase">Chegada:</span>
                            <div className="text-[10px] text-gray-500 leading-tight">
                              {truck.items.filter(i => i.direction === 'Inbound').map(i => `${i.item_code}: ${i.quantity}${i.unit}`).join(', ')}
                            </div>
                          </div>
                        )}
                        {truck.items.filter(i => i.direction === 'Outbound').length > 0 && (
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-emerald-500 uppercase">Saída:</span>
                            <div className="text-[10px] text-gray-500 leading-tight">
                              {truck.items.filter(i => i.direction === 'Outbound').map(i => `${i.item_code}: ${i.quantity}${i.unit}`).join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="table-cell text-gray-500">{formatDate(truck.entry_time)}</td>
                <td className="table-cell">
                <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${
                    truck.status === 'Em pátio' ? 'bg-purple-50 text-purple-600' : 
                    truck.status === 'Recebido' ? 'bg-blue-50 text-blue-600' :
                    truck.status === 'Carregado' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {truck.status === 'Em pátio' ? <Clock size={12} /> : 
                     truck.status === 'Recebido' ? <CheckCircle2 size={12} /> : 
                     truck.status === 'Carregado' ? <Package size={12} /> : 
                     <ArrowRight size={12} />} {truck.status}
                  </span>
                </td>
                <td className="table-cell">
                  {truck.last_action && (
                    <span className="text-xs text-gray-500 italic">
                      {truck.last_action}
                    </span>
                  )}
                </td>
                <td className="table-cell text-right">
                  {truck.status !== 'Despachado' && (
                    <ActionButton 
                      onClick={() => handleExit(truck.id)}
                      loading={loading}
                      className="btn-secondary text-xs py-1"
                    >
                      Despachar
                    </ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 my-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Registrar Entrada de Veículo</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Placa do Veículo</label>
                    <input 
                      required
                      className="input-field uppercase"
                      value={formData.plate}
                      onChange={e => setFormData({...formData, plate: normalizePlateInput(e.target.value)})}
                      placeholder="ABC-1234 ou AAA-1B23"
                      maxLength={8}
                      inputMode="text"
                      pattern="[A-Za-z]{3}-(?:[0-9]{4}|[0-9][A-Za-z][0-9]{2})"
                      title="Use os formatos ABC-1234 ou AAA-1B23"
                    />
                    <p className="mt-1 text-xs text-gray-500">Aceita apenas os formatos ABC-1234 ou AAA-1B23.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motorista</label>
                    <input 
                      required
                      className="input-field"
                      value={formData.driver}
                      onChange={e => setFormData({...formData, driver: e.target.value})}
                      placeholder="Nome completo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transportadora</label>
                    <input 
                      required
                      className="input-field"
                      value={formData.type === 'Inbound' ? formData.supplier : formData.customer}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          supplier: val,
                          customer: val
                        });
                      }}
                      placeholder="Nome da transportadora"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado da Carga</label>
                    <select 
                      className="input-field"
                      value={formData.load_status}
                      onChange={e => {
                        const status = e.target.value as 'Empty' | 'Loaded';
                        setFormData({
                          ...formData, 
                          load_status: status,
                          type: status === 'Loaded' ? 'Inbound' : 'Outbound',
                          items: status === 'Empty' ? [] : formData.items
                        });
                      }}
                    >
                      <option value="Empty">Vazio</option>
                      <option value="Loaded">Carregado</option>
                    </select>
                  </div>
                </div>

                {formData.load_status === 'Loaded' && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm">Itens Carregados</h4>
                      <button type="button" onClick={addItem} className="text-xs flex items-center gap-1 text-black hover:underline">
                        <Plus size={14} /> Adicionar Item
                      </button>
                    </div>
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex gap-3 items-end bg-gray-50 p-3 rounded-xl">
                        <div className="flex-1">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Item</label>
                          <select 
                            required
                            className="input-field text-sm"
                            value={item.item_id}
                            onChange={e => updateItem(index, 'item_id', e.target.value)}
                          >
                            <option value="">Selecione</option>
                            {items.map(i => (
                              <option key={i.id} value={i.id}>{i.code} - {i.description}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Qtd</label>
                          <input 
                            required
                            type="number"
                            step="0.01"
                            className="input-field text-sm"
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value))}
                            placeholder="0.00"
                          />
                        </div>
                        <button type="button" onClick={() => removeItem(index)} className="p-2 text-gray-400 hover:text-red-600">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                  <ActionButton type="submit" loading={loading} className="btn-primary flex-1">Confirmar Entrada</ActionButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ExpeditionManager = () => {
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<TruckType | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    order_number: '',
    items: [] as { item_id: string; quantity: number }[]
  });

  const pendingTable = useDataTable(trucks);
  const historyTable = useDataTable(expeditions);

  useEffect(() => {
    const unsubTrucks = onSnapshot(query(collection(db, 'trucks'), where('type', '==', 'Outbound'), where('status', 'in', ['Em pátio', 'Recebido']), where('load_status', '==', 'Empty')), (snap) => {
      setTrucks(snap.docs.map(d => ({ id: d.id, ...d.data() } as any as TruckType)));
    });
    const unsubExp = onSnapshot(collection(db, 'expedition'), (snap) => {
      setExpeditions(snap.docs.map(d => ({ id: d.id, ...d.data() } as any as Expedition)));
    });
    const unsubInv = onSnapshot(collection(db, 'inventory'), (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as any as Inventory)));
    });
    return () => { unsubTrucks(); unsubExp(); unsubInv(); };
  }, []);

  const handleLoadClick = (truck: TruckType) => {
    setSelectedTruck(truck);
    setFormData({ order_number: '', items: [] });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruck) return;
    setLoading(true);

    try {
      if (formData.items.length === 0) {
        alert('Adicione pelo menos um item para expedição');
        setLoading(false);
        return;
      }

      // Check stock
      for (const item of formData.items) {
        const stock = inventory.find(i => i.item_id.toString() === item.item_id);
        if (!stock || stock.quantity < item.quantity) {
          alert(`Estoque insuficiente para o item ${stock?.item_code || item.item_id}`);
          setLoading(false);
          return;
        }
      }

      const total_quantity = formData.items.reduce((sum, i) => sum + i.quantity, 0);
      const order_number = formData.order_number || `EXP-${Date.now().toString().slice(-6)}`;
      
      const expeditionItems = formData.items.map((itemData) => {
        const stock = inventory.find(i => i.item_id.toString() === itemData.item_id);
        if (!stock) {
          throw new Error('Selecione itens válidos para a expedição.');
        }
        if (!itemData.quantity || Number(itemData.quantity) <= 0) {
          throw new Error(`A quantidade do item ${stock.item_code} deve ser maior que zero.`);
        }
        if (Number(stock.quantity) < Number(itemData.quantity)) {
          throw new Error(`Estoque insuficiente para o item ${stock.item_code}.`);
        }
        return {
          item_id: stock.item_id,
          item_code: stock.item_code,
          item_description: stock.item_description,
          unit: stock.unit,
          quantity: Number(itemData.quantity)
        };
      });

      // Create Expedition Record
      const expRef = await addDoc(collection(db, 'expedition'), {
        order_number,
        customer: selectedTruck.customer || 'Não informado',
        truck_id: selectedTruck.id,
        truck_plate: selectedTruck.plate,
        truck_driver: selectedTruck.driver,
        total_quantity,
        shipped_at: Timestamp.now(),
        status: 'Carregado',
        items: expeditionItems
      });

      const itemsList = formData.items.map(i => {
        const stock = inventory.find(it => it.item_id.toString() === i.item_id);
        return `${stock?.item_code} (${i.quantity} ${stock?.unit})`;
      }).join(', ');

      logAction("Create", "Expedition", `Expedição ${order_number} concluída para veículo ${selectedTruck.plate}. Itens carregados: ${itemsList}`, auth.currentUser?.email || 'Admin');
      
      setIsModalOpen(false);
      setSelectedTruck(null);
      setFormData({ order_number: '', items: [] });
    } catch (err) {
      handleDataError(err, OperationType.CREATE, 'expedition');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { item_id: '', quantity: 0 }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-8">
      <FullPageLoader loading={loading} />
      <div>
        <SectionHeader 
          title="Veículos Aguardando Carregamento" 
          subtitle="Veículos vazios no pátio prontos para expedição"
        />

        <div className="card overflow-x-auto">
          <div className="p-4 border-b border-gray-100">
            <SearchBar 
              value={pendingTable.searchQuery} 
              onChange={pendingTable.setSearchQuery} 
              onExport={() => exportDataToExcel(trucks, 'Veiculos_Aguardando_Carregamento')}
            />
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Placa</th>
                <th className="table-header">Motorista</th>
                <th className="table-header">Transportadora</th>
                <th className="table-header">Entrada</th>
                <th className="table-header text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pendingTable.paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-cell text-center text-gray-400 py-8">Nenhum veículo aguardando carregamento</td>
                </tr>
              ) : (
                pendingTable.paginatedData.map(truck => (
                  <tr key={truck.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="table-cell font-mono font-bold uppercase">{truck.plate}</td>
                    <td className="table-cell">{truck.driver}</td>
                    <td className="table-cell">{truck.customer || 'Não informado'}</td>
                    <td className="table-cell text-gray-500">{formatDate(truck.entry_time)}</td>
                    <td className="table-cell text-right">
                      <button 
                        onClick={() => handleLoadClick(truck)}
                        className="btn-primary text-xs py-1 px-3"
                      >
                        Carregar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination currentPage={pendingTable.currentPage} totalPages={pendingTable.totalPages} onPageChange={pendingTable.setCurrentPage} />
        </div>
      </div>

      <div>
        <SectionHeader 
          title="Histórico de Expedições" 
          subtitle="Últimas saídas processadas e baixadas do estoque"
        />

        <div className="card overflow-x-auto">
          <div className="p-4 border-b border-gray-100">
            <SearchBar value={historyTable.searchQuery} onChange={historyTable.setSearchQuery} />
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Pedido #</th>
                <th className="table-header">Transportadora</th>
                <th className="table-header">Placa Veículo</th>
                <th className="table-header">Motorista</th>
                <th className="table-header">Data/Hora</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {historyTable.paginatedData.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="table-cell font-mono font-medium text-orange-600">{ex.order_number}</td>
                  <td className="table-cell">{ex.customer}</td>
                  <td className="table-cell font-bold uppercase">{ex.truck_plate}</td>
                  <td className="table-cell">{ex.truck_driver}</td>
                  <td className="table-cell text-gray-500">{formatDate(ex.shipped_at)}</td>
                  <td className="table-cell">
                    <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                      <CheckCircle2 size={12} /> Carregado
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination currentPage={historyTable.currentPage} totalPages={historyTable.totalPages} onPageChange={historyTable.setCurrentPage} />
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && selectedTruck && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 my-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Processar Carregamento</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 uppercase text-[10px] font-bold">Veículo</p>
                    <p className="font-bold">{selectedTruck.plate}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 uppercase text-[10px] font-bold">Transportadora</p>
                    <p className="font-bold">{selectedTruck.supplier || selectedTruck.customer || 'Não informado'}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm">Itens para Carregar</h4>
                      <button type="button" onClick={addItem} className="text-xs flex items-center gap-1 text-black hover:underline">
                        <Plus size={14} /> Adicionar Item
                      </button>
                    </div>
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex gap-3 items-end bg-gray-50 p-3 rounded-xl">
                        <div className="flex-1">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Item em Estoque</label>
                          <select 
                            required
                            className="input-field text-sm"
                            value={item.item_id}
                            onChange={e => updateItem(index, 'item_id', e.target.value)}
                          >
                            <option value="">Selecione</option>
                            {inventory.map(inv => (
                              <option key={inv.item_id} value={inv.item_id} disabled={inv.quantity <= 0}>
                                {inv.item_code} - {inv.item_description} (Disp: {inv.quantity} {inv.unit})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Qtd</label>
                          <input 
                            required
                            type="number"
                            step="0.01"
                            className="input-field text-sm"
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value))}
                            placeholder="0.00"
                          />
                        </div>
                        <button type="button" onClick={() => removeItem(index)} className="p-2 text-gray-400 hover:text-red-600">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                    {formData.items.length === 0 && (
                      <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl">
                        Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                    <ActionButton type="submit" loading={loading} className="btn-primary flex-1">Confirmar Expedição</ActionButton>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InventoryManager = () => {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ item_id: '', quantity: 0, reason: '' });

  const mergedInventory = useMemo(() => {
    return items.map(item => {
      const invEntry = inventory.find(inv => inv.item_id === item.id.toString());
      return {
        id: item.id,
        item_id: item.id.toString(),
        item_code: item.code,
        item_description: item.description,
        unit: item.unit,
        quantity: invEntry ? invEntry.quantity : 0,
        last_updated: invEntry ? invEntry.last_updated : null
      } as any as Inventory;
    });
  }, [items, inventory]);

  const {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedData
  } = useDataTable(mergedInventory);

  useEffect(() => {
    const unsubInv = onSnapshot(collection(db, 'inventory'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as Inventory));
      setInventory(data);
    });
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as Item));
      setItems(data);
    });
    return () => { unsubInv(); unsubItems(); };
  }, []);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const item = items.find(i => i.id.toString() === formData.item_id);
      if (!item) {
        setLoading(false);
        return;
      }

      const invRef = doc(db, 'inventory', formData.item_id);
      const invSnap = await getDoc(invRef);
      const oldQty = invSnap.exists() ? invSnap.data().quantity : 0;

      await setDoc(invRef, {
        item_id: formData.item_id,
        item_code: item.code,
        item_description: item.description,
        unit: item.unit,
        quantity: formData.quantity,
        last_updated: Timestamp.now()
      }, { merge: true });

      logAction("Adjustment", "Inventory", `Ajuste manual para ${item.code}: Quantidade alterada de ${oldQty} para ${formData.quantity}. Motivo: ${formData.reason}`, auth.currentUser?.email || 'Admin');
      
      setIsModalOpen(false);
      setFormData({ item_id: '', quantity: 0, reason: '' });
    } catch (err) {
      handleDataError(err, OperationType.UPDATE, 'inventory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <FullPageLoader loading={loading} />
      <SectionHeader 
        title="Gestão de Estoque" 
        subtitle="Monitoramento de níveis e ajustes manuais"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <p className="text-gray-500 text-sm font-medium">Total de Itens</p>
          <h3 className="text-3xl font-bold mt-1">{mergedInventory.length}</h3>
        </div>
        <div className="card p-6">
          <p className="text-gray-500 text-sm font-medium">Itens com Estoque Baixo</p>
          <h3 className="text-3xl font-bold mt-1 text-orange-600">{mergedInventory.filter(i => i.quantity < 10).length}</h3>
        </div>
        <div className="card p-6">
          <p className="text-gray-500 text-sm font-medium">Última Atualização</p>
          <h3 className="text-lg font-bold mt-1">
            {inventory.length > 0 
              ? formatDate(new Date(Math.max(...inventory.map(i => {
                  const d = i.last_updated instanceof Timestamp ? i.last_updated.toDate() : new Date(i.last_updated);
                  return d.getTime();
                }))))
              : '-'}
          </h3>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="p-4 border-b border-gray-100">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            onExport={() => exportDataToExcel(mergedInventory, 'Gestao_Estoque')}
          />
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Código</th>
              <th className="table-header">Descrição</th>
              <th className="table-header">Quantidade</th>
              <th className="table-header">Unidade</th>
              <th className="table-header">Status</th>
              <th className="table-header">Última Movimentação</th>
              <th className="table-header text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="table-cell font-mono font-medium">{inv.item_code}</td>
                <td className="table-cell">{inv.item_description}</td>
                <td className="table-cell font-bold">{inv.quantity}</td>
                <td className="table-cell">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold">{inv.unit}</span>
                </td>
                <td className="table-cell">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    inv.quantity <= 0 ? 'bg-red-50 text-red-600' : 
                    inv.quantity < 10 ? 'bg-orange-50 text-orange-600' : 
                    'bg-emerald-50 text-emerald-600'
                  }`}>
                    {inv.quantity <= 0 ? 'Sem Estoque' : inv.quantity < 10 ? 'Estoque Baixo' : 'Em Estoque'}
                  </span>
                </td>
                <td className="table-cell text-gray-500">{formatDate(inv.last_updated)}</td>
                <td className="table-cell text-right">
                  <button 
                    onClick={() => {
                      setFormData({ item_id: inv.item_id, quantity: inv.quantity, reason: '' });
                      setIsModalOpen(true);
                    }}
                    className="btn-secondary text-xs py-1"
                  >
                    Ajustar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Ajuste de Estoque</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAdjust} className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase">Item Selecionado</p>
                  <p className="font-bold text-gray-900">
                    {inventory.find(i => i.item_id === formData.item_id)?.item_code} - {inventory.find(i => i.item_id === formData.item_id)?.item_description}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nova Quantidade</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={formData.quantity}
                    onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do Ajuste</label>
                  <textarea 
                    required
                    className="input-field min-h-[100px]"
                    value={formData.reason}
                    onChange={e => setFormData({...formData, reason: e.target.value})}
                    placeholder="Descreva o motivo do ajuste (ex: inventário rotativo, quebra, etc)"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                  <ActionButton type="submit" loading={loading} className="btn-primary flex-1">Salvar Ajuste</ActionButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LogDetailsCell = ({ details }: { details: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Try to find a good split point (period or colon followed by space)
  const splitIndex = details.search(/[.:]\s/);
  const hasMore = splitIndex !== -1;
  
  const summary = hasMore ? details.substring(0, splitIndex + 1) : details;
  const extra = hasMore ? details.substring(splitIndex + 1).trim() : '';

  if (!hasMore) return <span className="text-gray-600">{details}</span>;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <span className="text-gray-600">{summary}</span>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 transition-colors p-0.5 hover:bg-blue-50 rounded"
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 mt-1 italic">
              {extra}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AuditLogView = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState({
    module: '',
    action: '',
    user: '',
    startDate: '',
    endDate: ''
  });

  const modules = useMemo(() => Array.from(new Set(logs.map(l => l.module))).sort(), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map(l => l.action))).sort(), [logs]);
  const users = useMemo(() => Array.from(new Set(logs.map(l => l.user))).sort(), [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchModule = !filters.module || log.module === filters.module;
      const matchAction = !filters.action || log.action === filters.action;
      const matchUser = !filters.user || log.user === filters.user;
      
      const logDate = log.timestamp instanceof Timestamp ? log.timestamp.toDate() : new Date(log.timestamp);
      
      let matchStart = true;
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        matchStart = logDate >= start;
      }

      let matchEnd = true;
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        matchEnd = logDate <= end;
      }
      
      return matchModule && matchAction && matchUser && matchStart && matchEnd;
    });
  }, [logs, filters]);

  const {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedData
  } = useDataTable(filteredLogs);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(500)), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as AuditLog));
      setLogs(data);
    });
    return () => unsub();
  }, []);

  return (
    <div>
      <SectionHeader title="Rastreabilidade / Auditoria" subtitle="Histórico completo de ações realizadas no sistema" />
      
      <div className="card mb-6">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <h4 className="text-sm font-bold text-gray-700">Filtros Avançados</h4>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Módulo</label>
            <select 
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/5"
              value={filters.module}
              onChange={e => setFilters({...filters, module: e.target.value})}
            >
              <option value="">Todos os Módulos</option>
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ação</label>
            <select 
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/5"
              value={filters.action}
              onChange={e => setFilters({...filters, action: e.target.value})}
            >
              <option value="">Todas as Ações</option>
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Usuário</label>
            <select 
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/5"
              value={filters.user}
              onChange={e => setFilters({...filters, user: e.target.value})}
            >
              <option value="">Todos os Usuários</option>
              {users.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Data Início</label>
            <input 
              type="date"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/5"
              value={filters.startDate}
              onChange={e => setFilters({...filters, startDate: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Data Fim</label>
            <input 
              type="date"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/5"
              value={filters.endDate}
              onChange={e => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
        </div>
        <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={() => setFilters({ module: '', action: '', user: '', startDate: '', endDate: '' })}
            className="text-xs font-bold text-gray-500 hover:text-black transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="p-4 border-b border-gray-100">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            onExport={() => exportDataToExcel(filteredLogs, 'Log_Auditoria')}
          />
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Data/Hora</th>
              <th className="table-header">Módulo</th>
              <th className="table-header">Ação</th>
              <th className="table-header">Detalhes</th>
              <th className="table-header">Usuário</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map(log => (
              <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="table-cell text-gray-500 font-mono text-xs">
                  {formatDate(log.timestamp)}
                </td>
                <td className="table-cell">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold">{log.module}</span>
                </td>
                <td className="table-cell">
                  <span className={`font-bold ${
                    log.action === 'Delete' ? 'text-red-600' : 
                    log.action === 'Create' ? 'text-emerald-600' : 
                    'text-blue-600'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="table-cell">
                  <LogDetailsCell details={log.details} />
                </td>
                <td className="table-cell font-medium">{log.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>
    </div>
  );
};

const ReportsView = () => {
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);
  const [loading, setLoading] = useState(false);

  const inboundTable = useDataTable(inbounds, 10);
  const expeditionTable = useDataTable(expeditions, 10);

  useEffect(() => {
    const unsubInbound = onSnapshot(collection(db, 'inbound'), async (snap) => {
      const data = await Promise.all(snap.docs.map(async d => {
        const itemsSnap = await getDocs(collection(db, `inbound/${d.id}/items`));
        const items = itemsSnap.docs.map(id => id.data() as TruckItem);
        return { id: d.id, ...d.data(), items } as any as Inbound;
      }));
      setInbounds(data.sort((a, b) => (b.received_at?.seconds || 0) - (a.received_at?.seconds || 0)));
    });

    const unsubExp = onSnapshot(collection(db, 'expedition'), async (snap) => {
      const data = await Promise.all(snap.docs.map(async d => {
        const itemsSnap = await getDocs(collection(db, `expedition/${d.id}/items`));
        const items = itemsSnap.docs.map(id => id.data() as TruckItem);
        return { id: d.id, ...d.data(), items } as any as Expedition;
      }));
      setExpeditions(data.sort((a, b) => (b.shipped_at?.seconds || 0) - (a.shipped_at?.seconds || 0)));
    });

    return () => { unsubInbound(); unsubExp(); };
  }, []);

  const exportToExcel = (data: any[], filename: string, type: 'inbound' | 'expedition') => {
    setLoading(true);
    try {
      const flattenedData = data.flatMap(record => {
        const date = type === 'inbound' 
          ? (record.received_at instanceof Timestamp ? record.received_at.toDate() : new Date(record.received_at))
          : (record.shipped_at instanceof Timestamp ? record.shipped_at.toDate() : new Date(record.shipped_at));

        if (!record.items || record.items.length === 0) {
          return [{
            'ID': record.id,
            'Número': type === 'inbound' ? record.load_number : record.order_number,
            'Transportadora': type === 'inbound' ? record.supplier : record.customer,
            'Placa': record.truck_plate,
            'Motorista': record.truck_driver,
            'Data/Hora': date.toLocaleString(),
            'Item': '-',
            'Quantidade': 0,
            'Unidade': '-'
          }];
        }
        return record.items.map((item: any) => ({
          'ID': record.id,
          'Número': type === 'inbound' ? record.load_number : record.order_number,
          'Transportadora': type === 'inbound' ? record.supplier : record.customer,
          'Placa': record.truck_plate,
          'Motorista': record.truck_driver,
          'Data/Hora': date.toLocaleString(),
          'Item': `${item.item_code} - ${item.item_description}`,
          'Quantidade': item.quantity,
          'Unidade': item.unit
        }));
      });

      const worksheet = XLSX.utils.json_to_sheet(flattenedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <FullPageLoader loading={loading} />
      <SectionHeader title="Relatórios Detalhados" subtitle="Consolidado de movimentações logísticas com rastreabilidade total" />
      
      {/* Detailed Inbound Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <ArrowDownCircle className="text-emerald-600" /> Histórico Detalhado de Recebimentos
          </h3>
          <ActionButton 
            onClick={() => exportToExcel(inbounds, 'Relatorio_Recebimentos', 'inbound')}
            loading={loading}
            icon={FileText}
            className="btn-secondary text-sm"
          >
            Exportar Excel
          </ActionButton>
        </div>
        
        <div className="card overflow-x-auto">
          <div className="p-4 border-b border-gray-100">
            <SearchBar 
              value={inboundTable.searchQuery} 
              onChange={inboundTable.setSearchQuery} 
              placeholder="Pesquisar em recebimentos (Placa, Motorista, Carga...)" 
              onExport={() => exportToExcel(inbounds, 'Relatorio_Recebimentos', 'inbound')}
            />
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Carga #</th>
                <th className="table-header">Transportadora</th>
                <th className="table-header">Placa / Motorista</th>
                <th className="table-header">Data/Hora</th>
                <th className="table-header">Itens e Quantidades</th>
                <th className="table-header text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {inboundTable.paginatedData.map(inboundItem => (
                <tr key={inboundItem.id} className="hover:bg-gray-50/50 transition-colors align-top">
                  <td className="table-cell font-mono font-bold text-emerald-700">{inboundItem.load_number}</td>
                  <td className="table-cell font-medium">{inboundItem.supplier}</td>
                  <td className="table-cell">
                    <div className="flex flex-col">
                      <span className="font-bold uppercase text-xs bg-gray-100 px-2 py-0.5 rounded w-fit mb-1">{inboundItem.truck_plate}</span>
                      <span className="text-sm text-gray-600">{inboundItem.truck_driver}</span>
                    </div>
                  </td>
                  <td className="table-cell text-xs text-gray-500">{formatDate(inboundItem.received_at)}</td>
                  <td className="table-cell">
                    <div className="space-y-1">
                      {inboundItem.items?.map((item, idx) => (
                        <div key={idx} className="text-xs flex justify-between gap-4 border-b border-gray-50 pb-1 last:border-0">
                          <span className="text-gray-600">{item.item_code} - {item.item_description}</span>
                          <span className="font-bold whitespace-nowrap">{item.quantity} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="table-cell text-right font-bold text-emerald-600">
                    {inboundItem.total_quantity || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination currentPage={inboundTable.currentPage} totalPages={inboundTable.totalPages} onPageChange={inboundTable.setCurrentPage} />
        </div>
      </div>

      {/* Detailed Expedition Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <ArrowUpCircle className="text-orange-600" /> Histórico Detalhado de Expedições
          </h3>
          <ActionButton 
            onClick={() => exportToExcel(expeditions, 'Relatorio_Expedicoes', 'expedition')}
            loading={loading}
            icon={FileText}
            className="btn-secondary text-sm"
          >
            Exportar Excel
          </ActionButton>
        </div>
        
        <div className="card overflow-x-auto">
          <div className="p-4 border-b border-gray-100">
            <SearchBar 
              value={expeditionTable.searchQuery} 
              onChange={expeditionTable.setSearchQuery} 
              placeholder="Pesquisar em expedições (Placa, Motorista, Pedido...)" 
              onExport={() => exportToExcel(expeditions, 'Relatorio_Expedicoes', 'expedition')}
            />
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Pedido #</th>
                <th className="table-header">Transportadora</th>
                <th className="table-header">Placa / Motorista</th>
                <th className="table-header">Data/Hora</th>
                <th className="table-header">Itens e Quantidades</th>
                <th className="table-header text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {expeditionTable.paginatedData.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-50/50 transition-colors align-top">
                  <td className="table-cell font-mono font-bold text-orange-700">{ex.order_number}</td>
                  <td className="table-cell font-medium">{ex.customer}</td>
                  <td className="table-cell">
                    <div className="flex flex-col">
                      <span className="font-bold uppercase text-xs bg-gray-100 px-2 py-0.5 rounded w-fit mb-1">{ex.truck_plate}</span>
                      <span className="text-sm text-gray-600">{ex.truck_driver}</span>
                    </div>
                  </td>
                  <td className="table-cell text-xs text-gray-500">{formatDate(ex.shipped_at)}</td>
                  <td className="table-cell">
                    <div className="space-y-1">
                      {ex.items?.map((item, idx) => (
                        <div key={idx} className="text-xs flex justify-between gap-4 border-b border-gray-50 pb-1 last:border-0">
                          <span className="text-gray-600">{item.item_code} - {item.item_description}</span>
                          <span className="font-bold whitespace-nowrap">{item.quantity} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="table-cell text-right font-bold text-orange-600">
                    {ex.total_quantity || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination currentPage={expeditionTable.currentPage} totalPages={expeditionTable.totalPages} onPageChange={expeditionTable.setCurrentPage} />
        </div>
      </div>

      <div className="card p-8 flex flex-col items-center justify-center text-center bg-black text-white">
        <FileText size={48} className="mb-4 opacity-50" />
        <h3 className="text-xl font-bold mb-2">Exportação Consolidada</h3>
        <p className="text-gray-400 mb-6 max-w-md">Utilize os botões acima para exportar relatórios detalhados de cada módulo com todas as informações de itens e motoristas.</p>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const systemUser = auth.currentUser;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'items', label: 'Itens', icon: Package },
    { id: 'inventory', label: 'Estoque', icon: FileSpreadsheet },
    { id: 'inbound', label: 'Inbound', icon: ArrowDownCircle },
    { id: 'trucks', label: 'Portaria', icon: Truck },
    { id: 'expedition', label: 'Expedição', icon: ArrowUpCircle },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'audit', label: 'Auditoria', icon: History },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'items': return <ItemsManager />;
      case 'inventory': return <InventoryManager />;
      case 'inbound': return <InboundManager />;
      case 'trucks': return <TruckControl />;
      case 'expedition': return <ExpeditionManager />;
      case 'reports': return <ReportsView />;
      case 'audit': return <AuditLogView />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-black/5 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center justify-between mb-10 px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-bold text-xl">
                Z
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">ZYX Logística</h2>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">WMS System</p>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {menuItems.map(item => (
              <SidebarItem 
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeTab === item.id}
                onClick={() => { setActiveTab(item.id); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
              />
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-black/5">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 overflow-hidden">
                <Settings size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold truncate">{systemUser.displayName || 'Acesso direto'}</p>
                <p className="text-xs text-gray-400 truncate">{systemUser.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:pl-72' : 'pl-0'}`}>
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-black/5 px-8 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg">
            <Menu size={24} />
          </button>
          
          <div className="flex-1 max-w-md mx-8 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                placeholder="Pesquisar em todo o sistema..." 
                className="w-full bg-gray-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-black/5"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                SISTEMA ONLINE
              </span>
              <span className="text-[10px] text-gray-400 font-mono">V 2.4.0</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer">
              <MoreVertical size={20} />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
