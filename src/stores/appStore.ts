'use client';

/**
 * appStore.ts — Tətbiqin mərkəzi state-i (Zustand), Firestore modelini güzgüləyir (SRS §13).
 *
 * İki rejim:
 *  - `demo`  — Firebase olmadan localStorage-da işləyir (SRS §18 demo mode).
 *  - `live`  — data Firestore-dan realtime gəlir, mutasiyalar SERVER ACTION-lara gedir
 *              (server-side validasiya + audit log, SRS §16).
 *
 * Hər iki rejimdə hesablama eyni pure engine funksiyaları ilə aparılır.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { computePlanningItem, type PlanPatch } from '@/lib/comp';
import { summarize, type BudgetSummary } from '@/lib/budget';
import {
  applyHrAction,
  applyManagerAction,
  canFinalize,
  type HrAction,
} from '@/lib/review/workflow';
import { demoDataset } from '@/lib/demo/seed';
import { currentIdToken } from '@/lib/firebase/auth';
import {
  savePlanningItemAction,
  removePlanningItemAction,
  submitCycleAction,
} from '@/app/actions/planning';
import { bulkHrActionAction, finalizeCycleAction, hrActionAction } from '@/app/actions/review';
import { setBudgetAction } from '@/app/actions/company';
import type {
  Budget,
  Company,
  Cycle,
  Employee,
  Grade,
  MarketData,
  PlanningItem,
  Role,
  Structure,
} from '@/types';

export type { PlanPatch };

export type AppMode = 'demo' | 'live';

interface AppState {
  mode: AppMode;
  userId: string | null;
  /** Üzvlükdən gələn bütün rollar (live mode); demo-da bütün rollar seçilə bilər. */
  availableRoles: Role[];
  /** Manager-ə təyin olunmuş strukturlar (SRS §3.2). */
  structureIds: string[];
  error: string | null;
  busy: boolean;

  companies: Company[];
  structures: Structure[];
  grades: Grade[];
  employees: Employee[];
  budgets: Budget[];
  cycles: Cycle[];
  planningItems: PlanningItem[];
  marketData: MarketData[];
  activeCompanyId: string;
  activeCycleId: string;
  role: Role;

  setRole: (r: Role) => void;
  setActiveCompany: (id: string) => void;
  setActiveCycle: (id: string) => void;
  setError: (msg: string | null) => void;
  /** Firestore sync qatından gələn data (live mode). */
  hydrate: (patch: Partial<AppState>) => void;
  /** Live rejimə keçid (auth + membership hazır olduqda). */
  goLive: (args: {
    userId: string;
    companies: Company[];
    activeCompanyId: string;
    roles: Role[];
    structureIds: string[];
  }) => void;
  /** Demo rejimə qayıdış (çıxış zamanı). */
  goDemo: () => void;

  upsertPlanningItem: (employeeId: string, cycleId: string, patch: PlanPatch) => Promise<void>;
  removePlanningItem: (id: string) => Promise<void>;
  submitCycle: (cycleId: string) => Promise<void>;
  hrAction: (
    itemId: string,
    action: HrAction,
    payload?: { hrComment?: string; newNet?: number },
  ) => Promise<void>;
  bulkHrAction: (ids: string[], action: HrAction) => Promise<void>;
  finalizeCycle: (cycleId: string) => Promise<void>;
  setAllocation: (budgetId: string, amount: number) => Promise<void>;
  resetDemo: () => void;
}

/** Demo rejimdə sətri lokal olaraq hesablayır (live-da bunu server edir). */
function computeLocal(
  state: Pick<AppState, 'employees' | 'companies' | 'cycles'>,
  employeeId: string,
  cycleId: string,
  patch: PlanPatch,
) {
  const emp = state.employees.find((e) => e.id === employeeId)!;
  const company = state.companies.find((c) => c.id === emp.companyId)!;
  const cycle = state.cycles.find((c) => c.id === cycleId)!;
  return computePlanningItem(emp, company, cycle, patch);
}

