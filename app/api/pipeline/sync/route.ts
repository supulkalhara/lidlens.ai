import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    try {
        const extractorPath = join(process.cwd(), 'components', 'MailAttachmentExtractor')
        
        // Execute the script using uv
        const { stdout, stderr } = await execAsync('uv run main.py', {
            cwd: extractorPath,
            env: { ...process.env }
        })

        return NextResponse.json({ success: true, output: stdout, stderr })
    } catch (error: any) {
        console.error('[Sync API] Script error:', error)
        return NextResponse.json({ 
            error: error.message || 'Internal server error',
            output: error.stdout,
            stderr: error.stderr
        }, { status: 500 })
    }
}
