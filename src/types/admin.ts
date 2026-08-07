export type MarketDataDatasetStatus = {
  dataset: 'QUOTES' | 'DIVIDENDS' | 'SPLITS'
  lastSuccessfulAt: string | null
  watermarkDate: string | null
  recordsProcessed: number
  message: string
  status: 'NEVER' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'
  requestedFrom: string | null
  pagesProcessed: number
  resumable: boolean
  lastError: string | null
}

export type BulkMarketDataSyncInput = {
  quotes: boolean
  dividends: boolean
  splits: boolean
  marketDate?: string
  corporateActionsFrom?: string
}

export type BulkMarketDataSyncResult = {
  startedAt: string
  completedAt: string
  instrumentsAvailable: number
  datasets: MarketDataDatasetStatus[]
}
