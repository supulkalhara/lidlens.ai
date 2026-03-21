import { NextResponse } from 'next/server'
import { loadManualData, loadStructuredTransactions } from '@/lib/data-loader'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const { accounts, loans, income, categoryLimits } = await loadManualData()
        const { transactions } = await loadStructuredTransactions()

        // Calculate total monthly income
        const totalMonthlyIncome = income
            .filter(i => i.frequency === 'monthly')
            .reduce((sum, i) => sum + i.amount, 0)

        // Calculate fixed monthly obligations (loan payments)
        const totalLoanPayments = loans.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)

        // Get current month date range
        const now = new Date()
        const currentMonthStart = startOfMonth(now)
        const currentMonthEnd = endOfMonth(now)

        // Calculate spending by category for current month
        const currentMonthTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date)
            return txDate >= currentMonthStart && txDate <= currentMonthEnd && tx.type === 'debit'
        })

        const categorySpending: Record<string, number> = {}
        currentMonthTransactions.forEach(tx => {
            const cat = tx.category.toLowerCase()
            categorySpending[cat] = (categorySpending[cat] || 0) + tx.amount
        })

        // Calculate average spending per category (last 3 months)
        const threeMonthsAgo = subMonths(now, 3)
        const historicalTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date)
            return txDate >= threeMonthsAgo && txDate <= currentMonthEnd && tx.type === 'debit'
        })

        const historicalSpending: Record<string, number> = {}
        historicalTransactions.forEach(tx => {
            const cat = tx.category.toLowerCase()
            historicalSpending[cat] = (historicalSpending[cat] || 0) + tx.amount
        })

        // Average per month (divide by 3)
        const averageSpending: Record<string, number> = {}
        Object.entries(historicalSpending).forEach(([cat, total]) => {
            averageSpending[cat] = Math.round(total / 3)
        })

        // Check limits and flag exceeded
        const categoryAnalysis = Object.keys({ ...categorySpending, ...averageSpending }).map(category => {
            const current = categorySpending[category] || 0
            const average = averageSpending[category] || 0
            const limit = categoryLimits[category] ?? null
            const exceeded = limit !== null && current > limit

            return {
                category,
                currentMonth: current,
                average,
                limit,
                exceeded,
            }
        }).sort((a, b) => b.currentMonth - a.currentMonth)

        // Calculate total spending this month
        const totalSpendingThisMonth = Object.values(categorySpending).reduce((a, b) => a + b, 0)

        // Calculate disposable income
        const disposableIncome = totalMonthlyIncome - totalLoanPayments
        const surplus = disposableIncome - totalSpendingThisMonth

        // Account totals
        const totalLKR = accounts
            .filter(a => a.currency === 'LKR')
            .reduce((sum, a) => sum + a.currentBalance, 0)

        const totalUSD = accounts
            .filter(a => a.currency === 'USD')
            .reduce((sum, a) => sum + a.currentBalance, 0)

        return NextResponse.json({
            income: {
                monthly: totalMonthlyIncome,
                sources: income,
            },
            obligations: {
                loanPayments: totalLoanPayments,
                loans: loans.map(l => ({
                    id: l.id,
                    bank: l.bank,
                    type: l.type,
                    monthly: l.monthlyPayment,
                    outstanding: l.outstandingBalance,
                })),
            },
            spending: {
                currentMonth: totalSpendingThisMonth,
                byCategory: categoryAnalysis,
            },
            summary: {
                disposableIncome,
                surplus,
                isFeasible: surplus >= 0,
                currentMonth: format(now, 'MMMM yyyy'),
            },
            accounts: {
                totalLKR,
                totalUSD,
            },
        })
    } catch (error) {
        console.error('Error in budget summary:', error)
        return NextResponse.json({ error: 'Failed to generate budget summary' }, { status: 500 })
    }
}
