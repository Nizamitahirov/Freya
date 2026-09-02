/**
 * grant.ts — İstifadəçiyə şirkət üzrə rol təyin edir (SRS §3, §4).
 *
 *   npm run grant -- <email> [companyId] [rol,rol,...]
 *   npm run grant -- nizami@example.com demo-co CompanyAdmin,HRAdmin,Manager
 *
 * Rol verilməzsə default: CompanyAdmin,HRAdmin,Manager.
 * Struktur siyahısı avtomatik olaraq şirkətin bütün strukturlarından qurulur
 * (Manager üçün row-level giriş, §3.2).
 *
 * İstifadəçi əvvəlcə tətbiqdə hesab yaratmalıdır (email/password və ya Google),
 * çünki üzvlük sənədi Firebase Auth uid-inə bağlanır.
 */

import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Role } from '@/types';

config({ path: '.env.local' });
config();

const DEFAULT_ROLES: Role[] = ['CompanyAdmin', 'HRAdmin', 'Manager'];

async function main() {
  const [email, companyIdArg, rolesArg] = process.argv.slice(2);
  if (!email) {
    console.error('İstifadə: npm run grant -- <email> [companyId] [rol,rol,...]');
    process.exit(1);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    console.error('FIREBASE_* env dəyişənləri tapılmadı (.env.local).');
    process.exit(1);
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore(app);
  const auth = getAuth(app);

  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    console.error(
      `${email} üçün Firebase Auth hesabı tapılmadı. Əvvəlcə tətbiqdən qeydiyyatdan keçin, sonra bu əmri yenidən işə salın.`,
    );
    process.exit(1);
  }

  // Şirkət: arqument verilməyibsə ilk şirkət götürülür.
  let companyId = companyIdArg;
  if (!companyId) {
    const companies = await db.collection('companies').limit(1).get();
    if (companies.empty) {
      console.error('Firestore-da şirkət yoxdur — əvvəlcə `npm run seed` işlədin.');
      process.exit(1);
    }
    companyId = companies.docs[0].id;
  }

  const roles = (rolesArg?.split(',').map((r) => r.trim()) ?? DEFAULT_ROLES) as Role[];

  const structuresSnap = await db
    .collection('structures')
    .where('companyId', '==', companyId)
    .get();
  const structureIds = structuresSnap.docs.map((d) => d.id);

  const id = `${uid}_${companyId}`;
  await db
    .collection('memberships')
    .doc(id)
    .set({ id, userId: uid, companyId, roles, structureIds, active: true }, { merge: true });

  console.log(`✓ ${email} → ${companyId}`);
  console.log(`  uid:        ${uid}`);
  console.log(`  roles:      ${roles.join(', ')}`);
  console.log(`  structures: ${structureIds.length ? structureIds.join(', ') : '(yoxdur)'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
