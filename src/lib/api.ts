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

export interface EnvironmentRun {
  requestId: string;
  status: 'released' | 'failed';
  vmId: string | null;
  error: string | null;
  requestedAt: string;
  assignedAt: string | null;
  releasedAt: string | null;
  hostName: string | null;
  region: string | null;
  durationSeconds: number | null;
}

export interface UsageTimeseries {
  days: { date: string; starts: number; failures: number }[];
}

export interface AdminOverview {
  totalTeams: number; newTeams7d: number; activeSubscriptions: number;
  mrrChf: number;
  mrrByTier: { tier: PlanTier; label: string; count: number; chfEach: number; chfTotal: number }[];
  vmStarts7d: number; vmStartFailures7d: number; vmStartErrorRate7d: number | null;
  runningEnvironments: number; queuedEnvironments: number;
  cacheHitRate: number | null; dataPlaneConnected: boolean;
}

export interface AdminActivity {
  recentSignups: { id: string; name: string; planLabel: string; ownerEmail: string | null; ownerVerified: boolean; createdAt: string }[];
  recentFailures: { id: string; teamName: string; vmId: string | null; occurredAt: string }[];
}

export interface AdminTimeseries {
  days: { date: string; starts: number; failures: number; signups: number }[];
}

export interface AdminHost {
  id: string; name: string; location: string; status: 'online' | 'draining' | 'offline';
  lastHeartbeat: string | null;
  cpu: { total: number; used: number };
  ramMb: { total: number; used: number };
}

export type PlanTier = 'free' | 'solo' | 'team' | 'scale';

export interface AdminTeam {
  id: string; name: string; planTier: PlanTier; planLabel: string;
  // Manual entitlement override (comp/grant), independent of billing. null = none.
  planOverride: PlanTier | null; planOverrideLabel: string | null;
  mrrChf: number;
  subscriptionStatus: string | null; currentPeriodEnd: string | null;
  ownerEmail: string | null;
  members: number; vmStarts30d: number; createdAt: string; ownerVerified: boolean;
}

export interface AdminUser {
  id: string; email: string; verified: boolean; isPlatformAdmin: boolean; createdAt: string;
  teams: { teamId: string; teamName: string; role: string }[];
}

/* ---------- Status page / incidents ---------- */

export type StatusLevel = 'operational' | 'maintenance' | 'degraded' | 'partial_outage' | 'major_outage';
export type PostType = 'incident' | 'maintenance' | 'announcement';

// Single source of truth for how each status level looks/reads, shared by the
// status page, the dashboard panel, and the footer badge. Lives here (a leaf
// module both Shared and Status import) to avoid a circular import between them.
export const LEVEL_META: Record<StatusLevel, { color: string; label: string }> = {
  operational: { color: '#23A26D', label: 'Operational' },
  maintenance: { color: '#D99000', label: 'Maintenance' },
  degraded: { color: '#D99000', label: 'Degraded' },
  partial_outage: { color: '#E63312', label: 'Partial outage' },
  major_outage: { color: '#E63312', label: 'Major outage' },
};

export interface StatusPostUpdate {
  id: string; state: string | null; body: string; createdAt: string;
}

export interface StatusPost {
  id: string; type: PostType; title: string; body: string; impact: string; state: string;
  affectedComponents: string[]; scheduledStart: string | null; scheduledEnd: string | null;
  createdAt: string; updatedAt: string; resolvedAt: string | null;
  updates: StatusPostUpdate[];
}

export interface DayStatus { date: string; status: StatusLevel }
export interface StatusComponent {
  key: string; name: string; status: StatusLevel;
  // Present only when the summary was fetched with historyDays>0.
  uptime?: number; history?: DayStatus[];
  // Present on group nodes: the member components.
  children?: StatusComponent[];
}

export interface StatusSummary {
  overall: { status: StatusLevel; label: string };
  components: StatusComponent[];
  active: StatusPost[];
  upcoming: StatusPost[];
  recent: StatusPost[];
  window?: { start: string; end: string };
}

export interface AdminStatusComponent {
  id: string; key: string; name: string; source: 'api' | 'compute' | 'manual';
  manualStatus: StatusLevel | null; position: number; groupName: string | null;
}
