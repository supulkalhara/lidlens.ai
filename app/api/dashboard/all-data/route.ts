import { NextResponse } from 'next/server'
import { loadManualData, loadStructuredTransactions } from '@/lib/data-loader'

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [manualData, structuredData] = await Promise.all([
      loadManualData(),
      loadStructuredTransactions(),
    ])

    return NextResponse.json({
      accounts: manualData.accounts.map((account) => ({
        ...account,
        balances: [{ balance: account.currentBalance, date: new Date().toISOString() }],
      })),
      creditCards: structuredData.cards.map(card => ({
        ...card,
        statements: card.statements || []
      })),
      loans: manualData.loans.map(loan => {
        const today = new Date()
        // Simple logic: If today is 25th or later, show reduced balance
        // This assumes manual_data.json holds the "start of month" balance
        if (today.getDate() >= 25) {
          return {
            ...loan,
            outstandingBalance: Math.max(0, loan.outstandingBalance - (loan.monthlyPayment || 0))
          }
        }
        return loan
      }),
    })
  } catch (error) {
    console.error('Error fetching all data:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
