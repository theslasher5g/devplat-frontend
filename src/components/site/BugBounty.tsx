import { Eyebrow, type Page } from './Shared';

// Rewards are devplat subscription credit, not cash — we're a small Swiss team,
// and free months of the product plus recognition is what we can offer honestly.
const tiers: { sev: string; reward: string; example: string; color: string }[] = [
  {
    sev: 'Critical',
    reward: '12 months Team, free',
    example: 'Remote code execution on a host, cross-tenant VM escape, reading another team’s Docker socket, full auth bypass.',
    color: 'var(--red)',
  },
  {
    sev: 'High',
    reward: '5 months Team, free',
    example: 'Privilege escalation to platform-admin, leaking another team’s tokens or environments, breaking the WireGuard control-plane boundary.',
    color: '#D9760F',
  },
  {
    sev: 'Medium',
    reward: '2 months Team, free',
    example: 'Stored XSS in the dashboard, IDOR exposing non-sensitive data, bypassing a per-team rate limit or parallelism cap.',
    color: '#C79A16',
  },
  {
    sev: 'Low',
    reward: 'Swag + Hall of Fame',
    example: 'Missing security headers with real impact, a self-XSS chain, verbose errors leaking stack traces.',
    color: '#5B7C8D',
  },
];

const inScope = [
  ['devplat.ch · app.devplat.ch', 'The marketing site and the dashboard SPA.'],
  ['api.devplat.ch', 'The control plane: auth, teams, tokens, billing, the scheduler API.'],
  ['The devplat CLI', 'The Go binary and its update/install scripts served from get.devplat.ch.'],
  ['The data plane', 'Firecracker microVMs and the tunnel — anything that breaks tenant isolation.'],
];

const outOfScope = [
  'Denial of service, volumetric or resource-exhaustion attacks, and load testing.',
  'Social engineering, phishing, or physical attacks against our team or data centre.',
  'Reports from automated scanners with no demonstrated, reproducible impact.',
  'Missing best-practice headers or TLS config without a concrete exploit.',
  'Anything requiring a rooted/jailbroken device or a compromised end-user machine.',
];

const rules = [
  'Test only against your own account, team, and environments — never touch another customer’s data.',
  'Don’t run destructive payloads, exfiltrate data, or degrade the service for others.',
  'Give us a clear write-up: steps to reproduce, impact, and a proof of concept.',
  'Give us reasonable time to fix before any public disclosure — we’ll keep you posted the whole way.',
];

export default function BugBounty({ go }: { go: (p: Page) => void }) {
  return (
    <main>
      {/* HERO */}
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Bug bounty</Eyebrow>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] max-w-[20ch]">
            Break our isolation. We’ll <span className="font-doto">thank you</span> for it.
          </h1>
          <p className="mt-6 text-lg text-[--ink-soft] max-w-[58ch]">
            The whole pitch of devplat is a hard boundary between customers. If you can get past it —
            or past auth, billing, or the control plane — we want to hear from you before anyone else does.
            Find something real, and you’ll earn free months of devplat and a spot in our Hall of Fame.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="mailto:security@devplat.ch" className="btn-ink px-6 py-3">Report a vulnerability</a>
            <button onClick={() => go('security')} className="btn-ghost px-6 py-3">Read the security model</button>
          </div>
          <p className="mt-4 font-mono2 text-xs text-[--ink-soft]">
            security@devplat.ch · we acknowledge within 2 business days.
          </p>
        </div>
      </section>

      {/* REWARDS */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>Rewards</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight max-w-[30ch]">Paid in product, not cash.</h2>
          <p className="mt-4 text-sm text-[--ink-soft] max-w-[62ch]">
            We’re a small Swiss team and we’d rather be upfront: rewards are devplat subscription
            credit, not money. Severity is set with CVSS as a starting point and adjusted for real-world
            impact. Every valid, first-to-report finding also lands in the Hall of Fame.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((t) => (
              <div key={t.sev} className="border hairline bg-white p-6 lift accent-top">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} aria-hidden />
                  <p className="font-mono2 text-xs uppercase tracking-widest text-[--ink-soft]">{t.sev}</p>
                </div>
                <p className="mt-3 font-doto text-2xl leading-tight">{t.reward}</p>
                <p className="mt-3 text-sm text-[--ink-soft]">{t.example}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 font-mono2 text-xs text-[--ink-soft] max-w-[62ch]">
            Team credit can be applied to any plan, or converted to the equivalent value on a higher tier.
            Prefer swag or a donation to a charity of your choice instead? Just say so.
          </p>
        </div>
      </section>

      {/* SCOPE */}
      <section className="border-b hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 grid gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>In scope</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight">What we care about most.</h2>
            <ul className="mt-6 space-y-4">
              {inScope.map(([t, d]) => (
                <li key={t} className="border-l-2 border-[--red] pl-4">
                  <p className="font-mono2 text-sm text-[--ink]">{t}</p>
                  <p className="mt-1 text-sm text-[--ink-soft] max-w-[46ch]">{d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Out of scope</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight">What we’ll close as N/A.</h2>
            <ul className="mt-6 space-y-3 text-sm text-[--ink-soft]">
              {outOfScope.map((o) => (
                <li key={o} className="flex gap-3"><span className="text-[--ink-soft]/50 shrink-0">✕</span>{o}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* RULES + SAFE HARBOR */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-16 grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Eyebrow>Ground rules</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight">Test hard, but stay in your own lane.</h2>
            <ol className="mt-6 space-y-4 text-sm text-[--ink-soft]">
              {rules.map((r, i) => (
                <li key={r} className="flex gap-4">
                  <span className="font-doto text-xl text-[--red] shrink-0">{i + 1}</span>
                  <span className="max-w-[54ch]">{r}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="border hairline bg-[--ink] text-[--dark-text] p-7 dotgrid-dark">
            <p className="eyebrow" style={{ color: 'var(--dark-muted)' }}>Safe harbor</p>
            <h3 className="mt-2 text-lg font-semibold">Act in good faith and we won’t come after you.</h3>
            <p className="mt-3 text-sm text-[--dark-muted]">
              If you follow the rules above and make a genuine effort to avoid privacy violations, data
              destruction, and service disruption, we will not pursue or support legal action against you,
              and we consider your research authorised. If you’re unsure whether something is in scope,
              ask us first — we’d rather talk it through than have you hold back.
            </p>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="border-b hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>How it works</Eyebrow>
          <div className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              ['Report', 'Email security@devplat.ch with steps, impact, and a PoC.'],
              ['Triage', 'We acknowledge in 2 business days and confirm severity with you.'],
              ['Fix', 'We patch, roll out, and keep you updated until it’s closed.'],
              ['Reward', 'Valid first reports get subscription credit and a Hall of Fame entry.'],
            ].map(([t, d], i) => (
              <div key={t} className="border hairline p-6">
                <p className="font-doto text-3xl text-[--red]">{i + 1}</p>
                <h3 className="mt-2 font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-[--ink-soft]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[--ink] text-[--dark-text]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:flex items-center justify-between gap-8">
          <div>
            <p className="text-2xl font-semibold max-w-[30ch]">Found something? We’re listening.</p>
            <p className="mt-2 text-[--dark-muted] max-w-[46ch]">Responsible disclosure keeps every devplat customer safer — including you.</p>
          </div>
          <a href="mailto:security@devplat.ch" className="mt-6 md:mt-0 shrink-0 bg-white text-[--ink] px-6 py-3 font-medium hover:bg-[--red] hover:text-white transition-colors inline-block">
            security@devplat.ch
          </a>
        </div>
      </section>
    </main>
  );
}
