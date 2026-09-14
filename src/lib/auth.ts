// src/lib/auth.ts

const TOKEN_KEY = 'solari_token';
const USER_KEY = 'solari_user';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const getStoredUser = (): any => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};

export const setSession = (token: string, user: any) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// ------------------------------------------------------------------
// Global fetch interceptor.
// Runs once when this module is first imported.
// From that moment on, every fetch() call in the app automatically
// sends "Authorization: Bearer <token>" — so you don't need to edit
// any existing fetch calls in App.tsx, PosView.tsx, etc.
// ------------------------------------------------------------------
const originalFetch = window.fetch.bind(window);
window.fetch = (input: any, init: any = {}) => {
  const token = getToken();
  if (token) {
    init.headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
  }
  return originalFetch(input, init);
};