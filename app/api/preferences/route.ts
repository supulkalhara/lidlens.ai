import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
    getAllPreferences, setPreference,
    getBudgetLimits, setBudgetLimit, deleteBudgetLimit,
} from '@/lib/db'

// Use email (Google) or 'local' (password login) as the user scope key
function userKey(email?: string | null): string {
    return email && email !== 'local@lidlens.local' ? email : 'local'
}

// GET /api/preferences — fetch all prefs + budget limits for current user
export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const key = userKey(session.user?.email)
    const prefs = getAllPreferences(key)
    const budget = getBudgetLimits(key)

    return NextResponse.json({ preferences: prefs, budgetLimits: budget })
}

// POST /api/preferences — upsert a single preference or budget limit
// Body: { type: 'preference'|'budget', key: string, value: any }
//       { type: 'budget_delete', category: string }
export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const key = userKey(session.user?.email)
    const body = await req.json()

    if (body.type === 'preference') {
        setPreference(key, body.key, body.value)
        return NextResponse.json({ ok: true })
    }

    if (body.type === 'budget') {
        setBudgetLimit(key, body.category, Number(body.value))
        return NextResponse.json({ ok: true })
    }

    if (body.type === 'budget_delete') {
        deleteBudgetLimit(key, body.category)
        return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
