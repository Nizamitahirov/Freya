/**
 * seed.ts — Demo mode seed data (SRS §18, §20/lib/demo).
 *
 * Bütün kompensasiya dəyərləri engine ilə hesablanır ki, demo data həmişə
 * hesablama motoru ilə uzlaşsın. Firebase olmadan (NEXT_PUBLIC_DEMO_MODE) işləyir.
 */

import { getDeductions, superGross, type CompContext } from '@/lib/comp';
import type {
  Company,
  Employee,
  Grade,
  Budget,
  Structure,
  Cycle,
} from '@/types';

const COMPANY_ID = 'demo-co';
const YEAR = 2026;

const ctx: CompContext = {
  sector: 'private',
  workplace: 'main',
  year: '2026',
  benefit: 200,
  unionPct: 0,
};

/** Gross-dan tam kompensasiya sətrini engine ilə qurur. */
function comp(gross: number, meal = 0) {
  const net = getDeductions(gross, ctx).net;
  return {
    currentGross: gross,
    currentNet: Math.round((net + meal) * 100) / 100,
    currentSuperGross: superGross(gross, ctx),
    currentMeal: meal,
  };
}

export const demoCompany: Company = {
  id: COMPANY_ID,
  name: 'Databyte',
  country: 'AZ',
  currency: 'AZN',
  fiscalYearStart: 1,
  taxProfile: { sector: 'private', year: '2026' },
  mealLimit: 100,
  minGrossDiff: { branch: 20, hq: 50 },
  createdBy: 'demo-user',
  createdAt: Date.parse('2026-01-01'),
};

export const demoStructures: Structure[] = [
  { id: 'div-tech', companyId: COMPANY_ID, type: 'division', parentId: null, name: 'Technology', managerIds: [], reviewerIds: [], approvalChain: [], archived: false },
  { id: 'dep-eng', companyId: COMPANY_ID, type: 'department', parentId: 'div-tech', name: 'Engineering', managerIds: ['demo-manager'], reviewerIds: ['demo-hr'], approvalChain: ['HRAdmin'], archived: false },
  { id: 'team-be', companyId: COMPANY_ID, type: 'team', parentId: 'dep-eng', name: 'Backend', managerIds: ['demo-manager'], reviewerIds: ['demo-hr'], approvalChain: ['HRAdmin'], archived: false },
];

export const demoGrades: Grade[] = [
  {
    id: 'G7',
    companyId: COMPANY_ID,
    code: 'G7',
    order: 7,
    levels: [
      { id: 'L1', name: 'Junior', min: 800, mid: 1000, max: 1200 },
      { id: 'L2', name: 'Mid', min: 1100, mid: 1400, max: 1700 },
      { id: 'L3', name: 'Senior', min: 1600, mid: 2000, max: 2500 },
    ],
  },
  {
    id: 'G8',
    companyId: COMPANY_ID,
    code: 'G8',
    order: 8,
    levels: [
      { id: 'L1', name: 'Lead', min: 2400, mid: 3000, max: 3800 },
      { id: 'L2', name: 'Principal', min: 3600, mid: 4500, max: 5500 },
    ],
  },
];

export const demoEmployees: Employee[] = [
  {
    id: 'emp-1', companyId: COMPANY_ID, positionId: 'team-be', gradeId: 'G7', levelId: 'L2',
    badge: 'B-1001', fullName: 'Aygün Məmmədova',
    ...comp(1400, 50), currency: 'AZN', ctx: { sector: 'private', workplace: 'main', benefit: 200, unionPct: 0 },
    effectiveDate: '2026-01-01',
  },
  {
    id: 'emp-2', companyId: COMPANY_ID, positionId: 'team-be', gradeId: 'G7', levelId: 'L3',
    badge: 'B-1002', fullName: 'Rəşad Əliyev',
    ...comp(2000, 100), currency: 'AZN', ctx: { sector: 'private', workplace: 'main', benefit: 200, unionPct: 0 },
    effectiveDate: '2026-01-01',
  },
  {
    id: 'emp-3', companyId: COMPANY_ID, positionId: 'team-be', gradeId: 'G8', levelId: 'L1',
    badge: 'B-1003', fullName: 'Nigar Hüseynova',
    ...comp(3000, 100), currency: 'AZN', ctx: { sector: 'private', workplace: 'main', benefit: 200, unionPct: 0 },
    effectiveDate: '2026-01-01',
  },
];

export const demoBudget: Budget = {
  id: 'bud-eng',
  companyId: COMPANY_ID,
  structureId: 'dep-eng',
  year: YEAR,
  allocatedGross: 120000,
  committedGross: 0,
  spentGross: 0,
};

export const demoCycle: Cycle = {
  id: 'cycle-2026',
  companyId: COMPANY_ID,
  structureId: 'dep-eng',
  year: YEAR,
  name: '2026 İllik Review',
  status: 'open',
  round: 0,
  createdBy: 'demo-manager',
  createdAt: Date.parse('2026-02-01'),
  submittedAt: null,
  finalizedAt: null,
};

export const demoDataset = {
  company: demoCompany,
  structures: demoStructures,
  grades: demoGrades,
  employees: demoEmployees,
  budget: demoBudget,
  cycle: demoCycle,
};
