import { getSupabase, isSupabaseConfigured } from './supabase.js';

export interface MigrationSummary {
  success: boolean;
  company: { id: string; name: string };
  warehouse: { id: string; name: string };
  counts: {
    categories: number;
    brands: number;
    products: number;
    stockRecords: number;
    totalStockUnits: number;
    users: number;
    customers: number;
    customerDiscounts: number;
    openingDebtTotalDZD: number;
  };
  details: string[];
}

export const PRODUCT_ID_MAP: Record<string, string> = {
  'a4531a23-c60d-4555-bc55-4564a7f6dba7': 'a4531a23-c60d-4555-bc55-4564a7f6dba7',
  'prd_sorali_keratin_1000': 'b1000000-0000-0000-0000-000000000001',
  'prd_sorali_amino_500': 'b1000000-0000-0000-0000-000000000002',
  'prd_vatika_oil_almond_200': 'b1000000-0000-0000-0000-000000000003',
  'prd_dabur_amla_300': 'b1000000-0000-0000-0000-000000000004',
  'prd_garnier_micellar_400': 'b1000000-0000-0000-0000-000000000005',
  'prd_loreal_elvive_400': 'b1000000-0000-0000-0000-000000000006',
  'prd_nivea_soft_200': 'b1000000-0000-0000-0000-000000000007',
};

export const CUSTOMER_ID_MAP: Record<string, string> = {
  'cust_pharma_centrale': 'c1000000-0000-0000-0000-000000000001',
  'cust_etoile_or': 'c1000000-0000-0000-0000-000000000002',
  'cust_salon_rym': 'c1000000-0000-0000-0000-000000000003',
  'cust_el_bahia': 'c1000000-0000-0000-0000-000000000004',
  'cust_walk_in': 'c1000000-0000-0000-0000-000000000005',
};

