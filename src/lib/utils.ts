import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

// Compact Indian numbering for headline figures — an owner scanning a KPI
// card reads "₹12.4L" far faster than "12,40,000.00". Full precision still
// belongs on invoices and reports; this is for at-a-glance tiles only.
export function formatINRCompact(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_00_00_000) return `${(amount / 1_00_00_000).toFixed(2)} Cr`
  if (abs >= 1_00_000) return `${(amount / 1_00_000).toFixed(2)} L`
  if (abs >= 1_000) return `${(amount / 1_000).toFixed(1)} K`
  return amount.toFixed(0)
}

export function formatQty(qty: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(qty)
}

// Headline volume ("642" / "7.2") for KPI tiles, where 3-decimal precision is noise.
export function formatQtyShort(qty: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(qty)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

// Clock-time only (e.g. "3:45 PM") — used for ETA displays where the date
// is already obvious from context (today's dispatch list, live tracking).
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(date))
}

// "18 min" / "1h 5m" — used alongside formatTime for ETA displays.
export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

export function maskAccountNumber(accountNo?: string | null): string {
  if (!accountNo) return '—'
  const digits = accountNo.trim()
  if (digits.length <= 4) return digits
  return 'x'.repeat(digits.length - 4) + digits.slice(-4)
}

// ─── Amount in words (Indian numbering: lakh/crore, not million/billion) ───
// Used on print documents (Tax Invoice, Ledger Statement) the same way a
// Tally-style invoice spells out "Twenty-Nine Thousand Seven Hundred Fifty
// Only" and, per tax line, "Two thousand two hundred sixty-nine and seven
// paisa only". Handles 0 up to 99,99,99,999 (crores) — comfortably beyond
// anything an RMC invoice would ever total.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n]
  const tens = Math.floor(n / 10), ones = n % 10
  return TENS[tens] + (ones ? ' ' + ONES[ones] : '')
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100), rest = n % 100
  return (hundreds ? ONES[hundreds] + ' Hundred' + (rest ? ' ' : '') : '') + (rest ? twoDigitsToWords(rest) : '')
}

// Splits by the Indian lakh/crore grouping (crore, lakh, thousand, hundred)
// rather than the western thousand/million grouping.
function integerToWords(n: number): string {
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 10000000); n %= 10000000
  const lakh = Math.floor(n / 100000); n %= 100000
  const thousand = Math.floor(n / 1000); n %= 1000
  const hundred = n
  const parts: string[] = []
  if (crore) parts.push(threeDigitsToWords(crore) + ' Crore')
  if (lakh) parts.push(twoDigitsToWords(lakh) + ' Lakh')
  if (thousand) parts.push(twoDigitsToWords(thousand) + ' Thousand')
  if (hundred) parts.push(threeDigitsToWords(hundred))
  return parts.join(' ')
}

/** e.g. amountInWords(29750) -> "Twenty-Nine Thousand Seven Hundred Fifty Only" */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount))
  const paise = Math.round((Math.abs(amount) - rupees) * 100)
  const rupeeWords = integerToWords(rupees)
  if (paise === 0) return `${rupeeWords} Only`
  return `${rupeeWords} and ${twoDigitsToWords(paise)} Paise Only`
}

/** Lowercase "and ... paisa only" form used for the per-tax-line words on the invoice print (e.g. CGST/SGST rows). */
export function taxAmountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount))
  const paise = Math.round((Math.abs(amount) - rupees) * 100)
  const rupeeWords = integerToWords(rupees)
  const lower = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  if (paise === 0) return `${lower(rupeeWords)} only`
  return `${lower(rupeeWords)} and ${twoDigitsToWords(paise).toLowerCase()} paisa only`
}
