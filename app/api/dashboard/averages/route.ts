import { NextResponse } from 'next/server'
import { loadStructuredTransactions } from '@/lib/data-loader'
import { format, subMonths } from 'date-fns'

export async function GET() {
    try {
        const { transactions } = await loadStructuredTransactions()

        // Get last 6 months of data
        const now = new Date()
        const monthsData: Record<string, Record<string, number>> = {}



        // Aggregate spending by category per month
        // Aggregate spending by category per month
        transactions.forEach(tx => {
            const txMonth = tx.date.substring(0, 7) // Extract yyyy-MM
            if (!monthsData[txMonth]) {
                monthsData[txMonth] = {}
            }

            const category = tx.category || 'other'
            if (!monthsData[txMonth][category]) {
                monthsData[txMonth][category] = 0
            }
            monthsData[txMonth][category] += tx.amount
        })

        // Calculate averages
        const categoryAverages: Record<string, number> = {}
        const monthCount = Object.keys(monthsData).length

        Object.values(monthsData).forEach(monthCategories => {
            Object.entries(monthCategories).forEach(([category, amount]) => {
                if (!categoryAverages[category]) {
                    categoryAverages[category] = 0
                }
                categoryAverages[category] += amount
            })
        })

        // Convert to averages and sort
        const averages = Object.entries(categoryAverages)
            .map(([category, total]) => ({
                category,
                average: total / monthCount,
                total
            }))
            .sort((a, b) => b.average - a.average)
            .slice(0, 5) // Top 5 categories

        return NextResponse.json({
            averages,
            monthCount,
            totalAverage: averages.reduce((sum, cat) => sum + cat.average, 0)
        })
    } catch (error) {
        console.error('Error calculating averages:', error)
        return NextResponse.json({ averages: [], monthCount: 0, totalAverage: 0 })
    }
}
