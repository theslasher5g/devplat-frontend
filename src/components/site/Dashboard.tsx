import { useEffect, useMemo, useState } from 'react';
import { auditLog, imageCache, invoices, liveLog, parallelToday, runs, team, tokens, usageWeek } from '@/lib/demo';
import { Logo, type Page } from './Shared';

type View = 'overview' | 'runs' | 'cache' | 'pipelines' | 'tokens' | 'billing' | 'team' | 'settings';

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

/* ---------- Views ---------- */

function Overview({ openRun }: { openRun: () => void }) {
  const max = Math.max(...usageWeek.map((u) => u.mins));
  return (
    <div className="grid gap-5">
      {/* KPI row */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Parallelism now', '3 / 5', 'environments active', false],
          ['Test runs today', '47', '↑ 12% vs. yesterday', false],
          ['Avg. container start', '0.8 s', 'from a warm snapshot', false],
          ['7-day success rate', '96.4%', '2 failed runs', false],
        ].map(([k, v, s]) => (
          <Card key={k as string} className="p-5">
            <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">{k}</p>
            <p className="font-doto text-4xl mt-2">{v}</p>
            <p className="text-xs text-[--dark-muted] mt-1">{s}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        {/* parallel usage */}
        <Card>
          <CardHead title="Parallelism utilization · today" right={<span className="font-mono2 text-[10px] text-[--dark-muted]">Limit: 5 (Team)</span>} />
          <div className="p-5">
            <div className="flex items-end gap-1 h-36">
              {parallelToday.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end group relative">
                  <div className={`${v >= 5 ? 'bg-[--red]' : 'bg-[#57C99A]/70'} transition-all`} style={{ height: `${(v / 5) * 100}%` }} title={`${i}:00 — ${v} environments`} />
                </div>
              ))}
            </div>
            <div className="flex justify-between font-mono2 text-[10px] text-[--dark-muted] mt-2"><span>00:00</span><span>12:00</span><span>23:00</span></div>
            <p className="text-xs text-[--dark-muted] mt-3"><span className="text-[--red]">■</span> Limit reached — 4 runs were briefly queued today. Upgrading to Scale would eliminate the wait.</p>
          </div>
        </Card>
        {/* minutes */}
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
      {/* recent runs */}
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
  );
}

function Cache() {
  return (
    <div className="grid gap-5">
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
          <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">{copied ? '✓ Copied' : 'Copy'}</button>
        } />
        <pre className="p-5 font-mono2 text-[12px] leading-relaxed overflow-x-auto">{yaml}</pre>
      </Card>
    </div>
  );
}

function Tokens() {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="grid gap-5">
      <Card>
        <CardHead title="API tokens" right={<button onClick={() => setReveal(true)} className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">+ Create token</button>} />
        <div className="divide-y divide-[--dark-line]">
          {tokens.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_150px_100px_120px_auto] gap-3 items-center px-5 py-3.5 text-sm">
              <div><p className="font-medium">{t.label}</p><p className="font-mono2 text-[11px] text-[--dark-muted]">{t.prefix}</p></div>
              <span className="font-mono2 text-[11px] text-[--dark-muted] hidden sm:block">Scope: {t.scope}</span>
              <span className="font-mono2 text-[11px] text-[--dark-muted] hidden sm:block">{t.lastUsed}</span>
              <span className="font-mono2 text-[11px] text-[--dark-muted] hidden sm:block">{t.created}</span>
              <button className="font-mono2 text-[10px] border border-[#F07A6A]/40 text-[#F07A6A] px-3 py-1.5 hover:bg-[#F07A6A]/10">Revoke</button>
            </div>
          ))}
        </div>
      </Card>
      {reveal && (
        <Card className="p-5 border-[#E8B44C]/50">
          <p className="font-mono2 text-[11px] uppercase tracking-widest text-[#E8B44C]">New token — visible only now</p>
          <p className="font-mono2 text-sm mt-3 bg-black/40 border border-[--dark-line] p-3 select-all">dvp_ci_9AfK2mX7qLpR4tYwB8cD3eF6gH1jN5s</p>
          <p className="text-xs text-[--dark-muted] mt-2">Copy this token into your CI secret. For security reasons we never show it again.</p>
          <button onClick={() => setReveal(false)} className="mt-3 font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">Got it</button>
        </Card>
      )}
    </div>
  );
}

