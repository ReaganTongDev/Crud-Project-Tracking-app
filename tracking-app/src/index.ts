import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { sign, verify } from 'hono/jwt'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { hashPassword, verifyPassword } from './lib/crypto'
import { AuthSchema, Bindings, Variables, jsonError } from './lib/types'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

export const CreateExpenseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  remark: z.string().min(1, 'Remark is required').max(255),
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)'),
})

export const UpdateExpenseSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  remark: z.string().min(1).max(255).optional(),
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)').optional(),
})

// Auth Middleware
export const authMiddleware = async (c: any, next: any) => {
  const token = getCookie(c, 'token')
  if (!token) {
    return c.json(jsonError('UNAUTHORIZED', 'Missing authentication token'), 401)
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256')
    if (!payload.sub) {
      return c.json(jsonError('UNAUTHORIZED', 'Invalid token identity'), 401)
    }
    c.set('userId', payload.sub as string)
    await next()
  } catch {
    return c.json(jsonError('UNAUTHORIZED', 'Invalid or expired session'), 401)
  }
}

// 1. Register
app.post('/api/auth/register', zValidator('json', AuthSchema), async (c) => {
  const { email, password } = c.req.valid('json')
  
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first()

  if (existing) {
    return c.json(jsonError('USER_EXISTS', 'Email is already registered'), 409)
  }

  const id = crypto.randomUUID()
  const { hash, salt } = await hashPassword(password)

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, salt) VALUES (?, ?, ?, ?)'
  )
    .bind(id, email, hash, salt)
    .run()

  return c.json({ success: true, data: { id, email } }, 201)
})

// 2. Login
app.post('/api/auth/login', zValidator('json', AuthSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const user = await c.env.DB.prepare(
    'SELECT id, password_hash, salt FROM users WHERE email = ?'
  )
    .bind(email)
    .first<{ id: string; password_hash: string; salt: string }>()

  if (!user) {
    return c.json(jsonError('INVALID_CREDENTIALS', 'Invalid email or password'), 401)
  }

  const isValid = await verifyPassword(password, user.password_hash, user.salt)
  if (!isValid) {
    return c.json(jsonError('INVALID_CREDENTIALS', 'Invalid email or password'), 401)
  }

  const token = await sign(
    {
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    },
    c.env.JWT_SECRET
  )

  setCookie(c, 'token', token, {
    httpOnly: true,
    secure: c.req.url.startsWith('https'),
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return c.json({ success: true, data: { userId: user.id } })
})

// 3. Logout
app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'token', { path: '/' })
  return c.json({ success: true })
})

// 4. Verification Endpoint (Logged-out requests rejected)
app.get('/api/auth/me', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const user = await c.env.DB.prepare(
      'SELECT id, email, created_at FROM users WHERE id = ?'
    )
      .bind(userId)
      .first()

    if (!user) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
    }

    return c.json({ success: true, data: user })
  } catch (err: any) {
    return c.json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } }, 500)
  }
})

app.post('/api/expenses', authMiddleware, zValidator('json', CreateExpenseSchema), async (c) => {
  const userId = c.get('userId')
  const { amount, remark, spent_at } = c.req.valid('json')
  const id = crypto.randomUUID()

  await c.env.DB.prepare(
    'INSERT INTO expenses (id, user_id, amount, remark, spent_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(id, userId, amount, remark, spent_at)
    .run()

  return c.json({ success: true, data: { id, amount, remark, spent_at } }, 201)
})

// 2. List Expenses (Scoped to logged-in user)
app.get('/api/expenses', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(
    'SELECT id, amount, remark, spent_at, created_at FROM expenses WHERE user_id = ? ORDER BY spent_at DESC, created_at DESC'
  )
    .bind(userId)
    .all()

  return c.json({ success: true, data: results })
})

// 3. Get Single Expense
app.get('/api/expenses/:id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const expense = await c.env.DB.prepare(
    'SELECT id, amount, remark, spent_at, created_at FROM expenses WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first()

  if (!expense) {
    return c.json(jsonError('NOT_FOUND', 'Expense not found'), 404)
  }

  return c.json({ success: true, data: expense })
})

// 4. Update Expense
app.patch('/api/expenses/:id', authMiddleware, zValidator('json', UpdateExpenseSchema), async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const updates = c.req.valid('json')

  const existing = await c.env.DB.prepare(
    'SELECT id, amount, remark, spent_at FROM expenses WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<{ id: string; amount: number; remark: string; spent_at: string }>()

  if (!existing) {
    return c.json(jsonError('NOT_FOUND', 'Expense not found'), 404)
  }

  const newAmount = updates.amount ?? existing.amount
  const newRemark = updates.remark ?? existing.remark
  const newSpentAt = updates.spent_at ?? existing.spent_at

  await c.env.DB.prepare(
    'UPDATE expenses SET amount = ?, remark = ?, spent_at = ? WHERE id = ? AND user_id = ?'
  )
    .bind(newAmount, newRemark, newSpentAt, id, userId)
    .run()

  return c.json({
    success: true,
    data: { id, amount: newAmount, remark: newRemark, spent_at: newSpentAt },
  })
})

// 5. Delete Expense
app.delete('/api/expenses/:id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const result = await c.env.DB.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()

  if (result.meta.changes === 0) {
    return c.json(jsonError('NOT_FOUND', 'Expense not found'), 404)
  }

  return c.json({ success: true, data: { id } })
})

export default app