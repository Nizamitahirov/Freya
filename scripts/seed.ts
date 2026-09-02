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

  const { company, structures, grades, employees, budget, cycle } = demoDataset;

  const batch = db.batch();
  batch.set(db.collection('companies').doc(company.id), company);
  batch.set(db.collection('budgets').doc(budget.id), budget);
  batch.set(db.collection('cycles').doc(cycle.id), cycle);
  for (const s of structures) batch.set(db.collection('structures').doc(s.id), s);
  for (const g of grades) batch.set(db.collection('grades').doc(g.id), g);
  for (const e of employees) batch.set(db.collection('employees').doc(e.id), e);

  await batch.commit();

  console.log(`✓ Firestore seed tamamlandı (project: ${projectId})`);
  console.log(
    `  companies:1 budgets:1 cycles:1 structures:${structures.length} grades:${grades.length} employees:${employees.length}`,
  );
}

main().catch((e) => {
  console.error('Seed xətası:', e);
  process.exit(1);
});
