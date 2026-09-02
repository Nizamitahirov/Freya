/**
 * engine.ts — Hesablama motorunun ÜRƏYİ (SRS §11).
 *
 * ⚠️ Bu fayldakı düsturlar **Mycalcpro / BirCalc** (`Nizamitahirov/Mycalcpro`,
 * `index.html`) mənbəyindən BİRƏ-BİR köçürülüb. Dəyişiklik etmək lazım gəlsə,
 * əvvəlcə həmin mənbədə düzəldilməli, sonra bura köçürülməlidir — iki tərəf
 * `npm run parity` skripti ilə avtomatik tutuşdurulur.
 *
 * Uyğunluq cədvəli (Freya → BirCalc):
 *   sector 'private'   → 'private'
 *   sector 'public'    → 'state'
 *   sector 'texnopark' → 'texnopark'
 *
 * Bütün funksiyalar PURE-dur (yan təsirsiz, deterministik).
 */

import {
  DEFAULT_MEAL_LIMIT,
  MIN_GROSS_DIFF,
  SOLVE_GROSS_ITERATIONS,
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
  /** Texnopark rezidenti üçün işçi tipi (BirCalc `type`). Default: 'local'. */
  texnoparkType?: 'local' | 'expat';
};

/** İşçi tutulmalarının bölgüsü. */
export type Deductions = {
  tax: number; // gəlir vergisi
  dsmf: number; // pensiya (DSMF)
  unemployment: number; // işsizlik sığortası
  medical: number; // tibbi sığorta (İTS)
  union: number; // HİK
  taxable: number; // vergi tutulan baza
  total: number;
  net: number; // gross − total
};

