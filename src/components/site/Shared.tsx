import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, LEVEL_META, type StatusSummary } from '@/lib/api';
import { liveLog } from '@/lib/demo';
import { useAuth } from '@/lib/auth';

/** Live status badge for the footer — reflects the real aggregate from
 *  /status (was a hardcoded "Operational") and links to the status page. */
function FooterStatus() {
  const [level, setLevel] = useState<StatusSummary['overall']['status'] | null>(null);
  useEffect(() => {
    let alive = true;
    api<StatusSummary>('/status').then((d) => { if (alive) setLevel(d.overall.status); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const meta = level ? LEVEL_META[level] : null;
  const color = meta?.color ?? 'var(--ink-soft)';
  return (
    <Link to="/status" className="mt-4 eyebrow inline-flex items-center gap-2 hover:opacity-80">
      {level && (
        <span className="beacon inline-block w-1.5 h-1.5 rounded-full" style={{ color, background: color }} aria-hidden />
      )}
      CH-BSL-1 ·{' '}
      <span style={{ color }}>{meta?.label ?? 'Status'}</span>
    </Link>
  );
}

export type Page = 'home' | 'technik' | 'security' | 'preise' | 'download' | 'docs' | 'compliance' | 'contact' | 'imprint' | 'terms' | 'privacy' | 'auth' | 'app';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * useCountUp animates a number from 0 to `target` once, the first time
 * `start` is true (so callers can defer it until the element scrolls into
 * view). Returns the current integer value. Honors prefers-reduced-motion by
 * snapping straight to the target. Non-finite targets are returned as-is by
 * the caller — this only runs for real numbers.
 */
export function useCountUp(target: number, start = true, durationMs = 900): number {
  const [val, setVal] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (!start || done.current) return;
    done.current = true;
    if (prefersReducedMotion() || !Number.isFinite(target)) { setVal(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      // easeOutCubic — fast start, gentle settle, matching the site's motion.
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, durationMs]);
  return Math.round(val);
}

/**
 * ScrollProgress renders the thin brand-red rail under the nav, its width
 * tracking how far the page is scrolled. Passive scroll listener, updates a
 * ref'd element's style directly (no per-frame React re-render). Renders
 * nothing meaningful for reduced-motion users (the rail just stays at 0).
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      el.style.width = max > 0 ? `${Math.min(100, (doc.scrollTop / max) * 100)}%` : '0%';
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return <div ref={ref} className="scroll-rail" aria-hidden />;
}

/**
 * Reveal wraps content that should fade/slide in the first time it scrolls
 * into view. One IntersectionObserver per element, disconnected after the
 * first intersection so it only ever plays once. `delay` (ms) staggers
 * siblings without needing a class per step. Honors prefers-reduced-motion
 * purely via CSS (see index.css: .reveal collapses to a no-op there), so
 * nothing here needs to branch on it.
 */
export function Reveal({
  children, delay = 0, className = '', as: Tag = 'div',
}: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'li' | 'section' }) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);
  return (
    <Tag
      ref={ref as never}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

export function Logo({ dark = false, onClick }: { dark?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-baseline gap-0.5 select-none" aria-label="devplat – Home">
      <span className={`font-doto text-[22px] tracking-tight ${dark ? 'text-[--dark-text]' : 'text-[--ink]'}`}>devplat</span>
      <span className="text-[--red] text-[22px] leading-none">●</span>
    </button>
  );
}

export function Nav({ page, go }: { page: Page; go: (p: Page) => void }) {
  const items: { key: Page; label: string }[] = [
    { key: 'technik', label: 'How it works' },
    { key: 'security', label: 'Security' },
    { key: 'preise', label: 'Pricing' },
    { key: 'docs', label: 'Docs' },
    { key: 'download', label: 'Download' },
  ];
  return (
    <header className="sticky top-0 z-40 bg-[--paper]/90 backdrop-blur border-b hairline">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
        <Logo onClick={() => go('home')} />
        <nav className="hidden md:flex items-center gap-8">
          {items.map((i) => (
            <button key={i.key} onClick={() => go(i.key)}
              className={`link-underline text-sm transition-colors ${page === i.key ? 'text-[--ink] font-medium' : 'text-[--ink-soft] hover:text-[--ink]'}`}>
              {i.label}
            </button>
          ))}
        </nav>
        <NavAuthButtons go={go} />
      </div>
    </header>
  );
}

function NavAuthButtons({ go }: { go: (p: Page) => void }) {
  const { me, loading } = useAuth();
  if (!loading && me) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={() => go('app')} className="btn-ink text-sm px-4 py-2">Dashboard</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => go('auth')} className="text-sm text-[--ink-soft] hover:text-[--ink]">Sign in</button>
      <button onClick={() => go('auth')} className="btn-ink text-sm px-4 py-2">Try it free</button>
    </div>
  );
}

export function Footer({ go }: { go: (p: Page) => void }) {
  return (
    <footer className="border-t hairline bg-[--paper]">
      <div className="mx-auto max-w-6xl px-5 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <Logo onClick={() => go('home')} />
          <p className="mt-3 text-sm text-[--ink-soft] max-w-[24ch]">Remote backend for Testcontainers. Hosted in Switzerland.</p>
          <FooterStatus />
        </div>
        <div>
          <p className="eyebrow mb-3">Product</p>
          <ul className="space-y-2 text-sm text-[--ink-soft]">
            <li><button className="hover:text-[--ink]" onClick={() => go('technik')}>Architecture</button></li>
            <li><button className="hover:text-[--ink]" onClick={() => go('preise')}>Pricing</button></li>
            <li><button className="hover:text-[--ink]" onClick={() => go('docs')}>Docs</button></li>
            <li><button className="hover:text-[--ink]" onClick={() => go('download')}>Download the CLI</button></li>
            <li><button className="hover:text-[--ink]" onClick={() => go('auth')}>Dashboard</button></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">Trust</p>
          <ul className="space-y-2 text-sm text-[--ink-soft]">
            <li><button className="hover:text-[--ink]" onClick={() => go('compliance')}>GDPR & Swiss FADP</button></li>
            <li><button className="hover:text-[--ink]" onClick={() => go('compliance')}>Download the DPA</button></li>
            <li><button className="hover:text-[--ink]" onClick={() => go('security')}>Security model</button></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">Contact</p>
          <ul className="space-y-2 text-sm text-[--ink-soft]">
            <li><button className="hover:text-[--ink]" onClick={() => go('contact')}>hello@devplat.ch</button></li>
            <li>Basel, Switzerland</li>
          </ul>
        </div>
      </div>
      <div className="border-t hairline">
        <div className="mx-auto max-w-6xl px-5 py-4 flex flex-wrap gap-3 justify-between text-xs text-[--ink-soft] font-mono2">
          <span>© 2026 devplat</span>
          <span className="flex gap-3">
            <button className="hover:text-[--ink]" onClick={() => go('imprint')}>Imprint</button>
            <span aria-hidden>·</span>
            <button className="hover:text-[--ink]" onClick={() => go('terms')}>Terms</button>
            <span aria-hidden>·</span>
            <button className="hover:text-[--ink]" onClick={() => go('privacy')}>Privacy</button>
          </span>
        </div>
      </div>
    </footer>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow eyebrow-dot mb-4">{children}</p>;
}

const tone: Record<string, string> = { sys: 'text-[--dark-muted]', ok: 'text-[#57C99A]', img: 'text-[#E8B44C]', test: 'text-[#8AB8F0]' };

export function TerminalDemo({ compact = false }: { compact?: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= liveLog.length) return;
    const jump = n === 10 ? 1500 : 420;
    const t = setTimeout(() => setN((v) => v + 1), jump);
    return () => clearTimeout(t);
  }, [n]);
  useEffect(() => {
    if (n < liveLog.length) return;
    const t = setTimeout(() => setN(0), 5200);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div className="bg-[--dark] text-left rounded-none border border-[--dark-line] shadow-[8px_8px_0_0_rgba(12,12,12,0.9)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[--dark-line]">
        <span className="font-mono2 text-[11px] text-[--dark-muted]">mvn verify</span>
        <span className="font-mono2 text-[11px] text-[--dark-muted] flex items-center gap-2">
          <span className="beacon inline-block w-1.5 h-1.5 rounded-full text-[--green] bg-[--green]" aria-hidden /> CH-BSL-1 · RTT 8 ms
        </span>
      </div>
      <div className={`px-4 py-3 font-mono2 text-[11.5px] leading-relaxed ${compact ? 'h-56' : 'h-72'} overflow-hidden`}>
        {liveLog.slice(0, n).map((l, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-[--dark-muted] shrink-0">{l.t}</span>
            <span className={tone[l.s]}>{l.m}</span>
          </div>
        ))}
        {n < liveLog.length && <div className="cursor-blink" />}
        {n >= liveLog.length && (
          <div className="mt-2 text-[#57C99A]">✓ BUILD SUCCESS — containers ran in Basel, torn down after.</div>
        )}
      </div>
    </div>
  );
}

/** useInView flips to true the first time the ref'd element enters the
 *  viewport, then disconnects. For one-shot entrance effects (count-ups). */
export function useInView<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setSeen(true); obs.disconnect(); }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [seen]);
  return [ref, seen];
}

export function Stat({ value, label, unit }: { value: string; label: string; unit?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  // Animate only clean numeric values (e.g. "100", "0"); leave decorated ones
  // like "~2" exactly as authored.
  const numeric = /^\d+$/.test(value) ? Number(value) : null;
  const counted = useCountUp(numeric ?? 0, inView && numeric !== null);
  const shown = numeric !== null ? String(counted) : value;
  return (
    <div ref={ref}>
      <p className="font-doto text-5xl md:text-6xl leading-none">
        {shown}<span className="text-2xl align-top text-[--red]">{unit}</span>
      </p>
      <p className="mt-2 text-sm text-[--ink-soft]">{label}</p>
    </div>
  );
}
