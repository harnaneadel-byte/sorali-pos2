// Add Telegram WebApp global window interface
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

const API_BASE_URL = '/api';

/**
 * Utility helper to perform authenticated API requests using Telegram Mini App initData
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const initData = window.Telegram?.WebApp?.initData || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (initData) {
    headers['Authorization'] = `Bearer ${initData}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || `API Error (${response.status})`);
  }

  return data as T;
}

// --- API CLIENT METHODS ---

export interface CheckoutPayload {
  warehouse_id: string;
  customer_id?: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  client_request_id?: string;
  items: Array<{
    product_id: string;
    quantity_units: number;
    units_per_carton: number;
    unit_price: number;
    purchase_price: number;
    discount_percent?: number;
    discount_amount?: number;
    total_amount: number;
  }>;
}

export const api = {
  // Health
  checkHealth: () => apiRequest<{ status: string; runtimeAuthority: string }>('/health'),

  // Products
  getProducts: () => apiRequest<any[]>('/products'),
  createProduct: (productData: any) =>
    apiRequest<any>('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    }),

  // Customers
  getCustomers: () => apiRequest<any[]>('/customers'),
  createCustomer: (customerData: any) =>
    apiRequest<any>('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    }),

  // Checkout / Sales
  checkout: (payload: CheckoutPayload) =>
    apiRequest<{ success: boolean; sale_id: string; invoice_number: string }>('/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSales: () => apiRequest<any[]>('/sales'),

  // Stock
  getStock: () => apiRequest<any[]>('/stock'),
};