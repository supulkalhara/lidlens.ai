import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const MASTER_CSV = join(process.cwd(), 'data', 'master_transactions.csv')

/**
 * Parses one CSV line, respecting quoted fields. Master CSV is generated
 * by scripts/build_master_csv.py and uses Python csv defaults — comma
 * delimiter, double-quote quoting, no embedded newlines in fields.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else cur += c
    } else {
      if (c === ',') { out.push(cur); cur = '' }
      else if (c === '"') { inQuotes = true }
      else cur += c
    }
  }
  out.push(cur)
  return out
}

export async function GET() {
  try {
    let raw: string
    try {
      raw = await readFile(MASTER_CSV, 'utf-8')
    } catch {
      return NextResponse.json({
        available: false,
        message: 'master_transactions.csv not built yet. Run: python3 scripts/build_master_csv.py',
        totals: { total: 0, yearMismatch: 0, futureDate: 0, duplicate: 0, largeAmount: 0 },
        flagged: [],
      })
    }

    const lines = raw.split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) {
      return NextResponse.json({
        available: true,
        totals: { total: 0, yearMismatch: 0, futureDate: 0, duplicate: 0, largeAmount: 0 },
        flagged: [],
      })
    }

    const headers = parseCsvLine(lines[0])
    const idx = (k: string) => headers.indexOf(k)

    const I_ID = idx('id')
    const I_DATE = idx('date_iso')
    const I_DESC = idx('description')
    const I_AMT = idx('amount')
    const I_DIR = idx('direction')
    const I_CAT = idx('category')
    const I_BANK = idx('bank')
    const I_SRC = idx('source_file')
    const I_YR_MISMATCH = idx('year_mismatch_flag')
    const I_FUTURE = idx('future_date_flag')
    const I_DUP = idx('duplicate_flag')
    const I_BIG = idx('large_amount_flag')
    const I_NOTES = idx('notes')

    let yearMismatch = 0
    let futureDate = 0
    let duplicate = 0
    let largeAmount = 0
    const flagged: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i])
      const ym = cells[I_YR_MISMATCH] === 'True'
      const fd = cells[I_FUTURE] === 'True'
      const dp = cells[I_DUP] === 'True'
      const lg = cells[I_BIG] === 'True'
      if (ym) yearMismatch++
      if (fd) futureDate++
      if (dp) duplicate++
      if (lg) largeAmount++
      if (ym || fd || dp || lg) {
        flagged.push({
          id: cells[I_ID],
          date: cells[I_DATE],
          description: cells[I_DESC],
          amount: Number(cells[I_AMT]) || 0,
          direction: cells[I_DIR],
          category: cells[I_CAT],
          bank: cells[I_BANK],
          source: cells[I_SRC],
          flags: {
            yearMismatch: ym,
            futureDate: fd,
            duplicate: dp,
            largeAmount: lg,
          },
          notes: cells[I_NOTES] || '',
        })
      }
    }

    // Sort flagged: show large amounts first, then year mismatches
    flagged.sort((a, b) => {
      const sev = (r: any) =>
        (r.flags.largeAmount ? 4 : 0) +
        (r.flags.duplicate ? 3 : 0) +
        (r.flags.futureDate ? 2 : 0) +
        (r.flags.yearMismatch ? 1 : 0)
      const d = sev(b) - sev(a)
      if (d !== 0) return d
      return Math.abs(b.amount) - Math.abs(a.amount)
    })

    return NextResponse.json({
      available: true,
      totals: {
        total: lines.length - 1,
        yearMismatch,
        futureDate,
        duplicate,
        largeAmount,
      },
      flagged: flagged.slice(0, 50),
    })
  } catch (error) {
    console.error('Error reading data quality:', error)
    return NextResponse.json({ error: 'Failed to read data quality' }, { status: 500 })
  }
}
