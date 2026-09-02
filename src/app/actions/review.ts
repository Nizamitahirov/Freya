'use server';

/**
 * review.ts — HR review mutasiyaları (SRS §10, §16).
 *
 * Row-level approve / reject / return / edit, bulk aksiya və finalize.
 * Status keçidləri pure state machine ilə (lib/review/workflow), rol yoxlaması
 * membership-dən, hər addım audit log-a yazılır.
 */

import { adminDb } from '@/lib/firebase/admin';
import { computePlanningItem, validateItemBand } from '@/lib/comp';
import { applyHrAction, canFinalize } from '@/lib/review/workflow';
import { auditDoc, writeAudit } from '@/lib/server/audit';
import { syncBudget } from '@/lib/server/budgetSync';
import { bulkHrActionInput, cycleRefInput, hrActionInput } from '@/lib/server/actionSchemas';
import {
  getCompany,
  getCycle,
  getCycleItems,
  getEmployee,
  getGrades,
  getPlanningItem,
  getStructureBudget,
} from '@/lib/server/repo';
import { ActionError, fail, requireMember, requireRole } from '@/lib/server/session';
import { planningItemSchema, type PlanningItem } from '@/types';

const REVIEWER_ROLES = ['HRAdmin', 'HRReviewer', 'CompanyAdmin', 'PlatformOwner'] as const;
const FINALIZER_ROLES = ['HRAdmin', 'Finance', 'CompanyAdmin', 'PlatformOwner'] as const;

type Result = { ok: true; count?: number } | { ok: false; error: string };

