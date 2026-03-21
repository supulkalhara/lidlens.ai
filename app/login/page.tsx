'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

// Inner component uses useSearchParams — must be inside <Suspense>
function LoginForm() {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const from = searchParams.get('from') || '/'

    useEffect(() => { inputRef.current?.focus() }, [])

    async function handlePasswordSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!password) return
        setLoading(true)
        setError('')

        const res = await signIn('password', { password, redirect: false })

        setLoading(false)
        if (res?.ok) {
            router.push(from)
            router.refresh()
        } else {
            setError('Incorrect access key. Please try again.')
            setPassword('')
            inputRef.current?.focus()
        }
    }

    async function handleGoogleSignIn() {
        setGoogleLoading(true)
        await signIn('google', { callbackUrl: from })
    }

    return (
        <div style={styles.container}>
            {/* Brand */}
            <div style={styles.brand}>
                <div style={styles.logoWrap}>
                    <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                        <rect width="38" height="38" rx="11" fill="url(#lg)" />
                        <path d="M10 28L15 19L19 23L24 14L28 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <defs>
                            <linearGradient id="lg" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#6366f1" /><stop offset="1" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <span style={styles.brandName}>LidLens</span>
            </div>

            {/* Card */}
            <div style={styles.card}>
                <div style={styles.cardTopGlow} />
                <div style={styles.cardInner}>
                    <h2 style={styles.title}>Welcome back</h2>
                    <p style={styles.subtitle}>Sign in to your personal finance dashboard</p>

                    {/* Google button */}
                    <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading || loading} style={{ ...styles.googleBtn, ...(googleLoading ? styles.btnDisabled : {}) }}>
                        {googleLoading ? <span style={styles.spinner} /> : <GoogleLogo />}
                        <span>Continue with Google</span>
                    </button>

                    {/* Divider */}
                    <div style={styles.divider}>
                        <div style={styles.dividerLine} />
                        <span style={styles.dividerText}>or access key</span>
                        <div style={styles.dividerLine} />
                    </div>

                    {/* Password form */}
                    <form onSubmit={handlePasswordSubmit} style={styles.form}>
                        <div style={styles.inputWrap}>
                            <span style={styles.inputIcon}><LockIcon /></span>
                            <input
                                ref={inputRef}
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter access key"
                                style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
                                autoComplete="current-password"
                                disabled={loading || googleLoading}
                            />
                            <button type="button" onClick={() => setShowPassword(v => !v)} style={styles.eyeBtn} tabIndex={-1}>
                                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                        </div>

                        {error && (
                            <div style={styles.errorRow}>
                                <span style={styles.errorDot} />
                                <p style={styles.errorText}>{error}</p>
                            </div>
                        )}

                        <button type="submit" disabled={loading || googleLoading || !password} style={{ ...styles.submitBtn, ...(loading || !password ? styles.btnDisabled : {}) }}>
                            {loading ? <span style={styles.spinner} /> : <><span>Access Dashboard</span><ArrowIcon /></>}
                        </button>
                    </form>

                    <p style={styles.hint}>
                        Set <code style={styles.code}>ALLOWED_EMAILS</code> in <code style={styles.code}>.env</code> to enable Google sign-in
                    </p>
                </div>
            </div>

            <p style={styles.footer}>LidLens · Privacy-first personal finance</p>
        </div>
    )
}

// Page component — wraps LoginForm in Suspense (required for useSearchParams in Next.js 14)
export default function LoginPage() {
    return (
        <div style={styles.page}>
            <div style={styles.orb1} /><div style={styles.orb2} /><div style={styles.orb3} />
            <div style={styles.grid} />
            <Suspense fallback={<div style={{ color: '#94a3b8', fontFamily: 'Inter,sans-serif' }}>Loading…</div>}>
                <LoginForm />
            </Suspense>
            <style>{globalStyles}</style>
        </div>
    )
}

// ─── Icons ───────────────────────────────────────────────────────
function GoogleLogo() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" />
            <path fill="#34A853" d="M9 18a8.6 8.6 0 0 0 5.96-2.18l-2.92-2.26a5.43 5.43 0 0 1-8.08-2.85H.96v2.34A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3-2.34z" />
            <path fill="#EA4335" d="M9 3.58a4.86 4.86 0 0 1 3.44 1.35l2.58-2.58A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .96 4.95l3 2.34A5.36 5.36 0 0 1 9 3.58z" />
        </svg>
    )
}
function LockIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
}
function EyeIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
}
function EyeOffIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
}
function ArrowIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
}

