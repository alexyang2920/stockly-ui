import type { AuthResponse } from '../types/auth'
import { apiRequest } from './client'

export type UserPreferences = { darkMode: boolean, selectedPortfolioId: string | null }

export function getUserPreferences(auth: AuthResponse, signal?: AbortSignal) {
  return apiRequest<UserPreferences>('/users/me/preferences', { auth, signal })
}

export function updateUserPreferences(auth: AuthResponse, preferences: UserPreferences) {
  return apiRequest<UserPreferences>('/users/me/preferences', { method: 'PATCH', auth, body: preferences })
}
