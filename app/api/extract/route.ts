import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

        const dataDir = join(process.cwd(), 'data', 'adhoc')
        await mkdir(dataDir, { recursive: true })

        const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
        const filePath = join(dataDir, filename)

        // Save file
        const bytes = await file.arrayBuffer()
        await writeFile(filePath, Buffer.from(bytes))

        // Run extraction
        // Use the absolute path to the venv python if available, else system python
        const pythonCmd = process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : './.venv/bin/python'

        // Check if venv python exists, else fallback to 'python3'
        let cmd = `${pythonCmd} pipeline/adhoc_extractor.py "${filePath}"`

        try {
            const { stdout, stderr } = await execAsync(cmd, {
                env: { ...process.env, PYTHONPATH: join(process.cwd(), 'pipeline') }
            })

            if (stderr && !stdout) {
                throw new Error(stderr)
            }

            const result = JSON.parse(stdout)
            return NextResponse.json(result)
        } catch (err: any) {
            console.error('[Extract API] Script error:', err)
            // Retry with system python if venv fails
            const { stdout } = await execAsync(`python3 pipeline/adhoc_extractor.py "${filePath}"`, {
                env: { ...process.env, PYTHONPATH: join(process.cwd(), 'pipeline') }
            })
            return NextResponse.json(JSON.parse(stdout))
        }

    } catch (error: any) {
        console.error('[Extract API] Server error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
