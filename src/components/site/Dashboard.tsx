import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  API_URL, ApiError, api,
  type ApiTokenInfo, type CreatedToken, type EnvironmentInfo, type InvoiceInfo, type SubscriptionInfo, type TeamInfo,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Logo } from './Shared';

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

/* ---------- Overview: real environments from the scheduler ---------- */

function Overview({ limit, planLabel, goView }: { limit: number; planLabel: string; goView: (v: View) => void }) {
  const [envs, setEnvs] = useState<EnvironmentInfo[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    api<{ environments: EnvironmentInfo[] }>('/environments')
      .then((d) => { setEnvs(d.environments); setErr(''); })
      .catch(() => setErr('Could not load environments.'));
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
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Plan', planLabel, 'manage under Usage & billing'],
          ['Parallelism limit', String(limit), `environment${limit === 1 ? '' : 's'} at once`],
          ['Active now', envs ? String(active) : '—', 'assigned microVMs'],
          ['Queued', envs ? String(queued) : '—', 'waiting for a free slot'],
        ].map(([k, v, s]) => (
          <Card key={k} className="p-5">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">{k}</p>
            {v === '—' && envs === null && !err
              ? <Skeleton className="h-9 w-16 mt-2.5 mb-1.5" />
              : <p className="font-doto text-4xl mt-2">{v}</p>}
            <p className="text-xs text-[--dark-muted] mt-1">{s}</p>
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
                <li>1 · <button onClick={() => goView('tokens')} className="text-white hover:text-[#8AB8F0]">Create an API token</button> for your CI or laptop</li>
                <li className="flex items-center gap-2 flex-wrap">
                  <span>2 · Install the CLI:</span>
                  <code className="text-white bg-black/40 border border-[--dark-line] px-2 py-1">curl -fsSL https://get.devplat.ch | sh</code>
                  <CopyButton value="curl -fsSL https://get.devplat.ch | sh" />
                </li>
                <li>3 · <span className="text-white">devplat connect --token $DEVPLAT_TOKEN</span> — then run your tests as usual</li>
              </ol>
            </div>
          )}
          {envs?.map((e) => (
            <div key={e.requestId} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.3fr_1fr_110px_auto_auto] gap-3 items-center px-5 py-3.5 font-mono2 text-xs">
              <div>
                <p className="font-sans text-sm font-medium">{e.vmId ?? 'waiting for slot'}</p>
                <p className="text-[11px] text-[--dark-muted]">{e.requestId}</p>
              </div>
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
    </div>
  );
}

function Pipelines() {
  const [repo, setRepo] = useState('');
  const [ci, setCi] = useState<'GitHub Actions' | 'GitLab CI'>('GitHub Actions');
  const [copied, setCopied] = useState(false);
  const repoComment = repo.trim() ? `${repo.trim()} · ` : '';
  const yaml = ci === 'GitHub Actions'
    ? `# ${repoComment}.github/workflows/ci.yml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devplat/connect@v1
        with:
          token: \${{ secrets.DEVPLAT_TOKEN }}
      - run: mvn verify`
    : `# ${repoComment}.gitlab-ci.yml
integration-tests:
  before_script:
    - curl -sf https://get.devplat.ch | sh
    - devplat connect --token $DEVPLAT_TOKEN
  script:
    - mvn verify`;
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
          <p>
            <span className={apiOk === false ? 'text-[--red]' : apiOk === null ? 'text-[--dark-muted]' : 'text-[#57C99A] pulse-dot'}>●</span>{' '}
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
