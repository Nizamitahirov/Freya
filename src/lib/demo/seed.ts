/**
 * seed.ts — Demo dataset (SRS §18, §20/lib/demo).
 *
 * Struktur: 3 division → 5 department → 5 komanda; hər komandada 10–12 əməkdaş
 * (cəmi 56), Azərbaycan adları ilə. Hər komandanın öz büdcəsi və review dövrü var.
 *
 * Bütün kompensasiya dəyərləri engine ilə hesablanır ki, demo data həmişə hesablama
 * motoru ilə uzlaşsın; gross dəyərləri əməkdaşın grade/level band-ının içindədir
 * (belə ki, planlaşdırmada band validasiyası düzgün davransın).
 */

import { getDeductions, superGross, type CompContext } from '@/lib/comp';
import type { Budget, Company, Cycle, Employee, Grade, Structure } from '@/types';

const COMPANY_ID = 'demo-co';
const YEAR = 2026;

const ctx: CompContext = {
  sector: 'private',
  workplace: 'main',
  year: '2026',
  benefit: 200,
  unionPct: 0,
};

/** Gross + yemək pulundan tam kompensasiya sətrini engine ilə qurur. */
function comp(gross: number, meal: number) {
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
  name: 'Demo Şirkət MMC',
  country: 'AZ',
  currency: 'AZN',
  fiscalYearStart: 1,
  taxProfile: { sector: 'private', year: '2026' },
  mealLimit: 100,
  minGrossDiff: { branch: 20, hq: 50 },
  createdBy: 'demo-user',
  createdAt: Date.parse('2026-01-01'),
};

// ─────────────────────────────── Struktur ağacı ──────────────────────────────

type TeamDef = {
  id: string;
  name: string;
  department: { id: string; name: string };
  division: { id: string; name: string };
  budget: number;
};

const TEAMS: TeamDef[] = [
  {
    id: 'team-backend',
    name: 'Backend',
    department: { id: 'dep-eng', name: 'Engineering' },
    division: { id: 'div-tech', name: 'Technology' },
    budget: 180000,
  },
  {
    id: 'team-frontend',
    name: 'Frontend',
    department: { id: 'dep-eng', name: 'Engineering' },
    division: { id: 'div-tech', name: 'Technology' },
    budget: 150000,
  },
  {
    id: 'team-data',
    name: 'Data & Analytics',
    department: { id: 'dep-data', name: 'Data' },
    division: { id: 'div-tech', name: 'Technology' },
    budget: 140000,
  },
  {
    id: 'team-sales',
    name: 'Field Sales',
    department: { id: 'dep-sales', name: 'Sales' },
    division: { id: 'div-com', name: 'Commercial' },
    budget: 120000,
  },
  {
    id: 'team-hr',
    name: 'HR Operations',
    department: { id: 'dep-hr', name: 'People & Culture' },
    division: { id: 'div-ops', name: 'Operations' },
    budget: 90000,
  },
];

const DIVISIONS = [
  { id: 'div-tech', name: 'Technology' },
  { id: 'div-com', name: 'Commercial' },
  { id: 'div-ops', name: 'Operations' },
];

const DEPARTMENTS = [
  { id: 'dep-eng', name: 'Engineering', parentId: 'div-tech' },
  { id: 'dep-data', name: 'Data', parentId: 'div-tech' },
  { id: 'dep-sales', name: 'Sales', parentId: 'div-com' },
  { id: 'dep-hr', name: 'People & Culture', parentId: 'div-ops' },
];

export const demoStructures: Structure[] = [
  ...DIVISIONS.map(
    (d): Structure => ({
      id: d.id,
      companyId: COMPANY_ID,
      type: 'division',
      parentId: null,
      name: d.name,
      managerIds: [],
      reviewerIds: [],
      approvalChain: [],
      archived: false,
    }),
  ),
  ...DEPARTMENTS.map(
    (d): Structure => ({
      id: d.id,
      companyId: COMPANY_ID,
      type: 'department',
      parentId: d.parentId,
      name: d.name,
      managerIds: ['demo-manager'],
      reviewerIds: ['demo-hr'],
      approvalChain: ['HRAdmin'],
      archived: false,
    }),
  ),
  ...TEAMS.map(
    (t): Structure => ({
      id: t.id,
      companyId: COMPANY_ID,
      type: 'team',
      parentId: t.department.id,
      name: t.name,
      managerIds: ['demo-manager'],
      reviewerIds: ['demo-hr'],
      approvalChain: ['HRAdmin'],
      archived: false,
    }),
  ),
];

// ──────────────────────────── Grade / Level bandları ─────────────────────────

