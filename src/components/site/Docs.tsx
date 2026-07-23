import { useEffect, useState } from 'react';
import { Eyebrow, type Page } from './Shared';

// A single-page docs experience in the site's own design system (no separate
// design — that would fragment the brand and double the upkeep). A sticky
// left rail scroll-spies the sections on the right. Content is kept honest to
// what the CLI actually does today: browser or token auth (`devplat login`
// plus DEVPLAT_TOKEN/--token), Docker-API access plus per-container-port
// mirroring over the tunnel — features still on the roadmap are labelled,
// not implied.

interface Section {
  id: string;
  title: string;
}

const SECTIONS: Section[] = [
  { id: 'install', title: 'Install' },
  { id: 'authenticate', title: 'Authenticate' },
  { id: 'connect', title: 'Connect & run tests' },
  { id: 'ci', title: 'Use it in CI' },
  { id: 'cli-reference', title: 'CLI reference' },
  { id: 'limits', title: 'Plans & limits' },
  { id: 'troubleshooting', title: 'Troubleshooting' },
  { id: 'roadmap', title: 'Roadmap' },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-4 font-mono2 text-[12.5px] leading-relaxed bg-[--ink] text-[--dark-text] p-4 overflow-x-auto">
      {children}
    </pre>
  );
}

function H({ id, kicker, children }: { id: string; kicker: string; children: React.ReactNode }) {
  return (
    <div className="scroll-mt-24" id={id}>
      <p className="eyebrow eyebrow-dot mb-3">{kicker}</p>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{children}</h2>
    </div>
  );
}

