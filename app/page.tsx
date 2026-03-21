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
  Filter, ArrowDownWideNarrow, ArrowUpWideNarrow, Copy, CopyCheck, Plus, Mail, Sparkles
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
  const [categories, setCategories] = useState<string[]>([])
  const [merchants, setMerchants] = useState<string[]>([])


  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadData = async () => {
      try {
        // Use Promise.allSettled to ensure all requests complete even if some fail
        await Promise.allSettled([
          fetchAllData(), // This fetches credit cards with all statements
          fetchCategoryData(),
          fetchInstallments(),
          fetchExchangeRate(),
          fetchMonthlyTrend(),
          fetchTopMerchants(),
          fetchSubscriptions(),
          fetchUpcomingPayments(),
          fetchCategoryAverages(), // Static data - not month dependent
        ])
        // Always set loading to false after all requests complete
        setLoading(false)
        console.log('[Dashboard] All data loading completed for month:', selectedMonth)
      } catch (error) {
        console.error('[Dashboard] Error loading dashboard data:', error)
        setLoading(false) // Always set loading to false, even on error
      }
    }
    loadData()
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

  // Monthly fixed obligations
  const monthlyInstallments = (installments || []).reduce((sum, i) => sum + (i.installmentAmount || 0), 0)
  const monthlyLoanPayments = (loans || []).reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)
  const totalMonthlyObligations = monthlyInstallments + monthlyLoanPayments
  const getInstallmentEndDate = (inst: Installment) => {
    if (inst.endDate) return inst.endDate instanceof Date ? inst.endDate : new Date(inst.endDate)
    const start = inst.startDate instanceof Date ? inst.startDate : new Date(inst.startDate)
    return addMonths(start, inst.remainingInstallments || 0)
  }
  const installmentByCard: Map<string, { totalRemaining: number; latestEnd: Date | null }> = new Map()
  for (const inst of installments || []) {
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

              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Sign out"
                className="flex items-center gap-1 px-2 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all text-[9px] font-medium border border-slate-200 dark:border-slate-700"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
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

          {/* Active Installments - Moved from Row 2 */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1.5 border border-slate-200 dark:border-slate-700 h-full flex flex-col">
            <h2 className="font-semibold mb-1 text-xs flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Active Installments ({installments.length})
            </h2>
            {
              (installments || []).length > 0 ? (
                <>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-[8px]">
                      <thead className="sticky top-0 bg-white dark:bg-slate-800">
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
                        {(installments || []).map((inst) => {
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
                    <div className="mt-1 border-t border-slate-200 dark:border-slate-700 pt-1 space-y-0.5">
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
                <div className="h-[140px] flex items-center justify-center text-slate-400 text-[10px]">No installments</div>
              )
            }
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

          {/* Subscriptions */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1.5 border border-slate-200 dark:border-slate-700 h-full flex flex-col">
            <h2 className="font-semibold mb-1 text-xs flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5 text-indigo-600" />
              Subscriptions ({subscriptions.length})
            </h2>
            <div className="space-y-0.5 flex-1 overflow-y-auto">
              {(subscriptions || []).length > 0 ? (
                <>
                  {(subscriptions || []).map((sub) => (
                    <div key={sub.name} className="flex items-center justify-between p-0.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                      <div>
                        <div className="font-medium text-[10px]">{sub.name}</div>
                        <div className="text-[8px] text-slate-400">{sub.category}</div>
                      </div>
                      <div className="text-[10px] font-medium text-indigo-600">{formatCurrency(sub.amount)}</div>
                    </div>
                  ))}
                  <div className="pt-1 border-t border-slate-200 mt-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>Total/mo</span>
                      <span className="text-indigo-600">{formatCurrency((subscriptions || []).reduce((s, sub) => s + (sub.amount || 0), 0))}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-[9px] text-slate-400 text-center py-4">No subscriptions detected</div>
              )}
            </div>
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
        </div >

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

        {/* Charts Row 1 - 3 columns */}
        < div className="grid grid-cols-4 gap-1.5 flex-1 min-h-0" >
          {/* Credit Cards - Grid Layout */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1.5 border border-slate-200 dark:border-slate-700 h-full flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-xs flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                Credit Cards ({creditCards.length})
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
                  const hasStatement = !!statementForMonth
                  const hasStatementId = !!statementForMonth?.id
                  const hasPdfPath = !!statementForMonth?.pdfPath
                  const hasPdf = hasStatement && hasPdfPath && hasStatementId

                  const handleClick = hasPdf ? async (e: any) => {
                    e.stopPropagation()
                    e.preventDefault()
                    if (!statementForMonth || !statementForMonth.id || !statementForMonth.pdfPath) {
                      alert(`ERROR: Statement missing details`)
                      return
                    }
                    const url = `/api/statements/${statementForMonth.id}/pdf`
                    window.open(url, '_blank')
                  } : undefined

                  return (
                    <div
                      key={card.id}
                      className="p-1 border border-slate-100 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-700/30"
                      onClick={handleClick}
                      style={{ cursor: hasPdf ? 'pointer' : 'default' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[9px] flex items-center gap-1 truncate" title={card.bank}>
                            {card.bank}
                          </div>
                          <div className="text-[7px] text-slate-400 truncate">{card.cardType}</div>
                        </div>
                        {hasPdf && <FileText className="w-2.5 h-2.5 text-blue-500" />}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[8px]">
                        <span className="text-red-600 font-medium">{formatCurrency(used)}</span>
                      </div>
                      <div className="text-[7px] text-slate-400 text-right">
                        / {formatCurrency(card.limit)}
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                        <div
                          className={`h-1 rounded-full transition-all ${utilization > 80 ? 'bg-red-500' : utilization > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
          {/* Category Spending Comparison (Last 3 Months) */}
          < div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-2 border border-slate-200 dark:border-slate-700 h-full flex flex-col" >
            <h2 className="font-semibold mb-1 text-xs flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              Top Categories & Merchants
            </h2>
            <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
              {/* Categories */}
              <div className="flex flex-col h-full">
                <h3 className="text-[8px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Categories {drilldownCategory ? '(Filtered)' : ''}
                </h3>
                {
                  (categoryData || []).length > 0 ? (
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(categoryData || []).slice(0, 5)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fontSize: 7 }} tickFormatter={(v) => v > 999 ? `${(v / 1000).toFixed(0)}k` : v.toString()} stroke="#94a3b8" />
                          <YAxis dataKey="category" type="category" tick={{ fontSize: 7, width: 60 }} width={60} stroke="#94a3b8" />
                          <Tooltip
                            formatter={(v: number | undefined) => formatCurrency(v || 0)}
                            contentStyle={{ fontSize: '9px' }}
                            cursor={{ fill: 'transparent' }}
                          />
                          <Bar
                            dataKey="amount"
                            radius={[0, 4, 4, 0]}
                            onClick={(data: any) => setDrilldownCategory(data.category === drilldownCategory ? null : data.category)}
                            cursor="pointer"
                          >
                            {(categoryData || []).slice(0, 5).map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={getCategoryColor((entry.category || 'Other') as TransactionCategory)}
                                opacity={drilldownCategory && drilldownCategory !== entry.category ? 0.3 : 1}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-[10px]">No category data</div>
                  )
                }
              </div >

              {/* Merchants */}
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[8px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[100px]" title={drilldownCategory ? `Merchants in ${drilldownCategory}` : 'Top Merchants'}>
                    {drilldownCategory ? `${drilldownCategory}` : 'Merchants'}
                  </h3>
                  {drilldownCategory && (
                    <button
                      onClick={() => setDrilldownCategory(null)}
                      className="text-[8px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                    >
                      <X className="w-2 h-2" /> Reset
                    </button>
                  )}
                </div>
                {
                  (topMerchants || []).length > 0 ? (
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(topMerchants || []).slice(0, 5)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fontSize: 7 }} tickFormatter={(v) => v > 999 ? `${(v / 1000).toFixed(0)}k` : v.toString()} stroke="#94a3b8" />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 7, width: 60 }} width={60} stroke="#94a3b8" />
                          <Tooltip
                            formatter={(v: number | undefined) => formatCurrency(v || 0)}
                            contentStyle={{ fontSize: '9px' }}
                          />
                          <Bar dataKey="amount" fill="#10B981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-[10px]">No data</div>
                  )
                }
              </div>
            </div>
          </div >

          {/* Daily Spending Line Chart */}
          < div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-2 border border-slate-200 dark:border-slate-700 h-full flex flex-col" >
            <h2 className="font-semibold mb-1 text-xs flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              Daily Spending - {dateFormat(new Date(selectedMonth + '-01'), 'MMM')}
            </h2>
            {
              (dailyData || []).some(d => (d.total as number) > 0) ? (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 7 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 7 }} tickFormatter={(v) => v > 999 ? `${(v / 1000).toFixed(0)}k` : v.toString()} stroke="#94a3b8" />
                      <Tooltip
                        formatter={(v: number | undefined, name: string | undefined) => [formatCurrency(v || 0), name || '']}
                        contentStyle={{ fontSize: '8px', borderRadius: '6px' }}
                        cursor={{ fill: '#f1f5f9' }}
                      />
                      <Legend iconSize={6} wrapperStyle={{ fontSize: '8px' }} />
                      {(dailyCategories || []).slice(0, 5).map((cat) => (
                        <Bar
                          key={cat}
                          dataKey={cat}
                          stackId="a"
                          fill={getCategoryColor(cat as TransactionCategory)}
                          radius={[0, 0, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-[10px]">No daily data</div>
              )
            }
          </div >

          {/* Category Distribution Donut with Details */}
          < div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-2 border border-slate-200 dark:border-slate-700 h-full flex flex-col" >
            <h2 className="font-semibold mb-1 text-xs flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-purple-600" />
              Spending Distribution
            </h2>
            {
              (categoryData || []).length > 0 ? (
                <div className="flex gap-2 flex-1 min-h-0">
                  <ResponsiveContainer width="50%" height="100%">
                    <PieChart>
                      <Pie
                        data={(categoryData || []).slice(0, 8) as any}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }: any) => `${name}`}
                        outerRadius={50}
                        innerRadius={25}
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
                          <Cell key={`cell-${index}`} fill={getCategoryColor((entry.category || 'Other') as TransactionCategory)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number | undefined) => formatCurrency(v || 0)} contentStyle={{ fontSize: '9px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 overflow-y-auto space-y-0.5">
                    {(categoryData || []).slice(0, 10).map((item) => (
                      <div
                        key={item.category}
                        onClick={() => {
                          setTransactionFilters({ ...transactionFilters, selectedCategory: item.category })
                          setShowTransactions(true)
                        }}
                        className="flex items-center justify-between text-[8px] border-b border-slate-100 dark:border-slate-700 last:border-0 pb-0.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        title={`Click to view ${item.category} transactions`}
                      >
                        <div className="flex items-center gap-1">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: getCategoryColor(item.category as TransactionCategory) }}
                          />
                          <span className="truncate max-w-[60px]">{item.category}</span>
                        </div>
                        <div className="text-right">
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
          </div >
        </div >


        {/* Monthly Payments Summary */}
        < div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-2 border border-slate-200 dark:border-slate-700" >
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
              <div className="text-[9px] text-amber-600">Installments ({installments.length})</div>
              <div className="text-sm font-bold text-amber-700">{formatCurrency(monthlyInstallments)}</div>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <div className="text-[9px] text-blue-600">Loan Payments ({loans.length})</div>
              <div className="text-sm font-bold text-blue-700">{formatCurrency(monthlyLoanPayments)}</div>
            </div>
            <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded">
              <div className="text-[9px] text-indigo-600">Subscriptions ({subscriptions.length})</div>
              <div className="text-sm font-bold text-indigo-700">{formatCurrency(subscriptions.reduce((s, sub) => s + sub.amount, 0))}</div>
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

      {/* Transactions Section */}
      < div className="mt-4" >
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              Transactions ({filteredTransactions.length})
            </h2>
            <button
              onClick={() => setShowTransactions(!showTransactions)}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {showTransactions ? 'Hide' : 'Show'} Transactions
            </button>
          </div>

          {showTransactions && (
            <>
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

              <div className="max-h-96 overflow-y-auto">
                {filteredTransactions.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-700 dark:text-slate-300">Date</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-700 dark:text-slate-300">Description</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-700 dark:text-slate-300">Merchant</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-700 dark:text-slate-300">Category</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-700 dark:text-slate-300">Card</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-700 dark:text-slate-300">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() => setSelectedTransaction(tx)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                        >
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">
                            {format(new Date(tx.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-2 py-1.5 text-slate-900 dark:text-slate-100 font-medium">
                            {tx.description}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">
                            {tx.merchant || '-'}
                          </td>
                          <td className="px-2 py-1.5">
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
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400 text-[10px]">
                            {tx.creditCard ? `${tx.creditCard.bank} •••• ${tx.creditCard.maskedNumber.slice(-4)}` : '-'}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-red-600 dark:text-red-400">
                            {formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No transactions found for the selected filters
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {/* Transaction Modal */}
        <TransactionModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
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

        {/* Transaction List Modal */}
        {showTransactions && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTransactions(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <TransactionFilters
                searchQuery={transactionFilters.searchQuery}
                onSearchChange={(q) => setTransactionFilters(prev => ({ ...prev, searchQuery: q }))}
                selectedCategory={transactionFilters.selectedCategory}
                onCategoryChange={(c) => setTransactionFilters(prev => ({ ...prev, selectedCategory: c }))}
                selectedMerchant={transactionFilters.selectedMerchant}
                onMerchantChange={(m) => setTransactionFilters(prev => ({ ...prev, selectedMerchant: m }))}
                dateRange={transactionFilters.dateRange}
                onDateRangeChange={(r) => setTransactionFilters(prev => ({ ...prev, dateRange: r }))}
                categories={categories}
                merchants={merchants}
                onClear={() => setTransactionFilters({
                  searchQuery: '',
                  selectedCategory: '',
                  selectedMerchant: '',
                  dateRange: { start: '', end: '' },
                })}
              />
              <div className="flex justify-end p-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setShowTransactions(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded text-sm text-slate-700 dark:text-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}


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
    </div>
  )
}

