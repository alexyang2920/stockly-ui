import type { AuthResponse } from '../types/auth'
import type { BulkMarketDataSyncInput, BulkMarketDataSyncResult, MarketDataDatasetStatus } from '../types/admin'
import { apiRequest } from './client'

export function getMarketDataStatus(auth: AuthResponse, signal?: AbortSignal) {
  return apiRequest<MarketDataDatasetStatus[]>('/admin/market-data/status', { auth, signal })
}

export function syncMarketData(auth: AuthResponse, input: BulkMarketDataSyncInput) {
  return apiRequest<BulkMarketDataSyncResult>('/admin/market-data/sync', { method: 'POST', auth, body: input })
}
