/** Thin fetch wrapper for the devplat control-plane API. */

export const API_URL: string =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : 'https://api.devplat.ch');

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, detail?: string) {
    super(detail ?? code);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    credentials: 'include', // session lives in an httpOnly cookie
    headers: options.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'request_failed', (data as { detail?: string }).detail);
  }
  return data as T;
}

/* ---------- API response types ---------- */

export interface Me {
  user: { id: string; email: string; emailVerified: boolean; isPlatformAdmin: boolean };
  team: { id: string; name: string; role: 'owner' | 'admin' | 'developer'; planTier: string; trialEndsAt: string } | null;
}

export interface TeamInfo {
  team: {
    id: string; name: string; planTier: string; planLabel: string; parallelLimit: number;
    trialEndsAt: string; createdAt: string; myRole: 'owner' | 'admin' | 'developer';
  };
  members: { userId: string; email: string; role: string; joinedAt: string }[];
  pendingInvites: { id: string; email: string; role: string; expiresAt: string }[];
}

export interface ApiTokenInfo {
  id: string; label: string; prefix: string; scope: string;
  createdAt: string; lastUsedAt: string | null;
}

export interface CreatedToken extends ApiTokenInfo { token: string }

export interface SubscriptionInfo {
  planTier: string; planLabel: string; parallelEnvironments: number; chfMonthly: number;
  vcpuPerEnvironment: number; ramGbPerEnvironment: number; maxFootprintGb: number;
  trialEndsAt: string | null;
  subscription: { status: string; currentPeriodEnd: string | null; priceId: string | null } | null;
  hasStripeCustomer: boolean;
}

export interface InvoiceInfo {
  id: string; number: string | null; created: string; amount: number;
  currency: string; status: string | null; pdfUrl: string | null;
}

export interface EnvironmentInfo {
  requestId: string;
  status: 'queued' | 'assigned' | 'released' | 'failed';
  vmId: string | null;
  dockerEndpoint: string | null;
  requestedAt: string;
}

export interface AdminOverview {
  totalTeams: number; activeSubscriptions: number; mrrChf: number;
  vmStarts7d: number; vmStartFailures7d: number; vmStartErrorRate7d: number | null;
  cacheHitRate: number | null; dataPlaneConnected: boolean;
}

export interface AdminHost {
  id: string; name: string; location: string; status: 'online' | 'draining' | 'offline';
  lastHeartbeat: string | null;
  cpu: { total: number; used: number };
  ramMb: { total: number; used: number };
}

export interface AdminTeam {
  id: string; name: string; planTier: string; planLabel: string; mrrChf: number;
  subscriptionStatus: string | null; currentPeriodEnd: string | null;
  members: number; vmStarts30d: number; createdAt: string;
}
