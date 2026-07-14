export type RunStatus = 'running' | 'passed' | 'failed' | 'queued';

export interface TestRun {
  id: string;
  repo: string;
  branch: string;
  commit: string;
  trigger: 'GitHub Actions' | 'GitLab CI' | 'Local (CLI)';
  status: RunStatus;
  containers: string[];
  duration: string;
  started: string;
  region: string;
}

export const runs: TestRun[] = [
  { id: 'run_9f2a1c', repo: 'acme/payment-service', branch: 'feat/sepa-batch', commit: 'a41f9e2', trigger: 'GitHub Actions', status: 'running', containers: ['postgres:16', 'redis:7', 'kafka:3.7'], duration: '1:42', started: '2 min ago', region: 'CH-ZRH-1' },
  { id: 'run_8e11b0', repo: 'acme/payment-service', branch: 'main', commit: 'c02d871', trigger: 'GitHub Actions', status: 'passed', containers: ['postgres:16', 'redis:7'], duration: '2:18', started: '24 min ago', region: 'CH-ZRH-1' },
  { id: 'run_7d90aa', repo: 'acme/identity-api', branch: 'main', commit: 'f19ce04', trigger: 'GitLab CI', status: 'passed', containers: ['mariadb:11.4', 'localstack:3'], duration: '3:05', started: '1 hr ago', region: 'CH-ZRH-1' },
  { id: 'run_6c74f2', repo: 'acme/checkout-web', branch: 'fix/cart-race', commit: '77b3d10', trigger: 'Local (CLI)', status: 'failed', containers: ['postgres:16', 'elasticsearch:8.13'], duration: '4:51', started: '2 hrs ago', region: 'CH-ZRH-1' },
  { id: 'run_5b39e8', repo: 'acme/identity-api', branch: 'chore/deps', commit: '90aa4c7', trigger: 'GitHub Actions', status: 'passed', containers: ['mariadb:11.4'], duration: '1:12', started: '3 hrs ago', region: 'CH-ZRH-1' },
  { id: 'run_4a02d1', repo: 'acme/payment-service', branch: 'main', commit: 'b338f01', trigger: 'GitHub Actions', status: 'passed', containers: ['postgres:16', 'redis:7', 'kafka:3.7'], duration: '2:31', started: 'yesterday', region: 'CH-ZRH-1' },
];

export const liveLog = [
  { t: '00:00.000', s: 'sys', m: 'mTLS tunnel established → devplat CH-ZRH-1 (RTT 8 ms)' },
  { t: '00:00.142', s: 'sys', m: 'microVM vm_c8e2 assigned · Firecracker snapshot restored' },
  { t: '00:00.310', s: 'ok', m: 'Docker API ready at tcp://127.0.0.1:52731' },
  { t: '00:00.412', s: 'img', m: 'postgres:16 → cache hit (local, 0.3 s instead of 24 s)' },
  { t: '00:00.780', s: 'ok', m: 'Container postgres:16 started · port 5432 mapped' },
  { t: '00:01.010', s: 'img', m: 'redis:7 → cache hit (local)' },
  { t: '00:01.220', s: 'ok', m: 'Container redis:7 started' },
  { t: '00:01.245', s: 'img', m: 'kafka:3.7 → cache hit (local)' },
  { t: '00:02.960', s: 'ok', m: 'Container kafka:3.7 started · cluster ready' },
  { t: '00:03.100', s: 'test', m: 'PaymentServiceIT › running 48 tests …' },
  { t: '01:38.412', s: 'test', m: '48 tests passed, 0 failed, 0 skipped' },
  { t: '01:38.590', s: 'sys', m: 'Reaper: microVM vm_c8e2 destroyed · storage wiped · nothing persisted' },
];

export interface CachedImage { name: string; tag: string; size: string; hits: number; warm: boolean; snapshot: boolean; }
export const imageCache: CachedImage[] = [
  { name: 'postgres', tag: '16', size: '431 MB', hits: 1284, warm: true, snapshot: true },
  { name: 'postgres', tag: '15', size: '412 MB', hits: 356, warm: true, snapshot: true },
  { name: 'mariadb', tag: '11.4', size: '398 MB', hits: 611, warm: true, snapshot: true },
  { name: 'redis', tag: '7', size: '117 MB', hits: 972, warm: true, snapshot: true },
  { name: 'kafka', tag: '3.7', size: '702 MB', hits: 445, warm: true, snapshot: true },
  { name: 'rabbitmq', tag: '3.13', size: '253 MB', hits: 187, warm: true, snapshot: false },
  { name: 'elasticsearch', tag: '8.13', size: '1.2 GB', hits: 141, warm: true, snapshot: false },
  { name: 'mongo', tag: '7', size: '756 MB', hits: 93, warm: true, snapshot: false },
  { name: 'localstack', tag: '3', size: '1.1 GB', hits: 208, warm: true, snapshot: false },
  { name: 'acme/fixtures-db', tag: 'v42', size: '2.3 GB', hits: 57, warm: false, snapshot: false },
];

