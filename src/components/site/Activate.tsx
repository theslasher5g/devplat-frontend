import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthShell, errText } from './Auth';

/**
 * /activate — the browser half of `devplat login`. A logged-in user lands
 * here (the CLI prints the URL, optionally with the code prefilled), confirms
 * the short code, and approves the pending device request. The API then mints
 * a token for THIS user's current team, which the still-polling CLI receives.
 * Guarded by RequireAuth in App.tsx, so req.membership is always present on
 * the approve call.
 */
export default function Activate() {
  const [params] = useSearchParams();
  const { me } = useAuth();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');

  const approve = async () => {
    setErr('');
    setState('working');
    try {
      await api('/auth/device/approve', { body: { userCode: code.trim() } });
      setState('done');
    } catch (e) {
      setErr(errText(e));
      setState('error');
    }
  };

  return (
    <AuthShell>
      <p className="eyebrow eyebrow-dot mb-4">Device login</p>
      {state === 'done' ? (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Device authorized.</h1>
          <p className="mt-2 text-sm text-[--ink-soft]">
            Return to your terminal — <span className="font-mono2 text-[13px]">devplat login</span> will
            finish on its own. You can revoke this login any time under{' '}
            <Link to="/app/tokens" className="link-underline text-[--ink] font-medium">Tokens</Link>.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Authorize this device</h1>
          <p className="mt-2 text-sm text-[--ink-soft]">
            Confirm the code shown in your terminal to grant the CLI an access token
            {me?.team ? <> for <span className="text-[--ink] font-medium">{me.team.name}</span></> : null}.
          </p>
          <div className="mt-8">
            <label className="block">
              <span className="eyebrow">Code from your terminal</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void approve(); }}
                placeholder="XXXX-XXXX"
                autoFocus
                autoCapitalize="characters"
                spellCheck={false}
                className="mt-1.5 w-full border hairline bg-white px-3.5 py-2.5 text-sm font-mono2 tracking-widest uppercase outline-none focus:border-[--ink]"
              />
            </label>
          </div>
          {err && <p className="mt-4 text-sm text-[--red]">{err}</p>}
          <button
            onClick={() => void approve()}
            disabled={state === 'working' || code.trim().length < 6}
            className="btn-ink inline-block mt-8 px-8 py-3 text-sm disabled:opacity-50"
          >
            {state === 'working' ? 'Authorizing …' : 'Authorize device'}
          </button>
          <p className="mt-6 text-xs text-[--ink-soft]">
            Only approve a code you started yourself with{' '}
            <span className="font-mono2 text-[12px]">devplat login</span>. It grants test-run access to
            your environments — never share it.
          </p>
        </>
      )}
    </AuthShell>
  );
}
