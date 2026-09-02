/**
 * rules-test.ts — Firestore Security Rules-un real yoxlanışı (SRS §14, §22).
 *
 *   npm run rules:test
 *
 * Admin SDK rules-u BYPASS etdiyi üçün burada həqiqi istifadəçi ID token-ləri ilə
 * Firestore REST API çağırılır — yəni deploy olunmuş qaydalar sınaqdan keçir:
 *   • başqa şirkətin datası oxunmur (multi-tenant izolyasiya)
 *   • Manager yalnız öz strukturunun sətirlərini oxuya bilir (row-level security)
 *   • client planningItems / memberships yaza bilmir (yalnız server action)
 */

import { config } from 'dotenv';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createCompanyAction } from '@/app/actions/company';
import { savePlanningItemAction } from '@/app/actions/planning';

config({ path: '.env.local' });
config();

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID!;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let pass = 0;
let failCount = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failCount += 1;
    console.log(`  ✗ ${label}`, detail ?? '');
  }
}

async function idTokenFor(uid: string): Promise<string> {
  const customToken = await adminAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const data = (await res.json()) as { idToken?: string };
  if (!data.idToken) throw new Error('ID token alınmadı.');
  return data.idToken;
}

type RestResult = { status: number; body: unknown };

async function rest(token: string, path: string, init?: RequestInit): Promise<RestResult> {
  const res = await fetch(`${DOCS}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** structuredQuery göndərir; qaytarılan sənəd sayını və statusu verir. */
async function runQuery(token: string, query: Record<string, unknown>) {
  const res = await rest(token, ':runQuery', {
    method: 'POST',
    body: JSON.stringify({ structuredQuery: query }),
  });
  const rows = Array.isArray(res.body) ? (res.body as { document?: unknown }[]) : [];
  return { status: res.status, count: rows.filter((r) => r.document).length, body: res.body };
}

const eq = (field: string, value: string) => ({
  fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } },
});

async function main() {
  console.log('Firestore rules testi →', PROJECT_ID);

  // ── Hazırlıq: şirkət + plan sətri (server action ilə) ──────────────────────
  const owner = await adminAuth().createUser({
    email: `rules-owner-${Date.now()}@freya.test`,
    password: `Ru!${Math.random().toString(36).slice(2, 12)}`,
  });
  const ownerToken = await idTokenFor(owner.uid);
  const created = await createCompanyAction(ownerToken, {
    name: 'Rules Test MMC',
    sector: 'private',
    taxYear: '2026',
    currency: 'AZN',
    mealLimit: 100,
    year: 2026,
    withSampleData: true,
  });
  if (!created.ok || !created.data) throw new Error('Hazırlıq uğursuz: şirkət yaradılmadı.');
  const companyId = created.data;
  const db = adminDb();

  const employees = await db.collection('employees').where('companyId', '==', companyId).get();
  const cycles = await db.collection('cycles').where('companyId', '==', companyId).get();
  const teamId = `${companyId}__team-1`;
  await savePlanningItemAction(ownerToken, {
    companyId,
    cycleId: cycles.docs[0].id,
    employeeId: employees.docs[0].id,
    inputMode: 'percent',
    inputValue: 5,
    reason: 'merit',
  });

  // Manager: yalnız team-1 strukturu
  const manager = await adminAuth().createUser({
    email: `rules-manager-${Date.now()}@freya.test`,
    password: `Ru!${Math.random().toString(36).slice(2, 12)}`,
  });
  await db.collection('memberships').doc(`${manager.uid}_${companyId}`).set({
    id: `${manager.uid}_${companyId}`,
    userId: manager.uid,
    companyId,
    roles: ['Manager'],
    structureIds: [teamId],
    active: true,
  });
  const managerToken = await idTokenFor(manager.uid);

  // Kənar şəxs: heç bir üzvlük yoxdur
  const outsider = await adminAuth().createUser({
    email: `rules-outsider-${Date.now()}@freya.test`,
    password: `Ru!${Math.random().toString(36).slice(2, 12)}`,
  });
  const outsiderToken = await idTokenFor(outsider.uid);

  // ── 1. Multi-tenant izolyasiya (§4, §22) ──────────────────────────────────
  console.log('\n1. Şirkət izolyasiyası');
  const outsiderCompany = await rest(outsiderToken, `/companies/${companyId}`);
  check('üzv olmayan şirkəti oxuya bilmir', outsiderCompany.status === 403, outsiderCompany.status);

  const outsiderEmployees = await runQuery(outsiderToken, {
    from: [{ collectionId: 'employees' }],
    where: eq('companyId', companyId),
  });
  check(
    'üzv olmayan əməkdaş datasını oxuya bilmir',
    outsiderEmployees.status === 403,
    outsiderEmployees.status,
  );

  const ownerCompany = await rest(ownerToken, `/companies/${companyId}`);
  check('üzv öz şirkətini oxuyur', ownerCompany.status === 200, ownerCompany.status);

  const managerEmployees = await runQuery(managerToken, {
    from: [{ collectionId: 'employees' }],
    where: eq('companyId', companyId),
  });
  check(
    'Manager şirkətin əməkdaşlarını oxuyur',
    managerEmployees.status === 200 && managerEmployees.count === 3,
    `${managerEmployees.status} / ${managerEmployees.count}`,
  );

  // ── 2. Row-level security (§3.2, §22) ─────────────────────────────────────
  console.log('\n2. Manager row-level security');
  const scoped = await runQuery(managerToken, {
    from: [{ collectionId: 'planningItems' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          eq('companyId', companyId),
          {
            fieldFilter: {
              field: { fieldPath: 'structureId' },
              op: 'IN',
              value: { arrayValue: { values: [{ stringValue: teamId }] } },
            },
          },
        ],
      },
    },
  });
  check(
    'öz strukturunun sətirlərini oxuyur',
    scoped.status === 200 && scoped.count === 1,
    `${scoped.status} / ${scoped.count}`,
  );

  const unscoped = await runQuery(managerToken, {
    from: [{ collectionId: 'planningItems' }],
    where: eq('companyId', companyId),
  });
  check(
    'struktur filtri olmadan bütün sətirləri oxuya bilmir',
    unscoped.status === 403,
    unscoped.status,
  );

  const otherStructure = await runQuery(managerToken, {
    from: [{ collectionId: 'planningItems' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          eq('companyId', companyId),
          {
            fieldFilter: {
              field: { fieldPath: 'structureId' },
              op: 'IN',
              value: { arrayValue: { values: [{ stringValue: `${companyId}__dep-1` }] } },
            },
          },
        ],
      },
    },
  });
  check(
    'ona təyin olunmayan struktur üzrə sorğu rədd olunur',
    otherStructure.status === 403,
    otherStructure.status,
  );

  // ── 3. Client yazıları bağlıdır (§14, §16) ────────────────────────────────
  console.log('\n3. Client yazı qadağaları');
  const writeItem = await rest(managerToken, `/planningItems?documentId=hack-${Date.now()}`, {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        companyId: { stringValue: companyId },
        structureId: { stringValue: teamId },
        status: { stringValue: 'approved' },
      },
    }),
  });
  check('client planningItems yaza bilmir', writeItem.status === 403, writeItem.status);

  const escalate = await rest(managerToken, `/memberships/${manager.uid}_${companyId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: { roles: { arrayValue: { values: [{ stringValue: 'HRAdmin' }] } } } }),
  });
  check('client öz rolunu yüksəldə bilmir', escalate.status === 403, escalate.status);

  const writeAudit = await rest(ownerToken, `/auditLog?documentId=hack-${Date.now()}`, {
    method: 'POST',
    body: JSON.stringify({ fields: { companyId: { stringValue: companyId } } }),
  });
  check('audit log append-only (client yaza bilmir)', writeAudit.status === 403, writeAudit.status);

  const writeBudget = await rest(ownerToken, `/budgets/${companyId}__bud-2026`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: { allocatedGross: { doubleValue: 999999 } } }),
  });
  check('client büdcəni birbaşa dəyişə bilmir', writeBudget.status === 403, writeBudget.status);

  // ── 4. Üzvlük oxunuşu (company switcher) ──────────────────────────────────
  console.log('\n4. Üzvlük oxunuşu');
  const ownMemberships = await runQuery(managerToken, {
    from: [{ collectionId: 'memberships' }],
    where: eq('userId', manager.uid),
  });
  check(
    'istifadəçi öz üzvlüklərini oxuyur',
    ownMemberships.status === 200 && ownMemberships.count === 1,
    `${ownMemberships.status} / ${ownMemberships.count}`,
  );

  const othersMemberships = await runQuery(managerToken, {
    from: [{ collectionId: 'memberships' }],
    where: eq('companyId', companyId),
  });
  check(
    'Manager başqalarının üzvlüklərini oxuya bilmir',
    othersMemberships.status === 403,
    othersMemberships.status,
  );

  // ── Təmizlik ──────────────────────────────────────────────────────────────
  console.log('\n5. Təmizlik');
  for (const name of [
    'companies',
    'structures',
    'grades',
    'employees',
    'budgets',
    'cycles',
    'planningItems',
    'marketData',
    'auditLog',
    'memberships',
  ]) {
    const snap =
      name === 'companies'
        ? await db.collection(name).where('id', '==', companyId).get()
        : await db.collection(name).where('companyId', '==', companyId).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (snap.size) await batch.commit();
  }
  await Promise.all([
    adminAuth().deleteUser(owner.uid),
    adminAuth().deleteUser(manager.uid),
    adminAuth().deleteUser(outsider.uid),
  ]);
  check('test datası silindi', true);

  console.log(`\nNəticə: ${pass} keçdi, ${failCount} uğursuz.`);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nRules test xətası:', err);
  process.exit(1);
});
