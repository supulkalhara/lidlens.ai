import { NextResponse } from 'next/server'
import { loadStructuredTransactions } from '@/lib/data-loader'
import { startOfMonth, endOfMonth, format } from 'date-fns'

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // Format: YYYY-MM
    const creditCardId = searchParams.get('creditCardId')

    // Get transactions for the specified month
    let startDate: Date
    let endDate: Date

    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      startDate = startOfMonth(new Date(year, monthNum - 1))
      endDate = endOfMonth(new Date(year, monthNum - 1))
    } else {
      // Default to current month
      const now = new Date()
      startDate = startOfMonth(now)
      endDate = endOfMonth(now)
    }

    const { transactions: allTransactions } = await loadStructuredTransactions()
    const transactions = allTransactions
      .map(tx => ({ ...tx, date: new Date(tx.date) }))
      .filter((tx) => tx.date >= startDate && tx.date <= endDate && tx.type === 'debit')
      .filter((tx) => (creditCardId ? tx.cardId === creditCardId : true))
      .sort((a, b) => b.date.getTime() - a.date.getTime())

    // Group by category
    const categoryMap = new Map<string, number>()
    let totalSpending = 0

    for (const transaction of transactions) {
      const category = transaction.category || 'Other'
      const current = categoryMap.get(category) || 0
      categoryMap.set(category, current + transaction.amount)
      totalSpending += transaction.amount
    }

    // Convert to array format for charts
    const categoryData = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    // Get monthly trend (last 6 months)
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      months.push(format(date, 'yyyy-MM'))
    }

    // Optimize: Pre-parse dates for all transactions for trend calculation
    const parsedTransactions = allTransactions.map(tx => ({ ...tx, date: new Date(tx.date) }))

    const monthlyTrend = await Promise.all(
      months.map(async (monthStr) => {
        const [year, monthNum] = monthStr.split('-').map(Number)
        const monthStart = startOfMonth(new Date(year, monthNum - 1))
        const monthEnd = endOfMonth(new Date(year, monthNum - 1))

        const monthTransactions = parsedTransactions.filter((tx) => {
          if (tx.type !== 'debit') return false
          if (tx.date < monthStart || tx.date > monthEnd) return false
          if (creditCardId && tx.cardId !== creditCardId) return false
          return true
        })

        const monthTotal = monthTransactions.reduce((sum, t) => sum + t.amount, 0)

        return {
          month: format(monthStart, 'MMM yyyy'),
          amount: monthTotal,
        }
      })
    )

    return NextResponse.json({
      categoryData,
      monthlyTrend,
      totalSpending,
      transactionCount: transactions.length,
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd'),
      },
    })
  } catch (error) {
    console.error('Error fetching category data:', error)
    return NextResponse.json({ error: 'Failed to fetch category data' }, { status: 500 })
  }
}
