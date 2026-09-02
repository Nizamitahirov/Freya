# Compensation Planning Tool

Şirkət daxilində əməkhaqqı büdcəsinin planlaşdırılması, per-employee **net → gross → supergross**
hesablaması və çoxpilləli **HR review** dövrü. Vergi motoru Azərbaycan qanunvericiliyinə
(13.02.2026) uyğundur.

Tam texniki şərt: [`Compensation-Planning-Tool-SRS.md`](./Compensation-Planning-Tool-SRS.md)

## Stack

Next.js (App Router) + React + TypeScript · Tailwind CSS v4 · Zod · Zustand · Firebase
(Auth + Firestore + Storage) · Server Actions (Admin SDK) · Vercel · Vitest

## Memarlıq

```
Brauzer (client)                    Server (Next.js)              Firebase
──────────────────                  ─────────────────             ────────
FirebaseGate ──── auth guard        Server Actions                Auth
  │                                   ├ Zod validasiya            Firestore
  ├ Zustand store  ◄── realtime ────  ├ RBAC (memberships)   ◄──  Storage
  │  (UI state)         onSnapshot    ├ pure engine (yenidən
  └ mutasiya ─────── ID token ──────► │   hesablama)
                                      ├ level max / büdcə
                                      └ audit log yazısı
```

- **Oxu** — client birbaşa Firestore-dan realtime (`onSnapshot`), Security Rules ilə qorunur.
- **Yazı** — yalnız server action-lar (Admin SDK). Client `planningItems`, `cycles`, `budgets`,
  `auditLog` kolleksiyalarına yaza bilmir; bütün status keçidləri, level max və büdcə
  yoxlaması serverdə aparılır (SRS §16).
- **Hesablama** — pure engine (`src/lib/comp`) həm client-də (canlı önizləmə), həm serverdə
  (yekun dəyər) eyni funksiyalarla işləyir; client rəqəmlərinə inanılmır.

## Bu repoda nə var

| Modul | Yer | Təsvir |
|---|---|---|
| **Comp engine** | `src/lib/comp/` | `getDeductions`, `getEmployerCosts`, `solveGross`, `superGross`, yemək pulu, compa-ratio, band validasiyası (SRS §11, §6) |
| **taxConfig** | `src/lib/comp/taxConfig.ts` | Vergi/DSMF/İTS/işsizlik pillələrinin **tək mənbəyi** (§11.6) |
| **Planning** | `src/lib/comp/plan.ts`, `item.ts` | Giriş (faiz/məbləğ/net) → yeni net/gross/meal/supergross + büdcə Δ (§9) |
| **Budget** | `src/lib/budget/` | allocated / committed / spent / remaining (§7) |
| **Review workflow** | `src/lib/review/` | Sətir və cycle state machine (§10) |
| **Server actions** | `src/app/actions/` | `savePlanningItem`, `submitCycle`, `hrAction`, `bulkHrAction`, `finalizeCycle`, `createCompany`, `setBudget` (§16) |
| **Server qatı** | `src/lib/server/` | ID token yoxlaması, RBAC, audit log, büdcə sinxronu |
| **Firestore qatı** | `src/lib/firebase/` | client/admin init, realtime abunə (row-level filtrli) |
| **Types** | `src/types/schemas.ts` | Zod schema → TS type (§13) |
| **Rules** | `firestore.rules`, `storage.rules` | Multi-tenant + role-based (§14) |
| **UI** | `src/app/`, `src/components/` | Landing, login, dashboard, planning, review, market, reports, settings |

## İşə salma

```bash
npm install
cp .env.example .env.local     # Firebase dəyərlərini doldurun
npm run dev                    # http://localhost:3000
```

Firebase olmadan sınamaq üçün `.env.local`-da `NEXT_PUBLIC_DEMO_MODE=true` — tətbiq
localStorage-dakı seed data ilə işləyir.

## Firebase quraşdırması

```bash
npm run rules:deploy     # firestore.rules + storage.rules → Firebase (firebase-tools tələb etmir)
npm run auth:setup       # Email/Password provayderini aktivləşdirir
npm run auth:domain      # authorized domains siyahısı
npm run auth:domain -- freya.vercel.app          # domen əlavə edir (OAuth/popup üçün)
npm run seed             # demo dataseti Firestore-a yazır (opsional)
npm run grant -- <email> [companyId] [rol,rol]   # mövcud şirkətə rol təyini
```

**İlk giriş:** `/login` → qeydiyyat. Üzvlüyü olmayan istifadəçiyə onboarding ekranı çıxır və
öz şirkətini yaradır (avtomatik CompanyAdmin + HRAdmin + Manager olur). Firestore-da artıq
mövcud şirkətə qoşulmaq üçün `npm run grant` istifadə edin.

Google ilə giriş üçün: Firebase Console → Authentication → Sign-in method → Google.

## Vercel-ə deploy

Vercel → Project → Settings → Environment Variables (Production + Preview):

| Dəyişən | Mənbə |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project settings → Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | eyni yer |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | eyni yer |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | eyni yer |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | eyni yer |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | eyni yer |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | eyni yer (opsional) |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `FIREBASE_PROJECT_ID` | service account JSON → `project_id` |
| `FIREBASE_CLIENT_EMAIL` | service account JSON → `client_email` |
| `FIREBASE_PRIVATE_KEY` | service account JSON → `private_key` (çox sətirli yapışdırmaq olar) |

Sonra Vercel domenini Firebase-ə əlavə edin (Google/popup girişi üçün):

```bash
npm run auth:domain -- <layihə>.vercel.app
```

`NEXT_PUBLIC_*` dəyişənləri **build zamanı** oxunur — dəyişdikdən sonra yenidən deploy edin.

## Yoxlama

```bash
npm test           # 46 unit test (engine, budget, workflow)
npm run typecheck  # strict TS
npm run build      # production build
npm run smoke      # real Firestore-da tam dövr: create → plan → review → finalize (sonda təmizləyir)
npm run rules:test # deploy olunmuş Security Rules-un real ID token ilə yoxlanışı
npm run e2e        # brauzer testi (əvvəlcə `npm run start`); izolyasiya olunmuş şəbəkədə skip edir
```

`smoke` və `rules:test` müvəqqəti şirkət/istifadəçi yaradıb sonda tam silir — mövcud dataya
toxunmur.

## Yol xəritəsi (SRS §21)

- **Faza 1:** engine · büdcə · workflow · types · rules · **Firebase (auth, Firestore, RBAC,
  server actions, audit)** — ✅
- **Faza 2:** market data upload (Storage + XLSX) · bildirişlər · struktur/grade/əməkdaş CRUD ·
  round tarixçəsi
- **Faza 3:** merit matrix · scenario/what-if · total comp · pay equity · payroll export

## Təhlükəsizlik qeydi

- `.env.local` (service account private key) **git-ə düşmür** — `.gitignore`-dadır.
- Audit log append-only: client yaza bilmir, yalnız Admin SDK.
- Rol yüksəltmə mümkün deyil: `memberships` client-dən yazılmır.
- `npm audit` iki dev-time xəbərdarlıq göstərir (postcss/next), yalnız Next 16 major
  yeniləməsi ilə həll olunur.
