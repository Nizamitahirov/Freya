/**
 * auth-setup.mjs — Firebase Authentication konfiqurasiyası (SRS §18).
 *
 *   npm run auth:setup
 *
 * Email/Password provayderini aktivləşdirir və cari vəziyyəti çap edir.
 * Google provayderi OAuth client ID/secret tələb etdiyi üçün Console-dan aktivləşdirilir.
 * Service account-da `roles/firebaseauth.admin` olmalıdır.
 */

import { config } from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

config({ path: '.env.local' });
config();

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error('FIREBASE_* env dəyişənləri tapılmadı (.env.local).');
  process.exit(1);
}

const auth = new GoogleAuth({
  credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();
const BASE = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`;

const before = (await client.request({ url: BASE, method: 'GET' })).data;
console.log('Mövcud vəziyyət:');
console.log('  email/password:', before?.signIn?.email?.enabled ?? false);
console.log('  authorized domains:', (before?.authorizedDomains ?? []).join(', '));

const updated = (
  await client.request({
    url: `${BASE}?updateMask=signIn.email.enabled,signIn.email.passwordRequired`,
    method: 'PATCH',
    data: { signIn: { email: { enabled: true, passwordRequired: true } } },
  })
).data;

console.log('\nYeniləndi:');
console.log('  email/password:', updated?.signIn?.email?.enabled);
console.log(
  '\nGoogle ilə girişi aktivləşdirmək üçün: Firebase Console → Authentication → Sign-in method → Google.',
);
