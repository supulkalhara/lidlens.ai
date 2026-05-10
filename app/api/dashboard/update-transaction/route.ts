import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('Update Transaction POST Body:', body)
    const { id, old_description, old_amount, date_iso, description, amount, direction, category, source_file } = body

    let updatedMaster = false


    // 1. Update master_transactions.csv
    const masterPath = join(process.cwd(), 'data', 'master_transactions.csv')
    try {
      const masterData = await readFile(masterPath, 'utf-8')
      const masterRecords = parse(masterData, { columns: true }) as any[]

      for (let i = 0; i < masterRecords.length; i++) {
        if (masterRecords[i].id === id) {
          masterRecords[i].date_iso = date_iso || masterRecords[i].date_iso
          if (description !== undefined) masterRecords[i].description = description
          if (amount !== undefined) masterRecords[i].amount = amount
          if (direction !== undefined) masterRecords[i].direction = direction
          if (category !== undefined) masterRecords[i].category = category
          
          masterRecords[i].year_mismatch_flag = 'False'
          masterRecords[i].future_date_flag = 'False'
          masterRecords[i].duplicate_flag = 'False'
          masterRecords[i].large_amount_flag = 'False'
          masterRecords[i].notes = 'Manually updated'
          updatedMaster = true
          break
        }
      }

      if (updatedMaster) {
        const masterCsv = stringify(masterRecords, { header: true })
        await writeFile(masterPath, masterCsv)
        console.log('Successfully updated master CSV for ID:', id)
      } else {
        console.warn('Record with ID not found in master CSV:', id)
      }
    } catch (e) {
      console.error('Failed to update master csv:', e)
    }

    // 2. Update structured JSON
    if (source_file) {
      const jsonFileName = source_file.replace('.csv', '.json')
      const jsonPath = join(process.cwd(), 'data', 'card_statements_structured', jsonFileName)
      try {
        const jsonData = await readFile(jsonPath, 'utf-8')
        const records = JSON.parse(jsonData)
        let updatedJson = false

        for (let i = 0; i < records.length; i++) {
          const r = records[i]
          // Match by old description and old amount
          const rAmt = typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount)) || 0
          const oldAmtNum = parseFloat(old_amount) || 0
          
          if (r.description.trim() === old_description.trim() && Math.abs(rAmt - oldAmtNum) < 0.01) {
            if (description !== undefined) r.description = description
            if (amount !== undefined) r.amount = amount
            if (direction !== undefined) r.direction = direction
            if (category !== undefined) r.category = category
            // update date if possible
            if (date_iso) {
              r.transaction_date = date_iso // format might be different but works for JS date
            }
            updatedJson = true
            break
          }
        }

        if (updatedJson) {
          await writeFile(jsonPath, JSON.stringify(records, null, 2))
          console.log('Successfully updated structured JSON:', jsonFileName)
        } else {
          console.warn('Record not found in structured JSON:', old_description, old_amount)
        }
      } catch (e) {
        console.error('Failed to update json:', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating transaction:', error)
    return NextResponse.json({ error: error.message || 'Failed to update transaction' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const source_file = searchParams.get('source_file')
    const old_description = searchParams.get('old_description')
    const old_amount = searchParams.get('old_amount')

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    let updatedMaster = false

    // 1. Delete from master_transactions.csv
    const masterPath = join(process.cwd(), 'data', 'master_transactions.csv')
    try {
      const masterData = await readFile(masterPath, 'utf-8')
      const masterRecords = parse(masterData, { columns: true })

      const newMasterRecords = masterRecords.filter((r: any) => r.id !== id)
      
      if (newMasterRecords.length !== masterRecords.length) {
        const masterCsv = stringify(newMasterRecords, { header: true })
        await writeFile(masterPath, masterCsv)
        updatedMaster = true
      }
    } catch (e) {
      console.error('Failed to update master csv:', e)
    }

    // 2. Delete from structured JSON
    if (source_file && old_description && old_amount) {
      const jsonFileName = source_file.replace('.csv', '.json')
      const jsonPath = join(process.cwd(), 'data', 'card_statements_structured', jsonFileName)
      try {
        const jsonData = await readFile(jsonPath, 'utf-8')
        const records = JSON.parse(jsonData)
        
        const newRecords = records.filter((r: any) => {
          const rAmt = typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount)) || 0
          const oldAmtNum = parseFloat(old_amount) || 0
          return !(r.description.trim() === old_description.trim() && Math.abs(rAmt - oldAmtNum) < 0.01)
        })

        if (newRecords.length !== records.length) {
          await writeFile(jsonPath, JSON.stringify(newRecords, null, 2))
        }
      } catch (e) {
        console.error('Failed to update json:', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
