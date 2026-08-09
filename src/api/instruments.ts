import type { AuthResponse } from '../types/auth'
import type { DividendEvent, FinancialFact, Instrument, InstrumentQuote, StockSplitEvent } from '../types/instrument'
import { apiRequest } from './client'

export type FinancialPeriod = 'ANNUAL' | 'QUARTERLY'

export function searchInstruments(query: string, signal?: AbortSignal) {
  return apiRequest<Instrument[]>(`/instruments?query=${encodeURIComponent(query)}`, { signal })
}

export function getInstrument(symbol: string, signal?: AbortSignal) {
  return apiRequest<Instrument>(`/instruments/${encodeURIComponent(symbol)}`, { signal })
}

export function getFinancials(symbol: string, period: FinancialPeriod, signal?: AbortSignal) {
  return apiRequest<FinancialFact[]>(`/instruments/${encodeURIComponent(symbol)}/financials?period=${period}`, { signal })
}

export function syncFinancials(auth: AuthResponse, symbol: string) {
  return apiRequest<{ symbol: string, factsImported: number }>(`/instruments/${encodeURIComponent(symbol)}/financials/sync`, { method: 'POST', auth })
}

export function getQuote(symbol: string, signal?: AbortSignal) {
  return apiRequest<InstrumentQuote>(`/instruments/${encodeURIComponent(symbol)}/quote`, { signal })
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
