import { useState } from 'react';
import { api } from '@/lib/api';
import { Eyebrow } from './Shared';

function Field({ label, type, value, onChange, placeholder, required, textarea, autoFocus }: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; textarea?: boolean; autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}{required && <span className="text-[--red]"> *</span>}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={6}
          className="mt-1.5 w-full border hairline bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[--ink] resize-none" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} type={type ?? 'text'} placeholder={placeholder}
          autoFocus={autoFocus}
          className="mt-1.5 w-full border hairline bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[--ink]" />
      )}
    </label>
  );
}

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Please enter your name.'); return; }
    if (!email.includes('@')) { setErr('Please enter a valid email address.'); return; }
    if (!message.trim()) { setErr('Please enter a message.'); return; }
    setBusy(true);
    try {
      await api('/contact', { body: { name, email, company: company || undefined, message } });
      setSent(true);
    } catch {
      setErr('Could not send your message — please try again, or email hello@devplat.ch directly.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Contact</Eyebrow>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] max-w-[20ch]">
            Talk to a <span className="font-doto">human</span>, not a chatbot.
          </h1>
          <p className="mt-6 text-lg text-[--ink-soft] max-w-[52ch]">
            Enterprise plan, dedicated hardware, on-prem, a question the FAQ doesn't answer — tell
            us what you need.
          </p>
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-5 py-16 grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <Eyebrow>Reach us directly</Eyebrow>
            <h2 className="text-2xl font-semibold tracking-tight">hello@devplat.ch</h2>
            <p className="mt-3 text-sm text-[--ink-soft] max-w-[40ch]">
              Prefer email? Write to us directly — same inbox this form delivers to.
            </p>
            <p className="mt-8 eyebrow">Based in</p>
            <p className="mt-1 text-sm text-[--ink-soft]">Basel, Switzerland</p>
          </div>

          <div className="border hairline bg-white p-7">
            {sent ? (
              <div className="py-8 text-center">
                <p className="font-doto text-4xl text-[--red]">✓</p>
                <h3 className="mt-4 text-xl font-semibold">Message sent.</h3>
                <p className="mt-2 text-sm text-[--ink-soft]">We'll get back to you within one business day.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" value={name} onChange={setName} required autoFocus />
                  <Field label="Email" type="email" value={email} onChange={setEmail} required />
                </div>
                <Field label="Company" value={company} onChange={setCompany} placeholder="Optional" />
                <Field label="Message" value={message} onChange={setMessage} required textarea
                  placeholder="What are you trying to do?" />
                {err && <p className="text-sm text-[--red]">{err}</p>}
                <button onClick={submit} disabled={busy} className="btn-ink py-3 text-sm disabled:opacity-60">
                  {busy ? 'Sending…' : 'Send message'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
