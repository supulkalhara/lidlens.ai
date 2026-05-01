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
  { pattern: /starlink/i, name: 'Starlink', category: 'Internet' },
  { pattern: /slt|sri\s*lanka\s*telecom/i, name: 'SLT', category: 'Internet' },
  { pattern: /mobitel|dialog/i, name: 'Telco', category: 'Telco' },
  { pattern: /anthropic|claude/i, name: 'Claude', category: 'AI' },
  { pattern: /openai|chatgpt/i, name: 'OpenAI', category: 'AI' },
]

/**
 * Returns the subscriptions that were ACTIVE in the previous calendar
 * month (relative to today). "Active" = had at least one matching
 * transaction in last month's statements. Manual subscriptions are
 * included only if they also had a matching transaction in that window.
 *
 * The window is intentionally the PREVIOUS calendar month, never the
 * current month — the dashboard uses this as a stable "last month's
 * statements" view that does not change with the month selector.
 */
export async function GET() {
  try {
    const manualData = await loadManualData()
    const manualSubscriptions = ((manualData as any).subscriptions || []) as Array<{
      name: string
      category?: string
      amount?: number
    }>

    const now = new Date()
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    const { transactions: loaderTransactions } = await loadStructuredTransactions()

    // Only look at last calendar month's debit transactions.
    const lastMonthTx = loaderTransactions
      .map(tx => ({ ...tx, date: new Date(tx.date) }))
      .filter((tx) =>
        tx.type === 'debit' &&
        tx.date >= lastMonthStart &&
        tx.date <= lastMonthEnd
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime())

    const detected: Map<string, {
      name: string
      category: string
      amount: number
      lastCharge: Date
      occurrences: number
    }> = new Map()

    // Category-based detection (user-tagged).
    for (const tx of lastMonthTx) {
      const cat = (tx.category || '').toLowerCase()
      if (cat === 'subscriptions' || cat === 'subscription') {
        const key = tx.description
        const existing = detected.get(key)
        if (existing) {
          existing.occurrences += 1
          if (tx.date > existing.lastCharge) {
            existing.lastCharge = tx.date
            existing.amount = tx.amount
          }
        } else {
          detected.set(key, {
            name: tx.description,
            category: 'subscription',
            amount: tx.amount,
            lastCharge: tx.date,
            occurrences: 1,
          })
        }
      }
    }

    // Pattern-based detection for well-known services.
    for (const tx of lastMonthTx) {
      for (const sub of subscriptionPatterns) {
        if (sub.pattern.test(tx.description)) {
          const existing = detected.get(sub.name)
          if (existing) {
            existing.occurrences += 1
            if (tx.date > existing.lastCharge) {
              existing.lastCharge = tx.date
              existing.amount = tx.amount
            }
          } else {
            detected.set(sub.name, {
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

    // Manual subscriptions: only include them if last month had a
    // transaction that matches the manual name (case-insensitive substring).
    // This prevents stale one-off manual entries (e.g. "STARLINK INTERNET")
    // from appearing after the user has stopped paying for them.
    for (const sub of manualSubscriptions) {
      const name = (sub.name || '').trim()
      if (!name) continue
      const needle = name.toLowerCase()
      const match = lastMonthTx.find(tx => tx.description.toLowerCase().includes(needle))
      if (!match) continue
      const existing = detected.get(name)
      if (existing) continue // Already picked up via pattern/category.
      detected.set(name, {
        name,
        category: sub.category || 'subscription',
        amount: sub.amount ?? match.amount,
        lastCharge: match.date,
        occurrences: 1,
      })
    }

    const subscriptions = Array.from(detected.values())
      .sort((a, b) => b.amount - a.amount)
      .map(s => ({
        ...s,
        lastCharge: s.lastCharge.toISOString(),
      }))

    const totalMonthly = subscriptions.reduce((sum, s) => sum + s.amount, 0)

    return NextResponse.json({
      subscriptions,
      totalMonthly,
      count: subscriptions.length,
      basis: {
        start: lastMonthStart.toISOString(),
        end: lastMonthEnd.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}
