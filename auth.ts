/**
 * auth.ts — NextAuth v5 (Auth.js) configuration
 *
 * Two sign-in methods:
 *   1. Google OAuth — any email OR only allowed emails (set ALLOWED_EMAILS in .env)
 *   2. Password (Credentials) — uses AUTH_PASSWORD from .env
 *
 * Session is a signed JWT cookie (no database required).
 * Secret = NEXTAUTH_SECRET env var.
 */
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

export const { handlers, signIn, signOut, auth } = NextAuth({
    trustHost: true,
    providers: [
        // ─── Google OAuth ─────────────────────────────────────────────
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),

        // ─── Password (Credentials) ───────────────────────────────────
        Credentials({
            id: 'password',
            name: 'Password',
            credentials: {
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                const expected = process.env.AUTH_PASSWORD
                if (!expected) throw new Error('AUTH_PASSWORD is not configured')

                // Support both plain-text and bcrypt hashes.
                // If AUTH_PASSWORD starts with '$2', treat it as a bcrypt hash.
                // Generate a hash: node -e "require('bcryptjs').hash('yourpassword',12).then(console.log)"
                const isHashed = expected.startsWith('$2')
                const valid = isHashed
                    ? await bcrypt.compare(credentials?.password as string, expected)
                    : credentials?.password === expected

                if (!valid) return null
                return {
                    id: 'local',
                    name: 'LidLens User',
                    email: 'local@lidlens.local',
                }
            },
        }),
    ],

    // Use JWT sessions — no database needed
    session: { strategy: 'jwt' },

    pages: {
        signIn: '/login',
        error: '/login',
    },

    callbacks: {
        // Deny-by-default for Google: ALLOWED_EMAILS must be set.
        // Password login always works regardless of this setting.
        async signIn({ account, profile }) {
            if (account?.provider === 'google') {
                const allowed = (process.env.ALLOWED_EMAILS || '')
                    .split(',')
                    .map(e => e.trim())
                    .filter(Boolean)

                if (allowed.length === 0) {
                    console.warn('[LidLens] ALLOWED_EMAILS not set — Google sign-in blocked. Add your email to ALLOWED_EMAILS in .env.')
                    return false  // fail-secure
                }

                return allowed.includes(profile?.email ?? '')
            }
            return true
        },

        async jwt({ token, user, account }) {
            if (user) {
                token.provider = account?.provider ?? 'password'
            }
            return token
        },

        async session({ session, token }) {
            if (session.user) {
                (session.user as any).provider = token.provider
            }
            return session
        },
    },

    secret: process.env.NEXTAUTH_SECRET,
})
