import { NextResponse } from 'next/server'
import { loadStructuredTransactions } from '@/lib/data-loader'
import { startOfMonth, endOfMonth, format, getDaysInMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month') || format(new Date(), 'yyyy-MM')

    const [year, month] = monthParam.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = endOfMonth(startDate)
    const daysInMonth = getDaysInMonth(startDate)

    // Fetch all transactions for the month
    const { transactions: loaderTransactions } = await loadStructuredTransactions()
    const transactions = loaderTransactions
      .map(tx => ({ ...tx, date: new Date(tx.date) }))
      .filter((tx) => tx.type === 'debit' && tx.date >= startDate && tx.date <= endDate)
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    // Group by day and category
    const dailyByCategory: Record<number, Record<string, number>> = {}
    const allCategories = new Set<string>()

    // Initialize all days
    for (let d = 1; d <= daysInMonth; d++) {
      dailyByCategory[d] = {}
    }

    // Aggregate transactions
    for (const tx of transactions) {
      const day = tx.date.getDate()
      const category = tx.category || 'Other'
      allCategories.add(category)

      if (!dailyByCategory[day]) {
        dailyByCategory[day] = {}
      }
      dailyByCategory[day][category] = (dailyByCategory[day][category] || 0) + tx.amount
    }

    // Convert to array format for the chart
    const dailyData = []
    const categoriesArray = Array.from(allCategories)

    for (let d = 1; d <= daysInMonth; d++) {
      const dayData: Record<string, any> = { day: d.toString() }
      let totalForDay = 0

      for (const category of categoriesArray) {
        const amount = dailyByCategory[d]?.[category] || 0
        dayData[category] = amount
        totalForDay += amount
      }

      dayData.total = totalForDay
      dailyData.push(dayData)
    }

    // Get top categories for coloring
    const categoryTotals: Record<string, number> = {}
    for (const tx of transactions) {
      const cat = tx.category || 'Other'
      categoryTotals[cat] = (categoryTotals[cat] || 0) + tx.amount
    }

    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cat]) => cat)

    return NextResponse.json({
      dailyData,
      categories: topCategories,
    })
  } catch (error) {
    console.error('Error fetching daily spending:', error)
    return NextResponse.json({ error: 'Failed to fetch daily spending' }, { status: 500 })
  }
}