export const demoGrades: Grade[] = [
  {
    id: 'G5',
    companyId: COMPANY_ID,
    code: 'G5',
    order: 5,
    levels: [
      { id: 'L1', name: 'Junior', min: 600, mid: 750, max: 900 },
      { id: 'L2', name: 'Mid', min: 850, mid: 1000, max: 1200 },
      { id: 'L3', name: 'Senior', min: 1150, mid: 1350, max: 1600 },
    ],
  },
  {
    id: 'G6',
    companyId: COMPANY_ID,
    code: 'G6',
    order: 6,
    levels: [
      { id: 'L1', name: 'Junior', min: 900, mid: 1100, max: 1300 },
      { id: 'L2', name: 'Mid', min: 1250, mid: 1500, max: 1800 },
      { id: 'L3', name: 'Senior', min: 1750, mid: 2100, max: 2500 },
    ],
  },
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
  {
    id: 'G9',
    companyId: COMPANY_ID,
    code: 'G9',
    order: 9,
    levels: [
      { id: 'L1', name: 'Head', min: 5000, mid: 6000, max: 7500 },
      { id: 'L2', name: 'Director', min: 7000, mid: 9000, max: 12000 },
    ],
  },
];

// ──────────────────────────────── Əməkdaşlar ─────────────────────────────────

type Seat = {
  name: string;
  grade: string;
  level: string;
  gross: number;
  meal: number;
  union?: number;
};

/** Hər komanda üçün 10–12 əməkdaş: ad, grade/level və band daxilində gross. */
const ROSTER: Record<string, Seat[]> = {
  'team-backend': [
    { name: 'Rəşad Əliyev', grade: 'G8', level: 'L1', gross: 3200, meal: 100 },
    { name: 'Aygün Məmmədova', grade: 'G7', level: 'L3', gross: 2200, meal: 100 },
    { name: 'Elvin Hüseynov', grade: 'G7', level: 'L3', gross: 2050, meal: 100 },
    { name: 'Nərmin Quliyeva', grade: 'G7', level: 'L2', gross: 1500, meal: 100 },
    { name: 'Tural Səfərov', grade: 'G7', level: 'L2', gross: 1420, meal: 50 },
    { name: 'Günel Abbasova', grade: 'G7', level: 'L2', gross: 1350, meal: 50 },
    { name: 'Orxan İsmayılov', grade: 'G6', level: 'L2', gross: 1600, meal: 100 },
    { name: 'Ləman Kərimli', grade: 'G6', level: 'L1', gross: 1150, meal: 50 },
    { name: 'Kamran Nəbiyev', grade: 'G7', level: 'L1', gross: 1050, meal: 50, union: 1 },
    { name: 'Səbinə Rəhimova', grade: 'G7', level: 'L1', gross: 980, meal: 50 },
    { name: 'Fərid Bağırov', grade: 'G5', level: 'L2', gross: 1050, meal: 0 },
    { name: 'Aysel Vəliyeva', grade: 'G5', level: 'L1', gross: 820, meal: 0 },
  ],
  'team-frontend': [
    { name: 'Nihat Qasımov', grade: 'G8', level: 'L1', gross: 2900, meal: 100 },
    { name: 'Ülviyyə Həsənova', grade: 'G7', level: 'L3', gross: 2100, meal: 100 },
    { name: 'Cavid Mustafayev', grade: 'G7', level: 'L3', gross: 1900, meal: 100 },
    { name: 'Nigar Hüseynova', grade: 'G7', level: 'L2', gross: 1550, meal: 100 },
    { name: 'Emin Salmanov', grade: 'G7', level: 'L2', gross: 1400, meal: 50 },
    { name: 'Zeynəb Əhmədli', grade: 'G6', level: 'L2', gross: 1480, meal: 50 },
    { name: 'Rüfət Cəfərov', grade: 'G6', level: 'L2', gross: 1330, meal: 50, union: 1 },
    { name: 'Mehriban Tağıyeva', grade: 'G6', level: 'L1', gross: 1080, meal: 50 },
    { name: 'Anar Şirinov', grade: 'G5', level: 'L2', gross: 1120, meal: 0 },
    { name: 'Türkan Novruzova', grade: 'G5', level: 'L1', gross: 780, meal: 0 },
    { name: 'İlkin Rzayev', grade: 'G5', level: 'L1', gross: 700, meal: 0 },
  ],
  'team-data': [
    { name: 'Samir Babayev', grade: 'G8', level: 'L2', gross: 4200, meal: 100 },
    { name: 'Lalə Muradova', grade: 'G8', level: 'L1', gross: 3000, meal: 100 },
    { name: 'Ramin Əsgərov', grade: 'G7', level: 'L3', gross: 2300, meal: 100 },
    { name: 'Fidan Qurbanova', grade: 'G7', level: 'L3', gross: 1980, meal: 100 },
    { name: 'Elçin Yusifov', grade: 'G7', level: 'L2', gross: 1600, meal: 50 },
    { name: 'Aynur Xəlilova', grade: 'G6', level: 'L3', gross: 2000, meal: 100 },
    { name: 'Mahir Sultanov', grade: 'G6', level: 'L2', gross: 1520, meal: 50 },
    { name: 'Şəbnəm Osmanova', grade: 'G6', level: 'L1', gross: 1200, meal: 50 },
    { name: 'Vüqar Cabbarov', grade: 'G5', level: 'L3', gross: 1400, meal: 50, union: 1 },
    { name: 'Xəyalə Paşayeva', grade: 'G5', level: 'L2', gross: 990, meal: 0 },
  ],
  'team-sales': [
    { name: 'Elnur Məmmədli', grade: 'G8', level: 'L1', gross: 2700, meal: 100 },
    { name: 'Sevinc Əliyeva', grade: 'G7', level: 'L3', gross: 1850, meal: 100 },
    { name: 'Ruslan Hacıyev', grade: 'G7', level: 'L2', gross: 1620, meal: 100 },
    { name: 'Günay İbrahimova', grade: 'G7', level: 'L2', gross: 1450, meal: 50 },
    { name: 'Toğrul Məhərrəmov', grade: 'G6', level: 'L2', gross: 1500, meal: 50 },
    { name: 'Nurlan Zeynalov', grade: 'G6', level: 'L2', gross: 1380, meal: 50 },
    { name: 'Aidə Süleymanova', grade: 'G6', level: 'L1', gross: 1120, meal: 50 },
    { name: 'Kamal Orucov', grade: 'G5', level: 'L3', gross: 1300, meal: 50 },
    { name: 'Ayşən Dadaşova', grade: 'G5', level: 'L2', gross: 1000, meal: 0 },
    { name: 'Murad Qədirov', grade: 'G5', level: 'L1', gross: 850, meal: 0, union: 1 },
    { name: 'Nərgiz Allahverdiyeva', grade: 'G5', level: 'L1', gross: 720, meal: 0 },
  ],
  'team-hr': [
    { name: 'Leyla Axundova', grade: 'G8', level: 'L1', gross: 2600, meal: 100 },
    { name: 'Şahin Vəkilov', grade: 'G7', level: 'L3', gross: 1750, meal: 100 },
    { name: 'Aytac Nərimanova', grade: 'G7', level: 'L2', gross: 1480, meal: 50 },
    { name: 'Rövşən Mirzəyev', grade: 'G6', level: 'L2', gross: 1420, meal: 50 },
    { name: 'Pərvanə Əmirova', grade: 'G6', level: 'L1', gross: 1150, meal: 50 },
    { name: 'Ceyhun Bayramov', grade: 'G6', level: 'L1', gross: 1000, meal: 50 },
    { name: 'Sona Mikayılova', grade: 'G5', level: 'L3', gross: 1250, meal: 50 },
    { name: 'Vüsal Əzizov', grade: 'G5', level: 'L2', gross: 950, meal: 0, union: 1 },
    { name: 'Gülnar Şükürova', grade: 'G5', level: 'L2', gross: 880, meal: 0 },
    { name: 'Elşən Qarayev', grade: 'G5', level: 'L1', gross: 750, meal: 0 },
  ],
};

