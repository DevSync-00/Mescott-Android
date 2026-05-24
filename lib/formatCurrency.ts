/** Format amounts in Ethiopian Birr (avoids Intl currency falling back to USD on some devices). */
export function formatETB(
  amount: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  const min = options?.minimumFractionDigits ?? 0
  const max = options?.maximumFractionDigits ?? 2
  const value = Number.isFinite(amount) ? amount : 0
  const formatted = value.toLocaleString('en-ET', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })
  return `${formatted} ETB`
}
