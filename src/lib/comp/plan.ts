/**
 * plan.ts — Per-employee planlaşdırma hesablaması (SRS §9.1).
 *
 * Rəhbərin girişini (faiz / məbləğ / mütləq net) → yeni net → yeni gross / meal /
 * supergross → büdcə Δgross-a çevirir. Hamısı pure engine funksiyalarına söykənir.
 */

import {
  applyMealAllowance,
  getDeductions,
  solveGross,
  superGross,
  type CompContext,
} from './engine';
import { DEFAULT_MEAL_LIMIT } from './taxConfig';

export type InputMode = 'percent' | 'amount' | 'absolute';

export type PlanInput = {
  mode: InputMode;
  /** percent → faiz; amount → net artım məbləği; absolute → birbaşa yeni net. */
  value: number;
  currentNet: number;
  currentGross: number;
  currentMeal: number;
  ctx: CompContext;
  mealLimit?: number;
  /** Effektiv tarixdən ilin sonuna qədər ay sayı (büdcə üçün). */
  effectiveMonths: number;
};

export type PlanResult = {
  newNet: number;
  newGross: number;
  newSuperGross: number;
  newMeal: number;
  /** Aylıq gross fərqi. */
  deltaGrossMonthly: number;
  /** İllik (effektiv aylar × aylıq) gross fərqi — büdcə təsiri. */
  deltaGrossAnnual: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Giriş üsuluna görə yeni net-i hesablayır (SRS §9.1). */
export function resolveNewNet(mode: InputMode, value: number, currentNet: number): number {
  switch (mode) {
    case 'percent':
      return round2(currentNet * (1 + value / 100));
    case 'amount':
      return round2(currentNet + value);
    case 'absolute':
      return round2(value);
  }
}

/**
 * Tam planlaşdırma hesablaması (SRS §9.1 + §11.7 + §7.3).
 *
 * Addımlar:
 *  1. giriş → yeni net
 *  2. net artım → yemək pulu paylanması (limitə qədər yemək, qalan maaşa)
 *  3. maaşa gedən net → solveGross ilə yeni gross
 *  4. yeni gross → superGross
 *  5. Δgross × effektiv aylar → büdcə təsiri
 */
export function planCompensation(input: PlanInput): PlanResult {
  const {
    mode,
    value,
    currentNet,
    currentGross,
    currentMeal,
    ctx,
    effectiveMonths,
    mealLimit = DEFAULT_MEAL_LIMIT,
  } = input;

  const newNet = resolveNewNet(mode, value, currentNet);
  const netIncrease = round2(newNet - currentNet);

  // Yemək pulu paylanması yalnız müsbət artımda tətbiq olunur.
  const meal = applyMealAllowance(currentMeal, netIncrease, mealLimit);

  // Maaş (gross) hissəsinə düşən net:
  //  - müsbət artımda: cari maaş net + yemək pulundan sonra qalan hissə
  //  - artım yoxdursa/azalırsa: birbaşa yeni net (yemək pulu sabit)
  const currentSalaryNet = round2(currentNet - currentMeal);
  const newSalaryNet =
    netIncrease > 0
      ? round2(currentSalaryNet + meal.netToSalary)
      : round2(newNet - currentMeal);

  const newGross = solveGross(newSalaryNet, ctx);
  const newSuperGross = superGross(newGross, ctx);

  const deltaGrossMonthly = round2(newGross - currentGross);
  const deltaGrossAnnual = round2(deltaGrossMonthly * effectiveMonths);

  return {
    newNet,
    newGross,
    newSuperGross,
    newMeal: netIncrease > 0 ? meal.newMeal : currentMeal,
    deltaGrossMonthly,
    deltaGrossAnnual,
  };
}

/** Verilmiş grossun netini yoxlamaq üçün köməkçi (test/UI üçün). */
export function verifyNet(gross: number, ctx: CompContext): number {
  return getDeductions(gross, ctx).net;
}
