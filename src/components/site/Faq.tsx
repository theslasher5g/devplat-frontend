import { Eyebrow, type Page } from './Shared';

// Community channel. Point this at your real repo before launch — it's the
// only external link on this page.
const COMMUNITY = {
  github: 'https://github.com/devplat/devplat/discussions',
};

type QA = { q: string; a: React.ReactNode };
type Group = { title: string; blurb: string; items: QA[] };

const groups: Group[] = [
  {
    title: 'Getting started',
    blurb: 'The basics, in one place.',
    items: [
      {
        q: 'Do I have to change my test code?',
        a: 'No. devplat sets DOCKER_HOST to a local endpoint the CLI provides, and Testcontainers, the Docker SDKs and docker compose all read that automatically. Your mvn verify, gradle test, pytest or go test runs exactly as before — it just talks to a remote daemon instead of a local one.',
      },
      {
        q: 'Which languages and frameworks work?',
        a: 'Anything that speaks the Docker API: Testcontainers for Java, Go, .NET, Node, Python and Rust, the official Docker SDKs, and docker compose. If it works against a local Docker daemon, it works against devplat.',
      },
      {
        q: 'How do I use it in CI?',
        a: 'One line. Install the CLI, then wrap your test command: devplat connect --exec "mvn verify". Authenticate with a scoped CI token stored as a secret. There are copy-paste snippets for GitHub Actions, GitLab CI, CircleCI, Jenkins and Bitbucket on the How-it-works page.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes — 14 days, no card required. You get the full product; when the trial ends you pick a plan or your team pauses.',
      },
    ],
  },
  {
    title: 'How it works',
    blurb: 'What actually happens on a run.',
    items: [
      {
        q: 'How is this different from Docker Desktop or local Docker?',
        a: 'Your machine runs no daemon at all — no Docker Desktop, no dockerd, no VM eating your RAM. Each test run gets a dedicated Firecracker microVM in our Basel data centre with a real Docker daemon inside, reached over an encrypted tunnel. You get a clean, isolated environment every time instead of whatever state your laptop accumulated.',
      },
      {
        q: 'How fast is a run available?',
        a: 'A microVM is usually ready in a few seconds. Base images are served from a warm cache on the local network rather than pulled from the internet each run, so the containers your tests need start fast.',
      },
      {
        q: 'What happens when I hit my parallelism limit?',
        a: 'The run queues briefly and starts as soon as a slot frees up, rather than failing. Your plan sets how many environments can run at once — that’s the only thing you’re capped on, not minutes or builds.',
      },
      {
        q: 'What happens to published ports?',
        a: 'Ports your containers publish are bridged back to localhost on your machine, at the same address Testcontainers resolves them to. So getMappedPort() and localhost:PORT work exactly as they would locally.',
      },
      {
        q: 'What if a host goes down mid-run?',
        a: 'The run fails cleanly and the scheduler stops placing work on that host — it won’t hang. Re-running places you on a healthy host. Hosts are health-checked continuously and drained gracefully for maintenance.',
      },
    ],
  },
  {
    title: 'Security & data',
    blurb: 'The boundary is the product.',
    items: [
      {
        q: 'Can other customers see my containers?',
        a: 'No. Every run is a separate Firecracker microVM isolated by a KVM boundary — a hypervisor, not shared-kernel container tricks. The VM and its storage are wiped the moment the run ends. Nothing persists and nothing is reused across teams.',
      },
      {
        q: 'When my container makes an outbound request, whose IP is used?',
        a: 'The devplat host’s public IP in Basel — not yours, and not your CI runner’s. Container traffic originates inside the microVM and is NAT’d out through our host, so your IP is never the source. Outbound abuse controls (bandwidth caps, egress limits) are therefore ours to enforce.',
      },
      {
        q: 'Where is my data processed?',
        a: 'Exclusively on our own hardware in Basel, Switzerland — no third-party cloud in the data path. See the Security page for the full isolation and networking model.',
      },
      {
        q: 'How do I revoke access?',
        a: 'API tokens are scoped and revocable from the dashboard at any time; a CI token never grants dashboard access. Revoking is instant.',
      },
    ],
  },
  {
    title: 'Billing & support',
    blurb: 'Flat pricing, honest support.',
    items: [
      {
        q: 'Do you bill per minute or per build?',
        a: 'Neither. You pay a base price for the team plus a price per developer, and that is the whole bill. No per-minute meter, no overage bills, no surprises at the end of the month. When you hit your parallelism limit the next run queues rather than costing extra.',
      },
      {
        q: 'What support do I get?',
        a: 'During the 14-day evaluation: this FAQ, the docs, and GitHub Discussions, where the team is active. On Team, email support with a response inside 24 hours. On Enterprise, a named contact rather than a queue.',
      },
      {
        q: 'Can I change plans or cancel anytime?',
        a: 'Yes. Upgrade, downgrade or cancel from the dashboard; changes take effect immediately and billing is prorated by Stripe.',
      },
    ],
  },
];

