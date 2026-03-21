'use client'

import { TrendingUp, TrendingDown, AlertTriangle, Target, Zap, BarChart3 } from 'lucide-react'
import { formatCurrency } from '@/lib/calculations'
import { format, subMonths } from 'date-fns'

interface SpendingInsightsProps {
  selectedMonth: string
  currentSpending: number
  previousMonthSpending?: number
  averageDailySpending?: number
  budget?: number
  transactions?: any[]
}

export default function SpendingInsights({
  selectedMonth,
  currentSpending,
  previousMonthSpending = 0,
  averageDailySpending = 0,
  budget,
  transactions = [],
}: SpendingInsightsProps) {
  // Calculate spending velocity (rate of spending)
  const daysInMonth = new Date(selectedMonth + '-01').getDate()
  const currentDay = new Date().getDate()
  const projectedSpending = averageDailySpending * daysInMonth
  const spendingVelocity = averageDailySpending
  const velocityTrend = previousMonthSpending > 0 
    ? ((currentSpending / currentDay) - (previousMonthSpending / daysInMonth)) / (previousMonthSpending / daysInMonth) * 100
    : 0

  // Budget vs Actual
  const budgetVariance = budget ? ((currentSpending - budget) / budget) * 100 : null
  const isOverBudget = budgetVariance !== null && budgetVariance > 0

  // Anomaly detection - find unusually large transactions
  const averageTransaction = transactions.length > 0 
    ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length 
    : 0
  const stdDev = transactions.length > 0
    ? Math.sqrt(
        transactions.reduce((sum, t) => sum + Math.pow(t.amount - averageTransaction, 2), 0) / transactions.length
      )
    : 0
  const threshold = averageTransaction + (2 * stdDev) // 2 standard deviations
  const anomalies = transactions.filter(t => t.amount > threshold)

  // Spending pattern analysis
  const dailySpending: Record<number, number> = {}
  transactions.forEach(t => {
    const day = new Date(t.date).getDate()
    dailySpending[day] = (dailySpending[day] || 0) + t.amount
  })
  const maxDailySpending = Math.max(...Object.values(dailySpending), 0)
  const avgDailySpending = Object.values(dailySpending).reduce((a, b) => a + b, 0) / Object.keys(dailySpending).length || 0

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 border border-slate-200 dark:border-slate-700">
      <h2 className="font-semibold mb-3 text-sm flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-indigo-600" />
        Spending Insights
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Spending Velocity */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-900 dark:text-blue-200">Spending Velocity</span>
            </div>
            {velocityTrend !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${velocityTrend > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {velocityTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(velocityTrend).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
            {formatCurrency(spendingVelocity)}/day
          </div>
          <div className="text-[10px] text-blue-700 dark:text-blue-300 mt-1">
            Projected: {formatCurrency(projectedSpending)} this month
          </div>
        </div>

        {/* Budget vs Actual */}
        {budget && (
          <div className={`bg-gradient-to-br rounded-lg p-3 border ${
            isOverBudget 
              ? 'from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800'
              : 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Target className={`w-4 h-4 ${isOverBudget ? 'text-red-600' : 'text-green-600'}`} />
                <span className={`text-xs font-medium ${isOverBudget ? 'text-red-900 dark:text-red-200' : 'text-green-900 dark:text-green-200'}`}>
                  Budget Status
                </span>
              </div>
              {budgetVariance !== null && (
                <span className={`text-xs font-bold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                  {isOverBudget ? '+' : ''}{budgetVariance.toFixed(1)}%
                </span>
              )}
            </div>
            <div className={`text-lg font-bold ${isOverBudget ? 'text-red-900 dark:text-red-100' : 'text-green-900 dark:text-green-100'}`}>
              {formatCurrency(currentSpending)} / {formatCurrency(budget)}
            </div>
            <div className={`text-[10px] mt-1 ${isOverBudget ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
              {isOverBudget 
                ? `${formatCurrency(currentSpending - budget)} over budget`
                : `${formatCurrency(budget - currentSpending)} remaining`
              }
            </div>
          </div>
        )}

        {/* Anomaly Detection */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-900 dark:text-amber-200">Anomalies</span>
            </div>
            {anomalies.length > 0 && (
              <span className="text-xs font-bold text-amber-600 bg-amber-200 dark:bg-amber-900 px-2 py-0.5 rounded-full">
                {anomalies.length}
              </span>
            )}
          </div>
          {anomalies.length > 0 ? (
            <>
              <div className="text-lg font-bold text-amber-900 dark:text-amber-100">
                {anomalies.length} unusual transaction{anomalies.length > 1 ? 's' : ''}
              </div>
              <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">
                Largest: {formatCurrency(Math.max(...anomalies.map(a => a.amount)))}
              </div>
            </>
          ) : (
            <div className="text-sm text-amber-700 dark:text-amber-300">
              No anomalies detected
            </div>
          )}
        </div>

        {/* Spending Pattern */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-900 dark:text-purple-200">Spending Pattern</span>
          </div>
          <div className="text-lg font-bold text-purple-900 dark:text-purple-100">
            {formatCurrency(avgDailySpending)}/day avg
          </div>
          <div className="text-[10px] text-purple-700 dark:text-purple-300 mt-1">
            Peak: {formatCurrency(maxDailySpending)} on day {Object.entries(dailySpending).find(([_, v]) => v === maxDailySpending)?.[0] || 'N/A'}
          </div>
        </div>

        {/* Month Comparison */}
        {previousMonthSpending > 0 && (
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-medium text-slate-900 dark:text-slate-200">Month Comparison</span>
              </div>
              {currentSpending !== previousMonthSpending && (
                <div className={`flex items-center gap-1 text-xs ${
                  currentSpending > previousMonthSpending ? 'text-red-600' : 'text-green-600'
                }`}>
                  {currentSpending > previousMonthSpending ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(((currentSpending - previousMonthSpending) / previousMonthSpending) * 100).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(currentSpending)}
            </div>
            <div className="text-[10px] text-slate-700 dark:text-slate-300 mt-1">
              vs {formatCurrency(previousMonthSpending)} last month
            </div>
          </div>
        )}
      </div>

      {/* Anomalies List */}
      {anomalies.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <h3 className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Unusual Transactions
          </h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {anomalies.slice(0, 5).map((anomaly, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                <span className="text-amber-900 dark:text-amber-200 truncate flex-1">
                  {anomaly.description || anomaly.merchant || 'Transaction'}
                </span>
                <span className="text-amber-700 dark:text-amber-300 font-semibold ml-2">
                  {formatCurrency(anomaly.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
