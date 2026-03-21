'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Wallet,
    CreditCard,
    PiggyBank,
    AlertTriangle,
    CheckCircle,
    DollarSign,
    BarChart3,
} from 'lucide-react'
import { getCategoryChartColor } from '@/lib/category-colors'

interface CategoryAnalysis {
    category: string
    currentMonth: number
    average: number
    limit: number | null
    exceeded: boolean
}

interface BudgetData {
    income: {
        monthly: number
        sources: Array<{ id: string; source: string; amount: number; day: number }>
    }
    obligations: {
        loanPayments: number
        loans: Array<{ id: string; bank: string; type: string; monthly: number; outstanding: number }>
    }
    spending: {
        currentMonth: number
        byCategory: CategoryAnalysis[]
    }
    summary: {
        disposableIncome: number
        surplus: number
        isFeasible: boolean
        currentMonth: string
    }
    accounts: {
        totalLKR: number
        totalUSD: number
    }
}

const formatCurrency = (amount: number, currency: string = 'LKR') => {
    if (currency === 'USD') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
    }
    return `Rs. ${amount.toLocaleString()}`
}

export default function BudgetPage() {
    const [data, setData] = useState<BudgetData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/budget/summary')
            .then(res => res.json())
            .then(json => {
                if (json.error) throw new Error(json.error)
                setData(json)
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                <div className="text-red-500">Error: {error || 'Failed to load data'}</div>
            </div>
        )
    }

    const maxSpending = Math.max(...data.spending.byCategory.map(c => c.currentMonth), 1)

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-[10px] overflow-hidden">
            {/* Header */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0 px-3 py-2">
                <div className="max-w-[1920px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Link href="/" className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all">
                                <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            </Link>
                            <div>
                                <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Budget Analysis</h1>
                                <p className="text-[9px] text-slate-500">{data.summary.currentMonth}</p>
                            </div>
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                        {/* Navigation Tabs */}
                        <div className="flex bg-slate-100 dark:bg-slate-700/50 p-0.5 rounded-lg">
                            <Link href="/" className="px-3 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all">
                                Dashboard
                            </Link>
                            <button className="px-3 py-1 bg-white dark:bg-slate-800 shadow-sm rounded-md text-[10px] font-medium text-slate-900 dark:text-slate-100 transition-all">
                                Budget
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-1.5 space-y-1.5 max-w-[1920px] mx-auto w-full">
                {/* Feasibility Banner - Compact */}
                <div className={`rounded-lg p-2 ${data.summary.isFeasible
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                    <div className="flex items-center gap-2">
                        {data.summary.isFeasible ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                        <div>
                            <h2 className={`text-[10px] font-semibold ${data.summary.isFeasible ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                                {data.summary.isFeasible ? 'Spending is Feasible' : 'Spending Exceeds Income'}
                            </h2>
                            <p className={`text-[9px] ${data.summary.isFeasible ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                Monthly {data.summary.surplus >= 0 ? 'surplus' : 'deficit'}: {formatCurrency(Math.abs(data.summary.surplus))}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Summary Cards - Compact */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                    {/* Income */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-5 h-5 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <TrendingUp className="w-3 h-3 text-green-600" />
                            </div>
                            <span className="text-[9px] text-slate-500">Monthly Income</span>
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatCurrency(data.income.monthly)}
                        </div>
                    </div>

                    {/* Loan Payments */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-5 h-5 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <CreditCard className="w-3 h-3 text-red-600" />
                            </div>
                            <span className="text-[9px] text-slate-500">Loan Payments</span>
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatCurrency(data.obligations.loanPayments)}
                        </div>
                    </div>

                    {/* Disposable */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Wallet className="w-3 h-3 text-blue-600" />
                            </div>
                            <span className="text-[9px] text-slate-500">Disposable</span>
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatCurrency(data.summary.disposableIncome)}
                        </div>
                    </div>

                    {/* Spending */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-5 h-5 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <TrendingDown className="w-3 h-3 text-orange-600" />
                            </div>
                            <span className="text-[9px] text-slate-500">Spent This Month</span>
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatCurrency(data.spending.currentMonth)}
                        </div>
                    </div>
                </div>


                {/* 2-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                    {/* Left Column - Category Spending */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                        <div className="flex items-center gap-2 mb-2">
                            <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
                            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Spending by Category</h3>
                        </div>
                        <div className="space-y-1.5">
                            {data.spending.byCategory.map(cat => {
                                const percentage = (cat.currentMonth / maxSpending) * 100
                                const limitPercentage = cat.limit ? (cat.limit / maxSpending) * 100 : null
                                const color = getCategoryChartColor(cat.category)

                                return (
                                    <div key={cat.category} className="group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: color }}
                                                />
                                                <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 capitalize">
                                                    {cat.category}
                                                </span>
                                                {cat.exceeded && (
                                                    <span className="text-[8px] bg-red-100 text-red-700 px-1 py-0.5 rounded">
                                                        Exceeded
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[10px] font-semibold ${cat.exceeded ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                                    {formatCurrency(cat.currentMonth)}
                                                </span>
                                                {cat.limit && (
                                                    <span className="text-[8px] text-slate-500 ml-1">
                                                        / {formatCurrency(cat.limit)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-0.5">
                                            <div
                                                className="absolute h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${Math.min(percentage, 100)}%`,
                                                    backgroundColor: cat.exceeded ? '#ef4444' : color,
                                                }}
                                            />
                                            {limitPercentage && (
                                                <div
                                                    className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                                                    style={{ left: `${Math.min(limitPercentage, 100)}%` }}
                                                    title={`Limit: ${formatCurrency(cat.limit!)}`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Right Column - Other Items */}
                    <div className="space-y-1.5">
                        {/* Loans Detail - Compact Column Layout */}
                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                            <div className="flex items-center gap-2 mb-2">
                                <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Loan Obligations</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {data.obligations.loans.map(loan => (
                                    <div key={loan.id} className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <div className="font-medium text-[10px] text-slate-900 dark:text-white">{loan.bank}</div>
                                        <div className="text-[8px] text-slate-500">{loan.type}</div>
                                        <div className="font-semibold text-[10px] text-red-600 mt-1">{formatCurrency(loan.monthly)}/mo</div>
                                        <div className="text-[8px] text-slate-500">Outstanding: {formatCurrency(loan.outstanding)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Account Balances - Compact */}
                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                            <div className="flex items-center gap-2 mb-2">
                                <PiggyBank className="w-3.5 h-3.5 text-slate-600" />
                                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Total Savings</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <div className="text-[9px] text-blue-600 dark:text-blue-400">LKR Accounts</div>
                                    <div className="text-sm font-bold text-blue-700 dark:text-blue-300">{formatCurrency(data.accounts.totalLKR)}</div>
                                </div>
                                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <div className="text-[9px] text-green-600 dark:text-green-400">USD Accounts</div>
                                    <div className="text-sm font-bold text-green-700 dark:text-green-300">{formatCurrency(data.accounts.totalUSD, 'USD')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
