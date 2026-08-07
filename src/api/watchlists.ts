import type { AuthResponse } from '../types/auth'
import type { Watchlist } from '../types/instrument'
import { apiRequest } from './client'

export function getWatchlists(auth: AuthResponse, signal?: AbortSignal) {
  return apiRequest<Watchlist[]>('/watchlists', { auth, signal })
}

export function createWatchlist(auth: AuthResponse, name: string) {
  return apiRequest<Watchlist>('/watchlists', { method: 'POST', auth, body: { name } })
}

export function deleteWatchlist(auth: AuthResponse, watchlistId: string) {
  return apiRequest<void>(`/watchlists/${watchlistId}`, { method: 'DELETE', auth })
}

export function addWatchlistInstrument(auth: AuthResponse, watchlistId: string, symbol: string) {
  return apiRequest<Watchlist>(`/watchlists/${watchlistId}/instruments`, { method: 'POST', auth, body: { symbol } })
}

export function removeWatchlistInstrument(auth: AuthResponse, watchlistId: string, symbol: string) {
  return apiRequest<void>(`/watchlists/${watchlistId}/instruments/${encodeURIComponent(symbol)}`, { method: 'DELETE', auth })
}