const initial = {
  mode: 'demo' as AppMode,
  userId: null,
  availableRoles: [
    'Manager',
    'HRAdmin',
    'HRReviewer',
    'Finance',
    'CompanyAdmin',
    'Viewer',
  ] as Role[],
  structureIds: [] as string[],
  error: null as string | null,
  busy: false,
  companies: [demoDataset.company],
  structures: demoDataset.structures,
  grades: demoDataset.grades,
  employees: demoDataset.employees,
  budgets: demoDataset.budgets,
  cycles: demoDataset.cycles,
  planningItems: [] as PlanningItem[],
  marketData: [] as MarketData[],
  activeCompanyId: demoDataset.company.id,
  activeCycleId: demoDataset.cycles[0].id,
  role: 'Manager' as Role,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      /** Server action-ı çağırır, xətanı store-a yazır (UI banner-də göstərilir). */
      const call = async (fn: (token: string) => Promise<{ ok: boolean; error?: string }>) => {
        set({ busy: true, error: null });
        try {
          const token = await currentIdToken();
          const res = await fn(token);
          if (!res.ok) set({ error: res.error ?? 'Əməliyyat alınmadı.' });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Şəbəkə xətası.' });
        } finally {
          set({ busy: false });
        }
      };

      return {
        ...initial,

        setRole: (role) => set({ role }),
        setActiveCompany: (activeCompanyId) => set({ activeCompanyId }),
        setActiveCycle: (activeCycleId) => set({ activeCycleId }),
        setError: (error) => set({ error }),
        hydrate: (patch) => set(patch as Partial<AppState>),

        goLive: ({ userId, companies, activeCompanyId, roles, structureIds }) =>
          set((state) => ({
            mode: 'live',
            userId,
            companies,
            activeCompanyId,
            availableRoles: roles,
            structureIds,
            role: roles.includes(state.role) ? state.role : (roles[0] ?? 'Viewer'),
            // Demo datası live rejimə sızmasın.
            structures: [],
            grades: [],
            employees: [],
            budgets: [],
            cycles: [],
            planningItems: [],
            marketData: [],
            activeCycleId: '',
            error: null,
          })),

        goDemo: () => set({ ...initial, planningItems: [] }),

        upsertPlanningItem: async (employeeId, cycleId, patch) => {
          if (get().mode === 'live') {
            const companyId = get().activeCompanyId;
            await call((token) =>
              savePlanningItemAction(token, {
                companyId,
                cycleId,
                employeeId,
                inputMode: patch.inputMode,
                inputValue: patch.inputValue,
                reason: patch.reason,
                effectiveDate: patch.effectiveDate,
                newGradeId: patch.newGradeId ?? null,
                newLevelId: patch.newLevelId ?? null,
                managerComment: patch.managerComment,
              }),
            );
            return;
          }
          set((state) => {
            const base = computeLocal(state, employeeId, cycleId, patch);
            const existing = state.planningItems.find(
              (i) => i.employeeId === employeeId && i.cycleId === cycleId,
            );
            if (existing) {
              if (!['draft', 'returned'].includes(existing.status)) return state;
              return {
                planningItems: state.planningItems.map((i) =>
                  i.id === existing.id
                    ? {
                        ...i,
                        ...base,
                        status: 'draft' as const,
                        round: i.status === 'returned' ? i.round + 1 : i.round,
                        version: i.version + 1,
                      }
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
          });
        },

        removePlanningItem: async (id) => {
          if (get().mode === 'live') {
            const companyId = get().activeCompanyId;
            await call((token) => removePlanningItemAction(token, { companyId, itemId: id }));
            return;
          }
          set((state) => ({ planningItems: state.planningItems.filter((i) => i.id !== id) }));
        },

        submitCycle: async (cycleId) => {
          if (get().mode === 'live') {
            const companyId = get().activeCompanyId;
            await call((token) => submitCycleAction(token, { companyId, cycleId }));
            return;
          }
          set((state) => ({
            cycles: state.cycles.map((c) =>
              c.id === cycleId
                ? { ...c, status: 'in_review', submittedAt: Date.now(), round: c.round + 1 }
                : c,
            ),
            planningItems: state.planningItems.map((i) =>
              i.cycleId === cycleId && i.status === 'draft'
                ? { ...i, status: 'submitted', updatedAt: Date.now() }
                : i,
            ),
          }));
        },

        hrAction: async (itemId, action, payload) => {
          if (get().mode === 'live') {
            const companyId = get().activeCompanyId;
            await call((token) =>
              hrActionAction(token, {
                companyId,
                itemId,
                action,
                hrComment: payload?.hrComment,
                newNet: payload?.newNet,
              }),
            );
            return;
          }
          set((state) => ({
            planningItems: state.planningItems.map((i) => {
              if (i.id !== itemId) return i;
              const status = applyHrAction(i.status, action);
              let next: PlanningItem = { ...i, status, updatedAt: Date.now() };
              if (payload?.hrComment !== undefined) next.hrComment = payload.hrComment;
              if (action === 'edit' && payload?.newNet !== undefined) {
                const patched = computeLocal(state, i.employeeId, i.cycleId, {
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
          }));
        },

        bulkHrAction: async (ids, action) => {
          if (get().mode === 'live') {
            if (action === 'edit') return;
            const companyId = get().activeCompanyId;
            await call((token) =>
              bulkHrActionAction(token, { companyId, itemIds: ids, action }),
            );
            return;
          }
          set((state) => ({
            planningItems: state.planningItems.map((i) =>
              ids.includes(i.id) && ['submitted', 'edited_pending'].includes(i.status)
                ? { ...i, status: applyHrAction(i.status, action), updatedAt: Date.now() }
                : i,
            ),
          }));
        },

        finalizeCycle: async (cycleId) => {
          if (get().mode === 'live') {
            const companyId = get().activeCompanyId;
            await call((token) => finalizeCycleAction(token, { companyId, cycleId }));
            return;
          }
          set((state) => {
            const items = state.planningItems.filter((i) => i.cycleId === cycleId);
            if (!canFinalize(items.map((i) => i.status))) return state;
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
          });
        },

        setAllocation: async (budgetId, amount) => {
          if (get().mode === 'live') {
            const companyId = get().activeCompanyId;
            await call((token) =>
              setBudgetAction(token, { companyId, budgetId, allocatedGross: amount }),
            );
            return;
          }
          set((state) => ({
            budgets: state.budgets.map((b) =>
              b.id === budgetId ? { ...b, allocatedGross: amount } : b,
            ),
          }));
        },

        resetDemo: () => set({ ...initial, planningItems: [] }),
      };
    },
    {
      name: 'freya-demo',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Live rejimdə data Firestore-dan gəlir — localStorage-a yalnız UI seçimləri yazılır.
      partialize: (state) =>
        state.mode === 'live'
          ? ({ role: state.role, activeCompanyId: state.activeCompanyId, activeCycleId: state.activeCycleId } as Partial<AppState>)
          : state,
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

/** Verilmiş strukturun özü + bütün alt strukturları (SRS §5.1 iyerarxiya). */
export function selectStructureSubtree(state: AppState, rootId: string): string[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    for (const s of state.structures) {
      if (s.parentId === ids[i] && !ids.includes(s.id)) ids.push(s.id);
    }
  }
  return ids;
}

/** Aktiv dövr — seçilməyibsə şirkətin ilk dövrü. */
export function selectActiveCycle(state: AppState): Cycle | null {
  const inCompany = state.cycles.filter((c) => c.companyId === state.activeCompanyId);
  return inCompany.find((c) => c.id === state.activeCycleId) ?? inCompany[0] ?? null;
}
