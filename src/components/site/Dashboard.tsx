import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  API_URL, ApiError, LEVEL_META, api,
  type ApiTokenInfo, type ContainerInfo, type CreatedToken, type EnvironmentContainers,
  type EnvironmentDetail, type EnvironmentInfo, type EnvironmentRun, type InvoiceInfo, type ReferralInfo,
  type AuditPage, type SessionInfo, type StatusSummary, type SubscriptionInfo, type TeamInfo,
  type TeamSecurity, type TeamSummary, type TeamList,
  type TwoFactorSetup, type TwoFactorStatus,
  type UsageTimeseries, type CapacityPressure,
  type WebhookDelivery, type WebhookEndpoint, type WebhookEndpointList, type WebhookEndpointWithSecret,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PURCHASABLE_PLANS, TEAM_MAX_SEATS, YEARLY_FACTOR, type PurchasableTier } from '@/lib/plans';
import { passwordMeetsPolicy, passwordRules } from '@/lib/passwordPolicy';
import { isOlderVersion, useCliVersion } from '@/lib/useCliVersion';
import { AuditList, Logo, useCountUp } from './Shared';
import { EnterpriseEnquiry } from './EnterpriseEnquiry';

/** A dashboard metric that counts up to its value once loaded. `value` is the
 *  resolved number, or null while still loading (renders a skeleton). */
function CountStat({ value }: { value: number | null }) {
  const counted = useCountUp(value ?? 0, value !== null);
  if (value === null) return <Skeleton className="h-9 w-16 mt-2.5 mb-1.5" />;
  return <p className="font-doto text-4xl mt-2 num-in">{counted}</p>;
}

/** Tiny inline bar sparkline for per-token run counts. */
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <span className="inline-flex items-end gap-[1px] h-4 align-middle">
      {data.map((v, i) => (
        <span key={i} className="w-[3px] bg-[#8AB8F0]/70" style={{ height: `${v > 0 ? Math.max((v / max) * 100, 15) : 6}%` }} />
      ))}
    </span>
  );
}

/** Prominent free-trial banner with a progress bar toward the trial's end.
 *  Escalates from neutral → amber → red as the days run out. */
function TrialBanner({ daysLeft, onUpgrade }: {
  daysLeft: number;
  /** null for developers. The countdown still matters to them — their runs stop
   *  too — but "Upgrade now" would send them to a page they can't open, so the
   *  banner tells them who can instead. */
  onUpgrade: (() => void) | null;
}) {
  const TRIAL_DAYS = 14;
  const ended = daysLeft <= 0;
  const used = Math.min(1, Math.max(0, (TRIAL_DAYS - daysLeft) / TRIAL_DAYS));
  const color = ended || daysLeft <= 3 ? '#F07A6A' : daysLeft <= 7 ? '#E8B44C' : '#8AB8F0';
  return (
    <div className="mb-6 border border-[--dark-line] bg-[--dark-card] p-4" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium">
            {ended ? 'Your free trial has ended' : `Free trial — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
          </p>
          <p className="text-xs text-[--dark-muted] mt-0.5">
            {onUpgrade
              ? (ended ? 'Upgrade to run environments again — your data and settings are kept.' : 'Upgrade any time to keep running environments after the trial.')
              : 'Ask a team owner or admin to pick a plan — nothing is lost either way, environments just stop starting.'}
          </p>
        </div>
        {onUpgrade && (
          <button onClick={onUpgrade} className="font-mono2 text-[11px] uppercase tracking-widest border px-4 py-2 shrink-0"
            style={{ borderColor: color, color }}>
            {ended ? 'Upgrade now' : 'See plans'}
          </button>
        )}
      </div>
      <div className="mt-3 h-1.5 bg-white/[0.08]">
        <div className="h-full" style={{ width: `${used * 100}%`, background: color }} />
      </div>
    </div>
  );
}

/** Info panel shown across all dashboard views: active incidents, general
 *  announcements, and upcoming maintenance, pulled from the same /status feed
 *  the public page uses. Renders nothing when there's nothing to say. */
function StatusBanner() {
  const [data, setData] = useState<StatusSummary | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api<StatusSummary>('/status').then((d) => { if (alive) setData(d); }).catch(() => {});
    void load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!data) return null;
  const items = [...data.active, ...data.upcoming];
  if (items.length === 0) return null;
  return (
    <div className="mb-6 space-y-2">
      {items.map((p) => {
        const isIncident = p.type === 'incident';
        const color = isIncident ? LEVEL_META.degraded.color : p.type === 'maintenance' ? LEVEL_META.maintenance.color : '#8AB8F0';
        const latest = p.updates[p.updates.length - 1];
        return (
          <a key={p.id} href="/status" className="block border border-[--dark-line] bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-colors"
            style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">
                {p.type === 'announcement' ? 'Announcement' : p.type === 'maintenance' ? 'Maintenance' : 'Incident'} · {p.state.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium">{p.title}</p>
            <p className="mt-1 text-xs text-[--dark-muted]">{latest?.body ?? p.body}</p>
          </a>
        );
      })}
    </div>
  );
}

interface Notification { id: string; kind: 'incident' | 'maintenance' | 'trial'; title: string; body: string; href?: string; color: string }

/** Bell in the header aggregating what a user should notice without leaving
 *  the dashboard: active incidents, upcoming maintenance, and a trial that's
 *  about to lapse. Derived client-side from the same /status feed + the team's
 *  trial clock — no new endpoint. Dismissed ids persist in localStorage so a
 *  seen item doesn't keep re-badging. */
function NotificationBell({ trialDaysLeft, onTrialClick }: {
  trialDaysLeft: number | null;
  /** null for developers: they still need to know the trial is ending, they
   *  just have nowhere to act on it. */
  onTrialClick: (() => void) | null;
}) {
  const [status, setStatus] = useState<StatusSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('devplat.notif.dismissed') ?? '[]')); } catch { return new Set(); }
  });

  useEffect(() => {
    let alive = true;
    const load = () => api<StatusSummary>('/status').then((d) => { if (alive) setStatus(d); }).catch(() => {});
    void load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const notifications: Notification[] = [];
  for (const p of status?.active ?? []) {
    if (p.type === 'announcement') continue;
    notifications.push({ id: `post:${p.id}`, kind: p.type === 'maintenance' ? 'maintenance' : 'incident', title: p.title,
      body: (p.updates[p.updates.length - 1]?.body ?? p.body), href: '/status',
      color: p.type === 'maintenance' ? LEVEL_META.maintenance.color : LEVEL_META.degraded.color });
  }
  for (const p of status?.upcoming ?? []) {
    notifications.push({ id: `post:${p.id}`, kind: 'maintenance', title: p.title, body: p.body || 'Scheduled maintenance', href: '/status', color: LEVEL_META.maintenance.color });
  }
  if (trialDaysLeft !== null && trialDaysLeft <= 5) {
    notifications.push({
      id: `trial:${trialDaysLeft > 0 ? trialDaysLeft : 'ended'}`, kind: 'trial',
      title: trialDaysLeft > 0 ? `Trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}` : 'Your trial has ended',
      body: onTrialClick
        ? (trialDaysLeft > 0 ? 'Upgrade before it lapses to keep running environments.' : 'Upgrade to run environments again.')
        : 'A team owner or admin needs to pick a plan to keep environments running.',
      color: trialDaysLeft <= 3 ? LEVEL_META.major_outage.color : LEVEL_META.maintenance.color,
    });
  }

  const unseen = notifications.filter((n) => !dismissed.has(n.id));
  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem('devplat.notif.dismissed', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative w-8 h-8 grid place-items-center border border-[--dark-line] hover:border-white text-sm" aria-label="Notifications" title="Notifications">
        ◔
        {unseen.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 grid place-items-center bg-[--red] text-white font-mono2 text-[9px] rounded-full">{unseen.length}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[--dark-card] border border-[--dark-line] z-40 shadow-[6px_6px_0_0_rgba(0,0,0,0.5)]">
            <div className="px-4 py-2.5 border-b border-[--dark-line] font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Notifications</div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[--dark-muted] text-center">You're all caught up. ✓</p>
            ) : (
              <div className="divide-y divide-[--dark-line] max-h-[60vh] overflow-y-auto">
                {notifications.map((n) => {
                  const seen = dismissed.has(n.id);
                  const inner = (
                    <div className={`px-4 py-3 ${seen ? 'opacity-45' : ''}`} style={{ borderLeft: `2px solid ${n.color}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{n.title}</p>
                        {!seen && <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(n.id); }} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white shrink-0" title="Dismiss">✕</button>}
                      </div>
                      <p className="mt-1 text-xs text-[--dark-muted]">{n.body}</p>
                    </div>
                  );
                  if (n.kind === 'trial') {
                    if (!onTrialClick) return <div key={n.id}>{inner}</div>;
                    return <button key={n.id} onClick={() => { setOpen(false); onTrialClick(); }} className="block w-full text-left hover:bg-white/[0.03]">{inner}</button>;
                  }
                  return <a key={n.id} href={n.href} className="block hover:bg-white/[0.03]">{inner}</a>;
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Pings the real /health endpoint instead of showing a hardcoded "operational". */
function useApiHealth(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => api('/health').then(() => { if (alive) setOk(true); }).catch(() => { if (alive) setOk(false); });
    check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return ok;
}

type View = 'overview' | 'pipelines' | 'tokens' | 'billing' | 'team' | 'settings' | 'profile';
const VIEWS: View[] = ['overview', 'pipelines', 'tokens', 'billing', 'team', 'settings', 'profile'];

const statusStyle: Record<string, string> = {
  assigned: 'text-[#57C99A] border-[#57C99A]/40',
  failed: 'text-[#F07A6A] border-[#F07A6A]/40',
  queued: 'text-[#E8B44C] border-[#E8B44C]/40',
  released: 'text-[--dark-muted] border-[--dark-line]',
};

function Badge({ s }: { s: string }) {
  return <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${statusStyle[s] ?? 'text-[--dark-muted] border-[--dark-line]'}`}>{s === 'assigned' && <span className="pulse-dot mr-1">●</span>}{s}</span>;
}

function Card({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <div id={id} className={`bg-[--dark-card] border border-[--dark-line] ${className}`}>{children}</div>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton block ${className}`} aria-hidden />;
}

/** Copy-to-clipboard button with a brief "Copied" confirmation. Falls back
 *  silently if the Clipboard API is unavailable (old browser / insecure
 *  context) — the value is still select-all'able by hand. */
