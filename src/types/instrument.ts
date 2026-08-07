export type Instrument = {
  symbol: string
  name: string
  exchange: string
  category: string
  instrumentType: 'STOCK' | 'ETF'
  cik?: string | null
  price?: number
  change?: number
}

export type FinancialFact = {
  metric: string
  periodType: 'ANNUAL' | 'QUARTERLY'
  fiscalYear: number
  fiscalPeriod: string
  periodStart: string | null
  periodEnd: string
  value: number
  unit: string
  filedAt: string
}

export type FinancialRatios = {
  symbol: string
  basis: 'ANNUAL' | 'QUARTERLY' | 'TTM'
  asOfDate: string
  sourcePeriods: string[]
  ratios: Record<string, number>
}

export type Watchlist = {
  id: string
  name: string
  createdAt: string
  instruments: Instrument[]
}
