import { describe, it, expect } from 'vitest';
import {
  remaining,
  summarize,
  commitDraft,
  releaseDraft,
  finalizeItem,
  isOverBudget,
  type BudgetState,
} from './budget';

const base: BudgetState = { allocatedGross: 100000, committedGross: 0, spentGross: 0 };

describe('budget (SRS §7)', () => {
  it('remaining = allocated − committed − spent', () => {
    expect(remaining({ allocatedGross: 100000, committedGross: 20000, spentGross: 10000 })).toBe(70000);
  });

  it('commitDraft rezerv əlavə edir (committed)', () => {
    const b = commitDraft(base, 15000);
    expect(b.committedGross).toBe(15000);
    expect(remaining(b)).toBe(85000);
  });

  it('releaseDraft rezervi azad edir', () => {
    let b = commitDraft(base, 15000);
    b = releaseDraft(b, 15000);
    expect(b.committedGross).toBe(0);
  });

  it('finalizeItem committed → spent keçirir (SRS §10.1)', () => {
    let b = commitDraft(base, 20000);
    b = finalizeItem(b, 20000);
    expect(b.committedGross).toBe(0);
    expect(b.spentGross).toBe(20000);
  });

  it('progress statusu: ok / warning / over (SRS §7.4)', () => {
    expect(summarize({ allocatedGross: 100000, committedGross: 50000, spentGross: 0 }).status).toBe('ok');
    expect(summarize({ allocatedGross: 100000, committedGross: 85000, spentGross: 0 }).status).toBe('warning');
    expect(summarize({ allocatedGross: 100000, committedGross: 120000, spentGross: 0 }).status).toBe('over');
  });

  it('isOverBudget mənfi qalıqda true', () => {
    expect(isOverBudget({ allocatedGross: 100, committedGross: 80, spentGross: 40 })).toBe(true);
  });
});
