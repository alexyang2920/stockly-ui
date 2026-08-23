import type { AuthResponse } from '../types/auth'
import type { CreatePortfolioInput, DividendCalendarEvent, FidelityImportResult, Holding, Page, Portfolio, PortfolioPerformance, PortfolioTransaction, TransactionInput, TransactionType } from '../types/portfolio'
import { apiRequest } from './client'

export function getPortfolios(auth: AuthResponse, signal?: AbortSignal) {
  return apiRequest<Portfolio[]>('/portfolios', { auth, signal })
}

export function createPortfolio(auth: AuthResponse, input: CreatePortfolioInput) {
  return apiRequest<Portfolio>('/portfolios', { method: 'POST', auth, body: input })
}

export function updatePortfolio(auth: AuthResponse, portfolioId: string, input: Pick<CreatePortfolioInput, 'name' | 'description'>) {
  return apiRequest<Portfolio>(`/portfolios/${portfolioId}`, { method: 'PATCH', auth, body: input })
}

export function deletePortfolio(auth: AuthResponse, portfolioId: string, force = false) {
  return apiRequest<void>(`/portfolios/${portfolioId}${force ? '?force=true' : ''}`, { method: 'DELETE', auth })
}

export function getHoldings(auth: AuthResponse, portfolioId: string, signal?: AbortSignal) {
  return apiRequest<Holding[]>(`/portfolios/${portfolioId}/holdings`, { auth, signal })
}

export function getPortfolioPerformance(auth: AuthResponse, portfolioId: string, signal?: AbortSignal) {
  return apiRequest<PortfolioPerformance>(`/portfolios/${portfolioId}/performance`, { auth, signal })
}

export function getDividendCalendar(auth: AuthResponse, portfolioId: string, from: string, to: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ from, to })
  return apiRequest<DividendCalendarEvent[]>(`/portfolios/${portfolioId}/dividend-calendar?${params}`, { auth, signal })
}

export function getTransactions(auth: AuthResponse, portfolioId: string, filters: { symbol?: string, type?: TransactionType | '', page?: number, size?: number } = {}, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(filters.page ?? 0), size: String(filters.size ?? 50) })
  if (filters.symbol) params.set('symbol', filters.symbol)
  if (filters.type) params.set('type', filters.type)
  return apiRequest<Page<PortfolioTransaction>>(`/portfolios/${portfolioId}/transactions?${params}`, { auth, signal })
}

export function createTransaction(auth: AuthResponse, portfolioId: string, input: TransactionInput) {
  return apiRequest<PortfolioTransaction>(`/portfolios/${portfolioId}/transactions`, { method: 'POST', auth, body: input })
}

export function updateTransaction(auth: AuthResponse, portfolioId: string, transactionId: string, input: TransactionInput) {
  return apiRequest<PortfolioTransaction>(`/portfolios/${portfolioId}/transactions/${transactionId}`, { method: 'PATCH', auth, body: input })
}

export function deleteTransaction(auth: AuthResponse, portfolioId: string, transactionId: string) {
  return apiRequest<void>(`/portfolios/${portfolioId}/transactions/${transactionId}`, { method: 'DELETE', auth })
}

export function importFidelityActivity(auth: AuthResponse, portfolioId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<FidelityImportResult>(`/portfolios/${portfolioId}/transactions/import/fidelity`, {
    method: 'POST', auth, body: form,
  })
}
