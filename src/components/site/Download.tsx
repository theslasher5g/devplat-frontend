import { useState } from 'react';
import { Eyebrow, type Page } from './Shared';

const CLI_VERSION = 'v0.4.2';

// Linux and Windows only for now — both amd64. macOS and arm64 builds are a
// later addition (same release pipeline, just more targets), not listed
// here yet so this page never links to something that doesn't exist.
const installs: Record<string, { intro: string; code: string }> = {
  'Linux': {
    intro: 'One static binary, no dependencies. Same script works unchanged on CI runners — pass --token or set DEVPLAT_TOKEN.',
    code: `$ curl -fsSL https://get.devplat.ch | sh

# prefer to inspect first? Same thing, two steps:
$ curl -fsSLO https://get.devplat.ch/install.sh
$ less install.sh && sh install.sh`,
  },
  'Windows': {
    intro: 'Via PowerShell. Installs to your user profile and adds it to PATH — no admin rights needed.',
    code: `> irm https://get.devplat.ch/install.ps1 | iex`,
  },
};

const binaries: [string, string][] = [
  ['Linux · amd64', `devplat-${CLI_VERSION}-linux-amd64.tar.gz`],
  ['Windows · amd64', `devplat-${CLI_VERSION}-windows-amd64.zip`],
];

export default function Download({ go }: { go: (p: Page) => void }) {
  const tabs = Object.keys(installs);
  const [tab, setTab] = useState(tabs[0]);
  return (
    <main>
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Download</Eyebrow>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] max-w-[22ch]">
            One binary between your tests and <span className="font-doto">Basel</span>.
          </h1>
          <p className="mt-6 text-lg text-[--ink-soft] max-w-[56ch]">
            The devplat CLI is a single static Go binary: no runtime, no Docker Desktop, no
            configuration files. It authenticates, opens the mTLS tunnel, and sets{' '}
            <span className="font-mono2 text-[15px]">DOCKER_HOST</span> — then gets out of the way.
          </p>
          <p className="mt-6 font-mono2 text-xs text-[--ink-soft]">
            Current release: {CLI_VERSION} · Apache-2.0 licensed client · ~9 MB
          </p>
        </div>
      </section>

      {/* INSTALL */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>Install</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-[26ch]">Pick your platform.</h2>
          <div className="mt-8 border hairline bg-[--ink]">
            <div className="flex flex-wrap border-b border-[--dark-line]">
              {tabs.map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`font-mono2 text-xs px-4 py-3 transition-colors ${tab === t ? 'bg-[--dark-card] text-white' : 'text-[--dark-muted] hover:text-white'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="p-5">
              <p className="text-sm text-[--dark-muted] max-w-[64ch]">{installs[tab].intro}</p>
              <pre className="mt-4 font-mono2 text-[12.5px] leading-relaxed text-[--dark-text] overflow-x-auto">{installs[tab].code}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* QUICKSTART */}
      <section className="border-b hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 grid gap-14 lg:grid-cols-2">
          <div className="min-w-0">
            <Eyebrow>First run</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight">Three commands to your first remote test run.</h2>
            <ol className="mt-6 space-y-5 text-sm text-[--ink-soft]">
              {[
                ['curl -fsSL https://get.devplat.ch | sh', 'One-time install. Puts the devplat binary on your PATH.'],
                ['devplat login', 'Browser sign-in — stores a token so later runs need no --token. Opens a tunnelled session with DOCKER_HOST set; type your commands in it. (Already have a token? devplat connect --token $DEVPLAT_TOKEN works too.)'],
                ['mvn verify', 'Or gradle test, pytest, go test — run it in the session, unchanged. Testcontainers finds the Docker API and never notices the difference. In CI, one line: devplat connect --exec "mvn verify".'],
              ].map(([cmd, desc], i) => (
                <li key={cmd} className="flex gap-4">
                  <span className="font-doto text-xl text-[--red] shrink-0">{i + 1}</span>
                  <div>
                    <p className="font-mono2 text-[--ink]">$ {cmd}</p>
                    <p className="mt-1">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="min-w-0">
            <Eyebrow>Verify the download</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight">Checksums for every release.</h2>
            <p className="mt-4 text-sm text-[--ink-soft] max-w-[56ch]">
              Every release ships with a SHA-256 checksum file. The install script verifies it
              automatically; if you download a binary directly, compare it yourself:
            </p>
            <pre className="mt-4 font-mono2 text-xs bg-[--ink] text-[--dark-text] p-4 overflow-x-auto">{`$ curl -sfO https://get.devplat.ch/${CLI_VERSION}/checksums.txt
$ sha256sum -c checksums.txt --ignore-missing
devplat-${CLI_VERSION}-linux-amd64.tar.gz: OK`}</pre>
            <div className="mt-6 border hairline">
              {binaries.map(([platform, file]) => (
                <div key={file} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b hairline last:border-b-0 text-sm">
                  <span className="text-[--ink]">{platform}</span>
                  <a className="font-mono2 text-xs text-[--ink-soft] hover:text-[--red]" href={`https://get.devplat.ch/${CLI_VERSION}/${file}`}>
                    {file} ↓
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* REQUIREMENTS */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>Good to know</Eyebrow>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ['No local Docker needed', 'The CLI replaces the local daemon entirely. Your machine or CI runner needs neither Docker Desktop nor dockerd — just the ability to open an outbound TLS connection on port 443.'],
              ['Works with your stack', 'Anything that speaks the Docker API works: Testcontainers in Java, Go, .NET, Node, Python and Rust, the Docker SDKs, and docker compose.'],
              ['Tokens, not passwords', 'CI authenticates with scoped API tokens (ci:run) you create in the dashboard and can revoke at any time. The token never grants dashboard access.'],
            ].map(([t, d]) => (
              <div key={t} className="border hairline bg-white p-6">
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-[--ink-soft]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[--ink] text-[--dark-text]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:flex items-center justify-between gap-8">
          <p className="text-2xl font-semibold max-w-[30ch]">Installed? Sign in and connect.</p>
          <div className="mt-6 md:mt-0 flex gap-3 shrink-0">
            <button onClick={() => go('auth')} className="bg-white text-[--ink] px-6 py-3 font-medium hover:bg-[--red] hover:text-white transition-colors">Create an account</button>
            <button onClick={() => go('technik')} className="border border-[--dark-line] px-6 py-3 hover:border-white transition-colors">How it works</button>
          </div>
        </div>
      </section>
    </main>
  );
}
