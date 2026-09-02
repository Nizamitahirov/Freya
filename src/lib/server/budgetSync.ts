import 'server-only';

/**
 * budgetSync.ts — Büdcə sənədinin (committed / spent) yenilənməsi (SRS §7.2, §7.3).
 *
 * Hər mutasiyadan sonra strukturun büdcəsi bütün plan sətirlərindən YENİDƏN hesablanır.
 * Beləliklə inkremental toplama xətaları (ikiqat commit / azad etməmək) mümkün olmur:
 *   committed = draft/submitted/returned/edited_pending/approved (finalize olunmamış dövrlər)
 *   spent     = approved (finalize olunmuş dövrlər)
 */

import { adminDb } from '@/lib/firebase/admin';
import { cycleSchema, planningItemSchema, type Cycle, type PlanningItem } from '@/types';

const COMMITTED_STATUSES = ['draft', 'submitted', 'returned', 'edited_pending', 'approved'];

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Strukturun büdcəsini yenidən hesablayıb büdcə sənədinə yazır. */
export async function syncBudget(
  companyId: string,
  structureId: string,
  year: number,
): Promise<void> {
  const db = adminDb();

  const budgetSnap = await db
    .collection('budgets')
    .where('companyId', '==', companyId)
    .where('structureId', '==', structureId)
    .where('year', '==', year)
    .limit(1)
    .get();
  if (budgetSnap.empty) return; // büdcə təyin olunmayıbsa sinxronlaşdırılacaq bir şey yoxdur

  const cyclesSnap = await db
    .collection('cycles')
    .where('companyId', '==', companyId)
    .where('structureId', '==', structureId)
    .where('year', '==', year)
    .get();

  const cycles: Cycle[] = cyclesSnap.docs
    .map((d) => cycleSchema.safeParse({ id: d.id, ...d.data() }))
    .filter((r): r is { success: true; data: Cycle } => r.success)
    .map((r) => r.data);

  let committed = 0;
  let spent = 0;

  for (const cycle of cycles) {
    const itemsSnap = await db.collection('planningItems').where('cycleId', '==', cycle.id).get();
    const items: PlanningItem[] = itemsSnap.docs
      .map((d) => planningItemSchema.safeParse({ id: d.id, ...d.data() }))
      .filter((r): r is { success: true; data: PlanningItem } => r.success)
      .map((r) => r.data);

    for (const item of items) {
      if (cycle.status === 'finalized') {
        if (item.status === 'approved') spent += item.deltaGrossAnnual;
      } else if (COMMITTED_STATUSES.includes(item.status)) {
        committed += item.deltaGrossAnnual;
      }
    }
  }

  await budgetSnap.docs[0].ref.update({
    committedGross: round2(committed),
    spentGross: round2(spent),
  });
}
