/**
 * auth.ts — NextAuth v5 (Auth.js) — full runtime (Node) config
 *
 * Two sign-in methods:
 *   1. Google OAuth — currently disabled below
 *   2. Password (Credentials) — uses AUTH_PASSWORD from .env
 *
 * Session is a signed JWT cookie (no database required).
 * Secret = NEXTAUTH_SECRET env var.
 *
 * NOTE: bcryptjs is Node-only, so it must NOT be imported from anything
 * that runs on the edge (like middleware.ts). Middleware imports
 * auth.config.ts instead, which contains no Node-only deps.
 */
import NextAuth from 'next-auth'
// import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import authConfig from './auth.config'

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        // ─── Google OAuth (Disabled for now) ──────────────────────────
        /*
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        */

        // ─── Password (Credentials) ───────────────────────────────────
        Credentials({
            id: 'password',
            name: 'Password',
            credentials: {
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                const expected = process.env.AUTH_PASSWORD
                // In next-auth v5 beta.31+, throwing here surfaces as a 500
                // instead of a clean "CredentialsSignin" redirect. Return null
                // on any failure — NextAuth will redirect to the signIn page
                // with ?error=CredentialsSignin, which the UI handles.
                if (!expected) {
                    console.error('[LidLens] AUTH_PASSWORD is not configured')
                    return null
                }

                const submitted = (credentials?.password as string | undefined) ?? ''
                if (!submitted) return null

                // Support both plain-text and bcrypt hashes.
                // If AUTH_PASSWORD starts with '$2', treat it as a bcrypt hash.
                // Generate a hash: node -e "require('bcryptjs').hash('yourpassword',12).then(console.log)"
                const isHashed = expected.startsWith('$2')
                const valid = isHashed
                    ? await bcrypt.compare(submitted, expected)
                    : submitted === expected

                if (!valid) return null
                return {
                    id: 'local',
                    name: 'LidLens User',
                    email: 'local@lidlens.local',
                }
            },
        }),
    ],
})
