'use client'

import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export default function PrefectDashboard() {
  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/pipeline" className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">Prefect Orchestration UI</h1>
              <p className="text-xs text-slate-400">View live pipeline runs and logs</p>
            </div>
          </div>
          <a
            href="http://localhost:4200"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-blue-600/20"
          >
            Open in Full Tab
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
      <div className="flex-1 bg-white">
        <iframe 
          src="http://127.0.0.1:4200" 
          className="w-full h-full border-0" 
          title="Prefect UI"
        />
      </div>
    </div>
  )
}
