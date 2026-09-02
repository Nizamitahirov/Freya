import 'server-only';

/**
 * repo.ts — Server tərəfi Firestore oxuma köməkçiləri (SRS §13, §16).
 *
 * Server action-lar mutasiyadan əvvəl həqiqi vəziyyəti buradan oxuyur:
 * client-dən gələn rəqəmlər deyil, Firestore-dakı data mənbədir.
 */

import { adminDb } from '@/lib/firebase/admin';
import { ActionError } from './session';
import {
  budgetSchema,
  companySchema,
  cycleSchema,
  employeeSchema,
  gradeSchema,
  planningItemSchema,
  type Budget,
  type Company,
  type Cycle,
  type Employee,
  type Grade,
  type PlanningItem,
} from '@/types';
import type { z } from 'zod';

async function one<S extends z.ZodTypeAny>(
  collection: string,
  id: string,
  schema: S,
  label: string,
): Promise<z.infer<S>> {
  const snap = await adminDb().collection(collection).doc(id).get();
  if (!snap.exists) throw new ActionError(`${label} tapılmadı (${id}).`);
  const parsed = schema.safeParse({ id: snap.id, ...snap.data() });
  if (!parsed.success) throw new ActionError(`${label} sənədi xətalıdır (${id}).`);
  return parsed.data;
}

export const getCompany = (id: string) => one('companies', id, companySchema, 'Şirkət') as Promise<Company>;
export const getEmployee = (id: string) => one('employees', id, employeeSchema, 'Əməkdaş') as Promise<Employee>;
export const getCycle = (id: string) => one('cycles', id, cycleSchema, 'Dövr') as Promise<Cycle>;
export const getPlanningItem = (id: string) =>
  one('planningItems', id, planningItemSchema, 'Plan sətri') as Promise<PlanningItem>;

export async function getGrades(companyId: string): Promise<Grade[]> {
  const snap = await adminDb().collection('grades').where('companyId', '==', companyId).get();
  return snap.docs
    .map((d) => gradeSchema.safeParse({ id: d.id, ...d.data() }))
    .filter((r): r is { success: true; data: Grade } => r.success)
    .map((r) => r.data);
}

export async function getCycleItems(cycleId: string): Promise<PlanningItem[]> {
  const snap = await adminDb().collection('planningItems').where('cycleId', '==', cycleId).get();
  return snap.docs
    .map((d) => planningItemSchema.safeParse({ id: d.id, ...d.data() }))
    .filter((r): r is { success: true; data: PlanningItem } => r.success)
    .map((r) => r.data);
}

export async function getStructureBudget(
  companyId: string,
  structureId: string,
  year: number,
): Promise<Budget | null> {
  const snap = await adminDb()
    .collection('budgets')
    .where('companyId', '==', companyId)
    .where('structureId', '==', structureId)
    .where('year', '==', year)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const parsed = budgetSchema.safeParse({ id: d.id, ...d.data() });
  return parsed.success ? parsed.data : null;
}

/** Bir əməkdaşın bir dövrdəki mövcud sətri (varsa). */
export async function findItemFor(
  cycleId: string,
  employeeId: string,
): Promise<PlanningItem | null> {
  const snap = await adminDb()
    .collection('planningItems')
    .where('cycleId', '==', cycleId)
    .where('employeeId', '==', employeeId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const parsed = planningItemSchema.safeParse({ id: d.id, ...d.data() });
  return parsed.success ? parsed.data : null;
}
