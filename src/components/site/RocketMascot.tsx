import { useEffect, useRef, useState } from 'react';

const VB_W = 150;
const VB_H = 70;
const EYE_POS: [number, number][] = [[48, 35], [70, 35]];

interface AsteroidSpec { top: number; size: number; duration: number; delay: number; opacity: number }

// Staggered sizes/speeds/vertical lanes so the field reads as scattered, not
// a single repeating row. top is a % of the container height.
const ASTEROIDS: AsteroidSpec[] = [
  { top: 8, size: 14, duration: 4.2, delay: 0, opacity: 0.9 },
  { top: 70, size: 10, duration: 5.4, delay: 0.8, opacity: 0.75 },
  { top: 35, size: 18, duration: 6.6, delay: 2.1, opacity: 0.85 },
  { top: 85, size: 9, duration: 3.6, delay: 1.4, opacity: 0.6 },
  { top: 20, size: 11, duration: 5.0, delay: 3.2, opacity: 0.7 },
  { top: 55, size: 15, duration: 4.8, delay: 4.0, opacity: 0.8 },
];

function Asteroid({ a }: { a: AsteroidSpec }) {
  return (
    <div
      className="absolute mascot-asteroid"
      style={{ top: `${a.top}%`, animationDuration: `${a.duration}s`, animationDelay: `${a.delay}s`, opacity: a.opacity }}
    >
      <svg width={a.size} height={a.size} viewBox="0 0 20 20">
        <path d="M2 8 L6 2 L14 1 L19 6 L18 14 L11 18 L4 15 Z" fill="var(--dark-muted)" />
        <circle cx="8" cy="8" r="1.4" fill="var(--dark-line)" />
        <circle cx="13" cy="12" r="1" fill="var(--dark-line)" />
      </svg>
    </div>
  );
}

/**
 * Chunky rocket mascot for the auth pages. Points left, weaves through an
 * incoming asteroid field (rocks drift left→right, toward its nose), and
 * its pupils follow the cursor. Purely decorative — CSS keyframes drive the
 * asteroids and the dodge wobble, so there's no per-frame JS beyond the
 * mousemove-driven eyes.
 */
export default function RocketMascot() {
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

  return (
    <div className="h-40 relative overflow-hidden" aria-hidden="true">
      {!reduced && ASTEROIDS.map((a, i) => <Asteroid key={i} a={a} />)}
      <div className="h-full flex items-center justify-center">
        <div className={reduced ? '' : 'mascot-dodge'}>
          <svg ref={svgRef} width="160" height="75" viewBox={`0 0 ${VB_W} ${VB_H}`}>
            {/* flame */}
            <g className={reduced ? '' : 'mascot-flame'}>
              <ellipse cx="106" cy="35" rx="11" ry="7" fill="#E63312" opacity="0.9" />
              <ellipse cx="103" cy="35" rx="6" ry="3.8" fill="#E8B44C" />
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
