import { z } from 'zod'

export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

export type Variables = {
  userId: string
}

export const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const jsonError = (code: string, message: string, status: number = 400) => {
  return {
    success: false,
    error: { code, message },
  }
}