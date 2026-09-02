/**
 * schemas.ts — Domen data modeli: Zod schema → TS type (SRS §13).
 *
 * Gradex pattern-i: hər Firestore sənədi üçün Zod schema mənbədir; TS tipi
 * ondan `z.infer` ilə çıxarılır. Server-side validasiya da bu schemalardan gedir.
 */

import { z } from 'zod';

// ─────────────────────────────── Enum-lar ──────────────────────────────────

export const roleSchema = z.enum([
  'PlatformOwner',
  'CompanyAdmin',
  'HRAdmin',
  'HRReviewer',
  'Finance',
  'Manager',
  'Viewer',
]);
export type Role = z.infer<typeof roleSchema>;

export const sectorSchema = z.enum(['private', 'public', 'texnopark']);
export const workplaceSchema = z.enum(['main', 'secondary']);
export const taxYearSchema = z.enum(['2025', '2026']);

export const structureTypeSchema = z.enum(['division', 'department', 'team', 'position']);

export const inputModeSchema = z.enum(['percent', 'amount', 'absolute']);
export const reasonSchema = z.enum([
  'merit',
  'promotion',
  'market_adjustment',
  'retention',
  'correction',
]);

export const itemStatusSchema = z.enum([
  'draft',
  'submitted',
  'approved',
  'rejected',
  'returned',
  'edited_pending',
  'withdrawn',
]);

export const cycleStatusSchema = z.enum([
  'open',
  'in_review',
  'changes_requested',
  'finalized',
  'cancelled',
]);

// ────────────────────────────── companies ───────────────────────────────────

export const companySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  country: z.string().default('AZ'),
  currency: z.string().default('AZN'),
  fiscalYearStart: z.number().int().min(1).max(12).default(1),
  taxProfile: z.object({ sector: sectorSchema, year: taxYearSchema }),
  mealLimit: z.number().nonnegative().default(100),
  minGrossDiff: z.object({ branch: z.number().default(20), hq: z.number().default(50) }),
  createdBy: z.string(),
  createdAt: z.number(),
});
export type Company = z.infer<typeof companySchema>;

// ────────────────────────────── memberships ─────────────────────────────────

export const membershipSchema = z.object({
  id: z.string(), // `${userId}_${companyId}`
  userId: z.string(),
  companyId: z.string(),
  roles: z.array(roleSchema).default([]),
  structureIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});
export type Membership = z.infer<typeof membershipSchema>;

// ────────────────────────────── structures ──────────────────────────────────

export const structureSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  type: structureTypeSchema,
  parentId: z.string().nullable(),
  name: z.string().min(1),
  managerIds: z.array(z.string()).default([]),
  reviewerIds: z.array(z.string()).default([]),
  approvalChain: z.array(z.string()).default([]),
  archived: z.boolean().default(false),
});
export type Structure = z.infer<typeof structureSchema>;

// ──────────────────────────────── grades ────────────────────────────────────

export const levelSchema = z.object({
  id: z.string(),
  name: z.string(),
  min: z.number().nonnegative(),
  mid: z.number().nonnegative(),
  max: z.number().nonnegative(),
});
export type Level = z.infer<typeof levelSchema>;

export const gradeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  order: z.number().int(),
  levels: z.array(levelSchema).default([]),
});
export type Grade = z.infer<typeof gradeSchema>;

// ─────────────────────────────── employees ──────────────────────────────────

export const compContextSchema = z.object({
  sector: sectorSchema,
  workplace: workplaceSchema,
  benefit: z.number().nonnegative().default(200),
  unionPct: z.number().min(0).max(100).default(0),
});
export type CompContextData = z.infer<typeof compContextSchema>;

export const employeeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  positionId: z.string(),
  gradeId: z.string(),
  levelId: z.string(),
  badge: z.string(),
  fullName: z.string().min(1),
  currentNet: z.number().nonnegative(),
  currentGross: z.number().nonnegative(),
  currentSuperGross: z.number().nonnegative(),
  currentMeal: z.number().nonnegative().default(0),
  currency: z.string().default('AZN'),
  ctx: compContextSchema,
  /** Baş ofis / filial — minimum gross artım fərqi üçün (BirCalc `isHead`, SRS §11.7). */
  office: z.enum(['hq', 'branch']).default('branch'),
  effectiveDate: z.string(), // ISO
});
export type Employee = z.infer<typeof employeeSchema>;

// ──────────────────────────────── budgets ───────────────────────────────────

export const budgetSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  structureId: z.string(),
  year: z.number().int(),
  allocatedGross: z.number().nonnegative(),
  committedGross: z.number().default(0),
  spentGross: z.number().default(0),
});
export type Budget = z.infer<typeof budgetSchema>;

// ──────────────────────────────── cycles ────────────────────────────────────

export const cycleSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  structureId: z.string(),
  year: z.number().int(),
  name: z.string(),
  status: cycleStatusSchema.default('open'),
  round: z.number().int().default(0),
  createdBy: z.string(),
  createdAt: z.number(),
  submittedAt: z.number().nullable().default(null),
  finalizedAt: z.number().nullable().default(null),
});
export type Cycle = z.infer<typeof cycleSchema>;

// ───────────────────────────── planningItems ────────────────────────────────

export const planningItemSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  cycleId: z.string(),
  employeeId: z.string(),
  structureId: z.string(),
  inputMode: inputModeSchema,
  inputValue: z.number(),
  currentNet: z.number().nonnegative(),
  newNet: z.number().nonnegative(),
  newGross: z.number().nonnegative(),
  newSuperGross: z.number().nonnegative(),
  newMeal: z.number().nonnegative(),
  newGradeId: z.string().nullable().default(null),
  newLevelId: z.string().nullable().default(null),
  effectiveDate: z.string(),
  effectiveMonths: z.number().min(0).max(12),
  deltaGrossAnnual: z.number(),
  reason: reasonSchema,
  status: itemStatusSchema.default('draft'),
  round: z.number().int().default(0),
  hrComment: z.string().default(''),
  managerComment: z.string().default(''),
  version: z.number().int().default(1),
  updatedAt: z.number(),
});
export type PlanningItem = z.infer<typeof planningItemSchema>;

// ─────────────────────────────── marketData ─────────────────────────────────

export const marketDataSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  gradeId: z.string(),
  position: z.string(),
  p25: z.number().nonnegative(),
  p50: z.number().nonnegative(),
  p75: z.number().nonnegative(),
  p90: z.number().nonnegative(),
  source: z.string(),
  year: z.number().int(),
});
export type MarketData = z.infer<typeof marketDataSchema>;

// ──────────────────────────────── auditLog ──────────────────────────────────

export const auditLogSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  entity: z.string(),
  entityId: z.string(),
  action: z.string(),
  actorId: z.string(),
  actorRole: roleSchema,
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  timestamp: z.number(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;
