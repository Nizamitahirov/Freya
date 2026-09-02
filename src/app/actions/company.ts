'use server';

/**
 * company.ts — Şirkət yaratma, üzv dəvəti, büdcə təyini (SRS §4, §7, §16).
 */

import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { buildStarterDataset } from '@/lib/demo/starter';
import { writeAudit } from '@/lib/server/audit';
import { createCompanyInput, inviteMemberInput, setBudgetInput } from '@/lib/server/actionSchemas';
import { getCompany } from '@/lib/server/repo';
import {
  ActionError,
  fail,
  membershipId,
  requireMember,
  requireRole,
  verifyToken,
} from '@/lib/server/session';
import type { Membership } from '@/types';

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function slug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  return `${base || 'company'}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Yeni şirkət yaradır və yaradanı CompanyAdmin + HRAdmin + Manager kimi qeyd edir (SRS §4).
 * Bu, Firebase-ə ilk daxil olan istifadəçi üçün onboarding yoludur.
 */
export async function createCompanyAction(idToken: string, raw: unknown): Promise<Result<string>> {
  try {
    const input = createCompanyInput.parse(raw);
    const { uid } = await verifyToken(idToken);

    const companyId = slug(input.name);
    const dataset = buildStarterDataset({
      companyId,
      name: input.name,
      createdBy: uid,
      year: input.year,
      sector: input.sector,
      taxYear: input.taxYear,
      currency: input.currency,
      mealLimit: input.mealLimit,
      withSampleData: input.withSampleData,
    });

    const db = adminDb();
    const batch = db.batch();

    batch.set(db.collection('companies').doc(companyId), dataset.company);
    for (const s of dataset.structures) batch.set(db.collection('structures').doc(s.id), s);
    for (const g of dataset.grades) batch.set(db.collection('grades').doc(g.id), g);
    for (const e of dataset.employees) batch.set(db.collection('employees').doc(e.id), e);
    for (const b of dataset.budgets) batch.set(db.collection('budgets').doc(b.id), b);
    for (const c of dataset.cycles) batch.set(db.collection('cycles').doc(c.id), c);

    const membership: Membership = {
      id: membershipId(uid, companyId),
      userId: uid,
      companyId,
      roles: ['CompanyAdmin', 'HRAdmin', 'Manager'],
      structureIds: dataset.structures.map((s) => s.id),
      active: true,
    };
    batch.set(db.collection('memberships').doc(membership.id), membership);

    await batch.commit();

    await writeAudit(
      { uid, email: null, companyId, roles: membership.roles, structureIds: membership.structureIds },
      { entity: 'company', entityId: companyId, action: 'create', before: null, after: dataset.company },
    );

    return { ok: true, data: companyId };
  } catch (err) {
    return fail(err);
  }
}

/** Mövcud şirkətə üzv dəvəti / rol təyini (SRS §3, §4). */
export async function inviteMemberAction(idToken: string, raw: unknown): Promise<Result> {
  try {
    const input = inviteMemberInput.parse(raw);
    const session = await requireMember(idToken, input.companyId);
    requireRole(session, ['CompanyAdmin', 'PlatformOwner', 'HRAdmin'], 'Rol təyini');

    let userId: string;
    try {
      const user = await adminAuth().getUserByEmail(input.email);
      userId = user.uid;
    } catch {
      throw new ActionError(
        `${input.email} hələ sistemə daxil olmayıb — əvvəlcə hesab yaratmalıdır, sonra rol təyin edilə bilər.`,
      );
    }

    const membership: Membership = {
      id: membershipId(userId, input.companyId),
      userId,
      companyId: input.companyId,
      roles: input.roles,
      structureIds: input.structureIds,
      active: true,
    };
    await adminDb().collection('memberships').doc(membership.id).set(membership, { merge: true });
    await writeAudit(session, {
      entity: 'membership',
      entityId: membership.id,
      action: 'assignRole',
      before: null,
      after: membership,
    });

    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Struktura illik büdcə təyini (SRS §7.1). */
export async function setBudgetAction(idToken: string, raw: unknown): Promise<Result> {
  try {
    const input = setBudgetInput.parse(raw);
    const session = await requireMember(idToken, input.companyId);
    requireRole(session, ['CompanyAdmin', 'PlatformOwner', 'HRAdmin', 'Finance'], 'Büdcə təyini');

    await getCompany(input.companyId); // şirkətin mövcudluğunu təsdiqlə

    const ref = adminDb().collection('budgets').doc(input.budgetId);
    const snap = await ref.get();
    if (!snap.exists) throw new ActionError('Büdcə tapılmadı.');
    const before = snap.data();
    if (before?.companyId !== input.companyId) {
      throw new ActionError('Şirkətlərarası əməliyyat qadağandır.');
    }

    await ref.update({ allocatedGross: input.allocatedGross });
    await writeAudit(session, {
      entity: 'budget',
      entityId: input.budgetId,
      action: 'setAllocation',
      before: { allocatedGross: before?.allocatedGross },
      after: { allocatedGross: input.allocatedGross },
    });

    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
