import { NextResponse } from 'next/server'
import { loadManualData } from '@/lib/data-loader'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { loans, installments } = await loadManualData()

    // Add Loans
    const upcomingPayments: any[] = []

    // Process Loans
    loans.forEach(loan => {
      if (loan.monthlyPayment && loan.outstandingBalance > 0) {
        upcomingPayments.push({
          type: 'loan',
          description: loan.bank,
          amount: loan.monthlyPayment,
          source: loan.bank,
          dueDay: 1,
          outstanding: loan.outstandingBalance,
        })
      }
    })

    // Calculate totals
    const totalInstallments = installments.reduce((sum, i) => sum + i.installmentAmount, 0)
    const totalLoanPayments = loans.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)

    return NextResponse.json({
      payments: upcomingPayments,
      summary: {
        totalInstallments,
        totalLoanPayments,
        totalMonthly: totalInstallments + totalLoanPayments,
        installmentCount: installments.length,
        loanCount: loans.length,
      },
    })
  } catch (error) {
    console.error('Error fetching upcoming payments:', error)
    return NextResponse.json({ error: 'Failed to fetch upcoming payments' }, { status: 500 })
  }
}