let badgeCounter = 1000;

export const demoEmployees: Employee[] = TEAMS.flatMap((team) =>
  ROSTER[team.id].map((seat, index): Employee => {
    badgeCounter += 1;
    return {
      id: `${team.id}-emp-${index + 1}`,
      companyId: COMPANY_ID,
      positionId: team.id,
      gradeId: seat.grade,
      levelId: seat.level,
      badge: `B-${badgeCounter}`,
      fullName: seat.name,
      ...comp(seat.gross, seat.meal),
      currency: 'AZN',
      ctx: {
        sector: 'private',
        workplace: 'main',
        benefit: 200,
        unionPct: seat.union ?? 0,
      },
      effectiveDate: `${YEAR}-01-01`,
    };
  }),
);

// ─────────────────────────── Büdcələr və review dövrləri ─────────────────────

export const demoBudgets: Budget[] = TEAMS.map((t) => ({
  id: `bud-${t.id}`,
  companyId: COMPANY_ID,
  structureId: t.id,
  year: YEAR,
  allocatedGross: t.budget,
  committedGross: 0,
  spentGross: 0,
}));

export const demoCycles: Cycle[] = TEAMS.map((t) => ({
  id: `cycle-${YEAR}-${t.id}`,
  companyId: COMPANY_ID,
  structureId: t.id,
  year: YEAR,
  name: `${YEAR} İllik Review — ${t.name}`,
  status: 'open',
  round: 0,
  createdBy: 'demo-manager',
  createdAt: Date.parse('2026-02-01'),
  submittedAt: null,
  finalizedAt: null,
}));

export const demoDataset = {
  company: demoCompany,
  structures: demoStructures,
  grades: demoGrades,
  employees: demoEmployees,
  budgets: demoBudgets,
  cycles: demoCycles,
};
