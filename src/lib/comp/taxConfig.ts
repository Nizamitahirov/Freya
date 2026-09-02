/**
 * taxConfig — vergi/tutulma parametrlərinin TƏK MƏNBƏYİ (SRS §11.6).
 *
 * Bütün faiz, pillə (bracket) və limit dəyərləri burada il + sektor üzrə saxlanılır.
 * Qanunvericilik dəyişdikdə YALNIZ bu fayl yenilənir; engine.ts məntiqi toxunulmur.
 *
 * Düsturlar Mycalcpro/BirCalc-dan köçürülüb və 13 fevral 2026 tarixinə uyğundur (SRS §0).
 */

export type Sector = 'private' | 'public' | 'texnopark';
export type Workplace = 'main' | 'secondary';
export type TaxYear = '2025' | '2026';

/** VM 102 üzrə default aylıq gəlir vergisi güzəşti (AZN). */
export const DEFAULT_BENEFIT = 200;

/** Default yemək pulu limiti (AZN) — şirkət konfiqurasiyasında dəyişir (SRS §11.7). */
export const DEFAULT_MEAL_LIMIT = 100;

/** Minimum gross artım fərqi (SRS §11.7): filial 20 AZN / baş ofis 50 AZN. */
export const DEFAULT_MIN_GROSS_DIFF = { branch: 20, hq: 50 } as const;

/** solveGross binary-search iterasiya sayı (SRS §11.4). */
export const SOLVE_GROSS_ITERATIONS = 38;

/**
 * Bir pillə (bracket): `up` həddinə qədər, `base` sabit + `rate` marjinal.
 * Formul: threshold-dan yuxarı hissəyə `rate`, altına `base` (kumulyativ).
 */
export type Bracket = { up: number; base: number; rate: number; from: number };

export const taxConfig = {
  // ─────────────────────────── İşçi gəlir vergisi ───────────────────────────
  incomeTax: {
    private: {
      // 2026 — proqressiv (SRS §11.2)
      '2026': [
        { from: 0, up: 200, base: 0, rate: 0 },
        { from: 200, up: 2500, base: 0, rate: 0.03 },
        { from: 2500, up: 8000, base: 75, rate: 0.1 },
        { from: 8000, up: Infinity, base: 625, rate: 0.14 },
      ] as Bracket[],
      // 2025 — 8000-ə qədər 0%, üstü 14% (SRS §11.2)
      '2025': [
        { from: 0, up: 8000, base: 0, rate: 0 },
        { from: 8000, up: Infinity, base: 0, rate: 0.14 },
      ] as Bracket[],
    },
    public: {
      // Dövlət: bt≤2500 → 14%, üstü 350 + 25% (SRS §11.2) — kəsilməzdir
      '2026': [
        { from: 0, up: 2500, base: 0, rate: 0.14 },
        { from: 2500, up: Infinity, base: 350, rate: 0.25 },
      ] as Bracket[],
      '2025': [
        { from: 0, up: 2500, base: 0, rate: 0.14 },
        { from: 2500, up: Infinity, base: 350, rate: 0.25 },
      ] as Bracket[],
    },
    // Texnopark rezidenti: gəlir vergisi 0%
    texnopark: {
      '2026': [{ from: 0, up: Infinity, base: 0, rate: 0 }] as Bracket[],
      '2025': [{ from: 0, up: Infinity, base: 0, rate: 0 }] as Bracket[],
    },
  },

  // ─────────────────────── İşçi DSMF (pensiya) tutulması ──────────────────────
  employeeDSMF: {
    '2026': [
      { from: 0, up: 200, base: 0, rate: 0.03 },
      { from: 200, up: Infinity, base: 6, rate: 0.1 },
    ] as Bracket[],
    '2025': [
      { from: 0, up: 200, base: 0, rate: 0.03 },
      { from: 200, up: Infinity, base: 6, rate: 0.1 },
    ] as Bracket[],
  },

  // ─────────────────────────── İşçi işsizlik sığortası ───────────────────────
  employeeUnemployment: { rate: 0.005 },

  // ────────────────────────── İşçi tibbi sığorta (İTS) ────────────────────────
  employeeMedical: {
    '2026': [
      { from: 0, up: 2500, base: 0, rate: 0.02 },
      { from: 2500, up: Infinity, base: 50, rate: 0.005 },
    ] as Bracket[],
    '2025': [
      { from: 0, up: 8000, base: 0, rate: 0.02 },
      { from: 8000, up: Infinity, base: 160, rate: 0.005 },
    ] as Bracket[],
  },

  // ─────────────────────── İşəgötürən DSMF (SRS §11.3) ────────────────────────
  employerDSMF: {
    '2026': [
      { from: 0, up: 200, base: 0, rate: 0.22 },
      { from: 200, up: 8000, base: 44, rate: 0.15 },
      { from: 8000, up: Infinity, base: 1214, rate: 0.11 },
    ] as Bracket[],
    '2025': [
      { from: 0, up: 200, base: 0, rate: 0.22 },
      { from: 200, up: 8000, base: 44, rate: 0.15 },
      { from: 8000, up: Infinity, base: 1214, rate: 0.11 },
    ] as Bracket[],
  },

  // ────────────────────── İşəgötürən tibbi sığorta (SRS §11.3) ─────────────────
  employerMedical: {
    '2026': [
      { from: 0, up: 8000, base: 0, rate: 0.02 },
      { from: 8000, up: Infinity, base: 160, rate: 0.005 },
    ] as Bracket[],
    '2025': [
      { from: 0, up: 8000, base: 0, rate: 0.02 },
      { from: 8000, up: Infinity, base: 160, rate: 0.005 },
    ] as Bracket[],
  },

  /** UI-da göstərilən "son qanunvericilik uyğunlaşma tarixi". */
  lastUpdated: '2026-02-13',
} as const;
