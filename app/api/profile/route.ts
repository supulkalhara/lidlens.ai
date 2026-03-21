import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getProfile, setProfile } from '@/lib/db'

export async function GET() {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userKey = session.user.email
    return NextResponse.json(getProfile(userKey) || { full_name: null, birthday: null })
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userKey = session.user.email
    const { full_name, birthday } = await req.json()
    setProfile(userKey, full_name, birthday)
    return NextResponse.json({ success: true })
}
