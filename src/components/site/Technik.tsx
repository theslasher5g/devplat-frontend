import { useState } from 'react';
import GithubComparisonSection from './GithubComparisonSection';
import { Eyebrow, type Page } from './Shared';

const snippets: Record<string, string> = {
  'GitHub Actions': `# .github/workflows/ci.yml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devplat/connect@v1        # ← the one line
        with:
          token: \${{ secrets.DEVPLAT_TOKEN }}
      - run: mvn verify                   # unchanged`,
  'GitLab CI': `# .gitlab-ci.yml
integration-tests:
  image: eclipse-temurin:21
  before_script:
    - curl -sf https://get.devplat.dev | sh
    - devplat connect --token $DEVPLAT_TOKEN
  script:
    - mvn verify`,
  'Local (CLI)': `# once
$ brew install devplat   # or: curl -sf https://get.devplat.dev | sh
$ devplat login

# per session
$ devplat connect
✓ Tunnel active → CH-BSL-1 (RTT 8 ms)
✓ DOCKER_HOST=tcp://127.0.0.1:52731

$ mvn verify            # or gradle, pytest, go test …`,
  'testcontainers.properties': `# ~/.testcontainers.properties
# Alternative without DOCKER_HOST — native to Testcontainers
docker.host=tcp://127.0.0.1:52731
docker.tls.verify=1
docker.cert.path=/Users/you/.devplat/certs`,
};

function Layer({ n, title, sub, items, dark }: { n: string; title: string; sub: string; items: string[]; dark?: boolean }) {
  return (
    <div className={`border hairline p-7 ${dark ? 'bg-[--ink] text-[--dark-text] dotgrid-dark' : 'bg-white'}`}>
      <div className="flex items-baseline justify-between">
        <p className="font-doto text-3xl text-[--red]">{n}</p>
        <p className={`eyebrow ${dark ? '' : ''}`} style={dark ? { color: 'var(--dark-muted)' } : undefined}>{sub}</p>
      </div>
      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <ul className={`mt-3 space-y-1.5 text-sm ${dark ? 'text-[--dark-muted]' : 'text-[--ink-soft]'}`}>
        {items.map((i) => <li key={i} className="flex gap-2"><span className="text-[--red]">—</span>{i}</li>)}
      </ul>
    </div>
  );
}

