/**
 * smoke.ts — Firebase inteqrasiyasının uçdan-uca yoxlanışı (SRS §22 kəbul meyarları).
 *
 *   npm run smoke
 *
 * Real Firestore-da müvəqqəti şirkət yaradır, tam review dövrünü keçirir və
 * sonda yaratdığı hər şeyi silir:
 *   createCompany → savePlanningItem → submitCycle → hrAction(approve) → finalizeCycle
 * Yoxlanılır: server-side validasiya, RBAC, büdcə sinxronu, audit log, əməkdaş update.
 */

import { config } from 'dotenv';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createCompanyAction } from '@/app/actions/company';
import { savePlanningItemAction, submitCycleAction } from '@/app/actions/planning';
import { finalizeCycleAction, hrActionAction } from '@/app/actions/review';

config({ path: '.env.local' });
config();

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const TEST_EMAIL = `smoke-${Date.now()}@freya.test`;
const TEST_PASSWORD = `Sm0ke!${Math.random().toString(36).slice(2, 10)}`;

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

/** Custom token → ID token (server action-lar ID token gözləyir). */
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
  const data = (await res.json()) as { idToken?: string; error?: { message: string } };
  if (!data.idToken) throw new Error(`ID token alınmadı: ${data.error?.message}`);
  return data.idToken;
}

async function cleanup(companyId: string, uid: string) {
  const db = adminDb();
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
  await adminAuth().deleteUser(uid);
}

