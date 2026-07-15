import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { auditLog, imageCache, liveLog, parallelToday, runs, usageWeek } from '@/lib/demo';
import {
  ApiError, api,
  type ApiTokenInfo, type CreatedToken, type InvoiceInfo, type SubscriptionInfo, type TeamInfo,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Logo } from './Shared';

type View = 'overview' | 'runs' | 'cache' | 'pipelines' | 'tokens' | 'billing' | 'team' | 'settings';
const VIEWS: View[] = ['overview', 'runs', 'cache', 'pipelines', 'tokens', 'billing', 'team', 'settings'];

const statusStyle: Record<string, string> = {
  running: 'text-[#8AB8F0] border-[#8AB8F0]/40',
  passed: 'text-[#57C99A] border-[#57C99A]/40',
  failed: 'text-[#F07A6A] border-[#F07A6A]/40',
  queued: 'text-[--dark-muted] border-[--dark-line]',
};
const statusLabel: Record<string, string> = { running: 'running', passed: 'passed', failed: 'failed', queued: 'queued' };

function Badge({ s }: { s: string }) {
  return <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${statusStyle[s]}`}>{s === 'running' && <span className="pulse-dot mr-1">●</span>}{statusLabel[s]}</span>;
}

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

function SampleTag() {
  return <span className="font-mono2 text-[10px] text-[#E8B44C] border border-[#E8B44C]/40 px-2 py-0.5">Sample data — live once the data plane ships</span>;
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

/* ---------- Views (runs/cache/pipelines stay on sample data until the data plane exists) ---------- */

function Overview({ openRun, limit, planLabel }: { openRun: () => void; limit: number; planLabel: string }) {
  const max = Math.max(...usageWeek.map((u) => u.mins));
  return (
    <div className="grid gap-5">
      <div className="flex justify-end"><SampleTag /></div>
      {/* KPI row */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Parallelism now', `3 / ${limit}`, 'environments active'],
          ['Test runs today', '47', '↑ 12% vs. yesterday'],
          ['Avg. container start', '0.8 s', 'from a warm snapshot'],
          ['7-day success rate', '96.4%', '2 failed runs'],
        ].map(([k, v, s]) => (
          <Card key={k as string} className="p-5">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">{k}</p>
            <p className="font-doto text-4xl mt-2">{v}</p>
            <p className="text-xs text-[--dark-muted] mt-1">{s}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead title="Parallelism utilization · today" right={<span className="font-mono2 text-[10px] text-[--dark-muted]">Limit: {limit} ({planLabel})</span>} />
          <div className="p-5">
            <div className="flex items-end gap-1 h-36">
              {parallelToday.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end group relative">
                  <div className={`${v >= limit ? 'bg-[--red]' : 'bg-[#57C99A]/70'} transition-all`} style={{ height: `${Math.min((v / Math.max(limit, 1)) * 100, 100)}%` }} title={`${i}:00 — ${v} environments`} />
                </div>
              ))}
            </div>
            <div className="flex justify-between font-mono2 text-[10px] text-[--dark-muted] mt-2"><span>00:00</span><span>12:00</span><span>23:00</span></div>
          </div>
        </Card>
        <Card>
          <CardHead title="Test minutes · this week" />
          <div className="p-5">
            <div className="flex items-end gap-3 h-36">
              {usageWeek.map((u) => (
                <div key={u.day} className="flex-1 flex flex-col items-center gap-2 justify-end">
                  <div className="w-full bg-[#8AB8F0]/60" style={{ height: `${(u.mins / max) * 100}%` }} />
                  <span className="font-mono2 text-[10px] text-[--dark-muted]">{u.day}</span>
                </div>
              ))}
            </div>
            <p className="font-mono2 text-xs text-[--dark-muted] mt-3">Σ 1,706 min — flat rate, no extra cost.</p>
          </div>
        </Card>
      </div>
      <Card>
        <CardHead title="Recent test runs" right={<button onClick={openRun} className="font-mono2 text-[10px] text-[#8AB8F0] hover:text-white">View live run →</button>} />
        <div className="divide-y divide-[--dark-line]">
          {runs.slice(0, 4).map((r) => (
            <button key={r.id} onClick={openRun} className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_1fr_auto_auto] gap-3 items-center px-5 py-3.5 text-left hover:bg-white/[0.03]">
              <div>
                <p className="text-sm font-medium">{r.repo}</p>
                <p className="font-mono2 text-[11px] text-[--dark-muted]">{r.branch} · {r.commit}</p>
              </div>
              <p className="hidden sm:block font-mono2 text-[11px] text-[--dark-muted]">{r.containers.join(' · ')}</p>
              <p className="hidden sm:block font-mono2 text-[11px] text-[--dark-muted]">{r.duration}</p>
              <Badge s={r.status} />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RunDetail({ back }: { back: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= liveLog.length) return;
    const t = setTimeout(() => setN((v) => v + 1), n === 10 ? 1400 : 380);
    return () => clearTimeout(t);
  }, [n]);
  const tone: Record<string, string> = { sys: 'text-[--dark-muted]', ok: 'text-[#57C99A]', img: 'text-[#E8B44C]', test: 'text-[#8AB8F0]' };
  const r = runs[0];
  return (
    <div className="grid gap-5">
      <button onClick={back} className="font-mono2 text-xs text-[--dark-muted] hover:text-white text-left">← All test runs</button>
      <Card>
        <CardHead title={`${r.repo} · ${r.branch}`} right={<Badge s={n >= liveLog.length ? 'passed' : 'running'} />} />
        <div className="grid sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[--dark-line] font-mono2 text-xs">
          {[['Trigger', r.trigger], ['Commit', r.commit], ['Region', r.region], ['microVM', 'vm_c8e2 · Firecracker']].map(([k, v]) => (
            <div key={k} className="px-5 py-3"><p className="text-[--dark-muted] text-[10px] uppercase tracking-widest">{k}</p><p className="mt-1">{v}</p></div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead title="Log stream" right={<span className="font-mono2 text-[10px] text-[--dark-muted]"><span className="text-[#57C99A] pulse-dot">●</span> live</span>} />
        <div className="p-5 font-mono2 text-[12px] leading-relaxed h-80 overflow-y-auto">
          {liveLog.slice(0, n).map((l, i) => (
            <div key={i} className="flex gap-3"><span className="text-[--dark-muted] shrink-0">{l.t}</span><span className={tone[l.s]}>{l.m}</span></div>
          ))}
          {n < liveLog.length ? <div className="cursor-blink" /> : (
            <div className="mt-3 border border-[#57C99A]/40 text-[#57C99A] p-3">✓ 48/48 tests passed · duration 1:38 · microVM destroyed, nothing persisted.</div>
          )}
        </div>
      </Card>
      <Card>
        <CardHead title="Containers in this run" />
        <div className="divide-y divide-[--dark-line]">
          {[['postgres:16', 'Cache hit · start 0.37 s · port 5432'], ['redis:7', 'Cache hit · start 0.21 s · port 6379'], ['kafka:3.7', 'Cache hit · start 1.74 s · port 9092']].map(([a, b]) => (
            <div key={a} className="flex justify-between px-5 py-3 font-mono2 text-xs"><span>{a}</span><span className="text-[--dark-muted]">{b}</span></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Runs({ openRun }: { openRun: () => void }) {
  const [f, setF] = useState('all');
  const list = useMemo(() => (f === 'all' ? runs : runs.filter((r) => r.status === f)), [f]);
  return (
    <div className="grid gap-5">
      <div className="flex justify-end"><SampleTag /></div>
      <Card>
        <CardHead title={`Test runs (${list.length})`} right={
          <div className="flex gap-1 font-mono2 text-[10px]">
            {['all', 'running', 'passed', 'failed'].map((k) => (
              <button key={k} onClick={() => setF(k)} className={`px-2 py-1 border ${f === k ? 'border-white text-white' : 'border-[--dark-line] text-[--dark-muted] hover:text-white'}`}>{k === 'all' ? 'all' : statusLabel[k]}</button>
            ))}
          </div>
        } />
        <div className="divide-y divide-[--dark-line]">
          {list.map((r) => (
            <button key={r.id} onClick={openRun} className="w-full grid grid-cols-[1fr_auto] md:grid-cols-[110px_1.2fr_1fr_100px_90px_auto] gap-3 items-center px-5 py-3.5 text-left hover:bg-white/[0.03] font-mono2 text-xs">
              <span className="text-[--dark-muted] hidden md:block">{r.id}</span>
              <span className="font-sans text-sm font-medium">{r.repo}<span className="block md:hidden font-mono2 text-[11px] text-[--dark-muted] font-normal">{r.branch}</span></span>
              <span className="text-[--dark-muted] hidden md:block">{r.containers.join(' · ')}</span>
              <span className="text-[--dark-muted] hidden md:block">{r.trigger}</span>
              <span className="text-[--dark-muted] hidden md:block">{r.duration}</span>
              <Badge s={r.status} />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Cache() {
  return (
    <div className="grid gap-5">
      <div className="flex justify-end"><SampleTag /></div>
      <div className="grid gap-5 sm:grid-cols-3">
        {[['Cache hit rate', '98.7%', 'last 7 days'], ['Transfer volume saved', '412 GB', 'this month'], ['Snapshot images', '5 + 5', 'warm + standard']].map(([k, v, s]) => (
          <Card key={k} className="p-5">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">{k}</p>
            <p className="font-doto text-4xl mt-2">{v}</p>
            <p className="text-xs text-[--dark-muted] mt-1">{s}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHead title="Image cache" right={<button className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">+ Add custom image</button>} />
        <div className="divide-y divide-[--dark-line]">
          {imageCache.map((i) => (
            <div key={i.name + i.tag} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_90px_90px_auto_auto] gap-3 items-center px-5 py-3 font-mono2 text-xs">
              <span className="text-sm">{i.name}:<span className="text-[--dark-muted]">{i.tag}</span></span>
              <span className="text-[--dark-muted] hidden sm:block">{i.size}</span>
              <span className="text-[--dark-muted] hidden sm:block">{i.hits}× hits</span>
              <span className={`hidden sm:block ${i.warm ? 'text-[#57C99A]' : 'text-[#E8B44C]'}`}>{i.warm ? '● warm' : '○ cold'}</span>
              <span className={i.snapshot ? 'text-[#8AB8F0]' : 'text-[--dark-muted]'}>{i.snapshot ? '⚡ Snapshot' : '— Registry'}</span>
            </div>
          ))}
        </div>
      </Card>
      <p className="font-mono2 text-[11px] text-[--dark-muted]">⚡ Snapshot = Firecracker resume in milliseconds. ● warm = in the local registry proxy, served in &lt; 1 s.</p>
    </div>
  );
}

function Pipelines() {
  const [repo, setRepo] = useState('acme/payment-service');
  const [ci, setCi] = useState<'GitHub Actions' | 'GitLab CI'>('GitHub Actions');
  const [copied, setCopied] = useState(false);
  const yaml = ci === 'GitHub Actions'
    ? `# ${repo} · .github/workflows/ci.yml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devplat/connect@v1
        with:
          token: \${{ secrets.DEVPLAT_TOKEN }}
      - run: mvn verify`
    : `# ${repo} · .gitlab-ci.yml
integration-tests:
  before_script:
    - curl -sf https://get.devplat.dev | sh
    - devplat connect --token $DEVPLAT_TOKEN
  script:
    - mvn verify`;
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
      <Card className="p-5 h-fit">
        <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted] mb-4">Pipeline snippet generator</p>
        <label className="block mb-4">
          <span className="font-mono2 text-[10px] text-[--dark-muted] uppercase tracking-widest">Repository</span>
          <input value={repo} onChange={(e) => setRepo(e.target.value)} className="mt-1.5 w-full bg-transparent border border-[--dark-line] px-3 py-2 text-sm font-mono2 outline-none focus:border-white" />
        </label>
        <span className="font-mono2 text-[10px] text-[--dark-muted] uppercase tracking-widest">CI system</span>
        <div className="flex gap-1 mt-1.5 font-mono2 text-xs">
          {(['GitHub Actions', 'GitLab CI'] as const).map((k) => (
            <button key={k} onClick={() => setCi(k)} className={`px-3 py-2 border ${ci === k ? 'border-white text-white' : 'border-[--dark-line] text-[--dark-muted]'}`}>{k}</button>
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
    await api(`/tokens/${id}`, { method: 'DELETE' }).catch(() => {});
    if (created?.id === id) setCreated(null);
    load();
  };

  return (
    <div className="grid gap-5">
      <Card>
        <CardHead title="API tokens" right={<button onClick={() => { setCreating(true); setCreated(null); }} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">+ Create token</button>} />
        <div className="divide-y divide-[--dark-line]">
          {tokens === null && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">Loading …</p>}
          {tokens?.length === 0 && <p className="px-5 py-4 font-mono2 text-xs text-[--dark-muted]">No tokens yet — create one for your CI.</p>}
          {tokens?.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_150px_100px_120px_auto] gap-3 items-center px-5 py-3.5 text-sm">
              <div><p className="font-medium">{t.label}</p><p className="font-mono2 text-[11px] text-[--dark-muted]">{t.prefix}</p></div>
              <span className="font-mono2 text-[11px] text-[--dark-muted] hidden sm:block">Scope: {t.scope}</span>
              <span className="font-mono2 text-[11px] text-[--dark-muted] hidden sm:block">{fmtAgo(t.lastUsedAt)}</span>
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
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="GitHub Actions · payment-service"
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
          <p className="font-mono2 text-sm mt-3 bg-black/40 border border-[--dark-line] p-3 select-all break-all">{created.token}</p>
          <p className="text-xs text-[--dark-muted] mt-2">Copy this token into your CI secret. For security reasons we never show it again.</p>
          <button onClick={() => setCreated(null)} className="mt-3 font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">Got it</button>
        </Card>
      )}
    </div>
  );
}

/* ---------- Billing: real data ---------- */

const TIER_CARDS = [
  { tier: 'solo' as const, name: 'Solo', chf: 29, envs: 2 },
  { tier: 'team' as const, name: 'Team', chf: 79, envs: 5 },
  { tier: 'scale' as const, name: 'Scale', chf: 199, envs: 15 },
];

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
                    {t.envs} environments · CHF {yearly ? Math.round(t.chf * 0.83) : t.chf}/mo{yearly ? ' (billed yearly)' : ''}
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
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
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
                <input value={inviteMail} onChange={(e) => setInviteMail(e.target.value)} type="email" placeholder="colleague@acme.dev"
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
      </div>
      <Card className="h-fit">
        <CardHead title="Audit log" right={<SampleTag />} />
        <div className="divide-y divide-[--dark-line]">
          {auditLog.map((a, i) => (
            <div key={i} className="px-5 py-3 text-xs">
              <p className="font-mono2 text-[--dark-muted]">{a.when} · {a.who}</p>
              <p className="mt-0.5">{a.what}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Settings({ teamName, onRenamed }: { teamName: string; onRenamed: () => void }) {
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
      <Card>
        <CardHead title="Environment defaults" right={<SampleTag />} />
        <div className="p-5 space-y-5 text-sm">
          <div className="flex items-center justify-between">
            <div><p>Hard TTL per microVM</p><p className="text-xs text-[--dark-muted]">Configurable once the data plane ships.</p></div>
            <span className="font-doto text-2xl">60 min</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Shell ---------- */

export default function Dashboard() {
  const navigate = useNavigate();
  const { view: viewParam } = useParams<{ view: string }>();
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : 'overview';
  const [runOpen, setRunOpen] = useState(false);
  const { me, refresh, logout } = useAuth();
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);

  useEffect(() => {
    api<TeamInfo>('/teams/me').then(setTeamInfo).catch(() => setTeamInfo(null));
  }, [me?.team?.id]);

  const setView = (v: View) => { setRunOpen(false); navigate(v === 'overview' ? '/app' : `/app/${v}`); };
  const signOut = async () => { await logout(); navigate('/'); };

  const items: { key: View; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '▦' },
    { key: 'runs', label: 'Test runs', icon: '▶' },
    { key: 'pipelines', label: 'CI pipelines', icon: '⛓' },
    { key: 'cache', label: 'Image cache', icon: '⚡' },
    { key: 'tokens', label: 'API tokens', icon: '⌘' },
    { key: 'billing', label: 'Usage & billing', icon: '▤' },
    { key: 'team', label: 'Team & audit', icon: '◉' },
    { key: 'settings', label: 'Settings', icon: '⚙' },
  ];
  const titles: Record<View, string> = {
    overview: 'Overview', runs: 'Test runs', pipelines: 'CI pipelines', cache: 'Image cache',
    tokens: 'API tokens', billing: 'Usage & billing', team: 'Team & audit', settings: 'Settings',
  };

  const teamName = teamInfo?.team.name ?? me?.team?.name ?? '—';
  const planLabel = teamInfo?.team.planLabel ?? 'Free Trial';
  const limit = teamInfo?.team.parallelLimit ?? 1;
  const initials = (me?.user.email ?? '??').slice(0, 2).toUpperCase();

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
          <p><span className="text-[#57C99A] pulse-dot">●</span> CH-ZRH-1 operational</p>
          <p>Control plane · api.devplat.ch</p>
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
            <span className="hidden sm:block font-mono2 text-[10px] border border-[--dark-line] px-2 py-1 text-[--dark-muted]">Plan: {planLabel} · {limit} env{limit === 1 ? '' : 's'}</span>
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
          {view === 'overview' && !runOpen && <Overview openRun={() => setRunOpen(true)} limit={limit} planLabel={planLabel} />}
          {view === 'runs' && !runOpen && <Runs openRun={() => setRunOpen(true)} />}
          {runOpen && <RunDetail back={() => setRunOpen(false)} />}
          {view === 'pipelines' && <Pipelines />}
          {view === 'cache' && <Cache />}
          {view === 'tokens' && <Tokens />}
          {view === 'billing' && <Billing />}
          {view === 'team' && <Team />}
          {view === 'settings' && (
            <Settings teamName={teamName} onRenamed={() => { void refresh(); api<TeamInfo>('/teams/me').then(setTeamInfo).catch(() => {}); }} />
          )}
        </main>
      </div>
    </div>
  );
}
