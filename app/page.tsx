'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area, RadialBarChart, RadialBar } from 'recharts'
import { formatCurrency } from '@/lib/calculations'
import { format as dateFormat, subMonths, startOfMonth, endOfMonth, isWithinInterval, addMonths } from 'date-fns'
import { getCategoryColor, type TransactionCategory } from '@/lib/category-classifier'
import {
  Wallet, CreditCard, TrendingUp, TrendingDown, PiggyBank,
  Building2, DollarSign, Percent, FileText, RefreshCw,
  PencilLine, Check, X, Landmark, Calendar, Target, Car,
  Store, Repeat, Clock, AlertTriangle, Zap, Shield, ArrowUpRight,
  Filter, ArrowDownWideNarrow, ArrowUpWideNarrow, Copy, CopyCheck, Plus, Mail, Sparkles, User, LogOut,
  FileSpreadsheet, ExternalLink, ListFilter, Trash2
} from 'lucide-react'
import TransactionModal from '@/components/Dashboard/TransactionModal'
import TransactionFilters from '@/components/Dashboard/TransactionFilters'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Account {
  id: string
  accountNumber: string
  bank: string
  branch: string | null
  currentBalance: number
  accountType: string | null
  balances: Array<{ balance: number }>
}

interface CreditCardData {
  id: string
  maskedNumber: string
  bank: string
  cardType: string | null
  limit: number
  usedAmount: number
  availableCredit: number
  statements: Array<{
    id: string
    closingBalance: number
    periodEnd: Date | null
    pdfPath: string | null
  }>
  pdfStatements?: string[]
}

interface Loan {
  id: string
  bank: string
  principal: number
  outstandingBalance: number
  interestRate: number
  monthlyPayment: number | null
}

interface Installment {
  id: string
  description: string
  totalAmount: number
  installmentAmount: number
  totalInstallments: number
  remainingInstallments: number
  remainingAmount: number | null
  startDate: Date
  endDate: Date | null
  creditCard: {
    bank: string
    maskedNumber: string
  } | null
}

interface CategoryData {
  category: string
  amount: number
  percentage: number
}

interface DailyData {
  day: string
  [key: string]: string | number
}

interface MonthlyTrendData {
  month: string
  fullMonth: string
  spending: number
  transactions: number
  yearMonth?: string
  largestTransaction?: { amount: number, description: string }
}

interface TopMerchant {
  name: string
  amount: number
  count: number
  avgPerVisit: number
}

interface Subscription {
  name: string
  category: string
  amount: number
  lastCharge: string
  occurrences: number
  status: 'new' | 'active' | 'discontinued'
}

interface UpcomingPayment {
  type: string
  description: string
  amount: number
  source: string
  remaining?: string
  dueDay?: number
  daysUntil?: number
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [creditCards, setCreditCards] = useState<CreditCardData[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [dailyCategories, setDailyCategories] = useState<string[]>([])
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendData[]>([])
  const [topMerchants, setTopMerchants] = useState<TopMerchant[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [subscriptionsBasis, setSubscriptionsBasis] = useState<string>('')
  const [upcomingPayments, setUpcomingPayments] = useState<{ payments: UpcomingPayment[], summary: any }>({ payments: [], summary: {} })
  const [categoryAverages, setCategoryAverages] = useState<{ averages: any[], monthCount: number, totalAverage: number }>({ averages: [], monthCount: 0, totalAverage: 0 })
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(dateFormat(new Date(), 'yyyy-MM'))
  const [loading, setLoading] = useState(true)
  const [editingBalance, setEditingBalance] = useState<string | null>(null)
  const [newBalance, setNewBalance] = useState('')
  const [exchangeRate, setExchangeRate] = useState<number>(295)
  const [accountSortBy, setAccountSortBy] = useState<'balance' | 'bank'>('balance')
  const [accountSortOrder, setAccountSortOrder] = useState<'asc' | 'desc'>('desc')
  const [accountFilter, setAccountFilter] = useState<string>('all')

  // Popups state
  const [assetsPopup, setAssetsPopup] = useState(false)
  const [liabilitiesPopup, setLiabilitiesPopup] = useState(false)
  const [netWorthPopup, setNetWorthPopup] = useState(false)
  const [creditUsedPopup, setCreditUsedPopup] = useState(false)
  const [availableCreditPopup, setAvailableCreditPopup] = useState(false)
  const [utilizationPopup, setUtilizationPopup] = useState(false)
  const [thisMonthPopup, setThisMonthPopup] = useState(false)
  const [fixedMonthlyPopup, setFixedMonthlyPopup] = useState(false)

  // Transactions & Updates
  const [transactions, setTransactions] = useState<any[]>([])
  const [previousMonthSpending, setPreviousMonthSpending] = useState<number>(0)
  const [showAddTransaction, setShowAddTransaction] = useState(false)

  // Data quality (master CSV-derived flags)
  const [dataQuality, setDataQuality] = useState<{
    available: boolean
    totals: { total: number; yearMismatch: number; futureDate: number; duplicate: number; largeAmount: number }
    flagged: any[]
    message?: string
  }>({ available: false, totals: { total: 0, yearMismatch: 0, futureDate: 0, duplicate: 0, largeAmount: 0 }, flagged: [] })
  const [showDataQuality, setShowDataQuality] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null)

  const [creditCardSortBy, setCreditCardSortBy] = useState<'bank' | 'used' | 'limit'>('used')
  const [creditCardSortOrder, setCreditCardSortOrder] = useState<'asc' | 'desc'>('desc')
  const [creditCardFilter, setCreditCardFilter] = useState<string>('all')
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null)
  const [transactionFilters, setTransactionFilters] = useState({
    searchQuery: '',
    selectedCategory: '',
    selectedMerchant: '',
    dateRange: { start: '', end: '' },
  })
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([])
  const [showTransactions, setShowTransactions] = useState(false)
  const [viewingPdf, setViewingPdf] = useState<string | null>(null)
  const [cardPdfsPopup, setCardPdfsPopup] = useState<{ bank: string; pdfs: string[] } | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [merchants, setMerchants] = useState<string[]>([])
  const [pipelineTotals, setPipelineTotals] = useState<{ total: number; processed: number; unprocessed: number; partial: number } | null>(null)


