/**
 * actionSchemas.ts — Server action girişlərinin Zod validasiyası (SRS §16).
 *
 * Bu fayl `'use server'` DEYİL — həm client (tip üçün), həm server (validasiya üçün)
 * import edə bilsin deyə ayrı saxlanılır.
 */

import { z } from 'zod';
import { inputModeSchema, reasonSchema, roleSchema, sectorSchema, taxYearSchema } from '@/types';

export const savePlanningInput = z.object({
  companyId: z.string().min(1),
  cycleId: z.string().min(1),
  employeeId: z.string().min(1),
  inputMode: inputModeSchema,
  inputValue: z.number().finite(),
  reason: reasonSchema,
  effectiveDate: z.string().optional(),
  newGradeId: z.string().nullable().optional(),
  newLevelId: z.string().nullable().optional(),
  managerComment: z.string().max(2000).optional(),
});
export type SavePlanningInput = z.infer<typeof savePlanningInput>;

export const itemRefInput = z.object({
  companyId: z.string().min(1),
  itemId: z.string().min(1),
});

export const cycleRefInput = z.object({
  companyId: z.string().min(1),
  cycleId: z.string().min(1),
});

export const hrActionInput = z.object({
  companyId: z.string().min(1),
  itemId: z.string().min(1),
  action: z.enum(['approve', 'reject', 'return', 'edit']),
  hrComment: z.string().max(2000).optional(),
  /** `edit` üçün HR-ın təyin etdiyi yeni net. */
  newNet: z.number().positive().optional(),
});
export type HrActionInput = z.infer<typeof hrActionInput>;

export const bulkHrActionInput = z.object({
  companyId: z.string().min(1),
  itemIds: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(['approve', 'reject', 'return']),
  hrComment: z.string().max(2000).optional(),
});

export const setBudgetInput = z.object({
  companyId: z.string().min(1),
  budgetId: z.string().min(1),
  allocatedGross: z.number().nonnegative(),
});

export const createCompanyInput = z.object({
  name: z.string().min(2).max(120),
  sector: sectorSchema.default('private'),
  taxYear: taxYearSchema.default('2026'),
  currency: z.string().min(1).max(8).default('AZN'),
  mealLimit: z.number().nonnegative().default(100),
  year: z.number().int().min(2024).max(2100).default(2026),
  withSampleData: z.boolean().default(true),
});
export type CreateCompanyInput = z.infer<typeof createCompanyInput>;

export const inviteMemberInput = z.object({
  companyId: z.string().min(1),
  email: z.string().email(),
  roles: z.array(roleSchema).min(1),
  structureIds: z.array(z.string()).default([]),
});
