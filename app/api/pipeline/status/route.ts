import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const pdfDir = path.join(process.cwd(), 'data', 'card_statements_unlocked')
  const jsonDir = path.join(process.cwd(), 'data', 'card_statements_structured')
  const csvDir = path.join(process.cwd(), 'data', 'card_statements_csv')

  const readDir = (dir: string) => {
    try { return fs.readdirSync(dir) } catch { return [] }
  }

  const allPdfs = readDir(pdfDir).filter((f: string) => f.endsWith('.pdf'))

  // Build sets of stems with non-empty JSON and CSV
  const jsonStems = new Set<string>()
  const emptyJsonStems = new Set<string>()
  for (const f of readDir(jsonDir).filter((f: string) => f.endsWith('.json'))) {
    const stem = f.replace('.json', '')
    try {
      const raw = fs.readFileSync(path.join(jsonDir, f), 'utf8').trim()
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) jsonStems.add(stem)
      else emptyJsonStems.add(stem)
    } catch { emptyJsonStems.add(stem) }
  }
  const allCsvs = new Set(readDir(csvDir).filter((f: string) => f.endsWith('.csv')).map((f: string) => f.replace('.csv', '')))

  const bankOrder = ['ComBank', 'HNB', 'HSBC']

  const files = allPdfs.map((pdf: string) => {
    const stem = pdf.replace('.pdf', '')
    const hasJson = jsonStems.has(stem)          // non-empty JSON
    const hasEmptyJson = emptyJsonStems.has(stem) // exists but empty
    const hasCsv = allCsvs.has(stem)

    // Extract bank prefix (first segment before _)
    const bankMatch = stem.match(/^([A-Za-z]+)_/)
    const bank = bankMatch ? bankMatch[1] : 'Other'

    // Extract YYYY-MM
    const monthMatch = stem.match(/_(\d{4}-\d{2})_/)
    const yearMonth = monthMatch ? monthMatch[1] : null

    // Derive human-readable label
    const label = yearMonth
      ? new Date(yearMonth + '-02').toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : stem

    // Determine card sub-type (VISA_PLAT, VISA_CARD, etc.)
    const typeMatch = stem.match(/_(VISA_[A-Z]+|[A-Z]+_[A-Z]+)_\d{8}/)
    const cardType = typeMatch ? typeMatch[1].replace(/_/g, ' ') : ''

    // Status:
    //   processed   = non-empty JSON + CSV both exist
    //   partial     = non-empty JSON but no CSV (or empty JSON stub from a failed run)
    //   unprocessed = no JSON at all
    let status: 'processed' | 'partial' | 'unprocessed'
    if (hasJson && hasCsv) status = 'processed'
    else if (hasJson || hasEmptyJson) status = 'partial'
    else status = 'unprocessed'

    return { pdf, stem, bank, yearMonth, label, cardType, hasJson, hasEmptyJson, hasCsv, status }
  })

  // Sort: by bank order, then by yearMonth desc
  files.sort((a: any, b: any) => {
    const aIdx = bankOrder.indexOf(a.bank)
    const bIdx = bankOrder.indexOf(b.bank)
    const bankCmp = (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
    if (bankCmp !== 0) return bankCmp
    return (b.yearMonth || '').localeCompare(a.yearMonth || '')
  })

  const totals = {
    total: files.length,
    processed: files.filter((f: any) => f.status === 'processed').length,
    partial: files.filter((f: any) => f.status === 'partial').length,
    unprocessed: files.filter((f: any) => f.status === 'unprocessed').length,
  }

  return NextResponse.json({ files, totals })
}
