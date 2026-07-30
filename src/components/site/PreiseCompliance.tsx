import { useState } from 'react';
import { tiers } from '@/lib/demo';
import { Eyebrow, type Page } from './Shared';

export function Preise({ go }: { go: (p: Page) => void }) {
  const [yearly, setYearly] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const faq = [
    ['What counts as a "parallel environment"?', 'An environment is a microVM with its own Docker daemon — typically one test run (one CI job or one local session), no matter how many containers run inside it. 5 parallel environments means: 5 CI jobs can run integration tests at the same time; the 6th waits briefly in the queue.'],
    ['What happens once the limit is reached?', 'Nothing dramatic: the next run is queued and starts as soon as an environment frees up. No overage fees, no invoice with an asterisk. The dashboard shows your utilization so you know exactly when an upgrade pays off.'],
    ['Do I need a Docker subscription?', 'No. Neither Docker Desktop nor a Docker Hub plan. Our cache serves the image pulls; your CI doesn\'t even need a Docker daemon.'],
    ['Where exactly do my containers run?', 'Your test containers run on our own hardware in Basel, Switzerland — no hyperscaler in that path. The control plane (accounts, billing metadata) is hosted with Infomaniak, also in Switzerland. Our full sub-processor list is in the Privacy Policy.'],
    ['How does billing work?', 'Monthly or annually in CHF by credit card, processed by Stripe. Prices are shown excluding VAT — we are a Swiss small business and not currently VAT-registered, so no VAT is added.'],
  ];
  return (
    <main>
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight max-w-[20ch] leading-[1.02]">Flat. By parallelism. <span className="font-doto">No</span> asterisks.</h1>
          <p className="mt-6 text-lg text-[--ink-soft] max-w-[52ch]">No counting minutes, no overages. You choose how many test runs can happen at once — the price stays put.</p>
          <div className="mt-8 inline-flex border hairline bg-white font-mono2 text-xs">
            <button onClick={() => setYearly(false)} className={`px-4 py-2 ${!yearly ? 'bg-[--ink] text-white' : 'text-[--ink-soft]'}`}>Monthly</button>
            <button onClick={() => setYearly(true)} className={`px-4 py-2 ${yearly ? 'bg-[--ink] text-white' : 'text-[--ink-soft]'}`}>Yearly −17 %</button>
          </div>
        </div>
      </section>

      <section className="border-b hairline">
        {/* Every card has an identical shape — name, price, one line of
            positioning, the two numbers that define the tier, CTA — so the rows
            line up across the grid without any height hacks. The per-plan
            feature bullets used to live here and were different lengths per
            card, which is what made the row ragged; they are now in the
            comparison table below, where a matrix belongs and where each fact
            exists once. */}
        <div className="mx-auto max-w-6xl px-5 py-16 grid gap-6 lg:grid-cols-4 items-stretch">
          {([
            { name: 'Free', chf: 0, envs: 1, vcpu: 1, ramGb: 2, tagline: 'No credit card required.' },
            ...tiers,
          ] as { name: string; chf: number; envs: number; vcpu: number; ramGb: number; tagline: string; hot?: boolean }[])
            .map((t) => {
              const free = t.chf === 0;
              return (
                <div key={t.name}
                  className={`border p-7 flex flex-col ${t.hot ? 'bg-[--ink] text-[--dark-text] border-[--ink] relative' : 'bg-white hairline'}`}>
                  {t.hot && <span className="absolute -top-3 left-6 bg-[--red] text-white font-mono2 text-[10px] tracking-widest uppercase px-2 py-1">Popular</span>}
                  <p className="eyebrow" style={t.hot ? { color: 'var(--dark-muted)' } : undefined}>{t.name}</p>
                  <p className="mt-4 font-doto text-5xl leading-none">
                    {free ? 0 : yearly ? Math.round(t.chf * 0.83) : t.chf}
                    <span className="text-lg align-top text-[--red]">CHF</span>
                  </p>
                  <p className={`mt-2 font-mono2 text-[10px] uppercase tracking-widest ${t.hot ? 'text-[--dark-muted]' : 'text-[--ink-soft]'}`}>
                    {free ? '14 days, then pick a plan' : yearly ? 'per month, billed yearly' : 'per month'}
                  </p>
                  {/* Fixed height so a tagline that wraps to two lines doesn't
                      push its card's numbers out of line with the others. */}
                  <p className={`mt-4 text-sm min-h-[2.75rem] ${t.hot ? 'text-[--dark-muted]' : 'text-[--ink-soft]'}`}>{t.tagline}</p>
                  {/* Label above value, not beside it. A card is ~204px wide
                      inside its padding at the four-column breakpoint, which is
                      not enough for "Per environment" next to "6 vCPU · 12 GB" —
                      the label wrapped on that row and not the one above it,
                      which looked like a mistake. Stacked, nothing wraps at any
                      width and the values line up down the row. */}
                  <dl className={`mt-2 border-t ${t.hot ? 'border-[--dark-line]' : 'hairline'}`}>
                    {[
                      ['Parallel environments', String(t.envs)],
                      ['Per environment', `${t.vcpu} vCPU · ${t.ramGb} GB`],
                    ].map(([label, value]) => (
                      <div key={label} className={`py-3 border-b ${t.hot ? 'border-[--dark-line]' : 'hairline'}`}>
                        <dt className={`font-mono2 text-[10px] uppercase tracking-widest ${t.hot ? 'text-[--dark-muted]' : 'text-[--ink-soft]'}`}>{label}</dt>
                        <dd className={`mt-1 font-mono2 text-[15px] ${t.hot ? 'text-[--dark-text]' : 'text-[--ink]'}`}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {/* mt-auto pins every CTA to the bottom edge, so the buttons
                      stay level even if a card ever grows a row. */}
                  <button onClick={() => go('auth')} className="mt-auto pt-6 w-full">
                    {/* Fixed height instead of padding: btn-ghost carries a 1px
                        border and the filled variants don't, so equal padding
                        left the outlined button 2px taller and its label a pixel
                        off the others. */}
                    <span className={`flex h-11 w-full items-center justify-center text-sm font-medium transition-colors ${
                      free ? 'btn-ghost' : t.hot ? 'bg-white text-[--ink] hover:bg-[--red] hover:text-white' : 'btn-ink'
                    }`}>
                      {free ? 'Create an account' : `Choose ${t.name}`}
                    </span>
                  </button>
                </div>
              );
            })}
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-16">
          <div className="border hairline bg-white p-7 md:flex items-center justify-between gap-8">
            <div>
              <p className="eyebrow">Enterprise</p>
              <p className="mt-2 text-lg font-semibold">Dedicated hardware, your own region, on-prem option, custom SLAs.</p>
              <p className="text-sm text-[--ink-soft] mt-1">For banks, insurers, and anyone with strict requirements on data residency in Switzerland.</p>
            </div>
            <button onClick={() => go('contact')} className="btn-ghost px-6 py-3 mt-5 md:mt-0 shrink-0">Book a call</button>
          </div>
        </div>
      </section>

      {/* PLAN COMPARISON MATRIX */}
      <section className="border-b hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>Compare plans</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight">Everything, side by side.</h2>
          <div className="mt-8 overflow-x-auto border hairline">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b hairline">
                  <th className="text-left p-4 font-medium eyebrow">Feature</th>
                  {['Free', 'Solo', 'Team', 'Scale'].map((n) => (
                    <th key={n} className={`text-left p-4 font-semibold ${n === 'Team' ? 'text-[--red]' : ''}`}>{n}{n === 'Team' && ' ●'}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:hairline [&>tr:last-child]:border-0">
                {([
                  // This table is now the only place per-plan features are
                  // listed. They used to be bullets on the cards as well, in
                  // different quantities per card — which made the row ragged
                  // and kept the same facts in two places that could disagree.
                  ['Price / month', ['CHF 0', 'CHF 19', 'CHF 79', 'CHF 249']],
                  // Seats sit right under the price because they decide whether
                  // a plan fits at all. Mirrors plans.max_members (migration 031).
                  ['Team seats', ['1', '1', 'up to 10', 'up to 30']],
                  // Solo is 1, not 2 — see backend migration 038.
                  ['Parallel environments', ['1', '1', '5', '8']],
                  ['vCPU per environment', ['1', '2', '4', '6']],
                  ['RAM per environment', ['2 GB', '4 GB', '8 GB', '12 GB']],
                  ['Time limit', ['14 days', 'none', 'none', 'none']],
                  ['CLI + CI integration', [true, true, true, true]],
                  ['Image cache', [true, true, true, true]],
                  ['Custom images in cache', [false, false, true, true]],
                  ['Team management & roles', [false, false, true, true]],
                  ['Priority scheduling', [false, false, false, true]],
                  ['Audit log', [false, false, false, true]],
                  ['SSO (SAML)', ['—', '—', '—', 'Coming soon']],
                  ['Latency SLA', ['—', '—', '—', '99.5 %']],
                  ['Support', ['—', 'Community', 'Email < 24 h', '< 4 h']],
                ] as [string, (string | boolean)[]][]).map(([label, cells]) => (
                  <tr key={label}>
                    <td className="p-4 text-[--ink-soft]">{label}</td>
                    {cells.map((c, i) => (
                      <td key={i} className={`p-4 ${i === 2 ? 'bg-[--ink]/[0.02]' : ''}`}>
                        {typeof c === 'boolean'
                          ? (c ? <span className="text-[--green] font-semibold">✓</span> : <span className="text-[--line]">—</span>)
                          : <span className="text-[--ink]">{c}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => go('auth')} className="btn-ink px-6 py-3">Start free — 14 days</button>
            <button onClick={() => go('contact')} className="btn-ghost px-6 py-3">Talk to us</button>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="border-b hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>The honest comparison</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight">devplat vs. Testcontainers Cloud</h2>
          <p className="mt-3 text-sm text-[--ink-soft] max-w-[70ch]">
            The direct commercial alternative — Docker's own hosted Testcontainers. If you're
            instead weighing this against bigger or self-hosted CI runners, that comparison lives on
            the <button onClick={() => go('technik')} className="underline underline-offset-2 hover:text-[--ink]">How it works</button> page.
          </p>
          <div className="mt-8 overflow-x-auto border hairline">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b hairline font-mono2 text-xs uppercase tracking-wider text-[--ink-soft]">
                  <th className="text-left p-4 font-medium"> </th>
                  <th className="text-left p-4 font-medium">devplat<span className="text-[--red]">●</span></th>
                  <th className="text-left p-4 font-medium">Testcontainers Cloud (Docker)</th>
                </tr>
              </thead>
              <tbody className="text-[--ink-soft]">
                {[
                  ['Pricing model', 'Flat by parallelism + a fixed resource cap', 'Minute bundles + overages'],
                  ['Docker subscription required', 'No', 'Tied to Docker plans'],
                  ['Custom images in the cache', 'Yes (from Team)', 'Limited'],
                  ['Contract & support', 'Direct, human support from the people who built it', 'Enterprise sales funnel'],
                ].map(([a, b, c]) => (
                  <tr key={a} className="border-b hairline last:border-0">
                    <td className="p-4 font-medium text-[--ink]">{a}</td>
                    <td className="p-4">{b}</td>
                    <td className="p-4">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <Eyebrow>Questions</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight mb-8">Before you ask.</h2>
          {faq.map(([q, a], i) => (
            <div key={q} className="border-b hairline">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex justify-between items-center py-5 text-left gap-4">
                <span className="font-medium">{q}</span>
                <span className={`font-doto text-xl text-[--red] transition-transform ${open === i ? 'rotate-45' : ''}`}>+</span>
              </button>
              {open === i && <p className="pb-5 text-sm text-[--ink-soft] max-w-[64ch]">{a}</p>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
