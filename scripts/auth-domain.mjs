/**
 * auth-domain.mjs — Firebase Auth "Authorized domains" siyahısını idarə edir.
 *
 *   npm run auth:domain                      # cari siyahını göstərir
 *   npm run auth:domain -- freya.vercel.app  # domen əlavə edir
 *   npm run auth:domain -- --remove köhnə.app
 *
 * Vercel-də (və ya istənilən xüsusi domendə) Google/popup ilə giriş yalnız domen
 * bu siyahıda olduqda işləyir. Email/password girişi bundan asılı deyil.
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

const args = process.argv.slice(2);
const remove = args.includes('--remove');
const domains = args.filter((a) => !a.startsWith('--')).map((d) =>
  d.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
);

const auth = new GoogleAuth({
  credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();
const BASE = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`;

const current = (await client.request({ url: BASE, method: 'GET' })).data;
const existing = current.authorizedDomains ?? [];

if (domains.length === 0) {
  console.log(`Authorized domains (${PROJECT_ID}):`);
  existing.forEach((d) => console.log(`  • ${d}`));
  process.exit(0);
}

const next = remove
  ? existing.filter((d) => !domains.includes(d))
  : [...new Set([...existing, ...domains])];

const updated = (
  await client.request({
    url: `${BASE}?updateMask=authorizedDomains`,
    method: 'PATCH',
    data: { authorizedDomains: next },
  })
).data;

console.log(remove ? 'Silindi:' : 'Əlavə olundu:', domains.join(', '));
console.log('\nYekun siyahı:');
(updated.authorizedDomains ?? []).forEach((d) => console.log(`  • ${d}`));