function CopyButton({ value, className = '' }: { value: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch { /* clipboard unavailable — the text stays selectable manually */ }
  };
  return (
    <button onClick={copy}
      className={`font-mono2 text-[10px] border px-3 py-1.5 transition-colors ${done ? 'border-[#57C99A] text-[#57C99A]' : 'border-[--dark-line] text-[--dark-muted] hover:border-white hover:text-white'} ${className}`}>
      {done ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function CardHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[--dark-line]">
      <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">{title}</p>
      {right}
    </div>
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtAgo(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} hr ago`;
  return fmtDate(iso);
}

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** This team's daily VM-start activity — starts in green, failed starts in red
 *  stacked on top. Mirrors the admin chart, scoped to one team. */
function UsageChart({ series }: { series: UsageTimeseries }) {
  // Defence in depth against a malformed payload. api() now rejects a 2xx whose
  // body isn't valid JSON, which is what let a `{}` through here and crashed
  // the whole dashboard on `days.reduce`. A chart is not worth taking the route
  // down for, so it also refuses to render from a shape it doesn't recognise.
  const days = Array.isArray(series?.days) ? series.days : [];
  if (days.length === 0) return null;
  const max = Math.max(1, ...days.map((d) => d.starts + d.failures));
  const total = days.reduce((s, d) => s + d.starts, 0);
  const failed = days.reduce((s, d) => s + d.failures, 0);
  // Forecast: extrapolate the trailing-7-day pace to a monthly run rate, so a
  // team can see where usage is trending rather than only what already ran.
  // Uses the last 7 days (or the whole window if shorter) as the recent rate.
  const recent = days.slice(-7);
  const recentDays = recent.length || 1;
  const recentStarts = recent.reduce((s, d) => s + d.starts, 0);
  const perDay = recentStarts / recentDays;
  const perWeek = Math.round(perDay * 7);
  const perMonth = Math.round(perDay * 30);
  const forecast = total > 0 ? { perWeek, perMonth } : null;
  return (
    <Card>
      <CardHead title={`Your usage · ${days.length}d`} right={
        <span className="font-mono2 text-[10px] text-[--dark-muted]">{total} starts{failed > 0 ? ` · ${failed} failed` : ''}</span>
      } />
      <div className="p-5">
        {total + failed === 0 ? (
          <p className="font-mono2 text-xs text-[--dark-muted]">No runs yet — your VM starts will chart here.</p>
        ) : (
          <>
            <div className="flex items-end gap-[3px] h-24">
              {days.map((d) => {
                const h = ((d.starts + d.failures) / max) * 100;
                const failPct = d.starts + d.failures > 0 ? (d.failures / (d.starts + d.failures)) * 100 : 0;
                return (
                  <div key={d.date} className="flex-1 flex flex-col justify-end h-full" title={`${d.date} · ${d.starts} starts, ${d.failures} failed`}>
                    <div className="w-full bg-[#57C99A]/70" style={{ height: `${Math.max(h, d.starts + d.failures > 0 ? 5 : 0)}%` }}>
                      {failPct > 0 && <div className="w-full bg-[#F07A6A]" style={{ height: `${failPct}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between font-mono2 text-[9px] text-[--dark-muted] mt-1.5">
              <span>{days[0]?.date.slice(5)}</span><span>today</span>
            </div>
            {forecast && (
              <div className="mt-3 pt-3 border-t border-[--dark-line] flex items-center justify-between gap-3">
                <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Projected pace</p>
                <p className="font-mono2 text-[11px] text-[--dark-text]">
                  ≈ {forecast.perWeek}<span className="text-[--dark-muted]">/wk</span>
                  <span className="text-[--dark-muted] mx-1.5">·</span>
                  ≈ {forecast.perMonth}<span className="text-[--dark-muted]">/mo</span>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function fmtWait(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min`;
  return `${Math.round(minutes / 6) / 10} h`;
}

/**
 * Surfaces how often this team's runs waited for a free slot.
 *
 * Parallelism is what the plan sells, so "we were at the ceiling for eleven
 * runs this fortnight" is the one usage fact worth interrupting for — and it
 * was previously invisible: a run blocked by the plan cap and a run blocked by
 * host capacity both just showed up as "queued". Renders nothing at all when
 * there's no pressure, so a healthy team never sees an upsell.
 */
function CapacityPressureNotice({ goView, canUpgrade }: { goView: (v: View) => void; canUpgrade: boolean }) {
  const [p, setP] = useState<CapacityPressure | null>(null);
  useEffect(() => {
    api<CapacityPressure>('/environments/pressure?days=14').then(setP).catch(() => setP(null));
  }, []);
  if (!p || p.blockedRuns === 0) return null;

  const share = p.totalRuns > 0 ? Math.round((p.blockedRuns / p.totalRuns) * 100) : 0;
  return (
    <Card className="p-4 sm:p-5 border-l-2 border-l-[--red]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[70ch]">
          <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">
            Parallelism · last {p.windowDays} days
          </p>
          <p className="text-sm mt-2">
            <strong className="text-white">{p.blockedRuns} run{p.blockedRuns === 1 ? '' : 's'}</strong>{' '}
            waited for a free environment
            {share > 0 && <> — {share}% of everything you started</>}.
            {p.waitingNow > 0 && (
              <> <span className="text-[--red]">{p.waitingNow} waiting right now.</span></>
            )}
          </p>
          <p className="text-xs text-[--dark-muted] mt-1.5">
            {p.resolvedWaits > 0
              ? <>Longest wait {fmtWait(p.waitSecondsWorst)}, {fmtWait(p.waitSecondsTotal)} in total. </>
              : null}
            All {p.limit} of your parallel environment{p.limit === 1 ? '' : 's'} were busy. Nothing failed —
            queued runs start automatically as a slot frees up.
          </p>
        </div>
        {/* The measurement is worth showing to everyone — a developer feeling the
            queue should be able to see it is real. Only the button changing the
            bill is restricted. */}
        {p.upgrade && (canUpgrade
          ? (
            <button onClick={() => goView('billing')}
              className="font-mono2 text-[10px] uppercase tracking-widest border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark] whitespace-nowrap">
              {p.upgrade.label} · {p.upgrade.parallelEnvs} parallel
            </button>
          )
          : (
            <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] border border-[--dark-line] px-4 py-2.5 whitespace-nowrap">
              {p.upgrade.label} · {p.upgrade.parallelEnvs} parallel — ask an admin
            </p>
          ))}
      </div>
    </Card>
  );
}

function fmtTtl(expiresAt: string | null): string {
  if (!expiresAt) return '—';
  const mins = Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'expired';
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
}

/** Slide-over panel with a live view of one environment: its metadata plus a
 *  polled container list (real `docker ps` via the backend's WireGuard reach
 *  to the VM). Published ports are shown as localhost:PORT — the same address
 *  Testcontainers resolves them to through the CLI. */
function EnvironmentDrawer({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<EnvironmentDetail | null>(null);
  const [data, setData] = useState<EnvironmentContainers | null>(null);

  useEffect(() => {
    let alive = true;
    api<EnvironmentDetail>(`/environments/${requestId}`).then((d) => { if (alive) setDetail(d); }).catch(() => {});
    const loadContainers = () => api<EnvironmentContainers>(`/environments/${requestId}/containers`)
      .then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setData({ reachable: false, containers: [] }); });
    loadContainers();
    const t = setInterval(loadContainers, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [requestId]);

  const meta: [string, string][] = detail ? [
    ['VM', detail.vmId ?? '—'],
    ['Host', `${detail.hostName ?? '—'}${detail.region ? ` · ${detail.region}` : ''}`],
    ['Resources', detail.vcpu ? `${detail.vcpu} vCPU · ${Math.round((detail.ramMb ?? 0) / 1024)} GB` : '—'],
    ['TTL', fmtTtl(detail.expiresAt)],
  ] : [];

  // The Docker endpoint is what a caller points their local Docker/Testcontainers
  // client at, so offer it as a ready-to-paste `export DOCKER_HOST=…` line rather
  // than a bare host:port the user has to reshape by hand.
  const dockerHost = detail?.dockerEndpoint ? `tcp://${detail.dockerEndpoint}` : null;
  const dockerHostExport = dockerHost ? `export DOCKER_HOST=${dockerHost}` : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md h-full bg-[--dark-card] border-l border-[--dark-line] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[--dark-card] border-b border-[--dark-line] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Environment</p>
            <p className="font-mono2 text-sm mt-0.5">{detail?.vmId ?? requestId.slice(0, 12)}</p>
          </div>
          <button onClick={onClose} className="font-mono2 text-xs text-[--dark-muted] hover:text-white border border-[--dark-line] px-3 py-1.5">Close</button>
        </div>

        <div className="p-5 grid gap-2">
          {detail ? meta.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted] shrink-0">{k}</span>
              <span className="font-mono2 text-xs text-right break-all">{v}</span>
            </div>
          )) : <Skeleton className="h-24 w-full" />}
        </div>

        {dockerHostExport && (
          <div className="px-5 pb-5">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted] mb-2">Connect a local Docker client</p>
            <div className="border border-[--dark-line] bg-black/20 p-3 flex items-center gap-2">
              <code className="font-mono2 text-[11px] text-[#8AB8F0] break-all flex-1">{dockerHostExport}</code>
              <CopyButton value={dockerHostExport} className="shrink-0" />
            </div>
            <p className="font-mono2 text-[10px] text-[--dark-muted] mt-1.5">Point Testcontainers or the Docker CLI straight at this microVM.</p>
          </div>
        )}

        <div className="px-5 pb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Containers</p>
            {data && (data.reachable
              ? <span className="font-mono2 text-[10px] text-[#57C99A]"><span className="pulse-dot mr-1">●</span>live</span>
              : <span className="font-mono2 text-[10px] text-[#E8B44C]">unreachable</span>)}
          </div>
          {data === null && <Skeleton className="h-16 w-full" />}
          {data && data.containers.length === 0 && (
            <p className="font-mono2 text-xs text-[--dark-muted]">{data.reachable ? 'No containers running right now.' : 'Cannot reach the VM (it may be mid-boot).'}</p>
          )}
          <div className="space-y-2">
            {data?.containers.map((c: ContainerInfo) => (
              <div key={c.id} className="border border-[--dark-line] p-3">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.state === 'running' ? 'bg-[#57C99A]' : 'bg-[--dark-muted]'}`} />
                  <span className="font-mono2 text-xs font-medium truncate">{c.name || c.id}</span>
                </div>
                <p className="font-mono2 text-[10px] text-[--dark-muted] mt-1 truncate">{c.image}</p>
                {c.ports.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.ports.map((p) => (
                      <span key={p.publicPort} className="font-mono2 text-[10px] text-[#8AB8F0] border border-[#8AB8F0]/30 px-1.5 py-0.5" title={`container port ${p.privatePort}`}>localhost:{p.publicPort}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Overview: real environments from the scheduler ---------- */

function Overview({ limit, planLabel, goView, canUpgrade }: {
  limit: number; planLabel: string; goView: (v: View) => void; canUpgrade: boolean;
}) {
  const [envs, setEnvs] = useState<EnvironmentInfo[] | null>(null);
  const [runs, setRuns] = useState<EnvironmentRun[] | null>(null);
  const [usage, setUsage] = useState<UsageTimeseries | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    api<{ environments: EnvironmentInfo[] }>('/environments')
      .then((d) => { setEnvs(d.environments); setErr(''); })
      .catch(() => setErr('Could not load environments.'));
    api<{ runs: EnvironmentRun[] }>('/environments/history').then((d) => setRuns(d.runs)).catch(() => {});
    api<UsageTimeseries>('/environments/usage?days=14').then(setUsage).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const release = async (id: string) => {
    setBusy(id);
    await api(`/environments/${id}`, { method: 'DELETE' }).catch(() => {});
    setBusy('');
    load();
  };

  const active = envs?.filter((e) => e.status === 'assigned').length ?? 0;
  const queued = envs?.filter((e) => e.status === 'queued').length ?? 0;

  return (
    <div className="grid gap-5">
      {drawer && <EnvironmentDrawer requestId={drawer} onClose={() => setDrawer(null)} />}
      {/* Two columns from the smallest screen up: as four stacked full-width
          cards, these filled an entire phone viewport before anything
          actionable appeared. The Plan card is gone — the plan is already in
          the header chip and, during a trial, in the banner directly above;
          stating it a third time cost a card slot and taught nothing. What
          replaced it is the number people actually come here for. */}
      <div className="grid gap-3 sm:gap-5 grid-cols-2 xl:grid-cols-4">
        {([
          { k: 'Active now', num: envs ? active : null, s: 'assigned microVMs' },
          { k: 'Queued', num: envs ? queued : null, s: 'waiting for a free slot' },
          { k: 'Parallelism limit', num: limit, s: `environment${limit === 1 ? '' : 's'} at once`, sub: planLabel },
          // Same guard as UsageChart: a KPI tile must not be able to blank the
          // page it sits on.
          { k: 'Runs · 14d', num: Array.isArray(usage?.days) ? usage.days.reduce((a, d) => a + d.starts, 0) : null, s: 'environment starts' },
        ] as const).map((c) => (
          <Card key={c.k} className="p-4 sm:p-5 accent-top lift">
            <p className="font-mono2 text-[10px] sm:text-[11px] uppercase tracking-widest text-[--dark-muted]">{c.k}</p>
            <CountStat value={c.num ?? (err ? 0 : null)} />
            <p className="text-xs text-[--dark-muted] mt-1">{c.s}</p>
            {'sub' in c && c.sub && (
              <p className="font-mono2 text-[10px] text-[--dark-muted] mt-1.5 pt-1.5 border-t border-[--dark-line]">
                on {c.sub}
              </p>
            )}
          </Card>
        ))}
      </div>
      {/* Directly under the KPIs, because it explains the "Queued" number
          above rather than introducing an unrelated topic. */}
      <CapacityPressureNotice goView={goView} canUpgrade={canUpgrade} />
      <Card>
        <CardHead title="Environments" right={
          <button onClick={load} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">Refresh</button>
        } />
        <div className="divide-y divide-[--dark-line]">
          {envs === null && !err && [0, 1].map((i) => (
            <div key={i} className="grid grid-cols-[1.3fr_1fr_110px] gap-3 items-center px-5 py-3.5">
              <div className="space-y-1.5"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-3 w-32 hidden sm:block" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
          {err && <p className="px-5 py-4 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
          {/* Nothing running is the normal state for a healthy team — a run
              lasts minutes and the day has 24 hours. So this splits: a team
              that has never connected gets the setup ladder, and a team that
              has gets its recent runs instead. Showing "1 · Install the CLI"
              to people who installed it months ago made the main screen read
              as permanently unfinished.

              Held back until `runs` has loaded, so an established team never
              flashes the setup steps on the way in. */}
          {envs?.length === 0 && runs === null && (
            <div className="px-5 py-8 space-y-2"><Skeleton className="h-4 w-64" /><Skeleton className="h-3 w-40" /></div>
          )}
          {envs?.length === 0 && runs !== null && runs.length === 0 && (
            <div className="px-5 py-8">
              <p className="text-sm text-[--dark-muted]">
                No environments running. Your test runs will show up here from the first{' '}
                <span className="font-mono2 text-white">devplat connect</span> on.
              </p>
              <ol className="mt-5 space-y-3 font-mono2 text-xs text-[--dark-muted]">
                <li className="flex items-center gap-2 flex-wrap">
                  <span>1 · Install the CLI:</span>
                  <code className="text-white bg-black/40 border border-[--dark-line] px-2 py-1">curl -fsSL https://get.devplat.ch | sh</code>
                  <CopyButton value="curl -fsSL https://get.devplat.ch | sh" />
                </li>
                <li>2 · <span className="text-white">devplat login</span> — browser sign-in, then run your tests in the session</li>
                <li>3 · In CI, use a <button onClick={() => goView('tokens')} className="text-white hover:text-[#8AB8F0]">token</button> and one line: <span className="text-white">devplat connect --exec "mvn verify"</span></li>
              </ol>
            </div>
          )}
          {envs?.length === 0 && runs !== null && runs.length > 0 && (
            <div className="px-5 py-6">
              <p className="text-sm text-[--dark-muted]">
                Nothing running right now. Last run {fmtAgo(runs[0].releasedAt ?? runs[0].requestedAt)}.
              </p>
              <div className="mt-4 grid gap-1.5">
                {runs.slice(0, 3).map((r) => (
                  <div key={r.requestId} className="flex items-center gap-3 flex-wrap font-mono2 text-[11px]">
                    <span className={r.status === 'failed' ? 'text-[#F07A6A]' : 'text-[#57C99A]'}>
                      {r.status === 'failed' ? '✕' : '✓'}
                    </span>
                    <span className="text-[--dark-text]">{r.vmId ?? r.requestId.slice(0, 8)}</span>
                    <span className="text-[--dark-muted]">{fmtAgo(r.releasedAt ?? r.requestedAt)}</span>
                    {r.durationSeconds !== null && <span className="text-[--dark-muted]">{fmtDuration(r.durationSeconds)}</span>}
                    {r.status === 'failed' && r.error && (
                      <span className="text-[#F07A6A] truncate max-w-[40ch]" title={r.error}>{r.error}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono2 text-[11px] text-[--dark-muted]">
                Start another with <span className="text-white">devplat connect</span> — the full list is under Run history below.
              </p>
            </div>
          )}
          {envs?.map((e, i) => (
            <div key={e.requestId} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              className="row-in grid grid-cols-[1fr_auto] sm:grid-cols-[1.3fr_1fr_110px_auto_auto] gap-3 items-center px-5 py-3.5 font-mono2 text-xs hover:bg-white/[0.02]">
              <div>
                <p className="font-sans text-sm font-medium">{e.vmId ?? 'waiting for slot'}</p>
                <p className="text-[11px] text-[--dark-muted]">{e.requestId}</p>
              </div>
              <span className="text-[--dark-muted] hidden sm:block break-all">{e.dockerEndpoint ?? '—'}</span>
              <span className="text-[--dark-muted] hidden sm:block">{fmtAgo(e.requestedAt)}</span>
              <Badge s={e.status} />
              <div className="flex items-center gap-1 justify-end">
                {e.status === 'assigned' && (
                  <button onClick={() => setDrawer(e.requestId)}
                    className="font-mono2 text-[10px] border border-[--dark-line] text-[--dark-muted] px-3 py-1.5 hover:border-white hover:text-white">
                    Details
                  </button>
                )}
                <button onClick={() => release(e.requestId)} disabled={busy === e.requestId}
                  className="font-mono2 text-[10px] border border-[#F07A6A]/40 text-[#F07A6A] px-3 py-1.5 hover:bg-[#F07A6A]/10 disabled:opacity-50">
                  {busy === e.requestId ? '…' : 'Release'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {usage && <UsageChart series={usage} />}

      {/* Run history — past (released/failed) runs, collapsed by default so it
          doesn't dominate the page; expand to see the full list. */}
      {runs && runs.length > 0 && <RunHistory runs={runs} />}
    </div>
  );
}

/** Past-runs table that stays out of the way: collapsed to a one-line summary
 *  by default, expanding to a scrollable list on click. */
function RunHistory({ runs }: { runs: EnvironmentRun[] }) {
  const [open, setOpen] = useState(false);
  const failed = runs.filter((r) => r.status === 'failed').length;
  return (
    <Card>
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-[--dark-line] text-left hover:bg-white/[0.02] transition-colors">
        <span className="flex items-center gap-2">
          <span className={`font-mono2 text-[10px] text-[--dark-muted] transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>▶</span>
          <span className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Run history</span>
        </span>
        <span className="font-mono2 text-[10px] text-[--dark-muted]">
          {runs.length} run{runs.length === 1 ? '' : 's'}{failed > 0 && <span className="text-[#F07A6A]"> · {failed} failed</span>}
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="sticky top-0 bg-[--dark-card]">
              <tr className="border-b border-[--dark-line] font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">
                <th className="px-5 py-2.5 font-medium">Run</th>
                <th className="px-5 py-2.5 font-medium">Host</th>
                <th className="px-5 py-2.5 font-medium">Started</th>
                <th className="px-5 py-2.5 font-medium">Duration</th>
                <th className="px-5 py-2.5 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--dark-line]">
              {runs.map((r) => (
                <tr key={r.requestId} className="font-mono2 text-xs">
                  <td className="px-5 py-2.5"><span className="text-white">{r.vmId ?? r.requestId.slice(0, 12)}</span></td>
                  <td className="px-5 py-2.5 text-[--dark-muted]">{r.hostName ?? '—'}{r.region ? ` · ${r.region}` : ''}</td>
                  <td className="px-5 py-2.5 text-[--dark-muted]">{fmtAgo(r.requestedAt)}</td>
                  <td className="px-5 py-2.5 text-[--dark-muted]">{fmtDuration(r.durationSeconds)}</td>
                  <td className="px-5 py-2.5">
                    {r.status === 'failed'
                      ? <span className="text-[#F07A6A]" title={r.error ?? undefined}>failed</span>
                      : <span className="text-[--dark-muted]">released</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const CI_SYSTEMS = ['GitHub Actions', 'GitLab CI', 'CircleCI', 'Jenkins', 'Bitbucket'] as const;
type CiSystem = (typeof CI_SYSTEMS)[number];

function ciSnippet(ci: CiSystem, repoComment: string): string {
  switch (ci) {
    case 'GitHub Actions':
      return `# ${repoComment}.github/workflows/ci.yml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: curl -fsSL https://get.devplat.ch | sh
      - run: devplat connect --exec "mvn verify"
        env:
          DEVPLAT_TOKEN: \${{ secrets.DEVPLAT_TOKEN }}`;
    case 'GitLab CI':
      return `# ${repoComment}.gitlab-ci.yml
integration-tests:
  script:
    - curl -fsSL https://get.devplat.ch | sh
    - devplat connect --exec "mvn verify"
  # Set DEVPLAT_TOKEN as a masked CI/CD variable in project settings.`;
    case 'CircleCI':
      return `# ${repoComment}.circleci/config.yml
version: 2.1
jobs:
  integration-tests:
    docker:
      - image: cimg/base:current
    steps:
      - checkout
      - run: curl -fsSL https://get.devplat.ch | sh
      - run: devplat connect --exec "mvn verify"
        # Add DEVPLAT_TOKEN as a project environment variable.
workflows:
  test:
    jobs: [integration-tests]`;
    case 'Jenkins':
      return `// ${repoComment}Jenkinsfile
pipeline {
  agent any
  environment { DEVPLAT_TOKEN = credentials('devplat-token') }
  stages {
    stage('Integration tests') {
      steps {
        sh 'curl -fsSL https://get.devplat.ch | sh'
        sh 'devplat connect --exec "mvn verify"'
      }
    }
  }
}`;
    case 'Bitbucket':
      return `# ${repoComment}bitbucket-pipelines.yml
pipelines:
  default:
    - step:
        name: Integration tests
        script:
          - curl -fsSL https://get.devplat.ch | sh
          - devplat connect --exec "mvn verify"
        # Add DEVPLAT_TOKEN as a repository variable (secured).`;
  }
}

function Pipelines() {
  const [repo, setRepo] = useState('');
  const [ci, setCi] = useState<CiSystem>('GitHub Actions');
  const [copied, setCopied] = useState(false);
  const repoComment = repo.trim() ? `${repo.trim()} · ` : '';
  const yaml = ciSnippet(ci, repoComment);
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
      <Card className="p-5 h-fit">
        <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted] mb-4">Pipeline snippet generator</p>
        <label className="block mb-4">
          <span className="font-mono2 text-[10px] text-[--dark-muted] uppercase tracking-widest">Repository</span>
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="your-org/your-repo"
            className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm font-mono2 outline-none focus:border-white" />
        </label>
        <span className="font-mono2 text-[10px] text-[--dark-muted] uppercase tracking-widest">CI system</span>
        <div className="flex gap-1 mt-1.5 font-mono2 text-xs flex-wrap">
          {CI_SYSTEMS.map((k) => (
            <button key={k} onClick={() => setCi(k)} className={`px-3 py-2 border ${ci === k ? 'border-white text-white' : 'border-[--dark-line] text-[--dark-muted] hover:border-white/60'}`}>{k}</button>
          ))}
        </div>
        <p className="mt-5 text-xs text-[--dark-muted]">The token is stored as the secret <span className="font-mono2 text-white">DEVPLAT_TOKEN</span> — create it under API Tokens.</p>
      </Card>
      <Card>
        <CardHead title="Generated snippet" right={
          <button onClick={() => { void navigator.clipboard.writeText(yaml).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">{copied ? '✓ Copied' : 'Copy'}</button>
        } />
        <pre className="p-5 font-mono2 text-[12px] leading-relaxed overflow-x-auto">{yaml}</pre>
      </Card>
    </div>
  );
}

/* ---------- Tokens: real data ---------- */

function Tokens() {
  const [tokens, setTokens] = useState<ApiTokenInfo[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<'ci:run' | 'dev:run'>('ci:run');
  // 0 = never expires, which stays the default so existing workflows don't
  // change behaviour just because the option now exists.
  const [expiresInDays, setExpiresInDays] = useState(0);
  // Comma/newline separated CIDRs; empty means the token works from anywhere.
  const [ipAllowlist, setIpAllowlist] = useState('');
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [err, setErr] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<ApiTokenInfo | null>(null);
  const [revoking, setRevoking] = useState(false);
  const latest = useCliVersion();
  // The oldest CLI version any token has reported that's behind latest — drives
  // the one-line "update available" banner. null when every seen CLI is current.
  const outdated = (tokens ?? [])
    .map((t) => t.lastCliVersion)
    .filter((v): v is string => !!v && isOlderVersion(v, latest))
    .sort((a, b) => (isOlderVersion(a, b) ? -1 : 1))[0] ?? null;

  const load = useCallback(() => {
    api<{ tokens: ApiTokenInfo[] }>('/tokens').then((d) => setTokens(d.tokens)).catch(() => setErr('Could not load tokens.'));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    setErr('');
    if (!label.trim()) { setErr('Please give the token a label.'); return; }
    try {
      const tok = await api<CreatedToken>('/tokens', {
        body: {
          label, scope,
          ...(expiresInDays ? { expiresInDays } : {}),
          ...(ipAllowlist.trim()
            ? { ipAllowlist: ipAllowlist.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean) }
            : {}),
        },
      });
      setCreated(tok);
      setCreating(false);
      setLabel('');
      setIpAllowlist('');
      load();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'invalid_cidr' ? e.message : 'Token could not be created.');
    }
  };

  const revoke = async (id: string) => {
    setErr(''); setRevoking(true);
    try {
      await api(`/tokens/${id}`, { method: 'DELETE' });
      if (created?.id === id) setCreated(null);
      setRevokeTarget(null);
      load();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'token_not_yours'
        ? e.message
        : 'Could not revoke this token — please try again.');
      setRevokeTarget(null);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="grid gap-5">
      {outdated && (
        <div className="border border-[#E8B44C]/40 bg-[#E8B44C]/[0.06] px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono2 text-[10px] uppercase tracking-widest text-[#E8B44C]">CLI update available</span>
          <span className="text-sm text-[--dark-text]">
            A CLI on <span className="font-mono2">{outdated}</span> connected recently — latest is <span className="font-mono2">{latest}</span>.
          </span>
          <span className="font-mono2 text-[11px] text-[--dark-muted]">Update: <span className="text-[--dark-text]">curl -fsSL https://get.devplat.ch | sh</span></span>
        </div>
      )}
      <Card>
        <CardHead title="API tokens" right={<button onClick={() => { setCreating(true); setCreated(null); }} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">+ Create token</button>} />
        <div className="divide-y divide-[--dark-line]">
          {tokens === null && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">Loading …</p>}
          {tokens?.length === 0 && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">No tokens yet — create one for your CI.</p>}
          {tokens?.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_150px_130px_120px_auto] gap-3 items-center px-5 py-3.5 text-sm">
              <div>
                <p className="font-medium flex items-center gap-2 flex-wrap">
                  {t.label}
                  {t.lastCliVersion && (
                    isOlderVersion(t.lastCliVersion, latest)
                      ? <span className="font-mono2 text-[9px] uppercase tracking-wider border border-[#E8B44C]/40 text-[#E8B44C] px-1.5 py-0.5" title={`CLI ${t.lastCliVersion} — update to ${latest}`}>{t.lastCliVersion} · update</span>
                      : <span className="font-mono2 text-[9px] uppercase tracking-wider border border-[#57C99A]/30 text-[#57C99A] px-1.5 py-0.5" title="CLI is up to date">{t.lastCliVersion}</span>
                  )}
                </p>
                <p className="font-mono2 text-[11px] text-[--dark-muted]">
                  {t.prefix}
                  {t.ipAllowlist && t.ipAllowlist.length > 0 && (
                    <span className="ml-2 text-[#8AB8F0]" title={`Only usable from: ${t.ipAllowlist.join(', ')}`}>
                      · IP-restricted ({t.ipAllowlist.length})
                    </span>
                  )}
                  {/* Who minted it. A shared team credential with no name against
                      it is how a token nobody dares touch comes about. */}
                  {t.createdBy && <span className="ml-2">· {t.createdByMe ? 'you' : t.createdBy}</span>}
                </p>
              </div>
              <span className="font-mono2 text-[11px] text-[--dark-muted] hidden sm:block">Scope: {t.scope}</span>
              <div className="hidden sm:flex items-center gap-2" title={`${t.runsTotal ?? 0} runs in the last 14 days`}>
                {t.usage && t.usage.length > 0
                  ? <><Sparkline data={t.usage} /><span className="font-mono2 text-[10px] text-[--dark-muted]">{t.runsTotal} · 14d</span></>
                  : <span className="font-mono2 text-[11px] text-[--dark-muted]">{fmtAgo(t.lastUsedAt)}</span>}
              </div>
              <span className="font-mono2 text-[11px] text-[--dark-muted] hidden sm:block">
                {(() => {
                  if (!t.expiresAt) return <>created {fmtDate(t.createdAt)}</>;
                  const days = Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 86_400_000);
                  if (days <= 0) return <span className="text-[#F07A6A]">expired</span>;
                  // Flag tokens about to lapse: a CI pipeline breaking at 3am
                  // because a token quietly aged out is worth warning about.
                  return <span className={days <= 14 ? 'text-[#E8B44C]' : undefined}>expires in {days}d</span>;
                })()}
              </span>
              {/* canRevoke comes from the backend, which owns the rule. Absent
                  means an older backend that let anyone revoke — keep that
                  rather than disabling every button against an old API. */}
              {t.canRevoke === false ? (
                <span className="font-mono2 text-[10px] border border-[--dark-line] text-[--dark-muted] px-3 py-1.5 cursor-default"
                  title={`Only ${t.createdBy ?? 'the creator'} or a team admin can revoke this token.`}>Revoke</span>
              ) : (
                <button onClick={() => setRevokeTarget(t)} className="font-mono2 text-[10px] border border-[#F07A6A]/40 text-[#F07A6A] px-3 py-1.5 hover:bg-[#F07A6A]/10">Revoke</button>
              )}
            </div>
          ))}
        </div>
      </Card>
      {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
      {creating && (
        <Card className="p-5">
          <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">New token</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto] items-end">
            <label className="block">
              <span className="font-mono2 text-[10px] text-[--dark-muted] uppercase tracking-widest">Label</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="GitHub Actions · CI"
                className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm font-mono2 outline-none focus:border-white" />
            </label>
            <div>
              <span className="font-mono2 text-[10px] text-[--dark-muted] uppercase tracking-widest">Scope</span>
              <div className="flex gap-1 mt-1.5 font-mono2 text-xs">
                {(['ci:run', 'dev:run'] as const).map((s) => (
                  <button key={s} onClick={() => setScope(s)} className={`px-3 py-2 border ${scope === s ? 'border-white text-white' : 'border-[--dark-line] text-[--dark-muted]'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="font-mono2 text-[10px] text-[--dark-muted] uppercase tracking-widest">Expires</span>
              <select value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="mt-1.5 bg-[--dark] border border-[--dark-line] px-3 py-2 text-sm outline-none focus:border-white">
                <option value={0}>Never</option>
                <option value={30}>In 30 days</option>
                <option value={90}>In 90 days</option>
                <option value={365}>In 1 year</option>
              </select>
            </div>
            <button onClick={create} className="font-mono2 text-[10px] border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark]">Create</button>
          </div>
          <label className="block mt-4 max-w-xl">
            <span className="font-mono2 text-[10px] text-[--dark-muted] uppercase tracking-widest">
              Restrict to IP ranges <span className="normal-case tracking-normal">(optional)</span>
            </span>
            <input value={ipAllowlist} onChange={(e) => setIpAllowlist(e.target.value)}
              placeholder="203.0.113.0/24, 198.51.100.7"
              className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm font-mono2 outline-none focus:border-white" />
            <span className="mt-1.5 block font-mono2 text-[10px] text-[--dark-muted]">
              Comma-separated addresses or CIDR ranges. Leave empty to allow any address — a leaked
              token is far less useful when it only works from your CI's egress range.
            </span>
          </label>
        </Card>
      )}
      {created && (
        <Card className="p-5 border-[#E8B44C]/50">
          <p className="font-mono2 text-[11px] uppercase tracking-widest text-[#E8B44C]">New token — visible only now</p>
          <div className="mt-3 flex items-stretch gap-2">
            <p className="flex-1 font-mono2 text-sm bg-black/40 border border-[--dark-line] p-3 select-all break-all">{created.token}</p>
            <CopyButton value={created.token} className="shrink-0" />
          </div>
          <p className="text-xs text-[--dark-muted] mt-2">Copy this token into your CI secret. For security reasons we never show it again.</p>
          <button onClick={() => setCreated(null)} className="mt-3 font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">Got it</button>
        </Card>
      )}
      {revokeTarget && (
        <ConfirmDialog
          title={`Revoke "${revokeTarget.label}"?`}
          body={
            revokeTarget.usage && revokeTarget.usage.some((n) => n > 0)
              ? `This token has run ${revokeTarget.runsTotal} environment${revokeTarget.runsTotal === 1 ? '' : 's'} in the last 14 days — it looks active. Anything using it (a CI pipeline, a script) will start failing immediately. This can't be undone; you'd need to create a new token and update wherever this one is configured.`
              : "Anything using it will start failing immediately. This can't be undone; you'd need to create a new token and update wherever this one is configured."
          }
          confirmLabel="Revoke token"
          busy={revoking}
          onCancel={() => setRevokeTarget(null)}
          onConfirm={() => revoke(revokeTarget.id)}
        />
      )}
    </div>
  );
}

/* ---------- Billing: real data ---------- */

// The catalogue itself lives in lib/plans.ts — one copy, shared with the
// pricing page. Everything except Evaluation is offered here: a team already
// looking at this card has a plan, and "downgrade to the trial" is not a thing
// checkout can do.
const TIER_CARDS = PURCHASABLE_PLANS;

/** Refer-a-team card: shareable link + how many referrals are pending vs.
 *  rewarded with a free month. Lives in the billing view. */
function ReferralCard() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api<ReferralInfo>('/teams/me/referral').then(setInfo).catch(() => {}); }, []);
  if (!info) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(info.shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* noop */ }
  };
  return (
    <Card className="p-6 accent-top">
      <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Refer a team · earn a free month</p>
      <p className="text-sm text-[--dark-muted] mt-2 max-w-[54ch]">
        Share your link. When a team signs up with it and upgrades to a paid plan,
        <span className="text-white"> you both get one month free</span> — applied automatically to your next invoice.
      </p>
      <div className="mt-4 flex items-stretch gap-2">
        <p className="flex-1 font-mono2 text-xs bg-black/40 border border-[--dark-line] p-3 select-all break-all">{info.shareUrl}</p>
        <button onClick={copy} className={`font-mono2 text-[10px] border px-3 shrink-0 ${copied ? 'border-[#57C99A] text-[#57C99A]' : 'border-[--dark-line] text-[--dark-muted] hover:border-white hover:text-white'}`}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>
      <div className="mt-4 flex gap-6 font-mono2 text-xs">
        <span className="text-[--dark-muted]">Pending <span className="text-white font-doto text-lg ml-1">{info.pending}</span></span>
        <span className="text-[--dark-muted]">Rewarded <span className="text-[#57C99A] font-doto text-lg ml-1">{info.rewarded}</span></span>
      </div>
    </Card>
  );
}

function Billing() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [invoices, setInvoices] = useState<InvoiceInfo[] | null>(null);
  const [yearly, setYearly] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [params, setParams] = useSearchParams();
  const checkoutResult = params.get('checkout');
  const { refresh } = useAuth();

  useEffect(() => {
    api<SubscriptionInfo>('/billing/subscription').then(setSub).catch((e) => {
      setErr(e instanceof ApiError && e.status === 403 ? 'Billing is only visible to owners and admins.' : 'Could not load billing data.');
    });
    api<{ invoices: InvoiceInfo[] }>('/billing/invoices').then((d) => setInvoices(d.invoices)).catch(() => setInvoices([]));
  }, [checkoutResult]);

  // After returning from Stripe Checkout, the webhook may lag a moment — refresh team state.
  useEffect(() => {
    if (checkoutResult === 'success') void refresh();
  }, [checkoutResult, refresh]);

  const checkout = async (tier: PurchasableTier) => {
    setBusy(tier);
    setErr('');
    try {
      const { url } = await api<{ url: string }>('/billing/checkout', { body: { tier, interval: yearly ? 'yearly' : 'monthly' } });
      window.location.href = url;
    } catch (e) {
      // "is Stripe configured?" was the answer to every failure, which stopped
      // being true when checkout started refusing retired and sales-led tiers.
      // Telling someone to check a Stripe key because they picked a plan we no
      // longer sell sends them looking in the wrong place entirely.
      if (e instanceof ApiError && e.status === 410) {
        setErr('That plan is no longer offered. Reload the page for the current ones.');
      } else if (e instanceof ApiError && e.status === 409) {
        setErr('That plan is set up together with us rather than bought online — send an enquiry below.');
      } else {
        setErr('Checkout could not be started — is Stripe configured?');
      }
      setBusy('');
    }
  };

  const openPortal = async () => {
    setBusy('portal');
    setErr('');
    try {
      const { url } = await api<{ url: string }>('/billing/portal', { method: 'POST', body: {} });
      window.location.href = url;
    } catch {
      setErr('Customer portal could not be opened.');
      setBusy('');
    }
  };

  if (err && !sub) return <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>;
  if (!sub) return <p className="font-mono2 text-xs text-[--dark-muted]">Loading …</p>;

  const isPaid = sub.planTier !== 'free';

  return (
    <div className="grid gap-5">
      {checkoutResult === 'success' && (
        <Card className="p-4 border-[#57C99A]/50">
          <p className="text-sm text-[#57C99A]">✓ Subscription active — thanks! It may take a few seconds until the new plan shows up.</p>
          <button onClick={() => setParams({}, { replace: true })} className="mt-2 font-mono2 text-[10px] text-[--dark-muted] hover:text-white">Dismiss</button>
        </Card>
      )}
      <ReferralCard />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-5">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Current plan</p>
                <p className="font-doto text-5xl mt-2">{sub.planLabel}<span className="text-[--red]">●</span></p>
                <p className="text-sm text-[--dark-muted] mt-2">
                  {sub.parallelEnvironments} parallel environment{sub.parallelEnvironments === 1 ? '' : 's'}
                  {/* The total, not the base. Showing CHF 190 to a team of
                      twelve paying CHF 365 is the number they would compare
                      against the invoice — and then open a ticket about. */}
                  {isPaid && sub.chfTotalMonthly !== null && ` · CHF ${sub.chfTotalMonthly} / month`}
                  {isPaid && sub.chfTotalMonthly === null && ' · Priced to your setup'}
                  {isPaid && sub.subscription?.currentPeriodEnd && ` · Renews on ${fmtDate(sub.subscription.currentPeriodEnd)}`}
                  {!isPaid && sub.trialEndsAt && ` · Trial ends ${fmtDate(sub.trialEndsAt)}`}
                </p>
                <p className="font-mono2 text-[11px] text-[--dark-muted] mt-1">
                  up to {sub.vcpuPerEnvironment} vCPU / {sub.ramGbPerEnvironment} GB per environment · max {sub.maxFootprintGb} GB total
                </p>
                {/* Where the total comes from. A seat-priced invoice that
                    changes when someone joins needs its arithmetic visible, or
                    the next headcount change reads as an unexplained increase. */}
                {isPaid && sub.chfPerSeatMonthly > 0 && (
                  <p className="font-mono2 text-[11px] text-[--dark-muted] mt-1">
                    CHF {sub.chfMonthly} base ({sub.includedSeats} developers included)
                    {sub.billableSeats > 0
                      ? ` + ${sub.billableSeats} × CHF ${sub.chfPerSeatMonthly} · ${sub.seats} in the team`
                      : ` · ${sub.seats} of ${sub.includedSeats} included seats used`}
                  </p>
                )}
                {/* The seat cap is the wall a growing team hits, and it is
                    worth seeing before the invite fails rather than after. */}
                {sub.maxSeats !== null && sub.seats >= sub.maxSeats && (
                  <p className="font-mono2 text-[11px] text-[#E8B44C] mt-2">
                    You are at the {sub.maxSeats}-seat limit of this plan. Larger teams are set up with us — <a href="#enterprise-enquiry" className="underline">get in touch</a>.
                  </p>
                )}
                {sub.subscription && sub.subscription.status !== 'active' && (
                  <p className="font-mono2 text-[11px] text-[#E8B44C] mt-2">Status: {sub.subscription.status}</p>
                )}
              </div>
              {sub.hasStripeCustomer && (
                <button onClick={openPortal} disabled={busy === 'portal'} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white shrink-0 disabled:opacity-50">
                  {busy === 'portal' ? '…' : 'Manage plan'}
                </button>
              )}
            </div>
            <p className="text-xs text-[--dark-muted] mt-4">Plan changes, cancellation and payment methods are handled in the Stripe customer portal.</p>
          </Card>
          <Card>
            <CardHead title="Invoices" />
            <div className="divide-y divide-[--dark-line]">
              {invoices === null && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">Loading …</p>}
              {/* "No invoices yet." was technically true and told nobody
                  anything — it reads like something is missing. The three
                  cases are genuinely different, and hasStripeCustomer
                  distinguishes them without guessing: never subscribed, versus
                  subscribed but not yet through a billing period. */}
              {invoices?.length === 0 && (
                <div className="px-5 py-4 font-mono2 text-xs text-[--dark-muted] space-y-1">
                  {!sub.hasStripeCustomer ? (
                    <>
                      <p className="text-[--dark-text]">Nothing billed yet.</p>
                      <p>
                        {isPaid
                          ? 'Invoices appear here once the first payment goes through.'
                          : "You're on the free trial — no card, no charge. Invoices appear here after you choose a plan."}
                      </p>
                    </>
                  ) : sub.subscription?.currentPeriodEnd ? (
                    <>
                      <p className="text-[--dark-text]">No invoices yet.</p>
                      <p>The first one is issued on {fmtDate(sub.subscription.currentPeriodEnd)}, when the current billing period ends.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[--dark-text]">No invoices yet.</p>
                      <p>They appear here at the end of each billing period, with a PDF to download.</p>
                    </>
                  )}
                </div>
              )}
              {invoices?.map((i) => (
                <div key={i.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 font-mono2 text-xs">
                  <span>{i.number ?? i.id}</span>
                  <span className="text-[--dark-muted]">{fmtDate(i.created)}</span>
                  <span>{i.currency} {i.amount.toFixed(2)}</span>
                  {i.pdfUrl
                    ? <a href={i.pdfUrl} target="_blank" rel="noreferrer" className="text-[#57C99A] hover:underline">{i.status} · PDF ↓</a>
                    : <span className="text-[--dark-muted]">{i.status}</span>}
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHead title={isPaid ? 'Change plan' : 'Upgrade'} right={
            <div className="flex gap-1 font-mono2 text-[10px]">
              <button onClick={() => setYearly(false)} className={`px-2 py-1 border ${!yearly ? 'border-white text-white' : 'border-[--dark-line] text-[--dark-muted]'}`}>Monthly</button>
              <button onClick={() => setYearly(true)} className={`px-2 py-1 border ${yearly ? 'border-white text-white' : 'border-[--dark-line] text-[--dark-muted]'}`}>Yearly −17 %</button>
            </div>
          } />
          <div className="divide-y divide-[--dark-line]">
            {TIER_CARDS.map((t) => {
              // A sales-led tier has no price to show and no checkout to open:
              // POST /billing/checkout answers 409 contact_sales for it. Giving
              // it a Choose button would be an offer the API refuses.
              const base = t.chf === null ? null : (yearly ? Math.round(t.chf * YEARLY_FACTOR) : t.chf);
              const seatPrice = t.chfPerSeat === 0 ? null
                : (yearly ? Math.round(t.chfPerSeat * YEARLY_FACTOR) : t.chfPerSeat);
              return (
                <div key={t.tier} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="font-mono2 text-[11px] text-[--dark-muted]">
                      {t.envs} environments · {t.vcpu} vCPU / {t.ramGb} GB each
                    </p>
                    <p className="font-mono2 text-[11px] text-[--dark-muted] mt-0.5">
                      {base === null
                        ? 'Priced to your setup'
                        : <>
                            CHF {base}/mo{seatPrice !== null && <> · {t.includedSeats} developers included, then CHF {seatPrice} each</>}
                            {yearly ? ' (billed yearly)' : ''}
                          </>}
                    </p>
                  </div>
                  {sub.planTier === t.tier ? (
                    <span className="font-mono2 text-[10px] border border-[#57C99A]/50 text-[#57C99A] px-3 py-1.5 shrink-0">Current</span>
                  ) : !t.selfServe ? (
                    <a href="#enterprise-enquiry" className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white shrink-0">Talk to us</a>
                  ) : isPaid ? (
                    <button onClick={openPortal} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white shrink-0">Via portal</button>
                  ) : (
                    <button onClick={() => checkout(t.tier)} disabled={!!busy} className="font-mono2 text-[10px] border border-white px-3 py-1.5 hover:bg-white hover:text-[--dark] disabled:opacity-50 shrink-0">
                      {busy === t.tier ? '…' : 'Choose'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {err && <p className="px-5 py-3 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        </Card>
      </div>
      {/* The way out of the top self-serve plan. It lives on the billing page
          rather than behind a mailto: because the team that has just hit the
          seat cap is already here, and the moment they notice is the moment
          they are most likely to say something. scroll-mt keeps the sticky
          header off the form when the anchor above jumps here. */}
      <Card id="enterprise-enquiry" className="p-6 scroll-mt-24">
        <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Outgrown these plans?</p>
        <p className="text-sm text-[--dark-muted] mt-2 max-w-[62ch]">
          Larger teams, dedicated hardware, SSO, a signed DPA or a retention period of your own are
          set up together with us. Tell us what you need and we will come back with a concrete
          number.
        </p>
        <div className="mt-5 max-w-[38rem]">
          <EnterpriseEnquiry source="dashboard" compact tone="dark" />
        </div>
      </Card>
    </div>
  );
}

/* ---------- Team: real data ---------- */

/** Team security policy: require 2FA for everyone, with a compliance list so
 *  an owner can chase people rather than discovering the gap via a lockout. */
function TeamSecurityCard({ isOwner }: { isOwner: boolean }) {
  const [sec, setSec] = useState<TeamSecurity | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api<TeamSecurity>('/teams/me/security').then(setSec).catch(() => setSec(null));
  }, []);
  useEffect(load, [load]);

  const toggle = async () => {
    if (!sec) return;
    setBusy(true); setErr(''); setNotice('');
    try {
      const res = await api<{ requireTwoFactor: boolean; notified: number }>(
        '/teams/me/security', { method: 'PATCH', body: { requireTwoFactor: !sec.requireTwoFactor } },
      );
      // Say who was mailed. Turning this on locks people out mid-task, so the
      // owner should know it wasn't done silently — and how many people are
      // now expecting to act on it.
      setNotice(res.requireTwoFactor
        ? res.notified > 0
          ? `Two-factor is now required. ${res.notified} member${res.notified === 1 ? '' : 's'} without it ${res.notified === 1 ? 'was' : 'were'} emailed instructions.`
          : 'Two-factor is now required. Everyone on the team already has it.'
        : 'Two-factor is optional again.');
      load();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'enable_own_2fa_first'
        ? 'Set up two-factor on your own account first — otherwise you would lock yourself out of this team.'
        : e instanceof Error ? e.message : 'Could not change the policy.');
    } finally { setBusy(false); }
  };

  if (!sec) return null;

  return (
    <Card>
      <CardHead title="Security policy" right={
        <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${
          sec.requireTwoFactor ? 'border-[#57C99A]/40 text-[#57C99A]' : 'border-[--dark-line] text-[--dark-muted]'
        }`}>
          2FA {sec.requireTwoFactor ? 'required' : 'optional'}
        </span>
      } />
      <div className="p-5 grid gap-4">
        <p className="text-sm text-[--dark-muted] max-w-[70ch]">
          {sec.requireTwoFactor
            ? 'Members without two-factor authentication cannot access this team\'s environments or tokens. They can still sign in and enrol from their profile.'
            : 'Two-factor authentication is currently optional for members. Requiring it blocks access to this team until each member enrols.'}
        </p>

        {sec.withoutTwoFactor > 0 && (
          <div className={`border p-4 ${sec.requireTwoFactor ? 'border-[#F07A6A]/40' : 'border-[#E8B44C]/40'}`}>
            <p className={`font-mono2 text-[10px] uppercase tracking-widest ${sec.requireTwoFactor ? 'text-[#F07A6A]' : 'text-[#E8B44C]'}`}>
              {sec.withoutTwoFactor} member{sec.withoutTwoFactor === 1 ? '' : 's'} without two-factor
            </p>
            <ul className="mt-2 grid gap-1">
              {sec.members.filter((m) => !m.twoFactorEnabled).map((m) => (
                <li key={m.email} className="font-mono2 text-[11px] text-[--dark-muted] break-all">{m.email}</li>
              ))}
            </ul>
            {sec.requireTwoFactor && (
              <p className="mt-2 text-xs text-[--dark-muted]">They currently have no access to this team.</p>
            )}
          </div>
        )}

        {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        {notice && <p className="font-mono2 text-xs text-[#57C99A]">{notice}</p>}
        {isOwner && !sec.requireTwoFactor && sec.withoutTwoFactor > 0 && (
          <p className="font-mono2 text-[11px] text-[--dark-muted] max-w-[70ch]">
            Turning this on takes effect immediately. The {sec.withoutTwoFactor} member{sec.withoutTwoFactor === 1 ? '' : 's'} above
            will be emailed instructions and will be asked to enrol the next time they open the dashboard.
          </p>
        )}
        {isOwner ? (
          <button onClick={toggle} disabled={busy}
            className={`font-mono2 text-[10px] uppercase tracking-widest px-4 py-2.5 justify-self-start disabled:opacity-30 ${
              sec.requireTwoFactor
                ? 'border border-[--dark-line] hover:border-white'
                : 'border border-white hover:bg-white hover:text-[--dark]'
            }`}>
            {busy ? 'Saving…' : sec.requireTwoFactor ? 'Make two-factor optional' : 'Require two-factor for everyone'}
          </button>
        ) : (
          <p className="font-mono2 text-[10px] text-[--dark-muted]">Only the team owner can change this.</p>
        )}
      </div>
    </Card>
  );
}

/** Filterable, exportable team audit trail. */
/** Shown instead of the trail on plans that don't include it. Deliberately says
 *  that recording continues — a customer who upgrades later gets their real
 *  history, and someone weighing the upgrade should know that rather than
 *  assume the log starts empty on the day they pay. */
function AuditLogLocked() {
  return (
    <Card>
      {/* The audit log moved down to Team in migration 043, so this card is now
          only ever shown to an evaluation team. Naming Scale here would point
          someone at a tier three times the price of the one that has it. */}
      <CardHead title="Activity log" right={
        <span className="font-mono2 text-[10px] uppercase tracking-wider border border-[#E8B44C]/40 text-[#E8B44C] px-2 py-0.5">Team</span>
      } />
      <div className="p-5">
        <p className="text-sm text-[--dark-muted] max-w-[70ch]">
          Every token, member and settings change on this team is already being recorded — reading and
          exporting that trail is included from the Team plan. Upgrading opens the full history, not
          just what happens afterwards.
        </p>
      </div>
    </Card>
  );
}

function AuditLogCard() {
  // Collapsed by default, and it fetches nothing until opened: the log is
  // consulted occasionally and reviewed rarely, but expanded it pushed
  // everything below it off the screen — and cost two API calls on every
  // visit to a page nobody opened it on.
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<AuditPage | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 25;

  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (action) p.set('action', action);
    if (actor.trim()) p.set('actor', actor.trim());
    if (from) p.set('from', from);
    // A date input means "that whole day"; the API's `to` is exclusive.
    if (to) p.set('to', new Date(new Date(to).getTime() + 86_400_000).toISOString().slice(0, 10));
    return p;
  }, [action, actor, from, to]);

  const load = useCallback(() => {
    if (!open) return;
    const p = params();
    p.set('limit', String(LIMIT));
    p.set('offset', String(offset));
    api<AuditPage>(`/teams/me/audit?${p}`).then(setPage).catch(() => setPage(null));
  }, [params, offset, open]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!open) return;
    api<{ actions: string[] }>('/teams/me/audit/actions').then((d) => setActions(d.actions)).catch(() => {});
  }, [open]);

  const exportAs = async (format: 'csv' | 'json') => {
    const p = params();
    p.set('format', format);
    const res = await fetch(`${API_URL}/teams/me/audit/export?${p}`, { credentials: 'include' });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devplat-audit-${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const reset = () => { setAction(''); setActor(''); setFrom(''); setTo(''); setOffset(0); };
  const filtered = !!(action || actor || from || to);
  const inputCls = 'bg-transparent border border-[--dark-line] px-2.5 py-1.5 text-xs outline-none focus:border-white';

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[--dark-line]">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted] hover:text-white transition-colors"
        >
          <span className={`text-[9px] transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>▶</span>
          Activity log
        </button>
        {open && (
          <span className="flex items-center gap-2">
            <button onClick={() => exportAs('csv')} className="font-mono2 text-[10px] border border-[--dark-line] px-2.5 py-1 hover:border-white">CSV</button>
            <button onClick={() => exportAs('json')} className="font-mono2 text-[10px] border border-[--dark-line] px-2.5 py-1 hover:border-white">JSON</button>
          </span>
        )}
      </div>
      {!open ? null : (
      <>
      <div className="px-5 py-3 border-b border-[--dark-line] flex flex-wrap items-end gap-2">
        <label className="grid gap-1">
          <span className="font-mono2 text-[9px] uppercase tracking-widest text-[--dark-muted]">Action</span>
          <select value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }} className={`${inputCls} bg-[--dark]`}>
            <option value="">All</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-mono2 text-[9px] uppercase tracking-widest text-[--dark-muted]">Actor</span>
          <input value={actor} onChange={(e) => { setActor(e.target.value); setOffset(0); }} placeholder="email or domain" className={`${inputCls} w-40`} />
        </label>
        <label className="grid gap-1">
          <span className="font-mono2 text-[9px] uppercase tracking-widest text-[--dark-muted]">From</span>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} className={inputCls} />
        </label>
        <label className="grid gap-1">
          <span className="font-mono2 text-[9px] uppercase tracking-widest text-[--dark-muted]">To</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0); }} className={inputCls} />
        </label>
        {filtered && (
          <button onClick={reset} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white px-2 py-1.5">Clear</button>
        )}
        {page && (
          <span className="ml-auto font-mono2 text-[10px] text-[--dark-muted]">
            {page.total} entr{page.total === 1 ? 'y' : 'ies'}
          </span>
        )}
      </div>

      {page === null ? (
        <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">Loading …</p>
      ) : page.entries.length === 0 ? (
        <p className="px-5 py-6 font-mono2 text-xs text-[--dark-muted]">
          {filtered ? 'No entries match these filters.' : 'No activity recorded yet.'}
        </p>
      ) : (
        <AuditList entries={page.entries} />
      )}

      {page && page.total > LIMIT && (
        <div className="px-5 py-3 border-t border-[--dark-line] flex items-center justify-between font-mono2 text-[10px]">
          <button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}
            className="text-[--dark-muted] hover:text-white disabled:opacity-30">← Newer</button>
          <span className="text-[--dark-muted]">{offset + 1}–{Math.min(offset + LIMIT, page.total)} of {page.total}</span>
          <button onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= page.total}
            className="text-[--dark-muted] hover:text-white disabled:opacity-30">Older →</button>
        </div>
      )}
      </>
      )}
    </Card>
  );
}

type TeamMember = TeamInfo['members'][number];

function Team() {
  const [info, setInfo] = useState<TeamInfo | null>(null);
  const [inviteMail, setInviteMail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'admin'>('developer');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [transferTo, setTransferTo] = useState<TeamMember | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const { me, refresh } = useAuth();
  const navigate = useNavigate();
  const myUserId = me?.user.id;

  const load = useCallback(() => {
    api<TeamInfo>('/teams/me').then(setInfo).catch(() => setErr('Could not load team.'));
  }, []);
  useEffect(load, [load]);

  const canManage = info && info.team.myRole !== 'developer';
  const isOwner = info?.team.myRole === 'owner';

  const removeMember = async (m: TeamMember) => {
    setBusy(true); setErr(''); setMsg('');
    try {
      await api(`/teams/me/members/${m.userId}`, { method: 'DELETE' });
      setMsg(`${m.email} was removed from the team.`);
      setRemoveTarget(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not remove this member.');
    } finally { setBusy(false); }
  };

  const transferOwnership = async (m: TeamMember) => {
    setBusy(true); setErr(''); setMsg('');
    try {
      await api('/teams/me/transfer-ownership', { body: { userId: m.userId } });
      setMsg(`${m.email} is now the owner. You remain an admin.`);
      setTransferTo(null);
      await refresh();
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not transfer ownership.');
    } finally { setBusy(false); }
  };

  const revokeInvite = async (id: string, email: string) => {
    setErr(''); setMsg('');
    try {
      await api(`/teams/me/invites/${id}`, { method: 'DELETE' });
      setMsg(`Invitation to ${email} withdrawn.`);
      load();
    } catch {
      setErr('Could not withdraw that invitation.');
    }
  };

  const leaveTeam = async () => {
    setBusy(true); setErr('');
    try {
      await api('/teams/me/leave', { method: 'POST' });
      await refresh();
      navigate('/app');
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'owner_cannot_leave'
        ? 'You own this team — hand ownership to someone else first, or delete the team under Settings.'
        : e instanceof Error ? e.message : 'Could not leave the team.');
      setLeaving(false);
    } finally { setBusy(false); }
  };

  const invite = async () => {
    setErr('');
    setMsg('');
    if (!inviteMail.includes('@')) { setErr('Please enter a valid email address.'); return; }
    try {
      const res = await api<{ seatCost: { chfPerSeatMonthly: number; billableAfterAccept: number } | null }>(
        '/teams/me/invites', { body: { email: inviteMail, role: inviteRole } },
      );
      // Say what it costs, at the moment it is decided. On a seat-priced plan
      // the sixth developer adds to the invoice, and a charge whose first
      // appearance is a statement arrives as a support thread rather than as
      // revenue. Stated as a fact, not asked as a confirmation — the invite is
      // already sent, and an owner adding a colleague is doing what we want.
      const cost = res.seatCost;
      setMsg(cost && cost.billableAfterAccept > 0
        ? `Invitation sent to ${inviteMail}. Once accepted, your plan bills ${cost.billableAfterAccept} seat${cost.billableAfterAccept === 1 ? '' : 's'} beyond the included ones — CHF ${cost.billableAfterAccept * cost.chfPerSeatMonthly}/month, prorated from the day they join.`
        : `Invitation sent to ${inviteMail}.`);
      setInviteMail('');
      setInviting(false);
      load();
    } catch (e) {
      setErr(
        e instanceof ApiError && e.code === 'already_member' ? 'This person is already on the team.'
          // The API explains the cap and what to do about it.
          : e instanceof ApiError && e.code === 'seat_limit_reached' ? e.message
            : 'Invitation could not be sent.',
      );
    }
  };

  if (err && !info) return <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>;
  if (!info) return <p className="font-mono2 text-xs text-[--dark-muted]">Loading …</p>;

  // The server is still the authority (seatLimitError); these only decide what
  // the UI offers, so nobody is invited to fill in a form that cannot succeed.
  const seatCap = info.team.maxMembers;
  const seatsLeft = seatCap === null ? Infinity : Math.max(seatCap - info.team.seatsUsed, 0);
  const singleSeatPlan = seatCap === 1;
  const goBilling = () => navigate('/app/billing');

  return (
    <div className="grid gap-5 max-w-4xl">
      <div className="grid gap-5">
        <Card>
          <CardHead
            title={`Members (${info.members.length}${seatCap ? ` / ${seatCap}` : ''})`}
            right={
              !canManage ? undefined
                : seatsLeft === 0
                  // Offering a form whose only possible outcome is an error is
                  // worse than not offering it: the seat cap is a property of
                  // the plan, so the honest control is the one that fixes it.
                  ? (
                    <button onClick={() => goBilling()} className="font-mono2 text-[10px] border border-[#E8B44C]/50 text-[#E8B44C] px-3 py-1.5 hover:border-[#E8B44C]">
                      {singleSeatPlan ? 'Upgrade to invite' : 'No seats left — upgrade'}
                    </button>
                  )
                  : <button onClick={() => setInviting((v) => !v)} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">+ Invite</button>
            }
          />
          {canManage && seatsLeft === 0 && (
            <p className="px-5 py-3 border-b border-[--dark-line] font-mono2 text-[11px] text-[--dark-muted] leading-relaxed">
              {singleSeatPlan
                ? `${info.team.planLabel} is a single-seat plan — it covers you alone. Team (up to ${TEAM_MAX_SEATS} seats) and Enterprise (unlimited) can invite people.`
                : `All ${seatCap} seats on ${info.team.planLabel} are taken (${info.members.length} member${info.members.length === 1 ? '' : 's'}, ${info.pendingInvites.length} pending invite${info.pendingInvites.length === 1 ? '' : 's'}). Remove someone, revoke an invite, or move up a plan.`}
            </p>
          )}
          <div className="divide-y divide-[--dark-line]">
            {info.members.map((m) => {
              const isSelf = m.userId === myUserId;
              return (
                <div key={m.userId} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-doto w-9 h-9 grid place-items-center border border-[--dark-line] text-sm shrink-0">{m.email.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.email}{isSelf && <span className="ml-2 font-mono2 text-[10px] text-[--dark-muted]">you</span>}
                      </p>
                      <p className="font-mono2 text-[11px] text-[--dark-muted]">joined {fmtDate(m.joinedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${m.role === 'owner' ? 'border-[--red] text-[--red]' : 'border-[--dark-line] text-[--dark-muted]'}`}>{m.role}</span>
                    {/* Owner hands over the role; the outgoing owner stays as admin. */}
                    {isOwner && !isSelf && (
                      <button onClick={() => setTransferTo(m)}
                        className="font-mono2 text-[10px] uppercase tracking-wider text-[--dark-muted] hover:text-white border border-transparent hover:border-[--dark-line] px-2 py-1">
                        Make owner
                      </button>
                    )}
                    {canManage && !isSelf && m.role !== 'owner' && (
                      <button onClick={() => setRemoveTarget(m)}
                        className="font-mono2 text-[10px] uppercase tracking-wider text-[#F07A6A]/80 hover:text-[#F07A6A] border border-transparent hover:border-[#F07A6A]/40 px-2 py-1">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        {inviting && (
          <Card className="p-5">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Invite member</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto] items-end">
              <label className="block">
                <span className="font-mono2 text-[10px] text-[--dark-muted] uppercase tracking-widest">Email</span>
                <input value={inviteMail} onChange={(e) => setInviteMail(e.target.value)} type="email" placeholder="colleague@yourcompany.com"
                  className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm font-mono2 outline-none focus:border-white" />
              </label>
              <div>
                <span className="font-mono2 text-[10px] text-[--dark-muted] uppercase tracking-widest">Role</span>
                <div className="flex gap-1 mt-1.5 font-mono2 text-xs">
                  {(['developer', 'admin'] as const).map((r) => (
                    <button key={r} onClick={() => setInviteRole(r)} className={`px-3 py-2 border ${inviteRole === r ? 'border-white text-white' : 'border-[--dark-line] text-[--dark-muted]'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <button onClick={invite} className="font-mono2 text-[10px] border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark]">Send invite</button>
            </div>
          </Card>
        )}
        {(msg || err) && <p className={`font-mono2 text-xs ${err ? 'text-[#F07A6A]' : 'text-[#57C99A]'}`}>{err || msg}</p>}
        {info.pendingInvites.length > 0 && (
          <Card>
            <CardHead title={`Pending invitations (${info.pendingInvites.length})`} />
            <div className="divide-y divide-[--dark-line]">
              {info.pendingInvites.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 font-mono2 text-xs">
                  <span className="truncate">{i.email}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-[--dark-muted]">{i.role} · expires {fmtDate(i.expiresAt)}</span>
                    {canManage && (
                      <button onClick={() => revokeInvite(i.id, i.email)}
                        className="text-[#F07A6A]/80 hover:text-[#F07A6A] uppercase tracking-wider">Revoke</button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {/* Leaving is self-service for everyone except the owner, who would
            orphan the team's billing — they transfer ownership or delete it. */}
        <Card className={isOwner ? '' : 'border-[#F07A6A]/40'}>
          <CardHead title="Leave this team" />
          <div className="p-5 grid gap-3 max-w-md">
            {isOwner ? (
              <p className="text-sm text-[--dark-muted]">
                You own <span className="text-[--dark-text]">{info.team.name}</span>, so you can't leave it directly.
                Make another member the owner above, then leave — or delete the team entirely under Settings.
              </p>
            ) : (
              <>
                <p className="text-sm text-[--dark-muted]">
                  You'll lose access to <span className="text-[--dark-text]">{info.team.name}</span>, its environments and its tokens.
                  An admin can invite you back later.
                </p>
                {!leaving ? (
                  <button onClick={() => { setLeaving(true); setErr(''); }}
                    className="font-mono2 text-[10px] uppercase tracking-widest border border-[#F07A6A]/40 text-[#F07A6A] px-4 py-2.5 hover:bg-[#F07A6A]/10 justify-self-start">
                    Leave team
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={leaveTeam} disabled={busy}
                      className="font-mono2 text-[10px] uppercase tracking-widest bg-[--red] text-white px-4 py-2.5 disabled:opacity-30">
                      {busy ? 'Leaving…' : 'Yes, leave the team'}
                    </button>
                    <button onClick={() => setLeaving(false)}
                      className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white px-3">Cancel</button>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {removeTarget && (
        <ConfirmDialog
          title={`Remove ${removeTarget.email}?`}
          body="They lose access to this team's environments and tokens immediately. You can invite them again later."
          confirmLabel="Remove member"
          busy={busy}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => removeMember(removeTarget)}
        />
      )}

      {transferTo && (
        <ConfirmDialog
          title={`Make ${transferTo.email} the owner?`}
          body="They take over ownership and billing responsibility for this team. You stay on as an admin — this cannot be undone by you afterwards, only by the new owner."
          confirmLabel="Transfer ownership"
          busy={busy}
          onCancel={() => setTransferTo(null)}
          onConfirm={() => transferOwnership(transferTo)}
        />
      )}
    </div>
  );
}

/** Small modal for destructive-but-not-typed-confirmation actions. */
function ConfirmDialog({ title, body, confirmLabel, busy, onCancel, onConfirm }: {
  title: string; body: string; confirmLabel: string; busy: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-5" onClick={onCancel}>
      <div className="bg-[--dark-card] border border-[--dark-line] max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg break-all">{title}</h3>
        <p className="mt-2 text-sm text-[--dark-muted]">{body}</p>
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onCancel} className="font-mono2 text-xs text-[--dark-muted] hover:text-white px-3 py-2">Cancel</button>
          <button onClick={onConfirm} disabled={busy}
            className="font-mono2 text-xs px-4 py-2 bg-[--red] text-white disabled:opacity-30">
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteTeamCard({ teamName }: { teamName: string }) {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ready = confirmText.trim().toLowerCase() === 'delete';

  const handleDelete = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr('');
    try {
      await api('/teams/me', { method: 'DELETE' });
      await refresh();
      navigate('/');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed.');
      setBusy(false);
    }
  };

  return (
    <Card className="border-[--red]/40">
      <CardHead title="Danger zone" />
      <div className="p-5">
        <h3 className="font-semibold text-sm text-[--red]">Delete "{teamName}"</h3>
        <p className="mt-2 text-sm text-[--dark-muted] max-w-[60ch]">
          Permanently deletes the team, cancels any active subscription, and removes every member's
          account (unless they also belong to another team). This cannot be undone.
        </p>
        {!open ? (
          <button onClick={() => setOpen(true)} className="mt-4 font-mono2 text-[10px] border border-[--red]/60 text-[--red] px-4 py-2.5 hover:bg-[--red] hover:text-white">
            Delete team…
          </button>
        ) : (
          <div className="mt-4 border border-[--red]/40 bg-black/20 p-4 max-w-sm">
            <label className="block">
              <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Type "delete" to confirm</span>
              <input
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm font-mono2 focus:outline-none focus:border-[--red]"
                placeholder="delete"
              />
            </label>
            {err && <p className="mt-3 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
            <div className="mt-4 flex gap-3 justify-end">
              <button onClick={() => { setOpen(false); setConfirmText(''); setErr(''); }} className="font-mono2 text-xs text-[--dark-muted] hover:text-white px-3 py-2">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={!ready || busy}
                className="font-mono2 text-xs px-4 py-2 bg-[--red] text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {busy ? 'Deleting…' : 'Delete team'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * How long an environment lives before the reaper takes it.
 *
 * The value was a single hardcoded hour for everyone: too generous for a free
 * trial, where an abandoned session parks a slot, and too short for a long
 * integration suite on a paid plan — with no way to say so. Entry tiers stay
 * fixed (default == max, which is how "not configurable" is expressed), so
 * this card explains the ceiling rather than offering a control that would be
 * refused.
 */
function EnvironmentTtlCard() {
  const [info, setInfo] = useState<TeamInfo | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<TeamInfo>('/teams/me').then((t) => { setInfo(t); setValue(t.team.ttlMinutes); }).catch(() => setInfo(null));
  }, []);
  useEffect(load, [load]);

  if (!info) return null;
  const { ttlDefaultMinutes: def, ttlMaxMinutes: max, planLabel } = info.team;
  const configurable = max > def;

  const save = async (minutes: number | null) => {
    setBusy(true); setErr(''); setMsg('');
    try {
      await api('/teams/me', { method: 'PATCH', body: { environmentTtlMinutes: minutes } });
      setMsg(minutes === null ? `Reset to the ${planLabel} default of ${def} minutes.` : `Saved — environments now run up to ${minutes} minutes.`);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
    } finally { setBusy(false); }
  };

  // Offer the plan default plus round steps up to the ceiling, so the choice
  // is a short list of sensible values rather than a free-text minute field.
  const options = Array.from(new Set([def, ...[30, 40, 60, 90, 120].filter((n) => n <= max && n >= 15)]))
    .sort((a, b) => a - b);

  return (
    <Card>
      <CardHead title="Environment lifetime" right={
        <span className="font-mono2 text-[10px] uppercase tracking-wider border border-[--dark-line] px-2 py-0.5 text-[--dark-muted]">
          {info.team.ttlMinutes} min
        </span>
      } />
      <div className="p-5 grid gap-4">
        <p className="text-sm text-[--dark-muted] max-w-[70ch]">
          How long a microVM runs before it is torn down automatically, whatever the client is
          doing. This is a safety net against an abandoned session holding one of your{' '}
          {info.team.parallelLimit} parallel slot{info.team.parallelLimit === 1 ? '' : 's'} —
          a finished run releases its environment immediately either way.
        </p>

        {configurable ? (
          <>
            <div className="flex flex-wrap gap-2">
              {options.map((n) => (
                <button key={n} onClick={() => setValue(n)} disabled={busy}
                  className={`font-mono2 text-[11px] px-3 py-2 border transition-colors ${
                    value === n ? 'border-white text-white' : 'border-[--dark-line] text-[--dark-muted] hover:text-white'
                  }`}>
                  {n} min{n === def ? ' · default' : ''}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => save(value)} disabled={busy || value === info.team.ttlMinutes}
                className="font-mono2 text-[10px] uppercase tracking-widest border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[--dark-text]">
                {busy ? 'Saving…' : 'Save'}
              </button>
              {info.team.ttlMinutes !== def && (
                <button onClick={() => save(null)} disabled={busy}
                  className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white">
                  Reset to plan default ({def} min)
                </button>
              )}
              <span className="font-mono2 text-[10px] text-[--dark-muted]">
                {planLabel} allows up to {max} minutes.
              </span>
            </div>
          </>
        ) : (
          <p className="font-mono2 text-[11px] text-[--dark-muted]">
            {planLabel} runs a fixed {def}-minute lifetime. Team can raise it to 60 minutes and
            Enterprise to 120.
          </p>
        )}

        {msg && <p className="font-mono2 text-xs text-[#57C99A]">{msg}</p>}
        {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
      </div>
    </Card>
  );
}

const EVENT_BLURB: Record<string, string> = {
  'environment.assigned': 'A microVM booted and is ready',
  'environment.released': 'An environment was torn down',
  'environment.failed': 'A run could not get an environment',
  'environment.queued_at_limit': 'A run is waiting for a free slot',
};

function DeliveryRow({ d }: { d: WebhookDelivery }) {
  const tone = d.status === 'delivered' ? 'text-[#57C99A]' : d.status === 'failed' ? 'text-[#F07A6A]' : 'text-[#E8B44C]';
  return (
    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.6fr_110px_90px_120px] gap-3 items-center px-5 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-mono2 text-[11px] truncate">{d.eventType}</p>
        {(d.error || d.responseBody) && (
          <p className="font-mono2 text-[10px] text-[--dark-muted] truncate" title={d.error ?? d.responseBody ?? ''}>
            {d.error ?? d.responseBody}
          </p>
        )}
      </div>
      <span className={`font-mono2 text-[10px] uppercase tracking-wider ${tone}`}>{d.status}</span>
      <span className="font-mono2 text-[10px] text-[--dark-muted] hidden sm:block">
        {d.responseStatus ?? '—'}{d.attempts > 1 ? ` · ${d.attempts}×` : ''}
      </span>
      <span className="font-mono2 text-[10px] text-[--dark-muted] hidden sm:block">{fmtAgo(d.createdAt)}</span>
    </div>
  );
}

/**
 * Outgoing webhooks: endpoints plus the delivery log.
 *
 * The delivery log is the part that makes this trustworthy rather than
 * mysterious — an integration that silently stops working is worse than no
 * integration, and "we sent it, they answered 401" is the only answer that lets
 * a customer fix their own side.
 */
function WebhooksCard() {
  const [data, setData] = useState<WebhookEndpointList | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api<WebhookEndpointList>('/webhook-endpoints').then(setData).catch(() => setData(null));
  }, []);
  useEffect(load, [load]);

  const loadLog = useCallback(() => {
    api<{ deliveries: WebhookDelivery[] }>('/webhook-deliveries').then((d) => setDeliveries(d.deliveries)).catch(() => {});
  }, []);
  useEffect(() => { if (showLog) loadLog(); }, [showLog, loadLog]);

  const create = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const created = await api<WebhookEndpointWithSecret>('/webhook-endpoints', {
        method: 'POST',
        body: { url: url.trim(), description: description.trim() || undefined, events: picked },
      });
      setRevealed({ id: created.id, secret: created.secret });
      setAdding(false); setUrl(''); setDescription(''); setPicked([]);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add this endpoint.');
    } finally { setBusy(false); }
  };

  const rotate = async (id: string) => {
    setErr(''); setMsg('');
    try {
      const rotated = await api<WebhookEndpointWithSecret>(`/webhook-endpoints/${id}/rotate-secret`, { method: 'POST' });
      setRevealed({ id, secret: rotated.secret });
      load();
    } catch { setErr('Could not rotate the secret.'); }
  };

  const toggle = async (e: WebhookEndpoint) => {
    setErr(''); setMsg('');
    try {
      await api(`/webhook-endpoints/${e.id}`, { method: 'PATCH', body: { enabled: !e.enabled } });
      load();
    } catch { setErr('Could not update this endpoint.'); }
  };

  const sendTest = async (id: string) => {
    setErr(''); setMsg('');
    try {
      await api(`/webhook-endpoints/${id}/test`, { method: 'POST' });
      setMsg('Test event queued — it lands within a few seconds. Check the delivery log below.');
      setShowLog(true);
      setTimeout(loadLog, 6000);
    } catch { setErr('Could not queue a test event.'); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api(`/webhook-endpoints/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      load();
    } catch { setErr('Could not remove this endpoint.'); }
    finally { setBusy(false); }
  };

  const events = data?.availableEvents ?? [];

  return (
    <Card>
      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.url}
          body="Deliveries to this endpoint stop immediately and its history is removed. This cannot be undone."
          confirmLabel="Remove endpoint" busy={busy}
          onCancel={() => setDeleteTarget(null)} onConfirm={remove}
        />
      )}
      <CardHead title="Webhooks" right={
        <button onClick={() => { setAdding(!adding); setRevealed(null); setErr(''); }}
          className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">
          {adding ? 'Cancel' : '+ Add endpoint'}
        </button>
      } />

      <div className="px-5 pt-4">
        <p className="text-sm text-[--dark-muted] max-w-[70ch]">
          Get environment events in your own tooling — a Slack relay, a deploy bot, a status board —
          instead of polling the API. Every request carries a{' '}
          <span className="font-mono2 text-[--dark-text]">devplat-signature</span> header your
          receiver should verify.
        </p>
      </div>

      {adding && (
        <div className="px-5 py-4 grid gap-3 border-b border-[--dark-line] mt-4">
          <label className="block">
            <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Endpoint URL</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.example.com/devplat"
              className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm font-mono2 outline-none focus:border-white" />
          </label>
          <label className="block">
            <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Description (optional)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Slack #ci-alerts"
              className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm outline-none focus:border-white" />
          </label>
          <div>
            <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Events</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {events.map((ev) => (
                <button key={ev} type="button"
                  onClick={() => setPicked((p) => p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev])}
                  className={`text-left px-3 py-2 border transition-colors ${
                    picked.includes(ev) ? 'border-white' : 'border-[--dark-line] hover:border-[--dark-muted]'
                  }`}>
                  <span className="font-mono2 text-[11px] block">{ev}</span>
                  <span className="text-[11px] text-[--dark-muted]">{EVENT_BLURB[ev] ?? ''}</span>
                </button>
              ))}
            </div>
            <p className="font-mono2 text-[10px] text-[--dark-muted] mt-2">
              {picked.length === 0
                ? 'Nothing selected — you will receive every event, including ones added later.'
                : `${picked.length} selected.`}
            </p>
          </div>
          <div>
            <button onClick={create} disabled={busy || !url.trim()}
              className="font-mono2 text-[10px] uppercase tracking-widest border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[--dark-text]">
              {busy ? 'Adding…' : 'Add endpoint'}
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div className="mx-5 my-4 border border-[#57C99A]/40 bg-[#57C99A]/[0.06] p-4">
          <p className="font-mono2 text-[10px] uppercase tracking-widest text-[#57C99A]">Signing secret</p>
          <p className="text-sm mt-1.5 text-[--dark-muted]">
            Shown once. Store it wherever your receiver reads its config — you can rotate it later,
            but you cannot look it up again.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <code className="font-mono2 text-xs break-all flex-1">{revealed.secret}</code>
            <CopyButton value={revealed.secret} />
          </div>
        </div>
      )}

      <div className="divide-y divide-[--dark-line] mt-4">
        {data === null && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">Loading …</p>}
        {data?.endpoints.length === 0 && !adding && (
          <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">
            No endpoints yet — add one to get events pushed to your own tooling.
          </p>
        )}
        {data?.endpoints.map((e) => (
          <div key={e.id} className="px-5 py-4 grid gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono2 text-[12px] break-all">{e.url}</p>
                <p className="text-[11px] text-[--dark-muted] mt-0.5">
                  {e.description ? `${e.description} · ` : ''}
                  {e.events.length === 0 ? 'all events' : e.events.join(', ')}
                  {' · '}{e.secretHint}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-mono2 text-[9px] uppercase tracking-wider px-2 py-0.5 border ${
                  e.enabled ? 'border-[#57C99A]/30 text-[#57C99A]' : 'border-[#F07A6A]/40 text-[#F07A6A]'
                }`}>{e.enabled ? 'active' : 'disabled'}</span>
              </div>
            </div>

            {e.disabledReason && (
              <p className="font-mono2 text-[10px] text-[#F07A6A] max-w-[70ch]">{e.disabledReason}</p>
            )}
            <p className="font-mono2 text-[10px] text-[--dark-muted]">
              {e.lastSuccessAt ? `Last delivered ${fmtAgo(e.lastSuccessAt)}` : 'Never delivered'}
              {e.consecutiveFailures > 0 && ` · ${e.consecutiveFailures} failing in a row`}
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button onClick={() => sendTest(e.id)} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white">Send test</button>
              <button onClick={() => toggle(e)} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white">
                {e.enabled ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => rotate(e.id)} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white">Rotate secret</button>
              <button onClick={() => setDeleteTarget(e)} className="font-mono2 text-[10px] text-[#F07A6A] hover:text-white">Remove</button>
            </div>
          </div>
        ))}
      </div>

      {msg && <p className="px-5 pt-3 font-mono2 text-xs text-[#57C99A]">{msg}</p>}
      {err && <p className="px-5 pt-3 font-mono2 text-xs text-[#F07A6A]">{err}</p>}

      {data && data.endpoints.length > 0 && (
        <div className="border-t border-[--dark-line] mt-4">
          <button onClick={() => setShowLog(!showLog)}
            className="w-full px-5 py-3 flex items-center justify-between font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] hover:text-white">
            <span>Delivery log</span>
            <span>{showLog ? '−' : '+'}</span>
          </button>
          {showLog && (
            <div className="divide-y divide-[--dark-line] border-t border-[--dark-line]">
              {deliveries === null && <p className="px-5 py-3 font-mono2 text-xs text-[--dark-muted]">Loading …</p>}
              {deliveries?.length === 0 && <p className="px-5 py-3 font-mono2 text-xs text-[--dark-muted]">Nothing delivered yet.</p>}
              {deliveries?.slice(0, 20).map((d) => <DeliveryRow key={d.id} d={d} />)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Settings({ teamName, myRole, auditLog, onRenamed }: {
  teamName: string; myRole?: 'owner' | 'admin' | 'developer'; auditLog: boolean; onRenamed: () => void;
}) {
  const canManage = myRole === 'owner' || myRole === 'admin';
  const [name, setName] = useState(teamName);
  const [msg, setMsg] = useState('');
  const rename = async () => {
    setMsg('');
    try {
      await api('/teams/me', { method: 'PATCH', body: { name } });
      setMsg('Saved.');
      onRenamed();
    } catch {
      setMsg('Only owners and admins can rename the team.');
    }
  };
  return (
    <div className="grid gap-5 max-w-4xl">
      <Card>
        <CardHead title="Organization" />
        <div className="p-5 grid gap-4 sm:grid-cols-[1fr_auto] items-end text-sm">
          <label className="block">
            <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Team name</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm outline-none focus:border-white" />
          </label>
          <button onClick={rename} className="font-mono2 text-[10px] border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark]">Save</button>
          {msg && <p className="font-mono2 text-xs text-[--dark-muted] sm:col-span-2">{msg}</p>}
        </div>
      </Card>
      {canManage && <EnvironmentTtlCard />}
      {canManage && <WebhooksCard />}
      {/* Security policy and the audit trail are team *configuration*, so they
          belong here rather than on the Team page, which is about who is in
          the team. The audit log is collapsed: it is consulted occasionally
          and reviewed rarely, but expanded it pushed everything below it —
          including leaving the team — off the screen. */}
      {canManage && <TeamSecurityCard isOwner={myRole === 'owner'} />}
      {/* Reading the trail is a plan entitlement. The locked variant is shown
          rather than hiding the section: "this exists and needs a plan" is
          useful, silently missing is not — and it's also the honest answer,
          since activity keeps being recorded either way. */}
      {canManage && (auditLog ? <AuditLogCard /> : <AuditLogLocked />)}
      {myRole === 'owner' && <DeleteTeamCard teamName={teamName} />}
    </div>
  );
}

/** Header dropdown for switching between the teams you belong to, and creating
 *  a new one. Renders as a plain label when there's only one team and nothing
 *  to switch to — but still offers "create", since that's the only escape from
 *  the teamless state. */
/**
 * Avatar with an account menu behind it.
 *
 * Replaces a bare "Sign out" link that sat between the notification bell and
 * the avatar — a rare and irreversible action wedged between the two most
 * clicked controls, and a third mismatched shape in a row of otherwise square
 * icons.
 */
function AccountMenu({ email, initials, active, onProfile, onBilling, onSignOut }: {
  email: string; initials: string; active: boolean;
  /** null for developers, who have no billing page to go to. */
  onProfile: () => void; onBilling: (() => void) | null; onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const item = 'w-full text-left px-4 py-2.5 text-sm text-[--dark-muted] hover:text-white hover:bg-white/[0.03] transition-colors';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={email}
        aria-label="Account menu"
        aria-expanded={open}
        className={`font-doto w-8 h-8 grid place-items-center border text-xs transition-colors ${
          active || open ? 'border-[--red] text-white' : 'border-[--dark-line] text-[--dark-text] hover:border-white'
        }`}
      >
        {initials}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 mt-2 z-40 w-60 bg-[--dark-card] border border-[--dark-line] shadow-xl">
            <p className="px-4 py-3 border-b border-[--dark-line] font-mono2 text-[11px] text-[--dark-muted] truncate" title={email}>
              {email}
            </p>
            <button className={item} onClick={() => { onProfile(); setOpen(false); }}>Profile &amp; security</button>
            {onBilling && <button className={item} onClick={() => { onBilling(); setOpen(false); }}>Usage &amp; billing</button>}
            {/* Separated by a rule: signing out is not in the same class of
                action as navigating somewhere. */}
            <button
              className={`${item} border-t border-[--dark-line] hover:text-[#F07A6A]`}
              onClick={() => { onSignOut(); setOpen(false); }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TeamSwitcher({ current, onSwitched }: { current: string; onSwitched: () => void }) {
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [meta, setMeta] = useState<TeamList | null>(null);

  const load = useCallback(() => {
    api<TeamList>('/teams')
      .then((d) => { setTeams(d.teams); setMeta(d); })
      .catch(() => setTeams([]));
  }, []);
  // Refetched every time the dropdown opens, not once and then cached.
  //
  // The cached version had a trap: switching teams never invalidated the list,
  // so the entry marked "current" stayed whichever team was current when the
  // list was first fetched. After one switch that badge pointed at the team you
  // had just left — and since that entry is the one rendered as non-actionable,
  // there was no way to switch back to it. The header said one team, the
  // dropdown said another, and the obvious click did nothing.
  //
  // The list is small and the dropdown opens rarely, so refetching is cheap. It
  // also picks up teams you were invited to since the page loaded, plan changes,
  // and whether creating is still allowed. Existing rows stay on screen while
  // the request is in flight, so there's no loading flicker.
  useEffect(() => { if (open) load(); }, [open, load]);

  const switchTo = async (id: string) => {
    setBusy(true);
    try {
      await api('/teams/switch', { body: { teamId: id } });
      setOpen(false);
      onSwitched();
    } catch { setErr('Could not switch team.'); } finally { setBusy(false); }
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    try {
      await api('/teams', { body: { name: name.trim() } });
      // No setTeams(null) any more: reopening refetches, and nulling here would
      // show a "Loading …" flash instead of the previous rows.
      setName(''); setCreating(false); setOpen(false);
      onSwitched();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the team.');
    } finally { setBusy(false); }
  };

  return (
    <div className="relative min-w-0">
      <button onClick={() => setOpen((v) => !v)}
        title={current}
        className="flex items-center gap-2 min-w-0 font-mono2 text-xs uppercase tracking-widest text-[--dark-muted] hover:text-white transition-colors">
        {/* Tight on a phone, generous on a desktop. Without a hard cap a long
            team name pushed the bell and avatar off the header. */}
        <span className="truncate max-w-[14ch] sm:max-w-[16ch] lg:max-w-[22ch]">{current}</span>
        <span className={`text-[9px] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 mt-2 z-40 w-72 bg-[--dark-card] border border-[--dark-line] shadow-xl">
            <p className="px-4 py-2 font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] border-b border-[--dark-line]">Your teams</p>
            <div className="max-h-64 overflow-y-auto divide-y divide-[--dark-line]">
              {teams === null && <p className="px-4 py-3 font-mono2 text-xs text-[--dark-muted]">Loading …</p>}
              {/* Every row stays clickable, including the current one.
                  Disabling the current row is what turned a stale flag into a
                  lockout: if the badge is ever on the wrong team, that team
                  becomes the one you can't reach. Switching to the team you are
                  already in is a harmless no-op that also re-syncs, so there is
                  nothing to protect against and a real failure mode to remove. */}
              {teams?.map((t) => (
                <button key={t.id} onClick={() => switchTo(t.id)} disabled={busy}
                  className={`w-full text-left px-4 py-2.5 hover:bg-white/[0.03] transition-colors ${t.active ? 'bg-white/[0.04]' : ''}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate">{t.name}</span>
                    {t.active && <span className="font-mono2 text-[9px] uppercase tracking-wider text-[--red] shrink-0">current</span>}
                  </span>
                  <span className="font-mono2 text-[10px] text-[--dark-muted]">
                    {t.role} · {t.planLabel} · {t.members} member{t.members === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-[--dark-line] p-3">
              {creating ? (
                <div className="grid gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="New team name"
                    onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
                    className="w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm outline-none focus:border-white" />
                  {/* Said before the team exists, not discovered after. Only
                      shown to people who can actually create one — the button
                      is gone entirely otherwise. */}
                  {meta && !meta.trialAvailable && (
                    <p className="font-mono2 text-[10px] text-[#E8B44C] leading-relaxed">
                      Your free trial has already been used, so this team starts without one —
                      it needs its own plan before it can run environments.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={create} disabled={busy || !name.trim()}
                      className="font-mono2 text-[10px] uppercase tracking-widest border border-white px-3 py-2 hover:bg-white hover:text-[--dark] disabled:opacity-30">
                      {busy ? 'Creating…' : 'Create'}
                    </button>
                    <button onClick={() => { setCreating(false); setErr(''); }} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white px-2">Cancel</button>
                  </div>
                </div>
              ) : meta && !meta.canCreateTeam ? (
                /* No create button at all when it isn't allowed. Offering one
                   that fails on click is worse than not offering it, and the
                   earlier version — which let the team be created but arrive
                   unable to run anything — was worse still. The reason comes
                   from the backend so this can't disagree with the endpoint. */
                <p className="font-mono2 text-[10px] text-[--dark-muted] leading-relaxed">
                  {meta.createBlockedReason === 'team_limit_reached'
                    ? <>You own {meta.ownedTeams} of {meta.maxOwnedTeams} teams. Leave or delete one to create another.</>
                    : <>Running more than one team needs a paid plan. You can still be invited to other
                        teams and switch between them here at any time.</>}
                </p>
              ) : (
                <button onClick={() => setCreating(true)}
                  className="w-full text-left font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] hover:text-white">
                  + Create a team
                </button>
              )}
              {err && <p className="mt-2 font-mono2 text-[10px] text-[#F07A6A]">{err}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Profile: security settings for the signed-in user ---------- */

/** Change the account password. Requires the current one — a session alone
 *  must not be enough to lock the real owner out. */
function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const save = async () => {
    setErr(''); setDone(false);
    if (!passwordMeetsPolicy(next)) { setErr('The new password does not meet the requirements below.'); return; }
    if (next !== confirm) { setErr('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      await api('/auth/change-password', { body: { currentPassword: current, newPassword: next } });
      setCurrent(''); setNext(''); setConfirm(''); setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'invalid_credentials'
        ? 'Your current password is not correct.'
        : e instanceof Error ? e.message : 'Could not change the password.');
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHead title="Password" />
      <div className="p-5 grid gap-4 max-w-md">
        <DarkField label="Current password" type="password" value={current} onChange={setCurrent} />
        <div>
          <DarkField label="New password" type="password" value={next} onChange={setNext} />
          {next && (
            <ul className="mt-2 grid gap-1">
              {passwordRules(next).map((r) => (
                <li key={r.label} className={`font-mono2 text-[11px] flex items-center gap-2 ${r.ok ? 'text-[#57C99A]' : 'text-[--dark-muted]'}`}>
                  <span aria-hidden>{r.ok ? '✓' : '○'}</span>{r.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DarkField label="Repeat new password" type="password" value={confirm} onChange={setConfirm} />
        {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        {done && <p className="font-mono2 text-xs text-[#57C99A]">Password changed.</p>}
        <button onClick={save} disabled={busy || !current || !next}
          className="font-mono2 text-[10px] uppercase tracking-widest border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark] disabled:opacity-30 justify-self-start">
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </Card>
  );
}

/** Small dark-theme text field, matching the dashboard's other inputs. */
function DarkField({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm outline-none focus:border-white" />
    </label>
  );
}

/** QR code for the otpauth:// enrolment URI, so the secret can be scanned
 *  instead of typed. The encoder is imported dynamically — it's only needed on
 *  this one screen, and lazy-loading keeps it out of the main bundle. Rendered
 *  as an SVG string (crisp at any size, no canvas ref juggling). */
function OtpQr({ uri }: { uri: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then((QR) => QR.toString(uri, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
        // Dark modules in white cells: authenticator scanners want high
        // contrast, and the dashboard's dark card would otherwise invert it.
        color: { dark: '#0C0C0C', light: '#FFFFFF' },
      }))
      .then((out) => { if (alive) setSvg(out); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [uri]);

  if (failed) return null; // fall back to the setup key below it
  if (!svg) return <Skeleton className="h-44 w-44" />;
  return (
    <div
      className="bg-white p-3 w-fit border border-[--dark-line] [&>svg]:w-40 [&>svg]:h-40 [&>svg]:block"
      // The SVG is produced locally by the encoder from a URI we built
      // ourselves — no user- or network-supplied markup reaches this.
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="QR code for two-factor setup"
    />
  );
}

/** Enrol in / remove TOTP two-factor authentication. */
function TwoFactorCard() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenCode, setRegenCode] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<TwoFactorStatus>('/auth/2fa').then(setStatus).catch(() => setStatus(null));
  }, []);
  useEffect(load, [load]);

  const begin = async () => {
    setErr(''); setBusy(true);
    try { setSetup(await api<TwoFactorSetup>('/auth/2fa/setup', { method: 'POST' })); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not start setup.'); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setErr(''); setBusy(true);
    try {
      const res = await api<{ recoveryCodes: string[] }>('/auth/2fa/enable', { body: { code } });
      setCodes(res.recoveryCodes); setSetup(null); setCode(''); load();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'invalid_totp'
        ? 'That code is not valid — check your device clock and enter the current code.'
        : e instanceof Error ? e.message : 'Could not enable two-factor.');
    } finally { setBusy(false); }
  };

  const regenerate = async () => {
    setErr(''); setBusy(true);
    try {
      const res = await api<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes/regenerate', { body: { code: regenCode } });
      setCodes(res.recoveryCodes); setRegenerating(false); setRegenCode(''); load();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'invalid_totp'
        ? 'That code is not valid — check your device clock and enter the current code.'
        : e instanceof Error ? e.message : 'Could not regenerate codes.');
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setErr(''); setBusy(true);
    try {
      await api('/auth/2fa/disable', { body: { password: pw, code } });
      setDisabling(false); setPw(''); setCode(''); setCodes(null); load();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'invalid_credentials'
        ? 'That password is not correct.'
        : e instanceof ApiError && e.code === 'invalid_totp'
          ? 'That code is not valid. You can also use one of your recovery codes.'
          : e instanceof Error ? e.message : 'Could not disable two-factor.');
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHead title="Two-factor authentication" right={
        status && (status.enabled
          ? <span className="font-mono2 text-[10px] uppercase tracking-wider border border-[#57C99A]/40 text-[#57C99A] px-2 py-0.5">Enabled</span>
          : <span className="font-mono2 text-[10px] uppercase tracking-wider border border-[#E8B44C]/40 text-[#E8B44C] px-2 py-0.5">Off</span>)
      } />
      <div className="p-5 grid gap-4 max-w-md">
        {status === null && <Skeleton className="h-10 w-full" />}

        {/* freshly generated recovery codes — shown once */}
        {codes && (
          <div className="border border-[#E8B44C]/50 p-4">
            <p className="font-mono2 text-[10px] uppercase tracking-widest text-[#E8B44C]">Recovery codes — save these now</p>
            <p className="mt-2 text-xs text-[--dark-muted]">
              Each code works once, if you lose your authenticator. They are shown only this one time.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono2 text-xs select-all">
              {codes.map((c) => <span key={c} className="bg-black/40 border border-[--dark-line] px-2 py-1">{c}</span>)}
            </div>
            <div className="mt-3 flex gap-2">
              <CopyButton value={codes.join('\n')} />
              <button onClick={() => setCodes(null)} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white px-3 py-1.5">I've saved them</button>
            </div>
          </div>
        )}

        {status && !status.enabled && !setup && !codes && (
          <>
            <p className="text-sm text-[--dark-muted]">
              Protect your account with a code from an authenticator app (Google Authenticator, 1Password, Aegis …)
              in addition to your password.
            </p>
            <button onClick={begin} disabled={busy}
              className="font-mono2 text-[10px] uppercase tracking-widest border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark] disabled:opacity-30 justify-self-start">
              {busy ? 'Starting…' : 'Set up two-factor'}
            </button>
          </>
        )}

        {setup && (
          <>
            <p className="text-sm text-[--dark-muted]">
              Scan this with your authenticator app, then enter the 6-digit code it shows to confirm.
            </p>
            <OtpQr uri={setup.otpauthUri} />
            <details className="border border-[--dark-line]">
              <summary className="cursor-pointer list-none px-3 py-2 font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] hover:text-white">
                Can't scan? Enter the key manually
              </summary>
              <div className="px-3 pb-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono2 text-xs bg-black/40 border border-[--dark-line] px-3 py-2 break-all select-all">{setup.secret}</code>
                  <CopyButton value={setup.secret} />
                </div>
                <a href={setup.otpauthUri} className="mt-2 inline-block font-mono2 text-[10px] text-[#8AB8F0] hover:underline">
                  Or open your authenticator app directly
                </a>
              </div>
            </details>
            <DarkField label="6-digit code" type="text" value={code} onChange={setCode} placeholder="123456" />
            {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
            <div className="flex gap-2">
              <button onClick={confirm} disabled={busy || code.trim().length < 6}
                className="font-mono2 text-[10px] uppercase tracking-widest border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark] disabled:opacity-30">
                {busy ? 'Verifying…' : 'Confirm & enable'}
              </button>
              <button onClick={() => { setSetup(null); setCode(''); setErr(''); }}
                className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white px-3">Cancel</button>
            </div>
          </>
        )}

        {status?.enabled && !disabling && !regenerating && !codes && (
          <>
            <p className="text-sm text-[--dark-muted]">
              Two-factor is on. {status.recoveryCodesRemaining} recovery code{status.recoveryCodesRemaining === 1 ? '' : 's'} remaining.
            </p>
            {status.recoveryCodesRemaining <= 2 && (
              <p className="font-mono2 text-[11px] text-[#E8B44C]">
                Running low — regenerate now, before you actually need one.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setRegenerating(true); setErr(''); }}
                className="font-mono2 text-[10px] uppercase tracking-widest border border-[--dark-line] px-4 py-2.5 hover:border-white justify-self-start">
                Regenerate recovery codes
              </button>
              <button onClick={() => { setDisabling(true); setErr(''); }}
                className="font-mono2 text-[10px] uppercase tracking-widest border border-[#F07A6A]/40 text-[#F07A6A] px-4 py-2.5 hover:bg-[#F07A6A]/10 justify-self-start">
                Turn off two-factor
              </button>
            </div>
          </>
        )}

        {regenerating && (
          <>
            <p className="text-sm text-[--dark-muted]">
              Enter a current code from your authenticator. This replaces every existing recovery
              code — including ones you haven't used yet — with ten new ones.
            </p>
            <DarkField label="6-digit code" type="text" value={regenCode} onChange={setRegenCode} placeholder="123456" />
            {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
            <div className="flex gap-2">
              <button onClick={regenerate} disabled={busy || regenCode.trim().length < 6}
                className="font-mono2 text-[10px] uppercase tracking-widest border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark] disabled:opacity-30">
                {busy ? 'Verifying…' : 'Regenerate'}
              </button>
              <button onClick={() => { setRegenerating(false); setRegenCode(''); setErr(''); }}
                className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white px-3">Cancel</button>
            </div>
          </>
        )}

        {disabling && (
          <>
            <p className="text-sm text-[--dark-muted]">
              Confirm with your password and a current code. Lost your device? A recovery code works here too.
            </p>
            <DarkField label="Password" type="password" value={pw} onChange={setPw} />
            <DarkField label="Code or recovery code" type="text" value={code} onChange={setCode} placeholder="123456" />
            {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
            <div className="flex gap-2">
              <button onClick={disable} disabled={busy || !pw || !code}
                className="font-mono2 text-[10px] uppercase tracking-widest bg-[--red] text-white px-4 py-2.5 disabled:opacity-30">
                {busy ? 'Removing…' : 'Turn off'}
              </button>
              <button onClick={() => { setDisabling(false); setPw(''); setCode(''); setErr(''); }}
                className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white px-3">Cancel</button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/** Permanently delete the signed-in user's own account. */
function DeleteAccountCard({ email }: { email: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = confirmText.trim().toLowerCase() === 'delete' && pw.length > 0;

  const remove = async () => {
    if (!ready) return;
    setBusy(true); setErr('');
    try {
      await api('/auth/me', { method: 'DELETE', body: { password: pw } });
      navigate('/');
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'invalid_credentials'
        ? 'That password is not correct.'
        : e instanceof Error ? e.message : 'Could not delete the account.');
      setBusy(false);
    }
  };

  return (
    <Card className="border-[#F07A6A]/40">
      <CardHead title="Delete account" />
      <div className="p-5 grid gap-4 max-w-md">
        <p className="text-sm text-[--dark-muted]">
          Permanently deletes <span className="font-mono2 text-[--dark-text]">{email}</span> and removes you from your teams.
          A team where you are the only member is deleted with you. This cannot be undone.
        </p>
        {!open ? (
          <button onClick={() => setOpen(true)}
            className="font-mono2 text-[10px] uppercase tracking-widest border border-[#F07A6A]/40 text-[#F07A6A] px-4 py-2.5 hover:bg-[#F07A6A]/10 justify-self-start">
            Delete my account
          </button>
        ) : (
          <>
            <DarkField label="Password" type="password" value={pw} onChange={setPw} />
            <DarkField label='Type "delete" to confirm' type="text" value={confirmText} onChange={setConfirmText} placeholder="delete" />
            {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
            <div className="flex gap-2">
              <button onClick={remove} disabled={!ready || busy}
                className="font-mono2 text-[10px] uppercase tracking-widest bg-[--red] text-white px-4 py-2.5 disabled:opacity-30">
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
              <button onClick={() => { setOpen(false); setPw(''); setConfirmText(''); setErr(''); }}
                className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white px-3">Cancel</button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/** Change the sign-in email. The new address must be confirmed before it takes
 *  effect, so a typo can't lock the account away. */
function ChangeEmailCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState('');

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const res = await api<{ pendingEmail: string }>('/auth/change-email', { body: { password: pw, newEmail: next.trim() } });
      setSent(res.pendingEmail); setPw(''); setNext(''); setOpen(false);
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'invalid_credentials' ? 'That password is not correct.'
        : e instanceof ApiError && e.code === 'email_taken' ? 'That address is already in use.'
        : e instanceof Error ? e.message : 'Could not start the email change.');
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHead title="Email address" />
      <div className="p-5 grid gap-3 max-w-md">
        <p className="text-sm text-[--dark-muted]">
          Currently <span className="text-[--dark-text] break-all">{email}</span>. Changing it sends a
          confirmation link to the new address — nothing changes until you click it.
        </p>
        {sent && <p className="font-mono2 text-xs text-[#57C99A]">Confirmation sent to {sent}. Check that inbox to finish.</p>}
        {!open ? (
          <button onClick={() => { setOpen(true); setSent(''); }}
            className="font-mono2 text-[10px] uppercase tracking-widest border border-[--dark-line] px-4 py-2.5 hover:border-white justify-self-start">
            Change email
          </button>
        ) : (
          <>
            <DarkField label="New email address" type="email" value={next} onChange={setNext} />
            <DarkField label="Current password" type="password" value={pw} onChange={setPw} />
            {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
            <div className="flex gap-2">
              <button onClick={submit} disabled={busy || !pw || !next.includes('@')}
                className="font-mono2 text-[10px] uppercase tracking-widest border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark] disabled:opacity-30">
                {busy ? 'Sending…' : 'Send confirmation'}
              </button>
              <button onClick={() => { setOpen(false); setErr(''); }} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white px-3">Cancel</button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/** Turns a user-agent string into something a human recognises. Deliberately
 *  rough — it only has to be good enough to answer "is that me?". */
function describeDevice(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
      : /Chrome\//.test(ua) ? 'Chrome'
        : /Safari\//.test(ua) ? 'Safari'
          : /Firefox\//.test(ua) ? 'Firefox'
            : /curl|wget|devplat/i.test(ua) ? 'CLI' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Macintosh|Mac OS/.test(ua) ? 'macOS'
      : /Android/.test(ua) ? 'Android'
        : /iPhone|iPad/.test(ua) ? 'iOS'
          : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

/** Active sessions, so a user can spot and evict a device that isn't theirs. */
function SessionsCard() {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api<{ sessions: SessionInfo[] }>('/auth/sessions').then((d) => setSessions(d.sessions)).catch(() => setSessions([]));
  }, []);
  useEffect(load, [load]);

  const revoke = async (id: string) => {
    setBusy(id); setErr('');
    try { await api(`/auth/sessions/${id}`, { method: 'DELETE' }); load(); }
    catch { setErr('Could not sign that session out.'); }
    finally { setBusy(''); }
  };

  const revokeOthers = async () => {
    setBusy('others'); setErr('');
    try { await api('/auth/sessions/revoke-others', { method: 'POST' }); load(); }
    catch { setErr('Could not sign the other sessions out.'); }
    finally { setBusy(''); }
  };

  const others = (sessions ?? []).filter((s) => !s.current).length;

  return (
    <Card>
      <CardHead title="Active sessions" right={
        others > 0 ? (
          <button onClick={revokeOthers} disabled={busy === 'others'}
            className="font-mono2 text-[10px] uppercase tracking-wider text-[#F07A6A]/80 hover:text-[#F07A6A] disabled:opacity-40">
            {busy === 'others' ? 'Signing out…' : `Sign out ${others} other${others === 1 ? '' : 's'}`}
          </button>
        ) : undefined
      } />
      <div className="divide-y divide-[--dark-line]">
        {sessions === null && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">Loading …</p>}
        {sessions?.length === 0 && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">No active sessions.</p>}
        {sessions?.map((s) => (
          <div key={s.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm flex items-center gap-2">
                {describeDevice(s.userAgent)}
                {s.current && <span className="font-mono2 text-[9px] uppercase tracking-wider border border-[#57C99A]/40 text-[#57C99A] px-1.5 py-0.5">this device</span>}
              </p>
              <p className="font-mono2 text-[10px] text-[--dark-muted]">
                {s.ip ?? 'unknown IP'} · last active {fmtAgo(s.lastSeenAt)} · signed in {fmtDate(s.createdAt)}
              </p>
            </div>
            {!s.current && (
              <button onClick={() => revoke(s.id)} disabled={busy === s.id}
                className="font-mono2 text-[10px] uppercase tracking-wider text-[#F07A6A]/80 hover:text-[#F07A6A] border border-transparent hover:border-[#F07A6A]/40 px-2 py-1 shrink-0 disabled:opacity-40">
                {busy === s.id ? '…' : 'Sign out'}
              </button>
            )}
          </div>
        ))}
      </div>
      {err && <p className="px-5 pb-4 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
    </Card>
  );
}

/** Download everything we hold about this account (GDPR Art. 15/20). */
function DataExportCard() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const download = async () => {
    setBusy(true); setErr('');
    try {
      // Not via api(): this returns a file, not JSON to parse.
      const res = await fetch(`${API_URL}/account/export`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devplat-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed.');
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHead title="Your data" />
      <div className="p-5 grid gap-3 max-w-md">
        <p className="text-sm text-[--dark-muted]">
          Download a machine-readable copy of your account, team memberships, and — for teams you
          administer — their tokens, run history and audit log. Secrets are never included:
          passwords and token values exist only as irreversible hashes.
        </p>
        {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        <button onClick={download} disabled={busy}
          className="font-mono2 text-[10px] uppercase tracking-widest border border-[--dark-line] px-4 py-2.5 hover:border-white disabled:opacity-30 justify-self-start">
          {busy ? 'Preparing…' : 'Download my data (JSON)'}
        </button>
      </div>
    </Card>
  );
}

function Profile({ email, verified }: { email: string; verified: boolean }) {
  return (
    <div className="grid gap-5">
      <Card>
        <CardHead title="Account" />
        <div className="p-5 grid gap-2 max-w-md">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Email</span>
            <span className="text-sm break-all">{email}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Status</span>
            <span className={`font-mono2 text-[11px] ${verified ? 'text-[#57C99A]' : 'text-[#E8B44C]'}`}>
              {verified ? 'verified' : 'unverified'}
            </span>
          </div>
        </div>
      </Card>
      <ChangeEmailCard email={email} />
      <TwoFactorCard />
      <ChangePasswordCard />
      <SessionsCard />
      <DataExportCard />
      <DeleteAccountCard email={email} />
    </div>
  );
}

/* ---------- Shell ---------- */

// Clean, consistent line icons for the sidebar — replaces the earlier grab-bag
// of unicode glyphs, which read as decorative rather than enterprise. All share
// one 24-grid, 1.6 stroke, currentColor so they inherit the nav's active/muted
// states.
function NavIcon({ name }: { name: View | 'admin' }) {
  const p: Record<View | 'admin', React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    pipelines: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="12" r="2.5" /><path d="M6 8.5v7M8.3 6.7l7.6 4.2M8.3 17.3l7.6-4.2" /></>,
    tokens: <><circle cx="8" cy="8" r="4" /><path d="M11 11l7 7M15 15l2-2M17 17l2-2" /></>,
    billing: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>,
    team: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17 13.5a5.5 5.5 0 0 1 3.5 5.5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
    profile: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
    admin: <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9.5 12l1.8 1.8L15 10" /></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[name]}
    </svg>
  );
}

/** Landing state for an account that belongs to no team. */
/**
 * Enrolment screen shown when the team requires two-factor and this account
 * doesn't have it yet.
 *
 * Without this, an invited colleague registered, accepted the invite, landed
 * on the dashboard — and every panel failed with an unexplained error, because
 * requireMember refuses each team-scoped call with two_factor_required. The
 * server was doing the right thing; nothing was translating it into an
 * instruction. This is the first thing a new team member sees, so it needs to
 * read as a step in joining, not as a wall.
 */
function TwoFactorRequiredGate({ email, onEnrolled, onSignOut }: {
  email: string; onEnrolled: () => void; onSignOut: () => void;
}) {
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Start the enrolment immediately: the person is here because they must do
  // this, so an extra "Begin" click would only be ceremony.
  useEffect(() => {
    api<TwoFactorSetup>('/auth/2fa/setup', { method: 'POST' })
      .then(setSetup)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not start setup.'));
  }, []);

  const confirm = async () => {
    setErr(''); setBusy(true);
    try {
      const res = await api<{ recoveryCodes: string[] }>('/auth/2fa/enable', { body: { code } });
      setCodes(res.recoveryCodes);
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'invalid_totp'
        ? 'That code is not valid — check your device clock and enter the current code.'
        : e instanceof Error ? e.message : 'Could not enable two-factor.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[--dark] text-[--dark-text] grid place-items-center px-5 py-12">
      <div className="w-full max-w-lg">
        <Logo dark />
        {codes ? (
          <Card className="mt-8">
            <CardHead title="Save your recovery codes" />
            <div className="p-5 grid gap-4">
              <p className="text-sm text-[--dark-muted]">
                Two-factor is on. These ten codes are the way back in if you lose your phone —
                each works once. Store them somewhere that isn't the device running your
                authenticator; we can't recover them for you.
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono2 text-xs bg-white/[0.03] border border-[--dark-line] p-4">
                {codes.map((c) => <span key={c}>{c}</span>)}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigator.clipboard?.writeText(codes.join('\n')).catch(() => {})}
                  className="font-mono2 text-[10px] border border-[--dark-line] px-4 py-2.5 hover:border-white"
                >Copy codes</button>
                <button onClick={onEnrolled} className="font-mono2 text-[10px] border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark]">
                  I've saved them — continue
                </button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="mt-8">
            <CardHead title="Your team requires two-factor" />
            <div className="p-5 grid gap-5">
              <p className="text-sm text-[--dark-muted]">
                Before you can use this team, {email && <span className="text-[--dark-text]">{email}</span>} needs
                two-factor authentication. It takes a minute and only has to be done once.
              </p>

              {err && !setup && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
              {!setup && !err && <p className="font-mono2 text-xs text-[--dark-muted]">Preparing your setup key …</p>}

              {setup && (
                <>
                  <div>
                    <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">
                      1 · Scan with your authenticator
                    </p>
                    <p className="text-xs text-[--dark-muted] mt-1">
                      Google Authenticator, 1Password, Bitwarden, Aegis — any TOTP app works.
                    </p>
                    <div className="mt-3"><OtpQr uri={setup.otpauthUri} /></div>
                    <p className="font-mono2 text-[10px] text-[--dark-muted] mt-3">
                      Can't scan? Enter this key by hand:
                    </p>
                    <code className="block mt-1 font-mono2 text-xs break-all bg-white/[0.03] border border-[--dark-line] p-2.5">
                      {setup.secret}
                    </code>
                  </div>

                  <div>
                    <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">
                      2 · Enter the six-digit code
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) void confirm(); }}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        className="font-mono2 tracking-[0.3em] bg-transparent border border-[--dark-line] px-3 py-2.5 text-sm outline-none focus:border-white w-36"
                      />
                      <button
                        onClick={confirm}
                        disabled={busy || code.length !== 6}
                        className="font-mono2 text-[10px] border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[--dark-text]"
                      >{busy ? 'Checking …' : 'Turn on two-factor'}</button>
                    </div>
                    {err && <p className="font-mono2 text-xs text-[#F07A6A] mt-2">{err}</p>}
                  </div>
                </>
              )}
            </div>
          </Card>
        )}
        <p className="mt-6 font-mono2 text-[11px] text-[--dark-muted]">
          Wrong account?{' '}
          <button onClick={onSignOut} className="text-[--dark-text] hover:text-white underline underline-offset-2">Sign out</button>
        </p>
      </div>
    </div>
  );
}

function NoTeam({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Same honesty as the team switcher: someone who has already used their trial
  // (they left or deleted every team they had) should know before creating one
  // that it won't be able to start anything yet.
  const [trialAvailable, setTrialAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    api<TeamList>('/teams').then((d) => setTrialAvailable(d.trialAvailable)).catch(() => setTrialAvailable(null));
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    try {
      await api('/teams', { body: { name: name.trim() } });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the team.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[--dark] text-[--dark-text] grid place-items-center p-8">
      <div className="max-w-md w-full">
        <Logo dark onClick={() => navigate('/')} />
        <h1 className="mt-6 text-2xl font-semibold">You're not in a team yet.</h1>
        <p className="mt-2 text-sm text-[--dark-muted]">
          Environments, tokens and billing all belong to a team. Create one to get started —
          or, if a colleague invited you, open the invitation link from your inbox instead.
        </p>
        <div className="mt-6 grid gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Team name"
            onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
            className="w-full bg-transparent border border-[--dark-line] px-3 py-2.5 text-sm outline-none focus:border-white" />
          {trialAvailable === false && (
            <p className="font-mono2 text-xs text-[#E8B44C] leading-relaxed">
              Your free trial has already been used, so this team starts without one — you'll need to
              pick a plan before it can run environments.
            </p>
          )}
          {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}
          <button onClick={create} disabled={busy || !name.trim()}
            className="font-mono2 text-[10px] uppercase tracking-widest border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark] disabled:opacity-30 justify-self-start">
            {busy ? 'Creating…' : 'Create team'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Shown when a developer lands on an owner/admin-only view by typing the URL or
 * following an old bookmark.
 *
 * Deliberately an explanation rather than a redirect: bouncing someone silently
 * back to the overview reads as a broken link, and they never learn that the
 * page exists but isn't theirs. The API already refuses these — this is the
 * front door saying the same thing in words.
 */
function RestrictedView({ view, teamName, onBack }: { view: View; teamName: string; onBack: () => void }) {
  const what = view === 'billing'
    ? { title: 'Usage & billing is admin-only', body: `Plans, invoices and payment details for ${teamName} are visible to the team's owner and admins.` }
    : { title: 'Team settings are admin-only', body: `The team name, environment lifetimes, security policy and webhooks for ${teamName} are managed by the team's owner and admins.` };
  return (
    <Card className="p-8 max-w-[60ch]">
      <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Not available for your role</p>
      <h2 className="text-lg mt-2">{what.title}</h2>
      <p className="text-sm text-[--dark-muted] mt-2 leading-relaxed">{what.body}</p>
      <p className="text-sm text-[--dark-muted] mt-2 leading-relaxed">
        You're a developer on this team — you can start environments, run pipelines and manage your own API tokens.
      </p>
      <button onClick={onBack}
        className="mt-5 font-mono2 text-[10px] uppercase tracking-widest border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark]">
        Back to environments
      </button>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { view: viewParam } = useParams<{ view: string }>();
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : 'overview';
  const { me, refresh, logout } = useAuth();
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const apiOk = useApiHealth();

  // Rail width is a per-machine preference — someone on a 13" laptop wants the
  // 190px back, someone on a 27" display doesn't. Persisted so the choice
  // survives a reload rather than being re-made every session.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('devplat.sidebar') === 'collapsed');
  useEffect(() => {
    localStorage.setItem('devplat.sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  // Mobile drawer. Closes on navigation and on Escape — a drawer you can only
  // dismiss by finding the scrim is a trap on a phone.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  // Distinguishing "the team failed to load" from "this team requires 2FA and
  // you haven't enrolled" matters: the second is not an error, it is an
  // instruction, and without this the whole dashboard just silently failed to
  // populate for a newly invited colleague.
  const [mustEnrol, setMustEnrol] = useState(false);
  const loadTeam = useCallback(() => {
    api<TeamInfo>('/teams/me')
      .then((t) => { setTeamInfo(t); setMustEnrol(false); })
      .catch((e) => {
        setTeamInfo(null);
        setMustEnrol(e instanceof ApiError && e.code === 'two_factor_required');
      });
  }, []);
  useEffect(loadTeam, [loadTeam, me?.team?.id]);

  const setView = (v: View) => navigate(v === 'overview' ? '/app' : `/app/${v}`);
  const signOut = async () => { await logout(); navigate('/'); };

  // Which role this account holds in the team it's currently acting in.
  // Read from /auth/me first because that is already resolved on the very first
  // render — deriving it only from teamInfo would flash the full nav, including
  // Billing, for a beat before /teams/me came back.
  const myRole = me?.team?.role ?? teamInfo?.team.myRole;
  // Billing and team settings are owner/admin territory. Every endpoint behind
  // them is already gated with requireTeamAdmin, so a developer who reached
  // them got a page of 403s — the nav was writing cheques the API wouldn't cash.
  // Unknown role (team still loading) is treated as admin so the nav doesn't
  // visibly reshuffle underneath a click.
  const isAdmin = myRole !== 'developer';

  const items: { key: View; label: string }[] = [
    { key: 'overview', label: 'Environments' },
    { key: 'pipelines', label: 'CI pipelines' },
    { key: 'tokens', label: 'API tokens' },
    ...(isAdmin ? [{ key: 'billing' as View, label: 'Usage & billing' }] : []),
    { key: 'team', label: 'Team' },
    ...(isAdmin ? [{ key: 'settings' as View, label: 'Settings' }] : []),
  ];
  // Hiding the nav entry is not access control: /app/billing is a URL anyone can
  // type, and it used to render a broken page rather than an explanation.
  const restricted = !isAdmin && (view === 'billing' || view === 'settings');
  const titles: Record<View, string> = {
    overview: 'Environments', pipelines: 'CI pipelines',
    tokens: 'API tokens', billing: 'Usage & billing', team: 'Team', settings: 'Settings',
    profile: 'Your profile',
  };

  const teamName = teamInfo?.team.name ?? me?.team?.name ?? '—';
  const planLabel = teamInfo?.team.planLabel ?? 'Free Trial';
  const limit = teamInfo?.team.parallelLimit ?? 1;
  const initials = (me?.user.email ?? '??').slice(0, 2).toUpperCase();

  // Free-trial countdown. Only the free plan is time-boxed (trial_ends_at);
  // paid plans send a trialEndsAt too but it's not meaningful for them, so
  // this is gated on the Free label. Surfaced in the header so a trial that's
  // about to lapse (after which parallel envs drop to 0) is never a surprise.
  const trialDaysLeft = (() => {
    const iso = teamInfo?.team.trialEndsAt;
    if (!iso || !planLabel.toLowerCase().includes('free')) return null;
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
    return days;
  })();

  // No team: either an invited user who hasn't accepted yet, or someone who
  // left (or was removed from) their last one. Both need a way forward, not
  // just an explanation — creating a team is the only escape from this state.
  if (me && !me.team) {
    return <NoTeam onCreated={() => { void refresh(); loadTeam(); }} />;
  }

  // The team requires two-factor and this account hasn't enrolled. Every
  // team-scoped endpoint is refusing, so there is no dashboard to show —
  // showing the enrolment instead is the only useful thing here.
  if (mustEnrol) {
    return <TwoFactorRequiredGate email={me?.user.email ?? ''} onEnrolled={() => { void refresh(); loadTeam(); }} onSignOut={signOut} />;
  }

  return (
    <div className="min-h-screen bg-[--dark] text-[--dark-text] flex">
      {/* Mobile drawer scrim. The same <aside> serves as both the desktop rail
          and the phone drawer, so the nav exists in exactly one place. */}
      {sidebarOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60"
        />
      )}
      <aside
        className={`shrink-0 border-r border-[--dark-line] flex flex-col bg-[--dark] transition-[width] duration-200
          fixed md:static inset-y-0 left-0 z-50 md:z-auto
          ${sidebarOpen ? 'flex w-64' : 'hidden md:flex'}
          ${collapsed ? 'md:w-16' : 'md:w-56'}`}
      >
        {/* The collapse toggle lives up here rather than at the foot of the
            rail: the cookie notice is a fixed bottom bar and sits directly on
            top of anything down there, which made the toggle unclickable until
            the notice was dismissed. */}
        <div className={`h-16 flex items-center border-b border-[--dark-line] ${collapsed ? 'md:justify-center md:px-0 px-5' : 'px-5 justify-between'}`}>
          {/* Collapsed to icons the wordmark doesn't fit, but the mark alone
              still gets you home. */}
          <span className={collapsed ? 'md:hidden' : ''}><Logo dark onClick={() => navigate('/')} /></span>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:grid place-items-center w-7 h-7 text-[--dark-muted] hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M9 4v16" />
              <path d={collapsed ? 'M13.5 9.5 16 12l-2.5 2.5' : 'M16 9.5 13.5 12l2.5 2.5'} />
            </svg>
          </button>
        </div>
        <nav className="flex-1 py-3">
          {items.map((i) => (
            <button key={i.key} onClick={() => { setView(i.key); setSidebarOpen(false); }}
              title={collapsed ? i.label : undefined}
              className={`w-full flex items-center gap-3 py-2.5 text-sm transition-colors ${collapsed ? 'md:justify-center md:px-0 px-5' : 'px-5'} ${view === i.key ? 'text-white bg-white/[0.05] border-r-2 border-[--red]' : 'text-[--dark-muted] hover:text-white'}`}>
              <span className="w-4 grid place-items-center shrink-0"><NavIcon name={i.key} /></span>
              <span className={collapsed ? 'md:hidden' : ''}>{i.label}</span>
            </button>
          ))}
          <button onClick={() => { setView('profile'); setSidebarOpen(false); }}
            className="md:hidden w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[--dark-muted] hover:text-white transition-colors">
            <span className="w-4 grid place-items-center shrink-0"><NavIcon name="profile" /></span>Profile
          </button>
          <button onClick={signOut}
            className="md:hidden w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[--dark-muted] hover:text-white transition-colors">
            <span className="w-4 grid place-items-center shrink-0" aria-hidden>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" />
              </svg>
            </span>Sign out
          </button>
          {me?.user.isPlatformAdmin && (
            <button onClick={() => { navigate('/admin'); setSidebarOpen(false); }}
              title={collapsed ? 'Admin' : undefined}
              className={`w-full flex items-center gap-3 py-2.5 text-sm text-[--dark-muted] hover:text-white transition-colors ${collapsed ? 'md:justify-center md:px-0 px-5' : 'px-5'}`}>
              <span className="w-4 grid place-items-center shrink-0"><NavIcon name="admin" /></span>
              <span className={collapsed ? 'md:hidden' : ''}>Admin</span>
            </button>
          )}
        </nav>

        {/* The control-plane footer is text-only, so it has nowhere to go when
            the rail is 64px wide — the beacon alone still answers "is the API
            up?", which is the part worth keeping. */}
        <div className={`border-t border-[--dark-line] font-mono2 text-[10px] text-[--dark-muted] space-y-1 ${collapsed ? 'md:p-3 md:text-center p-5' : 'p-5'}`}>
          <p className={`flex items-center gap-1.5 ${collapsed ? 'md:justify-center' : ''}`}
            title={collapsed ? (apiOk === false ? 'API unreachable' : 'API reachable') : undefined}>
            {apiOk === true
              ? <span className="beacon inline-block w-1.5 h-1.5 rounded-full text-[#57C99A] bg-[#57C99A]" aria-hidden />
              : <span className={apiOk === false ? 'text-[--red]' : 'text-[--dark-muted]'}>●</span>}
            <span className={collapsed ? 'md:hidden' : ''}>
              {apiOk === false ? 'API unreachable' : apiOk === null ? 'Checking API…' : 'API reachable'}
            </span>
          </p>
          <p className={collapsed ? 'md:hidden' : ''}>Control plane · {API_URL.replace(/^https?:\/\//, '')}</p>
        </div>
      </aside>
      {/* main */}
      <div className="flex-1 min-w-0">
        <header className="h-16 border-b border-[--dark-line] flex items-center justify-between px-5 sticky top-0 bg-[--dark]/95 backdrop-blur z-30">
          {/* min-w-0 so a long team name truncates instead of shoving the
              right-hand chips off the header. */}
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => setSidebarOpen(true)} aria-label="Open menu"
              className="md:hidden text-[--dark-muted] hover:text-white shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            {/* The wordmark is in the drawer on a phone; repeating it here
                only competed with the team name for the same few pixels. */}
            <span className="hidden sm:block md:hidden"><Logo dark onClick={() => navigate('/')} /></span>
            {/* The team switcher is shown at every width: with multi-team
                support, "which team am I acting in" is not a desktop-only
                question, and on a phone it was previously invisible. */}
            <div className="flex items-center gap-2 min-w-0">
              <TeamSwitcher
                current={teamName}
                onSwitched={() => { void refresh(); api<TeamInfo>('/teams/me').then(setTeamInfo).catch(() => setTeamInfo(null)); }}
              />
              <span className="hidden lg:block font-mono2 text-xs uppercase tracking-widest text-[--dark-muted] whitespace-nowrap">/ {titles[view]}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {trialDaysLeft !== null && (
              <button
                onClick={() => { if (isAdmin) setView('billing'); }}
                disabled={!isAdmin}
                title={isAdmin
                  ? 'Free trial — parallel environments drop to 0 when it ends'
                  : 'Free trial — parallel environments drop to 0 when it ends. Only owners and admins can change the plan.'}
                // whitespace-nowrap is the actual fix: these chips used to wrap
                // to three lines inside a fixed 64px header between 768px and
                // ~1000px, overflowing the band. They now stay one line and
                // simply don't appear until there's room for them.
                className={`hidden xl:block font-mono2 text-[10px] border px-2 py-1 whitespace-nowrap transition-colors ${
                  isAdmin ? '' : 'cursor-default'
                } ${
                  trialDaysLeft <= 3
                    ? `border-[--red]/50 text-[#F07A6A] ${isAdmin ? 'hover:border-[--red]' : ''}`
                    : `border-[#E8B44C]/40 text-[#E8B44C] ${isAdmin ? 'hover:border-[#E8B44C]' : ''}`
                }`}
              >
                {trialDaysLeft > 0 ? `Trial: ${trialDaysLeft}d left` : 'Trial ended'}
              </button>
            )}
            <span className="hidden xl:block font-mono2 text-[10px] border border-[--dark-line] px-2 py-1 text-[--dark-muted] whitespace-nowrap">{planLabel} · {limit} env{limit === 1 ? '' : 's'}</span>
            <NotificationBell trialDaysLeft={trialDaysLeft} onTrialClick={isAdmin ? () => setView('billing') : null} />
            {/* Account menu. "Sign out" used to sit as loose text between the
                bell and the avatar, which put a rare, destructive action in the
                middle of the two things people actually click, and left three
                mismatched shapes in a row. It now lives behind the avatar,
                where every other product puts it. */}
            <AccountMenu
              email={me?.user.email ?? ''}
              initials={initials}
              active={view === 'profile'}
              onProfile={() => setView('profile')}
              onBilling={isAdmin ? () => setView('billing') : null}
              onSignOut={signOut}
            />
          </div>
        </header>
        {/* mobile nav */}
        <div className="md:hidden flex overflow-x-auto border-b border-[--dark-line]">
          {items.map((i) => (
            <button key={i.key} onClick={() => setView(i.key)}
              className={`shrink-0 px-4 py-2.5 font-mono2 text-[11px] ${view === i.key ? 'text-white border-b-2 border-[--red]' : 'text-[--dark-muted]'}`}>{i.label}</button>
          ))}
        </div>
        <main className="p-5 lg:p-8">
          {trialDaysLeft !== null && <TrialBanner daysLeft={trialDaysLeft} onUpgrade={isAdmin ? () => setView('billing') : null} />}
          <StatusBanner />
          {/* Keyed on the team as well as the view.
              Keyed on the view alone, switching teams left every card mounted
              and therefore showing the team you just left: the tokens list, the
              member list, invoices, the security policy, webhooks. Each of them
              loads once on mount with no dependency on which team is current,
              so nothing ever told them to look again — the same fault as the
              switcher's cached list, one level up and with more on screen.
              Changing the key remounts them, which is the one signal a
              load-on-mount component understands.
              me.team.id rather than teamInfo's: it is already resolved when the
              dashboard first renders, so the initial mount doesn't immediately
              remount and fetch everything twice. onSwitched refreshes it. */}
          <div key={`${view}:${me?.team?.id ?? 'none'}`} className="view-in">
            {restricted ? (
              <RestrictedView view={view} teamName={teamName} onBack={() => setView('overview')} />
            ) : <>
              {view === 'overview' && <Overview limit={limit} planLabel={planLabel} goView={setView} canUpgrade={isAdmin} />}
              {view === 'pipelines' && <Pipelines />}
              {view === 'tokens' && <Tokens />}
              {view === 'billing' && <Billing />}
              {view === 'team' && <Team />}
              {view === 'settings' && (
                <Settings teamName={teamName} myRole={teamInfo?.team.myRole} auditLog={teamInfo?.team.auditLog ?? false}
                  onRenamed={() => { void refresh(); api<TeamInfo>('/teams/me').then(setTeamInfo).catch(() => {}); }} />
              )}
              {view === 'profile' && (
                <Profile email={me?.user.email ?? '—'} verified={me?.user.emailVerified ?? false} />
              )}
            </>}
          </div>
        </main>
      </div>
    </div>
  );
}