// ─── Styles ──────────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-60px) scale(1.1)} }
  @keyframes floatB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-50px,40px) scale(.9)} }
  @keyframes floatC { 0%,100%{transform:translate(0,0)} 60%{transform:translate(30px,50px) scale(1.05)} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
  *{box-sizing:border-box;margin:0;padding:0}
  input::placeholder{color:rgba(148,163,184,.4)}
  input:focus{outline:none}
`
const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712', fontFamily: "'Inter',-apple-system,sans-serif", position: 'relative', overflow: 'hidden' },
    orb1: { position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,.18) 0%,transparent 70%)', top: '-100px', left: '-100px', animation: 'floatA 14s ease-in-out infinite', pointerEvents: 'none' },
    orb2: { position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,.15) 0%,transparent 70%)', bottom: '-80px', right: '-80px', animation: 'floatB 18s ease-in-out infinite', pointerEvents: 'none' },
    orb3: { position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(6,182,212,.10) 0%,transparent 70%)', bottom: '30%', left: '10%', animation: 'floatC 22s ease-in-out infinite', pointerEvents: 'none' },
    grid: { position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(99,102,241,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.03) 1px,transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' },
    container: { width: '100%', maxWidth: 400, padding: '0 20px', position: 'relative', zIndex: 1, animation: 'fadeUp .45s ease both' },
    brand: { display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 28 },
    logoWrap: { borderRadius: 13, boxShadow: '0 0 28px rgba(99,102,241,.45)' },
    brandName: { fontSize: 24, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.5px' },
    card: { position: 'relative', borderRadius: 20, background: 'rgba(15,23,42,0.82)', border: '1px solid rgba(99,102,241,0.18)', backdropFilter: 'blur(24px)', boxShadow: '0 0 0 1px rgba(99,102,241,.08),0 24px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05)', overflow: 'hidden' },
    cardTopGlow: { position: 'absolute', top: -1, left: '15%', right: '15%', height: 2, background: 'linear-gradient(90deg,transparent,rgba(99,102,241,.7),transparent)' },
    cardInner: { padding: '36px 32px 28px' },
    title: { fontSize: 21, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px', marginBottom: 6 },
    subtitle: { fontSize: 13.5, color: 'rgba(148,163,184,.7)', marginBottom: 24 },
    googleBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '11px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#e2e8f0', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all .2s ease', letterSpacing: '-0.01em', fontFamily: "'Inter',-apple-system,sans-serif" },
    divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' },
    dividerLine: { flex: 1, height: 1, background: 'rgba(51,65,85,.8)' },
    dividerText: { fontSize: 12, color: 'rgba(100,116,139,.8)', whiteSpace: 'nowrap', letterSpacing: '0.03em' },
    form: { display: 'flex', flexDirection: 'column', gap: 12 },
    inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
    inputIcon: { position: 'absolute', left: 13, color: 'rgba(99,102,241,.7)', display: 'flex', alignItems: 'center', pointerEvents: 'none' },
    input: { width: '100%', padding: '11px 42px 11px 40px', background: 'rgba(30,41,59,.85)', border: '1px solid rgba(51,65,85,.8)', borderRadius: 12, color: '#f1f5f9', fontSize: 14, fontFamily: "'Inter'", transition: 'all .2s ease', letterSpacing: '0.04em' },
    inputError: { border: '1px solid rgba(239,68,68,.55)', background: 'rgba(239,68,68,.05)' },
    eyeBtn: { position: 'absolute', right: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,.5)', display: 'flex', padding: 2 },
    errorRow: { display: 'flex', alignItems: 'center', gap: 6 },
    errorDot: { width: 5, height: 5, borderRadius: '50%', background: '#ef4444', flexShrink: 0 },
    errorText: { fontSize: 12.5, color: '#f87171' },
    submitBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 16px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all .2s ease', boxShadow: '0 4px 18px rgba(99,102,241,.35)', letterSpacing: '-0.01em', fontFamily: "'Inter',-apple-system,sans-serif" },
    btnDisabled: { opacity: .55, cursor: 'not-allowed' },
    spinner: { width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' },
    hint: { marginTop: 18, fontSize: 11.5, color: 'rgba(100,116,139,.7)', textAlign: 'center', lineHeight: 1.7 },
    code: { fontFamily: 'monospace', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 4, padding: '1px 4px', color: '#a5b4fc', fontSize: 10.5 },
    footer: { marginTop: 20, textAlign: 'center', fontSize: 11.5, color: 'rgba(71,85,105,.7)' },
}