export default function Faq({ go }: { go: (p: Page) => void }) {
  return (
    <main>
      {/* HERO */}
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Community & FAQ</Eyebrow>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] max-w-[22ch]">
            Questions, answered. And a <span className="font-doto">community</span> when they aren’t.
          </h1>
          <p className="mt-6 text-lg text-[--ink-soft] max-w-[58ch]">
            Most of what people ask before signing up is right here. If your question isn’t —
            the team and other developers are a message away.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={COMMUNITY.github} target="_blank" rel="noreferrer" className="btn-ink px-6 py-3">Ask on GitHub Discussions</a>
            <button onClick={() => go('docs')} className="btn-ghost px-6 py-3">Read the docs</button>
          </div>
        </div>
      </section>

      {/* FAQ GROUPS */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-16 grid gap-12">
          {groups.map((g) => (
            <div key={g.title} className="grid gap-6 lg:grid-cols-[280px_1fr] items-start">
              <div className="lg:sticky lg:top-24">
                <Eyebrow>{g.title}</Eyebrow>
                <p className="mt-2 text-sm text-[--ink-soft] max-w-[28ch]">{g.blurb}</p>
              </div>
              <div className="border hairline bg-white divide-y divide-[--line]">
                {g.items.map((item) => (
                  <details key={item.q} className="group">
                    <summary className="flex items-start justify-between gap-4 cursor-pointer list-none px-5 py-4 hover:bg-[--paper]/60">
                      <span className="font-medium text-[--ink] pr-2">{item.q}</span>
                      <span className="mt-0.5 shrink-0 text-[--red] font-doto text-lg transition-transform group-open:rotate-45" aria-hidden>+</span>
                    </summary>
                    <p className="px-5 pb-5 -mt-1 text-sm text-[--ink-soft] max-w-[70ch]">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* GET HELP */}
      <section className="border-b hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>Still stuck?</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight max-w-[24ch]">Pick the channel that fits.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'GitHub Discussions', d: 'Ask the team and other developers, share feature ideas, and search answers others already got.', href: COMMUNITY.github, ext: true },
              { t: 'Documentation', d: 'Install, connect, CI setup and troubleshooting.', page: 'docs' as Page },
              { t: 'Status page', d: 'Live component status and incident history.', href: '/status', ext: false },
              { t: 'Email us', d: 'Account or billing questions that don’t belong in public.', href: 'mailto:hello@devplat.ch', ext: true },
            ].map((c) => (
              <div key={c.t} className="border hairline p-6 lift accent-top flex flex-col">
                <h3 className="font-semibold">{c.t}</h3>
                <p className="mt-2 text-sm text-[--ink-soft] flex-1">{c.d}</p>
                {c.page
                  ? <button onClick={() => go(c.page!)} className="mt-4 font-mono2 text-xs text-[--red] hover:underline text-left">Open →</button>
                  : <a href={c.href} target={c.ext ? '_blank' : undefined} rel={c.ext ? 'noreferrer' : undefined} className="mt-4 font-mono2 text-xs text-[--red] hover:underline">Open →</a>}
              </div>
            ))}
          </div>
          <p className="mt-6 font-mono2 text-xs text-[--ink-soft]">
            Team includes email support with a response inside 24 hours; Enterprise adds a named contact.
          </p>
        </div>
      </section>
    </main>
  );
}
