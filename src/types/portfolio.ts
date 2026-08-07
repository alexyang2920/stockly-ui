export type Portfolio = {
  id: string
  name: string
  currency: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE' | 'DEPOSIT' | 'WITHDRAWAL'

export type PortfolioTransaction = {
  id: string
  portfolioId: string
  type: TransactionType
  symbol: string | null
  quantity: number | null
  price: number | null
  fees: number
  amount: number | null
  totalAmount: number | null
  currency: string
  executedAt: string
  notes: string | null
  clientRequestId: string | null
  createdAt: string
  updatedAt: string
}

export type Holding = {
  symbol: string
  name: string
  quantity: number
  averageCost: number
  costBasis: number
  realizedGain: number
  currency: string
  firstPurchasedAt: string
  lastTransactionAt: string
  marketPrice: number | null
  marketValue: number | null
  unrealizedGain: number | null
  unrealizedGainPercent: number | null
  quoteDate: string | null
}

export type DividendCalendarEvent = {
  symbol: string
  name: string
  calendarDate: string
  dateType: 'PAY_DATE' | 'EX_DIVIDEND'
  declarationDate: string | null
  exDividendDate: string
  recordDate: string | null
  payDate: string | null
  quantity: number
  amountPerShare: number
  projectedAmount: number
  currency: string
  frequency: number | null
  dividendType: string | null
}

export type PortfolioPerformance = {
  realizedGain: number
  currency: string
}

export type Page<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first?: boolean
  last?: boolean
}

export type CreatePortfolioInput = {
  name: string
  currency: string
  description?: string
}

export type TransactionInput = {
  type: TransactionType
  symbol?: string
  quantity?: number
  price?: number
  fees?: number
  amount?: number
  currency: string
  executedAt: string
  notes?: string
  clientRequestId?: string
}
