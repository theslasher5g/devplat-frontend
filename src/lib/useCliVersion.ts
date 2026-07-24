import { useEffect, useState } from 'react';
import { api } from './api';

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
 * The current CLI release, tracked at runtime so version strings and download
 * URLs follow real releases without a frontend redeploy. Reads the API's
 * `/cli/latest-version`, which proxies (and caches) the release host's
 * version.txt server-side — get.devplat.ch itself sends no CORS headers, so the
 * browser can't read it directly. Best-effort: any failure keeps the shipped
 * fallback, so the value is never blank.
 */
export function useCliVersion(): string {
  const [version, setVersion] = useState(FALLBACK_CLI_VERSION);
  useEffect(() => {
    let alive = true;
    api<{ version: string }>('/cli/latest-version')
      .then((d) => {
        // Defence in depth: the endpoint already validates, but re-check before
        // this lands in download URLs.
        if (alive && /^v?\d+\.\d+\.\d+$/.test(d.version)) {
          setVersion(d.version.startsWith('v') ? d.version : `v${d.version}`);
        }
      })
      .catch(() => { /* keep fallback */ });
    return () => { alive = false; };
  }, []);
  return version;
}
