import { Eyebrow } from './Shared';

const compareRows: [string, string, string, string][] = [
  ['Available on Free/Pro plan?', 'No — Team/Enterprise only', 'Yes', 'Yes'],
  ['Who runs the infrastructure?', 'GitHub', 'You', 'Us, managed'],
  ['What gets scaled up?', 'The entire machine', 'The entire machine (self-built)', 'Just the containers, targeted'],
  ['Isolation between test runs?', 'Yes, GitHub-managed', 'No — you build it yourself', 'Yes — its own microVM per run'],
  ['Image cache / faster starts?', 'No', 'You build it yourself', 'Built in'],
  ['Data location', 'US', 'Wherever you host it', 'Switzerland'],
  ['Billing', 'Always full per-minute rates', 'You carry all the fixed costs', 'Flat, by parallelism'],
];

const trustCards: [string, string][] = [
  ['Transparency, not a black box', 'This entire page walks through exactly how devplat works technically — which data flows where, how isolation between customers works, what happens if a server goes down. It\'s documented this openly on purpose: trust in a smaller provider has to come from being able to verify it, not from brand recognition.'],
  ['Nothing sticks around', 'Every test environment is fully destroyed once its lifetime ends — no persistent customer data anywhere on our infrastructure. That\'s not a marketing line, it\'s a direct consequence of the architecture: there\'s simply nothing lasting left to compromise.'],
  ['Swiss law, Swiss jurisdiction', 'A real contract with a DPA, a person you can actually reach, data processing exclusively in Switzerland — no US CLOUD Act, regardless of where a hyperscaler physically places its data center.'],
  ['Built because we had this problem ourselves', 'Not a feature on some corporation\'s roadmap that can lose priority any time — a product that solves exactly one problem, and is judged on whether it does that well.'],
];

const RECOMMENDED = (
  <span className="absolute -top-3 left-5 bg-[--red] text-white font-mono2 text-[10px] tracking-widest uppercase px-2 py-1">Recommended</span>
);

export default function GithubComparisonSection() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <Eyebrow>The obvious objection</Eyebrow>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-[24ch]">Isn't GitHub enough on its own?</h2>
        <p className="mt-6 text-lg text-[--ink-soft] max-w-[68ch]">
          Short answer: devplat doesn't replace your GitHub runner. The runner that executes your
          pipeline — even the free standard one — stays exactly as it is. devplat operates one
          level deeper: only when your test code asks Testcontainers for a container does that one
          specific request get redirected. Still, GitHub itself offers two ways to deal with heavy
          integration tests — and both have a blind spot worth knowing before you pick one.
        </p>

        {/* COMPARISON */}
        <div className="mt-16">
          <Eyebrow>Comparison</Eyebrow>
          <h3 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[24ch]">Three ways, one problem.</h3>

          {/* desktop / tablet: table */}
          <div className="hidden sm:block mt-10 border hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b hairline font-mono2 text-xs uppercase tracking-wider text-[--ink-soft]">
                  <th className="text-left p-4 font-medium"> </th>
                  <th className="text-left p-4 font-medium">Larger Runners</th>
                  <th className="text-left p-4 font-medium">Self-hosted Runners</th>
                  <th className="relative text-left p-4 font-medium bg-[--ink] text-[--dark-text]">
                    {RECOMMENDED}
                    devplat<span className="text-[--red]">●</span>
                  </th>
                </tr>
              </thead>
              <tbody className="text-[--ink-soft]">
                {compareRows.map(([label, larger, selfHosted, devplat]) => (
                  <tr key={label} className="border-b hairline last:border-0">
                    <td className="p-4 font-medium text-[--ink]">{label}</td>
                    <td className="p-4">{larger}</td>
                    <td className="p-4">{selfHosted}</td>
                    <td className="p-4 bg-[--ink] text-[--dark-text] font-medium">{devplat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile: one card per column, stacked — a horizontal-scroll table doesn't read well this narrow */}
          <div className="sm:hidden mt-8 grid gap-4">
            {[
              { name: 'Larger Runners', values: compareRows.map((r) => r[1]) },
              { name: 'Self-hosted Runners', values: compareRows.map((r) => r[2]) },
              { name: 'devplat', values: compareRows.map((r) => r[3]), hot: true },
            ].map((col) => (
              <div key={col.name} className={`relative border p-6 ${col.hot ? 'bg-[--ink] text-[--dark-text] border-[--ink]' : 'bg-white hairline'}`}>
                {col.hot && RECOMMENDED}
                <p className="font-semibold">{col.name}{col.hot && <span className="text-[--red]">●</span>}</p>
                <dl className="mt-4 space-y-3 text-sm">
                  {compareRows.map(([label], i) => (
                    <div key={label} className={`flex justify-between gap-4 pt-3 border-t first:border-t-0 first:pt-0 ${col.hot ? 'border-[--dark-line]' : 'hairline'}`}>
                      <dt className={col.hot ? 'text-[--dark-muted]' : 'text-[--ink-soft]'}>{label}</dt>
                      <dd className="text-right font-medium shrink-0 max-w-[52%]">{col.values[i]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-[--ink-soft] max-w-[70ch]">
            Larger runners mean buying one oversized machine for the whole pipeline duration —
            checkout, build, linting included — even though only the integration-test portion
            actually needs the power. Self-hosted runners mean building yourself exactly what
            devplat already offers, finished, managed, and cleanly isolated between customers.
            devplat is the productized middle ground: more targeted than the one, without the
            operational overhead of the other.
          </p>
        </div>

        {/* TRUST */}
        <div className="mt-20">
          <Eyebrow>Trust</Eyebrow>
          <h3 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[28ch]">Why a smaller provider instead of a hyperscaler?</h3>
          <div className="mt-8 grid gap-px bg-[--line] border hairline sm:grid-cols-2">
            {trustCards.map(([t, d], i) => (
              <div key={t} className="bg-white p-7">
                <p className="font-doto text-3xl text-[--red]">{String(i + 1).padStart(2, '0')}</p>
                <h4 className="mt-2 font-semibold">{t}</h4>
                <p className="mt-2 text-sm text-[--ink-soft]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
