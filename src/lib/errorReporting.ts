import { API_URL } from './api';

/**
 * Reports browser crashes to the control plane.
 *
 * Until now a React render error produced a blank white page and no signal at
 * all — the user saw nothing, and neither did we. The backend groups these by
 * fingerprint alongside server errors (see devplat-backend/src/lib/
 * errorTracking.ts), so a crash on the signup form shows up in the admin
 * dashboard instead of in a support email three weeks later.
 *
 * Self-hosted on purpose: a third-party tracker would be another sub-processor
 * to name in the privacy policy, and another place customer data could land.
 */

/** Fingerprints already sent this page-load, so a render loop doesn't hammer
 *  the endpoint (which is rate-limited and would just start dropping them). */
const sent = new Set<string>();
const MAX_PER_PAGELOAD = 5;

export function reportError(error: unknown, context?: string): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const key = `${context ?? ''}|${err.message}`;
    if (sent.has(key) || sent.size >= MAX_PER_PAGELOAD) return;
    sent.add(key);

    const body = JSON.stringify({
      message: `${context ? `${context}: ` : ''}${err.message}`.slice(0, 1000),
      stack: err.stack?.slice(0, 4000),
      // The SPA route, which the server can't see. Strip the query string:
      // it can carry invite and verification tokens.
      route: window.location.pathname.slice(0, 200),
    });

    // keepalive so the report still goes out if this crash is followed by a
    // navigation or a reload — which, for a crashed page, it usually is.
    void fetch(`${API_URL}/client-errors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Reporting is best-effort by definition. A failure here must never
      // surface to the user, who already has a broken page in front of them.
    });
  } catch {
    // Never let the reporter throw inside an error handler.
  }
}

/**
 * Catches what the React error boundary can't: errors thrown outside render
 * (event handlers, timers) and unhandled promise rejections.
 */
export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (e) => {
    // Resource load failures (a 404'd image) fire here too with no error
    // object; they aren't application crashes and would only add noise.
    if (e.error) reportError(e.error, 'window.onerror');
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportError(e.reason, 'unhandledrejection');
  });
}
