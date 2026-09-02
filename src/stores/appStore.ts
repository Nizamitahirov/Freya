'use client';

/**
 * appStore.ts — Tətbiqin mərkəzi state-i (Zustand), Firestore modelini güzgüləyir (SRS §13).
 *
 * Demo mode-da localStorage-a persist olunur. Bütün mutasiyalar pure engine/budget/workflow
 * funksiyalarına söykənir — Firebase qoşulanda bu store adapter ilə əvəzlənə bilər.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { planCompensation, type CompContext, type InputMode } from '@/lib/comp';
import { summarize, type BudgetSummary } from '@/lib/budget';
import {
  applyHrAction,
  applyManagerAction,
  canFinalize,
  type HrAction,
} from '@/lib/review/workflow';
import { monthsToYearEnd } from '@/lib/format';
import { demoDataset } from '@/lib/demo/seed';
import type {
  Budget,
  Company,
  Cycle,
  Employee,
  Grade,
  PlanningItem,
  Role,
  Structure,
} from '@/types';

type Reason_ = PlanningItem['reason'];

export type PlanPatch = {
  inputMode: InputMode;
  inputValue: number;
  reason: Reason_;
  effectiveDate?: string;
  newGradeId?: string | null;
  newLevelId?: string | null;
  managerComment?: string;
};

interface AppState {
  companies: Company[];
  structures: Structure[];
  grades: Grade[];
  employees: Employee[];
  budgets: Budget[];
  cycles: Cycle[];
  planningItems: PlanningItem[];
  activeCompanyId: string;
  activeCycleId: string;
  role: Role;

  setRole: (r: Role) => void;
  setActiveCompany: (id: string) => void;

  upsertPlanningItem: (employeeId: string, cycleId: string, patch: PlanPatch) => void;
  removePlanningItem: (id: string) => void;
  submitCycle: (cycleId: string) => void;
  hrAction: (itemId: string, action: HrAction, payload?: { hrComment?: string; newNet?: number }) => void;
  bulkHrAction: (ids: string[], action: HrAction) => void;
  resubmit: (itemId: string) => void;
  finalizeCycle: (cycleId: string) => void;
  setAllocation: (budgetId: string, amount: number) => void;
  resetDemo: () => void;
}

function ctxOf(e: Employee, year: Company['taxProfile']['year']): CompContext {
  return { ...e.ctx, year };
}

function computeItem(
  state: Pick<AppState, 'employees' | 'companies' | 'cycles'>,
  employeeId: string,
  cycleId: string,
  patch: PlanPatch,
): Omit<PlanningItem, 'id' | 'status' | 'round' | 'version' | 'hrComment'> {
  const emp = state.employees.find((e) => e.id === employeeId)!;
  const company = state.companies.find((c) => c.id === emp.companyId)!;
  const cycle = state.cycles.find((c) => c.id === cycleId)!;
  const effectiveDate = patch.effectiveDate ?? `${cycle.year}-01-01`;
  const effectiveMonths = monthsToYearEnd(effectiveDate, cycle.year);

  const result = planCompensation({
    mode: patch.inputMode,
    value: patch.inputValue,
    currentNet: emp.currentNet,
    currentGross: emp.currentGross,
    currentMeal: emp.currentMeal,
    ctx: ctxOf(emp, company.taxProfile.year),
    mealLimit: company.mealLimit,
    effectiveMonths,
  });

  return {
    companyId: emp.companyId,
    cycleId,
    employeeId,
    structureId: emp.positionId,
    inputMode: patch.inputMode,
    inputValue: patch.inputValue,
    currentNet: emp.currentNet,
    newNet: result.newNet,
    newGross: result.newGross,
    newSuperGross: result.newSuperGross,
    newMeal: result.newMeal,
    newGradeId: patch.newGradeId ?? null,
    newLevelId: patch.newLevelId ?? null,
    effectiveDate,
    effectiveMonths,
    deltaGrossAnnual: result.deltaGrossAnnual,
    reason: patch.reason,
    managerComment: patch.managerComment ?? '',
    updatedAt: Date.now(),
  };
}

const initial = {
  companies: [demoDataset.company],
  structures: demoDataset.structures,
  grades: demoDataset.grades,
  employees: demoDataset.employees,
  budgets: [demoDataset.budget],
  cycles: [demoDataset.cycle],
  planningItems: [] as PlanningItem[],
  activeCompanyId: demoDataset.company.id,
  activeCycleId: demoDataset.cycle.id,
  role: 'Manager' as Role,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initial,

      setRole: (role) => set({ role }),
      setActiveCompany: (activeCompanyId) => set({ activeCompanyId }),

      upsertPlanningItem: (employeeId, cycleId, patch) =>
        set((state) => {
          const base = computeItem(state, employeeId, cycleId, patch);
          const existing = state.planningItems.find(
            (i) => i.employeeId === employeeId && i.cycleId === cycleId,
          );
          if (existing) {
            // in_review/terminal sətirlər redaktə olunmur (returned istisna).
            if (!['draft', 'returned'].includes(existing.status)) return state;
            return {
              planningItems: state.planningItems.map((i) =>
                i.id === existing.id
                  ? { ...i, ...base, status: 'draft', version: i.version + 1 }
                  : i,
              ),
            };
          }
          const item: PlanningItem = {
            ...base,
            id: `pi_${employeeId}_${Date.now()}`,
            status: 'draft',
            round: 0,
            version: 1,
            hrComment: '',
          };
          return { planningItems: [...state.planningItems, item] };
        }),

      removePlanningItem: (id) =>
        set((state) => ({ planningItems: state.planningItems.filter((i) => i.id !== id) })),

      submitCycle: (cycleId) =>
        set((state) => ({
          cycles: state.cycles.map((c) =>
            c.id === cycleId ? { ...c, status: 'in_review', submittedAt: Date.now() } : c,
          ),
          planningItems: state.planningItems.map((i) =>
            i.cycleId === cycleId && i.status === 'draft'
              ? { ...i, status: 'submitted', updatedAt: Date.now() }
              : i,
          ),
        })),

      hrAction: (itemId, action, payload) =>
        set((state) => ({
          planningItems: state.planningItems.map((i) => {
            if (i.id !== itemId) return i;
            const status = applyHrAction(i.status, action);
            let next: PlanningItem = { ...i, status, updatedAt: Date.now() };
            if (payload?.hrComment !== undefined) next.hrComment = payload.hrComment;
            if (action === 'edit' && payload?.newNet !== undefined) {
              const patched = computeItem(state, i.employeeId, i.cycleId, {
                inputMode: 'absolute',
                inputValue: payload.newNet,
                reason: i.reason,
                effectiveDate: i.effectiveDate,
                newGradeId: i.newGradeId,
                newLevelId: i.newLevelId,
              });
              next = { ...next, ...patched, status };
            }
            return next;
          }),
        })),

      bulkHrAction: (ids, action) =>
        set((state) => ({
          planningItems: state.planningItems.map((i) =>
            ids.includes(i.id) && ['submitted', 'edited_pending'].includes(i.status)
              ? { ...i, status: applyHrAction(i.status, action), updatedAt: Date.now() }
              : i,
          ),
        })),

      resubmit: (itemId) =>
        set((state) => ({
          planningItems: state.planningItems.map((i) =>
            i.id === itemId && i.status === 'returned'
              ? { ...i, status: applyManagerAction(i.status, 'resubmit'), round: i.round + 1, updatedAt: Date.now() }
              : i,
          ),
        })),

      finalizeCycle: (cycleId) =>
        set((state) => {
          const items = state.planningItems.filter((i) => i.cycleId === cycleId);
          if (!canFinalize(items.map((i) => i.status))) return state;
          // Approved sətirlərin employee datasını yenilə.
          const employees = state.employees.map((e) => {
            const it = items.find((i) => i.employeeId === e.id && i.status === 'approved');
            if (!it) return e;
            return {
              ...e,
              currentNet: it.newNet,
              currentGross: it.newGross,
              currentSuperGross: it.newSuperGross,
              currentMeal: it.newMeal,
              gradeId: it.newGradeId ?? e.gradeId,
              levelId: it.newLevelId ?? e.levelId,
              effectiveDate: it.effectiveDate,
            };
          });
          return {
            employees,
            cycles: state.cycles.map((c) =>
              c.id === cycleId ? { ...c, status: 'finalized', finalizedAt: Date.now() } : c,
            ),
          };
        }),

      setAllocation: (budgetId, amount) =>
        set((state) => ({
          budgets: state.budgets.map((b) =>
            b.id === budgetId ? { ...b, allocatedGross: amount } : b,
          ),
        })),

      resetDemo: () => set({ ...initial, planningItems: [] }),
    }),
    {
      name: 'freya-demo',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

// ───────────────────────────── Seçicilər (selectors) ─────────────────────────

export type BudgetView = BudgetSummary & { structureId: string };

/** Struktur üzrə büdcəni planningItems-dən törədir (SRS §7.3). */
export function selectBudget(state: AppState, structureId: string): BudgetView | null {
  const base = state.budgets.find((b) => b.structureId === structureId);
  if (!base) return null;
  let committed = 0;
  let spent = 0;
  for (const item of state.planningItems) {
    const cycle = state.cycles.find((c) => c.id === item.cycleId);
    if (!cycle || cycle.structureId !== structureId) continue;
    const active = ['draft', 'submitted', 'returned', 'edited_pending', 'approved'];
    if (cycle.status === 'finalized') {
      if (item.status === 'approved') spent += item.deltaGrossAnnual;
    } else if (active.includes(item.status)) {
      committed += item.deltaGrossAnnual;
    }
  }
  return {
    structureId,
    ...summarize({ allocatedGross: base.allocatedGross, committedGross: committed, spentGross: spent }),
  };
}

/** Əməkdaşın grade/level band-ını tapır. */
export function selectBand(state: AppState, gradeId: string, levelId: string) {
  const grade = state.grades.find((g) => g.id === gradeId);
  const level = grade?.levels.find((l) => l.id === levelId);
  return level ? { min: level.min, mid: level.mid, max: level.max, name: level.name } : null;
}
