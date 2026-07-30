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
  const raw = await res.text().catch(() => '');
  let data: unknown = {};
  let parsed = raw.trim() === '';
  if (!parsed) {
    try {
      data = JSON.parse(raw);
      parsed = true;
    } catch {
      parsed = false;
    }
  }

  if (!res.ok) {
    const body = data as { error?: string; detail?: string };
    throw new ApiError(res.status, body.error ?? 'request_failed', body.detail);
  }

  // A 2xx whose body isn't JSON is a failure, not a success with no fields.
  //
  // This used to swallow the parse error and hand the caller `{}` typed as
  // whatever T claimed. Callers then dereferenced fields that weren't there —
  // `usage.days.reduce(...)` on the dashboard threw "can't access property
  // reduce, days is undefined" and took the whole route down with it. The
  // response wasn't valid; pretending otherwise moved the failure somewhere
  // that couldn't explain itself.
  //
  // It happens for real: a proxy or CDN error page served with 200, an SPA
  // fallback answering an API path with index.html, or a connection that dies
  // mid-body. Throwing here means the caller's existing error handling runs
  // instead of a render crash.
  if (!parsed) {
    throw new ApiError(res.status, 'invalid_response',
      'The server returned a response that was not valid JSON. This usually means a proxy or error page answered instead of the API.');
  }
  return data as T;
}

/* ---------- API response types ---------- */

export interface Me {
  user: { id: string; email: string; emailVerified: boolean; isPlatformAdmin: boolean };
  team: { id: string; name: string; role: 'owner' | 'admin' | 'developer'; planTier: string; trialEndsAt: string } | null;
}

export interface TeamSummary {
  id: string; name: string; role: string; planTier: string; planLabel: string;
  members: number; joinedAt: string; active: boolean;
}

export interface TeamList {
  teams: TeamSummary[];
  /** The free trial is once per person, not per team. */
  trialAvailable: boolean;
  ownedTeams: number;
  maxOwnedTeams: number;
  /** Answered by the backend rather than re-derived here, so the button and the
   *  endpoint can't drift apart. Running more than one team is a paid feature;
   *  joining teams you're invited to always works. */
  canCreateTeam: boolean;
  createBlockedReason: 'paid_plan_required' | 'team_limit_reached' | null;
}

export interface AdminSystemHealth {
  host: {
    cpuPercent: number; cpuCores: number;
    loadAverage: { one: number; five: number; fifteen: number };
    memory: { totalBytes: number; usedBytes: number; percent: number; source: string };
    disk: { totalBytes: number; usedBytes: number; percent: number } | null;
    uptimeSeconds: number; processUptimeSeconds: number;
  };
  database: {
    sizePretty: string; sizeBytes: number;
    connections: { total: number; active: number; idleInTransaction: number; waitingOnLocks: number; max: number };
    cacheHitRatio: number | null;
    commits: number; rollbacks: number; deadlocks: number;
    slowestQueries: { query: string; calls: number; meanMs: number; totalMs: number }[] | null;
  };
}

export interface TwoFactorStatus {
  enabled: boolean; enabledAt: string | null; recoveryCodesRemaining: number;
}

export interface TwoFactorSetup { secret: string; otpauthUri: string }

export interface TeamInfo {
  team: {
    id: string; name: string; planTier: string; planLabel: string; parallelLimit: number;
    trialEndsAt: string; createdAt: string; myRole: 'owner' | 'admin' | 'developer';
    /** Seat cap for the plan; null means uncapped. */
    maxMembers: number | null;
    /** Members plus outstanding invites — invites count, so a batch of them
     *  can't quietly take a team over its plan once they're all accepted. */
    seatsUsed: number;
    /** Environment lifetime currently in force, in minutes. */
    ttlMinutes: number;
    /** What this plan gives by default, and how far it may be raised. Equal
     *  values mean the tier's lifetime is fixed. */
    ttlDefaultMinutes: number;
    ttlMaxMinutes: number;
    /** Whether this tier may read its audit log. Activity is recorded on every
     *  plan; only reading it is an entitlement. */
    auditLog: boolean;
  };
  members: { userId: string; email: string; role: string; joinedAt: string }[];
  pendingInvites: { id: string; email: string; role: string; expiresAt: string }[];
}

/** How often this team's runs waited because their own parallelism cap was
 *  full. Distinct from the usage chart, which counts starts and can't tell a
 *  run that began instantly from one that waited ten minutes. */
