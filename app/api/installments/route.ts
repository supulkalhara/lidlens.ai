import { NextResponse } from 'next/server'
import { loadManualData, loadStructuredTransactions } from '@/lib/data-loader'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Load manual installments
    const { installments: manualInstallments } = await loadManualData()

    // Load all transactions
    const { transactions, cards } = await loadStructuredTransactions()
    const cardMap = new Map(cards.map(c => [c.id, c]))

    // Find all is_installment=true transactions
    const installmentTransactions = transactions.filter(tx => tx.isInstallment === true)

    // Group by description to aggregate installment info
    const installmentMap = new Map<string, {
      description: string
      totalAmount: number
      installmentAmount: number
      totalInstallments: number
      paidInstallments: number
      remainingInstallments: number
      remainingAmount: number
      cardId: string
      lastDate: Date
    }>()

    for (const tx of installmentTransactions) {
      const key = tx.description
      const existing = installmentMap.get(key)

      if (existing) {
        // Update if this transaction has more complete info
        if (tx.installmentTotal && tx.installmentTotal > existing.totalInstallments) {
          existing.totalInstallments = tx.installmentTotal
        }
        if (tx.installmentPaid && tx.installmentPaid > existing.paidInstallments) {
          existing.paidInstallments = tx.installmentPaid
        }
        // Keep the most recent date
        const txDate = new Date(tx.date)
        if (txDate > existing.lastDate) {
          existing.lastDate = txDate
        }
      } else {
        const totalInstallments = tx.installmentTotal || 12 // Default to 12 if not specified
        const paidInstallments = tx.installmentPaid || 1 // Default to 1 if not specified
        const remainingInstallments = totalInstallments - paidInstallments

        installmentMap.set(key, {
          description: tx.description,
          totalAmount: tx.amount * totalInstallments,
          installmentAmount: tx.amount,
          totalInstallments: totalInstallments,
          paidInstallments: paidInstallments,
          remainingInstallments: remainingInstallments,
          remainingAmount: tx.amount * remainingInstallments,
          cardId: tx.cardId,
          lastDate: new Date(tx.date)
        })
      }
    }

    const detectedInstallments = Array.from(installmentMap.values()).map((inst, idx) => {
      const card = cardMap.get(inst.cardId)
      return {
        id: `detected-${idx}`,
        description: inst.description,
        totalAmount: inst.totalAmount,
        installmentAmount: inst.installmentAmount,
        totalInstallments: inst.totalInstallments,
        remainingInstallments: inst.remainingInstallments,
        remainingAmount: inst.remainingAmount,
        startDate: inst.lastDate, // Use last transaction date as approximation
        endDate: null,
        creditCard: card ? {
          bank: card.bank,
          maskedNumber: '****',
        } : null
      }
    })

    // Also include manual installments
    const normalizedManual = manualInstallments.map(inst => {
      const card = inst.cardId ? cardMap.get(inst.cardId) : null
      return {
        id: inst.id,
        description: inst.description,
        totalAmount: inst.totalAmount,
        installmentAmount: inst.installmentAmount,
        totalInstallments: inst.totalInstallments,
        remainingInstallments: inst.remainingInstallments,
        remainingAmount: inst.remainingAmount,
        startDate: new Date(inst.startDate),
        endDate: inst.endDate ? new Date(inst.endDate) : null,
        creditCard: card ? {
          bank: card.bank,
          maskedNumber: '****',
        } : null
      }
    })

    // Combine both sources
    const allInstallments = [...detectedInstallments, ...normalizedManual]

    return NextResponse.json({ installments: allInstallments })
  } catch (error) {
    console.error('[Installments API] Error fetching installments:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch installments',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
