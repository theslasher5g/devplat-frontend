import { Eyebrow, type Page, Stat, TerminalDemo } from './Shared';

export default function Home({ go }: { go: (p: Page) => void }) {
  return (
    <main>
      {/* HERO */}
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28 grid gap-14 lg:grid-cols-[1.05fr_1fr] items-center">
          <div>
            <p className="eyebrow eyebrow-dot rise rise-1">Remote backend for Testcontainers · Hosted in Zurich</p>
            <h1 className="rise rise-2 mt-5 text-5xl md:text-7xl font-semibold leading-[0.98] tracking-tight">
              Your tests.<br />
              <span className="font-doto">Our</span> containers.
            </h1>
            <p className="rise rise-3 mt-6 text-lg text-[--ink-soft] max-w-[46ch]">
              Integration tests still run where they always did — laptop or CI. Only the throwaway
              containers (Postgres, Redis, Kafka …) run on our infrastructure. No Docker daemon to
              manage, no Docker Desktop subscription, no overage surprises.
            </p>
            <div className="rise rise-4 mt-8 flex flex-wrap gap-3">
              <button onClick={() => go('auth')} className="btn-ink px-6 py-3">Try it free — no credit card</button>
              <button onClick={() => go('technik')} className="btn-ghost px-6 py-3">How it works</button>
            </div>
            <p className="rise rise-4 mt-6 font-mono2 text-xs text-[--ink-soft]">
              $ devplat connect && mvn verify <span className="text-[--red]">←</span> that's the whole integration.
            </p>
          </div>
          <div className="rise rise-3"><TerminalDemo /></div>
        </div>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-20 grid gap-12 md:grid-cols-2">
          <div>
            <Eyebrow>The problem</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">CI runners are too small.<br />Docker bills are too unclear.</h2>
          </div>
          <ul className="space-y-5 text-[--ink-soft] md:pt-12">
            {[
              ['Slow pipelines', 'Every CI run pulls the same images again. A postgres:16 pull costs 20–30 seconds — per job, per day, per team.'],
              ['Resource limits', 'GitHub runners with 2 vCPU / 7 GB collapse the moment Kafka, Elasticsearch, and your app all need to run at once.'],
              ['Opaque costs', 'Per-minute billing with overages turns your invoice into a guessing game. With us: a flat rate by parallelism. Full stop.'],
              ['US-cloud lock-in', 'Test data ends up containing real schemas more often than planned. Compliance teams ask questions — we have answers, from Zurich.'],
            ].map(([t, d]) => (
              <li key={t} className="border-l-2 border-[--ink] pl-5">
                <p className="font-medium text-[--ink]">{t}</p>
                <p className="text-sm mt-1">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* BENTO */}
      <section className="border-b hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Why devplat</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-[24ch]">Three decisions that make everything else simple.</h2>
          <div className="mt-12 grid gap-px bg-[--line] border hairline md:grid-cols-3 md:grid-rows-2">
            <div className="bg-white p-8 md:col-span-2">
              <p className="font-doto text-4xl text-[--red]">01</p>
              <h3 className="mt-3 text-xl font-semibold">Zero code changes</h3>
              <p className="mt-2 text-sm text-[--ink-soft] max-w-[52ch]">
                Testcontainers and every Docker SDK talk to the daemon through a configurable
                endpoint. Our CLI redirects it — your test code stays character-for-character
                identical.
              </p>
              <pre className="mt-4 font-mono2 text-xs bg-[--ink] text-[--dark-text] p-4 overflow-x-auto">{`# before: docker runs locally
$ mvn verify

# after: docker runs in Zurich
$ devplat connect
$ mvn verify   # unchanged.`}</pre>
            </div>
            <div className="bg-white p-8">
              <p className="font-doto text-4xl text-[--red]">02</p>
              <h3 className="mt-3 text-xl font-semibold">Faster than local</h3>
              <p className="mt-2 text-sm text-[--ink-soft]">
                Top images sit ready as pre-warmed Firecracker snapshots. A Postgres starts in
                under a second with us — your laptop needs that time just for the first coffee.
              </p>
            </div>
            <div className="bg-white p-8">
              <p className="font-doto text-4xl text-[--red]">03</p>
              <h3 className="mt-3 text-xl font-semibold">Radically isolated</h3>
              <p className="mt-2 text-sm text-[--ink-soft]">
                One microVM per test run, a real KVM boundary — no shared daemons, no namespace
                tricks. Everything is destroyed after the run. Always.
              </p>
            </div>
            <div className="bg-[--ink] text-[--dark-text] p-8 md:col-span-2 dotgrid-dark">
              <p className="eyebrow" style={{ color: 'var(--dark-muted)' }}>Flat, not metered</p>
              <h3 className="mt-3 text-xl font-semibold">You pay for parallelism, not minutes.</h3>
              <p className="mt-2 text-sm text-[--dark-muted] max-w-[52ch]">
                Plans from CHF 29 to CHF 199 a month, sized by concurrent environments — never by
                minutes. Your invoice in January looks the same as in December, no matter how often
                your team pushes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-20 grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <Stat value="0.8" unit="s" label="Container start from a warm snapshot" />
          <Stat value="8" unit="ms" label="RTT from German & Swiss data centers" />
          <Stat value="100" unit="%" label="ephemeral — nothing outlives the test run" />
          <Stat value="1" unit="×" label="line in your GitHub Actions workflow file" />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[--ink] text-[--dark-text] dotgrid-dark">
        <div className="mx-auto max-w-6xl px-5 py-24 text-left md:flex items-end justify-between gap-10">
          <div>
            <p className="font-doto text-5xl md:text-7xl leading-none">Ready<span className="text-[--red]">●</span></p>
            <p className="mt-4 text-[--dark-muted] max-w-[40ch]">Your first test run goes through devplat in five minutes. Free tier: 1 parallel environment, forever.</p>
          </div>
          <div className="mt-8 md:mt-0 flex gap-3 shrink-0">
            <button onClick={() => go('auth')} className="bg-white text-[--ink] px-6 py-3 font-medium hover:bg-[--red] hover:text-white transition-colors">Create an account</button>
            <button onClick={() => go('preise')} className="border border-[--dark-line] px-6 py-3 hover:border-white transition-colors">See pricing</button>
          </div>
        </div>
      </section>
    </main>
  );
}
