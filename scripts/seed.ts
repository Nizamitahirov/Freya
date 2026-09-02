/**
 * seed.ts — Demo datasetini çap edir və ya (Admin SDK env verildikdə) Firestore-a yazır.
 *
 * İşə salma:  npm run seed
 *
 * Firebase Admin SDK env dəyişənləri (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 * FIREBASE_PRIVATE_KEY) verilibsə, dataset Firestore-a yazılır (firebase-admin lazımdır).
 * Verilməyibsə, dataset JSON kimi çap olunur — demo mode / yoxlama üçün.
 */

import { demoDataset } from '@/lib/demo/seed';

async function main() {
  const hasAdmin =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY;

  if (!hasAdmin) {
    console.log('# Admin SDK env yoxdur — demo dataset (JSON):\n');
    console.log(JSON.stringify(demoDataset, null, 2));
    console.log(
      '\n# Firestore-a yazmaq üçün .env-ə FIREBASE_* dəyişənlərini əlavə edin və firebase-admin quraşdırın.',
    );
    return;
  }

  // Admin SDK wiring nümunəsi (firebase-admin quraşdırıldıqdan sonra):
  //
  //   import { cert, initializeApp } from 'firebase-admin/app';
  //   import { getFirestore } from 'firebase-admin/firestore';
  //   const app = initializeApp({ credential: cert({
  //     projectId: process.env.FIREBASE_PROJECT_ID,
  //     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  //     privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  //   }) });
  //   const db = getFirestore(app);
  //   await db.collection('companies').doc(demoDataset.company.id).set(demoDataset.company);
  //   ... (structures, grades, employees, budgets, cycles)
  //
  console.log('# Admin SDK env aşkarlandı. firebase-admin quraşdırıb yuxarıdakı wiring-i aktivləşdirin.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
