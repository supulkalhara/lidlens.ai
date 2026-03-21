/**
 * Category classification for transactions
 * Based on merchant names and descriptions
 */

export type TransactionCategory =
  | 'Food Delivery'
  | 'Ride Sharing'
  | 'Restaurants'
  | 'Groceries'
  | 'Shopping'
  | 'Bills & Utilities'
  | 'Fuel'
  | 'Entertainment'
  | 'Streaming'
  | 'Digital Services'
  | 'Healthcare'
  | 'Education'
  | 'Travel & Hotels'
  | 'Insurance'
  | 'Banking & Finance'
  | 'Electronics'
  | 'Furniture'
  | 'Clothing & Fashion'
  | 'Personal Care'
  | 'Transfers'
  | 'Installments'
  | 'Vehicle & Parking'
  | 'Transportation'
  | 'Other'

export interface CategoryRule {
  keywords: string[]
  category: TransactionCategory
  priority: number // Higher priority rules are checked first
}

// Rules ordered by priority (most specific first)
const categoryRules: CategoryRule[] = [
  // Food Delivery - very specific, highest priority
  {
    keywords: ['uber eats', 'ubereats'],
    category: 'Food Delivery',
    priority: 100,
  },
  {
    keywords: ['pickme food', 'pickmefood'],
    category: 'Food Delivery',
    priority: 100,
  },
  {
    keywords: ['foodpanda', 'food panda'],
    category: 'Food Delivery',
    priority: 100,
  },
  {
    keywords: ['dominos', 'pizza hut delivery', 'kfc delivery', 'mcdelivery', 'deliveroo'],
    category: 'Food Delivery',
    priority: 95,
  },
  
  // Ride Sharing - very specific, highest priority (but NOT grab and go)
  {
    keywords: ['pickme ride', 'pickme.lk', 'www.p'],
    category: 'Ride Sharing',
    priority: 100,
  },
  {
    keywords: ['uber trip', 'uber ride', 'uber bv'],
    category: 'Ride Sharing',
    priority: 100,
  },
  {
    keywords: ['yogo', 'kangaroo cabs', 'kangaroocabs', 'bolt'],
    category: 'Ride Sharing',
    priority: 95,
  },
  
  // Vehicle & Parking - new category
  {
    keywords: ['car park', 'parking'],
    category: 'Vehicle & Parking',
    priority: 95,
  },
  {
    keywords: ['hiran motor', 'motor traders', 'vehicle service', 'auto service'],
    category: 'Vehicle & Parking',
    priority: 90,
  },
  
  // Transportation
  {
    keywords: ['department of railway', 'railway', 'train ticket', 'bus ticket'],
    category: 'Transportation',
    priority: 90,
  },
  
  // Streaming Services - specific
  {
    keywords: ['netflix'],
    category: 'Streaming',
    priority: 95,
  },
  {
    keywords: ['spotify'],
    category: 'Streaming',
    priority: 95,
  },
  {
    keywords: ['youtube premium', 'youtubepremium'],
    category: 'Streaming',
    priority: 95,
  },
  {
    keywords: ['disney+', 'disney plus', 'disneyplus'],
    category: 'Streaming',
    priority: 95,
  },
  {
    keywords: ['amazon prime', 'prime video'],
    category: 'Streaming',
    priority: 95,
  },
  {
    keywords: ['hbo max', 'hbo'],
    category: 'Streaming',
    priority: 95,
  },
  {
    keywords: ['apple tv', 'appletv'],
    category: 'Streaming',
    priority: 95,
  },
  
  // Digital Services
  {
    keywords: ['apple.com/bill', 'apple.com bill', 'itunes', 'app store'],
    category: 'Digital Services',
    priority: 90,
  },
  {
    keywords: ['google play', 'google one', 'google storage'],
    category: 'Digital Services',
    priority: 90,
  },
  {
    keywords: ['icloud', 'icloud+'],
    category: 'Digital Services',
    priority: 90,
  },
  {
    keywords: ['microsoft', 'office 365', 'xbox'],
    category: 'Digital Services',
    priority: 90,
  },
  {
    keywords: ['adobe', 'creative cloud'],
    category: 'Digital Services',
    priority: 90,
  },
  {
    keywords: ['dropbox', 'onedrive'],
    category: 'Digital Services',
    priority: 90,
  },
  
  // Installments - HNB format and others
  {
    keywords: ['instalment principle', 'instalment', 'installment'],
    category: 'Installments',
    priority: 92,
  },
  {
    keywords: ['epp', 'emi', 'easy pay', 'flexi pay'],
    category: 'Installments',
    priority: 88,
  },
  
  // Furniture - specific stores
  {
    keywords: ['asian group of compani', 'asian group'],
    category: 'Furniture',
    priority: 90,
  },
  {
    keywords: ['damro', 'damro-epp'],
    category: 'Furniture',
    priority: 90,
  },
  {
    keywords: ['arpico showroom', 'arpico furniture'],
    category: 'Furniture',
    priority: 90,
  },
  {
    keywords: ['furniture', 'home center', 'softlogic furniture'],
    category: 'Furniture',
    priority: 80,
  },
  
  // Food & Restaurants - specific places
  {
    keywords: ['grab and go', 'grab & go'],
    category: 'Restaurants',
    priority: 92,
  },
  {
    keywords: ['almond break'],
    category: 'Restaurants',
    priority: 92,
  },
  {
    keywords: ['chola hospitalities', 'chola'],
    category: 'Restaurants',
    priority: 92,
  },
  {
    keywords: ['food studio'],
    category: 'Restaurants',
    priority: 92,
  },
  {
    keywords: ['flower drum'],
    category: 'Restaurants',
    priority: 90,
  },
  {
    keywords: ['kottu', 'mr kottu'],
    category: 'Restaurants',
    priority: 85,
  },
  {
    keywords: ['hotel de', 'new hotel', 'grand hotel'],
    category: 'Restaurants',
    priority: 85,
  },
  {
    keywords: ['restaurant', 'cafe', 'bistro', 'dinemore', 'dining'],
    category: 'Restaurants',
    priority: 75,
  },
  {
    keywords: ['coffee', 'starbucks', 'java', 'barista', 'coffee bean'],
    category: 'Restaurants',
    priority: 75,
  },
  {
    keywords: ['kfc', 'mcdonalds', 'burger king', 'pizza', 'subway', 'taco bell'],
    category: 'Restaurants',
    priority: 75,
  },
  
  // Clothing & Fashion - specific stores
  {
    keywords: ['cool planet', 'coolplanet'],
    category: 'Clothing & Fashion',
    priority: 90,
  },
  {
    keywords: ['miniso', 'minigood'],
    category: 'Shopping',
    priority: 88,
  },
  {
    keywords: ['jia moda'],
    category: 'Clothing & Fashion',
    priority: 90,
  },
  {
    keywords: ['odel', 'fashion bug', 'cotton collection', 'nolimit'],
    category: 'Clothing & Fashion',
    priority: 85,
  },
  {
    keywords: ['clothing', 'fashion', 'apparel', 'dress', 'shoes'],
    category: 'Clothing & Fashion',
    priority: 70,
  },
  
  // Groceries - supermarkets (more specific patterns)
  {
    keywords: ['keells super', 'keells-', 'keells ', 'keells super -'],
    category: 'Groceries',
    priority: 90,
  },
  {
    keywords: ['cargills', 'cargill', 'cargills food city'],
    category: 'Groceries',
    priority: 90,
  },
  {
    keywords: ['arpico super', 'arpico superstore', 'arpico'],
    category: 'Groceries',
    priority: 90,
  },
  {
    keywords: ['laugfs super', 'food city', 'foodcity', 'spar', 'spar supermarket'],
    category: 'Groceries',
    priority: 88,
  },
  {
    keywords: ['glomar', 'glomar supermarket', 'glomar food city'],
    category: 'Groceries',
    priority: 88,
  },
  {
    keywords: ['kfc express', 'kfc takeaway', 'kfc drive'],
    category: 'Restaurants',
    priority: 85,
  },
  {
    keywords: ['pizza hut', 'dominos', 'papa johns', 'pizza corner'],
    category: 'Restaurants',
    priority: 85,
  },
  {
    keywords: ['mcdonalds', 'mcd', 'burger king', 'wendys'],
    category: 'Restaurants',
    priority: 85,
  },
  {
    keywords: ['supermarket', 'super market', 'grocery', 'fresh produce', 'farm fresh', 'market'],
    category: 'Groceries',
    priority: 75,
  },
  {
    keywords: ['bakery', 'bread talk', 'cargills bakery', 'keells bakery'],
    category: 'Groceries',
    priority: 80,
  },
  {
    keywords: ['meat', 'butcher', 'fish market', 'seafood'],
    category: 'Groceries',
    priority: 80,
  },
  
  // Fuel
  {
    keywords: ['ceypetco', 'ceylon petroleum'],
    category: 'Fuel',
    priority: 85,
  },
  {
    keywords: ['indian oil', 'ioc', 'lanka ioc'],
    category: 'Fuel',
    priority: 85,
  },
  {
    keywords: ['city oil', 'sinopec', 'laugfs fuel'],
    category: 'Fuel',
    priority: 85,
  },
  {
    keywords: ['petrol', 'diesel', 'fuel station', 'filling station', 'gas station'],
    category: 'Fuel',
    priority: 75,
  },
  
  // Electronics & Appliances
  {
    keywords: ['singer', 'singer ipg'],
    category: 'Electronics',
    priority: 85,
  },
  {
    keywords: ['abans', 'softlogic', 'tech brands'],
    category: 'Electronics',
    priority: 85,
  },
  {
    keywords: ['apple store', 'samsung', 'huawei', 'dialog axiata'],
    category: 'Electronics',
    priority: 80,
  },
  
  // Travel & Hotels
  {
    keywords: ['hotel', 'resort', 'booking.com', 'agoda', 'airbnb'],
    category: 'Travel & Hotels',
    priority: 80,
  },
  {
    keywords: ['srilankan airlines', 'emirates', 'qatar airways', 'flight'],
    category: 'Travel & Hotels',
    priority: 80,
  },
  {
    keywords: ['travel', 'ticket', 'visa fee', 'passport', 'airport'],
    category: 'Travel & Hotels',
    priority: 70,
  },
  
  // Entertainment
  {
    keywords: ['cinema', 'movie', 'theater', 'scope cinemas', 'pvr', 'imax'],
    category: 'Entertainment',
    priority: 80,
  },
  {
    keywords: ['concert', 'event', 'show'],
    category: 'Entertainment',
    priority: 70,
  },
  
  // Shopping
  {
    keywords: ['mall', 'retail', 'showroom', 'store'],
    category: 'Shopping',
    priority: 60,
  },
  
  // Bills & Utilities
  {
    keywords: ['electricity', 'ceb', 'leco', 'lanka electricity'],
    category: 'Bills & Utilities',
    priority: 80,
  },
  {
    keywords: ['water board', 'nwsdb', 'water supply'],
    category: 'Bills & Utilities',
    priority: 80,
  },
  {
    keywords: ['dialog', 'mobitel', 'airtel', 'hutch', 'slt', 'fibre'],
    category: 'Bills & Utilities',
    priority: 80,
  },
  {
    keywords: ['bill payment', 'internet', 'broadband', 'utility'],
    category: 'Bills & Utilities',
    priority: 70,
  },
  
  // Healthcare
  {
    keywords: ['hospital', 'nawaloka', 'asiri', 'durdans', 'lanka hospital'],
    category: 'Healthcare',
    priority: 80,
  },
  {
    keywords: ['clinic', 'pharmacy', 'medical', 'doctor', 'lab', 'medicine'],
    category: 'Healthcare',
    priority: 75,
  },
  
  // Education
  {
    keywords: ['school', 'university', 'college', 'tuition', 'course', 'academy', 'institute'],
    category: 'Education',
    priority: 80,
  },
  
  // Insurance
  {
    keywords: ['insurance', 'ceylinco', 'aia', 'allianz', 'union assurance', 'janashakthi'],
    category: 'Insurance',
    priority: 80,
  },
  {
    keywords: ['premium', 'policy'],
    category: 'Insurance',
    priority: 65,
  },
  
  // Banking & Finance
  {
    keywords: ['interest charge', 'late payment fee', 'stamp duty', 'annual fee', 'over limit fee'],
    category: 'Banking & Finance',
    priority: 85,
  },
  {
    keywords: ['bank', 'atm', 'withdrawal', 'loan payment'],
    category: 'Banking & Finance',
    priority: 70,
  },
  
  // Transfers & Payments
  {
    keywords: ['payment received', 'thank you', 'transfer', 'refund', 'reversal'],
    category: 'Transfers',
    priority: 85,
  },
  {
    keywords: ['cashback', 'reward', 'bonus'],
    category: 'Transfers',
    priority: 80,
  },
  
  // Personal Care
  {
    keywords: ['salon', 'spa', 'beauty', 'cosmetics', 'hair', 'nail'],
    category: 'Personal Care',
    priority: 75,
  },
]

