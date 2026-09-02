/**
 * parity.ts — Freya engine-inin Mycalcpro/BirCalc mənbəyi ilə birə-bir uyğunluğu.
 *
 *   npm run parity            (Mycalcpro klonu ../nizamitahirov/mycalcpro-də olmalıdır)
 *   MYCALCPRO=/yol/index.html npm run parity
 *
 * Skript BirCalc funksiyalarını `index.html`-dən ÇIXARIR və işlədir, sonra eyni
 * girişləri Freya engine-inə verib nəticələri müqayisə edir. Beləliklə port
 * "əl ilə köçürülmüş kod" deyil, **yoxlanmış** port olur.
 */

import { readFileSync, existsSync } from 'node:fs';
import {
  getDeductions,
  getEmployerCosts,
  netFromGrossRaw,
  solveGrossRaw,
  computeIncrease,
  type CompContext,
} from '@/lib/comp/engine';

const SOURCE =
  process.env.MYCALCPRO ?? '/home/user/nizamitahirov/mycalcpro/index.html';

if (!existsSync(SOURCE)) {
  console.error(`Mycalcpro mənbəyi tapılmadı: ${SOURCE}`);
  console.error('Klonlayın: git clone https://github.com/Nizamitahirov/mycalcpro');
  process.exit(1);
}

const html = readFileSync(SOURCE, 'utf8');

/** `function name(...) { ... }` blokunu mötərizələri sayaraq çıxarır. */
function extract(name: string): string {
  const start = html.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`BirCalc-da funksiya tapılmadı: ${name}`);
  let depth = 0;
  let i = html.indexOf('{', start);
  const bodyStart = i;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return html.slice(start, i + 1) + `\n// (bodyStart ${bodyStart})`;
}

const NAMES = [
  'getEmployerCosts',
  'getDeductionsTexnopar',
  'getDeductions',
  'solveGross',
  'solveGrossTexnopar',
  'txNetFromGross',
  'tpNetFromGross',
  'mgComputeOne',
];

const bircalc = new Function(
  `${NAMES.map(extract).join('\n\n')}\n return { ${NAMES.join(', ')} };`,
)() as {
  getEmployerCosts: (g: number, sector: string, year: string) => { total: number };
  getDeductions: (
    g: number,
    benefit: number,
    unionPct: number,
    workplace: string,
    sector: string,
    year: string,
  ) => { total: number; tax: number; dsmf: number; unemp: number; med: number; union: number };
  solveGross: (
    net: number,
    b: number,
    u: number,
    w: string,
    s: string,
    y: string,
  ) => number;
  tpNetFromGross: (g: number, p: Record<string, unknown>) => number;
  mgComputeOne: (
    curGross: number,
    curMeal: number,
    incNet: number,
    isHead: boolean,
    p: Record<string, unknown>,
  ) => { newGross: number; newMeal: number; curNet: number; newTotalNet: number; status: string };
};

// ─────────────────────────────── Müqayisə ────────────────────────────────────

let checked = 0;
let failed = 0;
const failures: string[] = [];

const EPS = 1e-6;
function eq(label: string, mine: number, theirs: number, eps = EPS) {
  checked += 1;
  if (Math.abs(mine - theirs) > eps) {
    failed += 1;
    if (failures.length < 25) {
      failures.push(`${label}\n    Freya=${mine}\n    BirCalc=${theirs}\n    fərq=${mine - theirs}`);
    }
  }
}

/** Freya sektoru → BirCalc sektoru */
const toBir = (s: CompContext['sector']) => (s === 'public' ? 'state' : s);

const GROSSES = [
  100, 150, 200, 200.01, 250, 400, 700, 999.99, 1000, 1500, 2000, 2499.99, 2500, 2500.01,
  3000, 4000, 5500, 7999.99, 8000, 8000.01, 9000, 12000, 25000,
];
const SECTORS: CompContext['sector'][] = ['private', 'public', 'texnopark'];
const YEARS: CompContext['year'][] = ['2025', '2026'];
const WORKPLACES: CompContext['workplace'][] = ['main', 'secondary'];
const BENEFITS = [0, 200];
const UNIONS = [0, 1, 2.5];

console.log(`BirCalc mənbəyi: ${SOURCE}`);
console.log('\n1. getDeductions (işçi tutulmaları)');
for (const sector of SECTORS) {
  for (const year of YEARS) {
    for (const workplace of WORKPLACES) {
      for (const benefit of BENEFITS) {
        for (const unionPct of UNIONS) {
          for (const gross of GROSSES) {
            const ctx: CompContext = { sector, workplace, year, benefit, unionPct };
            const mine = netFromGrossRaw(gross, ctx);
            const theirs =
              gross - bircalc.getDeductions(gross, benefit, unionPct, workplace, toBir(sector), year).total;
            eq(
              `net · ${sector}/${year}/${workplace} benefit=${benefit} union=${unionPct} gross=${gross}`,
              mine,
              theirs,
            );
          }
        }
      }
    }
  }
}

