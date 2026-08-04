import { useState } from 'react';
import { ApiError, api } from '@/lib/api';

/**
 * The way into the tier that has no price.
 *
 * Enterprise is sold by conversation, which is the whole reason it carries no
 * number: it is how we find out what a regulated customer will actually pay.
 * That only works if starting the conversation is easier than closing the tab,
 * so this is four fields on the page itself rather than a mailto: link or a
 * separate contact form two clicks away.
 *
 * Only email and company are required. Team size and the message are the fields
 * worth reading, but demanding them would cost enquiries from exactly the people
 * who are still deciding whether to bother — and a lead with a blank message is
 * worth infinitely more than one that was never sent.
 */
export function EnterpriseEnquiry({ source = 'pricing', compact = false, tone = 'light' }: {
  source?: 'pricing' | 'dashboard';
  /** Denser layout for the dashboard, where it sits inside a card. */
  compact?: boolean;
  /** The dashboard is dark; the marketing site is paper. Same form, and the
   *  same four fields — only the palette differs, because a form that inverts
   *  its own surroundings reads as an embedded advert rather than part of the
   *  page it is on. */
  tone?: 'light' | 'dark';
}) {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!email.includes('@')) { setErr('Please enter an email address we can reply to.'); return; }
    if (!company.trim()) { setErr('Please tell us which company this is for.'); return; }
    setBusy(true);
    try {
      await api('/enquiries', {
        body: {
          email: email.trim(),
          company: company.trim(),
          // Sent only when it parses. An empty or nonsense value must not turn
          // into a 400 that loses the whole enquiry over an optional field.
          ...(Number.isFinite(Number(teamSize)) && Number(teamSize) > 0
            ? { teamSize: Math.trunc(Number(teamSize)) } : {}),
          ...(message.trim() ? { message: message.trim() } : {}),
          source,
        },
      });
      setSent(true);
    } catch (e2) {
      setErr(e2 instanceof ApiError && e2.status === 429
        ? 'That is a lot of enquiries from one place. Write to hello@devplat.ch and we will pick it up there.'
        : 'That did not go through. Please write to hello@devplat.ch instead — we would rather hear from you than lose the message.');
    } finally {
      setBusy(false);
    }
  };

  const dark = tone === 'dark';
  const shell = dark
    ? `border border-[--dark-line] bg-[--dark-card] text-[--dark-text] ${compact ? 'p-5' : 'p-7'}`
    : `border hairline bg-white ${compact ? 'p-5' : 'p-7'}`;
  const muted = dark ? 'text-[--dark-muted]' : 'text-[--ink-soft]';
  const label = `font-mono2 text-[10px] uppercase tracking-widest ${muted}`;

  if (sent) {
    return (
      <div className={shell}>
        <p className="font-mono2 text-[10px] uppercase tracking-widest text-[--red]">Thanks</p>
        <p className="mt-3 text-lg font-semibold">We have it.</p>
        <p className={`mt-2 text-sm ${muted} max-w-[52ch]`}>
          You will hear from a person — not a sequence — within one working day. If it is urgent,
          hello@devplat.ch reaches the same inbox.
        </p>
      </div>
    );
  }

  const field = dark
    ? 'w-full border border-[--dark-line] bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white'
    : 'w-full border hairline bg-white px-3 py-2.5 text-sm outline-none focus:border-[--ink]';
  return (
    <form onSubmit={submit} className={shell}>
      <p className={label}>Talk to us</p>
      <p className={`mt-2 text-sm ${muted} max-w-[52ch]`}>
        Tell us roughly what you need and we will come back with a concrete number — not a
        brochure.
      </p>
      <div className={`mt-5 grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <label className="block">
          <span className={label}>Work email *</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className={`mt-1.5 ${field}`} placeholder="you@company.ch" required />
        </label>
        <label className="block">
          <span className={label}>Company *</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)}
            className={`mt-1.5 ${field}`} placeholder="Company AG" required />
        </label>
      </div>
      <label className="block mt-3">
        <span className={label}>How many developers?</span>
        <input inputMode="numeric" value={teamSize} onChange={(e) => setTeamSize(e.target.value)}
          className={`mt-1.5 ${field} sm:max-w-[12rem]`} placeholder="e.g. 40" />
      </label>
      <label className="block mt-3">
        <span className={label}>What matters most to you?</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
          className={`mt-1.5 ${field} resize-y`}
          placeholder="Data residency, an audit we have coming up, SSO, how many parallel runs…" />
      </label>
      {err && <p className={`mt-3 text-sm ${dark ? 'text-[#F07A6A]' : 'text-[--red]'}`}>{err}</p>}
      <button type="submit" disabled={busy}
        className={dark
          ? 'font-mono2 text-[10px] uppercase tracking-widest border border-white px-5 py-2.5 mt-5 hover:bg-white hover:text-[--dark] disabled:opacity-40'
          : 'btn-ink px-6 py-3 mt-5 disabled:opacity-40'}>
        {busy ? 'Sending…' : 'Send enquiry'}
      </button>
      <p className={`mt-3 font-mono2 text-[10px] ${muted}`}>
        Goes to one inbox in Basel. No CRM sequence, no newsletter.
      </p>
    </form>
  );
}