export async function runControlledSeedMigration(): Promise<MigrationSummary> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Cannot perform seed migration.');
  }

  const client = getSupabase();
  const logs: string[] = [];

  // 1. Resolve Company
  const { data: companies, error: compErr } = await client
    .from('companies')
    .select('*')
    .eq('code', 'SORALI')
    .limit(1);

  if (compErr || !companies || companies.length === 0) {
    throw new Error(`Failed to find company SORALI: ${compErr?.message}`);
  }
  const company = companies[0];
  logs.push(`Verified company: ${company.name} (${company.id})`);

  // 2. Resolve Warehouse
  const { data: warehouses, error: whErr } = await client
    .from('warehouses')
    .select('*')
    .eq('company_id', company.id)
    .limit(1);

  if (whErr || !warehouses || warehouses.length === 0) {
    throw new Error(`Failed to find warehouse for company: ${whErr?.message}`);
  }
  const warehouse = warehouses[0];
  logs.push(`Verified warehouse: ${warehouse.name} (${warehouse.id})`);

  // 3. Migrate Categories
  const categoriesToSeed = [
    { name: 'Soins Capillaires' },
    { name: 'Lissage & Protéine Pro' },
    { name: 'Soins Visage & Corps' },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesToSeed) {
    const { data: existing } = await client
      .from('categories')
      .select('id, name')
      .eq('company_id', company.id)
      .eq('name', cat.name)
      .limit(1);

    if (existing && existing.length > 0) {
      categoryMap.set(cat.name, existing[0].id);
    } else {
      const { data: created, error } = await client
        .from('categories')
        .insert({ company_id: company.id, name: cat.name, active: true })
        .select();
      if (error) throw new Error(`Category insert error (${cat.name}): ${error.message}`);
      categoryMap.set(cat.name, created[0].id);
    }
  }
  logs.push(`Synchronized ${categoryMap.size} categories`);

  // 4. Migrate Brands
  const brandsToSeed = [
    { name: 'Dabur Vatika' },
    { name: 'Sorali Professional' },
    { name: 'Dabur' },
    { name: 'Garnier' },
    { name: "L'Oréal Paris" },
    { name: 'Nivea' },
  ];

  const brandMap = new Map<string, string>();
  for (const brd of brandsToSeed) {
    const { data: existing } = await client
      .from('brands')
      .select('id, name')
      .eq('company_id', company.id)
      .eq('name', brd.name)
      .limit(1);

    if (existing && existing.length > 0) {
      brandMap.set(brd.name, existing[0].id);
    } else {
      const { data: created, error } = await client
        .from('brands')
        .insert({ company_id: company.id, name: brd.name, active: true })
        .select();
      if (error) throw new Error(`Brand insert error (${brd.name}): ${error.message}`);
      brandMap.set(brd.name, created[0].id);
    }
  }
  logs.push(`Synchronized ${brandMap.size} brands`);

  // 5. Migrate Users
  const usersToSeed = [
    { username: 'adeladmin', full_name: 'Adel Harnane', role: 'admin', telegram_id: '715602687683' },
    { username: 'sofiane', full_name: 'Sofiane K.', role: 'manager', telegram_id: '1046422786' },
    { username: 'yasmine', full_name: 'Yasmine M.', role: 'cashier', telegram_id: '1046422787' },
    { username: 'karim', full_name: 'Karim B.', role: 'warehouse', telegram_id: '1046422788' },
    { username: 'audit', full_name: 'Audit Inspector', role: 'viewer', telegram_id: '1046422789' },
  ];

  for (const usr of usersToSeed) {
    const { data: existing } = await client
      .from('users')
      .select('id')
      .eq('company_id', company.id)
      .eq('username', usr.username)
      .limit(1);

    if (!existing || existing.length === 0) {
      const { error } = await client.from('users').insert({
        company_id: company.id,
        username: usr.username,
        full_name: usr.full_name,
        role: usr.role,
        telegram_id: usr.telegram_id,
        active: true,
      });
      if (error) throw new Error(`User insert error (${usr.username}): ${error.message}`);
    }
  }
  logs.push(`Synchronized users table`);

  // 6. Migrate Products (8 core products)
  const productsToSeed = [
    {
      id: PRODUCT_ID_MAP['a4531a23-c60d-4555-bc55-4564a7f6dba7'],
      category: 'Soins Capillaires',
      brand: 'Dabur Vatika',
      barcode: '6291100511234',
      sku: 'VAT-BLK-180',
      name: 'Vatika Shampoo Black Seed 180ml',
      variant: '180ml Habba Sawda',
      units_per_carton: 24,
      purchase_price: 320,
      selling_price: 450,
      minimum_stock_units: 48,
      stock_units: 380,
    },
    {
      id: PRODUCT_ID_MAP['prd_sorali_keratin_1000'],
      category: 'Lissage & Protéine Pro',
      brand: 'Sorali Professional',
      barcode: '7898563210012',
      sku: 'SOR-KER-1000',
      name: 'Sorali Keratin Treatment Therapy 1000ml',
      variant: '1000ml Salon Size',
      units_per_carton: 12,
      purchase_price: 5200,
      selling_price: 7500,
      minimum_stock_units: 24,
      stock_units: 84,
    },
    {
      id: PRODUCT_ID_MAP['prd_sorali_amino_500'],
      category: 'Lissage & Protéine Pro',
      brand: 'Sorali Professional',
      barcode: '7898563210029',
      sku: 'SOR-AMN-500',
      name: 'Sorali Amino Plex Restorer 500ml',
      variant: '500ml Post-Chemical',
      units_per_carton: 12,
      purchase_price: 3100,
      selling_price: 4400,
      minimum_stock_units: 24,
      stock_units: 60,
    },
    {
      id: PRODUCT_ID_MAP['prd_vatika_oil_almond_200'],
      category: 'Soins Capillaires',
      brand: 'Dabur Vatika',
      barcode: '6291100511241',
      sku: 'VAT-ALM-200',
      name: 'Vatika Hair Oil Enriched Almond 200ml',
      variant: '200ml Huile Amande',
      units_per_carton: 36,
      purchase_price: 210,
      selling_price: 310,
      minimum_stock_units: 72,
      stock_units: 216,
    },
    {
      id: PRODUCT_ID_MAP['prd_dabur_amla_300'],
      category: 'Soins Capillaires',
      brand: 'Dabur',
      barcode: '6291100511258',
      sku: 'DAB-AML-300',
      name: 'Dabur Amla Hair Oil 300ml Original',
      variant: '300ml Flacon',
      units_per_carton: 24,
      purchase_price: 280,
      selling_price: 410,
      minimum_stock_units: 48,
      stock_units: 120,
    },
    {
      id: PRODUCT_ID_MAP['prd_garnier_micellar_400'],
      category: 'Soins Visage & Corps',
      brand: 'Garnier',
      barcode: '3600541358498',
      sku: 'GAR-MIC-400',
      name: 'Garnier SkinActive Eau Micellaire 400ml',
      variant: '400ml Peaux Sensibles',
      units_per_carton: 18,
      purchase_price: 540,
      selling_price: 780,
      minimum_stock_units: 36,
      stock_units: 90,
    },
    {
      id: PRODUCT_ID_MAP['prd_loreal_elvive_400'],
      category: 'Soins Capillaires',
      brand: "L'Oréal Paris",
      barcode: '3600523315235',
      sku: 'LOR-ELV-400',
      name: "L'Oréal Elvive Huile Extraordinaire 400ml",
      variant: '400ml Shampoing',
      units_per_carton: 20,
      purchase_price: 480,
      selling_price: 690,
      minimum_stock_units: 40,
      stock_units: 100,
    },
    {
      id: PRODUCT_ID_MAP['prd_nivea_soft_200'],
      category: 'Soins Visage & Corps',
      brand: 'Nivea',
      barcode: '4005808890583',
      sku: 'NIV-SFT-200',
      name: 'Nivea Soft Crème Hydratante 200ml Pot',
      variant: '200ml Pot Blanc',
      units_per_carton: 24,
      purchase_price: 350,
      selling_price: 520,
      minimum_stock_units: 48,
      stock_units: 144,
    },
  ];

  for (const prd of productsToSeed) {
    const categoryId = categoryMap.get(prd.category);
    const brandId = brandMap.get(prd.brand);

    const { data: existing } = await client
      .from('products')
      .select('id')
      .eq('id', prd.id)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing record
      await client
        .from('products')
        .update({
          category_id: categoryId,
          brand_id: brandId,
          barcode: prd.barcode,
          sku: prd.sku,
          name: prd.name,
          variant: prd.variant,
          units_per_carton: prd.units_per_carton,
          purchase_price: prd.purchase_price,
          selling_price: prd.selling_price,
          minimum_stock_units: prd.minimum_stock_units,
          active: true,
        })
        .eq('id', prd.id);
    } else {
      const { error } = await client.from('products').insert({
        id: prd.id,
        company_id: company.id,
        category_id: categoryId,
        brand_id: brandId,
        barcode: prd.barcode,
        sku: prd.sku,
        name: prd.name,
        variant: prd.variant,
        units_per_carton: prd.units_per_carton,
        purchase_price: prd.purchase_price,
        selling_price: prd.selling_price,
        minimum_stock_units: prd.minimum_stock_units,
        active: true,
      });
      if (error) throw new Error(`Product insert error (${prd.name}): ${error.message}`);
    }

    // Ensure stock record exists
    const { data: stockRow } = await client
      .from('stock')
      .select('id, quantity_units')
      .eq('company_id', company.id)
      .eq('warehouse_id', warehouse.id)
      .eq('product_id', prd.id)
      .limit(1);

    if (!stockRow || stockRow.length === 0) {
      const { error: stkErr } = await client.from('stock').insert({
        company_id: company.id,
        warehouse_id: warehouse.id,
        product_id: prd.id,
        quantity_units: prd.stock_units,
      });
      if (stkErr) throw new Error(`Stock insert error (${prd.name}): ${stkErr.message}`);
    }
  }
  logs.push(`Synchronized ${productsToSeed.length} core products and stock levels`);

  // 7. Migrate Customers
  const customersToSeed = [
    {
      id: CUSTOMER_ID_MAP['cust_pharma_centrale'],
      name: 'Pharmacie Centrale Alger',
      phone: '0550 12 34 56',
      address: 'Rue Didouche Mourad, Alger-Centre',
      default_discount_percent: 5.0,
      credit_limit: 150000,
    },
    {
      id: CUSTOMER_ID_MAP['cust_etoile_or'],
      name: "Parfumerie Etoile d'Or",
      phone: '0661 98 76 54',
      address: 'Boulevard Mohamed V, Blida',
      default_discount_percent: 8.0,
      credit_limit: 250000,
    },
    {
      id: CUSTOMER_ID_MAP['cust_salon_rym'],
      name: 'Salon de Coiffure & Beauté Rym',
      phone: '0770 44 55 66',
      address: 'Val d’Hydra, Alger',
      default_discount_percent: 3.0,
      credit_limit: 50000,
    },
    {
      id: CUSTOMER_ID_MAP['cust_el_bahia'],
      name: 'Grossiste Cosmétiques El Bahia',
      phone: '0555 77 88 99',
      address: 'Zone Industrielle Es Senia, Oran',
      default_discount_percent: 6.0,
      credit_limit: 500000,
    },
    {
      id: CUSTOMER_ID_MAP['cust_walk_in'],
      name: 'Client Comptoir (Passage)',
      phone: '0000 00 00 00',
      address: 'Comptoir Sorali',
      default_discount_percent: 0.0,
      credit_limit: 0,
    },
  ];

  for (const cust of customersToSeed) {
    const { data: existing } = await client
      .from('customers')
      .select('id')
      .eq('id', cust.id)
      .limit(1);

    if (existing && existing.length > 0) {
      await client
        .from('customers')
        .update({
          name: cust.name,
          phone: cust.phone,
          address: cust.address,
          default_discount_percent: cust.default_discount_percent,
          credit_limit: cust.credit_limit,
          active: true,
        })
        .eq('id', cust.id);
    } else {
      const { error } = await client.from('customers').insert({
        id: cust.id,
        company_id: company.id,
        name: cust.name,
        phone: cust.phone,
        address: cust.address,
        default_discount_percent: cust.default_discount_percent,
        credit_limit: cust.credit_limit,
        active: true,
      });
      if (error) throw new Error(`Customer insert error (${cust.name}): ${error.message}`);
    }
  }
  logs.push(`Synchronized ${customersToSeed.length} customers`);

  // 8. Customer Discounts
  const discountsToSeed = [
    {
      customer_id: CUSTOMER_ID_MAP['cust_pharma_centrale'],
      product_id: PRODUCT_ID_MAP['a4531a23-c60d-4555-bc55-4564a7f6dba7'],
      discount_percent: 10.0,
    },
    {
      customer_id: CUSTOMER_ID_MAP['cust_etoile_or'],
      product_id: PRODUCT_ID_MAP['prd_sorali_keratin_1000'],
      discount_percent: 12.0,
    },
  ];

  for (const disc of discountsToSeed) {
    const { data: existing } = await client
      .from('customer_discounts')
      .select('id')
      .eq('company_id', company.id)
      .eq('customer_id', disc.customer_id)
      .eq('product_id', disc.product_id)
      .limit(1);

    if (!existing || existing.length === 0) {
      const { error } = await client.from('customer_discounts').insert({
        company_id: company.id,
        customer_id: disc.customer_id,
        product_id: disc.product_id,
        discount_percent: disc.discount_percent,
      });
      if (error) throw new Error(`Customer discount insert error: ${error.message}`);
    }
  }
  logs.push(`Synchronized product-specific customer discounts`);

  // 9. Synchronize Opening Customer Debt (250,000 DZD)
  // Pharmacie Centrale: 45,000 DZD
  // Parfumerie Etoile d'Or: 120,000 DZD
  // Grossiste Cosmétiques El Bahia: 85,000 DZD
  const openingDebts = [
    {
      customer_id: CUSTOMER_ID_MAP['cust_pharma_centrale'],
      invoice_number: 'OPENING-BAL-PHARMA',
      amount: 45000,
      note: 'Dette ouverture exercice 2026 - Pharmacie Centrale Alger',
    },
    {
      customer_id: CUSTOMER_ID_MAP['cust_etoile_or'],
      invoice_number: 'OPENING-BAL-ETOILE',
      amount: 120000,
      note: "Dette ouverture exercice 2026 - Parfumerie Etoile d'Or",
    },
    {
      customer_id: CUSTOMER_ID_MAP['cust_el_bahia'],
      invoice_number: 'OPENING-BAL-BAHIA',
      amount: 85000,
      note: 'Dette ouverture exercice 2026 - Grossiste Cosmétiques El Bahia',
    },
  ];

  let openingDebtTotal = 0;
  for (const od of openingDebts) {
    openingDebtTotal += od.amount;
    const { data: existing } = await client
      .from('sales')
      .select('id')
      .eq('company_id', company.id)
      .eq('invoice_number', od.invoice_number)
      .limit(1);

    if (!existing || existing.length === 0) {
      const { error: saleErr } = await client.from('sales').insert({
        company_id: company.id,
        warehouse_id: warehouse.id,
        customer_id: od.customer_id,
        invoice_number: od.invoice_number,
        status: 'completed',
        subtotal: od.amount,
        discount_amount: 0,
        total_amount: od.amount,
        paid_amount: 0,
        remaining_amount: od.amount,
        notes: od.note,
      });
      if (saleErr) throw new Error(`Opening balance record error: ${saleErr.message}`);
    }
  }
  logs.push(`Synchronized opening customer debt records: Total ${openingDebtTotal.toLocaleString()} DZD`);

  // 10. Perform Comprehensive Verification Queries
  const { count: catCount } = await client.from('categories').select('*', { count: 'exact', head: true });
  const { count: brdCount } = await client.from('brands').select('*', { count: 'exact', head: true });
  const { count: prdCount } = await client.from('products').select('*', { count: 'exact', head: true });
  const { data: stockList, count: stkCount } = await client.from('stock').select('quantity_units');
  const { count: usrCount } = await client.from('users').select('*', { count: 'exact', head: true });
  const { count: custCount } = await client.from('customers').select('*', { count: 'exact', head: true });
  const { count: discCount } = await client.from('customer_discounts').select('*', { count: 'exact', head: true });

  const totalStockUnits = (stockList || []).reduce((sum, s) => sum + (s.quantity_units || 0), 0);

  return {
    success: true,
    company: { id: company.id, name: company.name },
    warehouse: { id: warehouse.id, name: warehouse.name },
    counts: {
      categories: catCount || 0,
      brands: brdCount || 0,
      products: prdCount || 0,
      stockRecords: stkCount || 0,
      totalStockUnits,
      users: usrCount || 0,
      customers: custCount || 0,
      customerDiscounts: discCount || 0,
      openingDebtTotalDZD: openingDebtTotal,
    },
    details: logs,
  };
}
