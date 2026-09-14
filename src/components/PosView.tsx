import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Product, UserRole, CheckoutRequest, Sale, PaymentMethod } from '../types';
import { Search, Barcode, Camera, Plus, Minus, Trash2, Receipt, CreditCard, Banknote, Building2, AlertTriangle, ShoppingBag, Percent } from 'lucide-react';

interface CartItem { product: Product; cartons: number; pieces: number; discount_override_percent?: number; }
interface PosViewProps { products: Product[]; customers: Customer[]; onCheckout: (data: any) => Promise<Sale>; currentRole: UserRole; currentUserName: string; onViewReceipt: (sale: Sale) => void; }

export const PosView: React.FC<PosViewProps> = ({ products, customers, onCheckout, currentRole, currentUserName, onViewReceipt }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customers.length > 0 && (!selectedCustomerId || !customers.some(c => c.id === selectedCustomerId))) {
      const preferred = customers.find(c => c.name.includes('Pharmacie Centrale') || c.id === 'cust_pharma_centrale');
      setSelectedCustomerId(preferred ? preferred.id : customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === selectedCustomerId) || customers[0], [customers, selectedCustomerId]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return products;
    return products.filter((p) => (p.name || '').toLowerCase().includes(term) || (p.barcode || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term) || (p.brand_name || '').toLowerCase().includes(term) || (p.category_name || '').toLowerCase().includes(term));
  }, [products, searchTerm]);

  const getProductDiscountPercent = (product: Product, override?: number): number => {
    if (typeof override === 'number') return override;
    const isPharma = selectedCustomer?.id === 'cust_pharma_centrale' || selectedCustomer?.name?.includes('Pharmacie Centrale');
    const isVatikaBlack = product.id === 'a4531a23-c60d-4555-bc55-4564a7f6dba7' || product.sku === 'VAT-BLK-180';
    if (isPharma && isVatikaBlack) return 10.0;
    const isEtoile = selectedCustomer?.id === 'cust_etoile_or' || selectedCustomer?.name?.includes('Etoile');
    const isKeratin = product.id === 'prd_sorali_keratin_1000' || product.sku === 'SOR-KER-1000';
    if (isEtoile && isKeratin) return 12.0;
    return selectedCustomer?.default_discount_percent || 0;
  };

  const handleAddToCart = (product: Product) => {
    const available = product.current_stock_units ?? product.stock_units ?? 0;
    if (available <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      const upc = Math.max(1, product.units_per_carton || 1);
      if (existing) {
        const currentUnits = existing.cartons * upc + existing.pieces;
        if (currentUnits + upc <= available) return prev.map((i) => i.product.id === product.id ? { ...i, cartons: i.cartons + 1 } : i);
        else if (currentUnits + 1 <= available) return prev.map((i) => i.product.id === product.id ? { ...i, pieces: i.pieces + 1 } : i);
        return prev;
      } else {
        if (available >= upc) return [...prev, { product, cartons: 1, pieces: 0 }];
        else return [...prev, { product, cartons: 0, pieces: 1 }];
      }
    });
  };

  const handleUpdateQuantity = (productId: string, field: 'cartons' | 'pieces', delta: number) => {
    setCart((prev) => prev.map((item) => {
      if (item.product.id === productId) {
        const upc = Math.max(1, item.product.units_per_carton || 1);
        const available = item.product.current_stock_units ?? item.product.stock_units ?? 999999;
        const nextVal = Math.max(0, item[field] + delta);
        const newTotalUnits = field === 'cartons' ? (nextVal * upc + item.pieces) : (item.cartons * upc + nextVal);
        if (newTotalUnits > available) return item;
        return { ...item, [field]: nextVal };
      }
      return item;
    }).filter((item) => item.cartons > 0 || item.pieces > 0));
  };

  const handleRemoveItem = (productId: string) => setCart((prev) => prev.filter((i) => i.product.id !== productId));

  const calculatedLines = useMemo(() => cart.map((item) => {
    const totalUnits = item.cartons * item.product.units_per_carton + item.pieces;
    const discountPercent = getProductDiscountPercent(item.product, item.discount_override_percent);
    const grossLine = totalUnits * item.product.selling_price;
    const discountAmount = (grossLine * discountPercent) / 100;
    const lineTotal = grossLine - discountAmount;
    return { ...item, totalUnits, discountPercent, grossLine, discountAmount, lineTotal };
  }), [cart, selectedCustomer]);

  const subtotal = calculatedLines.reduce((acc, l) => acc + l.grossLine, 0);
  const totalDiscount = calculatedLines.reduce((acc, l) => acc + l.discountAmount, 0);
  const netTotal = subtotal - totalDiscount;

  const handleOpenCheckoutModal = () => { setPaidAmountInput(String(netTotal)); setCheckoutError(null); setIsCheckoutModalOpen(true); };

  const handleExecuteCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutError(null);
    const paidNum = Number(paidAmountInput);
    if (isNaN(paidNum) || paidNum < 0) { setCheckoutError('Montant payé invalide.'); return; }
    const creditExpected = Math.max(0, netTotal - paidNum);
    const isWalkIn = selectedCustomer.id === 'cust_walk_in' || selectedCustomer.id === 'c1000000-0000-0000-0000-000000000005' || selectedCustomer.name.toLowerCase().includes('comptoir');
    if (creditExpected > 0 && isWalkIn) { setCheckoutError('Crédit interdit pour le client comptoir anonyme.'); return; }

    setIsSubmitting(true);
    try {
      const client_request_id = crypto.randomUUID();
      const payload = {
        client_request_id,
        customer_id: selectedCustomer.id,
        warehouse_id: 'wh_main_01',
        payment_method: paymentMethod,
        paid_amount: paidNum,
        notes: paidNum >= netTotal ? 'Règlement total' : 'Règlement partiel',
        items: cart.map((item) => {
          const upc = Math.max(1, Number(item.product.units_per_carton || 1));
          const totalUnits = (Number(item.cartons || 0) * upc) + Number(item.pieces || 0);
          return {
            product_id: item.product.id,
            quantity_units: totalUnits > 0 ? totalUnits : 1,
            unit_price: Number(item.product.selling_price || 0),
            discount_percent: Number(getProductDiscountPercent(item.product, item.discount_override_percent) || 0),
          };
        }),
      } as any;

      const committedSale = await onCheckout(payload);
      setCart([]);
      setIsCheckoutModalOpen(false);
      onViewReceipt(committedSale);
    } catch (err: any) {
      const errorMessage = err?.message || err?.error?.message || (typeof err === 'string' ? err : "Erreur lors de l'enregistrement de la vente.");
      setCheckoutError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500" />
          </div>
          <button onClick={() => setIsScannerOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl border border-stone-200"><Camera className="w-4 h-4 text-amber-700" /><span className="hidden sm:inline">Scanner</span></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredProducts.map((product) => {
            const units = product.current_stock_units ?? 0;
            const cartonsAvail = Math.floor(units / product.units_per_carton);
            const piecesAvail = units % product.units_per_carton;
            const isOut = units <= 0;
            const isLow = units <= product.minimum_stock_units && units > 0;
            const discountPct = getProductDiscountPercent(product);
            return (
              <div key={product.id} onClick={() => !isOut && handleAddToCart(product)} className={`bg-white rounded-xl border p-3.5 shadow-xs flex flex-col justify-between transition-all select-none ${isOut ? 'border-rose-200 opacity-60 cursor-not-allowed bg-rose-50/20' : 'border-stone-200 hover:border-amber-400 hover:shadow-md cursor-pointer'}`}>
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1"><span className="text-[10px] uppercase font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">{product.brand_name}</span><span className="text-[10px] font-mono text-stone-400">{product.sku}</span></div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 leading-snug line-clamp-2">{product.name}</h4>
                  <div className="text-[11px] text-stone-500 mt-0.5">{product.variant}</div>
                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${isOut ? 'bg-rose-100 text-rose-800' : isLow ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>{cartonsAvail} ctn + {piecesAvail} pcs ({units} u)</span>
                    <span className="text-[10px] text-stone-400">{product.units_per_carton} pcs/ctn</span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-stone-900">{product.selling_price.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-stone-500">DA / u</span></div>
                    {discountPct > 0 && <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5"><Percent className="w-2.5 h-2.5" /> Remise: {discountPct}%</div>}
                  </div>
                  <button disabled={isOut} className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${isOut ? 'bg-stone-100 text-stone-400' : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'}`}><Plus className="w-3.5 h-3.5" /> Ajouter</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-sm sticky top-28 space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-stone-700 mb-1.5">
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-amber-700" /> Client Vente:</span>
            {selectedCustomer && selectedCustomer.balance > 0 && <span className="text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px]">Créance: {selectedCustomer.balance.toLocaleString('fr-FR')} DA</span>}
          </div>
          <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500">
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.default_discount_percent > 0 ? `(Remise ${c.default_discount_percent}%)` : ''} - Solde: {c.balance.toLocaleString('fr-FR')} DA</option>)}
          </select>
        </div>
        <div className="border-t border-stone-100 pt-3">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-2">
            <span>Panier ({calculatedLines.length} articles)</span>
            {cart.length > 0 && <button onClick={() => setCart([])} className="text-rose-600 hover:text-rose-700 text-[11px] cursor-pointer">Vider</button>}
          </div>
          {cart.length === 0 ? (
            <div className="py-12 text-center text-stone-400"><ShoppingBag className="w-10 h-10 mx-auto mb-2 text-stone-300" /><div className="text-xs font-medium">Le panier est vide</div></div>
          ) : (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {calculatedLines.map((line) => (
                <div key={line.product.id} className="bg-stone-50/80 rounded-xl p-2.5 border border-stone-200/80 flex flex-col gap-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-bold text-stone-900 leading-tight">{line.product.name}</div><div className="text-[10px] text-stone-500">{line.product.selling_price.toLocaleString('fr-FR')} DA / u</div></div>
                    <button onClick={() => handleRemoveItem(line.product.id)} className="text-stone-400 hover:text-rose-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-stone-200">
                    <div className="flex items-center gap-1.5"><span className="text-[11px] text-stone-500 font-medium">Cartons:</span><div className="flex items-center border border-stone-300 rounded-md overflow-hidden bg-white"><button onClick={() => handleUpdateQuantity(line.product.id, 'cartons', -1)} className="px-1.5 py-0.5 text-stone-600 hover:bg-stone-100"><Minus className="w-3 h-3" /></button><span className="px-2 text-xs font-bold text-stone-800">{line.cartons}</span><button onClick={() => handleUpdateQuantity(line.product.id, 'cartons', 1)} className="px-1.5 py-0.5 text-stone-600 hover:bg-stone-100"><Plus className="w-3 h-3" /></button></div></div>
                    <div className="flex items-center gap-1.5"><span className="text-[11px] text-stone-500 font-medium">Pièces:</span><div className="flex items-center border border-stone-300 rounded-md overflow-hidden bg-white"><button onClick={() => handleUpdateQuantity(line.product.id, 'pieces', -1)} className="px-1.5 py-0.5 text-stone-600 hover:bg-stone-100"><Minus className="w-3 h-3" /></button><span className="px-2 text-xs font-bold text-stone-800">{line.pieces}</span><button onClick={() => handleUpdateQuantity(line.product.id, 'pieces', 1)} className="px-1.5 py-0.5 text-stone-600 hover:bg-stone-100"><Plus className="w-3 h-3" /></button></div></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1"><span className="text-stone-500">Total: <strong className="text-stone-800">{line.totalUnits} unités</strong></span><span className="font-extrabold text-stone-900 text-xs">{line.lineTotal.toLocaleString('fr-FR')} DA</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <div className="border-t border-stone-200 pt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-stone-600"><span>Sous-total Brut:</span><span className="font-mono">{subtotal.toLocaleString('fr-FR')} DA</span></div>
            {totalDiscount > 0 && <div className="flex items-center justify-between text-emerald-700 font-medium"><span>Remise:</span><span className="font-mono">- {totalDiscount.toLocaleString('fr-FR')} DA</span></div>}
            <div className="flex items-center justify-between text-sm sm:text-base font-extrabold text-stone-900 pt-1.5 border-t border-stone-200"><span>Total Net:</span><span className="text-amber-700 font-mono">{netTotal.toLocaleString('fr-FR')} DA</span></div>
            <button onClick={handleOpenCheckoutModal} className="w-full mt-2 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"><Banknote className="w-4 h-4" /> Encaisser & Valider</button>
          </div>
        )}
      </div>
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100"><div className="flex items-center gap-2"><Barcode className="w-5 h-5 text-amber-700" /><h3 className="font-bold text-stone-900">Scanner</h3></div><button onClick={() => setIsScannerOpen(false)} className="text-stone-400 hover:text-stone-600 text-sm p-1 cursor-pointer">✕</button></div>
            <div className="relative bg-stone-900 rounded-xl my-4 h-44 flex flex-col items-center justify-center overflow-hidden border border-amber-500/50"><div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 animate-pulse" /><Barcode className="w-20 h-20 text-stone-600" /></div>
          </div>
        </div>
      )}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4"><h3 className="text-base sm:text-lg font-bold text-stone-900">Encaissement</h3><button onClick={() => setIsCheckoutModalOpen(false)} className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer">✕</button></div>
            {checkoutError && <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /><div>{checkoutError}</div></div>}
            <div className="space-y-4 text-xs">
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1"><div className="flex justify-between text-stone-500"><span>Client:</span><span className="font-bold text-stone-800">{selectedCustomer.name}</span></div><div className="flex justify-between text-stone-500"><span>Total Net:</span><span className="font-extrabold text-stone-900 font-mono text-sm">{netTotal.toLocaleString('fr-FR')} DA</span></div></div>
              <div><label className="block font-semibold text-stone-700 mb-1.5">Mode de règlement</label><div className="grid grid-cols-3 gap-2">{[{ id: 'cash', label: 'Espèces', icon: Banknote }, { id: 'card', label: 'Carte', icon: CreditCard }, { id: 'bank', label: 'Virement', icon: Building2 }].map((m) => { const Icon = m.icon; return <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id as any)} className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 cursor-pointer transition ${paymentMethod === m.id ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}><Icon className="w-4 h-4" /><span className="text-[11px]">{m.label}</span></button>; })}</div></div>
              <div><label className="block font-semibold text-stone-700 mb-1">Montant Encaissé (DA) *</label><input type="number" min={0} value={paidAmountInput} onChange={(e) => setPaidAmountInput(e.target.value)} className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500" /><div className="flex items-center gap-2 mt-1.5"><button type="button" onClick={() => setPaidAmountInput(String(netTotal))} className="text-[11px] px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer">100% Réglé</button><button type="button" onClick={() => setPaidAmountInput('0')} className="text-[11px] px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer">100% Crédit</button></div></div>
              {netTotal - (Number(paidAmountInput) || 0) > 0 && <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-amber-900 flex items-center justify-between"><span>Créance restante:</span><span className="font-extrabold font-mono text-sm">{(netTotal - (Number(paidAmountInput) || 0)).toLocaleString('fr-FR')} DA</span></div>}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2"><button type="button" onClick={() => setIsCheckoutModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer">Annuler</button><button type="button" disabled={isSubmitting} onClick={handleExecuteCheckout} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50">{isSubmitting ? <span>Traitement...</span> : <><Receipt className="w-4 h-4" /><span>Valider & Imprimer</span></>}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};