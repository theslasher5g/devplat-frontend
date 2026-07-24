import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Minimal cookie notice. devplat sets exactly one strictly-necessary cookie
 * (the httpOnly session), no analytics or ad cookies — so under GDPR/ePrivacy
 * no consent is required, only transparency. This is therefore an
 * acknowledgement banner (a single "Got it"), not a consent gate, and it never
 * blocks the page. Dismissal persists in localStorage.
 */
export default function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem('devplat.cookieNotice') !== 'ack') setShow(true);
    } catch { /* storage blocked — just don't show it */ }
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try { localStorage.setItem('devplat.cookieNotice', 'ack'); } catch { /* ignore */ }
    setShow(false);
  };
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t hairline bg-[--paper]/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[--ink-soft] max-w-[70ch]">
          We use a single essential cookie to keep you signed in — no tracking, analytics, or ad cookies.{' '}
          <Link to="/legal/privacy" className="link-underline text-[--ink] font-medium">Privacy</Link>.
        </p>
        <button onClick={dismiss} className="btn-ink text-sm px-5 py-2 shrink-0">Got it</button>
      </div>
    </div>
  );
}