export interface CapacityPressure {
  windowDays: number;
  totalRuns: number;
  blockedRuns: number;
  /** Waits that ended in an assignment — the only ones with a known duration. */
  resolvedWaits: number;
  waitSecondsTotal: number;
  waitSecondsWorst: number;
  /** Runs queued for a slot right now. Live, not part of the window. */
  waitingNow: number;
  limit: number;
  planTier: string;
  upgrade: { tier: string; label: string; parallelEnvs: number; chfMonthly: number } | null;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  enabled: boolean;
  disabledReason: string | null;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
  /** Last few characters only — enough to tell endpoints apart. */
  secretHint: string;
}

/** Creation and rotation return the signing secret exactly once. */
export interface WebhookEndpointWithSecret extends WebhookEndpoint {
  secret: string;
}

export interface WebhookEndpointList {
  endpoints: WebhookEndpoint[];
  availableEvents: string[];
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  url: string;
  eventType: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
  createdAt: string;
  deliveredAt: string | null;
  nextAttemptAt: string;
}

export interface TeamSecurity {
  requireTwoFactor: boolean;
  members: { email: string; twoFactorEnabled: boolean }[];
  withoutTwoFactor: number;
}

export interface AuditPage {
  entries: AuditEntry[]; total: number; limit: number; offset: number;
}

export interface SessionInfo {
  id: string; createdAt: string; lastSeenAt: string;
  userAgent: string | null; ip: string | null; current: boolean;
}

