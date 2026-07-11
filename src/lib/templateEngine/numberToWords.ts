const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
]
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
]
const SCALES = ["", "Thousand", "Million", "Billion"]

function chunkToWords(n: number): string {
  let words = ""
  if (n >= 100) {
    words += `${ONES[Math.floor(n / 100)]} Hundred`
    n %= 100
    if (n > 0) words += " "
  }
  if (n >= 20) {
    words += TENS[Math.floor(n / 10)]
    if (n % 10 > 0) words += `-${ONES[n % 10]}`
  } else if (n > 0) {
    words += ONES[n]
  }
  return words
}

/** Converts a non-negative integer into English words, e.g. 1234 -> "One Thousand Two Hundred Thirty-Four". */
export function integerToWords(value: number): string {
  const n = Math.floor(Math.abs(value))
  if (n === 0) return "Zero"

  const chunks: string[] = []
  let remaining = n
  let scaleIndex = 0
  while (remaining > 0) {
    const chunk = remaining % 1000
    if (chunk > 0) {
      chunks.unshift(`${chunkToWords(chunk)}${SCALES[scaleIndex] ? ` ${SCALES[scaleIndex]}` : ""}`)
    }
    remaining = Math.floor(remaining / 1000)
    scaleIndex += 1
  }
  return chunks.join(" ")
}

/** Renders a monetary amount as words, e.g. amountInWords(1234.5, "KES") -> "Kes One Thousand Two Hundred Thirty-Four and 50/100 Only". */
export function amountInWords(amount: number, currency = ""): string {
  const whole = Math.floor(Math.abs(amount))
  const cents = Math.round((Math.abs(amount) - whole) * 100)
  const prefix = currency ? `${currency.charAt(0).toUpperCase()}${currency.slice(1).toLowerCase()} ` : ""
  return `${prefix}${integerToWords(whole)} and ${String(cents).padStart(2, "0")}/100 Only`
}
