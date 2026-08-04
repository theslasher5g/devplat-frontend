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

// The plan catalogue used to live here as `tiers`. It moved to lib/plans.ts,
// which is now the only copy — see the note there. Nothing imported this one,
// so it had quietly been carrying the pre-repositioning prices (Solo 19 /
// Team 79 / Scale 249) with nothing to reveal that they were wrong.
