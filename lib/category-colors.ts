// Category color mapping for consistent UI
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    food: {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-300',
        border: 'border-orange-500',
    },
    transport: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-500',
    },
    shopping: {
        bg: 'bg-pink-100 dark:bg-pink-900/30',
        text: 'text-pink-700 dark:text-pink-300',
        border: 'border-pink-500',
    },
    entertainment: {
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-500',
    },
    utilities: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-300',
        border: 'border-yellow-500',
    },
    subscription: {
        bg: 'bg-indigo-100 dark:bg-indigo-900/30',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-500',
    },
    transfer: {
        bg: 'bg-slate-100 dark:bg-slate-900/30',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-500',
    },
    uncategorized: {
        bg: 'bg-gray-100 dark:bg-gray-900/30',
        text: 'text-gray-700 dark:text-gray-300',
        border: 'border-gray-500',
    },
    healthcare: {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-500',
    },
    education: {
        bg: 'bg-teal-100 dark:bg-teal-900/30',
        text: 'text-teal-700 dark:text-teal-300',
        border: 'border-teal-500',
    },
    travel: {
        bg: 'bg-cyan-100 dark:bg-cyan-900/30',
        text: 'text-cyan-700 dark:text-cyan-300',
        border: 'border-cyan-500',
    },
    groceries: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-500',
    },
}

export const getCategoryColor = (category: string) => {
    const normalized = category?.toLowerCase() || 'uncategorized'
    return CATEGORY_COLORS[normalized] || CATEGORY_COLORS.uncategorized
}

// Chart colors for graphs (hex values)
export const CATEGORY_CHART_COLORS: Record<string, string> = {
    food: '#f97316',
    transport: '#3b82f6',
    shopping: '#ec4899',
    entertainment: '#a855f7',
    utilities: '#eab308',
    subscription: '#6366f1',
    transfer: '#64748b',
    uncategorized: '#9ca3af',
    healthcare: '#ef4444',
    education: '#14b8a6',
    travel: '#06b6d4',
    groceries: '#22c55e',
}

export const getCategoryChartColor = (category: string): string => {
    const normalized = category?.toLowerCase() || 'uncategorized'
    return CATEGORY_CHART_COLORS[normalized] || CATEGORY_CHART_COLORS.uncategorized
}