export default function Docs({ go }: { go: (p: Page) => void }) {
  const [active, setActive] = useState(SECTIONS[0].id);

  // Scroll-spy: highlight the rail entry whose section is nearest the top of
  // the viewport. One observer over all section headings; the topmost
  // currently-intersecting one wins.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <main>
      {/* HEADER */}
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>Documentation</Eyebrow>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
            From zero to a remote test run.
          </h1>
          <p className="mt-5 text-lg text-[--ink-soft] max-w-[56ch]">
            Everything the CLI does today, honestly scoped. If it's on this page it works right
            now; anything still coming is marked{' '}
            <span className="chip-soon">Roadmap</span>.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 grid lg:grid-cols-[220px_1fr] gap-12 py-14">
        {/* SIDEBAR */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`block border-l-2 pl-3 py-1.5 text-sm transition-colors ${
                  active === s.id
                    ? 'border-[--red] text-[--ink] font-medium'
                    : 'border-[--line] text-[--ink-soft] hover:text-[--ink] hover:border-[--ink]'
                }`}
              >
                {s.title}
              </a>
            ))}
            <div className="pt-4 mt-4 border-t hairline">
              <button onClick={() => go('download')} className="link-underline text-sm text-[--ink-soft] hover:text-[--ink]">
                Download page →
              </button>
            </div>
          </nav>
        </aside>

        {/* BODY */}
        <div className="min-w-0 max-w-[68ch] space-y-16">
          {/* INSTALL */}
          <section className="space-y-3">
            <H id="install" kicker="Step 1">Install the CLI</H>
            <p className="text-[--ink-soft]">
              The devplat CLI is a single static Go binary — no runtime, no Docker Desktop, no
              config files. Linux and Windows are published today (both amd64); macOS and arm64
              are <span className="chip-soon">Roadmap</span>.
            </p>
            <p className="text-sm text-[--ink-soft] font-medium mt-4">Linux (and CI runners)</p>
            <Code>{`curl -fsSL https://get.devplat.ch | sh`}</Code>
            <p className="text-sm text-[--ink-soft] font-medium mt-4">Windows (PowerShell)</p>
            <Code>{`irm https://get.devplat.ch/install.ps1 | iex`}</Code>
            <p className="text-sm text-[--ink-soft]">
              The script detects your platform, downloads the current release, verifies its
              SHA-256 checksum, and puts <span className="font-mono2 text-[13px]">devplat</span> on
              your PATH. Prefer to read it first? Grab{' '}
              <span className="font-mono2 text-[13px]">https://get.devplat.ch/install.sh</span> and
              run it by hand.
            </p>
          </section>

          {/* AUTH */}
          <section className="space-y-3">
            <H id="authenticate" kicker="Step 2">Authenticate</H>
            <p className="text-[--ink-soft]">
              For local use, <span className="font-mono2 text-[13px]">devplat login</span> signs you
              in through the browser and stores a token for you — no token to copy by hand. It prints
              a code, you approve it in the dashboard, and every later{' '}
              <span className="font-mono2 text-[13px]">devplat connect</span> just works.
            </p>
            <Code>{`$ devplat login
  → open https://devplat.ch/activate and enter code: WXYZ-1234
  ✓ logged in — token saved`}</Code>
            <p className="text-sm text-[--ink-soft]">
              Already have a token, or logging in on a machine with no browser? Pass it directly —{' '}
              <span className="font-mono2 text-[13px]">devplat login --token dvp_…</span> stores it, or
              set <span className="font-mono2 text-[13px]">DEVPLAT_TOKEN</span> per run. Create tokens
              in the dashboard under{' '}
              <button onClick={() => go('app')} className="link-underline text-[--ink] font-medium">Tokens</button>.
              Any token authorizes test runs only — never dashboard access — and{' '}
              <span className="font-mono2 text-[13px]">devplat logout</span> revokes it.
            </p>
          </section>

          {/* CONNECT */}
          <section className="space-y-3">
            <H id="connect" kicker="Step 3">Connect, then run your tests</H>
            <p className="text-[--ink-soft]">
              <span className="font-mono2 text-[13px]">devplat connect</span> requests a fresh
              microVM, opens an encrypted tunnel to its Docker API, and drops you into an
              interactive session with <span className="font-mono2 text-[13px]">DOCKER_HOST</span>{' '}
              already set. Run your normal test command in that session — Testcontainers, the
              Docker SDKs and <span className="font-mono2 text-[13px]">docker compose</span> all just
              find the daemon.
            </p>
            <Code>{`$ devplat connect
  ● devplat v1.1.0 · env 6aea97af
  ✓ assigned · tunnel active

  DOCKER_HOST=tcp://127.0.0.1:52731

devplat ❯ mvn verify   # or gradle test, pytest, go test …`}</Code>
            <p className="text-sm text-[--ink-soft]">
              The environment is released when you leave the session, and a server-side TTL tears
              it down regardless — nothing outlives the run.
            </p>
            <p className="text-sm text-[--ink-soft]">
              Container <span className="font-mono2 text-[13px]">-p</span> published ports are
              mirrored onto the same port on <span className="font-mono2 text-[13px]">127.0.0.1</span>{' '}
              while you're connected, so Testcontainers' mapped-port access works unchanged. TCP
              only; a locally-taken port is skipped with a warning.
            </p>
          </section>

          {/* CI */}
          <section className="space-y-3">
            <H id="ci" kicker="Automation">Use it in CI</H>
            <p className="text-[--ink-soft]">
              Same binary, headless. Store your <span className="font-mono2 text-[13px]">ci:run</span>{' '}
              token as a secret and use <span className="font-mono2 text-[13px]">--exec</span>: it runs
              your test command with <span className="font-mono2 text-[13px]">DOCKER_HOST</span> set,
              exits with your command's exit code (so a failed test fails the job), and releases the
              environment when it's done.
            </p>
            <p className="text-sm text-[--ink-soft] font-medium mt-4">GitHub Actions</p>
            <Code>{`- name: Install devplat
  run: curl -fsSL https://get.devplat.ch | sh
- name: Run integration tests
  env:
    DEVPLAT_TOKEN: \${{ secrets.DEVPLAT_TOKEN }}
  run: devplat connect --exec "mvn verify"`}</Code>
            <p className="text-sm text-[--ink-soft] font-medium mt-4">GitLab CI</p>
            <Code>{`integration-tests:
  image: eclipse-temurin:21
  script:
    - curl -fsSL https://get.devplat.ch | sh
    - devplat connect --exec "mvn verify"`}</Code>
            <p className="text-sm text-[--ink-soft]">
              <span className="chip-soon">Roadmap</span>{' '}
              <span className="align-middle">
                A <span className="font-mono2 text-[13px]">devplat/connect</span> GitHub Action that
                wraps install + connect into one step.
              </span>
            </p>
          </section>

          {/* CLI REFERENCE */}
          <section className="space-y-3">
            <H id="cli-reference" kicker="Reference">CLI reference</H>
            <div className="mt-4 border hairline divide-y divide-[--line]">
              {[
                ['devplat connect', 'Request a microVM, open the tunnel, set DOCKER_HOST, and drop into an interactive session. Flags: --token, --api-url.'],
                ['devplat version', 'Print the CLI version.'],
                ['devplat help', 'Usage and flag summary.'],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="p-4">
                  <p className="font-mono2 text-[13px] text-[--ink]">{cmd}</p>
                  <p className="mt-1 text-sm text-[--ink-soft]">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-[--ink-soft] mt-4">Resolution order for both settings:</p>
            <div className="mt-2 border hairline divide-y divide-[--line] text-sm">
              <div className="p-3 flex flex-wrap gap-x-4 gap-y-1">
                <span className="font-mono2 text-[13px] text-[--ink] min-w-[7rem]">token</span>
                <span className="text-[--ink-soft]"><span className="font-mono2 text-[12px]">--token</span> flag, then <span className="font-mono2 text-[12px]">DEVPLAT_TOKEN</span></span>
              </div>
              <div className="p-3 flex flex-wrap gap-x-4 gap-y-1">
                <span className="font-mono2 text-[13px] text-[--ink] min-w-[7rem]">api-url</span>
                <span className="text-[--ink-soft]"><span className="font-mono2 text-[12px]">--api-url</span> flag, then <span className="font-mono2 text-[12px]">DEVPLAT_API_URL</span>, else <span className="font-mono2 text-[12px]">https://api.devplat.ch</span></span>
              </div>
            </div>
          </section>

          {/* LIMITS */}
          <section className="space-y-3">
            <H id="limits" kicker="Accounting">Plans & limits</H>
            <p className="text-[--ink-soft]">
              What you buy is <span className="text-[--ink] font-medium">parallelism</span>: how many
              environments your team can hold at once, each with a fixed CPU/RAM cap — never
              per-minute billing. Request an environment while you're at the limit and it queues
              until one frees up, rather than failing.
            </p>
            <p className="text-sm text-[--ink-soft]">
              The free tier is a 14-day trial with one parallel environment; after it lapses you'll
              need a paid plan to start environments. Paid plans and their exact caps are on the{' '}
              <button onClick={() => go('preise')} className="link-underline text-[--ink] font-medium">pricing page</button>.
            </p>
          </section>

          {/* TROUBLESHOOTING */}
          <section className="space-y-3">
            <H id="troubleshooting" kicker="When something's off">Troubleshooting</H>
            <div className="mt-4 space-y-5">
              {[
                ['“no API token — pass --token or set DEVPLAT_TOKEN”', 'The CLI found no token. Export DEVPLAT_TOKEN or pass --token. Create one in the dashboard under Tokens (scope ci:run).'],
                ['Stuck on “queued, waiting for capacity…”', 'Your team is at its parallelism limit — an existing environment must be released (or the run finished) before this one is assigned. Check the dashboard, or upgrade the plan for more concurrent environments.'],
                ['Testcontainers can’t reach a published container port', 'The CLI mirrors every published TCP port of a running container onto the same port on 127.0.0.1 while devplat connect is active. If a connection fails: check the port isn’t already taken locally (the CLI prints a warning if so), and make sure you’re on a current CLI build — port mirroring shipped with the dynamic port tunnel and older binaries only tunnel the Docker API itself. UDP ports aren’t mirrored.'],
                ['“environment never became ready”', 'The VM was assigned but its Docker daemon didn’t answer in time. Usually transient — retry devplat connect. If it persists, the platform status is shown per-region in the footer.'],
              ].map(([q, a]) => (
                <div key={q} className="border-l-2 border-[--ink] pl-4">
                  <p className="font-mono2 text-[13px] text-[--ink]">{q}</p>
                  <p className="mt-1.5 text-sm text-[--ink-soft]">{a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ROADMAP */}
          <section className="space-y-3">
            <H id="roadmap" kicker="Being honest">On the roadmap</H>
            <p className="text-[--ink-soft]">
              Things the site mentions that aren't shipped yet. Listed here so the docs never
              imply more than the product does today.
            </p>
            <ul className="mt-4 space-y-3">
              {[
                ['Pre-warmed snapshots', 'Sub-second container starts from Firecracker snapshots, rather than a cold daemon boot each run.'],
                ['macOS & arm64 builds', 'Native binaries beyond today’s Linux/Windows amd64.'],
                ['GitHub Action', 'A devplat/connect action wrapping install + connect into one CI step.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="chip-soon shrink-0 self-start mt-0.5">Soon</span>
                  <span className="text-sm">
                    <span className="text-[--ink] font-medium">{t}.</span>{' '}
                    <span className="text-[--ink-soft]">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* FOOTER CTA */}
          <div className="border-t hairline pt-8 flex flex-wrap gap-3">
            <button onClick={() => go('auth')} className="btn-ink px-6 py-3">Create an account</button>
            <button onClick={() => go('download')} className="btn-ghost px-6 py-3">Download the CLI</button>
          </div>
        </div>
      </div>
    </main>
  );
}
