import type { AuthResponse, LoginRequest, RegisterRequest } from '../types/auth'
import { apiRequest } from './client'

export function login(request: LoginRequest) {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: request })
}

export function register(request: RegisterRequest) {
  return apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: request })
}

export function logout() {
  return apiRequest<void>('/auth/logout', { method: 'POST' })
}
