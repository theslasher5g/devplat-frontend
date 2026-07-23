import { Eyebrow, type Page, Reveal } from './Shared';

const boundaries: [string, string, string][] = [
  ['Compute isolation', 'A real KVM boundary, not namespaces', 'Each environment is its own Firecracker microVM with a dedicated guest kernel — not a container sharing the host kernel. No customer VM ever shares a Docker daemon, a cgroup tree, or a kernel with another. A container escape only reaches the guest kernel, which is disposable and unprivileged relative to the host.'],
  ['Network isolation', 'One private /30 per VM, nothing routes in uninvited', 'Every VM gets its own tap device and a point-to-point /30 subnet. iptables DNAT maps one host port to that VM\'s Docker daemon — but only traffic sourced from the control-plane\'s WireGuard subnet is accepted; a FORWARD rule drops any other unsolicited inbound packet to the VM outright, and this is enforced at the host firewall, not inside the guest.'],
  ['Resource isolation', 'cgroups v2 caps CPU and RAM per VM', 'Firecracker\'s own vCPU/memory limits plus a host-level cgroup wrap each VM at exactly your plan\'s per-environment cap (e.g. 4 vCPU / 8 GB on Team) — enforced by the scheduler at VM-creation time, not a soft default one workload could exceed by accident or on purpose.'],
  ['Egress control', 'Bandwidth-capped, no free ride for abuse', 'Outbound traffic is rate-limited per tap device via a kernel token-bucket filter (tc). It stops a compromised environment from becoming a useful DDoS or exfiltration node even before any egress allowlist is added — a hard cap that applies regardless of what\'s running inside.'],
  ['Transport encryption', 'Control plane ↔ agent only over WireGuard', 'The scheduler never talks to a data-plane host over the public internet. Every VM-lifecycle call (create/destroy/health) crosses an authenticated, encrypted WireGuard tunnel; each host agent\'s HTTP API is bound exclusively to its WireGuard address — it has no public listener to attack in the first place.'],
  ['Lifecycle enforcement', 'A hard, server-side TTL — not a client promise', 'Testcontainers\' own Ryuk cleanup runs client-side and can fail to fire (crashed process, killed CI job, network partition). A reaper on the host independently destroys any VM past its TTL regardless of what the client did or didn\'t do — the backstop doesn\'t trust the client.'],
];

export default function Security({ go }: { go: (p: Page) => void }) {
  return (
    <main>
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="eyebrow eyebrow-dot mb-4 rise rise-1">Security model</p>
          <h1 className="rise rise-2 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-[26ch]">
            Foreign code starts containers on our hardware. Here's exactly what stops that being a problem.
          </h1>
          <p className="rise rise-3 mt-6 text-base sm:text-lg text-[--ink-soft] max-w-[68ch]">
            Every test run executes attacker-adjacent code by definition — it's whatever your
            dependencies pull in. The security model isn't a policy document; it's the specific
            mechanism enforcing each boundary below.
          </p>
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="grid gap-px bg-[--line] border hairline sm:grid-cols-2 lg:grid-cols-3">
            {boundaries.map(([tag, t, d], i) => (
              <Reveal key={t} delay={(i % 3) * 90} className="bg-white p-6 sm:p-7 accent-top">
                <p className="eyebrow mb-2">{tag}</p>
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-[--ink-soft]">{d}</p>
              </Reveal>
            ))}
          </div>

          <div className="mt-8 sm:mt-10 grid gap-6 lg:grid-cols-2">
            <Reveal className="border hairline bg-white p-6 sm:p-7 lift accent-top">
              <Eyebrow>Storage</Eyebrow>
              <h3 className="font-semibold">Ephemeral by construction, not by policy</h3>
              <p className="mt-2 text-sm text-[--ink-soft]">
                Each VM boots from a private copy of the golden rootfs image — never a shared,
                mutable disk. Overlay storage is deleted with the VM on destroy; there is no snapshot,
                no backup, no "recently deleted" window. If it's gone, it's actually gone, which is
                also why there's nothing durable for an attacker to steal.
              </p>
            </Reveal>
            <Reveal delay={90} className="border hairline bg-white p-6 sm:p-7 lift accent-top">
              <Eyebrow>Roadmap</Eyebrow>
              <h3 className="font-semibold">What's next: jailer-based sandboxing</h3>
              <p className="mt-2 text-sm text-[--ink-soft]">
                Today the KVM boundary is the isolation layer, which is already a materially stronger
                guarantee than container-based CI isolation. Firecracker's jailer (chroot + seccomp +
                cgroup hardening around the VMM process itself) is the next layer we're adding, for
                defense in depth beyond the hypervisor boundary.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-[--ink] text-[--dark-text]">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16 md:flex items-center justify-between gap-8">
          <p className="text-xl sm:text-2xl font-semibold max-w-[30ch]">Enough theory. Point your next test run at Basel.</p>
          <div className="mt-6 md:mt-0 flex flex-wrap gap-3 shrink-0">
            <button onClick={() => go('download')} className="bg-white text-[--ink] px-6 py-3 font-medium hover:bg-[--red] hover:text-white transition-colors">Install the CLI</button>
            <button onClick={() => go('auth')} className="border border-[--dark-line] px-6 py-3 hover:border-white transition-colors">Create an account</button>
          </div>
        </div>
      </section>
    </main>
  );
}
