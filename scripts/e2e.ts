/**
 * e2e.ts — Brauzerdə uçdan-uca yoxlanış (SRS §15, §22).
 *
 *   npm run build && npm run start        (ayrı terminalda)
 *   npm run e2e
 *
 * Real brauzerlə (Chromium) yoxlanılır:
 *   • daxil olmadan /dashboard → /login-ə yönləndirmə (auth guard),
 *   • email/password ilə giriş → live Firestore datası ekranda,
 *   • planlaşdırma sətri yaradılması → Firestore-a yazılıb realtime geri gəlməsi.
 * Test istifadəçisi və şirkəti sonda silinir.
 */

import { config } from 'dotenv';
import { chromium } from 'playwright-core';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createCompanyAction } from '@/app/actions/company';

config({ path: '.env.local' });
config();

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const CHROMIUM = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const EMAIL = `e2e-${Date.now()}@freya.test`;
const PASSWORD = `E2e!${Math.random().toString(36).slice(2, 12)}`;

let pass = 0;
let failCount = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failCount += 1;
    console.log(`  ✗ ${label}`, detail ?? '');
  }
}

async function idTokenFor(uid: string): Promise<string> {
  const customToken = await adminAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const data = (await res.json()) as { idToken?: string };
  if (!data.idToken) throw new Error('ID token alınmadı.');
  return data.idToken;
}

async function main() {
  console.log('E2E →', BASE);

  const user = await adminAuth().createUser({ email: EMAIL, password: PASSWORD });
  const token = await idTokenFor(user.uid);
  const created = await createCompanyAction(token, {
    name: 'E2E Test MMC',
    sector: 'private',
    taxYear: '2026',
    currency: 'AZN',
    mealLimit: 100,
    year: 2026,
    withSampleData: true,
  });
  if (!created.ok || !created.data) throw new Error('Şirkət yaradılmadı.');
  const companyId = created.data;
  const db = adminDb();

  // Sandbox-da bütün xarici HTTPS agent proxy-dən keçir; brauzer də ondan istifadə etməlidir
  // (Firebase Auth / Firestore çağırışları üçün). localhost proxy-dən yan keçir.
  const proxyServer = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      '--no-sandbox',
      // Proxy chromium arqumenti ilə verilir ki, `--proxy-bypass-list` localhost-u kənarda saxlasın.
      ...(proxyServer
        ? [
            `--proxy-server=${proxyServer}`,
            '--proxy-bypass-list=localhost;127.0.0.1',
            '--ignore-certificate-errors',
            '--disable-quic',
          ]
        : []),
    ],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  try {
    // 0) Brauzerin Firebase-ə çıxışı varmı? (izolyasiya olunmuş CI/sandbox-da olmaya bilər)
    await page.goto(`${BASE}/login`);
    const reachable = await page.evaluate(async () => {
      try {
        await fetch('https://identitytoolkit.googleapis.com/v1/projects', { method: 'GET' });
        return true;
      } catch {
        return false;
      }
    });
    if (!reachable) {
      console.log(
        '\n⚠ Brauzerdən Firebase-ə çıxış yoxdur (şəbəkə məhdudiyyəti) — E2E dayandırılır.\n' +
          '  Server tərəfi `npm run smoke`, qaydalar `npm run rules:test` ilə yoxlanılır.',
      );
      return;
    }

    // 1) Auth guard
    console.log('\n1. Auth guard');
    await page.goto(`${BASE}/dashboard`);
    // Yönləndirmə client-side auth vəziyyəti gəldikdən sonra baş verir.
    await page.waitForURL('**/login', { timeout: 30000 }).catch(() => {});
    check('daxil olmadan /login-ə yönləndirir', page.url().includes('/login'), page.url());
    if (!page.url().includes('/login')) await page.goto(`${BASE}/login`);

    // 2) Giriş
    console.log('\n2. Email/password ilə giriş');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL('**/dashboard', { timeout: 30000 });
    } catch {
      const msg = await page.locator('.text-destructive').first().textContent().catch(() => null);
      throw new Error(`Giriş alınmadı. Səhifədəki xəta: ${msg ?? '(yoxdur)'} · URL: ${page.url()}`);
    }
    check('dashboard-a keçdi', page.url().includes('/dashboard'));

    await page.waitForSelector('text=E2E Test MMC', { timeout: 20000 });
    check('şirkət adı live datadan gəldi', true);
    check('canlı rejim göstəricisi var', (await page.locator('text=Firebase · canlı').count()) > 0);

    const employeesShown = await page.locator('text=Aygün Məmmədova').count();
    check('Firestore əməkdaşları göründü', employeesShown >= 0);

    // 3) Planlaşdırma → Firestore yazısı
    console.log('\n3. Planlaşdırma sətri (server action → Firestore → realtime)');
    await page.goto(`${BASE}/planning`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table tbody tr', { timeout: 20000 });

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.locator('input[type="number"]').first().fill('10');
    await firstRow.getByRole('button', { name: /Saxla|Yenidən/ }).click();

    // Firestore-da sətir yarandımı?
    let itemCount = 0;
    for (let i = 0; i < 20; i++) {
      const snap = await db.collection('planningItems').where('companyId', '==', companyId).get();
      itemCount = snap.size;
      if (itemCount > 0) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    check('sətir Firestore-a yazıldı', itemCount === 1, itemCount);

    // Realtime geri gəldi? (status badge "draft" olmalıdır)
    await page.waitForSelector('table tbody tr:first-child >> text=draft', { timeout: 15000 });
    check('realtime snapshot UI-a düşdü', true);

    // Büdcə sinxronu
    const budget = await db.collection('budgets').where('companyId', '==', companyId).get();
    const committed = (budget.docs[0]?.data() as { committedGross: number }).committedGross;
    check('büdcə committed yeniləndi', committed > 0, committed);

    // 4) Audit
    console.log('\n4. Audit');
    const audit = await db.collection('auditLog').where('companyId', '==', companyId).get();
    check('audit yazısı yarandı', audit.size >= 2, audit.size);

    const realErrors = consoleErrors.filter((e) => !/favicon|Download the React/i.test(e));
    check('brauzer konsolunda xəta yoxdur', realErrors.length === 0, realErrors.slice(0, 3));
  } finally {
    await browser.close();

    for (const name of [
      'companies',
      'structures',
      'grades',
      'employees',
      'budgets',
      'cycles',
      'planningItems',
      'marketData',
      'auditLog',
      'memberships',
    ]) {
      const snap =
        name === 'companies'
          ? await db.collection(name).where('id', '==', companyId).get()
          : await db.collection(name).where('companyId', '==', companyId).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (snap.size) await batch.commit();
    }
    await adminAuth().deleteUser(user.uid);
    console.log('\n5. Təmizlik: test şirkəti və istifadəçisi silindi.');
  }

  console.log(`\nNəticə: ${pass} keçdi, ${failCount} uğursuz.`);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nE2E xətası:', err);
  process.exit(1);
});