export interface ApiToken { id: string; label: string; prefix: string; scope: string; lastUsed: string; created: string; }
export const tokens: ApiToken[] = [
  { id: 'tok_1', label: 'GitHub Actions · payment-service', prefix: 'dvp_ci_7f2a…', scope: 'ci:run', lastUsed: '2 min ago', created: '12 Mar 2026' },
  { id: 'tok_2', label: 'GitLab CI · identity-api', prefix: 'dvp_ci_b81c…', scope: 'ci:run', lastUsed: '1 hr ago', created: '2 Apr 2026' },
  { id: 'tok_3', label: 'Laptop · sandro', prefix: 'dvp_dev_e04d…', scope: 'dev:run', lastUsed: '2 hrs ago', created: '18 May 2026' },
];

export const usageWeek = [
  { day: 'Mon', mins: 212 }, { day: 'Tue', mins: 348 }, { day: 'Wed', mins: 297 },
  { day: 'Thu', mins: 401 }, { day: 'Fri', mins: 366 }, { day: 'Sat', mins: 58 }, { day: 'Sun', mins: 24 },
];

export const parallelToday = [1, 2, 2, 3, 4, 5, 5, 4, 5, 3, 4, 5, 5, 5, 4, 3, 2, 3, 2, 1, 1, 2, 1, 1];

export interface Member { name: string; mail: string; role: 'Owner' | 'Admin' | 'Developer'; }
export const team: Member[] = [
  { name: 'Sandro K.', mail: 'sandro@acme.dev', role: 'Owner' },
  { name: 'Mira L.', mail: 'mira@acme.dev', role: 'Admin' },
  { name: 'Jonas F.', mail: 'jonas@acme.dev', role: 'Developer' },
  { name: 'Aylin T.', mail: 'aylin@acme.dev', role: 'Developer' },
];

export const invoices = [
  { nr: 'INV-2026-0612', date: '1 Jul 2026', amount: 'CHF 79.00', status: 'Paid' },
  { nr: 'INV-2026-0508', date: '1 Jun 2026', amount: 'CHF 79.00', status: 'Paid' },
  { nr: 'INV-2026-0417', date: '1 May 2026', amount: 'CHF 29.00', status: 'Paid' },
];

export const auditLog = [
  { when: 'Today, 14:02', who: 'sandro@acme.dev', what: 'Used token dvp_ci_7f2a… (run_9f2a1c)' },
  { when: 'Today, 11:47', who: 'mira@acme.dev', what: 'Acknowledged parallelism-limit warning' },
  { when: 'Yesterday, 17:20', who: 'jonas@acme.dev', what: 'Added custom image acme/fixtures-db:v42 to the cache' },
  { when: 'Yesterday, 09:12', who: 'sandro@acme.dev', what: 'Invited member aylin@acme.dev (Developer)' },
];

export const tiers = [
  {
    name: 'Solo', chf: 29, envs: 2, tagline: 'For solo developers and side projects.',
    features: ['2 parallel environments', '4 vCPU / 8 GB per environment', 'All standard images pre-warmed', 'CLI + GitHub Actions', 'Community support'],
  },
  {
    name: 'Team', chf: 79, envs: 5, tagline: 'For teams with an active CI pipeline.', hot: true,
    features: ['5 parallel environments', '8 vCPU / 16 GB per environment', 'Custom images in the cache', 'Team management & roles', 'DPA included', 'Email support < 24 h'],
  },
  {
    name: 'Scale', chf: 199, envs: 15, tagline: 'For multiple teams and monorepos.',
    features: ['15 parallel environments', '8 vCPU / 16 GB per environment', 'Priority scheduling', 'Audit log & SSO (SAML)', 'Latency SLA 99.5 %', 'Support < 4 h'],
  },
];
