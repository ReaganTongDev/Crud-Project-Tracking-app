import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { sign, verify } from 'hono/jwt'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { hashPassword, verifyPassword } from './lib/crypto'
import { AuthSchema, Bindings, Variables, SuggestTagSchema, jsonError } from './lib/types'
import { AuthView, ExpensesView } from './views/layout'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// --- Schemas ---


export const CreateExpenseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  remark: z.string().min(1, 'Remark is required').max(255),
  tag: z.string().max(50).optional(),
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)'),
})

export const UpdateExpenseSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  remark: z.string().min(1).max(255).optional(),
  tag: z.string().max(50).nullable().optional(),
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)').optional(),
})

export const ExpenseFilterSchema = z.object({
  tag: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// --- Middlewares ---

// 1. API Auth Middleware (Returns JSON on 401)
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

// 2. UI Auth Middleware (Redirects browser to /login on unauthenticated)
const uiAuthMiddleware = async (c: any, next: any) => {
  const token = getCookie(c, 'token')
  if (!token) return c.redirect('/login')

  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256')
    if (!payload.sub) return c.redirect('/login')
    c.set('userId', payload.sub as string)
    await next()
  } catch {
    return c.redirect('/login')
  }
}

// Dynamic Filter Query Builder
function buildExpenseQuery(userId: string, filters: { tag?: string; from?: string; to?: string }) {
  let query = 'SELECT id, amount, remark, tag, spent_at, created_at FROM expenses WHERE user_id = ?'
  const params: any[] = [userId]

  if (filters.tag) {
    query += ' AND tag = ?'
    params.push(filters.tag)
  }
  if (filters.from) {
    query += ' AND spent_at >= ?'
    params.push(filters.from)
  }
  if (filters.to) {
    query += ' AND spent_at <= ?'
    params.push(filters.to)
  }

  query += ' ORDER BY spent_at DESC, created_at DESC'
  return { query, params }
}

// ==========================================
// --- SSR Pages & Web Form Handlers (UI) ---
// ==========================================

// Dashboard View
app.get('/', uiAuthMiddleware, async (c) => {
  const userId = c.get('userId')
  const tag = c.req.query('tag') || undefined
  const from = c.req.query('from') || undefined
  const to = c.req.query('to') || undefined

  const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?')
    .bind(userId)
    .first<{ email: string }>()

  // Fetch unique available tags for current user
  const { results: tagResults } = await c.env.DB.prepare(
    'SELECT DISTINCT tag FROM expenses WHERE user_id = ? AND tag IS NOT NULL AND tag != "" ORDER BY tag ASC'
  )
    .bind(userId)
    .all<{ tag: string }>()
  const availableTags = tagResults.map((r) => r.tag)

  // Fetch filtered expenses
  const { query, params } = buildExpenseQuery(userId, { tag, from, to })
  const { results: expenses } = await c.env.DB.prepare(query).bind(...params).all()

  return c.html(
    <ExpensesView
      expenses={expenses}
      availableTags={availableTags}
      currentFilters={{ tag, from, to }}
      userEmail={user?.email ?? ''}
    />
  )
})

// Auth Pages (HTML)
app.get('/login', (c) => c.html(<AuthView />))
app.get('/register', (c) => c.html(<AuthView isRegister />))

// Browser Form: Login
app.post('/auth/login', async (c) => {
  const body = await c.req.parseBody()
  const email = String(body.email || '')
  const password = String(body.password || '')

  const user = await c.env.DB.prepare('SELECT id, password_hash, salt FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; password_hash: string; salt: string }>()

  if (!user || !(await verifyPassword(password, user.password_hash, user.salt))) {
    return c.html(<AuthView error="Invalid email or password" />)
  }

  const token = await sign(
    { sub: user.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    c.env.JWT_SECRET
  )

  setCookie(c, 'token', token, {
    httpOnly: true,
    secure: c.req.url.startsWith('https'),
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return c.redirect('/')
})

// Browser Form: Register
app.post('/auth/register', async (c) => {
  const body = await c.req.parseBody()
  const email = String(body.email || '')
  const password = String(body.password || '')

  if (!email || password.length < 8) {
    return c.html(<AuthView isRegister error="Password must be at least 8 characters" />)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) {
    return c.html(<AuthView isRegister error="Email is already registered" />)
  }

  const id = crypto.randomUUID()
  const { hash, salt } = await hashPassword(password)
  await c.env.DB.prepare('INSERT INTO users (id, email, password_hash, salt) VALUES (?, ?, ?, ?)')
    .bind(id, email, hash, salt)
    .run()

  const token = await sign(
    { sub: id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    c.env.JWT_SECRET
  )

  setCookie(c, 'token', token, {
    httpOnly: true,
    secure: c.req.url.startsWith('https'),
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return c.redirect('/')
})

// Browser Form: Logout
app.post('/auth/logout', (c) => {
  deleteCookie(c, 'token', { path: '/' })
  return c.redirect('/login')
})

// Browser Form: Create Expense
app.post('/expenses', uiAuthMiddleware, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.parseBody()
  const remark = String(body.remark || '').trim()
  const tag = String(body.tag || '').trim() || null
  const spent_at = String(body.spent_at || '')
  const amountFloat = parseFloat(String(body.amount_display || '0'))
  const amount = Math.round(amountFloat * 100)

  if (amount > 0 && remark && /^\d{4}-\d{2}-\d{2}$/.test(spent_at)) {
    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO expenses (id, user_id, amount, remark, tag, spent_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(id, userId, amount, remark, tag, spent_at)
      .run()
  }

  return c.redirect('/')
})

// Browser Form: Delete Expense
app.post('/expenses/:id/delete', uiAuthMiddleware, async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').bind(id, userId).run()
  return c.redirect('/')
})

// ==========================================
// --- API Endpoints (JSON / CLI / Curl) ---
// ==========================================

// 1. API: Register
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

  await c.env.DB.prepare('INSERT INTO users (id, email, password_hash, salt) VALUES (?, ?, ?, ?)')
    .bind(id, email, hash, salt)
    .run()

  return c.json({ success: true, data: { id, email } }, 201)
})

// 2. API: Login
app.post('/api/auth/login', zValidator('json', AuthSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const user = await c.env.DB.prepare('SELECT id, password_hash, salt FROM users WHERE email = ?')
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
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
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

// 3. API: Logout
app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'token', { path: '/' })
  return c.json({ success: true })
})

// 4. API: Me
app.get('/api/auth/me', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const user = await c.env.DB.prepare('SELECT id, email, created_at FROM users WHERE id = ?')
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

// 5. API: Create Expense
app.post('/api/expenses', authMiddleware, zValidator('json', CreateExpenseSchema), async (c) => {
  const userId = c.get('userId')
  const { amount, remark, tag, spent_at } = c.req.valid('json')
  const id = crypto.randomUUID()

  await c.env.DB.prepare(
    'INSERT INTO expenses (id, user_id, amount, remark, tag, spent_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, userId, amount, remark, tag ?? null, spent_at)
    .run()

  return c.json({ success: true, data: { id, amount, remark, tag, spent_at } }, 201)
})

// 6. API: List Expenses (Supports dynamic filter query params)
app.get('/api/expenses', authMiddleware, zValidator('query', ExpenseFilterSchema), async (c) => {
  const userId = c.get('userId')
  const filters = c.req.valid('query')
  const { query, params } = buildExpenseQuery(userId, filters)

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ success: true, data: results })
})

// 7. API: Get Single Expense
app.get('/api/expenses/:id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const expense = await c.env.DB.prepare(
    'SELECT id, amount, remark, tag, spent_at, created_at FROM expenses WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first()

  if (!expense) {
    return c.json(jsonError('NOT_FOUND', 'Expense not found'), 404)
  }

  return c.json({ success: true, data: expense })
})

// 8. API: Update Expense
app.patch('/api/expenses/:id', authMiddleware, zValidator('json', UpdateExpenseSchema), async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const updates = c.req.valid('json')

  const existing = await c.env.DB.prepare(
    'SELECT id, amount, remark, tag, spent_at FROM expenses WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<{ id: string; amount: number; remark: string; tag: string | null; spent_at: string }>()

  if (!existing) {
    return c.json(jsonError('NOT_FOUND', 'Expense not found'), 404)
  }

  const newAmount = updates.amount ?? existing.amount
  const newRemark = updates.remark ?? existing.remark
  const newTag = updates.tag !== undefined ? updates.tag : existing.tag
  const newSpentAt = updates.spent_at ?? existing.spent_at

  await c.env.DB.prepare(
    'UPDATE expenses SET amount = ?, remark = ?, tag = ?, spent_at = ? WHERE id = ? AND user_id = ?'
  )
    .bind(newAmount, newRemark, newTag, newSpentAt, id, userId)
    .run()

  return c.json({
    success: true,
    data: { id, amount: newAmount, remark: newRemark, tag: newTag, spent_at: newSpentAt },
  })
})

// 9. API: Delete Expense
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

// Add this route in src/index.ts alongside other API routes
app.post('/api/ai/suggest-tag', authMiddleware, zValidator('json', SuggestTagSchema), async (c) => {
  const { remark } = c.req.valid('json')

  const prompt = `You are a financial categorization engine. Given the expense remark below, provide a single, concise category tag (1-2 words maximum, e.g., Food, Transport, Utilities, Entertainment, Health, Travel, Shopping). Output ONLY the tag word and nothing else. No punctuation, no explanation.

Remark: "${remark}"
Tag:`

  try {
    const response: any = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      prompt,
      max_tokens: 10,
    })

    const rawTag = (response.response || '').trim().replace(/[^a-zA-Z0-9\s-]/g, '')
    const suggestedTag = rawTag.split(/\s+/).slice(0, 2).join(' ') || 'General'

    return c.json({ success: true, data: { tag: suggestedTag } })
  } catch (err: any) {
    return c.json(jsonError('AI_ERROR', 'Failed to generate tag suggestion'), 500)
  }
})

export default app