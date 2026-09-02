import 'server-only';

/**
 * admin.ts — Firebase Admin SDK (yalnız server tərəfi).
 *
 * Private key yalnız serverdə saxlanılır (FIREBASE_PRIVATE_KEY), runtime-da `\n` un-escape
 * olunur. Server actions Firestore-a bu instans üzərindən yazır (SRS §16, §18).
 *
 * İnisializasiya LAZY-dir: modul import olunanda deyil, ilk `adminDb()` çağırışında baş verir.
 * Beləliklə env olmayan mühitdə (build, demo mode) import özü xəta atmır.
 */

import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const APP_NAME = 'freya-admin';

/** Admin SDK env-lərinin mövcudluğu (server-side "live mode" göstəricisi). */
export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

function adminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin env dəyişənləri yoxdur (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).',
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, APP_NAME);
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

/** Test/diaqnostika üçün mövcud instansı qaytarır (varsa). */
export function existingAdminApp(): App | null {
  return getApps().some((a) => a.name === APP_NAME) ? getApp(APP_NAME) : null;
}