export default function Technik({ go }: { go: (p: Page) => void }) {
  const tabs = Object.keys(snippets);
  const [tab, setTab] = useState(tabs[0]);
  return (
    <main>
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Architecture</Eyebrow>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] max-w-[22ch]">
            One tunnel, one scheduler, one <span className="font-doto">microVM</span> per test run.
          </h1>
          <p className="mt-6 text-lg text-[--ink-soft] max-w-[58ch]">
            Docker talks to the daemon through an API — and the endpoint is configurable. That's
            exactly where devplat steps in: we redirect the endpoint securely, everything else
            stays standard Docker.
          </p>
        </div>
      </section>

      {/* 3 LAYERS */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-6 lg:grid-cols-3">
            <Layer n="1" sub="at your side" title="Client — a static Go binary"
              items={['Authenticates with an API token', 'Builds an mTLS tunnel to the control plane', 'Exposes a local Docker socket', 'Sets DOCKER_HOST — that\'s it']} />
            <Layer n="2" sub="orchestration" title="Control plane — auth, scheduling, metering"
              items={['Accounts, teams, tokens, quotas', 'Scheduler assigns the tunnel to a microVM', 'Enforces parallelism limits per plan', 'Event-based metering for the dashboard']} />
            <Layer n="3" sub="Basel" title="Data plane — Firecracker microVMs" dark
              items={['One VM per test run, a real Docker daemon inside', '~150 ms boot, snapshots for top images', 'KVM isolation instead of container tricks', 'After the run: VM & storage destroyed']} />
          </div>
          {/* flow: vertical stepper — every step visible, nothing to scroll */}
          <div className="mt-10 border hairline bg-white p-6 md:p-10">
            <p className="eyebrow mb-8">Data flow of a test run</p>
            <ol className="max-w-3xl">
              {[
                ['your test code', 'mvn verify, gradle test, pytest — Testcontainers starts exactly as before. The Docker API calls leave through a local socket the CLI provides.', 'mTLS tunnel to Basel'],
                ['devplat CLI', 'Authenticates with your API token and forwards the Docker API through a mutually authenticated TLS tunnel to the control plane.', ''],
                ['scheduler', 'Checks your plan’s parallelism limit and assigns the run to a free microVM. If everything is busy, the run queues briefly instead of failing.', ''],
                ['microVM · dockerd', 'A dedicated Firecracker VM with a real Docker daemon inside — isolated from every other customer by a KVM boundary, not by namespaces.', ''],
                ['postgres · redis · kafka', 'Your containers start from the warm image cache, typically in under a second. Ports are mapped back through the tunnel transparently.', 'run finishes — here after 1:38'],
              ].map(([title, desc, edge], i) => (
                <li key={title} className="relative pl-12 pb-8 last:pb-0">
                  <span className="absolute left-0 top-0 w-8 h-8 grid place-items-center border hairline bg-white font-doto text-sm">{i + 1}</span>
                  <span className="absolute left-4 top-8 bottom-0 border-l hairline" aria-hidden />
                  <p className="font-mono2 text-sm text-[--ink] pt-1.5">{title}</p>
                  <p className="mt-1.5 text-sm text-[--ink-soft] max-w-[58ch]">{desc}</p>
                  {edge && <p className="mt-3 font-mono2 text-[11px] text-[--red]">↓ {edge}</p>}
                </li>
              ))}
              <li className="relative pl-12">
                <span className="absolute left-0 top-0 w-8 h-8 grid place-items-center border border-[--red] text-[--red] font-doto text-sm">✕</span>
                <p className="font-mono2 text-sm text-[--red] pt-1.5">destroyed</p>
                <p className="mt-1.5 text-sm text-[--ink-soft] max-w-[58ch]">
                  The microVM and its storage are wiped the moment the run ends. Nothing persists, nothing is reused.
                </p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* IMAGE CACHE */}
      <section className="border-b hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>The image cache</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight max-w-[32ch]">Why your tests start faster with us than they do locally.</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3 text-sm text-[--ink-soft]">
            <li className="flex gap-4"><span className="font-doto text-xl text-[--red] shrink-0">a</span>
              A pull-through registry proxy pulls every image from the internet exactly once. After that we serve it over the local network in under a second — Docker Hub pull limits never touch you.</li>
            <li className="flex gap-4"><span className="font-doto text-xl text-[--red] shrink-0">b</span>
              For the 8 most common images (Postgres, MariaDB, Redis, Kafka, RabbitMQ, Elasticsearch, Mongo, LocalStack) we keep Firecracker snapshots with the image already loaded: resume in milliseconds.</li>
            <li className="flex gap-4"><span className="font-doto text-xl text-[--red] shrink-0">c</span>
              Team and Scale customers can add their own images (e.g. fixture databases) to the cache.</li>
          </ol>
        </div>
      </section>

      {/* SECURITY MODEL — full width, technical depth for readers who actually
          audit this before they let CI push code through it. */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Security model</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-[28ch]">Foreign code starts containers on our hardware. Here's exactly what stops that being a problem.</h2>
          <p className="mt-6 text-lg text-[--ink-soft] max-w-[68ch]">
            Every test run executes attacker-adjacent code by definition — it's whatever your
            dependencies pull in. The security model isn't a policy document; it's the specific
            mechanism enforcing each boundary below.
          </p>

          <div className="mt-12 grid gap-px bg-[--line] border hairline md:grid-cols-2 lg:grid-cols-3">
            {[
              ['Compute isolation', 'A real KVM boundary, not namespaces', 'Each environment is its own Firecracker microVM with a dedicated guest kernel — not a container sharing the host kernel. No customer VM ever shares a Docker daemon, a cgroup tree, or a kernel with another. A container escape only reaches the guest kernel, which is disposable and unprivileged relative to the host.'],
              ['Network isolation', 'One private /30 per VM, nothing routes in uninvited', 'Every VM gets its own tap device and a point-to-point /30 subnet. iptables DNAT maps one host port to that VM\'s Docker daemon — but only traffic sourced from the control-plane\'s WireGuard subnet is accepted; a FORWARD rule drops any other unsolicited inbound packet to the VM outright, and this is enforced at the host firewall, not inside the guest.'],
              ['Resource isolation', 'cgroups v2 caps CPU and RAM per VM', 'Firecracker\'s own vCPU/memory limits plus a host-level cgroup wrap each VM at exactly your plan\'s per-environment cap (e.g. 4 vCPU / 8 GB on Team) — enforced by the scheduler at VM-creation time, not a soft default one workload could exceed by accident or on purpose.'],
              ['Egress control', 'Bandwidth-capped, no free ride for abuse', 'Outbound traffic is rate-limited per tap device via a kernel token-bucket filter (tc). It stops a compromised environment from becoming a useful DDoS or exfiltration node even before any egress allowlist is added — a hard cap that applies regardless of what\'s running inside.'],
              ['Transport encryption', 'Control plane ↔ agent only over WireGuard', 'The scheduler never talks to a data-plane host over the public internet. Every VM-lifecycle call (create/destroy/health) crosses an authenticated, encrypted WireGuard tunnel; each host agent\'s HTTP API is bound exclusively to its WireGuard address — it has no public listener to attack in the first place.'],
              ['Lifecycle enforcement', 'A hard, server-side TTL — not a client promise', 'Testcontainers\' own Ryuk cleanup runs client-side and can fail to fire (crashed process, killed CI job, network partition). A reaper on the host independently destroys any VM past its TTL regardless of what the client did or didn\'t do — the backstop doesn\'t trust the client.'],
            ].map(([tag, t, d]) => (
              <div key={t} className="bg-white p-7">
                <p className="eyebrow mb-2">{tag}</p>
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-[--ink-soft]">{d}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="border hairline bg-white p-7">
              <Eyebrow>Storage</Eyebrow>
              <h3 className="font-semibold">Ephemeral by construction, not by policy</h3>
              <p className="mt-2 text-sm text-[--ink-soft]">
                Each VM boots from a private copy of the golden rootfs image — never a shared,
                mutable disk. Overlay storage is deleted with the VM on destroy; there is no snapshot,
                no backup, no "recently deleted" window. If it's gone, it's actually gone, which is
                also why there's nothing durable for an attacker to steal.
              </p>
            </div>
            <div className="border hairline bg-white p-7">
              <Eyebrow>Roadmap</Eyebrow>
              <h3 className="font-semibold">What's next: jailer-based sandboxing</h3>
              <p className="mt-2 text-sm text-[--ink-soft]">
                Today the KVM boundary is the isolation layer, which is already a materially stronger
                guarantee than container-based CI isolation. Firecracker's jailer (chroot + seccomp +
                cgroup hardening around the VMM process itself) is the next layer we're adding, for
                defense in depth beyond the hypervisor boundary.
              </p>
            </div>
          </div>
        </div>
      </section>

      <GithubComparisonSection />

      {/* INTEGRATION SNIPPETS */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Integration</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-[26ch]">Four ways in. All under a minute.</h2>
          <div className="mt-8 border hairline bg-[--ink]">
            <div className="flex flex-wrap border-b border-[--dark-line]">
              {tabs.map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`font-mono2 text-xs px-4 py-3 transition-colors ${tab === t ? 'bg-[--dark-card] text-white' : 'text-[--dark-muted] hover:text-white'}`}>
                  {t}
                </button>
              ))}
            </div>
            <pre className="p-5 font-mono2 text-[12.5px] leading-relaxed text-[--dark-text] overflow-x-auto">{snippets[tab]}</pre>
          </div>
          <p className="mt-4 text-sm text-[--ink-soft]">Works with anything that speaks Docker: Testcontainers (Java, Go, .NET, Node, Python, Rust), Docker SDKs, docker compose.</p>
        </div>
      </section>

      <section className="bg-[--ink] text-[--dark-text]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:flex items-center justify-between gap-8">
          <p className="text-2xl font-semibold max-w-[30ch]">Enough theory. Point your next test run at Basel.</p>
          <div className="mt-6 md:mt-0 flex gap-3 shrink-0">
            <button onClick={() => go('download')} className="bg-white text-[--ink] px-6 py-3 font-medium hover:bg-[--red] hover:text-white transition-colors">Install the CLI</button>
            <button onClick={() => go('auth')} className="border border-[--dark-line] px-6 py-3 hover:border-white transition-colors">Create an account</button>
          </div>
        </div>
      </section>
    </main>
  );
}
