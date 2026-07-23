import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api, type AdminActivity, type AdminHost, type AdminOverview, type AdminStatusComponent, type AdminTeam,
  type AdminTimeseries, type AdminUser, type AuditEntry, type PlanTier, type PostType, type StatusLevel, type StatusPost,
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

function UtilBar({ used, total, unit }: { used: number; total: number; unit: string }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const color = pct >= 85 ? 'bg-[--red]' : pct >= 60 ? 'bg-[#E8B44C]' : 'bg-[#57C99A]/80';
  return (
    <div>
      <div className="h-2 bg-white/[0.12] border border-[--dark-line]">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="font-mono2 text-[10px] text-[--dark-muted] mt-1">{used} / {total} {unit} ({pct}%)</p>
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
      <CardHead title="Status page" right={<a href="/status" target="_blank" rel="noreferrer" className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white">View public page ↗</a>} />
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
            <div key={f.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{f.teamName}</p>
                <p className="font-mono2 text-[10px] text-[--dark-muted] truncate">{f.vmId ?? 'no VM id'}</p>
              </div>
              <p className="font-mono2 text-[10px] text-[--dark-muted] shrink-0">{fmtDateTime(f.occurredAt)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

type AdminView = 'overview' | 'teams' | 'users' | 'hosts' | 'audit' | 'status';
const ADMIN_NAV: { key: AdminView; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '▦' },
  { key: 'teams', label: 'Teams', icon: '◉' },
  { key: 'users', label: 'Users', icon: '☺' },
  { key: 'hosts', label: 'Hosts', icon: '▤' },
  { key: 'audit', label: 'Audit log', icon: '❈' },
  { key: 'status', label: 'Status page', icon: '◈' },
];

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
  const [overrideTarget, setOverrideTarget] = useState<AdminTeam | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [editHost, setEditHost] = useState<AdminHost | null>(null);

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
              <span aria-hidden>{i.icon}</span>{i.label}
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
          <CardHead title="Image cache hit rate" />
          <div className="p-5">
            <p className="font-doto text-4xl">{overview?.cacheHitRate == null ? '—' : `${(overview.cacheHitRate * 100).toFixed(1)}%`}</p>
            <p className="text-xs text-[--dark-muted] mt-1">
              {overview?.cacheHitRate == null
                ? 'Pooled hits ÷ lookups across hosts — shows once a host reports registry-cache stats.'
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
                  <p className="font-mono2 text-[10px] text-[--dark-muted]">{h.location} · heartbeat {h.lastHeartbeat ? fmtDate(h.lastHeartbeat) : 'never'}</p>
                </div>
                <div>
                  <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-1">CPU</p>
                  <UtilBar used={h.cpu.used} total={h.cpu.total} unit="vCPU" />
                </div>
                <div>
                  <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-1">RAM</p>
                  <UtilBar used={Math.round(h.ramMb.used / 1024)} total={Math.round(h.ramMb.total / 1024)} unit="GB" />
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${hostStatusStyle[h.status]}`}>
                    {h.status === 'online' && <span className="pulse-dot mr-1">●</span>}{h.status}
                  </span>
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
                        {t.name}
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
                    <td className="px-5 py-3 font-mono2 text-[11px] text-[--dark-muted]">
                      {u.teams.length === 0 ? '—' : u.teams.map((tm) => `${tm.teamName} (${tm.role})`).join(', ')}
                    </td>
                    <td className="px-5 py-3 font-mono2 text-xs text-[--dark-muted]">{fmtDate(u.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      {!u.isPlatformAdmin && me?.user.id !== u.id && (
                        <button onClick={() => setDeleteUser(u)}
                          className="font-mono2 text-[10px] uppercase tracking-wider text-[--red]/80 hover:text-[--red] border border-transparent hover:border-[--red]/40 px-2 py-1">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
                {shownUsers.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-6 font-mono2 text-xs text-[--dark-muted]">No users match "{search}".</td></tr>
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
