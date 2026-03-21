import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getUserAssets, setUserAsset, deleteUserAsset } from '@/lib/db'

export async function GET() {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userKey = session.user.email
    return NextResponse.json(getUserAssets(userKey))
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userKey = session.user.email
    const { id, type, name, details } = await req.json()
    setUserAsset(userKey, type, name, details, id)
    return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userKey = session.user.email
    const { id } = await req.json()
    deleteUserAsset(userKey, id)
    return NextResponse.json({ success: true })
}
