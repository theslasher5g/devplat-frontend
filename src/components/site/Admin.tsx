import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type AdminHost, type AdminOverview, type AdminTeam } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Logo } from './Shared';

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
      <div className="h-2 bg-white/[0.06] border border-[--dark-line]">
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

export default function Admin() {
  const navigate = useNavigate();
  const { me, logout } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [hosts, setHosts] = useState<AdminHost[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [err, setErr] = useState('');

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
                <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 justify-self-end ${hostStatusStyle[h.status]}`}>
                  {h.status === 'online' && <span className="pulse-dot mr-1">●</span>}{h.status}
                </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* cache */}
        <Card>
          <CardHead title="Image cache hit rate" />
          <div className="p-5">
            <p className="font-doto text-4xl">{overview?.cacheHitRate == null ? '—' : `${(overview.cacheHitRate * 100).toFixed(1)}%`}</p>
            <p className="text-xs text-[--dark-muted] mt-1">Reported by the registry proxy once the data plane is connected.</p>
          </div>
        </Card>
      </main>
    </div>
  );
}
