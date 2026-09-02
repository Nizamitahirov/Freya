/**
 * deploy-rules.mjs — firestore.rules və storage.rules-u Firebase-ə deploy edir.
 *
 *   npm run rules:deploy
 *
 * firebase-tools tələb etmir: Firebase Rules REST API-si service account ilə çağırılır
 * (FIREBASE_* env — .env.local). Service account-da `roles/firebaserules.admin` olmalıdır.
 */

import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

config({ path: '.env.local' });
config();

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${PROJECT_ID}.firebasestorage.app`;

if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error('FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY tələb olunur.');
  process.exit(1);
}

const auth = new GoogleAuth({
  credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();
const API = 'https://firebaserules.googleapis.com/v1';

async function call(url, method, data) {
  const res = await client.request({ url, method, data });
  return res.data;
}

/** Rules mətnindən ruleset yaradıb onu verilmiş release-ə bağlayır. */
async function publish(fileName, sourcePath, releaseName) {
  const source = readFileSync(sourcePath, 'utf8');
  const ruleset = await call(`${API}/projects/${PROJECT_ID}/rulesets`, 'POST', {
    source: { files: [{ name: fileName, content: source }] },
  });
  console.log(`  ruleset yaradıldı: ${ruleset.name}`);

  const release = `projects/${PROJECT_ID}/releases/${releaseName}`;
  try {
    await call(`${API}/${release}`, 'PATCH', {
      release: { name: release, rulesetName: ruleset.name },
    });
  } catch (err) {
    // Release hələ yoxdursa yaradılır.
    if (err?.response?.status === 404) {
      await call(`${API}/projects/${PROJECT_ID}/releases`, 'POST', {
        name: release,
        rulesetName: ruleset.name,
      });
    } else {
      throw err;
    }
  }
  console.log(`  release yeniləndi: ${releaseName}`);
}

console.log(`Firebase Rules deploy → ${PROJECT_ID}`);
console.log('• firestore.rules');
await publish('firestore.rules', 'firestore.rules', 'cloud.firestore');
console.log('• storage.rules');
await publish('storage.rules', 'storage.rules', `firebase.storage/${BUCKET}`);
console.log('Hazırdır.');
