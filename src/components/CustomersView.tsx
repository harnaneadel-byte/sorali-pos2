import React, { useState } from 'react';
import { Customer, CustomerLedgerEntry, PaymentMethod, UserRole } from '../types';
import {
  Users,
  Building2,
  Phone,
  MapPin,
  Percent,
  Banknote,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  History,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';

interface CustomersViewProps {
  customers: Customer[];
  onFetchLedger: (customerId: string) => Promise<CustomerLedgerEntry[]>;
  onRecordPayment: (
    customerId: string,
    amount: number,
    method: PaymentMethod,
    note: string
  ) => Promise<void>;
  currentRole?: UserRole;
  onAddCustomer?: (customerData: any) => Promise<void>;
  onUpdateCustomer?: (customerId: string, updates: any) => Promise<void>;
  onDeleteCustomer?: (customerId: string) => Promise<void>;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onFetchLedger,
  onRecordPayment,
  currentRole,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
}) => {
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const isAdminOrManager = currentRole === 'Admin' || currentRole === 'Manager';

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(safeCustomers[0]?.id || '');
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(false);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Customer Management Modals (Admin & Manager)
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustForm, setNewCustForm] = useState({
    name: '',
    phone: '',
    address: '',
    default_discount_percent: 0,
    credit_limit: 500000,
    balance: 0,
  });

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustForm, setEditCustForm] = useState({
    name: '',
    phone: '',
    address: '',
    default_discount_percent: 0,
    credit_limit: 500000,
    balance: 0,
  });

  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // If selectedCustomerId is empty but we have customers, pick the first
  React.useEffect(() => {
    if (!selectedCustomerId && safeCustomers.length > 0) {
      setSelectedCustomerId(safeCustomers[0].id);
    }
  }, [safeCustomers, selectedCustomerId]);

  const selectedCustomer = safeCustomers.find((c) => c.id === selectedCustomerId) || safeCustomers[0];

  const handleSelectCustomer = (cid: string) => {
    setSelectedCustomerId(cid);
  };

  React.useEffect(() => {
    if (selectedCustomerId) {
      setIsLoadingLedger(true);
      onFetchLedger(selectedCustomerId)
        .then((entries) => {
          setLedgerEntries(Array.isArray(entries) ? entries : []);
        })
        .catch(() => {
          setLedgerEntries([]);
        })
        .finally(() => {
          setIsLoadingLedger(false);
        });
    }
  }, [selectedCustomerId]);

  const totalOutstandingDebt = safeCustomers.reduce((acc, c) => acc + (c.balance ?? 0), 0);

  const handleOpenPaymentModal = () => {
    if (!selectedCustomer) return;
    const curBalance = selectedCustomer.balance ?? 0;
    setPaymentAmount(String(curBalance > 0 ? curBalance : ''));
    setPaymentNote('Règlement de facture');
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setPaymentError(null);

    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Veuillez spécifier un montant positif.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onRecordPayment(selectedCustomer.id, amt, paymentMethod, paymentNote);
      setIsPaymentModalOpen(false);
      // Reload ledger
      const entries = await onFetchLedger(selectedCustomer.id);
      setLedgerEntries(Array.isArray(entries) ? entries : []);
    } catch (err: any) {
      setPaymentError(err.message || 'Erreur lors de la validation du paiement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Debtor Stats */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 font-cinzel">Comptes Clients &amp; Grand Livre Créances</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Suivi des soldes créditeurs, remises négociées et historique immuable des règlements.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl flex items-center gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase text-amber-800 tracking-wider">Créances Totales Marché</div>
            <div className="text-xl font-extrabold text-amber-950 font-mono">
              {totalOutstandingDebt.toLocaleString('fr-FR')} <span className="text-xs font-normal">DA</span>
            </div>
          </div>
        </div>
      </div>

      {safeCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-500 text-sm">
          Aucun client enregistré pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Customer Cards Column (5 Cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Clients Enregistrés ({safeCustomers.length})
              </div>
              {isAdminOrManager && (
                <button
                  onClick={() => setIsAddCustomerOpen(true)}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 cursor-pointer transition"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nouveau Client</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
              {safeCustomers.map((c) => {
                const isSelected = c.id === selectedCustomerId;
                const balance = c.balance ?? 0;
                const hasDebt = balance > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCustomer(c.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-500 shadow-sm'
                        : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                          <span>{c.name}</span>
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          <span>{c.address || 'Adresse non renseignée'}</span>
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span className="font-mono">{c.phone || 'Non renseigné'}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded ${
                            hasDebt
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {hasDebt ? `${balance.toLocaleString('fr-FR')} DA` : '0 DA (À jour)'}
                        </div>
                        {(c.default_discount_percent ?? 0) > 0 && (
                          <div className="text-[10px] text-amber-800 font-semibold mt-1">
                            Remise: {c.default_discount_percent}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ledger & Statements Column (7 Cols) */}
          {selectedCustomer && (
            <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs space-y-4">
              {/* Header of selected customer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200">
                <div>
                  <h3 className="text-base font-bold text-stone-900">{selectedCustomer.name}</h3>
                  <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                    <span>Plafond Crédit: {(selectedCustomer.credit_limit ?? 500000).toLocaleString('fr-FR')} DA</span>
                    <span>•</span>
                    <span>Remise par défaut: {selectedCustomer.default_discount_percent ?? 0}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenPaymentModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Encaisser un Règlement</span>
                  </button>

                  {isAdminOrManager && (
                    <>
                      <button
                        onClick={() => {
                          setEditingCustomer(selectedCustomer);
                          setEditCustForm({
                            name: selectedCustomer.name,
                            phone: selectedCustomer.phone || '',
                            address: selectedCustomer.address || '',
                            default_discount_percent: selectedCustomer.default_discount_percent || 0,
                            credit_limit: selectedCustomer.credit_limit || 500000,
                            balance: selectedCustomer.balance || 0,
                          });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                        title="Modifier le client"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>
                      <button
                        onClick={() => setDeletingCustomer(selectedCustomer)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                        title="Supprimer le client"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Ledger Transactions Table */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-2">
                  <span className="flex items-center gap-1">
                    <History className="w-3.5 h-3.5" /> Relevé de Compte Client (Grand Livre)
                  </span>
                  <span className="font-mono text-stone-800">
                    Solde actuel dû: <strong>{(selectedCustomer.balance ?? 0).toLocaleString('fr-FR')} DA</strong>
                  </span>
                </div>

                {isLoadingLedger ? (
                  <div className="py-8 text-center text-xs text-stone-400">Chargement du relevé...</div>
                ) : ledgerEntries.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400">
                    Aucune transaction enregistrée pour ce client.
                  </div>
                ) : (
                  <div className="border border-stone-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200 text-[10px] uppercase">
                        <tr>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5 font-sans">Opération &amp; Réf</th>
                          <th className="p-2.5 text-right text-rose-700">Débit (Vente)</th>
                          <th className="p-2.5 text-right text-emerald-700">Crédit (Paiement)</th>
                          <th className="p-2.5 text-right">Solde Dû</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {ledgerEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-stone-50/60">
                            <td className="p-2.5 text-stone-500 text-[11px] whitespace-nowrap">
                              {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="p-2.5 font-sans">
                              <div className="font-medium text-stone-900">{entry.note || entry.transaction_type}</div>
                              {entry.reference_id && (
                                <div className="text-[10px] text-stone-400 font-mono">
                                  Réf: {entry.reference_id}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 text-right text-rose-700 font-bold whitespace-nowrap">
                              {(entry.debit ?? 0) > 0 ? `+${(entry.debit ?? 0).toLocaleString('fr-FR')} DA` : '-'}
                            </td>
                            <td className="p-2.5 text-right text-emerald-700 font-bold whitespace-nowrap">
                              {(entry.credit ?? 0) > 0 ? `-${(entry.credit ?? 0).toLocaleString('fr-FR')} DA` : '-'}
                            </td>
                            <td className="p-2.5 text-right font-extrabold text-stone-900 whitespace-nowrap">
                              {(entry.balance_after ?? 0).toLocaleString('fr-FR')} DA
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record Debt Payment Modal */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="font-bold text-stone-900 font-cinzel text-base">Encaisser Règlement Client</h3>
                <p className="text-xs text-stone-500">{selectedCustomer.name}</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {paymentError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {paymentError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex justify-between text-amber-900">
                <span>Créance totale actuelle:</span>
                <span className="font-extrabold font-mono">
                  {(selectedCustomer.balance ?? 0).toLocaleString('fr-FR')} DA
                </span>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Montant Reçu (DA) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Mode de Paiement</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white"
                >
                  <option value="cash">Espèces</option>
                  <option value="bank">Virement Bancaire</option>
                  <option value="card">Carte / TPE</option>
                  <option value="check">Chèque Commercial</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Note / Justificatif</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Validation...' : 'Encaisser & Créditer le Compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CUSTOMER MODAL (Admin & Manager) */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-cinzel">Nouveau Client</h3>
                <p className="text-xs text-stone-500">Ouverture d'un compte client Solari</p>
              </div>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onAddCustomer) return;
                setIsSubmitting(true);
                try {
                  await onAddCustomer({
                    ...newCustForm,
                    default_discount_percent: Number(newCustForm.default_discount_percent) || 0,
                    credit_limit: Number(newCustForm.credit_limit) || 0,
                    balance: Number(newCustForm.balance) || 0,
                  });
                  setIsAddCustomerOpen(false);
                  setNewCustForm({
                    name: '',
                    phone: '',
                    address: '',
                    default_discount_percent: 0,
                    credit_limit: 500000,
                    balance: 0,
                  });
                } catch (err: any) {
                  alert(err.message || 'Erreur création client');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Nom / Raison Sociale *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Supérette El Baraka"
                  value={newCustForm.name}
                  onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    placeholder="0550 12 34 56"
                    value={newCustForm.phone}
                    onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Remise Habituelle (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newCustForm.default_discount_percent}
                    onChange={(e) => setNewCustForm({ ...newCustForm, default_discount_percent: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Adresse / Localisation</label>
                <input
                  type="text"
                  placeholder="Ex: Bab Ezzouar, Alger"
                  value={newCustForm.address}
                  onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Plafond Crédit Autorisé (DA)</label>
                  <input
                    type="number"
                    min={0}
                    value={newCustForm.credit_limit}
                    onChange={(e) => setNewCustForm({ ...newCustForm, credit_limit: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Solde Initial Dû (DA)</label>
                  <input
                    type="number"
                    min={0}
                    value={newCustForm.balance}
                    onChange={(e) => setNewCustForm({ ...newCustForm, balance: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Création...' : 'Créer le Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL (Admin & Manager) */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-cinzel">Modifier le Client</h3>
                <p className="text-xs text-stone-500">Mise à jour des coordonnées et des paramètres financiers</p>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onUpdateCustomer) return;
                setIsSubmitting(true);
                try {
                  await onUpdateCustomer(editingCustomer.id, {
                    ...editCustForm,
                    default_discount_percent: Number(editCustForm.default_discount_percent) || 0,
                    credit_limit: Number(editCustForm.credit_limit) || 0,
                    balance: Number(editCustForm.balance) || 0,
                  });
                  setEditingCustomer(null);
                } catch (err: any) {
                  alert(err.message || 'Erreur modification client');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Nom / Raison Sociale *</label>
                <input
                  type="text"
                  required
                  value={editCustForm.name}
                  onChange={(e) => setEditCustForm({ ...editCustForm, name: e.target.value })}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={editCustForm.phone}
                    onChange={(e) => setEditCustForm({ ...editCustForm, phone: e.target.value })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Remise Habituelle (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editCustForm.default_discount_percent}
                    onChange={(e) => setEditCustForm({ ...editCustForm, default_discount_percent: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Adresse</label>
                <input
                  type="text"
                  value={editCustForm.address}
                  onChange={(e) => setEditCustForm({ ...editCustForm, address: e.target.value })}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Plafond Crédit (DA)</label>
                  <input
                    type="number"
                    min={0}
                    value={editCustForm.credit_limit}
                    onChange={(e) => setEditCustForm({ ...editCustForm, credit_limit: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-amber-900 mb-1">Solde Actuel Dû (DA)</label>
                  <input
                    type="number"
                    min={0}
                    value={editCustForm.balance}
                    onChange={(e) => setEditCustForm({ ...editCustForm, balance: Number(e.target.value) })}
                    className="w-full border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white"
                  />
                  <span className="text-[10px] text-stone-500 block mt-1">Ajustement direct de solde</span>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Mettre à jour le Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CUSTOMER CONFIRMATION MODAL (Admin & Manager) */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-900 font-cinzel">Supprimer le Compte Client</h3>
            </div>

            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              Êtes-vous certain de vouloir supprimer le client{' '}
              <strong className="text-stone-900 font-bold">{deletingCustomer.name}</strong> ?
              {deletingCustomer.balance > 0 && (
                <span className="block mt-2 font-bold text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  ⚠️ Attention : Ce client a un solde débiteur impayé de {deletingCustomer.balance.toLocaleString('fr-FR')} DA.
                </span>
              )}
            </p>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!onDeleteCustomer) return;
                  setIsDeleting(true);
                  try {
                    await onDeleteCustomer(deletingCustomer.id);
                    setDeletingCustomer(null);
                    if (selectedCustomerId === deletingCustomer.id) {
                      const next = safeCustomers.find((c) => c.id !== deletingCustomer.id);
                      setSelectedCustomerId(next ? next.id : '');
                    }
                  } catch (err: any) {
                    alert(err.message || 'Erreur suppression client');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
