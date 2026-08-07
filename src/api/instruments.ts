import type { FinancialFact, FinancialRatios, Instrument } from '../types/instrument'
import { apiRequest } from './client'

export type FinancialPeriod = 'ANNUAL' | 'QUARTERLY'
export type RatioBasis = 'TTM' | 'ANNUAL' | 'QUARTERLY'

export function searchInstruments(query: string, signal?: AbortSignal) {
  return apiRequest<Instrument[]>(`/instruments?query=${encodeURIComponent(query)}`, { signal })
}

export function getInstrument(symbol: string, signal?: AbortSignal) {
  return apiRequest<Instrument>(`/instruments/${encodeURIComponent(symbol)}`, { signal })
}

export function getFinancials(symbol: string, period: FinancialPeriod, signal?: AbortSignal) {
  return apiRequest<FinancialFact[]>(`/instruments/${encodeURIComponent(symbol)}/financials?period=${period}`, { signal })
}

export function getRatios(symbol: string, basis: RatioBasis, signal?: AbortSignal) {
  return apiRequest<FinancialRatios>(`/instruments/${encodeURIComponent(symbol)}/ratios?basis=${basis}`, { signal })
}
