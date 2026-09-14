-- ==========================================================
-- SORALI DISTRIBUTION — MIGRATION 002: SALES, CUSTOMERS, LEDGER, TASKS
-- ==========================================================

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    default_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (default_discount_percent >= 0 AND default_discount_percent <= 100),
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer Product Discounts (Takes priority over customer default discount)
CREATE TABLE IF NOT EXISTS customer_product_discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    discount_percent NUMERIC(5, 2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_customer_product_discount UNIQUE (company_id, customer_id, product_id)
);

-- Sales (Historical Commercial Transaction)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled')),
    subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0),
    discount_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0),
    total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
    paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    credit_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (credit_amount >= 0),
    payment_status VARCHAR(30) NOT NULL CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    client_request_id VARCHAR(100),
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_invoice_number UNIQUE (company_id, invoice_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_idempotency 
    ON sales (company_id, client_request_id) 
    WHERE client_request_id IS NOT NULL;

-- Sale Items (Immutable Snapshots of Historical Values)
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_units INTEGER NOT NULL CHECK (quantity_units > 0),
    units_per_carton INTEGER NOT NULL CHECK (units_per_carton > 0),
    cartons_quantity INTEGER NOT NULL DEFAULT 0 CHECK (cartons_quantity >= 0),
    pieces_quantity INTEGER NOT NULL DEFAULT 0 CHECK (pieces_quantity >= 0),
    unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    final_unit_price NUMERIC(14, 2) NOT NULL CHECK (final_unit_price >= 0),
    line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
    purchase_cost NUMERIC(14, 2) NOT NULL CHECK (purchase_cost >= 0),
    profit NUMERIC(14, 2) NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'card', 'transfer')),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reference VARCHAR(100),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer Ledger (Immutable Debt & Settlement Ledger)
-- debit = customer owes us more; credit = customer owes us less
CREATE TABLE IF NOT EXISTS customer_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    reference_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'sale_on_credit', 'payment', 'customer_return', 'credit_adjustment', 'invoice_cancellation', 'refund'
    )),
    debit NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
    credit NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
    balance_after NUMERIC(14, 2) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON customer_ledger (company_id, customer_id, created_at DESC);

-- Customer Returns (Document-level return validation)
CREATE TABLE IF NOT EXISTS customer_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'completed',
    total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Real-Time Task Management (Operational Dispatch & Fulfillment)
CREATE TABLE IF NOT EXISTS distribution_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN (
        'order_fulfillment', 'stock_replenishment', 'dispatch_delivery',
        'inventory_audit', 'supplier_return', 'cash_reconciliation'
    )),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(30) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
    assigned_to_role VARCHAR(50) NOT NULL CHECK (assigned_to_role IN ('Admin', 'Manager', 'Cashier', 'Warehouse', 'Viewer')),
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_user_name VARCHAR(255),
    related_invoice_number VARCHAR(50),
    related_customer_name VARCHAR(255),
    related_product_name VARCHAR(255),
    due_date TIMESTAMPTZ,
    created_by_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Audit Log (Strict audibility)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
