import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  api, type AdminActivity, type AdminBackups, type AdminErrors, type AdminHost, type AdminHostDetail, type AdminHostUsage, type AdminOverview, type AdminStatusComponent,
  type AdminSystemHealth, type AdminTeam, type AdminTeamDetail, type AdminTimeseries, type AdminUser, type AuditEntry, type PlanTier,
  type PostType, type StatusLevel, type StatusPost,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuditList, Logo } from './Shared';

const COMPONENT_LEVELS: StatusLevel[] = ['operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance'];
const STATES_BY_TYPE: Record<PostType, string[]> = {
  incident: ['investigating', 'identified', 'monitoring', 'resolved'],
  maintenance: ['scheduled', 'in_progress', 'completed'],
  announcement: ['published'],
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[--dark-card] border border-[--dark-line] ${className}`}>{children}</div>;
}

function CardHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[--dark-line]">
      <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">{title}</p>
      {right}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">{label}</p>
      <p className="font-doto text-4xl mt-2">{value}</p>
      {sub && <p className="text-xs text-[--dark-muted] mt-1">{sub}</p>}
    </Card>
  );
}

/**
 * Promise against reality, in one track.
 *
 * The whole point of the measurement work is the gap between what plans
 * committed and what the hardware is doing, so showing them as two separate
 * bars — or worse, averaging them into one "utilisation" figure — would hide
 * exactly the thing being looked for. The muted band is what was promised; the
 * solid fill inside it is what is actually used. The distance between their
 * right edges is the headroom an overcommit factor would spend.
 */
function DualUtilBar({ committed, actual, total, unit, decimals = 0 }: {
  committed: number; actual: number | null; total: number; unit: string; decimals?: number;
}) {
  const pct = (v: number) => (total > 0 ? Math.min(100, (v / total) * 100) : 0);
  const fmt = (v: number) => v.toFixed(decimals);
  // Severity follows actual load where it's known, and falls back to committed
  // where it isn't — an unmeasured host at 95% committed should still look hot.
  const severityPct = pct(actual ?? committed);
  const fill = severityPct >= 85 ? 'bg-[--red]' : severityPct >= 60 ? 'bg-[#E8B44C]' : 'bg-[#57C99A]/80';

  return (
    <div>
      <div className="relative h-2.5 bg-white/[0.08] border border-[--dark-line]">
        <div className="absolute inset-y-0 left-0 bg-white/[0.20]" style={{ width: `${pct(committed)}%` }}
          title={`Promised: ${fmt(committed)} ${unit}`} />
        {actual !== null && (
          <div className={`absolute inset-y-0 left-0 ${fill}`} style={{ width: `${pct(actual)}%` }}
            title={`Actually used: ${fmt(actual)} ${unit}`} />
        )}
      </div>
      <p className="font-mono2 text-[10px] text-[--dark-muted] mt-1">
        {actual !== null
          ? <>used <span className="text-[--dark-text]">{fmt(actual)}</span> · promised {fmt(committed)} / {fmt(total)} {unit}</>
          : <>promised <span className="text-[--dark-text]">{fmt(committed)}</span> / {fmt(total)} {unit} · not measured</>}
      </p>
    </div>
  );
}

/** One number with a label, for the capacity grid. */
function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="border border-[--dark-line] p-3">
      <p className="font-mono2 text-[9px] uppercase tracking-widest text-[--dark-muted]">{label}</p>
      <p className={`font-mono2 text-lg mt-1 ${tone ?? ''}`}>{value}</p>
      {hint && <p className="font-mono2 text-[10px] text-[--dark-muted] mt-0.5">{hint}</p>}
    </div>
  );
}

const gb = (mb: number | null | undefined) => (mb == null ? '—' : `${(mb / 1024).toFixed(1)} GB`);

/**
 * The panel the measurement week exists for.
 *
 * Committed, granted and used are three different things that get conflated
 * constantly, and the ratio at the bottom is the one that becomes an overcommit
 * factor. Host available is separated out because it is the only number here
 * the guests cannot see — it includes host page cache, the agent and the
 * registry mirror, all competing for the same RAM as the next VM.
 */
function HostCapacityPanel({ usage, ramTotalMb, cpuTotal }: {
  usage: AdminHostUsage | null; ramTotalMb: number; cpuTotal: number;
}) {
  if (!usage) {
    return (
      <div className="border border-[--dark-line] p-4">
        <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-2">Measured capacity</p>
        <p className="text-sm text-[--dark-muted]">
          This host has never reported measured usage — its agent predates memory/CPU telemetry.
          Only committed figures are available for it.
        </p>
      </div>
    );
  }

  const { ramCommittedMb: committed, ramGuestUsedMb: used } = usage;
  const ratio = committed && used !== null && committed > 0 ? Math.round((used / committed) * 100) : null;

  return (
    <div className="border border-[--dark-line] p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Measured capacity</p>
        <p className={`font-mono2 text-[10px] ${usage.stale ? 'text-[#E8B44C]' : 'text-[--dark-muted]'}`}>
          {usage.stale ? `stale — last measured ${fmtAgo(usage.measuredAt)}` : `measured ${fmtAgo(usage.measuredAt)}`}
        </p>
      </div>

      {usage.stale && (
        <p className="font-mono2 text-[10px] text-[#E8B44C] mb-3 max-w-[70ch]">
          The agent stopped reporting. These numbers describe the host as it was, not as it is —
          fine to read, not safe to schedule against.
        </p>
      )}

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        <Stat label="Promised" value={gb(committed)} hint="what plans entitle" />
        <Stat label="Grantable" value={gb(usage.ramGrantedMb)} hint="guests can touch now" />
        <Stat label="Guest used" value={gb(used)} hint="reported in use" />
        <Stat label="Host free" value={gb(usage.ramHostAvailableMb)} hint={`of ${gb(ramTotalMb)} physical`} />
      </div>

      {ratio !== null && (
        <p className="mt-3 text-sm">
          Guests are using <strong className="text-white">{ratio}%</strong> of what they were promised
          {usage.ramReclaimedMb ? <> · balloons hold back <strong className="text-white">{gb(usage.ramReclaimedMb)}</strong></> : null}
        </p>
      )}

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 mt-3">
        <Stat label="CPU busy" value={usage.cpuBusyPct == null ? '—' : `${usage.cpuBusyPct}%`} hint="host-wide, excl. iowait" />
        <Stat label="vCPU used" value={usage.cpuUsedActual == null ? '—' : usage.cpuUsedActual.toFixed(2)}
          hint={`of ${cpuTotal} physical`} />
        <Stat label="Throttled VMs" value={usage.cpuThrottledVms == null ? '—' : String(usage.cpuThrottledVms)}
          hint="hit their CPU cap"
          tone={usage.cpuThrottledVms ? 'text-[#E8B44C]' : undefined} />
      </div>
      {!!usage.cpuThrottledVms && (
        <p className="font-mono2 text-[10px] text-[#E8B44C] mt-2 max-w-[70ch]">
          Those guests were slowed by our own cpu.max quota, not by their own code — the one signal
          here that describes a customer's experience rather than our capacity.
        </p>
      )}
    </div>
  );
}

const hostStatusStyle: Record<string, string> = {
  online: 'text-[#57C99A] border-[#57C99A]/40',
  draining: 'text-[#E8B44C] border-[#E8B44C]/40',
  offline: 'text-[--dark-muted] border-[--dark-line]',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CH', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Relative age. Measurements are only meaningful next to how old they are —
 *  "40 GB free" and "40 GB free as of an hour ago" are different claims. */
function fmtAgo(iso: string | null): string {
  if (!iso) return 'never';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}

function EditHostModal({ host, onCancel, onSaved }: { host: AdminHost; onCancel: () => void; onSaved: (h: AdminHost) => void }) {
  const [cpu, setCpu] = useState(String(host.cpu.total));
  const [ramGb, setRamGb] = useState(String(Math.round(host.ramMb.total / 1000)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cpuTotal = Number(cpu);
  const ramTotalMb = Number(ramGb) * 1000;
  const valid = Number.isInteger(cpuTotal) && cpuTotal > 0 && Number.isFinite(ramTotalMb) && ramTotalMb > 0;

  async function handleSave() {
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/admin/hosts/${host.id}`, { method: 'PATCH', body: { cpuTotal, ramTotalMb } });
      onSaved({ ...host, cpu: { ...host.cpu, total: cpuTotal }, ramMb: { ...host.ramMb, total: ramTotalMb } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-5" onClick={onCancel}>
      <div className="bg-[--dark-card] border border-[--dark-line] max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Edit capacity</p>
        <h3 className="mt-2 font-semibold text-lg">{host.name}</h3>
        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Total vCPU</span>
            <input value={cpu} onChange={(e) => setCpu(e.target.value)} type="number" min="1"
              className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm font-mono2 focus:outline-none focus:border-white" />
          </label>
          <label className="block">
            <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Total RAM (GB)</span>
            <input value={ramGb} onChange={(e) => setRamGb(e.target.value)} type="number" min="1"
              className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm font-mono2 focus:outline-none focus:border-white" />
          </label>
        </div>
        {err && <p className="mt-3 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onCancel} className="font-mono2 text-xs text-[--dark-muted] hover:text-white px-3 py-2">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!valid || busy}
            className="font-mono2 text-xs px-4 py-2 border border-white hover:bg-white hover:text-[--dark] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Read-only drill-down for one host: capacity, the environments currently
 *  placed on it, and the most recent failed starts that named it. */
function HostDetailModal({ host, onCancel }: { host: AdminHost; onCancel: () => void }) {
  const [detail, setDetail] = useState<AdminHostDetail | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    api<AdminHostDetail>(`/admin/hosts/${host.id}/detail`)
      .then((d) => { if (alive) setDetail(d); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : 'Could not load host.'); });
    return () => { alive = false; };
  }, [host.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-start justify-center px-4 py-10 overflow-y-auto" onClick={onCancel}>
      <div className="bg-[--dark-card] border border-[--dark-line] max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-[--dark-line]">
          <div>
            <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Host detail</p>
            <h3 className="mt-1 font-semibold text-lg font-mono2">{host.name}</h3>
          </div>
          <button onClick={onCancel} className="font-mono2 text-xs text-[--dark-muted] hover:text-white">Close</button>
        </div>

        {err && <p className="px-6 py-5 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        {!detail && !err && <p className="px-6 py-5 font-mono2 text-xs text-[--dark-muted]">Loading …</p>}

        {detail && (
          <div className="p-6 grid gap-6">
            {/* status + capacity */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border border-[--dark-line] p-4">
                <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-2">Status</p>
                <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${hostStatusStyle[detail.host.status]}`}>{detail.host.status}</span>
                {detail.host.drain && <span className="ml-2 font-mono2 text-[10px] uppercase tracking-wider border border-[#E8B44C]/40 text-[#E8B44C] px-2 py-0.5">draining</span>}
                <p className="mt-2 font-mono2 text-[10px] text-[--dark-muted]">{detail.host.location}</p>
                <p className="mt-1 font-mono2 text-[10px] text-[--dark-muted]">Heartbeat {detail.host.lastHeartbeat ? fmtDateTime(detail.host.lastHeartbeat) : 'never'}</p>
                {detail.host.offlineAlertedAt && (
                  <p className="mt-1 font-mono2 text-[10px] text-[#F07A6A]">Offline alert sent {fmtDateTime(detail.host.offlineAlertedAt)}</p>
                )}
              </div>
              <div className="border border-[--dark-line] p-4 grid gap-3">
                <div>
                  <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-1">CPU</p>
                  <DualUtilBar committed={detail.host.cpu.used}
                    actual={detail.host.usage?.stale ? null : detail.host.usage?.cpuUsedActual ?? null}
                    total={detail.host.cpu.total} unit="vCPU" decimals={2} />
                </div>
                <div>
                  <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-1">RAM</p>
                  <DualUtilBar committed={detail.host.ramMb.used / 1024}
                    actual={detail.host.usage?.stale || detail.host.usage?.ramGuestUsedMb == null
                      ? null : detail.host.usage.ramGuestUsedMb / 1024}
                    total={detail.host.ramMb.total / 1024} unit="GB" decimals={1} />
                </div>
                <p className="font-mono2 text-[10px] text-[--dark-muted]">
                  Cache hit rate: {detail.host.cacheHitRate == null ? '—' : `${(detail.host.cacheHitRate * 100).toFixed(1)}%`}
                </p>
              </div>
            </div>

            <HostCapacityPanel usage={detail.host.usage} ramTotalMb={detail.host.ramMb.total} cpuTotal={detail.host.cpu.total} />

            {/* environments on this host */}
            <div>
              <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-2">Environments placed here ({detail.environments.length})</p>
              <div className="border border-[--dark-line] divide-y divide-[--dark-line]">
                {detail.environments.map((e) => (
                  <div key={e.id} className="px-4 py-2.5 grid gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="text-sm">{e.teamName}</span>
                        <span className="ml-2 font-mono2 text-[10px] text-[--dark-muted]">{e.vmId ?? e.id.slice(0, 8)}</span>
                      </span>
                      <span className="font-mono2 text-[10px] text-[--dark-muted] shrink-0">
                        {e.vcpu ? `${e.vcpu} vCPU · ${Math.round((e.ramMb ?? 0) / 1024)} GB promised` : '—'}
                      </span>
                    </div>
                    {/* Per-VM reality. Summed host totals hide the case that
                        decides the overcommit factor: one VM using its whole
                        promise beside four using almost none averages out to
                        something comfortable that would starve the first. */}
                    {e.usedMb !== undefined ? (
                      <p className="font-mono2 text-[10px] text-[--dark-muted]">
                        using <span className="text-[--dark-text]">{gb(e.usedMb)}</span>
                        {e.ramMb ? ` (${Math.round((e.usedMb / e.ramMb) * 100)}% of promise)` : ''}
                        {e.cachesMb ? ` · ${gb(e.cachesMb)} cache` : ''}
                        {e.balloonMb ? ` · ${gb(e.balloonMb)} held back` : ''}
                        {e.vcpuUsed !== undefined ? ` · ${e.vcpuUsed.toFixed(2)} vCPU` : ''}
                        {e.throttledPct ? <span className="text-[#E8B44C]"> · {e.throttledPct}% throttled</span> : null}
                      </p>
                    ) : (
                      <p className="font-mono2 text-[10px] text-[--dark-muted]">no measurement yet — still booting, or the agent can't be reached</p>
                    )}
                  </div>
                ))}
                {detail.environments.length === 0 && <p className="px-4 py-3 font-mono2 text-xs text-[--dark-muted]">No environments running here.</p>}
              </div>
            </div>

            {/* recent failures on this host */}
            <div>
              <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-2">Recent failed starts</p>
              <div className="border border-[--dark-line] divide-y divide-[--dark-line]">
                {detail.recentFailures.map((f) => (
                  <div key={f.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm">{f.teamName}</span>
                      <span className="font-mono2 text-[10px] text-[--dark-muted] shrink-0">{fmtDateTime(f.occurredAt)} · {f.attempts} attempt{f.attempts === 1 ? '' : 's'}</span>
                    </div>
                    <p className="mt-0.5 font-mono2 text-[10px] text-[#F07A6A] break-words">{f.error ?? 'unknown error'}</p>
                  </div>
                ))}
                {detail.recentFailures.length === 0 && <p className="px-4 py-3 font-mono2 text-xs text-[#57C99A]">No failed starts on this host. ✓</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteTeamModal({ team, onCancel, onDeleted }: { team: AdminTeam; onCancel: () => void; onDeleted: (id: string) => void }) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ready = confirmText.trim().toLowerCase() === 'delete';

  async function handleDelete() {
    if (!ready || busy) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/admin/teams/${team.id}`, { method: 'DELETE' });
      onDeleted(team.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-5" onClick={onCancel}>
      <div className="bg-[--dark-card] border border-[--red]/50 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--red]">Delete team — irreversible</p>
        <h3 className="mt-2 font-semibold text-lg">Delete "{team.name}"?</h3>
        <p className="mt-2 text-sm text-[--dark-muted]">
          This permanently removes the team, its members, tokens, and invites.
          {team.subscriptionStatus && <> Any active Stripe subscription is cancelled first.</>}
          {' '}This cannot be undone.
        </p>
        {team.ownerVerified && (
          <p className="mt-2 font-mono2 text-[11px] text-[#E8B44C]">Heads up: this team's owner is verified — it may be a live customer.</p>
        )}
        <label className="block mt-5">
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
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onCancel} className="font-mono2 text-xs text-[--dark-muted] hover:text-white px-3 py-2">Cancel</button>
          <button
            onClick={handleDelete}
            disabled={!ready || busy}
            className="font-mono2 text-xs px-4 py-2 bg-[--red] text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {busy ? 'Deleting…' : 'Delete team'}
          </button>
        </div>
      </div>
    </div>
  );
}

const PLAN_TIERS: PlanTier[] = ['free', 'solo', 'team', 'scale'];

/** Set or clear a team's manual plan override (entitlements only — no billing
 *  effect). Empty selection clears the override back to the billing plan. */
function PlanOverrideModal({ team, onCancel, onSaved }: {
  team: AdminTeam; onCancel: () => void; onSaved: (id: string, override: PlanTier | null, label: string | null) => void;
}) {
  const [choice, setChoice] = useState<PlanTier | ''>(team.planOverride ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const res = await api<{ planOverride: PlanTier | null; planOverrideLabel: string | null }>(
        `/admin/teams/${team.id}`, { method: 'PATCH', body: { planOverride: choice === '' ? null : choice } },
      );
      onSaved(team.id, res.planOverride, res.planOverrideLabel);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-5" onClick={onCancel}>
      <div className="bg-[--dark-card] border border-[--dark-line] max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Manual plan override</p>
        <h3 className="mt-2 font-semibold text-lg">{team.name}</h3>
        <p className="mt-2 text-sm text-[--dark-muted]">
          Grants a tier's entitlements (parallelism + per-env resources) for free.
          This does <span className="text-white">not</span> touch Stripe, the subscription, or MRR —
          billing stays on <span className="font-mono2 text-white">{team.planLabel}</span>.
        </p>
        <label className="block mt-5">
          <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Override tier</span>
          <select value={choice} onChange={(e) => setChoice(e.target.value as PlanTier | '')}
            className="mt-1.5 w-full bg-[--dark] border border-[--dark-line] px-3 py-2 text-sm focus:outline-none focus:border-white">
            <option value="">No override (use billing plan)</option>
            {PLAN_TIERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        {err && <p className="mt-3 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onCancel} className="font-mono2 text-xs text-[--dark-muted] hover:text-white px-3 py-2">Cancel</button>
          <button onClick={save} disabled={busy}
            className="font-mono2 text-xs px-4 py-2 border border-white hover:bg-white hover:text-[--dark] disabled:opacity-30">
            {busy ? 'Saving…' : 'Save override'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Delete a user account. Backend refuses platform admins and self. */
function DeleteUserModal({ user, onCancel, onDeleted }: { user: AdminUser; onCancel: () => void; onDeleted: (id: string) => void }) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ready = confirmText.trim().toLowerCase() === 'delete';
  const soleTeams = user.teams.filter((t) => t.role === 'owner');

  async function handleDelete() {
    if (!ready || busy) return;
    setBusy(true); setErr('');
    try {
      await api(`/admin/users/${user.id}`, { method: 'DELETE' });
      onDeleted(user.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-5" onClick={onCancel}>
      <div className="bg-[--dark-card] border border-[--red]/50 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--red]">Delete user — irreversible</p>
        <h3 className="mt-2 font-semibold text-lg break-all">{user.email}</h3>
        <p className="mt-2 text-sm text-[--dark-muted]">
          Permanently removes this user and their team memberships.
          {soleTeams.length > 0 && <> Any team where they're the only member is deleted too (with its Stripe subscription cancelled).</>}
          {' '}This cannot be undone.
        </p>
        <label className="block mt-5">
          <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Type "delete" to confirm</span>
          <input autoFocus value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
            className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm font-mono2 focus:outline-none focus:border-[--red]" placeholder="delete" />
        </label>
        {err && <p className="mt-3 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onCancel} className="font-mono2 text-xs text-[--dark-muted] hover:text-white px-3 py-2">Cancel</button>
          <button onClick={handleDelete} disabled={!ready || busy}
            className="font-mono2 text-xs px-4 py-2 bg-[--red] text-white disabled:opacity-30 disabled:cursor-not-allowed">
            {busy ? 'Deleting…' : 'Delete user'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Confirms an admin-initiated 2FA reset for a locked-out user.
 *
 * This exists because there was previously no way back for someone who lost
 * their authenticator AND their recovery codes — not even a platform admin
 * could help; it took a manual database edit. It's scoped tightly: it only
 * clears the second factor (the user re-enrols themselves afterward) and the
 * account owner is always emailed, so a misused support channel is visible to
 * the person it affects, not silent.
 */
function ResetTwoFactorModal({ user, onCancel, onReset }: {
  user: AdminUser; onCancel: () => void; onReset: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleReset() {
    setBusy(true); setErr('');
    try {
      await api(`/admin/users/${user.id}/reset-2fa`, { method: 'POST' });
      onReset();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Reset failed.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-5" onClick={onCancel}>
      <div className="bg-[--dark-card] border border-[--dark-line] max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Reset two-factor</p>
        <h3 className="mt-2 font-semibold text-lg break-all">{user.email}</h3>
        <p className="mt-2 text-sm text-[--dark-muted]">
          Turns off two-factor on this account and signs out every session. Use this only for a
          verified support request — losing both the authenticator and the recovery codes is the
          only case a user can't resolve themselves.
        </p>
        <p className="mt-2 text-sm text-[--dark-muted]">
          The account owner is emailed immediately, whether or not this was them — that's what
          makes this safe to have.
        </p>
        {err && <p className="mt-3 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onCancel} className="font-mono2 text-xs text-[--dark-muted] hover:text-white px-3 py-2">Cancel</button>
          <button onClick={handleReset} disabled={busy}
            className="font-mono2 text-xs px-4 py-2 border border-[#E8B44C] text-[#E8B44C] hover:bg-[#E8B44C]/10 disabled:opacity-30 disabled:cursor-not-allowed">
            {busy ? 'Resetting…' : 'Reset two-factor'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm outline-none focus:border-white';

/** One post row with its update thread and an add-update form. */
function PostRow({ post, onChanged }: { post: StatusPost; onChanged: () => void }) {
  const [body, setBody] = useState('');
  const [state, setState] = useState('');
  const states = STATES_BY_TYPE[post.type];
  const addUpdate = async () => {
    if (!body.trim()) return;
    await api(`/admin/status/posts/${post.id}/updates`, { body: { body, ...(state ? { state } : {}) } });
    setBody(''); setState(''); onChanged();
  };
  const del = async () => { await api(`/admin/status/posts/${post.id}`, { method: 'DELETE' }); onChanged(); };
  return (
    <div className="border border-[--dark-line] p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] border border-[--dark-line] px-2 py-0.5">{post.type}</span>
        <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">{post.state.replace(/_/g, ' ')}</span>
        {post.resolvedAt && <span className="font-mono2 text-[10px] text-[#57C99A]">closed</span>}
        <button onClick={del} className="ml-auto font-mono2 text-[10px] text-[--red]/80 hover:text-[--red]">Delete</button>
      </div>
      <p className="mt-1.5 text-sm font-medium">{post.title}</p>
      {post.body && <p className="mt-1 text-xs text-[--dark-muted] whitespace-pre-wrap">{post.body}</p>}
      {post.updates.length > 0 && (
        <ol className="mt-3 space-y-2 border-l border-[--dark-line] pl-3">
          {post.updates.map((u) => (
            <li key={u.id} className="text-xs">
              {u.state && <span className="font-mono2 text-[10px] uppercase tracking-widest text-white mr-2">{u.state.replace(/_/g, ' ')}</span>}
              <span className="text-[--dark-muted]">{u.body}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 flex gap-2 flex-wrap items-center">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Post an update…" className={`${inputCls} flex-1 min-w-[180px]`} />
        <select value={state} onChange={(e) => setState(e.target.value)} className="bg-[--dark] border border-[--dark-line] px-2 py-2 text-sm">
          <option value="">state…</option>
          {states.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <button onClick={addUpdate} className="font-mono2 text-[10px] uppercase tracking-widest border border-[--dark-line] px-3 py-2 hover:border-white">Post</button>
      </div>
    </div>
  );
}

function StatusAdmin() {
  const [components, setComponents] = useState<AdminStatusComponent[] | null>(null);
  const [posts, setPosts] = useState<StatusPost[] | null>(null);
  const [type, setType] = useState<PostType>('incident');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [impact, setImpact] = useState('minor');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const loadComponents = () => api<{ components: AdminStatusComponent[] }>('/admin/status/components').then((d) => setComponents(d.components)).catch(() => {});
  const loadPosts = () => api<{ posts: StatusPost[] }>('/admin/status/posts').then((d) => setPosts(d.posts)).catch(() => {});
  useEffect(() => { void loadComponents(); void loadPosts(); }, []);

  const setOverride = async (c: AdminStatusComponent, val: string) => {
    await api(`/admin/status/components/${c.id}`, { method: 'PATCH', body: { manualStatus: val === '' ? null : val } });
    void loadComponents();
  };
  const setGroup = async (c: AdminStatusComponent, val: string) => {
    await api(`/admin/status/components/${c.id}`, { method: 'PATCH', body: { groupName: val.trim() || null } });
    void loadComponents();
  };

  const createPost = async () => {
    if (!title.trim()) return;
    await api('/admin/status/posts', {
      body: {
        type, title, body, impact,
        ...(type === 'maintenance' && start ? { scheduledStart: new Date(start).toISOString() } : {}),
        ...(type === 'maintenance' && end ? { scheduledEnd: new Date(end).toISOString() } : {}),
      },
    });
    setTitle(''); setBody(''); setStart(''); setEnd('');
    void loadPosts();
  };

  return (
    <Card>
      <CardHead title="Status page" right={<a href="/status" target="_blank" rel="noreferrer" className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white">View public page</a>} />
      <div className="p-5 grid gap-6">
        {/* Components */}
        <div>
          <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-3">Components — override the auto status (or leave on auto), and set an optional group</p>
          <div className="divide-y divide-[--dark-line] border border-[--dark-line]">
            {(components ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm">{c.name}</span>
                <span className="font-mono2 text-[10px] text-[--dark-muted]">{c.source}</span>
                <input defaultValue={c.groupName ?? ''} placeholder="group…" onBlur={(e) => { if ((e.target.value.trim() || null) !== (c.groupName ?? null)) void setGroup(c, e.target.value); }}
                  className="ml-auto w-32 bg-[--dark] border border-[--dark-line] px-2 py-1.5 text-sm" />
                <select value={c.manualStatus ?? ''} onChange={(e) => void setOverride(c, e.target.value)}
                  className="bg-[--dark] border border-[--dark-line] px-2 py-1.5 text-sm">
                  <option value="">{c.source === 'manual' ? 'operational' : 'auto'}</option>
                  {COMPONENT_LEVELS.map((l) => <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* New post */}
        <div>
          <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-3">Post an incident, maintenance, or announcement</p>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr] items-start">
            <select value={type} onChange={(e) => setType(e.target.value as PostType)} className="bg-[--dark] border border-[--dark-line] px-3 py-2 text-sm">
              <option value="incident">Incident</option>
              <option value="maintenance">Maintenance</option>
              <option value="announcement">Announcement</option>
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={inputCls} />
            <select value={impact} onChange={(e) => setImpact(e.target.value)} className="bg-[--dark] border border-[--dark-line] px-3 py-2 text-sm">
              {['none', 'minor', 'major', 'critical', 'maintenance'].map((i) => <option key={i} value={i}>impact: {i}</option>)}
            </select>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body (optional)" rows={2} className={inputCls} />
            {type === 'maintenance' && (
              <>
                <span className="font-mono2 text-[10px] text-[--dark-muted] self-center">Window</span>
                <div className="flex gap-2 flex-wrap">
                  <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="bg-transparent border border-[--dark-line] px-3 py-2 text-sm" />
                  <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-transparent border border-[--dark-line] px-3 py-2 text-sm" />
                </div>
              </>
            )}
          </div>
          <button onClick={createPost} disabled={!title.trim()} className="mt-3 font-mono2 text-[10px] uppercase tracking-widest border border-[--dark-line] px-4 py-2 hover:border-white disabled:opacity-40">Publish</button>
        </div>

        {/* Existing posts */}
        <div className="space-y-2">
          {(posts ?? []).map((p) => <PostRow key={p.id} post={p} onChanged={loadPosts} />)}
          {posts?.length === 0 && <p className="font-mono2 text-xs text-[--dark-muted]">No posts yet.</p>}
        </div>
      </div>
    </Card>
  );
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const runStatusColor: Record<string, string> = {
  assigned: 'text-[#57C99A]',
  queued: 'text-[#E8B44C]',
  released: 'text-[--dark-muted]',
  failed: 'text-[#F07A6A]',
};

/** Full read-only drill-down for one team: billing/override, members, tokens,
 *  recent runs, and the team's audit trail. Fetched lazily on open. */
function TeamDetailModal({ team, onCancel }: { team: AdminTeam; onCancel: () => void }) {
  const [detail, setDetail] = useState<AdminTeamDetail | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    api<AdminTeamDetail>(`/admin/teams/${team.id}/detail`)
      .then((d) => { if (alive) setDetail(d); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : 'Could not load team.'); });
    return () => { alive = false; };
  }, [team.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-start justify-center px-4 py-10 overflow-y-auto" onClick={onCancel}>
      <div className="bg-[--dark-card] border border-[--dark-line] max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-[--dark-line]">
          <div>
            <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Team detail</p>
            <h3 className="mt-1 font-semibold text-lg">{team.name}</h3>
          </div>
          <button onClick={onCancel} className="font-mono2 text-xs text-[--dark-muted] hover:text-white">Close</button>
        </div>

        {err && <p className="px-6 py-5 font-mono2 text-xs text-[#F07A6A]">{err}</p>}
        {!detail && !err && <p className="px-6 py-5 font-mono2 text-xs text-[--dark-muted]">Loading …</p>}

        {detail && (
          <div className="p-6 grid gap-6">
            {/* summary */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border border-[--dark-line] p-4">
                <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Billing plan</p>
                <p className="mt-1.5 text-sm">{detail.team.planLabel}
                  {detail.team.planOverride && (
                    <span className="ml-2 font-mono2 text-[10px] uppercase tracking-wider border border-[#8AB8F0]/50 text-[#8AB8F0] px-2 py-0.5" title="Manual entitlement grant — no billing effect">
                      override: {detail.team.planOverrideLabel} ✦
                    </span>
                  )}
                </p>
                <p className="mt-1 font-mono2 text-[10px] text-[--dark-muted]">
                  {detail.team.subscriptionStatus ?? 'no subscription'}
                  {detail.team.currentPeriodEnd && ` · renews ${fmtDate(detail.team.currentPeriodEnd)}`}
                </p>
              </div>
              <div className="border border-[--dark-line] p-4">
                <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Lifecycle</p>
                <p className="mt-1.5 font-mono2 text-xs text-[--dark-muted]">Created {fmtDate(detail.team.createdAt)}</p>
                <p className="mt-1 font-mono2 text-xs text-[--dark-muted]">Trial ends {fmtDate(detail.team.trialEndsAt)}</p>
              </div>
            </div>

            {/* members */}
            <div>
              <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-2">Members ({detail.members.length})</p>
              <div className="border border-[--dark-line] divide-y divide-[--dark-line]">
                {detail.members.map((m) => (
                  <div key={m.email} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm break-all">{m.email}</span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="font-mono2 text-[10px] text-[--dark-muted]">{m.role}</span>
                      <span className={`font-mono2 text-[10px] ${m.verified ? 'text-[#57C99A]' : 'text-[#E8B44C]'}`}>{m.verified ? 'verified' : 'pending'}</span>
                    </span>
                  </div>
                ))}
                {detail.members.length === 0 && <p className="px-4 py-3 font-mono2 text-xs text-[--dark-muted]">No members.</p>}
              </div>
            </div>

            {/* tokens */}
            <div>
              <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-2">API tokens ({detail.tokens.length})</p>
              <div className="border border-[--dark-line] divide-y divide-[--dark-line]">
                {detail.tokens.map((k) => (
                  <div key={k.prefix} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="text-sm">{k.label}</span>
                      <span className="ml-2 font-mono2 text-[10px] text-[--dark-muted]">{k.prefix}… · {k.scope}</span>
                    </span>
                    <span className="font-mono2 text-[10px] shrink-0 text-[--dark-muted]">
                      {k.revoked ? <span className="text-[#F07A6A]">revoked</span> : `last used ${k.lastUsedAt ? fmtDate(k.lastUsedAt) : 'never'}`}
                    </span>
                  </div>
                ))}
                {detail.tokens.length === 0 && <p className="px-4 py-3 font-mono2 text-xs text-[--dark-muted]">No tokens.</p>}
              </div>
            </div>

            {/* recent runs */}
            <div>
              <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-2">Recent runs</p>
              <div className="border border-[--dark-line] divide-y divide-[--dark-line]">
                {detail.runs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className={`font-mono2 text-[10px] uppercase tracking-wider ${runStatusColor[r.status] ?? 'text-[--dark-muted]'}`}>{r.status}</span>
                      <span className="ml-2 font-mono2 text-[10px] text-[--dark-muted]">{r.hostName ?? 'no host'}</span>
                      {r.error && <span className="ml-2 font-mono2 text-[10px] text-[#F07A6A] break-words">{r.error}</span>}
                    </span>
                    <span className="font-mono2 text-[10px] text-[--dark-muted] shrink-0">{fmtDateTime(r.requestedAt)}</span>
                  </div>
                ))}
                {detail.runs.length === 0 && <p className="px-4 py-3 font-mono2 text-xs text-[--dark-muted]">No runs yet.</p>}
              </div>
            </div>

            {/* audit */}
            <div>
              <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-2">Audit trail</p>
              {detail.audit.length === 0
                ? <p className="border border-[--dark-line] px-4 py-3 font-mono2 text-xs text-[--dark-muted]">No audit entries.</p>
                : <AuditList entries={detail.audit} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** MRR split by tier as labelled proportion bars. */
function MrrByTier({ overview }: { overview: AdminOverview }) {
  const rows = overview.mrrByTier;
  const total = overview.mrrChf;
  return (
    <Card>
      <CardHead title="MRR by tier" right={<span className="font-mono2 text-[11px] text-[--dark-muted]">CHF {total} / mo</span>} />
      <div className="p-5 space-y-3">
        {rows.length === 0 && <p className="font-mono2 text-xs text-[--dark-muted]">No paid teams yet.</p>}
        {rows.map((r) => (
          <div key={r.tier}>
            <div className="flex items-center justify-between text-xs font-mono2 mb-1">
              <span>{r.label} <span className="text-[--dark-muted]">× {r.count}</span></span>
              <span className="text-[--dark-muted]">CHF {r.chfTotal}</span>
            </div>
            <div className="h-2 bg-white/[0.08] border border-[--dark-line]">
              <div className="h-full bg-[#57C99A]/70" style={{ width: `${total > 0 ? Math.round((r.chfTotal / total) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** 14-day stacked bar chart of VM starts (green) with failed starts (red) on
 *  top, plus a signups sparkline row. Pure divs, no chart lib. */
function ActivityChart({ series }: { series: AdminTimeseries }) {
  const days = series.days;
  const maxRun = Math.max(1, ...days.map((d) => d.starts + d.failures));
  const maxSignup = Math.max(1, ...days.map((d) => d.signups));
  const totalStarts = days.reduce((s, d) => s + d.starts, 0);
  const totalSignups = days.reduce((s, d) => s + d.signups, 0);
  return (
    <Card>
      <CardHead title={`Activity · ${days.length}d`} right={
        <span className="font-mono2 text-[10px] text-[--dark-muted] flex gap-3">
          <span><span className="text-[#57C99A]">■</span> {totalStarts} starts</span>
          <span><span className="text-[#8AB8F0]">■</span> {totalSignups} signups</span>
        </span>
      } />
      <div className="p-5">
        <div className="flex items-end gap-[3px] h-28">
          {days.map((d) => {
            const h = ((d.starts + d.failures) / maxRun) * 100;
            const failPct = d.starts + d.failures > 0 ? (d.failures / (d.starts + d.failures)) * 100 : 0;
            return (
              <div key={d.date} className="flex-1 flex flex-col justify-end h-full group relative"
                title={`${d.date} · ${d.starts} starts, ${d.failures} failed, ${d.signups} signups`}>
                <div className="w-full bg-[#57C99A]/70" style={{ height: `${Math.max(h, d.starts + d.failures > 0 ? 4 : 0)}%` }}>
                  {failPct > 0 && <div className="w-full bg-[--red]" style={{ height: `${failPct}%` }} />}
                </div>
              </div>
            );
          })}
        </div>
        {/* signups row */}
        <div className="flex items-end gap-[3px] h-8 mt-1 border-t border-[--dark-line] pt-1">
          {days.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col justify-end h-full" title={`${d.date} · ${d.signups} signups`}>
              <div className="w-full bg-[#8AB8F0]/70" style={{ height: `${(d.signups / maxSignup) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between font-mono2 text-[9px] text-[--dark-muted] mt-1.5">
          <span>{days[0]?.date.slice(5)}</span>
          <span>today</span>
        </div>
      </div>
    </Card>
  );
}

/** Recent signups + recent failed starts, two short feeds side by side. */
function ActivityFeed({ activity }: { activity: AdminActivity }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHead title="Recent signups" />
        <div className="divide-y divide-[--dark-line]">
          {activity.recentSignups.length === 0 && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">None yet.</p>}
          {activity.recentSignups.map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="font-mono2 text-[10px] text-[--dark-muted] truncate">{s.ownerEmail ?? '—'}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`font-mono2 text-[10px] uppercase tracking-wider ${s.ownerVerified ? 'text-[#57C99A]' : 'text-[#E8B44C]'}`}>{s.ownerVerified ? 'verified' : 'pending'}</span>
                <p className="font-mono2 text-[10px] text-[--dark-muted]">{fmtDateTime(s.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead title="Recent failed VM starts" />
        <div className="divide-y divide-[--dark-line]">
          {activity.recentFailures.length === 0 && <p className="px-5 py-4 font-mono2 text-xs text-[#57C99A]">No failed starts. ✓</p>}
          {activity.recentFailures.map((f) => (
            <div key={f.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium truncate">{f.teamName}</p>
                <p className="font-mono2 text-[10px] text-[--dark-muted] shrink-0">{fmtDateTime(f.occurredAt)}</p>
              </div>
              {/* drill-down: the actual reason the scheduler gave up, plus where
                  and after how many attempts — so a failure is diagnosable from
                  the dashboard without grepping logs. */}
              <p className="mt-1 font-mono2 text-[11px] text-[#F07A6A] break-words">{f.error ?? 'unknown error'}</p>
              <p className="mt-0.5 font-mono2 text-[10px] text-[--dark-muted]">
                {f.hostName ? `host ${f.hostName}` : 'no host assigned'} · {f.attempts} attempt{f.attempts === 1 ? '' : 's'}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

type AdminView = 'overview' | 'teams' | 'users' | 'hosts' | 'system' | 'errors' | 'backups' | 'audit' | 'status';
const ADMIN_NAV: { key: AdminView; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'teams', label: 'Teams' },
  { key: 'users', label: 'Users' },
  { key: 'hosts', label: 'Hosts' },
  { key: 'system', label: 'System' },
  { key: 'errors', label: 'Errors' },
  { key: 'backups', label: 'Backups' },
  { key: 'audit', label: 'Audit log' },
  { key: 'status', label: 'Status page' },
];

function fmtBytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Horizontal gauge; turns amber then red as it fills, so a saturated resource
 *  is visible without reading the number. */
function Gauge({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  const color = percent >= 90 ? 'bg-[--red]' : percent >= 75 ? 'bg-[#E8B44C]' : 'bg-[#57C99A]/80';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">{label}</span>
        <span className="font-doto text-xl">{percent.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-white/[0.1] border border-[--dark-line]">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className="font-mono2 text-[10px] text-[--dark-muted] mt-1">{detail}</p>
    </div>
  );
}

/** Control-plane VPS + Postgres health. The Hosts tab covers the Firecracker
 *  data plane; this covers the machine the API and database themselves run on,
 *  which previously had no visibility at all. */
function SystemPanel() {
  const [data, setData] = useState<AdminSystemHealth | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const load = () => api<AdminSystemHealth>('/admin/system').then(setData)
      .catch(() => setErr('Could not load system health.'));
    load();
    const t = setInterval(load, 15000); // live enough to watch a spike
    return () => clearInterval(t);
  }, []);

  if (err) return <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>;
  if (!data) return <p className="font-mono2 text-xs text-[--dark-muted]">Loading …</p>;

  const { host, database } = data;
  const connPercent = database.connections.max > 0
    ? (database.connections.total / database.connections.max) * 100 : 0;
  const hitPercent = database.cacheHitRatio === null ? null : database.cacheHitRatio * 100;

  return (
    <div className="grid gap-5">
      <Card>
        <CardHead title="Control-plane host" right={
          <span className="font-mono2 text-[10px] text-[--dark-muted]">
            up {fmtUptime(host.uptimeSeconds)} · API {fmtUptime(host.processUptimeSeconds)}
          </span>
        } />
        <div className="p-5 grid gap-5 sm:grid-cols-3">
          <Gauge label="CPU" percent={host.cpuPercent}
            detail={`${host.cpuCores} core${host.cpuCores === 1 ? '' : 's'} · load ${host.loadAverage.one.toFixed(2)} / ${host.loadAverage.five.toFixed(2)} / ${host.loadAverage.fifteen.toFixed(2)}`} />
          <Gauge label="Memory" percent={host.memory.percent}
            detail={`${fmtBytes(host.memory.usedBytes)} of ${fmtBytes(host.memory.totalBytes)} (${host.memory.source})`} />
          {host.disk
            ? <Gauge label="Disk" percent={host.disk.percent}
                detail={`${fmtBytes(host.disk.usedBytes)} of ${fmtBytes(host.disk.totalBytes)}`} />
            : <div><p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Disk</p>
                <p className="font-mono2 text-[10px] text-[--dark-muted] mt-2">unavailable</p></div>}
        </div>
      </Card>

      <Card>
        <CardHead title="Database" right={<span className="font-mono2 text-[10px] text-[--dark-muted]">{database.sizePretty}</span>} />
        <div className="p-5 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Gauge label="Connections" percent={connPercent}
              detail={`${database.connections.total} of ${database.connections.max} · ${database.connections.active} active`} />
            {hitPercent === null ? (
              <div><p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Cache hit rate</p>
                <p className="font-mono2 text-[10px] text-[--dark-muted] mt-2">no data yet</p></div>
            ) : (
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Cache hit rate</span>
                  <span className={`font-doto text-xl ${hitPercent < 95 ? 'text-[#E8B44C]' : ''}`}>{hitPercent.toFixed(2)}%</span>
                </div>
                <p className="font-mono2 text-[10px] text-[--dark-muted]">
                  {hitPercent < 95
                    ? 'Below 95% — reads are hitting disk; the DB may need more memory.'
                    : 'Reads are being served from memory.'}
                </p>
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-4 border-t border-[--dark-line] pt-4">
            {([
              ['Commits', database.commits.toLocaleString()],
              ['Rollbacks', database.rollbacks.toLocaleString()],
              ['Deadlocks', database.deadlocks.toLocaleString(), database.deadlocks > 0],
              ['Idle in txn', String(database.connections.idleInTransaction), database.connections.idleInTransaction > 3],
            ] as [string, string, boolean?][]).map(([label, value, warn]) => (
              <div key={label}>
                <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">{label}</p>
                <p className={`font-doto text-2xl mt-1 ${warn ? 'text-[#E8B44C]' : ''}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Slowest queries" right={<span className="font-mono2 text-[10px] text-[--dark-muted]">by mean time</span>} />
        {database.slowestQueries === null ? (
          <p className="px-5 py-4 text-xs text-[--dark-muted] max-w-[80ch]">
            Query timings need the <span className="font-mono2 text-[--dark-text]">pg_stat_statements</span> extension.
            Enable it once with <span className="font-mono2 text-[--dark-text]">CREATE EXTENSION pg_stat_statements;</span> and add
            <span className="font-mono2 text-[--dark-text]"> shared_preload_libraries = 'pg_stat_statements'</span> to postgresql.conf
            (needs a restart).
          </p>
        ) : database.slowestQueries.length === 0 ? (
          <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">No queries recorded yet.</p>
        ) : (
          <div className="divide-y divide-[--dark-line]">
            {database.slowestQueries.map((q) => (
              <div key={q.query} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <code className="font-mono2 text-[11px] text-[--dark-text] break-all">{q.query}</code>
                  <span className={`font-mono2 text-[11px] shrink-0 ${q.meanMs > 100 ? 'text-[#E8B44C]' : 'text-[--dark-muted]'}`}>{q.meanMs} ms</span>
                </div>
                <p className="font-mono2 text-[10px] text-[--dark-muted] mt-1">{q.calls.toLocaleString()} calls · {q.totalMs.toLocaleString()} ms total</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Consistent line icons for the admin tabs — same 24-grid / 1.6-stroke set as
// the dashboard sidebar, replacing the earlier mixed glyphs (incl. a smiley).
/** "3 hours ago" — for freshness, the relative age is the answer, not the date. */
function ago(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function hoursSince(iso: string | null): number {
  return iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : Infinity;
}

/**
 * Backup freshness. The whole point is answering "is there a recent, restorable
 * copy of the database?" at a glance — the failure mode this guards against is
 * a job that quietly stopped months ago and looks exactly like a working one.
 */
function BackupsPanel() {
  const [data, setData] = useState<AdminBackups | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<AdminBackups>('/admin/backups').then(setData)
      .catch(() => setErr('Could not load backup status.'));
  }, []);

  if (err) return <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>;
  if (!data) return <p className="font-mono2 text-xs text-[--dark-muted]">Loading …</p>;

  // Thresholds mirror the server-side alert (48h) so the dashboard and the
  // email can never disagree about what counts as stale.
  const backupAge = hoursSince(data.lastSuccessAt);
  const verifyAge = hoursSince(data.lastVerifiedAt);
  const backupState = !data.configured ? 'unconfigured'
    : backupAge <= 48 ? 'ok' : backupAge <= 96 ? 'warn' : 'bad';
  const verifyState = verifyAge <= 24 * 14 ? 'ok' : verifyAge <= 24 * 30 ? 'warn' : 'bad';

  const tone: Record<string, string> = {
    ok: 'text-[#57C99A]', warn: 'text-[#E8B44C]', bad: 'text-[#F07A6A]', unconfigured: 'text-[--dark-muted]',
  };

  return (
    <div className="space-y-6">
      {!data.configured && (
        <Card className="border-[#E8B44C]/40">
          <div className="p-4">
            <p className="text-sm text-[#E8B44C]">Backup reporting is not configured.</p>
            <p className="font-mono2 text-[11px] text-[--dark-muted] mt-1.5 leading-relaxed">
              Set BACKUP_REPORT_TOKEN in the API's .env and in /opt/devplat/backup.env, then restart the API.
              Until then this page can't tell a working backup from one that stopped — see
              deploy/backup/README.md.
            </p>
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <div className="p-4">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Last backup</p>
            <p className={`font-doto text-3xl mt-1 ${tone[backupState]}`}>{ago(data.lastSuccessAt)}</p>
            <p className="font-mono2 text-[10px] text-[--dark-muted] mt-1">
              {data.lastSuccessBytes ? fmtBytes(data.lastSuccessBytes) : '—'} · nightly at 02:15 UTC
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Last restore test</p>
            <p className={`font-doto text-3xl mt-1 ${tone[verifyState]}`}>{ago(data.lastVerifiedAt)}</p>
            <p className="font-mono2 text-[10px] text-[--dark-muted] mt-1">
              restore.sh --verify · weekly
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Recent runs</p>
            <p className="font-doto text-3xl mt-1">{data.runs.length}</p>
            <p className="font-mono2 text-[10px] text-[--dark-muted] mt-1">
              {data.runs.filter((r) => r.status === 'failed').length} failed
            </p>
          </div>
        </Card>
      </div>

      {data.lastVerifiedAt === null && data.configured && (
        <p className="font-mono2 text-[11px] text-[#E8B44C]">
          No restore has ever been verified. A backup that has never been restored is a belief, not a backup —
          run <span className="text-white">restore.sh --verify</span> on the VPS.
        </p>
      )}

      <Card>
        <CardHead title="Run history" />
        {data.runs.length === 0 ? (
          <p className="p-4 font-mono2 text-xs text-[--dark-muted]">No runs reported yet.</p>
        ) : (
          <div className="divide-y divide-[--dark-line]">
            {data.runs.map((r) => (
              <div key={r.id} className="p-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className={`font-mono2 text-[11px] uppercase tracking-wider min-w-[4.5rem] ${
                  r.status === 'failed' ? 'text-[#F07A6A]' : r.status === 'verified' ? 'text-[#57C99A]' : 'text-[--dark-muted]'
                }`}>{r.status}</span>
                <span className="font-mono2 text-[11px] text-[--dark-muted]">{fmtDateTime(r.createdAt)}</span>
                <span className="font-mono2 text-[11px] text-[--dark-muted] flex-1 min-w-0 truncate">
                  {r.archive ?? '—'}
                </span>
                <span className="font-mono2 text-[11px] text-[--dark-muted]">
                  {r.bytes ? fmtBytes(r.bytes) : ''} {r.durationSeconds ? `· ${r.durationSeconds}s` : ''}
                </span>
                {r.detail && <p className="w-full font-mono2 text-[11px] text-[#F07A6A]">{r.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Application errors, grouped by fingerprint. A crash loop is one row with a
 * count here, not ten thousand — which is what makes the list readable enough
 * to actually be looked at.
 */
function ErrorsPanel() {
  const [data, setData] = useState<AdminErrors | null>(null);
  const [err, setErr] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [source, setSource] = useState<'' | 'api' | 'client'>('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (showResolved) q.set('resolved', 'true');
    if (source) q.set('source', source);
    api<AdminErrors>(`/admin/errors?${q}`).then(setData)
      .catch(() => setErr('Could not load errors.'));
  }, [showResolved, source]);

  useEffect(load, [load]);

  const toggleResolved = async (id: string, resolved: boolean) => {
    await api(`/admin/errors/${id}`, { method: 'PATCH', body: { resolved } }).catch(() => {});
    load();
  };

  if (err) return <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>;
  if (!data) return <p className="font-mono2 text-xs text-[--dark-muted]">Loading …</p>;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <div className="p-4">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Unresolved</p>
            <p className={`font-doto text-3xl mt-1 ${data.unresolved > 0 ? 'text-[#F07A6A]' : 'text-[#57C99A]'}`}>
              {data.unresolved}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Occurrences · 24h</p>
            <p className="font-doto text-3xl mt-1">{data.occurrencesLast24h}</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {([['', 'All'], ['api', 'API'], ['client', 'Browser']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setSource(v)}
            className={`font-mono2 text-[11px] uppercase tracking-wider px-3 py-1.5 border ${
              source === v ? 'border-white text-white' : 'border-[--dark-line] text-[--dark-muted] hover:text-white'
            }`}
          >{label}</button>
        ))}
        <button
          onClick={() => setShowResolved((s) => !s)}
          className={`font-mono2 text-[11px] uppercase tracking-wider px-3 py-1.5 border ml-auto ${
            showResolved ? 'border-white text-white' : 'border-[--dark-line] text-[--dark-muted] hover:text-white'
          }`}
        >{showResolved ? 'Hiding nothing' : 'Show resolved'}</button>
      </div>

      <Card>
        <CardHead title="Grouped errors" />
        {data.errors.length === 0 ? (
          <p className="p-4 font-mono2 text-xs text-[--dark-muted]">
            Nothing recorded. That is the correct number.
          </p>
        ) : (
          <div className="divide-y divide-[--dark-line]">
            {data.errors.map((e) => (
              <div key={e.id} className="p-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={`font-mono2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 border ${
                    e.source === 'client' ? 'border-[#7AA7F0]/50 text-[#7AA7F0]' : 'border-[#F07A6A]/50 text-[#F07A6A]'
                  }`}>{e.source}</span>
                  {e.route && (
                    <span className="font-mono2 text-[11px] text-[--dark-muted]">
                      {e.method ? `${e.method} ` : ''}{e.route}
                    </span>
                  )}
                  <span className="font-mono2 text-[11px] text-[--dark-muted] ml-auto">
                    {e.count}× · last {ago(e.lastSeenAt)}
                  </span>
                </div>
                <button
                  onClick={() => setOpen(open === e.id ? null : e.id)}
                  className={`mt-1.5 text-left text-sm w-full ${e.resolvedAt ? 'text-[--dark-muted] line-through' : 'text-white'}`}
                >
                  {e.message}
                </button>
                {open === e.id && (
                  <div className="mt-2 space-y-2">
                    {e.stack && (
                      <pre className="font-mono2 text-[10px] leading-relaxed text-[--dark-muted] bg-white/[0.03] border border-[--dark-line] p-3 overflow-x-auto">
                        {e.stack}
                      </pre>
                    )}
                    <p className="font-mono2 text-[10px] text-[--dark-muted]">
                      First seen {fmtDateTime(e.firstSeenAt)} · last {fmtDateTime(e.lastSeenAt)}
                    </p>
                    <button
                      onClick={() => toggleResolved(e.id, !e.resolvedAt)}
                      className="font-mono2 text-[11px] uppercase tracking-wider px-3 py-1.5 border border-[--dark-line] text-[--dark-muted] hover:text-white hover:border-white"
                    >
                      {e.resolvedAt ? 'Reopen' : 'Mark resolved'}
                    </button>
                    {!e.resolvedAt && (
                      <p className="font-mono2 text-[10px] text-[--dark-muted]">
                        Resolving doesn't delete it — if it happens again it reopens and alerts.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AdminIcon({ name }: { name: AdminView }) {
  const p: Record<AdminView, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    teams: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17 13.5a5.5 5.5 0 0 1 3.5 5.5" /></>,
    users: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
    hosts: <><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
    system: <><path d="M3 12h3l2-5 4 10 2-5h7" /></>,
    errors: <><path d="M12 3.5 21 19H3z" /><path d="M12 10v4M12 16.5h.01" /></>,
    backups: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
    audit: <><path d="M8 4h9l3 3v13H8z" /><path d="M4 8v12h12" /><path d="M11 11h6M11 15h6" /></>,
    status: <><path d="M3 12h4l2 5 4-12 2 7h6" /></>,
  };
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[name]}
    </svg>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const { me, logout } = useAuth();
  const [view, setView] = useState<AdminView>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [hosts, setHosts] = useState<AdminHost[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activity, setActivity] = useState<AdminActivity | null>(null);
  const [series, setSeries] = useState<AdminTimeseries | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminTeam | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminTeam | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<AdminTeam | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [resetTwoFactorUser, setResetTwoFactorUser] = useState<AdminUser | null>(null);
  const [editHost, setEditHost] = useState<AdminHost | null>(null);
  const [detailHost, setDetailHost] = useState<AdminHost | null>(null);

  useEffect(() => {
    Promise.all([
      api<AdminOverview>('/admin/overview'),
      api<{ hosts: AdminHost[] }>('/admin/hosts'),
      api<{ teams: AdminTeam[] }>('/admin/subscribers'),
      api<{ users: AdminUser[] }>('/admin/users'),
      api<AdminActivity>('/admin/activity'),
      api<AdminTimeseries>('/admin/timeseries?days=14'),
    ])
      .then(([o, h, t, u, a, s]) => { setOverview(o); setHosts(h.hosts); setTeams(t.teams); setUsers(u.users); setActivity(a); setSeries(s); })
      .catch(() => setErr('Could not load admin data — platform-admin role required.'));
  }, []);

  const toggleDrain = async (h: AdminHost) => {
    const next = !h.drain;
    setHosts((prev) => prev.map((x) => (x.id === h.id ? { ...x, drain: next } : x))); // optimistic
    try {
      await api(`/admin/hosts/${h.id}`, { method: 'PATCH', body: { drain: next } });
    } catch {
      setHosts((prev) => prev.map((x) => (x.id === h.id ? { ...x, drain: h.drain } : x))); // revert
    }
  };

  // Audit log lazy-loads the first time its tab is opened.
  useEffect(() => {
    if (view === 'audit' && audit === null) {
      api<{ entries: AuditEntry[] }>('/admin/audit').then((d) => setAudit(d.entries)).catch(() => setAudit([]));
    }
  }, [view, audit]);

  const errorRate = overview?.vmStartErrorRate7d;

  // Instant client-side search across both lists: teams match on name or owner
  // email; users match on email or any of their team names.
  const q = search.trim().toLowerCase();
  const shownTeams = q === '' ? teams : teams.filter((t) =>
    t.name.toLowerCase().includes(q) || (t.ownerEmail ?? '').toLowerCase().includes(q));
  const shownUsers = q === '' ? users : users.filter((u) =>
    u.email.toLowerCase().includes(q) || u.teams.some((tm) => tm.teamName.toLowerCase().includes(q)));

  return (
    <div className="min-h-screen bg-[--dark] text-[--dark-text]">
      <header className="h-16 border-b border-[--dark-line] flex items-center justify-between px-5 sticky top-0 bg-[--dark]/95 backdrop-blur z-30">
        <div className="flex items-center gap-4">
          <Logo dark onClick={() => navigate('/')} />
          <span className="font-mono2 text-[10px] uppercase tracking-widest border border-[--red] text-[--red] px-2 py-0.5">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app')} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white">← Dashboard</button>
          <button onClick={async () => { await logout(); navigate('/'); }} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white">Sign out</button>
          <span className="font-doto w-8 h-8 grid place-items-center border border-[--dark-line] text-xs" title={me?.user.email}>
            {(me?.user.email ?? '??').slice(0, 2).toUpperCase()}
          </span>
        </div>
      </header>

      {/* tab navigation — the dashboard is no longer one long page */}
      <div className="border-b border-[--dark-line] sticky top-16 bg-[--dark]/95 backdrop-blur z-20">
        <div className="max-w-7xl mx-auto px-2 sm:px-5 flex overflow-x-auto">
          {ADMIN_NAV.map((i) => (
            <button key={i.key} onClick={() => setView(i.key)}
              className={`shrink-0 flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${view === i.key ? 'text-white border-[--red]' : 'text-[--dark-muted] border-transparent hover:text-white'}`}>
              <AdminIcon name={i.key} />{i.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-5 lg:p-8 max-w-7xl mx-auto">
        {err && <p className="font-mono2 text-xs text-[#F07A6A] mb-5">{err}</p>}

        <div key={view} className="view-in grid gap-5">
        {view === 'overview' && <>
        {/* KPI row */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Teams" value={overview ? String(overview.totalTeams) : '…'} sub={overview ? `+${overview.newTeams7d} in 7d · ${overview.activeSubscriptions} active subs` : undefined} />
          <Kpi label="MRR" value={overview ? `${overview.mrrChf}` : '…'} sub="CHF / month, list prices" />
          <Kpi label="Environments" value={overview ? String(overview.runningEnvironments) : '…'}
            sub={overview ? `${overview.queuedEnvironments} queued` : undefined} />
          <Kpi label="VM start error · 7d" value={errorRate == null ? '—' : `${(errorRate * 100).toFixed(1)}%`}
            sub={overview ? `${overview.vmStarts7d} starts · ${overview.vmStartFailures7d} failed` : undefined} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {series && <ActivityChart series={series} />}
          {overview && <MrrByTier overview={overview} />}
        </div>
        {activity && <ActivityFeed activity={activity} />}
        {/* cache */}
        <Card>
          <CardHead title="Image cache hit rate" right={
            overview && overview.cacheReportingHosts === 0
              ? <span className="font-mono2 text-[10px] text-[#E8B44C] border border-[#E8B44C]/40 px-2 py-0.5">No host reporting</span>
              : overview
                ? <span className="font-mono2 text-[10px] text-[--dark-muted]">{overview.cacheReportingHosts} host{overview.cacheReportingHosts === 1 ? '' : 's'} reporting</span>
                : undefined
          } />
          <div className="p-5">
            <p className="font-doto text-4xl">{overview?.cacheHitRate == null ? '—' : `${(overview.cacheHitRate * 100).toFixed(1)}%`}</p>
            <p className="text-xs text-[--dark-muted] mt-1 max-w-[70ch]">
              {overview == null
                ? 'Loading…'
                : overview.cacheReportingHosts === 0
                  ? 'No host is publishing registry-cache stats yet. On each host, deploy the registry cache with its debug endpoint (REGISTRY_HTTP_DEBUG_ADDR / port 127.0.0.1:5001) and run an agent build that scrapes it — see the host runbook, step E.'
                  : overview.cacheLookups === 0
                    ? `${overview.cacheReportingHosts} host(s) reporting, but no image has been pulled through the cache yet — the rate appears after the first pull.`
                    : 'Pooled across all hosts (cumulative hits ÷ lookups from each registry proxy).'}
            </p>
          </div>
        </Card>
        </>}

        {view === 'hosts' && (
        <Card>
          <CardHead title="Host utilization" right={
            overview?.dataPlaneConnected
              ? undefined
              : <span className="font-mono2 text-[10px] text-[#E8B44C] border border-[#E8B44C]/40 px-2 py-0.5">Placeholder — scheduler heartbeats pending</span>
          } />
          <div className="divide-y divide-[--dark-line]">
            {hosts.length === 0 && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">No hosts registered.</p>}
            {hosts.map((h) => (
              <div key={h.id} className="grid gap-4 sm:grid-cols-[160px_1fr_1fr_auto] items-center px-5 py-4">
                <div>
                  <p className="text-sm font-medium font-mono2">{h.name}</p>
                  <p className="font-mono2 text-[10px] text-[--dark-muted]">{h.location} · {h.vms} VM{h.vms === 1 ? '' : 's'} · heartbeat {h.lastHeartbeat ? fmtDate(h.lastHeartbeat) : 'never'}</p>
                </div>
                <div>
                  <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-1">CPU</p>
                  <DualUtilBar committed={h.cpu.used} actual={h.usage?.stale ? null : h.usage?.cpuUsedActual ?? null}
                    total={h.cpu.total} unit="vCPU" decimals={2} />
                </div>
                <div>
                  <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-1">RAM</p>
                  <DualUtilBar committed={h.ramMb.used / 1024}
                    actual={h.usage?.stale ? null : (h.usage?.ramGuestUsedMb ?? null) === null ? null : h.usage!.ramGuestUsedMb! / 1024}
                    total={h.ramMb.total / 1024} unit="GB" decimals={1} />
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  {!!h.usage?.cpuThrottledVms && !h.usage.stale && (
                    <span className="font-mono2 text-[10px] uppercase tracking-wider border border-[#E8B44C]/40 text-[#E8B44C] px-2 py-0.5"
                      title={`${h.usage.cpuThrottledVms} guest(s) hit their CPU cap — builds slowed by our quota, not their own code`}>
                      {h.usage.cpuThrottledVms} throttled
                    </span>
                  )}
                  {h.usage?.stale && (
                    <span className="font-mono2 text-[10px] uppercase tracking-wider border border-[#E8B44C]/40 text-[#E8B44C] px-2 py-0.5"
                      title={`Measurements last updated ${fmtAgo(h.usage.measuredAt)} — too old to schedule against`}>
                      stale metrics
                    </span>
                  )}
                  {h.drain
                    ? <span className="font-mono2 text-[10px] uppercase tracking-wider border border-[#E8B44C]/40 text-[#E8B44C] px-2 py-0.5" title="No new VMs; existing ones run out">draining</span>
                    : <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${hostStatusStyle[h.status]}`}>
                        {h.status === 'online' && <span className="pulse-dot mr-1">●</span>}{h.status}
                      </span>}
                  <button onClick={() => toggleDrain(h)} title={h.drain ? 'Resume taking new VMs' : 'Stop new VMs; let existing ones finish'}
                    className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white border border-transparent hover:border-[--dark-line] px-2 py-1">
                    {h.drain ? 'Resume' : 'Drain'}
                  </button>
                  <button onClick={() => setDetailHost(h)} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white border border-transparent hover:border-[--dark-line] px-2 py-1">
                    View
                  </button>
                  <button onClick={() => setEditHost(h)} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white border border-transparent hover:border-[--dark-line] px-2 py-1">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        )}

        {(view === 'teams' || view === 'users') && (
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={view === 'teams' ? 'Search teams by name or owner email…' : 'Search users by email or team…'}
              className="w-full bg-[--dark-card] border border-[--dark-line] pl-9 pr-4 py-2.5 text-sm outline-none focus:border-white"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[--dark-muted] text-sm" aria-hidden>⌕</span>
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 font-mono2 text-[10px] text-[--dark-muted] hover:text-white">clear ✕</button>
            )}
          </div>
        )}

        {view === 'teams' && (
        <Card>
          <CardHead title={`Teams & subscriptions (${shownTeams.length}${q ? ` of ${teams.length}` : ''})`} />
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[820px]">
              <thead>
                <tr className="border-b border-[--dark-line] font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">
                  <th className="px-5 py-3 font-medium">Team · owner</th>
                  <th className="px-5 py-3 font-medium">Billing plan</th>
                  <th className="px-5 py-3 font-medium">Override</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">MRR</th>
                  <th className="px-5 py-3 font-medium">Members</th>
                  <th className="px-5 py-3 font-medium">Renews</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--dark-line]">
                {shownTeams.map((t) => (
                  <tr key={t.id} className="text-sm">
                    <td className="px-5 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        <button onClick={() => setDetailTarget(t)} className="hover:text-[--red] hover:underline underline-offset-2 text-left" title="View team detail">{t.name}</button>
                        {!t.ownerVerified && (
                          <span className="font-mono2 text-[9px] uppercase tracking-wider border border-[#E8B44C]/40 text-[#E8B44C] px-1.5 py-0.5" title="Owner has not confirmed their email — this team may never become active">Unverified</span>
                        )}
                      </span>
                      <p className="font-mono2 text-[10px] text-[--dark-muted] font-normal break-all">{t.ownerEmail ?? '—'} · since {fmtDate(t.createdAt)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${t.planTier === 'free' ? 'border-[--dark-line] text-[--dark-muted]' : 'border-[#57C99A]/40 text-[#57C99A]'}`}>{t.planLabel}</span>
                    </td>
                    <td className="px-5 py-3">
                      {t.planOverride
                        ? <span className="font-mono2 text-[10px] uppercase tracking-wider border border-[#8AB8F0]/50 text-[#8AB8F0] px-2 py-0.5" title="Manual entitlement grant — no billing effect">{t.planOverrideLabel} ✦</span>
                        : <span className="font-mono2 text-[10px] text-[--dark-muted]">—</span>}
                    </td>
                    <td className="px-5 py-3 font-mono2 text-xs text-[--dark-muted]">{t.subscriptionStatus ?? '—'}</td>
                    <td className="px-5 py-3 font-mono2 text-xs">{t.mrrChf > 0 ? `CHF ${t.mrrChf}` : '—'}</td>
                    <td className="px-5 py-3 font-mono2 text-xs">{t.members}</td>
                    <td className="px-5 py-3 font-mono2 text-xs text-[--dark-muted]">{fmtDate(t.currentPeriodEnd)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setDetailTarget(t)}
                          className="font-mono2 text-[10px] uppercase tracking-wider text-[--dark-muted] hover:text-white border border-transparent hover:border-[--dark-line] px-2 py-1">View</button>
                        <button onClick={() => setOverrideTarget(t)}
                          className="font-mono2 text-[10px] uppercase tracking-wider text-[--dark-muted] hover:text-white border border-transparent hover:border-[--dark-line] px-2 py-1">Plan</button>
                        <button onClick={() => setDeleteTarget(t)}
                          className="font-mono2 text-[10px] uppercase tracking-wider text-[--red]/80 hover:text-[--red] border border-transparent hover:border-[--red]/40 px-2 py-1">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shownTeams.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-6 font-mono2 text-xs text-[--dark-muted]">No teams match "{search}".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        )}

        {view === 'users' && (
        <Card>
          <CardHead title={`Users (${shownUsers.length}${q ? ` of ${users.length}` : ''})`} />
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="border-b border-[--dark-line] font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Verified</th>
                  <th className="px-5 py-3 font-medium">2FA</th>
                  <th className="px-5 py-3 font-medium">Teams</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--dark-line]">
                {shownUsers.map((u) => (
                  <tr key={u.id} className="text-sm">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="break-all">{u.email}</span>
                        {u.isPlatformAdmin && <span className="font-mono2 text-[9px] uppercase tracking-wider border border-[--red] text-[--red] px-1.5 py-0.5">Admin</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {u.verified
                        ? <span className="font-mono2 text-[10px] text-[#57C99A]">✓ yes</span>
                        : <span className="font-mono2 text-[10px] text-[#E8B44C]">pending</span>}
                    </td>
                    <td className="px-5 py-3 font-mono2 text-[10px] text-[--dark-muted]">
                      {u.twoFactorEnabled ? <span className="text-[#57C99A]">on</span> : 'off'}
                    </td>
                    <td className="px-5 py-3 font-mono2 text-[11px] text-[--dark-muted]">
                      {u.teams.length === 0 ? '—' : u.teams.map((tm) => `${tm.teamName} (${tm.role})`).join(', ')}
                    </td>
                    <td className="px-5 py-3 font-mono2 text-xs text-[--dark-muted]">{fmtDate(u.createdAt)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {u.twoFactorEnabled && (
                        <button onClick={() => setResetTwoFactorUser(u)}
                          className="font-mono2 text-[10px] uppercase tracking-wider text-[#E8B44C]/80 hover:text-[#E8B44C] border border-transparent hover:border-[#E8B44C]/40 px-2 py-1">Reset 2FA</button>
                      )}
                      {!u.isPlatformAdmin && me?.user.id !== u.id && (
                        <button onClick={() => setDeleteUser(u)}
                          className="ml-1 font-mono2 text-[10px] uppercase tracking-wider text-[--red]/80 hover:text-[--red] border border-transparent hover:border-[--red]/40 px-2 py-1">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
                {shownUsers.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-6 font-mono2 text-xs text-[--dark-muted]">No users match "{search}".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        )}

        {view === 'audit' && (
          <Card>
            <CardHead title="Audit log" right={<span className="font-mono2 text-[10px] text-[--dark-muted]">last 100 actions</span>} />
            {audit === null ? <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">Loading …</p> : <AuditList entries={audit} />}
          </Card>
        )}

        {view === 'system' && <SystemPanel />}
        {view === 'errors' && <ErrorsPanel />}
        {view === 'backups' && <BackupsPanel />}

        {view === 'status' && <StatusAdmin />}
        </div>
      </main>

      {deleteTarget && (
        <DeleteTeamModal
          team={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={(id) => { setTeams((prev) => prev.filter((t) => t.id !== id)); setDeleteTarget(null); }}
        />
      )}

      {detailTarget && (
        <TeamDetailModal team={detailTarget} onCancel={() => setDetailTarget(null)} />
      )}

      {overrideTarget && (
        <PlanOverrideModal
          team={overrideTarget}
          onCancel={() => setOverrideTarget(null)}
          onSaved={(id, override, label) => {
            setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, planOverride: override, planOverrideLabel: label } : t)));
            setOverrideTarget(null);
          }}
        />
      )}

      {deleteUser && (
        <DeleteUserModal
          user={deleteUser}
          onCancel={() => setDeleteUser(null)}
          onDeleted={(id) => {
            // A deleted user may have taken sole-member teams with them; drop
            // any team whose only listed owner was this user, and refetch teams
            // to stay authoritative.
            setUsers((prev) => prev.filter((u) => u.id !== id));
            api<{ teams: AdminTeam[] }>('/admin/subscribers').then((d) => setTeams(d.teams)).catch(() => {});
            setDeleteUser(null);
          }}
        />
      )}

      {resetTwoFactorUser && (
        <ResetTwoFactorModal
          user={resetTwoFactorUser}
          onCancel={() => setResetTwoFactorUser(null)}
          onReset={() => {
            setUsers((prev) => prev.map((u) => (u.id === resetTwoFactorUser.id ? { ...u, twoFactorEnabled: false } : u)));
            setResetTwoFactorUser(null);
          }}
        />
      )}

      {detailHost && (
        <HostDetailModal host={detailHost} onCancel={() => setDetailHost(null)} />
      )}

      {editHost && (
        <EditHostModal
          host={editHost}
          onCancel={() => setEditHost(null)}
          onSaved={(updated) => { setHosts((prev) => prev.map((h) => (h.id === updated.id ? updated : h))); setEditHost(null); }}
        />
      )}
    </div>
  );
}
