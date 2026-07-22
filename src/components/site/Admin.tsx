import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api, type AdminHost, type AdminOverview, type AdminStatusComponent, type AdminTeam,
  type PostType, type StatusLevel, type StatusPost,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Logo } from './Shared';

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
          This permanently removes the team, its members, tokens, and invites. Only offered because the
          owner never verified their email — this cannot be used on a live team.
        </p>
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
          <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted] mb-3">Components — override the auto status, or leave on auto</p>
          <div className="divide-y divide-[--dark-line] border border-[--dark-line]">
            {(components ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm">{c.name}</span>
                <span className="font-mono2 text-[10px] text-[--dark-muted]">{c.source}</span>
                <select value={c.manualStatus ?? ''} onChange={(e) => void setOverride(c, e.target.value)}
                  className="ml-auto bg-[--dark] border border-[--dark-line] px-2 py-1.5 text-sm">
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

export default function Admin() {
  const navigate = useNavigate();
  const { me, logout } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [hosts, setHosts] = useState<AdminHost[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [err, setErr] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminTeam | null>(null);
  const [editHost, setEditHost] = useState<AdminHost | null>(null);

  useEffect(() => {
    Promise.all([
      api<AdminOverview>('/admin/overview'),
      api<{ hosts: AdminHost[] }>('/admin/hosts'),
      api<{ teams: AdminTeam[] }>('/admin/subscribers'),
    ])
      .then(([o, h, t]) => { setOverview(o); setHosts(h.hosts); setTeams(t.teams); })
      .catch(() => setErr('Could not load admin data — platform-admin role required.'));
  }, []);

  const errorRate = overview?.vmStartErrorRate7d;

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

      <main className="p-5 lg:p-8 grid gap-5 max-w-7xl mx-auto">
        {err && <p className="font-mono2 text-xs text-[#F07A6A]">{err}</p>}

        {/* KPI row */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Teams" value={overview ? String(overview.totalTeams) : '…'} sub={`${overview?.activeSubscriptions ?? 0} active subscriptions`} />
          <Kpi label="MRR" value={overview ? `${overview.mrrChf}` : '…'} sub="CHF / month, list prices" />
          <Kpi label="VM starts · 7d" value={overview ? String(overview.vmStarts7d) : '…'}
            sub={overview?.dataPlaneConnected ? undefined : 'seed data — awaiting data plane'} />
          <Kpi label="VM start error rate · 7d" value={errorRate == null ? '—' : `${(errorRate * 100).toFixed(1)}%`}
            sub={overview ? `${overview.vmStartFailures7d} failed starts` : undefined} />
        </div>

        {/* hosts */}
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

        {/* subscribers */}
        <Card>
          <CardHead title={`Teams & subscriptions (${teams.length})`} />
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="border-b border-[--dark-line] font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">
                  <th className="px-5 py-3 font-medium">Team</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">MRR</th>
                  <th className="px-5 py-3 font-medium">Members</th>
                  <th className="px-5 py-3 font-medium">VM starts · 30d</th>
                  <th className="px-5 py-3 font-medium">Renews</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--dark-line]">
                {teams.map((t) => (
                  <tr key={t.id} className="text-sm">
                    <td className="px-5 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        {t.name}
                        {!t.ownerVerified && (
                          <span className="font-mono2 text-[9px] uppercase tracking-wider border border-[#E8B44C]/40 text-[#E8B44C] px-1.5 py-0.5" title="Owner has not confirmed their email — this team may never become active">Unverified</span>
                        )}
                      </span>
                      <p className="font-mono2 text-[10px] text-[--dark-muted] font-normal">since {fmtDate(t.createdAt)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${t.planTier === 'free' ? 'border-[--dark-line] text-[--dark-muted]' : 'border-[#57C99A]/40 text-[#57C99A]'}`}>{t.planLabel}</span>
                    </td>
                    <td className="px-5 py-3 font-mono2 text-xs text-[--dark-muted]">{t.subscriptionStatus ?? '—'}</td>
                    <td className="px-5 py-3 font-mono2 text-xs">{t.mrrChf > 0 ? `CHF ${t.mrrChf}` : '—'}</td>
                    <td className="px-5 py-3 font-mono2 text-xs">{t.members}</td>
                    <td className="px-5 py-3 font-mono2 text-xs">{t.vmStarts30d}</td>
                    <td className="px-5 py-3 font-mono2 text-xs text-[--dark-muted]">{fmtDate(t.currentPeriodEnd)}</td>
                    <td className="px-5 py-3 text-right">
                      {!t.ownerVerified && (
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="font-mono2 text-[10px] uppercase tracking-wider text-[--red]/80 hover:text-[--red] border border-transparent hover:border-[--red]/40 px-2 py-1"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* status page management */}
        <StatusAdmin />

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
      </main>

      {deleteTarget && (
        <DeleteTeamModal
          team={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={(id) => { setTeams((prev) => prev.filter((t) => t.id !== id)); setDeleteTarget(null); }}
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