function Billing() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <div className="grid gap-5">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono2 text-[11px] uppercase tracking-widest text-[--dark-muted]">Current plan</p>
              <p className="font-doto text-5xl mt-2">Team<span className="text-[--red]">●</span></p>
              <p className="text-sm text-[--dark-muted] mt-2">5 parallel environments · CHF 79 / month · Renews on 1 Aug 2026</p>
            </div>
            <button className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white shrink-0">Change plan</button>
          </div>
          <div className="mt-5 border border-[#E8B44C]/40 bg-[#E8B44C]/5 p-4 text-sm">
            <p className="text-[#E8B44C] font-medium">Recommendation</p>
            <p className="text-[--dark-muted] mt-1 text-xs">Your limit was hit on 3 days this week (avg. wait 40 s). With <span className="text-white">Scale (15 environments)</span> every run would start instantly.</p>
          </div>
        </Card>
        <Card>
          <CardHead title="Invoices" />
          <div className="divide-y divide-[--dark-line]">
            {invoices.map((i) => (
              <div key={i.nr} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 font-mono2 text-xs">
                <span>{i.nr}</span><span className="text-[--dark-muted]">{i.date}</span><span>{i.amount}</span>
                <span className="text-[#57C99A]">{i.status} · PDF ↓</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="h-fit">
        <CardHead title="Payment & tax" />
        <div className="p-5 space-y-4 text-sm">
          <div><p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Payment method</p><p className="mt-1">Visa •••• 4212 · via Paddle (merchant of record)</p></div>
          <div><p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">VAT ID</p><p className="mt-1 font-mono2">DE 812 345 678 — Reverse charge active</p></div>
          <div><p className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Billing address</p><p className="mt-1 text-[--dark-muted]">acme GmbH · Musterstraße 12 · 80331 Munich, Germany</p></div>
          <button className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">Edit</button>
        </div>
      </Card>
    </div>
  );
}

function Team() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHead title="Members (4)" right={<button className="font-mono2 text-[10px] border border-[--dark-line] px-3 py-1.5 hover:border-white">+ Invite</button>} />
        <div className="divide-y divide-[--dark-line]">
          {team.map((m) => (
            <div key={m.mail} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="font-doto w-9 h-9 grid place-items-center border border-[--dark-line] text-sm">{m.name.slice(0, 2).toUpperCase()}</span>
                <div><p className="text-sm font-medium">{m.name}</p><p className="font-mono2 text-[11px] text-[--dark-muted]">{m.mail}</p></div>
              </div>
              <span className={`font-mono2 text-[10px] uppercase tracking-wider border px-2 py-0.5 ${m.role === 'Owner' ? 'border-[--red] text-[--red]' : 'border-[--dark-line] text-[--dark-muted]'}`}>{m.role}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="h-fit">
        <CardHead title="Audit log" />
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

function Settings() {
  const [ttl, setTtl] = useState(60);
  return (
    <div className="grid gap-5 max-w-2xl">
      <Card>
        <CardHead title="Environment defaults" />
        <div className="p-5 space-y-5 text-sm">
          <label className="block">
            <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Hard TTL per microVM (minutes)</span>
            <input type="range" min={15} max={120} step={15} value={ttl} onChange={(e) => setTtl(+e.target.value)} className="w-full mt-2 accent-[#E63312]" />
            <span className="font-doto text-2xl">{ttl} min</span>
            <p className="text-xs text-[--dark-muted] mt-1">A server-side ceiling — kicks in even if a test run hangs.</p>
          </label>
          <div className="flex items-center justify-between border-t border-[--dark-line] pt-4">
            <div><p>Slack notification on failed runs</p><p className="text-xs text-[--dark-muted]">Channel #ci-alerts</p></div>
            <span className="font-mono2 text-[10px] border border-[#57C99A]/50 text-[#57C99A] px-2 py-1">Active</span>
          </div>
          <div className="flex items-center justify-between border-t border-[--dark-line] pt-4">
            <div><p>Warn at 80% parallelism utilization</p><p className="text-xs text-[--dark-muted]">Email to admins</p></div>
            <span className="font-mono2 text-[10px] border border-[#57C99A]/50 text-[#57C99A] px-2 py-1">Active</span>
          </div>
        </div>
      </Card>
      <Card className="border-[#F07A6A]/30">
        <CardHead title="Danger zone" />
        <div className="p-5 flex items-center justify-between text-sm">
          <p className="text-[--dark-muted]">Permanently delete the organization and all tokens.</p>
          <button className="font-mono2 text-[10px] border border-[#F07A6A]/50 text-[#F07A6A] px-3 py-1.5 hover:bg-[#F07A6A]/10">Delete</button>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Shell ---------- */

export default function Dashboard({ go }: { go: (p: Page) => void }) {
  const [view, setView] = useState<View>('overview');
  const [runOpen, setRunOpen] = useState(false);
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
  return (
    <div className="min-h-screen bg-[--dark] text-[--dark-text] flex">
      {/* sidebar */}
      <aside className="w-56 shrink-0 border-r border-[--dark-line] hidden md:flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-[--dark-line]"><Logo dark onClick={() => go('home')} /></div>
        <nav className="flex-1 py-3">
          {items.map((i) => (
            <button key={i.key} onClick={() => { setView(i.key); setRunOpen(false); }}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${view === i.key ? 'text-white bg-white/[0.05] border-r-2 border-[--red]' : 'text-[--dark-muted] hover:text-white'}`}>
              <span className="w-4 text-center">{i.icon}</span>{i.label}
            </button>
          ))}
        </nav>
        <div className="p-5 border-t border-[--dark-line] font-mono2 text-[10px] text-[--dark-muted] space-y-1">
          <p><span className="text-[#57C99A] pulse-dot">●</span> CH-ZRH-1 operational</p>
          <p>RTT 8 ms · 41% utilization</p>
        </div>
      </aside>
      {/* main */}
      <div className="flex-1 min-w-0">
        <header className="h-16 border-b border-[--dark-line] flex items-center justify-between px-5 sticky top-0 bg-[--dark]/95 backdrop-blur z-30">
          <div className="flex items-center gap-4">
            <span className="md:hidden"><Logo dark onClick={() => go('home')} /></span>
            <h1 className="hidden md:block font-mono2 text-xs uppercase tracking-widest text-[--dark-muted]">acme / {titles[view]}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block font-mono2 text-[10px] border border-[--dark-line] px-2 py-1 text-[--dark-muted]">Plan: Team · 3/5 active</span>
            <button onClick={() => go('home')} className="font-mono2 text-[10px] text-[--dark-muted] hover:text-white">Sign out</button>
            <span className="font-doto w-8 h-8 grid place-items-center border border-[--dark-line] text-xs">SK</span>
          </div>
        </header>
        {/* mobile nav */}
        <div className="md:hidden flex overflow-x-auto border-b border-[--dark-line]">
          {items.map((i) => (
            <button key={i.key} onClick={() => { setView(i.key); setRunOpen(false); }}
              className={`shrink-0 px-4 py-2.5 font-mono2 text-[11px] ${view === i.key ? 'text-white border-b-2 border-[--red]' : 'text-[--dark-muted]'}`}>{i.label}</button>
          ))}
        </div>
        <main className="p-5 lg:p-8">
          {view === 'overview' && !runOpen && <Overview openRun={() => setRunOpen(true)} />}
          {view === 'runs' && !runOpen && <Runs openRun={() => setRunOpen(true)} />}
          {runOpen && <RunDetail back={() => setRunOpen(false)} />}
          {view === 'pipelines' && <Pipelines />}
          {view === 'cache' && <Cache />}
          {view === 'tokens' && <Tokens />}
          {view === 'billing' && <Billing />}
          {view === 'team' && <Team />}
          {view === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
