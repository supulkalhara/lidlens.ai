/**
 * auth.config.ts — edge-safe NextAuth v5 config (no Node-only deps)
 *
 * This file is imported by middleware.ts (which runs on the edge runtime),
 * so it must NOT import bcryptjs or anything else that requires Node.
 *
 * Providers that need Node-only deps (e.g. Credentials + bcrypt) live in auth.ts.
 */
import type { NextAuthConfig } from 'next-auth'

export default {
    trustHost: true,

    // Providers are defined in auth.ts; keep this empty so middleware stays edge-safe.
    providers: [],

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
                    console.warn('[LidLens] ALLOWED_EMAILS not set — Google sign-in blocked.')
                    return false
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

    session: { strategy: 'jwt' },
    secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig
