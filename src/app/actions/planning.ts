'use server';

/**
 * planning.ts — Manager planlaşdırma mutasiyaları (SRS §9, §10, §16).
 *
 * Bütün rəqəmlər SERVERDƏ yenidən hesablanır (client dəyərlərinə inanılmır),
 * level max (§6.2) və status keçidləri (§10) serverdə yoxlanılır, hər mutasiya
 * audit log yazır (§13).
 */

import { adminDb } from '@/lib/firebase/admin';
import { computePlanningItem, validateItemBand } from '@/lib/comp';
import { applyManagerAction } from '@/lib/review/workflow';
import { writeAudit } from '@/lib/server/audit';
import { syncBudget } from '@/lib/server/budgetSync';
import {
  cycleRefInput,
  itemRefInput,
  savePlanningInput,
} from '@/lib/server/actionSchemas';
import {
  findItemFor,
  getCompany,
  getCycle,
  getEmployee,
  getGrades,
  getPlanningItem,
} from '@/lib/server/repo';
import {
  ActionError,
  fail,
  requireMember,
  requireRole,
  requireStructureAccess,
} from '@/lib/server/session';
import { planningItemSchema, type PlanningItem } from '@/types';

const PLANNER_ROLES = ['Manager', 'HRAdmin', 'CompanyAdmin', 'PlatformOwner'] as const;

type Result = { ok: true; id?: string } | { ok: false; error: string };

/** Sətri yaradır və ya redaktə edir (SRS §9). */
export async function savePlanningItemAction(idToken: string, raw: unknown): Promise<Result> {
  try {
    const input = savePlanningInput.parse(raw);
    const session = await requireMember(idToken, input.companyId);
    requireRole(session, [...PLANNER_ROLES], 'Draft yaratma');

    const [company, cycle, employee] = await Promise.all([
      getCompany(input.companyId),
      getCycle(input.cycleId),
      getEmployee(input.employeeId),
    ]);

    if (cycle.companyId !== input.companyId || employee.companyId !== input.companyId) {
      throw new ActionError('Şirkətlərarası əməliyyat qadağandır.');
    }
    if (cycle.status === 'finalized' || cycle.status === 'cancelled') {
      throw new ActionError('Bu dövr bağlanıb — dəyişiklik mümkün deyil.');
    }
    requireStructureAccess(session, employee.positionId);

    const existing = await findItemFor(cycle.id, employee.id);

    // §10.6 kilid: in_review zamanı yalnız "returned" sətir redaktə oluna bilər.
    if (existing) {
      const editable =
        cycle.status === 'in_review'
          ? existing.status === 'returned'
          : ['draft', 'returned'].includes(existing.status);
      if (!editable) {
        throw new ActionError(
          `Bu sətir hazırkı statusda (${existing.status}) redaktə oluna bilməz.`,
        );
      }
    }

    const computed = computePlanningItem(employee, company, cycle, {
      inputMode: input.inputMode,
      inputValue: input.inputValue,
      reason: input.reason,
      effectiveDate: input.effectiveDate,
      newGradeId: input.newGradeId ?? null,
      newLevelId: input.newLevelId ?? null,
      managerComment: input.managerComment,
    });

    // §6.2 — level max sərt bloklama (server tərəfi).
    const grades = await getGrades(input.companyId);
    const band = validateItemBand(computed, employee, grades);
    if (band.level === 'error') throw new ActionError(band.message ?? 'Band validasiyası uğursuz.');

    const db = adminDb();
    const id = existing?.id ?? db.collection('planningItems').doc().id;
    const item: PlanningItem = planningItemSchema.parse({
      ...computed,
      id,
      // Returned sətir düzəldiləndə status "draft"-a qayıdır və yenidən göndərilməlidir;
      // bu, yeni raundun başlanğıcıdır (SRS §10.1).
      status: 'draft',
      round: existing?.status === 'returned' ? existing.round + 1 : (existing?.round ?? 0),
      version: (existing?.version ?? 0) + 1,
      hrComment: existing?.hrComment ?? '',
    });

    await db.collection('planningItems').doc(id).set(item);
    await writeAudit(session, {
      entity: 'planningItem',
      entityId: id,
      action: existing ? 'update' : 'create',
      before: existing,
      after: item,
    });
    await syncBudget(input.companyId, cycle.structureId, cycle.year);

    return { ok: true, id };
  } catch (err) {
    return fail(err);
  }
}

