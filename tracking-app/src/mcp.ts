import { z } from 'zod'

export function createExpenseMcpHandler(db: D1Database, userId: string) {
  const tools = [
    {
      name: 'query_expenses',
      description: 'Query expenses with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          tag: { type: 'string', description: 'Filter by expense tag/category' },
          from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Start date (YYYY-MM-DD)' },
          to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'End date (YYYY-MM-DD)' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20, description: 'Max records to return' }
        }
      }
    },
    {
      name: 'get_spending_summary',
      description: 'Get spending summary by category',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ]

  async function handleToolCall(toolName: string, args: any) {
    if (toolName === 'query_expenses') {
      let query = 'SELECT id, amount, remark, tag, spent_at FROM expenses WHERE user_id = ?'
      const params: any[] = [userId]

      if (args.tag) {
        query += ' AND tag = ?'
        params.push(args.tag)
      }
      if (args.from) {
        query += ' AND spent_at >= ?'
        params.push(args.from)
      }
      if (args.to) {
        query += ' AND spent_at <= ?'
        params.push(args.to)
      }

      query += ' ORDER BY spent_at DESC LIMIT ?'
      params.push(args.limit ?? 20)

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

    if (toolName === 'get_spending_summary') {
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

    throw new Error(`Unknown tool: ${toolName}`)
  }

  async function handleMcpRequest(request: Request): Promise<Response> {
    const body = await request.json()
    const { jsonrpc, method, params, id } = body

    if (method === 'tools/list') {
      return Response.json({
        jsonrpc: '2.0',
        result: { tools },
        id
      })
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params
      try {
        const result = await handleToolCall(name, args)
        return Response.json({
          jsonrpc: '2.0',
          result,
          id
        })
      } catch (error: any) {
        return Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: error.message
          },
          id
        })
      }
    }

    return Response.json({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'Method not found'
      },
      id
    })
  }

  return handleMcpRequest
}