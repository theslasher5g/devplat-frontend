import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import RocketMascot from './RocketMascot';
import { Logo } from './Shared';

const ERROR_TEXT: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  email_not_verified: 'Please confirm your email address first — check your inbox.',
  email_taken: 'An account with this email already exists.',
  validation_failed: 'Please check your input (password: at least 10 characters).',
  invalid_or_expired_token: 'This link is invalid or has expired.',
  invalid_or_expired_invite: 'This invitation is invalid or has expired.',
  invite_for_different_email: 'This invitation was issued for a different email address.',
};

function errText(err: unknown): string {
  if (err instanceof ApiError) return ERROR_TEXT[err.code] ?? `Something went wrong (${err.code}).`;
  return 'Network error — is the API reachable?';
}

function Field({ label, type, value, onChange, placeholder, autoFocus }: {
  label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder}
        autoFocus={autoFocus}
        className="mt-1.5 w-full border hairline bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[--ink]" />
    </label>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <div className="flex flex-col px-6 py-10 lg:px-16">
        <Logo onClick={() => navigate('/')} />
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <div className="hidden lg:flex bg-[--ink] text-[--dark-text] dotgrid-dark flex-col justify-between p-16 relative overflow-hidden">
        <p className="font-doto text-7xl leading-none">5 min<span className="text-[--red]">●</span></p>
        <div className="font-mono2 text-xs space-y-3 text-[--dark-muted]">
          <p><span className="text-[--red]">01</span>  Create an account</p>
          <p><span className="text-[--red]">02</span>  devplat connect — token gets set up</p>
          <p><span className="text-[--red]">03</span>  mvn verify — your code, unchanged</p>
          <p className="text-[#57C99A] pt-3">✓ First test run completed through Basel</p>
        </div>
        <RocketMascot />
        <p className="text-sm text-[--dark-muted] max-w-[36ch]">"We cut our CI time in half and cancelled the Docker Desktop contract. Same sprint." — Beta customer, Basel</p>
      </div>
    </main>
  );
}

