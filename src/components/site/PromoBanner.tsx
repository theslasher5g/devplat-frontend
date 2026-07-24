import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Page } from './Shared';

interface Promo { active: boolean; label?: string; code?: string; endsAt?: string | null }

/** Thin, dismissible top bar advertising the active seasonal promo. Driven by
 *  the public GET /promo, so turning a campaign on/off is a backend env change
 *  — no redeploy. Renders nothing when no campaign is running or the visitor
 *  already dismissed this one. */
export default function PromoBanner({ go }: { go: (p: Page) => void }) {
  const [promo, setPromo] = useState<Promo | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let alive = true;
    api<Promo>('/promo')
      .then((p) => {
        if (!alive || !p.active) return;
        const key = `devplat.promo.${p.code ?? p.endsAt ?? 'on'}`;
        setDismissed(localStorage.getItem(key) === 'ack');
        setPromo(p);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!promo?.active || dismissed) return null;
  const key = `devplat.promo.${promo.code ?? promo.endsAt ?? 'on'}`;
  const dismiss = () => { try { localStorage.setItem(key, 'ack'); } catch { /* ignore */ } setDismissed(true); };

  return (
    <div className="bg-[--ink] text-[--dark-text] text-sm">
      <div className="mx-auto max-w-6xl px-5 py-2 flex items-center justify-center gap-3 text-center">
        <span className="w-1.5 h-1.5 rounded-full bg-[--red] shrink-0" aria-hidden />
        <span className="truncate">{promo.label || 'Limited-time offer — applied automatically at checkout.'}</span>
        <button onClick={() => go('preise')} className="font-mono2 text-xs underline underline-offset-2 hover:text-[--red] shrink-0">See pricing</button>
        <button onClick={dismiss} aria-label="Dismiss offer" className="ml-1 text-[--dark-muted] hover:text-white shrink-0 leading-none">✕</button>
      </div>
    </div>
  );
}
