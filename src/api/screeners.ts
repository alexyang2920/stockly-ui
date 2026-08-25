import type { AuthResponse } from '../types/auth'
import type { Screener, ScreenerInput, ScreenerResult } from '../types/screener'
import { apiRequest } from './client'

export const getScreeners = (auth: AuthResponse, signal?: AbortSignal) =>
  apiRequest<Screener[]>('/screeners', { auth, signal })
export const createScreener = (auth: AuthResponse, input: ScreenerInput) =>
  apiRequest<Screener>('/screeners', { method: 'POST', auth, body: input })
export const updateScreener = (auth: AuthResponse, id: string, input: ScreenerInput) =>
  apiRequest<Screener>(`/screeners/${id}`, { method: 'PUT', auth, body: input })
export const deleteScreener = (auth: AuthResponse, id: string) =>
  apiRequest<void>(`/screeners/${id}`, { method: 'DELETE', auth })
export const getScreenerResults = (auth: AuthResponse, id: string, signal?: AbortSignal) =>
  apiRequest<ScreenerResult[]>(`/screeners/${id}/results`, { auth, signal })
