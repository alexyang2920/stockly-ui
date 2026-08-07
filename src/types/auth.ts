export type User = {
  id: string
  name: string
  email: string
  createdAt: string
}

export type AuthResponse = {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: User
}

export type LoginRequest = {
  email: string
  password: string
}

export type RegisterRequest = LoginRequest & {
  name: string
}
