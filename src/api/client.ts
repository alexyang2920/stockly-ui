import type { AuthResponse } from '../types/auth'

type ApiErrorBody = {
  message?: string
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  auth?: AuthResponse | null
}

type AuthLifecycle = {
  onRefreshed: (auth: AuthResponse) => void
  onExpired: () => void
}

let authLifecycle: AuthLifecycle | null = null
let refreshPromise: Promise<AuthResponse> | null = null

export function configureAuthLifecycle(lifecycle: AuthLifecycle | null) {
  authLifecycle = lifecycle
}

export class ApiClientError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/v1/auth/refresh', { method: 'POST' })
      .then(async (response) => {
        if (!response.ok) throw new ApiClientError('Your session has expired', response.status)
        const refreshed = await response.json() as AuthResponse
        authLifecycle?.onRefreshed(refreshed)
        return refreshed
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}, retryAfterRefresh = true): Promise<T> {
  const { auth, body, headers, ...requestOptions } = options
  const response = await fetch(`/api/v1${path}`, {
    ...requestOptions,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Authorization: `${auth.tokenType} ${auth.accessToken}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && auth && retryAfterRefresh) {
    try {
      const refreshed = await refreshAccessToken()
      return await apiRequest<T>(path, { ...options, auth: refreshed }, false)
    } catch (reason) {
      authLifecycle?.onExpired()
      throw reason
    }
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let data: T | ApiErrorBody = {} as ApiErrorBody
  if (text) {
    try { data = JSON.parse(text) as T | ApiErrorBody }
    catch { data = { message: text } }
  }
  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data && data.message ? data.message : `Request failed with status ${response.status}`
    throw new ApiClientError(message, response.status)
  }
  return data as T
}

export function apiErrorMessage(reason: unknown, fallback: string) {
  if (reason instanceof DOMException && reason.name === 'AbortError') return ''
  if (reason instanceof Error && reason.message !== 'Failed to fetch') return reason.message
  return fallback
}
