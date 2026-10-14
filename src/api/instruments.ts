import type { AuthResponse } from '../types/auth'
import type { DailyQuote, DividendEvent, Instrument, InstrumentQuote, StockSplitEvent } from '../types/instrument'
import { apiRequest } from './client'

export function searchInstruments(query: string, signal?: AbortSignal) {
  return apiRequest<Instrument[]>(`/instruments?query=${encodeURIComponent(query)}`, { signal })
}

export function getInstrument(symbol: string, signal?: AbortSignal) {
  return apiRequest<Instrument>(`/instruments/${encodeURIComponent(symbol)}`, { signal })
}

export function getQuote(symbol: string, signal?: AbortSignal) {
  return apiRequest<InstrumentQuote>(`/instruments/${encodeURIComponent(symbol)}/quote`, { signal })
}

export function getQuoteHistory(symbol: string, from: string, to: string, signal?: AbortSignal) {
  const parameters = new URLSearchParams({ from, to })
  return apiRequest<DailyQuote[]>(`/instruments/${encodeURIComponent(symbol)}/quotes/history?${parameters}`, { signal })
}

export type QuoteHistorySyncResult = {
  symbol: string
  from: string
  to: string
  recordsUpserted: number
  latestMarketDate: string | null
}

export function refreshQuoteHistory(auth: AuthResponse, symbol: string) {
  return apiRequest<QuoteHistorySyncResult>(`/instruments/${encodeURIComponent(symbol)}/quotes/history/refresh`, { method: 'POST', auth })
}

export function repairQuoteHistory(auth: AuthResponse, symbol: string, from: string, to: string) {
  const parameters = new URLSearchParams({ from, to })
  return apiRequest<QuoteHistorySyncResult>(`/instruments/${encodeURIComponent(symbol)}/quotes/history/sync-missing?${parameters}`, { method: 'POST', auth })
}

export function syncQuote(auth: AuthResponse, symbol: string) {
  return apiRequest<InstrumentQuote>(`/instruments/${encodeURIComponent(symbol)}/quote/sync`, { method: 'POST', auth })
}

export function getDividends(symbol: string, signal?: AbortSignal) {
  return apiRequest<DividendEvent[]>(`/instruments/${encodeURIComponent(symbol)}/dividends`, { signal })
}

export function syncDividends(auth: AuthResponse, symbol: string) {
  return apiRequest<DividendEvent[]>(`/instruments/${encodeURIComponent(symbol)}/dividends/sync`, { method: 'POST', auth })
}

export function getSplits(symbol: string, signal?: AbortSignal) {
  return apiRequest<StockSplitEvent[]>(`/instruments/${encodeURIComponent(symbol)}/splits`, { signal })
}

export function syncSplits(auth: AuthResponse, symbol: string) {
  return apiRequest<StockSplitEvent[]>(`/instruments/${encodeURIComponent(symbol)}/splits/sync`, { method: 'POST', auth })
}
