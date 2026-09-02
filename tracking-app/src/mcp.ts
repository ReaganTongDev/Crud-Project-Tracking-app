import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export function createExpenseMcpServer(db: D1Database, userId: string) {
  const server = new McpServer({
    name: 'Expense Tracker MCP',
    version: '1.0.0',
  })

  // Tool 1: Query raw expenses
  server.tool(
    'query_expenses',
    {
      tag: z.string().optional().describe('Filter by expense tag/category'),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Start date (YYYY-MM-DD)'),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('End date (YYYY-MM-DD)'),
      limit: z.number().int().min(1).max(50).default(20).describe('Max records to return'),
    },
    async ({ tag, from, to, limit }: { tag?: string; from?: string; to?: string; limit?: number }) => {
      let query = 'SELECT id, amount, remark, tag, spent_at FROM expenses WHERE user_id = ?'
      const params: any[] = [userId]

      if (tag) {
        query += ' AND tag = ?'
        params.push(tag)
      }
      if (from) {
        query += ' AND spent_at >= ?'
        params.push(from)
      }
      if (to) {
        query += ' AND spent_at <= ?'
        params.push(to)
      }

      query += ' ORDER BY spent_at DESC LIMIT ?'
      params.push(limit ?? 20)

      const { results } = await db.prepare(query).bind(...params).all()

      const formatted = results.map((r: any) => ({
        ...r,
        amount_usd: (r.amount / 100).toFixed(2),
      }))

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      }
    }
  )

  // Tool 2: Summary
  server.tool(
    'get_spending_summary',
    {},
    async () => {
      const { results: byTag } = await db.prepare(`
        SELECT COALESCE(tag, 'Uncategorized') as tag, SUM(amount) as total_cents, COUNT(id) as count
        FROM expenses
        WHERE user_id = ?
        GROUP BY tag
        ORDER BY total_cents DESC
      `).bind(userId).all()

      const totalRow = await db.prepare(`
        SELECT SUM(amount) as total_cents, COUNT(id) as total_transactions
        FROM expenses
        WHERE user_id = ?
      `).bind(userId).first<{ total_cents: number | null; total_transactions: number }>()

      const summary = {
        total_spent_usd: ((totalRow?.total_cents ?? 0) / 100).toFixed(2),
        total_transactions: totalRow?.total_transactions ?? 0,
        breakdown_by_tag: byTag.map((t: any) => ({
          tag: t.tag,
          total_usd: (t.total_cents / 100).toFixed(2),
          count: t.count,
        })),
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      }
    }
  )

  return server
}