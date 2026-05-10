'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    User, CreditCard, Building2, Landmark, Calendar,
    Plus, Trash2, Save, ArrowLeft, CheckCircle2, AlertCircle,
    ShieldCheck, Loader2, Sparkles, Pencil, X, GripVertical, Activity
} from 'lucide-react'

type Asset = {
    id?: number
    type: 'bank' | 'card' | 'loan'
    name: string
    details: any
}

const PASSWORD_COMPONENTS = [
    { id: 'day_dd', label: 'Day (DD)', example: '15' },
    { id: 'month_mm', label: 'Month (MM)', example: '05' },
    { id: 'year_yyyy', label: 'Year (YYYY)', example: '1990' },
    { id: 'year_yy', label: 'Year (YY)', example: '90' },
    { id: 'card_last_4', label: 'Card Last 4', example: '1234' },
    { id: 'card_last_6', label: 'Card Last 6', example: '123456' },
    { id: 'card_last_8', label: 'Card Last 8', example: '12345678' },
]

export default function ProfilePage() {
    const [profile, setProfile] = useState<{ full_name: string, birthday: string }>({ full_name: '', birthday: '' })
    const [assets, setAssets] = useState<Asset[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileRes, assetsRes] = await Promise.all([
                    fetch('/api/profile').then(res => res.json()),
                    fetch('/api/assets').then(res => res.json())
                ])
                if (profileRes && !profileRes.error) {
                    setProfile({ full_name: profileRes.full_name || '', birthday: profileRes.birthday || '' })
                }
                if (Array.isArray(assetsRes)) {
                    setAssets(assetsRes)
                } else {
                    setAssets([])
                }
            } catch (err) {
                console.error('Failed to fetch profile data', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const saveProfile = async () => {
        setSaving(true)
        try {
            await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            })
            setStatus({ type: 'success', msg: 'Profile updated successfully' })
        } catch (err) {
            setStatus({ type: 'error', msg: 'Failed to update profile' })
        } finally {
            setSaving(false)
            setTimeout(() => setStatus(null), 3000)
        }
    }

    const addAsset = (type: 'bank' | 'card' | 'loan') => {
        const newAsset: Asset = {
            type,
            name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            details: type === 'card' ? { digits: '', passwordComponents: ['day_dd', 'month_mm', 'year_yyyy'] } : {}
        }
        setAssets([...assets, newAsset])
    }

    const updateAsset = async (asset: Asset, index: number) => {
        try {
            const res = await fetch('/api/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(asset)
            })
            const data = await res.json()
            // Refresh to get ID
            const assetsRes = await fetch('/api/assets').then(res => res.json())
            setAssets(assetsRes)
            setStatus({ type: 'success', msg: 'Asset saved' })
        } catch (err) {
            setStatus({ type: 'error', msg: 'Failed to save asset' })
        } finally {
            setTimeout(() => setStatus(null), 2000)
        }
    }

    const deleteAsset = async (id: number | undefined, index: number) => {
        if (!id) {
            setAssets(assets.filter((_, i) => i !== index))
            return
        }
        try {
            await fetch('/api/assets', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            })
            setAssets(assets.filter((_, i) => i !== index))
        } catch (err) {
            alert('Failed to delete')
        }
    }

    const toggleComponent = (assetIndex: number, componentId: string) => {
        const newAssets = [...assets]
        const current = newAssets[assetIndex].details.passwordComponents || []
        newAssets[assetIndex].details.passwordComponents = [...current, componentId]
        setAssets(newAssets)
    }

    const removeComponent = (assetIndex: number, componentIndex: number) => {
        const newAssets = [...assets]
        const current = newAssets[assetIndex].details.passwordComponents || []
        newAssets[assetIndex].details.passwordComponents = current.filter((_: any, i: number) => i !== componentIndex)
        setAssets(newAssets)
    }

    if (loading) return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
    )

    return (
        <div className="min-h-screen bg-[#030712] text-slate-100 selection:bg-blue-500/30 font-sans p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto py-10">

                {/* Header */}
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-700">
                            <ArrowLeft className="w-5 h-5 text-slate-400" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                                <User className="w-7 h-7 text-blue-500" /> Account <span className="text-blue-500">Profile</span>
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">Manage your identity and financial entities for auto-automation.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {status && (
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300 ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {status.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                {status.msg}
                            </div>
                        )}
                        <Link
                            href="/pipeline"
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all border border-slate-700"
                        >
                            <Activity className="w-4 h-4 text-emerald-400" />
                            View Pipelines
                        </Link>
                        <button
                            onClick={saveProfile}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

                    {/* Left Column: Personal Info & Identity */}
                    <div className="md:col-span-12 lg:col-span-5 space-y-6">
                        <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/5 backdrop-blur-xl relative overflow-hidden group hover:bg-slate-900/60 transition-all">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] -mr-16 -mt-16 rounded-full group-hover:bg-blue-500/10 transition-all duration-700" />

                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-blue-400" /> Personal Identity
                            </h3>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block px-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={profile.full_name}
                                        onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                                        placeholder="e.g. Supul S."
                                        className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all text-white placeholder:text-slate-700 font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block px-1 flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5" /> Birthday <span className="text-[9px] text-blue-500/70 border border-blue-500/20 px-1.5 rounded ml-auto">Used for PDF Passwords</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={profile.birthday}
                                        onChange={e => setProfile({ ...profile, birthday: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all text-white font-medium color-scheme-dark"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 backdrop-blur-xl">
                            <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2 mb-3">
                                <Sparkles className="w-4 h-4" /> AI Strategy
                            </h3>
                            <p className="text-xs text-indigo-200/60 leading-relaxed">
                                Your data is stored locally. By providing your identity, LidLens builds dynamic password combos like <code>DDMMYYYY</code> or <code>Last4 + DDMM</code> for each card automatically.
                            </p>
                        </div>
                    </div>

                    {/* Right Column: Assets (Banks, Cards, Loans) */}
                    <div className="md:col-span-12 lg:col-span-7 space-y-6">

                        {/* Banks & Accounts */}
                        <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/5">
                            <div className="flex items-center justify-between mb-6 px-1">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Landmark className="w-5 h-5 text-emerald-400" /> Managed Assets
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={() => addAsset('bank')} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5">
                                        <Plus className="w-3.5 h-3.5" /> Bank
                                    </button>
                                    <button onClick={() => addAsset('card')} className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-1.5">
                                        <Plus className="w-3.5 h-3.5" /> Card
                                    </button>
                                    <button onClick={() => addAsset('loan')} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-1.5">
                                        <Plus className="w-3.5 h-3.5" /> Loan
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {assets.map((asset, index) => (
                                    <div key={index} className="group p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all flex flex-col gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl border ${asset.type === 'card' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                                asset.type === 'bank' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                                    'bg-red-500/10 border-red-500/20 text-red-400'
                                                }`}>
                                                {asset.type === 'card' ? <CreditCard className="w-4 h-4" /> :
                                                    asset.type === 'bank' ? <Building2 className="w-4 h-4" /> :
                                                        <Landmark className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={asset.name}
                                                    onChange={e => {
                                                        const newAssets = [...assets]
                                                        newAssets[index].name = e.target.value
                                                        setAssets(newAssets)
                                                    }}
                                                    className="bg-transparent border-none focus:ring-0 p-0 text-white font-bold text-base w-full focus:text-blue-400 transition-colors"
                                                />
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{asset.type}</p>
                                            </div>
                                            <div className="flex gap-2 opacity-10 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => updateAsset(asset, index)} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700" title="Save">
                                                    <Save className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => deleteAsset(asset.id, index)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            {asset.type === 'card' && (
                                                <>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Card Digits (up to 8)</label>
                                                            <input
                                                                type="text"
                                                                maxLength={8}
                                                                value={asset.details.digits || ''}
                                                                onChange={e => {
                                                                    const newAssets = [...assets]
                                                                    newAssets[index].details.digits = e.target.value
                                                                    setAssets(newAssets)
                                                                }}
                                                                placeholder="12345678"
                                                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white font-mono"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Statement Sender Email</label>
                                                            <input
                                                                type="email"
                                                                value={asset.details.statement_email || ''}
                                                                onChange={e => {
                                                                    const newAssets = [...assets]
                                                                    newAssets[index].details.statement_email = e.target.value
                                                                    setAssets(newAssets)
                                                                }}
                                                                placeholder="statements@bank.com"
                                                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Quick Rule</label>
                                                            <select
                                                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    const newAssets = [...assets];
                                                                    if (val === 'ddmmyyyy') newAssets[index].details.passwordComponents = ['day_dd', 'month_mm', 'year_yyyy'];
                                                                    if (val === 'yymmdd') newAssets[index].details.passwordComponents = ['year_yy', 'month_mm', 'day_dd'];
                                                                    if (val === 'last4dob') newAssets[index].details.passwordComponents = ['card_last_4', 'day_dd', 'month_mm'];
                                                                    setAssets(newAssets);
                                                                }}
                                                            >
                                                                <option value="">Apply Preset...</option>
                                                                <option value="ddmmyyyy">Birthday (DDMMYYYY)</option>
                                                                <option value="yymmdd">Compact (YYMMDD)</option>
                                                                <option value="last4dob">Bank Standard (Last4+DDMM)</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Password Builder (Ordered Components)</label>
                                                        <div className="flex flex-wrap gap-2 p-3 bg-slate-950/50 rounded-2xl border border-white/5 min-h-[50px]">
                                                            {(asset.details.passwordComponents || []).map((compId: string, cIdx: number) => {
                                                                const comp = PASSWORD_COMPONENTS.find(c => c.id === compId);
                                                                return (
                                                                    <div key={cIdx} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 font-medium">
                                                                        <GripVertical className="w-3 h-3 text-blue-500/40" />
                                                                        {comp?.label}
                                                                        <button onClick={() => removeComponent(index, cIdx)} className="ml-1 hover:text-red-400"><X className="w-3 h-3" /></button>
                                                                    </div>
                                                                )
                                                            })}
                                                            {(!asset.details.passwordComponents || asset.details.passwordComponents.length === 0) && (
                                                                <span className="text-[10px] text-slate-700 italic flex items-center">Pick components below to build password...</span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {PASSWORD_COMPONENTS.map(comp => (
                                                                <button
                                                                    key={comp.id}
                                                                    onClick={() => toggleComponent(index, comp.id)}
                                                                    className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-[10px] text-slate-400 hover:text-white transition-all"
                                                                >
                                                                    + {comp.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {asset.type === 'bank' && (
                                                <>
                                                <div className="col-span-2 space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Account Number / IBAN</label>
                                                    <input
                                                        type="text"
                                                        value={asset.details.account_no || ''}
                                                        onChange={e => {
                                                            const newAssets = [...assets]
                                                            newAssets[index].details.account_no = e.target.value
                                                            setAssets(newAssets)
                                                        }}
                                                        placeholder="Account digits..."
                                                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
                                                    />
                                                </div>
                                                <div className="col-span-2 space-y-1 mt-4">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Statement Sender Email</label>
                                                    <input
                                                        type="email"
                                                        value={asset.details.statement_email || ''}
                                                        onChange={e => {
                                                            const newAssets = [...assets]
                                                            newAssets[index].details.statement_email = e.target.value
                                                            setAssets(newAssets)
                                                        }}
                                                        placeholder="statements@bank.com"
                                                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
                                                    />
                                                </div>
                                                </>
                                            )}

                                            {asset.type === 'loan' && (
                                                <div className="grid grid-cols-2 gap-4 col-span-2">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Loan ID / Reference</label>
                                                        <input
                                                            type="text"
                                                            value={asset.details.loan_id || ''}
                                                            onChange={e => {
                                                                const newAssets = [...assets]
                                                                newAssets[index].details.loan_id = e.target.value
                                                                setAssets(newAssets)
                                                            }}
                                                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Principal Amount</label>
                                                        <input
                                                            type="number"
                                                            value={asset.details.principal || ''}
                                                            onChange={e => {
                                                                const newAssets = [...assets]
                                                                newAssets[index].details.principal = e.target.value
                                                                setAssets(newAssets)
                                                            }}
                                                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Outstanding Balance</label>
                                                        <input
                                                            type="number"
                                                            value={asset.details.outstanding_balance || ''}
                                                            onChange={e => {
                                                                const newAssets = [...assets]
                                                                newAssets[index].details.outstanding_balance = e.target.value
                                                                setAssets(newAssets)
                                                            }}
                                                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Monthly Payment</label>
                                                        <input
                                                            type="number"
                                                            value={asset.details.monthly_payment || ''}
                                                            onChange={e => {
                                                                const newAssets = [...assets]
                                                                newAssets[index].details.monthly_payment = e.target.value
                                                                setAssets(newAssets)
                                                            }}
                                                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Interest Rate (%)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={asset.details.interest_rate || ''}
                                                            onChange={e => {
                                                                const newAssets = [...assets]
                                                                newAssets[index].details.interest_rate = e.target.value
                                                                setAssets(newAssets)
                                                            }}
                                                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {assets.length === 0 && (
                                    <div className="py-20 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/5">
                                        <Building2 className="w-10 h-10 text-slate-700 mx-auto mb-4 opacity-30" />
                                        <p className="text-slate-500 text-sm italic font-medium">No assets managed yet. Click + Add to start.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <style jsx global>{`
        input[type=\"date\"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.5;
          cursor: pointer;
        }
        .color-scheme-dark {
          color-scheme: dark;
        }
      `}</style>
        </div>
    )
}
