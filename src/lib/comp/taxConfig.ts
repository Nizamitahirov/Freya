/**
 * taxConfig — vergi/tutulma parametrlərinin sabitləri (SRS §11.6).
 *
 * Düsturların özü `engine.ts`-dədir və **Mycalcpro / BirCalc** mənbəyindən birə-bir
 * köçürülüb (bax: engine.ts başlığı). Burada yalnız düsturlardan kənar konfiqurasiya
 * sabitləri saxlanılır.
 */

export type Sector = 'private' | 'public' | 'texnopark';
export type Workplace = 'main' | 'secondary';
export type TaxYear = '2025' | '2026';

/** VM 102 üzrə default aylıq gəlir vergisi güzəşti (AZN). */
export const DEFAULT_BENEFIT = 200;

/** Default yemək pulu limiti (AZN) — şirkət konfiqurasiyasında dəyişir (SRS §11.7). */
export const DEFAULT_MEAL_LIMIT = 100;

/** Minimum gross artım fərqi (BirCalc): baş ofis 50 AZN / filial 20 AZN. */
export const MIN_GROSS_DIFF = { branch: 20, hq: 50 } as const;

/** Geriyə uyğunluq üçün köhnə ad. */
export const DEFAULT_MIN_GROSS_DIFF = MIN_GROSS_DIFF;

/** solveGross binary-search iterasiya sayı (BirCalc ilə eyni). */
export const SOLVE_GROSS_ITERATIONS = 38;

/** UI-da göstərilən "son qanunvericilik uyğunlaşma tarixi". */
export const taxConfig = {
  source: 'Mycalcpro / BirCalc (Nizamitahirov/Mycalcpro)',
  lastUpdated: '2026-02-13',
} as const;
