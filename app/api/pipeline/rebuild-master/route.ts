import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)
export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const scriptPath = path.join(process.cwd(), 'scripts', 'build_master_csv.py')
  try {
    const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`, {
      cwd: process.cwd(),
      timeout: 60_000,
    })
    const lines = (stdout + stderr).trim().split('\n').filter(Boolean)
    return NextResponse.json({ ok: true, output: lines })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message?.slice(0, 300) }, { status: 500 })
  }
}
