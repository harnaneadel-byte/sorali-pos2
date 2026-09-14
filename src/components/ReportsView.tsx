import React, { useState } from 'react';
import { Customer, Product, Sale, StockMovement, UserRole } from '../types';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Boxes,
  Users,
  ShieldCheck,
  Activity,
  Calendar,
  Trash2,
  RefreshCw,
  Printer,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface ReportsViewProps {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  movements: StockMovement[];
  currentRole: UserRole;
  onPurgeMovements?: (beforeDate?: string) => Promise<void>;
  onResetReports?: (options: {
    reset_sales?: boolean;
    reset_movements?: boolean;
    recalculate_balances?: boolean;
  }) => Promise<void>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  sales,
  products,
  customers,
  movements,
  currentRole,
  onPurgeMovements,
  onResetReports,
}) => {
  const safeSales = Array.isArray(sales) ? sales : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeMovements = Array.isArray(movements) ? movements : [];

  const isAdminOrManager = currentRole === 'Admin' || currentRole === 'Manager';

  const [period, setPeriod] = useState<'all' | 'today' | '7days' | 'month'>('all');

  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [purgeDate, setPurgeDate] = useState('');
  const [resetSalesChecked, setResetSalesChecked] = useState(false);
  const [resetMovementsChecked, setResetMovementsChecked] = useState(false);
  const [recalcBalancesChecked, setRecalcBalancesChecked] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const now = new Date();
  const filteredSales = safeSales.filter((s) => {
    if (!s.created_at) return true;
    const saleDate = new Date(s.created_at);
    if (period === 'today') {
      return saleDate.toDateString() === now.toDateString();
    }
    if (period === '7days') {
      const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7;
    }
    if (period === 'month') {
      return (
        saleDate.getMonth() === now.getMonth() &&
        saleDate.getFullYear() === now.getFullYear()
      );
    }
    return true;
  });

  const validSales = filteredSales.filter((s) => s.status !== 'cancelled');

  const totalGrossSales = validSales.reduce(
    (acc, s) => acc + (s.total_gross ?? s.total_amount ?? 0),
    0
  );
  const totalDiscounts = validSales.reduce(
    (acc, s) => acc + (s.total_discount ?? s.discount_total ?? 0),
    0
  );
  const totalNetSales = validSales.reduce(
    (acc, s) => acc + (s.total_net ?? s.total_amount ?? 0),
    0
  );

  const totalCOGS = validSales.reduce((acc, s) => {
    const items = Array.isArray(s.items) ? s.items : [];
    const saleCOGS = items.reduce((itemAcc, item) => {
      const prod = safeProducts.find((p) => p.id === item.product_id);
      const purchasePrice = prod ? (prod.purchase_price ?? 0) : 0;
      return itemAcc + (item.quantity_units ?? 0) * purchasePrice;
    }, 0);
    return acc + saleCOGS;
  }, 0);

  const grossProfit = totalNetSales - totalCOGS;
  const profitMarginPercent =
    totalNetSales > 0 ? ((grossProfit / totalNetSales) * 100).toFixed(1) : '0.0';

  const totalCustomerDebt = safeCustomers.reduce((acc, c) => acc + (c.balance ?? 0), 0);
  const totalStockValuation = safeProducts.reduce(
    (acc, p) => acc + (p.current_stock_units ?? 0) * (p.purchase_price ?? 0),
    0
  );

  // ============================================
  // PRINT HANDLER — opens isolated window
  // ============================================
  const handlePrint = () => {
    const printContent = document.getElementById('printable-report');
    if (!printContent) {
      alert("Erreur: Contenu du rapport introuvable.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les popups/fenêtres pour imprimer le rapport.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Rapport de Gestion - Sorali Distribution</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .font-cinzel { font-family: 'Cinzel', serif; }
          .no-print { display: none !important; }
          @media print {
            @page { margin: 1.5cm; size: A4; }
            body { background: white !important; }
            .grid > div, .space-y-2 > div, .space-y-2\\.5 > div { break-inside: avoid; }
          }
        </style>
      </head>
      <body class="p-6 bg-white text-stone-900">
        <div class="mb-6 text-center border-b pb-4">
          <h1 class="text-2xl font-bold font-cinzel text-stone-900">SARL SORALI DISTRIBUTION</h1>
          <p class="text-sm text-stone-500">Rapport Financier & Audit de Gestion — ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 1500);
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div id="printable-report" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 font-cinzel">Rapports Financiers &amp; Audit de Gestion</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Analyse de rentabilité, marge brute réelle, valorisation des actifs et encours clients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
            {(
              [
                { id: 'all', label: 'Tout' },
                { id: 'today', label: "Aujourd'hui" },
                { id: '7days', label: '7 jours' },
                { id: 'month', label: 'Ce mois' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setPeriod(t.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  period === t.id
                    ? 'bg-white text-stone-900 shadow-xs font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 border border-stone-200"
            title="Imprimer le rapport"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimer</span>
          </button>

          {isAdminOrManager && (
            <button
              onClick={() => {
                setActionSuccessMsg(null);
                setIsManageModalOpen(true);
              }}
              className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition cursor-pointer text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              title="Gestion et purge des rapports"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Gestion Rapports</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Performance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-stone-400 tracking-wider">
            Chiffre d'Affaires Net
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-stone-900 mt-1 font-mono">
            {totalNetSales.toLocaleString('fr-FR')} <span className="text-xs font-normal text-stone-500">DA</span>
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            Remises accordées: {totalDiscounts.toLocaleString('fr-FR')} DA
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-stone-400 tracking-wider">
            Coût des Marchandises (COGS)
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-stone-800 mt-1 font-mono">
            {totalCOGS.toLocaleString('fr-FR')} <span className="text-xs font-normal text-stone-500">DA</span>
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            Au coût d'achat unitaire fournisseur
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-emerald-800 tracking-wider">
            Marge Brute Réalisée
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-800 mt-1 font-mono">
            {grossProfit.toLocaleString('fr-FR')} <span className="text-xs font-normal">DA</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-bold mt-1">
            Taux de marge: {profitMarginPercent}%
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-amber-800 tracking-wider">
            Créances Clients en Attente
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-900 mt-1 font-mono">
            {totalCustomerDebt.toLocaleString('fr-FR')} <span className="text-xs font-normal">DA</span>
          </div>
          <div className="text-[11px] text-amber-700 mt-1">
            {customers.filter((c) => c.balance > 0).length} clients débiteurs
          </div>
        </div>
      </div>



      {/* ADMIN & MANAGER MANAGEMENT MODAL */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-stone-100 rounded-lg text-stone-800">
                  <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 font-cinzel">
                    Administration des Rapports &amp; Données
                  </h3>
                  <p className="text-xs text-stone-500">
                    Réservé aux Administrateurs et Responsables (Admin &amp; Manager)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {actionSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{actionSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Section 1: Purge Mouvements de stock */}
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Purger l'Historique des Mouvements de Stock</span>
                  </div>
                  <span className="text-[10px] text-stone-500 font-mono">
                    {safeMovements.length} mouvements enregistrés
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Permet d'archiver ou supprimer les anciens logs d'entrées, sorties et casses sans modifier le stock physique actuel des produits.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="date"
                    value={purgeDate}
                    onChange={(e) => setPurgeDate(e.target.value)}
                    className="border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs bg-white"
                  />
                  <button
                    type="button"
                    disabled={isProcessingAction}
                    onClick={async () => {
                      if (!onPurgeMovements) return;
                      const conf = window.confirm(
                        purgeDate
                          ? `Supprimer définitivement les mouvements antérieurs au ${purgeDate} ?`
                          : `Supprimer TOUS les ${safeMovements.length} mouvements d'historique ?`
                      );
                      if (!conf) return;
                      setIsProcessingAction(true);
                      try {
                        await onPurgeMovements(purgeDate || undefined);
                        setActionSuccessMsg('Historique des mouvements purgé avec succès.');
                      } catch (err: any) {
                        alert(err.message || 'Erreur lors de la purge');
                      } finally {
                        setIsProcessingAction(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {purgeDate ? 'Purger avant cette date' : 'Purger Tout'}
                  </button>
                </div>
              </div>

              {/* Section 2: Réinitialisation / Recalcul Rapports */}
              <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                  <span>Réinitialisation Ciblée des Données Comptables</span>
                </div>
                <p className="text-[11px] text-stone-600">
                  Sélectionnez les modules que vous souhaitez réinitialiser pour ouvrir un nouvel exercice ou assainir la base de données.
                </p>
                <div className="space-y-2 bg-white p-3 rounded-xl border border-amber-100">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                    <input
                      type="checkbox"
                      checked={recalcBalancesChecked}
                      onChange={(e) => setRecalcBalancesChecked(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Recalculer les soldes clients à partir des factures actives</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                    <input
                      type="checkbox"
                      checked={resetSalesChecked}
                      onChange={(e) => setResetSalesChecked(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span className="text-rose-800">Purger toutes les factures de vente (Chiffre d'Affaires remis à zéro)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                    <input
                      type="checkbox"
                      checked={resetMovementsChecked}
                      onChange={(e) => setResetMovementsChecked(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Purger le journal d'audit de stock</span>
                  </label>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={isProcessingAction || (!resetSalesChecked && !resetMovementsChecked && !recalcBalancesChecked)}
                    onClick={async () => {
                      if (!onResetReports) return;
                      const conf = window.confirm(
                        "Êtes-vous certain de vouloir exécuter cette opération d'administration ?"
                      );
                      if (!conf) return;
                      setIsProcessingAction(true);
                      try {
                        await onResetReports({
                          reset_sales: resetSalesChecked,
                          reset_movements: resetMovementsChecked,
                          recalculate_balances: recalcBalancesChecked,
                        });
                        setActionSuccessMsg('Opération terminée et rapports mis à jour avec succès.');
                      } catch (err: any) {
                        alert(err.message || 'Erreur réinitialisation rapports');
                      } finally {
                        setIsProcessingAction(false);
                      }
                    }}
                    className="px-4 py-2 bg-stone-900 hover:bg-black text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingAction ? 'Traitement en cours...' : 'Exécuter les Opérations Sélectionnées'}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};