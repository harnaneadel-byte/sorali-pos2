import React, { useState } from 'react';
import { Sale } from '../types';
import { SolariLogo } from './SolariLogo';
import { Printer, FileText, CheckCircle, Download, X } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  initialMode?: 'thermal' | 'a4';
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  initialMode = 'thermal',
  onClose,
}) => {
  const [format, setFormat] = useState<'thermal' | 'a4'>(initialMode);

  const handlePrint = () => {
    window.print();
  };

  const totalNet = sale.total_net ?? sale.total_amount ?? 0;
  const totalGross = sale.total_gross ?? sale.subtotal ?? totalNet;
  const totalDiscount = sale.total_discount ?? sale.discount_total ?? sale.discount_amount ?? Math.max(0, totalGross - totalNet);
  const paidAmount = sale.paid_amount ?? 0;
  const remaining = Math.max(0, totalNet - paidAmount);
  const cashierName = sale.cashier_name || sale.user_name || 'Caisse';

  // ✅ CHANGE 1: Resolve customer name from the Supabase join `customers(id, name, phone)`
  const customerName = sale.customers?.name || sale.customer_name || sale.customer?.name || 'Client comptoir';

  const safeItems = Array.isArray(sale.items) ? sale.items : Array.isArray(sale.sale_items) ? sale.sale_items : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print-modal-container">
      <div className="bg-stone-100 rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-stone-200 my-auto print-modal-box">
        {/* Modal Top Controls (No-Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-200 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-500">Format d'impression:</span>
            <div className="bg-white border border-stone-300 rounded-xl p-0.5 flex">
              <button
                onClick={() => setFormat('thermal')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  format === 'thermal' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Ticket Caisse 80mm</span>
              </button>
              <button
                onClick={() => setFormat('a4')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  format === 'a4' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Facture A4 Grand Format</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* RECEIPT / INVOICE PREVIEW CONTAINER */}
        <div className="mt-4 flex justify-center overflow-x-auto">
          {format === 'thermal' ? (
            /* ================= FORMAT THERMIQUE (80MM) ================= */
            <div
              id="printable-receipt"
              className="printable-receipt bg-white text-stone-900 p-5 rounded-xl shadow-md border border-stone-300 w-[340px] font-mono text-xs leading-tight select-text"
            >
              {/* Header */}
              <div className="text-center pb-3 border-b border-dashed border-stone-400">
                <div className="flex justify-center mb-1">
                  <SolariLogo size="sm" showSubtitle={false} />
                </div>
                <div className="font-bold text-xs uppercase tracking-widest mt-1">
                  SOLARI DISTRIBUTION
                </div>
                <div className="text-[10px] text-stone-500">
                  Cosmétiques &amp; Soins Corporels
                </div>
                <div className="text-[9px] text-stone-400 mt-0.5">
                  Zone Industrielle Oued Smar, Alger • Tél: +213 23 45 67 89
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="py-2.5 border-b border-dashed border-stone-400 space-y-1 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span>FACTURE N°:</span>
                  <span>{sale.invoice_number}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>DATE:</span>
                  <span>{new Date(sale.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>CAISSIER:</span>
                  <span>{cashierName}</span>
                </div>
                <div className="flex justify-between text-stone-800 font-semibold">
                  <span>CLIENT:</span>
                  {/* ✅ CHANGE 2: Use resolved customerName */}
                  <span className="truncate max-w-[180px]">{customerName}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-2.5 border-b border-dashed border-stone-400 space-y-2">
                <div className="flex justify-between text-[10px] text-stone-400 font-bold uppercase">
                  <span>Article</span>
                  <span>Total</span>
                </div>
                {safeItems.map((item: any, idx: number) => {
                  const cartons = item.cartons ?? item.cartons_quantity ?? Math.floor((item.quantity_units || 0) / (item.units_per_carton || 1));
                  const pieces = item.pieces ?? item.pieces_quantity ?? ((item.quantity_units || 0) % (item.units_per_carton || 1));
                  return (
                    <div key={idx} className="space-y-0.5">
                      {/* ✅ CHANGE 3: Resolve product name from Supabase join products(name) */}
                      <div className="font-bold text-[11px] leading-snug">
                        {item.products?.name || item.product_name || 'Produit'}
                      </div>
                      {item.products?.variant && (
                        <div className="text-[9px] text-stone-400">{item.products.variant}</div>
                      )}
                      <div className="flex justify-between text-[10px] text-stone-600">
                        <span>
                          {cartons > 0 && `${cartons} ctn `}
                          {pieces > 0 && `${pieces} pcs `}
                          ({item.quantity_units} u × {(item.unit_price || 0).toLocaleString('fr-FR')} DA)
                        </span>
                        <span className="font-bold text-stone-900">
                          {/* ✅ CHANGE 4: Use total_amount (DB column) with line_total fallback */}
                          {(item.total_amount || item.line_total || 0).toLocaleString('fr-FR')} DA
                        </span>
                      </div>
                      {(item.discount_percent || 0) > 0 && (
                        <div className="text-[9px] text-stone-500">
                          Remise: {item.discount_percent}% (-{(item.discount_amount || 0).toLocaleString('fr-FR')} DA)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Financial Totals */}
              <div className="py-2.5 border-b border-dashed border-stone-400 space-y-1 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Sous-total Brut:</span>
                  <span>{totalGross.toLocaleString('fr-FR')} DA</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Remise Commerciale:</span>
                    <span>-{totalDiscount.toLocaleString('fr-FR')} DA</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-stone-200">
                  <span>TOTAL NET:</span>
                  <span>{totalNet.toLocaleString('fr-FR')} DA</span>
                </div>
                <div className="flex justify-between text-stone-700 pt-1">
                  <span>Montant Encaissé:</span>
                  <span className="font-bold">{paidAmount.toLocaleString('fr-FR')} DA</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-stone-900 font-bold bg-stone-100 p-1 rounded">
                    <span>RESTE CRÉANCE:</span>
                    <span>{remaining.toLocaleString('fr-FR')} DA</span>
                  </div>
                )}
              </div>

              {/* Footer Note */}
              <div className="text-center pt-3 text-[10px] text-stone-500 space-y-1">
                <div>*** MERCI POUR VOTRE ACHAT ***</div>
                <div className="text-[9px] text-stone-400">
                  Les marchandises vendues ne sont ni reprises ni échangées après 48h.
                </div>
              </div>
            </div>
          ) : (
            /* ================= FORMAT PROFESSIONNEL A4 ================= */
            <div
              id="printable-invoice"
              className="printable-invoice bg-white text-stone-900 p-8 rounded-xl shadow-md border border-stone-300 w-full max-w-2xl font-sans text-xs select-text"
            >
              {/* Header with Logo and Company Reg */}
              <div className="flex items-start justify-between border-b-2 border-amber-600 pb-5">
                <div>
                  <SolariLogo size="md" showSubtitle={true} />
                  <div className="mt-2 text-[10px] text-stone-500 leading-relaxed font-mono">
                    SARL SOLARI DISTRIBUTION • Capital Social: 50.000.000 DZD<br />
                    Zone Industrielle Oued Smar, Lot N° 45, Alger<br />
                    RC: 16/00-0987654B16 • NIF: 001616098765432 • AI: 16123456789
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-amber-50 border border-amber-300 text-amber-950 font-bold px-3 py-1 rounded-lg text-sm uppercase tracking-wider font-cinzel">
                    FACTURE COMMERCIALE
                  </div>
                  <div className="mt-2 text-xs space-y-0.5">
                    <div>
                      <span className="text-stone-400">N° Facture:</span>{' '}
                      <strong className="font-mono text-stone-900">{sale.invoice_number}</strong>
                    </div>
                    <div>
                      <span className="text-stone-400">Date:</span>{' '}
                      <strong className="font-mono text-stone-900">
                        {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-400">Caissier:</span>{' '}
                      <span className="text-stone-700">{cashierName}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Block */}
              <div className="my-5 p-4 rounded-xl bg-stone-50 border border-stone-200 flex justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                    Facturé à l'attention de:
                  </div>
                  {/* ✅ CHANGE 5: Use resolved customerName */}
                  <div className="text-sm font-bold text-stone-900">{customerName}</div>
                  <div className="text-xs text-stone-600 mt-0.5">Client Professionnel / Distributeur</div>
                </div>
                <div className="text-right text-[11px] text-stone-500 space-y-0.5">
                  <div>Conditions de règlement: Comptant / Traite</div>
                  <div>Monnaie: Dinar Algérien (DZD)</div>
                  <div>Entrepôt de départ: Entrepôt Principal (Oued Smar)</div>
                </div>
              </div>

              {/* A4 Items Table */}
              <div className="border border-stone-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 text-stone-600 uppercase text-[10px] tracking-wider border-b border-stone-200 font-semibold">
                    <tr>
                      <th className="p-2.5">Réf / Article</th>
                      <th className="p-2.5 text-center">Colisage</th>
                      <th className="p-2.5 text-center">Unités</th>
                      <th className="p-2.5 text-right">P.U. (DA)</th>
                      <th className="p-2.5 text-center">Rem.</th>
                      <th className="p-2.5 text-right">Total Net (DA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {safeItems.map((item: any, idx: number) => {
                      const cartons = item.cartons ?? item.cartons_quantity ?? Math.floor((item.quantity_units || 0) / (item.units_per_carton || 1));
                      const pieces = item.pieces ?? item.pieces_quantity ?? ((item.quantity_units || 0) % (item.units_per_carton || 1));
                      return (
                        <tr key={idx} className="hover:bg-stone-50">
                          <td className="p-2.5">
                            {/* ✅ CHANGE 6: Resolve product name from Supabase join products(name) */}
                            <div className="font-bold text-stone-900">
                              {item.products?.name || item.product_name || 'Produit'}
                            </div>
                            {item.products?.variant && (
                              <div className="text-[10px] text-stone-400">{item.products.variant}</div>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-stone-600 whitespace-nowrap">
                            {cartons > 0 && `${cartons} ctn `}
                            {pieces > 0 && `${pieces} pcs`}
                          </td>
                          <td className="p-2.5 text-center font-bold text-stone-900 font-mono">
                            {item.quantity_units}
                          </td>
                          <td className="p-2.5 text-right font-mono text-stone-700">
                            {(item.unit_price || 0).toLocaleString('fr-FR')}
                          </td>
                          <td className="p-2.5 text-center text-stone-500 font-mono">
                            {(item.discount_percent || 0) > 0 ? `${item.discount_percent}%` : '-'}
                          </td>
                          <td className="p-2.5 text-right font-bold text-stone-900 font-mono">
                            {/* ✅ CHANGE 7: Use total_amount (DB column) with line_total fallback */}
                            {(item.total_amount || item.line_total || 0).toLocaleString('fr-FR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Recap & Signature */}
              <div className="grid grid-cols-2 gap-6 items-start">
                <div className="text-xs text-stone-500 space-y-3">
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <div className="font-semibold text-stone-800 mb-1">Règlement:</div>
                    <div>Payé ce jour: <strong className="font-mono text-stone-900">{paidAmount.toLocaleString('fr-FR')} DA</strong></div>
                    {remaining > 0 && (
                      <div className="text-rose-700 font-bold mt-0.5">
                        Solde restant à recouvrir: {remaining.toLocaleString('fr-FR')} DA
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-400 italic">
                    Conformément à la réglementation algérienne en vigueur régissant la distribution de produits cosmétiques et d'hygiène corporelle.
                  </div>
                </div>

                {/* Totals Table */}
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Montant Brut HT:</span>
                    <span>{totalGross.toLocaleString('fr-FR')} DA</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Remise Accordée:</span>
                      <span>-{totalDiscount.toLocaleString('fr-FR')} DA</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-sm text-stone-900 pt-2 border-t border-stone-300">
                    <span>NET À PAYER:</span>
                    <span className="text-amber-700">{totalNet.toLocaleString('fr-FR')} DA</span>
                  </div>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t border-stone-200 text-center text-xs">
                <div className="h-20 border border-dashed border-stone-300 rounded-xl p-2 flex flex-col justify-between text-stone-400">
                  <span>Cachet &amp; Signature du Client</span>
                </div>
                <div className="h-20 border border-dashed border-stone-300 rounded-xl p-2 flex flex-col justify-between text-stone-400">
                  <span>Cachet &amp; Signature Direction Solari</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};