import 'server-only';

/**
 * session.ts — Server action-lar üçün autentifikasiya + RBAC (SRS §3, §14, §16).
 *
 * Client hər mutasiyada Firebase ID token göndərir; burada token Admin SDK ilə
 * yoxlanılır, `memberships/{uid}_{companyId}` sənədi oxunur və rol/struktur
 * icazələri tətbiq olunur. Client-dən gələn HEÇ BİR rol iddiasına inanılmır.
 */

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { membershipSchema, type Membership, type Role } from '@/types';

export class ActionError extends Error {}

export type Session = {
  uid: string;
  email: string | null;
  companyId: string;
  roles: Role[];
  structureIds: string[];
};

export function membershipId(uid: string, companyId: string): string {
  return `${uid}_${companyId}`;
}

/** ID token-i yoxlayır və uid qaytarır. */
export async function verifyToken(idToken: string): Promise<{ uid: string; email: string | null }> {
  if (!idToken) throw new ActionError('Autentifikasiya tokeni yoxdur — yenidən daxil olun.');
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    throw new ActionError('Sessiya etibarsızdır və ya vaxtı bitib — yenidən daxil olun.');
  }
}

/** İstifadəçinin həmin şirkətdəki üzvlüyünü (rol + struktur) qaytarır. */
export async function requireMember(idToken: string, companyId: string): Promise<Session> {
  const { uid, email } = await verifyToken(idToken);
  const snap = await adminDb().collection('memberships').doc(membershipId(uid, companyId)).get();
  if (!snap.exists) throw new ActionError('Bu şirkətə girişiniz yoxdur.');

  const parsed = membershipSchema.safeParse({ id: snap.id, ...snap.data() });
  if (!parsed.success) throw new ActionError('Üzvlük sənədi xətalıdır.');
  const membership: Membership = parsed.data;
  if (!membership.active) throw new ActionError('Üzvlüyünüz deaktivdir.');

  return {
    uid,
    email,
    companyId,
    roles: membership.roles,
    structureIds: membership.structureIds,
  };
}

/** Sadalanan rollardan ən azı biri tələb olunur (SRS §3.3 icazə matrisi). */
export function requireRole(session: Session, allowed: Role[], what: string): void {
  if (!session.roles.some((r) => allowed.includes(r))) {
    throw new ActionError(`"${what}" üçün icazəniz yoxdur (tələb olunan rol: ${allowed.join(', ')}).`);
  }
}

/** Manager yalnız ona təyin olunmuş strukturlarda işləyə bilər (SRS §3.2 row-level). */
export function requireStructureAccess(session: Session, structureId: string): void {
  const privileged: Role[] = ['PlatformOwner', 'CompanyAdmin', 'HRAdmin', 'HRReviewer', 'Finance'];
  if (session.roles.some((r) => privileged.includes(r))) return;
  if (!session.structureIds.includes(structureId)) {
    throw new ActionError('Bu struktur sizə təyin olunmayıb.');
  }
}

/** Aksiyanın nəticəsi — UI xətanı istifadəçiyə göstərə bilsin deyə. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

export function fail(err: unknown): { ok: false; error: string } {
  const message =
    err instanceof ActionError
      ? err.message
      : err instanceof Error
        ? err.message
        : 'Gözlənilməz xəta baş verdi.';
  if (!(err instanceof ActionError)) console.error('[action]', err);
  return { ok: false, error: message };
}
