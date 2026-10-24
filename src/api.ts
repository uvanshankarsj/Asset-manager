const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "authToken";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

// Lets the app drop back to the login page when the server says the token is no longer valid
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

// Every request goes through here so it carries the login token
async function request(path: string, init: RequestInit = {}) {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(token && { Authorization: `Bearer ${token}` }), ...init.headers },
    });
  } catch {
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 401) onUnauthorized();
  if (!res.ok) {
    // The backend explains what went wrong in { message }
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? `Request failed (${res.status}).`);
  }
  return res;
}

export type AuthUser = { id: string; name: string; email: string; avatar: string | null };
type AuthResponse = { token: string; user: AuthUser };

async function authCall(path: string, body: object): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Request failed: ${res.status}`);
  return data;
}
export const login = (email: string, password: string) =>
  authCall("login", { email, password });
export const register = (name: string, email: string, password: string) =>
  authCall("register", { name, email, password });
export const fetchMe = async () => userFrom(await request("/api/auth/me"));

const jsonInit = (method: string, body?: object): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body && JSON.stringify(body),
});
const userFrom = async (res: Response) => (await res.json()).user as AuthUser;
// avatar is a small data URL (see resizeImage in Account.tsx)
export const updateAvatar = async (avatar: string) =>
  userFrom(await request("/api/auth/avatar", jsonInit("PUT", { avatar })));
export const removeAvatar = async () =>
  userFrom(await request("/api/auth/avatar", jsonInit("DELETE")));

export type CategoryTotal = { _id: string; totalSpent: number };
export type RecentActivity = {
  _id: string;
  type: "NEW_FD" | "SIP_STARTED" | "FD_CLOSED" | "SIP_PAID" | "ADDED";
  subject: string;
  amount?: number;
  date: string;
};

async function get<T>(path: string): Promise<T> {
  return (await request(path)).json();
}

export const fetchCategoryTotals = () => get<CategoryTotal[]>("/api/getamount");
export const fetchRecentActivity = () =>
  get<RecentActivity[]>("/api/activity/recent");

export type PendingAction = {
  _id: string;
  type: "FD_MATURITY" | "SIP_DUE";
  subject: string;
  amount: number;
  date: string;
};
export const fetchPendingActions = () =>
  get<PendingAction[]>("/api/pending-actions");

export type NewExpense = {
  category: string;
  subject: string;
  merchant?: string;
  symbol?: string;
  quantity?: string;
  pricePerShare?: string;
  date: string;
  amount: string;
  maturityDate?: string;
  nextSipDate?: string;
};

export async function createExpense(expense: NewExpense) {
  // The backend parses multipart/form-data (multer), so send FormData
  const body = new FormData();
  Object.entries(expense).forEach(([k, v]) => v && body.append(k, v));
  return (await request("/api/expenses", { method: "POST", body })).json();
}

async function send(path: string, method: string) {
  return (await request(path, { method })).json();
}

export const deleteMaturedFD = (id: string) =>
  send(`/api/expenses/${id}`, "DELETE");
export const markSipPaid = (id: string) =>
  send(`/api/expenses/${id}/sip-paid`, "POST");

export type Asset = {
  _id: string;
  name: string;
  price: number;
  purchaseDate: string;
};
export const fetchAssets = () => get<Asset[]>("/api/assets");

export async function createAsset(asset: {
  name: string;
  price: string;
  purchaseDate: string;
}) {
  const body = new FormData();
  Object.entries(asset).forEach(([k, v]) => body.append(k, v));
  return (await request("/api/assets", { method: "POST", body })).json();
}

export const updateAsset = (
  id: string,
  asset: { name: string; price: string; purchaseDate: string }
) => request(`/api/assets/${id}`, jsonInit("PUT", asset)).then((r) => r.json());

export const deleteAsset = (id: string) => send(`/api/assets/${id}`, "DELETE");

export type Investment = {
  _id: string;
  category: "FD" | "Mutual Funds" | "share";
  subject: string;
  merchant?: string;
  symbol?: string;
  quantity?: number;
  pricePerShare?: number;
  amount: number;
  date: string;
  maturityDate?: string;
  nextSipDate?: string;
};
export const fetchInvestments = () => get<Investment[]>("/api/investments");
export const fetchAllActivity = () =>
  get<RecentActivity[]>("/api/activity/all");
export type InvestmentEdit = {
  subject: string;
  date: string;
  amount?: string;
  symbol?: string;
  quantity?: string;
  pricePerShare?: string;
  maturityDate?: string;
  nextSipDate?: string;
};
export const updateInvestment = (id: string, edit: InvestmentEdit) =>
  request(`/api/investments/${id}`, jsonInit("PUT", edit)).then((r) => r.json());
export const deleteInvestment = (id: string) =>
  send(`/api/investments/${id}`, "DELETE");

export type ShareQuote = { price: number; currency: string };
// Live prices keyed by investment id; only shares that have a ticker appear
export const fetchSharePrices = () =>
  get<Record<string, ShareQuote>>("/api/investments/prices");

export type StockSuggestion = { symbol: string; name: string; exchange: string };
export const searchStocks = (q: string) =>
  get<StockSuggestion[]>(`/api/stocks/search?q=${encodeURIComponent(q)}`);
