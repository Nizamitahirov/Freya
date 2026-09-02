/**
 * engine.ts — Hesablama motorunun ÜRƏYİ (SRS §11).
 *
 * Bütün funksiyalar PURE-dur (yan təsirsiz, deterministik) və unit-testlə örtülür.
 * Gradex "engine is the heart" pattern-i: UI, store və server hamısı bura söykənir.
 *
 * Net ↔ Gross ↔ SuperGross + Yemək pulu məntiqi burada cəmlənir.
 */

import {
  taxConfig,
  DEFAULT_BENEFIT,
  DEFAULT_MEAL_LIMIT,
  SOLVE_GROSS_ITERATIONS,
  type Bracket,
  type Sector,
  type Workplace,
  type TaxYear,
} from './taxConfig';

export type { Sector, Workplace, TaxYear };

/** Hesablama konteksti (SRS §11.1). */
export type CompContext = {
  sector: Sector;
  workplace: Workplace; // əsas / əlavə iş yeri
  year: TaxYear;
  benefit: number; // VM 102 vergi güzəşti (məs. 200)
  unionPct: number; // HİK faizi (0..100)
};

/** İşçi tutulmalarının bölgüsü. */
export type Deductions = {
  tax: number; // gəlir vergisi
  dsmf: number; // pensiya (DSMF)
  unemployment: number; // işsizlik sığortası
  medical: number; // tibbi sığorta (İTS)
  union: number; // HİK
  total: number;
  net: number; // gross − total
};

