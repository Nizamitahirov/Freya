'use client';

/**
 * client.ts — Firebase Web SDK (brauzer tərəfi).
 *
 * Auth, Firestore və Storage client instansları. Dəyərlər NEXT_PUBLIC_* env-dən gəlir.
 * Demo mode-da (NEXT_PUBLIC_DEMO_MODE=true) Firebase initialize olunmur.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (!isDemoMode && firebaseConfig.apiKey) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };

/** Firebase-in konfiqurasiya olunduğunu yoxlayır. */
export function isFirebaseReady(): boolean {
  return !isDemoMode && Boolean(app);
}