  // "Static" data — fetched once on mount. These do NOT change with the
  // month selector. In particular, installments & subscriptions represent
  // the state as of the previous calendar month (a stable snapshot), not
  // whichever month the user is analyzing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadStatic = async () => {
      await Promise.allSettled([
        fetchAllData(), // accounts, credit cards, loans
        fetchInstallments(),
        fetchSubscriptions(),
        fetchUpcomingPayments(),
        fetchExchangeRate(),
        fetchCategoryAverages(),
        fetchDataQuality(),
        fetch('/api/pipeline/status').then(r => r.ok ? r.json() : null).then(d => {
          if (d?.totals) setPipelineTotals(d.totals)
        }),
      ])
    }
    loadStatic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Month-dependent data — refetches when the month selector changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadMonth = async () => {
      try {
        await Promise.allSettled([
          fetchCategoryData(),
          fetchMonthlyTrend(),
          fetchTopMerchants(),
        ])
        setLoading(false)
        console.log('[Dashboard] Month-scoped data loaded for', selectedMonth)
      } catch (error) {
        console.error('[Dashboard] Error loading month data:', error)
        setLoading(false)
      }
    }
    loadMonth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  // Fetch top merchants when drilldown category changes
  useEffect(() => {
    fetchTopMerchants(drilldownCategory)
  }, [drilldownCategory])

  // Safety timeout - always render after 3 seconds to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[Dashboard] Safety timeout triggered, forcing render')
      setLoading(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch('/api/currency/rate')
      const data = await res.json()
      setExchangeRate(data.rate || 295)
    } catch (error) {
      console.error('Error fetching exchange rate:', error)
    }
  }

  const fetchMonthlyTrend = async () => {
    try {
      const res = await fetch('/api/dashboard/monthly-trend')
      const data = await res.json()
      setMonthlyTrend(data.monthlyTrend || [])
    } catch (error) {
      console.error('Error fetching monthly trend:', error)
    }
  }

  const fetchTopMerchants = async (category?: string | null) => {
    try {
      const categoryQuery = category ? `&category=${encodeURIComponent(category)}` : ''
      const res = await fetch(`/api/dashboard/top-merchants?month=${selectedMonth}${categoryQuery}`)
      const data = await res.json()
      setTopMerchants(data.topMerchants || [])
    } catch (error) {
      console.error('Error fetching top merchants:', error)
    }
  }

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/dashboard/subscriptions')
      const data = await res.json()
      setSubscriptions(data.subscriptions || [])
      setSubscriptionsBasis(data.basisLabel || '')
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
    }
  }

  const fetchCategoryAverages = async () => {
    try {
      const res = await fetch('/api/dashboard/averages')
      if (res.ok) {
        const data = await res.json()
        setCategoryAverages(data)
      }
    } catch (error) {
      console.error('Error fetching category averages:', error)
    }
  }

  const fetchUpcomingPayments = async () => {
    try {
      const res = await fetch('/api/dashboard/upcoming-payments')
      const data = await res.json()
      setUpcomingPayments(data)
    } catch (error) {
      console.error('Error fetching upcoming payments:', error)
    }
  }

  const fetchInstallments = async () => {
    try {
      const res = await fetch('/api/installments')
      if (!res.ok) {
        console.error(`[Installments] HTTP error! status: ${res.status}`)
        setInstallments([])
        return
      }
      const data = await res.json()
      console.log('[Installments] Fetched:', data.installments?.length || 0, 'installments')
      setInstallments(data.installments || [])
    } catch (error) {
      console.error('[Installments] Error fetching installments:', error)
      setInstallments([]) // Set empty array on error
    }
  }

  const fetchAllData = async () => {
    try {
      const res = await fetch('/api/dashboard/all-data')
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      setAccounts(data.accounts || [])
      setCreditCards(data.creditCards || [])
      setLoans(data.loans || [])
      setLoading(false)
    } catch (error: any) {
      console.error('Error fetching data:', error)
      // Set empty arrays on error to prevent infinite loading
      setAccounts([])
      setCreditCards([])
      setLoans([])
      setLoading(false)
    }
  }

  const fetchCategoryData = async () => {
    try {
      const res = await fetch(`/api/dashboard/categories?month=${selectedMonth}`)
      const data = await res.json()
      setCategoryData(data.categoryData || [])

      const dailyRes = await fetch(`/api/dashboard/daily-spending?month=${selectedMonth}`)
      const dailySpendingData = await dailyRes.json()
      setDailyData(dailySpendingData.dailyData || [])
      setDailyCategories(dailySpendingData.categories || [])

      // Fetch transactions for insights
      await fetchTransactions()

      // Fetch previous month spending
      const [year, month] = selectedMonth.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1)
      const prevMonth = dateFormat(subMonths(startDate, 1), 'yyyy-MM')
      const prevMonthRes = await fetch(`/api/dashboard/categories?month=${prevMonth}`)
      if (prevMonthRes.ok) {
        const prevMonthData = await prevMonthRes.json()
        setPreviousMonthSpending(prevMonthData.totalSpending || 0)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleBalanceUpdate = async (accountId: string, currentBalance: number) => {
    const newBalStr = prompt(`Update balance for this account (Current: ${formatCurrency(currentBalance)})`, currentBalance.toString())
    if (newBalStr === null) return // Cancelled

    const newBal = parseFloat(newBalStr)
    if (isNaN(newBal)) {
      alert('Invalid amount')
      return
    }

    try {
      const res = await fetch('/api/account/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, newBalance: newBal })
      })

      if (!res.ok) throw new Error('Failed to update')

      const json = await res.json()
      if (json.success) {
        // Update local state
        setAccounts(prev => prev.map(acc =>
          acc.id === accountId ? { ...acc, currentBalance: newBal, balances: [{ balance: newBal }] } : acc
        ))
        // Force refresh all data just in case
        fetchAllData()
      } else {
        alert('Update failed: ' + json.error)
      }
    } catch (e) {
      console.error('Update error', e)
      alert('Failed to update balance')
    }
  }

  const fetchDataQuality = async () => {
    try {
      const res = await fetch('/api/dashboard/data-quality')
      if (res.ok) {
        const data = await res.json()
        setDataQuality(data)
      }
    } catch (e) {
      console.error('Error fetching data quality:', e)
    }
  }

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({ month: selectedMonth })
      if (transactionFilters.searchQuery) params.append('search', transactionFilters.searchQuery)
      if (transactionFilters.selectedCategory) params.append('category', transactionFilters.selectedCategory)
      if (transactionFilters.selectedMerchant) params.append('merchant', transactionFilters.selectedMerchant)
      if (transactionFilters.dateRange.start) params.append('dateStart', transactionFilters.dateRange.start)
      if (transactionFilters.dateRange.end) params.append('dateEnd', transactionFilters.dateRange.end)

      const transactionsRes = await fetch(`/api/dashboard/transactions?${params.toString()}`)
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json()
        const txs = transactionsData.transactions || []
        setTransactions(txs)
        setFilteredTransactions(txs)

        // Extract unique categories and merchants
        const uniqueCategories = Array.from(new Set(txs.map((t: any) => t.category).filter(Boolean)))
        const uniqueMerchants = Array.from(new Set(txs.map((t: any) => t.merchant).filter(Boolean)))
        setCategories(uniqueCategories as string[])
        setMerchants(uniqueMerchants as string[])
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }



  const formatBalance = (acc: Account) => {
    const balance = acc.balances[0]?.balance || acc.currentBalance
    if (acc.accountType === 'crypto_usd') {
      return `$${balance.toFixed(2)} USDT`
    }
    return formatCurrency(balance)
  }

  // Calculate totals safely with error handling
  const totalAssets = (accounts || []).reduce((sum, acc) => {
    try {
      const balance = acc.balances?.[0]?.balance || acc.currentBalance || 0
      if (acc.accountType === 'crypto_usd') {
        return sum + (balance * exchangeRate)
      }
      return sum + balance
    } catch (e) {
      return sum
    }
  }, 0)

  const totalLiabilities = (loans || []).reduce((sum, loan) => sum + (loan.outstandingBalance || 0), 0)
  const netWorth = totalAssets - totalLiabilities
  const totalCreditUsed = (creditCards || []).reduce((sum, card) => {
    const used = card.statements?.[0]?.closingBalance || card.usedAmount || 0
    return sum + used
  }, 0)
  const totalCreditLimit = (creditCards || []).reduce((sum, card) => sum + (card.limit || 0), 0)
  const totalSpending = (categoryData || []).reduce((sum, item) => sum + (item.amount || 0), 0)
  const creditUtilization = totalCreditLimit > 0 ? (totalCreditUsed / totalCreditLimit) * 100 : 0

  // ─── Last-month anchor ───────────────────────────────────────────
  // Installments & Subscriptions are shown as they stood at the end of
  // the previous calendar month — a stable snapshot independent of the
  // month selector.
  const lastMonthEnd = endOfMonth(subMonths(new Date(), 1))
  const lastMonthStart = startOfMonth(subMonths(new Date(), 1))
  const lastMonthLabel = dateFormat(lastMonthStart, 'MMM yyyy')

  const getInstallmentEndDate = (inst: Installment) => {
    if (inst.endDate) return inst.endDate instanceof Date ? inst.endDate : new Date(inst.endDate)
    const start = inst.startDate instanceof Date ? inst.startDate : new Date(inst.startDate)
    return addMonths(start, inst.remainingInstallments || 0)
  }

  // Only installments that were still active during last month.
  // "Active" = remainingInstallments > 0 AND the payment window overlaps
  // last month (start <= lastMonthEnd AND end >= lastMonthStart).
  const activeInstallments = (installments || []).filter((inst) => {
    if ((inst.remainingInstallments ?? 0) <= 0) return false
    const start = inst.startDate instanceof Date ? inst.startDate : new Date(inst.startDate)
    const end = getInstallmentEndDate(inst)
    return start <= lastMonthEnd && (!end || isNaN(end.getTime()) || end >= lastMonthStart)
  })

  // Monthly fixed obligations — based on the active set only.
  const monthlyInstallments = activeInstallments.reduce((sum, i) => sum + (i.installmentAmount || 0), 0)
  const monthlyLoanPayments = (loans || []).reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)
  const totalMonthlyObligations = monthlyInstallments + monthlyLoanPayments
  const installmentByCard: Map<string, { totalRemaining: number; latestEnd: Date | null }> = new Map()
  for (const inst of activeInstallments) {
    const cardName = inst.creditCard
      ? `${inst.creditCard.bank}${inst.creditCard.maskedNumber ? ' ' + inst.creditCard.maskedNumber : ''}`
      : 'Unknown'
    const remainingAmount = inst.remainingAmount ?? inst.installmentAmount * inst.remainingInstallments
    const endDate = getInstallmentEndDate(inst)
    const current = installmentByCard.get(cardName) || { totalRemaining: 0, latestEnd: endDate }
    const latestEnd = current.latestEnd && endDate
      ? (endDate > current.latestEnd ? endDate : current.latestEnd)
      : endDate || current.latestEnd
    installmentByCard.set(cardName, {
      totalRemaining: current.totalRemaining + remainingAmount,
      latestEnd,
    })
  }

  // Generate month options
  const monthOptions = []
  for (let i = 0; i < 12; i++) {
    const date = subMonths(new Date(), i)
    monthOptions.push({
      value: dateFormat(date, 'yyyy-MM'),
      label: dateFormat(date, 'MMM yyyy'),
    })
  }

  // Prepare prediction data
  const predictionData = (categoryData || []).slice(0, 6).map(item => ({
    category: (item.category || '').length > 10 ? (item.category || '').substring(0, 10) + '..' : (item.category || ''),
    predicted: Math.round((item.amount || 0) * 1.05),
    current: item.amount || 0,
  }))

  // Credit utilization gauge data
  const utilizationData = [
    { name: 'Used', value: creditUtilization, fill: creditUtilization > 70 ? '#EF4444' : creditUtilization > 50 ? '#F59E0B' : '#22C55E' }
  ]

  // Financial health score (simple calculation)
  const healthScore = Math.max(0, Math.min(100,
    100 - (creditUtilization * 0.3) - (totalLiabilities > 0 ? 20 : 0) + (netWorth > 0 ? 20 : -10)
  ))

  // Show loading only briefly - always render after data fetch completes or timeout
  // This prevents infinite loading state
  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    )
  }

  const changeMonth = (direction: 'prev' | 'next') => {
    const current = new Date(selectedMonth + '-01')
    const newDate = direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1)
    setSelectedMonth(dateFormat(newDate, 'yyyy-MM'))
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-[10px] overflow-hidden">
      <div className="max-w-[1920px] w-full mx-auto flex-1 flex flex-col p-1.5 space-y-1.5 overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm px-3 py-2 flex items-center justify-between border border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Finance Dashboard</h1>
                <p className="text-[9px] text-slate-500">Overview & Analytics</p>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

            {/* Navigation Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-700/50 p-0.5 rounded-lg gap-0.5">
              <button className="px-3 py-1 bg-white dark:bg-slate-800 shadow-sm rounded-md text-[10px] font-medium text-slate-900 dark:text-slate-100 transition-all">
                Dashboard
              </button>
              <Link href="/budget" className="px-3 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all">
                Budget
              </Link>
              <Link href="/extract" className="px-3 py-1 text-[10px] font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-all flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                BYOD
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User + Logout */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md font-medium">
                1 USD = {exchangeRate.toFixed(2)} LKR
              </span>

              <button
                onClick={() => alert('Add Transaction Modal - Implementation Pending')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all text-[10px] font-medium"
              >
                <Plus className="w-3 h-3" />
                Add Transaction
              </button>

              <a
                href="https://docs.google.com/spreadsheets/d/10ViyHlv1pb1XW4U4C0E8OmieXiiw9C6dU8mgRLhp_O0/edit?gid=0#gid=0"
                target="_blank"
                rel="noopener noreferrer"
                title="Open manual entry Google Sheet"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all text-[10px] font-medium"
              >
                <FileSpreadsheet className="w-3 h-3" />
                Sheet
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>

              {/* Data Quality flags badge — only shown when there are flags */}
              {dataQuality.available && (dataQuality.totals.yearMismatch + dataQuality.totals.duplicate + dataQuality.totals.futureDate + dataQuality.totals.largeAmount) > 0 && (
                <button
                  onClick={() => setShowDataQuality(true)}
                  title="Click to review data-quality flags"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg shadow-sm transition-all text-[10px] font-medium"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {dataQuality.totals.yearMismatch + dataQuality.totals.duplicate + dataQuality.totals.futureDate + dataQuality.totals.largeAmount} flags
                </button>
              )}

              <Link
                href="/profile"
                title="Profile & Settings"
                className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all text-[9px] font-medium border border-slate-200 dark:border-slate-700"
              >
                <User className="w-3.5 h-3.5" />
                Profile
              </Link>

              <button
                onClick={() => signOut()}
                title="Sign out"
                className="flex items-center gap-1 px-2 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all text-[9px] font-medium border border-slate-200 dark:border-slate-700"
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* ROW 1: STATIC CARDS (Not affected by month selector) */}
        <div className="grid grid-cols-5 gap-1.5 flex-1 min-h-0">
          {/* Accounts */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1.5 border border-slate-200 dark:border-slate-700 h-full flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-xs flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Accounts ({accounts.length})
              </h2>
              <div className="flex gap-0.5 items-center">
                <select
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  className="text-[8px] px-0.5 py-0 border rounded bg-white dark:bg-slate-800"
                >
                  <option value="all">All</option>
                  <option value="bank">Bank</option>
                  <option value="crypto">Crypto</option>
                </select>
                <select
                  value={`${accountSortBy}-${accountSortOrder}`}
                  onChange={(e) => {
                    const [sort, order] = e.target.value.split('-')
                    setAccountSortBy(sort as 'balance' | 'bank')
                    setAccountSortOrder(order as 'asc' | 'desc')
                  }}
                  className="text-[8px] px-0.5 py-0 border rounded bg-white dark:bg-slate-800"
                >
                  <option value="balance-desc">Balance ↓</option>
                  <option value="balance-asc">Balance ↑</option>
                  <option value="bank-asc">Bank A-Z</option>
                  <option value="bank-desc">Bank Z-A</option>
                </select>
              </div>
            </div>
            <div className="space-y-0.5 flex-1 overflow-y-auto">
              {accounts
                .filter(acc => {
                  if (accountFilter === 'bank') return acc.accountType !== 'crypto_usd'
                  if (accountFilter === 'crypto') return acc.accountType === 'crypto_usd'
                  return true
                })
                .sort((a, b) => {
                  const balanceA = a.balances[0]?.balance || a.currentBalance
                  const balanceB = b.balances[0]?.balance || b.currentBalance

                  if (accountSortBy === 'balance') {
                    return accountSortOrder === 'desc' ? balanceB - balanceA : balanceA - balanceB
                  } else {
                    return accountSortOrder === 'asc'
                      ? a.bank.localeCompare(b.bank)
                      : b.bank.localeCompare(a.bank)
                  }
                })
                .map((acc) => {
                  const balance = acc.balances[0]?.balance || acc.currentBalance
                  return (
                    <div key={acc.id} className="flex items-center justify-between p-0.5 border-b border-slate-100 dark:border-slate-700 last:border-0 group">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[10px] truncate">{acc.bank}</div>
                        <div className="text-[8px] text-slate-400 truncate">{acc.accountNumber}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-medium cursor-pointer hover:bg-slate-100 px-1 rounded ${acc.accountType === 'crypto_usd' ? 'text-amber-600' : ''}`}
                          onClick={() => handleBalanceUpdate(acc.id, balance)}
                          title="Click to update balance manually"
                        >
                          {formatBalance(acc)}
                        </span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Active Installments — state as of last calendar month */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1.5 border border-slate-200 dark:border-slate-700 h-full flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1 shrink-0">
              <h2 className="font-semibold text-xs flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Active Installments ({activeInstallments.length})
              </h2>
              <span className="text-[8px] text-slate-400" title="Snapshot — does not change with the month selector">
                as of {lastMonthLabel}
              </span>
            </div>
            {activeInstallments.length > 0 ? (
              <>
                <div className="overflow-y-auto flex-1 min-h-0 pr-1">
                  <table className="w-full text-[8px]">
                    <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-0.5 font-medium text-slate-500">Item</th>
                        <th className="text-left py-0.5 font-medium text-slate-500">Card</th>
                        <th className="text-right py-0.5 font-medium text-slate-500">Monthly</th>
                        <th className="text-right py-0.5 font-medium text-slate-500">Left</th>
                        <th className="text-right py-0.5 font-medium text-slate-500">Remaining</th>
                        <th className="text-right py-0.5 font-medium text-slate-500">Free On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeInstallments.map((inst) => {
                        const cardName = inst.creditCard
                          ? `${inst.creditCard.bank}${inst.creditCard.maskedNumber ? ' ' + inst.creditCard.maskedNumber : ''}`
                          : 'N/A'
                        const remainingAmount = inst.remainingAmount !== null && inst.remainingAmount !== undefined
                          ? inst.remainingAmount
                          : (inst.installmentAmount * inst.remainingInstallments)
                        const freeOn = getInstallmentEndDate(inst)
                        return (
                          <tr key={inst.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                            <td className="py-0.5 truncate max-w-[60px]" title={inst.description}>{inst.description}</td>
                            <td className="py-0.5 text-[7px] text-slate-500 truncate max-w-[50px]" title={cardName}>{cardName}</td>
                            <td className="py-0.5 text-right font-medium">{formatCurrency(inst.installmentAmount)}</td>
                            <td className="py-0.5 text-right text-slate-400">{inst.remainingInstallments}/{inst.totalInstallments}</td>
                            <td className="py-0.5 text-right font-semibold text-red-600">{formatCurrency(remainingAmount)}</td>
                            <td className="py-0.5 text-right text-slate-500">
                              {freeOn && !isNaN(freeOn.getTime()) ? dateFormat(freeOn, 'MMM yyyy') : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {installmentByCard.size > 0 && (
                  <div className="mt-1 border-t border-slate-200 dark:border-slate-700 pt-1 space-y-0.5 shrink-0">
                    {Array.from(installmentByCard.entries()).map(([card, info]) => (
                      <div key={card} className="flex items-center justify-between text-[8px] text-slate-500">
                        <span className="truncate max-w-[120px]" title={card}>{card}</span>
                        <span className="text-slate-700">
                          {formatCurrency(info.totalRemaining)}
                          {info.latestEnd ? ` · frees ${dateFormat(info.latestEnd, 'MMM yyyy')}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-slate-400 text-[10px]">No active installments as of {lastMonthLabel}</div>
            )}
          </div>

          {/* Loans */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1.5 border border-slate-200 dark:border-slate-700 h-full flex flex-col">
            <h2 className="font-semibold mb-1 text-xs flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-red-600" />
              Loans ({loans.length})
            </h2>
            <div className="space-y-1 flex-1 overflow-y-auto">
              {loans.slice(0, 3).map((loan) => {
                const progress = ((loan.principal - loan.outstandingBalance) / loan.principal) * 100
                const isVehicle = loan.bank.toLowerCase().includes('vehicle')
                return (
                  <div key={loan.id} className="p-1 bg-slate-50 dark:bg-slate-700/50 rounded">
                    <div className="flex justify-between items-center">
                      <div className="font-medium text-[10px] flex items-center gap-1">
                        {isVehicle && <Car className="w-3 h-3 text-blue-500" />}
                        <span className="truncate max-w-[80px]">{loan.bank}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="text-[8px] text-slate-400">{loan.interestRate}%</div>
                      </div>
                    </div>
                    <div className="text-[9px] text-red-600 font-medium">{formatCurrency(loan.outstandingBalance)}</div>
                    {loan.monthlyPayment && (
                      <div className="text-[8px] text-slate-500">{formatCurrency(loan.monthlyPayment)}/mo</div>
                    )}
                    <div className="w-full bg-slate-200 rounded-full h-1 mt-0.5">
                      <div className="bg-blue-600 h-1 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Subscriptions — active per last month's statements */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1.5 border border-slate-200 dark:border-slate-700 h-full flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1 shrink-0">
              <h2 className="font-semibold text-xs flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5 text-indigo-600" />
                Subscriptions ({subscriptions.filter(s => s.status !== 'discontinued').length})
              </h2>
              <span className="text-[8px] text-slate-400" title="Derived from recent statements">
                {subscriptionsBasis || lastMonthLabel}
              </span>
            </div>
            <div className="space-y-0.5 flex-1 overflow-y-auto min-h-0 pr-1">
              {(subscriptions || []).length > 0 ? (
                <>
                  {(subscriptions || []).map((sub) => (
                    <div key={sub.name} className={`flex items-center justify-between p-0.5 border-b border-slate-100 dark:border-slate-700 last:border-0 ${sub.status === 'discontinued' ? 'opacity-50' : ''}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <div className={`font-medium text-[10px] truncate ${sub.status === 'discontinued' ? 'line-through' : ''}`} title={sub.name}>{sub.name}</div>
                          {sub.status === 'new' && <span className="px-1 py-[1px] rounded-[2px] bg-green-100 text-green-700 text-[6px] font-bold uppercase tracking-wider leading-none">New</span>}
                          {sub.status === 'discontinued' && <span className="px-1 py-[1px] rounded-[2px] bg-red-100 text-red-700 text-[6px] font-bold uppercase tracking-wider leading-none">Ended</span>}
                        </div>
                        <div className="text-[8px] text-slate-400">{sub.category}</div>
                      </div>
                      <div className="text-[10px] font-medium text-indigo-600 shrink-0">{formatCurrency(sub.amount)}</div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-[9px] text-slate-400 text-center py-4">No subscriptions found</div>
              )}
            </div>
            {(subscriptions || []).filter(s => s.status !== 'discontinued').length > 0 && (
              <div className="pt-1 border-t border-slate-200 mt-1 shrink-0">
                <div className="flex justify-between text-[10px] font-bold">
                  <span>Total/mo</span>
                  <span className="text-indigo-600">{formatCurrency((subscriptions || []).filter(s => s.status !== 'discontinued').reduce((s, sub) => s + (sub.amount || 0), 0))}</span>
                </div>
              </div>
            )}
          </div>

          {/* Average Monthly Spend (Static) */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1.5 border border-slate-200 dark:border-slate-700 h-full flex flex-col">
            <h2 className="font-semibold mb-1 text-xs flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
              Avg Monthly Spend ({categoryAverages.monthCount}mo avg)
            </h2>
            <div className="space-y-0.5 flex-1 overflow-y-auto">
              {(categoryAverages.averages || []).length > 0 ? (
                <>
                  {(categoryAverages.averages || []).slice(0, 5).map((item: any) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between p-0.5 border-b border-slate-100 dark:border-slate-700 last:border-0"
                    >
                      <div className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getCategoryColor(item.category as TransactionCategory) }}
                        />
                        <span className="text-[9px] truncate max-w-[70px]">{item.category}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-medium">{formatCurrency(item.average)}</div>
                        {(() => {
                          const current = (categoryData || []).find(c => c.category === item.category)
                          if (!current) return null
                          const diff = current.amount - item.average
                          if (Math.abs(diff) < 100) return null
                          return (
                            <div className={`text-[7px] ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-600 mt-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>Avg Total</span>
                      <span className="text-purple-600">{formatCurrency(categoryAverages.totalAverage)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-[9px] text-slate-400 text-center py-4">Loading...</div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: MONTH-DEPENDENT CONTENT */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-2 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Monthly Analysis - {dateFormat(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
            </h2>
            <div className="flex items-center gap-4">
              {/* Trend & Highlights */}
              {(() => {
                const currentMonthData = (monthlyTrend || []).find(m => m.yearMonth === selectedMonth)
                const prevDate = dateFormat(subMonths(new Date(selectedMonth + '-01'), 1), 'yyyy-MM')
                const prevMonthData = (monthlyTrend || []).find(m => m.yearMonth === prevDate)

                const spendDiff = currentMonthData && prevMonthData
                  ? ((currentMonthData.spending - prevMonthData.spending) / prevMonthData.spending) * 100
                  : 0

                const largestTx = (currentMonthData as any)?.largestTransaction

                return (
                  <div className="flex items-center gap-3 text-[10px]">
                    {/* Trend */}
                    {prevMonthData && (
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-600">
                        <span className="text-slate-500">vs Last Month:</span>
                        <span className={`font-bold flex items-center ${spendDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {spendDiff > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                          {Math.abs(spendDiff).toFixed(1)}%
                        </span>
                      </div>
                    )}

                    {/* Largest Transaction */}
                    {largestTx && largestTx.amount > 0 && (
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-600 hidden md:flex">
                        <span className="text-slate-500">Biggest Purchase:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]" title={largestTx.description}>
                          {largestTx.description}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-white">
                          {formatCurrency(largestTx.amount)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}

              <button
                onClick={() => setShowTransactions(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-all text-[10px] font-medium"
                title={`View transactions for ${dateFormat(new Date(selectedMonth + '-01'), 'MMMM yyyy')}`}
              >
                <ListFilter className="w-3 h-3" />
                Show Transactions
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeMonth('prev')}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="text-xs font-medium min-w-[80px] text-center">
                  {dateFormat(new Date(selectedMonth + '-01'), 'MMM yyyy')}
                </span>
                <button
                  onClick={() => changeMonth('next')}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 - 2 columns */}
        <div className="grid grid-cols-2 gap-1.5 flex-1 min-h-0">
          {/* Credit Cards - Grid Layout */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1.5 border border-slate-200 dark:border-slate-700 h-full flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-xs flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                Credit Cards ({creditCards.length})
                {pipelineTotals && (
                  <Link
                    href="/pipeline"
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-medium border transition-colors ${
                      pipelineTotals.unprocessed + pipelineTotals.partial > 0
                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                    }`}
                    title={`${pipelineTotals.processed}/${pipelineTotals.total} PDFs processed — click to manage`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${pipelineTotals.unprocessed + pipelineTotals.partial > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {pipelineTotals.processed}/{pipelineTotals.total} PDFs
                    {pipelineTotals.unprocessed + pipelineTotals.partial > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">· {pipelineTotals.unprocessed + pipelineTotals.partial} pending</span>
                    )}
                  </Link>
                )}
              </h2>
              <div className="flex gap-0.5 items-center">
                <Filter className="w-2.5 h-2.5 text-slate-500" />
                <select
                  value={creditCardFilter}
                  onChange={(e) => setCreditCardFilter(e.target.value)}
                  className="text-[7px] px-0.5 py-0 border rounded bg-white dark:bg-slate-800"
                >
                  <option value="all">All</option>
                  <option value="used">With Balance</option>
                  <option value="available">Available</option>
                </select>
                <select
                  value={`${creditCardSortBy}-${creditCardSortOrder}`}
                  onChange={(e) => {
                    const [sort, order] = e.target.value.split('-')
                    setCreditCardSortBy(sort as 'bank' | 'used' | 'limit')
                    setCreditCardSortOrder(order as 'asc' | 'desc')
                  }}
                  className="text-[7px] px-0.5 py-0 border rounded bg-white dark:bg-slate-800"
                >
                  <option value="used-desc">Used ↓</option>
                  <option value="used-asc">Used ↑</option>
                  <option value="bank-asc">Bank A-Z</option>
                  <option value="bank-desc">Bank Z-A</option>
                  <option value="limit-desc">Limit ↓</option>
                  <option value="limit-asc">Limit ↑</option>
                </select>
                <button
                  onClick={() => setCreditCardSortOrder(creditCardSortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-0.5 text-slate-500 hover:text-blue-600"
                  title="Toggle sort order"
                >
                  {creditCardSortOrder === 'asc' ? <ArrowUpWideNarrow className="w-2.5 h-2.5" /> : <ArrowDownWideNarrow className="w-2.5 h-2.5" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 flex-1 overflow-y-auto">
              {(creditCards || [])
                .map((card) => {
                  const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number)
                  const statementForMonth = card.statements?.find((stmt: any) => {
                    let statementYear: number | null = null
                    let statementMonth: number | null = null
                    if (stmt.periodStart) {
                      const ps = stmt.periodStart instanceof Date ? stmt.periodStart : new Date(stmt.periodStart)
                      if (!isNaN(ps.getTime())) {
                        statementYear = ps.getFullYear()
                        statementMonth = ps.getMonth() + 1
                      }
                    }
                    if (!statementMonth && stmt.statementPeriod) {
                      const periodMatch = stmt.statementPeriod.match(/(\d{4})-(\d{2})-\d{2}\s+To/i)
                      if (periodMatch) {
                        statementYear = parseInt(periodMatch[1], 10)
                        statementMonth = parseInt(periodMatch[2], 10)
                      }
                    }
                    if (!statementMonth && stmt.periodEnd) {
                      const pe = stmt.periodEnd instanceof Date ? stmt.periodEnd : new Date(stmt.periodEnd)
                      if (!isNaN(pe.getTime())) {
                        if (pe.getMonth() === 0) {
                          statementYear = pe.getFullYear() - 1
                          statementMonth = 12
                        } else {
                          statementYear = pe.getFullYear()
                          statementMonth = pe.getMonth() + 1
                        }
                      }
                    }
                    if (!statementMonth) return false
                    if (!statementYear) statementYear = selectedYear
                    return statementYear === selectedYear && statementMonth === selectedMonthNum
                  })

                  return {
                    ...card,
                    _statementForMonth: statementForMonth || null,
                  }
                })
                .filter((card) => {
                  const used = card._statementForMonth?.closingBalance || card.usedAmount || 0
                  if (creditCardFilter === 'used') return used > 0
                  if (creditCardFilter === 'available') return used === 0
                  return true
                })
                .sort((a, b) => {
                  const usedA = a._statementForMonth?.closingBalance || a.usedAmount || 0
                  const usedB = b._statementForMonth?.closingBalance || b.usedAmount || 0
                  const limitA = a.limit || 0
                  const limitB = b.limit || 0

                  if (creditCardSortBy === 'bank') {
                    return creditCardSortOrder === 'asc'
                      ? (a.bank || '').localeCompare(b.bank || '')
                      : (b.bank || '').localeCompare(a.bank || '')
                  } else if (creditCardSortBy === 'used') {
                    return creditCardSortOrder === 'desc' ? usedB - usedA : usedA - usedB
                  } else {
                    return creditCardSortOrder === 'desc' ? limitB - limitA : limitA - limitB
                  }
                })
                .map((card) => {
                  const statementForMonth = card._statementForMonth
                  const latestStatement = card.statements?.[0]
                  const used = card.bank === 'Commercial Bank'
                    ? (card.usedAmount || 0)
                    : (latestStatement?.closingBalance || card.usedAmount || 0)
                  const utilization = (card.limit || 0) > 0 ? (used / card.limit) * 100 : 0

                  // Sort PDFs newest-first and extract month labels
                  const sortedPdfs: string[] = [...(card.pdfStatements || [])].sort().reverse()
                  const hasAnyPdfs = sortedPdfs.length > 0
                  const visiblePdfs = sortedPdfs.slice(0, 3)
                  const hiddenCount = sortedPdfs.length - visiblePdfs.length

                  const getPdfLabel = (pdf: string) => {
                    const m = pdf.match(/_(\d{4}-\d{2})_/)
                    if (!m) return pdf
                    const d = new Date(m[1] + '-02')
                    return d.toLocaleString('default', { month: 'short', year: '2-digit' })
                  }

                  return (
                    <div
                      key={card.id}
                      className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 flex flex-col gap-1.5 shadow-sm"
                    >
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[10px] text-slate-900 dark:text-white truncate" title={card.bank}>
                            {card.bank}
                          </div>
                          <div className="text-[7px] text-slate-400 truncate">{card.cardType}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-[10px] font-bold text-red-600">{formatCurrency(used)}</div>
                          <div className="text-[7px] text-slate-400">/ {formatCurrency(card.limit)}</div>
                        </div>
                      </div>

                      {/* Utilization bar */}
                      <div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${utilization > 90 ? 'bg-red-500' : utilization > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </div>
                        <div className="text-[7px] text-slate-400 text-right mt-0.5">{utilization.toFixed(0)}% used</div>
                      </div>

                      {/* Statements strip */}
                      {hasAnyPdfs ? (
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-1.5">
                          <div className="text-[7px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Statements</div>
                          <div className="flex flex-wrap gap-1">
                            {visiblePdfs.map((pdf) => (
                              <button
                                key={pdf}
                                onClick={() => setViewingPdf(`/api/statements/pdf?file=${encodeURIComponent(pdf)}`)}
                                className="text-[7px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors font-medium"
                                title={pdf}
                              >
                                {getPdfLabel(pdf)}
                              </button>
                            ))}
                            {hiddenCount > 0 && (
                              <button
                                onClick={() => setCardPdfsPopup({ bank: card.bank, pdfs: sortedPdfs })}
                                className="text-[7px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                              >
                                +{hiddenCount} more
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-1.5">
                          <div className="text-[7px] text-slate-400 italic">No statements yet</div>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>


          {/* Category Distribution Donut with Details */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-2 border border-slate-200 dark:border-slate-700 h-full flex flex-col">
            <h2 className="font-semibold mb-1 text-xs flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-purple-600" />
              Spending Distribution
            </h2>
            {
              (categoryData || []).length > 0 ? (
                <div className="flex gap-2 flex-1 min-h-0 items-stretch">
                  <div className="w-1/2 h-full relative" style={{ minHeight: 140 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <Pie
                          data={(categoryData || []).slice(0, 8) as any}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ percent }: any) =>
                            percent && percent > 0.06 ? `${(percent * 100).toFixed(0)}%` : ''
                          }
                          outerRadius="85%"
                          innerRadius="55%"
                          paddingAngle={1}
                          fill="#8884d8"
                          dataKey="amount"
                          nameKey="category"
                          onClick={(data: any) => {
                            if (data && data.category) {
                              setTransactionFilters({ ...transactionFilters, selectedCategory: data.category })
                              setShowTransactions(true)
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {(categoryData || []).slice(0, 8).map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={getCategoryColor((entry.category || 'Other') as TransactionCategory)}
                              stroke="#fff"
                              strokeWidth={1}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number | undefined) => formatCurrency(v || 0)}
                          contentStyle={{ fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center total label */}
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-[8px] text-slate-400 leading-none">Total</div>
                      <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 leading-tight">
                        {formatCurrency((categoryData || []).reduce((s, c) => s + (c.amount || 0), 0))}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
                    {(categoryData || []).slice(0, 10).map((item) => (
                      <div
                        key={item.category}
                        onClick={() => {
                          setTransactionFilters({ ...transactionFilters, selectedCategory: item.category })
                          setShowTransactions(true)
                        }}
                        className="flex items-center justify-between text-[9px] border-b border-slate-100 dark:border-slate-700 last:border-0 py-0.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        title={`Click to view ${item.category} transactions`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getCategoryColor(item.category as TransactionCategory) }}
                          />
                          <span className="truncate">{item.category}</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-1">
                          <div className="font-medium">{formatCurrency(item.amount)}</div>
                          <div className="text-[7px] text-slate-400">{item.percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-[10px]">No data</div>
              )
            }
          </div>
        </div>


        {/* Monthly Payments Summary */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-2 border border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold mb-1 text-xs flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-red-600" />
            Monthly Fixed Obligations Summary
          </h2>
          <div className="grid grid-cols-6 gap-2">
            <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
              <div className="text-[9px] text-red-600">Total Monthly</div>
              <div className="text-sm font-bold text-red-700">{formatCurrency(totalMonthlyObligations)}</div>
            </div>
            <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
              <div className="text-[9px] text-amber-600">Installments ({activeInstallments.length})</div>
              <div className="text-sm font-bold text-amber-700">{formatCurrency(monthlyInstallments)}</div>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <div className="text-[9px] text-blue-600">Loan Payments ({loans.length})</div>
              <div className="text-sm font-bold text-blue-700">{formatCurrency(monthlyLoanPayments)}</div>
            </div>
            <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded">
              <div className="text-[9px] text-indigo-600">Subscriptions ({subscriptions.filter(s => s.status !== 'discontinued').length})</div>
              <div className="text-sm font-bold text-indigo-700">{formatCurrency(subscriptions.filter(s => s.status !== 'discontinued').reduce((s, sub) => s + sub.amount, 0))}</div>
            </div>
            <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
              <div className="text-[9px] text-purple-600">This Month Spending</div>
              <div className="text-sm font-bold text-purple-700">{formatCurrency(totalSpending)}</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="text-[9px] text-green-600">Avg Daily ({dailyData.length} days)</div>
              <div className="text-sm font-bold text-green-700">{formatCurrency(totalSpending / Math.max((dailyData || []).filter(d => (d.total as number) > 0).length, 1))}</div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {pdfViewUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setPdfViewUrl(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-sm">Document Viewer</h2>
              <button onClick={() => setPdfViewUrl(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"><X className="w-4 h-4 text-slate-600" /></button>
            </div>
            <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-900 rounded-b-lg overflow-hidden">
              <iframe src={pdfViewUrl} className="w-full h-full border-0" />
            </div>
          </div>
        </div>
      )}

      {/* Data Quality Modal */}
      {showDataQuality && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDataQuality(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Data Quality — flagged transactions
              </h2>
              <button
                onClick={() => setShowDataQuality(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 grid grid-cols-5 gap-2 text-[10px]">
              <div className="text-center p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                <div className="text-slate-500">Total tx</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">{dataQuality.totals.total}</div>
              </div>
              <div className="text-center p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded">
                <div className="text-amber-700">Year mismatch</div>
                <div className="font-bold text-amber-700">{dataQuality.totals.yearMismatch}</div>
              </div>
              <div className="text-center p-1.5 bg-rose-50 dark:bg-rose-900/20 rounded">
                <div className="text-rose-700">Duplicate</div>
                <div className="font-bold text-rose-700">{dataQuality.totals.duplicate}</div>
              </div>
              <div className="text-center p-1.5 bg-purple-50 dark:bg-purple-900/20 rounded">
                <div className="text-purple-700">Future date</div>
                <div className="font-bold text-purple-700">{dataQuality.totals.futureDate}</div>
              </div>
              <div className="text-center p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                <div className="text-blue-700">Large debit</div>
                <div className="font-bold text-blue-700">{dataQuality.totals.largeAmount}</div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {dataQuality.flagged.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Description</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Amount</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Bank</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Source file</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Why flagged</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {dataQuality.flagged.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        {editingTransaction?.id === row.id ? (
                          <td colSpan={7} className="px-3 py-2 bg-slate-100 dark:bg-slate-800">
                            <div className="flex gap-2 text-xs">
                              <input type="text" value={editingTransaction.date_iso} onChange={e => setEditingTransaction({...editingTransaction, date_iso: e.target.value})} className="border p-1 rounded" placeholder="Date (YYYY-MM-DD)" />
                              <input type="text" value={editingTransaction.description} onChange={e => setEditingTransaction({...editingTransaction, description: e.target.value})} className="border p-1 rounded flex-1" placeholder="Description" />
                              <input type="number" value={editingTransaction.amount} onChange={e => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value)})} className="border p-1 rounded w-24" placeholder="Amount" />
                              <select value={editingTransaction.direction} onChange={e => setEditingTransaction({...editingTransaction, direction: e.target.value})} className="border p-1 rounded">
                                <option value="debit">debit</option>
                                <option value="credit">credit</option>
                              </select>
                              <button onClick={async () => {
                                try {
                                  const res = await fetch('/api/dashboard/update-transaction', {
                                    method: 'POST',
                                    headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify(editingTransaction)
                                  })
                                  if (res.ok) {
                                    setEditingTransaction(null)
                                      fetchAllData() // reload
                                  } else { alert('Failed') }
                                } catch(e) { alert('Error') }
                              }} className="bg-blue-600 text-white px-2 rounded">Save</button>
                              <button onClick={() => setEditingTransaction(null)} className="px-2">Cancel</button>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{row.date || '—'}</td>
                            <td className="px-3 py-1.5 text-slate-900 dark:text-slate-100 font-medium">{row.description}</td>
                            <td className={`px-3 py-1.5 text-right font-semibold whitespace-nowrap ${row.direction === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(row.amount)}
                            </td>
                            <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{row.bank}</td>
                            <td className="px-3 py-1.5 text-slate-500 text-[10px] truncate max-w-[200px]" title={row.source}>{row.source}</td>
                            <td className="px-3 py-1.5">
                              <div className="flex flex-wrap gap-1">
                                {row.flags.yearMismatch && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px]">year mismatch</span>}
                                {row.flags.duplicate && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px]">duplicate</span>}
                                {row.flags.futureDate && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px]">future date</span>}
                                {row.flags.largeAmount && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9px]">large</span>}
                              </div>
                              {row.notes && <div className="text-[9px] text-slate-400 mt-0.5">{row.notes}</div>}
                            </td>
                            <td className="px-3 py-1.5 text-right space-x-2 whitespace-nowrap">
                              {row.source && (
                                <button onClick={() => setPdfViewUrl(`/api/statements/pdf?file=${encodeURIComponent(row.source)}`)} className="text-[10px] text-blue-600 hover:underline">
                                  View PDF
                                </button>
                              )}
                              <button onClick={() => setEditingTransaction({
                                id: row.id,
                                old_description: row.description,
                                old_amount: row.amount,
                                date_iso: row.date,
                                description: row.description,
                                amount: row.amount,
                                direction: row.direction,
                                source_file: row.source
                              })} className="text-[10px] text-indigo-600 hover:underline">
                                Edit
                              </button>
                              <button onClick={async () => {
                                if (confirm('Are you sure you want to delete this record?')) {
                                  try {
                                    const res = await fetch(`/api/dashboard/update-transaction?id=${row.id}&source_file=${encodeURIComponent(row.source)}&old_description=${encodeURIComponent(row.description)}&old_amount=${row.amount}`, { method: 'DELETE' });
                                    if (res.ok) {
                                      fetchAllData();
                                    } else {
                                      alert('Failed to delete');
                                    }
                                  } catch (e) { alert('Error deleting') }
                                }
                              }} className="text-[10px] text-red-600 hover:text-red-800" title="Delete">
                                <Trash2 className="w-3 h-3 inline-block" />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  {dataQuality.message || 'No flagged transactions.'}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-500">
              Source: <code className="px-1 bg-slate-100 dark:bg-slate-700 rounded">data/master_transactions.csv</code>
              {' '}— rebuild with{' '}
              <code className="px-1 bg-slate-100 dark:bg-slate-700 rounded">python3 scripts/build_master_csv.py</code>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal (single tx) */}
      <TransactionModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onViewPdf={(sourceFile) => {
          setSelectedTransaction(null)
          setPdfViewUrl(`/api/statements/pdf?file=${encodeURIComponent(sourceFile)}`)
        }}
        onViewSimilar={(tx) => {
          setSelectedTransaction(null)
          setTransactionFilters({
            ...transactionFilters,
            selectedMerchant: tx.merchant || '',
            selectedCategory: tx.category || '',
          })
          setShowTransactions(true)
        }}
      />

      {/* Transactions Modal Overlay — defaults to selected month (1st - 31st) */}
      {showTransactions && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTransactions(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Transactions — {dateFormat(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
                <span className="text-[10px] font-normal text-slate-500">
                  ({filteredTransactions.length} of {transactions.length})
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeMonth('prev')}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="text-xs font-medium min-w-[80px] text-center">
                  {dateFormat(new Date(selectedMonth + '-01'), 'MMM yyyy')}
                </span>
                <button
                  onClick={() => changeMonth('next')}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  onClick={() => setShowTransactions(false)}
                  className="ml-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="px-4 pt-2 pb-1 border-b border-slate-100 dark:border-slate-700/50">
              <TransactionFilters
                searchQuery={transactionFilters.searchQuery}
                onSearchChange={(query) => setTransactionFilters({ ...transactionFilters, searchQuery: query })}
                selectedCategory={transactionFilters.selectedCategory}
                onCategoryChange={(category) => setTransactionFilters({ ...transactionFilters, selectedCategory: category })}
                selectedMerchant={transactionFilters.selectedMerchant}
                onMerchantChange={(merchant) => setTransactionFilters({ ...transactionFilters, selectedMerchant: merchant })}
                dateRange={transactionFilters.dateRange}
                onDateRangeChange={(range) => setTransactionFilters({ ...transactionFilters, dateRange: range })}
                categories={categories}
                merchants={merchants}
                onClear={() => setTransactionFilters({ searchQuery: '', selectedCategory: '', selectedMerchant: '', dateRange: { start: '', end: '' } })}
              />
            </div>

            {/* Scrollable transaction table */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {filteredTransactions.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Description</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Merchant</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Category</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Card</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Amount</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTransaction(tx)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {format(new Date(tx.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-3 py-1.5 text-slate-900 dark:text-slate-100 font-medium">
                          {tx.description}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">
                          {tx.merchant || '-'}
                        </td>
                        <td className="px-3 py-1.5">
                          {tx.category ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ backgroundColor: getCategoryColor(tx.category as TransactionCategory) + '40', color: getCategoryColor(tx.category as TransactionCategory) }}
                            >
                              {tx.category}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400 text-[10px] whitespace-nowrap">
                          {tx.creditCard ? `${tx.creditCard.bank} •••• ${tx.creditCard.maskedNumber.slice(-4)}` : '-'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          {tx.sourceFile && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setPdfViewUrl(`/api/statements/pdf?file=${encodeURIComponent(tx.sourceFile)}`)
                              }}
                              className="text-[10px] text-blue-600 hover:underline"
                            >
                              View PDF
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No transactions found for {dateFormat(new Date(selectedMonth + '-01'), 'MMMM yyyy')}{' '}
                  with the selected filters.
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-between items-center px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-500">
              <span>
                Total: <span className="font-semibold text-red-600">
                  {formatCurrency(filteredTransactions.reduce((s, t) => s + (t.amount || 0), 0))}
                </span>
              </span>
              <button
                onClick={() => setShowTransactions(false)}
                className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 rounded text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* (Asset breakdown popup follows) */}
      <div>
        {/* Spacer block to keep subsequent siblings (assets/popups) at the same JSX nesting level */}


        {/* Assets Breakdown Popup */}
        {
          assetsPopup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={() => setAssetsPopup(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                    Assets Breakdown
                  </h3>
                  <button
                    onClick={() => setAssetsPopup(false)}
                    className="text-slate-500 hover:text-slate-700 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {(accounts || []).map((acc) => {
                    const balance = acc.balances[0]?.balance || acc.currentBalance
                    const displayBalance = acc.accountType === 'crypto_usd' ? balance * exchangeRate : balance
                    const percentage = totalAssets > 0 ? (displayBalance / totalAssets) * 100 : 0
                    return (
                      <div key={acc.id} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                        <div className="flex-1">
                          <div className="font-medium text-[10px]">{acc.bank}</div>
                          <div className="text-[9px] text-slate-500">{acc.accountNumber}</div>
                          {acc.accountType === 'crypto_usd' && (
                            <div className="text-[8px] text-amber-600 mt-0.5">
                              ${balance.toFixed(2)} USD × {exchangeRate.toFixed(2)} = {formatCurrency(displayBalance)}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-[10px] text-green-600">{formatCurrency(displayBalance)}</div>
                          <div className="text-[9px] text-slate-500">{percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    )
                  })}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>Total Assets</span>
                      <span className="text-green-600">{formatCurrency(totalAssets)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }
        {
          liabilitiesPopup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={() => setLiabilitiesPopup(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                    Liabilities Breakdown
                  </h3>
                  <button onClick={() => setLiabilitiesPopup(false)} className="text-slate-500 hover:text-slate-700 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {(loans || []).map((loan) => (
                    <div key={loan.id} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="flex-1">
                        <div className="font-medium text-[10px]">{loan.bank}</div>
                        <div className="text-[9px] text-slate-500">Monthly: {formatCurrency(loan.monthlyPayment || 0)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[10px] text-red-600">{formatCurrency(loan.outstandingBalance)}</div>
                        <div className="text-[9px] text-slate-500">{((loan.outstandingBalance / totalLiabilities) * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>Total Liabilities</span>
                      <span className="text-red-600">{formatCurrency(totalLiabilities)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }
        {
          netWorthPopup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={() => setNetWorthPopup(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <PiggyBank className="w-3.5 h-3.5 text-blue-600" />
                    Net Worth Calculation
                  </h3>
                  <button onClick={() => setNetWorthPopup(false)} className="text-slate-500 hover:text-slate-700 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-1.5 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-[10px] font-medium">Total Assets</span>
                    <span className="text-[10px] font-bold text-green-600">{formatCurrency(totalAssets)}</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-red-50 dark:bg-red-900/20 rounded">
                    <span className="text-[10px] font-medium">Total Liabilities</span>
                    <span className="text-[10px] font-bold text-red-600">{formatCurrency(totalLiabilities)}</span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5">
                    <div className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <span className="text-[10px] font-bold">Net Worth</span>
                      <span className={`text-[10px] font-bold ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(netWorth)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Credit Used Breakdown Popup */}
        {
          creditUsedPopup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={() => setCreditUsedPopup(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-orange-600" />
                    Credit Used Breakdown
                  </h3>
                  <button onClick={() => setCreditUsedPopup(false)} className="text-slate-500 hover:text-slate-700 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {(creditCards || []).map((card) => {
                    const used = card.statements?.[0]?.closingBalance || card.usedAmount || 0
                    return (
                      <div key={card.id} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                        <div className="flex-1">
                          <div className="font-medium text-[10px]">{card.bank}</div>
                          <div className="text-[9px] text-slate-500">{card.cardType}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-[10px] text-orange-600">{formatCurrency(used)}</div>
                          <div className="text-[9px] text-slate-500">{((used / totalCreditUsed) * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                    )
                  })}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>Total Credit Used</span>
                      <span className="text-orange-600">{formatCurrency(totalCreditUsed)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Available Credit Breakdown Popup */}
        {
          availableCreditPopup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={() => setAvailableCreditPopup(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-green-600" />
                    Available Credit Breakdown
                  </h3>
                  <button onClick={() => setAvailableCreditPopup(false)} className="text-slate-500 hover:text-slate-700 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {(creditCards || []).map((card) => {
                    const used = card.statements?.[0]?.closingBalance || card.usedAmount || 0
                    const available = (card.limit || 0) - used
                    return (
                      <div key={card.id} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                        <div className="flex-1">
                          <div className="font-medium text-[10px]">{card.bank}</div>
                          <div className="text-[9px] text-slate-500">{card.cardType}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-[10px] text-green-600">{formatCurrency(available)}</div>
                          <div className="text-[9px] text-slate-500">of {formatCurrency(card.limit || 0)}</div>
                        </div>
                      </div>
                    )
                  })}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>Total Available Credit</span>
                      <span className="text-green-600">{formatCurrency(totalCreditLimit - totalCreditUsed)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Utilization Breakdown Popup */}
        {
          utilizationPopup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={() => setUtilizationPopup(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-blue-600" />
                    Credit Utilization Details
                  </h3>
                  <button onClick={() => setUtilizationPopup(false)} className="text-slate-500 hover:text-slate-700 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                    <span className="text-[10px] font-medium">Total Credit Limit</span>
                    <span className="text-[10px] font-bold">{formatCurrency(totalCreditLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                    <span className="text-[10px] font-medium">Credit Used</span>
                    <span className="text-[10px] font-bold text-orange-600">{formatCurrency(totalCreditUsed)}</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                    <span className="text-[10px] font-medium">Available Credit</span>
                    <span className="text-[10px] font-bold text-green-600">{formatCurrency(totalCreditLimit - totalCreditUsed)}</span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5">
                    <div className="flex items-center justify-between p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <span className="text-[10px] font-bold">Utilization</span>
                      <span className={`text-[10px] font-bold ${creditUtilization > 70 ? 'text-red-600' : creditUtilization > 50 ? 'text-amber-600' : 'text-green-600'}`}>
                        {creditUtilization.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">
                    {creditUtilization > 70 ? '⚠️ High utilization - consider paying down balances' :
                      creditUtilization > 50 ? '⚡ Moderate utilization - monitor closely' :
                        '✓ Healthy utilization level'}
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* This Month Breakdown Popup */}
        {
          thisMonthPopup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={() => setThisMonthPopup(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    This Month Spending ({dateFormat(new Date(selectedMonth + '-01'), 'MMM yyyy')})
                  </h3>
                  <button onClick={() => setThisMonthPopup(false)} className="text-slate-500 hover:text-slate-700 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {(categoryData || []).slice(0, 10).map((item) => (
                    <div key={item.category} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(item.category as TransactionCategory) }} />
                        <span className="text-[10px] font-medium">{item.category}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[10px] text-purple-600">{formatCurrency(item.amount)}</div>
                        <div className="text-[9px] text-slate-500">{item.percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>Total This Month</span>
                      <span className="text-purple-600">{formatCurrency(totalSpending)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Fixed Monthly Breakdown Popup */}
        {
          fixedMonthlyPopup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={() => setFixedMonthlyPopup(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-indigo-600" />
                    Fixed Monthly Obligations
                  </h3>
                  <button onClick={() => setFixedMonthlyPopup(false)} className="text-slate-500 hover:text-slate-700 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {(loans || []).map((loan) => (
                    <div key={loan.id} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="flex-1">
                        <div className="font-medium text-[10px]">{loan.bank} Loan</div>
                        <div className="text-[9px] text-slate-500">Monthly payment</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[10px] text-indigo-600">{formatCurrency(loan.monthlyPayment || 0)}</div>
                      </div>
                    </div>
                  ))}
                  {(installments || []).map((inst) => {
                    const cardName = inst.creditCard
                      ? `${inst.creditCard.bank}${inst.creditCard.maskedNumber ? ' ' + inst.creditCard.maskedNumber : ''}`
                      : 'N/A'
                    const remainingAmount = inst.remainingAmount !== null && inst.remainingAmount !== undefined
                      ? inst.remainingAmount
                      : (inst.installmentAmount * inst.remainingInstallments)
                    const freeOn = getInstallmentEndDate(inst)
                    return (
                      <div key={inst.id} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                        <div className="flex-1">
                          <div className="font-medium text-[10px]">{inst.description}</div>
                          <div className="text-[9px] text-slate-500">{cardName}</div>
                          <div className="text-[8px] text-slate-400">{inst.remainingInstallments || 0}/{inst.totalInstallments} months remaining</div>
                          {freeOn && !isNaN(freeOn.getTime()) && (
                            <div className="text-[8px] text-slate-400">Frees {dateFormat(freeOn, 'MMM yyyy')}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-[10px] text-indigo-600">{formatCurrency(inst.installmentAmount)}/mo</div>
                          <div className="text-[9px] text-red-600 font-medium">{formatCurrency(remainingAmount)} left</div>
                        </div>
                      </div>
                    )
                  })}
                  {(subscriptions || []).map((sub) => (
                    <div key={sub.name} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="flex-1">
                        <div className="font-medium text-[10px]">{sub.name}</div>
                        <div className="text-[9px] text-slate-500">{sub.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[10px] text-indigo-600">{formatCurrency(sub.amount)}</div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>Total Fixed Monthly</span>
                      <span className="text-indigo-600">{formatCurrency(totalMonthlyObligations)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

      </div>
      {/* Card PDFs Popup — lists all unlocked statements for a card */}
      {cardPdfsPopup && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4"
          onClick={() => setCardPdfsPopup(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{cardPdfsPopup.bank}</h3>
                  <p className="text-xs text-slate-500">
                    {cardPdfsPopup.pdfs.length} unlocked statement{cardPdfsPopup.pdfs.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCardPdfsPopup(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PDF list */}
            <div className="overflow-y-auto p-4 space-y-2 max-h-[60vh]">
              {[...cardPdfsPopup.pdfs].sort().reverse().map((pdf) => {
                const monthMatch = pdf.match(/_(\d{4}-\d{2})_/)
                const label = monthMatch
                  ? new Date(monthMatch[1] + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })
                  : pdf
                return (
                  <button
                    key={pdf}
                    onClick={() => {
                      setCardPdfsPopup(null)
                      setViewingPdf(`/api/statements/pdf?file=${encodeURIComponent(pdf)}`)
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 transition-all text-left group"
                  >
                    <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors flex-shrink-0">
                      <FileText className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{label}</div>
                      <div className="text-[10px] text-slate-400 truncate" title={pdf}>{pdf}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
              <button
                onClick={() => setCardPdfsPopup(null)}
                className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingPdf && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setViewingPdf(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">Statement Viewer</h3>
              </div>
              <button onClick={() => setViewingPdf(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4">
              <iframe 
                src={viewingPdf} 
                className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-800"
                title="PDF Viewer"
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
              <button 
                onClick={() => window.open(viewingPdf, '_blank')}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </button>
              <button 
                onClick={() => setViewingPdf(null)}
                className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
