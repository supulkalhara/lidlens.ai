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
    sourceFile?: string
}

export interface CardSummary {
    id: string
    name: string
    bank: string
    limit: number // Derived or defaulted
    usedAmount: number
    availableCredit: number
    statements?: any[]
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
            const m = file.match(/^([A-Za-z]+)_(\d{4})-(\d{2})_/)
            let cardId = 'unknown_card'
            let cardName = 'Unknown Card'
            let bank = 'Unknown'
            let stmtYear = 2026
            let stmtMonth = 1

            if (m) {
                bank = m[1]
                stmtYear = parseInt(m[2], 10)
                stmtMonth = parseInt(m[3], 10)
                // Use a generic card ID based on bank for now, or extract from rest of filename
                cardId = bank.toLowerCase()
                cardName = toTitleCase(bank) + ' Credit Card'
            } else {
                const parts = file.split('_')
                let cardNameParts: string[] = []
                for (const part of parts) {
                    if (['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].includes(part.toLowerCase())) {
                        break
                    }
                    cardNameParts.push(part)
                }
                cardId = cardNameParts.join('_')
                cardName = toTitleCase(cardId)
                bank = toTitleCase(cardNameParts[0] || 'Unknown')
            }

            // Update Card Map
            if (!cardMap.has(cardId)) {
                cardMap.set(cardId, {
                    id: cardId,
                    name: cardName,
                    bank: bank,
                    limit: (cardName.toLowerCase().includes('dfcc') && cardName.toLowerCase().includes('platinum')) ? 100000 : 500000,
                    usedAmount: 0,
                    availableCredit: 0,
                    statements: []
                })
            }
            
            const card = cardMap.get(cardId)!
            card.statements!.push({
                id: file,
                pdfPath: file.replace('.json', '.pdf'),
                statementPeriod: `${stmtYear}-${stmtMonth.toString().padStart(2, '0')}-01 To ${stmtYear}-${stmtMonth.toString().padStart(2, '0')}-28`, // Fake period to match regex
                closingBalance: 0
            })

            // Read File
            const filePath = join(STRUCTURED_DATA_DIR, file)
            const content = await readFile(filePath, 'utf-8')
            const fileData = JSON.parse(content) as any[] // Expecting array of transactions

            // Process Transactions
            fileData.forEach((tx, idx) => {
                // Generate a stable-ish ID
                const txId = `${file}-${idx}`

                let parsedDate = new Date(tx.transaction_date)
                if (!isNaN(parsedDate.getTime())) {
                    // Fix year hallucination from statement parsing
                    const txMonth = parsedDate.getMonth() + 1 // 1-12
                    let actualYear = stmtYear
                    
                    // If statement is early in the year (Jan, Feb, Mar) but tx is late in the year (Oct, Nov, Dec),
                    // the transaction almost certainly happened in the previous year.
                    if (stmtMonth <= 3 && txMonth >= 10) {
                        actualYear -= 1
                    } else if (stmtMonth >= 10 && txMonth <= 3) {
                        // Very rare: statement in Dec, but transaction in Jan of next year (if statement covers up to early Jan)
                        actualYear += 1
                    }
                    
                    parsedDate.setFullYear(actualYear)
                    
                    // Cap to current date to prevent future dates from bugs
                    if (parsedDate > new Date()) {
                        parsedDate.setFullYear(actualYear - 1)
                    }
                }
                const date = (isNaN(parsedDate.getTime()) ? new Date(tx.transaction_date) : parsedDate).toISOString()

                transactions.push({
                    id: txId,
                    date: date,
                    description: tx.description,
                    amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount)) || 0,
                    currency: tx.currency,
                    type: tx.direction?.toLowerCase() === 'credit' ? 'credit' : 'debit',
                    category: tx.category || 'uncategorized',
                    isInstallment: tx.is_installment,
                    installmentPaid: tx.installment_paid,
                    installmentTotal: tx.installment_total,
                    cardId: cardId,
                    sourceFile: file.replace('.json', '.csv')
                })

                // Aggregate usage
                if (card) {
                    const amt = typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount)) || 0;
                    if (tx.direction === 'debit' || tx.direction === 'Credit' || tx.direction === 'Debit') {
                         if (tx.direction.toLowerCase() === 'debit') {
                             card.usedAmount += amt
                         } else {
                             card.usedAmount -= amt
                         }
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
