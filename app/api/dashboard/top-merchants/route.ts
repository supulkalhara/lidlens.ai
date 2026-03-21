import { NextResponse } from 'next/server'
import { loadStructuredTransactions } from '@/lib/data-loader'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const categoryParam = searchParams.get('category')

    let startDate: Date
    let endDate: Date

    if (monthParam) {
      const [year, month] = monthParam.split('-').map(Number)
      startDate = new Date(year, month - 1, 1)
      endDate = endOfMonth(startDate)
    } else {
      // Default to last 3 months
      startDate = startOfMonth(subMonths(new Date(), 2))
      endDate = endOfMonth(new Date())
    }

    const { transactions: loaderTransactions } = await loadStructuredTransactions()
    const transactions = loaderTransactions
      .map(tx => ({ ...tx, date: new Date(tx.date) }))
      .filter((tx) => (
        tx.type === 'debit' &&
        tx.date >= startDate &&
        tx.date <= endDate &&
        (!categoryParam || tx.category === categoryParam)
      ))

    // Extract merchant names and aggregate
    const merchantMap = new Map<string, { amount: number; count: number }>()

    for (const tx of transactions) {
      // Clean up merchant name from description or use description
      let merchant = (tx.description || '')
        .replace(/\s+/g, ' ')
        .replace(/\s*(EPP|LLK|SSG|USD|LKR|CR|\d{2,}\/\d{2,})\s*/gi, '')
        .trim()
        .split(/\s{2,}/)[0] // Take first part before multiple spaces
        .substring(0, 30)

      if (merchant.length < 3) continue

      const existing = merchantMap.get(merchant) || { amount: 0, count: 0 }
      merchantMap.set(merchant, {
        amount: existing.amount + tx.amount,
        count: existing.count + 1,
      })
    }

    // Sort by amount and get top 10
    const topMerchants = Array.from(merchantMap.entries())
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
        avgPerVisit: data.amount / data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    return NextResponse.json({ topMerchants })
  } catch (error) {
    console.error('Error fetching top merchants:', error)
    return NextResponse.json({ error: 'Failed to fetch top merchants' }, { status: 500 })
  }
}
