'use client';

/**
 * auth.ts — Firebase Auth əməliyyatları (client). Firebase konfiqurasiya olunmayıbsa
 * (demo mode / env yox) aydın xəta atır ki, UI "demo rejimi" təklif etsin.
 */

import { auth, isFirebaseReady } from './client';

async function ensure() {
  if (!isFirebaseReady() || !auth) {
    throw new Error('Firebase konfiqurasiya olunmayıb — demo rejimindən istifadə edin.');
  }
  return auth;
}

export async function signInEmail(email: string, password: string) {
  const a = await ensure();
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  return signInWithEmailAndPassword(a, email, password);
}

export async function signUpEmail(email: string, password: string) {
  const a = await ensure();
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  return createUserWithEmailAndPassword(a, email, password);
}

export async function signInGoogle() {
  const a = await ensure();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  return signInWithPopup(a, new GoogleAuthProvider());
}

export async function signOutUser() {
  if (!auth) return;
  const { signOut } = await import('firebase/auth');
  return signOut(auth);
}