export interface ApiTokenInfo {
  id: string; label: string; prefix: string; scope: string;
  createdAt: string; lastUsedAt: string | null;
  /** null = never expires. */
  expiresAt?: string | null;
  /** CIDR ranges the token may be used from; empty = anywhere. */
  ipAllowlist?: string[];
  // Last CLI version seen authenticating with this token (null until a
  // versioned CLI has used it), for the "update available" hint.
  lastCliVersion?: string | null;
  // 14 daily run counts (oldest→newest) for the usage sparkline, and their sum.
  usage?: number[]; runsTotal?: number;
  /** Email of whoever minted it; null for tokens predating creator tracking. */
  createdBy?: string | null;
  createdByMe?: boolean;
  /** Decided by the backend, so the button and the endpoint agree. Absent
   *  (older backend) is treated as allowed, which is the previous behaviour. */
  canRevoke?: boolean;
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

export interface EnvironmentDetail {
  requestId: string; status: string; vmId: string | null; dockerEndpoint: string | null;
  hostName: string | null; region: string | null; vcpu: number | null; ramMb: number | null;
  requestedAt: string; assignedAt: string | null; expiresAt: string | null; ttlMinutes: number;
  usage: { running: number; limit: number };
}

export interface ContainerInfo {
  id: string; name: string; image: string; state: string; status: string;
  ports: { publicPort: number; privatePort: number }[];
}
export interface EnvironmentContainers { reachable: boolean; containers: ContainerInfo[] }

export interface AdminOverview {
  totalTeams: number; newTeams7d: number; activeSubscriptions: number;
  mrrChf: number;
  mrrByTier: { tier: PlanTier; label: string; count: number; chfEach: number; chfTotal: number }[];
  vmStarts7d: number; vmStartFailures7d: number; vmStartErrorRate7d: number | null;
  runningEnvironments: number; queuedEnvironments: number;
  cacheHitRate: number | null; cacheReportingHosts: number; cacheLookups: number;
  dataPlaneConnected: boolean;
}

export interface AdminActivity {
  recentSignups: { id: string; name: string; planLabel: string; ownerEmail: string | null; ownerVerified: boolean; createdAt: string }[];
  recentFailures: { id: string; teamName: string; error: string | null; hostName: string | null; attempts: number; occurredAt: string }[];
}

export interface AdminTeamDetail {
  team: {
    id: string; name: string; planTier: PlanTier; planLabel: string;
    planOverride: PlanTier | null; planOverrideLabel: string | null;
    trialEndsAt: string; createdAt: string; subscriptionStatus: string | null; currentPeriodEnd: string | null;
  };
  members: { email: string; role: string; verified: boolean; joinedAt: string }[];
  tokens: { label: string; prefix: string; scope: string; lastUsedAt: string | null; revoked: boolean }[];
  runs: { id: string; status: string; vmId: string | null; error: string | null; requestedAt: string; hostName: string | null }[];
  audit: AuditEntry[];
}

export interface AdminTimeseries {
  days: { date: string; starts: number; failures: number; signups: number }[];
}

/**
 * What the hardware is actually doing, as opposed to the sum of what plans
 * promised (`cpu.used` / `ramMb.used`, which is what the scheduler admits
 * against). The gap between the two is the headroom an overcommit factor would
 * spend, so the UI keeps them side by side rather than merging them into one
 * "utilisation" number.
 *
 * `null` on a host means it has never reported — an older agent. `stale: true`
 * means it reported once and has since gone quiet, which the dashboard says
 * differently because it means something different.
 */
export interface AdminHostUsage {
  ramCommittedMb: number | null;
  ramGrantedMb: number | null;
  ramGuestUsedMb: number | null;
  ramHostAvailableMb: number | null;
  /** Held back by the balloons right now — the saving, made explicit. */
  ramReclaimedMb: number | null;
  cpuBusyPct: number | null;
  cpuUsedActual: number | null;
  /** Guests that hit their cpu.max quota — builds slowed by our cap. */
  cpuThrottledVms: number | null;
  measuredAt: string | null;
  stale: boolean;
}

/** The host's overcommit setting and what it has cost. Separate from usage
 *  because it arrives on different terms: a usage sample waits for every guest
 *  to report, while a starved grant is a broken promise and is most worth
 *  seeing on exactly the hosts whose guests have gone quiet. Null means the
 *  host has never reported a ratio — which is not the same as reporting 100. */
export interface AdminHostOvercommit {
  pct: number;
  starvedGrants: number | null;
  starvedAt: string | null;
}

export interface AdminHost {
  id: string; name: string; location: string; status: 'online' | 'draining' | 'offline';
  drain: boolean; vms: number;
  lastHeartbeat: string | null;
  cpu: { total: number; used: number };
  ramMb: { total: number; used: number };
  usage: AdminHostUsage | null;
  overcommit: AdminHostOvercommit | null;
}

export interface AdminHostDetail {
  host: {
    id: string; name: string; location: string; status: 'online' | 'draining' | 'offline';
    drain: boolean; lastHeartbeat: string | null; offlineAlertedAt: string | null;
    cpu: { total: number; used: number };
    ramMb: { total: number; used: number };
    cacheHitRate: number | null;
    usage: AdminHostUsage | null;
    overcommit: AdminHostOvercommit | null;
  };
  environments: {
    id: string; teamName: string; vmId: string | null; status: string;
    assignedAt: string | null; vcpu: number | null; ramMb: number | null;
    // Live from the agent. Undefined — never 0 — when the guest hasn't
    // reported: a VM still booting has no measurement, and a fabricated zero
    // would read as "this VM needs nothing".
    usedMb?: number; availableMb?: number; cachesMb?: number;
    balloonMb?: number; usableMb?: number;
    vcpuUsed?: number; throttledPct?: number;
  }[];
  recentFailures: { id: string; teamName: string; error: string | null; attempts: number; occurredAt: string }[];
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
  id: string; email: string; verified: boolean; isPlatformAdmin: boolean; twoFactorEnabled: boolean; createdAt: string;
  teams: { teamId: string; teamName: string; role: string }[];
}

export interface AuditEntry {
  id: string; action: string; target: string | null; actorEmail: string | null;
  detail: Record<string, unknown>; createdAt: string;
}

export interface ReferralInfo {
  code: string; shareUrl: string; pending: number; rewarded: number;
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

/** Backup freshness for the admin dashboard (GET /admin/backups). */
export interface AdminBackups {
  /** False when BACKUP_REPORT_TOKEN isn't set — reporting is off, so "no runs"
   *  means "not wired up", not "backups are failing". The distinction matters:
   *  one is a to-do, the other is an incident. */
  configured: boolean;
  lastSuccessAt: string | null;
  lastSuccessBytes: number | null;
  lastVerifiedAt: string | null;
  runs: {
    id: string; status: 'ok' | 'failed' | 'verified'; archive: string | null;
    bytes: number; durationSeconds: number; detail: string | null; createdAt: string;
  }[];
}

/** Grouped application errors (GET /admin/errors). */
export interface AdminErrors {
  unresolved: number;
  occurrencesLast24h: number;
  errors: {
    id: string; source: 'api' | 'client'; message: string; stack: string | null;
    route: string | null; method: string | null; statusCode: number | null;
    count: number; firstSeenAt: string; lastSeenAt: string; resolvedAt: string | null;
  }[];
}
