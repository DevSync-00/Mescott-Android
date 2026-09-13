export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'completed' | 'refunded'

export function isPaymentPaid(status?: string | null): boolean {
  return status === 'paid' || status === 'completed'
}

export function getPaymentStatusLabel(status?: string | null): string {
  if (isPaymentPaid(status)) return 'Paid'
  if (!status) return 'Pending'
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
