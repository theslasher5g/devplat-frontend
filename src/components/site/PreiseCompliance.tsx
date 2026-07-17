import { useState } from 'react';
import { tiers } from '@/lib/demo';
import { AVV_PDF_BASE64 } from '@/lib/avv-data';
import { Eyebrow, type Page } from './Shared';

function downloadDpa() {
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${AVV_PDF_BASE64}`;
  link.download = 'devplat-dpa-template.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function Preise({ go }: { go: (p: Page) => void }) {
  const [yearly, setYearly] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const faq = [
    ['What counts as a "parallel environment"?', 'An environment is a microVM with its own Docker daemon — typically one test run (one CI job or one local session), no matter how many containers run inside it. 5 parallel environments means: 5 CI jobs can run integration tests at the same time; the 6th waits briefly in the queue.'],
    ['What happens once the limit is reached?', 'Nothing dramatic: the next run is queued and starts as soon as an environment frees up. No overage fees, no invoice with an asterisk. The dashboard shows your utilization so you know exactly when an upgrade pays off.'],
    ['Do I need a Docker subscription?', 'No. Neither Docker Desktop nor a Docker Hub plan. Our cache serves the image pulls; your CI doesn\'t even need a Docker daemon.'],
    ['Where exactly do my containers run?', 'On our own hardware in Basel, Switzerland. No hyperscaler, no sub-sub-processors. Details on the Privacy & Legal page.'],
    ['How does billing work?', 'Monthly or annually by credit card or invoice through our payment processor (merchant of record) — including correct VAT handling for EU customers via reverse charge.'],
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
        <div className="mx-auto max-w-6xl px-5 py-16 grid gap-6 lg:grid-cols-4">
          <div className="border hairline bg-white p-7 flex flex-col">
            <p className="eyebrow">Free</p>
            <p className="mt-4 font-doto text-5xl">0<span className="text-lg align-top text-[--red]">CHF</span></p>
            <p className="mt-2 text-sm text-[--ink-soft]">To try it out. 14 days.</p>
            <p className="mt-3 font-mono2 text-[11px] text-[--ink-soft]">up to 1 vCPU / 2 GB per environment</p>
            <ul className="mt-5 space-y-2 text-sm text-[--ink-soft] flex-1">
              {['1 parallel environment', '1 vCPU / 2 GB per environment', '14-day trial', 'Standard image cache'].map((f) => (
                <li key={f} className="flex gap-2"><span className="text-[--red]">—</span>{f}</li>
              ))}
            </ul>
            <button onClick={() => go('auth')} className="btn-ghost mt-6 py-2.5 text-sm">Create an account</button>
          </div>
          {tiers.map((t) => (
            <div key={t.name} className={`border p-7 flex flex-col ${t.hot ? 'bg-[--ink] text-[--dark-text] border-[--ink] relative' : 'bg-white hairline'}`}>
              {t.hot && <span className="absolute -top-3 left-6 bg-[--red] text-white font-mono2 text-[10px] tracking-widest uppercase px-2 py-1">Popular</span>}
              <p className="eyebrow" style={t.hot ? { color: 'var(--dark-muted)' } : undefined}>{t.name}</p>
              <p className="mt-4 font-doto text-5xl">{yearly ? Math.round(t.chf * 0.83) : t.chf}<span className="text-lg align-top text-[--red]">CHF</span></p>
              <p className={`mt-2 text-sm ${t.hot ? 'text-[--dark-muted]' : 'text-[--ink-soft]'}`}>{t.tagline}</p>
              <p className="mt-3 font-mono2 text-[11px]" style={t.hot ? { color: 'var(--dark-muted)' } : { color: 'var(--ink-soft)' }}>up to {t.vcpu} vCPU / {t.ramGb} GB per environment</p>
              <ul className={`mt-5 space-y-2 text-sm flex-1 ${t.hot ? 'text-[--dark-muted]' : 'text-[--ink-soft]'}`}>
                {t.features.map((f) => <li key={f} className="flex gap-2"><span className="text-[--red]">—</span>{f}</li>)}
              </ul>
              <button onClick={() => go('auth')} className={`mt-6 py-2.5 text-sm font-medium transition-colors ${t.hot ? 'bg-white text-[--ink] hover:bg-[--red] hover:text-white' : 'btn-ink'}`}>
                Choose {t.name}
              </button>
            </div>
          ))}
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
                  ['Contract & support', 'Direct, human support — a real DPA', 'Enterprise sales'],
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

export function Compliance() {
  return (
    <main>
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Privacy & Legal</Eyebrow>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight max-w-[20ch] leading-[1.02]">Built for the question your <span className="font-doto">DPO</span> will ask.</h1>
          <p className="mt-6 text-lg text-[--ink-soft] max-w-[56ch]">
            Test data ends up containing real schemas — and sometimes real data — more often than
            planned. That's why our architecture is built so the privacy answer is short.
          </p>
        </div>
      </section>
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-16 grid gap-6 md:grid-cols-2">
          {[
            ['Switzerland as the location', 'Processing happens exclusively on our own hardware in Basel. Switzerland holds an EU adequacy decision — data transfers from the EU are permitted without additional safeguards. For Swiss customers, the Federal Act on Data Protection (FADP) applies directly.'],
            ['Ephemeral by design', 'Every test run gets a fresh microVM; storage is cryptographically wiped after the run. There is no backup of your test data, because there is no data left to back up. Retention period: 0 seconds.'],
            ['DPA & EU representative', 'Data Processing Agreement under Art. 28 GDPR available as a self-service download, a public register of the (few) sub-processors, an EU representative under Art. 27 named.'],
            ['Access & logging', 'No administrative access to running customer VMs. Access to the control plane is logged; your account\'s audit log belongs to you (Scale plan).'],
          ].map(([t, d]) => (
            <div key={t} className="border hairline bg-white p-7">
              <h3 className="font-semibold text-lg">{t}</h3>
              <p className="mt-2 text-sm text-[--ink-soft]">{d}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-16">
          <div className="bg-[--ink] text-[--dark-text] p-7 dotgrid-dark md:flex items-center justify-between gap-8">
            <div>
              <p className="font-semibold text-lg">Documents for your compliance team</p>
              <p className="text-sm text-[--dark-muted] mt-1">DPA incl. security-measures annex & sub-processor list (PDF) · more documents coming</p>
            </div>
            <button onClick={downloadDpa} className="mt-5 md:mt-0 bg-white text-[--ink] px-6 py-3 font-medium hover:bg-[--red] hover:text-white transition-colors shrink-0">Download the DPA (PDF)</button>
          </div>
        </div>
      </section>
    </main>
  );
}
