import { useState } from 'react';
import { Logo, type Page } from './Shared';

export default function Auth({ go }: { go: (p: Page) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [mail, setMail] = useState('sandro@acme.dev');
  const [pw, setPw] = useState('••••••••••');
  const [err, setErr] = useState('');

  const submit = () => {
    if (!mail.includes('@')) { setErr('Please enter a valid email address.'); return; }
    if (!pw) { setErr('Please enter a password.'); return; }
    setErr('');
    go('app');
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* left: form */}
      <div className="flex flex-col px-6 py-10 lg:px-16">
        <Logo onClick={() => go('home')} />
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm">
            <div className="inline-flex border hairline bg-white font-mono2 text-xs mb-8">
              <button onClick={() => setMode('login')} className={`px-4 py-2 ${mode === 'login' ? 'bg-[--ink] text-white' : 'text-[--ink-soft]'}`}>Sign in</button>
              <button onClick={() => setMode('register')} className={`px-4 py-2 ${mode === 'register' ? 'bg-[--ink] text-white' : 'text-[--ink-soft]'}`}>Register</button>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {mode === 'login' ? 'Welcome back.' : 'Create an account.'}
            </h1>
            <p className="mt-2 text-sm text-[--ink-soft]">
              {mode === 'login' ? 'Your dashboard is waiting — including a run in progress.' : 'Free tier: 1 parallel environment, no credit card.'}
            </p>

            <div className="mt-8 space-y-4">
              {mode === 'register' && (
                <label className="block">
                  <span className="eyebrow">Organization</span>
                  <input defaultValue="acme" className="mt-1.5 w-full border hairline bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[--ink]" placeholder="acme" />
                </label>
              )}
              <label className="block">
                <span className="eyebrow">Email</span>
                <input value={mail} onChange={(e) => setMail(e.target.value)} type="email"
                  className="mt-1.5 w-full border hairline bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[--ink]" />
              </label>
              <label className="block">
                <span className="eyebrow">Password</span>
                <input value={pw} onChange={(e) => setPw(e.target.value)} type="password"
                  className="mt-1.5 w-full border hairline bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[--ink]" />
              </label>
              {err && <p className="text-sm text-[--red]">{err}</p>}
              <button onClick={submit} className="btn-ink w-full py-3 text-sm">
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
              <div className="flex items-center gap-3 text-xs text-[--ink-soft]">
                <span className="h-px flex-1 bg-[--line]" /> or <span className="h-px flex-1 bg-[--line]" />
              </div>
              <button onClick={submit} className="btn-ghost w-full py-3 text-sm">Continue with GitHub</button>
              <button onClick={submit} className="btn-ghost w-full py-3 text-sm">Continue with GitLab</button>
              {mode === 'login' && <button className="text-xs text-[--ink-soft] hover:text-[--ink] underline underline-offset-4">Forgot password?</button>}
            </div>
            <p className="mt-8 font-mono2 text-[10px] text-[--ink-soft]">Demo frontend — any sign-in leads to the sample dashboard.</p>
          </div>
        </div>
      </div>
      {/* right: visual */}
      <div className="hidden lg:flex bg-[--ink] text-[--dark-text] dotgrid-dark flex-col justify-between p-16">
        <p className="font-doto text-7xl leading-none">5 min<span className="text-[--red]">●</span></p>
        <div className="font-mono2 text-xs space-y-3 text-[--dark-muted]">
          <p><span className="text-[--red]">01</span>  Create an account</p>
          <p><span className="text-[--red]">02</span>  devplat connect — token gets set up</p>
          <p><span className="text-[--red]">03</span>  mvn verify — your code, unchanged</p>
          <p className="text-[#57C99A] pt-3">✓ First test run completed through Zurich</p>
        </div>
        <p className="text-sm text-[--dark-muted] max-w-[36ch]">"We cut our CI time in half and cancelled the Docker Desktop contract. Same sprint." — Beta customer, Basel</p>
      </div>
    </main>
  );
}
