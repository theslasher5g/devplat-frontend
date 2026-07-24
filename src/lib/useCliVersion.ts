import { useEffect, useState } from 'react';

// Shipped fallback: what the UI shows before (or if) the live lookup resolves,
// so version text is never blank and still works offline / behind a strict CSP.
// Bump on release too, so a stale cache never lags far behind.
export const FALLBACK_CLI_VERSION = 'v1.1.0';

/** Compare two v-prefixed semvers. Returns true when `a` is strictly older than
 *  `b`. Non-semver inputs compare as equal (returns false), so a malformed
 *  reported version never yields a spurious "update available". */
export function isOlderVersion(a: string, b: string): boolean {
  const parse = (v: string) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return true;
    if (pa[i] > pb[i]) return false;
  }
  return false;
}

/**
 * The current CLI release, read at runtime from the release host's
 * `version.txt` so version strings and download URLs track real releases
 * without a frontend redeploy. Best-effort: a bare semver is validated before
 * use and any failure (offline, CORS, junk contents) keeps the shipped
 * fallback. The host must send `Access-Control-Allow-Origin: *` on version.txt
 * for the cross-origin read to succeed; otherwise the fallback simply stands.
 */
export function useCliVersion(): string {
  const [version, setVersion] = useState(FALLBACK_CLI_VERSION);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch('https://get.devplat.ch/version.txt', { signal: controller.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('bad status'))))
      .then((raw) => {
        const trimmed = raw.trim();
        // Guard against an error page or garbage ending up in download URLs:
        // only accept a bare semver (optionally v-prefixed), normalised to the
        // v-prefixed form the release paths use (get.devplat.ch/vX.Y.Z/…).
        if (/^v?\d+\.\d+\.\d+$/.test(trimmed)) {
          setVersion(trimmed.startsWith('v') ? trimmed : `v${trimmed}`);
        }
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  return version;
}
