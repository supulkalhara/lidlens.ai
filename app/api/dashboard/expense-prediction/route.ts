import { NextResponse } from 'next/server'
import { loadStructuredTransactions } from '@/lib/data-loader'
import { startOfMonth, endOfMonth, addMonths, format } from 'date-fns'

export async function GET() {
  try {
    const now = new Date()
    const currentMonthStart = startOfMonth(now)
    const currentMonthEnd = endOfMonth(now)

    // Get current month expenses by category
    const { transactions: loaderTransactions } = await loadStructuredTransactions()
    const currentMonthTransactions = loaderTransactions
      .map(tx => ({ ...tx, date: new Date(tx.date) }))
      .filter((tx) => (
        tx.type === 'debit' && tx.date >= currentMonthStart && tx.date <= currentMonthEnd
      ))

    // Calculate monthly average for each category
    const categoryTotals = new Map<string, number>()
    for (const transaction of currentMonthTransactions) {
      const category = transaction.category || 'Other'
      const current = categoryTotals.get(category) || 0
      categoryTotals.set(category, current + transaction.amount)
    }

    // Predict next 12 months
    const predictions = []
    for (let i = 1; i <= 12; i++) {
      const monthDate = addMonths(now, i)
      const monthData: any = {
        month: format(monthDate, 'MMM yyyy'),
        monthValue: format(monthDate, 'yyyy-MM'),
        categories: {},
        total: 0,
      }

      for (const [category, amount] of Array.from(categoryTotals.entries())) {
        monthData.categories[category] = amount
        monthData.total += amount
      }

      predictions.push(monthData)
    }

    return NextResponse.json({
      currentMonth: {
        month: format(now, 'MMM yyyy'),
        categories: Object.fromEntries(categoryTotals),
        total: Array.from(categoryTotals.values()).reduce((a, b) => a + b, 0),
      },
      predictions,
    })
  } catch (error) {
    console.error('Error calculating predictions:', error)
    return NextResponse.json({ error: 'Failed to calculate predictions' }, { status: 500 })
  }
}
