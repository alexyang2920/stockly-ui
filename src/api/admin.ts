import type { AuthResponse } from '../types/auth'
import type { AutomatedSyncStatus, ClassificationSyncResult, InstrumentCatalogSyncResult, MarketDataDatasetStatus } from '../types/admin'
import { apiRequest } from './client'

export function getMarketDataStatus(auth: AuthResponse, signal?: AbortSignal) {
  return apiRequest<MarketDataDatasetStatus[]>('/admin/market-data/status', { auth, signal })
}

export function getAutomatedSyncStatus(auth: AuthResponse, signal?: AbortSignal) {
  return apiRequest<AutomatedSyncStatus[]>('/admin/automated-sync/status', { auth, signal })
}

export function syncDailyQuotes(auth: AuthResponse, marketDate?: string) {
  return apiRequest<MarketDataDatasetStatus>('/admin/market-data/quotes/sync', { method: 'POST', auth, body: { marketDate } })
}

export function syncStockSplits(auth: AuthResponse, fromDate?: string) {
  return apiRequest<MarketDataDatasetStatus>('/admin/market-data/splits/sync', { method: 'POST', auth, body: { fromDate } })
}

export function syncDividends(auth: AuthResponse, fromDate: string | undefined, restart: boolean) {
  return apiRequest<MarketDataDatasetStatus>('/admin/market-data/dividends/sync', { method: 'POST', auth, body: { fromDate, restart } })
}

export function syncCompanyClassifications(auth: AuthResponse, limit: number) {
  return apiRequest<ClassificationSyncResult>(`/instruments/classifications/sync?limit=${limit}`, { method: 'POST', auth })
}

export function syncInstrumentCatalog(auth: AuthResponse) {
  return apiRequest<InstrumentCatalogSyncResult>('/instruments/sync', { method: 'POST', auth })
}
