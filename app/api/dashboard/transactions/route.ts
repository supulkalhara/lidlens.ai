import { NextResponse } from 'next/server'
import { loadStructuredTransactions } from '@/lib/data-loader'
import { startOfMonth, endOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const category = searchParams.get('category')
    const merchant = searchParams.get('merchant')
    const search = searchParams.get('search')
    const dateStart = searchParams.get('dateStart')
    const dateEnd = searchParams.get('dateEnd')

    let startDate: Date
    let endDate: Date

    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      startDate = startOfMonth(new Date(year, monthNum - 1))
      endDate = endOfMonth(new Date(year, monthNum - 1))
    } else if (dateStart && dateEnd) {
      startDate = new Date(dateStart)
      endDate = new Date(dateEnd)
    } else {
      const now = new Date()
      startDate = startOfMonth(now)
      endDate = endOfMonth(now)
    }

    const { transactions: allTransactions, cards } = await loadStructuredTransactions()
    const cardMap = new Map(cards.map(c => [c.id, c]))

    const transactions = allTransactions
      .filter((tx) => {
        const txDate = new Date(tx.date)
        return tx.type === 'debit' && txDate >= startDate && txDate <= endDate
      })
      .filter((tx) => (category ? tx.category === category : true))
      .filter((tx) => {
        // Merchant filter: partial match or exact? Using logic from old code
        if (!merchant) return true
        // Note: New data loader stores description. Merchant extraction logic was in the old code.
        // We'll treat description as merchant for now or just skip strictly merchant filter if data doesn't support it well yet.
        // But let's try to support it if "merchant" param is passed
        return (tx.description || '').includes(merchant)
      })
      .filter((tx) => {
        if (!search) return true
        const query = search.toLowerCase()
        return (
          tx.description.toLowerCase().includes(query) ||
          tx.category.toLowerCase().includes(query)
        )
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const formattedTransactions = transactions.map((tx) => {
      const card = cardMap.get(tx.cardId)
      return {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        merchant: tx.description, // Mapping description to merchant for UI
        category: tx.category,
        isRecurring: false,
        creditCard: card ? {
          bank: card.bank,
          maskedNumber: card.name // Using name as maskedNumber for UI display
        } : null,
      }
    })

    return NextResponse.json({
      transactions: formattedTransactions,
      count: formattedTransactions.length,
      totalAmount: formattedTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
