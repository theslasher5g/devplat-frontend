/**
 * Client-side mirror of the backend's password policy (see
 * devplat-backend/src/lib/passwordPolicy.ts). This exists purely for live
 * feedback while typing — the server re-validates every password and is the
 * only authority. Keep the two in sync when either changes.
 */
export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordRule { label: string; ok: boolean }

export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: `At least ${PASSWORD_MIN_LENGTH} characters`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'A lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'A number', ok: /[0-9]/.test(password) },
    { label: 'A special character', ok: /[^A-Za-z0-9\s]/.test(password) },
  ];
}

/** True when every rule passes. The server still checks the password against
 *  known breach corpora, which the client can't do — so this passing does not
 *  guarantee the server will accept it. */
export function passwordMeetsPolicy(password: string): boolean {
  return passwordRules(password).every((r) => r.ok);
}
