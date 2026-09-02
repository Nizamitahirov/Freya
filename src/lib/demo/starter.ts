/**
 * starter.ts — Yeni şirkət üçün başlanğıc dataset (SRS §4).
 *
 * `createCompany` server action-ı bunu Firestore-a yazır. Bütün id-lər companyId ilə
 * prefikslənir ki, qlobal kolleksiyalarda şirkətlər arası toqquşma olmasın.
 */

import { getDeductions, superGross, type CompContext } from '@/lib/comp';
import type { Budget, Company, Cycle, Employee, Grade, Structure } from '@/types';

export type StarterOptions = {
  companyId: string;
  name: string;
  createdBy: string;
  year: number;
  sector: Company['taxProfile']['sector'];
  taxYear: Company['taxProfile']['year'];
  currency: string;
  mealLimit: number;
  /** Nümunə əməkdaşlar və büdcə ilə birlikdə qurulsun. */
  withSampleData: boolean;
};

export type StarterDataset = {
  company: Company;
  structures: Structure[];
  grades: Grade[];
  employees: Employee[];
  budgets: Budget[];
  cycles: Cycle[];
};

const GRADE_TEMPLATE = [
  {
    code: 'G7',
    order: 7,
    levels: [
      { id: 'L1', name: 'Junior', min: 800, mid: 1000, max: 1200 },
      { id: 'L2', name: 'Mid', min: 1100, mid: 1400, max: 1700 },
      { id: 'L3', name: 'Senior', min: 1600, mid: 2000, max: 2500 },
    ],
  },
  {
    code: 'G8',
    order: 8,
    levels: [
      { id: 'L1', name: 'Lead', min: 2400, mid: 3000, max: 3800 },
      { id: 'L2', name: 'Principal', min: 3600, mid: 4500, max: 5500 },
    ],
  },
];

const SAMPLE_EMPLOYEES = [
  { badge: 'B-1001', fullName: 'Aygün Məmmədova', gross: 1400, meal: 50, grade: 'G7', level: 'L2' },
  { badge: 'B-1002', fullName: 'Rəşad Əliyev', gross: 2000, meal: 100, grade: 'G7', level: 'L3' },
  { badge: 'B-1003', fullName: 'Nigar Hüseynova', gross: 3000, meal: 100, grade: 'G8', level: 'L1' },
];

export function buildStarterDataset(opts: StarterOptions): StarterDataset {
  const { companyId, name, createdBy, year, sector, taxYear, currency, mealLimit } = opts;
  const id = (suffix: string) => `${companyId}__${suffix}`;
  const now = Date.now();

  const company: Company = {
    id: companyId,
    name,
    country: 'AZ',
    currency,
    fiscalYearStart: 1,
    taxProfile: { sector, year: taxYear },
    mealLimit,
    minGrossDiff: { branch: 20, hq: 50 },
    createdBy,
    createdAt: now,
  };

  const structures: Structure[] = [
    { id: id('div-1'), companyId, type: 'division', parentId: null, name: 'Baş idarə', managerIds: [], reviewerIds: [], approvalChain: [], archived: false },
    { id: id('dep-1'), companyId, type: 'department', parentId: id('div-1'), name: 'Departament', managerIds: [createdBy], reviewerIds: [createdBy], approvalChain: ['HRAdmin'], archived: false },
    { id: id('team-1'), companyId, type: 'team', parentId: id('dep-1'), name: 'Komanda', managerIds: [createdBy], reviewerIds: [createdBy], approvalChain: ['HRAdmin'], archived: false },
  ];

  const grades: Grade[] = GRADE_TEMPLATE.map((g) => ({
    id: id(g.code),
    companyId,
    code: g.code,
    order: g.order,
    levels: g.levels,
  }));

  const ctx: CompContext = { sector, workplace: 'main', year: taxYear, benefit: 200, unionPct: 0 };

  const employees: Employee[] = opts.withSampleData
    ? SAMPLE_EMPLOYEES.map((e, i) => {
        const net = getDeductions(e.gross, ctx).net;
        return {
          id: id(`emp-${i + 1}`),
          companyId,
          positionId: id('team-1'),
          gradeId: id(e.grade),
          levelId: e.level,
          badge: e.badge,
          fullName: e.fullName,
          currentGross: e.gross,
          currentNet: Math.round((net + e.meal) * 100) / 100,
          currentSuperGross: superGross(e.gross, ctx),
          currentMeal: e.meal,
          currency,
          ctx: { sector, workplace: 'main', benefit: 200, unionPct: 0 },
          office: 'hq' as const,
          effectiveDate: `${year}-01-01`,
        };
      })
    : [];

  const budgets: Budget[] = [
    {
      id: id(`bud-${year}`),
      companyId,
      structureId: id('dep-1'),
      year,
      allocatedGross: opts.withSampleData ? 120000 : 0,
      committedGross: 0,
      spentGross: 0,
    },
  ];

  const cycles: Cycle[] = [
    {
      id: id(`cycle-${year}`),
      companyId,
      structureId: id('dep-1'),
      year,
      name: `${year} İllik Review`,
      status: 'open',
      round: 0,
      createdBy,
      createdAt: now,
      submittedAt: null,
      finalizedAt: null,
    },
  ];

  return { company, structures, grades, employees, budgets, cycles };
}
