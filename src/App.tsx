import { LoginScreen } from './components/LoginScreen';
import { getToken, getStoredUser, setSession, clearSession } from './lib/auth';
import { LogOut } from 'lucide-react';
import React, { useEffect, useState, useCallback } from 'react';
import { Customer, DistributionTask, Product, Sale, StockMovement, TaskStatus, UserRole, CustomerLedgerEntry, PaymentMethod } from './types';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { Navbar } from './components/Navbar';
import { TasksView } from './components/TasksView';
import { PosView } from './components/PosView';
import { StockView } from './components/StockView';
import { CustomersView } from './components/CustomersView';
import { SalesView } from './components/SalesView';
import { ReportsView } from './components/ReportsView';
import { ReceiptModal } from './components/ReceiptModal';
import { TerminalsDrawer } from './components/TerminalsDrawer';
import { CheckSquare, ShoppingCart, Boxes, Users, FileText, BarChart3, Bell } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'pos' | 'stock' | 'customers' | 'sales' | 'reports'>('tasks');
  const [currentRole, setCurrentRole] = useState<UserRole>('Admin');
  const [currentUserName, setCurrentUserName] = useState<string>('Adel Harnane');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const [tasks, setTasks] = useState<DistributionTask[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  const [isTerminalsDrawerOpen, setIsTerminalsDrawerOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [receiptInitialMode, setReceiptInitialMode] = useState<'thermal' | 'a4'>('thermal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const safeSetProducts = useCallback((raw: any) => setProducts(Array.isArray(raw) ? raw : raw?.products || raw?.data || []), []);
  const safeSetCustomers = useCallback((raw: any) => setCustomers(Array.isArray(raw) ? raw : raw?.customers || raw?.data || []), []);
  const safeSetSales = useCallback((raw: any) => setSales(Array.isArray(raw) ? raw : raw?.sales || raw?.data || []), []);
  const safeSetTasks = useCallback((raw: any) => setTasks(Array.isArray(raw) ? raw : raw?.tasks || raw?.data || []), []);
  const safeSetStockMovements = useCallback((raw: any) => setStockMovements(Array.isArray(raw) ? raw : raw?.movements || raw?.data || []), []);

  const { isConnected, terminals, terminalId, eventLog, addEventListener } = useRealtimeSync(currentRole, currentUserName);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 4500);
  };

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [tasksRes, productsRes, customersRes, salesRes, movementsRes] = await Promise.all([
        fetch('/api/tasks'), fetch('/api/products'), fetch('/api/customers'), fetch('/api/sales'), fetch('/api/stock/movements'),
      ]);
      if (tasksRes.ok) safeSetTasks(await tasksRes.json());
      if (productsRes.ok) safeSetProducts(await productsRes.json());
      if (customersRes.ok) safeSetCustomers(await customersRes.json());
      if (salesRes.ok) safeSetSales(await salesRes.json());
      if (movementsRes.ok) safeSetStockMovements(await movementsRes.json());
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [safeSetCustomers, safeSetProducts, safeSetSales, safeSetStockMovements, safeSetTasks]);

    // Only load data AFTER the user is logged in
  useEffect(() => {
    if (currentUser) fetchData();
  }, [fetchData, currentUser]);

  // Restore session on load (stay logged in across refreshes)
  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (token && stored) {
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.user) {
            setCurrentUser(d.user);
            setCurrentRole(d.user.role as UserRole);
            setCurrentUserName(d.user.name);
          } else {
            clearSession();
          }
          setAuthReady(true);
        })
        .catch(() => {
          clearSession();
          setAuthReady(true);
        });
    } else {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    const unsubTaskCreated = addEventListener('task:created', (p: DistributionTask) => { setTasks((prev) => [p, ...prev.filter((t) => t.id !== p.id)]); showToast(`⚡ Nouvelle tâche: "${p.title}"`); });
    const unsubTaskUpdated = addEventListener('task:updated', (p: DistributionTask) => { setTasks((prev) => prev.map((t) => (t.id === p.id ? p : t))); });
    const unsubSaleCompleted = addEventListener('sale:completed', (p: { sale: Sale }) => {
      setSales((prev) => [p.sale, ...prev.filter((s) => s.id !== p.sale.id)]);
      setProducts((prev) => prev.map((prod) => { const sold = p.sale.items?.find((i) => i.product_id === prod.id); return sold ? { ...prod, current_stock_units: Math.max(0, (prod.current_stock_units ?? 0) - sold.quantity_units) } : prod; }));
      showToast(`🛒 Vente enregistrée: ${p.sale.invoice_number}`);
    });
    const unsubSaleCancelled = addEventListener('sale:cancelled', (p: { sale: Sale }) => { setSales((prev) => prev.map((s) => (s.id === p.sale.id ? p.sale : s))); fetch('/api/products').then((r) => r.json()).then(safeSetProducts); });
    const unsubStockUpdated = addEventListener('stock:updated', (p: { movement: StockMovement }) => { if (p.movement) setStockMovements((prev) => [p.movement, ...prev]); fetch('/api/products').then((r) => r.json()).then(safeSetProducts); });
    const unsubCustomerPayment = addEventListener('customer:payment', () => { fetch('/api/customers').then((r) => r.json()).then(safeSetCustomers); });
    return () => { unsubTaskCreated(); unsubTaskUpdated(); unsubSaleCompleted(); unsubSaleCancelled(); unsubStockUpdated(); unsubCustomerPayment(); };
  }, [addEventListener, safeSetCustomers, safeSetProducts]);

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    if (!res.ok) throw new Error('Échec de la mise à jour');
    const d = await res.json(); setTasks((prev) => prev.map((t) => (t.id === taskId ? (d.task || d) : t)));
  };

  const handleCreateTask = async (taskData: Partial<DistributionTask>) => {
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) });
    if (!res.ok) throw new Error('Erreur lors de la création');
    const d = await res.json(); setTasks((prev) => [d.task || d, ...prev]);
  };

  // CLEAN CHECKOUT HANDLER
  const handleCheckout = async (checkoutData: any): Promise<any> => {
    const res = await fetch('/api/sales/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...checkoutData, user_name: currentUserName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      const msg = data?.error?.message || data?.message || 'Erreur de validation';
      throw new Error(msg); 
    }
    const sale = data.sale || data.result;
    if (sale) setSales((prev) => [sale, ...prev.filter((s) => s.id !== sale.id)]);
    fetch('/api/products').then((r) => r.json()).then(safeSetProducts);
    fetch('/api/customers').then((r) => r.json()).then(safeSetCustomers);
    return sale;
  };

  const handleStockEntry = async (productId: string, units: number, note: string) => {
    const res = await fetch('/api/stock/entry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, warehouse_id: 'wh_main_01', quantity_units: units, user_name: currentUserName, note }) });
    if (!res.ok) throw new Error("Échec de l'entrée");
    const d = await res.json(); if (d.movement || d) setStockMovements((prev) => [d.movement || d, ...prev]);
    fetch('/api/products')
  .then((r) => r.json())
  .then(safeSetProducts);
  };

  const handleStockDamage = async (productId: string, units: number, note: string) => {
    const res = await fetch('/api/stock/damage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, warehouse_id: 'wh_main_01', quantity_units: units, user_name: currentUserName, note }) });
    if (!res.ok) throw new Error('Échec de la casse');
    const d = await res.json(); if (d.movement || d) setStockMovements((prev) => [d.movement || d, ...prev]);
    fetch('/api/products').then((r) => r.json()).then(safeSetProducts);
  };

  const handleStockAdjust = async (productId: string, newUnits: number, note: string) => {
    const res = await fetch('/api/stock/adjust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, warehouse_id: 'wh_main_01', target_units: newUnits, user_name: currentUserName, note }) });
    if (!res.ok) throw new Error("Échec de l'ajustement");
    const d = await res.json(); if (d.movement || d) setStockMovements((prev) => [d.movement || d, ...prev]);
    fetch('/api/products').then((r) => r.json()).then(safeSetProducts);
  };

  const handleFetchLedger = async (customerId: string): Promise<CustomerLedgerEntry[]> => {
    const res = await fetch(`/api/customers/${customerId}/ledger`);
    if (!res.ok) throw new Error('Erreur chargement grand livre');
    const d = await res.json(); return Array.isArray(d) ? d : d?.entries || [];
  };

  const handleRecordPayment = async (customerId: string, amount: number, method: PaymentMethod, note: string) => {
    const res = await fetch(`/api/customers/${customerId}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, payment_method: method, user_name: currentUserName, note }) });
    if (!res.ok) throw new Error('Erreur lors du règlement');
    fetch('/api/customers').then((r) => r.json()).then(safeSetCustomers);
  };

  const handleCancelSale = async (saleId: string, reason: string) => {
    const res = await fetch(`/api/sales/${saleId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, user_role: currentRole, user_name: currentUserName }) });
    if (!res.ok) throw new Error("Impossible d'annuler");
    const d = await res.json(); setSales((prev) => prev.map((s) => (s.id === saleId ? (d.sale || d) : s)));
    fetch('/api/products').then((r) => r.json()).then(safeSetProducts);
    fetch('/api/customers').then((r) => r.json()).then(safeSetCustomers);
  };

  const handleViewReceipt = (sale: Sale, initialMode: 'thermal' | 'a4' = 'thermal') => { setReceiptSale(sale); setReceiptInitialMode(initialMode); };
  const handleLogin = (user: any, token: string) => {
    setSession(token, user);
    setCurrentUser(user);
    setCurrentRole(user.role as UserRole);
    setCurrentUserName(user.name);
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearSession();
    setCurrentUser(null);
    setCurrentUserName('');
  };
  const handleCreateProduct = async (productData: any) => {
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productData) });
    if (!res.ok) throw new Error('Échec de création');
    const d = await res.json(); setProducts((prev) => [d.product || d, ...prev]);
  };
  const handleUpdateProduct = async (productId: string, updates: any) => {
    const res = await fetch(`/api/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    if (!res.ok) throw new Error('Échec de modification');
    const d = await res.json(); setProducts((prev) => prev.map((p) => (p.id === productId ? (d.product || d) : p)));
  };
  const handleDeleteProduct = async (productId: string) => {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Échec de suppression');
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleAddCustomer = async (customerData: any) => {
    const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customerData) });
    if (!res.ok) throw new Error('Échec de création');
    const d = await res.json(); setCustomers((prev) => [d.customer || d, ...prev]);
  };
  const handleUpdateCustomer = async (customerId: string, updates: any) => {
    const res = await fetch(`/api/customers/${customerId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    if (!res.ok) throw new Error('Échec de modification');
    const d = await res.json(); setCustomers((prev) => prev.map((c) => (c.id === customerId ? (d.customer || d) : c)));
  };
  const handleDeleteCustomer = async (customerId: string) => {
    const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Échec de suppression');
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
  };

  const handleUpdateSale = async (saleId: string, updates: any) => {
    const res = await fetch(`/api/sales/${saleId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    if (!res.ok) throw new Error('Échec de modification');
    const d = await res.json(); setSales((prev) => prev.map((s) => (s.id === saleId ? (d.sale || d) : s)));
  };
  const handleDeleteSale = async (saleId: string, restoreStock: boolean) => {
    const res = await fetch(`/api/sales/${saleId}?restore_stock=${restoreStock}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Échec de suppression');
    setSales((prev) => prev.filter((s) => s.id !== saleId));
    fetch('/api/products').then((r) => r.json()).then(safeSetProducts);
  };

  const handlePurgeMovements = async (beforeDate?: string) => {
    const res = await fetch('/api/movements/purge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ before_date: beforeDate }) });
    if (!res.ok) throw new Error('Échec de purge');
    fetch('/api/movements').then((r) => r.json()).then((d) => setStockMovements(Array.isArray(d) ? d : []));
  };
  const handleResetReports = async (options: any) => {
    const res = await fetch('/api/reports/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) });
    if (!res.ok) throw new Error('Échec de réinitialisation');
    fetchData();
  };

  const pendingTasksCount = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;
  // ---- AUTH GATE ----
  if (!authReady) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }
  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-800 flex flex-col font-sans">
      <Navbar
  activeTab={activeTab}
  setActiveTab={setActiveTab}
  currentRole={currentRole}
  currentUserName={currentUserName}
  isConnected={isConnected}
  terminalsCount={terminals.length}
  onOpenTerminals={() => setIsTerminalsDrawerOpen(true)}
  taskCount={pendingTasksCount}
/>
      {/* Logged-in user badge + Logout */}
      <button
        onClick={handleLogout}
        className="fixed bottom-16 sm:bottom-6 left-4 z-40 inline-flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 rounded-xl shadow-lg text-xs font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer no-print"
        title="Se déconnecter"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>{currentUserName}</span>
        <LogOut className="w-3.5 h-3.5 text-stone-400" />
      </button>
      {toastMessage && (
        <div className="fixed bottom-16 sm:bottom-6 right-4 z-40 bg-stone-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-stone-700 flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom-3 duration-200 no-print">
          <Bell className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-stone-400 hover:text-white ml-2 text-xs cursor-pointer">✕</button>
        </div>
      )}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 pb-20 sm:pb-8">
        {isLoading ? (
          <div className="py-20 text-center space-y-3"><div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <>
            {activeTab === 'tasks' && <TasksView tasks={tasks} onUpdateTaskStatus={handleUpdateTaskStatus} onCreateTask={handleCreateTask} currentRole={currentRole} currentUserName={currentUserName} />}
            {activeTab === 'pos' && <PosView products={products} customers={customers} onCheckout={handleCheckout} currentRole={currentRole} currentUserName={currentUserName} onViewReceipt={(s) => handleViewReceipt(s, 'thermal')} />}
            {activeTab === 'stock' && <StockView products={products} movements={stockMovements} onStockEntry={handleStockEntry} onStockDamage={handleStockDamage} onStockAdjust={handleStockAdjust} currentRole={currentRole} currentUserName={currentUserName} onCreateProduct={handleCreateProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} />}
            {activeTab === 'customers' && <CustomersView customers={customers} onFetchLedger={handleFetchLedger} onRecordPayment={handleRecordPayment} currentRole={currentRole} onAddCustomer={handleAddCustomer} onUpdateCustomer={handleUpdateCustomer} onDeleteCustomer={handleDeleteCustomer} />}
            {activeTab === 'sales' && <SalesView sales={sales} onViewReceipt={handleViewReceipt} onCancelSale={handleCancelSale} onUpdateSale={handleUpdateSale} onDeleteSale={handleDeleteSale} currentRole={currentRole} currentUserName={currentUserName} />}
            {activeTab === 'reports' && <ReportsView sales={sales} products={products} customers={customers} movements={stockMovements} currentRole={currentRole} onPurgeMovements={handlePurgeMovements} onResetReports={handleResetReports} />}
          </>
        )}
      </main>
      <div className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 z-30 py-1.5 px-2 flex justify-around no-print shadow-lg">
        {[{ id: 'tasks', label: 'Tâches', icon: CheckSquare }, { id: 'pos', label: 'Caisse', icon: ShoppingCart }, { id: 'stock', label: 'Stock', icon: Boxes }, { id: 'customers', label: 'Créance', icon: Users }, { id: 'sales', label: 'Factures', icon: FileText }, { id: 'reports', label: 'Rapports', icon: BarChart3 }].map((item) => {
          const Icon = item.icon; const isActive = activeTab === item.id;
          return <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-medium transition ${isActive ? 'text-amber-700 font-bold' : 'text-stone-500'}`}><Icon className="w-4 h-4" /><span>{item.label}</span></button>;
        })}
      </div>
      {receiptSale && <ReceiptModal sale={receiptSale} initialMode={receiptInitialMode} onClose={() => setReceiptSale(null)} />}
      <TerminalsDrawer isOpen={isTerminalsDrawerOpen} onClose={() => setIsTerminalsDrawerOpen(false)} terminals={terminals} currentTerminalId={terminalId} eventLog={eventLog} />
    </div>
  );
}