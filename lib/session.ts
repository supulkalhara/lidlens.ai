/**
 * session.ts — re-exports NextAuth session helpers.
 * The iron-session implementation has been replaced by NextAuth v5.
 *
 * Use:
 *   import { auth } from '@/auth'
 *   const session = await auth()         // server components / route handlers
 *   import { useSession } from 'next-auth/react'  // client components
 */
export { auth } from '@/auth'
