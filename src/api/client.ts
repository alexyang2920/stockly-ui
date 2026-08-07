import type { AuthResponse } from '../types/auth'

type ApiErrorBody = {
  message?: string
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  auth?: AuthResponse | null
}

export class ApiClientError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

  if (response.status === 204) return undefined as T

  const data = await response.json() as T | ApiErrorBody
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
