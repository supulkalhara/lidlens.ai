import { auth } from '@/auth'
import { NextResponse } from 'next/server'

// These paths are accessible without authentication
const PUBLIC_PATHS = [
    '/login',
    '/api/auth',   // All NextAuth routes (/api/auth/signin, /api/auth/callback/*, etc.)
]

export default auth((request) => {
    const { pathname } = request.nextUrl

    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
        return NextResponse.next()
    }

    if (!request.auth) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('from', pathname)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
})

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
}
