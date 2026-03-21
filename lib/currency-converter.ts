/**
 * Currency converter with fallback rate
 * 
 * SECURITY NOTE: This does NOT make external API calls during PDF processing.
 * External calls are only made via the /api/currency/rate endpoint when user explicitly requests.
 * All PDF processing uses the fallback rate to avoid data leaks.
 */

// Fallback rate (approximate LKR/USD rate as of Jan 2025)
const FALLBACK_RATE = 295

// Cache for rate (in-memory, server-side only)
let cachedRate: { rate: number; timestamp: number } | null = null
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

/**
 * Get USD to LKR exchange rate (client-side with caching)
 * Only fetches from internal API, never external
 */
export async function getUSDToLKRRate(): Promise<number> {
  try {
    // Check localStorage cache first (client-side)
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('usd_to_lkr_rate')
      if (cached) {
        const { rate, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < CACHE_DURATION) {
          return rate
        }
      }

      // Fetch from OUR internal API (not external)
      const response = await fetch('/api/currency/rate')
      const data = await response.json()
      const rate = data.rate || FALLBACK_RATE

      // Cache the rate
      localStorage.setItem('usd_to_lkr_rate', JSON.stringify({
        rate,
        timestamp: Date.now(),
      }))

      return rate
    }

    // Server-side: use fallback
    return FALLBACK_RATE
  } catch (error) {
    console.error('Error fetching exchange rate:', error)
    return FALLBACK_RATE
  }
}

/**
 * Convert USD to LKR
 */
export async function convertUSDToLKR(usdAmount: number): Promise<number> {
  const rate = await getUSDToLKRRate()
  return usdAmount * rate
}

/**
 * Server-side currency conversion (for API routes)
 * Uses fallback rate to avoid external calls during PDF processing
 * This prevents any sensitive transaction data from being exposed
 */
export async function getUSDToLKRRateServer(): Promise<number> {
  // Check in-memory cache
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    return cachedRate.rate
  }

  // Use fallback rate for PDF processing (no external calls)
  // The actual live rate is fetched separately via /api/currency/rate
  return FALLBACK_RATE
}

/**
 * Fetch live rate from external API
 * ONLY called by /api/currency/rate endpoint, NOT during PDF processing
 */
export async function fetchLiveExchangeRate(): Promise<number> {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      next: { revalidate: 3600 },
    })
    const data = await response.json()
    const rate = data.rates?.LKR || FALLBACK_RATE

    // Cache for server-side use
    cachedRate = { rate, timestamp: Date.now() }

    return rate
  } catch (error) {
    console.error('Error fetching live exchange rate:', error)
    return FALLBACK_RATE
  }
}
