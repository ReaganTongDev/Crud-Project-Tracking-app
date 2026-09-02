import { z } from 'zod'

export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  AI: any
}

export type Variables = {
  userId: string
}

export const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const CreateExpenseSchema = z.object({
  amount: z.number().int().positive(),
  remark: z.string().trim().min(1).max(255),
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  tag: z.string().trim().min(1).max(50).optional().nullable(),
})

export const UpdateExpenseSchema = CreateExpenseSchema.partial()

export const ExpenseFilterSchema = z.object({
  tag: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const SuggestTagSchema = z.object({
  remark: z.string().trim().min(1).max(255),
})

export const jsonError = (code: string, message: string, status: number = 400) => {
  return {
    success: false,
    error: { code, message },
  }
}