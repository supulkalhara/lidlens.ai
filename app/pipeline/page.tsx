'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, AlertCircle, Clock,
  Play, RefreshCw, ChevronDown, ChevronRight, Loader2,
  Database, Layers, Zap, Eye, GitMerge
} from 'lucide-react'

type PdfFile = {
  pdf: string
  stem: string
  bank: string
  yearMonth: string | null
  label: string
  cardType: string
  hasJson: boolean
  hasCsv: boolean
  status: 'processed' | 'partial' | 'unprocessed'
}

type PipelineStatus = {
  files: PdfFile[]
  totals: { total: number; processed: number; partial: number; unprocessed: number }
}

type RunState = 'idle' | 'running' | 'done' | 'error'

const STATUS_META = {
  processed: { label: 'Processed', color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800', dot: 'bg-emerald-500' },
  partial:   { label: 'Partial',   color: 'text-amber-700  bg-amber-50  border-amber-200  dark:bg-amber-900/20  dark:text-amber-400  dark:border-amber-800',  dot: 'bg-amber-500'  },
  unprocessed:{ label: 'Pending',  color: 'text-slate-600  bg-slate-100 border-slate-200  dark:bg-slate-800     dark:text-slate-400  dark:border-slate-700',  dot: 'bg-slate-400'  },
}

export default function PipelinePage() {
  const [data, setData] = useState<PipelineStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [runStates, setRunStates] = useState<Record<string, RunState>>({})
  const [runLogs, setRunLogs] = useState<Record<string, string>>({})
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set(['HSBC', 'ComBank', 'HNB']))
  const [runningAll, setRunningAll] = useState(false)
  const [rebuildingMaster, setRebuildingMaster] = useState(false)
  const [rebuildLog, setRebuildLog] = useState<string[]>([])
  const [viewingPdf, setViewingPdf] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pipeline/status')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/pipeline/sync', { method: 'POST' })
      const result = await res.json()
      if (!result.success) {
        alert('Sync failed: ' + result.error)
      }
      await fetchStatus()
    } catch (e: any) {
      alert('Sync error: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  const runOne = async (pdf: string) => {
    setRunStates(s => ({ ...s, [pdf]: 'running' }))
    setRunLogs(l => ({ ...l, [pdf]: '' }))
    try {
      const res = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf }),
      })
      const result = await res.json()
      if (result.ok) {
        setRunStates(s => ({ ...s, [pdf]: 'done' }))
        setRunLogs(l => ({ ...l, [pdf]: `✓ ${result.rows} transactions extracted` }))
        fetchStatus()
      } else {
        setRunStates(s => ({ ...s, [pdf]: 'error' }))
        setRunLogs(l => ({ ...l, [pdf]: result.error || 'Unknown error' }))
      }
    } catch (e: any) {
      setRunStates(s => ({ ...s, [pdf]: 'error' }))
      setRunLogs(l => ({ ...l, [pdf]: e.message }))
    }
  }

  const rebuildMaster = async () => {
    setRebuildingMaster(true)
    setRebuildLog([])
    try {
      const res = await fetch('/api/pipeline/rebuild-master', { method: 'POST' })
      const result = await res.json()
      setRebuildLog(result.output || [result.error || 'Done'])
    } catch (e: any) {
      setRebuildLog([e.message])
    } finally {
      setRebuildingMaster(false)
    }
  }

  const runAll = async () => {
    if (!data) return
    const pending = data.files.filter(f => f.status !== 'processed')
    setRunningAll(true)
    for (const f of pending) {
      await runOne(f.pdf)
    }
    setRunningAll(false)
    // Auto-rebuild master CSV after all extractions complete
    await rebuildMaster()
  }

  const toggleBank = (bank: string) => {
    setExpandedBanks(prev => {
      const next = new Set(prev)
      next.has(bank) ? next.delete(bank) : next.add(bank)
      return next
    })
  }

  // Group files by bank
  const groups = data
    ? Array.from(new Set(data.files.map(f => f.bank))).map(bank => ({
        bank,
        files: data.files.filter(f => f.bank === bank),
      }))
    : []

  const unprocessedCount = data?.totals.unprocessed ?? 0
  const partialCount = data?.totals.partial ?? 0
  const pendingCount = unprocessedCount + partialCount

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* PDF Viewer overlay */}
      {viewingPdf && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setViewingPdf(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{viewingPdf.split('=')[1]}</span>
              <button onClick={() => setViewingPdf(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">✕</button>
            </div>
            <iframe src={viewingPdf} className="flex-1 w-full" title="PDF Viewer" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                Extraction Pipeline
              </h1>
              <p className="text-xs text-slate-400">PDF → JSON → CSV processing status</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={loading || syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(loading || syncing) ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Emails'}
            </button>
            <button
              onClick={rebuildMaster}
              disabled={rebuildingMaster}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-600"
              title="Rebuild master_transactions.csv from all CSVs"
            >
              {rebuildingMaster ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
              Rebuild Master CSV
            </button>
            {pendingCount > 0 && (
              <button
                onClick={runAll}
                disabled={runningAll || rebuildingMaster}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-blue-600/20"
              >
                {runningAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Run All Pending ({pendingCount})
              </button>
            )}
            <Link
              href="/pipeline/prefect"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/20 ml-2"
              title="Open Prefect Orchestration UI"
            >
              <Database className="w-3.5 h-3.5" />
              Prefect UI
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Stats row */}
        {data && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total PDFs',   value: data.totals.total,       icon: Database,     color: 'text-slate-300' },
              { label: 'Processed',    value: data.totals.processed,   icon: CheckCircle2, color: 'text-emerald-400' },
              { label: 'Partial',      value: data.totals.partial,     icon: AlertCircle,  color: 'text-amber-400' },
              { label: 'Unprocessed',  value: data.totals.unprocessed, icon: Clock,        color: 'text-slate-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-slate-400">{label}</span>
                </div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {data.totals.total > 0 ? Math.round((value / data.totals.total) * 100) : 0}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {data && data.totals.total > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300">Overall Progress</span>
              <span className="text-xs text-slate-400">
                {data.totals.processed}/{data.totals.total} fully processed
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
              <div
                className="h-2 bg-emerald-500 transition-all"
                style={{ width: `${(data.totals.processed / data.totals.total) * 100}%` }}
              />
              <div
                className="h-2 bg-amber-500 transition-all"
                style={{ width: `${(data.totals.partial / data.totals.total) * 100}%` }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Processed</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>Partial (JSON only)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600 inline-block"/>Pending</span>
            </div>
          </div>
        )}

        {/* Rebuild log */}
        {rebuildLog.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <GitMerge className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-300">Master CSV Rebuild Output</span>
            </div>
            <div className="font-mono text-[10px] text-emerald-400 space-y-0.5">
              {rebuildLog.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        )}

        {/* Bank groups */}
        {loading && !data && (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
          </div>
        )}

        {groups.map(({ bank, files }) => {
          const expanded = expandedBanks.has(bank)
          const bankProcessed = files.filter(f => f.status === 'processed').length
          const bankPending = files.filter(f => f.status !== 'processed').length

          return (
            <div key={bank} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Bank header */}
              <button
                onClick={() => toggleBank(bank)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="font-semibold text-white">{bank}</span>
                  <span className="text-xs text-slate-400">{files.length} statements</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400">{bankProcessed} done</span>
                  {bankPending > 0 && <span className="text-xs text-amber-400">{bankPending} pending</span>}
                </div>
              </button>

              {/* File rows */}
              {expanded && (
                <div className="divide-y divide-slate-800 border-t border-slate-800">
                  {files.map((file) => {
                    const meta = STATUS_META[file.status]
                    const runState = runStates[file.pdf] || 'idle'
                    const log = runLogs[file.pdf]

                    return (
                      <div key={file.pdf} className="flex items-center gap-3 px-4 py-2.5">
                        {/* Status dot */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot} ${runState === 'running' ? 'animate-pulse' : ''}`} />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">{file.label}</span>
                            {file.cardType && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{file.cardType}</span>
                            )}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${meta.color}`}>{meta.label}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">{file.pdf}</div>
                          {log && (
                            <div className={`text-[10px] mt-0.5 ${runState === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{log}</div>
                          )}
                        </div>

                        {/* Stage indicators */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${file.hasJson ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                            JSON
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${file.hasCsv ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                            CSV
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setViewingPdf(`/api/statements/pdf?file=${encodeURIComponent(file.pdf)}`)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                            title="View PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {file.status !== 'processed' && (
                            <button
                              onClick={() => runOne(file.pdf)}
                              disabled={runState === 'running' || runningAll}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-[10px] font-semibold transition-colors"
                              title="Extract transactions"
                            >
                              {runState === 'running'
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Play className="w-3 h-3" />}
                              {runState === 'running' ? 'Running…' : 'Run'}
                            </button>
                          )}
                          {file.status === 'processed' && (
                            <button
                              onClick={() => runOne(file.pdf)}
                              disabled={runState === 'running' || runningAll}
                              className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 rounded-lg text-[10px] transition-colors"
                              title="Re-extract (overwrite)"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Re-run
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Footer note */}
        <div className="text-xs text-slate-600 text-center pb-4">
          Extractions use Groq API (llama-3.3-70b-versatile). Each PDF takes ~30–90 s.
          After running, reload the dashboard to see new transactions.
        </div>
      </div>
    </div>
  )
}
