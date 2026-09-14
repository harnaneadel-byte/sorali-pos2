import React, { useState } from 'react';
import { Product, StockMovement, UserRole } from '../types';
import {
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  History,
  CheckCircle,
  Package,
  Layers,
  Search,
  Filter,
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
} from 'lucide-react';

interface StockViewProps {
  products: Product[];
  movements: StockMovement[];
  onStockEntry: (productId: string, units: number, note: string) => Promise<void>;
  onStockDamage: (productId: string, units: number, note: string) => Promise<void>;
  onStockAdjust: (productId: string, newUnits: number, note: string) => Promise<void>;
  onCreateProduct?: (productData: any) => Promise<void>;
  onUpdateProduct?: (productId: string, updates: any) => Promise<void>;
  onDeleteProduct?: (productId: string) => Promise<void>;
  currentRole: UserRole;
  currentUserName: string;
}

export const StockView: React.FC<StockViewProps> = ({
  products,
  movements,
  onStockEntry,
  onStockDamage,
  onStockAdjust,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  currentRole,
  currentUserName,
}) => {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeMovements = Array.isArray(movements) ? movements : [];
  const isAdminOrManager = currentRole === 'Admin' || currentRole === 'Manager';

  const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'normal'>('all');

  // Modal State (Stock movements)
  const [modalAction, setModalAction] = useState<'entry' | 'damage' | 'adjust' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionQuantity, setActionQuantity] = useState<string>('');
  const [actionCartons, setActionCartons] = useState<string>('');
  const [actionPieces, setActionPieces] = useState<string>('');
  const [actionNote, setActionNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Admin/Manager Full Control Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProductData, setNewProductData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category_name: 'Soins Capillaires',
    brand_name: 'Dabur Vatika',
    units_per_carton: 24,
    purchase_price: 350,
    selling_price: 500,
    minimum_stock_units: 48,
    initial_stock_units: 120,
  });

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    category_name: '',
    brand_name: '',
    units_per_carton: 1,
    purchase_price: 0,
    selling_price: 0,
    minimum_stock_units: 0,
    current_stock_units: 0,
  });

  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredProducts = safeProducts.filter((p) => {
    const units = p.current_stock_units ?? 0;
    const isOut = units <= 0;
    const isLow = units <= (p.minimum_stock_units ?? 0) && units > 0;

    if (statusFilter === 'out' && !isOut) return false;
    if (statusFilter === 'low' && !isLow) return false;
    if (statusFilter === 'normal' && (isLow || isOut)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalInventoryUnits = safeProducts.reduce((acc, p) => acc + (p.current_stock_units ?? 0), 0);
  const totalStockValue = safeProducts.reduce(
    (acc, p) => acc + (p.current_stock_units ?? 0) * (p.purchase_price ?? 0),
    0
  );
  const lowStockCount = safeProducts.filter(
    (p) => (p.current_stock_units ?? 0) <= (p.minimum_stock_units ?? 0) && (p.current_stock_units ?? 0) > 0
  ).length;
  const outOfStockCount = safeProducts.filter((p) => (p.current_stock_units ?? 0) === 0).length;

  const handleOpenAction = (p: Product, action: 'entry' | 'damage' | 'adjust') => {
    setSelectedProduct(p);
    setModalAction(action);
    setActionCartons('');
    setActionPieces('');
    setActionQuantity(action === 'adjust' ? String(p.current_stock_units ?? 0) : '');
    setActionNote('');
    setErrorMsg(null);
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !modalAction) return;
    setErrorMsg(null);

    let calculatedUnits = 0;
    if (modalAction === 'adjust') {
      calculatedUnits = Number(actionQuantity);
      if (isNaN(calculatedUnits) || calculatedUnits < 0) {
        setErrorMsg('La quantité ajustée doit être positive ou nulle.');
        return;
      }
    } else {
      const c = Number(actionCartons) || 0;
      const pc = Number(actionPieces) || 0;
      calculatedUnits = c * selectedProduct.units_per_carton + pc;
      if (calculatedUnits <= 0) {
        setErrorMsg('Veuillez entrer une quantité supérieure à zéro.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (modalAction === 'entry') {
        await onStockEntry(selectedProduct.id, calculatedUnits, actionNote || 'Réception fournisseur');
      } else if (modalAction === 'damage') {
        await onStockDamage(selectedProduct.id, calculatedUnits, actionNote || 'Casse / Produit détérioré');
      } else if (modalAction === 'adjust') {
        await onStockAdjust(selectedProduct.id, calculatedUnits, actionNote || 'Inventaire physique périodique');
      }
      setModalAction(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'opération de stock.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Valeur Totale Stock</div>
          <div className="text-xl sm:text-2xl font-extrabold text-stone-900 mt-1 font-mono">
            {totalStockValue.toLocaleString('fr-FR')} <span className="text-xs font-normal text-stone-500">DA</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Unités en Stock</div>
          <div className="text-xl sm:text-2xl font-extrabold text-stone-900 mt-1 font-mono">
            {totalInventoryUnits.toLocaleString('fr-FR')} <span className="text-xs font-normal text-stone-500">u</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Alertes Stock Faible</div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-800 mt-1 font-mono">
            {lowStockCount} <span className="text-xs font-normal">références</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/40 shadow-xs">
          <div className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">En Rupture Totale</div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-800 mt-1 font-mono">
            {outOfStockCount} <span className="text-xs font-normal">références</span>
          </div>
        </div>
      </div>

      {/* Navigation Subtabs (Stock vs Movements) */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventaire &amp; Dépôt</span>
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'movements'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historique Mouvements ({movements.length})</span>
          </button>
        </div>

        {activeTab === 'inventory' && (
          <div className="flex items-center gap-2">
            {isAdminOrManager && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouveau Produit</span>
              </button>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrer produit..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs border border-stone-300 rounded-lg bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: INVENTORY TABLE */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Produit / Gamme</th>
                  <th className="p-3.5">Conditionnement</th>
                  <th className="p-3.5">Stock Disponible</th>
                  <th className="p-3.5">Seuil Min</th>
                  <th className="p-3.5">Prix Achat / Vente</th>
                  <th className="p-3.5">Valeur Stock</th>
                  <th className="p-3.5 text-right">Opérations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProducts.map((p) => {
                  const units = p.current_stock_units ?? 0;
                  const upc = p.units_per_carton || 1;
                  const cartons = Math.floor(units / upc);
                  const pieces = units % upc;
                  const isOut = units <= 0;
                  const isLow = units <= (p.minimum_stock_units ?? 0) && units > 0;
                  const buyPrice = p.purchase_price ?? 0;
                  const sellPrice = p.selling_price ?? 0;

                  return (
                    <tr key={p.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-stone-900">{p.name}</div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                          {p.variant && <span>{p.variant}</span>}
                          <span className="font-mono text-stone-400">SKU: {p.sku || '-'}</span>
                          <span className="font-mono text-stone-400">EAN: {p.barcode || '-'}</span>
                          <span className="text-amber-800 font-semibold">{p.category_name || p.brand_name}</span>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                          {upc} u / carton
                        </span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold px-2 py-1 rounded-md text-xs font-mono ${
                              isOut
                                ? 'bg-rose-100 text-rose-800'
                                : isLow
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {cartons} ctn + {pieces} pcs
                          </span>
                          <span className="text-[11px] text-stone-500 font-mono">
                            ({units} u)
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-mono text-stone-600">
                        {p.minimum_stock_units ?? 0} u
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <div className="text-stone-500 font-mono text-[11px]">
                          Achat: {buyPrice.toLocaleString('fr-FR')} DA
                        </div>
                        <div className="text-stone-900 font-bold font-mono">
                          Vente: {sellPrice.toLocaleString('fr-FR')} DA
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-mono font-bold text-amber-900">
                        {(units * buyPrice).toLocaleString('fr-FR')} DA
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenAction(p, 'entry')}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold cursor-pointer transition"
                            title="Entrée de stock"
                          >
                            + Entrée
                          </button>
                          <button
                            onClick={() => handleOpenAction(p, 'damage')}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition"
                            title="Déclarer casse ou avarie"
                          >
                            Casse
                          </button>
                          <button
                            onClick={() => handleOpenAction(p, 'adjust')}
                            className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold cursor-pointer transition"
                            title="Ajustement inventaire"
                          >
                            Ajuster
                          </button>

                          {isAdminOrManager && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setEditForm({
                                    name: p.name,
                                    sku: p.sku || '',
                                    barcode: p.barcode || '',
                                    category_name: p.category_name || '',
                                    brand_name: p.brand_name || '',
                                    units_per_carton: p.units_per_carton || 1,
                                    purchase_price: p.purchase_price || 0,
                                    selling_price: p.selling_price || 0,
                                    minimum_stock_units: p.minimum_stock_units || 0,
                                    current_stock_units: p.current_stock_units ?? 0,
                                  });
                                }}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1"
                                title="Modifier le produit"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Modifier</span>
                              </button>
                              <button
                                onClick={() => setDeletingProduct(p)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1"
                                title="Supprimer le produit"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Supprimer</span>
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
      )}

      {/* TAB 2: STOCK MOVEMENTS AUDIT TRAIL */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-stone-50 border-b border-stone-200 text-xs text-stone-500">
            Journal immuable des mouvements de stock avec conservation des quantités avant et après.
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-400 font-semibold border-b border-stone-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Date / Heure</th>
                  <th className="p-3">Produit</th>
                  <th className="p-3">Mouvement</th>
                  <th className="p-3">Quantité</th>
                  <th className="p-3">Avant → Après</th>
                  <th className="p-3">Référence</th>
                  <th className="p-3">Opérateur &amp; Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono">
                {safeMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-50/80">
                    <td className="p-3 text-[11px] text-stone-500 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3 font-sans font-bold text-stone-900">
                      {m.product_name || m.product_id}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-sans font-bold uppercase px-2 py-0.5 rounded ${
                          m.movement_type === 'sale'
                            ? 'bg-blue-50 text-blue-800'
                            : m.movement_type === 'purchase'
                            ? 'bg-emerald-50 text-emerald-800'
                            : m.movement_type === 'damaged'
                            ? 'bg-rose-50 text-rose-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-stone-900">
                      {m.quantity_units} u
                    </td>
                    <td className="p-3 text-stone-600 whitespace-nowrap">
                      <span className="text-stone-400">{m.quantity_before}</span> →{' '}
                      <strong className="text-stone-900">{m.quantity_after}</strong>
                    </td>
                    <td className="p-3 text-stone-600">{m.reference_id}</td>
                    <td className="p-3 font-sans text-stone-600 text-[11px]">
                      <div>{m.user_name || 'Système'}</div>
                      {m.note && <div className="text-stone-400 text-[10px] italic">{m.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Action Modal (Entry / Damage / Adjust) */}
      {modalAction && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 font-cinzel">
                  {modalAction === 'entry' && 'Réception / Entrée de Stock'}
                  {modalAction === 'damage' && 'Déclaration Casse ou Avarie'}
                  {modalAction === 'adjust' && 'Ajustement Inventaire Physique'}
                </h3>
                <p className="text-xs text-stone-500">{selectedProduct.name}</p>
              </div>
              <button
                onClick={() => setModalAction(null)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleActionSubmit} className="space-y-4 text-xs">
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-stone-600 flex justify-between">
                <span>Stock Actuel:</span>
                <span className="font-bold text-stone-900 font-mono">
                  {selectedProduct.current_stock_units ?? 0} unités ({selectedProduct.units_per_carton} u/ctn)
                </span>
              </div>

              {modalAction === 'adjust' ? (
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Nouveau Stock Physique Réel (en unités) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={actionQuantity}
                    onChange={(e) => setActionQuantity(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">
                    Le système créera un mouvement avec la différence exacte.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Cartons</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={actionCartons}
                      onChange={(e) => setActionCartons(e.target.value)}
                      className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Pièces</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={actionPieces}
                      onChange={(e) => setActionPieces(e.target.value)}
                      className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Motif / Note d'audit</label>
                <input
                  type="text"
                  placeholder="Ex: Bon de livraison N° BL-2026-889"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAction(null)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2.5 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 ${
                    modalAction === 'damage'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isSubmitting ? 'Enregistrement...' : 'Confirmer & Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE PRODUCT MODAL (Admin & Manager) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-cinzel">Nouveau Produit en Stock</h3>
                <p className="text-xs text-stone-500">Ajout d'une nouvelle référence au catalogue Solari Distribution</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onCreateProduct) return;
                setIsSubmitting(true);
                setErrorMsg(null);
                try {
                  await onCreateProduct({
                    ...newProductData,
                    units_per_carton: Number(newProductData.units_per_carton) || 1,
                    purchase_price: Number(newProductData.purchase_price) || 0,
                    selling_price: Number(newProductData.selling_price) || 0,
                    minimum_stock_units: Number(newProductData.minimum_stock_units) || 0,
                    current_stock_units: Number(newProductData.initial_stock_units) || 0,
                  });
                  setIsCreateModalOpen(false);
                  setNewProductData({
                    name: '',
                    sku: '',
                    barcode: '',
                    category_name: 'Soins Capillaires',
                    brand_name: 'Dabur Vatika',
                    units_per_carton: 24,
                    purchase_price: 350,
                    selling_price: 500,
                    minimum_stock_units: 48,
                    initial_stock_units: 120,
                  });
                } catch (err: any) {
                  setErrorMsg(err.message || 'Erreur lors de la création du produit');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Désignation du produit *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Vatika Hair Cream Black Seed 250ml"
                  value={newProductData.name}
                  onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">SKU (Référence)</label>
                  <input
                    type="text"
                    placeholder="Ex: VAT-CRM-BS-250"
                    value={newProductData.sku}
                    onChange={(e) => setNewProductData({ ...newProductData, sku: e.target.value })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Code Barre (EAN-13)</label>
                  <input
                    type="text"
                    placeholder="Ex: 6291069123456"
                    value={newProductData.barcode}
                    onChange={(e) => setNewProductData({ ...newProductData, barcode: e.target.value })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Catégorie</label>
                  <input
                    type="text"
                    value={newProductData.category_name}
                    onChange={(e) => setNewProductData({ ...newProductData, category_name: e.target.value })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Marque</label>
                  <input
                    type="text"
                    value={newProductData.brand_name}
                    onChange={(e) => setNewProductData({ ...newProductData, brand_name: e.target.value })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Colisage (u/ctn) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newProductData.units_per_carton}
                    onChange={(e) => setNewProductData({ ...newProductData, units_per_carton: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Prix Achat (DA) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newProductData.purchase_price}
                    onChange={(e) => setNewProductData({ ...newProductData, purchase_price: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Prix Vente (DA) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newProductData.selling_price}
                    onChange={(e) => setNewProductData({ ...newProductData, selling_price: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Stock Initial (unités)</label>
                  <input
                    type="number"
                    min={0}
                    value={newProductData.initial_stock_units}
                    onChange={(e) => setNewProductData({ ...newProductData, initial_stock_units: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Seuil Alerte Stock Min (u)</label>
                  <input
                    type="number"
                    min={0}
                    value={newProductData.minimum_stock_units}
                    onChange={(e) => setNewProductData({ ...newProductData, minimum_stock_units: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Création...' : 'Créer & Ajouter au Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL (Admin & Manager) */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-cinzel">Modifier le Produit</h3>
                <p className="text-xs text-stone-500">Mise à jour des tarifs, du colisage ou du stock</p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onUpdateProduct) return;
                setIsSubmitting(true);
                setErrorMsg(null);
                try {
                  await onUpdateProduct(editingProduct.id, {
                    ...editForm,
                    units_per_carton: Number(editForm.units_per_carton) || 1,
                    purchase_price: Number(editForm.purchase_price) || 0,
                    selling_price: Number(editForm.selling_price) || 0,
                    minimum_stock_units: Number(editForm.minimum_stock_units) || 0,
                    current_stock_units: Number(editForm.current_stock_units) || 0,
                  });
                  setEditingProduct(null);
                } catch (err: any) {
                  setErrorMsg(err.message || 'Erreur lors de la modification du produit');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Désignation du produit *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Code Barre (EAN-13)</label>
                  <input
                    type="text"
                    value={editForm.barcode}
                    onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Catégorie</label>
                  <input
                    type="text"
                    value={editForm.category_name}
                    onChange={(e) => setEditForm({ ...editForm, category_name: e.target.value })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Marque</label>
                  <input
                    type="text"
                    value={editForm.brand_name}
                    onChange={(e) => setEditForm({ ...editForm, brand_name: e.target.value })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Colisage (u/ctn) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.units_per_carton}
                    onChange={(e) => setEditForm({ ...editForm, units_per_carton: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Prix Achat (DA) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editForm.purchase_price}
                    onChange={(e) => setEditForm({ ...editForm, purchase_price: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Prix Vente (DA) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editForm.selling_price}
                    onChange={(e) => setEditForm({ ...editForm, selling_price: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                <div>
                  <label className="block font-semibold text-amber-900 mb-1">Stock Actuel (unités)</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.current_stock_units}
                    onChange={(e) => setEditForm({ ...editForm, current_stock_units: Number(e.target.value) })}
                    className="w-full border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white"
                  />
                  <span className="text-[10px] text-amber-700 block mt-1">
                    Modifier directement la quantité physique en stock.
                  </span>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Seuil Alerte Stock Min</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.minimum_stock_units}
                    onChange={(e) => setEditForm({ ...editForm, minimum_stock_units: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Mettre à jour le Produit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PRODUCT CONFIRMATION MODAL (Admin & Manager) */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-900 font-cinzel">Supprimer la Référence Produit</h3>
            </div>

            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le produit{' '}
              <strong className="text-stone-900 font-bold">{deletingProduct.name}</strong> ?
              Cette action retirera l'article de l'inventaire actif et du terminal point de vente.
            </p>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!onDeleteProduct) return;
                  setIsDeleting(true);
                  try {
                    await onDeleteProduct(deletingProduct.id);
                    setDeletingProduct(null);
                  } catch (err: any) {
                    alert(err.message || 'Erreur suppression produit');
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