/** Bir sətir üzrə HR aksiyası (SRS §10.1, §10.4). */
export async function hrActionAction(idToken: string, raw: unknown): Promise<Result> {
  try {
    const input = hrActionInput.parse(raw);
    const session = await requireMember(idToken, input.companyId);
    requireRole(session, [...REVIEWER_ROLES], 'Row approve/reject');

    const item = await getPlanningItem(input.itemId);
    if (item.companyId !== input.companyId) throw new ActionError('Şirkətlərarası əməliyyat qadağandır.');

    const cycle = await getCycle(item.cycleId);
    if (cycle.status === 'finalized' || cycle.status === 'cancelled') {
      throw new ActionError('Bu dövr bağlanıb.');
    }

    // Status keçidi pure state machine ilə yoxlanılır (qeyri-qanuni keçiddə xəta atır).
    let status: PlanningItem['status'];
    try {
      status = applyHrAction(item.status, input.action);
    } catch (e) {
      throw new ActionError(e instanceof Error ? e.message : 'Status keçidi qadağandır.');
    }

    let next: PlanningItem = {
      ...item,
      status,
      hrComment: input.hrComment ?? item.hrComment,
      updatedAt: Date.now(),
      version: item.version + 1,
    };

    // HR "edit" — dəyər serverdə yenidən hesablanır (client rəqəminə inanılmır).
    if (input.action === 'edit') {
      if (input.newNet === undefined) throw new ActionError('Redaktə üçün yeni net göndərilməyib.');
      const [company, employee, grades] = await Promise.all([
        getCompany(input.companyId),
        getEmployee(item.employeeId),
        getGrades(input.companyId),
      ]);
      const computed = computePlanningItem(employee, company, cycle, {
        inputMode: 'absolute',
        inputValue: input.newNet,
        reason: item.reason,
        effectiveDate: item.effectiveDate,
        newGradeId: item.newGradeId,
        newLevelId: item.newLevelId,
        managerComment: item.managerComment,
      });
      const band = validateItemBand(computed, employee, grades);
      if (band.level === 'error') throw new ActionError(band.message ?? 'Band validasiyası uğursuz.');
      next = planningItemSchema.parse({
        ...computed,
        id: item.id,
        status,
        round: item.round,
        version: item.version + 1,
        hrComment: input.hrComment ?? item.hrComment,
      });
    }

    await adminDb().collection('planningItems').doc(item.id).set(next);
    await writeAudit(session, {
      entity: 'planningItem',
      entityId: item.id,
      action: `hr:${input.action}`,
      before: item,
      after: next,
    });
    await syncBudget(input.companyId, cycle.structureId, cycle.year);

    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Bulk approve / reject / return (SRS §10.4). */
export async function bulkHrActionAction(idToken: string, raw: unknown): Promise<Result> {
  try {
    const input = bulkHrActionInput.parse(raw);
    const session = await requireMember(idToken, input.companyId);
    requireRole(session, [...REVIEWER_ROLES], 'Bulk approve/reject');

    const db = adminDb();
    const batch = db.batch();
    const now = Date.now();
    const touchedCycles = new Set<string>();
    let count = 0;

    for (const id of input.itemIds) {
      const item = await getPlanningItem(id);
      if (item.companyId !== input.companyId) continue;
      if (item.status !== 'submitted' && item.status !== 'edited_pending') continue;

      const status = applyHrAction(item.status, input.action);
      const after = {
        status,
        hrComment: input.hrComment ?? item.hrComment,
        updatedAt: now,
        version: item.version + 1,
      };
      batch.update(db.collection('planningItems').doc(id), after);

      const audit = auditDoc(session, {
        entity: 'planningItem',
        entityId: id,
        action: `hr:bulk:${input.action}`,
        before: { status: item.status },
        after: { status },
      });
      batch.set(audit.ref, audit.data);

      touchedCycles.add(item.cycleId);
      count += 1;
    }

    if (count === 0) throw new ActionError('Seçilmiş sətirlərdən heç biri bu aksiyaya uyğun deyil.');
    await batch.commit();

    for (const cycleId of touchedCycles) {
      const cycle = await getCycle(cycleId);
      await syncBudget(input.companyId, cycle.structureId, cycle.year);
    }

    return { ok: true, count };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Finalize (SRS §10.1, §7.3):
 *  - bütün sətirlər terminal olmalıdır,
 *  - approved sətirlərin dəyəri əməkdaş kartına köçürülür,
 *  - committed → spent (büdcə sinxronu),
 *  - over-budget olduqda yalnız HRAdmin/Finance təsdiqləyə bilər (§7.4).
 */
export async function finalizeCycleAction(idToken: string, raw: unknown): Promise<Result> {
  try {
    const input = cycleRefInput.parse(raw);
    const session = await requireMember(idToken, input.companyId);
    requireRole(session, [...FINALIZER_ROLES], 'Finalize');

    const cycle = await getCycle(input.cycleId);
    if (cycle.companyId !== input.companyId) throw new ActionError('Şirkətlərarası əməliyyat qadağandır.');
    if (cycle.status === 'finalized') throw new ActionError('Bu dövr artıq finalize olunub.');
    if (cycle.status === 'cancelled') throw new ActionError('Bu dövr ləğv edilib.');

    const items = await getCycleItems(cycle.id);
    if (!canFinalize(items.map((i) => i.status))) {
      throw new ActionError('Bütün sətirlər approved/rejected olmayana qədər finalize mümkün deyil.');
    }

    // §7.4 — over-budget finalize üçün Finance/HRAdmin tələb olunur.
    const budget = await getStructureBudget(input.companyId, cycle.structureId, cycle.year);
    if (budget) {
      const approvedDelta = items
        .filter((i) => i.status === 'approved')
        .reduce((s, i) => s + i.deltaGrossAnnual, 0);
      if (budget.allocatedGross - budget.spentGross - approvedDelta < 0) {
        requireRole(
          session,
          ['HRAdmin', 'Finance', 'PlatformOwner'],
          'Büdcə aşılmış dövrün finalize edilməsi',
        );
      }
    }

    const db = adminDb();
    const batch = db.batch();
    const now = Date.now();

    for (const item of items.filter((i) => i.status === 'approved')) {
      const employee = await getEmployee(item.employeeId);
      const after = {
        currentNet: item.newNet,
        currentGross: item.newGross,
        currentSuperGross: item.newSuperGross,
        currentMeal: item.newMeal,
        gradeId: item.newGradeId ?? employee.gradeId,
        levelId: item.newLevelId ?? employee.levelId,
        effectiveDate: item.effectiveDate,
      };
      batch.update(db.collection('employees').doc(employee.id), after);

      const audit = auditDoc(session, {
        entity: 'employee',
        entityId: employee.id,
        action: 'finalize:apply',
        before: {
          currentNet: employee.currentNet,
          currentGross: employee.currentGross,
          currentSuperGross: employee.currentSuperGross,
          currentMeal: employee.currentMeal,
          gradeId: employee.gradeId,
          levelId: employee.levelId,
        },
        after,
      });
      batch.set(audit.ref, audit.data);
    }

    batch.update(db.collection('cycles').doc(cycle.id), {
      status: 'finalized',
      finalizedAt: now,
    });
    const cycleAudit = auditDoc(session, {
      entity: 'cycle',
      entityId: cycle.id,
      action: 'finalize',
      before: { status: cycle.status },
      after: { status: 'finalized', approved: items.filter((i) => i.status === 'approved').length },
    });
    batch.set(cycleAudit.ref, cycleAudit.data);

    await batch.commit();
    await syncBudget(input.companyId, cycle.structureId, cycle.year);

    return { ok: true, count: items.filter((i) => i.status === 'approved').length };
  } catch (err) {
    return fail(err);
  }
}
