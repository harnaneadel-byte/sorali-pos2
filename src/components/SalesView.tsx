import React, { useState } from 'react';
import { Sale, UserRole } from '../types';
import {
  FileText,
  Printer,
  Ban,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  AlertTriangle,
  Pencil,
  Trash2,
} from 'lucide-react';

interface SalesViewProps {
  sales: Sale[];
  onViewReceipt: (sale: Sale, initialMode?: 'thermal' | 'a4') => void;
  onCancelSale: (saleId: string, reason: string) => Promise<void>;
  onUpdateSale?: (saleId: string, updates: any) => Promise<void>;
  onDeleteSale?: (saleId: string, restoreStock: boolean) => Promise<void>;
  currentRole: UserRole;
  currentUserName: string;
}

export const SalesView: React.FC<SalesViewProps> = ({
  sales,
  onViewReceipt,
  onCancelSale,
  onUpdateSale,
  onDeleteSale,
  currentRole,
  currentUserName,
}) => {
  const safeSales = Array.isArray(sales) ? sales : [];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Admin/Manager Full Control: Edit & Delete Invoice
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editSaleForm, setEditSaleForm] = useState({
    customer_name: '',
    cashier_name: '',
    paid_amount: 0,
    notes: '',
  });
  const [isSavingSale, setIsSavingSale] = useState(false);

  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState(true);
  const [isDeletingSale, setIsDeletingSale] = useState(false);

  const filteredSales = safeSales.filter((s) => {
  if (statusFilter === 'completed' && s.status === 'cancelled') return false;
  if (statusFilter === 'cancelled' && s.status !== 'cancelled') return false;

  if (search.trim()) {
    const q = search.toLowerCase();
    return (
      (s.invoice_number || '').toLowerCase().includes(q) ||
      (s.customer_name || '').toLowerCase().includes(q) ||
      (s.customers?.name || '').toLowerCase().includes(q) ||
      (s.customer?.name || '').toLowerCase().includes(q) ||
      (s.cashier_name || '').toLowerCase().includes(q)
    );
  }
  return true;
});

  const canCancel = currentRole === 'Admin' || currentRole === 'Manager';

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingSale) return;
    setCancelError(null);
    setIsCancelling(true);
    try {
      await onCancelSale(cancellingSale.id, cancelReason || 'Annulation manuelle autorisée');
      setCancellingSale(null);
      setCancelReason('');
    } catch (err: any) {
      setCancelError(err.message || "Impossible d'annuler la facture.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 font-cinzel">Journal des Factures &amp; Ventes</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Historique fiscal complet, réimpression de tickets thermiques et factures grand format A4.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Numéro de facture, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8.5 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-3.5">N° Facture</th>
                <th className="p-3.5">Date &amp; Heure</th>
                <th className="p-3.5">Client</th>
                <th className="p-3.5">Caissier</th>
                <th className="p-3.5 text-right">Net à Payer</th>
                <th className="p-3.5 text-right">Payé</th>
                <th className="p-3.5 text-right">Créance Restante</th>
                <th className="p-3.5 text-center">Statut</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredSales.map((sale) => {
                const isCancelled = sale.status === 'cancelled';
                const remaining = Math.max(0, sale.total_net - sale.paid_amount);

                return (
                  <tr
                    key={sale.id}
                    className={`hover:bg-stone-50/80 transition ${
                      isCancelled ? 'bg-rose-50/20 opacity-70' : ''
                    }`}
                  >
                    <td className="p-3.5 font-mono font-bold text-amber-900 whitespace-nowrap">
                      {sale.invoice_number}
                    </td>

                    <td className="p-3.5 text-stone-500 text-[11px] whitespace-nowrap">
                      {new Date(sale.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="p-3.5 font-medium text-stone-900">
                      {sale.customer_name}
                    </td>

                    <td className="p-3.5 text-stone-500 text-[11px]">
                      {sale.cashier_name}
                    </td>

                    <td className="p-3.5 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                      {sale.total_net.toLocaleString('fr-FR')} DA
                    </td>

                    <td className="p-3.5 text-right font-mono text-emerald-800 font-semibold whitespace-nowrap">
                      {sale.paid_amount.toLocaleString('fr-FR')} DA
                    </td>

                    <td className="p-3.5 text-right font-mono whitespace-nowrap">
                      {remaining > 0 ? (
                        <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                          {remaining.toLocaleString('fr-FR')} DA
                        </span>
                      ) : (
                        <span className="text-stone-400">0 DA</span>
                      )}
                    </td>

                    <td className="p-3.5 text-center whitespace-nowrap">
                      {isCancelled ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-semibold text-[10px]">
                          ANNULÉE
                        </span>
                      ) : sale.paid_amount >= sale.total_net ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-semibold text-[10px]">
                          PAYÉE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-semibold text-[10px]">
                          CRÉDIT PARTIEL
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onViewReceipt(sale, 'thermal')}
                          className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs transition cursor-pointer"
                          title="Ticket Thermique 80mm"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onViewReceipt(sale, 'a4')}
                          className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs transition cursor-pointer"
                          title="Facture Grand Format A4"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {!isCancelled && canCancel && (
                          <button
                            onClick={() => setCancellingSale(sale)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs transition cursor-pointer"
                            title="Annuler la facture (Restitution du stock)"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canCancel && (
                          <>
                            <button
                              onClick={() => {
                                setEditingSale(sale);
                                setEditSaleForm({
                                  customer_name: sale.customer_name || '',
                                  cashier_name: sale.cashier_name || '',
                                  paid_amount: sale.paid_amount || 0,
                                  notes: sale.notes || '',
                                });
                              }}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs transition cursor-pointer"
                              title="Modifier la facture"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingSale(sale);
                                setRestoreStockOnDelete(true);
                              }}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs transition cursor-pointer"
                              title="Supprimer la facture"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      {cancellingSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center gap-2 text-rose-700 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold font-cinzel text-base">Annulation de Facture</h3>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              Êtes-vous certain de vouloir annuler la facture{' '}
              <strong className="font-mono text-stone-900">{cancellingSale.invoice_number}</strong> ?
              Cette action réinjectera automatiquement les articles dans le stock et annulera la créance
              du client de manière atomique.
            </p>

            {cancelError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleConfirmCancel} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Motif d'annulation obligatoire *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Erreur de saisie caisse / Refus client"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancellingSale(null)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? 'Annulation en cours...' : 'Confirmer Annulation & Restituer Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT INVOICE MODAL (Admin & Manager) */}
      {editingSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-cinzel">Modifier la Facture</h3>
                <p className="text-xs text-stone-500 font-mono">{editingSale.invoice_number}</p>
              </div>
              <button
                onClick={() => setEditingSale(null)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onUpdateSale) return;
                setIsSavingSale(true);
                try {
                  const paid = Number(editSaleForm.paid_amount) || 0;
                  const total = editingSale.total_net ?? editingSale.total_amount ?? 0;
                  const payment_status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

                  await onUpdateSale(editingSale.id, {
                    customer_name: editSaleForm.customer_name,
                    cashier_name: editSaleForm.cashier_name,
                    paid_amount: paid,
                    payment_status,
                    notes: editSaleForm.notes,
                  });
                  setEditingSale(null);
                } catch (err: any) {
                  alert(err.message || 'Erreur modification facture');
                } finally {
                  setIsSavingSale(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex justify-between font-mono">
                <span className="text-stone-600">Montant Total Net:</span>
                <span className="font-bold text-stone-900 text-sm">
                  {(editingSale.total_net ?? 0).toLocaleString('fr-FR')} DA
                </span>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Nom du Client</label>
                <input
                  type="text"
                  required
                  value={editSaleForm.customer_name}
                  onChange={(e) => setEditSaleForm({ ...editSaleForm, customer_name: e.target.value })}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Nom du Vendeur / Caissier</label>
                <input
                  type="text"
                  required
                  value={editSaleForm.cashier_name}
                  onChange={(e) => setEditSaleForm({ ...editSaleForm, cashier_name: e.target.value })}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Montant Encaissé (DA)</label>
                <input
                  type="number"
                  min={0}
                  max={editingSale.total_net}
                  value={editSaleForm.paid_amount}
                  onChange={(e) => setEditSaleForm({ ...editSaleForm, paid_amount: Number(e.target.value) })}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-800"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Reste à charge client : {Math.max(0, (editingSale.total_net ?? 0) - editSaleForm.paid_amount).toLocaleString('fr-FR')} DA
                </span>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Notes / Mentions Particulières</label>
                <input
                  type="text"
                  value={editSaleForm.notes}
                  onChange={(e) => setEditSaleForm({ ...editSaleForm, notes: e.target.value })}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingSale}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingSale ? 'Sauvegarde...' : 'Sauvegarder Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE INVOICE CONFIRMATION MODAL (Admin & Manager) */}
      {deletingSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-900 font-cinzel">Supprimer la Facture</h3>
            </div>

            <p className="text-xs text-stone-600 mb-3 leading-relaxed">
              Êtes-vous certain de vouloir supprimer définitivement la facture{' '}
              <strong className="font-mono text-stone-900 font-bold">{deletingSale.invoice_number}</strong> ?
            </p>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl mb-4 space-y-2 text-xs">
              <label className="flex items-center gap-2 font-semibold text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restoreStockOnDelete}
                  onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Restituer les articles dans l'inventaire physique</span>
              </label>
              <p className="text-[10px] text-stone-500 pl-5">
                Réintègre automatiquement les quantités vendues dans les stocks des dépôts.
              </p>
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingSale(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeletingSale}
                onClick={async () => {
                  if (!onDeleteSale) return;
                  setIsDeletingSale(true);
                  try {
                    await onDeleteSale(deletingSale.id, restoreStockOnDelete);
                    setDeletingSale(null);
                  } catch (err: any) {
                    alert(err.message || 'Erreur suppression facture');
                  } finally {
                    setIsDeletingSale(false);
                  }
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isDeletingSale ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