console.log('2. getEmployerCosts (işəgötürən xərcləri)');
for (const sector of SECTORS) {
  for (const year of YEARS) {
    for (const gross of GROSSES) {
      const ctx: CompContext = { sector, workplace: 'main', year, benefit: 200, unionPct: 0 };
      const mine = getEmployerCosts(gross, ctx).total;
      const theirs = bircalc.getEmployerCosts(gross, toBir(sector), year).total;
      eq(`employer · ${sector}/${year} gross=${gross}`, mine, Math.round((theirs + Number.EPSILON) * 100) / 100, 0.005);
    }
  }
}

console.log('3. solveGross (net → gross)');
const NETS = [200, 500, 850, 1200, 1800, 2400, 3500, 5000, 9000];
for (const sector of SECTORS) {
  for (const year of YEARS) {
    for (const workplace of WORKPLACES) {
      for (const net of NETS) {
        const ctx: CompContext = { sector, workplace, year, benefit: 200, unionPct: 0 };
        const mine = solveGrossRaw(net, ctx);
        const theirs =
          sector === 'texnopark'
            ? // BirCalc texnopark üçün solveGross-u getDeductions vasitəsilə çağırır
              bircalc.solveGross(net, 200, 0, workplace, 'texnopark', year)
            : bircalc.solveGross(net, 200, 0, workplace, toBir(sector), year);
        eq(`solveGross · ${sector}/${year}/${workplace} net=${net}`, mine, theirs, 1e-4);
      }
    }
  }
}

console.log('4. Yemək pulu + artım məntiqi (mgComputeOne)');
const CASES = [
  { gross: 1000, meal: 0, inc: 0 },
  { gross: 1000, meal: 0, inc: 50 },
  { gross: 1000, meal: 0, inc: 100 },
  { gross: 1000, meal: 0, inc: 100.5 },
  { gross: 1000, meal: 50, inc: 30 },
  { gross: 1000, meal: 50, inc: 50 },
  { gross: 1000, meal: 50, inc: 51 },
  { gross: 1000, meal: 100, inc: 1 },
  { gross: 1000, meal: 100, inc: 10 },
  { gross: 1000, meal: 100, inc: 25 },
  { gross: 1000, meal: 100, inc: 200 },
  { gross: 1400, meal: 50, inc: 120 },
  { gross: 2000, meal: 100, inc: 15 },
  { gross: 2000, meal: 100, inc: 40 },
  { gross: 3000, meal: 100, inc: 60 },
  { gross: 3000, meal: 0, inc: 250 },
  { gross: 8500, meal: 100, inc: 300 },
  { gross: 700, meal: 20, inc: 95 },
  { gross: 700, meal: 99, inc: 2 },
  { gross: 1234.56, meal: 33, inc: 77 },
];
for (const sector of SECTORS) {
  for (const year of YEARS) {
    for (const isHead of [false, true]) {
      for (const c of CASES) {
        const ctx: CompContext = {
          sector,
          workplace: 'main',
          year,
          benefit: 200,
          unionPct: 0,
        };
        const mine = computeIncrease({
          currentGross: c.gross,
          currentMeal: c.meal,
          increaseNet: c.inc,
          ctx,
          office: isHead ? 'hq' : 'branch',
        });
        const p = {
          year,
          sector: toBir(sector),
          workplace: 'main',
          benefit: 200,
          unionPct: 0,
        };
        const theirs = bircalc.mgComputeOne(c.gross, c.meal, c.inc, isHead, p);
        const label = `meal · ${sector}/${year} ${isHead ? 'baş ofis' : 'filial'} gross=${c.gross} meal=${c.meal} inc=${c.inc}`;
        eq(`${label} → newGross`, mine.newGross, Math.round((theirs.newGross + Number.EPSILON) * 100) / 100, 0.005);
        eq(`${label} → newMeal`, mine.newMeal, theirs.newMeal);
        eq(`${label} → newTotalNet`, mine.newTotalNet, Math.round((theirs.newTotalNet + Number.EPSILON) * 100) / 100, 0.005);
      }
    }
  }
}

console.log(`\nYoxlanıldı: ${checked} müqayisə`);
if (failed === 0) {
  console.log('✓ Freya engine BirCalc ilə tam eynidir.');
  process.exit(0);
}
console.log(`✗ ${failed} uyğunsuzluq:\n`);
failures.forEach((f) => console.log('  ' + f));
process.exit(1);
