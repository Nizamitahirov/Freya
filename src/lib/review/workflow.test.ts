import { describe, it, expect } from 'vitest';
import {
  applyHrAction,
  applyManagerAction,
  managerCanEdit,
  canFinalize,
  canTransitionCycle,
  isTerminal,
} from './workflow';

describe('workflow — HR aksiyaları (SRS §10)', () => {
  it('approve → approved', () => {
    expect(applyHrAction('submitted', 'approve')).toBe('approved');
  });
  it('reject → rejected', () => {
    expect(applyHrAction('submitted', 'reject')).toBe('rejected');
  });
  it('return → returned', () => {
    expect(applyHrAction('submitted', 'return')).toBe('returned');
  });
  it('draft sətrə HR aksiyası olmaz', () => {
    expect(() => applyHrAction('draft', 'approve')).toThrow();
  });
});

describe('workflow — Manager aksiyaları', () => {
  it('draft → submit → submitted', () => {
    expect(applyManagerAction('draft', 'submit')).toBe('submitted');
  });
  it('returned → resubmit → submitted', () => {
    expect(applyManagerAction('returned', 'resubmit')).toBe('submitted');
  });
  it('terminal sətir geri çəkilə bilməz', () => {
    expect(() => applyManagerAction('approved', 'withdraw')).toThrow();
  });
});

describe('workflow — kilid və finalize (SRS §10.6, §10.1)', () => {
  it('in_review-də manager yalnız returned redaktə edir', () => {
    expect(managerCanEdit('returned', 'in_review')).toBe(true);
    expect(managerCanEdit('submitted', 'in_review')).toBe(false);
  });
  it('bütün sətirlər terminal olduqda finalize mümkündür', () => {
    expect(canFinalize(['approved', 'rejected'])).toBe(true);
    expect(canFinalize(['approved', 'submitted'])).toBe(false);
    expect(canFinalize([])).toBe(false);
  });
  it('isTerminal', () => {
    expect(isTerminal('approved')).toBe(true);
    expect(isTerminal('returned')).toBe(false);
  });
});

describe('workflow — cycle keçidləri (SRS §10.3)', () => {
  it('icazəli keçidlər', () => {
    expect(canTransitionCycle('open', 'in_review')).toBe(true);
    expect(canTransitionCycle('in_review', 'finalized')).toBe(true);
    expect(canTransitionCycle('changes_requested', 'in_review')).toBe(true);
  });
  it('finalized terminaldır', () => {
    expect(canTransitionCycle('finalized', 'in_review')).toBe(false);
  });
});
