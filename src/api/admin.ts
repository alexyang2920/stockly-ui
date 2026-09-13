import type { AuthResponse } from '../types/auth'
import type { AutomatedSyncStatus, BulkMarketDataSyncInput, BulkMarketDataSyncResult, ClassificationSyncResult, InstrumentCatalogSyncResult, MarketDataDatasetStatus } from '../types/admin'
import { apiRequest } from './client'

export function getMarketDataStatus(auth: AuthResponse, signal?: AbortSignal) {
  return apiRequest<MarketDataDatasetStatus[]>('/admin/market-data/status', { auth, signal })
}

export function getAutomatedSyncStatus(auth: AuthResponse, signal?: AbortSignal) {
  return apiRequest<AutomatedSyncStatus[]>('/admin/automated-sync/status', { auth, signal })
}

export function syncMarketData(auth: AuthResponse, input: BulkMarketDataSyncInput) {
  return apiRequest<BulkMarketDataSyncResult>('/admin/market-data/sync', { method: 'POST', auth, body: input })
}

export function syncCompanyClassifications(auth: AuthResponse, limit: number) {
  return apiRequest<ClassificationSyncResult>(`/instruments/classifications/sync?limit=${limit}`, { method: 'POST', auth })
}

export function syncInstrumentCatalog(auth: AuthResponse) {
  return apiRequest<InstrumentCatalogSyncResult>('/instruments/sync', { method: 'POST', auth })
}
