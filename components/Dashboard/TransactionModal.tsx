'use client'

import { X, Calendar, DollarSign, Building2, Tag, CreditCard, TrendingUp, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/calculations'

interface Transaction {
  id: string
  date: Date | string
  description: string
  amount: number
  type: 'debit' | 'credit'
  merchant?: string | null
  category?: string | null
  isRecurring?: boolean
  creditCard?: {
    bank: string
    maskedNumber: string
  } | null
  sourceFile?: string
}

interface TransactionModalProps {
  transaction: Transaction | null
  onClose: () => void
  onViewSimilar?: (transaction: Transaction) => void
  onViewPdf?: (sourceFile: string) => void
}

export default function TransactionModal({ transaction, onClose, onViewSimilar, onViewPdf }: TransactionModalProps) {
  if (!transaction) return null

  const transactionDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date)
  const isDebit = transaction.type === 'debit'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Transaction Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Amount - Prominent */}
          <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isDebit ? (
                <TrendingDown className="w-8 h-8 text-red-500" />
              ) : (
                <TrendingUp className="w-8 h-8 text-green-500" />
              )}
              <span className={`text-4xl font-bold ${isDebit ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {isDebit ? '-' : '+'}{formatCurrency(transaction.amount)}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isDebit ? 'Debit Transaction' : 'Credit Transaction'}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 block">Description</label>
            <p className="text-lg text-gray-900 dark:text-gray-100">{transaction.description}</p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Date
              </label>
              <p className="text-gray-900 dark:text-gray-100">
                {format(transactionDate, 'EEEE, MMMM dd, yyyy')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {format(transactionDate, 'hh:mm a')}
              </p>
            </div>

            {/* Category */}
            {transaction.category && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  Category
                </label>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {transaction.category}
                </span>
              </div>
            )}

            {/* Merchant */}
            {transaction.merchant && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  Merchant
                </label>
                <p className="text-gray-900 dark:text-gray-100">{transaction.merchant}</p>
              </div>
            )}

            {/* Credit Card */}
            {transaction.creditCard && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <CreditCard className="w-4 h-4" />
                  Card
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {transaction.creditCard.bank} •••• {transaction.creditCard.maskedNumber}
                </p>
              </div>
            )}

            {/* Recurring Badge */}
            {transaction.isRecurring && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  Recurring Payment
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
            {transaction.sourceFile && onViewPdf && (
              <button
                onClick={() => {
                  onViewPdf(transaction.sourceFile!)
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 rounded-lg transition-colors font-medium border border-slate-300 dark:border-slate-600"
              >
                View PDF
              </button>
            )}
            {onViewSimilar && (
              <button
                onClick={() => {
                  onViewSimilar(transaction)
                  onClose()
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                View Similar Transactions
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
