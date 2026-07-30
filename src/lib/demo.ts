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
//
// Only what the cards render lives here. The per-plan feature lists moved into
// the comparison table further down the pricing page: as bullets they were
// different lengths per card, so nothing lined up across the row, and the
// same facts were being maintained in two places that could disagree.
//
// Solo is 1 parallel environment, matching migration 038. What separates it
// from Free is that it doesn't expire and doubles the per-environment size —
// not the number of environments.
export const tiers = [
  {
    name: 'Solo', chf: 19, envs: 1, vcpu: 2, ramGb: 4,
    tagline: 'Solo developers and side projects.',
  },
  {
    name: 'Team', chf: 79, envs: 5, vcpu: 4, ramGb: 8, hot: true,
    tagline: 'Teams with an active CI pipeline.',
  },
  {
    name: 'Scale', chf: 249, envs: 8, vcpu: 6, ramGb: 12,
    tagline: 'Multiple teams and monorepos.',
  },
];
