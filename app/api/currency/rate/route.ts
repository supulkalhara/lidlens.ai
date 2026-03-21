import { NextResponse } from 'next/server'
import { fetchLiveExchangeRate } from '@/lib/currency-converter'

/**
 * Currency rate endpoint
 * This is the ONLY place external API calls are made for exchange rates
 * Triggered only when user explicitly requests rate update
 */
export async function GET() {
  try {
    const rate = await fetchLiveExchangeRate()
    return NextResponse.json({ 
      rate, 
      currency: 'USD', 
      to: 'LKR',
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching exchange rate:', error)
    return NextResponse.json({ 
      rate: 295, 
      currency: 'USD', 
      to: 'LKR',
      fallback: true,
    })
  }
}
