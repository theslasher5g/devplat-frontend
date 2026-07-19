/** Marketing-site content: the animated hero terminal and the pricing tiers. */

export const liveLog = [
  { t: '00:00.000', s: 'sys', m: 'tunnel established → devplat CH-BSL-1 (RTT 8 ms)' },
  { t: '00:00.142', s: 'sys', m: 'microVM vm_c8e2 assigned · booting dockerd' },
  { t: '00:02.010', s: 'ok', m: 'Docker API ready at tcp://127.0.0.1:52731' },
  { t: '00:02.180', s: 'img', m: 'postgres:16 → served from local registry cache' },
  { t: '00:02.640', s: 'ok', m: 'Container postgres:16 started' },
  { t: '00:02.900', s: 'img', m: 'redis:7 → served from local registry cache' },
  { t: '00:03.120', s: 'ok', m: 'Container redis:7 started' },
  { t: '00:03.180', s: 'img', m: 'kafka:3.7 → served from local registry cache' },
  { t: '00:04.760', s: 'ok', m: 'Container kafka:3.7 started · cluster ready' },
  { t: '00:04.900', s: 'test', m: 'PaymentServiceIT › running 48 tests …' },
  { t: '01:38.412', s: 'test', m: '48 tests passed, 0 failed, 0 skipped' },
  { t: '01:38.590', s: 'sys', m: 'Reaper: microVM vm_c8e2 destroyed · storage wiped · nothing persisted' },
];

// Mirrors the backend `plans` table (devplat-backend/migrations/003_plans.sql).
// Each tier caps BOTH how many environments run in parallel AND how large each
// one may get (vcpu/ramGb) — the resource cap is what keeps a single microVM
// from pulling unbounded CPU/RAM.
export const tiers = [
  {
    name: 'Solo', chf: 19, envs: 2, vcpu: 2, ramGb: 4, tagline: 'For solo developers and side projects.',
    features: ['2 parallel environments', 'up to 2 vCPU / 4 GB per environment', 'Shared image cache', 'CLI + CI', 'Community support'],
  },
  {
    name: 'Team', chf: 79, envs: 5, vcpu: 4, ramGb: 8, tagline: 'For teams with an active CI pipeline.', hot: true,
    features: ['5 parallel environments', 'up to 4 vCPU / 8 GB per environment', 'Custom images in the cache', 'Team management & roles', 'DPA included', 'Email support < 24 h'],
  },
  {
    name: 'Scale', chf: 249, envs: 8, vcpu: 6, ramGb: 12, tagline: 'For multiple teams and monorepos.',
    features: ['8 parallel environments', 'up to 6 vCPU / 12 GB per environment', 'Priority scheduling', 'Audit log', 'SSO (SAML) — coming soon', 'Latency SLA 99.5 %', 'Support < 4 h'],
  },
];
