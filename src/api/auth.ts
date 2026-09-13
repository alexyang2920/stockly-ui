import type { AuthActionResponse, AuthResponse, LoginRequest, RegisterRequest } from '../types/auth'
import { apiRequest } from './client'

export function login(request: LoginRequest) {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: request })
}

export function register(request: RegisterRequest) {
  return apiRequest<AuthActionResponse>('/auth/register', { method: 'POST', body: request })
}

export function resendVerification(email: string) {
  return apiRequest<AuthActionResponse>('/auth/resend-verification', { method: 'POST', body: { email } })
}

export function forgotPassword(email: string) {
  return apiRequest<AuthActionResponse>('/auth/forgot-password', { method: 'POST', body: { email } })
}

export function verifyEmail(token: string) {
  return apiRequest<void>('/auth/verify-email', { method: 'POST', body: { token } })
}

export function resetPassword(token: string, password: string) {
  return apiRequest<void>('/auth/reset-password', { method: 'POST', body: { token, password } })
}

export function logout() {
  return apiRequest<void>('/auth/logout', { method: 'POST' })
}
