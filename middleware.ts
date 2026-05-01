import NextAuth from 'next-auth'
import authConfig from './auth.config'
import { NextResponse } from 'next/server'

// Use the edge-safe config in middleware. Do NOT import from '@/auth'
// here — that file pulls in bcryptjs (Node-only) and will break the
// edge runtime build.
const { auth } = NextAuth(authConfig)

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
