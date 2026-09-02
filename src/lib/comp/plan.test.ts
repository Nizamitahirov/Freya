import { describe, it, expect } from 'vitest';
import { planCompensation, resolveNewNet } from './plan';
import type { CompContext } from './engine';

const ctx: CompContext = {
  sector: 'private',
  workplace: 'main',
  year: '2026',
  benefit: 200,
  unionPct: 0,
};

describe('resolveNewNet (SRS §9.1)', () => {
  it('faizlə artım', () => {
    expect(resolveNewNet('percent', 10, 1000)).toBe(1100);
  });
  it('məbləğlə artım', () => {
    expect(resolveNewNet('amount', 150, 1000)).toBe(1150);
  });
  it('mütləq yeni net', () => {
    expect(resolveNewNet('absolute', 1200, 1000)).toBe(1200);
  });
});

describe('planCompensation (SRS §9.1 + §11.7 + §7.3)', () => {
  it('yemək pulu limitinə sığan artım grossu dəyişmir (SRS §11.7)', () => {
    const r = planCompensation({
      mode: 'amount',
      value: 100,
      currentNet: 871,
      currentGross: 1000,
      currentMeal: 0,
      ctx,
      mealLimit: 100,
      effectiveMonths: 12,
    });
    expect(r.newMeal).toBe(100);
    expect(r.deltaGrossMonthly).toBeCloseTo(0, 0);
    expect(r.deltaGrossAnnual).toBeCloseTo(0, 0);
  });

  it('limiti keçən artım grossa keçir və büdcəni azaldır', () => {
    const r = planCompensation({
      mode: 'amount',
      value: 50,
      currentNet: 951, // 871 salary + 80 meal
      currentGross: 1000,
      currentMeal: 80,
      ctx,
      mealLimit: 100,
      effectiveMonths: 12,
    });
    expect(r.newMeal).toBe(100);
    expect(r.deltaGrossMonthly).toBeGreaterThan(0);
    // İllik = aylıq × 12
    expect(r.deltaGrossAnnual).toBeCloseTo(r.deltaGrossMonthly * 12, 1);
  });

  it('effektiv aylar büdcə təsirini miqyaslayır', () => {
    const full = planCompensation({
      mode: 'absolute', value: 1200, currentNet: 871, currentGross: 1000,
      currentMeal: 0, ctx, mealLimit: 0, effectiveMonths: 12,
    });
    const half = planCompensation({
      mode: 'absolute', value: 1200, currentNet: 871, currentGross: 1000,
      currentMeal: 0, ctx, mealLimit: 0, effectiveMonths: 6,
    });
    expect(half.deltaGrossAnnual).toBeCloseTo(full.deltaGrossAnnual / 2, 1);
  });

  it('yeni gross verilmiş yeni net-i geri qaytarır (round-trip)', () => {
    const r = planCompensation({
      mode: 'absolute', value: 1500, currentNet: 871, currentGross: 1000,
      currentMeal: 0, ctx, mealLimit: 0, effectiveMonths: 12,
    });
    // meal 0 olduğu üçün bütün net maaşa gedir → newNet ≈ newGross netini verir
    expect(r.newNet).toBe(1500);
  });
});
