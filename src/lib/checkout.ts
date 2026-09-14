/* ============================================================================
   FILE: src/lib/checkout.ts
   Companion module for ReceiptModal.tsx. That file imports toNum, formatDZD,
   extractErrorMessage, amountToWordsFrench and normalizeSale from here —
   this is what was missing from the drop.

   Shapes below are grounded in the real Sorali backend, not guessed:
     - POST /api/sales returns { success, sale, result }, where `sale` =
         supabase.from('sales')
           .select('*, customers(id, name, phone), sale_items(*, products(id, name, variant)))')
           .eq('id', data.sale_id).single()
     - sales columns:      subtotal, discount_amount, total_amount,
                            paid_amount, remaining_amount, invoice_number,
                            status, notes, client_request_id
     - sale_items columns: quantity_units, unit_price, discount_percent,
                            discount_amount, total_amount, joined `products`
   That's why normalizeSale() reads `sale_items[].products.name` instead of
   a flat `name` on the item — the raw Supabase row nests it that way, and
   ReceiptModal.tsx only ever reads the flat form.
   ========================================================================== */

// ---------------------------------------------------------------------------
// toNum — safe numeric coercion. Never throws, never returns NaN.
// ---------------------------------------------------------------------------
export function toNum(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// formatDZD — on-screen currency display, e.g. "12 450,00 DA"
// ---------------------------------------------------------------------------
const dzdFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatDZD(value: unknown): string {
  return `${dzdFormatter.format(toNum(value))} DA`;
}

// ---------------------------------------------------------------------------
// extractErrorMessage — the same "never show [object Object]" logic your
// Gemini thread already put inline in PosView.tsx's checkout catch block.
// Kept here so both places share one implementation instead of drifting.
// ---------------------------------------------------------------------------
export function extractErrorMessage(err: unknown, fallback = 'Une erreur est survenue.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    const anyErr = err as Record<string, any>;
    if (typeof anyErr.message === 'string' && anyErr.message) return anyErr.message;
    if (typeof anyErr.error?.message === 'string' && anyErr.error.message) return anyErr.error.message;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// amountToWordsFrench — "montant en lettres" line for the legal invoice.
// Correct for 0–999 999 999, including the fiddly bits (soixante-dix,
// quatre-vingt(s), cent vs cents). One soft spot: strict Academie-francaise
// style drops the 's' on "quatre-vingts"/"cents" when "mille" follows in
// the same number (80 000 -> "quatre-vingt mille"); this keeps the 's',
// which is common usage but not the Academie-strict form. Only matters on
// totals that land on an exact multiple of 80 000 or 100 000 — worth a
// glance the first time that happens, the rest is solid.
// ---------------------------------------------------------------------------
const UNITS_FR = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

const TENS_FR: Record<number, string> = {
  2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante',
};

function twoDigitsFr(n: number): string {
  if (n < 20) return UNITS_FR[n];
  const tens = Math.floor(n / 10);
  const rem = n % 10;

  if (tens === 7) {
    if (rem === 0) return 'soixante-dix';
    if (rem === 1) return 'soixante et onze';
    return 'soixante-' + UNITS_FR[10 + rem];
  }
  if (tens === 9) {
    return rem === 0 ? 'quatre-vingt-dix' : 'quatre-vingt-' + UNITS_FR[10 + rem];
  }
  if (tens === 8) {
    return rem === 0 ? 'quatre-vingts' : 'quatre-vingt-' + UNITS_FR[rem];
  }
  const word = TENS_FR[tens];
  if (rem === 0) return word;
  if (rem === 1) return word + ' et un';
  return word + '-' + UNITS_FR[rem];
}

function threeDigitsFr(n: number): string {
  if (n < 100) return twoDigitsFr(n);
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  let str = hundreds === 1 ? 'cent' : `${UNITS_FR[hundreds]} cent${rem === 0 ? 's' : ''}`;
  if (rem > 0) str += ' ' + twoDigitsFr(rem);
  return str;
}

function chunkFr(n: number, unit: 'mille' | 'million' | 'milliard' | ''): string {
  if (n <= 0) return '';
  if (unit === 'mille') return n === 1 ? 'mille' : `${threeDigitsFr(n)} mille`;
  if (unit === 'million') return `${threeDigitsFr(n)} million${n === 1 ? '' : 's'}`;
  if (unit === 'milliard') return `${threeDigitsFr(n)} milliard${n === 1 ? '' : 's'}`;
  return threeDigitsFr(n);
}

function numberToFrenchWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'zéro';

  const milliards = Math.floor(n / 1000000000); n %= 1000000000;
  const millions = Math.floor(n / 1000000); n %= 1000000;
  const milliers = Math.floor(n / 1000); n %= 1000;
  const reste = n;

  return [
    chunkFr(milliards, 'milliard'),
    chunkFr(millions, 'million'),
    chunkFr(milliers, 'mille'),
    chunkFr(reste, ''),
  ].filter(Boolean).join(' ');
}

export function amountToWordsFrench(value: unknown): string {
  const num = toNum(value, 0);
  const sign = num < 0 ? 'moins ' : '';
  const abs = Math.abs(num);
  const dinars = Math.floor(abs);
  const centimes = Math.round((abs - dinars) * 100);

  let result = `${sign}${numberToFrenchWords(dinars)} ${dinars <= 1 ? 'dinar algérien' : 'dinars algériens'}`;

  if (centimes > 0) {
    result += ` et ${numberToFrenchWords(centimes)} ${centimes <= 1 ? 'centime' : 'centimes'}`;
  }

  return result;
}

// ---------------------------------------------------------------------------
// normalizeSale — the actual crash guard. Takes whatever the backend (or a
// half-finished network response) handed back and returns something every
// field ReceiptModal.tsx reads can rely on existing.
// ---------------------------------------------------------------------------
export interface NormalizedSaleItem {
  id: string;
  name: string;
  variant: string;
  quantity_units: number;
  unit_price: number;
  discount_percent: number;
  total_amount: number;
}

export interface NormalizedSale {
  id: string;
  invoice_number: string;
  created_at: string | null;
  status: string;
  duplicate: boolean;
  customer: { name: string; phone: string };
  user_name: string;
  cashier: string;
  items: NormalizedSaleItem[];
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_method: string;
  notes: string;
  company?: {
    name?: string;
    address?: string;
    phone?: string;
    rc?: string;
    nif?: string;
    nis?: string;
    ai?: string;
    currency?: string;
  };
}

export function normalizeSale(raw: any): NormalizedSale {
  const s = raw && typeof raw === 'object' ? raw : {};

  // sale_items comes back nested as `{ ...columns, products: {id,name,variant} }`
  // from the `sale_items(*, products(id, name, variant))` join — flatten it
  // here so ReceiptModal can just read it.name / it.variant directly.
  const rawItems: any[] = Array.isArray(s.items)
    ? s.items
    : Array.isArray(s.sale_items)
    ? s.sale_items
    : [];

  const items: NormalizedSaleItem[] = rawItems
    .filter((it) => it && typeof it === 'object')
    .map((it: any, idx: number) => {
      const product = it.products || it.product || {};
      const quantity = toNum(it.quantity_units, 0);
      const price = toNum(it.unit_price, 0);
      const discountPct = toNum(it.discount_percent, 0);
      return {
        id: it.id ? String(it.id) : `line-${idx}`,
        name: it.name || product.name || 'Article',
        variant: it.variant || product.variant || '',
        quantity_units: quantity,
        unit_price: price,
        discount_percent: discountPct,
        // Last-resort fallback for display only — doesn't touch real sale
        // data, just keeps a printed line from showing 0,00 if the backend
        // response happened to omit total_amount on that row.
        total_amount: toNum(it.total_amount, quantity * price * (1 - discountPct / 100)),
      };
    });

  const customerRaw = s.customer || s.customers || {};
  const total = toNum(s.total_amount, items.reduce((sum, it) => sum + it.total_amount, 0));
  const paid = toNum(s.paid_amount, 0);

  return {
    id: s.id ? String(s.id) : '',
    invoice_number: s.invoice_number || 'FAC-EN-ATTENTE',
    created_at: s.created_at || null,
    status: s.status || 'completed',
    duplicate: Boolean(s.duplicate),
    customer: {
      name: customerRaw.name || 'Client comptoir',
      phone: customerRaw.phone || '',
    },
    user_name: s.user_name || s.cashier || s.users?.name || s.profiles?.name || '',
    cashier: s.cashier || s.user_name || '',
    items,
    subtotal: toNum(s.subtotal, items.reduce((sum, it) => sum + it.quantity_units * it.unit_price, 0)),
    discount_amount: toNum(s.discount_amount, 0),
    total_amount: total,
    paid_amount: paid,
    remaining_amount: toNum(s.remaining_amount, Math.max(0, total - paid)),
    payment_method: s.payment_method || 'cash',
    notes: s.notes || '',
    company: s.company || s.companies || undefined,
  };
}