/** Sətri silir — yalnız draft (SRS §10.2). */
export async function removePlanningItemAction(idToken: string, raw: unknown): Promise<Result> {
  try {
    const input = itemRefInput.parse(raw);
    const session = await requireMember(idToken, input.companyId);
    requireRole(session, [...PLANNER_ROLES], 'Sətir silmə');

    const item = await getPlanningItem(input.itemId);
    if (item.companyId !== input.companyId) throw new ActionError('Şirkətlərarası əməliyyat qadağandır.');
    requireStructureAccess(session, item.structureId);
    if (item.status !== 'draft') throw new ActionError('Yalnız draft sətir silinə bilər.');

    const cycle = await getCycle(item.cycleId);
    await adminDb().collection('planningItems').doc(item.id).delete();
    await writeAudit(session, {
      entity: 'planningItem',
      entityId: item.id,
      action: 'delete',
      before: item,
      after: null,
    });
    await syncBudget(input.companyId, cycle.structureId, cycle.year);

    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** "Review-ə göndər" — bütün draft sətirlər submitted olur, cycle in_review (SRS §10.1). */
export async function submitCycleAction(idToken: string, raw: unknown): Promise<Result> {
  try {
    const input = cycleRefInput.parse(raw);
    const session = await requireMember(idToken, input.companyId);
    requireRole(session, [...PLANNER_ROLES], 'Review-ə göndərmə');

    const cycle = await getCycle(input.cycleId);
    if (cycle.companyId !== input.companyId) throw new ActionError('Şirkətlərarası əməliyyat qadağandır.');
    if (cycle.status === 'finalized' || cycle.status === 'cancelled') {
      throw new ActionError('Bu dövr bağlanıb.');
    }

    const db = adminDb();
    const snap = await db
      .collection('planningItems')
      .where('cycleId', '==', cycle.id)
      .where('status', '==', 'draft')
      .get();
    if (snap.empty) throw new ActionError('Göndəriləcək draft sətir yoxdur.');

    const batch = db.batch();
    const now = Date.now();
    let count = 0;
    for (const doc of snap.docs) {
      const data = doc.data() as PlanningItem;
      // Manager yalnız öz strukturunun sətirlərini göndərə bilər.
      try {
        requireStructureAccess(session, data.structureId);
      } catch {
        continue;
      }
      batch.update(doc.ref, {
        status: applyManagerAction('draft', 'submit'),
        updatedAt: now,
        version: (data.version ?? 1) + 1,
      });
      count += 1;
    }
    if (count === 0) throw new ActionError('Sizin strukturunuzda göndəriləcək sətir yoxdur.');

    batch.update(db.collection('cycles').doc(cycle.id), {
      status: 'in_review',
      submittedAt: now,
      round: cycle.round + 1,
    });
    await batch.commit();

    await writeAudit(session, {
      entity: 'cycle',
      entityId: cycle.id,
      action: 'submit',
      before: { status: cycle.status, round: cycle.round },
      after: { status: 'in_review', round: cycle.round + 1, items: count },
    });
    await syncBudget(input.companyId, cycle.structureId, cycle.year);

    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Sətri geri çəkmək (SRS §10.2 — withdrawn). */
export async function withdrawItemAction(idToken: string, raw: unknown): Promise<Result> {
  try {
    const input = itemRefInput.parse(raw);
    const session = await requireMember(idToken, input.companyId);
    requireRole(session, [...PLANNER_ROLES], 'Geri çəkmə');

    const item = await getPlanningItem(input.itemId);
    if (item.companyId !== input.companyId) throw new ActionError('Şirkətlərarası əməliyyat qadağandır.');
    requireStructureAccess(session, item.structureId);

    let status: PlanningItem['status'];
    try {
      status = applyManagerAction(item.status, 'withdraw');
    } catch (e) {
      throw new ActionError(e instanceof Error ? e.message : 'Status keçidi qadağandır.');
    }
    const cycle = await getCycle(item.cycleId);
    await adminDb()
      .collection('planningItems')
      .doc(item.id)
      .update({ status, updatedAt: Date.now(), version: item.version + 1 });
    await writeAudit(session, {
      entity: 'planningItem',
      entityId: item.id,
      action: 'withdraw',
      before: { status: item.status },
      after: { status },
    });
    await syncBudget(input.companyId, cycle.structureId, cycle.year);

    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
