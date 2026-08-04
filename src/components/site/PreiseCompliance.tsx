import { useState } from 'react';
import { Eyebrow, type Page } from './Shared';
import { EnterpriseEnquiry } from './EnterpriseEnquiry';

import {
  TEAM_BASE, TEAM_SEAT, TEAM_INCLUDED, TEAM_MAX_SEATS, YEARLY_FACTOR,
} from '@/lib/plans';

export function Preise({ go }: { go: (p: Page) => void }) {
  const [yearly, setYearly] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  // Seat count the visitor is pricing for. Starts at the included allowance so
  // the first number they see is the base price, not an inflated one.
  const [seats, setSeats] = useState(TEAM_INCLUDED);
  const billable = Math.max(0, seats - TEAM_INCLUDED);
  const teamMonthly = TEAM_BASE + billable * TEAM_SEAT;
  const shown = yearly ? Math.round(teamMonthly * YEARLY_FACTOR) : teamMonthly;

  const faq = [
    ['How does the seat price work?', `The base covers ${TEAM_INCLUDED} developers. Every developer after that is CHF ${TEAM_SEAT}/month. A team of ${TEAM_INCLUDED} pays CHF ${TEAM_BASE}; a team of 12 pays CHF ${TEAM_BASE + 7 * TEAM_SEAT}. Seats follow who is actually in your team — add someone and the next invoice is prorated, remove someone and it goes back down.`],
    ['What counts as a "parallel environment"?', 'An environment is a microVM with its own Docker daemon — typically one test run (one CI job or one local session), no matter how many containers run inside it. 5 parallel environments means five CI jobs can run integration tests at the same time; the sixth waits briefly in the queue.'],
    ['Where exactly does our test data run?', 'Your test containers run on our own hardware in Basel, Switzerland. No hyperscaler is in that path — not AWS, not Azure, not GCP. The control plane (accounts, billing metadata) is hosted with Infomaniak, also in Switzerland. Our complete sub-processor list is three names long and is in the Privacy Policy.'],
    ['Can we get a DPA?', 'Yes, under Art. 28 GDPR — write to admin@devplat.ch and we will send one. Switzerland holds an EU adequacy decision, so transfers from the EU/EEA need no additional safeguards for the data that stays here.'],
    ['What happens when we hit the parallelism limit?', 'Nothing dramatic: the next run is queued and starts as soon as an environment frees up. No overage fees, no invoice with an asterisk. The dashboard shows how often you queued, so you know when more parallelism actually pays for itself.'],
    ['Do we need a Docker subscription?', 'No. Neither Docker Desktop nor a Docker Hub plan. Our cache serves the image pulls; your CI does not even need a Docker daemon.'],
    ['How does billing work?', 'Monthly or annually in CHF by card, processed by Stripe. Prices exclude VAT — we are a Swiss small business and not currently VAT-registered, so none is added.'],
  ];
  return (
    <main>
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight max-w-[20ch] leading-[1.02]">
            Your test data <span className="font-doto">never</span> leaves Switzerland.
          </h1>
          <p className="mt-6 text-lg text-[--ink-soft] max-w-[54ch]">
            Integration tests run on our own hardware in Basel — no hyperscaler in the path, a
            sub-processor list three names long, and an audit trail you can hand to a reviewer.
            Priced per team, not per minute.
          </p>
          <div className="mt-8 inline-flex border hairline bg-white font-mono2 text-xs">
            <button onClick={() => setYearly(false)} className={`px-4 py-2 ${!yearly ? 'bg-[--ink] text-white' : 'text-[--ink-soft]'}`}>Monthly</button>
            <button onClick={() => setYearly(true)} className={`px-4 py-2 ${yearly ? 'bg-[--ink] text-white' : 'text-[--ink-soft]'}`}>Yearly −17 %</button>
          </div>
        </div>
      </section>

      <section className="border-b hairline">
        {/* Three cards, not four. The fourth used to be Solo, which said "this
            is for one developer" — the exact message the repositioning removes.
            Team carries a seat calculator because a base-plus-seats price is
            unreadable as two numbers: a buyer needs to see THEIR number, and
            making them do the arithmetic is how a plan looks more expensive
            than it is. */}
        <div className="mx-auto max-w-6xl px-5 py-16 grid gap-6 lg:grid-cols-3 items-stretch">

          <div className="border hairline bg-white p-7 flex flex-col">
            <p className="eyebrow">Evaluation</p>
            <p className="mt-4 font-doto text-5xl leading-none">0<span className="text-lg align-top text-[--red]">CHF</span></p>
            <p className="mt-2 font-mono2 text-[10px] uppercase tracking-widest text-[--ink-soft]">14 days, no card</p>
            <p className="mt-4 text-sm text-[--ink-soft] min-h-[3.5rem]">
              Two seats and one environment — enough to point your real pipeline at it and see
              what happens.
            </p>
            <dl className="mt-6 space-y-3 text-sm border-t hairline pt-5">
              <div><dt className="font-mono2 text-[10px] uppercase tracking-widest text-[--ink-soft]">Seats</dt><dd className="mt-0.5">2</dd></div>
              <div><dt className="font-mono2 text-[10px] uppercase tracking-widest text-[--ink-soft]">Parallel environments</dt><dd className="mt-0.5">1</dd></div>
              <div><dt className="font-mono2 text-[10px] uppercase tracking-widest text-[--ink-soft]">Per environment</dt><dd className="mt-0.5">1 vCPU · 2 GB</dd></div>
            </dl>
            <button onClick={() => go('auth')} className="btn-ghost h-11 px-6 mt-auto">Start evaluating</button>
          </div>

          <div className="border bg-[--ink] text-[--dark-text] border-[--ink] p-7 flex flex-col relative">
            <span className="absolute -top-3 left-6 bg-[--red] text-white font-mono2 text-[10px] tracking-widest uppercase px-2 py-1">Most teams</span>
            <p className="eyebrow" style={{ color: 'var(--dark-muted)' }}>Team</p>
            <p className="mt-4 font-doto text-5xl leading-none">
              {shown}<span className="text-lg align-top text-[--red]">CHF</span>
            </p>
            <p className="mt-2 font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">
              {yearly ? 'per month, billed yearly' : 'per month'} · {seats} {seats === 1 ? 'developer' : 'developers'}
            </p>
            <p className="mt-4 text-sm text-[--dark-muted] min-h-[3.5rem]">
              CHF {TEAM_BASE} covers {TEAM_INCLUDED} developers, then CHF {TEAM_SEAT} each. Audit
              log, roles and 2FA enforcement included — not held back for a bigger plan.
            </p>

            {/* The calculator is the card's real content. Base-plus-seats only
                reads as fair once you can see your own number. */}
            <div className="mt-6 border-t border-[--dark-line] pt-5">
              <label className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">
                Developers on your team
              </label>
              <input
                type="range" min={1} max={TEAM_MAX_SEATS} value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                aria-label="Number of developers"
                className="mt-3 w-full accent-[--red]"
              />
              <div className="mt-2 flex justify-between font-mono2 text-[10px] text-[--dark-muted]">
                <span>1</span><span>{TEAM_MAX_SEATS} — beyond that, Enterprise</span>
              </div>
              <p className="mt-3 font-mono2 text-[11px] text-[--dark-muted]">
                {billable === 0
                  ? `${seats} of ${TEAM_INCLUDED} included seats used`
                  : `CHF ${TEAM_BASE} base + ${billable} × CHF ${TEAM_SEAT}`}
              </p>
            </div>

            <dl className="mt-5 space-y-3 text-sm border-t border-[--dark-line] pt-5">
              <div><dt className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Parallel environments</dt><dd className="mt-0.5">5</dd></div>
              <div><dt className="font-mono2 text-[10px] uppercase tracking-widest text-[--dark-muted]">Per environment</dt><dd className="mt-0.5">4 vCPU · 8 GB</dd></div>
            </dl>
            <button onClick={() => go('auth')} className="h-11 px-6 mt-auto bg-white text-[--ink] font-mono2 text-xs uppercase tracking-widest hover:bg-[--paper]">
              Start with 14 free days
            </button>
          </div>

          <div className="border hairline bg-white p-7 flex flex-col">
            <p className="eyebrow">Enterprise</p>
            {/* Deliberately no number. The top tier is sold by conversation
                because that is the only way to find out what a regulated
                customer will actually pay — a published price here would be a
                ceiling we set ourselves. */}
            <p className="mt-4 font-doto text-4xl leading-none">Let&rsquo;s talk</p>
            <p className="mt-2 font-mono2 text-[10px] uppercase tracking-widest text-[--ink-soft]">Priced to your setup</p>
            <p className="mt-4 text-sm text-[--ink-soft] min-h-[3.5rem]">
              For teams whose auditors ask where the data goes: dedicated hardware, SSO, a signed
              DPA, custom retention, and a latency SLA.
            </p>
            <dl className="mt-6 space-y-3 text-sm border-t hairline pt-5">
              <div><dt className="font-mono2 text-[10px] uppercase tracking-widest text-[--ink-soft]">Seats</dt><dd className="mt-0.5">Unlimited</dd></div>
              <div><dt className="font-mono2 text-[10px] uppercase tracking-widest text-[--ink-soft]">Parallel environments</dt><dd className="mt-0.5">From 12</dd></div>
              <div><dt className="font-mono2 text-[10px] uppercase tracking-widest text-[--ink-soft]">Per environment</dt><dd className="mt-0.5">6 vCPU · 12 GB, or agreed</dd></div>
            </dl>
            <a href="#enterprise" className="btn-ghost h-11 px-6 mt-auto grid place-items-center">Talk to us</a>
          </div>
        </div>
      </section>

      {/* ENTERPRISE ENQUIRY */}
      <section id="enterprise" className="border-b hairline bg-[--paper] scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 py-16 grid gap-8 lg:grid-cols-2 items-start">
          <div>
            <Eyebrow>Enterprise</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight">The questions your auditor asks.</h2>
            <p className="mt-4 text-sm text-[--ink-soft] max-w-[52ch]">
              Where does the data live? Who else touches it? Can you show me who did what? Most
              answers to those questions involve a hyperscaler and a sub-processor list that runs
              to two pages. Ours is: Basel, our own machines, three sub-processors, and an audit
              log you can export.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-[--ink-soft]">
              {[
                'Dedicated hardware, not shared capacity',
                'SSO (SAML) and enforced two-factor',
                'Signed DPA under Art. 28 GDPR',
                'Custom data retention and a latency SLA',
                'Named contact — not a support queue',
              ].map((f) => (
                <li key={f} className="flex gap-3">
                  <span className="text-[--red] font-doto">+</span><span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <EnterpriseEnquiry source="pricing" />
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
                  {['Evaluation', 'Team', 'Enterprise'].map((n) => (
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
                  ['Price / month', ['CHF 0', `CHF ${TEAM_BASE}`, 'On request']],
                  // Second price row rather than a footnote: base-plus-seats is
                  // two numbers, and hiding the second one is how a comparison
                  // table becomes a complaint about the first invoice.
                  ['Per developer beyond the allowance', ['—', `CHF ${TEAM_SEAT}`, 'Agreed']],
                  ['Developers included in the base', ['2', String(TEAM_INCLUDED), 'Agreed']],
                  // Mirrors plans.max_members (migration 043); Enterprise is
                  // NULL there, which is what "unlimited" means.
                  ['Maximum team size', ['2', `up to ${TEAM_MAX_SEATS}`, 'Unlimited']],
                  ['Parallel environments', ['1', '5', 'From 12']],
                  ['vCPU per environment', ['1', '4', '6, or agreed']],
                  ['RAM per environment', ['2 GB', '8 GB', '12 GB, or agreed']],
                  ['Time limit', ['14 days', 'none', 'none']],
                  ['CLI + CI integration', [true, true, true]],
                  ['Image cache', [true, true, true]],
                  ['Custom images in cache', [false, true, true]],
                  ['Team management & roles', [false, true, true]],
                  // Moved down from Scale in migration 043. A plan sold to a
                  // company without an audit log fails the first security
                  // review it meets, so gating it was costing the sale it was
                  // meant to upgrade.
                  ['Audit log & export', [false, true, true]],
                  // True on every tier, and checked against the code rather than
                  // assumed: neither routes/teams.ts (require_two_factor) nor
                  // routes/tokens.ts (allowed CIDRs) consults the plan. Listing
                  // them as a Team feature would be the same defect the audit
                  // log had before migration 037 — a pricing page describing a
                  // product that does not exist. It also reads better: security
                  // controls are not the upsell.
                  ['Enforced two-factor', [true, true, true]],
                  ['IP allowlists for API tokens', [true, true, true]],
                  ['Priority scheduling', [false, false, true]],
                  ['Dedicated hardware', [false, false, true]],
                  ['SSO (SAML)', ['—', '—', 'Included']],
                  ['Signed DPA (Art. 28 GDPR)', ['—', 'On request', 'Included']],
                  ['Custom data retention', ['—', '—', 'Agreed']],
                  ['Latency SLA', ['—', '—', '99.5 %']],
                  ['Support', ['—', 'Email < 24 h', 'Named contact']],
                ] as [string, (string | boolean)[]][]).map(([label, cells]) => (
                  <tr key={label}>
                    <td className="p-4 text-[--ink-soft]">{label}</td>
                    {cells.map((c, i) => (
                      <td key={i} className={`p-4 ${i === 1 ? 'bg-[--ink]/[0.02]' : ''}`}>
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
                  // Residency first. It is the row a company reads, and the only
                  // one where the answer is structural rather than a price that
                  // can be matched next quarter.
                  ['Where test data runs', 'Our own hardware in Basel, Switzerland', 'AWS, region of their choosing'],
                  ['Sub-processors', 'Three, listed in full', 'Docker Inc. plus its cloud providers'],
                  ['Pricing model', 'Base + per developer, no metering', 'Minute bundles + overages'],
                  ['What happens at the limit', 'The next run queues', 'Overage billing'],
                  ['Docker subscription required', 'No', 'Tied to Docker plans'],
                  ['Custom images in the cache', 'Yes, from Team', 'Limited'],
                  ['Audit log', 'Every paid plan, exportable', 'Enterprise tier'],
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