// Sort rules by priority (highest first)
const sortedRules = [...categoryRules].sort((a, b) => b.priority - a.priority)

/**
 * Classify a transaction into a category based on description and merchant
 */
export function classifyTransaction(
  description: string,
  merchant?: string
): TransactionCategory {
  const searchText = `${description} ${merchant || ''}`.toLowerCase()

  for (const rule of sortedRules) {
    if (rule.keywords.some((keyword) => searchText.includes(keyword.toLowerCase()))) {
      return rule.category
    }
  }

  return 'Other'
}

/**
 * Get category color for charts
 */
export function getCategoryColor(category: TransactionCategory): string {
  const colors: Record<TransactionCategory, string> = {
    'Food Delivery': '#EF4444',      // Red
    'Ride Sharing': '#F97316',       // Orange
    'Restaurants': '#F59E0B',        // Amber
    'Groceries': '#84CC16',          // Lime
    'Shopping': '#8B5CF6',           // Purple
    'Bills & Utilities': '#3B82F6',  // Blue
    'Fuel': '#EA580C',               // Deep Orange
    'Entertainment': '#EC4899',      // Pink
    'Streaming': '#A855F7',          // Violet
    'Digital Services': '#7C3AED',   // Purple
    'Healthcare': '#10B981',         // Emerald
    'Education': '#6366F1',          // Indigo
    'Travel & Hotels': '#14B8A6',    // Teal
    'Insurance': '#0EA5E9',          // Sky
    'Banking & Finance': '#64748B',  // Slate
    'Electronics': '#0891B2',        // Cyan
    'Furniture': '#65A30D',          // Green
    'Clothing & Fashion': '#D946EF', // Fuchsia
    'Personal Care': '#F472B6',      // Light Pink
    'Transfers': '#22C55E',          // Green (positive)
    'Installments': '#F59E0B',       // Amber
    'Vehicle & Parking': '#78716C',  // Stone
    'Transportation': '#0284C7',     // Light Blue
    'Other': '#94A3B8',              // Gray
  }
  return colors[category] || '#94A3B8'
}
