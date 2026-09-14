export type UserRole = 'Admin' | 'Manager' | 'Cashier' | 'Warehouse' | 'Viewer';

export interface Company {
  id: string;
  name: string;
  code: string;
  currency: string;
  active: boolean;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  active: boolean;
  telegram_id?: string;
}

export interface Warehouse {
  id: string;
  company_id: string;
  name: string;
  code: string;
  is_default: boolean;
}

export interface Product {
  id: string;
  company_id: string;
  category_id: string;
  category_name: string;
  brand_id: string;
  brand_name: string;
  barcode: string;
  sku: string;
  name: string;
  variant?: string;
  units_per_carton: number;
  purchase_price: number;
  selling_price: number;
  minimum_stock_units: number;
  active: boolean;
  image_url?: string;
  created_at: string;
  updated_at: string;
  current_stock_units?: number;
  stock_units?: number;
  stock_cartons?: number;
  stock_pieces?: number;
  status?: string;
}

export interface Stock {
  id: string;
  company_id: string;
  warehouse_id: string;
  product_id: string;
  quantity_units: number;
  updated_at: string;
}

export type MovementType =
  | 'purchase'
  | 'sale'
  | 'customer_return'
  | 'supplier_return'
  | 'damaged'
  | 'expired'
  | 'stock_adjustment'
  | 'transfer_in'
  | 'transfer_out';

export interface StockMovement {
  id: string;
  company_id: string;
  warehouse_id: string;
  product_id: string;
  product_name?: string;
  user_id: string;
  user_name?: string;
  movement_type: MovementType;
  quantity_units: number;
  quantity_before: number;
  quantity_after: number;
  reference_type: string;
  reference_id: string;
  note?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  phone: string;
  address: string;
  default_discount_percent: number;
  balance: number;
  credit_limit?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerProductDiscount {
  id: string;
  company_id: string;
  customer_id: string;
  product_id: string;
  discount_percent: number;
  active: boolean;
}

export type LedgerTransactionType =
  | 'opening_balance'
  | 'sale_on_credit'
  | 'payment'
  | 'customer_return'
  | 'credit_adjustment'
  | 'invoice_cancellation'
  | 'refund';

export interface CustomerLedgerEntry {
  id: string;
  company_id: string;
  customer_id: string;
  reference_type: string;
  reference_id: string;
  transaction_type: LedgerTransactionType;
  debit: number;
  credit: number;
  balance_after: number;
  user_id: string;
  user_name?: string;
  note?: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  barcode: string;
  sku: string;
  quantity_units: number;
  units_per_carton: number;
  cartons_quantity: number;
  pieces_quantity: number;
  cartons?: number;
  pieces?: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  final_unit_price: number;
  line_total: number;
  purchase_cost: number;
  profit: number;
}

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'transfer' | 'check';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type SaleStatus = 'completed' | 'cancelled';

export interface Payment {
  id: string;
  company_id: string;
  sale_id?: string;
  customer_id: string;
  amount: number;
  payment_method: PaymentMethod;
  user_id: string;
  user_name?: string;
  reference?: string;
  note?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  company_id: string;
  warehouse_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  invoice_number: string;
  user_id: string;
  user_name: string;
  cashier_name?: string;
  status: SaleStatus;
  subtotal: number;
  total_gross?: number;
  discount_total: number;
  total_discount?: number;
  total_amount: number;
  total_net?: number;
  paid_amount: number;
  credit_amount: number;
  payment_status: PaymentStatus;
  client_request_id?: string;
  created_at: string;
  updated_at: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  notes?: string;
  items: SaleItem[];
  payments: Payment[];
}

export interface CustomerReturn {
  id: string;
  company_id: string;
  sale_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  warehouse_id: string;
  created_by: string;
  created_by_name: string;
  status: 'completed';
  total_amount: number;
  reason: string;
  created_at: string;
  items: {
    id: string;
    return_id: string;
    sale_item_id: string;
    product_id: string;
    product_name: string;
    quantity_units: number;
    unit_value: number;
    line_total: number;
  }[];
}

export type TaskType =
  | 'order_fulfillment'
  | 'stock_replenishment'
  | 'dispatch_delivery'
  | 'inventory_audit'
  | 'supplier_return'
  | 'cash_reconciliation';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';

export interface DistributionTask {
  id: string;
  company_id: string;
  title: string;
  description: string;
  task_type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to_role: UserRole;
  assigned_to_user_name?: string;
  related_invoice_number?: string;
  related_customer_name?: string;
  related_product_name?: string;
  due_date?: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface TerminalDevice {
  id: string;
  name: string;
  role: UserRole;
  type: 'mobile' | 'desktop' | 'tablet' | 'telegram';
  is_online: boolean;
  current_route?: string;
  last_active: string;
}

export interface AuditLog {
  id: string;
  company_id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: any;
  new_values?: any;
  reason?: string;
  created_at: string;
}

export interface CheckoutRequestItem {
  product_id: string;
  cartons: number;
  pieces: number;
  discount_override_percent?: number;
}

export interface CheckoutRequest {
  client_request_id: string;
  customer_id: string;
  warehouse_id: string;
  user_id?: string;
  user_name?: string;
  source_terminal_id?: string;
  items: CheckoutRequestItem[];
  payments: {
    amount: number;
    payment_method: PaymentMethod;
    note?: string;
  }[];
}

export interface CheckoutResponse {
  success: boolean;
  sale?: Sale;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
