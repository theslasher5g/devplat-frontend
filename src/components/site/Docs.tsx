import { useEffect, useState } from 'react';
import { useCliVersion } from '@/lib/useCliVersion';
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
  { id: 'tokens', title: 'API tokens' },
  { id: 'account', title: 'Account security' },
  { id: 'teams', title: 'Teams' },
  { id: 'limits', title: 'Plans & limits' },
  { id: 'webhooks', title: 'Webhooks' },
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
  const version = useCliVersion();

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
  ● devplat ${version} · env 6aea97af
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

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Inside the session</p>
            <p className="text-sm text-[--ink-soft]">
              The session is a real shell with a live view around it: a container panel showing what's
              running and each container's mirrored <span className="font-mono2 text-[13px]">localhost:PORT</span>,
              the environment's resources and TTL, and platform status. A few keys:
            </p>
            <div className="border hairline mt-3 text-sm">
              {[
                ['↑ / ↓', 'Walk your command history (per project).'],
                ['Tab', 'Autocomplete from history, saved commands, and common test commands.'],
                ['⇧ Tab', 'Move focus between the input and the container panel.'],
                ['^l', 'Live-follow a selected container’s logs (like docker logs -f).'],
                ['^y', 'Copy a container’s mirrored localhost port.'],
                ['^r / ^s', 'Open the command picker · star the current command.'],
                ['exit', 'Leave and release the environment (Ctrl+C/Ctrl+D also work).'],
              ].map(([k, d]) => (
                <div key={k} className="flex gap-4 px-4 py-2 border-b hairline last:border-b-0">
                  <span className="font-mono2 text-[13px] text-[--ink] min-w-[5rem]">{k}</span>
                  <span className="text-[--ink-soft]">{d}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-[--ink-soft] mt-3">
              One caveat: a <span className="font-mono2 text-[13px]">docker-compose</span> host bind
              mount (<span className="font-mono2 text-[13px]">./data:/x</span>) points at the remote
              VM, not your machine — the session warns you once if it spots one. Use named volumes or
              copy fixtures in instead.
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
                ['devplat login', 'Sign in so later commands need no token. With no flags it opens a browser sign-in and saves the token to your user config dir; --token stores one you created in the dashboard. Flags: --token, --api-url.'],
                ['devplat logout', 'Revoke the stored token server-side and remove it from this machine.'],
                ['devplat connect', 'Request a microVM, open the tunnel, set DOCKER_HOST, and drop into an interactive session. With --exec "CMD" it runs headless for CI: your command inherits DOCKER_HOST, its exit code becomes devplat’s, and the environment is released afterwards. Flags: --token, --api-url, --exec.'],
                ['devplat doctor', 'Read-only self-check: CLI version and available updates, which token is in use and where it came from, whether the control plane is reachable, and whether that token is accepted. Creates nothing — run this first when something stops working.'],
                ['devplat upgrade', 'Update to the latest published release via the official installer (prints the command on Windows).'],
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

          {/* API TOKENS */}
          <section className="space-y-3">
            <H id="tokens" kicker="Credentials">API tokens</H>
            <p className="text-[--ink-soft]">
              Tokens authorize test runs — never dashboard access. Create them under{' '}
              <button onClick={() => go('app')} className="link-underline text-[--ink] font-medium">Tokens</button>{' '}
              in the dashboard. The plaintext is shown exactly once, on creation; we store
              only a hash, so a lost token is replaced, not recovered.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Expiry</p>
            <p className="text-sm text-[--ink-soft]">
              A token can be given an expiry when you create it. After that date it stops
              working and the CLI says so by name rather than failing as a generic auth
              error. A CI token that outlives the person who created it is the usual way
              credentials leak, so setting one — 90 or 180 days — is worth the calendar
              reminder. Tokens created without an expiry keep working until revoked.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">IP allowlists</p>
            <p className="text-sm text-[--ink-soft]">
              A token can be restricted to one or more IP ranges, given as addresses or
              CIDR blocks (<span className="font-mono2 text-[13px]">203.0.113.4</span>,{' '}
              <span className="font-mono2 text-[13px]">10.0.0.0/8</span>,{' '}
              <span className="font-mono2 text-[13px]">2001:db8::/32</span>). A bare address
              is stored as a single host. Requests from anywhere else are rejected even
              with the correct token, which turns a stolen CI secret into a dead one.
            </p>
            <p className="text-sm text-[--ink-soft]">
              The catch worth knowing before you enable it: hosted CI runners egress from
              large, changing ranges, so an allowlist built from your laptop's address will
              lock the pipeline out. Use it for self-hosted runners and fixed office or VPN
              egress; leave it empty otherwise.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Rotating without downtime</p>
            <p className="text-sm text-[--ink-soft]">
              Create the replacement first, update the CI secret, confirm a green run, then
              revoke the old one. Both are valid in between — there's no limit that forces
              you to delete before you create.
            </p>
          </section>

          {/* ACCOUNT SECURITY */}
          <section className="space-y-3">
            <H id="account" kicker="Your account">Account security</H>
            <p className="text-[--ink-soft]">
              Everything here lives under{' '}
              <button onClick={() => go('app')} className="link-underline text-[--ink] font-medium">Profile</button>{' '}
              in the dashboard — the avatar in the top right.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Two-factor authentication</p>
            <p className="text-sm text-[--ink-soft]">
              Standard TOTP, so any authenticator works — Google Authenticator, 1Password,
              Bitwarden, Aegis. Setup shows a QR code (and the key in text, if you'd rather
              type it) plus ten single-use recovery codes. Save those somewhere that isn't
              the phone running the authenticator; they're the way back in if you lose the
              device, and we can't regenerate them for you without them.
            </p>
            <p className="text-sm text-[--ink-soft]">
              Codes are accepted within 30 seconds either side of your clock, and each one
              works once — a code someone reads over your shoulder is already spent.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Passwords</p>
            <p className="text-sm text-[--ink-soft]">
              At least 12 characters, with an uppercase letter, a lowercase letter, a number
              and a special character. We also check the password against Have I Been Pwned's
              breach corpus and refuse ones that appear in it. That check uses the
              k-anonymity range API: only the first five characters of the password's SHA-1
              hash are sent, so neither we nor HIBP learn the password.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Sessions and devices</p>
            <p className="text-sm text-[--ink-soft]">
              The profile lists every active session with its browser, IP address, when it
              started and when it was last used. Sign out any one of them, or all of them at
              once — useful the moment you notice one you don't recognise. Changing
              your password or disabling 2FA signs out every other session automatically.
              You'll also get an email the first time your account signs in from an
              unrecognised device, and when a token is created, 2FA is turned off, or team
              ownership moves.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Export and deletion</p>
            <p className="text-sm text-[--ink-soft]">
              <span className="font-medium text-[--ink]">Export</span> downloads everything
              we hold about your account and its teams as JSON (GDPR Art. 15/20) — secrets
              like token hashes are excluded by design.{' '}
              <span className="font-medium text-[--ink]">Delete account</span> is permanent
              and immediate. If you own a team that still has other members, transfer
              ownership or delete the team first — we won't orphan other people's work. A
              team where you're the only member is deleted along with your account.
            </p>
          </section>

          {/* TEAMS */}
          <section className="space-y-3">
            <H id="teams" kicker="Working together">Teams</H>
            <p className="text-[--ink-soft]">
              Environments, tokens, billing and the audit trail belong to a team, not to
              you. One account can belong to several — a client's team and your own, say —
              and the switcher in the dashboard header decides which one your CLI runs
              against.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Roles</p>
            <div className="border hairline mt-3 text-sm">
              {[
                ['Owner', 'Everything an admin can do, plus the three things nobody else can: transfer ownership, delete the team, and set the team-wide 2FA requirement. Exactly one per team.'],
                ['Admin', 'Invite and remove members, manage API tokens, handle billing, and read and export the audit log.'],
                ['Developer', 'Run environments. Cannot change the team, its members, its tokens or its billing.'],
              ].map(([r, d]) => (
                <div key={r} className="flex gap-4 px-4 py-2 border-b hairline last:border-b-0">
                  <span className="text-[--ink] font-medium min-w-[5.5rem]">{r}</span>
                  <span className="text-[--ink-soft]">{d}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Seats</p>
            <p className="text-sm text-[--ink-soft]">
              Every plan includes a number of seats, and pending invitations count against
              it — so a batch of invites can't quietly push the team over its plan once
              they're all accepted. If you're at the limit, remove someone unused or upgrade.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Leaving and handing over</p>
            <p className="text-sm text-[--ink-soft]">
              Any member can leave a team from the dashboard. An owner has to transfer
              ownership to another member first — a team without an owner has nobody who
              can pay for it or delete it.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Requiring 2FA for everyone</p>
            <p className="text-sm text-[--ink-soft]">
              An owner can require two-factor for the whole team. Members who haven't
              enrolled keep access to their own profile — so they can set it up — but can't
              touch team resources until they have, and the CLI tells them exactly that.
              Turn it on after telling people, not before.
            </p>

            <p className="text-sm text-[--ink-soft] font-medium mt-6">Audit log</p>
            <p className="text-sm text-[--ink-soft]">
              Admins and owners see a log of who did what: tokens created and revoked,
              members added and removed, renames, plan changes, ownership transfers. Filter
              by date range, action or actor, and export the filtered view as CSV for a
              spreadsheet or JSON for tooling.
            </p>
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
              need a paid plan to start environments. The trial is <span className="text-[--ink] font-medium">once
              per account</span>, not per team, and running <span className="text-[--ink] font-medium">more than
              one team</span> is a paid feature — on the free tier you can be invited to other teams
              and switch between them freely, but you can't create a second one of your own. Paid plans
              and their exact caps are on the{' '}
              <button onClick={() => go('preise')} className="link-underline text-[--ink] font-medium">pricing page</button>.
            </p>
          </section>

          {/* WEBHOOKS */}
          <section className="space-y-3">
            <H id="webhooks" kicker="Integrations">Webhooks</H>
            <p className="text-[--ink-soft]">
              Push environment events to your own tooling instead of polling. Add an endpoint under{' '}
              <span className="text-[--ink] font-medium">Settings → Webhooks</span> in the dashboard;
              you get a signing secret once, at creation.
            </p>
            <div className="mt-4 space-y-3">
              {[
                ['environment.assigned', 'A microVM booted and its Docker endpoint is ready.'],
                ['environment.released', 'An environment was torn down — by you, or by its lifetime expiring.'],
                ['environment.failed', 'A run could not get an environment after every retry. This is the one worth alerting on.'],
                ['environment.queued_at_limit', 'A run is waiting because all your parallel environments are busy. Fires once per run, not once per retry.'],
              ].map(([ev, what]) => (
                <div key={ev} className="border-l-2 border-[--ink] pl-4">
                  <p className="font-mono2 text-[13px] text-[--ink]">{ev}</p>
                  <p className="mt-1 text-sm text-[--ink-soft]">{what}</p>
                </div>
              ))}
            </div>
            <p className="text-[--ink-soft] pt-2">
              Every POST carries a <span className="font-mono2 text-[--ink]">devplat-signature</span>{' '}
              header of the form <span className="font-mono2 text-[--ink]">t=&lt;unix&gt;,v1=&lt;hex&gt;</span>.
              Verify it before trusting the body — the URL alone is not a secret. Sign the string{' '}
              <span className="font-mono2 text-[--ink]">"&lt;t&gt;.&lt;raw body&gt;"</span> with HMAC-SHA256
              and your endpoint secret, compare in constant time, and reject anything whose{' '}
              <span className="font-mono2 text-[--ink]">t</span> is more than a few minutes old — that
              timestamp check is what stops a captured delivery being replayed at you later.
            </p>
            <Code>{`import crypto from 'node:crypto';

function verify(rawBody, header, secret, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=', 2)));
  const t = Number(parts.t);
  if (!Number.isFinite(t)) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false; // replay
  const expected = crypto.createHmac('sha256', secret)
    .update(\`\${t}.\${rawBody}\`).digest('hex');
  const got = Buffer.from(parts.v1 ?? '', 'utf8');
  const want = Buffer.from(expected, 'utf8');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}`}</Code>
            <p className="text-sm text-[--ink-soft]">
              Use the <span className="font-mono2 text-[--ink]">raw</span> request body, not a
              re-serialised object — re-encoding JSON changes the bytes and the signature will not
              match. Deliveries are retried six times over about nine hours with growing gaps;
              answer <span className="font-mono2 text-[--ink]">2xx</span> to acknowledge. Redirects
              are not followed. An endpoint that fails ten events in a row is switched off
              automatically, and the reason is shown in the dashboard next to it. Every attempt,
              including the response your server sent back, is in the delivery log there. Retries
              mean an event can arrive more than once — deduplicate on the payload's{' '}
              <span className="font-mono2 text-[--ink]">id</span>.
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
                ['“your API token has expired”', 'The token was created with an expiry date and has passed it. Create a new one under Tokens, then run devplat login --token <new-token>. Nothing else about the account has changed.'],
                ['“this API token is restricted to certain IP ranges”', 'The token has an IP allowlist and the address this request came from isn’t in it. CI runners usually egress from a different range than your machine — check the token’s allowlist in the dashboard, or use a token without one for hosted runners.'],
                ['“your team requires two-factor authentication”', 'An owner turned on team-wide 2FA and this account hasn’t enrolled. Set it up under Profile in the dashboard; you can still reach your own profile while locked out of team resources.'],
                ['“your team has no seats left”', 'The plan’s seat count is used up — remember pending invitations count too. Remove an unused member or a stale invite, or upgrade the plan.'],
                ['A token that worked yesterday stopped working', 'Run devplat doctor. It reports which token is in use and where it came from, whether the control plane is reachable, and whether the token is accepted — which separates “revoked/expired” from “wrong token picked up from the environment” in one command.'],
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
