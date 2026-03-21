import { NextResponse } from 'next/server'
import { loadStructuredTransactions, loadManualData } from '@/lib/data-loader'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

// Known subscription services - expanded list
const subscriptionPatterns = [
  { pattern: /netflix/i, name: 'Netflix', category: 'Streaming' },
  { pattern: /spotify/i, name: 'Spotify', category: 'Streaming' },
  { pattern: /youtube\s*premium|youtube.*premium/i, name: 'YouTube Premium', category: 'Streaming' },
  { pattern: /apple\.com\/bill|apple\.com|itunes|app.*store/i, name: 'Apple Services', category: 'Digital Services' },
  { pattern: /google\s*(one|storage|play)|google.*play|google.*services/i, name: 'Google Services', category: 'Digital Services' },
  { pattern: /amazon\s*prime|prime\s*video/i, name: 'Amazon Prime', category: 'Streaming' },
  { pattern: /disney\+?|disney\s*plus/i, name: 'Disney+', category: 'Streaming' },
  { pattern: /hbo|hbo\s*max/i, name: 'HBO Max', category: 'Streaming' },
  { pattern: /microsoft|xbox|office\s*365/i, name: 'Microsoft', category: 'Digital Services' },
  { pattern: /adobe/i, name: 'Adobe', category: 'Software' },
  { pattern: /dropbox/i, name: 'Dropbox', category: 'Software' },
  { pattern: /icloud/i, name: 'iCloud', category: 'Digital Services' },
  { pattern: /paramount/i, name: 'Paramount+', category: 'Streaming' },
  { pattern: /peacock/i, name: 'Peacock', category: 'Streaming' },
  { pattern: /hulu/i, name: 'Hulu', category: 'Streaming' },
  { pattern: /crunchyroll/i, name: 'Crunchyroll', category: 'Streaming' },
  { pattern: /twitch/i, name: 'Twitch', category: 'Streaming' },
  { pattern: /discord/i, name: 'Discord', category: 'Digital Services' },
  { pattern: /github/i, name: 'GitHub', category: 'Software' },
  { pattern: /notion/i, name: 'Notion', category: 'Software' },
  { pattern: /zoom/i, name: 'Zoom', category: 'Digital Services' },
]

export async function GET() {
  try {
    // Load manual subscriptions from manual_data.json
    const manualData = await loadManualData()
    const manualSubscriptions = (manualData as any).subscriptions || []

    // Look at last 6 months of transactions to detect subscriptions from category
    const startDate = startOfMonth(subMonths(new Date(), 5))
    const endDate = endOfMonth(new Date())

    const { transactions: loaderTransactions } = await loadStructuredTransactions()
    const transactions = loaderTransactions
      .map(tx => ({ ...tx, date: new Date(tx.date) }))
      .filter((tx) => tx.type === 'debit' && tx.date >= startDate && tx.date <= endDate)
      .sort((a, b) => b.date.getTime() - a.date.getTime())

    const detectedSubscriptions: Map<string, {
      name: string
      category: string
      amount: number
      lastCharge: Date
      occurrences: number
    }> = new Map()

    // Add manual subscriptions first - these should always appear regardless of transaction filtering
    for (const sub of manualSubscriptions) {
      const amount = sub.amount || 0
      const name = sub.name || 'Unknown'

      detectedSubscriptions.set(name, {
        name: name,
        category: sub.category || 'subscription',
        amount: amount,
        lastCharge: new Date(), // Use today as charge date for display
        occurrences: 1,
      })
    }

    // Detect from transactions with category="subscriptions"
    for (const tx of transactions) {
      if (tx.category.toLowerCase() === 'subscriptions' || tx.category.toLowerCase() === 'subscription') {
        const existing = detectedSubscriptions.get(tx.description)
        if (existing) {
          existing.occurrences++
          if (tx.date > existing.lastCharge) {
            existing.lastCharge = tx.date
            existing.amount = tx.amount
          }
        } else {
          detectedSubscriptions.set(tx.description, {
            name: tx.description,
            category: 'subscription',
            amount: tx.amount,
            lastCharge: tx.date,
            occurrences: 1,
          })
        }
      }
    }

    // Also check pattern matching for known services
    for (const tx of transactions) {
      for (const sub of subscriptionPatterns) {
        if (sub.pattern.test(tx.description)) {
          const existing = detectedSubscriptions.get(sub.name)
          if (existing) {
            existing.occurrences++
            if (tx.date > existing.lastCharge) {
              existing.lastCharge = tx.date
              existing.amount = tx.amount
            }
          } else {
            detectedSubscriptions.set(sub.name, {
              name: sub.name,
              category: sub.category,
              amount: tx.amount,
              lastCharge: tx.date,
              occurrences: 1,
            })
          }
          break
        }
      }
    }

    const subscriptions = Array.from(detectedSubscriptions.values())
      .filter(s => s.occurrences >= 1)
      .sort((a, b) => b.amount - a.amount)

    const totalMonthly = subscriptions.reduce((sum, s) => sum + s.amount, 0)

    return NextResponse.json({
      subscriptions,
      totalMonthly,
      count: subscriptions.length,
    })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}
