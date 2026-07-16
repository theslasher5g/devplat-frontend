import { useEffect, useState } from 'react';

interface Step { rocketY: number; flame: string; boot: boolean; opacity: number; ms: number }

/** idle → ignition flicker → boost → launch off-panel → instant reset → idle, looping. */
const TIMELINE: Step[] = [
  { rocketY: 0, flame: '', boot: false, opacity: 1, ms: 2800 },
  { rocketY: 0, flame: '·', boot: false, opacity: 1, ms: 160 },
  { rocketY: 0, flame: ':', boot: false, opacity: 1, ms: 160 },
  { rocketY: 0, flame: '*', boot: true, opacity: 1, ms: 220 },
  { rocketY: 0, flame: '*·*', boot: true, opacity: 1, ms: 220 },
  { rocketY: -10, flame: '/*·*\\', boot: true, opacity: 1, ms: 260 },
  { rocketY: -72, flame: '/ * * \\', boot: false, opacity: 0.12, ms: 550 },
  { rocketY: -72, flame: '', boot: false, opacity: 0, ms: 150 },
];

export default function RocketMascot() {
  const [i, setI] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setI((v) => (v + 1) % TIMELINE.length), TIMELINE[i].ms);
    return () => clearTimeout(t);
  }, [i, reduced]);

  const step = reduced ? TIMELINE[0] : TIMELINE[i];
  const instant = i === 0; // snap back after the off-panel launch, no visible teleport

  return (
    <div className="h-32 flex flex-col items-center justify-center" aria-hidden="true">
      <div
        className="font-mono2 text-center text-[13px]"
        style={{
          transform: `translateY(${step.rocketY}px)`,
          opacity: step.opacity,
          transition: instant ? 'none' : 'transform 0.6s cubic-bezier(.3,.7,.4,1), opacity 0.3s ease',
        }}
      >
        <pre className="leading-[1.2]">{'   /\\\n  /  \\\n |['}<span className="text-[--red]">●</span>{']|\n |___|'}</pre>
        <pre className="h-4 leading-[1.2] text-[--red]">{step.flame}</pre>
      </div>
      <p className={`mt-1 font-mono2 text-[10px] text-[--dark-muted] transition-opacity duration-200 ${step.boot ? 'opacity-100' : 'opacity-0'}`}>
        booting devplat … 0.8s
      </p>
    </div>
  );
}
