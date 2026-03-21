'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
    FileUp, Loader2, CheckCircle2, AlertCircle,
    ArrowLeft, Download, Plus, LayoutDashboard,
    Receipt, Landmark, FileText, Sparkles, PieChart, BarChart
} from 'lucide-react'
import {
    BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie
} from 'recharts'

/**
 * LidLens BYOD (Bring Your Own Data)
 * Extract and Dash any financial document at runtime.
 */
export default function ExtractPage() {
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0])
            handleUpload(e.dataTransfer.files[0])
        }
    }

    const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            handleUpload(e.target.files[0])
        }
    }

    const handleUpload = async (uFile: File) => {
        setLoading(true)
        setError(null)
        setResult(null)

        const formData = new FormData()
        formData.append('file', uFile)

        try {
            const res = await fetch('/api/extract', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (data.error) {
                setError(data.error)
            } else {
                setResult(data)
            }
        } catch (err) {
            setError("Failed to process document. Network error.")
        } finally {
            setLoading(false)
        }
    }

    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4']

    return (
        <div className="min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-10 lg:py-16">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <Link href="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-4 group text-sm font-medium">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Main Dashboard
                        </Link>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                                <Sparkles className="w-6 h-6 text-indigo-400" />
                            </div>
                            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-none">
                                Bring Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Own Data</span>
                            </h1>
                        </div>
                        <p className="text-slate-400 max-w-2xl text-lg">
                            Upload any receipt, invoice, or financial statement. LidLens AI will analyze, structure, and dashboard it for you instantly.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setResult(null)} className="px-5 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-white/5 transition-all text-sm font-semibold flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Reset
                        </button>
                    </div>
                </div>

                {/* Upload Zone */}
                {!result && !loading && (
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`
              relative group cursor-pointer border-2 border-dashed rounded-3xl p-20 lg:p-32 transition-all flex flex-col items-center justify-center text-center
              ${dragActive ? 'border-indigo-500 bg-indigo-500/5 ring-4 ring-indigo-500/10' : 'border-slate-800 hover:border-indigo-500/50 hover:bg-white/[0.02]'}
            `}
                        onClick={() => inputRef.current?.click()}
                    >
                        <input ref={inputRef} type="file" className="hidden" onChange={handleManualUpload} accept=".pdf,image/*" />

                        <div className="w-20 h-20 mb-8 rounded-full bg-slate-900 flex items-center justify-center border border-white/5 relative">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-[20px] rounded-full group-hover:bg-indigo-500/30 transition-all" />
                            <FileUp className="w-10 h-10 text-indigo-400 relative z-10" />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-3">Drop file here or click to browse</h2>
                        <p className="text-slate-500 text-base max-w-sm mx-auto leading-relaxed">
                            Supports searchable PDFs, receipts, or bank statements. Max 10MB.
                        </p>

                        <div className="mt-10 flex gap-6 text-slate-600">
                            <div className="flex items-center gap-1.5"><FileText className="w-4 h-4 opacity-50" /> PDF</div>
                            <div className="flex items-center gap-1.5"><Receipt className="w-4 h-4 opacity-50" /> JPEG</div>
                            <div className="flex items-center gap-1.5"><Landmark className="w-4 h-4 opacity-50" /> PNG</div>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-32 rounded-3xl bg-slate-900/40 border border-white/5 animate-in fade-in zoom-in duration-300">
                        <div className="relative mb-8">
                            <div className="absolute inset-[-20px] bg-indigo-500/20 blur-[40px] rounded-full animate-pulse" />
                            <Loader2 className="w-16 h-16 text-indigo-500 animate-spin relative z-10" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2 italic">LidLens AI is thinking...</h3>
                        <p className="text-slate-400">Extracting data and generating your dashboard.</p>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="p-10 rounded-3xl bg-red-500/5 border border-red-500/20 flex items-center flex-col text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                        <h3 className="text-xl font-bold text-red-100 mb-2">Analysis Failed</h3>
                        <p className="text-red-400/80 mb-6">{error}</p>
                        <button onClick={() => setResult(null)} className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-red-500/20">Try Again</button>
                    </div>
                )}

                {/* RESULT: AI GENERATED DASHBOARD */}
                {result && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                            {/* Sidebar Info */}
                            <div className="lg:col-span-4 space-y-6">
                                <div className="p-8 rounded-3xl bg-slate-900/60 border border-white/5 backdrop-blur-md relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] -mr-16 -mt-16 rounded-full group-hover:bg-indigo-500/10 transition-all duration-500" />

                                    <div className="flex items-center justify-between mb-8 relative z-10">
                                        <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-widest border border-indigo-500/30">
                                            {result.doc_type || 'Unknown Doc'}
                                        </span>
                                        {result.merchant && <Landmark className="w-5 h-5 text-slate-500" />}
                                    </div>

                                    <h2 className="text-3xl font-extrabold text-white mb-2 leading-tight">
                                        {result.merchant || 'Extracted File'}
                                    </h2>
                                    <p className="text-slate-400 mb-8 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        Found: {result.date || 'Multiple periods'}
                                    </p>

                                    <div className="space-y-6">
                                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
                                            <p className="text-slate-500 text-[11px] uppercase font-bold tracking-wider mb-1">Total Amount</p>
                                            <p className="text-4xl font-black text-white">{result.currency || ''} {result.summary?.total_amount?.toLocaleString() || '0'}</p>
                                        </div>
                                        {result.summary?.due_date && (
                                            <div className="p-5 rounded-2xl bg-orange-500/5 border border-orange-500/10">
                                                <p className="text-orange-500/70 text-[11px] uppercase font-bold tracking-wider mb-1">Payment Due</p>
                                                <p className="text-2xl font-bold text-orange-200">{result.summary.due_date}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-8 rounded-3xl bg-slate-900/60 border border-white/5 backdrop-blur-md">
                                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-indigo-400" /> AI Insights
                                    </h3>
                                    <div className="space-y-4">
                                        {result.insights?.map((insight: string, idx: number) => (
                                            <div key={idx} className="flex gap-4 group">
                                                <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 group-hover:scale-150 transition-all duration-300" />
                                                <p className="text-slate-400 text-sm leading-relaxed font-medium">{insight}</p>
                                            </div>
                                        ))}
                                        {!result.insights?.length && <p className="text-slate-500 italic text-sm">No specific insights detected.</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div className="lg:col-span-8 space-y-6">

                                {/* AI DECISION: Primary Visualization */}
                                <div className="p-8 rounded-3xl bg-slate-900/60 border border-white/5 backdrop-blur-md h-[450px] flex flex-col relative">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <LayoutDashboard className="w-5 h-5 text-indigo-400" />
                                            Generated Summary Visualization
                                        </h3>
                                    </div>

                                    <div className="flex-1 w-full flex items-center justify-center">
                                        {result.line_items?.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                {result.dashboard_config?.primary_widget === 'Pie' ? (
                                                    <RePieChart>
                                                        <Pie
                                                            data={result.line_items.slice(0, 10).map((i: any) => ({ name: i.description || i.category, value: Math.abs(i.amount) }))}
                                                            innerRadius={80}
                                                            outerRadius={140}
                                                            paddingAngle={5}
                                                            dataKey="value"
                                                        >
                                                            {result.line_items.map((_: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            contentStyle={{ background: '#1e293b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                                            itemStyle={{ color: '#94a3b8' }}
                                                        />
                                                    </RePieChart>
                                                ) : (
                                                    <ReBarChart data={result.line_items.slice(0, 8).map((i: any) => ({ name: (i.description || i.category || 'Item').substring(0, 15), val: Math.abs(i.amount) }))}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                                        <YAxis hide />
                                                        <Tooltip
                                                            contentStyle={{ background: '#1e293b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                                            cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                                        />
                                                        <Bar dataKey="val" radius={[6, 6, 0, 0]} barSize={40}>
                                                            {result.line_items.map((_: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Bar>
                                                    </ReBarChart>
                                                )}
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="text-slate-500 text-center flex flex-col items-center">
                                                <PieChart className="w-12 h-12 mb-4 opacity-20" />
                                                <p>Not enough detail for visualization</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute bottom-6 right-8 flex gap-2">
                                        <span className="px-2 py-1 rounded-md bg-white/[0.03] text-[9px] text-slate-500 border border-white/5 uppercase tracking-widest font-bold">
                                            AI Selected: {result.dashboard_config?.primary_widget || 'Auto'}
                                        </span>
                                    </div>
                                </div>

                                {/* Line Items Table */}
                                <div className="rounded-3xl bg-slate-900/60 border border-white/5 backdrop-blur-md overflow-hidden">
                                    <div className="p-8 pb-4 border-b border-white/5 flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-white">Extracted Details</h3>
                                        <button className="p-2 text-slate-500 hover:text-white transition-colors" title="Download CSV">
                                            <Download className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead>
                                                <tr className="text-slate-500 font-bold border-b border-white/5">
                                                    <th className="px-8 py-4">Description</th>
                                                    <th className="px-8 py-4">Category</th>
                                                    <th className="px-8 py-4 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/[0.02]">
                                                {result.line_items?.map((item: any, idx: number) => (
                                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                                        <td className="px-8 py-4 font-medium text-slate-100">{item.description || 'Raw Item'}</td>
                                                        <td className="px-8 py-4">
                                                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-[10px] uppercase tracking-wide font-bold">
                                                                {item.category || 'General'}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-4 text-right font-bold text-indigo-400">
                                                            {result.currency || ''} {item.amount?.toLocaleString() || '0.00'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {!result.line_items?.length && (
                                        <div className="py-20 text-center text-slate-600 font-medium">
                                            No line items found. AI likely captured only high-level summary.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes zoom-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-in { animation: fade-in 0.5s ease-out; }
        .fade-in { animation: fade-in 0.5s ease-out; }
        .slide-in-from-bottom-8 { animation: slide-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .zoom-in { animation: zoom-in 0.4s ease-out both; }
      `}</style>
        </div>
    )
}
