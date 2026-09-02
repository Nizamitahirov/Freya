/**
 * plan.ts — Per-employee planlaşdırma hesablaması (SRS §9.1).
 *
 * Rəhbərin girişini (faiz / məbləğ / mütləq net) **net artımına** çevirir və
 * BirCalc-ın "Maaş artımı" məntiqini (`computeIncrease`) tətbiq edir:
 * yemək pulu limitə qədər doldurulur, qalan gross-a keçir, minimum gross fərqi
 * (baş ofis 50 / filial 20 AZN) təmin olunur.
 *
 * ⚠️ Bütün rəqəmlər `engine.ts`-dəki BirCalc düsturları ilə hesablanır.
 */

import {
  computeIncrease,
  getEmployerCosts,
  netFromGrossRaw,
  superGross,
  type CompContext,
} from './engine';
import { DEFAULT_MEAL_LIMIT } from './taxConfig';

export type InputMode = 'percent' | 'amount' | 'absolute';

export type PlanInput = {
  mode: InputMode;
  /** percent → faiz; amount → net artım məbləği; absolute → birbaşa yeni ümumi net. */
  value: number;
  /** Əməkdaşın cari ümumi neti (maaş neti + yemək pulu) — yalnız arayış üçün. */
  currentNet: number;
  currentGross: number;
  currentMeal: number;
  ctx: CompContext;
  mealLimit?: number;
  /** Baş ofis / filial — minimum gross fərqi üçün (BirCalc `isHead`). */
  office?: 'hq' | 'branch';
  /** Effektiv tarixdən ilin sonuna qədər ay sayı (büdcə üçün). */
  effectiveMonths: number;
};

export type PlanResult = {
  /** Yeni ümumi net (maaş neti + yemək pulu). */
  newNet: number;
  newGross: number;
  newSuperGross: number;
  newMeal: number;
  /** Cari ümumi net — grossdan yenidən hesablanmış (mənbə həqiqəti). */
  currentTotalNet: number;
  /** Tətbiq olunan net artımı. */
  increaseNet: number;
  /** Aylıq gross fərqi. */
  deltaGrossMonthly: number;
  /** İllik (effektiv aylar × aylıq) gross fərqi — büdcə təsiri. */
  deltaGrossAnnual: number;
  /** BirCalc statusu: "Gross dəyişmir" / "Yemək 100-ə çatdırıldı" / "Gross minimumu…" */
  status: string;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Giriş üsulunu net artımına çevirir (SRS §9.1).
 * Baza — grossdan hesablanmış cari ümumi net (maaş neti + yemək pulu).
 */
export function resolveIncrease(
  mode: InputMode,
  value: number,
  currentTotalNet: number,
): number {
  switch (mode) {
    case 'percent':
      return round2((currentTotalNet * value) / 100);
    case 'amount':
      return round2(value);
    case 'absolute':
      return round2(value - currentTotalNet);
  }
}

/** Giriş üsuluna görə yeni ümumi net (geriyə uyğunluq üçün köməkçi). */
export function resolveNewNet(mode: InputMode, value: number, currentNet: number): number {
  return round2(currentNet + resolveIncrease(mode, value, currentNet));
}

/**
 * Tam planlaşdırma hesablaması (SRS §9.1 + §11.7 + §7.3) — BirCalc məntiqi ilə.
 */
export function planCompensation(input: PlanInput): PlanResult {
  const {
    mode,
    value,
    currentGross,
    currentMeal,
    ctx,
    effectiveMonths,
    mealLimit = DEFAULT_MEAL_LIMIT,
    office = 'branch',
  } = input;

  // Cari ümumi net həmişə grossdan yenidən hesablanır (BirCalc `tpNetFromGross`).
  const currentTotalNet = round2(netFromGrossRaw(currentGross, ctx) + currentMeal);
  const increaseNet = resolveIncrease(mode, value, currentTotalNet);

  const result = computeIncrease({
    currentGross,
    currentMeal,
    increaseNet,
    ctx,
    office,
    mealLimit,
  });

  const newGross = result.newGross;
  const deltaGrossMonthly = round2(newGross - currentGross);

  return {
    newNet: result.newTotalNet,
    newGross,
    newSuperGross: superGross(newGross, ctx),
    newMeal: result.newMeal,
    currentTotalNet: result.currentTotalNet,
    increaseNet,
    deltaGrossMonthly,
    deltaGrossAnnual: round2(deltaGrossMonthly * effectiveMonths),
    status: result.status,
  };
}

/** Verilmiş grossun netini yoxlamaq üçün köməkçi (test/UI üçün). */
export function verifyNet(gross: number, ctx: CompContext): number {
  return round2(netFromGrossRaw(gross, ctx));
}

/** Şirkətin bir əməkdaşa tam aylıq xərci — arayış üçün. */
export function totalEmployerCost(gross: number, ctx: CompContext): number {
  return round2(gross + getEmployerCosts(gross, ctx).total);
}