/** İşəgötürən əlavə xərcləri. */
export type EmployerCosts = {
  dsmf: number;
  unemployment: number;
  medical: number;
  total: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─────────────────────── Texnopark tutulmaları (BirCalc) ─────────────────────

/**
 * `getDeductionsTexnopar(gross, type, unionPct)` — BirCalc.
 * Gəlir vergisi 5%: gross ≤ 2500 olduqda (gross − 200) bazasından, əks halda tam grossdan.
 */
function texnoparkDeductions(gross: number, type: 'local' | 'expat', unionPct: number) {
  const tax = gross <= 2500 ? Math.max(0, gross - 200) * 0.05 : gross * 0.05;
  const dsmf = type === 'expat' ? 0 : gross <= 200 ? gross * 0.03 : 6 + (gross - 200) * 0.1;
  const unemployment = gross * 0.005;
  const medical = gross <= 2500 ? gross * 0.02 : 50 + (gross - 2500) * 0.005;
  const union = gross * (unionPct / 100);
  return {
    tax,
    dsmf,
    unemployment,
    medical,
    union,
    total: tax + dsmf + unemployment + medical + union,
  };
}

// ───────────────────────── İşçi tutulmaları (SRS §11.2) ──────────────────────

type RawDeductions = {
  tax: number;
  dsmf: number;
  unemployment: number;
  medical: number;
  union: number;
  taxable: number;
  total: number;
};

/**
 * `getDeductions(gross, benefit, unionPct, workplace, sector, year)` — BirCalc.
 * Yuvarlaqlaşdırılmamış nəticə: solveGross bunun üzərində işləyir (BirCalc-da da belədir).
 */
function rawDeductions(gross: number, ctx: CompContext): RawDeductions {
  const { sector, workplace, year, benefit, unionPct } = ctx;
  const union = gross * (unionPct / 100);

  if (sector === 'texnopark') {
    const r = texnoparkDeductions(gross, ctx.texnoparkType ?? 'local', unionPct);
    return {
      ...r,
      taxable: gross <= 2500 ? Math.max(0, gross - 200) : gross,
    };
  }

  let tax = 0;
  let dsmf = 0;
  let medical: number;
  const unemployment = gross * 0.005;
  const taxable = Math.max(0, gross - benefit);

  if (sector === 'private' && year === '2026') {
    if (workplace === 'main') {
      if (taxable <= 200) tax = 0;
      else if (taxable <= 2500) tax = (taxable - 200) * 0.03;
      else if (taxable <= 8000) tax = 75 + (taxable - 2500) * 0.1;
      else tax = 625 + (taxable - 8000) * 0.14;
    } else {
      // Əlavə iş yeri: 200 AZN-lik güzəştli pillə yoxdur, ilk pillə birbaşa 3%.
      if (taxable <= 2500) tax = taxable * 0.03;
      else if (taxable <= 8000) tax = 75 + (taxable - 2500) * 0.1;
      else tax = 625 + (taxable - 8000) * 0.14;
    }
    dsmf = gross <= 200 ? gross * 0.03 : 6 + (gross - 200) * 0.1;
    medical = gross <= 2500 ? gross * 0.02 : 50 + (gross - 2500) * 0.005;
  } else if (sector === 'private') {
    // 2025 və əvvəli
    tax = taxable > 8000 ? (taxable - 8000) * 0.14 : 0;
    dsmf = gross <= 200 ? gross * 0.03 : 6 + (gross - 200) * 0.1;
    medical = gross <= 8000 ? gross * 0.02 : 160 + (gross - 8000) * 0.005;
  } else {
    // Dövlət sektoru (BirCalc: 'state')
    const bt = workplace === 'main' ? Math.max(0, taxable - 200) : taxable;
    tax = bt <= 2500 ? bt * 0.14 : 350 + (bt - 2500) * 0.25;
    if (year === '2026') {
      dsmf = gross * 0.03;
      medical = gross <= 2500 ? gross * 0.02 : 50 + (gross - 2500) * 0.005;
    } else {
      dsmf = gross <= 200 ? gross * 0.03 : 6 + (gross - 200) * 0.1;
      medical = gross <= 8000 ? gross * 0.02 : 160 + (gross - 8000) * 0.005;
    }
  }

  return {
    tax,
    dsmf,
    unemployment,
    medical,
    union,
    taxable,
    total: tax + dsmf + unemployment + medical + union,
  };
}

/** İşçi tutulmaları — yuvarlaqlaşdırılmış (UI üçün). */
export function getDeductions(gross: number, ctx: CompContext): Deductions {
  const r = rawDeductions(gross, ctx);
  return {
    tax: round2(r.tax),
    dsmf: round2(r.dsmf),
    unemployment: round2(r.unemployment),
    medical: round2(r.medical),
    union: round2(r.union),
    taxable: round2(r.taxable),
    total: round2(r.total),
    net: round2(gross - r.total),
  };
}

// ──────────────────── İşəgötürən xərcləri (SRS §11.3) ────────────────────────

/**
 * `getEmployerCosts(gross, sector, year)` — BirCalc.
 * DİQQƏT: işsizlik sığortası (0.5%) işəgötürən xərcinə DAXİLDİR.
 */
export function getEmployerCosts(gross: number, ctx: CompContext): EmployerCosts {
  const { sector, year } = ctx;
  const unemployment = gross * 0.005;
  let dsmf = 0;
  let medical: number;

  if (sector === 'texnopark') {
    // Texnopark: işəgötürən DSMF yoxdur.
    medical = gross <= 2500 ? gross * 0.02 : 50 + (gross - 2500) * 0.005;
    return {
      dsmf: 0,
      unemployment: round2(unemployment),
      medical: round2(medical),
      total: round2(unemployment + medical),
    };
  }

  if (sector === 'public') {
    dsmf = gross * 0.22;
    medical = gross <= 8000 ? gross * 0.02 : 160 + (gross - 8000) * 0.005;
  } else if (year === '2026') {
    if (gross <= 200) dsmf = gross * 0.22;
    else if (gross <= 8000) dsmf = 44 + (gross - 200) * 0.15;
    else dsmf = 1214 + (gross - 8000) * 0.11;
    medical = gross <= 2500 ? gross * 0.02 : 50 + (gross - 2500) * 0.005;
  } else {
    dsmf = gross <= 200 ? gross * 0.22 : 44 + (gross - 200) * 0.15;
    medical = gross <= 8000 ? gross * 0.02 : 160 + (gross - 8000) * 0.005;
  }

  return {
    dsmf: round2(dsmf),
    unemployment: round2(unemployment),
    medical: round2(medical),
    total: round2(dsmf + unemployment + medical),
  };
}

// ─────────────────────────── Net → Gross (SRS §11.4) ─────────────────────────

/**
 * `solveGross(targetNett, ...)` — BirCalc binary search (38 iterasiya, `high` qaytarır).
 * Yuvarlaqlaşdırma YALNIZ sonda tətbiq olunur ki, nəticə BirCalc ilə eyni olsun.
 */
export function solveGrossRaw(targetNet: number, ctx: CompContext): number {
  if (targetNet <= 0) return 0;
  let low = targetNet;
  let high = ctx.sector === 'texnopark' ? Math.max(targetNet * 3, targetNet + 100) : targetNet * 3;
  for (let i = 0; i < SOLVE_GROSS_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    if (mid - rawDeductions(mid, ctx).total < targetNet) low = mid;
    else high = mid;
  }
  return high;
}

export function solveGross(targetNet: number, ctx: CompContext): number {
  return round2(solveGrossRaw(targetNet, ctx));
}

/** Gross-dan net (yuvarlaqlaşdırılmamış — BirCalc `tpNetFromGross`). */
export function netFromGrossRaw(gross: number, ctx: CompContext): number {
  return gross - rawDeductions(gross, ctx).total;
}

/** Gross-dan net (yuvarlaqlaşdırılmış). */
export function grossToNet(gross: number, ctx: CompContext): number {
  return round2(netFromGrossRaw(gross, ctx));
}

/** SuperGross — şirkətin bir əməkdaşa tam aylıq xərci (SRS §11.5). */
export function superGross(gross: number, ctx: CompContext): number {
  return round2(gross + getEmployerCosts(gross, ctx).total);
}

// ───────────────────── Yemək pulu + artım məntiqi (SRS §11.7) ────────────────

export type IncreaseInput = {
  currentGross: number;
  currentMeal: number;
  /** Net artım məbləği (yemək pulu daxil olmaqla ümumi net üzərinə). */
  increaseNet: number;
  ctx: CompContext;
  /** Baş ofis üçün min gross artımı 50, filial üçün 20 (BirCalc `isHead`). */
  office?: 'hq' | 'branch';
  /** Yemək pulu limiti (default 100). */
  mealLimit?: number;
};

export type IncreaseResult = {
  /** Cari maaş neti (yemək pulusuz). */
  currentSalaryNet: number;
  /** Cari ümumi net (maaş neti + yemək pulu). */
  currentTotalNet: number;
  /** Yeni ümumi net (maaş neti + yemək pulu). */
  newTotalNet: number;
  newGross: number;
  newMeal: number;
  status: string;
};

/**
 * `mgComputeOne(curGross, curMeal, incNet, isHead, p)` — BirCalc "Maaş artımı" məntiqi.
 *
 *  1. artım yoxdursa    → yemək pulu yuvarlaqlaşır, gross ümumi neti saxlayacaq şəkildə tapılır
 *  2. yemək + artım ≤ limit → artımın hamısı yemək puluna gedir, gross praktiki dəyişmir
 *  3. limiti keçirsə    → yemək limitə çatdırılır, qalan gross-a keçir;
 *     əgər gross artımı minimumdan (baş ofis 50 / filial 20 AZN) azdırsa,
 *     yemək pulu azaldılır ki, minimum təmin olunsun.
 */
export function computeIncrease(input: IncreaseInput): IncreaseResult {
  const { ctx } = input;
  const mealLimit = input.mealLimit ?? DEFAULT_MEAL_LIMIT;
  const minGrossInc = input.office === 'hq' ? MIN_GROSS_DIFF.hq : MIN_GROSS_DIFF.branch;

  const currentGross = Math.max(0, input.currentGross);
  const currentMeal = Math.max(0, input.currentMeal);
  const increaseNet = Math.max(0, input.increaseNet);

  if (currentGross <= 0) {
    return {
      currentSalaryNet: 0,
      currentTotalNet: 0,
      newTotalNet: 0,
      newGross: 0,
      newMeal: 0,
      status: 'Cari gross daxil edilməyib',
    };
  }

  const currentSalaryNet = netFromGrossRaw(currentGross, ctx);
  const currentTotalNet = currentSalaryNet + currentMeal;
  const newTotalNet = currentTotalNet + increaseNet;
  const solve = (baseNet: number) => (baseNet > 0 ? solveGrossRaw(baseNet, ctx) : 0);

  let newMeal: number;
  let newGross: number;
  let status: string;

  if (increaseNet === 0) {
    newMeal = Math.round(currentMeal);
    newGross = solve(newTotalNet - newMeal);
    status = 'Artım yoxdur';
  } else if (currentMeal + increaseNet <= mealLimit) {
    // Yemək pulu artımı tam udur; tam ədədə yuvarlaqlaşır, qalıq grossa keçir.
    newMeal = Math.round(currentMeal + increaseNet);
    newGross = solve(newTotalNet - newMeal);
    status = 'Gross dəyişmir';
  } else {
    newMeal = mealLimit;
    newGross = solve(newTotalNet - newMeal);

    if (newGross - currentGross < minGrossInc) {
      // Minimum gross fərqini təmin etmək üçün yemək pulunu azaldırıq.
      const minNewGross = currentGross + minGrossInc;
      const minNewBaseNet = netFromGrossRaw(minNewGross, ctx);
      newMeal = Math.max(0, Math.min(mealLimit, Math.floor(newTotalNet - minNewBaseNet)));
      newGross = solve(newTotalNet - newMeal);
      status = `Gross minimumu (${minGrossInc} AZN) tətbiq edildi`;
    } else {
      status = `Yemək ${mealLimit}-ə çatdırıldı`;
    }
  }

  return {
    currentSalaryNet: round2(currentSalaryNet),
    currentTotalNet: round2(currentTotalNet),
    newTotalNet: round2(newTotalNet),
    newGross: round2(newGross),
    newMeal,
    status,
  };
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

/** Band mövqeyi (SRS §6.3): <0.8 below, 0.8–1.2 at, >1.2 above. */
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
 * validateAgainstBand(newGross, band) (SRS §6.2).
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
