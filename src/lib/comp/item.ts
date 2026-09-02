/**
 * item.ts — planningItem sahələrinin hesablanması (SRS §9, §11).
 *
 * PURE funksiya: həm client store, həm də server action eyni bu funksiyanı çağırır ki,
 * serverdə yenidən hesablanan dəyər client-dəki ilə eyni olsun (client rəqəmlərinə
 * inanılmır — SRS §16 server-side validasiya).
 */

import { planCompensation, type InputMode } from './plan';
import { validateAgainstBand, type CompContext } from './engine';
import type { Company, Cycle, Employee, Grade, PlanningItem } from '@/types';

export type PlanPatch = {
  inputMode: InputMode;
  inputValue: number;
  reason: PlanningItem['reason'];
  effectiveDate?: string;
  newGradeId?: string | null;
  newLevelId?: string | null;
  managerComment?: string;
};

/** Hesablanan sahələr — status/round/version kimi workflow sahələri daxil deyil. */
export type ComputedItem = Omit<
  PlanningItem,
  'id' | 'status' | 'round' | 'version' | 'hrComment'
>;

/** effectiveDate-dən il sonuna qədər ay sayı (SRS §7.3, §23). */
export function monthsToYearEnd(effectiveDateISO: string, year: number): number {
  const d = new Date(effectiveDateISO);
  if (Number.isNaN(d.getTime())) return 12;
  if (d.getUTCFullYear() > year) return 0;
  const startMonth = d.getUTCFullYear() === year ? d.getUTCMonth() : 0; // 0-indexed
  return Math.max(0, 12 - startMonth);
}

export function computePlanningItem(
  emp: Employee,
  company: Company,
  cycle: Cycle,
  patch: PlanPatch,
): ComputedItem {
  const effectiveDate = patch.effectiveDate ?? `${cycle.year}-01-01`;
  const effectiveMonths = monthsToYearEnd(effectiveDate, cycle.year);
  const ctx: CompContext = { ...emp.ctx, year: company.taxProfile.year };

  const result = planCompensation({
    mode: patch.inputMode,
    value: patch.inputValue,
    currentNet: emp.currentNet,
    currentGross: emp.currentGross,
    currentMeal: emp.currentMeal,
    ctx,
    mealLimit: company.mealLimit,
    effectiveMonths,
  });

  return {
    companyId: emp.companyId,
    cycleId: cycle.id,
    employeeId: emp.id,
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

/**
 * Level max validasiyası (SRS §6.2) — planlaşdırılan grade/level üzrə.
 * Yeni grade/level verilibsə ona, verilməyibsə əməkdaşın cari grade/level-inə baxılır.
 */
export function validateItemBand(
  item: Pick<ComputedItem, 'newGross' | 'newGradeId' | 'newLevelId'>,
  emp: Employee,
  grades: Grade[],
) {
  const gradeId = item.newGradeId ?? emp.gradeId;
  const levelId = item.newLevelId ?? emp.levelId;
  const level = grades.find((g) => g.id === gradeId)?.levels.find((l) => l.id === levelId);
  if (!level) return { ok: true, level: 'ok' as const, message: undefined };
  return validateAgainstBand(item.newGross, level);
}
