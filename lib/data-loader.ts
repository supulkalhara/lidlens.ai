import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { format } from 'date-fns'

// Configuration — reads from env or defaults to project-local data directory
const STRUCTURED_DATA_DIR = process.env.STATEMENTS_DIR || join(process.cwd(), 'data', 'card_statements_structured')
const MANUAL_DATA_FILE = join(process.cwd(), 'data', 'manual_data.json')

// Interfaces
export interface Transaction {
    id: string
    date: string
    description: string
    amount: number
    currency: string
    type: 'debit' | 'credit'
    category: string
    isInstallment: boolean
    installmentPaid?: number | null
    installmentTotal?: number | null
    cardId: string
}

export interface CardSummary {
    id: string
    name: string
    bank: string
    limit: number // Derived or defaulted
    usedAmount: number
    availableCredit: number
}

export interface Account {
    id: string
    bank: string
    accountNumber: string
    currentBalance: number
    accountType: string
    currency: string
}

export interface Loan {
    id: string
    bank: string
    type: string
    principal: number
    outstandingBalance: number
    interestRate: number
    monthlyPayment: number
}

// Helpers
const toTitleCase = (str: string) => {
    return str.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
}

export interface Installment {
    id: string
    description: string
    totalAmount: number
    installmentAmount: number
    totalInstallments: number
    remainingInstallments: number
    remainingAmount: number | null
    startDate: string
    endDate: string | null
    cardId: string // Link to card
}

export interface Income {
    id: string
    source: string
    amount: number
    currency: string
    day: number
    frequency: 'monthly' | 'weekly' | 'yearly'
}

export interface CategoryLimits {
    [category: string]: number | null
}

export interface ManualData {
    accounts: Account[]
    loans: Loan[]
    installments: Installment[]
    income: Income[]
    categoryLimits: CategoryLimits
    subscriptions?: any[] // Add subscriptions support
}

// Data Loaders

export async function loadManualData(): Promise<ManualData> {
    try {
        const raw = await readFile(MANUAL_DATA_FILE, 'utf-8')
        const data = JSON.parse(raw)
        return {
            accounts: data.accounts || [],
            loans: data.loans || [],
            installments: data.installments || [],
            income: data.income || [],
            categoryLimits: data.categoryLimits || {},
            subscriptions: data.subscriptions || [], // Load subscriptions
        }
    } catch (error) {
        console.error('Error loading manual data:', error)
        return { accounts: [], loans: [], installments: [], income: [], categoryLimits: {}, subscriptions: [] }
    }
}

export async function loadStructuredTransactions(): Promise<{ transactions: Transaction[], cards: CardSummary[] }> {
    const transactions: Transaction[] = []
    const cardMap = new Map<string, CardSummary>()

    try {
        const files = await readdir(STRUCTURED_DATA_DIR)
        const jsonFiles = files.filter(f => f.endsWith('.json'))

        for (const file of jsonFiles) {
            // Identity Card from filename
            // e.g. "commercial_platinum_november_2025_unlocked.json" -> "commercial_platinum"
            const parts = file.split('_')
            let cardNameParts: string[] = []
            for (const part of parts) {
                if (['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].includes(part.toLowerCase())) {
                    break
                }
                cardNameParts.push(part)
            }
            const cardId = cardNameParts.join('_')
            const cardName = toTitleCase(cardId)

            // Update Card Map
            if (!cardMap.has(cardId)) {
                cardMap.set(cardId, {
                    id: cardId,
                    name: cardName,
                    bank: toTitleCase(cardNameParts[0]), // Simple heuristic
                    limit: (cardName.toLowerCase().includes('dfcc') && cardName.toLowerCase().includes('platinum')) ? 100000 : 500000,
                    usedAmount: 0,
                    availableCredit: 0
                })
            }

            // Read File
            const filePath = join(STRUCTURED_DATA_DIR, file)
            const content = await readFile(filePath, 'utf-8')
            const fileData = JSON.parse(content) as any[] // Expecting array of transactions

            // Process Transactions
            fileData.forEach((tx, idx) => {
                // Generate a stable-ish ID
                const txId = `${file}-${idx}`

                // Parse Date
                // Input format example: "25 Nov 2024"
                const date = new Date(tx.transaction_date).toISOString()

                transactions.push({
                    id: txId,
                    date: date,
                    description: tx.description,
                    amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount)) || 0,
                    currency: tx.currency,
                    type: tx.direction,
                    category: tx.category || 'uncategorized',
                    isInstallment: tx.is_installment,
                    installmentPaid: tx.installment_paid,
                    installmentTotal: tx.installment_total,
                    cardId: cardId
                })

                // Aggregate usage
                const card = cardMap.get(cardId)
                if (card) {
                    if (tx.direction === 'debit') {
                        card.usedAmount += typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount)) || 0
                    } else if (tx.direction === 'credit') {
                        card.usedAmount -= typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount)) || 0
                    }
                }
            })
        }
    } catch (error) {
        console.error('Error loading structured transactions:', error)
    }

    // Calculate distinct "Total used" based on latest month? 
    // For now, returning cards with 0 usage logic as requested "remove unwanted logics"
    // The user can see transactions in the list.

    return {
        transactions,
        cards: Array.from(cardMap.values())
    }
}
