import { describe, it, expect } from 'vitest';
import {
  getDeductions,
  getEmployerCosts,
  solveGross,
  superGross,
  computeIncrease,
  compaRatio,
  rangePenetration,
  bandPosition,
  validateAgainstBand,
  type CompContext,
} from './engine';

const ctx: CompContext = {
  sector: 'private',
  workplace: 'main',
  year: '2026',
  benefit: 200,
  unionPct: 0,
};

describe('getDeductions (private 2026, main)', () => {
  it('gross=1000 üçün tutulmaları düzgün hesablayır', () => {
    const d = getDeductions(1000, ctx);
    // taxable=800 → tax=(800-200)*0.03=18
    expect(d.tax).toBeCloseTo(18, 2);
    // DSMF=6+(1000-200)*0.10=86
    expect(d.dsmf).toBeCloseTo(86, 2);
    // İşsizlik=1000*0.005=5
    expect(d.unemployment).toBeCloseTo(5, 2);
    // Tibbi=1000*0.02=20
    expect(d.medical).toBeCloseTo(20, 2);
    expect(d.total).toBeCloseTo(129, 2);
    expect(d.net).toBeCloseTo(871, 2);
  });

  it('güzəşt altında (gross=150) vergi 0', () => {
    const d = getDeductions(150, ctx);
    expect(d.tax).toBe(0);
  });

  it('HİK faizi tutulmaya əlavə olunur', () => {
    const d = getDeductions(1000, { ...ctx, unionPct: 1 });
    expect(d.union).toBeCloseTo(10, 2);
  });
});

describe('getEmployerCosts (private 2026)', () => {
  it('gross=1000 üçün işəgötürən xərci', () => {
    const e = getEmployerCosts(1000, ctx);
    expect(e.dsmf).toBeCloseTo(164, 2); // 44+(1000-200)*0.15
    expect(e.medical).toBeCloseTo(20, 2); // 1000*0.02
    expect(e.unemployment).toBeCloseTo(5, 2); // 1000*0.005 — BirCalc-da işəgötürən xərcinə daxildir
    expect(e.total).toBeCloseTo(189, 2);
  });
});

describe('superGross', () => {
  it('gross + işəgötürən xərci', () => {
    expect(superGross(1000, ctx)).toBeCloseTo(1189, 2);
  });
});

describe('solveGross — round-trip (SRS §11.4 acceptance)', () => {
  for (const net of [500, 871, 1500, 3000, 9000]) {
    it(`net=${net} → gross → net eyni qalır`, () => {
      const gross = solveGross(net, ctx);
      const back = getDeductions(gross, ctx).net;
      expect(back).toBeCloseTo(net, 1);
    });
  }

  it('net=871 üçün gross≈1000', () => {
    expect(solveGross(871, ctx)).toBeCloseTo(1000, 0);
  });

  it('gross net-dən böyükdür (tutulma müsbətdir)', () => {
    expect(solveGross(1000, ctx)).toBeGreaterThan(1000);
  });
});

