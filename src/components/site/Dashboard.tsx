import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  API_URL, ApiError, LEVEL_META, api,
  type ApiTokenInfo, type AuditEntry, type ContainerInfo, type CreatedToken, type EnvironmentContainers,
  type EnvironmentDetail, type EnvironmentInfo, type EnvironmentRun, type InvoiceInfo, type ReferralInfo,
  type StatusSummary, type SubscriptionInfo, type TeamInfo, type UsageTimeseries,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuditList, Logo, useCountUp } from './Shared';

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
function NotificationBell({ trialDaysLeft, onTrialClick }: { trialDaysLeft: number | null; onTrialClick: () => void }) {
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
      body: trialDaysLeft > 0 ? 'Upgrade before it lapses to keep running environments.' : 'Upgrade to run environments again.',
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

type View = 'overview' | 'pipelines' | 'tokens' | 'billing' | 'team' | 'settings';
const VIEWS: View[] = ['overview', 'pipelines', 'tokens', 'billing', 'team', 'settings'];

const statusStyle: Record<string, string> = {
  assigned: 'text-[#57C99A] border-[#57C99A]/40',
  failed: 'text-[#F07A6A] border-[#F07A6A]/40',
  queued: 'text-[#E8B44C] border-[#E8B44C]/40',
  released: 'text-[--dark-muted] border-[--dark-line]',
};

function Badge({ s }: { s: string }) {
  return <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${statusStyle[s] ?? 'text-[--dark-muted] border-[--dark-line]'}`}>{s === 'assigned' && <span className="pulse-dot mr-1">●</span>}{s}</span>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[--dark-card] border border-[--dark-line] ${className}`}>{children}</div>;
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
  const days = series.days;
  const max = Math.max(1, ...days.map((d) => d.starts + d.failures));
  const total = days.reduce((s, d) => s + d.starts, 0);
  const failed = days.reduce((s, d) => s + d.failures, 0);
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
          </>
        )}
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
    ['Docker endpoint', detail.dockerEndpoint ?? '—'],
  ] : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md h-full bg-[--dark-card] border-l border-[--dark-line] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[--dark-card] border-b border-[--dark-line] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Environment</p>
            <p className="font-mono2 text-sm mt-0.5">{detail?.vmId ?? requestId.slice(0, 12)}</p>
          </div>
          <button onClick={onClose} className="font-mono2 text-xs text-[--dark-muted] hover:text-white border border-[--dark-line] px-3 py-1.5">Close ✕</button>
        </div>

        <div className="p-5 grid gap-2">
          {detail ? meta.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted] shrink-0">{k}</span>
              <span className="font-mono2 text-xs text-right break-all">{v}</span>
            </div>
          )) : <Skeleton className="h-24 w-full" />}
        </div>

        <div className="px-5 pb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Containers</p>
            {data && <span className={`font-mono2 text-[10px] ${data.reachable ? 'text-[#57C99A]' : 'text-[#E8B44C]'}`}>{data.reachable ? '● live' : 'unreachable'}</span>}
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
                      <span key={p.publicPort} className="font-mono2 text-[10px] text-[#8AB8F0] border border-[#8AB8F0]/30 px-1.5 py-0.5" title={`container :${p.privatePort}`}>→ localhost:{p.publicPort}</span>
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

