import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { sign, verify } from 'hono/jwt'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { hashPassword, isLegacyPasswordHash, verifyPassword } from './lib/crypto'
import { AuthSchema, Bindings, Variables, jsonError } from './lib/types'
import { AuthView, ExpensesView } from './views/layout'
import { createExpenseMcpHandler } from './mcp'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全局错误捕获
app.onError((err, c) => {
  console.error('🔥 CRASH AT:', c.req.url)
  console.error(err.stack || err.message)
  return c.text(`500 Error: ${err.message}`, 500)
})

// --- Schemas ---

export const CreateExpenseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  remark: z.string().min(1, 'Remark is required').max(255),
  tag: z.string().max(50).optional(),
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
})

export const UpdateExpenseSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  remark: z.string().min(1).max(255).optional(),
  tag: z.string().max(50).nullable().optional(),
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
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

async function authenticateUser(db: D1Database, email: string, password: string) {
  const user = await db
    .prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; password_hash: string }>()

  if (!user) return null

  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) return null

  if (isLegacyPasswordHash(user.password_hash)) {
    const { hash } = await hashPassword(password)
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.id).run()
  }

  return user
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

  const { query, params } = buildExpenseQuery(userId, { tag, from, to })

  // 使用 Promise.all 并发获取首页所需的全部数据
  const [
    user,
    { results: tagResults },
    { results: expenses },
    { results: spendByTag },
    { results: spendByDay },
    totalStats,
  ] = await Promise.all([
    c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first<{ email: string }>(),
    c.env.DB.prepare(
      'SELECT DISTINCT tag FROM expenses WHERE user_id = ? AND tag IS NOT NULL AND tag != "" ORDER BY tag ASC'
    ).bind(userId).all<{ tag: string }>(),
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(`
      SELECT COALESCE(tag, 'Uncategorized') as tag, SUM(amount) as total_amount
      FROM expenses WHERE user_id = ? GROUP BY tag ORDER BY total_amount DESC
    `).bind(userId).all<{ tag: string; total_amount: number }>(),
    c.env.DB.prepare(`
      SELECT spent_at, SUM(amount) as total_amount
      FROM expenses WHERE user_id = ? GROUP BY spent_at ORDER BY spent_at DESC LIMIT 7
    `).bind(userId).all<{ spent_at: string; total_amount: number }>(),
    c.env.DB.prepare(
      'SELECT SUM(amount) as total_spent, COUNT(id) as count FROM expenses WHERE user_id = ?'
    ).bind(userId).first<{ total_spent: number | null; count: number }>(),
  ])

  const availableTags = tagResults.map((r) => r.tag)

  return c.html(
    <ExpensesView
      expenses={expenses}
      availableTags={availableTags}
      currentFilters={{ tag, from, to }}
      userEmail={user?.email ?? ''}
      analytics={{
        totalSpent: totalStats?.total_spent ?? 0,
        totalCount: totalStats?.count ?? 0,
        spendByTag,
        spendByDay: spendByDay.reverse(),
      }}
    />
  )
})

// MCP Endpoint (✅ 独立注册在最外层)
app.all('/mcp/*', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const handler = createExpenseMcpHandler(c.env.DB, userId)
  return handler(c.req.raw)
})

// Auth Pages (HTML)
app.get('/login', (c) => c.html(<AuthView />))
app.get('/register', (c) => c.html(<AuthView isRegister />))

