// server/routes.ts
import { requireAuth, createToken } from './middleware/auth.js';
import { Express, Request, Response } from 'express';
import { supabase } from './supabase_service.js';
import { requireAuth } from './middleware/auth.js';

// Helper to validate UUID format
const isValidUuid = (id: any) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof id === 'string' && uuidRegex.test(id);
};

export function registerRoutes(app: Express) {
  // Global Request Logger
  app.use('/api', (req: Request, res: Response, next) => {
    console.log(`[API REQUEST] ${req.method} ${req.originalUrl}`);
    next();
  });

    // 1. Current user session info endpoint (Verifies the token automatically)
  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    res.json({
      success: true,
      user: req.user,
    });
  });
  // ============ AUTHENTICATION (Public Routes) ============

  // List of users for the login screen dropdown (only active users with a PIN set)
  app.get('/api/auth/users', async (_req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('active', true)
        .not('pin_hash', 'is', null) // Only show users who actually have a PIN
        .order('full_name');

      if (error) throw error;

      // Map full_name to name so the frontend LoginScreen works unchanged
      const users = (data || []).map((u: any) => ({
        id: u.id,
        name: u.full_name,
        role: u.role,
      }));
      
      res.json({ success: true, users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Login: validates PIN via database RPC, returns signed token + user data
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { user_id, pin } = req.body || {};
      
      if (!user_id || !pin) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING', message: 'Profil et code PIN requis.' },
        });
      }

      // Call the secure database function we created in Step 1
      const { data, error } = await supabase.rpc('verify_user_pin', {
        p_user_id: user_id,
        p_pin: String(pin),
      });

      if (error || !data) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_PIN', message: 'Code PIN incorrect.' },
        });
      }

      // Generate the 12-hour shift token
      const token = createToken(data);
      
      res.json({
        success: true,
        token,
        user: {
          id: data.id,
          name: data.full_name,
          role: data.role,
          company_id: data.company_id,
        },
      });
    } catch (err) {
      // Catch-all for RPC exceptions (like INVALID_CREDENTIALS)
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_PIN', message: 'Code PIN incorrect.' },
      });
    }
  });

  // Logout (Tokens are stateless, so the server just acknowledges. 
  // The frontend will delete the token from localStorage)
  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.json({ success: true });
  });
  // 2. Company Endpoint
  app.get('/api/company', requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id || 'd7d6d1a9-f4db-4214-874d-d8267b3dfde5';
      const { data } = await supabase.from('companies').select('*').eq('id', companyId).single();
      res.json(data || { id: companyId, name: 'Sorali Distribution', currency: 'DZD' });
    } catch {
      res.json({ id: 'd7d6d1a9-f4db-4214-874d-d8267b3dfde5', name: 'Sorali Distribution', currency: 'DZD' });
    }
  });

  // 3. Dashboard / Stats / Summary Endpoints
  const handleGetDashboardStats = async (req: Request, res: Response) => {
    res.json({
      total_sales: 0,
      total_revenue: 0,
      revenue: 0,
      sales_count: 0,
      total_products: 16,
      total_customers: 8,
      low_stock_count: 0,
      pending_orders: 0,
      monthly_revenue: 0,
      daily_sales: 0,
      total_netSales: 0,
      total_discounts: 0,
      total_COGS: 0,
      grossProfit: 0,
      totalCustomerDebt: 0
    });
  };

  app.get('/api/dashboard', requireAuth, handleGetDashboardStats);
  app.get('/api/stats', requireAuth, handleGetDashboardStats);
  app.get('/api/summary', requireAuth, handleGetDashboardStats);
  app.get('/api/metrics', requireAuth, handleGetDashboardStats);
  app.get('/api/analytics', requireAuth, handleGetDashboardStats);

  // 4. Products Endpoints
  const fetchEnrichedProducts = async (companyId?: string) => {
    let query = supabase.from('products').select('*, stock(*), categories(name), brands(name)');
    if (companyId) query = query.eq('company_id', companyId);
    
    const { data: products, error } = await query;
    if (error) throw error;

    return (products || []).map((p: any) => {
      if (!p) return null;
      const stockFromTable = Array.isArray(p.stock) && p.stock.length > 0
        ? p.stock.reduce((sum: number, s: any) => sum + Number(s?.quantity_units || 0), 0)
        : 0;

      const totalStock = stockFromTable > 0 ? stockFromTable : Number(p.initial_stock_units || p.current_stock_units || 0);
      const sellPrice = Number(p.selling_price || p.price || 0);
      const buyPrice = Number(p.purchase_price || p.cost || 0);

      return {
        ...p,
        selling_price: sellPrice,
        purchase_price: buyPrice,
        units_per_carton: Number(p.units_per_carton || 1),
        current_stock_units: totalStock,
        initial_stock_units: Number(p.initial_stock_units || totalStock),
        stock: Array.isArray(p.stock) ? p.stock : []
      };
    }).filter(Boolean);
  };

  const handleGetProducts = async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      const products = await fetchEnrichedProducts(companyId);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.get('/api/products', requireAuth, handleGetProducts);
  app.get('/api/pos/products', requireAuth, handleGetProducts);
  app.get('/api/warehouse/products', requireAuth, handleGetProducts);
  app.get('/api/caisse/products', requireAuth, handleGetProducts);
  app.get('/api/inventory', requireAuth, handleGetProducts);

  // 5. Stock Endpoints
  const handleGetStock = async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      let query = supabase.from('stock').select('*');
      if (companyId) query = query.eq('company_id', companyId);
      const { data } = await query;
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.get('/api/stock', requireAuth, handleGetStock);
  app.get('/api/warehouse-stock', requireAuth, handleGetStock);
  app.get('/api/pos/stock', requireAuth, handleGetStock);
  app.get('/api/caisse/stock', requireAuth, handleGetStock);

  // 6. Sales GET Endpoint
  app.get('/api/sales', requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      let query = supabase.from('sales').select('*, customers(*), sale_items(*)');
      if (companyId) query = query.eq('company_id', companyId);
      
      const { data } = await query;
      const salesList = data || [];

      const enrichedSales = salesList.map((sale: any) => {
        if (!sale) return null;
        const totalNet = Number(sale.total_amount || sale.total || 0);
        const paidAmount = Number(sale.paid_amount || totalNet);
        return {
          ...sale,
          total_net: totalNet,
          paid_amount: paidAmount,
          total_amount: totalNet,
          items: sale.items || sale.sale_items || [],
          customer: sale.customers || sale.customer || { name: 'Walk-in Client', balance: 0 }
        };
      }).filter(Boolean);

      res.json(enrichedSales);
    } catch {
      res.json([]);
    }
  });

  // 7. Print & Invoice Endpoints
  const handlePrintRequest = (req: Request, res: Response) => {
    res.json({ success: true, message: 'Print job received successfully' });
  };

  app.post('/api/print', requireAuth, handlePrintRequest);
  app.get('/api/print', requireAuth, handlePrintRequest);
  app.post('/api/sales/:id/print', requireAuth, handlePrintRequest);
  app.get('/api/sales/:id/print', requireAuth, handlePrintRequest);
  app.get('/api/invoices', requireAuth, async (req: Request, res: Response) => {
    res.json([]);
  });
  app.post('/api/invoices', requireAuth, handlePrintRequest);

  // 8. Sales Cancellation Route (STRICT RPC INTEGRATION)
  app.post('/api/sales/:id/cancel', requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      const userId = req.user?.id;
      if (!companyId) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing company context' } });
      }

      const saleId = req.params.id;
      if (!isValidUuid(saleId)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid sale id' } });
      }

      const { data, error } = await supabase.rpc('cancel_sale', {
        p_sale_id: saleId,
        p_company_id: companyId,
        p_user_id: userId,
        p_reason: req.body?.reason ?? null,
      });

      if (error) {
        const isBusiness = error.message.includes('SALE_NOT_FOUND') || error.message.includes('FORBIDDEN') || error.message.includes('CANNOT_CANCEL_STATUS');
        return res.status(isBusiness ? 400 : 500).json({
          success: false,
          error: { code: isBusiness ? 'VALIDATION' : 'CANCEL_FAILED', message: error.message },
        });
      }

      return res.json({ success: true, result: data });
    } catch (err: any) {
      console.error('Cancel error:', err.message);
      return res.status(500).json({ success: false, error: { code: 'CANCEL_ERROR', message: err.message } });
    }
  });

   // ============================================================
  // 9. Stock Movements & Tasks
  // ============================================================

  // Helper: find the company's main warehouse UUID dynamically
  const getMainWarehouseId = async (companyId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('warehouses')
      .select('id')
      .eq('company_id', companyId)
      .order('name')
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  };

  // ---- LIST: Stock movements ----
  app.get('/api/stock/movements', requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      let query = supabase.from('stock_movements').select('*');
      if (companyId) query = query.eq('company_id', companyId);
      const { data } = await query;
      res.json(data || []);
    } catch {
      res.json([]);
    }
  });

  // ---- LIST: Tasks ----
  app.get('/api/tasks', requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      let query = supabase.from('tasks').select('*');
      if (companyId) query = query.eq('company_id', companyId);
      const { data } = await query;
      res.json(data || []);
    } catch {
      res.json([]);
    }
  });

  // ---- LIST: Users ----
  app.get('/api/users', requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      let query = supabase.from('users').select('*');
      if (companyId) query = query.eq('company_id', companyId);
      const { data } = await query;
      res.json(data || []);
    } catch {
      res.json([]);
    }
  });

  // ---- CREATE: Stock Entry (Réception / Livraison) ----
  app.post('/api/stock/entry', requireAuth, async (req: Request, res: Response) => {
    try {
      const { product_id, quantity_units, note } = req.body || {};
      const units = Number(quantity_units);

      if (!product_id || !units || units <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID', message: 'Quantité invalide.' },
        });
      }

      const warehouseId = await getMainWarehouseId(req.user?.company_id);
      if (!warehouseId) {
        return res.status(500).json({
          success: false,
          error: { code: 'NO_WAREHOUSE', message: 'Aucun entrepôt trouvé.' },
        });
      }

      // Read current stock from the `stock` table (the source the UI reads)
      const { data: stockRow, error: stockErr } = await supabase
        .from('stock')
        .select('id, quantity_units')
        .eq('product_id', product_id)
        .eq('warehouse_id', warehouseId)
        .maybeSingle();
      if (stockErr) throw stockErr;

      const currentStock = stockRow?.quantity_units || 0;
      const newStock = currentStock + units;

      // Upsert the `stock` table
      if (stockRow) {
        const { error: updErr } = await supabase
          .from('stock')
          .update({ quantity_units: newStock })
          .eq('id', stockRow.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('stock')
          .insert({
            company_id: req.user?.company_id,
            product_id,
            warehouse_id: warehouseId,
            quantity_units: newStock,
          });
        if (insErr) throw insErr;
      }

      // Keep products.current_stock_units in sync
      const { error: prodErr } = await supabase
        .from('products')
        .update({ current_stock_units: newStock })
        .eq('id', product_id);
      if (prodErr) throw prodErr;

      // Record the movement
      const { data: movement, error: movErr } = await supabase
        .from('stock_movements')
        .insert({
          company_id: req.user?.company_id,
          product_id,
          warehouse_id: warehouseId,
          movement_type: 'purchase',
          quantity_units: units,
          quantity_before: currentStock,
          quantity_after: newStock,
          user_name: req.user?.name || 'Système',
          note: note || null,
        })
        .select()
        .single();
      if (movErr) throw movErr;

      res.json({ success: true, movement, new_stock: newStock });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---- CREATE: Stock Damage (Casse / Péremption) ----
  app.post('/api/stock/damage', requireAuth, async (req: Request, res: Response) => {
    try {
      const { product_id, quantity_units, note } = req.body || {};
      const units = Number(quantity_units);

      if (!product_id || !units || units <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID', message: 'Quantité invalide.' },
        });
      }

      const warehouseId = await getMainWarehouseId(req.user?.company_id);
      if (!warehouseId) {
        return res.status(500).json({
          success: false,
          error: { code: 'NO_WAREHOUSE', message: 'Aucun entrepôt trouvé.' },
        });
      }

      const { data: stockRow, error: stockErr } = await supabase
        .from('stock')
        .select('id, quantity_units')
        .eq('product_id', product_id)
        .eq('warehouse_id', warehouseId)
        .maybeSingle();
      if (stockErr) throw stockErr;

      const current = stockRow?.quantity_units || 0;
      if (units > current) {
        return res.status(400).json({
          success: false,
          error: { code: 'INSUFFICIENT', message: `Stock insuffisant (disponible: ${current}).` },
        });
      }

      const newStock = current - units;

      const { error: updErr } = await supabase
        .from('stock')
        .update({ quantity_units: newStock })
        .eq('id', stockRow.id);
      if (updErr) throw updErr;

      const { error: prodErr } = await supabase
        .from('products')
        .update({ current_stock_units: newStock })
        .eq('id', product_id);
      if (prodErr) throw prodErr;

      const { data: movement, error: movErr } = await supabase
        .from('stock_movements')
        .insert({
          company_id: req.user?.company_id,
          product_id,
          warehouse_id: warehouseId,
          movement_type: 'damaged',
          quantity_units: -units,
          quantity_before: current,
          quantity_after: newStock,
          user_name: req.user?.name || 'Système',
          note: note || null,
        })
        .select()
        .single();
      if (movErr) throw movErr;

      res.json({ success: true, movement, new_stock: newStock });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---- CREATE: Stock Adjust (Inventaire / Override) ----
  app.post('/api/stock/adjust', requireAuth, async (req: Request, res: Response) => {
    try {
      const { product_id, target_units, note } = req.body || {};
      const target = Number(target_units);

      if (!product_id || isNaN(target) || target < 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID', message: 'Cible invalide.' },
        });
      }

      const warehouseId = await getMainWarehouseId(req.user?.company_id);
      if (!warehouseId) {
        return res.status(500).json({
          success: false,
          error: { code: 'NO_WAREHOUSE', message: 'Aucun entrepôt trouvé.' },
        });
      }

      const { data: stockRow, error: stockErr } = await supabase
        .from('stock')
        .select('id, quantity_units')
        .eq('product_id', product_id)
        .eq('warehouse_id', warehouseId)
        .maybeSingle();
      if (stockErr) throw stockErr;

      const oldStock = stockRow?.quantity_units || 0;
      const delta = target - oldStock;

      if (stockRow) {
        const { error: updErr } = await supabase
          .from('stock')
          .update({ quantity_units: target })
          .eq('id', stockRow.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('stock')
          .insert({
            company_id: req.user?.company_id,
            product_id,
            warehouse_id: warehouseId,
            quantity_units: target,
          });
        if (insErr) throw insErr;
      }

      const { error: prodErr } = await supabase
        .from('products')
        .update({ current_stock_units: target })
        .eq('id', product_id);
      if (prodErr) throw prodErr;

      const { data: movement, error: movErr } = await supabase
        .from('stock_movements')
        .insert({
          company_id: req.user?.company_id,
          product_id,
          warehouse_id: warehouseId,
          movement_type: 'stock_adjustment',
          quantity_units: delta,
          quantity_before: oldStock,
          quantity_after: target,
          user_name: req.user?.name || 'Système',
          note: note || `Ajustement: ${oldStock} → ${target}`,
        })
        .select()
        .single();
      if (movErr) throw movErr;

      res.json({ success: true, movement, new_stock: target });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  // 10. Products - POST
  app.post('/api/products', requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      const productData = { ...req.body, company_id: companyId };

      const initialStock = Number(productData.initial_stock_units || productData.current_stock_units || productData.quantity || 0);
      delete productData.initial_stock_units;
      delete productData.current_stock_units;
      delete productData.stock_quantity;
      delete productData.brand_name;
      delete productData.category_name;

      const { data: newProduct, error: prodError } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (prodError) throw prodError;

      if (initialStock > 0 && newProduct) {
        const { data: warehouse } = await supabase
          .from('warehouses')
          .select('id')
          .eq('company_id', companyId)
          .limit(1)
          .single();

        await supabase.from('stock').insert({
          product_id: newProduct.id,
          company_id: companyId,
          warehouse_id: warehouse?.id || 'f465ed15-ffe9-4e75-ac8c-7fb4ad0e6672',
          quantity_units: initialStock
        });
      }

      res.status(201).json(newProduct);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Customers / Clients Endpoints
  const handleGetCustomers = async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      let query = supabase.from('customers').select('*');
      if (companyId) query = query.eq('company_id', companyId);

      const { data } = await query;

      // Fetch computed balances from the customer_balances view
      let balQuery = supabase.from('customer_balances').select('customer_id, balance');
      if (companyId) balQuery = balQuery.eq('company_id', companyId);
      const { data: balances } = await balQuery;

      // Map customer_id -> balance for fast lookup
      const balanceMap = new Map(
        (balances || []).map((b: any) => [b.customer_id, Number(b.balance) || 0])
      );

      const sanitized = (data || []).map((c: any) => ({
        ...c,
        balance: balanceMap.get(c.id) || 0,
        credit_limit: Number(c.credit_limit || 500000),
        default_discount_percent: Number(c.default_discount_percent || 0)
      }));

      res.json(sanitized);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.get('/api/customers', requireAuth, handleGetCustomers);
  app.get('/api/clients', requireAuth, handleGetCustomers);
  app.get('/api/pos/customers', requireAuth, handleGetCustomers);
  app.get('/api/pos/clients', requireAuth, handleGetCustomers);
  app.get('/api/caisse/customers', requireAuth, handleGetCustomers);
  app.get('/api/caisse/clients', requireAuth, handleGetCustomers);
  app.get('/api/company/customers', requireAuth, handleGetCustomers);
  app.get('/api/suppliers', requireAuth, handleGetCustomers);
  // Record a payment on a customer's credit account (Régler / settlement)
  app.post('/api/customers/:id/payments', requireAuth, async (req: Request, res: Response) => {
    try {
      const customerId = req.params.id;
      const companyId = req.user?.company_id;
      const userId = req.user?.id;
      const { amount, method, note } = req.body || {};

      const amountNum = Number(amount);
      if (!customerId || !amountNum || amountNum <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID', message: 'Montant invalide.' },
        });
      }
 
      // Verify the customer belongs to this company
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('id')
        .eq('id', customerId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (custErr || !customer) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Client introuvable.' },
        });
      }

      // Insert the payment (sale_id stays null = payment on account, not tied to one sale)
      const { data: payment, error: payErr } = await supabase
        .from('customer_payments')
        .insert({
          company_id: companyId,
          customer_id: customerId,
          user_id: userId || null,
          payment_method: method || 'cash',
          amount: amountNum,
          notes: note || null,
        })
        .select()
        .single();
      if (payErr) throw payErr;

      // Fetch the freshly-updated balance from the view
      const { data: bal } = await supabase
        .from('customer_balances')
        .select('balance')
        .eq('customer_id', customerId)
        .maybeSingle();

      res.json({
        success: true,
        payment,
        new_balance: Number(bal?.balance) || 0,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post('/api/customers', requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...req.body, company_id: companyId }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. Metadata Routes
  app.get('/api/categories', requireAuth, async (_req, res) => {
    const { data } = await supabase.from('categories').select('*');
    res.json(data || []);
  });

  app.get('/api/brands', requireAuth, async (_req, res) => {
    const { data } = await supabase.from('brands').select('*');
    res.json(data || []);
  });

  app.get('/api/warehouses', requireAuth, async (_req, res) => {
    const { data } = await supabase.from('warehouses').select('*');
    res.json(data || []);
  });

  // 13. Sales Checkout Handler (STRICT RPC INTEGRATION - NO FALLBACKS)
  const handleCheckout = async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      const userId = req.user?.id;
      
      if (!companyId) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing company context' } });
      }

      const saleData = req.body;

      // Resolve warehouse
      let warehouseId = saleData.warehouse_id;
      if (!isValidUuid(warehouseId)) {
        const { data: wh } = await supabase
          .from('warehouses')
          .select('id')
          .eq('company_id', companyId)
          .eq('active', true)
          .limit(1)
          .single();
          
        if (!wh) {
          return res.status(400).json({ success: false, error: { code: 'NO_WAREHOUSE', message: 'No active warehouse configured' } });
        }
        warehouseId = wh.id;
      }

      // Minimal contract — the DB computes all financials
      const rawItems = saleData.items || saleData.cart || saleData.lines || saleData.products || [];
      const items = rawItems.map((item: any) => ({
        product_id: item.product_id ?? item.id ?? item.article_id,
        quantity_units: Number(item.quantity_units ?? item.quantity ?? item.units ?? item.qty ?? 0),
        unit_price: Number(item.unit_price ?? item.price ?? item.selling_price ?? item.pu ?? 0),
        discount_percent: Number(item.discount_percent ?? item.discount ?? 0),
      }));

      if (items.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'EMPTY_CART', message: 'Cannot checkout an empty cart' } });
      }

      const rawPaid = saleData.paidAmount ?? saleData.paid_amount ?? saleData.paid;
      const paidAmt = rawPaid === undefined || rawPaid === null ? null : Number(rawPaid);

      // Idempotency key generated by frontend
      const clientRequestId = saleData.client_request_id ?? null;

      const { data, error } = await supabase.rpc('create_sale', {
        p_company_id: companyId,
        p_warehouse_id: warehouseId,
        p_user_id: userId,
        p_customer_id: saleData.customer_id || saleData.client_id || null,
        p_items: items,
        p_paid_amount: paidAmt,
        p_payment_method: saleData.payment_method || 'cash',
        p_notes: saleData.notes ?? null,
        p_client_request_id: clientRequestId,
      });

      if (error) {
        // The DB handles all validation. Fail loudly without dangerous fallbacks.
        console.error('create_sale failed:', error.message);
        const isBusiness =
          error.message.includes('INSUFFICIENT_STOCK') ||
          error.message.includes('PRODUCT_NOT_FOUND') ||
          error.message.includes('INVALID_QUANTITY') ||
          error.message.includes('INVALID_PRICE') ||
          error.message.includes('INVALID_DISCOUNT') ||
          error.message.includes('INVALID_PAID_AMOUNT') ||
          error.message.includes('EMPTY_CART') ||
          error.message.includes('WAREHOUSE_NOT_FOUND') ||
          error.message.includes('CUSTOMER_NOT_FOUND');
          
        return res.status(isBusiness ? 400 : 500).json({
          success: false,
          error: { code: isBusiness ? 'VALIDATION' : 'CHECKOUT_FAILED', message: error.message },
        });
      }

      // Fetch the fully resolved receipt data straight from the database
      const { data: fullSale } = await supabase
        .from('sales')
        .select('*, customers(id, name, phone), sale_items(*, products(id, name, variant))')
        .eq('id', data.sale_id)
        .single();

      return res.status(201).json({ success: true, sale: fullSale, result: data });
    } catch (err: any) {
      console.error('Checkout error:', err.message);
      return res.status(500).json({ success: false, error: { code: 'CHECKOUT_ERROR', message: err.message } });
    }
  };

  app.post('/api/sales', requireAuth, handleCheckout);
  app.post('/api/sales/checkout', requireAuth, handleCheckout);
  // Helper: find the company's main warehouse UUID
 
  // ============ STOCK OPERATIONS ============

  // GET /api/stock/movements — list all stock movements
  app.get('/api/stock/movements', requireAuth, async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*, products(name, sku)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      res.json({ success: true, movements: data || [] });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/stock/entry — add stock (réception / livraison)
  app.post('/api/stock/entry', requireAuth, async (req: Request, res: Response) => {
    try {
      const { product_id, warehouse_id, quantity_units, note } = req.body || {};
      const units = Number(quantity_units);

      if (!product_id || !units || units <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID', message: 'Quantité invalide.' },
        });
      }

      // 1. Increase product stock atomically
      const { data: product, error: fetchErr } = await supabase
        .from('products')
        .select('id, current_stock_units')
        .eq('id', product_id)
        .single();
      if (fetchErr || !product) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Produit introuvable.' },
        });
      }

      const newStock = (product.current_stock_units || 0) + units;
      const { error: updErr } = await supabase
        .from('products')
        .update({ current_stock_units: newStock })
        .eq('id', product_id);
      if (updErr) throw updErr;

      // 2. Record the movement
      const { data: movement, error: movErr } = await supabase
        .from('stock_movements')
        .insert({
          company_id: req.user?.company_id,
          product_id,
          warehouse_id: warehouse_id || 'wh_main_01',
          movement_type: 'purchase',
          quantity_units: units,
          user_name: req.user?.name || req.body?.user_name || 'Système',
          note: note || null,
        })
        .select()
        .single();
      if (movErr) throw movErr;

      res.json({ success: true, movement, new_stock: newStock });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/stock/damage — remove stock (casse / péremption)
  app.post('/api/stock/damage', requireAuth, async (req: Request, res: Response) => {
    try {
      const { product_id, warehouse_id, quantity_units, note } = req.body || {};
      const units = Number(quantity_units);

      if (!product_id || !units || units <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID', message: 'Quantité invalide.' },
        });
      }

      const { data: product, error: fetchErr } = await supabase
        .from('products')
        .select('id, current_stock_units')
        .eq('id', product_id)
        .single();
      if (fetchErr || !product) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Produit introuvable.' },
        });
      }

      const current = product.current_stock_units || 0;
      if (units > current) {
        return res.status(400).json({
          success: false,
          error: { code: 'INSUFFICIENT', message: `Stock insuffisant (disponible: ${current}).` },
        });
      }

      const newStock = current - units;
      const { error: updErr } = await supabase
        .from('products')
        .update({ current_stock_units: newStock })
        .eq('id', product_id);
      if (updErr) throw updErr;

      const { data: movement, error: movErr } = await supabase
        .from('stock_movements')
        .insert({
          company_id: req.user?.company_id,
          product_id,
          warehouse_id: warehouse_id || 'wh_main_01',
          movement_type: 'damaged',
          quantity_units: -units,
          user_name: req.user?.name || req.body?.user_name || 'Système',
          note: note || null,
        })
        .select()
        .single();
      if (movErr) throw movErr;

      res.json({ success: true, movement, new_stock: newStock });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/stock/adjust — set stock to an exact value (inventaire)
  app.post('/api/stock/adjust', requireAuth, async (req: Request, res: Response) => {
    try {
      const { product_id, warehouse_id, target_units, note } = req.body || {};
      const target = Number(target_units);

      if (!product_id || isNaN(target) || target < 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID', message: 'Cible invalide.' },
        });
      }

      const { data: product, error: fetchErr } = await supabase
        .from('products')
        .select('id, current_stock_units')
        .eq('id', product_id)
        .single();
      if (fetchErr || !product) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Produit introuvable.' },
        });
      }

      const oldStock = product.current_stock_units || 0;
      const delta = target - oldStock;

      const { error: updErr } = await supabase
        .from('products')
        .update({ current_stock_units: target })
        .eq('id', product_id);
      if (updErr) throw updErr;

      const { data: movement, error: movErr } = await supabase
        .from('stock_movements')
        .insert({
          company_id: req.user?.company_id,
          product_id,
          warehouse_id: warehouse_id || 'wh_main_01',
          movement_type: 'stock_adjustment',
          quantity_units: delta,
          user_name: req.user?.name || req.body?.user_name || 'Système',
          note: note || `Ajustement: ${oldStock} → ${target}`,
        })
        .select()
        .single();
      if (movErr) throw movErr;

      res.json({ success: true, movement, new_stock: target });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
   // Fetch the full ledger (sales + payments) for a customer
  app.get('/api/customers/:id/ledger', requireAuth, async (req: Request, res: Response) => {
    try {
      const customerId = req.params.id;
      const companyId = req.user?.company_id;

      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('id, name, credit_limit')
        .eq('id', customerId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (custErr || !customer) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Client introuvable.' },
        });
      }

      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('id, invoice_number, status, total_amount, paid_amount, remaining_amount, notes, created_at')
        .eq('customer_id', customerId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      if (salesErr) throw salesErr;

      const { data: payments, error: payErr } = await supabase
        .from('customer_payments')
        .select('id, payment_method, amount, notes, created_at')
        .eq('customer_id', customerId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      if (payErr) throw payErr;

      // Sales = DÉBIT (increases what customer owes)
      const saleEntries = (sales || []).map((s: any) => ({
        id: s.id,
        created_at: s.created_at,
        transaction_type: 'sale',
        reference_id: s.invoice_number,
        note: s.notes || `Vente ${s.invoice_number}`,
        debit: Number(s.remaining_amount) || 0,
        credit: 0,
        balance_after: 0,
      }));

      // Payments = CRÉDIT (decreases what customer owes)
      const paymentEntries = (payments || []).map((p: any) => ({
        id: p.id,
        created_at: p.created_at,
        transaction_type: 'payment',
        reference_id: null,
        note: p.notes || `Règlement (${p.payment_method})`,
        debit: 0,
        credit: Number(p.amount) || 0,
        balance_after: 0,
      }));

      const entries = [...saleEntries, ...paymentEntries].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Compute running balance after each transaction
      let running = 0;
      const withBalance = entries.map((e) => {
        running = running + e.debit - e.credit;
        return { ...e, balance_after: running };
      });

      const { data: bal } = await supabase
        .from('customer_balances')
        .select('balance')
        .eq('customer_id', customerId)
        .maybeSingle();

      res.json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          credit_limit: Number(customer.credit_limit) || 0,
          balance: Number(bal?.balance) || 0,
        },
        entries: withBalance,
        ledger: withBalance,
        totals: {
          sales_count: saleEntries.length,
          payments_count: paymentEntries.length,
          total_sales: saleEntries.reduce((sum, e) => sum + e.debit, 0),
          total_credit: saleEntries.reduce((sum, e) => sum + e.debit, 0),
          total_payments: paymentEntries.reduce((sum, e) => sum + e.credit, 0),
          running_balance: running,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  // 14. Global API 404 Fallback Handler
  app.use('/api/*', requireAuth, (req: Request, res: Response) => {
    res.status(404).json({ success: false, error: `API route ${req.originalUrl} not found` });
  });
}