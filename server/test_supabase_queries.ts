import { getSupabase } from './supabase.js';

export async function testAllReadQueries() {
  const client = getSupabase();
  console.log('--- Testing Read Queries on Supabase ---');

  // 1. Company & Warehouse
  const { data: comp } = await client.from('companies').select('*').limit(1);
  const { data: wh } = await client.from('warehouses').select('*').limit(1);
  const { data: users } = await client.from('users').select('*');
  console.log('1. Company:', comp?.[0]?.name, '| Warehouse:', wh?.[0]?.name, '| Users:', users?.length);

  // 2. Products Catalog with Live Stock
  const { data: products } = await client
    .from('products')
    .select(`
      *,
      categories(name),
      brands(name),
      stock(quantity_units, warehouse_id)
    `)
    .eq('active', true);

  console.log('2. Products with joined categories, brands & stock:', products?.length);
  products?.slice(0, 3).forEach((p: any) => {
    const units = p.stock?.[0]?.quantity_units ?? 0;
    console.log(`   - ${p.name}: ${units} units (Cat: ${p.categories?.name}, Brand: ${p.brands?.name})`);
  });

  // 3. Customers with Balances
  const { data: customers } = await client.from('customers').select('*').eq('active', true);
  const { data: balances } = await client.from('customer_balances').select('*');
  const balMap = new Map((balances || []).map((b: any) => [b.customer_id, Number(b.balance) || 0]));

  console.log('3. Customers with balances from view:');
  customers?.forEach((c: any) => {
    const bal = balMap.get(c.id) ?? 0;
    console.log(`   - ${c.name}: Balance ${bal.toLocaleString()} DZD (Credit Limit: ${c.credit_limit || 0} DZD)`);
  });

  // 4. Stock with Cartons View
  const { data: stockCartons } = await client.from('stock_with_cartons').select('*');
  console.log('4. stock_with_cartons view count:', stockCartons?.length);

  // 5. Sales & Line Items
  const { data: sales } = await client
    .from('sales')
    .select(`
      *,
      customers(name, phone),
      sale_items(*),
      sale_payments(*)
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('5. Recent sales count:', sales?.length);

  // 6. Stock Movements
  const { data: movements } = await client
    .from('stock_movements')
    .select('*, products(name, sku, barcode)')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('6. Recent stock movements count:', movements?.length);

  return true;
}

testAllReadQueries().catch((err) => {
  console.error('Query test failed:', err);
  process.exit(1);
});
