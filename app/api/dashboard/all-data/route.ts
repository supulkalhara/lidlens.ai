import { NextResponse } from 'next/server'
import { loadManualData, loadStructuredTransactions } from '@/lib/data-loader'
import { auth } from '@/auth'
import { getUserAssets } from '@/lib/db'
import fs from 'fs'
import path from 'path'

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    const userKey = session?.user?.email

    const [manualData, structuredData] = await Promise.all([
      loadManualData(),
      loadStructuredTransactions(),
    ])

    // Load dynamic assets from DB
    let dbLoans: any[] = []
    if (userKey) {
      const assets = getUserAssets(userKey)
      dbLoans = assets.filter(a => a.type === 'loan').map(a => ({
        id: a.id.toString(),
        bank: a.name,
        type: 'Loan',
        principal: Number(a.details.principal) || 0,
        outstandingBalance: Number(a.details.outstanding_balance) || 0,
        interestRate: Number(a.details.interest_rate) || 0,
        monthlyPayment: Number(a.details.monthly_payment) || 0,
        loanId: a.details.loan_id
      }))
    }

    const allLoans = [...manualData.loans, ...dbLoans]


    // Scan for unlocked PDFs to show in the UI
    const unlockedDir = path.join(process.cwd(), 'data', 'card_statements_unlocked')
    let unlockedFiles: string[] = []
    try {
      if (fs.existsSync(unlockedDir)) {
        unlockedFiles = fs.readdirSync(unlockedDir).filter((f: string) => f.endsWith('.pdf'))
      }
    } catch (e) {
      console.error('Error reading unlocked statements dir', e)
    }

    return NextResponse.json({
      accounts: manualData.accounts.map((account) => ({
        ...account,
        balances: [{ balance: account.currentBalance, date: new Date().toISOString() }],
      })),
      creditCards: structuredData.cards.map(card => {
        // Find PDFs that start with the card name (e.g. ComBank_ or HNB_)
        const cardPdfs = unlockedFiles.filter(f => f.startsWith(card.name) || f.startsWith(card.bank))
        return {
          ...card,
          statements: card.statements || [],
          pdfStatements: cardPdfs
        }
      }),
      loans: allLoans.map(loan => {
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
