export type ScreenerFilters = {
  instrumentType: 'STOCK' | 'ETF' | null
  minimumPrice: number | null
  maximumPrice: number | null
  minimumDrawdownPercent: number | null
  minimumRsi: number | null
  maximumRsi: number | null
  maximumDailyReturnPercent: number | null
  maximumFiveDayReturnPercent: number | null
  minimumPriceVsSma200Percent: number | null
  maximumPriceVsSma50Percent: number | null
  drawdownSinceDate: string | null
  maximumDrawdownSinceDatePercent: number | null
  resultLimit: number
}

export type Screener = {
  id: string
  name: string
  filters: ScreenerFilters
  createdAt: string
  updatedAt: string
}

export type ScreenerInput = { name: string, filters: ScreenerFilters }

export type ScreenerResult = {
  symbol: string
  name: string
  instrumentType: 'STOCK' | 'ETF'
  marketDate: string
  price: number
  drawdownPercent: number
  rsi14: number
  dailyReturnPercent: number
  fiveDayReturnPercent: number
  twentyDayReturnPercent: number | null
  sma50: number | null
  sma200: number | null
  priceVsSma50Percent: number | null
  priceVsSma200Percent: number | null
  drawdownSinceDatePercent: number | null
}