/** İşəgötürən əlavə xərcləri. */
export type EmployerCosts = {
  dsmf: number;
  medical: number;
  total: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Pilləli (bracket) tutulmanı hesablayır.
 * Hər bracket: `amount` dəyəri onun `from`..`up` intervalına düşdükdə
 * `base + (amount − from) × rate` verir.
 */
function evalBrackets(amount: number, brackets: Bracket[]): number {
  if (amount <= 0) return 0;
  for (const b of brackets) {
    if (amount <= b.up) {
      return b.base + (amount - b.from) * b.rate;
    }
  }
  // Sonuncu bracket Infinity ilə bitdiyi üçün bura düşməməlidir.
  const last = brackets[brackets.length - 1];
  return last.base + (amount - last.from) * last.rate;
}

/**
 * İşçi tutulmaları — getDeductions(gross, ctx)  (SRS §11.2).
 *
 * Verilmiş gross-dan bütün tutulmaları çıxarıb net-i qaytarır.
 */
export function getDeductions(gross: number, ctx: CompContext): Deductions {
  const { sector, workplace, year, benefit, unionPct } = ctx;

  // Vergi tutulan baza (taxable):
  //  - private/texnopark main → gross − güzəşt (VM102); secondary → güzəşt yoxdur
  //  - public → main: gross − 200; secondary: gross
  let taxable: number;
  if (sector === 'public') {
    taxable = workplace === 'main' ? Math.max(0, gross - DEFAULT_BENEFIT) : gross;
  } else {
    taxable = workplace === 'main' ? Math.max(0, gross - benefit) : gross;
  }

  const tax = evalBrackets(taxable, taxConfig.incomeTax[sector][year]);

  // DSMF, tibbi — texnopark üçün də private cədvəli tətbiq olunur.
  const dsmfTable =
    sector === 'texnopark' ? taxConfig.employeeDSMF[year] : taxConfig.employeeDSMF[year];
  const dsmf = evalBrackets(gross, dsmfTable);

  const unemployment = gross * taxConfig.employeeUnemployment.rate;

  const medical = evalBrackets(gross, taxConfig.employeeMedical[year]);

  const union = gross * (unionPct / 100);

  const total = tax + dsmf + unemployment + medical + union;
  const net = gross - total;

  return {
    tax: round2(tax),
    dsmf: round2(dsmf),
    unemployment: round2(unemployment),
    medical: round2(medical),
    union: round2(union),
    total: round2(total),
    net: round2(net),
  };
}

/**
 * İşəgötürən xərcləri — getEmployerCosts(gross, ctx)  (SRS §11.3).
 */
export function getEmployerCosts(gross: number, ctx: CompContext): EmployerCosts {
  const year = ctx.year;
  // Texnopark üçün də private profili baza kimi götürülür.
  const dsmf = evalBrackets(gross, taxConfig.employerDSMF[year]);
  const medical = evalBrackets(gross, taxConfig.employerMedical[year]);
  const total = dsmf + medical;
  return { dsmf: round2(dsmf), medical: round2(medical), total: round2(total) };
}

/**
 * Net → Gross — solveGross(targetNet, ctx)  (SRS §11.4).
 *
 * Binary search: verilmiş net-i verən gross-u tapır (~1e-6 presisiya, 38 iterasiya).
 */
export function solveGross(targetNet: number, ctx: CompContext): number {
  if (targetNet <= 0) return 0;
  let low = targetNet;
  let high = targetNet * 3;
  for (let i = 0; i < SOLVE_GROSS_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    const d = getDeductions(mid, ctx);
    if (mid - d.total < targetNet) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return round2(high);
}

/**
 * SuperGross — şirkətin bir əməkdaşa tam aylıq xərci  (SRS §11.5).
 */
export function superGross(gross: number, ctx: CompContext): number {
  return round2(gross + getEmployerCosts(gross, ctx).total);
}

/** Gross-dan net-i çıxaran qısayol. */
export function grossToNet(gross: number, ctx: CompContext): number {
  return getDeductions(gross, ctx).net;
}

// ───────────────────────────── Yemək pulu (SRS §11.7) ────────────────────────

export type MealResult = {
  /** Yeni yemək pulu (limitə çatdırılmış). */
  newMeal: number;
  /** Net artımın yemək puluna gedən hissəsi. */
  netToMeal: number;
  /** Net artımın maaşa (grossa çevriləcək net) gedən hissəsi. */
  netToSalary: number;
};

/**
 * Yemək pulu paylanması (SRS §11.7).
 *
 * Net artım əvvəlcə yemək puluna doldurulur (limitə qədər), qalan hissə maaşa (grossa) gedir.
 *
 *  - cari yemək + net artım ≤ limit  → hamısı yemək puluna, maaş dəyişmir.
 *  - limiti keçirsə → yemək limitə çatdırılır, qalan hissə maaşa (net) əlavə olunur.
 */
export function applyMealAllowance(
  currentMeal: number,
  netIncrease: number,
  mealLimit: number = DEFAULT_MEAL_LIMIT,
): MealResult {
  const capped = Math.min(mealLimit, currentMeal + Math.max(0, netIncrease));
  const netToMeal = round2(capped - currentMeal);
  const netToSalary = round2(Math.max(0, netIncrease) - netToMeal);
  return { newMeal: round2(capped), netToMeal, netToSalary };
}

// ───────────────────────── Compa-ratio & range (SRS §6.3) ────────────────────

export type BandPosition = 'below' | 'at' | 'above';

/** compaRatio = gross / band.mid */
export function compaRatio(gross: number, bandMid: number): number {
  if (bandMid <= 0) return 0;
  return round2(gross / bandMid);
}

/** rangePenetration = (gross − min) / (max − min) */
export function rangePenetration(gross: number, bandMin: number, bandMax: number): number {
  const span = bandMax - bandMin;
  if (span <= 0) return 0;
  return round2((gross - bandMin) / span);
}

/** Band mövqeyi rəngli göstərici üçün (SRS §6.3): <0.8 below, 0.8–1.2 at, >1.2 above. */
export function bandPosition(ratio: number): BandPosition {
  if (ratio < 0.8) return 'below';
  if (ratio > 1.2) return 'above';
  return 'at';
}

// ───────────────────────── Band validasiyası (SRS §6.2) ──────────────────────

export type BandValidation = {
  ok: boolean;
  level: 'error' | 'warn' | 'ok';
  message?: string;
};

/**
 * validateAgainstBand(newGross, band)  (SRS §6.2).
 *  - newGross > band.max → ERROR (sərt bloklama)
 *  - newGross < band.min → WARN (below range)
 */
export function validateAgainstBand(
  newGross: number,
  band: { min: number; max: number },
): BandValidation {
  if (newGross > band.max) {
    return { ok: false, level: 'error', message: `Level max aşılıb: ${band.max}` };
  }
  if (newGross < band.min) {
    return { ok: true, level: 'warn', message: `Band altındadır (below range): ${band.min}` };
  }
  return { ok: true, level: 'ok' };
}
