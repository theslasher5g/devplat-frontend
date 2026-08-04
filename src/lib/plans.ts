/**
 * The plan catalogue, as the marketing site and the dashboard render it.
 *
 * Mirrors the backend `plans` table (devplat-backend/migrations/043_company_pricing.sql).
 * Kept as static data rather than fetched: the pricing page must render for a
 * visitor with no session and no API round-trip, and these numbers change on the
 * order of once a year.
 *
 * One module rather than three. Before this there were copies in lib/demo.ts,
 * Dashboard.tsx (TIER_CARDS) and PreiseCompliance.tsx, and each already carried
 * a comment warning that the copies could disagree — by the time the repricing
 * landed all three disagreed with the database and with each other. The screen
 * where someone decides to pay is the worst place for a stale number, so the
 * duplicate is worth removing rather than re-synchronising.
 */

export interface PlanCard {
  /** Matches plans.id in the backend. Not renamed when the tiers were
   *  repositioned: teams.plan_tier is a foreign key with history behind it. */
  tier: 'free' | 'team' | 'scale';
  name: string;
  /** Base price per month in CHF. Null for the sales-led tier — a computed
   *  number there would be a price nobody agreed to charge. */
  chf: number | null;
  /** Added per developer beyond `includedSeats`. */
  chfPerSeat: number;
  includedSeats: number;
  /** Seat cap; null means unlimited. */
  maxSeats: number | null;
  envs: number;
  vcpu: number;
  ramGb: number;
  tagline: string;
  /** Whether a customer can buy it without talking to us. */
  selfServe: boolean;
  hot?: boolean;
}

export const TEAM_BASE = 190;
export const TEAM_SEAT = 25;
export const TEAM_INCLUDED = 5;
/** Where the pricing-page slider stops. Past this the answer is Enterprise,
 *  which matches plans.max_members = 25 on the Team tier. */
export const TEAM_MAX_SEATS = 25;

/** Annual billing discount, as a multiplier on the monthly price. */
export const YEARLY_FACTOR = 0.83;

export const PLANS: PlanCard[] = [
  {
    tier: 'free', name: 'Evaluation',
    chf: 0, chfPerSeat: 0, includedSeats: 2, maxSeats: 2,
    envs: 1, vcpu: 1, ramGb: 2,
    tagline: 'Point your real pipeline at it for 14 days.',
    selfServe: true,
  },
  {
    tier: 'team', name: 'Team',
    chf: TEAM_BASE, chfPerSeat: TEAM_SEAT,
    includedSeats: TEAM_INCLUDED, maxSeats: TEAM_MAX_SEATS,
    envs: 5, vcpu: 4, ramGb: 8,
    tagline: 'Engineering teams with a CI pipeline to answer for.',
    selfServe: true, hot: true,
  },
  {
    tier: 'scale', name: 'Enterprise',
    chf: null, chfPerSeat: 0, includedSeats: 0, maxSeats: null,
    envs: 12, vcpu: 6, ramGb: 12,
    tagline: 'Dedicated hardware, SSO, and a signed DPA.',
    selfServe: false,
  },
];

/** A tier someone can actually be moved onto. Excludes the trial: checkout has
 *  no way to "downgrade to Evaluation", and a button that posts one would get a
 *  schema rejection rather than anything useful. */
export type PurchasableTier = Exclude<PlanCard['tier'], 'free'>;

export const PURCHASABLE_PLANS = PLANS.filter(
  (p): p is PlanCard & { tier: PurchasableTier } => p.tier !== 'free',
);

export function getPlanCard(tier: PlanCard['tier']): PlanCard {
  const p = PLANS.find((x) => x.tier === tier);
  if (!p) throw new Error(`unknown tier ${tier}`);
  return p;
}

/**
 * Seats charged for beyond the allowance.
 *
 * Clamped at zero for the same reason as the backend's `billableSeats`: a team
 * legitimately sits below its included seats after someone leaves, and a
 * negative count would render as a discount that does not exist.
 */
export function billableSeats(plan: PlanCard, seats: number): number {
  return Math.max(0, seats - plan.includedSeats);
}

/**
 * What a team of `seats` people pays per month.
 *
 * Null for a tier with no published price. This mirrors monthlyCost() in the
 * backend (src/lib/pricing.ts) — deliberately, since the two must agree: the
 * page quotes it and the invoice charges it.
 */
export function monthlyCost(plan: PlanCard, seats: number): number | null {
  if (!plan.selfServe || plan.chf === null) return null;
  return plan.chf + billableSeats(plan, seats) * plan.chfPerSeat;
}
