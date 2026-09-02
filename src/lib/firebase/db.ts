'use client';

/**
 * db.ts — Firestore realtime oxuma qatı (SRS §13, §15).
 *
 * Bütün query-lər `companyId` ilə məhdudlaşır (multi-tenant izolyasiya, §4) və
 * Manager üçün əlavə olaraq `structureId` filteri tətbiq olunur — belə ki, sorğu
 * Firestore rules-un icazə verdiyi sahədən kənara çıxmır (§3.2 row-level security).
 */

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './client';
import {
  budgetSchema,
  companySchema,
  cycleSchema,
  employeeSchema,
  gradeSchema,
  marketDataSchema,
  membershipSchema,
  planningItemSchema,
  structureSchema,
  type Budget,
  type Company,
  type Cycle,
  type Employee,
  type Grade,
  type MarketData,
  type Membership,
  type PlanningItem,
  type Role,
  type Structure,
} from '@/types';
import type { z } from 'zod';

const PRIVILEGED: Role[] = ['PlatformOwner', 'CompanyAdmin', 'HRAdmin', 'HRReviewer', 'Finance'];

function requireDb() {
  if (!db) throw new Error('Firestore konfiqurasiya olunmayıb (NEXT_PUBLIC_FIREBASE_* env).');
  return db;
}

/** Snapshot sənədlərini schema ilə parse edir; xətalı sənəd atılır və konsola yazılır. */
function parseAll<S extends z.ZodTypeAny>(docs: QueryDocumentSnapshot[], schema: S): z.infer<S>[] {
  const out: z.infer<S>[] = [];
  for (const d of docs) {
    const parsed = schema.safeParse({ ...d.data(), id: d.id });
    if (parsed.success) out.push(parsed.data);
    else console.warn('[firestore] sənəd schema-ya uyğun deyil:', d.id, parsed.error.issues[0]?.message);
  }
  return out;
}

/** İstifadəçinin aktiv üzvlükləri (SRS §4 — company switcher mənbəyi). */
export async function fetchMemberships(userId: string): Promise<Membership[]> {
  const snap = await getDocs(
    query(collection(requireDb(), 'memberships'), where('userId', '==', userId)),
  );
  return parseAll(snap.docs, membershipSchema).filter((m) => m.active);
}

/** Üzvlüklərə uyğun şirkət sənədləri (30-luq bloklarla). */
export async function fetchCompanies(companyIds: string[]): Promise<Company[]> {
  if (companyIds.length === 0) return [];
  const results: Company[] = [];
  for (let i = 0; i < companyIds.length; i += 30) {
    const chunk = companyIds.slice(i, i + 30);
    const snap = await getDocs(
      query(collection(requireDb(), 'companies'), where(documentId(), 'in', chunk)),
    );
    results.push(...parseAll(snap.docs, companySchema));
  }
  return results;
}

export async function fetchCompany(companyId: string): Promise<Company | null> {
  const snap = await getDoc(doc(requireDb(), 'companies', companyId));
  if (!snap.exists()) return null;
  const parsed = companySchema.safeParse({ ...snap.data(), id: snap.id });
  return parsed.success ? parsed.data : null;
}

export type CompanyHandlers = {
  onStructures: (v: Structure[]) => void;
  onGrades: (v: Grade[]) => void;
  onEmployees: (v: Employee[]) => void;
  onBudgets: (v: Budget[]) => void;
  onCycles: (v: Cycle[]) => void;
  onPlanningItems: (v: PlanningItem[]) => void;
  onMarketData: (v: MarketData[]) => void;
  onError: (message: string) => void;
};

export type SubscribeArgs = {
  companyId: string;
  roles: Role[];
  structureIds: string[];
};

/**
 * Şirkətin domen datasına realtime abunə.
 * Qaytarılan funksiya bütün listener-ləri söndürür.
 */
export function subscribeCompanyData(args: SubscribeArgs, handlers: CompanyHandlers): () => void {
  const database = requireDb();
  const { companyId, roles, structureIds } = args;
  const privileged = roles.some((r) => PRIVILEGED.includes(r));
  const unsubs: (() => void)[] = [];

  const listen = <S extends z.ZodTypeAny>(q: Query, schema: S, cb: (v: z.infer<S>[]) => void) => {
    unsubs.push(
      onSnapshot(
        q,
        (snap) => cb(parseAll(snap.docs, schema)),
        (err) => handlers.onError(err.message),
      ),
    );
  };

  const byCompany = (name: string) =>
    query(collection(database, name), where('companyId', '==', companyId));

  listen(byCompany('structures'), structureSchema, handlers.onStructures);
  listen(byCompany('grades'), gradeSchema, handlers.onGrades);
  listen(byCompany('employees'), employeeSchema, handlers.onEmployees);
  listen(byCompany('budgets'), budgetSchema, handlers.onBudgets);
  listen(byCompany('cycles'), cycleSchema, handlers.onCycles);
  listen(byCompany('marketData'), marketDataSchema, handlers.onMarketData);

  // planningItems — Manager üçün yalnız təyin olunmuş strukturlar (SRS §3.2, §14).
  if (privileged) {
    listen(byCompany('planningItems'), planningItemSchema, handlers.onPlanningItems);
  } else if (structureIds.length > 0) {
    listen(
      query(
        collection(database, 'planningItems'),
        where('companyId', '==', companyId),
        where('structureId', 'in', structureIds.slice(0, 30)),
      ),
      planningItemSchema,
      handlers.onPlanningItems,
    );
  } else {
    handlers.onPlanningItems([]);
  }

  return () => unsubs.forEach((u) => u());
}
