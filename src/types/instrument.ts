export type Instrument = {
  symbol: string
  name: string
  exchange: string
  instrumentType: 'STOCK' | 'ETF'
  sector?: string | null
  industry?: string | null
  sicCode?: string | null
  sicDescription?: string | null
  classificationSource?: string | null
  cik?: string | null
  price?: number
  change?: number
}

export type FinancialFact = {
  metric: string
  statementType: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW'
  periodType: 'ANNUAL' | 'QUARTERLY'
  fiscalYear: number
  fiscalPeriod: string
  periodStart: string | null
  periodEnd: string
  value: number
  unit: string
  filedAt: string
}

export type InstrumentQuote = {
  symbol: string
  price: number
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
  currency: string
  marketDate: string
  provider: string
  fetchedAt: string
}

export type DividendEvent = {
  symbol: string
  declarationDate: string | null
  exDividendDate: string
  recordDate: string | null
  payDate: string | null
  cashAmount: number
  splitAdjustedCashAmount: number | null
  currency: string
  frequency: number | null
  dividendType: string | null
}

export type StockSplitEvent = {
  id: string
  symbol: string
  executionDate: string
  adjustmentType: 'forward_split' | 'reverse_split' | 'stock_dividend' | string
  splitFrom: number
  splitTo: number
  historicalAdjustmentFactor: number | null
}

export type Watchlist = {
  id: string
  name: string
  createdAt: string
  instruments: Instrument[]
}
