/** Formatlaşdırma köməkçiləri. */

export function money(n: number, currency = 'AZN'): string {
  const v = n.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v} ${currency === 'AZN' ? '₼' : currency}`;
}

export function pct(n: number): string {
  return `${(n * 100).toLocaleString('az-AZ', { maximumFractionDigits: 1 })}%`;
}

export function signed(n: number): string {
  return (n >= 0 ? '+' : '') + n.toLocaleString('az-AZ', { maximumFractionDigits: 2 });
}

/** effectiveDate-dən il sonuna qədər ay sayı (büdcə effectiveMonths üçün, SRS §7.3). */
export function monthsToYearEnd(effectiveDateISO: string, year: number): number {
  const d = new Date(effectiveDateISO);
  const startMonth = d.getUTCFullYear() === year ? d.getUTCMonth() : 0; // 0-indexed
  return Math.max(0, 12 - startMonth);
}
