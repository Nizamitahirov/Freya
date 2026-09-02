import 'server-only';

/**
 * audit.ts — Dəyişməz audit trail (SRS §13, §18).
 *
 * Bütün mutasiyalar buradan keçir. `auditLog` append-only-dır: Firestore rules
 * client yazısını tamamilə bağlayır, yalnız Admin SDK (server) yaza bilir.
 */

import { adminDb } from '@/lib/firebase/admin';
import type { Session } from './session';

export type AuditEntry = {
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
};

/** Sənədi Firestore-a yazıla bilən formaya salır (undefined sahələri atır). */
function clean<T>(value: T): T | null {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function writeAudit(session: Session, entry: AuditEntry): Promise<void> {
  const db = adminDb();
  const ref = db.collection('auditLog').doc();
  await ref.set({
    id: ref.id,
    companyId: session.companyId,
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    actorId: session.uid,
    actorRole: session.roles[0] ?? 'Viewer',
    before: clean(entry.before),
    after: clean(entry.after),
    timestamp: Date.now(),
  });
}

/** Batch daxilində audit yazısı (finalize kimi çoxsətirli əməliyyatlar üçün). */
export function auditDoc(session: Session, entry: AuditEntry) {
  const ref = adminDb().collection('auditLog').doc();
  return {
    ref,
    data: {
      id: ref.id,
      companyId: session.companyId,
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      actorId: session.uid,
      actorRole: session.roles[0] ?? 'Viewer',
      before: clean(entry.before),
      after: clean(entry.after),
      timestamp: Date.now(),
    },
  };
}
