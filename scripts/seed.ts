/**
 * seed.ts — Demo dataseti Firestore-a yazır (Admin SDK).
 *
 * İşə salma:  npm run seed
 *
 * FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env verilibsə,
 * dataset Firestore-a yazılır. Verilməyibsə JSON kimi çap olunur (demo/yoxlama).
 */

import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { demoDataset } from '@/lib/demo/seed';

config({ path: '.env.local' });
config();

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.log('# Admin SDK env yoxdur — demo dataset (JSON):\n');
    console.log(JSON.stringify(demoDataset, null, 2));
    return;
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore(app);

  const { company, structures, grades, employees, budgets, cycles } = demoDataset;

  // Köhnə demo sənədlərini təmizlə (yenidən seed edildikdə qalıq qalmasın).
  // planningItems / auditLog toxunulmur — onlar iş datasıdır.
  for (const name of ['structures', 'grades', 'employees', 'budgets', 'cycles']) {
    const stale = await db.collection(name).where('companyId', '==', company.id).get();
    for (let i = 0; i < stale.docs.length; i += 400) {
      const batch = db.batch();
      stale.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  const docs: [string, { id: string }][] = [
    ['companies', company],
    ...structures.map((s) => ['structures', s] as [string, { id: string }]),
    ...grades.map((g) => ['grades', g] as [string, { id: string }]),
    ...employees.map((e) => ['employees', e] as [string, { id: string }]),
    ...budgets.map((b) => ['budgets', b] as [string, { id: string }]),
    ...cycles.map((c) => ['cycles', c] as [string, { id: string }]),
  ];

  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach(([col, doc]) => batch.set(db.collection(col).doc(doc.id), doc));
    await batch.commit();
  }

  console.log(`✓ Firestore seed tamamlandı (project: ${projectId})`);
  console.log(
    `  companies:1 structures:${structures.length} grades:${grades.length} ` +
      `employees:${employees.length} budgets:${budgets.length} cycles:${cycles.length}`,
  );
}

main().catch((e) => {
  console.error('Seed xətası:', e);
  process.exit(1);
});
