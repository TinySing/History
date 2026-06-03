export function formatYear(year: number | null): string {
  if (year === null) return '年份不详';
  return year < 0 ? `前${Math.abs(year)}年` : `${year}年`;
}
