# Compensation Planning Tool

Şirkət daxilində əməkhaqqı büdcəsinin planlaşdırılması, per-employee **net → gross → supergross**
hesablaması və çoxpilləli **HR review** dövrü. Vergi motoru Azərbaycan qanunvericiliyinə
(13.02.2026) uyğundur.

Tam texniki şərt: [`Compensation-Planning-Tool-SRS.md`](./Compensation-Planning-Tool-SRS.md)

## Stack

Next.js (App Router) + React + TypeScript · Tailwind CSS v4 · Zod · Zustand · Firebase · Vercel · Vitest

## Bu repoda nə var (Faza 1 foundation)

Hesablama motoru — layihənin **ürəyi** — tam qurulub və unit-testlə örtülüb:

| Modul | Yer | Təsvir |
|---|---|---|
| **Comp engine** | `src/lib/comp/` | `getDeductions`, `getEmployerCosts`, `solveGross` (net→gross binary search), `superGross`, yemək pulu paylanması, compa-ratio, band validasiyası (SRS §11, §6) |
| **taxConfig** | `src/lib/comp/taxConfig.ts` | Bütün vergi/DSMF/İTS/işsizlik pillələrinin **tək mənbəyi** (SRS §11.6) |
| **Planning** | `src/lib/comp/plan.ts` | Giriş (faiz/məbləğ/net) → yeni net/gross/meal/supergross + büdcə Δ (SRS §9) |
| **Budget** | `src/lib/budget/` | allocated / committed / spent / remaining keçidləri (SRS §7) |
| **Review workflow** | `src/lib/review/` | Sətir və cycle state machine — HR approve/reject/return/edit, finalize (SRS §10) |
| **Types** | `src/types/schemas.ts` | Zod schema → TS type, bütün domen sənədləri (SRS §13) |
| **Demo seed** | `src/lib/demo/seed.ts` | Engine ilə uzlaşdırılmış demo dataset (SRS §18) |
| **Firestore/Storage rules** | `firestore.rules`, `storage.rules` | Multi-tenant + role-based təhlükəsizlik (SRS §14) |
| **UI** | `src/app/`, `src/components/` | Landing + canlı hesablama kalkulyatoru, Gradex dizayn tokenləri (SRS §15) |

## İşə salma

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 46 unit test (engine, budget, workflow)
npm run typecheck  # strict TS
npm run build      # production build
npm run seed       # demo dataseti çap edir (Admin SDK env olduqda Firestore-a yazır)
```

## Konfiqurasiya

`.env.example` faylını `.env.local`-a köçürüb Firebase dəyərlərini doldurun.
Firebase olmadan sınamaq üçün `NEXT_PUBLIC_DEMO_MODE=true` (demo seed data).

## Yol xəritəsi (SRS §21)

- **Faza 1 (bu foundation):** engine · büdcə · workflow · types · rules · demo · landing UI
- **Faza 2:** multi-company UI · structure/grade redaktoru · planning & review ekranları · market data · dashboard · export
- **Faza 3:** merit matrix · scenario/what-if · total comp · pay equity · payroll export

## Təhlükəsizlik qeydi

`npm audit` iki dev-time xəbərdarlıq göstərir (postcss/next), yalnız **Next 16 major**
yeniləməsi ilə həll olunur. App Router breaking dəyişiklik riskini nəzərə alaraq bu foundation
patch edilmiş **Next 15.5.x** xəttində saxlanılıb; Faza 2-də Next 16-ya keçid planlaşdırıla bilər.
