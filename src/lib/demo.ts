/** Marketing-site content: the animated hero terminal and the pricing tiers. */

export const liveLog = [
  { t: '00:00.000', s: 'sys', m: 'mTLS tunnel established → devplat CH-BSL-1 (RTT 8 ms)' },
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