describe('computeIncrease — BirCalc yemək pulu məntiqi (SRS §11.7)', () => {
  it('artım limitə sığırsa gross praktiki dəyişmir, hamısı yemək puluna gedir', () => {
    const r = computeIncrease({ currentGross: 1000, currentMeal: 0, increaseNet: 50, ctx });
    expect(r.newMeal).toBe(50);
    expect(r.status).toBe('Gross dəyişmir');
    expect(r.newGross).toBeCloseTo(1000, 1);
  });

  it('yemək + artım limiti keçirsə yemək 100-ə çatdırılır, qalan grossa keçir', () => {
    const r = computeIncrease({ currentGross: 1000, currentMeal: 50, increaseNet: 200, ctx });
    expect(r.newMeal).toBe(100);
    expect(r.status).toBe('Yemək 100-ə çatdırıldı');
    expect(r.newGross).toBeGreaterThan(1000);
  });

  it('gross artımı minimumdan azdırsa yemək pulu azaldılır (filial 20 AZN)', () => {
    const r = computeIncrease({
      currentGross: 1000,
      currentMeal: 100,
      increaseNet: 10,
      ctx,
      office: 'branch',
    });
    expect(r.status).toContain('Gross minimumu');
    expect(r.newGross - 1000).toBeGreaterThanOrEqual(20 - 0.01);
    expect(r.newMeal).toBeLessThan(100);
  });

  it('baş ofisdə minimum 50 AZN-dir', () => {
    const r = computeIncrease({
      currentGross: 1000,
      currentMeal: 100,
      increaseNet: 10,
      ctx,
      office: 'hq',
    });
    expect(r.status).toContain('50');
    expect(r.newGross - 1000).toBeGreaterThanOrEqual(50 - 0.01);
  });

  it('artım yoxdursa ümumi net qorunur', () => {
    const r = computeIncrease({ currentGross: 1000, currentMeal: 100, increaseNet: 0, ctx });
    expect(r.newMeal).toBe(100);
    expect(r.newTotalNet).toBeCloseTo(r.currentTotalNet, 2);
    expect(r.status).toBe('Artım yoxdur');
  });

  it('yeni ümumi net həmişə cari + artıma bərabərdir', () => {
    for (const inc of [0, 25, 100, 137.5, 400]) {
      const r = computeIncrease({ currentGross: 1500, currentMeal: 40, increaseNet: inc, ctx });
      expect(r.newTotalNet).toBeCloseTo(r.currentTotalNet + inc, 2);
    }
  });
});

describe('sektor fərqləri (BirCalc)', () => {
  it('dövlət sektorunda 2026 DSMF gross×3%-dir', () => {
    const d = getDeductions(1000, { ...ctx, sector: 'public' });
    expect(d.dsmf).toBeCloseTo(30, 2);
  });

  it('əlavə iş yerində ilk pillə 3%-dir (güzəştsiz)', () => {
    const d = getDeductions(300, { ...ctx, workplace: 'secondary' });
    // taxable = 300 - 200 = 100 → 100 * 0.03 = 3
    expect(d.tax).toBeCloseTo(3, 2);
  });

  it('texnoparkda gəlir vergisi 5%-dir', () => {
    const d = getDeductions(1000, { ...ctx, sector: 'texnopark' });
    // (1000 - 200) * 0.05 = 40
    expect(d.tax).toBeCloseTo(40, 2);
  });

  it('işəgötürən xərcinə işsizlik sığortası (0.5%) daxildir', () => {
    const c = getEmployerCosts(1000, ctx);
    expect(c.unemployment).toBeCloseTo(5, 2);
    expect(c.total).toBeCloseTo(c.dsmf + c.medical + c.unemployment, 2);
  });

  it('texnoparkda işəgötürən DSMF yoxdur', () => {
    const c = getEmployerCosts(1000, { ...ctx, sector: 'texnopark' });
    expect(c.dsmf).toBe(0);
    expect(c.total).toBeCloseTo(5 + 20, 2);
  });
});

describe('compa-ratio & band (SRS §6.3)', () => {
  it('compaRatio', () => {
    expect(compaRatio(1000, 1000)).toBe(1);
    expect(compaRatio(800, 1000)).toBe(0.8);
  });
  it('rangePenetration', () => {
    expect(rangePenetration(1000, 500, 1500)).toBe(0.5);
  });
  it('bandPosition', () => {
    expect(bandPosition(0.7)).toBe('below');
    expect(bandPosition(1.0)).toBe('at');
    expect(bandPosition(1.5)).toBe('above');
  });
});

describe('validateAgainstBand (SRS §6.2)', () => {
  it('max aşıldıqda ERROR (bloklama)', () => {
    const v = validateAgainstBand(2000, { min: 800, max: 1500 });
    expect(v.ok).toBe(false);
    expect(v.level).toBe('error');
  });
  it('min altında WARN', () => {
    const v = validateAgainstBand(500, { min: 800, max: 1500 });
    expect(v.ok).toBe(true);
    expect(v.level).toBe('warn');
  });
  it('band daxilində ok', () => {
    expect(validateAgainstBand(1000, { min: 800, max: 1500 }).level).toBe('ok');
  });
});
