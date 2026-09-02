/**
 * workflow.ts — Review axını state machine (SRS §10). Pure keçid məntiqi.
 *
 * Sətir (planningItem) və cycle statuslarının icazəli keçidlərini idarə edir.
 */

export type ItemStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'edited_pending'
  | 'withdrawn';

export type CycleStatus =
  | 'open'
  | 'in_review'
  | 'changes_requested'
  | 'finalized'
  | 'cancelled';

export type HrAction = 'approve' | 'reject' | 'return' | 'edit';
export type ManagerAction = 'submit' | 'withdraw' | 'resubmit';

/** Terminal (dəyişməz) sətir statusları. */
export const TERMINAL_ITEM_STATUSES: ItemStatus[] = ['approved', 'rejected'];

export function isTerminal(status: ItemStatus): boolean {
  return TERMINAL_ITEM_STATUSES.includes(status);
}

/** HR sətir üzrə aksiya alır (SRS §10.1–10.2). */
export function applyHrAction(current: ItemStatus, action: HrAction): ItemStatus {
  if (current !== 'submitted' && current !== 'edited_pending') {
    throw new Error(`HR aksiyası yalnız 'submitted'/'edited_pending' sətirlərə tətbiq olunur (cari: ${current})`);
  }
  switch (action) {
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    case 'return':
      return 'returned';
    case 'edit':
      return 'edited_pending';
  }
}

/** Manager sətir üzrə aksiya alır. */
export function applyManagerAction(current: ItemStatus, action: ManagerAction): ItemStatus {
  switch (action) {
    case 'submit':
      if (current !== 'draft') throw new Error(`Yalnız 'draft' göndərilə bilər (cari: ${current})`);
      return 'submitted';
    case 'resubmit':
      if (current !== 'returned') throw new Error(`Yalnız 'returned' yenidən göndərilə bilər (cari: ${current})`);
      return 'submitted';
    case 'withdraw':
      if (isTerminal(current)) throw new Error(`Terminal sətir geri çəkilə bilməz (cari: ${current})`);
      return 'withdrawn';
  }
}

/** Managerin bu statusda sətri redaktə edə bilməsi (SRS §10.6 — kilid). */
export function managerCanEdit(item: ItemStatus, cycle: CycleStatus): boolean {
  if (cycle === 'in_review') return item === 'returned';
  return item === 'draft' || item === 'returned';
}

/** Bütün sətirlər terminal olduqda cycle finalize edilə bilər (SRS §10.1). */
export function canFinalize(items: ItemStatus[]): boolean {
  return items.length > 0 && items.every(isTerminal);
}

/** Cycle statusunun keçid xəritəsi (SRS §10.3). */
const CYCLE_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  open: ['in_review', 'cancelled'],
  in_review: ['changes_requested', 'finalized', 'cancelled'],
  changes_requested: ['in_review', 'cancelled'],
  finalized: [],
  cancelled: [],
};

export function canTransitionCycle(from: CycleStatus, to: CycleStatus): boolean {
  return CYCLE_TRANSITIONS[from].includes(to);
}