// Browser Form: Login
app.post('/auth/login', async (c) => {
  const body = await c.req.parseBody()
  const email = String(body.email || '')
  const password = String(body.password || '')

  const user = await authenticateUser(c.env.DB, email, password)
  if (!user) {
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
  const { hash } = await hashPassword(password)
  await c.env.DB.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .bind(id, email, hash)
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

// Browser Form: Delete All Expenses
app.post('/expenses/delete-all', uiAuthMiddleware, async (c) => {
  const userId = c.get('userId')
  await c.env.DB.prepare('DELETE FROM expenses WHERE user_id = ?').bind(userId).run()
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
  const { hash } = await hashPassword(password)

  await c.env.DB.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .bind(id, email, hash)
    .run()

  return c.json({ success: true, data: { id, email } }, 201)
})

// 2. API: Login
app.post('/api/auth/login', zValidator('json', AuthSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const user = await authenticateUser(c.env.DB, email, password)
  if (!user) {
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

// 6. API: List Expenses
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

// API: Delete All Expenses
app.delete('/api/expenses', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const result = await c.env.DB.prepare('DELETE FROM expenses WHERE user_id = ?').bind(userId).run()
  return c.json({
    success: true,
    data: { deletedCount: result.meta.changes },
  })
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

// 10. API: 聚合数据接口
app.get('/api/analytics/summary', authMiddleware, async (c) => {
  const userId = c.get('userId')

  const [spendByDayRes, spendByTagRes, topExpensesRes, totalStats] = await Promise.all([
    c.env.DB.prepare(`
      SELECT spent_at, SUM(amount) as total_amount
      FROM expenses
      WHERE user_id = ?
      GROUP BY spent_at
      ORDER BY spent_at DESC
      LIMIT 14
    `).bind(userId).all(),

    c.env.DB.prepare(`
      SELECT COALESCE(tag, 'Uncategorized') as tag, SUM(amount) as total_amount, COUNT(id) as count
      FROM expenses
      WHERE user_id = ?
      GROUP BY tag
      ORDER BY total_amount DESC
    `).bind(userId).all(),

    c.env.DB.prepare(`
      SELECT id, remark, amount, tag, spent_at
      FROM expenses
      WHERE user_id = ?
      ORDER BY amount DESC
      LIMIT 5
    `).bind(userId).all(),

    c.env.DB.prepare(`
      SELECT SUM(amount) as total_spent, COUNT(id) as total_count
      FROM expenses
      WHERE user_id = ?
    `).bind(userId).first<{ total_spent: number | null; total_count: number }>(),
  ])

  return c.json({
    success: true,
    data: {
      totalSpent: totalStats?.total_spent ?? 0,
      totalCount: totalStats?.total_count ?? 0,
      spendByDay: spendByDayRes.results.reverse(),
      spendByTag: spendByTagRes.results,
      topExpenses: topExpensesRes.results,
    },
  })
})

// 11. API: AI 标签智能推荐
app.post('/api/ai/suggest-tag', authMiddleware, async (c) => {
  let remark = ''
  try {
    const body = await c.req.json<{ remark: string }>()
    remark = body?.remark?.trim() || ''
  } catch {
    return c.json({ success: false, error: { message: 'Invalid JSON body' } }, 400)
  }

  if (!remark) {
    return c.json({ success: false, error: { message: 'Remark is required' } }, 400)
  }

  if (c.env.AI) {
    try {
      const response: any = await c.env.AI.run('@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', {
        temperature: 0.1,
        max_tokens: 512,
        messages: [
          {
            role: 'system',
            content:
              'You are an expense tagging assistant. Classify the given expense into EXACTLY ONE of these standard categories: [Food, Transport, Shopping, Bills, Entertainment, Health, Travel, Other]. Rules: - Computer hardware, electronics, accessories, or daily goods (e.g., mouse, keyboard, monitor) MUST be tagged as Shopping. - Output ONLY the chosen category name. Nothing else.',
          },
          {
            role: 'user',
            content: remark,
          },
        ],
      })

      let text = response?.response?.trim() || ''
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

      const validTags = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Travel', 'Other']
      const words = text.match(/[a-zA-Z]+/g) || []

      let matchedTag = ''
      for (let i = words.length - 1; i >= 0; i--) {
        const found = validTags.find((t) => t.toLowerCase() === words[i].toLowerCase())
        if (found) {
          matchedTag = found
          break
        }
      }

      const finalTag = matchedTag || (words.length > 0 ? words[words.length - 1] : 'Shopping')
      const cleanTag = finalTag.charAt(0).toUpperCase() + finalTag.slice(1).toLowerCase()

      return c.json({ success: true, data: { tag: cleanTag } })
    } catch (err) {
      console.warn('Workers AI unavailable in local dev, using smart rule engine:', err)
    }
  }

  const lower = remark.toLowerCase()
  let tag = 'Other'

  if (/coffee|starbucks|tea|latte|cafe|lunch|dinner|breakfast|food|burger|pizza|grocery|snack|kfc|mcdonald|bread|cake|eat|restaurant/.test(lower)) {
    tag = 'Food'
  } else if (/uber|grab|taxi|bus|mrt|lrt|train|subway|fuel|gas|petrol|parking|toll/.test(lower)) {
    tag = 'Transport'
  } else if (/flight|airline|hotel|airbnb|travel|trip|luggage|passport|tour/.test(lower)) {
    tag = 'Travel'
  } else if (/rent|wifi|bill|utility|electric|water|phone|internet|telco|subscription|netflix|spotify|aws|icloud/.test(lower)) {
    tag = 'Bills'
  } else if (/clothes|shoe|shirt|amazon|shopee|lazada|mall|uniqlo|apple|gadget|book|buy/.test(lower)) {
    tag = 'Shopping'
  } else if (/cinema|movie|game|steam|concert|bar|beer|party/.test(lower)) {
    tag = 'Entertainment'
  } else if (/doctor|clinic|hospital|medicine|pharmacy|gym|fitness|dental/.test(lower)) {
    tag = 'Health'
  }

  return c.json({ success: true, data: { tag } })
})

export default app