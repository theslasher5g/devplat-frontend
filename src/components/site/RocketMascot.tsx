import { useEffect, useRef, useState } from 'react';

const VB_W = 150;
const VB_H = 70;
const EYE_POS: [number, number][] = [[48, 35], [70, 35]];

type Phase = 'idle' | 'fly' | 'reset';

/**
 * Chunky rocket mascot for the auth pages. Points left (it flies toward
 * Basel, i.e. right-to-left), bobs gently, blinks, and its pupils follow
 * the cursor. Every few seconds it dashes off the left edge of the dark
 * panel (the panel clips it via overflow-hidden) and fades back in.
 */
export default function RocketMascot() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [reduced, setReduced] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pupilRefs = useRef<(SVGEllipseElement | null)[]>([null, null]);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Pupils track the cursor — refs + rAF, no re-renders on mousemove.
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const box = svg.getBoundingClientRect();
        EYE_POS.forEach(([cx, cy], i) => {
          const el = pupilRefs.current[i];
          if (!el) return;
          const ex = box.left + (cx / VB_W) * box.width;
          const ey = box.top + (cy / VB_H) * box.height;
          const dx = e.clientX - ex;
          const dy = e.clientY - ey;
          const dist = Math.hypot(dx, dy) || 1;
          const r = Math.min(dist / 40, 3.2); // stay inside the sclera
          el.setAttribute('transform', `translate(${((dx / dist) * r).toFixed(2)} ${((dy / dist) * r).toFixed(2)})`);
        });
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // idle → fly off to the left → invisible snap back → idle, forever.
  useEffect(() => {
    if (reduced) return;
    const ms = phase === 'idle' ? 9000 : phase === 'fly' ? 2500 : 80;
    const t = setTimeout(
      () => setPhase(phase === 'idle' ? 'fly' : phase === 'fly' ? 'reset' : 'idle'),
      ms,
    );
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const flying = phase === 'fly';
  const flightStyle: React.CSSProperties = {
    transform: flying ? 'translate(-58vw, -70px) rotate(-8deg)' : 'translate(0, 0) rotate(0deg)',
    opacity: phase === 'reset' ? 0 : flying ? 0 : 1,
    transition:
      phase === 'reset' ? 'none'
        : flying ? 'transform 2.5s cubic-bezier(.5,.05,.7,.6), opacity .6s ease 1.8s'
        : 'opacity .7s ease',
  };

  return (
    <div className="h-36 flex items-center justify-center" aria-hidden="true">
      <div style={flightStyle}>
        <div className={reduced ? '' : 'mascot-bob'}>
          <svg ref={svgRef} width="160" height="75" viewBox={`0 0 ${VB_W} ${VB_H}`}>
            {/* speed lines, only while flying */}
            <g opacity={flying ? 1 : 0} stroke="var(--dark-muted)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="128" y1="24" x2="144" y2="24" />
              <line x1="132" y1="35" x2="149" y2="35" />
              <line x1="128" y1="46" x2="142" y2="46" />
            </g>
            {/* flame */}
            <g className={reduced ? '' : 'mascot-flame'}>
              <ellipse cx="106" cy="35" rx={flying ? 17 : 9} ry="7" fill="#E63312" opacity="0.9" />
              <ellipse cx="103" cy="35" rx={flying ? 10 : 5} ry="3.8" fill="#E8B44C" />
            </g>
            {/* fins (roots hidden under the body) */}
            <path d="M86 20 Q98 3 113 8 Q107 19 96 23 Z" fill="#E63312" />
            <path d="M86 50 Q98 67 113 62 Q107 51 96 47 Z" fill="#E63312" />
            {/* body */}
            <rect x="16" y="15" width="86" height="40" rx="20" fill="#F4F4F1" />
            {/* nose cone */}
            <path d="M26 16 Q8 22 3 35 Q8 48 26 54 Z" fill="#E63312" />
            {/* face — blinks as a group, pupils steered by the mousemove handler */}
            <g className={reduced ? '' : 'mascot-eye'}>
              <circle cx="48" cy="35" r="8" fill="#FFFFFF" />
              <circle cx="70" cy="35" r="8" fill="#FFFFFF" />
              <ellipse ref={(el) => { pupilRefs.current[0] = el; }} cx="48" cy="35" rx="3" ry="4.6" fill="#0C0C0C" />
              <ellipse ref={(el) => { pupilRefs.current[1] = el; }} cx="70" cy="35" rx="3" ry="4.6" fill="#0C0C0C" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
