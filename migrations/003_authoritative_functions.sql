-- ==========================================================
-- SORALI DISTRIBUTION — MIGRATION 003: AUTHORITATIVE FUNCTIONS
-- ==========================================================

-- Sequence for invoice numbers per company
CREATE TABLE IF NOT EXISTS company_invoice_sequences (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    last_val INTEGER NOT NULL DEFAULT 0
);

-- Function: Generate Concurrency-Safe Company-Scoped Invoice Number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_company_id UUID)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year INTEGER;
    v_next_val INTEGER;
    v_invoice_number VARCHAR(50);
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_TIMESTAMP);

    INSERT INTO company_invoice_sequences (company_id, year, last_val)
    VALUES (p_company_id, v_year, 1)
    ON CONFLICT (company_id) DO UPDATE
    SET last_val = CASE 
        WHEN company_invoice_sequences.year = v_year THEN company_invoice_sequences.last_val + 1
        ELSE 1
    END,
    year = v_year
    RETURNING last_val INTO v_next_val;

    v_invoice_number := 'INV-' || v_year || '-' || LPAD(v_next_val::TEXT, 6, '0');
    RETURN v_invoice_number;
END;
$$;

-- Function: Stock Entry
CREATE OR REPLACE FUNCTION stock_entry(
    p_company_id UUID,
    p_warehouse_id UUID,
    p_product_id UUID,
    p_quantity_units INTEGER,
    p_user_id UUID,
    p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_before INTEGER := 0;
    v_after INTEGER := 0;
BEGIN
    IF p_quantity_units <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    SELECT quantity_units INTO v_before
    FROM stock
    WHERE company_id = p_company_id AND warehouse_id = p_warehouse_id AND product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        v_before := 0;
        INSERT INTO stock (company_id, warehouse_id, product_id, quantity_units, updated_at)
        VALUES (p_company_id, p_warehouse_id, p_product_id, p_quantity_units, NOW());
        v_after := p_quantity_units;
    ELSE
        v_after := v_before + p_quantity_units;
        UPDATE stock
        SET quantity_units = v_after, updated_at = NOW()
        WHERE company_id = p_company_id AND warehouse_id = p_warehouse_id AND product_id = p_product_id;
    END IF;

    INSERT INTO stock_movements (
        company_id, warehouse_id, product_id, user_id, movement_type,
        quantity_units, quantity_before, quantity_after, reference_type, reference_id, note
    ) VALUES (
        p_company_id, p_warehouse_id, p_product_id, p_user_id, 'purchase',
        p_quantity_units, v_before, v_after, 'manual_entry', 'ENTRY-' || EXTRACT(EPOCH FROM NOW())::BIGINT, p_note
    );

    RETURN jsonb_build_object('success', true, 'quantity_before', v_before, 'quantity_after', v_after);
END;
$$;

-- Function: Stock Adjust
CREATE OR REPLACE FUNCTION stock_adjust(
    p_company_id UUID,
    p_warehouse_id UUID,
    p_product_id UUID,
    p_new_quantity_units INTEGER,
    p_user_id UUID,
    p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_before INTEGER := 0;
    v_diff INTEGER := 0;
BEGIN
    IF p_new_quantity_units < 0 THEN
        RAISE EXCEPTION 'Stock cannot be negative';
    END IF;

    SELECT quantity_units INTO v_before
    FROM stock
    WHERE company_id = p_company_id AND warehouse_id = p_warehouse_id AND product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        v_before := 0;
        INSERT INTO stock (company_id, warehouse_id, product_id, quantity_units, updated_at)
        VALUES (p_company_id, p_warehouse_id, p_product_id, p_new_quantity_units, NOW());
    ELSE
        UPDATE stock
        SET quantity_units = p_new_quantity_units, updated_at = NOW()
        WHERE company_id = p_company_id AND warehouse_id = p_warehouse_id AND product_id = p_product_id;
    END IF;

    v_diff := ABS(p_new_quantity_units - v_before);

    INSERT INTO stock_movements (
        company_id, warehouse_id, product_id, user_id, movement_type,
        quantity_units, quantity_before, quantity_after, reference_type, reference_id, note
    ) VALUES (
        p_company_id, p_warehouse_id, p_product_id, p_user_id, 'stock_adjustment',
        GREATEST(v_diff, 1), v_before, p_new_quantity_units, 'physical_audit', 'ADJ-' || EXTRACT(EPOCH FROM NOW())::BIGINT, p_note
    );

    RETURN jsonb_build_object('success', true, 'quantity_before', v_before, 'quantity_after', p_new_quantity_units);
END;
$$;
