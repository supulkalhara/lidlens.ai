import { NextResponse } from 'next/server'
import { loadManualData, loadStructuredTransactions } from '@/lib/data-loader'
import { startOfMonth, endOfMonth } from 'date-fns'

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // Format: YYYY-MM

    const [manualData, structuredData] = await Promise.all([
      loadManualData(),
      loadStructuredTransactions(),
    ])

    const { accounts, loans } = manualData
    const { cards: creditCards, transactions: allTransactions } = structuredData

    // Calculate totals
    const totalAssets = accounts.reduce((sum, account) => sum + (account.currentBalance || 0), 0)

    const totalLiabilities = loans.reduce((sum, loan) => sum + (loan.outstandingBalance || 0), 0)

    const netWorth = totalAssets - totalLiabilities

    const monthlyIncome = 0 // Removed specific logic unless present in manualData, defaulting to 0 or could add to manualData

    // For cards, we simplified logic. Assuming limit 0 for now as per data-loader, 
    // unless we want to sum up transactions to guess used amount, but let's just stick to what we have.
    const totalCreditLimit = creditCards.reduce((sum, card) => sum + (card.limit || 0), 0)
    const totalCreditUsed = creditCards.reduce((sum, card) => sum + (card.usedAmount || 0), 0)
    const totalCreditAvailable = Math.max(0, totalCreditLimit - totalCreditUsed)

    // Get transactions for the specified month (for daily breakdown)
    let transactions: any[] = []
    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      const startDate = startOfMonth(new Date(year, monthNum - 1))
      const endDate = endOfMonth(new Date(year, monthNum - 1))

      transactions = allTransactions
        .map(tx => ({ ...tx, date: new Date(tx.date) }))
        .filter((tx) => tx.date >= startDate && tx.date <= endDate)
        .map((tx) => ({
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          category: tx.category,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
    }

    return NextResponse.json({
      totalAssets,
      totalLiabilities,
      netWorth,
      monthlyIncome,
      totalCreditLimit,
      totalCreditUsed,
      totalCreditAvailable,
      transactions,
    })
  } catch (error) {
    console.error('Error calculating dashboard summary:', error)
    return NextResponse.json({ error: 'Failed to calculate summary' }, { status: 500 })
  }
}
