import { differenceInMonths, addMonths, format } from 'date-fns'

/**
 * Calculate monthly interest for money market account
 * @param principal - Principal amount
 * @param annualRate - Annual interest rate as percentage (e.g., 6.5)
 * @returns Monthly interest amount
 */
export function calculateMonthlyInterest(principal: number, annualRate: number): number {
  // Convert annual rate to monthly rate
  const monthlyRate = annualRate / 12 / 100
  return principal * monthlyRate
}

/**
 * Calculate money market balance after interest
 * @param principal - Current balance
 * @param annualRate - Annual interest rate as percentage
 * @param months - Number of months
 * @returns Future balance
 */
export function calculateMoneyMarketBalance(
  principal: number,
  annualRate: number,
  months: number
): number {
  const monthlyRate = annualRate / 12 / 100
  return principal * Math.pow(1 + monthlyRate, months)
}

/**
 * Calculate loan payment schedule
 * @param principal - Loan principal
 * @param annualRate - Annual interest rate as percentage
 * @param startDate - Loan start date
 * @param maturityDate - Loan maturity date
 * @returns Monthly payment amount
 */
export function calculateMonthlyLoanPayment(
  principal: number,
  annualRate: number,
  startDate: Date,
  maturityDate: Date
): number {
  const totalMonths = differenceInMonths(maturityDate, startDate)
  const monthlyRate = annualRate / 12 / 100

  if (monthlyRate === 0) {
    return principal / totalMonths
  }

  // Amortization formula: P * (r * (1 + r)^n) / ((1 + r)^n - 1)
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, totalMonths)
  const denominator = Math.pow(1 + monthlyRate, totalMonths) - 1
  return principal * (numerator / denominator)
}

/**
 * Calculate remaining loan balance after payments
 * @param principal - Original loan principal
 * @param annualRate - Annual interest rate as percentage
 * @param monthlyPayment - Monthly payment amount
 * @param startDate - Loan start date
 * @param currentDate - Current date
 * @returns Remaining balance
 */
export function calculateRemainingLoanBalance(
  principal: number,
  annualRate: number,
  monthlyPayment: number,
  startDate: Date,
  currentDate: Date
): number {
  const monthsPaid = differenceInMonths(currentDate, startDate)
  const monthlyRate = annualRate / 12 / 100

  if (monthlyRate === 0) {
    return Math.max(0, principal - monthlyPayment * monthsPaid)
  }

  // Remaining balance formula: P * (1 + r)^n - PMT * (((1 + r)^n - 1) / r)
  const futureValue = principal * Math.pow(1 + monthlyRate, monthsPaid)
  const paymentValue = monthlyPayment * ((Math.pow(1 + monthlyRate, monthsPaid) - 1) / monthlyRate)
  return Math.max(0, futureValue - paymentValue)
}

/**
 * Calculate next payment date for loan
 * @param paymentDay - Day of month for payment (1-31)
 * @param currentDate - Current date
 * @returns Next payment date
 */
export function getNextPaymentDate(paymentDay: number, currentDate: Date): Date {
  const currentDay = currentDate.getDate()
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  if (currentDay < paymentDay) {
    // Payment day hasn't passed this month
    return new Date(currentYear, currentMonth, paymentDay)
  } else {
    // Payment day has passed, next month
    return new Date(currentYear, currentMonth + 1, paymentDay)
  }
}

/**
 * Format currency in LKR
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