function Overview({ limit, planLabel, goView }: { limit: number; planLabel: string; goView: (v: View) => void }) {
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
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { k: 'Plan', text: planLabel, s: 'manage under Usage & billing' },
          { k: 'Parallelism limit', num: limit, s: `environment${limit === 1 ? '' : 's'} at once` },
          { k: 'Active now', num: envs ? active : null, s: 'assigned microVMs' },
          { k: 'Queued', num: envs ? queued : null, s: 'waiting for a free slot' },
        ] as const).map((c) => (
          <Card key={c.k} className="p-5 accent-top lift">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">{c.k}</p>
            {'text' in c
              ? <p className="font-doto text-4xl mt-2">{c.text}</p>
              : <CountStat value={c.num ?? (err ? 0 : null)} />}
            <p className="text-xs text-[--dark-muted] mt-1">{c.s}</p>
          </Card>
        ))}
      </div>
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
          {envs?.length === 0 && (
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
          {envs?.map((e, i) => (
            <div key={e.requestId} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              className="row-in grid grid-cols-[1fr_auto] sm:grid-cols-[1.3fr_1fr_110px_auto_auto] gap-3 items-center px-5 py-3.5 font-mono2 text-xs hover:bg-white/[0.02]">
              <button onClick={() => e.status === 'assigned' && setDrawer(e.requestId)}
                className={`text-left ${e.status === 'assigned' ? 'cursor-pointer' : 'cursor-default'}`}
                title={e.status === 'assigned' ? 'View containers & details' : undefined}>
                <p className="font-sans text-sm font-medium">{e.vmId ?? 'waiting for slot'}{e.status === 'assigned' && <span className="text-[#8AB8F0] ml-2">details ↗</span>}</p>
                <p className="text-[11px] text-[--dark-muted]">{e.requestId}</p>
              </button>
              <span className="text-[--dark-muted] hidden sm:block break-all">{e.dockerEndpoint ?? '—'}</span>
              <span className="text-[--dark-muted] hidden sm:block">{fmtAgo(e.requestedAt)}</span>
              <Badge s={e.status} />
              <button onClick={() => release(e.requestId)} disabled={busy === e.requestId}
                className="font-mono2 text-[10px] border border-[#F07A6A]/40 text-[#F07A6A] px-3 py-1.5 hover:bg-[#F07A6A]/10 disabled:opacity-50">
                {busy === e.requestId ? '…' : 'Release'}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {usage && <UsageChart series={usage} />}

      {/* Run history — past (released/failed) runs, collapsed by default noise. */}
      {runs && runs.length > 0 && (
        <Card>
          <CardHead title="Run history" right={<span className="font-mono2 text-[10px] text-[--dark-muted]">last {runs.length}</span>} />
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
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
        </Card>
      )}
    </div>
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
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api<{ tokens: ApiTokenInfo[] }>('/tokens').then((d) => setTokens(d.tokens)).catch(() => setErr('Could not load tokens.'));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    setErr('');
    if (!label.trim()) { setErr('Please give the token a label.'); return; }
    try {
      const tok = await api<CreatedToken>('/tokens', { body: { label, scope } });
      setCreated(tok);
      setCreating(false);
      setLabel('');
      load();
    } catch {
      setErr('Token could not be created.');
    }
  };

  const revoke = async (id: string) => {
    setErr('');
    try {
      await api(`/tokens/${id}`, { method: 'DELETE' });
      if (created?.id === id) setCreated(null);
      load();
    } catch {
      setErr('Could not revoke this token — please try again.');
    }
  };

  return (
    <div className="grid gap-5">
      <Card>
        <CardHead title="API tokens" right={<button onClick={() => { setCreating(true); setCreated(null); }} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">+ Create token</button>} />
        <div className="divide-y divide-[--dark-line]">
          {tokens === null && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">Loading …</p>}
          {tokens?.length === 0 && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">No tokens yet — create one for your CI.</p>}
          {tokens?.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_150px_130px_120px_auto] gap-3 items-center px-5 py-3.5 text-sm">
              <div>
                <p className="font-medium">{t.label}</p>
                <p className="font-mono2 text-[11px] text-[--dark-muted]">{t.prefix}</p>
              </div>
              <span className="font-mono2 text-[11px] text-[--dark-muted] hidden sm:block">Scope: {t.scope}</span>
              <div className="hidden sm:flex items-center gap-2" title={`${t.runsTotal ?? 0} runs in the last 14 days`}>
                {t.usage && t.usage.length > 0
                  ? <><Sparkline data={t.usage} /><span className="font-mono2 text-[10px] text-[--dark-muted]">{t.runsTotal} · 14d</span></>
                  : <span className="font-mono2 text-[11px] text-[--dark-muted]">{fmtAgo(t.lastUsedAt)}</span>}
              </div>
              <span className="font-mono2 text-[11px] text-[--dark-muted] hidden sm:block">{fmtDate(t.createdAt)}</span>
              <button onClick={() => revoke(t.id)} className="font-mono2 text-[10px] border border-[#F07A6A]/40 text-[#F07A6A] px-3 py-1.5 hover:bg-[#F07A6A]/10">Revoke</button>
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
            <button onClick={create} className="font-mono2 text-[10px] border border-white px-4 py-2.5 hover:bg-white hover:text-[--dark]">Create</button>
          </div>
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
    </div>
  );
}

/* ---------- Billing: real data ---------- */

const TIER_CARDS = [
  { tier: 'solo' as const, name: 'Solo', chf: 19, envs: 2, vcpu: 2, ramGb: 4 },
  { tier: 'team' as const, name: 'Team', chf: 79, envs: 5, vcpu: 4, ramGb: 8 },
  { tier: 'scale' as const, name: 'Scale', chf: 249, envs: 8, vcpu: 6, ramGb: 12 },
];

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

  const checkout = async (tier: 'solo' | 'team' | 'scale') => {
    setBusy(tier);
    setErr('');
    try {
      const { url } = await api<{ url: string }>('/billing/checkout', { body: { tier, interval: yearly ? 'yearly' : 'monthly' } });
      window.location.href = url;
    } catch {
      setErr('Checkout could not be started — is Stripe configured?');
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
                  {isPaid && ` · CHF ${sub.chfMonthly} / month`}
                  {isPaid && sub.subscription?.currentPeriodEnd && ` · Renews on ${fmtDate(sub.subscription.currentPeriodEnd)}`}
                  {!isPaid && sub.trialEndsAt && ` · Trial ends ${fmtDate(sub.trialEndsAt)}`}
                </p>
                <p className="font-mono2 text-[11px] text-[--dark-muted] mt-1">
                  up to {sub.vcpuPerEnvironment} vCPU / {sub.ramGbPerEnvironment} GB per environment · max {sub.maxFootprintGb} GB total
                </p>
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
              {invoices?.length === 0 && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">No invoices yet.</p>}
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
            {TIER_CARDS.map((t) => (
              <div key={t.tier} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="font-mono2 text-[11px] text-[--dark-muted]">
                    {t.envs} environments · {t.vcpu} vCPU / {t.ramGb} GB each · CHF {yearly ? Math.round(t.chf * 0.83) : t.chf}/mo{yearly ? ' (billed yearly)' : ''}
                  </p>
                </div>
                {sub.planTier === t.tier ? (
                  <span className="font-mono2 text-[10px] border border-[#57C99A]/50 text-[#57C99A] px-3 py-1.5">Current</span>
                ) : isPaid ? (
                  <button onClick={openPortal} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">Via portal</button>
                ) : (
                  <button onClick={() => checkout(t.tier)} disabled={!!busy} className="font-mono2 text-[10px] border border-white px-3 py-1.5 hover:bg-white hover:text-[--dark] disabled:opacity-50">
                    {busy === t.tier ? '…' : 'Choose'}
                  </button>
                )}
              </div>
            ))}
          </div>
          {err && <p className="px-5 py-3 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        </Card>
      </div>
    </div>
  );
}

/* ---------- Team: real data ---------- */

function Team() {
  const [info, setInfo] = useState<TeamInfo | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [inviteMail, setInviteMail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'admin'>('developer');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api<TeamInfo>('/teams/me').then(setInfo).catch(() => setErr('Could not load team.'));
  }, []);
  useEffect(load, [load]);

  const canManage = info && info.team.myRole !== 'developer';

  // The activity log is admin/owner-only server-side; fetch once we know the role.
  useEffect(() => {
    if (canManage && audit === null) {
      api<{ entries: AuditEntry[] }>('/teams/me/audit').then((d) => setAudit(d.entries)).catch(() => setAudit([]));
    }
  }, [canManage, audit]);

  const invite = async () => {
    setErr('');
    setMsg('');
    if (!inviteMail.includes('@')) { setErr('Please enter a valid email address.'); return; }
    try {
      await api('/teams/me/invites', { body: { email: inviteMail, role: inviteRole } });
      setMsg(`Invitation sent to ${inviteMail}.`);
      setInviteMail('');
      setInviting(false);
      load();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'already_member' ? 'This person is already on the team.' : 'Invitation could not be sent.');
    }
  };

  if (err && !info) return <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>;
  if (!info) return <p className="font-mono2 text-xs text-[--dark-muted]">Loading …</p>;

  return (
    <div className="grid gap-5 max-w-4xl">
      <div className="grid gap-5">
        <Card>
          <CardHead title={`Members (${info.members.length})`} right={
            canManage ? <button onClick={() => setInviting((v) => !v)} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">+ Invite</button> : undefined
          } />
          <div className="divide-y divide-[--dark-line]">
            {info.members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="font-doto w-9 h-9 grid place-items-center border border-[--dark-line] text-sm">{m.email.slice(0, 2).toUpperCase()}</span>
                  <div><p className="text-sm font-medium">{m.email}</p><p className="font-mono2 text-[11px] text-[--dark-muted]">joined {fmtDate(m.joinedAt)}</p></div>
                </div>
                <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${m.role === 'owner' ? 'border-[--red] text-[--red]' : 'border-[--dark-line] text-[--dark-muted]'}`}>{m.role}</span>
              </div>
            ))}
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
                <div key={i.id} className="flex items-center justify-between px-5 py-3 font-mono2 text-xs">
                  <span>{i.email}</span>
                  <span className="text-[--dark-muted]">{i.role} · expires {fmtDate(i.expiresAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {canManage && audit && audit.length > 0 && (
          <Card>
            <CardHead title="Activity log" right={<span className="font-mono2 text-[10px] text-[--dark-muted]">recent</span>} />
            <AuditList entries={audit} />
          </Card>
        )}
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

function Settings({ teamName, myRole, onRenamed }: { teamName: string; myRole?: 'owner' | 'admin' | 'developer'; onRenamed: () => void }) {
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
    <div className="grid gap-5 max-w-2xl">
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
      {myRole === 'owner' && <DeleteTeamCard teamName={teamName} />}
    </div>
  );
}

/* ---------- Shell ---------- */

export default function Dashboard() {
  const navigate = useNavigate();
  const { view: viewParam } = useParams<{ view: string }>();
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : 'overview';
  const { me, refresh, logout } = useAuth();
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const apiOk = useApiHealth();

  useEffect(() => {
    api<TeamInfo>('/teams/me').then(setTeamInfo).catch(() => setTeamInfo(null));
  }, [me?.team?.id]);

  const setView = (v: View) => navigate(v === 'overview' ? '/app' : `/app/${v}`);
  const signOut = async () => { await logout(); navigate('/'); };

  const items: { key: View; label: string; icon: string }[] = [
    { key: 'overview', label: 'Environments', icon: '▦' },
    { key: 'pipelines', label: 'CI pipelines', icon: '⛓' },
    { key: 'tokens', label: 'API tokens', icon: '⌘' },
    { key: 'billing', label: 'Usage & billing', icon: '▤' },
    { key: 'team', label: 'Team', icon: '◉' },
    { key: 'settings', label: 'Settings', icon: '⚙' },
  ];
  const titles: Record<View, string> = {
    overview: 'Environments', pipelines: 'CI pipelines',
    tokens: 'API tokens', billing: 'Usage & billing', team: 'Team', settings: 'Settings',
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

  // Invited users who registered but haven't accepted their invite yet have no team.
  if (me && !me.team) {
    return (
      <div className="min-h-screen bg-[--dark] text-[--dark-text] grid place-items-center p-8">
        <div className="max-w-md text-center">
          <Logo dark onClick={() => navigate('/')} />
          <p className="mt-6 text-sm text-[--dark-muted]">
            Your account has no team yet. If you were invited, open the invitation link from your email to join the team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[--dark] text-[--dark-text] flex">
      {/* sidebar */}
      <aside className="w-56 shrink-0 border-r border-[--dark-line] hidden md:flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-[--dark-line]"><Logo dark onClick={() => navigate('/')} /></div>
        <nav className="flex-1 py-3">
          {items.map((i) => (
            <button key={i.key} onClick={() => setView(i.key)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${view === i.key ? 'text-white bg-white/[0.05] border-r-2 border-[--red]' : 'text-[--dark-muted] hover:text-white'}`}>
              <span className="w-4 text-center">{i.icon}</span>{i.label}
            </button>
          ))}
          {me?.user.isPlatformAdmin && (
            <button onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[--dark-muted] hover:text-white transition-colors">
              <span className="w-4 text-center">◆</span>Admin
            </button>
          )}
        </nav>
        <div className="p-5 border-t border-[--dark-line] font-mono2 text-[10px] text-[--dark-muted] space-y-1">
          <p className="flex items-center gap-1.5">
            {apiOk === true
              ? <span className="beacon inline-block w-1.5 h-1.5 rounded-full text-[#57C99A] bg-[#57C99A]" aria-hidden />
              : <span className={apiOk === false ? 'text-[--red]' : 'text-[--dark-muted]'}>●</span>}
            {apiOk === false ? 'API unreachable' : apiOk === null ? 'Checking API…' : 'API reachable'}
          </p>
          <p>Control plane · {API_URL.replace(/^https?:\/\//, '')}</p>
        </div>
      </aside>
      {/* main */}
      <div className="flex-1 min-w-0">
        <header className="h-16 border-b border-[--dark-line] flex items-center justify-between px-5 sticky top-0 bg-[--dark]/95 backdrop-blur z-30">
          <div className="flex items-center gap-4">
            <span className="md:hidden"><Logo dark onClick={() => navigate('/')} /></span>
            <h1 className="hidden md:block font-mono2 text-xs uppercase tracking-widest text-[--dark-muted]">{teamName} / {titles[view]}</h1>
          </div>
          <div className="flex items-center gap-4">
            {trialDaysLeft !== null && (
              <button
                onClick={() => setView('billing')}
                title="Free trial — parallel environments drop to 0 when it ends"
                className={`hidden sm:block font-mono2 text-[10px] border px-2 py-1 transition-colors ${
                  trialDaysLeft <= 3
                    ? 'border-[--red]/50 text-[#F07A6A] hover:border-[--red]'
                    : 'border-[#E8B44C]/40 text-[#E8B44C] hover:border-[#E8B44C]'
                }`}
              >
                {trialDaysLeft > 0 ? `Trial: ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left` : 'Trial ended — upgrade to run'}
              </button>
            )}
            <span className="hidden sm:block font-mono2 text-[10px] border border-[--dark-line] px-2 py-1 text-[--dark-muted]">Plan: {planLabel} · {limit} env{limit === 1 ? '' : 's'}</span>
            <NotificationBell trialDaysLeft={trialDaysLeft} onTrialClick={() => setView('billing')} />
            <button onClick={signOut} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white">Sign out</button>
            <span className="font-doto w-8 h-8 grid place-items-center border border-[--dark-line] text-xs" title={me?.user.email}>{initials}</span>
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
          <StatusBanner />
          <div key={view} className="view-in">
            {view === 'overview' && <Overview limit={limit} planLabel={planLabel} goView={setView} />}
            {view === 'pipelines' && <Pipelines />}
            {view === 'tokens' && <Tokens />}
            {view === 'billing' && <Billing />}
            {view === 'team' && <Team />}
            {view === 'settings' && (
              <Settings teamName={teamName} myRole={teamInfo?.team.myRole} onRenamed={() => { void refresh(); api<TeamInfo>('/teams/me').then(setTeamInfo).catch(() => {}); }} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