async function main() {
  console.log('Firebase smoke test →', process.env.FIREBASE_PROJECT_ID);

  const user = await adminAuth().createUser({ email: TEST_EMAIL, password: TEST_PASSWORD });
  const token = await idTokenFor(user.uid);
  console.log(`\n1. Test istifadəçisi: ${TEST_EMAIL}`);
  check('ID token alındı', Boolean(token));

  // ── createCompany ─────────────────────────────────────────────────────────
  console.log('\n2. createCompany (onboarding)');
  const created = await createCompanyAction(token, {
    name: 'Smoke Test MMC',
    sector: 'private',
    taxYear: '2026',
    currency: 'AZN',
    mealLimit: 100,
    year: 2026,
    withSampleData: true,
  });
  check('şirkət yaradıldı', created.ok, created.ok ? '' : created.error);
  if (!created.ok || !created.data) throw new Error('createCompany uğursuz — dayandırılır.');
  const companyId = created.data;

  const db = adminDb();
  const membership = await db.collection('memberships').doc(`${user.uid}_${companyId}`).get();
  check('üzvlük yaradıldı (CompanyAdmin/HRAdmin/Manager)', membership.exists);

  const employees = await db.collection('employees').where('companyId', '==', companyId).get();
  const cycles = await db.collection('cycles').where('companyId', '==', companyId).get();
  const budgets = await db.collection('budgets').where('companyId', '==', companyId).get();
  check('nümunə əməkdaşlar yaradıldı', employees.size === 3, employees.size);
  check('dövr və büdcə yaradıldı', cycles.size === 1 && budgets.size === 1);

  const cycleId = cycles.docs[0].id;
  const emp = employees.docs[0].data() as { id: string; currentNet: number; currentGross: number };

  // ── savePlanningItem ──────────────────────────────────────────────────────
  console.log('\n3. savePlanningItem (net +10%)');
  const saved = await savePlanningItemAction(token, {
    companyId,
    cycleId,
    employeeId: emp.id,
    inputMode: 'percent',
    inputValue: 10,
    reason: 'merit',
  });
  check('sətir yaradıldı', saved.ok, saved.ok ? '' : saved.error);
  if (!saved.ok || !saved.id) throw new Error('savePlanningItem uğursuz.');
  const itemId = saved.id;

  const itemDoc = await db.collection('planningItems').doc(itemId).get();
  const item = itemDoc.data() as {
    newNet: number;
    newGross: number;
    deltaGrossAnnual: number;
    status: string;
  };
  check('yeni net > cari net', item.newNet > emp.currentNet, `${emp.currentNet} → ${item.newNet}`);
  check('yeni gross hesablandı', item.newGross > emp.currentGross);
  check('status = draft', item.status === 'draft');

  const budgetAfterDraft = (await budgets.docs[0].ref.get()).data() as { committedGross: number };
  check(
    'büdcə committed-ə düşdü (§7.3)',
    Math.abs(budgetAfterDraft.committedGross - item.deltaGrossAnnual) < 0.01,
    budgetAfterDraft.committedGross,
  );

  // ── level max validasiyası ────────────────────────────────────────────────
  console.log('\n4. Level max validasiyası (§6.2)');
  const overBand = await savePlanningItemAction(token, {
    companyId,
    cycleId,
    employeeId: emp.id,
    inputMode: 'absolute',
    inputValue: 99999,
    reason: 'promotion',
  });
  check(
    'band max aşıldıqda server bloklayır',
    !overBand.ok && /max/i.test(overBand.ok ? '' : overBand.error),
    overBand.ok ? 'BLOKLANMADI' : overBand.error,
  );

  // ── submitCycle ───────────────────────────────────────────────────────────
  console.log('\n5. submitCycle → in_review');
  const submitted = await submitCycleAction(token, { companyId, cycleId });
  check('review-ə göndərildi', submitted.ok, submitted.ok ? '' : submitted.error);
  const cycleAfterSubmit = (await cycles.docs[0].ref.get()).data() as { status: string };
  check('cycle.status = in_review', cycleAfterSubmit.status === 'in_review');
  const itemAfterSubmit = (await itemDoc.ref.get()).data() as { status: string };
  check('item.status = submitted', itemAfterSubmit.status === 'submitted');

  // ── HR aksiyaları ─────────────────────────────────────────────────────────
  console.log('\n6. HR row-level aksiyalar (§10)');
  const returned = await hrActionAction(token, {
    companyId,
    itemId,
    action: 'return',
    hrComment: 'Zəhmət olmasa yenidən baxın',
  });
  check('send-back işlədi', returned.ok, returned.ok ? '' : returned.error);
  const afterReturn = (await itemDoc.ref.get()).data() as { status: string; hrComment: string };
  check('item.status = returned + səbəb yazıldı', afterReturn.status === 'returned' && Boolean(afterReturn.hrComment));

  const reEdited = await savePlanningItemAction(token, {
    companyId,
    cycleId,
    employeeId: emp.id,
    inputMode: 'percent',
    inputValue: 5,
    reason: 'merit',
  });
  check('qaytarılan sətir düzəldildi', reEdited.ok, reEdited.ok ? '' : reEdited.error);
  const afterEdit = (await itemDoc.ref.get()).data() as { status: string; round: number };
  check('round artdı (§10.1)', afterEdit.round === 1, afterEdit.round);

  await submitCycleAction(token, { companyId, cycleId });
  const approved = await hrActionAction(token, { companyId, itemId, action: 'approve' });
  check('approve işlədi', approved.ok, approved.ok ? '' : approved.error);

  // Qeyri-qanuni keçid: artıq approved olan sətrə yenidən aksiya
  const illegal = await hrActionAction(token, { companyId, itemId, action: 'approve' });
  check('terminal sətirdə təkrar aksiya bloklandı', !illegal.ok, illegal.ok ? 'BLOKLANMADI' : '');

  // ── finalizeCycle ─────────────────────────────────────────────────────────
  console.log('\n7. finalizeCycle (§10.1, §7.3)');
  const finalized = await finalizeCycleAction(token, { companyId, cycleId });
  check('finalize işlədi', finalized.ok, finalized.ok ? '' : finalized.error);

  const empAfter = (await db.collection('employees').doc(emp.id).get()).data() as {
    currentNet: number;
  };
  const finalItem = (await itemDoc.ref.get()).data() as { newNet: number; deltaGrossAnnual: number };
  check(
    'əməkdaş datası yeniləndi',
    Math.abs(empAfter.currentNet - finalItem.newNet) < 0.01,
    `${empAfter.currentNet} vs ${finalItem.newNet}`,
  );

  const budgetFinal = (await budgets.docs[0].ref.get()).data() as {
    committedGross: number;
    spentGross: number;
  };
  check('committed → spent keçidi', budgetFinal.committedGross === 0 && budgetFinal.spentGross > 0, budgetFinal);

  // ── audit log ─────────────────────────────────────────────────────────────
  console.log('\n8. Audit trail (§13)');
  const audit = await db.collection('auditLog').where('companyId', '==', companyId).get();
  const actions = audit.docs.map((d) => (d.data() as { action: string }).action);
  check('audit yazıları var', audit.size >= 6, `${audit.size} yazı`);
  check('finalize audit-də var', actions.includes('finalize'));
  check('hr aksiyaları audit-də var', actions.some((a) => a.startsWith('hr:')));

  // ── təmizlik ──────────────────────────────────────────────────────────────
  console.log('\n9. Təmizlik');
  await cleanup(companyId, user.uid);
  const leftovers = await db.collection('companies').doc(companyId).get();
  check('test datası silindi', !leftovers.exists);

  console.log(`\nNəticə: ${pass} keçdi, ${failCount} uğursuz.`);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\nSmoke test xətası:', err);
  process.exit(1);
});