type Mode = 'login' | 'register' | 'forgot';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [teamName, setTeamName] = useState('');
  const [mail, setMail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { me, loading, refresh } = useAuth();

  // Already signed in? Straight to the dashboard.
  useEffect(() => {
    if (!loading && me) navigate('/app', { replace: true });
  }, [loading, me, navigate]);

  const submit = async () => {
    setErr('');
    setNotice('');
    if (!mail.includes('@')) { setErr('Please enter a valid email address.'); return; }
    if (mode !== 'forgot' && !pw) { setErr('Please enter a password.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') {
        await api('/auth/login', { body: { email: mail, password: pw } });
        await refresh();
        const from = (location.state as { from?: string } | null)?.from;
        navigate(from ?? '/app', { replace: true });
      } else if (mode === 'register') {
        await api('/auth/register', { body: { email: mail, password: pw, teamName: teamName || undefined } });
        setNotice('Account created. Please check your inbox and confirm your email address before signing in.');
        setMode('login');
      } else {
        await api('/auth/forgot-password', { body: { email: mail } });
        setNotice('If an account exists for this address, a reset link is on its way.');
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'email_not_verified') {
        setErr(ERROR_TEXT.email_not_verified);
        setNotice('resend');
      } else {
        setErr(errText(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    setNotice('');
    await api('/auth/resend-verification', { body: { email: mail } }).catch(() => {});
    setErr('');
    setNotice('Verification email sent again — check your inbox.');
  };

  return (
    <AuthShell>
      <div className="inline-flex border hairline bg-white font-mono2 text-xs mb-8">
        <button onClick={() => { setMode('login'); setErr(''); setNotice(''); }} className={`px-4 py-2 ${mode === 'login' ? 'bg-[--ink] text-white' : 'text-[--ink-soft]'}`}>Sign in</button>
        <button onClick={() => { setMode('register'); setErr(''); setNotice(''); }} className={`px-4 py-2 ${mode === 'register' ? 'bg-[--ink] text-white' : 'text-[--ink-soft]'}`}>Register</button>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {mode === 'login' ? 'Welcome back.' : mode === 'register' ? 'Create an account.' : 'Reset password.'}
      </h1>
      <p className="mt-2 text-sm text-[--ink-soft]">
        {mode === 'login' && 'Sign in to your team dashboard.'}
        {mode === 'register' && 'Free trial: 1 parallel environment, 14 days, no credit card.'}
        {mode === 'forgot' && 'We’ll email you a link to set a new password.'}
      </p>

      <div className="mt-8 space-y-4">
        {mode === 'register' && (
          <Field label="Organization" type="text" value={teamName} onChange={setTeamName} placeholder="acme" />
        )}
        <Field label="Email" type="email" value={mail} onChange={setMail} autoFocus />
        {mode !== 'forgot' && (
          <Field label={mode === 'register' ? 'Password (min. 10 characters)' : 'Password'} type="password" value={pw} onChange={setPw} />
        )}
        {err && <p className="text-sm text-[--red]">{err}</p>}
        {notice === 'resend' ? (
          <button onClick={resendVerification} className="text-xs underline underline-offset-4 text-[--ink-soft] hover:text-[--ink]">Resend verification email</button>
        ) : notice ? (
          <p className="text-sm text-[--green]">{notice}</p>
        ) : null}
        <button onClick={submit} disabled={busy} className="btn-ink w-full py-3 text-sm disabled:opacity-60">
          {busy ? '…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}
        </button>
        {mode === 'login' && (
          <button onClick={() => { setMode('forgot'); setErr(''); setNotice(''); }} className="text-xs text-[--ink-soft] hover:text-[--ink] underline underline-offset-4">Forgot password?</button>
        )}
        {mode === 'forgot' && (
          <button onClick={() => { setMode('login'); setErr(''); setNotice(''); }} className="text-xs text-[--ink-soft] hover:text-[--ink] underline underline-offset-4">← Back to sign-in</button>
        )}
      </div>
    </AuthShell>
  );
}

/* ---------- /verify-email?token=… ---------- */

export function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  useEffect(() => {
    const token = params.get('token');
    if (!token) { setState('failed'); return; }
    api('/auth/verify-email', { body: { token } })
      .then(() => setState('done'))
      .catch(() => setState('failed'));
  }, [params]);
  return (
    <AuthShell>
      <p className="eyebrow eyebrow-dot mb-4">Email verification</p>
      {state === 'working' && <h1 className="text-3xl font-semibold tracking-tight">Confirming …</h1>}
      {state === 'done' && (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Email confirmed.</h1>
          <p className="mt-2 text-sm text-[--ink-soft]">Your account is active — you can sign in now.</p>
          <Link to="/auth" className="btn-ink inline-block mt-8 px-8 py-3 text-sm">Sign in</Link>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Link invalid.</h1>
          <p className="mt-2 text-sm text-[--ink-soft]">This confirmation link is invalid or has expired. Sign in to request a new one.</p>
          <Link to="/auth" className="btn-ink inline-block mt-8 px-8 py-3 text-sm">Go to sign-in</Link>
        </>
      )}
    </AuthShell>
  );
}

/* ---------- /reset-password?token=… ---------- */

export function ResetPassword() {
  const [params] = useSearchParams();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const token = params.get('token') ?? '';

  const submit = async () => {
    setErr('');
    if (pw.length < 10) { setErr('Password must be at least 10 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    try {
      await api('/auth/reset-password', { body: { token, password: pw } });
      setDone(true);
    } catch (e) {
      setErr(errText(e));
    }
  };

  return (
    <AuthShell>
      <p className="eyebrow eyebrow-dot mb-4">Password reset</p>
      {done ? (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Password changed.</h1>
          <p className="mt-2 text-sm text-[--ink-soft]">You can sign in with your new password now.</p>
          <Link to="/auth" className="btn-ink inline-block mt-8 px-8 py-3 text-sm">Sign in</Link>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Set a new password.</h1>
          <div className="mt-8 space-y-4">
            <Field label="New password (min. 10 characters)" type="password" value={pw} onChange={setPw} autoFocus />
            <Field label="Repeat password" type="password" value={pw2} onChange={setPw2} />
            {err && <p className="text-sm text-[--red]">{err}</p>}
            <button onClick={submit} className="btn-ink w-full py-3 text-sm">Save password</button>
          </div>
        </>
      )}
    </AuthShell>
  );
}

/* ---------- /invite?token=… ---------- */

interface InviteDetails { email: string; role: string; teamName: string; accountExists: boolean }

export function InviteAccept() {
  const [params] = useSearchParams();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed' | 'accepted'>('loading');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [accountCreated, setAccountCreated] = useState(false);
  const { me, loading, refresh } = useAuth();
  const token = params.get('token') ?? '';

  useEffect(() => {
    if (!token) { setState('failed'); return; }
    api<InviteDetails>(`/invites/${token}`)
      .then((d) => { setInvite(d); setState('ready'); })
      .catch(() => setState('failed'));
  }, [token]);

  const accept = async () => {
    setErr('');
    try {
      await api(`/invites/${token}/accept`, { method: 'POST', body: {} });
      await refresh();
      setState('accepted');
    } catch (e) {
      setErr(errText(e));
    }
  };

  // New user: register with the invited email, then verification + sign-in happen first.
  const registerAndAccept = async () => {
    if (!invite) return;
    setErr('');
    if (pw.length < 10) { setErr('Password must be at least 10 characters.'); return; }
    try {
      await api('/auth/register', { body: { email: invite.email, password: pw } });
      setAccountCreated(true);
    } catch (e) {
      setErr(errText(e));
    }
  };

  return (
    <AuthShell>
      <p className="eyebrow eyebrow-dot mb-4">Team invitation</p>
      {state === 'loading' && <h1 className="text-3xl font-semibold tracking-tight">Loading …</h1>}
      {state === 'failed' && !accountCreated && (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Invitation invalid.</h1>
          <p className="mt-2 text-sm text-[--ink-soft]">This invitation link is invalid or has expired. Ask your team admin for a new one.</p>
        </>
      )}
      {accountCreated && (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Almost there.</h1>
          <p className="mt-2 text-sm text-[--ink-soft]">
            Account created. Confirm your email address (check your inbox), sign in, and open this invitation link again to join the team.
          </p>
          <Link to="/auth" className="btn-ink inline-block mt-8 px-8 py-3 text-sm">Go to sign-in</Link>
        </>
      )}
      {state === 'accepted' && (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome aboard.</h1>
          <p className="mt-2 text-sm text-[--ink-soft]">You joined {invite?.teamName}.</p>
          <Link to="/app" className="btn-ink inline-block mt-8 px-8 py-3 text-sm">Open dashboard</Link>
        </>
      )}
      {state === 'ready' && invite && !accountCreated && (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Join {invite.teamName}.</h1>
          <p className="mt-2 text-sm text-[--ink-soft]">
            You were invited as <strong>{invite.role}</strong> ({invite.email}).
          </p>
          {!loading && me && me.user.email === invite.email && (
            <div className="mt-8 space-y-4">
              {err && <p className="text-sm text-[--red]">{err}</p>}
              <button onClick={accept} className="btn-ink w-full py-3 text-sm">Accept invitation</button>
            </div>
          )}
          {!loading && me && me.user.email !== invite.email && (
            <p className="mt-6 text-sm text-[--red]">
              You are signed in as {me.user.email}, but the invitation is for {invite.email}. Sign out first.
            </p>
          )}
          {!loading && !me && invite.accountExists && (
            <div className="mt-8 space-y-4">
              <p className="text-sm text-[--ink-soft]">Sign in with {invite.email}, then open this link again.</p>
              <Link to="/auth" className="btn-ink inline-block px-8 py-3 text-sm">Sign in</Link>
            </div>
          )}
          {!loading && !me && !invite.accountExists && (
            <div className="mt-8 space-y-4">
              <Field label="Choose a password (min. 10 characters)" type="password" value={pw} onChange={setPw} autoFocus />
              {err && <p className="text-sm text-[--red]">{err}</p>}
              <button onClick={registerAndAccept} className="btn-ink w-full py-3 text-sm">Create account</button>
            </div>
          )}
        </>
      )}
    </AuthShell>
  );
}
