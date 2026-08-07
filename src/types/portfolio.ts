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
