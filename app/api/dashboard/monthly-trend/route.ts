import { NextResponse } from 'next/server'
import { loadStructuredTransactions } from '@/lib/data-loader'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const months = []
    const { transactions: loaderTransactions } = await loadStructuredTransactions()
    const allTransactions = loaderTransactions.map(tx => ({ ...tx, date: new Date(tx.date) }))

    // Get last 6 months of data
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i)
      const startDate = startOfMonth(date)
      const endDate = endOfMonth(date)

      const transactions = allTransactions.filter((tx) => (
        tx.type === 'debit' && tx.date >= startDate && tx.date <= endDate
      ))

      const totalSpending = transactions.reduce((sum, t) => sum + t.amount, 0)
      const transactionCount = transactions.length

      // Find largest transaction
      let largestTx = { amount: 0, description: '' }
      if (transactions.length > 0) {
        const sorted = [...transactions].sort((a, b) => b.amount - a.amount)
        if (sorted.length > 0) {
          largestTx = {
            amount: sorted[0].amount,
            description: sorted[0].description
          }
        }
      }

      months.push({
        month: format(date, 'MMM'),
        fullMonth: format(date, 'MMMM yyyy'),
        yearMonth: format(date, 'yyyy-MM'),
        spending: totalSpending,
        transactions: transactionCount,
        largestTransaction: largestTx,
        avgPerTransaction: transactionCount > 0 ? totalSpending / transactionCount : 0,
      })
    }

    return NextResponse.json({ monthlyTrend: months })
  } catch (error) {
    console.error('Error fetching monthly trend:', error)
    return NextResponse.json({ error: 'Failed to fetch monthly trend' }, { status: 500 })
  }
}
