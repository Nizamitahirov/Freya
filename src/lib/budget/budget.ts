/**
 * budget.ts — Büdcə hesablamaları (SRS §7). Pure funksiyalar.
 *
 * Büdcə GROSS olaraq idarə olunur. Draft/review sətirlər `committed`-ə (rezerv),
 * final təsdiq `spent`-ə düşür. remaining = allocated − committed − spent.
 */

export type BudgetState = {
  allocatedGross: number;
  committedGross: number;
  spentGross: number;
};

export type BudgetSummary = BudgetState & {
  remaining: number;
  /** İstifadə faizi: (committed + spent) / allocated. */
  utilization: number;
  status: 'ok' | 'warning' | 'over';
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** remaining = allocated − committed − spent  (SRS §7.2). */
export function remaining(b: BudgetState): number {
  return round2(b.allocatedGross - b.committedGross - b.spentGross);
}

/**
 * Büdcə xülasəsi + progress bar statusu (SRS §7.4):
 *  yaşıl (<80%) → sarı (80–100%) → qırmızı (>100%, over-budget).
 */
export function summarize(b: BudgetState): BudgetSummary {
  const used = b.committedGross + b.spentGross;
  const utilization = b.allocatedGross > 0 ? round2(used / b.allocatedGross) : 0;
  let status: BudgetSummary['status'] = 'ok';
  if (utilization > 1) status = 'over';
  else if (utilization >= 0.8) status = 'warning';
  return {
    ...b,
    remaining: remaining(b),
    utilization,
    status,
  };
}

/**
 * Draft/review sətrini rezerv et (committed += Δ)  (SRS §7.3).
 */
export function commitDraft(b: BudgetState, deltaGrossAnnual: number): BudgetState {
  return { ...b, committedGross: round2(b.committedGross + deltaGrossAnnual) };
}

/**
 * Sətri rezervdən azad et — reject / withdraw / return (SRS §7.3).
 */
export function releaseDraft(b: BudgetState, deltaGrossAnnual: number): BudgetState {
  return { ...b, committedGross: round2(b.committedGross - deltaGrossAnnual) };
}

/**
 * Final təsdiq: committed → spent (SRS §7.3, §10.1).
 */
export function finalizeItem(b: BudgetState, deltaGrossAnnual: number): BudgetState {
  return {
    ...b,
    committedGross: round2(b.committedGross - deltaGrossAnnual),
    spentGross: round2(b.spentGross + deltaGrossAnnual),
  };
}

/** Over-budget yoxlaması. */
export function isOverBudget(b: BudgetState): boolean {
  return remaining(b) < 0;
}
