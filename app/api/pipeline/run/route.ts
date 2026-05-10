import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const pdf = body?.pdf

  if (!pdf || typeof pdf !== 'string') {
    return NextResponse.json({ error: 'pdf filename required' }, { status: 400 })
  }

  // Safety: only allow filenames, no path traversal
  const safeFilename = path.basename(pdf)
  const pdfPath = path.join(process.cwd(), 'data', 'card_statements_unlocked', safeFilename)
  if (!fs.existsSync(pdfPath)) {
    return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
  }

  const scriptPath = path.join(process.cwd(), 'scripts', 'extract_single.py')
  const cwd = process.cwd()

  try {
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" "${safeFilename}"`,
      { cwd, timeout: 180_000 }
    )
    // Last line of stdout is the JSON result
    const lines = stdout.trim().split('\n').filter(Boolean)
    const resultLine = lines[lines.length - 1]
    const result = JSON.parse(resultLine)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[Pipeline run]', err.message)
    return NextResponse.json({ error: err.message?.slice(0, 300) }, { status: 500 })
  }
}
