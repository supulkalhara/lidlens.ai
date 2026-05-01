import { NextResponse } from 'next/server'
import { loadStructuredTransactions, loadManualData } from '@/lib/data-loader'
import { subMonths, startOfMonth, endOfMonth, format as dateFormat } from 'date-fns'

export const dynamic = 'force-dynamic'

const subscriptionPatterns = [
  { pattern: /netflix/i, name: 'Netflix', category: 'Streaming' },
  { pattern: /spotify/i, name: 'Spotify', category: 'Streaming' },
  { pattern: /youtube\s*premium|youtube.*premium|google\s*youtube/i, name: 'YouTube Premium', category: 'Streaming' },
  { pattern: /\bapple\b|apple\.com|itunes|app.*store/i, name: 'Apple Services', category: 'Digital Services' },
  { pattern: /google\s*one|google\s*storage|google\s*play|google.*play|google.*services/i, name: 'Google Services', category: 'Digital Services' },
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
  { pattern: /\bslt\b|sri\s*lanka\s*telecom/i, name: 'SLT', category: 'Internet' },
  { pattern: /mobitel|dialog/i, name: 'Telco', category: 'Telco' },
  { pattern: /anthropic|claude/i, name: 'Claude', category: 'AI' },
  { pattern: /openai|chatgpt/i, name: 'OpenAI', category: 'AI' },
]

export async function GET() {
  try {
    const manualData = await loadManualData()
    const manualSubscriptions = ((manualData as any).subscriptions || []) as Array<{
      name: string
      category?: string
      amount?: number
    }>

    const { transactions: loaderTransactions } = await loadStructuredTransactions()
    const debits = loaderTransactions
      .map(tx => ({ ...tx, _date: new Date(tx.date) }))
      .filter(tx => tx.type === 'debit' && !isNaN(tx._date.getTime()))

    let latestDate = new Date(0)
    for (const tx of debits) {
      if (tx._date > latestDate) latestDate = tx._date
    }

    if (latestDate.getTime() === 0) {
      return NextResponse.json({
        subscriptions: [],
        totalMonthly: 0,
        count: 0,
        basis: null,
        basisLabel: null,
        note: 'No transactions found.',
      })
    }

    const monthMEnd = latestDate
    const monthMStart = new Date(latestDate)
    monthMStart.setDate(monthMStart.getDate() - 30)
    
    const monthMMinus1End = new Date(monthMStart)
    const monthMMinus1Start = new Date(monthMMinus1End)
    monthMMinus1Start.setDate(monthMMinus1Start.getDate() - 30)

    const txM = debits.filter(tx => tx._date > monthMStart && tx._date <= monthMEnd)
    const txMMinus1 = debits.filter(tx => tx._date > monthMMinus1Start && tx._date <= monthMMinus1End)

    const extractSubs = (txs: any[]) => {
      const detected = new Map<string, any>()
      for (const tx of txs) {
        let matched = false
        // Category based
        const cat = (tx.category || '').toLowerCase()
        if (cat === 'subscriptions' || cat === 'subscription') {
          matched = true
          const key = tx.description
          const existing = detected.get(key)
          if (existing) {
            existing.occurrences += 1
            if (tx._date > existing.lastCharge) {
              existing.lastCharge = tx._date
              existing.amount = tx.amount
            }
          } else {
            detected.set(key, {
              name: tx.description,
              category: 'subscription',
              amount: tx.amount,
              lastCharge: tx._date,
              occurrences: 1,
            })
          }
        }
        // Pattern based
        if (!matched) {
          for (const sub of subscriptionPatterns) {
            if (sub.pattern.test(tx.description)) {
              const existing = detected.get(sub.name)
              if (existing) {
                existing.occurrences += 1
                if (tx._date > existing.lastCharge) {
                  existing.lastCharge = tx._date
                  existing.amount = tx.amount
                }
              } else {
                detected.set(sub.name, {
                  name: sub.name,
                  category: sub.category,
                  amount: tx.amount,
                  lastCharge: tx._date,
                  occurrences: 1,
                })
              }
              break
            }
          }
        }
      }
      return detected
    }

    const subsM = extractSubs(txM)
    const subsMMinus1 = extractSubs(txMMinus1)

    // Manual subscriptions fallback handling
    const addManualSubs = (map: Map<string, any>, transactions: any[], defaultDate: Date) => {
      for (const sub of manualSubscriptions) {
        const name = (sub.name || '').trim()
        if (!name || map.has(name)) continue
        const needle = name.toLowerCase()
        const match = transactions.find(tx => tx.description.toLowerCase().includes(needle))
        if (match) {
          map.set(name, {
            name,
            category: sub.category || 'subscription',
            amount: sub.amount ?? match.amount,
            lastCharge: match._date,
            occurrences: 1,
          })
        }
      }
    }
    
    addManualSubs(subsM, txM, monthMStart)
    addManualSubs(subsMMinus1, txMMinus1, monthMMinus1Start)

    const finalSubscriptions: any[] = []

    for (const [name, sub] of subsM.entries()) {
      if (!subsMMinus1.has(name)) {
        finalSubscriptions.push({ ...sub, status: 'new' })
      } else {
        finalSubscriptions.push({ ...sub, status: 'active' })
      }
    }

    for (const [name, sub] of subsMMinus1.entries()) {
      if (!subsM.has(name)) {
        finalSubscriptions.push({ ...sub, status: 'discontinued' })
      }
    }

    const formattedSubscriptions = finalSubscriptions
      .sort((a, b) => b.amount - a.amount)
      .map(s => ({
        ...s,
        lastCharge: s.lastCharge.toISOString(),
      }))

    // Only sum the active and new subscriptions for the current month's total
    const totalMonthly = formattedSubscriptions
      .filter(s => s.status !== 'discontinued')
      .reduce((sum, s) => sum + s.amount, 0)

    return NextResponse.json({
      subscriptions: formattedSubscriptions,
      totalMonthly,
      count: formattedSubscriptions.filter(s => s.status !== 'discontinued').length,
      basis: {
        start: monthMStart.toISOString(),
        end: monthMEnd.toISOString(),
      },
      basisLabel: dateFormat(monthMStart, 'MMM yyyy'),
    })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}
